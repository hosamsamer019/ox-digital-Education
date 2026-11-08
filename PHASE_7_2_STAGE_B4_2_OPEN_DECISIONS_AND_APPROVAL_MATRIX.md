# Phase 7.2 — Stage B.4.2: Governance & Decision Matrix
## Open Decisions, Approval Authorities & Operational Clarifications Matrix

**Workspace:** `D:\OX-DIGITAL\Mathe\OX-DIGITAL-GITHUB`  
**Git Repository:** `https://github.com/hosamsamer019/ox-digital-Education.git`  
**Git HEAD:** `0500b93e65c24ed881349c4acea7f523332c5e9f` (branch `main`)  
**Phase:** 7.2 — Pricing Catalog & Subscription Agreements  
**Stage:** Stage B.4.2 — Final Product Owner Decision Closure & Implementation Authorization Readiness  
**Date:** November 2, 2026  
**Final Status:** `STAGE B.4.2 — FINAL DOCUMENTATION RECONCILIATION — NO IMPLEMENTATION OR DATABASE AUTHORIZATION`  

---

## 1. Executive Matrix Overview

This document maps out every open decision, provisional selection, and external review dependency required before Task 7.2 and subsequent financial modules can proceed. 

It explicitly distinguishes between:
1. **Decisions Provisionally Selected** awaiting formal Stage C executive sign-off.
2. **Proposed Technical Directions** awaiting explicit Product Owner policy determination (OD-723).
3. **Specific Operational Parameters** remaining explicitly unresolved.
4. **Specialist Review Dependencies** requiring external certified professional counsel.

---

## 2. Master Decision Governance & Approval Matrix

| Decision ID | Canonical Topic | Current Operational Value | Current Reconciled Status | Approving Authority | Pre-Implementation Action Required |
|---|---|---|---|---|---|
| **OD-721** | Pricing Management Authority | `PRIMARY_MANAGER_ONLY` | `PROVISIONAL_PRODUCT_OWNER_SELECTION` | Product Owner | Stage C formal sign-off. |
| **OD-722.1** | Session Consumption Trigger | `PRESENT_ONLY` | `PROVISIONAL_PRODUCT_OWNER_SELECTION` | Product Owner | Stage C formal sign-off. |
| **OD-722.2** | Unused Session Expiration | `CONFIGURABLE_PER_PACKAGE` | `PROVISIONAL_PRODUCT_OWNER_SELECTION` | Product Owner | Package template policy definition. |
| **OD-722.3** | Package Refundability | `CONFIGURABLE_PER_PACKAGE` | `PROVISIONAL_PRODUCT_OWNER_SELECTION` | Product Owner + Legal | Gated by UP-706 legal review. |
| **OD-722.4** | Session Valuation Method | `EQUAL_ALLOCATION` | `PROVISIONAL_PRODUCT_OWNER_SELECTION` | Product Owner + Accountant | Gated by UP-701 accounting review. |
| **OD-722.5** | Cancellations & Make-Ups | `TEACHER_RESTORES_STUDENT_RESTORES_ON_NOTICE` | `PROVISIONAL_PRODUCT_OWNER_SELECTION` | Product Owner | Stage C formal sign-off. |
| **OD-723** | Price Version Immutability | `PURE_APPEND_ONLY_VERSIONING` | `PROPOSED_TECHNICAL_DIRECTION_SELECTED — NOT EXPLICITLY APPROVED AS FINAL POLICY` | Product Owner | **Requires explicit Product Owner determination to approve or reject pure append-only versioning.** |
| **OD-724** | Legacy Transition Grace Period | `FIXED_TRANSITION_GRACE_PERIOD` (60 Days from Activation) | `PROVISIONAL_PRODUCT_OWNER_SELECTION` | Product Owner | Stage C formal sign-off; **strictly blocked by Task 7.1 Staging deployment**. |
| **OD-725** | Initial Currency Policy | `EGP_LAUNCH_WITH_SCHEMA_EXTENSIBILITY` | `PROVISIONAL_PRODUCT_OWNER_SELECTION` | Product Owner | Stage C formal sign-off. |
| **OD-726** | Subscription Renewal Model | `NEW_AGREEMENT_PER_RENEWAL` (Opt-In Auto-Renew, Current Price, Contiguous) | `PROVISIONAL_PRODUCT_OWNER_SELECTION` | Product Owner | Stage C formal sign-off. |
| **UP-701** | Statutory Chart of Accounts | Standard 5-digit institutional COA structure | `POLICY_GATED_PENDING_SPECIALIST` | Certified Egyptian Public Accountant | Formal written sign-off before Task 7.5. |
| **UP-702** | Egyptian VAT & ETA Invoicing | Multi-tax category schema (`taxCategoryId`) | `POLICY_GATED_PENDING_SPECIALIST` | Qualified Egyptian Tax Counsel | Written tax legal opinion before Task 7.3. |
| **UP-706** | Cancellation Administrative Fee | Pro-rata refund minus admin processing fee | `PROVISIONAL_PRODUCT_OWNER_SELECTION` | Commercial Legal Counsel + PO | Legal review under Consumer Protection Law 181/2018. |
| **UP-707** | Fiscal Calendar Policy | Parameterized start month (`fiscalYearStartMonth`) | `PROVISIONAL_PRODUCT_OWNER_SELECTION` | Product Owner | Stage C formal sign-off. |
| **UP-709** | Staff Approval Thresholds | Dual approval for discounts > 10% or adjustments > 500 EGP | `PROVISIONAL_PRODUCT_OWNER_SELECTION` | Product Owner | Executive clarification on threshold basis. |
| **UP-712** | Multi-Currency Enablement | Deferred for launch; schema ISO-4217 compliant | `DEFERRED` | Product Owner | Deferred to international expansion phase. |
| **UP-713** | Institutional Legal Entity | Commercial academy vs licensed school tax profile | `POLICY_GATED_PENDING_SPECIALIST` | Corporate Legal Advisor | Corporate registration review before Task 7.3. |
| **UP-714** | Hybrid Package Valuation | Unbundled discrete physical lab vs digital LMS lines | `PROVISIONAL_PRODUCT_OWNER_SELECTION` | Product Owner + Accountant | Stage C formal sign-off. |
| **UP-715** | Data Retention & PII Lifecycle | Statutory retention with PII scrubbing under Law 151/2020 | `POLICY_GATED_PENDING_SPECIALIST` | Data Privacy Legal Counsel | Written privacy opinion before Task 7.7. |

