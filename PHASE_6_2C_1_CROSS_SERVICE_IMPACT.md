# OX-DIGITAL Education — Phase 6.2C.1
# Cross-Service Impact & Compatibility Assessment

**Date:** 2026-11-02  
**Project:** OX-DIGITAL Education  
**Authorized Workspace:** `D:\OX-DIGITAL\Mathe\OX-DIGITAL-GITHUB`  
**Git Baseline Verified:** `main @ 0500b93e65c24ed881349c4acea7f523332c5e9f` (`0500b93`)  
**Audit Execution Mode:** Strictly Read-Only  

---

## 1. Executive Summary

This assessment details every software service, background job, and frontend component across the OX-DIGITAL platform that queries, creates, mutates, or displays `Exam` and `ExamAttempt` records.

A critical discovery of this audit is that **the current schema defect in `ExamAttempt` directly pollutes multiple downstream services**, including `user-service` GPA calculations and `analytics-service` at-risk student detection. Aligning the schema will fix these systemic anomalies.

---

## 2. Service-by-Service Dependency Analysis

```
                        ┌───────────────────────────────┐
                        │     PostgreSQL Database       │
                        │      Exam & ExamAttempt       │
                        └──────────────┬────────────────┘
                                       │
        ┌──────────────────────────────┼──────────────────────────────┐
        │                              │                              │
        ▼                              ▼                              ▼
┌──────────────────┐          ┌──────────────────┐          ┌──────────────────┐
│ course-service   │          │ analytics-service│          │   user-service   │
│ - exam.controller│          │ - admin overview │          │ - student GPA    │
│ - riskEngine.job │          │ - at-risk queue  │          │ - report page    │
│ - assess.control │          │ - parent overview│          │ - user impact    │
└──────────────────┘          └──────────────────┘          └──────────────────┘
        │                              │                              │
        └──────────────────────────────┼──────────────────────────────┘
                                       │
                                       ▼
                        ┌───────────────────────────────┐
                        │     Frontend Applications     │
                        │ - Student Center & Online     │
                        │ - Teacher Dashboard           │
                        │ - Parent Portal               │
                        │ - Admin User Management       │
                        └───────────────────────────────┘
```

---

## 3. Detailed Consumer Manifest

### 3.1 `services/analytics-service`
* **File:** `src/controllers/analytics.controller.ts`
  - **Lines 30–33 (`getAdminAnalytics`):** Queries `db.examAttempt.findMany({ select: { score: true } })`. Currently averages all abandoned sessions (`score: 0`), depressing platform-wide statistics.
    - *Remediation after Phase 6.2C:* Filter `{ where: { status: 'GRADED' } }`.
  - **Lines 149–165 (`getParentChildOverview`):** Iterates `child.examAttempts` to build parent exam history.
  - **Lines 347, 389, 431 (`getStudentOverview` / `getStudentCharts`):** Fetches exams for performance charts and completed exam counters.
  - **Lines 560–578 (`getAtRiskStudents`):** Evaluates `student.examAttempts`. Line 578 flags a student as at-risk if `score < 50`. Currently, a student who merely clicks "Start Exam" and closes their tab receives a risk penalty for failing!
    - *Remediation after Phase 6.2C:* Filter `{ where: { status: 'GRADED', isGraded: true } }`.
* **File:** `src/services/academicAssessment.service.ts`
  - **Lines 22–26 (`getStudentAcademicAssessment`):** Fetches `examAttempts` and `assessmentAttempts` and passes them to `calculateAcademicAssessment`.

### 3.2 `services/course-service`
* **File:** `src/controllers/exam.controller.ts`
  - **Lines 232–267 (`createExam`):** Creates `Exam` and mirrors to `Assessment`. Needs to persist `totalPoints`.
  - **Lines 427–434 (`startAttempt`):** Creates `ExamAttempt`. Needs to write `status: 'STARTED'`, `startedAt: now`, and initialize `isGraded: false`.
  - **Lines 495–511 (`submitAttempt`):** Updates `ExamAttempt`. Needs to write `status: 'GRADED'`, `submittedAt: now`, `isGraded: true`, `totalPoints`, and `percentage`.
  - **Lines 576–580 (`reportViolation`):** On disqualification, needs to write `status: 'CHEATING'` rather than only `score: 0`.
* **File:** `src/jobs/riskEngine.job.ts`
  - Background cron evaluating student risks. Needs to ignore `status: 'STARTED'` and `status: 'ABANDONED'`.

### 3.3 `services/user-service`
* **File:** `src/controllers/user.controller.ts`
  - **Lines 214–226 (`getUserProfile` / `getStudentDetails`):**
    ```typescript
    const totalScores = user.examAttempts.reduce((acc, curr) => acc + (curr.score || 0), 0);
    examScore = Math.round(totalScores / user.examAttempts.length);
    ```
    Computes student overall exam score by averaging all records. A student with one completed exam of 90% and two abandoned sessions of 0% is reported as having an exam score of $30\% \rightarrow \text{Fail}$!
    - *Remediation after Phase 6.2C:* Filter `user.examAttempts.filter(a => a.status === 'GRADED')`.
  - **Lines 595–626 (`deleteUser` impact assessment):** Counts `examAttempts` for cascade deletion alerts.

### 3.4 `apps/frontend`
* **File:** `src/app/services/exam.service.ts`
  - Lines 67–78 already map `startAttempt`, `submitAttempt`, and `syncAttempt` to `assessmentApi` (`/api/assessments/...`).
  - Lines 44–65 map CRUD operations to `examApi` (`/api/exams/...`).
* **File:** `src/app/components/teacher/StudentReportPage.tsx`
  - Displays list of `report.examAttempts`.
* **File:** `src/app/components/admin/AdminUsersPage.tsx`
  - Line 557 displays `impactData.examAttempts`.
* **Files:** `ResultsPage.tsx` (Center & Online)
  - Consume normalized payload from `analytics-service`. Already fully compatible and verified.

---

## 4. Backward Compatibility & Rollout Guarantees

1. **Non-Breaking Database Changes:**
   - Adding nullable columns (`status`, `submittedAt`, `isGraded`, `totalPoints`, `percentage`) to `ExamAttempt` does not break existing `SELECT *` or `INSERT` queries from older service containers.
2. **Independent Service Upgradability:**
   - Services can be deployed independently. Even before services are updated, the database migration safely classifies historical rows.
3. **Frontend Zero-Impact:**
   - The frontend communicates via REST APIs and is insulated from database schema changes. No frontend code changes are strictly required to execute Phase 6.2C database alignment.

