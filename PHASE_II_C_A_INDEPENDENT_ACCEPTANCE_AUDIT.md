# OX-DIGITAL Education — Phase II-C-A
# Independent Read-Only Acceptance Audit Report

**Target Workspace:** `D:\OX-DIGITAL\Mathe\OX-DIGITAL-GITHUB`  
**Application URL:** `http://localhost:8080` (Compose project: `ox-digital-github-dev`)  
**Audit Date:** November 11, 2026  
**Execution Mode:** STRICT READ-ONLY REVIEW + ISOLATED TEST VERIFICATION  
**Auditor Classification:** Independent Software Quality & Security Audit  
**Overall Verdict:** **PASS WITH CONDITIONS / DEFECTS & OMISSIONS NOTED**

---

## 1. Executive Summary & Verdict

This independent audit evaluated the implementation claims of the Phase II-C Final Hardening Report against the actual codebase, schema reality, Git working tree, and test execution results.

### Verdict Rationale:
1. **Course Lifecycle & Exam Protection:** **VERIFIED (PASS)**.
   - Course archive protection on student exam attempts is fully implemented in `exam.controller.ts` and `assessment.controller.ts` and backed by automated tests (Scenario 22 in `course_remediation_regression.test.ts`).
   - Clean fail-closed application-level tenant scoping replaced `FAIL_CLOSED_NO_TENANT` across `course.controller.ts`, `homework.controller.ts`, and `user.controller.ts` and is backed by automated tests (Scenario 21).
   - 24/24 regression scenarios in `course_remediation_regression.test.ts` pass cleanly.
2. **Manager Teacher Roster (>100 limitation):** **CONDITIONAL PASS / DEFECT CONFIRMED**.
   - The frontend implementation in `CoursesManagementPage.tsx` did **not** achieve an unconstrained roster. It hardcodes a fixed loop cap (`currentPage <= 10`), establishing a hard upper ceiling of 1,000 teachers.
   - Searching is performed strictly in-memory on the downloaded client array (`availableTeachers.filter`), meaning teachers beyond record 1,000 can never be searched or selected.
3. **Teacher Student Roster (>100 students):** **NOT VERIFIED BY TEST / LOGIC GAPS IDENTIFIED**.
   - Source code in `brdSubscription.controller.ts` implements pagination (`page`, `limit`) and unifies `StudentTeacher` with `CourseEnrollment`.
   - **Zero automated tests exist in the entire repository for this endpoint** (`NOT_VERIFIED` per audit rules).
   - When filtering by `subscriptionStatus` (e.g. `'LOCKED'`), course-enrolled students not in `StudentTeacher` are added with default `accessStatus: 'ACTIVE'` and bypass the filter.
4. **Attendance Correction & Cancellation:** **PASS WITH ARCHITECTURAL WARNING / DATA DELETION CONFIRMED**.
   - `POST /api/attendance/clear` and `bulkMarkAttendance` (`UNSET`) perform physical database row deletion (`db.attendance.delete`).
   - The platform schema has **no attendance audit log or history table**, meaning corrections permanently erase prior records without an audit trail.
   - `verifyTeacherOrAdminAccess` checks only that the target student exists in the database, without enforcing institution or branch ownership.

---

## 2. Evidence Classification Summary

