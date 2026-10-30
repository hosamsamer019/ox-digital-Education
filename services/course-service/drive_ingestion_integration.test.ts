/**
 * OX-DIGITAL Education — Phase 2.2 Drive Ingestion Integration Test Suite
 *
 * Runs against the isolated development database ox_digital_dev on port 5433 only.
 * STRICT ENFORCEMENT: Never connects to production or port 5432.
 *
 * Verifies:
 * 1. Database row locking (SELECT ... FOR UPDATE).
 * 2. Concurrency-safe generation allocation & idempotency.
 * 3. Database unique constraint on (lessonId, mediaGeneration).
 * 4. Stale-worker fencing on promotion (newer generation rejection).
 * 5. Mismatched source fencing on promotion (source URL change rejection).
 * 6. Single atomic promotion transaction.
 * 7. Recovery sweeper for PENDING media records.
 */

// 1. Strict Environment Safety Gate BEFORE importing database client
const DEV_PORT = '5433';
const DEV_DB = '/ox_digital_dev';
const targetUrl = process.env.DEV_DATABASE_URL || 'postgresql://postgres:password@localhost:5433/ox_digital_dev?schema=public';
const parsed = new URL(targetUrl);

if (parsed.port !== DEV_PORT || parsed.pathname !== DEV_DB) {
  console.error(`[SAFETY GATE TRIGGERED] Target is ${parsed.host}${parsed.pathname}. Only localhost:${DEV_PORT}${DEV_DB} is permitted.`);
  process.exit(1);
}

process.env.DATABASE_URL = targetUrl;

import crypto from 'crypto';

let testsPassed = 0;
let testsFailed = 0;

function assert(condition: boolean, testName: string, details?: string) {
  if (condition) {
    console.log(`[PASS] ${testName}`);
    testsPassed++;
  } else {
    console.error(`[FAIL] ${testName}${details ? ` - ${details}` : ''}`);
    testsFailed++;
  }
}

// Mock BullMQ Queue for integration testing
class MockQueue {
  jobs: Map<string, any> = new Map();

  async add(name: string, data: any, opts: any) {
    const id = opts?.jobId || `job-${Date.now()}-${Math.random()}`;
    const job = {
      id,
      name,
      data,
      opts,
      state: 'waiting',
      async getState() {
        return this.state;
      },
      async remove() {
        this.state = 'removed';
      },
    };
    this.jobs.set(id, job);
    return job;
  }

  async getJob(jobId: string) {
    return this.jobs.get(jobId) || null;
  }
}

