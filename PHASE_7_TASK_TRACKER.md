# OX-DIGITAL Education — Phase 7
# Financial Management Master Task Tracker

**Document ID:** `OD-7000-TASK-TRACKER`  
**Workspace:** `D:\OX-DIGITAL\Mathe\OX-DIGITAL-GITHUB`  
**Repository:** `https://github.com/hosamsamer019/ox-digital-Education.git`  
**Last Updated:** November 2026 (Final Task 7.1 Readiness Reconciliation)  
**Master Execution Progress:** **0% (0 / 7 Tasks Completed — Initialized & Not Started)**  

---

## 1. Master Progress Summary Dashboard

| Task ID | Task Title | Status | Prerequisites | Approved Decisions | Unresolved Policy Dependencies | Target Milestones | PO Authorization |
| :--- | :--- | :---: | :--- | :---: | :---: | :---: | :---: |
| **TASK 7.1** | Institution, Branch & Identity Foundation | **STAGE D — TASK 7.1 IMPLEMENTATION COMPLETE — MIGRATIONS NOT APPLIED** | Phase 7.0 Architecture | OD-701, OD-702, OD-703, OD-708 (Invariant), OD-716, OD-717, OD-718, OD-719, OD-720 | UP-709 (Roles), UP-715 (Lifecycle Options Evaluated) | Stages A, B, C & D Complete; Cutover Deployment Pending | PO Authorized Stage D Implementation Complete |
| **TASK 7.2** | Pricing Catalog & Subscription Agreements | **NOT STARTED** | Task 7.1 Signed Off | OD-701, OD-703, OD-706 | EGP provisional scope | Stages 7.2.1 - 7.2.5 | Awaiting Authorization |
| **TASK 7.3** | Invoicing, Receivables & Manual Collections | **NOT STARTED** | Task 7.1, 7.2 Signed Off | OD-704, OD-706, OD-708 | UP-702 (VAT), UP-706 (Refund fee), UP-712 (Absence), UP-714 (Valuation) | Stages 7.3.1 - 7.3.7 | Awaiting Authorization |
| **TASK 7.4** | Cashboxes, Shift Closing & Accounts Payable | **NOT STARTED** | Task 7.1, 7.3 Signed Off | OD-707 | UP-704 (Teacher base), UP-705 (Discrepancy), UP-709 (Limits) | Stages 7.4.1 - 7.4.6 | Awaiting Authorization |
| **TASK 7.5** | Double-Entry General Ledger & Automated Journals | **NOT STARTED** | Task 7.1, 7.3, 7.4 Signed Off + UP-701 | OD-703, OD-704, OD-705 | UP-701 (**TRUE BLOCKER**), UP-707, UP-710 (Close policy) | Stages 7.5.1 - 7.5.6 | Awaiting Authorization |
| **TASK 7.6** | Financial Reporting, Reconciliation & Revenue Recognition | **NOT STARTED** | Task 7.5 Signed Off | OD-703, OD-704, OD-705 | EGP provisional reporting | Stages 7.6.1 - 7.6.6 | Awaiting Authorization |
| **TASK 7.7** | Security, Audit Trails & Cutover | **NOT STARTED** | Tasks 7.1 – 7.6 Signed Off | OD-701–OD-708 | UP-709, UP-710 (policy-dep), UP-711 (Cutover) | Stages 7.7.1 - 7.7.7 | Awaiting Authorization |

```
MASTER EXECUTION PROGRESS:
[--------------------------------------------------] 0% Complete (0 / 7 Tasks Started)
```

> [!NOTE]
> **GOVERNANCE STATUS NOTICE:**  
> The existence of architectural blueprints and task breakdowns does **NOT** constitute implementation. All seven tasks remain **NOT STARTED**. No implementation code, database migrations, or backfills have been executed.

---

## 2. Detailed Task Tracking Sheets

---

