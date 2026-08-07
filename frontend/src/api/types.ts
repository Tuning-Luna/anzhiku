// 与后端序列化输出严格对齐的类型定义

export type QuestionType =
  | 'single_choice'
  | 'multi_choice'
  | 'true_false'
  | 'fill_blank'
  | 'short_answer'

export type TaskStatus =
  | 'pending'
  | 'processing'
  | 'succeeded'
  | 'partial_failed'
  | 'failed'
  | 'cancelled'

export type SourceType = 'upload' | 'url'

export interface FileMeta {
  id: number
  originalName: string
  sizeBytes: number
  mimeType: string | null
  extension: string | null
  sha256: string | null
  sourceType: SourceType
  sourceUrl: string | null
  status: 'active' | 'deleted'
  createdAt: string
}

export interface CategoryNode {
  id: number
  name: string
  level: number
  children: CategoryNode[]
}

export interface QuestionOption {
  label: string
  content: string
}

export interface Question {
  id: number
  bankId: number
  type: QuestionType
  content: string
  options: QuestionOption[] | null
  answer: string | string[] | boolean | null
  analysis: string | null
  status: string
  createdAt: string
  updatedAt: string
  bank?: {
    id: number
    name: string
    categoryId: number
    subCategoryId: number | null
    file?: { id: number; originalName: string } | null
  } | null
}

export interface Bank {
  id: number
  name: string
  fileId: number
  categoryId: number
  subCategoryId: number | null
  questionCount: number
  status: string
  createdAt: string
  file: { id: number; originalName: string; extension: string | null } | null
  category: { id: number; name: string } | null
  subCategory: { id: number; name: string } | null
}

export interface Task {
  id: number
  fileId: number
  status: TaskStatus
  strategy: string
  model: string | null
  totalQuestions: number
  successCount: number
  failedCount: number
  errorCode: string | null
  errorMessage: string | null
  retryCount: number
  startedAt: string | null
  finishedAt: string | null
  createdAt: string
  file: { id: number; originalName: string; extension: string | null } | null
}

export interface ParseError {
  id: number
  questionIndex: number | null
  errorType: string
  errorMessage: string | null
  rawQuestion: unknown | null
}

export interface LlmRecord {
  id: number
  model: string | null
  promptTokens: number
  completionTokens: number
  success: boolean
  errorCode: string | null
  errorMessage: string | null
  latencyMs: number | null
  createdAt: string
}

export interface TaskDetail extends Omit<Task, 'file'> {
  file: {
    id: number
    originalName: string
    mimeType: string | null
    sizeBytes: number
    sourceType: string
    sourceUrl: string | null
    bank: {
      id: number
      name: string
      categoryId: number
      subCategoryId: number | null
      questionCount: number
      category: { id: number; name: string } | null
      subCategory: { id: number; name: string } | null
    } | null
  } | null
  errors: ParseError[]
  llmRecords: LlmRecord[]
}

export interface PageResult<T> {
  total: number
  page: number
  pageSize: number
  items: T[]
}

export interface UploadResult {
  fileId: number
  taskId: number
  file: FileMeta
}

export interface ErrorBody {
  code: string
  message: string
  details?: unknown
}
