import { ref } from 'vue';

// 全局单例 toast，避免每个组件重复定义
const message = ref('');
let timer = null;

export function useToast() {
  function show(msg, duration = 1800) {
    message.value = msg;
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      message.value = '';
    }, duration);
  }

  function hide() {
    message.value = '';
    if (timer) clearTimeout(timer);
  }

  return { message, show, hide };
}
