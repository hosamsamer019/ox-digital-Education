import { Worker, Job, UnrecoverableError } from 'bullmq';
import { logger, initSentry } from '@shared/utils';
import { db } from '@smartmath/database';
import {
  S3Client,
  GetObjectCommand,
  PutObjectCommand,
  DeleteObjectsCommand,
  ListObjectsV2Command,
  HeadObjectCommand
} from '@aws-sdk/client-s3';
import fs from 'fs';
import path from 'path';
import http from 'http';
import https from 'https';
import { pipeline } from 'stream/promises';
import { spawn, ChildProcess } from 'child_process';

// Initialize Sentry for background worker
initSentry('video-worker');

const requiredWorkerEnv = [
  'DATABASE_URL',
  'REDIS_URL',
  'CLOUDFLARE_R2_ENDPOINT',
  'CLOUDFLARE_R2_ACCESS_KEY_ID',
  'CLOUDFLARE_R2_SECRET_ACCESS_KEY',
  'CLOUDFLARE_R2_BUCKET_NAME',
];

const missingWorkerEnv = requiredWorkerEnv.filter((key) => !process.env[key]);
if (missingWorkerEnv.length > 0) {
  logger.error(`[FATAL] video-worker missing required environment variables: ${missingWorkerEnv.join(', ')}`);
  process.exit(1);
}

const REDIS_URL = process.env.REDIS_URL!;
const R2_ENDPOINT = process.env.CLOUDFLARE_R2_ENDPOINT!;
const R2_ACCESS_KEY = process.env.CLOUDFLARE_R2_ACCESS_KEY_ID!;
const R2_SECRET_KEY = process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY!;
const R2_BUCKET = process.env.CLOUDFLARE_R2_BUCKET_NAME!;

// Strict Development Storage Allowlist Guard
if (process.env.NODE_ENV !== 'production') {
  const allowedEndpoints = [
    'http://ox-digital-dev-minio:9000',
    'http://127.0.0.1:9100',
    'http://localhost:9100',
  ];

  if (!allowedEndpoints.includes(R2_ENDPOINT)) {
    logger.error(
      '[FATAL] Development video-worker rejected non-allowlisted storage endpoint. Production R2/AWS endpoints are strictly forbidden in development.'
    );
    process.exit(1);
  }

  if (R2_BUCKET !== 'ox-digital-dev-hls') {
    logger.error(
      '[FATAL] Development video-worker rejected non-allowlisted bucket name. Only ox-digital-dev-hls is permitted in development.'
    );
    process.exit(1);
  }
}

const s3Client = new S3Client({
  region: 'auto',
  endpoint: R2_ENDPOINT,
  credentials: {
    accessKeyId: R2_ACCESS_KEY,
    secretAccessKey: R2_SECRET_KEY,
  },
  forcePathStyle: process.env.S3_FORCE_PATH_STYLE === 'true',
});

interface VideoTranscodeJob {
  uploadId: string;
  storagePath: string; // The raw source S3 Key
}

interface ProbeResult {
  width: number;
  height: number;
  effectiveWidth: number;
  effectiveHeight: number;
  fps: number;
  duration: number;
  hasAudio: boolean;
  audioCodec?: string;
  audioChannels?: number;
  audioSampleRate?: number;
}

interface RenditionConfig {
  name: string;
  width: number;
  height: number;
  vBitrate: string;
  maxrate: string;
  bufsize: string;
  profile: string;
  level: string;
  aBitrate: string;
  baseBandwidth: number;
  avgBandwidth: number;
  codecs: string;
}

// Master rendition templates (16:9 bounding boxes, downscale-only)
const MASTER_RENDITIONS: RenditionConfig[] = [
  {
    name: '1080p',
    width: 1920,
    height: 1080,
    vBitrate: '4500k',
    maxrate: '4800k',
    bufsize: '9000k',
    profile: 'high',
    level: '4.2',
    aBitrate: '128k',
    baseBandwidth: 5200000,
    avgBandwidth: 4628000,
    codecs: 'avc1.64002a,mp4a.40.2'
  },
  {
    name: '720p',
    width: 1280,
    height: 720,
    vBitrate: '2500k',
    maxrate: '2700k',
    bufsize: '5000k',
    profile: 'main',
    level: '3.1',
    aBitrate: '128k',
    baseBandwidth: 2900000,
    avgBandwidth: 2628000,
    codecs: 'avc1.4d401f,mp4a.40.2'
  },
  {
    name: '480p',
    width: 854,
    height: 480,
    vBitrate: '1200k',
    maxrate: '1300k',
    bufsize: '2400k',
    profile: 'main',
    level: '3.1',
    aBitrate: '96k',
    baseBandwidth: 1400000,
    avgBandwidth: 1296000,
    codecs: 'avc1.4d401f,mp4a.40.2'
  },
  {
    name: '360p',
    width: 640,
    height: 360,
    vBitrate: '600k',
    maxrate: '650k',
    bufsize: '1200k',
    profile: 'baseline',
    level: '3.0',
    aBitrate: '64k',
    baseBandwidth: 700000,
    avgBandwidth: 664000,
    codecs: 'avc1.42c01e,mp4a.40.2'
  }
];

// Active child process reference for graceful SIGTERM termination
let activeFfmpegChild: ChildProcess | null = null;
let currentWorkDir: string | null = null;

logger.info('🎥 Video Worker Initializing (Multi-Rendition HLS Pipeline)...');

/**
 * Sanitize error messages to prevent leaking signed URLs, tokens, or credentials
 */
