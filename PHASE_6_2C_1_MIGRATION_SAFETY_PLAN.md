# OX-DIGITAL Education — Phase 6.2C.1
# Database Migration Safety & Rollback Architecture Plan

**Date:** 2026-11-02  
**Project:** OX-DIGITAL Education  
**Authorized Workspace:** `D:\OX-DIGITAL\Mathe\OX-DIGITAL-GITHUB`  
**Git Baseline Verified:** `main @ 0500b93e65c24ed881349c4acea7f523332c5e9f` (`0500b93`)  
**Execution Mode:** Strictly Read-Only Architecture Design (No Database Operations Executed)  

---

## 1. Executive Summary

This document specifies the technical design, pre-migration verification protocols, transactional DDL scripts, backfill procedures, and rollback plans required to execute a safe database schema alignment in a future authorized phase (Phase 6.2C.2).

**NO SQL COMMANDS OR MIGRATIONS WERE EXECUTED IN THIS PHASE.**

---

## 2. Pre-Migration Prerequisites & Backup Protocol

Before any database operation is authorized, the following safety gates must be cleared:

### 2.1 Backup Execution
```bash
# Production container backup (DOCUMENTATION ONLY - DO NOT RUN IN THIS PHASE)
docker exec -t ox-digital-postgres pg_dump -U postgres -d ox_digital_db -F c -b -v -f /backups/ox_digital_pre_6_2c_$(date +%Y%m%d_%H%M%S).dump
```

### 2.2 Restore Validation Requirement
* A backup file alone does not guarantee restorability.
* **Mandatory Restore Test:** Before initiating schema modifications on the primary database, the dump file must be restored into an isolated, temporary throwaway container to verify checksum integrity, table counts, and row counts.

---

## 3. Transactional DDL Migration Sequence

PostgreSQL 11+ supports adding columns with default values or nullable types as metadata-only operations without full table rewrites or exclusive table locks.

### Step 1: DDL Additions (`Exam` and `ExamAttempt`)
```sql
-- Phase 6.2C Transactional Migration (DOCUMENTATION ONLY)
BEGIN;

-- 1. Ensure AttemptStatus enum has required states
-- (STARTED, IN_PROGRESS, SUBMITTED, TIME_EXPIRED, GRADED, CHEATING already exist in schema)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'AttemptStatus') THEN
    CREATE TYPE "AttemptStatus" AS ENUM ('STARTED', 'IN_PROGRESS', 'SUBMITTED', 'TIME_EXPIRED', 'GRADED', 'CHEATING');
  END IF;
END$$;

-- 2. Add totalPoints to Exam
ALTER TABLE "Exam" 
  ADD COLUMN IF NOT EXISTS "totalPoints" DOUBLE PRECISION DEFAULT 100;

-- 3. Add lifecycle and scoring columns to ExamAttempt
ALTER TABLE "ExamAttempt"
  ADD COLUMN IF NOT EXISTS "status" "AttemptStatus" DEFAULT 'STARTED',
  ADD COLUMN IF NOT EXISTS "submittedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "isGraded" BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS "totalPoints" DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "percentage" DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP;

COMMIT;
```

---

## 4. Historical Data Backfill Sequence (Data-Preserving)

To adhere strictly to the Non-Invention Directive, the data backfill script uses explicit conditional logic rather than blanket defaults:

```sql
-- Phase 6.2C Controlled Historical Backfill (DOCUMENTATION ONLY)
BEGIN;

-- 1. Abandoned sessions: score = 0 and answers is null or empty
UPDATE "ExamAttempt"
SET 
  "status" = 'STARTED',
  "isGraded" = false,
  "submittedAt" = NULL,
  "percentage" = NULL
WHERE "score" = 0 AND ("answers" IS NULL OR "answers"::text = '[]' OR "answers"::text = 'null');

-- 2. Legitimate completed attempts: score > 0 with recorded answers
UPDATE "ExamAttempt"
SET 
  "status" = 'GRADED',
  "isGraded" = true,
  "percentage" = "score", -- exam.controller.ts recorded percentage as score
  "totalPoints" = 100
WHERE "score" > 0 AND "answers" IS NOT NULL AND "answers"::text != '[]' AND "answers"::text != 'null';

-- 3. Cheating disqualified attempts: cross-reference ExamViolation
UPDATE "ExamAttempt" ea
SET 
  "status" = 'CHEATING',
  "isGraded" = false,
  "percentage" = 0.0
WHERE ea."score" = 0 
  AND ea."answers" IS NOT NULL 
  AND ea."answers"::text != '[]'
  AND EXISTS (
    SELECT 1 FROM "ExamViolation" ev 
    WHERE ev."studentId" = ea."studentId" AND ev."examId" = ea."examId"
  );

COMMIT;
```

---

## 5. Rollback Strategy & Recovery Protocol

If an unexpected condition arises during migration:

### Level 1: Transaction Abort
* All DDL and DML operations are wrapped in explicit `BEGIN ... COMMIT` blocks. Any error automatically rolls back changes, leaving tables in their exact pre-migration state.

### Level 2: Down Migration Script
```sql
-- Rollback DDL (DOCUMENTATION ONLY)
BEGIN;

ALTER TABLE "ExamAttempt"
  DROP COLUMN IF EXISTS "status",
  DROP COLUMN IF EXISTS "submittedAt",
  DROP COLUMN IF EXISTS "isGraded",
  DROP COLUMN IF EXISTS "totalPoints",
  DROP COLUMN IF EXISTS "percentage",
  DROP COLUMN IF EXISTS "updatedAt";

ALTER TABLE "Exam"
  DROP COLUMN IF EXISTS "totalPoints";

COMMIT;
```

### Level 3: Full Snapshot Restore
* In the catastrophic event of unrecoverable database corruption, restore from the verified pre-migration dump.

---

## 6. Locking and Downtime Analysis

* **Lock Type:** `ALTER TABLE ... ADD COLUMN` requires `ACCESS EXCLUSIVE` lock briefly to update the catalog. Because all columns are nullable or have simple defaults, PostgreSQL will not rewrite tables.
* **Lock Duration:** Expected $< 100\text{ ms}$ on tables with $< 100,000$ rows.
* **Downtime Recommendation:** Schedule a 5-minute maintenance window for safety during service restarts.

---

## 7. Phased Deployment & Service Restart Order

```
[1. Pre-Migration Backup & Isolated Restore Test]
                      │
                      ▼
[2. Execute Transactional DDL & Backfill Script]
                      │
                      ▼
[3. Rebuild & Deploy packages/database (Prisma Client)]
                      │
                      ▼
[4. Deploy & Restart services/course-service]
                      │
                      ▼
[5. Deploy & Restart services/analytics-service & user-service]
                      │
                      ▼
[6. Execute Post-Migration Automated Acceptance Suite]
```

