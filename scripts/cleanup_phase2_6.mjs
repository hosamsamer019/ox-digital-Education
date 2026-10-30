import { Queue } from 'bullmq';
import cp from 'child_process';
import { S3Client, ListObjectsV2Command, DeleteObjectsCommand } from '@aws-sdk/client-s3';

const TEST_RUN_ID = 'run-20261026-190000';
const TEST_TEACHER_ID = '11111111-2026-1026-1900-000000000001';
const TEST_STUDENT_ID = '22222222-2026-1026-1900-000000000002';
const TEST_COURSE_ID = '85ed3b66-4104-446c-8823-77a88069bbaf';
const TEST_LESSON_ID = '0f67ed76-f3a7-4437-a01b-739928be9f20';
const TEST_MEDIA_ID = 'e3e408af-0471-4720-954c-847d68243fe0';
const STORAGE_PREFIX = `videos/${TEST_MEDIA_ID}/`;
const JOB_ID = `drive-media-${TEST_MEDIA_ID}`;

function runSql(sql) {
  const cmd = `docker exec -i ox-digital-dev-postgres psql -U postgres -d ox_digital_dev -c "${sql.replace(/"/g, '\\"')}"`;
  return cp.execSync(cmd, { encoding: 'utf-8' }).trim();
}

async function cleanup() {
  console.log(`[CLEANUP] Starting safe teardown for test run ${TEST_RUN_ID}...`);

  // 1. Remove BullMQ Job from development Redis
  console.log(`[1/4] Cleaning BullMQ job ${JOB_ID}...`);
  const queue = new Queue('video-transcode-queue', {
    connection: { host: '127.0.0.1', port: 6381 },
  });
  const job = await queue.getJob(JOB_ID);
  if (job) {
    await job.remove();
    console.log(`      -> Successfully removed BullMQ job ${JOB_ID}`);
  } else {
    console.log(`      -> Job ${JOB_ID} not found in BullMQ.`);
  }
  await queue.close();

  // 2. Clean MinIO storage under exact test prefix
  console.log(`[2/4] Verifying and cleaning MinIO objects under ${STORAGE_PREFIX}...`);
  const s3 = new S3Client({
    region: 'us-east-1',
    endpoint: 'http://127.0.0.1:9100',
    credentials: { accessKeyId: 'devminioadmin', secretAccessKey: 'devminiopassword123' },
    forcePathStyle: true,
  });

  const listRes = await s3.send(new ListObjectsV2Command({
    Bucket: 'ox-digital-dev-hls',
    Prefix: STORAGE_PREFIX,
  }));

  if (listRes.Contents && listRes.Contents.length > 0) {
    const deleteObjects = listRes.Contents.map(o => ({ Key: o.Key }));
    await s3.send(new DeleteObjectsCommand({
      Bucket: 'ox-digital-dev-hls',
      Delete: { Objects: deleteObjects },
    }));
    console.log(`      -> Deleted ${deleteObjects.length} objects from MinIO.`);
  } else {
    console.log(`      -> No MinIO objects found under ${STORAGE_PREFIX}.`);
  }

  // 3. Clean database records in strict dependency order
  console.log('[3/4] Deleting test records from ox_digital_dev...');
  
  // a. Clear Lesson.activeMediaId if referencing test media
  runSql(`UPDATE "Lesson" SET "activeMediaId" = NULL WHERE id = '${TEST_LESSON_ID}';`);
  
  // b. Delete ProcessedMedia
  const delPm = runSql(`DELETE FROM "ProcessedMedia" WHERE id = '${TEST_MEDIA_ID}';`);
  console.log(`      -> ProcessedMedia: ${delPm}`);

  // c. Delete Lesson
  const delLesson = runSql(`DELETE FROM "Lesson" WHERE id = '${TEST_LESSON_ID}';`);
  console.log(`      -> Lesson: ${delLesson}`);

  // d. Delete Course
  const delCourse = runSql(`DELETE FROM "Course" WHERE id = '${TEST_COURSE_ID}';`);
  console.log(`      -> Course: ${delCourse}`);

  // e. Delete Users
  const delUsers = runSql(`DELETE FROM "User" WHERE id IN ('${TEST_TEACHER_ID}', '${TEST_STUDENT_ID}');`);
  console.log(`      -> Users: ${delUsers}`);

  // 4. Verify post-cleanup baseline
  console.log('[4/4] Verifying clean post-cleanup database state...');
  const countOutput = runSql(`
    SELECT 'Course' as tbl, count(*) FROM "Course"
    UNION ALL SELECT 'Lesson', count(*) FROM "Lesson"
    UNION ALL SELECT 'ProcessedMedia', count(*) FROM "ProcessedMedia"
    UNION ALL SELECT 'User', count(*) FROM "User";
  `);
  console.log(countOutput);
  console.log(`[CLEANUP] Teardown complete for ${TEST_RUN_ID}.`);
}

cleanup().catch((err) => {
  console.error('[CLEANUP ERROR]:', err);
  process.exit(1);
});
