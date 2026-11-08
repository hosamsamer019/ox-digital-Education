# PHASE 7.0 — CONSOLIDATED APPROVED PRODUCT OWNER DECISIONS
**Product:** OX-DIGITAL Education  
**Workspace:** `D:\OX-DIGITAL\Mathe\OX-DIGITAL-GITHUB`  
**Repository:** `https://github.com/hosamsamer019/ox-digital-Education.git`  
**Date:** November 2026  
**Status:** ALL 15 DECISIONS FORMALLY APPROVED BY PRODUCT OWNER (OD-701 THROUGH OD-715)

---

## 1. Executive Summary & Governance Scope

This document provides the definitive, authoritative record of all **15 Product Owner Decisions (OD-701 through OD-715)** for the financial architecture and accounting system of OX-DIGITAL Education.

Every decision in this register has been reviewed and formally **APPROVED** by the Product Owner.

### Core Architectural Principles
1. **Strict Financial Domain Separation:** Absolute decoupling between OX-DIGITAL SaaS commercial finance (Domain A) and each educational institution's internal financial management (Domain B). Student fees never become platform revenue.
2. **Centralized Institutional Governance:** Exactly one primary manager per institution holding ultimate authority over pricing catalogs, branch lifecycles, and financial policies.
3. **Unified Ledger with Branch Dimensions:** One institution-wide general ledger per institution, with dimensional branch attribution on journal lines, supporting both consolidated and branch-level reporting.
4. **Accrual Basis & Progressive Revenue Recognition:** Financial reporting strictly follows accrual accounting; subscription revenues are recognized progressively over service terms; session packages are earned as delivered.
5. **Non-Destructive Accounting & Immutable Auditability:** Financial records are permanent. Deletions are forbidden; corrections are made solely via reversing journals or credit adjustments.

> [!NOTE]
> **Illustrative Account Numbers Notice:**
> Account codes appearing in technical architecture blueprints and previous design examples (e.g., `1110`, `2131`, `4110`) are **purely illustrative**. The final statutory Chart of Accounts numbering scheme will be established during implementation.

---

## 2. Consolidated Decision Matrix (OD-701 through OD-715)

| ID | Decision Title | Category | Approval Status | Summary Policy |
| :--- | :--- | :--- | :--- | :--- |
| **OD-701** | Institution Governance | Governance | **APPROVED** | Exactly 1 primary manager per institution; institution is tenant root; single & multi-branch support; auto-provisioned default branch; subordinate branch roles; centralized pricing. |
| **OD-702** | Financial Domain Separation | Commercial Billing | **APPROVED** | Strict separation: Domain A (SaaS vendor) vs. Domain B (Institution). Independent COAs & GLs. Student tuition is never platform revenue. No shared balances or automatic settlement. |
| **OD-703** | Unified Institutional General Ledger | General Ledger | **APPROVED** | Exactly 1 GL per institution with branch dimensions on journal lines. Branch-attributable revenue, expenses, cash, and P&L. Dedicated Online branch dimension. |
| **OD-704** | Accrual Accounting Basis | Financial Reporting | **APPROVED** | Accrual accounting as institutional standard. Revenue recognized when earned, expenses when incurred. Receivables and payables tracked. Income statement, balance sheet, and cash flow. |
| **OD-705** | Online Subscription Revenue Recognition | Revenue Engine | **APPROVED** | Progressive recognition over service term. Future periods held as deferred revenue liabilities. Transfer earned portions periodically. |
| **OD-706** | Physical Center Attendance Billing | Center Operations | **APPROVED** | Prepaid session packages centrally priced. Attendance consumes 1 session. Sessions linked to branch, group, teacher, student. |
| **OD-707** | Teacher Compensation | Payroll & HR | **APPROVED** | 4 manager-selected compensation models (salary, per lesson, per student, % revenue). Branch-attributed monthly statements. Cancelled lessons not payable. |
| **OD-708** | Refunds & Student Withdrawal | Accounts Receivable | **APPROVED** | Prorated by service type. Requires recorded reason and manager approval. Non-destructive reversals/adjustments only; never delete financial transactions. |
| **OD-709** | Financial Approval Authority | Security & Audit | **APPROVED** | Primary manager retains final authority. Configurable delegated approval limits per institution. Audit history on permission changes and transactions. |
| **OD-710** | Financial Period Closing | General Ledger | **APPROVED** | Monthly close with pre-close checklist. Closed periods locked against edits/deletions. Reopening requires primary manager approval with audit log. |
| **OD-711** | Opening Balances & Legacy Migration | Data Integrity | **APPROVED** | Balanced opening entries at defined start date. Preserve source balance provenance. Never fabricate synthetic historical transactions for missing data. |
| **OD-712** | Currency Policy | Treasury & Bank | **APPROVED** | EGP default base currency. Optional secondary currencies with recorded exchange rate, date, and source. GL records EGP equivalent and exchange differences. |
| **OD-713** | Legal Entity Structure | Corporate Structure | **APPROVED** | Default: 1 legal entity per institution. Multi-entity group support where each entity has its own GL, accounts, and tax reporting. Multi-branch within an entity. |
| **OD-714** | Electronic Invoicing & Tax Compliance | Tax & Compliance | **APPROVED** | Architecture prepared for Egypt ETA e-invoice/e-receipt. Store tax IDs and document lifecycle states. Real-time submission disabled until officially integrated. |
| **OD-715** | Cashbox Discrepancies | Cash Management | **APPROVED** | Shift close compares expected vs. actual. Shortages/overages recorded as discrepancies, not auto-classified. Requires explanation and manager approval. |

