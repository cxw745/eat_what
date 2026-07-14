<script setup>
import { ref, computed, onMounted, onActivated } from 'vue';
import { useRouter } from 'vue-router';
import http from '../api/index.js';
import { useToast } from '../composables/useToast.js';
import EmptyState from '../components/EmptyState.vue';

defineOptions({ name: 'Friends' });

const router = useRouter();
const { show: showToast } = useToast();

const friends = ref([]);
const pendingIncoming = ref([]);
const pendingOutgoing = ref([]);
const loading = ref(false);

// 添加好友
const showAdd = ref(false);
const searchUsername = ref('');
const searching = ref(false);

async function load() {
  loading.value = true;
  try {
    const data = await http.get('/friends');
    friends.value = [...data.outgoing, ...data.incoming].filter((f) => f.status === 'accepted');
    pendingIncoming.value = data.incoming.filter((f) => f.status === 'pending');
    pendingOutgoing.value = data.outgoing.filter((f) => f.status === 'pending');
  } catch (e) {
    showToast(e.message);
  } finally {
    loading.value = false;
  }
}

async function sendRequest() {
  if (!searchUsername.value.trim()) return;
  searching.value = true;
  try {
    await http.post('/friends', { username: searchUsername.value.trim() });
    showToast('请求已发送');
    searchUsername.value = '';
    showAdd.value = false;
    load();
  } catch (e) {
    showToast(e.message);
  } finally {
    searching.value = false;
  }
}

async function accept(f) {
  try {
    await http.post(`/friends/${f.id}/accept`);
    showToast('已添加好友');
    load();
  } catch (e) {
    showToast(e.message);
  }
}

async function reject(f) {
  if (!confirm('确定拒绝？')) return;
  try {
    await http.delete(`/friends/${f.id}`);
    load();
  } catch (e) {
    showToast(e.message);
  }
}

function goProfile(username) {
  router.push(`/friends/list/${username}`);
}

function goMoments() {
  router.push('/friends/moments');
}

onMounted(load);
onActivated(load);
</script>

<template>
  <div>
    <div class="topbar">
      <button class="back-btn" @click="goMoments">‹</button>
      <div class="topbar-title">好友列表</div>
      <button class="icon-btn" @click="showAdd = true">+ 添加</button>
    </div>

    <div class="page">
      <div v-if="loading && friends.length === 0" class="skeleton-list">
        <div v-for="i in 3" :key="i" class="skeleton skeleton-friend"></div>
      </div>

      <!-- 收到的请求 -->
      <div v-if="pendingIncoming.length > 0" class="section">
        <div class="section-title">新的好友请求</div>
        <div v-for="f in pendingIncoming" :key="f.id" class="friend-card card">
          <div class="avatar">{{ f.username.charAt(0).toUpperCase() }}</div>
          <div class="f-name">{{ f.username }}</div>
          <div class="f-ops">
            <button class="op accept" @click="accept(f)">接受</button>
            <button class="op reject" @click="reject(f)">拒绝</button>
          </div>
        </div>
      </div>

      <!-- 已发出的请求 -->
      <div v-if="pendingOutgoing.length > 0" class="section">
        <div class="section-title">等待验证</div>
        <div v-for="f in pendingOutgoing" :key="f.id" class="friend-card card">
          <div class="avatar">{{ f.username.charAt(0).toUpperCase() }}</div>
          <div class="f-name">{{ f.username }}</div>
          <div class="f-ops">
            <span class="pending-text">等待对方同意</span>
          </div>
        </div>
      </div>

      <!-- 好友列表 -->
      <div v-if="friends.length === 0 && !loading" class="section">
        <EmptyState emoji="🤝" text="还没有好友，去添加一位吧" />
      </div>
      <div v-else class="section">
        <div class="section-title">我的好友 ({{ friends.length }})</div>
        <div
          v-for="f in friends"
          :key="f.id"
          class="friend-card card"
          @click="goProfile(f.username)"
        >
          <div class="avatar">{{ f.username.charAt(0).toUpperCase() }}</div>
          <div class="f-name">{{ f.username }}</div>
          <span class="arrow">›</span>
        </div>
      </div>
    </div>

    <!-- 添加好友弹窗 -->
    <transition name="fade">
      <div v-if="showAdd" class="modal-mask" @click.self="showAdd = false">
        <div class="modal card">
          <div class="modal-head">
            <span class="m-title">添加好友</span>
            <button class="close-btn" @click="showAdd = false">✕</button>
          </div>
          <div class="modal-body">
            <input
              v-model="searchUsername"
              class="input"
              placeholder="输入用户名"
              maxlength="20"
              @keyup.enter="sendRequest"
            />
            <p class="hint">输入对方的用户名，发送好友请求</p>
          </div>
          <button class="btn btn-block" :disabled="searching || !searchUsername.trim()" @click="sendRequest">
            {{ searching ? '发送中…' : '发送请求' }}
          </button>
        </div>
      </div>
    </transition>
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
.icon-btn {
  padding: 6px 12px;
  border-radius: 16px;
  background: var(--primary);
  color: #fff;
  font-size: 13px;
  font-weight: 600;
}
.section {
  margin-bottom: 20px;
}
.section-title {
  font-size: 13px;
  font-weight: 700;
  color: var(--text-light);
  margin-bottom: 10px;
  padding-left: 4px;
}
.skeleton-friend {
  height: 64px;
  margin-bottom: 10px;
}
.friend-card {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 16px;
  margin-bottom: 8px;
  transition: transform 0.15s;
}
.friend-card:active {
  transform: scale(0.98);
}
.avatar {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: linear-gradient(135deg, var(--primary), var(--primary-dark));
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  font-size: 18px;
  flex-shrink: 0;
}
.f-name {
  flex: 1;
  font-weight: 600;
  font-size: 16px;
}
.f-ops {
  display: flex;
  gap: 6px;
}
.op {
  padding: 6px 12px;
  border-radius: 14px;
  font-size: 12px;
  font-weight: 600;
}
.op.accept {
  background: var(--primary);
  color: #fff;
}
.op.reject {
  background: var(--bg-card);
  color: var(--text-light);
}
.pending-text {
  font-size: 12px;
  color: var(--text-light);
}
.arrow {
  font-size: 22px;
  color: var(--text-light);
}
.modal-mask {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.45);
  z-index: 200;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
}
.modal {
  width: 100%;
  max-width: 360px;
  border-radius: 16px;
  padding: 20px;
  animation: pop 0.2s ease;
}
@keyframes pop {
  from { transform: scale(0.9); opacity: 0; }
  to { transform: scale(1); opacity: 1; }
}
.modal-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 14px;
}
.m-title {
  font-size: 17px;
  font-weight: 700;
}
.close-btn {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: var(--primary-soft);
  color: var(--text-light);
  font-size: 13px;
  display: flex;
  align-items: center;
  justify-content: center;
}
.modal-body {
  margin-bottom: 16px;
}
.hint {
  font-size: 12px;
  color: var(--text-light);
  margin-top: 8px;
}
</style>
