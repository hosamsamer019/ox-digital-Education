# OX-DIGITAL Education — Phase II-D-D
# Final Authorization & Attendance Route Coverage Gap Closure Audit

**Audit Date:** November 11, 2026  
**Target Workspace:** `D:\OX-DIGITAL\Mathe\OX-DIGITAL-GITHUB`  
**Active Branch:** `main`  
**Execution Mode:** STRICT READ-ONLY — Independent Verification & Gap Closure Audit  
**Audit Scope:** Attendance Authorization, Financial Access Fallback, Route Inventory, and Test Evidence Quality  
**Mandatory Stop Gate:** ACTIVE (Report Delivered; Zero Database Connections, Migrations, Container Operations, or Source Code Edits Performed)

---

## 1. Executive Verdict

### **VERDICT: PASS WITH CONDITIONS**

An exhaustive, read-only audit of all attendance routes, authorization helpers, role definitions, and financial status data paths was executed across the workspace.

| Audit Area | Status | Severity | Summary Assessment |
|---|---|---|---|
| **Audit A: Ordinary Admin with Null Branch** | **VERIFIED WITH CONDITIONS** | **P2 (Medium)** | Ordinary Admin (`role: 'ADMIN', isPrimaryManager: false`) with `branchId: null` is a valid schema state. Institution-wide scope is inferred solely from null `branchId` rather than an explicit capability flag. |
| **Audit B: Complete Attendance Route Inventory** | **VERIFIED (9/9 Routes)** | **INFO** | Exactly 9 attendance routes exist across the platform, all mounted under `/api/attendance` in `user-service`. No alternate or shadow attendance endpoints exist. |
| **Audit C: Object-Level Authorization & Read Paths** | **VERIFIED WITH CONDITIONS** | **P2 (Medium)** | Object-level authorization is rigorously enforced via `verifyTeacherOrAdminAccess` on all mutation routes and student/parent endpoints. However, `getAttendanceByDate` does not scope branch-assigned admins to their branch on read, creating an asymmetry with mutation enforcement. |
| **Audit D: Financial Status Unknown & Missing Values** | **FAILED (Genuinely Identified Defect)** | **P1 (High)** | `resolveAuthoritativeAccessStatus` fails to recognize enum value `RESTRICTED` (defined in `schema.prisma` and written by `monthlyFeeAccessControl.service.ts`), causing fee-restricted students to fall through to `'ACTIVE'` on teacher rosters. |
| **Audit E: Test Coverage & Evidence Quality** | **VERIFIED WITH CONDITIONS** | **P3 (Low)** | 6 of 9 attendance routes are covered in `attendance_authorization.test.ts`. 3 read endpoints (`/my-attendance`, `/student/:studentId`, `/:studentId/percentage`) lack automated integration test coverage. All tests use in-memory proxies. |
| **Audit F: Notification Reliability** | **VERIFIED** | **P2 (Medium)** | Notification dispatch executes strictly post-transaction (safe side-effect). However, errors during notification creation are silently swallowed in empty `catch {}` blocks without logging. |

**Gate Recommendation:** The platform is structurally sound with zero critical cross-tenant vulnerabilities (P0 = 0). The P1 defect regarding `RESTRICTED` financial status fallback and the P2 branch-read asymmetry must be logged in the release register and scheduled for remediation.

---

## 2. Baseline and Evidence Collection

### 2.1 Workspace and Branch Baseline
- **Workspace Root:** `D:\OX-DIGITAL\Mathe\OX-DIGITAL-GITHUB`
- **Active Git Branch:** `main` (tracking `origin/main`)
- **Docker Compose Context (Reference Only):** `ox-digital-github-dev`
- **Runtime Host (Reference Only):** `http://localhost:8080`

### 2.2 Git Working Tree State
- **Git Status Output:** Working tree contains tracked changes from Phase II-D-B and untracked test/report files.
- **Untracked Report Verification:** `PHASE_II_D_C_INDEPENDENT_POST_REMEDIATION_VERIFICATION_REPORT.md` is present in the repository root and correctly reported by Git as untracked (`?? PHASE_II_D_C_INDEPENDENT_POST_REMEDIATION_VERIFICATION_REPORT.md`).
- **Relevant Tracked Files Inventory:**
  - `services/course-service/src/controllers/course.controller.ts` (Modified)
  - `services/user-service/src/controllers/attendance.controller.ts` (Modified)
  - `services/user-service/src/controllers/brdSubscription.controller.ts` (Modified)
  - `services/user-service/src/routes/attendance.routes.ts` (Tracked)
  - `packages/database/prisma/schema.prisma` (Tracked)
  - `packages/shared/src/tenant/tenantContext.ts` (Tracked)
