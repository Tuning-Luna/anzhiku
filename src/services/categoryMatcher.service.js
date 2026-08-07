// @ts-nocheck
'use strict';

const { models } = require('../db');
const { CategoryMismatchError } = require('../utils/errors');

/** 常见别名（LLM 可能输出缩写/变体） */
const ALIASES = {
  电工: '电工作业',
  电气作业: '电工作业',
  焊工: '焊接与热切割作业',
  焊接: '焊接与热切割作业',
  热切割: '焊接与热切割作业',
  高处: '高处作业',
  登高: '登高架设作业',
  低压电工: '低压电工作业',
  高压电工: '高压电工作业',
  高处安装维护拆除: '高处安装、维护、拆除作业',
  高处安装维护拆除作业: '高处安装、维护、拆除作业',
  高处安装与维护拆除: '高处安装、维护、拆除作业',
};

function normalize(s) {
  return String(s || '').replace(/[\s（）()]/g, '').trim();
}

/** 精确匹配（含别名） */
function exactMatch(list, name) {
  const n = normalize(name);
  return list.find((c) => normalize(c.name) === n) || null;
}

/** 模糊匹配：包含关系（双向，防过短误匹配） */
function fuzzyMatch(list, name) {
  const n = normalize(name);
  if (!n) return null;
  for (const c of list) {
    const cn = normalize(c.name);
    if (cn.length >= 2 && (cn.includes(n) || n.includes(cn))) return c;
  }
  return null;
}

/**
 * 把 LLM 返回的 {category, subCategory} 解析为库内分类 id。
 * 规则：
 * - 一级分类必须匹配成功，否则抛 CategoryMismatchError（整文件失败，不猜）
 * - 二级分类：无 → null；有但不属于该一级 → 降级为 null 并返回 warning
 * - 一级分类本身没有子级（如焊接）→ subCategoryId 恒为 null
 */
async function resolveCategory({ category, subCategory }) {
  const all = await models.Category.findAll({ order: [['id', 'ASC']] });
  const level1 = all.filter((c) => c.level === 1);
  const level2 = all.filter((c) => c.level === 2);

  const normalizedCategory = normalize(category);
  const matched1 =
    exactMatch(level1, category) ||
    (normalizedCategory && ALIASES[normalizedCategory]
      ? exactMatch(level1, ALIASES[normalizedCategory])
      : null) ||
    fuzzyMatch(level1, category);

  if (!matched1) {
    throw new CategoryMismatchError(`一级分类无法匹配: "${category}"`);
  }

  if (!subCategory) {
    return { categoryId: matched1.id, subCategoryId: null, subCategoryWarning: null };
  }

  const children = level2.filter((c) => c.parentId === matched1.id);
  if (children.length === 0) {
    // 该一级分类无二级分类（如焊接与热切割作业），忽略传入的 subCategory
    return { categoryId: matched1.id, subCategoryId: null, subCategoryWarning: null };
  }

  const normalizedSub = normalize(subCategory);
  const matched2 =
    exactMatch(children, subCategory) ||
    (normalizedSub && ALIASES[normalizedSub]
      ? exactMatch(children, ALIASES[normalizedSub])
      : null) ||
    fuzzyMatch(children, subCategory);

  if (!matched2) {
    // 二级无法匹配：不猜，降级为 null，记录 warning
    return {
      categoryId: matched1.id,
      subCategoryId: null,
      subCategoryWarning: String(subCategory),
    };
  }

  return { categoryId: matched1.id, subCategoryId: matched2.id, subCategoryWarning: null };
}

module.exports = { resolveCategory };
