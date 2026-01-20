Write-Host "Firebase Deployment (No Functions)" -ForegroundColor Green
Write-Host "This will deploy hosting and database only" -ForegroundColor Yellow
Write-Host ""

Write-Host "Current project:" -ForegroundColor Yellow
firebase use

Write-Host ""
$confirm = Read-Host "Deploy hosting and database only? (y/N)"

if ($confirm -eq "y") {
    Write-Host ""
    Write-Host "Deploying hosting and firestore..." -ForegroundColor Yellow
    firebase deploy --only hosting,firestore
    
    Write-Host ""
    Write-Host "DEPLOYMENT COMPLETE!" -ForegroundColor Green
    Write-Host "Your app is live at:" -ForegroundColor Green
    Write-Host "https://fc---score-keeper.web.app" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Note: Matches won't auto-lock at midnight" -ForegroundColor Yellow
    Write-Host "But admin can still control everything!" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Share this URL in your WhatsApp group!" -ForegroundColor Green
} else {
    Write-Host "Cancelled." -ForegroundColor Yellow
}

Write-Host ""
Read-Host "Press Enter to exit"