function sanitizeErrorMessage(msg: string): string {
  if (!msg) return 'Unknown error occurred during video processing';
  return msg
    .replace(/https?:\/\/[^\s"'<>]+/gi, '[URL_REDACTED]')
    .replace(/(?:key|secret|token|password|cred|auth|signature)=[^\s&"']+/gi, '[CREDENTIAL_REDACTED]')
    .slice(0, 500);
}

/**
 * Probe source video file using ffprobe
 */
async function probeMedia(filePath: string): Promise<ProbeResult> {
  return new Promise((resolve, reject) => {
    const ffprobeArgs = [
      '-v', 'quiet',
      '-print_format', 'json',
      '-show_format',
      '-show_streams',
      filePath
    ];

    const child = spawn('ffprobe', ffprobeArgs);
    let stdout = '';
    let stderr = '';

    child.stdout.on('data', chunk => { stdout += chunk; });
    child.stderr.on('data', chunk => { stderr += chunk; });

    child.on('close', code => {
      if (code !== 0) {
        return reject(new Error(`ffprobe failed with exit code ${code}: ${stderr}`));
      }

      try {
        const data = JSON.parse(stdout);
        const vStream = (data.streams || []).find((s: any) => s.codec_type === 'video');
        if (!vStream) {
          return reject(new Error('Input file does not contain a valid video stream'));
        }

        const width = parseInt(vStream.width, 10);
        const height = parseInt(vStream.height, 10);
        if (!width || !height || isNaN(width) || isNaN(height)) {
          return reject(new Error('Invalid video stream dimensions'));
        }

        // Check for rotation metadata in side data or tags
        let rotation = 0;
        if (vStream.side_data_list && Array.isArray(vStream.side_data_list)) {
          for (const sd of vStream.side_data_list) {
            if (typeof sd.rotation === 'number') {
              rotation = sd.rotation;
              break;
            }
          }
        }
        if (!rotation && vStream.tags && vStream.tags.rotate) {
          rotation = parseInt(vStream.tags.rotate, 10) || 0;
        }

        const isRotated90 = Math.abs(rotation) === 90 || Math.abs(rotation) === 270;
        const effectiveWidth = isRotated90 ? height : width;
        const effectiveHeight = isRotated90 ? width : height;

        // Parse nominal frame rate
        let fps = 24;
        if (vStream.r_frame_rate) {
          const parts = vStream.r_frame_rate.split('/');
          if (parts.length === 2) {
            const num = parseFloat(parts[0]);
            const den = parseFloat(parts[1]);
            if (den > 0 && num > 0) fps = num / den;
          } else {
            fps = parseFloat(vStream.r_frame_rate) || 24;
          }
        }

        const duration = parseFloat(data.format?.duration || vStream.duration || '0') || 0;

        // Check audio stream
        const aStream = (data.streams || []).find((s: any) => s.codec_type === 'audio');
        const hasAudio = Boolean(aStream);

        resolve({
          width,
          height,
          effectiveWidth,
          effectiveHeight,
          fps,
          duration,
          hasAudio,
          audioCodec: aStream?.codec_name,
          audioChannels: aStream?.channels ? parseInt(aStream.channels, 10) : undefined,
          audioSampleRate: aStream?.sample_rate ? parseInt(aStream.sample_rate, 10) : undefined
        });
      } catch (err: any) {
        reject(new Error(`Failed to parse ffprobe metadata: ${err.message}`));
      }
    });

    child.on('error', reject);
  });
}

/**
 * Filter rendition ladder preventing upscaling and matching aspect orientation
 */
function getEligibleLadder(probe: ProbeResult): RenditionConfig[] {
  const isPortrait = probe.effectiveHeight > probe.effectiveWidth;

  // Filter templates: never upscale beyond effective height or width
  const eligible = MASTER_RENDITIONS.filter(r => {
    const targetH = isPortrait ? r.width : r.height;
    const targetW = isPortrait ? r.height : r.width;
    return targetH <= probe.effectiveHeight && targetW <= probe.effectiveWidth;
  });

  // If source is smaller than smallest template (360p), create a single native rendition
  if (eligible.length === 0) {
    return [{
      name: `${probe.effectiveHeight}p`,
      width: Math.floor(probe.effectiveWidth / 2) * 2,
      height: Math.floor(probe.effectiveHeight / 2) * 2,
      vBitrate: '500k',
      maxrate: '550k',
      bufsize: '1000k',
      profile: 'baseline',
      level: '3.0',
      aBitrate: '64k',
      baseBandwidth: 600000,
      avgBandwidth: 550000,
      codecs: probe.hasAudio ? 'avc1.42c01e,mp4a.40.2' : 'avc1.42c01e'
    }];
  }

  // Adjust templates for portrait if necessary and update codecs string if silent
  return eligible.map(r => {
    const adjustedW = isPortrait ? r.height : r.width;
    const adjustedH = isPortrait ? r.width : r.height;
    const codecs = probe.hasAudio ? r.codecs : r.codecs.split(',')[0];
    return {
      ...r,
      width: adjustedW,
      height: adjustedH,
      codecs
    };
  });
}

/**
 * Check volume available space before downloading/processing
 */
function checkDiskSpace(directoryPath: string, sourceSizeBytes: number, durationSec: number, ladder: RenditionConfig[]): void {
  try {
    const stats = fs.statfsSync(directoryPath);
    const freeBytes = Number(stats.bavail) * Number(stats.bsize);

    // Sum target bitrates (bits/sec) to estimate total output bytes
    const totalBitrateBps = ladder.reduce((acc, r) => {
      const kbps = parseInt(r.vBitrate.replace('k', ''), 10) + parseInt(r.aBitrate.replace('k', ''), 10);
      return acc + (kbps * 1000);
    }, 0);

    const estOutputBytes = Math.ceil(durationSec * (totalBitrateBps / 8) * 1.25);
    const requiredBytes = sourceSizeBytes + estOutputBytes + (2 * 1024 * 1024 * 1024); // 2GB safety cushion

    if (freeBytes < requiredBytes) {
      throw new Error(
        `INSUFFICIENT_TEMP_DISK_SPACE: Required estimated ${Math.round(requiredBytes / (1024 * 1024))} MB, ` +
        `but only ${Math.round(freeBytes / (1024 * 1024))} MB is free on temporary volume.`
      );
    }
  } catch (err: any) {
    if (err.message && err.message.startsWith('INSUFFICIENT_TEMP_DISK_SPACE')) {
      throw err;
    }
    logger.warn('Disk space check warning:', err.message);
  }
}

/**
 * Download raw source video from R2 to local scratch path
 */
const downloadFromR2 = async (key: string, downloadPath: string): Promise<void> => {
  const command = new GetObjectCommand({ Bucket: R2_BUCKET, Key: key });
  const response = await s3Client.send(command);
  if (!response.Body) throw new Error('Empty body returned from Cloudflare R2 storage');

  const writeStream = fs.createWriteStream(downloadPath);
  await pipeline(response.Body as NodeJS.ReadableStream, writeStream);
};

/**
 * Upload single file to R2 with explicit MIME content-type
 */
const uploadToR2 = async (filePath: string, key: string, contentType: string): Promise<void> => {
  const fileStream = fs.createReadStream(filePath);
  const command = new PutObjectCommand({
    Bucket: R2_BUCKET,
    Key: key,
    Body: fileStream,
    ContentType: contentType,
  });
  await s3Client.send(command);
};

/**
 * Purge previous partial attempts under a specific destination prefix
 * Fully paginated with strict safety guards.
 */
const purgePrefixInR2 = async (prefix: string): Promise<void> => {
  // Strict prefix safety checks: Must be non-empty, at least 15 chars, start with 'videos/', and end with '/'
  if (!prefix || prefix.length < 15 || !prefix.startsWith('videos/') || !prefix.endsWith('/')) {
    throw new Error(`SAFETY_VIOLATION: Refusing to purge invalid or unsafe prefix: ${prefix}`);
  }

  let continuationToken: string | undefined = undefined;
  let totalDeleted = 0;

  try {
    do {
      const listCommand: ListObjectsV2Command = new ListObjectsV2Command({
        Bucket: R2_BUCKET,
        Prefix: prefix,
        ContinuationToken: continuationToken
      });
      const listResult = await s3Client.send(listCommand);

      if (listResult.Contents && listResult.Contents.length > 0) {
        const objectsToDelete = listResult.Contents
          .map(obj => ({ Key: obj.Key! }))
          .filter(obj => obj.Key.startsWith(prefix)); // Strict key boundary

        if (objectsToDelete.length > 0) {
          const deleteCommand = new DeleteObjectsCommand({
            Bucket: R2_BUCKET,
            Delete: {
              Objects: objectsToDelete,
              Quiet: false
            }
          });
          const deleteResult = await s3Client.send(deleteCommand);

          if (deleteResult.Errors && deleteResult.Errors.length > 0) {
            const sampleErr = deleteResult.Errors[0];
            throw new Error(`R2_CLEANUP_PARTIAL_FAILURE: Failed to delete key ${sampleErr.Key}: ${sampleErr.Message}`);
          }

          totalDeleted += objectsToDelete.length;
        }
      }

      continuationToken = listResult.IsTruncated ? listResult.NextContinuationToken : undefined;
    } while (continuationToken);

    if (totalDeleted > 0) {
      logger.info(`Purged ${totalDeleted} objects under prefix: ${prefix}`);
    }
  } catch (err: any) {
    logger.warn(`Could not purge prefix ${prefix}:`, err.message);
    throw err;
  }
};

/**
 * Transcode single rendition sequentially to bounded HLS segments
 */
async function transcodeRendition(
  inputPath: string,
  outDir: string,
  rendition: RenditionConfig,
  probe: ProbeResult,
  targetFps: number,
  gopSize: number
): Promise<void> {
  return new Promise((resolve, reject) => {
    if (!fs.existsSync(outDir)) {
      fs.mkdirSync(outDir, { recursive: true });
    }

    // Universal Aspect Ratio Scaling with even-dimension constraint
    const scaleFilter = `scale='min(${rendition.width},iw)':'min(${rendition.height},ih)':force_original_aspect_ratio=decrease,scale=trunc(iw/2)*2:trunc(ih/2)*2`;

    const args: string[] = [
      '-y',
      '-i', inputPath,
      '-vf', scaleFilter,
      '-c:v', 'libx264',
      '-profile:v', rendition.profile,
      '-level', rendition.level,
      '-b:v', rendition.vBitrate,
      '-maxrate', rendition.maxrate,
      '-bufsize', rendition.bufsize,
      '-fps_mode', 'cfr',
      '-r', String(targetFps),
      '-g', String(gopSize),
      '-keyint_min', String(gopSize),
      '-sc_threshold', '0',
      '-flags', '+cgop',
      '-avoid_negative_ts', 'make_zero',
      '-threads', '2'
    ];

    if (probe.hasAudio) {
      args.push(
        '-c:a', 'aac',
        '-b:a', rendition.aBitrate,
        '-ar', '44100',
        '-ac', '2',
        '-af', 'aresample=async=1:first_pts=0'
      );
    } else {
      args.push('-an');
    }

    const segmentFilename = path.join(outDir, `${rendition.name}_%03d.ts`);
    const playlistFilename = path.join(outDir, 'index.m3u8');

    args.push(
      '-hls_time', '4',
      '-hls_playlist_type', 'vod',
      '-hls_flags', 'independent_segments',
      '-hls_segment_filename', segmentFilename,
      playlistFilename
    );

    const child = spawn('ffmpeg', args);
    activeFfmpegChild = child;
    let stderr = '';

    child.stderr.on('data', chunk => {
      stderr += chunk;
    });

    child.on('close', code => {
      activeFfmpegChild = null;
      if (code !== 0) {
        return reject(new Error(`FFmpeg rendition ${rendition.name} failed (code ${code}): ${stderr.slice(-600)}`));
      }
      resolve();
    });

    child.on('error', err => {
      activeFfmpegChild = null;
      reject(err);
    });
  });
}

/**
 * Generate Multivariant Master Playlist (master.m3u8)
 */
function generateMasterPlaylist(ladder: RenditionConfig[], targetFps: number): string {
  let content = '#EXTM3U\n#EXT-X-VERSION:3\n#EXT-X-INDEPENDENT-SEGMENTS\n\n';

  // Sort descending by resolution/bandwidth (1080p -> 360p)
  const sorted = ladder.slice().sort((a, b) => b.height - a.height);

  for (const r of sorted) {
    content += `#EXT-X-STREAM-INF:BANDWIDTH=${r.baseBandwidth},AVERAGE-BANDWIDTH=${r.avgBandwidth},` +
      `RESOLUTION=${r.width}x${r.height},FRAME-RATE=${targetFps}.000,CODECS="${r.codecs}",NAME="${r.name}"\n` +
      `${r.name}/index.m3u8\n\n`;
  }

  return content.trim() + '\n';
}

/**
 * Pre-Upload Static Output Validation Gate
 */
function validateStaticOutput(workDir: string, ladder: RenditionConfig[]): void {
  const masterPath = path.join(workDir, 'master.m3u8');
  if (!fs.existsSync(masterPath)) {
    throw new Error('Static validation failed: master.m3u8 was not generated');
  }

  const masterContent = fs.readFileSync(masterPath, 'utf8');
  if (!masterContent.startsWith('#EXTM3U')) {
    throw new Error('Static validation failed: master.m3u8 missing #EXTM3U header');
  }

  for (const r of ladder) {
    const rendDir = path.join(workDir, r.name);
    const playlistPath = path.join(rendDir, 'index.m3u8');

    if (!fs.existsSync(playlistPath)) {
      throw new Error(`Static validation failed: Variant playlist missing for rendition ${r.name}`);
    }

    const playlistContent = fs.readFileSync(playlistPath, 'utf8');
    if (!playlistContent.includes('#EXT-X-ENDLIST')) {
      throw new Error(`Static validation failed: Rendition ${r.name} playlist does not contain #EXT-X-ENDLIST`);
    }

    const lines = playlistContent.split('\n').map(l => l.trim()).filter(Boolean);
    const segmentNames = lines.filter(l => l.endsWith('.ts'));

    if (segmentNames.length === 0) {
      throw new Error(`Static validation failed: Rendition ${r.name} has 0 segment entries`);
    }

    for (const seg of segmentNames) {
      const segPath = path.join(rendDir, seg);
      if (!fs.existsSync(segPath)) {
        throw new Error(`Static validation failed: Segment file missing on disk: ${seg}`);
      }
      const stat = fs.statSync(segPath);
      if (stat.size === 0) {
        throw new Error(`Static validation failed: Segment file is empty (0 bytes): ${seg}`);
      }
    }
  }
}

/**
 * Efficient and comprehensive remote HLS verification gate:
 * 1. Parses local master.m3u8 and all variant playlists.
 * 2. Derives the complete set of required S3 keys (master, variants, segments).
 * 3. Enforces strict path safety (no escaping attemptPrefix, no directory traversal).
 * 4. Paginates ListObjectsV2Command under attemptPrefix to collect all uploaded remote keys and their sizes.
 * 5. Compares required keys against remote keys, ensuring all exist and Size > 0.
 * 6. Executes targeted HeadObjectCommand on master manifest to verify metadata.
 */
async function verifyRemoteHlsPackage(
  attemptPrefix: string,
  ladder: RenditionConfig[],
  workDir: string
): Promise<void> {
  const masterPath = path.join(workDir, 'master.m3u8');
  if (!fs.existsSync(masterPath)) {
    throw new Error('VERIFY_FAILED: Local master.m3u8 is missing');
  }

  const masterContent = fs.readFileSync(masterPath, 'utf8');
  if (!masterContent.startsWith('#EXTM3U')) {
    throw new Error('VERIFY_FAILED: Malformed master.m3u8 (missing #EXTM3U)');
  }

  // 1. Collect required keys
  const requiredKeys = new Set<string>();
  const masterKey = `${attemptPrefix}master.m3u8`;
  requiredKeys.add(masterKey);

  // Parse variant references from master
  const masterLines = masterContent.split('\n').map(l => l.trim()).filter(Boolean);
  const variantUris = masterLines.filter(l => !l.startsWith('#') && l.endsWith('.m3u8'));

  if (variantUris.length === 0 || variantUris.length !== ladder.length) {
    throw new Error(`VERIFY_FAILED: Master playlist declares ${variantUris.length} variants, expected ${ladder.length}`);
  }

  for (const variantUri of variantUris) {
    // Prevent directory traversal or path escape
    if (variantUri.includes('..') || variantUri.startsWith('/') || variantUri.startsWith('\\')) {
      throw new Error(`VERIFY_FAILED: Security violation in master playlist variant URI: ${variantUri}`);
    }

    const variantKey = `${attemptPrefix}${variantUri}`;
    requiredKeys.add(variantKey);

    const localVariantPath = path.join(workDir, variantUri);
    if (!fs.existsSync(localVariantPath)) {
      throw new Error(`VERIFY_FAILED: Local variant playlist missing: ${variantUri}`);
    }

    const variantContent = fs.readFileSync(localVariantPath, 'utf8');
    if (!variantContent.startsWith('#EXTM3U') || !variantContent.includes('#EXT-X-ENDLIST')) {
      throw new Error(`VERIFY_FAILED: Malformed variant playlist ${variantUri} (missing #EXTM3U or #EXT-X-ENDLIST)`);
    }

    const variantDir = path.dirname(variantUri); // e.g. "1080p"
    const variantLines = variantContent.split('\n').map(l => l.trim()).filter(Boolean);
    const segmentUris = variantLines.filter(l => !l.startsWith('#') && l.endsWith('.ts'));

    if (segmentUris.length === 0) {
      throw new Error(`VERIFY_FAILED: Variant playlist ${variantUri} contains 0 segment entries`);
    }

    for (const segUri of segmentUris) {
      if (segUri.includes('..') || segUri.startsWith('/') || segUri.startsWith('\\')) {
        throw new Error(`VERIFY_FAILED: Security violation in segment URI: ${segUri}`);
      }
      const segKey = `${attemptPrefix}${variantDir}/${segUri}`;
      requiredKeys.add(segKey);
    }
  }

  // 2. Fetch all remote keys under attemptPrefix using paginated ListObjectsV2
  const remoteObjects = new Map<string, number>(); // Key -> Size
  let continuationToken: string | undefined = undefined;
  let pageCount = 0;

  do {
    pageCount++;
    const listCommand: ListObjectsV2Command = new ListObjectsV2Command({
      Bucket: R2_BUCKET,
      Prefix: attemptPrefix,
      ContinuationToken: continuationToken
    });
    const listResult = await s3Client.send(listCommand);

    if (listResult.Contents) {
      for (const obj of listResult.Contents) {
        if (obj.Key) {
          remoteObjects.set(obj.Key, obj.Size || 0);
        }
      }
    }

    continuationToken = listResult.IsTruncated ? listResult.NextContinuationToken : undefined;
  } while (continuationToken);

  logger.info(`[Verification] Listed ${remoteObjects.size} remote objects across ${pageCount} pages for prefix: ${attemptPrefix}`);

  // 3. Verify every required key exists in remoteObjects with Size > 0
  const missingKeys: string[] = [];
  const emptyKeys: string[] = [];

  for (const reqKey of requiredKeys) {
    if (!remoteObjects.has(reqKey)) {
      missingKeys.push(reqKey);
    } else if ((remoteObjects.get(reqKey) || 0) === 0) {
      emptyKeys.push(reqKey);
    }
  }

  if (missingKeys.length > 0) {
    const sample = missingKeys.slice(0, 5).join(', ');
    throw new Error(`REMOTE_VERIFY_FAILED: ${missingKeys.length} required HLS objects missing in R2 (e.g. ${sample})`);
  }

  if (emptyKeys.length > 0) {
    const sample = emptyKeys.slice(0, 5).join(', ');
    throw new Error(`REMOTE_VERIFY_FAILED: ${emptyKeys.length} HLS objects are empty (0 bytes) in R2 (e.g. ${sample})`);
  }

  // 4. Targeted HeadObject verification for master.m3u8 to confirm Content-Type
  const masterHead = await s3Client.send(new HeadObjectCommand({
    Bucket: R2_BUCKET,
    Key: masterKey
  }));
  if (!masterHead || (masterHead.ContentLength || 0) === 0) {
    throw new Error(`REMOTE_VERIFY_FAILED: Targeted check failed for master manifest: ${masterKey}`);
  }

  logger.info(`[Verification] Successfully verified all ${requiredKeys.size} required HLS objects in R2.`);
}

function extractDriveFileId(url: string | null | undefined): string | null {
  if (!url) return null;
  const idMatch =
    url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/) ||
    url.match(/[?&]id=([a-zA-Z0-9_-]+)/) ||
    url.match(/\/d\/([a-zA-Z0-9_-]+)/);
  return idMatch ? idMatch[1] : null;
}

function isAllowedGoogleStreamUrl(urlString: string): boolean {
  try {
    const parsed = new URL(urlString);
    if (parsed.protocol !== 'https:') return false;

    const hostname = parsed.hostname.toLowerCase();
    if (
      hostname === 'localhost' ||
      hostname === '127.0.0.1' ||
      hostname === '::1' ||
      hostname === '0.0.0.0' ||
      hostname.startsWith('10.') ||
      hostname.startsWith('192.168.') ||
      hostname.startsWith('169.254.') ||
      /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(hostname)
    ) {
      return false;
    }

    const allowedExactHosts = [
      'drive.google.com',
      'docs.google.com',
      'drive.usercontent.google.com',
      'video.google.com'
    ];
    if (allowedExactHosts.includes(hostname)) return true;

    if (
      hostname.endsWith('.googleusercontent.com') ||
      hostname.endsWith('.drive.google.com') ||
      hostname.endsWith('.docs.google.com')
    ) {
      return true;
    }

    return false;
  } catch {
    return false;
  }
}

function fetchHttpsStream(
  targetUrl: string,
  headers: Record<string, string> = {},
  maxRedirects = 5
): Promise<http.IncomingMessage> {
  return new Promise((resolve, reject) => {
    if (!isAllowedGoogleStreamUrl(targetUrl)) {
      return reject(new Error('SSRF_BLOCKED: Untrusted target URL during Google Drive download.'));
    }

    const req = https.get(targetUrl, { headers, timeout: 30000 }, (res) => {
      const isRedirect = res.statusCode && [301, 302, 303, 307, 308].includes(res.statusCode);
      if (isRedirect && res.headers.location && maxRedirects > 0) {
        res.resume();
        const nextUrl = new URL(res.headers.location, targetUrl).toString();

        if (!isAllowedGoogleStreamUrl(nextUrl)) {
          return reject(new Error('SSRF_BLOCKED: Redirected to untrusted destination during Google Drive download.'));
        }

        let newHeaders = { ...headers };
        if (res.headers['set-cookie']) {
          const extraCookies = res.headers['set-cookie'].map((c: string) => c.split(';')[0]).join('; ');
          const currentCookies = newHeaders['Cookie'] || '';
          newHeaders['Cookie'] = currentCookies ? `${currentCookies}; ${extraCookies}` : extraCookies;
        }

        fetchHttpsStream(nextUrl, newHeaders, maxRedirects - 1).then(resolve).catch(reject);
      } else {
        resolve(res);
      }
    });

    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('REQUEST_TIMEOUT: Socket timeout during Google Drive download.'));
    });
  });
}

