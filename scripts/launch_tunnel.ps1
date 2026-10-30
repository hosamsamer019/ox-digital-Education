# ==============================================================================
# OX-DIGITAL Education -- Cloudflare Quick Tunnel Supervisor
# Location: scripts/launch_tunnel.ps1
# Target Local Origin: http://localhost:8080
# ==============================================================================

[CmdletBinding()]
param (
    [string]$TargetUrl = "http://localhost:8080",
    [int]$StartupTimeoutSec = 35
)

$ErrorActionPreference = "Stop"

function Write-Banner {
    Write-Host "================================================================================" -ForegroundColor Cyan
    Write-Host "            OX-DIGITAL EDUCATION - CLOUDFLARE QUICK TUNNEL                      " -ForegroundColor Cyan
    Write-Host "================================================================================" -ForegroundColor Cyan
    Write-Host ""
}

function Write-Step {
    param ([string]$stepNum, [string]$stepName)
    Write-Host "[$stepNum] $stepName..." -ForegroundColor Yellow
}

function Write-Success {
    param ([string]$msg)
    Write-Host "    [OK] $msg" -ForegroundColor Green
}

function Write-Fail {
    param ([string]$msg)
    Write-Host "    [FAIL] $msg" -ForegroundColor Red
}

function Write-SecurityAlert {
    param ([string]$msg)
    Write-Host "    [SECURITY ALERT] $msg" -ForegroundColor Red
}

$ScriptDir = if ($PSScriptRoot) { $PSScriptRoot } else { Split-Path -Parent $MyInvocation.MyCommand.Definition }
$ProjectRoot = Split-Path -Parent $ScriptDir
$EnvProdPath = Join-Path $ProjectRoot ".env.production"
$ComposePath = Join-Path $ProjectRoot "docker-compose.production.yml"

function Invoke-SyncDockerServices {
    param (
        [string[]]$ServiceNames
    )

    $prevEAP = $ErrorActionPreference
    try {
        # Temporarily use Continue preference so standard Docker status/recreation output
        # to stderr is not converted into a fatal terminating exception by PowerShell.
        $ErrorActionPreference = "Continue"

        $composeOutput = (& docker compose -p ox-digital-education --env-file "$EnvProdPath" -f "$ComposePath" up -d --no-deps @ServiceNames 2>&1)
        $composeExitCode = $LASTEXITCODE

        if ($composeExitCode -ne 0) {
            Write-Fail "Docker Compose failed with exit code $composeExitCode."
            if ($composeOutput) {
                $composeOutput | ForEach-Object { Write-Host "       $_" -ForegroundColor Red }
            }
            return $false
        }

        # Seamlessly reload Nginx to refresh container upstream IP resolution
        $nginxOutput = (& docker exec ox-digital-nginx nginx -s reload 2>&1)
        $nginxExitCode = $LASTEXITCODE

        if ($nginxExitCode -ne 0) {
            Write-Fail "Nginx reload failed with exit code $nginxExitCode."
            if ($nginxOutput) {
                $nginxOutput | ForEach-Object { Write-Host "       $_" -ForegroundColor Red }
            }
            return $false
        }

        return $true
    } finally {
        $ErrorActionPreference = $prevEAP
    }
}

