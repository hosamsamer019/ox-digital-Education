# PHASE 7.0 — PRODUCT OWNER DECISIONS REGISTER
**Product:** OX-DIGITAL Education  
**Workspace:** `D:\OX-DIGITAL\Mathe\OX-DIGITAL-GITHUB`  
**Repository:** `https://github.com/hosamsamer019/ox-digital-Education.git`  
**Audit Date:** November 2026 (Updated Consolidated Approval)  
**Status:** ALL 15 DECISIONS FORMALLY APPROVED BY PRODUCT OWNER (OD-701 THROUGH OD-715)

---

## 1. Governance Preamble

In statutory accounting and financial software development, engineering teams are strictly prohibited from making unilateral assumptions regarding tax compliance, revenue recognition, legal entity separation, or payroll liability rules. 

Every policy choice in this register directly impacts statutory balance sheets, tax audits, teacher trust, and cash security. 

The Product Owner has formally reviewed and **APPROVED ALL 15 DECISIONS (OD-701 through OD-715)**.

> [!NOTE]
> **Illustrative Account Numbers Notice:**
> Account numbers appearing in previous blueprints, schemas, and design examples (e.g., `1110`, `2131`, `4110`) are **purely illustrative**, not approved final statutory account numbers. Final account codes will be formalized in the Chart of Accounts implementation.

---

## 2. Decision Register Matrix

| ID | Title | Domain Impact | Approved Policy Summary | Status |
| :--- | :--- | :--- | :--- | :--- |
| **OD-701** | Institution Governance | Governance | Exactly 1 primary manager per institution; institution is tenant root; single & multi-branch support; auto-provisioned default branch; subordinate branch roles; centralized pricing. | **APPROVED BY PRODUCT OWNER** |
| **OD-702** | Financial Domain Separation | Commercial Billing | Strict separation between Domain A (SaaS vendor) and Domain B (Institution). Independent COAs & GLs. Student tuition is never platform revenue. No shared balances or automatic settlement. | **APPROVED BY PRODUCT OWNER** |
| **OD-703** | Unified Institutional General Ledger | General Ledger | Exactly 1 GL per institution with branch dimensions on journal lines. Branch-attributable revenue, expenses, cash, and P&L. Dedicated Online branch dimension. | **APPROVED BY PRODUCT OWNER** |
| **OD-704** | Accrual Accounting Basis | Financial Reporting | Accrual accounting as institutional standard. Revenue recognized when earned, expenses when incurred. Receivables and payables tracked. Income statement, balance sheet, and cash flow. | **APPROVED BY PRODUCT OWNER** |
| **OD-705** | Online Subscription Revenue Recognition | Revenue Engine | Progressive recognition over service term. Future periods held as deferred revenue liabilities. Transfer earned portions periodically. | **APPROVED BY PRODUCT OWNER** |
| **OD-706** | Physical Center Attendance Billing | Center Operations | Prepaid session packages centrally priced. Attendance consumes 1 session. Sessions linked to branch, group, teacher, student. | **APPROVED BY PRODUCT OWNER** |
| **OD-707** | Teacher Compensation | Payroll & HR | 4 manager-selected compensation models (salary, per lesson, per student, % revenue). Branch-attributed monthly statements. Cancelled lessons not payable. | **APPROVED BY PRODUCT OWNER** |
| **OD-708** | Refunds & Student Withdrawal | Accounts Receivable | Prorated by service type. Requires recorded reason and manager approval. Non-destructive reversals/adjustments only; never delete financial transactions. | **APPROVED BY PRODUCT OWNER** |
| **OD-709** | Financial Approval Authority | Security & Audit | Primary manager retains final authority. Configurable delegated approval limits per institution. Audit history on permission changes and transactions. | **APPROVED BY PRODUCT OWNER** |
| **OD-710** | Financial Period Closing | General Ledger | Monthly close with pre-close checklist. Closed periods locked against edits/deletions. Reopening requires primary manager approval with audit log. | **APPROVED BY PRODUCT OWNER** |
| **OD-711** | Opening Balances & Legacy Migration | Data Integrity | Balanced opening entries at defined start date. Preserve source balance provenance. Never fabricate synthetic historical transactions for missing data. | **APPROVED BY PRODUCT OWNER** |
| **OD-712** | Currency Policy | Treasury & Bank | EGP default base currency. Optional secondary currencies with recorded exchange rate, date, and source. GL records EGP equivalent and exchange differences. | **APPROVED BY PRODUCT OWNER** |
| **OD-713** | Legal Entity Structure | Corporate Structure | Default: 1 legal entity per institution. Multi-entity group support where each entity has its own GL, accounts, and tax reporting. Multi-branch within an entity. | **APPROVED BY PRODUCT OWNER** |
| **OD-714** | Electronic Invoicing & Tax Compliance | Tax & Compliance | Architecture prepared for Egypt ETA e-invoice/e-receipt. Store tax IDs and document lifecycle states. Real-time submission disabled until officially integrated. | **APPROVED BY PRODUCT OWNER** |
| **OD-715** | Cashbox Discrepancies | Cash Management | Shift close compares expected vs. actual. Shortages/overages recorded as discrepancies, not auto-classified. Requires explanation and manager approval. | **APPROVED BY PRODUCT OWNER** |
| **OD-716** | Cutover Architecture | Data Migration | Alternative B (Authoritative Full Offline Backfill). Live tables frozen under `EXCLUSIVE MODE` table locks; set-based backfills execute directly against authoritative state; eliminates CDC replay skew. | **APPROVED BY PRODUCT OWNER** |
| **OD-717** | Maintenance Window Approval | Operations & Cutover | Application write maintenance window approved in principle. Actual downtime duration must be empirically measured via representative Staging data volume benchmarks and an agreed operational schedule prior to production execution. | **APPROVED BY PRODUCT OWNER (IN PRINCIPLE)** |
| **OD-718** | Primary Manager Provisioning | Identity & Governance | Option 3B: Dedicated verified invitation process for Institution Primary Manager. Existing bootstrap administrator (`admin@edu.com`) remains strictly a separate SaaS Platform Super-Admin. | **APPROVED BY PRODUCT OWNER** |
| **OD-719** | Online Dimension Representation | General Ledger | Online dimension represented as a parameterized `Branch` record with `isOnline: true`, ensuring unified General Ledger accounting and dimensional attribution. | **APPROVED BY PRODUCT OWNER** |
| **OD-720** | Quarantine Data Retention | Data Integrity & Security | Option 7D: Indefinite cold archival. Diagnostic quarantine records and unresolvable assets preserved indefinitely; zero unsupported synthetic tenant assignment; zero destructive deletion. | **APPROVED BY PRODUCT OWNER** |

