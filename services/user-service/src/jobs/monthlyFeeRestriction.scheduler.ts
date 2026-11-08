import { db } from '../../../../packages/database/src/index.js';
import { logger } from '@shared/utils';
import { MonthlyFeeAccessControlService } from '../services/monthlyFeeAccessControl.service.js';

const ADVISORY_LOCK_KEY = 8829103; // Stable unique 32-bit key for PostgreSQL advisory lock
let isJobRunningLocally = false;
let schedulerTimer: NodeJS.Timeout | null = null;

export interface SchedulerExecutionResult {
  ran: boolean;
  reason?: string;
  institutionsCount?: number;
  studentsEvaluated?: number;
  restrictedCount?: number;
  reactivatedCount?: number;
  durationMs?: number;
  timestamp: string;
}

/**
 * Executes a single atomic, distributed-locked evaluation cycle across all institutions.
 * Safe against concurrent executions in multi-replica deployments via PostgreSQL advisory locking.
 */
export async function executeRestrictionEvaluationCycle(asOfDate: Date = new Date()): Promise<SchedulerExecutionResult> {
  const timestamp = new Date().toISOString();
  const startTime = Date.now();

  // 1. In-process overlap protection
  if (isJobRunningLocally) {
    logger.info('[AccessControlScheduler] Local evaluation job is already running. Skipping overlapping execution.');
    return { ran: false, reason: 'LOCAL_OVERLAP_PREVENTED', timestamp };
  }

  isJobRunningLocally = true;

  try {
    // 2. Distributed cluster-wide lock across all service replicas
    const lockRows = await db.$queryRawUnsafe<Array<{ acquired: boolean }>>(
      `SELECT pg_try_advisory_lock(${ADVISORY_LOCK_KEY}) AS acquired;`
    );
    const acquired = Boolean(lockRows?.[0]?.acquired);

    if (!acquired) {
      logger.info('[AccessControlScheduler] Another service replica currently holds the advisory lock. Skipping this cycle.');
      return { ran: false, reason: 'DISTRIBUTED_LOCK_HELD', timestamp };
    }

    try {
      // 3. Query all active institutions
      const institutions = await db.institution.findMany({
        where: { status: 'ACTIVE', deletedAt: null },
        select: { id: true }
      });

      let totalEvaluated = 0;
      let totalRestricted = 0;
      let totalReactivated = 0;

      for (const inst of institutions) {
        try {
          const res = await MonthlyFeeAccessControlService.runScheduledFinancialAccessEvaluation(inst.id, asOfDate);
          totalEvaluated += res.evaluatedCount;
          totalRestricted += res.restrictedCount;
          totalReactivated += res.reactivatedCount;
        } catch (instErr: any) {
          logger.error(`[AccessControlScheduler] Error evaluating institution ${inst.id}: ${instErr.message}`);
        }
      }

      const durationMs = Date.now() - startTime;
      logger.info(
        `[AccessControlScheduler] Cycle completed in ${durationMs}ms: ${institutions.length} institutions, ` +
        `${totalEvaluated} students evaluated, ${totalRestricted} restricted, ${totalReactivated} reactivated.`
      );

      return {
        ran: true,
        institutionsCount: institutions.length,
        studentsEvaluated: totalEvaluated,
        restrictedCount: totalRestricted,
        reactivatedCount: totalReactivated,
        durationMs,
        timestamp
      };
    } finally {
      // 4. Always release distributed advisory lock
      try {
        await db.$queryRawUnsafe(`SELECT pg_advisory_unlock(${ADVISORY_LOCK_KEY});`);
      } catch (unlockErr: any) {
        logger.error(`[AccessControlScheduler] Error releasing advisory lock: ${unlockErr.message}`);
      }
    }
  } catch (error: any) {
    logger.error(`[AccessControlScheduler] Unhandled error during evaluation cycle: ${error.message}`);
    return { ran: false, reason: `ERROR: ${error.message}`, timestamp };
  } finally {
    isJobRunningLocally = false;
  }
}

/**
 * Initializes and starts the automated scheduler timer
 */
export function startMonthlyFeeRestrictionScheduler(intervalMs?: number): void {
  if (schedulerTimer) {
    logger.warn('[AccessControlScheduler] Scheduler is already active.');
    return;
  }

  const cadence = intervalMs || parseInt(process.env.RESTRICTION_SCHEDULER_INTERVAL_MS || '3600000', 10); // Default 1 hour
  logger.info(`[AccessControlScheduler] Initializing Monthly Fee Restriction Scheduler (Cadence: ${cadence}ms)`);

  schedulerTimer = setInterval(async () => {
    await executeRestrictionEvaluationCycle();
  }, cadence);

  // Unref timer so it doesn't block graceful shutdown
  if (schedulerTimer.unref) {
    schedulerTimer.unref();
  }
}

/**
 * Stops the automated scheduler timer
 */
export function stopMonthlyFeeRestrictionScheduler(): void {
  if (schedulerTimer) {
    clearInterval(schedulerTimer);
    schedulerTimer = null;
    logger.info('[AccessControlScheduler] Monthly Fee Restriction Scheduler stopped.');
  }
}

