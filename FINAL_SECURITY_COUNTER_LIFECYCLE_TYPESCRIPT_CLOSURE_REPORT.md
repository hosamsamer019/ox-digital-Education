# OX-DIGITAL Education — Final Security Hygiene, Counter Lifecycle & TypeScript Closure Report

**Date:** November 11, 2026  
**Workspace:** `D:\OX-DIGITAL\Mathe\OX-DIGITAL-GITHUB`  
**Prior Verification Baseline:** `FINAL_SMART_COUNTERS_HOMEWORK_ACCOUNTING_PARENT_GUIDANCE_FINAL_VERIFICATION.md`  
**Execution Scope:** Narrowly scoped Phases 1–8 closure + regression verification (no DB, Docker, Localhost, browser, or Git state mutations).

---

## 1. Exact Files Changed

### Backend Production
1. `services/course-service/src/utils/enrollment.ts`
2. `services/course-service/src/controllers/course.controller.ts`
3. `services/course-service/src/controllers/homework.controller.ts`
4. `services/user-service/src/controllers/user.controller.ts`

### Backend Tests
5. `services/course-service/course_ownership_authorization.test.ts`
6. `services/course-service/homework_pending_count.test.ts`
7. `services/user-service/test/accountingDisbursementCounter.test.ts`

### Frontend Production
8. `apps/frontend/src/app/hooks/useSmartNavigationCounters.ts`
9. `apps/frontend/src/app/components/accountant/ExpensesPage.tsx`
10. `apps/frontend/src/app/components/student-shared/HomeworkPage.tsx`

### Frontend Tests
11. `apps/frontend/src/app/test/RealtimeCounterLifecycle.test.tsx`
12. `apps/frontend/src/app/test/AccountantDashboard.test.tsx`
13. `apps/frontend/src/app/test/HomeworkPage.test.tsx` *(new)*

### Report Deliverable
14. `FINAL_SECURITY_COUNTER_LIFECYCLE_TYPESCRIPT_CLOSURE_REPORT.md` *(new)*

---

## 2. Exact Legacy Privilege Checks Removed & Replacement Authorization Behavior

All code-level occurrences of `SUPER_ADMIN`, `isPlatformSuperAdmin`, and `email === 'admin@edu.com'` were removed from `services/course-service/src`:

1. **`services/course-service/src/utils/enrollment.ts`** (`lines 9–89`):
   - **Removed:** `isSuperAdmin`, `user.isPlatformSuperAdmin`, `role === 'SUPER_ADMIN'`, `user.email?.toLowerCase() === 'admin@edu.com'`, `dbUser.email?.toLowerCase() === 'admin@edu.com'`, and legacy `isSuperAdmin` bypasses on unscoped courses (`!course.institutionId`) and cross-institution courses (`course.institutionId`).
   - **Replacement Behavior:**
     - Legacy unscoped courses (`!course.institutionId`) allow access **only** when `role === 'TEACHER' && course.teacherId === userId`; all other users/managers/claims fail closed (`false`).
     - Scoped institution courses (`course.institutionId`) strictly require `Boolean(userInstitutionId && userInstitutionId === course.institutionId)` for every role.
     - `isManagerOrAdmin` recognizes strictly `ADMIN`, `PRIMARY_MANAGER`, or `isPrimaryManager === true` within matching institution scope.

