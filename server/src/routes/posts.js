import { Router } from 'express';
import multer from 'multer';
import { fileURLToPath } from 'url';
import { dirname, join, extname } from 'path';
import { randomBytes } from 'crypto';
import db from '../db.js';
import { authRequired } from '../auth.js';

const router = Router();
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// multer 配置：存到 uploads/posts，文件名随机
const storage = multer.diskStorage({
  destination: join(__dirname, '..', '..', 'uploads', 'posts'),
  filename: (req, file, cb) => {
    const ext = extname(file.originalname) || '.jpg';
    const name = Date.now() + '_' + randomBytes(6).toString('hex') + ext;
    cb(null, name);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    const ok = /jpeg|jpg|png|webp/i.test(file.mimetype);
    cb(ok ? null : new Error('仅支持 jpg/png/webp 格式'), ok);
  },
});

// 辅助：为 post 附加统计和当前用户点赞状态
function enrichPost(post, currentUserId) {
  const likes = db.prepare(`
    SELECT l.*, u.username FROM post_likes l
    JOIN users u ON l.user_id = u.id
    WHERE l.post_id = ?
    ORDER BY l.id DESC
  `).all(post.id);
  const commentCount = db.prepare('SELECT COUNT(*) AS c FROM post_comments WHERE post_id = ?').get(post.id).c;
  const baseUrl = process.env.BASE_URL || '';
  const images = post.images ? JSON.parse(post.images) : [];
  return {
    ...post,
    // 相对路径补全成完整 URL，小程序可直接用
    images: images.map((u) => (u.startsWith('http') ? u : baseUrl + u)),
    likes,
    like_count: likes.length,
    liked: currentUserId ? likes.some((l) => l.user_id === currentUserId) : false,
    comment_count: commentCount,
  };
}

// 信息流：自己 + 好友的动态
router.get('/', authRequired, (req, res) => {
  const limit = Math.min(parseInt(req.query.limit, 10) || 30, 50);
  const offset = Math.max(parseInt(req.query.offset, 10) || 0, 0);

  // 找出所有好友 user_id
  const friendRows = db.prepare(`
    SELECT CASE WHEN user_id = ? THEN friend_id ELSE user_id END AS uid
    FROM friends
    WHERE status = 'accepted' AND (user_id = ? OR friend_id = ?)
  `).all(req.user.id, req.user.id, req.user.id);
  const ids = [req.user.id, ...friendRows.map((r) => r.uid)];

  const placeholders = ids.map(() => '?').join(',');
  const rows = db.prepare(`
    SELECT p.*, u.username, u.id AS user_id
    FROM posts p JOIN users u ON p.user_id = u.id
    WHERE p.user_id IN (${placeholders})
    ORDER BY p.id DESC
    LIMIT ? OFFSET ?
  `).all(...ids, limit, offset);

  res.json({ posts: rows.map((p) => attachMeal(enrichPost(p, req.user.id))) });
});

// 某用户的动态
router.get('/user/:username', authRequired, (req, res) => {
  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(req.params.username);
  if (!user) return res.status(404).json({ error: '用户不存在' });

  const rows = db.prepare(`
    SELECT p.*, u.username, u.id AS user_id
    FROM posts p JOIN users u ON p.user_id = u.id
    WHERE p.user_id = ?
    ORDER BY p.id DESC
    LIMIT 50
  `).all(user.id);

  res.json({ user: { id: user.id, username: user.username }, posts: rows.map((p) => attachMeal(enrichPost(p, req.user.id))) });
});

// 辅助：关联菜品信息
function attachMeal(post) {
  if (!post.meal_id) return { ...post, meal: null };
  const meal = db.prepare(`
    SELECT m.*,
      (SELECT GROUP_CONCAT(tag, ',') FROM meal_tags WHERE meal_id = m.id) AS tags_csv
    FROM meals m WHERE m.id = ?
  `).get(post.meal_id);
  if (!meal) return { ...post, meal: null };
  return {
    ...post,
    meal: {
      ...meal,
      tags: meal.tags_csv ? meal.tags_csv.split(',') : [],
      tags_csv: undefined,
    },
  };
}