| Requirement / Component | Classification | Primary Evidence |
| :--- | :---: | :--- |
| **1. Exam Archive Protection** | `VERIFIED_BY_AUTOMATED_TEST` | `exam.controller.ts` line 418 + Scenario 22 in `course_remediation_regression.test.ts` |
| **2. Clean Fail-Closed Tenant Scoping** | `VERIFIED_BY_AUTOMATED_TEST` | `course.controller.ts` line 133 + Scenario 21 in `course_remediation_regression.test.ts` |
| **3. Archive/Restore Regression Suite** | `VERIFIED_BY_AUTOMATED_TEST` | 24/24 scenarios passed synchronously in `course_remediation_regression.test.ts` |
| **4. Manager Teacher Roster (>100)** | `VERIFIED_BY_SOURCE_REVIEW` (Partial / Defect) | `CoursesManagementPage.tsx` line 107 (`currentPage <= 10` hard cap) |
| **5. Teacher Student Roster (>100)** | `NOT_VERIFIED` (No Automated Test) | `brdSubscription.controller.ts` line 344 (Source implemented, 0 test cases exist) |
| **6. Attendance Deselection / Clear** | `VERIFIED_BY_SOURCE_REVIEW` | `attendance.controller.ts` line 480 & line 568 (Deletes record row; 0 test cases) |
| **7. Attendance Authorization (Tenant/Branch)** | `FAILED_INSPECTION` (Defect) | `attendance.controller.ts` line 67 (`verifyTeacherOrAdminAccess` omits tenant/branch check) |
| **8. TypeScript Compilation (3 packages)** | `VERIFIED_BY_BUILD` | 0 errors across `course-service`, `user-service`, `apps/frontend` |
| **9. Git Working Tree Preservation** | `VERIFIED_BY_SOURCE_REVIEW` | Working tree verified via `git status`; pre-existing changes preserved |

---

## 3. Deep Technical Audit Findings

### A. Teacher Student Roster (`getTeacherStudents`)
* **Files Inspected:**
  - `services/user-service/src/controllers/brdSubscription.controller.ts` (lines 254–439)
  - `apps/frontend/src/app/services/brdSubscription.service.ts` (lines 71–74)
  - `apps/frontend/src/app/components/teacher/TeacherStudentsPage.tsx` (lines 35–85, 420–475)

#### Evaluation of Audit Checklist:
1. **Handling of Direct Links & Course Enrollments:**
   - Source code lines 286–341 query `db.studentTeacher.findMany({ where: { teacherId, status: 'ACTIVE' } })`.
   - Lines 344–402 query courses owned by the teacher (`where: { teacherId }`), load `db.courseEnrollment.findMany`, identify missing student IDs, and fetch their `User` records.
   - Classification: `VERIFIED_BY_SOURCE_REVIEW`.
2. **Duplicate Student Deduplication:**
   - Source code maintains a `seenStudentIds = new Set<string>()`. Course-enrolled students already present in direct links are excluded from duplicate insertion.
   - Classification: `VERIFIED_BY_SOURCE_REVIEW`.
3. **Pagination on Authorized Set:**
   - Source code computes `const total = results.length; const paginatedData = results.slice(skip, skip + limit);`.
   - Classification: `VERIFIED_BY_SOURCE_REVIEW`.
4. **Count and Data Consistency:**
   - In-memory slicing ensures `count: paginatedData.length` and `total: results.length` are derived from the exact same filtered set.
   - Classification: `VERIFIED_BY_SOURCE_REVIEW`.
5. **Search Coverage:**
   - In-memory search (name/email substring matching) is executed on the merged array prior to slicing.
   - Classification: `VERIFIED_BY_SOURCE_REVIEW`.
6. **Filter Consistency (`grade`, `type`, `subscriptionStatus`):**
   - **Defect Identified (DEF-IICA-001):** The `subscriptionStatus` query parameter is pushed into `whereClause.accessStatus` for the `db.studentTeacher` query (line 278). However, when course-enrolled students are added at line 394, they are assigned hardcoded `accessStatus: 'ACTIVE'` and **no in-memory filter** checks `subscriptionStatus` against the merged array. As a result, if a teacher filters by `subscriptionStatus=LOCKED`, course-enrolled students still leak into the returned roster as `ACTIVE`.
7. **Cross-Teacher & Cross-Institution Access:**
   - Scoped to `teacherId`. However, the query does not verify that students linked via `CourseEnrollment` or `StudentTeacher` belong to the teacher's institution if a teacher were to switch institutions.
8. **Branch Restrictions:**
   - **Defect Identified (DEF-IICA-002):** `getTeacherStudents` contains **no branchId checks whatsoever**. If a teacher is assigned to a specific physical branch (`req.user.branchId`), `getTeacherStudents` ignores this restriction and returns students across all branches.
9. **Frontend Pagination Navigation:**
   - `TeacherStudentsPage.tsx` implements Previous/Next buttons, item count indicator, and limit selector.
10. **Filter/Search Reset:**
    - Changing filters (`gradeFilter`, `typeFilter`, `statusFilter`, `limit`) triggers `fetchStudents(1)`.
