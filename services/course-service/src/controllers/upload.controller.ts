import { Response } from 'express';
import { generateSignedUploadUrl, getActiveBackend } from '../services/storage.adapter.js';
import { db } from '../../../../packages/database/src/index.js';
import { AuthRequest } from '../middlewares/auth.middleware.js';

export const requestUploadUrl = async (req: AuthRequest, res: Response) => {
  try {
    const { filename, mimetype, fileSize } = req.body;
    const userId = req.user?.userId;

    if (!userId) return res.status(401).json({ message: 'Unauthorized' });
    if (!filename || !mimetype || !fileSize) {
      return res.status(400).json({ message: 'Missing file metadata' });
    }

    // 1. Validate File MIME Type and Extension
    const allowedMimeTypes = ['video/mp4', 'video/quicktime', 'video/x-matroska', 'video/webm'];
    const allowedExtensions = ['.mp4', '.mov', '.mkv', '.webm'];
    
    if (!allowedMimeTypes.includes(mimetype)) {
      return res.status(400).json({ message: `Invalid MIME type. Allowed: ${allowedMimeTypes.join(', ')}` });
    }

    const fileExt = filename.substring(filename.lastIndexOf('.')).toLowerCase();
    if (!allowedExtensions.includes(fileExt)) {
      return res.status(400).json({ message: `Invalid file extension. Allowed: ${allowedExtensions.join(', ')}` });
    }

    const MAX_FILE_SIZE = 5 * 1024 * 1024 * 1024; // 5GB limit
    if (fileSize > MAX_FILE_SIZE) {
      return res.status(400).json({ message: 'File exceeds 5GB limit' });
    }

    // 1. Generate Cloudflare R2 Signed URL
    const { signedUrl, storagePath, backend } = await generateSignedUploadUrl(
      userId,
      filename,
      mimetype,
      fileSize
    );

    // 2. Create VideoUpload record in database with PENDING status
    const upload = await (db as any).videoUpload.create({
      data: {
        userId,
        filename,
        storagePath,
        mimeType: mimetype,
        fileSize,
        status: 'PENDING'
      }
    });

    res.status(200).json({
      uploadId: upload.id,
      signedUrl,
      storagePath,
      backend
    });
  } catch (error: any) {
    res.status(500).json({ message: 'Failed to generate upload URL', error: error.message });
  }
};

import { Queue } from 'bullmq';

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
let videoQueue: Queue | null = null;

export function getVideoQueue(): Queue {
  if (!videoQueue) {
    const url = new URL(REDIS_URL);
    videoQueue = new Queue('video-transcode-queue', {
      connection: {
        host: url.hostname,
        port: parseInt(url.port || '6379', 10),
        username: url.username || undefined,
        password: url.password || undefined
      }
    });
  }
  return videoQueue;
}

export async function closeVideoQueue(): Promise<void> {
  if (videoQueue) {
    await videoQueue.close();
    videoQueue = null;
  }
}

export const completeUpload = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user?.userId;

    const upload = await (db as any).videoUpload.findUnique({ where: { id } });
    if (!upload) return res.status(404).json({ message: 'Upload not found' });
    if (upload.userId !== userId) return res.status(403).json({ message: 'Forbidden' });

    // 1. Idempotency guard: If already completed in DB, return idempotent success
    if (upload.status === 'COMPLETED') {
      return res.status(200).json({ message: 'Upload already completed', upload });
    }

    // Safety guard: Reject if storagePath points to an HLS manifest rather than raw upload
    if (upload.storagePath && (upload.storagePath.endsWith('.m3u8') || upload.storagePath.includes('/hls/'))) {
      return res.status(400).json({
        message: 'Invalid upload: storagePath points to an HLS playlist rather than a raw source video.',
        upload
      });
    }

    const queue = getVideoQueue();
    const jobId = `transcode-${id}`;

    // 2. Query BullMQ to inspect existing job state in Redis
    let existingJob = null;
    try {
      existingJob = await queue.getJob(jobId);
    } catch (err: any) {
      console.warn(`[BullMQ] Warning checking job ${jobId}:`, err.message);
    }

    if (existingJob) {
      const state = await existingJob.getState();

      // If active, waiting, or delayed, job is already progressing safely in BullMQ
      if (state === 'active' || state === 'waiting' || state === 'delayed') {
        if (upload.status === 'PENDING') {
          await (db as any).videoUpload.update({
            where: { id },
            data: { status: 'UPLOAD_COMPLETED' }
          });
        }
        return res.status(200).json({
          message: 'Upload is already queued or being processed',
          upload: { ...upload, status: upload.status === 'PENDING' ? 'UPLOAD_COMPLETED' : upload.status }
        });
      }

      // If failed or stale completed in BullMQ, remove stale job so we can safely re-enqueue fresh attempt
      if (state === 'failed' || state === 'completed') {
        await existingJob.remove();
      }
    }

    // 3. Await queue insertion explicitly before updating database or reporting success
    await queue.add(
      'transcode',
      { uploadId: id, storagePath: upload.storagePath },
      {
        jobId,
        attempts: 3,
        backoff: { type: 'exponential', delay: 15000 },
        removeOnComplete: { count: 100 },
        removeOnFail: { count: 500 }
      }
    );

    // 4. Transition database status to UPLOAD_COMPLETED only after queue insertion succeeds
    const updated = await (db as any).videoUpload.update({
      where: { id },
      data: {
        status: 'UPLOAD_COMPLETED',
        errorMessage: null
      }
    });

    res.status(200).json({ message: 'Upload completed and queued for processing', upload: updated });
  } catch (error: any) {
    console.error('Failed to complete upload and queue job:', error);
    res.status(500).json({ message: 'Failed to complete upload and queue job', error: error.message });
  }
};

export const getUploadStatus = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user?.userId;

    const upload = await (db as any).videoUpload.findUnique({ where: { id } });
    if (!upload) return res.status(404).json({ message: 'Upload not found' });
    if (upload.userId !== userId) return res.status(403).json({ message: 'Forbidden' });

    res.status(200).json(upload);
  } catch (error: any) {
    res.status(500).json({ message: 'Failed to fetch status', error: error.message });
  }
};
