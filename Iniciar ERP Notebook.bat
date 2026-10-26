
@echo off
title YC System - Inicio local
cd /d "%~dp0"

if not exist "backend\package.json" (
  echo ERROR: No encuentro la carpeta backend.
  pause
  exit /b 1
)

if not exist "frontend\package.json" (
  echo ERROR: No encuentro la carpeta frontend.
  pause
  exit /b 1
)

start "YC System Backend" cmd /k "cd /d "%~dp0backend" && npm run dev"
timeout /t 5 /nobreak >nul
start "YC System Frontend" cmd /k "cd /d "%~dp0frontend" && npm run dev"

exit /b
