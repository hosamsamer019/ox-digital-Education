# OX-DIGITAL Education — Phase 6.1A
# Comprehensive Metric Provenance & Data Integrity Matrix

**Audit Date:** November 1, 2026  
**Auditor:** Antigravity Autonomous Audit Agent  
**Target Repository:** `D:\OX-DIGITAL\Mathe\OX-DIGITAL-GITHUB`  
**Git Baseline:** `main` @ `0500b93` (Read-Only Verification Mode)  
**Database Evaluated:** PostgreSQL 16 (`ox_digital_education` database, 28 tables)  

---

## 1. Provenance Measurement Methodology & Quantitative Baseline

To establish strict, reproducible data integrity reporting without vague estimates, every metric displayed across the platform's five user roles (Admin, Teacher, Parent, Student Online, Student Center) was systematically cataloged, traced through its frontend React component, mapped to its Express route handler, and verified against its underlying Prisma query and database schema.

### Quantitative Provenance Classification
- **Total Metrics Cataloged:** **28 Distinct Metric Points**
- **Direct Database Aggregations / Queries:** **19 metrics (67.9%)**
- **Algorithmically Derived from Real Records:** **7 metrics (25.0%)**
- **Static Domain Constants (Informational):** **1 metric (3.6%)** (`gpaScale: 4.0`)
- **Hardcoded / Fabricated Placeholders:** **1 metric (3.6%)** (`rank: 1` in `getStudentOverview`)
- **Direct Data Integrity Compliance Score:** **27 / 28 = 96.4%** genuine data-driven provenance.

---

## 2. Exhaustive Metric Provenance Matrix

The following table provides the exhaustive metric-by-metric verification for the entire platform:

| # | Metric Name | Frontend Component & File | Backend Route & Controller | DB Tables & Fields | Exact Calculation Formula (from Code) | Null / Zero Behavior | Source Type | Test Verification | Discrepancy / Audit Observation |
| :-: | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **1** | إجمالي الطلاب (Total Students) | `AdminHomePage.tsx` | `GET /api/analytics/admin`<br>`getAdminAnalytics` | `User.role` | `db.user.count({ where: { role: { in: ['ONLINE_STUDENT', 'CENTER_STUDENT'] } } })` | Returns `0` if no students exist | Real DB Query | `AdminHomePage.test.tsx` | Accurate. Excludes Teachers, Admins, Parents. |
| **2** | إجمالي المعلمين (Total Teachers) | `AdminHomePage.tsx` | `GET /api/analytics/admin`<br>`getAdminAnalytics` | `User.role` | `db.user.count({ where: { role: 'TEACHER' } })` | Returns `0` | Real DB Query | `AdminHomePage.test.tsx` | Accurate. |
| **3** | أولياء الأمور (Total Parents) | `AdminHomePage.tsx` | `GET /api/analytics/admin`<br>`getAdminAnalytics` | `User.role` | `db.user.count({ where: { role: 'PARENT' } })` | Returns `0` | Real DB Query | `AdminHomePage.test.tsx` | Accurate. |
| **4** | المستخدمين النشطين (Active Users - 30d) | `AdminHomePage.tsx` | `GET /api/analytics/admin`<br>`getAdminAnalytics` | `User.updatedAt` | `db.user.count({ where: { updatedAt: { gte: thirtyDaysAgo } } })` | Returns `0` | Real DB Query | `AdminHomePage.test.tsx` | Accurate. Uses rolling 30-day window. |
| **5** | الكورسات والمواد (Total Courses) | `AdminHomePage.tsx` | `GET /api/analytics/admin`<br>`getAdminAnalytics` | `Course.id` | `db.course.count()` | Returns `0` | Real DB Query | `AdminHomePage.test.tsx` | Accurate. |
| **6** | إجمالي الفيديوهات (Total Lessons) | `AdminHomePage.tsx` | `GET /api/analytics/admin`<br>`getAdminAnalytics` | `Lesson.id` | `db.lesson.count()` | Returns `0` | Real DB Query | `AdminHomePage.test.tsx` | Accurate. |
| **7** | الامتحانات الكلية (Total Exams) | `AdminHomePage.tsx` | `GET /api/analytics/admin`<br>`getAdminAnalytics` | `Exam.id` | `db.exam.count()` | Returns `0` | Real DB Query | `AdminHomePage.test.tsx` | Accurate. Counts legacy `Exam` table. |
| **8** | إجمالي الواجبات (Total Homeworks) | `AdminHomePage.tsx` | `GET /api/analytics/admin`<br>`getAdminAnalytics` | `Homework.id` | `db.homework.count()` | Returns `0` | Real DB Query | `AdminHomePage.test.tsx` | Accurate. |
| **9** | إجمالي الإيرادات (Total Revenue) | `AdminHomePage.tsx` | `GET /api/analytics/admin`<br>`getAdminAnalytics` | `Payment.amount`, `Payment.status` | `successfulPayments.reduce((sum, p) => sum + p.amount, 0)` | Returns `0` | Real Calculated | `AdminHomePage.test.tsx` | Accurate. Filters `status === 'COMPLETED'`. |
| **10**| الإيراد الشهري (Monthly Revenue) | `AdminHomePage.tsx` | `GET /api/analytics/admin`<br>`getAdminAnalytics` | `Payment.amount`, `Payment.date` | Sums payments where `month === currentMonth && year === currentYear` | Returns `0` | Real Calculated | `AdminHomePage.test.tsx` | Accurate calendar month slice. |
| **11**| متوسط درجات الامتحانات (Avg Exam Score)| `AdminHomePage.tsx` | `GET /api/analytics/admin`<br>`getAdminAnalytics` | `ExamAttempt.score` | `Math.round(examAttempts.reduce((acc, a) => acc + a.score, 0) / examAttempts.length)` | Returns `0` if `length === 0` | Real Calculated | `AdminHomePage.test.tsx` | Guarded against division by zero. |
| **12**| معدل النجاح العام (Overall Pass Rate)| `AdminHomePage.tsx` | `GET /api/analytics/admin`<br>`getAdminAnalytics` | `ExamAttempt.score` | `Math.round((passCount / examAttempts.length) * 100)` where `score >= 50` | Returns `0` if `length === 0` | Real Calculated | `AdminHomePage.test.tsx` | Passing mark fixed at 50%. |
| **13**| الطلاب المعرضين للخطر (At-Risk Count)| `AdminHomePage.tsx` | `GET /api/analytics/admin`<br>`getAdminAnalytics` | `User`, `ExamAttempt.score` | `db.user.count({ where: { role: { in: [...] }, examAttempts: { some: { score: { lt: 50 } } } } })` | Returns `0` | Real DB Query | `AdminHomePage.test.tsx` | Defined solely as students with $\ge 1$ exam $< 50$. |
| **14**| إجمالي طلاب المعلم (Teacher Students)| `TeacherHomePage.tsx` | `GET /api/analytics/teacher/:id/overview` | `CourseEnrollment.studentId` | `studentIds.size` (unique set of enrolled student IDs) | Returns `0` | Real Calculated | `TeacherDashboard.test.tsx` | Deduplicates cross-course enrollments. |
| **15**| كورسات المعلم (Teacher Courses) | `TeacherHomePage.tsx` | `GET /api/analytics/teacher/:id/overview` | `Course.teacherId` | `courses.length` | Returns `0` | Real DB Query | `TeacherDashboard.test.tsx` | Accurate. |
| **16**| متوسط درجات طلاب المعلم (Teacher Avg) | `TeacherHomePage.tsx` | `GET /api/analytics/teacher/:id/overview` | `ExamAttempt.score` | `Math.round(totalScore / attemptCount)` | Returns `0` if `attemptCount === 0` | Real Calculated | `TeacherDashboard.test.tsx` | Guarded against division by zero. |
| **17**| تصنيف أداء الطلاب (Grade Breakdown) | `TeacherHomePage.tsx` | `GET /api/analytics/teacher/:id/overview` | `ExamAttempt.score` | ممتاز ($\ge 85$), جيد جداً ($50 \le x < 85$), متعثر ($< 50$) | Returns counts of 0 | Real Calculated | `TeacherDashboard.test.tsx` | Thresholds hardcoded in controller. |
| **18**| أداء الكورسات (Teacher Subject Avg) | `TeacherHomePage.tsx` | `GET /api/analytics/teacher/:id/overview` | `Course.title`, `ExamAttempt.score` | Groups by `c.title`: `Math.round(cTotal / cCount)` | Returns `0` | Real Calculated | `TeacherDashboard.test.tsx` | Conflates course title with academic subject. |
| **19**| نسبة إنجاز الدورة (Course Progress %) | `student-online/StudentHomePage.tsx` | `GET /api/courses/student/stats` | `VideoProgress.completed` | `(completedLessons / totalLessons) * 100` | Returns `0%` if `totalLessons === 0` | Real Calculated | `StudentOnlineDashboard.test.tsx` | Accurate. |
| **20**| المهام المنجزة للطالب (Completed Tasks)| `student-online/ResultsPage.tsx` | `GET /api/analytics/student/overview` | `ExamAttempt.id`, `Submission.id` | `exams.length + homeworks.length` | Returns `0` | Real Calculated | `StudentOnlineDashboard.test.tsx` | Accurate summation of attempts + submissions. |
| **21**| المعدل التراكمي للطالب (Student GPA) | `student-online/ResultsPage.tsx` | `GET /api/analytics/student/overview` | `ExamAttempt.score`, `Submission.grade` | `((totalScore / totalAssignments) / 25).toFixed(1)` (Scale of 4.0) | Returns `0.0` if `totalAssignments === 0` | Real Calculated | `StudentOnlineDashboard.test.tsx` | Converts 0-100% average to 4.0 GPA scale. |
| **22**| معدل حضور الطالب (Attendance Rate %) | `student-online/ResultsPage.tsx` | `GET /api/analytics/student/overview` | `Attendance.status` | `Math.round((presentCount / attendances.length) * 100)` where status is `PRESENT` or `LATE` | Returns `0%` if `attendances.length === 0` | Real Calculated | `StudentOnlineDashboard.test.tsx` | Counts `LATE` as attended. |
| **23**| ترتيب الطالب (Student Rank) | `student-center/ResultsPage.tsx` (line 189) | `GET /api/analytics/student/overview` | **NONE** | **`rank: 1`** | Always returns `1` regardless of DB data | **FABRICATED / STATIC** | None (Previously removed in parent tests) | **CRITICAL DEFECT.** Hardcoded in controller line 366. |
| **24**| المعدل العام للابن (Child Academic Rate) | `ParentHomePage.tsx`, `ParentReportsPage.tsx` | `GET /api/analytics/parent/child/:id/overview` | `ExamAttempt.score`, `Submission.grade` | `Math.round(totalScore / gradedItemsCount)` | Returns `null` -> displays `—` | Real Calculated | `ParentDashboard.test.tsx` | Honest null handling; only graded items count. |
| **25**| نسبة حضور الابن (Child Attendance %) | `ParentHomePage.tsx`, `ParentChildrenPage.tsx` | `GET /api/users/student/:id/attendance` | `Attendance.status` | `(presentDays / totalRecordedSessions) * 100` | Returns `0` (or `—` on empty) | Real Calculated | `ParentDashboard.test.tsx` | Verified handles LATE semantics honestly. |
| **26**| تقييم مخاطر الطالب (Student Risk Level)| `services/analytics-service/` (`getRiskAnalytics`) | `GET /api/analytics/risk` | `ExamAttempt.score`, `Submission.id` | `riskScore = (avg<50?50:avg<65?30:0) + (failed>=3?30:0) + (noSubs?20:0)` | If $<40$, omitted from list | Real Calculated | None | Heuristic integer scoring (40-59 Med, 60-79 High, $\ge 80$ Crit). |
| **27**| مخاطر الدروس (Video Risk Code) | `services/course-service/` (`riskEngine.job.ts`) | BullMQ Hourly Worker | `VideoProgress.firstActivityAt` | Checks if published lesson $>3$ days has no activity (`NOT_STARTED_3_DAYS`) | Creates `StudentRiskHistory` | Real Background Job | `standby_and_schema_compatibility.test.ts` | Operates only on video delay; does not evaluate exams. |
| **28**| محادثات الذكاء الاصطناعي (AI Stats) | `AdminHomePage.tsx` | `GET /api/analytics/ai-stats` | `ChatSession`, `ChatMessage` | `db.chatMessage.count()`, `db.chatSession.count()` | Returns `0` | Real DB Query | None | Aggregates real AI interaction records. |