// 发动态（带图片上传，multipart/form-data）
router.post('/', authRequired, upload.array('images', 3), (req, res) => {
  const content = (req.body.content || '').trim();
  const mealId = req.body.meal_id ? parseInt(req.body.meal_id, 10) : null;
  if (!content && req.files.length === 0 && !mealId) {
    return res.status(400).json({ error: '说点什么、传张图或选一道菜' });
  }
  if (content.length > 200) {
    return res.status(400).json({ error: '文字最多 200 字' });
  }
  // 校验 meal_id 归属当前用户
  let validMealId = null;
  if (mealId) {
    const meal = db.prepare('SELECT id FROM meals WHERE id = ? AND user_id = ?').get(mealId, req.user.id);
    if (meal) validMealId = mealId;
  }
  const images = req.files.map((f) => `/uploads/posts/${f.filename}`);
  const info = db.prepare('INSERT INTO posts (user_id, content, images, meal_id) VALUES (?, ?, ?, ?)').run(
    req.user.id,
    content || null,
    JSON.stringify(images),
    validMealId
  );
  const post = db.prepare('SELECT p.*, u.username, u.id AS user_id FROM posts p JOIN users u ON p.user_id = u.id WHERE p.id = ?').get(info.lastInsertRowid);
  res.json({ post: attachMeal(enrichPost(post, req.user.id)) });
});

// 删除动态（仅作者）
router.delete('/:id', authRequired, (req, res) => {
  const { id } = req.params;
  const post = db.prepare('SELECT * FROM posts WHERE id = ? AND user_id = ?').get(id, req.user.id);
  if (!post) return res.status(404).json({ error: '动态不存在或无权删除' });
  db.prepare('DELETE FROM posts WHERE id = ?').run(id);
  res.json({ ok: true });
});

// 点赞
router.post('/:id/like', authRequired, (req, res) => {
  const { id } = req.params;
  try {
    db.prepare('INSERT INTO post_likes (post_id, user_id) VALUES (?, ?)').run(id, req.user.id);
  } catch {
    return res.status(409).json({ error: '已点赞过' });
  }
  res.json({ ok: true });
});

// 取消点赞
router.delete('/:id/like', authRequired, (req, res) => {
  db.prepare('DELETE FROM post_likes WHERE post_id = ? AND user_id = ?').run(req.params.id, req.user.id);
  res.json({ ok: true });
});

// 评论列表
router.get('/:id/comments', authRequired, (req, res) => {
  const rows = db.prepare(`
    SELECT c.*, u.username FROM post_comments c
    JOIN users u ON c.user_id = u.id
    WHERE c.post_id = ?
    ORDER BY c.id ASC
  `).all(req.params.id);
  res.json({ comments: rows });
});

// 发评论
router.post('/:id/comments', authRequired, (req, res) => {
  const content = (req.body.content || '').trim();
  if (!content) return res.status(400).json({ error: '评论内容不能为空' });
  if (content.length > 100) return res.status(400).json({ error: '评论最多 100 字' });

  const post = db.prepare('SELECT id FROM posts WHERE id = ?').get(req.params.id);
  if (!post) return res.status(404).json({ error: '动态不存在' });

  const info = db.prepare('INSERT INTO post_comments (post_id, user_id, content) VALUES (?, ?, ?)').run(req.params.id, req.user.id, content);
  const comment = db.prepare('SELECT c.*, u.username FROM post_comments c JOIN users u ON c.user_id = u.id WHERE c.id = ?').get(info.lastInsertRowid);
  res.json({ comment });
});

// 删除评论（仅评论作者本人）
router.delete('/:id/comments/:commentId', authRequired, (req, res) => {
  const { id, commentId } = req.params;
  const row = db.prepare('SELECT * FROM post_comments WHERE id = ? AND post_id = ?').get(commentId, id);
  if (!row) {
    return res.status(404).json({ error: '评论不存在' });
  }
  // 仅评论作者可删除（动态作者也可删自己动态下的评论，按需扩展）
  if (row.user_id !== req.user.id) {
    return res.status(403).json({ error: '只能删除自己的评论' });
  }
  db.prepare('DELETE FROM post_comments WHERE id = ?').run(commentId);
  res.json({ ok: true });
});

export default router;
