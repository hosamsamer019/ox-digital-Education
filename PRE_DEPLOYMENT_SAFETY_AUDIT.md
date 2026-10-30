# OX-DIGITAL Education — Pre-Deployment Safety Audit Report (Phase 5.1)

**Audit Date:** October 21, 2026  
**Auditor:** Antigravity AI Engineering Safety Team  
**Scope:** Pre-Deployment Verification of Staging Architecture, Database Target, Backup/Restore Procedures, Redis Security, Health Checks, Environment Variables, and Migrations  
**Target Repository:** `D:\OX-DIGITAL\Mathe\Mathteachersmartplatform-main`  
**Evaluation Mode:** Strictly READ-ONLY Verification (No containers started, no migrations applied, no credentials modified)  

---

## 1. Executive Summary & Final Verdict

### Final Pre-Deployment Verdict: **`BLOCKED — SAFETY FIXES REQUIRED`**

### Summary of Verdict
While the core business application, frontend Vite build, and TypeScript microservices are cleanly implemented and free of hardcoded credentials, **staging deployment is strictly BLOCKED** due to three high-severity operational and security risks in the deployment configuration and runbook:

1. **Target Database Ambiguity & Data Loss Risk (CRITICAL):**  
   The production compose file (`docker-compose.production.yml`) allocates a brand-new named Docker volume (`platform-postgres-data`) that is completely isolated from the development volume (`postgres_data`) and any host PostgreSQL installation. If an operator launches staging following the runbook without restoring existing data, the application will initialize against an **empty database**. Furthermore, because `platform-postgres` does not expose port 5432 to the host, running host verification scripts (`node scripts/ensure_admin.mjs`) will probe the wrong database (`localhost:5432`) rather than the container database.
2. **Flawed Backup Procedure on Windows (HIGH):**  
   The proposed backup command (`docker exec platform-postgres pg_dump ... > .\backups\pre_migration_backup.sql`) will fail immediately because `./backups` does not exist in the repository. Furthermore, standard redirection (`>`) in Windows PowerShell outputs UTF-16LE with BOM, which corrupts SQL dump ingestion in standard tools. It also fails to detect `pg_dump` failures, potentially creating a 0-byte or error-string file.
3. **Dead Redis Connection in Auth Service (HIGH):**  
   `initRedis()` is **never invoked** anywhere in `services/auth-service/src/index.ts`. Consequently, `redisClient` remains permanently `null`, forcing all password reset tokens and JTI logout blocklists into ephemeral in-process JavaScript `Map` instances (`memoryResetStore`, `memoryBlocklist`). This means password resets and logout revocations will fail or be lost across container restarts or horizontally scaled replicas.
4. **Health Check Routing Mismatches (MEDIUM):**  
   Three out of five health check endpoints documented in the runbook (`/api/users/health`, `/api/courses/health`, `/api/analytics/health`) will return **HTTP 404 Not Found** through Nginx because the backend services only mount `/health` at their application root rather than on their API sub-paths.
5. **Nginx SSL Ingress Inconsistency (MEDIUM):**  
   `docker-compose.production.yml` binds host port `443:443`, but `nginx/nginx.conf` contains no SSL server block, no TLS certificate paths, and `./nginx/ssl` is empty. HTTPS connections to port 443 will be dropped or rejected.

---

## 2. Table of Ranked Findings