- **Relevant Untracked Test Inventory:**
  - `services/course-service/strict_teacher_institution.test.ts`
  - `services/user-service/attendance_authorization.test.ts`
  - `services/user-service/teacher_students_roster.test.ts`
  - `apps/frontend/src/app/test/ManagerTeacherSelection.test.tsx`

---

## 3. Audit A — Ordinary Admin with Null Branch

### 3.1 Role & Architecture Analysis
1. **Is `ADMIN` a distinct role from `PRIMARY_MANAGER`?**
   - **YES.** In `packages/database/prisma/schema.prisma` (lines 742–750):
     ```prisma
     enum Role {
       ADMIN
       PRIMARY_MANAGER
       ACCOUNTANT
       TEACHER
       ONLINE_STUDENT
       CENTER_STUDENT
       PARENT
     }
     ```
     `ADMIN` and `PRIMARY_MANAGER` are distinct enum values.
     In addition, the `User` model features an explicit boolean flag:
     `isPrimaryManager Boolean @default(false)` (line 127).
   - In `services/auth-service/src/controllers/auth.controller.ts` (lines 54–70), the unified administrator architecture enforces:
     - The canonical center manager has `role: 'ADMIN'`, `isPrimaryManager: true`, and a valid `institutionId`.
     - Ordinary `ADMIN` accounts without `isPrimaryManager: true` cannot log in through the Primary Manager portal option.
   - In `services/user-service/src/middlewares/auth.middleware.ts` (lines 86–90):
     ```typescript
     export const isAuthorizedPrimaryManager = (user?: AuthRequest['user']): boolean => {
       if (!user) return false;
       const normalizedRole = String(user.role || '').toUpperCase();
       return (normalizedRole === 'ADMIN' || normalizedRole === 'PRIMARY_MANAGER') && user.isPrimaryManager === true;
     };
     ```
     An `ADMIN` user with `isPrimaryManager: false` is an **Ordinary Admin**.

2. **Is an Ordinary Admin with null `branchId` a valid supported account state?**
   - **YES.** 
     - In `packages/database/prisma/seed.ts` (lines 44–50), the system seeds an initial platform administrator with `email: 'admin@edu.com'`, `role: 'ADMIN'`, `institutionId: null`, and `branchId: null`.
     - In `services/user-service/src/controllers/user.controller.ts` (`createUserSchema`, line 294), `branchId` is optional and nullable. If omitted during creation, `branchId` defaults to `null`.
     - In `packages/shared/src/tenant/tenantContext.ts` (lines 58–86), `branchId: user.branchId || null` is placed on `req.tenantContext`. The tenant middleware accepts a null branch.

3. **Does null mean intentionally institution-wide, unassigned, or invalid?**
   - **AMBIGUOUS IN CODE / INFERRED INSTITUTION-WIDE IN ATTENDANCE.**
   - In `user.controller.ts` (lines 1066–1067):
     ```typescript
     branchId: u.branchId || (u.role === 'PRIMARY_MANAGER' ? 'INST-CONSOLIDATED' : ''),
     branchName: u.branch?.name || (u.role === 'PRIMARY_MANAGER' ? 'المقر الرئيسي (إشراف موحد)' : 'غير محدد'),
     ```
     For a `PRIMARY_MANAGER`, null `branchId` is semantically defined as `INST-CONSOLIDATED` (Consolidated Headquarters / Institution-Wide).
     For an Ordinary `ADMIN`, null `branchId` is labeled in the UI as `'غير محدد'` (Unspecified / Unassigned).
   - However, in `attendance.controller.ts` (lines 144–154):
     ```typescript
     } else if (branchId) {
       // For branch-assigned admins
       if (!student.branchId || student.branchId !== branchId) {
         return { authorized: false, reason: 'Cross-branch student access forbidden' };
       }
     }
     // 5. Manager / Admin Role Hierarchy
     if (role === 'ADMIN' || role === 'PRIMARY_MANAGER') {
       return { authorized: true };
     }
     ```
     If an Ordinary Admin has `branchId: null`, the `else if (branchId)` branch is skipped, and line 152 immediately returns `{ authorized: true }`. Thus, the attendance controller treats an unassigned Ordinary Admin as **institution-wide**.