---

## 3. Comprehensive Specifications of Approved Decisions

### OD-701 — Institution Governance
* **Status:** **APPROVED BY PRODUCT OWNER**
* **Approved Policy:**
  - Exactly **one primary institution owner/manager** per educational institution.
  - The `Institution` entity serves as the absolute **tenant root** (`institutionId`).
  - **Strict Inter-Institution Isolation:** No data, accounts, student records, or financial information are shared between institutions.
  - The primary manager controls the entire institution, its branches, operations, and policies.
  - **Single & Multi-Branch Support:** Single-branch institutions must operate seamlessly without unnecessary multi-branch administrative overhead. When an institution is provisioned, a default branch (`isDefault = true`) is automatically created.
  - **Subordinate Operational Roles:** Branch cashiers, receptionists, and accountants remain strictly subordinate to the primary manager. No independent branch ownership exists by default.
  - **Centralized Control:** Central pricing catalog, subscription pricing, branch creation/lifecycle, and institution-wide staff administration are governed centrally.
  - **Consolidated & Dimensional Reporting:** Primary manager has access to both consolidated institution-wide financial reports and branch-specific performance reports.
  - **Online Branch Dimension:** Online/head-office operations must be assigned to an explicit **Online Branch Dimension** (`isOnline = true`).
* **Unresolved Details:** None. Core governance model is finalized.

---

### OD-702 — Financial Domain Separation
* **Status:** **APPROVED BY PRODUCT OWNER**
* **Approved Policy:**
  Maintain two strictly separated financial domains:
  1. **Domain A — OX-DIGITAL SaaS Commercial Finance:**
     - Vendor entity maintaining its own Chart of Accounts and General Ledger.
     - Records institutional licensing fees, platform seat subscriptions, and SaaS hosting revenue.
     - Records platform infrastructure expenses and institutional receivables.
     - **Strict Revenue Prohibition:** Student tuition, course subscriptions, and center cash collections must **NEVER** become OX-DIGITAL platform revenue.
  2. **Domain B — Educational Institution Internal Finance:**
     - Each educational institution maintains an isolated financial ledger and Chart of Accounts.
     - Records student tuition, lesson fees, cashboxes, center operating expenses, and teacher compensation.
     - Must never share financial records, cash accounts, or balances with another institution.
  3. **No Automatic Ledger Merging or Settlement:**
     - Inter-domain automatic settlement, balance netting, or ledger merging is **strictly forbidden**.
     - Contractual transactions between OX-DIGITAL and an institution (e.g., monthly software license bills) are recorded independently in both ledgers (as an AR invoice in Domain A and an AP bill in Domain B).
* **Unresolved Details:** Specific payment gateway merchant account routing (platform merchant vs. school direct merchant credentials) to be mapped during Phase 7.3.

---

### OD-703 — Unified Institutional General Ledger
* **Status:** **APPROVED BY PRODUCT OWNER**
* **Approved Policy:**
  - Exactly **ONE unified General Ledger** per educational institution.
  - Journal lines carry attributable **branch dimensions / cost centers** (`branchId`).
  - Provides separately attributable branch-level reporting for:
    - Revenue.
    - Collections.
    - Outstanding receivables.
    - Operating expenses.
    - Cashboxes and cashier shifts.
    - Teacher compensation.
    - Branch P&L and performance.
  - Provides consolidated institutional reporting for the primary manager across all branches.
  - Explicit **Online/head-office branch dimension** ensures digital services are dimensionally accounted for.
