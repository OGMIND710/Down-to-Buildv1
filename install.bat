@echo off
REM ============================================================
REM  DTB - Down To Build : Windows All-in-One Installer
REM  Installs : Node LTS, Yarn, Git, MongoDB, Ollama, project deps
REM  Configures: .env, pulls a coding model, starts the dev server
REM ============================================================

setlocal EnableDelayedExpansion
title DTB - Down To Build Installer

REM ---------- Pretty banner ----------
echo.
echo  =============================================================
echo                                                            
echo                  DTB  -  DOWN TO BUILD                     
echo               Windows installer / bootstrap                
echo                                                            
echo  =============================================================
echo.

REM ---------- 0. Admin check ----------
net session >nul 2>&1
if %errorLevel% NEQ 0 (
    echo [!] This installer needs Administrator privileges.
    echo     Right-click "install.bat" -^> "Run as administrator".
    echo.
    pause
    exit /b 1
)
echo [OK] Running as Administrator.
echo.

REM ---------- 1. Check / install winget ----------
echo [1/10] Checking winget...
where winget >nul 2>&1
if %errorLevel% NEQ 0 (
    echo [!] winget not found. Please install "App Installer" from the Microsoft Store first:
    echo     ms-windows-store://pdp/?productid=9NBLGGH4NNS1
    echo.
    pause
    exit /b 1
)
echo [OK] winget available.
echo.

REM ---------- 2. Node.js LTS ----------
echo [2/10] Checking Node.js...
where node >nul 2>&1
if %errorLevel% NEQ 0 (
    echo     Installing Node.js LTS via winget...
    winget install --id OpenJS.NodeJS.LTS -e --silent --accept-package-agreements --accept-source-agreements
    if !errorLevel! NEQ 0 (
        echo [!] Node.js installation failed.
        pause
        exit /b 1
    )
    echo     Refreshing PATH...
    call :refresh_path
) else (
    for /f "tokens=*" %%v in ('node -v') do set NODEV=%%v
    echo [OK] Node.js !NODEV! already installed.
)
echo.

REM ---------- 3. Git ----------
echo [3/10] Checking Git...
where git >nul 2>&1
if %errorLevel% NEQ 0 (
    echo     Installing Git via winget...
    winget install --id Git.Git -e --silent --accept-package-agreements --accept-source-agreements
    call :refresh_path
) else (
    echo [OK] Git already installed.
)
echo.

REM ---------- 4. Yarn ----------
echo [4/10] Checking Yarn...
where yarn >nul 2>&1
if %errorLevel% NEQ 0 (
    echo     Installing Yarn globally via npm...
    call npm install -g yarn
    if !errorLevel! NEQ 0 (
        echo [!] Yarn install failed.
        pause
        exit /b 1
    )
) else (
    for /f "tokens=*" %%v in ('yarn -v') do set YARNV=%%v
    echo [OK] Yarn !YARNV! already installed.
)
echo.

REM ---------- 5. MongoDB Community ----------
echo [5/10] Checking MongoDB Community Edition...
where mongod >nul 2>&1
if %errorLevel% NEQ 0 (
    sc query MongoDB >nul 2>&1
    if !errorLevel! NEQ 0 (
        echo     Installing MongoDB Community 7.0 via winget...
        winget install --id MongoDB.Server -e --silent --accept-package-agreements --accept-source-agreements
        if !errorLevel! NEQ 0 (
            echo [!] MongoDB install via winget failed.
            echo     Falling back: download installer manually from:
            echo     https://www.mongodb.com/try/download/community
            pause
        )
        call :refresh_path
    )
) else (
    echo [OK] MongoDB already installed.
)

REM Start MongoDB service if installed
sc query MongoDB >nul 2>&1
if !errorLevel! EQU 0 (
    sc query MongoDB | findstr "RUNNING" >nul
    if !errorLevel! NEQ 0 (
        echo     Starting MongoDB service...
        net start MongoDB >nul 2>&1
    ) else (
        echo [OK] MongoDB service is running.
    )
) else (
    echo [!] MongoDB service not registered. You may need to start mongod manually.
)
echo.

REM ---------- 6. Ollama ----------
echo [6/10] Checking Ollama...
where ollama >nul 2>&1
if %errorLevel% NEQ 0 (
    echo     Ollama not found. Installing via winget...
    winget install --id Ollama.Ollama -e --silent --accept-package-agreements --accept-source-agreements
    if !errorLevel! NEQ 0 (
        echo [!] winget could not install Ollama. Trying direct download...
        set "OLLAMA_INSTALLER=%TEMP%\OllamaSetup.exe"
        echo     Downloading from https://ollama.com/download/OllamaSetup.exe ...
        powershell -NoProfile -Command "try { Invoke-WebRequest -Uri 'https://ollama.com/download/OllamaSetup.exe' -OutFile '!OLLAMA_INSTALLER!' -UseBasicParsing } catch { exit 1 }"
        if exist "!OLLAMA_INSTALLER!" (
            echo     Running Ollama installer (may show GUI)...
            start /wait "" "!OLLAMA_INSTALLER!" /S
        ) else (
            echo [!] Could not download Ollama. Install manually from https://ollama.com
        )
    )
    call :refresh_path
) else (
    for /f "tokens=*" %%v in ('ollama --version 2^>nul') do set OLLAMAV=%%v
    echo [OK] Ollama !OLLAMAV! already installed.
)

