<script setup>
import { ref, computed, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import http from '../api/index.js';
import { useAuthStore } from '../stores/auth.js';
import { useToast } from '../composables/useToast.js';
import { getMealType, MEAL_TYPE_LIST } from '../constants/meal.js';
import MealCard from '../components/MealCard.vue';
import PostCard from '../components/PostCard.vue';
import EmptyState from '../components/EmptyState.vue';

defineOptions({ name: 'UserProfile' });

const route = useRoute();
const router = useRouter();
const auth = useAuthStore();
const { show: showToast } = useToast();

const profile = ref(null);
const meals = ref([]);
const posts = ref([]);
const activeTab = ref('meals'); // meals | posts
const loading = ref(false);

// 抽好友的菜
const picking = ref(false);
const pickedMeal = ref(null);

// 餐类折叠状态：默认全部折叠
const expandedTypes = ref(new Set());

const isSelf = computed(() => profile.value?.is_self);

// 按餐类分组：只返回有菜品的餐类
const groupedMeals = computed(() => {
  return MEAL_TYPE_LIST.map((t) => ({
    ...t,
    list: meals.value.filter((m) => m.meal_type === t.key),
  })).filter((g) => g.list.length > 0);
});

function toggleType(key) {
  const s = new Set(expandedTypes.value);
  if (s.has(key)) {
    s.delete(key);
  } else {
    s.add(key);
  }
  expandedTypes.value = s;
}

function isExpanded(key) {
  return expandedTypes.value.has(key);
}

function expandAll() {
  expandedTypes.value = new Set(groupedMeals.value.map((g) => g.key));
}

function collapseAll() {
  expandedTypes.value = new Set();
}

async function load() {
  loading.value = true;
  const username = route.params.username;
  try {
    const [p, m, postData] = await Promise.all([
      http.get(`/users/${username}/profile`),
      isSelf.value ? Promise.resolve({ meals: [] }) : http.get(`/users/${username}/meals`).catch(() => ({ meals: [] })),
      http.get(`/posts/user/${username}`),
    ]);
    profile.value = p;
    // 如果是自己，加载自己的餐库
    if (p.is_self) {
      const myMeals = await http.get('/meals');
      meals.value = myMeals.meals;
    } else {
      meals.value = m.meals;
    }
    posts.value = postData.posts;
  } catch (e) {
    showToast(e.message);
  } finally {
    loading.value = false;
  }
}

async function pickFriendMeal() {
  if (picking.value) return;
  picking.value = true;
  pickedMeal.value = null;
  try {
    const data = await http.get(`/friends/${profile.value.user.id}/random`);
    pickedMeal.value = data;
  } catch (e) {
    showToast(e.message);
  } finally {
    picking.value = false;
  }
}

function clickUser(username) {
  if (username && username !== route.params.username) {
    router.push(`/friends/list/${username}`);
  }
}

onMounted(load);
</script>

<template>
  <div>
    <div class="topbar">
      <button class="back-btn" @click="router.back()">‹</button>
      <div class="topbar-title">个人主页</div>
      <div style="width: 30px"></div>
    </div>

    <div class="page" v-if="loading">
      <div class="skeleton skeleton-profile"></div>
      <div class="skeleton skeleton-stat"></div>
    </div>

    <div v-else-if="profile">
      <!-- 用户卡片 -->
      <div class="profile-card card">
        <div class="avatar-lg">{{ profile.user.username.charAt(0).toUpperCase() }}</div>
        <div class="p-info">
          <div class="p-name">{{ profile.user.username }}</div>
          <div class="p-tag">
            <span v-if="isSelf" class="self-badge">这是我</span>
            <span v-else-if="profile.is_friend" class="friend-badge">好友</span>
            <span v-else class="stranger-badge">非好友</span>
          </div>
        </div>
      </div>

      <!-- 统计 -->
      <div class="stat-row">
        <div class="stat-item">
          <div class="stat-num">{{ profile.stats.meal_count }}</div>
          <div class="stat-label">菜品</div>
        </div>
        <div class="stat-item">
          <div class="stat-num">{{ profile.stats.post_count }}</div>
          <div class="stat-label">动态</div>
        </div>
      </div>

      <!-- 好友专属：抽一道他的菜 -->
      <div v-if="!isSelf && profile.is_friend" class="pick-section card">
        <div class="pick-head">
          <span class="pick-emoji">🎲</span>
          <div>
            <div class="pick-title">抽一道 {{ profile.user.username }} 的菜</div>
            <div class="pick-desc">随机尝尝好友的口味</div>
          </div>
        </div>
        <div v-if="picking" class="pick-result loading">
          <span class="spin-emoji">🍽️</span>
          <span>转动中…</span>
        </div>
        <div v-else-if="pickedMeal" :key="pickedMeal.meal.id" class="pick-result result-anim">
          <span class="result-emoji">{{ pickedMeal.meal.emoji || getMealType(pickedMeal.meal.meal_type).emoji }}</span>
          <div class="result-name">{{ pickedMeal.meal.name }}</div>
          <div class="result-type">{{ getMealType(pickedMeal.meal.meal_type).label }}</div>
          <div v-if="pickedMeal.meal.note" class="result-note">📝 {{ pickedMeal.meal.note }}</div>
        </div>
        <button class="btn btn-block" :disabled="picking" @click="pickFriendMeal">
          {{ pickedMeal ? '🎲 换一个' : '开始抽' }}
        </button>
      </div>

      <!-- Tab 切换 -->
      <div class="tab-bar">
        <button class="tab" :class="{ active: activeTab === 'meals' }" @click="activeTab = 'meals'">
          餐库 {{ meals.length }}
        </button>
        <button class="tab" :class="{ active: activeTab === 'posts' }" @click="activeTab = 'posts'">
          动态 {{ posts.length }}
        </button>
      </div>

      <!-- 餐库 -->
      <div v-if="activeTab === 'meals'">
        <div v-if="meals.length === 0">
          <EmptyState emoji="🍽️" :text="isSelf ? '还没有菜品，去添加吧' : 'TA还没有公开菜品'" />
        </div>
        <div v-else>
          <!-- 全部展开/收起 -->
          <div class="group-toolbar">
            <button class="link-btn" @click="expandAll">全部展开</button>
            <span class="sep">·</span>
            <button class="link-btn" @click="collapseAll">全部收起</button>
          </div>

          <!-- 按餐类折叠分组 -->
          <div v-for="g in groupedMeals" :key="g.key" class="meal-group">
            <button class="group-header" @click="toggleType(g.key)">
              <span class="g-emoji">{{ g.emoji }}</span>
              <span class="g-label">{{ g.label }}</span>
              <span class="g-count">{{ g.list.length }}</span>
              <span class="g-arrow" :class="{ open: isExpanded(g.key) }">›</span>
            </button>
            <transition name="expand">
              <div v-if="isExpanded(g.key)" class="group-body">
                <MealCard
                  v-for="m in g.list"
                  :key="m.id"
                  :meal="m"
                  :show-delete="false"
                  :show-edit="false"
                />
              </div>
            </transition>
          </div>
        </div>
      </div>

      <!-- 动态 -->
      <div v-if="activeTab === 'posts'">
        <div v-if="posts.length === 0">
          <EmptyState emoji="📣" text="还没有动态" />
        </div>
        <div v-else>
          <PostCard
            v-for="p in posts"
            :key="p.id"
            :post="p"
            :current-username="auth.user?.username"
            @click-user="clickUser"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.back-btn {
  width: 30px;
  height: 30px;
  border-radius: 50%;
  background: var(--primary-soft);
  color: var(--primary-dark);
  font-size: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
}
.profile-card {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 20px;
  margin-bottom: 12px;
}
.avatar-lg {
  width: 64px;
  height: 64px;
  border-radius: 50%;
  background: linear-gradient(135deg, var(--primary), var(--primary-dark));
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  font-size: 28px;
  flex-shrink: 0;
}
.p-info {
  flex: 1;
}
.p-name {
  font-size: 20px;
  font-weight: 700;
}
.p-tag {
  margin-top: 4px;
}
.self-badge, .friend-badge, .stranger-badge {
  font-size: 12px;
  padding: 2px 10px;
  border-radius: 12px;
  font-weight: 600;
}
.self-badge {
  background: var(--primary-soft);
  color: var(--primary-dark);
}
.friend-badge {
  background: #dcfce7;
  color: #16a34a;
}
.stranger-badge {
  background: var(--bg-card);
  color: var(--text-light);
}
.stat-row {
  display: flex;
  gap: 12px;
  margin-bottom: 16px;
}
.stat-item {
  flex: 1;
  background: var(--bg-card);
  border-radius: 14px;
  padding: 16px;
  text-align: center;
  box-shadow: var(--shadow-sm);
}
.stat-num {
  font-size: 24px;
  font-weight: 800;
  color: var(--primary-dark);
}
.stat-label {
  font-size: 12px;
  color: var(--text-light);
  margin-top: 2px;
}
.pick-section {
  padding: 20px;
  margin-bottom: 16px;
}
.pick-head {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 14px;
}
.pick-emoji {
  font-size: 32px;
}
.pick-title {
  font-weight: 700;
  font-size: 15px;
}
.pick-desc {
  font-size: 12px;
  color: var(--text-light);
  margin-top: 2px;
}
.pick-result {
  background: var(--primary-soft);
  border-radius: 14px;
  padding: 20px;
  text-align: center;
  margin-bottom: 14px;
  min-height: 100px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
}
.pick-result.loading {
  color: var(--primary-dark);
  font-weight: 600;
}
.result-emoji {
  font-size: 40px;
}
.result-name {
  font-size: 20px;
  font-weight: 800;
  color: var(--primary-dark);
}
.result-type {
  font-size: 12px;
  color: var(--text-light);
}
.tab-bar {
  display: flex;
  gap: 8px;
  margin-bottom: 14px;
  background: var(--bg-card);
  border-radius: 12px;
  padding: 4px;
  box-shadow: var(--shadow-sm);
}
.tab {
  flex: 1;
  padding: 10px;
  border-radius: 9px;
  font-size: 14px;
  font-weight: 600;
  color: var(--text-light);
  transition: all 0.15s;
}
.tab.active {
  background: var(--primary);
  color: #fff;
}

/* 餐库折叠分组 */
.group-toolbar {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 12px;
  padding: 0 4px;
}
.group-toolbar .link-btn {
  font-size: 12px;
  color: var(--primary);
  background: none;
  padding: 2px 4px;
  font-weight: 600;
}
.group-toolbar .sep {
  color: var(--text-light);
  font-size: 12px;
}
.meal-group {
  margin-bottom: 10px;
  background: var(--bg-card);
  border-radius: 14px;
  box-shadow: var(--shadow-sm);
  overflow: hidden;
}
.group-header {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 14px 16px;
  background: none;
  text-align: left;
  transition: background 0.15s;
}
.group-header:active {
  background: var(--primary-soft);
}
.g-emoji {
  font-size: 22px;
  flex-shrink: 0;
}
.g-label {
  flex: 1;
  font-size: 15px;
  font-weight: 700;
  color: var(--text);
}
.g-count {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-light);
  background: var(--primary-soft);
  padding: 2px 10px;
  border-radius: 10px;
  min-width: 28px;
  text-align: center;
}
.g-arrow {
  font-size: 20px;
  color: var(--text-light);
  transition: transform 0.25s ease;
  transform: rotate(0deg);
}
.g-arrow.open {
  transform: rotate(90deg);
}
.group-body {
  padding: 0 12px 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.result-note {
  font-size: 12px;
  color: var(--text-light);
  margin-top: 4px;
  max-width: 90%;
  line-height: 1.4;
}

/* 折叠展开动画 */
.expand-enter-active, .expand-leave-active {
  transition: all 0.25s ease;
  overflow: hidden;
}
.expand-enter-from, .expand-leave-to {
  opacity: 0;
  max-height: 0;
}
.skeleton-profile {
  height: 100px;
  margin-bottom: 12px;
}
.skeleton-stat {
  height: 80px;
}
</style>