---

## 3. Detailed Specifications of Approved Decisions

### OD-701: Institution Governance
* **Status:** **APPROVED BY PRODUCT OWNER**
* **Approved Policy:**
  1. **Single Primary Manager:** Each educational institution has **exactly one primary institution owner/manager** (`primaryManagerId`).
  2. **Institution as Tenant Root:** The `Institution` entity represents the absolute tenant boundary (`institutionId`). Every ledger, account, invoice, payment, and branch belongs to an institution.
  3. **Strict Multi-Tenant Isolation:** Complete data, accounting, and operational isolation between different institutions is enforced at both the application middleware level and database row-level security.
  4. **Single-Branch & Multi-Branch Compatibility:** Single-branch institutions must function seamlessly without unnecessary multi-branch administrative overhead. When an institution is provisioned, a default primary branch (`isDefault = true`) is automatically established. Multi-branch institutions scale by adding branches under the primary manager.
  5. **Centralized Management Authority:** The primary manager retains exclusive institution-wide authority over pricing catalogs, online subscription pricing, physical center pricing, branch creation/management, financial policies, financial reports, accounting settings, and institution-wide staff.
  6. **Subordinate Operational Roles:** Branch cashiers, accountants, and staff remain strictly subordinate to the primary manager. No independent branch ownership exists by default.
  7. **Online Branch Dimension:** Online/head-office operations must be assigned to an explicit **Online Branch Dimension** (`isOnline = true`).

---

