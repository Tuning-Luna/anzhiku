<template>
  <div>
    <el-card shadow="never">
      <template #header>
        <div class="card-header">
          <span>上传题库文档</span>
          <el-link :href="'/api/files/1/download'" type="info" :underline="false">示例：文件回显接口</el-link>
        </div>
      </template>
      <el-upload
        drag
        :auto-upload="false"
        :limit="1"
        accept=".pdf,.docx,.xlsx,.txt"
        :on-change="onFileChange"
        :on-remove="onFileRemove"
        :file-list="fileList"
      >
        <el-icon class="el-icon--upload"><UploadFilled /></el-icon>
        <div class="el-upload__text">拖拽文件到此处，或 <em>点击选择</em></div>
        <template #tip>
          <div class="el-upload__tip">支持 PDF / Word(.docx) / Excel(.xlsx) / TXT，最大 50MB</div>
        </template>
      </el-upload>
      <div style="margin-top: 16px">
        <el-button type="primary" :loading="uploading" :disabled="!selectedFile" @click="submitUpload">
          上传并解析
        </el-button>
      </div>
    </el-card>

    <el-card shadow="never" style="margin-top: 16px">
      <template #header><span>从 URL 导入文档</span></template>
      <div style="display: flex; gap: 12px">
        <el-input v-model="url" placeholder="https://example.com/question-bank.pdf" clearable @keyup.enter="submitUrl" />
        <el-button type="primary" :loading="urlLoading" @click="submitUrl">导入并解析</el-button>
      </div>
    </el-card>

    <el-alert
      v-if="lastResult"
      type="success"
      :closable="false"
      style="margin-top: 16px"
      title="解析任务已创建"
    >
      文件 #{{ lastResult.fileId }}（{{ lastResult.file.originalName }}），任务 #{{ lastResult.taskId }}。
      可前往「解析任务」查看进度，稍后到「题库管理」查看解析结果。
    </el-alert>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { ElMessage } from 'element-plus'
import type { UploadFile, UploadFiles } from 'element-plus'
import { fileApi } from '@/api'
import type { UploadResult } from '@/api/types'

const selectedFile = ref<File | null>(null)
const fileList = ref<UploadFiles>([])
const url = ref('')
const uploading = ref(false)
const urlLoading = ref(false)
const lastResult = ref<UploadResult | null>(null)

function onFileChange(file: UploadFile, files: UploadFiles) {
  fileList.value = files
  selectedFile.value = file.raw ?? null
}

function onFileRemove() {
  selectedFile.value = null
  fileList.value = []
}

async function submitUpload() {
  if (!selectedFile.value) return
  const form = new FormData()
  form.append('file', selectedFile.value)
  uploading.value = true
  try {
    lastResult.value = await fileApi.upload(form)
    ElMessage.success('上传成功，解析任务已创建')
    selectedFile.value = null
    fileList.value = []
  } finally {
    uploading.value = false
  }
}

async function submitUrl() {
  const u = url.value.trim()
  if (!u) {
    ElMessage.warning('请输入文档 URL')
    return
  }
  urlLoading.value = true
  try {
    lastResult.value = await fileApi.importFromUrl(u)
    ElMessage.success('导入成功，解析任务已创建')
    url.value = ''
  } finally {
    urlLoading.value = false
  }
}
</script>

<style scoped>
.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
</style>
