@echo off
chcp 65001 >nul
title 导演工作室 - 部署到 Gitee Pages
cd /d "D:\导演工作室"

echo ========================================
echo   导演工作室 - 部署到 Gitee Pages
echo ========================================
echo.

echo [1] 构建（Pages 模式）...
set DEPLOY=pages
call npm run build
if %errorlevel% neq 0 (echo 构建失败！&& pause && exit /b 1)

echo [2] 推送到 pages 分支...
git checkout --orphan pages-tmp 2>nul
git rm -rf . 2>nul
echo dist > .gitignore
xcopy /E /Y dist\* . >nul
git add -A
git commit -m "deploy" 2>nul
git branch -D pages 2>nul
git branch -m pages
git push origin pages --force
git checkout master
git branch -D pages-tmp 2>nul

echo.
echo ========================================
echo   部署完成！
echo ========================================
echo.
echo   1. 打开 https://gitee.com/daoyanggongzuoshi/director-studio
echo   2. 服务 → Gitee Pages → 分支选 pages → 目录留空 →
echo   3. 点「更新/启动」
echo.
echo   访问地址：
echo   https://daoyanggongzuoshi.gitee.io/director-studio
echo ========================================
pause
