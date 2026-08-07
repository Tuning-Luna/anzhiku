// @ts-nocheck
'use strict';

/**
 * 单题清洗与校验。返回可直接入库的 {type, content, options, answer, analysis}。
 * 校验失败抛出 Error（message 供失败清单展示）。
 */

const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const TRUE_WORDS = new Set(['true', '1', '对', '正确', '√', '✓', '是', 't', 'yes']);
const FALSE_WORDS = new Set(['false', '0', '错', '错误', '×', '✗', '否', 'f', 'no']);

function labelOf(i) {
  return LETTERS[i] || `O${i + 1}`;
}

/** 选项归一化：兼容数组、对象、字符串元素，统一为 [{label, content}] */
function normalizeOptions(raw) {
  let arr;
  if (Array.isArray(raw)) {
    arr = raw.map((it, i) => {
      if (typeof it === 'string') return { label: labelOf(i), content: it.trim() };
      if (it && typeof it === 'object') {
        const content = String(it.content ?? '').trim();
        if (it.label) return { label: String(it.label).toUpperCase().replace(/[^A-Z]+/g, ''), content };
        return { label: labelOf(i), content };
      }
      return null;
    });
  } else if (raw && typeof raw === 'object') {
    arr = Object.entries(raw).map(([k, v]) => ({
      label: String(k).toUpperCase(),
      content: String(v ?? '').trim(),
    }));
  } else {
    arr = [];
  }
  return (arr || []).filter((o) => o && (o.label || o.content)).filter((o, i, self) => self.findIndex((x) => x.label === o.label) === i);
}

function extractLetters(s) {
  return String(s ?? '').toUpperCase().match(/[A-Z]/g) || [];
}

function normalizeSingleAnswer(raw, options) {
  const labels = new Set(options.map((o) => o.label));
  let letters;
  if (Array.isArray(raw)) {
    letters = raw.flatMap((r) => extractLetters(r));
  } else {
    letters = extractLetters(raw);
  }
  const cand = letters.find((l) => labels.has(l));
  if (!cand) {
    throw new Error(`单选题答案 "${JSON.stringify(raw)}" 不在选项 ${[...labels].join('/')} 中`);
  }
  return cand;
}

function normalizeMultiAnswer(raw, options) {
  const labels = new Set(options.map((o) => o.label));
  let letters = [];
  if (Array.isArray(raw)) letters = raw.flatMap((r) => extractLetters(r));
  else letters = extractLetters(raw);
  const valid = [...new Set(letters.filter((l) => labels.has(l)))];
  if (valid.length === 0) {
    throw new Error(`多选题答案 "${JSON.stringify(raw)}" 不在选项 ${[...labels].join('/')} 中`);
  }
  return valid.sort();
}

function normalizeBoolean(raw) {
  if (typeof raw === 'boolean') return raw;
  const s = String(raw ?? '').trim().toLowerCase();
  if (TRUE_WORDS.has(s)) return true;
  if (FALSE_WORDS.has(s)) return false;
  throw new Error(`判断题答案无法识别: ${JSON.stringify(raw)}`);
}

function normalizeStringAnswer(raw, typeName) {
  if (Array.isArray(raw)) {
    // 兼容 LLM 返回数组（取第一个非空元素）
    for (const item of raw) {
      const s = String(item ?? '').trim();
      if (s) return s;
    }
    throw new Error(`${typeName}答案为空`);
  }
  const s = String(raw ?? '').trim();
  if (!s) throw new Error(`${typeName}答案为空`);
  return s;
}

function hasOptions(q) {
  return Array.isArray(q.options) && q.options.length > 0;
}

function normalizeQuestion(q, index) {
  const type = q.type;
  const content = String(q.content ?? '').trim();
  if (!content) {
    throw new Error(`第 ${index + 1} 题题干为空`);
  }
  const analysis = q.analysis && String(q.analysis).trim() ? String(q.analysis).trim() : null;

  switch (type) {
    case 'single_choice': {
      const options = normalizeOptions(q.options);
      if (options.length < 2) throw new Error(`第 ${index + 1} 题单选题选项不足 2 个`);
      return { type, content, options, answer: normalizeSingleAnswer(q.answer, options), analysis };
    }
    case 'multi_choice': {
      const options = normalizeOptions(q.options);
      if (options.length < 2) throw new Error(`第 ${index + 1} 题多选题选项不足 2 个`);
      return { type, content, options, answer: normalizeMultiAnswer(q.answer, options), analysis };
    }
    case 'true_false': {
      if (hasOptions(q)) throw new Error(`第 ${index + 1} 题判断题不应包含选项`);
      return { type, content, options: null, answer: normalizeBoolean(q.answer), analysis };
    }
    case 'fill_blank': {
      if (hasOptions(q)) throw new Error(`第 ${index + 1} 题填空题不应包含选项`);
      return { type, content, options: null, answer: normalizeStringAnswer(q.answer, '填空题'), analysis };
    }
    case 'short_answer': {
      if (hasOptions(q)) throw new Error(`第 ${index + 1} 题简答题不应包含选项`);
      return { type, content, options: null, answer: normalizeStringAnswer(q.answer, '简答题'), analysis };
    }
    default:
      throw new Error(`第 ${index + 1} 题未知题型: ${type}`);
  }
}

module.exports = { normalizeQuestion, normalizeOptions };
