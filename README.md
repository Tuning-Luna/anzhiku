# 智能题库解析管理平台（后端）

用户上传题库文档（PDF / Word / Excel / TXT / URL），后端调用阿里云百炼（DashScope）Qwen 系列模型自动解析为结构化题目，入库后可查询、管理、检索、回显原始文件。

## 技术栈

| 项 | 选型 |
|---|---|
| 运行时 | Node.js ≥ 20（本机 v24 LTS） |
| 语言 | JavaScript（CommonJS） |
| Web | Express 4 |
| ORM | Sequelize 6 + sequelize-cli（迁移/种子） |
| 数据库 | MySQL 8（utf8mb4，InnoDB） |
| 校验 | ajv（JSON Schema） |
| LLM | 阿里云百炼 OpenAI 兼容端点，`qwen-doc-turbo`（文件数据挖掘模型） |
| 上传 | multer（memoryStorage） |
| 任务队列 | 进程内队列 + 单 worker（状态在 DB，重启可恢复；可换 BullMQ/Redis） |
| 日志 | winston |
| 测试 | Jest + supertest（LLM 用 mock） |

## 快速开始

```bash
npm install

# 1. 配置环境变量
copy .env.example .env
#   编辑 .env，填写 DASHSCOPE_API_KEY（必填）与 DB_PASSWORD

# 2. 创建数据库并初始化（默认库名 anzhiku）
npm run db:create
npm run db:migrate
npm run db:seed

# 3. 启动
npm run dev        # 或 npm start
```

服务默认 `http://localhost:3000`，健康检查 `GET /health`。

> 解析任务为**异步**：上传接口立即返回 `taskId`，调用方轮询 `GET /api/tasks/:id` 获取进度与结果。

## 环境变量

见 `.env.example`。关键项：

| 变量 | 说明 | 默认 |
|---|---|---|
| `DB_HOST/DB_PORT/DB_USER/DB_PASSWORD/DB_NAME` | MySQL 连接 | 127.0.0.1:3306 / root / / anzhiku |
| `DASHSCOPE_API_KEY` | 百炼 API Key | **必填**（解析用） |
| `DASHSCOPE_BASE_URL` | 百炼兼容端点 | `https://dashscope.aliyuncs.com/compatible-mode/v1` |
| `LLM_MODEL` | 解析模型 | `qwen-doc-turbo` |
| `LLM_MAX_RETRIES` | LLM 失败重试次数 | 2 |
| `MAX_FILE_SIZE_MB` | 上传大小上限 | 50 |
| `URL_MAX_SIZE_MB` | URL 下载大小上限 | 50 |
| `UPLOAD_DIR` | 文件存储目录 | `./storage/files` |
| `JOB_CONCURRENCY` | 解析并发数 | 1 |

## 脚本

```bash
npm run dev            # 开发（node --watch）
npm start              # 启动
npm test               # Jest
npm run db:create      # 建库
npm run db:migrate     # 迁移
npm run db:seed        # 分类种子
```

## 前端（frontend/）

Vue 3 + TypeScript + Element Plus 管理界面（Vite）。功能与后端一一对应：文件上传（本地上传 / URL 导入）、解析任务（列表/详情/失败清单/重试，解析中自动刷新）、题库管理、题目管理（关键词/题型/分类检索、编辑、删除）。

```bash
cd frontend
npm install
npm run dev        # 默认 http://localhost:5173，/api 已代理到后端 3000
```

> 前端需要**后端先启动**（`npm run dev`），因为页面数据全部来自后端接口。生产构建：`npm run build`（输出 `frontend/dist/`）。

## 项目结构

```
src/
  app.js / server.js        # 应用组装与启动（启动时恢复卡死任务）
  config/                   # 集中配置(dotenv) + winston 日志
  db/                       # sequelize 连接、models、migrations、seeders
  routes/ controllers/      # HTTP 层（Controller 只做编排，无业务逻辑）
  services/                 # 业务层
    fileStorage.service.js  #   本地磁盘存储（接口化，可换 OSS）
    fileService.js          #   文件记录 + URL 下载（超时/大小/协议校验）
    llmClient.service.js    #   百炼兼容端点封装（原生 fetch，可 mock）
    documentAcquirer.js     #   文件 → file-extract → file_id
    parsePrompt.service.js  #   提取提示词（结构强约束）
    jsonNormalizer.js       #   LLM 输出 → 合法 JSON
    categoryMatcher.js      #   分类模糊匹配（精确/别名/包含）
    questionImport.service.js # 逐题校验 + 部分入库（事务原子替换）
    parseOrchestrator.js    #   解析状态机与重试编排
    parseQueue.service.js   #   进程内队列 + worker
    parseTaskService.js     #   任务创建/查询/重试
    questionService.js / bankService.js / categoryService.js
  jobs/parseWorker.js       # 队列启动 + 崩溃恢复
  middlewares/ utils/ validators/
tests/                      # 单元 + 集成（LLM mock）
```

