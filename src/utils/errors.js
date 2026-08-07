// @ts-nocheck
'use strict';

/**
 * 统一业务错误。所有已知错误都应通过它抛出，
 * 由全局 errorHandler 转为 { code, message, details } 响应。
 */
class AppError extends Error {
  constructor(message, options = {}) {
    super(message);
    this.name = 'AppError';
    this.code = options.code || 'INTERNAL_ERROR';
    this.status = options.status || 500;
    this.details = options.details || null;
    if (options.cause) {
      this.cause = options.cause;
    }
  }
}

AppError.badRequest = (message, details) =>
  new AppError(message, { code: 'BAD_REQUEST', status: 400, details });

AppError.notFound = (message) =>
  new AppError(message, { code: 'NOT_FOUND', status: 404 });

AppError.conflict = (message, details) =>
  new AppError(message, { code: 'CONFLICT', status: 409, details });

AppError.unprocessable = (message, details) =>
  new AppError(message, { code: 'UNPROCESSABLE', status: 422, details });

AppError.internal = (message, cause) =>
  new AppError(message || '服务器内部错误', { code: 'INTERNAL_ERROR', status: 500, cause });

/** 分类匹配失败（任务级错误，code 与 parse_errors.error_type 对齐） */
class CategoryMismatchError extends AppError {
  constructor(message, details) {
    super(message, { code: 'category_mismatch', status: 422, details });
  }
}

module.exports = { AppError, CategoryMismatchError };
