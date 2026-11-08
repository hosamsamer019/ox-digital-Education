# OX-DIGITAL Education — Phase 4: Workstream A
## Step A1: Prisma Financial Schema Drafting & Syntax Validation
### Deliverable 2: Canonical Model Mapping & Architectural Taxonomy

**Workspace:** `D:\OX-DIGITAL\Mathe\OX-DIGITAL-GITHUB`  
**Target:** `docs/phase-4/workstream-a/step-a1/CANONICAL_MODEL_MAPPING.md`  
**Execution Authorization:** EXPLICITLY APPROVED BY PRODUCT OWNER FOR STEP A1 ONLY  
**Date:** November 4, 2026  
**Author:** Lead Software Architect & Financial Systems Designer  

---

## 1. Executive Summary

This document establishes the authoritative, one-to-one mapping between the canonical financial entity taxonomy (defined in `ACCOUNTING_PHASE_2_0A_3_ENTITY_COUNT_AND_LIFECYCLE_AUDIT.md` and reconciled in Step A0) and the concrete Prisma schema models implemented in Step A1.

In strict compliance with the Product Owner's instructions:
1. **Canonical Naming is Preserved:** Models use their canonical names (`StudentFinancialAgreement`, `StudentObligation`, `Collection`, `CollectionAllocation`, `CashboxReconciliation`, `CashboxTransaction`).
2. **Canonical Cashbox Model Preserved:** `CashboxTransaction` is implemented as the single, authoritative append-only physical cash ledger. It was **NOT** silently replaced with a split into multiple independent movement ledgers.
3. **Specialist Gates Enforced:** All 6 specialist-gated models remain completely deferred.

---

## 2. Complete Taxonomy Mapping Table

The table below reconciles all 20 canonical baseline concepts, embedded value objects, self-relations, projections, and Domain 7 extensions against the Step A1 Prisma schema:

