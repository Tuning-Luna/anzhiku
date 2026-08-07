// @ts-nocheck
'use strict';

// 与 parsePipeline.test.js 共用同一份 mock，工厂自包含
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
      { type: 'single_choice', content: '坏题', options: [{ label: 'A', content: 'a' }, { label: 'B', content: 'b' }], answer: 'D' },
    ],
  };
  const makeResponse = () => ({
    content: JSON.stringify(mockSample),
    promptTokens: 100,
    completionTokens: 40,
    latencyMs: 200,
  });
  return {
    uploadFile: jest.fn(async () => 'file-mock-api'),
    parseDocument: jest.fn(async () => makeResponse()),
    parseTextChunk: jest.fn(async () => makeResponse()),
    assertConfigured: jest.fn(),
    request: jest.fn(),
  };
});

const http = require('http');
const request = require('supertest');
const app = require('../../src/app');
const { sequelize, models } = require('../../src/db');
const parseOrchestrator = require('../../src/services/parseOrchestrator.service');

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

/** 通过真实上传接口建一个已解析的题库 */
async function seedBank() {
  const res = await request(app)
    .post('/api/files')
    .attach('file', Buffer.from('题库内容'), {
      filename: 'api题库.txt',
      contentType: 'text/plain',
    });
  expect(res.status).toBe(201);
  const { fileId, taskId } = res.body;
  await parseOrchestrator.runTask(taskId);
  return { fileId, taskId };
}

describe('文件上传 API', () => {
  test('无文件上传返回 400', async () => {
    const res = await request(app).post('/api/files');
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('BAD_REQUEST');
  });

  test('非法类型返回 400', async () => {
    const res = await request(app)
      .post('/api/files')
      .attach('file', Buffer.from('x'), { filename: 'bad.exe' });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/不支持的文件类型/);
  });

  test('超过大小限制返回 400', async () => {
    const big = Buffer.alloc(300 * 1024); // 测试环境限制为 100KB
    const res = await request(app)
      .post('/api/files')
      .attach('file', big, { filename: 'big.txt' });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/大小限制/);
  });
});

describe('URL 导入 API', () => {
  let server;
  let port;

  beforeAll(async () => {
    server = http.createServer((req, res) => {
      res.writeHead(200, {
        'Content-Type': 'text/plain',
        'Content-Disposition': 'attachment; filename=remote.txt',
      });
      res.end('remote question content');
    });
    await new Promise((resolve) => server.listen(0, resolve));
    port = server.address().port;
  });

  afterAll(() => new Promise((resolve) => server.close(resolve)));

  test('从 URL 导入成功', async () => {
    const res = await request(app)
      .post('/api/files/from-url')
      .send({ url: `http://127.0.0.1:${port}/remote.txt` });
    expect(res.status).toBe(201);
    expect(res.body.file.sourceType).toBe('url');
    expect(res.body.file.originalName).toBe('remote.txt');
  });

  test('非 http/https 协议返回 400', async () => {
    const res = await request(app)
      .post('/api/files/from-url')
      .send({ url: 'ftp://example.com/a.txt' });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/http|https/);
  });

  test('缺少 url 返回 400', async () => {
    const res = await request(app).post('/api/files/from-url').send({});
    expect(res.status).toBe(400);
  });
});

describe('分类 API', () => {
  test('返回分类树，焊接无子级', async () => {
    const res = await request(app).get('/api/categories');
    expect(res.status).toBe(200);
    expect(res.body.categories).toHaveLength(3);
    const welding = res.body.categories.find((c) => c.name === '焊接与热切割作业');
    expect(welding.children).toHaveLength(0);
    const electric = res.body.categories.find((c) => c.name === '电工作业');
    expect(electric.children.map((c) => c.name)).toEqual(['低压电工作业', '高压电工作业']);
  });
});