| ID | Category | Severity | File Reference | Finding Summary |
|---|---|---|---|---|
| **F-01** | Database Target | **CRITICAL** | `docker-compose.production.yml:270,335` vs `docker-compose.yml:93,122` | **Named Volume Isolation:** Staging PostgreSQL binds to `platform-postgres-data`, which does not inherit data from `postgres_data` or host PostgreSQL. Unwary deployment starts against an empty database. |
| **F-02** | Database Access | **HIGH** | `docker-compose.production.yml:285` vs `scripts/ensure_admin.mjs:25` | **Host Port Isolation vs Host Scripts:** `platform-postgres` publishes no host ports. Running `node scripts/ensure_admin.mjs` on host connects to `localhost:5432` (host dev DB), creating a split-brain verification error. |
| **F-03** | Backup Safety | **HIGH** | `STAGING_RUNBOOK.md:62` | **Flawed PowerShell Backup:** Directory `./backups` is missing; PowerShell `>` operator produces UTF-16LE with BOM and masks stderr errors, creating corrupted or 0-byte dumps. |
| **F-04** | Redis / Sessions | **HIGH** | `services/auth-service/src/index.ts:1-41` & `packages/shared/src/redis.ts:6-26` | **Uninitialized Redis Client:** `initRedis()` is never called in `auth-service`. Reset tokens and JTI blocklists reside in process memory, breaking across restarts and multiple replicas. |
| **F-05** | Health Probes | **MEDIUM** | `nginx/nginx.conf:99,138,173` vs `services/*/src/index.ts` | **Health Endpoint 404s:** Runbook commands probe `/api/users/health`, `/api/courses/health`, and `/api/analytics/health`, which do not exist in route handlers (mounted at `/health` only). |
| **F-06** | Ingress / SSL | **MEDIUM** | `docker-compose.production.yml:12` vs `nginx/nginx.conf:57-61` | **Port 443 Published Without SSL Config:** Host port 443 is exposed, but Nginx configuration only listens on port 80. `./nginx/ssl` is empty. |
| **F-07** | Configuration | **MEDIUM** | `.env.production.example` vs `docker-compose.production.yml:68-75` | **Missing SMTP Variables in Example:** `.env.production.example` completely lacks `SMTP_*` and `SENDGRID_*` variables, leaving operators without outbound email config. |
| **F-08** | Secret Names | **LOW** | `services/auth-service/src/controllers/auth.controller.ts:60` vs `.env.production.example:36` | **Mismatched Refresh Secret Key:** Code strictly requires `REFRESH_TOKEN_SECRET`. `.env.production.example` also lists `JWT_REFRESH_SECRET`, which is unused in application code. |
| **F-09** | Startup Order | **LOW** | `docker-compose.production.yml:18-22,76-78` | **Service Startup Dependencies:** `user-service`, `ai-service`, and `analytics-service` do not declare `depends_on: postgres`, relying on connection retry loops during boot. |
| **F-10** | Unused Config | **LOW** | `.env.production.example:55,64-65` | **Dormant Environment Variables:** `CLOUDFLARE_R2_PUBLIC_DOMAIN` is never read in code; `SENTRY_DSN` is not forwarded into Compose containers. |

---

## 3. Audit A — Identify the Database Target

### 3.1 Trace of Database Configuration
- **Prisma Datasource (`packages/database/prisma/schema.prisma:8-9`):**
  ```prisma
  datasource db {
    provider  = "postgresql"
    url       = env("DATABASE_URL")
    directUrl = env("DIRECT_URL")
  }
  ```
- **Prisma Client Factory (`packages/database/src/index.ts:13-23`):**
  Instantiates `PrismaClient` using `process.env.DATABASE_URL`.
- **Development Compose (`docker-compose.yml:91-102`):**
  - Container: `math_platform_db`
  - Host Port: `5432:5432`
  - Volume: `postgres_data`
- **Production Compose (`docker-compose.production.yml:268-285`):**
  - Container: `platform-postgres`
  - Host Port: **None** (internal to `platform-platform-network`)
  - Volume: `postgres-data` mapped to top-level `name: platform-postgres-data`
  - Internal DB URL: `postgresql://postgres:[PASSWORD]@postgres:5432/math_platform?schema=public`
- **Local Dev Config (`packages/database/.env:1` & `.env:1`):**
  `DATABASE_URL="postgresql://postgres:password@localhost:5432/math_platform"`

