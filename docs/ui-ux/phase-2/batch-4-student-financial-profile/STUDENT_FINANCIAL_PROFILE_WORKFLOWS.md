# OX-DIGITAL Education — UI/UX Phase 2 (Batch 4)
# Document 3: Student Financial Profile Operational Workflows & State Machines
**Document ID:** `STUDENT_FINANCIAL_PROFILE_WORKFLOWS`  
**Status:** COMPLETE & AUTHORITATIVE — READY FOR PRODUCT OWNER REVIEW  
**Date:** 2026-11-04  
**Workspace:** `D:\OX-DIGITAL\Mathe\OX-DIGITAL-GITHUB`  
**Target Path:** `docs/ui-ux/phase-2/batch-4-student-financial-profile/STUDENT_FINANCIAL_PROFILE_WORKFLOWS.md`  
**Classification:** Operational Business Logic & Transaction State Lifecycle  

> [!NOTE] Demonstration Data Policy
> All persona names, student IDs, voucher numbers, and financial metrics in this document and accompanying prototypes are **SYNTHETIC DEMONSTRATION DATA (DEMO DATA — NOT REAL)**.

---

## 1. Architectural Foundations of Student Financial Workflows

Workflows within the Student Financial Profile adhere to four foundational invariants:
1. **Four Independent Roles:** Interactions are modeled between four distinct roles (`PRIMARY_MANAGER`, `ACCOUNTANT`, `CASHIER`, `TEACHER`) without inheritance.
2. **Maker-Checker Segregation:** The Accountant acts as **Maker** (drafting agreements, proposing allocations, preparing adjustment dossiers). The Primary Manager acts as **Checker** (authorizing discounts, compensating reversals, policy exceptions).
3. **Four-Tier Revenue Segregation:** Contractual Agreement $\neq$ Due Amount $\neq$ Cash Collection $\neq$ Recognized Revenue.
4. **Append-Only Immutability:** No posted financial record is ever deleted or modified in place. Adjustments execute strictly through compensating journal reversals (`REVERSAL`).

---

## 2. Workflow 1: Agreement Onboarding & Payment Schedule Generation

Governs the legal-financial onboarding of a student, defining contracted tuition, applying authorized discounts, and establishing the immutable schedule of payments.

```mermaid
flowchart TD
    StartReg([Student Registers for Educational Course]) --> AccReview[Accountant Opens Agreement Desk SFP-AGREE-01]
    AccReview --> SelectScheme[Select Standard Catalog Pricing Scheme]
    SelectScheme --> CheckDiscount{Is Institutional Discount Granted?}
    
    CheckDiscount -->|Yes| InputDiscount[Enter Discount Reason & Authorized Memo ID]
    CheckDiscount -->|No| CalcNet[Net Agreed Tuition = Gross Catalog Price]
    InputDiscount --> CalcNet
    
    CalcNet --> GenerateSchedule[System Generates Contractual Payment Schedule & Due Dates]
    GenerateSchedule --> VerifySchedule[Accountant Verifies Milestones & Descriptors]
    VerifySchedule --> SignAgreement[Student & Guardian Sign Formal Agreement]
    
    SignAgreement --> PostAgreement[Post Immutable FinancialAgreement #AGR-XXXX]
    PostAgreement --> LedgerStatus[Sub-Ledger State: CONTRACTED\nLedger Debt: 0.00 EGP\nRecognized Revenue: 0.00 EGP]
    LedgerStatus --> EndReg([Agreement Active - Awaiting First Maturity Date])
```

### 2.1 Operational Rules:
- **Price Catalog Independence:** If the center alters its standard course group fee in the future, the student's existing signed agreement remains completely unaffected.
- **Zero Premature Recognition:** Signing the agreement books 0.00 EGP in educational revenue.

---

## 3. Workflow 2: Collection Inflow, Explicit Allocation & Advance Suspense

Governs cash intake at the till, explicit allocation against mature payment schedule items, and isolation of unallocated surplus funds.