2. **`services/course-service/src/controllers/course.controller.ts`**:
   - **`getRequesterInfo` & `getAuthorizedInstitutionId`** (`lines 43–60`): Removed `role === 'SUPER_ADMIN'` and `tenantContext?.isPlatformSuperAdmin`; centralized authoritative institution extraction from server-populated `req.tenantContext?.institutionId ?? req.user?.institutionId`.
   - **`getCourses` (`lines 118–133`) & `getLessons` (`lines 554–575`):** Removed `!tenantContext.isPlatformSuperAdmin` branches. Teachers see owned courses within their institution (or own legacy `institutionId: null` courses); students require an authenticated `institutionId` + `enrollments`; all non-teacher roles fail closed with `institutionId: 'FAIL_CLOSED_NO_TENANT'` when `institutionId` is absent.
   - **`getAvailableCourses` & `enrollCourse` (`lines 226–230`, `310–316`):** Missing `institutionId` fails closed on `getAvailableCourses` and returns `403 Forbidden` on `enrollCourse` (aligning with `checkUserEnrollment`).
   - **`getCourseDetails` (`lines 697–712`):** Removed `isSuperAdmin`, `SUPER_ADMIN`, `isPlatformSuperAdmin`, and `req.user?.email?.toLowerCase() === 'admin@edu.com'`. Institutional courses require matching `institutionId`; legacy unscoped courses allow only `requesterRole === 'TEACHER' && course.teacherId === requesterId`.
   - **`createCourse`, `updateCourse`, `createLesson`, `updateLesson`, `deleteCourse`, `deleteLesson`, `getVideoAnalytics`, `getUploads` (`lines 868–1416`):** Removed all `!tenantContext.isPlatformSuperAdmin` exceptions. Scoped courses/lessons strictly enforce `course.institutionId === authoritativeInstitutionId`; unscoped courses (`!course.institutionId`) fail closed against arbitrary admins; `getUploads` scopes `ADMIN` / `PRIMARY_MANAGER` strictly to `institutionId || 'FAIL_CLOSED_NO_TENANT'`.

3. **Regression Evidence (`services/course-service/course_ownership_authorization.test.ts`):**
   - Scenarios `28` & `29` confirm that users/tokens carrying `email: 'admin@edu.com'`, `role: 'SUPER_ADMIN'`, or `isPlatformSuperAdmin: true` receive `403 Forbidden` on `getCourseDetails`, `enrollCourse`, `updateCourse`, zero courses on `getCourses`, and `false` from `checkUserEnrollment` across both institutional (`COURSE_1_ID`) and unscoped (`COURSE_LEGACY_A_ID`) courses.

---

## 3. Student Homework Tenant-Context Decision & Tests

### Decision: Institution Context Is Mandatory & Fail-Closed for Students
- Verified across schema/controllers/auth: `services/auth-service/src/controllers/auth.controller.ts:32–36` disables public self-registration, `services/course-service/src/utils/enrollment.ts:59–78` rejects students on unscoped courses and requires `userInstitutionId === course.institutionId`, and `packages/database/src/index.ts:123–165` (`verifyAuthoritativeAccountState` called by `verifyToken` in `course-service/src/middlewares/auth.middleware.ts:82–102`) binds `req.user.institutionId` from PostgreSQL.
- Allowing `buildStudentHomeworkWhere` to omit `institutionId` when missing created an unnecessary widening mismatch with `checkUserEnrollment`.

### Implementation (`services/course-service/src/controllers/homework.controller.ts`)
- **`buildStudentHomeworkWhere` (`lines 12–25`):** Always sets `course.institutionId = safeInstitutionId` (`'FAIL_CLOSED_NO_TENANT'` if blank/missing).
- **`getStudentPendingHomeworkCount` (`lines 68–85`) & `getAllHomeworks` (`lines 145–158`):** Derive `institutionId` strictly from `(req as any).tenantContext?.institutionId ?? (req.user as any)?.institutionId` (never from `req.query` or `req.body`) and return `403 Forbidden` (`code: 'TENANT_CONTEXT_MISSING'`) whenever missing, `null`, or blank.

### Tests Added (`services/course-service/homework_pending_count.test.ts`, Tests 7–9)
- Test `7`: Missing `institutionId` (`undefined`) fails closed with `403 TENANT_CONTEXT_MISSING` on both `getStudentPendingHomeworkCount` and `getAllHomeworks`, even when `query.institutionId` is tampered.
- Test `8`: `null`, empty `''`, and whitespace `'   '` `institutionId` values fail closed with `403 TENANT_CONTEXT_MISSING`.
- Test `9`: Database exception (`db.homework.findMany` throws) returns HTTP `500` without exposing `undefined`/zero `pendingCount`.

