@echo off
setlocal
cd /d "%~dp0"
where python >nul 2>&1
if not errorlevel 1 (python start_v54_coop.py) else (py -3 start_v54_coop.py)
if errorlevel 1 pause
