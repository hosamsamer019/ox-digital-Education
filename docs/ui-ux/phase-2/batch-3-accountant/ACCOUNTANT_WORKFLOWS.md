# OX-DIGITAL Education — UI/UX Phase 2 (Batch 3)
# Document 3: Accountant Operational Workflows & State Machines
**Document ID:** `ACCOUNTANT_WORKFLOWS`  
**Status:** COMPLETE & AUTHORITATIVE — READY FOR PRODUCT OWNER REVIEW  
**Date:** 2026-11-04  
**Workspace:** `D:\OX-DIGITAL\Mathe\OX-DIGITAL-GITHUB`  
**Target Path:** `docs/ui-ux/phase-2/batch-3-accountant/ACCOUNTANT_WORKFLOWS.md`  
**Classification:** Operational Business Logic & State Transition Systems  

> [!NOTE] Demonstration Data Policy
> All persona names, student IDs, teacher dues, cashbox balances, voucher numbers, and financial metrics in this document and accompanying prototypes are **SYNTHETIC DEMONSTRATION DATA (DEMO DATA — NOT REAL)**.

---

## 1. Architectural Foundations of Accountant Workflows

Accountant workflows are governed by three immutable principles established in the OX-DIGITAL Phase 2.0B baseline:
1. **The Maker-Checker Barrier:** The Accountant is strictly a **Maker** of financial movements and proposals. The Primary Manager is the sole authorized **Checker** for payouts, adjustments, and reconciliation sign-offs.
2. **The Append-Only Immutability Rule:** No posted receipt, till movement, voucher, or reconciliation record can be deleted or updated in place. Adjustments require compensating journal reversals (`REVERSAL`).
3. **The Four-Tier Revenue Progression:** Money moves through strict legal and accounting tiers:
   $$\text{عقد اتفاق مالي (Agreement)} \longrightarrow \text{دفعة مجدولة مستحقة (Due Date)} \longrightarrow \text{تحصيل نقدي بالخزينة (Collection)} \longrightarrow \text{إيراد معترف به (Revenue)}$$

---

## 2. Workflow 1: Collection Recording & Explicit Target Allocation

Governs how an Accountant receipts incoming student funds and allocates them to scheduled payments.

```mermaid
flowchart TD
    Start([Student / Guardian Arrives at Desk]) --> SelectStudent[Accountant Searches Student & Active Agreement]
    SelectStudent --> LoadSchedule[System Loads Educational Payment Schedule]
    LoadSchedule --> ReviewDues{Are there Overdue / Current Dues?}
    
    ReviewDues -->|Yes| SelectTarget[Accountant Selects Specific Scheduled Payment Target]
    ReviewDues -->|No / Advance| AdvanceNotice[Prompt: Unallocated Customer Deposit Warning]
    
    SelectTarget --> EnterAmount[Enter Received Amount & Select Payment Method]
    AdvanceNotice --> EnterAmount
    
    EnterAmount --> TargetMatch{Does Amount Match Selected Target?}
    TargetMatch -->|Full Payment| ExactAlloc[Set Target Status: FULLY_PAID]
    TargetMatch -->|Partial Payment| PartialAlloc[Set Target Status: PARTIALLY_PAID\nRemaining balance remains due]
    TargetMatch -->|Overpayment| SplitAlloc[Fully pay target\nRemainder placed in Unallocated Suspense]
    
    ExactAlloc --> SelectTill[Select Branch Cashbox Till CB-01 / CB-02]
    PartialAlloc --> SelectTill
    SplitAlloc --> SelectTill
    
    SelectTill --> IssueReceipt[Generate Immutable Receipt #REC-XXXX]
    IssueReceipt --> DebitTill[Debit Physical Cashbox Till\nUpdate Branch Liquidity]
    DebitTill --> UpdateSubledger[Update Student Sub-Ledger Account]
    UpdateSubledger --> PrintReceipt[Print Official Customer Receipt Preview]
    PrintReceipt --> End([Transaction Complete - Unearned Inflow Secured])
```

