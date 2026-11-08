# OX-DIGITAL Education — Phase 5.3 Online Student Dashboard Implementation Plan
## Academic Precision & Digital Mastery

- **Date:** November 1, 2026
- **Status:** **PLANNING ONLY (AWAITING USER APPROVAL PRIOR TO IMPLEMENTATION)**
- **Target Experience:** Online Student Dashboard (`/student/online/*`)
- **Authorized Workspace:** `D:\OX-DIGITAL\Mathe\OX-DIGITAL-GITHUB`
- **Execution Mode:** Multi-Stage Controlled Implementation with Verification Gates

---

## 1. Scope Boundaries & Non-Negotiable Constraints

### Strict Isolation Rules
1. **Frontend-Only Execution:** All changes are strictly confined to the authorized GitHub clone frontend (`apps/frontend/src/...`).
2. **Zero Backend Modifications:** Backend services (`auth-service`, `user-service`, `course-service`, `ai-service`, `analytics-service`, `video-worker`) are strictly preserved.
3. **Zero Database Modifications:** No Prisma schema changes, migrations, seeds, or direct SQL commands will be executed.
4. **Preservation of Completed Dashboards:** Admin (`/admin/*`), Teacher (`/teacher/*`), and Parent (`/parent/*`) dashboards are 100% frozen.
5. **Preservation of Core Learning Engines:**
   - `<UnifiedVideoPlayer />` streaming, HLS transcode playback, and in-video quiz engines are strictly preserved.
   - `<ExamsPage />` proctoring, camera streams, timer sync, and anti-cheat multi-tab detection are strictly preserved.
   - `<HomeworkPage />` submission payloads and score normalizers are strictly preserved.
6. **No Fake Data:** All displayed metrics must map to verified API endpoints.

---

## 2. File Inventory & Modification Roster

### A. Files Targeted for Redesign & Remediation

| # | File Path | Scope of Modification |
| :- | :--- | :--- |
| 1 | `apps/frontend/src/app/components/student-online/StudentOnlineDashboard.tsx` | **Shell Reskin:** Connect to `academic-crimson` layout preset, update brand title, add document-visibility check to homework polling loop. |
| 2 | `apps/frontend/src/app/components/student-online/StudentHomePage.tsx` | **Complete Redesign:** Resolve contract mismatches; aggregate real data from `courseService.getStudentCourseStats()`, `analyticsService.getStudentOverview()`, `courseService.getCourses()`, and `analyticsService.getStudentRecent()`; render "Continue Learning" hero; add retryable error state. |
| 3 | `apps/frontend/src/app/components/student-online/CoursesPage.tsx` | **Visual Polish & Throttling:** Re-skin with `#090b10` / `#0f131d` / crimson tokens, throttle polling interval with document visibility check, improve empty states. |
| 4 | `apps/frontend/src/app/components/student-online/CourseDetailsPage.tsx` | **Visual Polish:** Align course header, lesson items, progress badges, and navigation buttons to Academic Precision tokens. |
| 5 | `apps/frontend/src/app/components/student-online/ResultsPage.tsx` | **Contract Remediation:** Map real `performanceData` and `subjectProgress` from `getStudentCharts()`, map `getStudentOverview()` and `getStudentRecent()`, style crimson charts, preserve PDF export. |
| 6 | `apps/frontend/src/app/components/ai/AdaptiveLearningPage.tsx` | **Mock Data Remediation:** Replace hardcoded fake grades with authentic subject progress from `getStudentCharts()`, provide honest academic status notice. |
| 7 | `apps/frontend/src/app/components/student-shared/HomeworkPage.tsx` | **Visual Styling Alignment:** Re-skin container and buttons to match institutional crimson and obsidian tokens; preserve submission logic. |
| 8 | `apps/frontend/src/app/components/student-shared/ExamsPage.tsx` | **Visual Polish Only:** Align surrounding headers and buttons to institutional palette; preserve anti-cheat and proctoring logic untouched. |
| 9 | `apps/frontend/src/app/test/StudentOnlineDashboard.test.tsx` | **New Test Suite:** Comprehensive Vitest unit tests verifying student shell rendering, real API data mapping, and empty/error states. |

