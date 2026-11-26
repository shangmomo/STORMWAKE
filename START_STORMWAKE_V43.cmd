@echo off
setlocal
cd /d "%~dp0"
title STORMWAKE V43 - Playable Ship Systems
where py >nul 2>nul
if %errorlevel%==0 (
  py -3 start_v43.py
) else (
  python start_v43.py
)
if errorlevel 1 (
  echo Could not start. Install Python 3 and retry.
  pause
)
