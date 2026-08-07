// @ts-nocheck
'use strict';

const questionService = require('../services/questionService');

function serializeQuestion(q) {
  return {
    id: q.id,
    bankId: q.bankId,
    type: q.type,
    content: q.content,
    options: q.options,
    answer: q.answer,
    analysis: q.analysis,
    status: q.status,
    createdAt: q.createdAt,
    updatedAt: q.updatedAt,
    bank: q.bank
      ? {
          id: q.bank.id,
          name: q.bank.name,
          categoryId: q.bank.categoryId,
          subCategoryId: q.bank.subCategoryId,
          file: q.bank.file
            ? { id: q.bank.file.id, originalName: q.bank.file.originalName }
            : null,
        }
      : null,
  };
}

/** GET /api/questions */
async function listQuestions(req, res) {
  const page = Math.max(1, Number(req.query.page) || 1);
  const pageSize = Math.min(100, Math.max(1, Number(req.query.pageSize) || 20));
  const result = await questionService.listQuestions({
    bankId: req.query.bankId,
    type: req.query.type,
    keyword: req.query.keyword,
    categoryId: req.query.categoryId,
    subCategoryId: req.query.subCategoryId,
    page,
    pageSize,
  });
  res.json({
    total: result.total,
    page,
    pageSize,
    items: result.items.map(serializeQuestion),
  });
}

/** GET /api/questions/:id */
async function getQuestion(req, res) {
  const question = await questionService.getQuestionById(req.params.id);
  res.json({ question: serializeQuestion(question) });
}

/** PATCH /api/questions/:id */
async function updateQuestion(req, res) {
  const question = await questionService.updateQuestion(req.params.id, req.body || {});
  res.json({ question: serializeQuestion(question) });
}

/** DELETE /api/questions/:id */
async function deleteQuestion(req, res) {
  const question = await questionService.deleteQuestion(req.params.id);
  res.json({ message: '题目已删除', questionId: question.id });
}

module.exports = { listQuestions, getQuestion, updateQuestion, deleteQuestion };
