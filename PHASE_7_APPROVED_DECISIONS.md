# OX-DIGITAL Education — Phase 7
# Authoritative Product Owner Decisions & Decision Register

**Document ID:** `OD-7000-APPROVED-DECISIONS`  
**Workspace:** `D:\OX-DIGITAL\Mathe\OX-DIGITAL-GITHUB`  
**Repository:** `https://github.com/hosamsamer019/ox-digital-Education.git`  
**Status:** **AUTHORITATIVE & RECONCILED REGISTER**  
**Governance Scope:** FORMALLY APPROVED DECISIONS (OD-701 THROUGH OD-708) & PENDING DECISIONS (OD-709 THROUGH OD-715)  

---

## 1. Governance & Decision Classification Mandate

This document provides the definitive, reconciled record of Product Owner decisions governing the Phase 7 Financial Management System in OX-DIGITAL Education.

To ensure absolute governance integrity and prevent premature assumptions:
1. **APPROVED DECISIONS (OD-701 through OD-708):** Formally reviewed and explicitly approved by the Product Owner. These decisions are binding design constraints that must be preserved and cannot be weakened, altered, or silently replaced.
2. **PENDING DECISIONS (OD-709 through OD-715):** These items represent architectural proposals that have **NOT** received explicit Product Owner approval. They are marked **PENDING / NOT APPROVED** and must not be treated as binding decisions. Any implementation depending on these items must stop and await formal determination or handle them via configurable, delayable scaffolding.

---

## 2. Master Decision Reconciliation Matrix (OD-701 Through OD-715)

