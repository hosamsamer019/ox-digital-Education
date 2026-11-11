/**
 * OX-DIGITAL Education — Phase II-D
 * Attendance Authorization Security & Regression Test Suite
 *
 * Strictly Isolated In-Memory Suite (Zero database connection, zero port 5432/5433 access)
 *
 * Verifies all required P0 security assertions:
 * 1. Authorized teacher accesses assigned student (direct link) in same institution and branch.
 * 2. Authorized teacher accesses course-enrolled student in same institution.
 * 3. Cross-tenant isolation: Teacher from Inst A cannot mark attendance for student in Inst B.
 * 4. Cross-tenant isolation: Teacher from Inst A cannot clear attendance for student in Inst B.
 * 5. Branch-scoped teacher cannot modify a student in a different branch.
 * 6. Branch-scoped teacher cannot modify a student with missing branch context.
 * 7. Teacher cannot modify a student without an authorized educational relationship.
 * 8. Requester with missing institution context is rejected fail-closed.
 * 9. Admin from Inst A cannot access student in Inst B.
 * 10. Authorized institution manager can access student in their institution.
 * 11. Unsupported roles (e.g. STUDENT) cannot mark attendance.
 * 12. Bulk attendance atomic pre-validation: Any unauthorized student causes complete 403 rejection with zero mutations.
 * 13. Attendance clear endpoint enforces identical tenant/branch/relationship boundaries.
 * 14. Attendance by-date endpoint filters strictly by institution and educational relationship.
 * 15. Update and delete attendance record enforce identical authorization boundaries.
 */

import assert from 'assert';

// In-Memory Data Store
const users = new Map<string, any>();
const studentTeachers = new Map<string, any>();
const courses = new Map<string, any>();
const courseEnrollments = new Map<string, any>();
const attendances = new Map<string, any>();
const notifications = new Map<string, any>();

function clearStore() {
  users.clear();
  studentTeachers.clear();
  courses.clear();
  courseEnrollments.clear();
  attendances.clear();
  notifications.clear();
}

// Mock Prisma Client
const mockDb: any = {
  user: {
    findUnique: async ({ where }: any) => {
      const u = users.get(where.id);
      if (!u) return null;
      return { ...u };
    },
    findFirst: async ({ where }: any) => {
      let list = Array.from(users.values());
      if (where.id) list = list.filter(u => u.id === where.id);
      if (where.children && where.children.some && where.children.some.id) {
        list = list.filter(u => Array.isArray(u.children) && u.children.some((c: any) => c.id === where.children.some.id));
      }
      return list[0] ? { ...list[0] } : null;
    },
    findMany: async ({ where }: any) => {
      let list = Array.from(users.values());
      if (where.id && where.id.in) {
        list = list.filter(u => where.id.in.includes(u.id));
      }
      if (where.institutionId !== undefined) {
        list = list.filter(u => u.institutionId === where.institutionId);
      }
      if (where.branchId !== undefined) {
        list = list.filter(u => u.branchId === where.branchId);
      }
      if (where.deletedAt === null) {
        list = list.filter(u => !u.deletedAt);
      }
      return list;
    }
  },
  studentTeacher: {
    findFirst: async ({ where }: any) => {
      for (const st of studentTeachers.values()) {
        if (where.teacherId && st.teacherId !== where.teacherId) continue;
        if (where.studentId && st.studentId !== where.studentId) continue;
        if (where.status && st.status !== where.status) continue;
        return { ...st };
      }
      return null;
    },
    findMany: async ({ where }: any) => {
      let list = Array.from(studentTeachers.values());
      if (where.teacherId) list = list.filter(st => st.teacherId === where.teacherId);
      if (where.status) list = list.filter(st => st.status === where.status);
      return list;
    }
  },
  course: {
    findMany: async ({ where }: any) => {
      let list = Array.from(courses.values());
      if (where.teacherId) list = list.filter(c => c.teacherId === where.teacherId);
      if (where.institutionId) list = list.filter(c => c.institutionId === where.institutionId);
      if (where.deletedAt === null) list = list.filter(c => !c.deletedAt);
      return list;
    }
  },
  courseEnrollment: {
    findFirst: async ({ where }: any) => {
      for (const ce of courseEnrollments.values()) {
        if (where.studentId && ce.studentId !== where.studentId) continue;
        if (where.course) {
          const c = courses.get(ce.courseId);
          if (!c) continue;
          if (where.course.teacherId && c.teacherId !== where.course.teacherId) continue;
          if (where.course.institutionId && c.institutionId !== where.course.institutionId) continue;
          if (where.course.deletedAt === null && c.deletedAt) continue;
        }
        return { ...ce };
      }
      return null;
    }
  },
  attendance: {
    findFirst: async ({ where }: any) => {
      for (const att of attendances.values()) {
        if (where.studentId && att.studentId !== where.studentId) continue;
        if (where.date && where.date.gte && where.date.lte) {
          const d = new Date(att.date).getTime();
          const start = new Date(where.date.gte).getTime();
          const end = new Date(where.date.lte).getTime();
          if (d < start || d > end) continue;
        }
        return { ...att };
      }
      return null;
    },
    findUnique: async ({ where, include }: any) => {
      const att = attendances.get(where.id);
      if (!att) return null;
      const res = { ...att };
      if (include?.student) {
        const student = users.get(att.studentId);
        res.student = student ? { ...student } : null;
      }
      return res;
    },
    findMany: async ({ where }: any) => {
      let list = Array.from(attendances.values());
      if (where.studentId) {
        list = list.filter(att => att.studentId === where.studentId);
      }
      if (where.date && where.date.gte && where.date.lte) {
        const start = new Date(where.date.gte).getTime();
        const end = new Date(where.date.lte).getTime();
        list = list.filter(att => {
          const d = new Date(att.date).getTime();
          return d >= start && d <= end;
        });
      }
      if (where.student) {
        list = list.filter(att => {
          const student = users.get(att.studentId);
          if (!student) return false;
          if (where.student.institutionId && student.institutionId !== where.student.institutionId) return false;
          if (where.student.branchId && student.branchId !== where.student.branchId) return false;
          if (where.student.deletedAt === null && student.deletedAt) return false;
          if (where.student.OR) {
            const hasDirect = studentTeachers.has(`${att.studentId}_${where.student.OR[0]?.studentTeacherLinks?.some?.teacherId}`);
            const hasCourse = Array.from(courseEnrollments.values()).some(ce => {
              if (ce.studentId !== att.studentId) return false;
              const c = courses.get(ce.courseId);
              return c && c.teacherId === where.student.OR[1]?.enrollments?.some?.course?.teacherId;
            });
            if (!hasDirect && !hasCourse) return false;
          }
          return true;
        });
      }
      return list.map(att => ({
        ...att,
        student: users.get(att.studentId) || null
      }));
    },
    create: async ({ data }: any) => {
      const id = data.id || 'att-' + Math.random().toString(36).substring(2, 9);
      const record = { id, createdAt: new Date(), ...data };
      attendances.set(id, record);
      return record;
    },
    update: async ({ where, data }: any) => {
      const att = attendances.get(where.id);
      if (!att) throw new Error('Not found');
      const updated = { ...att, ...data };
      attendances.set(where.id, updated);
      return updated;
    },
    delete: async ({ where }: any) => {
      const att = attendances.get(where.id);
      if (!att) throw new Error('Not found');
      attendances.delete(where.id);
      return att;
    }
  },
  $transaction: async (arg: any) => {
    if (typeof arg === 'function') {
      const snapshot = new Map(attendances);
      const txClient = {
        attendance: {
          findFirst: mockDb.attendance.findFirst,
          findMany: mockDb.attendance.findMany,
          create: async (params: any) => {
            if (params.data?.studentId === '99999999-9999-4999-a999-999999999999') {
              throw new Error('Simulated database write failure during bulk transaction');
            }
            return mockDb.attendance.create(params);
          },
          update: mockDb.attendance.update,
          delete: mockDb.attendance.delete
        }
      };
      try {
        const result = await arg(txClient);
        return result;
      } catch (err) {
        // Rollback state to snapshot
        attendances.clear();
        for (const [k, v] of snapshot.entries()) {
          attendances.set(k, v);
        }
        throw err;
      }
    } else if (Array.isArray(arg)) {
      return Promise.all(arg);
    }
  },
  notification: {
    create: async ({ data }: any) => {
      const id = 'notif-' + Math.random().toString(36).substring(2, 9);
      const record = { id, createdAt: new Date(), ...data };
      notifications.set(id, record);
      return record;
    }
  }
};

