# OX-DIGITAL — Smart Counters Audit Evidence Reconciliation

**Date:** November 11, 2026  
**Workspace:** `D:\OX-DIGITAL\Mathe\OX-DIGITAL-GITHUB`  
**Mode:** STRICT READ-ONLY VERIFICATION  
**Target Reconciled Report:** [`FINAL_SMART_NAVIGATION_COUNTERS_AND_ONBOARDING_INTEGRITY_AUDIT.md`](file:///D:/OX-DIGITAL/Mathe/OX-DIGITAL-GITHUB/FINAL_SMART_NAVIGATION_COUNTERS_AND_ONBOARDING_INTEGRITY_AUDIT.md)  
**Authoritative Reconciliation Verdict:** **PASS WITH LIMITATIONS**

---

## 1. Executive Reconciliation Verdict

**Verdict: PASS WITH LIMITATIONS**

The core backend authorization, multi-tenant data scoping, fail-closed Socket.IO handshake, and elimination of static sidebar badges (`badge: 3`) are confirmed in source code. **However**, reconciling [`FINAL_SMART_NAVIGATION_COUNTERS_AND_ONBOARDING_INTEGRITY_AUDIT.md`](file:///D:/OX-DIGITAL/Mathe/OX-DIGITAL-GITHUB/FINAL_SMART_NAVIGATION_COUNTERS_AND_ONBOARDING_INTEGRITY_AUDIT.md) against prior security audits ([`FINAL_SUPER_ADMIN_PRIVILEGE_SOURCE_AUDIT.md`](file:///D:/OX-DIGITAL/Mathe/OX-DIGITAL-GITHUB/FINAL_SUPER_ADMIN_PRIVILEGE_SOURCE_AUDIT.md), [`FINAL_GLOBAL_ADMIN_ROOM_DEPENDENCY_AUDIT.md`](file:///D:/OX-DIGITAL/Mathe/OX-DIGITAL-GITHUB/FINAL_GLOBAL_ADMIN_ROOM_DEPENDENCY_AUDIT.md), [`FINAL_HOMEWORK_SOCKET_ROOM_INTEGRATION_AUDIT.md`](file:///D:/OX-DIGITAL/Mathe/OX-DIGITAL-GITHUB/FINAL_HOMEWORK_SOCKET_ROOM_INTEGRATION_AUDIT.md), [`FINAL_COURSE_BRANCH_OWNERSHIP_AND_HOMEWORK_NOTIFICATION_FIX_REPORT.md`](file:///D:/OX-DIGITAL/Mathe/OX-DIGITAL-GITHUB/FINAL_COURSE_BRANCH_OWNERSHIP_AND_HOMEWORK_NOTIFICATION_FIX_REPORT.md)) and current source files identifies **six major contradictions / unsupported claims** and **four live functional defects** that prevent an unqualified `PASS`:

1. **Super Admin Room Contradiction:** The previous counters report claimed the global `admin` Socket.IO room is *"strictly restricted to verified SaaS Super Admins (`isPlatformSuperAdmin === true` or role `SUPER_ADMIN`)"*. In reality, **no authoritative server-side source exists to issue either claim**, `'SUPER_ADMIN'` is absent from the Prisma `Role` enum and listed in `FORBIDDEN_ROLES`, and the `admin` room is **unreachable and unused** by any live platform login.
2. **6 of 8 Real-Time Socket.IO Events Have No Backend Producer:** Only `homework_assigned` and `homework_submitted` are emitted by any backend service (`course-service`). `notification`, `new_notification`, `notification_read`, `expense_created`, `expense_approved`, and `expense_disbursed` have **zero backend emitters** (`user-service` has no Socket.IO server). Live updates for notifications, approvals, and disbursements rely solely on 30s polling, window focus, and visibility revalidation.
3. **Parent Actionable Counters Are NOT IMPLEMENTED:** Beyond unread notifications, parents have **no separate actionable counter** for linked children's tasks, overdue fees, or academic alerts. Additionally, `ParentDashboard.tsx` and `TeacherDashboard.tsx` do not use `useSmartNavigationCounters()`, deriving sidebar notification badges from a one-time paginated `GET /api/notifications` (`limit=50`) fetch instead of `GET /api/notifications/unread-count`.
4. **Accountant Disbursement `disbursedAt IS NULL AND disbursedById IS NULL` Is NOT Enforced by the Backend List Query:** `listExpenseVouchers` (`expenses.controller.ts:155-166`) filters only by `where.status = 'APPROVED'`, without `disbursedAt: null` or `disbursedById: null`. Moreover, `useSmartNavigationCounters.ts:106-107` reads `expRes.summary.totalCount` before its client-side filter, bypassing the client-side `disbursedAt`/`disbursedById` filter against the real backend.
5. **Live UI Bugs in Dashboards & Contextual Guidance:**
   - `StudentCenterDashboard.tsx:52` and `StudentOnlineDashboard.tsx:50` do not use `useSmartNavigationCounters()`, filtering `h.status === 'draft' || h.status === 'pending'` against a backend that only returns `'available'` or `'completed'` (yielding `0` in production).
   - `ContextualGuidanceBanner.tsx:317` has a similar student homework status mismatch (`'pending' || 'assigned'`, missing `submittedAt`), and `ContextualGuidanceBanner.tsx:354-357` reads `user.children` from `AuthContext`, which is never populated by `/api/auth/login`, `/api/auth/me`, or `/api/users/profile` (always yielding `childrenCount = 0` for live parents).
   - `useSmartNavigationCounters.ts:121-132` calls `homeworkService.getHomeworks()` without a `limit` param against a backend defaulting to `limit = 10`, with no pagination/truncation guard.
6. **Test Coverage Is Mock-Only:** All 51 passing frontend Vitest tests mock every API service, context, and Socket.IO transport (`EventEmitter`); no backend authorization or live WebSocket networking was exercised by those suites.

---

## 2. Super Admin Contradiction Resolution

### 2.1 Contradictory Claim Identified
- In [`FINAL_SMART_NAVIGATION_COUNTERS_AND_ONBOARDING_INTEGRITY_AUDIT.md:21,138`](file:///D:/OX-DIGITAL/Mathe/OX-DIGITAL-GITHUB/FINAL_SMART_NAVIGATION_COUNTERS_AND_ONBOARDING_INTEGRITY_AUDIT.md#L21), the report stated:
  - *"The global `admin` room is strictly restricted to server-validated `isPlatformSuperAdmin` or `SUPER_ADMIN`."*
  - *"Global `admin` Room: Strictly restricted to verified SaaS Super Admins (`isPlatformSuperAdmin === true` or role `SUPER_ADMIN`)."*

### 2.2 Ground-Truth Source Evidence
1. **Prisma `Role` Enum (`packages/database/prisma/schema.prisma:742-750`):**
   Contains strictly 7 roles: `ADMIN`, `PRIMARY_MANAGER`, `ACCOUNTANT`, `TEACHER`, `ONLINE_STUDENT`, `CENTER_STUDENT`, `PARENT`. **`SUPER_ADMIN` does not exist.**
2. **`FORBIDDEN_ROLES` (`packages/shared/src/accounting/center/roles.ts:18-23`):**
   `'SUPER_ADMIN'` is explicitly listed in `FORBIDDEN_ROLES` alongside `'BRANCH_MANAGER'`, `'PLATFORM_ADMIN'`, and `'HEAD_OF_BRANCH'`.
3. **Prisma `User` Model (`packages/database/prisma/schema.prisma:117-190`):**
   Has no `isPlatformSuperAdmin` column or secondary platform-super-admin relation table.
4. **Auth-Service JWT Payloads (`services/auth-service/src/controllers/auth.controller.ts`):**
   - `login` (`lines 104-115`): signs `{ userId, role, email, institutionId, branchId, isPrimaryManager }`.
   - `refreshToken` (`lines 249-261`): signs `{ userId, role, email, institutionId, branchId, isPrimaryManager, mustChangePassword }`.
   - `firstLoginChangePassword` (`lines 529-541`): signs `{ userId, role, email, institutionId, branchId, isPrimaryManager, mustChangePassword: false }`.
   - `acceptInvitation` (`lines 746-757`): signs `{ userId, role, email, institutionId, branchId: null, isPrimaryManager: true }`.
   - **Zero** endpoints in `auth-service` ever mint `isPlatformSuperAdmin: true` or `role: 'SUPER_ADMIN'`.
5. **Legacy Email Source (`packages/shared/src/tenant/tenantContext.ts:26-28`):**
   `isPlatformSuperAdminUser` relies solely on `user?.email?.toLowerCase() === 'admin@edu.com'`.
6. **Socket.IO Handshake (`services/course-service/src/index.ts:77-99`):**
   ```ts
   const decoded = jwt.verify(token, process.env.JWT_SECRET as string) as any;
   ...
   const isPlatformSuperAdmin = Boolean(
     decoded.isPlatformSuperAdmin === true ||
     userRole === 'SUPER_ADMIN'
   );
   if (isPlatformSuperAdmin) {
     socket.join('admin');
   }
   ```

### 2.3 Reconciliation Determination
1. **Is the global `admin` room unused and inaccessible to ordinary users?** **YES.** Because tokens must be signed with `process.env.JWT_SECRET`, untrusted clients cannot forge those claims, and the legacy `admin@edu.com` email check was removed from `course-service/src/index.ts`.
2. **Does a genuine authoritative privilege source exist?** **NO** (reconciled with [`FINAL_SUPER_ADMIN_PRIVILEGE_SOURCE_AUDIT.md:13-23`](file:///D:/OX-DIGITAL/Mathe/OX-DIGITAL-GITHUB/FINAL_SUPER_ADMIN_PRIVILEGE_SOURCE_AUDIT.md#L13-L23), which graded that trust chain `BLOCKED`).
3. **Did the counters report misdescribe the mechanism?** **YES.** Calling it *"server-validated `isPlatformSuperAdmin` or `SUPER_ADMIN`"* or *"verified SaaS Super Admins"* inaccurately implies an authoritative server-side privilege issuance path exists when none does. The check in `index.ts:91-99` merely inspects JWT claims that `auth-service` cannot currently issue, making the global `admin` room permanently unreachable in live logins (and zero emitters target `'admin'`).

---

## 3. Parent Actionable Counters Verification

### 3.1 Classification: **NOT IMPLEMENTED** (Separate Actionable Counter Does Not Exist)

Tracing parent navigation and state from frontend to backend:
1. **Navigation Badge (`apps/frontend/src/app/components/parent/ParentDashboard.tsx:16-51`):**
   - `ParentDashboard` defines `baseMenuItems` (`/parent/home`, `/parent/children`, `/parent/subscription`, `/parent/reports`, `/parent/notifications`, `/parent/profile`).
   - Only `/parent/notifications` receives a badge (`line 48-50`): `unreadNotifications > 0 ? unreadNotifications : undefined`.
   - **No counter or badge exists** for actionable parent tasks (e.g., pending child fees/obligations, pending child homework, academic risk alerts, or unlinked-child blockers).
2. **Hook Absence & Paginated Calculation (`ParentDashboard.tsx:37-45`):**
   - `ParentDashboard` does **not** call `useSmartNavigationCounters()`.
   - Instead, it calls `notificationService.getNotifications()` (`GET /api/notifications`, [`notification.controller.ts:20-51`](file:///D:/OX-DIGITAL/Mathe/OX-DIGITAL-GITHUB/services/user-service/src/controllers/notification.controller.ts#L20-L51)), which defaults to `limit = 50` (`line 26`). It counts `!n.read` on that 50-item slice only, once on mount, with no polling and no Socket.IO invalidation.
   - Meanwhile, the top-bar bell in [`SharedLayout.tsx:52-70`](file:///D:/OX-DIGITAL/Mathe/OX-DIGITAL-GITHUB/apps/frontend/src/app/components/shared/SharedLayout.tsx#L52-L70) calls `notificationService.getUnreadCount()` (`GET /api/notifications/unread-count`) every 30 seconds — meaning the sidebar badge and header bell can diverge for parents with >50 notifications or after reading notifications without reloading.
3. **Linked-Child Endpoints & Authorization (Existing Data Pages, Not Counters):**
   - `GET /api/users/parent/children` (`services/user-service/src/routes/user.routes.ts:51` -> `user.controller.ts:834-860`): strictly scopes `where: { parentId: req.user.userId }`. Used by [`useSelectedChild.ts:28`](file:///D:/OX-DIGITAL/Mathe/OX-DIGITAL-GITHUB/apps/frontend/src/app/components/parent/useSelectedChild.ts#L28) in `ParentHomePage` and `ParentChildrenPage`.
   - `GET /api/users/linked-relationships` (`user.routes.ts:34-37` -> `user.controller.ts:1312-1355`): queries `where: { id: req.user.userId }` including `children`. Used by `AccountSettingsPage.tsx:119`.
4. **Parent Contextual Guidance Defect (`ContextualGuidanceBanner.tsx:354-357`):**
   - [`ContextualGuidanceBanner.tsx:354-357`](file:///D:/OX-DIGITAL/Mathe/OX-DIGITAL-GITHUB/apps/frontend/src/app/components/shared/ContextualGuidanceBanner.tsx#L354-L357) determines `childrenCount` via:
     ```ts
     if (rawRole === 'PARENT') {
       const count = Array.isArray(user.children) ? user.children.length : 0;
       setGuidanceState(prev => ({ ...prev, childrenCount: count }));
     }
     ```
   - **Live Backend Evidence:**
     - `POST /api/auth/login` (`auth.controller.ts:134-150`) does **not** return `children`.
     - `GET /api/auth/me` (`auth.controller.ts:160-194`) does **not** return `children`.
     - `GET /api/users/profile` (`user.routes.ts:53-68`, called by `AuthContext.tsx:93`) includes `centerGroup`, `branch`, and `parent` — it does **NOT** include `children`.
     - Neither `useSelectedChild.ts` nor `AccountSettingsPage.tsx` calls `updateUser({ children })`.
   - **Operational Impact:** In live sessions (without `mockState`), `user.children` is always `undefined`, causing `ContextualGuidanceBanner` to report `childrenCount === 0` (`PARENT_NO_CHILDREN`) for **all parents**, including parents who already have linked children!

---

## 4. Counter Queries & Authorization Verification

| Counter | Frontend Source | Backend Endpoint & Controller | Backend Query & Auth Scoping | Total Authoritative or Paginated? |
| :--- | :--- | :--- | :--- | :--- |
| **Unread Notifications (Header Bell & Hook)** | `SharedLayout.tsx:59`<br>`useSmartNavigationCounters.ts:63` | `GET /api/notifications/unread-count`<br>`notification.controller.ts:57-78` | `verifyToken` + `tenantContextMiddleware()` (`notification.routes.ts:16,18`). `db.notification.count({ where: { userId, read: false, OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] } })` where `userId = req.user.userId`. | **Authoritative** (`db.notification.count`). |
| **Unread Notifications (Teacher & Parent Sidebars)** | `TeacherDashboard.tsx:34-44`<br>`ParentDashboard.tsx:37-44` | `GET /api/notifications`<br>`notification.controller.ts:20-51` | `verifyToken` + `tenantContextMiddleware()`. `db.notification.findMany({ where: { userId, OR: [...] }, take: limit })` (`limit` defaults to `50`). | **Paginated List (Max 50)** — client filters `!n.read` on page 1 only; not hooked to `getUnreadCount()`. |
| **Manager Pending Approvals** | `useSmartNavigationCounters.ts:70-92` (used by `AdminDashboard.tsx`, `PrimaryManagerDashboard.tsx`) | `GET /api/accounting/expenses?status=PENDING_APPROVAL`<br>`expenses.controller.ts:137-212` | `checkRole(['ACCOUNTANT','PRIMARY_MANAGER','ADMIN'])` (`accounting.routes.ts:75`); `auth.middleware.ts:113-117` enforces `isAuthorizedPrimaryManager` (`role` is `ADMIN`/`PRIMARY_MANAGER` AND `isPrimaryManager === true`). `resolveAccountingReportScope` (`accountingScope.util.ts:67-96`) enforces `institutionId = req.user.institutionId` and validates optional `branchId` belongs to institution (`403` otherwise). | **Authoritative** (`summary.totalCount` from `db.expenseVoucher.aggregate` + `pagination.total` from `count`). Frontend fails safe to `isError` if `rawList.length >= 50` and totals are absent. |
| **Accountant Pending Disbursements** | `useSmartNavigationCounters.ts:94-117` (used by `AccountantDashboard.tsx`) | `GET /api/accounting/expenses?status=APPROVED`<br>`expenses.controller.ts:137-212` | `checkRole` + `resolveAccountingReportScope` (`accountingScope.util.ts:40-65`): requires `req.user.branchId` (`403` if unassigned), rejects any `req.query.branchId !== assignedBranchId` (`403`), forces `where = { institutionId, branchId: assignedBranchId, status: 'APPROVED' }`. | **Authoritative (`summary.totalCount`), BUT incomplete `WHERE` clause** (see Section 4.1 below). |
| **Student Pending Homework (Hook)** | `useSmartNavigationCounters.ts:119-133` (**NOT used** by `StudentCenterDashboard` or `StudentOnlineDashboard`) | `GET /api/homework`<br>`homework.controller.ts:9-80` | `verifyToken` (`course-service/src/middlewares/auth.middleware.ts:17-100`). For students (`line 15-22`), filters `whereClause = { course: { enrollments: { some: { studentId: req.user?.userId } } } }`. | **Paginated List (Default `limit = 10`!)** — `homework.controller.ts:26` defaults `limit` to `10`. `total` in response is total of *all* homeworks (including completed/locked). Hook filters page 1 (`<=10` items) with no truncation guard. |
| **Student Pending Homework (Actual Student Sidebars)** | `StudentCenterDashboard.tsx:48-54`<br>`StudentOnlineDashboard.tsx:46-52` | `GET /api/homework`<br>`homework.controller.ts:9-80` | Same endpoint (`limit = 10`). Dashboards bypass `useSmartNavigationCounters()` and filter `h.status === 'draft' \|\| h.status === 'pending'`. | **Broken Status Match + Paginated (Max 10)** — backend returns only `'available'` or `'completed'` (`homework.controller.ts:49-53`), so sidebar badge is always `0`/hidden. |
| **Parent Actionable Counter** | **None** | **None** | N/A (only `getParentChildren` and `getNotifications` exist). | **NOT IMPLEMENTED**. |

### 4.1 Critical Finding on Accountant Disbursement Rule Enforcement
- **Prompt Check:** Confirm that the backend—not only the frontend—enforces `status = APPROVED AND disbursedAt IS NULL AND disbursedById IS NULL`.
- **Verification Result:** **NOT ENFORCED IN BACKEND `listExpenseVouchers`.**
  - In `services/user-service/src/controllers/accounting/expenses.controller.ts:155-166`:
    ```ts
    const where: any = { institutionId: scope.institutionId };
    if (scope.branchId) {
      where.branchId = scope.branchId;
    }
    if (status) where.status = status as any;
    ```
    The Prisma `where` object does **not** include `disbursedAt: null` or `disbursedById: null`.
  - Meanwhile, in `apps/frontend/src/app/hooks/useSmartNavigationCounters.ts:96-117`:
    - Lines 99–104 populate `uniqueApproved` checking `v.status === 'APPROVED' && !v.disbursedAt && !v.disbursedById`.
    - **However**, lines 106–107 immediately execute `if (typeof expRes?.summary?.totalCount === 'number') { disbursements = expRes.summary.totalCount; }` **before** checking `uniqueApproved.size`.
    - Since `listExpenseVouchers` always returns `summary.totalCount` (`aggregateTotals._count.id`), the frontend relies on the backend's aggregate total—meaning the `!v.disbursedAt && !v.disbursedById` filter only executes in unit tests that omit `summary` and `pagination`.
  - **Mitigating Factor:** `disburseExpenseVoucher` (`expenses.controller.ts:409-415`) atomically updates `status: 'APPLIED'`, `disbursedById: disburserId`, and `disbursedAt: new Date()` inside `db.$transaction`, and no other controller mutates `ExpenseVoucher` disbursement fields. Nonetheless, defense-in-depth requires enforcing `disbursedAt: null, disbursedById: null` in the backend query when querying undisbursed `APPROVED` vouchers.

### 4.2 Additional Navigation/Sidebar Wiring Discrepancy (`PrimaryManagerDashboard`)
- [`PrimaryManagerDashboard.tsx:106-107`](file:///D:/OX-DIGITAL/Mathe/OX-DIGITAL-GITHUB/apps/frontend/src/app/components/primary-manager/PrimaryManagerDashboard.tsx#L106-L107) invokes `applyBadgesToMenuItems(primaryManagerMenuItems)` and defines `<Route path="approvals" element={<ApprovalsPage />} />` at line 127, **but `primaryManagerMenuItems` (`lines 35-102`) contains no `/manager/approvals` (or `/manager/notifications`) entry**. When primary managers log in normally, `LoginPage.tsx:49` and `AuthContext.tsx:18-19` route them to `/admin/home` (`AdminDashboard.tsx`, which has `/admin/approvals`). Anyone navigating directly to `/manager/*` sees no approvals sidebar item or badge.

---

## 5. Socket.IO Event Producers & Consumers Verification

A search across all backend service source trees (`ai-service/src`, `analytics-service/src`, `auth-service/src`, `course-service/src`, `user-service/src`, `video-worker/src`) confirms **only 9 `.emit(` calls exist in the entire backend**, all inside `services/course-service/src/controllers/`. **`services/user-service` has no Socket.IO server, client, or event bridge (`services/user-service/src/index.ts:1-79`).**

### 5.1 Producer–Consumer Matrix

| Event Name (Listened in `useSmartNavigationCounters.ts:233-240`) | Actual Backend Producer File & Line | Emitted Room(s) & Payload | Consumer File & Listener | Backend Auth & Tenant/Branch Scope | Triggers Authoritative REST Refresh? |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **`notification`** | **NONE** (`0` backend emitters; `user-service` only writes DB `db.notification`) | N/A | `useSmartNavigationCounters.ts:233` (`notifHandler`) | N/A (dead listener in prod; only exercised by `MockSocket` in tests) | Would call `fetchCounters()` if emitted |
| **`new_notification`** | **NONE** (`0` backend emitters) | N/A | `useSmartNavigationCounters.ts:234` (`notifHandler`) | N/A (dead listener in prod) | Would call `fetchCounters()` if emitted |
| **`notification_read`** | **NONE** (`0` backend emitters in `markAsRead` / `markAllAsRead`) | N/A | `useSmartNavigationCounters.ts:235` (`readHandler`) | N/A (dead listener in prod) | Would call `fetchCounters()` if emitted |
| **`homework_assigned`** | `services/course-service/src/controllers/homework.controller.ts:227` (`createHomework`) | Room: `course:${courseId}`<br>Payload: `homework` (`{ id, title, courseId, ... }`) | `useSmartNavigationCounters.ts:236` (`hwAssignedHandler`) | **Controller:** Teacher owns course or `ADMIN` (`homework.controller.ts:189-193`).<br>**Socket Handshake:** `course:${id}` joined by owning teacher (`index.ts:118-119`) and enrolled students (`index.ts:126-127`).<br>**Gap:** `StudentCenterDashboard` and `StudentOnlineDashboard` do **not** use `useSmartNavigationCounters()`, so student dashboards do **not** listen to `homework_assigned`! | In `useSmartNavigationCounters`: YES (`fetchCounters()`). In live Student dashboards: **NO** (hook not mounted). |
| **`homework_submitted`** | `services/course-service/src/controllers/homework.controller.ts:367, 374, 391` (`emitHomeworkSubmissionNotification`, called at `line 524`) | Rooms:<br>1. `teacher:${course.teacherId}`<br>2. `institution:${course.institutionId}:admin`<br>3. `branch:${course.branchId}:admin`<br>Payload: `submission` (`{ id, studentId, homeworkId, ... }`) | `useSmartNavigationCounters.ts:237` (`hwSubmittedHandler`) | **Controller:** Student enrollment check (`line 450`).<br>**Emitter:** Legacy global `admin` removed (`line 341`). Branch emission requires `course.branch?.institutionId === course.institutionId` (`lines 385-392`).<br>**Handshake:** Matches `teacher:${id}`, `institution:${id}:admin`, `branch:${id}:admin` (`index.ts:104,106,117`). | Triggers `fetchCounters()` for Managers/Admins (`AdminDashboard`, `PrimaryManagerDashboard`). Teachers (`TeacherDashboard`) and Students (`Student*Dashboard`) do **not** mount the hook. |
| **`expense_created`** | **NONE** (`0` backend emitters in `createExpenseVoucher` or `NotificationEventService.onExpenseRequested`) | N/A | `useSmartNavigationCounters.ts:238` (`expCreatedHandler`) | N/A (`expenses.controller.ts:110` only writes DB notifications) | Would call `fetchCounters()` if emitted; currently relies on 30s poll / focus |
| **`expense_approved`** | **NONE** (`0` backend emitters in `approveExpenseVoucher` or `NotificationEventService.onExpenseApproved`) | N/A | `useSmartNavigationCounters.ts:239` (`expApprovedHandler`) | N/A (`expenses.controller.ts:274` only writes DB notifications) | Would call `fetchCounters()` if emitted; currently relies on 30s poll / focus |
| **`expense_disbursed`** | **NONE** (`0` backend emitters in `disburseExpenseVoucher` or `NotificationEventService.onExpenseDisbursed`) | N/A | `useSmartNavigationCounters.ts:240` (`expDisbursedHandler`) | N/A (`expenses.controller.ts:429` only writes DB notifications) | Would call `fetchCounters()` if emitted; currently relies on 30s poll / focus |

### 5.2 Room Name Reconciliation with Prior Homework Audit
- [`FINAL_HOMEWORK_SOCKET_ROOM_INTEGRATION_AUDIT.md:48-55`](file:///D:/OX-DIGITAL/Mathe/OX-DIGITAL-GITHUB/FINAL_HOMEWORK_SOCKET_ROOM_INTEGRATION_AUDIT.md#L48-L55) flagged that earlier prompt prose used underscore names (`user_${teacherId}`, `institution_${institutionId}`, `branch_${branchId}`) while the implementation actually uses colon notation:
  - Emitter (`homework.controller.ts:366,373,390`): `teacher:${course.teacherId}`, `institution:${course.institutionId}:admin`, `branch:${course.branchId}:admin`.
  - Handshake (`course-service/src/index.ts:104,106,117`): `institution:${decoded.institutionId}:admin`, `branch:${decoded.branchId}:admin`, `teacher:${resolvedUserId}`.
  - Branch ownership defense-in-depth (`homework.controller.ts:385-392` and `course.controller.ts:59-75`) was subsequently remediated per [`FINAL_COURSE_BRANCH_OWNERSHIP_AND_HOMEWORK_NOTIFICATION_FIX_REPORT.md`](file:///D:/OX-DIGITAL/Mathe/OX-DIGITAL-GITHUB/FINAL_COURSE_BRANCH_OWNERSHIP_AND_HOMEWORK_NOTIFICATION_FIX_REPORT.md).
- Also note: `course-service/src/index.ts:124-129` queries `db.courseEnrollment.findMany({ where: { studentId: resolvedUserId } })` for both students and `PARENT` — parents do not hold `courseEnrollment` rows as `studentId`, so in practice parents only join `user:${resolvedUserId}` (`index.ts:84`).

### 5.3 Deduplication Key Suppression Risk
- In `useSmartNavigationCounters.ts:208-219`:
  ```ts
  const eventKey = payload.id ? `${eventName}:${payload.id}` : (payload.timestamp ? `${eventName}:${payload.timestamp}` : null);
  if (eventKey) {
    if (handledEventIdsRef.current.has(eventKey)) {
      return; // Duplicate delivery ignored
    }
    handledEventIdsRef.current.add(eventKey);
  ```
- **Assessment:** Because the key combines `eventName` + entity `payload.id` (e.g., `expense_created:v1`, `expense_approved:v1`, `expense_disbursed:v1`), distinct lifecycle stage names for the same entity ID will **not** collide across stages. **However**, if the **same** `eventName` is legitimately emitted more than once with the same entity `id` (for instance, `homework_assigned` re-emitted after an edit, `notification_read` sent with a parent/batch `id` or `userId`, or two separate events lacking `id` that share the same millisecond `timestamp`), `handledEventIdsRef` **will permanently suppress** the subsequent update (until 100 newer keys evict it or the page reloads). Using a unique `eventId` / `deliveryId` (or `updatedAt` + `id`) rather than bare `payload.id` avoids suppressing legitimate repeat updates.
- **Note on Tenant Isolation:** Payload checks in `useSmartNavigationCounters.ts:200-205` (`payload.userId !== user.id`, `payload.institutionId !== user.institutionId`) are strictly defensive client filtering, **not** backend authorization. Real isolation depends on backend room assignment (`index.ts:83-129`) and REST endpoint authorization (`verifyToken`, `resolveAccountingReportScope`, `getUnreadCount`).

---

## 6. Test Execution Evidence Verification

### 6.1 Execution Record & Exit Codes
1. **Initial Invocation Failure (Environment/Shell Issue, Not Code Failure):**
   - Command: `npx vitest run apps/frontend/src/app/test/SmartNotificationCounters.test.tsx`
   - Exit Code: **`1`**
   - Root Cause: Windows PowerShell execution policy blocked `C:\Program Files\nodejs\npx.ps1` (`PSSecurityException: UnauthorizedAccess`). Vitest never launched.
2. **Individual Reruns (Previous Session) & Combined Verification Rerun (This Session):**
   - Combined Command Executed:
     ```powershell
     Set-Location "D:\OX-DIGITAL\Mathe\OX-DIGITAL-GITHUB\apps\frontend"; npx.cmd vitest run src/app/test/SmartNotificationCounters.test.tsx src/app/test/RealtimeCounterLifecycle.test.tsx src/app/test/StateAwareOnboarding.test.tsx
     ```
   - Exit Code: **`0`**
   - Observed Output:
     ```text
      RUN  v4.1.10 D:/OX-DIGITAL/Mathe/OX-DIGITAL-GITHUB/apps/frontend

      ✓ src/app/test/RealtimeCounterLifecycle.test.tsx (10 tests) 1120ms
      ✓ src/app/test/StateAwareOnboarding.test.tsx (15 tests) 306ms
      ✓ src/app/test/SmartNotificationCounters.test.tsx (26 tests) 1400ms

      Test Files  3 passed (3)
           Tests  51 passed (51)
     ```

### 6.2 Mock Inventory & Coverage Boundaries

| Test File | Tests | Environment | Mocked Modules & Infrastructure | What Is Actually Proven vs. NOT Proven |
| :--- | :---: | :--- | :--- | :--- |
| `apps/frontend/src/app/test/SmartNotificationCounters.test.tsx` | 26 | Vitest + `jsdom` + Testing Library | `AuthContext`, `LanguageContext`, `ThemeContext`, `accountingService`, `notificationService`, `homeworkService`, `brdSubscriptionService`, `userService`, `MemoryRouter` | **Proven:** `adminMenuItems` lacks static `badge: 3`; `useSmartNavigationCounters` filtering/pagination-guard/error logic against mocked payloads; `ContextualGuidanceBanner` rendering with `mockState`; `AccountSettingsPage` `?tab=linking` history sync.<br>**NOT Proven:** Real backend responses (mocks omit `summary` in tests 462–469 and return `status: 'PENDING'` / `'assigned'` instead of backend `'available'` / `'completed'`); real student/teacher/parent dashboards; live backend auth/DB. |
| `apps/frontend/src/app/test/RealtimeCounterLifecycle.test.tsx` | 10 | Vitest + `jsdom` | `AuthContext`, `SocketContext` (`MockSocket extends EventEmitter`), `accountingService`, `notificationService`, `homeworkService` | **Proven:** `useSmartNavigationCounters` listener registration, deduplication, `MockSocket.emit(...)` handling, focus revalidation, and fail-closed `isError`.<br>**NOT Proven:** Real `socket.io` / `socket.io-client` transport; whether backend services actually emit `notification`, `notification_read`, `expense_created`, `expense_approved`, or `expense_disbursed` (they do **not**!). |
| `apps/frontend/src/app/test/StateAwareOnboarding.test.tsx` | 15 | Vitest + `jsdom` | `AuthContext`, `LanguageContext`, `courseService`, `homeworkService`, `accountingService`, `MemoryRouter` | **Proven:** Pure function `resolveStateAwareGuidance(user, state)` and `ContextualGuidanceBanner` rendering when supplied explicit `mockState` props.<br>**NOT Proven:** Live `fetchState` inside `ContextualGuidanceBanner` (in production without `mockState`, `user.children` is unpopulated and homework status `'pending' \| 'assigned'` mismatches backend `'available'`). |

> [!IMPORTANT]
> **Zero PostgreSQL, zero live HTTP endpoints, zero Express middleware (`verifyToken`, `resolveAccountingReportScope`), and zero real Socket.IO network connections were tested by these 51 Vitest tests.**

---

## 7. Remaining Limitations

1. **No Live Real-Time Push for Accounting or Notifications:** `user-service` has no Socket.IO integration; `notification`, `new_notification`, `notification_read`, `expense_created`, `expense_approved`, and `expense_disbursed` are dead listeners in `useSmartNavigationCounters.ts`.
2. **Disconnected Dashboards:** `TeacherDashboard.tsx`, `ParentDashboard.tsx`, `StudentCenterDashboard.tsx`, and `StudentOnlineDashboard.tsx` bypass `useSmartNavigationCounters()`, leaving them with paginated (`50`) one-shot notification counts (Teacher/Parent) and broken `'draft' || 'pending'` homework filters (Center/Online Student).
3. **Broken Live State Hydration in `ContextualGuidanceBanner.tsx`:** Parent `user.children` is never populated on `AuthContext.user`, and student homework filters (`'pending' || 'assigned'` + `!h.submittedAt`) mismatch `GET /api/homework` output (`'available' | 'completed'`, no `submittedAt`).
4. **Student Homework Counter Pagination Limit 10:** `GET /api/homework` defaults to `limit = 10` without an actionable-pending count field or truncation guard in `useSmartNavigationCounters.ts`.
5. **Backend Disbursement `WHERE` Gap:** `listExpenseVouchers` does not explicitly assert `disbursedAt: null, disbursedById: null` alongside `status = 'APPROVED'`, and `useSmartNavigationCounters.ts` prefers `summary.totalCount` over its client filter.
6. **Parent Actionable Task Counter:** Not implemented beyond unread notifications.
7. **Unreachable `admin` Socket Room:** No authoritative server source issues `SUPER_ADMIN` or `isPlatformSuperAdmin`.
8. **Test Gap:** No integrated end-to-end tests exist verifying `useSmartNavigationCounters` or `ContextualGuidanceBanner` against real Express controllers and Socket.IO transport.

---

## 8. Smallest Recommended Fixes (Read-Only — Not Implemented)

1. **Backend Disbursement Query Hardening (`services/user-service/src/controllers/accounting/expenses.controller.ts`):**
   When `status === 'APPROVED'` (or via an explicit `?undisbursedOnly=true` query flag used by counters), add `disbursedAt: null` and `disbursedById: null` to `where` so `summary.totalCount` and `vouchers` strictly exclude any disbursed record at the database layer.
2. **Backend Homework Actionable Count / Status Alignment (`services/course-service/src/controllers/homework.controller.ts`):**
   Expose an authoritative `pendingCount` (or dedicated `/api/homework/pending-count` endpoint counting unlocked, unsubmitted homeworks across all enrolled courses without `limit=10` truncation).
3. **Adopt `useSmartNavigationCounters` & Fix Status Filters Across All 6 Role Dashboards (`TeacherDashboard.tsx`, `ParentDashboard.tsx`, `StudentCenterDashboard.tsx`, `StudentOnlineDashboard.tsx`):**
   Replace custom one-off fetches (and the broken `draft` / `pending` filter in Student dashboards) with `useSmartNavigationCounters()` (extending it cleanly for `TEACHER` and `PARENT` unread notification counts via `/api/notifications/unread-count`), and fix Student filtering to match `'available'` + `!h.isLocked` (or backend `pendingCount`).
4. **Fix `ContextualGuidanceBanner.tsx` Live State Fetchers:**
   - For `PARENT`, fetch `userService.getChildren()` (or `getLinkedRelationships()`) instead of relying on `user.children` from `AuthContext`.
   - For `STUDENT`, match `h.status === 'available' && !h.isLocked` (or use backend `pendingCount`).
   - For `ACCOUNTANT`, read `expRes.summary?.totalCount` and check `!v.disbursedAt && !v.disbursedById`.
5. **Real-Time Socket.IO Event Parity (or Honest Documentation):**
   Either bridge `user-service` notification/expense events (`notification`, `notification_read`, `expense_created`, `expense_approved`, `expense_disbursed`) to `course-service`/Redis Socket.IO scoped rooms (`user:${id}`, `institution:${id}:admin`, `branch:${id}:admin`), or remove dead listener claims from architecture documentation until implemented.
6. **Reconcile Prior Audit Documentation:**
   Do not reintroduce `SUPER_ADMIN` or `isPlatformSuperAdmin` in Socket.IO prose without an approved server-side issuance design; treat `socket.join('admin')` as unused/unreachable pending Product Owner decision (per `FINAL_SUPER_ADMIN_PRIVILEGE_SOURCE_AUDIT.md` and `FINAL_GLOBAL_ADMIN_ROOM_DEPENDENCY_AUDIT.md`).

---

## 9. Operational Integrity Statement

- **Workspace Boundaries:** All inspections occurred strictly inside `D:\OX-DIGITAL\Mathe\OX-DIGITAL-GITHUB`.
- **Zero Source/Test/Config Changes:** Only `FINAL_SMART_COUNTERS_AUDIT_RECONCILIATION.md` was created.
- **Zero Database/Docker/Localhost/Browser/Git Operations:** Ports `5432` and `5433`, Docker containers, local servers, browsers, and Git state were untouched.

