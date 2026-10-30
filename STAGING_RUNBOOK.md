# OX-DIGITAL Education — Staging Deployment Runbook

> [!IMPORTANT]
> This runbook is intended for authorized operators executing a controlled deployment to staging or production.
> Follow the phases in exact numerical order. Do not skip pre-flight checks or backup procedures.

---

## Phase 1: Pre-Flight Configuration & Read-Only Validation

### 1.1 Prepare Environment Secrets File
Create the target environment file on the staging host. Never commit this file to version control.

```bash
# Copy template to target configuration file
cp .env.production.example .env.production
chmod 600 .env.production
```

Populate the required secrets with strong, unpredictable values (e.g., using `openssl rand -base64 32`).

### 1.2 Validate Docker Compose Configuration (Without Starting Containers)
Execute configuration interpolation check to confirm that all required variables are set and that syntax is valid:

```bash
docker compose -f docker-compose.production.yml config -q
```
- **Expected Result:** Command terminates with exit code `0` and no output.
- **If it Fails:** Inspect error messages for missing required variables (e.g., `POSTGRES_PASSWORD`).

### 1.3 Validate Prisma Database Schema
```bash
npx prisma validate --schema=packages/database/prisma/schema.prisma
```
- **Expected Result:** `The schema at packages/database/prisma/schema.prisma is valid 🚀`

---

## Phase 2: Database Target Verification & Pre-Migration Backup

> [!CAUTION]
> **CRITICAL DATABASE TARGET WARNING:**
> `docker-compose.production.yml` uses named volume `ox-digital-postgres-data`. This is an **ISOLATED, INDEPENDENT VOLUME**.
> It does NOT contain data from the old project volume (`alsaden-postgres-data`) or legacy dev volumes.
> If starting `ox-digital-postgres` for the first time, the database will be a **FRESH, CLEAN DATABASE**.
> Complete the checklist below before continuing.

### 2.0 Database Target Checklist
- [ ] Determine if the target database is an external PostgreSQL instance (AWS RDS, Supabase, Neon) or internal Compose `ox-digital-postgres`.
- [ ] If external: Update `DATABASE_URL` and `DIRECT_URL` in `.env.production` and do not start container `postgres`.
- [ ] If internal Compose: Confirm that `ox-digital-postgres-data` is mounted and isolated.
- [ ] Confirm `POSTGRES_PASSWORD` in `.env.production` matches the credentials used in `DATABASE_URL`.

### 2.1 Start PostgreSQL and Redis Only
Start the isolated data containers in the background:

```bash
docker compose -f docker-compose.production.yml up -d postgres redis
```

### 2.2 Verify Database Container Health
```bash
docker compose -f docker-compose.production.yml ps postgres redis
```
Wait until both containers indicate `(healthy)` before proceeding.

### 2.3 Take Pre-Migration Database Snapshot (Windows PowerShell 5.1 / 7+)
Execute this verified, robust procedure to prevent PowerShell UTF-16 stream corruption and detect failure:

