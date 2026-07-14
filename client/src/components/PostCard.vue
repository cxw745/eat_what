<script setup>
import { ref, computed } from 'vue';
import http, { assetUrl } from '../api/index.js';
import { useToast } from '../composables/useToast.js';
import TagBadge from './TagBadge.vue';
import { getMealType } from '../constants/meal.js';

const props = defineProps({
  post: { type: Object, required: true },
  currentUsername: { type: String, default: '' },
});
const emit = defineEmits(['click-user', 'deleted']);

const { show: showToast } = useToast();
const showComments = ref(false);
const comments = ref([]);
const loadingComments = ref(false);
const newComment = ref('');
const liking = ref(false);
const picking = ref(false);

const isOwn = computed(() => props.post.username === props.currentUsername);
// 图片 URL 补全（后端可能返回相对路径）
const images = computed(() => (props.post.images || []).map((u) => assetUrl(u)));
const meal = computed(() => props.post.meal || null);
// 抽同款仅对好友动态（非自己）且关联了菜品时显示
const canPickSame = computed(() => !isOwn.value && meal.value && meal.value.id);
// 图片网格布局
const imageLayout = computed(() => {
  const n = images.value.length;
  if (n === 1) return 'single';
  if (n === 2) return 'double';
  if (n === 4) return 'quad';
  return 'triple';
});

function timeAgo(dateStr) {
  if (!dateStr) return '';
  const date = new Date(typeof dateStr === 'string' ? dateStr.replace(' ', 'T') : dateStr);
  const diff = (Date.now() - date.getTime()) / 1000;
  if (diff < 60) return '刚刚';
  if (diff < 3600) return `${Math.floor(diff / 60)}分钟前`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}小时前`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}天前`;
  return date.toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric' });
}

async function toggleLike() {
  if (liking.value) return;
  liking.value = true;
  const wasLiked = props.post.liked;
  // 乐观更新
  props.post.liked = !wasLiked;
  props.post.like_count += wasLiked ? -1 : 1;
  try {
    if (wasLiked) {
      await http.delete(`/posts/${props.post.id}/like`);
    } else {
      await http.post(`/posts/${props.post.id}/like`);
    }
  } catch (e) {
    // 回滚
    props.post.liked = wasLiked;
    props.post.like_count += wasLiked ? 1 : -1;
    showToast(e.message);
  } finally {
    liking.value = false;
  }
}

async function loadComments() {
  loadingComments.value = true;
  try {
    const data = await http.get(`/posts/${props.post.id}/comments`);
    comments.value = data.comments;
  } catch (e) {
    showToast(e.message);
  } finally {
    loadingComments.value = false;
  }
}

function toggleComments() {
  showComments.value = !showComments.value;
  if (showComments.value && comments.value.length === 0) {
    loadComments();
  }
}

async function sendComment() {
  const text = newComment.value.trim();
  if (!text) return;
  try {
    const data = await http.post(`/posts/${props.post.id}/comments`, { content: text });
    comments.value.push(data.comment);
    props.post.comment_count = (props.post.comment_count || 0) + 1;
    newComment.value = '';
  } catch (e) {
    showToast(e.message);
  }
}

async function deleteComment(c) {
  if (!confirm('删除这条评论？')) return;
  try {
    await http.delete(`/posts/${props.post.id}/comments/${c.id}`);
    comments.value = comments.value.filter((x) => x.id !== c.id);
    props.post.comment_count = Math.max(0, (props.post.comment_count || 0) - 1);
    showToast('已删除');
  } catch (e) {
    showToast(e.message);
  }
}

async function deletePost() {
  if (!confirm('确定删除这条动态？')) return;
  try {
    await http.delete(`/posts/${props.post.id}`);
    emit('deleted', props.post.id);
    showToast('已删除');
  } catch (e) {
    showToast(e.message);
  }
}

function mealEmoji(m) {
  if (!m) return '🍽️';
  return m.emoji || getMealType(m.meal_type).emoji;
}

async function pickSame() {
  if (picking.value || !meal.value) return;
  picking.value = true;
  try {
    await http.post('/history', { meal_id: meal.value.id });
    showToast(`已记录：今天和 ${props.post.username} 吃同款 — ${meal.value.name}`);
  } catch (e) {
    showToast(e.message);
  } finally {
    picking.value = false;
  }
}

