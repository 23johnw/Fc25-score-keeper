Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Firebase Deployment Script" -ForegroundColor Cyan
Write-Host "FC 25 Score Tracker - Shared League" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Check if Firebase CLI is installed
Write-Host "Checking Firebase CLI..." -ForegroundColor Yellow
$firebaseVersion = firebase --version
if ($LASTEXITCODE -eq 0) {
    Write-Host "✓ Firebase CLI found: $firebaseVersion" -ForegroundColor Green
} else {
    Write-Host "ERROR: Firebase CLI not found!" -ForegroundColor Red
    Write-Host "Please install it first: npm install -g firebase-tools" -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit 1
}

Write-Host ""

# Check if we're logged in
Write-Host "Checking Firebase authentication..." -ForegroundColor Yellow
firebase projects:list 2>$null
if ($LASTEXITCODE -eq 0) {
    Write-Host "✓ Firebase authentication OK" -ForegroundColor Green
} else {
    Write-Host "You need to log in to Firebase first." -ForegroundColor Yellow
    Write-Host "Opening Firebase login..." -ForegroundColor Yellow
    Write-Host ""
    
    firebase login
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✓ Firebase login successful" -ForegroundColor Green
    } else {
        Write-Host "ERROR: Firebase login failed!" -ForegroundColor Red
        Read-Host "Press Enter to exit"
        exit 1
    }
}

Write-Host ""

# Install Cloud Functions dependencies
Write-Host "Installing Cloud Functions dependencies..." -ForegroundColor Yellow
if (Test-Path "functions\package.json") {
    Push-Location functions
    Write-Host "Running npm install in functions directory..." -ForegroundColor Yellow
    
    npm install
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✓ Cloud Functions dependencies installed" -ForegroundColor Green
    } else {
        Write-Host "ERROR: Failed to install Cloud Functions dependencies!" -ForegroundColor Red
        Pop-Location
        Read-Host "Press Enter to exit"
        exit 1
    }
    
    Pop-Location
} else {
    Write-Host "⚠ No functions/package.json found, skipping..." -ForegroundColor Yellow
}

Write-Host ""

# Check current Firebase project
Write-Host "Current Firebase project:" -ForegroundColor Yellow
firebase use

Write-Host ""

# Confirm deployment
Write-Host "Ready to deploy to Firebase!" -ForegroundColor Green
Write-Host "This will deploy:" -ForegroundColor White
Write-Host "  - Hosting (your app files)" -ForegroundColor White
Write-Host "  - Firestore rules (database security)" -ForegroundColor White
Write-Host "  - Firestore indexes (database performance)" -ForegroundColor White
Write-Host "  - Cloud Functions (match locking)" -ForegroundColor White
Write-Host ""

$confirm = Read-Host "Continue with deployment? (y/N)"
if ($confirm -ne "y" -and $confirm -ne "Y") {
    Write-Host "Deployment cancelled." -ForegroundColor Yellow
    Read-Host "Press Enter to exit"
    exit 0
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Starting Firebase Deployment..." -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Deploy everything
Write-Host "Deploying all Firebase services..." -ForegroundColor Yellow
firebase deploy

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Green
    Write-Host "🎉 DEPLOYMENT SUCCESSFUL! 🎉" -ForegroundColor Green
    Write-Host "========================================" -ForegroundColor Green
    Write-Host ""
    Write-Host "Your app is now live at:" -ForegroundColor Green
    Write-Host "  https://fc---score-keeper.web.app" -ForegroundColor Cyan
    Write-Host "  https://fc---score-keeper.firebaseapp.com" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Share either URL in your WhatsApp group!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Next steps:" -ForegroundColor Yellow
    Write-Host "1. Test the app on your phone" -ForegroundColor White
    Write-Host "2. Sign in as admin in Settings" -ForegroundColor White
    Write-Host "3. Share the URL with friends" -ForegroundColor White
    Write-Host "4. Start tracking matches together!" -ForegroundColor White
    Write-Host ""
} else {
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Red
    Write-Host "❌ DEPLOYMENT FAILED" -ForegroundColor Red
    Write-Host "========================================" -ForegroundColor Red
    Write-Host ""
    Write-Host "Something went wrong during deployment." -ForegroundColor Red
    Write-Host "Check the error messages above." -ForegroundColor Red
    Write-Host ""
    Write-Host "Common fixes:" -ForegroundColor Yellow
    Write-Host "- Make sure billing is enabled for Cloud Functions" -ForegroundColor White
    Write-Host "- Check your internet connection" -ForegroundColor White
    Write-Host "- Try: firebase login --reauth" -ForegroundColor White
    Write-Host ""
}

Read-Host "Press Enter to exit"
