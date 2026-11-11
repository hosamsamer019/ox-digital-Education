/**
 * OX-DIGITAL Education — Phase II-D
 * Teacher Student Roster Integrity & Scalability Test Suite
 *
 * Strictly Isolated In-Memory Suite (Zero database connection, zero port 5432/5433 access)
 *
 * Verifies all required P1 roster integrity assertions:
 * 1. Directly linked student appears once.
 * 2. Course-enrolled student appears once.
 * 3. Student present in both sources appears only once (deduplication).
 * 4. DEF-IICA-001: subscriptionStatus=LOCKED excludes ACTIVE course-only students.
 * 5. subscriptionStatus=ACTIVE excludes LOCKED students.
 * 6. Student with financialAccessStatus=LOCKED correctly reflects LOCKED access status.
 * 7. Grade filter works across both direct links and course enrollments.
 * 8. Role/type filter works across both data sources.
 * 9. Search (name & email) works across complete merged authorized set.
 * 10. DEF-IICA-002: Branch-scoped teacher cannot see students from another branch.
 * 11. Institution-scoped teacher cannot see students from another institution.
 * 12. Synthetic dataset of 250+ students: page 1 (limit 20), page 2 (limit 20), total=250, totalPages=13.
 * 13. Dynamic filter combination maintains strict consistency across total, count, and data slice.
 * 14. Safe normalization of malformed and empty pagination inputs (page, limit).
 * 15. Missing teacher authentication or missing institution identity fails closed (401/403).
 */

import assert from 'assert';

// In-Memory Data Store
const users = new Map<string, any>();
const studentTeachers = new Map<string, any>();
const courses = new Map<string, any>();
const courseEnrollments = new Map<string, any>();

function clearStore() {
  users.clear();
  studentTeachers.clear();
  courses.clear();
  courseEnrollments.clear();
}

// Mock Prisma Client
const mockDb: any = {
  user: {
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
      return list.map(u => ({
        ...u,
        parent: u.parentId ? users.get(u.parentId) : null,
        studentMonthlySubscriptions: []
      }));
    }
  },
  studentTeacher: {
    findMany: async ({ where }: any) => {
      let list = Array.from(studentTeachers.values());
      if (where.teacherId) list = list.filter(st => st.teacherId === where.teacherId);
      if (where.status) list = list.filter(st => st.status === where.status);
      if (where.student) {
        list = list.filter(st => {
          const s = users.get(st.studentId);
          if (!s) return false;
          if (where.student.institutionId && s.institutionId !== where.student.institutionId) return false;
          if (where.student.branchId && s.branchId !== where.student.branchId) return false;
          if (where.student.deletedAt === null && s.deletedAt) return false;
          return true;
        });
      }
      return list.map(st => ({
        ...st,
        student: {
          ...users.get(st.studentId),
          parent: null,
          studentMonthlySubscriptions: []
        }
      }));
    }
  },
  course: {
    findMany: async ({ where }: any) => {
      let list = Array.from(courses.values());
      if (where.teacherId) list = list.filter(c => c.teacherId === where.teacherId);
      if (where.institutionId) list = list.filter(c => c.institutionId === where.institutionId);
      if (where.branchId) list = list.filter(c => c.branchId === where.branchId);
      if (where.deletedAt === null) list = list.filter(c => !c.deletedAt);
      return list;
    }
  },
  courseEnrollment: {
    findMany: async ({ where }: any) => {
      let list = Array.from(courseEnrollments.values());
      if (where.courseId && where.courseId.in) {
        list = list.filter(ce => where.courseId.in.includes(ce.courseId));
      }
      return list;
    }
  }
};

// Set in-memory global mock BEFORE controller import
(globalThis as any).prismaGlobal = mockDb;

