# OX-DIGITAL Education
# Phase 6.2B — Schema and Data Blockers Report
## Constraints and Dependencies for Subsequent Phases

**Date:** November 1, 2026  
**Workspace:** `D:\OX-DIGITAL\Mathe\OX-DIGITAL-GITHUB`  
**Git Baseline:** `main @ 0500b93e65c24ed881349c4acea7f523332c5e9f` (`0500b93`)  
**Scope:** Identification of current database schema limitations, data model constraints, and prerequisites for subsequent risk engine decisions (OD-03 to OD-10).

---

## 1. Executive Summary

During the Phase 6.2B implementation of OD-01 (Simple Arithmetic Average) and OD-02 (Minimum 3 Graded Assessments), the calculation and eligibility engine was implemented cleanly without requiring database writes or schema migrations.

However, several architectural constraints within the existing Prisma schema were identified that affect how academic assessment periods and retakes are represented. These findings are documented below to guide the Product Owner and development team when reviewing open decisions OD-03 through OD-10.

---

## 2. Identified Schema and Data Constraints

### 2.1 Absence of Dedicated Academic Term / Period Model (Impacts OD-10)
- **Current State:** The PostgreSQL / Prisma schema contains models for `User`, `Course`, `Lesson`, `Exam`, `ExamAttempt`, `Assessment`, and `AssessmentAttempt`. However, there is no `AcademicTerm`, `Semester`, or `AssessmentPeriod` model defining institutional calendar boundaries (e.g., "Term 1 2026-2027", Start: 2026-09-01, End: 2026-12-31).
- **Current Phase 6.2B Workaround:** The calculation engine supports optional `startDate` and `endDate` query parameters and defaults to `assessmentPeriod: null` (evaluating all completed graded attempts across the student's active history).
- **Remediation Requirement for OD-10:** Prior to implementing OD-10, an explicit decision is needed:
  1. Add an `AcademicTerm` entity to the Prisma schema via a controlled migration; or
  2. Define rolling evaluation windows (e.g., past 30 days, past 90 days); or
  3. Associate assessments with course-level terms (`Course.term` string attribute).

---

### 2.2 Discrepancy Between `ExamAttempt` and `AssessmentAttempt` Models
- **Current State:** The database maintains two distinct models for student assessments:
  1. `ExamAttempt`: Legacy model associated with `Exam`. Fields: `id`, `examId`, `studentId`, `score` (Float?), `answers` (Json), `createdAt`, `updatedAt`. Does not have a formal `isGraded` boolean or `percentage` field.
  2. `AssessmentAttempt`: Newer modular assessment model. Fields: `id`, `assessmentId`, `studentId`, `attemptNumber` (Int), `status` (AssessmentStatus: `IN_PROGRESS`, `SUBMITTED`, `GRADED`), `score` (Float?), `percentage` (Float?), `submittedAt`, `gradedAt`.
- **Current Phase 6.2B Workaround:** The service layer queries both tables and normalizes records into a single `RawAssessmentAttempt` contract, ensuring consistent scoring and timestamps.
- **Future Recommendation:** Consolidate exam and assessment attempts into a unified assessment submission architecture in a future major database refactor.

---

### 2.3 Retake Identification and Deduplication Strategy
- **Current State:** `ExamAttempt` lacks an `attemptNumber` column. Retakes can only be identified by matching `studentId` and `examId`, then sorting by `createdAt` descending.
- **Current Phase 6.2B Workaround:** The calculator engine implements `deduplicateLatestAttempts()`, which groups attempts by unique assessment ID and deterministically retains only the latest graded attempt.
- **Future Recommendation:** Add an explicit `attemptNumber` and `isLatestAttempt` index to `ExamAttempt` if multi-attempt history querying becomes performance-critical at high student volumes.

---

## 3. Summary of Blockers for Pending Decisions

| Decision | Area | Blocker / Dependency Description | Recommended Action |
|---|---|---|---|
| **OD-03** | Attendance Dimension | Physical attendance is recorded in `AttendanceRecord`. Need PO approval on center vs. online exclusion. | Await formal approval of OD-03. |
| **OD-04** | Digital Activity Dimension | Video watch time stored in `VideoProgress`. Needs activity threshold definitions. | Await formal approval of OD-04. |
| **OD-05** | Homework Dimension | Homework submissions stored in `HomeworkSubmission`. Minimum submission threshold needed. | Await formal approval of OD-05. |
| **OD-08** | Risk Classification Bands | Academic dimension currently leaves `classification: null`. Approval of percentage cutoffs required. | Await formal approval of OD-08. |
| **OD-10** | Academic Period Definition | Lack of `AcademicTerm` database table. | Decide between date-range sliding window vs. schema migration for `AcademicTerm`. |

---

## 4. Conclusion

None of these constraints block Phase 6.2B, which is 100% complete and verified. They represent documented prerequisites for subsequent phases when the Product Owner authorizes work on OD-03 through OD-10.