REM Try to pull a coding model in background-friendly way
where ollama >nul 2>&1
if !errorLevel! EQU 0 (
    echo.
    set /p PULLM="    Pull recommended coding model qwen2.5-coder:7b now? (~4.7 GB) [y/N]: "
    if /I "!PULLM!"=="y" (
        echo     Starting ollama service in background...
        start "" /B ollama serve >nul 2>&1
        timeout /t 3 /nobreak >nul
        echo     Pulling qwen2.5-coder:7b (this can take a while)...
        ollama pull qwen2.5-coder:7b
    ) else (
        echo     Skipped. You can pull later with: ollama pull qwen2.5-coder:7b
    )
)
echo.

REM ---------- 7. Cline VS Code extension ----------
echo [7/10] Checking VS Code and installing Cline extension...
where code >nul 2>&1
if %errorLevel% NEQ 0 (
    echo [!] VS Code 'code' command not found.
    echo     Cline runs INSIDE VS Code. Install VS Code first:
    echo         https://code.visualstudio.com/download
    echo     Then re-run this installer, or install manually with:
    echo         code --install-extension saoudrizwan.claude-dev
    echo.
    set /p VSI="    Try to install VS Code via winget now? [y/N]: "
    if /I "!VSI!"=="y" (
        winget install --id Microsoft.VisualStudioCode -e --silent --accept-package-agreements --accept-source-agreements
        call :refresh_path
    )
)
where code >nul 2>&1
if %errorLevel% EQU 0 (
    code --list-extensions 2>nul | findstr /i "saoudrizwan.claude-dev" >nul
    if !errorLevel! NEQ 0 (
        echo     Installing Cline extension (saoudrizwan.claude-dev)...
        code --install-extension saoudrizwan.claude-dev --force
        if !errorLevel! EQU 0 (
            echo [OK] Cline extension installed.
            echo     To wire it to Ollama: open VS Code, Cline panel, gear icon,
            echo     API Provider: Ollama, Base URL: http://localhost:11434
        ) else (
            echo [!] Cline install returned non-zero. You can install manually later.
        )
    ) else (
        echo [OK] Cline extension already installed.
    )
) else (
    echo [!] Skipping Cline - VS Code not available in PATH.
)
echo.

REM ---------- 8. Project setup ----------
echo [8/10] Setting up DTB project...
if not exist "package.json" (
    echo [!] package.json NOT FOUND in current directory.
    echo     Run this installer from the root of the DTB project ^(where package.json lives^).
    echo     If you haven't cloned it yet:
    echo         git clone ^<your-repo-url^> dtb
    echo         cd dtb
    echo         install.bat
    pause
    exit /b 1
)
echo [OK] Found package.json in %CD%.

REM ---------- 8. .env file ----------
echo [9/10] Configuring environment variables...
if exist ".env" (
    echo [OK] .env already exists - leaving it untouched.
) else (
    echo     Creating .env with default DTB values...
    (
        echo MONGO_URL=mongodb://localhost:27017
        echo DB_NAME=dtb
        echo NEXT_PUBLIC_BASE_URL=http://localhost:3000
        echo CORS_ORIGINS=*
    ) > .env
    echo [OK] .env created.
)
echo.

REM ---------- 10. Install JS deps ----------
echo [10/10] Installing JavaScript dependencies with yarn (this can take a few minutes)...
call yarn install
if !errorLevel! NEQ 0 (
    echo [!] yarn install failed. Check the output above.
    pause
    exit /b 1
)
echo.
echo  =============================================================
echo                                                            
echo            DTB INSTALLED SUCCESSFULLY                      
echo                                                            
echo  =============================================================
echo.
echo  Next steps:
echo    * Start DTB :              yarn dev
echo    * Then open  :              http://localhost:3000
echo    * Use Ollama :              ollama serve  ^(in a separate window^)
echo    * Settings   :              http://localhost:3000/settings
echo.
echo  Optional models to pull later:
echo    ollama pull llama3.2              (3B, fast)
echo    ollama pull qwen2.5-coder:7b      (best for coding)
echo    ollama pull deepseek-coder-v2     (16B, very capable)
echo.

set /p STARTNOW="Start DTB dev server now? [Y/n]: "
if /I "!STARTNOW!"=="n" (
    echo  Bye!
    pause
    exit /b 0
)

echo.
echo  Launching yarn dev ...
start "DTB" cmd /k "yarn dev"
timeout /t 5 /nobreak >nul
start "" "http://localhost:3000"
echo  DTB is starting. The browser will open shortly.
echo.
pause
exit /b 0


REM ============================================================
REM  Helpers
REM ============================================================
:refresh_path
REM Refresh the current PATH from registry without reopening shell.
for /f "tokens=2*" %%a in ('reg query "HKLM\SYSTEM\CurrentControlSet\Control\Session Manager\Environment" /v PATH 2^>nul ^| findstr /i "PATH"') do set "SYSPATH=%%b"
for /f "tokens=2*" %%a in ('reg query "HKCU\Environment" /v PATH 2^>nul ^| findstr /i "PATH"') do set "USRPATH=%%b"
set "PATH=%SYSPATH%;%USRPATH%"
goto :eof