---

## 4. Counter Deduplication Lifecycle Behavior & Tests

### Implementation (`apps/frontend/src/app/hooks/useSmartNavigationCounters.ts`)
- **User Switch Lifecycle Cleanup (`lines 159–171`):** When `userId` changes without unmounting the hook, an effect clears `handledEventIdsRef.current`, resets `prevConnectedRef` / `isMountedRef`, resets all counter values to `0`, and clears `isError` prior to `fetchCounters()` running for the new user.
- **Strict Version-Token Deduplication (`lines 233–257`):** Deduplication keys are created **only** when a reliable version token (`eventId ?? deliveryId ?? updatedAt ?? timestamp ?? submittedAt`) is non-empty (`hasVersionToken`). Events with `payload.id` and **no** version token yield `eventKey = null` and are never suppressed by `eventName + payload.id` alone. Repeat deliveries sharing the same version token remain deduplicated, and legitimate updates with a new version token trigger refresh.
- Preserved: 30s polling, `focus`, `visibilitychange`, `ox:counters-refresh`, reconnect recovery, stale sequence guard, listener cleanup, and REST as single source of truth.

### Tests Updated (`apps/frontend/src/app/test/RealtimeCounterLifecycle.test.tsx`, Tests 7, 11, 12, 13)
- Test `7`: Suppresses exact duplicate `(id, updatedAt)` and refreshes when `updatedAt` advances.
- Test `11`: Emitting `{ id: 'hw-no-ver' }` twice without a version token triggers REST refresh both times.
- Test `12`: Switching `student-user-A` → `student-user-B` without unmount clears User A state/dedup cache, fetches User B count (`1`), and accepts an `(id, updatedAt)` previously seen under User A (`1 → 2`).
- Test `13`: Disconnected → connected transition triggers refetch (`2 → 3`), and unmount removes `homework_assigned` & `homework_submitted` socket listeners (`listenerCount === 0`).

---

## 5. Accountant UI & Homework UI Consistency Changes

