# OX-DIGITAL Education
# Task 7.2 — Product Owner Decision Register
## Revision: B.3 — Canonical Decision Register & Status Reconciliation

**Workspace:** `D:\OX-DIGITAL\Mathe\OX-DIGITAL-GITHUB`  
**GitHub Repository:** `https://github.com/hosamsamer019/ox-digital-Education.git`  
**Current Git HEAD:** `0500b93e65c24ed881349c4acea7f523332c5e9f` (branch `main`)  
**Status:** Canonical Decision Register — Reconciled Statuses & Policy Open Gates  
**Implementation Authorization:** STRICTLY NOT GRANTED  
**Database/Migration Authorization:** STRICTLY NOT GRANTED  
**Date:** November 2026  

---

## 1. Governance Preamble & Status Definitions

This register represents the **canonical source of truth** for all architectural and policy decisions in Phase 7.2. 

To maintain strict regulatory, financial, and architectural discipline, every decision is assigned an explicit governance status:
- **`APPROVED_BY_PRODUCT_OWNER`**: Formally approved by executive sign-off. Authoritative and immutable.
- **`PROVISIONAL_PRODUCT_OWNER_SELECTION`**: Selected in principle by the Product Owner; pending technical validation, parameters resolution, or formal Stage C sign-off.
- **`PROPOSED_TECHNICAL_DECISION — PENDING EXPLICIT PRODUCT OWNER APPROVAL`**: Recommended by engineering/architecture; **NOT** approved by the Product Owner.
- **`OPEN_POLICY_GATE — UNRESOLVED`**: Policy question awaiting executive determination or external specialized counsel (tax, legal, accounting).

---

## 2. Reconciled Task 7.2 Decisions (OD-721 through OD-726)

### OD-721 — Pricing Management Authority
- **Canonical Decision Value:** `PRIMARY_MANAGER_ONLY`
- **Governance Status:** `PROVISIONAL_PRODUCT_OWNER_SELECTION`
- **Scope & Specification:**
  - Only the institution's designated `Primary Manager` holds authority to create, edit drafts, publish, supersede, or retire pricing versions.
  - Branch staff have zero pricing publication or modification authority.
  - No delegated pricing authority is included in the initial release.
  - SaaS Platform Super-Admin (`admin@edu.com`) remains strictly separate from institutional financial administration (OD-703, OD-718).
  - Every pricing operation must record the responsible user ID and timestamp.
- **Pending Actions:** Final verification of route-level and service-level RBAC guards in Stage D.

---

### OD-722 — Physical Session Package Consumption
- **Canonical Decision Value:** `ATTENDANCE_BASED_CONSUMPTION`
- **Governance Status:** `PROVISIONAL_PRODUCT_OWNER_SELECTION`
- **Scope & Specification:**
  - A prepaid physical session is consumed strictly upon recorded valid attendance (`status == 'PRESENT'`).
  - Absence (`ABSENT_EXCUSED` or `ABSENT_UNEXCUSED`) does **not** automatically consume a session.
  - Attendance corrections and reversals must be auditable (compensating adjustments).
  - Duplicate attendance records must not consume multiple sessions (idempotency via unique index on `attendanceId`).
  - Session consumption is institution-scoped.
- **Explicitly Unresolved Parameters (Pending PO Policy):**
  - Whether unused sessions expire at `endsAt` or carry over perpetually.
  - Whether unused sessions are refundable upon course withdrawal.
  - Whether make-up sessions are permitted.
  - Treatment of late attendance and class cancellations.
  - Valuation formula and revenue recognition timing for prepaid packages.

---

### OD-723 — Price Version Immutability
- **Canonical Decision Value:** `PURE_APPEND_ONLY_VERSIONING`
- **Governance Status:** `PROPOSED_TECHNICAL_DECISION — PENDING EXPLICIT PRODUCT OWNER APPROVAL`
- **Scope & Specification:**
  - *Engineering Proposal:* Published price versions must not be modified in place. Price modifications create new sequential version rows.
  - There is zero `effectiveTo` column on `PriceVersion`; versions remain write-once.
  - Existing accepted agreements retain their original immutable price snapshots (`AgreementPriceSnapshot`).
  - Price resolution is reproducible via `ORDER BY effective_from DESC, version_number DESC LIMIT 1`.
- **CRITICAL GOVERNANCE NOTE:** The Product Owner has **NOT** explicitly approved OD-723. It remains an engineering design proposal awaiting formal Product Owner determination.

---

### OD-724 — Legacy Enrollment Transition
- **Canonical Decision Value:** `FIXED_TRANSITION_GRACE_PERIOD`
- **Governance Status:** `PROVISIONAL_PRODUCT_OWNER_SELECTION — PARAMETERS UNRESOLVED`
- **Scope & Specification:**
  - Eligible legacy enrollments receive a defined transition grace period.
  - During the grace period, legacy access is maintained under a controlled transition policy.
  - Legacy enrollments must be mapped to valid institution-owned records (completed via Task 7.1 backfill) before conversion.
  - **Zero Synthetic Entities:** No synthetic institutions, branches, students, or agreements may be created. Quarantined records remain in cold archive (OD-720).
  - After the approved grace deadline, access requires a valid `SubscriptionAgreement`.
- **Explicitly Unresolved Parameters (Pending PO Policy):**
  - Exact duration of the grace period (e.g. 60 days, 90 days, or end of academic semester).
  - Grace period start-date definition.
  - Exact deadline calculation formula.
  - Treatment of students with ambiguous or unmapped legacy records.
  - Exception approval authority.

