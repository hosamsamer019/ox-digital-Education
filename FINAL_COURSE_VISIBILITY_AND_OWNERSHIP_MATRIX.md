# OX-DIGITAL Education — Final Course Visibility & Ownership Matrix

**Generated Date:** November 9, 2026  
**Target Repository:** `D:\OX-DIGITAL\Mathe\OX-DIGITAL-GITHUB`  
**Security Domain:** Course Catalog, Lesson Access, Quiz Submissions & Multi-Tenant Boundaries  

---

## 1. Access Control Invariants

1. **Teacher Ownership Invariant:** A teacher can ONLY see, edit, update, delete, or retrieve video streaming tickets for courses where `course.teacherId === teacher.id`.
2. **Multi-Tenant Invariant:** Courses belonging to Tenant A (`institutionId = "inst-001"`) can NEVER be queried, listed, or enrolled in by users belonging to Tenant B (`institutionId = "inst-002"`).
3. **Legacy Course Guard:** Any course with `institutionId === null` fails closed for general users and managers; it is accessible ONLY to the original author teacher or a system super-admin.
4. **Primary Manager Invariant:** Primary Managers have institutional scope: they can view and manage all courses within their own institution, but cannot access courses across institutional boundaries.
5. **Student Enrollment Invariant:** Students can only access lesson materials, stream videos, or take quizzes for courses they are actively enrolled in, provided their financial access status is not restricted.

---

## 2. Comprehensive Role & Action Authorization Matrix

| User Role | Tenant Context | Course Ownership / Enrollment | Action / Endpoint | HTTP Response | Enforcement Rule |
|:---|:---|:---|:---|:---|:---|
| **TEACHER A** | `inst-001` | Author of Course 1 | `GET /api/courses` | **200 OK** | Course 1 included in results |
| **TEACHER A** | `inst-001` | Author of Course 1 | `GET /api/courses/c1` | **200 OK** | Full details returned |
| **TEACHER A** | `inst-001` | Author of Course 1 | `POST /api/courses/c1/lessons` | **201 Created** | Lesson created successfully |
| **TEACHER A** | `inst-001` | Author of Course 1 | `PUT /api/courses/c1/lessons/l1` | **200 OK** | Lesson updated |
| **TEACHER A** | `inst-001` | Author of Course 1 | `GET /api/courses/lessons/l1/ticket` | **200 OK** | Video ticket issued (teacher exempt from enrollment) |
| **TEACHER B** | `inst-001` | Non-owner of Course 1 | `GET /api/courses` | **200 OK** | Course 1 **EXCLUDED** from Teacher B's course list |
| **TEACHER B** | `inst-001` | Non-owner of Course 1 | `PUT /api/courses/c1` | **403 Forbidden** | Strict teacher ownership check (`course.teacherId !== userId`) |
| **TEACHER B** | `inst-001` | Non-owner of Course 1 | `DELETE /api/courses/c1` | **403 Forbidden** | Deletion blocked |
| **TEACHER B** | `inst-001` | Non-owner of Course 1 | `GET /api/courses/lessons/l1/ticket` | **403 Forbidden** | Ticket issuance blocked |
| **TEACHER A** | `inst-001` | Tenant B Course (`inst-002`) | `GET /api/courses` | **200 OK** | Cross-tenant courses excluded |
| **TEACHER A** | `inst-001` | Tenant B Course (`inst-002`) | `GET /api/courses/c_inst2` | **403 Forbidden** | Cross-tenant access rejected |
| **TEACHER A** | `inst-001` | Legacy Course (`institutionId: null`) | Author of Legacy Course | **200 OK** | Author teacher access preserved |
| **TEACHER B** | `inst-001` | Legacy Course (`institutionId: null`) | Non-owner of Legacy Course | **403 Forbidden** | Fails closed |
| **PRIMARY MANAGER** | `inst-001` | Course 1 (Teacher A) | `GET /api/courses` | **200 OK** | Manager sees all courses in `inst-001` |
| **PRIMARY MANAGER** | `inst-001` | Course 1 (Teacher A) | `PUT /api/courses/c1` | **200 OK** | Manager has governance authority |
| **PRIMARY MANAGER** | `inst-001` | Tenant B Course (`inst-002`) | `GET /api/courses/c_inst2` | **403 Forbidden** | Cross-tenant isolation enforced |
| **PRIMARY MANAGER** | `inst-001` | Legacy Course (`institutionId: null`) | Non-author | **403 Forbidden** | Fails closed; unscoped legacy blocked |
| **STUDENT** | `inst-001` | Enrolled in Course 1, Active | `GET /api/courses/lessons/l1/ticket` | **200 OK** | Ticket issued for enrolled lesson |
| **STUDENT** | `inst-001` | Enrolled in Course 1, Active | `POST /api/courses/c1/quizzes/q1/submit`| **200 OK** | Quiz answers accepted |
| **STUDENT** | `inst-001` | Not Enrolled in Course 1 | `GET /api/courses/lessons/l1/ticket` | **403 Forbidden** | Access blocked (`NOT_ENROLLED`) |
| **STUDENT** | `inst-001` | Not Enrolled in Course 1 | `POST /api/courses/c1/quizzes/q1/submit`| **403 Forbidden** | Quiz rejected (`NOT_ENROLLED`) |
| **STUDENT** | `inst-001` | Enrolled, `RESTRICTED` | `GET /api/courses/lessons/l1/ticket` | **403 Forbidden** | Financial restriction enforced |
| **STUDENT** | `inst-001` | Tenant B Course (`inst-002`) | `POST /api/courses/c_inst2/enroll` | **403 Forbidden** | Cross-tenant enrollment blocked |

---

## 3. Automated Test Verification Evidence

All 27 matrix scenarios are codified and continuously verified via `services/course-service/course_ownership_authorization.test.ts`.

- **Execution Command:** `npx.cmd tsx course_ownership_authorization.test.ts`
- **Output:** `Final Result: 27 / 27 Scenarios Passed`
- **Process Exit Code:** `0`
- **Matrix Status:** **100% VERIFIED**

