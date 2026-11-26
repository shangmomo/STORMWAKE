@echo off
setlocal
cd /d "%~dp0"
where python >nul 2>&1
if not errorlevel 1 (
  python start_v51.py
) else (
  py -3 start_v51.py
)
if errorlevel 1 (
  echo STORMWAKE V51 could not start. Install Python 3.10 or newer.
  pause
)
