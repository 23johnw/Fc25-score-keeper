@echo off
REM ============================================================================
REM FC 25 Score Tracker - Backend Server Setup
REM This script starts a local HTTP server to run the app
REM ============================================================================

setlocal enabledelayedexpansion

echo.
echo ============================================================================
echo FC 25 Score Tracker - Backend Server Setup
echo ============================================================================
echo.

REM Set default port
set PORT=8000

REM Check if port is already in use
netstat -an | findstr ":%PORT%" >nul
if %errorlevel% == 0 (
    echo WARNING: Port %PORT% is already in use!
    echo Please close any applications using this port or modify the PORT variable.
    echo.
    pause
    exit /b 1
)

REM Get the directory where this batch file is located
cd /d "%~dp0"
echo Starting server from: %CD%
echo.

REM Try Python 3 first (most common)
python --version >nul 2>&1
if %errorlevel% == 0 (
    echo [✓] Python detected!
    echo Starting Python HTTP server on port %PORT%...
    echo.
    echo Server is running at: http://localhost:%PORT%
    echo.
    echo Press Ctrl+C to stop the server.
    echo.
    start http://localhost:%PORT%
    python -m http.server %PORT%
    goto :end
)

REM Try Python 2
python2 --version >nul 2>&1
if %errorlevel% == 0 (
    echo [✓] Python 2 detected!
    echo Starting Python HTTP server on port %PORT%...
    echo.
    echo Server is running at: http://localhost:%PORT%
    echo.
    echo Press Ctrl+C to stop the server.
    echo.
    start http://localhost:%PORT%
    python2 -m SimpleHTTPServer %PORT%
    goto :end
)

REM Try Node.js with http-server
where http-server >nul 2>&1
if %errorlevel% == 0 (
    echo [✓] Node.js http-server detected!
    echo Starting http-server on port %PORT%...
    echo.
    echo Server is running at: http://localhost:%PORT%
    echo.
    echo Press Ctrl+C to stop the server.
    echo.
    start http://localhost:%PORT%
    http-server -p %PORT% -c-1
    goto :end
)

REM Try Node.js (check if installed)
node --version >nul 2>&1
if %errorlevel% == 0 (
    echo [✓] Node.js detected!
    echo.
    echo To use Node.js, please install http-server globally:
    echo   npm install -g http-server
    echo.
    echo Then run this script again.
    echo.
    echo Alternatively, installing http-server now...
    call npm install -g http-server
    if !errorlevel! == 0 (
        echo.
        echo http-server installed successfully!
        echo Starting http-server on port %PORT%...
        echo.
        echo Server is running at: http://localhost:%PORT%
        echo.
        echo Press Ctrl+C to stop the server.
        echo.
        start http://localhost:%PORT%
        http-server -p %PORT% -c-1
        goto :end
    ) else (
        echo.
        echo [X] Failed to install http-server automatically.
        echo Please install it manually by running: npm install -g http-server
        echo.
    )
)

REM If nothing is available, show error
echo [X] ERROR: No suitable server found!
echo.
echo Please install one of the following:
echo.
echo Option 1 - Python (Recommended):
echo   1. Download from: https://www.python.org/downloads/
echo   2. Install Python (check "Add Python to PATH" during installation)
echo   3. Run this script again
echo.
echo Option 2 - Node.js:
echo   1. Download from: https://nodejs.org/
echo   2. Install Node.js
echo   3. Run: npm install -g http-server
echo   4. Run this script again
echo.
echo ============================================================================
pause
exit /b 1

:end
endlocal

