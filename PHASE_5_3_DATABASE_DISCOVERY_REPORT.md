# PHASE 5.3 — DATABASE DISCOVERY & SAFE STAGING PREPARATION REPORT

**Date:** 2026-10-22  
**Platform:** OX-DIGITAL Education Platform (Math Teacher Smart Platform)  
**Workspace:** `D:\OX-DIGITAL\Mathe\Mathteachersmartplatform-main`  
**Execution Mode:** Strictly Read-Only Investigation  

---

## 1. Safety Status

```text
READ-ONLY — NO DATABASE CONNECTION PERFORMED
NO CONTAINERS STARTED
NO DATABASE CHANGES MADE
```

During Phase 5.3, all operations strictly adhered to the non-destructive discovery mandate:
- **No containers were started, stopped, restarted, or created.**
- **No `docker compose up`, `docker compose run`, or `docker compose start` was executed.**
- **No database connections were attempted (`psql`, Prisma Studio, Prisma Client, Prisma CLI were not invoked).**
- **No migrations or seed scripts were executed (`prisma migrate deploy/dev`, `prisma db push/reset`, `scripts/ensure_admin.mjs` were not executed).**
- **No Docker volumes were created, deleted, pruned, or modified.**
- **No credentials, tokens, passwords, or secret values were exposed or printed.**

---

## 2. Executive Summary

A comprehensive, non-destructive audit of host services, Docker daemon state, container metadata, volume mappings, Prisma migration definitions, and backup infrastructure was executed.

### Critical Discovery: Split-Architecture and Existing Live Stack
1. **Host PostgreSQL**: Does not exist. No PostgreSQL Windows service is installed, and port 5432 is completely closed on the Windows host.
2. **Current Production Compose Target**: `docker-compose.production.yml` in this repository specifies the named volume `platform-postgres-data`. **This volume DOES NOT EXIST on the Docker host.** Starting production compose in this repo without prior migration/restore would generate an empty database, causing total apparent data loss.
3. **Active Running Stack (`alsaden-*`)**: The Docker daemon is currently running an active 11-container platform stack (`alsaden-postgres`, `alsaden-redis`, `alsaden-auth-service`, `alsaden-user-service`, `alsaden-course-service`, `alsaden-ai-service`, `alsaden-analytics-service`, `alsaden-video-worker`, `alsaden-nginx`, `alsaden-frontend`, `alsaden-pg-backup`). This running stack originated from `D:\Mathe\Mathteachersmartplatform-main` and has its PostgreSQL database attached to named volume **`alsaden-postgres-data`** (created 2026-10-04).
4. **Detached Development Volume**: A volume named **`mathteachersmartplatform-main_postgres_data`** (created 2026-09-25) exists on the host, detached from any currently running container.
5. **No Full Database Dumps Found**: No `.dump` or `.sql` backup files exist on the filesystem. The only backup found is `scripts/backups/legacy_questions_backup.json` (20 KB).

Because there are multiple candidate database volumes across two repository directories (`D:\Mathe` and `D:\OX-DIGITAL\Mathe`), and connecting to them without operator sign-off is prohibited, the safety verdict is **`TARGET AMBIGUOUS — BLOCKED`**.

---

## 3. Database Target Inventory

| Environment / Stack | DB Host / Service | DB Port | DB Name | Docker Volume / Path | Volume Creation Date | State & Health |
|---|---|---:|---|---|---|---|
| **Host PostgreSQL** | `localhost` / `127.0.0.1` | 5432 | N/A | N/A | N/A | **NOT INSTALLED** (Port 5432 closed) |
| **Development Compose** (`docker-compose.yml`) | `postgres` (internal) | 5432:5432 | `math_platform` | `mathteachersmartplatform-main_postgres_data` | 2026-09-25 14:10:44 UTC | **EXISTS (Detached)** |
| **Current Repo Prod** (`docker-compose.production.yml`) | `postgres` / `math-platform-postgres` | 5432 (internal) | `math_platform` | `platform-postgres-data` | N/A | **DOES NOT EXIST** (Will initialize empty) |
| **Active Running Stack** (`alsaden-*` containers) | `alsaden-postgres` | 5432 (internal) | `math_platform` | `alsaden-postgres-data` | 2026-10-04 13:39:23 UTC | **EXISTS (Actively Mounted & Running)** |

---

## 4. Docker Volume Findings

Inspection via `docker volume ls` and `docker volume inspect` identified the following exact volume statuses:

