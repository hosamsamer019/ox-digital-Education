# OX-DIGITAL Education
# Phase 6.2B.1 — Academic Assessment Remediation Plan
## Targeted Engineering Plan for Compliance & Data Integrity Remediation

**Date:** November 1, 2026  
**Status:** READY FOR AUTHORIZATION  
**Authorized Workspace:** `D:\OX-DIGITAL\Mathe\OX-DIGITAL-GITHUB`  
**Git Baseline:** `main @ 0500b93e65c24ed881349c4acea7f523332c5e9f` (`0500b93`)  
**Scope:** Minimal, surgical, non-breaking remediation plan resolving all findings from `PHASE_6_2B_1_COMPLIANCE_AUDIT.md`.

---

## 1. Overview of Targeted Corrections

This remediation plan defines the exact code modifications required to bring the academic assessment implementation into full compliance with Product Owner decisions OD-01, OD-02, and data integrity standards.

### Core Remediation Objectives:
1. **Retake Policy Neutralization:** Cease unilateral selection of latest/highest attempt. When a student has multiple attempts on an assessment, flag as `BLOCKED_PENDING_POLICY` (or exclude ambiguous retakes from the minimum count) and require an explicit Product Owner decision.
2. **Academic Period Gating:** Stop silent lifetime assessment aggregation. Explicitly expose `assessmentPeriod` as a required parameter or report `periodStatus: 'UNSPECIFIED'` with honest messaging when no period boundary is supplied.
3. **`ExamAttempt` Completion & Grading Verification:** Filter out unsubmitted or abandoned `ExamAttempt` records (`answers === null` or empty) so that starting an exam does not create a false 0% failure.
4. **Assessment Attempt Exclusion Fix:** Explicitly exclude `TIME_EXPIRED` attempts that lack final grades.
5. **Decision Register Alignment:** Cleanse all reports and documentation to restore canonical Phase 6.2A OD-01 through OD-10 numbering.
6. **Test Suite Alignment:** Replace synthetic mock objects with schema-accurate shapes and test the blocked-retake policy.

---

## 2. File-by-File Remediation Specifications

### File 1: `services/analytics-service/src/services/academicAssessment.calculator.ts`

#### Proposed Changes:
1. **Extend `AcademicStatus` Type:**
   ```typescript
   export type AcademicStatus = 'AVAILABLE' | 'INSUFFICIENT_DATA' | 'BLOCKED_PENDING_POLICY';
   ```
2. **Add Retake Conflict Detection:**
   Instead of silently running `latestAttemptsByAssessment.set(attempt.assessmentId, attempt)`:
   - Identify whether any assessment has $> 1$ completed graded attempt.
   - If multiple attempts exist and no approved policy parameter (`retakePolicy`) is supplied:
     - Mark `retakeConflict: true`.
     - Set `status: 'BLOCKED_PENDING_POLICY'`.
     - Set `average: null`.
     - Explanation: `"Multiple attempts detected on assessment(s). Academic assessment is blocked pending Product Owner retake policy approval."`
     - ExplanationAr: `"تم رصد محاولات متعددة لنفس الاختبار. التقييم الأكاديمي معلق لحين اعتماد سياسة إعادة الاختبارات من قبل إدارة النظام."`
3. **`ExamAttempt` Completion Filtering:**
   - For attempts lacking a `status` property (i.e. `ExamAttempt`), verify completion:
     ```typescript
     if (att.status === undefined || att.status === null) {
       // Must have recorded answers to prove completion (unsubmitted attempts have answers === null)
       if (att.answers === null || att.answers === undefined) {
         continue; // Exclude in-progress / abandoned attempts
       }
     }
     ```
4. **Exclude `TIME_EXPIRED` without Score:**
   - Add `'TIME_EXPIRED'` to the status exclusion list unless explicitly graded.
5. **Academic Period Validation:**
   - If `!options?.assessmentPeriod && !options?.startDate && !options?.endDate`:
     - Expose `assessmentPeriod: 'LIFETIME_AGGREGATE_UNVERIFIED'` or flag `periodPending: true` so consumers know period boundaries are not enforced.

