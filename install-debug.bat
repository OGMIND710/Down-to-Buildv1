@echo off
REM ============================================================
REM  DTB - Diagnostic launcher
REM  Runs install.bat in NON-INTERACTIVE capture mode:
REM   - sets DTB_NONINTERACTIVE so install.bat skips all prompts
REM     (no model pull, no auto-start of dev server)
REM   - captures every stdout/stderr line to install.log
REM   - if install.bat closes unexpectedly, this window STAYS open
REM   - opens the log in Notepad and prints the last lines on screen
REM ============================================================

setlocal EnableExtensions
set "HERE=%~dp0"
set "LOG=%HERE%install.log"
set "MAIN=%HERE%install.bat"

echo.
echo  ========================================================
echo   DTB diagnostic / capture run
echo   - install.bat : %MAIN%
echo   - log file    : %LOG%
echo   - mode        : non-interactive (no questions asked)
echo  ========================================================
echo.

if not exist "%MAIN%" (
    echo [!] install.bat not found in %HERE%
    echo     Place install-debug.bat next to install.bat and re-run.
    pause
    exit /b 1
)

REM Admin check (so privilege errors don't pollute the log)
net session >nul 2>&1
if errorlevel 1 (
    echo [!] This script must be run as Administrator.
    echo     Right-click install-debug.bat -^> Run as administrator.
    pause
    exit /b 1
)

REM Fresh log + header
> "%LOG%" echo === DTB Installer log : %DATE% %TIME% ===
>>"%LOG%" echo CWD: %CD%
>>"%LOG%" echo USER: %USERNAME%
>>"%LOG%" echo COMPUTER: %COMPUTERNAME%
>>"%LOG%" echo OS:
>>"%LOG%" ver
>>"%LOG%" echo.

echo Starting install.bat in capture mode...
echo (the window may look idle during long steps - that's normal)
echo You can tail the log in another terminal:
echo     powershell -Command "Get-Content '%LOG%' -Wait -Tail 20"
echo.

REM Run the installer. We set DTB_NONINTERACTIVE so set/p prompts auto-default.
REM We use 'call' so ERRORLEVEL bubbles back.
set "DTB_NONINTERACTIVE=1"
call "%MAIN%" >>"%LOG%" 2>&1
set "RC=%ERRORLEVEL%"

echo.
echo  ========================================================
echo   install.bat exited with code : %RC%
echo   Log file                     : %LOG%
echo  ========================================================
echo.

REM Tail the last 60 lines so user sees the end of the log without opening file
echo Last 60 lines of the log:
echo --------------------------------------------------------
powershell -NoProfile -Command "if (Test-Path '%LOG%') { Get-Content -Path '%LOG%' -Tail 60 } else { 'Log file missing.' }"
echo --------------------------------------------------------
echo.

REM Open the full log in Notepad
echo Opening full log in Notepad...
start "" notepad "%LOG%"

echo.
echo This window will stay open. Copy the log content from Notepad
echo or grab the file at: %LOG%
echo.
pause
exit /b %RC%
