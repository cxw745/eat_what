<script setup>
import { ref, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import http from '../api/index.js';
import { getMealType } from '../constants/meal.js';
import TagBadge from '../components/TagBadge.vue';

defineOptions({ name: 'ShareResult' });

const route = useRoute();
const router = useRouter();

const share = ref(null);
const loading = ref(true);
const error = ref('');

async function load() {
  try {
    // 分享接口公开，不需 token
    const data = await http.get(`/shares/${route.params.code}`);
    share.value = data;
  } catch (e) {
    error.value = e.message || '分享不存在';
  } finally {
    loading.value = false;
  }
}

function goHome() {
  router.push('/home');
}

function copyLink() {
  const url = window.location.href;
  navigator.clipboard?.writeText(url).then(() => {
    alert('链接已复制');
  }).catch(() => {
    prompt('复制分享链接：', url);
  });
}

onMounted(load);
</script>

<template>
  <div class="share-page">
    <div v-if="loading" class="loading">
      <div class="spin-emoji">🍽️</div>
      <div>加载中…</div>
    </div>

    <div v-else-if="error" class="error-box card">
      <div class="err-emoji">😅</div>
      <div class="err-text">{{ error }}</div>
      <button class="btn" @click="goHome">回首页</button>
    </div>

    <div v-else-if="share" class="share-card card">
      <div class="ribbon">🎁 来自好友的分享</div>

      <div class="share-result result-anim">
        <span class="result-emoji">{{ getMealType(share.meal_type).emoji }}</span>
        <div class="result-name">{{ share.meal_name }}</div>
        <div class="result-type">{{ getMealType(share.meal_type).label }}</div>

        <div v-if="share.tags && share.tags.length" class="share-tags">
          <TagBadge v-for="t in share.tags" :key="t" :tag="t" />
        </div>
      </div>

      <div class="from-user">来自：{{ share.from_username || '神秘人' }}</div>

      <div class="share-actions">
        <button class="btn btn-block" @click="goHome">我也要玩 →</button>
        <button class="btn btn-ghost btn-block" @click="copyLink">复制链接</button>
      </div>

      <div class="app-brand">吃什么 · 今天吃啥不纠结</div>
    </div>
  </div>
</template>

<style scoped>
.share-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  background: linear-gradient(180deg, var(--primary-soft) 0%, var(--bg) 100%);
}
.loading {
  text-align: center;
  color: var(--text-light);
}
.spin-emoji {
  font-size: 48px;
  animation: spin 1s linear infinite;
  display: inline-block;
}
@keyframes spin {
  to { transform: rotate(360deg); }
}
.error-box {
  text-align: center;
  padding: 40px 24px;
  max-width: 320px;
}
.err-emoji {
  font-size: 48px;
  margin-bottom: 12px;
}
.err-text {
  color: var(--text-light);
  margin-bottom: 20px;
}
.share-card {
  width: 100%;
  max-width: 360px;
  padding: 24px 20px;
  text-align: center;
  position: relative;
  overflow: hidden;
}
.ribbon {
  font-size: 13px;
  color: var(--primary-dark);
  font-weight: 600;
  margin-bottom: 20px;
}
.share-result {
  background: var(--primary-soft);
  border-radius: 16px;
  padding: 32px 16px;
  margin-bottom: 16px;
}
.result-emoji {
  font-size: 56px;
  display: block;
  margin-bottom: 12px;
}
.result-name {
  font-size: 24px;
  font-weight: 800;
  color: var(--primary-dark);
}
.result-type {
  font-size: 13px;
  color: var(--text-light);
  margin-top: 4px;
}
.share-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  justify-content: center;
  margin-top: 12px;
}
.from-user {
  font-size: 13px;
  color: var(--text-light);
  margin-bottom: 20px;
}
.share-actions {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 16px;
}
.app-brand {
  font-size: 12px;
  color: var(--text-light);
  margin-top: 8px;
}

.result-anim {
  animation: pop 0.5s cubic-bezier(0.34, 1.56, 0.64, 1);
}
@keyframes pop {
  0% { transform: scale(0.5); opacity: 0; }
  100% { transform: scale(1); opacity: 1; }
}
</style>
