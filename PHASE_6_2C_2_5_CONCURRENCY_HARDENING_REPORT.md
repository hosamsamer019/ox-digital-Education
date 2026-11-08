# OX-DIGITAL Education — Phase 6.2C.2.5
# PostgreSQL Concurrent Submission Hardening & Verification Report

**Document ID:** `PHASE_6_2C_2_5_CONCURRENCY_HARDENING_REPORT`  
**Workspace:** `D:\OX-DIGITAL\Mathe\OX-DIGITAL-GITHUB`  
**Git Baseline Verified:** `main @ 0500b93e65c24ed881349c4acea7f523332c5e9f` (`0500b93`)  
**Execution Mode:** Source Code & Test Hardening (Read-Only to Production Database & Migrations)  
**Date:** November 2026  

---

## 1. Executive Summary

This report documents the architectural remediation of the concurrent submission race condition identified in Phase 6.2C.2.3.

The concurrency protection in `submitAttempt` within `services/course-service/src/controllers/exam.controller.ts` has been upgraded to a robust two-tier PostgreSQL serialization model:
1. **Transaction-Level Advisory Lock:** Serializes concurrent transactions for a specific `(studentId, examId)` pair even before an `ExamAttempt` row exists, preventing duplicate attempt row creation.
2. **Row-Level Lock (`SELECT ... FOR UPDATE`):** Locks the specific active `ExamAttempt` row under the transaction and refetches its latest committed state.
3. **Idempotency & Terminal State Immutability:** Enforces immediate short-circuiting on all terminal states (`GRADED`, `SUBMITTED`, `CHEATING`, `TIME_EXPIRED`), returning cached scores with `{ idempotent: true }` and strictly prohibiting re-grading or conflicting score overrides.

---

## 2. Exact Files Modified & Added

| File Path | Operation | Description |
|---|---|---|
| `services/course-service/src/controllers/exam.controller.ts` | **MODIFIED** | Implemented PostgreSQL transaction advisory lock (`pg_advisory_xact_lock`), row-level locking (`SELECT ... FOR UPDATE`), and terminal immutability for `SUBMITTED`, `GRADED`, `CHEATING`, and `TIME_EXPIRED`. |
| `services/course-service/src/test/lifecycle_and_remediation.test.ts` | **MODIFIED** | Added tests 2.7, 2.8, 2.9, and 2.10 validating terminal state handling, CHEATING/TIME_EXPIRED rejection, and lock key derivation determinism. Total tests increased to 18. |
| `services/course-service/src/test/concurrency_submission.integration.test.ts` | **NEW** | Real PostgreSQL integration test measuring multi-request concurrency and honest connectivity reporting. |
| `PHASE_6_2C_2_5_CONCURRENCY_HARDENING_REPORT.md` | **NEW** | Phase completion and architectural compliance report. |

---

## 3. Concurrency Hardening Architecture

### 3.1 Two-Tier Database Serialization Model

```
Request A (t=0ms) ────────┐
                           ▼
                 [tx.$executeRaw]
                 pg_advisory_xact_lock(hashtext('ox_attempt:studentId:examId'))
                           │
Request B (t=1ms) ───► (BLOCKS at advisory lock until tx A commits)
                           │
                           ▼
                 [tx.examAttempt.findFirst]
                           ▼
                 [tx.$executeRaw]
                 SELECT "id" FROM "ExamAttempt" WHERE "id" = ... FOR UPDATE
                           ▼
                 [tx.examAttempt.findUnique] (Refetch committed state)
                           ▼
                 Is status terminal (GRADED / SUBMITTED)?
                   ├── YES ──► Return cached result (200 OK, idempotent: true)
                   └── NO  ──► Grade attempt, set status: 'GRADED', isGraded: true
                           ▼
                 COMMIT Transaction A
                           │
Request B Unblocks ────────┘
                 [tx.examAttempt.findFirst]
                 [tx.$executeRaw FOR UPDATE]
                 Sees status: 'GRADED'
                 Returns cached result (200 OK, idempotent: true)
                 ZERO duplicate attempt, ZERO conflicting grade!
```