### 2.1 Operational Rules for Collections
1. **Explicit Allocation Mandate:** The Accountant must explicitly check which scheduled payment item(s) are being settled. Automated FIFO allocation without user confirmation is prohibited.
2. **Access Isolation:** Securing payment in the cashbox does **not** automatically grant academic course permissions or reactivate suspended students. Academic eligibility is governed separately by the academic service.
3. **Unallocated Suspense:** If a guardian pays more than the targeted scheduled payment without designating a future payment, the surplus is logged as `UNALLOCATED_CUSTOMER_DEPOSIT` and held on the student's sub-ledger.

---

## 3. Workflow 2: Compensating Reversal of an Erroneous Receipt

Governs how an Accountant corrects a data-entry error or misallocated collection receipt without deleting historical records.

```mermaid
sequenceDiagram
    autonumber
    actor Acc as Accountant (Maker)
    participant Sys as OX-DIGITAL System
    actor PM as Primary Manager (Checker)

    Acc->>Sys: Locates original receipt (#REC-9821) in Receipt Audit Register
    Acc->>Sys: Clicks [إجراء قيد إلغاء تعويضي]
    Sys->>Sys: Displays Non-Destructive Audit Notice
    Acc->>Sys: Inputs mandatory audit reason (e.g. "Wrong student ID entered at reception")
    Acc->>Sys: Submits Compensating Reversal
    Sys->>Sys: Generates Reversal Entry #REV-014 referencing #REC-9821
    Sys->>Sys: Credits Student Sub-Ledger (Restores Due Balance)
    Sys->>Sys: Credits Cashbox Till (Negative Cash Adjustment)
    Sys-->>PM: Incident alert logged in Executive Audit Feed
    Sys-->>Acc: Prints Compensating Credit Slip for Guardian
```

### 2.2 Reversal Safeguards
- **Original Unmodified:** `#REC-9821` retains its original status with an immutable pointer: `reversalReference = #REV-014`.
- **Till Balance Protection:** A reversal can only execute if the physical till contains sufficient cash to cover the refund.

---

## 4. Workflow 3: Operational Expense Voucher Preparation & Authorization

Governs the Maker-Checker workflow for campus operating expenditures (repairs, utilities, supplies).

```mermaid
flowchart TD
    StartExp([Operational Expense Incurred]) --> MakerDraft[Accountant Prepares Expense Voucher ACC-EXP-01]
    MakerDraft --> SelectCategory[Select Approved Expense Category & Cost Center]
    SelectCategory --> EnterDetails[Enter Exact Amount & Commercial Payee]
    EnterDetails --> AttachDocs[Upload Flexible Supporting Documents\nInvoice, receipt, delivery note, technical inspection report]
    AttachDocs --> SubmitVoucher[Submit to Checker Queue\nStatus: SUBMITTED_FOR_APPROVAL]
    
    SubmitVoucher --> CheckerAlert[Primary Manager Alerted in TopBar & Pending Queue]
    CheckerAlert --> ManagerReview{Primary Manager Decision}
    
    ManagerReview -->|Authorized| AuthVoucher[Primary Manager Signs & Authorizes EXP-XXXX]
    ManagerReview -->|Returned| ReturnMaker[Status: RETURNED_TO_MAKER\nRequires additional documentation]
    ManagerReview -->|Rejected| RejectVoucher[Status: REJECTED\nLogged in Audit History]
    
    AuthVoucher --> TillPayout[Authorized Custodian Disburses Cash on Approved Voucher]
    TillPayout --> TillCredit[Credit Cashbox Till: Negative Cash Outflow]
    TillCredit --> LedgerEntry[Post Immutable Journal Entry to Expense Sub-Ledger]
    LedgerEntry --> EndExp([Expense Workflow Complete])
```

### 4.1 Supporting Document Flexibility
- **No Statutory Tax Constraint:** Supporting documents accept commercial receipts, supplier bills, delivery notes, and technical inspection sheets. No VAT invoices or withholding certificates are required or calculated.

---

## 5. Workflow 4: Cashbox Transfer Authorization Lifecycle & Intra-Campus Custody Handover

Governs the secure, atomic transfer of surplus cash between physical cashboxes (e.g. from reception tills to the central vault). The workflow strictly enforces a 5-stage authorization and execution lifecycle preserving the two-sided append-only ledger and institutional conservation of liquidity.

