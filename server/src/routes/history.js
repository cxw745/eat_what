import { Router } from 'express';
import db from '../db.js';
import { authRequired } from '../auth.js';

const router = Router();
router.use(authRequired);

// 手动记录一条历史（"抽同款"：把好友的菜记为自己的抽奖结果）
router.post('/', (req, res) => {
  const { meal_id } = req.body;
  const mealId = parseInt(meal_id, 10);
  if (!mealId) {
    return res.status(400).json({ error: '缺少 meal_id' });
  }
  // 查 meal：归属自己 或 归属已接受好友
  const meal = db.prepare('SELECT m.*, u.username AS owner_username FROM meals m JOIN users u ON m.user_id = u.id WHERE m.id = ?').get(mealId);
  if (!meal) {
    return res.status(404).json({ error: '菜品不存在' });
  }
  const isOwn = meal.user_id === req.user.id;
  let isFriend = false;
  if (!isOwn) {
    const friendship = db.prepare(`
      SELECT 1 FROM friends
      WHERE status = 'accepted'
      AND ((user_id = ? AND friend_id = ?) OR (user_id = ? AND friend_id = ?))
    `).get(req.user.id, meal.user_id, meal.user_id, req.user.id);
    isFriend = !!friendship;
  }
  if (!isOwn && !isFriend) {
    return res.status(403).json({ error: '无权抽取该菜品' });
  }
  const info = db.prepare(`
    INSERT INTO pick_history (user_id, meal_id, meal_name, meal_type, emoji, source, from_username)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    req.user.id, meal.id, meal.name, meal.meal_type, meal.emoji || null,
    isOwn ? 'self' : 'friend',
    isOwn ? null : meal.owner_username
  );
  const row = db.prepare('SELECT * FROM pick_history WHERE id = ?').get(info.lastInsertRowid);
  res.json({ history: row });
});

// 获取抽奖历史（默认最近 20 条）
router.get('/', (req, res) => {
  const limit = Math.min(parseInt(req.query.limit, 10) || 20, 100);
  const rows = db.prepare(`
    SELECT * FROM pick_history WHERE user_id = ?
    ORDER BY id DESC LIMIT ?
  `).all(req.user.id, limit);
  res.json({ history: rows });
});

// 清空抽奖历史
router.delete('/', (req, res) => {
  const info = db.prepare('DELETE FROM pick_history WHERE user_id = ?').run(req.user.id);
  res.json({ ok: true, deleted: info.changes });
});

// 删除单条历史
router.delete('/:id', (req, res) => {
  const info = db.prepare('DELETE FROM pick_history WHERE id = ? AND user_id = ?').run(req.params.id, req.user.id);
  if (info.changes === 0) {
    return res.status(404).json({ error: '记录不存在或无权删除' });
  }
  res.json({ ok: true });
});

export default router;