### TASK 7.1 — Institution, Branch & Identity Foundation
* **Current Status:** **STAGE D — TASK 7.1 IMPLEMENTATION COMPLETE — MIGRATIONS NOT APPLIED**
* **Approved Prerequisite Decisions:** OD-701 (Governance), OD-702 (Domain Separation), OD-703 (Unified GL), OD-708 (Payment Deletion Protection Invariant), OD-716 (Cutover Architecture Alternative B), OD-717 (Maintenance Window in principle), OD-718 (Option 3B Primary Manager), OD-719 (Online Branch Dimension), OD-720 (Option 7D Quarantine Indefinite Archival).
* **Pending Decisions:** OD-709 (Approval Limits), OD-713 (Legal Entity Structure — **not a blocker**).
* **Unresolved Policy Dependencies:** UP-709 (Staff Delegation Limits), UP-715 (Payment Protection & User Lifecycle Options Evaluated in Stage B).
* **Dependencies:** None. Root architectural task.
* **Prerequisite Status:** `PHASE_7_1_CURRENT_STATE_AUDIT.md` and `PHASE_7_1_LEGACY_DATA_MIGRATION_PLAN.md` have been produced and refined under Stage C review. Stage D implementation authorized by Product Owner.
* **Revised Staged Engineering Sequence:**
  - [x] **Stage A — Read-Only Discovery:** Inspected identity, academic, and financial data structures (28 models); inspected auth, JWT, session, WebSocket, worker, and storage flows; forensic audit completed with zero database writes.
  - [x] **Stage B — Architecture & Migration Design:** Produced updated `PHASE_7_1_CURRENT_STATE_AUDIT.md`; produced `PHASE_7_1_LEGACY_DATA_MIGRATION_PLAN.md`; designed Institution & Branch models; mapped all 28 existing tables; evaluated payment protection & user lifecycle options (UP-715); designed non-destructive expand-and-contract backfill.
  - [x] **Stage C — Product Owner Review & Design Refinement Gate:** Completed forensic evidence-based reconciliation of all three technical architecture gates: Gate 1 (`ProcessedMedia` lifecycle, absence of `Lesson.deletedAt`, `SetNull` orphan risks, OD-720 cold archival); Gate 2 (PostgreSQL connection freeze with `ALTER ROLE ox_admin NOLOGIN`, exact database catalog `ox_digital_education`, 30s session drain, and pre-cutover `datacl` preservation); Gate 3 (rigorous 28-model ownership matrix grounded in actual Prisma schema relations without invented links or ambiguous rules). All approved decisions OD-701–OD-708 and OD-716–OD-720 incorporated. Formal Stage C closure approved by Product Owner.
  - [x] **Stage D — Authorized Implementation:** Implemented approved models in `schema.prisma` (`Institution`, `Branch`, `PrimaryManagerInvitation`, tenant-aware fields & indexes); validated schema with `prisma validate`; generated Prisma Client v5.22.0 and compiled `@smartmath/database`; generated complete DDL migration file `20261102_task_7_1_institution_branch_foundation/migration.sql` (**MIGRATIONS NOT APPLIED TO ANY DATABASE** per strict zero-mutation constraints); implemented server-side tenant scoping & isolation middleware in `packages/shared`; implemented Primary Manager Option 3B invitation lifecycle with SHA-256 tokens and replay protection in `packages/shared` & `services/auth-service`; implemented safe lifecycle & data preservation services (OD-708 payment deletion prohibition, OD-720 media quarantine, lesson cycle-breaking, attendance provenance integrity); implemented Alternative B offline backfill protocol (`scripts/backfill_task_7_1_tenancy.ts`) with dry-run mode and 10-point reconciliation; added and executed comprehensive automated test suites (`tests/task_7_1/` with 65/65 tests passing across tenant isolation, invitation lifecycle, media/payment preservation safeties, and backfill reconciliation). *(STAGE D IMPLEMENTATION COMPLETE — MIGRATIONS NOT APPLIED)*
  - [ ] **Stage E — Verification & Completion:** Run automated tests and builds; verify data-preservation invariants and auth compatibility; deliver Task 7.1 Completion Report; STOP. *(NOT STARTED)*
* **Admin Dashboard Screens Introduced (Stage D):**
  - `/admin/finance/institution`: Institution profile, basic metadata.
  - `/admin/finance/branches`: Branch catalog, branch creation, default branch indicator, online dimension indicator.
* **Verification & Evidence Required:**
  - Read-only data inventory completed before proposing migrations.
  - Automated SEC-01 through SEC-09 negative IDOR attack suite passes.
  - Historical payment protection verified (no cascade deletion).
  - Single-branch institutions run with zero multi-branch UI overhead.
  - Detailed staff permissions are NOT implemented or finalized prematurely.
* **Product Owner Sign-Off:** `[AWAITING AUTHORIZATION TO START]`

---

