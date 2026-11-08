# OX-DIGITAL Education — Phase 6.2C.2.4
# Formal Approval Record: OD-12.1 (Rolling Time Window Duration)

**Document ID:** `PHASE_6_2C_2_4_OD_12_1_APPROVAL_RECORD`  
**Workspace:** `D:\OX-DIGITAL\Mathe\OX-DIGITAL-GITHUB`  
**Git Baseline:** `main @ 0500b93e65c24ed881349c4acea7f523332c5e9f` (`0500b93`)  
**Execution Mode:** Documentation & Governance Recording Only (Strictly Read-Only with Respect to Schema & Database)  
**Date:** November 2026  

---

## 1. Executive Summary

This record formally documents the Product Owner's explicit approval of **OD-12.1** (Rolling Time Window Duration: **30 Calendar Days**), establishing the canonical configuration for the student academic assessment evaluation period across the OX-DIGITAL Education platform.

This action completes the governance prerequisite identified in Phase 6.2C.2.1 and Phase 6.2C.2.3, harmonizing architectural policy across the decision registers, calculator engine, and downstream services.

---

## 2. Formal Decision Specification: OD-12.1

| Field | Canonical Value |
|---|---|
| **Decision ID** | **OD-12.1** |
| **Parent Decision** | **OD-12** — Academic Assessment Evaluation Period |
| **Decision Title** | Rolling Time Window Duration |
| **Approved Selection** | **Option A — 30 Calendar Days** |
| **Approved Scope** | Trailing 30 calendar days (`submittedAt >= now() - INTERVAL '30 days'`) |
| **Status** | **APPROVED** |
| **Approval Authority** | Explicit Product Owner Approval Received |
| **Implementation Engine** | `packages/shared/src/academicAssessment.calculator.ts` (`{ rollingDays: 30 }`) |
| **Evaluation Scope Token** | `LAST_30_DAYS` |
| **Localized UI Representation** | `"نافذة متجددة: 30 يوم"` |

---

## 3. Canonical Open Decisions Register Reconciliation

All decisions across the platform governance registers are reconciled as follows, preserving all original IDs, titles, and scopes without alteration:

| Decision ID | Canonical Title | Status | Approved Option / Technical Recommendation |
|---|---|---|---|
| **OD-01** | Academic Assessment Calculation | **APPROVED** | **Option A (Simple Arithmetic Mean):** Arithmetic mean of percentages with equal weighting (1.0x). No hidden weights or arbitrary penalties. |
| **OD-02** | Minimum Academic Evidence Requirement | **APPROVED** | **Option C (Minimum 3 Graded Assessments):** Strict threshold: $N \ge 3$ eligible graded assessments required before status becomes `AVAILABLE`. |
| **OD-03** | Lateness Credit in Physical Attendance | **UNRESOLVED (PROPOSED)** | Option B (0.75 credit). Awaiting Phase 6.3 sign-off. |
| **OD-04** | Late Homework Submission Credit | **UNRESOLVED (PROPOSED)** | Option B (50% credit). Awaiting Phase 6.3 sign-off. |
| **OD-05** | Video Engagement Grace Period | **UNRESOLVED (PROPOSED)** | Option B (72-hour grace period). Awaiting Phase 6.4 sign-off. |
| **OD-06** | Historical Lesson Publication Timestamp Backfill | **UNRESOLVED (PROPOSED)** | Option B (Audited dry-run backfill). Awaiting Phase 6.4 sign-off. |
| **OD-07** | Parent Notification Cooldown Window | **UNRESOLVED (PROPOSED)** | Option B (7-day cooldown, immediate escalation). Awaiting Phase 6.4 sign-off. |
| **OD-08** | Digital Activity Formula for Online Students | **UNRESOLVED (PROPOSED)** | Option C (Composite 14-day activity score). Awaiting Phase 6.4 sign-off. |
| **OD-09** | Out-of-Band Notification Channels | **UNRESOLVED (PROPOSED)** | Option A (In-app only baseline; WhatsApp/SMS deferred). Awaiting Phase 7 sign-off. |
| **OD-10** | Seven-Day Assessment Trend Delta Threshold ($\theta$) | **UNRESOLVED (PROPOSED)** | Option B ($\pm 5.0$ points noise filter). Awaiting Phase 6.4 sign-off. |
| **OD-11** | Assessment Retake Policy | **APPROVED** | **Option A (Latest Attempt):** Chronologically latest eligible graded attempt per assessment contributes. Tie-breaker: `submittedAt \|\| createdAt DESC, id DESC`. |
| **OD-12** | Academic Assessment Evaluation Period | **APPROVED** | **Option C (Rolling Time Window):** Filters eligible assessments within a dynamic rolling sliding window. |
| **OD-12.1** | Rolling Time Window Duration | **APPROVED** | **Option A (30 Calendar Days):** Evaluates attempts submitted within the trailing 30-day window (`now - 30 days`). |

---

## 4. Technical Coherence & Service Alignment

1. **Shared Academic Assessment Calculator (`packages/shared/src/academicAssessment.calculator.ts`):**
   - The calculator natively defaults to `{ rollingDays: 30 }`.
   - When filtering assessments, any attempt where `submittedAt < (now - 30 days)` is excluded from the active calculation.
   - Emits `assessmentPeriod: "LAST_30_DAYS"` and localized display label `"نافذة متجددة: 30 يوم"`.
   - Correctly integrates with OD-01 (arithmetic mean) and OD-02 (minimum 3 assessments within window).
   - Correctly integrates with OD-11: if a student has multiple attempts within the 30-day window, only the latest completed attempt is considered.

2. **Unified Invariant Helper (`packages/shared/src/academicEligibility.ts`):**
   - Implements `isAssessmentEligible(attempt, now, options)` asserting:
     - `status === 'GRADED'` (or transitional `status === null && percentage !== null`)
     - `totalPoints > 0`
     - `submittedAt >= (now - 30 days)` (when rolling evaluation is active)

3. **Analytics Service (`services/analytics-service`):**
   - Reconstructs student assessment records aligning queries to the 30-calendar-day window for active GPA metrics and trend comparisons.

4. **User Service (`services/user-service`):**
   - Evaluates student academic standing and progress metrics within the authoritative 30-calendar-day rolling boundary.

---

## 5. Governance & Boundary Verification

- **Documentation Scope:** All changes are strictly confined to canonical markdown governance documents:
  - `PHASE_6_2A_OPEN_DECISIONS_REGISTER.md`
  - `PHASE_6_2A_OPEN_DECISIONS_REVIEW_AND_APPROVAL_MATRIX.md`
  - `PHASE_6_2C_1_PRODUCT_OWNER_DECISIONS.md`
  - `PHASE_6_2C_1_1_IMPLEMENTATION_READINESS_AND_DECISIONS.md`
  - `PHASE_6_2C_2_4_OD_12_1_APPROVAL_RECORD.md`
- **Zero Schema Mutations:** No modifications were made to `packages/database/prisma/schema.prisma`.
- **Zero Migration Edits:** No changes were made to migration SQL files or scripts.
- **Zero Database Operations:** No database queries, connections, backfill runs, or migrations were executed.
- **Zero Code Regressions:** Existing core application logic and test suites remain untouched and aligned.

