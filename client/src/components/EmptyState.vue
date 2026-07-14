<script setup>
defineProps({
  emoji: { type: String, default: '🍽️' },
  text: { type: String, default: '空空如也' },
});
</script>

<template>
  <div class="empty">
    <div class="empty-emoji">{{ emoji }}</div>
    <div>{{ text }}</div>
  </div>
</template>