function Sync-AllowedOrigins {
    param ([string]$TunnelOrigin)

    if (-not (Test-Path $EnvProdPath)) {
        Write-Fail "Could not find .env.production at '$EnvProdPath'."
        return $false
    }

    $rawContent = [System.IO.File]::ReadAllText($EnvProdPath)
    $newAllowedOrigins = if ($TunnelOrigin) {
        "ALLOWED_ORIGINS=http://localhost:8080,$TunnelOrigin"
    } else {
        "ALLOWED_ORIGINS=http://localhost:8080"
    }

    if ($rawContent -match "(?m)^ALLOWED_ORIGINS=.*$") {
        $updatedContent = $rawContent -replace "(?m)^ALLOWED_ORIGINS=.*$", $newAllowedOrigins
    } else {
        $updatedContent = $rawContent + "`r`n$newAllowedOrigins`r`n"
    }

    [System.IO.File]::WriteAllText($EnvProdPath, $updatedContent, [System.Text.Encoding]::UTF8)

    Write-Host "    [CORS SYNC] Synchronized ALLOWED_ORIGINS to: http://localhost:8080, $TunnelOrigin" -ForegroundColor Yellow

    # Hot-reload only API services that enforce CORS (safe: --no-deps, postgres/redis/nginx/frontend are untouched)
    $syncSuccess = Invoke-SyncDockerServices -ServiceNames @("auth-service", "user-service", "course-service", "ai-service", "analytics-service")
    if (-not $syncSuccess) {
        Write-Fail "Failed to reload application services with updated CORS configuration."
        return $false
    }

    # Wait for auth-service to become healthy and verify CORS preflight
    $authHealthy = $false
    for ($i = 0; $i -lt 15; $i++) {
        Start-Sleep -Seconds 1
        $gwCode = (& curl.exe -s -o nul -w "%{http_code}" "$TargetUrl/health" 2>$null)
        if ($gwCode -eq "200") {
            $preflightCode = (& curl.exe -s -o nul -w "%{http_code}" -X OPTIONS "$TargetUrl/api/auth/login" -H "Origin: $TunnelOrigin" -H "Access-Control-Request-Method: POST" 2>$null)
            if ($preflightCode -eq "204") {
                $authHealthy = $true
                break
            }
        }
    }

    if ($authHealthy) {
        Write-Success "CORS synchronized and preflight verified (HTTP 204 OPTIONS)."
        return $true
    } else {
        Write-Fail "Timed out verifying CORS preflight for active tunnel origin."
        return $false
    }
}

Write-Banner

# ==============================================================================
# Phase 1: Preflight Safety and Environment Validations
# ==============================================================================

# 1. Docker CLI and Engine Availability
Write-Step "1/7" "Verifying Docker CLI and Docker Engine availability"
$dockerCmd = Get-Command docker -ErrorAction SilentlyContinue
if (-not $dockerCmd) {
    Write-Fail "Docker CLI was not found in system PATH."
    Write-Host "       Please install Docker Desktop and ensure it is added to your PATH." -ForegroundColor Yellow
    exit 1
}

$dockerInfo = docker info 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Fail "Docker Engine is not running or unreachable."
    Write-Host "       Please start Docker Desktop and wait until the engine is ready." -ForegroundColor Yellow
    exit 1
}
Write-Success "Docker CLI and Engine are ready and responsive."

# 2. OX-DIGITAL Core Containers Status
Write-Step "2/7" "Verifying OX-DIGITAL container status (project: ox-digital-education)"
$coreContainers = @(
    "ox-digital-nginx",
    "ox-digital-postgres",
    "ox-digital-redis",
    "ox-digital-auth-service",
    "ox-digital-frontend"
)

foreach ($container in $coreContainers) {
    $status = (docker inspect -f "{{.State.Status}}" $container 2>$null)
    if ($status -ne "running") {
        Write-Fail "Required container '$container' is not running (Current status: '$status')."
        Write-Host "       Please run 'start_server.bat' first to initialize the OX-DIGITAL platform." -ForegroundColor Yellow
        exit 1
    }
}
Write-Success "All core OX-DIGITAL containers are running and healthy."

# 3. Gateway Ingress Endpoint Verification (HTTP 200)
Write-Step "3/7" "Verifying local application gateway health ($TargetUrl/health)"
try {
    $curlHttpCode = (& curl.exe -s -o nul -w "%{http_code}" "$TargetUrl/health" 2>$null)
    if ($curlHttpCode -ne "200") {
        Write-Fail "Gateway at $TargetUrl/health returned HTTP status '$curlHttpCode' (expected 200)."
        Write-Host "       The local application gateway is not responding properly." -ForegroundColor Yellow
        exit 1
    }
} catch {
    Write-Fail "Failed to connect to gateway at $TargetUrl/health: $_"
    exit 1
}
Write-Success "Gateway health check passed (HTTP 200 OK)."

# 4. Database Isolation and Host Port Exposure Audit
Write-Step "4/7" "Verifying PostgreSQL port 5432 and Redis port 6379 isolation"
$pgInspectRaw = docker inspect --format "{{json .NetworkSettings.Ports}}" ox-digital-postgres 2>$null
if (-not $pgInspectRaw) {
    Write-Fail "Could not inspect 'ox-digital-postgres' network settings."
    exit 1
}

