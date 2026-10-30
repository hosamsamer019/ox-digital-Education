@echo off
setlocal enabledelayedexpansion
title OX-DIGITAL Education — Cloudflare Quick Tunnel

:: ============================================================================
:: Working Directory Resolution
:: ============================================================================
set "SCRIPT_DIR=%~dp0"
cd /d "%SCRIPT_DIR%"

:: ============================================================================
:: Banner
:: ============================================================================
echo ================================================================================
echo           OX-DIGITAL EDUCATION - CLOUDFLARE QUICK TUNNEL LAUNCHER
echo ================================================================================
echo.

:: ============================================================================
:: Sanity Checks
:: ============================================================================
if not exist "docker-compose.production.yml" (
    echo [ERROR] docker-compose.production.yml not found in "%CD%".
    echo Please run this batch file from the OX-DIGITAL root directory.
    goto :fail
)

if not exist "scripts\launch_tunnel.ps1" (
    echo [ERROR] scripts\launch_tunnel.ps1 helper script was not found.
    goto :fail
)

where powershell.exe >nul 2>&1
if errorlevel 1 (
    echo [ERROR] PowerShell was not found in PATH.
    goto :fail
)

:: ============================================================================
:: Launch Tunnel Supervisor via PowerShell
:: ============================================================================
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%SCRIPT_DIR%scripts\launch_tunnel.ps1"
set "PS_EXIT_CODE=%errorlevel%"

if %PS_EXIT_CODE% neq 0 (
    echo.
    echo ================================================================================
    echo [ERROR] Cloudflare Quick Tunnel supervisor encountered an error or failed checks.
    echo (Exit code: %PS_EXIT_CODE%)
    echo ================================================================================
    goto :fail
)

echo.
echo Tunnel closed.
exit /b 0

:fail
echo.
echo ================================================================================
echo Tunnel could not be started or was terminated due to safety check failure.
echo ================================================================================
echo.
pause
exit /b 1
