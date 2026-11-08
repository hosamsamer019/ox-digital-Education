# OX-DIGITAL Education — Phase 4: Workstream A
## Step A0: Pre-Implementation Schema Audit & Migration Plan
### Deliverable 3: Persistence Gap Analysis & Technical Specifications

**Workspace:** `D:\OX-DIGITAL\Mathe\OX-DIGITAL-GITHUB`  
**Target:** `docs/phase-4/workstream-a/step-a0/PERSISTENCE_GAP_ANALYSIS.md`  
**Execution Mode:** STRICTLY READ-ONLY AUDIT & IMPLEMENTATION PLANNING  
**Date:** November 4, 2026 (Final Reconciliation)  
**Author:** Lead Software Architect & Financial Systems Security Reviewer  

---

## 1. Executive Summary

This document details the concrete technical and structural gaps between the current PostgreSQL database schema (`packages/database/prisma/schema.prisma`) and the persistence requirements of the Phase 2 UI/UX design and Phase 2.0B shared accounting domain.

While the application possesses a functional academic schema and tenancy foundation, **0% of the financial accounting domain is currently persisted in the database**. All double-entry and sub-ledger guarantees currently exist only as in-memory TypeScript classes and unit test assertions in Node.js.

---

## 2. Fundamental Data Type Gaps: Numeric Precision & Monetary Modeling

### 2.1 The IEEE 754 Floating-Point Defect in Existing Schema
In the current `schema.prisma`, all monetary fields on existing models are typed as `Float`:
- `Course.price`: `Float @default(0)`
- `Payment.amount`: `Float`

In JavaScript/TypeScript and standard SQL, IEEE 754 binary floating-point arithmetic cannot represent base-10 fractional quantities (e.g. $0.10$ or $0.20$) exactly:
$$0.10 + 0.20 = 0.30000000000000004$$
In financial accounting, accumulating sub-cent rounding errors violates conservation invariants:
- Cashbox liquidity conservation: $\sum \text{Cashboxes} + \sum \text{In-Transit} \equiv 87,900.00\text{ EGP}$.
- Student sub-ledger conservation: $\text{Contract Amount} \equiv \text{Collected} + \text{Receivable}$ ($5,500.00 \equiv 1,750.00 + 3,750.00$).

### 2.2 The In-Memory Domain vs. Database Gap
The domain engine in `packages/shared/src/accounting/money.ts` and `revenueAllocation.ts` solves this in memory using:
1. `Money` class wrapping integer minor units (piasters: $1\text{ EGP} = 100\text{ piasters}$).
2. Approved deterministic `HALF_UP` rounding (`money.round(scale, 'HALF_UP')`) with exact minor-unit remainder absorption on the final eligible unit.

### 2.3 Persistence Resolution for Workstream A:
All monetary columns across the newly introduced financial models must be typed as:
$$\text{Prisma: } \texttt{Decimal} \quad @\texttt{db.Decimal(12, 2)}$$
This maps to PostgreSQL `NUMERIC(12, 2)`:
- Supports monetary figures up to $9,999,999,999.99\text{ EGP}$ (ten billion Egyptian Pounds).
- Preserves exact 2-decimal fractional piaster precision without floating-point drift.
- Eliminates conversion artifacts when hydrating into the TypeScript `Money` value object.

---

## 3. Domain Persistence Gaps by Operational Pillar

### 3.1 Pillar 1: Cashbox Management & Liquidity (`CBM-01` to `CBM-08`)
The current schema has zero tables representing physical cash handling:
* **Missing Master Register (`Cashbox`):** No database record exists for the 4 physical cashboxes (`CB-01`, `CB-02`, `CB-MAIN`, `CB-03`). There is no persistent store for `currentBookBalance`, branch attribution, or operational status.
* **Missing Transaction Movements (`CashboxMovement`):** No append-only log exists to record cash desk inflows (student collections), outflows (expense disbursements), or transfer debits/credits.
* **Missing Transfer State Machine (`CashboxTransferRequest`):** No table exists to track the 5-stage Maker-Checker lifecycle (`DRAFT` $\to$ `PENDING_APPROVAL` $\to$ `APPROVED` $\to$ `IN_TRANSIT` $\to$ `COMPLETED`). In-transit liquidity ($1,500.00\text{ EGP}$ under `#TRF-104`) is untracked in the database.
* **Missing Shift Reconciliations (`DailyCashboxReconciliation`):** No table stores cashier daily shift counts, physical cash counts, denomination breakdowns, or discrepancy records under `UP-705`.
* **Missing Expense Vouchers (`ExpenseVoucher`):** No table stores petty cash expense requests drafted by Accountants and approved by the Primary Manager.

