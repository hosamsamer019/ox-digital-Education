# OX-DIGITAL Education — UI/UX Phase 2 (Batch 3)
# Document 6: Accountant Workspace Design Decisions, Assumptions & Governance Log
**Document ID:** `BATCH_3_DESIGN_DECISIONS`  
**Status:** COMPLETE & AUTHORITATIVE — READY FOR PRODUCT OWNER REVIEW  
**Date:** 2026-11-04  
**Workspace:** `D:\OX-DIGITAL\Mathe\OX-DIGITAL-GITHUB`  
**Target Path:** `docs/ui-ux/phase-2/batch-3-accountant/BATCH_3_DESIGN_DECISIONS.md`  
**Classification:** Product Owner Governance Register & Decision Log  

> [!NOTE] Demonstration Data Policy
> All persona names, student IDs, teacher dues, cashbox balances, voucher numbers, and financial metrics in this document and accompanying prototypes are **SYNTHETIC DEMONSTRATION DATA (DEMO DATA — NOT REAL)**.

---

## 1. Executive Summary & Authoritative Directives

This document records the formal design decisions, architectural boundaries, and policy protections established for **UI/UX Phase 2 — Batch 3 (Accountant Dashboard & Financial Operations Workspace)**. It maintains strict continuity with Phase 1 architecture, Batch 1 App Shell, and Batch 2 Primary Manager Dashboard.

---

## 2. Formal Design Decisions Log

### Decision D-17: Maker-Only Functional Scope for Accountants (`OD-702`)
- **Context:** Segregation of duties is mandatory under institutional accounting governance.
- **Decision:** The Accountant operates strictly as a **Maker**. All financial vouchers, adjustment requests, and till discrepancy reports are drafted by the Accountant and dispatched to the Primary Manager (Checker) for authorization. The Accountant interface contains zero self-approval buttons.
- **Protection:** Eliminates single-operator embezzlement risk and unauthorized cashbox disbursements.

---

### Decision D-18: Non-Destructive Accounting Immutability & Reversal Protocol
- **Context:** Financial audits require an unbroken chronological chain of evidence.
- **Decision:** Posted receipts, till movements, and vouchers can **never be edited or deleted** in place. To correct an erroneous receipt, the Accountant executes an append-only compensating reversal (`REVERSAL`), which creates a negative till movement, restores the student sub-ledger due, and records an immutable pointer to the original transaction.
- **Protection:** Prevents silent audit tampering or retroactive balance manipulation.

---

### Decision D-19: Explicit Allocation Enforcement in Student Collections
- **Context:** Automatic allocation (FIFO) can misapply funds when parents intend to settle specific educational modules or past-due blocks.
- **Decision:** The Collection Workspace (`ACC-COLL-01`) mandates that the Accountant explicitly select target scheduled payment(s). If unallocated funds remain, they are held in `UNALLOCATED_CUSTOMER_DEPOSIT` suspense. Collections do not automatically alter academic eligibility or reactivate course access.
- **Protection:** Eliminates disputes over tuition allocation and separates financial collection from academic access control.

---

### Decision D-20: Flexible Supporting Documentation for Expense Vouchers
- **Context:** Center operating expenses in Egypt involve diverse vendor documents (commercial invoices, cash memos, delivery receipts, technical inspection certificates).
- **Decision:** The Expense Preparation desk (`ACC-EXP-01`) accepts flexible supporting document formats without imposing statutory electronic tax invoice requirements. Statutory Egyptian VAT, withholding tax deductions, and tax return screens are 100% excluded.
- **Protection:** Prevents over-engineering statutory tax capabilities outside the authorized accounting foundation.

---