### 3.2 Evaluation of Database Target Risks
1. **Empty Database Trap:**  
   Docker named volumes are strictly isolated by name. The development volume `mathteachersmartplatform-main_postgres_data` is distinct from `platform-postgres-data`. If an operator executes `docker compose -f docker-compose.production.yml up -d postgres`, Docker will create a **brand-new, completely empty PostgreSQL database cluster**.
2. **Accidental Split-Brain Verification:**  
   The runbook advises running `node scripts/ensure_admin.mjs` on the host to verify the administrator account. However, `platform-postgres` does not expose port 5432. Therefore:
   - If a local PostgreSQL instance is running on the host at port 5432, `ensure_admin.mjs` will connect to the **host development database**, falsely reporting success while the staging container database remains completely empty.
   - If no local PostgreSQL is running on the host, `ensure_admin.mjs` will crash with `ECONNREFUSED`.
3. **Container Recreation Data Preservation:**  
   Because `docker-compose.production.yml` defines the volume as `name: platform-postgres-data`, running `docker compose down` and `docker compose up` **does preserve** data within that named volume. However, running `docker compose down -v` or starting on a new server will start with an empty volume.
4. **Unverified Offline Facts:**  
   Because PostgreSQL is currently offline on port 5432 (`ECONNREFUSED`), the following facts remain unverified:
   - Whether any existing database dump has ever been loaded into any volume on this host.
   - Whether the schema in any existing database matches the migration history.
   - The actual existence, email, and password hash of the administrator account in the intended target.

### 3.3 Database-Target Identification Checklist
Before launching staging, the operator must complete this checklist:

- [ ] **Target Database Type Determined:** Is the target an existing managed cloud database (AWS RDS, Supabase, Neon) or the internal Compose container?
- [ ] **If Using Existing External Database:** Is `DATABASE_URL` in `.env.production` pointing to the external host, and is `platform-postgres` disabled or omitted in Compose?
- [ ] **If Using Internal Compose Database:** Has a validated SQL dump of the real data been restored into `platform-postgres-data` prior to running migrations?
- [ ] **Host Port Awareness:** Acknowledge that `node scripts/ensure_admin.mjs` must be run **inside** the container network (`docker compose run --rm prisma-migrate node scripts/ensure_admin.mjs` or via `docker exec platform-auth-service node scripts/ensure_admin.mjs`), NOT directly on the host.

---

## 4. Audit B — Backup and Restore Safety

### 4.1 Vulnerability Analysis of Proposed Runbook Command
The runbook proposed:
```powershell
docker exec platform-postgres pg_dump -U postgres math_platform > .\backups\pre_migration_backup.sql
```

**Critical Defects Identified:**
1. **Missing Directory:** The directory `./backups` does not exist in the repository. Running the command fails immediately in both PowerShell and cmd.exe.
2. **PowerShell UTF-16LE Encoding Corruption:** In standard Windows PowerShell (v5.1), stdout redirection via `>` writes text encoded in UTF-16 Little Endian with a Byte Order Mark (BOM). PostgreSQL `psql` cannot parse UTF-16LE SQL scripts without conversion, leading to syntax errors during restore.
3. **Stderr Masking & Silent Failure:** If `platform-postgres` is stopped, or if authentication fails, `docker exec` emits the error message to stderr. The `>` operator creates a file containing either 0 bytes or error text, yet the operator may believe a successful backup occurred.
4. **No Timestamping:** Overwrites the static filename `pre_migration_backup.sql`, preventing multi-point recovery.
5. **Plaintext Credential Exposure:** Plaintext SQL dumps contain hashed credentials, session tokens, and user PII without restricted file permissions.

### 4.2 Production-Grade Windows PowerShell Backup Procedure

The following procedure replaces runbook section 2.3:

