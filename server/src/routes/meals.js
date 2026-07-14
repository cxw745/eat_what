import { Router } from 'express';
import db from '../db.js';
import { authRequired } from '../auth.js';

const router = Router();
router.use(authRequired);

const VALID_TYPES = ['breakfast', 'lunch', 'dinner', 'supper'];

// 把 meal 行的 tags_csv 转成数组
function withTags(meal) {
  if (!meal) return null;
  return {
    ...meal,
    tags: meal.tags_csv ? meal.tags_csv.split(',') : [],
    tags_csv: undefined,
  };
}

// 查询带标签的 meal
function getMealWithTags(id) {
  const row = db.prepare(`
    SELECT m.*,
      (SELECT GROUP_CONCAT(tag, ',') FROM meal_tags WHERE meal_id = m.id) AS tags_csv
    FROM meals m WHERE m.id = ?
  `).get(id);
  return withTags(row);
}

// 获取自己的餐库（可按 meal_type 过滤，可按 tag 筛选）
router.get('/', (req, res) => {
  const { meal_type, tag } = req.query;
  if (meal_type && !VALID_TYPES.includes(meal_type)) {
    return res.status(400).json({ error: 'meal_type 参数非法' });
  }

  let rows;
  if (meal_type) {
    rows = db.prepare(`
      SELECT m.*,
        (SELECT GROUP_CONCAT(tag, ',') FROM meal_tags WHERE meal_id = m.id) AS tags_csv
      FROM meals m WHERE m.user_id = ? AND m.meal_type = ?
      ORDER BY m.id DESC
    `).all(req.user.id, meal_type);
  } else {
    rows = db.prepare(`
      SELECT m.*,
        (SELECT GROUP_CONCAT(tag, ',') FROM meal_tags WHERE meal_id = m.id) AS tags_csv
      FROM meals m WHERE m.user_id = ?
      ORDER BY m.id DESC
    `).all(req.user.id);
  }

  let result = rows.map(withTags);
  // 按标签筛选
  if (tag) {
    result = result.filter((m) => m.tags.includes(tag));
  }
  res.json({ meals: result });
});

// emoji 校验：只允许单字符（含组合 emoji），最多 8 字节
function sanitizeEmoji(e) {
  if (typeof e !== 'string') return null;
  const t = e.trim();
  if (!t) return null;
  // 取第一个 grapheme（简单处理：截断到 2 个码点）
  return t.slice(0, 2);
}

// 添加菜品（含标签 + emoji + 备注）
router.post('/', (req, res) => {
  const { name, meal_type, tags, emoji, note } = req.body;
  if (!name || typeof name !== 'string' || !name.trim()) {
    return res.status(400).json({ error: '菜品名不能为空' });
  }
  if (name.trim().length > 30) {
    return res.status(400).json({ error: '菜品名最多 30 个字符' });
  }
  if (!VALID_TYPES.includes(meal_type)) {
    return res.status(400).json({ error: 'meal_type 必须是 breakfast/lunch/dinner/supper' });
  }
  const tagList = Array.isArray(tags) ? tags.filter((t) => typeof t === 'string' && t.length <= 10).slice(0, 10) : [];
  const emojiVal = sanitizeEmoji(emoji);
  const noteVal = typeof note === 'string' ? note.trim().slice(0, 100) : null;

  const info = db.prepare('INSERT INTO meals (user_id, name, meal_type, emoji, note) VALUES (?, ?, ?, ?, ?)').run(
    req.user.id, name.trim(), meal_type, emojiVal, noteVal
  );
  const mealId = info.lastInsertRowid;
  if (tagList.length) {
    const stmt = db.prepare('INSERT INTO meal_tags (meal_id, tag) VALUES (?, ?)');
    tagList.forEach((t) => stmt.run(mealId, t));
  }
  res.json({ meal: getMealWithTags(mealId) });
});

// 编辑菜品（名称 + 标签 + emoji + 备注）
router.put('/:id', (req, res) => {
  const { id } = req.params;
  const { name, tags, emoji, note } = req.body;
  const meal = db.prepare('SELECT * FROM meals WHERE id = ? AND user_id = ?').get(id, req.user.id);
  if (!meal) return res.status(404).json({ error: '菜品不存在或无权编辑' });

  if (name && typeof name === 'string' && name.trim() && name.trim().length <= 30) {
    db.prepare('UPDATE meals SET name = ? WHERE id = ?').run(name.trim(), id);
  }
  // emoji：传 null 表示清除，传字符串表示设置
  if (emoji !== undefined) {
    db.prepare('UPDATE meals SET emoji = ? WHERE id = ?').run(sanitizeEmoji(emoji), id);
  }
  if (note !== undefined) {
    db.prepare('UPDATE meals SET note = ? WHERE id = ?').run(
      typeof note === 'string' ? note.trim().slice(0, 100) : null, id
    );
  }

  // 更新标签：先删后增
  if (Array.isArray(tags)) {
    db.prepare('DELETE FROM meal_tags WHERE meal_id = ?').run(id);
    const tagList = tags.filter((t) => typeof t === 'string' && t.length <= 10).slice(0, 10);
    const stmt = db.prepare('INSERT INTO meal_tags (meal_id, tag) VALUES (?, ?)');
    tagList.forEach((t) => stmt.run(id, t));
  }
  res.json({ meal: getMealWithTags(id) });
});

// 删除菜品
router.delete('/:id', (req, res) => {
  const { id } = req.params;
  const info = db.prepare('DELETE FROM meals WHERE id = ? AND user_id = ?').run(id, req.user.id);
  if (info.changes === 0) {
    return res.status(404).json({ error: '菜品不存在或无权删除' });
  }
  res.json({ ok: true });
});

// 随机抽自己一道菜（可指定 meal_type，可指定 tag 筛选）
router.get('/random', (req, res) => {
  const { meal_type, tag } = req.query;
  if (meal_type && !VALID_TYPES.includes(meal_type)) {
    return res.status(400).json({ error: 'meal_type 参数非法' });
  }

  let rows;
  if (meal_type) {
    rows = db.prepare(`
      SELECT m.*,
        (SELECT GROUP_CONCAT(tag, ',') FROM meal_tags WHERE meal_id = m.id) AS tags_csv
      FROM meals m WHERE m.user_id = ? AND m.meal_type = ?
    `).all(req.user.id, meal_type);
  } else {
    rows = db.prepare(`
      SELECT m.*,
        (SELECT GROUP_CONCAT(tag, ',') FROM meal_tags WHERE meal_id = m.id) AS tags_csv
      FROM meals m WHERE m.user_id = ?
    `).all(req.user.id);
  }

  let result = rows.map(withTags);
  if (tag) {
    result = result.filter((m) => m.tags.includes(tag));
  }

  if (result.length === 0) {
    return res.json({ meal: null });
  }
  const meal = result[Math.floor(Math.random() * result.length)];
  // 记录抽奖历史
  db.prepare(`INSERT INTO pick_history (user_id, meal_id, meal_name, meal_type, emoji, source) VALUES (?, ?, ?, ?, ?, 'self')`).run(
    req.user.id, meal.id, meal.name, meal.meal_type, meal.emoji || null
  );
  res.json({ meal });
});

export default router;
