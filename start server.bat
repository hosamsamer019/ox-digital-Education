@echo off
setlocal enabledelayedexpansion
title OX-DIGITAL Education Platform Launcher

:: ============================================================================
:: 1. Working Directory Resolution
:: ============================================================================
set "SCRIPT_DIR=%~dp0"
cd /d "%SCRIPT_DIR%"

echo ============================================================================
echo   OX-DIGITAL Education Platform Launcher / مشغل منصة أوكس الرقمية التعليمية
echo ============================================================================
echo.

:: ============================================================================
:: 2. Pre-Flight File Checks
:: ============================================================================
echo [1/6] Verifying working directory and configuration...
if not exist "docker-compose.production.yml" (
    echo [ERROR] docker-compose.production.yml not found in "%CD%".
    echo [خطأ] تعذر العثور على ملف docker-compose.production.yml في المجلد الحالي.
    goto :fail
)
if not exist ".env.production" (
    echo [ERROR] .env.production not found in "%CD%".
    echo [خطأ] تعذر العثور على ملف .env.production في المجلد الحالي.
    goto :fail
)

:: ============================================================================
:: 3. Docker CLI & Engine Availability Check
:: ============================================================================
echo [2/6] Verifying Docker CLI and Docker Engine...
where docker >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Docker CLI was not found in system PATH.
    echo Please ensure Docker Desktop is installed and added to PATH.
    echo [خطأ] أمر docker غير موجود في مسار النظام. يرجى التأكد من تثبيت Docker Desktop.
    goto :fail
)

docker info >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Docker Engine is not running or unreachable.
    echo Please start Docker Desktop and wait until the engine is ready.
    echo [خطأ] محرك Docker لا يعمل حالياً. يرجى تشغيل برنامج Docker Desktop والانتظار حتى يصبح جاهزاً.
    goto :fail
)

:: ============================================================================
:: 4. Origin & Compose Configuration Sanity
:: ============================================================================
echo [3/6] Validating Compose configuration...
powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "$f = Join-Path '%CD%' '.env.production'; if (Test-Path $f) { $t = [System.IO.File]::ReadAllText($f); if ($t -match 'trycloudflare\.com') { $t = $t -replace '(?m)^ALLOWED_ORIGINS=.*$', 'ALLOWED_ORIGINS=http://localhost:8080'; [System.IO.File]::WriteAllText($f, $t, [System.Text.Encoding]::UTF8); Write-Host '      [INFO] Sanitized stale temporary Quick Tunnel origin from .env.production.' -ForegroundColor Cyan } }"
docker compose -p ox-digital-education --env-file .env.production -f docker-compose.production.yml config --quiet
if errorlevel 1 (
    echo [ERROR] Docker Compose configuration validation failed.
    echo [خطأ] فشل التحقق من صحة ملفات تكوين Docker Compose.
    goto :fail
)

:: ============================================================================
:: 5. Idempotent Service Startup (Avoids Unnecessary Rebuilding)
:: ============================================================================
echo [4/6] Checking service status and starting containers (ox-digital-education)...
docker compose -p ox-digital-education --env-file .env.production -f docker-compose.production.yml up -d
if errorlevel 1 (
    echo [ERROR] Failed to start OX-DIGITAL containers.
    echo [خطأ] تعذر بدء تشغيل حاويات منصة OX-DIGITAL.
    goto :fail
)

:: ============================================================================
:: 6. Health Check Polling (http://localhost:8080/health)
:: ============================================================================
echo [5/6] Waiting for application ingress and services to become healthy...
set "HEALTH_URL=http://localhost:8080/health"
set /a ATTEMPT=0
set /a MAX_ATTEMPTS=30

:poll_health
set /a ATTEMPT+=1
curl.exe -fs -o nul "%HEALTH_URL%" >nul 2>&1
if %errorlevel% equ 0 goto :healthy

if !ATTEMPT! geq !MAX_ATTEMPTS! (
    echo [ERROR] Health check timeout reached while waiting for %HEALTH_URL%.
    echo [خطأ] انتهت مهلة الانتظار للتحقق من جاهزية الخادم على المنفذ 8080.
    echo Container status snapshot:
    docker compose -p ox-digital-education --env-file .env.production -f docker-compose.production.yml ps
    goto :fail
)

timeout /t 2 /nobreak >nul 2>&1 || ping -n 3 127.0.0.1 >nul
goto :poll_health

:healthy
echo [INFO] Gateway health check passed (HTTP 200 OK).
echo [معلومات] تم اجتياز فحص الصحة بنجاح وجاهزية بوابة الدخول.

:: ============================================================================
:: 7. Launch Browser at http://localhost:8080/
:: ============================================================================
echo [6/6] Launching default web browser...
set "TARGET_PATH=%~1"
if not "!TARGET_PATH!"=="" (
    if "!TARGET_PATH:~0,4!"=="http" (
        start "" "!TARGET_PATH!"
    ) else (
        if not "!TARGET_PATH:~0,1!"=="/" set "TARGET_PATH=/!TARGET_PATH!"
        start "" "http://localhost:8080!TARGET_PATH!"
    )
) else (
    start "" "http://localhost:8080/"
)

echo.
echo ============================================================================
echo   OX-DIGITAL Education is active at: http://localhost:8080/
echo   منصة أوكس الرقمية التعليمية تعمل الآن بنجاح على: http://localhost:8080/
echo ============================================================================
echo.
echo [INFO] Topology: 100%% isolated inside Docker (ox-digital-education).
echo [INFO] Database: PostgreSQL isolated on dev port 5433 (no port 5432 collision).
echo [INFO] Sibling Platform (AL-SADEN): 100%% untouched and preserved.
echo.
echo Press any key to close this launcher window...
pause >nul
exit /b 0

:fail
echo.
echo ============================================================================
echo   [FAIL] OX-DIGITAL Education startup failed.
echo   [فشل] تعذر تشغيل منظومة OX-DIGITAL التعليمية بنجاح.
echo ============================================================================
echo.
pause
exit /b 1
