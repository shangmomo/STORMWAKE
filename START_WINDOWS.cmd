@echo off
setlocal
cd /d "%~dp0"
title Tidewater AI Island Companion

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js is not installed. Please install Node.js 22 from https://nodejs.org/
  pause
  exit /b 1
)

where npm >nul 2>nul
if errorlevel 1 (
  echo npm not found. Please reinstall Node.js.
  pause
  exit /b 1
)

if not exist "node_modules\vite\bin\vite.js" (
  echo Installing project dependencies for the first time...
  call npm install
  if errorlevel 1 (
    echo Dependency installation failed. Check network connectivity.
    pause
    exit /b 1
  )
)

echo.
echo Tidewater AI Island Companion
echo Wait for Vite to show its Local URL. It will open the browser automatically.
echo If port 5173 is busy, use the Local URL printed by Vite.
echo Press Ctrl+C to stop the local server.
echo.

node "node_modules\vite\bin\vite.js" --open
pause
