# OX-DIGITAL Education — UI/UX Design Track — Phase 1
# Document 5: Core Financial & Operational Workflows
**Document ID:** `UI_UX_PHASE_1_CORE_WORKFLOWS`  
**Status:** REVISED & ALIGNED — READY FOR PRODUCT OWNER REVIEW  
**Date:** 2026-11-03  
**Workspace:** `D:\OX-DIGITAL\Mathe\OX-DIGITAL-GITHUB`  
**Classification:** Process Modeling & Operational Workflows  

---

## 1. Frontline Student Fee Collection & Financial Layer Decoupling

### Objective
High-speed, error-resistant collection of student tuition and fees at campus reception desks, strictly maintaining the boundary between operational cash collection, student sub-ledger tracking, general ledger posting, and accrual revenue recognition.

### Financial Architecture Decoupling (Four Distinct Layers)
To prevent accounting distortion, frontline collection is decoupled into four explicit layers:
1. **Operational Collection Evidence:** The cashier records student payment details, generating a unique, signed `CollectionReceiptEvidence` document containing receipt number, timestamp, cashier ID, branch ID, payer details, and tender method.
2. **Physical Cashbox Movement:** A typed `CashMovement` (`CASH_IN`) is recorded against the branch cashbox till, physically increasing the cashier till balance.
3. **Student Sub-Ledger Tracking:** In the student's sub-ledger account, the payment is registered as an unallocated collection advance (`StudentBalanceBucket.UNALLOCATED`) or allocated to scheduled obligations (`ALLOCATED`). This tracks student-level fulfillment, NOT general ledger income.
4. **General Ledger Journal Posting:** An automated double-entry journal entry posts:
   - **Debit:** Cashbox Asset (Account `1010` - Cash on Hand).
   - **Credit:** Deferred Student Collections / Unearned Revenue Liability (Account `2210`).
   - **Zero Recognized Revenue:** Earned revenue is NEVER posted upon collection.

```mermaid
sequenceDiagram
    autonumber
    actor Student as Student / Guardian
    actor Cashier as Frontline Cashier
    participant UI as Cashier Desk (CSH-DESK-01)
    participant Cashbox as Branch Physical Cashbox
    participant SubLedger as Student Sub-Ledger
    participant GL as General Ledger
    participant Print as Receipt Printer (STU-REC-01)

    Student->>Cashier: Requests fee payment (presents ID/barcode)
    Cashier->>UI: Scans barcode / enters student code
    UI->>SubLedger: Queries active financial obligations
    SubLedger-->>UI: Returns scheduled dues & remaining amounts
    UI->>Cashier: Displays photo, group, and due items
    Cashier->>UI: Selects payable item(s) & enters cash received
    Cashier->>UI: Clicks "إصدار إيصال القبض" (F9)
    
    rect rgb(240, 248, 255)
        Note over UI,Cashbox: Layer 1 & 2: Operational Evidence & Physical Cash
        UI->>Cashbox: Records collection movement into physical till
        Cashbox-->>UI: Emits CASHBOX_COLLECTION_RECORDED (physical till credited)
    end
    
    rect rgb(255, 250, 240)
        Note over UI,SubLedger: Layer 3: Student Sub-Ledger Tracking
        UI->>SubLedger: Registers CollectionReceiptEvidence (UNALLOCATED balance)
        SubLedger-->>UI: Confirms receipt registered in sub-ledger
    end
    
    rect rgb(245, 255, 250)
        Note over UI,GL: Layer 4: General Ledger Journal Posting
        UI->>GL: Posts JournalEntry: Debit Cash Asset / Credit Deferred Revenue Liability
        GL-->>UI: Journal Voucher posted (No Earned Revenue)
    end
    
    UI->>Print: Spools official receipt with QR verification (EGP / ج.م)
    Cashier->>Student: Hands physical printed receipt & change
```

### UX Fail-Safe Controls
- **Idempotency Defense:** The collection button disables immediately with a spinner upon click, preventing double charges from duplicate clicks.
- **Terminology Enforcement:** The UI labels the document `إيصال قبض` (Receipt), never `فاتورة إيراد` (Revenue Invoice), explicitly communicating that fee collection is not recognized income.
- **Strict Currency:** All values default to and validate as Egyptian Pounds (`EGP` / `ج.م`).

---

## 2. Inter-Cashbox Funds Transfer Workflow (Atomic Two-Sided)

### Objective
Secure transfer of cash between reception tills and the campus safe or between physical desks within the same institution.

