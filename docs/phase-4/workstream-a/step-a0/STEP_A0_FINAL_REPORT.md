# OX-DIGITAL Education — Phase 4: Workstream A
## Step A0: Pre-Implementation Schema Audit & Migration Plan
### Deliverable 8: Step A0 Final Audit Report & Governance Gate Recommendation

**Workspace:** `D:\OX-DIGITAL\Mathe\OX-DIGITAL-GITHUB`  
**Target:** `docs/phase-4/workstream-a/step-a0/STEP_A0_FINAL_REPORT.md`  
**Execution Mode:** STRICTLY READ-ONLY AUDIT & IMPLEMENTATION PLANNING  
**Date:** November 4, 2026 (Final Reconciliation)  
**Author:** Lead Software Architect & Financial Systems Security Reviewer  
**Status:** COMPLETE — AWAITING PRODUCT OWNER AUTHORIZATION FOR STEP A1  

---

## 1. Executive Summary & Exact Reconciled Entity Counts

In accordance with Product Owner directives, Step A0 of Phase 4 Workstream A ("Prisma Financial Models & Schema Migration") has completed a comprehensive, strictly read-only audit of the existing Prisma schema, database migration history, shared accounting domain, and authoritative architectural baselines.

### Exact Reconciled Entity Counts & Taxonomy Disaggregation:
To eliminate arithmetic discrepancies, all counts are categorized across distinct architectural layers:

1. **Existing Prisma Schema Footprint:**
   - **Existing Models Inspected:** Exactly **31 Models**.
   - **Existing Enums Inspected:** Exactly **14 Enums**.
   - **Existing Financial Accounting Models:** Exactly **0 Models (0% Financial Persistence)**.
   - **Existing Enhanced Core Tenancy Models:** Exactly **2 Models** (`Institution`, `Branch`).
2. **Canonical Baseline Relational Tables (Phase 2.0A.3 Baseline: 20 Tables Total):**
   - **2 Pre-Existing Core Tables:** `Institution`, `Branch`.
   - **18 Missing Financial Accounting Tables:**
     - *6 Specialist-Gated Tables:* `Account`, `AccountingPeriod`, `JournalEntry`, `JournalLine` (Gated by Gate 1 `UP-701`); `TeacherCompensationAgreement`, `TeacherPayable` (Gated by `UP-704`).
     - *12 Frontline & Sub-Ledger Baseline Tables:* `StudentFinancialAccount`, `GroupPricingAgreement`, `StudentFinancialAgreement`, `StudentObligation`, `Collection`, `CollectionAllocation`, `FinancialAdjustment`, `FinancialIdempotencyRecord`, `FinancialAuditEvent`, `Cashbox`, `CashboxTransaction`, `CashboxReconciliation`.
3. **Proposed Prisma Implementation Models for Workstream A:**
   - *Direct Baseline Implementations (7 Models):* `StudentFinancialAccount`, `GroupPricingAgreement`, `Cashbox`, `DailyCashboxReconciliation`, `StudentAgreement`, `CollectionReceipt`, `PaymentAllocation`, `FinancialAdjustment`.
   - *Operational Split of Baseline Table #17 `CashboxTransaction` (3 Models — PROVISIONAL):* `CashboxMovement`, `CashboxTransferRequest`, `ExpenseVoucher`.
   - *Relational Normalization Extension (1 Model):* `PaymentScheduleItem` (implements `StudentObligation` with milestone-level state).
   - *Domain 7 Session Extensions (2 Models):* `LessonDeliveryEvidence`, `RevenueRecognitionEntry`.
   - *Dedicated Infrastructure Models (2 Models):* `FinancialIdempotencyRecord`, `FinancialAuditEvent`.
   *(Total Proposed Implementation Footprint: 15 proposed models).*
4. **Existing Core Models Requiring Additive Relations:** Exactly **4 Models** (`Institution`, `Branch`, `User`, `Lesson`) — all changes are strictly additive 1-to-many relation fields.
5. **New Enums to be Introduced:** Exactly **6 Enums** (`CashboxStatus`, `CashboxMovementType`, `TransferStatus`, `ReconciliationStatus`, `AgreementStatus`, `PaymentAllocationMethod`).

