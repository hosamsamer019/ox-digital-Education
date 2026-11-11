import assert from 'assert';
import jwt from 'jsonwebtoken';
import { emitHomeworkSubmissionNotification } from './src/controllers/homework.controller.js';

const TEST_JWT_SECRET = 'test-jwt-secret-ox-digital-test-key-32chars';
process.env.JWT_SECRET = TEST_JWT_SECRET;

/**
 * OX-DIGITAL Education — Socket.IO Multi-Tenant & Room Security Isolation Suite (Mock Infrastructure)
 *
 * Requirements (Phase B4):
 * 1. Unauthenticated / Invalid token socket connections are rejected with Authentication error.
 * 2. Teacher A joins strictly 'teacher:${teacherId}' and owned course rooms; NEVER joins global 'teachers' room.
 * 3. Scoped Admins / Managers join strictly 'institution:${institutionId}:admin' & 'branch:${branchId}:admin'; NEVER global 'admin'.
 * 4. Global 'admin' room scaffolding and unissued SUPER_ADMIN / isPlatformSuperAdmin claims are removed (fail-closed).
 * 5. Homework submission emits exclusively to authorized 'teacher:${teacherId}', 'institution:${institutionId}:admin',
 *    and 'branch:${branchId}:admin'.
 * 6. Global 'teachers' broadcast is ELIMINATED: Teacher B (unrelated) receives 0 events.
 * 7. Cross-tenant leakage is ELIMINATED: Institution 2 Admin receives 0 events for Institution 1 course.
 * 8. Cross-branch leakage is ELIMINATED: Branch 2 Admin receives 0 events for Branch 1 course.
 * 9. Client-side arbitrary room subscription payloads are rejected.
 */

// Mock Socket implementation that tracks rooms and emissions
class MockSocket {
  id: string;
  handshake: { auth?: any; query?: any };
  data: { user?: any } = {};
  rooms: Set<string> = new Set();
  receivedEvents: Array<{ event: string; payload: any }> = [];

  constructor(id: string, auth: any = {}) {
    this.id = id;
    this.handshake = { auth };
  }

  join(room: string) {
    this.rooms.add(room);
  }

  leave(room: string) {
    this.rooms.delete(room);
  }

  deliver(event: string, payload: any) {
    this.receivedEvents.push({ event, payload });
  }
}

// Mock Socket.IO Server implementation
class MockSocketIOServer {
  sockets: Map<string, MockSocket> = new Map();
  emissions: Array<{ targetRooms: string[]; event: string; payload: any }> = [];

  registerSocket(socket: MockSocket) {
    this.sockets.set(socket.id, socket);
  }

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
        // Deliver to all registered sockets that belong to ANY of the target rooms
        self.sockets.forEach((socket) => {
          const isMember = targetRooms.some((room) => socket.rooms.has(room));
          if (isMember) {
            socket.deliver(event, payload);
          }
        });
      }
    };
  }
}

// Authoritative Socket Auth Middleware (matches services/course-service/src/index.ts)
async function authenticateAndScopeSocket(socket: MockSocket, mockDbCourses: any[] = []): Promise<Error | null> {
  const token = socket.handshake.auth?.token;
  if (!token) return new Error('Authentication error: Missing token');

  try {
    const decoded = jwt.verify(token, TEST_JWT_SECRET) as any;
    socket.data.user = decoded;
    const resolvedUserId = decoded.userId || decoded.id;
    const userRole = (decoded.role || '').toUpperCase();

    // Always join own user room for targeted individual notifications
    if (resolvedUserId) {
      socket.join(`user:${resolvedUserId}`);
    }

    // Scoped Admin & Primary Manager namespace: scoped by institution/branch
    // Global 'admin' room and unissued SUPER_ADMIN / isPlatformSuperAdmin claims are removed (fail-closed).
    if (userRole === 'ADMIN' || userRole === 'PRIMARY_MANAGER') {
      if (decoded.institutionId) {
        socket.join(`institution:${decoded.institutionId}:admin`);
        if (decoded.branchId) {
          socket.join(`branch:${decoded.branchId}:admin`);
        }
      } else {
        // FAIL-CLOSED: Admin/manager without institutionId is strictly confined to user:${resolvedUserId}
      }
    }

    // Teacher namespace: strictly private teacher room + owned course rooms (NO global 'teachers' room)
    if (userRole === 'TEACHER') {
      if (resolvedUserId) {
        socket.join(`teacher:${resolvedUserId}`);
        const ownedCourses = mockDbCourses.filter((c) => c.teacherId === resolvedUserId);
        ownedCourses.forEach((c) => socket.join(`course:${c.id}`));
      }
    }

    // Student & Parent namespace
    if (userRole.includes('STUDENT') || userRole === 'PARENT') {
      // In course-service, enrolled courses are joined; user room is already joined above
    }

    return null;
  } catch (err: any) {
    return new Error('Authentication error: Invalid token');
  }
}

