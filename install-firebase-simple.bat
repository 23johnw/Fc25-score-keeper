@echo off
title Installing Firebase CLI
echo.
echo Installing Firebase CLI...
echo This will take a few minutes, please wait...
echo.

REM Try to install Firebase CLI
npm install -g firebase-tools

echo.
echo Installation complete!
echo Testing Firebase CLI...
firebase --version

echo.
echo If you see a version number above, installation was successful!
echo You can now run: deploy-firebase.bat
echo.
echo Press any key to close...
pause
