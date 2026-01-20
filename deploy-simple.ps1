Write-Host "Firebase Deployment Starting..." -ForegroundColor Green
Write-Host ""

# Install functions dependencies
Write-Host "Installing Cloud Functions dependencies..." -ForegroundColor Yellow
if (Test-Path "functions/package.json") {
    Push-Location functions
    npm install
    Pop-Location
    Write-Host "Dependencies installed!" -ForegroundColor Green
}

Write-Host ""
Write-Host "Current project:" -ForegroundColor Yellow
firebase use

Write-Host ""
$confirm = Read-Host "Deploy to Firebase? (y/N)"

if ($confirm -eq "y") {
    Write-Host ""
    Write-Host "Deploying..." -ForegroundColor Yellow
    firebase deploy
    
    Write-Host ""
    Write-Host "DEPLOYMENT COMPLETE!" -ForegroundColor Green
    Write-Host "Your app is live at:" -ForegroundColor Green
    Write-Host "https://fc---score-keeper.web.app" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Share this URL in your WhatsApp group!" -ForegroundColor Green
} else {
    Write-Host "Cancelled." -ForegroundColor Yellow
}

Write-Host ""
Read-Host "Press Enter to exit"
