// @ts-nocheck
'use strict';

const crypto = require('crypto');
const http = require('http');
const https = require('https');
const path = require('path');
const { Op } = require('sequelize');
const { models } = require('../db');
const config = require('../config');
const { AppError } = require('../utils/errors');

const { File, QuestionBank, Question } = models;

/** 计算内容 sha256 */
function computeSha256(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

/**
 * 从 URL 下载文件（流式累计，带超时 / 大小上限 / 重定向限制）。
 * @returns {Promise<{buffer:Buffer, contentType:string|null, sizeBytes:number}>}
 */
function downloadFromUrl(url) {
  const { urlMaxSizeBytes, urlDownloadTimeoutMs, urlMaxRedirects } = config.upload;

  return new Promise((resolve, reject) => {
    let parsed;
    try {
      parsed = new URL(url);
    } catch {
      return reject(AppError.badRequest('URL 格式非法'));
    }
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return reject(AppError.badRequest('仅支持 http/https 协议的 URL'));
    }

    const chunks = [];
    let total = 0;
    let redirects = 0;
    let settled = false;
    let contentType = null;

    const finish = (fn, arg) => {
      if (!settled) {
        settled = true;
        fn(arg);
      }
    };

    const request = (targetUrl) => {
      const u = new URL(targetUrl);
      const lib = u.protocol === 'https:' ? https : http;

      const req = lib.get(
        u,
        { headers: { 'User-Agent': 'anzhiku-file-importer/1.0' }, timeout: urlDownloadTimeoutMs },
        (res) => {
          const status = res.statusCode;

          // 重定向（限制次数）
          if (status >= 300 && status < 400 && res.headers.location) {
            res.resume();
            redirects += 1;
            if (redirects > urlMaxRedirects) {
              return finish(reject, AppError.badRequest('URL 重定向次数过多'));
            }
            return request(new URL(res.headers.location, targetUrl).href);
          }

          if (status !== 200) {
            res.resume();
            return finish(reject, AppError.badRequest(`URL 下载失败: HTTP ${status}`));
          }

          contentType = (res.headers['content-type'] || '').split(';')[0].trim().toLowerCase();

          // 服务端声明的大小超过上限，直接中断
          const declared = Number(res.headers['content-length'] || 0);
          if (declared > urlMaxSizeBytes) {
            res.destroy();
            return finish(reject, AppError.badRequest('URL 文件超过大小限制'));
          }

          res.on('data', (chunk) => {
            total += chunk.length;
            if (total > urlMaxSizeBytes) {
              req.destroy();
              return finish(reject, AppError.badRequest('URL 文件超过大小限制'));
            }
            chunks.push(chunk);
          });
          res.on('end', () => {
            finish(resolve, {
              buffer: Buffer.concat(chunks),
              contentType,
              sizeBytes: total,
            });
          });
          res.on('error', (err) => finish(reject, err));
        }
      );

      req.on('timeout', () => {
        req.destroy(new Error('URL 下载超时'));
      });
      req.on('error', (err) => finish(reject, err));
    };

    request(parsed.href);
  });
}

/** 从 URL / Content-Type 推导一个合理的文件名 */
function deriveFilename(url, contentType) {
  try {
    const base = path.posix.basename(new URL(url).pathname);
    if (base && path.extname(base)) {
      try {
        return decodeURIComponent(base);
      } catch {
        return base;
      }
    }
  } catch {
    // ignore
  }
  const map = {
    'application/pdf': 'document.pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'document.docx',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'document.xlsx',
    'text/plain': 'document.txt',
  };
  return map[contentType] || 'document.bin';
}

/** 创建 file 记录 */
async function createFileRecord(data) {
  return File.create({
    originalName: data.originalName,
    storedName: data.storedName,
    storageDir: data.storageDir,
    mimeType: data.mimeType || null,
    extension: data.extension || null,
    sizeBytes: data.sizeBytes,
    sha256: data.sha256 || null,
    sourceType: data.sourceType || 'upload',
    sourceUrl: data.sourceUrl || null,
  });
}

/** 按 id 查询文件（默认排除已删除） */
async function getFileById(id, { withDeleted = false } = {}) {
  const file = await File.findByPk(id);
  if (!file || (file.status === 'deleted' && !withDeleted)) {
    throw AppError.notFound(`文件不存在: ${id}`);
  }
  return file;
}

/** 分页列出文件 */
async function listFiles({ page = 1, pageSize = 20 } = {}) {
  const where = { status: 'active' };
  const { count, rows } = await File.findAndCountAll({
    where,
    order: [['id', 'DESC']],
    limit: pageSize,
    offset: (page - 1) * pageSize,
  });
  return { total: count, page, pageSize, items: rows };
}

/** 删除文件（软删）并级联软删其题库与题目 */
async function deleteFile(id) {
  const file = await getFileById(id);
  const bank = await QuestionBank.findOne({ where: { fileId: file.id, status: 'active' } });
  if (bank) {
    await Question.update(
      { status: 'disabled' },
      { where: { bankId: bank.id, status: 'active' } }
    );
    await bank.update({ status: 'deleted' });
  }
  await file.update({ status: 'deleted' });
  return file;
}

/** 校验扩展名是否在白名单内 */
function isAllowedExtension(extension) {
  return config.upload.allowedExtensions.includes(String(extension || '').toLowerCase());
}

module.exports = {
  computeSha256,
  downloadFromUrl,
  deriveFilename,
  createFileRecord,
  getFileById,
  listFiles,
  deleteFile,
  isAllowedExtension,
};
