# 智能题库解析平台 · 接口文档

后端：Node.js + Express，默认地址 `http://localhost:3000`。

## 1. 基础约定

| 项 | 说明 |
|---|---|
| 认证 | 无（单机工具） |
| 请求/响应编码 | JSON，UTF-8 |
| 分页参数 | `page`（默认 1）、`pageSize`（默认 20，最大 100） |
| 错误响应 | `{ "code": "BAD_REQUEST", "message": "...", "details": ... }` |

**解析是异步的**：上传接口立刻返回 `fileId` 和 `taskId`，真正的解析在后台执行。你需要轮询 `GET /api/tasks/:id` 直到任务结束。

---

## 2. 核心流程（三步）

```bash
# ① 上传文件 → 得到 taskId
curl -F "file=@低压电工题库.pdf" http://localhost:3000/api/files
# → { "fileId": 1, "taskId": 1, "file": { ... } }

# ② 轮询任务直到 status ∈ {succeeded, partial_failed, failed}
curl http://localhost:3000/api/tasks/1
# → { "task": { "status": "succeeded", "successCount": 300, "failedCount": 0, ... } }

# ③ 查看解析出的题库与题目
curl http://localhost:3000/api/banks
curl "http://localhost:3000/api/questions?bankId=1&pageSize=10"
```

---

## 3. 上传文件

### 3.1 本地上传（multipart）

`POST /api/files`，表单字段名必须是 `file`。

```bash
curl -F "file=@低压电工题库.pdf" http://localhost:3000/api/files
```

支持格式：`.pdf` `.docx` `.xlsx` `.txt`，默认大小上限 50MB。

响应 `201`：

```json
{
  "fileId": 3,
  "taskId": 3,
  "file": {
    "id": 3,
    "originalName": "低压电工题库.pdf",
    "sizeBytes": 245760,
    "mimeType": "application/pdf",
    "extension": ".pdf",
    "sha256": "9c0...",
    "sourceType": "upload",
    "sourceUrl": null,
    "status": "active",
    "createdAt": "2026-08-07T03:34:54.000Z"
  }
}
```

### 3.2 从 URL 导入

`POST /api/files/from-url`

```bash
curl -X POST http://localhost:3000/api/files/from-url \
  -H "Content-Type: application/json" \
  -d '{"url": "https://example.com/question-bank.pdf"}'
```

服务端会下载文件（带超时与大小限制）后按同一流程解析。响应同上，`sourceType` 为 `url`，`sourceUrl` 为原地址。

---

## 4. 任务查询与重试

### 4.1 任务列表

`GET /api/tasks?status=failed&page=1&pageSize=20`

| 参数 | 说明 |
|---|---|
| `status` | 可选：`pending` / `processing` / `succeeded` / `partial_failed` / `failed` |

### 4.2 任务详情（含失败清单）

`GET /api/tasks/:id`

```json
{
  "task": {
    "id": 3,
    "fileId": 3,
    "status": "partial_failed",
    "strategy": "doc_turbo_single",
    "model": "qwen-doc-turbo",
    "totalQuestions": 310,
    "successCount": 308,
    "failedCount": 2,
    "errorCode": null,
    "errorMessage": null,
    "retryCount": 0,
    "startedAt": "2026-08-07T03:35:00.000Z",
    "finishedAt": "2026-08-07T03:35:41.000Z",
    "createdAt": "2026-08-07T03:34:54.000Z",
    "file": {
      "id": 3,
      "originalName": "低压电工题库.pdf",
      "mimeType": "application/pdf",
      "sizeBytes": 245760,
      "sourceType": "upload",
      "sourceUrl": null,
      "bank": {
        "id": 2, "name": "低压电工题库.pdf", "categoryId": 1, "subCategoryId": 4,
        "questionCount": 308,
        "category": { "id": 1, "name": "电工作业" },
        "subCategory": { "id": 4, "name": "低压电工作业" }
      }
    },
    "errors": [
      {
        "id": 7, "questionIndex": 209,
        "errorType": "question_validation",
        "errorMessage": "第 210 题单选题答案 \"D\" 不在选项 A/B 中",
        "rawQuestion": { "type": "single_choice", "content": "...", "answer": "D" }
      }
    ],
    "llmRecords": [
      { "id": 3, "model": "qwen-doc-turbo", "promptTokens": 18240, "completionTokens": 3021, "success": true, "latencyMs": 41023, "createdAt": "..." }
    ]
  }
}
```

**任务状态说明**

| status | 含义 |
|---|---|
| `pending` | 排队中 |
| `processing` | 解析中 |
| `succeeded` | 全部题目入库成功 |
| `partial_failed` | 部分题目校验失败，已入库成功部分（见 `errors`） |
| `failed` | 整体失败（LLM 调用失败 / 输出非法 / 分类无法匹配等，见 `errorCode`） |

**`errorCode` 说明**：`llm_error`（LLM 调用失败）/ `json_parse`（输出非 JSON）/ `schema_validation`（结构校验失败）/ `category_mismatch`（一级分类无法匹配）/ `INTERRUPTED`（服务重启中断）。

### 4.3 重试任务

