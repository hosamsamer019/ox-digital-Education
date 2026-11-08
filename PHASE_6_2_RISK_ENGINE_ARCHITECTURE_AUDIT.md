# OX-DIGITAL Education — Phase 6.2
# Risk Engine Architecture & Data Integrity Audit Report

**Status:** Completed (READ-ONLY Audit)  
**Workspace:** `D:\OX-DIGITAL\Mathe\OX-DIGITAL-GITHUB`  
**Git Baseline:** `main @ 0500b93`  
**Date:** November 2026  

---

## 1. Executive Summary

A comprehensive, evidence-based investigation was conducted on the student risk assessment architecture across the entire OX-DIGITAL Education platform. 

The investigation revealed that the platform does not possess a unified risk engine. Instead, **four completely isolated, uncoordinated, and mutually contradictory mechanisms** calculate, store, or display student "risk":

1. **Background Video Inactivity Worker (`course-service`):** An hourly BullMQ cron job intended to evaluate video lag and record historical risk rows in `StudentRiskHistory`. However, due to an architectural bug where `Lesson.publishedAt` is never populated upon lesson creation, **this worker is 100% blind and evaluates 0 lessons in production**.
2. **On-Demand Academic Risk API (`analytics-service`):** A real-time scoring calculation serving the Teacher Dashboard (`/api/analytics/risk`). It evaluates exam averages, failed exam counts, and missing homeworks on an integer point scale (0–100). It **completely ignores video engagement, physical classroom attendance, and the `StudentRiskHistory` table**, and fabricates a synthetic mathematical trend (`-1 * Math.floor(score / 10)`).
3. **Admin KPI Lifetime At-Risk Counter (`analytics-service`):** An aggregated KPI counter serving the Admin Dashboard (`/api/analytics/admin`). It flags any student with even a single historical exam attempt $< 50\%$ as permanently "At Risk" for life, contradicting the teacher's active risk list.
4. **Orphaned User-Service Risk Endpoint (`user-service`):** A fourth calculation (`/api/users/risks`) assessing exam scores, video status, and $\ge 3$ absences. While wrapped by the frontend client SDK, it is **never called or rendered by any dashboard UI component**.

Furthermore:
- **Parent Dashboard:** Contains **zero risk visibility**. Parents are never informed of student academic or engagement decline.
- **Notification Engine:** Neither background jobs nor API queries emit notifications or alerts when a student enters High or Critical risk.
- **Physical Attendance Blindspot:** A center student who skips 100% of physical classes is treated as having "0 risk" by the primary teacher risk dashboard as long as their online exam scores remain satisfactory.

---

## 2. In-Depth Audit of Discovered Risk Mechanisms

### Mechanism 1: BullMQ Background Hourly Worker (`course-service`)

