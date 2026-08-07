// @ts-nocheck
'use strict';

const fs = require('fs').promises;
const fileStorage = require('./fileStorage.service');
const llmClient = require('./llmClient.service');

/**
 * 内容获取：把本地存储的文件交给百炼解析，得到 file_id。
 * txt 也走 file-extract（统一路径，避免纯文本 9k token 上限）。
 */
async function acquire(file) {
  const absolutePath = fileStorage.resolveAbsolutePath(
    file.storageDir,
    file.storedName
  );
  const buffer = await fs.readFile(absolutePath);
  return llmClient.uploadFile(buffer, {
    originalName: file.originalName,
    mimeType: file.mimeType,
  });
}

module.exports = { acquire };
