# OX-DIGITAL Education — Phase 6.2C.1
# Database Schema Alignment Assessment
## Exam Lifecycle, Grading Integrity & Architecture Verification

**Date:** 2026-11-02  
**Project:** OX-DIGITAL Education  
**Authorized Workspace:** `D:\OX-DIGITAL\Mathe\OX-DIGITAL-GITHUB`  
**Git Baseline Verified:** `main @ 0500b93e65c24ed881349c4acea7f523332c5e9f` (`0500b93`)  
**Execution Mode:** Strictly Read-Only Architecture Assessment  
**Status:** COMPLETE — PENDING PRODUCT OWNER ARCHITECTURE & POLICY DECISIONS  

---

## 1. Executive Summary

Phase 6.2C.1 conducted an exhaustive, read-only architectural audit of the exam and assessment data models across the OX-DIGITAL platform. The investigation evaluated why the current PostgreSQL schema fails to provide reliable evidence for student academic performance without application-layer heuristics, and mapped the architectural paths required to achieve long-term data integrity.

### Core Discoveries:
1. **The Dual Architecture Paradox:** The codebase maintains two parallel assessment mechanisms:
   - **Legacy Architecture (`Exam` & `ExamAttempt`):** Tables dating from the initial schema. Lacks `status`, `submittedAt`, `isGraded`, and `totalPoints`. `ExamAttempt.score` stores a percentage ($0-100\%$) rather than points.
   - **Unified Architecture (`Assessment` & `AssessmentAttempt`):** Modern schema with full lifecycle tracking (`AttemptStatus` enum, `startedAt`, `submittedAt`, `score`, `totalPoints`, `percentage`, `cheatingDetected`) and a database-level unique constraint `@@unique([studentId, assessmentId])`.
2. **Frontend Routing vs Backend Querying:**
   - The frontend `examService` already routes start, answer autosave, and submission to the unified `assessmentApi` (`/api/assessments/...`).
   - Conversely, `analytics-service` and `user-service` still directly query the legacy `db.examAttempt` table.
3. **Flawed Historical Assumptions:** Multiple background jobs and controllers treat `ExamAttempt` rows with `score: 0` (which are created upon exam initiation) as completed exams with a failing grade of 0%, artificially deflating student GPAs and creating false risk alerts.

---

## 2. Stage 1 — Schema and Lifecycle Audit

### 2.1 Prisma Model Comparison

```
┌──────────────────────────────────────┐       ┌──────────────────────────────────────┐
│          Legacy: Exam                │       │          Unified: Assessment         │
├──────────────────────────────────────┤       ├──────────────────────────────────────┤
│ id: String (UUID, PK)                │       │ id: String (UUID, PK)                │
│ title: String                        │       │ title: String                        │
│ courseId: String (FK)                │       │ type: AssessmentType (EXAM/QUIZ/...) │
│ duration: Int (default: 60)          │       │ courseId: String (FK)                │
│ questions: Json?                     │       │ durationMinutes: Int?                │
│ startTime: DateTime?                 │       │ openAt: DateTime?                    │
│ endTime: DateTime?                   │       │ closeAt: DateTime?                   │
│ passingScore: Float (default: 50)    │       │ totalPoints: Float (default: 100)    │
│ [MISSING: totalPoints]               │       │ questions: Json?                     │
└──────────────────────────────────────┘       └──────────────────────────────────────┘
                   │                                              │
                   ▼                                              ▼
┌──────────────────────────────────────┐       ┌──────────────────────────────────────┐
│       Legacy: ExamAttempt            │       │      Unified: AssessmentAttempt      │
├──────────────────────────────────────┤       ├──────────────────────────────────────┤
│ id: String (UUID, PK)                │       │ id: String (UUID, PK)                │
│ examId: String (FK)                  │       │ assessmentId: String (FK)            │
│ studentId: String (FK)               │       │ studentId: String (FK)               │
│ score: Float (Stores 0-100 %)        │       │ status: AttemptStatus (Enum)         │
│ answers: Json?                       │       │ startedAt: DateTime                  │
│ createdAt: DateTime (Start timestamp)│       │ submittedAt: DateTime?               │
│ [MISSING: status]                    │       │ expiresAt: DateTime?                 │
│ [MISSING: submittedAt]               │       │ score: Float? (Raw points earned)    │
│ [MISSING: isGraded]                  │       │ totalPoints: Float? (Max points)     │
│ [MISSING: percentage]                │       │ percentage: Float? (Normalized %)    │
│ [MISSING: updatedAt]                 │       │ answers: Json?                       │
│ Index: [studentId], [examId]         │       │ cheatingDetected: Boolean            │
│ [NO UNIQUE CONSTRAINT]               │       │ Constraint: @@unique([student,assess])│
└──────────────────────────────────────┘       └──────────────────────────────────────┘
```

---

## 3. Detailed Trace of the 10 Controller Workflows

