# OX-DIGITAL Education — Smart Navigation Counters & Notification Integrity Audit Report

**Date:** November 9, 2026  
**Workspace:** `D:\OX-DIGITAL\Mathe\OX-DIGITAL-GITHUB`  
**Audit Status:** COMPLETE — READ-ONLY SECURITY & INTEGRITY VERIFICATION  
**Overall Verdict:** PASS — 100% Genuinely Data-Driven, Authoritative, Role-Aware, and Multi-Tenant Isolated

---

## Executive Summary

An exhaustive, strictly read-only audit of the **Smart Navigation Counters**, **Real-Time Notification Lifecycle**, and **State-Aware Contextual Guidance** systems was performed across all six supported user roles (`PRIMARY_MANAGER` / `ADMIN`, `ACCOUNTANT`, `TEACHER`, `CENTER_STUDENT`, `ONLINE_STUDENT`, and `PARENT`).

### Key Findings
1. **Zero Fake or Hardcoded Badges:** All sidebar menus across all six roles have zero hardcoded numeric badges (e.g. `badge: 3` has been completely eliminated). Badges are computed dynamically via `useSmartNavigationCounters` or authenticated role-specific services.
2. **Zero-Counter Semantics Enforced:** When a count is 0, the badge is strictly evaluated as `undefined`, and `SharedLayout.tsx` suppresses the badge element entirely.
3. **Authoritative Backend Data Sources:** Every navigation counter is backed by an authoritative backend API endpoint and Prisma database query. Counters for expenses, approvals, homework, and notifications reflect exact database state.
4. **Disbursement Lifecycle Integrity:** Accountant disbursement counters strictly check `status === 'APPROVED' && !disbursedAt && !disbursedById`. Already-disbursed vouchers (`status === 'APPLIED'`) are never counted.
5. **Pagination & Truncation Guard (Limit 50 Defense):** When query limits (e.g., 50 items) are reached, the system relies on authoritative `summary.totalCount` or `pagination.total` rather than page size. If the backend omits the summary total, the system safely falls back to `isError = true` and suppresses badges rather than displaying a truncated, false total.
6. **Real-Time Event Scoping & Deduplication:** Socket.IO events (`notification`, `expense_created`, `expense_approved`, `expense_disbursed`, `homework_assigned`, `homework_submitted`) are filtered against the connected user's `userId` and `institutionId`. Duplicate events are dropped via a 100-entry rolling event cache (`handledEventIdsRef`).
7. **Cross-Tenant & Role Isolation:** Socket.IO handshakes strictly isolate rooms (`institution:${id}:admin`, `branch:${id}:admin`, `teacher:${id}`, `course:${id}`). The global `admin` room is strictly restricted to server-validated `isPlatformSuperAdmin` or `SUPER_ADMIN`.
8. **100% Test Suite Verification:** All 51 automated unit and lifecycle tests across `SmartNotificationCounters.test.tsx` (26 tests), `RealtimeCounterLifecycle.test.tsx` (10 tests), and `StateAwareOnboarding.test.tsx` (15 tests) passed with 0 failures.

---

## Audit A — Fake and Static Badge Elimination

### 1. Systematic Scan of All Navigation Menus

| Role / Dashboard | Source File | Static Badges Found | Dynamic Application Method |
| :--- | :--- | :---: | :--- |
| **Admin** | `apps/frontend/src/app/components/admin/AdminDashboard.tsx` | **0** | `applyBadgesToMenuItems(adminMenuItems)` |
| **Primary Manager** | `apps/frontend/src/app/components/primary-manager/PrimaryManagerDashboard.tsx` | **0** | `applyBadgesToMenuItems(primaryManagerMenuItems)` |
| **Accountant** | `apps/frontend/src/app/components/accountant/AccountantDashboard.tsx` | **0** | `applyBadgesToMenuItems(accountantMenuItems)` |
| **Teacher** | `apps/frontend/src/app/components/teacher/TeacherDashboard.tsx` | **0** | Line 61: `badge: unreadCount > 0 ? unreadCount : undefined` |
| **Student Center** | `apps/frontend/src/app/components/student-center/StudentCenterDashboard.tsx` | **0** | Line 87: `badge: pendingHomework > 0 ? pendingHomework : undefined` |
| **Student Online** | `apps/frontend/src/app/components/student-online/StudentOnlineDashboard.tsx` | **0** | Line 85: `badge: pendingHomework > 0 ? pendingHomework : undefined` |
| **Parent** | `apps/frontend/src/app/components/parent/ParentDashboard.tsx` | **0** | Line 49: `badge: unreadNotifications > 0 ? unreadNotifications : undefined` |

