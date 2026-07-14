import { Router } from 'express';
import bcrypt from 'bcryptjs';
import db from '../db.js';
import { signToken } from '../auth.js';

const router = Router();

// 简易内存限流：每个 IP 每分钟最多 10 次认证请求
const rateMap = new Map();
const RATE_WINDOW = 60 * 1000;
const RATE_MAX = 10;

function rateLimit(req, res, next) {
  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  const now = Date.now();
  const rec = rateMap.get(ip) || { count: 0, resetAt: now + RATE_WINDOW };
  if (now > rec.resetAt) {
    rec.count = 0;
    rec.resetAt = now + RATE_WINDOW;
  }
  rec.count++;
  rateMap.set(ip, rec);
  if (rec.count > RATE_MAX) {
    return res.status(429).json({ error: '请求过于频繁，请稍后再试' });
  }
  next();
}

router.use(rateLimit);

// 注册
router.post('/register', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: '用户名和密码不能为空' });
  }
  if (typeof username !== 'string' || username.length < 2 || username.length > 20) {
    return res.status(400).json({ error: '用户名长度 2-20 个字符' });
  }
  if (typeof password !== 'string' || password.length < 4 || password.length > 64) {
    return res.status(400).json({ error: '密码长度 4-64 位' });
  }

  const exists = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
  if (exists) {
    return res.status(409).json({ error: '用户名已存在' });
  }

  try {
    const hash = await bcrypt.hash(password, 12);
    const info = db.prepare('INSERT INTO users (username, password_hash) VALUES (?, ?)').run(username, hash);
    const user = { id: info.lastInsertRowid, username };
    const token = signToken(user);
    res.json({ token, user });
  } catch (e) {
    console.error('注册失败', e);
    res.status(500).json({ error: '注册失败，请重试' });
  }
});

// 登录
router.post('/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: '用户名和密码不能为空' });
  }

  const row = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
  if (!row) {
    return res.status(401).json({ error: '用户名或密码错误' });
  }

  try {
    const ok = await bcrypt.compare(password, row.password_hash);
    if (!ok) {
      return res.status(401).json({ error: '用户名或密码错误' });
    }
    const user = { id: row.id, username: row.username };
    const token = signToken(user);
    res.json({ token, user });
  } catch (e) {
    console.error('登录失败', e);
    res.status(500).json({ error: '登录失败，请重试' });
  }
});

export default router;
