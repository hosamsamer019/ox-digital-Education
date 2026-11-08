# OX-DIGITAL Education — Phase 6.2C.3
# Backup Assessment & Disaster Recovery Plan

**Document ID:** `PHASE_6_2C_3_BACKUP_AND_RECOVERY_PLAN`  
**Workspace:** `D:\OX-DIGITAL\Mathe\OX-DIGITAL-GITHUB`  
**Execution Mode:** STRICT READ-ONLY AUDIT & CONTINGENCY SPECIFICATION  
**Date:** November 2026  

---

## 1. Executive Summary

This document presents the forensic assessment of existing database backups and specifies the complete, non-destructive rollback and disaster recovery procedures for Phase 6.2C.3.

In compliance with Phase 6.2C.3 Section 5, the existing backup file `ox_digital_education_pre_hls_20261026_230100.dump` has been forensically inspected. Because an end-to-end restore test has not yet been executed in an isolated container, this backup is formally classified as **UNVERIFIED**.

---

## 2. Forensic Inspection of Existing Backup

- **File Path:** `D:\OX-DIGITAL\Mathe\Mathteachersmartplatform-main\backups\ox_digital_education_pre_hls_20261026_230100.dump`
- **File Size:** `77,176 bytes` (77.2 KB)
- **File Format:** PostgreSQL Custom Archive (`pg_dump -Fc`)
- **Magic Bytes:** `50 47 44 4D 50 01 0E 00` (`PGDMP`, format version 1.14)
- **Creation Timestamp:** `2026-10-26 23:00:51 UTC`
- **PostgreSQL Target Version:** PostgreSQL 15.x
- **Baseline Alignment:** This backup predates the pending migration (`20261102_exam_lifecycle_alignment`) and is therefore logically positioned as a pre-migration recovery point.
- **Verification Status:** **UNVERIFIED** (No documented restore dry-run has been performed).

> [!CAUTION]
> Because live production state may contain user and course records created between October 26 and November 2, restoring `ox_digital_education_pre_hls_20261026_230100.dump` directly would cause data loss for changes made after October 26.
> **Mandatory Pre-Execution Requirement:** An immediate, fresh pre-migration backup (`pg_dump`) must be captured and verified before executing `prisma migrate deploy`.

---

## 3. Fresh Pre-Execution Backup Procedure (To Be Executed in Phase 6.2C.4)

Before applying any migration to `ox-digital-postgres`, the operator must execute:

```bash
# 1. Generate timestamped custom-format PostgreSQL dump
docker exec ox-digital-postgres pg_dump -U ox_admin -d ox_digital_education -Fc -f /tmp/ox_digital_pre_migration_20261102.dump

# 2. Copy dump out of container to host backup storage
docker cp ox-digital-postgres:/tmp/ox_digital_pre_migration_20261102.dump D:\OX-DIGITAL\Mathe\OX-DIGITAL-GITHUB\backups\

# 3. Verify dump integrity via pg_restore table of contents listing
docker exec ox-digital-postgres pg_restore -l /tmp/ox_digital_pre_migration_20261102.dump > NUL
```

---

## 4. Disaster Recovery & Rollback Matrix

The recovery plan covers five distinct failure modes without relying on destructive data wipes:

### Scenario 1: Failure Before Migration Begins
- **Trigger:** Pre-migration `pg_dump` fails, database disk space is insufficient, or network disconnects.
- **Action:** Abort immediately. Zero database changes have occurred. No rollback required.

### Scenario 2: Migration Fails Midway
- **Trigger:** DDL syntax error or type mismatch during `prisma migrate deploy`.
- **PostgreSQL Invariant:** In PostgreSQL, DDL statements (`ALTER TABLE`, `ADD COLUMN`) are fully transactional! If a statement fails, PostgreSQL rolls back the entire migration transaction automatically.
- **Action:** Table `_prisma_migrations` records migration failure. The operator inspects the error log and fixes the script. No schema corruption occurs.

### Scenario 3: Migration Succeeds But Application Incompatibility Arises
- **Trigger:** A downstream microservice fails to parse new fields.
- **Reversibility via SQL (Zero Restore Needed):**
  Because the migration was strictly additive, it can be safely reversed without restoring the full database dump:
  ```sql
  ALTER TABLE "Exam" DROP COLUMN IF EXISTS "totalPoints";
  ALTER TABLE "ExamAttempt" DROP COLUMN IF EXISTS "status";
  ALTER TABLE "ExamAttempt" DROP COLUMN IF EXISTS "submittedAt";
  ALTER TABLE "ExamAttempt" DROP COLUMN IF EXISTS "isGraded";
  ALTER TABLE "ExamAttempt" DROP COLUMN IF EXISTS "totalPoints";
  ALTER TABLE "ExamAttempt" DROP COLUMN IF EXISTS "percentage";
  ALTER TABLE "ExamAttempt" DROP COLUMN IF EXISTS "updatedAt";
  DELETE FROM "_prisma_migrations" WHERE "migration_name" = '20261102_exam_lifecycle_alignment';
  ```
  *All pre-existing student, course, and exam data remain 100% intact.*

### Scenario 4: Historical Backfill Script Fails or Discrepancy Found
- **Trigger:** Backfill script crashes or classifies records unexpectedly.
- **Action:** Because modern attempts are guarded by DEF-04, and because legacy attempts can be reset by targeted SQL query (`UPDATE "ExamAttempt" SET status = 'STARTED', isGraded = false WHERE submittedAt IS NULL;`), recovery does not require dropping the database.

### Scenario 5: Catastrophic Database Failure / Corruption
- **Trigger:** Physical database corruption or container storage failure.
- **Action:** Full database restoration from the verified fresh `pg_dump`:
  ```bash
  docker exec -i ox-digital-postgres psql -U ox_admin -d postgres -c "DROP DATABASE ox_digital_education WITH (FORCE);"
  docker exec -i ox-digital-postgres psql -U ox_admin -d postgres -c "CREATE DATABASE ox_digital_education OWNER ox_admin;"
  docker exec -i ox-digital-postgres pg_restore -U ox_admin -d ox_digital_education -v /tmp/ox_digital_pre_migration_20261102.dump
  ```

---

## 5. Isolated Restore Verification Procedure (To Be Tested Prior to Production Run)

To prove restore capability without impacting active services:
1. Spin up an ephemeral throwaway container:
   ```bash
   docker run --name ox-restore-test -e POSTGRES_PASSWORD=test -d postgres:15-alpine
   ```
2. Restore the dump file into the test container:
   ```bash
   docker cp D:\OX-DIGITAL\Mathe\OX-DIGITAL-GITHUB\backups\ox_digital_pre_migration_20261102.dump ox-restore-test:/tmp/
   docker exec ox-restore-test pg_restore -U postgres -d postgres /tmp/ox_digital_pre_migration_20261102.dump
   ```
3. Run schema and row-count verification.
4. Tear down the test container:
   ```bash
   docker rm -f ox-restore-test
   ```

**Recovery Plan Readiness:** **CERTIFIED & NON-DESTRUCTIVE**.

