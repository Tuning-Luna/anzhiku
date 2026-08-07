// @ts-nocheck
'use strict';

const { models } = require('../db');

/** 分类树：返回按 sortOrder 排序的父子结构 */
async function getCategoryTree() {
  const all = await models.Category.findAll({
    order: [
      ['sortOrder', 'ASC'],
      ['id', 'ASC'],
    ],
  });

  const nodes = all.map((c) => ({
    id: c.id,
    name: c.name,
    level: c.level,
    children: [],
  }));
  const map = new Map(nodes.map((n) => [n.id, n]));
  const roots = [];

  for (const node of nodes) {
    const parent = all.find((c) => c.id === node.id);
    const parentNode = parent?.parentId ? map.get(parent.parentId) : null;
    if (parentNode) {
      parentNode.children.push(node);
    } else {
      roots.push(node);
    }
  }
  return roots;
}

module.exports = { getCategoryTree };