4. **Is institution-wide scope granted by an explicit permission or inferred solely from null?**
   - **INFERRED SOLELY FROM NULL.** No table, column, role capability matrix, or explicit boolean (e.g., `canAccessAllBranches`) exists for Ordinary Admins.

5. **Can an Ordinary Admin remove their own branch assignment?**
   - **NO.** In `user.controller.ts` (lines 495–501):
     `if (!isPrimaryManager)`: `branchId` is listed in `forbiddenFields`. Self-updates by Ordinary Admins that include `branchId` are rejected with HTTP 403. Furthermore, in `updateUser` (lines 587–618), `branchId` is not present in `updateData`. Branch assignments cannot be altered via user update endpoints.

6. **Can a forged request header alter the effective branch or institution?**
   - **NO.** In `tenantContext.ts` (lines 58–70):
     `institutionId` and `branchId` are extracted strictly from `(req as any).user` (the cryptographically signed JWT). Any client-supplied `x-institution-id` or `x-tenant-id` header that conflicts with `user.institutionId` causes an immediate 403 `CROSS_TENANT_IDOR_BLOCKED`. The client header cannot elevate or set `branchId`.

### 3.2 Role-Policy Evidence Matrix

| Role | Branch State | Proven Policy | Attendance Read Scope | Attendance Mutation Scope | Evidence Citations |
|---|---|---|---|---|---|
| **Primary Manager** | `null` | Authorized Institution-Wide (Consolidated HQ) | Entire Institution | Entire Institution | `tenantContext.ts:56`, `attendance.controller.ts:152`, `user.controller.ts:1066` |
| **Primary Manager** | Assigned (`UUID`) | Constrained to Assigned Branch | Assigned Branch Only | Assigned Branch Only | `attendance.controller.ts:144-149`, `attendance.controller.ts:563` |
| **Ordinary Admin** | `null` | Unassigned / Inferred Institution-Wide | Entire Institution | Entire Institution | `attendance.controller.ts:152`, `attendance.controller.ts:514` |
| **Ordinary Admin** | Assigned (`UUID`) | Constrained on Mutation; Leak on Read | Entire Institution *(Policy Asymmetry)* | Assigned Branch Only | `attendance.controller.ts:146` (Constrained), `attendance.controller.ts:519` (Unconstrained read) |
| **Teacher** | `null` | Fail-Closed Forbidden | Denied (403) | Denied (403) | `attendance.controller.ts:135`, `attendance.controller.ts:521` |
| **Teacher** | Assigned (`UUID`) | Constrained to Branch & Educational Link | Assigned Branch Only (Linked Students) | Assigned Branch Only (Linked Students) | `attendance.controller.ts:141,157-188`, `attendance.controller.ts:523-544` |

---

## 4. Audit B — Complete Attendance Route Inventory

A complete inspection was performed across all service routers and backend files. Exactly **one** attendance router exists: `services/user-service/src/routes/attendance.routes.ts`, mounted in `services/user-service/src/index.ts` at `/api/attendance`.

### Exhaustive Attendance Route Inventory Table

