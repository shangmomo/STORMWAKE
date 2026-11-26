@echo off
setlocal
cd /d "%~dp0"
title STORMWAKE V41 - Ship Repair
where py >nul 2>nul
if %errorlevel%==0 (
  py -3 start_v41.py
) else (
  python start_v41.py
)
if errorlevel 1 (
  echo Launch failed. Install Python 3, then run: python start_v41.py
  pause
)
