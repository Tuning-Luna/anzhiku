// @ts-nocheck
'use strict';

const bankService = require('../services/bankService');

function serializeBank(b) {
  return {
    id: b.id,
    name: b.name,
    fileId: b.fileId,
    categoryId: b.categoryId,
    subCategoryId: b.subCategoryId,
    questionCount: b.questionCount,
    status: b.status,
    createdAt: b.createdAt,
    file: b.file
      ? { id: b.file.id, originalName: b.file.originalName, extension: b.file.extension }
      : null,
    category: b.category || null,
    subCategory: b.subCategory || null,
  };
}

/** GET /api/banks */
async function listBanks(req, res) {
  const page = Math.max(1, Number(req.query.page) || 1);
  const pageSize = Math.min(100, Math.max(1, Number(req.query.pageSize) || 20));
  const result = await bankService.listBanks({
    categoryId: req.query.categoryId,
    subCategoryId: req.query.subCategoryId,
    keyword: req.query.keyword,
    page,
    pageSize,
  });
  res.json({
    total: result.total,
    page,
    pageSize,
    items: result.items.map(serializeBank),
  });
}

/** DELETE /api/banks/:id */
async function deleteBank(req, res) {
  const bank = await bankService.deleteBank(req.params.id);
  res.json({ message: '题库已删除', bankId: bank.id });
}

module.exports = { listBanks, deleteBank };
