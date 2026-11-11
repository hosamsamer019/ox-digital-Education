/**
 * OX-DIGITAL Education — Attendance Express Router HTTP Integration Test Suite
 *
 * Verifies exact router-level registrations, middleware chains (verifyToken, tenantContextMiddleware, checkRole),
 * and HTTP request/response lifecycles for all nine attendance routes.
 *
 * Runs an in-memory ephemeral HTTP server on 127.0.0.1:0 without external containers or live database.
 */

import express from 'express';
import { Readable, Writable } from 'stream';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret-key-123456';
process.env.JWT_SECRET = JWT_SECRET;

const INST_A = 'inst-alpha-uuid';
const BRANCH_1 = 'branch-1-uuid';

const teacherUser = {
  id: 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa',
  userId: 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa',
  email: 'teacher@ox.com',
  name: 'Teacher Router Test',
  role: 'TEACHER',
  institutionId: INST_A,
  branchId: BRANCH_1
};

const studentUser = {
  id: 'bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb',
  userId: 'bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb',
  email: 'student@ox.com',
  name: 'Student Router Test',
  role: 'STUDENT',
  institutionId: INST_A,
  branchId: BRANCH_1
};

function createToken(user: any) {
  return jwt.sign(
    {
      userId: user.userId || user.id,
      email: user.email,
      role: user.role,
      institutionId: user.institutionId,
      branchId: user.branchId
    },
    JWT_SECRET,
    { expiresIn: '1h' }
  );
}

// In-memory Mock DB store for router testing
const mockAttendances = new Map<string, any>();
const mockUsers = new Map<string, any>();
const mockStudentTeachers = new Map<string, any>();

mockUsers.set(teacherUser.id, teacherUser);
mockUsers.set(studentUser.id, studentUser);

mockStudentTeachers.set(`${studentUser.id}_${teacherUser.id}`, {
  id: 'st-router-1',
  studentId: studentUser.id,
  teacherId: teacherUser.id,
  status: 'ACTIVE'
});

const mockDb: any = {
  user: {
    findUnique: async ({ where }: any) => mockUsers.get(where.id) || null,
    findFirst: async ({ where }: any) => {
      for (const u of mockUsers.values()) {
        if (where.id && u.id !== where.id) continue;
        return u;
      }
      return null;
    }
  },
  studentTeacher: {
    findFirst: async ({ where }: any) => {
      const key = `${where.studentId}_${where.teacherId}`;
      const found = mockStudentTeachers.get(key);
      if (found && (!where.status || found.status === where.status)) return found;
      return null;
    }
  },
  courseEnrollment: {
    findFirst: async () => null
  },
  attendance: {
    findFirst: async ({ where }: any) => {
      for (const a of mockAttendances.values()) {
        if (where.studentId && a.studentId !== where.studentId) continue;
        return a;
      }
      return null;
    },
    findMany: async ({ where }: any) => {
      const res: any[] = [];
      for (const a of mockAttendances.values()) {
        if (where.studentId && a.studentId !== where.studentId) continue;
        res.push(a);
      }
      return res;
    },
    findUnique: async ({ where, include }: any) => {
      const rec = mockAttendances.get(where.id);
      if (!rec) return null;
      const res = { ...rec };
      if (include?.student) {
        const u = mockUsers.get(rec.studentId);
        res.student = u ? { ...u } : null;
      }
      return res;
    },
    create: async ({ data }: any) => {
      const id = 'att-' + Math.random().toString(36).substring(2, 8);
      const rec = { id, ...data };
      mockAttendances.set(id, rec);
      return rec;
    },
    update: async ({ where, data }: any) => {
      const existing = mockAttendances.get(where.id);
      const updated = { ...existing, ...data };
      mockAttendances.set(where.id, updated);
      return updated;
    },
    delete: async ({ where }: any) => {
      const existing = mockAttendances.get(where.id);
      mockAttendances.delete(where.id);
      return existing;
    }
  },
  $transaction: async (fn: any) => fn(mockDb),
  notification: {
    create: async () => ({ id: 'notif-1' })
  }
};

(globalThis as any).prismaGlobal = mockDb;

import attendanceRoutes from './src/routes/attendance.routes.js';

// Create test express app
const app = express();
app.use(express.json());
app.use('/api/attendance', attendanceRoutes);

function dispatchInProcess(
  app: express.Express,
  method: string,
  url: string,
  token?: string,
  body?: any
): Promise<{ status: number; body: any }> {
  return new Promise((resolve) => {
    const postData = body ? JSON.stringify(body) : '';
    const req: any = new Readable({
      read() {
        if (postData) {
          this.push(postData);
        }
        this.push(null);
      }
    });

    req.method = method;
    req.url = url;
    req.headers = {
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...(postData ? { 'content-length': String(Buffer.byteLength(postData)) } : {})
    };

    let statusCode = 200;
    const headers: Record<string, string> = {};
    let responseBody = '';

    const res: any = new Writable({
      write(chunk, encoding, callback) {
        responseBody += chunk.toString();
        callback();
      }
    });

    res.status = (code: number) => {
      statusCode = code;
      return res;
    };
    res.setHeader = (k: string, v: string) => {
      headers[k.toLowerCase()] = v;
      return res;
    };
    res.getHeader = (k: string) => headers[k.toLowerCase()];
    res.json = (obj: any) => {
      statusCode = statusCode || 200;
      responseBody = JSON.stringify(obj);
      res.emit('finish');
      return res;
    };
    res.send = (val: any) => {
      statusCode = statusCode || 200;
      responseBody = typeof val === 'object' ? JSON.stringify(val) : String(val);
      res.emit('finish');
      return res;
    };
    res.end = (chunk?: any) => {
      if (chunk) responseBody += chunk.toString();
      res.emit('finish');
      return res;
    };

    res.on('finish', () => {
      let parsed = responseBody;
      try {
        parsed = JSON.parse(responseBody);
      } catch {}
      resolve({ status: statusCode, body: parsed });
    });

    app.handle(req, res);
  });
}

