# OX-DIGITAL Education — Phase 5.3 Teacher Dashboard Remediation & Redesign Execution Plan

**Date:** October 28, 2026  
**Target:** Teacher Dashboard & Related Teacher Pages (`/teacher/*`)  
**Authorized Project Root:** `D:\OX-DIGITAL\Mathe\Mathteachersmartplatform-main`  
**Execution Mode:** Controlled Frontend-Only Remediation & Verification  
**Gate:** Mandatory Pre-Implementation Execution Plan (Gate A)

---

## 1. Exact Pages, Components, Services & Tests to Change

| # | File / Component | Purpose of Change |
| :- | :--- | :--- |
| 1 | `apps/frontend/src/app/components/teacher/TeacherDashboard.tsx` | Redesign shell with institutional crimson tokens (`#9e1b1b`), update title to `"OX-DIGITAL Education"`, bind real unread notification counter badge to sidebar, register `/teacher/notifications` route. |
| 2 | `apps/frontend/src/app/components/teacher/TeacherHomePage.tsx` | Fix KPI field mappings (`totalStudents`, `totalCourses`, raw `averageScore`, `strugglingStudents`), remove empty weekly chart, wire at-risk buttons (`عرض الملف`), adopt deep obsidian/charcoal theme. |
| 3 | `apps/frontend/src/app/components/teacher/TeacherAnalyticsPage.tsx` | Purge all 4 hardcoded mock arrays (`monthlyTrend`, `subjectRadar`, `homeworkCompletion`, `predictions`), render real course metrics from `getTeacherAnalytics`, disable/replace dead PDF export with honest state. |
| 4 | `apps/frontend/src/app/components/teacher/TeacherProfilePage.tsx` | Correct data extraction path (read `res.data.totalCourses` / `res.data.totalStudents`), remove fabricated rating (`٤.٩`) and fake awards, style with institutional tokens. |
| 5 | `apps/frontend/src/app/components/teacher/TeacherNotificationsPage.tsx` | Create dedicated teacher notification view using verified `notificationService` (`getNotifications`, `markAsRead`), unread filtering, and empty state. |
| 6 | `apps/frontend/src/app/components/teacher/TeacherAttendancePage.tsx` | Apply OX-DIGITAL dark/light institutional styling while strictly preserving all existing group toggles, Egyptian grade ordering, and batch save logic. |
| 7 | `apps/frontend/src/app/components/teacher/TeacherStudentsPage.tsx` | Apply institutional styling to student roster table and cards, maintain search, CSV export, and navigation to student reports. |
| 8 | `apps/frontend/src/app/components/teacher/StudentReportPage.tsx` | Refresh single student report layout with institutional crimson tokens, verified exam attempts, homework submissions, and video analytics. |
| 9 | `apps/frontend/src/app/components/teacher/TeacherCoursesPage.tsx` | Apply institutional styling to course grid and lesson authoring modal; clarify supported video sources (Drive/YouTube). |
| 10 | `apps/frontend/src/app/components/teacher/TeacherExamsPage.tsx` | Refresh unified exam/homework table, anti-cheat indicators, question builder, and results view with institutional theme classes. |
| 11 | `apps/frontend/src/app/components/teacher/TeacherQuestionBankPage.tsx` | Polish question bank styling with KaTeX math formula rendering and AI question generator. |
| 12 | `apps/frontend/src/app/components/teacher/TeacherAIPage.tsx` | Polish smart homework generator with KaTeX preview and batch bank save; clearly state available tools and render real AI session metrics. |
| 13 | `apps/frontend/src/app/test/TeacherDashboard.test.tsx` | Author comprehensive automated test suite (10 unit tests) covering RBAC, shell, KPIs, empty fallbacks, at-risk links, attendance, notifications, and theme. |

---

## 2. Confirmed Defects & Frontend-Only Remediation

1. **Card 2 & 4 Field Mismatches on Home Page:**
   - *Defect:* `summaryStats.activeStudents` and `summaryStats.avgExamScore + '%'` render `undefined` and `undefined%`.
   - *Remediation:* Map Card 2 to `overview.totalCourses` and Card 4 to `overview.averageScore` (raw numeric score or `'—'`). Card 3 displays `overview.strugglingStudents` (students < 50%).
2. **Missing Backend Data for Home Chart:**
   - *Defect:* `overview?.weeklyProgress` is not calculated or returned by the backend; chart is permanently empty.
   - *Remediation:* Replace the missing weekly chart with verified `subjectPerformance` bar chart and `distributionData` pie chart.
3. **Dead Action Buttons:**
   - *Defect:* "عرض الكل" and "عرض الملف" in the At-Risk container have no `onClick` handlers.
   - *Remediation:* Wire "عرض الملف" to navigate to `/teacher/students/:id`. Wire "عرض الكل" to navigate to `/teacher/students?filter=risk`.
4. **Pervasive Mock Data in Analytics:**
   - *Defect:* `monthlyTrend`, `subjectRadar`, `homeworkCompletion`, and `predictions` are static fake arrays.
   - *Remediation:* Purge all 4 mock arrays completely. Display verified metrics from `getTeacherAnalytics` (`totalStudents`, `averageScore`, `totalCourses`, `strugglingStudents`, `subjectPerformance`, `distributionData`).
5. **Teacher Profile Broken Stats & Fake Badges:**
   - *Defect:* Code expects `res.data.overview.totalCourses`; `overview` is undefined so stats show 0. Displays fake rating `٤.٩` and fake badge `أفضل معلم ٢٠٢٦`.
   - *Remediation:* Extract stats directly from `res.data.totalCourses` and `res.data.totalStudents`. Purge fake rating and award badge.

