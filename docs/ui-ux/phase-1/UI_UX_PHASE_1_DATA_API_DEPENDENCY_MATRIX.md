# OX-DIGITAL Education — UI/UX Design Track — Phase 1
# Document 6: Screen Data & Backend API Dependency Matrix
**Document ID:** `UI_UX_PHASE_1_DATA_API_DEPENDENCY_MATRIX`  
**Status:** REVISED & ALIGNED — READY FOR PRODUCT OWNER REVIEW  
**Date:** 2026-11-03  
**Workspace:** `D:\OX-DIGITAL\Mathe\OX-DIGITAL-GITHUB`  
**Classification:** Technical Dependency & Integration Specification  

---

## 1. Architectural Integration Reality

To ensure that the UI/UX design track is grounded strictly in engineering reality, this matrix audits every proposed screen against existing backend microservices, Prisma models, and Phase 2.0B shared domain engines.

### 1.1 Service Landscape Overview
- **`auth-service` (Port 3001):** Active. Handles login, token refresh, and tenant claim embedding (`institutionId`, `branchId`, `isPrimaryManager`).
- **`user-service` (Port 3002):** Active. Handles basic user profiles, students, and parent associations.
- **`course-service` (Port 3003):** Active. Handles courses, center groups, lessons, exams, homework, and attendance.
- **`analytics-service` (Port 3004):** Active. Student risk scores and completion statistics.
- **`packages/shared/src/accounting/`:** Pure TypeScript domain models (Increments 1–4). **No REST HTTP controllers or accounting microservice exist yet in the repository.**

---

## 2. Screen-by-Screen Data & API Dependency Audit

