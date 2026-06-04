@echo off
title 上线部署
cd /d "D:\导演工作室"

echo ========================================
echo    导演工作室 — 一键上线部署
echo ========================================
echo.

:: Step 1: Build
echo [1/2] 打包构建...
call npx vite build >nul 2>&1
echo   构建完成

:: Step 2: Deploy to surge.sh
echo [2/2] 发布到公网...
echo.
echo   首次使用需要注册账号（只需一次）：
echo   输入任意邮箱 + 密码即可
echo.
npx surge ./dist director-studio.surge.sh

echo.
echo ========================================
echo   上线完成！
echo   公网地址: https://director-studio.surge.sh
echo ========================================
pause
