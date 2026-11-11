# OX-DIGITAL Education — Course Branch Ownership & Homework Notification Defense-in-Depth Fix Report

**Date:** November 9, 2026  
**Workspace:** `D:\OX-DIGITAL\Mathe\OX-DIGITAL-GITHUB`  
**Execution Mode:** IMPLEMENT → TEST → REPORT → STOP  
**Priority:** HIGH — Multi-Tenant Data Isolation  
**Verdict:** **PASS WITH LIMITATIONS** (Application-level validation & fail-closed defense implemented; real Socket.IO network transport & DB composite FK constraint remain documented limitations)

---

## 1. Executive Verdict & Summary

### Verdict: **PASS WITH LIMITATIONS**

#### Key Achievements:
1. **Authoritative Branch Ownership on Course Creation:** Added [`validateBranchOwnership`](file:///d:/OX-DIGITAL/Mathe/OX-DIGITAL-GITHUB/services/course-service/src/controllers/course.controller.ts#L55-L73) in `course.controller.ts`. During `createCourse`, if a non-null `branchId` is resolved, it is queried against `db.branch` with `{ id: branchId, institutionId: authoritativeInstitutionId, deletedAt: null }`. Mismatched, nonexistent, or soft-deleted branches are rejected with HTTP 400 (`الفرع المحدد غير تابع لهذه المؤسسة أو غير متاح`). Teachers cannot override their server-assigned branch.
2. **Authoritative Branch Ownership on Course Updates:** In `updateCourse`, if a manager/admin supplies a non-null `data.branchId`, it is strictly validated against the course's authoritative `institutionId`. Cross-institution, nonexistent, or soft-deleted branches are rejected with HTTP 400 before calling `db.course.update`. Legitimate explicit branch removal (`branchId: null`) and omitting `branchId` (preserving existing branch) are both preserved.
3. **Fail-Closed Homework Notification Defense-in-Depth:**
   - Modified `submitHomework` query to load `branch: { select: { institutionId: true } }` on `homework.course`.
   - Updated [`emitHomeworkSubmissionNotification`](file:///d:/OX-DIGITAL/Mathe/OX-DIGITAL-GITHUB/services/course-service/src/controllers/homework.controller.ts#L346-L415) to emit to `branch:${course.branchId}:admin` **strictly and only if**:
     `course.institutionId` is present, `course.branchId` is present, `course.branch` relation was loaded, and `course.branch.institutionId === course.institutionId`.
   - If the branch relation is missing, null, or mismatched: branch notification is withheld, and a safe diagnostic warning is logged referencing only sanitized IDs without exposing student details, answers, or grades. Teacher and institution notifications remain intact.
4. **Comprehensive Test Evidence:**
   - Dedicated 18-scenario regression suite (`course_branch_ownership_and_notification.test.ts`): **18/18 PASSED** (exit code 0).
   - Socket.IO security & tenant isolation suite (`socket_security_isolation.test.ts`): **20/20 PASSED** (exit code 0).
   - Teacher course ownership & authorization suite (`course_ownership_authorization.test.ts`): **27/27 PASSED** (exit code 0).
   - TypeScript compilation (`npx.cmd tsc --noEmit`): **0 ERRORS** (exit code 0).

---

## 2. Exact Files Modified

1. `services/course-service/src/controllers/course.controller.ts`
   - Added and exported `validateBranchOwnership(branchId, institutionId)`.
   - Integrated branch validation in `createCourse` (Phase B).
   - Integrated branch validation in `updateCourse` (Phase C).
2. `services/course-service/src/controllers/homework.controller.ts`
   - Updated `submitHomework` Prisma query to include `branch: { select: { institutionId: true } }`.
   - Hardened `emitHomeworkSubmissionNotification` with fail-closed branch relation verification and safe observability logging.
3. `services/course-service/socket_security_isolation.test.ts`
   - Updated test cases 6, 8, and 10a to include loaded `branch: { institutionId: 'inst-1' }` relation matching the fail-closed defense contract.
4. `services/course-service/course_ownership_authorization.test.ts`
   - Added `branch.findFirst` mock to `mockDb` to support the new `validateBranchOwnership` checks during course creation tests.
5. `services/course-service/course_branch_ownership_and_notification.test.ts` *(New File)*
   - Dedicated 18-scenario test suite verifying all 18 requirements across Phases B, C, and D.

---

## 3. Resolution of Authoritative Institution and Branch IDs

### 3.1 Course Creation Path
```typescript
const institutionId = tenantContext?.institutionId || teacher.institutionId || null;
const branchId = (isManagerOrAdmin && data.branchId) ? data.branchId : (tenantContext?.branchId || teacher.branchId || null);

if (branchId) {
  const isBranchValid = await validateBranchOwnership(branchId, institutionId);
  if (!isBranchValid) {
    return res.status(400).json({ message: 'الفرع المحدد غير تابع لهذه المؤسسة أو غير متاح' });
  }
}
```
- **Authoritative Institution ID:** Sourced directly from trusted `tenantContext.institutionId` (derived from validated JWT by middleware), falling back to `teacher.institutionId` from the database. Client cannot supply arbitrary `institutionId`.
- **Authoritative Branch ID:**
  - For managers/admins: `data.branchId` is accepted if valid and confirmed to belong to `institutionId` via `validateBranchOwnership`.
  - For teachers: `data.branchId` is strictly ignored; `tenantContext.branchId || teacher.branchId` is enforced.

### 3.2 Course Update Path
```typescript
if (isManagerOrAdmin && data.branchId !== undefined) {
  if (data.branchId !== null) {
    const authoritativeInstitutionId = tenantContext?.institutionId || course.institutionId || null;
    const isBranchValid = await validateBranchOwnership(data.branchId, authoritativeInstitutionId);
    if (!isBranchValid) {
      return res.status(400).json({ message: 'الفرع المحدد غير تابع لهذه المؤسسة أو غير متاح' });
    }
  }
}
```
- `courseUpdateSchema` contains only `branchId` and course fields; `institutionId` is not present in the schema and cannot be modified.
- Non-managers cannot modify `branchId` (`isManagerOrAdmin` guard).
- When a manager supplies `data.branchId: null`, the course becomes institution-wide without branch restriction.
- When `data.branchId` is omitted, existing `course.branchId` is untouched.

---

## 4. Fail-Closed Homework Notification Behavior

In `emitHomeworkSubmissionNotification`:
```typescript
// 1. Owning teacher notification (always delivered if teacherId present, including legacy courses)
if (course?.teacherId) {
  const teacherRoom = `teacher:${course.teacherId}`;
  ioInstance.to(teacherRoom).emit('homework_submitted', submission);
  targetedRooms.push(teacherRoom);
}

// 2. Multi-tenant scoped notification to institution & branch admins
if (course?.institutionId) {
  const instRoom = `institution:${course.institutionId}:admin`;
  ioInstance.to(instRoom).emit('homework_submitted', submission);
  targetedRooms.push(instRoom);

  // Strict Fail-Closed Branch Notification:
  if (course.branchId) {
    if (
      course.branch &&
      course.branch.institutionId &&
      course.branch.institutionId === course.institutionId
    ) {
      const branchRoom = `branch:${course.branchId}:admin`;
      ioInstance.to(branchRoom).emit('homework_submitted', submission);
      targetedRooms.push(branchRoom);
    } else {
      const safeCourseId = course.id || courseId || 'unknown';
      const safeBranchId = course.branchId;
      const reason = !course.branch
        ? 'branch relation not loaded or missing'
        : !course.branch.institutionId
        ? 'branch lacks institutionId'
        : 'branch institutionId does not match course institutionId';
      logger.warn(
        `[Homework] Branch notification withheld for course ${safeCourseId}, branch ${safeBranchId}: ${reason}.`
      );
    }
  }
}
```

---

## 5. Regression Test Matrix & Verification Evidence

### 5.1 Focused Suite: `course_branch_ownership_and_notification.test.ts`
Command: `npx.cmd tsx course_branch_ownership_and_notification.test.ts`  
Exit Code: `0`

| # | Test Scenario | Expected Result | Actual Result | Status |
|:---|:---|:---|:---|:---|
| 1 | Valid branch belonging to authoritative institution | HTTP 201; course created with branchId | HTTP 201; course created | **PASS** |
| 2 | Branch belonging to another institution on create | HTTP 400; no course created | HTTP 400; db.create not called | **PASS** |
| 3 | Nonexistent branch on create | HTTP 400; no course created | HTTP 400; db.create not called | **PASS** |
| 4 | No branch specified for institution course | HTTP 201; course created with branchId: null | HTTP 201; branchId: null | **PASS** |
| 5 | Teacher attempting to override authorized branch | Client branch ignored; server branch kept | Server branch A preserved | **PASS** |
| 6 | Valid branch in same institution on update | HTTP 200; branchId updated | HTTP 200; branchId updated | **PASS** |
| 7 | Cross-institution branch on update | HTTP 400; db.update not called | HTTP 400; db.update not called | **PASS** |
| 8 | Nonexistent branch on update | HTTP 400; db.update not called | HTTP 400; db.update not called | **PASS** |
| 9 | Branch omitted from update payload | HTTP 200; existing branch preserved | HTTP 200; existing branch kept | **PASS** |
| 10 | Explicit null branch on update | HTTP 200; branchId set to null | HTTP 200; branchId null | **PASS** |
| 11 | Client attempting institutionId hijack on update | HTTP 400; tenant scope preserved | HTTP 400; hijack prevented | **PASS** |
| 12 | Matching loaded branch relation | Teacher, inst, and branch rooms targeted | 3 rooms targeted; 3 events | **PASS** |
| 13 | Mismatched branch institution | Teacher & inst targeted; branch withheld | 2 rooms targeted; foreign withheld | **PASS** |
| 14 | Missing branch relation (unloaded) | Teacher & inst targeted; branch withheld | 2 rooms targeted; unverified withheld | **PASS** |
| 15 | Null branch | Teacher & inst targeted; no branch room | 2 rooms targeted; 0 branch | **PASS** |
| 16 | Missing institution (legacy course) | Teacher-only targeted; no admin/branch | 1 room targeted (`teacher:...`) | **PASS** |
| 17 | Missing teacher and institution | 0 rooms targeted; safe warning logged | 0 rooms targeted; safe warning | **PASS** |
| 18 | Emission to global/wildcard/unscoped rooms | Zero emissions to `admin` or wildcard | Zero emissions to forbidden rooms | **PASS** |

### 5.2 Socket.IO Security Suite: `socket_security_isolation.test.ts`
Command: `npx.cmd tsx socket_security_isolation.test.ts`  
Exit Code: `0`  
Result: **20/20 PASSED**

### 5.3 Teacher Course Ownership Suite: `course_ownership_authorization.test.ts`
Command: `npx.cmd tsx course_ownership_authorization.test.ts`  
Exit Code: `0`  
Result: **27/27 Scenarios Passed**

### 5.4 TypeScript Typecheck
Command: `npx.cmd tsc --noEmit` (in `services/course-service`)  
Exit Code: `0`  
Result: **Zero TypeScript Errors**

---

## 6. Documented Limitations

1. **Database-Level Composite Foreign Key:** The Prisma schema still defines separate foreign keys for `Course.institutionId` and `Course.branchId`. While application-level validation and notification fail-closed defense prevent invalid associations and data leakage, a composite constraint `FOREIGN KEY (institutionId, branchId) REFERENCES Branch(institutionId, id)` in PostgreSQL would provide schema-level guarantee. This requires a formal database migration, which was intentionally excluded by authorization scope.
2. **Real Socket.IO Network Transport:** Tests exercise controllers and helper dispatchers with mock Socket.IO servers and unit test assertions. Real WebSocket network transport, handshake latency, and browser client receipt remain unverified until the consolidated runtime activation phase.
3. **Unscoped `course_created` Event:** `course.controller.ts:919` uses `io.emit('course_created', course)` which broadcasts newly created course records server-wide. This is a pre-existing broadcast pattern noted for follow-up review.

---

## 7. Mandatory Operational Integrity Statement

- **Strict Scope Boundaries:** All work executed exclusively within `D:\OX-DIGITAL\Mathe\OX-DIGITAL-GITHUB`.
- **Zero Schema / Database Operations:** No Prisma schema edits, migrations, seeds, or SQL operations were executed; ports 5432 and 5433 were not accessed.
- **Zero Docker Operations:** No Docker commands (`up`, `down`, `restart`, `build`) were run.
- **Zero Runtime Operations:** Localhost servers, browsers, or runtime processes were not started.
- **Zero Git Operations:** No git commits, pushes, checkouts, or branch mutations were executed.
- **STOP:** Execution has halted in accordance with the mandatory stop condition.