#### Architectural Evaluation of the `CashboxTransaction` Split (PROVISIONAL):
Canonical Baseline Table #17 (`CashboxTransaction`) is proposed to be represented via 3 operational models (`CashboxMovement`, `CashboxTransferRequest`, `ExpenseVoucher`).  
This isolates instant till movements from multi-stage approval workflows, preventing database row contention during transfer reviews while strictly preserving:
- Original transaction identity (movements reference the parent transfer request or expense voucher).
- Two-sided transfer movements (debit from source till, credit to destination till).
- Total liquidity conservation ($\sum \text{Cashboxes} + \text{In-Transit} \equiv 87,900.00\text{ EGP}$).
- Append-only reversal semantics.
- Shift reconciliation calculations (`Expected = Opening + Inflows - Outflows`).
- Compatibility with Increment 4 domain classes.
*(This operational persistence representation remains **PROVISIONAL** and is **NOT approved by the Product Owner**; it is submitted for formal authorization).*

### 3.2 Pillar 2: Student Financial Profile & Sub-Ledger (`SFP-01` to `SFP-08`)
The current schema has zero sub-ledger models:
* **Missing Persisted AR Master Account (`StudentFinancialAccount`):** Canonical Table #5 is completely missing. No persistent master record exists to maintain the student's sub-ledger identity (`accountNumber`), institutional scoping, account lifecycle status (`ACTIVE`, `SUSPENDED`, `CLOSED`), and long-term continuity across course enrollments or campus transfers.
* **Missing Commercial Contracts (`StudentAgreement`):** No table stores student enrollment agreements, payment plans, frozen agreed fee snapshots (`OD-722.4`), or package allocations (`UP-714`).
* **Missing Payment Milestone Schedules (`PaymentScheduleItem`):** No table stores the sequential payment milestone obligations ($1,750.00$, $1,250.00$, $1,250.00$, $1,250.00$).
* **Missing Intake Receipts (`CollectionReceipt`):** No table stores physical cash or POS receipts issued to students with sequential numbering (`REC-7841`) and cashier attribution.
* **Missing Sub-Ledger Allocations (`PaymentAllocation`):** No bridge table links collection receipts to specific milestone obligations via explicit target allocation.
* **Missing Compensating Adjustments (`FinancialAdjustment`):** No table exists to record debit/credit notes, fee waivers, or refund requests under `UP-706` and `UP-709`.

#### Persistence Rationale for `StudentFinancialAccount` vs. `currentBalance`:
- `StudentFinancialAccount` is a **persisted master entity** anchoring all financial agreements and transactions for a student. It enforces **institution-scoped composite uniqueness**:
  $$\texttt{@@unique([institutionId, studentId])}$$
  $$\texttt{@@unique([institutionId, accountNumber])}$$
  allowing a student identity to hold independent AR accounts across different educational institutions in a multi-tenant SaaS without global collision or cross-tenant leakage.
  *(Note on Tenant Isolation: As detailed in Section 5.2, `@@unique([institutionId, studentId])` prevents duplicate accounts within an institution, but independent FKs alone cannot mechanically guarantee at the database level that `User.institutionId === StudentFinancialAccount.institutionId` without a compound foreign key referencing `User(institutionId, id)`, which is marked as an A1 schema-design validation requirement).*
- **Three Distinct Balance Projection Values:** In accordance with the accepted Phase 2 Student Financial Profile specifications (`SFP-01` to `SFP-08`), balances are derived dynamically on query across immutable lines:
  1. **Total Remaining Balance (المتبقي للسداد الإجمالي):** All unpaid contractual obligations across the agreement lifetime, including future-due obligations ($\text{Total Net Agreement} - \text{Total Allocated Collections}$).
  2. **Currently Due (المستحق حالياً):** Unpaid contractual milestone obligations whose due date has arrived ($\text{dueDate} \le \text{today}$), according to the institution's applicable approved due-date policy.
  3. **Overdue (المتأخرات):** Unpaid contractual milestone obligations whose due date has passed ($\text{dueDate} < \text{today}$), according to the applicable approved policy.
  *(Note: No financial grace period has been authorized or approved by the Product Owner; any future grace period rule remains an unresolved Product Owner policy decision).*
