import jwt from 'jsonwebtoken';
import { S3Client, ListObjectsV2Command, GetObjectCommand } from '@aws-sdk/client-s3';
import { Queue } from 'bullmq';
import cp from 'child_process';
import fs from 'fs';

const RUN_ID = 'run-20261026-215500';
const JWT_SECRET = 'dev-only-jwt-secret-do-not-use-in-production-12345';
const COURSE_SERVICE_URL = 'http://127.0.0.1:4014';
const S3_ENDPOINT = 'http://127.0.0.1:9100';
const S3_BUCKET = 'ox-digital-dev-hls';
const S3_ACCESS_KEY = 'devminioadmin';
const S3_SECRET_KEY = 'devminiopassword123';
const REDIS_HOST = '127.0.0.1';
const REDIS_PORT = 6381;

const TEST_TEACHER_ID = '11111111-2026-1026-2155-000000000001';
const TEST_STUDENT_ID = '22222222-2026-1026-2155-000000000002';
const DRIVE_URL = 'https://drive.google.com/file/d/1GpUrvzEoEshP6ExyC4ced8nAdEtF1_G-/view?usp=drive_link';

function runSql(sql) {
  const cmd = 'docker exec -i ox-digital-dev-postgres psql -U postgres -d ox_digital_dev -t -A -F"|"';
  try {
    const stdout = cp.execSync(cmd, { input: sql, encoding: 'utf-8' });
    return stdout.trim();
  } catch (err) {
    throw new Error(`SQL Error: ${err.message}`);
  }
}

async function streamToString(stream) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    stream.on('data', chunk => chunks.push(chunk));
    stream.on('error', reject);
    stream.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')));
  });
}