### Volume 1: `alsaden-postgres-data`
- **Volume Name:** `alsaden-postgres-data`
- **Driver:** `local`
- **Mountpoint:** `/var/lib/docker/volumes/alsaden-postgres-data/_data`
- **Created:** `2026-10-04T13:39:23Z`
- **Labels:** `com.docker.compose.volume=alsaden-postgres-data`
- **Attachment:** Actively mounted to running container `alsaden-postgres` (`postgres:15-alpine`).
- **Significance:** Primary candidate for the active operational database. Created when the `alsaden-*` stack was deployed on October 4, 2026.

### Volume 2: `mathteachersmartplatform-main_postgres_data`
- **Volume Name:** `mathteachersmartplatform-main_postgres_data`
- **Driver:** `local`
- **Mountpoint:** `/var/lib/docker/volumes/mathteachersmartplatform-main_postgres_data/_data`
- **Created:** `2026-09-25T14:10:44Z`
- **Labels:** `com.docker.compose.project=mathteachersmartplatform-main`, `com.docker.compose.volume=postgres_data`
- **Attachment:** Detached. Not mounted to any active container.
- **Significance:** Created by earlier development compose execution (`docker-compose.yml`). May contain legacy development data.

### Volume 3: `platform-postgres-data`
- **Volume Name:** `platform-postgres-data`
- **Referenced in:** `D:\OX-DIGITAL\Mathe\Mathteachersmartplatform-main\docker-compose.production.yml`
- **Status:** **DOES NOT EXIST ON DOCKER HOST.**
- **Critical Risk:** If `docker compose -f docker-compose.production.yml up` is executed in the workspace without re-pointing or restoring data into this volume, Docker will initialize a brand-new, empty PostgreSQL volume.

---

## 5. Database Configuration Map

All connection parameters have been inspected statically from Compose files and environment templates. Sensitive credentials have been strictly redacted:

```text
[Host Configuration]
  PostgreSQL Service: None (Not installed)
  Port 5432: Closed

[Development Stack (docker-compose.yml)]
  Hostname: postgres
  Port (External): 5432
  Port (Internal): 5432
  POSTGRES_DB: ${POSTGRES_DB:-math_platform}
  POSTGRES_USER: ${POSTGRES_USER:-postgres}
  POSTGRES_PASSWORD: [REDACTED - SENSITIVE]
  Volume: postgres_data -> /var/lib/postgresql/data
  Network: platform-network

[Staging/Production Target (docker-compose.production.yml in D:\OX-DIGITAL)]
  Container Name: math-platform-postgres
  Hostname: postgres
  Port (Internal): 5432
  Port (External): None (Restricted to platform-network)
  POSTGRES_DB: ${POSTGRES_DB:-math_platform}
  POSTGRES_USER: ${POSTGRES_USER:-postgres}
  POSTGRES_PASSWORD: [REDACTED - SENSITIVE]
  Volume: platform-postgres-data -> /var/lib/postgresql/data
  Network: platform-network

[Active Running Stack (alsaden-postgres)]
  Container Name: alsaden-postgres
  Image: postgres:15-alpine
  Port (Internal): 5432
  Port (External): None (Exposed internally to alsaden-network)
  POSTGRES_DB: ${POSTGRES_DB:-math_platform}
  POSTGRES_USER: ${POSTGRES_USER:-postgres}
  POSTGRES_PASSWORD: [REDACTED - SENSITIVE]
  Volume: alsaden-postgres-data -> /var/lib/postgresql/data
  Network: alsaden-network
  Working Dir Origin: D:\Mathe\Mathteachersmartplatform-main
```

---

## 6. Backup Infrastructure & Existing Backup Findings

### Filesystem Backup Search Findings
- **Target Directories Scanned:** `D:\OX-DIGITAL\Mathe\Mathteachersmartplatform-main` and `D:\Mathe\Mathteachersmartplatform-main`.
- **Full Database Dumps (`.dump`, `.backup`, `.sql`, `.tar`):** **NONE FOUND.**
- **Existing Backup File:** `scripts/backups/legacy_questions_backup.json` (20,733 bytes, Last Modified: August 14, 2026). This is a legacy question seed dataset, not a database backup.
- **Code Backups:** `scratch/phase0_backup/` containing `riskEngine.job.ts`, `seed.ts`, and `vite.config.ts`.
- **Automated Backup Container:** `alsaden-pg-backup` is currently running, mounting volume `ac73dbe2...` to `/var/lib/postgresql/data` and bind-mounting `scripts/pg_backup.sh`. However, no external backup directory was mounted to the host filesystem.

### Backup Script Analysis (`scripts/pg_backup.sh`)
```bash
pg_dump -Fc -h postgres -U postgres -d math_platform -f /backups/math_platform_${TIMESTAMP}.dump
```
1. **Host Assumption:** Assumes the database host is named `postgres`. In the running `alsaden` stack, the service hostname is `alsaden-postgres`.
2. **Format:** Uses PostgreSQL custom archive format (`-Fc`), which is optimal for `pg_restore`.
3. **Execution Context:** The script is a bash script designed for a Linux container. It cannot be run directly via PowerShell on the Windows host without Docker or WSL.
4. **Volume Decoupling:** The script relies on an internal container mount `/backups`. Without a host bind-mount, backups stored inside container volumes are difficult to extract during disaster recovery.