| Decision ID | Domain Category | Authoritative Status | Summary Policy | Affected Tasks |
| :--- | :--- | :---: | :--- | :--- |
| **OD-701** | Institution Governance | **APPROVED** | Exactly 1 Primary Manager per institution; `Institution` is tenant root; single & multi-branch support; auto-provision default branch; subordinate operational roles; central pricing authority; online branch dimension. Detailed staff permissions are NOT yet approved. | Task 7.1, Task 7.2 |
| **OD-702** | Financial Domain Separation | **APPROVED** | Strict separation: Domain A (SaaS platform billing) vs. Domain B (Institution internal finance). Independent COAs & GLs. Student tuition is never platform revenue. No shared ledgers or automatic settlement. | Task 7.1, Task 7.3, Task 7.5 |
| **OD-703** | Unified Institutional General Ledger | **APPROVED** | Exactly 1 GL per institution with branch dimensions on journal lines. Branch-attributable revenue, expenses, cash, and P&L. Dedicated Online/Head-Office branch dimension. | Task 7.1, Task 7.5, Task 7.6 |
| **OD-704** | Accrual Accounting Basis | **APPROVED** | Accrual accounting standard: Revenue recognized when earned according to applicable service policy; expenses recognized when incurred. AR & AP supported. Cash-flow statement alongside Income Statement and Balance Sheet. Invoicing does not equal automatic earned revenue. Final posting templates require validation under UP-701. | Task 7.3, Task 7.5, Task 7.6 |
| **OD-705** | Progressive Online Subscription Revenue | **APPROVED** | Progressive ratable recognition over subscription term. Unearned future service value is Deferred Revenue liability; periodic transfer of earned portions. Cancellations, refunds, and pauses follow separate policies. | Task 7.2, Task 7.5, Task 7.6 |
| **OD-706** | Physical Center Session Packages | **APPROVED** | Prepaid session packages centrally priced. Enrollment creates obligation; collections update paid/outstanding. Attendance consumes 1 session. Sessions attributed to branch, group, teacher, student. Absence does not automatically consume a session. Valuation & recognition require formal validation. | Task 7.2, Task 7.3, Task 7.5 |
| **OD-707** | Teacher Compensation | **APPROVED** | Support 4 compensation models: (1) Fixed monthly salary, (2) Per completed lesson, (3) Per qualifying student, (4) % of group/course revenue. Branch attribution, monthly statements, cancelled lessons not payable. Calculation bases subject to formal policy. | Task 7.4, Task 7.5, Task 7.6 |
| **OD-708** | Refunds & Student Withdrawal | **APPROVED** | Prorated by service type (online unused term, package unused sessions, monthly actual delivered). Requires recorded reason and manager approval. Non-destructive reversals, credit adjustments, and refunds; never delete original transactions. | Task 7.3, Task 7.5 |
| **OD-716** | Cutover Architecture | **APPROVED BY PRODUCT OWNER** | Alternative B (Authoritative Full Offline Backfill). Live tables frozen under `EXCLUSIVE MODE` table lock barrier; set-based backfill updates executed directly on authoritative data; eliminates CDC replay skew. | Task 7.1, Task 7.7 |
| **OD-717** | Maintenance Window | **APPROVED BY PRODUCT OWNER (IN PRINCIPLE)** | Application write maintenance window approved in principle. Actual downtime duration must be empirically measured via representative Staging data volume benchmarks and an agreed operational schedule prior to production execution. | Task 7.1, Task 7.7 |
| **OD-718** | Primary Manager Provisioning | **APPROVED BY PRODUCT OWNER** | Option 3B: Dedicated verified invitation process for Institution Primary Manager. Existing bootstrap administrator (`admin@edu.com`) remains strictly a separate SaaS Platform Super-Admin. | Task 7.1 |
| **OD-719** | Online Dimension Representation | **APPROVED BY PRODUCT OWNER** | Online dimension represented as a parameterized `Branch` record with `isOnline: true`, ensuring unified General Ledger accounting and dimensional attribution. | Task 7.1, Task 7.5 |
| **OD-720** | Quarantine Data Retention | **APPROVED BY PRODUCT OWNER** | Option 7D: Indefinite cold archival. Diagnostic quarantine records and unresolvable assets preserved indefinitely; zero unsupported synthetic tenant assignment; zero destructive deletion. | Task 7.1, Task 7.7 |
| **OD-709** | Financial Approval Authority | **PENDING / NOT APPROVED** | Proposal: Configurable delegated approval limits per institution. Status: **Awaiting explicit Product Owner approval.** | Task 7.1, Task 7.4, Task 7.7 |
| **OD-710** | Financial Period Closing | **PENDING / NOT APPROVED** | Proposal: Monthly period close locking journals against edits. Status: **Awaiting explicit Product Owner approval.** Not a hard prerequisite for Task 7.7. | Task 7.5, Task 7.6, Task 7.7 |
| **OD-711** | Opening Balances & Legacy Migration | **PENDING / NOT APPROVED** | Proposal: Balanced opening entries at defined cutover date. Status: **Awaiting explicit Product Owner approval.** | Task 7.1, Task 7.5, Task 7.7 |
| **OD-712** | Currency Policy | **PENDING / NOT APPROVED** | Proposal: Multi-currency tracking. Status: **Awaiting explicit Product Owner approval.** Scope does not assume multi-currency; EGP is a provisional initial assumption. | Task 7.2, Task 7.5, Task 7.6 |
| **OD-713** | Legal Entity Structure | **PENDING / NOT APPROVED** | Proposal: Multi-entity group holding hierarchy. Status: **Awaiting explicit Product Owner approval.** Not a prerequisite for Task 7.1. | Task 7.1, Task 7.5, Task 7.7 |
| **OD-714** | Electronic Invoicing & Tax Compliance | **PENDING / NOT APPROVED** | Proposal: Egypt ETA e-invoice readiness with disabled transmission. Status: **Awaiting explicit Product Owner approval.** | Task 7.3, Task 7.7 |
| **OD-715** | Cashbox Discrepancies | **PENDING / NOT APPROVED** | Proposal: Blind cash count comparing expected vs actual with separate discrepancy records. Status: **Awaiting explicit Product Owner approval.** | Task 7.4, Task 7.5 |

---

## 3. Authoritative Specifications of Approved Decisions (OD-701 through OD-708)

### OD-701 — Institution Governance
* **Status:** **APPROVED BY PRODUCT OWNER**
* **Approved Governance Scope:**
  - Exactly **one primary institution owner/manager** per educational institution.
  - The `Institution` entity is the absolute **tenant root** (`institutionId`).
  - **Strict Data Isolation:** Absolute isolation between educational institutions. No data, student records, courses, or ledgers are shared.
  - The primary manager exercises central authority over the institution, its branches, catalog, and operations.
  - **Single & Multi-Branch Support:** Single-branch institutions operate friction-free without multi-branch administrative overhead. When an institution is provisioned, a default branch (`isDefault = true`) is automatically created.
  - **Subordinate Operational Roles:** Operational roles, if introduced, remain strictly subordinate to the primary manager. No independent branch ownership or independent financial administration exists by default.
  - **Centralized Control:** Pricing catalogs, subscription tiers, and financial policies are governed centrally.
  - **Consolidated & Dimensional Reporting:** Primary manager can view consolidated institution-wide reports or drill down into specific branch performance.
  - **Online Branch Dimension:** Virtual courses and digital subscriptions are assigned to an explicit **Online Branch Dimension** (`isOnline = true`).
