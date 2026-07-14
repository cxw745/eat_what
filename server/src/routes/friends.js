import { Router } from 'express';
import db from '../db.js';
import { authRequired } from '../auth.js';

const router = Router();
router.use(authRequired);

// 好友列表：我发出的 + 别人发给我的，区分 pending/accepted 与方向
router.get('/', (req, res) => {
  // 我发出的（含 pending/accepted）
  const outgoing = db.prepare(`
    SELECT f.id, f.status, f.created_at, u.id AS user_id, u.username AS username,
           'outgoing' AS direction
    FROM friends f JOIN users u ON f.friend_id = u.id
    WHERE f.user_id = ?
  `).all(req.user.id);

  // 别人发给我的
  const incoming = db.prepare(`
    SELECT f.id, f.status, f.created_at, u.id AS user_id, u.username AS username,
           'incoming' AS direction
    FROM friends f JOIN users u ON f.user_id = u.id
    WHERE f.friend_id = ?
  `).all(req.user.id);

  res.json({ outgoing, incoming });
});

// 添加好友（按用户名）：创建 pending 请求
router.post('/', (req, res) => {
  const { username } = req.body;
  if (!username || typeof username !== 'string' || !username.trim()) {
    return res.status(400).json({ error: '请输入好友用户名' });
  }
  if (username.trim().length > 20) {
    return res.status(400).json({ error: '用户名最多 20 个字符' });
  }
  const target = db.prepare('SELECT * FROM users WHERE username = ?').get(username.trim());
  if (!target) {
    return res.status(404).json({ error: '用户不存在' });
  }
  if (target.id === req.user.id) {
    return res.status(400).json({ error: '不能加自己为好友' });
  }

  // 检查是否已存在任一方向的关系
  const existing = db.prepare(`
    SELECT * FROM friends
    WHERE (user_id = ? AND friend_id = ?) OR (user_id = ? AND friend_id = ?)
  `).get(req.user.id, target.id, target.id, req.user.id);
  if (existing) {
    if (existing.status === 'accepted') {
      return res.status(409).json({ error: '已经是好友了' });
    }
    return res.status(409).json({ error: '已有待处理的好友请求' });
  }

  const info = db.prepare('INSERT INTO friends (user_id, friend_id) VALUES (?, ?)').run(req.user.id, target.id);
  res.json({ ok: true, id: info.lastInsertRowid, message: '好友请求已发送' });
});

// 接受好友请求
router.post('/:id/accept', (req, res) => {
  const { id } = req.params;
  const row = db.prepare('SELECT * FROM friends WHERE id = ? AND friend_id = ? AND status = ?').get(id, req.user.id, 'pending');
  if (!row) {
    return res.status(404).json({ error: '好友请求不存在或已处理' });
  }
  db.prepare('UPDATE friends SET status = ? WHERE id = ?').run('accepted', id);
  res.json({ ok: true });
});

// 删除好友 / 拒绝请求（任一方向都可操作）
router.delete('/:id', (req, res) => {
  const { id } = req.params;
  const info = db.prepare(`
    DELETE FROM friends
    WHERE id = ? AND (user_id = ? OR friend_id = ?)
  `).run(id, req.user.id, req.user.id);
  if (info.changes === 0) {
    return res.status(404).json({ error: '记录不存在或无权操作' });
  }
  res.json({ ok: true });
});

// 查看好友餐库（仅 accepted 好友）
// :id 是好友的用户 id（不是 friends 表 id）
router.get('/:id/meals', (req, res) => {
  const friendUserId = parseInt(req.params.id, 10);
  if (!friendUserId) {
    return res.status(400).json({ error: '参数非法' });
  }
  // 校验是否为已接受好友
  const friendship = db.prepare(`
    SELECT * FROM friends
    WHERE status = 'accepted'
    AND ((user_id = ? AND friend_id = ?) OR (user_id = ? AND friend_id = ?))
  `).get(req.user.id, friendUserId, friendUserId, req.user.id);
  if (!friendship) {
    return res.status(403).json({ error: '不是好友，无法查看' });
  }
  const friend = db.prepare('SELECT id, username FROM users WHERE id = ?').get(friendUserId);
  const meals = db.prepare('SELECT * FROM meals WHERE user_id = ? ORDER BY id DESC').all(friendUserId);
  res.json({ friend, meals });
});

// 从好友餐库随机抽一道
// :id 是好友的用户 id（不是 friends 表 id）
router.get('/:id/random', (req, res) => {
  const friendUserId = parseInt(req.params.id, 10);
  if (!friendUserId) {
    return res.status(400).json({ error: '参数非法' });
  }
  const { meal_type } = req.query;
  const VALID_TYPES = ['breakfast', 'lunch', 'dinner', 'supper'];
  if (meal_type && !VALID_TYPES.includes(meal_type)) {
    return res.status(400).json({ error: 'meal_type 参数非法' });
  }
  const friendship = db.prepare(`
    SELECT * FROM friends
    WHERE status = 'accepted'
    AND ((user_id = ? AND friend_id = ?) OR (user_id = ? AND friend_id = ?))
  `).get(req.user.id, friendUserId, friendUserId, req.user.id);
  if (!friendship) {
    return res.status(403).json({ error: '不是好友，无法抽取' });
  }
  const friend = db.prepare('SELECT id, username FROM users WHERE id = ?').get(friendUserId);

  const meal = meal_type
    ? db.prepare(`
        SELECT m.*,
          (SELECT GROUP_CONCAT(tag, ',') FROM meal_tags WHERE meal_id = m.id) AS tags_csv
        FROM meals m WHERE m.user_id = ? AND m.meal_type = ?
        ORDER BY RANDOM() LIMIT 1
      `).get(friendUserId, meal_type)
    : db.prepare(`
        SELECT m.*,
          (SELECT GROUP_CONCAT(tag, ',') FROM meal_tags WHERE meal_id = m.id) AS tags_csv
        FROM meals m WHERE m.user_id = ?
        ORDER BY RANDOM() LIMIT 1
      `).get(friendUserId);
  if (!meal) {
    return res.status(404).json({ error: `${friend.username} 的餐库还是空的` });
  }
  // 记录抽奖历史（来源：好友）
  const mealNorm = {
    ...meal,
    tags: meal.tags_csv ? meal.tags_csv.split(',') : [],
    tags_csv: undefined,
  };
  db.prepare(`
    INSERT INTO pick_history (user_id, meal_id, meal_name, meal_type, emoji, source, from_username)
    VALUES (?, ?, ?, ?, ?, 'friend', ?)
  `).run(req.user.id, mealNorm.id, mealNorm.name, mealNorm.meal_type, mealNorm.emoji || null, friend.username);
  res.json({ friend, meal: mealNorm });
});

export default router;
