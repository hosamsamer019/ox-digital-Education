import { Queue, Worker, Job } from 'bullmq';
import { db } from '@smartmath/database';
import IORedis from 'ioredis';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../../../.env') });

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
const isRedisDisabled = process.env.DISABLE_REDIS === 'true' || (!process.env.REDIS_URL && process.env.NODE_ENV === 'test');

let connection: IORedis | null = null;
export let riskEngineQueue: Queue | null = null;
let worker: Worker | null = null;

if (!isRedisDisabled) {
  try {
    connection = new IORedis(redisUrl, { maxRetriesPerRequest: null, lazyConnect: true });
    connection.on('error', (err) => {
      console.warn('[RiskEngine] Redis connection warning:', err.message);
    });
    riskEngineQueue = new Queue('RiskEngineQueue', { connection });
  } catch (err) {
    console.error('[RiskEngine] Failed to initialize queue connection:', err);
  }
}

export async function setupRiskEngineJob() {
  if (isRedisDisabled || !riskEngineQueue) {
    console.log('[RiskEngine] Redis is disabled, skipping Risk Engine Cron Job.');
    return;
  }
  await riskEngineQueue.add('evaluate-risks', {}, {
    repeat: {
      pattern: '0 * * * *' // Every hour at minute 0
    },
    jobId: 'hourly-risk-evaluation'
  });
  console.log('Risk Engine Cron Job Scheduled (Hourly)');
}

if (!isRedisDisabled && connection) {
  worker = new Worker('RiskEngineQueue', async (job: Job) => {
    console.log(`[RiskEngine] Starting evaluation at ${new Date().toISOString()}`);
  
  const threeDaysAgo = new Date(Date.now() - 72 * 60 * 60 * 1000);

  const enrollments = await db.courseEnrollment.findMany({
    select: {
      id: true,
      studentId: true,
      courseId: true,
      course: {
        select: {
          id: true,
          status: true,
          lessons: {
            where: {
              publishedAt: { lte: threeDaysAgo }
            },
            select: {
              id: true,
              title: true,
              videoUrl: true,
              publishedAt: true,
              courseId: true
            }
          }
        }
      }
    }
  });

  for (const enrollment of enrollments) {
    if (enrollment.course.status !== 'PUBLISHED') continue;
    
    for (const lesson of enrollment.course.lessons) {
      let progress = await db.videoProgress.findUnique({
        where: { studentId_lessonId: { studentId: enrollment.studentId, lessonId: lesson.id } }
      });

      const isDrive = lesson.videoUrl && (lesson.videoUrl.includes('drive.google.com') || lesson.videoUrl.includes('youtube') === false);
      
      let isRiskTriggered = false;
      let riskCode = isDrive ? 'NOT_OPENED_3_DAYS' : 'NOT_STARTED_3_DAYS';

      if (!progress) {
        isRiskTriggered = true;
      } else {
        if (isDrive && !progress.firstOpenedAt) {
          isRiskTriggered = true;
        } else if (!isDrive && !progress.firstActivityAt) {
          isRiskTriggered = true;
        }
      }

      if (isRiskTriggered) {
        if (!progress) {
          progress = await db.videoProgress.create({
            data: {
              studentId: enrollment.studentId,
              lessonId: lesson.id,
              status: 'NOT_STARTED',
              currentRiskLevel: 'HIGH',
              currentRiskCode: riskCode,
              riskDetectedAt: new Date()
            }
          });
        } else if (progress.currentRiskCode !== riskCode) {
          progress = await db.videoProgress.update({
            where: { id: progress.id },
            data: {
              currentRiskLevel: 'HIGH',
              currentRiskCode: riskCode,
              riskDetectedAt: new Date()
            }
          });
        }

        const activeHistory = await db.studentRiskHistory.findFirst({
          where: { studentId: enrollment.studentId, lessonId: lesson.id, riskCode, resolvedAt: null }
        });

        if (!activeHistory) {
          await db.studentRiskHistory.create({
            data: {
              studentId: enrollment.studentId,
              lessonId: lesson.id,
              riskLevel: 'HIGH',
              riskCode
            }
          });
        }
      } else if (progress && !isDrive) {
        // Priority 2: ABANDONED_VIDEO (YouTube only)
        if (progress.status === 'IN_PROGRESS' && progress.progress > 5 && progress.progress < 90) {
          if (progress.lastActivityAt && progress.lastActivityAt < threeDaysAgo) {
            const abCode = 'ABANDONED_VIDEO';
            if (progress.currentRiskCode !== abCode) {
              await db.videoProgress.update({
                where: { id: progress.id },
                data: {
                  currentRiskLevel: 'HIGH',
                  currentRiskCode: abCode,
                  riskDetectedAt: new Date()
                }
              });
            }

            const activeHistory = await db.studentRiskHistory.findFirst({
              where: { studentId: enrollment.studentId, lessonId: lesson.id, riskCode: abCode, resolvedAt: null }
            });

            if (!activeHistory) {
              await db.studentRiskHistory.create({
                data: {
                  studentId: enrollment.studentId,
                  lessonId: lesson.id,
                  riskLevel: 'HIGH',
                  riskCode: abCode
                }
              });
            }
          }
        }
      }
    }
  }
  console.log(`[RiskEngine] Evaluation finished at ${new Date().toISOString()}`);
}, { connection });

if (worker) {
  worker.on('failed', (job, err) => {
    console.error(`[RiskEngine] Job ${job?.id} failed with error:`, err);
  });
}
}