```mermaid
stateDiagram-v2
    [*] --> PreValidation: Accountant / PM initiates transfer
    
    state PreValidation {
        [*] --> CheckStatus: Verify source & dest ACTIVE
        CheckStatus --> CheckInstitution: Confirm same institutionId
        CheckInstitution --> CheckPhysical: Verify both physical branches
        CheckPhysical --> CheckBalance: Verify source balance >= amount
    }

    PreValidation --> AtomicExecution: All Pre-Checks Pass
    PreValidation --> Rejection: Pre-Check Fails (Fails Closed)

    state AtomicExecution {
        [*] --> SourceDebit: source._applyTransferMovement(TRANSFER_OUT)
        SourceDebit --> DestCredit: dest._applyTransferMovement(TRANSFER_IN)
        DestCredit --> ConservationCheck: Verify sourceAmount === destAmount
        ConservationCheck --> RecordHistory: Create CashboxTransfer record
    }

    AtomicExecution --> SuccessCommit: Both movements succeed & balance balances
    AtomicExecution --> RollbackTriggered: Any step throws or fails

    state RollbackTriggered {
        [*] --> RollbackHistory: Purge partial transfer record
        RollbackHistory --> RollbackDest: dest._rollbackTransferMovement()
        RollbackDest --> RollbackSource: source._rollbackTransferMovement()
    }

    RollbackTriggered --> ErrorScreen: Both cashboxes restored to exact pre-transfer state
    SuccessCommit --> [*]
    ErrorScreen --> [*]
```

### UX Controls
- **Live Destination Status Guard:** If destination cashbox is `INACTIVE` or `SUSPENDED`, the transfer UI disables the destination option with an explanatory badge.
- **Two-Sided Audit Inspection:** Viewing transfer history displays both the `TRANSFER_OUT` movement on the source till and the linked `TRANSFER_IN` on the destination safe.

---

## 3. Daily Closing Cashbox Reconciliation Workflow (Continuous Chain)

### Objective
Physical cash count verification and formal business date closing for campus cashboxes under strict `UP-705` governance.

```mermaid
flowchart TD
    Start["End of Business Day (Shift Close)"] --> OpenRecon["Accountant Opens CB-RECON-01"]
    OpenRecon --> AutoCalc["System Calculates Expected Closing Balance:<br/>Opening + Collections + InTransfers - OutTransfers - Expenses"]
    AutoCalc --> InputCount["Accountant Counts Physical Cash & Enters 'Actual Counted'"]
    InputCount --> Compare{"Actual == Expected?"}
    
    Compare -->|Yes: Diff == 0| Balanced["Status: BALANCED<br/>Day Marked Closed"]
    Compare -->|No: Diff != 0| Discrepancy["Status: DISCREPANCY_PENDING_INVESTIGATION<br/>System Flags Variance"]
    
    Discrepancy --> ForceNotes["Accountant Must Enter Justification Notes"]
    ForceNotes --> BlockCheck{"Attempting Auto Write-Off or Surplus Gain?"}
    BlockCheck -->|Yes| Blocked["BLOCKED BY POLICY UP-705<br/>(No auto-write-offs or thresholds permitted)"]
    BlockCheck -->|No| SaveIncident["Reconciliation Saved as DISCREPANCY_PENDING_INVESTIGATION<br/>Alert Sent to Primary Manager"]
    
    Balanced --> NextDay["Day N+1 Opening Balance Hard-Locked to Day N Actual Closing"]
    SaveIncident --> NextDay
```

### Governance Invariants (`UP-705`)
- **Zero Discrepancy Tolerance:** The UI permits no variance threshold. Any non-zero difference triggers `DISCREPANCY_PENDING_INVESTIGATION`.
- **No Automatic Absorption:** The interface strictly disables auto write-off or surplus gain recognition.
- **Contiguous Continuity:** Day N+1 opening balance is hard-locked to Day N actual physical closing count.

---

## 4. Student Branch Transfer, Financial Suspension & Withdrawal

### Objective
Managing student branch mobility, financial suspensions, and withdrawals while strictly decoupling collection from access reactivation and preserving append-only financial audit trails.

### 4.1 Branch Transfer Flow
```mermaid
sequenceDiagram
    autonumber
    actor PM as Primary Manager
    participant UI as Student Management UI
    participant SubLedger as Student Sub-Ledger

    PM->>UI: Selects student & chooses "Transfer to Branch" (e.g. Cairo -> Alexandria)
    UI->>SubLedger: Invokes transferBranch(newBranchId, newCenterGroupId)
    SubLedger->>SubLedger: Appends LIFECYCLE_EVENT (TRANSFERRED) to sub-ledger log
    SubLedger->>SubLedger: Preserves all historical receipts & obligations under original Cairo branch
    SubLedger-->>UI: Confirms transfer complete
    UI-->>PM: Displays student under Alexandria with intact Cairo historical financial card
```

