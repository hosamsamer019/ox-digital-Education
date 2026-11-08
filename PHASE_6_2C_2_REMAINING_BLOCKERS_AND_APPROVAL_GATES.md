# Phase 6.2C.2 — Remaining Blockers & Approval Gates
## Production Readiness, Unresolved Decisions, and Next-Phase Roadmap

**Project:** OX-DIGITAL Education  
**Workspace:** `D:\OX-DIGITAL\Mathe\OX-DIGITAL-GITHUB`  
**Current Baseline:** `main @ 0500b93e65c24ed881349c4acea7f523332c5e9f`  
**Status:** IMPLEMENTATION COMPLETE — READY FOR PRODUCT OWNER DECISION REVIEW  
**Date:** November 2, 2026  

---

## 1. Resolved Decisions in Phase 6.2C.2

| Decision ID | Decision Topic | Approved Option | Implementation Status |
|---|---|---|---|
| **OD-01** | Academic Assessment Calculation | Option A: Simple Arithmetic Average | **ACTIVE & ENFORCED** |
| **OD-02** | Minimum Academic Evidence | Option C: Minimum 3 Eligible Assessments | **ACTIVE & ENFORCED** |
| **OD-11** | Assessment Retake Policy | Option A: Chronologically Latest Attempt | **ACTIVE & ENFORCED** |
| **OD-12** | Academic Evaluation Period Architecture | Option B: Rolling Time Window Architecture | **ACTIVE & ENFORCED** |

---

## 2. Open Decision Awaiting Product Owner Approval

### OD-12.1 — Specific Duration of the Rolling Time Window
- **Status:** **PENDING PRODUCT OWNER SELECTION**
- **Context:** While the architectural concept of a Rolling Time Window was approved in Phase 6.2C.2, the exact duration (e.g., 30 calendar days, 60 days, 90 days, or academic term length) has NOT yet been approved.
- **Current System Behavior:** If a rolling period is requested without configuring duration, the API returns `status: 'PERIOD_CONFIGURATION_REQUIRED'` and `periodStatus: 'CONFIGURATION_REQUIRED'`. The UI displays `معلق (إعداد الفترة)`. Lifetime data defaults to `periodStatus: 'UNSPECIFIED'` and is never labeled rolling.
- **Product Owner Action Required:** Approve a specific number of days (e.g., 30, 60, or 90 days) for the default rolling evaluation window.

---

## 3. Deployment & Release Approval Gates

Before changes can be released to the staging or production environments, the following gates must be formally executed:

```
┌────────────────────────────────────────────────────────┐
│           PHASE 6.2C.2 PRODUCTION GATES                │
├─────────────────────────┬──────────────┬───────────────┤
│ Gate Description        │ Prerequisite │ Authorization │
├─────────────────────────┼──────────────┼───────────────┤
│ 1. Git Commit & Tag     │ PO Sign-off  │ Technical Lead│
│ 2. PostgreSQL Snapshot  │ Pre-deploy   │ DevOps Lead   │
│ 3. DDL Migration Apply  │ DB Backup    │ Product Owner │
│ 4. Backfill Dry-Run     │ DDL Applied  │ Data Analyst  │
│ 5. Backfill Execution   │ Review Pass  │ Product Owner │
│ 6. Staging Smoke Test   │ Post-deploy  │ QA Lead       │
└─────────────────────────┴──────────────┴───────────────┘
```

1. **Git Commit Gate:** All Phase 6.2C.2 changes are currently uncommitted in the working tree to preserve sandbox isolation and prevent unauthorized branch changes.
2. **Database Migration Gate:** The migration file `packages/database/prisma/migrations/20261102_exam_lifecycle_alignment/migration.sql` must be applied using `prisma migrate deploy` after a full `pg_dump` backup is verified.
3. **Data Backfill Gate:** The backfill script `services/course-service/src/scripts/backfillExamAttempts.ts` must be executed first with dry-run inspection, and then executed with `--execute` once category counts are audited.

---

## 4. Next-Phase Recommendation

Upon Product Owner review and approval of the OD-12 rolling duration:
1. Proceed to **Phase 6.2C.3 (Migration Deployment & Historical Data Backfill Verification)** in a controlled staging environment.
2. Advance to **Phase 6.3 (Attendance and Engagement Risk Dimensions)** under the unified 4-dimension risk architecture.

