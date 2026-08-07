// @ts-nocheck
'use strict';

const logger = require('../config/logger');

/**
 * 进程内 FIFO 任务队列 + 固定并发 worker。
 * 单机本地工具无需 Redis；任务状态持久化在 DB，进程重启可恢复。
 * 未来扩展分布式时，可替换为 BullMQ/Redis 实现同接口。
 */
class ParseQueue {
  constructor(handler, { concurrency = 1 } = {}) {
    this.handler = handler;
    this.concurrency = concurrency;
    this.queue = [];
    this.active = 0;
    this.running = false;
  }

  start() {
    this.running = true;
    this._pump();
    logger.info(`解析队列已启动，并发 ${this.concurrency}`);
  }

  enqueue(taskId) {
    this.queue.push(taskId);
    logger.debug(`任务入队: ${taskId}，队列长度 ${this.queue.length}`);
    if (this.running) this._pump();
  }

  _pump() {
    while (this.running && this.active < this.concurrency && this.queue.length > 0) {
      const taskId = this.queue.shift();
      this.active += 1;
      this._run(taskId);
    }
  }

  async _run(taskId) {
    try {
      await this.handler(taskId);
    } catch (err) {
      // 编排层已捕获业务异常，这里仅兜底
      logger.error('任务处理器抛出未捕获异常', { taskId, error: err.message });
    } finally {
      this.active -= 1;
      this._pump();
    }
  }

  get pendingCount() {
    return this.queue.length;
  }
}

module.exports = { ParseQueue };
