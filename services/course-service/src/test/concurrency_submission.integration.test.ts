if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = 'postgresql://ox_admin:dummy_pass@localhost:5432/ox_digital_education?schema=public';
}

import assert from 'node:assert';

console.log('================================================================');
console.log('PHASE 6.2C.2.5 POSTGRESQL CONCURRENT SUBMISSION INTEGRATION TEST');
console.log('================================================================');

async function runPostgresConcurrencyIntegrationTest() {
  const { db } = await import('../../../../packages/database/dist/index.js');
  const { submitAttempt } = await import('../controllers/exam.controller.js');
  console.log('\n[Phase 6.2C.2.5 - Live Database Concurrency Audit]');
  console.log('Target Database URL Host:', (process.env.DATABASE_URL || '').split('@')[1] || 'localhost:5432');

  let isPostgresAvailable = false;
  try {
    // Attempt connectivity check with strict 2-second timeout
    await Promise.race([
      db.$queryRaw`SELECT 1 as ping`,
      new Promise((_, reject) => setTimeout(() => reject(new Error('Connection timeout (2000ms)')), 2000))
    ]);
    isPostgresAvailable = true;
    console.log('✓ PostgreSQL Connectivity: ESTABLISHED (Live DB available)');
  } catch (connErr: any) {
    console.log('✗ PostgreSQL Connectivity: UNAVAILABLE');
    console.log(`  Reason: ${connErr.message || connErr}`);
    console.log('\n----------------------------------------------------------------');
    console.log('HONEST LIMITATION REPORTING (Phase 6.2C.2.5 Requirement 8):');
    console.log('  A live PostgreSQL database daemon is NOT running or accessible on');
    console.log('  the target port in this local environment.');
    console.log('  In strict compliance with governance rules, this integration test');
    console.log('  will NOT substitute mocked responses to claim database concurrency');
    console.log('  proof. Concurrency guarantees rely on PostgreSQL row-level locks');
    console.log('  (SELECT ... FOR UPDATE) and transaction advisory locks');
    console.log('  (pg_advisory_xact_lock), which require a live PostgreSQL engine.');
    console.log('----------------------------------------------------------------\n');
    return {
      status: 'SKIPPED_DB_UNAVAILABLE',
      reason: connErr.message
    };
  }

  // If live PostgreSQL is available, execute real multi-threaded / concurrent submission test
  const testStudentId = 'test-student-concurrency-' + Date.now();
  const testExamId = 'test-exam-concurrency-' + Date.now();
  const testCourseId = 'test-course-concurrency-' + Date.now();

  try {
    console.log('\n[Executing Live Concurrency Benchmark]');
    // 1. Setup minimal test data in PostgreSQL
    const exam = await db.exam.create({
      data: {
        id: testExamId,
        title: 'PostgreSQL Concurrency Test Exam',
        courseId: testCourseId,
        duration: 60,
        totalPoints: 100,
        passingScore: 50,
        questions: [
          { id: 'q1', text: 'Question 1', points: 50, correct: 'A' },
          { id: 'q2', text: 'Question 2', points: 50, correct: 'B' }
        ]
      }
    });

    const initialAttempt = await db.examAttempt.create({
      data: {
        studentId: testStudentId,
        examId: testExamId,
        score: 0,
        status: 'STARTED',
        isGraded: false,
        totalPoints: 100
      }
    });

    console.log(`Initial attempt created: ${initialAttempt.id} (status: ${initialAttempt.status})`);

    // 2. Launch 5 simultaneous submissions against the same attempt
    const concurrentCount = 5;
    const reqMockBase = {
      params: { id: testExamId },
      user: { userId: testStudentId, role: 'STUDENT' },
      body: {
        answers: [
          { questionId: 'q1', selectedOption: 'A' }, // 50 pts
          { questionId: 'q2', selectedOption: 'B' }  // 50 pts
        ]
      }
    };

    console.log(`Launching ${concurrentCount} concurrent submission requests...`);
    const promises = Array.from({ length: concurrentCount }).map(async (_, idx) => {
      let statusCode = 0;
      let payload: any = null;

      const resMock: any = {
        status: (code: number) => {
          statusCode = code;
          return {
            json: (data: any) => { payload = data; }
          };
        },
        json: (data: any) => {
          statusCode = 200;
          payload = data;
        }
      };

      await submitAttempt(reqMockBase as any, resMock);
      return { requestIndex: idx, statusCode, payload };
    });

    const results = await Promise.all(promises);

    // 3. Evaluate results
    const primaryGraded = results.filter(r => r.statusCode === 200 && !r.payload?.idempotent);
    const idempotentGraded = results.filter(r => r.statusCode === 200 && r.payload?.idempotent === true);

    console.log(`Concurrency Results:`);
    console.log(`  - Primary graded submissions: ${primaryGraded.length}`);
    console.log(`  - Idempotent deduplicated responses: ${idempotentGraded.length}`);

    assert.strictEqual(primaryGraded.length, 1, 'Exactly one submission must execute the authoritative grading');
    assert.strictEqual(idempotentGraded.length, concurrentCount - 1, 'Remaining submissions must receive idempotent cached results');

    // Verify all returned identical scores
    for (const r of results) {
      assert.strictEqual(r.payload.score, 100);
      assert.strictEqual(r.payload.percentage, 100);
    }

    // 4. Query live database to verify exactly one attempt exists
    const attemptsInDb = await db.examAttempt.findMany({
      where: { studentId: testStudentId, examId: testExamId }
    });

    assert.strictEqual(attemptsInDb.length, 1, 'Must NOT create duplicate attempt records in PostgreSQL');
    assert.strictEqual(attemptsInDb[0].status, 'GRADED');
    assert.strictEqual(attemptsInDb[0].isGraded, true);
    assert.strictEqual(attemptsInDb[0].score, 100);
    assert.strictEqual(attemptsInDb[0].percentage, 100);

    console.log('✓ Live PostgreSQL concurrency verification SUCCEEDED with 100% data consistency.');

    return {
      status: 'PASSED',
      primaryGraded: primaryGraded.length,
      idempotent: idempotentGraded.length,
      attemptsInDb: attemptsInDb.length
    };
  } finally {
    // Clean up test records
    try {
      await db.examAttempt.deleteMany({ where: { studentId: testStudentId } });
      await db.exam.deleteMany({ where: { id: testExamId } });
    } catch (cleanupErr) {
      // Ignore cleanup error in teardown
    }
  }
}

runPostgresConcurrencyIntegrationTest()
  .then(res => {
    console.log('\nIntegration Test Result Summary:', res);
    console.log('================================================================\n');
  })
  .catch(err => {
    console.error('Fatal error during integration test:', err);
    process.exit(1);
  });
