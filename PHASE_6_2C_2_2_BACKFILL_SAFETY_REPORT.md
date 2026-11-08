# Phase 6.2C.2.2 — Backfill Safety Report
## Historical Data Alignment, Timestamp Integrity & Idempotency Architecture

**Workspace:** `D:\OX-DIGITAL\Mathe\OX-DIGITAL-GITHUB`  
**Script Path:** `services/course-service/src/scripts/backfillExamAttempts.ts`  
**Phase:** 6.2C.2.2 — Targeted Remediation & Deployment Hardening  
**Execution Status:** DRY-RUN AUDITED ONLY (Write Mode STRICTLY Prohibited & Unexecuted)  
**Date:** November 2026  

---

## 1. Executive Summary

This report assesses the safety, idempotency, and audit integrity of the updated historical backfill script, [backfillExamAttempts.ts](file:///D:/OX-DIGITAL/Mathe/OX-DIGITAL-GITHUB/services/course-service/src/scripts/backfillExamAttempts.ts).

In Phase 6.2C.2.1, the previous backfill script was rejected due to:
1. **Timestamp Fabrication (DEF-03)**: It assigned `submittedAt = new Date(att.createdAt)` for all legacy records, manufacturing false submission timestamps.
2. **Missing Idempotency & Overwrite Hazards (DEF-04)**: It scanned all attempts without scoping to unclassified rows, risking corruption of modern records on re-execution.
3. **Synthetic Maximum Marks (DEF-02)**: It defaulted unknown exam points to `100`.

In Phase 6.2C.2.2, the script was rewritten to eliminate timestamp fabrication, enforce strict idempotency, guard modern records, and preserve historical audit truth.

---

## 2. Forensic Analysis of Remediation Implementations

### 2.1 DEF-03: Elimination of Timestamp Fabrication
- **Implementation**: Legacy attempts with missing submission timestamps retain `submittedAt = null`.
- **Audit Verification**:
  ```typescript
  // DEF-03: Do NOT invent submittedAt = createdAt. Keep null!
  const submittedAt: Date | null = null;
  ```
- **Downstream Consumer Contract**:
  - The database stores `submittedAt: null`.
  - `academicAssessment.calculator.ts` uses `submittedAt` if present; if `null`, it falls back to `createdAt` strictly for deterministic chronology and tie-breaking without fabricating an artificial submission date.
  - The historical audit trail reflects empirical reality.

### 2.2 DEF-04: Strict Idempotency & Scoping
- **Implementation**:
  1. The script inspects all records and filters out already classified and modern records before applying mutations:
     ```typescript
     const isAlreadyClassified =
       att.status === 'GRADED' ||
       att.status === 'CHEATING' ||
       att.isGraded === true ||
       att.percentage !== null;

     if (isAlreadyClassified) {
       summary.skippedAlreadyClassified++;
       continue;
     }

     const isModernActive =
       att.status === 'IN_PROGRESS' ||
       att.submittedAt !== null;

     if (isModernActive) {
       summary.skippedModernRecords++;
       continue;
     }
     ```
  2. Guarded update: write operations apply only to unmigrated candidate records.
  3. **Idempotency Guarantee**: If the script is executed once, all candidate records transition to classified states. On a subsequent run, `eligibleCandidates` evaluates to **0**, and **0 database updates** are performed.

### 2.3 DEF-02: Handling Unknown Maximum Scores
- **Implementation**:
  - The script inspects `att.exam.totalPoints`. If null or $\le 0$, it checks whether `att.exam.questions` defines question points whose sum is $> 0$.
  - If maximum marks cannot be verified, the attempt is classified as `UNVERIFIABLE_MAX_POINTS`.
  - In this state, `totalPoints = null`, `percentage = null`, `status = 'STARTED'`, and `isGraded = false`.
  - The script **never** assumes 100 points.

---

## 3. The 10-Category Classification Architecture

The script categorizes all records into 10 mutually exclusive, forensically auditable categories:

| Category Key | Status | `isGraded` | `submittedAt` | Description & Forensic Handling |
| :--- | :---: | :---: | :---: | :--- |
| **`GRADED_NORMAL`** | `GRADED` | `true` | `null` | Legacy attempts with `score > 0` and verified total points. Graded percentage calculated. |
| **`GRADED_ZERO`** | `GRADED` | `true` | `null` | Legacy attempts where student submitted answers and legitimately scored 0%. |
| **`ABANDONED_ZERO`** | `STARTED` | `false` | `null` | Zero score with null/empty answers within elapsed window. Treated as unsubmitted. |
| **`TIME_EXPIRED_UNSUBMITTED`** | `TIME_EXPIRED` | `false` | `null` | Zero score with null/empty answers where elapsed time exceeded exam duration + grace period. |
| **`TIME_EXPIRED_SUBMITTED`** | `TIME_EXPIRED` | `true` | `now` | Expired attempts where student had submitted partial answers. |
| **`DISQUALIFIED_CHEATING`** | `CHEATING` | `false` | `null` | Attempts associated with 2 or more violation events (`ExamViolation >= 2`). Disqualified. |
| **`UNVERIFIABLE_MAX_POINTS`** | `STARTED` | `false` | `null` | Attempts with scores where exam total points cannot be verified. Left un-graded. |
| **`RETAKE_SUPERSEDED`** | Counter | — | — | Secondary counter tracking earlier attempts superseded by newer attempts (OD-11). |
| **`CORRUPTED_MISSING_EXAM`** | `STARTED` | `false` | `null` | Orphan attempts referencing non-existent exams. |
| **`ACTIVE_IN_PROGRESS`** | `IN_PROGRESS` | `false` | `null` | Modern attempts currently active in the exam player. Skipped. |

---

## 4. Safety Controls & CLI Invocation

- **Default Execution Mode**: **DRY-RUN (Safe Read-Only)**.
- **Write Mode Requirement**: Requires explicit `--execute` flag.
- **Exit Verification**:
  ```powershell
  # Safe dry-run inspection (permitted in staging/pre-production):
  node services/course-service/dist/scripts/backfillExamAttempts.js

  # Authorized execution mode (strictly requires prior Product Owner approval):
  node services/course-service/dist/scripts/backfillExamAttempts.js --execute
  ```
- **Execution Confirmation**: During Phase 6.2C.2.2, the script was **NOT** executed in write mode. Zero database mutations occurred.