11. **Automated Test Evidence:**
    - **NOT VERIFIED:** A search for `getTeacherStudents` across all test files returned **0 test cases**. Per Section 2 of the audit instructions, this requirement must be formally designated as `NOT_VERIFIED`.

---

### B. Manager Teacher Roster (`CoursesManagementPage.tsx`)
* **Files Inspected:**
  - `apps/frontend/src/app/components/admin/CoursesManagementPage.tsx` (lines 88–118, 290–325, 520–565)
  - `services/user-service/src/controllers/user.controller.ts` (lines 110–185)

#### Evaluation:
1. **Artificial 1,000-Record Ceiling (DEF-IICA-003):**
   - Line 107 of `CoursesManagementPage.tsx`:
     ```typescript
     } while (currentPage <= totalPages && currentPage <= 10); // Safe boundary up to 1000 teachers
     ```
   - **Finding:** The implementation contains a hard cap of 10 pages (`currentPage <= 10`). For any large institution or educational network exceeding 1,000 teachers, all teachers beyond index 1,000 are permanently omitted from the manager roster.
2. **Search Architecture Limitation (DEF-IICA-004):**
   - The backend `getUsers` endpoint fully supports server-side search (`whereClause.OR = [{ name: { contains: search } }, { email: ... }]`).
   - However, the frontend `CoursesManagementPage.tsx` executes `modalTeacherSearch` **purely in-memory** on the downloaded `teachersList` (`availableTeachers.filter(...)`). It never invokes the backend search endpoint on user input.
   - **Finding:** A manager cannot search for or find any teacher that was truncated beyond the 1,000-record boundary.
3. **Partial Failure Vulnerability:**
   - If `userService.getUsers` fails on page 4 (network error or timeout), the `catch` block catches the error and exits without preserving pages 1–3 in state, leaving `teachersList` empty.
4. **Institution Scoping:**
   - `user.controller.ts` line 134 validates `authoritativeInstitutionId`. If missing, it immediately returns `{ data: [], total: 0 }`. If present, it binds `whereClause.institutionId = authoritativeInstitutionId`. This backend security boundary is intact.

---

### C. Attendance Cancellation & Data Integrity
* **Files Inspected:**
  - `services/user-service/src/controllers/attendance.controller.ts` (lines 6–30, 61–79, 434–605)
  - `services/user-service/src/routes/attendance.routes.ts` (lines 18–35)
  - `packages/database/prisma/schema.prisma` (lines 407–418)
  - `apps/frontend/src/app/components/teacher/TeacherAttendancePage.tsx` (lines 270–375, 785–835)

#### Evaluation:
1. **Deletion vs. Historical Cancellation (DEF-IICA-005):**
   - In `attendance.controller.ts`:
     - Line 482: `await db.attendance.delete({ where: { id: existing.id } });`
     - Line 594: `await db.attendance.delete({ where: { id: existing.id } });`
   - **Finding:** When a teacher deselects an accidental "Present" mark or invokes `POST /api/attendance/clear`, the database record is **permanently destroyed via SQL `DELETE`**.
   - Inspection of `schema.prisma` confirms:
     ```prisma
     model Attendance {
       id        String   @id @default(uuid())
       studentId String
       date      DateTime
       status    String
       createdAt DateTime @default(now())
       student   User     @relation(fields: [studentId], references: [id], onDelete: Cascade)
       @@index([studentId])
       @@index([date])
       @@index([studentId, date])
     }
     ```
   - There is no `deletedAt` column, no `updatedAt` column, and no `AttendanceHistory` or audit table.
   - **Implication:** The platform cannot distinguish between "attendance was never taken for this student" and "attendance was taken as Present, then retracted/cancelled". Any dispute regarding who marked or unmarked attendance has zero audit trail.
2. **Session / Course Identity Missing in Attendance Model (DEF-IICA-006):**
   - The database schema does **not** include `courseId`, `lessonId`, or `centerGroupId` on the `Attendance` entity.
   - Attendance is keyed solely by `studentId` and `date`.
   - If a student is enrolled in two different courses on the same day, marking or clearing attendance for that student impacts the entire date globally, rather than scoping to a specific course session.