### OD-702: Financial Domain Separation
* **Status:** **APPROVED BY PRODUCT OWNER**
* **Approved Policy:**
  Maintain two strictly separated financial domains:
  1. **Domain A — OX-DIGITAL SaaS Commercial Finance:**
     - Maintains OX-DIGITAL's own Chart of Accounts and General Ledger.
     - Records institutional licensing and subscription revenue (B2B SaaS).
     - Records platform operating expenses, cloud hosting costs, and institutional receivables.
     - **Strict Revenue Boundary:** Does NOT record students' tuition, online subscriptions, or institutional branch cash collections as platform revenue.
  2. **Domain B — Institution Internal Financial Management:**
     - Each institution has its own completely isolated financial ledger and Chart of Accounts.
     - Records student subscriptions, tuition, collections, receivables, expenses, cashboxes, and teacher compensation.
     - Supports branch-level financial attribution and institution-wide consolidated reporting.
     - **Inter-Institution Isolation:** Must never share financial records, cash accounts, or balances with another institution.
  3. **No Merging of Ledgers & No Automatic Settlement:**
     - Inter-domain accounting integration, co-mingling of ledgers, or automatic balance offset/settlement mechanisms are **NOT approved**.
     - Any contractual transactions between OX-DIGITAL and an institution (e.g., SaaS licensing fees) must be explicitly modeled as standard arm's-length vendor/customer bills (an AP invoice in Domain B and an AR invoice in Domain A) without merging their accounting ledgers.

---

### OD-703: Unified Institutional General Ledger & Branch Dimensions
* **Status:** **APPROVED BY PRODUCT OWNER**
* **Approved Policy:**
  1. **Unified Institution General Ledger:** Exactly **ONE institution-wide general ledger** per institution. Independent general ledgers or separate legal entities are NOT created for each branch by default.
  2. **Branch Dimensions & Attribution:** Financial transactions carry an attributable `branchId`. Each branch has separately attributable:
     - Revenue.
     - Collections.
     - Outstanding receivables.
     - Operating expenses.
     - Cashboxes and cashier shifts.
     - Teacher compensation.
     - Branch financial performance reports.
  3. **Consolidated Reporting:** The primary manager can view full consolidated financial reports across all branches simultaneously, or filter down to any individual branch in a single click.
  4. **Explicit Online/Head-Office Branch Dimension:** Online services, digital courses, and online student subscriptions must be attributed to an explicit **Online/Head-Office Branch Dimension** (`isOnline = true`) so that 100% of institutional revenues are dimensionally accounted for.

---

### OD-704: Accrual Accounting Basis
* **Status:** **APPROVED BY PRODUCT OWNER**
* **Approved Policy:**
  1. **Accrual Accounting Standard:** Accrual accounting is the mandatory institutional accounting basis.
  2. **Revenue & Expense Recognition:** Revenue is recognized when **earned** (service delivered), and expenses are recognized when **incurred** (benefit received), rather than only when cash changes hands.
  3. **Receivables & Payables:** Full tracking of student receivables (AR) and vendor/teacher payables (AP).
  4. **Financial Reporting:** Engine generates Income Statement (P&L), Balance Sheet, and an automated Cash Flow Statement.
* **Approved Example:**
  - If a student enrolls for a course with an agreed fee of 1,000 EGP, and pays 600 EGP cash at registration:
    - Earned/Invoiced: 1,000 EGP.
    - Cash Collected: 600 EGP.
    - Outstanding Receivable: 400 EGP.

---

### OD-705: Online Subscription Revenue Recognition Policy
* **Status:** **APPROVED BY PRODUCT OWNER**
* **Approved Policy:**
  1. **Progressive Recognition:** Recognize subscription revenue progressively over the service period.
  2. **Deferred Revenue Liability:** Amounts relating to future service periods remain deferred revenue liabilities on the balance sheet.
  3. **Periodic Transfer:** Transfer earned portions to recognized revenue over the service term.
* **Approved Example:**
  - 1,200 EGP collected for a 12-month online course access:
    - 1,200 EGP initially placed in Deferred Revenue (Liability).
    - 100 EGP earned and recognized per month over the 12-month period.
* **Unresolved Policy Detail:** Cancellation, refund, and pause rules must follow separately approved policies.

---

### OD-706: Physical Center Attendance Billing Policy
* **Status:** **APPROVED BY PRODUCT OWNER**
* **Approved Policy:**
  1. **Prepaid Session Packages:** Support prepaid session packages for physical educational centers.
  2. **Central Pricing:** Primary manager centrally defines package prices and session counts.
  3. **Financial Obligation:** Student enrollment creates an agreed financial obligation (invoiced receivable).
  4. **Collection Tracking:** Collections update paid amounts and outstanding balances.
  5. **Attendance Consumption:** Actual physical attendance consumes **one session credit**.
  6. **Dimensional Linkage:** Every session must be linked to **branch, group, teacher, and student**.
  7. **Reporting Visibility:** Real-time visibility into student balance, session consumption, remaining sessions, and branch revenue attribution.
