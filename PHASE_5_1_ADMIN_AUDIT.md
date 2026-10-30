# OX-DIGITAL Education — Phase 5.1 Admin Dashboard Audit
## Comprehensive Architecture, Route, Data, and Visual Preflight Report

**Project Root:** `D:\OX-DIGITAL\Mathe\Mathteachersmartplatform-main`  
**Target Environment:** `http://localhost:8080/admin/home`  
**Date:** October 27, 2026  
**Status:** Preflight Audit Complete

---

## 1. Verified Architecture & Serving Configuration

1. **Host Mapping and Gateway Topology:**
   - Host port `8080` is bound to the Nginx reverse proxy container `ox-digital-nginx` (`ox-digital-education-nginx`).
   - Gateway routes all static web assets and HTML under `/` to upstream container `ox-digital-frontend:80`.
   - Gateway routes `/api/analytics/` to `analytics-service:4005`.
   - Gateway routes `/api/auth/` to `auth-service:4001`.
   - Gateway routes `/api/users/` to `user-service:4003`.
   - Gateway routes `/api/notifications/` to `notification-service:4002`.

2. **Frontend Serving Container & Persistence Model:**
   - Container `ox-digital-frontend` serves static web assets from `/usr/share/nginx/html`.
   - Inspection of `.Mounts` on `ox-digital-frontend` confirms no host bind mount is attached (`Mounts: []`). The container runs an immutable overlayfs image layer.
   - Nginx configuration inside `ox-digital-frontend` specifies `no-cache, no-store, must-revalidate` for `.html` files.
   - Build Source of Truth: `D:\OX-DIGITAL\Mathe\Mathteachersmartplatform-main\apps\frontend`.
   - Compilation Target: `apps/frontend/dist`.
   - Container Deployment Gate: Syncing `apps/frontend/dist/.` to `ox-digital-frontend:/usr/share/nginx/html/` updates the live site at `http://localhost:8080/` with **zero container downtime, zero service recreation, and zero database impact**.

---

## 2. Existing Admin Source Files & Components

| Component / File Path | Role & Architecture Responsibility |
| :--- | :--- |
| `apps/frontend/src/app/App.tsx` | Application router root. Lazy-loads `AdminDashboard` at route `/admin/*`, wrapped inside `<ProtectedRoute allowedRoles={['ADMIN']} />`. |
| `apps/frontend/src/app/components/auth/ProtectedRoute.tsx` | Route guard that verifies `isAuthenticated` and checks `user.role === 'ADMIN'`. Redirects unauthenticated requests to `/login` and unauthorized roles to `/unauthorized`. |
| `apps/frontend/src/app/components/admin/AdminDashboard.tsx` | Container shell for the Admin module. Wraps nested administrative sub-routes inside `<SharedLayout>`. |
| `apps/frontend/src/app/components/admin/AdminHomePage.tsx` | Main dashboard overview page rendered at `/admin/home`. Manages data polling, KPI stat cards, charts (Recharts), quick metrics, and recent activities. |
| `apps/frontend/src/app/components/shared/SharedLayout.tsx` | Shared administrative and portal layout wrapper used across all 5 roles (`ADMIN`, `TEACHER`, `ONLINE_STUDENT`, `CENTER_STUDENT`, `PARENT`). Contains sidebar navigation, mobile drawer, top header bar, theme toggle, and notification bell. |
| `apps/frontend/src/app/services/analytics.service.ts` | Frontend API client for analytics. Contains `getAdminAnalytics()` pointing to `/api/analytics/admin`. |
| `apps/frontend/src/app/contexts/AuthContext.tsx` | Authentication state and profile management. Provides `user`, `role`, and token persistence in `localStorage`. |
| `apps/frontend/src/app/contexts/ThemeContext.tsx` | Light/Dark theme provider with `localStorage` key `'edu-theme'` and `data-theme` DOM attribute binding. |

---

## 3. Existing Admin Routes & Navigation Inventory

The Admin Dashboard currently defines 11 verified sidebar navigation items in `AdminDashboard.tsx`:

1. `/admin/home` — **لوحة التحكم** (`Home` icon) -> `AdminHomePage.tsx`
2. `/admin/profile` — **الملف الشخصي** (`Users` icon) -> `AdminProfilePage.tsx`
3. `/admin/users` — **إدارة المستخدمين** (`Shield` icon) -> `AdminUsersPage.tsx`
4. `/admin/students` — **إدارة الطلاب** (`Users` icon) -> `StudentsPage.tsx`
5. `/admin/courses` — **إدارة الدورات** (`BookOpen` icon) -> `CoursesManagementPage.tsx`
6. `/admin/exams` — **الامتحانات** (`ClipboardCheck` icon) -> `ExamsManagementPage.tsx`
7. `/admin/homework` — **الواجبات** (`FileText` icon) -> `HomeworkManagementPage.tsx`
8. `/admin/chatbot` — **المساعد الذكي** (`MessageCircle` icon) -> `ChatbotManagementPage.tsx`
9. `/admin/reports` — **التقارير** (`BarChart3` icon) -> `ReportsPage.tsx`
10. `/admin/risk` — **كشف الخطر** (`AlertTriangle` icon) -> `RiskDetectionPage.tsx`
11. `/admin/subscriptions` — **الاشتراكات** (`CreditCard` icon) -> `SubscriptionPage.tsx`

**Bottom Navigation Actions:**
- **الإعدادات** (`Settings` icon)
- **تسجيل الخروج** (`LogOut` icon) -> triggers `logout()` and navigates to `/login`.

---

## 4. Real Data Dependencies & API Contract

