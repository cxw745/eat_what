<script setup>
import { ref, computed, onMounted, onUnmounted, onActivated } from 'vue';
import { useRoute } from 'vue-router';
import http from '../api/index.js';
import EmptyState from '../components/EmptyState.vue';
import { useToast } from '../composables/useToast.js';
import { getMealType, MEAL_TYPE_LIST } from '../constants/meal.js';

defineOptions({ name: 'FeedInbox' });

const route = useRoute();
const { show: showToast } = useToast();

const feeds = ref([]);
const friends = ref([]);
const loading = ref(false);
const processingIds = ref(new Set());

// 投喂表单
const showSend = ref(false);
const sendTo = ref('');
const sendMealName = ref('');
const sendMealType = ref('');
const sendMessage = ref('');
const sending = ref(false);

let pollTimer = null;

const pending = computed(() => feeds.value.filter((f) => f.status === 'pending'));
const handled = computed(() => feeds.value.filter((f) => f.status !== 'pending'));

// 兼容 Safari：把 "YYYY-MM-DD HH:MM:SS" 转 "YYYY-MM-DDTHH:MM:SSZ"
function timeAgo(ts) {
  if (!ts) return '';
  const date = new Date(String(ts).replace(' ', 'T') + 'Z');
  if (isNaN(date.getTime())) return ts;
  const d = Math.floor((Date.now() - date.getTime()) / 1000);
  if (d < 60) return '刚刚';
  if (d < 3600) return Math.floor(d / 60) + ' 分钟前';
  if (d < 86400) return Math.floor(d / 3600) + ' 小时前';
  if (d < 604800) return Math.floor(d / 86400) + ' 天前';
  return String(ts).slice(0, 10);
}

async function load() {
  loading.value = true;
  try {
    const [feedData, friendData] = await Promise.all([
      http.get('/feeds', { params: { limit: 50 } }),
      http.get('/friends'),
    ]);
    feeds.value = feedData.feeds;
    friends.value = [...friendData.outgoing, ...friendData.incoming].filter((f) => f.status === 'accepted');
    // 校验 route.query.to 是否在好友列表中，存在才回填
    if (route.query.to && friends.value.some((f) => f.username === route.query.to)) {
      sendTo.value = route.query.to;
      showSend.value = true;
    }
  } catch (e) {
    showToast(e.message);
  } finally {
    loading.value = false;
  }
}

async function updateStatus(feed, status) {
  if (processingIds.value.has(feed.id)) return;
  processingIds.value.add(feed.id);
  try {
    await http.patch(`/feeds/${feed.id}`, { status });
    feed.status = status;
    showToast(status === 'eaten' ? '已标记为照吃 ✅' : '已标记为不吃');
  } catch (e) {
    showToast(e.message);
  } finally {
    processingIds.value.delete(feed.id);
  }
}

async function deleteFeed(feed) {
  if (processingIds.value.has(feed.id)) return;
  if (!confirm('确定删除这条投喂记录？')) return;
  processingIds.value.add(feed.id);
  try {
    await http.delete(`/feeds/${feed.id}`);
    feeds.value = feeds.value.filter((f) => f.id !== feed.id);
    showToast('已删除');
  } catch (e) {
    showToast(e.message);
  } finally {
    processingIds.value.delete(feed.id);
  }
}

async function sendFeed() {
  if (sending.value) return;
  if (!sendTo.value) {
    showToast('请选择好友');
    return;
  }
  if (!sendMealName.value.trim()) {
    showToast('请指定要投喂的菜');
    return;
  }
  sending.value = true;
  try {
    await http.post('/feeds', {
      to_username: sendTo.value,
      meal_name: sendMealName.value.trim(),
      meal_type: sendMealType.value || undefined,
      message: sendMessage.value.trim(),
    });
    showToast('投喂成功！');
    sendMealName.value = '';
    sendMessage.value = '';
    sendMealType.value = '';
    showSend.value = false;
  } catch (e) {
    showToast(e.message);
  } finally {
    sending.value = false;
  }
}

onMounted(() => {
  load();
  // 每 30 秒轮询投喂列表
  pollTimer = setInterval(load, 30000);
});

onActivated(() => {
  // keep-alive 重新激活时刷新
  load();
});

onUnmounted(() => {
  if (pollTimer) clearInterval(pollTimer);
});
</script>

