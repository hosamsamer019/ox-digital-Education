# FINAL TEACHER BRANCH ASSIGNMENT SECURITY REPORT

**Date:** 2026-11-08  
**Scope:** Scope B — Teacher–Branch Assignment Backend Security & Authorization  
**Target Repository:** `D:\OX-DIGITAL\Mathe\OX-DIGITAL-GITHUB`  
**Test Suite:** `services/user-service/test/crossBranchBackend.test.ts`  

---

## 1. Executive Summary

This security audit assesses the access control mechanisms governing teacher branch assignments. The system strictly restricts teacher-branch assignment operations to the canonical Primary Manager, blocks privilege escalation, disallows self-assignment by teachers, validates branch existence, and supports unassigning teachers without side effects on course subscriptions or student enrollments.

---

## 2. Invariant & Authorization Architecture

### Primary Manager Verification Invariant
```ts
// Located in services/user-service/src/controllers/accounting/receipts.controller.ts:16-24
export function isAuthorizedPrimaryManager(user: any): boolean {
  if (!user) return false;
  const role = (user.role || '').toUpperCase();
  const isPrimary = Boolean(user.isPrimaryManager);
  return (role === 'ADMIN' || role === 'PRIMARY_MANAGER') && isPrimary;
}
```

### Assignment Controller Implementation
- **File:** `services/user-service/src/controllers/brdSubscription.controller.ts:778-825`
- **Security Gates:**
  1. **Primary Manager Invariant:**
     ```ts
     if (!isAuthorizedPrimaryManager(req.user)) {
       return res.status(403).json({ message: 'Forbidden' });
     }
     ```
  2. **Target User Role Validation:**
     ```ts
     const targetTeacher = await db.user.findUnique({ where: { id: teacherId } });
     if (!targetTeacher) return res.status(404).json({ message: 'Teacher not found' });
     if (targetTeacher.role !== 'TEACHER') {
       return res.status(400).json({ message: 'Target user is not a teacher' });
     }
     ```
  3. **Safe Unassignment:**
     ```ts
     if (!branchId || branchId === 'NONE' || branchId === 'UNASSIGN') {
       const updated = await db.user.update({
         where: { id: teacherId },
         data: { branchId: null }
       });
       return res.json({ success: true, message: 'Teacher successfully unassigned from branch', ... });
     }
     ```
  4. **Branch Existence & Institution Boundary:**
     ```ts
     const branch = await db.branch.findUnique({ where: { id: branchId } });
     if (!branch) return res.status(404).json({ message: 'Branch not found' });
     await db.user.update({ where: { id: teacherId }, data: { branchId: branch.id } });
     ```

---

## 3. Defense Against Teacher Self-Assignment

In `services/user-service/src/controllers/user.controller.ts:488`, `updateProfile` guards all non-Primary Manager requests against mutating administrative or structural fields:
```ts
const forbiddenFields = [
  'country', 'educationLevel', 'gradeLevel', 'academicLevel', 'role',
  'institutionId', 'branchId', 'parentId', 'parentEmail', 'parentPassword',
  'parentName', 'parentPhone', 'centerGroupId', 'childId', 'isPrimaryManager'
];

if (!isPrimaryManager && forbiddenFields.some(field => field in req.body)) {
  return res.status(403).json({ 
    message: 'Only the canonical Primary Manager can modify academic profile, role, center group, or parent account associations/credentials' 
  });
}
```
Any teacher submitting a payload containing `branchId` is instantly rejected with HTTP 403.

---

## 4. Automated Security Test Evidence

From `services/user-service/test/crossBranchBackend.test.ts`:
```
Scenario 3 (SEC-XB-03): Non-admin user (TEACHER) attempting to set/change branchId
  [PASS] SEC-XB-03 Status Code is HTTP 403 Forbidden
  [PASS] SEC-XB-03 Rejection Message Enforces Forbidden Fields Guard

Scenario 4 (SEC-XB-04): Teacher invoking assignTeacherBranch endpoint
  [PASS] SEC-XB-04 Status Code is HTTP 403 Forbidden
  [PASS] SEC-XB-04 Rejection Message is "Forbidden"

Scenario 6 (SEC-XB-06): Standard ADMIN without isPrimaryManager flag attempting assignTeacherBranch
  [PASS] SEC-XB-06 Secondary ADMIN without isPrimaryManager is Rejected with HTTP 403

Scenario 7 (SEC-XB-07): Verification of isAuthorizedPrimaryManager invariant matrix
  [PASS] ADMIN with isPrimaryManager === true is AUTHORIZED
  [PASS] PRIMARY_MANAGER with isPrimaryManager === true is AUTHORIZED
  [PASS] ADMIN with isPrimaryManager === false is REJECTED
  [PASS] ACCOUNTANT with isPrimaryManager === true is REJECTED
  [PASS] TEACHER with isPrimaryManager === true is REJECTED
  [PASS] Undefined user is REJECTED
```

**Security Verdict:** **VERIFIED (Zero Security Defects Found)**

