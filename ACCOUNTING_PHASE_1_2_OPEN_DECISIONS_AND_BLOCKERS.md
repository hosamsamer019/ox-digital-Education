# OX-DIGITAL Education — Accounting Track
# Phase 1.2: Open Product Owner Decisions & Technical Blockers Register

**Author:** Independent Systems Architect & Governance Lead  
**Project:** OX-DIGITAL Education  
**Document Classification:** Authoritative Governance Gate & Blockers Matrix  
**Baseline Commit:** `0500b93e65c24ed881349c4acea7f523332c5e9f` on branch `main`  
**Date:** November 3, 2026

---

## 1. Executive Summary

This document registers the open policy decisions, commercial choices, and technical dependency gates that must be formally resolved by the Product Owner prior to commencing Phase 2 (Persistence, Relational Schema & Service Layer Integration).

While the in-memory Financial Core Engine is certified and ready, downstream database persistence and business workflows cannot proceed until these gates are addressed.

---

## 2. Unresolved Product Owner Decisions Register

| Decision ID | Decision Title | Operational Context | Decision Options | Architecture Recommendation | Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **OD-710** | **Accounting Period Closure & Reopening Policy** | How monthly and annual financial periods are formally sealed, and whether a closed period may ever be re-opened for adjustments. | **A:** Permanent hard close (re-opening strictly prohibited; adjustments must be posted to open period).<br>**B:** Supervised reopening (Primary Manager may re-open with mandatory audit reason). | **Option A (Permanent Hard Close):** Preserves immutable historical tax and financial filings. Adjustments posted via compensating entries in current open period. | **OPEN — PENDING PO CHOICE** |
| **UP-704** | **Teacher Revenue-Share Calculation Basis** | Under revenue-share compensation models, whether teacher percentages are calculated against Gross Tuition or Net Tuition (after sibling discounts and scholarships). | **A:** Gross Commercial Value (teacher protected from student subsidies).<br>**B:** Net Collected Cash (center and teacher share the cost of discounts).<br>**C:** Configurable per teacher contract. | **Option C (Configurable per Contract):** Provides commercial flexibility while preventing center margin erosion. | **OPEN — PENDING PO CHOICE** |
| **PO-725** | **Branch Operational Supervisor Role** | Whether to introduce a dedicated `BRANCH_SUPERVISOR` role between the `PRIMARY_MANAGER` and `ACCOUNTANT`/`CASHIER` for multi-campus operations. | **A:** Retain 4 roles only (Primary Manager oversees all branches directly).<br>**B:** Introduce `BRANCH_SUPERVISOR` (delegated operational sign-off for single branch, no pricing authority). | **Option A for Initial Release:** Keeps security and permission boundaries simple. Evaluate Option B post-rollout. | **OPEN — PENDING PO CHOICE** |
| **PO-726** | **Cash Discrepancy Approval Thresholds** | The maximum cash shortage/surplus amount that an Accountant may reconcile before mandatory Primary Manager sign-off is required. | **A:** Fixed threshold (e.g., shortages > 100 EGP require Primary Manager approval).<br>**B:** Zero tolerance (any discrepancy requires Primary Manager approval). | **Option A (Fixed Threshold, e.g. 50 EGP):** Prevents administrative bottlenecks for trivial coin rounding variances. | **OPEN — PENDING PO CHOICE** |
| **PO-727** | **Student Overdue Access Suspension Grace Period** | Standard policy for grace periods before delinquent student accounts face optional classroom or exam access suspension. | **A:** 7 calendar days after maturity date.<br>**B:** 14 calendar days after maturity date.<br>**C:** Discretionary manual suspension only (no automated suspension). | **Option A (7 Days with Manual Exemption):** Balances institutional cash flow with operational empathy. | **OPEN — PENDING PO CHOICE** |

---

## 3. Technical Dependency Blockers for Phase 2

Before any code is written for Phase 2, the following technical blockers must be cleared:

### Blocker BLK-01: Explicit Authorization for Database Schema Changes
- **Description:** Phase 1 and Phase 1.1 strictly authorized domain-level in-memory logic. Modifying `packages/database/prisma/schema.prisma`, authoring PostgreSQL migration scripts, or modifying the Docker PostgreSQL database requires explicit Product Owner authorization.
- **Action Required:** Product Owner must issue formal Phase 2 Implementation Authorization.

### Blocker BLK-02: Approved Chart of Accounts Master Template
- **Description:** A standard Egyptian Chart of Accounts template (Standardized 4-digit code structure for Assets `1xxx`, Liabilities `2xxx`, Equity `3xxx`, Revenues `4xxx`, and Expenses `5xxx`) must be approved by the Product Owner for default institutional seeding.
- **Action Required:** Product Owner review and approval of the Default Educational Institution COA.

### Blocker BLK-03: Receipt Numbering Sequence Architecture
- **Description:** Physical receipts require a contiguous, non-repeating sequence per branch (e.g., `REC-{BRANCH_CODE}-{YEAR}-{SEQ}`). Concurrency controls must be specified to prevent sequence gaps or collisions during high-traffic registration periods.
- **Action Required:** Architecture agreement on PostgreSQL sequence or transactional counter table.

---

## 4. Governance & Phase Sign-Off Gate

```text
========================================================================================
CURRENT TRACK STATUS:
PHASE_1_2_ACCEPTED — FINANCIAL_CORE_VERIFIED — CENTER_INTEGRATION_DESIGN_READY
DOWNSTREAM IMPLEMENTATION: BLOCKED PENDING PRODUCT OWNER PHASE 2 AUTHORIZATION
========================================================================================
```

