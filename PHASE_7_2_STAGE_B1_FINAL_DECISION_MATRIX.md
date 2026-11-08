# Phase 7.2 — Stage B.1: Architecture Validation
## Document 4: Comprehensive Product Owner Decision Register & Governance Matrix

**Workspace:** `D:\OX-DIGITAL\Mathe\OX-DIGITAL-GITHUB`  
**Git Repository:** `https://github.com/hosamsamer019/ox-digital-Education.git`  
**Git HEAD:** `0500b93e65c24ed881349c4acea7f523332c5e9f` on branch `main`  
**Phase:** 7.2 — Pricing Catalog & Subscription Agreements  
**Stage:** Stage B.1 — Independent Architecture Validation & PO Decision Review  
**Date:** November 2026  
**Final Status:** `TASK 7.2 — STAGE B.1 REVIEW COMPLETE — PRODUCT OWNER DECISIONS PENDING — IMPLEMENTATION NOT AUTHORIZED`  

---

## 1. Governance Register Overview

This governance matrix consolidates all precedent approved decisions (OD-701 through OD-720) alongside the open policy gates required for Phase 7.2 and subsequent financial phases.

> [!CRITICAL]
> **No recommendation in this register is marked as approved.** All unresolved policies and proposed decision gates are strictly classified as **PENDING PRODUCT OWNER APPROVAL**. Implementation of Stage D remains blocked until formal Product Owner sign-off is granted on the blocking decision gates.

---

## 2. Precedent Approved Foundation (OD-701 through OD-720)

| Decision ID | Summary of Approved Decision | Phase & Scope Impact |
|---|---|---|
| **OD-701** | Multi-tenant root: Institution is the primary tenant; all data models are tenant-isolated. | Mandatory foreign key `institutionId` on all Task 7.2 tables. |
| **OD-702** | Strict domain separation: Institution commercial books are separated from OX-DIGITAL SaaS billing. | Distinct chart of accounts; SaaS platform fees do not mingle with school tuition books. |
| **OD-703 / OD-718** | Platform Super-Admin separation: Super-admin manages platform; tenant `PRIMARY_MANAGER` manages school. | Super-admin cannot publish or modify institutional course prices. |
| **OD-704 / OD-705** | Double-entry accrual accounting: Invoicing creates AR & Deferred Revenue; cash receipts do not recognize revenue. | Enforced in Task 7.2 financial integration design. |
| **OD-708** | Append-only financial ledger: Physical deletion of posted transactions is prohibited; reversals only. | Enforced via soft-deletes and compensating credit notes. |
| **OD-716 / OD-717 / OD-720** | Data preservation & referential integrity: Zero data loss during migrations and backfills. | Requires non-breaking 3-phase rollout strategy. |
| **OD-719** | Parameterized Branch dimension: Online educational services modeled as `Branch.isOnline: true`. | Enforced in `BranchPriceOverride` and revenue attribution. |

---

## 3. Product Owner Decision Matrix (Stage B.1 Review)