The page `/admin/home` connects to `analyticsService.getAdminAnalytics()`, which queries `GET /api/analytics/admin` on `analytics-service:4005`.

### Actual Verified Payload Schema:

```typescript
interface AdminAnalyticsResponse {
  overview: {
    totalUsers: number;         // Total registered users across all roles
    studentsCount: number;      // ONLINE_STUDENT + CENTER_STUDENT count
    teachersCount: number;      // TEACHER count
    parentsCount: number;       // PARENT count
    adminsCount: number;        // ADMIN count
    activeUsers: number;        // Users active in past 30 days
    totalCourses: number;       // Total courses created
    totalVideos: number;        // Total lesson media items
    totalExams: number;         // Total exams created
    totalHomeworks: number;     // Total homework assignments
    totalEnrollments: number;   // Course enrollments
    totalSubmissions: number;   // Homework submissions
    averageExamScore: number;   // Overall average score on exam attempts
    passRate: number;           // Percentage of scores >= 50%
    completionRate: number;     // Homework submission vs enrollment completion %
    atRiskStudents: number;     // Students with any exam score < 50%
    totalRevenue: number;       // Total completed payments (EGP)
    monthlyRevenue: number;     // Current month completed payments (EGP)
    yearlyRevenue: number;      // Current year completed payments (EGP)
  };
  roleDistribution: Array<{
    role: string;
    _count: number;
  }>;
  enrollmentData: Array<{
    month: string;              // "الشهر الماضي", "الشهر الحالي"
    students: number;
  }>;
  performanceData: Array<{
    course: string;             // Course title
    average: number;            // Average exam score (0-100)
  }>;
  revenueData: Array<{
    month: string;              // e.g. "4/2026"
    revenue: number;            // Monthly sum in EGP
  }>;
  recentActivities: Array<{
    text: string;               // e.g. "إجمالي الطلاب المسجلين: 1,250"
    time: string;               // e.g. "محدث الآن"
    type: 'info' | 'success' | 'warning';
  }>;
}
```

---

## 5. Security & Access Control Verification

1. **Client Guard (`ProtectedRoute`):**
   - Verified that unauthenticated requests to `http://localhost:8080/admin/home` immediately redirect to `http://localhost:8080/login`.
   - Verified that authenticated users with roles other than `ADMIN` are redirected to `/unauthorized` (`PermissionDeniedPage`).
2. **API Interceptor Guard (`api.ts`):**
   - All protected service APIs (`analyticsApi`, `userApi`, `notificationApi`) intercept any `401 Unauthorized` or expired token response.
   - Upon a failed token refresh, the client clears `localStorage` keys `token` and `edu-user` and redirects to `/login`.
3. **Backend Middleware Guard (`analytics.routes.ts`):**
   - Endpoints are protected by `verifyToken` and `checkRole(['admin'])`. Non-admin requests receive `403 Forbidden`.

---

## 6. Shared Component Impact Analysis

`SharedLayout.tsx` is currently consumed by 5 separate portals:
1. `AdminDashboard.tsx` (`ADMIN`)
2. `TeacherDashboard.tsx` (`TEACHER`)
3. `StudentCenterDashboard.tsx` (`CENTER_STUDENT`)
4. `StudentOnlineDashboard.tsx` (`ONLINE_STUDENT`)
5. `ParentDashboard.tsx` (`PARENT`)

### Critical Constraint:
Any enhancements to `SharedLayout.tsx` must be **strictly backward-compatible**.
- The existing color presets (`indigo-600`, `emerald-600`, `cyan-600`, `green-600`, `violet-600`) must remain completely intact.
- An institutional preset (`academic-crimson`) or admin-specific layout options can be introduced cleanly without modifying or affecting the non-admin dashboards.

---

## 7. Baseline Visual Deficiencies Identified

Based on live headless captures of the existing `/admin/home` (`admin_baseline_desktop_dark.png`, `admin_baseline_desktop_light.png`, and `admin_baseline_mobile_dark.png`):

1. **Aesthetic Misalignment:**
   - The current admin shell uses a bright purple/violet theme (`violet-600`, `purple-700`) that conflicts with the approved **OX-DIGITAL Education** identity:
     - Academic Obsidian: `#090b10`
     - Academic Charcoal: `#0f131d` / `#161c28`
     - Institutional Crimson: `#9e1b1b`
     - Clean Ivory/Slate: `#f8fafc` / `#f1f5f9`
2. **Generic Card Gradients:**
   - 8 KPI cards use rainbow gradients (blue, green, orange, pink, cyan) that look like a generic SaaS template rather than a distinguished academic administration platform.
3. **Data Utilization Gaps:**
   - Real backend data already provides `roleDistribution`, `studentsCount`, `teachersCount`, `parentsCount`, `adminsCount`, `totalEnrollments`, and `averageExamScore`, but these are currently underutilized or omitted from the overview.
4. **Loading & Error States:**
   - Error handling currently logs to console silently, leaving cards with empty values (`...` or `—`) rather than an institutional error card with retry capability.
5. **Chart Styling:**
   - Recharts graphs lack institutional styling (custom tooltips with academic borders, refined SVG axes, and coordinated brand palettes).

---

## 8. Audit Conclusion

The Admin Dashboard redesign has a clear, isolated footprint:
- Target files: `AdminDashboard.tsx`, `AdminHomePage.tsx`, and non-breaking institutional support in `SharedLayout.tsx`.
- Real backend API: `/api/analytics/admin` is active, verified, and provides rich metrics without requiring any database modifications.
- Port 8080 deployment: Fully verified through the existing Nginx container overlay synchronization pipeline.
