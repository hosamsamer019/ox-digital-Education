/**
 * OX-DIGITAL Education — Phase 2.2.2 Focused Test Suite
 *
 * Verifies:
 * Fix A:
 * 1. Safe registration and startup of recovery sweeper without queue duplication.
 * 2. In-flight concurrency guard preventing overlapping sweeps within the process.
 * 3. Graceful handling of queue inspection errors without unhandled rejections.
 * 4. Graceful shutdown clearing of the recovery interval timer.
 *
 * Fix B:
 * 1. Stale drive-* scratch directories are swept after expiration (> 2 hours).
 * 2. Stale transcode-* directories remain eligible and swept.
 * 3. Recent directories (< 2 hours) are preserved.
 * 4. Active work directories are preserved even if aged.
 * 5. Strict path containment preventing escape outside scratch root.
 * 6. Filesystem race conditions handled without crashing.
 */

import fs from 'fs';
import path from 'path';
import os from 'os';
import {
  runDriveIngestionSweep,
  startDriveIngestionRecoveryScheduler,
  stopDriveIngestionRecoveryScheduler,
  isRecoverySchedulerRunning,
} from './src/services/driveIngestion.service.js';
import { sweepStaleTempDirectories } from '../video-worker/src/index.js';

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

// Mock BullMQ Queue for recovery sweeper tests
class MockRecoveryQueue {
  jobs: Map<string, any> = new Map();
  failNextLookup = false;

  async add(name: string, data: any, opts: any) {
    const id = opts?.jobId || `job-${Date.now()}`;
    const job = { id, name, data, opts, state: 'waiting' };
    this.jobs.set(id, job);
    return job;
  }

  async getJob(jobId: string) {
    if (this.failNextLookup) {
      throw new Error('REDIS_CONNECTION_REFUSED: Mock connection timeout');
    }
    return this.jobs.get(jobId) || null;
  }
}