### 2. Elimination of Fake `badge: 3`
Historically, `adminMenuItems` included a hardcoded badge `badge: 3` on the approvals route (`/admin/approvals`). In the current codebase:
- File: `apps/frontend/src/app/components/admin/AdminDashboard.tsx` (Line 35):
  ```typescript
  { path: '/admin/approvals', icon: ShieldCheck, label: 'مركز الموافقات والاعتمادات', labelKey: 'adminMenuApprovals' },
  ```
  The hardcoded `badge: 3` has been removed. Badges are applied exclusively through `applyBadgesToMenuItems(adminMenuItems)`.
- Verified by automated unit test `SmartNotificationCounters.test.tsx` (Line 107):
  ```typescript
  it('eliminates fake static badge: 3 from adminMenuItems', () => {
    const approvalsItem = adminMenuItems.find((item) => item.path === '/admin/approvals');
    expect(approvalsItem).toBeDefined();
    expect(approvalsItem?.badge).toBeUndefined();
  });
  ```

### 3. Zero-Counter & Error Semantics in UI
In `apps/frontend/src/app/components/shared/SharedLayout.tsx` (Lines 184–188):
```tsx
{!collapsed && item.badge !== undefined && item.badge > 0 && (
  <span className="bg-destructive text-destructive-foreground text-xs px-2 py-0.5 rounded-full font-bold flex-shrink-0">
    {item.badge}
  </span>
)}
```
- A badge is only rendered when `item.badge !== undefined && item.badge > 0`.
- If the counter is 0, `getBadgeForPath` in `useSmartNavigationCounters.ts` returns `undefined`. No `0` or ghost badge is ever rendered in the sidebar.
- On network error (`isError === true`), `getBadgeForPath` returns `undefined`. Network failures do not show deceptive counts.

---

## Audit B — Authoritative Counter Sources

### 1. Counter Traceability Matrix

| Counter Field | Target Consumer | Frontend Hook / Service | Backend Endpoint | Authoritative DB Query |
| :--- | :--- | :--- | :--- | :--- |
| `unreadNotifications` | All Roles & Top Bell | `notificationService.getUnreadCount()` | `GET /api/notifications/unread-count` | `db.notification.count({ where: { userId, read: false, OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] } })` |
| `pendingApprovals` | Manager / Admin | `accountingService.getExpenses({ status: 'PENDING_APPROVAL' })` | `GET /api/accounting/expenses?status=PENDING_APPROVAL` | `db.expenseVoucher.aggregate({ where: { institutionId, status: 'PENDING_APPROVAL' }, _count: { id: true } })` |
| `pendingDisbursements` | Accountant | `accountingService.getExpenses({ status: 'APPROVED' })` | `GET /api/accounting/expenses?status=APPROVED` | `db.expenseVoucher.aggregate({ where: { institutionId, branchId, status: 'APPROVED' }, _count: { id: true } })` |
| `pendingHomework` | Center / Online Students | `homeworkService.getHomeworks()` | `GET /api/homework` | Course & Homework submission records filtered by unsubmitted, active, unlocked assignments |

### 2. Accounting Disbursement Lifecycle Integrity
In `apps/frontend/src/app/hooks/useSmartNavigationCounters.ts` (Lines 98–104):
```typescript
const uniqueApproved = new Map<string, any>();
rawList.forEach((v: any) => {
  // Strictly APPROVED and not yet physically disbursed
  if (v && v.id && v.status === 'APPROVED' && !v.disbursedAt && !v.disbursedById) {
    uniqueApproved.set(v.id, v);
  }
});
```
- In `services/user-service/src/controllers/accounting/expenses.controller.ts` (Lines 411–416):
  When an accountant disburses a voucher, its status transitions to `APPLIED`, `disbursedById` is set to the disburser, and `disbursedAt` is set to `new Date()`.
- Therefore, already-disbursed vouchers are excluded from both backend `status === 'APPROVED'` queries and client-side disbursement filters. No double-counting or zombie badges can occur.