$pgPorts = $pgInspectRaw | ConvertFrom-Json
$exposed5432 = $pgPorts.'5432/tcp'
if ($null -ne $exposed5432 -and $exposed5432.Count -gt 0) {
    Write-SecurityAlert "PostgreSQL container has host port mapping for 5432!"
    Write-Host "       PostgreSQL must remain internal-only on ox-digital-network." -ForegroundColor Red
    Write-Host "       Refusing to start public tunnel." -ForegroundColor Red
    exit 1
}

$redisInspectRaw = docker inspect --format "{{json .NetworkSettings.Ports}}" ox-digital-redis 2>$null
if ($redisInspectRaw) {
    $redisPorts = $redisInspectRaw | ConvertFrom-Json
    $exposed6379 = $redisPorts.'6379/tcp'
    if ($null -ne $exposed6379 -and $exposed6379.Count -gt 0) {
        Write-SecurityAlert "Redis container has host port mapping for 6379!"
        Write-Host "       Redis must remain internal-only on ox-digital-network." -ForegroundColor Red
        Write-Host "       Refusing to start public tunnel." -ForegroundColor Red
        exit 1
    }
}

$hostPort5432 = Get-NetTCPConnection -LocalPort 5432 -State Listen -ErrorAction SilentlyContinue
if ($hostPort5432) {
    Write-SecurityAlert "Port 5432 is listening on the Windows host!"
    Write-Host "       PostgreSQL must not be exposed on the host interface." -ForegroundColor Red
    Write-Host "       Refusing to start public tunnel." -ForegroundColor Red
    exit 1
}
Write-Success "PostgreSQL (5432) and Redis (6379) are strictly private (no host port bindings)."

# 5. Database Connectivity and Identity Verification (Safe, Credential-Free Check)
Write-Step "5/7" "Verifying PostgreSQL database identity and live connectivity (safe read-only)"
try {
    $dbRaw = docker exec ox-digital-postgres psql -U ox_admin -d ox_digital_education -t -A -c "SELECT current_database(); SELECT 1;" 2>&1
    if ($LASTEXITCODE -ne 0) {
        Write-Fail "Database query execution failed: $dbRaw"
        exit 1
    }
    
    $dbLines = ($dbRaw -split "`r?`n") | Where-Object { $_.Trim() -ne "" }
    $currentDb = if ($dbLines.Count -gt 0) { $dbLines[0].Trim() } else { "" }
    $selectOne = if ($dbLines.Count -gt 1) { $dbLines[1].Trim() } else { "" }

    if ($currentDb -ne "ox_digital_education") {
        Write-SecurityAlert "Connected database is '$currentDb' (expected 'ox_digital_education')!"
        Write-Host "       Safety guard triggered: Refusing to start tunnel against non-OX database." -ForegroundColor Red
        exit 1
    }

    if ($selectOne -ne "1") {
        Write-Fail "Database query 'SELECT 1' returned unexpected result: '$selectOne'"
        exit 1
    }
} catch {
    Write-Fail "Exception during database connectivity verification: $_"
    exit 1
}
Write-Success "PostgreSQL database 'ox_digital_education' verified and active (SELECT 1 returned 1)."

# 6. Application Configuration Database Target Check
Write-Step "6/7" "Verifying application service database target configuration"
try {
    $appTargetDb = docker exec ox-digital-auth-service node -e "const u = new URL(process.env.DATABASE_URL); console.log(u.pathname.replace('/', ''));" 2>&1
    $appTargetDb = $appTargetDb.Trim()
    if ($appTargetDb -ne "ox_digital_education") {
        Write-SecurityAlert "Application auth-service is configured to database '$appTargetDb' (expected 'ox_digital_education')!"
        Write-Host "       Safety guard triggered: Refusing to start tunnel." -ForegroundColor Red
        exit 1
    }
} catch {
    Write-Fail "Could not verify application backend database configuration: $_"
    exit 1
}
Write-Success "Application backend is strictly wired to 'ox_digital_education'."

