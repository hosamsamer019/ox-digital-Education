/**
 * OX-DIGITAL Education — Verification Suite for Removal of Unsafe Global course_created Broadcast
 *
 * Verifies all mandated Phase D requirements:
 * Backend:
 * 1. Course creation succeeds and returns HTTP 201.
 * 2. Course record is persisted through the existing create path.
 * 3. The 'course_created' global event is NOT emitted.
 * 4. No replacement global or wildcard event is emitted.
 * 5. Existing course authorization and branch ownership validation remain intact.
 *
 * Frontend (Center & Online Catalogs):
 * 6. Center Catalog: No 'course_created' listener registered.
 * 7. Center Catalog: 'course_updated' listener remains registered.
 * 8. Center Catalog: 'course_deleted' listener remains registered.
 * 9. Center Catalog: Existing polling and tab-visibility refresh behavior remains intact.
 * 10. Online Catalog: No 'course_created' listener registered.
 * 11. Online Catalog: 'course_updated' listener remains registered.
 * 12. Online Catalog: 'course_deleted' listener remains registered.
 * 13. Online Catalog: Existing polling and tab-visibility refresh behavior remains intact.
 */

process.env.DATABASE_URL = 'postgresql://ox_digital_dev:ox_digital_dev@127.0.0.1:5433/ox_digital_dev_test?schema=public';
process.env.JWT_SECRET = 'test-jwt-secret-ox-digital-test-key-32chars';

import assert from 'assert';
import fs from 'fs';
import path from 'path';

// Valid UUID constants
const INST_1_ID = '11111111-1111-4111-8111-000000000001';
const BRANCH_INST1_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const TEACHER_INST1_ID = '11111111-0000-4000-8000-000000000001';
const MANAGER_INST1_ID = '33333333-0000-4000-8000-000000000003';

const branches = new Map<string, any>([
  [BRANCH_INST1_A, { id: BRANCH_INST1_A, institutionId: INST_1_ID, name: 'Branch A', deletedAt: null }]
]);

const users = new Map<string, any>([
  [TEACHER_INST1_ID, { id: TEACHER_INST1_ID, role: 'TEACHER', institutionId: INST_1_ID, branchId: null }],
  [MANAGER_INST1_ID, { id: MANAGER_INST1_ID, role: 'ADMIN', institutionId: INST_1_ID, branchId: null }]
]);

const courses = new Map<string, any>();
let createCalls = 0;

// Setup mockDb on globalThis before module load
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
    findUnique: async ({ where }: any) => users.get(where.id) || null
  },
  course: {
    create: async ({ data }: any) => {
      createCalls++;
      const id = `course-${createCalls}`;
      const record = { id, createdAt: new Date(), updatedAt: new Date(), ...data };
      courses.set(id, record);
      return record;
    },
    findUnique: async ({ where }: any) => courses.get(where.id) || null
  }
};

(globalThis as any).prismaGlobal = mockDb;

// Mock Socket.IO server tracking emissions
class TrackingSocketIOServer {
  emissions: Array<{ targetRooms: string[]; event: string; payload: any }> = [];

  emit(event: string, payload: any) {
    this.emissions.push({ targetRooms: ['*global*'], event, payload });
  }

  to(...rooms: string[]) {
    const targetRooms = [...rooms];
    const self = this;
    return {
      to(...more: string[]) {
        targetRooms.push(...more);
        return this;
      },
      emit(event: string, payload: any) {
        self.emissions.push({ targetRooms, event, payload });
      }
    };
  }
}

import { setIO } from './src/socket.js';
import { createCourse } from './src/controllers/course.controller.js';

const mockServer = new TrackingSocketIOServer();
setIO(mockServer as any);

