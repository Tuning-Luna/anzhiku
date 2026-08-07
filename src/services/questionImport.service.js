// @ts-nocheck
'use strict';

const { sequelize, models } = require('../db');
const { resolveCategory } = require('./categoryMatcher.service');
const { normalizeQuestion } = require('../utils/questionNormalizer');

/**
 * 把解析结果写入数据库：
 * - 分类匹配（失败抛 CategoryMismatchError，整文件失败）
 * - 文件 ↔ 题库一对一，重复解析先清旧题再导入（原子替换）
 * - 逐题校验，合法入库、非法进 parse_errors（部分导入）
 */
async function importParsedQuestions(task, file, parsed) {
  const { categoryId, subCategoryId, subCategoryWarning } = await resolveCategory(parsed);

  const validQuestions = [];
  const errors = [];

  for (let i = 0; i < parsed.questions.length; i++) {
    try {
      validQuestions.push(normalizeQuestion(parsed.questions[i], i));
    } catch (err) {
      errors.push({
        index: i,
        type: 'question_validation',
        message: err.message,
        raw: parsed.questions[i],
      });
    }
  }

  const transaction = await sequelize.transaction();
  try {
    let bank = await models.QuestionBank.findOne({
      where: { fileId: task.fileId, status: 'active' },
      transaction,
    });

    if (!bank) {
      bank = await models.QuestionBank.create(
        {
          name: file.originalName,
          fileId: task.fileId,
          categoryId,
          subCategoryId,
          questionCount: 0,
        },
        { transaction }
      );
    } else {
      // 重试/重复解析：先删旧题（原子替换）
      await models.Question.destroy({
        where: { bankId: bank.id },
        transaction,
      });
    }

    if (validQuestions.length > 0) {
      await models.Question.bulkCreate(
        validQuestions.map((q) => ({ bankId: bank.id, ...q })),
        { transaction }
      );
    }
    await bank.update(
      { categoryId, subCategoryId, questionCount: validQuestions.length },
      { transaction }
    );

    if (subCategoryWarning) {
      await models.ParseError.create(
        {
          taskId: task.id,
          questionIndex: null,
          errorType: 'category_mismatch',
          errorMessage: `二级分类 "${subCategoryWarning}" 未匹配到库内分类，已降级为空`,
          rawQuestion: null,
        },
        { transaction }
      );
    }
    if (errors.length > 0) {
      await models.ParseError.bulkCreate(
        errors.map((e) => ({
          taskId: task.id,
          questionIndex: e.index,
          errorType: e.type,
          errorMessage: e.message,
          rawQuestion: e.raw,
        })),
        { transaction }
      );
    }

    await transaction.commit();
  } catch (err) {
    await transaction.rollback();
    throw err;
  }

  return {
    total: parsed.questions.length,
    successCount: validQuestions.length,
    failedCount: errors.length,
    categoryId,
    subCategoryId,
    subCategoryWarning,
  };
}

module.exports = { importParsedQuestions };
