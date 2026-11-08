# OX-DIGITAL Education — UI/UX Phase 2 (Batch 4)
# Document 6: Student Financial Profile Design Decisions, Assumptions & Governance Log
**Document ID:** `BATCH_4_DESIGN_DECISIONS`  
**Status:** COMPLETE & AUTHORITATIVE — READY FOR PRODUCT OWNER REVIEW  
**Date:** 2026-11-04  
**Workspace:** `D:\OX-DIGITAL\Mathe\OX-DIGITAL-GITHUB`  
**Target Path:** `docs/ui-ux/phase-2/batch-4-student-financial-profile/BATCH_4_DESIGN_DECISIONS.md`  
**Classification:** Product Owner Governance Register & Decision Log  

> [!NOTE] Demonstration Data Policy
> All persona names, student IDs, voucher numbers, and financial metrics in this document and accompanying prototypes are **SYNTHETIC DEMONSTRATION DATA (DEMO DATA — NOT REAL)**.

---

## 1. Executive Summary & Authoritative Directives

This document records the formal design decisions, architectural boundaries, and policy protections established for **UI/UX Phase 2 — Batch 4 (Student Financial Profile — Design & Specification)**. It maintains strict continuity with Phase 1 architecture, Batch 1 App Shell, Batch 2 Primary Manager Dashboard, and Batch 3 Accountant Workspace.

---

## 2. Formal Design Decisions Log

