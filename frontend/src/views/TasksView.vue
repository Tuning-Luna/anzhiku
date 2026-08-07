<template>
  <div>
    <el-card shadow="never">
      <div class="toolbar">
        <el-select v-model="statusFilter" placeholder="全部状态" clearable style="width: 160px" @change="load(1)">
          <el-option v-for="(meta, key) in taskStatusMeta" :key="key" :label="meta.label" :value="key" />
        </el-select>
        <el-button type="primary" :icon="Refresh" @click="load(1)">刷新</el-button>
        <el-tag v-if="hasRunning" type="warning" effect="plain">有任务解析中，每 5 秒自动刷新</el-tag>
      </div>

      <el-table :data="rows" v-loading="loading" border stripe>
        <el-table-column prop="id" label="ID" width="60" />
        <el-table-column label="文件" min-width="180" show-overflow-tooltip>
          <template #default="{ row }">{{ row.file?.originalName ?? '-' }}</template>
        </el-table-column>
        <el-table-column label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="taskStatusOf(row.status).tag">{{ taskStatusOf(row.status).label }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="successCount" label="成功" width="70" align="center" />
        <el-table-column prop="failedCount" label="失败" width="70" align="center" />
        <el-table-column label="错误信息" min-width="200" show-overflow-tooltip>
          <template #default="{ row }">
            {{ row.errorCode ? row.errorCode + ': ' + (row.errorMessage ?? '') : '-' }}
          </template>
        </el-table-column>
        <el-table-column label="创建时间" width="150">
          <template #default="{ row }">{{ formatDateTime(row.createdAt) }}</template>
        </el-table-column>
        <el-table-column label="操作" width="140" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" @click="openDetail(row.id)">详情</el-button>
            <el-button
              link
              type="warning"
              :disabled="!['failed', 'partial_failed'].includes(row.status)"
              @click="retry(row)"
            >
              重试
            </el-button>
          </template>
        </el-table-column>
      </el-table>

      <el-pagination
        v-model:current-page="page"
        :page-size="pageSize"
        :total="total"
        layout="total, prev, pager, next"
        style="margin-top: 12px; justify-content: flex-end"
        @current-change="load"
      />
    </el-card>

    <el-dialog v-model="detailVisible" title="任务详情" width="880px">
      <template v-if="detail">
        <el-descriptions :column="3" border size="small">
          <el-descriptions-item label="任务ID">{{ detail.id }}</el-descriptions-item>
          <el-descriptions-item label="文件">{{ detail.file?.originalName ?? '-' }}</el-descriptions-item>
          <el-descriptions-item label="状态">
            <el-tag :type="taskStatusOf(detail.status).tag">{{ taskStatusOf(detail.status).label }}</el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="模型">{{ detail.model ?? '-' }}</el-descriptions-item>
          <el-descriptions-item label="成功/总数">{{ detail.successCount }} / {{ detail.totalQuestions }}</el-descriptions-item>
          <el-descriptions-item label="失败数">{{ detail.failedCount }}</el-descriptions-item>
          <el-descriptions-item label="分类" :span="2">
            {{ detail.file?.bank?.category?.name ?? '-' }}
            {{ detail.file?.bank?.subCategory ? ' / ' + detail.file?.bank?.subCategory.name : '' }}
          </el-descriptions-item>
          <el-descriptions-item label="错误信息" :span="3">
            {{ detail.errorCode ? detail.errorCode + ' - ' + (detail.errorMessage ?? '') : '无' }}
          </el-descriptions-item>
        </el-descriptions>

        <h4 class="block-title">失败清单（{{ detail.errors.length }}）</h4>
        <el-table :data="detail.errors" size="small" border max-height="220">
          <el-table-column label="题号" width="70">
            <template #default="{ row }">{{ row.questionIndex !== null ? row.questionIndex + 1 : '-' }}</template>
          </el-table-column>
          <el-table-column prop="errorType" label="类型" width="160" />
          <el-table-column prop="errorMessage" label="原因" />
        </el-table>

        <h4 class="block-title">LLM 调用记录（{{ detail.llmRecords.length }}）</h4>
        <el-table :data="detail.llmRecords" size="small" border max-height="220">
          <el-table-column prop="model" label="模型" width="160" />
          <el-table-column prop="promptTokens" label="输入 Token" width="110" align="center" />
          <el-table-column prop="completionTokens" label="输出 Token" width="110" align="center" />
          <el-table-column prop="latencyMs" label="耗时(ms)" width="110" align="center" />
          <el-table-column label="结果" width="90" align="center">
            <template #default="{ row }">
              <el-tag :type="row.success ? 'success' : 'danger'" size="small">
                {{ row.success ? '成功' : '失败' }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="errorMessage" label="错误" min-width="160" show-overflow-tooltip />
        </el-table>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Refresh } from '@element-plus/icons-vue'
import { taskApi } from '@/api'
import { formatDateTime, taskStatusMeta, taskStatusOf } from '@/utils/format'
import type { Task, TaskDetail } from '@/api/types'

const rows = ref<Task[]>([])
const total = ref(0)
const page = ref(1)
const pageSize = 10
const loading = ref(false)
const statusFilter = ref('')

const detailVisible = ref(false)
const detail = ref<TaskDetail | null>(null)

const hasRunning = computed(() =>
  rows.value.some((r) => r.status === 'pending' || r.status === 'processing')
)

async function load(p?: number) {
  if (p) page.value = p
  loading.value = true
  try {
    const res = await taskApi.list({
      status: statusFilter.value || undefined,
      page: page.value,
      pageSize,
    })
    rows.value = res.items
    total.value = res.total
  } finally {
    loading.value = false
  }
}

async function openDetail(id: number) {
  const res = await taskApi.detail(id)
  detail.value = res.task
  detailVisible.value = true
}

async function retry(row: Task) {
  try {
    await ElMessageBox.confirm(
      `确定重试任务 #${row.id} 吗？重试成功后会替换该文件对应的题库（不产生重复）。`,
      '重试确认',
      { type: 'warning' }
    )
  } catch {
    return
  }
  await taskApi.retry(row.id)
  ElMessage.success('已重新入队')
  load()
}

let timer: number | undefined
onMounted(() => {
  load()
  timer = window.setInterval(() => {
    if (hasRunning.value) load()
  }, 5000)
})
onUnmounted(() => {
  if (timer) window.clearInterval(timer)
})
</script>

<style scoped>
.toolbar {
  display: flex;
  gap: 12px;
  align-items: center;
  margin-bottom: 12px;
}
.block-title {
  margin: 16px 0 8px;
}
</style>
