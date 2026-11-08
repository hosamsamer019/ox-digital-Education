# PHASE 7.0 — FULL ACCOUNTING CAPABILITY ASSESSMENT
**Product:** OX-DIGITAL Education  
**Workspace:** `D:\OX-DIGITAL\Mathe\OX-DIGITAL-GITHUB`  
**Audit Date:** November 2026  
**Status:** COMPLETE (READ-ONLY ARCHITECTURAL ASSESSMENT)

---

## 1. Executive Summary

This document provides a comprehensive accounting capability assessment for OX-DIGITAL Education. In accordance with Product Owner Decision #4 (*"Accounting level: Full accounting system, not merely a collection of payment and expense screens"*), this assessment details the architectural requirements, ledger mechanics, journal workflows, and financial sub-ledgers necessary to operate a statutory, audit-compliant educational accounting engine.

### Current System Status
The existing codebase possesses **0% of a double-entry accounting system**. It contains only a flat `Payment` table with gateway transaction metadata. Cash collections are directly equated with platform revenue in `analytics-service` without unearned revenue deferrals, tax considerations, accounts receivable, or expense matching.

---

## 2. Module-by-Module Technical Assessment

### Module A: Chart of Accounts (COA)
A structured 5-tier Chart of Accounts must be established for each educational institution.

```
1000 - ASSETS
  ├── 1100 - Current Assets
  │     ├── 1110 - Cash on Hand & Front-Desk Cashboxes (1111: Nasr City Drawer, 1112: Dokki Drawer)
  │     ├── 1120 - Bank Accounts (1121: CIB Operating, 1122: QNB Payroll)
  │     ├── 1130 - Payment Gateway Clearing Accounts (1131: Paymob Transit, 1132: Fawry Transit)
  │     └── 1140 - Accounts Receivable (1141: Student Receivables, 1142: Parent Sponsor Receivables)
  └── 1200 - Non-Current Assets (1210: Educational Equipment, 1220: Leasehold Improvements)

2000 - LIABILITIES
  ├── 2100 - Current Liabilities
  │     ├── 2110 - Accounts Payable (2111: Suppliers & Vendors, 2112: Printing Vendors)
  │     ├── 2120 - Accrued Teacher Compensation (2121: Teacher Payables)
  │     ├── 2130 - Unearned / Deferred Revenue (2131: Deferred Online Subscriptions, 2132: Prepaid Center Packs)
  │     └── 2140 - Security Deposits & Caution Fees
  └── 2200 - Non-Current Liabilities

3000 - EQUITY
  ├── 3100 - Institution Capital
  ├── 3200 - Retained Earnings
  └── 3300 - Current Year Net Income / (Loss)

4000 - REVENUE
  ├── 4100 - Online Education Revenue
  │     ├── 4110 - Online Monthly Course Subscriptions
  │     └── 4120 - Online Exam & Assessment Fees
  └── 4200 - Physical Center Revenue
        ├── 4210 - Center Group Tuition
        ├── 4220 - Private Lesson Fees
        └── 4230 - Educational Materials & Booklet Sales

5000 - EXPENSES
  ├── 5100 - Direct Educational Costs (Cost of Goods Sold / Services)
  │     ├── 5110 - Teacher Salaries & Lesson Fees
  │     ├── 5120 - Classroom Teaching Assistants
  │     └── 5130 - Printing & Educational Booklets
  ├── 5200 - Branch Operating Expenses
  │     ├── 5210 - Branch Facility Rent
  │     ├── 5220 - Electricity, Water & Utilities
  │     ├── 5230 - Center Internet & Telephony
  │     └── 5240 - Cleaning & Maintenance
  └── 5300 - Administrative & Financial Expenses
        ├── 5310 - Payment Gateway Processing Fees (Paymob/Fawry 2.5% + fixed)
        └── 5320 - Platform SaaS License Fees (Paid to OX-DIGITAL Vendor)
```

#### Technical Design Specifications:
- `Account` entity with `code` (e.g., `"1111"`), `name`, `type` (`ASSET`, `LIABILITY`, `EQUITY`, `REVENUE`, `EXPENSE`), `parentId`, `institutionId`, and `branchId` (for location-specific tracking).
- Tree hierarchy supporting unlimited sub-account depth.
- `isReconciliation`: flag for bank and cashbox accounts requiring physical reconciliation.

---

### Module B: General Ledger & Double-Entry Engine

