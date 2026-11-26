@echo off
setlocal
cd /d "%~dp0"
where python >nul 2>&1
if not errorlevel 1 (
  python start_v53.py
) else (
  py -3 start_v53.py
)
if errorlevel 1 (
  echo STORMWAKE V53 startup failed. Install Python 3.10+, or check port 5173.
  pause
)
