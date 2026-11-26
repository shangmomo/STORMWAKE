@echo off
chcp 65001 >nul
cd /d "%~dp0"
where py >nul 2>nul
if %ERRORLEVEL%==0 (
    py -3 start_v58.py
) else (
    python start_v58.py
)
if errorlevel 1 (
    echo [STORMWAKE] Start failed. Python 3.10+ required; LAN host also needs Node.js 22+.
    pause
)
