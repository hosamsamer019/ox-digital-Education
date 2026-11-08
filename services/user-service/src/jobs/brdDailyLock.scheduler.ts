import { db } from '../../../../packages/database/src/index.js';
import { logger } from '@shared/utils';
import { BrdNotificationService } from '../services/brdNotification.service.js';

let schedulerInterval: NodeJS.Timeout | null = null;
let isJobRunning = false;

/**
 * Returns current date components in Africa/Cairo timezone
 */
export function getCairoDateInfo(date = new Date()): {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
  isoDateStr: string;
} {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Africa/Cairo',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
    hour12: false
  });

  const parts = formatter.formatToParts(date);
  const partMap: Record<string, string> = {};
  for (const p of parts) {
    partMap[p.type] = p.value;
  }

  const year = parseInt(partMap.year, 10);
  const month = parseInt(partMap.month, 10);
  const day = parseInt(partMap.day, 10);
  const hour = parseInt(partMap.hour, 10);
  const minute = parseInt(partMap.minute, 10);
  const second = parseInt(partMap.second, 10);
  const isoDateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

  return { year, month, day, hour, minute, second, isoDateStr };
}

/**
 * Core daily automated locking job
 * Idempotent: Evaluates per-teacher access state and only transitions / notifies once per state change.
 */