| Screen ID | Screen Name | Required UI Data Fields | Backend Source Entity / Type | Current API Status | Gap / Required Backend Deliverable |
| :--- | :--- | :--- | :--- | :---: | :--- |
| **`AUTH-01`** | Unified Login | `email`, `password`, `role` | `User` (Prisma) | **AVAILABLE** | Uses `POST /api/auth/login`. Returns JWT token with tenant claims. |
| **`AUTH-04`** | Director Onboarding | `token`, `password`, `institutionId` | `PrimaryManagerInvitation` | **AVAILABLE** | Uses `POST /api/auth/invitations/accept`. Verified under Option 3B. |
| **`PM-DASH-01`** | Executive Hub | Total collections, cash in tills, outstanding dues, branch health | Aggregate across Cashboxes, SubLedgers, Branches | **MISSING_BACKEND** | Requires new endpoint: `GET /api/accounting/institutions/:id/executive-summary`. Needs accounting service. |
| **`PM-BR-01`** | Branch Performance | Branch codes, physical/online flags, active students, branch cash | `Branch`, `CenterGroup`, `Cashbox` | **PARTIALLY_AVAILABLE** | Branch metadata exists in `Branch` model; financial balance per branch requires accounting service. |
| **`PM-APPR-01`** | Approval Center | Vouchers pending review, discrepancy reports, teacher settlement drafts | `ExpenseVoucher`, `DiscrepancyReport`, `TeacherSettlement` | **MISSING_BACKEND** | Maker-checker approval state engine not yet exposed via HTTP API. |
| **`ACC-DASH-01`** | Accounting Hub | Today's receipts, unallocated collections, cashbox closing status | `CollectionReceiptEvidence`, `CashboxDailyReconciliation` | **SHARED_DOMAIN_ONLY** | Logic exists in `packages/shared/src/accounting/`; needs `GET /api/accounting/dashboard`. |
| **`ACC-STU-01`** | Student Sub-Ledger Directory | Student ID, agreed price, total paid, remaining due, active status | `StudentSubLedger` | **SHARED_DOMAIN_ONLY** | Domain model exists in `subLedger.ts`; needs `GET /api/accounting/subledgers`. |
| **`ACC-REC-01`** | Collection Receipts | Receipt #, timestamp, student, amount, cashbox, payment method | `CollectionReceiptEvidence` | **SHARED_DOMAIN_ONLY** | Domain model exists in `obligations.ts`; needs `GET /api/accounting/receipts`. |
| **`ACC-ALLOC-01`**| Allocation Engine | Unallocated receipts, pending schedule obligations, allocation map | `CollectionAllocationRecord` | **SHARED_DOMAIN_ONLY** | State machine exists in `subLedger.ts`; needs `POST /api/accounting/allocations`. |
| **`ACC-REV-01`** | Reversal Desk | Target tx ID, reversal type, compensating tx ID, audit reason | `CashboxMovementReversedEvent` | **SHARED_DOMAIN_ONLY** | Append-only logic exists in `cashbox.ts`; needs `POST /api/accounting/reversals`. |
| **`ACC-GL-01`** | Journal Explorer | Entry ID, date, lines, accounts (2210/4100), debit, credit | `JournalEntry`, `JournalLine` | **SHARED_DOMAIN_ONLY** | Double-entry engine exists in `journalEntry.ts`; needs read-only GET endpoint. |
| **`CSH-DESK-01`** | Rapid Collection Desk | Student search, pending due obligations, amount, cashbox till ID | `StudentSubLedger`, `Cashbox` | **SHARED_DOMAIN_ONLY** | Needs `POST /api/cashier/collections`. Distinctly executes: collection evidence generation, physical cashbox `CASH_IN`, sub-ledger unallocated/allocated credit, and GL journal posting (Debit Cash Asset, Credit Deferred Revenue). Zero earned revenue is recognized. |
| **`CSH-TX-01`** | Shift History | Cashier ID, receipts issued during shift, total cash collected | `CashboxTransaction` | **SHARED_DOMAIN_ONLY** | Filter by `actorUserId` exists in `cashbox.ts`; needs `GET /api/cashier/shift-receipts`. |
| **`CSH-CLOSE-01`**| Shift Handover | Counted cash, declared variance, transfer to branch vault | `CashboxTransfer`, `Cashbox` | **SHARED_DOMAIN_ONLY** | Transfer engine exists in `cashbox.ts`; needs `POST /api/cashier/handover`. |
| **`TCH-DASH-01`** | Teacher Overview | Teacher groups, upcoming lessons, attendance rate, verified dues | `CenterGroup`, `Lesson`, `Attendance` | **PARTIALLY_AVAILABLE** | Academic groups and lessons available via `course-service`; dues statement missing. |
| **`TCH-EVID-01`** | Delivery Evidence | Lesson ID, branch ID, attended student IDs, certification state | `EducationalDeliveryEvidence` | **SHARED_DOMAIN_ONLY** | Domain evidence model in `evidence.ts`; attendance in `course-service`; bridge API needed. |
| **`TCH-DUES-01`** | My Verified Dues | Completed lessons, verified units, confirmed payout statement | `TeacherCompensation` | **BLOCKED_POLICY** | Blocked under `UP-704` for variable share base. Initial UI displays verified delivery units and approved fixed models only; variable percentages remain unconfigured. |
| **`STU-FIN-01`** | Student Financial Profile | Agreement price snapshot, schedule items, paid, remaining | `StudentFinancialAgreement`, `StudentSubLedger` | **SHARED_DOMAIN_ONLY** | Full domain model in `agreement.ts` and `subLedger.ts`; needs `GET /api/students/:id/financial`. |
| **`STU-AGR-01`** | Create Agreement | Catalog price, discount reason, net price, schedule calendar | `AgreementPriceSnapshot`, `StudentFinancialAgreement` | **SHARED_DOMAIN_ONLY** | Domain validation in `agreement.ts`; needs `POST /api/students/:id/agreements`. |
| **`STU-REC-01`** | Printable Receipt | Receipt number, student, amount, date, cashier, QR digest | `CollectionReceiptEvidence` | **SHARED_DOMAIN_ONLY** | Evidence structure in `obligations.ts`. Backend delivers standardized JSON receipt payload; rendering format (80mm vs A4) is a proposed UI option for PO decision (`POD-UI-05`). |
| **`CB-LIST-01`** | Cashbox Register | Cashbox ID, branch ID, name, current balance, active status | `Cashbox` | **SHARED_DOMAIN_ONLY** | Domain class exists in `cashbox.ts`; needs `GET /api/accounting/cashboxes`. |
| **`CB-VIEW-01`** | Cashbox Ledger | Running balance, collections, expenses, transfers in/out | `CashboxTransaction` | **SHARED_DOMAIN_ONLY** | Domain map `cashbox.transactions` exists; needs `GET /api/accounting/cashboxes/:id/ledger`. |
| **`CB-XFER-01`** | Inter-Cashbox Transfer| Source ID, Dest ID, amount, business date, actor role | `CashboxTransferEngine` | **SHARED_DOMAIN_ONLY** | Atomic two-sided engine in `cashbox.ts`; needs `POST /api/accounting/transfers`. |
| **`CB-RECON-01`** | Daily Closing Reconcile| Opening, collections, transfers, expenses, counted balance | `CashboxDailyReconciliation` | **SHARED_DOMAIN_ONLY** | Full reconciliation engine in `cashbox.ts`; needs `POST /api/accounting/cashboxes/:id/reconcile`. |
| **`CB-DISC-01`** | Discrepancy Investigate| Incident ID, variance, notes, status (strictly PENDING) | `CashboxDailyReconciliation` | **SHARED_DOMAIN_ONLY** | Invariant in `cashbox.ts` under `UP-705`. Manages pending-investigation and review states only; zero automatic write-off or balance clearing endpoint is assumed. |
| **`EXP-LIST-01`** | Expenses Register | Voucher #, category, amount, date, cashbox ID, reason | `CashboxTransaction` (EXPENSE) | **SHARED_DOMAIN_ONLY** | Method `recordExpense()` exists in `cashbox.ts`; needs `GET /api/accounting/expenses`. |
| **`EXP-NEW-01`** | Record Expense Voucher| Voucher #, category, amount, cashbox, receipt scan | `RecordExpenseParams` | **SHARED_DOMAIN_ONLY** | Pure domain in `cashbox.ts`; needs `POST /api/accounting/expenses` with multipart upload. |
| **`REP-COL-01`** | Collections Report | Total collected per branch, payment method split, date range | Multi-Cashbox Aggregation | **SHARED_DOMAIN_ONLY** | Calculation exists in `Cashbox.reconcileDaily`; needs reporting endpoint. |
| **`REP-DUE-01`** | Dues Aging Report | Aging buckets (0-30, 31-60, 60+ days) per student agreement | `StudentSubLedger` schedule | **SHARED_DOMAIN_ONLY** | Scheduled due dates in `agreement.ts`; needs reporting calculation endpoint. |
| **`REP-EARN-01`** | Earned Revenue Report | Tuition earned by delivered lessons vs deferred liability | `AccrualRevenueRecognitionEngine` | **SHARED_DOMAIN_ONLY** | Recognition pairings exist in `revenueRecognitionEngine.ts`; needs accrual reporting endpoint. |

