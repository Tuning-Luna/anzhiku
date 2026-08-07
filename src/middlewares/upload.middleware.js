// @ts-nocheck
'use strict';

const path = require('path');
const multer = require('multer');
const config = require('../config');
const { AppError } = require('../utils/errors');

const allowed = config.upload.allowedExtensions;

/**
 * multer 上传配置：
 * - memoryStorage：先拿到 buffer 统一做校验与落盘，避免非法文件直接写盘
 * - 扩展名白名单 + 单文件
 *
 * 注意：multer 2.x 对超限文件是「静默截断」而非抛 LIMIT_FILE_SIZE，
 * 因此 fileSize 只做内存护栏（上限抬高 64KB），真正的大小限制由
 * file.controller.saveUploadedFile 对 buffer.length 做硬校验。
 */
const SIZE_GUARD_OVERHEAD = 64 * 1024;

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: config.upload.maxSizeBytes + SIZE_GUARD_OVERHEAD,
    files: 1,
  },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase();
    if (!allowed.includes(ext)) {
      cb(
        AppError.badRequest(
          `不支持的文件类型: ${ext || '未知'}，支持: ${allowed.join(', ')}`
        )
      );
      return;
    }
    cb(null, true);
  },
});

module.exports = upload;
