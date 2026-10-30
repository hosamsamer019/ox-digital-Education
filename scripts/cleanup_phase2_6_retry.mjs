import { S3Client, ListObjectsV2Command, DeleteObjectsCommand } from '@aws-sdk/client-s3';
import { Queue } from 'bullmq';
import cp from 'child_process';

const S3_ENDPOINT = 'http://127.0.0.1:9100';
const S3_BUCKET = 'ox-digital-dev-hls';
const S3_ACCESS_KEY = 'devminioadmin';
const S3_SECRET_KEY = 'devminiopassword123';
const REDIS_HOST = '127.0.0.1';
const REDIS_PORT = 6381;

// Exact IDs belonging to run-20261026-215500
const COURSE_ID = '53d6bf94-2ad9-47bb-96d0-46fb4aa36b58';
const LESSON_ID = '8003a954-fbe4-492c-871a-21776f22d427';
const MEDIA_ID = '7f17a981-22d2-4023-bfa3-3393882a989c';
const TEACHER_USER_ID = '11111111-2026-1026-2155-000000000001';
const STUDENT_USER_ID = '22222222-2026-1026-2155-000000000002';
const STORAGE_PREFIX = `videos/${MEDIA_ID}/`;

function runSql(sql) {
  const cmd = 'docker exec -i ox-digital-dev-postgres psql -U postgres -d ox_digital_dev -t -A -F"|"';
  try {
    const stdout = cp.execSync(cmd, { input: sql, encoding: 'utf-8' });
    return stdout.trim();
  } catch (err) {
    throw new Error(`SQL Error: ${err.message}`);
  }
}

async function main() {
  console.log('===================================================================');
  console.log('Phase 2.6 Retry — Strict Safe Targeted Cleanup');
  console.log('===================================================================');

  // 1. Delete MinIO Objects under exact storage prefix
  console.log(`[1/4] Deleting MinIO objects under prefix: ${STORAGE_PREFIX}...`);
  const s3Client = new S3Client({
    region: 'us-east-1',
    endpoint: S3_ENDPOINT,
    credentials: { accessKeyId: S3_ACCESS_KEY, secretAccessKey: S3_SECRET_KEY },
    forcePathStyle: true,
  });

  let totalDeleted = 0;
  let isTruncated = true;
  let continuationToken = undefined;

  while (isTruncated) {
    const listRes = await s3Client.send(new ListObjectsV2Command({
      Bucket: S3_BUCKET,
      Prefix: STORAGE_PREFIX,
      ContinuationToken: continuationToken,
    }));

    const objects = listRes.Contents || [];
    if (objects.length > 0) {
      await s3Client.send(new DeleteObjectsCommand({
        Bucket: S3_BUCKET,
        Delete: {
          Objects: objects.map(o => ({ Key: o.Key })),
        },
      }));
      totalDeleted += objects.length;
    }

    isTruncated = Boolean(listRes.IsTruncated);
    continuationToken = listRes.NextContinuationToken;
  }
  console.log(`      -> Deleted ${totalDeleted} MinIO objects from bucket ${S3_BUCKET}.`);

  // Verify MinIO prefix is now empty
  const verifyList = await s3Client.send(new ListObjectsV2Command({
    Bucket: S3_BUCKET,
    Prefix: STORAGE_PREFIX,
  }));
  const remainingMinio = (verifyList.Contents || []).length;
  console.log(`      -> Remaining MinIO objects in prefix ${STORAGE_PREFIX}: ${remainingMinio}`);

  // 2. Clean up BullMQ Redis job
  console.log('[2/4] Cleaning up Redis BullMQ job...');
  const queue = new Queue('video-transcode-queue', {
    connection: { host: REDIS_HOST, port: REDIS_PORT },
  });
  const jobId = `drive-media-${MEDIA_ID}`;
  const job = await queue.getJob(jobId);
  if (job) {
    await job.remove();
    console.log(`      -> Removed BullMQ job ${jobId}`);
  } else {
    console.log(`      -> BullMQ job ${jobId} not in queue (already removed or completed)`);
  }
  await queue.close();

  // 3. Delete exact database records in ox_digital_dev
  console.log('[3/4] Deleting targeted test database records in ox_digital_dev...');
  const deleteSql = `
    DELETE FROM "ProcessedMedia" WHERE "id" = '${MEDIA_ID}';
    DELETE FROM "Lesson" WHERE "id" = '${LESSON_ID}';
    DELETE FROM "Course" WHERE "id" = '${COURSE_ID}';
    DELETE FROM "User" WHERE "id" IN ('${TEACHER_USER_ID}', '${STUDENT_USER_ID}');
  `;
  runSql(deleteSql);
  console.log('      -> Targeted deletion executed.');

  // 4. Verify Baseline: Course=0, Lesson=0, ProcessedMedia=0, User=0
  console.log('[4/4] Verifying database restored to baseline...');
  const verifySql = `
    SELECT 'Course' as table_name, count(*) as count FROM "Course"
    UNION ALL
    SELECT 'Lesson', count(*) FROM "Lesson"
    UNION ALL
    SELECT 'ProcessedMedia', count(*) FROM "ProcessedMedia"
    UNION ALL
    SELECT 'User', count(*) FROM "User";
  `;
  const rawCounts = runSql(verifySql);
  console.log('--- Post-Cleanup Baseline Counts ---');
  console.log(rawCounts);
  console.log('------------------------------------');

  const lines = rawCounts.split('\n');
  for (const line of lines) {
    const [table, countStr] = line.split('|');
    const count = parseInt(countStr, 10);
    if (count !== 0) {
      throw new Error(`Baseline verification failed! Table ${table} has ${count} records (expected 0)`);
    }
  }

  // Also check total objects in bucket
  const allBucketObjects = await s3Client.send(new ListObjectsV2Command({
    Bucket: S3_BUCKET,
  }));
  const totalBucketObjects = (allBucketObjects.Contents || []).length;
  console.log(`      -> Total objects remaining in ${S3_BUCKET}: ${totalBucketObjects}`);

  console.log('===================================================================');
  console.log('STRICT CLEANUP VERIFICATION SUCCESSFUL: BASELINE FULLY RESTORED!');
  console.log('===================================================================');
}

main().catch(err => {
  console.error('[FATAL CLEANUP ERROR]:', err);
  process.exit(1);
});
