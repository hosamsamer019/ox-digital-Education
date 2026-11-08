# ==============================================================================
# OX-DIGITAL Education - Canonical Administrator Password Recovery (Interactive)
# ==============================================================================
# Prompts operator privately for their existing saved browser password using native masked input.
# ==============================================================================

Write-Host "======================================================================" -ForegroundColor Cyan
Write-Host "OX-DIGITAL Education — Canonical Administrator Password Recovery" -ForegroundColor Cyan
Write-Host "Target Account: admin@edu.com (User ID: admin_91xnz3, Role: ADMIN)" -ForegroundColor Cyan
Write-Host "Target Database: ox_digital_dev_test on 127.0.0.1:5433" -ForegroundColor Cyan
Write-Host "======================================================================" -ForegroundColor Cyan
Write-Host ""

# 1. Prompt for password privately with hidden characters
$pass1 = Read-Host -Prompt "Enter your saved browser password for admin@edu.com (hidden)" -AsSecureString
if (-not $pass1) {
    Write-Host "[ERROR] Password cannot be empty." -ForegroundColor Red
    exit 1
}

$pass2 = Read-Host -Prompt "Confirm your saved browser password" -AsSecureString
if (-not $pass2) {
    Write-Host "[ERROR] Confirmation password cannot be empty." -ForegroundColor Red
    exit 1
}

# 2. Compare secure strings
$bstr1 = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($pass1)
$plain1 = [System.Runtime.InteropServices.Marshal]::PtrToStringAuto($bstr1)
[System.Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr1)

$bstr2 = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($pass2)
$plain2 = [System.Runtime.InteropServices.Marshal]::PtrToStringAuto($bstr2)
[System.Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr2)

if ($plain1 -cne $plain2) {
    Write-Host ""
    Write-Host "[ERROR] Passwords do not match. Aborting recovery without changes." -ForegroundColor Red
    $plain1 = $null
    $plain2 = $null
    exit 1
}

if ($plain1.Trim().Length -lt 6) {
    Write-Host ""
    Write-Host "[ERROR] Password must be at least 6 characters long." -ForegroundColor Red
    $plain1 = $null
    $plain2 = $null
    exit 1
}

Write-Host ""
Write-Host "[Security Check Passed] Proceeding with atomic password recovery..." -ForegroundColor Green
Write-Host ""

# 3. Pipe password directly to node recovery worker via stdin
$currentScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$projectRoot = Split-Path -Parent $currentScriptDir
$workerPath = Join-Path $currentScriptDir "recover_admin_worker.cjs"

Set-Location $projectRoot

$plain1 | node $workerPath

# Clear sensitive memory variables
$plain1 = $null
$plain2 = $null
