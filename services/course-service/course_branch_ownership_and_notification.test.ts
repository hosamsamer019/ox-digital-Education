/**
 * OX-DIGITAL Education — Course Branch Ownership & Homework Notification Defense-in-Depth Regression Suite
 *
 * Covers all 18 mandated acceptance tests:
 * Phase B: Course Creation Tests
 * 1. Valid branch belonging to the authoritative institution -> course creation proceeds.
 * 2. Branch belonging to another institution -> rejected with 400; no course created.
 * 3. Nonexistent branch -> rejected with 400; no course created.
 * 4. No branch where institution-level courses are allowed -> existing behavior preserved (branchId null).
 * 5. Teacher attempting to override their authorized branch -> request branch ignored; teacher's branch preserved.
 *
 * Phase C: Course Update Tests
 * 6. Valid branch in the same institution -> update proceeds.
 * 7. Cross-institution branch -> rejected with 400; no update occurs.
 * 8. Nonexistent branch -> rejected with 400; no update occurs.
 * 9. Branch omitted from update -> existing course branch preserved.
 * 10. Explicit null branch -> existing supported removal behavior preserved (branchId set to null).
 * 11. Client-supplied institution ID cannot bypass the authoritative tenant scope.
 *
 * Phase D: Homework Notification Tests
 * 12. Matching loaded branch relation -> teacher, institution, and branch notifications emitted to correct rooms.
 * 13. Mismatched branch institution -> teacher & institution preserved; branch notification withheld.
 * 14. Missing branch relation -> teacher & institution preserved; branch notification withheld.
 * 15. Null branch -> teacher & institution notifications; no branch notification.
 * 16. Missing institution -> teacher-only notification for legacy course; no institution or branch rooms.
 * 17. Missing teacher and institution -> zero emissions and safe warning logged.
 * 18. No scenario emits to 'admin', 'super_admin', wildcard, or another unscoped room.
 */

process.env.DATABASE_URL = 'postgresql://ox_digital_dev:ox_digital_dev@127.0.0.1:5433/ox_digital_dev_test?schema=public';
process.env.JWT_SECRET = 'test-jwt-secret-ox-digital-test-key-32chars';

// Valid RFC 4122 UUID constants for all entities
const INST_1_ID = '11111111-1111-4111-8111-000000000001';
const INST_2_ID = '22222222-2222-4222-8222-000000000002';

const BRANCH_INST1_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const BRANCH_INST1_B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const BRANCH_INST2_FOREIGN = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const BRANCH_DELETED = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const NONEXISTENT_BRANCH = '99999999-9999-4999-8999-999999999999';

const TEACHER_INST1_ID = '11111111-0000-4000-8000-000000000001';
const TEACHER_INST1_BRANCH_A = '11111111-0000-4000-8000-000000000002';
const MANAGER_INST1_ID = '33333333-0000-4000-8000-000000000003';
const MANAGER_INST2_ID = '66666666-0000-4000-8000-000000000006';

const BASE_COURSE_ID = '55555555-5555-4555-8555-555555555555';

const branches = new Map<string, any>([
  [BRANCH_INST1_A, { id: BRANCH_INST1_A, institutionId: INST_1_ID, name: 'Branch Inst1 A', deletedAt: null }],
  [BRANCH_INST1_B, { id: BRANCH_INST1_B, institutionId: INST_1_ID, name: 'Branch Inst1 B', deletedAt: null }],
  [BRANCH_INST2_FOREIGN, { id: BRANCH_INST2_FOREIGN, institutionId: INST_2_ID, name: 'Foreign Branch Inst2', deletedAt: null }],
  [BRANCH_DELETED, { id: BRANCH_DELETED, institutionId: INST_1_ID, name: 'Deleted Branch', deletedAt: new Date() }]
]);

const users = new Map<string, any>([
  [TEACHER_INST1_ID, {
    id: TEACHER_INST1_ID,
    role: 'TEACHER',
    institutionId: INST_1_ID,
    branchId: null
  }],
  [TEACHER_INST1_BRANCH_A, {
    id: TEACHER_INST1_BRANCH_A,
    role: 'TEACHER',
    institutionId: INST_1_ID,
    branchId: BRANCH_INST1_A
  }],
  [MANAGER_INST1_ID, {
    id: MANAGER_INST1_ID,
    role: 'ADMIN',
    institutionId: INST_1_ID,
    branchId: null
  }],
  [MANAGER_INST2_ID, {
    id: MANAGER_INST2_ID,
    role: 'PRIMARY_MANAGER',
    institutionId: INST_2_ID,
    branchId: null
  }]
]);

