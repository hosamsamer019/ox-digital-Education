/**
 * OX-DIGITAL Education — Manager Roster Institution Isolation & Branch Aggregation Test Suite
 *
 * Verifies:
 * 1. DEF-AUDIT-001: Strict Institution Isolation on getManagerStudents.
 *    - Primary Manager in Institution A strictly cannot access students in Institution B.
 *    - Ordinary branch-assigned admin cannot access students in other branches.
 * 2. DEF-AUDIT-003: Data contract returns studentTeacherLinks with authoritative resolved accessStatus.
 * 3. Additional Finding: Status filter handles ACTIVE, GRACE_PERIOD, LOCKED, RESTRICTED, ALL, and rejects invalid inputs with 400.
 * 4. DEF-AUDIT-004: Distinct student aggregation in getBranches:
 *    - Reconciles link status with student.financialAccessStatus.
 *    - Prevents duplicate counting of students with multiple teacher links.
 *    - Includes course-only branch students based on authoritative financial status.
 */

import { BrdSubscriptionController, resolveMultiLinkAccessStatus } from './src/controllers/brdSubscription.controller.js';
import { tenantContextMiddleware } from '../../packages/shared/src/tenant/tenantContext.js';

const INST_A = 'inst-alpha-uuid';
const INST_B = 'inst-beta-uuid';
const BRANCH_1 = 'branch-1-uuid';
const BRANCH_2 = 'branch-2-uuid';

// Mock DB Entities
const mockUsers = new Map<string, any>();
const mockBranches = new Map<string, any>();
const mockStudentTeachers = new Map<string, any>();

// Seed Teachers
const teacherA = { id: 'teacher-a-id', name: 'Teacher A', email: 'teacherA@test.com', role: 'TEACHER', institutionId: INST_A, branchId: BRANCH_1, deletedAt: null };
const teacherB = { id: 'teacher-b-id', name: 'Teacher B', email: 'teacherB@test.com', role: 'TEACHER', institutionId: INST_A, branchId: BRANCH_1, deletedAt: null };
mockUsers.set(teacherA.id, teacherA);
mockUsers.set(teacherB.id, teacherB);

// Seed Branches
mockBranches.set(BRANCH_1, { id: BRANCH_1, name: 'Branch 1', code: 'BR1', institutionId: INST_A, status: 'ACTIVE', users: [teacherA, teacherB] });
mockBranches.set(BRANCH_2, { id: BRANCH_2, name: 'Branch 2', code: 'BR2', institutionId: INST_A, status: 'ACTIVE', users: [] });

// Seed Students in INST_A
const studentA1 = {
  id: 'student-a1-id',
  name: 'Student A1 Active',
  email: 'a1@test.com',
  role: 'CENTER_STUDENT',
  institutionId: INST_A,
  branchId: BRANCH_1,
  financialAccessStatus: 'ACTIVE',
  deletedAt: null,
  studentTeacherLinks: [],
  studentMonthlySubscriptions: []
};

const studentA2_MultiTeacher = {
  id: 'student-a2-multi-id',
  name: 'Student A2 Multi Teacher',
  email: 'a2@test.com',
  role: 'CENTER_STUDENT',
  institutionId: INST_A,
  branchId: BRANCH_1,
  financialAccessStatus: 'ACTIVE',
  deletedAt: null,
  studentTeacherLinks: [],
  studentMonthlySubscriptions: []
};

const studentA3_Restricted = {
  id: 'student-a3-restricted-id',
  name: 'Student A3 Restricted',
  email: 'a3@test.com',
  role: 'CENTER_STUDENT',
  institutionId: INST_A,
  branchId: BRANCH_1,
  financialAccessStatus: 'RESTRICTED',
  deletedAt: null,
  studentTeacherLinks: [],
  studentMonthlySubscriptions: []
};

const studentA4_CourseOnly = {
  id: 'student-a4-course-only-id',
  name: 'Student A4 Course Only',
  email: 'a4@test.com',
  role: 'ONLINE_STUDENT',
  institutionId: INST_A,
  branchId: BRANCH_1,
  financialAccessStatus: 'ACTIVE',
  deletedAt: null,
  studentTeacherLinks: [],
  studentMonthlySubscriptions: []
};

