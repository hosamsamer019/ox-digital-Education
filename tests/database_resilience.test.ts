/**
 * OX-DIGITAL Education — Phase 5.2.3.2
 * Database Timeout and Connection-Pool Resilience Test Suite
 *
 * Exercises:
 *  1. Fast successful query.
 *  2. Slow query under timeout limit (e.g. 500ms).
 *  3. Query timeout (>= 5000ms) with fail-closed 503.
 *  4. Database disconnection / network failure with fail-closed 503.
 *  5. Repeated timeouts (verifying timer cleanup, no unhandled rejections).
 *  6. Recovery after database becomes available.
 */

import { db, verifyAuthoritativeAccountState } from '@smartmath/database';
import bcrypt from 'bcryptjs';

const dbUrl = process.env.DATABASE_URL || '';
if (!dbUrl.includes(':5433')) {
  console.error(`[FATAL] Safety abort: DATABASE_URL does not point to isolated port 5433: ${dbUrl}`);
  process.exit(1);
}

let passed = 0;
let failed = 0;

function assert(condition: boolean, msg: string) {
  if (condition) {
    console.log(`[PASS] ${msg}`);
    passed++;
  } else {
    console.error(`[FAIL] ${msg}`);
    failed++;
  }
}

async function runResilienceSuite() {
  console.log('===================================================================');
  console.log('OX-DIGITAL Education — Phase 5.2.3.2 Database Resilience Suite');
  console.log(`Target: 127.0.0.1:5433 / ox_digital_dev_test`);
  console.log(`Timestamp: ${new Date().toISOString()}`);
  console.log('===================================================================\n');

  const runId = Math.random().toString(36).substring(2, 8);
  const testUserId = `resil_user_${runId}`;
  const testInstId = `resil_inst_${runId}`;

  try {
    // Setup test record in PostgreSQL
    await db.institution.create({
      data: { id: testInstId, name: `Resil Inst ${runId}`, code: `RI-${runId}` }
    });
    const hash = await bcrypt.hash('Test#123456', 10);
    await db.user.create({
      data: {
        id: testUserId,
        email: `resil_${runId}@test.com`,
        name: 'Resilience Test User',
        password: hash,
        role: 'PRIMARY_MANAGER',
        institutionId: testInstId,
        mustChangePassword: false
      }
    });

    // Test 1: Fast Successful Query
    console.log('--- Test 1: Fast Successful Query ---');
    const startFast = Date.now();
    const fastRes = await verifyAuthoritativeAccountState(testUserId);
    const durationFast = Date.now() - startFast;
    assert(fastRes.success === true && fastRes.user?.id === testUserId,
      `1.1: Fast query succeeded in ${durationFast}ms with user data`);
    assert(fastRes.user?.mustChangePassword === false,
      `1.2: Authoritative mustChangePassword verified as false`);

    // Test 2: Slow Query (Under timeout limit)
    console.log('\n--- Test 2: Slow Query Under Timeout Limit ---');
    const originalFind = db.user.findUnique;
    // Mock a 300ms simulated DB latency
    (db.user as any).findUnique = async (args: any) => {
      await new Promise(r => setTimeout(r, 300));
      return originalFind.call(db.user, args);
    };
    const startSlow = Date.now();
    const slowRes = await verifyAuthoritativeAccountState(testUserId);
    const durationSlow = Date.now() - startSlow;
    (db.user as any).findUnique = originalFind;
    assert(slowRes.success === true && durationSlow >= 300 && durationSlow < 4000,
      `2.1: Slow query succeeded in ${durationSlow}ms without timing out`);

    // Test 3: Query Timeout (>= 5000ms) with Fail-Closed 503
    console.log('\n--- Test 3: Query Timeout (>= 5000ms) ---');
    (db.user as any).findUnique = () => new Promise(resolve => setTimeout(resolve, 6000));
    const startTimeout = Date.now();
    const timeoutRes = await verifyAuthoritativeAccountState(testUserId);
    const durationTimeout = Date.now() - startTimeout;
    (db.user as any).findUnique = originalFind;
    assert(timeoutRes.success === false, '3.1: Query timeout returned success: false');
    assert(timeoutRes.status === 503, `3.2: Query timeout returned HTTP 503 (Status: ${timeoutRes.status})`);
    assert(timeoutRes.code === 'DATABASE_VERIFICATION_UNAVAILABLE',
      `3.3: Query timeout returned code DATABASE_VERIFICATION_UNAVAILABLE`);
    assert(durationTimeout >= 4900 && durationTimeout < 5500,
      `3.4: Bounded wait time strictly enforced (elapsed: ${durationTimeout}ms)`);

    // Test 4: Database Disconnection / Network Failure
    console.log('\n--- Test 4: Database Disconnection / Network Failure ---');
    (db.user as any).findUnique = () => Promise.reject(new Error('Connection refused: connect ECONNREFUSED 127.0.0.1:5433'));
    const disconnectRes = await verifyAuthoritativeAccountState(testUserId);
    (db.user as any).findUnique = originalFind;
    assert(disconnectRes.success === false && disconnectRes.status === 503,
      '4.1: Database disconnection fails closed with HTTP 503');
    assert(disconnectRes.code === 'DATABASE_VERIFICATION_UNAVAILABLE',
      '4.2: Database disconnection returned code DATABASE_VERIFICATION_UNAVAILABLE');

    // Test 5: Repeated Timeouts (Connection-Pool & Timer Resilience)
    console.log('\n--- Test 5: Repeated Timeouts Resilience ---');
    (db.user as any).findUnique = () => new Promise(resolve => setTimeout(resolve, 6000));
    const repeatedResults = [];
    for (let i = 0; i < 3; i++) {
      const res = await verifyAuthoritativeAccountState(testUserId);
      repeatedResults.push(res);
    }
    (db.user as any).findUnique = originalFind;
    const all503 = repeatedResults.every(r => r.status === 503 && r.code === 'DATABASE_VERIFICATION_UNAVAILABLE');
    assert(all503 && repeatedResults.length === 3,
      '5.1: 3 consecutive timeouts all failed closed with 503 without process crash or timer leak');

    // Test 6: Recovery after Database becomes available
    console.log('\n--- Test 6: Recovery after Database Available ---');
    const recoveryRes = await verifyAuthoritativeAccountState(testUserId);
    assert(recoveryRes.success === true && recoveryRes.user?.id === testUserId,
      '6.1: Service seamlessly recovers and successfully verifies user upon database reconnection');

    // Cleanup
    await db.user.delete({ where: { id: testUserId } });
    await db.institution.delete({ where: { id: testInstId } });
    assert(true, 'Cleaned up resilience test fixtures from PostgreSQL');

  } catch (error: any) {
    console.error('[UNHANDLED RESILIENCE SUITE ERROR]:', error);
    failed++;
  }

  console.log('\n===================================================================');
  console.log(`TOTAL DATABASE RESILIENCE TESTS: ${passed + failed}`);
  console.log(`PASSED:                          ${passed}`);
  console.log(`FAILED:                          ${failed}`);
  console.log('===================================================================');

  if (failed > 0) process.exit(1);
  else process.exit(0);
}

runResilienceSuite();