- **File Path:** [`services/course-service/src/jobs/riskEngine.job.ts`](file:///D:/OX-DIGITAL/Mathe/OX-DIGITAL-GITHUB/services/course-service/src/jobs/riskEngine.job.ts)
- **Execution Model:** Automated BullMQ worker scheduled on cron pattern `0 * * * *` (hourly).
- **Trigger Condition:** Evaluates students enrolled in courses with lessons where `publishedAt <= threeDaysAgo`.
- **Target Database Entities:** `VideoProgress`, `StudentRiskHistory`.

#### Technical Implementation Analysis
```typescript
// services/course-service/src/jobs/riskEngine.job.ts lines 38-48
const lessons = await db.lesson.findMany({
  where: {
    publishedAt: {
      lte: threeDaysAgo,
    },
  },
  select: {
    id: true,
    courseId: true,
  },
});
```
If a student has not watched the lesson within 3 days:
1. `VideoProgress.currentRiskLevel` is updated to `'HIGH'`.
2. A new record is inserted into `StudentRiskHistory`:
```typescript
// lines 79-88
await db.studentRiskHistory.create({
  data: {
    studentId: student.id,
    riskLevel: 'HIGH',
    reason: `Late video viewing: ${lessons.length} pending lessons`,
  },
});
```

#### Root Cause of Total Inactivity (The `publishedAt` Blindness Bug)
Inspection of the lesson management lifecycle in [`services/course-service/src/controllers/course.controller.ts`](file:///D:/OX-DIGITAL/Mathe/OX-DIGITAL-GITHUB/services/course-service/src/controllers/course.controller.ts) reveals:
- Line 859 (`createLesson`): Creates a lesson record with `courseId`, `title`, `description`, `videoUrl`, `duration`, `order`, and `isFree`. **It does not populate `publishedAt`**.
- Line 922 (`updateLesson`): Allows updating title, description, videoUrl, duration, order, and isFree. **It does not expose or populate `publishedAt`**.
- Database Inspection: All existing lessons in the production PostgreSQL database have `publishedAt = NULL`.
- As a result, the query `publishedAt: { lte: threeDaysAgo }` matches **zero lessons**, the loop terminates immediately, and the BullMQ job logs `Evaluation finished in 15ms` every hour having evaluated nothing.
- In production, `db.studentRiskHistory.count()` is **0**.

---

### Mechanism 2: Real-Time Academic Risk Engine (`analytics-service`)

- **File Path:** [`services/analytics-service/src/controllers/analytics.controller.ts`](file:///D:/OX-DIGITAL/Mathe/OX-DIGITAL-GITHUB/services/analytics-service/src/controllers/analytics.controller.ts)
- **Endpoint:** `GET /api/analytics/risk` (`getRiskAnalytics`)
- **Execution Model:** On-demand API request executed when the teacher navigates to Home or Analytics.
- **Frontend Consumers:**
  - [`apps/frontend/src/app/components/teacher/TeacherHomePage.tsx`](file:///D:/OX-DIGITAL/Mathe/OX-DIGITAL-GITHUB/apps/frontend/src/app/components/teacher/TeacherHomePage.tsx) (lines 102, 281-309)
  - [`apps/frontend/src/app/components/teacher/TeacherAnalyticsPage.tsx`](file:///D:/OX-DIGITAL/Mathe/OX-DIGITAL-GITHUB/apps/frontend/src/app/components/teacher/TeacherAnalyticsPage.tsx) (lines 357-410)

#### Scoring Algorithm
The algorithm computes an arbitrary additive risk score between 0 and 100 based on three factors:
1. **Exam Average:**
   - Average $< 50\%$: $+50$ points
   - Average $< 65\%$: $+30$ points
2. **Failed Exam Count:**
   - $\ge 3$ failed exam attempts: $+30$ points
3. **Missing Homework:**
   - Any missing homework: $+20$ points
4. **Score Normalization:** `riskScore = Math.min(riskScore, 100)`

#### Level Thresholds:
- **Low:** $0 \le \text{Score} < 40$
- **Medium:** $40 \le \text{Score} < 60$
- **High:** $60 \le \text{Score} < 80$
- **Critical:** $\text{Score} \ge 80$

#### Critical Architectural Deficiencies
1. **Zero Data Persistence:** Scores are calculated ephemerally in RAM and never saved to `StudentRiskHistory`.
2. **Synthetic Trend Metric:** 
   Line 593:
   ```typescript
   trend: -1 * Math.floor(riskScore / 10)
   ```
   This is a **mathematical fabrication**. Rather than tracking changes over time (e.g. comparing this week's score to last week's), the API returns a deterministic negative integer proportional to the instantaneous risk score.
3. **Absence of Video Progress:** Video viewing velocity and drop-offs are completely ignored.
4. **Absence of Physical Attendance:** Center attendance records are never joined.

---

### Mechanism 3: Admin Overview KPI Counter (`analytics-service`)

- **File Path:** [`services/analytics-service/src/controllers/analytics.controller.ts`](file:///D:/OX-DIGITAL/Mathe/OX-DIGITAL-GITHUB/services/analytics-service/src/controllers/analytics.controller.ts) (lines 430-440)
- **Endpoint:** `GET /api/analytics/admin` (`getAdminAnalytics`)
- **Execution Model:** Executed on Admin Dashboard load.
- **Frontend Consumer:** [`apps/frontend/src/app/components/admin/AdminHomePage.tsx`](file:///D:/OX-DIGITAL/Mathe/OX-DIGITAL-GITHUB/apps/frontend/src/app/components/admin/AdminHomePage.tsx) (line 305)

#### Query Definition
```typescript
const atRiskStudents = await db.user.count({
  where: {
    role: 'STUDENT',
    examAttempts: {
      some: {
        score: { lt: 50 },
      },
    },
  },
});
```

#### Flaw and Disconnect
- **Lifetime Taint:** This query flags any student who has *ever* scored $< 50$ on any exam attempt at any point in history.
- Even if a student retook the exam and scored 100%, or subsequently passed 10 consecutive exams with top honors, they remain permanently counted in `atRiskStudents`.
- This causes a sharp divergence: the Admin Dashboard might report 25 "At Risk" students, while the Teacher Dashboard reports 0 "High/Critical" risk students.

---

### Mechanism 4: Orphaned User-Service Risk Endpoint (`user-service`)

- **File Path:** [`services/user-service/src/controllers/user.controller.ts`](file:///D:/OX-DIGITAL/Mathe/OX-DIGITAL-GITHUB/services/user-service/src/controllers/user.controller.ts) (lines 485-538)
- **Endpoint:** `GET /api/users/risks` (`getRisks`)
- **Execution Model:** Intended to list system-level risk flags.

#### Evaluation Logic:
- Checks `ExamAttempt.score < 50` $\to$ emits `LOW_EXAM_SCORE` (severity: "حرج")
- Checks `VideoProgress.completed === false` $\to$ emits `VIDEO_INCOMPLETE` (severity: "متوسط")
- Checks `Attendance.status === 'ABSENT'` count $\ge 3$ $\to$ emits `HIGH_ABSENCE` (severity: "عالي")

#### Architectural Disconnect
- The endpoint is wrapped in the frontend client SDK: [`apps/frontend/src/app/services/user.service.ts`](file:///D:/OX-DIGITAL/Mathe/OX-DIGITAL-GITHUB/apps/frontend/src/app/services/user.service.ts) line 107 (`getRisks: () => api.get('/users/risks')`).
- **However, search across the entire frontend confirms this method is never invoked by any React page or component**. It is dead code executing a third conflicting risk model.

---

## 3. Communication & Notification Blackout

### Parent Dashboard
- Audit of [`apps/frontend/src/app/components/parent/ParentHomePage.tsx`](file:///D:/OX-DIGITAL/Mathe/OX-DIGITAL-GITHUB/apps/frontend/src/app/components/parent/ParentHomePage.tsx) reveals that parents are shown:
  - Attendance rates
  - Exam averages
  - Recent activities
- **There is zero display of risk status, early-warning indicators, or academic jeopardy alerts**. Parents have no visibility when their child is flagged as "Critical" in the teacher console.

### Notification Disconnect
- Examination of both `riskEngine.job.ts` and `analytics.controller.ts` shows **zero calls to the notification service or database**.
- When a student crosses into High or Critical risk:
  - No database notification is created in `Notification`.
  - No real-time WebSocket event is emitted via Socket.IO.
  - No SMS or WhatsApp alert is queued.
  - The risk state exists solely as a silent data point awaiting manual discovery by a teacher.

---

## 4. Physical vs. Online Center Blindspot

The OX-DIGITAL platform serves both **Online Students** and **Physical Center Students**.

In the physical center workflow:
- Teachers log student attendance using `Attendance` records (`PRESENT`, `ABSENT`, `LATE`, `EXCUSED`).
- Under the current primary risk engine (`getRiskAnalytics`), `Attendance` is **never queried**.
- Consequently, a student who skips every single physical class session for two months will never be flagged as "At Risk" by the Teacher Dashboard unless they also fail online exams.

