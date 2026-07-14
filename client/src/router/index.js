import { createRouter, createWebHistory } from 'vue-router';
import { useAuthStore } from '../stores/auth.js';

const routes = [
  { path: '/', redirect: '/home' },
  {
    path: '/login',
    name: 'login',
    component: () => import('../views/Login.vue'),
    meta: { tab: false },
  },
  {
    path: '/home',
    name: 'home',
    component: () => import('../views/Home.vue'),
    meta: { tab: true },
  },
  {
    path: '/meals',
    name: 'meals',
    component: () => import('../views/MyMeals.vue'),
    meta: { tab: true },
  },
  // 好友 Tab：默认进入朋友圈
  { path: '/friends', redirect: '/friends/moments' },
  {
    path: '/friends/moments',
    name: 'moments',
    component: () => import('../views/Moments.vue'),
    meta: { tab: true },
  },
  {
    path: '/friends/list',
    name: 'friends',
    component: () => import('../views/Friends.vue'),
    meta: { tab: true },
  },
  {
    path: '/friends/list/:username',
    name: 'user-profile',
    component: () => import('../views/UserProfile.vue'),
    meta: { tab: true },
  },
  {
    path: '/feeds',
    name: 'feeds',
    component: () => import('../views/FeedInbox.vue'),
    meta: { tab: true },
  },
  // 分享公开页（无需登录）
  {
    path: '/share/:code',
    name: 'share',
    component: () => import('../views/ShareResult.vue'),
    meta: { tab: false, public: true },
  },
  // 兜底
  { path: '/:pathMatch(.*)*', redirect: '/home' },
];

const router = createRouter({
  history: createWebHistory(),
  routes,
});

// 路由守卫
router.beforeEach((to) => {
  const auth = useAuthStore();
  auth.restore();
  const isPublic = to.meta?.public === true;
  const needAuth = !isPublic && to.meta?.tab !== false;
  if (needAuth && !auth.token) {
    return { name: 'login' };
  }
  if (to.name === 'login' && auth.token) {
    return { name: 'home' };
  }
});

export default router;