| Canonical ID | Canonical Entity Name | Baseline Classification | Prisma Model Name (Step A1) | Persistence Status in A1 | Architectural Rationale & Implementation Details |
| :---: | :--- | :--- | :--- | :---: | :--- |
| **1** | `Institution` | Persisted Table (Enhanced Core) | `Institution` | **PRE-EXISTING** | Preserved tenant root. Added 14 back-relation array fields for financial models. |
| **2** | `Branch` | Persisted Table (Enhanced Core) | `Branch` | **PRE-EXISTING** | Preserved operating branch dimension. Added 11 back-relation array fields for branch-scoped financial models. |
| **3** | `Account` | Persisted Table (GL Master) | `Account` | **DEFERRED (UP-701)** | Blocked pending Egyptian Chartered Accountant statutory review. Zero models created. |
| **4** | `AccountingPeriod` | Persisted Table (GL Boundary) | `AccountingPeriod` | **DEFERRED (UP-701)** | Blocked pending Egyptian Chartered Accountant statutory review. Zero models created. |
| **5** | `StudentFinancialAccount` | Persisted Table (Master AR) | `StudentFinancialAccount` | **IMPLEMENTED** | Implemented as a physical relational table. Master subledger profile anchoring agreements and adjustments. Enforces `@@unique([institutionId, studentId])` and `@@unique([institutionId, accountNumber])`. |
| **6** | `GroupPricingAgreement` | Persisted Table (Tier Pricing) | `GroupPricingAgreement` | **IMPLEMENTED** | Implemented as a physical relational table. Scoped to `institutionId`, optional `branchId`, `centerGroupId`, and `courseId`. |
| **7** | `StudentFinancialAgreement` | Persisted Table (Contract) | `StudentFinancialAgreement` | **IMPLEMENTED** | Implemented as a physical relational table. Commercial center attendance agreement. Encapsulates hybrid allocation (`UP-714`) via `physicalCampusAmount` and `digitalPlatformAmount`. |
| **8** | `StudentObligation` | Persisted Table (Milestones) | `StudentObligation` | **IMPLEMENTED** | Implemented as a physical relational table. Concrete relational normalization of milestone installment obligations (`amountDue`, `dueDate`, `amountCollected`, `status`). |
| **9** | `Collection` | Persisted Table (Intake Receipts) | `Collection` | **IMPLEMENTED** | Implemented as a physical relational table. Verified proof of cash/POS fee receipt at center cash desk (`receiptNumber`, `amountCollected`, `unallocatedAmount`). |
| **10**| `CollectionAllocation` | Persisted Table (Allocation Bridge) | `CollectionAllocation` | **IMPLEMENTED** | Implemented as a physical relational table. Immutable bridge linking a collection receipt to a specific `StudentObligation` via explicit target allocation (`allocate()`). |
| **11**| `FinancialAdjustment` | Persisted Table (Reversals/Refunds) | `FinancialAdjustment` | **IMPLEMENTED** | Implemented as a physical relational table. Governs credit notes, debit notes, fee waivers, and refund requests under `UP-706` / `UP-709`. |
| **12**| `JournalEntry` | Persisted Table (GL Header) | `JournalEntry` | **DEFERRED (UP-701)** | Blocked pending Egyptian Chartered Accountant statutory review. Zero models created. |
| **13**| `JournalLine` | Persisted Table (GL Line Item) | `JournalLine` | **DEFERRED (UP-701)** | Blocked pending Egyptian Chartered Accountant statutory review. Zero models created. |
| **14**| `FinancialIdempotencyRecord`| Persisted Table (Deduplication) | `FinancialIdempotencyRecord` | **IMPLEMENTED** | Implemented as a physical relational table. Technical deduplication key store preventing duplicate collections, recognition, or transfers. |
| **15**| `FinancialAuditEvent` | Persisted Table (Forensic Vault) | `FinancialAuditEvent` | **IMPLEMENTED** | Implemented as a physical relational table. Forensic immutable audit trail recording all financial state transitions with actor and role attribution. |
| **16**| `Cashbox` | Persisted Table (Physical Till/Safe) | `Cashbox` | **IMPLEMENTED** | Implemented as a physical relational table. Master register for physical campus till boxes (`code`, `currentBalance`, `currency = "EGP"`). |
| **17**| `CashboxTransaction` | Persisted Table (Till Ledger) | `CashboxTransaction` | **IMPLEMENTED** | Implemented as a physical relational table. Baseline canonical movement ledger recording all till movements, inter-cashbox transfers, and compensating reversals. |
| **18**| `CashboxReconciliation` | Persisted Table (Shift Snapshot) | `CashboxReconciliation` | **IMPLEMENTED** | Implemented as a physical relational table. Daily closing shift reconciliation snapshot. Isolates discrepancies under `UP-705` (`reconciliationId`, `expectedClosingBalance`, `difference`). |
| **19**| `TeacherCompensationAgreement` | Persisted Table (Teacher Pay) | `TeacherCompensationAgreement` | **DEFERRED (UP-704)** | Blocked pending variable compensation base resolution. Zero models created. |
| **20**| `TeacherPayable` | Persisted Table (Accrued Pay) | `TeacherPayable` | **DEFERRED (UP-704)** | Blocked pending teacher forfeiture/payment rule resolution. Zero models created. |
| **VO-1**| `Money` | Embedded Value Object | Embedded Columns | **IMPLEMENTED** | Stored as `Decimal @db.Decimal(12, 2)` across all monetary fields. Integer minor units (piasters) mapped with zero floating-point error. |
| **VO-2**| `Currency` | Embedded Value Object | Column `currency` | **IMPLEMENTED** | Stored as `currency String @default("EGP")` across models. Multi-currency disabled. |
| **VO-3**| `AgreementPriceSnapshot` | Embedded Value Object | Embedded Columns | **IMPLEMENTED** | Embedded on `StudentFinancialAgreement` as `catalogPrice`, `discountAmount`, `netAgreedPrice`, `physicalCampusAmount`, and `digitalPlatformAmount`. |
| **VO-4**| `PaymentArrangementScheduleItem` | Embedded Value Object | `StudentObligation` | **IMPLEMENTED** | Normalized into persisted relational model `StudentObligation` to support partial payments and multi-receipt allocations. |
| **VO-5**| `PaymentSchedule` | Embedded Value Object | Contract Schedule Structure | **IMPLEMENTED** | Represented structurally through the collection of `StudentObligation` items linked to `StudentFinancialAgreement`. |
| **VO-6**| `AccountingDimension` | Embedded Value Object | Deferred | **DEFERRED (UP-701)** | Deferred with General Ledger models under Gate `UP-701`. |
| **SR-1**| `JournalEntry.reversalOf` | Self-Referential Relation | Deferred | **DEFERRED (UP-701)** | Deferred with `JournalEntry` under Gate `UP-701`. |
| **SR-2**| `CashboxTransfer.reversalOf` | Self-Referential Relation | Embedded Fields | **IMPLEMENTED** | Modeled in `CashboxTransaction` via `counterpartTransactionId`, `referenceId`, and reversal audit columns (`reversedAt`, `reversedBy`, `reversalReason`). |
| **PR-1**| `StudentFinancialAccount.currentBalance` | Derived Real-Time Projection | Computed Projection | **IMPLEMENTED** | Dynamically computed query projection across `StudentObligation` and `CollectionAllocation`. Zero mutable database column. |
| **PR-2**| `Cashbox.currentBalance` | Derived Real-Time Projection | Monitored Aggregate Column | **IMPLEMENTED** | Maintained on `Cashbox` and verified against the sum of `CashboxTransaction` rows and shift reconciliations. |
| **EXT-1**| `LessonDeliveryEvidence` | Domain 7 Extension Table | `LessonDeliveryEvidence` | **IMPLEMENTED** | Supervisor-certified lesson delivery proof linking syllabus, lesson, teacher, supervisor, and physical campus branch verification. |
| **EXT-2**| `SessionPackage` | Domain 7 Extension Table | Embedded Columns | **IMPLEMENTED** | Embedded in `StudentFinancialAgreement` via `totalSessionsCount` and `physicalCampusAmount`. |
| **EXT-3**| `RevenueRecognitionEntry` | Domain 7 Extension Table | `RevenueRecognitionEntry` | **IMPLEMENTED** | Dual-prerequisite earned revenue entry calculated via equal session valuation (`OD-722.4`, `UP-714`). |