---

## 2. File-by-File Remediation Specifications (Continued)

### File 2: `services/analytics-service/src/services/academicAssessment.service.ts`

#### Proposed Changes:
1. **Filter Unsubmitted `ExamAttempt` at Database Level:**
   ```typescript
   const examAttempts = await db.examAttempt.findMany({
     where: { 
       studentId,
       answers: { not: null } // Only fetch completed submissions
     },
     include: { exam: true },
     orderBy: { createdAt: 'desc' }
   });
   ```
2. **Support Period Query Filtering:**
   Pass `options.startDate` and `options.endDate` into Prisma `createdAt` filters:
   ```typescript
   const dateFilter: any = {};
   if (options?.startDate) dateFilter.gte = new Date(options.startDate);
   if (options?.endDate) dateFilter.lte = new Date(options.endDate);

   const whereClause: any = { studentId };
   if (options?.startDate || options?.endDate) {
     whereClause.createdAt = dateFilter;
   }
   ```

---

### File 3: `services/analytics-service/src/controllers/analytics.controller.ts`

#### Proposed Changes:
1. **Extract Period Query Parameters:**
   In both `getStudentOverview` (line 364) and `getAcademicAssessmentController` (line 702):
   ```typescript
   const { startDate, endDate, term } = req.query as { startDate?: string; endDate?: string; term?: string };
   const academic = await getStudentAcademicAssessment(studentId, {
     startDate: startDate || null,
     endDate: endDate || null,
     assessmentPeriod: term || null
   });
   ```

---

### File 4: `apps/frontend/src/app/components/student-center/ResultsPage.tsx` & `student-online/ResultsPage.tsx`

#### Proposed Changes:
1. **Support `BLOCKED_PENDING_POLICY` UI State:**
   - Add status badge condition:
     ```tsx
     {overview.academic?.status === 'AVAILABLE'
       ? 'متاح ومؤكد'
       : overview.academic?.status === 'BLOCKED_PENDING_POLICY'
       ? 'معلق (سياسة الإعادة)'
       : 'بيانات غير كافية'}
     ```
   - In description paragraph, render honest explanation:
     ```tsx
     {overview.academic?.status === 'BLOCKED_PENDING_POLICY' ? (
       <span className="text-amber-600 font-medium">
         {overview.academic.explanationAr || 'التقييم معلق لحين اعتماد سياسة احتساب محاولات الإعادة.'}
       </span>
     ) : ...}
     ```

---

### File 5: `apps/frontend/src/app/test/AcademicAssessment.test.tsx`

#### Proposed Changes:
1. **Update Test 10 to Test Real DB Behavior:**
   - Remove synthetic `{ status: 'IN_PROGRESS' }`.
   - Test that an attempt with `{ score: 0, answers: null }` (real in-progress DB attempt) is correctly excluded from the eligible assessment count.
2. **Update Test 15 to Validate Blocked Retake Policy:**
   - Assert that an assessment with multiple attempts without an approved policy returns `status: 'BLOCKED_PENDING_POLICY'`, `average: null`, and `retakeConflict: true`.
3. **Add Tests for Unknown Academic Period:**
   - Assert that lifetime queries indicate unverified period status.

---

## 3. Implementation Verification Steps

Following authorization, remediation will be verified via:

1. **Static Analysis & Typecheck:** `npm run build` in `services/analytics-service` (`tsc` clean exit).
2. **Vite Frontend Build:** `npm run build` in `apps/frontend` (0 bundling errors).
3. **Remediation Unit Test Run:** `npm test -- AcademicAssessment.test.tsx` (All tests passing).
4. **Full Frontend Regression:** All 23 test suites passing.
5. **Git Safety Check:** Clean `git status --short` preserving baseline without commits or pushes.

---

## 4. Authorization Requirement

This remediation plan is fully specified and awaiting Product Owner authorization before execution. **No code or database changes will be executed during Phase 6.2B.1.**

