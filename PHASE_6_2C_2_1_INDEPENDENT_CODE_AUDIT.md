# Phase 6.2C.2.1 — Independent Code Audit Report
## Academic Eligibility, Lifecycle Workflows & Mathematical Calculation Audit

**Project:** OX-DIGITAL Education  
**Workspace:** `D:\OX-DIGITAL\Mathe\OX-DIGITAL-GITHUB`  
**Git Baseline:** `main @ 0500b93e65c24ed881349c4acea7f523332c5e9f`  
**Execution Mode:** STRICTLY READ-ONLY AUDIT  
**Date:** November 2, 2026  

---

## 1. Executive Summary

This independent read-only audit inspects the source-code changes implemented in Phase 6.2C.2 across `services/course-service`, `services/analytics-service`, `services/user-service`, and `apps/frontend`. 

The audit confirms that the core architectural mandates—**OD-01 (Simple Arithmetic Mean)**, **OD-02 (Minimum 3 Graded Assessments)**, and **OD-11 (Latest Attempt Selection)**—are mathematically implemented in the pure calculator. However, several critical operational and query-level vulnerabilities were uncovered in the database consumer queries and lifecycle controller paths that require explicit remediation before production migration.

---

## 2. Findings Register: Source Code & Query Logic

### Finding 1: Query Filter Inconsistency & Pre-Backfill Data Vacuum
- **Severity:** **HIGH**
- **File & Line References:**
  - `services/analytics-service/src/controllers/analytics.controller.ts`: Lines 27–36, 47–56, 591
  - `services/user-service/src/controllers/user.controller.ts`: Lines 178–184
- **Current Implementation:**
  ```ts
  where: {
    OR: [
      { status: 'GRADED' },
      { isGraded: true }
    ]
  }
  ```
- **Forensic Trace & Actual Behavior:**
  1. **Disjunctive `OR` Flaw:** Using `OR` allows any record with `isGraded: true` to be admitted even if `status` is `'TIME_EXPIRED'`, `'SUBMITTED'`, or corrupted with `'CHEATING'`. Conversely, any record with `status: 'GRADED'` is admitted even if `isGraded: false`.
  2. **The Pre-Backfill Vacuum (Critical Operational Hazard):**
     In `schema.prisma` and `migration.sql`, the new columns are defined with:
     `status AttemptStatus NOT NULL DEFAULT 'STARTED'`
     `isGraded BOOLEAN NOT NULL DEFAULT false`
     When the DDL migration is executed on the live database, PostgreSQL automatically populates all existing historical rows with `status = 'STARTED'` and `isGraded = false`.
     Consequently, **every single historical exam attempt will fail both branches of the `OR` filter**.
     Until the historical backfill script finishes executing:
     - Platform average exam score will drop to 0.
     - Platform exam pass rate will drop to 0%.
     - At-risk student queue will drop to 0.
     - Student profile GPAs in `user-service` will immediately lose all historical exam score contributions.
- **Expected Behavior:**
  - Query eligibility should strictly require `status: 'GRADED'` AND `isGraded: true`.
  - For deployment safety, the system must either:
    a) Execute migration DDL and historical backfill atomically within a single maintenance window, OR
    b) Support an explicit transitional query condition during the un-backfilled window (e.g. checking `answers: { not: Prisma.JsonNull }`).
- **Migration Blocker:** **YES (Deployment Sequencing Blocker)**.

---

### Finding 2: `syncAttempt` Autosave Mutability on Expired Attempts
- **Severity:** **MEDIUM**
- **File & Line Reference:**
  - `services/course-service/src/controllers/exam.controller.ts`: Lines 580–593
- **Current Implementation:**
  ```ts
  if (existingAttempt) {
    if (existingAttempt.status !== 'GRADED' && existingAttempt.status !== 'CHEATING') {
      const updateData: any = { answers: answers || [] };
      if (existingAttempt.status === 'STARTED') {
        updateData.status = 'IN_PROGRESS';
      }
      await db.examAttempt.update({
        where: { id: existingAttempt.id },
        data: updateData
      });
    }
  }
  ```
- **Forensic Trace & Actual Behavior:**
  - The guard excludes only `'GRADED'` and `'CHEATING'`.
  - If an attempt was previously marked as `'TIME_EXPIRED'` (either due to background timeout or expired submission attempt), a late client autosave request arriving across network latency will pass the check (`existingAttempt.status !== 'GRADED'`) and update the `answers` array on a closed attempt.