### TASK 7.2 — Pricing Catalog & Subscription Agreements
* **Current Status:** **NOT STARTED (0%)**
* **Approved Prerequisite Decisions:** OD-701 (Centralized Pricing), OD-703 (Branch Attribution), OD-706 (Session Packages).
* **Pending Decisions:** OD-712 (Currency Policy).
* **Scope Assumption:** EGP provisional currency for initial release. Multi-currency is outside current scope.
* **Dependencies:** Task 7.1 must be completed and signed off.
* **Engineering Sub-Steps:**
  - [ ] **Step 7.2.1:** Pricing Catalog Schema (`PricingProduct`, `PricingPlan`, `PriceBook`, `StudentAgreement`).
  - [ ] **Step 7.2.2:** Central Catalog Management Service (Course packages, online tiers, private session rates).
  - [ ] **Step 7.2.3:** Price-Locking Agreement Engine (Snapshot prices at agreement signing).
  - [ ] **Step 7.2.4:** Branch Applicability & Discount Rules (Branch-specific rates and authorized promotional coupons).
  - [ ] **Step 7.2.5:** Admin Dashboard UI (`/admin/finance/pricing`, `/admin/finance/agreements`).
* **Admin Dashboard Screens Introduced:**
  - `/admin/finance/pricing`: Central product and service pricing catalog.
  - `/admin/finance/agreements`: Student subscription and lesson package agreements.
* **Verification & Evidence Required:**
  - Price changes assertively do not mutate existing student agreements retroactively.
  - Single-branch institutions see catalog without branch filters.
* **Product Owner Sign-Off:** `[AWAITING AUTHORIZATION]`

---

### TASK 7.3 — Invoicing, Receivables & Manual Collections
* **Current Status:** **NOT STARTED (0%)**
* **Approved Prerequisite Decisions:** OD-704 (Accrual Accounting), OD-706 (Attendance Billing), OD-708 (Refunds & Withdrawals).
* **Scope Mandate:** Strictly manual financial administration (cash, staff-confirmed bank transfers). **No online payment gateway is required.** Gateway integration is not a blocker.
* **Pending Decisions:** OD-714 (Tax Invoice Readiness).
* **Unresolved Policy Blockers:**
  - UP-702 (VAT Rate Policy — decide before finalizing invoice tax lines).
  - UP-706 (Refund Admin Fee — decide before finalizing refund calculation formulas).
  - UP-712 (Student Absence Session Consumption Policy).
  - UP-714 (Session Package Consumed Session Valuation Formula).
* **Dependencies:** Task 7.1 and Task 7.2 must be completed and signed off.
* **Engineering Sub-Steps:**
  - [ ] **Step 7.3.1:** Invoice & Receivables Schema (`StudentInvoice`, `InvoiceLineItem`, `PaymentRecord`, `RefundRecord`).
  - [ ] **Step 7.3.2:** Invoice Generation Engine (Subscription renewals, package purchases, attendance bills).
  - [ ] **Step 7.3.3:** Manual Cash Collection & Installment Settlement Engine (No gateway dependencies).
  - [ ] **Step 7.3.4:** Non-Destructive Refund & Withdrawal Engine (Prorated calculation & manager approval).
  - [ ] **Step 7.3.5:** Receivables Aging & Outstanding Balance Ledger.
  - [ ] **Step 7.3.6:** Explicit 9-Dimension Physical Session Package Tracking (Sold, collected, outstanding, purchased sessions, attended sessions, remaining sessions, earned value, unconsumed obligation, refundable amount).
  - [ ] **Step 7.3.7:** Admin Dashboard UI (`/admin/finance/invoices`, `/admin/finance/collections`, `/admin/finance/refunds`).
* **Admin Dashboard Screens Introduced:**
  - `/admin/finance/invoices`: Student invoice list, invoice generator, printable tax invoice.
  - `/admin/finance/collections`: Manual cash receipt recording, installment allocation.
  - `/admin/finance/refunds`: Refund requests, withdrawal prorated calculator, manager approval modal.
* **Verification & Evidence Required:**
  - Zero physical deletion of invoice or payment records.
  - Reversals properly documented with credit notes.
  - Invoicing does NOT automatically equal earned revenue.
  - Absence does NOT consume sessions.
  - Manual collections operate 100% without external payment gateway dependencies.
* **Product Owner Sign-Off:** `[AWAITING AUTHORIZATION]`

---