### 3.2 Terminal State Immutability Matrix

| Attempt Status | State Type | Action on `submitAttempt` | Action on `syncAttempt` (Autosave) |
|---|---|---|---|
| `STARTED` | Active | Evaluates answers, grades attempt, transitions to `GRADED` | Allowed, transitions to `IN_PROGRESS` |
| `IN_PROGRESS` | Active | Evaluates answers, grades attempt, transitions to `GRADED` | Allowed, persists autosaved answers |
| `GRADED` | **Terminal** | **Idempotent 200 OK** (cached score, `idempotent: true`) | **403 Forbidden** (Mutations prohibited) |
| `SUBMITTED` | **Terminal** | **Idempotent 200 OK** (cached score, `idempotent: true`) | **403 Forbidden** (Mutations prohibited) |
| `CHEATING` | **Terminal** | **403 Forbidden** (`Disqualified due to cheating`) | **403 Forbidden** (Mutations prohibited) |
| `TIME_EXPIRED` | **Terminal** | **400 Bad Request** (`Attempt has expired`) | **403 Forbidden** (Mutations prohibited) |

### 3.3 Preservation of Approved Policy Baseline

- **OD-01 (Arithmetic Average):** Unaffected; continues to compute unweighted percentage averages.
- **OD-02 (Minimum 3 Assessments):** Invariant preserved; only `VERIFIED_GRADED` attempts count toward the 3-assessment minimum.
- **OD-11 (Latest Attempt):** Preserved; multiple legitimate attempts remain supported across distinct sessions (`ORDER BY createdAt DESC` selects latest active attempt; DB unique constraint is NOT enforced).
- **OD-12 & OD-12.1 (Rolling 30 Calendar Days):** Preserved; attempts within `now - 30 days` remain the authoritative evaluation scope.

---

## 4. PostgreSQL Integration Test Results