### Decision D-26: The Four-Tier Revenue Separation Invariant & Dual Recognition Prerequisites
- **Context:** Educational centers frequently conflate signed tuition agreements, collected cash, and earned revenue.
- **Decision:** The Student Financial Profile strictly enforces four independent financial tiers:
  $$\text{عقد اتفاق مالي (Agreement)} \neq \text{دفعة مجدولة مستحقة (Amount Due)} \neq \text{تحصيل نقدي بالخزينة (Collection)} \neq \text{إيراد تعليمي معترف به (Revenue)}$$
  Furthermore, recognizing educational revenue strictly requires BOTH:
  1. Certified `LessonDeliveryEvidence` for the relevant student and delivered lessons (e.g. `#LDE-PHY-01`, `#LDE-PHY-02`).
  2. The approved immutable allocation plan linked to the relevant agreement and recognition records (e.g. `PLAN-PHY-T1`).
  Attendance sheets alone cannot book revenue. Recognitions (Entries #101 and #108 at 450.00 EGP each, total 900.00 EGP) are confirmed against these dual criteria (2 units × 225.00 EGP each), while uncertified units (Lesson 5 / `#LDE-PHY-03`) remain unrecognized at 0.00 EGP.
- **Protection:** Prevents fraudulent premature revenue recognition and protects student unearned deposits.

---

### Decision D-27: Non-Coupling of Academic Access and Financial Operations
- **Context:** Educational platforms often tie digital LMS access or attendance eligibility directly to payment status.
- **Decision:** Settling an obligation in the cashbox does **not** automatically grant academic course permissions or lift suspensions. Academic eligibility is evaluated independently by academic prerequisites and administration. Conversely, academic suspension does not erase contracted financial obligations.
- **Protection:** Maintains clean domain separation between academic administration and financial operations.

---

### Decision D-28: Non-Destructive Accounting Immutability & Compensating Reversals
- **Context:** Correcting an error on an invoice or receipt in commercial tools often involves editing or deleting records.
- **Decision:** Posted agreements, receipts, payment schedule items, and allocations are **strictly immutable**. Corrections execute exclusively through append-only compensating entries (`REVERSAL`), preserving the original transaction and maintaining an unbroken audit trail.
- **Protection:** Guarantees forensic auditability and prevents retroactive record tampering.

---

### Decision D-29: Mandatory Explicit Target Allocation & Advance Suspense Isolation
- **Context:** Automated FIFO allocation often misapplies payments when parents intend to settle specific educational blocks.
- **Decision:** Every collection receipt requires explicit target allocation to specific scheduled payment milestones. Automated FIFO allocation is prohibited. Any surplus is held in customer advance suspense (`رصيد دفعات مقدمة غير مخصصة`).
- **Protection:** Eliminates parent disputes and guarantees mathematical conservation:
  $$\text{Total Allocated} + \text{Unallocated Advance} = \text{Total Collected}$$

---

### Decision D-30: Survival of Financial Records Across Academic Transfers & Withdrawals
- **Context:** When a student transfers between branches (e.g. Dokki to Nasr City) or withdraws, legacy systems frequently overwrite or orphan past billing records.
- **Decision:** All historical financial records (signed agreements, receipts, till points, allocations, recognized revenue) survive student transfers or withdrawals completely intact, maintaining original branch and cashbox metadata.
- **Protection:** Preserves institutional financial history and branch accountability.

---

### Decision D-31: Strict Educational Billing Terminology
- **Context:** Commercial consumer financing terms like `قسط` and `الأقساط` carry lending connotations inappropriate for educational centers in Egypt.
- **Decision:** Customer-facing language is strictly standardized:
  - Approved: `الاتفاق المالي`, `جدول السداد`, `جدول الدفعات`, `مسمى الدفعة`, `المبلغ المستحق`, `المبلغ المحصل`, `المتبقي للسداد`, `المبالغ المتأخرة`.
  - Prohibited: `قسط`, `الأقساط`, `أقساط الطلاب`, `installment`, `installments`.
- **Protection:** Ensures professional educational branding and legal compliance.

---

### Decision D-32: Retention of Cashier Domain Role without Profile UI Shell
- **Context:** Cashiers operate physical cashboxes but must not access unrestricted financial profiles.
- **Decision:** Cashier remains an active, distinct domain role. No independent profile shell or dashboard is designed for Cashiers. Cashiers operate frontline till collection points. Accountant does **not** inherit Cashier permissions, and Cashier does **not** inherit Accountant permissions.
- **Protection:** Prevents role conflation and protects sensitive student financial records from unauthorized frontline viewing.

---

### Decision D-33: Fail-Closed Protection for Open Policies
- **Context:** Critical institutional policies (`UP-701`, `UP-704`, `UP-705`, `UP-706`, `UP-710`, `UP-711`) remain open pending executive resolution.
- **Decision:** The Student Financial Profile treats all unresolved policies as fail-closed:
  - **`UP-706` (Refunds):** Refund requests are held in `قيد المراجعة الإدارية والقانونية`. Zero automated refund calculations or penalty formulas.
  - **`UP-704` (Teacher Pay):** Zero speculative teacher shares calculated from student tuition collections.
  - **`UP-701` (COA):** Operational cost categories are used without exposing provisional statutory accounts.
  - **`UP-705` (Cashbox Discrepancies):** Daily cash variances are locked in neutral investigation; zero student sub-ledger write-offs.
  - **`UP-711` (Opening Balances & Legacy Migration):** UP-711 remains OPEN. Historical balances are pending verification; legacy payment records are subject to source-document reconciliation; opening balances are not approved until the future migration policy is decided; unverified historical values must not be included in confirmed collection or revenue KPIs.
- **Protection:** Prevents pre-empting executive and legal board resolutions.

---

## 3. Summary of Assumptions Explicitly Avoided

| Architectural Area | Speculative Assumption Avoided | Authoritative Treatment Applied |
| :--- | :--- | :--- |
| **Payment Allocation**| "Automatically apply collected cash to oldest due date using FIFO." | **Rejected.** Explicit target allocation is mandatory; surplus held in suspense (D-29). |
| **Revenue Recognition**| "Recognize revenue based on attendance sheets alone or before delivery." | **Rejected.** Dual prerequisites strictly enforced: (1) certified LessonDeliveryEvidence + (2) approved immutable allocation plan (PLAN-PHY-T1) (D-26). |
| **Refund Formula** | "Calculate pro-rata refund minus 10% administrative cancellation fee." | **Rejected.** UP-706 remains open; locked in neutral legal review (D-33). |
| **Teacher Pay** | "Deduct 50% teacher share from student's paid tuition receipt." | **Rejected.** UP-704 remains open; teacher pay is decoupled from student collections. |
| **Attendance Logs** | "Introduce biometric scans, fingerprint logs, or hardware integration." | **Rejected.** Approved attendance sheets and certified delivery evidence only. |
| **Installment Terms** | "Label payment schedule milestones as 'أقساط' or 'القسط الأول'." | **Rejected.** Prohibited; mandatory educational terms used exclusively (D-31). |
| **Role Inheritance** | "Model Accountant as inheriting Cashier role or vice versa." | **Rejected.** Four independent roles with zero inheritance and distinct permissions (D-32). |
| **Academic Couplings**| "Automatically reactivate suspended student upon cash receipt intake." | **Rejected.** Financial settlement is decoupled from academic eligibility (D-27). |
| **Legacy Balances** | "Treat legacy payments or opening balances as automatically verified historical baselines." | **Rejected.** UP-711 remains OPEN; historical balances are pending source verification and reconciliation. |

---

## 4. Status of Open Architectural Policies

| Policy ID | Domain Area | Status | Treatment in Batch 4 Deliverables |
| :--- | :--- | :---: | :--- |
| **`UP-701`** | Statutory Chart of Accounts Review | **OPEN** | Operational milestones used; provisional statutory accounts deferred. |
| **`UP-704`** | Teacher Compensation Qualifying Base | **OPEN** | Fail-closed: Teacher pay decoupled from student collections. |
| **`UP-705`** | Cashbox Discrepancy Sign-Off & Tolerances | **OPEN** | Fail-closed: Daily till differences do not alter student balances. |
| **`UP-706`** | Student Refund Formula & Legal Review | **OPEN** | Fail-closed: Refund requests placed in legal/administrative review. |
| **`UP-710`** | Financial Period Close & Reopening Controls| **OPEN** | Student profile displays historical periods without irreversible locking. |
| **`UP-711`** | Opening Balances & Legacy Migration | **OPEN** | Neutral status: Historical balances pending verification; legacy payment records subject to source reconciliation; opening balances not approved until migration policy is decided; unverified historical values excluded from confirmed collection/revenue KPIs. |

