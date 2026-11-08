/**
 * Unified Academic Eligibility Invariant
 *
 * Provides a single, centralized definition of what constitutes an eligible,
 * verified graded attempt across OX-DIGITAL services.
 *
 * Excludes:
 * - CHEATING attempts (disqualified)
 * - STARTED / IN_PROGRESS attempts (incomplete)
 * - TIME_EXPIRED attempts without verified grading
 * - Ambiguous legacy attempts (no score, no answers, unverified completion)
 * - Records without a verified maximum score (totalPoints <= 0 or null)
 * - Records with invalid/out-of-range score metadata
 */

export type AttemptClassification =
  | 'VERIFIED_GRADED'
  | 'LEGACY_AWAITING_CLASSIFICATION'
  | 'UNVERIFIABLE'
  | 'EXCLUDED';

export interface EligibilityResult {
  isEligible: boolean;
  classification: AttemptClassification;
  reason?: string;
  calculatedPercentage?: number | null;
  totalPoints?: number | null;
}

/**
 * Evaluates whether an attempt satisfies the Unified Academic Eligibility Invariant.
 */
export function evaluateAttemptEligibility(att: any): EligibilityResult {
  if (!att) {
    return { isEligible: false, classification: 'EXCLUDED', reason: 'NULL_RECORD' };
  }

  // 1. Check for Cheating / Disqualification
  const isCheating =
    att.status === 'CHEATING' ||
    att.cheatingDetected === true ||
    (Array.isArray(att.ExamViolation) && att.ExamViolation.length >= 2);

  if (isCheating) {
    return { isEligible: false, classification: 'EXCLUDED', reason: 'CHEATING_DETECTED' };
  }

  // 2. Check for Active / Incomplete States
  const upperStatus = att.status ? String(att.status).toUpperCase() : '';
  if (upperStatus === 'IN_PROGRESS' || upperStatus === 'PENDING' || upperStatus === 'CANCELLED') {
    return { isEligible: false, classification: 'EXCLUDED', reason: 'INCOMPLETE_ACTIVE_ATTEMPT' };
  }

  // 3. Check for Time Expired without verified grading
  if (upperStatus === 'TIME_EXPIRED' && !att.isGraded) {
    return { isEligible: false, classification: 'EXCLUDED', reason: 'TIME_EXPIRED_UNGRADED' };
  }

  // 4. Handle Legacy Records (status === 'STARTED' and isGraded === false)
  const isLegacyRecord =
    att.status === 'STARTED' &&
    att.isGraded === false &&
    att.submittedAt === null &&
    (att.percentage === null || att.percentage === undefined);

  if (isLegacyRecord) {
    // If score is 0 and no answers, it was abandoned
    const answersArray = Array.isArray(att.answers) ? att.answers : null;
    const hasAnswers = answersArray !== null && answersArray.length > 0;

    if (att.score === 0 && !hasAnswers) {
      return { isEligible: false, classification: 'EXCLUDED', reason: 'ABANDONED_LEGACY_ATTEMPT' };
    }

    // Has score > 0 or has submitted answers: awaiting backfill classification
    return {
      isEligible: false,
      classification: 'LEGACY_AWAITING_CLASSIFICATION',
      reason: 'AWAITING_HISTORICAL_BACKFILL_CLASSIFICATION'
    };
  }

  // If status is STARTED on a modern or classified attempt, it is not completed
  if (upperStatus === 'STARTED' && !att.isGraded) {
    return { isEligible: false, classification: 'EXCLUDED', reason: 'STARTED_NOT_SUBMITTED' };
  }

  // 5. Must be explicitly Graded
  if (att.isGraded !== true && upperStatus !== 'GRADED') {
    return { isEligible: false, classification: 'EXCLUDED', reason: 'NOT_GRADED' };
  }

  // 6. Max Score (totalPoints) Verification - DEF-02
  const totalPoints = att.totalPoints ?? att.exam?.totalPoints;
  if (typeof totalPoints !== 'number' || !isFinite(totalPoints) || totalPoints <= 0) {
    return {
      isEligible: false,
      classification: 'UNVERIFIABLE',
      reason: 'MISSING_OR_INVALID_MAXIMUM_POINTS',
      totalPoints: null,
      calculatedPercentage: null
    };
  }

  // 7. Score Verification
  const rawScore = att.score;
  if (typeof rawScore !== 'number' || !isFinite(rawScore) || isNaN(rawScore) || rawScore < 0 || rawScore > totalPoints) {
    return {
      isEligible: false,
      classification: 'UNVERIFIABLE',
      reason: 'SCORE_OUT_OF_VALID_RANGE',
      totalPoints,
      calculatedPercentage: null
    };
  }

  // 8. Percentage Calculation
  let percentage: number;
  if (att.percentage !== undefined && att.percentage !== null && !isNaN(Number(att.percentage))) {
    percentage = Number(att.percentage);
  } else {
    percentage = Math.round(((rawScore / totalPoints) * 100) * 10) / 10;
  }

  if (!isFinite(percentage) || percentage < 0 || percentage > 100) {
    return {
      isEligible: false,
      classification: 'UNVERIFIABLE',
      reason: 'PERCENTAGE_OUT_OF_VALID_RANGE',
      totalPoints,
      calculatedPercentage: null
    };
  }

  return {
    isEligible: true,
    classification: 'VERIFIED_GRADED',
    calculatedPercentage: percentage,
    totalPoints
  };
}

/**
 * Boolean helper shorthand.
 */
export function isEligibleGradedAttempt(att: any): boolean {
  return evaluateAttemptEligibility(att).isEligible;
}

/**
 * Safe database query filter for transitional queries (prevents pre-backfill data vacuum).
 */
export const LEGACY_SAFE_EXAM_ATTEMPT_FILTER = {
  OR: [
    {
      status: 'GRADED' as const,
      isGraded: true
    },
    {
      status: 'STARTED' as const,
      isGraded: false,
      submittedAt: null,
      score: { gt: 0 }
    }
  ]
};

/**
 * Post-backfill canonical database query filter.
 */
export const POST_BACKFILL_EXAM_ATTEMPT_FILTER = {
  status: 'GRADED' as const,
  isGraded: true
};

