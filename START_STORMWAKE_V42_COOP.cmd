@echo off
setlocal
cd /d "%~dp0"
title STORMWAKE V42 - LAN Cooperative
where py >nul 2>nul
if %errorlevel%==0 (
  py -3 run_v39_coop_windows.py
) else (
  python run_v39_coop_windows.py
)
if errorlevel 1 (
  echo LAN host failed. Confirm Python 3 and Node.js 20+ are installed.
  pause
)
