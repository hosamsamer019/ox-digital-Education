# OX-DIGITAL Education — Phase 6.2
# Risk Data Integrity & System Consistency Matrix

**Status:** Completed (READ-ONLY Audit)  
**Workspace:** `D:\OX-DIGITAL\Mathe\OX-DIGITAL-GITHUB`  
**Git Baseline:** `main @ 0500b93`  
**Date:** November 2026  

---

## 1. Comprehensive Cross-System Consistency Matrix

The following matrix compares every component in OX-DIGITAL that calculates, stores, or presents student risk data:

| Dimension | Mechanism 1: Background Video Worker | Mechanism 2: Academic Risk API | Mechanism 3: Admin Overview KPI | Mechanism 4: User-Service Risks |
|---|---|---|---|---|
| **Primary Code Location** | `services/course-service/src/jobs/riskEngine.job.ts` | `services/analytics-service/src/controllers/analytics.controller.ts` (`getRiskAnalytics`) | `services/analytics-service/src/controllers/analytics.controller.ts` (`getAdminAnalytics`) | `services/user-service/src/controllers/user.controller.ts` (`getRisks`) |
| **Execution Trigger** | Hourly Cron (`0 * * * *`) via BullMQ | On-demand HTTP `GET /api/analytics/risk` | On-demand HTTP `GET /api/analytics/admin` | On-demand HTTP `GET /api/users/risks` |
| **Target Frontend Consumer** | None (Writes to DB only) | `TeacherHomePage.tsx`, `TeacherAnalyticsPage.tsx` | `AdminHomePage.tsx` | Orphaned (wrapped in `user.service.ts` but never rendered) |
| **Data Sources** | `Lesson`, `VideoProgress`, `Enrollment`, `StudentRiskHistory` | `ExamAttempt`, `Submission` (Homework), `User` | `User`, `ExamAttempt` | `ExamAttempt`, `VideoProgress`, `Attendance`, `User` |
| **Calculation Method** | Binary check: Has watched published lesson within 3 days? | Additive integer points (Max 100): Exam Avg + Failed Exams + Missing HW | Lifetime existence check: `examAttempts.some(score < 50)` | Rule-based event generation (returns list of risk alerts) |
| **Exam Weight / Factor** | None ($0\%$) | Up to $80$ points (Avg $<50$ = +50, Avg $<65$ = +30, Fails $\ge 3$ = +30) | Binary single failure ($100\%$ weight) | `score < 50` $\to$ Critical alert |
| **Attendance Factor** | None ($0\%$) | None ($0\%$) | None ($0\%$) | $\ge 3$ absences $\to$ High alert |
| **Homework Factor** | None ($0\%$) | Up to $20$ points (Any missing homework = +20) | None ($0\%$) | None ($0\%$) |
| **Video Factor** | $100\%$ of evaluation | None ($0\%$) | None ($0\%$) | Incomplete video $\to$ Medium alert |
| **Risk Levels** | `HIGH`, `CRITICAL`, `NONE` | `low` (<40), `medium` (40-59), `high` (60-79), `critical` ($\ge 80$) | Binary: Count of students matching criteria | Arabic strings: `منخفض`, `متوسط`, `عالي`, `حرج` |
| **Data Persistence** | Writes to `StudentRiskHistory` and `VideoProgress.currentRiskLevel` | None (Ephemeral in-memory calculation) | None (Live SQL aggregate count) | None (Ephemeral in-memory list) |
| **Historical Trend** | Inserts timestamped rows, but no read API | Fabricated: `-1 * Math.floor(score / 10)` | None | None |
| **Student Eligibility** | All active enrollments | All students with role `'STUDENT'` | All students with role `'STUDENT'` | All students with role `'STUDENT'` |
| **Parent Visibility** | Zero (Hidden from parent dashboard) | Zero (Hidden from parent dashboard) | Zero (Hidden from parent dashboard) | Zero (Hidden from parent dashboard) |
| **Notification Behavior** | Zero (No alerts sent) | Zero (No alerts sent) | Zero (No alerts sent) | Zero (No alerts sent) |
| **Current Runtime Status** | **BLIND:** Evaluates 0 lessons due to `publishedAt = NULL` | **ACTIVE:** Powers teacher dashboard with synthetic trend | **ACTIVE:** Displays misleading inflated lifetime count | **DEAD CODE:** Unused by frontend |

---

## 2. In-Depth Critique of Mathematical & Statistical Validity

