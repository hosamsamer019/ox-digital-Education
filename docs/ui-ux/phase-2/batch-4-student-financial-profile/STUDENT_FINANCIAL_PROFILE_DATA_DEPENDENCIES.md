# OX-DIGITAL Education — UI/UX Phase 2 (Batch 4)
# Document 5: Student Financial Profile Data Dependencies & API Contracts
**Document ID:** `STUDENT_FINANCIAL_PROFILE_DATA_DEPENDENCIES`  
**Status:** COMPLETE & AUTHORITATIVE — READY FOR PRODUCT OWNER REVIEW  
**Date:** 2026-11-04  
**Workspace:** `D:\OX-DIGITAL\Mathe\OX-DIGITAL-GITHUB`  
**Target Path:** `docs/ui-ux/phase-2/batch-4-student-financial-profile/STUDENT_FINANCIAL_PROFILE_DATA_DEPENDENCIES.md`  
**Classification:** Technical Data Architecture & Integration Contracts  

> [!NOTE] Demonstration Data Policy
> All persona names, student IDs, voucher numbers, and financial metrics in this document and accompanying prototypes are **SYNTHETIC DEMONSTRATION DATA (DEMO DATA — NOT REAL)**.

---

## 1. Architectural Baseline & Existing Relational Foundation

The Student Financial Profile builds upon existing models in `packages/database/prisma/schema.prisma` and domain classes in `packages/shared/src/accounting/`:

1. **Existing Prisma Relational Foundation:**
   - `User` & `StudentProfile`: Demographics, national ID, institutional tenant scoping.
   - `Institution` & `Branch`: Physical educational centers (`فرع الدقي`, `فرع مدينة نصر`) with `isOnline` support.
   - `AcademicEnrollment`, `CourseGroup`, `Attendance`: Course sections, instructor assignments, attendance records.
2. **Existing In-Memory Accounting Domain (`packages/shared/src/accounting`):**
   - `Cashbox`, `CashboxMovement`, `MovementType` (`COLLECTION`, `DISBURSEMENT`, `TRANSFER_IN`, `TRANSFER_OUT`, `REVERSAL`).
3. **Proposed Relational Entities for Full Sub-Ledger Persistence:**
   - `FinancialAgreement`: Contract metadata, list price, approved discount, net price.
   - `PaymentScheduleItem`: Scheduled milestones, descriptors, due dates, maturity states.
   - `CollectionReceipt`: Cash receipt header, manual receipt reference, till pointer.
   - `AllocationRecord`: Explicit link between a receipt and a payment schedule item.
   - `RevenueRecognitionEntry`: Earned revenue record linked to certified lesson delivery evidence (`LessonDeliveryEvidence`) and approved immutable allocation plan (`PLAN-PHY-T1`).
   - `RefundRequestDossier`: Formal request record held under neutral review (`UP-706`).

---

## 2. Source Records vs. Derived Display Summaries

To ensure financial integrity, the UI strictly distinguishes between primary immutable source records and derived display aggregates:

| Display Metric | Source Record Entity | Mathematical Derivation Formula |
| :--- | :--- | :--- |
| **Total Agreed Net** | `FinancialAgreement` | `FinancialAgreement.grossAmount - FinancialAgreement.discountAmount` |
| **Total Amount Due** | `PaymentScheduleItem` | $\sum \text{amount}$ for all items where $\text{dueDate} \le \text{Today}$ |
| **Total Collected** | `CollectionReceipt` & `ReversalEntry` | $\sum \text{Receipt.amount} - \sum \text{Reversal.amount}$ |
| **Total Remaining Due** | Derived Aggregate | $\text{TotalAgreedNet} - \sum \text{AllocationRecord.allocatedAmount}$ |
| **Unallocated Advance** | Derived Aggregate | $\text{TotalCollected} - \sum \text{AllocationRecord.allocatedAmount}$ |
| **Recognized Revenue** | `RevenueRecognitionEntry` | $\sum \text{RevenueRecognitionEntry.recognizedAmount}$ (strictly requiring dual criteria: certified `LessonDeliveryEvidence` AND approved immutable `AllocationPlan`) |
| **Overdue Balances** | `PaymentScheduleItem` | $\sum (\text{amount} - \text{allocated})$ where $\text{dueDate} < \text{Today}$ |

$$\text{Conservation Law 1:} \quad \text{Total Allocated} + \text{Unallocated Advance} = \text{Total Collected}$$
$$\text{Conservation Law 2:} \quad \text{Total Allocated} + \text{Total Remaining Due} = \text{Total Obligations Due (Agreed Net)}$$

