@echo off
setlocal EnableExtensions EnableDelayedExpansion

rem Download or update FC 25 Score Tracker into your local Projects folder.
rem Requires Git: https://git-scm.com/download/win

set "TARGET=C:\Users\wallc\Projects\FC-25-Score-Recorder"
set "REPO=https://github.com/23johnw/Fc25-score-keeper.git"
set "BRANCH=main"

echo.
echo FC 25 Score Tracker - Download / Update
echo ========================================
echo Target folder: %TARGET%
echo Repository:    %REPO%
echo Branch:        %BRANCH%
echo.

where git >nul 2>nul
if errorlevel 1 (
    echo [ERROR] Git is not installed or not in your PATH.
    echo Install Git for Windows, then run this script again:
    echo   https://git-scm.com/download/win
    echo.
    pause
    exit /b 1
)

if not exist "%TARGET%" (
    echo Creating folder...
    mkdir "%TARGET%" 2>nul
    if errorlevel 1 (
        echo [ERROR] Could not create folder: %TARGET%
        pause
        exit /b 1
    )
)

if exist "%TARGET%\.git" (
    echo Updating existing copy...
    cd /d "%TARGET%"
    git fetch origin
    git checkout %BRANCH%
    git pull origin %BRANCH%
    if errorlevel 1 (
        echo [ERROR] git pull failed.
        pause
        exit /b 1
    )
    goto :done
)

rem Folder exists but is not a git repo yet (e.g. you created the folder manually)
set "HASFILES=0"
for /f "delims=" %%A in ('dir /b /a "%TARGET%" 2^>nul') do set "HASFILES=1"

if "!HASFILES!"=="0" (
    echo Cloning repository into empty folder...
    git clone --branch %BRANCH% --single-branch "%REPO%" "%TARGET%"
    if errorlevel 1 (
        echo [ERROR] git clone failed.
        pause
        exit /b 1
    )
    cd /d "%TARGET%"
    goto :done
)

echo Folder exists but is not a git clone yet.
echo Downloading repository files into:
echo   %TARGET%
echo.
echo Note: existing files with the same name may be overwritten.
echo.

set "TEMPCLONE=%TEMP%\fc25-score-recorder-%RANDOM%"
echo Cloning to temporary folder...
git clone --branch %BRANCH% --single-branch "%REPO%" "%TEMPCLONE%"
if errorlevel 1 (
    echo [ERROR] git clone failed.
    if exist "%TEMPCLONE%" rd /s /q "%TEMPCLONE%"
    pause
    exit /b 1
)

echo Copying files into your Projects folder...
robocopy "%TEMPCLONE%" "%TARGET%" /E /NFL /NDL /NJH /NJS /nc /ns /np >nul
set "RC=!ERRORLEVEL!"
rd /s /q "%TEMPCLONE%"

if !RC! GEQ 8 (
    echo [ERROR] Copy failed (robocopy error !RC!).
    pause
    exit /b 1
)

cd /d "%TARGET%"
git checkout %BRANCH% >nul 2>nul

:done
echo.
echo Done.
echo Files are in:
echo   %TARGET%
echo.
echo Optional - run locally:
echo   cd /d "%TARGET%"
echo   npm run start
echo   Open http://localhost:3000 in your browser
echo.
echo Live app (GitHub Pages):
echo   https://23johnw.github.io/Fc25-score-keeper/
echo.
pause
endlocal
