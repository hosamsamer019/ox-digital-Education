# OX-DIGITAL Education — UI/UX Phase 2 (Batch 4)
# Document 1: Student Financial Profile Specification
**Document ID:** `STUDENT_FINANCIAL_PROFILE_SPEC`  
**Status:** COMPLETE & AUTHORITATIVE — READY FOR PRODUCT OWNER REVIEW  
**Date:** 2026-11-04  
**Workspace:** `D:\OX-DIGITAL\Mathe\OX-DIGITAL-GITHUB`  
**Target Path:** `docs/ui-ux/phase-2/batch-4-student-financial-profile/STUDENT_FINANCIAL_PROFILE_SPEC.md`  
**Classification:** Financial Sub-Ledger Systems Architecture & Student Experience Specification  

> [!NOTE] Demonstration Data Policy
> All persona names, student codes, course IDs, cashbox balances, voucher numbers, and financial metrics in this document and accompanying prototypes are **SYNTHETIC DEMONSTRATION DATA (DEMO DATA — NOT REAL)**.

---

## 1. Mission & Architectural Philosophy

The **Student Financial Profile** serves as the authoritative, unified financial sub-ledger for an enrolled student within OX-DIGITAL Education. It provides a complete, 360-degree view of the student's contractual agreements, scheduled payment obligations, cash collections, explicit payment allocations, recognized educational revenue, adjustment requests, and historical audit trail.

Unlike standard billing portals or commercial invoice trackers, the Student Financial Profile is an institutional education ledger engineered to satisfy the rigorous accounting principles of Phase 2.0B:

1. **The Four-Tier Financial Separation:**
   $$\text{عقد اتفاق مالي (Agreement)} \neq \text{دفعة مجدولة مستحقة (Amount Due)} \neq \text{تحصيل نقدي بالخزينة (Collection)} \neq \text{إيراد تعليمي معترف به (Revenue)}$$
   - **Tier 1 (Agreement):** Contractual commitment; creates zero ledger debt and recognizes zero revenue.
   - **Tier 2 (Amount Due):** Arrival of scheduled due dates creates an enforceable claim on the student sub-ledger, but does not book income.
   - **Tier 3 (Collection):** Physical cash deposited into the branch cashbox till (`MovementType: COLLECTION`) increases center cash liquidity and creates an unearned customer deposit/advance liability.
   - **Tier 4 (Recognized Revenue):** Earned educational income is booked **exclusively** upon completion of certified lesson delivery verified against the **approved immutable allocation plan**.

2. **Decoupling of Academic Access from Financial Settlement:**
   - Settling a payment at the cashbox does **not** automatically grant course permissions, lift academic suspensions, or reactivate access.
   - Academic eligibility is governed independently by course prerequisites, group capacity, and academic administration.

3. **Strict Accounting Immutability & Append-Only Reversals:**
   - No posted financial agreement, scheduled payment, collection receipt, allocation link, or revenue recognition entry can be edited or deleted.
   - All adjustments and error corrections execute exclusively via append-only compensating entries (`REVERSAL`).

4. **Persistence Across Academic Lifecycle Transitions:**
   - If a student transfers branches (e.g. from `فرع الدقي` to `فرع مدينة نصر`), changes course groups, or withdraws from the institution, the complete historical financial record remains unbroken. Old receipts and allocations retain their original branch and cashbox metadata without rewriting historical facts.

