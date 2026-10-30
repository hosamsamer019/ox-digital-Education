# OX-DIGITAL Education — Phase 5.2 Parent Dashboard Audit (Read-Only)

**Project root:** `D:\OX-DIGITAL\Mathe\Mathteachersmartplatform-main`
**Mode:** Read-only source inspection. No application files, services, containers, or data were modified.
**Method:** Static code reading only. No authenticated parent session was run, and no live parent API calls were made.

---

## 1. Verified Route & Guards

Source: `apps/frontend/src/app/App.tsx` (lines 64–67)

```tsx
<Route element={<ProtectedRoute allowedRoles={['PARENT']} />}>
  <Route path="/parent/*" element={<ParentDashboard />} />
</Route>
```

- **Parent dashboard entry route: `/parent/home`** (`/parent` and `/parent/` redirect to it via `<Navigate to="/parent/home" replace />` in `ParentDashboard.tsx`).
- `ProtectedRoute` sends unauthenticated users to `/login` and users with a non-`PARENT` role to `/unauthorized`.

### Sub-routes (from `ParentDashboard.tsx`)

| Path | Component | Status |
| :--- | :--- | :--- |
| `/parent/home` | `ParentHomePage` | Works: children list + notifications |
| `/parent/children` | `ParentChildrenPage` | Works: per-child overview + attendance |
| `/parent/reports` | `ParentReportsPage` | Works: charts + results table |
| `/parent/messages` | `ParentHomePage` (**same component as home**) | ⚠️ No messaging feature exists. The route is a duplicate of home. |
| `/parent/subscription` | `ParentSubscriptionPage` | ⚠️ Stub: hardcoded plans, and checkout is an `alert()` that says "coming soon" |
| `/parent/profile` | `student-shared/ProfilePage` | Shared with the student dashboards |
| `/parent/assessment/:id/review/:attemptId` | `pages/AssessmentReviewPage` | Route exists. Reachability is limited (see §5). |

---

## 2. Files

| File | Role |
| :--- | :--- |
| `components/parent/ParentDashboard.tsx` | Shell, menu, unread badge, `SharedLayout` (preset `cyan-600`) |
| `components/parent/ParentHomePage.tsx` | Welcome, children cards, last 5 notifications |
| `components/parent/ParentChildrenPage.tsx` | Child selector, 4 stat cards, recent activity, attendance |
| `components/parent/ParentReportsPage.tsx` | Child selector, stat cards, exam/homework charts, results table |
| `components/parent/ParentSubscriptionPage.tsx` | Static plans stub |
| `components/shared/SharedLayout.tsx` | **Shared by all 5 roles.** Must not change behaviour for other roles. |
| `components/student-shared/ProfilePage.tsx` | **Shared with students.** Out of scope. |
| `pages/AssessmentReviewPage.tsx` | Shared review page. Out of scope. |

There are **no parent-specific tests** in `apps/frontend/src/app/test/` (searched for "Parent", no matches).

---

## 3. Parent ↔ Child Relationship

Prisma `User` model (`packages/database/prisma/schema.prisma`):
- `parentId String?` + `parent User? @relation("ParentChildren")` / `children User[]`.
- This is a one-parent-per-child, many-children-per-parent relationship.

---

## 4. APIs Used & Authorization (verified in backend source)

| Frontend call | Endpoint | Backend handler | Authorization scoping |
| :--- | :--- | :--- | :--- |
| `userService.getChildren()` | `GET /api/users/parent/children` | `user.controller.ts › getParentChildren` | `verifyToken` only (no role check), but the query is `where: { parentId: req.user.userId }`. A non-parent therefore receives `[]`. Returns `id, name, email, role, academicLevel, country, educationLevel, gradeLevel, createdAt`. |
| `analyticsService.getParentChildOverview(id)` | `GET /api/analytics/parent/child/:id/overview` | `analytics.controller.ts › getParentChildOverview` | `findFirst({ where: { id: childId, parentId } })`. Returns 404 if the child is not linked. ✅ Properly scoped. |
| `userService.getStudentAttendanceById(id)` | `GET /api/attendance/student/:studentId` | `attendance.controller.ts › getStudentAttendanceById` | For `PARENT`, it checks `children: { some: { id: studentId } }` and returns 403 otherwise. ✅ Properly scoped. |
| `notificationService.getNotifications()` | notifications service | — | The parent's own notifications |
| `userService.getProfile()` | `GET /api/users/profile` | — | Own profile |
| *(unused)* `analyticsService.getParentAnalytics()` | `GET /api/analytics/parent` | `getParentAnalytics` | Scoped by `parentId`, but returns **full child records** (exam attempts, submissions, attendances) without a `select`. It is not used by the UI today. Do **not** adopt it without a field review. |