```mermaid
sequenceDiagram
    autonumber
    actor Acc as Accountant (Maker)
    participant Sys as OX-DIGITAL System
    actor PM as Primary Manager — المدير الرئيسي (Checker / Vault Custodian)

    rect rgb(240, 248, 255)
    Note over Acc, Sys: Stage 1: Transfer Preparation & Request (Maker)
    Acc->>Sys: Drafts Transfer Request #TR-2026-081 (ACC-CB-01)
    Acc->>Sys: Source: Reception Till 1 (CB-01) | Dest: Central Vault (CB-MAIN) | Amount: 5,000.00 EGP
    Sys->>Sys: Validates Source Till Available Balance >= 5,000.00 EGP
    Sys->>Sys: Status = PENDING_AUTHORIZATION (No money moves yet)
    Sys-->>PM: Alert: Transfer Request #TR-2026-081 submitted for authorization
    end

    alt Rejection or Cancellation Handling (Stage 3A)
        Acc->>Sys: Cancels request prior to approval -> Status: CANCELLED (No movement)
    else Primary Manager Rejection (Stage 3B)
        PM->>Sys: Rejects transfer request with documented rationale -> Status: REJECTED (No movement)
    else Stage 2: Review & Authorization Gate (Checker)
        PM->>Sys: Reviews request & campus liquidity rules on CB-MGT-01
        PM->>Sys: Signs & Authorizes Transfer -> Status: AUTHORIZED
        Sys-->>Acc: Notification: Transfer #TR-2026-081 Authorized. Ready for physical dispatch.
    end

    rect rgb(255, 250, 240)
    Note over Acc, Sys: Stage 4: Physical Execution & Dispatch (Transfer-Out Record)
    Acc->>Sys: Confirms physical cash handover into sealed transit bag
    Sys->>Sys: Posts Append-Only Debit Record: Type = TRANSFER_OUT (-5,000.00 EGP)
    Sys->>Sys: CB-01 Balance decreases: 24,500.00 -> 19,500.00 EGP
    Sys->>Sys: Status = IN_TRANSIT (Cash in custodial transit)
    end

    rect rgb(240, 255, 240)
    Note over PM, Sys: Stage 5: Physical Receipt, Count & Confirmation (Transfer-In Record)
    PM->>PM: Receives transit bag, breaks seal, and performs physical count
    PM->>Sys: Confirms physical receipt of 5,000.00 EGP on CB-MGT-01
    Sys->>Sys: Posts Append-Only Credit Record: Type = TRANSFER_IN (+5,000.00 EGP)
    Sys->>Sys: CB-MAIN Balance increases: 30,000.00 -> 35,000.00 EGP
    Sys->>Sys: Status = TRANSFER_COMPLETED (Atomic Two-Sided Settlement Sealed)
    Note over Sys: Conservation Law: Consolidated Institutional Liquidity unchanged (86,400.00 EGP)
    end
```

### 5.1 Detailed Breakdown of the 5-Stage Transfer Lifecycle
1. **Stage 1: Transfer Preparation / Request (Maker — Accountant):**
   - The Accountant drafts a transfer request specifying source cashbox (`CB-01`), destination cashbox (`CB-MAIN`), amount (`5,000.00 EGP`), and operational reason (e.g. morning shift surplus deposit).
   - System verifies source available liquidity and sets status to `PENDING_AUTHORIZATION`. Zero physical or ledger funds move at this stage.
2. **Stage 2: Review and Approval Gate (Checker — Primary Manager):**
   - Primary Manager evaluates the transfer request against security thresholds and campus liquidity needs.
   - If acceptable, the Primary Manager authorizes the request (`AUTHORIZED`). No automated approval or lower threshold exists; all inter-cashbox transfers require explicit Primary Manager authorization or policy confirmation.
3. **Stage 3: Rejection or Cancellation Handling:**
   - **Maker Cancellation:** Prior to authorization, the drafting Accountant may cancel the request (`CANCELLED`).
   - **Checker Rejection:** The Primary Manager may reject the request with a mandatory documented justification (`REJECTED`). The request is archived without any ledger entries.
   - **Transit Discrepancy:** If physical cash counted at delivery differs from dispatched amount, the incident is placed into `TRANSIT_DISCREPANCY_INVESTIGATION` under Primary Manager review, with zero automated write-offs.
