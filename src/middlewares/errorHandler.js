// @ts-nocheck
'use strict';

const multer = require('multer');
const { AppError } = require('../utils/errors');
const logger = require('../config/logger');

/** 404 兜底 */
function notFound(req, res) {
  res
    .status(404)
    .json({ code: 'NOT_FOUND', message: `接口不存在: ${req.method} ${req.path}` });
}

/** 全局错误处理 */
function errorHandler(err, req, res, next) {
  // eslint-disable-next-line no-unused-vars
  void next;

  if (err instanceof AppError) {
    const body = { code: err.code, message: err.message };
    if (err.details) body.details = err.details;
    res.status(err.status).json(body);
    return;
  }

  // express.json() 请求体超限
  if (err.type === 'entity.too.large') {
    res.status(413).json({ code: 'PAYLOAD_TOO_LARGE', message: '请求体过大' });
    return;
  }

  // multer 上传错误
  if (err instanceof multer.MulterError) {
    const map = {
      LIMIT_FILE_SIZE: '文件超过大小限制',
      LIMIT_FILE_COUNT: '文件数量超过限制',
      LIMIT_UNEXPECTED_FILE: '上传字段不是 file',
    };
    res
      .status(400)
      .json({ code: 'UPLOAD_ERROR', message: map[err.code] || err.message });
    return;
  }

  logger.error('Unhandled error', { error: err.message, stack: err.stack });
  res.status(500).json({ code: 'INTERNAL_ERROR', message: '服务器内部错误' });
}

module.exports = { notFound, errorHandler };