### `getParentChildOverview` response shape (actual)

```ts
{
  overview: { overallRate: number, examsCompleted: number, homeworksCompleted: number },
  recent: Array<{ id, title, type: 'exam' | 'homework', score, date: 'YYYY-MM-DD' }>,
  charts: { examResults: [{ name, score }], homeworkResults: [{ name, score }] }
}
```

---

## 5. Data-Integrity Findings in the Current UI

| # | Finding | Evidence | Impact |
| :-: | :--- | :--- | :--- |
| D1 | The "المرتبة" (rank) card reads `overview.rank`, which the **backend never returns** | `ParentChildrenPage` L123, `ParentReportsPage` L109 vs. controller L182–187 | Shows `-` on Children, and an empty value on Reports. This is a display of non-existent data. |
| D2 | The "عرض النتيجة التفصيلية" button requires `result.assessmentId`, which is **never returned** | `ParentReportsPage` L202 | The button never renders. The review route is effectively unreachable from the parent UI. |
| D3 | `overallRate` averages exam scores and homework grades together, and treats ungraded homework as `0` | controller L171 (`sub.grade \|\| 0`) | Pending homework lowers the average. The label should say how it is computed, or the redesign should avoid showing it as a precise "GPA". |
| D4 | The "التواصل مع المعلم" menu badge counts **all unread notifications**, not messages | `ParentDashboard.tsx` L35, L42 | The label is misleading, and the route has no messaging feature. |
| D5 | The static default badge is `badge: 2` | `ParentDashboard.tsx` L18 | It is overwritten at runtime, but it is a hardcoded value. |
| D6 | The subscription page shows invented prices and plan features | `ParentSubscriptionPage.tsx` L6–33 | These are fabricated commercial claims. They should be treated as "coming soon" only. |
| D7 | Home-page notification empty state shows the time label "الآن" with no data | `ParentHomePage` L86 | Minor and misleading. |

---

## 6. Loading / Empty / Error States

| Page | Loading | Empty | Error |
| :--- | :--- | :--- | :--- |
| Home | `LoadingState` ✅ | `EmptyState` for no children ✅ | ❌ Logged to the console only. A failure looks like "no children linked". |
| Children | Spinner ✅ | Text ✅ | ❌ Silent. If the overview fails, `childData` stays null and the area renders blank. Errors from the attendance call are swallowed and shown as "no attendance". |
| Reports | Spinner ✅ | Text and per-chart empty states ✅ | ❌ Silent. Same blank-area problem. |
| Subscription | Fake loading | n/a | n/a |

Additional issues:
- In `fetchChildren`, `finally { if (children.length === 0) setLoading(false) }` reads stale state. It works by accident.
- Switching children while a previous request is still in flight can show stale data. There is no request cancellation.

---

## 7. Theme, RTL, Responsiveness

- Theme: all parent pages use `useTheme().isDark` with ad-hoc `gray-*` classes, so the existing `edu-theme` mechanism works. The look still uses generic cyan, indigo, and rainbow gradients rather than the OX-DIGITAL identity.
- RTL: inherited from the app root. The pages use `text-right` and logical spacing in most places.
- **Responsive risk:** the child selector is `flex gap-3` **without wrapping or scrolling**. With several children on a 375px screen, it will overflow horizontally. (This comes from reading the code; it was not observed in a browser.)
- The Reports table is wrapped in `overflow-x-auto` ✅.

---

## 8. Privacy Observations

- Children's **email addresses** are shown on the home cards and selectors. They belong to the parent's own linked children, so this is not a leak. The redesign can drop them as unnecessary.
- Every data call is scoped to linked children on the server (§4). The redesign must keep using **only** these three endpoints and must not use admin- or teacher-wide endpoints.

---

## 9. Shared-Component Constraints

- `SharedLayout.tsx` serves the Admin, Teacher, Online Student, Center Student, and Parent dashboards. A parent re-skin can be done by **switching the parent's preset prop to the existing `academic-crimson` preset**, which requires **no edit to `SharedLayout.tsx`**.
- `ProfilePage` and `AssessmentReviewPage` are shared and should stay out of scope.

---

## 10. Not Performed in This Audit

- No browser screenshots of the parent dashboard. That needs an authenticated parent session, and the brief forbids creating accounts.
- No live API calls, no test runs, and no build. Nothing was changed, so nothing needed re-validating.
- Git status: the project has **no `.git` directory** (verified earlier, `git status` → "not a git repository"). Working-tree changes can only be inferred from file timestamps. No parent files were modified in the last 24 hours (based on the mtime scan run during Phase 5.1.1).
