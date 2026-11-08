# OX-DIGITAL Education — UI/UX Phase 2 (Batch 3)
# Document 5: Accountant Data Dependencies, API Contracts & Persistence Mapping
**Document ID:** `ACCOUNTANT_DATA_DEPENDENCIES`  
**Status:** COMPLETE & AUTHORITATIVE — READY FOR PRODUCT OWNER REVIEW  
**Date:** 2026-11-04  
**Workspace:** `D:\OX-DIGITAL\Mathe\OX-DIGITAL-GITHUB`  
**Target Path:** `docs/ui-ux/phase-2/batch-3-accountant/ACCOUNTANT_DATA_DEPENDENCIES.md`  
**Classification:** Technical Data Architecture & Integration Contract  

> [!NOTE] Demonstration Data Policy
> All persona names, student IDs, teacher dues, cashbox balances, voucher numbers, and financial metrics in this document and accompanying prototypes are **SYNTHETIC DEMONSTRATION DATA (DEMO DATA — NOT REAL)**.

---

## 1. Architectural Baseline & State of the Codebase

The Accountant Financial Operations Workspace builds upon three distinct engineering layers within the repository:
1. **Existing Relational Foundation (Prisma Schema):** Models for `Institution`, `Branch` (with `isOnline`), `User`, `StudentProfile`, `TeacherProfile`, `AcademicEnrollment`, `Attendance`, `CourseGroup`, and `Exam`.
2. **In-Memory Accounting Aggregate (`packages/shared/src/accounting`):** Verified domain classes for `Cashbox`, `CashboxMovement`, `CashboxTransferEngine`, `MoneyValue`, and `MovementType` (`COLLECTION`, `DISBURSEMENT`, `TRANSFER_IN`, `TRANSFER_OUT`, `REVERSAL`).
3. **Proposed Persistence Layer (Future Increments):** Persistent database models required to bridge in-memory accounting aggregates to PostgreSQL for receipts, payment schedules, vouchers, and reconciliation dossiers.

---

## 2. Granular Screen-to-Data Mapping (ACC-01 through ACC-09)

### 2.1 Screen ACC-01: Accountant Dashboard

| UI Component | Data Required | Source / Origin | Status in Baseline | Proposed API Endpoint |
| :--- | :--- | :--- | :--- | :--- |
| **Today's Collections KPI** | Sum of collections for branch today | `CashboxMovement` where `type = COLLECTION` & `date = Today` | Domain aggregate exists | `GET /api/v1/accounting/kpi/today-collections?branchId=` |
| **Branch Liquidity KPI** | Sum of physical cash in branch tills | `Cashbox.currentBalance` for branch tills (`CB-01`, `CB-02`) | Domain aggregate exists | `GET /api/v1/accounting/branches/:id/cashbox-summary` |
| **Overdue Dues KPI** | Sum of past-due scheduled payments | `PaymentScheduleItem` where `dueDate < Today` & `remaining > 0` | Proposed Model | `GET /api/v1/accounting/kpi/branch-overdue?branchId=` |
| **Pending Vouchers KPI** | Count and total of submitted vouchers | `ExpenseVoucher` where `status = SUBMITTED_FOR_APPROVAL` | Proposed Model | `GET /api/v1/accounting/expenses/pending-count?branchId=` |
| **Recent Movements Journal** | Last 10 till movements for branch | `CashboxMovement` stream joined with `User` & `Receipt` | Domain aggregate exists | `GET /api/v1/accounting/movements/recent?branchId=&limit=10` |

---

### 2.2 Screen ACC-02: Student Financial Accounts & Sub-Ledger