// 图片预览
const previewIndex = ref(-1);
function previewImage(i) {
  previewIndex.value = i;
}
function closePreview() {
  previewIndex.value = -1;
}

function onClickUser() {
  emit('click-user', props.post.username);
}
</script>

<template>
  <div class="post-card card">
    <!-- 作者 -->
    <div class="post-head">
      <div class="avatar" @click="onClickUser">{{ post.username.charAt(0).toUpperCase() }}</div>
      <div class="head-info" @click="onClickUser">
        <div class="username">{{ post.username }}</div>
        <div class="time">{{ timeAgo(post.created_at) }}</div>
      </div>
      <button v-if="isOwn" class="del-btn" @click="deletePost">删除</button>
    </div>

    <!-- 文字 -->
    <div v-if="post.content" class="post-content">{{ post.content }}</div>

    <!-- 关联菜品 -->
    <div v-if="meal" class="post-meal">
      <span class="pm-emoji">{{ mealEmoji(meal) }}</span>
      <div class="pm-info">
        <div class="pm-name">{{ meal.name }}</div>
        <div class="pm-type">{{ getMealType(meal.meal_type).label }}<span v-if="meal.note"> · 📝 {{ meal.note }}</span></div>
        <div v-if="meal.tags && meal.tags.length" class="pm-tags">
          <TagBadge v-for="t in meal.tags" :key="t" :tag="t" size="xs" />
        </div>
      </div>
      <button v-if="canPickSame" class="pick-same-btn" :disabled="picking" @click="pickSame">
        🎲 抽同款
      </button>
    </div>

    <!-- 图片 -->
    <div v-if="images.length" class="post-images" :class="imageLayout">
      <img
        v-for="(img, i) in images"
        :key="i"
        :src="img"
        class="post-img"
        loading="lazy"
        @click="previewImage(i)"
      />
    </div>

    <!-- 互动 -->
    <div class="post-actions">
      <button class="action-btn" :class="{ liked: post.liked }" @click="toggleLike">
        <span class="icon">{{ post.liked ? '❤️' : '🤍' }}</span>
        <span v-if="post.like_count > 0">{{ post.like_count }}</span>
      </button>
      <button class="action-btn" @click="toggleComments">
        <span class="icon">💬</span>
        <span v-if="post.comment_count > 0">{{ post.comment_count }}</span>
      </button>
    </div>

    <!-- 评论列表 -->
    <transition name="expand">
      <div v-if="showComments" class="comment-section">
        <div v-if="loadingComments" class="loading-text">加载中…</div>
        <div v-else-if="comments.length === 0" class="empty-comment">还没有评论，说点什么</div>
        <div v-else class="comment-list">
          <div v-for="c in comments" :key="c.id" class="comment-item">
            <span class="c-user" @click="$emit('click-user', c.username)">{{ c.username }}:</span>
            <span class="c-text">{{ c.content }}</span>
            <button
              v-if="c.username === currentUsername"
              class="c-del"
              @click="deleteComment(c)"
            >删除</button>
          </div>
        </div>
        <div class="comment-input">
          <input
            v-model="newComment"
            class="c-input"
            placeholder="写评论…"
            maxlength="100"
            @keyup.enter="sendComment"
          />
          <button class="c-send" :disabled="!newComment.trim()" @click="sendComment">发送</button>
        </div>
      </div>
    </transition>

    <!-- 图片预览 -->
    <transition name="fade">
      <div v-if="previewIndex >= 0" class="image-preview" @click="closePreview">
        <img :src="images[previewIndex]" class="preview-img" />
      </div>
    </transition>
  </div>
</template>

