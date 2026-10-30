# OX-DIGITAL Education — Phase 5.3 Teacher Data Integrity Matrix

**Date:** October 28, 2026  
**Target:** Teacher Experience (`/teacher/*`)  
**Authorized Project Root:** `D:\OX-DIGITAL\Mathe\Mathteachersmartplatform-main`  
**Evaluation Mode:** Complete Metric, Chart & Action Data Source Verification

---

## 1. Overview & Evaluation Legend

Every teacher-facing data point, chart, badge, and interactive action is classified into one of the following verification states:

| Status | Definition |
| :--- | :--- |
| **REAL** | Directly backed by real backend API data, queries PostgreSQL models, and reflects genuine user activity. |
| **CALCULATED** | Derived on the backend or frontend from verified real records using documented formulas. |
| **BROKEN** | Intended to be real, but suffers from an API field mismatch, undefined property path, or runtime error. |
| **MOCKED** | Hardcoded static dummy array or fake data completely detached from database records. |
| **UNSUPPORTED** | UI control or button present without an active event handler or backend capability. |

---

## 2. Comprehensive Metric & Chart Matrix

### A. Home Dashboard Metrics (`/teacher/home`)

| Metric / Element | Target Field | Backend Source | Underlying Model | Status | Audit Findings & Recommended Handling |
| :--- | :--- | :--- | :--- | :---: | :--- |
| **إجمالي الطلاب** (Total Students) | `totalStudents` | `GET /api/analytics/teacher/:id/overview` | `CourseEnrollment` via `db.course.findMany({ where: { teacherId } })` | **REAL** | Aggregates unique student IDs enrolled across teacher's courses (`studentIds.size`). Preserve as primary KPI. |
| **الطلاب النشطين** (Active Students) | `activeStudents` | *None returned* | None | **BROKEN** | Frontend looks for `summaryStats.activeStudents`, but backend returns `strugglingStudents`. Card renders `undefined`. **Remedy:** Replace with `strugglingStudents` or genuine enrolled count. |
| **الكورسات المنشورة** (Courses Count) | `totalCourses` | `GET /api/analytics/teacher/:id/overview` | `Course` (`where: { teacherId }`) | **REAL** | Reflects total courses created by this teacher. Preserve. |
| **متوسط درجات الامتحانات** (Average Exam Score) | `averageScore` | `GET /api/analytics/teacher/:id/overview` | `ExamAttempt` (`exam.attempts.score`) | **BROKEN / CALCULATED** | Backend evaluates `Math.round(totalScore / attemptCount)`. Frontend looks for `summaryStats.avgExamScore`, rendering `undefined%`. **Remedy:** Bind to `averageScore`, display as raw average without deceptive `%`. |
| **نشاط الطلاب هذا الأسبوع** (Weekly Progress Chart) | `overview.weeklyProgress` | *None returned* | None | **BROKEN** | Recharts `AreaChart` expects `weeklyProgress` array. Backend does not calculate or return this field. Chart is permanently empty. **Remedy:** Replace with real `subjectPerformance` bar chart. |
| **توزيع مستويات الطلاب** (Distribution Pie Chart) | `distributionData` | `GET /api/analytics/teacher/:id/overview` | Derived from `studentScores` map | **CALCULATED** | Groups student averages: `ممتاز` (>=85), `جيد جداً` (50-84), `متعثر` (<50). Real calculation. Preserve with institutional palette colors. |
| **أداء الطلاب حسب المادة** (Subject Performance) | `subjectPerformance` | `GET /api/analytics/teacher/:id/overview` | `Course` & `ExamAttempt` | **CALCULATED** | Real calculation of average score per course (`cTotal / cCount`). Preserve in home layout. |
| **النشاطات الأخيرة** (Recent Activities List) | `recentActivities` | `GET /api/analytics/teacher/:id/overview` | Hardcoded `[]` in backend | **BROKEN** | Backend returns `recentActivities: []`. Furthermore, frontend tries to render `<activity.icon />` as a component, which would crash if JSON were returned. **Remedy:** Render clean empty state or omit until event log is implemented. |
| **طلاب في خطر** (At-Risk Students List) | `riskStudents` | `GET /api/analytics/risk` | `User`, `ExamAttempt`, `Submission` | **REAL** | Real calculation in `getRiskAnalytics` evaluating low exam scores (<50, <65), failed exams, and missing homeworks. Scoped to teacher. Preserve. |
| **زر "عرض الكل" / "عرض الملف"** | Action buttons | Client-side routing | Navigation | **UNSUPPORTED** | Buttons lack `onClick` handlers. **Remedy:** Wire "عرض الملف" to navigate to `/teacher/students/:id`. |

