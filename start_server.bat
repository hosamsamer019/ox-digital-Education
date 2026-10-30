@echo off
setlocal enabledelayedexpansion
title OX-DIGITAL Education Platform Launcher

:: ============================================================================
:: 1. Working Directory Resolution
:: ============================================================================
set "SCRIPT_DIR=%~dp0"
cd /d "%SCRIPT_DIR%"

echo ===================================================
echo    OX-DIGITAL Education Platform Launcher
echo ===================================================
echo.
echo [1/6] Verifying working directory...
if not exist "docker-compose.production.yml" (
    echo [ERROR] docker-compose.production.yml not found in "%CD%".
    goto :fail
)
if not exist ".env.production" (
    echo [ERROR] .env.production not found in "%CD%".
    goto :fail
)

:: ============================================================================
:: 2. Docker CLI & Engine Availability Check
:: ============================================================================
echo [2/6] Verifying Docker CLI and Docker Engine...
where docker >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Docker CLI was not found in PATH.
    echo Please ensure Docker Desktop is installed and added to your system PATH.
    goto :fail
)

docker info >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Docker Desktop / Engine is not running or unreachable.
    echo Please start Docker Desktop and wait until the engine is ready.
    goto :fail
)

:: ============================================================================
:: 3. Compose Configuration Validation & Clean Local Origin Sanity
:: ============================================================================
echo [3/6] Validating OX-DIGITAL Compose configuration...
powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "$f = Join-Path '%CD%' '.env.production'; if (Test-Path $f) { $t = [System.IO.File]::ReadAllText($f); if ($t -match 'trycloudflare\.com') { $t = $t -replace '(?m)^ALLOWED_ORIGINS=.*$', 'ALLOWED_ORIGINS=http://localhost:8080'; [System.IO.File]::WriteAllText($f, $t, [System.Text.Encoding]::UTF8); Write-Host '      [INFO] Sanitized stale temporary Quick Tunnel origin from .env.production.' -ForegroundColor Cyan } }"
docker compose -p ox-digital-education --env-file .env.production -f docker-compose.production.yml config --quiet
if errorlevel 1 (
    echo [ERROR] Docker Compose configuration validation failed.
    goto :fail
)

:: ============================================================================
:: 4. Start / Reuse OX-DIGITAL Services (Idempotent & Safe)
:: ============================================================================
echo [4/6] Starting OX-DIGITAL services (Compose project: ox-digital-education)...
docker compose -p ox-digital-education --env-file .env.production -f docker-compose.production.yml up -d
if errorlevel 1 (
    echo [ERROR] Failed to start OX-DIGITAL containers.
    goto :fail
)

:: ============================================================================
:: 5. Health Check & Ingress Polling (http://localhost:8080/health)
:: ============================================================================
echo [5/6] Waiting for OX-DIGITAL services to become healthy and reachable...

set "HEALTH_URL=http://localhost:8080/health"
set /a ATTEMPT=0
set /a MAX_ATTEMPTS=30

:poll_health
set /a ATTEMPT+=1
curl.exe -fs -o nul "%HEALTH_URL%" >nul 2>&1
if %errorlevel% equ 0 goto :healthy

if !ATTEMPT! geq !MAX_ATTEMPTS! (
    echo [ERROR] Timeout reached while waiting for %HEALTH_URL%
    echo Checking container status:
    docker compose -p ox-digital-education --env-file .env.production -f docker-compose.production.yml ps
    goto :fail
)

timeout /t 2 /nobreak >nul 2>&1 || ping -n 3 127.0.0.1 >nul
goto :poll_health

:healthy
:: ============================================================================
:: 6. Launch Browser (Existing Convention) & Completion Notice
:: ============================================================================
echo [6/6] Health check passed successfully!

set "TARGET_PATH=%~1"
if not "!TARGET_PATH!"=="" (
    if not "!TARGET_PATH:~0,1!"=="/" (
        if not "!TARGET_PATH:~0,4!"=="http" (
            set "TARGET_PATH=/!TARGET_PATH!"
        )
    )
)

if not "!TARGET_PATH!"=="" (
    if "!TARGET_PATH:~0,4!"=="http" (
        echo Opening browser: !TARGET_PATH!
        start "" "!TARGET_PATH!"
    ) else (
        echo Opening browser: http://localhost:8080!TARGET_PATH!
        start "" "http://localhost:8080!TARGET_PATH!"
    )
) else (
    echo Opening browser: http://localhost:8080
    start "" "http://localhost:8080"
)

echo.
echo ===================================================
echo  OX-DIGITAL is running at http://localhost:8080
echo ===================================================
echo.
echo All services are running inside Docker (ox-digital-education).
echo PostgreSQL is isolated internally on ox-digital-network (no host port 5432).
echo AL-SADEN legacy platform is 100%% untouched.
echo.
echo Press any key to close this launcher window...
pause >nul
exit /b 0

:fail
echo.
echo ===================================================
echo [FAIL] OX-DIGITAL failed to start.
echo ===================================================
echo.
pause
exit /b 1
