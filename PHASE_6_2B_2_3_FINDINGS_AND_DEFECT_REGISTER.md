# OX-DIGITAL Education — Phase 6.2B.2.3
# Findings, Defects & Architectural Constraints Register

**Date:** 2026-11-02  
**Project:** OX-DIGITAL Education  
**Authorized Workspace:** `D:\OX-DIGITAL\Mathe\OX-DIGITAL-GITHUB`  
**Git Baseline Verified:** `main @ 0500b93e65c24ed881349c4acea7f523332c5e9f` (`0500b93`)  
**Audit Execution Mode:** Strictly Read-Only  

---

## 1. Executive Summary

This register catalogs all confirmed defects, architectural constraints, and governance blockers identified during the Phase 6.2B.2.3 independent post-implementation audit.

* **Critical Implementation Defects:** **0** (Remediations A, B, C, D from Phase 6.2B.2.2 are 100% verified with zero regressions).
* **Medium-Severity Architectural Constraints:** **1** (Database schema structural limitations on `Exam` and `ExamAttempt`).
* **High-Severity Policy Blockers:** **2** (Unapproved proposed decisions **OD-11** Retake Policy and **OD-12** Evaluation Period).
* **Low-Severity Tooling Observations:** **1** (Vitest thread contention under Windows).

---

## 2. Comprehensive Findings Register

### Finding F-01: Prisma Schema Structural Limitations on `Exam` and `ExamAttempt`
* **Finding ID:** `F-01`
* **Title:** Missing Lifecycle and Scoring Columns in PostgreSQL `Exam` and `ExamAttempt` Models.
* **Severity:** **MEDIUM** (Architectural / Schema Constraint)
* **Affected Files & Lines:**
  - `packages/database/prisma/schema.prisma` (lines 122–154)
  - `services/course-service/src/controllers/exam.controller.ts` (lines 427–541)
* **Evidence:**
  1. `model Exam` lacks `totalPoints` or `maxScore` (it only contains `passingScore Float @default(50)` and `questions Json?`).
  2. `model ExamAttempt` lacks `status AttemptStatus`, `submittedAt DateTime?`, and `isGraded Boolean`.
  3. `exam.controller.ts startExam` initializes an attempt with `score: 0` and `answers: null`. Autosave (`syncAttempt`) writes `answers: answers || []`.
* **Impact:**
  - Raw `ExamAttempt` records from previous releases cannot prove completed submission at the database layer alone.
  - Legacy records lacking total points cannot be normalized into a percentage without question-level aggregation.
  - Mitigated in Phase 6.2B.2.2 at the application layer by tracking them as `unverifiableAttemptsCount` and disclosing them in the UI.
* **Recommended Remediation:**
  - In a future phase authorized for database migrations (e.g. Phase 6.2C), execute a Prisma migration adding:
    - `ExamAttempt.status` (`IN_PROGRESS`, `SUBMITTED`, `GRADED`, `ABANDONED`)
    - `ExamAttempt.submittedAt` (`DateTime?`)
    - `ExamAttempt.isGraded` (`Boolean @default(false)`)
    - `Exam.totalPoints` (`Float @default(100)`)
* **Blocks Next Phase:** **NO** (The application layer safely neutralizes these records without crashing or corrupting data; however, database schema alignment is required before persistent exam retake tracking can be deployed).

---

### Finding F-02: Unapproved Proposed Decision OD-11 (Assessment Retake Policy)
* **Finding ID:** `F-02`
* **Title:** Assessment Retakes Unconditionally Halt Academic Calculation.
* **Severity:** **HIGH** (Governance / Policy Blocker)
* **Affected Files & Lines:**
  - `services/analytics-service/src/services/academicAssessment.calculator.ts` (lines 289–324)
  - `apps/frontend/src/app/components/student-center/ResultsPage.tsx` (lines 160–167)
  - `apps/frontend/src/app/components/student-online/ResultsPage.tsx` (lines 160–167)
* **Evidence:**
  ```typescript
  if (hasRetakeConflict) {
    return {
      status: 'BLOCKED_PENDING_POLICY',
      average: null,
      retakeConflict: true,
      ...
    };
  }
  ```