* **Explicitly NOT YET APPROVED (Staff Operational Permissions):**
  - Detailed operational role definitions (Branch Manager, Accountant, Cashier).
  - Financial approval limits and cash collection permissions.
  - Refund approval permissions, journal posting permissions, and cashbox access rights.
  - Branch-level financial delegation and separation-of-duties matrix.
  - *These permissions must not be invented or finalized; Task 7.1 may propose role designs, but unapproved privileges must not be implemented.*

---

### OD-702 — Financial Domain Separation
* **Status:** **APPROVED BY PRODUCT OWNER**
* **Approved Policy:**
  Maintain two strictly separated financial domains:
  1. **Domain A — OX-DIGITAL SaaS Commercial Finance:**
     - Platform vendor entity maintaining its own Chart of Accounts and General Ledger.
     - Records institutional licensing fees, platform seat subscriptions, and SaaS hosting revenue.
     - Records platform infrastructure expenses and institutional receivables.
     - **Strict Revenue Prohibition:** Student tuition, lesson fees, center packages, and institution cash collections must **NEVER** be recorded as OX-DIGITAL platform revenue.
  2. **Domain B — Educational Institution Internal Finance:**
     - Each educational institution maintains an isolated financial ledger and Chart of Accounts.
     - Records student tuition, lesson fees, cashboxes, center operating expenses, and teacher compensation.
     - Must never share financial records, cash accounts, or balances with another institution.
  3. **No Automatic Settlement or Merging:**
     - Inter-domain automatic settlement, balance netting, or ledger merging is strictly prohibited.
     - Contractual transactions between OX-DIGITAL and an institution (e.g., monthly software license bills) are recorded independently in both ledgers (as an AR invoice in Domain A and an AP bill in Domain B).

---

### OD-703 — Unified Institutional General Ledger
* **Status:** **APPROVED BY PRODUCT OWNER**
* **Approved Policy:**
  - Exactly **ONE unified General Ledger** per educational institution.
  - Journal lines carry attributable **branch dimensions / cost centers** (`branchId`).
  - Provides separately attributable branch-level reporting for revenue, collections, receivables, expenses, cashboxes, and teacher payroll.
  - Head-office and online transactions are attributed to the dedicated Online Branch Dimension.
  - Enables institution-wide consolidation without legal entity fragmentation.

---

### OD-704 — Accrual Accounting Basis
* **Status:** **APPROVED BY PRODUCT OWNER**
* **Approved Policy & Accounting Distinctions:**
  - Accrual accounting is the mandated institutional standard.
  - Revenue is recognized when educational services are rendered according to the applicable service and accounting policy; expenses are recognized when obligations are incurred.
  - Accounts Receivable (AR) and Accounts Payable (AP) are formally maintained.
  - Cash-flow reporting is provided in addition to the Income Statement (P&L) and Balance Sheet.
  - **Fundamental Accounting Decoupling:** The system must **NEVER** apply a universal journal entry to every invoice. The following events must be explicitly separated:
    1. *Invoice issuance:* Generates the formal billing document.
    2. *Creation of accounts receivable:* Establishes student payment obligation.
    3. *Cash collection:* Settles the receivable or advances liability; collection alone does **NOT** create earned revenue.
    4. *Service delivery:* Occurrence of educational teaching or subscription elapsed term.
    5. *Revenue recognition:* Formal transfer to earned income.
    6. *Deferred revenue release:* Amortization of unearned liabilities.
    7. *Refunds and credit adjustments:* Non-destructive adjustments.
  - **Service Types:**
    - *A. Earned service:* Delivered services recognize earned revenue and corresponding receivable when appropriate.
    - *B. Future online subscription:* Unearned amounts remain Deferred Revenue and are recognized progressively over the term (OD-705).
    - *C. Prepaid physical session package:* Preserves unearned portion as a service obligation/deferred balance; recognized per attendance under OD-706.
    - *D. Collection:* Settle receivable or advances liability; does not automatically create revenue.
  - **No Invented Account Numbers:** Final Chart of Accounts and posting templates require accounting validation under UP-701.

---

### OD-705 — Progressive Online Subscription Revenue
* **Status:** **APPROVED BY PRODUCT OWNER**
* **Approved Policy:**
  - Online subscription revenue is recognized progressively over the service term.
  - Unearned future service value is credited to **Deferred Revenue (Unearned Revenue Liability)**.
  - Periodic automated journals transfer earned portions from Deferred Revenue to Earned Subscription Revenue (e.g., 1,200 EGP annual subscription = 100 EGP recognized monthly).
  - Cancellation, refund, and subscription pause details follow separately approved policies.

