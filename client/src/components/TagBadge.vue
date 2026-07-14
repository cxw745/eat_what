<script setup>
import { getTagColor } from '../constants/tags.js';
defineProps({
  tag: { type: String, required: true },
  size: { type: String, default: 'sm' }, // sm | xs
});
</script>

<template>
  <span class="tag-badge" :class="size" :style="{ color: getTagColor(tag), background: getTagColor(tag) + '18' }">
    {{ tag }}
  </span>
</template>

<style scoped>
.tag-badge {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 6px;
  font-size: 11px;
  font-weight: 600;
  line-height: 1.6;
  white-space: nowrap;
}
.tag-badge.xs {
  font-size: 10px;
  padding: 1px 6px;
}
</style>
