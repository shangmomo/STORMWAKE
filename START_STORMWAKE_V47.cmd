@echo off
setlocal
cd /d "%~dp0"
where python >nul 2>&1
if not errorlevel 1 (
    python start_v47.py
) else (
    py -3 start_v47.py
)
if errorlevel 1 (
    echo STORMWAKE V47 launch failed. Make sure Python 3.10+ is installed.
    pause
)
