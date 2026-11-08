# OX-DIGITAL Education — UI/UX Phase 2 (Batch 3)
# Document 4: Accountant Role-Based Access Control & Permission Matrix
**Document ID:** `ACCOUNTANT_PERMISSION_MATRIX`  
**Status:** COMPLETE & AUTHORITATIVE — READY FOR PRODUCT OWNER REVIEW  
**Date:** 2026-11-04  
**Workspace:** `D:\OX-DIGITAL\Mathe\OX-DIGITAL-GITHUB`  
**Target Path:** `docs/ui-ux/phase-2/batch-3-accountant/ACCOUNTANT_PERMISSION_MATRIX.md`  
**Classification:** Security Architecture & Authorization Gate System  

> [!NOTE] Demonstration Data Policy
> All persona names, student IDs, teacher dues, cashbox balances, voucher numbers, and financial metrics in this document and accompanying prototypes are **SYNTHETIC DEMONSTRATION DATA (DEMO DATA — NOT REAL)**.

---

## 1. System Role Architecture & Governance Baseline

In accordance with Phase 1 and Phase 2 decisions, the accounting domain recognizes exactly **four roles**:
1. **Primary Manager — المدير الرئيسي (`PRIMARY_MANAGER`):** Executive institution-wide governance, Checker for all financial vouchers, cashbox transfer authorization, discrepancy resolution, and cross-branch oversight.
2. **Accountant (`ACCOUNTANT`):** Branch-scoped financial operator, Maker of transaction drafts and transfer requests, sub-ledger manager, payment allocation operator, expense voucher compiler, till reconciliation auditor, and preliminary reporter.
3. **Cashier (`CASHIER`):** Frontline physical cashbox custodian. Operates at designated physical till stations (e.g. `CB-01`, `CB-02`). Cashier remains an active, distinct accounting-domain role. No independent Cashier Dashboard or Cashier navigation shell is included in the current UI/UX architecture. Cashier capabilities are **not** implicitly granted to the Accountant, and Accountant capabilities are **not** implicitly granted to the Cashier. Both roles possess separately defined operational permissions.
4. **Teacher (`TEACHER`):** Educational instructor. Submits attendance and delivery evidence; receives settlements; zero accounting ledger access.

*Platform administrators (`admin@edu.com`) are strictly isolated outside the institutional tenant shell (`OD-718`). There is no Branch Manager role (`OD-701`). No fifth accounting-domain role (such as "المدير المالي" as a separate role) exists.*

---

## 2. Granular Role-Based Access Control (RBAC) Matrix

The table below contrasts capabilities across all active accounting roles, explicitly separating Accountant and Cashier boundaries and detailing the 5-stage cashbox transfer lifecycle:

| Functional Capability | Primary Manager — المدير الرئيسي | Accountant (Branch Scoped) | Cashier (Till Custodian) | Teacher |
| :--- | :---: | :---: | :---: | :---: |
| **Branch Context & Scoping** | Institutional (`ALL` + Campuses) | Assigned Campus Only (`BR-01`) | Assigned Till Only (`CB-01`) | Assigned Courses Only |
| **View Consolidated Enterprise KPIs** | **Full** | Prohibited | Prohibited | Prohibited |
| **Search Student Financial Sub-Ledger**| Full | **Full (Assigned Campus)** | Balance/Due Lookup at Till Only | Prohibited |
| **Record Student Collection & Issue Receipt**| Audit Only (No Frontline) | **Full (Branch Financial Desk)** | **Full (Assigned Till Station)** | Prohibited |
| **Allocate Receipt to Payment Schedule** | Full | **Full (Explicit Targets)** | Prohibited (Standard Billing) | Prohibited |
| **Print / Preview Collection Receipt** | Full | **Full** | Full (Current Till Only) | Prohibited |
| **Execute Compensating Receipt Reversal**| Full (Checker Review) | **Maker Draft (With Reason)** | Prohibited | Prohibited |
| **Draft Operational Expense Voucher** | Full | **Full (Maker)** | Prohibited | Prohibited |
| **Authorize / Sign Expense Voucher** | **Checker Gate (Sole Auth)** | **PROHIBITED (No Self-Auth)**| Prohibited | Prohibited |
| **Execute Till Cash Payout (Authorized)**| Full | **Full (Supervisory Payout)** | **Full (Till Payout on Auth Voucher)** | Prohibited |
| **Stage 1: Draft Cashbox Transfer Request**| Full | **Full (Maker: Till -> Vault)**| Prohibited | Prohibited |
| **Stage 2: Authorize Cashbox Transfer** | **Checker Gate (Sole Auth)** | **PROHIBITED (Requires PM Auth)**| Prohibited | Prohibited |
| **Stage 3: Reject / Cancel Transfer Request**| **Full (Can Reject Request)** | **Full (Can Cancel Own Draft)**| Prohibited | Prohibited |
| **Stage 4: Execute Physical Dispatch (Out)**| Full | **Full (Dispatches upon PM Auth)**| Custodial Handover under Supervision| Prohibited |
| **Stage 5: Confirm Physical Receipt (In)** | **Full (Vault Custodian on `CB-MAIN`)**| **Full (Receiving Till Custodian)**| Prohibited | Prohibited |
| **Input Daily Blind Cash Count** | Audit View | **Full (Reconciliation Auditor)**| Input Till Count (Shift End) | Prohibited |
| **Sign Off Daily Till Reconciliation** | **Checker Authority** | Full (Matched Count Only) | Prohibited | Prohibited |
| **Resolve Cashbox Shortage / Surplus** | **Under UP-705 (Hold Only)**| **PROHIBITED (UP-705 Lock)** | Prohibited | Prohibited |
| **Compile Teacher Delivery Evidence** | Full Review | **Full (Upload Attendance)** | Prohibited | Upload Attendance Only |
| **Calculate Teacher Pay Formula** | **LOCKED (Pending UP-704)** | **LOCKED (Pending UP-704)** | Prohibited | Prohibited |
| **Export Preliminary Operational Reports**| Full Enterprise | **Full (Assigned Branch Only)**| Prohibited | View Own Lessons Only |
| **Configure Institutional Policies** | **Sole Authority** | Prohibited | Prohibited | Prohibited |

