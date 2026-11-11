# OX-DIGITAL Education — Final Cross-Branch Authorization Matrix & Security Review

**Audit Date:** November 8, 2026  
**Audited Directory:** `D:\OX-DIGITAL\Mathe\OX-DIGITAL-GITHUB`  
**Services Inspected:** `services/user-service` (`routes/brdSubscription.routes.ts`, `routes/accounting.routes.ts`, `routes/manager.routes.ts`, `controllers/brdSubscription.controller.ts`, `controllers/accounting/*.ts`, `middlewares/auth.middleware.ts`)  
**Audit Character:** Strictly Read-Only Forensic Security & Authorization Review  

---

## 1. Executive Summary

This security audit conducted a line-by-line inspection of every backend endpoint responsible for branch-scoped and institutional financial operations across the Accountant and Primary Manager roles.

### Key Security Discoveries:
1. **Dynamic Database Refresh in Auth Middleware:** In `services/user-service/src/middlewares/auth.middleware.ts` (lines 44–65), `verifyToken` executes an authoritative database account lookup (`verifyAuthoritativeAccountState(userId)`). This lookup **overwrites** `req.user.branchId`, `req.user.role`, and `req.user.isPrimaryManager` directly from PostgreSQL on every request. Therefore, a stale JWT payload cannot preserve obsolete branch permissions if an accountant's branch assignment is updated in the database.
2. **Server-Side Branch Identity vs Client Input:** On all accountant endpoints, the effective `branchId` is derived strictly from `req.user.branchId`. In `accountingScope.util.ts` (lines 50–57), if a client supplies an untrusted query parameter `?branchId=other`, the server rejects the request with `403 Forbidden` rather than adopting the client's parameter.
3. **CRITICAL TEST COVERAGE GAP IDENTIFIED:** The repository currently has **zero backend automated negative integration tests** asserting cross-branch rejections. The existing 333 tests in `apps/frontend/src/app/test/` are frontend unit and mock tests where backend services were replaced with Jest/Vitest mock functions (`vi.fn()`).

---

## 2. Comprehensive Endpoint Authorization Matrix

| # | HTTP Method & Route | Controller Implementation | Auth & Role Middleware | Effective `branchId` Source | Query Boundary Enforcement | Related ID Validation | Stale JWT Mitigation | Security Verdict |
| :---: | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **1** | `GET /api/users/accountant/teachers` | `BrdSubscriptionController.getAccountantTeachers` | `verifyToken`, `checkRole(['ACCOUNTANT'])` | `req.user.branchId` (Server) | `where: { branchId, role: 'TEACHER', deletedAt: null }` | Aggregates only teachers in assigned branch | Mitigated (DB reload in `verifyToken`) | **SECURE (Source Verified)** |
| **2** | `GET /api/users/accountant/students` | `BrdSubscriptionController.getAccountantStudents` | `verifyToken`, `checkRole(['ACCOUNTANT'])` | `req.user.branchId` (Server) | Joins `StudentTeacher` exclusively on `teacherId in (branchTeacherIds)` | Students must be enrolled with branch teacher | Mitigated (DB reload in `verifyToken`) | **SECURE (Source Verified)** |
| **3** | `POST /api/users/accountant/payments` | `BrdSubscriptionController.recordPayment` | `verifyToken`, `checkRole(['ACCOUNTANT'])` | `req.user.branchId` (Server) | Enforces `link.teacher.branchId === accountantBranchId` | Rejects payment if teacher belongs to another branch | Mitigated (DB reload in `verifyToken`) | **SECURE (Source Verified)** |
| **4** | `GET /api/users/accountant/receipts` | `BrdSubscriptionController.getAccountantReceipts` | `verifyToken`, `checkRole(['ACCOUNTANT', ...])` | `req.user.branchId` (Server) | `where.branchId = accountantBranchId` (Accountant locked) | Only retrieves receipts stamped with accountant's branch | Mitigated (DB reload in `verifyToken`) | **SECURE (Source Verified)** |
| **5** | `GET /api/accounting/cashbox` | `cashbox.controller.listCashboxes` | `verifyToken`, `checkRole(['ACCOUNTANT', ...])` | `resolveAccountingReportScope` (`req.user.branchId`) | `where.branchId = scope.branchId` | Rejects client `?branchId=` with 403 if mismatched | Mitigated (DB reload in `verifyToken`) | **SECURE (Source Verified)** |
| **6** | `POST /api/accounting/cashbox/:id/reconcile` | `cashbox.controller.reconcileCashbox` | `verifyToken`, `checkRole(['ACCOUNTANT', ...])` | Validates target cashbox branch against user | Checks `cashbox.branchId === accountantBranchId` | Prevents blind count reconciliation on other branch cashboxes | Mitigated (DB reload in `verifyToken`) | **SECURE (Source Verified)** |
| **7** | `GET /api/accounting/collections` | `collections.controller.listCollections` | `verifyToken`, `checkRole(['ACCOUNTANT', ...])` | `resolveAccountingReportScope` (`req.user.branchId`) | Scoped to `branchId` for Accountant | Filters collections by cashier/branch | Mitigated (DB reload in `verifyToken`) | **SECURE (Source Verified)** |
| **8** | `POST /api/accounting/collections/:id/reversal-request` | `collections.controller.requestReversal` | `verifyToken`, `checkRole(['ACCOUNTANT', ...])` | Checks receipt ownership | Verifies collection exists in accountant's cashbox/branch | Prevents requesting reversal on other branch collections | Mitigated (DB reload in `verifyToken`) | **SECURE (Source Verified)** |
| **9** | `POST /api/accounting/reversals/:adjustmentId/review` | `collections.controller.reviewReversal` | `verifyToken`, `requirePrimaryManager` | Institution-wide (Primary Manager only) | Primary Manager authority verified server-side | Accountant role blocked with 403 Forbidden | N/A (Manager Only) | **SECURE (Source Verified)** |
| **10** | `POST /api/users/manager/payments/:paymentId/cancel` | `BrdSubscriptionController.cancelPayment` | `verifyToken`, `requirePrimaryManager` | Global institution scope (`institutionId`) | Updates payment to `CANCELLED` with audit trail | Accountant role blocked with 403 Forbidden | N/A (Manager Only) | **SECURE (Source Verified)** |
| **11** | `GET /api/accounting/reports/summary` | `reports.controller.getFinancialSummary` | `verifyToken`, `checkRole(['PRIMARY_MANAGER', 'ACCOUNTANT'])` | `resolveAccountingReportScope` | Accountants restricted to their branch; Manager can view all | Aggregates only branch dues for Accountant | Mitigated (DB reload in `verifyToken`) | **SECURE (Source Verified)** |
| **12** | `GET /api/users/teacher/income-report` | `BrdSubscriptionController.getTeacherIncomeReport` | `verifyToken`, `checkRole(['TEACHER', 'PRIMARY_MANAGER', 'ADMIN'])` | Server evaluates `teacherId` vs `req.user.userId` | Teachers view only own income; Managers can specify `teacherId` | Accountants cannot access this route (403) | Mitigated (DB reload in `verifyToken`) | **SECURE (Source Verified)** |