* **Impact:**
  - If a student has more than one completed graded attempt for a given exam or assignment, their academic evaluation halts.
  - No average is computed, and the UI displays `"معلق (سياسة الإعادة)"`.
  - While this guarantees 100% compliance with non-approval rules, it prevents students with multiple attempts from seeing an academic evaluation.
* **Recommended Remediation:**
  - The Product Owner must formally approve an option for **OD-11**:
    - **Option A (Latest Attempt):** Use the most recent completed attempt (consistent with Phase 6.1B ranking rule).
    - **Option B (Highest Score):** Use the highest achieved score.
    - **Option C (Arithmetic Average):** Compute the average across all attempts of that assessment.
    - **Option D (First Attempt Only):** Use only the original attempt.
* **Blocks Next Phase:** **YES** (Blocks release of retake handling; must be resolved before proceeding to general student evaluation).

---

### Finding F-03: Unapproved Proposed Decision OD-12 (Academic Evaluation Period)
* **Finding ID:** `F-03`
* **Title:** Academic Evaluation Period Permanently Enforced as Unspecified.
* **Severity:** **MEDIUM** (Governance Limitation)
* **Affected Files & Lines:**
  - `services/analytics-service/src/services/academicAssessment.calculator.ts` (lines 74–75, 418–419)
  - `apps/frontend/src/app/components/student-center/ResultsPage.tsx` (lines 142–155)
  - `apps/frontend/src/app/components/student-online/ResultsPage.tsx` (lines 142–155)
* **Evidence:**
  ```typescript
  const periodStatus: PeriodStatus = 'UNSPECIFIED';
  const assessmentPeriod = null;
  ```
* **Impact:**
  - Client applications cannot request term-filtered academic assessments (e.g. "Term 1 Average" or "Term 2 Average").
  - All valid assessments are evaluated cumulatively, and the UI always displays `"متاح (فترة غير محددة)"`.
* **Recommended Remediation:**
  - The Product Owner must formally approve an option for **OD-12**:
    - **Option A (Cumulative All-Time):** Permanent all-time assessment across student tenure.
    - **Option B (Official Academic Term):** Term boundaries defined in the database by academic administrators.
    - **Option C (Rolling Time Window):** Fixed rolling window (e.g. past 30, 60, or 90 days).
* **Blocks Next Phase:** **NO** (Cumulative unspecified period is stable and honest; term filtering can be introduced in a future update).

---

### Finding F-04: Vitest Worker Thread Concurrency Under Windows Subsystem
* **Finding ID:** `F-04`
* **Title:** Occasional Concurrency Contention in DOM-Heavy Tests Under Multi-Threaded Execution.
* **Severity:** **LOW** (Development & CI Tooling)
* **Affected Files & Lines:**
  - `apps/frontend/vite.config.ts`
  - `apps/frontend/package.json`
* **Evidence:**
  - Running all 23 test suites concurrently on Windows under high CPU load occasionally causes async timeout warnings in `ParentDashboard.test.tsx`.
  - Running with `--fileParallelism=false` eliminates all contention and produces 100% deterministic passes across all 212 tests.
* **Impact:**
  - Zero impact on production runtime or bundled code.
  - Minor inconvenience during parallel test runs in local terminal sessions.
* **Recommended Remediation:**
  - Configure `vite.config.ts` or `npm test` script with `pool: 'threads'` and bounded concurrency for Windows CI runners.
* **Blocks Next Phase:** **NO**.

---

## 3. Defect Blocking Summary

| Finding | Severity | Blocks Production Deploy? | Blocks Phase 6.2C (Schema)? | Blocks Phase 6.3 (Risk)? |
|---|---|---|---|---|
| **F-01 (Prisma Schema)** | Medium | **NO** (Runtime mitigated) | **YES** (Direct subject of 6.2C) | **CONDITIONAL** |
| **F-02 (OD-11 Retakes)** | High | **NO** (Safely halts) | **NO** | **YES** (Policy required) |
| **F-03 (OD-12 Period)** | Medium | **NO** (Displays unspecified) | **NO** | **NO** |
| **F-04 (Vitest Tooling)**| Low | **NO** | **NO** | **NO** |