---

## 3. Required Backend API Specification for Frontend Handoff

Before the frontend screens can be implemented with live data, the backend team must implement an **Accounting REST Gateway** exposing the pure domain engines via standardized HTTP endpoints:

### 3.1 Proposed Endpoint Grouping
1. **Tenant Cashbox Gateway:**
   - `GET /api/v1/institutions/:instId/cashboxes` (Filter by `branchId`)
   - `GET /api/v1/institutions/:instId/cashboxes/:id/ledger`
   - `POST /api/v1/institutions/:instId/cashboxes/transfers` (Executes atomic `CashboxTransferEngine`)
   - `POST /api/v1/institutions/:instId/cashboxes/:id/reconcile` (Executes `reconcileDaily`)
2. **Student Financial Gateway:**
   - `GET /api/v1/institutions/:instId/students/:id/subledger`
   - `POST /api/v1/institutions/:instId/students/:id/agreements`
   - `POST /api/v1/institutions/:instId/collections` (Frontline cashier collection: records evidence, cashbox till movement, subledger unallocated position, and GL deferred revenue journal voucher)
   - `POST /api/v1/institutions/:instId/allocations` (Accountant sub-ledger allocation)
   - `POST /api/v1/institutions/:instId/reversals` (Compensating reversal)
3. **Disbursements & Expenses:**
   - `GET /api/v1/institutions/:instId/expenses`
   - `POST /api/v1/institutions/:instId/expenses` (With voucher attachment)
4. **Educational Proof & Accrual Pairing:**
   - `POST /api/v1/institutions/:instId/lessons/:id/certify-delivery`
   - `POST /api/v1/institutions/:instId/revenue/recognize-paired`
   - `GET /api/v1/institutions/:instId/reports/earned-revenue`
