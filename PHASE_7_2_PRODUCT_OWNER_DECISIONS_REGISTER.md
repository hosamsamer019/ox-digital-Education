# OX-DIGITAL Education — Phase 7.2
# Product Owner Decisions & Unresolved Policy Register
## Financial Policy Baseline, Blocker Classification & Approval Matrix

**Document ID:** `OD-7205-PO-DECISIONS-REGISTER`  
**Workspace:** `D:\OX-DIGITAL\Mathe\OX-DIGITAL-GITHUB`  
**Repository:** `https://github.com/hosamsamer019/ox-digital-Education.git`  
**Git HEAD:** `0500b93e65c24ed881349c4acea7f523332c5e9f` (Branch: `main`)  
**Audit Date:** November 2026  
**Execution Mode:** READ-ONLY (ZERO APPLICATION CODE OR DATABASE MUTATIONS)  
**Status:** **STAGE A READ-ONLY AUDIT COMPLETE — IMPLEMENTATION NOT AUTHORIZED**

---

## 1. Executive Summary

This register audits the decision landscape for **Task 7.2 (Pricing Catalog & Subscription Agreements)**. It validates the active status of previously approved Product Owner architecture decisions (OD-701 through OD-720), provides an exhaustive forensic assessment of the eight pending Unresolved Policies (UP-702 through UP-715), and classifies their severity relative to Task 7.2 Stage B modeling and subsequent Stage D implementation.

---

## 2. Approved Prerequisite Architecture Decisions

The following Product Owner decisions are formally **APPROVED** and must be strictly maintained without regression:

| Decision ID | Decision Title | Approved Standard | Direct Impact on Task 7.2 |
|---|---|---|---|
| **OD-701** | Primary Manager Governance | One educational institution has exactly one Primary Manager. Institution is the multi-tenant root. | Pricing catalogs and master agreements are governed by the Primary Manager. |
| **OD-702** | Domain Separation | Strict partition between OX-DIGITAL SaaS platform commercial books and Educational Institution books. | Student subscription agreements belong strictly to the institution's receivables, never SaaS revenue. |
| **OD-703** | Unified General Ledger | Single institutional GL with branch dimensions and Online/Head-Office attribution. | Agreements attribute revenue to specific physical branches or the Online branch dimension. |
| **OD-704** | Accrual Accounting | Financial transactions recorded when earned or incurred, not merely upon cash receipt. | Agreement execution records future receivable obligations; sets up revenue scheduling. |
| **OD-705** | Online Subscription Revenue | Online subscriptions recognized proportionally over the contracted service period; unearned is Deferred Revenue. | `SubscriptionAgreement` records exact `startsAt` and `endsAt` timestamps for daily/monthly recognition. |
| **OD-708** | Payment Deletion Invariant | Physical deletion of financial transactions is strictly prohibited. Reversals via credit notes/adjustments. | Subscription agreements and linked payments can never be deleted; cancellation updates status. |
| **OD-716** | Cutover Architecture | Alternative B — Authoritative full offline backfill protocol. | Backfill must map existing courses to pricing items without synthetic defaults. |
| **OD-717** | Maintenance Window | Approved in principle; duration determined by staging benchmarks. | Task 7.2 deployment will occur during a scheduled post-Task 7.1 maintenance window. |
| **OD-718** | Primary Manager Provisioning | Dedicated verified invitation (Option 3B); `admin@edu.com` is separate Platform Super-Admin. | Super-Admin cannot create or sign institutional student pricing agreements. |
| **OD-719** | Online Branch Dimension | Parameterized branch with `isOnline: true`. | Online distance-learning subscriptions attribute to `Branch.isOnline = true`. |
| **OD-720** | Quarantine Cold Archival | Indefinite cold archival for unresolvable legacy records in `_migration_quarantine`. | Legacy records without clear pricing or term mapping route to quarantine. |

---

## 3. Unresolved Policies Forensic Assessment & Blocker Classification

The eight unresolved financial policies are classified below into:
* **🔴 HARD BLOCKER FOR TASK 7.2:** Must be decided by the Product Owner before Task 7.2 Stage D implementation can begin.
* **🟡 DEFERRED SAFELY TO LATER TASKS:** Architectural placeholder suffices for Task 7.2; can be resolved prior to the specific downstream task.
* **🟢 FUTURE OPTIONAL CAPABILITY:** Advanced feature that does not block standard implementation.