function createMockRes() {
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

let passed = 0;
let failed = 0;

async function runTest(name: string, fn: () => Promise<void> | void) {
  try {
    await fn();
    console.log(`✓ PASS: ${name}`);
    passed++;
  } catch (err: any) {
    console.error(`✗ FAIL: ${name} -> ${err.message}`);
    failed++;
  }
}

async function main() {
  console.log('================================================================================');
  console.log('OX-DIGITAL — Global course_created Broadcast Removal Verification Suite');
  console.log('================================================================================\n');

  console.log('--- Backend Assertions (1-5) ---');

  // Test 1 & 2 & 3 & 4: Course creation succeeds, record persisted, course_created NOT emitted, NO replacement global/wildcard event
  await runTest('1-4. Course creation succeeds (HTTP 201), persists record, emits ZERO global events', async () => {
    mockServer.emissions = [];
    const prevCalls = createCalls;

    const req: any = {
      user: { userId: MANAGER_INST1_ID, role: 'ADMIN', institutionId: INST_1_ID },
      tenantContext: { institutionId: INST_1_ID, isPlatformSuperAdmin: false },
      body: {
        title: 'New Isolated Course 2026',
        teacherId: TEACHER_INST1_ID,
        branchId: BRANCH_INST1_A,
        status: 'DRAFT'
      }
    };
    const res = createMockRes();
    await createCourse(req, res);

    // 1. Success status
    assert.strictEqual(res.statusCode, 201, 'Must return HTTP 201 Created');
    assert.strictEqual(res.body.title, 'New Isolated Course 2026');

    // 2. Persistence verified
    assert.strictEqual(createCalls, prevCalls + 1, 'Database create must be called');
    const persisted = courses.get(res.body.id);
    assert.ok(persisted, 'Course must be persisted in database');
    assert.strictEqual(persisted.institutionId, INST_1_ID);

    // 3. course_created must NOT be emitted
    const courseCreatedEvents = mockServer.emissions.filter(e => e.event === 'course_created');
    assert.strictEqual(courseCreatedEvents.length, 0, 'SECURITY: course_created must NEVER be emitted!');

    // 4. Zero replacement global or wildcard emissions
    const globalEmissions = mockServer.emissions.filter(e => e.targetRooms.includes('*global*') || e.targetRooms.includes('*'));
    assert.strictEqual(globalEmissions.length, 0, 'SECURITY: No replacement global broadcast permitted!');
    assert.strictEqual(mockServer.emissions.length, 0, 'Must emit 0 total socket events on course creation');
  });

  // Test 5: Authorization and branch ownership validation remain intact
  await runTest('5. Authorization and branch validation remain intact on rejected cross-branch attempt', async () => {
    mockServer.emissions = [];
    const prevCalls = createCalls;

    const req: any = {
      user: { userId: MANAGER_INST1_ID, role: 'ADMIN', institutionId: INST_1_ID },
      tenantContext: { institutionId: INST_1_ID, isPlatformSuperAdmin: false },
      body: {
        title: 'Cross-Tenant Branch Hijack Attempt',
        teacherId: TEACHER_INST1_ID,
        branchId: '00000000-0000-4000-8000-000000000999' // Nonexistent / foreign
      }
    };
    const res = createMockRes();
    await createCourse(req, res);

    assert.strictEqual(res.statusCode, 400);
    assert.strictEqual(res.body.message, 'الفرع المحدد غير تابع لهذه المؤسسة أو غير متاح');
    assert.strictEqual(createCalls, prevCalls, 'No course persisted on validation failure');
    assert.strictEqual(mockServer.emissions.length, 0);
  });

  console.log('\n--- Frontend Center Student Catalog Assertions (6-9) ---');

  const centerPath = path.resolve(process.cwd(), '../../apps/frontend/src/app/components/student-center/CoursesPage.tsx');
  const centerContent = fs.readFileSync(centerPath, 'utf-8');

  await runTest('6. Center Student Catalog: No course_created listener registered or cleaned up', () => {
    assert.strictEqual(centerContent.includes("socket.on('course_created'"), false, 'Must not have socket.on(course_created)');
    assert.strictEqual(centerContent.includes('socket.on("course_created"'), false);
    assert.strictEqual(centerContent.includes("socket.off('course_created'"), false, 'Must not have socket.off(course_created)');
    assert.strictEqual(centerContent.includes('socket.off("course_created"'), false);
  });

  await runTest('7. Center Student Catalog: course_updated listener remains registered and cleaned up', () => {
    assert.ok(centerContent.includes("socket.on('course_updated', handleSync)"));
    assert.ok(centerContent.includes("socket.off('course_updated', handleSync)"));
  });

  await runTest('8. Center Student Catalog: course_deleted listener remains registered and cleaned up', () => {
    assert.ok(centerContent.includes("socket.on('course_deleted', handleSync)"));
    assert.ok(centerContent.includes("socket.off('course_deleted', handleSync)"));
  });

  await runTest('9. Center Student Catalog: 20-second polling and visibility change refresh intact', () => {
    assert.ok(centerContent.includes('setInterval(') && centerContent.includes('20000'), '20-second interval polling must exist');
    assert.ok(centerContent.includes("addEventListener('visibilitychange'"), 'Tab visibility listener must exist');
    assert.ok(centerContent.includes("removeEventListener('visibilitychange'"), 'Tab visibility cleanup must exist');
  });

  console.log('\n--- Frontend Online Student Catalog Assertions (10-13) ---');

  const onlinePath = path.resolve(process.cwd(), '../../apps/frontend/src/app/components/student-online/CoursesPage.tsx');
  const onlineContent = fs.readFileSync(onlinePath, 'utf-8');

  await runTest('10. Online Student Catalog: No course_created listener registered or cleaned up', () => {
    assert.strictEqual(onlineContent.includes("socket.on('course_created'"), false, 'Must not have socket.on(course_created)');
    assert.strictEqual(onlineContent.includes('socket.on("course_created"'), false);
    assert.strictEqual(onlineContent.includes("socket.off('course_created'"), false, 'Must not have socket.off(course_created)');
    assert.strictEqual(onlineContent.includes('socket.off("course_created"'), false);
  });

  await runTest('11. Online Student Catalog: course_updated listener remains registered and cleaned up', () => {
    assert.ok(onlineContent.includes("socket.on('course_updated', handleSync)"));
    assert.ok(onlineContent.includes("socket.off('course_updated', handleSync)"));
  });

  await runTest('12. Online Student Catalog: course_deleted listener remains registered and cleaned up', () => {
    assert.ok(onlineContent.includes("socket.on('course_deleted', handleSync)"));
    assert.ok(onlineContent.includes("socket.off('course_deleted', handleSync)"));
  });

  await runTest('13. Online Student Catalog: 20-second polling and visibility change refresh intact', () => {
    assert.ok(onlineContent.includes('setInterval(') && onlineContent.includes('20000'), '20-second interval polling must exist');
    assert.ok(onlineContent.includes("addEventListener('visibilitychange'"), 'Tab visibility listener must exist');
    assert.ok(onlineContent.includes("removeEventListener('visibilitychange'"), 'Tab visibility cleanup must exist');
  });

  console.log('\n================================================================================');
  console.log(`TEST RESULTS: ${passed} PASSED, ${failed} FAILED (TOTAL: ${passed + failed})`);
  console.log('================================================================================');

  if (failed > 0) process.exit(1);
}

main().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});

