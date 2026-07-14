import { Router } from 'express';
import db from '../db.js';
import { signToken } from '../auth.js';

const router = Router();

// 微信小程序登录：用 code 换 openid，自动建/取用户
// 前端调用：wx.login() 拿到 code，POST /api/auth/wx-login { code, nickname?, avatar_url? }
router.post('/wx-login', async (req, res) => {
  const { code, nickname, avatar_url } = req.body;
  if (!code || typeof code !== 'string') {
    return res.status(400).json({ error: '缺少 code' });
  }

  const APPID = process.env.WX_APPID;
  const SECRET = process.env.WX_SECRET;

  // 未配置微信凭据：开发模式返回明确提示，方便联调
  if (!APPID || !SECRET) {
    return res.status(500).json({ error: '服务器未配置 WX_APPID / WX_SECRET' });
  }

  // 调微信 code2session 接口
  let openid;
  let sessionKey;
  try {
    const url = `https://api.weixin.qq.com/sns/jscode2session?appid=${APPID}&secret=${SECRET}&js_code=${encodeURIComponent(code)}&grant_type=authorization_code`;
    const resp = await fetch(url);
    const data = await resp.json();
    if (data.errcode) {
      console.error('[wx-login] code2session 失败', data);
      return res.status(400).json({ error: `微信登录失败：${data.errmsg || data.errcode}` });
    }
    openid = data.openid;
    sessionKey = data.session_key; // 暂不存储，按需扩展
  } catch (e) {
    console.error('[wx-login] 请求微信接口异常', e);
    return res.status(500).json({ error: '微信服务暂不可用' });
  }

  if (!openid) {
    return res.status(400).json({ error: '未获取到 openid' });
  }

  // 按 openid 查用户
  let user = db.prepare('SELECT * FROM users WHERE openid = ?').get(openid);
  if (!user) {
    // 新用户：自动建账号，username 用 openid 前缀保证唯一
    const baseName = 'wx_' + openid.slice(-8);
    let username = baseName;
    let n = 1;
    while (db.prepare('SELECT id FROM users WHERE username = ?').get(username)) {
      username = `${baseName}_${n++}`;
    }
    const info = db.prepare(`
      INSERT INTO users (username, password_hash, openid, nickname, avatar_url)
      VALUES (?, '', ?, ?, ?)
    `).run(username, openid, nickname || null, avatar_url || null);
    user = db.prepare('SELECT * FROM users WHERE id = ?').get(info.lastInsertRowid);
  } else if (nickname || avatar_url) {
    // 已有用户：如传了新昵称/头像则更新（小程序每次登录可刷新）
    db.prepare(`
      UPDATE users SET
        nickname = COALESCE(?, nickname),
        avatar_url = COALESCE(?, avatar_url)
      WHERE id = ?
    `).run(nickname || null, avatar_url || null, user.id);
    user = db.prepare('SELECT * FROM users WHERE id = ?').get(user.id);
  }

  const token = signToken({ id: user.id, username: user.username });
  res.json({
    token,
    user: {
      id: user.id,
      username: user.username,
      nickname: user.nickname,
      avatar_url: user.avatar_url,
    },
  });
});

export default router;