* **Explicitly Unresolved Details (Pending Detailed Policy):**
  - **Absence Policy:** Absence does NOT automatically consume a session until a separate policy is defined.
  - **Session Expiration:** Treatment of unused session credits upon term completion.

---

### OD-707: Teacher Compensation Policy
* **Status:** **APPROVED BY PRODUCT OWNER**
* **Approved Policy:**
  Support four primary manager-selected compensation models:
  1. **Fixed Monthly Salary:** Fixed amount per pay period.
  2. **Per Completed Lesson:** Fixed rate per verified delivered session.
  3. **Per Qualifying Student:** Unit rate per qualifying student.
  4. **Percentage of Group/Course Revenue:** Agreed revenue share percentage.
  - **Branch Attribution:** Compensation is attributed per branch facility.
  - **Statements:** Monthly compensation statements generated per educator.
  - **Adjustments:** Tracking of advances, deductions, and bonuses.
  - **Contract History:** Contract effective dates and historical changes preserved.
  - **Lesson Cancellation Rule:** Cancelled or unperformed lessons are strictly **not payable**.
* **Explicitly Unresolved Details (Pending Detailed Policy):**
  - **Qualifying Student Definition:** Exact counting rules for qualifying students (e.g. registered vs attending vs fully paid).
  - **Revenue Calculation Base:** Exact base for percentage-of-revenue calculation (gross billed vs cash collected vs earned revenue).

---

### OD-708: Refund & Student Withdrawal Policy
* **Status:** **APPROVED BY PRODUCT OWNER**
* **Approved Policy:**
  1. **Service-Specific Rules:**
     - *Online Subscriptions:* Unused/unconsumed portion, subject to withdrawal terms.
     - *Prepaid Session Packages:* Deduct the value of used sessions at standard rates.
     - *Monthly Subscriptions:* Calculate based on the service period actually delivered.
     - *Unpaid Receivables:* Cancel or settle according to withdrawal reason.
  2. **Non-Destructive Accounting:** Financial transactions are **never deleted**. Refunds are recorded through credit notes, debit adjustments, or reversal entries.
  3. **Governance:** Every refund requires a **recorded reason and primary manager approval** (or authorized delegate).
  4. **Flexibility:** Support partial and full refunds.
* **Explicitly Unresolved Details (Pending Detailed Policy):**
  - Detailed refund formulas, administrative fee deduction amounts, and withdrawal request deadlines.

---

### OD-709: Financial Approval Thresholds & Delegated Authority
* **Status:** **APPROVED BY PRODUCT OWNER**
* **Approved Policy:**
  1. **Ultimate Authority:** Primary institution manager retains final institutional authority.
  2. **Configurable Limits:** Delegated roles and approval limits are **configurable per institution**.
  3. **Role Scoping:** Cashiers, accountants, and branch managers receive only explicitly assigned permissions.
  4. **Limit Enforcement:** Enforce configured approval limits for refunds, discounts, and fee waivers.
  5. **Audit Logging:** Record the operator, approver, and timestamps for all sensitive actions.
  6. **Permission Provenance:** Preserve permission-change audit history.
  7. **Immutability:** Approved transactions must not be altered or deleted; corrections use reversals or adjustments.

---

### OD-710: Accounting Period Closing & Reopening Governance
* **Status:** **APPROVED BY PRODUCT OWNER**
* **Approved Policy:**
  1. **Monthly Closing:** Support monthly financial period closing.
  2. **Pre-Close Checklist:** Present a pre-close review covering cashboxes, banks, receivables, and expenses.
  3. **Period Locking:** Prevent editing or deletion of approved entries in closed periods.
  4. **Post-Closing Corrections:** Corrections after closing are recorded in an **open period** with a reference to the original period.
  5. **Reopening Governance:** Reopening requires **primary manager approval and a recorded reason**.
  6. **Audit History:** Preserve complete closing and reopening audit history.

---

### OD-711: Opening Balance & Legacy Payment Migration
* **Status:** **APPROVED BY PRODUCT OWNER**
* **Approved Policy:**
  1. **Comprehensive Balances:** Support opening balances when an institution starts using the financial system (cashboxes, bank accounts, student receivables, supplier/teacher payables, assets, liabilities, and equity).
  2. **Cutover Date:** Define a formal financial system start date.
  3. **Balanced Entries:** Generate balanced opening journal entries (`Debits == Credits`).
  4. **Provenance:** Preserve source documents and balance provenance.
  5. **Accountability:** Record who entered and who approved each opening balance.
  6. **Historical Integrity:** **Never fabricate synthetic historical transactions** to compensate for missing legacy data.