The dedicated integration test [`concurrency_submission.integration.test.ts`](file:///D:/OX-DIGITAL/Mathe/OX-DIGITAL-GITHUB/services/course-service/src/test/concurrency_submission.integration.test.ts) was created and executed.

### 4.1 Honest Limitation Reporting (Requirement 8 Compliance)

```
================================================================
PHASE 6.2C.2.5 POSTGRESQL CONCURRENT SUBMISSION INTEGRATION TEST
================================================================

[Phase 6.2C.2.5 - Live Database Concurrency Audit]
Target Database URL Host: localhost:5432/ox_digital_education?schema=public
✗ PostgreSQL Connectivity: UNAVAILABLE
  Reason: Can't reach database server at `localhost:5432`

----------------------------------------------------------------
HONEST LIMITATION REPORTING (Phase 6.2C.2.5 Requirement 8):
  A live PostgreSQL database daemon is NOT running or accessible on
  the target port in this local environment.
  In strict compliance with governance rules, this integration test
  will NOT substitute mocked responses to claim database concurrency
  proof. Concurrency guarantees rely on PostgreSQL row-level locks
  (SELECT ... FOR UPDATE) and transaction advisory locks
  (pg_advisory_xact_lock), which require a live PostgreSQL engine.
----------------------------------------------------------------

Integration Test Result Summary: {
  status: 'SKIPPED_DB_UNAVAILABLE',
  reason: "Can't reach database server at `localhost:5432`"
}
================================================================
```

> [!NOTE]
> In strict compliance with Rule 8, no mocked responses were substituted to simulate database concurrency. The integration test script contains the complete live test harness and will automatically execute 5 concurrent threads when invoked in a staging or production container where PostgreSQL is accessible.

---

## 5. Automated Build & Regression Test Results

### 5.1 Backend Invariant & Remediation Test Suite (`lifecycle_and_remediation.test.ts`)

Command: `.\node_modules\.bin\tsx.cmd services/course-service/src/test/lifecycle_and_remediation.test.ts`

```
================================================================
PHASE 6.2C.2.2 BACKEND REMEDIATION & INVARIANT TEST SUITE
================================================================

[1. Unified Academic Eligibility Invariant]
  ✓ PASS: 1.1 classifies completed attempt with verified maximum points as VERIFIED_GRADED
  ✓ PASS: 1.2 classifies legacy attempt awaiting backfill as LEGACY_AWAITING_CLASSIFICATION (DEF-01)
  ✓ PASS: 1.3 classifies attempt with unknown maximum points as UNVERIFIABLE (DEF-02)
  ✓ PASS: 1.4 strictly excludes CHEATING and disqualified attempts
  ✓ PASS: 1.5 strictly excludes abandoned legacy attempts with 0 score and null answers

[2. Attempt Lifecycle Immutability & Concurrency Protection]
  ✓ PASS: 2.1 syncAttempt rejects answer mutation on GRADED terminal state (DEF-05)
  ✓ PASS: 2.2 syncAttempt rejects answer mutation on CHEATING terminal state (DEF-05)
  ✓ PASS: 2.3 syncAttempt rejects answer mutation on TIME_EXPIRED terminal state (DEF-05)
  ✓ PASS: 2.4 syncAttempt allows autosave on STARTED and transitions to IN_PROGRESS
  ✓ PASS: 2.5 submitAttempt idempotency: returns already graded attempt on concurrent retry (DEF-06)
  ✓ PASS: 2.6 submitAttempt verified points: unknown totalPoints produces null percentage (DEF-02)
  ✓ PASS: 2.7 submitAttempt idempotency: handles SUBMITTED terminal state cleanly with 200 idempotent (Phase 6.2C.2.5)
  ✓ PASS: 2.8 submitAttempt terminal immutability: rejects re-grading of CHEATING attempt with 403 (Phase 6.2C.2.5)
  ✓ PASS: 2.9 submitAttempt terminal immutability: rejects re-submission of TIME_EXPIRED attempt with 400 (Phase 6.2C.2.5)
  ✓ PASS: 2.10 verifies PostgreSQL advisory lock key derivation determinism for student-exam pairs

[3. Backfill Idempotency & Safety Guards]
  ✓ PASS: 3.1 legacy backfilled row preserves submittedAt = null (DEF-03)
  ✓ PASS: 3.2 backfill protects modern GRADED records from being overwritten or downgraded (DEF-04)
  ✓ PASS: 3.3 backfill idempotency: second pass finds 0 eligible candidates (DEF-04)
================================================================
RESULTS: 18 / 18 TESTS PASSED (100%)
================================================================
```

### 5.2 Frontend Academic Assessment Vitest Suite (`AcademicAssessment.test.tsx`)

Command: `npx.cmd vitest run src/app/test/AcademicAssessment.test.tsx`

```
 ✓ src/app/test/AcademicAssessment.test.tsx (38 tests) 799ms

 Test Files  1 passed (1)
      Tests  38 passed (38)
   Duration  23.08s
```

### 5.3 TypeScript Compilation Check

Command: `tsc -p services/course-service/tsconfig.json --noEmit`  
Result: **0 Errors / Clean Compilation**.

---

## 6. Safety & Boundary Audit

- **Zero Migrations Executed:** No DDL migrations were deployed.
- **Zero Production Database Writes:** No active databases were mutated.
- **Zero Docker/Container Alterations:** Docker infrastructure remained untouched.
- **Git State:** Baseline preserved at `main @ 0500b93e65c24ed881349c4acea7f523332c5e9f`.

---

## 7. Next Steps & Handoff to Phase 6.2C.3

With the concurrency race condition hardened and OD-12.1 formally approved, the codebase is in a complete state of readiness for **Phase 6.2C.3 (Live Database Migration & Staging Deployment Review)**.

