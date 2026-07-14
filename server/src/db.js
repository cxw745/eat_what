import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { mkdirSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// 数据库文件存放在 server/data/app.db，先确保目录存在
const dataDir = join(__dirname, '..', 'data');
mkdirSync(dataDir, { recursive: true });
const dbPath = join(dataDir, 'app.db');
const db = new Database(dbPath);

// 开启 WAL 模式提升并发读
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// 建表（全新安装时执行，已含 supper 夜宵类型）
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS meals (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    meal_type TEXT NOT NULL CHECK(meal_type IN ('breakfast','lunch','dinner','supper')),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS friends (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    friend_id INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','accepted')),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id),
    FOREIGN KEY(friend_id) REFERENCES users(id),
    UNIQUE(user_id, friend_id)
  );

  CREATE TABLE IF NOT EXISTS feeds (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    from_user_id INTEGER NOT NULL,
    to_user_id INTEGER NOT NULL,
    meal_name TEXT NOT NULL,
    meal_type TEXT,
    message TEXT,
    status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','eaten','skipped')),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(from_user_id) REFERENCES users(id),
    FOREIGN KEY(to_user_id) REFERENCES users(id)
  );

  CREATE INDEX IF NOT EXISTS idx_meals_user ON meals(user_id);
  CREATE INDEX IF NOT EXISTS idx_friends_user ON friends(user_id);
  CREATE INDEX IF NOT EXISTS idx_friends_friend ON friends(friend_id);
  CREATE INDEX IF NOT EXISTS idx_feeds_to ON feeds(to_user_id);

  -- 朋友圈动态
  CREATE TABLE IF NOT EXISTS posts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    content TEXT,
    images TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id)
  );

  -- 点赞
  CREATE TABLE IF NOT EXISTS post_likes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    post_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(post_id, user_id),
    FOREIGN KEY(post_id) REFERENCES posts(id) ON DELETE CASCADE,
    FOREIGN KEY(user_id) REFERENCES users(id)
  );

  -- 评论
  CREATE TABLE IF NOT EXISTS post_comments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    post_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    content TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(post_id) REFERENCES posts(id) ON DELETE CASCADE,
    FOREIGN KEY(user_id) REFERENCES users(id)
  );

  -- 菜品标签（多对多）
  CREATE TABLE IF NOT EXISTS meal_tags (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    meal_id INTEGER NOT NULL,
    tag TEXT NOT NULL,
    FOREIGN KEY(meal_id) REFERENCES meals(id) ON DELETE CASCADE
  );

  -- 分享码
  CREATE TABLE IF NOT EXISTS shares (
    code TEXT PRIMARY KEY,
    meal_name TEXT NOT NULL,
    meal_type TEXT,
    tags TEXT,
    from_user_id INTEGER,
    from_username TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE INDEX IF NOT EXISTS idx_posts_user ON posts(user_id);
  CREATE INDEX IF NOT EXISTS idx_likes_post ON post_likes(post_id);
  CREATE INDEX IF NOT EXISTS idx_comments_post ON post_comments(post_id);
  CREATE INDEX IF NOT EXISTS idx_meal_tags_meal ON meal_tags(meal_id);
`);

// schema 迁移：v1 → v2，为旧版 meals 表的 CHECK 约束补上 supper 类型
const currentVersion = db.pragma('user_version', { simple: true });
if (currentVersion < 2) {
  const hasOldConstraint = db.prepare(`
    SELECT sql FROM sqlite_master WHERE type='table' AND name='meals'
  `).get();

  if (hasOldConstraint && !hasOldConstraint.sql.includes("'supper'")) {
    console.log('[DB] 迁移 meals 表：CHECK 约束补充 supper 类型');
    db.exec(`
      CREATE TABLE meals_new (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        name TEXT NOT NULL,
        meal_type TEXT NOT NULL CHECK(meal_type IN ('breakfast','lunch','dinner','supper')),
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(user_id) REFERENCES users(id)
      );
      INSERT INTO meals_new (id, user_id, name, meal_type, created_at)
        SELECT id, user_id, name, meal_type, created_at FROM meals;
      DROP TABLE meals;
      ALTER TABLE meals_new RENAME TO meals;
      CREATE INDEX IF NOT EXISTS idx_meals_user ON meals(user_id);
    `);
  }
  db.pragma('user_version = 2');
}

// schema 迁移：v2 → v3，meals 加 emoji/note，posts 加 meal_id，新增 pick_history 表
if (db.pragma('user_version', { simple: true }) < 3) {
  console.log('[DB] 迁移 v3: meals 加 emoji/note, posts 加 meal_id, 新增 pick_history');

  // meals 加 emoji、note 字段（ADD COLUMN 幂等前先检测）
  const mealsCols = db.prepare("PRAGMA table_info(meals)").all().map((c) => c.name);
  if (!mealsCols.includes('emoji')) {
    db.exec("ALTER TABLE meals ADD COLUMN emoji TEXT");
  }
  if (!mealsCols.includes('note')) {
    db.exec("ALTER TABLE meals ADD COLUMN note TEXT");
  }

  // posts 加 meal_id 字段
  const postsCols = db.prepare("PRAGMA table_info(posts)").all().map((c) => c.name);
  if (!postsCols.includes('meal_id')) {
    db.exec("ALTER TABLE posts ADD COLUMN meal_id INTEGER");
  }

  // 抽奖历史表
  db.exec(`
    CREATE TABLE IF NOT EXISTS pick_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      meal_id INTEGER,
      meal_name TEXT NOT NULL,
      meal_type TEXT,
      emoji TEXT,
      source TEXT DEFAULT 'self',
      from_username TEXT,
      picked_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(user_id) REFERENCES users(id)
    );
    CREATE INDEX IF NOT EXISTS idx_history_user ON pick_history(user_id);
  `);

  db.pragma('user_version = 3');
}

// schema 迁移：v3 → v4，users 加 openid/avatar_url/nickname（为微信小程序做准备）
if (db.pragma('user_version', { simple: true }) < 4) {
  console.log('[DB] 迁移 v4: users 加 openid/avatar_url/nickname');
  const userCols = db.prepare("PRAGMA table_info(users)").all().map((c) => c.name);
  if (!userCols.includes('openid')) {
    db.exec("ALTER TABLE users ADD COLUMN openid TEXT");
    db.exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_users_openid ON users(openid) WHERE openid IS NOT NULL");
  }
  if (!userCols.includes('avatar_url')) {
    db.exec("ALTER TABLE users ADD COLUMN avatar_url TEXT");
  }
  if (!userCols.includes('nickname')) {
    db.exec("ALTER TABLE users ADD COLUMN nickname TEXT");
  }
  db.pragma('user_version = 4');
}

export default db;
