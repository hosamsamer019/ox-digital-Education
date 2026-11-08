# OX-DIGITAL Education — Accounting Track
# Phase 2.0A: Center Operations to Financial Domain Integration Mapping

**Author:** Senior Integration Architect & Business Systems Analyst  
**Project:** OX-DIGITAL Education  
**Document Classification:** Technical Integration Mapping & Operational Transformation Contract  
**Baseline Commit:** `0500b93e65c24ed881349c4acea7f523332c5e9f` on branch `main`  
**Date:** November 3, 2026

---

## 1. Executive Purpose

This document provides a source-backed operational mapping between existing physical-center models/services in the OX-DIGITAL platform and the target double-entry financial persistence engine.

It establishes exact transformation rules, triggers, coexistence boundaries, and risk mitigations, ensuring that introducing enterprise financial accounting does not destabilize existing classroom operations.

---

## 2. Comprehensive Source-to-Financial Domain Mapping Matrix

| Existing Source Entity / Service | Proposed Target Financial Concept | Operational Transformation & Field Mapping | Event Trigger | Operational & Financial Risk | Status / Capability |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Student Registration**<br>[`User.role = 'CENTER_STUDENT'`](file:///D:/OX-DIGITAL/Mathe/OX-DIGITAL-GITHUB/packages/database/prisma/schema.prisma#L79)<br>`user.controller.ts:399` | **`StudentFinancialAccount`** | Generates an auditable sub-ledger account bound to `(institutionId, studentId)`. Balance initializes to 0.00 EGP. | `POST /api/users/register` or Admin student creation. | Student created without institution boundary (quarantine risk). Mitigated by Task 7.1 tenant guard. | **SUPPORTED VIA HOOK** |
| **Group Enrollment**<br>[`User.centerGroupId`](file:///D:/OX-DIGITAL/Mathe/OX-DIGITAL-GITHUB/packages/database/prisma/schema.prisma#L85)<br>`user.controller.ts:400` | **`StudentGroupMembershipHistory`** &<br>**`StudentFinancialAgreement`** | Captures enrollment start date. Instantiates `StudentFinancialAgreement` reading group pricing terms. | Student assigned to `centerGroupId`. | Overwriting previous group without history. Mitigated by membership history entity. | **TRANSFORMATION DESIGNED** |
| **Group Price Changes**<br>`model CenterGroup`<br>*(Currently no price field)* | **`GroupPricingAgreement`** &<br>**`AgreementPriceSnapshot`** | Primary Manager updates group master pricing. New price applies to future enrollments. Existing student agreements remain frozen. | Primary Manager publishes new price catalog. | Silent alteration of active student fees. Mitigated by immutable price snapshots. | `FUTURE_CAPABILITY` |
| **Student-Specific Agreement**<br>*(Currently unrepresented in schema)* | **`StudentFinancialAgreement`** &<br>**`StudentObligation`** | Establishes total agreed fee, discounts, and payment schedule. Schedules mature `StudentObligation` records. | Parent/Student signs registration form at center desk. | Unapproved discount granted by cashier. Mitigated by Primary Manager approval gate. | `FUTURE_CAPABILITY` |
| **Payment Collection**<br>`model Payment`<br>`payment.controller.ts:10` | **`Collection`**, **`CollectionAllocation`**, &<br>**`JournalEntry`** | Frontline cashier receives cash or card swipe. Generates physical receipt `REC-{BRANCH}-{SEQ}`. Posts GL: `DR Cash (1010), CR AR (1200)`. | Cashier submits desk collection form. | Co-mingling legacy online course payments with center tuition. Mitigated by table separation. | **SEPARATED RE-ARCHITECTURE** |
| **Partial Collection**<br>*(Currently unsupported in `Payment`)* | **`CollectionAllocation`** | Partial collection allocated to earliest mature `StudentObligation`. Updates `collectedAmount`; tracks overdue balance. | Cashier receives partial fee payment. | Loss of remainder tracking. Mitigated by integer piaster allocation conservation. | `FUTURE_CAPABILITY` |
| **Classroom Attendance**<br>`model Attendance`<br>`attendance.controller.ts:6` | **`AttendanceEvidence`** &<br>**`SessionConsumption`** | Teacher marks `status = 'PRESENT'`. Verified by session roster. Evaluates package eligibility (OD-706, OD-722.1). | Teacher submits attendance via mobile or tablet. | Absent student charged for session (violates OD-722.1). Mitigated by `PRESENT_ONLY` rule. | **SUPPORTED VIA EVIDENCE LINK** |
| **Lesson Delivery Evidence**<br>`model Lesson`<br>*(Curriculum only)* | **`LessonDeliveryEvidence`** | Teacher confirms physical session was delivered in room X for group Y. Connects scheduled lesson to classroom reality. | End of scheduled session window. | Scheduled lesson cancelled due to weather/illness counted as delivered. Mitigated by explicit delivery sign-off. | `FUTURE_CAPABILITY` |
| **Revenue Recognition**<br>*(Currently non-existent)* | **`RevenueRecognitionEvent`** &<br>**`JournalEntry`** | Verified attendance + delivered lesson triggers recognition. Posts GL: `DR Unearned Tuition (2100), CR Earned Tuition (4010)`. | Verified attendance roster finalized. | Recognizing unearned prepayments before teaching. Mitigated by attendance-trigger rule. | `FUTURE_CAPABILITY` |
| **Student Group Transfer**<br>`User.centerGroupId` overwrite<br>`user.controller.ts:535` | **`StudentGroupMembershipHistory`** &<br>**`FinancialAdjustment`** | Closes previous group membership (`endDate`). Reconciles prepaid unearned sessions via credit note. Opens new group agreement. | Admin changes student group in UI. | Double-charging or balance deletion upon transfer. Mitigated by credit note transfer protocol. | `FUTURE_CAPABILITY` |
| **Student Withdrawal**<br>*(Currently only soft-delete `User.deletedAt`)* | **`RefundRequest`**, **`FinancialAdjustment`**, &<br>**`JournalReversal`** | Closes enrollment. Computes pro-rata unserved period (UP-706). Primary Manager approves refund. Issues compensating reversal. | Parent submits withdrawal form. | Deleting user deletes sub-ledger (OD-708 breach). Mitigated by `onDelete: Restrict`. | `FUTURE_CAPABILITY` |
| **Teacher Compensation Evidence**<br>*(Currently non-existent)* | **`TeacherCompensationEvidence`** &<br>**`TeacherPayable`** | Aggregates verified lesson deliveries and student headcount. Computes payable under approved contract model. Posts `DR Payroll (5010), CR Payable (2010)`. | Monthly payroll generation run. | Disputed student revenue basis (UP-704). Mitigated by contract-level basis configuration. | `FUTURE_CAPABILITY` |
| **Operating Expense Entry**<br>*(Currently non-existent)* | **`CashboxTransaction`** (Expense) &<br>**`JournalEntry`** | Accountant records facility expense with invoice image. Posts GL: `DR Expense (5xxx), CR Cashbox/Bank (1010)`. | Accountant logs paid petty cash voucher. | Rogue expense entry. Mitigated by Primary Manager approval thresholds. | `FUTURE_CAPABILITY` |

---

## 3. Physical Session Package Consumption (OD-706 & OD-722.1–5)

For centers offering prepaid multi-session packages (e.g., 8-session math package for 600.00 EGP):

```mermaid
flowchart TD
    BUY["Student Purchases 8-Session Package (600 EGP)\nPosted: DR Cash 600, CR Unearned Revenue 600\nAllocation: 75.00 EGP / Session (OD-722.4)"]
    ATT["Classroom Session Conducted"]
    
    BUY --> ATT
    ATT --> COND{"Attendance Verification"}
    
    COND -->|Student PRESENT (OD-722.1)| CONS["Consume 1 Session\nRecognize Revenue: DR Unearned 75, CR Tuition Revenue 75"]
    COND -->|Student ABSENT| ABS{"Absence Reason"}
    
    ABS -->|Timely Notice / Doctor Note| RESTORE["Restore Session Credit to Package (OD-722.5)"]
    ABS -->|Teacher Cancelled Session| RESTORE2["Restore Session Credit (OD-722.5)"]
    ABS -->|Unexcused / Late Notice| FORFEIT["Session Forfeited per Center Policy\nRecognize Forfeited Fee: DR Unearned 75, CR Fee 75"]
```

1. **OD-706 (Consumption by Eligible Attendance):** Sessions are deducted solely upon eligible attendance evidence.
2. **OD-722.1 (Present Only):** An absence does not consume a session unless explicitly governed by a documented unexcused forfeiture policy.
3. **OD-722.2 (Configurable Expiration):** Package expiration dates are stored on `SessionPackage` (e.g., valid for 60 days from purchase).
4. **OD-722.4 (Equal Pro-Rata Allocation):** Package price is divided equally across total sessions ($600 / 8 = 75.00$ EGP/session). Penny remainders are allocated to the final session.
5. **OD-722.5 (Cancellation & Make-Up Protocol):** If the teacher cancels, or the student provides timely notice (e.g., 24 hours prior), the session credit is restored. Make-up sessions are treated as distinct attendance events.

---

## 4. Cashbox Management & Daily Reconciliation Protocol (Stage E — Correction C)

```mermaid
sequenceDiagram
    autonumber
    actor Cashier as Desk Cashier
    actor Accountant as Center Accountant
    actor PM as Primary Manager
    participant Box as Cashbox Persistence

    Cashier->>Box: Open Shift (Record Float Amount)
    loop Business Day
        Cashier->>Box: Record Collection (Receipt: REC-001..N)
        Cashier->>Box: Record Authorized Petty Cash Disbursement (Voucher & Invoice attached)
    end
    Cashier->>Accountant: End-of-Day Physical Cash Count Submission
    Accountant->>Box: Reconcile Physical Count vs System Expected Balance
    Accountant->>Box: Record Auditable Discrepancy (Physical - Expected)
    alt Discrepancy Exactly Zero
        Accountant->>Box: Sign Off Shift Close (Status: RECONCILED)
    else Discrepancy Non-Zero (UP-705 Unresolved Gate)
        Accountant->>PM: Submit Discrepancy for Primary Manager Investigation & Approval
        PM->>Box: Authorize Adjustment (DR/CR 5900 Cash Over/Short) & Sign Off Close
    end
    Accountant->>Box: Record Vault Transfer (Cash to Center Safe)
```

1. **Multiple Cashboxes per Campus:** Each physical branch may operate separate reception tills (e.g., "Branch Cairo - Desk 1", "Branch Cairo - Desk 2") plus a "Branch Cairo - Main Safe".
2. **Transfers Between Cashboxes:** Moving physical cash from Desk Till to Main Safe creates a `CashboxTransfer`. It changes the location sub-account (`DR Safe, CR Desk Till`), but creates **zero** revenue or expense.
3. **Cash Discrepancy Governance (UP-705 Unresolved):**
   - The operational threshold for automatic Accountant reconciliation vs mandatory Primary Manager investigation remains **strictly UNRESOLVED** under UP-705.
   - No arbitrary threshold (e.g. 50.00 EGP) is assumed or embedded.
   - The system distinguishes: 1. Physical Counted Cash, 2. Expected System Balance, 3. Recorded Discrepancy, 4. Reconciliation Status, 5. Primary Manager Authorization.
   - Every discrepancy is permanently auditable and never converted into an expense/income without formal approval.

---

## 5. Teacher Compensation Sub-Ledger Protocol (Stage F — Correction B)

1. **Separation of Scheduled vs Delivered:** A lesson appearing on a group's schedule does **NOT** accrue compensation. Compensation accrues strictly upon **verified classroom delivery** confirmed by center supervision.
2. **Four-Stage Lesson Distinction:** The system strictly separates:
   - *Scheduled Lesson:* Timetable plan.
   - *Delivered Lesson:* Classroom session conducted.
   - *Verified Lesson:* Supervisor-confirmed delivery and attendance headcount.
   - *Approved Obligation:* Certified payable calculation signed off by Primary Manager.
3. **UP-704 Unresolved Qualifying Basis Gate:**
   - The qualifying calculation basis for variable revenue-share models (Gross catalog tuition vs Net agreed tuition vs Net collected cash) is **strictly UNRESOLVED** under UP-704.
   - No calculation basis is selected as a default or presented as approved.
   - Each compensation calculation stores the exact policy version and evidence snapshot used. Later policy changes do not silently alter historically approved obligations.
   - UP-704 is a blocking Product Owner decision before variable teacher compensation can be implemented.

