@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo [STORMWAKE V58] Real WebGPU AutoQA: screenshots, two clients, network checks.
where py >nul 2>nul
if %ERRORLEVEL%==0 (
    set PYTHON=py -3
) else (
    set PYTHON=python
)
%PYTHON% -c "import playwright; import PIL" 2>nul
if errorlevel 1 (
    echo [SETUP] First launch: installing Python Playwright and Pillow...
    %PYTHON% -m pip install playwright pillow
    if errorlevel 1 goto failed
)
%PYTHON% tools\autoqa\runner.py --headed
set "QA_RC=%ERRORLEVEL%"
if not "%QA_RC%"=="0" (
    echo [AUTOQA] One or more tests FAILED or environment blocked. Read autoqa_reports\V58_*\REPORT_zh.md
) else (
    echo [AUTOQA] Automated checks completed. Visual footage still requires review.
)
echo Reports are saved in autoqa_reports.
pause
exit /b %QA_RC%
:failed
echo Install Python 3.10+ and Python package tools, then retry.
pause
exit /b 1
