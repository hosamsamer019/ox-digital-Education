# OX-DIGITAL Education — Phase 6.2B.2.2
# Remaining Blockers, Schema Limitations & Next Phase Prerequisites

**Date:** 2026-11-01  
**Project:** OX-DIGITAL Education  
**Authorized Workspace:** `D:\OX-DIGITAL\Mathe\OX-DIGITAL-GITHUB`  
**Git Baseline:** `main @ 0500b93e65c24ed881349c4acea7f523332c5e9f` (`0500b93`)  
**Status:** AUDITED — READY FOR PRODUCT OWNER POLICY REVIEW  

---

## 1. Executive Summary

Phase 6.2B.2.2 has successfully resolved the immediate source-code data integrity defects in the academic assessment engine without violating any governance constraints.

This document identifies the remaining technical blockers, schema constraints, and unresolved policy decisions that require Product Owner authorization before proceeding to subsequent implementation phases.

---

## 2. Technical and Schema Blockers

### 2.1 Prisma Schema Limitations: `Exam` & `ExamAttempt`
The current PostgreSQL database schema presents two structural gaps:
1. **Missing `Exam.totalPoints` Column:**
   - In the Prisma schema, the `Exam` model contains no `totalPoints` or `maxScore` field. Maximum marks must either be dynamically calculated by aggregating question points or supplied through explicit application metadata.
2. **Missing Lifecycle Columns on `ExamAttempt`:**
   - Unlike `AssessmentSubmission` (which includes `status`, `submittedAt`, `isGraded`, and `grade`), `ExamAttempt` only possesses:
     - `id`
     - `studentId`
     - `examId`
     - `score`
     - `answers` (JSON)
     - `createdAt`
     - `updatedAt`
   - It lacks `status` (`IN_PROGRESS`, `SUBMITTED`, `GRADED`, `ABANDONED`), `submittedAt`, and `isGraded`.
3. **Current Mitigation (Phase 6.2B.2.2):**
   - The application does not invent or assume values. In-progress sessions (`answers: null`) are excluded, and records lacking verifiable total marks or completion flags are tracked as `unverifiableAttemptsCount` and disclosed to students via an Arabic data integrity notice.
4. **Permanent Remediation Required:**
   - When database migrations are authorized in a future phase, a Prisma migration should add:
     - `ExamAttempt.status` (Enum: `IN_PROGRESS`, `SUBMITTED`, `GRADED`, `ABANDONED`, `CHEATING_FLAGGED`)
     - `ExamAttempt.submittedAt` (DateTime)
     - `ExamAttempt.isGraded` (Boolean)
     - `Exam.totalPoints` (Float)

---

## 3. Unresolved Academic Policy Decisions

### 3.1 OD-11: Assessment Retake Policy
* **Current Status:** PROPOSED — AWAITING PRODUCT OWNER APPROVAL.
* **Current Engine Behavior:**
  - If a student has more than one completed graded attempt for the same assessment identity, the engine returns `status: 'BLOCKED_PENDING_POLICY'`, `retakeConflict: true`, and `average: null`.
  - It does NOT arbitrarily choose latest, highest, or average.
* **Product Owner Decision Options:**
  - **Option A (Latest Attempt):** Use the most recent completed graded attempt. (Matches Phase 6.1B ranking rule).
  - **Option B (Highest Score):** Use the attempt with the highest percentage.
  - **Option C (Attempt Average):** Compute the arithmetic mean of all attempts for that assessment before calculating the student average.
  - **Option D (First Attempt Only):** Use only the initial attempt.

### 3.2 OD-12: Academic Evaluation Period Policy
* **Current Status:** PROPOSED — AWAITING PRODUCT OWNER APPROVAL.
* **Current Engine Behavior:**
  - Strictly enforces `periodStatus: 'UNSPECIFIED'` and `assessmentPeriod: null`.
  - Rejects synthetic establishment via query parameters (`?term=`, `startDate`, `endDate`).
  - Displays `"متاح (فترة غير محددة)"` in the user interface.
* **Product Owner Decision Options:**
  - **Option A (Cumulative All-Time):** Academic assessment evaluates all eligible assessments across the student's entire tenure.
  - **Option B (Official Academic Term):** Evaluation is strictly bound to teacher-configured semester/term boundaries defined in the database.
  - **Option C (Rolling Time Window):** Evaluation evaluates assessments completed within the last $N$ days (e.g. 30, 60, or 90 days).

---

## 4. Pending Risk Assessment Dimensions (OD-03 to OD-10)

The core architecture approved in Phase 6.2A establishes four independent monitoring dimensions. Only OD-01 and OD-02 of the Academic dimension have been implemented. The remaining dimensions remain completely unimplemented and await explicit authorization:

| Dimension | Decision Ref | Focus | Status |
|---|---|---|---|
| **Attendance** | OD-03, OD-04 | In-center attendance threshold and minimum evidence. | UNIMPLEMENTED |
| **Homework** | OD-05, OD-06 | Assignment completion rates and grading requirements. | UNIMPLEMENTED |
| **Engagement** | OD-07, OD-08 | Online video watch duration, activity timestamps, completion. | UNIMPLEMENTED |
| **Multi-Dimensional** | OD-09, OD-10 | Independent display, trend comparison (7-day delta), parent alert triggers. | UNIMPLEMENTED |

---

## 5. Next Phase Prerequisites and Roadmap

Before initiating Phase 6.3 or implementing further dimensions, the following sequential steps are recommended:

```
[Phase 6.2B.2.2 Complete]
          │
          ▼
[Product Owner Policy Sign-off]
    ├── Approve / Decide OD-11 (Retake Policy)
    └── Approve / Decide OD-12 (Evaluation Period)
          │
          ▼
[Phase 6.2C: Database Schema Alignment] (Authorized migration)
    ├── Add ExamAttempt status, submittedAt, isGraded
    └── Add Exam.totalPoints column
          │
          ▼
[Phase 6.3: Attendance & Homework Dimensions] (OD-03 to OD-06)
          │
          ▼
[Phase 6.4: Video Engagement & Multi-Dimensional Alerts] (OD-07 to OD-10)
```