```powershell
# 1. Ensure backups directory exists
$backupDir = ".\backups"
if (-not (Test-Path -Path $backupDir)) {
    New-Item -ItemType Directory -Path $backupDir | Out-Null
}

# 2. Generate timestamp and paths
$timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$containerTempPath = "/tmp/backup_${timestamp}.dump"
$hostBackupPath = "${backupDir}\ox_digital_education_${timestamp}.dump"

# 3. Dump custom compressed archive directly inside container
docker exec ox-digital-postgres pg_dump -U ox_admin -d ox_digital_education -Fc --no-owner --no-privileges -f $containerTempPath
if ($LASTEXITCODE -ne 0) {
    Write-Error "[FATAL] pg_dump failed inside container. Halting deployment!"
    exit 1
}

# 4. Copy verified binary archive to host
docker cp "ox-digital-postgres:${containerTempPath}" "$hostBackupPath"
if ($LASTEXITCODE -ne 0) {
    Write-Error "[FATAL] docker cp failed to copy backup to host. Halting deployment!"
    exit 1
}

# 5. Clean up container temporary file
docker exec ox-digital-postgres rm -f $containerTempPath

# 6. Verify file size (> 10KB)
$fileSize = (Get-Item -Path $hostBackupPath).Length
if ($fileSize -lt 10240) {
    Write-Error "[FATAL] Backup file is suspiciously small ($fileSize bytes < 10KB). Halting!"
    exit 1
}

# 7. Validate archive catalog header via pg_restore
docker exec -i ox-digital-postgres pg_restore --list < $hostBackupPath > $null 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Error "[FATAL] pg_restore integrity check failed. Halting!"
    exit 1
}

# 8. Restrict file permissions to current user
icacls "$hostBackupPath" /inheritance:r /grant:r "$($env:USERNAME):(R,W)" | Out-Null
Write-Host "[SUCCESS] Pre-migration backup verified: $hostBackupPath ($fileSize bytes)"
```

### 2.4 Verify Existing Administrator Account (Read-Only, Migrated DBs Only)
> [!IMPORTANT]
> Because `ox-digital-postgres` publishes no host ports, running `node scripts/ensure_admin.mjs` on the host will connect to `localhost:5432` (host dev DB) or fail with `ECONNREFUSED`.
> Always execute the verification **inside the container network**:

```bash
docker compose -f docker-compose.production.yml run --rm prisma-migrate node /app/scripts/ensure_admin.mjs
```
- **Expected Output:**
  ```
  ✅ [OX-DIGITAL SECURE ADMIN] Administrator account verified.
  - Email: admin@edu.com
  - Role: ADMIN
  🛡️ Existing credentials, email, role, and permissions are preserved intact.
  ```

> [!NOTE]
> On a fresh, uninitialized database (`ox-digital-postgres-data`), the `User` table does not exist until migrations are applied. Proceed directly to **Phase 3 (Step 1)** to deploy migrations first, followed by **Phase 3.3 (Step 2)** for administrator bootstrap.

---

## Phase 3: Controlled Schema Migration & Admin Bootstrap

### 3.1 Review Pending Migrations
Inspect the migration folder to verify what migrations will be deployed:
```bash
ls packages/database/prisma/migrations/
```

### 3.2 Step 1: Apply Committed Migrations in Isolation
Run the dedicated, one-shot migration runner container (executing its default migration command):

```bash
docker compose -f docker-compose.production.yml run --rm prisma-migrate
```
- **Effective Command:** `npx prisma migrate deploy --schema=/app/packages/database/prisma/schema.prisma`.
- **Target Database:** `ox_digital_education` on `ox-digital-postgres:5432`.
- **Safety Guarantee:** Applies only committed migrations (`0_init` and `20261001_enable_rls`). Never executes `prisma db push`, resets, or seed scripts.
- **Verification:** Operator must confirm output states `All migrations have been successfully applied.` before proceeding.

### 3.3 Step 2: Bootstrap Initial Administrator (Fresh Database Only)
Only after Step 1 has completed and the schema exists, bootstrap the initial administrator:

```bash
# Securely supply INITIAL_ADMIN_PASSWORD via environment (minimum 8 characters; 24+ characters recommended)
docker compose -f docker-compose.production.yml run --rm \
  -e ADMIN_EMAIL="admin@edu.com" \
  -e INITIAL_ADMIN_PASSWORD="<OPERATOR_STRONG_SECRET>" \
  prisma-migrate node /app/scripts/ensure_admin.mjs --bootstrap
```

### 3.4 Step 3: Verify Administrator Account (Read-Only)
Verify that the account exists and credentials are secure without modifying records:
```bash
docker compose -f docker-compose.production.yml run --rm prisma-migrate node /app/scripts/ensure_admin.mjs
```
- **Expected Output:**
  ```
  ✅ [OX-DIGITAL SECURE ADMIN] Administrator account verified.
  - Email: admin@edu.com
  - Role: ADMIN
  🛡️ Existing credentials, email, role, and permissions are preserved intact.
  ```

