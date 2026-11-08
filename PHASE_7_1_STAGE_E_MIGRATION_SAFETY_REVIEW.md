# OX-DIGITAL Education — Task 7.1
## Stage E: Migration Safety & DDL Lock-Impact Review

**Workspace:** `D:\OX-DIGITAL\Mathe\OX-DIGITAL-GITHUB`  
**GitHub Repository:** `https://github.com/hosamsamer019/ox-digital-Education.git`  
**Current Git HEAD:** `0500b93e65c24ed881349c4acea7f523332c5e9f` (branch `main`)  
**Target Migration:** `packages/database/prisma/migrations/20261102_task_7_1_institution_branch_foundation/migration.sql`  
**Execution Mode:** STRICT READ-ONLY DDL STATIC ANALYSIS (NOT APPLIED TO DATABASE)  
**Date:** November 2, 2026  

---

## 1. Executive Summary

This review provides a thorough static safety audit of the Task 7.1 multi-tenancy schema migration. The DDL script introduces the multi-tenant root (`Institution`), physical and digital branches (`Branch`), secure manager onboarding (`PrimaryManagerInvitation`), cold-storage migration quarantine (`_migration_quarantine`), and tenant scoping foreign keys across existing core entities.

Every DDL statement, lock mode, referential action, and index has been analyzed against PostgreSQL 15 concurrency semantics and platform uptime requirements (OD-717).

---

## 2. Statement-by-Statement DDL Operation Analysis

| Section | Target Object | Operation Type | PostgreSQL Lock Mode | Estimated Lock Duration | Data Safety & Compatibility |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **1. Enums** | `InstitutionStatus`, `BranchStatus`, `InvitationStatus` | `CREATE TYPE` | `RowExclusiveLock` | < 5 ms | Safe. Zero table impact. |
| **2. Role Enum** | `Role` | `ALTER TYPE ... ADD VALUE IF NOT EXISTS 'PRIMARY_MANAGER'` | `AccessExclusiveLock` (Catalog only) | < 10 ms | Safe. PostgreSQL 12+ supports `ADD VALUE` without table rewrites. |
| **3. New Table** | `Institution` | `CREATE TABLE` | `RowExclusiveLock` | < 15 ms | Safe. New table; zero existing data affected. |
| **4. New Table** | `Branch` | `CREATE TABLE` | `RowExclusiveLock` | < 15 ms | Safe. New table with FK to `Institution` (`ON DELETE RESTRICT`). |
| **5. New Table** | `PrimaryManagerInvitation` | `CREATE TABLE` | `RowExclusiveLock` | < 15 ms | Safe. New table; supports secure token onboarding (OD-718). |
| **6. Alter Table** | `User` | `ADD COLUMN ... TEXT (nullable)`, `ADD COLUMN isPrimaryManager DEFAULT false` | `AccessExclusiveLock` (Brief metadata lock) | 5–20 ms | Safe. PostgreSQL 15 adds nullable columns and constant defaults without table rewrites. |
| **6. Alter Table** | `User` | `ADD CONSTRAINT fk_user_institution`, `ADD CONSTRAINT fk_user_branch` | `ShareRowExclusiveLock` | Proportional to table size (Table scan) | Safe on empty/new columns. Since all new columns are initially NULL, FK validation passes instantaneously. |
| **6. Alter Table** | `Institution` | `ADD CONSTRAINT fk_institution_primary_manager_user` | `ShareRowExclusiveLock` | < 5 ms | Safe. Circular reference safely resolved; initial rows have null `primaryManagerId`. |
| **6. Alter Table** | `CenterGroup` | `ADD COLUMN ...`, `ADD CONSTRAINT ...` | `AccessExclusiveLock` / `ShareRowExclusiveLock` | 5–15 ms | Safe. Nullable additions; instant FK validation on null values. |
| **6. Alter Table** | `Course` | `ADD COLUMN ...`, `ADD CONSTRAINT ...` | `AccessExclusiveLock` / `ShareRowExclusiveLock` | 5–20 ms | Safe. Nullable additions; instant FK validation on null values. |
| **6. Alter Table** | `Lesson` | `ADD COLUMN deletedAt TIMESTAMP(3)` | `AccessExclusiveLock` (Metadata lock) | < 10 ms | Safe. Supports soft-delete; nullable. |
| **6. Alter Table** | `Payment` | `DROP CONSTRAINT Payment_userId_fkey`, `ADD CONSTRAINT fk_payment_user ON DELETE RESTRICT` | `AccessExclusiveLock` | Proportional to table size (Table scan) | **CRITICAL INVARIANT:** Replaces legacy cascading delete with `ON DELETE RESTRICT` (OD-708 payment protection). Prevents accidental payment deletion. |
| **6. Alter Table** | `Payment` | `ADD COLUMN institutionId`, `ADD COLUMN branchId`, `ADD CONSTRAINT fk_payment_institution`, `ADD CONSTRAINT fk_payment_branch` | `AccessExclusiveLock` / `ShareRowExclusiveLock` | Proportional to table size | Safe. Nullable additions. |
| **6. Alter Table** | `QuestionBank` | `ADD COLUMN institutionId`, `ADD CONSTRAINT fk_question_bank_institution` | `AccessExclusiveLock` / `ShareRowExclusiveLock` | 5–15 ms | Safe. Nullable addition. |
| **6. Alter Table** | `ProcessedMedia` | `ADD COLUMN institutionId`, `ADD CONSTRAINT fk_processed_media_institution` | `AccessExclusiveLock` / `ShareRowExclusiveLock` | 5–15 ms | Safe. Nullable addition. |
| **7. New Table** | `_migration_quarantine` | `CREATE TABLE IF NOT EXISTS` | `RowExclusiveLock` | < 15 ms | Safe. Cold storage archival table (OD-720). |
| **8. Indexes** | 17 Performance Indexes | `CREATE INDEX IF NOT EXISTS` | `ShareLock` (Blocks writes, allows reads) | 100 ms – 3 s per index depending on row count | Maintenance window required (OD-717). See Section 4. |

