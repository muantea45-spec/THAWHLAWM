@echo off
title Pathian Ram - Deploy to Cloudflare (LIVE PRODUCTION)
cd /d "%~dp0"

echo ===================================================
echo   Deploying to Cloudflare (LIVE PRODUCTION)
echo   Account: Muantea45@gmail.com
echo   Project Name: thawhlawmptr
echo ===================================================
echo.

set CLOUDFLARE_ACCOUNT_ID=57ec9b48f2a231c5ed6af446774d015e

echo 1. Building latest production files...
call npm.cmd run build
if %errorlevel% neq 0 (
    echo.
    echo [ERROR] Build failed. Please check the errors above.
    pause
    exit /b 1
)

echo.
echo 2. Uploading to Cloudflare Pages (thawhlawmptr)...
call npx.cmd wrangler pages deploy dist --project-name=thawhlawmptr --branch=main --commit-dirty=true

echo.
echo ===================================================
echo   Deployment completed!
echo   Live URL: https://thawhlawmptr.pages.dev
echo ===================================================
pause