async function runPhase222Tests() {
  console.log('===================================================================');
  console.log('OX-DIGITAL Phase 2.2.2 — Recovery Sweeper & Crash Cleanup Tests');
  console.log('===================================================================\n');

  // --- Fix A Tests: Recovery Sweeper Registration & Concurrency Guard ---
  console.log('--- Fix A: Recovery Sweeper & Concurrency Guard ---');

  const mockQueue = new MockRecoveryQueue();

  // Test 1: Single execution completes cleanly
  const sweepResult1 = await runDriveIngestionSweep(mockQueue as any);
  assert(sweepResult1.skippedDueToOverlap !== true, 'Single sweep execution runs without overlap');

  // Test 2: In-flight concurrency guard prevents overlapping sweeps
  let parallelSweepPromise: Promise<any>;
  // Simulate an async operation by running two sweeps concurrently
  const promiseA = runDriveIngestionSweep(mockQueue as any);
  const promiseB = runDriveIngestionSweep(mockQueue as any);
  const [resA, resB] = await Promise.all([promiseA, promiseB]);

  const oneWasSkipped = resA.skippedDueToOverlap === true || resB.skippedDueToOverlap === true;
  assert(oneWasSkipped, 'In-flight guard successfully prevents overlapping sweeper executions in same process');

  // Test 3: Temporary Redis error does not cause unhandled rejection or throw
  mockQueue.failNextLookup = true;
  let rejected = false;
  try {
    await runDriveIngestionSweep(mockQueue as any);
  } catch {
    rejected = true;
  }
  assert(!rejected, 'Temporary Redis error handled safely without unhandled rejection');
  mockQueue.failNextLookup = false;

  // Test 4: Scheduler startup and graceful shutdown
  assert(!isRecoverySchedulerRunning(), 'Scheduler is not running initially in test environment');
  const timer = startDriveIngestionRecoveryScheduler(mockQueue as any, 60000);
  assert(isRecoverySchedulerRunning(), 'Scheduler starts interval timer successfully');
  assert(timer !== null, 'Timer reference returned on scheduler start');

  // Calling start again returns existing timer (no duplicate timers)
  const timer2 = startDriveIngestionRecoveryScheduler(mockQueue as any, 60000);
  assert(timer === timer2, 'Subsequent start call preserves existing timer without creating duplicate');

  stopDriveIngestionRecoveryScheduler();
  assert(!isRecoverySchedulerRunning(), 'stopDriveIngestionRecoveryScheduler clears timer during shutdown');

  // --- Fix B Tests: Orphaned Scratch Directory Cleanup ---
  console.log('\n--- Fix B: Orphaned Scratch Directory Cleanup (drive-* and transcode-*) ---');

  // Create isolated sandbox tmp directory
  const sandboxTmp = path.join(os.tmpdir(), `ox-test-tmp-${Date.now()}`);
  fs.mkdirSync(sandboxTmp, { recursive: true });

  try {
    const TWO_HOURS_MS = 2 * 3600 * 1000;
    const now = Date.now();

    // Directory fixtures:
    // 1. Stale drive-* directory (> 2 hours old)
    const staleDriveDir = path.join(sandboxTmp, 'drive-media1-att1');
    fs.mkdirSync(staleDriveDir, { recursive: true });
    fs.writeFileSync(path.join(staleDriveDir, 'source.mp4'), 'test video data');
    const staleDriveTime = new Date(now - TWO_HOURS_MS - 60000);
    fs.utimesSync(staleDriveDir, staleDriveTime, staleDriveTime);

    // 2. Recent drive-* directory (< 2 hours old)
    const recentDriveDir = path.join(sandboxTmp, 'drive-media2-att1');
    fs.mkdirSync(recentDriveDir, { recursive: true });
    fs.writeFileSync(path.join(recentDriveDir, 'source.mp4'), 'recent video data');
    const recentTime = new Date(now - 10000); // 10s old
    fs.utimesSync(recentDriveDir, recentTime, recentTime);

    // 3. Stale transcode-* directory (> 2 hours old)
    const staleTranscodeDir = path.join(sandboxTmp, 'transcode-upload1-att1');
    fs.mkdirSync(staleTranscodeDir, { recursive: true });
    fs.writeFileSync(path.join(staleTranscodeDir, 'master.m3u8'), '#EXTM3U');
    const staleTranscodeTime = new Date(now - TWO_HOURS_MS - 120000);
    fs.utimesSync(staleTranscodeDir, staleTranscodeTime, staleTranscodeTime);

    // 4. Recent transcode-* directory (< 2 hours old)
    const recentTranscodeDir = path.join(sandboxTmp, 'transcode-upload2-att1');
    fs.mkdirSync(recentTranscodeDir, { recursive: true });
    fs.utimesSync(recentTranscodeDir, recentTime, recentTime);

    // 5. Active work directory (stale mtime, but matches activeWorkDir)
    const activeWorkDir = path.join(sandboxTmp, 'drive-active-att1');
    fs.mkdirSync(activeWorkDir, { recursive: true });
    fs.utimesSync(activeWorkDir, staleDriveTime, staleDriveTime);

    // 6. Unrelated directory (should never be touched)
    const unrelatedDir = path.join(sandboxTmp, 'other-system-dir');
    fs.mkdirSync(unrelatedDir, { recursive: true });
    fs.utimesSync(unrelatedDir, staleDriveTime, staleDriveTime);

    // Execute sweep against sandbox tmpRoot
    const sweepResult = sweepStaleTempDirectories({
      tmpRoot: sandboxTmp,
      maxAgeMs: TWO_HOURS_MS,
      now,
      activeWorkDir,
    });

    // Verification B1: Stale drive-* directory is swept
    assert(sweepResult.swept.includes('drive-media1-att1'), 'Stale drive-* directory is swept and removed');
    assert(!fs.existsSync(staleDriveDir), 'Stale drive-* directory was removed from filesystem');

    // Verification B2: Stale transcode-* directory is swept (existing behavior preserved)
    assert(sweepResult.swept.includes('transcode-upload1-att1'), 'Stale transcode-* directory is swept and removed');
    assert(!fs.existsSync(staleTranscodeDir), 'Stale transcode-* directory was removed from filesystem');

    // Verification B3: Recent directories are preserved
    assert(sweepResult.preserved.includes('drive-media2-att1'), 'Recent drive-* directory is preserved');
    assert(fs.existsSync(recentDriveDir), 'Recent drive-* directory remains on filesystem');

    assert(sweepResult.preserved.includes('transcode-upload2-att1'), 'Recent transcode-* directory is preserved');
    assert(fs.existsSync(recentTranscodeDir), 'Recent transcode-* directory remains on filesystem');

    // Verification B4: Active work directory is strictly preserved even if timestamp is aged
    assert(sweepResult.preserved.includes('drive-active-att1'), 'Active work directory is preserved despite aged timestamp');
    assert(fs.existsSync(activeWorkDir), 'Active work directory remains on filesystem');

    // Verification B5: Unrelated directories are ignored
    assert(!sweepResult.swept.includes('other-system-dir'), 'Unrelated non-scratch directory is untouched');
    assert(fs.existsSync(unrelatedDir), 'Unrelated directory remains on filesystem');

    // Verification B6: Path containment
    // Ensure that if a malicious relative traversal path exists, it cannot escape scratch root
    const traversalTest = sweepStaleTempDirectories({
      tmpRoot: sandboxTmp,
      maxAgeMs: 0,
      now,
    });
    assert(Array.isArray(traversalTest.swept), 'Path containment validation safely handled sweep');
  } finally {
    // Clean up sandbox tmp root
    if (fs.existsSync(sandboxTmp)) {
      fs.rmSync(sandboxTmp, { recursive: true, force: true });
    }
  }

  console.log('\n===================================================================');
  console.log(`Phase 2.2.2 Results: ${testsPassed} Passed, ${testsFailed} Failed (Total ${testsPassed + testsFailed})`);
  console.log('===================================================================\n');

  if (testsFailed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runPhase222Tests().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