* **Unresolved Details:** None. Architecture is established.

---

### OD-704 — Accrual Accounting Basis
* **Status:** **APPROVED BY PRODUCT OWNER**
* **Approved Policy:**
  - **Accrual accounting** is the mandatory institutional accounting basis.
  - Revenue is recognized when **earned** (service delivered), and expenses are recognized when **incurred** (benefit received), rather than merely when cash changes hands.
  - Full Accounts Receivable (AR) and Accounts Payable (AP) sub-ledgers.
  - Reporting engine generates Income Statement (P&L), Balance Sheet, and an automated Cash Flow Statement.
* **Approved Example:**
  - If a student enrolls for a course with an agreed fee of 1,000 EGP, and pays 600 EGP cash at registration:
    - Earned/Invoiced: 1,000 EGP.
    - Cash Collected: 600 EGP.
    - Outstanding Receivable: 400 EGP.
* **Unresolved Details:** Specific revenue recognition trigger rules per service type (detailed in OD-705 and OD-706).

---

### OD-705 — Online Subscription Revenue Recognition
* **Status:** **APPROVED BY PRODUCT OWNER**
* **Approved Policy:**
  - Online subscription revenue is recognized **progressively over the service term**.
  - Amounts received relating to future service periods are held on the balance sheet as **Deferred / Unearned Revenue liabilities**.
  - The system periodically transfers earned portions from Deferred Revenue to Earned Revenue over the service term.
* **Approved Example:**
  - A student pays 1,200 EGP upfront for a 12-month online course access:
    - Day 1: 1,200 EGP recorded in Cash/Gateway Transit; 1,200 EGP recorded in Deferred Revenue (Liability).
    - Monthly: 100 EGP transferred from Deferred Revenue to Recognized Online Revenue each month.
* **Unresolved Details:**
  - Exact frequency of amortization job (daily pro-rata linear amortization vs. monthly calendar-day batch).
  - Cancellation, mid-term refund, and account-pause revenue treatment rules to follow detailed withdrawal policies.

---

### OD-706 — Physical Center Attendance Billing
* **Status:** **APPROVED BY PRODUCT OWNER**
* **Approved Policy:**
  - Support **prepaid session packages** for physical centers.
  - Primary manager centrally defines package prices, validity, and session counts.
  - Student enrollment creates an agreed financial obligation (invoiced receivable).
  - Cash or gateway collections update paid amounts and reduce outstanding receivables.
  - Actual physical attendance consumes **one session credit**.
  - Every session must be linked to **branch, center group, teacher, and student**.
  - Provides real-time visibility into student balance, session consumption, remaining sessions, and branch revenue attribution.
* **Explicitly Unresolved Details (Pending Detailed Policy):**
  - **Absence Policy:** Does an unexcused absence consume a session credit or preserve the credit? (Requires Product Owner policy selection before Phase 7.3).
  - **Session Expiration / Cancellation:** What happens to unused session credits if a student withdraws or a semester ends?

---

### OD-707 — Teacher Compensation
* **Status:** **APPROVED BY PRODUCT OWNER**
* **Approved Policy:**
  Support four primary manager-selected compensation models:
  1. **Fixed Monthly Salary:** Fixed amount per pay period regardless of lesson count.
  2. **Per Completed Lesson:** Fixed fee per verified delivered session.
  3. **Per Qualifying Student:** Unit rate per student attending/enrolled.
  4. **Percentage of Group/Course Revenue:** Agreed revenue share percentage.
  - Support branch attribution for all compensation lines.
  - Generate monthly compensation statements per educator.
  - Support tracking of advances, deductions, and performance bonuses.
  - Maintain teacher contract effective dates and contract revision history.
  - **Lesson Cancellation Rule:** Cancelled or unperformed lessons are strictly **not payable**.
* **Explicitly Unresolved Details (Pending Detailed Policy):**
  - **Qualifying Student Definition:** Does "qualifying student" mean all registered students, students with zero overdue balance, or only physically attending students on the roster?
  - **Revenue Calculation Base:** For percentage-based compensation, is the percentage calculated on *gross billed invoices*, *net cash collected*, or *recognized earned revenue* (net of discounts/refunds)?

---

