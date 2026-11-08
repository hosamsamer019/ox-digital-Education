# OX-DIGITAL Education — Phase 6.2C.1
# Historical Data Compatibility & Backfill Risk Assessment
## Legacy Record Preservation, Evidence Integrity & Non-Invention Directives

**Date:** 2026-11-02  
**Project:** OX-DIGITAL Education  
**Authorized Workspace:** `D:\OX-DIGITAL\Mathe\OX-DIGITAL-GITHUB`  
**Git Baseline Verified:** `main @ 0500b93e65c24ed881349c4acea7f523332c5e9f` (`0500b93`)  
**Audit Execution Mode:** Strictly Read-Only  

---

## 1. Executive Summary

This assessment defines the precise data integrity principles governing historical student assessment records in the OX-DIGITAL PostgreSQL database.

Under strict Product Owner directives, **no database migration may synthesize historical evidence or fabricate academic completion**. This document categorizes existing legacy rows into verifiable vs. unverifiable records and establishes explicit non-invention rules.

---

## 2. Inventory of Historical Database Patterns

Static inspection of `packages/database/prisma/schema.prisma`, `exam.controller.ts`, and `migrateAssessments.ts` identifies five distinct categories of legacy records residing in PostgreSQL:

### Category 1: Abandoned Exam Sessions
* **Database Signature:** `ExamAttempt` row with `score = 0` and `answers IS NULL`.
* **Origin:** Created by `exam.controller.ts startAttempt` when a student clicked "Start Exam" but never answered questions or submitted.
* **Integrity Status:** **UNSUBMITTED / ABANDONED**.
* **Backfill Rule:**
  - `status` $\rightarrow$ `ABANDONED`.
  - `submittedAt` $\rightarrow$ `NULL` (MUST NOT be backfilled with `createdAt`).
  - `isGraded` $\rightarrow$ `false`.
  - `percentage` $\rightarrow$ `NULL`.
  - **Academic Impact:** Excluded from student academic averages. Eliminates false zero scores.

### Category 2: Legitimate Submitted Exam Attempts
* **Database Signature:** `ExamAttempt` row with `score > 0` and `answers IS NOT NULL` (JSON array of student answers).
* **Origin:** Created by `exam.controller.ts submitAttempt`.
* **Integrity Status:** **SUBMITTED & GRADED**.
* **Backfill Rule:**
  - `status` $\rightarrow$ `GRADED`.
  - `isGraded` $\rightarrow$ `true`.
  - `percentage` $\rightarrow$ `score` (because `exam.controller.ts` stored percentage as score).
  - `submittedAt` $\rightarrow$ If available in application logs or `updatedAt`, use real timestamp; otherwise set to `createdAt` only with an explicit `isBackfilledTimestamp: true` metadata flag, or leave `submittedAt: NULL` while recording `status: 'GRADED'`.

### Category 3: Zero-Score Ambiguity (Actual 0% vs Cheating Disqualification)
* **Database Signature:** `ExamAttempt` row with `score = 0` and `answers IS NOT NULL` (non-empty array).
* **Origin:** Either a student answered questions and got 0% correct, OR a student was caught cheating via `reportViolation` (which overwrote `score = 0`).
* **Integrity Status:** **AMBIGUOUS (POTENTIAL CHEATING OR ZERO SCORE)**.
* **Backfill Rule:**
  - Cross-reference `ExamViolation` table for `examAttemptId` or `(studentId, examId)`:
    - If associated `ExamViolation` records exist $\ge 2$: `status` $\rightarrow$ `CHEATING`.
    - If zero violations exist: `status` $\rightarrow$ `GRADED`, `percentage` $\rightarrow$ `0.0`.

### Category 4: Multiple Attempts for Same Assessment (Retakes)
* **Database Signature:** Multiple `ExamAttempt` rows with identical `(studentId, examId)`.
* **Origin:** Allowed by legacy `ExamAttempt` table due to lack of unique constraint.
* **Integrity Status:** **UNRESOLVED UNDER OD-11**.
* **Backfill Rule:**
  - **DO NOT PURGE OR OVERWRITE.** All rows must be preserved.
  - While OD-11 remains unapproved, the database migration must **NOT** add a `@@unique([studentId, examId])` constraint to `ExamAttempt`, as this would cause immediate migration failure or catastrophic data loss of student attempts.

### Category 5: Historically Migrated AssessmentAttempts
* **Database Signature:** `AssessmentAttempt` row created by legacy `migrateAssessments.ts` where `startedAt == submittedAt == createdAt` and `totalPoints IS NULL`.
* **Integrity Status:** **PARTIALLY VERIFIABLE**.
* **Backfill Rule:**
  - Retain `status: 'GRADED'` only if answers array is non-empty.
  - Dynamically recalculate `totalPoints` from questions rather than defaulting to 100.

---

## 3. Mandatory Non-Invention Directives

The following constraints are binding on any future migration script:

1. **Never Invent `submittedAt` for Abandoned Attempts:**
   Setting `submittedAt = createdAt` on rows where `answers IS NULL` falsely creates the appearance of an instant submission of 0 marks. This was the exact flaw of `migrateAssessments.ts`.
2. **Never Fabricate `totalPoints = 100`:**
   If an exam has 10 questions worth 2 points each (total 20 points), blindly inserting `totalPoints = 100` corrupts grading normalization. If `totalPoints` cannot be computed from question metadata, it must remain `NULL` and be disclosed as unverifiable.
3. **Never Discard Conflicting Retakes:**
   No migration may execute `DELETE FROM "ExamAttempt"` or `DISTINCT ON` to arbitrarily pick the "latest" attempt before the Product Owner formally approves OD-11.

---

## 4. Historical Record Classification Matrix

| Legacy Record Profile | Safely Backfillable? | Proposed Status | Proposed SubmittedAt | Reconstructible Max Marks? | Treatment in Academic Assessment |
|---|---|---|---|---|---|
| `score: 0, answers: null` | **YES** | `ABANDONED` | `NULL` | N/A | Excluded cleanly (No penalty). |
| `score: 0, answers: []` | **YES** | `ABANDONED` | `NULL` | N/A | Excluded cleanly. |
| `score: 85, answers: [...]` | **YES** | `GRADED` | Preserved / `NULL` | Reconstructed from questions | Included in OD-01 arithmetic mean. |
| `score: 0, answers: [...], violations > 1` | **YES** | `CHEATING` | Preserved | Reconstructed from questions | Excluded (Cheating lockout). |
| `score: 75, missing exam relation` | **NO** | `UNVERIFIABLE` | `NULL` | Cannot reconstruct | Tracked in `unverifiableAttemptsCount`. |
| Multiple attempts for single exam | **PRESERVED** | `GRADED` | Respective dates | Respective questions | Halts with `BLOCKED_PENDING_POLICY`. |

