# Phase 6.2C.2.1 — Migration SQL & Historical Backfill Audit
## DDL Safety, Data Fabrication Hazards, and Script Idempotency Review

**Project:** OX-DIGITAL Education  
**Workspace:** `D:\OX-DIGITAL\Mathe\OX-DIGITAL-GITHUB`  
**Target Migration:** `packages/database/prisma/migrations/20261102_exam_lifecycle_alignment/migration.sql`  
**Target Script:** `services/course-service/src/scripts/backfillExamAttempts.ts`  
**Execution Mode:** STRICTLY READ-ONLY AUDIT (ZERO DDL APPLIED, ZERO BACKFILL EXECUTED)  
**Date:** November 2, 2026  

---

## 1. Executive Summary

This independent audit evaluated the schema alterations, generated SQL DDL, and historical backfill script. 

While the DDL statements are syntactically valid for PostgreSQL 15 and use idempotent clauses (`IF NOT EXISTS`), the audit identified **two high-severity data integrity risks**:
1. Defaulting `Exam.totalPoints` to `100` fabricates assumptions about historical exams whose true total marks were not 100.
2. The backfill script copies `createdAt` into `submittedAt`, fabricating an instantaneous $0$-second completion timestamp for legacy attempts. Furthermore, the backfill script lacks idempotency guards and could overwrite post-migration records if run multiple times.

---

## 2. Findings Register: Schema, DDL & Backfill Logic

### Finding 6: Semantic Total Points Fabrication (`Exam.totalPoints DEFAULT 100`)
- **Severity:** **HIGH**
- **File & Line Reference:**
  - `packages/database/prisma/schema.prisma`: Line 137
  - `packages/database/prisma/migrations/20261102_exam_lifecycle_alignment/migration.sql`: Line 5
- **Current Implementation:**
  ```sql
  ALTER TABLE "Exam" ADD COLUMN IF NOT EXISTS "totalPoints" DOUBLE PRECISION DEFAULT 100;
  ```
- **Forensic Trace & Actual Behavior:**
  - In PostgreSQL 11+, adding a column with a constant `DEFAULT 100` automatically assigns `100` to all pre-existing rows in the `Exam` table.
  - In legacy OX-DIGITAL courses, an exam may have had 5, 10, or 20 questions each worth 1 point. While `ExamAttempt.score` was computed as an unweighted percentage `(correctCount / totalQuestions) * 100`, the exam itself did NOT have 100 total points.
  - Adding `DEFAULT 100` in the database silently invents a 100-point maximum for every historical exam.
- **Expected Behavior:**
  - `totalPoints` on legacy `Exam` rows should either remain `NULL` (indicating legacy unrecorded maximum points) or be derived from the sum of question points / question count during backfill.
  - In Prisma, `Exam.totalPoints` is typed as nullable `Float?`, but the SQL DDL assigns a non-null default `DEFAULT 100`.
- **Migration Blocker:** **YES (Schema Design Reconsideration Required)**.

---

### Finding 7: Backfill Timestamp Fabrication (`submittedAt = createdAt`)
- **Severity:** **HIGH**
- **File & Line Reference:**
  - `services/course-service/src/scripts/backfillExamAttempts.ts`: Lines 91, 97, 104
- **Current Implementation:**
  ```ts
  submittedAt = new Date(att.createdAt);
  ```
- **Forensic Trace & Actual Behavior:**
  - In legacy `ExamAttempt`, only `createdAt` (the start timestamp of the attempt) was persisted. No submission timestamp was ever recorded.
  - By setting `submittedAt = new Date(att.createdAt)` during backfill, historical attempts are given a false completion timestamp identical to their start timestamp (implying instantaneous completion with 0 minutes elapsed).
  - This pollutes audit trails and makes forensic duration analysis impossible.
- **Expected Behavior:**
  - Historical attempts should keep `submittedAt = null`.
  - The application and calculator already contain a clean fallback:
    `const attemptDate = att.submittedAt ? new Date(att.submittedAt) : (att.createdAt ? new Date(att.createdAt) : new Date());`
  - Leaving `submittedAt = null` on legacy backfilled records truthfully indicates that submission was inferred rather than explicitly timestamped.
- **Migration Blocker:** **YES (Backfill Script Correction Required)**.

---

### Finding 8: Backfill Positive Score Assumption vs Null Answers Conflict
- **Severity:** **MEDIUM**
- **File & Line Reference:**
  - `services/course-service/src/scripts/backfillExamAttempts.ts`: Line 92
  - `services/analytics-service/src/services/academicAssessment.calculator.ts`: Line 189
- **Current Implementation in Backfill:**
  ```ts
  else if (att.score > 0) {
    category = 'GRADED_NORMAL';
    targetStatus = 'GRADED';
    isGraded = true;
    percentage = att.score;
    submittedAt = new Date(att.createdAt);
  }
  ```
- **Forensic Trace & Actual Behavior:**
  - The backfill script tests `att.score > 0` before checking `answers`.
  - If a corrupt historical record exists with `score: 50` but `answers: null`, the backfill script will classify it as `GRADED_NORMAL` and set `status: 'GRADED'`, `isGraded: true`.
  - However, the pure calculator in `academicAssessment.calculator.ts` (line 189) states:
    `if (att.answers === null) continue;`
    which permanently excludes it as abandoned!
  - This creates a discrepancy between backfilled database status and calculator evaluation.
- **Expected Behavior:**
  - The backfill script must verify `hasAnswers` before classifying an attempt as `GRADED_NORMAL`. An attempt with `score > 0` but `answers: null` must be classified as `UNVERIFIABLE` or `ABANDONED`.
- **Migration Blocker:** **YES (Backfill Classification Alignment Required)**.

---

### Finding 9: Backfill Idempotency & Overwrite Hazard
- **Severity:** **MEDIUM**
- **File & Line Reference:**
  - `services/course-service/src/scripts/backfillExamAttempts.ts`: Line 32, Lines 129–141
- **Current Implementation:**
  ```ts
  const attempts = await db.examAttempt.findMany({ ... });
  for (const att of attempts) {
    ...
    if (!isDryRun) {
      await db.examAttempt.update({ ... });
    }
  }
  ```
- **Forensic Trace & Actual Behavior:**
  - The backfill queries ALL attempts indiscriminately.
  - It does NOT check whether an attempt has already been migrated or legitimately updated by modern application code (`where: { status: 'STARTED', isGraded: false }`).
  - If the backfill script is re-run after the application is in production, it will re-classify modern attempts using historical heuristic rules, potentially overwriting legitimate `submittedAt` timestamps or modern student answers.
- **Expected Behavior:**
  - The backfill script query must scope specifically to un-backfilled legacy records:
    `where: { status: 'STARTED', isGraded: false, submittedAt: null }`
- **Migration Blocker:** **YES (Backfill Script Hardening Required)**.

---

## 3. Backfill Safety Safeguards (Commendable Aspects)

Despite the classification findings above, the backfill script contains strong operational safeguards:
1. **Default Dry-Run Mode:** `const isDryRun = !options.execute;` ensures accidental execution without `--execute` causes zero database writes.
2. **Zero Row Deletion:** The script never executes `delete` or `deleteMany`. Retakes and legacy records are strictly preserved.
3. **Structured Reporting:** Produces structured counts across all 9 forensic categories.