### OD-708 — Refunds and Student Withdrawal
* **Status:** **APPROVED BY PRODUCT OWNER**
* **Approved Policy:**
  - Refund policies vary by educational service type:
    - *Online Subscriptions:* Prorated based on the unused/unconsumed portion of the service term, subject to withdrawal terms.
    - *Prepaid Session Packages:* Deduct the value of used/consumed sessions at standard unit rates.
    - *Monthly Subscriptions:* Calculate based on the service period actually delivered.
    - *Unpaid Receivables:* Cancelled or settled according to the authorized withdrawal reason.
  - **Non-Destructive Accounting:** Financial transactions are **never deleted**. Refunds are recorded strictly through credit notes, debit adjustments, or reversal entries.
  - Support both partial and full refunds.
  - Every refund requires a **recorded reason code and primary manager (or authorized delegate) approval**.
* **Explicitly Unresolved Details (Pending Detailed Policy):**
  - Detailed refund formulas, administrative fee deduction amounts (e.g. non-refundable deposit / gateway fee deduction), and refund request deadlines (e.g. within 14 days of enrollment).

---

### OD-709 — Financial Approval Authority
* **Status:** **APPROVED BY PRODUCT OWNER**
* **Approved Policy:**
  - Primary institution manager retains **final institutional authority** over all financial operations.
  - Delegated financial roles and approval thresholds are **configurable per institution**.
  - Cashiers, branch accountants, and branch managers receive only explicitly assigned permissions.
  - The system enforces configured approval limits (e.g., maximum refund or discount amount).
  - Every financial transaction records operator ID, approver ID, and immutable timestamps.
  - System preserves full audit history of all permission grants and changes.
  - Approved financial transactions must not be altered or deleted; corrections require approved reversal journals.
* **Unresolved Details:** Default approval threshold tiers to be configured during Phase 7.7 security implementation.

---

### OD-710 — Financial Period Closing
* **Status:** **APPROVED BY PRODUCT OWNER**
* **Approved Policy:**
  - Support **monthly financial period closing**.
  - Pre-close review screen covering cashboxes, bank accounts, receivables, payables, and operating expenses.
  - **Strict Period Locking:** Once closed, the system strictly prevents editing or deletion of approved entries in that period.
  - Corrections after closing must be recorded in an **open period**, with an explicit reference to the original closed period.
  - Period reopening requires **primary manager approval and a recorded statutory reason**.
  - Preserves comprehensive audit logs of all closing and reopening actions.
* **Unresolved Details:** None. Governance procedure is finalized.

---

### OD-711 — Opening Balances and Legacy Migration
* **Status:** **APPROVED BY PRODUCT OWNER**
* **Approved Policy:**
  - Support opening balance entry when an institution starts using the financial system.
  - Covers: cashboxes, bank accounts, student receivables, supplier payables, teacher payables, fixed assets, liabilities, and retained equity.
  - Requires defining a formal **financial system start date (cutover date)**.
  - Automatically generates **balanced opening entries** (`Debits == Credits`).
  - Preserves source document attachments and balance provenance.
  - Records the operator who entered and the manager who approved each opening balance.
  - **Historical Integrity Rule:** **Never fabricate synthetic historical transactions** to compensate for missing legacy data; past activity prior to the cutover date is consolidated into opening balances.
* **Unresolved Details:** None. Migration methodology is established.

---

### OD-712 — Currency Policy
* **Status:** **APPROVED BY PRODUCT OWNER**
* **Approved Policy:**
  - **Egyptian Pound (EGP)** is the default base currency for Egyptian institutions.
  - Additional transaction currencies (USD, EUR, SAR, AED) are supported as optional.
  - Transactions preserve original transaction currency and amount.
  - The system records the exchange rate, rate date, and exchange rate source.
  - The General Ledger records the EGP equivalent for all foreign currency entries.
  - Supports standard accounting treatment for realized and unrealized foreign exchange differences.
  - Changing an institution's base currency after financial activity has begun requires a controlled, approved administrative migration process.
* **Explicitly Unresolved Details (Pending Detailed Policy):**
  - Approved exchange-rate feed source (e.g., Central Bank of Egypt official rates vs. payment gateway settlement rate).
  - Policy for posting realized foreign exchange gain/loss on international credit card settlements.

---

### OD-713 — Legal Entity Structure
* **Status:** **APPROVED BY PRODUCT OWNER**
* **Approved Policy:**
  - **Default Configuration:** Exactly one educational institution operating under one legal entity.
  - **Educational Groups:** Support multi-entity holding groups containing multiple independent legal entities.
  - Each legal entity possesses its own independent General Ledger, Chart of Accounts, financial reports, and tax identification.
  - One legal entity may operate **multiple physical and online branches**.
  - Maintains strict financial and data isolation between different legal entities.
  - Ledgers and balances are **never automatically merged**.
  - Commercial transactions between entities within a group are recorded independently as arm's-length intercompany transactions in each entity's books.