---

### OD-706 — Physical Center Session Packages
* **Status:** **APPROVED BY PRODUCT OWNER**
* **Approved Policy & Tracking Dimensions:**
  - Centrally priced session packages (e.g., 8-lesson package).
  - The system must explicitly distinguish the following **9 dimensions**:
    1. *Package amount sold:* Total nominal contract value.
    2. *Amount collected:* Actual cash/funds received to date.
    3. *Outstanding amount:* Uncollected balance ($Sold - Collected$).
    4. *Total sessions purchased:* Total lesson entitlement count.
    5. *Sessions actually attended/consumed:* Lessons confirmed via attendance.
    6. *Remaining sessions:* Unused entitlement count ($Purchased - Attended$).
    7. *Earned service value:* Value of delivered lessons based on approved valuation.
    8. *Unconsumed service value:* Remaining service obligation/deferred balance.
    9. *Refundable amount:* Subject to OD-708 and applicable refund policy.
  - **Attendance Rules:**
    - Actual student attendance consumes exactly one session entitlement.
    - Absence does **NOT** automatically consume a session.
    - Collection does **NOT** mean the entire package has been earned.
    - Remaining sessions must remain visible as an outstanding service obligation.
    - Every session must retain student, teacher, group, branch, and date attribution.
    - The accounting recognition method and valuation of consumed sessions must be formally validated before Task 7.5 posting templates are finalized.

---

### OD-707 — Teacher Compensation
* **Status:** **APPROVED BY PRODUCT OWNER**
* **Approved Policy:**
  - Support four primary manager-selected compensation models:
    1. Fixed Monthly Salary.
    2. Per Completed Lesson Rate.
    3. Per Qualifying Student Rate.
    4. Percentage Share of Course/Group Revenue.
  - Branch-attributed monthly compensation statements.
  - Support for advances, deductions, and bonuses with contract effective dates and history.
  - Cancelled or unperformed lessons are **NOT payable**.
  - Precise qualifying student definitions and percentage calculation bases remain subject to formal implementation policy under UP-704.

---

### OD-708 — Refunds & Student Withdrawal
* **Status:** **APPROVED BY PRODUCT OWNER**
* **Approved Policy:**
  - Refund calculations vary by service type:
    - Online subscriptions: calculate unused/unconsumed service value according to withdrawal terms.
    - Prepaid packages: account for used sessions and determine remaining refundable value.
    - Monthly subscriptions: calculate service actually delivered.
  - Unpaid receivables are handled according to withdrawal reason and applicable policy.
  - Every refund requires a documented justification code and Primary Manager approval.
  - **Non-Destructive Accounting & Payment Protection Invariant:**
    - **Approved Invariant:** Historical financial transactions and payment records must **never** be silently or destructively deleted as a side effect of deleting or deactivating a user.
    - Deletion protection mechanisms (Restrict, soft deletion, archival, relationship redesign) are technical options to be evaluated in Task 7.1 discovery and approved by the Product Owner before schema alteration.
    - Original transactions must be preserved. Adjustments use reversing entries, credit notes, and refund disbursement records; physical deletion of financial transactions is strictly forbidden.

---

### OD-716 — Cutover Architecture: Alternative B (Full Offline Backfill)
* **Status:** **APPROVED BY PRODUCT OWNER**
* **Approved Policy:**
  - The legacy data cutover strategy formally adopts **Alternative B (Authoritative Full Offline Backfill)** in preference to trigger-based CDC replay.
  - Cutover executes inside a single database transaction under an `EXCLUSIVE MODE` table lock barrier across all 27 business tables.
  - Set-based batch updates execute directly against the frozen live tables, completely eliminating CDC replay race conditions, commit-order divergence, and Safe Horizon calculation lag.

---

### OD-717 — Maintenance Window & Staging Benchmarking Condition
* **Status:** **APPROVED BY PRODUCT OWNER (IN PRINCIPLE)**
* **Approved Policy:**
  - An application write maintenance window is approved in principle for cutover execution.
  - **Conditional Prerequisite:** The actual duration of the maintenance window cannot be assumed or estimated; it must be empirically measured through representative load testing on a Staging environment populated with production-scale data volumes.
  - A formal operational schedule and emergency rollback window must be agreed upon prior to production cutover scheduling.

---

