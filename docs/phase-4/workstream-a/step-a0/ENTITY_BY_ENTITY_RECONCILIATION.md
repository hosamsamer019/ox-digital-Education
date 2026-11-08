# OX-DIGITAL Education — Phase 4: Workstream A
## Step A0: Pre-Implementation Schema Audit & Migration Plan
### Deliverable 2: Canonical-to-Proposed Entity Reconciliation & Architectural Taxonomy

**Workspace:** `D:\OX-DIGITAL\Mathe\OX-DIGITAL-GITHUB`  
**Target:** `docs/phase-4/workstream-a/step-a0/ENTITY_BY_ENTITY_RECONCILIATION.md`  
**Execution Mode:** STRICTLY READ-ONLY AUDIT & IMPLEMENTATION PLANNING  
**Date:** November 4, 2026 (Final Tenant & Hybrid Reconciliation)  
**Author:** Lead Software Architect & Financial Systems Security Reviewer  

---

## 1. Executive Summary & Taxonomy Disaggregation

This document provides the definitive, model-by-model reconciliation bridging the authoritative **Phase 2.0A.3 Persistence Taxonomy** ([`ACCOUNTING_PHASE_2_0A_3_ENTITY_COUNT_AND_LIFECYCLE_AUDIT.md`](file:///D:/OX-DIGITAL/Mathe/OX-DIGITAL-GITHUB/ACCOUNTING_PHASE_2_0A_3_ENTITY_COUNT_AND_LIFECYCLE_AUDIT.md)), the **Phase 2.0B Domain Implementation** (`packages/shared/src/accounting/`), the **Phase 2 UI/UX Operational Specifications** (`docs/ui-ux/phase-2/`), and the current **Prisma Database Schema** (`schema.prisma`).

### Disaggregation of Entity Counts & Categories:
To prevent arithmetic confusion and maintain strict architectural transparency, the entity counts are disaggregated into explicit, non-overlapping categories:

1. **Authoritative Canonical Relational Tables (20 Tables):**
   - **2 Pre-Existing Core Tables:** `Institution` (Tenant Root), `Branch` (Operating Dimension). Both currently exist in `schema.prisma`.
   - **18 Missing Financial Accounting Tables:** Zero currently exist in `schema.prisma`.
     - *6 Specialist-Gated Tables:* Gated by `UP-701` (`Account`, `AccountingPeriod`, `JournalEntry`, `JournalLine`) and `UP-704` (`TeacherCompensationAgreement`, `TeacherPayable`).
     - *12 Frontline & Sub-Ledger Baseline Tables:* `StudentFinancialAccount`, `GroupPricingAgreement`, `StudentFinancialAgreement`, `StudentObligation`, `Collection`, `CollectionAllocation`, `FinancialAdjustment`, `FinancialIdempotencyRecord`, `FinancialAuditEvent`, `Cashbox`, `CashboxTransaction`, `CashboxReconciliation`.
2. **Proposed Prisma Implementation Models for Workstream A:**
   - *Direct Baseline Implementations (7 Models):* `StudentFinancialAccount`, `GroupPricingAgreement`, `Cashbox`, `DailyCashboxReconciliation`, `StudentAgreement`, `CollectionReceipt`, `PaymentAllocation`, `FinancialAdjustment`.
   - *Operational Split of Baseline Table #17 `CashboxTransaction` (3 Models — PROVISIONAL):* `CashboxMovement`, `CashboxTransferRequest`, `ExpenseVoucher`.
   - *Relational Normalization Extension (1 Model):* `PaymentScheduleItem` (implements `StudentObligation` with milestone-level state).
   - *Domain 7 Session Extensions (2 Models):* `LessonDeliveryEvidence`, `RevenueRecognitionEntry`.
   - *Dedicated Infrastructure Models (2 Models):* `FinancialIdempotencyRecord`, `FinancialAuditEvent`.
3. **Embedded Value Objects (6 VOs):** `AccountingDimension`, `PriceCatalogItem`, `PriceVersion`, `AgreementPriceSnapshot`, `PaymentSchedule`, `CompensationPolicyVersion`.
4. **Self-Referential Relational Attributes (2 Attributes):** `JournalEntry.reversalOfEntryId`, `Account.parentId`.
5. **Derived Real-Time Projections / Computed Values (2 Projections):** `StudentFinancialAccount.currentBalance`, `Cashbox.currentBalance`.
6. **Canonical Physical Table Aliases (3 Aliases):** `PriceCatalog` $\to$ `GroupPricingAgreement`, `CashboxTransfer` $\to$ `CashboxTransaction`, `RefundRequest` $\to$ `FinancialAdjustment`.

> [!IMPORTANT]
> **Governance Notice on Model Naming & Splits:**  
> All proposed Prisma model names and operational splits in this document represent **provisional technical proposals** designed to map cleanly to existing TypeScript domain classes. They do NOT constitute approved canonical decisions until explicitly authorized by the Product Owner.

---

## 2. Complete Canonical-to-Proposed Entity Mapping Matrix

The table below reconciles every single canonical entity from Phase 2.0A.3, specifying its baseline classification, proposed Prisma implementation name, table split/merge status, justification, domain compatibility, and Product Owner approval status:

| # | Canonical Baseline Entity Name | Authoritative Category | Proposed Prisma Model Name | Existing Status in Schema | Split / Merge / Ext Status | Justification for Proposed Representation | Compatibility with Accepted Domain Contracts | PO Approval Status |
| :-: | :--- | :--- | :--- | :---: | :---: | :--- | :--- | :---: |
| **1** | `Institution` | Persisted Table (Enhanced Core) | `Institution` | **PERSISTED** | Single Table (Preserved) | Pre-existing tenant root. Add 1-to-many financial relations. | Fully compatible with `center/guards.ts` tenant scoping. | **APPROVED** (`OD-703`, `UP-707`) |
| **2** | `Branch` | Persisted Table (Enhanced Core) | `Branch` | **PERSISTED** | Single Table (Preserved) | Pre-existing operating center dimension (`isOnline` flag). | Fully compatible with `center/evidence.ts` physical checks. | **APPROVED** (`OD-703`, `OD-719`) |
| **3** | `Account` | Persisted Table (Chart of Accounts) | `Account` (Deferred) | **MISSING** | Single Table (Self-ref `parentId`) | Chart of Accounts master. Structure defined in `account.ts`. | Compatible with `account.ts` 4-digit EAS codes. | **GATED BY UP-701** (Requires CPA Review) |
| **4** | `AccountingPeriod` | Persisted Table (Fiscal Periods) | `AccountingPeriod` (Deferred) | **MISSING** | Single Table (Preserved) | Fiscal calendar period closing locks. | Compatible with `periodPolicy.ts` state machine. | **GATED BY UP-701** (Requires CPA Review) |
| **5** | `StudentFinancialAccount` | Persisted Table (AR Sub-Ledger Master)| `StudentFinancialAccount` | **MISSING** | **Single Persisted Table** | Persisted master AR account profile; balance is the **Derived Real-Time Projection** `currentBalance`. Scoped per institution (`@@unique([institutionId, studentId])`). | Fully compatible with `center/subLedger.ts` sub-ledger engine. | **PROVISIONAL PROPOSAL** (Awaiting PO Authorization) |
| **6** | `GroupPricingAgreement` | Persisted Table (Fee Catalog Master) | `GroupPricingAgreement` | **MISSING** | Single Table (with Embedded VOs) | Standard group tuition catalog. Rates snapshotted onto agreements. | Compatible with `center/agreement.ts` catalog interfaces. | **PROVISIONAL PROPOSAL** (Awaiting PO Authorization) |
| **7** | `StudentFinancialAgreement`| Persisted Table (Commercial Master) | `StudentAgreement` | **MISSING** | Single Table (Rename Proposal) | Master student contract. Renamed to match UI/domain convention. Includes UP-714 campus vs digital breakdown. | Fully compatible with `center/agreement.ts` class. | **PROVISIONAL PROPOSAL** (Awaiting PO Authorization) |
| **8** | `StudentObligation` | Persisted Table (Milestones) | `PaymentScheduleItem` | **MISSING** | Relational Normalization Ext | Relational table storing milestone installment due dates & allocated balances. | Fully compatible with `center/obligations.ts`. | **PROVISIONAL PROPOSAL** (Awaiting PO Authorization) |
| **9** | `Collection` | Persisted Table (Intake Receipts) | `CollectionReceipt` | **MISSING** | Single Table (Rename Proposal) | Physical till/POS collection receipts with sequential numbering. | Fully compatible with `center/subLedger.ts` intake methods. | **PROVISIONAL PROPOSAL** (Awaiting PO Authorization) |
| **10**| `CollectionAllocation` | Persisted Table (Sub-Ledger Allocation Bridge) | `PaymentAllocation` | **MISSING** | Single Table (Rename Proposal) | Bridge linking receipts to specific milestone obligations via explicit target allocation. | Fully compatible with `center/subLedger.ts` allocation engine. | **PROVISIONAL PROPOSAL** (Awaiting PO Authorization) |
| **11**| `FinancialAdjustment` | Persisted Table (Reversals/Refunds) | `FinancialAdjustment` | **MISSING** | Single Table (Preserved) | Compensating adjustments, fee waivers, credit notes, and refund requests. | Fully compatible with `center/subLedger.ts` adjustment logic. | **PROVISIONAL PROPOSAL** (Governed by UP-706/709) |
| **12**| `JournalEntry` | Persisted Table (GL Header) | `JournalEntry` (Deferred) | **MISSING** | Single Table (Self-ref reversal) | Balanced double-entry header. Links reversal entries. | Fully compatible with `journalEntry.ts` invariants. | **GATED BY UP-701** (Requires CPA Review) |
| **13**| `JournalLine` | Persisted Table (GL Line Item) | `JournalLine` (Deferred) | **MISSING** | Single Table (with Embedded VO) | Debit/credit line with embedded `AccountingDimension`. | Fully compatible with `journalEntry.ts` debit/credit balance. | **GATED BY UP-701** (Requires CPA Review) |
| **14**| `FinancialIdempotencyRecord`| Persisted Table (Deduplication) | `FinancialIdempotencyRecord` | **MISSING** | Single Table (Preserved) | Technical deduplication key store preventing duplicate intake. | Fully compatible with `center/guards.ts` idempotency checks. | **PROVISIONAL PROPOSAL** (Awaiting PO Authorization) |
| **15**| `FinancialAuditEvent` | Persisted Table (Forensic Vault) | `FinancialAuditEvent` | **MISSING** | Single Table (Preserved) | Immutable audit trail for financial state transitions. | Fully compatible with `audit.ts` audit logger. | **PROVISIONAL PROPOSAL** (Awaiting PO Authorization) |
| **16**| `Cashbox` | Persisted Table (Till/Safe Master) | `Cashbox` | **MISSING** | Single Table (Preserved) | Master register for physical tills and vaults (`CB-01` to `CB-03`). | Fully compatible with `center/cashbox.ts` class `Cashbox`. | **PROVISIONAL PROPOSAL** (Awaiting PO Authorization) |
| **17**| `CashboxTransaction` | Persisted Table (Movements & Xfers) | **Split into 3 Models:** `CashboxMovement`, `CashboxTransferRequest`, `ExpenseVoucher` | **MISSING** | **3-Table Operational Split (PROVISIONAL)** | Separates high-frequency till movements from multi-stage transfer approvals and expense voucher drafting. | Fully compatible with Increment 4 domain engine classes. | **PROVISIONAL PROPOSAL** (Requires Explicit PO Decision) |
| **18**| `CashboxReconciliation` | Persisted Table (Shift Close) | `DailyCashboxReconciliation` | **MISSING** | Single Table (Rename Proposal) | Daily shift count and variance. Governed by `UP-705`. | Fully compatible with `center/cashbox.ts` shift logic. | **PROVISIONAL PROPOSAL** (Awaiting PO Authorization) |
| **19**| `TeacherCompensationAgreement`| Persisted Table (Teacher Terms)| `TeacherCompensationAgreement` | **MISSING** | Single Table (Deferred) | Base teacher contract terms. Variable qualifying base open. | Decoupled in `center/revenueRecognitionEngine.ts`. | **GATED BY UP-704** (Unresolved Variable Base) |
| **20**| `TeacherPayable` | Persisted Table (Teacher Dues) | `TeacherPayable` (Deferred) | **MISSING** | Single Table (Deferred) | Teacher monthly dues liability. Automated calculation blocked. | Decoupled in `center/revenueRecognitionEngine.ts`. | **GATED BY UP-704** (Unresolved Variable Base) |
| **VO-1**| `AccountingDimension` | Embedded Value Object | Inline on `JournalLine` | **MISSING** | Embedded Columns | Inline `dimensionType` (`BRANCH`) and `branchId` on GL line. | Matches `dimensions.ts` value object. | **GATED BY UP-701** |
| **VO-2**| `PriceCatalogItem` | Embedded Value Object | Inline on `GroupPricingAgreement` | **MISSING** | Embedded Columns | Standard course tuition rate and session fee columns. | Matches `center/agreement.ts` interfaces. | **PROVISIONAL PROPOSAL** |
| **VO-3**| `PriceVersion` | Embedded Value Object | Integer on `GroupPricingAgreement`| **MISSING** | Embedded Column | Immutable version tracking number on catalog rows. | Matches `center/agreement.ts` versioning. | **PROVISIONAL PROPOSAL** |
| **VO-4**| `AgreementPriceSnapshot`| Embedded Value Object | Inline on `StudentAgreement` | **MISSING** | Embedded Columns | Frozen agreed tuition rate, discount %, and net contractual fee. | Matches `center/agreement.ts` freeze logic (`OD-722.4`). | **PROVISIONAL PROPOSAL** |
| **VO-5**| `PaymentSchedule` | Embedded Value Object | Inline on `StudentAgreement` | **MISSING** | Embedded Columns | Settlement frequency, installment count, and plan terms. | Normalized into `PaymentScheduleItem` for relational tracking. | **PROVISIONAL PROPOSAL** |
| **VO-6**| `CompensationPolicyVersion`| Embedded Value Object | Column on `TeacherCompensation` | **MISSING** | Embedded Column | Version tracking column on teacher compensation contracts. | Matches `center/revenueRecognitionEngine.ts`. | **GATED BY UP-704** |
| **SR-1**| `JournalEntry.reversalOfEntryId`| Self-Referential Relational Attr | Foreign Key on `JournalEntry` | **MISSING** | Self-Relation FK | Points compensating reversal entry to original entry. | Matches `journalEntry.ts` reversal logic. | **GATED BY UP-701** |
| **SR-2**| `Account.parentId` | Self-Referential Relational Attr | Foreign Key on `Account` | **MISSING** | Self-Relation FK | Hierarchical parent-child tree for Chart of Accounts. | Matches `account.ts` account hierarchy. | **GATED BY UP-701** |
| **PR-1**| `StudentFinancialAccount.currentBalance`| Derived Real-Time Projection | Computed Value | **MISSING** | Dynamic Query / Computed Aggregate | Calculated sum of mature schedule items minus allocated receipts. | Matches `center/subLedger.ts` `assertConservation()`. | **PROVISIONAL PROPOSAL** |
| **PR-2**| `Cashbox.currentBalance` | Derived Real-Time Projection | Denormalized Column + Ledger | **MISSING** | Cached Column (`Decimal`) | Cached till balance verified against sum of `CashboxMovement` rows. | Matches `center/cashbox.ts` balance calculations. | **PROVISIONAL PROPOSAL** |
| **AL-1**| `PriceCatalog` | Canonical Table Alias | `GroupPricingAgreement` | **ALIAS** | Physical Alias | Physically implemented by `GroupPricingAgreement` (Concept #11). | Matches `center/agreement.ts`. | **APPROVED** (Phase 2.0A.3 Taxonomy) |
| **AL-2**| `CashboxTransfer` | Canonical Table Alias | `CashboxTransferRequest` | **ALIAS** | Physical Alias | Physically implemented as split transfer request from #17. | Matches `center/cashbox.ts` transfer state machine. | **APPROVED** (Phase 2.0A.3 Taxonomy) |
| **AL-3**| `RefundRequest` | Canonical Table Alias | `FinancialAdjustment` | **ALIAS** | Physical Alias | Physically implemented by `FinancialAdjustment` (`type = REFUND`). | Matches `center/subLedger.ts` refund adjustment. | **APPROVED** (Phase 2.0A.3 Taxonomy) |
| **EXT-1**| `LessonDeliveryEvidence` | Domain 7 Extension Table | `LessonDeliveryEvidence` | **MISSING** | Extension Table | Supervisor-certified lesson delivery proof. Anchors to `Lesson`. | Matches `center/evidence.ts` class invariants. | **PROVISIONAL PROPOSAL** (Awaiting PO Authorization) |
| **EXT-2**| `SessionPackage` | Domain 7 Extension Table | Embedded in `StudentAgreement` | **MISSING** | Embedded Value Object | Prepaid educational session allocation (`UP-714`, `OD-722.4`). | Matches `center/revenueAllocation.ts`. | **PROVISIONAL PROPOSAL** (Awaiting PO Authorization) |
| **EXT-3**| `RevenueRecognitionEvent` | Domain 7 Extension Table | `RevenueRecognitionEntry` | **MISSING** | Extension Table | Dual-prerequisite earned revenue entry under equal session valuation. | Matches `center/revenueRecognitionEngine.ts`. | **PROVISIONAL PROPOSAL** (Awaiting PO Authorization) |

---

## 3. Resolution of StudentFinancialAccount Persistence, Tenant Uniqueness & Projections

### 3.1 Clarification of the Persistence Lifecycle vs. Dynamic Projection
In the authoritative Phase 2.0A.3 baseline, `StudentFinancialAccount` is Canonical Table #5. The distinction between the persisted relational entity and its computed projection is formally defined as follows:

1. **The Persisted Relational Entity (`StudentFinancialAccount`):**  
   - **Lifecycle & Persistence:** An independent physical relational table in PostgreSQL. It is created when a student is onboarded or first enrolled in an educational program, and remains permanently persisted across the student's entire academic lifecycle.
   - **Identity & Continuity:** Stores the student's canonical Accounts Receivable sub-ledger profile (`accountNumber`), institutional tenant anchor (`institutionId`), user link (`studentId`), operational status (`ACTIVE`, `SUSPENDED`, `CLOSED`), and audit timestamps.
   - **Relational Integrity:** Anchors all of the student's contractual agreements (`StudentAgreement[]`), collection receipts, and financial adjustments. If a student transfers campuses, completes a course, or temporarily withdraws, the `StudentFinancialAccount` entity survives with unbroken financial audit continuity.
2. **Tenant-Scoped Uniqueness & Relational Isolation Analysis:**  
   - Declaring `studentId String @unique` globally was a defect because it prevented a student identity (`User`) from holding separate financial accounts across different institutions in a multi-tenant SaaS.
   - The model introduces **institution-scoped composite uniqueness**:
     $$\texttt{@@unique([institutionId, studentId])}$$
     $$\texttt{@@unique([institutionId, accountNumber])}$$
   - This ensures a student user can have at most one financial account per institution, preventing duplicate accounts within the same institution.
   - **Critical Tenant Isolation Guarantee Limitation & A1 Validation Requirement:**  
     - While `@@unique([institutionId, studentId])` prevents duplicate accounts within an institution, it does **NOT** by itself prove or enforce at the database constraint level that the referenced `User` belongs to that institution.
     - Inspection of `packages/database/prisma/schema.prisma` reveals that `User` has `institutionId String?` (nullable) and `branchId String?` (nullable), and `StudentFinancialAccount` defines two independent foreign keys:
       1. `institutionId REFERENCES Institution(id)`
       2. `studentId REFERENCES User(id)`
     - Mechanically enforcing tenant consistency at the relational level would require a composite foreign key constraint:
       $$\texttt{FOREIGN KEY ("institutionId", "studentId") REFERENCES "User"("institutionId", "id")}$$
       which in turn requires a composite unique key `@@unique([institutionId, id])` on `User`. That constraint does **not** currently exist on `User`.
     - Altering `User`'s identity structure or adding composite unique constraints could impact global user authentication or existing multi-role workflows.
     - Therefore, database-level enforcement of tenant consistency across independent FKs cannot yet be proven without altering `User`'s identity structure. This is explicitly designated as an **A1 schema-design validation requirement** (to evaluate composite foreign keys vs. middleware/domain guard validation in Workstream B) rather than claiming independent foreign keys alone mechanically prevent cross-tenant references.

### 3.2 Proposed Compatible Prisma Model:
```prisma
model StudentFinancialAccount {
  id            String       @id @default(uuid())
  institutionId String
  studentId     String       // Not globally unique; scoped per institution
  accountNumber String       // e.g. AR-STU-2026-0001
  status        String       @default("ACTIVE") // ACTIVE, SUSPENDED, CLOSED
  createdAt     DateTime     @default(now())
  updatedAt     DateTime     @updatedAt

  institution   Institution  @relation(fields: [institutionId], references: [id], onDelete: Restrict)
  student       User         @relation(fields: [studentId], references: [id], onDelete: Restrict)
  agreements    StudentAgreement[]
  adjustments   FinancialAdjustment[]

  @@unique([institutionId, studentId])
  @@unique([institutionId, accountNumber])
  @@index([institutionId, studentId])
}
```

### 3.3 Student Balance Projection Semantics (Three Distinct Financial Values)
In strict adherence to double-entry sub-ledger conservation, the student's balance is **not a single mutable column**. Across the accepted Phase 2 Student Financial Profile specifications (`SFP-01` to `SFP-08`), three distinct balance values are dynamically derived:

1. **Total Remaining Balance (المتبقي للسداد الإجمالي):**  
   - **Definition:** All unpaid contractual obligations across the agreement lifecycle, including future-due obligations whose due dates have not yet arrived.
   - **Formula:**
     $$\text{Total Remaining Balance} = \text{Total Net Agreement Amount} - \text{Total Allocated Collections}$$
   - **Authoritative Baseline Example (`SFP-01`):**  
     Contract net amount is $5,500.00\text{ EGP}$; allocated collections to date are $1,750.00\text{ EGP}$. Total Remaining Balance is exactly **$3,750.00\text{ EGP}$**.
2. **Currently Due (المستحق حالياً):**  
   - **Definition:** Unpaid contractual milestone obligations whose due date has arrived ($\text{dueDate} \le \text{today}$), according to the institution's applicable approved due-date policy.
   - **Formula:**
     $$\text{Currently Due} = \sum_{\text{dueDate} \le \text{today}} \text{Unpaid Obligation Amount}$$
3. **Overdue (المتأخرات):**  
   - **Definition:** Unpaid contractual milestone obligations whose due date has passed ($\text{dueDate} < \text{today}$), according to the applicable approved policy.
   - **Formula:**
     $$\text{Overdue} = \sum_{\text{dueDate} < \text{today}} \text{Unpaid Obligation Amount}$$

> [!NOTE]
> **Policy Boundary on Financial Grace Periods:**  
> No financial grace period has been authorized or approved by the Product Owner. If future operational requirements require a grace period before an obligation transitions from Currently Due to Overdue, this is formally documented as an **unresolved Product Owner policy decision** and must not be pre-empted in schema or calculation formulas.

#### Balance Reduction, Explicit Allocation & Non-Recognition Rules:
* **No Automatic FIFO or Implicit Allocation Priority:** In strict accordance with Phase 2.0B Increment 3 (`packages/shared/src/accounting/center/subLedger.ts`), cash collections do **NOT** automatically cascade across obligations via FIFO waterfall. There is no implicit prioritization between overdue, currently due, or future obligations.
* **Explicit Allocation Targets:** Collections reduce specific milestone obligations **ONLY** through explicit allocation targets (`allocate()` or `allocateMultiObligations()`).
* **Unallocated Customer Advances:** Any collection amount not explicitly allocated to a milestone obligation remains as an unallocated customer advance (`unallocatedAmount` on the receipt), representing a customer advance liability rather than an obligation reduction.
* **Append-Only Reversals:** Allocation reversals (`reverseAllocation()`) restore the corresponding receipt unallocated balance and obligation remaining due balance without mutating or deleting historical records.
* **Cash Collection Never Recognizes Revenue:** Intake receipts establish physical cash in the till and reduce Accounts Receivable (or establish customer advances); earned revenue is recognized **ONLY** upon supervisor-certified physical delivery evidence under `OD-722.4`.

---

## 4. Resolution of the CashboxTransaction Operational Split (Provisional)

### 4.1 The Canonical Baseline vs. Operational Reality
In the Phase 2.0A.3 baseline, `CashboxTransaction` (Table #17) was defined as a single relational table. In Phase 2 UI/UX and Increment 4 domain implementation (`packages/shared/src/accounting/center/cashbox.ts`), physical center cash operations involve three distinct operational lifecycles:

1. **`CashboxMovement` (Append-Only Till Ledger):**  
   - Lifecycle: Instantaneous, atomic, immutable.
   - Purpose: Records every physical debit or credit to a till with `balanceBefore` and `balanceAfter`.
   - Concurrency: High frequency (cash desk collections). Cannot be locked waiting for management approvals.
2. **`CashboxTransferRequest` (5-Stage Maker-Checker Transfer Workflow):**  
   - Lifecycle: Asynchronous state machine (`DRAFT` $\to$ `PENDING_APPROVAL` $\to$ `APPROVED` $\to$ `IN_TRANSIT` $\to$ `COMPLETED`).
   - Purpose: Governs inter-cashbox transfers (e.g. #TRF-104 transferring 1,500 EGP from Dokki till `CB-01` to Main Safe `CB-MAIN`).
   - Concurrency: Involves multiple actors across hours or days.
3. **`ExpenseVoucher` (Petty Cash Maker-Checker Disbursement):**  
   - Lifecycle: Drafted by Accountant, approved by Primary Manager, disbursed by Cashier.
   - Purpose: Governs operational center expenses before cash leaves the till.

### 4.2 How the Split Preserves All Accounting Invariants
* **Transaction Identity & Audit History:** Every operational event produces immutable `CashboxMovement` lines referencing the parent `CashboxTransferRequest.id` or `ExpenseVoucher.id`.
* **Two-Sided Transfer Movement:** In-transit cash is tracked in real-time. Total institutional cash position ($87,900.00\text{ EGP}$) is conserved at every moment:
  $$\text{Total Institutional Cash} = \sum \text{Active Cashboxes} + \sum \text{In-Transit Transfers} \equiv 87,900.00\text{ EGP}$$
* **Append-Only Reversal Semantics:** Movements and transfer requests are never deleted. Reversed transactions append a compensating `CashboxMovement` line with `referenceType = 'REVERSAL'`.
* **Reconciliation Calculations:** Shift close reconciliation (`DailyCashboxReconciliation`) aggregates `CashboxMovement` rows directly (`Expected = Opening + Inflows - Outflows`), decoupled from pending transfer drafts.
* **Compatibility with Increment 4 Contracts:** Directly mirrors classes `Cashbox`, `CashboxMovement`, `CashboxTransferEngine`, and `DailyCashboxReconciliation`.

> [!IMPORTANT]
> **GOVERNANCE STATUS:**  
> The 3-table split remains **PROVISIONAL** and is **NOT approved by the Product Owner**. It is submitted for explicit review and authorization.

---

## 5. Resolution of PaymentSchedule and PaymentScheduleItem

* **Canonical Classification:** `PaymentSchedule` remains the **Embedded Value Object (VO-5)** on `StudentAgreement` defining the contractual installment frequency and terms.
* **Persistence Implementation of `PaymentScheduleItem`:** It is the **relational normalization of Canonical Table #8 (`StudentObligation`)**:
  - Enforces milestone-specific due dates and billed amounts.
  - Enables partial collections and multi-receipt allocations via `PaymentAllocation`.
  - Tracks milestone settlement status (`isSatisfied = true` when remaining balance reaches `0.00`).
  - Preserves agreement immutability once executed (milestone settlement progress is updated without mutating the signed agreement header).
* **Governance Status:** Explicitly classified as an **implementation extension / relational normalization** of Table #8, not an unauthorized taxonomy change.

---

## 6. Validation of Revenue Recognition Persistence, Idempotency & Hybrid Allocation

### 6.1 Exact Domain Idempotency Identity (Increment 2 Contract)
In the accepted Increment 2 engine (`packages/shared/src/accounting/center/revenueRecognitionEngine.ts`), the domain idempotency identity is:
$$\text{idempotencyKey} = \texttt{REV\_REC\_\{institutionId\}\_\{agreementId\}\_\{evidenceId\}\_\{studentId\}}$$

#### Defect in Previous Proposal:
The provisional constraint `@@unique([agreementId, evidenceId])` was architecturally flawed because a group classroom lesson delivery (`evidenceId`) has **multiple students in attendance**. While each student has a separate `agreementId`, enforcing a generic pair could cause edge-case collisions or fail to enforce the student-level consumption rule (`hasConsumed(evidenceId, studentId)`).

#### Exact Prisma Uniqueness Strategy:
To preserve institution isolation, agreement identity, evidence identity, student identity, replay idempotency, and post-reversal locks:
1. **Explicit Domain Idempotency Column:**
   ```prisma
   idempotencyKey String @unique // Exact domain format: REV_REC_${institutionId}_${agreementId}_${evidenceId}_${studentId}
   ```
2. **Composite Business Constraint:**
   ```prisma
   @@unique([institutionId, evidenceId, studentId])
   ```
   * *Preserves Multi-Student Recognition:* Multiple students (Student A, Student B) can receive recognition against the same delivery evidence (`evidenceId`) because `studentId` differs.
   * *Prevents Cross-Agreement Duplicate Consumption:* A student cannot have revenue recognized more than once for the same delivery evidence under ANY agreement (`hasConsumed(evidenceId, studentId)`).
   * *Preserves Replay Idempotency:* Querying by `idempotencyKey` returns the existing record with `isIdempotentReplay: true` when `status === 'POSTED'`.
   * *Duplicate Prevention After Reversal:* When reversed, the record status transitions to `REVERSED`. Because the record remains in PostgreSQL with its unique `idempotencyKey`, any subsequent recognition attempt with that same key fails closed with `InvalidEvidenceError`, matching the Increment 2 domain specification.

---

### 6.2 Hybrid Agreement Revenue Allocation — UP-714 vs. OD-722.4
Under approved `UP-714` (Hybrid Package Allocation: Physical Campus vs Digital LMS Platform):

1. **Itemized Unbundled Allocations:**  
   Commercial student agreements for hybrid courses contain separate, immutable allocated amounts:
   - **Physical Campus Education Allocation (`physicalTuitionAmount`):** Attributed to physical campus classrooms and physical center operations.
   - **Digital LMS Platform Service Allocation (`digitalPlatformFee`):** Attributed to online digital platform access.
   - **Strict Mathematical Invariant:**
     $$\text{Physical Campus Allocation} + \text{Digital LMS Allocation} \equiv \text{Net Agreement Amount}$$
2. **Equal-Session Valuation Bound to Physical Allocation (`OD-722.4`):**  
   Equal-session revenue valuation applies **ONLY** to the eligible physical campus education allocation (`physicalCampusAmount`):
   $$\text{Physical Session Service Value} = \frac{\text{Physical Campus Allocation}}{\text{Total Physical Course Sessions}}\quad (\text{Deterministic HALF\_UP Rounding})$$
   Standard units allocate $\texttt{standardUnitValue} = \texttt{physicalCampusAmount.divide(totalEligibleUnits, 'HALF\_UP')}$ per Phase 2.0B Increment 2 (`revenueAllocation.ts` line 128). The final eligible physical session absorbs any remaining minor-unit rounding difference. The digital LMS portion (`digitalPlatformAmount`) must **NEVER** be allocated across physical classroom lessons.
3. **Scope Boundary Enforcement:**  
   Digital recurring billing and digital earned revenue recognition remain **DEFERRED** out of current scope under the physical-centers-first rollout.
4. **Identification of Required Domain Contract Extension:**  
   The existing accepted domain class `AgreementPriceSnapshot` (`packages/shared/src/accounting/center/agreement.ts`) currently stores `catalogPrice`, `discountAmount`, and `netAgreedPrice`, but does not yet contain itemized properties for `physicalCampusAmount` and `digitalPlatformAmount`.  
   > [!IMPORTANT]
   > **DOMAIN CONTRACT EXTENSION REQUIRING PO APPROVAL:**  
   > To support UP-714 cleanly, `AgreementPriceSnapshot` must be extended with:
   > ```typescript
   > export interface HybridAllocationBreakdown {
   >   physicalCampusAmount: Money;
   >   digitalPlatformAmount: Money;
   > }
   > ```
   > enforcing `physicalCampusAmount.add(digitalPlatformAmount).equals(netAgreedPrice)`.  
   > This extension is formally identified and marked for **explicit Product Owner authorization before implementation**.

---

### 6.3 Deterministic Reconstruction & Persistence of `RevenueAllocationPlan`
`RevenueAllocationPlan` is the service value allocation engine governing equal-session revenue recognition (`OD-722.4`, `UP-714`). Its persistence and deterministic reconstruction are defined as follows:

1. **Source of Immutable Agreed Net Price:**  
   Retrieved directly from the contractual price snapshot on `StudentAgreement`:
   $$\text{netAgreedPrice} = \texttt{StudentAgreement.physicalTuitionAmount}\ (\text{under UP-714})$$
   Frozen at agreement execution; never mutates when course catalog prices change.
2. **Approved Equal-Session Allocation Basis:**  
   Retrieved from the contractual course curriculum length:
   $$\text{totalEligibleUnits} = \texttt{StudentAgreement.totalSessionsCount}$$
3. **Deterministic Unit Rate & Rounding Remainder Preservation:**  
   In `packages/shared/src/accounting/center/revenueAllocation.ts`:
   - Standard units allocate: $\texttt{standardUnitValue} = \texttt{netAgreedPrice.divide(totalEligibleUnits, 'HALF\_UP')}$.
   - On the final eligible unit ($\text{unitIndex} \ge \text{totalEligibleUnits}$), the engine calculates:
     $$\text{Final Unit Amount} = \text{netAgreedPrice} - \sum \text{Previously Recognized Amounts}$$
   - This deterministically absorbs all fractional piasters/pennies, ensuring cumulative recognized revenue exactly matches `netAgreedPrice`.
4. **Reproducibility After Agreement Changes:**  
   Because `StudentAgreement` is immutable and every `RevenueRecognitionEntry` permanently records `amountRecognized`, `unitIndex`, and links to `LessonDeliveryEvidence`, the entire recognition history remains 100% reproducible and verifiable from persisted rows.
5. **Persistence Model Determination:**  
   A separate mutable `RevenueAllocationPlan` table is **NOT strictly required** because the plan is deterministically reconstructed in memory via `RevenueAllocationPlan.fromAgreement(agreement, totalSessions, recognizedCount, accumulatedAmount)`.  
   *(If the Product Owner prefers an explicit persisted table, an optional header model `RevenueAllocationPlan` can be introduced in Workstream A; both approaches are architecturally valid).*

---

## 7. Specialist Governance & Statutory Boundaries

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

## 8. Accurate Migration Safety Classification

Migration readiness is classified across five distinct technical levels:

| Verification Level | Technical Scope | Status in Step A0 | Assessment & Constraints |
| :--- | :--- | :---: | :--- |
| **Level 1: Design-Level Safety Assessment** | Evaluation of proposed DDL structure, constraints, and non-destructive properties. | **`SATISFIED`** | Proposed DDL is strictly additive (no `DROP TABLE`, no `DROP COLUMN`); all foreign keys specify `ON DELETE RESTRICT`. |
| **Level 2: Static Schema Validation** | Syntax and relational consistency check via Prisma ORM CLI. | **`PENDING STEP A1`** | Will be executed in Step A1 via `npx prisma validate`. |
| **Level 3: Migration Execution Testing** | Generating and applying DDL against a live PostgreSQL database. | **`PENDING STEP A3`** | Cannot be executed in read-only Step A0; requires Step A3 execution against staging database. |
| **Level 4: Database Integrity Verification** | Verifying accessibility and integrity of existing academic data post-migration. | **`PENDING STEP A3`** | Requires post-migration query verification in staging. |
| **Level 5: Rollback Execution Testing** | Executing reverse DDL against a migrated database to prove safe recovery. | **`PROPOSED STRATEGY`** | The rollback script in Step A0 is a **proposed rollback strategy / draft script**, NOT an executed or verified script. Verification will occur in Step A5. |

---

## 9. Formal Product Owner Authorizations Required Before Step A1

The following specific architectural decisions are submitted for Product Owner authorization:
1. **Authorization of `StudentFinancialAccount` Persisted Model:** Authorize `StudentFinancialAccount` as the master AR subledger profile with institution-scoped uniqueness `@@unique([institutionId, studentId])` and `@@unique([institutionId, accountNumber])`.
2. **Authorization of Hybrid Revenue Allocation Extension (`UP-714`):** Authorize extending `AgreementPriceSnapshot` with `physicalCampusAmount` and `digitalPlatformAmount`, ensuring `OD-722.4` applies strictly to physical tuition.
3. **Authorization of the 3-Table `CashboxTransaction` Split (PROVISIONAL):** Authorize separating till movements (`CashboxMovement`), transfer workflows (`CashboxTransferRequest`), and petty cash disbursements (`ExpenseVoucher`) as an internal persistence adapter.
4. **Authorization of `PaymentScheduleItem` Persistence:** Authorize `PaymentScheduleItem` as the relational implementation of Canonical Table #8 (`StudentObligation`).
5. **Authorization of Revenue Recognition Idempotency Strategy:** Authorize `idempotencyKey String @unique` and `@@unique([institutionId, evidenceId, studentId])` on `RevenueRecognitionEntry`.
