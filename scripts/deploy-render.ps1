# Deploy backend to Render via Blueprint API
# Usage: $env:RENDER_API_KEY="rnd_..." ; .\scripts\deploy-render.ps1

param(
  [string]$ApiKey = $env:RENDER_API_KEY,
  [string]$Repo = "https://github.com/surya8704/esoftwarestore-site",
  [string]$Branch = "main"
)

if (-not $ApiKey) {
  Write-Host "Error: Set RENDER_API_KEY or pass -ApiKey" -ForegroundColor Red
  Write-Host "Get one at: https://dashboard.render.com/u/settings#api-keys"
  exit 1
}

$body = @{
  name       = "esoftwarestore"
  repo       = $Repo
  branch     = $Branch
  autoDeploy = "yes"
} | ConvertTo-Json

$response = Invoke-RestMethod -Method POST `
  -Uri "https://api.render.com/v1/blueprints" `
  -Headers @{
    Authorization = "Bearer $ApiKey"
    Accept        = "application/json"
  } `
  -ContentType "application/json" `
  -Body $body

Write-Host "Blueprint created:" -ForegroundColor Green
$response | ConvertTo-Json -Depth 5
Write-Host ""
Write-Host "Next: In Render Dashboard, set these secret env vars on esoftwarestore-api:"
Write-Host "  DATABASE_URL, RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET, PAYU_MERCHANT_KEY, PAYU_MERCHANT_SALT"