---

## Phase 4: Full Staging Stack Launch

### 4.1 Launch Application Services
Start all remaining services in the background:

```bash
docker compose -f docker-compose.production.yml up -d
```

### 4.2 Inspect Running Containers
```bash
docker compose -f docker-compose.production.yml ps
```
Verify that all services are running and healthy:
- `ox-digital-nginx`
- `ox-digital-frontend`
- `ox-digital-auth-service`
- `ox-digital-user-service`
- `ox-digital-ai-service`
- `ox-digital-course-service`
- `ox-digital-analytics-service`
- `ox-digital-video-worker`
- `ox-digital-postgres`
- `ox-digital-redis`
- `ox-digital-pg-backup`

### 4.3 Inspect Initial Startup Logs
```bash
docker compose -f docker-compose.production.yml logs -f --tail=50
```
Check for clean startup logs and database connection success messages across all services.

---

## Phase 5: Post-Deployment Smoke Tests

### 5.1 Gateway and Service Health Probes
Execute HTTP GET requests against the Nginx ingress gateway:

```bash
# 1. Ingress Gateway Health (Direct Nginx Stub)
curl -I http://localhost/health
# Expected: HTTP/1.1 200 OK

# 2. Nginx Routing to Frontend SPA
curl -I http://localhost/
# Expected: HTTP/1.1 200 OK

# 3. Microservice Health Probes Through Ingress Gateway (HTTP GET)
curl -I http://localhost/api/auth/health
# Expected: HTTP/1.1 200 OK

curl -I http://localhost/api/users/health
# Expected: HTTP/1.1 200 OK

curl -I http://localhost/api/ai/health
# Expected: HTTP/1.1 200 OK

curl -I http://localhost/api/courses/health
# Expected: HTTP/1.1 200 OK

curl -I http://localhost/api/analytics/health
# Expected: HTTP/1.1 200 OK

# 4. Background Video Worker Health (Non-HTTP BullMQ Consumer)
docker exec ox-digital-video-worker pgrep -f node
# Expected: Returns PID (Process active)
```

### 5.2 Browser Functional Verification
1. **Public Landing Page:**
   - Navigate to `http://localhost/` (or your staging domain).
   - Confirm official logo displays cleanly with 1:1 aspect ratio.
   - Confirm headline reads: `منصة أو إكس الرقمية التعليمية | OX-DIGITAL Education`.
2. **Administrator Login:**
   - Navigate to `http://localhost/admin/login`.
   - Authenticate using the verified administrator account.
   - Confirm redirect to `/admin/home` and dashboard metrics load.
3. **Password Reset Verification:**
   - Navigate to `http://localhost/forgot-password`.
   - Submit a test email address.
   - Confirm success feedback message is displayed without leaking account existence.

---

## Phase 6: Rollback and Recovery Plan

If unexpected failures occur during staging verification, follow this immediate rollback procedure:

### 6.1 Stop Application Services
```bash
docker compose -f docker-compose.production.yml down
```

### 6.2 Restore Database from Pre-Migration Backup (Custom Dump Format)
```bash
# 1. Start PostgreSQL container only
docker compose -f docker-compose.production.yml up -d postgres

# 2. Re-create clean database target
docker exec -i ox-digital-postgres psql -U ox_admin -d postgres -c "DROP DATABASE IF EXISTS ox_digital_education;"
docker exec -i ox-digital-postgres psql -U ox_admin -d postgres -c "CREATE DATABASE ox_digital_education;"

# 3. Restore from custom compressed archive using pg_restore
docker cp ".\backups\ox_digital_education_[TIMESTAMP].dump" ox-digital-postgres:/tmp/rollback.dump
docker exec ox-digital-postgres pg_restore -U ox_admin -d ox_digital_education --no-owner --no-privileges /tmp/rollback.dump
docker exec ox-digital-postgres rm -f /tmp/rollback.dump
```

