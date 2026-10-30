import crypto from 'crypto';
import http from 'http';
import https from 'https';
import { Queue } from 'bullmq';
import { db } from '../../../../packages/database/src/index.js';
import { getVideoQueue } from '../controllers/upload.controller.js';
import { getHlsObjectStream } from './storage.adapter.js';

export interface IngestionResult {
  status: 'QUEUED' | 'ALREADY_ACTIVE' | 'ALREADY_IN_FLIGHT' | 'REACTIVATED' | 'ENQUEUE_FAILED';
  mediaId: string;
  mediaGeneration: number;
  message?: string;
}

/**
 * Validates whether a given URL is a legitimate Google Drive video source URL.
 */
export function isGoogleDriveUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:') return false;
    const hostname = parsed.hostname.toLowerCase();
    const isDriveHost =
      hostname === 'drive.google.com' ||
      hostname === 'docs.google.com' ||
      hostname === 'drive.usercontent.google.com' ||
      hostname.endsWith('.drive.google.com') ||
      hostname.endsWith('.docs.google.com');

    if (!isDriveHost) return false;
    return Boolean(extractDriveFileId(url));
  } catch {
    return false;
  }
}

/**
 * Validates whether a given URL is a YouTube URL.
 */
export function isYouTubeUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  try {
    const parsed = new URL(url);
    const hostname = parsed.hostname.toLowerCase();
    return (
      hostname === 'youtube.com' ||
      hostname === 'www.youtube.com' ||
      hostname === 'm.youtube.com' ||
      hostname === 'youtu.be'
    );
  } catch {
    return false;
  }
}

/**
 * Extracts the Google Drive file ID from standard URL formats:
 * - /file/d/{id}/view
 * - ?id={id}
 * - /d/{id}
 */
export function extractDriveFileId(url: string | null | undefined): string | null {
  if (!url) return null;
  const idMatch =
    url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/) ||
    url.match(/[?&]id=([a-zA-Z0-9_-]+)/) ||
    url.match(/\/d\/([a-zA-Z0-9_-]+)/);

  if (!idMatch || !idMatch[1]) return null;
  const fileId = idMatch[1];
  if (fileId.length < 5) return null;
  return fileId;
}

/**
 * Formats canonical source identifier.
 */
export function canonicalizeDriveSource(fileId: string): string {
  return `gdrive:${fileId}`;
}

/**
 * Computes deterministic SHA-256 hash of canonical source identifier.
 */
export function hashCanonicalSource(canonical: string): string {
  return crypto.createHash('sha256').update(canonical).digest('hex');
}

// Test hook for remote completed asset validation
let customAssetValidator: ((masterPlaylistKey: string, storagePrefix: string) => Promise<boolean>) | null = null;

export function setAssetValidatorForTests(
  validator: ((masterPlaylistKey: string, storagePrefix: string) => Promise<boolean>) | null
): void {
  customAssetValidator = validator;
}

/**
 * Validates that a previously completed HLS package still exists and is internally consistent in R2
 * before allowing reactivation of an older generation.
 */
export async function verifyRemoteCompletedAsset(
  masterPlaylistKey: string | null | undefined,
  storagePrefix: string
): Promise<boolean> {
  if (!masterPlaylistKey || !storagePrefix) return false;

  // Key MUST belong to the expected immutable storage prefix
  if (!masterPlaylistKey.startsWith(storagePrefix)) {
    return false;
  }

  if (customAssetValidator) {
    return customAssetValidator(masterPlaylistKey, storagePrefix);
  }

  try {
    // 1. Fetch master playlist stream
    const masterResult = await getHlsObjectStream(masterPlaylistKey);
    if (!masterResult || !masterResult.stream) return false;

    // Read master playlist text
    const chunks: Buffer[] = [];
    for await (const chunk of masterResult.stream as any) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    const masterText = Buffer.concat(chunks).toString('utf8');

    if (!masterText.startsWith('#EXTM3U')) return false;

    // 2. Extract variant playlist relative URIs
    const lines = masterText.split('\n').map((l) => l.trim()).filter(Boolean);
    const variantUris = lines.filter((l) => !l.startsWith('#') && l.endsWith('.m3u8'));
    if (variantUris.length === 0) return false;

    // Check each variant playlist
    const prefixDir = masterPlaylistKey.substring(0, masterPlaylistKey.lastIndexOf('/') + 1);
    for (const vUri of variantUris) {
      if (vUri.includes('..') || vUri.startsWith('/') || vUri.startsWith('\\')) {
        return false;
      }
      const variantKey = `${prefixDir}${vUri}`;
      const variantResult = await getHlsObjectStream(variantKey);
      if (!variantResult || !variantResult.stream) return false;

      const vChunks: Buffer[] = [];
      for await (const chunk of variantResult.stream as any) {
        vChunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      }
      const vText = Buffer.concat(vChunks).toString('utf8');
      if (!vText.includes('#EXT-X-ENDLIST')) return false;

      // Check first segment
      const vLines = vText.split('\n').map((l) => l.trim()).filter(Boolean);
      const firstSegment = vLines.find((l) => !l.startsWith('#') && l.endsWith('.ts'));
      if (firstSegment) {
        const segDir = variantKey.substring(0, variantKey.lastIndexOf('/') + 1);
        const segKey = `${segDir}${firstSegment}`;
        const segResult = await getHlsObjectStream(segKey);
        if (!segResult) return false;
      }
    }

    return true;
  } catch {
    return false;
  }
}