---

## 3. Preservation of Canonical Naming vs. Provisional Proposals

In Step A0, several provisional model names were suggested to align with TypeScript class names in `packages/shared/src/accounting/center/`. In Step A1, the schema strictly adheres to the **canonical baseline names**:

| Canonical Baseline Name | Step A0 Provisional Name | Step A1 Schema Decision | Rationale |
| :--- | :--- | :--- | :--- |
| **`CashboxTransaction`** | `CashboxMovement` + `CashboxTransferRequest` + `ExpenseVoucher` | **`CashboxTransaction` PRESERVED** | Preserves the single canonical cash movement ledger. Prevents creating a second independent financial movement ledger. Atomic transfers are linked via `counterpartTransactionId` and `referenceId`. |
| **`CashboxReconciliation`** | `DailyCashboxReconciliation` | **`CashboxReconciliation` PRESERVED** | Matches canonical entity Table #18 while fully satisfying the `CashboxDailyReconciliation` domain specification. |
| **`StudentFinancialAgreement`** | `StudentAgreement` | **`StudentFinancialAgreement` PRESERVED** | Explicitly reflects commercial financial contract nature and eliminates any ambiguity with academic course enrollments. |
| **`StudentObligation`** | `PaymentScheduleItem` | **`StudentObligation` PRESERVED** | Retains canonical subledger terminology for amounts due, avoiding customer-facing installment terminology. |
| **`Collection`** | `CollectionReceipt` | **`Collection` PRESERVED** | Matches canonical Table #9 as the foundational fee collection entity. |
| **`CollectionAllocation`** | `PaymentAllocation` | **`CollectionAllocation` PRESERVED** | Matches canonical Table #10 and shared domain event `CollectionAllocationRecordedEvent`. |

---

## 4. Preservation of the Canonical `CashboxTransaction` Model

The Product Owner explicitly instructed:
> *"Use the canonical `CashboxTransaction` entity as the baseline. Do not silently replace it with the proposed split of `CashboxMovement`, `CashboxTransferRequest`, and `ExpenseVoucher`. Any implementation-level supporting types must preserve the canonical domain behavior and must not create a second independent financial movement ledger."*

### Architectural Evaluation & Implementation Details:
1. **Single Source of Cash Movement Truth:**  
   `CashboxTransaction` serves as the sole physical till ledger. Every physical inflow (`COLLECTION`), outflow (`EXPENSE`), and transfer movement (`TRANSFER_IN`, `TRANSFER_OUT`) produces exactly one immutable record in `CashboxTransaction` with `balanceAfter` and `timestamp`.
2. **Two-Sided Atomic Transfer Semantics:**  
   When funds are transferred from Till A (`CB-01`) to Till B (`CB-MAIN`):
   - A `TRANSFER_OUT` record is inserted for Till A with `counterpartCashboxId = 'CB-MAIN'`.
   - A `TRANSFER_IN` record is inserted for Till B with `counterpartCashboxId = 'CB-01'`.
   - Both transactions share the same transfer coordination reference (`referenceId = 'TRF-XXXX'`) and link directly to each other via `counterpartTransactionId`.
   - This guarantees atomic two-sided movement without requiring a second independent movement table.
3. **Expense Disbursements:**  
   Petty cash disbursements produce an `EXPENSE` movement in `CashboxTransaction` referencing the approved expense documentation via `referenceId` and `notes`.
4. **Append-Only Reversals:**  
   Transacting records are never updated or deleted. Reversals append compensating entries (`COLLECTION_REVERSED`, `EXPENSE_REVERSED`, `TRANSFER_REVERSED`) referencing the original transaction, while updating the original record's status to `REVERSED` with audit details (`reversedAt`, `reversedBy`, `reversalReason`).

