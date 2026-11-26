@echo off
setlocal
cd /d "%~dp0"
where python >nul 2>&1
if not errorlevel 1 (python start_v54.py) else (py -3 start_v54.py)
if errorlevel 1 pause
