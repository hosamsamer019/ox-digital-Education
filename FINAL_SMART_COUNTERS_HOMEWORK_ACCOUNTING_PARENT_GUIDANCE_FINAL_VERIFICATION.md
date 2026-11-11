# OX-DIGITAL Education — Final Read-Only Verification of Smart Counters & Onboarding Remediation

**Date:** November 11, 2026  
**Workspace:** `D:\OX-DIGITAL\Mathe\OX-DIGITAL-GITHUB`  
**Mode:** Strictly Read-Only Verification (zero source, test, config, database, runtime, Docker, Localhost, or Git state mutations)  
**Target Reviewed:** `FINAL_SMART_COUNTERS_HOMEWORK_ACCOUNTING_PARENT_GUIDANCE_REMEDIATION_REPORT.md`

---

## 1. Overall Verdict

**Overall Verdict:** `PASS WITH LIMITATIONS`

The remediations documented in `FINAL_SMART_COUNTERS_HOMEWORK_ACCOUNTING_PARENT_GUIDANCE_REMEDIATION_REPORT.md` accurately address the targeted smart counter, student homework count, accountant disbursement filter, parent linked-child guidance, unsupported Socket.IO listener, and `course-service` socket `admin` room issues, and all unit/Vitest suites pass after the final edits.