### B. Files Strictly Preserved As-Is (No Modifications)

- `apps/frontend/src/app/components/student-online/VideoPlayerPage.tsx` (Encapsulates video player).
- `apps/frontend/src/app/components/video/UnifiedVideoPlayer.tsx` (Core streaming player).
- `apps/frontend/src/app/hooks/useExamAntiCheat.ts` (Anti-cheat security hook).
- `apps/frontend/src/app/utils/assessmentResultNormalizer.ts` (Assessment grading normalizer).
- `apps/frontend/src/app/components/student-shared/ChatbotPage.tsx` (AI chat tutor).
- `apps/frontend/src/app/components/ai/AIMathSolverPage.tsx` (AI math solver).
- `apps/frontend/src/app/components/student-shared/ProfilePage.tsx` (Student profile).

---

## 3. Step-by-Step Implementation Sequence

```
+-------------------------------------------------------------------------------+
| STAGE 1: Dashboard Shell & Navigation Alignment                               |
| File: StudentOnlineDashboard.tsx                                              |
| - Switch preset to academic-crimson                                           |
| - Throttle homework badge polling with document.hidden guard                  |
| - Brand header: "OX-DIGITAL Education"                                        |
+-------------------------------------------------------------------------------+
                                    |
                                    v
+-------------------------------------------------------------------------------+
| STAGE 2: Student Home Page Redesign & Data Remediation                        |
| File: StudentHomePage.tsx                                                     |
| - Aggregate real data: getStudentCourseStats, getStudentOverview,             |
|   getCourses, getStudentRecent, getHomeworks                                  |
| - Derive authentic "Continue Learning" lesson from enrolled course progress   |
| - Render 4 verified KPI cards with tabular typography                         |
| - Render split section: Upcoming Assessments & Recent Performance Stream      |
| - Add LoadingState skeleton and retryable error banner                        |
+-------------------------------------------------------------------------------+
                                    |
                                    v
+-------------------------------------------------------------------------------+
| STAGE 3: Courses & Course Details Alignment                                   |
| Files: CoursesPage.tsx, CourseDetailsPage.tsx                                 |
| - Re-skin dual-tab bar with institutional crimson active indicators           |
| - Throttle 10s polling loop with document.hidden guard                        |
| - Align lesson item rows, completed pills, and progress bars                  |
+-------------------------------------------------------------------------------+
                                    |
                                    v
+-------------------------------------------------------------------------------+
| STAGE 4: Academic Results & Charts Remediation                                |
| File: ResultsPage.tsx                                                         |
| - Wire performanceData to monthly progress BarChart                           |
| - Wire subjectProgress to subject mastery breakdown                           |
| - Wire recentResults from getStudentRecent()                                  |
| - Style charts with institutional crimson bars, neutral grid, and RTL tooltips|
+-------------------------------------------------------------------------------+
                                    |
                                    v
+-------------------------------------------------------------------------------+
| STAGE 5: Adaptive Learning Remediation                                        |
| File: AdaptiveLearningPage.tsx                                                |
| - Purge fabricated hardcoded mock grades (92%, 78%, 65%)                       |
| - Present honest subject mastery derived from real student attempts           |
| - Honest "قيد التطوير الأكاديمي" indicator for unbacked dynamic paths         |
+-------------------------------------------------------------------------------+
                                    |
                                    v
+-------------------------------------------------------------------------------+
| STAGE 6: Visual Harmony for Shared Assessment Pages                           |
| Files: HomeworkPage.tsx, ExamsPage.tsx                                        |
| - Gentle visual skinning to match deep obsidian and crimson tokens            |
| - Zero disruption to camera, anti-cheat, or submission logic                  |
+-------------------------------------------------------------------------------+
                                    |
                                    v
+-------------------------------------------------------------------------------+
| STAGE 7: Verification & Automated Testing                                     |
| File: StudentOnlineDashboard.test.tsx                                         |
| - Author dedicated unit tests for student dashboard                           |
| - Run npm run test across entire frontend suite (expect 145+ pass)            |
| - Run npm run build to verify zero TypeScript or bundle regressions           |
+-------------------------------------------------------------------------------+
```

---