| Decision ID | Precedent / Linked Policy | Unresolved Policy Dilemma | Proposed Engineering Recommendation | Financial, Operational & Technical Consequences | Blocks Stage D? | Required Evidence or Professional Review |
|---|---|---|---|---|---|---|
| **OD-721** | UP-709 | Who holds authority to publish and alter catalog prices and campus overrides? | **Option A (Recommended):** Sole authority held by tenant `PRIMARY_MANAGER`. Branch staff have zero write access. | **Financial:** Protects margins against unapproved campus discounting.<br>**Operational:** Branch staff must request central approval.<br>**Technical:** Simple, robust RBAC assertion. | **YES** | Product Owner formal sign-off. |
| **OD-722** | UP-714 | How are prepaid center session packages recognized and do unused sessions expire at `endsAt`? | **Option A (Recommended):** Straight-line recognition per attended session; unconsumed sessions expire and clear deferred liability at `endsAt`. | **Financial:** Predictable revenue realization aligned with academic term boundaries.<br>**Operational:** Requires prompt attendance logging.<br>**Technical:** Scheduled expiration job clearing deferred revenue. | **YES** | Product Owner formal sign-off. |
| **OD-723** (New) | Stage B Review | Does mutating `PriceVersion.effectiveTo` violate historical immutability? | **Option B (Recommended):** Adopt Pure Append-Only versioning (no `effectiveTo` column; active version resolved by `MAX(versionNumber) WHERE effectiveFrom <= now`). | **Financial:** Guarantees 100% cryptographic auditability of published historical rates.<br>**Operational:** Prevents version collision.<br>**Technical:** Replaces in-place row update with clean append-only inserts. | **YES** | Technical Architecture Review. |
| **OD-724** (New) | Stage B Review | How long should legacy grandfathered enrollments retain valid LMS access? | **Option A (Recommended):** Fixed grace deadline (e.g. end of current academic semester); mirrored as `SubscriptionAgreement` records with explicit `endsAt`. | **Financial:** Eliminates perpetual free access leakage.<br>**Operational:** Students must renew under new pricing catalog for subsequent terms.<br>**Technical:** Eliminates open `CourseEnrollment` fallback query in `checkLmsAccess`. | **YES** | Product Owner formal sign-off & Academic Calendar. |
| **UP-702** | Master Plan | Is the institution subject to Egyptian VAT (Law 67/2016) and ETA e-invoicing/e-receipt mandates? | **Option C (Recommended):** Multi-category tax engine supporting exempt, standard 14% VAT, and zero-rated items based on verified tax legal opinion. | **Financial:** Eliminates tax compliance penalties and ETA fines.<br>**Operational:** Invoicing requires ETA UUID generation and National ID tracking.<br>**Technical:** Task 7.3 Invoicing must support tax lines and ETA JSON schema. | No (Blocks Task 7.3) | Written Legal/Tax Opinion from Egyptian Tax Counsel. |
| **UP-706** | Master Plan | What is the refund penalty and administrative fee structure for subscription cancellations? | **Option A:** Full refund within 14 days minus 50 EGP administrative fee (subject to content access limits). | **Financial:** Recovers payment gateway transaction overhead.<br>**Operational:** Staff reviews student usage before approval.<br>**Technical:** Automated split credit note and refund journal generation. | No (Blocks Task 7.4) | Product Owner approval & Egyptian Consumer Protection Law review. |
| **UP-707** | Master Plan | What is the institutional fiscal year boundary and period closing policy? | **Option C:** Parameterized per institution (`Institution.fiscalYearStartMonth`) supporting both July–June and Jan–Dec. | **Financial:** Supports international schools and standard national curricula.<br>**Operational:** Automated monthly/annual period lock.<br>**Technical:** Dynamic accounting calendar generator in Task 7.5. | No (Blocks Task 7.5) | Product Owner formal sign-off. |
| **UP-709** | Master Plan | What are the role thresholds for manual financial actions (discounts, adjustments)? | **Option A:** Primary Manager dual-approval required for discounts > 10% or adjustments > 500 EGP. | **Financial:** Prevents internal fraud and rogue discounting.<br>**Operational:** Minor approval delay on edge cases.<br>**Technical:** Maker-Checker approval workflow engine. | No (Blocks Task 7.3 & 7.5) | Product Owner formal sign-off. |
| **UP-712** | Master Plan | Is multi-currency enabled, and how are FX gains/losses treated? | **Option A:** Single base currency (`EGP`) for initial launch; foreign cards settled via gateway at checkout spot rate. | **Financial:** Eliminates FX balance sheet volatility and ledger revaluation complexity.<br>**Operational:** Simplified student billing.<br>**Technical:** Data models store ISO-4217 code (`VarChar(3)`) for future extensibility. | No (Informs Schema) | Product Owner formal sign-off. |
| **UP-714** | Master Plan | What is the valuation formula for hybrid physical + digital packages? | **Option A:** Discrete unbundled line items (e.g. 60% physical lab / 40% digital platform). | **Financial:** Accurate campus P&L attribution and tax separation.<br>**Operational:** Branch managers held accountable for campus-specific costs.<br>**Technical:** Itemized agreements with dual revenue amortization schedules. | No (Blocks Task 7.3 & 7.5) | Product Owner formal sign-off. |
| **UP-715** | Master Plan | How does user deletion interact with statutory 5-to-10-year financial record retention? | **Option A:** Anonymize/scrub user PII while preserving immutable `userId` foreign key on financial records. | **Financial:** Defends against tax audit penalties.<br>**Operational:** Complies with Egyptian Personal Data Protection Law (Law 151/2020).<br>**Technical:** Automated PII scrubbing batch script. | No (Blocks Task 7.7) | Egyptian Legal Counsel Data Protection Review. |

---

## 4. Minimum Decision Gate Checklist for Stage D Authorization

To unlock Stage D implementation for Task 7.2, the Product Owner must formally sign off on the four **Stage D Blocking Gates**:

```
[ ] OD-721: Catalog Management Authority (Primary Manager Sole Approver)
[ ] OD-722: Physical Session Package Valuation & Expiration Policy
[ ] OD-723: PriceVersion Immutability Protocol (Pure Append-Only vs Controlled Update)
[ ] OD-724: Legacy Enrollment Grandfathering Deadline & Transition Strategy
```

---

## 5. Mandatory Final Status Declaration

```
TASK 7.2 — STAGE B.1 REVIEW COMPLETE — PRODUCT OWNER DECISIONS PENDING — IMPLEMENTATION NOT AUTHORIZED
```

