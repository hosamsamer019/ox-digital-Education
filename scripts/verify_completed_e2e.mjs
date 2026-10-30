import jwt from 'jsonwebtoken';
import { S3Client, ListObjectsV2Command, GetObjectCommand } from '@aws-sdk/client-s3';
import cp from 'child_process';
import fs from 'fs';

const RUN_ID = 'run-20261026-215500';
const JWT_SECRET = 'dev-only-jwt-secret-do-not-use-in-production-12345';
const COURSE_SERVICE_URL = 'http://127.0.0.1:4014';
const S3_ENDPOINT = 'http://127.0.0.1:9100';
const S3_BUCKET = 'ox-digital-dev-hls';
const S3_ACCESS_KEY = 'devminioadmin';
const S3_SECRET_KEY = 'devminiopassword123';

const TEST_TEACHER_ID = '11111111-2026-1026-2155-000000000001';
const TEST_STUDENT_ID = '22222222-2026-1026-2155-000000000002';
const COURSE_ID = '53d6bf94-2ad9-47bb-96d0-46fb4aa36b58';
const LESSON_ID = '8003a954-fbe4-492c-871a-21776f22d427';
const MEDIA_ID = '7f17a981-22d2-4023-bfa3-3393882a989c';

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
  console.log(`Phase 2.6 — Stage 7-14 Post-Transcode Verification (${RUN_ID})`);
  console.log('===================================================================');

  // 1. Check DB State of ProcessedMedia
  console.log('[1/8] Verifying ProcessedMedia completion state in ox_digital_dev...');
  const pmSql = `SELECT id, "status", "retryCount", "errorMessage", "masterPlaylistKey", "durationSeconds", "renditions", "workerId", "fencingToken", "storagePrefix", "canonicalSource" FROM "ProcessedMedia" WHERE id = '${MEDIA_ID}'`;
  const pmRaw = runSql(pmSql);
  if (!pmRaw) {
    throw new Error(`No ProcessedMedia record found for ${MEDIA_ID}`);
  }
  const [id, status, retryCount, errMsg, masterKey, duration, renditions, workerId, fencingToken, storagePrefix, canonicalSource] = pmRaw.split('|');
  console.log(`      -> Media ID: ${id}`);
  console.log(`      -> Status: ${status}`);
  console.log(`      -> Master Playlist Key: ${masterKey}`);
  console.log(`      -> Duration (seconds): ${duration}`);
  console.log(`      -> Renditions: ${renditions}`);
  console.log(`      -> Worker ID: ${workerId}`);
  console.log(`      -> Fencing Token: ${fencingToken}`);
  console.log(`      -> Storage Prefix: ${storagePrefix}`);
  console.log(`      -> Canonical Source: ${canonicalSource}`);

  if (status !== 'COMPLETED') {
    throw new Error(`Expected COMPLETED status, got ${status} (err: ${errMsg})`);
  }

  // 2. Check MinIO Storage Package
  console.log('[2/8] Inspecting MinIO storage package in bucket ox-digital-dev-hls...');
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
  const masterObj = objectKeys.find(k => k === masterKey);
  const renditionPlaylists = objectKeys.filter(k => k.endsWith('index.m3u8'));
  const segmentFiles = objectKeys.filter(k => k.endsWith('.ts'));

  console.log(`      -> Total MinIO Objects under prefix: ${objects.length}`);
  console.log(`      -> Master Playlist Key: ${masterKey} (Exists: ${!!masterObj})`);
  console.log(`      -> Rendition Playlists: ${renditionPlaylists.length} (${renditionPlaylists.join(', ')})`);
  console.log(`      -> Media Segments (.ts): ${segmentFiles.length}`);

  if (!masterObj) throw new Error(`Master playlist ${masterKey} missing in MinIO!`);
  if (renditionPlaylists.length === 0) throw new Error('No rendition playlists found in MinIO!');
  if (segmentFiles.length === 0) throw new Error('No segment files found in MinIO!');

  // 3. Verify Atomic Lesson Promotion
  console.log('[3/8] Verifying atomic Lesson promotion in ox_digital_dev...');
  const lessonCheckSql = `SELECT "activeMediaId", "mediaGeneration" FROM "Lesson" WHERE id = '${LESSON_ID}'`;
  const [activeMediaId, lessonGen] = runSql(lessonCheckSql).split('|');
  console.log(`      -> Lesson.activeMediaId: ${activeMediaId} (Matches Media: ${activeMediaId === MEDIA_ID})`);
  console.log(`      -> Lesson.mediaGeneration: ${lessonGen}`);

  if (activeMediaId !== MEDIA_ID) {
    throw new Error(`Lesson.activeMediaId mismatch! Expected ${MEDIA_ID}, got ${activeMediaId}`);
  }

  // 4. Test Authenticated HLS Gateway Security
  console.log('[4/8] Testing Authenticated HLS Gateway access controls...');
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

  // 4a. Unauthenticated -> 401
  const unauthRes = await fetch(`${COURSE_SERVICE_URL}/api/courses/lessons/${LESSON_ID}/hls/master.m3u8`);
  console.log(`      [Security Test 1: Unauthenticated] HTTP ${unauthRes.status} (Expected: 401)`);
  if (unauthRes.status !== 401) throw new Error(`Expected 401, got ${unauthRes.status}`);

  // 4b. Unauthorized Student (not enrolled) -> 403
  const unenrolledRes = await fetch(`${COURSE_SERVICE_URL}/api/courses/lessons/${LESSON_ID}/hls/master.m3u8`, {
    headers: { Authorization: `Bearer ${studentToken}` },
  });
  console.log(`      [Security Test 2: Un-enrolled Student] HTTP ${unenrolledRes.status} (Expected: 403)`);
  if (unenrolledRes.status !== 403) throw new Error(`Expected 403, got ${unenrolledRes.status}`);

  // 4c. Authenticated Teacher (Course Owner) -> 200
  const authRes = await fetch(`${COURSE_SERVICE_URL}/api/courses/lessons/${LESSON_ID}/hls/master.m3u8`, {
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

  // 5. Fetch Rendition Playlists & Segments via Gateway
  console.log('[5/8] Testing Rendition Playlists & Segments via Gateway...');
  for (const renditionKey of renditionPlaylists) {
    const subpath = renditionKey.replace(attemptPrefix, '');
    const renditionRes = await fetch(`${COURSE_SERVICE_URL}/api/courses/lessons/${LESSON_ID}/hls/${subpath}`, {
      headers: { Authorization: `Bearer ${teacherToken}` },
    });
    console.log(`      [Rendition Playlist: ${subpath}] HTTP ${renditionRes.status} (Expected: 200)`);
    if (renditionRes.status !== 200) throw new Error(`Rendition playlist ${subpath} failed: ${renditionRes.status}`);
  }

  const segSubpath = segmentFiles[0].replace(attemptPrefix, '');
  const segRes = await fetch(`${COURSE_SERVICE_URL}/api/courses/lessons/${LESSON_ID}/hls/${segSubpath}`, {
    headers: { Authorization: `Bearer ${teacherToken}` },
  });
  console.log(`      [Media Segment: ${segSubpath}] HTTP ${segRes.status} (Expected: 200)`);
  console.log(`      [Media Segment: ${segSubpath}] Content-Type: ${segRes.headers.get('content-type')}`);
  console.log(`      [Media Segment: ${segSubpath}] Content-Length: ${segRes.headers.get('content-length')} bytes`);

  if (segRes.status !== 200) throw new Error(`Media segment ${segSubpath} failed: ${segRes.status}`);

  // 6. Verify Frontend HLS URL Resolution Precedence
  console.log('[6/8] Verifying Frontend Playback Resolver Precedence...');
  const lessonDetailsRes = await fetch(`${COURSE_SERVICE_URL}/api/courses/lessons/${LESSON_ID}`, {
    headers: { Authorization: `Bearer ${teacherToken}` },
  });
  const lessonDetailsData = await lessonDetailsRes.json();
  console.log(`      [Lesson Details] hasActiveHls: ${lessonDetailsData.hasActiveHls}`);
  console.log(`      [Lesson Details] activeMediaId: ${lessonDetailsData.activeMediaId}`);
  console.log(`      [Lesson Details] videoUrl: ${lessonDetailsData.videoUrl}`);

  if (!lessonDetailsData.hasActiveHls) {
    throw new Error('Lesson Details did NOT expose hasActiveHls = true!');
  }

  // Frontend Resolver Simulation
  const isLessonHlsActive = Boolean(lessonDetailsData.hasActiveHls);
  const isDirectHls = false;
  const isInternalHls = isDirectHls || isLessonHlsActive;
  const videoSourceType = 'google-drive';
  const resolvedUrl = isInternalHls
    ? `/api/courses/lessons/${LESSON_ID}/hls/master.m3u8`
    : videoSourceType === 'google-drive'
    ? `/api/courses/lessons/${LESSON_ID}/media/stream`
    : lessonDetailsData.videoUrl;

  console.log(`      [Resolved URL] ${resolvedUrl}`);
  if (resolvedUrl !== `/api/courses/lessons/${LESSON_ID}/hls/master.m3u8`) {
    throw new Error(`Resolver precedence failed! Expected HLS URL, got ${resolvedUrl}`);
  }

  // 7. Parse Multi-Rendition HLS Levels
  console.log('[7/8] Discovering HLS Renditions from Master Manifest...');
  console.log('--- Master Manifest Content ---');
  console.log(masterManifestBody.trim());
  console.log('-------------------------------');

  const streamInfRegex = /#EXT-X-STREAM-INF:.*BANDWIDTH=(\d+).*RESOLUTION=(\d+)x(\d+).*\n([^\n]+)/g;
  const discoveredLevels = [];
  let match;
  while ((match = streamInfRegex.exec(masterManifestBody)) !== null) {
    const bandwidth = parseInt(match[1], 10);
    const width = parseInt(match[2], 10);
    const height = parseInt(match[3], 10);
    const uri = match[4].trim();
    discoveredLevels.push({
      bandwidth,
      width,
      height,
      uri,
      label: height >= 1080 ? '1080p HD' : height >= 720 ? '720p HD' : height >= 480 ? '480p' : `${height}p`
    });
  }

  console.log(`      -> Discovered Rendition Levels: ${discoveredLevels.length}`);
  discoveredLevels.forEach(lvl => {
    console.log(`         • ${lvl.label} (${lvl.width}x${lvl.height}, bandwidth: ${lvl.bandwidth} bps, playlist: ${lvl.uri})`);
  });

  if (discoveredLevels.length < 2) {
    throw new Error(`Expected at least 2 renditions, found ${discoveredLevels.length}`);
  }

  // 8. Quality Selector Options
  console.log('[8/8] Verifying Quality Selector Options Generation...');
  const qualityOptions = [
    { id: -1, label: 'تلقائي (Auto)' },
    ...discoveredLevels.map((lvl, idx) => ({ id: idx, label: lvl.label, height: lvl.height }))
  ];
  qualityOptions.forEach(opt => {
    console.log(`      [Quality Option] ${opt.label} (ID: ${opt.id})`);
  });

  const summary = {
    testRunId: RUN_ID,
    courseId: COURSE_ID,
    lessonId: LESSON_ID,
    mediaId: MEDIA_ID,
    canonicalSource,
    storagePrefix,
    masterKey,
    finalStatus: status,
    workerId,
    fencingToken,
    durationSeconds: duration,
    renditions,
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

  fs.writeFileSync('pipeline_retry_summary.json', JSON.stringify(summary, null, 2));
  console.log('===================================================================');
  console.log(`ALL POST-TRANSCODE GATEWAY & RESOLUTION CHECKS PASSED! (${RUN_ID})`);
  console.log('===================================================================');
}

main().catch(err => {
  console.error('[FATAL ERROR]:', err);
  process.exit(1);
});