```mermaid
sequenceDiagram
    autonumber
    actor Guardian as Guardian / Student
    actor Csh as Cashier (Till Custodian)
    actor Acc as Accountant (Maker)
    participant Sys as OX-DIGITAL System

    Guardian->>Csh: Presents cash at branch reception desk (1,000.00 EGP)
    Csh->>Sys: Enters student code STU-8821 & verifies physical cash
    Csh->>Sys: Issues Official Receipt #REC-9894 (Till CB-01 • 1,000.00 EGP)
    Sys->>Sys: Posts Append-Only Till Inflow (+1,000.00 EGP to CB-01)
    Sys->>Sys: Updates Student Sub-Ledger: Total Collected increases (+1,000.00 EGP)
    Sys-->>Guardian: Prints official receipt slip

    Note over Acc, Sys: Explicit Allocation Execution Desk (SFP-ALLOC-01)
    Acc->>Sys: Loads Receipt #REC-9894 on Student Profile
    Sys->>Sys: Displays Outstanding Scheduled Obligations
    Acc->>Sys: Explicitly selects SCH-ITEM-02 (Target: 750.00 EGP)
    Acc->>Sys: Confirms Allocation #AL-145 (750.00 EGP applied to SCH-02)
    Sys->>Sys: Updates SCH-02 Status: PARTIALLY_PAID (Remaining Due: 250.00 EGP)
    
    Note over Sys: Mathematical Conservation Rule Enforced
    Sys->>Sys: Surplus Cash Detected: 1,000.00 - 750.00 = 250.00 EGP
    Sys->>Sys: Isolates 250.00 EGP in UNALLOCATED_CUSTOMER_ADVANCE suspense
    Sys->>Sys: Verifies: Total Receipts (1,000) = Allocated (750) + Unallocated Advance (250)
```

### 3.1 Operational Safeguards:
- **No Silent FIFO Allocation:** The system refuses to auto-allocate cash to obligations without explicit Accountant designation.
- **No Academic Access Couplings:** Booking the receipt does not automatically lift academic suspensions or issue course badges.

---

## 4. Workflow 3: Non-Destructive Compensating Reversal of an Allocated Receipt

Governs the correction of an erroneous collection receipt without altering historical ledger entries.

```mermaid
sequenceDiagram
    autonumber
    actor Acc as Accountant (Maker)
    participant Sys as OX-DIGITAL System
    actor PM as Primary Manager — المدير الرئيسي (Checker)

    Acc->>Sys: Locates erroneous receipt #REC-9750 in Collection History
    Acc->>Sys: Clicks [إجراء قيد إلغاء تعويضي]
    Sys->>Sys: Validates that receipt has not already been reversed
    Acc->>Sys: Inputs mandatory audit rationale ("Wrong student code keyed at till")
    Acc->>Sys: Submits Reversal Request #REV-REQ-011
    Sys-->>PM: Alert: Reversal Request #REV-REQ-011 awaiting Checker sign-off

    PM->>Sys: Inspects original receipt, audit statement, and till cash balance
    PM->>Sys: Signs & Authorizes Reversal Entry #REV-011
    
    rect rgb(255, 240, 240)
    Note over Sys: Atomic Append-Only Reversal Ledger Mutations
    Sys->>Sys: Leaves original #REC-9750 untouched; sets pointer: reversalRef = #REV-011
    Sys->>Sys: Writes Compensating Till Outflow: MovementType = REVERSAL (-500.00 EGP)
    Sys->>Sys: Unwinds associated Allocation: Restores student obligation balance to DUE
    Sys->>Sys: Decrements student Total Collected by 500.00 EGP
    end
    
    Sys-->>Acc: Generates Compensating Credit Slip for Guardian
```

---

## 5. Workflow 4: Earned Educational Revenue Recognition

Governs how educational service delivery is recognized as earned income, strictly requiring BOTH certified `LessonDeliveryEvidence` for the student and unit, AND the approved immutable allocation plan (`PLAN-PHY-T1`).

```mermaid
flowchart TD
    StartDelivery([Teacher Delivers Scheduled Course Lessons]) --> UploadLDE[Register & Upload Certified LessonDeliveryEvidence #LDE-XXXX]
    UploadLDE --> ValidateEvidence[System Verifies Certified Delivery Evidence for Student & Unit]
    ValidateEvidence --> MatchPlan[Link to Approved Immutable Allocation Plan PLAN-PHY-T1]
    
    MatchPlan --> CheckDualRules{Dual Criteria Satisfied?<br/>1. Certified LessonDeliveryEvidence<br/>2. Approved Allocation Plan}
    CheckDualRules -->|No / Pending Certification| HoldSuspense[Hold in Unrecognized / Pending Delivery Evidence]
    CheckDualRules -->|Yes: Both Satisfied| CheckReceipts{Are Student Funds Collected & Allocated?}
    CheckReceipts -->|Yes: Collected & Allocated| EligibleRecognition[Eligible for Earned Revenue Recognition]
    CheckReceipts -->|No: Uncollected/Deferred| AccruedTuitionHold[Hold in Unearned Receivables / Accrual Review]
    
    EligibleRecognition --> AccGenerate[Accountant Generates Monthly Recognition Entry e.g. #101, #108]
    AccGenerate --> SysAudit[System Verifies: Unit Price × Delivered Lessons = Recognized Amount e.g. 2 × 225 = 450 EGP]
    SysAudit --> PostRevEntry[Post Append-Only RevenueRecognitionEntry]
    PostRevEntry --> UpdateKPI[Increment Recognized Revenue KPI on Student Profile e.g. 900.00 EGP]
    UpdateKPI --> EndDelivery([Earned Educational Income Formalized])
```