### Accountant Expenses UI (`apps/frontend/src/app/components/accountant/ExpensesPage.tsx`)
- Added [`isPendingDisbursementVoucher(v)`](file:///D:/OX-DIGITAL/Mathe/OX-DIGITAL-GITHUB/apps/frontend/src/app/components/accountant/ExpensesPage.tsx#L20-L22) checking `v.status === 'APPROVED' && !v.disbursedAt && !v.disbursedById` to match backend `listExpenseVouchers`.
- Updated voucher normalization (`lines 41–69`) and card rendering (`lines 281–312`) so anomalous `APPROVED` vouchers carrying `disbursedAt` or `disbursedById` display `"تم الصرف بنجاح"` with emerald styling and **never** render the `"صرف النقدية الآن"` button.
- Regression test in `apps/frontend/src/app/test/AccountantDashboard.test.tsx` (`9/9+` -> test #8 in file, `13/13` passing) verifies anomalous `APPROVED` vouchers with `disbursedAt` or `disbursedById` cannot render the disburse action and only genuine undisbursed `APPROVED` records remain actionable.

### Student Homework UI (`apps/frontend/src/app/components/student-shared/HomeworkPage.tsx`)
- Unified deadline field (`lines 43–50`): computes `effectiveCloseAt = hw.closeAt || hw.deadline || null` for both formatted deadline display and past-due filtering.
- Handled `status === 'unavailable'` explicitly (`lines 175–255`): applies disabled styling, displays dedicated `'غير متاح حالياً'` status badge (never `'بانتظار التسليم'`), and blocks opening with `toast.info(t('هذا الواجب غير متاح للتسليم حالياً'))`.
- Focused test suite `apps/frontend/src/app/test/HomeworkPage.test.tsx` (`2/2` tests passed) verifies `available`, `pending` (`draft`), `unavailable`, expired via `closeAt` (when `deadline: null`) and `deadline`, `completed`, and `isLocked: true` across both `ONLINE_STUDENT` and `CENTER_STUDENT`.

---

## 6. Parent Relationship Filtering Decision & Tests

### Decision
- Audited all callers of `getLinkedRelationships` across backend (`services/user-service/src/routes/user.routes.ts:34–37`, `services/user-service/src/controllers/brdSubscription.controller.ts:1565–1567`) and frontend (`apps/frontend/src/app/services/user.service.ts:172–187`, `apps/frontend/src/app/components/shared/AccountSettingsPage.tsx:119`).
- `getLinkedRelationships` exposes active user-linked relationships (`branch`, `parent`, `children`, `teachers`, `branchAccountants`) to the authenticated `userId`. Returning soft-deleted `children` or a soft-deleted `parent` was inconsistent with `getParentChildren` (`where: { parentId, deletedAt: null }`).

### Implementation (`services/user-service/src/controllers/user.controller.ts:1326–1360`)
- Added `where: { deletedAt: null }` to the `children` Prisma relation on `db.user.findUnique` in `getLinkedRelationships`.
- Selected `deletedAt` on `parent` and returned `parent: null` if the parent record is soft-deleted, preserving all response keys relied on by `AccountSettingsPage.tsx`.

### Tests (`services/user-service/test/accountingDisbursementCounter.test.ts`, Tests 6–7)
- Test `6` expanded to verify `401` on missing user and query-parameter `parentId` tamper immunity on `getParentChildren`.
- Test `7` verifies `getLinkedRelationships` excludes soft-deleted `child-deleted` and foreign `child-other`, returning only `['child-1', 'child-2']` for `parent-1` and `['child-other']` for `parent-2`.

---

## 7. TypeScript Diagnostics Before & After

| Package / Command | Diagnostics Before Phases 1–7 | Diagnostics After Phases 1–7 | Exit Code After | Status & Classification |
| :--- | :---: | :---: | :---: | :--- |
| `services/course-service` (`npx.cmd tsc --noEmit`) | `0` | `0` | `0` | **PASS** |
| `services/user-service` (`npx.cmd tsc --noEmit`) | `0` | `0` | `0` | **PASS** |
| `apps/frontend` (`npx.cmd tsc --noEmit`) | `25` | `15` | `2` | **FAIL overall `tsc`**, with **0 errors in modified production files** and **0 errors in modified test files** (down from 10 in `RealtimeCounterLifecycle.test.tsx`). |

### Modified Test File Fix (`RealtimeCounterLifecycle.test.tsx`: `10 → 0` Diagnostics)
- Replaced Node `'events'` `EventEmitter` import with an in-file typed `MockSocket` (`on`, `off`, `emit`, `removeAllListeners`, `listenerCount`) and replaced `'CheckSquare'`/`'Receipt'`/`'BookOpen'` string icons with a `MenuItem`-compatible `MockIcon` component. Remaining diagnostics in `RealtimeCounterLifecycle.test.tsx`: **0**.

### Remaining 15 Frontend TypeScript Diagnostics (All in Untouched Files)
*(Note: No pre-workspace-change baseline `tsc` log existed prior to this session's earlier remediation work; these 15 errors are strictly verified as untouched by this Phases 1–8 closure task.)*
- Untouched production files (6 diagnostics):
  - `src/app/components/accountant/AccountantHomePage.tsx(371,32)`: `TS2339` Property `'isCancelled'` does not exist on `'ReceiptItem'`.
  - `src/app/components/parent/ParentSubscriptionPage.tsx(32,37)`: `TS2339` Property `'getParentChildren'` does not exist on `userService`.
  - `src/app/components/primary-manager/BranchesPage.tsx(110,48)`, `(131,48)`, `(152,48)`: `TS2353` `'role'` does not exist in `'UserFilters'`.
  - `src/app/components/primary-manager/TeamManagementPage.tsx(90,70)`: `TS2339` Property `'branches'` does not exist on type `'never'`.
- Untouched test files (9 diagnostics):
  - `src/app/test/ComprehensiveLocalizationRemediation.test.tsx(134,9)`, `(135,9)`: `TS2741` Property `'icon'` missing on `MenuItem`.
  - `src/app/test/CriticalThemeLifecycle.test.tsx(7,21)`, `(8,23)`, `(178,34)`: `TS2307`/`TS2304` Cannot find `'fs'`, `'path'`, `'__dirname'`.
  - `src/app/test/CrossBranchSecurityNegative.test.tsx(149,12)`: `TS18048` `'res.body'` possibly `'undefined'`.
  - `src/app/test/SevenThemesVerification.test.tsx(5,21)`, `(6,23)`, `(35,34)`: `TS2307`/`TS2304` Cannot find `'fs'`, `'path'`, `'__dirname'`.

---

## 8. All Test Commands, Exit Codes, Counts & Mock/Live Classification

All commands below ran sequentially **after final source and test edits**:

1. **`services/course-service`**
   - Command: `Set-Location "D:\OX-DIGITAL\Mathe\OX-DIGITAL-GITHUB\services\course-service"; npx.cmd tsc --noEmit; npx.cmd tsx socket_security_isolation.test.ts; npx.cmd tsx homework_pending_count.test.ts; npx.cmd tsx course_branch_ownership_and_notification.test.ts; npx.cmd tsx course_ownership_authorization.test.ts`
   - Exit codes: `COURSE_TSC_EXIT=0`, `SOCK_EXIT=0`, `HW_EXIT=0`, `BR_EXIT=0`, `OWN_EXIT=0`
   - Counts:
     - `socket_security_isolation.test.ts`: **20 PASSED, 0 FAILED** *(MockSocket + JWT + in-memory `globalThis.prismaGlobal` DB mock)*
     - `homework_pending_count.test.ts`: **9 PASSED, 0 FAILED** *(direct controller handlers + `globalThis.prismaGlobal` DB mock)*
     - `course_branch_ownership_and_notification.test.ts`: **18 PASSED, 0 FAILED** *(direct controllers/helper + `globalThis.prismaGlobal` DB mock + MockIO)*
     - `course_ownership_authorization.test.ts`: **29 PASSED, 0 FAILED** *(direct controllers + `verifyToken` + `checkUserEnrollment` + in-memory DB mock)*
   - Backend totals: **76 / 76 scenarios passed** (mock DB/mock sockets; **not** live PostgreSQL or live Express/TCP).

2. **`services/user-service`**
   - Command: `Set-Location "D:\OX-DIGITAL\Mathe\OX-DIGITAL-GITHUB\services\user-service"; npx.cmd tsc --noEmit; npx.cmd tsx test/accountingDisbursementCounter.test.ts`
   - Exit codes: `USER_TSC_EXIT=0`, `USER_ACC_EXIT=0`
   - Counts:
     - `test/accountingDisbursementCounter.test.ts`: **7 PASSED, 0 FAILED** *(direct controllers `listExpenseVouchers`, `disburseExpenseVoucher`, `getParentChildren`, `getLinkedRelationships` + `globalThis.prismaGlobal` DB mock; **not** live PostgreSQL or live Express)*

3. **`apps/frontend` TypeScript Check**
   - Command: `Set-Location "D:\OX-DIGITAL\Mathe\OX-DIGITAL-GITHUB\apps\frontend"; npx.cmd tsc --noEmit`
   - Exit code: `FRONTEND_TSC_EXIT=2` (`15` errors in 8 untouched files; `0` errors in modified production or test files).

4. **`apps/frontend` Vitest Suites (Sequential `--no-file-parallelism`)**
   - Command: `Set-Location "D:\OX-DIGITAL\Mathe\OX-DIGITAL-GITHUB\apps\frontend"; npx.cmd vitest run --no-file-parallelism src/app/test/SmartNotificationCounters.test.tsx src/app/test/RealtimeCounterLifecycle.test.tsx src/app/test/StateAwareOnboarding.test.tsx src/app/test/StudentCenterDashboard.test.tsx src/app/test/StudentOnlineDashboard.test.tsx src/app/test/ParentDashboard.test.tsx src/app/test/AccountantDashboard.test.tsx src/app/test/TeacherDashboard.test.tsx src/app/test/PrimaryManagerDashboard.test.tsx src/app/test/CourseStatistics.test.tsx src/app/test/HomeworkPage.test.tsx src/app/test/TeacherBranchIdentity.test.tsx`
   - Exit code: `VITEST_EXIT=0`
   - Exact totals: **12 test files passed (12), 143 tests passed (143), 0 failed** (`jsdom` + `vi.mock` APIs & sockets; **not** live services or real browser):
     - `ParentDashboard.test.tsx`: `13`
     - `AccountantDashboard.test.tsx`: `13`
     - `PrimaryManagerDashboard.test.tsx`: `11`
     - `TeacherDashboard.test.tsx`: `12`
     - `SmartNotificationCounters.test.tsx`: `30`
     - `StudentOnlineDashboard.test.tsx`: `11`
     - `StudentCenterDashboard.test.tsx`: `11`
     - `RealtimeCounterLifecycle.test.tsx`: `13`
     - `TeacherBranchIdentity.test.tsx`: `9`
     - `StateAwareOnboarding.test.tsx`: `15`
     - `HomeworkPage.test.tsx`: `2`
     - `CourseStatistics.test.tsx`: `3`

---

## 9. Unresolved Issues & Exact File/Line References

1. **Untouched Frontend TypeScript Errors (Exit `2`):** `15` diagnostics remain across 8 untouched files (`AccountantHomePage.tsx:371`, `ParentSubscriptionPage.tsx:32`, `BranchesPage.tsx:110,131,152`, `TeamManagementPage.tsx:90`, `ComprehensiveLocalizationRemediation.test.tsx:134–135`, `CriticalThemeLifecycle.test.tsx:7–8,178`, `CrossBranchSecurityNegative.test.tsx:149`, `SevenThemesVerification.test.tsx:5–6,35`).
2. **Untouched Legacy `isPlatformSuperAdmin` / `admin@edu.com` References Outside `course-service`:**
   - `packages/shared/src/tenant/tenantContext.ts:26–28, 57, 71, 82, 137, 163` still defines `isPlatformSuperAdminUser(user)` (`email === 'admin@edu.com'`).
   - `services/user-service/src/controllers/brdSubscription.controller.ts:795` (`const isSuperAdmin = Boolean(... || req.user?.email?.toLowerCase() === 'admin@edu.com')`) and `services/user-service/src/controllers/user.controller.ts:133` (`!tenantContext.isPlatformSuperAdmin`) remain outside `course-service`.
   - `services/auth-service/src/controllers/auth.controller.ts:673–674` explicitly blocks inviting `admin@edu.com` as institution manager.
3. **Mock-Only Runtime Scope:** Backend controllers were invoked directly against `globalThis.prismaGlobal` mocks; live PostgreSQL queries (`5432`/`5433`), real Express HTTP middleware integration for `/pending-count` & `/expenses`, real Socket.IO TCP handshakes, and real browser rendering remain deferred to the authorized runtime phase.

---

## 10. Operational Boundary Confirmation

Confirmed: Zero database connections, queries, migrations, or seeds; zero Docker/container/Compose operations; zero Localhost/browser activations; zero Git state mutations (`checkout`, `reset`, `clean`, `commit`, `pull`, `push`, `branch`); and zero unrelated workspace or legacy sibling accesses were performed.