async function runRouterTests() {
  console.log('================================================================');
  console.log('  OX-DIGITAL: Attendance Express Router Integration Tests');
  console.log('================================================================\n');

  const teacherToken = createToken(teacherUser);
  const studentToken = createToken(studentUser);

  let passed = 0;
  let total = 0;

  function assertRoute(name: string, ok: boolean, extra?: any) {
    total++;
    if (ok) {
      passed++;
      console.log(`  ✓ Route Test ${total}: ${name}`);
    } else {
      console.error(`  ✗ Route Test ${total} FAILED: ${name}`, extra || '');
    }
  }

  // 1. Missing Token on Router Root -> 401
  {
    const res = await dispatchInProcess(app, 'GET', '/api/attendance/by-date?date=2026-11-15');
    assertRoute('Missing token on router rejects with 401 Unauthorized', res.status === 401, res);
  }

  // 2. Role Check Middleware on Teacher Route (STUDENT role) -> 403
  {
    const res = await dispatchInProcess(app, 'GET', '/api/attendance/by-date?date=2026-11-15', studentToken);
    assertRoute('checkRole rejects STUDENT from /by-date with 403 Forbidden', res.status === 403, res);
  }

  // 3. POST /api/attendance (markAttendance) via Router
  {
    const res = await dispatchInProcess(app, 'POST', '/api/attendance', teacherToken, {
      studentId: studentUser.id,
      status: 'PRESENT',
      date: '2026-11-15'
    });
    assertRoute('POST /api/attendance correctly routes to markAttendance (201 Created)', res.status === 201, res);
  }

  // 4. POST /api/attendance/bulk (bulkMarkAttendance) via Router
  {
    const res = await dispatchInProcess(app, 'POST', '/api/attendance/bulk', teacherToken, {
      records: [{ studentId: studentUser.id, status: 'LATE' }],
      date: '2026-11-15'
    });
    assertRoute('POST /api/attendance/bulk routes to bulkMarkAttendance (200 OK)', res.status === 200 && res.body?.success === true);
  }

  // 5. POST /api/attendance/clear (clearAttendanceRecord) via Router -> Verifies exact route!
  {
    const res = await dispatchInProcess(app, 'POST', '/api/attendance/clear', teacherToken, {
      studentId: studentUser.id,
      date: '2026-11-15'
    });
    assertRoute(
      'POST /api/attendance/clear routes to clearAttendanceRecord (200 OK, action CLEARED)',
      res.status === 200 && res.body?.action === 'CLEARED'
    );
  }

  // 6. GET /api/attendance/by-date (getAttendanceByDate) via Router
  {
    const res = await dispatchInProcess(app, 'GET', '/api/attendance/by-date?date=2026-11-15', teacherToken);
    assertRoute('GET /api/attendance/by-date routes to getAttendanceByDate (200 OK)', res.status === 200 && Array.isArray(res.body?.data));
  }

  // 7. GET /api/attendance/my-attendance (getStudentAttendance) via Router
  {
    const res = await dispatchInProcess(app, 'GET', '/api/attendance/my-attendance', studentToken);
    assertRoute('GET /api/attendance/my-attendance routes to getStudentAttendance (200 OK)', res.status === 200 && res.body?.summary !== undefined);
  }

  // 8. GET /api/attendance/student/:studentId (getStudentAttendanceById) via Router
  {
    const res = await dispatchInProcess(app, 'GET', `/api/attendance/student/${studentUser.id}`, studentToken);
    assertRoute('GET /api/attendance/student/:studentId routes to getStudentAttendanceById (200 OK)', res.status === 200);
  }

  // 9. GET /api/attendance/:studentId/percentage (getAttendancePercentage) via Router
  {
    const res = await dispatchInProcess(app, 'GET', `/api/attendance/${studentUser.id}/percentage`, studentToken);
    assertRoute('GET /api/attendance/:studentId/percentage routes to getAttendancePercentage (200 OK)', res.status === 200);
  }

  // 10. PUT /api/attendance/:id (updateAttendanceRecord) and DELETE /api/attendance/:id (deleteAttendanceRecord) via Router
  {
    // First seed a record to update and delete
    const seedRes = await dispatchInProcess(app, 'POST', '/api/attendance', teacherToken, {
      studentId: studentUser.id,
      status: 'ABSENT',
      date: '2026-11-16'
    });
    const recordId = seedRes.body?.id;

    const putRes = await dispatchInProcess(app, 'PUT', `/api/attendance/${recordId}`, teacherToken, {
      status: 'PRESENT'
    });
    const deleteRes = await dispatchInProcess(app, 'DELETE', `/api/attendance/${recordId}`, teacherToken);

    assertRoute(
      'PUT and DELETE /api/attendance/:id route to updateAttendanceRecord and deleteAttendanceRecord (200 OK)',
      putRes.status === 200 && deleteRes.status === 200 && deleteRes.body?.message?.includes('deleted successfully')
    );
  }

  console.log(`\n================================================================`);
  console.log(`  Attendance Router Suite Summary: ${passed}/${total} Route Tests Passed`);
  console.log(`================================================================\n`);

  if (passed !== total) {
    process.exit(1);
  }
}

runRouterTests().catch((err) => {
  console.error('Fatal Router Test Error:', err);
  process.exit(1);
});
