<template>
  <el-cascader
    :options="tree"
    :props="cascaderProps"
    :model-value="current"
    placeholder="全部分类"
    clearable
    filterable
    style="width: 260px"
    @change="onChange"
  />
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { categoryApi } from '@/api'
import type { CategoryNode } from '@/api/types'

const emit = defineEmits<{
  (e: 'change', value: { categoryId: number | null; subCategoryId: number | null }): void
}>()

const tree = ref<CategoryNode[]>([])
const current = ref<number[]>([])

const cascaderProps = {
  value: 'id',
  label: 'name',
  children: 'children',
  checkStrictly: true,
  emitPath: true,
}

onMounted(async () => {
  const res = await categoryApi.tree()
  tree.value = res.categories
})

function onChange(value: unknown) {
  const arr = (value as number[]) ?? []
  current.value = arr
  if (arr.length === 0) {
    emit('change', { categoryId: null, subCategoryId: null })
    return
  }
  emit('change', {
    categoryId: arr[0],
    subCategoryId: arr.length > 1 ? arr[arr.length - 1] : null,
  })
}

defineExpose({ clear: () => (current.value = []) })
</script>