function readBodyText(stream: http.IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = '';
    stream.on('data', chunk => data += chunk);
    stream.on('end', () => resolve(data));
    stream.on('error', reject);
  });
}

async function getDriveDirectSession(fileId: string): Promise<{ directUrl: string; cookies: string }> {
  const initUrl = `https://drive.usercontent.google.com/download?id=${fileId}&export=download`;
  const initialRes = await fetchHttpsStream(initUrl, {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  }, 0);

  const cookies = initialRes.headers['set-cookie']
    ? initialRes.headers['set-cookie'].map((c: string) => c.split(';')[0]).join('; ')
    : '';

  const html = await readBodyText(initialRes);
  const uuidMatch = typeof html === 'string' ? html.match(/name="uuid"\s+value="([^"]+)"/) : null;
  const uuid = uuidMatch ? uuidMatch[1] : '';
  const confirmMatch = typeof html === 'string' ? html.match(/name="confirm"\s+value="([^"]+)"/) : null;
  const confirm = confirmMatch ? confirmMatch[1] : 't';

  const directUrl = `https://drive.usercontent.google.com/download?id=${fileId}&export=download&confirm=${confirm}${uuid ? '&uuid=' + uuid : ''}`;
  return { directUrl, cookies };
}

// Test hook for isolated testing without network requests to Google Drive
let customDriveDownloader: ((fileId: string, targetPath: string) => Promise<void>) | null = null;