const courses = new Map<string, any>();

// Tracking database operation calls to prove no mutation occurs on reject
let createCourseCalledCount = 0;
let updateCourseCalledCount = 0;

// Set up mockDb in globalThis BEFORE importing database or controllers
const mockDb: any = {
  branch: {
    findFirst: async ({ where }: any) => {
      for (const b of branches.values()) {
        if (where.id && b.id !== where.id) continue;
        if (where.institutionId && b.institutionId !== where.institutionId) continue;
        if (where.deletedAt === null && b.deletedAt !== null) continue;
        return b;
      }
      return null;
    }
  },
  user: {
    findUnique: async ({ where }: any) => {
      return users.get(where.id) || null;
    }
  },
  course: {
    create: async ({ data }: any) => {
      createCourseCalledCount++;
      const newId = `11111111-2222-4333-8444-${String(createCourseCalledCount).padStart(12, '0')}`;
      const course = { id: newId, createdAt: new Date(), updatedAt: new Date(), ...data };
      courses.set(newId, course);
      return course;
    },
    update: async ({ where, data }: any) => {
      updateCourseCalledCount++;
      const existing = courses.get(where.id);
      if (!existing) throw new Error('Not found');
      const updated = { ...existing, ...data, updatedAt: new Date() };
      courses.set(where.id, updated);
      return updated;
    },
    findUnique: async ({ where }: any) => {
      return courses.get(where.id) || null;
    }
  }
};

(globalThis as any).prismaGlobal = mockDb;

import assert from 'assert';
import {
  createCourse,
  updateCourse
} from './src/controllers/course.controller.js';
import { emitHomeworkSubmissionNotification } from './src/controllers/homework.controller.js';

console.log('================================================================================');
console.log('OX-DIGITAL — Course Branch Ownership & Homework Notification Regression Suite');
console.log('================================================================================\n');

// Mock Socket.IO server tracking emissions
class TestSocketIOServer {
  emissions: Array<{ targetRooms: string[]; event: string; payload: any }> = [];

  to(...rooms: string[]) {
    const targetRooms = [...rooms];
    const self = this;
    return {
      to(...moreRooms: string[]) {
        targetRooms.push(...moreRooms);
        return this;
      },
      emit(event: string, payload: any) {
        self.emissions.push({ targetRooms, event, payload });
      }
    };
  }
}

// Helpers to simulate Express requests
function createMockRes(): { status: (code: number) => any; json: (data: any) => any; statusCode: number; body: any } {
  const res: any = {
    statusCode: 200,
    body: null,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(data: any) {
      this.body = data;
      return this;
    }
  };
  return res;
}

let passedCount = 0;
let failedCount = 0;

function runTest(name: string, fn: () => Promise<void> | void) {
  return Promise.resolve()
    .then(() => fn())
    .then(() => {
      console.log(`✓ PASS: ${name}`);
      passedCount++;
    })
    .catch((err) => {
      console.error(`✗ FAIL: ${name}`);
      console.error(`  Error: ${err.message}\n`);
      failedCount++;
    });
}

