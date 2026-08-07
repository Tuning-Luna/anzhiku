// @ts-nocheck
'use strict';

const { models } = require('../db');
const { AppError } = require('../utils/errors');

const { ParseTask } = models;

/** 创建解析任务并立即入队（pending），由 worker 消费 */
async function createPendingTask(fileId) {
  const task = await ParseTask.create({ fileId, status: 'pending' });
  // 队列会懒启动；未启动时任务停留在 pending，启动后自动恢复
  require('../jobs/parseWorker').enqueue(task.id);
  return task;
}

/** 查询任务 */
async function getTaskById(id) {
  const task = await ParseTask.findByPk(id);
  if (!task) {
    throw AppError.notFound(`任务不存在: ${id}`);
  }
  return task;
}

const TASK_STATUSES = ['pending', 'processing', 'succeeded', 'partial_failed', 'failed', 'cancelled'];

/** 分页列出任务（可按状态过滤） */
async function listTasks({ status, page = 1, pageSize = 20 } = {}) {
  const where = {};
  if (status && TASK_STATUSES.includes(status)) {
    where.status = status;
  }
  const { count, rows } = await ParseTask.findAndCountAll({
    where,
    order: [['id', 'DESC']],
    limit: pageSize,
    offset: (page - 1) * pageSize,
    include: [
      {
        model: models.File,
        as: 'file',
        attributes: ['id', 'originalName', 'extension'],
      },
    ],
  });
  return { total: count, page, pageSize, items: rows };
}

/** 任务详情（含文件、题库、失败清单、LLM 调用记录） */
async function getTaskDetail(id) {
  const task = await ParseTask.findByPk(id, {
    include: [
      {
        model: models.File,
        as: 'file',
        include: [
          {
            model: models.QuestionBank,
            as: 'bank',
            include: [
              { model: models.Category, as: 'category', attributes: ['id', 'name'] },
              { model: models.Category, as: 'subCategory', attributes: ['id', 'name'] },
            ],
          },
        ],
      },
      { model: models.ParseError, as: 'errors' },
      {
        model: models.LlmParseRecord,
        as: 'llmRecords',
        attributes: [
          'id',
          'model',
          'promptTokens',
          'completionTokens',
          'success',
          'errorCode',
          'errorMessage',
          'latencyMs',
          'createdAt',
        ],
      },
    ],
  });
  if (!task) {
    throw AppError.notFound(`任务不存在: ${id}`);
  }
  return task;
}

/** 重试：仅 failed / partial_failed 可重试，重试前清空失败清单 */
async function requeue(taskId) {
  const task = await getTaskById(taskId);
  if (!['failed', 'partial_failed'].includes(task.status)) {
    throw AppError.conflict(`任务状态 ${task.status} 不可重试`);
  }
  await models.ParseError.destroy({ where: { taskId: task.id } });
  await task.update({
    status: 'pending',
    retryCount: (task.retryCount || 0) + 1,
    errorCode: null,
    errorMessage: null,
    finishedAt: null,
    totalQuestions: 0,
    successCount: 0,
    failedCount: 0,
  });
  require('../jobs/parseWorker').enqueue(task.id);
  return task;
}

module.exports = {
  createPendingTask,
  getTaskById,
  listTasks,
  getTaskDetail,
  requeue,
};