---

## 2. Canonical-to-Proposed Entity Mapping Status

Every canonical entity from Phase 2.0A.3 is mapped to its proposed Prisma implementation representation:

| Canonical Entity Name | Baseline Classification | Proposed Prisma Representation | Split / Merge / Ext Status | Domain Contract Compatibility | Governance & Approval Status |
| :--- | :--- | :--- | :---: | :--- | :---: |
| `Institution` | Enhanced Core Table | `Institution` | Single Table | Fully compatible with `center/guards.ts` | **APPROVED** (`OD-703`, `UP-707`) |
| `Branch` | Enhanced Core Table | `Branch` | Single Table | Fully compatible with `center/evidence.ts` | **APPROVED** (`OD-703`, `OD-719`) |
| `Account` | Financial Accounting Table | `Account` (Deferred) | Single Table | Compatible with `account.ts` EAS codes | **GATED BY UP-701** (Requires CPA Review) |
| `AccountingPeriod` | Financial Accounting Table | `AccountingPeriod` (Deferred) | Single Table | Compatible with `periodPolicy.ts` locks | **GATED BY UP-701** (Requires CPA Review) |
| `StudentFinancialAccount` | Financial Accounting Table | `StudentFinancialAccount` | **Single Persisted Table** | Fully compatible with `center/subLedger.ts` | **PROVISIONAL PROPOSAL** (Awaiting PO Decision) |
| `GroupPricingAgreement` | Financial Accounting Table | `GroupPricingAgreement` | Single Table | Compatible with `center/agreement.ts` | **PROVISIONAL PROPOSAL** (Awaiting PO Decision) |
| `StudentFinancialAgreement`| Financial Accounting Table | `StudentAgreement` | Single Table (Rename) | Fully compatible with `center/agreement.ts` | **PROVISIONAL PROPOSAL** (Awaiting PO Decision) |
| `StudentObligation` | Financial Accounting Table | `PaymentScheduleItem` | Relational Extension | Fully compatible with `center/obligations.ts` | **PROVISIONAL PROPOSAL** (Awaiting PO Decision) |
| `Collection` | Financial Accounting Table | `CollectionReceipt` | Single Table (Rename) | Fully compatible with `center/subLedger.ts` | **PROVISIONAL PROPOSAL** (Awaiting PO Decision) |
| `CollectionAllocation` | Financial Accounting Table | `PaymentAllocation` | Single Table (Rename) | Fully compatible with `center/subLedger.ts` | **PROVISIONAL PROPOSAL** (Awaiting PO Decision) |
| `FinancialAdjustment` | Financial Accounting Table | `FinancialAdjustment` | Single Table | Fully compatible with `center/subLedger.ts` | **PROVISIONAL PROPOSAL** (UP-706/709) |
| `JournalEntry` | Financial Accounting Table | `JournalEntry` (Deferred) | Single Table | Fully compatible with `journalEntry.ts` | **GATED BY UP-701** (Requires CPA Review) |
| `JournalLine` | Financial Accounting Table | `JournalLine` (Deferred) | Single Table | Fully compatible with `journalEntry.ts` | **GATED BY UP-701** (Requires CPA Review) |
| `FinancialIdempotencyRecord`| Financial Accounting Table| `FinancialIdempotencyRecord` | Single Table | Fully compatible with `center/guards.ts` | **PROVISIONAL PROPOSAL** (Awaiting PO Decision) |
| `FinancialAuditEvent` | Financial Accounting Table | `FinancialAuditEvent` | Single Table | Fully compatible with `audit.ts` | **PROVISIONAL PROPOSAL** (Awaiting PO Decision) |
| `Cashbox` | Financial Accounting Table | `Cashbox` | Single Table | Fully compatible with `center/cashbox.ts` | **PROVISIONAL PROPOSAL** (Awaiting PO Decision) |
| `CashboxTransaction` | Financial Accounting Table | `CashboxMovement`, `CashboxTransferRequest`, `ExpenseVoucher` | **3-Table Operational Split** | Fully compatible with Increment 4 domain | **PROVISIONAL PROPOSAL** (Requires Explicit PO Decision) |
| `CashboxReconciliation` | Financial Accounting Table | `DailyCashboxReconciliation` | Single Table (Rename) | Fully compatible with `center/cashbox.ts` | **PROVISIONAL PROPOSAL** (UP-705) |
| `TeacherCompensationAgreement`| Financial Accounting Table| `TeacherCompensationAgreement` | Single Table (Deferred)| Decoupled in `revenueRecognitionEngine.ts` | **GATED BY UP-704** (Unresolved Variable Base) |
| `TeacherPayable` | Financial Accounting Table | `TeacherPayable` (Deferred) | Single Table (Deferred)| Decoupled in `revenueRecognitionEngine.ts` | **GATED BY UP-704** (Unresolved Variable Base) |

