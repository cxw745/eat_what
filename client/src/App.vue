<script setup>
import { computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useAuthStore } from './stores/auth.js';
import { useToast } from './composables/useToast.js';

const route = useRoute();
const router = useRouter();
const auth = useAuthStore();
const { message: toastMsg } = useToast();

const showTabBar = computed(() => auth.user && route.meta?.tab !== false);

const tabs = [
  { path: '/home', label: '首页', icon: '🏠' },
  { path: '/meals', label: '餐库', icon: '🍱' },
  { path: '/friends', label: '好友', icon: '👥' },
  { path: '/feeds', label: '投喂', icon: '📨' },
];

function go(path) {
  if (route.path !== path) router.push(path);
}

function isTabActive(t) {
  return route.path === t.path || route.path.startsWith(t.path + '/');
}
</script>

<template>
  <div class="app-shell">
    <RouterView v-slot="{ Component }">
      <transition name="fade" mode="out-in">
        <keep-alive include="MyMeals,Friends,FeedInbox">
          <component :is="Component" />
        </keep-alive>
      </transition>
    </RouterView>

    <nav v-if="showTabBar" class="tab-bar">
      <button
        v-for="t in tabs"
        :key="t.path"
        class="tab-item"
        :class="{ active: isTabActive(t) }"
        @click="go(t.path)"
      >
        <span class="tab-icon">{{ t.icon }}</span>
        <span class="tab-label">{{ t.label }}</span>
      </button>
    </nav>

    <!-- 全局 Toast -->
    <transition name="toast">
      <div v-if="toastMsg" class="toast">{{ toastMsg }}</div>
    </transition>
  </div>
</template>