### 5.1 Revenue Recognition Invariants:
- **Agreement $\neq$ Revenue:** Signing a 5,500 EGP agreement recognizes zero revenue.
- **Collection $\neq$ Revenue:** Collecting 1,000 EGP at the till is deferred unearned income until certified delivery occurs.
- **Attendance Sheets Alone $\neq$ Revenue:** Attendance sheets without certified `LessonDeliveryEvidence` AND an approved immutable allocation plan (`PLAN-PHY-T1`) cannot book revenue. Both prerequisites must be simultaneously satisfied.
- **Evidence Trail:** Every recognized entry (e.g. #101, #108) must explicitly link to its certified delivery evidence document (`#LDE-PHY-01`, `#LDE-PHY-02`) and approved allocation schedule (`PLAN-PHY-T1`). Units pending certification (`#LDE-PHY-03`) remain at 0.00 EGP recognized.

---

## 6. Workflow 5: Academic Transfer or Withdrawal with Financial Record Preservation

Governs the handling of students transferring between branches or withdrawing, preserving the historical financial integrity.

```mermaid
flowchart TD
    StartTransfer([Student Requests Branch Transfer or Withdrawal]) --> AdminAction[Academic Administration Processes Academic Transfer/Withdrawal]
    AdminAction --> SetAcademicStatus[Academic Status = TRANSFERRED or WITHDRAWN]
    
    SetAcademicStatus --> PreserveLedger[System Locks Historical Financial Sub-Ledger]
    PreserveLedger --> CheckRules{Financial Invariant Check}
    
    CheckRules --> KeepReceipts[Preserve All Issued Receipts #REC-XXXX with Original Branch & Till]
    CheckRules --> KeepAllocations[Preserve Historical Allocations and Mature Obligations]
    CheckRules --> KeepRevenue[Preserve Historical Recognized Revenue for Delivered Lessons]
    
    KeepReceipts --> ReviewBalance{Does Student Have Unallocated Advance or Unsettled Dues?}
    KeepAllocations --> ReviewBalance
    KeepRevenue --> ReviewBalance
    
    ReviewBalance -->|Unallocated Advance Balance| PromptCustody[Prompt: Transfer Advance to New Branch or Process Administrative Dossier]
    ReviewBalance -->|Outstanding Dues| PreserveDebt[Preserve Due Balance on Student Historical Ledger]
    
    PromptCustody --> EndTransfer([Academic Transition Complete - Financial History Intact])
    PreserveDebt --> EndTransfer
```

### 6.1 Historical Balances & UP-711 Neutrality
Academic transitions and legacy record transfers do not imply approval of opening balances. Under unresolved policy `UP-711`, legacy payment records remain subject to source-document reconciliation and cannot be included in confirmed collection or revenue KPIs without verified source records.

---

## 7. Workflow 6: Refund Request Lifecycle with UP-706 Fail-Closed Gate

Governs how refund requests are submitted and held under strict administrative/legal review without premature calculations.

```mermaid
sequenceDiagram
    autonumber
    actor Guardian as Guardian / Student
    actor Acc as Accountant (Maker)
    participant Sys as OX-DIGITAL System
    actor PM as Primary Manager — المدير الرئيسي (Checker)

    Guardian->>Acc: Submits formal request for tuition refund due to emergency
    Acc->>Sys: Opens Adjustments & Refunds Desk (SFP-ADJ-01)
    Acc->>Sys: Inputs student code STU-8821 & attaches guardian request letter
    
    Note over Sys: UP-706 Fail-Closed Safety Protocol
    Sys->>Sys: Identifies Policy UP-706 as OPEN (Unresolved Refund Formula)
    Sys->>Sys: Blocks automated pro-rata calculations or administrative fee deductions
    Sys->>Sys: Registers Refund Dossier #REF-2026-04 with Status: PENDING_LEGAL_REVIEW
    Sys-->>Acc: System Notice: Refund request locked pending executive/legal resolution
    
    Acc->>Sys: Submits neutral dossier to Primary Manager Queue
    Sys-->>PM: High-priority governance alert: Neutral refund dossier submitted
    PM->>Sys: Inspects delivered lessons, collected funds, and legal terms
    Note over PM: Resolution deferred until Board / Legal Counsel issues binding ruling
```

