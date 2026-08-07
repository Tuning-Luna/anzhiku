// @ts-nocheck
'use strict';

/**
 * 按段落切分长文本为多个块。
 * 目的：避免单次 LLM 调用需要生成过多题目（长文档单次提取会严重少提取）。
 * maxChars 默认约 9000 字符 ≈ 6000 token，低于 qwen-doc-turbo 纯文本 9000 token 上限。
 */
function chunkText(text, { maxChars = 9000 } = {}) {
  const paragraphs = String(text || '')
    .split(/\n+/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0);

  const chunks = [];
  let current = [];
  let currentLen = 0;

  for (const paragraph of paragraphs) {
    if (current.length > 0 && currentLen + paragraph.length > maxChars) {
      chunks.push(current.join('\n'));
      current = [];
      currentLen = 0;
    }
    current.push(paragraph);
    currentLen += paragraph.length + 1;
  }
  if (current.length > 0) {
    chunks.push(current.join('\n'));
  }

  return chunks;
}

module.exports = { chunkText };