5. **Conservation Laws of Financial Allocation:**
   $$\sum \text{Allocated Amounts} + \sum \text{Unallocated Advance Collections} = \sum \text{Collections Received}$$
   $$\sum \text{Allocated Amounts} + \sum \text{Remaining Due Balances} = \sum \text{Total Obligations Due}$$
   - The system strictly prohibits automated, unconfirmed FIFO allocation. All cash collections require explicit allocation targets. Any unallocated surplus is isolated in customer advance suspense (`رصيد دفعات مقدمة غير مخصصة`).
   - **Baseline Synthetic Reconciliation (Omar Sharif — STU-8821):**
     * **Total Agreed Net Amount:** `5,500.00 EGP`
     * **Total Obligations Due:** `5,500.00 EGP` (contracted sum of all schedule items)
     * **Amount Currently Due (Matured):** `2,750.00 EGP` (items 1, 2, and 3 matured to date)
     * **Amount Overdue:** `1,000.00 EGP` (250 EGP remaining on item 2 + 750 EGP on item 3)
     * **Total Collected:** `2,000.00 EGP` (physical cash deposited in till)
     * **Total Allocated:** `1,750.00 EGP` (1,000 EGP to item 1 + 750 EGP to item 2)
     * **Unallocated Advance:** `250.00 EGP` (held in customer advance suspense)
     * **Total Remaining Due:** `3,750.00 EGP` (contractual balance: $5,500 - 1,750$)
     * *Conservation Verification 1:* $1,750\text{ (Allocated)} + 250\text{ (Advance)} = 2,000.00\text{ EGP (Collections)}$ ✔️
     * *Conservation Verification 2:* $1,750\text{ (Allocated)} + 3,750\text{ (Remaining Due)} = 5,500.00\text{ EGP (Total Obligations Due)}$ ✔️

6. **Strict Educational Terminology Standards:**
   - Complete prohibition of consumer financing installment terminology (`قسط`, `الأقساط`, `أقساط الطلاب`, `installment`, `installments`).
   - Mandatory approved terminology: `الاتفاق المالي`, `جدول السداد`, `جدول الدفعات`, `مسمى الدفعة`, `المبلغ المستحق`, `المبلغ المحصل`, `المتبقي للسداد`, `المبالغ المتأخرة`.

7. **Four Independent Accounting-Domain Roles:**
   - Operates across four distinct, non-inheriting roles: `PRIMARY_MANAGER` (Checker), `ACCOUNTANT` (Maker), `CASHIER` (Frontline Till Custodian), and `TEACHER` (Instructor).
   - Zero inheritance (`<|--`). Zero implicit permission bleed between Accountant and Cashier.

8. **Historical Balances & Legacy Records Policy (`UP-711` Neutral Status):**
   - Policy `UP-711` remains unresolved. Historical balances from previous systems remain **pending verification**.
   - Legacy payment records are subject to source-document reconciliation.
   - Opening balances are **not approved** until the future data migration and reconciliation policy is formally ratified.
   - Unverified historical values must **not** be included in confirmed collection or revenue KPIs.

---

## 2. Core Profile Structure (Areas A through J)

The Student Financial Profile is organized into ten distinct, logically cohesive functional areas:

```text
+-----------------------------------------------------------------------------------------------------------------------------+
| STUDENT FINANCIAL PROFILE MASTER CANVAS                                                                                     |
+-----------------------------------------------------------------------------------------------------------------------------+
| AREA A: STUDENT IDENTITY & ACADEMIC CONTEXT (Header Bar & Status Badges)                                                    |
| Name, Code, Grade, Enrolled Group, Academic Status [ACTIVE], Financial Status [DUE_BALANCE], Campus Context [فرع الدقي]     |
+-----------------------------------------------------------------------------------------------------------------------------+
| AREA B: FINANCIAL SUMMARY KPI METRIC BAR                                                                                    |
| [إجمالي الاتفاق الصافي] | [إجمالي المستحق للآن] | [إجمالي المحصل] | [المتبقي للسداد] | [دفعات مقدمة غير مخصصة] | [إيراد معترف به] |
+-----------------------------------------------------------------------------------------------------------------------------+
| NAVIGATION TABS:                                                                                                            |
| [1. الاتفاق وجدول الدفعات] [2. جدول الاستحقاقات] [3. سجل المقبوضات] [4. مصفوفة التخصيص] [5. سجل الاعتراف بالإيراد]            |
| [6. التسويات ورد المبالغ] [7. التحويلات والانسحاب] [8. المستندات وسجل التدقيق]                                              |
+-----------------------------------------------------------------------------------------------------------------------------+
| ACTIVE TAB WORKSPACE CONTAINER (max-w-[1600px] Responsive Viewport)                                                         |
+-----------------------------------------------------------------------------------------------------------------------------+
```