### 6.3 Re-verify Restored State
Verify administrator records inside the container:
```bash
docker compose -f docker-compose.production.yml run --rm prisma-migrate node scripts/ensure_admin.mjs
```
Confirm the restored database contains the administrator account and legitimate records.

---

## Appendix: Environment Variables Reference by Service

### Global / Infrastructure (`.env.production`)
| Variable | Description | Safe Staging Placeholder |
|---|---|---|
| `NODE_ENV` | Application runtime environment | `production` |
| `CLIENT_URL` | Public frontend URL (used in CORS & emails) | `https://staging.yourdomain.com` |
| `ALLOWED_ORIGINS` | Permitted browser origins for CORS | `https://staging.yourdomain.com` |
| `TRUST_PROXY` | Nginx reverse-proxy trust depth | `1` |
| `POSTGRES_USER` | Database superuser | `postgres` |
| `POSTGRES_PASSWORD` | Database user password (mandatory) | `replace_with_strong_password` |
| `POSTGRES_DB` | Database catalog name | `math_platform` |
| `DATABASE_URL` | Microservices connection string | `postgresql://postgres:[PASS]@postgres:5432/math_platform?schema=public` |
| `DIRECT_URL` | Direct connection string for Prisma migrations | `postgresql://postgres:[PASS]@postgres:5432/math_platform?schema=public` |
| `REDIS_URL` | Internal Redis cache connection | `redis://redis:6379` |
| `JWT_SECRET` | Primary JWT signing secret (min 64 chars) | `replace_with_64_byte_random_string` |
| `REFRESH_TOKEN_SECRET` | Refresh token signing secret | `replace_with_separate_64_byte_secret` |
| `INITIAL_ADMIN_PASSWORD` | Used only on fresh database bootstrap | `replace_with_initial_admin_password` |

### Email Service (`auth-service`)
| Variable | Description | Safe Staging Placeholder |
|---|---|---|
| `SMTP_HOST` | Outbound mail server hostname | `smtp.yourdomain.com` |
| `SMTP_PORT` | Outbound mail port (TLS/STARTTLS) | `587` |
| `SMTP_SECURE` | Enforce SSL socket connection | `false` |
| `SMTP_USER` | SMTP authentication username | `noreply@yourdomain.com` |
| `SMTP_PASS` | SMTP authentication password | `replace_with_smtp_password` |
| `SMTP_FROM` | RFC 5322 formatted sender header | `"OX-DIGITAL Education" <noreply@yourdomain.com>` |
| `SENDGRID_API_KEY` | Alternative SendGrid delivery key | `replace_with_sendgrid_key_if_used` |
| `SENDGRID_FROM` | SendGrid verified sender email | `noreply@yourdomain.com` |

### External Video & AI Services (`ai-service`, `video-worker`, `course-service`)
| Variable | Description | Safe Staging Placeholder |
|---|---|---|
| `GEMINI_API_KEY` | Google Gemini SDK key | `replace_with_gemini_key_if_used` |
| `OPENROUTER_API_KEY` | OpenRouter multi-LLM API key | `replace_with_openrouter_key` |
| `CLOUDFLARE_R2_ENDPOINT` | S3-compatible video bucket endpoint | `https://[ID].r2.cloudflarestorage.com` |
| `CLOUDFLARE_R2_ACCESS_KEY_ID` | Cloudflare R2 Access Key | `replace_with_r2_key_id` |
| `CLOUDFLARE_R2_SECRET_ACCESS_KEY` | Cloudflare R2 Secret Key | `replace_with_r2_secret_key` |
| `CLOUDFLARE_R2_BUCKET_NAME` | Video storage bucket name | `platform-videos-staging` |
| `PAYMOB_API_KEY` | Paymob payment gateway key | `replace_with_paymob_key_if_used` |
| `STRIPE_SECRET_KEY` | Stripe payment gateway key | `replace_with_stripe_key_if_used` |