```powershell
# ==============================================================================
# SAFE PRE-MIGRATION BACKUP PROCEDURE (Windows PowerShell 5.1 / 7+)
# ==============================================================================

# Step 1: Ensure local backups directory exists with restricted permissions
$backupDir = ".\backups"
if (-not (Test-Path -Path $backupDir)) {
    New-Item -ItemType Directory -Path $backupDir | Out-Null
    Write-Host "[OK] Created backups directory: $backupDir"
}

# Step 2: Verify PostgreSQL container is running and healthy
$pgStatus = docker inspect platform-postgres --format='{{.State.Health.Status}}' 2>$null
if ($pgStatus -ne "healthy") {
    Write-Error "[FATAL] platform-postgres container is not healthy (Status: $pgStatus). Aborting backup!"
    exit 1
}

# Step 3: Define timestamped backup paths
$timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$containerTempPath = "/tmp/backup_${timestamp}.dump"
$hostBackupPath = "${backupDir}\math_platform_${timestamp}.dump"

Write-Host "[INFO] Initiating custom-format compressed pg_dump inside container..."

# Step 4: Execute pg_dump directly to container filesystem (avoids PowerShell stream corruption)
docker exec platform-postgres pg_dump -U postgres -d math_platform -Fc --no-owner --no-privileges -f $containerTempPath
if ($LASTEXITCODE -ne 0) {
    Write-Error "[FATAL] pg_dump failed inside container with exit code $LASTEXITCODE. Halting deployment!"
    exit 1
}

# Step 5: Transfer verified binary archive to host via docker cp
Write-Host "[INFO] Copying dump file from container to host..."
docker cp "platform-postgres:${containerTempPath}" "$hostBackupPath"
if ($LASTEXITCODE -ne 0) {
    Write-Error "[FATAL] Failed to copy backup file to host. Halting deployment!"
    exit 1
}

# Step 6: Clean up temporary container file
docker exec platform-postgres rm -f $containerTempPath

# Step 7: Verify host file existence and size threshold (> 10KB)
if (-not (Test-Path -Path $hostBackupPath)) {
    Write-Error "[FATAL] Backup file not found on host filesystem: $hostBackupPath"
    exit 1
}

$fileSize = (Get-Item -Path $hostBackupPath).Length
Write-Host "[INFO] Local backup archive created: $hostBackupPath (Size: $fileSize bytes)"

if ($fileSize -lt 10240) {
    Write-Error "[FATAL] Backup file is suspiciously small ($fileSize bytes < 10KB). Database may be empty or dump was incomplete. Halting!"
    exit 1
}

# Step 8: Validate archive integrity and catalog header via pg_restore --list
Write-Host "[INFO] Validating backup archive integrity via pg_restore..."
docker exec -i platform-postgres pg_restore --list < $hostBackupPath > $null 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Error "[FATAL] pg_restore integrity validation failed. Archive appears corrupt. Halting!"
    exit 1
}

# Step 9: Restrict host file permissions (Owner read/write only)
icacls "$hostBackupPath" /inheritance:r /grant:r "$($env:USERNAME):(R,W)" | Out-Null
Write-Host "[SUCCESS] Pre-migration backup verified and secured successfully."
```

### 4.3 Isolated Restore Test Plan (Dry-Run Verification)
*Note: Do NOT execute this test against staging or production databases.*

To verify that the backup is functionally restorable without endangering existing data:

1. **Spin up an isolated scratch container on an isolated network:**
   ```powershell
   docker run -d --name isolated-restore-test -e POSTGRES_PASSWORD=scratch_test_pass -e POSTGRES_DB=restore_verification postgres:15-alpine
   ```
2. **Wait for container readiness:**
   ```powershell
   docker exec isolated-restore-test pg_isready -U postgres -d restore_verification
   ```
3. **Stream backup dump into isolated container:**
   ```powershell
   docker cp ".\backups\math_platform_${timestamp}.dump" isolated-restore-test:/tmp/restore.dump
   docker exec isolated-restore-test pg_restore -U postgres -d restore_verification --no-owner --no-privileges /tmp/restore.dump
   ```
4. **Assert core table counts:**
   ```powershell
   docker exec isolated-restore-test psql -U postgres -d restore_verification -c "SELECT count(*) AS user_count FROM \"User\";"
   docker exec isolated-restore-test psql -U postgres -d restore_verification -c "SELECT count(*) AS course_count FROM \"Course\";"
   ```