The General Ledger is the immutable core of the accounting system.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                       DOUBLE-ENTRY JOURNAL LIFECYCLE                        │
│                                                                             │
│ [Source Transaction] (Student Invoiced, Cash Collected, Expense Incurred)   │
│         │                                                                   │
│         ▼                                                                   │
│ [JournalEntry (Draft)]                                                      │
│         │                                                                   │
│         ├── Validation: Sum(Debits) === Sum(Credits)                        │
│         ├── Validation: Transaction Date within OPEN accounting period       │
│         └── Validation: Accounts belong to same institutionId               │
│         │                                                                   │
│         ▼ Post Action (Authorized Accountant / System Auto-Post)            │
│ [JournalEntry (POSTED)]  <── IMMUTABLE (No UPDATE, No DELETE)               │
│         │                                                                   │
│         ├── Updates Account running balances                                │
│         └── Writes immutable audit log with hash signature                  │
│                                                                             │
│ [Correction Needed?]                                                        │
│         │                                                                   │
│         ▼ (NEVER DELETE OR MUTATE)                                          │
│ [Reversal JournalEntry]                                                     │
│         └── Creates exact counter-balancing entry referencing original ID   │
└─────────────────────────────────────────────────────────────────────────────┘
```

#### Core Data Entities:
1. `JournalEntry`: `id`, `institutionId`, `branchId`, `entryNumber` (sequential), `entryDate`, `status` (`DRAFT`, `POSTED`, `REVERSED`), `sourceType` (`INVOICE`, `PAYMENT`, `PAYROLL`, `EXPENSE`, `MANUAL`), `sourceId`, `postedAt`, `postedByUserId`.
2. `JournalLine`: `id`, `journalEntryId`, `accountId`, `branchId`, `debit` (Decimal), `credit` (Decimal), `description`, `costCenterId`.
3. **Integrity Rule:** `SUM(debit) == SUM(credit)` enforced inside a serializable PostgreSQL database transaction (`$transaction`).

---

### Module C: Accounts Receivable (AR) & Student Invoicing

Accounts Receivable manages the financial claims against students and parents.

```
       ┌────────────────────────────────────────────────────────┐
       │                 STUDENT BILLING CYCLE                  │
       └────────────────────────────────────────────────────────┘
                                 │
     1. Course Enrollment / Center Registration
                                 │
                                 ▼
                    [Student Invoice Generated]
             Debit:  1141 - Student Accounts Receivable (300 EGP)
             Credit: 2131 - Unearned / Deferred Revenue (300 EGP)
                                 │
        ┌────────────────────────┴────────────────────────┐
        ▼                                                 ▼
[Option A: Full Immediate Payment]               [Option B: Two Installments]
• Cashier collects 300 EGP                       • 150 EGP upfront, 150 EGP in 30 days
  Debit:  1111 - Cashbox (300 EGP)                 Payment 1: Debit Cashbox (150 EGP)
  Credit: 1141 - Student AR (300 EGP)                         Credit Student AR (150 EGP)
  Balance: 0 EGP                                   Payment 2: Debit Cashbox (150 EGP)
                                                              Credit Student AR (150 EGP)
                                                   Balance: 0 EGP
```

#### Sub-Ledger Features:
- **Invoice Structure:** Header (`Invoice`) with line items (`InvoiceItem`), issue date, due date, billing contact (Student/Parent), and status (`DRAFT`, `ISSUED`, `PAID`, `PARTIALLY_PAID`, `OVERDUE`, `VOID`).
- **Credit Notes:** Formal accounting documents issued for student withdrawals, fee waivers, or billing adjustments.
- **Aging Analysis:** Automated grouping of outstanding receivables into standard aging buckets: `Current`, `1–30 Days`, `31–60 Days`, `61–90 Days`, and `90+ Days Overdue`.

---

### Module D: Accounts Payable (AP) & Operating Expenses

Accounts Payable tracks financial obligations owed to third-party suppliers, landlords, and service providers.

#### Sub-Ledger Features:
1. `Supplier`: Vendor directory (e.g., Al-Ahram Printing Press, Center Landlord, Telecom Egypt).
2. `SupplierInvoice`: Captures vendor bill, invoice number, due date, expense categorization (Rent, Materials, Cleaning), and tax/withholding.
3. `SupplierPayment`: Records disbursement from cashbox or bank account.
4. **Accounting Entries for Expense Incurred:**
   - *On receiving bill:* Debit 5210 (Center Facility Rent) / Credit 2111 (Accounts Payable - Landlord).
   - *On bank transfer payment:* Debit 2111 (Accounts Payable) / Credit 1121 (Bank Account).

---

### Module E: Cash and Bank Management

Physical centers rely heavily on cash transactions at front-desk reception counters.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    DAILY CASHBOX RECONCILIATION CYCLE                       │
│                                                                             │
│ [Shift Start]                                                               │
│   • Cashier opens shift: verifies physical Opening Float (e.g., 500 EGP).   │
│   • CashboxSession created with status: OPEN.                               │
│                                                                             │
│ [During Shift]                                                              │
│   • Cashier collects student cash: generates CashReceipt voucher.           │
│   • Cashier pays petty expense (e.g. chalk/coffee): CashDisbursement.      │
│   • System calculates Expected Closing = Opening + Collections - Payouts.   │
│                                                                             │
│ [Shift End - Daily Closing]                                                 │
│   • Blind Cash Count: Cashier inputs counted currency notes without seeing  │
│     the system expected total.                                              │
│   • Shift Supervisor reviews:                                               │
│       - Variance = Actual Counted - Expected System Balance.                │
│       - If Variance == 0: Clean Close.                                      │
│       - If Variance != 0: Post to 5330 (Cash Shortage) or 4330 (Overage).   │
│   • CashboxSession closed and locked.                                       │
│   • Cash Transfer Voucher generated for deposit to Central Bank Account.    │
└─────────────────────────────────────────────────────────────────────────────┘
```