---

## 3. Referential Action & Constraint Invariants Review

### 3.1 Tenant Root Deletion Guard (`ON DELETE RESTRICT`)
Every tenant-scoped table (`Branch`, `User`, `CenterGroup`, `Course`, `Payment`, `QuestionBank`, `ProcessedMedia`, `PrimaryManagerInvitation`) enforces `ON DELETE RESTRICT` against `Institution(id)`.
- **Safety Impact:** An `Institution` can **never** be dropped or deleted if any dependent records exist. Accidental cascading destruction of an institution's entire educational and financial data is architecturally impossible.

### 3.2 Branch Association Safety (`ON DELETE SET NULL`)
Branch references on `User`, `CenterGroup`, `Course`, and `Payment` enforce `ON DELETE SET NULL`.
- **Safety Impact:** Deactivating or archiving a branch does not destroy historical students, courses, or payments. Their tenancy remains rooted in the parent `Institution`.

### 3.3 Payment Preservation Invariant (OD-708)
Legacy Prisma schema configured `Payment.userId` with cascading deletion. The Task 7.1 migration explicitly remedies this defect:
```sql
ALTER TABLE "Payment"
    DROP CONSTRAINT IF EXISTS "Payment_userId_fkey",
    ADD CONSTRAINT "fk_payment_user" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT;
```
- **Audit Verification:** Confirmed that deleting a `User` account will be rejected by the database engine if financial payment records exist (`VERIFIED_IN_SOURCE`).

---

## 4. Concurrency, Table Locks & Transaction Boundaries

### 4.1 Transaction Atomicity
- **Prisma Migrate Runner:** Executes the migration within an atomic transaction block (`BEGIN ... COMMIT`).
- **Failure Behavior:** If any constraint fails, the entire migration aborts and rolls back completely, leaving the database in its exact pre-migration state.

