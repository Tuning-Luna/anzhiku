// @ts-nocheck
'use strict';

const fs = require('fs');
const path = require('path');
const winston = require('winston');
const config = require('./index');

const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    const extra = Object.keys(meta).length > 0 ? ` ${JSON.stringify(meta)}` : '';
    return `${timestamp} [${level}] ${message}${extra}`;
  })
);

const transports = [
  new winston.transports.Console({ format: consoleFormat }),
];

// 测试环境下不写文件日志，避免污染
if (config.env !== 'test') {
  const logDir = path.resolve(__dirname, '../../logs');
  fs.mkdirSync(logDir, { recursive: true });
  transports.push(
    new winston.transports.File({
      filename: path.join(logDir, 'combined.log'),
      maxsize: 10 * 1024 * 1024,
      maxFiles: 5,
      tailable: true,
    })
  );
}

const logger = winston.createLogger({
  level: config.log.level,
  transports,
});

module.exports = logger;