- **Explicit Allocation Targeting (No Automatic FIFO):** In strict accordance with Phase 2.0B Increment 3 (`packages/shared/src/accounting/center/subLedger.ts`), collections reduce milestone obligations **ONLY** via explicit target allocation (`allocate()` / `allocateMultiObligations()`). There is no automatic FIFO waterfall or implicit priority across due categories. Unallocated collections remain unallocated customer advance liabilities (`unallocatedAmount` on receipt). Allocation reversals restore corresponding receipt and obligation balances. Cash collections **NEVER** recognize revenue automatically.

#### Persistence Rationale for `PaymentScheduleItem`:
While the overall payment schedule structure (e.g., quarterly installments) is an embedded Value Object on `StudentAgreement`, individual milestone obligations require relational persistence in `PaymentScheduleItem` to:
- Enforce milestone-specific due dates and billed amounts.
- Support partial payments and multi-receipt allocations via `PaymentAllocation`.
- Track milestone-level satisfied status (`isSatisfied = true` when remaining balance reaches `0.00`).
- Preserve agreement immutability once executed.
*(Classified as the concrete relational implementation of Canonical Table #8 `StudentObligation`).*

### 3.3 Pillar 3: Accrual Revenue Recognition & Delivery Proof
The current schema cannot enforce the dual prerequisites of earned revenue recognition:
* **Missing Lesson Delivery Proof (`LessonDeliveryEvidence`):** The existing `Attendance` table only records binary student attendance flags (`status = "PRESENT"`). It does NOT link to syllabus milestones, does NOT capture teacher cryptographic signatures, does NOT verify supervisor certification, and does NOT link to physical center branch validation.
* **Missing Earned Revenue Entries (`RevenueRecognitionEntry`):** No table records recognized revenue events computed via equal session valuation (`OD-722.4`). There is zero database link between certified lessons and earned income.

#### Revenue Invariant Persistence Guarantees & Exact Idempotency Strategy:
In accordance with the Increment 2 domain contract (`packages/shared/src/accounting/center/revenueRecognitionEngine.ts`), `RevenueRecognitionEntry` enforces:
1. **Certified Delivery Evidence:** Mandatory foreign key to `LessonDeliveryEvidence` with status `CERTIFIED`.
2. **`PRESENT` Attendance Requirement:** Evidence must verify student attendance with status `PRESENT`.
3. **Immutable Allocation Plan:** Revenue recognizes contractual session rate snapshot from `RevenueAllocationPlan`.
4. **Agreement Price Ceiling:** Cumulative recognized revenue can never exceed contractual total net fee.
5. **Exact Minor-Unit Arithmetic:** Piasters arithmetic with deterministic rounding.
6. **Exact Idempotency & Uniqueness Strategy:**
   - Explicit domain idempotency column:
     ```prisma
     idempotencyKey String @unique // REV_REC_${institutionId}_${agreementId}_${evidenceId}_${studentId}
     ```
   - Composite business uniqueness constraint:
     ```prisma
     @@unique([institutionId, evidenceId, studentId])
     ```
     This allows multiple students (Student A, Student B) to be recognized for the same group delivery evidence (`evidenceId`), while strictly preventing duplicate consumption for the same student (`hasConsumed(evidenceId, studentId)`).
   - Replay idempotency: Querying by `idempotencyKey` returns the existing record when `status === 'POSTED'`.
   - Post-Reversal Duplicate Prevention: Reversed records remain in PostgreSQL with `status = 'REVERSED'`, causing subsequent attempts with that key to fail closed with `InvalidEvidenceError`.
7. **Compensating Reversals:** Cancelled lessons post compensating entries without mutating original records.
8. **Explicit Non-Recognition Guarantee:** **Earned revenue is NEVER recognized merely because a student paid** (which is unearned customer advance liability) and **NEVER recognized merely because a student attended** without supervisor-certified delivery evidence.

#### Deterministic Reconstruction of `RevenueAllocationPlan` & Hybrid Allocation (UP-714):
Under approved `UP-714` (Hybrid Package Allocation), commercial agreements unbundle:
- **Physical Campus Education Allocation (`physicalTuitionAmount`)**: Attributed to physical center classrooms.
- **Digital LMS Platform Service Allocation (`digitalPlatformFee`)**: Attributed to online digital platform access.
- Invariant: $\text{Physical Campus Allocation} + \text{Digital LMS Allocation} \equiv \text{Net Agreement Amount}$.
- `OD-722.4` equal-session valuation applies **ONLY** to the physical campus allocation. The digital LMS portion is **NOT** recognized across physical lessons. Digital recurring billing and digital earned revenue remain deferred.
- **Domain Contract Extension Required:** `AgreementPriceSnapshot` (`agreement.ts`) must be extended with `physicalCampusAmount` and `digitalPlatformAmount` before implementation, subject to explicit Product Owner approval.
- `RevenueAllocationPlan` is deterministically reconstructed from:
  - `netAgreedPrice`: Frozen physical allocation from `StudentAgreement.physicalTuitionAmount`.
  - `totalEligibleUnits`: Contractual total physical sessions from `StudentAgreement.totalSessionsCount`.
  - Equal-session rate: $\texttt{standardUnitValue} = \texttt{netAgreedPrice.divide(totalEligibleUnits, 'HALF\_UP')}$.
  - Final remainder preservation: On the final physical session, the remaining unearned amount is allocated, absorbing all fractional piasters.
  - A separate mutable database table is not required, as plan state is fully reproducible from `StudentAgreement` and `RevenueRecognitionEntry` rows.

---

## 4. Why the Existing `Payment` Model Cannot Be Reused

An audit was performed to evaluate whether the existing `Payment` table could be extended to serve as the physical center collection receipt:

| Critical Feature | Existing `Payment` Model | Required Sub-Ledger Collection (`CollectionReceipt`) | Compatibility Verdict |
| :--- | :--- | :--- | :---: |
| **Data Type** | `Float` (IEEE 754) | `Decimal(12, 2)` (PostgreSQL `NUMERIC`) | **FATAL GAP:** Incompatible numeric precision. |
| **Cashbox Link** | None (`cashboxId` does not exist) | Mandatory link to `Cashbox` | **FATAL GAP:** Cannot track cashier till balance. |
| **Commercial Agreement** | Optional `courseId` | Mandatory link to `StudentAgreement` | **FATAL GAP:** Lacks student sub-ledger contract anchor. |
| **Milestone Allocation** | None (Single lump sum) | Explicit multi-milestone target allocation | **FATAL GAP:** Cannot track unallocated customer advances. |
| **Cashier Attribution** | None (Only `userId` representing payer) | Mandatory `collectedById` (Cashier) | **FATAL GAP:** Cannot satisfy Maker-Checker audit trail. |
| **Receipt Numbering** | `providerOrderId` (Gateway Order ID) | Sequential institutional serial (`REC-XXXX`) | **FATAL GAP:** Lacks manual center receipt numbering. |
| **Payment Methods** | Stripe/Paymob digital gateway | Cash Desk, POS Terminal, Manual Wire | **MISMATCH:** Designed for online webhooks, not physical till. |

**Conclusion:**  
Attempting to repurpose `Payment` would require destructive schema changes, column renames, type conversions from `Float` to `Decimal`, and complex data migrations that would break existing online payment flows. The clean, safe architectural pattern is to leave `Payment` untouched for legacy and future online gateway operations (`UP-703`), and implement `CollectionReceipt` as a clean, purpose-built sub-ledger model.

---

## 5. Relational Integrity & Deletion Constraint Gaps

### 5.1 Deletion Safeguards (Append-Only Accounting Invariant)
In financial accounting, records must never be deleted (`DELETE FROM ...` is prohibited).
- **Existing Risk:** Several legacy models in `schema.prisma` utilize `onDelete: Cascade`. If a user or course is deleted, cascaded deletes could purge related child records.
- **Required Constraint for Financial Models:** All foreign key relations across the new financial models must strictly enforce:
  $$\texttt{onDelete: Restrict}$$
- An institution, branch, cashbox, cashier, or student with associated financial movements, receipts, or agreements cannot be physically deleted from the database.
- **Statutory Retention Note (`UP-715`):** Statutory retention periods and student PII scrubbing remain subject to pending specialist review by a Data Protection Officer. Restrictive delete rules ensure that data is preserved until formal DPO policy guidelines are established.

### 5.2 Unique Constraint Gaps
The following composite uniqueness constraints must be enforced at the database level to prevent duplicate numbering and race conditions:
1. `StudentFinancialAccount`: `@@unique([institutionId, studentId])` and `@@unique([institutionId, accountNumber])` — Enforces institution-scoped unique accounts without global student collision. *(Important limitation: `@@unique([institutionId, studentId])` prevents duplicate accounts within an institution, but does NOT by itself prove the referenced `User` belongs to that institution because `User` has nullable `institutionId` and independent FKs; mechanically enforcing tenant consistency via `FOREIGN KEY ("institutionId", "studentId") REFERENCES "User"("institutionId", "id")` would require `@@unique([institutionId, id])` on `User`. This is designated as an **A1 schema-design validation requirement**).*
2. `Cashbox`: `@@unique([institutionId, code])` — Ensures unique till codes (`CB-01`, `CB-02`) per institution.
3. `CashboxTransferRequest`: `@@unique([institutionId, transferNumber])` — Prevents duplicate transfer request IDs.
4. `DailyCashboxReconciliation`: `@@unique([cashboxId, reconciliationDate])` — Enforces one shift reconciliation per till per day.
5. `ExpenseVoucher`: `@@unique([institutionId, voucherNumber])` — Prevents duplicate expense voucher numbers.
6. `StudentAgreement`: `@@unique([institutionId, agreementNumber])` — Prevents duplicate student contract numbers.
7. `PaymentScheduleItem`: `@@unique([agreementId, milestoneNumber])` — Enforces strict sequential milestone numbering.
8. `CollectionReceipt`: `@@unique([institutionId, receiptNumber])` — Prevents duplicate receipt issuance.
9. `LessonDeliveryEvidence`: `@@unique([lessonId, centerGroupId, deliveredAt])` — Prevents duplicate certification of the same classroom session.
10. `RevenueRecognitionEntry`: `@@unique([institutionId, evidenceId, studentId])` and `idempotencyKey @unique` — Enforces exact Increment 2 multi-student and replay idempotency.
11. `FinancialIdempotencyRecord`: `@@unique([institutionId, idempotencyKey])` — Guarantees exactly-once mutation execution.

---

## 6. Audit Trail & Idempotency Infrastructure Gaps

1. **Idempotency Store (`FinancialIdempotencyRecord`):**  
   In distributed web applications, network retries can cause duplicate payment intake or double-transfers. The shared domain includes idempotency guards, but zero database table exists to store idempotency keys, request hashes, response payloads, and expiration timestamps.
2. **Forensic Audit Vault (`FinancialAuditEvent`):**  
   Financial audits require an immutable record of every state transition (e.g. who approved transfer `#TRF-104`, when was expense voucher `#EXP-001` authorized, who performed shift count on `CB-01`). No dedicated financial audit table currently exists.

---

## 7. Synthesis: Workstream A Persistence Scope

To resolve these persistence gaps safely without impacting existing academic functionality, Workstream A proposes:
- **12 Operational Financial Models:** `StudentFinancialAccount`, `GroupPricingAgreement`, `StudentAgreement`, `PaymentScheduleItem`, `CollectionReceipt`, `PaymentAllocation`, `FinancialAdjustment`, `Cashbox`, `CashboxMovement`, `CashboxTransferRequest`, `DailyCashboxReconciliation`, `ExpenseVoucher`.
- **2 Academic & Revenue Models:** `LessonDeliveryEvidence`, `RevenueRecognitionEntry`.
- **2 Infrastructure Models:** `FinancialIdempotencyRecord`, `FinancialAuditEvent`.
- **6 Enums** governing accounting lifecycles.
- Strict `ON DELETE RESTRICT` constraints on all financial foreign keys.
- Composite uniqueness constraints and tenant isolation indexes on every financial table.
- Deferral of 6 specialist-gated models (`Account`, `AccountingPeriod`, `JournalEntry`, `JournalLine`, `TeacherCompensationAgreement`, `TeacherPayable`) until resolution of Gates `UP-701` and `UP-704`.