export function setDriveDownloaderForTests(
  downloader: ((fileId: string, targetPath: string) => Promise<void>) | null
): void {
  customDriveDownloader = downloader;
}

async function downloadGoogleDriveToScratch(
  fileId: string,
  targetPath: string,
  maxBytes = 2 * 1024 * 1024 * 1024 // 2GB limit
): Promise<void> {
  if (customDriveDownloader) {
    return customDriveDownloader(fileId, targetPath);
  }

  const session = await getDriveDirectSession(fileId);
  const headers: Record<string, string> = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  };
  if (session.cookies) {
    headers['Cookie'] = session.cookies;
  }

  const responseStream = await fetchHttpsStream(session.directUrl, headers, 5);

  if (responseStream.statusCode !== 200 && responseStream.statusCode !== 206) {
    responseStream.resume();
    throw new Error(`DRIVE_DOWNLOAD_FAILED: Google Drive returned HTTP ${responseStream.statusCode}`);
  }

  return new Promise((resolve, reject) => {
    let bytesReceived = 0;
    const writeStream = fs.createWriteStream(targetPath);

    responseStream.on('data', (chunk: Buffer) => {
      bytesReceived += chunk.length;
      if (bytesReceived > maxBytes) {
        responseStream.destroy();
        writeStream.destroy();
        if (fs.existsSync(targetPath)) {
          fs.rmSync(targetPath, { force: true });
        }
        reject(new UnrecoverableError(`FILE_SIZE_EXCEEDED: Download exceeded maximum 2GB limit (${bytesReceived} bytes)`));
      }
    });

    responseStream.pipe(writeStream);

    writeStream.on('finish', () => {
      if (bytesReceived === 0) {
        if (fs.existsSync(targetPath)) {
          fs.rmSync(targetPath, { force: true });
        }
        return reject(new Error('DRIVE_DOWNLOAD_FAILED: Downloaded 0 bytes from Google Drive'));
      }
      resolve();
    });

    writeStream.on('error', (err) => {
      responseStream.destroy();
      reject(err);
    });

    responseStream.on('error', (err) => {
      writeStream.destroy();
      reject(err);
    });
  });
}

