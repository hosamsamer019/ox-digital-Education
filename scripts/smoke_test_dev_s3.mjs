import {
  S3Client,
  CreateBucketCommand,
  PutObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  GetObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import { randomUUID } from 'crypto';

const ENDPOINT = process.env.DEV_S3_ENDPOINT || 'http://127.0.0.1:9100';
const BUCKET = process.env.DEV_S3_BUCKET || 'ox-digital-dev-hls';
const ACCESS_KEY = process.env.DEV_S3_ACCESS_KEY || 'devminioadmin';
const SECRET_KEY = process.env.DEV_S3_SECRET_KEY || 'devminiopassword123';

// 1. Mandatory Safety Assertions: Never touch production R2 or external cloud
try {
  const parsedUrl = new URL(ENDPOINT);
  const hostname = parsedUrl.hostname;
  const isAllowedHost = hostname === '127.0.0.1' || hostname === 'localhost' || hostname === 'ox-digital-dev-minio';

  if (!isAllowedHost) {
    console.error(`[SMOKE-TEST FATAL] Non-local endpoint rejected: ${hostname}`);
    process.exit(1);
  }

  if (ENDPOINT.includes('r2.cloudflarestorage.com') || ENDPOINT.includes('amazonaws.com')) {
    console.error('[SMOKE-TEST FATAL] Production cloud storage endpoint detected. Aborting immediately.');
    process.exit(1);
  }

  if (BUCKET === 'platform-videos-prod' || BUCKET.toLowerCase().includes('prod')) {
    console.error(`[SMOKE-TEST FATAL] Production bucket name rejected: ${BUCKET}`);
    process.exit(1);
  }
} catch (err) {
  console.error(`[SMOKE-TEST FATAL] Invalid S3 endpoint URL: ${err.message}`);
  process.exit(1);
}

const s3Client = new S3Client({
  region: 'us-east-1',
  endpoint: ENDPOINT,
  credentials: {
    accessKeyId: ACCESS_KEY,
    secretAccessKey: SECRET_KEY,
  },
  forcePathStyle: true,
});

async function streamToString(stream) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    stream.on('data', (chunk) => chunks.push(chunk));
    stream.on('error', reject);
    stream.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')));
  });
}

