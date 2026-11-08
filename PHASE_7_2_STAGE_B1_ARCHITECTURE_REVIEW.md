# Phase 7.2 — Stage B.1: Architecture Validation
## Document 1: Independent Architecture & Data Model Review

**Workspace:** `D:\OX-DIGITAL\Mathe\OX-DIGITAL-GITHUB`  
**Git Repository:** `https://github.com/hosamsamer019/ox-digital-Education.git`  
**Git HEAD:** `0500b93e65c24ed881349c4acea7f523332c5e9f` on branch `main`  
**Phase:** 7.2 — Pricing Catalog & Subscription Agreements  
**Stage:** Stage B.1 — Independent Architecture Validation & PO Decision Review  
**Date:** November 2026  
**Status:** DESIGN REVIEW ONLY — IMPLEMENTATION NOT AUTHORIZED  

---

## 1. Executive Summary & Review Scope

This independent technical review rigorously assesses the proposed Stage B architecture for Phase 7.2 (Pricing Catalog & Subscription Agreements). The review evaluates data modeling, immutability guarantees, temporal versioning mechanisms, relational integrity, migration feasibility, and upstream dependencies on Task 7.1.

### Primary Architectural Findings:
1. **Model Soundness:** The proposed models correctly establish `Institution` as the multi-tenant root (OD-701) and properly attribute operations to physical campuses and parameterized online branches (`isOnline: true`, OD-719).
2. **Critical Immutability Dilemma (`PriceVersion.effectiveTo`):** In Stage B Document 1, superseding an active price version proposes updating `effectiveTo = new.effectiveFrom - 1 second` on the existing row. This technical review identifies that **mutating an existing published record violates strict write-once immutability** and proposes two hardened bitemporal alternatives.
3. **Entity Rationalization (`SubscriptionRenewal`):** The proposed `SubscriptionRenewal` entity introduces functional redundancy with downstream Task 7.3 `Invoice` and recurring billing schedules. It should be refactored into a lightweight schedule pointer or consolidated into Task 7.3.
4. **PostgreSQL Extension Dependency (`btree_gist`):** The proposed GIST temporal exclusion constraint requires the PostgreSQL `btree_gist` extension, which requires administrative database extension privileges in production environments.
5. **Upstream Task 7.1 Staging Prerequisite:** While Task 7.1 codebase remediation is verified with 74 passing tests, the Prisma migration (`20261102_task_7_1_institution_branch_foundation`) and offline backfill script have **not** been executed in staging. Task 7.2 deployment remains strictly blocked.

---

## 2. In-Depth Data Model Validation

### 2.1 Entity Inventory & Architectural Evaluation

| Proposed Model | Genuinely Necessary? | Relational Integrity & Key Constraints | Architectural Assessment & Findings |
|---|---|---|---|
| **`PriceCatalog`** | **Yes** | Scoped to `institutionId`. `@@unique([institutionId, code])`. Restrict on delete. | Clean root container for institutional offerings. Supports default catalogs and currency specification. |
| **`PriceCatalogItem`** | **Yes** | FK to `catalogId` and optional `courseId`. `@@unique([catalogId, itemCode])`. | Correctly separates course offerings from non-course institutional fees (e.g. lab fees, textbooks, registration). |
| **`PriceVersion`** | **Yes** | FK to `catalogItemId`. `Decimal(12,2)` base price. `versionNumber` sequential. | Essential for price versioning. Requires resolution of the `effectiveTo` in-place update dilemma (see Section 2.2). |
| **`BranchPriceOverride`** | **Yes** | FK to `catalogItemId` and `branchId`. `@@unique([catalogItemId, branchId, effectiveFrom])`. | Necessary to support physical campus differentials and the virtual branch dimension (OD-719). |
| **`SubscriptionAgreement`** | **Yes** | FK to `institutionId`, `studentId`, `branchId`, `courseId`, `priceVersionId`. | Core commercial contract. Enforces 7-stage state machine. Replaces naive perpetual enrollments. |
| **`AgreementPriceSnapshot`** | **Yes** | 1:1 with `SubscriptionAgreement`. `termsHash` SHA-256. `Decimal(12,2)`. | **Architecturally critical.** Freezes exact commercial terms, insulating agreements from future catalog price increases. |
| **`AgreementLifecycleEvent`** | **Yes** | Append-only event log. FK to `agreementId`. Timestamped. | Meets financial auditability requirements (OD-708). Guarantees complete contract transition provenance. |
| **`SubscriptionRenewal`** | **Questionable / Redundant** | FK to `agreementId`. Stores `billedAmount`, `invoiceId`, `periodStart`, `periodEnd`. | **Redundancy Identified:** Overlaps heavily with `Invoice` (Task 7.3) and agreement renewal state. See Section 2.3. |
| **`SessionPackage`** | **Yes** | FK to `institutionId`, `agreementId`, `studentId`, `branchId`. | Essential for physical center prepaid attendance bundles. Separates purchased entitlement from attendance. |
| **`SessionConsumption`** | **Yes** | 1:1 optional FK with `Attendance`. `@@unique([attendanceId])`. | Crucial separation between pedagogical presence (`Attendance`) and financial session deduction (`SessionConsumption`). |
| **`SessionAdjustment`** | **Yes** | Append-only ledger for manual grants, refunds, or expirations. | Ensures session count adjustments are fully auditable with mandatory staff authorization tracking. |

