# OX-DIGITAL Education — UI/UX Phase 2 (Batch 5)
# Document 6: Cashbox Design Decisions, Assumptions & Governance Log
**Document ID:** `BATCH_5_DESIGN_DECISIONS`  
**Status:** COMPLETE & AUTHORITATIVE — READY FOR PRODUCT OWNER REVIEW  
**Date:** 2026-11-04  
**Workspace:** `D:\OX-DIGITAL\Mathe\OX-DIGITAL-GITHUB`  
**Target Path:** `docs/ui-ux/phase-2/batch-5-cashbox-management/BATCH_5_DESIGN_DECISIONS.md`  
**Classification:** Product Owner Governance Register & Decision Log  

> [!NOTE] Demonstration Data Policy
> All persona names, user IDs, voucher numbers, and financial metrics in this document and accompanying prototypes are **SYNTHETIC DEMONSTRATION DATA (DEMO DATA — NOT REAL)**.

---

## 1. Executive Summary & Authoritative Directives

This document records the binding architectural decisions, governance constraints, and avoided assumptions established for **UI/UX Phase 2 — Batch 5: Cashbox Management — Design & Specification**. It guarantees unbroken mathematical and policy continuity with Phase 1 architecture, Batch 1 App Shell, Batch 2 Primary Manager Dashboard, Batch 3 Accountant Workspace, and Batch 4 Student Financial Profile.

---

## 2. Formal Design Decisions Log

### Decision D-34: Four Approved Physical Cashboxes & Consolidated Liquidity Baseline
- **Context:** Previous preliminary iterations contained varying cashbox counts and inconsistent balance summaries.
- **Decision:** The institutional cashbox structure is strictly limited to four approved physical cashboxes totaling `86,400.00 EGP` in book closing liquidity:
  - `CB-01` (Dokki): `24,500.00 ج.م`
  - `CB-02` (Dokki): `13,900.00 ج.م`
  - `CB-MAIN` (Central Vault, Dokki): `30,000.00 ج.م`
  - `CB-03` (Nasr City): `18,000.00 ج.م`
  - Total Cashbox Book Balances: `86,400.00 ج.م`
  - Cash in Transit (`#TRF-104`): `1,500.00 ج.م`
  - Total Institutional Cash Position: `87,900.00 ج.م` (Invariant across internal transfers).
- **Protection:** Completely eliminates speculative cashboxes (`CB-04`) and obsolete balances (`28,000.00 EGP` in Nasr City).

---

### Decision D-35: Explicit Branch Affiliation of Central Vault (`CB-MAIN`)
- **Context:** Central vaults in multi-branch organizations are sometimes modeled as floating, unassigned entities outside the branch structure.
- **Decision:** `CB-MAIN` is explicitly assigned to physical branch `BR-01` (Dokki Center / Headquarters). No cashbox exists outside the approved branch dimension.
- **Protection:** Preserves institutional multi-tenant hierarchy and organizational dimension integrity.

---

### Decision D-36: Five-Stage Internal Transfer Lifecycle & Liquidity Neutrality
- **Context:** Uncontrolled transfer features can lead to double-counting of in-flight funds or premature balance execution.
- **Decision:** Internal transfers strictly follow a five-stage lifecycle:
  1. `REQUESTED` (Maker: Accountant)
  2. `AUTHORIZED` (Checker: Primary Manager)
  3. Workflow disposition (`APPROVED`, `REJECTED`, `CANCELLED`)
  4. `IN_TRANSIT` (Physical cash dispatched, source debited, cash-in-transit credited)
  5. `COMPLETED` (Physical cash received, confirmed strictly by designated receiving custodian at destination cashbox, destination credited, cash-in-transit debited)
  Internal transfers are strictly liquidity-neutral ($\Delta \text{Institutional Cash Position} = 0.00\text{ EGP}$).
- **Protection:** Prevents cash leakage, ensures physical custody tracking, restricts receipt confirmation to destination custodian, and blocks duplicate or triple booking.

---

### Decision D-37: Prohibition of Automatic Dispatch or Auto-Completion
- **Context:** Automated workflows sometimes assume approval automatically dispatches cash or marks receipt after a timeout.
- **Decision:** Transfer approval authorizes dispatch but does **not** move funds. Source funds move exclusively upon physical dispatch (`IN_TRANSIT`). Destination funds move exclusively upon physical receipt acknowledgment (`COMPLETED`). Automated timeouts or auto-completion are strictly prohibited.
- **Protection:** Eliminates discrepancies between software state and physical cash in transit.

---

### Decision D-38: Fail-Closed Protection for Cashbox Discrepancies (`UP-705`)
- **Context:** Frontline variances (e.g. `CB-03` difference of `-150.00 EGP`) often trigger automated write-offs or employee deductions.
- **Decision:** Unresolved policy `UP-705` remains **OPEN**. Any variance triggers status `DISCREPANCY_PENDING_INVESTIGATION`. The system blocks:
  - Automatic shortage write-offs.
  - Surplus income recognition.
  - Charging shortages to cashier or employee liability.
  - Fabricating balancing journal entries.
  - Applying speculative monetary tolerance thresholds.
- **Protection:** Prevents pre-empting executive and legal board authority.

---

