// @ts-nocheck
'use strict';

// mock 百炼客户端：工厂内自包含，禁止引用外部作用域变量
jest.mock('../../src/services/llmClient.service', () => {
  const mockSample = {
    category: '电工作业',
    subCategory: '低压电工作业',
    questions: [
      { type: 'single_choice', content: '单选题题干', options: [{ label: 'A', content: '甲' }, { label: 'B', content: '乙' }], answer: 'B', analysis: '解析' },
      { type: 'multi_choice', content: '多选题题干', options: [{ label: 'A', content: 'a' }, { label: 'B', content: 'b' }, { label: 'C', content: 'c' }], answer: ['A', 'C'], analysis: '' },
      { type: 'true_false', content: '判断题题干', answer: '√', analysis: '' },
      { type: 'fill_blank', content: '填空题题干____', answer: '标准答案', analysis: '' },
      { type: 'short_answer', content: '简答题题干', answer: '参考答案', analysis: '' },
      // 非法题目：答案不在选项中，应进入失败清单
      { type: 'single_choice', content: '坏题', options: [{ label: 'A', content: 'a' }, { label: 'B', content: 'b' }], answer: 'D' },
    ],
  };
  const makeResponse = () => ({
    content: JSON.stringify(mockSample),
    promptTokens: 200,
    completionTokens: 80,
    latencyMs: 300,
  });
  return {
    uploadFile: jest.fn(async () => 'file-mock-1'),
    parseDocument: jest.fn(async () => makeResponse()),
    parseTextChunk: jest.fn(async () => makeResponse()),
    assertConfigured: jest.fn(),
    request: jest.fn(),
  };
});

const { sequelize, models } = require('../../src/db');
const fileStorage = require('../../src/services/fileStorage.service');
const fileService = require('../../src/services/fileService');
const llmClient = require('../../src/services/llmClient.service');
const parseOrchestrator = require('../../src/services/parseOrchestrator.service');
const parseTaskService = require('../../src/services/parseTaskService');

async function createTestFile() {
  const buffer = Buffer.from('测试题库内容');
  const saved = await fileStorage.save(buffer, {
    originalName: '测试题库.txt',
    mimeType: 'text/plain',
  });
  return fileService.createFileRecord({
    originalName: '测试题库.txt',
    storedName: saved.storedName,
    storageDir: saved.storageDir,
    extension: saved.extension,
    mimeType: 'text/plain',
    sizeBytes: buffer.length,
    sha256: 'test-hash',
    sourceType: 'upload',
    sourceUrl: null,
  });
}

beforeAll(async () => {
  await sequelize.authenticate();
  await models.Question.destroy({ where: {} });
  await models.ParseError.destroy({ where: {} });
  await models.LlmParseRecord.destroy({ where: {} });
  await models.ParseTask.destroy({ where: {} });
  await models.QuestionBank.destroy({ where: {} });
  await models.File.destroy({ where: {} });
});

afterAll(async () => {
  await sequelize.close();
});