<style scoped>
.post-card {
  margin-bottom: 12px;
  padding: 16px;
}
.post-head {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 12px;
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
  cursor: pointer;
}
.head-info {
  flex: 1;
  cursor: pointer;
}
.username {
  font-weight: 600;
  font-size: 15px;
}
.time {
  font-size: 12px;
  color: var(--text-light);
  margin-top: 1px;
}
.del-btn {
  font-size: 12px;
  color: var(--text-light);
  padding: 4px 8px;
  border-radius: 6px;
  background: var(--bg-card);
}
.del-btn:active {
  background: var(--danger);
  color: #fff;
}
.post-content {
  font-size: 15px;
  line-height: 1.6;
  margin-bottom: 12px;
  white-space: pre-wrap;
  word-break: break-word;
}
.post-meal {
  display: flex;
  align-items: center;
  gap: 10px;
  background: var(--primary-soft);
  border-radius: 12px;
  padding: 12px;
  margin-bottom: 12px;
}
.pm-emoji {
  font-size: 32px;
  flex-shrink: 0;
}
.pm-info {
  flex: 1;
  min-width: 0;
}
.pm-name {
  font-size: 15px;
  font-weight: 700;
  color: var(--primary-dark);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.pm-type {
  font-size: 11px;
  color: var(--text-light);
  margin-top: 2px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.pm-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-top: 6px;
}
.pick-same-btn {
  flex-shrink: 0;
  padding: 8px 12px;
  border-radius: 16px;
  background: var(--primary);
  color: #fff;
  font-size: 12px;
  font-weight: 600;
  white-space: nowrap;
  box-shadow: 0 2px 6px rgba(249, 115, 22, 0.25);
  transition: transform 0.1s;
}
.pick-same-btn:active {
  transform: scale(0.94);
}
.pick-same-btn:disabled {
  opacity: 0.6;
}
.post-images {
  display: grid;
  gap: 4px;
  margin-bottom: 12px;
}
.post-images.single {
  grid-template-columns: 1fr;
}
.post-images.single .post-img {
  aspect-ratio: 4 / 3;
  border-radius: 10px;
}
.post-images.double {
  grid-template-columns: 1fr 1fr;
}
.post-images.triple {
  grid-template-columns: repeat(3, 1fr);
}
.post-images.quad {
  grid-template-columns: repeat(2, 1fr);
}
.post-img {
  width: 100%;
  aspect-ratio: 1;
  object-fit: cover;
  border-radius: 8px;
  cursor: pointer;
  background: var(--bg-card);
}
.post-images.single .post-img {
  aspect-ratio: 4 / 3;
}
.post-actions {
  display: flex;
  gap: 16px;
  padding-top: 8px;
  border-top: 1px solid var(--border);
}
.action-btn {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 13px;
  color: var(--text-light);
  font-weight: 500;
  padding: 4px 0;
}
.action-btn.liked {
  color: var(--danger);
}
.icon {
  font-size: 16px;
}

/* 评论 */
.comment-section {
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid var(--border);
}
.loading-text, .empty-comment {
  font-size: 13px;
  color: var(--text-light);
  text-align: center;
  padding: 8px 0;
}
.comment-list {
  margin-bottom: 10px;
}
.comment-item {
  font-size: 13px;
  line-height: 1.6;
  margin-bottom: 6px;
  display: flex;
  align-items: center;
  gap: 4px;
}
.c-user {
  color: var(--primary-dark);
  font-weight: 600;
  margin-right: 4px;
  cursor: pointer;
}
.c-text {
  color: var(--text);
  flex: 1;
}
.c-del {
  font-size: 11px;
  color: var(--text-light);
  padding: 2px 6px;
  border-radius: 4px;
  background: var(--bg-card);
  flex-shrink: 0;
}
.c-del:active {
  background: var(--danger);
  color: #fff;
}
.comment-input {
  display: flex;
  gap: 8px;
  align-items: center;
}
.c-input {
  flex: 1;
  padding: 8px 12px;
  border-radius: 18px;
  background: var(--bg-card);
  font-size: 13px;
}
.c-send {
  padding: 6px 14px;
  border-radius: 16px;
  background: var(--primary);
  color: #fff;
  font-size: 12px;
  font-weight: 600;
}
.c-send:disabled {
  opacity: 0.5;
}

/* 图片预览 */
.image-preview {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.9);
  z-index: 300;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
}
.preview-img {
  max-width: 100%;
  max-height: 100%;
  border-radius: 8px;
}

/* 动画 */
.expand-enter-active, .expand-leave-active {
  transition: all 0.2s ease;
  overflow: hidden;
}
.expand-enter-from, .expand-leave-to {
  opacity: 0;
  max-height: 0;
}
.fade-enter-active, .fade-leave-active {
  transition: opacity 0.2s;
}
.fade-enter-from, .fade-leave-to {
  opacity: 0;
}
</style>
