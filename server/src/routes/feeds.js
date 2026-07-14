import { Router } from 'express';
import db from '../db.js';
import { authRequired } from '../auth.js';

const router = Router();
router.use(authRequired);

const VALID_TYPES = ['breakfast', 'lunch', 'dinner', 'supper'];

// emoji 校验：单字符（含组合 emoji），最多 2 码点
function sanitizeEmoji(e) {
  if (typeof e !== 'string') return null;
  const t = e.trim();
  if (!t) return null;
  return t.slice(0, 2);
}

// tags 数组 → 逗号分隔字符串
function tagsToCsv(tags) {
  if (!Array.isArray(tags)) return null;
  const list = tags.filter((t) => typeof t === 'string' && t.length <= 10).slice(0, 10);
  return list.length ? list.join(',') : null;
}

// csv → tags 数组
function csvToTags(csv) {
  if (!csv) return [];
  return csv.split(',').filter(Boolean);
}

// 收到的投喂列表（按时间倒序），含投喂人用户名，支持分页
router.get('/', (req, res) => {
  const limit = Math.min(parseInt(req.query.limit, 10) || 50, 100);
  const offset = Math.max(parseInt(req.query.offset, 10) || 0, 0);
  const rows = db.prepare(`
    SELECT f.*, u.username AS from_username
    FROM feeds f JOIN users u ON f.from_user_id = u.id
    WHERE f.to_user_id = ?
    ORDER BY f.id DESC
    LIMIT ? OFFSET ?
  `).all(req.user.id, limit, offset);
  const total = db.prepare('SELECT COUNT(*) AS c FROM feeds WHERE to_user_id = ?').get(req.user.id).c;
  // 把 tags csv 转成数组
  const result = rows.map((r) => ({ ...r, tags: csvToTags(r.tags) }));
  res.json({ feeds: result, total });
});

// 投喂好友：按用户名指定，校验是否为已接受好友
router.post('/', (req, res) => {
  const { to_username, meal_name, meal_type, message, emoji, note, tags } = req.body;
  if (!to_username || typeof to_username !== 'string' || !to_username.trim()) {
    return res.status(400).json({ error: '请选择要投喂的好友' });
  }
  if (!meal_name || typeof meal_name !== 'string' || !meal_name.trim()) {
    return res.status(400).json({ error: '请指定要投喂的菜' });
  }
  if (meal_name.trim().length > 30) {
    return res.status(400).json({ error: '菜名最多 30 个字符' });
  }
  if (meal_type && !VALID_TYPES.includes(meal_type)) {
    return res.status(400).json({ error: 'meal_type 参数非法' });
  }
  if (message && typeof message === 'string' && message.length > 50) {
    return res.status(400).json({ error: '留言最多 50 个字符' });
  }

  const target = db.prepare('SELECT * FROM users WHERE username = ?').get(to_username.trim());
  if (!target) {
    return res.status(404).json({ error: '用户不存在' });
  }
  if (target.id === req.user.id) {
    return res.status(400).json({ error: '不能投喂自己' });
  }

  // 校验好友关系
  const friendship = db.prepare(`
    SELECT * FROM friends
    WHERE status = 'accepted'
    AND ((user_id = ? AND friend_id = ?) OR (user_id = ? AND friend_id = ?))
  `).get(req.user.id, target.id, target.id, req.user.id);
  if (!friendship) {
    return res.status(403).json({ error: '只能投喂已添加的好友' });
  }

  const emojiVal = sanitizeEmoji(emoji);
  const noteVal = typeof note === 'string' ? note.trim().slice(0, 100) : null;
  const tagsCsv = tagsToCsv(tags);

  const info = db.prepare(`
    INSERT INTO feeds (from_user_id, to_user_id, meal_name, meal_type, message, emoji, note, tags)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    req.user.id, target.id, meal_name.trim(), meal_type || null,
    (message || '').trim() || null, emojiVal, noteVal, tagsCsv
  );
  const feed = db.prepare('SELECT * FROM feeds WHERE id = ?').get(info.lastInsertRowid);
  res.json({ ok: true, feed: { ...feed, tags: csvToTags(feed.tags) } });
});

// 更新投喂状态（照吃 / 不吃），同时记录 updated_at
router.patch('/:id', (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  if (!['eaten', 'skipped'].includes(status)) {
    return res.status(400).json({ error: 'status 必须是 eaten 或 skipped' });
  }
  const row = db.prepare('SELECT * FROM feeds WHERE id = ? AND to_user_id = ?').get(id, req.user.id);
  if (!row) {
    return res.status(404).json({ error: '投喂记录不存在或无权操作' });
  }
  if (row.status !== 'pending') {
    return res.status(400).json({ error: '该投喂已处理过' });
  }
  db.prepare("UPDATE feeds SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(status, id);
  res.json({ ok: true });
});

// 删除投喂记录（收件人可删自己的）
router.delete('/:id', (req, res) => {
  const { id } = req.params;
  const info = db.prepare('DELETE FROM feeds WHERE id = ? AND to_user_id = ?').run(id, req.user.id);
  if (info.changes === 0) {
    return res.status(404).json({ error: '投喂记录不存在或无权删除' });
  }
  res.json({ ok: true });
});

export default router;
