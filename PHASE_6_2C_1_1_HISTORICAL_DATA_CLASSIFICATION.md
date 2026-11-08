# OX-DIGITAL Education — Phase 6.2C.1.1
# Historical Data Evidence & Backfill Classification Matrix

**Date:** 2026-11-02  
**Project:** OX-DIGITAL Education  
**Authorized Workspace:** `D:\OX-DIGITAL\Mathe\OX-DIGITAL-GITHUB`  
**Git Baseline Verified:** `main @ 0500b93e65c24ed881349c4acea7f523332c5e9f` (`0500b93`)  
**Audit Execution Mode:** Strictly Read-Only Evidence Analysis  

---

## 1. Executive Summary

This forensic classification matrix establishes the exact evidence requirements for historical student records in the OX-DIGITAL PostgreSQL database.

Under strict Product Owner directives, **no database migration may synthesize historical evidence or fabricate academic completion**. When evidence is ambiguous or non-reconstructible, the record must be classified as `UNVERIFIABLE` rather than granted artificial certainty.

---

## 2. Nine-Category Evidence Classification Matrix

| # | Category | Database Evidence | Evidence Source & Code Reference | Evidence Reliability | Safely Backfillable? | Target Status | Can Recover `submittedAt`? | Can Recover `totalPoints` / `percentage`? | Manual Review? |
|---|---|---|---|---|---|---|---|---|---|
| **1** | **Clearly Started, Not Submitted** | `score = 0` AND `answers IS NULL` | `exam.controller.ts:427` (`startAttempt`) | **AUTHORITATIVE** | **YES** | `STARTED` / `ABANDONED` | **NO** (`NULL`) | `totalPoints: 100`, `percentage: NULL` | NO |
| **2** | **Clearly Submitted & Graded** | `score > 0` AND `answers IS NOT NULL` AND `answers::text != '[]'` | `exam.controller.ts:498` (`submitAttempt`) | **AUTHORITATIVE** | **YES** | `GRADED` | **PARTIAL** (Preserve `NULL` or use `updatedAt` with metadata) | `totalPoints: 100`, `percentage = score` | NO |
| **3** | **Submitted but Not Graded** | Legacy `Exam` only supported instant auto-grading; never created. (Possible in unified `AssessmentAttempt` with open-ended essay questions). | `assessment.controller.ts:445` | **AUTHORITATIVE** | **YES** | `SUBMITTED` | **YES** (`submittedAt`) | Cannot score until graded | YES |
| **4** | **Time-Expired & Graded** | `status = 'TIME_EXPIRED'` AND `score IS NOT NULL` AND `totalPoints > 0` (in `AssessmentAttempt`) | `assessment.controller.ts:466` | **AUTHORITATIVE** | **YES** | `TIME_EXPIRED` | **YES** (`submittedAt`) | **YES** (Score & percentage preserved) | NO |
| **5** | **Time-Expired, Not Graded / Stranded** | `ExamAttempt` where `score = 0`, `answers IS NOT NULL`, but `now > createdAt + duration + 5 min` and submission was rejected with HTTP 400. | `exam.controller.ts:488` | **SUGGESTIVE** | **CONDITIONAL** | `TIME_EXPIRED` | **NO** (`NULL`) | Raw answers exist; can auto-grade if questions intact | **YES** |
| **6** | **Cheating / Disqualified** | `ExamAttempt.score = 0` AND count of `ExamViolation` with `attemptId = id` $\ge 2$. | `exam.controller.ts:576` (`reportViolation`) | **AUTHORITATIVE** | **YES** | `CHEATING` | **NO** (`NULL`) | `percentage: 0.0` | NO |
| **7** | **Ambiguous Zero-Score** | `score = 0` AND `answers IS NOT NULL` AND `ExamViolation` count $= 0$. | Ambiguity: Genuine 0% vs aborted attempt after autosave. | **AMBIGUOUS** | **NO** | `UNVERIFIABLE` | **NO** (`NULL`) | Cannot distinguish without answer-key evaluation | **YES** |
| **8** | **Duplicate / Repeated Attempts** | Multiple `ExamAttempt` rows with same `(studentId, examId)`. | Multiple `startAttempt` calls allowed by schema. | **AUTHORITATIVE** | **PRESERVE ALL** | Depends on OD-11 | Respective attempt dates | Respective scores | NO (Preserve rows) |
| **9** | **Missing or Inconsistent Relations** | `ExamAttempt` whose parent `Exam` was deleted (`exam = null`), or question schema corrupted. | Cascading error / orphaned rows. | **AUTHORITATIVE** | **NO** | `UNVERIFIABLE` | **NO** (`NULL`) | **NO** (Cannot reconstruct without exam) | NO |

---

## 3. Forensic Rules for Historical Evidence Preservation

1. **The Non-Invention Rule for Timestamps:**
   - Under no circumstances may `createdAt` be copied into `submittedAt`.
   - `createdAt` represents when the student opened the exam. Copying it to `submittedAt` fabricates evidence that the student completed and submitted the exam instantly at minute 0.
   - If real submission logging is absent, `submittedAt` must remain `NULL`.
2. **The Non-Fabrication Rule for Percentage:**
   - In legacy `ExamAttempt`, `score` was calculated as `(correctCount / questions.length) * 100`.
   - For valid graded records (Category 2), setting `percentage = score` reflects the actual formula executed by the legacy controller.
   - For unsubmitted attempts (Category 1), `percentage` must remain `NULL`.
3. **The Non-Destruction Rule for Retakes:**
   - No migration script may execute `DELETE FROM "ExamAttempt"` or `DISTINCT ON` to pick the latest attempt.
   - All historical rows must be retained so that when the Product Owner approves OD-11, the policy can be applied historically with full auditability.

