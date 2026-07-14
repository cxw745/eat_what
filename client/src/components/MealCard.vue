<script setup>
import { getMealType } from '../constants/meal.js';
import { DEFAULT_EMOJI } from '../constants/emoji.js';
import TagBadge from './TagBadge.vue';

const props = defineProps({
  meal: { type: Object, required: true },
  showDelete: { type: Boolean, default: true },
  showEdit: { type: Boolean, default: false },
});
defineEmits(['delete', 'edit']);

// emoji：优先自定义，否则按 meal_type 默认
function emoji(meal) {
  return meal.emoji || DEFAULT_EMOJI[meal.meal_type] || getMealType(meal.meal_type).emoji;
}
</script>

<template>
  <div class="meal-card card">
    <div class="meal-info">
      <span class="meal-emoji">{{ emoji(meal) }}</span>
      <div class="meal-text">
        <div class="meal-name">{{ meal.name }}</div>
        <div class="meal-meta">
          <span class="meal-type">{{ getMealType(meal.meal_type).label }}</span>
        </div>
        <div v-if="meal.note" class="meal-note">📝 {{ meal.note }}</div>
        <div v-if="meal.tags && meal.tags.length" class="meal-tags">
          <TagBadge v-for="t in meal.tags" :key="t" :tag="t" size="xs" />
        </div>
      </div>
    </div>
    <div class="meal-ops">
      <button v-if="showEdit" class="op-btn edit" @click="$emit('edit', meal)">✎</button>
      <button v-if="showDelete" class="op-btn del" @click="$emit('delete', meal)">✕</button>
    </div>
  </div>
</template>

<style scoped>
.meal-card {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  padding: 14px 16px;
  margin-bottom: 10px;
  transition: transform 0.15s;
}
.meal-card:active {
  transform: scale(0.98);
}
.meal-info {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  flex: 1;
  min-width: 0;
}
.meal-emoji {
  font-size: 26px;
  flex-shrink: 0;
}
.meal-text {
  min-width: 0;
  flex: 1;
}
.meal-name {
  font-weight: 600;
  font-size: 16px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.meal-meta {
  margin-top: 2px;
}
.meal-type {
  font-size: 12px;
  color: var(--text-light);
}
.meal-note {
  font-size: 12px;
  color: var(--text-light);
  margin-top: 4px;
  line-height: 1.4;
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}
.meal-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-top: 6px;
}
.meal-ops {
  display: flex;
  gap: 6px;
  flex-shrink: 0;
  align-items: center;
}
.op-btn {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  font-size: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.15s;
}
.op-btn.edit {
  background: var(--primary-soft);
  color: var(--primary-dark);
}
.op-btn.del {
  background: var(--primary-soft);
  color: var(--danger);
}
.op-btn:active {
  transform: scale(0.9);
}
</style>
