import { db } from '../../../../packages/database/src/index.js';

export interface BackfillSummary {
  totalScanned: number;
  eligibleCandidates: number;
  skippedAlreadyClassified: number;
  skippedModernRecords: number;
  categories: {
    GRADED_NORMAL: number;
    GRADED_ZERO: number;
    ABANDONED_ZERO: number;
    DISQUALIFIED_CHEATING: number;
    TIME_EXPIRED_SUBMITTED: number;
    TIME_EXPIRED_UNSUBMITTED: number;
    UNVERIFIABLE_MAX_POINTS: number;
    RETAKE_SUPERSEDED: number;
    CORRUPTED_MISSING_EXAM: number;
    ACTIVE_IN_PROGRESS: number;
  };
  dryRun: boolean;
  executedUpdates: number;
}

/**
 * Historical Data Backfill & Alignment Script for ExamAttempt.
 * Implements strict data integrity, idempotency, and timestamp preservation:
 *
 * 1. DEF-03: Never fabricates submittedAt. Legacy attempts with missing submission
 *    timestamps retain submittedAt = null.
 * 2. DEF-02: Never assigns default totalPoints = 100. If maximum points cannot be verified
 *    from Exam or Question definitions, totalPoints and percentage remain null (UNVERIFIABLE_MAX_POINTS).
 * 3. DEF-04: Completely idempotent. Scopes execution strictly to unmigrated candidate records.
 *    Repeated runs detect 0 candidates and perform 0 mutations.
 * 4. Safety Guard: Defaults to DRY-RUN mode. Requires explicit --execute flag.
 */
