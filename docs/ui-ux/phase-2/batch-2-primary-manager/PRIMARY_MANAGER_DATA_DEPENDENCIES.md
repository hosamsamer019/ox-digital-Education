# OX-DIGITAL Education — UI/UX Phase 2 (Batch 2)
# Document 5: Primary Manager Data & API Dependencies Matrix
**Document ID:** `PRIMARY_MANAGER_DATA_DEPENDENCIES`  
**Status:** COMPLETE & AUTHORITATIVE — READY FOR PRODUCT OWNER REVIEW  
**Date:** 2026-11-03  
**Workspace:** `D:\OX-DIGITAL\Mathe\OX-DIGITAL-GITHUB`  
**Target Path:** `docs/ui-ux/phase-2/batch-2-primary-manager/PRIMARY_MANAGER_DATA_DEPENDENCIES.md`  
**Classification:** Backend Integration Contract & Gap Analysis  

> [!NOTE] Baseline Context
> This document maps the screen requirements of the Primary Manager Dashboard to existing backend contracts, schemas, and in-memory accounting modules. It rigorously distinguishes **Currently Existing Capabilities** (from Phase 2.0A/B Increments 1–4 and Prisma Schema) from **Proposed Future Requirements** (to be implemented in future backend increments).

---

## 1. Existing Foundation vs Proposed Requirements Summary

| Architectural Layer | Existing Components in Repository | Future Backend Requirements (Pending Increments) |
| :--- | :--- | :--- |
| **Relational Schema (Prisma)** | `Institution`, `Branch` (with `isOnline`), `User`, `StudentProfile`, `TeacherProfile`, `AcademicEnrollment`, `Attendance`, `CourseGroup`, `Exam` | Persistent relational models for: `FinancialAgreement`, `PaymentSchedule`, `CollectionReceipt`, `ExpenseVoucher`, `CashboxClosingLog`, `DiscrepancyIncident`. |
| **In-Memory Accounting Domain (`packages/shared/src/accounting`)** | `Cashbox`, `CashboxMovement`, `CashboxTransferEngine`, `MoneyValue`, `MovementType` (COLLECTION, DISBURSEMENT, TRANSFER_IN, TRANSFER_OUT, REVERSAL), Atomic Transfer Rollback, Append-Only Reversals. | Persistence layer bridging in-memory `Cashbox` aggregate to PostgreSQL/Prisma; multi-tenant event stream. |
| **Backend API Services** | `user-service`, `course-service`, `analytics-service`, `auth-service` with JWT auth and branch identification. | Dedicated `accounting-service` or accounting routes under `/api/v1/accounting/*` with Maker-Checker state machine. |
| **Frontend UI Foundation** | Approved App Shell (Batch 1), Cairo/JetBrains Mono typography, Tailwind color tokens, RTL infrastructure. | Dynamic API query integration via React Query / Axios; live state stores for multi-branch filtering. |

---

## 2. Granular Screen-to-Data Mapping

### 2.1 Screen A: Main Executive Dashboard (`PM-DASH-01`)

| UI Component / Widget | Metric / Field Required | Backend Data Source / Origin | Status | Required API Shape / Query |
| :--- | :--- | :--- | :--- | :--- |
| **KPI-01: Actual Collections** | Sum of actual verified collections in selected date range & scope. | Sum of `CashboxMovement` where `type = COLLECTION`. | **Proposed API** (Domain logic exists in `Cashbox`) | `GET /api/v1/accounting/kpi/collections?branchId=&from=&to=` |
| **KPI-02: Overdue Receivables** | Sum of active student scheduled payment items with `dueDate <= Today` & `remaining > 0` (physical centers). | Unsettled payment schedule items linked to `AcademicEnrollment`. | **Proposed API & Model** | `GET /api/v1/accounting/kpi/overdue?branchId=` |
| **KPI-03: Cashbox Liquidity** | Sum of physical cash in active tills and vault. | In-memory `Cashbox.currentBalance` aggregate across active branch cashboxes. | **Domain Exists** (Needs persistence) | `GET /api/v1/accounting/cashboxes/balances?institutionId=` |
| **KPI-04: Recognized Revenue** | Value of educational services delivered based on verified attendance. | `Attendance` records joined with approved course allocation plan. Derived from allocation plan; teacher pay decoupled under UP-704. | **Partial** (`Attendance` exists; allocation plan model requires backend contract) | `GET /api/v1/accounting/kpi/recognized-revenue?branchId=&period=` |
| **KPI-05: Pending Approvals Queue**| Count and list of vouchers, discrepancy dossiers, and adjustment requests. | Pending Maker-Checker items awaiting `PRIMARY_MANAGER` approval. | **Proposed API & Model** | `GET /api/v1/accounting/approvals/pending?institutionId=` |