#### Data Entities:
- `Cashbox`: Registered physical drawer (e.g., "Dokki Front Counter #1").
- `CashboxSession`: Shift session linked to `userId` (cashier), `openedAt`, `closedAt`, `openingBalance`, `closingBalanceSystem`, `closingBalanceActual`, `discrepancyAmount`.
- `CashReceiptVoucher` & `CashDisbursementVoucher`: Numbered receipts signed by payer/receiver.

---

### Module F: Revenue Recognition & Operations

In education, **cash collection does NOT equal recognized revenue**.

#### Online Subscriptions:
- When a student pays 600 EGP for a 3-month course subscription:
  - **Day 1 (Collection):**
    - Debit: 1131 - Payment Gateway Clearing (600 EGP)
    - Credit: 2131 - Unearned Subscription Revenue (600 EGP)
  - **Month 1 End (Recognition):**
    - Debit: 2131 - Unearned Subscription Revenue (200 EGP)
    - Credit: 4110 - Online Course Revenue (200 EGP)
  - **Month 2 End & Month 3 End:** Repeat 200 EGP recognition.

#### Physical Center Group Sessions:
- When a student purchases a monthly 4-session pass:
  - Stored as Unearned Center Tuition (Liability).
  - Upon attendance check-in (`Attendance.status == 'PRESENT'`), the system generates an automated journal entry recognizing 25% of the tuition as Earned Center Revenue.

---

### Module G: Teacher Compensation Models

Teacher compensation is the largest expense category in private and center education. Five models must be accommodated by the target architecture:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        TEACHER COMPENSATION MODELS                          │
├─────────────────────────────────────────────────────────────────────────────┤
│ 1. Fixed Monthly Salary:                                                    │
│    • Incurred at month-end regardless of student count or lessons.          │
│    • Journal: Debit 5110 (Teacher Salaries) / Credit 2121 (Teacher Payable) │
│                                                                             │
│ 2. Per-Lesson Fixed Fee (e.g., 300 EGP per 2-hour session):                 │
│    • Triggered by completed group session verified by attendance roster.    │
│    • Journal: Debit 5111 (Lesson Fees) / Credit 2121 (Teacher Payable)      │
│                                                                             │
│ 3. Per-Student Attendance Fee (e.g., 25 EGP per attending student):         │
│    • Calculated dynamically: Attending Students Count * Unit Rate.          │
│    • Directly linked to Session Attendance verification.                    │
│                                                                             │
│ 4. Percentage Revenue Share (e.g., 60% Teacher / 40% Center):               │
│    • Derived from Recognized Net Revenue of the specific course or group.   │
│    • Journal: Debit 5113 (Teacher RevShare) / Credit 2121 (Teacher Payable) │
│                                                                             │
│ 5. Hybrid Model (Base Salary + Attendance Bonus / RevShare):                │
│    • Fixed monthly retainer + marginal per-head bonus above a quota.        │
└─────────────────────────────────────────────────────────────────────────────┘
```

> [!NOTE]
> **Accounting Consequence:** Models 3 and 4 require strict event-driven triggers connecting academic attendance and course enrollment revenue to the payroll accrual ledger.

---

### Module H: Statutory Financial Reporting

Financial reports are categorized into **Posted General Ledger Reports** (formal accounting) versus **Operational Dashboards** (real-time business intelligence).

| Report Name | Classification | Source Data | Purpose |
| :--- | :--- | :--- | :--- |
| **Balance Sheet** | Statutory GL Report | Posted `JournalLine` balances in Assets, Liabilities, and Equity. | Financial solvency and net worth of the institution. |
| **Income Statement (P&L)** | Statutory GL Report | Posted `JournalLine` balances in Revenue and Expenses. | Net profit/loss across accounting periods. |
| **Trial Balance** | Accounting Verification | Sum of Debits and Credits per account in COA. | Verifies double-entry ledger equilibrium. |
| **General Ledger Detail** | Audit Trail | Chronological list of all posted journal entries per account. | Detailed statutory audit inspection. |
| **Cash Flow Statement** | Statutory GL Report | Cashbox and Bank account journal lines categorized by activity. | Operating, investing, and financing cash liquidity. |
| **Accounts Receivable Aging** | Sub-Ledger Report | Unpaid student invoices grouped by due date (1–30, 31–60, 61–90+). | Credit control and collection management. |
| **Accounts Payable Aging** | Sub-Ledger Report | Unpaid vendor and landlord bills grouped by due date. | Working capital and supplier payment management. |
| **Branch Profitability** | Management Report | P&L partitioned by `branchId` dimension. | Performance comparison across physical centers. |
| **Teacher P&L Attribution** | Operational Dashboard | Attributed student fees minus teacher compensation. | Profitability analysis per educator. |