<template>
  <div>
    <div class="topbar">
      <div class="topbar-title">投喂箱</div>
      <button class="send-btn" @click="showSend = !showSend">
        {{ showSend ? '收起' : '投喂好友' }}
      </button>
    </div>

    <div class="page">
      <!-- 投喂表单 -->
      <transition name="fade">
        <div v-if="showSend" class="send-card card">
          <div class="input-group">
            <label class="input-label">投喂给</label>
            <select v-model="sendTo" class="input">
              <option value="" disabled>选择好友…</option>
              <option v-for="f in friends" :key="f.id" :value="f.username">{{ f.username }}</option>
            </select>
          </div>
          <div v-if="friends.length === 0" class="hint">还没有好友，先去添加一位吧</div>
          <template v-else>
            <div class="input-group">
              <label class="input-label">指定吃什么</label>
              <input v-model="sendMealName" class="input" placeholder="例如：黄焖鸡米饭" maxlength="30" />
            </div>
            <div class="input-group">
              <label class="input-label">餐类（可选）</label>
              <div class="type-row">
                <button
                  v-for="t in MEAL_TYPE_LIST"
                  :key="t.key"
                  class="type-chip"
                  :class="{ active: sendMealType === t.key }"
                  @click="sendMealType = sendMealType === t.key ? '' : t.key"
                >{{ t.emoji }} {{ t.label }}</button>
              </div>
            </div>
            <div class="input-group">
              <label class="input-label">留言（可选）</label>
              <input v-model="sendMessage" class="input" placeholder="说点什么…" maxlength="50" />
            </div>
            <button class="btn btn-block" :disabled="sending" @click="sendFeed">
              {{ sending ? '发送中…' : '发送投喂' }}
            </button>
          </template>
        </div>
      </transition>

      <!-- 待处理投喂 -->
      <section v-if="pending.length > 0">
        <div class="section-title">待处理 ({{ pending.length }})</div>
        <div v-for="f in pending" :key="f.id" class="feed-card card pending">
          <div class="feed-head">
            <div class="feed-avatar">{{ f.from_username?.charAt(0).toUpperCase() || '?' }}</div>
            <div class="feed-info">
              <div class="feed-from">{{ f.from_username }} 投喂你</div>
              <div class="feed-time">{{ timeAgo(f.created_at) }}</div>
            </div>
            <button
              class="feed-del"
              :disabled="processingIds.has(f.id)"
              @click="deleteFeed(f)"
            >✕</button>
          </div>
          <div class="feed-meal">
            <span class="meal-emoji">{{ getMealType(f.meal_type).emoji }}</span>
            <div>
              <div class="meal-name">{{ f.meal_name }}</div>
              <div v-if="f.meal_type" class="meal-type">{{ getMealType(f.meal_type).label }}</div>
            </div>
          </div>
          <div v-if="f.message" class="feed-msg">"{{ f.message }}"</div>
          <div class="feed-actions">
            <button
              class="btn btn-sm"
              :disabled="processingIds.has(f.id)"
              @click="updateStatus(f, 'eaten')"
            >照吃 ✅</button>
            <button
              class="btn btn-sm btn-ghost"
              :disabled="processingIds.has(f.id)"
              @click="updateStatus(f, 'skipped')"
            >不吃 ❌</button>
          </div>
        </div>
      </section>

      <!-- 已处理 -->
      <section v-if="handled.length > 0">
        <div class="section-title">已处理</div>
        <div v-for="f in handled" :key="f.id" class="feed-card card handled">
          <div class="feed-head">
            <div class="feed-avatar">{{ f.from_username?.charAt(0).toUpperCase() || '?' }}</div>
            <div class="feed-info">
              <div class="feed-from">{{ f.from_username }} 投喂你</div>
              <div class="feed-time">{{ timeAgo(f.created_at) }}</div>
            </div>
            <span class="status-tag" :class="f.status">{{ f.status === 'eaten' ? '已吃' : '没吃' }}</span>
          </div>
          <div class="feed-meal">
            <span class="meal-emoji">{{ getMealType(f.meal_type).emoji }}</span>
            <div class="meal-name">{{ f.meal_name }}</div>
          </div>
          <div v-if="f.message" class="feed-msg">"{{ f.message }}"</div>
          <button
            class="del-text-btn"
            :disabled="processingIds.has(f.id)"
            @click="deleteFeed(f)"
          >🗑️ 删除记录</button>
        </div>
      </section>

      <!-- 加载骨架 -->
      <div v-if="loading && feeds.length === 0" class="skeleton-list">
        <div v-for="i in 2" :key="i" class="skeleton skeleton-feed"></div>
      </div>

      <!-- 空状态 -->
      <EmptyState
        v-if="!loading && feeds.length === 0 && !showSend"
        emoji="📭"
        text="还没有人投喂你，点右上角投喂好友试试"
      />
    </div>
  </div>
