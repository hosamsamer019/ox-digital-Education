# OX-DIGITAL Education — Smart Counters, Homework, Accounting & Parent Guidance Remediation Report

**Date:** November 11, 2026  
**Workspace:** `D:\OX-DIGITAL\Mathe\OX-DIGITAL-GITHUB`  
**Prior Baseline Audits:**  
- `FINAL_SMART_NAVIGATION_COUNTERS_AND_ONBOARDING_INTEGRITY_AUDIT.md`
- `FINAL_SMART_COUNTERS_AUDIT_RECONCILIATION.md`
- `FINAL_SUPER_ADMIN_PRIVILEGE_SOURCE_AUDIT.md`
- `FINAL_HOMEWORK_SOCKET_ROOM_INTEGRATION_AUDIT.md`

---

## 1. Overall Verdict

**Verdict:** `PASS WITH LIMITATIONS`

All approved code remediations, TypeScript checks (in `course-service` and `user-service`, plus zero TypeScript errors across all modified frontend production files), backend mock-DB unit suites (`course-service` and `user-service`), and frontend Vitest regression suites passed after the final code edits.

The verdict is `PASS WITH LIMITATIONS` (rather than unconditional `PASS`) solely because operational boundaries prohibited connecting to PostgreSQL (ports `5432` and `5433`), rebuilding/starting Docker containers, launching Localhost services, or running live browser/TCP Socket.IO end-to-end verification. Consequently:
- Backend controller, middleware, and Socket.IO handshake tests exercised real Express handlers, JWT verification, and Socket.IO middleware logic against in-memory `globalThis.prismaGlobal` database mocks and mock sockets rather than live PostgreSQL or live TCP transport.
- Frontend component/hook tests ran under Vitest `jsdom` with mocked API services and mocked `SocketContext` (`EventEmitter` / `vi.mock`) rather than live microservices or a real browser.

---

## 2. Exact Implementation Changes by File and Line

### Backend — `services/course-service`

1. **`services/course-service/src/controllers/homework.controller.ts`**
   - Lines `12–24`: Added `buildStudentHomeworkWhere(studentId, institutionId)` scoping student queries strictly to `{ course: { enrollments: { some: { studentId } }, status: 'PUBLISHED', deletedAt: null, ...(institutionId ? { institutionId } : {}) } }`.
   - Lines `33–62`: Added `isActionableStudentHomework(hw, completedAssessmentIds, now)` requiring `PUBLISHED` non-deleted course, zero student submissions, no completed `AssessmentAttempt` (`SUBMITTED`, `GRADED`, `TIME_EXPIRED`), active availability window (`openAt <= now` and `(closeAt || deadline) >= now`), and watched lesson video (`Lesson.progress[0]?.watched === true` whenever `hw.lessonId` is set).
   - Lines `64–128`: Added `getStudentPendingHomeworkCount` endpoint handler enforcing authenticated `userId` (`401` if absent), `STUDENT` role (`403` otherwise), unpaginated authoritative count across all enrolled `PUBLISHED` courses, `AssessmentAttempt` completion lookup, and returning `{ pendingCount, total }`.
   - Lines `137–142`, `154–211`: Updated `getAllHomeworks` to use `buildStudentHomeworkWhere`, load `AssessmentAttempt` completion status, and map `unavailable` when `openAt > now` or `(closeAt || deadline) < now`, keeping student list status semantics aligned with the pending counter.
2. **`services/course-service/src/routes/homework.routes.ts`**
   - Lines `4`, `20`: Imported and registered `GET /api/homework/pending-count` (`router.get('/pending-count', verifyToken, getStudentPendingHomeworkCount)`) before `router.get('/:id', ...)` so `/pending-count` is not captured as a homework `:id`.
3. **`services/course-service/src/index.ts`**
   - Lines `87–99`: Removed dead/unissued `isPlatformSuperAdmin` / `SUPER_ADMIN` `socket.join('admin')` scaffolding from `io.use`. Preserved `user:${resolvedUserId}`, `institution:${decoded.institutionId}:admin`, `branch:${decoded.branchId}:admin`, `teacher:${resolvedUserId}`, and `course:${id}` room joins, plus fail-closed logging when `ADMIN` or `PRIMARY_MANAGER` lacks `institutionId`.

### Backend — `services/user-service`

