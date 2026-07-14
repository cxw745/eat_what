import { Router } from 'express';
import { randomBytes } from 'crypto';
import db from '../db.js';
import { authRequired } from '../auth.js';

const router = Router();

// 创建分享码（需登录）
router.post('/', authRequired, (req, res) => {
  const { meal_name, meal_type, tags } = req.body;
  if (!meal_name || !meal_name.trim()) {
    return res.status(400).json({ error: '菜品名不能为空' });
  }
  const code = randomBytes(4).toString('hex');
  db.prepare(`
    INSERT INTO shares (code, meal_name, meal_type, tags, from_user_id, from_username)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(
    code,
    meal_name.trim(),
    meal_type || null,
    tags && tags.length ? JSON.stringify(tags) : null,
    req.user.id,
    req.user.username
  );
  res.json({ code, url: `/share/${code}` });
});

// 公开查看分享（无需登录）
router.get('/:code', (req, res) => {
  const row = db.prepare('SELECT * FROM shares WHERE code = ?').get(req.params.code);
  if (!row) return res.status(404).json({ error: '分享不存在或已过期' });
  res.json({
    ...row,
    tags: row.tags ? JSON.parse(row.tags) : [],
  });
});

export default router;
