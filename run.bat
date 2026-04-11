@echo off
title Room NPS Launcher
echo ==========================================
echo   Room NPS 서비스를 시작합니다...
echo ==========================================

echo.
echo [1/2] 백엔드(Flask) 서버를 시작합니다...
start "Room NPS Backend" cmd /k "venv\Scripts\python app.py"

echo.
echo [2/2] 프론트엔드(Vite) 서버를 시작합니다...
start "Room NPS Frontend" cmd /k "cd frontend && npm run dev -- --port 5174"

echo.
echo 모든 서버가 실행되었습니다.
echo 프론트엔드: http://localhost:5174
echo 백엔드: http://localhost:5000
echo.
pause