## 4. Detailed Component Technical Specifications

### A. Stage 1: `StudentOnlineDashboard.tsx`
```tsx
<SharedLayout
  menuItems={dynamicMenuItems}
  title="OX-DIGITAL Education"
  subtitle={profileName ? `الطالب: ${profileName}` : 'منظومة التعلم الأكاديمي'}
  accentColor="crimson"
  gradientFrom="academic-crimson"
  gradientTo="academic-crimson"
  logoutPath="/login"
>
```
**Polling Optimization:**
```ts
const fetchHomeworkCount = () => {
  if (typeof document !== 'undefined' && document.hidden) return;
  homeworkService.getHomeworks().then(...).catch(...);
};
```

### B. Stage 2: `StudentHomePage.tsx`
**Real Data Fetching Protocol:**
```ts
const [courseStatsRes, overviewRes, coursesRes, recentRes, homeworksRes] = await Promise.all([
  courseService.getStudentCourseStats().catch(() => ({ data: null })),
  analyticsService.getStudentOverview().catch(() => ({ data: null })),
  courseService.getCourses().catch(() => ({ data: [] })),
  analyticsService.getStudentRecent().catch(() => ({ data: [] })),
  homeworkService.getHomeworks().catch(() => ({ data: [] })),
]);
```
**Continue Learning Derivation:**
- Iterate enrolled `coursesRes.data`.
- For each course, inspect `lessons`.
- Identify the lesson with `progress.progress > 0 && progress.progress < 100`, or the first uncompleted lesson of the most recently accessed course.
- Construct honest `{ lessonId, lessonTitle, courseName, progress }`.

**4 Verified KPI Cards:**
1. **المقررات الدراسية** (`courseStats.enrolledCoursesCount || courses.length`)
2. **الدروس المنجزة** (`${courseStats.completedLessons} / ${courseStats.totalLessons}`)
3. **نسبة الإنجاز** (`${courseStats.completionPercentage}%`)
4. **المهام المكتملة** (`overview.completedAssignments || recentSubmissions.length`)

---

## 5. Accessibility (a11y) & Responsive Strategy

1. **RTL Semantics:**
   - Explicit `dir="rtl"` root container.
   - Natural Arabic text flow (`text-right`), mirrored flex layouts, and bidirectional spacing (`ms-*`, `me-*`, `pe-*`, `ps-*`).
2. **Keyboard Navigation & ARIA:**
   - Tabs equipped with `role="tablist"` and `role="tab"` with `aria-selected`.
   - Modals trap focus and allow `Escape` to close.
3. **Responsive Breakpoints:**
   - **Mobile (`< 640px`):** Single column stack, compact stat badges (2x2 grid), horizontally scrollable tabs.
   - **Tablet (`640px – 1024px`):** 2-column KPI grid, stacked assessment / performance sections.
   - **Desktop (`≥ 1024px`):** 4-column KPI row, side-by-side priority column and recent activity stream.

---

## 6. Verification & Automated Testing Plan

### 1. Dedicated Test Suite (`apps/frontend/src/app/test/StudentOnlineDashboard.test.tsx`)
- **Test Case 1: Dashboard Shell Mounting:** Verifies that `SharedLayout` renders with institutional title `"OX-DIGITAL Education"` and proper navigation links.
- **Test Case 2: Real KPI Mapping:** Verifies that `courseStats` and `analyticsOverview` correctly populate stat card numbers without rendering `undefined` or `NaN`.
- **Test Case 3: Continue Learning Display:** Verifies that an in-progress lesson renders with lesson title, course title, and accurate progress percentage.
- **Test Case 4: Empty State Graceful Handling:** Verifies that when a student has 0 courses and 0 submissions, honest, encouraging empty states render with actionable browse buttons.
- **Test Case 5: Error Banner & Retry:** Verifies that API rejection triggers the retry banner and that clicking "إعادة المحاولة" triggers a refetch.

### 2. Regression & Build Gate
- Execute `npm.cmd test` (Vitest) to ensure all existing 145 unit tests continue to pass with 0 failures.
- Execute `npm.cmd run build` (Vite) to verify zero TypeScript errors, clean bundle compilation, and zero broken imports.

