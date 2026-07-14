<script setup>
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '../stores/auth.js';
import { useToast } from '../composables/useToast.js';

const router = useRouter();
const auth = useAuthStore();
const { show: showToast } = useToast();

const mode = ref('login');
const username = ref('');
const password = ref('');
const loading = ref(false);

async function submit() {
  if (loading.value) return;
  if (!username.value.trim() || !password.value.trim()) {
    showToast('请填写用户名和密码');
    return;
  }
  loading.value = true;
  try {
    if (mode.value === 'login') {
      await auth.login(username.value.trim(), password.value);
    } else {
      await auth.register(username.value.trim(), password.value);
    }
    router.replace('/home');
  } catch (e) {
    showToast(e.message);
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <div class="login-page">
    <div class="login-hero">
      <div class="logo">🍚</div>
      <h1 class="title">吃什么</h1>
      <p class="slogan">今天也来决定一下吧</p>
    </div>

    <div class="login-card card">
      <div class="tabs">
        <button :class="{ active: mode === 'login' }" @click="mode = 'login'">登录</button>
        <button :class="{ active: mode === 'register' }" @click="mode = 'register'">注册</button>
      </div>

      <form @submit.prevent="submit">
        <div class="input-group">
          <label class="input-label">用户名</label>
          <input
            v-model="username"
            class="input"
            placeholder="2-20 个字符"
            maxlength="20"
            autocomplete="username"
          />
        </div>
        <div class="input-group">
          <label class="input-label">密码</label>
          <input
            v-model="password"
            type="password"
            class="input"
            placeholder="至少 4 位"
            autocomplete="current-password"
          />
        </div>

        <button type="submit" class="btn btn-block" :disabled="loading">
          {{ loading ? '处理中…' : (mode === 'login' ? '登 录' : '注 册') }}
        </button>
      </form>
    </div>

    <p class="tip">提示：先注册一个账号，再让朋友也注册，互加好友就能互相抽菜、投喂啦</p>
  </div>
</template>

<style scoped>
.login-page {
  min-height: 100vh;
  padding: 60px 24px 24px;
  display: flex;
  flex-direction: column;
}
.login-hero {
  text-align: center;
  margin-bottom: 36px;
  animation: hero-fade 0.6s ease;
}
@keyframes hero-fade {
  from { opacity: 0; transform: translateY(12px); }
  to { opacity: 1; transform: translateY(0); }
}
.logo {
  font-size: 64px;
  margin-bottom: 8px;
  animation: float 3s ease-in-out infinite;
}
.title {
  font-size: 32px;
  font-weight: 800;
  color: var(--primary-dark);
}
.slogan {
  color: var(--text-light);
  margin-top: 4px;
  font-size: 14px;
}
.login-card {
  padding: 20px;
  animation: card-slide 0.4s ease;
}
@keyframes card-slide {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
}
.tabs {
  display: flex;
  gap: 8px;
  margin-bottom: 20px;
  background: var(--primary-soft);
  border-radius: 12px;
  padding: 4px;
}
.tabs button {
  flex: 1;
  padding: 10px;
  border-radius: 9px;
  font-size: 14px;
  font-weight: 600;
  color: var(--text-light);
  transition: all 0.2s;
}
.tabs button.active {
  background: var(--bg-card);
  color: var(--primary-dark);
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.06);
}
.tip {
  text-align: center;
  color: var(--text-light);
  font-size: 12px;
  margin-top: 20px;
  padding: 0 12px;
  line-height: 1.6;
}
</style>