// Seed Student in foreign institution INST_B
const studentB1_Foreign = {
  id: 'student-b1-foreign-id',
  name: 'Student B1 Foreign',
  email: 'b1@foreign.com',
  role: 'CENTER_STUDENT',
  institutionId: INST_B,
  branchId: 'branch-b-uuid',
  financialAccessStatus: 'ACTIVE',
  deletedAt: null,
  studentTeacherLinks: [],
  studentMonthlySubscriptions: []
};

mockUsers.set(studentA1.id, studentA1);
mockUsers.set(studentA2_MultiTeacher.id, studentA2_MultiTeacher);
mockUsers.set(studentA3_Restricted.id, studentA3_Restricted);
mockUsers.set(studentA4_CourseOnly.id, studentA4_CourseOnly);
mockUsers.set(studentB1_Foreign.id, studentB1_Foreign);

// Seed Teacher Links
// Student A1 has 1 link with Teacher A (ACTIVE)
const linkA1 = {
  id: 'link-a1',
  studentId: studentA1.id,
  teacherId: teacherA.id,
  status: 'ACTIVE',
  accessStatus: 'ACTIVE',
  teacher: teacherA,
  student: studentA1
};
mockStudentTeachers.set(`${studentA1.id}_${teacherA.id}`, linkA1);

// Student A2 has 2 links in Branch 1 (Teacher A and Teacher B, both ACTIVE) -> tests de-duplication
const linkA2_1 = {
  id: 'link-a2-1',
  studentId: studentA2_MultiTeacher.id,
  teacherId: teacherA.id,
  status: 'ACTIVE',
  accessStatus: 'ACTIVE',
  teacher: teacherA,
  student: studentA2_MultiTeacher
};
const linkA2_2 = {
  id: 'link-a2-2',
  studentId: studentA2_MultiTeacher.id,
  teacherId: teacherB.id,
  status: 'ACTIVE',
  accessStatus: 'ACTIVE',
  teacher: teacherB,
  student: studentA2_MultiTeacher
};
mockStudentTeachers.set(`${studentA2_MultiTeacher.id}_${teacherA.id}`, linkA2_1);
mockStudentTeachers.set(`${studentA2_MultiTeacher.id}_${teacherB.id}`, linkA2_2);

// Student A3 has teacher link ACTIVE, but center-level financialAccessStatus is RESTRICTED -> tests reconciliation
const linkA3 = {
  id: 'link-a3',
  studentId: studentA3_Restricted.id,
  teacherId: teacherA.id,
  status: 'ACTIVE',
  accessStatus: 'ACTIVE',
  teacher: teacherA,
  student: studentA3_Restricted
};
mockStudentTeachers.set(`${studentA3_Restricted.id}_${teacherA.id}`, linkA3);

// Assign links to students
studentA1.studentTeacherLinks = [linkA1];
studentA2_MultiTeacher.studentTeacherLinks = [linkA2_1, linkA2_2];
studentA3_Restricted.studentTeacherLinks = [linkA3];
studentA4_CourseOnly.studentTeacherLinks = [];
studentB1_Foreign.studentTeacherLinks = [];