3. **Tenant & Branch Authorization Bypass in Attendance (DEF-IICA-007):**
   - Lines 67–76 in `attendance.controller.ts`:
     ```typescript
     async function verifyTeacherOrAdminAccess(requesterId: string, requesterRole: string, studentId: string): Promise<boolean> {
       const upperRole = requesterRole.toUpperCase();
       if (upperRole === 'ADMIN' || upperRole === 'TEACHER') {
         const studentExists = await db.user.findUnique({
           where: { id: studentId },
           select: { id: true, role: true }
         });
         return !!studentExists;
       }
       return false;
     }
     ```
   - **CRITICAL SECURITY FINDING:** `verifyTeacherOrAdminAccess` verifies **only** that `studentId` exists in the database. It does **not** check:
     - Whether `student.institutionId === requester.institutionId`.
     - Whether `student.branchId === requester.branchId`.
     - Whether the student is enrolled in any course owned by the teacher.
   - Any authenticated teacher from Institution A can modify or clear attendance for any student in Institution B if they provide the student's UUID.
4. **Clearing Date & Student Isolation:**
   - Scoped strictly by `studentId` and normalized UTC day range (`dayStart` to `dayEnd`). Clearing one student or date cannot alter another student or date.
5. **Repeated Cancellation Safety:**
   - Idempotent: if `existing` is null, returns `{ success: true, action: 'NONE' }` with status 200 without throwing.
6. **Frontend Error State Handling:**
   - In `TeacherAttendancePage.tsx`, `handleSaveAttendance` only updates `originalMap` if `res && res.success`. Failed requests enter the `catch` block, retain user modifications, and display an error banner.

---

### D. Exam & Course Lifecycle Verification
* **Files Inspected:**
  - `services/course-service/src/controllers/exam.controller.ts` (lines 409–435)
  - `services/course-service/src/controllers/assessment.controller.ts` (lines 190–205)
  - `services/course-service/src/controllers/course.controller.ts` (lines 110–165, 1222–1340)

#### Evaluation:
1. **Exam Attempt Guard:**
   - Lines 418–427 of `exam.controller.ts`:
     ```typescript
     if (exam.courseId) {
       const course = await db.course.findUnique({
         where: { id: exam.courseId },
         select: { id: true, status: true, deletedAt: true }
       });
       if (course && (course.status !== 'PUBLISHED' || course.deletedAt !== null)) {
         return res.status(403).json({ message: 'لا يمكن بدء الامتحان لدورة مؤرشفة أو غير منشورة' });
       }
     }
     ```
   - Lines 195–202 of `assessment.controller.ts` enforce the exact same check for unified assessments.
   - Classification: `VERIFIED_BY_AUTOMATED_TEST` (Scenario 22).
2. **Preservation of Historical Attempts:**
   - `getExamDetails` and `getAssessmentReview` do not block access to historical graded attempts when a course is archived. Students and teachers retain access to past submissions and grades.
3. **Course Archive / Soft Delete Dependency Preservation:**
   - `deleteCourse` (lines 1254–1266) checks `_count` of enrollments, lessons, exams, and homeworks. If dependencies exist, it soft-deletes (`status = 'ARCHIVED'`, `deletedAt = new Date()`), preserving relational integrity.
4. **Course Restoration:**
   - `restoreCourse` (lines 1287–1340) verifies institution context and creator ownership. Courses are restored to `DRAFT` with `deletedAt: null`. Restoring an active course returns `400 Bad Request`.
   - Classification: `VERIFIED_BY_AUTOMATED_TEST` (Scenarios 14, 15, 16, 18, 19, 20).

---

## 4. Test Evidence Audit

### A. Execution of `course_remediation_regression.test.ts`
Command executed:
`cmd /c "cd /d D:\OX-DIGITAL\Mathe\OX-DIGITAL-GITHUB\services\course-service && npx tsx course_remediation_regression.test.ts"`

