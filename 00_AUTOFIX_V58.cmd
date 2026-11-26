@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo.
echo STORMWAKE V58 - Bounded AutoQA + Codex repair (opt-in)
echo This runs up to 2 iterations; source changes are kept only if tests improve.
echo Codex CLI + login, Python Playwright/Pillow, Node.js and Chrome/Edge are required.
echo All model assets and QA tests are protected from automated edits.
choice /M "Allow Codex to edit game source after a real failing WebGPU test"
if errorlevel 2 exit /b 0
where py >nul 2>nul
if %ERRORLEVEL%==0 (set PYTHON=py -3) else (set PYTHON=python)
%PYTHON% tools\autoqa\repair_loop.py --autofix --cycles 2
echo Finished. See autoqa_reports\repair_* for logs.
pause
