# OX-DIGITAL Education — Phase 4: Workstream A
## Step A1: Prisma Financial Schema Drafting & Syntax Validation
### Deliverable 1: Prisma Schema Implementation Report

**Workspace:** `D:\OX-DIGITAL\Mathe\OX-DIGITAL-GITHUB`  
**Target File:** `packages/database/prisma/schema.prisma`  
**Execution Authorization:** EXPLICITLY APPROVED BY PRODUCT OWNER FOR STEP A1 ONLY  
**Date:** November 4, 2026  
**Author:** Lead Software Architect & Financial Systems Designer  
**Status:** **SATISFIED & STATICALLY VALIDATED (EXIT CODE 0)**

---

## 1. Executive Summary

In accordance with explicit Product Owner authorization for Step A1, the financial accounting schema required by the accepted domain architecture (Phase 2.0B Increments 1–4) and the finalized Step A0 pre-implementation design has been drafted directly into:
$$\texttt{packages/database/prisma/schema.prisma}$$

This implementation is strictly limited to Prisma schema drafting, back-relation wiring, and offline static/syntax validation. In compliance with Step A1 governance boundaries:
* **ZERO** database connections were established.
* **ZERO** SQL statements were executed.
* **ZERO** Prisma migration files were generated (the 5 historical migrations remain pristine).
* **ZERO** modifications were made to shared accounting domain code or application business logic.
* **ZERO** destructive changes were made to existing models; the legacy `Payment` table is 100% untouched.
* The schema was validated via `npx prisma validate` and formatted via `npx prisma format`, producing an exit code of `0` with the confirmation:  
  `The schema at prisma\schema.prisma is valid 🚀`

---

## 2. Canonical Financial Model Scope (14 Models Drafted)

The drafted schema introduces exactly **14 canonical financial models** across the frontline subledger, liquidity, and Domain 7 accrual revenue pillars:

```mermaid
graph TD
    Inst["Institution (Tenant Root)"] --> SFA["StudentFinancialAccount (Master AR)"]
    Inst --> Cashbox["Cashbox (Till / Safe)"]
    Inst --> GPA["GroupPricingAgreement (Tier Rules)"]
    Inst --> Idemp["FinancialIdempotencyRecord"]
    Inst --> Audit["FinancialAuditEvent"]

    SFA --> Agr["StudentFinancialAgreement (Commercial Contract)"]
    Branch["Branch (Physical Center)"] --> Cashbox
    Branch --> Agr

    Agr --> Oblig["StudentObligation (Milestones Due)"]
    Cashbox --> CBT["CashboxTransaction (Movement Ledger)"]
    Cashbox --> CBR["CashboxReconciliation (Shift Snapshot)"]

    Cashbox --> Coll["Collection (Intake Receipts)"]
    Oblig --> Alloc["CollectionAllocation (Bridge)"]
    Coll --> Alloc

    SFA --> Adj["FinancialAdjustment (Credit/Refund)"]
    Agr --> Adj

    Lesson["Lesson (Curriculum)"] --> LDE["LessonDeliveryEvidence (Certified Proof)"]
    Branch --> LDE
    Agr --> RevRec["RevenueRecognitionEntry (Accrued Revenue)"]
    LDE --> RevRec
```