### 2.1 The Synthetic Trend Fabrication
In `analytics.controller.ts` line 593:
```typescript
trend: -1 * Math.floor(riskScore / 10)
```
- **Nature of the Flaw:** A real trend is the derivative or delta of a metric over time ($\Delta \text{Risk} = \text{Risk}_{t} - \text{Risk}_{t - \Delta t}$).
- **The Implemented Behavior:** The API treats instantaneous magnitude as negative velocity. A student whose score is 85 receives a "trend" of `-8`. A student whose score is 30 receives a "trend" of `-3`.
- **User Impact:** The teacher sees an arrow indicating that a critical student is "dropping by 8 points", even if the student improved from 100 to 85, or remained completely static for months. This is statistically invalid and misleading.

### 2.2 The Additive Arbitrary Integer Model
In `getRiskAnalytics`:
- A student with an exam average of $49\%$ receives $+50$ points.
- If that student also failed 3 exams, they receive $+30$ points, totaling $80$ points (`CRITICAL`).
- If another student missed 2 homework assignments and has an average of $64\%$, they receive $+30 + 20 = 50$ points (`MEDIUM`).
- **Issues:**
  1. No normalization for course difficulty, grade level, or total number of assignments.
  2. A student with 100 completed homeworks and 1 missed homework is penalized identically (+20) to a student who completed 0 out of 10 homeworks.
  3. No time decay: Failed exams from 6 months ago carry identical weight to exams failed yesterday.

### 2.3 Lifetime Taint in Admin KPI
In `getAdminAnalytics`:
```typescript
examAttempts: {
  some: {
    score: { lt: 50 },
  },
}
```
- **Nature of the Flaw:** The `some` filter checks for existence of at least one historical row.
- **Consequence:** If a student enters the platform, fails their very first diagnostic quiz with $45\%$, and subsequently scores $98\%$, $95\%$, and $100\%$ on all subsequent exams over the next 8 months, the Admin Dashboard will permanently count that student as "At Risk" forever.
- **Integrity Violation:** Direct contradiction with Phase 6.1B ranking policy which recognized retakes and latest graded attempts.

### 2.4 The Total Blindness of Video Risk
In `riskEngine.job.ts`:
- The entire background evaluation relies on:
  ```typescript
  publishedAt: { lte: threeDaysAgo }
  ```
- Because neither `createLesson` nor `updateLesson` in `course.controller.ts` populates `publishedAt`, every lesson created through the platform UI has `publishedAt = null`.
- Consequently, this worker has never once flagged an actual student in production. The `StudentRiskHistory` table contains zero records.

---

## 3. Discrepancy Scenarios Across Dashboard Views

To illustrate the severity of these contradictions, consider three concrete student profiles:

### Student A: "The Center Skipper"
- **Behavior:** Enrolled in physical center classes. Attended 0 out of 10 classroom sessions. Takes online exams remotely and scores $85\%$.
- **Admin Dashboard:** Reports **Healthy** (No failed exams).
- **Teacher Dashboard (Risk Analytics):** Reports **Low Risk (0/100)** (Exam avg > 65%, no missing HW).
- **Video Worker:** Evaluates nothing (0 lessons with `publishedAt`).
- **Parent Dashboard:** Sees 0% attendance, but **0 Risk Alerts**.
- **Reality:** Student has completely dropped out of physical schooling.

### Student B: "The Diagnostic Failure"
- **Behavior:** Scored $40\%$ on an initial diagnostic test in September. Received tutoring, took 12 subsequent exams and scored $>90\%$ on all of them. Attends 100% of classes.
- **Admin Dashboard:** Reports **At Risk** (Permanent lifetime taint).
- **Teacher Dashboard (Risk Analytics):** Reports **Low Risk (0/100)**.
- **Discrepancy:** Admin demands intervention for an honors student based on the KPI card.

### Student C: "The Video Ghost"
- **Behavior:** Registered for online self-paced learning. Has not watched a single video lesson in 45 days. Has not submitted homework because homework requires watching the lecture. Has not taken exams.
- **Admin Dashboard:** Reports **Healthy** (0 exam attempts, therefore `examAttempts.some(score < 50)` is false).
- **Teacher Dashboard (Risk Analytics):** Reports **Medium Risk (20/100)** (Missed homework only; 0 exam attempts means average is calculated as 0 or skipped).
- **Video Worker:** Reports **Nothing** (`publishedAt` is NULL).
- **Reality:** Student is completely abandoned and disengaged.

