// @ts-nocheck
'use strict';

const { normalizeQuestion } = require('../../src/utils/questionNormalizer');

describe('questionNormalizer', () => {
  test('判断题 √ → true', () => {
    const r = normalizeQuestion({ type: 'true_false', content: '题', answer: '√' }, 0);
    expect(r.answer).toBe(true);
  });

  test('判断题 错 → false', () => {
    const r = normalizeQuestion({ type: 'true_false', content: '题', answer: '错' }, 0);
    expect(r.answer).toBe(false);
  });

  test('判断题不应含选项', () => {
    expect(() =>
      normalizeQuestion({ type: 'true_false', content: '题', answer: '对', options: [{ label: 'A', content: 'x' }] }, 0)
    ).toThrow(/不应包含选项/);
  });

  test('多选题答案排序并去重', () => {
    const r = normalizeQuestion(
      {
        type: 'multi_choice',
        content: '题',
        options: [
          { label: 'A', content: 'a' },
          { label: 'B', content: 'b' },
          { label: 'C', content: 'c' },
        ],
        answer: ['C', 'A', 'A'],
      },
      0
    );
    expect(r.answer).toEqual(['A', 'C']);
  });

  test('选项对象形式 {A:"..",B:".."} 转换', () => {
    const r = normalizeQuestion(
      { type: 'single_choice', content: '题', options: { A: 'a', B: 'b' }, answer: 'B' },
      0
    );
    expect(r.options).toEqual([
      { label: 'A', content: 'a' },
      { label: 'B', content: 'b' },
    ]);
  });

  test('答案精简版：单选题只有 1 个正确选项也能入库', () => {
    const r = normalizeQuestion(
      {
        type: 'single_choice',
        content: '下列有关使触电者脱离电源时的注意事项，说法错误的是（）。',
        options: [{ label: 'A', content: '高压触电时，用干燥木棍、竹竿去拨开高压线' }],
        answer: 'A',
      },
      0
    );
    expect(r.answer).toBe('A');
    expect(r.options).toHaveLength(1);
  });

  test('答案精简版：多选题只有 1 个选项也能入库', () => {
    const r = normalizeQuestion(
      { type: 'multi_choice', content: '题', options: [{ label: 'A', content: 'a' }], answer: ['A'] },
      0
    );
    expect(r.answer).toEqual(['A']);
  });

  test('单选题完全没有选项 → 抛错', () => {
    expect(() =>
      normalizeQuestion({ type: 'single_choice', content: '题', options: [], answer: 'A' }, 0)
    ).toThrow(/没有可用选项/);
  });

  test('单选答案不在选项 → 抛错', () => {
    expect(() =>
      normalizeQuestion(
        {
          type: 'single_choice',
          content: '题',
          options: [
            { label: 'A', content: 'a' },
            { label: 'B', content: 'b' },
          ],
          answer: 'D',
        },
        0
      )
    ).toThrow(/不在选项/);
  });

  test('填空题一题一空，答案字符串', () => {
    const r = normalizeQuestion({ type: 'fill_blank', content: '空____', answer: '答案' }, 0);
    expect(r.answer).toBe('答案');
    expect(r.options).toBeNull();
  });

  test('简答题仅参考答案', () => {
    const r = normalizeQuestion({ type: 'short_answer', content: '题', answer: '参考答案' }, 0);
    expect(r.answer).toBe('参考答案');
  });

  test('题干为空 → 抛错', () => {
    expect(() => normalizeQuestion({ type: 'single_choice', content: '  ', options: [{ label: 'A', content: 'a' }, { label: 'B', content: 'b' }], answer: 'A' }, 0)).toThrow(/题干为空/);
  });
});
