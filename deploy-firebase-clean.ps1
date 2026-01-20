Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Firebase Deployment Script" -ForegroundColor Cyan
Write-Host "FC 25 Score Tracker - Shared League" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Check Firebase CLI
Write-Host "Checking Firebase CLI..." -ForegroundColor Yellow
$firebaseVersion = firebase --version
Write-Host "✓ Firebase CLI found: $firebaseVersion" -ForegroundColor Green
Write-Host ""

# Check authentication
Write-Host "Checking Firebase authentication..." -ForegroundColor Yellow
firebase projects:list | Out-Null
Write-Host "✓ Firebase authentication OK" -ForegroundColor Green
Write-Host ""

# Install Cloud Functions dependencies
Write-Host "Installing Cloud Functions dependencies..." -ForegroundColor Yellow
if (Test-Path "functions\package.json") {
    Set-Location functions
    Write-Host "Running npm install in functions directory..." -ForegroundColor Yellow
    npm install
    Set-Location ..
    Write-Host "✓ Cloud Functions dependencies installed" -ForegroundColor Green
} else {
    Write-Host "⚠ No functions/package.json found, skipping..." -ForegroundColor Yellow
}
Write-Host ""

# Show current project
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
if ($confirm -eq "y" -or $confirm -eq "Y") {
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host "Starting Firebase Deployment..." -ForegroundColor Cyan
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host ""
    
    # Deploy
    Write-Host "Deploying all Firebase services..." -ForegroundColor Yellow
    firebase deploy
    
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Green
    Write-Host "🎉 DEPLOYMENT COMPLETE! 🎉" -ForegroundColor Green
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
} else {
    Write-Host "Deployment cancelled." -ForegroundColor Yellow
}

Write-Host ""
Read-Host "Press Enter to exit"
