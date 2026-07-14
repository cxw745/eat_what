<script setup>
import { ref, computed, onMounted, onActivated, onDeactivated } from 'vue';
import { useRouter } from 'vue-router';
import http from '../api/index.js';
import { useAuthStore } from '../stores/auth.js';
import { useToast } from '../composables/useToast.js';
import { getMealType, MEAL_TYPE_LIST } from '../constants/meal.js';
import PostCard from '../components/PostCard.vue';
import EmptyState from '../components/EmptyState.vue';

defineOptions({ name: 'Moments' });

const router = useRouter();
const auth = useAuthStore();
const { show: showToast } = useToast();

const posts = ref([]);
const loading = ref(false);

// 发动态
const showComposer = ref(false);
const content = ref('');
const selectedFiles = ref([]);
const previewUrls = ref([]);
const publishing = ref(false);

// 关联菜品
const myMeals = ref([]);
const selectedMealId = ref('');
const mealsLoaded = ref(false);

// 按餐类分组的我的菜品，便于选择
const groupedMeals = computed(() => {
  return MEAL_TYPE_LIST.map((t) => ({
    ...t,
    meals: myMeals.value.filter((m) => m.meal_type === t.key),
  })).filter((g) => g.meals.length > 0);
});

async function loadMyMeals() {
  if (mealsLoaded.value) return;
  try {
    const data = await http.get('/meals');
    myMeals.value = data.meals;
    mealsLoaded.value = true;
  } catch (e) {
    /* 静默 */
  }
}

async function load() {
  loading.value = true;
  try {
    const data = await http.get('/posts');
    posts.value = data.posts;
  } catch (e) {
    showToast(e.message);
  } finally {
    loading.value = false;
  }
}

function openComposer() {
  showComposer.value = true;
  loadMyMeals();
}

function closeComposer() {
  showComposer.value = false;
  content.value = '';
  selectedFiles.value = [];
  previewUrls.value = [];
  selectedMealId.value = '';
}

function onFileChange(e) {
  const files = Array.from(e.target.files);
  const remaining = 3 - selectedFiles.value.length;
  if (files.length > remaining) {
    showToast(`最多 3 张，已选 ${selectedFiles.value.length} 张`);
  }
  const toAdd = files.slice(0, remaining);
  toAdd.forEach((f) => {
    if (!/jpeg|jpg|png|webp/i.test(f.type)) {
      showToast('仅支持 jpg/png/webp');
      return;
    }
    if (f.size > 5 * 1024 * 1024) {
      showToast(`${f.name} 超过 5MB`);
      return;
    }
    selectedFiles.value.push(f);
    previewUrls.value.push(URL.createObjectURL(f));
  });
  // 清空 input 值，允许重复选同一文件
  e.target.value = '';
}

function removeImage(i) {
  URL.revokeObjectURL(previewUrls.value[i]);
  selectedFiles.value.splice(i, 1);
  previewUrls.value.splice(i, 1);
}

