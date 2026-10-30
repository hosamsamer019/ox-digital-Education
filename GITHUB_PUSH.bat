@echo off
setlocal
title OX-DIGITAL Education — Safe GitHub Push

:: ============================================================================
:: 1. Working Directory Resolution
:: ============================================================================
cd /d "%~dp0"

echo ================================================================================
echo           OX-DIGITAL EDUCATION - SAFE GITHUB PUBLISHING UTILITY
echo ================================================================================
echo.

:: ============================================================================
:: 2. Verify Git Repository
:: ============================================================================
echo [1/8] Verifying Git repository...
git rev-parse --is-inside-work-tree >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Current directory is not a Git repository.
    goto :fail
)
echo    [OK] Git repository confirmed.

:: ============================================================================
:: 3. Verify Authorized Remote URL
:: ============================================================================
echo [2/8] Verifying authorized GitHub remote...
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
    echo Push aborted for safety.
    goto :fail
)
echo    [OK] Authorized remote confirmed: %ACTUAL_REMOTE%

:: ============================================================================
:: 4. Verify Active Branch is 'main'
:: ============================================================================
echo [3/8] Verifying active branch...
for /f "tokens=*" %%B in ('git rev-parse --abbrev-ref HEAD 2^>nul') do set "CURRENT_BRANCH=%%B"

if /i not "%CURRENT_BRANCH%"=="main" (
    echo [ERROR] Active branch is '%CURRENT_BRANCH%'. Expected branch is 'main'.
    echo Please switch to main branch before publishing: git checkout main
    goto :fail
)
echo    [OK] Active branch is 'main'.

:: ============================================================================
:: 5. Check Remote Status & Divergence
:: ============================================================================
echo [4/8] Fetching latest remote state from origin...
git fetch origin main >nul 2>&1
if errorlevel 1 (
    echo    [INFO] Remote branch 'main' does not exist yet or is empty.
)

:: Check if remote branch exists
git rev-parse --verify origin/main >nul 2>&1
if not errorlevel 1 (
    for /f "tokens=1,2" %%A in ('git rev-list --left-right --count HEAD...origin/main 2^>nul') do (
        set "AHEAD=%%A"
        set "BEHIND=%%B"
    )
    if defined BEHIND (
        if %BEHIND% gtr 0 (
            echo.
            echo [WARNING] Your local branch is behind origin/main by %BEHIND% commit(s).
            echo You must run GITHUB_PULL.bat first to safely retrieve upstream updates!
            echo Push cancelled to prevent overwriting remote work.
            goto :fail
        )
    )
)

:: ============================================================================
:: 6. Check for Local Changes
:: ============================================================================
echo [5/8] Inspecting local working tree...
set "HAS_LOCAL_CHANGES="
for /f "tokens=*" %%S in ('git status --porcelain 2^>nul') do (
    set "HAS_LOCAL_CHANGES=1"
    goto :has_changes
)

:has_changes
if not defined HAS_LOCAL_CHANGES (
    :: Check if local has unpushed commits even if working tree is clean
    if defined AHEAD (
        if %AHEAD% gtr 0 (
            echo    [INFO] Working tree is clean, but you have %AHEAD% unpushed commit(s).
            goto :do_push
        )
    )
    :: Or check if HEAD has not been pushed yet (e.g. after initial commit before push)
    git rev-parse --verify origin/main >nul 2>&1
    if errorlevel 1 (
        git rev-parse --verify HEAD >nul 2>&1
        if not errorlevel 1 (
            echo    [INFO] Initial commit ready to be published to empty remote.
            goto :do_push
        )
    )
    echo.
    echo ================================================================================
    echo [OK] The repository is already up to date. No changes to commit or push.
    echo ================================================================================
    goto :success
)

echo.
echo Pending changes to be committed:
echo --------------------------------------------------------------------------------
git status --short
echo --------------------------------------------------------------------------------
echo.

:: Prompt for commit message
set /p "COMMIT_MSG=Enter a descriptive commit message (or press Ctrl+C to cancel): "
if "%COMMIT_MSG%"=="" (
    echo [ERROR] Commit message cannot be empty.
    goto :fail
)

:: Stage all valid changes
git add -A
echo.
echo [6/8] Staged changes summary:
git diff --cached --stat

:: Verify whitespace and patch integrity (informational check)
git diff --cached --check >nul 2>&1
if errorlevel 1 (
    echo    [NOTICE] Staged changes contain minor trailing whitespace or formatting notices (non-blocking).
)

:: ============================================================================
:: 7. Staged-File Security Gate
:: ============================================================================
echo.
echo [7/8] Running security gate on staged files...
powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "$staged = git diff --cached --name-only; $bad = $staged | Where-Object { ($_ -match '(?i)(^|/)\.env($|\..*)' -and $_ -notmatch '(?i)\.example$') -or $_ -match '(?i)\.(dump|pem|key|pfx|p12|bak)$' -or $_ -match '(?i)^(backups|scratch)/' }; if ($bad) { Write-Host '[SECURITY ERROR] Prohibited files detected in staged index:' -ForegroundColor Red; $bad | ForEach-Object { Write-Host \"  - $_\" -ForegroundColor Red }; exit 1 } else { exit 0 }"

if errorlevel 1 (
    echo.
    echo ================================================================================
    echo [SECURITY GATE FAILED] Sensitive files or unapproved artifacts were detected!
    echo Unstaging all files immediately for safety.
    echo ================================================================================
    git reset >nul 2>&1
    goto :fail
)
echo    [PASS] Security gate passed. No secrets or prohibited artifacts staged.

:: Commit changes
git commit -m "%COMMIT_MSG%"
if errorlevel 1 (
    echo [ERROR] Git commit failed.
    goto :fail
)

:: ============================================================================
:: 8. Push to GitHub
:: ============================================================================
:do_push
echo.
echo [8/8] Publishing to GitHub (origin main)...
git push origin main
if errorlevel 1 (
    echo.
    echo ================================================================================
    echo [ERROR] Git push failed.
    echo Possible causes:
    echo  - Network connectivity error
    echo  - GitHub authentication required (Git Credential Manager)
    echo  - Remote contains new commits; run GITHUB_PULL.bat first
    echo ================================================================================
    goto :fail
)

:success
echo.
echo ================================================================================
echo [SUCCESS] Local changes successfully synchronized to GitHub!
echo Remote: %EXPECTED_REMOTE% (branch: main)
echo ================================================================================
echo.
pause
exit /b 0

:fail
echo.
echo ================================================================================
echo [ABORTED] Push operation was not completed. No remote changes were made.
echo ================================================================================
echo.
pause
exit /b 1
