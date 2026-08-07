// @ts-nocheck
'use strict';

const { extractJson } = require('../../src/services/jsonNormalizer.service');

describe('jsonNormalizer.extractJson', () => {
  test('解析纯 JSON', () => {
    const out = extractJson('{"category":"电工作业","questions":[{"type":"single_choice","content":"x"}]}');
    expect(out.category).toBe('电工作业');
    expect(out.questions).toHaveLength(1);
  });

  test('去除 markdown 围栏', () => {
    const text = '```json\n{"questions":[]}\n```';
    expect(extractJson(text)).toEqual({ questions: [] });
  });

  test('从前后缀文字中截取', () => {
    const text = '好的，提取结果如下：{"questions":[{"type":"true_false","content":"题"}]} 完毕';
    expect(extractJson(text).questions).toHaveLength(1);
  });

  test('垃圾输入抛出带 code=JSON_PARSE 的错误', () => {
    expect.assertions(2);
    try {
      extractJson('这不是 JSON 内容');
    } catch (err) {
      expect(err.code).toBe('JSON_PARSE');
      expect(err.message).toMatch(/JSON/);
    }
  });

  test('空输入抛出错误', () => {
    expect(() => extractJson('')).toThrow();
  });
});