---

## 3. Real Data Sources & Calculation Rules for Retained KPIs

| KPI Label | Endpoint / Source | Response Field | Underlying Database Model | Display Rule |
| :--- | :--- | :--- | :--- | :--- |
| **إجمالي الطلاب** | `GET /api/analytics/teacher/:id/overview` | `totalStudents` | `CourseEnrollment` count across teacher courses | Render integer; `'—'` if null. |
| **المقررات الدراسية** | `GET /api/analytics/teacher/:id/overview` | `totalCourses` | `Course` count for `teacherId` | Render integer; `'—'` if null. |
| **متوسط درجات التقييمات** | `GET /api/analytics/teacher/:id/overview` | `averageScore` | `ExamAttempt.score` average across course exams | Render raw score (e.g. `78`), NO `%`; `'—'` if 0 attempts. |
| **طلاب بحاجة لمتابعة** | `GET /api/analytics/teacher/:id/overview` | `strugglingStudents` | Students with average < 50% | Render integer; amber badge if > 0. |
| **الطلاب الأكثر عرضة للخطر** | `GET /api/analytics/risk` | `riskStudents` | `User`, `ExamAttempt`, `Submission` | Render real student list with risk score and reasons. |
| **سجل الحضور** | `GET /api/attendance/date/:date` | `records` | `Attendance` | `PRESENT`, `LATE`, `ABSENT` real session counts. |

---

## 4. Unsupported Charts, Controls & Features to Remove

1. **Remove `weeklyProgress` AreaChart:** Backend provides no data; removed and replaced with genuine `subjectPerformance`.
2. **Remove `monthlyTrend` AreaChart:** 100% hardcoded mock data; removed.
3. **Remove `subjectRadar` RadarChart:** Hardcoded mock data; removed.
4. **Remove `homeworkCompletion` BarChart:** Hardcoded mock data; removed.
5. **Remove `predictions` Table:** Fake Egyptian students; removed and replaced with real `riskStudents` table.
6. **Remove Fake Awards (`TeacherProfilePage`):** Purged `أفضل معلم ٢٠٢٦` and fake `٤.٩` rating.
7. **Dead PDF Export Button:** Replaced with functional browser print preview (`window.print()`) or clearly disabled state.

---

## 5. Notification Service & Route Verification Results

- **Backend Verification:**
  - `GET /api/notifications` is fully implemented in `services/user-service/src/controllers/notification.controller.ts:L20-L51` and scoped to `req.user.userId`.
  - `GET /api/notifications/unread-count` returns `{ unreadCount: number }` for the authenticated user.
  - `PUT /api/notifications/:id/read` marks individual notifications as read.
  - The platform already sends notifications to teachers when students submit exams (`notifyTeacher(exam.courseId, ...)`).
- **Frontend Verification:**
  - `apps/frontend/src/app/services/notification.service.ts` provides `getNotifications()`, `getUnreadCount()`, and `markAsRead()`.
- **Conclusion:** **Teacher notifications are genuinely supported by existing contracts.**
  - Action: Add `TeacherNotificationsPage.tsx` at `/teacher/notifications` and bind unread count badge to sidebar.

---

## 6. Regression Tests & Acceptance Criteria

### Test Suite: `apps/frontend/src/app/test/TeacherDashboard.test.tsx`
1. **Test 1:** Role-based access control allows `TEACHER` and denies unauthorized roles.
2. **Test 2:** Institutional shell renders `"OX-DIGITAL Education"` title, teacher name, and crimson accents.
3. **Test 3:** Verified KPIs render accurately (`totalStudents`, `totalCourses`, `averageScore`, `strugglingStudents`) without `undefined` or `undefined%`.
4. **Test 4:** Empty academic dataset displays fallback `'—'` rather than `0%` or `NaN`.
5. **Test 5:** Live at-risk students list renders real data with working profile navigation button.
6. **Test 6:** Attendance page renders group selection and updates attendance status.
7. **Test 7:** Unread notification counter badge renders on the teacher sidebar when unread > 0.
8. **Test 8:** Error alert with retry button renders when analytics API fails.
9. **Test 9:** Light/Dark theme switching applies correct background classes (`bg-[#090b10]` vs `bg-slate-50`).
10. **Test 10:** Arabic RTL layout and date formatting render with `dir="rtl"`.

### Acceptance Criteria
- Full test suite passes: `npx vitest run src/app/test/TeacherDashboard.test.tsx` (10/10 tests).
- All existing 39 tests across 6 prior test files continue to pass (49/49 tests total).
- TypeScript check (`npx tsc --noEmit`) passes with 0 errors.
- Production build (`npm run build`) succeeds with 0 errors.

---

## 7. Risks, Dependencies & Rollback Approach

- **Risks:**
  - Inconsistent return formats between `res.data` and `res.data.data` in API responses: addressed via defensive array checks (`Array.isArray(res.data?.data) ? res.data.data : Array.isArray(res.data) ? res.data : []`).
  - Missing property crashes on undefined fields: addressed with optional chaining (`?.`) and explicit fallbacks (`?? '—'`).
- **Dependencies:**
  - Strictly zero new dependencies. All icons (`lucide-react`), charts (`recharts`), math (`KaTeX`), and routing (`react-router-dom`) leverage existing packages.
- **Rollback Approach:**
  - In the event of a blocking defect during development, each modified file can be reverted cleanly using version history or git checkout on specific files without touching unrelated admin or parent code.