4. **`services/user-service/src/controllers/accounting/expenses.controller.ts`**
   - Lines `149–168`, `177–217`: In `listExpenseVouchers`, enforced `where.status = 'APPROVED'; where.disbursedAt = null; where.disbursedById = null;` whenever `normalizedStatus === 'APPROVED' || pendingDisbursement === 'true'`, sharing the exact `where` predicate across `db.expenseVoucher.findMany`, `db.expenseVoucher.count`, and `db.expenseVoucher.aggregate`.
5. **`services/user-service/src/controllers/user.controller.ts`**
   - Lines `834–860`: Updated `getParentChildren` to require authenticated `parentId` (`401`), enforce `role === 'PARENT'` (`403`), and filter `{ where: { parentId, deletedAt: null } }`.

### Frontend — `apps/frontend`

6. **`apps/frontend/src/app/services/homework.service.ts`**
   - Line `31`: Added `homeworkService.getPendingCount()` calling `GET /homework/pending-count`.
7. **`apps/frontend/src/app/hooks/useSmartNavigationCounters.ts`**
   - Lines `18–20`, `157`, `259`: Derived primitive scalar dependencies (`userId`, `userRole`, `userInstitutionId`) to prevent unstable object-reference re-render loops.
   - Lines `64–72`, `137–156`: Switched notification error handling from fallback zero to explicit `fetchFailed = true` (`isError = true`), suppressing misleading zero badges when `getUnreadCount()` fails or omits numeric `unreadCount`.
   - Lines `75–97`: Removed unsupported `SUPER_ADMIN` check; scoped approval count to `PRIMARY_MANAGER` and `ADMIN`, reading `summary.totalCount ?? pagination.total` and failing closed (`fetchFailed = true`) if a 50-item page lacks an authoritative total.
   - Lines `99–122`: Scoped disbursement count to `ACCOUNTANT`, preferring `summary.totalCount ?? pagination.total` (matching backend `APPROVED` + `disbursedAt IS NULL` + `disbursedById IS NULL` aggregate) with client-side non-disbursed filter only for proven `< 50` single-page results.
   - Lines `124–136`: Replaced truncated `getAll({ page: 1, limit: 10 })` client-side status guessing with `homeworkService.getPendingCount()` across both Center and Online student roles.
   - Lines `176–191`: Added `window.addEventListener('ox:counters-refresh', handleLocalRefresh)` for immediate in-tab synchronization after REST mutations.
   - Lines `194–258`: Removed 6 unbacked Socket.IO listeners (`notification`, `new_notification`, `notification_read`, `expense_created`, `expense_approved`, `expense_disbursed`), retaining only verified `course-service` producers (`homework_assigned`, `homework_submitted`), and expanded deduplication keys with `versionToken` (`eventId ?? deliveryId ?? updatedAt ?? timestamp ?? submittedAt`) so later state updates on the same entity ID are not suppressed.
8. **`apps/frontend/src/app/components/shared/ContextualGuidanceBanner.tsx`**
   - Lines `179–196`: Removed unsupported `SUPER_ADMIN` role branch, retaining only `PRIMARY_MANAGER` and `ADMIN`.
   - Lines `237–268`: Updated `PARENT` guidance in `resolveStateAwareGuidance` to return `null` while `parentRelationshipLoading || parentRelationshipFailed`, and otherwise render `PARENT_NO_CHILDREN` (`childrenCount === 0`, route `/parent/settings?tab=linking`) or `PARENT_MONITOR_CHILDREN` (route `/parent/children`).
   - Lines `296–459`: Switched student pending homework state fetch to `homeworkService.getPendingCount()`; aligned accountant/manager counts to `summary?.totalCount ?? pagination?.total`; fetched authoritative linked children for `PARENT` via `userService.getChildren()` instead of non-existent `user.children`; subscribed to `ox:relationships-updated` and `ox:counters-refresh`; used scalar effect dependencies.