> [!IMPORTANT]
> Proposed model names and table splits represent technical proposals matching TypeScript domain class naming. They do not constitute approved canonical names until explicitly authorized by the Product Owner.

---

## 3. Resolution of Architectural Discoveries

### 3.1 StudentFinancialAccount Persistence, Tenant Uniqueness & Balance Projections
Canonical Table #5 (`StudentFinancialAccount`) is preserved as a physical relational table in PostgreSQL:
* **The Persisted Relational Entity:** Permanently stores the student's sub-ledger profile (`accountNumber`), institutional scoping (`institutionId`), user link (`studentId`), lifecycle status (`ACTIVE`, `SUSPENDED`, `CLOSED`), and audit timestamps. It survives enrollment changes and branch transfers.
* **Tenant-Scoped Uniqueness & A1 Validation Requirement:** Enforces `@@unique([institutionId, studentId])` and `@@unique([institutionId, accountNumber])`. This eliminates global student uniqueness, preventing duplicate accounts within an institution.  
  *(Crucial Architectural Limitation: While `@@unique([institutionId, studentId])` prevents duplicate accounts within an institution, independent FKs alone cannot mechanically guarantee at the database level that `User.institutionId === StudentFinancialAccount.institutionId`. `User` currently has `institutionId String?` and lacks `@@unique([institutionId, id])`. Because modifying `User` affects core authentication structures, evaluating compound FK constraints vs. middleware validation is explicitly designated as an **A1 schema-design validation requirement**).*
* **Three Distinct Balance Projection Values:** Across the accepted Phase 2 Student Financial Profile specifications (`SFP-01` to `SFP-08`), balances are derived dynamically on query across immutable lines:
  1. **Total Remaining Balance (المتبقي للسداد الإجمالي):** All unpaid contractual obligations across agreement lifetime, including future-due obligations ($\text{Total Net Agreement} - \text{Total Allocated Collections}$).
  2. **Currently Due (المستحق حالياً):** Unpaid contractual obligations whose due date has arrived ($\text{dueDate} \le \text{today}$), according to the institution's applicable approved due-date policy.
  3. **Overdue (المتأخرات):** Unpaid contractual obligations whose due date has passed ($\text{dueDate} < \text{today}$), according to the applicable approved policy.  
  *(Note: No financial grace period has been authorized or approved by the Product Owner; any future grace period rule remains an unresolved Product Owner policy decision).*
* **Explicit Allocation & Non-Recognition Rules:** Collections do **NOT** follow automatic FIFO waterfall allocation. In strict accordance with Increment 3 (`subLedger.ts`), collections reduce milestone obligations **ONLY** via explicit allocation targeting (`allocate()` / `allocateMultiObligations()`). Unallocated receipts remain unallocated customer advance liabilities (`unallocatedAmount`). Reversals restore corresponding balances. Cash collections **NEVER** recognize revenue automatically.