| # | HTTP Method & Path | Controller Handler | Authentication Middleware | Tenant Middleware | Role Restriction | Institution Scope | Branch Scope | Object-Level Authorization | Sensitive Fields Returned | Test Coverage | Assessment |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | `POST /api/attendance` | `markAttendance` | `verifyToken` | `tenantContextMiddleware()` | `TEACHER`, `ADMIN`, `PRIMARY_MANAGER` | Enforced: `student.institutionId === requester.institutionId` | Fail-closed: Teacher & student must match branch; Admin constrained if branch assigned. | `verifyTeacherOrAdminAccess` (Active link or course enrollment) | Student ID, Attendance ID, status, date | `attendance_authorization.test.ts` (Scenarios 1,2,3,4,5,6,8,9,10,11,12) | **PASS** |
| 2 | `POST /api/attendance/bulk` | `bulkMarkAttendance` | `verifyToken` | `tenantContextMiddleware()` | `TEACHER`, `ADMIN`, `PRIMARY_MANAGER` | Pre-validation: Every student checked for institution match | Pre-validation: Every student checked for branch match | Pre-validation loop via `verifyTeacherOrAdminAccess`; Atomic rollback in `tx` | Array of attendance records, summary counts | `attendance_authorization.test.ts` (Scenarios 13, 14, 15) | **PASS** |
| 3 | `POST /api/attendance/clear` | `clearAttendanceRecord` | `verifyToken` | `tenantContextMiddleware()` | `TEACHER`, `ADMIN`, `PRIMARY_MANAGER` | Enforced: `student.institutionId === requester.institutionId` | Fail-closed: Branch match enforced | `verifyTeacherOrAdminAccess` | `action: 'CLEARED'`, studentId | `attendance_authorization.test.ts` (Scenarios 7, 16, 17) | **PASS** |
| 4 | `GET /api/attendance/by-date` | `getAttendanceByDate` | `verifyToken` | `tenantContextMiddleware()` | `TEACHER`, `ADMIN`, `PRIMARY_MANAGER` | Enforced: `studentWhere.institutionId = requester.institutionId` | **Teacher:** `studentWhere.branchId = requester.branchId`<br>**Admin:** Omitted *(Leak)* | Teacher: Scoped to direct links & course enrollments.<br>Admin: Entire institution. | Student names, emails, gradeLevel, branchId, statuses | `attendance_authorization.test.ts` (Scenario 18) | **GAP (P2)** (Branch-assigned admin reads entire institution) |
| 5 | `GET /api/attendance/my-attendance` | `getStudentAttendance` | `verifyToken` | `tenantContextMiddleware()` | Open to authenticated student | Scoped to `studentId: req.user.userId` | N/A (Self record) | Hardcoded `where: { studentId: req.user.userId }` | Student attendance records, summary statistics | **NO DEDICATED TEST** | **PASS WITH GAP** (Untested in integration suite) |
| 6 | `GET /api/attendance/student/:studentId` | `getStudentAttendanceById` | `verifyToken` | `tenantContextMiddleware()` | `STUDENT` (Self), `PARENT` (Child), `TEACHER`, `ADMIN` | Enforced via `verifyTeacherOrAdminAccess` (for staff) | Enforced via `verifyTeacherOrAdminAccess` (for staff) | **Student:** `studentId === req.user.userId`<br>**Parent:** `children.some(id === studentId)`<br>**Staff:** `verifyTeacherOrAdminAccess` | Complete attendance history & summary | **NO DEDICATED TEST** | **PASS WITH GAP** (Untested in integration suite) |
| 7 | `GET /api/attendance/:studentId/percentage` | `getAttendancePercentage` | `verifyToken` | `tenantContextMiddleware()` | `STUDENT` (Self), `PARENT` (Child), `TEACHER`, `ADMIN` | Enforced via `verifyTeacherOrAdminAccess` (for staff) | Enforced via `verifyTeacherOrAdminAccess` (for staff) | Same as Route 6 | Total sessions, percentage, present/late/absent counts | **NO DEDICATED TEST** | **PASS WITH GAP** (Untested in integration suite) |
| 8 | `PUT /api/attendance/:id` | `updateAttendanceRecord` | `verifyToken` | `tenantContextMiddleware()` | `TEACHER`, `ADMIN`, `PRIMARY_MANAGER` | Enforced: Record lookup -> `verifyTeacherOrAdminAccess(existing.studentId)` | Enforced: Record lookup -> `verifyTeacherOrAdminAccess(existing.studentId)` | `verifyTeacherOrAdminAccess` on target record's `studentId` | Updated attendance record | `attendance_authorization.test.ts` (Scenario 19) | **PASS** |
| 9 | `DELETE /api/attendance/:id` | `deleteAttendanceRecord` | `verifyToken` | `tenantContextMiddleware()` | `TEACHER`, `ADMIN`, `PRIMARY_MANAGER` | Enforced: Record lookup -> `verifyTeacherOrAdminAccess(existing.studentId)` | Enforced: Record lookup -> `verifyTeacherOrAdminAccess(existing.studentId)` | `verifyTeacherOrAdminAccess` on target record's `studentId` | `deleted: true`, record ID | `attendance_authorization.test.ts` (Scenario 20) | **PASS** |

---

## 5. Audit C — Object-Level Authorization & Read Paths

### 5.1 Teacher Access Boundaries
- **Educational Relationship:** In `verifyTeacherOrAdminAccess` (lines 157–188), teachers are strictly prohibited from recording, updating, or deleting attendance for students unless:
  - An active direct link exists in `StudentTeacher` (`status: 'ACTIVE'`), OR
  - The student is enrolled in a course where `course.teacherId === requester.userId`, `course.institutionId === requester.institutionId`, and `course.deletedAt === null`.