Output:
```text
===================================================================
OX-DIGITAL Education — Phase II Course Remediation Regression Tests
===================================================================
[PASS] Scenario 1: Teacher creates course and course inherits verified institutionId
[PASS] Scenario 2: Manager of Inst 1 successfully sees course created by Teacher 1
[PASS] Scenario 3: Cross-tenant guard: Manager of Inst 2 does NOT see Inst 1 course
[PASS] Scenario 4: Independent teacher course created with institutionId = null
[PASS] Scenario 5: Manager of Inst 1 does NOT see independent teacher course (no leak)
[PASS] Scenario 6: Manager fails closed for unverified legacy null-institution course (DEF-IIA-003)
[PASS] Scenario 6b: Creator teacher still accesses their own legacy course
[PASS] Scenario 7: Manager of Inst 1 does NOT see legacy course of foreign teacher (inst-002)
[PASS] Scenario 8: Teacher 2 attempting to delete Teacher 1 course rejected with 403 Forbidden
[PASS] Scenario 9: Deleting course with student enrollments safely archives without deleting records
[PASS] Scenario 10: Archived course is excluded from active course list by default
[PASS] Scenario 11: Requesting status=ARCHIVED successfully returns the archived course
[PASS] Scenario 12: Pagination contract returns page, limit, total, totalPages and 5 records
[PASS] Scenario 13: Case-insensitive search filter correctly matches course title
[PASS] Scenario 14: Teacher restores archived course to DRAFT with deletedAt=null
[PASS] Scenario 15: Cross-teacher course restore rejected with 403 Forbidden
[PASS] Scenario 16: Restoring an already active course returns 400 Bad Request
[PASS] Scenario 17: Stable historical ownership: teacher transfer never transfers historical courses
[PASS] Scenario 18: Manager of Inst 1 restores institution course safely to DRAFT
[PASS] Scenario 19: Cross-institution manager restore rejected with 403 Forbidden
[PASS] Scenario 20: Repeated archive/restore cycle executes reliably and safely
[PASS] Scenario 21: Manager with no tenant context fails closed cleanly (empty result without sentinel string)
[PASS] Scenario 22: Student attempting startAttempt on exam of archived course rejected with 403 Forbidden
[PASS] Scenario 23: Student attempting enrollCourse on archived course rejected with 400/403
===================================================================
Regression Test Results: 24 passed, 0 failed
===================================================================
```

### B. Automated Coverage Gap Analysis

| Test Requirement Claim | Automated Test Exists? | Status |
| :--- | :---: | :---: |
| Teacher student roster with >100 or 250 students | **NO** | `NOT_VERIFIED` |
| Student deduplication between `StudentTeacher` & `CourseEnrollment` | **NO** | `NOT_VERIFIED` |
| Student roster search across paginated records | **NO** | `NOT_VERIFIED` |
| Manager teacher roster with >100 or 1,000 teachers | **NO** | `NOT_VERIFIED` |
| Attendance deselection / `POST /api/attendance/clear` | **NO** | `NOT_VERIFIED` |
| Attendance date boundary isolation | **NO** | `NOT_VERIFIED` |
| Attendance cross-institution authorization rejection | **NO** | `NOT_VERIFIED` |
| Exam attempt protection on archived course | **YES** (Scenario 22) | `VERIFIED_BY_AUTOMATED_TEST` |
| Manager and Teacher course restore to DRAFT | **YES** (Scenarios 14, 18) | `VERIFIED_BY_AUTOMATED_TEST` |
| Cross-institution and cross-teacher restore rejection | **YES** (Scenarios 15, 19) | `VERIFIED_BY_AUTOMATED_TEST` |
| Course search and pagination contract | **YES** (Scenarios 12, 13) | `VERIFIED_BY_AUTOMATED_TEST` |
| Fail-closed tenant isolation without sentinel string | **YES** (Scenario 21) | `VERIFIED_BY_AUTOMATED_TEST` |

---

## 5. Git Working Tree & Preservation Audit

