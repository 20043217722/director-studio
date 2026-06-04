@echo off
chcp 65001 >nul
title 导演工作室 - 公网部署
cd /d "D:\导演工作室"

echo ========================================
echo   导演工作室 - 公网部署
echo   不用同WiFi，iPhone随时访问
echo ========================================
echo.

echo [1/4] 启动本地服务器...
start "Vite" npx vite --host 0.0.0.0 --port 5174
echo   等待服务器就绪...
timeout /t 5 /nobreak >nul

echo [2/4] 创建公网隧道...
echo   正在创建隧道，请稍候...
for /f "delims=" %%i in ('npx localtunnel --port 5174 2^>^&1 ^| findstr "your url"') do set TUNNEL_URL=%%i
set TUNNEL_URL=%TUNNEL_URL:your url is: =%
echo   公网地址: %TUNNEL_URL%

echo [3/4] 更新配置文件...
powershell -Command "(Get-Content 'public\director-studio.mobileconfig') -replace '<string>https://[^<]*</string>', '<string>%TUNNEL_URL%</string>' | Set-Content 'public\director-studio.mobileconfig'"

echo [4/4] 启动安装服务器...
start "iOS-Install" node ios-install.js
timeout /t 2 /nobreak >nul

echo.
echo ========================================
echo   部署完成！
echo ========================================
echo.
echo   iPhone Safari 打开以下地址下载安装:
echo   %TUNNEL_URL%
echo.
echo   首次访问会有一个验证页面，
echo   点击 "Click to Continue" 即可。
echo.
echo ========================================
pause
