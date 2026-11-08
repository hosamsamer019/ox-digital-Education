# OX-DIGITAL Education — UI/UX Phase 2 (Batch 5)
# Document 5: Cashbox Data Dependencies & Technical Architecture
**Document ID:** `CASHBOX_DATA_DEPENDENCIES`  
**Status:** COMPLETE & AUTHORITATIVE — READY FOR PRODUCT OWNER REVIEW  
**Date:** 2026-11-04  
**Workspace:** `D:\OX-DIGITAL\Mathe\OX-DIGITAL-GITHUB`  
**Target Path:** `docs/ui-ux/phase-2/batch-5-cashbox-management/CASHBOX_DATA_DEPENDENCIES.md`  
**Classification:** Sub-Ledger Technical Architecture, Data Schemas & API Contracts  

> [!NOTE] Demonstration Data Policy
> All persona names, user IDs, voucher numbers, and financial metrics in this document and accompanying prototypes are **SYNTHETIC DEMONSTRATION DATA (DEMO DATA — NOT REAL)**.

---

## 1. Domain Entities & Sub-Ledger Models

The Cashbox Management sub-ledger interfaces with existing in-memory domain structures (`packages/shared/src/accounting`) and establishes proposed relational schema structures for robust sub-ledger persistence:

### 1. Existing Shared Domain Structures
- **`Cashbox`:** Represents a physical till or vault with `id`, `name`, `branchId`, `custodianId`, `status`, and `currentBalance`.
- **`CashboxMovement`:** Immutable journal record with `id`, `cashboxId`, `type` (`COLLECTION`, `DISBURSEMENT`, `TRANSFER_IN`, `TRANSFER_OUT`, `REVERSAL`), `amount`, `referenceId`, `performedBy`, `timestamp`, and `isReversed`.

### 2. Proposed Persistence Entities for Sub-Ledger
- **`CashboxTransferRequest`:** Tracks the 5-stage transfer lifecycle (`id`, `sourceCashboxId`, `destCashboxId`, `amount`, `status`: `REQUESTED`, `AUTHORIZED`, `REJECTED`, `IN_TRANSIT`, `COMPLETED`, `makerId`, `checkerId`, `dispatchedAt`, `receivedAt`).
- **`DailyCashboxReconciliation`:** End-of-shift dossier (`id`, `cashboxId`, `reconciliationDate`, `shiftDescriptor`, `openingBalance`, `totalCollections`, `totalInTransfers`, `totalOutTransfers`, `totalExpenses`, `expectedClosingBalance`, `actualCountedBalance`, `differenceAmount`, `status`: `RECONCILED_BALANCED`, `DISCREPANCY_PENDING_INVESTIGATION`, `makerId`, `checkerId`).
- **`ExpenseVoucher`:** Petty cash voucher (`id`, `cashboxId`, `voucherNumber`, `expenseCategory`, `amount`, `description`, `supportingDocumentUrl`, `makerId`, `checkerId`, `status`: `DRAFT`, `PENDING_APPROVAL`, `APPROVED`, `DISBURSED`, `REJECTED`).
- **`DiscrepancyInvestigationDossier`:** Neutral discrepancy file (`id`, `reconciliationId`, `cashboxId`, `discrepancyType`: `SHORTAGE`, `SURPLUS`, `differenceAmount`, `incidentNotes`, `status`: `PENDING_INVESTIGATION`, `leadInvestigatorId`).

---

## 2. Source Records vs. Derived Display Metrics

To guarantee absolute financial integrity, the UI strictly distinguishes between primary immutable source records and derived mathematical metrics:

