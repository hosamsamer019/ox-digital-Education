export type AcademicStatus =
  | 'AVAILABLE'
  | 'INSUFFICIENT_DATA'
  | 'PERIOD_CONFIGURATION_REQUIRED'
  | 'BLOCKED_PENDING_POLICY'
  | 'BLOCKED_UNVERIFIABLE_COMPLETION';

export type PeriodStatus = 'UNSPECIFIED' | 'SPECIFIED' | 'CONFIGURATION_REQUIRED';

export interface EligibleAssessmentSummary {
  id: string;
  assessmentId: string;
  title: string;
  score: number;
  totalPoints: number;
  percentage: number;
  date: string;
  submittedAt?: string;
  status: string;
}

export interface AcademicAssessmentResult {
  status: AcademicStatus;
  average: number | null;
  eligibleAssessmentCount: number;
  minimumRequired: number; // Exactly 3 per OD-02
  assessmentPeriod: string | null;
  periodStatus: PeriodStatus;
  rollingDays?: number | null;
  retakeConflict: boolean;
  unverifiableAttemptsCount: number;
  hasUnverifiableAttempts: boolean;
  dataIntegrityNotice: string | null;
  dataIntegrityNoticeAr: string | null;
  assessedAt: string;
  explanation: string;
  explanationAr: string;
  classification: null; // Explicitly null: no unapproved risk classification
  eligibleAssessments: EligibleAssessmentSummary[];
}

export interface CalculationOptions {
  assessmentPeriod?: string | null;
  minimumRequired?: number; // Defaults to 3 (OD-02)
  startDate?: Date | string | null;
  endDate?: Date | string | null;
  rollingDays?: number | null;
  requireRollingPeriod?: boolean;
}

/**
 * OD-01, OD-02, OD-11 & OD-12 Implementation:
 *
 * Core Principles Enforced:
 * 1. Simple arithmetic mean of eligible, genuinely graded assessments (OD-01).
 * 2. Minimum 3 eligible unique graded assessments (OD-02).
 * 3. Assessment Retake Policy (OD-11 APPROVED: LATEST ATTEMPT):
 *    - The chronologically latest eligible graded attempt per assessment contributes to academic calculation.
 *    - Deterministic tie-breaking:
 *      1. Timestamp descending (submittedAt, with fallback to createdAt).
 *      2. Stable identifier descending (id).
 *    - Ungraded, in-progress, abandoned, unverifiable, or cheating attempts never replace a valid graded attempt.
 *    - All attempts preserved in DB.
 * 4. Academic Evaluation Period (OD-12 APPROVED: ROLLING TIME WINDOW):
 *    - Duration is NOT YET APPROVED (never silently defaults to 30, 60, or 90 days).
 *    - Supports configurable rolling window (`rollingDays?: number`).
 *    - When `rollingDays` is configured (> 0): filters attempts within window, sets `periodStatus: 'SPECIFIED'`, `assessmentPeriod: "LAST_${rollingDays}_DAYS"`.
 *    - When duration is required/missing (`requireRollingPeriod: true` or `rollingDays === null`), returns explicit `PERIOD_CONFIGURATION_REQUIRED` and `periodStatus: 'CONFIGURATION_REQUIRED'`.
 *    - Lifetime data is never labeled rolling (`periodStatus: 'UNSPECIFIED'`, `assessmentPeriod: null`).
 * 5. Unverifiable Evidence Disclosure:
 *    - Explicitly tracks and discloses `unverifiableAttemptsCount` and `hasUnverifiableAttempts`.
 *    - Unverifiable attempts (missing identity, missing maximum marks, unverifiable completion) are never included in the average and never counted toward the threshold of 3.
 * 6. Preserves classification: null (no unapproved risk categorization).
 */