---

### 2.2 Screen B: Branch Management & Overview (`PM-BR-01`)

| UI Component / Widget | Metric / Field Required | Backend Data Source / Origin | Status | Required API Shape / Query |
| :--- | :--- | :--- | :--- | :--- |
| **Branch Identification** | Branch name, code, type, physical address, and status. | Prisma `Branch` model (`id`, `name`, `code`, `isOnline`, `address`, `status`). | **EXISTING** | `GET /api/v1/branches?institutionId=` |
| **Branch Cashbox Aggregation** | Total cash stored in branch tills. | `Cashbox` filtered by `branchId`. | **Domain Exists** | `GET /api/v1/accounting/branches/:id/cashbox-summary` |
| **Branch Student Headcount** | Total active students per branch. | Count of `AcademicEnrollment` grouped by `branchId`. | **EXISTING** | `GET /api/v1/analytics/branches/:id/enrollment-stats` |

---

### 2.3 Screen C: Student Financial Accounts & Profile (`PM-STU-01`)

| UI Component / Widget | Metric / Field Required | Backend Data Source / Origin | Status | Required API Shape / Query |
| :--- | :--- | :--- | :--- | :--- |
| **Student Identity & Class** | Student name, code, guardian phone, group, and branch. | Prisma `User`, `StudentProfile`, `AcademicEnrollment`. | **EXISTING** | `GET /api/v1/students/:id` |
| **Tier 1: Agreement & Discount** | Contract agreed price, granted scholarships, net agreed price. | `FinancialAgreement` (Contract entity). | **Proposed Model** | `GET /api/v1/accounting/students/:id/agreement` |
| **Tier 2: Payment Schedule**| Payment schedule items, due dates, billed amounts, remaining dues. | `PaymentScheduleItem` entity. | **Proposed Model** | `GET /api/v1/accounting/students/:id/schedule` |
| **Tier 3: Verified Receipts** | Receipt number, date, amount paid, payment method, cashbox ID. | `CollectionReceipt` and `CashboxMovement`. | **Proposed API** (Movement domain exists) | `GET /api/v1/accounting/students/:id/receipts` |
| **Tier 4: Delivered Lessons** | Completed lessons, attendance status, calculated earned value. | Prisma `Attendance` + approved course allocation plan. | **Partial** (`Attendance` exists; allocation plan model required) | `GET /api/v1/accounting/students/:id/delivery-history` |
|
---

### 2.4 Screen D: Cashbox Governance & Reconciliations (`CB-MGT-01`)

| UI Component / Widget | Metric / Field Required | Backend Data Source / Origin | Status | Required API Shape / Query |
| :--- | :--- | :--- | :--- | :--- |
| **Cashbox Register & Balances** | Cashbox code, name, branch, custodian, and current balance. | `Cashbox.currentBalance` and metadata. Every cashbox (including Central Vault) strictly tied to an approved `Branch`. | **Domain Exists** | `GET /api/v1/accounting/cashboxes?branchId=` |
| **Cashbox Transfer Execution** | Source till, destination vault, amount, transferId, conservation. | `CashboxTransferEngine.executeTransfer()` (Tested in Inc 4). Intra-institution only between branch cashboxes. | **Domain Exists** (Atomic rollback verified) | `POST /api/v1/accounting/cashboxes/transfer` |
| **Daily Closing & Discrepancy** | Expected balance, entered blind count, variance, incident dossier. | `CashboxClosingLog` & `DiscrepancyIncident` (Neutral review under `UP-705`; no liability shifts or write-offs). | **Proposed Model** | `POST /api/v1/accounting/cashboxes/:id/close-recon` |

