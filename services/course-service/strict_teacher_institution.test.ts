/**
 * OX-DIGITAL Education — Phase II-D-B
 * Remediation A: Strict Teacher Institution Validation Test Suite
 *
 * Strictly Isolated In-Memory Suite (Zero database connection, zero port 5432/5433 access)
 */

import assert from 'assert';

// In-Memory Data Stores
const users = new Map<string, any>();
const courses = new Map<string, any>();
const branches = new Map<string, any>();

function clearStore() {
  users.clear();
  courses.clear();
  branches.clear();
}

// Mock Prisma Client
const mockDb: any = {
  user: {
    findUnique: async ({ where }: any) => {
      const u = users.get(where.id);
      return u ? { ...u } : null;
    },
    findFirst: async ({ where }: any) => {
      for (const u of users.values()) {
        if (where.id && u.id !== where.id) continue;
        if (where.deletedAt === null && u.deletedAt) continue;
        return { ...u };
      }
      return null;
    }
  },
  course: {
    findUnique: async ({ where }: any) => {
      const c = courses.get(where.id);
      return c ? { ...c } : null;
    },
    create: async ({ data }: any) => {
      const id = data.id || 'course-' + Math.random().toString(36).substring(2, 9);
      const record = { id, createdAt: new Date(), ...data };
      courses.set(id, record);
      return record;
    },
    update: async ({ where, data }: any) => {
      const c = courses.get(where.id);
      if (!c) throw new Error('Course not found');
      const updated = { ...c, ...data };
      courses.set(where.id, updated);
      return updated;
    }
  },
  branch: {
    findFirst: async ({ where }: any) => {
      const b = branches.get(where.id);
      if (!b) return null;
      if (where.institutionId && b.institutionId !== where.institutionId) return null;
      if (where.deletedAt === null && b.deletedAt) return null;
      return { ...b };
    }
  }
};

(globalThis as any).prismaGlobal = mockDb;

import { createCourse, updateCourse } from './src/controllers/course.controller.js';

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