/**
 * Google Drive Ingestion Worker Job Processor
 */
export const processDriveIngestionJob = async (job: Job): Promise<{ status: string; mediaId: string }> => {
  const { mediaId, lessonId, mediaGeneration, sourceFileId } = job.data;
  const attemptNum = job.attemptsMade + 1;
  const totalAllowedAttempts = job.opts.attempts || 3;
  const isFinalAttempt = attemptNum >= totalAllowedAttempts;
  const workerId = `worker-${process.pid}-${Date.now()}`;

  logger.info(`[Job ${job.id}] Started Drive ingestion for media ${mediaId} (gen ${mediaGeneration}, attempt ${attemptNum}/${totalAllowedAttempts})`);

  // 1. Fetch current media record state
  const mediaRecord = await (db as any).processedMedia.findUnique({ where: { id: mediaId } });
  if (!mediaRecord) {
    throw new UnrecoverableError(`ProcessedMedia record ${mediaId} does not exist`);
  }

  // Idempotency: Skip if already terminal
  if (mediaRecord.status === 'COMPLETED') {
    logger.info(`[Job ${job.id}] ProcessedMedia ${mediaId} already COMPLETED. Skipping idempotently.`);
    return { status: 'already_completed', mediaId };
  }
  if (mediaRecord.status === 'SUPERSEDED') {
    logger.info(`[Job ${job.id}] ProcessedMedia ${mediaId} is SUPERSEDED. Yielding.`);
    return { status: 'superseded', mediaId };
  }

  // Heartbeat staleness guard:
  // 60 seconds of silence from another worker indicates a dead/crashed claim eligible for reclamation.
  const STALE_HEARTBEAT_THRESHOLD_MS = 60000;
  const nowMs = Date.now();
  const lastHeartbeatMs = mediaRecord.heartbeatAt ? new Date(mediaRecord.heartbeatAt).getTime() : 0;
  const isHeartbeatFresh = mediaRecord.heartbeatAt && (nowMs - lastHeartbeatMs < STALE_HEARTBEAT_THRESHOLD_MS);

  // If another worker genuinely holds an active claim with fresh heartbeat, protect it and yield
  if (
    mediaRecord.workerId &&
    mediaRecord.workerId !== workerId &&
    ['DOWNLOADING', 'TRANSCODING'].includes(mediaRecord.status) &&
    isHeartbeatFresh
  ) {
    logger.warn(
      `[Job ${job.id}] ProcessedMedia ${mediaId} is actively processed by worker ${mediaRecord.workerId} ` +
      `(heartbeat fresh: ${Math.round((nowMs - lastHeartbeatMs) / 1000)}s ago). Yielding.`
    );
    return { status: 'already_claimed', mediaId };
  }

  // 2. Atomic Ingress Claim or Stale Claim Reclamation with Fencing Token Increment
  // Reclaims if status is PENDING, or workerId is null, or heartbeat is stale (> 60s), or same worker retrying
  const claimCount = await (db as any).$executeRaw`
    UPDATE "ProcessedMedia"
    SET "status" = 'DOWNLOADING',
        "fencingToken" = "fencingToken" + 1,
        "workerId" = ${workerId},
        "heartbeatAt" = NOW(),
        "retryCount" = ${attemptNum}
    WHERE "id" = ${mediaId}
      AND "fencingToken" = ${mediaRecord.fencingToken}
      AND (
        "status" = 'PENDING'
        OR "workerId" IS NULL
        OR "heartbeatAt" < NOW() - INTERVAL '60 seconds'
        OR "workerId" = ${workerId}
      )
  `;

  if (claimCount === 0) {
    // Concurrent claim collision or status changed in race window
    const refreshed = await (db as any).processedMedia.findUnique({ where: { id: mediaId } });
    if (refreshed?.status === 'COMPLETED') {
      return { status: 'already_completed', mediaId };
    }
    if (refreshed?.status === 'SUPERSEDED') {
      return { status: 'superseded', mediaId };
    }
    if (refreshed?.workerId && refreshed.workerId !== workerId && ['DOWNLOADING', 'TRANSCODING'].includes(refreshed.status)) {
      logger.warn(`[Job ${job.id}] Concurrent claim collision: Media ${mediaId} claimed by worker ${refreshed.workerId}. Yielding.`);
      return { status: 'already_claimed', mediaId };
    }
    throw new Error(`CONCURRENT_CLAIM_CONFLICT: Unable to atomically claim media ${mediaId} for attempt ${attemptNum}`);
  }

  // Ingress claim secured! Increment fencingToken locally
  const fencingToken = BigInt(mediaRecord.fencingToken) + 1n;
  const storagePrefix = mediaRecord.storagePrefix || `videos/${mediaId}/`;
  const attemptPrefix = `${storagePrefix}attempts/token-${fencingToken}/hls/`;

  const tmpRoot = process.env.SCRATCH_DIR ? path.resolve(process.env.SCRATCH_DIR) : path.join(process.cwd(), 'tmp');
  const workDir = path.join(tmpRoot, `drive-${mediaId}-att${attemptNum}`);
  currentWorkDir = workDir;
  const sourceMp4 = path.join(workDir, 'source.mp4');

  // Heartbeat keep-alive interval during downloading & transcoding
  let heartbeatTimer: NodeJS.Timeout | null = setInterval(async () => {
    try {
      await (db as any).$executeRaw`
        UPDATE "ProcessedMedia"
        SET "heartbeatAt" = NOW()
        WHERE "id" = ${mediaId}
          AND "fencingToken" = ${fencingToken}
          AND "workerId" = ${workerId}
      `;
    } catch (hbErr: any) {
      logger.warn(`[Job ${job.id}] Heartbeat update warning: ${hbErr.message}`);
    }
  }, 15000);

  try {
    fs.mkdirSync(workDir, { recursive: true });

    // 3. Bounded Scratch Download from Google Drive
    logger.info(`[Job ${job.id}] Downloading source from Google Drive (${sourceFileId}) to scratch...`);
    await downloadGoogleDriveToScratch(sourceFileId, sourceMp4);
    logger.info(`[Job ${job.id}] Download completed. Source size: ${fs.statSync(sourceMp4).size} bytes`);

    // Transition status to TRANSCODING
    await (db as any).$executeRaw`
      UPDATE "ProcessedMedia"
      SET "status" = 'TRANSCODING',
          "heartbeatAt" = NOW()
      WHERE "id" = ${mediaId}
        AND "fencingToken" = ${fencingToken}
        AND "workerId" = ${workerId}
    `;

    // 4. Probe and Transcode
    logger.info(`[Job ${job.id}] Probing media with ffprobe...`);
    const probe = await probeMedia(sourceMp4);
    const ladder = getEligibleLadder(probe);
    logger.info(`[Job ${job.id}] Transcoding with ladder: ${ladder.map(r => r.name).join(', ')}`);

    const targetFps = Math.min(60, Math.max(1, Math.round(probe.fps)));
    const gopSize = targetFps * 2;

    for (let i = 0; i < ladder.length; i++) {
      const rendition = ladder[i];
      const rendDir = path.join(workDir, rendition.name);
      logger.info(`[Job ${job.id}] Transcoding rendition ${i + 1}/${ladder.length}: ${rendition.name}...`);
      await transcodeRendition(sourceMp4, rendDir, rendition, probe, targetFps, gopSize);
      const progressPct = Math.round(((i + 1) / ladder.length) * 85);
      await job.updateProgress(progressPct);
    }

    // 5. Master Playlist and Static Validation
    logger.info(`[Job ${job.id}] Writing multivariant master.m3u8...`);
    const masterM3u8Content = generateMasterPlaylist(ladder, targetFps);
    fs.writeFileSync(path.join(workDir, 'master.m3u8'), masterM3u8Content, 'utf8');

    logger.info(`[Job ${job.id}] Executing static output validation gate...`);
    validateStaticOutput(workDir, ladder);

    // 6. Upload to Private R2 under attemptPrefix
    await purgePrefixInR2(attemptPrefix);
    logger.info(`[Job ${job.id}] Uploading HLS package to Cloudflare R2 under prefix: ${attemptPrefix}...`);

    await uploadToR2(path.join(workDir, 'master.m3u8'), `${attemptPrefix}master.m3u8`, 'application/vnd.apple.mpegurl');

    for (const rendition of ladder) {
      const rendDir = path.join(workDir, rendition.name);
      const files = fs.readdirSync(rendDir);
      for (const file of files) {
        const filePath = path.join(rendDir, file);
        const s3Key = `${attemptPrefix}${rendition.name}/${file}`;
        const contentType = file.endsWith('.m3u8')
          ? 'application/vnd.apple.mpegurl'
          : 'video/mp2t';
        await uploadToR2(filePath, s3Key, contentType);
      }
    }

    // 7. Comprehensive Remote Package Verification Gate
    logger.info(`[Job ${job.id}] Executing remote package verification in R2...`);
    await verifyRemoteHlsPackage(attemptPrefix, ladder, workDir);

    // 8. Atomic Promotion Database Transaction
    logger.info(`[Job ${job.id}] Executing atomic promotion transaction for lesson ${lessonId}...`);
    await (db as any).$transaction(async (tx: any) => {
      // 1. Lock lesson row
      const lessons: any[] = await tx.$queryRaw`
        SELECT id, "mediaGeneration", "videoUrl"
        FROM "Lesson"
        WHERE id = ${lessonId}
        FOR UPDATE
      `;
      if (!lessons || lessons.length === 0) {
        throw new Error(`PROMOTION_ABORTED: Lesson ${lessonId} not found`);
      }
      const lesson = lessons[0];

      // 2. Verify expected lesson generation
      if (lesson.mediaGeneration !== mediaGeneration) {
        await tx.$executeRaw`
          UPDATE "ProcessedMedia"
          SET "status" = 'SUPERSEDED', "supersededAt" = NOW()
          WHERE id = ${mediaId}
        `;
        throw new Error(
          `PROMOTION_FENCED: Lesson generation (${lesson.mediaGeneration}) exceeds job generation (${mediaGeneration})`
        );
      }

      // Verify canonical source still matches
      const currentDriveId = extractDriveFileId(lesson.videoUrl);
      if (currentDriveId !== sourceFileId) {
        await tx.$executeRaw`
          UPDATE "ProcessedMedia"
          SET "status" = 'SUPERSEDED', "supersededAt" = NOW()
          WHERE id = ${mediaId}
        `;
        throw new Error(
          `PROMOTION_FENCED: Lesson source (${currentDriveId}) differs from job source (${sourceFileId})`
        );
      }

      // 3. Update media record to COMPLETED conditionally
      const mediaUpdateCount = await tx.$executeRaw`
        UPDATE "ProcessedMedia"
        SET "status" = 'COMPLETED',
            "masterPlaylistKey" = ${`${attemptPrefix}master.m3u8`},
            "completedAt" = NOW(),
            "errorMessage" = NULL
        WHERE id = ${mediaId}
          AND "fencingToken" = ${fencingToken}
          AND "status" = 'TRANSCODING'
      `;
      if (mediaUpdateCount !== 1) {
        throw new Error(`PROMOTION_ABORTED: Media update affected ${mediaUpdateCount} rows, expected exactly 1`);
      }

      // 4. Update Lesson.activeMediaId
      const lessonUpdateCount = await tx.$executeRaw`
        UPDATE "Lesson"
        SET "activeMediaId" = ${mediaId}
        WHERE id = ${lessonId}
          AND "mediaGeneration" = ${mediaGeneration}
      `;
      if (lessonUpdateCount !== 1) {
        throw new Error(`PROMOTION_ABORTED: Lesson update affected ${lessonUpdateCount} rows, expected exactly 1`);
      }
    });

    logger.info(`[Job ${job.id}] Successfully promoted ProcessedMedia ${mediaId} to active media for lesson ${lessonId}!`);
    await job.updateProgress(100);
    return { status: 'success', mediaId };
  } catch (error: any) {
    if (heartbeatTimer) {
      clearInterval(heartbeatTimer);
      heartbeatTimer = null;
    }

    const sanitizedError = sanitizeErrorMessage(error.message);
    const isUnrecoverable = error instanceof UnrecoverableError || isFinalAttempt;

    if (isUnrecoverable) {
      logger.error(`[Job ${job.id}] Terminal failure for Drive media ${mediaId}: ${sanitizedError}`);
      await (db as any).$executeRaw`
        UPDATE "ProcessedMedia"
        SET "status" = 'FAILED',
            "errorMessage" = ${sanitizedError},
            "workerId" = NULL
        WHERE id = ${mediaId}
          AND "fencingToken" = ${fencingToken}
      `.catch((dbErr: any) => logger.error(`Failed to update ProcessedMedia FAILED status: ${dbErr.message}`));
    } else {
      logger.warn(
        `[Job ${job.id}] Attempt ${attemptNum}/${totalAllowedAttempts} failed with retryable error: ${sanitizedError}. ` +
        `Releasing worker claim for BullMQ backoff retry.`
      );
      // Release worker claim so retry or recovery can immediately reclaim without hitting already_claimed
      await (db as any).$executeRaw`
        UPDATE "ProcessedMedia"
        SET "workerId" = NULL,
            "errorMessage" = ${sanitizedError},
            "retryCount" = ${attemptNum}
        WHERE id = ${mediaId}
          AND "fencingToken" = ${fencingToken}
      `.catch((dbErr: any) => logger.error(`Failed to release ProcessedMedia worker claim: ${dbErr.message}`));
    }

    throw error;
  } finally {
    if (heartbeatTimer) {
      clearInterval(heartbeatTimer);
      heartbeatTimer = null;
    }
    currentWorkDir = null;
    if (fs.existsSync(workDir)) {
      fs.rmSync(workDir, { recursive: true, force: true });
    }
  }
};