describe('题目查询/管理 API', () => {
  let bankId;
  let taskId;

  beforeAll(async () => {
    const seeded = await seedBank();
    taskId = seeded.taskId;
    const bank = await models.QuestionBank.findOne({ where: { fileId: seeded.fileId } });
    bankId = bank.id;
  });

  test('按关键词检索题目', async () => {
    const res = await request(app).get('/api/questions').query({ keyword: '判断题' });
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(1);
    expect(res.body.items[0].type).toBe('true_false');
  });

  test('按题型过滤', async () => {
    const res = await request(app).get('/api/questions').query({ type: 'multi_choice' });
    expect(res.body.total).toBe(1);
    expect(res.body.items[0].answer).toEqual(['A', 'C']);
  });

  test('按题库过滤 + 分页', async () => {
    const res = await request(app)
      .get('/api/questions')
      .query({ bankId, pageSize: 3, page: 1 });
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(5); // 6 题中 1 题非法
    expect(res.body.items).toHaveLength(3);
  });

  test('题目详情包含来源文件', async () => {
    const q = await models.Question.findOne({ where: { bankId, type: 'single_choice', content: '单选题题干' } });
    const res = await request(app).get(`/api/questions/${q.id}`);
    expect(res.status).toBe(200);
    expect(res.body.question.bank.file.originalName).toBe('api题库.txt');
  });

  test('编辑题目（改答案）', async () => {
    const q = await models.Question.findOne({ where: { bankId, type: 'single_choice', content: '单选题题干' } });
    const res = await request(app)
      .patch(`/api/questions/${q.id}`)
      .send({ answer: 'A', analysis: '修改后的解析' });
    expect(res.status).toBe(200);
    expect(res.body.question.answer).toBe('A');
    expect(res.body.question.analysis).toBe('修改后的解析');
  });

  test('编辑非法字段返回 400', async () => {
    const q = await models.Question.findOne({ where: { bankId } });
    const res = await request(app)
      .patch(`/api/questions/${q.id}`)
      .send({ bankId: 999, evil: true });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/不允许修改字段/);
  });

  test('编辑导致校验失败返回 400', async () => {
    const q = await models.Question.findOne({ where: { bankId, type: 'single_choice', content: '单选题题干' } });
    const res = await request(app)
      .patch(`/api/questions/${q.id}`)
      .send({ answer: 'Z' });
    expect(res.status).toBe(400);
  });

  test('删除题目（软删）', async () => {
    const q = await models.Question.findOne({ where: { bankId, type: 'short_answer' } });
    const res = await request(app).delete(`/api/questions/${q.id}`);
    expect(res.status).toBe(200);
    const gone = await request(app).get(`/api/questions/${q.id}`);
    expect(gone.status).toBe(404);
  });

  test('查询不存在题目返回 404', async () => {
    const res = await request(app).get('/api/questions/999999');
    expect(res.status).toBe(404);
  });
});

describe('题库 API', () => {
  let bankId;

  beforeAll(async () => {
    const seeded = await seedBank();
    const bank = await models.QuestionBank.findOne({ where: { fileId: seeded.fileId } });
    bankId = bank.id;
  });

  test('列表包含分类信息', async () => {
    const res = await request(app).get('/api/banks');
    expect(res.status).toBe(200);
    const bank = res.body.items.find((b) => b.id === bankId);
    expect(bank.category.name).toBe('电工作业');
    expect(bank.subCategory.name).toBe('低压电工作业');
    expect(bank.questionCount).toBe(5);
  });

  test('删除题库级联禁用题目', async () => {
    const res = await request(app).delete(`/api/banks/${bankId}`);
    expect(res.status).toBe(200);
    const disabled = await models.Question.count({ where: { bankId, status: 'disabled' } });
    expect(disabled).toBe(5);
    const active = await models.Question.count({ where: { bankId, status: 'active' } });
    expect(active).toBe(0);
  });
});

describe('任务 API', () => {
  let taskId;
  let fileId;

  beforeAll(async () => {
    const seeded = await seedBank();
    taskId = seeded.taskId;
    fileId = seeded.fileId;
  });

  test('任务列表与详情', async () => {
    const list = await request(app).get('/api/tasks');
    expect(list.status).toBe(200);
    const detail = await request(app).get(`/api/tasks/${taskId}`);
    expect(detail.status).toBe(200);
    expect(detail.body.task.status).toBe('partial_failed');
    expect(detail.body.task.successCount).toBe(5);
    expect(detail.body.task.errors).toHaveLength(1);
    expect(detail.body.task.llmRecords).toHaveLength(1);
    expect(detail.body.task.file.bank.questionCount).toBe(5);
  });

  test('succeeded 任务不可重试', async () => {
    const task = await models.ParseTask.create({
      fileId,
      status: 'succeeded',
    });
    const res = await request(app).post(`/api/tasks/${task.id}/retry`);
    expect(res.status).toBe(409);
  });
});
