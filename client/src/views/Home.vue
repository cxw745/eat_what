<script setup>
import { ref, onMounted, onUnmounted } from 'vue';
import { useRouter } from 'vue-router';
import http from '../api/index.js';
import { useAuthStore } from '../stores/auth.js';
import { useToast } from '../composables/useToast.js';
import { getMealType, MEAL_TYPE_LIST } from '../constants/meal.js';
import { DEFAULT_EMOJI } from '../constants/emoji.js';
import TagBadge from '../components/TagBadge.vue';
import EmptyState from '../components/EmptyState.vue';

const router = useRouter();
const auth = useAuthStore();
const { show: showToast } = useToast();

// 抽我的
const myResult = ref(null);
const myLoading = ref(false);
const myPickType = ref('');

// 抽好友的
const friends = ref([]);
const selectedFriend = ref(null);
const friendResult = ref(null);
const friendLoading = ref(false);
const friendPickType = ref('');

// 投喂未读数
const pendingFeeds = ref(0);
let pollTimer = null;

// 抽奖历史
const history = ref([]);

// 分享
const sharing = ref(false);

// emoji 工具
function mealEmoji(meal) {
  return meal.emoji || DEFAULT_EMOJI[meal.meal_type] || getMealType(meal.meal_type).emoji;
}