---

### 2.5 Screen E: Collections Monitoring & Expense Authorizations (`PM-COLL-01` & `PM-EXP-01`)

| UI Component / Widget | Metric / Field Required | Backend Data Source / Origin | Status | Required API Shape / Query |
| :--- | :--- | :--- | :--- | :--- |
| **Collection Receipts Feed** | Real-time stream of issued receipts across campus tills. | Sequential `CashboxMovement` where `type = COLLECTION`. | **Domain Exists** | `GET /api/v1/accounting/collections?branchId=&limit=50` |
| **Expense Voucher Authorization**| Voucher ID, cost center, amount, beneficiary, flexible attachments, maker ID. | `ExpenseVoucher` entity with Maker-Checker state (`SUBMITTED`, `AUTHORIZED`, `REJECTED`). Flexible supporting documents (invoices, receipts, delivery notes, reports; no tax/VAT). | **Proposed Model** | `POST /api/v1/accounting/expenses/:id/authorize` |

---

### 2.6 Screen F: Teacher Educational Evidence & Settlement Oversight (`PM-TCH-01`)

| UI Component / Widget | Metric / Field Required | Backend Data Source / Origin | Status | Required API Shape / Query |
| :--- | :--- | :--- | :--- | :--- |
| **Teacher Educational Evidence**| Delivered class sessions, attendance logs, verified student counts. | Prisma `CourseGroup`, `Attendance`, `AcademicEnrollment`. | **EXISTING** | `GET /api/v1/teachers/:id/delivery-evidence` |
| **Teacher Settlement Calculation**| Compensation rate, gross due, prior advances, net payable. | **LOCKED (UP-704)** — System displays recorded evidence only; dues are not inferred from student recognized revenue or lesson counts. | **Fail-Closed Gate** | `GET /api/v1/accounting/teachers/:id/settlement-status` |

---

### 2.7 Screen G: Audited Financial Reports (`PM-RPT-01`)

| UI Component / Widget | Metric / Field Required | Backend Data Source / Origin | Status | Required API Shape / Query |
| :--- | :--- | :--- | :--- | :--- |
| **Audit Logs & Historical Reports**| Filtered historical datasets with immutable sequential IDs and export to Excel/PDF. | Read-only aggregate queries on cashbox journals and installment sub-ledgers. | **Proposed API** | `POST /api/v1/accounting/reports/generate` |

---

## 3. Recommended Future Backend Implementation Roadmap

To transition the Primary Manager Dashboard from design specification into a live software module, the backend must implement:

1. **Persistent Accounting Entities (Prisma Migration):**
   - Create tables: `FinancialAgreement`, `InstallmentSchedule`, `CollectionReceipt`, `ExpenseVoucher`, `CashboxClosingLog`, `DiscrepancyIncident`.
   - Ensure foreign keys enforce `institutionId` and `branchId` multi-tenant partitioning.
2. **PostgreSQL Adapter for `Cashbox` Domain Engine:**
   - Wire the in-memory `Cashbox` and `CashboxTransferEngine` from `packages/shared/src/accounting` into a database-backed transaction manager using PostgreSQL row-level locking (`SELECT ... FOR UPDATE`).
3. **Maker-Checker State Engine:**
   - Implement audit-trailed state transitions (`DRAFT` $\to$ `SUBMITTED` $\to$ `AUTHORIZED` / `REJECTED`) with cryptographic signature tokens and IP logging.
4. **Fail-Closed Interceptors:**
   - Enforce programmatic blocks preventing automated discrepancy write-offs, employee liability shifts, surplus absorption, or accounting balancing entries (`UP-705`), and decouple teacher compensation formulas from student revenue calculations (`UP-704`).