---

## 3. Mandatory Security Scenarios & Automated Test Audit

| Scenario | Expected Result | Implementation Status | Automated Backend Test Exists? | Test Assessment / Gap |
| :--- | :---: | :---: | :---: | :--- |
| **1. Accountant A requests teachers from Branch A** | **Allowed** | Implemented (`GET /api/users/accountant/teachers`) | **NO** | Missing backend integration test. |
| **2. Accountant A attempts to retrieve Branch B teachers** | **Denied / Restricted** | Implemented (Route ignores query params, uses server `branchId`) | **NO** | Missing backend integration test. |
| **3. Accountant A attempts to retrieve student of Branch B teacher** | **Denied / Restricted** | Implemented (Join filters by `branchTeachers`) | **NO** | Missing backend integration test. |
| **4. Accountant A submits payment for Branch B student** | **Denied (403)** | Implemented (`link.teacher.branchId !== accountantBranchId`) | **NO** | Missing backend integration test. |
| **5. Accountant A submits teacher ID belonging to Branch B** | **Denied (403)** | Implemented (Explicit validation in `recordPayment`) | **NO** | Missing backend integration test. |
| **6. Accountant A attempts to retrieve Branch B receipt** | **Denied (404/403)** | Implemented (`where: { id, branchId }`) | **NO** | Missing backend integration test. |
| **7. Accountant A attempts to access Branch B cashbox** | **Denied (403)** | Implemented (`cashbox.branchId !== accountantBranchId`) | **NO** | Missing backend integration test. |
| **8. Accountant A attempts to cancel or reverse payment** | **Denied (403)** | Implemented (`requirePrimaryManager` rejects Accountant) | **NO** | Frontend mock test passes; no backend test. |
| **9. Non-Accountant attempts Accountant-only API** | **Denied (403)** | Implemented (`checkRole(['ACCOUNTANT'])`) | **PARTIAL** | Frontend route guard tested; backend endpoint test missing. |
| **10. Accountant with no assigned branch** | **Denied (400/403)** | Implemented (`if (!branchId) return 400`) | **NO** | Missing backend integration test. |

---

## 4. Primary Manager Authorization Scope Verification

- **Server-Side Enforcement:** Primary Manager authority is defined in `auth.middleware.ts` by:
  ```typescript
  export const isAuthorizedPrimaryManager = (user?: AuthRequest['user']): boolean => {
    if (!user) return false;
    const role = (user.role || '').toUpperCase();
    return (role === 'ADMIN' || role === 'PRIMARY_MANAGER') && user.isPrimaryManager === true;
  };
  ```
- **Distinction between Global and Branch Scope:**
  - When a Primary Manager requests `requestedBranchId === 'ALL'` or omits the parameter, queries return consolidated institution data across all branches.
  - When a Primary Manager requests a specific `branchId`, `resolveAccountingReportScope` verifies that the branch genuinely belongs to the manager's `institutionId` before executing the filtered query.
  - No client-supplied role or branch parameter can grant Primary Manager privileges because `isPrimaryManager` is fetched from PostgreSQL in `verifyToken`.

---

## 5. Security Audit Verdict

1. **Architecture & Code Logic:** **ACCEPTED — SOURCE VERIFIED.** The backend codebase contains strict, well-engineered server-side branch boundary checks and fail-closed database profile reloads.
2. **Automated Backend Security Assurance:** **BLOCKED / OUTSTANDING.** There are currently zero automated integration tests in the repository verifying these 10 negative cross-branch scenarios against a live database. Adding these tests is an essential pre-activation requirement.

