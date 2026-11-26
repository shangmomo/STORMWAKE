@echo off
cd /d "%~dp0"
python start_v64.py
if errorlevel 1 pause
