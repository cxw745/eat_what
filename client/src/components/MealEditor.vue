<script setup>
import { ref, watch, computed } from 'vue';
import { MEAL_TYPE_LIST, getMealType } from '../constants/meal.js';
import { DEFAULT_EMOJI } from '../constants/emoji.js';
import TagPicker from './TagPicker.vue';
import EmojiPicker from './EmojiPicker.vue';

const props = defineProps({
  show: { type: Boolean, default: false },
  meal: { type: Object, default: null },
});
const emit = defineEmits(['close', 'save']);

const name = ref('');
const mealType = ref('lunch');
const tags = ref([]);
const emoji = ref('');
const note = ref('');
const saving = ref(false);

const isEdit = computed(() => !!props.meal);
const title = computed(() => isEdit.value ? '编辑菜品' : '添加菜品');

// 弹窗打开/meal变化时，重置表单
watch(() => [props.show, props.meal], () => {
  if (props.show) {
    if (props.meal) {
      name.value = props.meal.name;
      mealType.value = props.meal.meal_type;
      tags.value = [...(props.meal.tags || [])];
      emoji.value = props.meal.emoji || '';
      note.value = props.meal.note || '';
    } else {
      name.value = '';
      mealType.value = 'lunch';
      tags.value = [];
      emoji.value = '';
      note.value = '';
    }
  }
}, { immediate: true });

async function save() {
  if (saving.value) return;
  if (!name.value.trim()) {
    emit('save', { error: '菜品名不能为空' });
    return;
  }
  saving.value = true;
  try {
    emit('save', {
      name: name.value.trim(),
      meal_type: mealType.value,
      tags: [...tags.value],
      emoji: emoji.value,
      note: note.value.trim(),
    });
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <transition name="fade">
    <div v-if="show" class="modal-mask" @click.self="emit('close')">
      <div class="modal card">
        <div class="modal-head">
          <span class="modal-title">{{ title }}</span>
          <button class="close-btn" @click="emit('close')">✕</button>
        </div>

        <div class="modal-body">
          <div class="input-group">
            <label class="input-label">菜品名</label>
            <input v-model="name" class="input" placeholder="例如：黄焖鸡米饭" maxlength="30" />
          </div>

          <div class="input-group">
            <label class="input-label">分类</label>
            <div class="type-row">
              <button
                v-for="t in MEAL_TYPE_LIST"
                :key="t.key"
                class="type-chip"
                :class="{ active: mealType === t.key }"
                @click="mealType = t.key"
              >{{ t.emoji }} {{ t.label }}</button>
            </div>
          </div>

          <div class="input-group">
            <label class="input-label">emoji 图标</label>
            <EmojiPicker v-model="emoji" />
          </div>

          <div class="input-group">
            <label class="input-label">备注（可选）</label>
            <input
              v-model="note"
              class="input"
              placeholder="店家 / 价格 / 做法 / 推荐理由…"
              maxlength="100"
            />
          </div>

          <div class="input-group">
            <label class="input-label">标签（可选）</label>
            <TagPicker v-model="tags" />
          </div>
        </div>

        <div class="modal-foot">
          <button class="btn btn-ghost" @click="emit('close')">取消</button>
          <button class="btn" :disabled="saving" @click="save">{{ saving ? '保存中' : '保存' }}</button>
        </div>
      </div>
    </div>
  </transition>
</template>

<style scoped>
.modal-mask {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.45);
  z-index: 200;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  padding: 0;
}
.modal {
  width: 100%;
  max-width: 480px;
  border-radius: 20px 20px 0 0;
  padding: 20px 16px calc(20px + env(safe-area-inset-bottom));
  max-height: 85vh;
  overflow-y: auto;
  animation: slide-up 0.25s ease;
}
@keyframes slide-up {
  from { transform: translateY(100%); }
  to { transform: translateY(0); }
}
.modal-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
}
.modal-title {
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
.modal-body {
  margin-bottom: 16px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.input-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.input-label {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-light);
}
.type-row {
  display: flex;
  gap: 6px;
  overflow-x: auto;
  scrollbar-width: none;
}
.type-row::-webkit-scrollbar { display: none; }
.type-chip {
  flex-shrink: 0;
  padding: 8px 12px;
  border-radius: 10px;
  background: var(--primary-soft);
  color: var(--text-light);
  font-size: 13px;
  font-weight: 600;
  white-space: nowrap;
}
.type-chip.active {
  background: var(--primary);
  color: #fff;
}
.modal-foot {
  display: flex;
  gap: 10px;
}
.modal-foot .btn {
  flex: 1;
}
</style>