Execution of `git status -s` inside `D:\OX-DIGITAL\Mathe\OX-DIGITAL-GITHUB` confirmed:
1. **Branch:** `main` (up to date with `origin/main`).
2. **Phase II-C Modified Tracked Files (10 files):**
   - `services/course-service/src/controllers/course.controller.ts`
   - `services/course-service/src/controllers/exam.controller.ts`
   - `services/course-service/src/controllers/assessment.controller.ts`
   - `services/course-service/src/controllers/homework.controller.ts`
   - `services/user-service/src/controllers/user.controller.ts`
   - `services/user-service/src/controllers/brdSubscription.controller.ts`
   - `services/user-service/src/controllers/attendance.controller.ts`
   - `services/user-service/src/routes/attendance.routes.ts`
   - `apps/frontend/src/app/services/brdSubscription.service.ts`
   - `apps/frontend/src/app/services/user.service.ts`
   - `apps/frontend/src/app/components/admin/CoursesManagementPage.tsx`
   - `apps/frontend/src/app/components/teacher/TeacherStudentsPage.tsx`
   - `apps/frontend/src/app/components/teacher/TeacherAttendancePage.tsx`
3. **Phase II-C Untracked Artifacts:**
   - `services/course-service/course_remediation_regression.test.ts` (Isolated regression suite)
   - `PHASE_II_C_FINAL_HARDENING_AND_ACCEPTANCE_REPORT.md` (Implementation summary report)
4. **Pre-existing Working Tree Preservation:**
   - All pre-existing modified files from earlier phases remain untouched.
   - Zero commits, branch resets, stashes, or checkouts occurred.
   - Classification: `VERIFIED_BY_SOURCE_REVIEW`.

---

## 6. Prioritized Remediation Items (Defect Register)

| ID | Priority | Severity | Component | Description & Remediation |
| :--- | :---: | :---: | :--- | :--- |
| **DEF-IICA-007** | **P0** | **High** | `attendance.controller.ts` | **Attendance Cross-Tenant Security Bypass:** `verifyTeacherOrAdminAccess` does not check institution or branch ownership. Any teacher can clear or mark attendance for students of another institution. **Remediation:** Enforce `student.institutionId === requesterInstitutionId` and verify teacher course enrollment. |
| **DEF-IICA-003** | **P1** | **Medium** | `CoursesManagementPage.tsx` | **Hardcoded 1,000-Teacher Limit:** `fetchTeachersRoster` hardcodes `currentPage <= 10`. **Remediation:** Replace automatic client-side bulk fetching with on-demand server-side searchable teacher autocomplete/select using `userService.getUsers({ search, role: 'TEACHER' })`. |
| **DEF-IICA-004** | **P1** | **Medium** | `CoursesManagementPage.tsx` | **In-Memory Teacher Search:** Modal search filters only pre-loaded teachers in memory rather than querying the backend. **Remediation:** Wire `modalTeacherSearch` to debounced server query. |
| **DEF-IICA-001** | **P1** | **Medium** | `brdSubscription.controller.ts` | **Subscription Status Filter Leak:** Course-enrolled students added at line 394 default to `accessStatus: 'ACTIVE'` and bypass the `subscriptionStatus` query filter. **Remediation:** Apply `subscriptionStatus` filter to the merged `results` array in memory. |
| **DEF-IICA-002** | **P2** | **Low** | `brdSubscription.controller.ts` | **Missing Branch Scoping in Student Roster:** `getTeacherStudents` does not filter by teacher branch. **Remediation:** When teacher has `branchId`, scope `User` and `Course` queries to `branchId`. |
| **DEF-IICA-005** | **P2** | **Low** | `attendance.controller.ts` / Prisma | **Destructive Attendance Deletion / Missing Audit:** Attendance deselection executes `DELETE` on the database row. No correction history is retained. **Recommendation:** For future schema increment, introduce `AttendanceAuditLog` or `deletedAt` soft-deletion. |
| **DEF-IICA-006** | **P2** | **Low** | `schema.prisma` | **Missing Course/Session Dimension on Attendance:** Attendance model lacks `courseId`. All attendances are daily per student. **Recommendation:** Add optional `courseId` to `Attendance` model in a planned migration phase. |

---

## 7. Mandatory Stop Gate

In strict accordance with audit phase boundaries:
- **No code changes were made.**
- **No test changes were made.**
- **No database connections were opened** (ports 5432 and 5433 unaccessed).
- **No Docker commands were executed.**
- **No Git commits, pushes, merges, or resets were executed.**
- Execution is stopped. Standing by for user instructions and decision on the prioritized defect register.

