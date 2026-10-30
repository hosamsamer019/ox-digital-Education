@echo off
title Math Platform Environment Stopper

echo ==============================================
echo Stopping Math Platform Development Environment...
echo ==============================================
echo.

echo Stopping Frontend...
taskkill /FI "WINDOWTITLE eq MathPlatform_Frontend*" /T /F >nul 2>&1

echo Stopping Auth Service...
taskkill /FI "WINDOWTITLE eq MathPlatform_Auth*" /T /F >nul 2>&1

echo Stopping User Service...
taskkill /FI "WINDOWTITLE eq MathPlatform_User*" /T /F >nul 2>&1

echo Stopping Course Service...
taskkill /FI "WINDOWTITLE eq MathPlatform_Course*" /T /F >nul 2>&1

echo Stopping AI Service...
taskkill /FI "WINDOWTITLE eq MathPlatform_AI*" /T /F >nul 2>&1

echo Stopping Analytics Service...
taskkill /FI "WINDOWTITLE eq MathPlatform_Analytics*" /T /F >nul 2>&1

echo Stopping Video Worker...
taskkill /FI "WINDOWTITLE eq MathPlatform_VideoWorker*" /T /F >nul 2>&1

echo.
echo ==============================================
echo All development servers and APIs have been successfully stopped.
echo ==============================================
echo.
pause