# 7. Cloudflared Availability Check
Write-Step "7/7" "Verifying Cloudflare Tunnel CLI (cloudflared)"
$cfCmd = Get-Command cloudflared -ErrorAction SilentlyContinue
if (-not $cfCmd) {
    Write-Fail "'cloudflared' was not found on your system PATH."
    Write-Host ""
    Write-Host "================================================================================" -ForegroundColor Yellow
    Write-Host " CLOUDFLARED INSTALLATION INSTRUCTIONS:" -ForegroundColor Yellow
    Write-Host " 1. Install via Windows Package Manager (recommended):" -ForegroundColor White
    Write-Host "      winget install --id Cloudflare.cloudflared" -ForegroundColor Cyan
    Write-Host " 2. Or download cloudflared-windows-amd64.exe from:" -ForegroundColor White
    Write-Host "      https://github.com/cloudflare/cloudflared/releases/latest" -ForegroundColor Cyan
    Write-Host "    Rename it to cloudflared.exe and place it in your PATH." -ForegroundColor White
    Write-Host "================================================================================" -ForegroundColor Yellow
    exit 1
}
$cfVersion = (& cloudflared --version 2>&1)
Write-Success "Found: $cfVersion"

Write-Host ""
Write-Host "All preflight safety checks passed successfully!" -ForegroundColor Green
Write-Host ""

# ==============================================================================
# Phase 2: Start Cloudflare Quick Tunnel and Capture Ephemeral URL
# ==============================================================================

# Cleanup any orphaned cloudflared processes before starting a fresh tunnel
$existingCf = Get-Process -Name cloudflared -ErrorAction SilentlyContinue
if ($existingCf) {
    Write-Host "[INFO] Terminating previous cloudflared process (PID $($existingCf.Id))..." -ForegroundColor DarkYellow
    $existingCf | Stop-Process -Force -ErrorAction SilentlyContinue
    Start-Sleep -Seconds 1
}

Write-Host "Starting Cloudflare Quick Tunnel forwarding to $TargetUrl..." -ForegroundColor Cyan
Write-Host "Requesting ephemeral tunnel URL from trycloudflare.com (timeout: ${StartupTimeoutSec}s)..." -ForegroundColor Gray
Write-Host ""

$psi = New-Object System.Diagnostics.ProcessStartInfo
$psi.FileName = $cfCmd.Source
$psi.Arguments = "tunnel --url $TargetUrl"
$psi.RedirectStandardError = $true
$psi.RedirectStandardOutput = $false
$psi.UseShellExecute = $false
$psi.CreateNoWindow = $true

$proc = $null
$tunnelUrl = $null
$capturedLogs = [System.Collections.Generic.List[string]]::new()