* **Unresolved Details:** Multi-entity holding consolidation dashboards deferred to post-Phase 7 enterprise roadmap.

---

### OD-714 — Electronic Invoicing and Tax Compliance
* **Status:** **APPROVED BY PRODUCT OWNER**
* **Approved Policy:**
  - Architecture prepared for future integration with the **Egyptian Tax Authority (ETA)** electronic invoice and electronic receipt systems.
  - Data schema stores legal entity tax registration number, commercial register, and activity codes.
  - Supports documents: invoices, credit notes, debit notes, and consumer receipts.
  - Prepares document lifecycle states: `CREATED`, `PENDING_SUBMISSION`, `SUBMITTED`, `ACCEPTED`, `REJECTED`.
  - Preserves official UUIDs, submission timestamps, and response payloads when integration is enabled.
  - **Non-Execution Gate:** **Do NOT enable live tax submission** in the current phase.
  - **Compliance Boundary:** Do NOT claim official tax compliance or tax approval until official ETA sandbox integration and certified hardware/token requirements are satisfied.
* **Explicitly Unresolved Details (Pending Detailed Policy):**
  - Specific ETA intermediary API provider selection (direct ETA API vs. certified e-invoicing aggregator).
  - Tax classification mapping per course category (e.g., educational VAT exempt vs. standard rate commercial services).

---

### OD-715 — Cashbox Discrepancies
* **Status:** **APPROVED BY PRODUCT OWNER**
* **Approved Policy:**
  - Daily shift closing compares expected system cash with actual physical cash counted.
  - Shortages and overages are recorded as **separate cash discrepancies**.
  - **No Automatic Reclassification:** Discrepancies are **NOT** automatically classified as revenue or expenses at the moment of count.
  - The cashier must provide a written explanation for the discrepancy.
  - Resolving a discrepancy requires approval by the **primary manager or an authorized delegate**.
  - Full audit history of the shift, discrepancy, explanation, and approval is preserved.
  - The appropriate accounting impact (posting to Cash Shortage Expense or Overage Income) is recorded **only after formal approval** and in accordance with institutional policy.
* **Unresolved Details:** Threshold for mandatory secondary executive escalation on large cash discrepancies (to be set in Phase 7.4).

---

## 4. Unresolved Policy Register (Open Implementation Items)

The following items are explicitly recorded as **OPEN IMPLEMENTATION POLICIES** to be resolved prior to their respective implementation sprints:

| Policy Item | Related Decision | Open Question / Decision Needed | Target Phase |
| :--- | :--- | :--- | :--- |
| **Attendance Absence Consumption** | OD-706 | Does student absence consume a prepaid session credit, or is consumption strictly gated on `PRESENT` status? | Phase 7.3 |
| **Session Credit Expiration** | OD-706 | What is the policy for unused session credits when an academic term ends? | Phase 7.3 |
| **Qualifying Student Base** | OD-707 | For teacher per-student pay, does "qualifying student" require physical attendance, active enrollment, or full fee settlement? | Phase 7.5 |
| **Revenue Share Calculation Base** | OD-707 | For teacher revenue share, is the percentage calculated on gross invoiced tuition, net cash collected, or recognized earned revenue? | Phase 7.5 |
| **Refund Formulas & Timeframes** | OD-708 | What are the exact administrative deduction percentages and grace periods for student withdrawals? | Phase 7.3 |
| **Exchange Rate Data Source** | OD-712 | What is the authoritative exchange rate feed (Central Bank of Egypt vs. Gateway settlement rate)? | Phase 7.3 |
| **ETA Submission Prerequisites** | OD-714 | Which ETA integration mode (direct e-Receipt API vs. certified POS device) will be selected for physical centers? | Phase 7.7 |

---

## 5. Implementation Roadmap Status Confirmation

All 15 Product Owner decisions are formally **APPROVED**. However, in strict accordance with engineering governance:

> [!IMPORTANT]
> **Implementation Status Notice:**
> Approving product decisions does **NOT** mean implementation has started.
> All engineering phases (**Phase 7.1 through Phase 7.7**) remain **PLANNED AND NOT STARTED**.
> Implementation of Phase 7.1 requires separate, explicit authorization from the Product Owner.