export function calculateAcademicAssessment(
  rawAttempts: any[],
  options?: CalculationOptions
): AcademicAssessmentResult {
  const minimumRequired = options?.minimumRequired ?? 3;
  const now = new Date();
  const nowIso = now.toISOString();

  // OD-12 Rolling Time Window Evaluation
  const hasRollingConfig = typeof options?.rollingDays === 'number' && options.rollingDays > 0;
  const isPeriodConfigRequired = options?.requireRollingPeriod === true || options?.rollingDays === null;

  let periodStatus: PeriodStatus = 'UNSPECIFIED';
  let assessmentPeriod: string | null = null;
  let rollingCutoffTime: number | null = null;

  if (isPeriodConfigRequired) {
    periodStatus = 'CONFIGURATION_REQUIRED';
    return {
      status: 'PERIOD_CONFIGURATION_REQUIRED',
      average: null,
      eligibleAssessmentCount: 0,
      minimumRequired,
      assessmentPeriod: null,
      periodStatus: 'CONFIGURATION_REQUIRED',
      rollingDays: null,
      retakeConflict: false,
      unverifiableAttemptsCount: 0,
      hasUnverifiableAttempts: false,
      dataIntegrityNotice: null,
      dataIntegrityNoticeAr: null,
      assessedAt: nowIso,
      explanation: 'Rolling time window duration is not configured or approved (OD-12). Configuration is required.',
      explanationAr: 'تتطلب سياسة النافذة الزمنية المتجددة تحديد مدة النافذة واعتمادها (OD-12).',
      classification: null,
      eligibleAssessments: []
    };
  } else if (hasRollingConfig) {
    periodStatus = 'SPECIFIED';
    assessmentPeriod = `LAST_${options!.rollingDays}_DAYS`;
    rollingCutoffTime = now.getTime() - (options!.rollingDays! * 24 * 60 * 60 * 1000);
  } else {
    // Unspecified period / lifetime data
    periodStatus = 'UNSPECIFIED';
    assessmentPeriod = null;
  }

  if (!Array.isArray(rawAttempts) || rawAttempts.length === 0) {
    return {
      status: 'INSUFFICIENT_DATA',
      average: null,
      eligibleAssessmentCount: 0,
      minimumRequired,
      assessmentPeriod,
      periodStatus,
      rollingDays: hasRollingConfig ? options!.rollingDays : null,
      retakeConflict: false,
      unverifiableAttemptsCount: 0,
      hasUnverifiableAttempts: false,
      dataIntegrityNotice: null,
      dataIntegrityNoticeAr: null,
      assessedAt: nowIso,
      explanation: 'No eligible graded assessments found. Minimum 3 required.',
      explanationAr: 'لا تتوفر تقييمات كافية حتى الآن. يلزم وجود 3 تقييمات مصححة على الأقل لعرض التقييم الأكاديمي.',
      classification: null,
      eligibleAssessments: []
    };
  }

  const startTimestamp = options?.startDate ? new Date(options.startDate).getTime() : null;
  const endTimestamp = options?.endDate ? new Date(options.endDate).getTime() : null;

  let unverifiableAttemptsCount = 0;

  // Track completed, genuinely graded attempts by assessment identity
  // Map: cleanAssessmentId -> array of valid graded attempts
  const gradedAttemptsByAssessment = new Map<string, any[]>();

  for (const att of rawAttempts) {
    if (!att) continue;

    // 1. Assessment Identity Verification
    const assessmentId = att.assessmentId || att.examId;
    if (!assessmentId) {
      unverifiableAttemptsCount++;
      continue;
    }

    const cleanAssessmentId = String(assessmentId);

    // 2. ExamAttempt vs AssessmentAttempt Verification
    const isExamAttempt = att.examId !== undefined && att.assessmentId === undefined;

    if (isExamAttempt) {
      const upperStatus = att.status ? String(att.status).toUpperCase() : '';

      // If status is present, verify it is not in-progress, pending, or cheating
      if (['STARTED', 'IN_PROGRESS', 'PENDING', 'CANCELLED', 'CHEATING'].includes(upperStatus)) {
        continue;
      }

      if (att.isGraded === false) {
        continue;
      }

      if (upperStatus === 'TIME_EXPIRED' && !att.isGraded) {
        continue;
      }

      if (att.cheatingDetected === true) {
        continue;
      }

      // Legacy fallback: an exam attempt with explicit null answers is unsubmitted/abandoned
      if (att.answers === null) {
        continue;
      }

      const totalPoints = att.totalPoints ?? att.exam?.totalPoints;

      if (typeof totalPoints !== 'number' || !isFinite(totalPoints) || totalPoints <= 0) {
        unverifiableAttemptsCount++;
        continue;
      }

      if (att.completionVerifiable === false) {
        unverifiableAttemptsCount++;
        continue;
      }

      const rawScore = att.score;
      if (rawScore === null || rawScore === undefined) {
        unverifiableAttemptsCount++;
        continue;
      }

      const numScore = Number(rawScore);
      if (!isFinite(numScore) || isNaN(numScore) || numScore < 0 || numScore > totalPoints) {
        unverifiableAttemptsCount++;
        continue;
      }

      let percentage: number;
      if (att.percentage !== undefined && att.percentage !== null && !isNaN(Number(att.percentage))) {
        percentage = Number(att.percentage);
      } else {
        percentage = (numScore / totalPoints) * 100;
      }

      if (!isFinite(percentage) || percentage < 0 || percentage > 100) {
        unverifiableAttemptsCount++;
        continue;
      }

      const attemptDate = att.submittedAt ? new Date(att.submittedAt) : (att.createdAt ? new Date(att.createdAt) : new Date());
      const attemptTime = attemptDate.getTime();

      // OD-12 Rolling Window filtering
      if (rollingCutoffTime !== null && attemptTime < rollingCutoffTime) {
        continue;
      }

      // Explicit date range filtering
      if (startTimestamp !== null && attemptTime < startTimestamp) continue;
      if (endTimestamp !== null && attemptTime > endTimestamp) continue;

      const record = {
        id: String(att.id || cleanAssessmentId),
        assessmentId: cleanAssessmentId,
        title: att.exam?.title || att.title || 'اختبار دراسي',
        score: numScore,
        totalPoints,
        percentage: Math.round(percentage * 10) / 10,
        createdAt: att.createdAt ? new Date(att.createdAt) : attemptDate,
        submittedAt: att.submittedAt ? String(att.submittedAt) : undefined,
        date: attemptDate.toISOString().split('T')[0],
        status: 'GRADED'
      };

      const existing = gradedAttemptsByAssessment.get(cleanAssessmentId) || [];
      existing.push(record);
      gradedAttemptsByAssessment.set(cleanAssessmentId, existing);
    } else {
      // AssessmentAttempt verification
      const upperStatus = att.status ? String(att.status).toUpperCase() : '';

      if (['STARTED', 'IN_PROGRESS', 'PENDING', 'PENDING_GRADING', 'CANCELLED', 'CHEATING'].includes(upperStatus)) {
        continue;
      }

      if (att.cheatingDetected === true) {
        continue;
      }

      if (upperStatus === 'TIME_EXPIRED') {
        const hasValidScore = att.score !== null && att.score !== undefined && isFinite(Number(att.score)) && Number(att.score) >= 0;
        const hasValidTotal = att.totalPoints !== null && att.totalPoints !== undefined && isFinite(Number(att.totalPoints)) && Number(att.totalPoints) > 0;
        const hasValidPct = att.percentage !== null && att.percentage !== undefined && isFinite(Number(att.percentage)) && Number(att.percentage) >= 0 && Number(att.percentage) <= 100;

        if (!hasValidScore || !hasValidTotal || !hasValidPct) {
          continue;
        }
      } else if (upperStatus !== 'GRADED') {
        continue;
      }

      const rawScore = att.score;
      const rawTotalPoints = att.totalPoints ?? att.assessment?.totalPoints;
      const rawPct = att.percentage;

      if (rawScore === null || rawScore === undefined || rawTotalPoints === null || rawTotalPoints === undefined) {
        unverifiableAttemptsCount++;
        continue;
      }

      const numScore = Number(rawScore);
      const totalPoints = Number(rawTotalPoints);
      if (!isFinite(numScore) || numScore < 0 || !isFinite(totalPoints) || totalPoints <= 0) {
        unverifiableAttemptsCount++;
        continue;
      }

      let percentage: number;
      if (rawPct !== null && rawPct !== undefined && isFinite(Number(rawPct))) {
        percentage = Number(rawPct);
        const expectedPct = (numScore / totalPoints) * 100;
        if (Math.abs(percentage - expectedPct) > 0.5) {
          unverifiableAttemptsCount++;
          continue;
        }
      } else {
        percentage = (numScore / totalPoints) * 100;
      }

      if (!isFinite(percentage) || percentage < 0 || percentage > 100) {
        unverifiableAttemptsCount++;
        continue;
      }

      const attemptDate = att.submittedAt ? new Date(att.submittedAt) : (att.createdAt ? new Date(att.createdAt) : new Date());
      const attemptTime = attemptDate.getTime();

      // OD-12 Rolling Window filtering
      if (rollingCutoffTime !== null && attemptTime < rollingCutoffTime) {
        continue;
      }

      if (startTimestamp !== null && attemptTime < startTimestamp) continue;
      if (endTimestamp !== null && attemptTime > endTimestamp) continue;

      const record = {
        id: String(att.id || cleanAssessmentId),
        assessmentId: cleanAssessmentId,
        title: att.assessment?.title || att.title || 'تقييم دراسي',
        score: numScore,
        totalPoints,
        percentage: Math.round(percentage * 10) / 10,
        createdAt: att.createdAt ? new Date(att.createdAt) : attemptDate,
        submittedAt: att.submittedAt ? String(att.submittedAt) : undefined,
        date: attemptDate.toISOString().split('T')[0],
        status: 'GRADED'
      };

      const existing = gradedAttemptsByAssessment.get(cleanAssessmentId) || [];
      existing.push(record);
      gradedAttemptsByAssessment.set(cleanAssessmentId, existing);
    }
  }

  const hasUnverifiableAttempts = unverifiableAttemptsCount > 0;
  const dataIntegrityNotice = hasUnverifiableAttempts
    ? 'Previous assessment attempts exist whose completion status or maximum marks cannot be verified; these are excluded from the academic average.'
    : null;
  const dataIntegrityNoticeAr = hasUnverifiableAttempts
    ? 'توجد محاولات سابقة تعذر التحقق من اكتمالها أو درجاتها، لذلك لا تدخل في حساب المتوسط الأكاديمي.'
    : null;

  // Case: No valid assessments exist at all
  if (gradedAttemptsByAssessment.size === 0) {
    if (hasUnverifiableAttempts) {
      return {
        status: 'BLOCKED_UNVERIFIABLE_COMPLETION',
        average: null,
        eligibleAssessmentCount: 0,
        minimumRequired,
        assessmentPeriod,
        periodStatus,
        rollingDays: hasRollingConfig ? options!.rollingDays : null,
        retakeConflict: false,
        unverifiableAttemptsCount,
        hasUnverifiableAttempts,
        dataIntegrityNotice,
        dataIntegrityNoticeAr,
        assessedAt: nowIso,
        explanation: 'Assessment completion status or maximum marks cannot be verified from legacy records in the current schema.',
        explanationAr: 'لا يمكن التحقق من اكتمال التقييم أو الدرجة العظمى من واقع سجلات الاختبارات في قاعدة البيانات.',
        classification: null,
        eligibleAssessments: []
      };
    }

    return {
      status: 'INSUFFICIENT_DATA',
      average: null,
      eligibleAssessmentCount: 0,
      minimumRequired,
      assessmentPeriod,
      periodStatus,
      rollingDays: hasRollingConfig ? options!.rollingDays : null,
      retakeConflict: false,
      unverifiableAttemptsCount: 0,
      hasUnverifiableAttempts: false,
      dataIntegrityNotice: null,
      dataIntegrityNoticeAr: null,
      assessedAt: nowIso,
      explanation: 'No eligible graded assessments found. Minimum 3 required.',
      explanationAr: 'لا تتوفر تقييمات كافية حتى الآن. يلزم وجود 3 تقييمات مصححة على الأقل لعرض التقييم الأكاديمي.',
      classification: null,
      eligibleAssessments: []
    };
  }

  // 3. OD-11 Assessment Retake Policy: APPROVED: LATEST ATTEMPT
  // For each assessment, sort eligible graded attempts:
  // Timestamp descending (submittedAt || createdAt), then stable ID descending
  const eligibleAssessments: EligibleAssessmentSummary[] = [];

  for (const [, attempts] of gradedAttemptsByAssessment.entries()) {
    if (attempts.length === 0) continue;

    attempts.sort((a, b) => {
      const timeA = (a.submittedAt || a.createdAt ? new Date(a.submittedAt || a.createdAt).getTime() : 0);
      const timeB = (b.submittedAt || b.createdAt ? new Date(b.submittedAt || b.createdAt).getTime() : 0);
      if (timeB !== timeA) {
        return timeB - timeA; // Descending: latest first
      }
      return String(b.id).localeCompare(String(a.id)); // Deterministic ID tie-breaker descending
    });

    // The chronologically latest eligible graded attempt is selected (OD-11)
    eligibleAssessments.push(attempts[0]);
  }

  // Sort eligible assessments by date ascending for clean chronology
  eligibleAssessments.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  const eligibleCount = eligibleAssessments.length;

  // 4. OD-02 Minimum Evidence Requirement (>= 3 unique graded assessments)
  if (eligibleCount < minimumRequired) {
    return {
      status: 'INSUFFICIENT_DATA',
      average: null,
      eligibleAssessmentCount: eligibleCount,
      minimumRequired,
      assessmentPeriod,
      periodStatus,
      rollingDays: hasRollingConfig ? options!.rollingDays : null,
      retakeConflict: false,
      unverifiableAttemptsCount,
      hasUnverifiableAttempts,
      dataIntegrityNotice,
      dataIntegrityNoticeAr,
      assessedAt: nowIso,
      explanation: `Insufficient assessment evidence (${eligibleCount}/${minimumRequired} required graded assessments).`,
      explanationAr: `لا تتوفر تقييمات كافية حتى الآن. تم رصد ${eligibleCount} من أصل ${minimumRequired} تقييمات مصححة مطلوبة لعرض التقييم الأكاديمي.`,
      classification: null,
      eligibleAssessments
    };
  }

  // 5. OD-01 Simple Arithmetic Mean Calculation
  const totalPercentage = eligibleAssessments.reduce((sum, item) => sum + item.percentage, 0);
  const rawAverage = totalPercentage / eligibleCount;
  const arithmeticAverage = Math.round(rawAverage * 10) / 10;

  const periodLabel = hasRollingConfig
    ? `نافذة متجددة: ${options!.rollingDays} يوم`
    : 'فترة غير محددة';
  const explanation = hasRollingConfig
    ? `Academic average calculated using simple arithmetic mean of ${eligibleCount} eligible graded assessments across a rolling window of ${options!.rollingDays} days.`
    : `Academic average calculated using simple arithmetic mean of ${eligibleCount} eligible graded assessments across available history (period unspecified).`;
  const explanationAr = `تم احتساب المعدل الأكاديمي بناءً على المتوسط الحسابي لـ ${eligibleCount} تقييمات مصححة بنسبة ${arithmeticAverage}% (${periodLabel}).`;

  return {
    status: 'AVAILABLE',
    average: arithmeticAverage,
    eligibleAssessmentCount: eligibleCount,
    minimumRequired,
    assessmentPeriod,
    periodStatus,
    rollingDays: hasRollingConfig ? options!.rollingDays : null,
    retakeConflict: false,
    unverifiableAttemptsCount,
    hasUnverifiableAttempts,
    dataIntegrityNotice,
    dataIntegrityNoticeAr,
    assessedAt: nowIso,
    explanation,
    explanationAr,
    classification: null, // Strictly null: no unapproved risk threshold
    eligibleAssessments
  };
}
