# PHASE 7.0 — IMPLEMENTATION ROADMAP (PHASES 7.1 – 7.7)
**Product:** OX-DIGITAL Education  
**Workspace:** `D:\OX-DIGITAL\Mathe\OX-DIGITAL-GITHUB`  
**Repository:** `https://github.com/hosamsamer019/ox-digital-Education.git`  
**Date:** November 2026 (Final Readiness Reconciliation)  
**Status:** OD-701 THROUGH OD-708 APPROVED — OD-709 THROUGH OD-715 PENDING — PHASES 7.1–7.7 PLANNED (NOT STARTED)  
**Master Execution Framework:** See [PHASE_7_MASTER_EXECUTION_PLAN.md](file:///D:/OX-DIGITAL/Mathe/OX-DIGITAL-GITHUB/PHASE_7_MASTER_EXECUTION_PLAN.md) and [PHASE_7_TASK_TRACKER.md](file:///D:/OX-DIGITAL/Mathe/OX-DIGITAL-GITHUB/PHASE_7_TASK_TRACKER.md).

---

## 1. Executive Roadmap Overview

This roadmap defines the engineering and validation sequence for transforming OX-DIGITAL Education into a full double-entry accounting and financial management platform.

### Governance Status:
- **Authoritative Approved Decisions:** **OD-701 through OD-708** are formally **APPROVED BY PRODUCT OWNER**.
- **Pending Architectural Proposals:** **OD-709 through OD-715** are **PENDING / NOT APPROVED** (awaiting explicit Product Owner determination).

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                       PHASE 7 IMPLEMENTATION SEQUENCE                       │
├─────────────────────────────────────────────────────────────────────────────┤
│ Phase 7.1: Institution, Branch & Identity Foundation                        │
│    └── Planned (Not Started) • Approved: OD-701, OD-702, OD-703, OD-708(Inv)│
│                                 │                                           │
│ Phase 7.2: Pricing Catalog & Subscription Agreements                        │
│    └── Planned (Not Started) • Approved: OD-701, OD-703, OD-706             │
│                                 │                                           │
│ Phase 7.3: Invoicing, Receivables & Manual Collections                      │
│    └── Planned (Not Started) • Approved: OD-704, OD-706, OD-708             │
│                                 │                                           │
│ Phase 7.4: Cashboxes, Shift Closing & Accounts Payable                      │
│    └── Planned (Not Started) • Approved: OD-707 • Pending: OD-709, OD-715   │
│                                 │                                           │
│ Phase 7.5: Double-Entry General Ledger & Automated Journals                 │
│    └── Planned (Not Started) • Approved: OD-703, OD-704, OD-705 • Prereq:UP-701│
│                                 │                                           │
│ Phase 7.6: Financial Reporting, Reconciliation & Revenue Recognition        │
│    └── Planned (Not Started) • Approved: OD-703, OD-704, OD-705             │
│                                 │                                           │
│ Phase 7.7: Security, Audit Trails & Cutover                                 │
│    └── Planned (Not Started) • Approved: OD-701..OD-708 • Pending: OD-709.. │
└─────────────────────────────────────────────────────────────────────────────┘
```

> [!IMPORTANT]
> **Strict Execution Boundary Notice:**
> Documenting product decisions and architecture does **NOT** mean an implementation phase is completed.
> All engineering phases (**Phase 7.1 through Phase 7.7**) remain **PLANNED AND NOT STARTED**.
> Implementation of Phase 7.1 requires separate, explicit authorization from the Product Owner before code or schema changes begin.

---

## 2. Detailed Phase Breakdowns

### Phase 7.1 — Institution, Branch & Identity Foundation
* **Current Status:** **PLANNED (NOT STARTED)**
* **Prerequisite Decisions Approved:** OD-701 (Governance), OD-702 (Domain Separation), OD-703 (Unified Ledger), OD-708 (Payment Deletion Protection Invariant).
* **Pending Decisions:** OD-709 (Approval Authority), OD-713 (Legal Entity Structure — **not a blocker for Task 7.1**).
* **Prerequisite Clarification:** `PHASE_7_1_CURRENT_STATE_AUDIT.md` and `PHASE_7_1_LEGACY_DATA_MIGRATION_PLAN.md` are **Stage B design deliverables**, NOT external blockers preventing Task 7.1 from starting.
* **Objective:** Establish the organizational root, single primary manager authority, branch hierarchy (with zero-overhead single-branch support under OD-701), strict Domain A vs Domain B separation, and evaluate non-destructive protection options for historical financial records.
* **Task 7.1 Staged Execution Sequence:**
  1. *Stage A (Read-Only Discovery):* Inspect identity, relational, academic, and financial data structures; inspect auth, JWT, session, WebSocket, worker, and storage flows; zero database writes or migrations.
  2. *Stage B (Architecture & Migration Design):* Produce `PHASE_7_1_CURRENT_STATE_AUDIT.md` and `PHASE_7_1_LEGACY_DATA_MIGRATION_PLAN.md`; design Institution & Branch models; map existing records to initial institution & default branch; evaluate payment protection options and user lifecycle designs (without assuming `deletedAt` as already decided); design safe backfill & expand-and-contract schema progression.
  3. *Stage C (Product Owner Review Gate):* Present complete audit, migration design, and schema proposals. **STOP: Await explicit Product Owner approval before any DB mutation.**
  4. *Stage D (Authorized Implementation):* Implement approved models, tenant-scoping middleware, and auth claims; apply safe non-destructive migrations; implement tenant isolation across APIs, workers, sockets, storage; add automated test suites.
  5. *Stage E (Verification & Completion):* Run automated tests and builds; verify data-preservation invariants and auth compatibility; deliver Task 7.1 Completion Report; STOP.
* **Testing Strategy:** Regression test existing student login and teacher workflows with default institution scope; execute SEC-01..09 IDOR suite.

---

### Phase 7.2 — Pricing Catalog & Subscription Agreements
* **Current Status:** **PLANNED (NOT STARTED)**
* **Prerequisite Decisions Approved:** OD-701 (Central Pricing Authority), OD-703 (Branch Dimensions), OD-706 (Prepaid Session Packages).
* **Pending Decisions:** OD-712 (Currency Policy).
* **Scope Assumption:** EGP provisional currency for initial release. Multi-currency is outside current scope.
* **Objective:** Centralize pricing authority exclusively at the primary institution manager, support online and center fee structures, and enforce historical price preservation.
* **Key Deliverables:**
  1. `PriceCatalog` and `PriceCatalogItem` entities with effective dates and SKUs.
  2. Primary Manager catalog management UI (controlling base prices, promotional discounts, and fee structures).
  3. Support for online subscription plans and physical center prepaid session packages.
  4. `BillingAgreement` entity linking students/parents to locked pricing contracts with attributed `branchId`.
  5. Deprecation of mutable `Course.price` as the authoritative source for checkout.
* **Testing Strategy:** Price-locking integration test verifying that changing catalog price does not alter existing student agreements.

---

### Phase 7.3 — Invoicing, Receivables & Manual Collections
* **Current Status:** **PLANNED (NOT STARTED)**
* **Prerequisite Decisions Approved:** OD-704 (Accrual Basis), OD-706 (Attendance Billing), OD-708 (Refunds & Withdrawals).
* **Pending Decisions:** OD-714 (ETA Tax Compliance Readiness).
* **Scope Mandate:** Strictly manual financial administration (manual cash recording, bank transfers confirmed by staff). **No online payment gateway is required in current implementation scope.**
* **Objective:** Implement professional student billing, invoice generation, installment scheduling, branch-attributed payment allocations, 9-dimension physical package tracking, and non-destructive refund processing.
* **Key Deliverables:**
  1. `Invoice`, `InvoiceItem`, and `PaymentAllocation` models with mandatory `branchId`.
  2. Automated invoice dispatcher generating student bills under accrual accounting (OD-704). Invoicing does NOT automatically create earned revenue.
  3. Branch attribution for collections, receivables, and outstanding balances.
  4. Prepaid session package tracking across 9 explicit dimensions: sold, collected, outstanding, purchased sessions, attended sessions, remaining sessions, earned value, unconsumed obligation, refundable amount (OD-706). Attendance consumes 1 session; absence does not consume sessions.
  5. Non-destructive refund processing via credit notes and debit adjustments with manager approval (OD-708).
  6. Manual cash collection operations (Online payment gateways excluded from mandatory scope).
* **Unresolved Implementation Policies to Formalize During Phase 7.3:**
  - UP-702: Educational VAT treatment.
  - UP-706: Detailed refund formulas and administrative fee deduction percentages.
  - UP-712: Student absence credit-consumption policy.
  - UP-714: Consumed session valuation formula.
* **Testing Strategy:** Verification of receivables balances and partial payment allocations; non-destructive audit assertions.

---

### Phase 7.4 — Cashboxes, Shift Closing & Accounts Payable
* **Current Status:** **PLANNED (NOT STARTED)**
* **Prerequisite Decisions Approved:** OD-707 (Teacher Compensation across 4 models).
* **Pending Decisions:** OD-709 (Approval Authority), OD-715 (Cashbox Discrepancies).
* **Objective:** Provide robust physical front-desk cash management for physical center branches, shift reconciliation, discrepancy governance, and supplier expense tracking.
* **Key Deliverables:**
  1. `Cashbox`, `CashboxSession`, and `CashVoucher` models tied to physical branches.
  2. Cashier Front-Desk POS interface: shift opening, receipt printing, blind cash count at closing.
  3. Shift discrepancy handling: separate recording of shortages and overages without automatic reclassification; cashier explanation; manager approval workflow.
  4. `Supplier` directory and `SupplierInvoice` management for center operating expenses attributed per branch.
  5. Teacher monthly compensation statement generator implementing the 4 approved models (OD-707).
* **Unresolved Implementation Policies to Formalize During Phase 7.4:**
  - UP-704: Teacher percentage revenue-share calculation base and qualifying student definition.
  - UP-705: Cashbox discrepancy escalation thresholds.
* **Testing Strategy:** Shift reconciliation test verifying discrepancy calculations under overage and shortage conditions.

---

### Phase 7.5 — Double-Entry General Ledger & Automated Journals
* **Current Status:** **PLANNED (NOT STARTED)**
* **Prerequisite Decisions Approved:** OD-703 (Unified GL with Dimensions), OD-704 (Accrual Accounting), OD-705 (Progressive Subscription Revenue).
* **Pending Decisions:** OD-710 (Period Closing), OD-711 (Opening Balances), OD-712 (Currency Policy).
* **Objective:** Implement the core double-entry accounting engine: exactly ONE institution-wide general ledger with branch dimensions, Chart of Accounts, automated background journal posting, teacher compensation accruals, and monthly period closing.
* **Key Deliverables:**
  1. `Account`, `JournalEntry`, `JournalLine`, and `AccountingPeriod` models.
  2. Enforce `branchId` dimensioning on `JournalLine`.
  3. Strict isolation of Domain B general ledger from Domain A corporate finance ledger (no shared accounts, no auto-settlement — OD-702).
  4. Standard Chart of Accounts seed generator (formalized after UP-701 accounting validation).
  5. Event-driven posting engine:
     - Invoicing future subscription ➔ Debit AR / Credit Deferred Revenue [stamped with branchId].
     - Invoicing physical package ➔ Debit AR / Credit Unearned Package Obligation.
     - Cash Collected ➔ Debit Cashbox / Credit AR [stamped with branchId] (no revenue impact).
     - Service Delivered / Attendance ➔ Debit Deferred Revenue / Credit Earned Revenue [stamped with branchId].
     - Supplier Bill ➔ Debit Expense / Credit AP [stamped with branchId].
  6. Teacher compensation engine accruals based on approved statements (OD-707).
  7. Policy-dependent period closing controls (OD-710).
* **Unresolved Implementation Policies to Formalize During Phase 7.5:**
  - UP-701: Statutory Chart of Accounts structure and posting templates (**TRUE BLOCKER**).
  - UP-707: Fiscal year calendar alignment.
  - UP-710: Period closing security controls (policy dependent).
  - UP-711: Opening balance cutover rules.
  - UP-714: Consumed session valuation formula.
* **Testing Strategy:** Automated balance assertion: `ASSERT(SUM(debits) === SUM(credits))` across all transactions.

---

### Phase 7.6 — Financial Reporting, Reconciliation & Revenue Recognition
* **Current Status:** **PLANNED (NOT STARTED)**
* **Prerequisite Decisions Approved:** OD-703 (Unified GL Reporting), OD-704 (Accrual Basis), OD-705 (Progressive Subscription Revenue Recognition).
* **Pending Decisions:** OD-710 (Period Closing), OD-712 (Currency Policy).
* **Objective:** Deliver statutory accounting financial statements (consolidated and branch-level), aging analyses, bank reconciliations, and the progressive subscription revenue recognition engine.
* **Key Deliverables:**
  1. Statutory Financial Reports: Consolidated Balance Sheet, Income Statement (P&L), Trial Balance, Cash Flow for the Primary Manager.
  2. Branch-Level Financial Reports: Branch P&L, operating margin, collection efficiency, and branch AR aging.
  3. Online/Head-Office Branch Dimension reporting for digital subscriptions.
  4. Progressive Revenue Recognition Scheduler: cron job amortizing deferred subscription liabilities into earned revenue over service term (OD-705).
  5. Physical session package unconsumed liability vs earned revenue reports.
* **Testing Strategy:** Reconciliation verification asserting that Trial Balance net income matches Income Statement net income.

---

### Phase 7.7 — Security, Audit Trails & Cutover
* **Current Status:** **PLANNED (NOT STARTED)**
* **Prerequisite Decisions Approved:** OD-701 through OD-708.
* **Pending Decisions:** OD-709 (Approval Authority), OD-710 (Period Close & Reopen), OD-711 (Opening Balances & Legacy Migration), OD-714 (ETA Tax Compliance Readiness).
* **Objective:** Implement auditability, immutable posted transactions, opening balance reconciliation, cutover controls, and end-to-end security penetration testing. Period closing is policy-dependent and not a hard blocker.
* **Key Deliverables:**
  1. Immutable financial audit log tracking all approvals, mutations, and exceptions.
  2. Opening balance migration engine: balanced opening entries at cutover date without fabricating synthetic historical transactions.
  3. ETA E-Invoicing / E-Receipt schema readiness: tax registration fields, document lifecycle states, UUID preservation (real-time submission disabled).
  4. End-to-end security audit and penetration test on financial endpoints.
  5. Policy-dependent period closing controls (OD-710).
* **Testing Strategy:** Full adversarial audit verifying prevention of unauthorized refunds, direct balance tampering, or cross-tenant leaks.

---

## 3. Implementation Timeline & Effort Estimates

| Phase | Core Focus | Engineering Effort | Prerequisite Status | Implementation Status |
| :--- | :--- | :--- | :--- | :--- |
| **Phase 7.1** | Institution, Branch & Identity Foundation | 2 Weeks | **APPROVED: OD-701, OD-702, OD-703, OD-708(Inv)** | **PLANNED (NOT STARTED)** |
| **Phase 7.2** | Pricing Catalog & Subscription Agreements | 2 Weeks | **APPROVED: OD-701, OD-703, OD-706** | **PLANNED (NOT STARTED)** |
| **Phase 7.3** | Invoicing, Receivables & Manual Collections | 3 Weeks | **APPROVED: OD-704, OD-706, OD-708** | **PLANNED (NOT STARTED)** |
| **Phase 7.4** | Cashboxes, Shift Closing & Accounts Payable | 2.5 Weeks | **APPROVED: OD-707 • PENDING: OD-709, OD-715** | **PLANNED (NOT STARTED)** |
| **Phase 7.5** | Double-Entry General Ledger & Automated Journals | 3.5 Weeks | **APPROVED: OD-703, OD-704, OD-705 • TRUE PREREQ: UP-701** | **PLANNED (NOT STARTED)** |
| **Phase 7.6** | Financial Reporting, Reconciliation & Revenue Recognition | 3 Weeks | **APPROVED: OD-703, OD-704, OD-705 • PENDING: OD-712** | **PLANNED (NOT STARTED)** |
| **Phase 7.7** | Security, Audit Trails & Cutover | 2 Weeks | **APPROVED: OD-701..OD-708 • PENDING: OD-709..OD-714** | **PLANNED (NOT STARTED)** |
| **Total** | **Full End-to-End Financial System** | **18 Weeks** | **OD-701..OD-708 APPROVED • OD-709..OD-715 PENDING** | **AWAITING PO START AUTHORIZATION** |

---

*Reconciled by Antigravity Architecture Agent under Product Owner mandate.*
