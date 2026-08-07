// @ts-nocheck
'use strict';

const crypto = require('crypto');
const fs = require('fs');
const fsp = fs.promises;
const path = require('path');
const config = require('../config');
const { AppError } = require('../utils/errors');

const ROOT = path.resolve(config.upload.dir);

/**
 * 本地磁盘存储服务。
 * 接口化设计：未来如需对象存储（OSS），实现同一接口替换即可。
 */
const fileStorage = {
  /** 按 YYYY/MM 生成相对子目录 */
  _dateDir() {
    const d = new Date();
    const yyyy = String(d.getFullYear());
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    return path.join(yyyy, mm);
  },

  /** 取文件扩展名（小写，含点），无则返回空串 */
  extOf(originalName) {
    return path.extname(String(originalName || '')).toLowerCase();
  },

  /**
   * 保存文件内容到本地磁盘。
   * @returns {{storedName:string, storageDir:string, extension:string, absolutePath:string}}
   */
  async save(buffer, { originalName, mimeType }) {
    const extension = this.extOf(originalName);
    const storedName = `${crypto.randomUUID()}${extension}`;
    const storageDir = this._dateDir();
    const absoluteDir = path.join(ROOT, storageDir);
    await fsp.mkdir(absoluteDir, { recursive: true });
    const absolutePath = path.join(absoluteDir, storedName);
    await fsp.writeFile(absolutePath, buffer);
    return { storedName, storageDir, extension, absolutePath };
  },

  /**
   * 由 DB 中的相对路径解析出磁盘绝对路径，并做路径穿越防护。
   */
  resolveAbsolutePath(storageDir, storedName) {
    const rootResolved = path.resolve(ROOT);
    const abs = path.resolve(rootResolved, storageDir || '', storedName || '');
    if (abs !== rootResolved && !abs.startsWith(rootResolved + path.sep)) {
      throw AppError.badRequest('非法文件路径');
    }
    return abs;
  },

  /** 文件是否存在 */
  async exists(storageDir, storedName) {
    const abs = this.resolveAbsolutePath(storageDir, storedName);
    try {
      await fsp.access(abs);
      return true;
    } catch {
      return false;
    }
  },

  /** 创建只读流用于下载回显 */
  createReadStream(storageDir, storedName) {
    const abs = this.resolveAbsolutePath(storageDir, storedName);
    return fs.createReadStream(abs);
  },
};

module.exports = fileStorage;
