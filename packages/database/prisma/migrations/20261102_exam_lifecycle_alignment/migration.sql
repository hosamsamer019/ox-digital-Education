-- Migration: 20261102_exam_lifecycle_alignment
-- Purpose: Add lifecycle, grading, and points tracking fields to legacy Exam and ExamAttempt tables.

-- AlterTable Exam
ALTER TABLE "Exam" ADD COLUMN IF NOT EXISTS "totalPoints" DOUBLE PRECISION;

-- AlterTable ExamAttempt
ALTER TABLE "ExamAttempt" ADD COLUMN IF NOT EXISTS "status" "AttemptStatus" NOT NULL DEFAULT 'STARTED';
ALTER TABLE "ExamAttempt" ADD COLUMN IF NOT EXISTS "submittedAt" TIMESTAMP(3);
ALTER TABLE "ExamAttempt" ADD COLUMN IF NOT EXISTS "isGraded" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "ExamAttempt" ADD COLUMN IF NOT EXISTS "totalPoints" DOUBLE PRECISION;
ALTER TABLE "ExamAttempt" ADD COLUMN IF NOT EXISTS "percentage" DOUBLE PRECISION;
ALTER TABLE "ExamAttempt" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