---

### B. Analytics Page Metrics (`/teacher/analytics`)

| Metric / Chart | Current Source | Backend Field | Status | Audit Findings & Recommended Handling |
| :--- | :--- | :--- | :---: | :--- |
| **KPI 1: إجمالي الطلاب** | `analyticsData.totalStudents` | `totalStudents` | **REAL** | Verified from real teacher courses. Preserve. |
| **KPI 2: متوسط الدرجات** | `analyticsData.averageScore` | `averageScore` | **REAL** | Verified average of exam attempts. Preserve without `%`. |
| **KPI 3: الدورات النشطة** | `analyticsData.totalCourses` | `totalCourses` | **REAL** | Verified course count. Preserve. |
| **KPI 4: طلاب في خطر** | `analyticsData.strugglingStudents` | `strugglingStudents` | **REAL** | Count of students with avg < 50. Preserve. |
| **مخطط الاتجاه الشهري** (Monthly Trend) | Static array `monthlyTrend` | *None* | **MOCKED** | Hardcoded mock data (Sept: 68, Oct: 72...). **Remedy: REMOVE**. |
| **رادار أداء المواد** (Subject Radar) | Static array `subjectRadar` | *None* | **MOCKED** | Hardcoded mock data ('الجبر', 'الهندسة'...). **Remedy: Replace with real `subjectPerformance`**. |
| **إنجاز الواجبات الأسبوعي** (Homework Completion) | Static array `homeworkCompletion` | *None* | **MOCKED** | Hardcoded mock data ('أسبوع ١: 92'...). **Remedy: REMOVE**. |
| **توقعات ذكاء اصطناعي للطلاب** (Predictions Table) | Static array `predictions` | *None* | **MOCKED** | Hardcoded fake students ('أحمد محمد', 'سارة خالد'...). **Remedy: Replace with real at-risk list from `GET /api/analytics/risk`**. |
| **تصدير PDF** (Export PDF Button) | None | None | **UNSUPPORTED** | Has no `onClick` handler. **Remedy: Provide real window.print() or clear disabled state**. |

---

### C. Attendance Workflow Data (`/teacher/attendance`)

| Data Element | API Endpoint | Backend Method | Status | Audit Findings |
| :--- | :--- | :--- | :---: | :--- |
| **Teacher Courses** | `GET /api/courses` | `courseService.getCourses` | **REAL** | Real courses list. |
| **Student Roster** | `GET /api/users` | `userService.getUsers` | **REAL** | Real student list filtered by role. |
| **Date Attendance Records** | `GET /api/attendance/date/:date` | `userService.getAttendanceByDate` | **REAL** | Queries `db.attendance` for normalized date range. |
| **Bulk Attendance Save** | `POST /api/attendance/bulk` | `userService.bulkMarkAttendance` | **REAL** | Real upsert of attendance records (`PRESENT`, `LATE`, `ABSENT`). |

---

### D. Assessments & Question Bank (`/teacher/exams`, `/teacher/questions`)

