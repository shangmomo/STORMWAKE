@echo off
cd /d "%~dp0"
where py >nul 2>nul
if errorlevel 1 (python start_v79.py %*) else (py -3 start_v79.py %*)
if errorlevel 1 pause
