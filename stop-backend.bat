@echo off
REM ============================================================================
REM FC 25 Score Tracker - Stop Backend Server
REM This script stops the local HTTP server
REM ============================================================================

echo.
echo Stopping backend server...
echo.

REM Kill Python HTTP server on port 8000
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":8000" ^| findstr "LISTENING"') do (
    echo Stopping process %%a on port 8000...
    taskkill /F /PID %%a >nul 2>&1
)

REM Kill Node.js http-server on port 8000
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":8000" ^| findstr "LISTENING"') do (
    echo Stopping process %%a on port 8000...
    taskkill /F /PID %%a >nul 2>&1
)

echo.
echo Server stopped.
echo.
pause

