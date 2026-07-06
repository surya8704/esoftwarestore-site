@echo off
REM Deploy backend to Render using Blueprint API
REM 1. Get API key: https://dashboard.render.com/u/settings#api-keys
REM 2. set RENDER_API_KEY=your_key_here
REM 3. Run: scripts\deploy-render.cmd

if "%RENDER_API_KEY%"=="" (
  echo Error: Set RENDER_API_KEY first.
  echo Get one at: https://dashboard.render.com/u/settings#api-keys
  exit /b 1
)

curl -s -X POST "https://api.render.com/v1/blueprints" ^
  -H "Authorization: Bearer %RENDER_API_KEY%" ^
  -H "Content-Type: application/json" ^
  -d "{\"name\":\"esoftwarestore\",\"repo\":\"https://github.com/surya8704/esoftwarestore-site\",\"branch\":\"main\",\"autoDeploy\":\"yes\"}"

echo.
echo Done. Open https://dashboard.render.com to set secret env vars:
echo   DATABASE_URL, RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET, PAYU_MERCHANT_KEY, PAYU_MERCHANT_SALT
