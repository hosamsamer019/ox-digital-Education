/**
 * Phase 2C.1 — Authenticated Private HLS Gateway Isolated Test Suite
 *
 * Verifies all 23 security, authorization, path traversal, streaming,
 * and playlist URL rewriting requirements.
 *
 * ZERO connection to production PostgreSQL, Redis, or Cloudflare R2.
 */

process.env.DATABASE_URL = 'postgresql://ox_digital_dev:ox_digital_dev@127.0.0.1:5433/ox_digital_dev_test?schema=public';
process.env.JWT_SECRET = 'test-phase2c1-jwt-secret-key-32chars!!';
const TEST_JWT_SECRET = process.env.JWT_SECRET;

import { streamLessonHls, resolveLessonHlsMasterKey } from './src/controllers/course.controller.js';
import { verifyToken, AuthRequest } from './src/middlewares/auth.middleware.js';
import { setHlsStreamProviderForTests, HlsStreamResult } from './src/services/storage.adapter.js';
import { db } from '../../packages/database/src/index.js';
import jwt from 'jsonwebtoken';
import { Readable } from 'stream';

import { Writable } from 'stream';
import { EventEmitter } from 'events';

class MockResponseStream extends Writable {
  statusCode: number = 200;
  headers: Record<string, string | number> = {};
  body: any = null;
  chunks: Buffer[] = [];

  _write(chunk: any, _encoding: string, callback: (error?: Error | null) => void) {
    this.chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    callback();
  }

  status(code: number) {
    this.statusCode = code;
    return this;
  }

  setHeader(name: string, value: string | number) {
    this.headers[name.toLowerCase()] = value;
    return this;
  }

  json(data: any) {
    this.body = data;
    return this;
  }

  send(data: any) {
    this.body = data;
    return this;
  }
}

function createMockResponse(): MockResponseStream {
  return new MockResponseStream();
}

function createMockRequest(options: {
  params?: Record<string, any>;
  query?: Record<string, any>;
  headers?: Record<string, string>;
  user?: any;
  path?: string;
  originalUrl?: string;
}): AuthRequest {
  const req = new EventEmitter() as any;
  req.params = options.params || {};
  req.query = options.query || {};
  req.headers = options.headers || {};
  req.user = options.user;
  req.path = options.path || '/api/courses/lessons/lesson-101/hls';
  req.originalUrl = options.originalUrl || options.path || '/api/courses/lessons/lesson-101/hls';
  return req;
}

// In-memory mock database state
const mockDb = {
  users: new Map<string, any>(),
  lessons: new Map<string, any>(),
  courses: new Map<string, any>(),
  enrollments: new Map<string, any>(),
  videoUploads: new Map<string, any>()
};

// Wire mock database into Prisma db singleton
const prismaMock: any = {
  user: {
    findUnique: async ({ where }: any) => {
      return mockDb.users.get(where.id) || {
        id: where.id,
        role: 'ONLINE_STUDENT',
        institutionId: 'inst-001',
        financialAccessStatus: 'ACTIVE',
        isPrimaryManager: false,
        mustChangePassword: false
      };
    },
    findFirst: async ({ where }: any) => {
      const id = where.id;
      return mockDb.users.get(id) || {
        id: id,
        role: 'ONLINE_STUDENT',
        institutionId: 'inst-001',
        financialAccessStatus: 'ACTIVE',
        isPrimaryManager: false,
        mustChangePassword: false
      };
    }
  },
  lesson: {
    findUnique: async ({ where }: any) => {
      const l = mockDb.lessons.get(where.id);
      if (!l) return null;
      const c = mockDb.courses.get(l.courseId);
      return { ...l, course: c };
    }
  },
  course: {
    findUnique: async ({ where }: any) => {
      return mockDb.courses.get(where.id) || null;
    }
  },
  courseEnrollment: {
    findFirst: async ({ where }: any) => {
      for (const enr of mockDb.enrollments.values()) {
        if (enr.studentId === where.studentId && enr.courseId === where.courseId) {
          return { ...enr };
        }
      }
      return null;
    }
  },
  videoUpload: {
    findUnique: async ({ where }: any) => {
      return mockDb.videoUploads.get(where.id) || null;
    }
  }
};

