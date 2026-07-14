@echo off
chcp 65001 >nul
title 吃什么
cd /d "%~dp0"

echo 🍚 启动「吃什么」...

cd server
if not exist node_modules (
  echo 📦 安装后端依赖...
  call npm install
)
echo 🍳 启动后端 (http://localhost:3001)...
start "吃什么-后端" cmd /c "npm run dev"

cd ..\client
if not exist node_modules (
  echo 📦 安装前端依赖...
  call npm install
)
echo 🍱 启动前端 (http://localhost:5173)...
start "吃什么-前端" cmd /c "npm run dev"

echo.
echo ✅ 已启动！浏览器打开: http://localhost:5173
echo    关闭此窗口不会停止服务，请关闭弹出的两个窗口来停止
echo.
pause
