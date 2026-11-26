@echo off
chcp 65001 >nul
cd /d "%~dp0"
where py >nul 2>nul
if %ERRORLEVEL%==0 (
  py -3 tools\autoqa\runner.py --headed
) else (
  python tools\autoqa\runner.py --headed
)
if errorlevel 1 echo AUTOQA not passed; see report.
pause