9. **Dashboard Counter Integration & In-Tab Refresh Dispatchers**
   - `apps/frontend/src/app/components/student-center/StudentCenterDashboard.tsx` (lines `21`, `40`, `48`): Wired `useSmartNavigationCounters().applyBadgesToMenuItems(baseMenuItems)`.
   - `apps/frontend/src/app/components/student-online/StudentOnlineDashboard.tsx` (lines `19`, `38`, `46`): Wired `useSmartNavigationCounters().applyBadgesToMenuItems(baseMenuItems)`.
   - `apps/frontend/src/app/components/teacher/TeacherDashboard.tsx` (lines `23`, `29`, `52`): Wired `useSmartNavigationCounters().applyBadgesToMenuItems(baseMenuItems)`.
   - `apps/frontend/src/app/components/parent/ParentDashboard.tsx` (lines `14`, `28`, `37`): Wired `useSmartNavigationCounters().applyBadgesToMenuItems(baseMenuItems)`.
   - `apps/frontend/src/app/components/shared/SharedLayout.tsx` (lines `72`, `75`): Subscribed top-bar unread notification bell to `ox:counters-refresh`.
   - `apps/frontend/src/app/components/shared/NotificationsPanel.tsx` (lines `75`, `86`): Dispatched `ox:counters-refresh` on mark-read / mark-all-read.
   - `apps/frontend/src/app/components/parent/ParentNotificationsPage.tsx` (lines `46`, `58`): Dispatched `ox:counters-refresh` on mark-read / mark-all-read.
   - `apps/frontend/src/app/components/primary-manager/ApprovalsPage.tsx` (lines `54`, `72`): Dispatched `ox:counters-refresh` after approve/reject voucher mutations.
   - `apps/frontend/src/app/components/accountant/ExpensesPage.tsx` (line `106`): Dispatched `ox:counters-refresh` after `disburseExpenseVoucher` succeeds.
   - `apps/frontend/src/app/components/student-shared/HomeworkPage.tsx` (line `107`): Dispatched `ox:counters-refresh` after homework submission.
   - `apps/frontend/src/app/components/shared/AccountSettingsPage.tsx` (lines `302`, `317`): Dispatched `ox:relationships-updated` when linking or approving family relationships.

### Tests Added or Updated

- Created `services/course-service/homework_pending_count.test.ts` (268 lines, 6 backend controller/middleware test cases).
- Created `services/user-service/test/accountingDisbursementCounter.test.ts` (391 lines, 6 backend controller test cases).
- Updated `services/course-service/socket_security_isolation.test.ts` (lines `204–223` tests `5a-1` & `5a-2` updated to assert global `admin` room inaccessibility even with synthetic `isPlatformSuperAdmin` or `SUPER_ADMIN` claims).
- Updated `apps/frontend/src/app/test/SmartNotificationCounters.test.tsx` (updated student homework counter, `SUPER_ADMIN` removal, `ox:counters-refresh`, error fail-closed, and supported Socket.IO event expectations).
- Updated `apps/frontend/src/app/test/RealtimeCounterLifecycle.test.tsx` (aligned with `homeworkService.getPendingCount`, supported `homework_assigned`/`homework_submitted` Socket.IO events, versioned deduplication, and `ox:counters-refresh`).
- Updated `apps/frontend/src/app/test/StudentOnlineDashboard.test.tsx`, `apps/frontend/src/app/test/TeacherDashboard.test.tsx`, and `apps/frontend/src/app/test/ParentDashboard.test.tsx` (lines `173–176` wrapped synchronous check in `await waitFor` to match sibling async effect tests).

---

## 3. Before / After Behavior

| Area | Before Remediation | After Remediation |
| :--- | :--- | :--- |
| **Student Homework Sidebar Counter** | `useSmartNavigationCounters` called `homeworkService.getAll({ page: 1, limit: 10 })`, truncating counts above 10 and filtering by `'PENDING'` (non-existent status). | Calls `GET /api/homework/pending-count`; Center and Online student dashboards share identical backend filtering and live badges via `applyBadgesToMenuItems`. |
| **Accountant Disbursement Counter** | Backend `listExpenseVouchers` with `status=APPROVED` included already-disbursed vouchers (`disbursedAt != null` or `disbursedById != null`), inflating `summary.totalCount` and `pagination.total`. | `listExpenseVouchers` with `status=APPROVED` or `pendingDisbursement=true` enforces `disbursedAt: null` and `disbursedById: null` across `findMany`, `count`, and `aggregate`. |
| **Parent Linked-Child Guidance** | `ContextualGuidanceBanner` read `user.children` (never populated by `auth-service` JWT or profile), causing linked parents to see `PARENT_NO_CHILDREN`, and omitted `role === 'PARENT'` check in backend `getParentChildren` filter beyond `parentId`. | Banner calls `userService.getChildren()` (`GET /api/users/parent/children`), stays hidden while loading or failed, and updates on `ox:relationships-updated`; backend enforces `role === 'PARENT'` + `deletedAt: null`. |
| **Notification Failure Handling** | Failed `getUnreadCount()` calls left unread count as `0` without marking error state. | Sets `fetchFailed = true` (`isError = true`), preventing silent `0` counts from presenting as authoritative. |
| **Socket.IO Listeners & Deduplication** | Frontend subscribed to 6 nonexistent backend events (`notification`, `new_notification`, `notification_read`, `expense_created`, `expense_approved`, `expense_disbursed`) and deduplicated solely by `eventName:entityId`, suppressing subsequent legitimate updates on the same entity ID. | Subscribes only to verified `course-service` producers (`homework_assigned`, `homework_submitted`), refreshes via polling/focus/visibility/reconnect + `ox:counters-refresh`, and deduplicates using `${eventName}:${id}:${versionToken}`. |
| **Global `admin` Room & `SUPER_ADMIN` Claims** | `course-service/src/index.ts`, `useSmartNavigationCounters.ts`, `ContextualGuidanceBanner.tsx`, and `socket_security_isolation.test.ts` (`5a-1`/`5a-2`) still contained dead/synthetic `SUPER_ADMIN` / `isPlatformSuperAdmin` references. | Dead `SUPER_ADMIN` / `isPlatformSuperAdmin` / `socket.join('admin')` scaffolding removed; tests assert global `admin` room remains unreachable even with synthetic claims. |

