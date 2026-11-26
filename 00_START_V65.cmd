@echo off
cd /d "%~dp0"
python start_v65.py
if errorlevel 1 pause
