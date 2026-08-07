import axios from 'axios'
import { ElMessage } from 'element-plus'
import type { ErrorBody } from './types'

const http = axios.create({
  baseURL: '/api',
  timeout: 180000,
})

// 统一错误提示；业务错误直接抛出给调用方
http.interceptors.response.use(
  (res) => res,
  (err) => {
    const body: ErrorBody | undefined = err?.response?.data
    const msg = body?.message || err?.message || '请求失败'
    ElMessage.error(msg)
    return Promise.reject(err)
  }
)

export async function get<T>(url: string, params?: Record<string, unknown>): Promise<T> {
  const res = await http.get<T>(url, { params })
  return res.data
}

export async function post<T>(url: string, data?: unknown): Promise<T> {
  const res = await http.post<T>(url, data)
  return res.data
}

export async function postForm<T>(url: string, form: FormData): Promise<T> {
  const res = await http.post<T>(url, form)
  return res.data
}

export async function patch<T>(url: string, data?: unknown): Promise<T> {
  const res = await http.patch<T>(url, data)
  return res.data
}

export async function del<T>(url: string): Promise<T> {
  const res = await http.delete<T>(url)
  return res.data
}

export default http