- **Branch Enforcement:** If a teacher's `branchId` is `null` or a student's `branchId` is `null`, `verifyTeacherOrAdminAccess` fails closed with HTTP 403. If `teacher.branchId !== student.branchId`, it fails closed with HTTP 403.
- **Direct Record Mutations:** In `PUT /api/attendance/:id` and `DELETE /api/attendance/:id`, the handler looks up `existing.studentId` and passes it through `verifyTeacherOrAdminAccess`. Teachers cannot bypass educational or branch boundaries via record IDs.

### 5.2 Student Self-Access Boundaries
- In `GET /api/attendance/my-attendance`, the database query is locked to `where: { studentId: req.user.userId }`.
- In `GET /api/attendance/student/:studentId` and `GET /api/attendance/:studentId/percentage`, the handler checks:
  ```typescript
  if (requesterRole.includes('STUDENT')) {
    if (studentId !== requester.userId) {
      return res.status(403).json({ message: 'Access denied: You can only view your own attendance' });
    }
  }
  ```
  Students cannot query any other student's attendance records by manipulating route parameters.

### 5.3 Parent Access Boundaries
- In `GET /api/attendance/student/:studentId` and `GET /api/attendance/:studentId/percentage`, parent access is protected:
  ```typescript
  else if (requesterRole === 'PARENT') {
    const parentUser = await db.user.findFirst({
      where: { id: requester.userId, children: { some: { id: studentId } } }
    });
    if (!parentUser) {
      return res.status(403).json({ message: 'Access denied: Student is not your registered child' });
    }
  }
  ```
  A parent cannot view attendance for unrelated children.

### 5.4 Administrative Asymmetry (GAP-IIDD-001)
In `attendance.controller.ts` line 519 (`getAttendanceByDate`):
```typescript
    const studentWhere: any = {
      institutionId: requester.institutionId,
      deletedAt: null
    };

    if (requester.role === 'TEACHER') {
      if (!requester.branchId) {
        return res.status(403).json({ message: 'Forbidden: Teacher must be assigned to an authoritative branch' });
      }
      studentWhere.branchId = requester.branchId;
      ...
    }
```
**The Flaw:** When an Ordinary Admin or Manager has an assigned branch (`requester.branchId !== null`), `studentWhere` does NOT filter by `requester.branchId`. It returns attendance records for all students across the entire institution.  
Conversely, in `verifyTeacherOrAdminAccess` (lines 144–149), mutation operations for the same branch-assigned admin strictly reject actions on students outside their branch:
```typescript
  } else if (branchId) {
    if (!student.branchId || student.branchId !== branchId) {
      return { authorized: false, reason: 'Cross-branch student access forbidden' };
    }
  }
```
**Impact:** A branch-scoped administrator can read institution-wide attendance records on `/api/attendance/by-date`, but is blocked from modifying them.

---

## 6. Audit D — Financial Status Unknown & Missing Values

### 6.1 Subsystem Architecture: BRD Subscriptions vs. Monthly Fees
The codebase contains two financial access mechanisms that write to `User.financialAccessStatus`:
1. **BRD Subscription System (`brdDailyLock.scheduler.ts`, `brdSubscription.controller.ts`):** Uses statuses `ACTIVE`, `GRACE_PERIOD`, and `LOCKED`.
2. **Monthly Fee Access Control System (`monthlyFeeRestriction.scheduler.ts`, `monthlyFeeAccessControl.service.ts`):** Uses status `RESTRICTED`.

In `packages/database/prisma/schema.prisma` (lines 1607–1612):
```prisma
enum FinancialAccessStatus {
  ACTIVE
  GRACE_PERIOD
  LOCKED
  RESTRICTED
}
```
In `monthlyFeeAccessControl.service.ts` (line 309):
```typescript
await db.user.update({
  where: { id: studentId },
  data: { financialAccessStatus: 'RESTRICTED' }
});
```

### 6.2 The Resolver Defect (DEF-IIDD-001)
In `services/user-service/src/controllers/brdSubscription.controller.ts` (lines 251–265):
```typescript
export function resolveAuthoritativeAccessStatus(
  linkStatus?: string | null,
  financialStatus?: string | null
): 'ACTIVE' | 'GRACE_PERIOD' | 'LOCKED' {
  const normLink = linkStatus ? String(linkStatus).toUpperCase() : null;
  const normFin = financialStatus ? String(financialStatus).toUpperCase() : null;

  if (normFin === 'LOCKED' || normLink === 'LOCKED') {
    return 'LOCKED';
  }
  if (normFin === 'GRACE_PERIOD' || normLink === 'GRACE_PERIOD') {
    return 'GRACE_PERIOD';
  }
  return 'ACTIVE';
}
```

