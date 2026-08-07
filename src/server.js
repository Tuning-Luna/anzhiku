// @ts-nocheck
'use strict';

const app = require('./app');
const config = require('./config');
const logger = require('./config/logger');
const { sequelize } = require('./db');
const parseWorker = require('./jobs/parseWorker');

async function main() {
  await sequelize.authenticate();
  logger.info('MySQL 连接成功');

  // 启动解析队列 worker，并恢复中断/遗留任务
  await parseWorker.start();

  const server = app.listen(config.port, () => {
    logger.info(`服务已启动: http://localhost:${config.port}`);
  });
  server.on('error', (err) => {
    logger.error(`服务监听失败: ${err.message}`);
    process.exit(1);
  });

  const shutdown = async (signal) => {
    logger.info(`收到 ${signal}，正在关闭服务...`);
    server.close(async () => {
      try {
        await sequelize.close();
      } finally {
        process.exit(0);
      }
    });
  };
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

main().catch((err) => {
  logger.error('服务启动失败', { error: err.message, stack: err.stack });
  process.exit(1);
});