### 3. Pagination Limit 50 & Truncation Guard
When querying expenses, the endpoint defaults to a page limit of 50 vouchers:
- In `expenses.controller.ts` (Lines 184–207), the backend executes `db.expenseVoucher.aggregate` alongside the paginated query and returns `summary.totalCount` and `pagination.total`.
- In `useSmartNavigationCounters.ts` (Lines 80–91 & 105–116):
  ```typescript
  if (typeof expRes?.summary?.totalCount === 'number') {
    disbursements = expRes.summary.totalCount;
  } else if (typeof expRes?.pagination?.total === 'number') {
    disbursements = expRes.pagination.total;
  } else if (rawList.length < 50) {
    disbursements = uniqueApproved.size;
  } else {
    // Truncated list without authoritative total — do not present page length as complete total
    fetchFailed = true;
  }
  ```
  If 50 vouchers are returned without an authoritative total count, `fetchFailed` is set to `true`, triggering `isError = true`. The client refuses to falsely present a truncated page count (`50`) as the actual total.

### 4. Concurrency & Stale Request Protection
- `fetchSequenceRef.current` increments monotonically on every invocation of `fetchCounters()`.
- State updates are committed only when `currentSeq === fetchSequenceRef.current` (Line 139). Stale responses arriving out of order are discarded.

---

## Audit C — Real-Time Lifecycle & Event Integrity

### 1. Subscribed Real-Time Events
In `apps/frontend/src/app/hooks/useSmartNavigationCounters.ts` (Lines 233–240), the client listens to:
1. `notification` / `new_notification`
2. `notification_read`
3. `homework_assigned`
4. `homework_submitted`
5. `expense_created`
6. `expense_approved`
7. `expense_disbursed`

### 2. Socket Room Architecture & Isolation
In `services/course-service/src/index.ts` (Lines 72–135):
- **User Private Room:** Every connected user joins `user:${userId}`. Targeted user alerts are sent only to this room.
- **Institution Admin Room:** Primary Managers and Admins join `institution:${institutionId}:admin`.
- **Branch Admin Room:** If a manager or accountant is scoped to a branch, they join `branch:${branchId}:admin`.
- **Global `admin` Room:** Strictly restricted to verified SaaS Super Admins (`isPlatformSuperAdmin === true` or role `SUPER_ADMIN`). Normal admins without an institution ID are denied access (fail closed).
- **Teacher Room:** Teachers join `teacher:${userId}` and `course:${courseId}` for courses they own.
- **Student & Parent Rooms:** Join `course:${courseId}` for courses in which they are actively enrolled.

### 3. Client-Side Event Deduplication & Scope Verification
In `useSmartNavigationCounters.ts` (Lines 197–223):
```typescript
const handleRealtimeEvent = (eventName: string, payload?: any) => {
  if (payload && typeof payload === 'object') {
    if (payload.userId && user && payload.userId !== user.id) {
      return; // Ignore events targeted to other users
    }
    if (payload.institutionId && user && user.institutionId && payload.institutionId !== user.institutionId) {
      return; // Ignore events from other institutions
    }

    const eventKey = payload.id ? `${eventName}:${payload.id}` : (payload.timestamp ? `${eventName}:${payload.timestamp}` : null);
    if (eventKey) {
      if (handledEventIdsRef.current.has(eventKey)) {
        return; // Duplicate delivery ignored
      }
      handledEventIdsRef.current.add(eventKey);
      if (handledEventIdsRef.current.size > 100) {
        const first = handledEventIdsRef.current.values().next().value;
        if (first) handledEventIdsRef.current.delete(first);
      }
    }
  }
  fetchCounters();
};
```
- Rapid burst emissions or duplicate event deliveries do not trigger redundant REST invalidations.
- Cross-tenant events accidentally received are discarded before triggering fetches.

### 4. Lifecycle Recovery Mechanisms
1. **Reconnection Recovery:** When `socketConnected` transitions from `false` to `true`, `fetchCounters()` automatically executes (Line 191).
2. **Tab Visibility Recovery:** When the user switches tabs and returns, `visibilitychange` (`!document.hidden`) triggers `fetchCounters()` (Lines 165–168).
3. **Window Focus Recovery:** `window.addEventListener('focus')` triggers `fetchCounters()` (Lines 170–172).
4. **Background Fallback Polling:** A 30-second interval (`setInterval(fetchCounters, 30000)`) guarantees eventual consistency if WebSockets disconnect.

---

## Audit D — Role & Tenant Isolation Matrix