| Feature | API Endpoint | Backend Method | Status | Audit Findings |
| :--- | :--- | :--- | :---: | :--- |
| **Exams List & CRUD** | `/api/exams` | `examService.*` | **REAL** | Fully functional exam management. |
| **Homeworks List & CRUD** | `/api/homework` | `homeworkService.*` | **REAL** | Fully functional homework management. |
| **Exam Anti-Cheat Settings** | `/api/exams` (`requiresCamera`, `allowedIps`) | `exam.controller.ts` | **REAL** | Stored in Prisma `Exam` table. |
| **Question Bank CRUD** | `/api/questions` | `questionService.*` | **REAL** | Real database question banking. |
| **AI Math Question Generator** | `/api/ai/generate-questions` | `aiApi` | **REAL** | Real generation with KaTeX preview. |
| **Submission Review & Grading** | `/api/exams/:id/results`, `/api/homework/:id/submissions` | `AssessmentReviewPage` | **REAL** | Real submission answer review and grading. |

---

### E. AI Tools Page Data (`/teacher/ai`)

| Tool / Element | Source | Status | Audit Findings & Recommended Handling |
| :--- | :--- | :---: | :--- |
| **AI Chat & Session Statistics** | `GET /api/analytics/ai-stats` | **REAL** | Real count of `chatMessage` and `chatSession` records from DB. |
| **Recent Student Chat Sessions** | `aiStats.conversations` | **REAL** | Real recent student chat sessions. |
| **Smart Homework Generator** (`solver`) | `aiService.generateQuestions` | **REAL** | Real AI generation and batch question save to bank. |
| **Adaptive Learning Paths** (`path`) | Client dummy chat | **MOCKED** | Canned response string. **Remedy: Clearly mark as upcoming or consolidate into AI generator**. |
| **Content Generation** (`content`) | Client dummy chat | **MOCKED** | Canned response string. **Remedy: Clearly mark as upcoming or consolidate**. |
| **AI Assistant Monitor** (`chat`) | Client dummy chat | **MOCKED** | Canned response string. **Remedy: Retain real session monitor from `aiStats`**. |

---

### F. Teacher Profile Page Data (`/teacher/profile`)

| Field | Source | Status | Audit Findings & Recommended Handling |
| :--- | :--- | :---: | :--- |
| **Name & Email** | `user` context & `GET /api/profile` | **REAL** | Real teacher identity. Preserve. |
| **Profile Update** | `PUT /api/users/:id` | **REAL** | Working database update. Preserve. |
| **Course & Student Stats** | `res.data.overview.*` | **BROKEN** | Reads `res.data.overview.totalCourses`. `overview` is undefined because API returns `res.data.totalCourses` at root. **Remedy: Fix property access**. |
| **Rating (٤.٩) & Award Badges** | Hardcoded | **MOCKED** | Fabricated rating and fake award (`أفضل معلم ٢٠٢٦`). **Remedy: Remove fabricated awards, display verified account status**. |

---

## 3. Data Integrity Enforcement Rules for Phase 5.3 Redesign

1. **Zero Mock Arrays in Analytics:**
   All hardcoded mock data in `TeacherAnalyticsPage.tsx` (`monthlyTrend`, `subjectRadar`, `homeworkCompletion`, `predictions`) must be purged. Only data backed by verified database queries may be rendered.
2. **Accurate KPI Labeling:**
   - Exam score averages must be titled `"متوسط درجات التقييمات"` and displayed as a raw score without appending a deceptive `%` symbol.
   - When no exams have been taken (`attemptCount === 0`), the dashboard must display `'—'` rather than `0%` or `undefined%`.
3. **Broken Field Corrections:**
   - Update `TeacherHomePage.tsx` to read `averageScore` and `strugglingStudents`.
   - Update `TeacherProfilePage.tsx` to read `res.data.totalCourses` and `res.data.totalStudents`.
4. **Action Link Integrity:**
   Every button displayed must perform a real navigation or state change. Non-functional decorative buttons ("عرض الملف", "تصدير PDF") must be wired to real targets or clearly labeled.