function timeAgo(dateStr) {
  if (!dateStr) return '';
  const date = new Date(typeof dateStr === 'string' ? dateStr.replace(' ', 'T') : dateStr);
  const diff = (Date.now() - date.getTime()) / 1000;
  if (diff < 60) return '刚刚';
  if (diff < 3600) return `${Math.floor(diff / 60)}分钟前`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}小时前`;
  return date.toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function logout() {
  auth.logout();
  router.replace('/login');
}

async function loadFriends() {
  try {
    const data = await http.get('/friends');
    friends.value = [...data.outgoing, ...data.incoming].filter((f) => f.status === 'accepted');
  } catch (e) {
    showToast(e.message);
  }
}

async function loadPendingFeeds() {
  try {
    const data = await http.get('/feeds', { params: { limit: 100 } });
    pendingFeeds.value = data.feeds.filter((f) => f.status === 'pending').length;
  } catch (e) {
    /* 投喂数轮询失败静默 */
  }
}

async function loadHistory() {
  try {
    const data = await http.get('/history', { params: { limit: 10 } });
    history.value = data.history;
  } catch (e) {
    /* 静默 */
  }
}

async function pickMine() {
  if (myLoading.value) return;
  myLoading.value = true;
  myResult.value = null;
  try {
    const data = await http.get('/meals/random', {
      params: myPickType.value ? { meal_type: myPickType.value } : {},
    });
    if (!data.meal) {
      const hint = myPickType.value
        ? `「${getMealType(myPickType.value).label}」分类还没有菜，去添加几道吧`
        : '餐库还是空的，先去添加几道菜吧';
      showToast(hint);
    } else {
      myResult.value = data.meal;
      loadHistory(); // 刷新历史
    }
  } catch (e) {
    showToast(e.message);
  } finally {
    myLoading.value = false;
  }
}

async function pickFriend() {
  if (friendLoading.value) return;
  if (!selectedFriend.value) {
    showToast('先选一位好友');
    return;
  }
  friendLoading.value = true;
  friendResult.value = null;
  try {
    const params = friendPickType.value ? { meal_type: friendPickType.value } : {};
    const data = await http.get(`/friends/${selectedFriend.value}/random`, { params });
    friendResult.value = data;
  } catch (e) {
    showToast(e.message);
  } finally {
    friendLoading.value = false;
  }
}

async function shareResult(meal, fromUsername) {
  if (sharing.value) return;
  sharing.value = true;
  try {
    const data = await http.post('/shares', {
      meal_name: meal.name,
      meal_type: meal.meal_type,
      tags: meal.tags || [],
    });
    const url = `${window.location.origin}/share/${data.code}`;
    if (navigator.share) {
      await navigator.share({
        title: '今天吃这个！',
        text: `${fromUsername ? fromUsername + '推荐我吃' : '我抽到了'}：${meal.name}`,
        url,
      });
    } else {
      await navigator.clipboard?.writeText(url);
      showToast('分享链接已复制');
    }
  } catch (e) {
    if (e.name !== 'AbortError') {
      showToast(e.message || '分享失败');
    }
  } finally {
    sharing.value = false;
  }
}

async function clearHistory() {
  if (!confirm('确定清空抽奖历史？')) return;
  try {
    await http.delete('/history');
    history.value = [];
    showToast('已清空');
  } catch (e) {
    showToast(e.message);
  }
}

onMounted(() => {
  loadFriends();
  loadPendingFeeds();
  loadHistory();
  pollTimer = setInterval(loadPendingFeeds, 30000);
});

onUnmounted(() => {
  if (pollTimer) clearInterval(pollTimer);
});
</script>

<template>
  <div class="home">
    <div class="topbar">
      <div>
        <div class="greet">嗨，{{ auth.user?.username }} 👋</div>
        <div class="greet-sub">今天想怎么决定？</div>
      </div>
      <button class="logout-btn" @click="logout">退出</button>
    </div>

    <div class="page">
      <!-- 功能 1：抽我的 -->
      <section class="feature-card card mine">
        <div class="feature-head">
          <span class="feature-emoji">🎲</span>
          <div>
            <div class="feature-title">抽我自己的</div>
            <div class="feature-desc">从你的餐库随机抽一道</div>
          </div>
        </div>

        <div class="type-picker">
          <button class="pick-chip" :class="{ active: myPickType === '' }" @click="myPickType = ''">🍽️ 全部</button>
          <button
            v-for="t in MEAL_TYPE_LIST"
            :key="t.key"
            class="pick-chip"
            :class="{ active: myPickType === t.key }"
            @click="myPickType = t.key"
          >{{ t.emoji }} {{ t.label }}</button>
        </div>

        <div v-if="myLoading" class="result-box loading">
          <span class="spin-emoji">🍽️</span>
          <div class="loading-text">转动中…</div>
        </div>
        <div v-else-if="myResult" :key="myResult.id" class="result-box result-anim">
          <span class="result-emoji">{{ mealEmoji(myResult) }}</span>
          <div class="result-name">{{ myResult.name }}</div>
          <div class="result-type">{{ getMealType(myResult.meal_type).label }}</div>
          <div v-if="myResult.note" class="result-note">📝 {{ myResult.note }}</div>
          <div v-if="myResult.tags && myResult.tags.length" class="result-tags">
            <TagBadge v-for="t in myResult.tags" :key="t" :tag="t" size="xs" />
          </div>
        </div>
        <div v-else class="result-box placeholder">
          <span class="placeholder-emoji">🤔</span>
          <div>点下方按钮，看看今天吃啥</div>
        </div>
        <div class="feature-actions">
          <div class="btn-row">
            <button class="btn" :disabled="myLoading" @click="pickMine">
              {{ myResult ? '🎲 换一个' : '开始抽' }}
            </button>
            <button v-if="myResult" class="btn btn-ghost" :disabled="sharing" @click="shareResult(myResult)">📤</button>
          </div>
          <button class="link-btn" @click="router.push('/meals')">管理我的餐库 →</button>
        </div>
      </section>

      <!-- 功能 2：抽好友的 -->
      <section class="feature-card card friend">
        <div class="feature-head">
          <span class="feature-emoji">👥</span>
          <div>
            <div class="feature-title">抽好友的</div>
            <div class="feature-desc">吃腻自己的？试试朋友的</div>
          </div>
        </div>
        <div v-if="friends.length === 0" class="no-friend">
          <EmptyState emoji="🤝" text="还没有好友，去添加一位吧" />
          <button class="link-btn" @click="router.push('/friends/list')">去添加好友 →</button>
        </div>
        <div v-else>
          <div class="friend-select">
            <label class="input-label">选好友</label>
            <select v-model="selectedFriend" class="input">
              <option :value="null" disabled>请选择…</option>
              <option v-for="f in friends" :key="f.user_id" :value="f.user_id">{{ f.username }}</option>
            </select>
          </div>

          <div class="type-picker">
            <button class="pick-chip" :class="{ active: friendPickType === '' }" @click="friendPickType = ''">🍽️ 全部</button>
            <button
              v-for="t in MEAL_TYPE_LIST"
              :key="t.key"
              class="pick-chip"
              :class="{ active: friendPickType === t.key }"
              @click="friendPickType = t.key"
            >{{ t.emoji }} {{ t.label }}</button>
          </div>

          <div v-if="friendLoading" class="result-box loading">
            <span class="spin-emoji">🍽️</span>
            <div class="loading-text">转动中…</div>
          </div>
          <div v-else-if="friendResult" :key="friendResult.meal.id" class="result-box result-anim">
            <span class="result-emoji">{{ mealEmoji(friendResult.meal) }}</span>
            <div class="result-name">{{ friendResult.meal.name }}</div>
            <div class="result-from">来自 {{ friendResult.friend.username }} 的餐库</div>
            <div v-if="friendResult.meal.note" class="result-note">📝 {{ friendResult.meal.note }}</div>
            <div v-if="friendResult.meal.tags && friendResult.meal.tags.length" class="result-tags">
              <TagBadge v-for="t in friendResult.meal.tags" :key="t" :tag="t" size="xs" />
            </div>
          </div>
          <div v-else class="result-box placeholder">
            <span class="placeholder-emoji">😋</span>
            <div>从好友餐库随机抽一道</div>
          </div>
          <div class="btn-row">
            <button
              class="btn btn-ghost"
              :disabled="!selectedFriend || friendLoading"
              @click="pickFriend"
            >
              {{ friendResult ? '🎲 换一个' : '开始抽' }}
            </button>
            <button v-if="friendResult" class="btn btn-ghost" :disabled="sharing" @click="shareResult(friendResult.meal, friendResult.friend.username)">📤</button>
          </div>
        </div>
      </section>

      <!-- 抽奖历史 -->
      <section v-if="history.length > 0" class="feature-card card history-card">
        <div class="feature-head">
          <span class="feature-emoji">📜</span>
          <div class="feed-text">
            <div class="feature-title">最近抽过</div>
            <div class="feature-desc">{{ history.length }} 条记录</div>
          </div>
          <button class="clear-history" @click="clearHistory">清空</button>
        </div>
        <div class="history-list">
          <div v-for="h in history" :key="h.id" class="history-item">
            <span class="h-emoji">{{ h.emoji || DEFAULT_EMOJI[h.meal_type] || '🍽️' }}</span>
            <div class="h-info">
              <div class="h-name">{{ h.meal_name }}</div>
              <div class="h-time">{{ timeAgo(h.picked_at) }}</div>
            </div>
            <span v-if="h.source === 'friend'" class="h-source">好友</span>
          </div>
        </div>
      </section>

      <!-- 功能 3：投喂 -->
      <section class="feature-card card feed" @click="router.push('/feeds')">
        <div class="feature-head">
          <span class="feature-emoji">📨</span>
          <div class="feed-text">
            <div class="feature-title">看投喂</div>
            <div class="feature-desc">好友指定你今天吃什么</div>
          </div>
          <span v-if="pendingFeeds > 0" class="badge">{{ pendingFeeds }}</span>
          <span class="arrow">›</span>
        </div>
      </section>
    </div>
  </div>
</template>

<style scoped>
.greet { font-size: 18px; font-weight: 700; }
.greet-sub { font-size: 12px; color: var(--text-light); margin-top: 2px; }
.logout-btn {
  padding: 6px 14px; border-radius: 20px;
  background: var(--primary-soft); color: var(--primary-dark);
  font-size: 13px; font-weight: 500; transition: transform 0.1s;
}
.logout-btn:active { transform: scale(0.95); }
.feature-card { margin-bottom: 16px; padding: 20px; }
.feature-card.feed { cursor: pointer; transition: transform 0.15s, box-shadow 0.15s; }
.feature-card.feed:hover { transform: translateY(-2px); box-shadow: var(--shadow-lg); }
.feature-card.feed:active { transform: scale(0.98); }
.feature-head { display: flex; align-items: center; gap: 12px; margin-bottom: 16px; }
.feature-emoji { font-size: 32px; }
.feature-title { font-size: 17px; font-weight: 700; }
.feature-desc { font-size: 12px; color: var(--text-light); margin-top: 2px; }
.feed-text { flex: 1; }

.type-picker {
  display: flex; gap: 6px; margin-bottom: 14px;
  overflow-x: auto; -webkit-overflow-scrolling: touch;
  scrollbar-width: none; padding-bottom: 2px;
}
.type-picker::-webkit-scrollbar { display: none; }
.pick-chip {
  flex-shrink: 0; padding: 7px 12px; border-radius: 20px;
  background: var(--primary-soft); color: var(--text-light);
  font-size: 12px; font-weight: 600; white-space: nowrap; transition: all 0.15s;
}
.pick-chip.active {
  background: var(--primary); color: #fff;
  box-shadow: 0 2px 6px rgba(249, 115, 22, 0.3);
}
.pick-chip:active { transform: scale(0.93); }

.result-box {
  background: var(--primary-soft); border-radius: 14px;
  padding: 24px 16px; text-align: center; margin-bottom: 14px;
  min-height: 120px; display: flex; flex-direction: column;
  align-items: center; justify-content: center; gap: 4px;
}
.result-box.placeholder { color: var(--text-light); font-size: 14px; }
.placeholder-emoji { font-size: 36px; margin-bottom: 4px; opacity: 0.7; }
.result-box.loading { color: var(--primary-dark); font-weight: 600; }
.loading-text { margin-top: 6px; font-size: 14px; }
.result-emoji { font-size: 48px; display: block; margin-bottom: 8px; }
.result-name { font-size: 22px; font-weight: 800; color: var(--primary-dark); }
.result-type, .result-from { font-size: 12px; color: var(--text-light); margin-top: 4px; }
.result-note {
  font-size: 12px; color: var(--text-light); margin-top: 6px;
  max-width: 90%; line-height: 1.4;
}
.result-tags {
  display: flex; flex-wrap: wrap; gap: 4px; justify-content: center; margin-top: 8px;
}

.feature-actions { display: flex; flex-direction: column; gap: 8px; }
.btn-row { display: flex; gap: 8px; }
.btn-row .btn { flex: 1; }
.link-btn {
  background: none; color: var(--primary); font-size: 13px;
  padding: 4px; font-weight: 500;
}
.friend-select { margin-bottom: 12px; }
.no-friend { text-align: center; }

/* 抽奖历史 */
.history-card { padding: 16px 20px; }
.clear-history {
  font-size: 12px; color: var(--text-light);
  padding: 4px 10px; border-radius: 12px;
  background: var(--bg-card);
}
.history-list {
  display: flex; flex-direction: column; gap: 10px;
}
.history-item {
  display: flex; align-items: center; gap: 10px;
  padding: 8px 0;
  border-bottom: 1px solid var(--border);
}
.history-item:last-child { border-bottom: none; }
.h-emoji { font-size: 22px; }
.h-info { flex: 1; min-width: 0; }
.h-name {
  font-size: 14px; font-weight: 600;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.h-time { font-size: 11px; color: var(--text-light); margin-top: 1px; }
.h-source {
  font-size: 10px; padding: 2px 6px; border-radius: 8px;
  background: var(--primary-soft); color: var(--primary-dark); font-weight: 600;
}

.badge {
  background: var(--danger); color: #fff; font-size: 12px;
  min-width: 22px; height: 22px; border-radius: 11px;
  display: inline-flex; align-items: center; justify-content: center;
  padding: 0 6px; font-weight: 700;
  box-shadow: 0 2px 6px rgba(239, 68, 68, 0.3);
}
.arrow { font-size: 24px; color: var(--text-light); }
.feed .feature-head { margin-bottom: 0; }
</style>
