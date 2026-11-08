# OX-DIGITAL Education — Phase 5.4
# Student Center Dashboard: Comprehensive Read-Only Audit

**Repository**: `D:\OX-DIGITAL\Mathe\OX-DIGITAL-GITHUB`  
**Date**: November 1, 2026  
**Auditor**: Antigravity Core Agent  
**Target Module**: Student Center Dashboard (`apps/frontend/src/app/components/student-center`)  
**Role Guard**: `CENTER_STUDENT`  

---

## 1. Executive Summary

The Student Center Dashboard provides academic tracking, course access, attendance auditing, exam participation, and educational support for in-center students within the OX-DIGITAL Education platform. 

Following the successful completion of the **Admin Dashboard (Phase 5.1)**, **Parent Dashboard (Phase 5.2)**, and **Online Student Dashboard (Phase 5.3)**, this audit evaluates the current architecture, data flows, UI consistency, route configurations, and testing coverage of the Student Center Dashboard to prepare a zero-regression, institutional-grade implementation plan.

---

## 2. Route Configuration & Access Protection

### 2.1 Route Guard
- In `apps/frontend/src/app/App.tsx` (lines 54–57):
  ```tsx
  {/* Student Center Dashboard */}
  <Route element={<ProtectedRoute allowedRoles={['CENTER_STUDENT']} />}>
    <Route path="/student/center/*" element={<StudentCenterDashboard />} />
  </Route>
  ```
- **Authentication**: JWT token verification managed via `AuthContext` and Axios interceptor in `api.ts`.
- **Role Enforcement**: Only users with `role: 'CENTER_STUDENT'` are permitted. Unauthorized roles or unauthenticated users are redirected to `/login`.

### 2.2 Sub-Routes in `StudentCenterDashboard.tsx`
| Path | Component | Source File | Status / Finding |
| :--- | :--- | :--- | :--- |
| `/student/center/` | `<Navigate to="home" />` | — | Redirects to home |
| `/student/center/home` | `<StudentHomePage />` | `student-center/StudentHomePage.tsx` | Active; requires contract alignment & visual redesign |
| `/student/center/courses` | `<CoursesPage />` | `student-center/CoursesPage.tsx` | Active; unthrottled polling, requires color token update |
| `/student/center/courses/:courseId` | `<CourseDetailsPage />` | `student-center/CourseDetailsPage.tsx` | Active; tested in `CourseStatistics.test.tsx` |
| `/student/center/videos/:videoId` | `<VideoPlayerPage />` | `student-center/VideoPlayerPage.tsx` | Active; `backUrl` points to unrouted `/student/center/lessons` |
| `/student/center/homework` | `<HomeworkPage />` | `student-shared/HomeworkPage.tsx` | Active; shared with Online Student (verified in Phase 5.3) |
| `/student/center/exams` | `<ExamsPage />` | `student-shared/ExamsPage.tsx` | Active; shared with Online Student (verified in Phase 5.3) |
| `/student/center/results` | `<ResultsPage />` | `student-center/ResultsPage.tsx` | Active; has contract mismatch with `/analytics/student/charts` |
| `/student/center/solver` | `<AIMathSolverPage />` | `ai/AIMathSolverPage.tsx` | Active; shared AI tool |
| `/student/center/learning-path` | `<AdaptiveLearningPage />` | `ai/AdaptiveLearningPage.tsx` | Active; honest transparency notice verified in Phase 5.3 |
| `/student/center/chatbot` | `<ChatbotPage />` | `student-shared/ChatbotPage.tsx` | Active; shared chatbot |
| `/student/center/attendance` | `<AttendancePage />` | `student-center/AttendancePage.tsx` | **Unique to Center Students**; tracks physical center sessions |
| `/student/center/profile` | `<ProfilePage />` | `student-shared/ProfilePage.tsx` | Active; shared profile component |
| `/student/center/assessment/:id/review/:attemptId` | `<AssessmentReviewPage />` | `pages/AssessmentReviewPage.tsx` | **Missing Route**: navigated from `ResultsPage.tsx` but not registered |

---

## 3. Detailed Component & Feature Audit

### 3.1 Shell & Layout (`StudentCenterDashboard.tsx`)
- **Branding**: Currently configured with title `"منصة طالب السنتر"` and legacy green color preset (`accentColor="green"`, `gradientFrom="green-600"`, `gradientTo="emerald-600"`).
- **Redesign Requirement**: Must align with OX-DIGITAL Education institutional tokens:
  - `title="OX-DIGITAL Education"`
  - `subtitle={profileName ? `طالب السنتر: ${profileName}` : 'منظومة التعلم الأكاديمي الميداني'}`
  - `accentColor="crimson"`
  - `gradientFrom="academic-crimson"`
  - `gradientTo="academic-crimson"`