describe('解析管线集成测试', () => {
  test('成功解析 + 部分失败清单入库', async () => {
    const file = await createTestFile();
    const task = await models.ParseTask.create({ fileId: file.id, status: 'pending' });

    await parseOrchestrator.runTask(task.id);

    const updated = await models.ParseTask.findByPk(task.id);
    expect(updated.status).toBe('partial_failed');
    expect(updated.successCount).toBe(5);
    expect(updated.failedCount).toBe(1);

    const bank = await models.QuestionBank.findOne({ where: { fileId: file.id } });
    expect(bank).not.toBeNull();
    expect(bank.categoryId).toBe(1); // 电工作业
    expect(bank.subCategoryId).toBe(4); // 低压电工作业
    expect(bank.questionCount).toBe(5);

    const questions = await models.Question.findAll({ where: { bankId: bank.id } });
    expect(questions).toHaveLength(5);

    const tf = questions.find((q) => q.type === 'true_false');
    expect(tf.answer).toBe(true); // '√' → true

    const mc = questions.find((q) => q.type === 'multi_choice');
    expect(mc.answer).toEqual(['A', 'C']);

    const sc = questions.find((q) => q.type === 'single_choice' && q.content === '单选题题干');
    expect(sc.answer).toBe('B');

    // LLM 调用审计记录
    const recs = await models.LlmParseRecord.findAll({ where: { taskId: task.id } });
    expect(recs).toHaveLength(1);
    expect(recs[0].promptTokens).toBe(200);

    // 失败清单
    const errs = await models.ParseError.findAll({ where: { taskId: task.id } });
    expect(errs).toHaveLength(1);
    expect(errs[0].errorType).toBe('question_validation');
    expect(errs[0].rawQuestion).not.toBeNull();
  });

  test('长文本走 text_chunk 分块策略', async () => {
    // 文件内容大于 MIN_EXTRACT_CHARS(10)，应走分块提取路径
    const buffer = Buffer.from(
      '这是一份较长的测试题库内容，包含多道题目，用于分块提取策略的集成测试。'
    );
    const saved = await fileStorage.save(buffer, {
      originalName: '长题库.txt',
      mimeType: 'text/plain',
    });
    const file = await fileService.createFileRecord({
      originalName: '长题库.txt',
      storedName: saved.storedName,
      storageDir: saved.storageDir,
      extension: saved.extension,
      mimeType: 'text/plain',
      sizeBytes: buffer.length,
      sha256: 'chunk-test',
      sourceType: 'upload',
      sourceUrl: null,
    });
    const task = await models.ParseTask.create({ fileId: file.id, status: 'pending' });

    await parseOrchestrator.runTask(task.id);

    const updated = await models.ParseTask.findByPk(task.id);
    expect(updated.strategy).toBe('text_chunk');
    expect(updated.status).toBe('partial_failed');
    expect(updated.successCount).toBe(5);
    expect(updated.failedCount).toBe(1);
  });

  test('重复解析同一文件：原子替换，不产生重复题目', async () => {
    const file = await createTestFile();
    const t1 = await models.ParseTask.create({ fileId: file.id, status: 'pending' });
    await parseOrchestrator.runTask(t1.id);

    const bank = await models.QuestionBank.findOne({ where: { fileId: file.id } });
    expect(bank).not.toBeNull();

    const t2 = await models.ParseTask.create({ fileId: file.id, status: 'pending' });
    await parseOrchestrator.runTask(t2.id);

    const bankAfter = await models.QuestionBank.findOne({ where: { fileId: file.id } });
    expect(bankAfter.id).toBe(bank.id); // 同一题库
    const count = await models.Question.count({ where: { bankId: bankAfter.id } });
    expect(count).toBe(5); // 不叠加
  });

  test('一级分类无法匹配 → 任务失败(category_mismatch)', async () => {
    const file = await createTestFile();
    const task = await models.ParseTask.create({ fileId: file.id, status: 'pending' });

    llmClient.parseDocument.mockResolvedValueOnce({
      content: JSON.stringify({
        category: '完全不存在的分类',
        questions: [
          { type: 'single_choice', content: '题', options: [{ label: 'A', content: 'a' }, { label: 'B', content: 'b' }], answer: 'A' },
        ],
      }),
    });

    await parseOrchestrator.runTask(task.id);
    const updated = await models.ParseTask.findByPk(task.id);
    expect(updated.status).toBe('failed');
    expect(updated.errorCode).toBe('category_mismatch');
  });

  test('LLM 持续输出非 JSON → 重试耗尽后任务失败(json_parse)', async () => {
    const file = await createTestFile();
    const task = await models.ParseTask.create({ fileId: file.id, status: 'pending' });

    // 持久覆盖：3 次尝试全部返回非 JSON，触发重试直至耗尽
    llmClient.parseDocument.mockImplementation(async () => ({
      content: '很抱歉，我无法解析这个文档。',
      promptTokens: 10,
      completionTokens: 5,
      latencyMs: 100,
    }));

    await parseOrchestrator.runTask(task.id);
    const updated = await models.ParseTask.findByPk(task.id);
    expect(updated.status).toBe('failed');
    expect(updated.errorCode).toBe('json_parse');
    expect(updated.retryCount).toBe(0);

    // 3 次尝试都留痕
    const recs = await models.LlmParseRecord.findAll({ where: { taskId: task.id } });
    expect(recs).toHaveLength(3);
  });

  test('failed 任务可重试', async () => {
    const file = await createTestFile();
    const task = await models.ParseTask.create({ fileId: file.id, status: 'failed' });

    const requeued = await parseTaskService.requeue(task.id);
    expect(requeued.status).toBe('pending');
    expect(requeued.retryCount).toBe(1);
  });

  test('succeeded 任务不可重试', async () => {
    const file = await createTestFile();
    const task = await models.ParseTask.create({ fileId: file.id, status: 'succeeded' });
    await expect(parseTaskService.requeue(task.id)).rejects.toThrow(/不可重试/);
  });
});