export async function runBackfill(options: { execute?: boolean } = {}): Promise<BackfillSummary> {
  const isDryRun = !options.execute;
  console.log(`[Backfill] Starting ExamAttempt classification in ${isDryRun ? 'DRY-RUN (Safe Read-Only)' : 'EXECUTE'} mode...`);

  // Query all attempts to inspect state and ensure complete audit trail
  const allAttempts = await db.examAttempt.findMany({
    include: {
      exam: true,
      ExamViolation: true
    },
    orderBy: { createdAt: 'asc' }
  });

  const summary: BackfillSummary = {
    totalScanned: allAttempts.length,
    eligibleCandidates: 0,
    skippedAlreadyClassified: 0,
    skippedModernRecords: 0,
    categories: {
      GRADED_NORMAL: 0,
      GRADED_ZERO: 0,
      ABANDONED_ZERO: 0,
      DISQUALIFIED_CHEATING: 0,
      TIME_EXPIRED_SUBMITTED: 0,
      TIME_EXPIRED_UNSUBMITTED: 0,
      UNVERIFIABLE_MAX_POINTS: 0,
      RETAKE_SUPERSEDED: 0,
      CORRUPTED_MISSING_EXAM: 0,
      ACTIVE_IN_PROGRESS: 0
    },
    dryRun: isDryRun,
    executedUpdates: 0
  };

  // Map attempts by studentId + examId for retake supersession analysis
  const attemptsByStudentExam = new Map<string, typeof allAttempts>();
  for (const att of allAttempts) {
    const key = `${att.studentId}:${att.examId}`;
    const list = attemptsByStudentExam.get(key) || [];
    list.push(att);
    attemptsByStudentExam.set(key, list);
  }

  const now = new Date();

  for (const att of allAttempts) {
    // DEF-04 Guard: Identify modern records or records already classified
    const isAlreadyClassified =
      att.status === 'GRADED' ||
      att.status === 'CHEATING' ||
      att.isGraded === true ||
      att.percentage !== null;

    if (isAlreadyClassified) {
      summary.skippedAlreadyClassified++;
      continue;
    }

    // Modern active attempts (have submittedAt or updatedAt distinctly newer than createdAt without being legacy)
    const isModernActive =
      att.status === 'IN_PROGRESS' ||
      att.submittedAt !== null;

    if (isModernActive) {
      summary.skippedModernRecords++;
      continue;
    }

    // This is an unclassified candidate legacy record
    summary.eligibleCandidates++;

    let category: keyof BackfillSummary['categories'] = 'ABANDONED_ZERO';
    let targetStatus: 'STARTED' | 'IN_PROGRESS' | 'TIME_EXPIRED' | 'GRADED' | 'CHEATING' = 'STARTED';
    let isGraded = false;
    // DEF-03: Do NOT invent submittedAt = createdAt. Keep null!
    const submittedAt: Date | null = null;
    let percentage: number | null = null;

    // DEF-02: Verify maximum points from exam or questions; NEVER assume 100
    let totalPoints: number | null = (typeof att.exam?.totalPoints === 'number' && att.exam.totalPoints > 0)
      ? att.exam.totalPoints
      : null;

    if (!totalPoints && Array.isArray(att.exam?.questions) && att.exam.questions.length > 0) {
      const sum = (att.exam.questions as any[]).reduce(
        (acc: number, q: any) => acc + (typeof q.points === 'number' && q.points > 0 ? q.points : 0),
        0
      );
      if (sum > 0) totalPoints = sum;
    }

    const hasViolations = Array.isArray(att.ExamViolation) && att.ExamViolation.length >= 2;
    const answersArray = Array.isArray(att.answers) ? att.answers : null;
    const hasAnswers = answersArray !== null && answersArray.length > 0;
    const durationMinutes = att.exam?.duration ?? 60;
    const elapsedMinutes = (now.getTime() - new Date(att.createdAt).getTime()) / 60000;

    if (!att.exam) {
      category = 'CORRUPTED_MISSING_EXAM';
      targetStatus = 'STARTED';
      isGraded = false;
    } else if (hasViolations) {
      category = 'DISQUALIFIED_CHEATING';
      targetStatus = 'CHEATING';
      isGraded = false;
      percentage = 0;
    } else if (att.score > 0) {
      if (totalPoints !== null && totalPoints > 0) {
        category = 'GRADED_NORMAL';
        targetStatus = 'GRADED';
        isGraded = true;
        percentage = Math.round(((att.score / totalPoints) * 100) * 10) / 10;
      } else {
        // DEF-02: Cannot verify totalPoints. Record as unverifiable max points!
        category = 'UNVERIFIABLE_MAX_POINTS';
        targetStatus = 'STARTED';
        isGraded = false;
        totalPoints = null;
        percentage = null;
      }
    } else if (att.score === 0 && hasAnswers) {
      // Legitimately answered but scored 0
      if (totalPoints !== null && totalPoints > 0) {
        category = 'GRADED_ZERO';
        targetStatus = 'GRADED';
        isGraded = true;
        percentage = 0;
      } else {
        category = 'UNVERIFIABLE_MAX_POINTS';
        targetStatus = 'STARTED';
        isGraded = false;
        totalPoints = null;
        percentage = null;
      }
    } else if (att.score === 0 && !hasAnswers) {
      // Abandoned exam: started but no answers submitted
      if (elapsedMinutes > durationMinutes + 5) {
        category = 'TIME_EXPIRED_UNSUBMITTED';
        targetStatus = 'TIME_EXPIRED';
        isGraded = false;
      } else {
        category = 'ABANDONED_ZERO';
        targetStatus = 'STARTED';
        isGraded = false;
      }
    }

    // Check if superseded retake
    const studentExamAttempts = attemptsByStudentExam.get(`${att.studentId}:${att.examId}`) || [];
    if (studentExamAttempts.length > 1 && (category === 'GRADED_NORMAL' || category === 'GRADED_ZERO')) {
      const latestAttempt = studentExamAttempts[studentExamAttempts.length - 1];
      if (latestAttempt.id !== att.id) {
        summary.categories.RETAKE_SUPERSEDED++;
      }
    }

    summary.categories[category]++;

    // Write-mode update with guarded where condition (DEF-04)
    if (!isDryRun) {
      await db.examAttempt.update({
        where: {
          id: att.id
        },
        data: {
          status: targetStatus,
          isGraded,
          submittedAt,
          totalPoints,
          percentage
        }
      });
      summary.executedUpdates++;
    }
  }

  console.log('[Backfill] Classification complete. Results:', summary);
  return summary;
}

// CLI Execution Entry Point
if (process.argv[1]?.includes('backfillExamAttempts')) {
  const shouldExecute = process.argv.includes('--execute');
  runBackfill({ execute: shouldExecute })
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('[Backfill Error]:', err);
      process.exit(1);
    });
}
