@echo off
title Firebase Setup Script
echo ========================================
echo Firebase Setup Script
echo FC 25 Score Tracker - Installation
echo ========================================
echo.
echo Starting setup process...
timeout /t 2 /nobreak >nul
echo.

REM Check if Node.js is installed
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ERROR: Node.js not found!
    echo.
    echo Please install Node.js first:
    echo 1. Go to: https://nodejs.org/
    echo 2. Download the LTS version
    echo 3. Install it
    echo 4. Restart this script
    echo.
    echo Opening Node.js website...
    start https://nodejs.org/
    pause
    exit /b 1
)

echo ✓ Node.js found: 
node --version
echo.

REM Check if npm is available
npm --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ERROR: npm not found!
    echo This should come with Node.js. Try reinstalling Node.js.
    pause
    exit /b 1
)

echo ✓ npm found:
npm --version
echo.

REM Install Firebase CLI
echo Installing Firebase CLI globally...
echo This may take a few minutes...
echo.

npm install -g firebase-tools

if %errorlevel% equ 0 (
    echo.
    echo ========================================
    echo ✅ SETUP COMPLETE!
    echo ========================================
    echo.
    echo Firebase CLI installed successfully!
    echo Version:
    firebase --version
    echo.
    echo You can now run: deploy-firebase.bat
    echo.
) else (
    echo.
    echo ========================================
    echo ❌ INSTALLATION FAILED
    echo ========================================
    echo.
    echo Try running Command Prompt as Administrator
    echo Or install manually: npm install -g firebase-tools
    echo.
)

echo.
echo Press any key to exit...
pause