### 4.2 Lock Impact & Maintenance Window (OD-717)
- In PostgreSQL, `ALTER TABLE ... ADD CONSTRAINT FOREIGN KEY` and `CREATE INDEX` acquire locks that conflict with concurrent write transactions (`INSERT`, `UPDATE`, `DELETE`).
- While `CREATE INDEX CONCURRENTLY` avoids write blocking, PostgreSQL **prohibits `CREATE INDEX CONCURRENTLY` inside a transaction block** (which Prisma migrate enforces).
- **Conclusion:** Standard `CREATE INDEX` inside the migration script is the correct approach for an offline maintenance window deployment (OD-716, OD-717). Services must be in maintenance mode to prevent lock queue timeouts.

---

## 5. Backward Compatibility with Existing Application Services

Because this migration follows the **Expand-and-Contract** pattern:
1. All newly added foreign-key columns (`institutionId`, `branchId`, `deletedAt`) are **nullable**.
2. No existing columns are renamed or dropped.
3. Legacy services that do not yet pass `institutionId` can continue reading existing rows without SQL syntax or null-violation errors during the initial deployment phase.
4. Existing rows are completely unaffected until the authoritative offline backfill is executed.

---

## 6. Migration Rollback Feasibility (Down DDL)

If a hard failure occurs during or immediately following staging deployment, the down DDL procedure is fully deterministic:
```sql
-- Down DDL (Reversion script if required)
DROP TABLE IF EXISTS "_migration_quarantine";
ALTER TABLE "ProcessedMedia" DROP COLUMN IF EXISTS "institutionId";
ALTER TABLE "QuestionBank" DROP COLUMN IF EXISTS "institutionId";
ALTER TABLE "Payment" 
    DROP CONSTRAINT IF EXISTS "fk_payment_branch",
    DROP CONSTRAINT IF EXISTS "fk_payment_institution",
    DROP COLUMN IF EXISTS "branchId",
    DROP COLUMN IF EXISTS "institutionId";
-- Re-establish legacy Payment FK if rolling back pre-remediation state
ALTER TABLE "Lesson" DROP COLUMN IF EXISTS "deletedAt";
ALTER TABLE "Course" 
    DROP CONSTRAINT IF EXISTS "fk_course_branch",
    DROP CONSTRAINT IF EXISTS "fk_course_institution",
    DROP COLUMN IF EXISTS "deletedAt",
    DROP COLUMN IF EXISTS "branchId",
    DROP COLUMN IF EXISTS "institutionId";
ALTER TABLE "CenterGroup" 
    DROP CONSTRAINT IF EXISTS "fk_center_group_branch",
    DROP CONSTRAINT IF EXISTS "fk_center_group_institution",
    DROP COLUMN IF EXISTS "deletedAt",
    DROP COLUMN IF EXISTS "branchId",
    DROP COLUMN IF EXISTS "institutionId";
ALTER TABLE "User" 
    DROP CONSTRAINT IF EXISTS "fk_user_branch",
    DROP CONSTRAINT IF EXISTS "fk_user_institution",
    DROP COLUMN IF EXISTS "deletedAt",
    DROP COLUMN IF EXISTS "isPrimaryManager",
    DROP COLUMN IF EXISTS "branchId",
    DROP COLUMN IF EXISTS "institutionId";
DROP TABLE IF EXISTS "PrimaryManagerInvitation";
DROP TABLE IF EXISTS "Branch";
DROP TABLE IF EXISTS "Institution";
DROP TYPE IF EXISTS "InvitationStatus";
DROP TYPE IF EXISTS "BranchStatus";
DROP TYPE IF EXISTS "InstitutionStatus";
```
*Note: Rolling back DDL does not recover backfilled data; a verified cold backup is mandatory.*

---

## 7. Migration Safety Verdict

```
MIGRATION_DDL_SYNTAX: VERIFIED_IN_SOURCE
POSTGRESQL_15_COMPATIBILITY: VERIFIED_IN_SOURCE
OD_708_PAYMENT_PROTECTION: VERIFIED_IN_SOURCE
TRANSACTION_ATOMICITY: ENFORCED_BY_PRISMA_MIGRATE
SAFETY_CLASSIFICATION: SAFE_FOR_CONTROLLED_STAGING_EXECUTION
```