async function main() {
  console.log('--- Phase B: Course Creation Tests (1-5) ---');

  // Test 1: Valid branch belonging to authoritative institution -> creation proceeds
  await runTest('1. Valid branch belonging to authoritative institution -> course created', async () => {
    const prevCalls = createCourseCalledCount;
    const req: any = {
      user: { userId: MANAGER_INST1_ID, role: 'ADMIN', institutionId: INST_1_ID },
      tenantContext: { institutionId: INST_1_ID, isPlatformSuperAdmin: false },
      body: {
        title: 'Math Grade 10 - Branch A',
        teacherId: TEACHER_INST1_ID,
        branchId: BRANCH_INST1_A
      }
    };
    const res = createMockRes();
    await createCourse(req, res);

    if (res.statusCode !== 201) {
      console.error('Test 1 failed with body:', res.body);
    }
    assert.strictEqual(res.statusCode, 201);
    assert.strictEqual(res.body.branchId, BRANCH_INST1_A);
    assert.strictEqual(res.body.institutionId, INST_1_ID);
    assert.strictEqual(createCourseCalledCount, prevCalls + 1, 'db.course.create must be called');
  });

  // Test 2: Branch belonging to another institution -> rejected with 400; no course created
  await runTest('2. Branch belonging to another institution -> rejected; no course created', async () => {
    const prevCalls = createCourseCalledCount;
    const req: any = {
      user: { userId: MANAGER_INST1_ID, role: 'ADMIN', institutionId: INST_1_ID },
      tenantContext: { institutionId: INST_1_ID, isPlatformSuperAdmin: false },
      body: {
        title: 'Hacked Math Course',
        teacherId: TEACHER_INST1_ID,
        branchId: BRANCH_INST2_FOREIGN // Belongs to INST_2
      }
    };
    const res = createMockRes();
    await createCourse(req, res);

    assert.strictEqual(res.statusCode, 400);
    assert.strictEqual(res.body.message, 'الفرع المحدد غير تابع لهذه المؤسسة أو غير متاح');
    assert.strictEqual(createCourseCalledCount, prevCalls, 'SECURITY: db.course.create must NOT be called');
  });

  // Test 3: Nonexistent branch -> rejected with 400; no course created
  await runTest('3. Nonexistent branch -> rejected with 400; no course created', async () => {
    const prevCalls = createCourseCalledCount;
    const req: any = {
      user: { userId: MANAGER_INST1_ID, role: 'ADMIN', institutionId: INST_1_ID },
      tenantContext: { institutionId: INST_1_ID, isPlatformSuperAdmin: false },
      body: {
        title: 'Phantom Branch Course',
        teacherId: TEACHER_INST1_ID,
        branchId: NONEXISTENT_BRANCH
      }
    };
    const res = createMockRes();
    await createCourse(req, res);

    assert.strictEqual(res.statusCode, 400);
    assert.strictEqual(res.body.message, 'الفرع المحدد غير تابع لهذه المؤسسة أو غير متاح');
    assert.strictEqual(createCourseCalledCount, prevCalls, 'SECURITY: db.course.create must NOT be called');
  });

  // Test 4: No branch where institution-level courses are allowed -> course created with branchId null
  await runTest('4. No branch specified for institution course -> course created with branchId null', async () => {
    const prevCalls = createCourseCalledCount;
    const req: any = {
      user: { userId: MANAGER_INST1_ID, role: 'ADMIN', institutionId: INST_1_ID },
      tenantContext: { institutionId: INST_1_ID, isPlatformSuperAdmin: false },
      body: {
        title: 'Institution-Wide Math Course',
        teacherId: TEACHER_INST1_ID
        // branchId omitted
      }
    };
    const res = createMockRes();
    await createCourse(req, res);

    if (res.statusCode !== 201) {
      console.error('Test 4 failed with body:', res.body);
    }
    assert.strictEqual(res.statusCode, 201);
    assert.strictEqual(res.body.branchId, null);
    assert.strictEqual(res.body.institutionId, INST_1_ID);
    assert.strictEqual(createCourseCalledCount, prevCalls + 1);
  });

  // Test 5: Teacher attempting to override their authorized branch -> client branch ignored; teacher branch preserved
  await runTest('5. Teacher attempting to override branch -> server-authorized branch preserved', async () => {
    const prevCalls = createCourseCalledCount;
    const req: any = {
      user: { userId: TEACHER_INST1_BRANCH_A, role: 'TEACHER', institutionId: INST_1_ID },
      tenantContext: { institutionId: INST_1_ID, branchId: BRANCH_INST1_A, isPlatformSuperAdmin: false },
      body: {
        title: 'Teacher Course with Overridden Branch',
        branchId: BRANCH_INST1_B // Teacher attempts to pick Branch B
      }
    };
    const res = createMockRes();
    await createCourse(req, res);

    if (res.statusCode !== 201) {
      console.error('Test 5 failed with body:', res.body);
    }
    assert.strictEqual(res.statusCode, 201);
    assert.strictEqual(res.body.branchId, BRANCH_INST1_A, 'Must strictly preserve teacher assigned branch A');
    assert.strictEqual(createCourseCalledCount, prevCalls + 1);
  });

  console.log('\n--- Phase C: Course Update Tests (6-11) ---');

  // Create baseline course for update tests
  courses.set(BASE_COURSE_ID, {
    id: BASE_COURSE_ID,
    title: 'Baseline Course',
    teacherId: TEACHER_INST1_ID,
    institutionId: INST_1_ID,
    branchId: BRANCH_INST1_A
  });

  // Test 6: Valid branch in same institution -> update proceeds
  await runTest('6. Valid branch in the same institution -> update proceeds', async () => {
    const prevCalls = updateCourseCalledCount;
    const req: any = {
      params: { id: BASE_COURSE_ID },
      user: { userId: MANAGER_INST1_ID, role: 'ADMIN', institutionId: INST_1_ID },
      tenantContext: { institutionId: INST_1_ID, isPlatformSuperAdmin: false },
      body: { branchId: BRANCH_INST1_B }
    };
    const res = createMockRes();
    await updateCourse(req, res);

    if (res.statusCode !== 200) {
      console.error('Test 6 failed with body:', res.body);
    }
    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.body.branchId, BRANCH_INST1_B);
    assert.strictEqual(updateCourseCalledCount, prevCalls + 1);
  });

  // Test 7: Cross-institution branch -> rejected with 400; no update occurs
  await runTest('7. Cross-institution branch on update -> rejected; no update occurs', async () => {
    const prevCalls = updateCourseCalledCount;
    const req: any = {
      params: { id: BASE_COURSE_ID },
      user: { userId: MANAGER_INST1_ID, role: 'ADMIN', institutionId: INST_1_ID },
      tenantContext: { institutionId: INST_1_ID, isPlatformSuperAdmin: false },
      body: { branchId: BRANCH_INST2_FOREIGN }
    };
    const res = createMockRes();
    await updateCourse(req, res);

    assert.strictEqual(res.statusCode, 400);
    assert.strictEqual(res.body.message, 'الفرع المحدد غير تابع لهذه المؤسسة أو غير متاح');
    assert.strictEqual(updateCourseCalledCount, prevCalls, 'SECURITY: db.course.update must NOT be called');
  });

  // Test 8: Nonexistent branch -> rejected with 400; no update occurs
  await runTest('8. Nonexistent branch on update -> rejected; no update occurs', async () => {
    const prevCalls = updateCourseCalledCount;
    const req: any = {
      params: { id: BASE_COURSE_ID },
      user: { userId: MANAGER_INST1_ID, role: 'ADMIN', institutionId: INST_1_ID },
      tenantContext: { institutionId: INST_1_ID, isPlatformSuperAdmin: false },
      body: { branchId: NONEXISTENT_BRANCH }
    };
    const res = createMockRes();
    await updateCourse(req, res);

    assert.strictEqual(res.statusCode, 400);
    assert.strictEqual(res.body.message, 'الفرع المحدد غير تابع لهذه المؤسسة أو غير متاح');
    assert.strictEqual(updateCourseCalledCount, prevCalls, 'SECURITY: db.course.update must NOT be called');
  });

  // Test 9: Branch omitted from update -> existing branch preserved
  await runTest('9. Branch omitted from update -> existing branch preserved', async () => {
    const prevCalls = updateCourseCalledCount;
    const req: any = {
      params: { id: BASE_COURSE_ID },
      user: { userId: MANAGER_INST1_ID, role: 'ADMIN', institutionId: INST_1_ID },
      tenantContext: { institutionId: INST_1_ID, isPlatformSuperAdmin: false },
      body: { title: 'Renamed Course' } // branchId omitted
    };
    const res = createMockRes();
    await updateCourse(req, res);

    if (res.statusCode !== 200) {
      console.error('Test 9 failed with body:', res.body);
    }
    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.body.title, 'Renamed Course');
    assert.strictEqual(res.body.branchId, BRANCH_INST1_B, 'Existing branch must be preserved');
    assert.strictEqual(updateCourseCalledCount, prevCalls + 1);
  });

  // Test 10: Explicit null branch -> existing supported removal behavior preserved
  await runTest('10. Explicit null branch -> branchId set to null (institution-wide)', async () => {
    const prevCalls = updateCourseCalledCount;
    const req: any = {
      params: { id: BASE_COURSE_ID },
      user: { userId: MANAGER_INST1_ID, role: 'ADMIN', institutionId: INST_1_ID },
      tenantContext: { institutionId: INST_1_ID, isPlatformSuperAdmin: false },
      body: { branchId: null } // Explicit removal
    };
    const res = createMockRes();
    await updateCourse(req, res);

    if (res.statusCode !== 200) {
      console.error('Test 10 failed with body:', res.body);
    }
    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.body.branchId, null, 'Branch must be set to null');
    assert.strictEqual(updateCourseCalledCount, prevCalls + 1);
  });

  // Test 11: Client-supplied institution ID cannot bypass authoritative tenant scope
  await runTest('11. Client-supplied institutionId on update cannot bypass tenant scope', async () => {
    const prevCalls = updateCourseCalledCount;
    const req: any = {
      params: { id: BASE_COURSE_ID },
      user: { userId: MANAGER_INST1_ID, role: 'ADMIN', institutionId: INST_1_ID },
      tenantContext: { institutionId: INST_1_ID, isPlatformSuperAdmin: false },
      body: {
        institutionId: INST_2_ID, // Attempted institution hijacking
        branchId: BRANCH_INST2_FOREIGN
      }
    };
    const res = createMockRes();
    await updateCourse(req, res);

    assert.strictEqual(res.statusCode, 400);
    assert.strictEqual(res.body.message, 'الفرع المحدد غير تابع لهذه المؤسسة أو غير متاح');
    assert.strictEqual(updateCourseCalledCount, prevCalls);
  });

  console.log('\n--- Phase D: Homework Notification Defense-in-Depth Tests (12-18) ---');

  const io = new TestSocketIOServer();
  const subPayload = { id: 'sub-test-100', studentId: 'stu-1', grade: 90 };

  // Test 12: Matching loaded branch relation -> teacher, institution, and branch notifications emitted
  await runTest('12. Matching loaded branch relation -> teacher, institution, and branch emitted', () => {
    io.emissions = [];
    const course = {
      id: 'c-valid-12',
      teacherId: 'teacher-1',
      institutionId: 'inst-1',
      branchId: 'branch-1',
      branch: { institutionId: 'inst-1' } // MATCH
    };

    const res = emitHomeworkSubmissionNotification(io, course, subPayload, 'c-valid-12');
    assert.strictEqual(res.delivered, true);
    assert.deepStrictEqual(res.targetedRooms, [
      'teacher:teacher-1',
      'institution:inst-1:admin',
      'branch:branch-1:admin'
    ]);
    assert.strictEqual(io.emissions.length, 3);
  });

  // Test 13: Mismatched branch institution -> teacher & institution preserved; branch notification withheld
  await runTest('13. Mismatched branch institution -> teacher & institution preserved; branch withheld', () => {
    io.emissions = [];
    const course = {
      id: 'c-mismatch-13',
      teacherId: 'teacher-1',
      institutionId: 'inst-1',
      branchId: 'branch-foreign-2',
      branch: { institutionId: 'inst-2' } // MISMATCH!
    };

    const res = emitHomeworkSubmissionNotification(io, course, subPayload, 'c-mismatch-13');
    assert.strictEqual(res.delivered, true);
    assert.deepStrictEqual(res.targetedRooms, [
      'teacher:teacher-1',
      'institution:inst-1:admin'
    ]);
    assert.strictEqual(res.targetedRooms.includes('branch:branch-foreign-2:admin'), false, 'SECURITY: Foreign branch MUST NOT be targeted');
    assert.strictEqual(io.emissions.length, 2);
  });

  // Test 14: Missing branch relation -> branch notification withheld
  await runTest('14. Missing branch relation (not loaded) -> branch notification withheld', () => {
    io.emissions = [];
    const course = {
      id: 'c-missing-branch-14',
      teacherId: 'teacher-1',
      institutionId: 'inst-1',
      branchId: 'branch-1',
      branch: null // Relation null/missing
    };

    const res = emitHomeworkSubmissionNotification(io, course, subPayload, 'c-missing-branch-14');
    assert.strictEqual(res.delivered, true);
    assert.deepStrictEqual(res.targetedRooms, [
      'teacher:teacher-1',
      'institution:inst-1:admin'
    ]);
    assert.strictEqual(res.targetedRooms.includes('branch:branch-1:admin'), false, 'Unverified branch relation must be withheld');
    assert.strictEqual(io.emissions.length, 2);
  });

  // Test 15: Null branch -> teacher & institution notifications; no branch notification
  await runTest('15. Null branch -> teacher & institution notifications; no branch notification', () => {
    io.emissions = [];
    const course = {
      id: 'c-null-branch-15',
      teacherId: 'teacher-1',
      institutionId: 'inst-1',
      branchId: null,
      branch: null
    };

    const res = emitHomeworkSubmissionNotification(io, course, subPayload, 'c-null-branch-15');
    assert.strictEqual(res.delivered, true);
    assert.deepStrictEqual(res.targetedRooms, [
      'teacher:teacher-1',
      'institution:inst-1:admin'
    ]);
    assert.strictEqual(io.emissions.length, 2);
  });

  // Test 16: Missing institution -> teacher-only notification for legacy course
  await runTest('16. Missing institution (legacy course) -> teacher-only notification', () => {
    io.emissions = [];
    const course = {
      id: 'c-legacy-16',
      teacherId: 'teacher-legacy',
      institutionId: null,
      branchId: null,
      branch: null
    };

    const res = emitHomeworkSubmissionNotification(io, course, subPayload, 'c-legacy-16');
    assert.strictEqual(res.delivered, true);
    assert.deepStrictEqual(res.targetedRooms, ['teacher:teacher-legacy']);
    assert.strictEqual(io.emissions.length, 1);
  });

  // Test 17: Missing teacher and institution -> zero emissions and safe warning
  await runTest('17. Missing teacher and institution -> zero emissions and safe warning', () => {
    io.emissions = [];
    const course = {
      id: 'c-orphan-17',
      teacherId: null,
      institutionId: null,
      branchId: null,
      branch: null
    };

    const res = emitHomeworkSubmissionNotification(io, course, subPayload, 'c-orphan-17');
    assert.strictEqual(res.delivered, false);
    assert.deepStrictEqual(res.targetedRooms, []);
    assert.strictEqual(io.emissions.length, 0);
  });

  // Test 18: No scenario emits to 'admin', 'super_admin', wildcard, or another unscoped room
  await runTest('18. No scenario emits to admin, super_admin, wildcard, or unscoped rooms', () => {
    const testCourses = [
      { id: 't1', teacherId: 't1', institutionId: 'i1', branchId: 'b1', branch: { institutionId: 'i1' } },
      { id: 't2', teacherId: 't2', institutionId: 'i1', branchId: 'b2', branch: { institutionId: 'wrong-i' } },
      { id: 't3', teacherId: 't3', institutionId: 'i1', branchId: 'b3', branch: null },
      { id: 't4', teacherId: 't4', institutionId: null, branchId: null, branch: null },
      { id: 't5', teacherId: null, institutionId: null, branchId: null, branch: null }
    ];

    for (const c of testCourses) {
      io.emissions = [];
      emitHomeworkSubmissionNotification(io, c, subPayload, c.id);
      for (const emission of io.emissions) {
        for (const room of emission.targetRooms) {
          assert.notStrictEqual(room, 'admin', 'SECURITY LEAK: Emitted to admin room!');
          assert.notStrictEqual(room, 'super_admin', 'SECURITY LEAK: Emitted to super_admin room!');
          assert.notStrictEqual(room, '*', 'SECURITY LEAK: Emitted to wildcard room!');
          assert.ok(!room.includes('undefined') && !room.includes('null'), `Malformed room name: ${room}`);
        }
      }
    }
  });

  console.log('\n================================================================================');
  console.log(`TEST RESULTS: ${passedCount} PASSED, ${failedCount} FAILED (TOTAL: ${passedCount + failedCount})`);
  console.log('================================================================================');

  if (failedCount > 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