---

### OD-712: Multi-Currency & Primary Currency Policy
* **Status:** **APPROVED BY PRODUCT OWNER**
* **Approved Policy:**
  1. **Base Currency:** Egyptian Pound (EGP) is the default base currency for Egyptian institutions.
  2. **Multi-Currency Support:** Additional currencies are optional.
  3. **Transaction Preservation:** Preserve original transaction currency and amount.
  4. **Rate Recording:** Record the exchange rate, rate date, and exchange rate source.
  5. **GL Recording:** Record the EGP equivalent in the General Ledger.
  6. **Exchange Differences:** Support accounting treatment for realized and unrealized exchange differences.
  7. **Controlled Migration:** Changing the base currency after financial activity begins requires a controlled, approved process.
* **Explicitly Unresolved Details (Pending Detailed Policy):**
  - Authoritative exchange-rate source feed and policy for recording exchange differences on payment gateway settlements.

---

### OD-713: Legal Entity Structure
* **Status:** **APPROVED BY PRODUCT OWNER**
* **Approved Policy:**
  1. **Default Configuration:** Exactly one educational institution operating under one legal entity.
  2. **Multi-Entity Groups:** Support holding groups containing multiple independent legal entities.
  3. **Entity Independence:** Each legal entity has its own independent General Ledger, Chart of Accounts, financial reports, and tax obligations.
  4. **Multi-Branch within Entity:** One legal entity may contain multiple branches.
  5. **Data & Financial Isolation:** Maintain strict data and financial isolation between legal entities. Ledgers and balances are **never automatically merged**.
  6. **Intercompany Transactions:** Transactions between entities are recorded independently as arm's-length entries in each entity's books.

---

### OD-714: Egyptian Tax Authority (ETA) Statutory E-Invoicing
* **Status:** **APPROVED BY PRODUCT OWNER**
* **Approved Policy:**
  1. **Architecture Readiness:** Prepare architecture for future integration with Egypt's official electronic invoice and receipt systems.
  2. **Tax Metadata:** Store legal entity tax registration information, commercial register, and activity codes.
  3. **Document Coverage:** Support invoices, credit notes, debit notes, and consumer receipts.
  4. **Lifecycle States:** Prepare document lifecycle states for creation, submission, acceptance, and rejection.
  5. **Identifier Preservation:** Preserve official UUIDs and response details when integration is enabled.
  6. **Non-Execution Gate:** **Do NOT enable actual submission in the current phase.**
  7. **Compliance Boundary:** **Do NOT claim tax compliance or official approval** before required official integration and applicable prerequisites are satisfied.
* **Explicitly Unresolved Details (Pending Detailed Policy):**
  - Specific ETA intermediary integration mode and educational tax category classification.

---

### OD-715: Cashbox Discrepancy Tolerance & Accountability
* **Status:** **APPROVED BY PRODUCT OWNER**
* **Approved Policy:**
  1. **Shift Reconciliation:** Compare expected cash with actual counted cash during shift closing.
  2. **Separate Recording:** Record shortages and overages as **separate cash discrepancies**.
  3. **No Automatic Reclassification:** Do NOT automatically classify discrepancies as revenue or expenses at count.
  4. **Explanation Required:** Require a written explanation from the cashier.
  5. **Manager Approval:** Require approval by the primary manager or an authorized delegate.
  6. **Full Audit History:** Preserve full audit history of discrepancy, explanation, and approval.
  7. **Accounting Post:** Record the appropriate accounting impact only **after approval** and according to institutional policy.

---

### OD-716: Cutover Architecture — Alternative B (Full Offline Backfill)
* **Status:** **APPROVED BY PRODUCT OWNER**
* **Approved Policy:**
  - The legacy data cutover strategy formally adopts **Alternative B (Authoritative Full Offline Backfill)** in preference to trigger-based CDC replay.
  - Cutover executes inside a single database transaction under an `EXCLUSIVE MODE` table lock barrier across all 27 business tables.
  - Set-based batch updates execute directly against the frozen live tables, completely eliminating CDC replay race conditions, commit-order divergence, and Safe Horizon calculation lag.

---