### 4.2 Financial Suspension & Access Reactivation Decoupling
To enforce institutional governance, financial suspension, fee collection, review, and educational access reactivation are strictly decoupled into distinct states:
1. **Suspension State (`SUSPENDED_FINANCIAL`):** Student attendance and classroom entry are blocked due to overdue fee obligations.
2. **Frontline Collection State:** Frontline cashier is permitted to accept fee payments, generating a collection receipt and crediting the sub-ledger.
3. **No Automatic Reactivation:** Payment does **NOT** automatically lift attendance suspension or reactivate educational access.
4. **Reactivation Review & Approval:** Reactivation requires explicit administrative authorization by the Primary Manager or an authorized policy permission:

```mermaid
stateDiagram-v2
    [*] --> Suspended: Overdue Payment / Administrative Action
    Suspended --> CollectionRecorded: Cashier Accepts Fee Collection
    
    state CollectionRecorded {
        [*] --> SubLedgerUpdated: Obligations Marked Paid
        SubLedgerUpdated --> AccessStillBlocked: Student Attendance Remains Suspended
    }
    
    CollectionRecorded --> ReactivationReview: Routed to Primary Manager Queue
    
    state ReactivationReview {
        [*] --> ManagerInspects: Review Arrears & Attendance Record
        ManagerInspects --> AuthorizeReactivation: PM Grants Access
        ManagerInspects --> MaintainSuspension: Disciplinary Reason Persists
    }
    
    AuthorizeReactivation --> Active: Student Access Restored
    MaintainSuspension --> Suspended: Access Remains Blocked
```

### 4.3 Student Withdrawal Flow (`UP-706`)
- **Status:** Under `UP-706`, automated refund execution is blocked fail-closed pending legal and commercial policy review.
- **Workflow:** When a student formally withdraws:
  1. Primary Manager transitions student status to `WITHDRAWN`.
  2. Sub-ledger preserves 100% of historical receipts, obligations, and allocations intact.
  3. The UI presents refund requests, review, approval, and adjustments as decoupled states without committing to an unapproved refund formula.

---

## 5. Teacher Lesson Delivery Evidence & Accrual Recognition

### Objective
Coupling physical educational delivery evidence with accrual revenue recognition and teacher compensation settlement.

```mermaid
sequenceDiagram
    autonumber
    actor Teacher as Classroom Teacher
    participant TUI as Teacher Portal (TCH-EVID-01)
    actor PM as Primary Manager
    participant PMUI as Approval Center (PM-APPR-01)
    participant AccEngine as Revenue Recognition Engine
    participant Acc as Accountant Workspace (TCOMP-PREP-01)

    Teacher->>TUI: Takes lesson attendance (e.g. 24 present, 2 absent)
    Teacher->>TUI: Submits Lesson Delivery Evidence
    TUI-->>PMUI: Delivery Evidence routed to Primary Manager queue
    PM->>PMUI: Reviews classroom roster & certifies delivery evidence
    
    rect rgb(245, 255, 250)
        Note over PMUI,AccEngine: Accrual Revenue Recognition Layer
        PMUI->>AccEngine: Delivers certified proof of educational service
        AccEngine->>AccEngine: Pairs delivery evidence with student price snapshot
        AccEngine-->>AccEngine: Posts accrual journal entry: Debit Deferred Revenue / Credit Earned Tuition
    end
    
    rect rgb(255, 250, 240)
        Note over Acc,PMUI: Teacher Compensation Preparation Layer (UP-704)
        Acc->>Acc: Accountant opens TCOMP-PREP-01
        Acc->>Acc: Compiles verified delivery units (completed lessons & attendance)
        Acc->>PMUI: Submits compiled Teacher Settlement Statement
        PM->>PMUI: Authorizes payout voucher (Maker-Checker complete)
        PMUI->>Teacher: Confirmed dues displayed in Teacher Portal (TCH-DUES-01)
    end
```

### Governance Guard (`UP-704`)
- **No Unapproved Revenue Share Calculations:** The UI displays confirmed physical delivery units (lessons completed, students attended). Variable revenue-sharing percentages remain disabled and configurable pending formal Product Owner policy resolution.