- **Lifecycle & Background Polling**:
  - Currently triggers `homeworkService.getHomeworks()` once on mount.
  - Lacks visibility throttling and periodic badge refresh.
  - Recommended: Adopt visibility-aware background polling (`setInterval(..., 30000)` with `document.hidden` guards and `visibilitychange` listener), matching `StudentOnlineDashboard.tsx`.

### 3.2 Student Home Page (`StudentHomePage.tsx`)
- **Data Ingestion**:
  - Calls `analyticsService.getStudentOverview()` and `courseService.getCourses()`.
  - Expects `overview.coursesEnrolled`, `overview.lessonsCompleted`, `overview.examsCompleted`, `overview.overallRate`, and `overview.lastWatchedLesson`.
- **API Mismatch**:
  - `GET /api/analytics/student/overview` actually returns `{ gpa, attendanceRate, completedAssignments, rank }`.
  - Course-level counters (`enrolledCoursesCount`, `totalLessons`, `completedLessons`, `completionPercentage`) are provided by `GET /api/courses/student/stats` (`courseService.getStudentCourseStats()`).
  - Without invoking `courseService.getStudentCourseStats()`, course KPIs fallback to 0.
- **Center Attendance Highlight**:
  - Center students need their attendance rate immediately visible on the home dashboard (from `overview.attendanceRate` and `userService.getAttendance()`).
- **Continue Learning Hero**:
  - `overview.lastWatchedLesson` is undefined in the backend response. The active lesson must be derived from enrolled courses and lesson progress records.
- **Error Handling**: Currently lacks user-visible retry banner upon network failure.

### 3.3 Center Attendance Page (`AttendancePage.tsx`)
- **Role Specificity**: This page is unique to center students.
- **Endpoint**: `userService.getAttendance()` -> `GET /api/attendance/my-attendance`.
- **Backend Contract**:
  - Returns `{ data: records, summary: { totalSessions, presentCount, absentCount, lateCount, percentage } }`.
  - Record structure: `{ id, studentId, status: 'PRESENT' | 'ABSENT' | 'LATE', date, notes, createdAt }`.
- **Findings**:
  - The component already handles both `{ data, summary }` object responses and raw record arrays with fallback calculation.
  - Correctly reflects semantic attendance where `LATE` counts towards attended percentage `(present + late) / total`.
  - UI uses generic gray/green/amber styling that needs uplifting to deep obsidian and institutional crimson tokens.

### 3.4 Courses & Details (`CoursesPage.tsx` & `CourseDetailsPage.tsx`)
- **CoursesPage**:
  - Dual tabs: `my_courses` (enrolled) and `available_courses` (catalog).
  - Background polling runs every 10 seconds unconditionally (`setInterval`), consuming unnecessary requests when the browser tab is hidden. Must be wrapped in `document.hidden` check.
  - Card styles use legacy indigo colors (`bg-indigo-600`); needs redesign to institutional crimson.
- **CourseDetailsPage**:
  - Dynamic KPI cards: `totalLessons`, `completedLessons`, `completionPercentage`.
  - Correctly verified by `CourseStatistics.test.tsx`.
  - Navigates to `/student/center/videos/${lesson.id}`.

### 3.5 Video Player (`VideoPlayerPage.tsx`)
- Integrates `<UnifiedVideoPlayer />` in `mode="center"`.
- **Defect Identified**: `backUrl` is hardcoded to `/student/center/lessons`. This route does not exist in `StudentCenterDashboard.tsx`, resulting in an empty/broken route when clicking the back button.
- **Correction**: Set `backUrl="/student/center/courses"`.

### 3.6 Academic Results & Reports (`ResultsPage.tsx`)
- **Endpoints**:
  - `analyticsService.getStudentOverview()`
  - `analyticsService.getStudentCharts()`
  - `analyticsService.getStudentRecent()`
- **Defects Identified**:
  - Expects `overview.overallRate` (API returns `gpa`).
  - Expects `charts.examResults` and `charts.homeworkResults` (API returns `performanceData: [{ month, score }]` and `subjectProgress: [{ subject, progress }]`).
  - Expects review link `/student/center/assessment/:id/review/:attemptId`, but this route is not registered in `StudentCenterDashboard.tsx`.
- **Correction**: Map real data shapes and register `<AssessmentReviewPage />` in `StudentCenterDashboard.tsx`.

### 3.7 Orphaned Files in Directory
- `LessonsPage.tsx` and `VideosPage.tsx` exist in `apps/frontend/src/app/components/student-center/`, but are NOT imported or routed anywhere.
- `CourseStatistics.test.tsx` specifically verifies that "الدروس والفيديوهات" does not exist in the Student Center menu.
- **Action**: Retain files without modification to prevent touching any unexpected references.