/**
 * Atomically checks idempotency, allocates a generation if needed, and enqueues BullMQ ingestion.
 */
export async function requestDriveIngestion(params: {
  lessonId: string;
  videoUrl: string;
  requesterId?: string;
  requesterRole?: string;
  queue?: Queue;
}): Promise<IngestionResult> {
  const { lessonId, videoUrl, queue = getVideoQueue() } = params;

  const fileId = extractDriveFileId(videoUrl);
  if (!fileId) {
    throw new Error('INVALID_DRIVE_URL: Unable to extract valid Google Drive file ID.');
  }

  const canonicalSource = canonicalizeDriveSource(fileId);
  const sourceUrlHash = hashCanonicalSource(canonicalSource);

  // Execute atomic idempotency and generation allocation transaction
  const allocation = await (db as any).$transaction(async (tx: any) => {
    // 1. Lock Lesson row
    const lessons: any[] = await tx.$queryRaw`
      SELECT id, "courseId", "mediaGeneration", "activeMediaId", "videoUrl"
      FROM "Lesson"
      WHERE id = ${lessonId}
      FOR UPDATE
    `;

    if (!lessons || lessons.length === 0) {
      throw new Error('LESSON_NOT_FOUND: Specified lesson does not exist.');
    }
    const lesson = lessons[0];

    // 2. Query all existing ProcessedMedia records for this lesson, newest generation first
    const existingMedia: any[] = await tx.$queryRaw`
      SELECT id, "mediaGeneration", "canonicalSource", "sourceUrlHash", "status",
             "storagePrefix", "masterPlaylistKey"
      FROM "ProcessedMedia"
      WHERE "lessonId" = ${lessonId}
      ORDER BY "mediaGeneration" DESC
      FOR UPDATE
    `;

    // 3. Concurrency-Safe Idempotency Check
    const matchingMedia = existingMedia.find((pm) => pm.sourceUrlHash === sourceUrlHash);

    if (matchingMedia) {
      // Case A: Existing media is COMPLETED
      if (matchingMedia.status === 'COMPLETED') {
        if (lesson.activeMediaId === matchingMedia.id) {
          // Already active and playing
          return {
            action: 'ALREADY_ACTIVE' as const,
            mediaId: matchingMedia.id,
            mediaGeneration: matchingMedia.mediaGeneration,
          };
        }

        // Reverting to an earlier completed asset: validate remote package before reactivation
        const isRemoteValid = await verifyRemoteCompletedAsset(
          matchingMedia.masterPlaylistKey,
          matchingMedia.storagePrefix
        );

        if (isRemoteValid) {
          // Reactivate previously completed asset atomically
          await tx.$executeRaw`
            UPDATE "Lesson"
            SET "activeMediaId" = ${matchingMedia.id},
                "videoUrl" = ${videoUrl}
            WHERE id = ${lessonId}
          `;

          return {
            action: 'REACTIVATED' as const,
            mediaId: matchingMedia.id,
            mediaGeneration: matchingMedia.mediaGeneration,
          };
        }
        // If remote package invalid, fall through to allocate a new generation!
      }

      // Case B: Existing media is currently PENDING, DOWNLOADING, or TRANSCODING
      if (['PENDING', 'DOWNLOADING', 'TRANSCODING'].includes(matchingMedia.status)) {
        return {
          action: 'ALREADY_IN_FLIGHT' as const,
          mediaId: matchingMedia.id,
          mediaGeneration: matchingMedia.mediaGeneration,
        };
      }
    }

    // 4. Allocate Next Generation
    const nextGeneration = (lesson.mediaGeneration || 0) + 1;

    // Supersede any active in-flight media for previous sources for this lesson
    await tx.$executeRaw`
      UPDATE "ProcessedMedia"
      SET "status" = 'SUPERSEDED',
          "supersededAt" = NOW()
      WHERE "lessonId" = ${lessonId}
        AND "status" IN ('PENDING', 'DOWNLOADING', 'TRANSCODING')
    `;

    // Update lesson videoUrl and mediaGeneration (preserve activeMediaId without clearing)
    await tx.$executeRaw`
      UPDATE "Lesson"
      SET "mediaGeneration" = ${nextGeneration},
          "videoUrl" = ${videoUrl}
      WHERE id = ${lessonId}
    `;

    // Generate new ProcessedMedia ID and prefix
    const newMediaId = crypto.randomUUID();
    const storagePrefix = `videos/${newMediaId}/`;

    // Insert new ProcessedMedia record with fencingToken = 0
    await tx.$executeRaw`
      INSERT INTO "ProcessedMedia" (
        "id", "lessonId", "mediaGeneration", "sourceType", "sourceFileId",
        "canonicalSource", "sourceUrlHash", "storagePrefix", "status",
        "fencingToken", "retryCount", "cleanupToken", "createdAt", "updatedAt"
      ) VALUES (
        ${newMediaId}, ${lessonId}, ${nextGeneration}, 'GOOGLE_DRIVE', ${fileId},
        ${canonicalSource}, ${sourceUrlHash}, ${storagePrefix}, 'PENDING',
        0, 0, 0, NOW(), NOW()
      )
    `;

    return {
      action: 'NEW_ALLOCATION' as const,
      mediaId: newMediaId,
      mediaGeneration: nextGeneration,
      sourceFileId: fileId,
      canonicalSource,
    };
  });

  if (allocation.action === 'ALREADY_ACTIVE') {
    return {
      status: 'ALREADY_ACTIVE',
      mediaId: allocation.mediaId,
      mediaGeneration: allocation.mediaGeneration,
      message: 'Lesson is already actively serving this processed media.',
    };
  }

  if (allocation.action === 'REACTIVATED') {
    return {
      status: 'REACTIVATED',
      mediaId: allocation.mediaId,
      mediaGeneration: allocation.mediaGeneration,
      message: 'Reactivated verified remote HLS asset for reverted source.',
    };
  }

  if (allocation.action === 'ALREADY_IN_FLIGHT') {
    return {
      status: 'ALREADY_IN_FLIGHT',
      mediaId: allocation.mediaId,
      mediaGeneration: allocation.mediaGeneration,
      message: 'Media ingestion is already queued or processing for this source.',
    };
  }

  // 5. Confirmed BullMQ Enqueue (Post-Commit)
  const jobId = `drive-media-${allocation.mediaId}`;
  try {
    await queue.add(
      'transcode-drive-media',
      {
        type: 'DRIVE_INGESTION',
        mediaId: allocation.mediaId,
        lessonId,
        mediaGeneration: allocation.mediaGeneration,
        canonicalSource: allocation.canonicalSource,
        sourceFileId: allocation.sourceFileId,
      },
      {
        jobId,
        attempts: 3,
        backoff: { type: 'exponential', delay: 15000 },
        removeOnComplete: { count: 100 },
        removeOnFail: { count: 500 },
      }
    );

    return {
      status: 'QUEUED',
      mediaId: allocation.mediaId,
      mediaGeneration: allocation.mediaGeneration,
      message: 'Ingestion job successfully queued.',
    };
  } catch (err: any) {
    // Record enqueue failure on ProcessedMedia record without claiming success
    const sanitizedMsg = err.message ? err.message.slice(0, 300) : 'Queue connection error';
    await (db as any).$executeRaw`
      UPDATE "ProcessedMedia"
      SET "retryCount" = "retryCount" + 1,
          "errorMessage" = ${`BullMQ Enqueue Failed: ${sanitizedMsg}`}
      WHERE id = ${allocation.mediaId}
    `.catch(() => {});

    return {
      status: 'ENQUEUE_FAILED',
      mediaId: allocation.mediaId,
      mediaGeneration: allocation.mediaGeneration,
      message: `Database committed generation, but queue enqueue failed: ${sanitizedMsg}`,
    };
  }
}

