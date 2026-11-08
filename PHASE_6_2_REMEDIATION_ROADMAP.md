# OX-DIGITAL Education — Phase 6.2
# Risk Engine Remediation Roadmap (Phase 6.2A – 6.2F)

**Status:** Implementation Roadmap (Awaiting Product Owner Authorization)  
**Workspace:** `D:\OX-DIGITAL\Mathe\OX-DIGITAL-GITHUB`  
**Git Baseline:** `main @ 0500b93`  
**Date:** November 2026  

---

## 1. Roadmap Overview & Phasing Principles

To transition OX-DIGITAL safely from the current four contradictory risk implementations to the Unified Risk Engine (URE) without disrupting active users or breaking production databases, remediation is structured into **six discrete, self-contained sub-phases**.

Each sub-phase requires explicit Product Owner review and authorization before commencement.

```
┌────────────────────────────────────────────────────────────────────────┐
│ Phase 6.2A: Bug Fixes & Schema Alignment (publishedAt & Admin KPI)     │
└───────────────────────────────────┬────────────────────────────────────┘
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│ Phase 6.2B: Unified Risk Calculation Service & Formula Validation      │
└───────────────────────────────────┬────────────────────────────────────┘
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│ Phase 6.2C: Database Schema Migration (StudentRiskProfile & Audit)     │
└───────────────────────────────────┬────────────────────────────────────┘
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│ Phase 6.2D: Teacher & Admin Dashboard Integration                      │
└───────────────────────────────────┬────────────────────────────────────┘
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│ Phase 6.2E: Parent Dashboard Early Warning System                      │
└───────────────────────────────────┬────────────────────────────────────┘
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│ Phase 6.2F: Automated Multi-Channel Alert & Notification Dispatch      │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Detailed Phase Specifications

### Phase 6.2A: Immediate Bug Fixes & Data Clean-up
- **Objective:** Eliminate existing silent failures and misleading metrics without altering existing schemas.
- **Key Tasks:**
  1. Fix `createLesson` and `updateLesson` in `course-service` to ensure `publishedAt` defaults to `new Date()` upon lesson publication.
  2. Backfill existing orphaned lessons (`publishedAt = createdAt`) via safe SQL update script.
  3. Correct Admin KPI query in `analytics.controller.ts` (`getAdminAnalytics`) to filter by the latest exam attempt rather than the lifetime `some(score < 50)` taint.
  4. Deprecate the orphaned `getRisks` route in `user-service`.
- **Target Files:**
  - `services/course-service/src/controllers/course.controller.ts`
  - `services/analytics-service/src/controllers/analytics.controller.ts`
  - `services/user-service/src/controllers/user.controller.ts`
- **Dependencies:** None.
- **Database Impact:** Safe backfill of `Lesson.publishedAt` column (already exists in schema).
- **Gate:** Automated regression and unit test suite pass.

---

### Phase 6.2B: Unified Risk Calculation Engine Core
- **Objective:** Build the unified multi-factor evaluation engine in a shared library or within `analytics-service`.
- **Key Tasks:**
  1. Implement the 4-factor scoring algorithm (Academic 40%, Attendance 30%, Homework 15%, Engagement 15%, or PO-approved weights).
  2. Implement real historical delta calculation ($\Delta \text{Risk} = \text{Risk}_t - \text{Risk}_{t-7d}$) to permanently eliminate the fabricated `-1 * Math.floor(score/10)` formula.
  3. Implement diagnostic attribution engine returning human-readable Arabic explanations.
- **Target Files:**
  - `services/analytics-service/src/services/riskEngine.service.ts` (new)
  - `services/analytics-service/src/controllers/analytics.controller.ts`
- **Dependencies:** Completion of Phase 6.2A.
- **Database Impact:** Read-only calculation logic; no schema modifications.
- **Gate:** Unit tests verifying scoring boundaries, retake handling, and zero-division safety.

---

### Phase 6.2C: Database Persistence & History Architecture
- **Objective:** Introduce `StudentRiskProfile` to store cached scores and maintain historical risk audit records.
- **Key Tasks:**
  1. Draft and apply Prisma migration for `StudentRiskProfile` with appropriate foreign keys and indexes.
  2. Update `riskEngine.job.ts` to run daily snapshot evaluation and update `StudentRiskProfile`.
  3. Ensure backward-compatibility with existing `StudentRiskHistory` consumers.
- **Target Files:**
  - `packages/database/prisma/schema.prisma`
  - `services/course-service/src/jobs/riskEngine.job.ts`
- **Dependencies:** Completion of Phase 6.2B and formal approval of schema design.
- **Database Impact:** New table `StudentRiskProfile`. Zero data loss on existing tables.
- **Gate:** Successful execution of non-destructive migration in staging/Docker.

---

### Phase 6.2D: Teacher & Admin Dashboard Frontend Integration
- **Objective:** Update Teacher and Admin UI to consume the explainable unified risk API.
- **Key Tasks:**
  1. Update `TeacherHomePage.tsx` and `TeacherAnalyticsPage.tsx` to render multi-dimensional badges and true trend indicators.
  2. Add diagnostic modal/tooltip explaining why each student is flagged (e.g., breakdown of attendance vs exam score).
  3. Update `AdminHomePage.tsx` to show current active at-risk count matching teacher metrics.
- **Target Files:**
  - `apps/frontend/src/app/components/teacher/TeacherHomePage.tsx`
  - `apps/frontend/src/app/components/teacher/TeacherAnalyticsPage.tsx`
  - `apps/frontend/src/app/components/admin/AdminHomePage.tsx`
- **Dependencies:** Completion of Phase 6.2C.
- **Database Impact:** None.
- **Gate:** Visual verification and Vitest frontend test coverage.

---

### Phase 6.2E: Parent Dashboard Early Warning Integration
- **Objective:** Provide parents with proactive academic and attendance risk visibility.
- **Key Tasks:**
  1. Design and integrate the "Early Warning & Academic Status" card in `ParentHomePage.tsx`.
  2. Display Arabic diagnostic explanations tailored for guardians (non-punitive, solution-oriented messaging).
  3. Provide one-click CTA to contact the educational center or teacher.
- **Target Files:**
  - `apps/frontend/src/app/components/parent/ParentHomePage.tsx`
  - `apps/frontend/src/app/services/parent.service.ts`
- **Dependencies:** Completion of Phase 6.2D.
- **Database Impact:** None.
- **Gate:** Parent portal UI testing across desktop and mobile viewports.

---

### Phase 6.2F: Automated Multi-Channel Notification Dispatch
- **Objective:** Alert teachers and parents immediately upon critical risk escalation.
- **Key Tasks:**
  1. Implement state-transition listener in BullMQ worker (`riskEngine.job.ts`).
  2. Dispatch in-app notifications to `Notification` table on `HIGH` or `CRITICAL` escalation.
  3. Emit real-time WebSocket events to online teacher and parent client sockets.
  4. Enforce 7-day rate-limiting cooldown per student to eliminate alert fatigue.
- **Target Files:**
  - `services/notification-service/src/services/riskNotification.service.ts` (new)
  - `services/course-service/src/jobs/riskEngine.job.ts`
- **Dependencies:** Completion of Phase 6.2E.
- **Database Impact:** Inserts into existing `Notification` table.
- **Gate:** End-to-end event-dispatch integration tests.

---

## 3. Risk Mitigation & Safety Controls

| Potential Risk | Severity | Mitigation Strategy |
|---|---|---|
| **Database Lock During Migration** | Medium | Execute `ALTER TABLE` / Prisma migrations during low-traffic maintenance window; ensure table additions do not hold locks on `User`. |
| **Alert Fatigue for Parents** | High | Strictly enforce escalation-only triggers and a minimum 7-day cooldown between alerts. |
| **Misleading Scores Due to Missing Data** | High | Implement minimum data thresholds: If a student has no graded exams, label academic status as `PENDING` rather than scoring 0%. |
| **Worker Processing Delay** | Low | Batch student risk evaluations in chunks of 100 via BullMQ; maintain Redis cache of active risk profiles. |

---

## 4. Required Sign-offs Before Execution

The following explicit sign-offs are required before proceeding to implementation:
1. **Product Owner Approval:** Approval of the 4 risk dimensions and baseline weights (Academic 40%, Attendance 30%, Homework 15%, Engagement 15%).
2. **Academic Leadership Approval:** Review of Arabic diagnostic explanation templates and parent communication guidelines.
3. **Database Administrator Sign-off:** Review of proposed `StudentRiskProfile` schema and index strategy.

