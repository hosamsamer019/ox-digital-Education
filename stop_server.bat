@echo off
setlocal
title OX-DIGITAL Education Platform Stopper

set "SCRIPT_DIR=%~dp0"
cd /d "%SCRIPT_DIR%"

echo ============================================================================
echo   Stopping OX-DIGITAL Education Services / إيقاف خدمات منصة أوكس الرقمية
echo ============================================================================
echo.

if not exist "docker-compose.production.yml" (
    echo [ERROR] docker-compose.production.yml not found.
    pause
    exit /b 1
)

echo [INFO] Stopping containers safely (preserving all database data and volumes)...
docker compose -p ox-digital-education --env-file .env.production -f docker-compose.production.yml stop

echo.
echo ============================================================================
echo   All OX-DIGITAL Education services have been stopped safely.
echo   All database volumes, settings, and user data remain 100%% preserved.
echo ============================================================================
echo.
pause
exit /b 0