### OD-717: Maintenance Window & Staging Benchmarking Condition
* **Status:** **APPROVED BY PRODUCT OWNER (IN PRINCIPLE)**
* **Approved Policy:**
  - An application write maintenance window is approved in principle for cutover execution.
  - **Conditional Prerequisite:** The actual duration of the maintenance window cannot be assumed or estimated; it must be empirically measured through representative load testing on a Staging environment populated with production-scale data volumes.
  - A formal operational schedule and emergency rollback window must be agreed upon prior to production cutover scheduling.

---

### OD-718: Primary Manager Identity & Option 3B Provisioning
* **Status:** **APPROVED BY PRODUCT OWNER**
* **Approved Policy:**
  - Adoption of **Option 3B**: The Institution Primary Manager is provisioned via a dedicated, verified cryptographic invitation workflow.
  - **Strict Privilege Separation:** The existing bootstrap administrator (`admin@edu.com`) remains strictly a SaaS Platform Super-Admin (Domain A) and does **NOT** automatically become an Institution Primary Manager (Domain B).
  - Platform administrators have zero automatic operational privileges within institution tenant boundaries.

---

### OD-719: Online Dimension Representation as Branch
* **Status:** **APPROVED BY PRODUCT OWNER**
* **Approved Policy:**
  - The online dimension is represented as a parameterized `Branch` record with `isOnline = true` under the primary institution.
  - Guarantees 100% dimensional revenue attribution in the unified General Ledger while avoiding fragmented multi-entity structures.

---

### OD-720: Quarantine Data Retention: Option 7D (Indefinite Cold Archival)
* **Status:** **APPROVED BY PRODUCT OWNER**
* **Approved Policy:**
  - Adoption of **Option 7D**: Records in `MigrationQuarantine` and associated orphaned storage objects are retained under **indefinite cold archival**.
  - **Zero Synthetic Assignment:** Unresolvable records are never assigned to synthetic or arbitrary default institutions.
  - **Zero Destructive Deletion:** Diagnostic metadata and unlinked media storage keys must not be destructively deleted; they are preserved in cold storage for post-migration forensic auditing.

---

## 4. Unresolved Policy Register (Open Implementation Items)

The following specific items are explicitly recognized as open operational policies to be finalized prior to their corresponding engineering phases:

1. **OD-706 Absence & Session Consumption:** Define whether an unexcused student absence consumes a prepaid session credit or preserves the session.
2. **OD-706 Session Expiration:** Define expiration terms for unused session credits upon academic semester completion.
3. **OD-707 Teacher Qualifying Student Base:** Define whether "qualifying student" counting requires physical attendance, active enrollment, or zero outstanding financial balance.
4. **OD-707 Teacher Percentage-of-Revenue Base:** Define whether the percentage is calculated on gross invoiced tuition, net collected cash, or earned revenue net of discounts.
5. **OD-708 Detailed Refund Formulas & Timeframes:** Establish the administrative deduction percentage, gateway fee recovery rules, and refund request grace periods.
6. **OD-712 Exchange Rate Feed Source:** Select the official exchange-rate feed (Central Bank of Egypt vs. Gateway settlement rate).
7. **OD-714 Tax Integration Prerequisites:** Determine ETA intermediary connection mode (direct ETA API vs. certified e-receipt POS hardware) prior to enabling live tax transmission.

---

## 5. Implementation Roadmap Status Confirmation

All 15 Product Owner decisions are formally **APPROVED**. 

> [!IMPORTANT]
> **Implementation Sequence Notice:**
> The planned engineering sequence remains strictly:
> - **Phase 7.1:** Institution, Branch & Identity Foundation *(Planned — Not Started)*
> - **Phase 7.2:** Pricing Catalog & Subscription Agreements *(Planned — Not Started)*
> - **Phase 7.3:** Invoicing, Receivables & Collections *(Planned — Not Started)*
> - **Phase 7.4:** Cashboxes, Shift Closing & Accounts Payable *(Planned — Not Started)*
> - **Phase 7.5:** Double-Entry General Ledger & Automated Journals *(Planned — Not Started)*
> - **Phase 7.6:** Financial Reporting, Reconciliation & Revenue Recognition *(Planned — Not Started)*
> - **Phase 7.7:** Security, Audit Trails & Cutover *(Planned — Not Started)*
> 
> **No implementation phase has been initiated. Execution will begin only upon explicit authorization from the Product Owner.**