| Policy ID | Policy Description | Impact on Task 7.2 | Severity Classification | Recommended Resolution |
|---|---|---|:---:|---|
| **UP-702** | **VAT / ETA Tax Treatment** | Egyptian tax law levies 14% VAT on general commercial services but exempts certain accredited educational tuition. Tax rates affect agreement totals if tax is inclusive/exclusive. | **🟡 DEFERRED SAFELY (to Task 7.3 Invoicing)** | Model `taxRate Decimal @default(0)` on `PriceVersion`. In Task 7.2, default to educational tax-exempt (`0%`), allowing Task 7.3 to apply formal ETA tax e-invoicing when defined. |
| **UP-706** | **Refund Fees & Withdrawal Deadlines** | Rules defining penalty deductions, administrative fees, and cutoff deadlines when a student cancels an active subscription. | **🟡 DEFERRED SAFELY (to Task 7.3 Credit Notes)** | `SubscriptionAgreement` supports `CANCELLED` status. Exact refund calculation formula is deferred to Task 7.3 credit note processing; zero physical deletion per OD-708. |
| **UP-707** | **Fiscal Year Definition** | Gregorian Calendar Year (Jan 1 – Dec 31) vs. Egyptian Academic Fiscal Year (July 1 – June 30). | **🟡 DEFERRED SAFELY (to Task 7.5 General Ledger)** | Agreements track Gregorian ISO timestamps (`startsAt`, `endsAt`). Fiscal period bucketing is handled in the general ledger (Task 7.5). |
| **UP-709** | **Staff Roles & Approval Thresholds** | Can a Branch Manager or Head of Admissions approve custom student discounts, or does every price override require the Primary Manager? | **🔴 HARD BLOCKER (for Task 7.2 Implementation)** | **Decision Required:** Authorize Primary Manager as sole pricing approver by default, with optional delegation threshold (e.g. Branch Manager up to 10% discount). |
| **UP-711** | **Opening Balances & Cutover** | Strategy for converting existing active students with unexpired access into formal `SubscriptionAgreement` records during cutover. | **🟡 DEFERRED SAFELY (to Task 7.7 Cutover)** | In Task 7.2, schema supports `MIGRATED_LEGACY` origin code. Final balance cutover rules belong to Task 7.7. |
| **UP-713** | **Legal Entity Structure** | Single legal entity encompassing all branches vs. independently registered corporate entities per branch. | **🟡 DEFERRED SAFELY (Non-blocking)** | Task 7.1 established `Institution` as the multi-tenant root with parameterized `Branch` entities. Legal entity structure does not block pricing catalog modeling. |
| **UP-714** | **Session Package Valuation Formula** | When a student purchases a 10-session pack, is revenue recognized straight-line per attended session, or does an unconsumed package expire with breakage revenue? | **🔴 HARD BLOCKER (for Task 7.2 Implementation)** | **Decision Required:** Define session pack revenue recognition: Straight-line per attended physical attendance session; unconsumed sessions expire after package validity window. |
| **UP-715** | **User Deletion & Financial Protection** | Handling student/parent profile deletion requests while preserving legally binding financial agreements. | **🟢 RESOLVED BY TASK 7.1 REMEDIATION** | Task 7.1 remediation established `onDelete: Restrict` on financial foreign keys and `deletedAt` soft deletion. Users with agreements/payments cannot be physically deleted. |

---

## 4. Minimum Product Owner Decisions Required Before Stage D

To proceed from Stage A discovery to Stage B design and Stage D implementation, the Product Owner must formally approve the following **two decisions**:

### Decision Request OD-721: Pricing Approval Authority & Delegation (UP-709)
* **Option A (Strict Centralized - RECOMMENDED):** The Primary Manager exclusively authors, edits, and approves all base prices, catalog items, and branch price overrides. Branch staff can select approved catalog items but cannot alter prices.
* **Option B (Delegated Branch Limits):** Branch Managers may propose branch overrides; overrides become active only after Primary Manager digital approval in the system.

### Decision Request OD-722: Physical Session Package Consumption Model (UP-714)
* **Option A (Session-Attended Recognition - RECOMMENDED):** Physical session packs (e.g. 10 sessions for 1,000 EGP) record 1,000 EGP as Deferred Revenue upon agreement. Revenue is recognized at 100 EGP per verified physical session attendance recorded in `Attendance`. Unconsumed sessions expire upon `endsAt` and recognize as breakage revenue.
* **Option B (Term-Based Fixed Period):** Session packs are treated as time-based monthly memberships regardless of session attendance count.

---

## 5. Audit Verdict

* **Approved Decisions (OD-701–OD-720):** 100% Intact and verified.
* **Unresolved Policies:** Fully mapped. Six policies safely deferred to downstream tasks; two policies (OD-721 and OD-722) identified as the minimum required gates for Stage D implementation.
* **Readiness:** Stage A discovery is complete. The project can safely proceed to Stage B architecture specification.