async function runStrictTeacherInstitutionTests() {
  console.log('================================================================');
  console.log('  OX-DIGITAL Phase II-D-B: Strict Teacher Institution Tests');
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

  const INST_A = 'inst-alpha-001';
  const INST_B = 'inst-beta-002';

  const MGR_A_ID = '11111111-1111-4111-a111-111111111111';
  const MGR_NO_INST_ID = '22222222-2222-4222-a222-222222222222';
  const TEACHER_INST_A_ID = '33333333-3333-4333-a333-333333333333';
  const TEACHER_INST_B_ID = '44444444-4444-4444-a444-444444444444';
  const TEACHER_NULL_INST_ID = '55555555-5555-4555-a555-555555555555';
  const TEACHER_OTHER_ID = '66666666-6666-4666-a666-666666666666';
  const COURSE_ID = '77777777-7777-4777-a777-777777777777';

  // Seed Users
  users.set(MGR_A_ID, { id: MGR_A_ID, role: 'PRIMARY_MANAGER', institutionId: INST_A, isPrimaryManager: true });
  users.set(MGR_NO_INST_ID, { id: MGR_NO_INST_ID, role: 'PRIMARY_MANAGER', institutionId: null, isPrimaryManager: true });
  users.set(TEACHER_INST_A_ID, { id: TEACHER_INST_A_ID, role: 'TEACHER', institutionId: INST_A });
  users.set(TEACHER_INST_B_ID, { id: TEACHER_INST_B_ID, role: 'TEACHER', institutionId: INST_B });
  users.set(TEACHER_NULL_INST_ID, { id: TEACHER_NULL_INST_ID, role: 'TEACHER', institutionId: null });
  users.set(TEACHER_OTHER_ID, { id: TEACHER_OTHER_ID, role: 'TEACHER', institutionId: INST_A });

  // ── Scenario 1: Manager creates course assigning same-institution teacher (201 Created) ──
  {
    const req: any = {
      user: { userId: MGR_A_ID, role: 'PRIMARY_MANAGER', institutionId: INST_A, isPrimaryManager: true },
      tenantContext: { institutionId: INST_A, userId: MGR_A_ID, role: 'PRIMARY_MANAGER' },
      body: {
        title: 'Math 101',
        teacherId: TEACHER_INST_A_ID,
        price: 100,
        category: 'Mathematics',
        status: 'PUBLISHED'
      }
    };
    const res = createMockResponse();
    await createCourse(req, res);
    record('Manager creates course assigning same-institution teacher -> 201 Created', res.getStatusCode() === 201, JSON.stringify(res.getJsonBody()));
  }

  // ── Scenario 2: Manager creates course assigning foreign-institution teacher (403 Forbidden) ──
  {
    const req: any = {
      user: { userId: MGR_A_ID, role: 'PRIMARY_MANAGER', institutionId: INST_A, isPrimaryManager: true },
      tenantContext: { institutionId: INST_A, userId: MGR_A_ID, role: 'PRIMARY_MANAGER' },
      body: {
        title: 'Math 102',
        teacherId: TEACHER_INST_B_ID,
        price: 100,
        category: 'Mathematics',
        status: 'PUBLISHED'
      }
    };
    const res = createMockResponse();
    await createCourse(req, res);
    record('Manager creates course assigning foreign-institution teacher -> 403 Forbidden', res.getStatusCode() === 403, JSON.stringify(res.getJsonBody()));
  }

  // ── Scenario 3: Manager creates course assigning teacher with institutionId = null (403 Forbidden) ──
  {
    const req: any = {
      user: { userId: MGR_A_ID, role: 'PRIMARY_MANAGER', institutionId: INST_A, isPrimaryManager: true },
      tenantContext: { institutionId: INST_A, userId: MGR_A_ID, role: 'PRIMARY_MANAGER' },
      body: {
        title: 'Math 103',
        teacherId: TEACHER_NULL_INST_ID,
        price: 100,
        category: 'Mathematics',
        status: 'PUBLISHED'
      }
    };
    const res = createMockResponse();
    await createCourse(req, res);
    record('Manager creates course assigning teacher with institutionId = null -> 403 Forbidden', res.getStatusCode() === 403, JSON.stringify(res.getJsonBody()));
  }

  // ── Scenario 4: Manager with missing authoritative institution creates course -> 403 Forbidden ──
  {
    const req: any = {
      user: { userId: MGR_NO_INST_ID, role: 'PRIMARY_MANAGER', institutionId: null, isPrimaryManager: true },
      tenantContext: { institutionId: null, userId: MGR_NO_INST_ID, role: 'PRIMARY_MANAGER' },
      body: {
        title: 'Math 104',
        teacherId: TEACHER_INST_A_ID,
        price: 100,
        category: 'Mathematics',
        status: 'PUBLISHED'
      }
    };
    const res = createMockResponse();
    await createCourse(req, res);
    record('Manager with missing authoritative institution creates course -> 403 Forbidden', res.getStatusCode() === 403, JSON.stringify(res.getJsonBody()));
  }

  // Seed course for update tests
  courses.set(COURSE_ID, {
    id: COURSE_ID,
    title: 'Existing Course',
    teacherId: TEACHER_INST_A_ID,
    institutionId: INST_A,
    status: 'DRAFT'
  });

  // ── Scenario 5: Manager updates course assigning foreign-institution teacher -> 403 Forbidden ──
  {
    const req: any = {
      user: { userId: MGR_A_ID, role: 'PRIMARY_MANAGER', institutionId: INST_A, isPrimaryManager: true },
      tenantContext: { institutionId: INST_A, userId: MGR_A_ID, role: 'PRIMARY_MANAGER' },
      params: { id: COURSE_ID },
      body: { teacherId: TEACHER_INST_B_ID }
    };
    const res = createMockResponse();
    await updateCourse(req, res);
    record('Manager updates course assigning foreign-institution teacher -> 403 Forbidden', res.getStatusCode() === 403, JSON.stringify(res.getJsonBody()));
  }

  // ── Scenario 6: Manager updates course assigning teacher with institutionId = null -> 403 Forbidden ──
  {
    const req: any = {
      user: { userId: MGR_A_ID, role: 'PRIMARY_MANAGER', institutionId: INST_A, isPrimaryManager: true },
      tenantContext: { institutionId: INST_A, userId: MGR_A_ID, role: 'PRIMARY_MANAGER' },
      params: { id: COURSE_ID },
      body: { teacherId: TEACHER_NULL_INST_ID }
    };
    const res = createMockResponse();
    await updateCourse(req, res);
    record('Manager updates course assigning teacher with institutionId = null -> 403 Forbidden', res.getStatusCode() === 403, JSON.stringify(res.getJsonBody()));
  }

  // ── Scenario 7: Manager with missing authoritative institution updates course -> 403 Forbidden ──
  {
    const req: any = {
      user: { userId: MGR_NO_INST_ID, role: 'PRIMARY_MANAGER', institutionId: null, isPrimaryManager: true },
      tenantContext: { institutionId: null, userId: MGR_NO_INST_ID, role: 'PRIMARY_MANAGER' },
      params: { id: COURSE_ID },
      body: { teacherId: TEACHER_INST_A_ID }
    };
    const res = createMockResponse();
    await updateCourse(req, res);
    record('Manager with missing authoritative institution updates course -> 403 Forbidden', res.getStatusCode() === 403, JSON.stringify(res.getJsonBody()));
  }

  // ── Scenario 8: Unauthorized non-owner teacher cannot silently update or transfer course ownership ──
  {
    const req: any = {
      user: { userId: TEACHER_OTHER_ID, role: 'TEACHER', institutionId: INST_A },
      tenantContext: { institutionId: INST_A, userId: TEACHER_OTHER_ID, role: 'TEACHER' },
      params: { id: COURSE_ID },
      body: { title: 'Hijacked Course Title', teacherId: TEACHER_OTHER_ID }
    };
    const res = createMockResponse();
    await updateCourse(req, res);
    record('Unauthorized non-owner teacher cannot update or transfer course ownership -> 403 Forbidden', res.getStatusCode() === 403, JSON.stringify(res.getJsonBody()));
  }

  console.log('\n================================================================');
  console.log(`  Strict Teacher Institution Suite: ${passed}/${total} Scenarios Passed`);
  console.log('================================================================\n');

  if (passed !== total) {
    process.exit(1);
  }
}

runStrictTeacherInstitutionTests().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
