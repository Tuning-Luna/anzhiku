// @ts-nocheck
'use strict';

const fs = require('fs').promises;
const fileStorage = require('./fileStorage.service');

/**
 * 本地文档文本提取。失败返回 null（由编排层回退到 file-id 单次模式）。
 * 依赖按需 require，避免某依赖加载异常影响整个服务启动。
 */
async function extractText(file) {
  const absolutePath = fileStorage.resolveAbsolutePath(
    file.storageDir,
    file.storedName
  );
  const ext = String(file.extension || '').toLowerCase();
  try {
    switch (ext) {
      case '.txt':
        return await extractTxt(absolutePath);
      case '.docx':
        return await extractDocx(absolutePath);
      case '.xlsx':
        return await extractXlsx(absolutePath);
      case '.pdf':
        return await extractPdf(absolutePath);
      default:
        return null;
    }
  } catch (err) {
    // 提取失败不算致命，回退 file-id 模式
    return null;
  }
}

async function extractTxt(absolutePath) {
  const buf = await fs.readFile(absolutePath);
  return buf.toString('utf8');
}

async function extractDocx(absolutePath) {
  const mammoth = require('mammoth');
  const result = await mammoth.extractRawText({ path: absolutePath });
  return result.value || '';
}

async function extractXlsx(absolutePath) {
  const ExcelJS = require('exceljs');
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(absolutePath);
  const lines = [];
  workbook.eachWorksheet((ws) => {
    if (!ws || !ws.eachRow) return;
    ws.eachRow({ includeEmpty: false }, (row) => {
      const cells = row.values
        ? row.values.slice(1).map((c) => (c && typeof c === 'object' && c.text != null ? c.text : c))
        : [];
      const text = cells.filter((c) => c !== undefined && c !== null).join('\t');
      if (String(text).trim()) lines.push(String(text));
    });
  });
  return lines.join('\n');
}

async function extractPdf(absolutePath) {
  const pdfParse = require('pdf-parse');
  const buffer = await fs.readFile(absolutePath);
  const data = await pdfParse(buffer);
  return data.text || '';
}

module.exports = { extractText };
