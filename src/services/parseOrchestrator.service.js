// @ts-nocheck
'use strict';

const config = require('../config');
const logger = require('../config/logger');
const { models } = require('../db');
const documentAcquirer = require('./documentAcquirer.service');
const documentTextExtractor = require('./documentTextExtractor.service');
const llmClient = require('./llmClient.service');
const jsonNormalizer = require('./jsonNormalizer.service');
const parsePrompt = require('./parsePrompt.service');
const questionImport = require('./questionImport.service');
const textChunker = require('./textChunker.service');
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

// 本地提取到的文本低于该长度视为提取失败，回退 file-id 单次模式
const MIN_EXTRACT_CHARS = 10;

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

async function recordLlm({ taskId, fileId, success, data, chunkIndex = 0, strategy }) {
  await LlmParseRecord.create({
    taskId,
    fileId,
    provider: 'aliyun-bailian',
    model: config.llm.model,
    strategy: strategy || 'text_chunk',
    chunkIndex,
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
 * 通用「调用 LLM + 提取 JSON」，带重试。
 * performCall() 返回 { content, ... }。
 * 可重试失败：网络/429/5xx、JSON 解析失败；不可重试（如 API Key 无效）立即失败。
 */
async function retryableExtract(task, performCall, { chunkIndex = 0, strategy }) {
  const maxAttempts = config.llm.maxRetries + 1;

  for (let attempt = 1; ; attempt++) {
    let content;
    try {
      const llm = await performCall();
      content = llm.content;
      await recordLlm({
        taskId: task.id,
        fileId: task.fileId,
        success: true,
        data: llm,
        chunkIndex,
        strategy,
      });
    } catch (err) {
      await recordLlm({
        taskId: task.id,
        fileId: task.fileId,
        success: false,
        chunkIndex,
        strategy,
        data: { errorCode: String(err.status || 'NETWORK'), errorMessage: err.message },
      });
      if (attempt >= maxAttempts || !err.retryable) {
        throw taskError('llm_error', `LLM 调用失败: ${err.message}`, err);
      }
      logger.warn(`LLM 调用失败，第 ${attempt}/${maxAttempts} 次，将重试`, {
        taskId: task.id,
        chunkIndex,
        error: err.message,
      });
      await sleep(backoffMs(attempt));
      continue;
    }

    try {
      const parsed = jsonNormalizer.extractJson(content);
      jsonNormalizer.assertBasicShape(parsed);
      return parsed;
    } catch (err) {
      if (attempt >= maxAttempts) {
        await recordParseError(
          task.id,
          null,
          'json_parse',
          `分块 ${chunkIndex + 1} JSON 提取失败: ${err.message}`,
          null
        );
        throw taskError('json_parse', `分块 ${chunkIndex + 1} JSON 提取失败: ${err.message}`, err);
      }
      logger.warn(`JSON 提取失败，第 ${attempt}/${maxAttempts} 次，将重试`, {
        taskId: task.id,
        chunkIndex,
      });
      await sleep(backoffMs(attempt));
    }
  }
}

/**
 * 文本分块提取：逐块调用模型，合并结果。
 * 解决长文档单次提取时模型严重少提取的问题（如 650 题只返回 3 题）。
 */
async function extractFromTextChunks(task, text) {
  const chunks = textChunker.chunkText(text, { maxChars: config.llm.chunkMaxChars });
  logger.info(`文本分块 ${chunks.length} 块`, { taskId: task.id });

  const allQuestions = [];
  let category;
  let subCategory = null;

  for (let i = 0; i < chunks.length; i++) {
    const prompt = parsePrompt.buildExtractionPrompt({
      partIndex: i + 1,
      partTotal: chunks.length,
    });
    const parsed = await retryableExtract(
      task,
      () => llmClient.parseTextChunk({ text: chunks[i], prompt }),
      { chunkIndex: i, strategy: 'text_chunk' }
    );

    if (i === 0) {
      category = parsed.category;
      subCategory = parsed.subCategory ?? null;
    }
    allQuestions.push(...(parsed.questions || []));
  }

  if (allQuestions.length === 0) {
    throw taskError('json_parse', '所有分块均未提取到题目');
  }

  const merged = { category, subCategory, questions: allQuestions };
  if (!validate(merged)) {
    throw taskError('schema_validation', `合并结果 Schema 校验失败: ${errorsText()}`);
  }
  return merged;
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

  let strategy = 'doc_turbo_single';
  let bailianFileId = null;
  try {
    // 1. 尝试本地文本提取（txt/docx/xlsx/pdf）
    let text = null;
    try {
      text = await documentTextExtractor.extractText(task.file);
    } catch (err) {
      logger.warn(`本地文本提取失败: ${err.message}`, { taskId });
    }

    let parsed;
    if (text && text.trim().length >= MIN_EXTRACT_CHARS) {
      // 2a. 分块提取（默认）
      strategy = 'text_chunk';
      parsed = await extractFromTextChunks(task, text);
    } else {
      // 2b. 回退：file-extract + 单次调用（如扫描版 PDF 本地抽不出文本）
      bailianFileId = await documentAcquirer.acquire(task.file);
      const prompt = parsePrompt.buildExtractionPrompt();
      parsed = await retryableExtract(
        task,
        () => llmClient.parseDocument({ fileId: bailianFileId, prompt }),
        { chunkIndex: 0, strategy: 'doc_turbo_single' }
      );
    }

    const result = await questionImport.importParsedQuestions(task, task.file, parsed);

    await task.update({
      status: result.failedCount > 0 ? 'partial_failed' : 'succeeded',
      model: config.llm.model,
      strategy,
      totalQuestions: result.total,
      successCount: result.successCount,
      failedCount: result.failedCount,
      finishedAt: new Date(),
    });
    logger.info(
      `任务 ${taskId} 完成(${strategy}): 成功 ${result.successCount}/${result.total}，失败 ${result.failedCount}`
    );
  } catch (err) {
    const code = ERROR_TYPES.includes(err.code) ? err.code : 'unknown';
    logger.error(`任务 ${taskId} 失败 [${code}]`, { error: err.message });
    await task.update({
      status: 'failed',
      errorCode: code,
      errorMessage: err.message || '未知错误',
      model: config.llm.model,
      strategy,
      finishedAt: new Date(),
    });
    await recordParseError(task.id, null, code, err.message, null);
  }
}

module.exports = { runTask };