The verdict is `PASS WITH LIMITATIONS` rather than unconditional `PASS` because:
1. Live PostgreSQL databases (`5432` / `5433`), running Express/Socket.IO microservices, and live browser sessions remain unverified under read-only runtime boundaries.
2. `course-service` and `user-service` backend suites call controller functions directly against in-memory `globalThis.prismaGlobal` mocks and do not exercise Express routing/middleware stacks end-to-end.
3. Workspace-wide `apps/frontend` `npx.cmd tsc --noEmit` exits with code `2` due to `10` TypeScript diagnostics in modified test file `RealtimeCounterLifecycle.test.tsx` and `15` diagnostics across `8` files outside the scope of this remediation (`0` errors in any modified production file).
4. Legacy `email === 'admin@edu.com'` / `SUPER_ADMIN` / `isPlatformSuperAdmin` checks remain in untouched `services/course-service/src/controllers/course.controller.ts` and `services/course-service/src/utils/enrollment.ts` (outside this remediation's modified files, flagged below as a narrow security follow-up).

---

## 2. Per-Area Verification Verdicts

| Area | Verdict | Summary |
| :--- | :--- | :--- |
| **Verification 1 — Student Homework Counter** | `PASS WITH LIMITATIONS` | Route, auth middleware mounting, server-derived student identity, actionability rules, and >10 count confirmed; backend tests bypass `verifyToken` middleware and omit explicit missing-`institutionId` / `500` DB-failure cases; minor UI label issue in `HomeworkPage.tsx`. |
| **Verification 2 — Accountant Disbursement Counter** | `PASS WITH LIMITATIONS` | `listExpenseVouchers` applies identical `status = 'APPROVED'`, `disbursedAt = null`, `disbursedById = null`, and server-derived branch/institution scope across `findMany`, `count`, and `aggregate`; tests invoke handlers directly with mock DB; `ExpensesPage.tsx` list status label checks only `v.status === 'APPROVED'`. |
| **Verification 3 — Parent/Child Authorization & Guidance** | `PASS WITH LIMITATIONS` | `getParentChildren` enforces `PARENT` role (`403` otherwise), `parentId`, and `deletedAt: null`; `ContextualGuidanceBanner` and `useSelectedChild` use `userService.getChildren()` safely; parent notifications remain distinct and parent task counter stays `NOT IMPLEMENTED`; backend test lacks explicit `401` and query-tamper assertions (confirmed in source). |
| **Verification 4 — Socket.IO & Counter Refresh Lifecycle** | `PASS WITH LIMITATIONS` | Only confirmed `course-service` producers (`homework_assigned`, `homework_submitted`) remain registered; `course-service/src/index.ts` `admin` room & Super Admin scaffolding removed; REST remains authoritative and `ox:counters-refresh` / `ox:relationships-updated` dispatches match listeners; fallback key without `versionToken` can still collapse repeat events lacking timestamps; no live TCP/WebSocket test run. |
| **Verification 5 — TypeScript & Test Evidence** | `PASS WITH LIMITATIONS` | `course-service` and `user-service` `tsc --noEmit` exit `0`; all 4 backend `tsx` suites (`50` tests total) and all 10 frontend Vitest files (`128` tests total) pass after final edits; `apps/frontend` `tsc --noEmit` exits `2` (`0` errors in modified production files, `10` in `RealtimeCounterLifecycle.test.tsx`, `15` in 8 untouched files). |
| **Verification 6 — Change Scope & Consistency** | `PASS WITH LIMITATIONS` | Diffs match reported files, prior branch/course-broadcast fixes remain intact, and zero hardcoded numeric sidebar badges remain; untouched legacy files `course.controller.ts` & `enrollment.ts` still retain `SUPER_ADMIN` / `admin@edu.com` checks. |

---

## 3. Verification 1 — Student Homework Counter

### Source Evidence & Line References
- Service mount & route protection:
  - `services/course-service/src/index.ts:43` mounts `app.use('/api/homework', homeworkRoutes)`.
  - `services/course-service/src/routes/homework.routes.ts:19–22` registers `router.get('/pending-count', verifyToken, getStudentPendingHomeworkCount)` before `router.get('/:id', verifyToken, getHomeworkDetails)`, preventing `/pending-count` from matching `:id`.
  - `services/course-service/src/middlewares/auth.middleware.ts:17–126` (`verifyToken`) verifies JWT signature, rejects video-stream/guest/external-student tokens, calls `verifyAuthoritativeAccountState(userId)`, and overwrites `req.user` with DB-authoritative `userId`, `role`, `institutionId`, `branchId`, `isPrimaryManager`, and enforces financial restriction for `CENTER_STUDENT` (`403`).
- Controller semantics:
  - `services/course-service/src/controllers/homework.controller.ts:12–24` (`buildStudentHomeworkWhere`): filters by `course: { enrollments: { some: { studentId } }, status: 'PUBLISHED', deletedAt: null, ...(institutionId ? { institutionId } : {}) }`.
  - `services/course-service/src/controllers/homework.controller.ts:33–62` (`isActionableStudentHomework`): excludes non-`PUBLISHED` or deleted courses, existing `submissions`, completed `AssessmentAttempt` (`SUBMITTED`, `GRADED`, `TIME_EXPIRED`), future `openAt > now`, expired `(closeAt || deadline) < now`, and locked homework (`hw.lessonId` set without `Lesson.progress[0]?.watched === true`).
  - `services/course-service/src/controllers/homework.controller.ts:64–128` (`getStudentPendingHomeworkCount`): derives `userId` and `requesterRole` from `req.user` (`401` if `!userId`, `403` if `!requesterRole.includes('STUDENT')`), queries without pagination limit (`skip`/`take`), queries `assessmentAttempt`, and returns `{ pendingCount, total }` (or `500` on error).
  - `services/course-service/src/controllers/homework.controller.ts:137–211` (`getAllHomeworks`): applies `buildStudentHomeworkWhere`, queries `AssessmentAttempt`, sets `status = 'unavailable'` when unsubmitted and outside `[openAt, closeAt || deadline]`, and preserves `isLocked`.
- Frontend consumers:
  - `apps/frontend/src/app/services/homework.service.ts:31–32` defines `getPendingCount: () => homeworkApi.get('/pending-count')`.
  - `apps/frontend/src/app/hooks/useSmartNavigationCounters.ts:124–136` invokes `homeworkService.getPendingCount()` for both `STUDENT` and `.includes('STUDENT')` roles (`CENTER_STUDENT`, `ONLINE_STUDENT`) and sets `fetchFailed = true` (`isError = true`) on missing numeric `pendingCount` or error.
  - `apps/frontend/src/app/components/student-center/StudentCenterDashboard.tsx:40,48` and `StudentOnlineDashboard.tsx:38,46` both apply `useSmartNavigationCounters().applyBadgesToMenuItems(baseMenuItems)`.
  - `apps/frontend/src/app/components/shared/ContextualGuidanceBanner.tsx:330–349` fetches `homeworkService.getPendingCount()`.

### Confirmed vs Unverified / Edge Cases
- **Confirmed:** Server identity derivation, `> 10` count accuracy (`15` actionable tested in `homework_pending_count.test.ts:41–53,198–218`), Center + Online semantic equivalence, exclusion of submitted/completed/locked/future/expired/draft/deleted/unenrolled/foreign-institution items, query `studentId` tampering ignored (`homework_pending_count.test.ts:201`).
- **Unverified / Gaps:**
  - `homework_pending_count.test.ts` calls controller functions directly and does **not** exercise Express routing or `verifyToken` middleware.
  - `homework_pending_count.test.ts` supplies `institutionId: INST_1` in all authenticated cases; there is no explicit test for missing/null `institutionId` (where `buildStudentHomeworkWhere` omits `courseFilter.institutionId`) or DB error (`500`).
  - `HomeworkPage.tsx:52,231`: when `getAllHomeworks` returns `status = 'unavailable'` (e.g., future `openAt > now`), `HomeworkPage.tsx:182` prevents opening it (`hw.status === 'pending' || hw.status === 'available'`), **but** line `231` still renders `'بانتظار التسليم'` in the fallback badge branch, and line `52` filters expiry via `hw.deadlineRaw` rather than `closeAt`.

---

## 4. Verification 2 — Accountant Disbursement Counter

### Source Evidence & Line References
- `services/user-service/src/routes/accounting.routes.ts:51,75,77`: mounts `router.use(verifyToken, tenantContextMiddleware())` and `GET /expenses` (`checkRole(['ACCOUNTANT', 'PRIMARY_MANAGER', 'ADMIN'])` → `listExpenseVouchers`), `POST /expenses/:id/disburse` (`disburseExpenseVoucher`).
- `services/user-service/src/utils/accountingScope.util.ts:27–103` (`resolveAccountingReportScope`): derives `institutionId` from `req.user` / `req.tenantContext` (`401` if missing); locks `ACCOUNTANT` to `req.user.branchId` (`403` if unassigned or if `req.query.branchId !== assignedBranchId`); validates `PRIMARY_MANAGER` optional `branchId` against DB `branch.institutionId === institutionId` (`403` otherwise).
- `services/user-service/src/controllers/accounting/expenses.controller.ts:137–221` (`listExpenseVouchers`):
  - Lines `160–168`: when `normalizedStatus === 'APPROVED' || pendingDisbursement === 'true'`, enforces `where.status = 'APPROVED'; where.disbursedAt = null; where.disbursedById = null;`.
  - Lines `177–217`: passes the identical `where` object into `db.expenseVoucher.findMany`, `db.expenseVoucher.count`, and `db.expenseVoucher.aggregate`, returning `summary.totalCount: aggregateTotals._count.id`, `summary.totalAmount`, and `pagination.total: total`.
- `services/user-service/src/controllers/accounting/expenses.controller.ts:418–434` (`disburseExpenseVoucher`): atomically updates `status: 'APPLIED'`, `disbursedById`, `disbursedAt` inside `db.$transaction`.
- Callers:
  - `apps/frontend/src/app/hooks/useSmartNavigationCounters.ts:99–122`: calls `accountingService.getExpenses({ status: 'APPROVED' })`, prioritizes backend `summary.totalCount ?? pagination.total`, uses client-side `!v.disbursedAt && !v.disbursedById` filter only when `< 50` vouchers return without backend total, and fails closed (`fetchFailed = true`) if `50` items return without totals.
  - `apps/frontend/src/app/components/shared/ContextualGuidanceBanner.tsx:364–380`: uses matching `summary.totalCount ?? pagination.total`.
  - `apps/frontend/src/app/components/accountant/ExpensesPage.tsx:35,48,290`: lists all vouchers (`getExpenses({ limit: 50 })`) to display creation/approval/disbursement history.

### Confirmed vs Unverified / Edge Cases
- **Confirmed:** All 6 test assertions in `services/user-service/test/accountingDisbursementCounter.test.ts:267–382` verify exclusion of `disbursedAt != null`, `disbursedById != null`, `APPLIED`, `PENDING_APPROVAL`, `REJECTED`, cross-branch, and cross-institution records; `disburseExpenseVoucher` dropping count from `1` to `0`; `403` on cross-branch `query.branchId` & unassigned accountant; `> 50` pagination (`50` page length vs `55` `summary.totalCount` and `pagination.total`).
- **Unverified / Gaps:**
  - `accountingDisbursementCounter.test.ts` calls handlers directly with `mockDb`, bypassing `verifyToken`, `tenantContextMiddleware`, and `checkRole` middleware in `accounting.routes.ts`.
  - `ExpensesPage.tsx:48,290` renders the `"معتمد - جاهز للصرف"` badge and `"صرف النقدية الآن"` button on `v.status === 'APPROVED'` without checking `!v.disbursedAt && !v.disbursedById` (safe for normal `disburseExpenseVoucher` transitions which set `status: 'APPLIED'`, but would disagree with `listExpenseVouchers` if anomalous `APPROVED` + `disbursedAt != null` data ever existed in DB).

---

## 5. Verification 3 — Parent/Child Authorization and Guidance

### Source Evidence & Line References
- `services/user-service/src/routes/user.routes.ts:25,51`: protects `/parent/children` with `verifyToken` and `tenantContextMiddleware()` before dispatching `getParentChildren`.
- `services/user-service/src/middlewares/auth.middleware.ts:44–65`: verifies user state in DB via `verifyAuthoritativeAccountState` and binds `req.user.userId` and `req.user.role`.
- `services/user-service/src/controllers/user.controller.ts:834–860` (`getParentChildren`): enforces `if (!parentId) return res.status(401)...`, `if (role !== 'PARENT') return res.status(403)...`, and queries `db.user.findMany({ where: { parentId, deletedAt: null }, ... })`. No request query/params/body input is read.
- Relationship schema & mutations: `packages/database/prisma/schema.prisma` models parent-child linkage via `User.parentId` + `Role.PARENT`; `linkParentStudent` / `unlinkParentStudent` (`user.controller.ts:1153–1313`) validate active parent/student roles, matching institutions, and actor authorization before updating `parentId`.
- Frontend consumers:
  - `apps/frontend/src/app/services/user.service.ts:107–110`: calls `userApi.get('/parent/children')`.
  - `apps/frontend/src/app/components/shared/ContextualGuidanceBanner.tsx:238–268,400–446`: returns `null` when `parentRelationshipLoading || parentRelationshipFailed`, renders `PARENT_NO_CHILDREN` (`actionRoute: '/parent/settings?tab=linking'`) or `PARENT_MONITOR_CHILDREN` (`actionRoute: '/parent/children'`), and listens to `ox:relationships-updated` and `ox:counters-refresh`.
  - `apps/frontend/src/app/components/parent/useSelectedChild.ts:28,48–56`: fetches `userService.getChildren()` and falls back to `children[0]` if `?child=` does not match a returned child ID.
  - `apps/frontend/src/app/components/parent/ParentDashboard.tsx:28,37,60–61`: mounts `/settings` (`AccountSettingsPage`), applies `useSmartNavigationCounters` for `/parent/notifications` (`unreadNotifications` from `GET /api/notifications/unread-count`), and renders zero separate parent actionable-task counters.
  - `apps/frontend/src/app/test/SmartNotificationCounters.test.tsx:547–605` tests 2-child live fetch, relationship failure suppressing zero-children banner, and `ox:relationships-updated` re-engagement.

### Confirmed vs Unverified / Edge Cases
- **Confirmed:** Role enforcement (`403` for non-parents), soft-deleted & cross-parent child exclusion (`accountingDisbursementCounter.test.ts:364–382`), empty/single/multi-child & failed-fetch guidance handling, distinction between unread notifications and non-existent parent tasks.
- **Unverified / Gaps:**
  - `accountingDisbursementCounter.test.ts` test #6 does not execute an unauthenticated (`401`) or query-tampered (`req.query = { parentId: 'parent-2' }`) test against `getParentChildren` (confirmed by code inspection of `user.controller.ts:836–845`).
  - Untouched sibling endpoint `getLinkedRelationships` (`user.controller.ts:1329`) includes `children: { select: ... }` without a `where: { deletedAt: null }` filter; `ContextualGuidanceBanner`, `useSelectedChild`, `ParentHomePage`, and `ParentChildrenPage` all use `userService.getChildren()` (`/parent/children`), not `getLinkedRelationships`.

---

## 6. Verification 4 — Socket.IO and Counter Refresh Lifecycle

### Source Evidence & Line References
- `services/course-service/src/index.ts:72–120`: authenticates JWT handshake tokens; joins `user:${resolvedUserId}`, `institution:${decoded.institutionId}:admin` + optional `branch:${decoded.branchId}:admin` (for `ADMIN` / `PRIMARY_MANAGER` when `institutionId` is present; fail-closed warning otherwise), `teacher:${resolvedUserId}` + owned `course:${c.id}`, and enrolled `course:${e.courseId}` for `STUDENT`/`PARENT`. Contains zero `socket.join('admin')`, `SUPER_ADMIN`, or `isPlatformSuperAdmin` branches.
- Confirmed backend producers:
  - `homework_assigned`: `services/course-service/src/controllers/homework.controller.ts:372` (`io.to(\`course:${courseId}\`).emit('homework_assigned', homework)`).
  - `homework_submitted`: `services/course-service/src/controllers/homework.controller.ts:491–562,669` (`emitHomeworkSubmissionNotification` → `teacher:${teacherId}`, `institution:${institutionId}:admin`, and `branch:${branchId}:admin` only when `branch.institutionId === course.institutionId`; zero `admin` room fallback).
- Unbacked events (`user-service` has no Socket.IO server — inspected `services/user-service/src/index.ts`):
  - `notification`, `new_notification`, `notification_read`, `expense_created`, `expense_approved`, `expense_disbursed` have no backend producers and were removed from `useSmartNavigationCounters.ts:249–258`.
- Counter lifecycle & UI dispatches:
  - `apps/frontend/src/app/hooks/useSmartNavigationCounters.ts:159–259`: 30s polling, `focus`, `visibilitychange`, `ox:counters-refresh`, reconnect recovery (`socketConnected && !prevConnectedRef.current && isMountedRef.current`), stale sequence guard (`currentSeq === fetchSequenceRef.current`), scalar dependencies `[userId, userRole, userInstitutionId]`, and listener cleanup on unmount/change.
  - Verified `ox:counters-refresh` dispatchers: `NotificationsPanel.tsx:75,86`, `ParentNotificationsPage.tsx:46,58`, `ApprovalsPage.tsx:54,72`, `ExpensesPage.tsx:106`, `HomeworkPage.tsx:107`; consumed by `useSmartNavigationCounters.ts:183` and `SharedLayout.tsx:72`.
  - Verified `ox:relationships-updated` dispatchers: `AccountSettingsPage.tsx:302,317`; consumed by `ContextualGuidanceBanner.tsx:439`.

### Confirmed vs Unverified / Edge Cases
- **Confirmed:** Only backed homework events remain registered; REST remains the single counter truth; `RealtimeCounterLifecycle.test.tsx` (10/10 passed) and `socket_security_isolation.test.ts` (20/20 passed) verify reconnect/focus/versioned-dedup/tenant-filtering and removal of global `admin` access.
- **Unverified / Edge Cases:**
  - **Null `versionToken` deduplication fallback (`useSmartNavigationCounters.ts:219–232`):** If any producer or emitter sends `payload.id` without `eventId`/`deliveryId`/`updatedAt`/`timestamp`/`submittedAt`, `eventKey` falls back to `` `${eventName}:${payload.id}` ``, which would suppress a subsequent emission sharing the same `payload.id`. Prisma models `Homework` (`schema.prisma:378`) and `Submission` (`schema.prisma:398`) both include `updatedAt @updatedAt`, mitigating this for direct ORM returns, but missing/unchanged timestamps remain vulnerable.
  - **`handledEventIdsRef` across user changes:** `handledEventIdsRef` is not cleared when `userId` changes without unmounting the hook.
  - **No real TCP/WebSocket verification:** All Socket.IO checks used `MockSocket` (`EventEmitter`) and in-memory `MockIO`.

---

## 7. Verification 5 — TypeScript and Test Evidence

### Exact Executed Logs Inspected
1. **`services/course-service` TypeScript & Backend Suites** (`task-20677.log`):
   - `npx.cmd tsc --noEmit`: **Exit `0`** (`TSC_EXIT=0`, 0 errors).
   - `npx.cmd tsx socket_security_isolation.test.ts`: **Exit `0`**, **20 PASSED, 0 FAILED** (`SOCK_EXIT=0`, MockSocket + JWT + `globalThis.prismaGlobal` mock DB).
   - `npx.cmd tsx homework_pending_count.test.ts`: **Exit `0`**, **6 PASSED, 0 FAILED** (`HW_EXIT=0`, direct controller calls + `globalThis.prismaGlobal` mock DB).
   - `npx.cmd tsx course_branch_ownership_and_notification.test.ts`: **Exit `0`**, **18 PASSED, 0 FAILED** (`BR_EXIT=0`, direct controller/helper calls + `globalThis.prismaGlobal` mock DB + MockIO).
2. **`services/user-service` TypeScript & Backend Suite** (`task-20678.log`):
   - `npx.cmd tsc --noEmit`: **Exit `0`** (`TSC_EXIT=0`, 0 errors).
   - `npx.cmd tsx test/accountingDisbursementCounter.test.ts`: **Exit `0`**, **6 PASSED, 0 FAILED** (`ACC_EXIT=0`, direct controller calls + `globalThis.prismaGlobal` mock DB).
3. **`apps/frontend` 8 Smart Counter & Dashboard Vitest Suites** (`steps/20670/output.txt`):
   - **Exit `0`**, **8 test files passed (8), 112 tests passed (112), 0 failed** (`jsdom` + `vi.mock` APIs & sockets):
     - `StudentCenterDashboard.test.tsx`: `11` passed
     - `StudentOnlineDashboard.test.tsx`: `11` passed
     - `AccountantDashboard.test.tsx`: `12` passed
     - `PrimaryManagerDashboard.test.tsx`: `11` passed
     - `TeacherDashboard.test.tsx`: `12` passed
     - `SmartNotificationCounters.test.tsx`: `30` passed
     - `RealtimeCounterLifecycle.test.tsx`: `10` passed
     - `StateAwareOnboarding.test.tsx`: `15` passed
4. **`apps/frontend` ParentDashboard & CourseStatistics Vitest Suites** (`task-20683.log`, run after final `ParentDashboard.test.tsx` edit):
   - **Exit `0`**, **2 test files passed (2), 16 tests passed (16), 0 failed** (`jsdom` + `vi.mock`):
     - `ParentDashboard.test.tsx`: `13` passed
     - `CourseStatistics.test.tsx`: `3` passed
5. **`apps/frontend` TypeScript Check** (`npx.cmd tsc --noEmit`, `task-20687.log`):
   - **Exit `2` (`FRONTEND_TSC_EXIT=2`) — Failed overall TypeScript compilation**, with **25 diagnostics** total (Vitest still ran and passed because Vitest transpiles via esbuild without `tsc` type-checking).
   - **Modified Production Files:** **0 diagnostics**.

### Complete Frontend TypeScript Diagnostic Classification (`task-20687.log`)

#### A. Modified Test File (`apps/frontend/src/app/test/RealtimeCounterLifecycle.test.tsx`) — 10 Diagnostics
- `RealtimeCounterLifecycle.test.tsx(8,30)`: `TS2307` — Cannot find module `'events'` (due to `apps/frontend/tsconfig.json:18` specifying `"types": ["vite/client"]` without `@types/node`).
- `RealtimeCounterLifecycle.test.tsx(89,24)`: `TS2339` — Property `'removeAllListeners'` does not exist on type `'MockSocket'` (cascade from line 8).
- `RealtimeCounterLifecycle.test.tsx(145,61)`: `TS2345` — Fixture array item `{ id, label, icon: string, path }` passed to `applyBadgesToMenuItems(MenuItem[])` (`icon` expects `ComponentType`).
- `RealtimeCounterLifecycle.test.tsx(175,61)`: `TS2345` — Same `icon: string` vs `MenuItem` mismatch.
- `RealtimeCounterLifecycle.test.tsx(200,61)`: `TS2345` — Same `icon: string` vs `MenuItem` mismatch.
- `RealtimeCounterLifecycle.test.tsx(223,26)`: `TS2339` — Property `'emit'` does not exist on type `'MockSocket'` (cascade from line 8).
- `RealtimeCounterLifecycle.test.tsx(285,26)`: `TS2339` — Same `'emit'` error.
- `RealtimeCounterLifecycle.test.tsx(294,26)`: `TS2339` — Same `'emit'` error.
- `RealtimeCounterLifecycle.test.tsx(301,26)`: `TS2339` — Same `'emit'` error.
- `RealtimeCounterLifecycle.test.tsx(328,26)`: `TS2339` — Same `'emit'` error.

#### B. Files Untouched by This Remediation — 15 Diagnostics
*(Note: Because no pre-remediation `tsc --noEmit` baseline log was captured in this session before edits began, these are strictly classified as untouched during this remediation rather than certified pre-existing relative to `HEAD`, especially since `git status` shows prior uncommitted work in this tree.)*
- `src/app/components/accountant/AccountantHomePage.tsx(371,32)`: `TS2339` — Property `'isCancelled'` does not exist on type `'ReceiptItem'`.
- `src/app/components/parent/ParentSubscriptionPage.tsx(32,37)`: `TS2339` — Property `'getParentChildren'` does not exist on `userService`.
- `src/app/components/primary-manager/BranchesPage.tsx(110,48)`: `TS2353` — `'role'` does not exist in type `'UserFilters'`.
- `src/app/components/primary-manager/BranchesPage.tsx(131,48)`: `TS2353` — `'role'` does not exist in type `'UserFilters'`.
- `src/app/components/primary-manager/BranchesPage.tsx(152,48)`: `TS2353` — `'role'` does not exist in type `'UserFilters'`.
- `src/app/components/primary-manager/TeamManagementPage.tsx(90,70)`: `TS2339` — Property `'branches'` does not exist on type `'never'`.
- `src/app/test/ComprehensiveLocalizationRemediation.test.tsx(134,9)`: `TS2741` — Property `'icon'` is missing in `{ path: string; label: string; }`.
- `src/app/test/ComprehensiveLocalizationRemediation.test.tsx(135,9)`: `TS2741` — Property `'icon'` is missing in `{ path: string; label: string; }`.
- `src/app/test/CriticalThemeLifecycle.test.tsx(7,21)`: `TS2307` — Cannot find module `'fs'`.
- `src/app/test/CriticalThemeLifecycle.test.tsx(8,23)`: `TS2307` — Cannot find module `'path'`.
- `src/app/test/CriticalThemeLifecycle.test.tsx(178,34)`: `TS2304` — Cannot find name `'__dirname'`.
- `src/app/test/CrossBranchSecurityNegative.test.tsx(149,12)`: `TS18048` — `'res.body'` is possibly `'undefined'`.
- `src/app/test/SevenThemesVerification.test.tsx(5,21)`: `TS2307` — Cannot find module `'fs'`.
- `src/app/test/SevenThemesVerification.test.tsx(6,23)`: `TS2307` — Cannot find module `'path'`.
- `src/app/test/SevenThemesVerification.test.tsx(35,34)`: `TS2304` — Cannot find name `'__dirname'`.

---

## 8. Verification 6 — Change Scope, Diffs & Consistency

- Read-only `git status --short`, `git diff --stat`, and `git diff` across all modified tracked files confirm:
  - Changes align strictly with the scoped remediation files listed in Section 13 of `FINAL_SMART_COUNTERS_HOMEWORK_ACCOUNTING_PARENT_GUIDANCE_REMEDIATION_REPORT.md` (alongside prior uncommitted workspace changes already present in `git status`).
  - Zero earlier security fixes were reverted (`emitHomeworkSubmissionNotification`, branch ownership validation in `course.controller.ts`, `course_created` removal, and `disburseExpenseVoucher` branch isolation remain intact).
  - Zero hardcoded numeric `badge` properties remain in any role dashboard (`AdminDashboard`, `PrimaryManagerDashboard`, `AccountantDashboard`, `TeacherDashboard`, `StudentCenterDashboard`, `StudentOnlineDashboard`, `ParentDashboard`).
- **Remaining Inconsistency Flagged Outside Modified Diff:**
  - `services/course-service/src/controllers/course.controller.ts` (lines `49`, `51`, `118–132`, `227`, `314`, `564–584`, `711`, `886–1415`) and `services/course-service/src/utils/enrollment.ts` (lines `12`, `83`) still contain `SUPER_ADMIN`, `isPlatformSuperAdmin`, and `email?.toLowerCase() === 'admin@edu.com'` branches. Although `auth-service` never mints `SUPER_ADMIN`/`isPlatformSuperAdmin` and `course-service/src/index.ts` no longer joins `'admin'`, retaining an `email === 'admin@edu.com'` check in those two files conflicts with the goal of eliminating email-based fallback and legacy `SUPER_ADMIN` references across `course-service`.

---

## 9. Uncovered Edge Cases & Minimal Recommended Corrective Follow-Ups

### Safe to Close Remediation Scope vs Recommended Narrow Follow-Ups
All core counter, disbursement-query, parent-guidance, and socket-room remediation goals from the approved scope are **implemented and verified within mock-based unit limits**. However, if strict cleanup and full TypeScript/middleware closure are desired prior to final release sign-off, the minimal follow-up items are:

1. **Remove Residual Email / `SUPER_ADMIN` Checks in `course-service` (Security Hygiene):**
   - Remove `SUPER_ADMIN` / `isPlatformSuperAdmin` / `admin@edu.com` checks in `services/course-service/src/controllers/course.controller.ts` (notably line `711`) and `services/course-service/src/utils/enrollment.ts` (lines `12`, `83`).
2. **Fix TypeScript Fixtures in `RealtimeCounterLifecycle.test.tsx` (10 errors):**
   - Replace `EventEmitter` import with a tiny in-file typed mock emitter (`on`/`off`/`emit`/`removeAllListeners`) and pass component icons (`() => null` or `CheckSquare`) instead of strings in lines `142`, `172`, `197`.
3. **Add Missing Edge-Case Assertions to Backend Unit Suites:**
   - In `homework_pending_count.test.ts`: add cases for missing `institutionId` (`undefined`/`null`) and DB exception (`500`), and wire a router/Supertest-style test exercising `verifyToken`.
   - In `accountingDisbursementCounter.test.ts`: add `401` and query-tamper (`?parentId=...`) cases for `getParentChildren`.
4. **Defensive UI & Hook Refinements (Non-Blocking):**
   - In `useSmartNavigationCounters.ts:226–232`: avoid deduplicating events without a `versionToken` (`if (payload.id && versionToken) ...` only), and reset `handledEventIdsRef.current.clear()` when `userId` changes.
   - In `ExpensesPage.tsx:48,290`: guard `status === 'APPROVED' && !v.disbursedAt && !v.disbursedById` to match backend `listExpenseVouchers`.
   - In `HomeworkPage.tsx:52,231`: check `hw.closeAt || hw.deadlineRaw` and render a dedicated label for `status === 'unavailable'`.
   - In `user.controller.ts:1329` (`getLinkedRelationships`): add `where: { deletedAt: null }` to included `children`.

---

## 10. Read-Only Operational Confirmation

Confirmed: Throughout this final verification pass:
- **Zero** source, test, config, or package files were edited (only the requested deliverable `FINAL_SMART_COUNTERS_HOMEWORK_ACCOUNTING_PARENT_GUIDANCE_FINAL_VERIFICATION.md` was written).
- **Zero** database connections, queries, migrations, seeds, or schema mutations were executed on ports `5432`, `5433`, or elsewhere.
- **Zero** Docker, container, Localhost server, or browser commands were executed.
- **Zero** Git state mutations (`checkout`, `reset`, `clean`, `commit`, `pull`, `push`, `branch`) were performed; only read-only `git status` / `git diff` inspections were run.

