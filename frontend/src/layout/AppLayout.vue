<template>
  <el-container class="layout">
    <el-aside width="220px" class="aside">
      <div class="logo">智能题库解析平台</div>
      <el-menu :default-active="activePath" router class="menu">
        <el-menu-item index="/files">
          <el-icon><UploadFilled /></el-icon>
          <span>文件上传</span>
        </el-menu-item>
        <el-menu-item index="/tasks">
          <el-icon><Histogram /></el-icon>
          <span>解析任务</span>
        </el-menu-item>
        <el-menu-item index="/banks">
          <el-icon><Collection /></el-icon>
          <span>题库管理</span>
        </el-menu-item>
        <el-menu-item index="/questions">
          <el-icon><Document /></el-icon>
          <span>题目管理</span>
        </el-menu-item>
      </el-menu>
    </el-aside>
    <el-container>
      <el-header class="header">
        <span class="title">{{ currentTitle }}</span>
      </el-header>
      <el-main class="main">
        <router-view />
      </el-main>
    </el-container>
  </el-container>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'

const route = useRoute()
const activePath = computed(() => route.path)
const currentTitle = computed(() => (route.meta.title as string) || '')
</script>

<style scoped>
.layout {
  height: 100%;
}
.aside {
  background: #001529;
}
.logo {
  height: 56px;
  line-height: 56px;
  text-align: center;
  color: #fff;
  font-size: 15px;
  font-weight: 600;
  letter-spacing: 1px;
}
.menu {
  border-right: none;
  background: transparent;
  --el-menu-bg-color: transparent;
  --el-menu-text-color: #c9d1d9;
  --el-menu-active-color: #fff;
  --el-menu-hover-bg-color: #0d2847;
}
.menu :deep(.el-menu-item.is-active) {
  background: #1890ff;
}
.header {
  background: #fff;
  border-bottom: 1px solid #e4e7ed;
  display: flex;
  align-items: center;
}
.title {
  font-size: 16px;
  font-weight: 600;
}
.main {
  padding: 16px;
  overflow: auto;
}
</style>