### 2.1 Frontline Operational & Subledger Models (12 Models)
1. **`Cashbox` (Canonical Table #16):** Master register for physical campus till boxes and center safes. Stores `currentBalance` in `Decimal(12, 2)`, assigned cashier attribution, till status, and currency (`EGP`).
2. **`CashboxTransaction` (Canonical Table #17):** Append-only, immutable physical cash movement ledger. Records all inflows (`COLLECTION`), outflows (`EXPENSE`), inter-cashbox transfers (`TRANSFER_IN`, `TRANSFER_OUT`), and compensating reversals (`COLLECTION_REVERSED`, `EXPENSE_REVERSED`, `TRANSFER_REVERSED`).
3. **`CashboxReconciliation` (Canonical Table #18):** Daily closing shift reconciliation snapshot. Compares physical counted cash against expected book balance (`Expected = Opening + Inflows - Outflows`) and isolates discrepancies under Gate `UP-705`.
4. **`StudentFinancialAccount` (Canonical Table #5):** Master Accounts Receivable subledger account profile. Provides long-term financial continuity across student campus transfers and course completions. Enforces tenant-scoped composite uniqueness `@@unique([institutionId, studentId])` and `@@unique([institutionId, accountNumber])`.
5. **`StudentFinancialAgreement` (Canonical Table #7):** Commercial center attendance contract. Stores frozen agreed fee snapshots, curriculum session counts, and itemized hybrid package allocations (`physicalCampusAmount` and `digitalPlatformAmount`) under `UP-714`.
6. **`StudentObligation` (Canonical Table #8):** Relational normalization of scheduled milestone obligations due under an active agreement. Tracks `dueDate`, `amountDue`, `amountCollected`, and `status`.
7. **`Collection` (Canonical Table #9):** Verified proof of actual fee collection receipt issued at a center cash desk or POS terminal. Tracks sequential receipt serials (`REC-XXXX`), `amountCollected`, and unallocated customer advances (`unallocatedAmount`).
8. **`CollectionAllocation` (Canonical Table #10):** Immutable bridge record linking a collection receipt to a specific `StudentObligation`. Enforces explicit target allocation without automatic FIFO cascades.
9. **`FinancialAdjustment` (Canonical Table #11):** Governs credit notes, debit notes, fee waivers, and student refund requests subject to Egyptian Consumer Protection Law (Law 181/2018) under `UP-706` and `UP-709`.
10. **`GroupPricingAgreement` (Canonical Table #6):** Center-group or cohort-specific commercial pricing policies and group discount rules.
11. **`FinancialIdempotencyRecord` (Canonical Table #14):** Technical deduplication store preserving SHA-256 request hashes, operation types, and JSON responses to guarantee exactly-once mutation execution.
12. **`FinancialAuditEvent` (Canonical Table #15):** Immutable forensic audit trail capturing actor, role, target entity, previous state, new state, and IP address for all financial state transitions.

### 2.2 Domain 7 Accrual Revenue Extensions (2 Models)
13. **`LessonDeliveryEvidence` (Canonical Table #EXT-1):** Supervisor-certified classroom lesson delivery proof. Captures syllabi milestones, physical campus branch verification, student attendance count, and cryptographic digital signatures.
14. **`RevenueRecognitionEntry` (Canonical Table #EXT-3):** Dual-prerequisite earned revenue entry calculated via deterministic equal-session valuation (`OD-722.4`, `UP-714`). Requires certified delivery evidence AND student attendance status `PRESENT`. Enforces multi-student evidence sharing and replay idempotency via `REV_REC_${institutionId}_${agreementId}_${evidenceId}_${studentId}`.

### 2.3 Deferred Specialist-Gated Models (6 Models)
In strict compliance with governance instructions, the following 6 specialist-gated models were **NOT** implemented in Step A1:
* **General Ledger Models (Gated by Gate `UP-701`):** `Account`, `AccountingPeriod`, `JournalEntry`, `JournalLine`. Deferred pending statutory Chart of Accounts review by an Egyptian Chartered Accountant (محاسب قانوني).
* **Teacher Compensation Models (Gated by Gate `UP-704`):** `TeacherCompensationAgreement`, `TeacherPayable`. Deferred pending formal resolution of the teacher compensation base and forfeiture rules.

---

## 3. Financial Enums Added (14 Enums)

To govern domain state transitions with compile-time type safety, 14 specialized enums were added to `schema.prisma`:

| Enum Name | Canonical Values | Domain Purpose |
| :--- | :--- | :--- |
| `CashboxStatus` | `ACTIVE`, `INACTIVE`, `SUSPENDED` | Till operational lifecycle. |
| `CashMovementType` | `COLLECTION`, `EXPENSE`, `TRANSFER_IN`, `TRANSFER_OUT`, `COLLECTION_REVERSED`, `EXPENSE_REVERSED`, `TRANSFER_REVERSED` | Append-only movement types in till ledger. |
| `MovementStatus` | `POSTED`, `REVERSED` | Cashbox movement posting lifecycle. |
| `ReconciliationStatus` | `BALANCED`, `DISCREPANCY_PENDING_INVESTIGATION`, `DISCREPANCY_RESOLVED` | Daily shift reconciliation outcome. |
| `FinancialAccountStatus` | `ACTIVE`, `SUSPENDED`, `CLOSED` | Student AR master account lifecycle. |
| `AgreementStatus` | `DRAFT`, `ACTIVE`, `COMPLETED`, `TERMINATED`, `TRANSFERRED` | Student contractual lifecycle. |
| `ObligationStatus` | `PENDING`, `PARTIALLY_PAID`, `FULFILLED`, `OVERDUE`, `WAIVED` | Milestone payment schedule status. |
| `PaymentMethod` | `CASH`, `POS_CARD`, `BANK_TRANSFER`, `CHEQUE`, `OTHER` | Center collection payment instrumentation. |
| `CollectionStatus` | `COLLECTED`, `DEPOSITED`, `REVERSED` | Receipt custody and settlement status. |
| `AllocationStatus` | `ACTIVE`, `REVERSED` | Subledger milestone allocation state. |
| `AdjustmentType` | `CREDIT_NOTE`, `DEBIT_NOTE`, `FEE_WAIVER`, `REFUND_REQUEST`, `DISPUTE_ADJUSTMENT` | Formal subledger adjustment classification. |
| `AdjustmentStatus` | `DRAFT`, `PENDING_APPROVAL`, `APPROVED`, `REJECTED`, `APPLIED`, `REVERSED` | Maker-checker approval state machine. |
| `EvidenceStatus` | `PENDING`, `CERTIFIED`, `REJECTED`, `REVOKED` | Supervisor lesson certification lifecycle. |
| `RecognitionStatus` | `POSTED`, `REVERSED` | Earned revenue entry posting state. |

---

## 4. Back-Relations Added to Pre-Existing Core Models

To establish bidirectional relational navigation in Prisma without altering underlying database constraints or breaking existing features, the following back-relation array fields were added to pre-existing models:

### 4.1 On `Institution` (lines 31–47):
```prisma
  // Financial Accounting Models (Phase 4 Workstream A)
  cashboxes                   Cashbox[]
  cashboxTransactions        CashboxTransaction[]
  cashboxReconciliations      CashboxReconciliation[]
  studentFinancialAccounts    StudentFinancialAccount[]
  studentFinancialAgreements  StudentFinancialAgreement[]
  studentObligations          StudentObligation[]
  collections                 Collection[]
  collectionAllocations       CollectionAllocation[]
  financialAdjustments        FinancialAdjustment[]
  groupPricingAgreements      GroupPricingAgreement[]
  idempotencyRecords          FinancialIdempotencyRecord[]
  financialAuditEvents        FinancialAuditEvent[]
  lessonDeliveryEvidences     LessonDeliveryEvidence[]
  revenueRecognitionEntries   RevenueRecognitionEntry[]
```

### 4.2 On `Branch` (lines 70–83):
```prisma
  // Financial Accounting Models (Phase 4 Workstream A)
  cashboxes                   Cashbox[]
  cashboxTransactions        CashboxTransaction[]
  cashboxReconciliations      CashboxReconciliation[]
  studentFinancialAgreements  StudentFinancialAgreement[]
  studentObligations          StudentObligation[]
  collections                 Collection[]
  collectionAllocations       CollectionAllocation[]
  financialAdjustments        FinancialAdjustment[]
  groupPricingAgreements      GroupPricingAgreement[]
  lessonDeliveryEvidences     LessonDeliveryEvidence[]
  revenueRecognitionEntries   RevenueRecognitionEntry[]
```

### 4.3 On `User` (lines 154–174):
```prisma
  // Financial Accounting Back-Relations (Phase 4 Workstream A)
  assignedCashboxes                 Cashbox[]                   @relation("AssignedCashier")
  actorCashboxTransactions          CashboxTransaction[]        @relation("ActorCashboxTransactions")
  reconciledCashboxReconciliations  CashboxReconciliation[]     @relation("ReconciledByUser")
  studentFinancialAccounts          StudentFinancialAccount[]   @relation("StudentFinancialAccounts")
  studentFinancialAgreements        StudentFinancialAgreement[] @relation("StudentAgreements")
  studentObligations                StudentObligation[]         @relation("StudentObligations")
  cashierCollections                Collection[]                @relation("CashierCollections")
  studentCollections                Collection[]                @relation("StudentCollections")
  studentAllocations                CollectionAllocation[]      @relation("StudentAllocations")
  allocatedCollections              CollectionAllocation[]      @relation("AllocatedByCollections")
  preparedAdjustments               FinancialAdjustment[]       @relation("PreparedAdjustments")
  approvedAdjustments               FinancialAdjustment[]       @relation("ApprovedAdjustments")
  studentAdjustments                FinancialAdjustment[]       @relation("StudentAdjustments")
  financialAuditEvents              FinancialAuditEvent[]       @relation("ActorAuditEvents")
  teacherLessonEvidences            LessonDeliveryEvidence[]    @relation("TeacherLessonDeliveryEvidence")
  supervisorLessonEvidences         LessonDeliveryEvidence[]    @relation("SupervisorLessonDeliveryEvidence")
  studentRevenueRecognitions        RevenueRecognitionEntry[]   @relation("StudentRevenueRecognition")
```

### 4.4 On Academic Entities:
* `CenterGroup`: Added `studentFinancialAgreements`, `groupPricingAgreements`, and `lessonDeliveryEvidences`.
* `Course`: Added `groupPricingAgreements`.
* `Lesson`: Added `deliveryEvidences`.

---

## 5. Preservation of Existing Schema Integrity

An automated diff audit confirmed:
1. **The Legacy `Payment` Model:** Lines 344–368 remain completely unmodified (`id`, `userId`, `amount: Float`, `currency: "EGP"`, `status: PaymentStatus`). Zero breaking changes or data type alterations.
2. **Existing Models & Enums:** All 31 pre-existing models and 14 pre-existing enums retain their exact schema signatures, attributes, and constraints.
3. **Foreign Key Integrity:** All foreign keys across the 14 new financial models specify `onDelete: Restrict` (with optional child-level relations specifying `SetNull` where structurally required, such as `centerGroupId` or `courseId`). Cascading deletion (`CASCADE`) is strictly eliminated from all financial data pathways.
4. **Monetary Typing:** Every monetary column across all 14 models is typed as `Decimal @db.Decimal(12, 2)`, mapping to PostgreSQL `NUMERIC(12, 2)`. This provides exact piaster minor-unit precision up to $9,999,999,999.99\text{ EGP}$ without floating-point conversion error.

---

## 6. Static Syntax Validation Evidence

Static syntax validation was performed directly using the workspace Prisma CLI without database connectivity:

```powershell
cmd /c "set DATABASE_URL=postgresql://dummy:dummy@localhost:5432/dummy && set DIRECT_URL=postgresql://dummy:dummy@localhost:5432/dummy && cd /d D:\OX-DIGITAL\Mathe\OX-DIGITAL-GITHUB\packages\database && npx prisma validate"
```

**Output:**
```
Prisma schema loaded from prisma\schema.prisma
The schema at prisma\schema.prisma is valid 🚀
```

**Exit Code:** `0`  
**Formatting:** `npx prisma format` formatted the schema cleanly in 262ms without errors.

