// @ts-nocheck
'use strict';

const config = require('../config');
const fileStorage = require('../services/fileStorage.service');
const fileService = require('../services/fileService');
const parseTaskService = require('../services/parseTaskService');
const { AppError } = require('../utils/errors');

/** 修复 multer 对中文文件名的 latin1 解码问题 */
function fixEncoding(name) {
  if (!name) return name;
  try {
    return Buffer.from(name, 'latin1').toString('utf8');
  } catch {
    return name;
  }
}

/** 落盘 + 建 file 记录 + 创建解析任务（上传与 URL 共用） */
async function saveUploadedFile({ buffer, originalName, mimeType, sourceType, sourceUrl }) {
  // 硬校验大小：multer 会静默截断超限文件，必须在这里拦截
  if (buffer.length > config.upload.maxSizeBytes) {
    throw AppError.badRequest('文件超过大小限制');
  }

  const fixedName = fixEncoding(originalName);
  const extension = fileStorage.extOf(fixedName);
  if (!fileService.isAllowedExtension(extension)) {
    throw AppError.badRequest(`不支持的文件类型: ${extension || '未知'}`);
  }

  const saved = await fileStorage.save(buffer, { originalName: fixedName, mimeType });
  const sha256 = fileService.computeSha256(buffer);
  const file = await fileService.createFileRecord({
    originalName: fixedName,
    storedName: saved.storedName,
    storageDir: saved.storageDir,
    extension: saved.extension,
    mimeType,
    sizeBytes: buffer.length,
    sha256,
    sourceType,
    sourceUrl,
  });
  const task = await parseTaskService.createPendingTask(file.id);
  return { file, task };
}

function serializeFile(file) {
  return {
    id: file.id,
    originalName: file.originalName,
    sizeBytes: file.sizeBytes,
    mimeType: file.mimeType,
    extension: file.extension,
    sha256: file.sha256,
    sourceType: file.sourceType,
    sourceUrl: file.sourceUrl,
    status: file.status,
    createdAt: file.createdAt,
  };
}

/** POST /api/files —— multipart 上传 */
async function uploadFile(req, res) {
  if (!req.file) {
    throw AppError.badRequest('未收到文件，字段名应为 file');
  }
  const { file, task } = await saveUploadedFile({
    buffer: req.file.buffer,
    originalName: req.file.originalname,
    mimeType: req.file.mimetype,
    sourceType: 'upload',
    sourceUrl: null,
  });
  res.status(201).json({ fileId: file.id, taskId: task.id, file: serializeFile(file) });
}

/** POST /api/files/from-url —— URL 下载导入 */
async function importFromUrl(req, res) {
  const { url } = req.body || {};
  if (!url || typeof url !== 'string') {
    throw AppError.badRequest('缺少 url');
  }
  const { buffer, contentType, sizeBytes } = await fileService.downloadFromUrl(url);
  const originalName = fileService.deriveFilename(url, contentType);

  const { file, task } = await saveUploadedFile({
    buffer,
    originalName,
    mimeType: contentType,
    sourceType: 'url',
    sourceUrl: url,
  });
  res.status(201).json({ fileId: file.id, taskId: task.id, file: serializeFile(file) });
}

/** GET /api/files —— 分页列表 */
async function listFiles(req, res) {
  const page = Math.max(1, Number(req.query.page) || 1);
  const pageSize = Math.min(100, Math.max(1, Number(req.query.pageSize) || 20));
  const result = await fileService.listFiles({ page, pageSize });
  res.json({ ...result, items: result.items.map(serializeFile) });
}

/** GET /api/files/:id —— 元数据 */
async function getFile(req, res) {
  const file = await fileService.getFileById(req.params.id);
  res.json({ file: serializeFile(file) });
}

/** GET /api/files/:id/download —— 原文件回显 */
async function downloadFile(req, res) {
  const file = await fileService.getFileById(req.params.id);
  const exists = await fileStorage.exists(file.storageDir, file.storedName);
  if (!exists) {
    throw AppError.notFound('文件实体不存在');
  }
  res.setHeader('Content-Type', file.mimeType || 'application/octet-stream');
  res.setHeader('Content-Length', file.sizeBytes);
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="download${file.extension || ''}"; filename*=UTF-8''${encodeURIComponent(
      file.originalName
    )}`
  );
  const stream = fileStorage.createReadStream(file.storageDir, file.storedName);
  stream.on('error', () => {
    if (!res.headersSent) {
      res.status(404).json({ code: 'NOT_FOUND', message: '文件读取失败' });
    }
  });
  stream.pipe(res);
}

/** DELETE /api/files/:id —— 软删文件并级联软删题库与题目 */
async function deleteFile(req, res) {
  const file = await fileService.deleteFile(req.params.id);
  res.json({ message: '文件已删除', fileId: file.id });
}

module.exports = {
  uploadFile,
  importFromUrl,
  listFiles,
  getFile,
  downloadFile,
  deleteFile,
};