### Area A: Student Identity & Academic Context
- **Student Full Name:** Displays official legal student name (e.g. `عمر شريف فاروق`).
- **Student Code / National ID:** Unique institutional identifier (e.g. `STU-8821`).
- **Institutional Branch:** Authenticated campus assignment (e.g. `فرع الدقي - حضوري`).
- **Academic Enrollment:** Course Group (e.g. `مجموعة المتفوقين - فيزياء ثانوية عامة`), Instructor (e.g. `أ. محمد إبراهيم`).
- **Dual Status Architecture (Strict Decoupling):**
  - **Academic Status:** `نشط (ACTIVE)`, `محول (TRANSFERRED)`, `منسحب (WITHDRAWN)`, `معلق أكاديمياً (ACADEMICALLY_SUSPENDED)`.
  - **Financial Status:** `خالص السداد (SETTLED)`, `دفعات جارية (CURRENT_DUE)`, `دفعات متأخرة (OVERDUE)`, `رصيد دائن/مقدم (CREDIT_BALANCE)`.
- *Guardrail:* Changes to academic status do not alter financial sub-ledger history, and financial settlement does not overwrite academic administrative holds.

### Area B: Financial Summary & KPI Formulas
The financial summary presents seven mathematically isolated metric tiles:

| Metric Name | Arabic Display Title | Underlying Source Calculation | Business Interpretation |
| :--- | :--- | :--- | :--- |
| **Total Agreed Net** | إجمالي الاتفاق المالي الصافي | $\text{AgreedGross} - \text{AuthorizedDiscounts}$ | Total contracted educational price for active agreements. |
| **Total Amount Due** | إجمالي المبالغ المستحقة للآن | $\sum \text{ScheduleItem.amount}$ where $\text{dueDate} \le \text{Today}$ | Total scheduled obligations that have matured up to today. |
| **Total Collected** | إجمالي المبالغ المحصلة | $\sum \text{Receipt.amount} - \sum \text{Reversal.amount}$ | Total physical net cash received at branch cashboxes. |
| **Total Remaining Due** | إجمالي المتبقي للسداد | $\text{TotalAgreedNet} - \text{TotalAllocatedCollections}$ | Outstanding contracted balance awaiting payment. |
| **Unallocated Advance** | رصيد الدفعات المقدمة | $\text{TotalCollected} - \text{TotalAllocatedCollections}$ | Cash held in unearned suspense without assigned schedule targets. |
| **Recognized Revenue** | الإيراد التعليمي المعترف به | $\sum \text{RevenueRecognitionEntry.recognizedAmount}$ | Earned income validated by dual criteria: certified lesson delivery evidence (`LessonDeliveryEvidence`) AND approved immutable allocation plan (`PLAN-PHY-T1`). |
| **Overdue Balances** | إجمالي المبالغ المتأخرة | $\sum (\text{ScheduleItem.amount} - \text{Allocated})$ where $\text{dueDate} < \text{Today}$ | Past-due obligations exceeding contractual due dates. |

### Area C: Financial Agreement & Schedule (`SFP-AGREE-01`)
- **Agreement Metadata:** Agreement Reference (`#AGR-2026-0881`), Creation Date, Effective Academic Term (`خريف 2026`), Pricing Scheme applied.
- **Financial Breakdown:**
  - Original List Price: e.g. `6,000.00 ج.م`
  - Approved Institutional Discount: e.g. `-500.00 ج.م` (خصم تفوق أكاديمي معتمد)
  - Net Contracted Tuition: `5,500.00 ج.م`
- **Schedule Structure:** Defined milestones with sequence number, due date, payment descriptor (`مسمى الدفعة`), and targeted amount.
- **Price Protection Rule:** Existing individual agreements remain completely immutable and do **not** automatically update when institutional course catalog prices change.

