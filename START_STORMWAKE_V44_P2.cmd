@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo STORMWAKE V44 P2 - Heritage preview and V44 ocean
 echo For experimental heritage ship: http://127.0.0.1:5173/?stormwake=1^&heritageShip=1
 echo For original stable boat: http://127.0.0.1:5173/?stormwake=1
where py >nul 2>nul
if %errorlevel%==0 (
 py -3 start_v44.py
) else (
 python start_v44.py
)
pause
