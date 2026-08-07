// @ts-nocheck
'use strict';

const config = require('../config');
const { AppError } = require('../utils/errors');

/**
 * 阿里云百炼（DashScope OpenAI 兼容端点）客户端。
 * 仅依赖 Node 原生 fetch/FormData/Blob，无第三方 SDK 版本风险。
 * 全部方法都可在测试中用 jest.mock 替换。
 */

/** LLM 相关错误：带 code='llm_error' 供编排层分类 */
function llmError(message, cause) {
  const err = new Error(message);
  err.code = 'llm_error';
  if (cause) err.cause = cause;
  return err;
}

function assertConfigured() {
  if (!config.llm.apiKey) {
    throw llmError('未配置 DASHSCOPE_API_KEY，请在 .env 中填写');
  }
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * 通用请求。HTTP 4xx 视为不可重试，429/5xx 与网络错误视为可重试。
 * 返回解析后的 JSON；失败抛出带 .status / .retryable 的 Error。
 */
async function request(path, { method = 'GET', headers = {}, body } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), config.llm.timeoutMs);
  try {
    const resp = await fetch(`${config.llm.baseUrl}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${config.llm.apiKey}`,
        ...headers,
      },
      body,
      signal: controller.signal,
    });
    const text = await resp.text();
    let json = null;
    try {
      json = JSON.parse(text);
    } catch {
      // 非 JSON 响应（如 502 HTML 页）
    }
    if (!resp.ok) {
      const msg =
        json?.error?.message || json?.message || `HTTP ${resp.status}`;
      const err = new Error(msg);
      err.status = resp.status;
      err.retryable = resp.status === 429 || resp.status >= 500;
      throw err;
    }
    return json;
  } catch (err) {
    if (err.status) throw err; // 已标记的 HTTP 错误
    const wrapped = new Error(
      controller.signal.aborted ? 'LLM 请求超时' : `LLM 网络错误: ${err.message}`
    );
    wrapped.retryable = true;
    throw wrapped;
  } finally {
    clearTimeout(timer);
  }
}

/** 上传文件到百炼（purpose=file-extract），轮询至解析完成，返回 file_id */
async function uploadFile(buffer, { originalName, mimeType }) {
  assertConfigured();
  const form = new FormData();
  form.append(
    'file',
    new Blob([buffer], { type: mimeType || 'application/octet-stream' }),
    originalName || 'document'
  );
  form.append('purpose', 'file-extract');

  const json = await request('/files', { method: 'POST', body: form });
  const fileId = json?.id;
  if (!fileId) {
    throw llmError('百炼上传文件响应缺少 id', json);
  }

  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    const info = await request(`/files/${fileId}`);
    if (info?.status === 'processed') return fileId;
    if (info?.status === 'error') {
      throw llmError(`百炼文件解析失败: ${info?.status_details || '未知原因'}`);
    }
    await sleep(2000);
  }
  throw llmError('等待百炼文件解析超时');
}

/**
 * 解析 SSE 流，累积 content 与 usage。
 * 超时采用「空闲超时」：每收到一块数据就重置计时，长时间无数据才中断——
 * 这样长文档持续生成时不会被硬性总时长掐断。
 */
async function readSse(body, onData) {
  const decoder = new TextDecoder();
  let buffer = '';
  let content = '';
  let promptTokens = 0;
  let completionTokens = 0;

  const handleLine = (line) => {
    const trimmed = line.trim();
    if (!trimmed.startsWith('data:')) return;
    const data = trimmed.slice(5).trim();
    if (!data || data === '[DONE]') return;
    let json;
    try {
      json = JSON.parse(data);
    } catch {
      return;
    }
    const delta = json.choices?.[0]?.delta?.content;
    if (typeof delta === 'string') content += delta;
    if (json.usage) {
      promptTokens = json.usage.prompt_tokens || 0;
      completionTokens = json.usage.completion_tokens || 0;
    }
  };

  for await (const chunk of body) {
    if (onData) onData(); // 收到数据，重置空闲计时
    buffer += decoder.decode(chunk, { stream: true });
    let idx;
    while ((idx = buffer.indexOf('\n')) >= 0) {
      handleLine(buffer.slice(0, idx));
      buffer = buffer.slice(idx + 1);
    }
  }
  buffer += decoder.decode();
  if (buffer.trim()) handleLine(buffer);

  return { content, promptTokens, completionTokens };
}

/**
 * 流式 Chat Completions 通用调用。
 * 依据官方文档，qwen-doc-turbo 正确调用方式为流式（stream:true + stream_options）；
 * 非流式调用可能服务端挂起约 300s 后才返回（第三方实测记录），因此这里强制流式。
 * 超时采用「空闲超时」：每收到一块数据就重置计时，长文档持续生成不会被掐断。
 * @returns {{content:string, promptTokens:number, completionTokens:number, latencyMs:number}}
 */
async function streamChat(messages) {
  assertConfigured();
  const started = Date.now();
  const controller = new AbortController();
  let idleTimer;

  const resetIdle = () => {
    clearTimeout(idleTimer);
    idleTimer = setTimeout(() => controller.abort(), config.llm.timeoutMs);
  };
  resetIdle();

  try {
    const resp = await fetch(`${config.llm.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.llm.apiKey}`,
      },
      body: JSON.stringify({
        model: config.llm.model,
        messages,
        stream: true,
        stream_options: { include_usage: true },
      }),
      signal: controller.signal,
    });

    if (!resp.ok) {
      const text = await resp.text();
      let json = null;
      try {
        json = JSON.parse(text);
      } catch {
        // 非 JSON 错误体
      }
      const msg = json?.error?.message || json?.message || `HTTP ${resp.status}`;
      const err = new Error(msg);
      err.status = resp.status;
      err.retryable = resp.status === 429 || resp.status >= 500;
      throw err;
    }
    if (!resp.body) {
      const err = new Error('LLM 响应为空');
      err.retryable = true;
      throw err;
    }

    const result = await readSse(resp.body, resetIdle);
    return { ...result, latencyMs: Date.now() - started };
  } catch (err) {
    if (controller.signal.aborted) {
      const e = new Error('LLM 请求超时（长时间无响应数据）');
      e.retryable = true;
      throw e;
    }
    if (err.status) throw err; // 已标记的 HTTP 错误
    const wrapped = new Error(`LLM 网络错误: ${err.message}`);
    wrapped.retryable = true;
    throw wrapped;
  } finally {
    clearTimeout(idleTimer);
  }
}

/** 文件ID方式：system 消息携带 fileid:// 引用上传的文档 */
async function parseDocument({ fileId, prompt }) {
  return streamChat([
    { role: 'system', content: '你是专业的题库结构化解析助手，只输出 JSON，不要输出任何其他内容。' },
    { role: 'system', content: `fileid://${fileId}` },
    { role: 'user', content: prompt },
  ]);
}

/** 纯文本方式：system 消息直接携带文本块（分块提取用） */
async function parseTextChunk({ text, prompt }) {
  return streamChat([
    { role: 'system', content: '你是专业的题库结构化解析助手，只输出 JSON，不要输出任何其他内容。' },
    { role: 'system', content: text },
    { role: 'user', content: prompt },
  ]);
}

module.exports = { uploadFile, parseDocument, parseTextChunk, readSse, assertConfigured, request };
