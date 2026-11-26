@echo off
chcp 65001 >nul
cd /d "%~dp0"
where py >nul 2>nul
if %ERRORLEVEL%==0 (
    py -3 start_v56.py
) else (
    python start_v56.py
)
if errorlevel 1 (
    echo.
    echo [STORMWAKE] Start failed. Install Python 3.10+; multiplayer host also needs Node.js 22+.
    pause
)
