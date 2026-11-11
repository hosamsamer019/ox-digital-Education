# Final Cross-Role & Branch Security Matrix

**Platform:** OX-DIGITAL Education  
**Repository:** `D:\OX-DIGITAL\Mathe\OX-DIGITAL-GITHUB`  
**Date:** 2026-11-08  
**Scope:** Role-Based Access Control (RBAC), Multi-Branch Isolation, Tenant Isolation & Course/Video Authorization  

---

## 1. Role Authorization & Branch Boundary Matrix

| Operation / Resource | ADMIN (Super) | PRIMARY MANAGER | ACCOUNTANT (Branch A) | TEACHER (Branch A) | STUDENT (Enrolled) |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Assign Staff to Branch** | Only if `isPrimaryManager` | **ALLOW** | FORBIDDEN (403) | FORBIDDEN (403) | FORBIDDEN (403) |
| **View Consolidated Financials** | Only if `isPrimaryManager` | **ALLOW** | FORBIDDEN (403) | FORBIDDEN (403) | FORBIDDEN (403) |
| **View Branch A Receipts** | **ALLOW** | **ALLOW** | **ALLOW** | FORBIDDEN (403) | Own Receipts Only |
| **View Branch B Receipts** | **ALLOW** | **ALLOW** | **BLOCKED (403)** | FORBIDDEN (403) | FORBIDDEN (403) |
| **Issue Branch A Collection** | **ALLOW** | **ALLOW** | **ALLOW** | FORBIDDEN (403) | FORBIDDEN (403) |
| **Issue Branch B Collection** | **ALLOW** | **ALLOW** | **BLOCKED (403)** | FORBIDDEN (403) | FORBIDDEN (403) |
| **Reconcile Branch A Cashbox**| **ALLOW** | **ALLOW** | **ALLOW** | FORBIDDEN (403) | FORBIDDEN (403) |
| **Reconcile Branch B Cashbox**| **ALLOW** | **ALLOW** | **BLOCKED (403)** | FORBIDDEN (403) | FORBIDDEN (403) |
| **Unassigned Accountant Access**| N/A | N/A | **BLOCKED (403)** | N/A | N/A |
| **Create / Edit Course** | **ALLOW** | **ALLOW** | FORBIDDEN (403) | Own Courses Only | FORBIDDEN (403) |
| **Override Course Branch ID** | **ALLOW** | **ALLOW** | FORBIDDEN (403) | **BLOCKED (Ignored)** | FORBIDDEN (403) |
| **Access Other Teacher Course**| **ALLOW** | **ALLOW** | FORBIDDEN (403) | **BLOCKED (403)** | **ALLOW (If Enrolled)** |
| **Access Foreign Tenant Course**| **ALLOW** | **BLOCKED (403)**| **BLOCKED (403)** | **BLOCKED (403)** | **BLOCKED (403)** |
| **Stream Lesson Video / Ticket**| **ALLOW** | **ALLOW** | FORBIDDEN (403) | Own Lessons Only | **ALLOW (If Enrolled)** |
| **Cross-Tenant Video Ticket** | **ALLOW** | **BLOCKED (403)**| FORBIDDEN (403) | **BLOCKED (403)** | **BLOCKED (403)** |
| **Take Exam Attempt** | FORBIDDEN | FORBIDDEN | FORBIDDEN | FORBIDDEN | **ALLOW** |
| **View Question Correct Answers**| **ALLOW** | **ALLOW** | FORBIDDEN (403) | Own Exams Only | **BLOCKED (Sanitized)** |

---

## 2. Invariant Enforcement & Unit Test Evidence

All critical security invariants across cross-branch isolation, accountant confinement, primary manager authorization, tenant isolation, and course ownership are enforced by backend middleware and proven by automated tests:

1. **SEC-XB-01 & 02:** Cross-branch receipt querying and single-receipt access blocked (`CROSS_BRANCH_ACCESS_DENIED`, HTTP 403).
2. **SEC-XB-03 & 04:** Non-admin role modification of `branchId` or invoking branch assignment blocked (HTTP 403).
3. **SEC-XB-05:** Unassigned accountants blocked from querying receipts (`ACCOUNTANT_BRANCH_UNASSIGNED`, HTTP 403).
4. **SEC-XB-06 & 07:** Staff branch assignment strictly confined to `isAuthorizedPrimaryManager(req.user)`. Standard admins without the flag are rejected with HTTP 403.
5. **SEC-XB-08:** Parameter tampering in `resolveAccountingReportScope` blocked.
6. **SEC-XB-09 & 10:** Cross-branch voucher disbursement and unassigned accountant disbursement blocked (HTTP 403).
7. **SEC-XB-11 & 12:** Cross-branch receipts and student fee collection attempts blocked (HTTP 403).
8. **SEC-XB-13:** Cross-branch cashbox reconciliation and ledger access blocked (HTTP 403).
9. **SEC-AV-01 to 06:** Avatar memory guards (pre-allocation check), canonical base64 verification, JPEG/PNG binary structure validation, and path traversal defenses verified.
10. **SEC-CO-01 to 17:** Course ownership, creator video access without student enrollment, cross-teacher modification defense, legacy course author scoping, manager institution scoping, and cross-tenant video ticket defense verified (17/17 tests passing).

---

## 3. Test Summary: **64 Security Tests Passed, 0 Failed**
- `services/user-service/test/crossBranchBackend.test.ts`: 47 Passed, 0 Failed
- `services/course-service/course_ownership_authorization.test.ts`: 17 Passed, 0 Failed
All security invariants passed with 100% compliance.
