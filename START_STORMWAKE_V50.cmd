@echo off
setlocal
cd /d "%~dp0"
where python >nul 2>&1
if not errorlevel 1 (
  python start_v50.py
) else (
  py -3 start_v50.py
)
if errorlevel 1 (
  echo STORMWAKE V50 could not start. Install Python 3.10 or newer.
  pause
)
