@echo off
chcp 65001 >nul
title 导演工作室 - 公网隧道
cd /d "D:\导演工作室"

echo ========================================
echo   导演工作室 - 公网地址
echo ========================================
echo.

echo [1] 构建最新版本...
call npm run build
echo.

echo [2] 启动 HTTP 服务...
start "Serve" npx serve dist -p 5199 --no-clipboard
timeout /t 3 /nobreak >nul

echo [3] 启动公网隧道...
:loop
echo.
echo ========================================
echo   公网地址（永久有效）：
echo   https://ruflo-studio-2026.loca.lt
echo ========================================
echo.
echo   任何设备浏览器打开上方地址
echo   首次点 "Click to Continue"
echo.
npx localtunnel --port 5199 --subdomain ruflo-studio-2026
echo 隧道断开，3秒后重连...
timeout /t 3 /nobreak >nul
goto loop
