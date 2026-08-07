<template>
  <div>
    <el-card shadow="never">
      <div class="toolbar">
        <el-input
          v-model="keyword"
          placeholder="题干关键词搜索"
          clearable
          style="width: 220px"
          @keyup.enter="load(1)"
          @clear="load(1)"
        />
        <el-select v-model="typeFilter" placeholder="全部题型" clearable style="width: 140px" @change="load(1)">
          <el-option
            v-for="(label, value) in questionTypeLabels"
            :key="value"
            :label="label"
            :value="value"
          />
        </el-select>
        <CategoryFilter @change="onCategoryChange" />
        <el-select
          v-model="bankIdFilter"
          placeholder="全部题库"
          clearable
          filterable
          style="width: 200px"
          @change="load(1)"
        >
          <el-option v-for="b in banks" :key="b.id" :label="b.name" :value="b.id" />
        </el-select>
        <el-button type="primary" :icon="Search" @click="load(1)">查询</el-button>
        <el-button @click="reset">重置</el-button>
      </div>

      <el-table :data="rows" v-loading="loading" border stripe>
        <el-table-column prop="id" label="ID" width="70" />
        <el-table-column label="题型" width="90">
          <template #default="{ row }">
            <el-tag size="small">{{ questionTypeLabel(row.type) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="content" label="题干" min-width="260" show-overflow-tooltip />
        <el-table-column label="答案" min-width="150">
          <template #default="{ row }">
            <div class="answer-cell" :title="String(answerText(row.answer))">
              {{ answerText(row.answer) }}
            </div>
          </template>
        </el-table-column>
        <el-table-column label="所属题库" min-width="160" show-overflow-tooltip>
          <template #default="{ row }">{{ row.bank?.name ?? '-' }}</template>
        </el-table-column>
        <el-table-column label="操作" width="140" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" @click="edit(row)">编辑</el-button>
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

    <QuestionForm v-model="editVisible" :question="currentQuestion" @saved="load()" />
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Search } from '@element-plus/icons-vue'
import { bankApi, questionApi } from '@/api'
import { answerText, questionTypeLabel, questionTypeLabels } from '@/utils/format'
import type { Bank, Question } from '@/api/types'
import CategoryFilter from '@/components/CategoryFilter.vue'
import QuestionForm from '@/components/QuestionForm.vue'

const route = useRoute()

const rows = ref<Question[]>([])
const banks = ref<Bank[]>([])
const total = ref(0)
const page = ref(1)
const pageSize = 10
const loading = ref(false)
const keyword = ref('')
const typeFilter = ref('')
const bankIdFilter = ref<number | null>(null)
const categoryId = ref<number | null>(null)
const subCategoryId = ref<number | null>(null)

const editVisible = ref(false)
const currentQuestion = ref<Question | null>(null)

function onCategoryChange(v: { categoryId: number | null; subCategoryId: number | null }) {
  categoryId.value = v.categoryId
  subCategoryId.value = v.subCategoryId
  load(1)
}

async function load(p?: number) {
  if (p) page.value = p
  loading.value = true
  try {
    const res = await questionApi.list({
      bankId: bankIdFilter.value,
      type: typeFilter.value || undefined,
      keyword: keyword.value || undefined,
      categoryId: categoryId.value,
      subCategoryId: subCategoryId.value,
      page: page.value,
      pageSize,
    })
    rows.value = res.items
    total.value = res.total
  } finally {
    loading.value = false
  }
}

function edit(row: Question) {
  currentQuestion.value = row
  editVisible.value = true
}

async function remove(row: Question) {
  try {
    await ElMessageBox.confirm(`确定删除题目 #${row.id} 吗？`, '删除确认', { type: 'warning' })
  } catch {
    return
  }
  await questionApi.remove(row.id)
  ElMessage.success('题目已删除')
  load()
}

function reset() {
  keyword.value = ''
  typeFilter.value = ''
  bankIdFilter.value = null
  categoryId.value = null
  subCategoryId.value = null
  load(1)
}

onMounted(async () => {
  // 从题库页跳转带 bankId
  const q = route.query.bankId
  if (q) bankIdFilter.value = Number(q)
  const res = await bankApi.list({ pageSize: 100 })
  banks.value = res.items
  load()
})
</script>

<style scoped>
.toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  align-items: center;
  margin-bottom: 12px;
}
.answer-cell {
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
  word-break: break-word;
}
</style>