---

## 4. API Endpoints & Contract Inventory

| Service / Hook | HTTP Route | Backend Service | Actual Response Contract |
| :--- | :--- | :--- | :--- |
| `userService.getProfile()` | `GET /api/users/profile` | `user-service` | `{ id, name, email, role, phone, ... }` |
| `userService.getAttendance()` | `GET /api/attendance/my-attendance` | `user-service` | `{ data: AttendanceRecord[], summary: { totalSessions, presentCount, absentCount, lateCount, percentage } }` |
| `courseService.getCourses()` | `GET /api/courses` | `course-service` | `{ data: Course[] }` or `Course[]` |
| `courseService.getAvailableCourses()` | `GET /api/courses/available` | `course-service` | `{ data: Course[] }` or `Course[]` |
| `courseService.getCourseDetails(id)` | `GET /api/courses/:id` | `course-service` | `{ data: CourseDetails }` |
| `courseService.getStudentCourseStats()` | `GET /api/courses/student/stats` | `course-service` | `{ enrolledCoursesCount, totalLessons, completedLessons, completionPercentage }` |
| `courseService.enrollCourse(id)` | `POST /api/courses/:id/enroll` | `course-service` | `{ message: string, enrollment: ... }` |
| `analyticsService.getStudentOverview()` | `GET /api/analytics/student/overview` | `analytics-service` | `{ gpa, attendanceRate, completedAssignments, rank }` |
| `analyticsService.getStudentCharts()` | `GET /api/analytics/student/charts` | `analytics-service` | `{ performanceData: [{ month, score }], subjectProgress: [{ subject, progress }] }` |
| `analyticsService.getStudentRecent()` | `GET /api/analytics/student/recent` | `analytics-service` | `RecentResult[]` (`id, assessmentId, title, type, score, date, status`) |
| `homeworkService.getHomeworks()` | `GET /api/homework` | `exam-service` | `{ data: Homework[] }` or `Homework[]` |

---

## 5. Visual & Design System Alignment

| Element | Current State | Required Institutional OX-DIGITAL Standard |
| :--- | :--- | :--- |
| **Brand Identity** | "منصة طالب السنتر" | "OX-DIGITAL Education" |
| **Subtitle** | Plain user name | `طالب السنتر: ${name}` / Academic Center Platform |
| **Color Palette** | Green (`green-600`, `emerald-600`) & Indigo | Deep Obsidian (`#090b10`), Slate (`#0f131d`), Crimson (`#9e1b1b`) |
| **Accent Preset** | `accentColor="green"` | `accentColor="crimson"` (`academic-crimson`) |
| **Typography** | Generic Sans | Cairo / Tajawal with strict Arabic RTL hierarchy |
| **Card Surfaces** | White / Tailwind Gray-800 | Light: `bg-white border-slate-200/90 shadow-xs`<br>Dark: `bg-[#0f131d] border-slate-800/90` |
| **Hero Card** | Indigo/Blue Gradient | Obsidian foundation with Crimson badge & Ivory text |
| **Attendance Chips** | Generic Tailwind badge classes | High-contrast status badges (Present: Emerald, Late: Amber, Absent: Rose) |

---

## 6. Pre-existing Test Suite Verification

A full baseline test run was executed prior to any modifications:
- **Test Command**: `vitest run --run` in `apps/frontend`
- **Result**: **19 test files passed (19/19)**, **156 tests passed (156/156)**
- **Baseline Duration**: 53.55s
- **Pre-existing Failures**: 0

The existing suite includes `CourseStatistics.test.tsx`, which specifically asserts that:
1. `CourseDetailsPageCenter` handles 0 lessons safely (`0%`).
2. `StudentCenterDashboard` renders `دوراتي` and does NOT render `الدروس والفيديوهات`.

---

## 7. Audit Conclusion & Risks

1. **Risk of API Mismatches**: `StudentHomePage` and `ResultsPage` currently query endpoints for properties that do not exist (`overallRate`, `examResults`). Correcting these bindings to match `courseService.getStudentCourseStats()` and `analyticsService` will ensure authentic, live data displays.
2. **Unthrottled Polling**: Background intervals in `CoursesPage` and `StudentCenterDashboard` must incorporate visibility guards to prevent tab lag and server strain.
3. **Broken Navigation in Video & Review**:
   - `VideoPlayerPage` back button points to `/student/center/lessons`.
   - `ResultsPage` review button links to `/student/center/assessment/:id/review/:attemptId` which is not routed.
   Both will be resolved cleanly within `apps/frontend`.
4. **Preservation of Proctoring & Shared Workflows**: The student proctoring, exam timers, homework submissions, and AI tools will remain 100% intact.