---

### 2.2 Critical Immutability Analysis: The `PriceVersion.effectiveTo` Mutation Dilemma

In Stage B Document 1 (Section 4), the proposed version supersession protocol states:
> *"Publishing a new version with an indefinite `effectiveTo` automatically sets the preceding active version's `effectiveTo = new.effectiveFrom - 1 second` and marks it `SUPERSEDED`."*

#### The Architectural Conflict:
- **Intended Invariant:** Published financial rates must be historically immutable.
- **The Defect:** Executing `UPDATE price_versions SET effective_to = ..., status = 'SUPERSEDED' WHERE id = ...` mutates an existing published database row. If a database row can be updated in place, cryptographic row hashes and audit checksums fail validation.
- **Comparative Analysis of Solutions:**

```
Option 1: In-Place Mutation with Field-Level Audit (Stage B Proposal)
  - Modifies existing row's effectiveTo and status.
  - Generates PriceVersionLifecycleEvent(SUPERSEDED).
  - PRO: Simple query semantics (WHERE date BETWEEN effectiveFrom AND effectiveTo).
  - CON: Violates pure write-once immutability; risk of concurrent update collisions.

Option 2: Pure Append-Only Publication Ledger (Recommended Architecture)
  - PriceVersion records are 100% write-once (basePrice, effectiveFrom, versionNumber).
  - No effectiveTo column on PriceVersion.
  - Active version resolution is determined by:
    MAX(versionNumber) WHERE effectiveFrom <= :targetDate
  - When a new version is published, it is simply inserted.
  - PRO: Absolute immutability. Zero updates to published rows. Perfect auditability.
  - CON: Range-based historical queries require subqueries or window functions (LEAD/LAG).

Option 3: Separate Temporal Activation Schedule Table
  - PriceVersion stores immutable pricing template.
  - PriceScheduleActivation stores effective intervals: (id, versionId, activeFrom, activeTo).
  - Only the schedule table undergoes interval closing.
```

> [!IMPORTANT]
> **Technical Recommendation for Stage C/D:** Adopt **Option 2 (Pure Append-Only)** or formalize **Option 1 with strict row-version locks** and explicit Product Owner acknowledgment that `effectiveTo` is a lifecycle metadata field rather than a commercial term.

---

### 2.3 Rationalization of `SubscriptionRenewal`

The proposed `SubscriptionRenewal` model records `periodStart`, `periodEnd`, `billedAmount`, and `invoiceId`. 

#### Analysis of Redundancy:
- When Task 7.3 (Invoicing & Billing Schedules) is implemented, every recurring billing cycle generates an `Invoice` record containing:
  - `billingPeriodStart` and `billingPeriodEnd`
  - `totalAmount`
  - `agreementId`
- Maintaining both `SubscriptionRenewal` and `Invoice` creates dual-record synchronization hazards:
  - What happens if `SubscriptionRenewal.billedAmount` diverges from `Invoice.totalAmount`?
  - What if the invoice is voided or reissued under a credit note?

#### Recommendation:
- Eliminate `SubscriptionRenewal` as an independent persistent table, OR refactor it into a lightweight **Agreement Billing Schedule Generator** within Task 7.3.
- Agreement renewals should simply increment a counter (`SubscriptionAgreement.currentCycleNumber`) and update `SubscriptionAgreement.nextBillingDate`, while the formal financial record resides in `Invoice`.