### 3.2 CashboxTransaction Operational Split (PROVISIONAL)
The proposed split of Canonical Table #17 (`CashboxTransaction`) into `CashboxMovement`, `CashboxTransferRequest`, and `ExpenseVoucher` is an internal persistence adapter that preserves all accounting invariants:
- **Transaction Identity & Audit History:** Every operational event produces immutable `CashboxMovement` lines linking back to reference entities (`TRANSFER`, `EXPENSE`, `RECEIPT`).
- **Transfer Lifecycle & Two-Sided Movement:** In-transit cash is tracked in real-time. Dispatched transfers create debit movements from source tills and credit movements upon destination receipt.
- **Append-Only Reversals:** Transactions are never deleted; compensating movements are appended.
- **Balance Conservation:** Total institutional cash ($87,900.00\text{ EGP}$) is conserved at all times across cashboxes ($86,400.00\text{ EGP}$) and in-transit transfers ($1,500.00\text{ EGP}$).
- **Shift Reconciliation:** Shift counts directly aggregate `CashboxMovement` records without contention from pending transfer drafts.
- **Increment 4 Compatibility:** Directly maps to domain classes `Cashbox`, `CashboxMovement`, `CashboxTransferEngine`, and `ExpenseVoucher`.
*(This split remains **PROVISIONAL** and is **NOT approved by the Product Owner**; it requires explicit authorization).*

### 3.3 PaymentSchedule and PaymentScheduleItem Persistence
Canonical VO-5 `PaymentSchedule` represents the overall contract payment plan structure (e.g., installment frequency).  
`PaymentScheduleItem` is proposed as a persisted relational model because it represents the concrete relational normalization of **Canonical Table #8 (`StudentObligation`)**:
- Enforces individual milestone due dates and milestone-level amounts due.
- Enables partial collections and multi-receipt allocations via `PaymentAllocation`.
- Tracks milestone settlement state (`isSatisfied = true` when remaining balance reaches `0.00`).
- Preserves agreement immutability while milestone settlement progress is updated.

### 3.4 Revenue Recognition Persistence, Idempotency & Allocation Plan
In accordance with the Increment 2 domain contract (`packages/shared/src/accounting/center/revenueRecognitionEngine.ts`), `RevenueRecognitionEntry`:
- Enforces the **Certified Delivery Evidence** requirement (mandatory foreign key to `LessonDeliveryEvidence` with status `CERTIFIED`).
- Enforces the **`PRESENT` Attendance Requirement** (evidence must verify student presence).
- Enforces the **Immutable Allocation Plan** (recognizes contractual session rate snapshot per `OD-722.4`).
- Enforces the **Agreement Price Ceiling** (recognized revenue cannot exceed contractual net fee).
- Enforces **Exact EGP Minor-Unit Arithmetic** (piasters arithmetic with deterministic rounding).
- **Exact Idempotency Strategy:**
  - Explicit domain idempotency column: `idempotencyKey String @unique` (stores `REV_REC_${institutionId}_${agreementId}_${evidenceId}_${studentId}`).
  - Composite business uniqueness constraint: `@@unique([institutionId, evidenceId, studentId])`. This permits multi-student recognition against group delivery evidence while preventing cross-agreement duplicate consumption for the same student.
  - Replay idempotency: Querying by `idempotencyKey` returns the existing record when `status === 'POSTED'`.
  - Duplicate prevention after reversal: Records remain in PostgreSQL with `status = 'REVERSED'`, causing subsequent attempts with that key to fail closed with `InvalidEvidenceError`.