### 2.1 Reconciled Synthetic Test Scenario (Student: Omar Sharif — STU-8821)
- **Total Agreed Net:** `5,500.00 EGP` (Gross 6,000 - Discount 500)
- **Total Obligations Due:** `5,500.00 EGP` (Sum of all 5 milestones)
- **Amount Currently Due (Matured):** `2,750.00 EGP` (Items 1, 2, and 3 matured to date)
- **Amount Overdue:** `1,000.00 EGP` (250 EGP remaining on Item 2 + 750 EGP on Item 3)
- **Total Collected:** `2,000.00 EGP` (Receipt #REC-9821 1,000 + Receipt #REC-9894 1,000)
- **Total Allocated:** `1,750.00 EGP` (1,000 to Item 1 + 750 to Item 2)
- **Unallocated Advance:** `250.00 EGP` (Surplus on Receipt #REC-9894 held in suspense)
- **Total Remaining Due:** `3,750.00 EGP` (Contract balance: $5,500.00 - 1,750.00$)
- **Recognized Educational Revenue:** `900.00 EGP` (RevenueRecognitionEntry #101 [450.00 EGP] + RevenueRecognitionEntry #108 [450.00 EGP]), each linked to approved immutable allocation plan `PLAN-PHY-T1` (2 units × 225.00 EGP) and certified `LessonDeliveryEvidence` (`#LDE-PHY-01` and `#LDE-PHY-02`). Lesson 5 evidence (`#LDE-PHY-03`) remains pending certification with 0.00 EGP recognized.
- *Law 1 Proof:* $1,750.00\text{ (Allocated)} + 250.00\text{ (Advance)} = 2,000.00\text{ EGP (Collections)}$ ✔️
- *Law 2 Proof:* $1,750.00\text{ (Allocated)} + 3,750.00\text{ (Remaining Due)} = 5,500.00\text{ EGP (Obligations Due)}$ ✔️

### 2.2 Treatment of Legacy & Opening Balances (`UP-711` Neutral Status)
Under unresolved policy `UP-711`, historical balances from previous systems are pending verification and reconciliation. Opening balances are unapproved and must not be injected into confirmed collection, due, or revenue KPIs without source document verification.

---

## 3. Screen-to-Data Mapping (Areas A through J)

| Profile Area | Required Data Fields | Source Model | Baseline Status | Proposed API Endpoint |
| :--- | :--- | :--- | :---: | :--- |
| **Area A: Identity Bar** | Name, code, national ID, academic group, dual statuses | `User`, `StudentProfile`, `AcademicEnrollment` | **EXISTING** | `GET /api/v1/students/:id/profile-header` |
| **Area B: KPI Bar** | 7 mathematical summary metrics | Aggregated Sub-Ledger | Domain Exists | `GET /api/v1/accounting/students/:id/financial-summary` |
| **Area C: Agreement** | Agreement ID, list price, discount, schedule | `FinancialAgreement`, `PaymentScheduleItem` | Proposed Model | `GET /api/v1/accounting/students/:id/agreement` |
| **Area D: Obligations** | Milestones, due dates, target, remaining, overdue | `PaymentScheduleItem` joined with allocations | Proposed Model | `GET /api/v1/accounting/students/:id/obligations` |
| **Area E: Collections** | Receipts, dates, amounts, cashbox, reversals | `CollectionReceipt`, `CashboxMovement` | Domain Exists | `GET /api/v1/accounting/students/:id/receipts` |
| **Area F: Allocations** | Receipt-to-obligation links, unallocated advance | `AllocationRecord` | Proposed Model | `GET /api/v1/accounting/students/:id/allocations` |
| **Area G: Revenue** | Recognized entries, lesson units, evidence PDFs, allocation plan links | `RevenueRecognitionEntry`, `LessonDeliveryEvidence`, `AllocationPlan` | Partial | `GET /api/v1/accounting/students/:id/revenue-records` |
| **Area H: Adjustments** | Refund requests, discount memos, UP-706 state | `RefundRequestDossier`, `FinancialAgreement` | Proposed Model | `GET /api/v1/accounting/students/:id/adjustments` |
| **Area I: Transfers** | Campus transfer logs, historical branch context | `AcademicEnrollment` historical log | **EXISTING** | `GET /api/v1/students/:id/academic-history` |
| **Area J: Documents** | Document URLs, types, timestamps, audit trail | Document Storage + `AuditLog` | Proposed Model | `GET /api/v1/accounting/students/:id/documents` |

---

## 4. Proposed REST API Contracts & Sample Payloads

### 4.1 Explicit Payment Allocation Contract
```json
// POST /api/v1/accounting/students/STU-8821/allocations
{
  "receiptId": "REC-9894",
  "allocations": [
    {
      "scheduleItemId": "SCH-ITEM-02",
      "allocatedAmount": 750.00
    }
  ],
  "unallocatedBalanceAction": "HOLD_IN_SUSPENSE",
  "makerId": "ACC-01",
  "notes": "سداد جزئي لدفعة أكتوبر مع تجنيب الفائض البالغ 250 ج.م في حساب الدفعات المقدمة"
}
```

### 4.2 Compensating Receipt Reversal Contract
```json
// POST /api/v1/accounting/students/STU-8821/receipts/REC-9750/reverse-request
{
  "originalReceiptId": "REC-9750",
  "reversalReason": "خطأ في تسجيل كود الطالب عند شباك الاستقبال وتم إعادة التحصيل بالإيصال البديل",
  "makerId": "ACC-01",
  "branchId": "BR-01",
  "supportingDocumentUrl": "/documents/reversals/memo_rev_011.pdf"
}
```

### 4.3 Tuition Refund Request Dossier Contract (`UP-706` Fail-Closed)
```json
// POST /api/v1/accounting/students/STU-8821/refund-requests
{
  "studentId": "STU-8821",
  "agreementId": "AGR-2026-0881",
  "requestDate": "2026-11-02",
  "guardianStatement": "طلب استرداد نظراً لظروف صحية خاصة بالأسرة وعدم القدرة على استكمال البرنامج",
  "deliveredLessonsCount": 4,
  "totalNetCollected": 2000.00,
  "status": "PENDING_LEGAL_REVIEW",
  "makerId": "ACC-01",
  "notes": "الطلب مسجل في حالة حيادية لحين صدور قرار مجلس الإدارة والإدارة القانونية (UP-706)"
}
```

