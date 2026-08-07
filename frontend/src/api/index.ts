import { get, post, postForm, patch, del } from './http'
import type {
  Bank,
  CategoryNode,
  FileMeta,
  PageResult,
  Question,
  Task,
  TaskDetail,
  UploadResult,
} from './types'

export const fileApi = {
  upload(form: FormData) {
    return postForm<UploadResult>('/files', form)
  },
  importFromUrl(url: string) {
    return post<UploadResult>('/files/from-url', { url })
  },
  list(params: { page?: number; pageSize?: number }) {
    return get<PageResult<FileMeta>>('/files', params)
  },
  remove(id: number) {
    return del<{ message: string; fileId: number }>(`/files/${id}`)
  },
  downloadUrl(id: number) {
    return `/api/files/${id}/download`
  },
}

export const taskApi = {
  list(params: { status?: string; page?: number; pageSize?: number }) {
    return get<PageResult<Task>>('/tasks', params)
  },
  detail(id: number) {
    return get<{ task: TaskDetail }>(`/tasks/${id}`)
  },
  retry(id: number) {
    return post<{ message: string; task: Task }>(`/tasks/${id}/retry`)
  },
}

export const bankApi = {
  list(params: {
    categoryId?: number | null
    subCategoryId?: number | null
    keyword?: string
    page?: number
    pageSize?: number
  }) {
    return get<PageResult<Bank>>('/banks', params)
  },
  remove(id: number) {
    return del<{ message: string; bankId: number }>(`/banks/${id}`)
  },
}

export const questionApi = {
  list(params: {
    bankId?: number | null
    type?: string
    keyword?: string
    categoryId?: number | null
    subCategoryId?: number | null
    page?: number
    pageSize?: number
  }) {
    return get<PageResult<Question>>('/questions', params)
  },
  update(id: number, data: Record<string, unknown>) {
    return patch<{ question: Question }>(`/questions/${id}`, data)
  },
  remove(id: number) {
    return del<{ message: string; questionId: number }>(`/questions/${id}`)
  },
}

export const categoryApi = {
  tree() {
    return get<{ categories: CategoryNode[] }>('/categories')
  },
}
