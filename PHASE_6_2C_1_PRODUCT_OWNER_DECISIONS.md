# OX-DIGITAL Education — Phase 6.2C.1
# Product Owner Architecture & Policy Decisions Register

**Date:** 2026-11-02  
**Project:** OX-DIGITAL Education  
**Authorized Workspace:** `D:\OX-DIGITAL\Mathe\OX-DIGITAL-GITHUB`  
**Git Baseline Verified:** `main @ 0500b93e65c24ed881349c4acea7f523332c5e9f` (`0500b93`)  
**Document Status:** UPDATED WITH APPROVED OD-01, OD-02, OD-11, OD-12 & OD-12.1 DECISIONS  

---

## 1. Executive Summary

This register presents the exact architectural and policy decisions required from the Product Owner before executing database migrations or expanding the student risk assessment engine.

In strict compliance with governance rules, **the engineering team has made no assumptions, selected no options on behalf of leadership, and executed zero database mutations**.

---

## 2. Canonical Decisions Register Status

| Decision ID | Canonical Topic | Current Status | Implemented in Platform |
|---|---|---|---|
| **OD-01** | Academic Assessment Calculation (Simple Arithmetic Mean) | **APPROVED** | YES (Phase 6.2B.2.2) |
| **OD-02** | Minimum Academic Evidence Requirement ($\ge 3$ assessments) | **APPROVED** | YES (Phase 6.2B.2.2) |
| **OD-03** | Attendance Lateness Treatment | **UNRESOLVED (PROPOSED)** | NO |
| **OD-04** | Late Homework Treatment | **UNRESOLVED (PROPOSED)** | NO |
| **OD-05** | Video Engagement Grace Period | **UNRESOLVED (PROPOSED)** | NO |
| **OD-06** | Historical Lesson Publication Timestamp Backfill | **UNRESOLVED (PROPOSED)** | NO |
| **OD-07** | Parent Notification Cooldown Window | **UNRESOLVED (PROPOSED)** | NO |
| **OD-08** | Online-Only Student Activity Assessment Method | **UNRESOLVED (PROPOSED)** | NO |
| **OD-09** | External Parent Notification Delivery Channels | **UNRESOLVED (PROPOSED)** | NO |
| **OD-10** | Seven-Day Assessment Trend Comparison Threshold | **UNRESOLVED (PROPOSED)** | NO |
| **OD-11** | Assessment Retake Policy | **APPROVED (Option A — Latest Attempt)** | YES (Phase 6.2C.2) |
| **OD-12** | Academic Assessment Evaluation Period | **APPROVED (Option C — Rolling Time Window)** | YES (Phase 6.2C.2) |
| **OD-12.1** | Rolling Time Window Duration | **APPROVED (Option A — 30 Calendar Days)** | YES (Phase 6.2C.2.2) |

---

## 3. Policy-Independent vs Policy-Dependent Schema Decisions

To accelerate engineering progress safely, decisions are categorized by whether they require prior policy approval or can proceed immediately:

### 3.1 Policy-Independent Schema Decisions (Can Proceed in Phase 6.2C.2)
The following database improvements can be executed **without** resolving OD-11 or OD-12:
1. **Adding `Exam.totalPoints` (Float):** Does not depend on policy; simply records the exam maximum score.
2. **Adding `ExamAttempt.status` (`AttemptStatus` enum):** Distinguishes started from submitted exams.
3. **Adding `ExamAttempt.submittedAt` (DateTime):** Records submission timestamp.
4. **Adding `ExamAttempt.isGraded` (Boolean):** Flags completed evaluation.
5. **Backfilling Abandoned Sessions (`score: 0, answers: null` $\rightarrow$ `status: 'STARTED'`):** Immediately cures false GPA penalties in `user-service`.

### 3.2 Policy-Dependent Schema Decisions (Blocked until Policy Decision)
1. **Database Unique Constraint on `ExamAttempt([studentId, examId])`:**
   - **BLOCKED BY OD-11.** If OD-11 selects an option that permits multiple attempts (e.g. attempt averaging or keeping all attempts), adding a unique constraint in PostgreSQL would cause catastrophic data loss and migration failure.
2. **Academic Term Partitioning Tables:**
   - **BLOCKED BY OD-12.** If OD-12 selects Option B (Official Academic Term), a dedicated `AcademicTerm` entity must be designed.

---

## 4. Formal Decision Gates for Product Owner

### Decision Gate 1: Strategic Architecture Path
* **Choice 1 (Option A — Schema Alignment on Legacy Tables):** Add missing columns to `ExamAttempt` and `Exam`. Keeps existing table structure.
* **Choice 2 (Option B — Full Consolidation into Unified Assessment):** Route all exam queries to `Assessment` and `AssessmentAttempt`. Deprecate legacy tables.
* **Choice 3 (Option C — Phased Hybrid Alignment):** Execute Option A immediately in Phase 6.2C to safeguard data, then consolidate in Phase 7.0.

### Decision Gate 2: OD-11 (Assessment Retake Policy)
* **APPROVED: Option A (Latest Attempt):** Use the score of the most recently submitted graded attempt per assessment. Implemented in Phase 6.2C.2 with deterministic tie-breaking (`submittedAt || createdAt DESC, id DESC`).

### Decision Gate 3: OD-12 (Academic Evaluation Period) & OD-12.1 (Window Duration)
* **APPROVED: OD-12 Option C (Rolling Time Window):** Evaluate assessments submitted within a dynamic rolling sliding window.
* **APPROVED: OD-12.1 Option A (30 Calendar Days):** The rolling window duration is explicitly set to 30 calendar days (`now - 30 days`). Implemented in `academicAssessment.calculator.ts` with `LAST_30_DAYS` evaluation scope.

---

## 5. Proposed Implementation Scope for Future Authorization (Phase 6.2C.2)

Upon formal Product Owner sign-off on the decisions above, Phase 6.2C.2 will execute under strict isolation:

```
Proposed Phase 6.2C.2 Scope:
├── 1. Execute pre-migration pg_dump and verified restore test in isolated container.
├── 2. Apply non-breaking DDL migration to Exam and ExamAttempt (Option A).
├── 3. Execute conditional data backfill script (zero invented evidence).
├── 4. Update exam.controller.ts to persist status, submittedAt, isGraded.
├── 5. Update user-service and analytics-service to filter status = 'GRADED'.
└── 6. Verify with full automated regression suite.
```

**STOP CONDITION:** No action will be taken until explicit authorization and selected options are delivered by the Product Owner.

