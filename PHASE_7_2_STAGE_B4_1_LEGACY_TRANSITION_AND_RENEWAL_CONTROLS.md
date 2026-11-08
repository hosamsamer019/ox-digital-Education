# Phase 7.2 — Stage B.4.1: Operational & Contract Controls
## Critical Reconciliation: Legacy Transition Lifecycle & Subscription Renewal Controls

**Workspace:** `D:\OX-DIGITAL\Mathe\OX-DIGITAL-GITHUB`  
**Git Repository:** `https://github.com/hosamsamer019/ox-digital-Education.git`  
**Git HEAD:** `0500b93e65c24ed881349c4acea7f523332c5e9f` (branch `main`)  
**Phase:** 7.2 — Pricing Catalog & Subscription Agreements  
**Stage:** Stage B.4.1 — Policy Reconciliation, Financial Rules & Architecture Refinement  
**Date:** November 2, 2026  
**Final Status:** `TASK 7.2 STAGE B.4.1 — DOCUMENTATION-ONLY POLICY RECONCILIATION — NO SOURCE, SCHEMA, DATABASE OR MIGRATION AUTHORIZATION`  

---

## 1. Critical Reconciliation C: Legacy Grace Period & Activation Event (OD-724)

Under provisional decision **OD-724**, eligible legacy enrollments receive a **60 calendar day transition grace period** terminating in an automated hard access cutoff. 

To prevent premature countdown triggers or unauthorized access disruption, the architecture strictly distinguishes between backend migration activities and official institution activation.

```
[ Phase 1: Migration Preparation ] ──► (Offline backup, staging benchmark verification)
                 │
                 ▼
[ Phase 2: Migration Execution ] ────► (Task 7.1 DDL applied to PostgreSQL schema)
                 │
                 ▼
[ Phase 3: Backfill Execution ] ─────► (Authoritative Alternative B offline backfill script)
                 │
                 ▼
[ Phase 4: Validation & Audit ] ─────► (28-model reconciliation, referential integrity check)
                 │
                 ▼
[ Phase 5: Official Institution Activation ] ──► (Explicit institutionMigrationActivatedAt Event)
                 │
                 ▼
[ Phase 6: Grace Period Commencement ] ────────► (60-day countdown begins: T_activation + 60 days)
```

---

### 1.1 The Six Mandatory Activation Prerequisites

Under no circumstances does the 60-day transition grace period begin merely because a database migration command was run or backfill script commenced. 

The official activation event (`institutionMigrationActivatedAt`) can **only** be triggered when the following six verification gates are satisfied:

| Prerequisite Gate | Verification Standard | Evidence Required |
|---|---|---|
| **1. Task 7.1 Migration Applied** | `20261102_task_7_1_institution_branch_foundation` applied to physical database without error. | Query `_prisma_migrations` confirms `finished_at IS NOT NULL`. |
| **2. Authoritative Backfill Complete** | `scripts/backfill_task_7_1_tenancy.ts` executed completely. | Zero unmapped active student records in live tables. |
| **3. Full Reconciliation Passed** | All 28 data models verified with zero cross-tenant orphaned records. | Audit verification script output logged. |
| **4. Tenant & Branch Ownership Valid** | Every student, course, and enrollment assigned valid `institutionId`. | `SELECT COUNT(*) FROM courses WHERE institution_id IS NULL` returns 0. |
| **5. Access Control Validated** | Tenant isolation middleware and guards passed automated verification tests. | 74 Task 7.1 security and unit tests passing in staging. |
| **6. Explicit Activation Event Logged** | Primary Manager or authorized administrator executes formal activation command. | Record inserted in `InstitutionAuditLog` with explicit UTC timestamp. |

---

### 1.2 Unambiguous Cutoff Convention & Timezone Standards

1. **Exact 60-Day Duration:**
   $$\text{gracePeriodEndsAt} = \text{institutionMigrationActivatedAt} + 60 \text{ calendar days} \quad (5,184,000 \text{ seconds})$$
2. **Universal Time Storage (UTC):**
   - The timestamp `gracePeriodEndsAt` is stored strictly as an ISO-8601 UTC timestamp in PostgreSQL (`timestamp with time zone`).
   - Server-local operating system timezones are strictly ignored to prevent clock-skew discrepancies across distributed container clusters.
3. **Deterministic Boundary Comparison:**
   - In `checkLmsAccess`, access is evaluated using standard UTC comparison:
     $$\text{Access Permitted} \iff \text{now()}_{\text{UTC}} \le \text{gracePeriodEndsAt}_{\text{UTC}}$$
   - At $\text{gracePeriodEndsAt} + 1 \text{ second}$, access is denied automatically by the LMS gatekeeper.