`POST /api/tasks/:id/retry`

仅 `failed` / `partial_failed` 可重试；重试会清空旧失败清单，并**替换**该文件对应的题库（先删旧题再导入，不会重复）。其他状态返回 `409 CONFLICT`。

---

## 5. 题库（题库批次 = 一份文件解析出的题目集合）

`GET /api/banks?categoryId=1&subCategoryId=4&keyword=低压&page=1&pageSize=20`

| 参数 | 说明 |
|---|---|
| `categoryId` / `subCategoryId` | 按分类过滤 |
| `keyword` | 按题库名称模糊匹配 |

```json
{
  "total": 1, "page": 1, "pageSize": 20,
  "items": [
    {
      "id": 2, "name": "低压电工题库.pdf",
      "fileId": 3, "categoryId": 1, "subCategoryId": 4,
      "questionCount": 308, "status": "active", "createdAt": "...",
      "file": { "id": 3, "originalName": "低压电工题库.pdf", "extension": ".pdf" },
      "category": { "id": 1, "name": "电工作业" },
      "subCategory": { "id": 4, "name": "低压电工作业" }
    }
  ]
}
```

`DELETE /api/banks/:id`：删除题库（软删，同时禁用其下全部题目）。

---

## 6. 题目查询 / 检索

`GET /api/questions?bankId=&type=&keyword=&categoryId=&subCategoryId=&page=&pageSize=`

| 参数 | 说明 |
|---|---|
| `bankId` | 按题库过滤 |
| `type` | 题型：`single_choice` / `multi_choice` / `true_false` / `fill_blank` / `short_answer` |
| `keyword` | 题干关键词检索 |
| `categoryId` / `subCategoryId` | 按分类过滤（经题库关联） |

```json
{
  "total": 308, "page": 1, "pageSize": 10,
  "items": [
    {
      "id": 101, "bankId": 2, "type": "single_choice",
      "content": "我国安全生产方针是（ ）。",
      "options": [ { "label": "A", "content": "安全第一、预防为主" }, { "label": "B", "content": "生产第一" }, { "label": "C", "content": "效益第一" } ],
      "answer": "A",
      "analysis": "《安全生产法》第三条规定……",
      "status": "active",
      "createdAt": "...", "updatedAt": "...",
      "bank": { "id": 2, "name": "低压电工题库.pdf", "categoryId": 1, "subCategoryId": 4, "file": { "id": 3, "originalName": "低压电工题库.pdf" } }
    }
  ]
}
```

**题型与 `answer` 字段结构**（展示/入库时以此为准）：

| type | options | answer |
|---|---|---|
| `single_choice` 单选 | 数组 `[{label, content}]` | 字符串 `"A"` |
| `multi_choice` 多选 | 数组 `[{label, content}]` | 数组 `["A","C"]` |
| `true_false` 判断 | `null` | 布尔 `true` / `false` |
| `fill_blank` 填空 | `null` | 字符串 `"标准答案"`（一题一空） |
| `short_answer` 简答 | `null` | 字符串（参考答案） |

---

## 7. 题目详情 / 编辑 / 删除

- `GET /api/questions/:id` → `{ "question": { ... 同列表项 ... } }`
- `PATCH /api/questions/:id` 编辑，可修改字段：`type` `content` `options` `answer` `analysis`（复用入库校验，非法会 400）：

```bash
curl -X PATCH http://localhost:3000/api/questions/101 \
  -H "Content-Type: application/json" \
  -d '{"answer": "B", "analysis": "修正后的解析"}'
```

- `DELETE /api/questions/:id` → 软删（详情接口随即返回 404）

---

## 8. 文件

- `GET /api/files?page=1&pageSize=20` 文件列表
- `GET /api/files/:id` 元数据
- `GET /api/files/:id/download` 下载原始文件（流式回显）
- `DELETE /api/files/:id` 删除文件（软删，级联删除其题库与题目）

---

## 9. 分类树

`GET /api/categories`

```json
{
  "categories": [
    { "id": 1, "name": "电工作业", "level": 1, "children": [
        { "id": 4, "name": "低压电工作业", "level": 2, "children": [] },
        { "id": 5, "name": "高压电工作业", "level": 2, "children": [] }
    ]},
    { "id": 2, "name": "焊接与热切割作业", "level": 1, "children": [] },
    { "id": 3, "name": "高处作业", "level": 1, "children": [ ... ] }
  ]
}
```

---

## 10. 常见错误码

| code | HTTP | 场景 |
|---|---|---|
| `BAD_REQUEST` | 400 | 参数缺失/非法、不支持的文件类型、文件超限 |
| `UPLOAD_ERROR` | 400 | multer 上传错误 |
| `PAYLOAD_TOO_LARGE` | 413 | 请求体超限 |
| `NOT_FOUND` | 404 | 资源不存在 / 接口不存在 |
| `CONFLICT` | 409 | 状态冲突（如已成功任务不可重试） |
| `UNPROCESSABLE` | 422 | 数据校验不通过（分类无法匹配等） |
| `INTERNAL_ERROR` | 500 | 服务器内部错误（未配置 API Key 也会走这里） |