---

## 4. Student Homework Status Contract

From `services/course-service/src/controllers/homework.controller.ts` (`getStudentPendingHomeworkCount`, `isActionableStudentHomework`, `getAllHomeworks`):

- **Database / Authoritative Scope (`buildStudentHomeworkWhere`):**
  - Course must belong to a `CourseEnrollment` for the authenticated `studentId`.
  - Course `status` must equal `'PUBLISHED'` (`deletedAt: null`), excluding `'DRAFT'` and soft-deleted courses.
  - Scoped to `institutionId` when present on the authenticated student context.
- **Actionability Rules (`isActionableStudentHomework`):**
  - Not already submitted in `Submission` for `studentId`.
  - Not already completed in `AssessmentAttempt` for `studentId` with status in `['SUBMITTED', 'GRADED', 'TIME_EXPIRED']`.
  - Not before `openAt` (`openAt <= now`).
  - Not past effective deadline (`(closeAt || deadline) >= now`).
  - Not locked behind an unwatched lesson (`hw.lessonId` absent, OR `Lesson.progress` has `watched: true` for `studentId`).
- **`getAllHomeworks` Student Status Mapping:**
  - `'completed'` when submitted or has a completed `AssessmentAttempt`.
  - `'unavailable'` when unsubmitted and outside the `[openAt, closeAt || deadline]` window.
  - `'available'` otherwise, with `isLocked: true` computed separately when an attached lesson video is unwatched.

---

## 5. Backend Disbursement Query and Aggregate Consistency

In `services/user-service/src/controllers/accounting/expenses.controller.ts` (`listExpenseVouchers`, lines `160–217`):

- When query `status` normalizes to `'APPROVED'` OR `pendingDisbursement === 'true'`, the query builds a single `where` object:
  ```ts
  where.status = 'APPROVED';
  where.disbursedAt = null;
  where.disbursedById = null;
  ```
- Preceding scope resolution (`resolveAccountingReportScope(req)`) enforces:
  - `institutionId` strictly from authenticated user/tenant context.
  - `branchId` strictly locked for `ACCOUNTANT` users; unassigned accountants fail closed with `403`.
- The identical `where` predicate is passed to all three Prisma queries in `Promise.all`:
  1. `db.expenseVoucher.findMany({ where, ... })` (paginated `vouchers`)
  2. `db.expenseVoucher.count({ where })` (`pagination.total`)
  3. `db.expenseVoucher.aggregate({ where, _sum: { amount: true }, _count: { id: true } })` (`summary.totalCount`, `summary.totalAmount`)
- Once `disburseExpenseVoucher` sets `status: 'APPLIED'`, `disbursedAt`, and `disbursedById`, the voucher immediately fails all three conditions and is excluded from both the paginated list and aggregate totals.

---

## 6. Parent Linked-Child Resolution and Actionable-Task Status