5. **Destroy scratch container:**
   ```powershell
   docker rm -f isolated-restore-test
   ```

---

## 5. Audit C — Redis, Sessions, and Password Reset

### 5.1 Inspection of `packages/shared/src/redis.ts`
The shared Redis module defines:
```typescript
let redisClient: ReturnType<typeof createClient> | null = null;
export const initRedis = async () => { ... };
export const getRedisClient = () => redisClient;
const memoryResetStore = new Map<string, { email: string; expiresAt: number }>();
const memoryBlocklist = new Map<string, number>();
```

### 5.2 Critical Vulnerabilities in Redis Architecture
1. **`initRedis()` is Never Called:**  
   Inspection of `services/auth-service/src/index.ts` proves that `initRedis()` is **never imported or invoked**. As a result, `redisClient` remains permanently `null`.
2. **Silent In-Memory Fallback:**  
   Every invocation of `blocklistToken`, `isTokenBlocklisted`, `setPasswordResetToken`, `getPasswordResetEmail`, and `deletePasswordResetToken` falls back to process-memory `Map` instances (`memoryResetStore`, `memoryBlocklist`).
3. **Multi-Replica / Multi-Container Failure:**  
   Process memory is private to a single Node.js process. In any multi-container setup (or even single container restart):
   - When a user requests a password reset, the token is written to Node's memory. If the container restarts or another replica handles the submission, the token is unrecognized and the user is blocked.
   - When a user logs out, their refresh token JTI is blacklisted in Node's local memory. If presented to another replica or after a container restart, the blacklisted token remains valid.
4. **"Zero-Downtime Fallback" Myth:**  
   The previous report's description of this fallback as "zero-downtime" is technically inaccurate and dangerous. In production, security-sensitive token revocation and password reset state must **fail closed** or require Redis connectivity.

### 5.3 Recommended Architecture Fix (To be implemented post-audit)
1. In `services/auth-service/src/index.ts`, add startup initialization:
   ```typescript
   import { initRedis } from '@shared/utils';
   await initRedis();
   ```
2. In `packages/shared/src/redis.ts`, in `NODE_ENV === 'production'`, throw an error if `setPasswordResetToken` or `blocklistToken` is invoked while `redisClient` is null or disconnected:
   ```typescript
   if (!redisClient && process.env.NODE_ENV === 'production') {
     throw new Error('Redis is required in production for security token storage');
   }
   ```
3. Remove hardcoded `const isRedisDisabled = true;` in `services/course-service/src/jobs/riskEngine.job.ts:10`.

---

## 6. Audit D — Docker, Nginx, and Health Checks

### 6.1 Container & Network Architecture Verification
- **Container Names:**
  - Gateway: `platform-nginx`
  - Frontend: `platform-frontend`
  - Services: `platform-auth-service`, `platform-user-service`, `platform-ai-service`, `platform-course-service`, `platform-analytics-service`, `platform-video-worker`
  - Data: `platform-postgres`, `platform-redis`
  - Tools/Backup: `platform-prisma-migrate`, `platform-pg-backup`
- **Network Isolation:** Verified. All containers attach to `platform-platform-network` (bridge).
- **Host Port Exposure:** Verified. Only Nginx publishes ports (`80:80` and `443:443`). No backend microservice, database, or Redis port is bound to the host network.

### 6.2 Health Check Route Mismatch Verification
Testing health probes as prescribed in Runbook section 5.1:

| Runbook Probed URL | Nginx Proxy Target | Backend Handler Found? | Expected HTTP Status |
|---|---|---|---|
| `GET /health` | Handled by Nginx | Built-in Nginx stub (`return 200 'OK'`) | **200 OK** |
| `GET /` | `http://frontend:80/` | Frontend Nginx (`/usr/share/nginx/html/index.html`) | **200 OK** |
| `GET /api/auth/health` | `http://auth-service:4001/api/auth/health` | `routes/auth.routes.ts:22` (`router.get('/health')`) | **200 OK** |
| `GET /api/users/health` | `http://user-service:4002/api/users/health` | **None** (`index.ts:25` only mounts `/health`) | **404 Not Found** ⚠️ |
| `GET /api/ai/health` | `http://ai-service:4003/api/ai/health` | `index.ts:85` (`app.get('/api/ai/health')`) | **200 OK** |
| `GET /api/courses/health` | `http://course-service:4004/api/courses/health` | **None** (`index.ts:51` only mounts `/health`) | **404 Not Found** ⚠️ |
| `GET /api/analytics/health` | `http://analytics-service:4005/api/analytics/health` | **None** (`index.ts:25` only mounts `/health`) | **404 Not Found** ⚠️ |

**Root Cause:** `user-service`, `course-service`, and `analytics-service` mount `/health` on `app`, but their Nginx ingress blocks only forward `/api/users/*`, `/api/courses/*`, and `/api/analytics/*`.  
**Runbook Impact:** Probing these 3 URLs as documented will falsely indicate service failure. The runbook must be updated to probe valid routes or container-internal health endpoints.

### 6.3 Nginx SSL Gap
- `docker-compose.production.yml:12` publishes `443:443` and mounts `./nginx/ssl:/etc/nginx/ssl:ro`.
- `nginx/nginx.conf` has **no `listen 443 ssl` directives**, no SSL certificate configurations, and no HTTP-to-HTTPS redirect.
- Directory `./nginx/ssl` is currently empty.
- **Finding:** Staging cannot serve HTTPS until certificates are provided and SSL server blocks are added to Nginx.

### 6.4 Volume Persistence Verification
- `postgres-data` (`platform-postgres-data`): Persistent volume for PostgreSQL `/var/lib/postgresql/data`.
- `redis-data` (`platform-redis-data`): Persistent volume for Redis append-only files `/data`.
- `course-uploads` (`platform-course-uploads`): Persistent volume for uploaded course and exam assets `/app/uploads`.
- `postgres-backups` (`platform-postgres-backups`): Persistent volume for cron backups `/backups`.
All four volumes are named and survive container stop/recreate cycles.

---

## 7. Audit E — Environment Variables and Authentication

### 7.1 Cross-Reference Matrix

| Variable | In `.env.production.example` | In Compose | In Application Code | Status / Discrepancy |
|---|---|---|---|---|
| `DATABASE_URL` | Yes | Yes | Yes (`@smartmath/database`) | **Aligned** |
| `DIRECT_URL` | Yes | Yes | Yes (Prisma datasource) | **Aligned** |
| `POSTGRES_USER` | Yes | Yes | Yes (PostgreSQL container) | **Aligned** |
| `POSTGRES_PASSWORD` | Yes | Yes (Mandatory `:?`) | Yes (PostgreSQL container) | **Aligned** |
| `POSTGRES_DB` | Yes | Yes | Yes (PostgreSQL container) | **Aligned** |
| `JWT_SECRET` | Yes | Yes | Yes (All microservices) | **Aligned** |
| `REFRESH_TOKEN_SECRET` | Yes | Yes | Yes (`auth-service`) | **Aligned** |
| `JWT_REFRESH_SECRET` | Yes | Yes | **No** (Unused in TS code) | **Cosmetic mismatch** |
| `REDIS_URL` | Yes | Yes | Yes (`packages/shared/src/redis.ts`) | **Aligned** |
| `CLIENT_URL` | Yes | Yes | Yes (CORS, Socket.IO, OpenRouter) | **Aligned** |
| `ALLOWED_ORIGINS` | Yes | Yes | Yes (CORS middleware) | **Aligned** |
| `SMTP_HOST` | **No** (Missing) | Yes | Yes (`services/auth-service/src/services/email.service.ts`) | **CRITICAL GAP** in example env |
| `SMTP_PORT` | **No** (Missing) | Yes | Yes (`email.service.ts`) | **CRITICAL GAP** in example env |
| `SMTP_SECURE` | **No** (Missing) | Yes | Yes (`email.service.ts`) | **CRITICAL GAP** in example env |
| `SMTP_USER` | **No** (Missing) | Yes | Yes (`email.service.ts`) | **CRITICAL GAP** in example env |
| `SMTP_PASS` | **No** (Missing) | Yes | Yes (`email.service.ts`) | **CRITICAL GAP** in example env |
| `SMTP_FROM` | **No** (Missing) | Yes | Yes (`email.service.ts`) | **CRITICAL GAP** in example env |
| `SENDGRID_API_KEY` | **No** (Missing) | Yes | Yes (`email.service.ts`) | **CRITICAL GAP** in example env |
| `SENDGRID_FROM` | **No** (Missing) | Yes | Yes (`email.service.ts`) | **CRITICAL GAP** in example env |
| `SENTRY_DSN` | Yes | **No** | Yes (`packages/shared/src/sentry.ts`) | Not forwarded to containers |
| `SENTRY_ENVIRONMENT` | Yes | **No** | Yes (`sentry.ts`) | Not forwarded to containers |
| `CLOUDFLARE_R2_PUBLIC_DOMAIN` | Yes | **No** | **No** | Unused dormant variable |