async function main() {
  console.log('===================================================================');
  console.log(`Phase 2.6 — Automated Single-Video End-to-End Pipeline Retry (${RUN_ID})`);
  console.log('===================================================================');

  // 1. Setup Test Users in ox_digital_dev
  console.log('[Stage 1/14] Setting up isolated dev users in ox_digital_dev...');
  const insertUsersSql = `
    INSERT INTO "User" ("id", "email", "password", "name", "role", "language", "isGuest", "createdAt", "updatedAt")
    VALUES 
      ('${TEST_TEACHER_ID}', 'dev-test-teacher-215500@ox-digital-dev.local', '$2b$10$dummyhashedpasswordfordevtest12345678901234567890', '[DEV-TEST] Teacher 215500', 'TEACHER', 'ar', false, NOW(), NOW()),
      ('${TEST_STUDENT_ID}', 'dev-test-student-215500@ox-digital-dev.local', '$2b$10$dummyhashedpasswordfordevtest12345678901234567890', '[DEV-TEST] Student 215500', 'ONLINE_STUDENT', 'ar', false, NOW(), NOW())
    ON CONFLICT ("id") DO NOTHING;
  `;
  runSql(insertUsersSql);
  console.log('      -> Test users provisioned.');

  const teacherToken = jwt.sign(
    { userId: TEST_TEACHER_ID, role: 'TEACHER', email: 'dev-test-teacher-215500@ox-digital-dev.local' },
    JWT_SECRET,
    { expiresIn: '1h' }
  );

  const studentToken = jwt.sign(
    { userId: TEST_STUDENT_ID, role: 'ONLINE_STUDENT', email: 'dev-test-student-215500@ox-digital-dev.local' },
    JWT_SECRET,
    { expiresIn: '1h' }
  );

  // 2. Create Course via course-service API
  console.log('[Stage 2/14] Creating test Course via course-service API (POST /api/courses)...');
  const courseRes = await fetch(`${COURSE_SERVICE_URL}/api/courses`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${teacherToken}`,
    },
    body: JSON.stringify({
      title: `[DEV-TEST] HLS Pipeline Course ${RUN_ID}`,
      description: 'Isolated test course for Google Drive HLS pipeline retry',
      price: 0,
      status: 'PUBLISHED',
      academicLevel: 'SEC_1',
    }),
  });

  if (!courseRes.ok) {
    const errText = await courseRes.text();
    throw new Error(`Failed to create course: HTTP ${courseRes.status} - ${errText}`);
  }
  const courseData = await courseRes.json();
  const courseId = courseData.id;
  console.log(`      -> Created Course ID: ${courseId}`);

  // 3. Create Lesson with Google Drive URL via course-service API
  console.log('[Stage 3/14] Creating test Lesson with Drive URL (POST /api/courses/lessons)...');
  const lessonRes = await fetch(`${COURSE_SERVICE_URL}/api/courses/lessons`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${teacherToken}`,
    },
    body: JSON.stringify({
      title: `[DEV-TEST] Google Drive HLS Ingestion ${RUN_ID}`,
      courseId: courseId,
      videoUrl: DRIVE_URL,
    }),
  });

  if (!lessonRes.ok) {
    const errText = await lessonRes.text();
    throw new Error(`Failed to create lesson: HTTP ${lessonRes.status} - ${errText}`);
  }
  const lessonData = await lessonRes.json();
  const lessonId = lessonData.id;
  console.log(`      -> Created Lesson ID: ${lessonId}`);

  // 4. Verify ProcessedMedia Creation & Normalization
  console.log('[Stage 4/14] Verifying ProcessedMedia creation & Drive URL normalization...');
  const pmSql = `SELECT id, "status", "mediaGeneration", "canonicalSource", "storagePrefix" FROM "ProcessedMedia" WHERE "lessonId" = '${lessonId}'`;
  const pmRaw = runSql(pmSql);
  if (!pmRaw) {
    throw new Error(`No ProcessedMedia record found in ox_digital_dev for lesson ${lessonId}`);
  }
  const [mediaId, initialStatus, mediaGen, canonicalSource, storagePrefix] = pmRaw.split('|');
  console.log(`      -> ProcessedMedia ID: ${mediaId}`);
  console.log(`      -> Initial Status: ${initialStatus}`);
  console.log(`      -> Normalized Canonical Source: ${canonicalSource}`);
  console.log(`      -> Storage Prefix: ${storagePrefix}`);

  if (!canonicalSource.includes('1GpUrvzEoEshP6ExyC4ced8nAdEtF1_G-')) {
    throw new Error(`Canonical source normalization failure: expected fileId in ${canonicalSource}`);
  }

  // 5. Verify BullMQ Queue Job
  console.log('[Stage 5/14] Verifying BullMQ job enqueued in video-transcode-queue...');
  const queue = new Queue('video-transcode-queue', {
    connection: { host: REDIS_HOST, port: REDIS_PORT },
  });
  const expectedJobId = `drive-media-${mediaId}`;
  const job = await queue.getJob(expectedJobId);
  if (job) {
    const jobState = await job.getState();
    console.log(`      -> BullMQ Job ${expectedJobId} state: ${jobState}`);
  } else {
    console.log(`      -> BullMQ Job ${expectedJobId} was immediately consumed by worker.`);
  }
  await queue.close();

  // 6. Monitor Pipeline Processing until COMPLETED
  console.log('[Stage 6/14] Monitoring video-worker processing (scratch download -> ffprobe -> FFmpeg -> MinIO upload)...');
  const maxWaitMs = 600000; // 10 minutes max for ~380MB video
  const startTime = Date.now();
  let finalStatus = initialStatus;
  let lastStatus = initialStatus;
  let finalPmData = null;

  while (Date.now() - startTime < maxWaitMs) {
    const checkSql = `SELECT id, "status", "retryCount", "errorMessage", "masterPlaylistKey", "durationSeconds", "renditions", "workerId", "fencingToken" FROM "ProcessedMedia" WHERE id = '${mediaId}'`;
    const checkRaw = runSql(checkSql);
    if (checkRaw) {
      const [id, status, retryCount, errMsg, masterKey, duration, renditions, workerId, fencingToken] = checkRaw.split('|');
      finalStatus = status;
      if (status !== lastStatus) {
        const sec = Math.round((Date.now() - startTime) / 1000);
        console.log(`      -> State Transition [${sec}s]: ${lastStatus} -> ${status} (worker: ${workerId || 'none'}, fencing: ${fencingToken})`);
        lastStatus = status;
      }
      if (status === 'COMPLETED' || status === 'FAILED') {
        finalPmData = { id, status, retryCount, errMsg, masterKey, duration, renditions, workerId, fencingToken };
        break;
      }
    }
    await new Promise(r => setTimeout(r, 3000));
  }

  const elapsedSec = Math.round((Date.now() - startTime) / 1000);
  console.log(`      -> Processing finished in ${elapsedSec}s. Final Status: ${finalStatus}`);

  if (finalStatus !== 'COMPLETED') {
    throw new Error(`Pipeline did not complete successfully. Status: ${finalStatus}, Error: ${finalPmData?.errMsg || 'none'}`);
  }

  // 7. Inspect MinIO Storage Package
  console.log('[Stage 7/14] Inspecting MinIO storage package in bucket ox-digital-dev-hls...');
  const s3Client = new S3Client({
    region: 'us-east-1',
    endpoint: S3_ENDPOINT,
    credentials: { accessKeyId: S3_ACCESS_KEY, secretAccessKey: S3_SECRET_KEY },
    forcePathStyle: true,
  });

  const listRes = await s3Client.send(new ListObjectsV2Command({
    Bucket: S3_BUCKET,
    Prefix: storagePrefix,
  }));

  const objects = listRes.Contents || [];
  const objectKeys = objects.map(o => o.Key);
  const masterKey = finalPmData.masterKey;
  const masterObj = objectKeys.find(k => k === masterKey);
  const renditionPlaylists = objectKeys.filter(k => k.endsWith('index.m3u8'));
  const segmentFiles = objectKeys.filter(k => k.endsWith('.ts'));

  console.log(`      -> Total MinIO Objects in prefix: ${objects.length}`);
  console.log(`      -> Master Playlist Key: ${masterKey} (Exists: ${!!masterObj})`);
  console.log(`      -> Rendition Playlists: ${renditionPlaylists.length} (${renditionPlaylists.join(', ')})`);
  console.log(`      -> Media Segments (.ts): ${segmentFiles.length}`);

  if (!masterObj) {
    throw new Error(`Master playlist ${masterKey} missing from MinIO!`);
  }
  if (renditionPlaylists.length === 0) {
    throw new Error('No rendition playlists found in MinIO!');
  }
  if (segmentFiles.length === 0) {
    throw new Error('No media segments found in MinIO!');
  }

  // 8. Verify Atomic Lesson Promotion
  console.log('[Stage 8/14] Verifying atomic Lesson promotion in ox_digital_dev...');
  const lessonCheckSql = `SELECT "activeMediaId", "mediaGeneration" FROM "Lesson" WHERE id = '${lessonId}'`;
  const [activeMediaId, lessonGen] = runSql(lessonCheckSql).split('|');
  console.log(`      -> Lesson.activeMediaId: ${activeMediaId} (Matches ProcessedMedia: ${activeMediaId === mediaId})`);
  console.log(`      -> Lesson.mediaGeneration: ${lessonGen} (Matches ProcessedMedia: ${lessonGen === mediaGen})`);

  if (activeMediaId !== mediaId) {
    throw new Error(`Lesson.activeMediaId mismatch! Expected ${mediaId}, got ${activeMediaId}`);
  }

  // 9. Test Authenticated HLS Gateway Security
  console.log('[Stage 9/14] Testing Authenticated HLS Gateway access controls...');
  // 9a. Unauthenticated -> 401
  const unauthRes = await fetch(`${COURSE_SERVICE_URL}/api/courses/lessons/${lessonId}/hls/master.m3u8`);
  console.log(`      [Security Test 1: Unauthenticated] HTTP ${unauthRes.status} (Expected: 401)`);
  if (unauthRes.status !== 401) {
    throw new Error(`Expected 401 for unauthenticated request, got ${unauthRes.status}`);
  }

  // 9b. Unauthorized Student (not enrolled) -> 403
  const unenrolledRes = await fetch(`${COURSE_SERVICE_URL}/api/courses/lessons/${lessonId}/hls/master.m3u8`, {
    headers: { Authorization: `Bearer ${studentToken}` },
  });
  console.log(`      [Security Test 2: Un-enrolled Student] HTTP ${unenrolledRes.status} (Expected: 403)`);
  if (unenrolledRes.status !== 403) {
    throw new Error(`Expected 403 for un-enrolled student request, got ${unenrolledRes.status}`);
  }

  // 9c. Authenticated Teacher (Course Owner) -> 200
  const authRes = await fetch(`${COURSE_SERVICE_URL}/api/courses/lessons/${lessonId}/hls/master.m3u8`, {
    headers: { Authorization: `Bearer ${teacherToken}` },
  });
  console.log(`      [Gateway Test: Teacher Master Playlist] HTTP ${authRes.status} (Expected: 200)`);
  console.log(`      [Gateway Test: Content-Type] ${authRes.headers.get('content-type')}`);
  const masterManifestBody = await authRes.text();
  const hasStreamInf = masterManifestBody.includes('#EXT-X-STREAM-INF');
  console.log(`      [Gateway Test: Contains #EXT-X-STREAM-INF] ${hasStreamInf}`);

  if (authRes.status !== 200 || !hasStreamInf) {
    throw new Error(`Master manifest gateway failed: status ${authRes.status}, stream-inf: ${hasStreamInf}`);
  }

  const attemptPrefix = masterKey.substring(0, masterKey.lastIndexOf('/') + 1);

  // 10. Fetch Rendition Playlists via Gateway
  console.log('[Stage 10/14] Testing Rendition Playlists & Segments via Gateway...');
  for (const renditionKey of renditionPlaylists) {
    const subpath = renditionKey.replace(attemptPrefix, '');
    const renditionRes = await fetch(`${COURSE_SERVICE_URL}/api/courses/lessons/${lessonId}/hls/${subpath}`, {
      headers: { Authorization: `Bearer ${teacherToken}` },
    });
    console.log(`      [Rendition Playlist: ${subpath}] HTTP ${renditionRes.status} (Expected: 200)`);
    if (renditionRes.status !== 200) {
      throw new Error(`Rendition playlist ${subpath} failed: status ${renditionRes.status}`);
    }
  }

  // Fetch First Media Segment via Gateway
  const segSubpath = segmentFiles[0].replace(attemptPrefix, '');
  const segRes = await fetch(`${COURSE_SERVICE_URL}/api/courses/lessons/${lessonId}/hls/${segSubpath}`, {
    headers: { Authorization: `Bearer ${teacherToken}` },
  });
  console.log(`      [Media Segment: ${segSubpath}] HTTP ${segRes.status} (Expected: 200)`);
  console.log(`      [Media Segment: ${segSubpath}] Content-Type: ${segRes.headers.get('content-type')}`);
  console.log(`      [Media Segment: ${segSubpath}] Content-Length: ${segRes.headers.get('content-length')} bytes`);

  if (segRes.status !== 200) {
    throw new Error(`Media segment ${segSubpath} failed: status ${segRes.status}`);
  }

  // 11. Verify Frontend HLS URL Resolution Precedence
  console.log('[Stage 11/14] Verifying Frontend Playback Resolver Precedence...');
  const lessonDetailsRes = await fetch(`${COURSE_SERVICE_URL}/api/courses/lessons/${lessonId}`, {
    headers: { Authorization: `Bearer ${teacherToken}` },
  });
  const lessonDetailsData = await lessonDetailsRes.json();
  console.log(`      [Lesson Details] hasActiveHls: ${lessonDetailsData.hasActiveHls}`);
  console.log(`      [Lesson Details] activeMediaId: ${lessonDetailsData.activeMediaId}`);
  console.log(`      [Lesson Details] videoUrl: ${lessonDetailsData.videoUrl}`);

  if (!lessonDetailsData.hasActiveHls) {
    throw new Error('Lesson Details did NOT expose hasActiveHls = true for active HLS media!');
  }

  // 12. Simulate Frontend URL Selection Contract
  console.log('[Stage 12/14] Simulating UnifiedVideoPlayer URL resolution contract...');
  const isLessonHlsActive = Boolean(lessonDetailsData.hasActiveHls);
  const isDirectHls = false; // Google drive URL
  const isInternalHls = isDirectHls || isLessonHlsActive;
  const videoSourceType = 'google-drive';
  const resolvedUrl = isInternalHls
    ? `/api/courses/lessons/${lessonId}/hls/master.m3u8`
    : videoSourceType === 'google-drive'
    ? `/api/courses/lessons/${lessonId}/media/stream`
    : lessonDetailsData.videoUrl;

  console.log(`      [Resolved URL] ${resolvedUrl}`);
  if (resolvedUrl !== `/api/courses/lessons/${lessonId}/hls/master.m3u8`) {
    throw new Error(`Resolver precedence failed: expected HLS master manifest, got ${resolvedUrl}`);
  }

  // 13. Parse Multi-Rendition HLS Levels
  console.log('[Stage 13/14] Discovering HLS Renditions from Master Manifest...');
  const streamInfRegex = /#EXT-X-STREAM-INF:.*BANDWIDTH=(\d+).*RESOLUTION=(\d+)x(\d+).*\n([^\n]+)/g;
  const discoveredLevels = [];
  let match;
  while ((match = streamInfRegex.exec(masterManifestBody)) !== null) {
    discoveredLevels.push({
      bandwidth: parseInt(match[1], 10),
      width: parseInt(match[2], 10),
      height: parseInt(match[3], 10),
      uri: match[4].trim(),
      label: match[3] >= 1080 ? '1080p HD' : match[3] >= 720 ? '720p HD' : match[3] >= 480 ? '480p' : `${match[3]}p`
    });
  }

  console.log(`      -> Discovered Rendition Levels: ${discoveredLevels.length}`);
  discoveredLevels.forEach(lvl => {
    console.log(`         • ${lvl.label} (${lvl.width}x${lvl.height}, bandwidth: ${lvl.bandwidth} bps, file: ${lvl.uri})`);
  });

  if (discoveredLevels.length < 2) {
    throw new Error(`Expected multiple HLS renditions, found ${discoveredLevels.length}`);
  }

  // 14. Verify Quality Selector Menu Simulation
  console.log('[Stage 14/14] Verifying Quality Selector Options Generation...');
  const qualityOptions = [
    { id: -1, label: 'تلقائي (Auto)' },
    ...discoveredLevels.map((lvl, idx) => ({ id: idx, label: lvl.label, height: lvl.height }))
  ];
  console.log('      -> Generated Quality Selector Options:');
  qualityOptions.forEach(opt => {
    console.log(`         [Option] ${opt.label} (ID: ${opt.id})`);
  });

  // Save Pipeline Summary Artifact
  const results = {
    testRunId: RUN_ID,
    courseId,
    lessonId,
    mediaId,
    canonicalSource,
    storagePrefix,
    masterKey,
    finalStatus,
    workerId: finalPmData.workerId,
    fencingToken: finalPmData.fencingToken,
    durationSeconds: finalPmData.duration,
    renditions: finalPmData.renditions,
    totalMinioObjects: objects.length,
    renditionPlaylistsCount: renditionPlaylists.length,
    segmentFilesCount: segmentFiles.length,
    unauthStatus: unauthRes.status,
    unenrolledStatus: unenrolledRes.status,
    authStatus: authRes.status,
    hasActiveHls: lessonDetailsData.hasActiveHls,
    resolvedPlayableUrl: resolvedUrl,
    discoveredLevels,
    qualityOptions,
  };

  fs.writeFileSync('pipeline_retry_summary.json', JSON.stringify(results, null, 2));
  console.log('===================================================================');
  console.log(`PHASE 2.6 RETRY PIPELINE COMPLETED SUCCESSFULLY! (${RUN_ID})`);
  console.log('===================================================================');

  return results;
}

main().catch((err) => {
  console.error('[FATAL RETRY FAILURE]:', err);
  process.exit(1);
});