---

### OD-725 — Initial Currency Policy
- **Canonical Decision Value:** `EGP_ONLY_INITIAL_RELEASE`
- **Governance Status:** `PROVISIONAL_PRODUCT_OWNER_SELECTION`
- **Scope & Specification:**
  - Initial pricing, checkouts, and agreements are denominated exclusively in Egyptian Pound (`EGP`).
  - Currency must be explicitly stored as an ISO-4217 code (`VarChar(3)`) across all monetary tables.
  - No implicit foreign-exchange conversion is permitted in the system.
  - Schema preserves compatibility for future multi-currency enablement (UP-712).
- **CRITICAL GOVERNANCE NOTE:** Provisional selection for launch; future multi-currency approval is **not** inferred.

---

### OD-726 — Subscription Renewal Model
- **Canonical Decision Value:** `NEW_AGREEMENT_PER_RENEWAL`
- **Governance Status:** `PROVISIONAL_PRODUCT_OWNER_SELECTION`
- **Scope & Specification:**
  - Every renewal generates a distinct successor `SubscriptionAgreement`.
  - The new agreement maintains a self-referencing link (`previousAgreementId`).
  - Each renewal carries its own immutable price snapshot and service term.
  - Renewal does not overwrite or mutate historical agreement records.
  - Idempotency is enforced via `@@unique([previousAgreementId, renewalCycleNumber])`.
- **Explicitly Unresolved Parameters (Pending PO Policy):**
  - Whether renewal requires explicit student/parent acceptance or supports automated opt-in.
  - Whether current catalog price or locked initial price applies upon renewal.
  - Permitted early-renewal window before term expiration.
  - Grace-period and late-payment interaction.

---

## 3. Authoritative Approved Precedents (OD-701 through OD-720)

The following precedent decisions remain fully authoritative and binding:

| Decision ID | Canonical Topic | Approved Core Policy |
|---|---|---|
| **OD-701** | Multi-Tenant Root | Institution is the primary tenant; all data models are tenant-isolated. |
| **OD-702** | Domain Separation | Strict separation between SaaS platform commercial books and Institution financial accounts. |
| **OD-703** | Ledger Architecture | One institutional general ledger with branch dimension tagging. |
| **OD-704** | Accounting Method | Accrual accounting; double-entry bookkeeping. |
| **OD-705** | Online Revenue Recognition | Amortized straight-line over service period; unearned revenue deferred. |
| **OD-706** | Physical Package Principles | Attendance-based consumption; scheduled absence does not consume sessions. |
| **OD-708** | Auditability & Reversals | Posted transactions are immutable; reversals via credit notes only; no physical deletion. |
| **OD-716** | Backfill Architecture | Alternative B: Authoritative Full Offline Backfill during maintenance window. |
| **OD-717** | Maintenance Window | Approved in principle; duration determined by Staging benchmarks. |
| **OD-718** | Primary Manager Identity | Dedicated verified invitation flow; `admin@edu.com` is SaaS Super-Admin only. |
| **OD-719** | Online Dimension | Parameterized `Branch` with `isOnline = true` representing digital education. |
| **OD-720** | Quarantine Strategy | Option 7D: Indefinite cold archival for unresolvable legacy records. |

---

## 4. Comprehensive Open Decisions Register (Pending Action)

| Decision Item | Open Policy Question | Required Action & Authority | Blocking Status |
|---|---|---|---|
| **OD-722** | Expiration, refundability, make-up sessions for prepaid packs | Product Owner policy choice | Blocks Stage D Package Engine |
| **OD-723** | Pure Append-Only versioning vs Controlled Valid-Time update | Product Owner formal determination | Blocks Stage D Schema Definition |
| **OD-724** | Grace period duration, start date, and deadline formula | Product Owner policy choice | Blocks Stage D Migration Backfill |
| **OD-726** | Renewal acceptance workflow and renewal pricing rules | Product Owner policy choice | Blocks Stage D Renewal Service |
| **UP-702** | Egyptian VAT applicability (Law 67/2016) & ETA e-invoicing | Egyptian Tax Specialist legal opinion | Blocks Task 7.3 Invoicing |
| **UP-706** | Subscription cancellation refund windows and admin fees | Product Owner + Legal review | Blocks Task 7.4 Payments |
| **UP-707** | Institutional fiscal year calendar (Jan–Dec vs July–June) | Product Owner policy choice | Blocks Task 7.5 General Ledger |
| **UP-709** | Staff financial thresholds and dual approval (Maker-Checker) | Product Owner policy choice | Blocks Task 7.3 & 7.5 |
| **UP-712** | Multi-currency roadmap & FX gain/loss treatment | Deferred until international expansion | Informs Schema ISO compatibility |
| **UP-713** | Institution legal entity structure (commercial vs non-profit) | Legal/Accounting review | Informs Tax Profile |
| **UP-714** | Hybrid package valuation & branch revenue split | Accounting policy determination | Blocks Task 7.3 & 7.5 |
| **UP-715** | User deletion lifecycle vs 5–10 year financial retention | Egyptian Data Protection (Law 151/2020) review | Blocks Task 7.7 Auditing |
| **UP-701** | Statutory standard chart of accounts | Certified Egyptian Accountant | Blocks Task 7.5 General Ledger |

---

## 5. Explicit Governance Declaration

```
TASK 7.2 STAGE B.3 — DOCUMENTATION AND EVIDENCE REVIEW ONLY — NO IMPLEMENTATION AUTHORIZED
```