### 7.2 Administrator Verification Safety
Inspected `scripts/ensure_admin.mjs`:
- Default invocation (`node scripts/ensure_admin.mjs` or with `--verify`): **Strictly read-only**.
- Queries `db.user.findFirst` for role `ADMIN` or `adminEmail`.
- Exits with return code 0 if found, code 1 if not found.
- Performs zero database inserts, updates, or deletes.
- Only performs account creation when `--bootstrap` flag is explicitly passed AND no administrator exists AND `INITIAL_ADMIN_PASSWORD` (min 8 chars) is provided.

---

## 8. Audit F — Migration Safety

### 8.1 Committed Migration Inspection
The Prisma migration directory `packages/database/prisma/migrations` contains exactly two migration items:

1. **`0_init/migration.sql` (699 lines, 24,639 bytes):**
   - Creates Enums: `Role`, `UploadStatus`, `AcademicLevel`, `PaymentStatus`, `CountryCode`, `EducationLevel`, `GradeLevel`, `AssessmentType`, `AttemptStatus`.
   - Creates Tables: `User`, `CenterGroup`, `Course`, `CourseEnrollment`, `Lesson`, `LessonQuiz`, `VideoProgress`, `Assessment`, `AssessmentAttempt`, `ExternalExamAttempt`, `TemporaryAsset`, `Exam`, `ExamAttempt`, `ExamViolation`, `Homework`, `Submission`, `Attendance`, `Payment`, `QuestionBank`, `StudentRiskHistory`, `Notification`, `ChatSession`, `ChatMessage`, `SavedMathSolution`, `VideoUpload`, `UserSession`, `DailyPlatformStats`.
   - Creates Foreign Keys: Standard cascade and restrict constraints.
   - **Destructive Statements:** None. Zero `DROP TABLE`, zero `DROP COLUMN`, zero `TRUNCATE`.
2. **`20261001_enable_rls/migration.sql` (53 lines, 2,848 bytes):**
   - Applies `ALTER TABLE IF EXISTS ... ENABLE ROW LEVEL SECURITY;` across all 23 application tables.
   - Grants full access to `service_role` and `postgres` roles in schema `public`.
   - **Destructive Statements:** None. Purely additive security hardening.

### 8.2 Migration Command Verification
`docker-compose.production.yml:259` executes:
```bash
npx prisma migrate deploy --schema=/app/packages/database/prisma/schema.prisma
```
- Applies pending committed migrations only.
- Does NOT execute `prisma db push`.
- Does NOT trigger schema reset or table truncation.
- Exits with an error if schema divergence or history conflicts occur, protecting existing records.

---

