import { Router } from 'express';
import db from '../db.js';
import { authRequired } from '../auth.js';

const router = Router();

// 查看某用户的餐库（需为已接受好友）
router.get('/:username/meals', authRequired, (req, res) => {
  const target = db.prepare('SELECT id, username FROM users WHERE username = ?').get(req.params.username);
  if (!target) return res.status(404).json({ error: '用户不存在' });

  // 自己看自己 OK，否则需为好友
  if (target.id !== req.user.id) {
    const friendship = db.prepare(`
      SELECT * FROM friends
      WHERE status = 'accepted'
      AND ((user_id = ? AND friend_id = ?) OR (user_id = ? AND friend_id = ?))
    `).get(req.user.id, target.id, target.id, req.user.id);
    if (!friendship) return res.status(403).json({ error: '只能查看好友的餐库' });
  }

  const meals = db.prepare(`
    SELECT m.*,
      (SELECT GROUP_CONCAT(tag, ',') FROM meal_tags WHERE meal_id = m.id) AS tags_csv
    FROM meals m WHERE m.user_id = ?
    ORDER BY m.id DESC
  `).all(target.id);

  const result = meals.map((m) => ({
    ...m,
    tags: m.tags_csv ? m.tags_csv.split(',') : [],
    tags_csv: undefined,
  }));

  res.json({ user: target, meals: result });
});

// 获取某用户的公开信息 + 餐库统计
router.get('/:username/profile', authRequired, (req, res) => {
  const target = db.prepare('SELECT id, username, created_at FROM users WHERE username = ?').get(req.params.username);
  if (!target) return res.status(404).json({ error: '用户不存在' });

  const isSelf = target.id === req.user.id;
  let isFriend = false;
  if (!isSelf) {
    const friendship = db.prepare(`
      SELECT status FROM friends
      WHERE ((user_id = ? AND friend_id = ?) OR (user_id = ? AND friend_id = ?))
    `).get(req.user.id, target.id, target.id, req.user.id);
    isFriend = friendship?.status === 'accepted';
  }

  const mealCount = db.prepare('SELECT COUNT(*) AS c FROM meals WHERE user_id = ?').get(target.id).c;
  const postCount = db.prepare('SELECT COUNT(*) AS c FROM posts WHERE user_id = ?').get(target.id).c;

  res.json({
    user: target,
    is_self: isSelf,
    is_friend: isFriend,
    stats: { meal_count: mealCount, post_count: postCount },
  });
});

export default router;
