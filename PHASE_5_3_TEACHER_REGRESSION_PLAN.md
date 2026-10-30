# OX-DIGITAL Education — Phase 5.3 Teacher Regression Test Plan

**Date:** October 28, 2026  
**Target:** Teacher Experience (`/teacher/*`)  
**Authorized Project Root:** `D:\OX-DIGITAL\Mathe\Mathteachersmartplatform-main`  
**Test Framework:** Vitest + React Testing Library + jsdom  
**Status:** **PLANNING ONLY (TO BE IMPLEMENTED DURING PHASE 5.3 IMPLEMENTATION)**

---

## 1. Existing Test Suites to Preserve (Zero Regression Gate)

The frontend test suite currently executes 39 unit/integration tests across 6 primary test suites. All existing tests must remain 100% green during and after the Teacher Dashboard redesign:

| Test Suite | File Path | Tests | Scope & Assertions |
| :--- | :--- | :---: | :--- |
| **Admin Home Page** | `src/app/test/AdminHomePage.test.tsx` | 4 | Executive metrics, institutional branding, retry state, manual refresh. |
| **Auth & Splash** | `src/app/test/AuthPagesAndSplash.test.tsx` | 10 | Multi-role login, credentials forms, splash screen, theme toggle. |
| **Landing Page** | `src/app/test/LandingPage.test.tsx` | 6 | Brand identity, direct exam entry, role ecosystem, copyright. |
| **Shared Layout** | `src/app/test/SharedLayout.test.tsx` | 3 | Institutional shell, responsive sidebar, navigation menu. |
| **Protected Route** | `src/app/test/ProtectedRoute.test.tsx` | 3 | Role guards for `ONLINE_STUDENT`, `CENTER_STUDENT`, `TEACHER`, `PARENT`, `ADMIN`. |
| **Parent Dashboard** | `src/app/test/ParentDashboard.test.tsx` | 13 | Academic KPIs, pending grading badge, empty datasets (`'—'`), attendance semantics. |

---

## 2. New Test Suite: `TeacherDashboard.test.tsx`

To close the identified testing gap for the teacher experience, a new dedicated test suite `apps/frontend/src/app/test/TeacherDashboard.test.tsx` will be created during the implementation phase, providing 10 rigorous test cases:

### Proposed Test Cases & Verification Boundaries

```typescript
describe('Phase 5.3: Teacher Dashboard Redesign & Data Integrity Suite', () => {
  // Test 1: Access Control & Route Guarding
  it('enforces RBAC: allows TEACHER role and redirects non-teachers to /unauthorized');

  // Test 2: Institutional Shell & Navigation
  it('renders institutional title "OX-DIGITAL Education", teacher name subtitle, and crimson theme tokens');

  // Test 3: Verified Home KPI Rendering
  it('renders verified KPIs (totalStudents, totalCourses, averageScore, strugglingStudents) without undefined or deceptive %');

  // Test 4: Empty Academic Datasets
  it('renders fallback dash "—" and descriptive empty states when teacher has 0 courses or 0 student submissions');

  // Test 5: Live At-Risk Student Queue
  it('renders at-risk students with severity badges and working "عرض الملف" navigation button');

  // Test 6: Attendance Workflow Integrity
  it('renders attendance group selection, grade hierarchy, and toggles status between PRESENT, LATE, and ABSENT');

  // Test 7: Notification Badge & Routing
  it('displays real unread notification count badge in teacher navigation menu and navigates to notifications view');

  // Test 8: Error & Retry State Handling
  it('renders error alert with retry button when teacher analytics API fails');

  // Test 9: Light and Dark Theme Switching
  it('supports ThemeContext toggling between light and dark modes with proper background classes');

  // Test 10: RTL Layout & Typography
  it('verifies dir="rtl" attribute and correct Arabic date/label formatting');
});
```

---

## 3. Detailed Test Specifications

### 1. KPI Correctness & Raw Average Test
- **Fixture:**
  ```typescript
  const mockTeacherAnalytics = {
    totalStudents: 24,
    totalCourses: 3,
    averageScore: 82,
    strugglingStudents: 2,
    distributionData: [
      { name: 'ممتاز', value: 12, color: '#10b981' },
      { name: 'جيد جداً', value: 10, color: '#3b82f6' },
      { name: 'متعثر', value: 2, color: '#ef4444' }
    ],
    subjectPerformance: [
      { subject: 'جبر وتفاضل', avg: 85 },
      { subject: 'هندسة فراغية', avg: 79 }
    ]
  };
  ```
- **Assertions:**
  - `expect(screen.getByText('24')).toBeInTheDocument()` (Total students).
  - `expect(screen.getByText('82')).toBeInTheDocument()` (Raw average score).
  - `expect(screen.queryByText('undefined%')).not.toBeInTheDocument()`.
  - `expect(screen.queryByText('undefined')).not.toBeInTheDocument()`.

### 2. At-Risk Navigation Action Test
- **Fixture:** Mock payload from `GET /api/analytics/risk` with a student `id: 'student-99'`, `name: 'كريم محمود'`, `risk: 'حرج'`.
- **Assertions:**
  - Verifies student card renders with `'كريم محمود'` and `'حرج'`.
  - Clicking `"عرض الملف"` invokes router navigation to `/teacher/students/student-99`.

### 3. Empty State Resilience Test
- **Fixture:** Analytics payload with `totalStudents: 0`, `totalCourses: 0`, `averageScore: 0`, `attemptCount: 0`.
- **Assertions:**
  - Average score card displays `'—'`, not `0%` or `NaN`.
  - At-risk container displays `"لا يوجد طلاب متعثرين حالياً"`.

---

## 4. Verification Gates Before Deployment

Following the implementation phase, the following three verification gates must pass:

1. **TypeScript Typecheck:**
   - Command: `cmd /c npx tsc --noEmit` in `apps/frontend`
   - Gate Requirement: **0 errors (Exit code 0)**
2. **Vitest Test Suite Execution:**
   - Command: `cmd /c npx vitest run`
   - Gate Requirement: **7 test suites passed, 49/49 tests passed (Exit code 0)**
3. **Production Build Compilation:**
   - Command: `cmd /c npm run build` (Vite v6.4.3)
   - Gate Requirement: **0 syntax or chunking errors (Exit code 0)**

---

## 5. Verification Boundaries & Honest Limitations

- **Mocked vs. Real API Testing:**
  Unit tests execute in a jsdom sandbox with mocked service modules (`analytics.service`, `user.service`, `course.service`). While this guarantees algorithmic correctness and UI state resilience, it does not mutate live PostgreSQL tables or send live HTTP requests to Docker containers.
- **Runtime Deployment Isolation:**
  No Docker rebuilds, container copying (`docker cp`), or container restarts will occur during testing. Testing will be performed exclusively on the host workspace.
