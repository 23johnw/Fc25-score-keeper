@echo off
echo ========================================
echo Firebase Deployment Script
echo FC 25 Score Tracker - Shared League
echo ========================================
echo.

REM Check if Firebase CLI is installed
firebase --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ERROR: Firebase CLI not found!
    echo Please install it first: npm install -g firebase-tools
    echo.
    pause
    exit /b 1
)

echo ✓ Firebase CLI found
echo.

REM Check if we're logged in
echo Checking Firebase authentication...
firebase projects:list >nul 2>&1
if %errorlevel% neq 0 (
    echo You need to log in to Firebase first.
    echo Opening Firebase login...
    echo.
    firebase login
    if %errorlevel% neq 0 (
        echo ERROR: Firebase login failed!
        pause
        exit /b 1
    )
)

echo ✓ Firebase authentication OK
echo.

REM Install Cloud Functions dependencies
echo Installing Cloud Functions dependencies...
if exist functions\package.json (
    cd functions
    echo Running npm install in functions directory...
    npm install
    if %errorlevel% neq 0 (
        echo ERROR: Failed to install Cloud Functions dependencies!
        cd ..
        pause
        exit /b 1
    )
    cd ..
    echo ✓ Cloud Functions dependencies installed
) else (
    echo ⚠ No functions/package.json found, skipping...
)
echo.

REM Check current Firebase project
echo Current Firebase project:
firebase use
echo.

REM Confirm deployment
echo Ready to deploy to Firebase!
echo This will deploy:
echo   - Hosting (your app files)
echo   - Firestore rules (database security)
echo   - Firestore indexes (database performance)
echo   - Cloud Functions (match locking)
echo.
set /p confirm="Continue with deployment? (y/N): "
if /i not "%confirm%"=="y" (
    echo Deployment cancelled.
    pause
    exit /b 0
)

echo.
echo ========================================
echo Starting Firebase Deployment...
echo ========================================
echo.

REM Deploy everything
echo Deploying all Firebase services...
firebase deploy

if %errorlevel% equ 0 (
    echo.
    echo ========================================
    echo 🎉 DEPLOYMENT SUCCESSFUL! 🎉
    echo ========================================
    echo.
    echo Your app is now live at:
    echo   https://fc---score-keeper.web.app
    echo   https://fc---score-keeper.firebaseapp.com
    echo.
    echo Share either URL in your WhatsApp group!
    echo.
    echo Next steps:
    echo 1. Test the app on your phone
    echo 2. Sign in as admin in Settings
    echo 3. Share the URL with friends
    echo 4. Start tracking matches together!
    echo.
) else (
    echo.
    echo ========================================
    echo ❌ DEPLOYMENT FAILED
    echo ========================================
    echo.
    echo Something went wrong during deployment.
    echo Check the error messages above.
    echo.
    echo Common fixes:
    echo - Make sure billing is enabled for Cloud Functions
    echo - Check your internet connection
    echo - Try: firebase login --reauth
    echo.
)

echo Press any key to exit...
pause >nul
