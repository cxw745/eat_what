import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';

dotenv.config();

// 生产环境强制要求 JWT_SECRET，开发环境给默认值
const JWT_SECRET = process.env.JWT_SECRET || (process.env.NODE_ENV === 'production'
  ? null
  : 'chisha_dev_secret');

if (!JWT_SECRET) {
  console.error('❌ 生产环境必须设置 JWT_SECRET 环境变量');
  process.exit(1);
}

// token 有效期 7 天
const TOKEN_TTL = '7d';

// 签发 token
export function signToken(user) {
  return jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, {
    expiresIn: TOKEN_TTL,
  });
}

// 鉴权中间件：从 Authorization: Bearer <token> 解析用户
export function authRequired(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) {
    return res.status(401).json({ error: '未登录' });
  }
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ error: '登录已过期，请重新登录' });
  }
}
