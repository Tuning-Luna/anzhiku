// @ts-nocheck
'use strict';

const parseTaskService = require('../services/parseTaskService');

function serializeTask(task) {
  return {
    id: task.id,
    fileId: task.fileId,
    status: task.status,
    strategy: task.strategy,
    model: task.model,
    totalQuestions: task.totalQuestions,
    successCount: task.successCount,
    failedCount: task.failedCount,
    errorCode: task.errorCode,
    errorMessage: task.errorMessage,
    retryCount: task.retryCount,
    startedAt: task.startedAt,
    finishedAt: task.finishedAt,
    createdAt: task.createdAt,
    file: task.file
      ? {
          id: task.file.id,
          originalName: task.file.originalName,
          extension: task.file.extension,
        }
      : null,
  };
}

function serializeTaskDetail(task) {
  return {
    ...serializeTask(task),
    file: task.file
      ? {
          id: task.file.id,
          originalName: task.file.originalName,
          mimeType: task.file.mimeType,
          sizeBytes: task.file.sizeBytes,
          sourceType: task.file.sourceType,
          sourceUrl: task.file.sourceUrl,
          bank: task.file.bank
            ? {
                id: task.file.bank.id,
                name: task.file.bank.name,
                categoryId: task.file.bank.categoryId,
                subCategoryId: task.file.bank.subCategoryId,
                questionCount: task.file.bank.questionCount,
                category: task.file.bank.category || null,
                subCategory: task.file.bank.subCategory || null,
              }
            : null,
        }
      : null,
    errors: (task.errors || []).map((e) => ({
      id: e.id,
      questionIndex: e.questionIndex,
      errorType: e.errorType,
      errorMessage: e.errorMessage,
      rawQuestion: e.rawQuestion,
    })),
    llmRecords: task.llmRecords || [],
  };
}

/** GET /api/tasks */
async function listTasks(req, res) {
  const page = Math.max(1, Number(req.query.page) || 1);
  const pageSize = Math.min(100, Math.max(1, Number(req.query.pageSize) || 20));
  const result = await parseTaskService.listTasks({
    status: req.query.status,
    page,
    pageSize,
  });
  res.json({
    total: result.total,
    page,
    pageSize,
    items: result.items.map(serializeTask),
  });
}

/** GET /api/tasks/:id */
async function getTask(req, res) {
  const task = await parseTaskService.getTaskDetail(req.params.id);
  res.json({ task: serializeTaskDetail(task) });
}

/** POST /api/tasks/:id/retry */
async function retryTask(req, res) {
  const task = await parseTaskService.requeue(req.params.id);
  res.json({ message: '任务已重新入队', task: serializeTask(task) });
}

module.exports = { listTasks, getTask, retryTask };