- **Expected Behavior:**
  - `syncAttempt` must reject updates if the attempt is in any terminal or non-editable status:
    `if (!['STARTED', 'IN_PROGRESS'].includes(existingAttempt.status)) return res.json({ success: true, closed: true });`
- **Migration Blocker:** No (Source code logic fix, does not block DDL).

---

### Finding 3: Lack of Concurrency Protection in `submitAttempt`
- **Severity:** **MEDIUM**
- **File & Line Reference:**
  - `services/course-service/src/controllers/exam.controller.ts`: Lines 484–545
- **Current Implementation:**
  - The controller queries `db.examAttempt.findFirst` to find the existing attempt, checks idempotency in memory, and then executes `db.examAttempt.update` or `db.examAttempt.create`.
- **Forensic Trace & Actual Behavior:**
  - There is no database transaction (`db.$transaction`), row-level locking (`SELECT ... FOR UPDATE`), or database-level unique constraint on `(studentId, examId, status)`.
  - If a student triggers two submission requests simultaneously (e.g. double-clicking submit under high latency), both requests can read `existingAttempt.status === 'STARTED'` concurrently before either write completes, potentially resulting in race conditions or duplicate notification triggers.
- **Expected Behavior:**
  - Wrap the submission workflow in a Prisma interactive transaction with optimistic concurrency check or idempotency token.
- **Migration Blocker:** No (Source code logic fix).

---

### Finding 4: OD-11 Latest Attempt Implementation Audit (Mathematical Proof)
- **Severity:** **INFORMATIONAL / VERIFIED COMPLIANT**
- **File & Line Reference:**
  - `services/analytics-service/src/services/academicAssessment.calculator.ts`: Lines 397–417
- **Verification Evidence (Synthetic Test Execution):**
  A live Node ESM synthetic fixture execution was performed against the calculator to verify Scenarios A through G:
  1. **Scenario A (Different timestamps):** `2026-10-15` selected over `2026-10-01`. **PASSED**.
  2. **Scenario B (Identical timestamps):** Tie-broken deterministically using `b.id.localeCompare(a.id)`. **PASSED**.
  3. **Scenario C (Later STARTED attempt):** Earlier graded attempt (85%) preserved; later started attempt ignored. **PASSED**.
  4. **Scenario D (Later CHEATING attempt):** Earlier valid grade (88%) preserved; later cheating disqualification ignored in retake selection. **PASSED**.
  5. **Scenario E (Later UNVERIFIABLE attempt):** Earlier valid grade (82%) preserved; unverifiable attempt counted in disclosure notice. **PASSED**.
  6. **Scenario F (Legitimate Zero Score as Latest Attempt):** Latest legitimate 0% graded score selected and factored into arithmetic mean. **PASSED**.
  7. **Scenario G (Missing `submittedAt`):** Correctly falls back to `createdAt` timestamp descending. **PASSED**.
- **Conclusion:** OD-11 logic in the calculator is robust, deterministic, and strictly honors all requirements.

---

### Finding 5: OD-12 Rolling Window Implementation Audit
- **Severity:** **INFORMATIONAL / VERIFIED COMPLIANT**
- **File & Line Reference:**
  - `services/analytics-service/src/services/academicAssessment.calculator.ts`: Lines 70–88
  - `apps/frontend/src/app/components/student-center/ResultsPage.tsx`: Lines 221–245
  - `apps/frontend/src/app/components/student-online/ResultsPage.tsx`: Lines 221–245
- **Verification Evidence:**
  1. **No Hidden Default Duration:** The calculator does NOT default to 30, 60, or 90 days. If `options?.rollingDays` is absent, `hasRollingConfig` is false, and `periodStatus` defaults to `'UNSPECIFIED'` with `assessmentPeriod = null`.
  2. **Configuration Enforcement:** If `requireRollingPeriod: true` or `rollingDays: null` is passed, the function returns `status: 'PERIOD_CONFIGURATION_REQUIRED'` and `periodStatus: 'CONFIGURATION_REQUIRED'`.
  3. **UI Parity:** Both `ResultsPage.tsx` files display `معلق (إعداد الفترة)` when status is `PERIOD_CONFIGURATION_REQUIRED`, and display `متاح (نافذة متجددة: X يوم)` only when `periodStatus === 'SPECIFIED'`. Lifetime data is displayed as `متاح (فترة غير محددة)`.
- **Conclusion:** OD-12 architecture is implemented cleanly without preempting the Product Owner's duration decision.

