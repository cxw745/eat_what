<script setup>
import { ref, computed, onMounted } from 'vue';
import http from '../api/index.js';
import MealCard from '../components/MealCard.vue';
import MealEditor from '../components/MealEditor.vue';
import EmptyState from '../components/EmptyState.vue';
import { useToast } from '../composables/useToast.js';
import { MEAL_TYPE_LIST, getMealType } from '../constants/meal.js';
import { ALL_TAGS } from '../constants/tags.js';

defineOptions({ name: 'MyMeals' });

const { show: showToast } = useToast();

const meals = ref([]);
const activeType = ref('breakfast');
const loading = ref(false);
const filterTag = ref(''); // 标签筛选

// 编辑弹窗
const editorShow = ref(false);
const editingMeal = ref(null); // null=新增, 对象=编辑
const saving = ref(false);

const filtered = computed(() => {
  let list = meals.value.filter((m) => m.meal_type === activeType.value);
  if (filterTag.value) {
    list = list.filter((m) => m.tags && m.tags.includes(filterTag.value));
  }
  return list;
});
const countByType = (key) => meals.value.filter((m) => m.meal_type === key).length;
// 当前分类下出现过的标签（用于筛选器）
const availableTags = computed(() => {
  const set = new Set();
  meals.value.filter((m) => m.meal_type === activeType.value).forEach((m) => {
    (m.tags || []).forEach((t) => set.add(t));
  });
  return [...set];
});

async function load() {
  loading.value = true;
  try {
    const data = await http.get('/meals');
    meals.value = data.meals;
  } catch (e) {
    showToast(e.message);
  } finally {
    loading.value = false;
  }
}

function openAdd() {
  editingMeal.value = null;
  editorShow.value = true;
}

function openEdit(meal) {
  editingMeal.value = meal;
  editorShow.value = true;
}

async function handleSave(data) {
  if (data.error) {
    showToast(data.error);
    return;
  }
  saving.value = true;
  try {
    if (editingMeal.value) {
      // 编辑
      const res = await http.put(`/meals/${editingMeal.value.id}`, {
        name: data.name,
        tags: data.tags,
        emoji: data.emoji,
        note: data.note,
      });
      const idx = meals.value.findIndex((m) => m.id === editingMeal.value.id);
      if (idx >= 0) meals.value[idx] = res.meal;
      showToast('已保存');
    } else {
      // 新增
      const res = await http.post('/meals', {
        name: data.name,
        meal_type: data.meal_type,
        tags: data.tags,
        emoji: data.emoji,
        note: data.note,
      });
      meals.value.unshift(res.meal);
      activeType.value = data.meal_type;
      showToast('已添加');
    }
    editorShow.value = false;
  } catch (e) {
    showToast(e.message);
  } finally {
    saving.value = false;
  }
}

async function remove(meal) {
  if (!confirm(`确定删除「${meal.name}」？`)) return;
  try {
    await http.delete(`/meals/${meal.id}`);
    meals.value = meals.value.filter((m) => m.id !== meal.id);
  } catch (e) {
    showToast(e.message);
  }
}

onMounted(load);
</script>

<template>
  <div>
    <div class="topbar">
      <div class="topbar-title">我的餐库</div>
      <div class="count">共 {{ meals.length }} 道</div>
    </div>

    <div class="page">
      <!-- 分类 Tab -->
      <div class="type-tabs">
        <button
          v-for="t in MEAL_TYPE_LIST"
          :key="t.key"
          class="type-tab"
          :class="{ active: activeType === t.key }"
          @click="activeType = t.key; filterTag = ''"
        >
          {{ t.emoji }} {{ t.label }}
          <span class="tab-count">{{ countByType(t.key) }}</span>
        </button>
      </div>

      <!-- 标签筛选 -->
      <div v-if="availableTags.length > 0" class="tag-filter">
        <button class="filter-chip" :class="{ active: !filterTag }" @click="filterTag = ''">全部</button>
        <button
          v-for="t in availableTags"
          :key="t"
          class="filter-chip"
          :class="{ active: filterTag === t }"
          @click="filterTag = t"
        >{{ t }}</button>
      </div>

      <!-- 列表 -->
      <div v-if="loading" class="skeleton-list">
        <div v-for="i in 3" :key="i" class="skeleton skeleton-item"></div>
      </div>
      <div v-else-if="filtered.length === 0">
        <EmptyState emoji="🍽️" :text="filterTag ? '该标签下没有菜品' : '这里还空着，添加几道常吃的吧'" />
      </div>
      <div v-else>
        <MealCard
          v-for="m in filtered"
          :key="m.id"
          :meal="m"
          show-edit
          @edit="openEdit"
          @delete="remove"
        />
      </div>
    </div>

    <!-- 添加按钮（浮动） -->
    <button class="fab" @click="openAdd">+</button>

    <!-- 编辑弹窗 -->
    <MealEditor
      :show="editorShow"
      :meal="editingMeal"
      @close="editorShow = false"
      @save="handleSave"
    />
  </div>
</template>

<style scoped>
.count {
  font-size: 13px;
  color: var(--text-light);
}
.type-tabs {
  display: flex;
  gap: 6px;
  margin-bottom: 14px;
  overflow-x: auto;
  scrollbar-width: none;
}
.type-tabs::-webkit-scrollbar { display: none; }
.type-tab {
  flex-shrink: 0;
  padding: 10px 14px;
  border-radius: 10px;
  background: var(--bg-card);
  color: var(--text-light);
  font-size: 13px;
  font-weight: 600;
  box-shadow: var(--shadow-sm);
  transition: all 0.15s;
}
.type-tab.active {
  background: var(--primary);
  color: #fff;
  box-shadow: 0 2px 8px rgba(249, 115, 22, 0.2);
}
.tab-count {
  font-size: 11px;
  opacity: 0.8;
  margin-left: 2px;
}
.tag-filter {
  display: flex;
  gap: 6px;
  margin-bottom: 14px;
  overflow-x: auto;
  scrollbar-width: none;
}
.tag-filter::-webkit-scrollbar { display: none; }
.filter-chip {
  flex-shrink: 0;
  padding: 5px 12px;
  border-radius: 16px;
  background: var(--primary-soft);
  color: var(--text-light);
  font-size: 12px;
  font-weight: 500;
  white-space: nowrap;
}
.filter-chip.active {
  background: var(--primary);
  color: #fff;
}
.skeleton-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.skeleton-item {
  height: 80px;
}

/* 浮动添加按钮 */
.fab {
  position: fixed;
  bottom: calc(84px + env(safe-area-inset-bottom));
  left: 50%;
  transform: translateX(220px);
  width: 52px;
  height: 52px;
  border-radius: 50%;
  background: var(--primary);
  color: #fff;
  font-size: 28px;
  font-weight: 300;
  box-shadow: 0 4px 16px rgba(249, 115, 22, 0.4);
  z-index: 50;
  transition: transform 0.15s;
}
.fab:active {
  transform: translateX(220px) scale(0.92);
}
@media (max-width: 480px) {
  .fab {
    right: 20px;
    left: auto;
    transform: none;
  }
  .fab:active {
    transform: scale(0.92);
  }
}
</style>