### TASK 7.4 — Cashboxes, Shift Closing & Accounts Payable
* **Current Status:** **NOT STARTED (0%)**
* **Approved Prerequisite Decisions:** OD-707 (Teacher Compensation across 4 models).
* **Pending Decisions:** OD-709 (Approval Limits), OD-715 (Cashbox Discrepancies).
* **Unresolved Policy Blockers:**
  - UP-704 (Teacher Revenue-Share Calculation Base & Qualifying Student Definition).
  - UP-705 (Cashbox Discrepancy Tolerance Limits).
  - UP-709 (Staff Delegation Limits).
* **Dependencies:** Task 7.1 and Task 7.3 must be completed and signed off.
* **Engineering Sub-Steps:**
  - [ ] **Step 7.4.1:** Cashbox & Shift Schema (`Cashbox`, `CashierShift`, `CashTransaction`, `CashboxDiscrepancy`).
  - [ ] **Step 7.4.2:** Shift Opening, Cash In/Out, and Blind Count Closing Engine.
  - [ ] **Step 7.4.3:** Cashbox Discrepancy Recording & Escalation Engine.
  - [ ] **Step 7.4.4:** Supplier Records & Accounts Payable Engine (`Supplier`, `SupplierBill`, `BillPayment`).
  - [ ] **Step 7.4.5:** Teacher Compensation Statement Engine (OD-707: 4 compensation models).
  - [ ] **Step 7.4.6:** Admin Dashboard UI (`/admin/finance/cashboxes`, `/admin/finance/shifts`, `/admin/finance/expenses`, `/admin/finance/suppliers`, `/admin/finance/teacher-compensation`).
* **Admin Dashboard Screens Introduced:**
  - `/admin/finance/cashboxes`: Branch cashboxes, active cashier, real-time balance.
  - `/admin/finance/shifts`: Cashier shift open/close, blind cash count, discrepancy resolution.
  - `/admin/finance/expenses`: Branch operational expense recording, approval requests.
  - `/admin/finance/suppliers`: Supplier directory and accounts payable bills.
  - `/admin/finance/teacher-compensation`: Monthly teacher compensation statements and disbursements.
* **Verification & Evidence Required:**
  - Cashier blind count cannot see system expected balance until physical cash is submitted.
  - Teacher compensation statements strictly reconcile against attendance records.
* **Product Owner Sign-Off:** `[AWAITING AUTHORIZATION]`

---

### TASK 7.5 — Double-Entry General Ledger & Automated Journals
* **Current Status:** **NOT STARTED (0%)**
* **Approved Prerequisite Decisions:** OD-703 (Unified GL with Branch Dimensions), OD-704 (Accrual Accounting), OD-705 (Deferred Revenue).
* **Pending Decisions:** OD-710 (Period Close), OD-711 (Opening Balances), OD-712 (Currency Policy).
* **Unresolved Policy Blockers:**
  - UP-701 (**TRUE BLOCKER:** Accounting validation of statutory Chart of Accounts structure & posting templates).
  - UP-707 (Institutional Fiscal Year start month definition).
  - UP-710 (Period closing controls).
  - UP-711 (Opening balances cutover rules).
  - UP-714 (Session package consumed session valuation formula).
* **Dependencies:** Task 7.1, 7.3, and 7.4 must be completed and signed off, plus formal UP-701 accounting validation.
* **Engineering Sub-Steps:**
  - [ ] **Step 7.5.1:** General Ledger Schema (`Account`, `JournalEntry`, `JournalLine`, `FiscalPeriod`).
  - [ ] **Step 7.5.2:** Balanced Journal Engine ($\sum \text{Debits} = \sum \text{Credits}$ validator).
  - [ ] **Step 7.5.3:** Automated Posting Rules (Explicitly decoupling invoicing from revenue; service-based revenue recognition; attendance-based package consumption).
  - [ ] **Step 7.5.4:** Deferred Revenue Amortization Engine (OD-705 progressive recognition).
  - [ ] **Step 7.5.5:** Opening Balance Ingestion Engine.
  - [ ] **Step 7.5.6:** Admin Dashboard UI (`/admin/finance/chart-of-accounts`, `/admin/finance/journal-entries`, `/admin/finance/general-ledger`).
* **Admin Dashboard Screens Introduced:**
  - `/admin/finance/chart-of-accounts`: Chart of accounts tree, account classification.
  - `/admin/finance/journal-entries`: Journal entry list, manual journal entry creator, posting status.
  - `/admin/finance/general-ledger`: Account ledger search, running balances, branch filter.