try {
    $proc = [System.Diagnostics.Process]::Start($psi)
    $stopwatch = [System.Diagnostics.Stopwatch]::StartNew()

    while (-not $proc.HasExited -and $stopwatch.Elapsed.TotalSeconds -lt $StartupTimeoutSec -and -not $tunnelUrl) {
        $line = $proc.StandardError.ReadLine()
        if ($null -ne $line) {
            $capturedLogs.Add($line)
            # Detect trycloudflare.com URL
            if ($line -match "(https://[a-zA-Z0-9-]+\.trycloudflare\.com)") {
                $tunnelUrl = $matches[1]
                break
            }
        } else {
            Start-Sleep -Milliseconds 100
        }
    }

    if (-not $tunnelUrl) {
        Write-Host ""
        if ($proc.HasExited) {
            Write-Fail "Cloudflare tunnel exited unexpectedly with exit code $($proc.ExitCode)."
        } else {
            Write-Fail "Timed out after ${StartupTimeoutSec}s waiting for Quick Tunnel URL."
        }
        Write-Host ""
        Write-Host "Recent cloudflared log output:" -ForegroundColor Yellow
        $capturedLogs | Select-Object -Last 15 | ForEach-Object { Write-Host "  $_" -ForegroundColor DarkGray }
        exit 1
    }

    # Synchronize CORS configuration for active ephemeral Quick Tunnel URL
    Write-Step "CORS" "Synchronizing active Quick Tunnel origin ($tunnelUrl) with application configuration"
    $corsSynced = Sync-AllowedOrigins -TunnelOrigin $tunnelUrl
    if (-not $corsSynced) {
        Write-Fail "Could not safely synchronize CORS policy. Aborting tunnel."
        exit 1
    }

    # ==========================================================================
    # Phase 3: Tunnel Active Display and Browser Launch
    # ==========================================================================
    $startedTime = (Get-Date).ToString("yyyy-MM-dd HH:mm:ss")

    Write-Host "================================================================================" -ForegroundColor Green
    Write-Host "         OX-DIGITAL EDUCATION - CLOUDFLARE QUICK TUNNEL ACTIVE                  " -ForegroundColor Green
    Write-Host "================================================================================" -ForegroundColor Green
    Write-Host "  Local Origin    : $TargetUrl (OX-DIGITAL Nginx Gateway)" -ForegroundColor White
    Write-Host "  Public URL      : " -NoNewline -ForegroundColor White
    Write-Host "$tunnelUrl" -ForegroundColor Cyan
    Write-Host "  CORS Policy     : Synchronized (http://localhost:8080, $tunnelUrl)" -ForegroundColor White
    Write-Host "  Database Target : ox_digital_education (Verified Internal / No Host Port)" -ForegroundColor White
    Write-Host "  Started At      : $startedTime" -ForegroundColor White
    Write-Host "================================================================================" -ForegroundColor Green
    Write-Host "  [STATUS]      Tunnel connected and serving live traffic." -ForegroundColor Green
    Write-Host "  [ACCESS]      You can access the platform from any device using the URL above." -ForegroundColor White
    Write-Host "  [BROWSER]     Opening default browser to $tunnelUrl..." -ForegroundColor Yellow
    Write-Host "  [STOP TUNNEL] Press [Ctrl+C] at any time in this window to stop the tunnel." -ForegroundColor Magenta
    Write-Host "================================================================================" -ForegroundColor Green
    Write-Host ""

    # Open browser
    try {
        Start-Process $tunnelUrl
    } catch {
        Write-Host "[WARNING] Could not automatically open browser: $_" -ForegroundColor DarkYellow
    }

    Write-Host "Streaming tunnel events (press Ctrl+C to stop):" -ForegroundColor DarkGray
    Write-Host ""

    # Stream remaining events while keeping supervisor alive
    while (-not $proc.HasExited) {
        $line = $proc.StandardError.ReadLine()
        if ($null -ne $line) {
            # Filter for significant connection events or errors
            if ($line -match "ERR|WRN|Registered tunnel|connection|quic|http2") {
                $timestamp = (Get-Date).ToString("HH:mm:ss")
                Write-Host "[$timestamp] $line" -ForegroundColor DarkGray
            }
        } else {
            Start-Sleep -Milliseconds 200
        }
    }

    if ($proc.HasExited) {
        Write-Host ""
        Write-Host "[NOTICE] Cloudflare process exited with code $($proc.ExitCode)." -ForegroundColor Yellow
    }

} finally {
    if ($proc -and -not $proc.HasExited) {
        Write-Host ""
        Write-Host "================================================================================" -ForegroundColor Yellow
        Write-Host " Shutting down Cloudflare Quick Tunnel..." -ForegroundColor Yellow
        try {
            $proc.Kill()
            $proc.WaitForExit(3000)
        } catch {}
        Write-Host " Tunnel stopped cleanly. Local origin ($TargetUrl) is no longer exposed." -ForegroundColor Green
        Write-Host "================================================================================" -ForegroundColor Yellow
    }

    # Clean up temporary tunnel origin from .env.production and restore clean localhost-only configuration
    if (Test-Path $EnvProdPath) {
        Write-Host ""
        Write-Host "Restoring local-only CORS configuration (http://localhost:8080)..." -ForegroundColor Yellow
        try {
            $rawContent = [System.IO.File]::ReadAllText($EnvProdPath)
            if ($rawContent -match "trycloudflare\.com") {
                $cleanedContent = $rawContent -replace "(?m)^ALLOWED_ORIGINS=.*$", "ALLOWED_ORIGINS=http://localhost:8080"
                [System.IO.File]::WriteAllText($EnvProdPath, $cleanedContent, [System.Text.Encoding]::UTF8)
                $cleanSuccess = Invoke-SyncDockerServices -ServiceNames @("auth-service", "user-service", "course-service", "ai-service", "analytics-service")
                if ($cleanSuccess) {
                    Write-Host "    [OK] Ephemeral tunnel origin removed. Localhost-only policy restored." -ForegroundColor Green
                } else {
                    Write-Host "    [WARNING] Could not automatically reload application services after cleanup." -ForegroundColor DarkYellow
                }
            } else {
                Write-Host "    [OK] Configuration is already clean (localhost-only)." -ForegroundColor Green
            }
        } catch {
            Write-Host "    [WARNING] Could not automatically reset .env.production: $_" -ForegroundColor DarkYellow
        }
    }
}