const mockDb: any = {
  user: {
    findMany: async ({ where, skip, take }: any) => {
      const res: any[] = [];
      for (const u of mockUsers.values()) {
        if (where?.id?.in && !where.id.in.includes(u.id)) continue;
        if (where?.role && where.role.in && !where.role.in.includes(u.role)) continue;
        if (where?.institutionId && u.institutionId !== where.institutionId) continue;
        if (where?.branchId && u.branchId !== where.branchId) continue;
        if (where?.deletedAt === null && u.deletedAt !== null) continue;
        if (where?.gradeLevel && u.gradeLevel !== where.gradeLevel) continue;
        if (where?.OR) {
          const match = where.OR.some((cond: any) => {
            if (cond.responsibleTeacherId && u.responsibleTeacherId === cond.responsibleTeacherId) return true;
            if (cond.studentTeacherLinks?.some?.teacherId) {
              return (u.studentTeacherLinks || []).some((l: any) => l.teacherId === cond.studentTeacherLinks.some.teacherId);
            }
            return false;
          });
          if (!match) continue;
        } else if (where?.responsibleTeacherId && u.responsibleTeacherId !== where.responsibleTeacherId) {
          continue;
        }
        const branchObj = u.branchId ? mockBranches.get(u.branchId) : null;
        res.push({
          ...u,
          branch: branchObj ? { id: branchObj.id, name: branchObj.name, code: branchObj.code } : null
        });
      }
      if (skip !== undefined || take !== undefined) {
        const start = skip || 0;
        const end = take !== undefined ? start + take : undefined;
        return res.slice(start, end);
      }
      return res;
    },
    count: async ({ where }: any) => {
      const records = await mockDb.user.findMany({ where });
      return records.length;
    },
    findFirst: async ({ where }: any) => {
      for (const u of mockUsers.values()) {
        if (where.id && u.id !== where.id) continue;
        if (where.institutionId && u.institutionId !== where.institutionId) continue;
        if (where.role && u.role !== where.role) continue;
        if (where.deletedAt === null && u.deletedAt !== null) continue;
        return { ...u };
      }
      return null;
    }
  },
  branch: {
    findMany: async ({ where }: any) => {
      const res: any[] = [];
      for (const b of mockBranches.values()) {
        if (where.institutionId && b.institutionId !== where.institutionId) continue;
        res.push({ ...b, users: b.users || [] });
      }
      return res;
    },
    findFirst: async ({ where }: any) => {
      for (const b of mockBranches.values()) {
        if (where.id && b.id !== where.id) continue;
        if (where.institutionId && b.institutionId !== where.institutionId) continue;
        return { ...b };
      }
      return null;
    }
  },
  studentTeacher: {
    findMany: async ({ where }: any) => {
      const res: any[] = [];
      for (const st of mockStudentTeachers.values()) {
        if (where.status && st.status !== where.status) continue;
        if (where.teacher?.branchId && st.teacher.branchId !== where.teacher.branchId) continue;
        if (where.teacher?.institutionId && st.teacher.institutionId !== where.teacher.institutionId) continue;
        if (where.student?.institutionId && st.student.institutionId !== where.student.institutionId) continue;
        if (where.student?.deletedAt === null && st.student?.deletedAt !== null) continue;
        res.push({ ...st });
      }
      return res;
    }
  },
  studentMonthlySubscription: {
    findMany: async () => []
  }
};

(globalThis as any).prismaGlobal = mockDb;

function createMockResponse() {
  let statusCode = 200;
  let jsonBody: any = null;
  return {
    status(code: number) {
      statusCode = code;
      return this;
    },
    json(body: any) {
      jsonBody = body;
      return this;
    },
    getStatusCode: () => statusCode,
    getJsonBody: () => jsonBody
  };
}

