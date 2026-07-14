# 🍚 吃什么

解决"今天吃什么"选择困难的 Web 应用。支持账号体系、好友互动，三大核心功能：

1. **我的餐库 + 随机抽** — 录入常吃的早/中/晚餐，一键随机抽一道
2. **抽好友的** — 从好友餐库随机抽一道，吃腻自己的就来点新鲜
3. **好友投喂** — 好友直接指定你今天吃什么，你来照做

## 技术栈

- 前端：Vue 3 + Vite + Pinia + Vue Router
- 后端：Node.js + Express
- 数据库：SQLite (better-sqlite3)
- 鉴权：JWT（支持用户名密码 + 微信小程序登录）

## 关于微信小程序迁移

架构已为后续迁移到微信小程序做好准备：

- **后端**：完全复用，无需改动。新增了 `/api/auth/wx-login` 接口，users 表已加 `openid/avatar_url/nickname` 字段
- **前端**：API 层封装兼容 uni-app，迁移时把 axios 换成 `uni.request` 即可，业务代码零修改
- **资源路径**：后端通过 `BASE_URL` 环境变量返回完整图片 URL，小程序可直接加载

迁移步骤详见各目录下的 `.env.example`。

## 快速开始

### 方式一：一键启动（推荐）

- macOS / Linux：终端执行 `./启动.sh`
- Windows：双击 `启动.bat`

脚本会自动安装依赖并启动前后端。

### 方式二：手动启动

需要两个终端窗口：

**终端 1 — 后端**
```bash
cd server
npm install
npm run dev
```
后端跑在 http://localhost:3001

**终端 2 — 前端**
```bash
cd client
npm install
npm run dev
```
前端跑在 http://localhost:5173

浏览器打开 http://localhost:5173 即可使用。

## 使用流程

1. 注册一个账号（用户名 + 密码即可，无需手机号）
2. 让朋友也注册一个账号
3. 互加好友（用用户名搜索，对方同意后成为好友）
4. 各自在「餐库」添加常吃的菜（按早/中/晚分类）
5. 玩转三大功能：
   - 首页点「抽我自己的」随机抽一道
   - 首页点「抽好友的」从好友餐库抽一道
   - 首页点「看投喂」或好友页点「投喂他」，给好友指定一道菜

## 配置说明

后端配置在 `server/.env`（参考 `.env.example`）：

```
PORT=3001
JWT_SECRET=chisha_secret_change_me_2026
# 资源访问基础地址（小程序迁移必填，例：https://chisha.example.com）
BASE_URL=
# 微信小程序登录凭据（暂未启用小程序可留空）
WX_APPID=
WX_SECRET=
```

前端配置在 `client/.env`（参考 `.env.example`）：

```
# 开发环境留空即可，生产/小程序填后端域名
VITE_API_BASE=
VITE_ASSET_BASE=
```

数据库文件自动创建在 `server/data/app.db`，删除即可重置数据。

## 目录结构

```
吃什么/
├── client/      # Vue 3 前端
├── server/      # Express 后端
├── 启动.sh       # macOS/Linux 启动脚本
├── 启动.bat      # Windows 启动脚本
└── README.md
```