---

### 2.4 Decimal Precision & Banker's Rounding Verification

- **Storage:** `Decimal(12,2)` provides exact 2-decimal monetary storage up to $9,999,999,999.99$.
- **Precision Validation:** In Node.js services, intermediate calculations (such as prorated daily rates: $\text{monthlyFee} \div 30$) can generate fractional cents/piastres.
- **Rule Enforcement:** 
  - Intermediate prorations must maintain at least 4 decimal places of internal precision using `decimal.js`.
  - Half-Even Rounding (Banker's Rounding) must be applied **only** to the final invoice line total to prevent rounding creep.

---

### 2.5 PostgreSQL Extension & Constraint Viability

The proposed exclusion constraint:
```sql
ALTER TABLE price_versions 
ADD CONSTRAINT exclude_overlapping_versions 
EXCLUDE USING gist (
  catalog_item_id WITH =, 
  tsrange(effective_from, COALESCE(effective_to, 'infinity'::timestamp)) WITH &&
) WHERE (status = 'ACTIVE');
```
- **Validation Finding:** PostgreSQL cannot build a GiST index on `catalog_item_id` (a UUID/text column) without the `btree_gist` extension.
- **Action Required:** Stage D migration SQL must explicitly include `CREATE EXTENSION IF NOT EXISTS "btree_gist";`.

---

## 3. Migration & Rollout Strategy Validation

### 3.1 Analysis of Authoritative Sources Across Cutover Phases

```
+-----------------------------------------------------------------------------------+
| PHASE 1: DUAL-READ                                                                |
| Authoritative Source: Legacy Course.price & CourseEnrollment                      |
| Shadow Destination:   PriceCatalog, PriceVersion, SubscriptionAgreement           |
| Conflict Risk: Low. Shadow writes failures do not break production checkout.     |
+-----------------------------------------------------------------------------------+
                                         │
                                         ▼
+-----------------------------------------------------------------------------------+
| PHASE 2: DUAL-WRITE                                                               |
| Authoritative Source: PriceCatalog & SubscriptionAgreement                        |
| Secondary Target:     CourseEnrollment & Course.price (Legacy clients)            |
| Conflict Risk: HIGH. Dual-write divergence if legacy endpoint bypasses catalog.  |
+-----------------------------------------------------------------------------------+
                                         │
                                         ▼
+-----------------------------------------------------------------------------------+
| PHASE 3: FINAL CUTOVER                                                            |
| Authoritative Source: PriceCatalog & SubscriptionAgreement Sole Authority         |
| Legacy Status:        Course.price marked @deprecated. Adapters deleted.          |
+-----------------------------------------------------------------------------------+
```

### 3.2 Duplicate Financial Event Risks & Mitigation
- **Webhook Retry Storms:** Gateway retries can hit during database serialization delays. Mitigation: Database-level unique constraint on `payment_transactions(gateway_transaction_id)` combined with Redis distributed locks.
- **Concurrent Checkout Double-Billing:** Two tabs opened by the student submitting checkout concurrently. Mitigation: Draft agreement price snapshot holds an exclusive lock; only one transition from `DRAFT` to `PENDING` is permitted.

### 3.3 Upstream Task 7.1 Staging Prerequisite Verification
- Task 7.1 codebase remediation is complete and verified locally.
- **However:** No migrations have been deployed to staging or production.
- **Hard Blocker:** Task 7.2 migrations depend structurally on `Institution.id` and `Branch.id` existing in the physical PostgreSQL schema. Attempting to deploy Task 7.2 without Task 7.1 staging execution will immediately fail on foreign-key constraint creation.

---

## 4. Conclusion & Stage B.1 Recommendation

The core entity structures for Phase 7.2 are robust, logically partitioned, and align with institutional tenant boundaries. Prior to Stage D implementation:
1. Resolve the `effectiveTo` immutability protocol (adopt pure append-only versioning or row-locked valid-time closing).
2. Refactor `SubscriptionRenewal` to avoid duplicate bookkeeping with Task 7.3 `Invoice`.
3. Include `CREATE EXTENSION IF NOT EXISTS btree_gist;` in migration planning.
4. Maintain a strict deployment hold until Task 7.1 staging migration and backfill benchmarks are formally signed off.

