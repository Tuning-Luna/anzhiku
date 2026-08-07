<template>
  <div>
    <el-card shadow="never">
      <div class="toolbar">
        <CategoryFilter ref="categoryFilter" @change="onCategoryChange" />
        <el-input
          v-model="keyword"
          placeholder="按题库名称搜索"
          clearable
          style="width: 220px"
          @keyup.enter="load(1)"
          @clear="load(1)"
        />
        <el-button type="primary" :icon="Search" @click="load(1)">查询</el-button>
      </div>

      <el-table :data="rows" v-loading="loading" border stripe>
        <el-table-column prop="id" label="ID" width="60" />
        <el-table-column prop="name" label="题库名称" min-width="200" show-overflow-tooltip />
        <el-table-column label="分类" width="180">
          <template #default="{ row }">
            {{ row.category?.name ?? '-' }}{{ row.subCategory ? ' / ' + row.subCategory.name : '' }}
          </template>
        </el-table-column>
        <el-table-column prop="questionCount" label="题目数" width="90" align="center" />
        <el-table-column label="来源文件" min-width="180" show-overflow-tooltip>
          <template #default="{ row }">
            <el-link
              v-if="row.file"
              type="primary"
              :href="fileApi.downloadUrl(row.fileId)"
              target="_blank"
              :underline="false"
            >
              {{ row.file.originalName }}
            </el-link>
            <span v-else>-</span>
          </template>
        </el-table-column>
        <el-table-column label="创建时间" width="150">
          <template #default="{ row }">{{ formatDateTime(row.createdAt) }}</template>
        </el-table-column>
        <el-table-column label="操作" width="150" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" @click="viewQuestions(row.id)">查看题目</el-button>
            <el-button link type="danger" @click="remove(row)">删除</el-button>
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
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Search } from '@element-plus/icons-vue'
import { bankApi, fileApi } from '@/api'
import { formatDateTime } from '@/utils/format'
import type { Bank } from '@/api/types'
import CategoryFilter from '@/components/CategoryFilter.vue'

const router = useRouter()

const rows = ref<Bank[]>([])
const total = ref(0)
const page = ref(1)
const pageSize = 10
const loading = ref(false)
const keyword = ref('')
const categoryId = ref<number | null>(null)
const subCategoryId = ref<number | null>(null)
const categoryFilter = ref<InstanceType<typeof CategoryFilter>>()

function onCategoryChange(v: { categoryId: number | null; subCategoryId: number | null }) {
  categoryId.value = v.categoryId
  subCategoryId.value = v.subCategoryId
  load(1)
}

async function load(p?: number) {
  if (p) page.value = p
  loading.value = true
  try {
    const res = await bankApi.list({
      categoryId: categoryId.value,
      subCategoryId: subCategoryId.value,
      keyword: keyword.value || undefined,
      page: page.value,
      pageSize,
    })
    rows.value = res.items
    total.value = res.total
  } finally {
    loading.value = false
  }
}

function viewQuestions(id: number) {
  router.push({ path: '/questions', query: { bankId: String(id) } })
}

async function remove(row: Bank) {
  try {
    await ElMessageBox.confirm(
      `确定删除题库「${row.name}」吗？其下 ${row.questionCount} 道题将一并删除（软删除）。`,
      '删除确认',
      { type: 'warning' }
    )
  } catch {
    return
  }
  await bankApi.remove(row.id)
  ElMessage.success('题库已删除')
  load()
}

onMounted(() => load())
</script>

<style scoped>
.toolbar {
  display: flex;
  gap: 12px;
  align-items: center;
  margin-bottom: 12px;
}
</style>
