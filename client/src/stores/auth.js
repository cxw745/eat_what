import { defineStore } from 'pinia';
import { ref } from 'vue';
import http from '../api/index.js';

export const useAuthStore = defineStore('auth', () => {
  const token = ref(null);
  const user = ref(null);

  // 简易解析 JWT payload，检查是否过期
  function isTokenExpired(t) {
    try {
      const payload = JSON.parse(atob(t.split('.')[1]));
      // exp 是秒，提前 30 秒判过期
      return payload.exp * 1000 <= Date.now() + 30000;
    } catch {
      return true;
    }
  }

  // 从 localStorage 恢复登录态（含异常保护和过期检测）
  function restore() {
    if (!token.value) {
      const t = localStorage.getItem('token');
      if (t && !isTokenExpired(t)) {
        token.value = t;
        try {
          const u = localStorage.getItem('user');
          user.value = u ? JSON.parse(u) : null;
        } catch {
          user.value = null;
          localStorage.removeItem('user');
        }
      } else if (t) {
        // token 过期，清理
        localStorage.removeItem('token');
        localStorage.removeItem('user');
      }
    }
  }

  async function register(username, password) {
    const data = await http.post('/auth/register', { username, password });
    setSession(data);
  }

  async function login(username, password) {
    const data = await http.post('/auth/login', { username, password });
    setSession(data);
  }

  function setSession(data) {
    token.value = data.token;
    user.value = data.user;
    localStorage.setItem('token', data.token);
    localStorage.setItem('user', JSON.stringify(data.user));
  }

  function logout() {
    token.value = null;
    user.value = null;
    localStorage.removeItem('token');
    localStorage.removeItem('user');
  }

  return { token, user, restore, register, login, logout };
});