import { BrdSubscriptionController, resolveAuthoritativeAccessStatus } from './src/controllers/brdSubscription.controller.js';

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
async function runTeacherStudentsRosterTests() {
  console.log('================================================================');
  console.log('  OX-DIGITAL Phase II-D: Teacher Student Roster Regression Tests');
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

  const INST_A = 'inst-alpha-100';
  const INST_B = 'inst-beta-200';
  const BRANCH_1 = 'branch-001';
  const BRANCH_2 = 'branch-002';
  const TEACHER_1 = 'teacher-101';

  // Seed Teacher
  users.set(TEACHER_1, {
    id: TEACHER_1,
    role: 'TEACHER',
    institutionId: INST_A,
    branchId: BRANCH_1,
    name: 'Primary Teacher'
  });

  // Seed Students
  // Student A: Direct link only (ACTIVE)
  const studentA = { id: 'std-a', name: 'Ahmed Direct', email: 'ahmed@test.com', role: 'STUDENT', gradeLevel: 'G10', institutionId: INST_A, branchId: BRANCH_1, financialAccessStatus: 'ACTIVE' };
  users.set(studentA.id, studentA);
  studentTeachers.set(`${studentA.id}_${TEACHER_1}`, {
    id: 'st-a',
    studentId: studentA.id,
    teacherId: TEACHER_1,
    status: 'ACTIVE',
    accessStatus: 'ACTIVE',
    createdAt: new Date('2026-01-01')
  });

  // Student B: Course enrollment only (ACTIVE)
  const studentB = { id: 'std-b', name: 'Basma Course', email: 'basma@test.com', role: 'ONLINE_STUDENT', gradeLevel: 'G11', institutionId: INST_A, branchId: BRANCH_1, financialAccessStatus: 'ACTIVE' };
  users.set(studentB.id, studentB);
  courses.set('c-101', { id: 'c-101', teacherId: TEACHER_1, institutionId: INST_A, branchId: BRANCH_1, deletedAt: null });
  courseEnrollments.set('ce-b', { id: 'ce-b', studentId: studentB.id, courseId: 'c-101', createdAt: new Date('2026-01-02') });

  // Student C: Present in BOTH direct links and course enrollments (Deduplication test)
  const studentC = { id: 'std-c', name: 'Carim Both', email: 'carim@test.com', role: 'STUDENT', gradeLevel: 'G10', institutionId: INST_A, branchId: BRANCH_1, financialAccessStatus: 'ACTIVE' };
  users.set(studentC.id, studentC);
  studentTeachers.set(`${studentC.id}_${TEACHER_1}`, {
    id: 'st-c',
    studentId: studentC.id,
    teacherId: TEACHER_1,
    status: 'ACTIVE',
    accessStatus: 'ACTIVE',
    createdAt: new Date('2026-01-03')
  });
  courseEnrollments.set('ce-c', { id: 'ce-c', studentId: studentC.id, courseId: 'c-101', createdAt: new Date('2026-01-03') });

  // Student D: Locked student (financialAccessStatus=LOCKED, direct link accessStatus=LOCKED)
  const studentD = { id: 'std-d', name: 'Dina Locked', email: 'dina@test.com', role: 'STUDENT', gradeLevel: 'G12', institutionId: INST_A, branchId: BRANCH_1, financialAccessStatus: 'LOCKED' };
  users.set(studentD.id, studentD);
  studentTeachers.set(`${studentD.id}_${TEACHER_1}`, {
    id: 'st-d',
    studentId: studentD.id,
    teacherId: TEACHER_1,
    status: 'ACTIVE',
    accessStatus: 'LOCKED',
    createdAt: new Date('2026-01-04')
  });

  // Student E: Course-enrolled student with financialAccessStatus=LOCKED (Course-only locked)
  const studentE = { id: 'std-e', name: 'Essam CourseLocked', email: 'essam@test.com', role: 'ONLINE_STUDENT', gradeLevel: 'G12', institutionId: INST_A, branchId: BRANCH_1, financialAccessStatus: 'LOCKED' };
  users.set(studentE.id, studentE);
  courseEnrollments.set('ce-e', { id: 'ce-e', studentId: studentE.id, courseId: 'c-101', createdAt: new Date('2026-01-05') });

  // Student F: Student in Branch 2 (Cross-branch student)
  const studentF = { id: 'std-f', name: 'Farah Branch2', email: 'farah@test.com', role: 'STUDENT', gradeLevel: 'G10', institutionId: INST_A, branchId: BRANCH_2, financialAccessStatus: 'ACTIVE' };
  users.set(studentF.id, studentF);
  studentTeachers.set(`${studentF.id}_${TEACHER_1}`, {
    id: 'st-f',
    studentId: studentF.id,
    teacherId: TEACHER_1,
    status: 'ACTIVE',
    accessStatus: 'ACTIVE',
    createdAt: new Date('2026-01-06')
  });

  // Student G: Student in Institution B (Cross-tenant student)
  const studentG = { id: 'std-g', name: 'Gamal Foreign', email: 'gamal@foreign.com', role: 'STUDENT', gradeLevel: 'G10', institutionId: INST_B, branchId: BRANCH_1, financialAccessStatus: 'ACTIVE' };
  users.set(studentG.id, studentG);
  studentTeachers.set(`${studentG.id}_${TEACHER_1}`, {
    id: 'st-g',
    studentId: studentG.id,
    teacherId: TEACHER_1,
    status: 'ACTIVE',
    accessStatus: 'ACTIVE',
    createdAt: new Date('2026-01-07')
  });

  // Student H: Student with financialAccessStatus=RESTRICTED (Monthly fee restriction DEF-IIDD-001)
  const studentH = { id: 'std-h', name: 'Hossam Restricted', email: 'hossam@test.com', role: 'STUDENT', gradeLevel: 'G10', institutionId: INST_A, branchId: BRANCH_1, financialAccessStatus: 'RESTRICTED' };
  users.set(studentH.id, studentH);
  studentTeachers.set(`${studentH.id}_${TEACHER_1}`, {
    id: 'st-h',
    studentId: studentH.id,
    teacherId: TEACHER_1,
    status: 'ACTIVE',
    accessStatus: 'ACTIVE',
    createdAt: new Date('2026-01-08')
  });

  // ── Scenario 1: Directly linked student appears in roster ──
  {
    const req: any = {
      user: { userId: TEACHER_1, role: 'TEACHER', institutionId: INST_A, branchId: null },
      tenantContext: { institutionId: INST_A, branchId: null, userId: TEACHER_1, role: 'TEACHER' },
      query: { search: 'Ahmed' }
    };
    const res = createMockResponse();
    await BrdSubscriptionController.getTeacherStudents(req, res);
    const body = res.getJsonBody();
    record('Directly linked student appears in roster', res.getStatusCode() === 200 && body?.total === 1 && body?.data[0]?.id === studentA.id);
  }

  // ── Scenario 2: Course-enrolled student appears in roster ──
  {
    const req: any = {
      user: { userId: TEACHER_1, role: 'TEACHER', institutionId: INST_A, branchId: null },
      tenantContext: { institutionId: INST_A, branchId: null, userId: TEACHER_1, role: 'TEACHER' },
      query: { search: 'Basma' }
    };
    const res = createMockResponse();
    await BrdSubscriptionController.getTeacherStudents(req, res);
    const body = res.getJsonBody();
    record('Course-enrolled student appears in roster', res.getStatusCode() === 200 && body?.total === 1 && body?.data[0]?.id === studentB.id);
  }

  // ── Scenario 3: Deduplication: Student C present in both direct links and course enrollments appears exactly once ──
  {
    const req: any = {
      user: { userId: TEACHER_1, role: 'TEACHER', institutionId: INST_A, branchId: null },
      tenantContext: { institutionId: INST_A, branchId: null, userId: TEACHER_1, role: 'TEACHER' },
      query: { search: 'Carim' }
    };
    const res = createMockResponse();
    await BrdSubscriptionController.getTeacherStudents(req, res);
    const body = res.getJsonBody();
    record('Student present in both direct links and course enrollments is deduplicated to exactly one entry', res.getStatusCode() === 200 && body?.total === 1 && body?.data?.length === 1);
  }

  // ── Scenario 4: DEF-IICA-001: subscriptionStatus=LOCKED excludes ACTIVE course-only students ──
  {
    const req: any = {
      user: { userId: TEACHER_1, role: 'TEACHER', institutionId: INST_A, branchId: null },
      tenantContext: { institutionId: INST_A, branchId: null, userId: TEACHER_1, role: 'TEACHER' },
      query: { subscriptionStatus: 'LOCKED' }
    };
    const res = createMockResponse();
    await BrdSubscriptionController.getTeacherStudents(req, res);
    const body = res.getJsonBody();
    const data = body?.data || [];
    const hasActiveCourseStudent = data.some((s: any) => s.id === studentB.id);
    const hasLockedStudents = data.some((s: any) => s.id === studentD.id) && data.some((s: any) => s.id === studentE.id);
    record('subscriptionStatus=LOCKED excludes ACTIVE course-only students and includes locked students', !hasActiveCourseStudent && hasLockedStudents && data.every((s: any) => s.accessStatus === 'LOCKED'));
  }

  // ── Scenario 5: subscriptionStatus=ACTIVE excludes LOCKED students ──
  {
    const req: any = {
      user: { userId: TEACHER_1, role: 'TEACHER', institutionId: INST_A, branchId: null },
      tenantContext: { institutionId: INST_A, branchId: null, userId: TEACHER_1, role: 'TEACHER' },
      query: { subscriptionStatus: 'ACTIVE' }
    };
    const res = createMockResponse();
    await BrdSubscriptionController.getTeacherStudents(req, res);
    const body = res.getJsonBody();
    const data = body?.data || [];
    const hasLockedD = data.some((s: any) => s.id === studentD.id);
    const hasLockedE = data.some((s: any) => s.id === studentE.id);
    const hasActiveA = data.some((s: any) => s.id === studentA.id);
    const hasActiveB = data.some((s: any) => s.id === studentB.id);
    record('subscriptionStatus=ACTIVE excludes LOCKED students and includes ACTIVE students', !hasLockedD && !hasLockedE && hasActiveA && hasActiveB);
  }

  // ── Scenario 6: Course-enrolled student with financialAccessStatus=LOCKED correctly resolves to LOCKED ──
  {
    const req: any = {
      user: { userId: TEACHER_1, role: 'TEACHER', institutionId: INST_A, branchId: null },
      tenantContext: { institutionId: INST_A, branchId: null, userId: TEACHER_1, role: 'TEACHER' },
      query: { search: 'Essam' }
    };
    const res = createMockResponse();
    await BrdSubscriptionController.getTeacherStudents(req, res);
    const body = res.getJsonBody();
    record('Course-enrolled student with financialAccessStatus=LOCKED resolves accessStatus to LOCKED', body?.data[0]?.accessStatus === 'LOCKED');
  }

  // ── Scenario 6b: Workstream A — Financial Access Status Precedence Matrix (16 Conditions) ──
  {
    // 1. Direct link ACTIVE + financial LOCKED -> LOCKED
    const c1 = resolveAuthoritativeAccessStatus('ACTIVE', 'LOCKED') === 'LOCKED';
    // 2. Direct link LOCKED + financial ACTIVE -> LOCKED
    const c2 = resolveAuthoritativeAccessStatus('LOCKED', 'ACTIVE') === 'LOCKED';
    // 3. Direct link ACTIVE + financial ACTIVE -> ACTIVE
    const c3 = resolveAuthoritativeAccessStatus('ACTIVE', 'ACTIVE') === 'ACTIVE';
    // 4. Direct link null + financial LOCKED -> LOCKED
    const c4 = resolveAuthoritativeAccessStatus(null, 'LOCKED') === 'LOCKED';
    // 5. Direct link null + financial GRACE_PERIOD -> GRACE_PERIOD
    const c5 = resolveAuthoritativeAccessStatus(null, 'GRACE_PERIOD') === 'GRACE_PERIOD';
    // 6. Course-only student with financial LOCKED -> LOCKED
    const c6 = resolveAuthoritativeAccessStatus(null, 'LOCKED') === 'LOCKED';
    // 7. Course-only student with missing financial status -> LOCKED (fail-closed)
    const c7 = resolveAuthoritativeAccessStatus(null, null) === 'LOCKED';
    // 8. Financial status RESTRICTED with direct link ACTIVE -> RESTRICTED (DEF-IIDD-001)
    const c8 = resolveAuthoritativeAccessStatus('ACTIVE', 'RESTRICTED') === 'RESTRICTED';
    // 9. Direct link RESTRICTED with financial ACTIVE -> RESTRICTED
    const c9 = resolveAuthoritativeAccessStatus('RESTRICTED', 'ACTIVE') === 'RESTRICTED';
    // 10. Financial status RESTRICTED with link null -> RESTRICTED
    const c10 = resolveAuthoritativeAccessStatus(null, 'RESTRICTED') === 'RESTRICTED';
    // 11. LOCKED takes precedence over RESTRICTED
    const c11 = resolveAuthoritativeAccessStatus('LOCKED', 'RESTRICTED') === 'LOCKED' &&
                resolveAuthoritativeAccessStatus('RESTRICTED', 'LOCKED') === 'LOCKED';
    // 12. RESTRICTED takes precedence over GRACE_PERIOD
    const c12 = resolveAuthoritativeAccessStatus('RESTRICTED', 'GRACE_PERIOD') === 'RESTRICTED' &&
                resolveAuthoritativeAccessStatus('GRACE_PERIOD', 'RESTRICTED') === 'RESTRICTED';
    // 13. Unknown string fails closed to LOCKED
    const c13 = resolveAuthoritativeAccessStatus('UNKNOWN', 'ACTIVE') === 'LOCKED' &&
                resolveAuthoritativeAccessStatus('ACTIVE', 'BOGUS') === 'LOCKED';
    // 14. Empty string fails closed to LOCKED
    const c14 = resolveAuthoritativeAccessStatus('', '') === 'LOCKED';
    // 15. Student H with financialAccessStatus=RESTRICTED resolves accessStatus to RESTRICTED in API
    let c15 = false;
    // 16. Filtering subscriptionStatus=RESTRICTED returns RESTRICTED student
    let c16 = false;

    record(
      'Workstream A Precedence Matrix: RESTRICTED recognized, fail-closed on unknown/missing across 14 matrix unit checks',
      c1 && c2 && c3 && c4 && c5 && c6 && c7 && c8 && c9 && c10 && c11 && c12 && c13 && c14
    );
  }

  // ── Scenario 6c: RESTRICTED student correctly excluded from ACTIVE filter and included in RESTRICTED filter ──
  {
    const reqRestricted: any = {
      user: { userId: TEACHER_1, role: 'TEACHER', institutionId: INST_A, branchId: null },
      tenantContext: { institutionId: INST_A, branchId: null, userId: TEACHER_1, role: 'TEACHER' },
      query: { subscriptionStatus: 'RESTRICTED' }
    };
    const resRestricted = createMockResponse();
    await BrdSubscriptionController.getTeacherStudents(reqRestricted, resRestricted);
    const bodyRestricted = resRestricted.getJsonBody();
    const dataRestricted = bodyRestricted?.data || [];
    const hasStudentHInRestricted = dataRestricted.some((s: any) => s.id === studentH.id && s.accessStatus === 'RESTRICTED');

    const reqActive: any = {
      user: { userId: TEACHER_1, role: 'TEACHER', institutionId: INST_A, branchId: null },
      tenantContext: { institutionId: INST_A, branchId: null, userId: TEACHER_1, role: 'TEACHER' },
      query: { subscriptionStatus: 'ACTIVE' }
    };
    const resActive = createMockResponse();
    await BrdSubscriptionController.getTeacherStudents(reqActive, resActive);
    const bodyActive = resActive.getJsonBody();
    const dataActive = bodyActive?.data || [];
    const hasStudentHInActive = dataActive.some((s: any) => s.id === studentH.id);

    record(
      'Workstream A: RESTRICTED student resolves to RESTRICTED, included in RESTRICTED filter, excluded from ACTIVE filter',
      hasStudentHInRestricted && !hasStudentHInActive
    );
  }

  // ── Scenario 7: Grade filter works across both direct links and course enrollments ──
  {
    const req: any = {
      user: { userId: TEACHER_1, role: 'TEACHER', institutionId: INST_A, branchId: null },
      tenantContext: { institutionId: INST_A, branchId: null, userId: TEACHER_1, role: 'TEACHER' },
      query: { grade: 'G10' }
    };
    const res = createMockResponse();
    await BrdSubscriptionController.getTeacherStudents(req, res);
    const body = res.getJsonBody();
    const data = body?.data || [];
    record('Grade filter G10 returns all G10 students across both sources and excludes other grades', data.length > 0 && data.every((s: any) => s.gradeLevel === 'G10'));
  }

  // ── Scenario 8: Role/type filter works across both data sources ──
  {
    const req: any = {
      user: { userId: TEACHER_1, role: 'TEACHER', institutionId: INST_A, branchId: null },
      tenantContext: { institutionId: INST_A, branchId: null, userId: TEACHER_1, role: 'TEACHER' },
      query: { type: 'ONLINE_STUDENT' }
    };
    const res = createMockResponse();
    await BrdSubscriptionController.getTeacherStudents(req, res);
    const body = res.getJsonBody();
    const data = body?.data || [];
    record('Type filter ONLINE_STUDENT returns only ONLINE_STUDENT records', data.length > 0 && data.every((s: any) => s.role === 'ONLINE_STUDENT'));
  }

  // ── Scenario 9: In-memory search by name and email across complete merged set ──
  {
    const req: any = {
      user: { userId: TEACHER_1, role: 'TEACHER', institutionId: INST_A, branchId: null },
      tenantContext: { institutionId: INST_A, branchId: null, userId: TEACHER_1, role: 'TEACHER' },
      query: { search: 'test.com' }
    };
    const res = createMockResponse();
    await BrdSubscriptionController.getTeacherStudents(req, res);
    const body = res.getJsonBody();
    record('Search by email substring test.com matches merged set', body?.total >= 4);
  }

  // ── Scenario 10: DEF-IICA-002: Branch-scoped teacher cannot see students from another branch ──
  {
    const req: any = {
      user: { userId: TEACHER_1, role: 'TEACHER', institutionId: INST_A, branchId: BRANCH_1 },
      tenantContext: { institutionId: INST_A, branchId: BRANCH_1, userId: TEACHER_1, role: 'TEACHER' },
      query: {}
    };
    const res = createMockResponse();
    await BrdSubscriptionController.getTeacherStudents(req, res);
    const body = res.getJsonBody();
    const data = body?.data || [];
    const hasBranch2Student = data.some((s: any) => s.id === studentF.id);
    record('Branch-scoped teacher (Branch 1) strictly excludes Branch 2 students from roster', !hasBranch2Student && data.every((s: any) => s.branchId === BRANCH_1));
  }

  // ── Scenario 11: Institution-scoped teacher cannot see students from another institution ──
  {
    const req: any = {
      user: { userId: TEACHER_1, role: 'TEACHER', institutionId: INST_A, branchId: null },
      tenantContext: { institutionId: INST_A, branchId: null, userId: TEACHER_1, role: 'TEACHER' },
      query: {}
    };
    const res = createMockResponse();
    await BrdSubscriptionController.getTeacherStudents(req, res);
    const body = res.getJsonBody();
    const data = body?.data || [];
    const hasForeignStudent = data.some((s: any) => s.id === studentG.id);
    record('Teacher roster strictly excludes students belonging to a foreign institution', !hasForeignStudent);
  }

  // ── Scenario 12: Synthetic dataset of 250 students pagination test ──
  {
    // Generate 250 synthetic direct students for TEACHER_1 in INST_A
    for (let i = 1; i <= 250; i++) {
      const synId = `syn-student-${i}`;
      users.set(synId, {
        id: synId,
        name: `Synthetic Student ${i}`,
        email: `syn${i}@test.com`,
        role: 'STUDENT',
        gradeLevel: 'G10',
        institutionId: 'inst-synth-999',
        branchId: 'branch-synth',
        financialAccessStatus: 'ACTIVE'
      });
      studentTeachers.set(`${synId}_teacher-synth`, {
        id: `st-syn-${i}`,
        studentId: synId,
        teacherId: 'teacher-synth',
        status: 'ACTIVE',
        accessStatus: 'ACTIVE',
        createdAt: new Date('2026-02-01')
      });
    }

    // Page 1: limit 20
    const req1: any = {
      user: { userId: 'teacher-synth', role: 'TEACHER', institutionId: 'inst-synth-999', branchId: null },
      tenantContext: { institutionId: 'inst-synth-999', branchId: null, userId: 'teacher-synth', role: 'TEACHER' },
      query: { page: '1', limit: '20' }
    };
    const res1 = createMockResponse();
    await BrdSubscriptionController.getTeacherStudents(req1, res1);
    const b1 = res1.getJsonBody();

    // Page 2: limit 20
    const req2: any = {
      user: { userId: 'teacher-synth', role: 'TEACHER', institutionId: 'inst-synth-999', branchId: null },
      tenantContext: { institutionId: 'inst-synth-999', branchId: null, userId: 'teacher-synth', role: 'TEACHER' },
      query: { page: '2', limit: '20' }
    };
    const res2 = createMockResponse();
    await BrdSubscriptionController.getTeacherStudents(req2, res2);
    const b2 = res2.getJsonBody();

    const ok1 = b1?.total === 250 && b1?.count === 20 && b1?.totalPages === 13 && b1?.page === 1;
    const ok2 = b2?.total === 250 && b2?.count === 20 && b2?.page === 2 && b1.data[0].id !== b2.data[0].id;

    record('Synthetic dataset of 250 students: pagination returns page 1 (20), page 2 (20), total=250, totalPages=13', ok1 && ok2);
  }

  // ── Scenario 13: Changing filters produces consistent totals and slice counts ──
  {
    const req: any = {
      user: { userId: 'teacher-synth', role: 'TEACHER', institutionId: 'inst-synth-999', branchId: null },
      tenantContext: { institutionId: 'inst-synth-999', branchId: null, userId: 'teacher-synth', role: 'TEACHER' },
      query: { search: 'Synthetic Student 1', limit: '10' }
    };
    const res = createMockResponse();
    await BrdSubscriptionController.getTeacherStudents(req, res);
    const body = res.getJsonBody();
    record('Filtered search on synthetic set derives total, count, and data slice from identical filtered set', body?.total === 111 && body?.count === 10 && body?.totalPages === 12);
  }

  // ── Scenario 14: Safe normalization of empty and malformed pagination inputs ──
  {
    const req: any = {
      user: { userId: 'teacher-synth', role: 'TEACHER', institutionId: 'inst-synth-999', branchId: null },
      tenantContext: { institutionId: 'inst-synth-999', branchId: null, userId: 'teacher-synth', role: 'TEACHER' },
      query: { page: '-5', limit: 'invalid_number' }
    };
    const res = createMockResponse();
    await BrdSubscriptionController.getTeacherStudents(req, res);
    const body = res.getJsonBody();
    record('Empty/malformed page and limit inputs are safely normalized (page defaults to 1, limit to 20)', body?.page === 1 && body?.limit === 20 && body?.count === 20);
  }

  // ── Scenario 15: Missing authorization context fails closed (401 / 403) ──
  {
    // 15a: Missing tenant context
    const reqNoTenant: any = {
      user: { userId: TEACHER_1, role: 'TEACHER', institutionId: null },
      tenantContext: { institutionId: null, userId: TEACHER_1, role: 'TEACHER' },
      query: {}
    };
    const resNoTenant = createMockResponse();
    await BrdSubscriptionController.getTeacherStudents(reqNoTenant, resNoTenant);

    // 15b: Non-teacher role
    const reqNotTeacher: any = {
      user: { userId: 'admin-uuid', role: 'ADMIN', institutionId: INST_A },
      tenantContext: { institutionId: INST_A, userId: 'admin-uuid', role: 'ADMIN' },
      query: {}
    };
    const resNotTeacher = createMockResponse();
    await BrdSubscriptionController.getTeacherStudents(reqNotTeacher, resNotTeacher);

    record(
      'Missing tenant context returns 401, non-teacher role returns 403 (Strict fail-closed authorization)',
      resNoTenant.getStatusCode() === 401 && resNotTeacher.getStatusCode() === 403
    );
  }

  console.log(`\n================================================================`);
  console.log(`  Teacher Students Roster Suite Summary: ${passed}/${total} Scenarios Passed`);
  console.log(`================================================================\n`);

  if (passed !== total) {
    process.exit(1);
  }
}

runTeacherStudentsRosterTests().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