/**
 * Main Job Processor
 */
export const processVideo = async (job: Job<any>): Promise<{ status: string; uploadId?: string; mediaId?: string }> => {
  if (job.data?.type === 'DRIVE_INGESTION') {
    return processDriveIngestionJob(job);
  }

  const { uploadId, storagePath } = job.data;
  const attemptNum = job.attemptsMade + 1;
  const totalAllowedAttempts = job.opts.attempts || 3;
  const isFinalAttempt = attemptNum >= totalAllowedAttempts;

  logger.info(`[Job ${job.id}] Started processing upload: ${uploadId} (Attempt ${attemptNum}/${totalAllowedAttempts})`);

  // 0. Source Integrity Guard: Reject if storagePath points to an HLS manifest rather than raw video source
  if (storagePath.endsWith('.m3u8') || storagePath.includes('/hls/')) {
    throw new UnrecoverableError(
      `INVALID_SOURCE_PATH: storagePath '${storagePath}' is an HLS playlist, not a raw source video. ` +
      `Raw source key was previously replaced upon completion and is not recoverable.`
    );
  }

  // 1. Ingress Gate: Check current database state to prevent duplicate processing
  const uploadRecord = await db.videoUpload.findUnique({ where: { id: uploadId } });
  if (!uploadRecord) {
    throw new UnrecoverableError(`VideoUpload record with ID ${uploadId} does not exist`);
  }

  if (uploadRecord.status === 'COMPLETED') {
    logger.info(`[Job ${job.id}] VideoUpload ${uploadId} is already COMPLETED. Skipping idempotently.`);
    return { status: 'already_completed', uploadId };
  }

  const tmpRoot = process.env.SCRATCH_DIR ? path.resolve(process.env.SCRATCH_DIR) : path.join(process.cwd(), 'tmp');
  const workDir = path.join(tmpRoot, `transcode-${uploadId}-att${attemptNum}`);
  currentWorkDir = workDir;

  const inputMp4 = path.join(workDir, 'source.mp4');
  // Attempt-isolated output prefix guarantees retries never conflict or mutate running streams
  const attemptPrefix = `videos/${uploadId}/attempts/${attemptNum}/hls/`;

  try {
    fs.mkdirSync(workDir, { recursive: true });
    await db.videoUpload.update({
      where: { id: uploadId },
      data: { status: 'PROCESSING' }
    });

    // 2. Download raw video from R2
    logger.info(`[Job ${job.id}] Downloading raw video from R2...`);
    await downloadFromR2(storagePath, inputMp4);

    const sourceStat = fs.statSync(inputMp4);
    if (sourceStat.size === 0) {
      throw new UnrecoverableError('Downloaded source video is 0 bytes (permanent media corruption)');
    }

    // 3. Probe source metadata
    logger.info(`[Job ${job.id}] Probing source media metadata...`);
    let probe: ProbeResult;
    try {
      probe = await probeMedia(inputMp4);
    } catch (probeErr: any) {
      throw new UnrecoverableError(`Unrecoverable probe failure: ${probeErr.message}`);
    }

    logger.info(
      `[Job ${job.id}] Probed: ${probe.effectiveWidth}x${probe.effectiveHeight} (source ${probe.width}x${probe.height}), ` +
      `FPS: ${probe.fps.toFixed(2)}, Duration: ${probe.duration.toFixed(2)}s, Audio: ${probe.hasAudio}`
    );

    // 4. Select adaptive ladder without upscaling
    const ladder = getEligibleLadder(probe);
    logger.info(`[Job ${job.id}] Selected ${ladder.length} eligible renditions: [${ladder.map(r => r.name).join(', ')}]`);

    // 5. Verify available disk space
    try {
      checkDiskSpace(workDir, sourceStat.size, probe.duration, ladder);
    } catch (diskErr: any) {
      throw new UnrecoverableError(diskErr.message);
    }

    // 6. Calculate normalized CFR frame rate and GOP size
    const targetFps = Math.min(60, Math.max(1, Math.round(probe.fps)));
    const gopSize = targetFps * 2; // Strict 2.0s GOP

    await db.videoUpload.update({
      where: { id: uploadId },
      data: { status: 'TRANSCODING' }
    });

    // 7. Execute sequential multi-rendition transcoding
    for (let i = 0; i < ladder.length; i++) {
      const rendition = ladder[i];
      const rendDir = path.join(workDir, rendition.name);
      logger.info(`[Job ${job.id}] Transcoding rendition ${i + 1}/${ladder.length}: ${rendition.name}...`);

      await transcodeRendition(inputMp4, rendDir, rendition, probe, targetFps, gopSize);

      const progressPct = Math.round(((i + 1) / ladder.length) * 85);
      await job.updateProgress(progressPct);
    }

    // 8. Generate true multivariant master playlist
    logger.info(`[Job ${job.id}] Writing multivariant master.m3u8...`);
    const masterM3u8Content = generateMasterPlaylist(ladder, targetFps);
    fs.writeFileSync(path.join(workDir, 'master.m3u8'), masterM3u8Content, 'utf8');

    // 9. Pre-Upload Static Output Validation Gate
    logger.info(`[Job ${job.id}] Executing static output validation gate...`);
    validateStaticOutput(workDir, ladder);

    // 10. Purge any leftovers under this specific attempt prefix before writing
    await purgePrefixInR2(attemptPrefix);

    // 11. Upload validated playlists and media segments
    logger.info(`[Job ${job.id}] Uploading HLS package to Cloudflare R2 under prefix: ${attemptPrefix}...`);

    // Upload master playlist
    await uploadToR2(path.join(workDir, 'master.m3u8'), `${attemptPrefix}master.m3u8`, 'application/vnd.apple.mpegurl');

    // Upload each rendition
    for (const rendition of ladder) {
      const rendDir = path.join(workDir, rendition.name);
      const files = fs.readdirSync(rendDir);

      for (const file of files) {
        const filePath = path.join(rendDir, file);
        const s3Key = `${attemptPrefix}${rendition.name}/${file}`;
        const contentType = file.endsWith('.m3u8')
          ? 'application/vnd.apple.mpegurl'
          : 'video/mp2t';

        await uploadToR2(filePath, s3Key, contentType);
      }
    }

    // 12. Remote verification check: Comprehensive gate verifying master, variants, and all segments
    logger.info(`[Job ${job.id}] Executing comprehensive remote verification gate in R2...`);
    await verifyRemoteHlsPackage(attemptPrefix, ladder, workDir);

    // 13. Atomic Conditional Finalization Gate
    // Use updateMany with status in ['PROCESSING', 'TRANSCODING', 'UPLOAD_COMPLETED']
    // to atomically guarantee that only legitimate in-flight processing states can transition
    // to COMPLETED, preventing stale workers from resurrecting FAILED uploads.
    const finalizationResult = await db.videoUpload.updateMany({
      where: {
        id: uploadId,
        status: {
          in: ['PROCESSING', 'TRANSCODING', 'UPLOAD_COMPLETED']
        }
      },
      data: {
        status: 'COMPLETED',
        completedAt: new Date(),
        storagePath: `${attemptPrefix}master.m3u8`,
        errorMessage: null
      }
    });

    if (finalizationResult.count === 0) {
      // Another attempt already won and finalized COMPLETED.
      // A losing attempt MUST NOT overwrite the winner's storagePath,
      // and MUST NOT delete any objects (especially the winner's attempt prefix).
      logger.info(
        `[Job ${job.id}] VideoUpload ${uploadId} was already finalized by a concurrent attempt (count = 0). ` +
        `This attempt (${attemptNum}) gracefully yielding without cleanup.`
      );
      return { status: 'already_completed', uploadId };
    }

    logger.info(
      `[Job ${job.id}] VideoUpload ${uploadId} won atomic finalization (count = 1). ` +
      `Final storagePath: ${attemptPrefix}master.m3u8`
    );

    // 14. Safe Cleanup: Clean up earlier failed attempt prefixes only AFTER winning finalization.
    // Notice: Only previous attempts (prev < attemptNum) are cleaned.
    // The winning attempt (attemptNum) is NEVER touched.
    for (let prev = 1; prev < attemptNum; prev++) {
      const prevPrefix = `videos/${uploadId}/attempts/${prev}/hls/`;
      await purgePrefixInR2(prevPrefix).catch(cleanErr => {
        logger.warn(`Non-critical: could not clean prior attempt prefix ${prevPrefix}:`, cleanErr.message);
      });
    }

    await job.updateProgress(100);
    logger.info(`[Job ${job.id}] Successfully completed multi-rendition HLS transcoding for: ${uploadId}`);
    return { status: 'success', uploadId };
  } catch (error: any) {
    const sanitizedError = sanitizeErrorMessage(error.message);
    const isUnrecoverable = error instanceof UnrecoverableError || isFinalAttempt;

    if (isUnrecoverable) {
      logger.error(`[Job ${job.id}] Terminal failure for ${uploadId}: ${sanitizedError}`);
      await db.videoUpload.update({
        where: { id: uploadId },
        data: {
          status: 'FAILED',
          errorMessage: sanitizedError
        }
      }).catch(dbErr => logger.error(`Failed to update VideoUpload FAILED status: ${dbErr.message}`));
    } else {
      logger.warn(
        `[Job ${job.id}] Attempt ${attemptNum}/${totalAllowedAttempts} failed with retryable error: ${sanitizedError}. ` +
        `Will retry via BullMQ backoff. Database status preserved as TRANSCODING.`
      );
    }

    throw error;
  } finally {
    currentWorkDir = null;
    if (fs.existsSync(workDir)) {
      fs.rmSync(workDir, { recursive: true, force: true });
    }
  }
};

