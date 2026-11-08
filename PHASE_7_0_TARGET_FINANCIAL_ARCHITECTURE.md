# PHASE 7.0 — TARGET FINANCIAL ARCHITECTURE & BLUEPRINT
**Product:** OX-DIGITAL Education  
**Workspace:** `D:\OX-DIGITAL\Mathe\OX-DIGITAL-GITHUB`  
**Audit Date:** November 2026 (Updated Phase 7.0.2)  
**Status:** COMPLETE (TARGET ARCHITECTURE BLUEPRINT — INCORPORATING APPROVED GOVERNANCE & FINANCIAL SEPARATION)

---

## 1. Executive Macro-Architecture: Domain A vs. Domain B

In accordance with approved Product Owner decisions (**OD-701**, **OD-702**, and **OD-703**), the financial architecture enforces an unbreachable structural division between **SaaS Platform Commercial Billing (Domain A)** and **Institution Internal Financial Management (Domain B)**.

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                                   MACRO ARCHITECTURE                                    │
├─────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                         │
│  ┌───────────────────────────────────────────────────────────────────────────────────┐  │
│  │                    DOMAIN A: OX-DIGITAL SaaS COMMERCIAL BILLING                   │  │
│  │                                                                                   │  │
│  │  • Legal Entity:       OX-DIGITAL Platform Vendor                                 │  │
│  │  • Customer:           Educational Institutions, Centers, Tutoring Chains         │  │
│  │  • Commercial Model:   B2B SaaS Subscriptions, Student Seat Licenses, Add-ons     │  │
│  │  • Billing Engine:     Platform Invoicing, Gateway Subscriptions (Stripe B2B)     │  │
│  │  • Bank Accounts:      OX-DIGITAL Corporate Accounts (USD / EGP)                  │  │
│  │  • Ledger:             Platform General Ledger (Vendor P&L, Platform AR)          │  │
│  │  • Scope:              Records SaaS revenue; NEVER records student tuition        │  │
│  └───────────────────────────────────────────────────────────────────────────────────┘  │
│                                           │                                             │
│                                           ▼ B2B Commercial Invoicing (Arm's-Length)     │
│  ═════════════════════════════════════════════════════════════════════════════════════  │
│                     STRICT MULTI-TENANT ISOLATION BOUNDARY                              │
│         (NO SHARED LEDGERS, NO SHARED CASHBOXES, NO SHARED RECEIVABLES)                  │
│               NO AUTOMATIC SETTLEMENT / NO MERGING OF BALANCES                           │
│  ═════════════════════════════════════════════════════════════════════════════════════  │
│                                           ▲                                             │
│  ┌────────────────────────────────────────┴──────────────────────────────────────────┐  │
│  │               DOMAIN B: INSTITUTION INTERNAL FINANCIAL MANAGEMENT                 │  │
│  │                      (Instantiated per Educational Tenant)                        │  │
│  │                                                                                   │  │
│  │  • Tenant Root:        Educational Institution (Tenant N)                         │  │
│  │  • Executive Control:  Exactly ONE Primary Institution Owner/Manager              │  │
│  │  • Branch Topology:    Single-Branch (Zero-Overhead) OR Multi-Branch Scaling      │  │
│  │  • Customers:          Students, Parents, Corporate Sponsors                      │  │
│  │  • Revenue Streams:    Online Subscriptions, Center Tuition, Private Lessons      │  │
│  │  • Branch Attribution: Separately Attributable Revenue, Collections, Expenses, AR │  │
│  │  • Cost Centers:       Branch Facilities, Teachers, TAs, Printing, Utilities      │  │
│  │  • Cash Management:    Front-Desk Physical Cash Drawers, School Bank Accounts     │  │
│  │  • Ledger Structure:   ONE Institution-Wide General Ledger with Branch Dimensions │  │
│  │  • Inter-School:       Zero sharing of ledgers or balances with other institutions│  │
│  └───────────────────────────────────────────────────────────────────────────────────┘  │
│                                                                                         │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

### 1.1 Technical Architecture Clarification & Separation Boundaries (OD-702 Approved)

The approval of OD-702 formally establishes four mandatory boundaries:

#### 1. SaaS Tenant Billing and Receivables Boundary
- **Domain A (SaaS Provider):** Issues B2B SaaS subscription invoices to educational institutions (e.g. for monthly platform access, student seat tiers, or dedicated cloud storage). Receivables are tracked in Domain A Accounts Receivable (`1140 - Institution SaaS Receivables`).
- **Domain B (Institution):** Issues educational invoices to students and parents for tuition, lesson packages, book materials, and registration fees. Receivables are tracked in Domain B Accounts Receivable (`1141 - Student Accounts Receivable`).
- The two billing engines operate with separate document sequences, distinct counterparty directories, and independent payment terms.

#### 2. Institutional Financial Ledgers Boundary
- **Domain A General Ledger:** Records platform SaaS revenue (`4100 - SaaS Subscription Revenue`), platform infrastructure expenses (AWS/cloud servers, developer payroll), and vendor assets.
- **Domain B General Ledger:** Instantiated strictly per institution. Records student tuition revenue, teacher compensation liabilities, branch operating expenses, and front-desk cash balances.
- **Strict Accounting Rule:** Student tuition, lesson fees, or physical center cash collections are **NEVER recorded as OX-DIGITAL platform revenue**. Symmetrically, institution operating expenses and teacher compensation belong exclusively to Domain B.

#### 3. Database Tenant Isolation and Authorization Boundaries
- Multi-tenant isolation is enforced at the database level (`institutionId` scoping on every institutional table) and at the application layer via tenant-scoping middleware and row-level security (RLS).
- Platform vendor administrators operating Domain A have **zero authorization to manipulate or insert journal lines into an institution's Domain B ledger**.
- Institutional managers and branch staff operating Domain B have **zero visibility into Domain A corporate financial records or other institutions' ledgers**.

#### 4. Financial Reporting and Reconciliation Boundaries
- **Domain A Reporting:** Generates statutory financial statements for the OX-DIGITAL legal entity (SaaS P&L, SaaS Balance Sheet, Corporate Cash Flow).
- **Domain B Reporting:** Generates statutory financial statements for each educational institution (Consolidated School Balance Sheet, Consolidated P&L, Branch P&L, and Branch Cashbox Reconciliations).
- Financial reports never mix, aggregate, or cross-consolidate across the Domain A / Domain B boundary.

#### 5. Prohibition of Automatic Settlement or Ledger Merging
> [!IMPORTANT]
> **No Merging of Ledgers & No Automatic Settlement:**
> Inter-domain accounting integration or automated balance netting/settlement mechanisms are **NOT approved**. Any contractual transactions between OX-DIGITAL and an educational institution (e.g. SaaS platform fees) must be explicitly modeled as standard arm's-length vendor/customer transactions without merging their ledgers:
> - Domain A generates an AR invoice to the institution.
> - Domain B records an AP supplier invoice from OX-DIGITAL under Account `5320` (Platform SaaS License Expense) matched against Account `2111` (Accounts Payable - OX-DIGITAL).
> - Settlement occurs via real-world bank transfer or gateway disbursement, reconciled independently in both ledgers.

---

## 2. Target Domain Data Model Blueprint (Prisma Schema Specification)

The following schema extensions define the target entities for Phase 7, fully aligned with the approved institutional governance (OD-701, OD-703) and financial separation model (OD-702).

### 2.1 Multi-Tenant Organizational Foundation & Governance

```prisma
// ==========================================
// INSTITUTION & BRANCH FOUNDATION
// ==========================================

model Institution {
  id              String             @id @default(uuid())
  code            String             @unique // e.g. "INST-001"
  name            String
  primaryManagerId String            // PO Approved: Exactly ONE Primary Institution Owner/Manager
  taxNumber       String?
  commercialReg   String?
  currency        String             @default("EGP")
  status          InstitutionStatus  @default(ACTIVE)
  createdAt       DateTime           @default(now())
  updatedAt       DateTime           @updatedAt

  primaryManager  User               @relation("InstitutionPrimaryManager", fields: [primaryManagerId], references: [id], onDelete: Restrict)
  branches        Branch[]
  priceCatalogs   PriceCatalog[]
  accounts        Account[]
  journalEntries  JournalEntry[]
  invoices        Invoice[]
  cashboxes       Cashbox[]
  suppliers       Supplier[]
  teachers        TeacherContract[]
  accountingPeriods AccountingPeriod[]
}

enum InstitutionStatus {
  ACTIVE
  SUSPENDED
  EXPIRED
}

model Branch {
  id              String             @id @default(uuid())
  institutionId   String
  code            String             // e.g. "MAIN", "NASR-CITY", "ONLINE"
  name            String
  isDefault       Boolean            @default(false) // Auto-created for single-branch simplicity
  isOnline        Boolean            @default(false) // PO Approved: Dedicated Online/Head-Office Branch Dimension
  status          BranchStatus       @default(ACTIVE)
  address         String?
  phone           String?
  createdAt       DateTime           @default(now())
  updatedAt       DateTime           @updatedAt

  institution     Institution        @relation(fields: [institutionId], references: [id], onDelete: Restrict)
  classrooms      Classroom[]
  cashboxes       Cashbox[]
  centerGroups    CenterGroup[]
  journalLines    JournalLine[]
  invoices        Invoice[]

  @@unique([institutionId, code])
  @@index([institutionId])
}

enum BranchStatus {
  ACTIVE
  INACTIVE
}

model Classroom {
  id              String             @id @default(uuid())
  branchId        String
  name            String             // e.g. "Hall 1", "Lab A"
  capacity        Int                @default(30)
  branch          Branch             @relation(fields: [branchId], references: [id], onDelete: Restrict)

  @@index([branchId])
}
```

#### Governance Invariants:
1. **Single Primary Manager (OD-701):** Every `Institution` links to exactly one `primaryManagerId` in `User`. The primary manager has full institution-wide authority over pricing, branches, financial policies, and reports.
2. **Single-Branch Compatibility (OD-701):** When an institution is provisioned, a default branch (`isDefault = true`) is automatically established. Single-branch institutions operate immediately without navigating multi-branch management screens.
3. **Dedicated Online Branch Dimension (OD-703):** Online courses and digital subscriptions are assigned to an explicit online branch (`isOnline = true`), ensuring 100% financial attribution.
4. **Strict Inter-Tenant Ledger Isolation (OD-702):** Every financial table has a mandatory `institutionId` index, ensuring complete tenant isolation.

---

### 2.2 Central Pricing Catalog & Student Agreements

In accordance with approved centralized management requirements, the **Central Price Catalog is controlled exclusively by the primary institution manager**.

```prisma
// ==========================================
// PRICING CATALOG & BILLING AGREEMENTS
// ==========================================

model PriceCatalog {
  id              String             @id @default(uuid())
  institutionId   String
  name            String             // e.g. "2026/2027 Official Tuition Catalog"
  validFrom       DateTime
  validTo         DateTime?
  isDefault       Boolean            @default(false)
  createdAt       DateTime           @default(now())

  institution     Institution        @relation(fields: [institutionId], references: [id], onDelete: Restrict)
  items           PriceCatalogItem[]

  @@index([institutionId])
}

enum ServiceType {
  ONLINE_COURSE_SUBSCRIPTION
  CENTER_GROUP_TUITION
  PRIVATE_LESSON
  BOOKLET_MATERIAL
  REGISTRATION_FEE
  EXAM_PACK
}

model PriceCatalogItem {
  id              String             @id @default(uuid())
  catalogId       String
  serviceType     ServiceType
  targetId        String?            // CourseId, CenterGroupId, or null (generic)
  code            String             // SKU e.g. "ONL-MATH-G10-M"
  title           String
  basePrice       Decimal            @db.Decimal(12, 2)
  currency        String             @default("EGP")
  billingCycle    BillingCycle       @default(ONE_TIME)
  sessionsCount   Int?               // e.g. 4 or 8 sessions for center packs

  catalog         PriceCatalog       @relation(fields: [catalogId], references: [id], onDelete: Cascade)

  @@index([catalogId])
  @@index([serviceType, targetId])
}

enum BillingCycle {
  ONE_TIME
  MONTHLY
  QUARTERLY
  ACADEMIC_TERM
  ANNUAL
}

model BillingAgreement {
  id              String             @id @default(uuid())
  institutionId   String
  branchId        String             // Attributed Branch (or Online Branch)
  studentId       String
  parentId        String?
  serviceType     ServiceType
  targetId        String?
  agreedPrice     Decimal            @db.Decimal(12, 2) // LOCKED HISTORICAL PRICE
  discountAmount  Decimal            @default(0) @db.Decimal(12, 2)
  finalAmount     Decimal            @db.Decimal(12, 2)
  billingCycle    BillingCycle
  startDate       DateTime
  endDate         DateTime?
  status          AgreementStatus    @default(ACTIVE)
  createdAt       DateTime           @default(now())

  student         User               @relation("StudentAgreements", fields: [studentId], references: [id], onDelete: Restrict)
  invoices        Invoice[]

  @@index([institutionId, studentId])
  @@index([branchId])
}

enum AgreementStatus {
  DRAFT
  ACTIVE
  PAUSED
  TERMINATED
  EXPIRED
}
```

---

### 2.3 Accounts Receivable (AR), Invoicing & Payments

Every invoice and payment transaction is explicitly stamped with `branchId` to guarantee branch-level attribution of revenues, collections, and outstanding receivables.

```prisma
// ==========================================
// INVOICING & ACCOUNTS RECEIVABLE
// ==========================================

model Invoice {
  id              String             @id @default(uuid())
  institutionId   String
  branchId        String             // PO Approved: Separately Attributable Branch
  agreementId     String?
  studentId       String
  invoiceNumber   String             // Sequential e.g. "INV-2026-000412"
  issueDate       DateTime           @default(now())
  dueDate         DateTime
  subtotal        Decimal            @db.Decimal(12, 2)
  discountTotal   Decimal            @default(0) @db.Decimal(12, 2)
  taxTotal        Decimal            @default(0) @db.Decimal(12, 2)
  totalAmount     Decimal            @db.Decimal(12, 2)
  paidAmount      Decimal            @default(0) @db.Decimal(12, 2)
  balanceDue      Decimal            @db.Decimal(12, 2)
  status          InvoiceStatus      @default(ISSUED)
  createdAt       DateTime           @default(now())
  updatedAt       DateTime           @updatedAt

  institution     Institution        @relation(fields: [institutionId], references: [id], onDelete: Restrict)
  branch          Branch             @relation(fields: [branchId], references: [id], onDelete: Restrict)
  agreement       BillingAgreement?  @relation(fields: [agreementId], references: [id], onDelete: SetNull)
  student         User               @relation("StudentInvoices", fields: [studentId], references: [id], onDelete: Restrict)
  items           InvoiceItem[]
  payments        PaymentAllocation[]

  @@unique([institutionId, invoiceNumber])
  @@index([institutionId, studentId])
  @@index([branchId, status])
  @@index([dueDate])
}

enum InvoiceStatus {
  DRAFT
  ISSUED
  PARTIALLY_PAID
  PAID
  OVERDUE
  VOID
}

model InvoiceItem {
  id              String             @id @default(uuid())
  invoiceId       String
  description     String
  quantity        Int                @default(1)
  unitPrice       Decimal            @db.Decimal(12, 2)
  discountAmount  Decimal            @default(0) @db.Decimal(12, 2)
  lineTotal       Decimal            @db.Decimal(12, 2)
  revenueAccountId String            // Link to 4xxx account in COA

  invoice         Invoice            @relation(fields: [invoiceId], references: [id], onDelete: Cascade)

  @@index([invoiceId])
}

model PaymentAllocation {
  id              String             @id @default(uuid())
  invoiceId       String
  paymentId       String
  allocatedAmount Decimal            @db.Decimal(12, 2)
  createdAt       DateTime           @default(now())

  invoice         Invoice            @relation(fields: [invoiceId], references: [id], onDelete: Restrict)
  payment         FinancialPayment   @relation(fields: [paymentId], references: [id], onDelete: Restrict)

  @@index([invoiceId])
  @@index([paymentId])
}

model FinancialPayment {
  id              String             @id @default(uuid())
  institutionId   String
  branchId        String             // PO Approved: Separately Attributable Branch Collection
  payerUserId     String             // Student or Parent
  cashboxSessionId String?           // If collected at physical front desk
  paymentMethod   PaymentMethodType
  amount          Decimal            @db.Decimal(12, 2)
  currency        String             @default("EGP")
  referenceNumber String?            // Check number, Fawry ref, Paymob orderId
  gatewayProvider String?            // "STRIPE", "PAYMOB", "FAWRY", "CASH", "POS"
  status          FinancialPaymentStatus @default(COMPLETED)
  receivedAt      DateTime           @default(now())
  receivedByUserId String            // Cashier or System
  journalEntryId  String?            // Link to double-entry posting

  allocations     PaymentAllocation[]
  cashboxSession  CashboxSession?    @relation(fields: [cashboxSessionId], references: [id], onDelete: SetNull)

  @@index([institutionId, receivedAt])
  @@index([branchId])
}

enum PaymentMethodType {
  CASH
  POS_DEBIT_CARD
  CREDIT_CARD_ONLINE
  FAWRY_PAYMOB_WALLET
  BANK_TRANSFER
  VOUCHER
}

enum FinancialPaymentStatus {
  PENDING
  COMPLETED
  FAILED
  REFUNDED
  REVERSED
}
```

---

### 2.4 Cashbox & Front-Desk Register Management

Cashboxes are tied to specific physical branches. Cashiers are assigned to active sessions, maintaining clear local accountability under the primary manager's centralized policy.

```prisma
// ==========================================
// CASHBOX & CASH MANAGEMENT
// ==========================================

model Cashbox {
  id              String             @id @default(uuid())
  institutionId   String
  branchId        String             // Tied to physical branch
  name            String             // e.g. "Dokki Reception Drawer #1"
  accountNumber   String             // COA Account code e.g. "1111"
  status          CashboxStatus      @default(ACTIVE)

  institution     Institution        @relation(fields: [institutionId], references: [id], onDelete: Restrict)
  branch          Branch             @relation(fields: [branchId], references: [id], onDelete: Restrict)
  sessions        CashboxSession[]

  @@index([institutionId, branchId])
}

enum CashboxStatus {
  ACTIVE
  INACTIVE
}

model CashboxSession {
  id              String             @id @default(uuid())
  cashboxId       String
  cashierUserId   String
  openedAt        DateTime           @default(now())
  closedAt        DateTime?
  openingFloat    Decimal            @db.Decimal(12, 2)
  totalCollections Decimal           @default(0) @db.Decimal(12, 2)
  totalDisbursements Decimal         @default(0) @db.Decimal(12, 2)
  expectedCloseBalance Decimal       @default(0) @db.Decimal(12, 2)
  actualCountedBalance Decimal?      @db.Decimal(12, 2)
  discrepancyAmount   Decimal?       @db.Decimal(12, 2)
  status          ShiftStatus        @default(OPEN)
  notes           String?

  cashbox         Cashbox            @relation(fields: [cashboxId], references: [id], onDelete: Restrict)
  payments        FinancialPayment[]
  vouchers        CashVoucher[]

  @@index([cashboxId, status])
  @@index([cashierUserId])
}

enum ShiftStatus {
  OPEN
  CLOSED_PENDING_APPROVAL
  CLOSED_VERIFIED
}

model CashVoucher {
  id              String             @id @default(uuid())
  sessionId       String
  type            VoucherType        // RECEIPT or DISBURSEMENT
  voucherNumber   String             // Sequential e.g. "VCH-2026-0089"
  amount          Decimal            @db.Decimal(12, 2)
  description     String
  beneficiaryName String
  createdAt       DateTime           @default(now())

  session         CashboxSession     @relation(fields: [sessionId], references: [id], onDelete: Restrict)

  @@index([sessionId])
}

enum VoucherType {
  RECEIPT
  DISBURSEMENT
}
```

---

### 2.5 General Ledger & Double-Entry Accounting Core

**Core Structure (OD-702 & OD-703 Approved):**
- **One Institution General Ledger:** Exactly ONE unified general ledger per institution. Independent general ledgers or separate legal entities are NOT created for each branch by default.
- **Branch Dimensions:** Every `JournalLine` carries an attributable `branchId`.
- **Consolidated & Dimensional:** Supports instantaneous consolidated reporting for the primary manager, as well as branch-level P&L and cost-center reporting.
- **Strict Isolation from Domain A:** Institution ledgers never share accounts, journals, or balances with the OX-DIGITAL vendor ledger.

```prisma
// ==========================================
// GENERAL LEDGER & DOUBLE-ENTRY CORE
// ==========================================

model Account {
  id              String             @id @default(uuid())
  institutionId   String
  code            String             // e.g. "1110", "4110"
  name            String             // "Front-Desk Cash", "Online Course Revenue"
  type            AccountType
  parentId        String?
  isReconciled    Boolean            @default(false)
  currentBalance  Decimal            @default(0) @db.Decimal(14, 2)
  createdAt       DateTime           @default(now())

  institution     Institution        @relation(fields: [institutionId], references: [id], onDelete: Restrict)
  parent          Account?           @relation("AccountHierarchy", fields: [parentId], references: [id], onDelete: Restrict)
  children        Account[]          @relation("AccountHierarchy")
  journalLines    JournalLine[]

  @@unique([institutionId, code])
  @@index([institutionId, type])
}

enum AccountType {
  ASSET
  LIABILITY
  EQUITY
  REVENUE
  EXPENSE
}

model JournalEntry {
  id              String             @id @default(uuid())
  institutionId   String
  branchId        String?            // Primary branch context (if applicable)
  entryNumber     String             // Sequential e.g. "JRN-2026-00120"
  entryDate       DateTime
  periodId        String
  sourceType      JournalSourceType
  sourceReference String?            // Invoice ID, Payment ID, Payroll ID
  memo            String
  status          JournalStatus      @default(DRAFT)
  isReversed      Boolean            @default(false)
  reversalEntryId String?            // If this entry was reversed
  postedAt        DateTime?
  postedByUserId  String?
  createdAt       DateTime           @default(now())

  institution     Institution        @relation(fields: [institutionId], references: [id], onDelete: Restrict)
  period          AccountingPeriod   @relation(fields: [periodId], references: [id], onDelete: Restrict)
  lines           JournalLine[]

  @@unique([institutionId, entryNumber])
  @@index([institutionId, entryDate])
  @@index([periodId, status])
}

enum JournalSourceType {
  STUDENT_INVOICE
  CASH_COLLECTION
  GATEWAY_PAYMENT
  EXPENSE_BILL
  TEACHER_PAYROLL
  REVENUE_AMORTIZATION
  MANUAL_ADJUSTMENT
}

enum JournalStatus {
  DRAFT
  POSTED
  VOID
}

model JournalLine {
  id              String             @id @default(uuid())
  journalEntryId  String
  accountId       String
  branchId        String?            // PO Approved: Branch Cost Center / Dimension
  debit           Decimal            @default(0) @db.Decimal(12, 2)
  credit          Decimal            @default(0) @db.Decimal(12, 2)
  description     String?

  journalEntry    JournalEntry       @relation(fields: [journalEntryId], references: [id], onDelete: Cascade)
  account         Account            @relation(fields: [accountId], references: [id], onDelete: Restrict)
  branch          Branch?            @relation(fields: [branchId], references: [id], onDelete: SetNull)

  @@index([journalEntryId])
  @@index([accountId])
  @@index([branchId])
}

model AccountingPeriod {
  id              String             @id @default(uuid())
  institutionId   String
  periodCode      String             // e.g. "2026-10", "2026-11"
  startDate       DateTime
  endDate         DateTime
  isLocked        Boolean            @default(false)
  lockedAt        DateTime?
  lockedByUserId  String?

  institution     Institution        @relation(fields: [institutionId], references: [id], onDelete: Restrict)
  journalEntries  JournalEntry[]

  @@unique([institutionId, periodCode])
  @@index([institutionId, isLocked])
}
```

---

## 3. Modular Service Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                       MODULAR SERVICE BOUNDARIES                            │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  [auth-service]           [user-service]            [course-service]        │
│  • Identity & Tokens      • Profiles & Roles        • Courses & Lessons     │
│  • Primary Manager Claims • Branch Staff Rosters    • Groups & Attendance   │
│         │                        │                         │                │
│         └────────────────────────┼─────────────────────────┘                │
│                                  ▼ Event Bus / Internal API                 │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │                            FINANCE SERVICE                            │  │
│  │                      (Domain B: Institution Finance)                  │  │
│  │                                                                       │  │
│  │  1. Central Pricing & Billing Engine:                                 │  │
│  │     - Managed by Primary Manager. Base catalog & billing agreements.  │  │
│  │                                                                       │  │
│  │  2. Payment & Cash Engine:                                            │  │
│  │     - Online gateways & front-desk cashbox shifts per branch.         │  │
│  │                                                                       │  │
│  │  3. Accounts Receivable (AR) & Payable (AP):                          │  │
│  │     - Branch-attributed invoices, student balances, vendor bills.     │  │
│  │                                                                       │  │
│  │  4. Double-Entry General Ledger Core:                                 │  │
│  │     - ONE unified ledger with branch dimensions on journal lines.     │  │
│  │                                                                       │  │
│  │  5. Revenue Recognition Engine:                                       │  │
│  │     - Amortizes subscriptions across online and center dimensions.    │  │
│  │                                                                       │  │
│  │  6. Consolidated & Branch Reporting:                                  │  │
│  │     - Consolidated P&L, Balance Sheet, Trial Balance, Branch Margin.  │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                                  │                                          │
│                                  ▼ Query-Only                               │
│  [analytics-service]                                                        │
│  • High-level executive dashboards and academic KPI charts.                 │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 4. Academic-to-Financial Integration Life-Cycle

```
[Student Attends Physical Session at Branch] 
       │
       ▼
[user-service / attendance.controller]
       │ Attendance marked: PRESENT (studentId, sessionId, teacherId, branchId)
       │
       ▼ Emit Event: ATTENDANCE_VERIFIED
[finance-service / revenue engine]
       ├── Lookup active student BillingAgreement for Group & Branch
       ├── Deduct 1 session credit from prepaid pack
       └── Post Double-Entry Journal Entry (Stamped with branchId):
             Debit:  2132 - Unearned Center Tuition [branchId]
             Credit: 4210 - Earned Center Group Revenue [branchId]
             Debit:  5111 - Teacher Lesson Accrual Expense [branchId]
             Credit: 2121 - Teacher Compensation Payable (Liability)
```
