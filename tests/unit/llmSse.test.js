// @ts-nocheck
'use strict';

const { readSse } = require('../../src/services/llmClient.service');

describe('llmClient.readSse（流式响应解析）', () => {
  async function* fakeBody() {
    const enc = new TextEncoder();
    yield enc.encode('data: {"choices":[{"delta":{"content":"你"}}]}\n\n');
    yield enc.encode('data: {"choices":[{"delta":{"content":"好"}}]}\n\n');
    yield enc.encode('data: {"choices":[],"usage":{"prompt_tokens":12,"completion_tokens":7}}\n\n');
    yield enc.encode('data: [DONE]\n\n');
  }

  test('累积 content 与 usage', async () => {
    const r = await readSse(fakeBody());
    expect(r.content).toBe('你好');
    expect(r.promptTokens).toBe(12);
    expect(r.completionTokens).toBe(7);
  });

  test('跨 chunk 的多字节 UTF-8 正确拼接', async () => {
    async function* body() {
      const enc = new TextEncoder();
      const bytes = enc.encode('data: {"choices":[{"delta":{"content":"安全生产"}}]}\n\n');
      yield bytes.slice(0, 7); // 故意切断多字节字符
      yield bytes.slice(7);
    }
    const r = await readSse(body());
    expect(r.content).toBe('安全生产');
  });

  test('忽略注释行与损坏 JSON，不影响后续正常块', async () => {
    async function* body() {
      const enc = new TextEncoder();
      yield enc.encode(': keep-alive comment\n');
      yield enc.encode('data: not-json\n');
      yield enc.encode('data: {"choices":[{"delta":{"content":"x"}}]}\n\n');
      yield enc.encode('\n');
    }
    const r = await readSse(body());
    expect(r.content).toBe('x');
  });
});