- **Deterministic Reconstruction of `RevenueAllocationPlan` & Hybrid Allocation (UP-714):**
  - Commercial agreements under `UP-714` unbundle:
    1. **Physical Campus Education Allocation (`physicalTuitionAmount`)**: Attributed to physical center classrooms.
    2. **Digital LMS Platform Service Allocation (`digitalPlatformFee`)**: Attributed to online digital platform access.
  - Invariant: $\text{Physical Campus Allocation} + \text{Digital LMS Allocation} \equiv \text{Net Agreement Amount}$.
  - `OD-722.4` equal-session valuation applies **ONLY** to the physical campus allocation (`physicalCampusAmount`). The digital LMS portion (`digitalPlatformAmount`) is **NEVER** allocated across physical lessons. Digital recurring billing and digital earned revenue remain deferred.
  - **Domain Contract Extension Required:** `AgreementPriceSnapshot` (`agreement.ts`) must be extended with `physicalCampusAmount` and `digitalPlatformAmount` before implementation, subject to explicit Product Owner approval.
  - `netAgreedPrice`: Frozen physical allocation from `StudentAgreement.physicalTuitionAmount`.
  - `totalEligibleUnits`: Contractual total physical sessions from `StudentAgreement.totalSessionsCount`.
  - **Deterministic HALF_UP Rounding Rule:** In strict accordance with Phase 2.0B Increment 2 (`packages/shared/src/accounting/center/revenueAllocation.ts` line 128), standard units allocate:
    $$\texttt{standardUnitValue} = \texttt{netAgreedPrice.divide(totalEligibleUnits, 'HALF\_UP')}$$
  - **Rounding Remainder Preservation:** The final eligible physical session deterministically absorbs all remaining fractional minor units (piasters).
  - Plan state is fully reproducible from `StudentAgreement` and `RevenueRecognitionEntry` rows without requiring a separate mutable database table.
- **Explicit Non-Recognition Guarantee:** **Earned revenue is NEVER recognized merely because a student paid** (customer advance liability) and **NEVER recognized merely because a student attended** without supervisor-certified delivery evidence.

---

## 4. Preservation of Policy & Specialist Boundaries

* **`UP-701` (Statutory Chart of Accounts Review):** Mandatory audit by an Egyptian Chartered Accountant (محاسب قانوني) remains required before GL sync; General Ledger tables remain deferred from Step A1.
* **`UP-702` (Educational Tax & VAT System):** Product Owner explicitly confirmed no tax system is required. Tax models and VAT fields remain 100% out of scope.
* **`UP-703` (Payment Gateway Settlement):** Direct center cash desk collections are active; gateway settlement deferred. Legacy `Payment` table retained untouched.
* **`UP-704` (Teacher Variable Compensation Base):** Variable base remains unresolved; zero default formula assumed. Teacher compensation models remain deferred from Step A1.
* **`UP-705` (Cashbox Discrepancy Policy):** Variances remain locked in `DISCREPANCY_PENDING_INVESTIGATION`. Zero automated write-offs, surplus recognitions, or employee liabilities.
* **`UP-706` (Student Refund Policy):** Blocked pending Egyptian Consumer Protection Law (Law 181/2018) legal review.
* **`UP-708` (FX Rate Source Provenance):** Launch currency fixed to `EGP` (`OD-702`, `OD-725`). FX source open; multi-currency disabled.
* **`UP-712` (Student Absence Policy):** Absence credit vs. forfeiture rules remain open.
* **`UP-713` (Legal Entity Structure):** Multi-tenancy operates via `Institution` and `Branch`.
* **`UP-714` & `OD-722.4`:** Hybrid package allocation (`UP-714`) and equal session accounting valuation (`OD-722.4`) remain `APPROVED`.
* **`UP-715` (Statutory Data Retention & PII Scrubbing):** Statutory retention periods and student PII scrubbing remain subject to pending review by a Data Protection Officer. The 5-year retention period is noted as a subject of this pending specialist gate, NOT an already approved final decision.

---

## 5. Accurate Migration Safety Classification

Migration readiness is classified across five distinct technical levels:

| Verification Level | Technical Scope | Status in Step A0 | Assessment & Constraints |
| :--- | :--- | :---: | :--- |
| **Level 1: Design-Level Safety Assessment** | Evaluation of proposed DDL structure, constraints, and non-destructive properties. | **`SATISFIED`** | Proposed DDL is strictly additive (no `DROP TABLE`, no `DROP COLUMN`); all foreign keys specify `ON DELETE RESTRICT`. |
| **Level 2: Static Schema Validation** | Syntax and relational consistency check via Prisma ORM CLI. | **`PENDING STEP A1`** | Will be executed in Step A1 via `npx prisma validate`. |
| **Level 3: Migration Execution Testing** | Generating and applying DDL against a live PostgreSQL database. | **`PENDING STEP A3`** | Cannot be executed in read-only Step A0; requires Step A3 execution against staging database. |
| **Level 4: Database Integrity Verification** | Verifying accessibility and integrity of existing academic data post-migration. | **`PENDING STEP A3`** | Requires post-migration query verification in staging. |
| **Level 5: Rollback Execution Testing** | Executing reverse DDL against a migrated database to prove safe recovery. | **`PROPOSED STRATEGY`** | The rollback script in Step A0 is a **proposed rollback strategy / draft script**, NOT an executed or verified script. Verification will occur in Step A5. |

