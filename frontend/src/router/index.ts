import { createRouter, createWebHashHistory, type RouteRecordRaw } from 'vue-router'
import AppLayout from '@/layout/AppLayout.vue'

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    component: AppLayout,
    redirect: '/files',
    children: [
      { path: 'files', name: 'files', component: () => import('@/views/UploadView.vue'), meta: { title: '文件上传' } },
      { path: 'tasks', name: 'tasks', component: () => import('@/views/TasksView.vue'), meta: { title: '解析任务' } },
      { path: 'banks', name: 'banks', component: () => import('@/views/BanksView.vue'), meta: { title: '题库管理' } },
      { path: 'questions', name: 'questions', component: () => import('@/views/QuestionsView.vue'), meta: { title: '题目管理' } },
    ],
  },
]

const router = createRouter({
  history: createWebHashHistory(),
  routes,
})

export default router