### 6.3 Comprehensive Input Evidence Matrix

| Input Value | Possible from Schema? | Possible from Application Writers? | Resolver Result | Security Assessment | Evidence / Rationale |
|---|---|---|---|---|---|
| `ACTIVE` | Yes (Enum default) | Yes (`monthlyFeeAccessControl`, un-lockers) | `'ACTIVE'` | **PASS** | Intended normal active state |
| `GRACE_PERIOD` | Yes (Enum) | Yes (`brdDailyLock.scheduler`) | `'GRACE_PERIOD'` | **PASS** | Evaluated second; grants conditional access |
| `LOCKED` | Yes (Enum) | Yes (`brdDailyLock.scheduler`, manual lock) | `'LOCKED'` | **PASS** | Evaluated first; absolute lock precedence |
| `RESTRICTED` | **Yes (Enum line 1611)** | **Yes (`monthlyFeeAccessControl.service.ts:309`)** | **`'ACTIVE'`** | **FAIL (P1 Defect)** | Resolver omits `RESTRICTED`. Fee-restricted students resolve to `'ACTIVE'` on teacher roster |
| `null` | No (Schema `@default(ACTIVE)`) | Yes (Course-enrolled student link is null) | `'ACTIVE'` | **PASS** | Valid for course-enrolled student without direct link |
| Empty String `""` | No | No (Prevented by Zod / Prisma enum) | `'ACTIVE'` | **PASS** | Safe fallback to default |
| Unknown String | No | No (Prevented by Zod / Prisma enum) | `'ACTIVE'` | **OBSERVATION (P2)** | Defaults to active; should fail closed to locked or throw |

**Root Cause:** The resolver's return type is statically constrained to `'ACTIVE' | 'GRACE_PERIOD' | 'LOCKED'`. It was authored solely against the BRD Subscription states without accounting for the `RESTRICTED` state produced by the Monthly Fee policy engine.

---

## 7. Audit E — Test Coverage & Evidence Quality

### 7.1 Classification of Test Methodologies
All automated tests in the repository run using `npx tsx` or `vitest` against in-memory mocks:
- **Prisma Mocking:** Tests patch `(globalThis as any).prismaGlobal` or wrap controller methods with mock databases (`inMemoryAttendance`, `inMemoryUsers`).
- **Classification:** **Controller Unit & Scenario Mock Integration Tests**.
- **Engine Verification:** None of the tests connect to a live PostgreSQL database engine or test real database transactions/locks.

### 7.2 Per-Route Test Coverage Mapping

| Route Path | Method | Covered in `attendance_authorization.test.ts`? | Scenario Numbers | Test Quality Classification |
|---|---|---|---|---|
| `/api/attendance` | `POST` | **YES** | Scenarios 1, 2, 3, 4, 5, 6, 8, 9, 10, 11, 12 | Controller Scenario Mock Integration |
| `/api/attendance/bulk` | `POST` | **YES** | Scenarios 13, 14, 15 | Controller Scenario Mock Integration (Mock proxy rollback) |
| `/api/attendance/clear` | `POST` | **YES** | Scenarios 7, 16, 17 | Controller Scenario Mock Integration |
| `/api/attendance/by-date` | `GET` | **YES** | Scenario 18 | Controller Scenario Mock Integration |
| `/api/attendance/my-attendance` | `GET` | **NO** | None | **UNTESTED** |
| `/api/attendance/student/:studentId` | `GET` | **NO** | None | **UNTESTED** |
| `/api/attendance/:studentId/percentage` | `GET` | **NO** | None | **UNTESTED** |
| `/api/attendance/:id` | `PUT` | **YES** | Scenario 19 | Controller Scenario Mock Integration |
| `/api/attendance/:id` | `DELETE` | **YES** | Scenario 20 | Controller Scenario Mock Integration |

---

## 8. Audit F — Notification Reliability Assessment