/**
 * Idempotent recovery sweeper for PENDING media records whose queue delivery failed or was interrupted.
 */
export async function recoverPendingDriveIngestions(
  queue: Queue,
  options: { maxAgeMs?: number; maxRetries?: number } = {}
): Promise<{ evaluated: number; reEnqueued: number; failed: number; superseded: number }> {
  const { maxAgeMs = 30000, maxRetries = 3 } = options;
  const cutoffDate = new Date(Date.now() - maxAgeMs);

  const pendingRecords: any[] = await (db as any).$queryRaw`
    SELECT pm.id, pm."lessonId", pm."mediaGeneration", pm."canonicalSource", pm."sourceFileId",
           pm."retryCount", l."mediaGeneration" as "currentLessonGeneration"
    FROM "ProcessedMedia" pm
    JOIN "Lesson" l ON pm."lessonId" = l.id
    WHERE pm."status" = 'PENDING'
      AND pm."createdAt" < ${cutoffDate}
    LIMIT 50
  `;

  let evaluated = 0;
  let reEnqueued = 0;
  let failed = 0;
  let superseded = 0;

  for (const pm of pendingRecords) {
    evaluated++;
    const jobId = `drive-media-${pm.id}`;

    // If lesson has already advanced past this generation, supersede it
    if (pm.currentLessonGeneration > pm.mediaGeneration) {
      await (db as any).$executeRaw`
        UPDATE "ProcessedMedia"
        SET "status" = 'SUPERSEDED', "supersededAt" = NOW()
        WHERE id = ${pm.id} AND "status" = 'PENDING'
      `;
      superseded++;
      continue;
    }

    let existingJob: any = null;
    try {
      existingJob = await queue.getJob(jobId);
    } catch {
      // Ambiguous queue error: do not mark FAILED, retry on next cycle
      continue;
    }

    if (existingJob) {
      const state = await existingJob.getState().catch(() => 'unknown');
      if (['active', 'waiting', 'delayed'].includes(state)) {
        // Job is already safely progressing in Redis
        continue;
      }
      if (state === 'failed' || state === 'completed') {
        await existingJob.remove().catch(() => {});
      }
    }

    if (pm.retryCount >= maxRetries) {
      await (db as any).$executeRaw`
        UPDATE "ProcessedMedia"
        SET "status" = 'FAILED',
            "errorMessage" = 'Queue delivery timed out after maximum recovery retries'
        WHERE id = ${pm.id} AND "status" = 'PENDING'
      `;
      failed++;
      continue;
    }

    try {
      await queue.add(
        'transcode-drive-media',
        {
          type: 'DRIVE_INGESTION',
          mediaId: pm.id,
          lessonId: pm.lessonId,
          mediaGeneration: pm.mediaGeneration,
          canonicalSource: pm.canonicalSource,
          sourceFileId: pm.sourceFileId,
        },
        {
          jobId,
          attempts: 3,
          backoff: { type: 'exponential', delay: 15000 },
          removeOnComplete: { count: 100 },
          removeOnFail: { count: 500 },
        }
      );

      await (db as any).$executeRaw`
        UPDATE "ProcessedMedia"
        SET "retryCount" = "retryCount" + 1,
            "errorMessage" = NULL
        WHERE id = ${pm.id} AND "status" = 'PENDING'
      `;
      reEnqueued++;
    } catch (err: any) {
      await (db as any).$executeRaw`
        UPDATE "ProcessedMedia"
        SET "retryCount" = "retryCount" + 1,
            "errorMessage" = ${`Recovery enqueue attempt failed: ${err.message ? err.message.slice(0, 200) : 'unknown'}`}
        WHERE id = ${pm.id} AND "status" = 'PENDING'
      `;
    }
  }

  return { evaluated, reEnqueued, failed, superseded };
}

