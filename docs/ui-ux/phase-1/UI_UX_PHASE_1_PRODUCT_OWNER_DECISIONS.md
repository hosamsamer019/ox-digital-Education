# OX-DIGITAL Education — UI/UX Design Track — Phase 1
# Document 8: Unresolved Product Owner Decisions Register
**Document ID:** `UI_UX_PHASE_1_PRODUCT_OWNER_DECISIONS`  
**Status:** REVISED & ALIGNED — READY FOR PRODUCT OWNER REVIEW  
**Date:** 2026-11-03  
**Workspace:** `D:\OX-DIGITAL\Mathe\OX-DIGITAL-GITHUB`  
**Classification:** Policy Governance & Decision Register  

---

## 1. Governance Principles & Policy Separation

In strict adherence to the project governance framework, the UI/UX design track does not approve commercial policies, invent accounting rules, assume approval thresholds, or silently introduce default business decisions.

To maintain architectural integrity, this document explicitly separates:
1. **Approved Baseline Policies:** Authoritative rules already decided and locked by the Product Owner (e.g. `OD-701`, `OD-718`, `OD-725`).
2. **Unresolved Policy Gates:** Formal policy items that remain open, fail-closed, or subject to specialist review (e.g. `UP-704`, `UP-705`, `UP-706`).
3. **Proposed UI/UX Options & Recommendations:** Neutral interface alternatives designed to accommodate business decisions once made. **No recommendation is presented as an approved decision.**

---

## 2. Decision Register

### Decision POD-UI-01: Cashbox Discrepancy Resolution Workflow
- **Related Unresolved Policy ID:** `UP-705` (Cashbox Daily Closing Discrepancy Handling) — **UNRESOLVED / FAIL-CLOSED**.
- **Existing Approved Policy Baseline:**
  - Automated shortage write-offs and automated surplus income recognitions are strictly barred.
  - Zero discrepancy tolerance: any non-zero difference between physical cash count and system expected balance forces reconciliation status to `DISCREPANCY_PENDING_INVESTIGATION`.
  - Day N+1 opening balance is hard-locked to Day N actual physical closing count.
- **Unresolved Policy Question:**
  When a cashbox closes with status `DISCREPANCY_PENDING_INVESTIGATION`, what formal policy and accounting mechanism clears the investigative flag, and who is authorized to execute it?
- **Strict UI/UX Boundary:**
  - **No automated write-offs or surplus recognition are approved.**
  - **No non-zero discrepancy threshold is approved.**
  - **No mandatory dual approval for every non-zero difference is approved as policy.**
  - **The UI specifies only the pending-investigation and review states supported by current policy.**
- **Neutral Options for Product Owner Decision (Recommendations Only):**
  - **Option A (Formal Primary Manager Balancing Voucher):** Provide a dedicated "Record Discrepancy Resolution Voucher" modal accessible strictly to the Primary Manager, requiring a documented incident reference, debiting a dedicated loss/receivable account, and crediting the cashbox register.
  - **Option B (Employee Liability Deduction):** Provide an action that attributes the shortage as an active receivable against the responsible cashier/staff member, deducted from their next payroll disbursement.
  - **Option C (Permanent Audit Flag / No In-App Clearing):** The cashbox reconciliation record permanently preserves `DISCREPANCY_PENDING_INVESTIGATION`. Day N+1 operates on actual counted cash. Financial adjustments are handled exclusively through periodic manual general ledger entries.

---

### Decision POD-UI-02: Teacher Variable Compensation Calculation Base
- **Related Unresolved Policy ID:** `UP-704` (Teacher Variable Revenue Share Base) — **UNRESOLVED / FAIL-CLOSED**.
- **Existing Approved Policy Baseline:**
  - Calculating variable revenue-sharing percentages is blocked fail-closed pending written Product Owner approval of the exact mathematical base.
  - Fixed compensation models (e.g. fixed monthly salary, fixed amount per delivered session) are permissible and verifiable.
- **Unresolved Policy Question:**
  What is the qualifying mathematical base for variable teacher compensation?
- **Strict UI/UX Boundary:**
  - **Neither Earned Delivered Revenue nor Collected Cash is selected as the approved base.**
  - **The calculation method remains strictly configurable at the specification level without inventing a default.**
- **Neutral Options for Product Owner Decision (Recommendations Only):**
  - **Option A (Fixed Units Only in Initial UI):** Restrict initial compensation UI (`TCOMP-PREP-01`, `TCH-DUES-01`) strictly to verified fixed models:
    1. Fixed Monthly Salary (in EGP).
    2. Fixed Rate Per Completed Lesson (e.g. fixed EGP per lesson delivered).
    Variable percentage models remain hidden/disabled until written policy is approved.
  - **Option B (Percentage of Allocated Cash Collected):** Configure variable share as an agreed percentage of actual cash collections allocated to that group's obligations in the student sub-ledger.
  - **Option C (Percentage of Accrual Earned Revenue):** Configure variable share as an agreed percentage of recognized tuition earned via certified educational delivery evidence pairing.
  - **Option D (Configurable Hybrid Model):** Allow the Primary Manager to configure the qualifying base per teacher contract (Cash-based or Accrual-based) with explicit audit logging.

---

### Decision POD-UI-03: Student Withdrawal & Refund Settlement Policy
- **Related Unresolved Policy ID:** `UP-706` (Student Withdrawal & Refund Policy) — **UNRESOLVED / SUBJECT TO SPECIALIST & LEGAL REVIEW**.
- **Existing Approved Policy Baseline:**
  - Automated refund disbursement from frontline tills is blocked fail-closed.
  - Student withdrawal preserves 100% of historical financial records, receipts, and allocations in an append-only state.
