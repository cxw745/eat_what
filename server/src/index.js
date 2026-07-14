import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { mkdirSync } from 'fs';

import authRoutes from './routes/auth.js';
import wxAuthRoutes from './routes/wx-auth.js';
import mealsRoutes from './routes/meals.js';
import friendsRoutes from './routes/friends.js';
import feedsRoutes from './routes/feeds.js';
import postsRoutes from './routes/posts.js';
import usersRoutes from './routes/users.js';
import sharesRoutes from './routes/shares.js';
import historyRoutes from './routes/history.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// 确保 uploads 目录存在
mkdirSync(join(__dirname, '..', 'uploads', 'posts'), { recursive: true });

const app = express();
const PORT = process.env.PORT || 3001;

// CORS
const allowedOrigins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(',').map((s) => s.trim())
  : null;

app.use(cors(allowedOrigins ? {
  origin: allowedOrigins,
  credentials: true,
} : undefined));
app.use(express.json({ limit: '1mb' }));

// 静态文件：上传的图片
app.use('/uploads', express.static(join(__dirname, '..', 'uploads')));

// 路由
app.use('/api/auth', authRoutes);
app.use('/api/auth', wxAuthRoutes); // 微信小程序登录（与密码登录共享 /api/auth 前缀）
app.use('/api/meals', mealsRoutes);
app.use('/api/friends', friendsRoutes);
app.use('/api/feeds', feedsRoutes);
app.use('/api/posts', postsRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/shares', sharesRoutes);
app.use('/api/history', historyRoutes);

// 健康检查
app.get('/api/health', (req, res) => res.json({ ok: true, time: Date.now() }));

// 404 JSON 兜底
app.use((req, res) => {
  res.status(404).json({ error: '接口不存在' });
});

// 统一错误处理
app.use((err, req, res, next) => {
  console.error('[ERROR]', err);
  if (err.type === 'entity.too.large') {
    return res.status(413).json({ error: '请求体过大' });
  }
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({ error: '图片大小不能超过 5MB' });
  }
  res.status(500).json({ error: '服务器内部错误' });
});

const server = app.listen(PORT, () => {
  console.log(`🍱 吃什么后端已启动: http://localhost:${PORT}`);
});

process.on('unhandledRejection', (reason) => {
  console.error('[unhandledRejection]', reason);
});
process.on('uncaughtException', (err) => {
  console.error('[uncaughtException]', err);
});

function shutdown(signal) {
  console.log(`\n收到 ${signal}，正在关闭…`);
  server.close(() => process.exit(0));
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