* **Verification & Evidence Required:**
  - Database rejects any unbalanced journal entry.
  - Invoicing does NOT automatically recognize earned revenue immediately.
  - Collection alone does NOT create earned revenue.
  - Branch dimension accurately populated on all income and expense journal lines.
* **Product Owner Sign-Off:** `[AWAITING AUTHORIZATION]`

---

### TASK 7.6 — Financial Reporting, Reconciliation & Revenue Recognition
* **Current Status:** **NOT STARTED (0%)**
* **Approved Prerequisite Decisions:** OD-703 (Branch Dimensional P&L), OD-704 (Accrual Statements), OD-705 (Earned Revenue Recognition).
* **Pending Decisions:** OD-710 (Period Close), OD-712 (Currency Reporting).
* **Dependencies:** Task 7.5 must be completed and signed off.
* **Engineering Sub-Steps:**
  - [ ] **Step 7.6.1:** Financial Report Generation Engine (Trial Balance, P&L, Balance Sheet, Cash Flow).
  - [ ] **Step 7.6.2:** Branch Performance & Consolidated Reporting Engine.
  - [ ] **Step 7.6.3:** Bank & Cashbox Reconciliation Engine.
  - [ ] **Step 7.6.4:** Revenue Recognition & Subscription Amortization Reports.
  - [ ] **Step 7.6.5:** Physical Session Package Outstanding Obligation vs Earned Value Reports.
  - [ ] **Step 7.6.6:** Admin Dashboard UI (`/admin/finance/overview`, `/admin/finance/reports`, `/admin/finance/reconciliation`).
* **Admin Dashboard Screens Introduced:**
  - `/admin/finance/overview`: Executive KPI dashboard (Revenue, Collections, Expenses, Cash, Net Income).
  - `/admin/finance/reports`: Income Statement, Balance Sheet, Trial Balance, Branch P&L.
  - `/admin/finance/reconciliation`: Bank statement upload, cashbox shift vs. GL reconciliation.
* **Verification & Evidence Required:**
  - Trial balance net debits equals net credits exactly.
  - Consolidated report matches sum of individual branch P&L reports.
  - Remaining package sessions report matches unearned package liability.
* **Product Owner Sign-Off:** `[AWAITING AUTHORIZATION]`

---

### TASK 7.7 — Security, Audit Trails & Cutover
* **Current Status:** **NOT STARTED (0%)**
* **Approved Prerequisite Decisions:** OD-701 through OD-708.
* **Pending Decisions:** OD-709 (Approval Authority), OD-710 (Period Close & Reopen), OD-711 (Opening Balance Verification), OD-714 (Tax Invoice Architecture).
* **Unresolved Policy Blockers:** UP-709, UP-710 (policy-dep; not a hard blocker), UP-711.
* **Dependencies:** Tasks 7.1 through 7.6 must be completed and signed off.
* **Engineering Sub-Steps:**
  - [ ] **Step 7.7.1:** Immutable Financial Audit Trail Engine (`FinancialAuditTrail`).
  - [ ] **Step 7.7.2:** Cutover Balance Verification & Opening Reconciliation.
  - [ ] **Step 7.7.3:** Segregation of Duties & Delegated Authority Verification (based on approved UP-709 policies).
  - [ ] **Step 7.7.4:** Policy-Dependent Period Closing Scaffolding (OD-710; active only if approved).
  - [ ] **Step 7.7.5:** Full Multi-Tenant Security & Negative Penetration Test Suite.
  - [ ] **Step 7.7.6:** Controlled Cutover & Production Readiness Verification.
  - [ ] **Step 7.7.7:** Admin Dashboard UI (`/admin/finance/settings`, `/admin/finance/audit`, `/admin/finance/period-closing` [policy-dependent]).
* **Admin Dashboard Screens Introduced:**
  - `/admin/finance/settings`: Institutional financial configurations.
  - `/admin/finance/audit`: Comprehensive financial audit trail inspection console.
  - `/admin/finance/period-closing`: Policy-dependent close console (active only if OD-710 approved).
* **Verification & Evidence Required:**
  - Direct update or deletion of posted financial records is structurally blocked.
  - Opening balances reconcile without synthetic transaction fabrication.
  - Complete system audit trail operational.
* **Product Owner Sign-Off:** `[AWAITING AUTHORIZATION]`

---

*Maintained and reconciled by Antigravity Architecture Agent under Product Owner mandate.*