| UI Component | Data Required | Source / Origin | Status in Baseline | Proposed API Endpoint |
| :--- | :--- | :--- | :--- | :--- |
| **Student Demographics** | Name, code, guardian phone, group | Prisma `User`, `StudentProfile`, `AcademicEnrollment` | **EXISTING** | `GET /api/v1/students/:id` |
| **Tier 1: Agreement** | Agreed price, granted discounts, net | `FinancialAgreement` entity | Proposed Model | `GET /api/v1/accounting/students/:id/agreement` |
| **Tier 2: Payment Schedule**| Due dates, scheduled amounts, remaining | `PaymentScheduleItem` entity | Proposed Model | `GET /api/v1/accounting/students/:id/schedule` |
| **Tier 3: Receipts** | Receipt ID, date, amount, till, method | `CollectionReceipt` and `CashboxMovement` | Domain exists | `GET /api/v1/accounting/students/:id/receipts` |
| **Tier 4: Delivered Service**| Completed lessons, verified attendance | Prisma `Attendance` + approved course allocation plan | **Partial** (`Attendance` exists) | `GET /api/v1/accounting/students/:id/delivery-history` |

---

### 2.3 Screen ACC-03: Collection Workspace & Desk

| UI Component | Data Required | Source / Origin | Status in Baseline | Proposed API Endpoint |
| :--- | :--- | :--- | :--- | :--- |
| **Student Active Obligations**| Unsettled scheduled payments | `PaymentScheduleItem` filtered by student ID | Proposed Model | `GET /api/v1/accounting/students/:id/obligations` |
| **Branch Active Tills** | Permitted branch cashboxes | `Cashbox` filtered by authenticated user's branch | Domain exists | `GET /api/v1/accounting/cashboxes/active?branchId=` |
| **Submit Collection** | Student ID, amount, method, till, allocations | Atomic transaction: updates till, subledger, receipt | Domain exists | `POST /api/v1/accounting/collections/record` |

```json
// Sample Payload: POST /api/v1/accounting/collections/record
{
  "studentId": "STU-8821",
  "agreementId": "CONT-2026-089",
  "cashboxId": "CB-01",
  "amount": 750.00,
  "currency": "EGP",
  "paymentMethod": "CASH",
  "allocations": [
    {
      "scheduleItemId": "SCHED-ITEM-03",
      "allocatedAmount": 750.00
    }
  ],
  "notes": "سداد نقدي جزئي لدفعة نوفمبر من ولي الأمر بالاستقبال"
}
```

---

### 2.4 Screen ACC-04: Receipt Management & Compensating Reversals

| UI Component | Data Required | Source / Origin | Status in Baseline | Proposed API Endpoint |
| :--- | :--- | :--- | :--- | :--- |
| **Receipt Audit Stream** | Receipt metadata, status, reversed flags | `CollectionReceipt` joined with `ReversalEntry` | Proposed Model | `GET /api/v1/accounting/receipts?branchId=&page=&status=` |
| **Compensating Reversal** | Original receipt ID, reason, auditor token | Creates negative `CashboxMovement` + updates subledger | Domain exists | `POST /api/v1/accounting/receipts/:id/reverse` |

```json
// Sample Payload: POST /api/v1/accounting/receipts/REC-9821/reverse
{
  "originalReceiptId": "REC-9821",
  "reversalReason": "خطأ في إدخال اسم الطالب من قبل موظف الاستقبال وتم إعادة التحصيل بالإيصال البديل",
  "makerId": "ACC-01",
  "branchId": "BR-01"
}
```

---

### 2.5 Screen ACC-05: Expense Preparation & Voucher Submission

| UI Component | Data Required | Source / Origin | Status in Baseline | Proposed API Endpoint |
| :--- | :--- | :--- | :--- | :--- |
| **Expense Categories** | Pre-approved cost categories | Institutional chart of cost centers | Proposed Model | `GET /api/v1/accounting/expense-categories?branchId=` |
| **Submit Expense Voucher**| Amount, payee, category, supporting docs | Creates `ExpenseVoucher` with `SUBMITTED_FOR_APPROVAL` | Proposed Model | `POST /api/v1/accounting/expenses/draft` |

---

### 2.6 Screen ACC-06: Cashbox Operations & 5-Stage Intra-Campus Transfers

