# OX-DIGITAL Education — Phase 6.2C.3
# Historical Data & Backfill Safety Assessment

**Document ID:** `PHASE_6_2C_3_BACKFILL_SAFETY_ASSESSMENT`  
**Workspace:** `D:\OX-DIGITAL\Mathe\OX-DIGITAL-GITHUB`  
**Target Script:** `services/course-service/src/scripts/backfillExamAttempts.ts`  
**Execution Mode:** STRICT READ-ONLY PRE-EXECUTION AUDIT  
**Date:** November 2026  

---

## 1. Executive Summary

This report delivers a rigorous pre-execution audit of the historical data classification and backfill script [`backfillExamAttempts.ts`](file:///D:/OX-DIGITAL/Mathe/OX-DIGITAL-GITHUB/services/course-service/src/scripts/backfillExamAttempts.ts).

The audit verified that the script strictly implements the approved Product Owner policies and remedies DEF-01 through DEF-06 without data distortion, timestamp fabrication, or modern record corruption.

---

## 2. Safety Guards & Execution Mode Audit

| Requirement | Code Verification | Audit Status |
|---|---|---|
| **Dry-Run by Default** | `const isDryRun = !options.execute;` (line 37). When invoked without flags, it executes purely in read-only analysis mode. | **PASS** |
| **Explicit Flag for Writes** | Database `db.examAttempt.update` is wrapped inside `if (!isDryRun)` (line 195). Requires explicit `--execute` CLI argument. | **PASS** |
| **Zero Modern Overwrite (DEF-04)** | Skips rows where `status === 'GRADED'`, `status === 'CHEATING'`, `isGraded === true`, or `percentage !== null` (lines 83-92). Modern active records (`status === 'IN_PROGRESS'` or `submittedAt !== null`) are strictly bypassed. | **PASS** |
| **Zero Timestamp Invention (DEF-03)** | Hardcodes `const submittedAt: Date | null = null;` (line 111). Never assigns `createdAt` to `submittedAt`. Legacy rows retain `null`. | **PASS** |
| **Zero Max Points Fabrication (DEF-02)** | Only calculates `totalPoints` and `percentage` if verified from `exam.totalPoints` or question point sums. If unverified, classifies as `UNVERIFIABLE_MAX_POINTS` with `totalPoints: null, percentage: null, isGraded: false` (lines 148-155). | **PASS** |
| **Disqualification of Cheating** | If `att.ExamViolation.length >= 2`, classifies as `DISQUALIFIED_CHEATING` (`status: 'CHEATING'`, `isGraded: false`, `percentage: 0`) (lines 137-142). Strictly excluded from academic averages. | **PASS** |
| **Idempotency on Repeated Runs** | Second execution skips already classified records, yielding `eligibleCandidates: 0` and `executedUpdates: 0`. Verified in Test 3.3. | **PASS** |

---

## 3. Classification Evidence Matrix

Every legacy attempt is mapped to a deterministic category based strictly on existing evidence:

```
                                [Legacy Attempt]
                                       │
                    ┌──────────────────┴──────────────────┐
                    ▼                                     ▼
           Has Exam Deleted?                    Exam Exists in DB
           └──► CORRUPTED_MISSING_EXAM                    │
                                            ┌─────────────┴─────────────┐
                                            ▼                           ▼
                                    Violations >= 2?             No Violations
                                    └──► DISQUALIFIED_CHEATING          │
                                                                        ▼
                                                   ┌────────────────────┴────────────────────┐
                                                   ▼                                         ▼
                                              Score > 0                                  Score == 0
                                                   │                                         │
                                   ┌───────────────┴───────────────┐         ┌───────────────┴───────────────┐
                                   ▼                               ▼         ▼                               ▼
                          Max Points Verified?           Max Points Unknown  Has Answers?                No Answers
                          ├── YES ──► GRADED_NORMAL      └──► UNVERIFIABLE   ├── YES ──► GRADED_ZERO     ├── Elapsed ──► TIME_EXPIRED
                          └── NO  ──► UNVERIFIABLE                           └── NO  ──► UNVERIFIABLE    └── Active  ──► ABANDONED_ZERO
```

---

## 4. Academic Integrity & Downstream Impact

1. **Elimination of False 0% Penalties:**
   - Legacy abandoned sessions (`score: 0, answers: null`) are classified as `ABANDONED_ZERO` or `TIME_EXPIRED` with `isGraded: false`.
   - Downstream queries in `analytics-service` and `user-service` filter on `{ isGraded: true, status: 'GRADED' }`, instantly removing false 0% GPA penalties.
2. **Preservation of Genuine 0% Failures:**
   - Legitimate attempts where the student completed questions but failed (`score: 0, answers.length > 0`) remain classified as `GRADED_ZERO` (`percentage: 0, isGraded: true`).
3. **Retake Supersession Tracking:**
   - Identifies superseded retakes for historical audits without modifying the attempts.

---

## 5. Pre-Execution Dry-Run Recommendation

When Phase 6.2C.4 begins:
1. Execute the backfill script in **DRY-RUN mode first**:
   ```bash
   docker exec ox-digital-course-service node --loader ts-node/esm services/course-service/src/scripts/backfillExamAttempts.ts
   ```
2. Inspect the JSON summary to verify candidate counts against expectations.
3. Only upon operator verification of the dry-run summary, execute with `--execute`.

**Backfill Safety Verdict:** **VERIFIED & SAFE FOR CONTROLLED EXECUTION**.