| Role | Visible Navigation Badges | Authoritative REST Endpoint | Scoping Control in Backend | Permitted Socket Rooms | Cross-Tenant Protection |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Primary Manager / Admin** | Approvals, Notifications | `/api/accounting/expenses?status=PENDING_APPROVAL`<br>`/api/notifications/unread-count` | `institutionId = user.institutionId` | `user:${userId}`<br>`institution:${institutionId}:admin`<br>`branch:${branchId}:admin` | Cannot query foreign institution vouchers or receive foreign broadcasts. |
| **Accountant** | Expenses (Disbursements), Notifications | `/api/accounting/expenses?status=APPROVED`<br>`/api/notifications/unread-count` | `institutionId = user.institutionId`<br>`branchId = user.branchId` (`ACCOUNTANT_BRANCH_UNASSIGNED`, `CROSS_BRANCH_ACCESS_DENIED`) | `user:${userId}`<br>`branch:${branchId}:admin` | Strictly confined to assigned branch. Denied access to other branches' vouchers. |
| **Teacher** | Notifications | `/api/notifications/unread-count` | `userId = req.user.userId`<br>Courses owned by teacher | `user:${userId}`<br>`teacher:${userId}`<br>`course:${courseId}` | No access to accounting endpoints. Cannot join global admin or foreign teacher rooms. |
| **Student (Center)** | Homework | `homeworkService.getHomeworks()`<br>`/api/notifications/unread-count` | `studentId = req.user.userId`<br>Branch enrollment filter | `user:${userId}`<br>`course:${courseId}` | Homework scoped to enrolled courses. Cannot access accounting or administrative rooms. |
| **Student (Online)** | Homework | `homeworkService.getHomeworks()`<br>`/api/notifications/unread-count` | `studentId = req.user.userId`<br>Online course enrollment | `user:${userId}`<br>`course:${courseId}` | Scoped to enrolled courses. |
| **Parent** | Notifications | `/api/notifications/unread-count` | Linked children verification | `user:${userId}`<br>`course:${childCourseId}` | Scoped strictly to linked student children. |
| **Unauthenticated** | None (All 0 / Undefined) | None (Requests aborted) | N/A | None (Socket disconnected) | Zero state leaks. |

---

## Audit E — Contextual Guidance Integration

### 1. Component Architecture & Mounting
- Component: `apps/frontend/src/app/components/shared/ContextualGuidanceBanner.tsx`
- Mount Location: `apps/frontend/src/app/components/shared/SharedLayout.tsx` (Line 372), directly at the top of the main scrollable viewport (`<main>`).
- State Engine: `resolveStateAwareGuidance(user, guidanceState)` evaluates the authenticated user's role, financial restriction status, and state counts.

### 2. State-to-Route Resolution Matrix

| User Role | Triggering Condition | Guidance Step ID | Action Route | Blocker? |
| :--- | :--- | :--- | :--- | :---: |
| **Center / Online Student** | `financialAccessStatus === 'RESTRICTED'` | `STUDENT_FINANCIAL_RESTRICTION` | `/student/center/subscriptions` or `/student/online/subscriptions` | **Yes** |
| **Center / Online Student** | `enrolledCoursesCount === 0` | `STUDENT_EXPLORE_COURSES` | `/student/center/courses` or `/student/online/courses` | No |
| **Center / Online Student** | `pendingHomeworkCount > 0` | `STUDENT_PENDING_HOMEWORK` | `/student/center/homework` or `/student/online/homework` | No |
| **Center / Online Student** | All homework submitted | `STUDENT_CONTINUE_LEARNING` | `/student/center/courses` or `/student/online/courses` | No |
| **Teacher** | `!user.branchId && !user.branch?.id` | `TEACHER_AWAITING_BRANCH` | `/teacher/profile` | **Yes** |
| **Teacher** | `teacherCoursesCount === 0` | `TEACHER_CREATE_COURSE` | `/teacher/courses` | No |
| **Teacher** | Has active courses | `TEACHER_MONITOR_STUDENTS` | `/teacher/students` | No |
| **Accountant** | `pendingDisbursementsCount > 0` | `ACCOUNTANT_PENDING_DISBURSEMENT` | `/accountant/expenses` | No |
| **Accountant** | `pendingDisbursementsCount === 0` | `ACCOUNTANT_COLLECTIONS_DESK` | `/accountant/collections` | No |
| **Primary Manager / Admin** | `pendingApprovalsCount > 0` | `MANAGER_PENDING_APPROVALS` | `/admin/approvals` | No |
| **Primary Manager / Admin** | `pendingApprovalsCount === 0` | `MANAGER_BRANCHES_SETUP` | `/admin/branches` | No |
| **Parent** | `childrenCount === 0` | `PARENT_NO_CHILDREN` | `/parent/settings?tab=linking` | **Yes** |
| **Parent** | Has linked children | `PARENT_MONITOR_CHILDREN` | `/parent/children` | No |

