@echo off
title AR | WiFi | TR — High-Speed Local WiFi File Transfer
cd /d "%~dp0"

echo ======================================================
echo    Starting AR | WiFi | TR Local File Transfer...
echo ======================================================

:: Check if frontend production dist exists
if not exist "dist\index.html" (
    echo [INFO] Building frontend production bundle...
    call npm run build
)

echo [INFO] Starting High-Speed WiFi Server...
node server.js
pause
