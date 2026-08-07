// @ts-nocheck
'use strict';

/** 带错误码的解析错误，供编排层判断重试与失败分类 */
function jsonParseError(message) {
  const err = new Error(message);
  err.code = 'JSON_PARSE';
  return err;
}

/**
 * 从 LLM 原始输出中提取第一个合法 JSON。
 * 兼容：markdown 围栏、前后缀说明文字。
 */
function extractJson(text) {
  if (!text || typeof text !== 'string') {
    throw jsonParseError('LLM 输出为空');
  }
  let t = text.trim();

  // 去掉 ```json ... ``` / ``` ... ``` 围栏
  const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) {
    t = fence[1].trim();
  }

  try {
    return JSON.parse(t);
  } catch {
    // 继续尝试截取
  }

  // 取第一个 { / [ 到最后一个 } / ] 之间的内容
  const start = t.search(/[[{]/);
  const end = Math.max(t.lastIndexOf(']'), t.lastIndexOf('}'));
  if (start >= 0 && end > start) {
    const candidate = t.slice(start, end + 1);
    try {
      return JSON.parse(candidate);
    } catch {
      // 继续失败
    }
  }

  throw jsonParseError(`LLM 输出不是合法 JSON，已重试仍失败`);
}

/** 轻量结构检查：必须是对象且含 questions 数组（详细校验交给 ajv） */
function assertBasicShape(parsed) {
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw jsonParseError('解析结果不是对象');
  }
  if (!Array.isArray(parsed.questions)) {
    throw jsonParseError('解析结果缺少 questions 数组');
  }
  return parsed;
}

module.exports = { extractJson, assertBasicShape, jsonParseError };
