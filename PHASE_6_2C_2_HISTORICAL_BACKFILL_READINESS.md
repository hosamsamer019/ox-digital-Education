# Phase 6.2C.2 — Historical Backfill Readiness Report
## 9-Category Forensic Classification & Operational Safety Plan

**Project:** OX-DIGITAL Education  
**Workspace:** `D:\OX-DIGITAL\Mathe\OX-DIGITAL-GITHUB`  
**Script Path:** `services/course-service/src/scripts/backfillExamAttempts.ts`  
**Execution Mode:** DRY-RUN READY (SAFELY STAGED — EXECUTION DEFERRED)  
**Date:** November 2, 2026  

---

## 1. Objective & Operational Safeguards

The historical backfill script was created to allow eventual alignment of historical `ExamAttempt` records once the Product Owner authorizes production schema migration.

**Mandatory Operational Restrictions Enforced:**
1. **Default Dry-Run Mode:** Running `node dist/scripts/backfillExamAttempts.js` or importing `runBackfill()` automatically defaults to `isDryRun: true`.
2. **Explicit `--execute` Flag Required:** The script will NOT perform any database writes unless the `--execute` argument is explicitly passed to the CLI.
3. **Zero Historical Data Deletion:** The backfill script NEVER deletes or deduplicates attempts. Retakes and legacy attempts are strictly preserved in their original rows.
4. **Non-Execution in Phase 6.2C.2:** As authorized, **the script was NOT run against the live database**.

---

## 2. The 9 Forensic Classification Categories

| Category | Detection Criteria | Target `status` | Target `isGraded` | Target `totalPoints` | Target `percentage` | Target `submittedAt` |
|---|---|---|---|---|---|---|
| **1. GRADED_NORMAL** | `score > 0`, `exam` exists, violations < 2 | `GRADED` | `true` | `exam.totalPoints ?? 100` | `score` | `createdAt` |
| **2. GRADED_ZERO** | `score === 0`, answers array has items, violations < 2 | `GRADED` | `true` | `exam.totalPoints ?? 100` | `0` | `createdAt` |
| **3. ABANDONED_ZERO** | `score === 0`, answers null/empty, elapsed <= duration + 5 | `STARTED` | `false` | `100` | `null` | `null` |
| **4. DISQUALIFIED_CHEATING** | `ExamViolation >= 2` | `CHEATING` | `false` | `100` | `0` | `createdAt` |
| **5. TIME_EXPIRED_SUBMITTED** | elapsed > duration + 5, answers present | `TIME_EXPIRED` | `true` | `exam.totalPoints ?? 100` | `score` | `createdAt` |
| **6. TIME_EXPIRED_UNSUBMITTED**| elapsed > duration + 5, answers null/empty | `TIME_EXPIRED` | `false` | `100` | `null` | `null` |
| **7. RETAKE_SUPERSEDED** | Earlier graded attempt superseded by later graded attempt | `GRADED` | `true` | `exam.totalPoints ?? 100` | `score` | `createdAt` (flagged in summary) |
| **8. CORRUPTED_MISSING_EXAM** | `exam` relation is null/deleted | `STARTED` | `false` | `100` | `null` | `null` |
| **9. ACTIVE_IN_PROGRESS** | `createdAt` within duration, answers array present, not submitted | `IN_PROGRESS` | `false` | `exam.totalPoints ?? 100` | `null` | `null` |

---

## 3. Backfill Execution Checklist (For Future Deployment)

When Product Owner authorization is granted to execute the migration and backfill, the following sequence must be observed:

```
[ ] 1. Full PostgreSQL pg_dump snapshot taken and verified.
[ ] 2. Apply migration: `prisma migrate deploy` (adds columns with default values).
[ ] 3. Run backfill in dry-run mode: `npm run backfill:dry-run`.
[ ] 4. Inspect category breakdown counts against expected totals.
[ ] 5. Run backfill in execute mode: `npm run backfill:execute`.
[ ] 6. Post-backfill audit: verify that no attempts have `status = null`.
[ ] 7. Verify student GPAs and at-risk queues reflect accurate historical values.
```

