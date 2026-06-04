@echo off
title 导演工作室
setlocal enabledelayedexpansion

:: Auto-elevate to admin (needed for firewall)
net session >nul 2>&1
if %errorlevel% neq 0 (
    echo 请求管理员权限以配置防火墙...
    powershell -Command "Start-Process '%~f0' -Verb RunAs"
    exit /b
)

echo ========================================
echo    导演工作室 — AI 电影创作平台
echo ========================================
echo.

:: Open firewall
echo [1/3] 配置防火墙...
netsh advfirewall firewall add rule name="Director Studio HTTP" dir=in action=allow protocol=TCP localport=5174 >nul 2>&1
netsh advfirewall firewall add rule name="Director Studio HTTPS" dir=in action=allow protocol=TCP localport=5174 >nul 2>&1
echo   已放行端口 5174

:: Get LAN IP
echo [2/3] 获取网络地址...
for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /c:"IPv4"') do (
    set TMP_IP=%%a
    set TMP_IP=!TMP_IP: =!
    if not "!TMP_IP!"=="127.0.0.1" if "!IP!"=="" set IP=!TMP_IP!
)
if "%IP%"=="" set IP=10.0.0.1
echo   本机地址: %IP%

:: Start
echo [3/3] 启动服务器 (HTTPS)...
echo.
echo ========================================
echo.
echo   电脑浏览器打开:
echo     https://localhost:5174
echo.
echo   手机浏览器打开:
echo     https://%IP%:5174
echo.
echo   ^(首次访问点"高级" ^> "继续前往"^)
echo   Chrome菜单 ^> "添加到主屏幕" = 安装App
echo.
echo ========================================
echo.
cd /d "D:\导演工作室"
set PATH=C:\Program Files\nodejs;%PATH%
npx vite --host 0.0.0.0 --port 5174
pause