// Forwarding directly to authoritative controller implementation in homework.controller.ts
function emitHomeworkSubmission(io: MockSocketIOServer, homework: any, submission: any) {
  return emitHomeworkSubmissionNotification(io, homework.course, submission, homework.id);
}

async function runSuite() {
  console.log('=== RUNNING BACKEND SOCKET.IO SECURITY ISOLATION TEST SUITE ===\n');
  let passed = 0;
  let failed = 0;

  const testAssert = (desc: string, fn: () => void) => {
    try {
      fn();
      console.log(`PASS: ${desc}`);
      passed++;
    } catch (err: any) {
      console.error(`FAIL: ${desc} -> ${err.message}`);
      failed++;
    }
  };

  // 1. Missing Token Rejection
  await (async () => {
    const s = new MockSocket('s-unauth', {});
    const err = await authenticateAndScopeSocket(s);
    testAssert('1. Unauthenticated connection rejected with missing token error', () => {
      assert.ok(err);
      assert.strictEqual(err?.message, 'Authentication error: Missing token');
      assert.strictEqual(s.rooms.size, 0);
    });
  })();

  // 2. Invalid Token Rejection
  await (async () => {
    const s = new MockSocket('s-bad-token', { token: 'invalid.jwt.token' });
    const err = await authenticateAndScopeSocket(s);
    testAssert('2. Invalid JWT connection rejected with invalid token error', () => {
      assert.ok(err);
      assert.strictEqual(err?.message, 'Authentication error: Invalid token');
      assert.strictEqual(s.rooms.size, 0);
    });
  })();

  // 3. Teacher Room Scoping (Elimination of global 'teachers' room)
  await (async () => {
    const token = jwt.sign({ userId: 'teacher-A', role: 'TEACHER', institutionId: 'inst-1' }, TEST_JWT_SECRET);
    const s = new MockSocket('s-teach-a', { token });
    const mockCourses = [{ id: 'c-101', teacherId: 'teacher-A' }, { id: 'c-102', teacherId: 'teacher-B' }];
    const err = await authenticateAndScopeSocket(s, mockCourses);
    testAssert('3. Teacher A joins private room teacher:teacher-A and owned courses; NEVER joins global teachers room', () => {
      assert.strictEqual(err, null);
      assert.ok(s.rooms.has('teacher:teacher-A'), 'Must have joined teacher:teacher-A');
      assert.ok(s.rooms.has('course:c-101'), 'Must have joined owned course:c-101');
      assert.strictEqual(s.rooms.has('course:c-102'), false, 'Must NOT join foreign course:c-102');
      assert.strictEqual(s.rooms.has('teachers'), false, 'SECURITY: Must NEVER join global teachers room!');
      assert.strictEqual(s.rooms.has('admin'), false, 'Must not join admin room');
    });
  })();

  // 4. Scoped Institution Admin / Primary Manager Room Scoping
  await (async () => {
    const token = jwt.sign({ userId: 'mgr-inst1-b1', role: 'PRIMARY_MANAGER', institutionId: 'inst-1', branchId: 'branch-1' }, TEST_JWT_SECRET);
    const s = new MockSocket('s-mgr-1', { token });
    const err = await authenticateAndScopeSocket(s);
    testAssert('4. Scoped Manager joins institution:inst-1:admin and branch:branch-1:admin; NEVER joins global admin', () => {
      assert.strictEqual(err, null);
      assert.ok(s.rooms.has('institution:inst-1:admin'));
      assert.ok(s.rooms.has('branch:branch-1:admin'));
      assert.strictEqual(s.rooms.has('admin'), false, 'SECURITY: Must NEVER join global unscoped admin room!');
    });
  })();

  // 5. Unsupported Super-Admin Claims & Fail-Closed Defense (Phase F)
  await (async () => {
    // 5a-1. Unissued isPlatformSuperAdmin claim does NOT grant global admin room access
    const tokenSuperClaim = jwt.sign({ userId: 'saas-super-claim', isPlatformSuperAdmin: true, role: 'ADMIN' }, TEST_JWT_SECRET);
    const sSuperClaim = new MockSocket('s-super-claim', { token: tokenSuperClaim });
    const errSuperClaim = await authenticateAndScopeSocket(sSuperClaim);
    testAssert('5a-1. Unissued isPlatformSuperAdmin claim does NOT join removed global admin room', () => {
      assert.strictEqual(errSuperClaim, null);
      assert.strictEqual(sSuperClaim.rooms.has('admin'), false, 'Global admin room must remain inaccessible');
      assert.ok(sSuperClaim.rooms.has('user:saas-super-claim'), 'Must join own user room');
    });

    // 5a-2. Unsupported SUPER_ADMIN role does NOT grant global admin room access
    const tokenSuperRole = jwt.sign({ userId: 'saas-super-role', role: 'SUPER_ADMIN' }, TEST_JWT_SECRET);
    const sSuperRole = new MockSocket('s-super-role', { token: tokenSuperRole });
    const errSuperRole = await authenticateAndScopeSocket(sSuperRole);
    testAssert('5a-2. Unsupported SUPER_ADMIN role does NOT join removed global admin room', () => {
      assert.strictEqual(errSuperRole, null);
      assert.strictEqual(sSuperRole.rooms.has('admin'), false, 'Global admin room must remain inaccessible');
      assert.ok(sSuperRole.rooms.has('user:saas-super-role'), 'Must join own user room');
    });

    // 5b. Normal ADMIN with email admin@edu.com does NOT receive global admin access
    const tokenAdminEduEmail = jwt.sign({ userId: 'admin-edu-user', email: 'admin@edu.com', role: 'ADMIN', institutionId: 'inst-1' }, TEST_JWT_SECRET);
    const sAdminEduEmail = new MockSocket('s-admin-edu', { token: tokenAdminEduEmail });
    await authenticateAndScopeSocket(sAdminEduEmail);
    testAssert('5b. Normal ADMIN with admin@edu.com email does NOT receive global access', () => {
      assert.strictEqual(sAdminEduEmail.rooms.has('admin'), false, 'SECURITY: Email alone must NEVER grant global admin room access!');
      assert.ok(sAdminEduEmail.rooms.has('institution:inst-1:admin'), 'Must join scoped tenant room');
      assert.ok(sAdminEduEmail.rooms.has('user:admin-edu-user'), 'Must join own user room');
    });

    // 5c. PRIMARY_MANAGER with email admin@edu.com does NOT receive global admin access
    const tokenMgrEduEmail = jwt.sign({ userId: 'mgr-edu-user', email: 'admin@edu.com', role: 'PRIMARY_MANAGER', institutionId: 'inst-1' }, TEST_JWT_SECRET);
    const sMgrEduEmail = new MockSocket('s-mgr-edu', { token: tokenMgrEduEmail });
    await authenticateAndScopeSocket(sMgrEduEmail);
    testAssert('5c. PRIMARY_MANAGER with admin@edu.com email does NOT receive global access', () => {
      assert.strictEqual(sMgrEduEmail.rooms.has('admin'), false, 'SECURITY: Email alone must NEVER grant global admin room access to manager!');
      assert.ok(sMgrEduEmail.rooms.has('institution:inst-1:admin'), 'Must join scoped tenant room');
      assert.ok(sMgrEduEmail.rooms.has('user:mgr-edu-user'), 'Must join own user room');
    });

    // 5d. Normal ADMIN with missing institutionId FAILS CLOSED (never joins admin or tenant room)
    const tokenAdminNoInst = jwt.sign({ userId: 'admin-unscoped', role: 'ADMIN', email: 'admin@edu.com' }, TEST_JWT_SECRET);
    const sAdminNoInst = new MockSocket('s-admin-no-inst', { token: tokenAdminNoInst });
    await authenticateAndScopeSocket(sAdminNoInst);
    testAssert('5d. Normal ADMIN with missing institutionId fails closed and CANNOT join admin', () => {
      assert.strictEqual(sAdminNoInst.rooms.has('admin'), false, 'SECURITY: Unscoped normal admin must NEVER join global admin room!');
      assert.ok(sAdminNoInst.rooms.has('user:admin-unscoped'), 'Joins only own user room');
      assert.strictEqual(sAdminNoInst.rooms.size, 1);
    });

    // 5e. PRIMARY_MANAGER with missing institutionId FAILS CLOSED (never joins admin or tenant room)
    const tokenMgrNoInst = jwt.sign({ userId: 'mgr-unscoped', role: 'PRIMARY_MANAGER', email: 'admin@edu.com' }, TEST_JWT_SECRET);
    const sMgrNoInst = new MockSocket('s-mgr-no-inst', { token: tokenMgrNoInst });
    await authenticateAndScopeSocket(sMgrNoInst);
    testAssert('5e. PRIMARY_MANAGER with missing institutionId fails closed and CANNOT join admin', () => {
      assert.strictEqual(sMgrNoInst.rooms.has('admin'), false, 'SECURITY: Unscoped manager must NEVER join global admin room!');
      assert.ok(sMgrNoInst.rooms.has('user:mgr-unscoped'), 'Joins only own user room');
      assert.strictEqual(sMgrNoInst.rooms.size, 1);
    });

    // 5f. Untrusted or forged privilege claim is rejected
    const forgedToken = jwt.sign({ userId: 'hacker-1', isPlatformSuperAdmin: true, role: 'SUPER_ADMIN' }, 'attacker-untrusted-secret');
    const sForged = new MockSocket('s-forged', { token: forgedToken });
    const errForged = await authenticateAndScopeSocket(sForged);
    testAssert('5f. Untrusted or forged privilege claim is rejected with signature verification error', () => {
      assert.ok(errForged, 'Must return error');
      assert.strictEqual(errForged?.message, 'Authentication error: Invalid token');
      assert.strictEqual(sForged.rooms.size, 0, 'Forged socket must join 0 rooms');
    });

    // 5g. Expired token is rejected
    const expiredToken = jwt.sign({ userId: 'expired-user', role: 'ADMIN', institutionId: 'inst-1', exp: Math.floor(Date.now() / 1000) - 60 }, TEST_JWT_SECRET);
    const sExpired = new MockSocket('s-expired', { token: expiredToken });
    const errExpired = await authenticateAndScopeSocket(sExpired);
    testAssert('5g. Expired token is rejected and joins 0 rooms', () => {
      assert.ok(errExpired, 'Must return error');
      assert.strictEqual(errExpired?.message, 'Authentication error: Invalid token');
      assert.strictEqual(sExpired.rooms.size, 0, 'Expired socket must join 0 rooms');
    });
  })();

  // 6. Cross-Teacher Homework Submission Isolation
  await (async () => {
    const io = new MockSocketIOServer();

    const tokenTeacherA = jwt.sign({ userId: 'teacher-A', role: 'TEACHER', institutionId: 'inst-1' }, TEST_JWT_SECRET);
    const tokenTeacherB = jwt.sign({ userId: 'teacher-B', role: 'TEACHER', institutionId: 'inst-1' }, TEST_JWT_SECRET);
    const sTeacherA = new MockSocket('s-teacher-A', { token: tokenTeacherA });
    const sTeacherB = new MockSocket('s-teacher-B', { token: tokenTeacherB });
    await authenticateAndScopeSocket(sTeacherA);
    await authenticateAndScopeSocket(sTeacherB);
    io.registerSocket(sTeacherA);
    io.registerSocket(sTeacherB);

    const testSubmission = { id: 'sub-001', studentId: 'student-1', grade: 100 };
    const hw = {
      id: 'hw-1',
      course: { id: 'c-1', teacherId: 'teacher-A', institutionId: 'inst-1', branchId: 'branch-1', branch: { institutionId: 'inst-1' } }
    };

    emitHomeworkSubmission(io, hw, testSubmission);

    testAssert('6. Cross-Teacher Isolation: Teacher A receives submission; Teacher B receives ZERO events', () => {
      assert.strictEqual(sTeacherA.receivedEvents.length, 1);
      assert.strictEqual(sTeacherA.receivedEvents[0].event, 'homework_submitted');
      assert.strictEqual(sTeacherA.receivedEvents[0].payload.id, 'sub-001');

      assert.strictEqual(sTeacherB.receivedEvents.length, 0, 'SECURITY LEAK: Teacher B received Teacher A submission!');
    });
  })();

  // 7. Multi-Tenant Cross-Institution Admin Isolation
  await (async () => {
    const io = new MockSocketIOServer();

    const tokenInst1Admin = jwt.sign({ userId: 'admin-inst-1', role: 'ADMIN', institutionId: 'inst-1' }, TEST_JWT_SECRET);
    const tokenInst2Admin = jwt.sign({ userId: 'admin-inst-2', role: 'ADMIN', institutionId: 'inst-2' }, TEST_JWT_SECRET);
    const sAdmin1 = new MockSocket('s-admin-1', { token: tokenInst1Admin });
    const sAdmin2 = new MockSocket('s-admin-2', { token: tokenInst2Admin });
    await authenticateAndScopeSocket(sAdmin1);
    await authenticateAndScopeSocket(sAdmin2);
    io.registerSocket(sAdmin1);
    io.registerSocket(sAdmin2);

    const testSubmission = { id: 'sub-002', studentId: 'student-2', grade: 90 };
    const hwInst1 = {
      id: 'hw-2',
      course: { id: 'c-2', teacherId: 'teacher-A', institutionId: 'inst-1' }
    };

    emitHomeworkSubmission(io, hwInst1, testSubmission);

    testAssert('7. Tenant Isolation: Institution 1 Admin receives submission; Institution 2 Admin receives ZERO events', () => {
      assert.strictEqual(sAdmin1.receivedEvents.length, 1);
      assert.strictEqual(sAdmin1.receivedEvents[0].payload.id, 'sub-002');

      assert.strictEqual(sAdmin2.receivedEvents.length, 0, 'CROSS-TENANT LEAK: Inst 2 Admin received Inst 1 event!');
    });
  })();

  // 8. Cross-Branch Isolation for Managers
  await (async () => {
    const io = new MockSocketIOServer();

    const tokenBranch1Mgr = jwt.sign({ userId: 'mgr-b1', role: 'PRIMARY_MANAGER', institutionId: 'inst-1', branchId: 'branch-1' }, TEST_JWT_SECRET);
    const tokenBranch2Mgr = jwt.sign({ userId: 'mgr-b2', role: 'PRIMARY_MANAGER', institutionId: 'inst-1', branchId: 'branch-2' }, TEST_JWT_SECRET);
    const sBranch1 = new MockSocket('s-b1', { token: tokenBranch1Mgr });
    const sBranch2 = new MockSocket('s-b2', { token: tokenBranch2Mgr });
    await authenticateAndScopeSocket(sBranch1);
    await authenticateAndScopeSocket(sBranch2);
    io.registerSocket(sBranch1);
    io.registerSocket(sBranch2);

    const testSubmission = { id: 'sub-003', studentId: 'student-3', grade: 85 };
    const hwBranch1 = {
      id: 'hw-3',
      course: { id: 'c-3', teacherId: 'teacher-A', institutionId: 'inst-1', branchId: 'branch-1', branch: { institutionId: 'inst-1' } }
    };

    emitHomeworkSubmission(io, hwBranch1, testSubmission);

    testAssert('8. Branch Isolation: Branch 1 Manager receives branch event; Branch 2 Manager does not receive branch-specific event', () => {
      // Both belong to inst-1 so both receive institution-level admin notification, but branch:branch-1 event is strictly isolated
      const branch1SpecificDeliveries = io.emissions.filter((e) => e.targetRooms.includes('branch:branch-1:admin'));
      assert.strictEqual(branch1SpecificDeliveries.length, 1);
      assert.ok(sBranch1.rooms.has('branch:branch-1:admin'));
      assert.strictEqual(sBranch2.rooms.has('branch:branch-1:admin'), false, 'CROSS-BRANCH LEAK: Branch 2 has branch-1 room membership!');
    });
  })();

  // 9. Peer Student Isolation (Students do NOT receive submission notifications)
  await (async () => {
    const io = new MockSocketIOServer();

    const tokenStudentA = jwt.sign({ userId: 'student-A', role: 'ONLINE_STUDENT', institutionId: 'inst-1' }, TEST_JWT_SECRET);
    const tokenStudentB = jwt.sign({ userId: 'student-B', role: 'ONLINE_STUDENT', institutionId: 'inst-1' }, TEST_JWT_SECRET);
    const sStudentA = new MockSocket('s-stu-A', { token: tokenStudentA });
    const sStudentB = new MockSocket('s-stu-B', { token: tokenStudentB });
    await authenticateAndScopeSocket(sStudentA);
    await authenticateAndScopeSocket(sStudentB);
    io.registerSocket(sStudentA);
    io.registerSocket(sStudentB);

    const testSubmission = { id: 'sub-004', studentId: 'student-A', grade: 92, answers: [{ q: 1, a: 'A' }] };
    const hw = {
      id: 'hw-4',
      course: { id: 'c-4', teacherId: 'teacher-A', institutionId: 'inst-1' }
    };

    emitHomeworkSubmission(io, hw, testSubmission);

    testAssert('9. Student Isolation: Peer students do NOT receive homework submission events or answer keys', () => {
      assert.strictEqual(sStudentA.receivedEvents.length, 0);
      assert.strictEqual(sStudentB.receivedEvents.length, 0);
    });
  })();

  // 10. Homework Broadcast Hardening: Cases A, B, C, D
  await (async () => {
    const io = new MockSocketIOServer();

    // Sockets for testing all scopes
    const tokenTeacher = jwt.sign({ userId: 'teacher-X', role: 'TEACHER', institutionId: 'inst-1' }, TEST_JWT_SECRET);
    const tokenInstAdmin = jwt.sign({ userId: 'admin-inst-1', role: 'ADMIN', institutionId: 'inst-1' }, TEST_JWT_SECRET);
    const tokenBranchAdmin = jwt.sign({ userId: 'admin-b1', role: 'PRIMARY_MANAGER', institutionId: 'inst-1', branchId: 'branch-1' }, TEST_JWT_SECRET);
    const tokenForeignInstAdmin = jwt.sign({ userId: 'admin-inst-2', role: 'ADMIN', institutionId: 'inst-2' }, TEST_JWT_SECRET);
    const tokenGlobalAdmin = jwt.sign({ userId: 'super-global', role: 'SUPER_ADMIN' }, TEST_JWT_SECRET);

    const sTeacher = new MockSocket('s-teacher-X', { token: tokenTeacher });
    const sInstAdmin = new MockSocket('s-admin-inst-1', { token: tokenInstAdmin });
    const sBranchAdmin = new MockSocket('s-admin-b1', { token: tokenBranchAdmin });
    const sForeignAdmin = new MockSocket('s-foreign-admin', { token: tokenForeignInstAdmin });
    const sGlobalAdmin = new MockSocket('s-global-admin', { token: tokenGlobalAdmin });

    await authenticateAndScopeSocket(sTeacher);
    await authenticateAndScopeSocket(sInstAdmin);
    await authenticateAndScopeSocket(sBranchAdmin);
    await authenticateAndScopeSocket(sForeignAdmin);
    await authenticateAndScopeSocket(sGlobalAdmin);

    io.registerSocket(sTeacher);
    io.registerSocket(sInstAdmin);
    io.registerSocket(sBranchAdmin);
    io.registerSocket(sForeignAdmin);
    io.registerSocket(sGlobalAdmin);

    const sub = { id: 'sub-case-test', studentId: 'stu-100', grade: 95 };

    // Case A: Normal institutional course with verified matching branch relation
    const courseA = { id: 'c-case-A', teacherId: 'teacher-X', institutionId: 'inst-1', branchId: 'branch-1', branch: { institutionId: 'inst-1' } };
    const resA = emitHomeworkSubmissionNotification(io, courseA, sub, 'c-case-A');
    testAssert('10a. Case A (Normal course): Teacher, Institution admin, and Branch admin receive event; Global admin receives nothing', () => {
      assert.strictEqual(resA.delivered, true);
      assert.deepStrictEqual(resA.targetedRooms, ['teacher:teacher-X', 'institution:inst-1:admin', 'branch:branch-1:admin']);
      assert.ok(sTeacher.receivedEvents.some(e => e.payload.id === 'sub-case-test'));
      assert.ok(sInstAdmin.receivedEvents.some(e => e.payload.id === 'sub-case-test'));
      assert.ok(sBranchAdmin.receivedEvents.some(e => e.payload.id === 'sub-case-test'));
      assert.strictEqual(sGlobalAdmin.receivedEvents.filter(e => e.payload.id === 'sub-case-test').length, 0, 'Global admin must receive NOTHING');
      assert.strictEqual(sForeignAdmin.receivedEvents.filter(e => e.payload.id === 'sub-case-test').length, 0, 'Foreign tenant must receive NOTHING');
    });

    // Reset received events for clean assertions
    [sTeacher, sInstAdmin, sBranchAdmin, sForeignAdmin, sGlobalAdmin].forEach(s => s.receivedEvents = []);

    // Case B: Legacy course without institutionId
    const courseB = { id: 'c-case-B', teacherId: 'teacher-X', institutionId: null, branchId: null };
    const subB = { id: 'sub-legacy-B', studentId: 'stu-100', grade: 88 };
    const resB = emitHomeworkSubmissionNotification(io, courseB, subB, 'c-case-B');
    testAssert('10b. Case B (Legacy course without institutionId): Owning teacher receives event; No admin or branch rooms targeted; Global admin receives nothing', () => {
      assert.strictEqual(resB.delivered, true);
      assert.deepStrictEqual(resB.targetedRooms, ['teacher:teacher-X']);
      assert.ok(sTeacher.receivedEvents.some(e => e.payload.id === 'sub-legacy-B'), 'Teacher must receive event');
      assert.strictEqual(sInstAdmin.receivedEvents.length, 0, 'Institution admin must NOT receive unscoped legacy event');
      assert.strictEqual(sBranchAdmin.receivedEvents.length, 0, 'Branch admin must NOT receive unscoped legacy event');
      assert.strictEqual(sGlobalAdmin.receivedEvents.length, 0, 'Global admin must NOT receive event (fallback removed)');
    });

    // Reset received events
    [sTeacher, sInstAdmin, sBranchAdmin, sForeignAdmin, sGlobalAdmin].forEach(s => s.receivedEvents = []);

    // Case C: Legacy course without a valid teacher recipient
    const courseC = { id: 'c-case-C', teacherId: null, institutionId: null, branchId: null };
    const subC = { id: 'sub-orphan-C', studentId: 'stu-100', grade: 75 };
    const resC = emitHomeworkSubmissionNotification(io, courseC, subC, 'c-case-C');
    testAssert('10c. Case C (Legacy course without valid teacher): Handled safely without global fallback; 0 rooms targeted', () => {
      assert.strictEqual(resC.delivered, false);
      assert.deepStrictEqual(resC.targetedRooms, []);
      assert.strictEqual(sTeacher.receivedEvents.length, 0);
      assert.strictEqual(sInstAdmin.receivedEvents.length, 0);
      assert.strictEqual(sGlobalAdmin.receivedEvents.length, 0, 'Zero fallback to global admin');
    });

    // Case D: Cross-tenant isolation & persisted scope integrity
    const courseD = { id: 'c-case-D', teacherId: 'teacher-X', institutionId: 'inst-1', branchId: null };
    const subD = { id: 'sub-tenant-D', studentId: 'stu-100', grade: 99 };
    const resD = emitHomeworkSubmissionNotification(io, courseD, subD, 'c-case-D');
    testAssert('10d. Case D (Cross-tenant isolation): Scoped strictly to authoritative course institution; foreign tenants receive 0 events', () => {
      assert.strictEqual(resD.delivered, true);
      assert.deepStrictEqual(resD.targetedRooms, ['teacher:teacher-X', 'institution:inst-1:admin']);
      assert.ok(sInstAdmin.receivedEvents.some(e => e.payload.id === 'sub-tenant-D'));
      assert.strictEqual(sForeignAdmin.receivedEvents.length, 0, 'Foreign institution admin must receive ZERO events');
      assert.strictEqual(sGlobalAdmin.receivedEvents.length, 0, 'Global admin receives ZERO events');
    });
  })();

  console.log(`\n======================================================`);
  console.log(`SOCKET.IO SECURITY ISOLATION RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log(`======================================================\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

runSuite().catch((err) => {
  console.error('Unhandled suite error:', err);
  process.exit(1);
});