### 3. Dismissal & State-Transition Re-Engagement
- Storage Key: `ox_guidance_dismissed_${rawRole}_${user.id}_${stepId}` (Line 369).
- Dismissal is scoped strictly by role, user ID, and `stepId`.
- When a user transitions to a new state (e.g. an unenrolled student registers for courses and receives homework), `stepId` changes from `STUDENT_EXPLORE_COURSES` to `STUDENT_PENDING_HOMEWORK`. The dismissal key for the previous step does not suppress the new step. The user is actively guided through the next phase of onboarding.

---

## Audit F — Tests and Automated Evidence

All 51 automated unit, integration, and lifecycle tests across the three targeted test suites were executed and verified:

```
Test Files  3 passed (3)
     Tests  51 passed (51)
```

### Breakdown of Executed Test Suites:
1. `apps/frontend/src/app/test/SmartNotificationCounters.test.tsx` (26 Tests Passed)
   - Eliminates fake static `badge: 3` from `adminMenuItems`.
   - Computes `undefined` badge when no approvals are pending.
   - Dynamically maps authoritative pending approvals from `accountingService`.
   - Ignores vouchers with missing, null, or invalid status.
   - Correctly processes student homework statuses (`available`, `assigned`, `pending`).
   - Uses backend `summary.totalCount` when page limit 50 is reached.
   - Exposes explicit `isError = true` on network failure.
   - Verifies contextual guidance rendering for all roles.
   - Persists dismissals in `localStorage` per user, role, and step.
   - Verifies canonical plural routes `/student/center/subscriptions` and `/admin/branches`.
   - Verifies parent zero-children deep link `/parent/settings?tab=linking`.
   - Excludes already-disbursed (`disbursedAt`) vouchers from accountant disbursement counters.
   - Fails safe to `isError` when 50 items return with missing summary total.
   - Verifies deep-link tab history synchronization on `AccountSettingsPage`.

2. `apps/frontend/src/app/test/RealtimeCounterLifecycle.test.tsx` (10 Tests Passed)
   - Initial load of role-specific counters.
   - Zero-counter semantics (badge is `undefined`, no ghost badges).
   - Accountant counter monitors approved vouchers awaiting disbursement.
   - Student counter filters strictly for unsubmitted actionable homework.
   - Real-time `notification` socket event triggers reactive refresh.
   - Task approval/disbursement events trigger reactive counter updates.
   - Event deduplication prevents redundant API calls on duplicate socket deliveries.
   - Cross-tenant event isolation discards foreign events.
   - Tab restoration and window focus revalidate counters.
   - Network failure fails closed with safe zero counts and `isError = true`.

3. `apps/frontend/src/app/test/StateAwareOnboarding.test.tsx` (15 Tests Passed)
   - Student journey: Unenrolled online student guided to explore courses.
   - Student journey: Unenrolled center student guided to center courses.
   - Student journey: Student with pending homework guided to submit assignments.
   - Student journey: Student with 0 pending homework guided to continue learning.
   - Student journey: Financially restricted student receives blocker banner.
   - Teacher journey: Teacher without branch receives administrative notice blocker.
   - Teacher journey: Teacher assigned to branch with 0 courses guided to create course.
   - Teacher journey: Teacher with courses guided to monitor students.
   - Accountant journey: Accountant with approved vouchers guided to expenses desk.
   - Accountant journey: Accountant with 0 pending vouchers guided to daily collection.
   - Primary Manager journey: Pending vouchers guide to approvals.
   - Primary Manager journey: 0 pending vouchers guide to branch governance.
   - Persistence: Dismissal scoped per user, role, and step ID.
   - State transition re-engagement: New step displays guidance even if previous step was dismissed.
   - English localization: Displays English guidance copy when English locale is selected.

---

## Conclusion & Verification Sign-Off

The OX-DIGITAL Education Smart Navigation Counters, Real-Time Notification Lifecycle, and State-Aware Onboarding systems are **fully verified**:
- **0 Hardcoded or Fake Badges** remain.
- **100% of Navigation Badges** derive authoritatively from backend database state.
- **Strict Multi-Tenant & Branch Scoping** prevents cross-tenant data exposure.
- **Defense-in-Depth Pagination Guards** prevent truncated badge counts.
- **Socket.IO Event Deduplication & Room Scoping** eliminate redundant traffic and unauthorized notifications.
- **Contextual Guidance** accurately guides users through authenticated business flows.
- **All 51 Automated Tests** pass cleanly.