## API 一览

| 方法 | 路径 | 说明 |
|---|---|---|
| POST | `/api/files` | multipart 上传（字段 `file`）→ `{fileId, taskId}` |
| POST | `/api/files/from-url` | 从 URL 下载导入 `{url}` |
| GET | `/api/files` | 文件列表（分页） |
| GET | `/api/files/:id` | 文件元数据 |
| GET | `/api/files/:id/download` | 原始文件回显 |
| DELETE | `/api/files/:id` | 软删文件（级联软删题库与题目） |
| GET | `/api/tasks` | 任务列表（可按 status 过滤） |
| GET | `/api/tasks/:id` | 任务详情（含失败清单、LLM 记录、题库） |
| POST | `/api/tasks/:id/retry` | 重试失败/部分失败任务 |
| GET | `/api/questions` | 题目列表/检索（bankId/type/categoryId/subCategoryId/keyword） |
| GET | `/api/questions/:id` | 题目详情（含来源文件） |
| PATCH | `/api/questions/:id` | 编辑题目（复用入库校验） |
| DELETE | `/api/questions/:id` | 软删题目 |
| GET | `/api/banks` | 题库列表 |
| DELETE | `/api/banks/:id` | 删除题库（级联禁用题目） |
| GET | `/api/categories` | 分类树 |

统一错误响应：`{ code, message, details? }`。常见 code：`BAD_REQUEST` / `NOT_FOUND` / `CONFLICT` / `UPLOAD_ERROR` / `INTERNAL_ERROR`。

## 解析管线与容错

1. 文件保存本地 → 创建 `pending` 任务入队。
2. worker 提取文本（txt 直读 / docx 用 mammoth / xlsx 用 exceljs / pdf 用 pdf-parse）：文本充足则**分块**逐块调用 `qwen-doc-turbo`（纯文本输入）再合并；本地提取失败则回退 `file-extract` 上传 → `fileid://` 单次调用。
3. 提取 JSON（去围栏/前后缀）→ **ajv Schema 校验** → 分类模糊匹配（失败则整文件 `failed`，不猜）→ 逐题二次校验 → **部分入库**（合法入库、非法进 `parse_errors` 失败清单）。
4. LLM 调用与 JSON 提取失败自动重试（`LLM_MAX_RETRIES`，指数退避）；全部失败则任务 `failed`，原始响应留痕。
5. 重复解析同一文件 → **事务内先删旧题再导入**（文件↔题库一对一，不重复）。
6. 进程重启：卡在 `processing` 的任务置为 `failed(INTERRUPTED)`，遗留 `pending` 自动重新入队。

## 测试

```bash
npm test   # 42+ 用例：上传/URL、解析管线（成功+部分失败+重试+分类失败+JSON失败）、
           # 题目查询/编辑/删除、题库、任务、分类树、超限拦截、数据一致性
```

测试使用独立库 `anzhiku_test`（自动建库：`npm run db:create -- --env test` 等），LLM 通过 Jest mock，不产生真实调用费用。

## 已知说明

- **LLM 调用为流式**（`stream: true` + `stream_options`）：依据官方文档，`qwen-doc-turbo` 正确调用方式是流式；非流式调用可能服务端挂起约 300s 后才返回（曾导致客户端 120s 硬超时）。现在 `LLM_TIMEOUT_MS` 是**流式空闲超时**（长时间无响应数据才中断，默认 300s，可通过 `.env` 调整），长文档持续生成时不会被掐断。
- **长文档自动分块提取**：模型单次调用无法可靠提取全部题目（实测 650 题文档只返回 3 题）。故默认走「本地文本提取 → 按 ~7000 字符分块 → 逐块调用模型 → 合并」。实测 650 题 docx 提取 **644/645 题**（判断答案 `（✔）/（✘）` 自动归一化为布尔）。分块边界可能漏极少数题，后续可做重叠分块优化。本地文本提取失败（如扫描版 PDF）自动回退 file-id 单次模式（此时长文档仍可能少提取）。
- 长文档解析耗时较长（650 题约 10 分钟），属正常（每块模型要生成上万 token）。
- `qwen-doc-turbo` 对 `response_format: json_object` 的支持官方未明示，故默认靠提示词强约束 + 后端 Schema 兜底。
- 文件为**永久保留**（需求确认），仅支持手动删除（软删）。
- 解析依赖真实 `DASHSCOPE_API_KEY`；未配置时任务会以 `llm_error` 失败，配置后重试即可。
- **开发注意**：`npm run dev` 使用 `node --watch`，**任何代码保存都会重启服务**并中断正在解析的任务；正式解析请用 `npm start`。