### Area D: Due Amounts & Obligations Register (`SFP-DUES-01`)
- Displays all payment schedule items in chronological maturity order:
  - Item ID (`SCH-01`, `SCH-02`, etc.)
  - Payment Descriptor (`دفعة الحجز والتسجيل`, `دفعة شهر أكتوبر 2026`, `دفعة شهر نوفمبر 2026`, إلخ)
  - Scheduled Due Date (`تاريخ الاستحقاق`)
  - Targeted Obligation Amount (`قيمة الدفعة المستحقة`)
  - Paid/Allocated Amount (`المبلغ المسدد/المخصص`)
  - Remaining Due Balance (`المتبقي من الدفعة`)
  - Temporal Status: `غير مستحقة بعد (UPCOMING)`, `مستحقة حالية (CURRENT_DUE)`, `متأخرة واجبة السداد (OVERDUE)`, `مسددة بالكامل (FULLY_PAID)`, `مسددة جزئياً (PARTIALLY_PAID)`.
- *Guardrail:* Unallocated collections are **never** silently consumed to offset obligations without explicit user allocation.

### Area E: Collection History & Receipt Audit Register (`SFP-COLL-01`)
- Detailed chronological log of every collection receipt issued for the student:
  - Official Receipt Number (`#REC-9821`)
  - Manual Receipt Voucher Reference (`رقم الإيصال الدفتري اليدوي`)
  - Timestamp and Date of Cash Intake
  - Payment Method: `نقدي بالخزينة (CASH)`
  - Branch & Cashbox Identifier: e.g. `فرع الدقي` • `خزينة الاستقبال 1 (CB-01)`
  - Recording User: e.g. `محمود حسن (كاشير الخزينة)` / `أحمد سمير (محاسب الفرع)`
  - Net Collected Amount in Egyptian Pounds ($EGP$)
  - Allocation Status: `مخصص بالكامل (FULLY_ALLOCATED)`, `مخصص جزئياً (PARTIALLY_ALLOCATED)`, `دفعة مقدمة غير مخصصة (UNALLOCATED_SUSPENSE)`
  - Reversal Reference: If compensated, displays prominent red tag `ملغى بقيد تعويضي` linked to `#REV-XXXX`.