| # | Workflow | Legacy Controller (`exam.controller.ts`) | Unified Controller (`assessment.controller.ts`) | Persisted Evidence vs Transient State |
|---|---|---|---|---|
| **1** | **Exam Creation** | Creates `Exam` row and mirrors to `Assessment` (`type: 'EXAM'`). Does not set `totalPoints` on `Assessment` (defaults to 100). | Creates `Assessment` row. Explicitly stores `totalPoints`. | `Exam` lacks maximum points in schema. |
| **2** | **Exam Start** | `startAttempt` creates `ExamAttempt` row with `score: 0` and `answers: null`. Does not record start intent or status. | `startAssessment` creates `AssessmentAttempt` with `status: 'STARTED'`, `startedAt: now`, and `expiresAt`. Prohibits restart if already finished. | Legacy creates row with `score: 0` indistinguishable from failure. |
| **3** | **Autosave** | `syncAttempt` updates `answers = answers \|\| []` on latest attempt. | `saveAnswers` updates `answers` in-place. If past `expiresAt`, auto-finalizes as `TIME_EXPIRED`. | Legacy autosave mutates answers without timestamps. |
| **4** | **Normal Submission** | `submitAttempt` calculates `(correct/total)*100`. Updates `ExamAttempt.score = calculatedScore` and `answers`. | `submitAssessment` grades question by question, sets `score`, `totalPoints`, `percentage`, `status: 'GRADED'`, and `submittedAt: now`. | Legacy saves no `submittedAt` timestamp or submission flag. |
| **5** | **Time-Expired Submission** | If `elapsed > duration + 5 min`, returns HTTP 400 error. Does **NOT** save or finalize attempt. Row is stranded in `score: 0`. | If `now >= expiresAt`, sets `status = 'TIME_EXPIRED'`, grades available answers, and saves `submittedAt: now`. | Legacy strands expired attempts in unsubmitted state. |
| **6** | **Automatic Grading** | Evaluates multiple-choice questions instantly; writes percentage into `score`. | Evaluates normalized answers; records both raw points and percentage. | Legacy conflates raw score with percentage. |
| **7** | **Manual Grading** | **Not implemented.** Only multiple-choice auto-graded. | Essay/open-ended questions fall back to 0 points. Review page exists, but no rubric writeback. | Neither system has persistent manual grading rubric. |
| **8** | **Cheating Detection** | `reportViolation` creates `ExamViolation`. On 2nd violation, updates `ExamAttempt.score = 0`. No status flag on attempt. | `reportAssessmentViolation` increments count. On 3rd violation, sets `cheatingDetected: true` and `status: 'CHEATING'`. | Legacy uses `score = 0` to denote cheating, masking student ability. |
| **9** | **Abandonment / Incomplete** | Student closes browser: attempt row remains forever with `score: 0, answers: null` (or partial autosave). | Student closes browser: attempt remains `status: 'STARTED'`. Next check marks `TIME_EXPIRED`. | Legacy leaves ghost records that skew averages. |
| **10**| **Retake Creation** | Calling `startAttempt` creates a **new row** in `ExamAttempt`. But `submitAttempt` updates `findFirst(orderBy: desc)`. | Calling `startAssessment` throws `ATTEMPT_ALREADY_FINISHED` due to `@@unique` constraint. | Legacy permits multiple rows but mishandles submission. |

---

## 4. Stage 2 — Proposed Data Model Alternatives

To resolve the architectural limitations without breaking existing services, three data model approaches are evaluated:

### Option A: Schema Alignment on Legacy Tables (Minimal In-Place Upgrade)
Add missing columns directly to `Exam` and `ExamAttempt`:
```prisma
model Exam {
  // Existing fields...
  totalPoints    Float         @default(100)
}

model ExamAttempt {
  // Existing fields...
  status         AttemptStatus @default(SUBMITTED)
  submittedAt    DateTime?
  isGraded       Boolean       @default(false)
  totalPoints    Float?
  percentage     Float?
  updatedAt      DateTime      @updatedAt @default(now())
}
```
* **Advantages:** Directly fixes legacy queries in `analytics-service` and `user-service` without refactoring query names.
* **Disadvantages:** Perpetuates the dual architecture (two sets of tables doing the identical job).

### Option B: Full Consolidation into Unified Architecture (Recommended Architectural End-State)
Deprecate `Exam` and `ExamAttempt` completely in application code. Migrate all queries to `Assessment` and `AssessmentAttempt`:
1. `Assessment` already possesses `totalPoints`, `durationMinutes`, and question assets.
2. `AssessmentAttempt` already possesses `status`, `startedAt`, `submittedAt`, `score`, `totalPoints`, `percentage`, and `cheatingDetected`.
3. Consolidate `/api/exams` routes as lightweight wrappers around `assessment.controller.ts`.
4. Update `analytics-service` and `user-service` to query `db.assessmentAttempt`.
* **Advantages:** Eliminates redundant tables, technical debt, and synchronization bugs permanently.
* **Disadvantages:** Requires cross-service query updates across 3 backend services and frontend.

### Option C: Two-Phase Hybrid Alignment (Safest Implementation Path)
1. **Phase 6.2C:** Implement Option A (align `ExamAttempt` schema) to immediately safeguard historical data and provide database-level integrity for current endpoints.
2. **Phase 7.0:** Systematically migrate service queries to `AssessmentAttempt` and archive legacy tables.

---

## 5. Architectural Verdict

The database schema limitations identified in Phase 6.2B.2.1 and Phase 6.2B.2.3 are confirmed as **genuine architectural gaps in PostgreSQL**:
- The lack of `status` and `submittedAt` on `ExamAttempt` causes `user-service` and `analytics-service` to mistake abandoned attempts for genuine 0% academic failures.
- The platform is ready for schema alignment, but **must not execute database changes until the Product Owner selects the migration strategy and resolves the pending retake policy (OD-11)**.