---

## 3. Explicitly Unresolved Operational Parameters

The following operational details remain explicitly unresolved and are flagged for executive clarification:

### 3.1 OD-724 Outage Extension Policy
- **Open Dilemma:** If the platform experiences a major infrastructure or hosting outage during the 60-day legacy transition window, does the deadline automatically extend by the outage duration, or does it remain strictly fixed?
- **Status:** `PENDING_PRODUCT_OWNER_CLARIFICATION`.
- **Engineering Baseline Default:** Fixed deadline default with zero automatic extensions until the Product Owner explicitly authorizes an extension policy.

### 3.2 UP-709 Maker-Checker Calculation Basis
- **Open Dilemma:** How is the 500.00 EGP threshold evaluated?
  - *Option A:* Per individual line item adjustment.
  - *Option B:* Per total invoice adjustment.
  - *Option C:* Cumulative rolling 24-hour window per student (Anti-splitting baseline).
  - *Option D:* Cumulative across an entire academic semester.
- **Status:** `PENDING_PRODUCT_OWNER_CLARIFICATION`.
- **Engineering Baseline Default:** Rolling 24-hour aggregate anti-splitting check enforced.

### 3.3 OD-726 Advance Price Change Notification Window
- **Open Dilemma:** Under OD-726.2, renewals apply current catalog prices. If tuition has increased, what is the mandatory advance notice window (e.g. 7 days, 14 days, or 30 days) required before charging the customer?
- **Status:** `PENDING_PRODUCT_OWNER_CLARIFICATION`.
- **Engineering Baseline Default:** Advance notification requiring explicit re-consent before billing.

### 3.4 UP-706 Administrative Fee Determination
- **Open Dilemma:** What is the exact administrative fee deduction upon cancellation?
  - Fixed amount (e.g. 50 EGP).
  - Fixed percentage (e.g. 5% of net package price).
  - Actual payment gateway interchange fees incurred.
- **Status:** `PENDING_PRODUCT_OWNER_CLARIFICATION` + `POLICY_GATED_PENDING_SPECIALIST`.
- **Engineering Baseline Default:** No fee amount is invented; awaiting legal counsel review under Egyptian Law 181/2018.

---

## 4. Technical Direction OD-723: Approval vs. Rejection Impact Analysis

Because OD-723 remains a **proposed technical direction** rather than an approved policy, the formal trade-offs are presented below:

```
+----------------------------------------------------------------------------------------------------+
| OD-723: PURE APPEND-ONLY VERSIONING TRADE-OFF ANALYSIS                                             |
+----------------------------------------------------------------------------------------------------+
| IF APPROVED BY PRODUCT OWNER:                                                                      |
| - PriceVersion eliminates 'effectiveTo' column entirely.                                           |
| - Published price rows are 100% write-once and mathematically immutable.                           |
| - Price updates insert new sequential versionNumber rows.                                          |
| - Zero database UPDATE locks on published prices; simplifies high-concurrency checkouts.           |
| - Historical price resolution is reproducible via high-performance index scan.                     |
|                                                                                                    |
| IF REJECTED BY PRODUCT OWNER:                                                                      |
| - PriceVersion retains 'effectiveTo' column.                                                       |
| - Supersession executes an in-place UPDATE setting 'effectiveTo = newEffectiveFrom - 1s'.           |
| - Requires row-level versioning locks to prevent concurrent supersession collisions.               |
| - Requires PostgreSQL exclusion constraints ('btree_gist' extension) to prevent temporal overlaps. |
| - Published rows undergo in-place mutation, weakening cryptographic auditability.                  |
+----------------------------------------------------------------------------------------------------+
```

---

## 5. Explicit Governance Statement

```
STAGE B.4.2 — FINAL DOCUMENTATION RECONCILIATION — NO IMPLEMENTATION OR DATABASE AUTHORIZATION
```