export async function runBrdDailyLockEvaluation(referenceDate = new Date()) {
  if (isJobRunning) {
    logger.warn('[BrdDailyLock] Job execution already in progress, skipping concurrent run.');
    return { skipped: true };
  }

  isJobRunning = true;
  const cairo = getCairoDateInfo(referenceDate);
  logger.info(`[BrdDailyLock] Executing evaluation for Cairo date: ${cairo.isoDateStr} (Year: ${cairo.year}, Month: ${cairo.month}, Day: ${cairo.day})`);

  let lockedCount = 0;
  let graceCount = 0;
  let activeCount = 0;
  let reminderCount = 0;

  try {
    // 1. Fetch all active student-teacher relationships
    const enrollments = await db.studentTeacher.findMany({
      where: {
        status: 'ACTIVE'
      },
      include: {
        student: {
          select: {
            id: true,
            name: true,
            email: true,
            parentId: true,
            institutionId: true,
            gradeLevel: true,
            responsibleTeacherId: true
          }
        },
        teacher: {
          select: {
            id: true,
            name: true,
            email: true,
            branchId: true,
            institutionId: true
          }
        }
      }
    });

    const now = referenceDate;

    // Cache teacher settings
    const teacherSettings = await db.teacherSubscriptionSetting.findMany();
    const settingsMap = new Map(teacherSettings.map(s => [s.teacherId, s]));

    for (const enr of enrollments) {
      const studentId = enr.studentId;
      const teacherId = enr.teacherId;
      const student = enr.student;
      const teacher = enr.teacher;

      // Protection: Unresolved student ownership must NOT be locked (BRD Section 4.5)
      if (!student.responsibleTeacherId && enr.creatorId === 'SYSTEM_MIGRATION') {
        continue;
      }

      // Check if unexpired manager exception exists
      if (enr.exceptionActiveUntil && enr.exceptionActiveUntil > now) {
        if (enr.accessStatus !== 'ACTIVE') {
          await db.studentTeacher.update({
            where: { id: enr.id },
            data: { accessStatus: 'ACTIVE' }
          });
        }
        activeCount++;
        continue;
      }

      // Look up teacher grace & lock settings
      const setting = settingsMap.get(teacherId);
      const lastGraceDay = setting?.lastGraceDay ?? 5;
      const lockDay = setting?.lockDay ?? 6;
      const lockMessage = setting?.lockMessageAr || 'تم إيقاف الوصول مؤقتاً لعدم سداد الاشتراك الشهري. يرجى مراجعة إدارة الفرع.';

      // Fetch or create monthly subscription
      let sub = await db.studentMonthlySubscription.findUnique({
        where: {
          studentId_teacherId_billingYear_billingMonth: {
            studentId,
            teacherId,
            billingYear: cairo.year,
            billingMonth: cairo.month
          }
        }
      });

      if (!sub) {
        // Look up applicable price
        const monthStr = `${cairo.year}-${String(cairo.month).padStart(2, '0')}`;
        const pricing = await db.teacherGradePricing.findFirst({
          where: {
            teacherId,
            grade: (student.gradeLevel as string) || 'SECONDARY_1',
            effectiveMonth: { lte: monthStr }
          },
          orderBy: { effectiveMonth: 'desc' }
        });

        const price = pricing ? pricing.price : 0;
        sub = await db.studentMonthlySubscription.create({
          data: {
            studentId,
            teacherId,
            branchId: teacher.branchId || 'DEFAULT_BRANCH',
            billingYear: cairo.year,
            billingMonth: cairo.month,
            amountDue: price,
            amountPaid: 0,
            status: price > 0 ? 'UNPAID' : 'PAID',
            priceSnapshot: price
          }
        });
      }

      const isPaid = sub.status === 'PAID' || sub.status === 'EXEMPT';

      if (isPaid) {
        if (enr.accessStatus !== 'ACTIVE') {
          await db.studentTeacher.update({
            where: { id: enr.id },
            data: { accessStatus: 'ACTIVE' }
          });
        }
        activeCount++;
      } else {
        // Unpaid subscription
        if (cairo.day <= lastGraceDay) {
          // In grace period
          if (enr.accessStatus !== 'GRACE_PERIOD') {
            await db.studentTeacher.update({
              where: { id: enr.id },
              data: { accessStatus: 'GRACE_PERIOD' }
            });

            // Send grace reminder once when entering grace period
            const daysRemaining = Math.max(0, lastGraceDay - cairo.day + 1);
            await BrdNotificationService.notifyGracePeriodReminder({
              studentId,
              studentName: student.name,
              teacherName: teacher.name,
              parentId: student.parentId,
              daysRemaining,
              month: cairo.month,
              year: cairo.year
            });
            reminderCount++;
          }
          graceCount++;
        } else if (cairo.day >= lockDay) {
          // Locked
          if (enr.accessStatus !== 'LOCKED') {
            await db.studentTeacher.update({
              where: { id: enr.id },
              data: { accessStatus: 'LOCKED' }
            });

            // Record in audit log
            await db.studentAuditLog.create({
              data: {
                studentId,
                eventType: 'ACCESS_LOCKED',
                actorId: 'DAILY_SCHEDULER',
                actorRole: 'SYSTEM',
                details: {
                  teacherId,
                  month: cairo.month,
                  year: cairo.year,
                  lockDay,
                  cairoDate: cairo.isoDateStr
                }
              }
            });

            // Dispatch lock notification to Student, Parent, Teacher, Manager
            await BrdNotificationService.notifyAccountLocked({
              studentId,
              studentName: student.name,
              teacherId,
              teacherName: teacher.name,
              parentId: student.parentId,
              month: cairo.month,
              year: cairo.year,
              lockMessage,
              institutionId: teacher.institutionId || student.institutionId || ''
            });

            lockedCount++;
          }
        }
      }
    }

    logger.info(`[BrdDailyLock] Completed: Active=${activeCount}, Grace=${graceCount}, Locked=${lockedCount}, Reminders=${reminderCount}`);
    return {
      success: true,
      cairoDate: cairo.isoDateStr,
      activeCount,
      graceCount,
      lockedCount,
      reminderCount
    };
  } catch (err: any) {
    logger.error(`[BrdDailyLock] CRITICAL Scheduler Failure: ${err.message}`);
    // Notify Managers of failure (BRD Section 7.6)
    try {
      const managerIds = await BrdNotificationService.getManagerIds();
      for (const mId of managerIds) {
        await BrdNotificationService.createNotification({
          userId: mId,
          title: 'فشل مجدول الإغلاق التلقائي اليومي',
          message: `حدث خطأ أثناء تشغيل وظيفة الإغلاق التلقائي اليومي: ${err.message}`,
          type: 'SCHEDULER_FAILURE',
          metadata: { error: err.message, date: cairo.isoDateStr }
        });
      }
    } catch (e: any) {
      logger.error(`[BrdDailyLock] Failed to alert managers of scheduler failure: ${e.message}`);
    }
    throw err;
  } finally {
    isJobRunning = false;
  }
}

/**
 * Start the daily scheduler (runs every 60 seconds to detect 00:00 Cairo time)
 */
export function startBrdDailyLockScheduler() {
  if (schedulerInterval) return;

  logger.info('[BrdDailyLock] Initializing Cairo daily lock scheduler (evaluates at 00:00 Cairo time)...');

  let lastRunDate = '';

  schedulerInterval = setInterval(async () => {
    try {
      const cairo = getCairoDateInfo();
      // Check if it is midnight hour (00:00) and hasn't run yet today
      if (cairo.hour === 0 && cairo.minute === 0 && lastRunDate !== cairo.isoDateStr) {
        lastRunDate = cairo.isoDateStr;
        await runBrdDailyLockEvaluation();
      }
    } catch (err: any) {
      logger.error(`[BrdDailyLock] Interval loop error: ${err.message}`);
    }
  }, 30000); // check every 30 seconds
}

export function stopBrdDailyLockScheduler() {
  if (schedulerInterval) {
    clearInterval(schedulerInterval);
    schedulerInterval = null;
    logger.info('[BrdDailyLock] Cairo daily lock scheduler stopped.');
  }
}

export const runDailyLockCycle = runBrdDailyLockEvaluation;


