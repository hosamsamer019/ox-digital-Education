@echo off
setlocal
title OX-DIGITAL Education — Safe GitHub Pull

:: ============================================================================
:: 1. Working Directory Resolution
:: ============================================================================
cd /d "%~dp0"

echo ================================================================================
echo           OX-DIGITAL EDUCATION - SAFE GITHUB RETRIEVAL UTILITY
echo ================================================================================
echo.

:: ============================================================================
:: 2. Verify Git Repository
:: ============================================================================
echo [1/6] Verifying Git repository...
git rev-parse --is-inside-work-tree >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Current directory is not a Git repository.
    goto :fail
)
echo    [OK] Git repository confirmed.

:: ============================================================================
:: 3. Verify Authorized Remote URL & Active Branch
:: ============================================================================
echo [2/6] Verifying authorized GitHub remote and branch...
set "EXPECTED_REMOTE=https://github.com/hosamsamer019/ox-digital-Education.git"
for /f "tokens=*" %%R in ('git config --get remote.origin.url 2^>nul') do set "ACTUAL_REMOTE=%%R"

if "%ACTUAL_REMOTE%"=="" (
    echo [ERROR] No 'origin' remote is configured.
    goto :fail
)

if /i not "%ACTUAL_REMOTE%"=="%EXPECTED_REMOTE%" (
    echo [ERROR] Remote URL mismatch!
    echo   Expected: %EXPECTED_REMOTE%
    echo   Actual:   %ACTUAL_REMOTE%
    echo Pull aborted for safety.
    goto :fail
)
echo    [OK] Authorized remote confirmed: %ACTUAL_REMOTE%

for /f "tokens=*" %%B in ('git rev-parse --abbrev-ref HEAD 2^>nul') do set "CURRENT_BRANCH=%%B"

if /i not "%CURRENT_BRANCH%"=="main" (
    echo [ERROR] Active branch is '%CURRENT_BRANCH%'. Expected branch is 'main'.
    echo Please switch to main branch before pulling: git checkout main
    goto :fail
)
echo    [OK] Active branch is 'main'.

:: ============================================================================
:: 4. Guard Against Uncommitted Changes
:: ============================================================================
echo [3/6] Checking for uncommitted local changes...
for /f "tokens=*" %%S in ('git status --porcelain 2^>nul') do (
    echo.
    echo ================================================================================
    echo [STOP] Uncommitted changes detected in your working directory:
    echo ================================================================================
    git status --short
    echo.
    echo Pulling remote changes while you have uncommitted local modifications may cause
    echo conflicts or overwrite work in progress.
    echo.
    echo RECOMMENDED ACTIONS:
    echo  1. Run GITHUB_PUSH.bat to publish your local changes first, OR
    echo  2. Stash your changes with: git stash
    echo ================================================================================
    goto :fail
)
echo    [OK] Working tree is clean. Safe to synchronize.

:: ============================================================================
:: 5. Fetch Origin and Inspect Histories
:: ============================================================================
echo [4/6] Fetching latest updates from origin...
git fetch origin main
if errorlevel 1 (
    echo [ERROR] Failed to fetch from origin main. Check network connection or credentials.
    goto :fail
)

:: Check if origin/main exists
git rev-parse --verify origin/main >nul 2>&1
if errorlevel 1 (
    echo    [INFO] Remote branch 'main' does not have any commits yet.
    echo Nothing to pull.
    goto :success
)

:: Check if local HEAD equals origin/main
for /f "tokens=*" %%H in ('git rev-parse HEAD 2^>nul') do set "LOCAL_HASH=%%H"
for /f "tokens=*" %%R in ('git rev-parse origin/main 2^>nul') do set "REMOTE_HASH=%%R"

if "%LOCAL_HASH%"=="%REMOTE_HASH%" (
    echo.
    echo ================================================================================
    echo [OK] Your local repository is already up to date with origin/main.
    echo ================================================================================
    goto :success
)

:: Check if fast-forward is possible (HEAD is an ancestor of origin/main)
echo [5/6] Checking update safety (fast-forward verification)...
git merge-base --is-ancestor HEAD origin/main >nul 2>&1
if errorlevel 1 (
    echo.
    echo ================================================================================
    echo [DIVERGENCE DETECTED]
    echo Local and remote commit histories have diverged!
    echo Both your local machine and GitHub have new commits that do not connect linearly.
    echo.
    echo To preserve all changes safely without losing work:
    echo   1. Inspect commit differences: git log --oneline --graph HEAD...origin/main
    echo   2. Rebase or merge explicitly: git merge origin/main
    echo   3. Never use git push --force or git reset --hard!
    echo ================================================================================
    goto :fail
)

:: ============================================================================
:: 6. Perform Safe Fast-Forward Pull
:: ============================================================================
echo [6/6] Updating local branch via fast-forward only...
git pull --ff-only origin main
if errorlevel 1 (
    echo [ERROR] Fast-forward pull could not be completed.
    goto :fail
)

:success
echo.
echo ================================================================================
echo [SUCCESS] Local project is up to date with GitHub!
echo ================================================================================
echo.
pause
exit /b 0

:fail
echo.
echo ================================================================================
echo [ABORTED] Pull operation halted safely. No local files were modified or damaged.
echo ================================================================================
echo.
pause
exit /b 1
