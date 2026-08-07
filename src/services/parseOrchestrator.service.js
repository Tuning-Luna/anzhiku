// @ts-nocheck
'use strict';

const config = require('../config');
const logger = require('../config/logger');
const { models } = require('../db');
const documentAcquirer = require('./documentAcquirer.service');
const llmClient = require('./llmClient.service');
const jsonNormalizer = require('./jsonNormalizer.service');
const parsePrompt = require('./parsePrompt.service');
const questionImport = require('./questionImport.service');
const { validate, errorsText } = require('../validators/llmOutput.schema');

const { ParseTask, ParseError, LlmParseRecord } = models;

const ERROR_TYPES = [
  'json_parse',
  'schema_validation',
  'category_mismatch',
  'question_validation',
  'llm_error',
  'unknown',
];

/** 带错误码的错误，code 作为任务失败分类 */
function taskError(code, message, cause) {
  const err = new Error(message);
  err.code = code;
  if (cause) err.cause = cause;
  return err;
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function backoffMs(attempt) {
  return Math.min(1000 * 2 ** (attempt - 1), 8000);
}

async function recordLlm({ taskId, fileId, success, data }) {
  await LlmParseRecord.create({
    taskId,
    fileId,
    provider: 'aliyun-bailian',
    model: config.llm.model,
    strategy: 'doc_turbo_single',
    chunkIndex: 0,
    promptTokens: data.promptTokens || 0,
    completionTokens: data.completionTokens || 0,
    responseSnapshot: data.content || null,
    success,
    errorCode: data.errorCode || null,
    errorMessage: data.errorMessage || null,
    latencyMs: data.latencyMs || null,
  });
}

async function recordParseError(taskId, questionIndex, errorType, message, raw) {
  await ParseError.create({
    taskId,
    questionIndex,
    errorType,
    errorMessage: message,
    rawQuestion: raw || null,
  });
}

/**
 * LLM 调用 + JSON 提取，带重试。
 * 可重试的失败：网络/429/5xx、JSON 解析失败。
 * 不可重试（如 API Key 无效）：立即失败。
 */
async function callAndExtractWithRetry(task, bailianFileId) {
  const maxAttempts = config.llm.maxRetries + 1;

  for (let attempt = 1; ; attempt++) {
    const prompt = parsePrompt.buildExtractionPrompt();

    let content;
    try {
      const llm = await llmClient.parseDocument({ fileId: bailianFileId, prompt });
      content = llm.content;
      await recordLlm({ taskId: task.id, fileId: task.fileId, success: true, data: llm });
    } catch (err) {
      await recordLlm({
        taskId: task.id,
        fileId: task.fileId,
        success: false,
        data: { errorCode: String(err.status || 'NETWORK'), errorMessage: err.message },
      });
      if (attempt >= maxAttempts || !err.retryable) {
        throw taskError('llm_error', `LLM 调用失败: ${err.message}`, err);
      }
      logger.warn(`LLM 调用失败，第 ${attempt}/${maxAttempts} 次，将重试`, {
        taskId: task.id,
        error: err.message,
      });
      await sleep(backoffMs(attempt));
      continue;
    }

    try {
      const parsed = jsonNormalizer.extractJson(content);
      jsonNormalizer.assertBasicShape(parsed);
      if (!validate(parsed)) {
        throw taskError('schema_validation', `JSON Schema 校验失败: ${errorsText()}`);
      }
      return parsed;
    } catch (err) {
      if (err.code === 'schema_validation') throw err;
      if (attempt >= maxAttempts) {
        await recordParseError(task.id, null, 'json_parse', err.message, null);
        throw taskError('json_parse', `JSON 提取失败: ${err.message}`, err);
      }
      logger.warn(`JSON 提取失败，第 ${attempt}/${maxAttempts} 次，将重试`, {
        taskId: task.id,
      });
      await sleep(backoffMs(attempt));
    }
  }
}

/** 主流程 */
async function runTask(taskId) {
  const task = await ParseTask.findByPk(taskId, {
    include: [{ model: models.File, as: 'file' }],
  });
  if (!task) {
    logger.warn(`任务不存在，跳过: ${taskId}`);
    return;
  }
  if (task.status !== 'pending') {
    logger.debug(`任务 ${taskId} 状态为 ${task.status}，跳过`);
    return;
  }

  await task.update({ status: 'processing', startedAt: new Date() });

  let bailianFileId = null;
  try {
    bailianFileId = await documentAcquirer.acquire(task.file);

    const parsed = await callAndExtractWithRetry(task, bailianFileId);

    const result = await questionImport.importParsedQuestions(
      task,
      task.file,
      parsed
    );

    await task.update({
      status: result.failedCount > 0 ? 'partial_failed' : 'succeeded',
      model: config.llm.model,
      totalQuestions: result.total,
      successCount: result.successCount,
      failedCount: result.failedCount,
      finishedAt: new Date(),
    });
    logger.info(
      `任务 ${taskId} 完成: 成功 ${result.successCount}/${result.total}，失败 ${result.failedCount}`
    );
  } catch (err) {
    const code = ERROR_TYPES.includes(err.code) ? err.code : 'unknown';
    logger.error(`任务 ${taskId} 失败 [${code}]`, { error: err.message });
    await task.update({
      status: 'failed',
      errorCode: code,
      errorMessage: err.message || '未知错误',
      model: config.llm.model,
      finishedAt: new Date(),
    });
    await recordParseError(task.id, null, code, err.message, null);
  }
}

module.exports = { runTask };