### Decision D-39: Flexible Supporting Documents & Operational Focus
- **Context:** Commercial accounting tools often enforce complex statutory or tax workflows.
- **Decision:** Expense vouchers accept flexible operational supporting evidence (supplier receipts, maintenance orders, service slips, purchase memos). The system scope focuses purely on operational cash disbursements and physical till integrity without statutory tax-engine assumptions.
- **Protection:** Reflects actual operating realities of educational centers in Egypt without burdening frontline staff with inapplicable features.

---

### Decision D-40: Non-Destructive Immutability & Append-Only Compensating Reversals
- **Context:** Deleting or altering posted movements destroys auditability.
- **Decision:** Posted cash movements are strictly immutable. Corrections execute exclusively through append-only compensating reversal entries (`REVERSAL`), linking to the original movement.
- **Protection:** Guarantees comprehensive audit trail integrity.

---

### Decision D-41: Four Independent Accounting Roles with Zero Inheritance
- **Context:** Role inheritance models often grant unintended elevated access to frontline staff.
- **Decision:** Exactly four independent roles exist: `PRIMARY_MANAGER`, `ACCOUNTANT`, `CASHIER`, `TEACHER`. Zero inheritance (`<|--`). The Cashier role is active but has no independent dashboard shell. Cashier permissions do not implicitly transfer to Accountant, and Accountant permissions do not transfer to Cashier.
- **Protection:** Enforces strict Maker-Checker segregation and protects sensitive financial data.

---

### Decision D-42: Physical-Centers-First Operational Scope
- **Context:** Incorporating future online payment features prematurely introduces unnecessary complexity.
- **Decision:** Active operations are strictly physical educational centers (`فرع الدقي`, `فرع مدينة نصر`). Online subscriptions, Fawry/Paymob billing, and digital revenue recognition are deferred (`مؤجل — خارج النطاق المالي الحالي`).
- **Protection:** Maintains razor-sharp focus on the approved physical center accounting scope.

---

## 3. Summary of Assumptions Explicitly Avoided

| Architectural Area | Speculative Assumption Avoided | Authoritative Treatment Applied |
| :--- | :--- | :--- |
| **Cashbox Count** | "Add a 4th branch cashbox `CB-04` or floating vault." | **Rejected.** Exactly four approved cashboxes: CB-01, CB-02, CB-MAIN, CB-03 (D-34). |
| **Nasr City Balance** | "Use obsolete Nasr City closing balance of 28,000.00 EGP." | **Rejected.** Reconciled authoritative book balance is 18,000.00 EGP (D-34). |
| **Central Vault Ownership**| "Model Central Vault as an unassigned institution-wide entity." | **Rejected.** CB-MAIN is explicitly assigned to branch BR-01 (D-35). |
| **Transfer Execution** | "Automatically dispatch cash upon Primary Manager approval." | **Rejected.** Approval authorizes movement; dispatch requires physical handover (D-37). |
| **Transfer Completion**| "Mark transfer complete after a 24-hour timeout." | **Rejected.** Completion requires explicit physical receipt count at destination (D-37). |
| **Shortage Handling** | "Charge the -150 EGP difference to cashier salary or write it off." | **Rejected.** UP-705 remains open; locked in neutral investigation (D-38). |
| **Surplus Handling** | "Recognize excess physical cash as miscellaneous institutional income." | **Rejected.** Surplus is locked in neutral investigation under UP-705 (D-38). |
| **Balancing Entries** | "Post an adjusting journal entry to force book and count agreement." | **Rejected.** Strictly prohibited; both expected and actual balances displayed separately. |
| **Tax Engine & Complex Forms** | "Introduce statutory tax workflows, VAT, or withholding tax engines." | **Rejected.** Flexible operational receipts accepted; statutory tax assumptions completely excluded (D-39). |
| **Role Hierarchy** | "Model Accountant as inheriting Cashier role or create Branch Manager." | **Rejected.** Four independent roles; no Branch Manager role exists (D-41). |
| **Online Operations** | "Implement payment gateway settlement and Fawry bill clearing." | **Rejected.** Physical centers first; online operations deferred (D-42). |

---

## 4. Status of Open Architectural Policies

| Policy ID | Domain Area | Status | Authoritative Treatment in Batch 5 Deliverables |
| :--- | :--- | :---: | :--- |
| **`UP-701`** | Statutory Chart of Accounts Review | **OPEN** | Operational expense categories used; statutory account codes deferred. |
| **`UP-704`** | Teacher Compensation Qualifying Base | **OPEN** | Fail-closed: Cash disbursements cannot deduct teacher percentages from student cash receipts. |
| **`UP-705`** | Cashbox Discrepancy Sign-Off & Tolerances | **OPEN** | Fail-closed: Differences (e.g. CB-03 -150 EGP) locked in `DISCREPANCY_PENDING_INVESTIGATION`. Zero write-offs, zero employee pay deductions, zero balancing journals. |
| **`UP-706`** | Student Refund Formula & Legal Review | **OPEN** | Fail-closed: Cash disbursements for student refunds require authorized legal dossiers; zero automated cashbox refunds. |
| **`UP-710`** | Financial Period Close & Reopening Controls| **OPEN** | Daily shift counts and end-of-day reconciliations recorded without irreversible ledger locking. |
| **`UP-711`** | Opening Balances & Legacy Migration | **OPEN** | Historical opening cashbox balances are pending source verification and reconciliation. |

