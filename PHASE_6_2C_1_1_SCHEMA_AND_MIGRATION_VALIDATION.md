# OX-DIGITAL Education — Phase 6.2C.1.1
# Schema & Migration Technical Validation
## Field Invariants, Engine Locking Characteristics & Rollback Boundaries

**Date:** 2026-11-02  
**Project:** OX-DIGITAL Education  
**Authorized Workspace:** `D:\OX-DIGITAL\Mathe\OX-DIGITAL-GITHUB`  
**Git Baseline Verified:** `main @ 0500b93e65c24ed881349c4acea7f523332c5e9f` (`0500b93`)  
**Audit Execution Mode:** Strictly Read-Only Technical Architecture Validation  

---

## 1. Executive Summary

This specification validates the proposed database fields for `Exam` and `ExamAttempt`, details PostgreSQL 15 catalog behavior, establishes lifecycle state invariants, and documents the physical limits of database rollbacks.

---

## 2. Validation of Proposed Fields

### 2.1 Model `Exam`
* **Proposed Field:** `totalPoints Float @default(100)`
* **Semantic Assessment:**
  - In `exam.controller.ts`, questions historically lacked required point values; each question contributed $1.0\times$ towards a percentage.
  - A default of `100` is semantically acceptable for legacy exams because legacy `submitAttempt` explicitly computed a normalized 100-point percentage.
  - However, for exams where questions explicitly define `points: X`, `Exam.totalPoints` should dynamically equal $\sum \text{points}$.
  - **Verdict:** **APPROVED WITH CAVEAT.** Persist `totalPoints Float @default(100)`, with `exam.controller.ts` dynamically summing question points upon exam creation/update.

### 2.2 Model `ExamAttempt`
* **`status AttemptStatus @default(STARTED)`**
  - Uses existing Prisma enum: `STARTED`, `IN_PROGRESS`, `SUBMITTED`, `TIME_EXPIRED`, `GRADED`, `CHEATING`.
  - **Verdict:** **REQUIRED.** Eliminates zero-score ambiguity. Defaulting new rows to `STARTED` ensures unsubmitted attempts are never mistaken for completed failures.
* **`submittedAt DateTime?`**
  - Nullable timestamp.
  - **Verdict:** **REQUIRED.** Set exclusively upon final submission (`submitAttempt`). Must remain `NULL` for abandoned attempts.
* **`isGraded Boolean @default(false)`**
  - Evaluated: Does `isGraded` duplicate `status = 'GRADED'`?
  - Analysis: In multi-role education platforms, an attempt can be `status: 'SUBMITTED'` while awaiting manual teacher review, or `status: 'TIME_EXPIRED'` with partial auto-grading. `isGraded` acts as a direct boolean index for performance aggregation queries.
  - **Verdict:** **APPROVED.** Provides fast index filtering for analytics services.
* **`totalPoints Float?` & `percentage Float?`**
  - Explicit normalized scoring fields matching `AssessmentAttempt`.
  - **Verdict:** **REQUIRED.** Decouples raw points earned from normalized percentage, ending the legacy conflation.

---

## 3. Strict Lifecycle State Invariants

Any migration and controller update must enforce these state invariants:

```
[State Invariant Rules]
1. If status = 'STARTED':
   └── submittedAt MUST BE NULL.
   └── isGraded MUST BE false.
   └── percentage MUST BE NULL.

2. If status = 'GRADED':
   └── isGraded MUST BE true.
   └── percentage MUST BE NOT NULL (0.0 to 100.0).

3. If status = 'CHEATING':
   └── isGraded MUST BE false.
   └── Must never satisfy minimum evidence threshold (OD-02).

4. If status = 'TIME_EXPIRED':
   └── submittedAt MUST BE NOT NULL (records expiry timestamp).
```

---

## 4. PostgreSQL 15 Engine & Locking Analysis

Inspection of `docker-compose.yml` confirms the database engine is **`postgres:15-alpine`**.

* **Catalog-Only Column Additions:** In PostgreSQL 11 and above, running:
  ```sql
  ALTER TABLE "Exam" ADD COLUMN "totalPoints" DOUBLE PRECISION DEFAULT 100;
  ALTER TABLE "ExamAttempt" ADD COLUMN "status" "AttemptStatus" DEFAULT 'STARTED';
  ```
  does **NOT** rewrite the table. It stores the default value in the `pg_attribute` system catalog. The physical rows on disk are not altered until modified by subsequent DML.
* **Lock Level:** Requires `ACCESS EXCLUSIVE` lock solely for catalog metadata modification.
* **Lock Duration:** $< 50\text{ ms}$ under normal load.
* **Zero Downtime Capability:** The DDL migration can be applied without service interruption.

---

## 5. Honest Rollback Limits: Why Rollback is Destructive

A critical architectural distinction must be documented:

> **A database rollback is NOT non-destructive to newly written data.**

1. If Phase 6.2C.2 applies the migration adding `status` and `submittedAt`, and the system runs in production for 2 hours, students will submit exams that populate these new fields.
2. If an engineering team executes a "Down Migration" (`ALTER TABLE "ExamAttempt" DROP COLUMN "status", DROP COLUMN "submittedAt"`):
   - **All submission timestamps and lifecycle states written during those 2 hours will be permanently destroyed.**
   - While pre-migration data returns to its original structure, post-migration submissions are degraded back to legacy unverified rows.
3. **Recommendation:** Roll forward. If an issue arises with application queries, patch the application code rather than dropping database columns.