4. **Temporary Platform Outage Policy (Open Policy Question):**
   - *Status:* **PENDING_PRODUCT_OWNER_CLARIFICATION**.
   - If the platform experiences a major infrastructure outage during the 60-day window, does the deadline automatically extend, or does it remain fixed? The architecture maintains a **fixed deadline default** with zero automatic extensions until the Product Owner explicitly authorizes an outage-extension policy.
5. **Controlled Manual Exception Path:**
   - An administrator cannot arbitrarily bypass the cutoff in code.
   - Any individual student grace extension requires explicit Primary Manager authorization logged in `AgreementLifecycleEvent(type: 'EXCEPTION_EXTENSION', authorizedBy: managerUserId, reason: '...')`.
6. **Unmapped Records Quarantine:**
   - Unmapped or ambiguous legacy records remain permanently quarantined in cold archive (OD-720).
   - Zero synthetic institutions or phantom branches are created under any circumstances.

---

## 2. Critical Reconciliation D: Subscription Renewal Controls (OD-726)

Under provisional decision **OD-726**, subscription renewals operate on the principle of **`NEW_AGREEMENT_PER_RENEWAL`**, creating successor contracts while preserving historical contract immutability.

### 2.1 The Eight Decoupled Stages of the Renewal Lifecycle

To prevent unauthorized customer billing and ensure legal enforceability, the renewal lifecycle is partitioned into eight distinct, sequential stages:

```
[ Stage 1: Explicit Consent & Opt-In ] ──► (Recorded at initial checkout; termsHash stored)
                 │
                 ▼
[ Stage 2: Renewal Notification Window ] ─► (Customer notified e.g. 7 days prior to renewal)
                 │
                 ▼
[ Stage 3: Current Price Disclosure ] ───► (Active catalog price transparently disclosed)
                 │
                 ▼
[ Stage 4: Successor Agreement Creation ] ► (DRAFT successor created; linked to previousAgreementId)
                 │
                 ▼
[ Stage 5: Payment Authorization ] ──────► (Gateway token charged or cashier collection)
                 │
                 ▼
[ Stage 6: Settlement Verification ] ────► (Success: ACTIVE; Failure: PENDING / SUSPENDED)
                 │
                 ▼
[ Stage 7: Contiguous Service Extension ] ─► (newAgreement.startsAt = currentAgreement.endsAt)
                 │
                 ▼
[ Stage 8: Opt-Out / Cancellation ] ─────► (Customer may cancel auto-renew at any time)
```

---

### 2.2 Technical Safeguards & Anti-Tampering Rules

1. **Storage of Explicit Consent Evidence:**
   - Recurring auto-renewal is enabled **only** if the customer explicitly checked an affirmative opt-in checkbox during checkout (OD-726.1).
   - The system records: `consentTimestamp`, `consentActorId`, `consentIpAddress`, and `termsVersionHash`. Pre-ticked checkboxes are prohibited.
2. **Changed-Price Disclosure & Re-Consent Policy (Open Policy Gate):**
   - *Status:* **PENDING_PRODUCT_OWNER_CLARIFICATION**.
   - Under OD-726.2, renewals apply the *current published catalog price*. 
   - *Critical Consumer Safeguard:* If the published price has increased since the initial checkout (e.g. tuition increased from 800 EGP to 950 EGP), the system **must not silently charge the higher amount**. The renewal worker must issue an advance price-change notification requiring explicit customer re-acknowledgment prior to billing.
3. **Idempotency & Duplicate Prevention:**
   - The database enforces a strict compound unique constraint:
     ```prisma
     @@unique([previousAgreementId, renewalCycleNumber], name: "uq_previous_agreement_cycle")
     ```
   - Worker retry storms or duplicate scheduler executions are trapped by the database, guaranteeing that exactly one successor agreement can ever exist for a given cycle.
4. **Failed Payment Isolation:**
   - If the payment transaction fails (declined card, insufficient funds), the successor agreement remains in `PENDING` status.
   - A failed payment **never** creates an active subscription or updates the student's LMS access entitlements.
5. **Contiguous Service Extension (OD-726.3):**
   - Early renewals executed prior to term expiration calculate dates contiguously:
     $$\text{newAgreement.startsAt} = \text{currentAgreement.endsAt}$$
     $$\text{newAgreement.endsAt} = \text{newAgreement.startsAt} + \text{billingCycleLength}$$
   - This mathematical invariant guarantees that the student **never loses already-paid service days** and prevents overlapping double-billed intervals.

---

## 3. Explicit Governance Statement

```
TASK 7.2 STAGE B.4.1 — DOCUMENTATION-ONLY POLICY RECONCILIATION — NO SOURCE, SCHEMA, DATABASE OR MIGRATION AUTHORIZATION
```

