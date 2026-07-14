import axios from 'axios';

/**
 * 统一 HTTP 客户端封装
 * - H5/Web 环境：基于 axios，开发期通过 vite proxy 走 /api，生产期走 BASE_URL
 * - 小程序环境（uni-app）：后续切换到 uni.request adapter 即可，调用方式不变
 *
 * 配置说明：
 *   开发环境：vite.config.js 的 server.proxy 把 /api 转发到后端，无需配 BASE_URL
 *   生产环境：通过 VITE_API_BASE 指定后端域名，例如 https://chisha.example.com
 *   小程序迁移：把下方 createHttp 换成基于 uni.request 的实现即可
 */

// API 基础地址：优先用环境变量，其次开发期用 /api（走代理）
const API_BASE = import.meta.env.VITE_API_BASE || '/api';

// 资源基础地址：用于拼接图片等静态资源 URL
// 留空时图片走相对路径（依赖同域部署），有值时拼成完整 URL
const ASSET_BASE = import.meta.env.VITE_ASSET_BASE || '';

const http = axios.create({
  baseURL: API_BASE,
  timeout: 10000,
});

// 请求拦截器：自动带 token
// 注意：小程序迁移时把 localStorage.getItem 换成 uni.getStorageSync
http.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// 响应拦截器：统一错误处理 + 401 跳登录
http.interceptors.response.use(
  (res) => res.data,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      // 小程序迁移时换成 uni.reLaunch({ url: '/pages/login/login' })
      if (location.pathname !== '/login') {
        location.href = '/login';
      }
    }
    const msg = err.response?.data?.error || err.message || '请求失败';
    return Promise.reject(new Error(msg));
  }
);

/**
 * 把后端返回的相对路径补全为完整 URL
 * 用于图片、头像等资源地址
 * 例：assetUrl('/uploads/posts/xxx.jpg') => 'https://域名/uploads/posts/xxx.jpg'
 */
export function assetUrl(path) {
  if (!path) return '';
  if (path.startsWith('http')) return path; // 已是完整 URL，直接返回
  return ASSET_BASE + path;
}

export default http;