let recoveryTimer: NodeJS.Timeout | null = null;
let isSweeping = false;

/**
 * Runs a single recovery sweep with an in-flight concurrency guard to prevent
 * overlapping executions within the same process.
 */
export async function runDriveIngestionSweep(queue: Queue = getVideoQueue()): Promise<{
  evaluated: number;
  reEnqueued: number;
  failed: number;
  superseded: number;
  skippedDueToOverlap?: boolean;
}> {
  if (isSweeping) {
    return { evaluated: 0, reEnqueued: 0, failed: 0, superseded: 0, skippedDueToOverlap: true };
  }

  isSweeping = true;
  try {
    const result = await recoverPendingDriveIngestions(queue);
    return result;
  } catch (err: any) {
    // Rejections caught safely to prevent unhandled promise rejections in timer callbacks.
    // Does NOT mark records FAILED on temporary Redis / queue errors.
    return { evaluated: 0, reEnqueued: 0, failed: 0, superseded: 0 };
  } finally {
    isSweeping = false;
  }
}

/**
 * Starts the periodic recovery scheduler after service startup.
 * Runs an initial recovery pass immediately, then repeats every intervalMs (default 60s).
 */
export function startDriveIngestionRecoveryScheduler(
  queue: Queue = getVideoQueue(),
  intervalMs = 60000
): NodeJS.Timeout | null {
  if (recoveryTimer) return recoveryTimer;

  // Initial recovery pass after startup
  runDriveIngestionSweep(queue).catch(() => {});

  // Periodic interval
  recoveryTimer = setInterval(() => {
    runDriveIngestionSweep(queue).catch(() => {});
  }, intervalMs);

  return recoveryTimer;
}

/**
 * Stops the recovery scheduler and clears any running timer during graceful shutdown.
 */
export function stopDriveIngestionRecoveryScheduler(): void {
  if (recoveryTimer) {
    clearInterval(recoveryTimer);
    recoveryTimer = null;
  }
}

export function isRecoverySchedulerRunning(): boolean {
  return recoveryTimer !== null;
}