---

## 6. Formal Product Owner Authorizations Required Before Step A1

The following specific architectural decisions are submitted for Product Owner authorization:
1. **Authorization of `StudentFinancialAccount` Persisted Model:** Authorize `StudentFinancialAccount` as the master AR subledger profile with institution-scoped uniqueness `@@unique([institutionId, studentId])` and `@@unique([institutionId, accountNumber])`.
2. **Authorization of Hybrid Revenue Allocation Extension (`UP-714`):** Authorize extending `AgreementPriceSnapshot` with `physicalCampusAmount` and `digitalPlatformAmount`, ensuring `OD-722.4` applies strictly to physical tuition.
3. **Authorization of the 3-Table `CashboxTransaction` Split (PROVISIONAL):** Authorize separating till movements (`CashboxMovement`), transfer workflows (`CashboxTransferRequest`), and petty cash disbursements (`ExpenseVoucher`) as an internal persistence adapter.
4. **Authorization of `PaymentScheduleItem` Persistence:** Authorize `PaymentScheduleItem` as the relational implementation of Canonical Table #8 (`StudentObligation`).
5. **Authorization of Revenue Recognition Idempotency Strategy:** Authorize `idempotencyKey String @unique` and `@@unique([institutionId, evidenceId, studentId])` on `RevenueRecognitionEntry`.

---

## 7. Deliverables Register (Step A0)

All eight documentation deliverables have been updated and reconciled in [`docs/phase-4/workstream-a/step-a0/`](file:///D:/OX-DIGITAL/Mathe/OX-DIGITAL-GITHUB/docs/phase-4/workstream-a/step-a0/):
1. `EXISTING_PRISMA_SCHEMA_INVENTORY.md` — Field-level audit of 31 models, 14 enums, migrations, and `Payment` analysis.
2. `ENTITY_BY_ENTITY_RECONCILIATION.md` — Canonical-to-proposed mapping, Cashbox split analysis, and PaymentScheduleItem justification.
3. `PERSISTENCE_GAP_ANALYSIS.md` — Reconciled model counts, revenue recognition guarantees, and constraint requirements.
4. `TENANT_AND_BRANCH_ISOLATION_REVIEW.md` — Multi-tenant boundaries, branch typing, and Super-Admin quarantine.
5. `MIGRATION_DEPENDENCY_ORDER.md` — Reconciled topological execution tiers and safety classifications.
6. `MIGRATION_AND_ROLLBACK_STRATEGY.md` — Zero-downtime methodology and proposed draft rollback runbook.
7. `WORKSTREAM_A_IMPLEMENTATION_PLAN.md` — Step A0–A5 roadmap with explicit verification gates and model counts.
8. `STEP_A0_FINAL_REPORT.md` (This document) — Executive summary, reconciled metrics, and formal PO approval items.

---

## 8. Governance Stop Notice

> [!IMPORTANT]
> **GOVERNANCE STOP GATE:**  
> Step A0 final persistence integrity check is formally complete.  
> - Zero application source code files were modified.  
> - Zero edits were made to `schema.prisma`.  
> - Zero migration files were generated.  
> - Zero database connections, queries, or backfills were executed.  
> - Zero Docker, infrastructure, or Git write operations were performed.  
> 
> **Execution is now STOPPED.** We await explicit Product Owner authorization before proceeding to **Step A1: Prisma Schema Drafting & Syntax Validation**.
