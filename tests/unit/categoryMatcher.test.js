// @ts-nocheck
'use strict';

const { sequelize } = require('../../src/db');
const { resolveCategory } = require('../../src/services/categoryMatcher.service');
const { CategoryMismatchError } = require('../../src/utils/errors');

afterAll(async () => {
  await sequelize.close();
});

describe('categoryMatcher', () => {
  test('精确匹配一级 + 二级', async () => {
    const r = await resolveCategory({ category: '电工作业', subCategory: '低压电工作业' });
    expect(r.categoryId).toBe(1);
    expect(r.subCategoryId).toBe(4);
    expect(r.subCategoryWarning).toBeNull();
  });

  test('别名匹配：电工 → 电工作业', async () => {
    const r = await resolveCategory({ category: '电工', subCategory: '低压电工' });
    expect(r.categoryId).toBe(1);
    expect(r.subCategoryId).toBe(4);
  });

  test('无二级分类 → null', async () => {
    const r = await resolveCategory({ category: '高处作业' });
    expect(r.categoryId).toBe(3);
    expect(r.subCategoryId).toBeNull();
  });

  test('焊接类无二级分类：忽略传入的 subCategory', async () => {
    const r = await resolveCategory({ category: '焊接与热切割作业', subCategory: '随便写' });
    expect(r.categoryId).toBe(2);
    expect(r.subCategoryId).toBeNull();
    expect(r.subCategoryWarning).toBeNull();
  });

  test('二级不属于该一级 → 降级 null 并返回 warning', async () => {
    const r = await resolveCategory({ category: '高处作业', subCategory: '低压电工作业' });
    expect(r.subCategoryId).toBeNull();
    expect(r.subCategoryWarning).toBe('低压电工作业');
  });

  test('一级分类无法匹配 → 抛 CategoryMismatchError', async () => {
    await expect(resolveCategory({ category: '不存在的分类' })).rejects.toBeInstanceOf(
      CategoryMismatchError
    );
  });
});
