@echo off
chcp 65001 >nul
title 导演工作室 - 一键上线
cd /d "D:\导演工作室"

echo 正在构建...
set DEPLOY=pages
call npm run build --silent
if %errorlevel% neq 0 (echo 构建失败！&& pause && exit /b 1)

echo 正在部署到 Netlify...
npx netlify-cli deploy --prod --dir=dist --allow-anonymous 2>&1 | findstr /C:"Site URL" /C:"Password"

echo.
echo 复制上面的网址到浏览器
echo 密码: My-Drop-Site
echo.
pause