### 8.1 Dispatch Architecture in `bulkMarkAttendance`
In `services/user-service/src/controllers/attendance.controller.ts` (lines 627–700):
1. **Atomic Transaction Isolation:** All database mutations execute inside `await db.$transaction(async (tx) => ...)`. Pending notifications are pushed to an in-memory array `pendingNotifications`.
2. **Post-Commit Execution:** The dispatch loop executes strictly *after* `db.$transaction` resolves:
   ```typescript
   for (const notif of pendingNotifications) {
     try {
       await db.notification.create({
         data: {
           userId: notif.userId,
           title: notif.title,
           message: notif.message,
           type: 'info'
         }
       });
     } catch {}
   }
   ```
3. **Assessment Findings:**
   - **Transaction Independence (Confirmed):** If the database transaction fails, the notification loop never executes. Zero ghost notifications can occur.
   - **Silent Failure (Confirmed P2):** If `db.notification.create` throws an error (e.g. notification table lock or connection blip), the error is caught by empty `catch {}` with zero logging.
   - **No Outbox / Retry (Confirmed P2):** Failed notifications are lost permanently.
   - **Duplicate Dispatch Prevention:** Records in `bulkMarkAttendance` are deduplicated by `studentId` before processing (lines 607–611). Within a single request, students receive at most one notification.

---

## 9. Findings Register

| Finding ID | Severity | File & Location | Summary of Finding | Abuse / Failure Scenario | Proven Status | Recommended Action |
|---|---|---|---|---|---|---|
| **DEF-IIDD-001** | **P1 (High)** | `brdSubscription.controller.ts:251-265` | `resolveAuthoritativeAccessStatus` does not recognize `RESTRICTED` status from `monthlyFeeAccessControl.service.ts` | Center student with overdue fees is marked `RESTRICTED` by scheduler, but teacher roster resolves their status as `ACTIVE` | **PROVEN** | Update resolver to check `normFin === 'RESTRICTED'` and return `'LOCKED'` or extend return type to include `'RESTRICTED'` |
| **GAP-IIDD-001** | **P2 (Medium)** | `attendance.controller.ts:519-524` | `getAttendanceByDate` does not scope branch-assigned admins to their branch on read | Admin assigned to Branch A queries `/api/attendance/by-date` and receives attendance records for students in Branch B | **PROVEN** | Update `getAttendanceByDate` to apply `studentWhere.branchId = requester.branchId` if `requester.branchId` is present |
| **GAP-IIDD-002** | **P2 (Medium)** | `attendance.controller.ts:144-154` | Ordinary Admin with null `branchId` has institution-wide scope inferred solely from null | Unassigned admin account created without a branch automatically receives institution-wide attendance powers | **PROVEN** | Require explicit `isPrimaryManager: true` or a designated `ALL_BRANCHES` permission to manage across branches |
| **OBS-IIDD-001** | **P2 (Medium)** | `attendance.controller.ts:698` | Notification dispatch silently swallows errors in empty `catch {}` | Notification table write failure is invisible in logs and monitoring | **PROVEN** | Replace empty catch with structured logger (`logger.error`) |
| **OBS-IIDD-002** | **P3 (Low)** | `attendance.routes.ts:23,30,31` | Routes `/my-attendance`, `/student/:studentId`, and `/:studentId/percentage` lack automated integration tests | Regression in self or parent attendance endpoints could go unnoticed by test suite | **PROVEN** | Add dedicated test scenarios for student self-read, parent child-read, and cross-parent reject |

---

## 10. Explicitly Unverified Items

1. **PostgreSQL Real Engine Concurrency:** Database transaction rollbacks under concurrent conflicting locks on PostgreSQL port 5432/5433 were not executed.
2. **Live Push Notification Delivery:** Delivery of notifications over active WebSockets was not evaluated with browser clients.
3. **Nginx Reverse Proxy Ingress:** Real HTTP network hops via Docker Nginx reverse proxy were not tested.

---

## 11. Final Recommendation

1. **Accept Audit Findings:**
   The codebase is free of P0 critical tenant breaches. The 9 attendance routes are verified and protected by object-level authorization.
2. **Authorize Target Remediation for DEF-IIDD-001 and GAP-IIDD-001:**
   Prior to or during Phase III activation, apply bounded fixes for:
   - Recognizing `RESTRICTED` in `resolveAuthoritativeAccessStatus`.
   - Applying `branchId` filter for branch-assigned admins in `getAttendanceByDate`.
3. **Engage Mandatory Stop Gate:**
   Stop all execution and await explicit user authorization.