- **Unresolved Policy Question:**
  Are refunds permitted upon student withdrawal, and if so, what formula determines refundable versus non-refundable balances?
- **Strict UI/UX Boundary:**
  - **Neither refund calculation method (delivered pro-rata vs milestone pro-rata) is approved.**
  - **The UI represents refund requests, review, approval, and adjustment as distinct decoupled states without committing to a mathematical formula.**
- **Neutral Options for Product Owner Decision (Recommendations Only):**
  - **Option A (No System Refund Disbursement):** Withdrawn student record remains locked. Unallocated funds remain as deferred liability on the student sub-ledger card; any financial refund is processed manually outside the application.
  - **Option B (Delivered-Session Pro-Rata Formula):** System computes refundable amount based on delivered lessons:
    $$\text{Refundable} = \text{Total Collections} - (\text{Delivered Lessons} \times \text{Unit Rate}) - \text{Non-Refundable Fee}$$
    Requires Product Owner definition of non-refundable administrative fee policies.
  - **Option C (Discretionary Refund Voucher):** The refund amount is entered manually by the Accountant, supported by an uploaded signed guardian agreement, requiring explicit Primary Manager approval before disbursement.

---

### Decision POD-UI-04: Collection & Access Reactivation on Financially Suspended Students
- **Related Operational Policy:** Student Financial Suspension, Collections, and Educational Access Reactivation.
- **Existing Approved Policy Baseline:**
  - Administrative/financial suspension restricts student attendance and classroom access.
- **Unresolved Policy Question:**
  Can a frontline cashier accept fee payments from a suspended student, and does payment trigger educational access reactivation?
- **Strict UI/UX Boundary:**
  - **Payment does NOT automatically reactivate educational access.**
  - **Financial suspension, collection, review, and access reactivation are modeled as separate states.**
  - **Reactivation must follow an authorized policy and explicit permission.**
- **Neutral Options for Product Owner Decision (Recommendations Only):**
  - **Option A (Permit Collection, Manual Reactivation Review):** Cashier desk (`CSH-DESK-01`) permits fee collection with an amber advisory banner (`طالب موقوف مالياً`). Receipt issuance logs collection but keeps suspension active. A notification is routed to the Primary Manager to review and manually authorize access reactivation.
  - **Option B (Hard Block on Cashier Terminal):** The cashier terminal blocks collections for suspended students entirely, prompting the cashier to direct the guardian to the administration office.
  - **Option C (Conditional Policy-Based Reactivation):** If approved by future policy, payment of 100% of overdue obligations automatically transitions status to `PENDING_REACTIVATION_CONFIRMATION` for teacher/system awareness.

---

### Decision POD-UI-05: Receipt Output Format & Hardware Specification
- **Related Operational Policy:** Frontline Receipt Hardware & Document Generation Standards.
- **Existing Approved Policy Baseline:**
  - Frontline collections require an official receipt document with unique receipt number, cashier identity, cashbox till ID, timestamp, and audit hash.
- **Status of Formats:**
  - **80mm Thermal Roll and A4 PDF are proposed output options, NOT approved defaults.**
- **Operational Implications for Product Owner Review:**
  - **80mm Thermal Slip Option:**
    - *Operational Advantages:* Rapid print cycle (1–2 seconds), minimal desk footprint, low paper roll cost, highly suitable for peak reception traffic.
    - *Hardware & Technical Constraints:* Requires ESC/POS thermal printer driver integration or browser raw print configuration; thermal paper fades over time (unsuitable for multi-year physical archiving).
  - **Standard A4 PDF Option:**
    - *Operational Advantages:* Formal corporate document, comprehensive layout showing full student schedule and sub-ledger status, archival longevity, standard office laser/inkjet printer compatible.
    - *Hardware & Technical Constraints:* Slower print cycle (5–10 seconds), higher paper/toner costs, creates customer queues during peak registration hours.
  - **Dual-Mode Architecture (Proposed Recommendation):**
    - Cashier Terminal (`CSH-DESK-01`) defaults to 80mm thermal receipt with an optional "Print A4 Statement" toggle.
    - Accountant Workspace (`STU-FIN-01`) defaults to formal A4 financial statement export.

---

## 3. Summary of Decision Statuses

| Decision ID | Topic | Related Policy ID | Status | Approved Action |
| :--- | :--- | :---: | :---: | :--- |
| **POD-UI-01** | Cashbox Discrepancy Resolution | `UP-705` | **UNRESOLVED** | Model pending-investigation and review states only; zero automated write-offs or thresholds. |
| **POD-UI-02** | Teacher Variable Compensation Base | `UP-704` | **UNRESOLVED** | Keep calculation method configurable; do not select a default base. Fixed models permitted. |
| **POD-UI-03** | Student Withdrawal Refund Formula | `UP-706` | **UNRESOLVED** | Model request, review, and approval states only; do not commit to a refund calculation formula. |
| **POD-UI-04** | Suspended Student Collections & Access | Operational | **UNRESOLVED** | Separate collection from reactivation; payment does not automatically restore access. |
| **POD-UI-05** | Receipt Printing Hardware Standard | Operational | **PROPOSED OPTIONS** | Document operational implications of 80mm vs A4 for Product Owner selection. |