4. **Stage 4: Physical Execution & Dispatch (`TRANSFER_OUT` Record):**
   - Upon Primary Manager authorization, the sender initiates physical dispatch in an authorized custody envelope.
   - System records an append-only debit ledger entry (`MovementType: TRANSFER_OUT`) from the source till. Status transitions to `IN_TRANSIT`.
5. **Stage 5: Physical Receipt & Confirmation (`TRANSFER_IN` Record):**
   - Destination custodian (Primary Manager for Central Vault) inspects the envelope and performs a physical verification count.
   - Destination custodian confirms receipt in the system. The system writes an append-only credit entry (`MovementType: TRANSFER_IN`).
   - Status advances to `TRANSFER_COMPLETED`. The two-sided transaction is atomically finalized, preserving the conservation law of institutional liquidity across the four approved cashboxes: CB-01 (24,500.00) + CB-02 (13,900.00) + CB-MAIN (30,000.00) + CB-03 (18,000.00) = 86,400.00 EGP.

---

## 6. Workflow 5: End-of-Day Blind Cash Count & Fail-Closed Reconciliation

Governs daily till reconciliations, enforcing the `UP-705` fail-closed protocol for discrepancies.

```mermaid
flowchart TD
    StartRecon([End of Daily Till Shift]) --> BlindCount[Accountant Enters Counted Currency Denominations]
    BlindCount --> CalcPhysical[System Computes Total Physical Cash Counted]
    CalcPhysical --> FetchLedger[System Compares against System Expected Balance]
    
    FetchLedger --> DiffCheck{Physical Cash == Expected Ledger?}
    
    DiffCheck -->|Matched: Diff == 0.00| ReconOK[Status: RECONCILED_MATCHED]
    ReconOK --> CloseTill[Lock Till for Shift & Submit to Manager Sign-Off]
    
    DiffCheck -->|Shortage or Surplus: Diff != 0.00| ReconDiscrepancy[Lock Till in Status: PENDING_INVESTIGATION]
    ReconDiscrepancy --> UP705Lock[Enforce UP-705 Fail-Closed Protocol]
    
    UP705Lock --> BlockWriteOff[Block Automated Write-Offs]
    UP705Lock --> BlockLiability[Block Charging Shortage to Employee Liability]
    UP705Lock --> BlockSurplus[Block Absorbing Surplus as Revenue]
    UP705Lock --> BlockEntry[Block Balancing Accounting Entries]
    
    UP705Lock --> PromptStatement[Prompt Custodian & Accountant for Written Statement]
    PromptStatement --> EscalateManager[Escalate Neutral Incident Dossier #DISC-XXXX to Primary Manager]
    EscalateManager --> EndRecon([Reconciliation Locked Pending Executive Resolution])
```

---

## 7. Workflow 6: Teacher Lesson Delivery Evidence Compilation

Governs how educational service delivery is documented without making speculative compensation calculations.

```mermaid
flowchart TD
    StartTch([Teacher Completes Scheduled Course Lessons]) --> AccCompile[Accountant Accesses ACC-TCH-01 Desk]
    AccCompile --> LinkCourse[Select Course Group & Instructor]
    LinkCourse --> UploadAttendance[Upload Certified Attendance Sheets & Lesson Verification Records]
    UploadAttendance --> ValidateUnits[Verify Lesson Units Completed against Syllabus Plan]
    ValidateUnits --> LinkAllocation[Associate with Approved Immutable Allocation Plan]
    
    LinkAllocation --> RevenueTrigger[Recognized Educational Revenue Enabled for Completed Lessons]
    LinkAllocation --> HoldTeacherPay{Teacher Dues Calculation Status}
    
    HoldTeacherPay -->|UP-704 Unresolved Policy| LockPay[Hold Dues Calculation in Status: AWAITING_OFFICIAL_POLICY]
    LockPay --> PreventSpeculation[Prohibit Default % Shares or Flat Hourly Formulas]
    PreventSpeculation --> RecordAdvance[Log Approved Historical Cash Advances if any]
    RecordAdvance --> EndTch([Evidence Dossier Archived for Board Settlement])
```

