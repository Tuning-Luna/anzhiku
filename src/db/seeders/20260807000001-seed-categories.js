// @ts-nocheck
'use strict';

/**
 * 安全生产考试题库分类种子数据（固定，但表结构支持未来扩展）。
 * 一级分类：电工作业 / 焊接与热切割作业 / 高处作业
 * 二级分类：低压电工作业、高压电工作业、登高架设作业、高处安装维护拆除作业
 */
module.exports = {
  async up(queryInterface) {
    const now = new Date();
    await queryInterface.bulkInsert('categories', [
      { id: 1, name: '电工作业', parent_id: null, level: 1, sort_order: 1, created_at: now, updated_at: now },
      { id: 2, name: '焊接与热切割作业', parent_id: null, level: 1, sort_order: 2, created_at: now, updated_at: now },
      { id: 3, name: '高处作业', parent_id: null, level: 1, sort_order: 3, created_at: now, updated_at: now },
      { id: 4, name: '低压电工作业', parent_id: 1, level: 2, sort_order: 1, created_at: now, updated_at: now },
      { id: 5, name: '高压电工作业', parent_id: 1, level: 2, sort_order: 2, created_at: now, updated_at: now },
      { id: 6, name: '登高架设作业', parent_id: 3, level: 2, sort_order: 1, created_at: now, updated_at: now },
      { id: 7, name: '高处安装、维护、拆除作业', parent_id: 3, level: 2, sort_order: 2, created_at: now, updated_at: now },
    ]);
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete('categories', null, {});
  },
};