## 9. Corrected Staging Startup Sequence (Reference Plan — DO NOT EXECUTE)

When safety fixes are completed and operator authorization is given, the deployment must follow this strict sequence:

1. **Phase 1: Environment & Secrets Provisioning**
   - Populate `.env.production` including all database, JWT, and SMTP credentials.
   - Verify syntax via `docker compose -f docker-compose.production.yml config -q`.
2. **Phase 2: Database Preparation & Data Verification**
   - Start data containers: `docker compose -f docker-compose.production.yml up -d postgres redis`.
   - Wait for healthy status: `docker compose -f docker-compose.production.yml ps`.
   - If migrating existing data: Restore validated data snapshot into `platform-postgres`.
   - Execute safe Windows pre-migration backup via container-internal dump + `docker cp`.
   - Execute read-only administrator verification inside the network:
     `docker compose -f docker-compose.production.yml run --rm prisma-migrate node scripts/ensure_admin.mjs`
3. **Phase 3: Schema Migration Deployment**
   - Apply pending migrations:
     `docker compose -f docker-compose.production.yml run --rm prisma-migrate`
4. **Phase 4: Launch Microservices & Ingress**
   - Launch application stack: `docker compose -f docker-compose.production.yml up -d`
   - Inspect startup logs: `docker compose -f docker-compose.production.yml logs -f --tail=50`
5. **Phase 5: Functional Smoke Testing**
   - Test Ingress: `curl -I http://localhost/health`
   - Test Frontend: `curl -I http://localhost/`
   - Test Backend Services via valid endpoints.
   - Perform read-only browser verification.

---

## 10. Explicitly Forbidden Commands Until Operator Approval

The following commands are strictly prohibited until the operator resolves the findings and grants written approval:

```
❌ docker compose -f docker-compose.production.yml up (DO NOT START SERVICES)
❌ docker compose -f docker-compose.production.yml run (DO NOT RUN CONTAINERS)
❌ npx prisma migrate deploy (DO NOT APPLY MIGRATIONS)
❌ npx prisma db push (FORBIDDEN — CAN CAUSE SILENT DATA LOSS)
❌ npx prisma migrate reset (FORBIDDEN — DROPS DATABASE TABLES)
❌ node scripts/ensure_admin.mjs --bootstrap (DO NOT BOOTSTRAP WITHOUT APPROVAL)
❌ docker compose down -v (FORBIDDEN — DESTROYS PERSISTENT VOLUMES)
❌ DROP DATABASE / DROP TABLE / TRUNCATE
```

---

## 11. Read-Only Verification Actions Executed in this Phase

1. Inspected `packages/database/prisma/migrations/0_init/migration.sql` (699 lines).
2. Inspected `packages/database/prisma/migrations/20261001_enable_rls/migration.sql` (53 lines).
3. Inspected `packages/database/prisma/schema.prisma` datasource and generators.
4. Inspected `docker-compose.production.yml` and `docker-compose.yml` service definitions, volume names, and port publishing.
5. Inspected `STAGING_RUNBOOK.md` step-by-step commands and verified compatibility on Windows.
6. Inspected `packages/shared/src/redis.ts` and searched all callers across `services/`.
7. Inspected `nginx/nginx.conf` and `apps/frontend/nginx.conf` location blocks and SSL configuration.
8. Inspected `apps/frontend/Dockerfile` and `services/Dockerfile`.
9. Inspected `services/auth-service/src/index.ts` and `routes/auth.routes.ts`.
10. Inspected `services/user-service/src/index.ts` and `routes/user.routes.ts`.
11. Inspected `services/course-service/src/index.ts` and `routes/course.routes.ts`.
12. Inspected `services/ai-service/src/index.ts` and routes.
13. Inspected `services/analytics-service/src/index.ts` and routes.
14. Inspected `scripts/ensure_admin.mjs` verification and bootstrap modes.
15. Cross-referenced all environment variables across `.env.production.example`, Compose, and source code.
16. Confirmed zero services were started and zero databases were accessed.