### Area F: Allocation Matrix & Advance Deposits (`SFP-ALLOC-01`)
- Bridges physical receipts (Area E) to contractual obligations (Area D).
- Explicit Mapping:
  $$\text{Receipt \#REC-9821} \xrightarrow{\text{Allocation \#AL-104}} \text{Schedule Item SCH-01 (750.00 ج.م)}$$
- Advance Deposit Balance Tracker: Displays unallocated surplus funds sitting in customer advance suspense. Includes an action drawer `[تخصيص رصيد مقدم لدفعات مستحقة]` requiring explicit Accountant confirmation.

### Area G: Revenue Recognition & Delivery Timeline (`SFP-REV-01`)
- Strict compliance with four-tier accounting: Shows only revenues where BOTH certified educational delivery evidence has occurred AND an approved immutable allocation plan is linked.
- Dual-Evidence Validation Rule:
  1. Certified `LessonDeliveryEvidence` record for the relevant student and delivered lessons (e.g. `#LDE-PHY-01`, `#LDE-PHY-02`).
  2. Approved immutable allocation plan linked to the relevant agreement and recognition records (e.g. `PLAN-PHY-T1`).
- Attendance sheets alone do **not** constitute recognized revenue without certified lesson-delivery evidence and an approved immutable allocation plan.
- Fields per recognition record:
  - Recognition ID: e.g. `RevenueRecognitionEntry #101`, `#108`
  - Course Group & Instructor: `أ. محمد إبراهيم خليل (فيزياء 3 ث)`
  - Delivered Units / Lessons: `الحصص 1 و 2` (450.00 ج.م), `الحصص 3 و 4` (450.00 ج.م)
  - Certified Lesson Delivery Evidence: `[📄 دليل_تسليم_حصة_معتمد_LDE-PHY-01.pdf]` / `[📄 دليل_تسليم_حصة_معتمد_LDE-PHY-02.pdf]`
  - Approved Immutable Allocation Plan Reference: `PLAN-PHY-T1` (2 units × 225.00 ج.م = 450.00 ج.م)
  - Recognized Revenue Amount: e.g. `450.00 ج.م` per entry, total `900.00 ج.م`
  - Recognition Date & Journal Voucher Reference
  - Pending Units: Lesson 5 has delivery evidence `#LDE-PHY-03` pending certification; recognized revenue remains `0.00 ج.م`.
- *Fail-Closed Policy (`UP-701`):* Displays recognized amounts without exposing speculative statutory Chart of Accounts codes.

### Area H: Financial Adjustments, Exceptions & Refunds (`SFP-ADJ-01`)
- Documents formal adjustment workflows:
  - Discount Revisions & Exception Memos
  - Student Refund Requests (`طلب استرداد مالي`)
- *Fail-Closed Policy (`UP-706`):* Refund requests are placed into `قيد المراجعة الإدارية والقانونية (PENDING_LEGAL_REVIEW)`. Zero automatic refund calculations, zero administrative penalty formulas, and zero self-approvals.

### Area I: Academic Transfer & Withdrawal Ledger (`SFP-HIST-01`)
- Displays historical transitions:
  - Branch Transfer Log: e.g. Transferred from `فرع مدينة نصر` to `فرع الدقي` on 2026-10-15.
  - Previous Agreement Balances: Preserved exactly as contracted; not erased or overwritten.
  - Group Changes: Historical course attendance logs and past recognized revenue remain anchored to the original course group.

### Area J: Document Repository & Audit Trail (`SFP-DOC-01`)
- Storage and verification ledger for all PDF/scanned documents:
  - Signed Tuition Agreements (`عقد_الاتفاق_المالي_الموقع.pdf`)
  - Official Cash Receipts (`إيصال_تحصيل_9821.pdf`)
  - Certified Lesson Delivery Evidence (`دليل_تسليم_حصة_معتمد_LDE.pdf`)
  - Comprehensive chronological immutable audit trail logging user, timestamp, IP address, and operation.

---

## 3. Roles and Permission Boundaries

| Functional Capability | Primary Manager — المدير الرئيسي | Accountant — المحاسب | Cashier — الكاشير | Teacher — المعلم |
| :--- | :---: | :---: | :---: | :---: |
| **Profile Access Scope** | Institutional (All Campuses) | Assigned Campus Only (`BR-01`) | No Profile Access | Prohibited |
| **View Student Sub-Ledger & Dues** | **Full** | **Full (Assigned Campus)** | Balance/Due Lookup at Till | Prohibited |
| **Record Cash Collection** | Audit Only (No Frontline) | Full (Financial Desk) | Full (Assigned Till Station) | Prohibited |
| **Allocate Collection to Dues** | Full | **Full (Explicit Targets)** | Prohibited | Prohibited |
| **Draft Compensating Reversal** | Full Review | **Maker Draft (With Reason)** | Prohibited | Prohibited |
| **Authorize Compensating Reversal**| **Checker Authority (Sole Gate)**| Prohibited | Prohibited | Prohibited |
| **Submit Refund Request Dossier** | Full Review | **Maker Draft (UP-706 Hold)** | Prohibited | Prohibited |
| **Authorize Refund Payout** | **LOCKED (Pending UP-706)** | Prohibited | Prohibited | Prohibited |
| **View Revenue Recognition Ledger**| **Full** | **Full** | Prohibited | Prohibited |
| **View Teacher Dues & Payroll** | **Full** | Draft Review (UP-704 Hold) | Prohibited | Own Settled Dues Only |
| **Export Student Financial Statement**| **Full Institutional** | **Full Branch Scope** | Prohibited | Prohibited |

---

## 4. Visual Layout & Typography Directives

- **Layout Structure:** Adheres strictly to the accepted App Shell (Batch 1), using a 64px fixed TopBar (`h-16`), 260px collapsible Sidebar, and maximum 1600px viewport container (`max-w-[1600px]`).
- **Direction & Language:** RTL-first Arabic interface.
- **Typography:** **Cairo** / **Tajawal** for Arabic user interface labels; **JetBrains Mono** with tabular numeric figures (`font-variant-numeric: tabular-nums`) for currency amounts, student codes, receipt numbers, and dates.
- **Currency Standards:** All currency figures formatted as `ج.م` (Egyptian Pounds).
- **Theme Support:** Clean daylight theme (`slate-50` background, `white` cards) and dark mode (`slate-950` background, `slate-900` cards).
- **Demo Data Notice:** Prominent persistent badge: `بيانات تجريبية توضيحية — DEMO DATA — NOT REAL`.

