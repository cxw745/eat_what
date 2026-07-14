<script setup>
import { ref, computed } from 'vue';
import { FOOD_EMOJI_GROUPS } from '../constants/emoji.js';

const props = defineProps({
  modelValue: { type: String, default: '' },
});
const emit = defineEmits(['update:modelValue']);

const customInput = ref('');
const showCustom = ref(false);

const selected = computed({
  get: () => props.modelValue,
  set: (v) => emit('update:modelValue', v),
});

function pick(e) {
  selected.value = e;
}

function clearEmoji() {
  selected.value = '';
}

function applyCustom() {
  const v = customInput.value.trim();
  if (v) {
    // 取前两个码点（兼容组合 emoji）
    selected.value = Array.from(v)[0] + (Array.from(v)[1] || '');
    customInput.value = '';
    showCustom.value = false;
  }
}
</script>

<template>
  <div class="emoji-picker">
    <!-- 当前选中 + 清除 -->
    <div class="picker-head">
      <div class="current" :class="{ empty: !selected }">
        <span v-if="selected" class="current-emoji">{{ selected }}</span>
        <span v-else class="placeholder">默认按分类</span>
      </div>
      <button v-if="selected" class="clear-btn" @click="clearEmoji">清除</button>
      <button class="custom-btn" @click="showCustom = !showCustom">
        {{ showCustom ? '收起' : '自定义输入' }}
      </button>
    </div>

    <!-- 自定义输入 -->
    <div v-if="showCustom" class="custom-row">
      <input
        v-model="customInput"
        class="custom-input"
        placeholder="粘贴或输入一个 emoji"
        maxlength="4"
        @keyup.enter="applyCustom"
      />
      <button class="apply-btn" @click="applyCustom">确定</button>
    </div>

    <!-- 预设 emoji 网格 -->
    <div class="emoji-groups">
      <div v-for="g in FOOD_EMOJI_GROUPS" :key="g.key" class="emoji-group">
        <div class="group-label">{{ g.label }}</div>
        <div class="emoji-grid">
          <button
            v-for="(e, i) in g.emojis"
            :key="g.key + i"
            class="emoji-cell"
            :class="{ active: selected === e }"
            @click="pick(e)"
          >{{ e }}</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.emoji-picker {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.picker-head {
  display: flex;
  align-items: center;
  gap: 8px;
}
.current {
  flex: 1;
  height: 44px;
  border-radius: 10px;
  background: var(--primary-soft);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24px;
}
.current.empty {
  font-size: 13px;
  color: var(--text-light);
}
.placeholder {
  font-size: 13px;
}
.clear-btn, .custom-btn {
  padding: 8px 12px;
  border-radius: 8px;
  background: var(--bg-card);
  color: var(--text-light);
  font-size: 12px;
  font-weight: 600;
  white-space: nowrap;
}
.custom-row {
  display: flex;
  gap: 6px;
}
.custom-input {
  flex: 1;
  padding: 8px 12px;
  border-radius: 8px;
  background: var(--bg-card);
  font-size: 16px;
  text-align: center;
}
.apply-btn {
  padding: 8px 14px;
  border-radius: 8px;
  background: var(--primary);
  color: #fff;
  font-size: 12px;
  font-weight: 600;
}
.emoji-groups {
  max-height: 200px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 4px;
}
.emoji-group {
  display: flex;
  align-items: flex-start;
  gap: 8px;
}
.group-label {
  font-size: 11px;
  color: var(--text-light);
  font-weight: 600;
  min-width: 32px;
  padding-top: 6px;
  flex-shrink: 0;
}
.emoji-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(32px, 1fr));
  gap: 4px;
  flex: 1;
}
.emoji-cell {
  width: 32px;
  height: 32px;
  border-radius: 6px;
  font-size: 18px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.1s;
}
.emoji-cell:hover {
  background: var(--primary-soft);
}
.emoji-cell.active {
  background: var(--primary);
  transform: scale(1.1);
}
</style>
