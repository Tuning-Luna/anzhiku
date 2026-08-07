<template>
  <el-dialog
    v-model="dialogVisible"
    :title="`编辑题目 #${props.question?.id ?? ''}`"
    width="760px"
    destroy-on-close
  >
    <el-form :model="form" label-width="70px">
      <el-form-item label="题型">
        <el-select v-model="form.type" style="width: 200px" @change="onTypeChange">
          <el-option
            v-for="(label, value) in questionTypeLabels"
            :key="value"
            :label="label"
            :value="value"
          />
        </el-select>
      </el-form-item>

      <el-form-item label="题干">
        <el-input v-model="form.content" type="textarea" :rows="3" placeholder="题干内容" />
      </el-form-item>

      <template v-if="isChoice">
        <el-form-item label="选项">
          <div class="opt-wrap">
            <div v-for="(opt, i) in form.options" :key="i" class="opt-row">
              <el-input :model-value="opt.label" disabled style="width: 56px" />
              <el-input v-model="opt.content" placeholder="选项内容" />
              <el-button
                type="danger"
                link
                :icon="Delete"
                :disabled="form.options.length <= 2"
                @click="removeOption(i)"
              />
            </div>
            <el-button size="small" :icon="Plus" @click="addOption">添加选项</el-button>
          </div>
        </el-form-item>

        <el-form-item label="答案">
          <el-select
            v-if="form.type === 'single_choice'"
            v-model="form.answerSingle"
            style="width: 120px"
            placeholder="选择答案"
          >
            <el-option v-for="o in form.options" :key="o.label" :label="o.label" :value="o.label" />
          </el-select>
          <el-checkbox-group v-else v-model="form.answerMulti">
            <el-checkbox v-for="o in form.options" :key="o.label" :label="o.label" :value="o.label" />
          </el-checkbox-group>
        </el-form-item>
      </template>

      <el-form-item v-else-if="form.type === 'true_false'" label="答案">
        <el-radio-group v-model="form.answerBool">
          <el-radio :value="true">正确</el-radio>
          <el-radio :value="false">错误</el-radio>
        </el-radio-group>
      </el-form-item>

      <el-form-item v-else label="答案">
        <el-input
          v-model="form.answerText"
          type="textarea"
          :rows="2"
          :placeholder="form.type === 'short_answer' ? '参考答案' : '填空答案'"
        />
      </el-form-item>

      <el-form-item label="解析">
        <el-input v-model="form.analysis" type="textarea" :rows="2" placeholder="解析说明（可选）" />
      </el-form-item>
    </el-form>

    <template #footer>
      <el-button @click="dialogVisible = false">取消</el-button>
      <el-button type="primary" :loading="saving" @click="save">保存</el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { Delete, Plus } from '@element-plus/icons-vue'
import { questionApi } from '@/api'
import { questionTypeLabels } from '@/utils/format'
import type { Question, QuestionOption } from '@/api/types'

const props = defineProps<{ modelValue: boolean; question: Question | null }>()
const emit = defineEmits<{
  (e: 'update:modelValue', v: boolean): void
  (e: 'saved'): void
}>()

const dialogVisible = computed({
  get: () => props.modelValue,
  set: (v) => emit('update:modelValue', v),
})

const saving = ref(false)

const form = reactive({
  type: 'single_choice' as Question['type'],
  content: '',
  options: [] as QuestionOption[],
  answerSingle: '',
  answerMulti: [] as string[],
  answerBool: true,
  answerText: '',
  analysis: '',
})

const isChoice = computed(() => form.type === 'single_choice' || form.type === 'multi_choice')

function initOptions(count = 4): QuestionOption[] {
  return Array.from({ length: count }, (_, i) => ({
    label: String.fromCharCode(65 + i),
    content: '',
  }))
}

function onTypeChange() {
  if (!isChoice.value) form.options = []
  form.answerSingle = ''
  form.answerMulti = []
  form.answerBool = true
  form.answerText = ''
}

watch(
  () => props.question,
  (q) => {
    if (!q) return
    form.type = q.type
    form.content = q.content
    form.options = q.options?.length ? q.options.map((o) => ({ ...o })) : initOptions()
    form.analysis = q.analysis ?? ''
    if (q.type === 'single_choice') form.answerSingle = (q.answer as string) ?? ''
    else if (q.type === 'multi_choice') form.answerMulti = (q.answer as string[]) ?? []
    else if (q.type === 'true_false') form.answerBool = (q.answer as boolean) ?? true
    else form.answerText = String(q.answer ?? '')
  },
  { immediate: true }
)

function addOption() {
  const label = String.fromCharCode(65 + form.options.length)
  form.options.push({ label, content: '' })
}

function removeOption(i: number) {
  if (form.options.length <= 2) return
  form.options.splice(i, 1)
  form.options = form.options.map((o, idx) => ({
    label: String.fromCharCode(65 + idx),
    content: o.content,
  }))
}

async function save() {
  if (!props.question) return
  if (!form.content.trim()) {
    ElMessage.warning('题干不能为空')
    return
  }
  const patch: Record<string, unknown> = {
    type: form.type,
    content: form.content.trim(),
    analysis: form.analysis.trim(),
    options: isChoice.value ? form.options.filter((o) => o.content.trim()) : null,
  }
  if (form.type === 'single_choice') patch.answer = form.answerSingle
  else if (form.type === 'multi_choice') patch.answer = form.answerMulti
  else if (form.type === 'true_false') patch.answer = form.answerBool
  else patch.answer = form.answerText

  saving.value = true
  try {
    await questionApi.update(props.question.id, patch)
    ElMessage.success('已保存')
    dialogVisible.value = false
    emit('saved')
  } finally {
    saving.value = false
  }
}
</script>

<style scoped>
.opt-wrap {
  width: 100%;
}
.opt-row {
  display: flex;
  gap: 8px;
  margin-bottom: 8px;
}
</style>
