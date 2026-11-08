# OX-DIGITAL Education
# Phase 6.2B.2 — Remaining Blockers & Policy Dependencies Report
## Architectural, Policy & Schema Prerequisites for Subsequent Phases

**Date:** November 1, 2026  
**Workspace:** `D:\OX-DIGITAL\Mathe\OX-DIGITAL-GITHUB`  
**Git Baseline:** `main @ 0500b93e65c24ed881349c4acea7f523332c5e9f` (`0500b93`)  
**Status:** REMAINING BLOCKERS DOCUMENTED  
**Scope:** Transparent disclosure of unresolved governance decisions and database schema limitations preventing full automation without human intervention.

---

## 1. Executive Summary

Phase 6.2B.2 succeeded in neutralizing unapproved retake and period assumptions by returning honest, uncompromised statuses (`BLOCKED_PENDING_POLICY`, `BLOCKED_UNVERIFIABLE_COMPLETION`, `periodStatus: "UNSPECIFIED"`).

However, until the Product Owner and academic leadership formally resolve several open policy questions and authorize necessary database schema migrations, certain student cohorts will remain in a blocked or unspecified state.

This report summarizes these remaining blockers and outlines the decisions required to resolve them.

---

## 2. Unresolved Policy Decisions

### 2.1 Proposed Decision OD-11: Assessment Retake Policy
- **Status:** **UNRESOLVED / PENDING PRODUCT OWNER APPROVAL**
- **Current Behavior in Code:** When a student has $>1$ completed, graded attempts on an assessment, the academic assessment returns `status: "BLOCKED_PENDING_POLICY"`, `average: null`, and `retakeConflict: true`.
- **Why It Is Blocked:** The Product Owner has explicitly not approved a retake policy for academic monitoring. In Phase 6.1B, "latest completed attempt" was approved strictly for grade-level ranking, not for academic risk assessment.
- **Required Action:** The Product Owner must formally select one of the following options:
  - **Option A (Latest Attempt):** Strictly evaluate the latest completed, graded attempt.
  - **Option B (Highest Attempt):** Evaluate the highest score achieved on that assessment.
  - **Option C (Arithmetic Mean of Attempts):** Average all attempts on that assessment.
  - **Option D (First Attempt Only):** Evaluate only the first attempt; retakes are diagnostic only.

---

### 2.2 Proposed Decision OD-12: Academic Assessment Evaluation Period
- **Status:** **UNRESOLVED / PENDING PRODUCT OWNER APPROVAL**
- **Current Behavior in Code:** When no period boundary is supplied, the system sets `periodStatus: "UNSPECIFIED"` and does not present the result as an authoritative term assessment.
- **Why It Is Blocked:** Aggregating assessments across multiple terms or school years distorts active academic risk. The Product Owner has not approved a period boundary policy.
- **Required Action:** The Product Owner must approve:
  - **Option A (Explicit Academic Term):** Gated by an `AcademicTerm` calendar entity.
  - **Option B (Rolling Window):** Gated by a rolling sliding window (e.g. past 90 days).
  - **Option C (Course Term Boundary):** Gated by course term boundaries.

---

### 2.3 Pending Decisions OD-03 through OD-10
All remaining canonical decisions from Phase 6.2A remain pending approval and were strictly preserved without implementation:
- **OD-03:** Attendance Lateness Treatment (Operations Lead)
- **OD-04:** Late Homework Submission Treatment (Academic Director)
- **OD-05:** Video Engagement Grace Period (Product Owner)
- **OD-06:** Historical Lesson Publication Timestamp Backfill (Lead Architect)
- **OD-07:** Parent Notification Cooldown (Product Owner)
- **OD-08:** Online-Only Student Activity Assessment (Product Owner)
- **OD-09:** External Parent Notification Channels (Product Owner & Operations)
- **OD-10:** Seven-Day Trend Threshold (Academic Director)

---

## 3. Database Schema Limitations

### 3.1 `ExamAttempt` Lacks Completion, Grading, and Maximum Marks Metadata
- **Current State in Prisma Schema (`packages/database/prisma/schema.prisma` lines 247–277):**
  - `model Exam`: Has `title`, `duration`, `passingScore`, but **NO `totalPoints`** or maximum score column.
  - `model ExamAttempt`: Has only `id`, `examId`, `studentId`, `score: Float`, `answers: Json?`, `createdAt`.
  - There is **NO `status` column**, **NO `isGraded` boolean**, **NO `percentage` column**, **NO `totalPoints` column**, and **NO `submittedAt` timestamp**.
- **Impact:**
  - Starting an exam creates a row with `score: 0`.
  - Auto-saving answers updates `answers` during an in-progress exam.
  - There is no reliable mechanism to distinguish an in-progress/abandoned exam from a submitted exam with 0 score, nor to normalize raw scores when total points are not 100.
  - Consequently, legacy `ExamAttempt` records are appropriately gated as `BLOCKED_UNVERIFIABLE_COMPLETION`.
- **Recommended Schema Remediation (Future Phase):**
  In a future authorized migration phase, add to `ExamAttempt`:
  ```prisma
  status       AttemptStatus @default(IN_PROGRESS)
  submittedAt  DateTime?
  totalPoints  Float?
  percentage   Float?
  isGraded     Boolean       @default(false)
  ```

---

### 3.2 Absence of Dedicated `AcademicTerm` Entity
- **Current State:** The database contains no model representing academic semesters, trimesters, or terms with calendar start and end dates.
- **Impact:** Services cannot automatically infer the current active academic period from a student's enrollment without caller-supplied date filters.
- **Recommended Schema Remediation (Future Phase):**
  Introduce a formal `AcademicTerm` table:
  ```prisma
  model AcademicTerm {
    id        String   @id @default(uuid())
    name      String   // e.g. "Term 1 2026/2027"
    startDate DateTime
    endDate   DateTime
    isActive  Boolean  @default(false)
  }
  ```

---

## 4. Confirmation of Stop Conditions & Safety Bounds

In strict adherence to Phase 6.2B.2 instructions:
- No database migrations or seeds were executed.
- No Prisma schema files were modified.
- No Docker containers or environment files were touched.
- No Git commits or pushes were performed.
- All code changes remained strictly within authorized source files in `D:\OX-DIGITAL\Mathe\OX-DIGITAL-GITHUB`.

