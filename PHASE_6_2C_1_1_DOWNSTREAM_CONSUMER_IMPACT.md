# OX-DIGITAL Education — Phase 6.2C.1.1
# Downstream Consumer Audit & Query Impact Analysis

**Date:** 2026-11-02  
**Project:** OX-DIGITAL Education  
**Authorized Workspace:** `D:\OX-DIGITAL\Mathe\OX-DIGITAL-GITHUB`  
**Git Baseline Verified:** `main @ 0500b93e65c24ed881349c4acea7f523332c5e9f` (`0500b93`)  
**Audit Execution Mode:** Strictly Read-Only Source Code Analysis  

---

## 1. Executive Summary

This audit catalogs every query, calculation, and consumer of `Exam` and `ExamAttempt` across the OX-DIGITAL microservices and frontend clients.

Crucially, **consumers must NOT use a uniform filter rule**. While academic averages and GPA calculations must strictly filter `status = 'GRADED'`, operational dashboards (teacher monitoring, parent alerts, cheating audits) require visibility into `STARTED`, `IN_PROGRESS`, `TIME_EXPIRED`, and `CHEATING` states.

---

## 2. Downstream Consumer Audit Table

| Consumer ID | Service & File Reference | Current Query / Code Pattern | Current Flawed Assumption | Required Change Post-Migration | Risk if Unchanged |
|---|---|---|---|---|---|
| **C-01** | `analytics-service` / `analytics.controller.ts:30–33` | `db.examAttempt.findMany({ select: { score: true } })` | Assumes every row in `ExamAttempt` is a completed exam. | Filter: `{ where: { status: 'GRADED', isGraded: true } }`. | Global platform average depressed by abandoned sessions (`score: 0`). |
| **C-02** | `analytics-service` / `analytics.controller.ts:560–578` | `student.examAttempts.filter(a => a.score < 50)` | Assumes `score: 0` represents an academic failure. | Filter: `student.examAttempts.filter(a => a.status === 'GRADED' && a.score < 50)`. | Students falsely marked at-risk because they opened an exam and closed it! |
| **C-03** | `user-service` / `user.controller.ts:214–226` | `totalScores = examAttempts.reduce((acc, curr) => acc + curr.score, 0) / examAttempts.length` | Assumes all attempts are completed exams on a 0–100 scale. | Filter: `user.examAttempts.filter(a => a.status === 'GRADED')`. | Severe GPA deflation; students with 1 pass (90%) and 2 abandoned sessions receive 30% (Fail). |
| **C-04** | `analytics-service` / `academicAssessment.service.ts:22–26` | `db.examAttempt.findMany({ where: { studentId } })` | Passes raw attempts to pure calculator. | Filter: `{ where: { status: 'GRADED', isGraded: true } }` (or let calculator filter). | Low risk; calculator already safely excludes `answers: null`. |
| **C-05** | `analytics-service` / `analytics.controller.ts:149–165` | `child.examAttempts` for parent overview | Displays all attempts as completed exams. | Partition by status: Display completed exams under "نتائج الامتحانات" and in-progress under "امتحانات قيد التنفيذ". | Parents see false zero-mark exams. |
| **C-06** | `course-service` / `riskEngine.job.ts:45–90` | Background risk evaluation job | Assumes `ExamAttempt.score` is authoritative. | Ignore `status IN ('STARTED', 'ABANDONED')`. | Background cron generates false high-risk alerts. |
| **C-07** | `course-service` / `exam.controller.ts:479–482` | `findFirst({ where: { studentId, examId }, orderBy: { createdAt: 'desc' } })` | Assumes latest attempt is the one being submitted. | Update explicitly using attempt ID or filter `status = 'STARTED'`. | Race condition if multiple browser tabs open. |
| **C-08** | `frontend` / `TeacherDashboard.tsx` & `StudentReportPage.tsx` | Displays `report.examAttempts.length` | Conflates initiated exam attempts with completed exams. | Distinguish completed exams (`status: 'GRADED'`) from abandoned attempts. | Teacher sees misleading completed exam count. |
| **C-09** | `frontend` / `AdminUsersPage.tsx:557` | Displays `impactData.examAttempts` | Cascade delete impact counter. | **No change required.** Operational count of all rows is correct here. | None. |

---

## 3. Consumer Filtering Policy: Academic vs Operational

```
                                  ExamAttempt Rows in Database
                                                │
                       ┌────────────────────────┴────────────────────────┐
                       │                                                 │
                       ▼                                                 ▼
             Academic Evaluation                               Operational Monitoring
         (GPA, Academic Average, Ranking)              (Teacher Queue, Parent Alerts, Cheating)
                       │                                                 │
                       ▼                                                 ▼
          Filter: status = 'GRADED'                        Expose all lifecycle states:
          AND isGraded = true                              - STARTED (Active / Abandoned)
          AND percentage IS NOT NULL                       - SUBMITTED (Pending Grading)
                                                           - TIME_EXPIRED (Auto-submitted)
                                                           - GRADED (Completed)
                                                           - CHEATING (Disqualified)
```

1. **Academic Evaluation Rule:** Only records with `status = 'GRADED'` and verified completion may enter the arithmetic mean or minimum evidence threshold.
2. **Operational Monitoring Rule:** Teachers and administrators must see all states to detect students who abandon exams, encounter network timeouts, or trigger cheating disqualifications.

