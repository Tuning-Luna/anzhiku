// @ts-nocheck
'use strict';

const { Op } = require('sequelize');
const { sequelize, models } = require('../db');
const { AppError } = require('../utils/errors');

const { QuestionBank, Question, File, Category } = models;

/** 题库列表：支持分类/名称关键词过滤与分页 */
async function listBanks({ categoryId, subCategoryId, keyword, page = 1, pageSize = 20 }) {
  const where = { status: 'active' };
  if (categoryId) where.categoryId = categoryId;
  if (subCategoryId) where.subCategoryId = subCategoryId;
  if (keyword && keyword.trim()) {
    where.name = { [Op.like]: `%${keyword.trim()}%` };
  }

  const { count, rows } = await QuestionBank.findAndCountAll({
    where,
    include: [
      { model: File, as: 'file', attributes: ['id', 'originalName', 'extension'] },
      { model: Category, as: 'category', attributes: ['id', 'name'] },
      { model: Category, as: 'subCategory', attributes: ['id', 'name'] },
    ],
    order: [['id', 'DESC']],
    limit: pageSize,
    offset: (page - 1) * pageSize,
  });
  return { total: count, page, pageSize, items: rows };
}

/** 删除题库：软删题库并禁用其题目（原子） */
async function deleteBank(id) {
  const bank = await QuestionBank.findOne({ where: { id, status: 'active' } });
  if (!bank) {
    throw AppError.notFound(`题库不存在: ${id}`);
  }
  const transaction = await sequelize.transaction();
  try {
    await Question.update(
      { status: 'disabled' },
      { where: { bankId: bank.id, status: 'active' }, transaction }
    );
    await bank.update({ status: 'deleted' }, { transaction });
    await transaction.commit();
  } catch (err) {
    await transaction.rollback();
    throw err;
  }
  return bank;
}

module.exports = { listBanks, deleteBank };
