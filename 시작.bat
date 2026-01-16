@echo off
echo ====================================
echo 상담 스케줄 관리 시스템 시작
echo ====================================
echo.
echo 서버를 시작합니다...
echo.

cd /d "%~dp0"
"C:\Program Files\nodejs\node.exe" server.js

pause
