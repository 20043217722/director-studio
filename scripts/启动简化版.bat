@echo off
chcp 65001 >nul
title 导演工作室
cd /d "D:\导演工作室"

echo.
echo ========================================
echo   导演工作室 - AI 电影创作平台
echo ========================================
echo.
echo   启动中，请稍候...
echo.

set PATH=C:\Program Files\nodejs;%PATH%
npx vite --host 0.0.0.0 --port 5174

pause