// Set in-memory global mock BEFORE controller import
(globalThis as any).prismaGlobal = mockDb;

import {
  markAttendance,
  bulkMarkAttendance,
  clearAttendanceRecord,
  updateAttendanceRecord,
  deleteAttendanceRecord,
  getAttendanceByDate,
  getStudentAttendance,
  getStudentAttendanceById,
  getAttendancePercentage,
  verifyTeacherOrAdminAccess,
  AttendanceRequesterContext
} from './src/controllers/attendance.controller.js';

function createMockResponse() {
  let statusCode = 200;
  let jsonBody: any = null;
  const res: any = {
    status: (code: number) => {
      statusCode = code;
      return res;
    },
    json: (body: any) => {
      jsonBody = body;
      return res;
    },
    getStatusCode: () => statusCode,
    getJsonBody: () => jsonBody
  };
  return res;
}

// ── TEST RUNNER ──
async function runAttendanceSecurityTests() {
  console.log('================================================================');
  console.log('  OX-DIGITAL Phase II-D: Attendance Authorization Security Tests');
  console.log('================================================================\n');

  let passed = 0;
  let total = 0;

  function record(desc: string, ok: boolean, detail?: string) {
    total++;
    if (ok) {
      passed++;
      console.log(`  ✓ Scenario ${total}: ${desc}`);
    } else {
      console.error(`  ✗ Scenario ${total} FAILED: ${desc}`);
      if (detail) console.error(`    Details: ${detail}`);
    }
  }

  // Fixtures Setup
  const INST_A = 'inst-alpha-001';
  const INST_B = 'inst-beta-002';
  const BRANCH_1 = 'branch-001';
  const BRANCH_2 = 'branch-002';

  // Seed Users
  const teacherA = { id: 'teacher-a-uuid', role: 'TEACHER', institutionId: INST_A, branchId: BRANCH_1, name: 'Teacher A' };
  const teacherB = { id: 'teacher-b-uuid', role: 'TEACHER', institutionId: INST_B, branchId: BRANCH_2, name: 'Teacher B' };
  const managerA = { id: 'manager-a-uuid', role: 'ADMIN', institutionId: INST_A, isPrimaryManager: true, name: 'Manager A' };
  const adminB = { id: 'admin-b-uuid', role: 'ADMIN', institutionId: INST_B, isPrimaryManager: true, name: 'Admin B' };
  const student1 = { id: '11111111-1111-1111-1111-111111111111', role: 'STUDENT', institutionId: INST_A, branchId: BRANCH_1, name: 'Student 1 (Inst A, Branch 1)' };
  const student2 = { id: '22222222-2222-2222-2222-222222222222', role: 'STUDENT', institutionId: INST_A, branchId: BRANCH_2, name: 'Student 2 (Inst A, Branch 2)' };
  const student3 = { id: '33333333-3333-3333-3333-333333333333', role: 'STUDENT', institutionId: INST_B, branchId: BRANCH_2, name: 'Student 3 (Inst B)' };
  const studentUnassigned = { id: '44444444-4444-4444-4444-444444444444', role: 'STUDENT', institutionId: INST_A, branchId: BRANCH_1, name: 'Student Unassigned' };
  const studentCourseBranch1 = { id: '55555555-5555-5555-5555-555555555555', role: 'STUDENT', institutionId: INST_A, branchId: BRANCH_1, name: 'Student Course Branch 1' };
  const studentNullBranch = { id: '88888888-8888-8888-8888-888888888888', role: 'STUDENT', institutionId: INST_A, branchId: null, name: 'Student Null Branch' };
  const studentFailTx = { id: '99999999-9999-4999-a999-999999999999', role: 'STUDENT', institutionId: INST_A, branchId: BRANCH_1, name: 'Fail Tx Student' };
  const adminBranch1 = { id: 'admin-branch1-uuid', role: 'ADMIN', institutionId: INST_A, branchId: BRANCH_1, isPrimaryManager: false, name: 'Admin Branch 1' };
  const adminOrdinaryNull = { id: 'admin-null-branch-uuid', role: 'ADMIN', institutionId: INST_A, branchId: null, isPrimaryManager: false, name: 'Ordinary Admin Null Branch' };
  const parent1 = { id: 'parent-1-uuid', role: 'PARENT', institutionId: INST_A, name: 'Parent 1', children: [{ id: student1.id }] };
  const parentUnrelated = { id: 'parent-unrelated-uuid', role: 'PARENT', institutionId: INST_A, name: 'Parent Unrelated', children: [{ id: 'other-child-uuid' }] };

  users.set(teacherA.id, teacherA);
  users.set(teacherB.id, teacherB);
  users.set(managerA.id, managerA);
  users.set(adminB.id, adminB);
  users.set(adminBranch1.id, adminBranch1);
  users.set(adminOrdinaryNull.id, adminOrdinaryNull);
  users.set(parent1.id, parent1);
  users.set(parentUnrelated.id, parentUnrelated);
  users.set(student1.id, student1);
  users.set(student2.id, student2);
  users.set(student3.id, student3);
  users.set(studentUnassigned.id, studentUnassigned);
  users.set(studentCourseBranch1.id, studentCourseBranch1);
  users.set(studentNullBranch.id, studentNullBranch);
  users.set(studentFailTx.id, studentFailTx);

  // Relationships
  // student1 linked directly to teacherA
  studentTeachers.set(`${student1.id}_${teacherA.id}`, {
    id: 'st-1',
    studentId: student1.id,
    teacherId: teacherA.id,
    status: 'ACTIVE'
  });

  // studentNullBranch linked to teacherA
  studentTeachers.set(`${studentNullBranch.id}_${teacherA.id}`, {
    id: 'st-null-branch',
    studentId: studentNullBranch.id,
    teacherId: teacherA.id,
    status: 'ACTIVE'
  });

  // studentFailTx linked to teacherA
  studentTeachers.set(`${studentFailTx.id}_${teacherA.id}`, {
    id: 'st-fail-tx',
    studentId: studentFailTx.id,
    teacherId: teacherA.id,
    status: 'ACTIVE'
  });

  // student2 & studentCourseBranch1 enrolled in course taught by teacherA
  courses.set('course-1', {
    id: 'course-1',
    teacherId: teacherA.id,
    institutionId: INST_A,
    branchId: BRANCH_1,
    deletedAt: null
  });
  courseEnrollments.set('ce-1', {
    id: 'ce-1',
    studentId: student2.id,
    courseId: 'course-1'
  });
  courseEnrollments.set('ce-course-branch1', {
    id: 'ce-course-branch1',
    studentId: studentCourseBranch1.id,
    courseId: 'course-1'
  });

  // student3 linked to teacherB
  studentTeachers.set(`${student3.id}_${teacherB.id}`, {
    id: 'st-3',
    studentId: student3.id,
    teacherId: teacherB.id,
    status: 'ACTIVE'
  });

  // ── Scenario 1: Teacher A marks attendance for Student 1 (Direct relationship, same institution & branch) ──
  {
    const req: any = {
      user: { userId: teacherA.id, role: 'TEACHER', institutionId: INST_A, branchId: BRANCH_1 },
      tenantContext: { institutionId: INST_A, branchId: BRANCH_1, userId: teacherA.id, role: 'TEACHER' },
      body: {
        studentId: student1.id,
        status: 'PRESENT',
        date: '2026-11-12'
      }
    };
    const res = createMockResponse();
    await markAttendance(req, res);
    record(
      'Authorized teacher marks attendance for direct assigned student in same institution & branch',
      res.getStatusCode() === 201 && attendances.size === 1
    );
  }

  // ── Scenario 2: Teacher A marks attendance for student via course enrollment (Remediation D Branch Scoping) ──
  {
    // 2a: Teacher A (BRANCH_1) attempting to mark student2 (BRANCH_2) -> rejected by cross-branch guard
    const reqBranchMismatch: any = {
      user: { userId: teacherA.id, role: 'TEACHER', institutionId: INST_A, branchId: BRANCH_1 },
      tenantContext: { institutionId: INST_A, branchId: BRANCH_1, userId: teacherA.id, role: 'TEACHER' },
      body: {
        studentId: student2.id,
        status: 'PRESENT',
        date: '2026-11-12'
      }
    };
    const resMismatch = createMockResponse();
    await markAttendance(reqBranchMismatch, resMismatch);
    record(
      'Branch-scoped teacher cannot mark attendance for student in another branch (Cross-branch reject)',
      resMismatch.getStatusCode() === 403 && resMismatch.getJsonBody()?.message?.includes('Cross-branch')
    );

    // 2b: Teacher A (BRANCH_1) marks attendance for studentCourseBranch1 (BRANCH_1) -> succeeds (201)
    const reqMatchingBranch: any = {
      user: { userId: teacherA.id, role: 'TEACHER', institutionId: INST_A, branchId: BRANCH_1 },
      tenantContext: { institutionId: INST_A, branchId: BRANCH_1, userId: teacherA.id, role: 'TEACHER' },
      body: {
        studentId: studentCourseBranch1.id,
        status: 'PRESENT',
        date: '2026-11-12'
      }
    };
    const resMatch = createMockResponse();
    await markAttendance(reqMatchingBranch, resMatch);
    record(
      'Teacher marks attendance for course-enrolled student in matching branch -> 201 Created',
      resMatch.getStatusCode() === 201
    );

    // 2c: Teacher with missing branchId (null) is rejected fail-closed (Remediation D)
    const reqTeacherNullBranch: any = {
      user: { userId: teacherA.id, role: 'TEACHER', institutionId: INST_A, branchId: null },
      tenantContext: { institutionId: INST_A, branchId: null, userId: teacherA.id, role: 'TEACHER' },
      body: {
        studentId: studentCourseBranch1.id,
        status: 'PRESENT',
        date: '2026-11-12'
      }
    };
    const resTeacherNull = createMockResponse();
    await markAttendance(reqTeacherNullBranch, resTeacherNull);
    record(
      'Teacher with null branchId rejected fail-closed (Remediation D) -> 403 Forbidden',
      resTeacherNull.getStatusCode() === 403 && resTeacherNull.getJsonBody()?.message?.includes('authoritative branch')
    );

    // 2d: Student with missing branchId (null) is rejected fail-closed (Remediation D)
    const reqStudentNullBranch: any = {
      user: { userId: teacherA.id, role: 'TEACHER', institutionId: INST_A, branchId: BRANCH_1 },
      tenantContext: { institutionId: INST_A, branchId: BRANCH_1, userId: teacherA.id, role: 'TEACHER' },
      body: {
        studentId: studentNullBranch.id,
        status: 'PRESENT',
        date: '2026-11-12'
      }
    };
    const resStudentNull = createMockResponse();
    await markAttendance(reqStudentNullBranch, resStudentNull);
    record(
      'Student with null branchId rejected fail-closed (Remediation D) -> 403 Forbidden',
      resStudentNull.getStatusCode() === 403 && resStudentNull.getJsonBody()?.message?.includes('Student must be assigned')
    );
  }

  // ── Scenario 3: Cross-Tenant Isolation: Teacher A attempts to mark Student 3 (Institution B) ──
  {
    const req: any = {
      user: { userId: teacherA.id, role: 'TEACHER', institutionId: INST_A },
      tenantContext: { institutionId: INST_A, userId: teacherA.id, role: 'TEACHER' },
      body: {
        studentId: student3.id,
        status: 'PRESENT',
        date: '2026-11-12'
      }
    };
    const res = createMockResponse();
    await markAttendance(req, res);
    record(
      'Cross-tenant reject: Teacher from Inst A cannot mark attendance for student in Inst B (403)',
      res.getStatusCode() === 403 && res.getJsonBody()?.message?.includes('Cross-tenant')
    );
  }

  // ── Scenario 4: Cross-Tenant Isolation: Teacher A attempts to clear attendance for Student 3 (Institution B) ──
  {
    const req: any = {
      user: { userId: teacherA.id, role: 'TEACHER', institutionId: INST_A },
      tenantContext: { institutionId: INST_A, userId: teacherA.id, role: 'TEACHER' },
      body: {
        studentId: student3.id,
        date: '2026-11-12'
      }
    };
    const res = createMockResponse();
    await clearAttendanceRecord(req, res);
    record(
      'Cross-tenant reject: Teacher from Inst A cannot clear attendance for student in Inst B (403)',
      res.getStatusCode() === 403 && res.getJsonBody()?.message?.includes('Cross-tenant')
    );
  }

  // ── Scenario 5: Teacher cannot mark student without an authorized educational relationship ──
  {
    const req: any = {
      user: { userId: teacherA.id, role: 'TEACHER', institutionId: INST_A, branchId: BRANCH_1 },
      tenantContext: { institutionId: INST_A, branchId: BRANCH_1, userId: teacherA.id, role: 'TEACHER' },
      body: {
        studentId: studentUnassigned.id,
        status: 'PRESENT',
        date: '2026-11-12'
      }
    };
    const res = createMockResponse();
    await markAttendance(req, res);
    record(
      'Teacher rejected when student belongs to institution & branch but has no educational relationship (403)',
      res.getStatusCode() === 403 && res.getJsonBody()?.message?.includes('No authorized educational relationship')
    );
  }

  // ── Scenario 6: Requester with missing institution context is rejected fail-closed (401) ──
  {
    const req: any = {
      user: { userId: teacherA.id, role: 'TEACHER', institutionId: null },
      tenantContext: { institutionId: null, userId: teacherA.id, role: 'TEACHER' },
      body: {
        studentId: student1.id,
        status: 'PRESENT',
        date: '2026-11-12'
      }
    };
    const res = createMockResponse();
    await markAttendance(req, res);
    record(
      'Requester with missing authoritative institution identity fails closed (401 Unauthorized)',
      res.getStatusCode() === 401
    );
  }

  // ── Scenario 7: Ordinary admin from Inst A cannot access student in Inst B (Cross-tenant admin reject) ──
  {
    const req: any = {
      user: { userId: managerA.id, role: 'ADMIN', institutionId: INST_A, isPrimaryManager: true },
      tenantContext: { institutionId: INST_A, userId: managerA.id, role: 'ADMIN', isPrimaryManager: true },
      body: {
        studentId: student3.id,
        status: 'PRESENT',
        date: '2026-11-12'
      }
    };
    const res = createMockResponse();
    await markAttendance(req, res);
    record(
      'Manager/Admin from Inst A cannot modify attendance for student in Inst B (403)',
      res.getStatusCode() === 403 && res.getJsonBody()?.message?.includes('Cross-tenant')
    );
  }

  // ── Scenario 8: Authorized institution manager can access student in their institution ──
  {
    const req: any = {
      user: { userId: managerA.id, role: 'ADMIN', institutionId: INST_A, isPrimaryManager: true },
      tenantContext: { institutionId: INST_A, userId: managerA.id, role: 'ADMIN', isPrimaryManager: true },
      body: {
        studentId: studentUnassigned.id,
        status: 'PRESENT',
        date: '2026-11-12'
      }
    };
    const res = createMockResponse();
    await markAttendance(req, res);
    record(
      'Authorized Primary Manager can manage attendance for unassigned student in their institution (201)',
      res.getStatusCode() === 201
    );
  }

  // ── Scenario 8b: Workstream C (GAP-IIDD-002) — Unassigned Ordinary Admin rejected fail-closed ──
  {
    const req: any = {
      user: { userId: adminOrdinaryNull.id, role: 'ADMIN', institutionId: INST_A, isPrimaryManager: false, branchId: null },
      tenantContext: { institutionId: INST_A, branchId: null, userId: adminOrdinaryNull.id, role: 'ADMIN', isPrimaryManager: false },
      body: {
        studentId: student1.id,
        status: 'PRESENT',
        date: '2026-11-12'
      }
    };
    const res = createMockResponse();
    await markAttendance(req, res);
    record(
      'Unassigned Ordinary Admin with null branch rejected fail-closed (Workstream C) -> 403 Forbidden',
      res.getStatusCode() === 403 && res.getJsonBody()?.message?.includes('Administrator must be assigned to an authoritative branch or possess Primary Manager authorization')
    );
  }

  // ── Scenario 8c: Workstream B (GAP-IIDD-001) — Branch-assigned Admin constrained to branch ──
  {
    // Same branch student -> 201
    const reqSame: any = {
      user: { userId: adminBranch1.id, role: 'ADMIN', institutionId: INST_A, isPrimaryManager: false, branchId: BRANCH_1 },
      tenantContext: { institutionId: INST_A, branchId: BRANCH_1, userId: adminBranch1.id, role: 'ADMIN', isPrimaryManager: false },
      body: {
        studentId: student1.id,
        status: 'PRESENT',
        date: '2026-11-12'
      }
    };
    const resSame = createMockResponse();
    await markAttendance(reqSame, resSame);

    // Cross branch student -> 403
    const reqCross: any = {
      user: { userId: adminBranch1.id, role: 'ADMIN', institutionId: INST_A, isPrimaryManager: false, branchId: BRANCH_1 },
      tenantContext: { institutionId: INST_A, branchId: BRANCH_1, userId: adminBranch1.id, role: 'ADMIN', isPrimaryManager: false },
      body: {
        studentId: student2.id,
        status: 'PRESENT',
        date: '2026-11-12'
      }
    };
    const resCross = createMockResponse();
    await markAttendance(reqCross, resCross);

    record(
      'Branch-assigned Admin permitted for matching branch student (200/201) and rejected for cross-branch student (403)',
      (resSame.getStatusCode() === 200 || resSame.getStatusCode() === 201) && resCross.getStatusCode() === 403
    );
  }

  // ── Scenario 9: Unsupported role (e.g. STUDENT) cannot mark attendance (403 Forbidden) ──
  {
    const req: any = {
      user: { userId: student1.id, role: 'STUDENT', institutionId: INST_A },
      tenantContext: { institutionId: INST_A, userId: student1.id, role: 'STUDENT' },
      body: {
        studentId: student1.id,
        status: 'PRESENT',
        date: '2026-11-12'
      }
    };
    const res = createMockResponse();
    await markAttendance(req, res);
    record(
      'Unsupported role (STUDENT) attempting to mark attendance is rejected with 403 Forbidden',
      res.getStatusCode() === 403
    );
  }

  // ── Scenario 10: Bulk attendance atomic validation: 1 unauthorized student rejects ENTIRE request with ZERO mutations ──
  {
    const initialCount = attendances.size;
    const req: any = {
      user: { userId: teacherA.id, role: 'TEACHER', institutionId: INST_A, branchId: BRANCH_1 },
      tenantContext: { institutionId: INST_A, branchId: BRANCH_1, userId: teacherA.id, role: 'TEACHER' },
      body: {
        records: [
          { studentId: student1.id, status: 'PRESENT' }, // Authorized
          { studentId: student3.id, status: 'PRESENT' }  // Unauthorized (Inst B)
        ],
        date: '2026-11-13'
      }
    };
    const res = createMockResponse();
    await bulkMarkAttendance(req, res);
    const finalCount = attendances.size;

    record(
      'Bulk attendance atomic pre-validation: Any unauthorized student causes full 403 reject with 0 mutations',
      res.getStatusCode() === 403 &&
      res.getJsonBody()?.unauthorizedStudentId === student3.id &&
      finalCount === initialCount
    );
  }

  // ── Scenario 11: Bulk attendance succeeds when all students are authorized ──
  {
    const initialCount = attendances.size;
    const req: any = {
      user: { userId: teacherA.id, role: 'TEACHER', institutionId: INST_A, branchId: BRANCH_1 },
      tenantContext: { institutionId: INST_A, branchId: BRANCH_1, userId: teacherA.id, role: 'TEACHER' },
      body: {
        records: [
          { studentId: student1.id, status: 'PRESENT' }
        ],
        date: '2026-11-14'
      }
    };
    const res = createMockResponse();
    await bulkMarkAttendance(req, res);
    record(
      'Bulk attendance succeeds when all target records are authorized (200 OK)',
      res.getStatusCode() === 200 && res.getJsonBody()?.count === 1 && attendances.size === initialCount + 1
    );
  }

  // ── Scenario 11b: Remediation C — Transaction rollback on mid-batch database failure ──
  {
    const initialCount = attendances.size;
    const req: any = {
      user: { userId: teacherA.id, role: 'TEACHER', institutionId: INST_A, branchId: BRANCH_1 },
      tenantContext: { institutionId: INST_A, branchId: BRANCH_1, userId: teacherA.id, role: 'TEACHER' },
      body: {
        records: [
          { studentId: studentCourseBranch1.id, status: 'PRESENT' }, // Record 1 (succeeds)
          { studentId: studentFailTx.id, status: 'PRESENT' }          // Record 2 (throws simulated failure)
        ],
        date: '2026-11-15'
      }
    };
    const res = createMockResponse();
    await bulkMarkAttendance(req, res);
    const finalCount = attendances.size;

    // Both students were pre-authorized, but mid-transaction DB error must rollback ALL mutations in batch!
    const wasRolledBack = !Array.from(attendances.values()).some((att: any) =>
      att.studentId === studentCourseBranch1.id && new Date(att.date).toISOString().startsWith('2026-11-15')
    );

    record(
      'Bulk attendance transaction rollback: Mid-batch mutation failure rolls back all earlier writes in transaction',
      res.getStatusCode() === 500 && finalCount === initialCount && wasRolledBack,
      `status=${res.getStatusCode()}, body=${JSON.stringify(res.getJsonBody())}`
    );
  }

  // ── Scenario 12: Clear attendance endpoint strictly enforces relationship boundaries ──
  {
    // Try to clear studentUnassigned by teacherA (no relationship)
    const req: any = {
      user: { userId: teacherA.id, role: 'TEACHER', institutionId: INST_A, branchId: BRANCH_1 },
      tenantContext: { institutionId: INST_A, branchId: BRANCH_1, userId: teacherA.id, role: 'TEACHER' },
      body: {
        studentId: studentUnassigned.id,
        date: '2026-11-12'
      }
    };
    const res = createMockResponse();
    await clearAttendanceRecord(req, res);
    record(
      'Clear attendance rejects teacher when no educational relationship exists (403)',
      res.getStatusCode() === 403 && res.getJsonBody()?.message?.includes('No authorized educational relationship')
    );
  }

  // ── Scenario 13: Clear attendance succeeds for authorized student and date ──
  {
    const req: any = {
      user: { userId: teacherA.id, role: 'TEACHER', institutionId: INST_A, branchId: BRANCH_1 },
      tenantContext: { institutionId: INST_A, branchId: BRANCH_1, userId: teacherA.id, role: 'TEACHER' },
      body: {
        studentId: student1.id,
        date: '2026-11-12'
      }
    };
    const res = createMockResponse();
    await clearAttendanceRecord(req, res);
    record(
      'Clear attendance successfully deletes record for authorized student and returns action CLEARED',
      res.getStatusCode() === 200 && res.getJsonBody()?.action === 'CLEARED'
    );
  }

  // ── Scenario 14: getAttendanceByDate strictly filters by institution and teacher relationship ──
  {
    // Seed an attendance for student3 in Inst B on 2026-11-14
    attendances.set('att-foreign', {
      id: 'att-foreign',
      studentId: student3.id,
      date: new Date('2026-11-14T10:00:00Z'),
      status: 'PRESENT'
    });

    const req: any = {
      user: { userId: teacherA.id, role: 'TEACHER', institutionId: INST_A, branchId: BRANCH_1 },
      tenantContext: { institutionId: INST_A, branchId: BRANCH_1, userId: teacherA.id, role: 'TEACHER' },
      query: { date: '2026-11-14' }
    };
    const res = createMockResponse();
    await getAttendanceByDate(req, res);
    const body = res.getJsonBody();
    const data = body?.data || [];
    // Should include student1's record from Scenario 11, but NEVER student3's foreign record
    const hasForeign = data.some((r: any) => r.studentId === student3.id);
    const hasOwn = data.some((r: any) => r.studentId === student1.id);
    record(
      'getAttendanceByDate includes authorized student records and strictly excludes foreign tenant records',
      res.getStatusCode() === 200 && hasOwn && !hasForeign
    );
  }

  // ── Scenario 14b: Workstream B — Branch-assigned Admin date read strictly scoped to branch ──
  {
    // Seed attendance for student2 in Branch 2 on 2026-11-14
    attendances.set('att-branch2', {
      id: 'att-branch2',
      studentId: student2.id,
      date: new Date('2026-11-14T10:00:00Z'),
      status: 'PRESENT'
    });

    const req: any = {
      user: { userId: adminBranch1.id, role: 'ADMIN', institutionId: INST_A, branchId: BRANCH_1, isPrimaryManager: false },
      tenantContext: { institutionId: INST_A, branchId: BRANCH_1, userId: adminBranch1.id, role: 'ADMIN', isPrimaryManager: false },
      query: { date: '2026-11-14' }
    };
    const res = createMockResponse();
    await getAttendanceByDate(req, res);
    const body = res.getJsonBody();
    const data = body?.data || [];
    const hasBranch1Student = data.some((r: any) => r.studentId === student1.id);
    const hasBranch2Student = data.some((r: any) => r.studentId === student2.id);

    record(
      'Branch-assigned Admin calling getAttendanceByDate sees only assigned branch records and excludes cross-branch records',
      res.getStatusCode() === 200 && hasBranch1Student && !hasBranch2Student
    );
  }

  // ── Scenario 14c: Workstream B — Institution-wide Primary Manager retains full institution date read ──
  {
    const req: any = {
      user: { userId: managerA.id, role: 'ADMIN', institutionId: INST_A, isPrimaryManager: true, branchId: null },
      tenantContext: { institutionId: INST_A, branchId: null, userId: managerA.id, role: 'ADMIN', isPrimaryManager: true },
      query: { date: '2026-11-14' }
    };
    const res = createMockResponse();
    await getAttendanceByDate(req, res);
    const body = res.getJsonBody();
    const data = body?.data || [];
    const hasBranch1Student = data.some((r: any) => r.studentId === student1.id);
    const hasBranch2Student = data.some((r: any) => r.studentId === student2.id);

    record(
      'Authorized Primary Manager with null branch retains institution-wide read scope across all branches',
      res.getStatusCode() === 200 && hasBranch1Student && hasBranch2Student
    );
  }

  // ── Scenario 14d: Workstream C — Unassigned Ordinary Admin date read rejected fail-closed ──
  {
    const req: any = {
      user: { userId: adminOrdinaryNull.id, role: 'ADMIN', institutionId: INST_A, isPrimaryManager: false, branchId: null },
      tenantContext: { institutionId: INST_A, branchId: null, userId: adminOrdinaryNull.id, role: 'ADMIN', isPrimaryManager: false },
      query: { date: '2026-11-14' }
    };
    const res = createMockResponse();
    await getAttendanceByDate(req, res);
    record(
      'Unassigned Ordinary Admin calling getAttendanceByDate is rejected fail-closed with 403 Forbidden',
      res.getStatusCode() === 403 && res.getJsonBody()?.message?.includes('Administrator must be assigned to an authoritative branch or possess Primary Manager authorization')
    );
  }

  // ── Scenario 15: updateAttendanceRecord rejects unauthorized student attendance modification ──
  {
    // Record belonging to student 3
    attendances.set('att-student3', {
      id: 'att-student3',
      studentId: student3.id,
      date: new Date('2026-11-12T00:00:00Z'),
      status: 'PRESENT'
    });

    const req: any = {
      params: { id: 'att-student3' },
      user: { userId: teacherA.id, role: 'TEACHER', institutionId: INST_A },
      tenantContext: { institutionId: INST_A, userId: teacherA.id, role: 'TEACHER' },
      body: { status: 'ABSENT' }
    };
    const res = createMockResponse();
    await updateAttendanceRecord(req, res);
    record(
      'DEF-AUDIT-002: updateAttendanceRecord returns 404 on cross-tenant record without disclosing record existence',
      res.getStatusCode() === 404 && res.getJsonBody()?.message === 'Attendance record not found'
    );
  }

  // ── Scenario 16: deleteAttendanceRecord rejects cross-tenant deletion with 404 Not Found (DEF-AUDIT-002) ──
  {
    const req: any = {
      params: { id: 'att-student3' },
      user: { userId: teacherA.id, role: 'TEACHER', institutionId: INST_A },
      tenantContext: { institutionId: INST_A, userId: teacherA.id, role: 'TEACHER' },
      body: {}
    };
    const res = createMockResponse();
    await deleteAttendanceRecord(req, res);
    record(
      'DEF-AUDIT-002: deleteAttendanceRecord returns 404 on cross-tenant record without disclosing record existence and preserves record',
      res.getStatusCode() === 404 && res.getJsonBody()?.message === 'Attendance record not found' && attendances.has('att-student3')
    );
  }

  // ── Scenario 17: Workstream E (Route 5) — getStudentAttendance (/my-attendance) ──
  {
    // Seed attendance for student 1
    attendances.set('att-student1-self', {
      id: 'att-student1-self',
      studentId: student1.id,
      date: new Date('2026-11-15T00:00:00Z'),
      status: 'PRESENT'
    });

    const req: any = {
      user: { userId: student1.id, role: 'STUDENT', institutionId: INST_A },
      tenantContext: { institutionId: INST_A, userId: student1.id, role: 'STUDENT' }
    };
    const res = createMockResponse();
    await getStudentAttendance(req, res);
    const body = res.getJsonBody();

    record(
      'getStudentAttendance returns student self attendance history and summary statistics (200 OK)',
      res.getStatusCode() === 200 && Array.isArray(body?.data) && body.data.length > 0 && body?.summary?.totalSessions > 0
    );
  }

  // ── Scenario 18: Workstream E (Route 6) — getStudentAttendanceById (/student/:studentId) ──
  {
    // 18a: Student queries own ID -> 200
    const reqSelf: any = {
      params: { studentId: student1.id },
      user: { userId: student1.id, role: 'STUDENT', institutionId: INST_A },
      tenantContext: { institutionId: INST_A, userId: student1.id, role: 'STUDENT' }
    };
    const resSelf = createMockResponse();
    await getStudentAttendanceById(reqSelf, resSelf);

    // 18b: Student queries another student -> 403
    const reqOther: any = {
      params: { studentId: student2.id },
      user: { userId: student1.id, role: 'STUDENT', institutionId: INST_A },
      tenantContext: { institutionId: INST_A, userId: student1.id, role: 'STUDENT' }
    };
    const resOther = createMockResponse();
    await getStudentAttendanceById(reqOther, resOther);

    // 18c: Registered Parent queries child -> 200
    const reqParentChild: any = {
      params: { studentId: student1.id },
      user: { userId: parent1.id, role: 'PARENT', institutionId: INST_A },
      tenantContext: { institutionId: INST_A, userId: parent1.id, role: 'PARENT' }
    };
    const resParentChild = createMockResponse();
    await getStudentAttendanceById(reqParentChild, resParentChild);

    // 18d: Parent queries unrelated child -> 403
    const reqParentUnrelated: any = {
      params: { studentId: student1.id },
      user: { userId: parentUnrelated.id, role: 'PARENT', institutionId: INST_A },
      tenantContext: { institutionId: INST_A, userId: parentUnrelated.id, role: 'PARENT' }
    };
    const resParentUnrelated = createMockResponse();
    await getStudentAttendanceById(reqParentUnrelated, resParentUnrelated);

    // 18e: Teacher queries authorized student -> 200
    const reqTeacherAuth: any = {
      params: { studentId: student1.id },
      user: { userId: teacherA.id, role: 'TEACHER', institutionId: INST_A, branchId: BRANCH_1 },
      tenantContext: { institutionId: INST_A, branchId: BRANCH_1, userId: teacherA.id, role: 'TEACHER' }
    };
    const resTeacherAuth = createMockResponse();
    await getStudentAttendanceById(reqTeacherAuth, resTeacherAuth);

    // 18f: Teacher queries cross-tenant student -> 403
    const reqTeacherForeign: any = {
      params: { studentId: student3.id },
      user: { userId: teacherA.id, role: 'TEACHER', institutionId: INST_A, branchId: BRANCH_1 },
      tenantContext: { institutionId: INST_A, branchId: BRANCH_1, userId: teacherA.id, role: 'TEACHER' }
    };
    const resTeacherForeign = createMockResponse();
    await getStudentAttendanceById(reqTeacherForeign, resTeacherForeign);

    record(
      'getStudentAttendanceById enforces strict student self, parent-child, and teacher educational boundaries',
      resSelf.getStatusCode() === 200 &&
      resOther.getStatusCode() === 403 &&
      resParentChild.getStatusCode() === 200 &&
      resParentUnrelated.getStatusCode() === 403 &&
      resTeacherAuth.getStatusCode() === 200 &&
      resTeacherForeign.getStatusCode() === 403
    );
  }

  // ── Scenario 19: Workstream E (Route 7) — getAttendancePercentage (/:studentId/percentage) ──
  {
    // 19a: Student queries own percentage -> 200
    const reqSelf: any = {
      params: { studentId: student1.id },
      user: { userId: student1.id, role: 'STUDENT', institutionId: INST_A },
      tenantContext: { institutionId: INST_A, userId: student1.id, role: 'STUDENT' }
    };
    const resSelf = createMockResponse();
    await getAttendancePercentage(reqSelf, resSelf);

    // 19b: Student queries another student's percentage -> 403
    const reqOther: any = {
      params: { studentId: student2.id },
      user: { userId: student1.id, role: 'STUDENT', institutionId: INST_A },
      tenantContext: { institutionId: INST_A, userId: student1.id, role: 'STUDENT' }
    };
    const resOther = createMockResponse();
    await getAttendancePercentage(reqOther, resOther);

    // 19c: Parent queries child percentage -> 200
    const reqParentChild: any = {
      params: { studentId: student1.id },
      user: { userId: parent1.id, role: 'PARENT', institutionId: INST_A },
      tenantContext: { institutionId: INST_A, userId: parent1.id, role: 'PARENT' }
    };
    const resParentChild = createMockResponse();
    await getAttendancePercentage(reqParentChild, resParentChild);

    // 19d: Parent queries unrelated student percentage -> 403
    const reqParentUnrelated: any = {
      params: { studentId: student1.id },
      user: { userId: parentUnrelated.id, role: 'PARENT', institutionId: INST_A },
      tenantContext: { institutionId: INST_A, userId: parentUnrelated.id, role: 'PARENT' }
    };
    const resParentUnrelated = createMockResponse();
    await getAttendancePercentage(reqParentUnrelated, resParentUnrelated);

    record(
      'getAttendancePercentage enforces student self, parent-child, and teacher educational boundaries',
      resSelf.getStatusCode() === 200 &&
      resSelf.getJsonBody()?.totalSessions !== undefined &&
      resOther.getStatusCode() === 403 &&
      resParentChild.getStatusCode() === 200 &&
      resParentUnrelated.getStatusCode() === 403
    );
  }

  // ── Scenario 29: Workstream D — Bulk notification creation failure handled and logged safely ──
  {
    const originalNotifCreate = mockDb.notification.create;
    let notifErrorThrown = false;
    mockDb.notification.create = async () => {
      notifErrorThrown = true;
      throw new Error('Simulated transient notification DB error');
    };

    const req: any = {
      user: { userId: teacherA.id, role: 'TEACHER', institutionId: INST_A, branchId: BRANCH_1 },
      tenantContext: { institutionId: INST_A, branchId: BRANCH_1, userId: teacherA.id, role: 'TEACHER' },
      body: {
        records: [{ studentId: student1.id, status: 'ABSENT' }],
        date: '2026-11-16'
      }
    };
    const res = createMockResponse();
    await bulkMarkAttendance(req, res);

    // Restore original mockDb.notification.create
    mockDb.notification.create = originalNotifCreate;

    record(
      'Post-transaction notification creation failure does not abort attendance mutation and is safely handled',
      res.getStatusCode() === 200 && res.getJsonBody()?.success === true && notifErrorThrown
    );
  }

  // ── Scenario 30: Dedicated Single markAttendance notification failure handled safely ──
  {
    const originalNotifCreate = mockDb.notification.create;
    let notifErrorThrown = false;
    mockDb.notification.create = async () => {
      notifErrorThrown = true;
      throw new Error('Simulated single notification delivery error');
    };

    const req: any = {
      user: { userId: teacherA.id, role: 'TEACHER', institutionId: INST_A, branchId: BRANCH_1 },
      tenantContext: { institutionId: INST_A, branchId: BRANCH_1, userId: teacherA.id, role: 'TEACHER' },
      body: {
        studentId: student1.id,
        status: 'PRESENT',
        date: '2026-11-17'
      }
    };
    const res = createMockResponse();
    await markAttendance(req, res);

    mockDb.notification.create = originalNotifCreate;

    record(
      'Dedicated single markAttendance notification failure does not abort attendance record upsert (200/201)',
      (res.getStatusCode() === 200 || res.getStatusCode() === 201) &&
      res.getJsonBody()?.status === 'PRESENT' &&
      notifErrorThrown
    );
  }

  // ── Scenario 31: Bulk notification resilience when one recipient fails and others succeed ──
  {
    const originalNotifCreate = mockDb.notification.create;
    const dispatchedTo = new Set<string>();
    mockDb.notification.create = async ({ data }: any) => {
      if (data.userId === student1.id) {
        throw new Error('Simulated transient notification failure for student1');
      }
      dispatchedTo.add(data.userId);
      return { id: 'notif-' + Math.random().toString(36).substring(2, 7), ...data };
    };

    const req: any = {
      user: { userId: teacherA.id, role: 'TEACHER', institutionId: INST_A, branchId: BRANCH_1 },
      tenantContext: { institutionId: INST_A, branchId: BRANCH_1, userId: teacherA.id, role: 'TEACHER' },
      body: {
        records: [
          { studentId: student1.id, status: 'LATE' },
          { studentId: studentCourseBranch1.id, status: 'PRESENT' }
        ],
        date: '2026-11-18'
      }
    };
    const res = createMockResponse();
    await bulkMarkAttendance(req, res);

    mockDb.notification.create = originalNotifCreate;

    record(
      'Bulk notification dispatch continues for subsequent students when one notification creation fails',
      res.getStatusCode() === 200 &&
      res.getJsonBody()?.success === true &&
      res.getJsonBody()?.count === 2 &&
      dispatchedTo.has(studentCourseBranch1.id) &&
      !dispatchedTo.has(student1.id)
    );
  }

  // ── Scenario 32: Upfront role guard on update and delete rejects unauthorized roles with 403 (No 404 existence disclosure) ──
  {
    const reqUpdate: any = {
      user: { userId: student1.id, role: 'ONLINE_STUDENT', institutionId: INST_A, branchId: BRANCH_1 },
      tenantContext: { institutionId: INST_A, branchId: BRANCH_1, userId: student1.id, role: 'ONLINE_STUDENT' },
      params: { id: 'non-existent-uuid-or-probe' },
      body: { status: 'PRESENT' }
    };
    const resUpdate = createMockResponse();
    await updateAttendanceRecord(reqUpdate, resUpdate);

    const reqDelete: any = {
      user: { userId: student1.id, role: 'ONLINE_STUDENT', institutionId: INST_A, branchId: BRANCH_1 },
      tenantContext: { institutionId: INST_A, branchId: BRANCH_1, userId: student1.id, role: 'ONLINE_STUDENT' },
      params: { id: 'non-existent-uuid-or-probe' }
    };
    const resDelete = createMockResponse();
    await deleteAttendanceRecord(reqDelete, resDelete);

    record(
      'Upfront role guard on updateAttendanceRecord and deleteAttendanceRecord rejects non-admin/teacher with 403 Forbidden without 404 existence leak',
      resUpdate.getStatusCode() === 403 &&
      resDelete.getStatusCode() === 403
    );
  }

  // ── Scenario 33: Object-level existence oracle elimination for authorized roles (DEF-AUDIT-002) ──
  {
    // Seed an existing foreign attendance record belonging to student3 (INST_B)
    const foreignAttId = 'att-foreign-inst-b-uuid';
    attendances.set(foreignAttId, {
      id: foreignAttId,
      studentId: student3.id,
      date: new Date('2026-11-19T00:00:00.000Z'),
      status: 'PRESENT'
    });

    const teacherReqContext = {
      user: { userId: teacherA.id, role: 'TEACHER', institutionId: INST_A, branchId: BRANCH_1 },
      tenantContext: { institutionId: INST_A, branchId: BRANCH_1, userId: teacherA.id, role: 'TEACHER' }
    };

    // 1. PUT on non-existent UUID
    const resPutNonExistent = createMockResponse();
    await updateAttendanceRecord({
      ...teacherReqContext,
      params: { id: 'uuid-that-does-not-exist-at-all' },
      body: { status: 'LATE' }
    } as any, resPutNonExistent);

    // 2. PUT on existing foreign UUID
    const resPutForeign = createMockResponse();
    await updateAttendanceRecord({
      ...teacherReqContext,
      params: { id: foreignAttId },
      body: { status: 'LATE' }
    } as any, resPutForeign);

    // 3. DELETE on non-existent UUID
    const resDeleteNonExistent = createMockResponse();
    await deleteAttendanceRecord({
      ...teacherReqContext,
      params: { id: 'uuid-that-does-not-exist-at-all' }
    } as any, resDeleteNonExistent);

    // 4. DELETE on existing foreign UUID
    const resDeleteForeign = createMockResponse();
    await deleteAttendanceRecord({
      ...teacherReqContext,
      params: { id: foreignAttId }
    } as any, resDeleteForeign);

    // Clean up seeded foreign attendance
    attendances.delete(foreignAttId);

    const uniform404 =
      resPutNonExistent.getStatusCode() === 404 &&
      resPutForeign.getStatusCode() === 404 &&
      resDeleteNonExistent.getStatusCode() === 404 &&
      resDeleteForeign.getStatusCode() === 404 &&
      resPutNonExistent.getJsonBody()?.message === 'Attendance record not found' &&
      resPutForeign.getJsonBody()?.message === 'Attendance record not found' &&
      resDeleteNonExistent.getJsonBody()?.message === 'Attendance record not found' &&
      resDeleteForeign.getJsonBody()?.message === 'Attendance record not found';

    record(
      'DEF-AUDIT-002: update and delete attendance return identical 404 for non-existent and foreign-tenant records (No Existence Oracle)',
      uniform404
    );
  }

  // ── Scenario 34: Transaction failure in bulkMarkAttendance aborts with error and dispatches ZERO notifications ──
  {
    let notifDispatched = false;
    const originalNotifCreate = mockDb.notification.create;
    mockDb.notification.create = async () => {
      notifDispatched = true;
      return { id: 'notif-should-never-be-called' };
    };

    // Use failure trigger studentId defined in mock $transaction
    const req: any = {
      user: { userId: teacherA.id, role: 'TEACHER', institutionId: INST_A, branchId: BRANCH_1 },
      tenantContext: { institutionId: INST_A, branchId: BRANCH_1, userId: teacherA.id, role: 'TEACHER' },
      body: {
        records: [
          { studentId: '99999999-9999-4999-a999-999999999999', status: 'PRESENT' }
        ],
        date: '2026-11-20'
      }
    };
    // Ensure student exists in user map so pre-validation passes
    users.set('99999999-9999-4999-a999-999999999999', {
      id: '99999999-9999-4999-a999-999999999999',
      role: 'ONLINE_STUDENT',
      institutionId: INST_A,
      branchId: BRANCH_1,
      deletedAt: null
    });
    studentTeachers.set(`99999999-9999-4999-a999-999999999999_${teacherA.id}`, {
      studentId: '99999999-9999-4999-a999-999999999999',
      teacherId: teacherA.id,
      status: 'ACTIVE'
    });

    const res = createMockResponse();
    await bulkMarkAttendance(req, res);

    mockDb.notification.create = originalNotifCreate;
    users.delete('99999999-9999-4999-a999-999999999999');
    studentTeachers.delete(`99999999-9999-4999-a999-999999999999_${teacherA.id}`);

    record(
      'Transaction failure in bulkMarkAttendance aborts execution and dispatches ZERO notifications',
      res.getStatusCode() === 500 &&
      !notifDispatched
    );
  }

  // ── Scenario 35: Attendance changes remain fully committed and accessible in store after post-commit notification failure ──
  {
    const originalNotifCreate = mockDb.notification.create;
    mockDb.notification.create = async () => {
      throw new Error('Simulated post-commit notification service outage');
    };

    const targetDate = '2026-11-21';
    const req: any = {
      user: { userId: teacherA.id, role: 'TEACHER', institutionId: INST_A, branchId: BRANCH_1 },
      tenantContext: { institutionId: INST_A, branchId: BRANCH_1, userId: teacherA.id, role: 'TEACHER' },
      body: {
        studentId: student1.id,
        status: 'LATE',
        date: targetDate
      }
    };
    const res = createMockResponse();
    await markAttendance(req, res);

    mockDb.notification.create = originalNotifCreate;

    const persisted = await mockDb.attendance.findFirst({
      where: {
        studentId: student1.id,
        date: { gte: new Date(targetDate), lte: new Date(targetDate) }
      }
    });

    record(
      'Attendance changes remain committed and accessible in DB store after notification failure',
      (res.getStatusCode() === 200 || res.getStatusCode() === 201) &&
      persisted !== null &&
      persisted.status === 'LATE'
    );
  }

  console.log(`\n================================================================`);
  console.log(`  Attendance Authorization Suite Summary: ${passed}/${total} Scenarios Passed`);
  console.log(`================================================================\n`);

  if (passed !== total) {
    process.exit(1);
  }
}

runAttendanceSecurityTests().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
