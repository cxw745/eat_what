<script setup>
import { ref, computed } from 'vue';
import { TAG_GROUPS } from '../constants/tags.js';

const props = defineProps({
  modelValue: { type: Array, default: () => [] }, // 选中的标签数组
});
const emit = defineEmits(['update:modelValue']);

const selected = computed({
  get: () => props.modelValue,
  set: (v) => emit('update:modelValue', v),
});

function toggle(tag) {
  const idx = selected.value.indexOf(tag);
  if (idx >= 0) {
    selected.value = selected.value.filter((t) => t !== tag);
  } else {
    selected.value = [...selected.value, tag];
  }
}
</script>

<template>
  <div class="tag-picker">
    <div v-for="group in TAG_GROUPS" :key="group.key" class="tag-group">
      <div class="group-label">{{ group.label }}</div>
      <div class="group-tags">
        <button
          v-for="t in group.tags"
          :key="t"
          class="tag-btn"
          :class="{ active: selected.includes(t) }"
          @click="toggle(t)"
        >{{ t }}</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.tag-picker {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.tag-group {
  display: flex;
  align-items: flex-start;
  gap: 8px;
}
.group-label {
  font-size: 12px;
  color: var(--text-light);
  font-weight: 600;
  min-width: 36px;
  padding-top: 6px;
  flex-shrink: 0;
}
.group-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  flex: 1;
}
.tag-btn {
  padding: 5px 12px;
  border-radius: 16px;
  background: var(--primary-soft);
  color: var(--text-light);
  font-size: 12px;
  font-weight: 500;
  transition: all 0.15s;
  white-space: nowrap;
}
.tag-btn.active {
  background: var(--primary);
  color: #fff;
  box-shadow: 0 1px 4px rgba(249, 115, 22, 0.3);
}
.tag-btn:active {
  transform: scale(0.93);
}
</style>