---

## 3. Strict Prohibitions & Fail-Closed Guardrails for Accountants

To prevent unauthorized transactions, fraud, or ledger corruption, the system enforces programmatic barriers:

### Barrier 1: Maker-Checker Segregation (`OD-702`)
- **Prohibition:** An Accountant who prepares an expense voucher (`EXP-XXXX`) cannot approve it or change its status to `AUTHORIZED`.
- **System Guard:** The `[اعتماد الصرف]` (Authorize Payout) action is completely omitted from the Accountant interface and is only active in the Primary Manager shell.

### Barrier 2: Immutability & Reversal Protocol
- **Prohibition:** An Accountant cannot delete, overwrite, or edit a posted receipt or ledger entry.
- **System Guard:** Database mutations execute exclusively via append-only compensating entries (`REVERSAL`). Every reversal requires a recorded audit justification and preserves the original receipt pointer.

### Barrier 3: Cashbox Discrepancy Lock (`UP-705`)
- **Prohibition:** If a blind cash count differs from expected book liquidity (shortage or surplus), the Accountant cannot:
  1. Write off the shortage into center general loss.
  2. Charge the shortage as a personal deduction or debt on the cashier.
  3. Recognize a surplus as miscellaneous revenue.
  4. Generate balancing artificial accounting entries.
- **System Guard:** The system locks the reconciliation into neutral status: `قيد التحقيق والمراجعة الإدارية (PENDING_INVESTIGATION)`.

### Barrier 4: Decoupled Teacher Compensation (`UP-704`)
- **Prohibition:** The Accountant cannot apply arbitrary compensation percentages (e.g. "50% of tuition") or fixed hourly rates to calculate teacher dues.
- **System Guard:** The teacher compensation widget displays verified lesson delivery evidence and student attendance counts only, locking financial dues calculation under `في انتظار اعتماد لائحة الأجور الرسمية`.

### Barrier 5: Multi-Campus Isolation
- **Prohibition:** An Accountant assigned to Dokki Campus (`BR-01`) cannot view or modify transactions belonging to Nasr City Campus (`BR-02`) or execute cross-institution cash transfers.
- **System Guard:** Data queries are strictly scoped to the Accountant's authenticated branch context token.

### Barrier 6: Cashbox Transfer Authorization & Two-Sided Immutability
- **Prohibition:** An Accountant cannot unilaterally move physical or ledger funds between cashboxes or vaults without Primary Manager authorization.
- **System Guard:** Transfers strictly adhere to the 5-stage lifecycle. The Accountant operates solely as a Maker of transfer requests. Physical dispatch (`TRANSFER_OUT`) requires prior Primary Manager approval (`AUTHORIZED`), and transfer completion (`TRANSFER_IN`) requires explicit receipt confirmation by the destination custodian. Both sides are append-only and preserve institutional conservation of liquidity.

### Barrier 7: Domain Role Separation (Accountant vs Cashier)
- **Clarification:** The Cashier domain role remains distinct and active among the four approved accounting roles.
- **System Guard:** The absence of an independent Cashier Dashboard or navigation shell in the current UI does not merge the Cashier into the Accountant or grant Cashier capabilities implicitly to the Accountant. The Accountant operates within their separately defined workspace and permissions (supervising branch finance, allocating collections, drafting vouchers, and auditing reconciliations), while Cashiers operate frontline till collection points.

