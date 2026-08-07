// @ts-nocheck
'use strict';

const { Op } = require('sequelize');
const { models } = require('../db');
const { AppError } = require('../utils/errors');
const { normalizeQuestion } = require('../utils/questionNormalizer');
const { QUESTION_TYPES } = require('../validators/llmOutput.schema');

const { Question, QuestionBank, File } = models;

const EDITABLE_FIELDS = ['type', 'content', 'options', 'answer', 'analysis'];

/** 题目列表：支持 题库/题型/关键词/分类 过滤与分页 */
async function listQuestions({
  bankId,
  type,
  keyword,
  categoryId,
  subCategoryId,
  page = 1,
  pageSize = 20,
}) {
  const where = { status: 'active' };
  if (bankId) where.bankId = bankId;
  if (type && QUESTION_TYPES.includes(type)) where.type = type;
  if (keyword && keyword.trim()) {
    where.content = { [Op.like]: `%${keyword.trim()}%` };
  }

  const bankWhere = {};
  if (categoryId) bankWhere.categoryId = categoryId;
  if (subCategoryId) bankWhere.subCategoryId = subCategoryId;
  const hasBankFilter = Object.keys(bankWhere).length > 0;

  const { count, rows } = await Question.findAndCountAll({
    where,
    include: [
      {
        model: QuestionBank,
        as: 'bank',
        attributes: ['id', 'name', 'categoryId', 'subCategoryId'],
        required: hasBankFilter,
        ...(hasBankFilter ? { where: bankWhere } : {}),
      },
    ],
    order: [['id', 'DESC']],
    limit: pageSize,
    offset: (page - 1) * pageSize,
  });
  return { total: count, page, pageSize, items: rows };
}

/** 题目详情（含来源题库与文件） */
async function getQuestionById(id) {
  const question = await Question.findByPk(id, {
    include: [
      {
        model: QuestionBank,
        as: 'bank',
        attributes: ['id', 'name', 'categoryId', 'subCategoryId'],
        include: [
          {
            model: File,
            as: 'file',
            attributes: ['id', 'originalName'],
          },
        ],
      },
    ],
  });
  if (!question || question.status === 'disabled') {
    throw AppError.notFound(`题目不存在: ${id}`);
  }
  return question;
}

/** 编辑题目：只允许编辑白名单字段，且复用入库时的归一化校验 */
async function updateQuestion(id, patch) {
  const question = await getQuestionById(id);

  const unknown = Object.keys(patch).filter((k) => !EDITABLE_FIELDS.includes(k));
  if (unknown.length) {
    throw AppError.badRequest(`不允许修改字段: ${unknown.join(', ')}`);
  }

  const merged = {
    type: patch.type || question.type,
    content: patch.content !== undefined ? patch.content : question.content,
    options: patch.options !== undefined ? patch.options : question.options,
    answer: patch.answer !== undefined ? patch.answer : question.answer,
    analysis: patch.analysis !== undefined ? patch.analysis : question.analysis,
  };

  let normalized;
  try {
    normalized = normalizeQuestion(merged, 0);
  } catch (err) {
    throw AppError.badRequest(`题目校验失败: ${err.message}`);
  }
  await question.update(normalized);
  return question;
}

/** 删除题目（软删） */
async function deleteQuestion(id) {
  const question = await getQuestionById(id);
  await question.update({ status: 'disabled' });
  return question;
}

module.exports = { listQuestions, getQuestionById, updateQuestion, deleteQuestion };
