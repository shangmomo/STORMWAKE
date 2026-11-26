@echo off
cd /d "%~dp0"
python start_v62.py
if errorlevel 1 pause
