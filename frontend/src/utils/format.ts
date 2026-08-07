import type { QuestionType, TaskStatus } from '@/api/types'

export function formatBytes(bytes: number | null | undefined): string {
  if (!bytes) return '-'
  if (bytes < 1024) return `${bytes} B`
  const units = ['KB', 'MB', 'GB']
  let value = bytes / 1024
  let i = 0
  while (value >= 1024 && i < units.length - 1) {
    value /= 1024
    i++
  }
  return `${value.toFixed(value >= 100 ? 0 : 1)} ${units[i]}`
}

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '-'
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export const questionTypeLabels: Record<QuestionType, string> = {
  single_choice: '单选题',
  multi_choice: '多选题',
  true_false: '判断题',
  fill_blank: '填空题',
  short_answer: '简答题',
}

export function questionTypeLabel(type: QuestionType): string {
  return questionTypeLabels[type] ?? type
}

export const taskStatusMeta: Record<TaskStatus, { label: string; tag: 'info' | 'warning' | 'success' | 'danger' | 'primary' }> = {
  pending: { label: '排队中', tag: 'info' },
  processing: { label: '解析中', tag: 'warning' },
  succeeded: { label: '成功', tag: 'success' },
  partial_failed: { label: '部分失败', tag: 'warning' },
  failed: { label: '失败', tag: 'danger' },
  cancelled: { label: '已取消', tag: 'info' },
}

export function taskStatusOf(status: TaskStatus) {
  return taskStatusMeta[status] ?? { label: status, tag: 'info' as const }
}

export function answerText(answer: unknown): string {
  if (answer === null || answer === undefined || answer === '') return '-'
  if (Array.isArray(answer)) return answer.join('、')
  if (typeof answer === 'boolean') return answer ? '正确' : '错误'
  return String(answer)
}
