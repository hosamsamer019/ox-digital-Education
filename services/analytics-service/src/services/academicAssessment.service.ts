import { db } from '../../../../packages/database/src/index.js';
import {
  AcademicAssessmentResult,
  CalculationOptions,
  calculateAcademicAssessment
} from './academicAssessment.calculator.js';

export * from './academicAssessment.calculator.js';

/**
 * Fetches and evaluates academic assessment for a specific student from the database.
 */
export async function getStudentAcademicAssessment(
  studentId: string,
  options?: CalculationOptions
): Promise<AcademicAssessmentResult> {
  if (!studentId) {
    return calculateAcademicAssessment([], options);
  }

  // 1. Fetch ExamAttempts (include exam relation for questions and title)
  const examAttempts = await db.examAttempt.findMany({
    where: { studentId },
    include: { exam: true },
    orderBy: { createdAt: 'desc' }
  });

  // 2. Fetch AssessmentAttempts (include assessment relation for totalPoints and title)
  const assessmentAttempts = await db.assessmentAttempt.findMany({
    where: { studentId },
    include: { assessment: true },
    orderBy: { createdAt: 'desc' }
  });

  const combinedAttempts = [...examAttempts, ...assessmentAttempts];

  return calculateAcademicAssessment(combinedAttempts, options);
}
