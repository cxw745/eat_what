#!/bin/bash
# 「吃什么」一键启动脚本（macOS / Linux）
cd "$(dirname "$0")"

echo "🍚 启动「吃什么」..."

# 启动后端
cd server
if [ ! -d node_modules ]; then
  echo "📦 安装后端依赖..."
  npm install
fi
echo "🍳 启动后端 (http://localhost:3001)..."
npm run dev &
BACKEND_PID=$!

# 启动前端
cd ../client
if [ ! -d node_modules ]; then
  echo "📦 安装前端依赖..."
  npm install
fi
echo "🍱 启动前端 (http://localhost:5173)..."
npm run dev &
FRONTEND_PID=$!

echo ""
echo "✅ 已启动！浏览器打开: http://localhost:5173"
echo "   按 Ctrl+C 停止所有服务"
echo ""

# 捕获退出信号，关闭两个进程
trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; exit" INT TERM
wait