(globalThis as any).prismaGlobal = prismaMock;

// In-memory mock Cloudflare R2 objects
const mockR2Storage = new Map<string, { buffer: Buffer; contentType: string }>();

setHlsStreamProviderForTests(async (key: string, range?: string): Promise<HlsStreamResult | null> => {
  const item = mockR2Storage.get(key);
  if (!item) return null;

  if (range) {
    const parts = range.replace(/bytes=/, '').split('-');
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : item.buffer.length - 1;

    if (start >= item.buffer.length || end >= item.buffer.length) {
      return null;
    }

    const sliced = item.buffer.subarray(start, end + 1);
    const stream = Readable.from(sliced);
    return {
      stream,
      contentType: item.contentType,
      contentLength: sliced.length,
      contentRange: `bytes ${start}-${end}/${item.buffer.length}`,
      statusCode: 206
    };
  }

  const stream = Readable.from(item.buffer);
  return {
    stream,
    contentType: item.contentType,
    contentLength: item.buffer.length,
    statusCode: 200
  };
});

async function runTestSuite() {
  console.log('===================================================================');
  console.log('OX-DIGITAL Phase 2C.1 — Authenticated Private HLS Gateway Tests');
  console.log('===================================================================\n');

  let passed = 0;
  let failed = 0;
  const results: Array<{ name: string; status: 'PASS' | 'FAIL'; detail: string }> = [];

  function record(testName: string, ok: boolean, detail: string) {
    if (ok) {
      passed++;
      results.push({ name: testName, status: 'PASS', detail });
      console.log(`[PASS] ${testName}`);
    } else {
      failed++;
      results.push({ name: testName, status: 'FAIL', detail });
      console.error(`[FAIL] ${testName} - ${detail}`);
    }
  }

  // Seed fixture data
  const LESSON_ID = 'lesson-uuid-101';
  const COURSE_ID = 'course-uuid-202';
  const TEACHER_ID = 'teacher-uuid-303';
  const STUDENT_ID = 'student-uuid-404';
  const UNAUTHORIZED_STUDENT_ID = 'student-uuid-999';
  const UPLOAD_ID = 'upload-uuid-505';

  const ATTEMPT_PREFIX = `videos/${UPLOAD_ID}/attempts/1/hls/`;
  const MASTER_KEY = `${ATTEMPT_PREFIX}master.m3u8`;
  const VARIANT_KEY = `${ATTEMPT_PREFIX}1080p/index.m3u8`;
  const SEGMENT_KEY = `${ATTEMPT_PREFIX}1080p/1080p_000.ts`;

  mockDb.courses.set(COURSE_ID, {
    id: COURSE_ID,
    title: 'Advanced Mathematics',
    teacherId: TEACHER_ID,
    institutionId: 'inst-001',
    status: 'PUBLISHED'
  });

  mockDb.lessons.set(LESSON_ID, {
    id: LESSON_ID,
    title: 'Calculus Fundamentals',
    courseId: COURSE_ID,
    videoUrl: MASTER_KEY
  });

  mockDb.enrollments.set('enr-1', {
    id: 'enr-1',
    studentId: STUDENT_ID,
    courseId: COURSE_ID
  });

  mockDb.videoUploads.set(UPLOAD_ID, {
    id: UPLOAD_ID,
    status: 'COMPLETED',
    storagePath: MASTER_KEY
  });

  // Populate mock R2 storage
  const sampleMasterContent = `#EXTM3U\n#EXT-X-VERSION:3\n#EXT-X-STREAM-INF:BANDWIDTH=5200000,RESOLUTION=1920x1080\n1080p/index.m3u8\n`;
  const sampleVariantContent = `#EXTM3U\n#EXT-X-VERSION:3\n#EXT-X-TARGETDURATION:4\n#EXTINF:4.000000,\n1080p_000.ts\n#EXT-X-ENDLIST\n`;
  const sampleSegmentBytes = Buffer.from('G@\x10\x11TS_PACKET_SYNTHETIC_VIDEO_DATA');

  mockR2Storage.set(MASTER_KEY, { buffer: Buffer.from(sampleMasterContent, 'utf8'), contentType: 'application/vnd.apple.mpegurl' });
  mockR2Storage.set(VARIANT_KEY, { buffer: Buffer.from(sampleVariantContent, 'utf8'), contentType: 'application/vnd.apple.mpegurl' });
  mockR2Storage.set(SEGMENT_KEY, { buffer: sampleSegmentBytes, contentType: 'video/mp2t' });

  // Token fixtures
  const studentToken = jwt.sign({ userId: STUDENT_ID, role: 'ONLINE_STUDENT', email: 's@test.com' }, TEST_JWT_SECRET);
  const unauthStudentToken = jwt.sign({ userId: UNAUTHORIZED_STUDENT_ID, role: 'ONLINE_STUDENT', email: 'u@test.com' }, TEST_JWT_SECRET);
  const teacherToken = jwt.sign({ userId: TEACHER_ID, role: 'TEACHER', email: 't@test.com' }, TEST_JWT_SECRET);
  const videoTicketToken = jwt.sign({ userId: STUDENT_ID, lessonId: LESSON_ID, purpose: 'video-stream' }, TEST_JWT_SECRET);

  // -------------------------------------------------------------
  // Section A: Authentication
  // -------------------------------------------------------------

  // 1. Unauthenticated request rejected
  {
    const req = createMockRequest({});
    const res = createMockResponse();
    let nextCalled = false;
    verifyToken(req, res as any, () => { nextCalled = true; });
    const ok = res.statusCode === 401 && nextCalled === false && res.body?.message?.includes('token required');
    record('Test 1: unauthenticated request rejected (401)', ok, `status=${res.statusCode}`);
  }

  // 2. Authenticated authorized user allowed
  {
    const req = createMockRequest({
      headers: { authorization: `Bearer ${studentToken}` },
      params: { id: LESSON_ID, 0: 'master.m3u8' }
    });
    const res = createMockResponse();
    let nextCalled = false;
    await verifyToken(req, res as any, () => { nextCalled = true; });
    await streamLessonHls(req, res as any);
    const ok = nextCalled === true && res.statusCode === 200 && typeof res.body === 'string' && res.body.includes('#EXTM3U');
    record('Test 2: authenticated authorized user allowed (200)', ok, `status=${res.statusCode}, nextCalled=${nextCalled}, isStr=${typeof res.body === 'string'}, body=${JSON.stringify(res.body)}`);
  }

  // -------------------------------------------------------------
  // Section B: Authorization
  // -------------------------------------------------------------

  // 3. Authenticated but unauthorized user rejected
  {
    const req = createMockRequest({
      user: { userId: UNAUTHORIZED_STUDENT_ID, role: 'ONLINE_STUDENT' },
      params: { id: LESSON_ID, 0: 'master.m3u8' }
    });
    const res = createMockResponse();
    await streamLessonHls(req, res as any);
    const ok = res.statusCode === 403 && res.body?.message?.includes('Not enrolled');
    record('Test 3: authenticated but unauthorized user rejected (403)', ok, `status=${res.statusCode}`);
  }

  // 4. Authorization failure does not reveal object existence
  {
    // Request a file that DOES NOT exist in R2 with unauthorized user
    const req = createMockRequest({
      user: { userId: UNAUTHORIZED_STUDENT_ID, role: 'ONLINE_STUDENT' },
      params: { id: LESSON_ID, 0: 'non_existent_file.m3u8' }
    });
    const res = createMockResponse();
    await streamLessonHls(req, res as any);
    // Must return 403, NOT 404
    const ok = res.statusCode === 403;
    record('Test 4: authorization failure does not reveal object existence (returns 403 not 404)', ok, `status=${res.statusCode}`);
  }

  // -------------------------------------------------------------
  // Section C: Path Security
  // -------------------------------------------------------------

  // 5. Normal master.m3u8 path accepted
  {
    const req = createMockRequest({
      user: { userId: STUDENT_ID, role: 'ONLINE_STUDENT' },
      params: { id: LESSON_ID, 0: 'master.m3u8' }
    });
    const res = createMockResponse();
    await streamLessonHls(req, res as any);
    const ok = res.statusCode === 200 && res.headers['content-type'] === 'application/vnd.apple.mpegurl';
    record('Test 5: normal master.m3u8 path accepted', ok, `status=${res.statusCode}`);
  }

  // 6. Normal variant playlist accepted
  {
    const req = createMockRequest({
      user: { userId: STUDENT_ID, role: 'ONLINE_STUDENT' },
      params: { id: LESSON_ID, 0: '1080p/index.m3u8' }
    });
    const res = createMockResponse();
    await streamLessonHls(req, res as any);
    const ok = res.statusCode === 200 && res.headers['content-type'] === 'application/vnd.apple.mpegurl' && res.body.includes('1080p_000.ts');
    record('Test 6: normal variant playlist accepted', ok, `status=${res.statusCode}`);
  }

  // 7. Normal .ts segment accepted
  {
    const req = createMockRequest({
      user: { userId: STUDENT_ID, role: 'ONLINE_STUDENT' },
      params: { id: LESSON_ID, 0: '1080p/1080p_000.ts' }
    });
    const res = createMockResponse();
    await streamLessonHls(req, res as any);
    const ok = (res.statusCode === 200 || res.statusCode === 206) && res.headers['content-type'] === 'video/mp2t';
    record('Test 7: normal .ts segment accepted', ok, `status=${res.statusCode}, type=${res.headers['content-type']}`);
  }

  // 8. ../ traversal rejected
  {
    const req = createMockRequest({
      user: { userId: STUDENT_ID, role: 'ONLINE_STUDENT' },
      params: { id: LESSON_ID, 0: '../secret.m3u8' }
    });
    const res = createMockResponse();
    await streamLessonHls(req, res as any);
    const ok = res.statusCode === 400 && res.body?.message?.includes('traversal');
    record('Test 8: ../ traversal rejected (400)', ok, `status=${res.statusCode}`);
  }

  // 9. Encoded traversal rejected
  {
    const req = createMockRequest({
      user: { userId: STUDENT_ID, role: 'ONLINE_STUDENT' },
      params: { id: LESSON_ID, 0: '%2e%2e%2f%2e%2e%2fsecret.m3u8' }
    });
    const res = createMockResponse();
    await streamLessonHls(req, res as any);
    const ok = res.statusCode === 400 && res.body?.message?.includes('traversal');
    record('Test 9: encoded traversal rejected (400)', ok, `status=${res.statusCode}`);
  }

  // 10. Absolute path rejected
  {
    const req = createMockRequest({
      user: { userId: STUDENT_ID, role: 'ONLINE_STUDENT' },
      params: { id: LESSON_ID, 0: '/etc/passwd.m3u8' }
    });
    const res = createMockResponse();
    await streamLessonHls(req, res as any);
    const ok = res.statusCode === 400 && res.body?.message?.includes('traversal');
    record('Test 10: absolute path rejected (400)', ok, `status=${res.statusCode}`);
  }

  // 11. Arbitrary unrelated object key rejected
  {
    const req = createMockRequest({
      user: { userId: STUDENT_ID, role: 'ONLINE_STUDENT' },
      params: { id: LESSON_ID, 0: 'package.json' }
    });
    const res = createMockResponse();
    await streamLessonHls(req, res as any);
    const ok = res.statusCode === 400 && res.body?.message?.includes('Unsupported media format');
    record('Test 11: arbitrary unrelated object key rejected (400)', ok, `status=${res.statusCode}`);
  }

  // 12. Prefix escape attempt rejected
  {
    const req = createMockRequest({
      user: { userId: STUDENT_ID, role: 'ONLINE_STUDENT' },
      params: { id: LESSON_ID, 0: '1080p/../../attempts/2/hls/master.m3u8' }
    });
    const res = createMockResponse();
    await streamLessonHls(req, res as any);
    const ok = res.statusCode === 400;
    record('Test 12: prefix escape attempt rejected (400)', ok, `status=${res.statusCode}`);
  }

  // -------------------------------------------------------------
  // Section D: Storage Boundary
  // -------------------------------------------------------------

  // 13. Gateway requests only the expected lesson HLS prefix
  {
    let requestedR2Key = '';
    setHlsStreamProviderForTests(async (key: string) => {
      requestedR2Key = key;
      return { stream: Readable.from(Buffer.from('#EXTM3U')), statusCode: 200 };
    });

    const req = createMockRequest({
      user: { userId: STUDENT_ID, role: 'ONLINE_STUDENT' },
      params: { id: LESSON_ID, 0: 'master.m3u8' }
    });
    const res = createMockResponse();
    await streamLessonHls(req, res as any);

    const ok = requestedR2Key === MASTER_KEY && requestedR2Key.startsWith(ATTEMPT_PREFIX);
    record('Test 13: gateway requests only the expected lesson HLS prefix', ok, `key=${requestedR2Key}`);

    // Restore standard mock provider
    setHlsStreamProviderForTests(async (key: string, range?: string) => {
      const item = mockR2Storage.get(key);
      if (!item) return null;
      return { stream: Readable.from(item.buffer), contentType: item.contentType, statusCode: 200 };
    });
  }

  // 14. Raw source object cannot be requested through HLS route
  {
    const req = createMockRequest({
      user: { userId: STUDENT_ID, role: 'ONLINE_STUDENT' },
      params: { id: LESSON_ID, 0: 'source.mp4' }
    });
    const res = createMockResponse();
    await streamLessonHls(req, res as any);
    const ok = res.statusCode === 400 && res.body?.message?.includes('Unsupported media format');
    record('Test 14: raw source object cannot be requested through HLS route (400)', ok, `status=${res.statusCode}`);
  }

  // 15. Another lesson's HLS object cannot be requested
  {
    // Try to request lesson 2's HLS package using lesson 1's route
    const req = createMockRequest({
      user: { userId: STUDENT_ID, role: 'ONLINE_STUDENT' },
      params: { id: LESSON_ID, 0: '../lesson-999/hls/master.m3u8' }
    });
    const res = createMockResponse();
    await streamLessonHls(req, res as any);
    const ok = res.statusCode === 400;
    record("Test 15: another lesson's HLS object cannot be requested through route", ok, `status=${res.statusCode}`);
  }

  // -------------------------------------------------------------
  // Section E: Content Handling
  // -------------------------------------------------------------

  // 16. Master/variant playlist returns HLS content type
  {
    const req = createMockRequest({
      user: { userId: STUDENT_ID, role: 'ONLINE_STUDENT' },
      params: { id: LESSON_ID, 0: 'master.m3u8' }
    });
    const res = createMockResponse();
    await streamLessonHls(req, res as any);
    const ok = res.headers['content-type'] === 'application/vnd.apple.mpegurl';
    record('Test 16: master/variant playlist returns HLS content type', ok, `content-type=${res.headers['content-type']}`);
  }

  // 17. .ts returns video/mp2t
  {
    const req = createMockRequest({
      user: { userId: STUDENT_ID, role: 'ONLINE_STUDENT' },
      params: { id: LESSON_ID, 0: '1080p/1080p_000.ts' }
    });
    const res = createMockResponse();
    await streamLessonHls(req, res as any);
    const ok = res.headers['content-type'] === 'video/mp2t';
    record('Test 17: .ts returns video/mp2t', ok, `content-type=${res.headers['content-type']}`);
  }

  // 18. Storage 404 is handled safely
  {
    const req = createMockRequest({
      user: { userId: STUDENT_ID, role: 'ONLINE_STUDENT' },
      params: { id: LESSON_ID, 0: '1080p/missing_segment_999.ts' }
    });
    const res = createMockResponse();
    await streamLessonHls(req, res as any);
    const ok = res.statusCode === 404 && res.body?.message?.includes('not found');
    record('Test 18: storage 404 is handled safely (404)', ok, `status=${res.statusCode}`);
  }

  // 19. Storage failure does not expose internal exception details
  {
    setHlsStreamProviderForTests(async () => {
      throw new Error('Secret internal S3 bucket timeout on endpoint: secret-bucket.internal');
    });

    const req = createMockRequest({
      user: { userId: STUDENT_ID, role: 'ONLINE_STUDENT' },
      params: { id: LESSON_ID, 0: 'master.m3u8' }
    });
    const res = createMockResponse();
    await streamLessonHls(req, res as any);

    // Response must not contain "secret-bucket.internal"
    const bodyStr = JSON.stringify(res.body || {});
    const ok = res.statusCode === 500 && !bodyStr.includes('secret-bucket') && !bodyStr.includes('timeout');
    record('Test 19: storage failure does not expose internal exception details', ok, `status=${res.statusCode}, leaked=${bodyStr.includes('secret')}`);

    // Restore standard mock provider
    setHlsStreamProviderForTests(async (key: string) => {
      const item = mockR2Storage.get(key);
      if (!item) return null;
      return { stream: Readable.from(item.buffer), contentType: item.contentType, statusCode: 200 };
    });
  }

  // -------------------------------------------------------------
  // Section F: Playlist Behavior & Rewriting
  // -------------------------------------------------------------

  // 20. Verify served playlist references remain gateway-safe with token query
  {
    const SESSION_TOKEN = 'sample-viewing-session-token-xyz';
    const req = createMockRequest({
      user: { userId: STUDENT_ID, role: 'ONLINE_STUDENT' },
      query: { token: SESSION_TOKEN },
      params: { id: LESSON_ID, 0: 'master.m3u8' }
    });
    const res = createMockResponse();
    await streamLessonHls(req, res as any);

    const servedPlaylist = String(res.body);
    const hasRewrittenVariant = servedPlaylist.includes(`1080p/index.m3u8?token=${SESSION_TOKEN}`);
    const noDirectR2 = !servedPlaylist.includes('r2.cloudflarestorage.com') && !servedPlaylist.includes('https://');

    const ok = res.statusCode === 200 && hasRewrittenVariant && noDirectR2;
    record('Test 20: playlist references remain gateway-safe with appended token', ok, `rewritten=${hasRewrittenVariant}`);
  }

  // 21. Verify no private R2 URL is leaked to the browser
  {
    const req = createMockRequest({
      user: { userId: STUDENT_ID, role: 'ONLINE_STUDENT' },
      params: { id: LESSON_ID, 0: '1080p/index.m3u8' }
    });
    const res = createMockResponse();
    await streamLessonHls(req, res as any);

    const manifestText = String(res.body);
    const headersStr = JSON.stringify(res.headers);
    const leaked = manifestText.includes('r2.cloudflarestorage') || headersStr.includes('r2.cloudflarestorage') ||
                   manifestText.includes('platform-videos-prod') || headersStr.includes('platform-videos-prod');

    const ok = res.statusCode === 200 && !leaked;
    record('Test 21: no private R2 URL or credentials leaked to browser', ok, `clean=${!leaked}`);
  }

  // -------------------------------------------------------------
  // Section G: Idempotence & Security
  // -------------------------------------------------------------

  // 22. Repeated authorized requests remain safe
  {
    let allOk = true;
    for (let i = 0; i < 5; i++) {
      const req = createMockRequest({
        user: { userId: STUDENT_ID, role: 'ONLINE_STUDENT' },
        params: { id: LESSON_ID, 0: '1080p/1080p_000.ts' }
      });
      const res = createMockResponse();
      await streamLessonHls(req, res as any);
      if (res.statusCode !== 200 || res.headers['content-type'] !== 'video/mp2t') {
        allOk = false;
      }
    }
    record('Test 22: repeated authorized requests remain safe and idempotent', allOk, `success=5/5`);
  }

  // 23. Video ticket stream endpoint check (purpose: 'video-stream')
  {
    const req = createMockRequest({
      headers: { authorization: `Bearer ${videoTicketToken}` },
      path: `/api/courses/lessons/${LESSON_ID}/hls/master.m3u8`,
      params: { id: LESSON_ID, 0: 'master.m3u8' }
    });
    const res = createMockResponse();
    let nextCalled = false;
    verifyToken(req, res as any, () => { nextCalled = true; });
    await streamLessonHls(req, res as any);

    const ok = nextCalled === true && res.statusCode === 200 && res.headers['content-type'] === 'application/vnd.apple.mpegurl';
    record("Test 23: video stream ticket (purpose: 'video-stream') authenticated on HLS gateway", ok, `status=${res.statusCode}`);
  }

  // -------------------------------------------------------------
  // Section H: Phase 2C.1.1 Token Transport Hardening Tests
  // -------------------------------------------------------------

  async function executeGatewayRequest(req: AuthRequest, res: MockResponseStream) {
    let proceed = false;
    await verifyToken(req, res as any, () => { proceed = true; });
    if (proceed) {
      await streamLessonHls(req, res as any);
    }
  }

  // 24. Authorization header token accesses master playlist WITHOUT appending query token
  {
    const req = createMockRequest({
      headers: { authorization: `Bearer ${studentToken}` },
      params: { id: LESSON_ID, 0: 'master.m3u8' }
    });
    const res = createMockResponse();
    await executeGatewayRequest(req, res);

    const manifestText = String(res.body);
    const hasRewrittenToken = manifestText.includes('?token=');
    const hasVariantLine = manifestText.includes('1080p/index.m3u8');
    const ok = res.statusCode === 200 && !hasRewrittenToken && hasVariantLine;
    record('Test 24: Authorization header accesses master playlist with ZERO token in manifest URLs', ok, `hasTokenInManifest=${hasRewrittenToken}`);
  }

  // 25. Authorization header token accesses variant playlist WITHOUT appending query token
  {
    const req = createMockRequest({
      headers: { authorization: `Bearer ${studentToken}` },
      params: { id: LESSON_ID, 0: '1080p/index.m3u8' }
    });
    const res = createMockResponse();
    await executeGatewayRequest(req, res);

    const manifestText = String(res.body);
    const hasRewrittenToken = manifestText.includes('?token=');
    const hasSegmentLine = manifestText.includes('1080p_000.ts');
    const ok = res.statusCode === 200 && !hasRewrittenToken && hasSegmentLine;
    record('Test 25: Authorization header accesses variant playlist with ZERO token in manifest URLs', ok, `hasTokenInManifest=${hasRewrittenToken}`);
  }

  // 26. Authorization header token accesses segment with 200/206 and correct headers
  {
    const req = createMockRequest({
      headers: {
        authorization: `Bearer ${studentToken}`,
        range: 'bytes=0-10'
      },
      params: { id: LESSON_ID, 0: '1080p/1080p_000.ts' }
    });
    const res = createMockResponse();
    await executeGatewayRequest(req, res);

    const ok = (res.statusCode === 200 || res.statusCode === 206) &&
      res.headers['content-type'] === 'video/mp2t' &&
      res.headers['cache-control']?.toString().includes('private');
    record('Test 26: Authorization header token accesses .ts segment with private cache headers', ok, `status=${res.statusCode}, body=${JSON.stringify(res.body)}`);
  }

  // 27. Invalid Authorization header token is rejected (401)
  {
    const req = createMockRequest({
      headers: { authorization: 'Bearer invalid.tampered.token.here' },
      params: { id: LESSON_ID, 0: 'master.m3u8' }
    });
    const res = createMockResponse();
    let nextCalled = false;
    verifyToken(req, res as any, () => { nextCalled = true; });
    const ok = res.statusCode === 401 && nextCalled === false && res.body?.message?.includes('Invalid or expired');
    record('Test 27: invalid Authorization header token is rejected (401)', ok, `status=${res.statusCode}`);
  }

  // 28. Expired Authorization header token is rejected (401)
  {
    const expiredToken = jwt.sign(
      { userId: STUDENT_ID, role: 'ONLINE_STUDENT', exp: Math.floor(Date.now() / 1000) - 30 },
      TEST_JWT_SECRET
    );
    const req = createMockRequest({
      headers: { authorization: `Bearer ${expiredToken}` },
      params: { id: LESSON_ID, 0: 'master.m3u8' }
    });
    const res = createMockResponse();
    let nextCalled = false;
    verifyToken(req, res as any, () => { nextCalled = true; });
    const ok = res.statusCode === 401 && nextCalled === false;
    record('Test 28: expired Authorization header token is rejected (401)', ok, `status=${res.statusCode}`);
  }

  // 29. Nested playlist/segment requests do not require a new token (same token works across all levels)
  {
    const singleToken = studentToken;
    let masterOk = false;
    let variantOk = false;
    let segmentOk = false;

    // Master
    {
      const req = createMockRequest({
        headers: { authorization: `Bearer ${singleToken}` },
        params: { id: LESSON_ID, 0: 'master.m3u8' }
      });
      const res = createMockResponse();
      await executeGatewayRequest(req, res);
      masterOk = res.statusCode === 200;
    }

    // Variant
    {
      const req = createMockRequest({
        headers: { authorization: `Bearer ${singleToken}` },
        params: { id: LESSON_ID, 0: '1080p/index.m3u8' }
      });
      const res = createMockResponse();
      await executeGatewayRequest(req, res);
      variantOk = res.statusCode === 200;
    }

    // Segment
    {
      const req = createMockRequest({
        headers: { authorization: `Bearer ${singleToken}` },
        params: { id: LESSON_ID, 0: '1080p/1080p_000.ts' }
      });
      const res = createMockResponse();
      await executeGatewayRequest(req, res);
      segmentOk = res.statusCode === 200 || res.statusCode === 206;
    }

    const ok = masterOk && variantOk && segmentOk;
    record('Test 29: single token works across master, variant, and segment without issuing new tokens', ok, `master=${masterOk}, variant=${variantOk}, segment=${segmentOk}`);
  }

  // 30. Token is never included in error responses (401, 403, 404, 500)
  {
    const secretTokenPattern = 'SECRET_TEST_TOKEN_VALUE_ABC123';
    const errorResponses: string[] = [];

    // 401
    {
      const req = createMockRequest({ headers: { authorization: `Bearer ${secretTokenPattern}` } });
      const res = createMockResponse();
      verifyToken(req, res as any, () => {});
      errorResponses.push(JSON.stringify(res.body || {}));
    }

    // 403
    {
      const req = createMockRequest({
        user: { userId: UNAUTHORIZED_STUDENT_ID, role: 'ONLINE_STUDENT' },
        query: { token: secretTokenPattern },
        params: { id: LESSON_ID, 0: 'master.m3u8' }
      });
      const res = createMockResponse();
      await streamLessonHls(req, res as any);
      errorResponses.push(JSON.stringify(res.body || {}));
    }

    // 404
    {
      const req = createMockRequest({
        user: { userId: STUDENT_ID, role: 'ONLINE_STUDENT' },
        query: { token: secretTokenPattern },
        params: { id: 'non-existent-lesson-id', 0: 'master.m3u8' }
      });
      const res = createMockResponse();
      await streamLessonHls(req, res as any);
      errorResponses.push(JSON.stringify(res.body || {}));
    }

    const anyLeaked = errorResponses.some(body => body.includes(secretTokenPattern));
    const ok = !anyLeaked;
    record('Test 30: credentials and tokens are never included in error response bodies', ok, `leaked=${anyLeaked}`);
  }

  // 31. If query token is provided without Authorization header, propagated token is EXACTLY the authenticated existing ticket and NO new token is generated
  {
    const existingTicket = videoTicketToken;
    const req = createMockRequest({
      user: { userId: STUDENT_ID, lessonId: LESSON_ID, purpose: 'video-stream' },
      query: { token: existingTicket },
      params: { id: LESSON_ID, 0: 'master.m3u8' }
    });
    const res = createMockResponse();
    await streamLessonHls(req, res as any);

    const manifestText = String(res.body);
    const encodedTicket = encodeURIComponent(existingTicket);
    const containsExactTicket = manifestText.includes(`1080p/index.m3u8?token=${encodedTicket}`);

    // Verify no OTHER new JWT was generated (must only contain the exact ticket)
    const tokenMatches = manifestText.match(/token=([^&\s\n]+)/g);
    const allMatchesIdentical = tokenMatches !== null && tokenMatches.every(m => m === `token=${encodedTicket}`);

    const ok = res.statusCode === 200 && containsExactTicket && allMatchesIdentical;
    record('Test 31: query-token propagation uses exactly the authenticated ticket without generating new tokens', ok, `matches=${tokenMatches?.length}, identical=${allMatchesIdentical}`);
  }

  console.log('\n===================================================================');
  console.log(`Results: ${passed} Passed, ${failed} Failed (Total ${passed + failed})`);
  console.log('===================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runTestSuite().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