---

## 7. Migration Safety Review

The Prisma migration directory (`packages/database/prisma/migrations`) was audited statically:

1. **Migration `0_init/migration.sql` (699 lines):**
   - Declares initial Enums: `Role`, `UploadStatus`, `AcademicLevel`, `PaymentStatus`, `CountryCode`, `EducationLevel`, `GradeLevel`, `AssessmentType`, `AttemptStatus`.
   - Creates core tables: `User`, `CenterGroup`, `Course`, `CourseEnrollment`, `Lesson`, `Assessment`, `Exam`, `Payment`, etc.
   - Creates primary keys, foreign key constraints, and unique indexes.
2. **Migration `20261001_enable_rls/migration.sql` (53 lines):**
   - Enables PostgreSQL Row Level Security: `ALTER TABLE IF EXISTS "<Table>" ENABLE ROW LEVEL SECURITY;` across all application tables.
   - Explicitly grants full permissions to `service_role` and `postgres` roles to ensure backend microservices retain uninterrupted data access.

### Safety Verification:
- **Destructive Commands:** **ZERO FOUND.** Neither migration contains `DROP TABLE`, `DROP COLUMN`, `TRUNCATE`, or destructive data modifications.
- **Migration Order:** Linear and additive (`0_init` followed by `20261001_enable_rls`).

---

## 8. Admin Account Status

```text
ADMIN ACCOUNT STATUS: NOT VERIFIED — DB CONNECTION NOT PERFORMED IN PHASE 5.3
```

- In accordance with the Phase 5.3 strict read-only safety rules, no connection to PostgreSQL was opened.
- Therefore, the presence of `admin@edu.com` in either `alsaden-postgres-data` or `mathteachersmartplatform-main_postgres_data` **CANNOT** be confirmed at this time.
- No attempt was made to run `scripts/ensure_admin.mjs` or query the `User` table.

---

## 9. Main Risks & Uncertainties

1. **Empty Volume Initialization Risk:** If `docker compose -f docker-compose.production.yml up` is run in the current workspace, Docker will create a new empty volume `platform-postgres-data`. All services will start against a blank database, masking existing records.
2. **Port Collision Risk:** Container `alsaden-nginx` is currently running and listening on host ports `80` and `443`. If Nginx or web services in `D:\OX-DIGITAL` are started, port binding errors will crash the new containers.
3. **Dual Repository / Split-Brain Risk:**
   - Workspace A: `D:\Mathe\Mathteachersmartplatform-main` (origin of currently running `alsaden-*` stack).
   - Workspace B: `D:\OX-DIGITAL\Mathe\Mathteachersmartplatform-main` (target workspace with Phase 5.1 & 5.2 security remediation and staging runbooks).
4. **Lack of Verified Backup:** There is currently no verified `.dump` file on the Windows host to restore from if either database volume becomes corrupted.

---

## 10. Recommended Next Phase (Phase 5.4)

Before starting any staging or production containers in `D:\OX-DIGITAL`, the following sequential actions must occur:

1. **Operator Target Confirmation:** Operator must confirm whether `alsaden-postgres-data` is the live source of truth containing existing users (`admin@edu.com`), courses, and exams.
2. **Non-Disruptive Snapshot:** Once confirmed, perform a safe, isolated `pg_dump` of the active database directly from the running `alsaden-postgres` container into an external host directory (e.g., `D:\OX-DIGITAL\backups\pre_migration_20261022.dump`).
3. **Isolated Read-Only Verification:** Spin up a temporary, isolated throwaway PostgreSQL container bound to an ephemeral port (e.g., 5433) using the dumped backup to safely verify that `admin@edu.com` and all records are intact.
4. **Volume Realignment:** Update `docker-compose.production.yml` in `D:\OX-DIGITAL` to either:
   - Mount the verified live volume (`alsaden-postgres-data`), OR
   - Restore the verified snapshot into `platform-postgres-data` before launching the new stack.

---

## 11. Final Verdict

```text
TARGET AMBIGUOUS — BLOCKED
```

**Rationale:** Multiple database volumes exist on the host (`alsaden-postgres-data` actively running vs. `mathteachersmartplatform-main_postgres_data` detached vs. `platform-postgres-data` uncreated). Determining which volume contains the true active data cannot be done with absolute certainty without operator confirmation and an authorized read-only inspection. Proceeding with deployment would risk initializing an empty database or conflicting with the live running platform.
