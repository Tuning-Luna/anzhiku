// @ts-nocheck
'use strict';

const categoryService = require('../services/categoryService');

/** GET /api/categories —— 分类树 */
async function getCategoryTree(req, res) {
  const categories = await categoryService.getCategoryTree();
  res.json({ categories });
}

module.exports = { getCategoryTree };
