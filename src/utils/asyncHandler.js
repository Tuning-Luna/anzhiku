// @ts-nocheck
'use strict';

/** 包装 async 控制器，把异常交给全局错误处理中间件 */
const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

module.exports = { asyncHandler };
