@echo off
cd /d "%~dp0"
where py >nul 2>nul
if errorlevel 1 (python tools\install_v71_rex.py %*) else (py -3 tools\install_v71_rex.py %*)
pause
