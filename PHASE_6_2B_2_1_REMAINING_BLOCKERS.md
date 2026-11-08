# OX-DIGITAL Education
# Phase 6.2B.2.1 — Remaining Blockers & Defect Disclosure Report
## Confirmed Code Defects, Policy Dependencies & Recommended Next Phase

**Date:** November 1, 2026  
**Workspace:** `D:\OX-DIGITAL\Mathe\OX-DIGITAL-GITHUB`  
**Git Baseline:** `main @ 0500b93e65c24ed881349c4acea7f523332c5e9f` (`0500b93`)  
**Scope:** Transparent technical disclosure of confirmed code defects, runtime unverifiability, open policy questions, and schema prerequisites.

---

## 1. Confirmed Code Defects & Runtime Risks

### 1.1 Caller-Supplied Academic Period Spoofing (OD-12 Violation)
- **Defect Location:** `services/analytics-service/src/controllers/analytics.controller.ts` (lines 364, 707) and `academicAssessment.calculator.ts` (line 67).
- **Description:** `req.query.term` is accepted without validation against any database entity. If a client sends `GET /api/analytics/overview?term=AnyString`, `options.assessmentPeriod` is populated, setting `periodStatus: "SPECIFIED"`.
- **UI Impact:** In `apps/frontend/src/app/components/student-center/ResultsPage.tsx` (line 225) and `student-online/ResultsPage.tsx` (line 217), the UI renders an emerald badge `"متاح ومعتمد"` ("Available and Approved").
- **Policy Violation:** OD-12 is NOT approved. No arbitrary input may be represented as an officially approved academic period.
- **Remediation Needed (Phase 6.2B.3):** Force `periodStatus` to remain `"UNSPECIFIED"` until OD-12 and a formal `AcademicTerm` schema model are authorized and implemented.

---

### 1.2 Precedence Masking of Unverifiable Records
- **Defect Location:** `services/analytics-service/src/services/academicAssessment.calculator.ts` (line 253).
- **Code:**
  ```typescript
  if (hasUnverifiableCompletion && gradedAttemptsByAssessment.size === 0) {
    return { status: 'BLOCKED_UNVERIFIABLE_COMPLETION', ... };
  }
  ```
- **Description:** `BLOCKED_UNVERIFIABLE_COMPLETION` is only returned if `gradedAttemptsByAssessment.size === 0`. If a student has 2 valid assessments and 1 unverifiable legacy exam attempt, the condition `size === 0` is false. The calculator drops through to line 266 and returns `status: 'INSUFFICIENT_DATA'` ($2/3$).
- **Impact:** Misleads students and teachers into believing the student merely needs to complete 1 more test, masking the fact that a test was taken but cannot be verified due to database schema limitations.
- **Remediation Needed (Phase 6.2B.3):** When total attempts $\ge 3$ but verifiable attempts $< 3$ due to unverifiable records, emit an explicit sub-status or warning in the payload disclosure.

---

### 1.3 `ExamAttempt` Submission Indistinguishability
- **Defect Location:** `services/course-service/src/controllers/exam.controller.ts` (lines 427–541) and `schema.prisma` (lines 266–277).
- **Description:** `syncAttempt` updates `answers: answers || []` during an in-progress exam. If a student starts an exam, clears answers or answers nothing, and triggers autosave, `answers` in PostgreSQL is `[]`. If the student then closes the browser, the attempt persists with `score: 0` and `answers: []`.
- **Impact:** An empty answers array cannot distinguish an abandoned exam from a submitted exam with zero correct answers.
- **Remediation Needed (Future Schema Migration):** Add `submittedAt: DateTime?`, `status: AttemptStatus`, and `isGraded: Boolean` to the `ExamAttempt` model in Prisma.

---

## 2. Unresolved Policy Decisions

| Decision | Area | Current Code State | Product Owner Decision Required |
|---|---|---|---|
| **OD-11** | Assessment Retake Policy | Neutralized (`status: BLOCKED_PENDING_POLICY`) | Select: Option A (Latest), Option B (Highest), Option C (Average), or Option D (First attempt only). |
| **OD-12** | Academic Assessment Evaluation Period | Unresolved (`periodStatus: UNSPECIFIED`) | Select: Option A (Calendar AcademicTerm), Option B (Rolling 90-day window), or Option C (Course term). |
| **OD-03** | Attendance Lateness Treatment | Preserved (Untouched) | Await Operations Lead approval. |
| **OD-04** | Late Homework Submission Treatment | Preserved (Untouched) | Await Academic Director approval. |
| **OD-05** | Video Engagement Grace Period | Preserved (Untouched) | Await Product Owner approval. |
| **OD-06** | Historical Lesson Timestamp Backfill | Preserved (Untouched) | Await Lead Architect approval. |
| **OD-07** | Parent Notification Cooldown | Preserved (Untouched) | Await Product Owner approval. |
| **OD-08** | Online-Only Student Activity Assessment | Preserved (Untouched) | Await Product Owner approval. |
| **OD-09** | External Parent Notification Channels | Preserved (Untouched) | Await Product Owner & Operations approval. |
| **OD-10** | Seven-Day Trend Threshold | Preserved (Untouched) | Await Academic Director approval. |

---

## 3. Database Schema Limitations

1. **`ExamAttempt` Missing Columns:**
   - Lacks `status`, `isGraded`, `totalPoints`, `percentage`, and `submittedAt`.
   - Legacy exams cannot be integrated into academic risk analytics with mathematical certainty until a migration adds these fields or legacy exams are fully migrated to modular `AssessmentAttempt` records.
2. **Missing `AcademicTerm` Table:**
   - The PostgreSQL schema has no table defining calendar terms (e.g. Term 1, Semester 1) with official start and end dates.
   - True academic period verification requires an authorized schema migration introducing an `AcademicTerm` model.

---

## 4. Recommended Next Phase (Phase 6.2B.3 Specification)

**Objective:** Cleanse query parameter spoofing and precedence masking without database writes or migrations.

**Proposed Scope (Awaiting Authorization):**
1. **Neutralize Query Parameter Period Input:**
   In `academicAssessment.calculator.ts`, strictly enforce `periodStatus: 'UNSPECIFIED'` unless the period is verified against an internal authoritative whitelist or until OD-12 is approved.
2. **Clarify UI Copy:**
   Ensure ResultsPage never displays `"متاح ومعتمد"` under any circumstance while OD-12 remains unapproved.
3. **Precedence Disambiguation:**
   If unverifiable attempts exist alongside insufficient valid attempts, disclose `unverifiableAttemptsCount: n` so users understand why evidence is incomplete.

**This phase must NOT be implemented without separate explicit user authorization.**

