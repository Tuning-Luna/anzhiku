// @ts-nocheck
'use strict';

const path = require('path');
const dotenv = require('dotenv');

// 统一从这里加载 .env，配置只暴露一次
dotenv.config({ quiet: true });

/** 读取环境变量，带默认值 */
function env(key, fallback) {
  const value = process.env[key];
  return value === undefined || value === '' ? fallback : value;
}

/** 解析为 MB 大小的字节数 */
function mb(value) {
  return Number(value) * 1024 * 1024;
}

const ALLOWED_EXTENSIONS = ['.pdf', '.docx', '.xlsx', '.txt'];

const config = {
  env: env('NODE_ENV', 'development'),
  port: Number(env('PORT', 3000)),

  db: {
    host: env('DB_HOST', '127.0.0.1'),
    port: Number(env('DB_PORT', 3306)),
    username: env('DB_USER', 'root'),
    password: env('DB_PASSWORD', ''),
    database: env('DB_NAME', 'anzhiku'),
    dialect: 'mysql',
  },

  upload: {
    dir: path.resolve(env('UPLOAD_DIR', './storage/files')),
    maxSizeBytes: mb(env('MAX_FILE_SIZE_MB', 50)),
    allowedExtensions: ALLOWED_EXTENSIONS,
    urlMaxSizeBytes: mb(env('URL_MAX_SIZE_MB', 50)),
    urlDownloadTimeoutMs: Number(env('URL_DOWNLOAD_TIMEOUT_MS', 30000)),
    urlMaxRedirects: 3,
  },

  llm: {
    apiKey: env('DASHSCOPE_API_KEY', ''),
    baseUrl: env(
      'DASHSCOPE_BASE_URL',
      'https://dashscope.aliyuncs.com/compatible-mode/v1'
    ),
    model: env('LLM_MODEL', 'qwen-doc-turbo'),
    maxRetries: Number(env('LLM_MAX_RETRIES', 2)),
    // 流式调用下的「空闲超时」：长时间无响应数据才中断（毫秒）
    timeoutMs: Number(env('LLM_TIMEOUT_MS', 300000)),
  },

  job: {
    concurrency: Number(env('JOB_CONCURRENCY', 1)),
  },

  log: {
    level: env('LOG_LEVEL', 'info'),
  },
};

module.exports = config;
