@echo off
chcp 65001 >nul
cd /d "%~dp0"
where py >nul 2>nul
if %ERRORLEVEL%==0 (
    py -3 start_v60.py
) else (
    python start_v60.py
)
if errorlevel 1 (echo [ERROR] Launch failed. Check Python 3.10+ and Node 22+ for hosting.& pause)
