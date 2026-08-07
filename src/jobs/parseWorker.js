// @ts-nocheck
'use strict';

const { Op } = require('sequelize');
const { models } = require('../db');
const { ParseQueue } = require('../services/parseQueue.service');
const parseOrchestrator = require('../services/parseOrchestrator.service');
const config = require('../config');
const logger = require('../config/logger');

let queue = null;

function getQueue() {
  if (!queue) {
    queue = new ParseQueue(parseOrchestrator.runTask, {
      concurrency: config.job.concurrency,
    });
  }
  return queue;
}

/** 启动队列并恢复中断/遗留任务 */
async function start() {
  const q = getQueue();
  if (!q.running) {
    q.start();
    await recover(q);
  }
  return q;
}

/** 入队（自动懒启动，保证上传后立即消费） */
function enqueue(taskId) {
  getQueue().enqueue(taskId);
}

/**
 * 启动恢复：
 * - 上次进程退出时卡在 processing 的任务 → 置为 failed(INTERRUPTED)
 * - 遗留 pending 任务 → 重新入队
 */
async function recover(q) {
  const now = new Date();
  const [interruptedCount] = await models.ParseTask.update(
    {
      status: 'failed',
      errorCode: 'INTERRUPTED',
      errorMessage: '服务重启导致任务中断，可手动重试',
      finishedAt: now,
    },
    { where: { status: 'processing' } }
  );
  const pending = await models.ParseTask.findAll({
    where: { status: 'pending' },
  });
  logger.info(
    `任务恢复: 中断 ${interruptedCount} 个，重新入队 ${pending.length} 个`
  );
  pending.forEach((t) => q.enqueue(t.id));
}

module.exports = { start, enqueue };