async function runSmokeTest() {
  console.log(`[SMOKE-TEST] Initializing MinIO S3 Smoke Test on bucket: ${BUCKET}`);
  const runId = `${Date.now()}-${randomUUID()}`;
  const prefix = `dev-smoke-test/${runId}/`;
  const manifestKey = `${prefix}manifest.m3u8`;
  const segmentKey = `${prefix}segment0.ts`;

  const createdKeys = [];
  let testPassed = false;

  const manifestContent = '#EXTM3U\n#EXT-X-VERSION:3\n#EXT-X-TARGETDURATION:10\n#EXTINF:10.0,\nsegment0.ts\n#EXT-X-ENDLIST\n';
  const segmentContent = Buffer.from('TEST_HLS_MOCK_MPEGTS_BINARY_DATA_0123456789');

  try {
    // 0. Ensure bucket exists in local MinIO
    console.log(`[SMOKE-TEST] 0. Ensuring development bucket '${BUCKET}' exists...`);
    try {
      await s3Client.send(new CreateBucketCommand({ Bucket: BUCKET }));
      console.log(`[SMOKE-TEST]    -> Bucket '${BUCKET}' created successfully.`);
    } catch (err) {
      if (err.name === 'BucketAlreadyOwnedByYou' || err.name === 'BucketAlreadyExists') {
        console.log(`[SMOKE-TEST]    -> Bucket '${BUCKET}' already exists.`);
      } else {
        throw err;
      }
    }

    // 1. Upload Test Files
    console.log(`[SMOKE-TEST] 1. Uploading test objects under prefix: ${prefix}`);
    await s3Client.send(
      new PutObjectCommand({
        Bucket: BUCKET,
        Key: manifestKey,
        Body: manifestContent,
        ContentType: 'application/vnd.apple.mpegurl',
      })
    );
    createdKeys.push(manifestKey);

    await s3Client.send(
      new PutObjectCommand({
        Bucket: BUCKET,
        Key: segmentKey,
        Body: segmentContent,
        ContentType: 'video/mp2t',
      })
    );
    createdKeys.push(segmentKey);
    console.log(`[SMOKE-TEST]    -> Successfully uploaded ${createdKeys.length} objects.`);

    // 2. HeadObject Verification
    console.log(`[SMOKE-TEST] 2. Verifying object metadata (HeadObject)...`);
    const headManifest = await s3Client.send(
      new HeadObjectCommand({
        Bucket: BUCKET,
        Key: manifestKey,
      })
    );
    if (headManifest.ContentType !== 'application/vnd.apple.mpegurl') {
      throw new Error(`Expected ContentType 'application/vnd.apple.mpegurl', got '${headManifest.ContentType}'`);
    }
    if (Number(headManifest.ContentLength) !== Buffer.byteLength(manifestContent)) {
      throw new Error(`Expected ContentLength ${Buffer.byteLength(manifestContent)}, got ${headManifest.ContentLength}`);
    }
    console.log(`[SMOKE-TEST]    -> HeadObject verified: Size=${headManifest.ContentLength}, Type=${headManifest.ContentType}`);

    // 3. ListObjectsV2 Verification
    console.log(`[SMOKE-TEST] 3. Verifying prefix listing (ListObjectsV2)...`);
    const listRes = await s3Client.send(
      new ListObjectsV2Command({
        Bucket: BUCKET,
        Prefix: prefix,
      })
    );
    const listedKeys = (listRes.Contents || []).map((o) => o.Key);
    if (!listedKeys.includes(manifestKey) || !listedKeys.includes(segmentKey)) {
      throw new Error(`ListObjectsV2 did not return expected keys: ${JSON.stringify(listedKeys)}`);
    }
    console.log(`[SMOKE-TEST]    -> ListObjectsV2 verified: Found ${listedKeys.length} keys under prefix.`);

    // 4. GetObject Readback Verification
    console.log(`[SMOKE-TEST] 4. Verifying readback fidelity (GetObject)...`);
    const getRes = await s3Client.send(
      new GetObjectCommand({
        Bucket: BUCKET,
        Key: manifestKey,
      })
    );
    const readbackContent = await streamToString(getRes.Body);
    if (readbackContent !== manifestContent) {
      throw new Error('Readback content does not match uploaded content byte-for-byte.');
    }
    console.log(`[SMOKE-TEST]    -> Readback verified: Byte-for-byte fidelity confirmed.`);

    testPassed = true;
  } finally {
    // 5. Deterministic Teardown: Delete only the keys created during this test
    console.log(`[SMOKE-TEST] 5. Cleaning up created smoke test keys...`);
    for (const key of createdKeys) {
      try {
        await s3Client.send(
          new DeleteObjectCommand({
            Bucket: BUCKET,
            Key: key,
          })
        );
        console.log(`[SMOKE-TEST]    -> Deleted test object: ${key}`);
      } catch (delErr) {
        console.warn(`[SMOKE-TEST]    -> Warning: Failed to delete ${key}: ${delErr.message}`);
      }
    }
  }

  if (testPassed) {
    console.log('[SMOKE-TEST] S3 Compatibility Smoke Test PASSED successfully (Upload -> HEAD -> List -> Readback -> Clean Teardown).');
    process.exit(0);
  } else {
    console.error('[SMOKE-TEST] S3 Smoke Test FAILED.');
    process.exit(1);
  }
}

runSmokeTest().catch((err) => {
  console.error('[SMOKE-TEST FATAL ERROR]:', err.message);
  process.exit(1);
});