async function runTests() {
  console.log('================================================================');
  console.log('  OX-DIGITAL: Manager Roster & Branch Aggregation Test Suite');
  console.log('================================================================\n');

  let passed = 0;
  let total = 0;

  function record(desc: string, ok: boolean) {
    total++;
    if (ok) {
      passed++;
      console.log(`  ✓ Test ${total}: ${desc}`);
    } else {
      console.error(`  ✗ Test ${total} FAILED: ${desc}`);
    }
  }

  const primaryManagerReq = {
    user: { id: 'pm-id', userId: 'pm-id', role: 'ADMIN', isPrimaryManager: true, institutionId: INST_A, branchId: null },
    tenantContext: { userId: 'pm-id', role: 'ADMIN', isPrimaryManager: true, institutionId: INST_A, branchId: null }
  };

  // 1. DEF-AUDIT-001: Primary Manager strictly retrieves only students from their institution
  {
    const req: any = {
      ...primaryManagerReq,
      query: {}
    };
    const res = createMockResponse();
    await BrdSubscriptionController.getManagerStudents(req, res);

    const body = res.getJsonBody();
    const studentIds = body?.data?.map((s: any) => s.id) || [];

    record(
      'DEF-AUDIT-001: getManagerStudents enforces institutionId scope and strictly excludes foreign institution students',
      res.getStatusCode() === 200 &&
      !studentIds.includes(studentB1_Foreign.id) &&
      studentIds.includes(studentA1.id) &&
      studentIds.includes(studentA2_MultiTeacher.id)
    );
  }

  // 2. DEF-AUDIT-001: Missing tenant context fails closed with 401 Unauthorized
  {
    const req: any = {
      user: { id: 'pm-id', userId: 'pm-id', role: 'ADMIN', isPrimaryManager: true },
      tenantContext: { userId: 'pm-id', role: 'ADMIN', isPrimaryManager: true },
      query: {}
    };
    const res = createMockResponse();
    await BrdSubscriptionController.getManagerStudents(req, res);

    record(
      'DEF-AUDIT-001: Missing institution context rejects with 401 Unauthorized',
      res.getStatusCode() === 401
    );
  }

  // 3. DEF-AUDIT-001: Branch-scoped admin cannot access other branches (403 Forbidden)
  {
    const req: any = {
      user: { id: 'admin-b1-id', userId: 'admin-b1-id', role: 'ADMIN', isPrimaryManager: true, institutionId: INST_A, branchId: BRANCH_1 },
      tenantContext: { userId: 'admin-b1-id', role: 'ADMIN', isPrimaryManager: true, institutionId: INST_A, branchId: BRANCH_1 },
      query: { branchId: BRANCH_2 }
    };
    const res = createMockResponse();
    await BrdSubscriptionController.getManagerStudents(req, res);

    record(
      'DEF-AUDIT-001: Branch-assigned admin querying a different branch rejects with 403 Forbidden',
      res.getStatusCode() === 403
    );
  }

  // 4. DEF-AUDIT-003: Contract returns studentTeacherLinks with authoritative resolved accessStatus
  {
    const req: any = {
      ...primaryManagerReq,
      query: {}
    };
    const res = createMockResponse();
    await BrdSubscriptionController.getManagerStudents(req, res);

    const body = res.getJsonBody();
    const studentA3 = body?.data?.find((s: any) => s.id === studentA3_Restricted.id);

    record(
      'DEF-AUDIT-003: Response contains studentTeacherLinks with resolved accessStatus (RESTRICTED reconciled)',
      res.getStatusCode() === 200 &&
      Array.isArray(studentA3?.studentTeacherLinks) &&
      studentA3?.studentTeacherLinks[0]?.accessStatus === 'RESTRICTED' &&
      studentA3?.studentTeacherLinks[0]?.teacher?.name === teacherA.name
    );
  }

  // 5. DEF-AUDIT-003: Response provides both studentTeacherLinks and data/students array properties
  {
    const req: any = {
      ...primaryManagerReq,
      query: {}
    };
    const res = createMockResponse();
    await BrdSubscriptionController.getManagerStudents(req, res);

    const body = res.getJsonBody();

    record(
      'DEF-AUDIT-003: Response exposes both data and students arrays for complete frontend contract compatibility',
      res.getStatusCode() === 200 &&
      Array.isArray(body?.data) &&
      Array.isArray(body?.students) &&
      body?.data?.length === body?.students?.length
    );
  }

  // 6. Additional Finding: Status Filter = ACTIVE excludes RESTRICTED students
  {
    const req: any = {
      ...primaryManagerReq,
      query: { status: 'ACTIVE' }
    };
    const res = createMockResponse();
    await BrdSubscriptionController.getManagerStudents(req, res);

    const body = res.getJsonBody();
    const studentIds = body?.data?.map((s: any) => s.id) || [];

    record(
      'Status filter ACTIVE includes active students and excludes RESTRICTED student',
      res.getStatusCode() === 200 &&
      studentIds.includes(studentA1.id) &&
      !studentIds.includes(studentA3_Restricted.id)
    );
  }

  // 7. Additional Finding: Status Filter = RESTRICTED returns only RESTRICTED student
  {
    const req: any = {
      ...primaryManagerReq,
      query: { status: 'RESTRICTED' }
    };
    const res = createMockResponse();
    await BrdSubscriptionController.getManagerStudents(req, res);

    const body = res.getJsonBody();
    const studentIds = body?.data?.map((s: any) => s.id) || [];

    record(
      'Status filter RESTRICTED returns only RESTRICTED student and excludes ACTIVE students',
      res.getStatusCode() === 200 &&
      studentIds.length === 1 &&
      studentIds[0] === studentA3_Restricted.id
    );
  }

  // 8. Additional Finding: Invalid status filter rejects with 400 Bad Request
  {
    const req: any = {
      ...primaryManagerReq,
      query: { status: 'INVALID_STATUS' }
    };
    const res = createMockResponse();
    await BrdSubscriptionController.getManagerStudents(req, res);

    record(
      'Invalid status filter safely rejects with 400 Bad Request and does not broaden results',
      res.getStatusCode() === 400 &&
      res.getJsonBody()?.message?.includes('Invalid status filter')
    );
  }

  // 9. DEF-AUDIT-004: Distinct Student Aggregation in getBranches (No Duplication for multi-teacher students)
  {
    const req: any = {
      ...primaryManagerReq
    };
    const res = createMockResponse();
    await BrdSubscriptionController.getBranches(req, res);

    const body = res.getJsonBody();
    const branch1Summary = body?.data?.find((b: any) => b.id === BRANCH_1);

    // In Branch 1:
    // - studentA1: 1 link (ACTIVE) -> ACTIVE
    // - studentA2: 2 links (Teacher A, Teacher B, both ACTIVE) -> ACTIVE (Must be counted ONCE)
    // - studentA3: 1 link (Teacher A ACTIVE), but financialAccessStatus is RESTRICTED -> LOCKED/RESTRICTED
    // - studentA4: Course only in Branch 1 with financialAccessStatus ACTIVE -> ACTIVE
    // Total distinct students: 4
    // Active students: 3 (A1, A2, A4)
    // Locked/Restricted students: 1 (A3)
    record(
      'DEF-AUDIT-004: getBranches counts distinct students (studentA2 with 2 teachers counted ONCE, total distinct = 4)',
      res.getStatusCode() === 200 &&
      branch1Summary !== undefined &&
      branch1Summary.activeStudents === 3 &&
      branch1Summary.lockedStudents === 1
    );
  }

  // 10. DEF-AUDIT-004: Student with ACTIVE teacher link but center-level RESTRICTED is counted in lockedStudents
  {
    const req: any = {
      ...primaryManagerReq
    };
    const res = createMockResponse();
    await BrdSubscriptionController.getBranches(req, res);

    const body = res.getJsonBody();
    const branch1Summary = body?.data?.find((b: any) => b.id === BRANCH_1);

    record(
      'DEF-AUDIT-004: Reconciled studentA3 (ACTIVE link + RESTRICTED center) is counted under lockedStudents',
      branch1Summary?.lockedStudents === 1
    );
  }

  // 11. Concern A: Order-independent multi-link resolution precedence (LOCKED > RESTRICTED > GRACE_PERIOD > ACTIVE)
  {
    const test1_OrderA = resolveMultiLinkAccessStatus(['ACTIVE', 'LOCKED'], 'ACTIVE');
    const test1_OrderB = resolveMultiLinkAccessStatus(['LOCKED', 'ACTIVE'], 'ACTIVE');
    const test2_OrderA = resolveMultiLinkAccessStatus(['ACTIVE', 'RESTRICTED'], 'ACTIVE');
    const test2_OrderB = resolveMultiLinkAccessStatus(['RESTRICTED', 'ACTIVE'], 'ACTIVE');
    const test3_OrderA = resolveMultiLinkAccessStatus(['ACTIVE', 'GRACE_PERIOD'], 'ACTIVE');
    const test3_OrderB = resolveMultiLinkAccessStatus(['GRACE_PERIOD', 'ACTIVE'], 'ACTIVE');
    const test4_FailClosed = resolveMultiLinkAccessStatus([], null);

    record(
      'Concern A: resolveMultiLinkAccessStatus is order-independent and enforces authoritative precedence',
      test1_OrderA === 'LOCKED' &&
      test1_OrderB === 'LOCKED' &&
      test2_OrderA === 'RESTRICTED' &&
      test2_OrderB === 'RESTRICTED' &&
      test3_OrderA === 'GRACE_PERIOD' &&
      test3_OrderB === 'GRACE_PERIOD' &&
      test4_FailClosed === 'LOCKED'
    );
  }

  // 12. Concern A: End-to-end getManagerStudents resolves multi-link status regardless of link array order
  {
    // Temporarily swap studentA2's links so teacher B is first, and make one link RESTRICTED
    const originalLinks = studentA2_MultiTeacher.studentTeacherLinks;
    studentA2_MultiTeacher.studentTeacherLinks = [
      { ...linkA2_2, accessStatus: 'RESTRICTED' },
      { ...linkA2_1, accessStatus: 'ACTIVE' }
    ];

    const req: any = {
      ...primaryManagerReq,
      query: {}
    };
    const res = createMockResponse();
    await BrdSubscriptionController.getManagerStudents(req, res);

    const students = res.getJsonBody()?.data;
    const a2 = students?.find((s: any) => s.id === studentA2_MultiTeacher.id);

    // Restore original links
    studentA2_MultiTeacher.studentTeacherLinks = originalLinks;

    record(
      'Concern A: getManagerStudents resolves overallAccessStatus to RESTRICTED when links are [RESTRICTED, ACTIVE] (not first-link dependent)',
      res.getStatusCode() === 200 &&
      a2 !== undefined &&
      a2.overallAccessStatus === 'RESTRICTED'
    );
  }

  // 13. Concern A: getManagerStudents pagination total matches filtered result count
  {
    const req: any = {
      ...primaryManagerReq,
      query: { status: 'ACTIVE', page: '1', limit: '2' }
    };
    const res = createMockResponse();
    await BrdSubscriptionController.getManagerStudents(req, res);

    const body = res.getJsonBody();
    record(
      'Concern A: getManagerStudents pagination computes total against filtered set without premature slicing',
      res.getStatusCode() === 200 &&
      body.success === true &&
      body.total === 3 && // A1, A2, A4 are ACTIVE
      body.count === 2 && // limit is 2
      body.page === 1 &&
      body.totalPages === 2
    );
  }

  // 14. Concern B: Missing tenant identity fails closed with 401 Unauthorized
  {
    const req: any = {
      user: { userId: 'manager-user-id', role: 'PRIMARY_MANAGER', isPrimaryManager: true, institutionId: null },
      tenantContext: null,
      query: {}
    };
    const res = createMockResponse();
    await BrdSubscriptionController.getManagerStudents(req, res);

    record(
      'Concern B: getManagerStudents fails closed with 401 when tenant identity is missing',
      res.getStatusCode() === 401 &&
      res.getJsonBody()?.message === 'Unauthorized: Missing tenant identity'
    );
  }

  // 15. Concern A & B: Filter by teacherId matches studentTeacherLinks even when legacy responsibleTeacherId is null
  {
    const req: any = {
      ...primaryManagerReq,
      query: { teacherId: teacherA.id }
    };
    const res = createMockResponse();
    await BrdSubscriptionController.getManagerStudents(req, res);

    const body = res.getJsonBody();
    const students = body?.data || [];
    const hasA1 = students.some((s: any) => s.id === studentA1.id);
    const hasA2 = students.some((s: any) => s.id === studentA2_MultiTeacher.id);
    const hasA4_CourseOnly = students.some((s: any) => s.id === studentA4_CourseOnly.id);

    record(
      'Concern A & B: getManagerStudents filters by teacherId matching studentTeacherLinks and excludes unlinked students',
      res.getStatusCode() === 200 &&
      hasA1 &&
      hasA2 &&
      !hasA4_CourseOnly
    );
  }

  // 16. Multi-page Pagination Stability (Strategy 1): Disjoint sets, stable ordering, total=4, totalPages=2
  {
    const req1: any = {
      ...primaryManagerReq,
      query: { page: '1', limit: '2' }
    };
    const res1 = createMockResponse();
    await BrdSubscriptionController.getManagerStudents(req1, res1);
    const body1 = res1.getJsonBody();

    const req2: any = {
      ...primaryManagerReq,
      query: { page: '2', limit: '2' }
    };
    const res2 = createMockResponse();
    await BrdSubscriptionController.getManagerStudents(req2, res2);
    const body2 = res2.getJsonBody();

    const page1Ids = new Set((body1?.data || []).map((s: any) => s.id));
    const page2Ids = new Set((body2?.data || []).map((s: any) => s.id));
    const isDisjoint = (body2?.data || []).every((s: any) => !page1Ids.has(s.id));

    record(
      'Multi-page Pagination Stability: page 1 and page 2 return disjoint sets with accurate totals (Strategy 1)',
      res1.getStatusCode() === 200 &&
      res2.getStatusCode() === 200 &&
      body1?.total === 4 &&
      body2?.total === 4 &&
      body1?.totalPages === 2 &&
      body2?.totalPages === 2 &&
      body1?.count === 2 &&
      body2?.count === 2 &&
      page1Ids.size === 2 &&
      page2Ids.size === 2 &&
      isDisjoint
    );
  }

  // 17. Out-of-bounds Page: page 99 returns empty data array, count 0, total 4, totalPages 2
  {
    const req: any = {
      ...primaryManagerReq,
      query: { page: '99', limit: '2' }
    };
    const res = createMockResponse();
    await BrdSubscriptionController.getManagerStudents(req, res);
    const body = res.getJsonBody();

    record(
      'Out-of-bounds Page: page 99 returns empty data, count 0, total 4, totalPages 2',
      res.getStatusCode() === 200 &&
      body?.success === true &&
      Array.isArray(body?.data) &&
      body.data.length === 0 &&
      body.count === 0 &&
      body.total === 4 &&
      body.page === 99 &&
      body.totalPages === 2
    );
  }

  // 18. Search & Grade with Pagination (Strategy 2): Lean candidate projection with substring filtering
  {
    const req: any = {
      ...primaryManagerReq,
      query: { search: 'Course Only', page: '1', limit: '10' }
    };
    const res = createMockResponse();
    await BrdSubscriptionController.getManagerStudents(req, res);
    const body = res.getJsonBody();

    record(
      'Search & Grade with Pagination: Substring filter with Strategy 2 resolves exact matches and pagination metadata',
      res.getStatusCode() === 200 &&
      body?.success === true &&
      body.total === 1 &&
      body.count === 1 &&
      body.data.length === 1 &&
      body.data[0].id === studentA4_CourseOnly.id &&
      body.data[0].name === studentA4_CourseOnly.name
    );
  }

  // 19. Direct DB Pagination Strategy 1: Unconstrained query executes DB count and skip/take
  {
    const req: any = {
      ...primaryManagerReq,
      query: { page: '1', limit: '3' }
    };
    const res = createMockResponse();
    await BrdSubscriptionController.getManagerStudents(req, res);
    const body = res.getJsonBody();

    record(
      'Direct DB Pagination Strategy 1: Unconstrained query hydrates strictly limit slice with complete relations',
      res.getStatusCode() === 200 &&
      body?.success === true &&
      body.total === 4 &&
      body.count === 3 &&
      body.totalPages === 2 &&
      body.page === 1 &&
      body.limit === 3 &&
      body.data.length === 3 &&
      body.data.every((s: any) => s.branch !== undefined && s.studentTeacherLinks !== undefined)
    );
  }

  // 20. Client Header Tenant Spoofing: Rejected with 403 CROSS_TENANT_IDOR_BLOCKED
  {
    const spoofReq: any = {
      user: { userId: 'manager-user-id', role: 'PRIMARY_MANAGER', isPrimaryManager: true, institutionId: INST_A },
      headers: { 'x-institution-id': INST_B }
    };
    const spoofRes = createMockResponse();
    let nextCalled = false;
    tenantContextMiddleware(spoofReq, spoofRes, () => { nextCalled = true; });

    record(
      'Client Header Tenant Spoofing: tenantContextMiddleware rejects header spoofing with 403 CROSS_TENANT_IDOR_BLOCKED',
      spoofRes.getStatusCode() === 403 &&
      spoofRes.getJsonBody()?.code === 'CROSS_TENANT_IDOR_BLOCKED' &&
      !nextCalled
    );
  }

  // 21. Query Param Tenant Spoofing: Ignored by getManagerStudents, strictly enforces authenticated institutionId
  {
    const spoofReq: any = {
      ...primaryManagerReq,
      query: { institutionId: INST_B }
    };
    const res = createMockResponse();
    await BrdSubscriptionController.getManagerStudents(spoofReq, res);
    const body = res.getJsonBody();
    const students = body?.data || [];

    const containsForeign = students.some((s: any) => s.institutionId === INST_B || s.id === studentB1_Foreign.id);
    const allBelongToAlpha = students.every((s: any) => s.institutionId === undefined || s.institutionId === INST_A);

    record(
      'Query Param Tenant Spoofing: getManagerStudents ignores ?institutionId spoof and confines query to JWT institution',
      res.getStatusCode() === 200 &&
      students.length > 0 &&
      !containsForeign &&
      allBelongToAlpha
    );
  }

  // 22. Branch Operational Counting Policy Lockdown: Resident vs Instructional Delivery Load
  {
    // Seed dynamic entities:
    // Teacher C in Branch 2
    const teacherC = { id: 'teacher-c-branch2', name: 'Teacher C', email: 'teacherC@test.com', role: 'TEACHER', institutionId: INST_A, branchId: BRANCH_2, deletedAt: null };
    mockUsers.set(teacherC.id, teacherC);
    mockBranches.get(BRANCH_2).users = [teacherC];

    // Cross-branch student: resident of Branch 1, but instructed by Teacher C in Branch 2
    const studentCross = {
      id: 'student-cross-branch',
      name: 'Cross Branch Student',
      email: 'cross@test.com',
      role: 'CENTER_STUDENT',
      institutionId: INST_A,
      branchId: BRANCH_1,
      financialAccessStatus: 'ACTIVE',
      deletedAt: null,
      studentTeacherLinks: [],
      studentMonthlySubscriptions: []
    };
    const linkCross = {
      id: 'link-cross',
      studentId: studentCross.id,
      teacherId: teacherC.id,
      status: 'ACTIVE',
      accessStatus: 'ACTIVE',
      teacher: teacherC,
      student: studentCross
    };
    studentCross.studentTeacherLinks = [linkCross as any];
    mockUsers.set(studentCross.id, studentCross);
    mockStudentTeachers.set(`${studentCross.id}_${teacherC.id}`, linkCross);

    // Unassigned student: no branch, no teacher links
    const studentUnassigned = {
      id: 'student-unassigned',
      name: 'Unassigned Student',
      email: 'unassigned@test.com',
      role: 'ONLINE_STUDENT',
      institutionId: INST_A,
      branchId: null,
      financialAccessStatus: 'ACTIVE',
      deletedAt: null,
      studentTeacherLinks: [],
      studentMonthlySubscriptions: []
    };
    mockUsers.set(studentUnassigned.id, studentUnassigned);

    const res = createMockResponse();
    await BrdSubscriptionController.getBranches(primaryManagerReq, res);
    const body = res.getJsonBody();
    const branch1 = (body?.branches || []).find((b: any) => b.id === BRANCH_1);
    const branch2 = (body?.branches || []).find((b: any) => b.id === BRANCH_2);

    // Branch 1 has A1, A2, A3, A4 (4 original) + studentCross (resident) = 5
    // Branch 2 has 0 resident, but studentCross is linked to Teacher C (Branch 2 instructional load) = 1
    // studentUnassigned has no branch and no links -> excluded from both
    const branch1Valid = branch1 && branch1.activeStudents + branch1.lockedStudents === 5;
    const branch2Valid = branch2 && branch2.activeStudents + branch2.lockedStudents === 1;

    // Clean up temporary seeded entities
    mockUsers.delete(teacherC.id);
    mockUsers.delete(studentCross.id);
    mockUsers.delete(studentUnassigned.id);
    mockStudentTeachers.delete(`${studentCross.id}_${teacherC.id}`);
    mockBranches.get(BRANCH_2).users = [];

    record(
      'Branch Operational Counting Policy: Branch 1 counts resident, Branch 2 counts instructional load, unassigned is excluded',
      res.getStatusCode() === 200 &&
      Boolean(branch1Valid) &&
      Boolean(branch2Valid)
    );
  }

  console.log(`\n================================================================`);
  console.log(`  Manager Roster & Branches Suite: ${passed}/${total} Tests Passed`);
  console.log(`================================================================\n`);

  if (passed !== total) {
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('Fatal Test Error:', err);
  process.exit(1);
});