### OD-718 — Primary Manager Identity & Option 3B Provisioning
* **Status:** **APPROVED BY PRODUCT OWNER**
* **Approved Policy:**
  - Adoption of **Option 3B**: The Institution Primary Manager is provisioned via a dedicated, verified cryptographic invitation workflow.
  - **Strict Privilege Separation:** The existing bootstrap administrator (`admin@edu.com`) remains strictly a SaaS Platform Super-Admin (Domain A) and does **NOT** automatically become an Institution Primary Manager (Domain B).
  - Platform administrators have zero automatic operational privileges within institution tenant boundaries.

---

### OD-719 — Online Dimension Representation as Branch
* **Status:** **APPROVED BY PRODUCT OWNER**
* **Approved Policy:**
  - The online dimension is represented as a parameterized `Branch` record with `isOnline = true` under the primary institution.
  - Guarantees 100% dimensional revenue attribution in the unified General Ledger while avoiding fragmented multi-entity structures.

---

### OD-720 — Quarantine Data Retention: Option 7D (Indefinite Cold Archival)
* **Status:** **APPROVED BY PRODUCT OWNER**
* **Approved Policy:**
  - Adoption of **Option 7D**: Records in `MigrationQuarantine` and associated orphaned storage objects are retained under **indefinite cold archival**.
  - **Zero Synthetic Assignment:** Unresolvable records are never assigned to synthetic or arbitrary default institutions.
  - **Zero Destructive Deletion:** Diagnostic metadata and unlinked media storage keys must not be destructively deleted; they are preserved in cold storage for post-migration forensic auditing.

---

## 4. Pending Architectural Proposals (OD-709 through OD-715)

The following items are proposed technical designs that **HAVE NOT BEEN FORMALLY APPROVED**. They are recorded here for reference and must be resolved by the Product Owner before finalization of the affected downstream tasks.

### OD-709 — Financial Approval Authority
* **Status:** **PENDING / NOT APPROVED**
* **Proposed Concept:** Primary Manager holds ultimate authority with configurable delegated limits for branch managers and accountants.
* **Open Issue:** Specific approval threshold amounts and delegation tiers require institutional policy definition (tracked under UP-709).

### OD-710 — Financial Period Closing
* **Status:** **PENDING / NOT APPROVED**
* **Proposed Concept:** Monthly financial period close locking journals against edits.
* **Open Issue:** Monthly locking is **NOT** an approved requirement. No specific close workflow or reopening permissions are approved. Period closing is **NOT** a hard prerequisite for Task 7.7. Any period-close, lock, or reopen behavior remains policy-dependent (tracked under UP-710).

### OD-711 — Opening Balances & Legacy Migration
* **Status:** **PENDING / NOT APPROVED**
* **Proposed Concept:** Balanced opening journal entries at defined cutover date; no synthetic historical transaction fabrication.
* **Open Issue:** Legacy balance audit and reconciliation cutover rules require approval (tracked under UP-711).

### OD-712 — Currency Policy
* **Status:** **PENDING / NOT APPROVED**
* **Proposed Concept:** Multi-currency tracking in General Ledger.
* **Open Issue:** OD-712 is not approved. The current implementation scope does **NOT** assume multiple currencies. EGP is a provisional initial scope assumption requiring Product Owner confirmation prior to financial calculations. Multi-currency and FX accounting wait for explicit policy approval (tracked under UP-708).

### OD-713 — Legal Entity Structure
* **Status:** **PENDING / NOT APPROVED**
* **Proposed Concept:** Multi-entity group holding hierarchy.
* **Open Issue:** OD-713 is not approved and is **NOT** a prerequisite for Task 7.1. Task 7.1 implements the approved single-institution and branch model (OD-701) without assuming multi-entity holding structures (tracked under UP-713).

### OD-714 — Electronic Invoicing & Tax Compliance
* **Status:** **PENDING / NOT APPROVED**
* **Proposed Concept:** Egyptian Tax Authority (ETA) e-invoice schema readiness with real-time submission disabled.
* **Open Issue:** Educational VAT treatment and ETA integration roadmap require legal/tax review (tracked under UP-702).

### OD-715 — Cashbox Discrepancies
* **Status:** **PENDING / NOT APPROVED**
* **Proposed Concept:** Cashier shift blind count comparing expected vs actual cash with separate discrepancy records.
* **Open Issue:** Discrepancy tolerance limits and write-off policies require approval (tracked under UP-705).

---

*Reconciled and certified by Antigravity Architecture Agent under Product Owner mandate.*