async function publish() {
  if (publishing.value) return;
  if (!content.value.trim() && selectedFiles.value.length === 0 && !selectedMealId.value) {
    showToast('说点什么、传张图或选一道菜');
    return;
  }
  if (content.value.length > 200) {
    showToast('文字最多 200 字');
    return;
  }
  publishing.value = true;
  try {
    const fd = new FormData();
    fd.append('content', content.value.trim());
    if (selectedMealId.value) fd.append('meal_id', selectedMealId.value);
    selectedFiles.value.forEach((f) => fd.append('images', f));
    const data = await http.post('/posts', fd, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    posts.value.unshift(data.post);
    closeComposer();
    showToast('发布成功');
  } catch (e) {
    showToast(e.message);
  } finally {
    publishing.value = false;
  }
}

function clickUser(username) {
  if (username) {
    router.push(`/friends/list/${username}`);
  }
}

function onDeleted(id) {
  posts.value = posts.value.filter((p) => p.id !== id);
}

function goFriendList() {
  router.push('/friends/list');
}

onMounted(load);
onActivated(load);
</script>

<template>
  <div>
    <div class="topbar">
      <div class="topbar-title">朋友圈</div>
      <button class="icon-btn" @click="goFriendList">
        <span>👥</span>
        <span class="btn-label">好友</span>
      </button>
    </div>

    <div class="page">
      <div v-if="loading && posts.length === 0" class="skeleton-list">
        <div v-for="i in 3" :key="i" class="skeleton skeleton-post"></div>
      </div>
      <div v-else-if="posts.length === 0">
        <EmptyState emoji="📣" text="朋友圈还空着，发第一条动态吧" />
      </div>
      <div v-else>
        <PostCard
          v-for="p in posts"
          :key="p.id"
          :post="p"
          :current-username="auth.user?.username"
          @click-user="clickUser"
          @deleted="onDeleted"
        />
      </div>
      <div v-if="posts.length > 0" class="end-hint">没有更多了</div>
    </div>

    <!-- 发动态按钮 -->
    <button class="fab" @click="openComposer">✎</button>

    <!-- 发动态弹窗 -->
    <transition name="slide-up">
      <div v-if="showComposer" class="modal-mask" @click.self="closeComposer">
        <div class="composer card">
          <div class="composer-head">
            <span class="c-title">发动态</span>
            <button class="close-btn" @click="closeComposer">✕</button>
          </div>
          <textarea
            v-model="content"
            class="c-textarea"
            placeholder="今天吃了什么好吃的？分享一下吧～"
            maxlength="200"
            rows="4"
          ></textarea>
          <div class="char-count">{{ content.length }}/200</div>

          <!-- 关联菜品 -->
          <div class="meal-select-group">
            <label class="c-label">关联菜品（可选）</label>
            <select v-model="selectedMealId" class="c-select">
              <option value="">不关联</option>
              <optgroup v-for="g in groupedMeals" :key="g.key" :label="g.emoji + ' ' + g.label">
                <option v-for="m in g.meals" :key="m.id" :value="m.id">
                  {{ m.emoji || g.emoji }} {{ m.name }}
                </option>
              </optgroup>
            </select>
          </div>

          <!-- 图片选择 -->
          <div class="image-picker">
            <div v-for="(url, i) in previewUrls" :key="i" class="img-preview">
              <img :src="url" />
              <button class="remove-img" @click="removeImage(i)">✕</button>
            </div>
            <label v-if="previewUrls.length < 3" class="add-img">
              <span>+</span>
              <input type="file" accept="image/jpeg,image/png,image/webp" multiple @change="onFileChange" />
            </label>
          </div>

          <button class="btn btn-block" :disabled="publishing" @click="publish">
            {{ publishing ? '发布中…' : '发布' }}
          </button>
        </div>
      </div>
    </transition>
  </div>
</template>

<style scoped>
.icon-btn {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 6px 12px;
  border-radius: 18px;
  background: var(--primary-soft);
  color: var(--primary-dark);
  font-size: 13px;
  font-weight: 600;
}
.btn-label {
  font-size: 12px;
}
.skeleton-post {
  height: 200px;
  margin-bottom: 12px;
}
.end-hint {
  text-align: center;
  color: var(--text-light);
  font-size: 12px;
  padding: 16px 0 8px;
}
.fab {
  position: fixed;
  bottom: calc(84px + env(safe-area-inset-bottom));
  right: 20px;
  width: 52px;
  height: 52px;
  border-radius: 50%;
  background: var(--primary);
  color: #fff;
  font-size: 22px;
  box-shadow: 0 4px 16px rgba(249, 115, 22, 0.4);
  z-index: 50;
  transition: transform 0.15s;
}
.fab:active {
  transform: scale(0.92);
}
.modal-mask {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.45);
  z-index: 200;
  display: flex;
  align-items: flex-end;
  justify-content: center;
}
.composer {
  width: 100%;
  max-width: 480px;
  border-radius: 20px 20px 0 0;
  padding: 20px 16px calc(20px + env(safe-area-inset-bottom));
  max-height: 85vh;
  overflow-y: auto;
}
.composer-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 14px;
}
.c-title {
  font-size: 17px;
  font-weight: 700;
}
.close-btn {
  width: 30px;
  height: 30px;
  border-radius: 50%;
  background: var(--primary-soft);
  color: var(--text-light);
  font-size: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
}
.c-textarea {
  width: 100%;
  padding: 12px;
  border-radius: 12px;
  background: var(--bg-card);
  font-size: 15px;
  line-height: 1.6;
  resize: none;
  min-height: 100px;
  font-family: inherit;
}
.char-count {
  text-align: right;
  font-size: 11px;
  color: var(--text-light);
  margin: 4px 0 12px;
}
.meal-select-group {
  margin-bottom: 14px;
}
.c-label {
  display: block;
  font-size: 12px;
  color: var(--text-light);
  margin-bottom: 6px;
  font-weight: 600;
}
.c-select {
  width: 100%;
  padding: 10px 12px;
  border-radius: 10px;
  background: var(--bg-card);
  font-size: 14px;
  font-family: inherit;
}
.image-picker {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 14px;
}
.img-preview {
  position: relative;
  width: 96px;
  height: 96px;
  border-radius: 10px;
  overflow: hidden;
}
.img-preview img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.remove-img {
  position: absolute;
  top: 4px;
  right: 4px;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: rgba(0, 0, 0, 0.6);
  color: #fff;
  font-size: 11px;
  display: flex;
  align-items: center;
  justify-content: center;
}
.add-img {
  width: 96px;
  height: 96px;
  border-radius: 10px;
  background: var(--bg-card);
  border: 2px dashed var(--border);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 28px;
  color: var(--text-light);
  cursor: pointer;
}
.add-img input {
  display: none;
}
</style>