### Decision D-21: Fail-Closed Protection for Unresolved Architectural Policies
- **Context:** Core policy areas (`UP-701`, `UP-704`, `UP-705`, `UP-706`, `UP-710`, `UP-711`) remain open pending executive resolution.
- **Decision:** The Accountant interface treats all unresolved policies as fail-closed:
  - **`UP-704` (Teacher Pay):** Compiles verified lesson delivery evidence and attendance counts only. Financial settlement formulas are locked in `في انتظار اعتماد لائحة الأجور الرسمية`.
  - **`UP-705` (Cashbox Discrepancies):** Daily cash variances are locked in neutral `قيد التحقيق والمراجعة الإدارية`. Zero automated write-offs, zero employee liability deductions, zero surplus absorption, and zero balancing journal entries.
  - **`UP-706` (Refunds):** Refund requests are held in administrative/legal review.
  - **`UP-701` (COA):** Operational cost categories are used; statutory chart of accounts is deferred.
- **Protection:** Prevents inventing speculative business logic that could pre-empt executive decisions.

---

### Decision D-22: Physical-Centers-First Accounting Scope (Online Deferred)
- **Context:** The active accounting baseline is restricted strictly to physical educational centers (`فرع الدقي`, `فرع مدينة نصر`).
- **Decision:** Digital platform subscriptions, recurring billing, payment-gateway collections (Fawry/Paymob), and digital revenue recognition are deferred. The digital branch (`BR-ONLINE`, `Branch.isOnline: true`) is displayed with a status of `مؤجل — خارج النطاق المالي الحالي` with zero active financial movements.
- **Protection:** Eliminates gateway settlement complexities from frontline physical campus till reconciliation.

---

### Decision D-23: Strict Educational Payment Terminology
- **Context:** Commercial financing terminology like `قسط` and `الأقساط` carries consumer lending connotations inappropriate for Egyptian educational centers.
- **Decision:** Customer-facing language is strictly standardized:
  - `جدول استحقاق الدفعات والمواعيد` (Educational Payment Schedule & Due Dates)
  - `مسمى الدفعة` (Payment Descriptor)
  - `الدفعة المستحقة` (Amount Due)
  - `المبالغ المتأخرة` (Overdue Balances)
  - `المتبقي للسداد` (Remaining Balance to Pay)
  - Prohibited: `قسط`, `الأقساط`, `أقساط الطلاب`.
- **Protection:** Standardizes professional educational billing terminology.

---

### Decision D-24: Retention of Cashier Domain Role without Independent UI Shell
- **Context:** Clarifying the architectural boundary between the accounting-domain role and the user interface navigation structure.
- **Decision:** Exactly four accounting-domain roles exist: `PRIMARY_MANAGER`, `ACCOUNTANT`, `CASHIER`, and `TEACHER`. The Cashier role remains an active, distinct accounting-domain role. No independent Cashier Dashboard or Cashier navigation shell is included in the current UI/UX architecture. Cashier capabilities (frontline cash intake at physical till stations) are **not** implicitly granted to the Accountant. The Accountant workspace and permissions remain separately defined for the `ACCOUNTANT` role (supervising branch finances, allocating collections to payment schedules, drafting expense vouchers, auditing daily reconciliations, and generating operational reports).
- **Protection:** Prevents role conflation and privilege leakage while maintaining a focused, non-fragmented application shell.

---

### Decision D-25: Five-Stage Cashbox Transfer Authorization Lifecycle
- **Context:** Moving physical cash between cashboxes (e.g. branch till to central vault) requires rigorous custody transition tracking and authorization control.
- **Decision:** Cashbox transfers strictly adhere to a 5-stage lifecycle:
  1. **Transfer Preparation / Request:** Accountant (Maker) drafts request specifying source, destination, amount, and purpose. Status is `PENDING_AUTHORIZATION`.
  2. **Review & Approval Gate:** Primary Manager — المدير الرئيسي (Checker) solely evaluates and authorizes the transfer (`AUTHORIZED`). No automated approvals or subordinate thresholds exist.
  3. **Rejection or Cancellation Handling:** Maker can cancel unapproved drafts (`CANCELLED`); Checker can reject with recorded reason (`REJECTED`).
  4. **Physical Dispatch Execution:** Custodian dispatches cash envelope; system posts an append-only debit (`MovementType: TRANSFER_OUT`); status becomes `IN_TRANSIT`.
  5. **Physical Receipt & Acceptance Confirmation:** Destination custodian verifies physical cash count and confirms receipt; system posts an append-only credit (`MovementType: TRANSFER_IN`); status completes (`TRANSFER_COMPLETED`).