/**
 * BullMQ Worker Registration with Concurrency 1
 */
const videoWorker = new Worker('video-transcode-queue', processVideo, {
  connection: {
    host: new URL(REDIS_URL).hostname,
    port: parseInt(new URL(REDIS_URL).port || '6379', 10),
    username: new URL(REDIS_URL).username || undefined,
    password: new URL(REDIS_URL).password || undefined
  },
  concurrency: 1, // Single active transcode to guarantee CPU/RAM stability
});

videoWorker.on('completed', (job) => {
  logger.info(`[BullMQ] Job ${job.id} has completed successfully`);
});

videoWorker.on('failed', (job, err) => {
  logger.error(`[BullMQ] Job ${job?.id} failed with error: ${sanitizeErrorMessage(err.message)}`);
});

export interface StaleSweepOptions {
  tmpRoot?: string;
  maxAgeMs?: number;
  now?: number;
  activeWorkDir?: string | null;
}

export interface StaleSweepResult {
  swept: string[];
  preserved: string[];
}

/**
 * Startup sweep: Purge stale abandoned directories older than 2 hours.
 * Cleans both direct transcode directories ('transcode-*') and Google Drive ingestion scratch directories ('drive-*').
 * Preserves active work directories and recently updated work.
 */
export function sweepStaleTempDirectories(options: StaleSweepOptions = {}): StaleSweepResult {
  const swept: string[] = [];
  const preserved: string[] = [];

  try {
    const tmpRoot = options.tmpRoot
      ? path.resolve(options.tmpRoot)
      : (process.env.SCRATCH_DIR ? path.resolve(process.env.SCRATCH_DIR) : path.resolve(process.cwd(), 'tmp'));
    if (!fs.existsSync(tmpRoot)) return { swept, preserved };

    const resolvedRoot = path.resolve(tmpRoot);
    const entries = fs.readdirSync(tmpRoot, { withFileTypes: true });
    const now = options.now ?? Date.now();
    const TWO_HOURS_MS = options.maxAgeMs ?? 2 * 3600 * 1000;
    const activeDir = options.activeWorkDir !== undefined ? options.activeWorkDir : currentWorkDir;

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;

      const isManagedPrefix = entry.name.startsWith('transcode-') || entry.name.startsWith('drive-');
      if (!isManagedPrefix) continue;

      const resolvedDir = path.resolve(tmpRoot, entry.name);

      // Strict path containment check: candidate must be strictly inside scratch root
      if (!resolvedDir.startsWith(resolvedRoot + path.sep)) {
        logger.warn(`Security check: directory escapes scratch root, skipping: ${entry.name}`);
        continue;
      }

      // Never remove directories associated with the currently active job
      if (activeDir && path.resolve(activeDir) === resolvedDir) {
        preserved.push(entry.name);
        continue;
      }

      try {
        const stat = fs.statSync(resolvedDir);
        if (now - stat.mtimeMs > TWO_HOURS_MS) {
          logger.info(`Sweeping stale temporary directory: ${entry.name}`);
          fs.rmSync(resolvedDir, { recursive: true, force: true });
          swept.push(entry.name);
        } else {
          // Recently updated work (< 2 hours old) is preserved
          preserved.push(entry.name);
        }
      } catch (entryErr: any) {
        // Filesystem race (e.g. parallel job cleanup finished between readdir and stat), safe to ignore
      }
    }
  } catch (err: any) {
    logger.warn('Error during stale directory sweep:', err.message);
  }

  return { swept, preserved };
}

sweepStaleTempDirectories();

/**
 * Graceful Process Shutdown Handling
 */
const handleShutdown = async (signal: string) => {
  logger.info(`Received ${signal}. Shutting down worker gracefully...`);

  // Kill active FFmpeg child immediately to release CPU and file locks
  if (activeFfmpegChild) {
    try {
      activeFfmpegChild.kill('SIGKILL');
    } catch (_) {}
    activeFfmpegChild = null;
  }

  // Clean up current working directory
  if (currentWorkDir && fs.existsSync(currentWorkDir)) {
    try {
      fs.rmSync(currentWorkDir, { recursive: true, force: true });
    } catch (_) {}
    currentWorkDir = null;
  }

  try {
    await videoWorker.close();
  } catch (err: any) {
    logger.error('Error closing BullMQ worker:', err.message);
  }

  process.exit(0);
};

process.on('SIGTERM', () => handleShutdown('SIGTERM'));
process.on('SIGINT', () => handleShutdown('SIGINT'));
