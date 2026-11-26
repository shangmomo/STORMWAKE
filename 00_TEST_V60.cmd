@echo off
chcp 65001 >nul
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (echo Node.js 22+ required.& pause& exit /b 1)
npm run test:v60
set "CODE=%ERRORLEVEL%"
if not "%CODE%"=="0" (echo TEST FAILED& pause)
exit /b %CODE%