- **Protection:** Guarantees atomic two-sided accounting, prevents unauthorized intra-institution fund shifts, and strictly maintains the conservation law of institutional liquidity across the four approved cashboxes (86,400.00 EGP: CB-01 24,500 + CB-02 13,900 + CB-MAIN 30,000 + CB-03 18,000 EGP).

---

## 3. Summary of Assumptions Explicitly Avoided

| Architectural Area | Speculative Assumption Avoided | Authoritative Treatment Applied |
| :--- | :--- | :--- |
| **Maker-Checker** | "Allow Accountant to approve small expense vouchers under 1,000 EGP." | **Rejected.** Sole Primary Manager Checker authority for all expenditures (`OD-702`). |
| **Cash Differences**| "Automatically deduct cashbox shortage from cashier's monthly salary." | **Rejected.** Discrepancies locked in neutral investigation; zero liability shift (`UP-705`). |
| **Tuition Booking** | "Recognize 100% of course agreement as revenue upon enrollment." | **Rejected.** Revenue recognized derived strictly from approved immutable allocation plan & certified attendance. |
| **Teacher Dues** | "Assume a default 50% teacher share or 200 EGP/hour fee." | **Rejected.** Document verified delivery evidence only; dues calculation locked (`UP-704`). |
| **Teacher Evidence**| "Introduce biometric logs, fingerprint scans, or new biometric hardware."| **Rejected.** Approved attendance records and certified lesson delivery evidence only. |
| **Tax Functions** | "Deduct 1% withholding tax and add 14% VAT to expense vouchers." | **Rejected.** Tax functionality is explicitly outside the authorized scope. |
| **Revenue Forecast**| "Display a predictive collection curve for the upcoming academic semester."| **Rejected.** Strictly audited historical facts only; no predictive forecasting. |
| **Online Billing** | "Integrate active Fawry and Paymob settlements into current branch liquidity."| **Rejected.** Physical centers first; online billing explicitly deferred (D-22). |
| **Cashier Role**   | "Merge Cashier role into Accountant or implicitly grant Cashier permissions." | **Rejected.** Cashier remains a distinct domain role; Accountant workspace permissions are separately defined (D-24). |
| **Transfer Approval**| "Auto-approve cashbox transfers under a certain threshold or allow self-transfer." | **Rejected.** All transfers require explicit Primary Manager authorization and follow the 5-stage lifecycle (D-25). |

---

## 4. Status of Open Architectural Policies

| Policy ID | Domain Area | Status | Treatment in Batch 3 Deliverables |
| :--- | :--- | :---: | :--- |
| **`UP-701`** | Statutory Chart of Accounts Review | **OPEN** | Operational cost centers used; statutory COA not applied. |
| **`UP-704`** | Teacher Compensation Qualifying Base | **OPEN** | Fail-closed: Displays verified lesson evidence; settlement locked. |
| **`UP-705`** | Cashbox Discrepancy Sign-Off & Tolerances | **OPEN** | Fail-closed: Discrepancies locked in neutral review; no auto write-off, no liability shifts. |
| **`UP-706`** | Student Refund Formula & Legal Review | **OPEN** | Fail-closed: Refund requests placed in legal/administrative review. |
| **`UP-710`** | Financial Period Close & Reopening Controls| **OPEN** | Daily reconciliations do not permanently lock historical records without override. |
| **`UP-711`** | Opening Balances & Legacy Migration | **OPEN** | Opening balances treated as verified baselines without auto-restatement. |