---

## 3. Discrepancy Analysis & Unsupported Claims

### 3.1 The Hardcoded `rank: 1` Defect
- **Location:** `services/analytics-service/src/controllers/analytics.controller.ts` line 366.
- **Root Cause:** Developer placeholder left due to performance concerns.
- **Consumer Exposure:** Rendered in `student-center/ResultsPage.tsx` as `"المرتبة 1 بين طلاب المستوى الدراسي"`.
- **Classification:** **Confirmed Defect / Synthetic Value.**

### 3.2 Conflation of Course Title with Subject
- **Location:**
  - `TeacherHomePage.tsx` (`subjectPerformance` mapping in `getTeacherAnalytics`, line 323).
  - `StudentCharts.tsx` (`subjectProgressMap` in `getStudentCharts`, line 394).
  - `RiskAnalytics.tsx` (`riskBySubjectMap` in `getRiskAnalytics`, line 597).
- **Code Pattern:**
  ```typescript
  const subject = attempt.exam.course.title;
  ```
- **Classification:** **Semantic Conflation.** Course title is used as an unnormalized proxy for subject discipline.

### 3.3 Discrepancy Between Risk Engine Implementations
- **Finding:** There is no unified formula `0.40 * AttDeficit + 0.40 * AcadDeficit + 0.20 * InactDeficit` in the codebase.
- **Reality:** Three different risk metrics exist simultaneously:
  1. `getAdminAnalytics`: `examAttempts.some(score < 50)`.
  2. `getRiskAnalytics`: Integer thresholding rule (50 pts for avg < 50, 30 pts for 3 failed exams, 20 pts for no homework).
  3. `riskEngine.job.ts`: Video progress abandonment timer (> 72 hours inactive).
- **Classification:** **Documentation Divergence.**

---

## 4. Conclusion & Remediation Impact

The data provenance audit confirms that **OX-DIGITAL Education is not operating on fabricated or simulated numbers**. 27 out of 28 metrics are directly extracted or calculated from live PostgreSQL database records.

Eliminating the single `rank: 1` defect (by returning `null` or implementing the approved Strategy 1/2 from Deliverable 1) and standardizing the risk scoring will bring the platform's data integrity to **100% compliance**.