- **Authoritative Relationship Source:** `GET /api/users/parent/children` routed to `getParentChildren` (`services/user-service/src/controllers/user.controller.ts:834–860`), which verifies `req.user?.userId` (`401`), enforces `role === 'PARENT'` (`403`), and queries `db.user.findMany({ where: { parentId, deletedAt: null }, ... })`. Arbitrary client-supplied child IDs are never used to bypass parent ownership.
- **Guidance Integration:** `ContextualGuidanceBanner.tsx` fetches `userService.getChildren()` for `PARENT` users, suppresses misleading onboarding banners during `parentRelationshipLoading` or `parentRelationshipFailed`, routes unlinked parents to `/parent/settings?tab=linking`, and updates dynamically via `ox:relationships-updated`.
- **Distinct Parent Actionable-Task Counter Classification:** **NOT IMPLEMENTED / UNAVAILABLE.** Inspection of `packages/database/prisma/schema.prisma` confirmed no distinct parent actionable-task entity exists beyond `User.parentId` / `Role.PARENT` and standard `Notification` records. Per Section 6 requirement 8, ordinary informational notifications are displayed strictly as `unreadNotifications` via `GET /api/notifications/unread-count` in `ParentDashboard.tsx` and are not misrepresented as actionable parent tasks.

---

## 7. Socket.IO Producer-Consumer Matrix

| Event Name | Backend Producer Confirmed? | Producer Location & Target Rooms | Frontend Counter Consumer & Handling | Notes |
| :--- | :--- | :--- | :--- | :--- |
| `homework_assigned` | **Yes** | `services/course-service/src/controllers/homework.controller.ts` (`createHomework`) → `course:${courseId}` | `useSmartNavigationCounters.ts` listens on `socket.on('homework_assigned', ...)` and triggers REST `fetchCounters()`. | Deduplicated by `homework_assigned:<id>:<versionToken>`. |
| `homework_submitted` | **Yes** | `services/course-service/src/controllers/homework.controller.ts` (`emitHomeworkSubmissionNotification`) → `teacher:${teacherId}`, `institution:${institutionId}:admin`, verified `branch:${branchId}:admin` | `useSmartNavigationCounters.ts` listens on `socket.on('homework_submitted', ...)` and triggers REST `fetchCounters()`. | Zero global `admin` fallback; missing/mismatched branch relation withheld fail-closed. |
| `notification` | **No** | No backend emitter (`user-service` has no Socket.IO server). | Listener removed from `useSmartNavigationCounters.ts`. | Supported via 30s polling, focus, visibility, reconnect, and `ox:counters-refresh`. |
| `new_notification` | **No** | No backend emitter. | Listener removed from `useSmartNavigationCounters.ts`. | Supported via REST polling + `ox:counters-refresh`. |
| `notification_read` | **No** | No backend emitter. | Listener removed from `useSmartNavigationCounters.ts`. | Mark-read UI dispatches `ox:counters-refresh` locally; REST `getUnreadCount()` refreshes state. |
| `expense_created` | **No** | No backend emitter (`user-service` has no Socket.IO server). | Listener removed from `useSmartNavigationCounters.ts`. | Supported via REST polling, focus, visibility, and reconnect. |
| `expense_approved` | **No** | No backend emitter. | Listener removed from `useSmartNavigationCounters.ts`. | `ApprovalsPage.tsx` dispatches `ox:counters-refresh`; accountants sync on poll/focus/visibility/reconnect. |
| `expense_disbursed` | **No** | No backend emitter. | Listener removed from `useSmartNavigationCounters.ts`. | `ExpensesPage.tsx` dispatches `ox:counters-refresh` after disbursement. |

---

## 8. Global Admin Room Disposition

- **Disposition:** **Removed / Permanently Inaccessible.**
- Verified from prior audit baseline and current source (`packages/database/prisma/schema.prisma`, `services/auth-service/src/controllers/auth.controller.ts`, `packages/shared/src/accounting/center/roles.ts`):
  - `Role` enum does not contain `SUPER_ADMIN` (`FORBIDDEN_ROLES` explicitly forbids it).
  - `User` model has no `isPlatformSuperAdmin` column.
  - `auth-service` never mints `SUPER_ADMIN` or `isPlatformSuperAdmin` JWT claims.
- `services/course-service/src/index.ts` lines `87–99` no longer contain any `socket.join('admin')` or `isPlatformSuperAdmin` / `SUPER_ADMIN` handshake branch.
- `socket_security_isolation.test.ts` tests `5a-1` & `5a-2` confirm that even synthetically signed tokens carrying `isPlatformSuperAdmin: true` or `role: 'SUPER_ADMIN'` cannot join room `admin`.
- Confirmed zero active `io.emit` or `io.to('admin')` homework/course broadcasts remain in the remediated controllers.

---

## 9. Tenant and Branch Authorization Evidence

