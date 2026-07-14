import { createApp } from 'vue';
import { createPinia } from 'pinia';
import App from './App.vue';
import router from './router';
import './styles/main.css';

const app = createApp(App);
app.use(createPinia());
app.use(router);

// 全局错误处理：避免组件内异常被吞
app.config.errorHandler = (err, instance, info) => {
  console.error('[Vue Error]', err, info);
};

app.mount('#app');
