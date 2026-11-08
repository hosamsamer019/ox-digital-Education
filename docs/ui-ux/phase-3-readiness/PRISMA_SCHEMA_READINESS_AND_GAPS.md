# OX-DIGITAL Education — Phase 3 Readiness Assessment
# Prisma Schema Readiness & Migration Gap Analysis

**Workspace:** `D:\OX-DIGITAL\Mathe\OX-DIGITAL-GITHUB`  
**Target:** `docs/ui-ux/phase-3-readiness/PRISMA_SCHEMA_READINESS_AND_GAPS.md`  
**Execution Mode:** STRICTLY READ-ONLY TECHNICAL ASSESSMENT  
**Baseline References:** `packages/database/prisma/schema.prisma`, Authoritative Phase 2.0A.3 Baseline ([`ACCOUNTING_PHASE_2_0A_3_ENTITY_COUNT_AND_LIFECYCLE_AUDIT.md`](file:///d:/OX-DIGITAL/Mathe/OX-DIGITAL-GITHUB/ACCOUNTING_PHASE_2_0A_3_ENTITY_COUNT_AND_LIFECYCLE_AUDIT.md), [`ACCOUNTING_PHASE_2_0A_3_FINAL_RECONCILIATION_MATRIX.md`](file:///d:/OX-DIGITAL/Mathe/OX-DIGITAL-GITHUB/ACCOUNTING_PHASE_2_0A_3_FINAL_RECONCILIATION_MATRIX.md)), Shared Accounting Domain (`packages/shared/src/accounting/`)

---

## 1. Current Prisma Schema Audit

An exhaustive inspection of `packages/database/prisma/schema.prisma` was conducted. The current schema contains **31 models** and **14 enums**, organized into academic, institutional, and user management domains:

- **Institutional Foundations (Reusable):**
  - `Institution`: Tenancy root entity containing `id`, `name`, `status`, `fiscalYearStartMonth` (approved parameter per UP-707).
  - `Branch`: Physical and online branch entities (`id`, `institutionId`, `name`, `type`, `code`).
  - `User`: Base identity entity with authentication credentials and multi-tenant assignment.
  - `Role`: Institutional role assignment (`ADMIN`, `TEACHER`, `STUDENT`).
- **Academic Core (Reusable for sessions & enrollments):**
  - `Course`, `CourseGroup`, `CourseSession`, `Attendance`, `Enrollment`, `Assignment`.
- **Financial Domain:**
  - **ZERO FINANCIAL MODELS EXIST.**
  - There are currently no tables for cashboxes, movements, transfers, reconciliations, expense vouchers, student agreements, payment schedules, collections, allocations, or revenue recognition.

---

## 2. Canonical Phase 2.0A.3 Entity Taxonomy Restoration

The accepted Phase 2.0A.3 architecture baseline ([`ACCOUNTING_PHASE_2_0A_3_ENTITY_COUNT_AND_LIFECYCLE_AUDIT.md`](file:///d:/OX-DIGITAL/Mathe/OX-DIGITAL-GITHUB/ACCOUNTING_PHASE_2_0A_3_ENTITY_COUNT_AND_LIFECYCLE_AUDIT.md) Section 2.3) establishes the authoritative persistence taxonomy. It canonicalizes:
- **20 Core Persisted Physical Relational Tables:** 2 Enhanced Core Tables + 18 New Accounting Tables.
- **6 Embedded Value Objects:** Inline composite structures stored directly on parent table rows.
- **2 Self-Referential Relational Attributes:** Hierarchical self-referencing foreign keys.
- **2 Derived Real-Time Projections / Computed Values:** Dynamic balance aggregates calculated from immutable ledger lines.
- **3 Canonical Relational Table Aliases:** Domain concepts that physically share tables with primary entities.
- **Domain 7 Extensions:** 3 session extension tables for prepaid packages and earned revenue recognition.

Not every logical domain concept requires an independent Prisma model. Several concepts represent derived projections or embedded value objects.

### 2.1 The Canonical Phase 2.0A.3 Taxonomy Categories

1. **20 Core Persisted Relational Tables:**
   - *Enhanced Core (2):* `Institution`, `Branch`.
   - *Financial Core (18):* `Account`, `AccountingPeriod`, `StudentFinancialAccount`, `GroupPricingAgreement`, `StudentFinancialAgreement`, `StudentObligation`, `Collection`, `CollectionAllocation`, `FinancialAdjustment`, `JournalEntry`, `JournalLine`, `FinancialIdempotencyRecord`, `FinancialAuditEvent`, `Cashbox`, `CashboxTransaction`, `CashboxReconciliation`, `TeacherCompensationAgreement`, `TeacherPayable`.
2. **6 Embedded Value Objects:**
   - `AccountingDimension`: Inline `dimension_type` + `branch_id` on `JournalLine`.
   - `PriceCatalogItem`: Inline rate columns on `GroupPricingAgreement`.
   - `PriceVersion`: Immutable version integer on `GroupPricingAgreement`.
   - `AgreementPriceSnapshot`: Frozen agreed rate, discount percentage, and net fee on `StudentFinancialAgreement`.
   - `PaymentSchedule`: Settlement frequency and installment terms on `StudentFinancialAgreement`.
   - `CompensationPolicyVersion`: Version tracking column on `TeacherCompensationAgreement`.
3. **2 Self-Referential Relational Attributes:**
   - `JournalEntry.reversalOfEntryId`: Self-referencing link for compensating journal reversals.
   - `Account.parentId`: Hierarchical parent-child relationship in Chart of Accounts.
4. **2 Derived Real-Time Projections / Computed Values:**
   - `StudentFinancialAccount.currentBalance`: Computed sum of mature obligations less allocated collections.
   - `Cashbox.currentBalance`: Computed sum of opening float and net cash movements.
5. **3 Canonical Physical Table Aliases:**
   - Concept #7 `PriceCatalog` $\to$ Physically implemented by `GroupPricingAgreement` (Concept #11).
   - Concept #27 `CashboxTransfer` $\to$ Physically implemented by `CashboxTransaction` (Concept #26 with `tx_type = 'TRANSFER'`).
   - Concept #18 `RefundRequest` $\to$ Physically implemented by `FinancialAdjustment` (Concept #19 with `adjustment_type = 'REFUND'`).

---

### 2.2 Reconciling the 20 Core Baseline Tables against Implementation Reality

The table below reconciles all 20 baseline tables and 3 domain extensions, detailing whether an independent Prisma model is required, whether it is represented as a projection/embedded object, and the governing policy gates:

| # | Canonical Baseline Entity Name | Baseline Taxonomy Classification | Existing in Prisma? | Target Implementation Mapping | Implementation Footprint Status | Relational & Lifecycle Role | Policy & Specialist Gate Impact |
| :-: | :--- | :--- | :---: | :--- | :---: | :--- | :--- |
| **1** | `Institution` | Persisted Table (Enhanced Core) | **YES** | `Institution` | `ALREADY_REPRESENTED` | Root tenant boundary | Zero blocker; approved root (`OD-703`, `UP-707`). |
| **2** | `Branch` | Persisted Table (Enhanced Core) | **YES** | `Branch` | `ALREADY_REPRESENTED` | Operating branch dimension | Zero blocker; operational dimension (`OD-703`). |
| **3** | `Account` | Persisted Table (Chart of Accounts)| **NO** | Deferred to GL Bridge | `BLOCKED_BY_SPECIALIST_REVIEW` | Chart of Accounts master | `UP-701`: Schema design defined; specialist CPA review blocks **statutory EAS account code certification**. |
| **4** | `AccountingPeriod` | Persisted Table (Fiscal Governance)| **NO** | Deferred to GL Bridge | `BLOCKED_BY_SPECIALIST_REVIEW` | Fiscal calendar periods | `UP-701`: Gated for statutory period closing locks; daily cashbox shift reconciliations operate independently. |
| **5** | `StudentFinancialAccount` | Persisted Table (AR Header) | **NO** | Derived Projection / Header | `REPRESENTED_AS_PROJECTION` | Student AR balance profile | Zero blocker; in Phase 2 UI/UX, sub-ledger balance is computed via the **Derived Real-Time Projection** `StudentFinancialAccount.currentBalance` from `StudentAgreement`. Standalone table is optional. |
| **6** | `GroupPricingAgreement` | Persisted Table (Fee Catalog) | **NO** | Embedded in Agreement | `EMBEDDED_VALUE_OBJECT` | Group pricing fee catalog | Zero blocker; rate snapshots frozen onto agreements via embedded value objects `PriceCatalogItem` and `AgreementPriceSnapshot` (`OD-722.4`). |
| **7** | `StudentFinancialAgreement`| Persisted Table (Commercial Master)| **NO** | `StudentAgreement` (Prov. #6) | `GENUINELY_MISSING_PROPOSED` | Student enrollment contract | Zero blocker; master student contract with frozen price snapshot (`OD-722.4`). |
| **8** | `StudentObligation` | Persisted Table (Milestones) | **NO** | `PaymentScheduleItem` (Prov. #7)| `GENUINELY_MISSING_PROPOSED` | Billed fee installments | Zero blocker; billed installments; payment schedule milestone balance tracking. |
| **9** | `Collection` | Persisted Table (Intake Receipts) | **NO** | `CollectionReceipt` (Prov. #8) | `GENUINELY_MISSING_PROPOSED` | Cash & POS intake receipts | Zero blocker; append-only intake receipts from cash desk / POS. |
| **10**| `CollectionAllocation` | Persisted Table (Waterfall Bridge) | **NO** | `PaymentAllocation` (Prov. #9) | `GENUINELY_MISSING_PROPOSED` | Receipt-to-milestone line | Zero blocker; receipt-to-obligation waterfall line conserving sub-ledger balances. |
| **11**| `FinancialAdjustment` | Persisted Table (Reversals/Refunds)| **NO** | `StudentLedgerAdjustment` | `GENUINELY_MISSING_PROPOSED` | Compensating adjustments | `UP-706`: Legal review blocks unilateral refund execution; operational compensating reversals follow `UP-709` approvals (> 500 EGP). |
| **12**| `JournalEntry` | Persisted Table (GL Header) | **NO** | Deferred to GL Bridge | `BLOCKED_BY_SPECIALIST_REVIEW` | General Ledger entry header | `UP-701`: Schema design defined; specialist CPA review blocks **later statutory general ledger posting**. |
| **13**| `JournalLine` | Persisted Table (GL Line) | **NO** | Deferred to GL Bridge | `BLOCKED_BY_SPECIALIST_REVIEW` | Debit/credit line (Dimension) | `UP-701`: Blocked from statutory posting; embedded `AccountingDimension` references physical branches. |
| **14**| `FinancialIdempotencyRecord`| Persisted Table (Deduplication) | **NO** | Infrastructure Key Store | `INFRASTRUCTURE_TABLE` | Mutation idempotency store | Zero blocker; technical deduplication key store indexed on `idempotencyKey`. |
| **15**| `FinancialAuditEvent` | Persisted Table (Forensic Vault) | **NO** | Mapped to `AuditLog` | `INFRASTRUCTURE_TABLE` | Forensic event audit trail | Zero blocker; immutable audit trail and state-transition verification log. |
| **16**| `Cashbox` | Persisted Table (Till/Safe Master) | **NO** | `Cashbox` (Prov. #1) | `GENUINELY_MISSING_PROPOSED` | Physical till & vault master | Zero blocker; master register for physical cash registers and vaults. |
| **17**| `CashboxTransaction` | Persisted Table (Movements/Xfers) | **NO** | Split: `Movement` + `Transfer` | `GENUINELY_MISSING_PROPOSED` | Till transaction movement log | Zero blocker; append-only record of cash inflows, outflows, and transfers. |
| **18**| `CashboxReconciliation` | Persisted Table (Shift Close) | **NO** | `DailyCashboxReconciliation` (#4)| `GENUINELY_MISSING_PROPOSED` | Daily shift variance record | `UP-705`: Records shift count and variance; blocks **automated shortage write-offs, surplus recognition, and employee liability**. |
| **19**| `TeacherCompensationAgreement`| Persisted Table (Teacher Terms)| **NO** | Deferred to Teacher Module | `BLOCKED_BY_UNRESOLVED_DECISION` | Teacher contract terms | `UP-704`: Base contract schema defined; **variable calculation base remains unresolved**. Fixed models not blocked if approved. |
| **20**| `TeacherPayable` | Persisted Table (Teacher Debt) | **NO** | Deferred to Teacher Module | `BLOCKED_BY_UNRESOLVED_DECISION` | Teacher monthly liability | `UP-704`: Automated variable payable generation blocked pending decision on qualifying base. |
| *Ext*| `LessonDeliveryEvidence` | Domain 7 Extension Table | **NO** | `LessonDeliveryEvidence` (Prov. #11)| `GENUINELY_MISSING_PROPOSED` | Academic delivery proof | `UP-715`: Permanent audit storage; PII scrubbing gated by DPO compliance review. |
| *Ext*| `SessionPackage` | Domain 7 Extension Table | **NO** | Embedded in Agreement | `EMBEDDED_VALUE_OBJECT` | Prepaid educational bundle | `UP-714`: Approved hybrid package allocation; online operations deferred to physical-first scope. |
| *Ext*| `RevenueRecognitionEvent`| Domain 7 Extension Table | **NO** | `RevenueRecognitionEntry` (Prov. #10)| `GENUINELY_MISSING_PROPOSED` | Dual-prerequisite revenue | Zero blocker; dual-prerequisite revenue recognition under equal session valuation (`OD-722.4`). |
| *UI* | `ExpenseVoucher` | Implementation Split (from #17) | **NO** | `ExpenseVoucher` (Prov. #5) | `GENUINELY_MISSING_PROPOSED` | Petty cash disbursement | Split representation of `CashboxTransaction` (`tx_type = 'EXPENSE'`) for Maker-Checker drafting and approval. |

---

### 2.3 Status of the Provisional 11-Model Proposal

The proposal to introduce 11 financial models in Phase 3 is **PROVISIONAL**. It does NOT represent the complete accounting schema:

1. **Direct Baseline Implementations (6 Models):**
   - `Cashbox` $\to$ implements Baseline #16 `Cashbox`.
   - `DailyCashboxReconciliation` $\to$ implements Baseline #18 `CashboxReconciliation`.
   - `StudentAgreement` $\to$ implements Baseline #7 `StudentFinancialAgreement`.
   - `PaymentScheduleItem` $\to$ implements Baseline #8 `StudentObligation`.
   - `CollectionReceipt` $\to$ implements Baseline #9 `Collection`.
   - `PaymentAllocation` $\to$ implements Baseline #10 `CollectionAllocation`.
2. **Split Representations / Adapters of Baseline #17 `CashboxTransaction` (3 Models):**
   - `CashboxMovement`: Represents append-only cash flow movements within a physical till.
   - `CashboxTransferRequest`: Represents the 5-stage Maker-Checker transfer state machine (`DRAFT` $\to$ `PENDING_APPROVAL` $\to$ `APPROVED` $\to$ `IN_TRANSIT` $\to$ `COMPLETED`).
   - `ExpenseVoucher`: Represents petty cash disbursement drafting and Primary Manager approval metadata.
   *(Architectural Evaluation: Splitting `CashboxTransaction` into these three entities prevents locking live till transactions during multi-stage transfer approvals or expense voucher review, but constitutes an architectural expansion of baseline table #17 that must be finalized in Workstream A).*
3. **Domain 7 Session Extensions (2 Models):**
   - `LessonDeliveryEvidence`: Implements Extension Table #21 (certified lesson delivery evidence signed by teacher).
   - `RevenueRecognitionEntry`: Implements Extension Table #23 `RevenueRecognitionEvent` (earned revenue recognized via dual prerequisites under OD-722.4).
4. **Baseline Entities Still Missing from the Provisional 11-Model Proposal (11 Entities):**
   - Baseline #3 `Account` (Chart of Accounts Master)
   - Baseline #4 `AccountingPeriod` (Fiscal Calendar Periods)
   - Baseline #5 `StudentFinancialAccount` (AR Sub-Ledger Account Profile)
   - Baseline #6 `GroupPricingAgreement` (Group Fee Catalog Master)
   - Baseline #11 `FinancialAdjustment` (Compensating Reversals & Refunds)
   - Baseline #12 `JournalEntry` (General Ledger Entry Header)
   - Baseline #13 `JournalLine` (General Ledger Entry Line)
   - Baseline #14 `FinancialIdempotencyRecord` (Mutation Idempotency Key Store)
   - Baseline #15 `FinancialAuditEvent` (Forensic Financial Event Audit Log)
   - Baseline #19 `TeacherCompensationAgreement` (Teacher Contract Terms)
   - Baseline #20 `TeacherPayable` (Teacher Monthly Dues Liability)
   - Extension #22 `SessionPackage` (Prepaid Session Bundles)

---

## 3. Specifications for Provisional Operational Models

Below are the detailed definitions of the provisional models supporting Phase 2 operational screens:

### 3.1 Financial Enums
```prisma
enum CashboxStatus {
  ACTIVE
  SUSPENDED
  CLOSED
}

enum CashboxMovementType {
  COLLECTION_INTAKE
  EXPENSE_DISBURSEMENT
  TRANSFER_OUT
  TRANSFER_IN
  ADJUSTMENT
  DISCREPANCY_ADJUSTMENT
}

enum TransferStatus {
  DRAFT
  PENDING_APPROVAL
  APPROVED
  IN_TRANSIT
  COMPLETED
  REJECTED
  CANCELLED
}

enum ReconciliationStatus {
  BALANCED
  DISCREPANCY_PENDING_INVESTIGATION
  DISCREPANCY_RESOLVED
}

enum AgreementStatus {
  DRAFT
  ACTIVE
  COMPLETED
  TERMINATED
  DEFAULTED
}

enum PaymentAllocationMethod {
  WATERFALL_FIFO
  MANUAL_DESIGNATION
}
```

---

### 3.2 Model Specifications (Provisional Operational Footprint)

```prisma
model Cashbox {
  id                  String         @id @default(uuid())
  institutionId       String
  branchId            String
  code                String         // CB-01, CB-02, CB-MAIN, CB-03
  name                String         // Main Safe, Downtown Cashier Till 1
  isOnline            Boolean        @default(false)
  status              CashboxStatus  @default(ACTIVE)
  currency            String         @default("EGP") // OD-702 Launch Currency
  currentBookBalance  Decimal        @db.Decimal(12, 2) @default(0.00)
  createdAt           DateTime       @default(now())
  updatedAt           DateTime       @updatedAt

  institution         Institution    @relation(fields: [institutionId], references: [id])
  branch              Branch         @relation(fields: [branchId], references: [id])
  movements           CashboxMovement[]
  reconciliations     DailyCashboxReconciliation[]
  expenseVouchers     ExpenseVoucher[]
  outgoingTransfers   CashboxTransferRequest[] @relation("SourceCashbox")
  incomingTransfers   CashboxTransferRequest[] @relation("DestinationCashbox")

  @@unique([institutionId, code])
  @@index([institutionId, branchId])
}

model CashboxMovement {
  id                  String              @id @default(uuid())
  institutionId       String
  cashboxId           String
  movementType        CashboxMovementType
  amount              Decimal             @db.Decimal(12, 2)
  balanceBefore       Decimal             @db.Decimal(12, 2)
  balanceAfter        Decimal             @db.Decimal(12, 2)
  referenceType       String              // RECEIPT, EXPENSE, TRANSFER, RECONCILIATION
  referenceId         String              // UUID of underlying entity
  notes               String?
  performedById       String              // Maker / Cashier User ID
  createdAt           DateTime            @default(now())

  cashbox             Cashbox             @relation(fields: [cashboxId], references: [id])
  performedBy         User                @relation(fields: [performedById], references: [id])

  @@index([institutionId, cashboxId, createdAt])
}

model CashboxTransferRequest {
  id                    String          @id @default(uuid())
  institutionId         String
  transferNumber        String          // TRF-104
  sourceCashboxId       String
  destinationCashboxId  String
  amount                Decimal         @db.Decimal(12, 2)
  status                TransferStatus  @default(DRAFT)
  businessReason        String
  rejectionReason       String?
  
  initiatedById         String
  initiatedAt           DateTime        @default(now())
  approvedById          String?
  approvedAt            DateTime?
  dispatchedById        String?
  dispatchedAt          DateTime?
  receivedById          String?
  receivedAt            DateTime?

  sourceCashbox         Cashbox         @relation("SourceCashbox", fields: [sourceCashboxId], references: [id])
  destinationCashbox    Cashbox         @relation("DestinationCashbox", fields: [destinationCashboxId], references: [id])
  initiatedBy           User            @relation("TransferInitiator", fields: [initiatedById], references: [id])
  approvedBy            User?           @relation("TransferApprover", fields: [approvedById], references: [id])

  @@unique([institutionId, transferNumber])
  @@index([institutionId, status])
}

model DailyCashboxReconciliation {
  id                    String                @id @default(uuid())
  institutionId         String
  cashboxId             String
  reconciliationDate    DateTime              @db.Date
  openingBalance        Decimal               @db.Decimal(12, 2)
  totalInflows          Decimal               @db.Decimal(12, 2)
  totalOutflows         Decimal               @db.Decimal(12, 2)
  expectedClosingBalance Decimal              @db.Decimal(12, 2)
  declaredPhysicalCount Decimal               @db.Decimal(12, 2)
  discrepancyAmount     Decimal               @db.Decimal(12, 2) @default(0.00)
  status                ReconciliationStatus  @default(BALANCED)
  denominationBreakdown Json?
  investigationNotes    String?
  reconciledById        String
  reconciledAt          DateTime              @default(now())

  cashbox               Cashbox               @relation(fields: [cashboxId], references: [id])
  reconciledBy          User                  @relation(fields: [reconciledById], references: [id])

  @@unique([cashboxId, reconciliationDate])
  @@index([institutionId, status])
}

model ExpenseVoucher {
  id                  String         @id @default(uuid())
  institutionId       String
  cashboxId           String
  voucherNumber       String         // EXP-2026-001
  category            String         // SUPPLIES, UTILITIES, MAINTENANCE
  amount              Decimal        @db.Decimal(12, 2)
  description         String
  status              String         // DRAFT, PENDING_APPROVAL, APPROVED, PAID, REJECTED
  preparedById        String         // Accountant (Maker)
  approvedById        String?        // Primary Manager (Checker)
  paidAt              DateTime?
  createdAt           DateTime       @default(now())

  cashbox             Cashbox        @relation(fields: [cashboxId], references: [id])
  preparedBy          User           @relation("ExpensePreparer", fields: [preparedById], references: [id])

  @@unique([institutionId, voucherNumber])
  @@index([institutionId, cashboxId])
}

model StudentAgreement {
  id                    String          @id @default(uuid())
  institutionId         String
  studentId             String
  agreementNumber       String          // AGR-2026-0891
  status                AgreementStatus @default(ACTIVE)
  currency              String          @default("EGP")
  totalContractAmount   Decimal         @db.Decimal(12, 2)
  totalCollected        Decimal         @db.Decimal(12, 2) @default(0.00)
  totalRecognizedRevenue Decimal        @db.Decimal(12, 2) @default(0.00)
  unallocatedPrepayment Decimal         @db.Decimal(12, 2) @default(0.00)
  outstandingReceivable Decimal         @db.Decimal(12, 2)
  effectiveDate         DateTime
  createdAt             DateTime        @default(now())
  updatedAt             DateTime        @updatedAt

  institution           Institution     @relation(fields: [institutionId], references: [id])
  student               User            @relation(fields: [studentId], references: [id])
  schedules             PaymentScheduleItem[]
  receipts              CollectionReceipt[]
  revenueEntries        RevenueRecognitionEntry[]

  @@unique([institutionId, agreementNumber])
  @@index([institutionId, studentId])
}

model PaymentScheduleItem {
  id                    String         @id @default(uuid())
  agreementId           String
  milestoneNumber       Int            // 1, 2, 3...
  dueDate               DateTime       @db.Date
  dueAmount             Decimal        @db.Decimal(12, 2)
  allocatedAmount       Decimal        @db.Decimal(12, 2) @default(0.00)
  remainingBalance      Decimal        @db.Decimal(12, 2)
  isSatisfied           Boolean        @default(false)
  createdAt             DateTime       @default(now())

  agreement             StudentAgreement @relation(fields: [agreementId], references: [id])
  allocations           PaymentAllocation[]

  @@unique([agreementId, milestoneNumber])
  @@index([agreementId, dueDate])
}

model CollectionReceipt {
  id                    String         @id @default(uuid())
  institutionId         String
  agreementId           String
  receiptNumber         String         // REC-7841
  amount                Decimal        @db.Decimal(12, 2)
  paymentMethod         String         // CASH, BANK_TRANSFER, POS
  cashboxId             String?
  collectedById         String         // Cashier / User ID
  collectedAt           DateTime       @default(now())

  agreement             StudentAgreement @relation(fields: [agreementId], references: [id])
  collectedBy           User             @relation(fields: [collectedById], references: [id])
  allocations           PaymentAllocation[]

  @@unique([institutionId, receiptNumber])
  @@index([agreementId])
}

model PaymentAllocation {
  id                    String              @id @default(uuid())
  receiptId             String
  scheduleItemId        String
  allocatedAmount       Decimal             @db.Decimal(12, 2)
  allocationMethod      PaymentAllocationMethod @default(WATERFALL_FIFO)
  createdAt             DateTime            @default(now())

  receipt               CollectionReceipt   @relation(fields: [receiptId], references: [id])
  scheduleItem          PaymentScheduleItem @relation(fields: [scheduleItemId], references: [id])

  @@index([receiptId, scheduleItemId])
}

model RevenueRecognitionEntry {
  id                    String         @id @default(uuid())
  agreementId           String
  evidenceId            String         @unique
  recognizedAmount      Decimal        @db.Decimal(12, 2)
  recognizedAt          DateTime       @default(now())
  calculationMethod     String         // EQUAL_SESSION_VALUATION (OD-722.4)
  notes                 String?

  agreement             StudentAgreement @relation(fields: [agreementId], references: [id])
  evidence              LessonDeliveryEvidence @relation(fields: [evidenceId], references: [id])

  @@index([agreementId, recognizedAt])
}

model LessonDeliveryEvidence {
  id                    String         @id @default(uuid())
  courseSessionId       String         @unique
  teacherId             String
  attendanceCount       Int
  syllabusMilestone     String
  teacherSignature      String
  submittedAt           DateTime       @default(now())

  courseSession         CourseSession  @relation(fields: [courseSessionId], references: [id])
  teacher               User           @relation(fields: [teacherId], references: [id])
  revenueEntry          RevenueRecognitionEntry?

  @@index([teacherId, submittedAt])
}
```

---

## 4. Safe Non-Breaking Migration Strategy

When schema additions are formally authorized by the Product Owner:
1. **Purely Additive Schema Extension:**
   - All added models are strictly additive.
   - None of the existing 31 models are deleted or modified destructively.
   - Relations added to existing core models (`Institution`, `Branch`, `User`, `CourseSession`) are either 1-to-many collections or optional relations (`?`), ensuring existing records remain valid without backfill requirements.
2. **Zero-Downtime Migration Protocol:**
   - Step 1: Run `npx prisma validate` to guarantee syntactic and relational integrity.
   - Step 2: Generate the SQL migration using `npx prisma migrate dev --create-only --name add_phase2_financial_entities`.
   - Step 3: Review the generated SQL script to ensure zero `DROP TABLE` or `DROP COLUMN` commands.
   - Step 4: Apply the migration inside a single database transaction.
   - Step 5: Regenerate the Prisma Client (`npx prisma generate`).