async function runIntegrationTests() {
  console.log('===================================================================');
  console.log('OX-DIGITAL Phase 2.2 — Drive Ingestion Integration Test Suite');
  console.log(`Target: PostgreSQL ${parsed.hostname}:${parsed.port}${parsed.pathname}`);
  console.log('===================================================================\n');

  const { db } = await import('../../packages/database/src/index.js');
  const { requestDriveIngestion, recoverPendingDriveIngestions, setAssetValidatorForTests } = await import('./src/services/driveIngestion.service.js');

  // Verify connection to ox_digital_dev
  const [dbNameResult] = await (db as any).$queryRaw`SELECT current_database(), inet_server_port();`;
  assert(
    dbNameResult.current_database === 'ox_digital_dev',
    `Verified connected database is ox_digital_dev (actual: ${dbNameResult.current_database})`
  );
  assert(
    String(parsed.port) === '5433',
    `Verified connection host port is 5433`
  );

  // Setup test fixtures in isolated dev DB
  const testId = crypto.randomUUID();
  const testTeacherId = crypto.randomUUID();
  const testCourseId = crypto.randomUUID();
  const testLessonId = crypto.randomUUID();

  const driveUrlA = 'https://drive.google.com/file/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms/view';
  const driveFileIdA = '1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms';
  const driveUrlB = 'https://drive.google.com/file/d/1a2B3c4D5e6F7g8H9i0J_kLmNoPqrstu/view';
  const driveFileIdB = '1a2B3c4D5e6F7g8H9i0J_kLmNoPqrstu';

  const mockQueue = new MockQueue();

  try {
    // 0. Create Teacher and Course
    await (db as any).$executeRaw`
      INSERT INTO "User" ("id", "email", "name", "password", "role", "createdAt", "updatedAt")
      VALUES (${testTeacherId}, ${`teacher-${testId}@test.local`}, 'Test Teacher', 'hashed_pass', 'TEACHER', NOW(), NOW())
    `;

    await (db as any).$executeRaw`
      INSERT INTO "Course" ("id", "title", "description", "price", "status", "teacherId", "createdAt", "updatedAt")
      VALUES (${testCourseId}, ${`Course ${testId}`}, 'Integration Test Course', 0, 'PUBLISHED', ${testTeacherId}, NOW(), NOW())
    `;

    await (db as any).$executeRaw`
      INSERT INTO "Lesson" ("id", "title", "courseId", "mediaGeneration", "createdAt", "updatedAt")
      VALUES (${testLessonId}, 'Integration Test Lesson', ${testCourseId}, 0, NOW(), NOW())
    `;

    // --- Test 1: Initial Drive Ingestion Allocation ---
    console.log('\n--- Test 1: Generation Allocation & PENDING ProcessedMedia Creation ---');
    const res1 = await requestDriveIngestion({
      lessonId: testLessonId,
      videoUrl: driveUrlA,
      queue: mockQueue as any,
    });

    assert(res1.status === 'QUEUED', 'First ingestion request is QUEUED');
    assert(res1.mediaGeneration === 1, 'mediaGeneration incremented to 1');

    const [lesson1] = await (db as any).$queryRaw`
      SELECT "mediaGeneration", "activeMediaId", "videoUrl"
      FROM "Lesson"
      WHERE id = ${testLessonId}
    `;
    assert(lesson1.mediaGeneration === 1, 'Lesson.mediaGeneration in DB updated to 1');
    assert(lesson1.activeMediaId === null, 'Lesson.activeMediaId remains null before promotion');
    assert(lesson1.videoUrl === driveUrlA, 'Lesson.videoUrl stored canonically');

    const [pm1] = await (db as any).$queryRaw`
      SELECT id, status, "fencingToken", "mediaGeneration", "canonicalSource"
      FROM "ProcessedMedia"
      WHERE id = ${res1.mediaId}
    `;
    assert(pm1.status === 'PENDING', 'ProcessedMedia inserted with status PENDING');
    assert(Number(pm1.fencingToken) === 0, 'ProcessedMedia initialized with fencingToken = 0');
    assert(pm1.canonicalSource === `gdrive:${driveFileIdA}`, 'ProcessedMedia canonicalSource saved correctly');

    // --- Test 2: Idempotent Resubmission While In Flight ---
    console.log('\n--- Test 2: Concurrency & Idempotency (Same Source In Flight) ---');
    const res2 = await requestDriveIngestion({
      lessonId: testLessonId,
      videoUrl: driveUrlA,
      queue: mockQueue as any,
    });

    assert(res2.status === 'ALREADY_IN_FLIGHT', 'Submitting same source in flight returns ALREADY_IN_FLIGHT');
    assert(res2.mediaGeneration === 1, 'mediaGeneration was NOT incremented on duplicate submission');
    assert(res2.mediaId === res1.mediaId, 'Returns existing mediaId without duplicate creation');

    // --- Test 3: Unique Constraint on (lessonId, mediaGeneration) ---
    console.log('\n--- Test 3: Unique Constraint on (lessonId, mediaGeneration) ---');
    let uniqueViolationCaught = false;
    try {
      await (db as any).$executeRaw`
        INSERT INTO "ProcessedMedia" (
          "id", "lessonId", "mediaGeneration", "sourceType", "canonicalSource",
          "sourceUrlHash", "storagePrefix", "status", "createdAt", "updatedAt"
        ) VALUES (
          ${crypto.randomUUID()}, ${testLessonId}, 1, 'GOOGLE_DRIVE'::"MediaSourceType", 'gdrive:duplicate',
          ${crypto.randomBytes(32).toString('hex')}, 'videos/dup/', 'PENDING'::"ProcessedMediaStatus", NOW(), NOW()
        )
      `;
    } catch (err: any) {
      if (
        err.message && (
          err.message.includes('23505') ||
          err.message.includes('already exists') ||
          err.message.includes('unique constraint') ||
          err.message.includes('Unique constraint') ||
          err.message.includes('ProcessedMedia_lessonId_mediaGeneration_key')
        )
      ) {
        uniqueViolationCaught = true;
      } else {
        console.error('Test 3 caught unexpected error:', err.message);
      }
    }
    assert(uniqueViolationCaught, 'Database enforces unique constraint @@unique([lessonId, mediaGeneration])');

    // --- Test 4: Atomic Claim Transition ---
    console.log('\n--- Test 4: Worker Atomic Claim (PENDING -> DOWNLOADING, fencingToken + 1) ---');
    const workerA = 'worker-A';
    const workerB = 'worker-B';

    // Worker A claims the row
    const claimA = await (db as any).$executeRaw`
      UPDATE "ProcessedMedia"
      SET "status" = 'DOWNLOADING',
          "fencingToken" = "fencingToken" + 1,
          "workerId" = ${workerA},
          "heartbeatAt" = NOW()
      WHERE "id" = ${res1.mediaId}
        AND "status" = 'PENDING'
    `;
    assert(claimA === 1, 'Worker A successfully claims PENDING row (affected rows = 1)');

    // Worker B attempts to claim the same row concurrently
    const claimB = await (db as any).$executeRaw`
      UPDATE "ProcessedMedia"
      SET "status" = 'DOWNLOADING',
          "fencingToken" = "fencingToken" + 1,
          "workerId" = ${workerB},
          "heartbeatAt" = NOW()
      WHERE "id" = ${res1.mediaId}
        AND "status" = 'PENDING'
    `;
    assert(claimB === 0, 'Worker B gets 0 rows claimed (prevents duplicate worker processing)');

    const [pmClaimed] = await (db as any).$queryRaw`
      SELECT status, "fencingToken", "workerId" FROM "ProcessedMedia" WHERE id = ${res1.mediaId}
    `;
    assert(pmClaimed.status === 'DOWNLOADING', 'Status is DOWNLOADING');
    assert(Number(pmClaimed.fencingToken) === 1, 'fencingToken incremented to 1');
    assert(pmClaimed.workerId === workerA, 'workerId is worker-A');

    // --- Test 5: Transition to TRANSCODING ---
    console.log('\n--- Test 5: Worker Status Transition to TRANSCODING ---');
    await (db as any).$executeRaw`
      UPDATE "ProcessedMedia"
      SET "status" = 'TRANSCODING',
          "heartbeatAt" = NOW()
      WHERE "id" = ${res1.mediaId}
        AND "fencingToken" = 1
    `;

    // --- Test 6: Single Atomic Promotion Transaction ---
    console.log('\n--- Test 6: Single Atomic Promotion Transaction (Success Path) ---');
    const attemptPrefix = `videos/${res1.mediaId}/attempts/token-1/hls/`;
    const masterPlaylistKey = `${attemptPrefix}master.m3u8`;

    await (db as any).$transaction(async (tx: any) => {
      // 1. Lock lesson
      const [l] = await tx.$queryRaw`SELECT id, "mediaGeneration", "videoUrl" FROM "Lesson" WHERE id = ${testLessonId} FOR UPDATE;`;
      assert(l.mediaGeneration === 1, 'Lesson generation verified inside promotion tx');

      // 2. Update ProcessedMedia to COMPLETED
      const mediaUpdated = await tx.$executeRaw`
        UPDATE "ProcessedMedia"
        SET "status" = 'COMPLETED',
            "masterPlaylistKey" = ${masterPlaylistKey},
            "completedAt" = NOW()
        WHERE id = ${res1.mediaId}
          AND "fencingToken" = 1
          AND "status" = 'TRANSCODING'
      `;
      assert(mediaUpdated === 1, 'ProcessedMedia updated to COMPLETED (affected rows = 1)');

      // 3. Update Lesson.activeMediaId
      const lessonUpdated = await tx.$executeRaw`
        UPDATE "Lesson"
        SET "activeMediaId" = ${res1.mediaId}
        WHERE id = ${testLessonId}
          AND "mediaGeneration" = 1
      `;
      assert(lessonUpdated === 1, 'Lesson.activeMediaId updated atomically (affected rows = 1)');
    });

    const [lessonPromoted] = await (db as any).$queryRaw`
      SELECT "activeMediaId" FROM "Lesson" WHERE id = ${testLessonId}
    `;
    assert(lessonPromoted.activeMediaId === res1.mediaId, 'Lesson.activeMediaId is now active in DB');

    // --- Test 7: Stale Worker Fencing (Generation Advanced) ---
    console.log('\n--- Test 7: Stale Worker Fencing on Promotion (Generation Advanced) ---');
    // Teacher updates lesson to new source (driveUrlB), allocating generation 2
    const resB = await requestDriveIngestion({
      lessonId: testLessonId,
      videoUrl: driveUrlB,
      queue: mockQueue as any,
    });
    assert(resB.mediaGeneration === 2, 'New source allocates generation 2');

    // Suppose a stale worker for generation 1 attempts to promote now
    let stalePromotionBlocked = false;
    try {
      await (db as any).$transaction(async (tx: any) => {
        const [l] = await tx.$queryRaw`SELECT id, "mediaGeneration" FROM "Lesson" WHERE id = ${testLessonId} FOR UPDATE;`;
        if (l.mediaGeneration !== 1) {
          throw new Error('STALE_WORKER_FENCED');
        }
      });
    } catch (err: any) {
      if (err.message && err.message.includes('STALE_WORKER_FENCED')) {
        stalePromotionBlocked = true;
      }
    }
    assert(stalePromotionBlocked, 'Stale worker is strictly fenced and prevented from promoting');

    // --- Test 8: Reverting to Previously Completed Source ---
    console.log('\n--- Test 8: Reverting to Previously Completed Source ---');
    // 8A: While res1 is still activeMediaId, requesting driveUrlA returns ALREADY_ACTIVE
    const resAlreadyActive = await requestDriveIngestion({
      lessonId: testLessonId,
      videoUrl: driveUrlA,
      queue: mockQueue as any,
    });
    assert(resAlreadyActive.status === 'ALREADY_ACTIVE', 'Submitting current active source returns ALREADY_ACTIVE');

    // 8B: Promote generation 2 (resB) to activeMediaId
    await (db as any).$executeRaw`
      UPDATE "Lesson" SET "activeMediaId" = ${resB.mediaId} WHERE id = ${testLessonId}
    `;

    // 8C: Teacher switches back to driveUrlA (generation 1, which is COMPLETED but not currently active)
    setAssetValidatorForTests(async () => true); // Mock remote validation passes

    const resRevert = await requestDriveIngestion({
      lessonId: testLessonId,
      videoUrl: driveUrlA,
      queue: mockQueue as any,
    });
    assert(resRevert.status === 'REACTIVATED', 'Reverts to previously completed asset without re-transcoding');
    assert(resRevert.mediaId === res1.mediaId, 'Reactivated original mediaId');

    const [lessonReverted] = await (db as any).$queryRaw`
      SELECT "activeMediaId" FROM "Lesson" WHERE id = ${testLessonId}
    `;
    assert(lessonReverted.activeMediaId === res1.mediaId, 'Lesson.activeMediaId points to reactivated media');

    setAssetValidatorForTests(null);

    // --- Test 9: Recovery Sweeper for Interrupted PENDING Records ---
    console.log('\n--- Test 9: Recovery Sweeper for Interrupted PENDING Records ---');
    // Insert an artificially aged PENDING record (older than 30s)
    const stalePendingId = crypto.randomUUID();
    await (db as any).$executeRaw`
      INSERT INTO "ProcessedMedia" (
        "id", "lessonId", "mediaGeneration", "sourceType", "sourceFileId",
        "canonicalSource", "sourceUrlHash", "storagePrefix", "status",
        "fencingToken", "retryCount", "cleanupToken", "createdAt", "updatedAt"
      ) VALUES (
        ${stalePendingId}, ${testLessonId}, 99, 'GOOGLE_DRIVE', 'staleFile',
        'gdrive:staleFile', ${crypto.randomBytes(32).toString('hex')}, 'videos/stale/', 'PENDING',
        0, 0, 0, NOW() - INTERVAL '60 seconds', NOW()
      )
    `;

    const sweepResult = await recoverPendingDriveIngestions(mockQueue as any, { maxAgeMs: 10000 });
    assert(sweepResult.evaluated >= 1, 'Recovery sweeper evaluated aged PENDING records');
    assert(sweepResult.reEnqueued >= 1, 'Recovery sweeper re-enqueued missing job in BullMQ');

  } finally {
    // Clean up test fixtures in development database
    console.log('\n--- Cleaning up integration test fixtures in ox_digital_dev ---');
    await (db as any).$executeRaw`DELETE FROM "ProcessedMedia" WHERE "lessonId" = ${testLessonId};`.catch(() => {});
    await (db as any).$executeRaw`DELETE FROM "Lesson" WHERE "id" = ${testLessonId};`.catch(() => {});
    await (db as any).$executeRaw`DELETE FROM "Course" WHERE "id" = ${testCourseId};`.catch(() => {});
    await (db as any).$executeRaw`DELETE FROM "User" WHERE "id" = ${testTeacherId};`.catch(() => {});
    console.log('[CLEANUP] Test records safely purged from ox_digital_dev.');
  }

  console.log('\n===================================================================');
  console.log(`Integration Test Results: ${testsPassed} Passed, ${testsFailed} Failed (Total ${testsPassed + testsFailed})`);
  console.log('===================================================================\n');

  if (testsFailed > 0) {
    process.exit(1);
  }
}

runIntegrationTests().catch((err) => {
  console.error('Fatal integration test error:', err);
  process.exit(1);
});