| Display Metric | Primary Source Model | Exact Mathematical Derivation Formula |
| :--- | :--- | :--- |
| **Cashbox Book Balances** | `Cashbox` (All 4 approved) | $\sum_{i \in \{\text{CB-01, CB-02, CB-MAIN, CB-03}\}} \text{Cashbox.currentBalance}_i = 86,400.00\text{ ج.م}$ |
| **Cash in Transit** | `CashboxTransferRequest` (Transit) | $\sum \text{Amount} \text{ where status = IN\_TRANSIT} = 1,500.00\text{ ج.م}$ (#TRF-104) |
| **Total Institutional Cash Position** | Cashboxes + In-Transit | $\text{Cashbox Book Balances} + \text{Cash in Transit} = 86,400.00 + 1,500.00 = 87,900.00\text{ ج.م}$ |
| **Expected Closing Balance** | Period `CashboxMovement` | $\text{Opening} + \text{Collections} + \text{TransfersIn} - \text{TransfersOut} - \text{Expenses}$ |
| **Reconciliation Difference** | Count vs. Derived Expected | $\text{Difference} = \text{Actual Counted Cash} - \text{Expected Closing Balance}$ |
| **Net Discrepancy Total** | `DailyCashboxReconciliation` | $\sum \text{DifferenceAmount}$ for all open investigations ($-150.00\text{ ج.م}$ on CB-03) |
| **Transfer Liquidity Delta** | `CashboxTransferRequest` | $\Delta \text{Institutional Cash Position} = -\text{Amount} + \text{Amount} = 0.00\text{ ج.م}$ (Neutral) |

---

## 3. Screen-to-Data Mapping (Areas A through H)

| Screen Area | Data Fields Required | Source Model | Baseline Status | Proposed REST API Endpoint |
| :--- | :--- | :--- | :---: | :--- |
| **Area A: Overview** | 4 cashboxes, balances, statuses, consolidated KPI | `Cashbox`, `CashboxMovement` | Existing Domain | `GET /api/v1/accounting/cashboxes/overview` |
| **Area B: Detail** | Movement timeline, running balances, vouchers | `CashboxMovement`, `Receipt` | Existing Domain | `GET /api/v1/accounting/cashboxes/:id/movements` |
| **Area C: Transfers** | Transfer requests, 5-stage lifecycle, balances | `CashboxTransferRequest` | Proposed Model | `GET /api/v1/accounting/cashboxes/transfers` |
| **Area D: Reconciliation**| Expected, counted, differences, shift dossiers | `DailyCashboxReconciliation` | Proposed Model | `GET /api/v1/accounting/cashboxes/:id/reconciliations` |
| **Area E: Collections** | Till intake, receipt cross-reference, idempotency | `CollectionReceipt`, Till | Existing Domain | `POST /api/v1/accounting/cashboxes/:id/intake` |
| **Area F: Expenses** | Vouchers, attachments, approvals, disbursement | `ExpenseVoucher` | Proposed Model | `GET /api/v1/accounting/cashboxes/expenses` |
| **Area G: Audit/Vault** | Audit & verification logs, document scans, reversals | `AuditLog`, Document Storage | Proposed Model | `GET /api/v1/accounting/cashboxes/:id/audit-trail` |
| **Area H: Branch Scope** | Branch affiliation, user assignments, till locks | `Branch`, `User` | **EXISTING** | Session Context / RBAC middleware |

---

## 4. Proposed REST API Contracts & Sample Payloads

### 4.1 Internal Transfer Request Contract (Maker)
```json
// POST /api/v1/accounting/cashboxes/transfers
{
  "sourceCashboxId": "CB-01",
  "destCashboxId": "CB-MAIN",
  "amount": 1500.00,
  "currency": "EGP",
  "transferReason": "ترحيل فائض تحصيلات الفترة الصباحية إلى الخزينة المركزية بالفرع",
  "makerId": "ACC-01",
  "status": "REQUESTED"
}
```

#### 4.1.1 Authoritative Transfer Eligibility Validation Rules (Backend Authority)
The backend REST API (`POST /api/v1/accounting/cashboxes/transfers`) is the authoritative gatekeeper for internal transfer requests. Client-side form validations exist strictly for immediate user feedback and UX convenience. The backend MUST independently, transactionally, and fail-closed validate the following six eligibility conditions before creating any transfer record:
1. **Source & Destination Differentiation:** `sourceCashboxId !== destCashboxId`. Rejects with `422 Unprocessable Entity` if identical.
2. **Active Operational Status:** `source.isActive === true && dest.isActive === true`. Rejects with `422 Unprocessable Entity` if either cashbox is inactive, suspended, or closed.
3. **Physical Till Requirement:** `source.isOnline === false && dest.isOnline === false`. Internal transfers are strictly between physical till cashboxes; digital payment accounts or virtual ledgers are prohibited as endpoints. Rejects with `422 Unprocessable Entity`.
4. **Institutional Boundary Enforcement:** `source.institutionId === dest.institutionId`. Cross-institution transfers are prohibited; multi-tenant isolation is strictly enforced. Rejects with `403 Forbidden` if tenant IDs differ.
5. **Positive Amount & Book Balance Conservation:** `amount > 0 && amount <= source.currentBalance`. Rejects with `400 Bad Request` if `amount <= 0`; rejects with `422 Unprocessable Entity` if `amount > source.currentBalance`.
6. **Mandatory Business Justification:** `transferReason.trim().length > 0`. Rejects with `400 Bad Request` if blank or whitespace-only.

### 4.2 Checker Authorization Contract
```json
// POST /api/v1/accounting/cashboxes/transfers/TRF-104/authorize
{
  "transferId": "TRF-104",
  "decision": "AUTHORIZED",
  "checkerId": "MGR-01",
  "authorizationNotes": "معتمد للنقل الفعلي بحراسة أمين الخزينة",
  "authorizedAt": "2026-11-04T11:20:00Z"
}
```

### 4.3 Physical Dispatch Contract
```json
// POST /api/v1/accounting/cashboxes/transfers/TRF-104/dispatch
{
  "transferId": "TRF-104",
  "sourceCashboxId": "CB-01",
  "dispatchedBy": "CSH-01",
  "dispatchMemoNumber": "DSP-2026-881",
  "dispatchedAt": "2026-11-04T11:25:00Z"
}
```

### 4.4 Physical Receipt & Completion Contract
```json
// POST /api/v1/accounting/cashboxes/transfers/TRF-104/receive
{
  "transferId": "TRF-104",
  "destCashboxId": "CB-MAIN",
  "receivedBy": "CSH-MAIN",
  "verifiedBanknotesAmount": 1500.00,
  "acknowledgmentSlipUrl": "/documents/transfers/ack_trf_104.pdf",
  "receivedAt": "2026-11-04T11:40:00Z"
}
```

### 4.5 Daily Cash Count Submission Contract (`UP-705` Discrepancy Case)
```json
// POST /api/v1/accounting/cashboxes/CB-03/reconciliations
{
  "cashboxId": "CB-03",
  "branchId": "BR-02",
  "reconciliationDate": "2026-11-04",
  "shift": "MORNING",
  "countedDenominations": {
    "d200": 50,
    "d100": 60,
    "d50": 30,
    "d20": 15,
    "d10": 5
  },
  "actualCountedTotal": 17850.00,
  "expectedClosingBalance": 18000.00,
  "differenceAmount": -150.00,
  "status": "DISCREPANCY_PENDING_INVESTIGATION",
  "custodianStatement": "يوجد عجز نقدي بقيمة 150 ج.م وجاري مراجعة إيصالات التحصيل اليدوية",
  "makerId": "CSH-03"
}
```

---

## 5. System States, Edge Cases & Robustness

### 1. In-Transit Funds Protection
- During physical transit (`Stage 4`), cash is debited from source cashbox but not yet credited to destination cashbox.
- Cashbox book balances total `86,400.00 EGP` (CB-01: 24,500; CB-02: 13,900; CB-MAIN: 30,000; CB-03: 18,000).
- In-transit funds (`1,500.00 ج.م`) are tracked explicitly in institutional liquidity summaries as `نقد قيد النقل بين الخزائن (#TRF-104)`.
- Total institutional cash position (cashboxes + cash-in-transit) is completely preserved at `87,900.00 EGP` ($86,400.00 + 1,500.00 = 87,900.00\text{ EGP}$).
- When receipt is confirmed at destination, in-transit cash decreases by the transfer amount and destination balance increases by the same amount, keeping total institutional cash strictly invariant. Funds are never destroyed, created, or triple-counted.

### 2. Discrepancy Treatment Protection (`UP-705`)
- When actual count differs from expected closing balance, the system locks the discrepancy in neutral review.
- The difference is neither added to income nor written off as an expense.
- Book balance remains authoritative at `18,000.00 EGP` while physical cash is reported as `17,850.00 EGP` with `-150.00 EGP` clearly labeled as `فارق قيد التحقيق`.

### 3. Missing Evidence Handling
- Expense vouchers or compensating reversals submitted without supporting documents cannot be finalized.
- System allows saving as `DRAFT` or `PENDING_ATTACHMENTS`, preventing premature cash disbursements.