</template>

<style scoped>
.send-btn {
  padding: 6px 14px;
  border-radius: 20px;
  background: var(--primary);
  color: #fff;
  font-size: 13px;
  font-weight: 600;
  box-shadow: 0 2px 6px rgba(249, 115, 22, 0.25);
  transition: transform 0.1s;
}
.send-btn:active {
  transform: scale(0.95);
}
.send-card {
  margin-bottom: 20px;
  animation: card-slide 0.3s ease;
}
@keyframes card-slide {
  from { opacity: 0; transform: translateY(-8px); }
  to { opacity: 1; transform: translateY(0); }
}
.hint {
  color: var(--text-light);
  font-size: 13px;
  text-align: center;
  padding: 10px;
}
.type-row {
  display: flex;
  gap: 8px;
}
.type-chip {
  flex: 1;
  padding: 8px;
  border-radius: 10px;
  background: var(--primary-soft);
  color: var(--text-light);
  font-size: 13px;
  font-weight: 600;
  transition: all 0.15s;
}
.type-chip.active {
  background: var(--primary);
  color: #fff;
}
.section-title {
  font-size: 13px;
  color: var(--text-light);
  font-weight: 600;
  margin: 20px 0 10px;
}
.feed-card {
  margin-bottom: 12px;
  padding: 14px;
  transition: transform 0.15s;
}
.feed-card:active {
  transform: scale(0.98);
}
.feed-card.pending {
  border-left: 3px solid var(--primary);
}
.feed-head {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 12px;
}
.feed-info {
  flex: 1;
  min-width: 0;
}
.feed-avatar {
  width: 34px;
  height: 34px;
  border-radius: 50%;
  background: var(--primary-soft);
  color: var(--primary-dark);
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  font-size: 15px;
  flex-shrink: 0;
}
.feed-from {
  font-weight: 600;
  font-size: 14px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.feed-time {
  font-size: 11px;
  color: var(--text-light);
  margin-top: 1px;
}
.feed-meal {
  display: flex;
  align-items: center;
  gap: 10px;
  background: var(--primary-soft);
  border-radius: 10px;
  padding: 12px;
  margin-bottom: 10px;
}
.meal-emoji {
  font-size: 28px;
  flex-shrink: 0;
}
.meal-name {
  font-weight: 700;
  font-size: 16px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.meal-type {
  font-size: 11px;
  color: var(--text-light);
  margin-top: 2px;
}
.feed-msg {
  font-size: 13px;
  color: var(--text-light);
  font-style: italic;
  margin-bottom: 10px;
  padding: 0 2px;
}
.feed-actions {
  display: flex;
  gap: 8px;
}
.feed-actions .btn {
  flex: 1;
}
.status-tag {
  font-size: 11px;
  padding: 3px 10px;
  border-radius: 10px;
  font-weight: 600;
  flex-shrink: 0;
}
.status-tag.eaten {
  background: #dcfce7;
  color: #16a34a;
}
.status-tag.skipped {
  background: var(--primary-soft);
  color: var(--text-light);
}
.feed-del {
  width: 26px;
  height: 26px;
  border-radius: 50%;
  background: var(--bg-card);
  color: var(--text-light);
  font-size: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  transition: all 0.15s;
}
.feed-del:active {
  background: var(--danger);
  color: #fff;
}
.feed-del:disabled {
  opacity: 0.5;
}
.del-text-btn {
  width: 100%;
  margin-top: 8px;
  padding: 8px;
  border-radius: 10px;
  background: var(--bg-card);
  color: var(--text-light);
  font-size: 13px;
  font-weight: 500;
  transition: all 0.15s;
}
.del-text-btn:active {
  background: var(--danger);
  color: #fff;
}
.del-text-btn:disabled {
  opacity: 0.5;
}
.skeleton-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.skeleton-feed {
  height: 160px;
}
</style>
