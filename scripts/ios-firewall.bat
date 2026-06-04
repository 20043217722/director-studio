@echo off
:: 以管理员身份开防火墙 + 启动安装服务器
net session >nul 2>&1
if %errorlevel% neq 0 (
    powershell -Command "Start-Process '%~f0' -Verb RunAs"
    exit /b
)
netsh advfirewall firewall add rule name="iOS Install 8899" dir=in action=allow protocol=TCP localport=8899 >nul 2>&1
echo 防火墙已放行 8899
cd /d "%~dp0"
node ios-install.js
pause