- **Student Homework (`services/course-service`):** Authenticated `userId` and `STUDENT` role required; cross-role (`TEACHER`, `PARENT`, `ACCOUNTANT`) calls return `403`; queries enforce `{ enrollments: { some: { studentId } }, status: 'PUBLISHED', deletedAt: null }` plus `institutionId` when present on token.
- **Course Branch & Homework Notification (`services/course-service`):** Course creation/update rejects foreign or non-existent `branchId` relative to authoritative `institutionId`; `emitHomeworkSubmissionNotification` withholds `branch:${branchId}:admin` emission if branch relation is unloaded or belongs to another institution (`course_branch_ownership_and_notification.test.ts`: 18/18 passed).
- **Accounting Disbursement (`services/user-service`):** `resolveAccountingReportScope` binds queries to authenticated `institutionId`, locks `ACCOUNTANT` to assigned `branchId`, and denies unassigned or cross-branch accountants with `403` (`accountingDisbursementCounter.test.ts` test #3).
- **Parent Children (`services/user-service`):** `getParentChildren` enforces `role === 'PARENT'` (`403` otherwise) and filters strictly by authenticated `req.user.userId` (`parentId`) and `deletedAt: null` (`accountingDisbursementCounter.test.ts` test #6).
- **Note:** Database foreign-key/row state in tests ran against in-memory `globalThis.prismaGlobal` mocks rather than a live PostgreSQL instance.

---

## 10. Test Commands, Exit Codes, and Exact Totals

All suites below were executed **after the final code and test edits**.

### Backend Suites (`course-service` & `user-service`)

1. **Command:**
   `Set-Location "D:\OX-DIGITAL\Mathe\OX-DIGITAL-GITHUB\services\course-service"; npx.cmd tsc --noEmit; npx.cmd tsx socket_security_isolation.test.ts; npx.cmd tsx homework_pending_count.test.ts; npx.cmd tsx course_branch_ownership_and_notification.test.ts`
   - **Working Directory:** `D:\OX-DIGITAL\Mathe\OX-DIGITAL-GITHUB\services\course-service`
   - **Exit Codes:** `TSC_EXIT=0`, `SOCK_EXIT=0`, `HW_EXIT=0`, `BR_EXIT=0`
   - **Exact Totals:**
     - `socket_security_isolation.test.ts`: **20 PASSED, 0 FAILED**
     - `homework_pending_count.test.ts`: **6 PASSED, 0 FAILED**
     - `course_branch_ownership_and_notification.test.ts`: **18 PASSED, 0 FAILED**
   - **Mocked Layers & Auth Coverage:** Uses in-memory `globalThis.prismaGlobal` DB mock and mock Express `req`/`res` or mock Socket.IO server/sockets. **Backend authorization IS exercised** via real `verifyToken` middleware, real `io.use` JWT verification + room-assignment logic, real `resolveCourseCreationScope` / `emitHomeworkSubmissionNotification`, and real controller role checks (`401`/`403`/tenant scope).

2. **Command:**
   `Set-Location "D:\OX-DIGITAL\Mathe\OX-DIGITAL-GITHUB\services\user-service"; npx.cmd tsc --noEmit; npx.cmd tsx test/accountingDisbursementCounter.test.ts`
   - **Working Directory:** `D:\OX-DIGITAL\Mathe\OX-DIGITAL-GITHUB\services\user-service`
   - **Exit Codes:** `TSC_EXIT=0`, `ACC_EXIT=0`
   - **Exact Totals:**
     - `test/accountingDisbursementCounter.test.ts`: **6 PASSED, 0 FAILED**
   - **Mocked Layers & Auth Coverage:** Uses in-memory `globalThis.prismaGlobal` DB mock and mock Express `req`/`res`. **Backend authorization IS exercised** via real `listExpenseVouchers` + `resolveAccountingReportScope`, `disburseExpenseVoucher`, and `getParentChildren` (`403` cross-branch / unassigned branch / non-parent enforcement).

### Frontend Suites (`apps/frontend`)

3. **Command:**
   `Set-Location "D:\OX-DIGITAL\Mathe\OX-DIGITAL-GITHUB\apps\frontend"; npx.cmd vitest run --no-file-parallelism src/app/test/SmartNotificationCounters.test.tsx src/app/test/RealtimeCounterLifecycle.test.tsx src/app/test/StateAwareOnboarding.test.tsx src/app/test/StudentCenterDashboard.test.tsx src/app/test/StudentOnlineDashboard.test.tsx src/app/test/TeacherDashboard.test.tsx src/app/test/AccountantDashboard.test.tsx src/app/test/PrimaryManagerDashboard.test.tsx`
   - **Working Directory:** `D:\OX-DIGITAL\Mathe\OX-DIGITAL-GITHUB\apps\frontend`
   - **Exit Code:** `0`
   - **Exact Totals:** **8 test files passed (8), 112 tests passed (112), 0 failed** (`SmartNotificationCounters.test.tsx`: 30, `RealtimeCounterLifecycle.test.tsx`: 10, `StateAwareOnboarding.test.tsx`: 15, `StudentCenterDashboard.test.tsx`: 11, `StudentOnlineDashboard.test.tsx`: 11, `TeacherDashboard.test.tsx`: 12, `AccountantDashboard.test.tsx`: 12, `PrimaryManagerDashboard.test.tsx`: 11).
   - **Warnings:** Expected negative-path `console.error` outputs (intentional error-state tests in `StudentCenterDashboard`, `StudentOnlineDashboard`, `TeacherDashboard`), Recharts `width(0)/height(0)` warnings in `jsdom`, and React `act(...)` warnings in `AccountantDashboard.test.tsx` & `TeacherDashboard.test.tsx`.
   - **Mocked Layers & Auth Coverage:** `jsdom` environment with `vi.mock` for API services (`notificationService`, `accountingService`, `homeworkService`, `courseService`, `analyticsService`, `userService`), `AuthContext`, and `SocketContext`. **Backend authorization is NOT exercised** in Vitest runs.

4. **Command:**
   `Set-Location "D:\OX-DIGITAL\Mathe\OX-DIGITAL-GITHUB\apps\frontend"; npx.cmd vitest run --no-file-parallelism src/app/test/ParentDashboard.test.tsx src/app/test/CourseStatistics.test.tsx`
   - **Working Directory:** `D:\OX-DIGITAL\Mathe\OX-DIGITAL-GITHUB\apps\frontend`
   - **Exit Code:** `0`
   - **Exact Totals:** **2 test files passed (2), 16 tests passed (16), 0 failed** (`ParentDashboard.test.tsx`: 13, `CourseStatistics.test.tsx`: 3).
   - **Warnings:** Intentional Axios `Network Error` / `500 Server Error` console logs in negative tests, `MemoryRouter` initial route logs, and `ParentHomePage` `act(...)` warning on initial loading test.
   - **Mocked Layers & Auth Coverage:** `jsdom` with `vi.mock` API/auth/socket mocks; **backend authorization is NOT exercised**.

---

## 11. TypeScript / Build Status

- **`services/course-service`** (`npx.cmd tsc --noEmit`): **PASS (Exit Code `0`, 0 errors)**.
- **`services/user-service`** (`npx.cmd tsc --noEmit`): **PASS (Exit Code `0`, 0 errors)**.
- **`apps/frontend`** (`npx.cmd tsc --noEmit`): **EXITED WITH CODE `2`** due to pre-existing/test-file errors only; **0 TypeScript errors exist in any production file modified by this task**. Reported errors from compiler output:
  - *Pre-existing unrelated production/test errors (untouched by this task):*
    - `AccountantHomePage.tsx` (1 error: `TS2339` `isCancelled` on `ReceiptItem`)
    - `ParentSubscriptionPage.tsx` (1 error: `TS2339` `getParentChildren` on `userService`)
    - `BranchesPage.tsx` (3 errors: `TS2353` `role` on `UserFilters`)
    - `TeamManagementPage.tsx` (1 error: `TS2339` `branches` on `never`)
    - `ComprehensiveLocalizationRemediation.test.tsx` (2 errors: `TS2741` missing `icon` on `MenuItem`)
    - `CriticalThemeLifecycle.test.tsx` (3 errors: missing `@types/node` for `fs`, `path`, `__dirname`)
    - `CrossBranchSecurityNegative.test.tsx` (1 error: `TS18048` `'res.body'` possibly undefined)
    - `SevenThemesVerification.test.tsx` (3 errors: missing `@types/node` for `fs`, `path`, `__dirname`)
  - *Test-file typing errors in modified Vitest suite:*
    - `RealtimeCounterLifecycle.test.tsx` (10 errors: missing `@types/node` for `events` `EventEmitter` type on `MockSocket`, and 3 fixture arrays passing `icon: 'string'` instead of a React `ComponentType` into `applyBadgesToMenuItems`). Vitest compiles with esbuild and passes all 10 tests in the suite.

---

## 12. Remaining Limitations and Risks

1. **No Live PostgreSQL Query Execution:** Neither port `5432` nor `5433` was accessed; Prisma SQL generation for `buildStudentHomeworkWhere`, `AssessmentAttempt` queries, `listExpenseVouchers`, and `getParentChildren` was verified only against TypeScript Prisma types and in-memory mock behavior.
2. **No Cross-Service Real-Time Broker for Notifications or Expenses:** `user-service` has no Socket.IO server and no event broker connects `user-service` to `course-service`. Accounting and notification counters synchronize across browser tabs/sessions via 30s polling, window focus, tab visibility, socket reconnect, and in-tab `ox:counters-refresh` dispatches rather than instant cross-user push events.
3. **Pagination Fallback Risk on Custom Limit Changes:** In `useSmartNavigationCounters.ts`, manager approval and accountant disbursement counts rely on `summary.totalCount ?? pagination.total`, falling back to deduplicated list length only when `< 50` items return. As long as backend `listExpenseVouchers` continues returning `summary.totalCount` and `pagination.total`, counts above 50 stay exact.
4. **No Distinct Parent Actionable Task Domain:** Parent sidebar notification badges accurately reflect unread notifications (`GET /api/notifications/unread-count`); no separate parent task counter exists unless/until a parent acknowledgment/task model is designed in schema and APIs.
5. **Pre-existing Frontend TypeScript Errors:** Running workspace-wide `tsc --noEmit` in `apps/frontend` returns exit code `2` until pre-existing errors in untouched files (`AccountantHomePage.tsx`, `ParentSubscriptionPage.tsx`, `BranchesPage.tsx`, `TeamManagementPage.tsx`) and `@types/node` test typings are cleaned up separately.

---

## 13. Files Changed

- **Backend Production:**
  - `services/course-service/src/controllers/homework.controller.ts`
  - `services/course-service/src/routes/homework.routes.ts`
  - `services/course-service/src/index.ts`
  - `services/user-service/src/controllers/accounting/expenses.controller.ts`
  - `services/user-service/src/controllers/user.controller.ts`
- **Backend Tests:**
  - `services/course-service/homework_pending_count.test.ts` *(new)*
  - `services/course-service/socket_security_isolation.test.ts`
  - `services/user-service/test/accountingDisbursementCounter.test.ts` *(new)*
- **Frontend Production:**
  - `apps/frontend/src/app/services/homework.service.ts`
  - `apps/frontend/src/app/hooks/useSmartNavigationCounters.ts`
  - `apps/frontend/src/app/components/shared/ContextualGuidanceBanner.tsx`
  - `apps/frontend/src/app/components/shared/SharedLayout.tsx`
  - `apps/frontend/src/app/components/shared/NotificationsPanel.tsx`
  - `apps/frontend/src/app/components/shared/AccountSettingsPage.tsx`
  - `apps/frontend/src/app/components/student-center/StudentCenterDashboard.tsx`
  - `apps/frontend/src/app/components/student-online/StudentOnlineDashboard.tsx`
  - `apps/frontend/src/app/components/teacher/TeacherDashboard.tsx`
  - `apps/frontend/src/app/components/parent/ParentDashboard.tsx`
  - `apps/frontend/src/app/components/parent/ParentNotificationsPage.tsx`
  - `apps/frontend/src/app/components/primary-manager/ApprovalsPage.tsx`
  - `apps/frontend/src/app/components/accountant/ExpensesPage.tsx`
  - `apps/frontend/src/app/components/student-shared/HomeworkPage.tsx`
- **Frontend Tests:**
  - `apps/frontend/src/app/test/SmartNotificationCounters.test.tsx`
  - `apps/frontend/src/app/test/RealtimeCounterLifecycle.test.tsx`
  - `apps/frontend/src/app/test/StudentOnlineDashboard.test.tsx`
  - `apps/frontend/src/app/test/TeacherDashboard.test.tsx`
  - `apps/frontend/src/app/test/ParentDashboard.test.tsx`
- **Deliverable Report:**
  - `FINAL_SMART_COUNTERS_HOMEWORK_ACCOUNTING_PARENT_GUIDANCE_REMEDIATION_REPORT.md` *(new)*

---

## 14. Operational Boundary Confirmation

Confirmed: During this remediation and verification session, **zero** operations were performed against any database (neither port `5432` nor `5433`, SQL, migrations, seeds, or schema changes), **zero** Docker or Compose commands were executed, **zero** Localhost servers or browser sessions were activated, and **zero** Git commands were run.