| UI Component | Data Required | Source / Origin | Status in Baseline | Proposed API Endpoint |
| :--- | :--- | :--- | :--- | :--- |
| **Branch Till Balances** | Balances of `CB-01`, `CB-02` | In-memory `Cashbox.currentBalance` | Domain exists | `GET /api/v1/accounting/branches/:id/cashboxes` |
| **Stage 1: Request Transfer**| Source till, dest vault, amount, reason | Creates `CashboxTransfer` in `PENDING_AUTHORIZATION` | Domain exists | `POST /api/v1/accounting/transfers/request` |
| **Stage 2: Authorize Transfer**| Transfer ID, Primary Manager token | Sets status to `AUTHORIZED` (enables dispatch) | Domain exists | `POST /api/v1/accounting/transfers/:id/authorize` |
| **Stage 3: Cancel / Reject** | Transfer ID, cancellation/rejection reason | Cancels request (Maker) or rejects (PM) | Domain exists | `POST /api/v1/accounting/transfers/:id/cancel` |
| **Stage 4: Dispatch Cash** | Physical custody bag code, dispatch time | Posts `TRANSFER_OUT` debit; sets `IN_TRANSIT` | Domain exists | `POST /api/v1/accounting/transfers/:id/dispatch` |
| **Stage 5: Confirm Receipt** | Verified physical count, receiver token | Posts `TRANSFER_IN` credit; sets `COMPLETED` | Domain exists | `POST /api/v1/accounting/transfers/:id/confirm-receipt` |

```json
// Sample Payload: POST /api/v1/accounting/transfers/request (Stage 1: Maker Request)
{
  "sourceCashboxId": "CB-01",
  "destinationCashboxId": "CB-MAIN",
  "amount": 5000.00,
  "currency": "EGP",
  "purpose": "توريد فائض النقدية للوردية الصباحية إلى الخزينة المركزية بالمقر الرئيسي",
  "makerId": "ACC-01",
  "branchId": "BR-01"
}
```

---

### 2.7 Screen ACC-07: Daily Reconciliation & Blind Count

| UI Component | Data Required | Source / Origin | Status in Baseline | Proposed API Endpoint |
| :--- | :--- | :--- | :--- | :--- |
| **Expected System Balance**| Cumulative ledger balance for till | `Cashbox.currentBalance` at shift cutoff | Domain exists | `GET /api/v1/accounting/cashboxes/:id/expected-balance` |
| **Submit Blind Count** | Denomination breakdown, physical sum | Calculates variance; if non-zero locks `UP-705` dossier | Domain exists | `POST /api/v1/accounting/reconciliations/submit` |

---

### 2.8 Screen ACC-08: Teacher Financial Evidence & Attendance Logs

| UI Component | Data Required | Source / Origin | Status in Baseline | Proposed API Endpoint |
| :--- | :--- | :--- | :--- | :--- |
| **Teacher Course Groups** | Assigned groups, enrolled students | Prisma `CourseGroup`, `TeacherProfile`, `User` | **EXISTING** | `GET /api/v1/courses/teacher/:id/groups` |
| **Delivered Lessons** | Class attendance sheets, certified delivery logs | Prisma `Attendance` joined with lesson syllabus | **EXISTING** | `GET /api/v1/attendance/lessons?groupId=` |
| **Upload Evidence** | Scan files, attendance sheets | Document storage repository | Proposed Model | `POST /api/v1/accounting/teachers/:id/evidence` |

---

### 2.9 Screen ACC-09: Accountant Operational Reports

| UI Component | Data Required | Source / Origin | Status in Baseline | Proposed API Endpoint |
| :--- | :--- | :--- | :--- | :--- |
| **Daily Collections Report**| Chronological collection receipts | Aggregated `CollectionReceipt` table | Proposed Model | `GET /api/v1/accounting/reports/daily-collections?branchId=&date=` |
| **Dues Aging Report** | Student overdue dues by aging bucket | `PaymentScheduleItem` grouped by (<30, 30-60, >60 days) | Proposed Model | `GET /api/v1/accounting/reports/dues-aging?branchId=` |
| **Cashbox Movement Journal**| Complete audit feed of till movements | `CashboxMovement` journal | Domain exists | `GET /api/v1/accounting/reports/cashbox-journal?branchId=` |

