# OX-DIGITAL Education — Phase 7
# Register of Unresolved Business, Accounting, Tax & Implementation Policies

**Document ID:** `OD-7000-UNRESOLVED-POLICIES`  
**Workspace:** `D:\OX-DIGITAL\Mathe\OX-DIGITAL-GITHUB`  
**Repository:** `https://github.com/hosamsamer019/ox-digital-Education.git`  
**Status:** **AUTHORITATIVE UNRESOLVED POLICY REGISTER**  
**Operating Rule:** NEVER SILENTLY SELECT, INVENT, OR ASSUME A POLICY. PROPOSALS MUST NOT BE TREATED AS DECISIONS.

---

## 1. Purpose & Policy Governance Protocol

While high-level architectural decisions **OD-701 through OD-708** have been approved by the Product Owner, several operational, accounting, legal, and configuration policies remain to be determined before specific downstream implementation tasks can be finalized.

This register catalogs every unresolved policy, defines its exact technical blast radius, categorizes its blocking severity, identifies the required authority or advisory body, and outlines candidate proposals (which are strictly proposals, not decisions).

### Policy Category Classification:
1. **TRUE IMPLEMENTATION BLOCKER:** Implementation of the affected task cannot begin until a formal determination is made by the designated authority.
2. **SAFELY DELAYABLE POLICY:** Scaffolding and foundational task work can proceed using configurable abstractions; final business logic or UI defaults must be decided prior to task sign-off.
3. **FUTURE OPTIONAL EXTENSION:** Outside the current mandatory Phase 7 implementation scope. Does not block manual financial administration.

---

## 2. Master Unresolved Policies Matrix

| Policy ID | Policy Title | Affected Tasks | Classification | Required Determination | Summary Question |
| :--- | :--- | :---: | :---: | :---: | :--- |
| **UP-701** | Statutory Chart of Accounts (COA) Structure & Posting Templates | Task 7.5, Task 7.6 | **TRUE BLOCKER for Task 7.5** | Accounting Advice + Product Owner | What specific code structure (4-digit vs 6-digit) and standard posting templates will serve as the institutional template? |
| **UP-702** | Educational VAT & ETA Electronic Invoicing Treatment | Task 7.3, Task 7.7 | **SAFELY DELAYABLE** (Decide before Task 7.3) | Tax/Legal Advice + Product Owner | Are physical center lessons and online courses 100% VAT-exempt, or subject to standard 14% VAT under Egyptian tax law? |
| **UP-703** | Online Payment Gateway Settlement & Merchant Routing | Task 7.3 (Future) | **FUTURE OPTIONAL EXTENSION** (Outside current scope) | Product Owner + Commercial Strategy | Direct School Merchant credentials vs Central SaaS Platform collection & payout? (Manual cash collection is mandatory initial scope; does NOT block Task 7.3). |
| **UP-704** | Teacher Percentage Revenue-Share Base & Student Qualification | Task 7.4, Task 7.5 | **SAFELY DELAYABLE** (Decide during Task 7.4) | Product Owner + Financial Operations | Is % compensation based on invoiced revenue (accrual) or collected cash? What defines a "qualifying student"? |
| **UP-705** | Cashbox Discrepancy Tolerance Limits & Shortage/Overage Policy | Task 7.4 | **SAFELY DELAYABLE** (Decide during Task 7.4) | Product Owner + Internal Audit | Is there a nominal cash difference threshold (e.g., < 20 EGP) auto-cleared, or must every discrepancy require manager escalation? |
| **UP-706** | Student Refund Administrative Fees & Withdrawal Deadlines | Task 7.3 | **SAFELY DELAYABLE** (Decide during Task 7.3) | Product Owner Approval | Can institutions charge a fixed cancellation fee upon withdrawal, and what are the allowable withdrawal timeframes? |
| **UP-707** | Institutional Fiscal Year Definition & Calendar Alignment | Task 7.5, Task 7.7 | **SAFELY DELAYABLE** (Decide during Task 7.5) | Product Owner + Accounting | Does the default fiscal year align with the Calendar Year (Jan 1 – Dec 31) or Academic Year (Sep 1 – Aug 31 / Jul 1 – Jun 30)? |
| **UP-708** | Provisional Implementation Currency & Future Multi-Currency | Task 7.2, Task 7.6 | **SAFELY DELAYABLE** (Confirm before Task 7.2 pricing) | Product Owner Confirmation | EGP is a provisional initial implementation assumption. When is PO confirmation required? Multi-currency waits for OD-712 approval. |
| **UP-709** | Staff Operational Roles & Financial Delegation Limits | Task 7.1, Task 7.4, Task 7.7 | **SAFELY DELAYABLE** (Decide during Task 7.1) | Product Owner Approval | Detailed roles, approval limits, collection permissions, refund permissions, and separation-of-duties matrix are NOT yet approved. |
| **UP-710** | Financial Period Closing Locking & Reopening Protocol | Task 7.5, Task 7.7 | **SAFELY DELAYABLE** (OD-710 is pending; not a hard blocker for 7.7) | Internal Audit + Product Owner | Monthly locking is not approved. Any period close/lock/reopen behavior remains explicitly policy-dependent. |
| **UP-711** | Opening Balances Migration & Cutover Reconciliation Rules | Task 7.1, Task 7.5, Task 7.7 | **SAFELY DELAYABLE** (Decide during Task 7.5) | Accounting Advice + Product Owner | How are pre-existing uncollected student balances and cashbox balances audited and mapped into opening journal entries? |
| **UP-712** | Student Absence Session Package Consumption Policy | Task 7.3, Task 7.6 | **SAFELY DELAYABLE** (Decide before Task 7.3) | Product Owner + Academic Operations | Under OD-706: Absence does not automatically consume a session. What formal absence policy governs expired or unexcused sessions? |
| **UP-713** | Legal Entity Structure (Single Entity vs Multi-Entity Group) | Task 7.1, Task 7.5 | **SAFELY DELAYABLE** (Not a blocker for Task 7.1) | Legal Advice + Product Owner | OD-713 is pending and not required for Task 7.1. Task 7.1 implements the approved single-institution model without multi-entity assumptions. |
| **UP-714** | Session Package Consumed Session Valuation & Recognition Method | Task 7.3, Task 7.5 | **SAFELY DELAYABLE** (Decide before Task 7.5) | Accounting Advice + Product Owner | What exact formula values a consumed session (linear unit price $Price / TotalSessions$ vs weighted tiered valuation) when transferring to revenue? |
| **UP-715** | User Lifecycle & Historical Financial Protection Design | Task 7.1 | **SAFELY DELAYABLE** (Evaluated in Task 7.1 Stage B) | Technical Architecture + Product Owner | How to protect payments from deletion: Soft deletion (`deletedAt`), archival table, deactivation status, or relation redesign? Evaluated in Task 7.1 Stage B. |

---

## 3. Comprehensive Specifications of Unresolved Policies

---

### UP-701: Statutory Chart of Accounts (COA) Structure & Posting Templates
* **Affected Tasks & Components:** Task 7.5 (General Ledger Engine), Task 7.6 (Financial Reporting)
* **Classification:** **TRUE IMPLEMENTATION BLOCKER for Task 7.5**
* **Required Determination:** Accounting Advisory + Product Owner Approval
* **Why It Matters:**  
  Illustrative account numbers in prior architectural sketches (e.g., `1110 Cash`, `2131 Deferred Revenue`, `4110 Tuition Revenue`) were conceptual only. Double-entry accounting requires an authoritative Chart of Accounts tree and validated posting templates that conform to standard commercial accounting practices.
* **Candidate Proposals (For Review):**
  - *Proposal A (4-Digit Standard Hierarchy):* `1xxx` Assets, `2xxx` Liabilities, `3xxx` Equity, `4xxx` Operating Revenue, `5xxx` Cost of Educational Delivery, `6xxx` Administrative & General Expenses.
  - *Proposal B (6-Digit Granular Hierarchy):* `110101` Cashbox Main, `110201` Bank EGP, `410101` Online Subscriptions, `410201` Center Lesson Packages.
  - *Proposal C (Configurable Template):* System provides standard 4-digit template with capability for Primary Manager to customize account codes.

---

### UP-702: Educational VAT & ETA Electronic Invoicing Treatment
* **Affected Tasks & Components:** Task 7.3 (Invoice Line Calculation), Task 7.7 (Tax Compliance)
* **Classification:** **SAFELY DELAYABLE** (Scaffolding supports tax lines; rate policy to be finalized before Task 7.3)
* **Required Determination:** Egyptian Tax/Legal Advisory + Product Owner Approval
* **Why It Matters:**  
  Under Egyptian VAT Law No. 67 of 2016, pure educational services are generally exempt from VAT, but private tutoring centers, training certificates, and digital platform access fees are frequently treated differently by local tax offices.
* **Candidate Proposals (For Review):**
  - *Proposal A (Default 100% Tax-Exempt):* All courses and packages generate invoices with 0% VAT and tax exemption reason code.
  - *Proposal B (Configurable Tax Engine):* Tax rate is configured per product in the Pricing Catalog (Exempt 0%, Standard 14%, Table Tax).

---

### UP-703: Online Payment Gateway Settlement & Merchant Routing
* **Affected Tasks & Components:** Task 7.3 (Future Extension)
* **Classification:** **FUTURE OPTIONAL EXTENSION** (Current Phase 7 scope is strictly manual financial administration)
* **Required Determination:** Product Owner + Commercial Strategy
* **Why It Matters:**  
  Current Phase 7 scope enforces manual financial administration (manual cash recording, bank transfers confirmed by staff). Online payment gateways (Paymob, Fawry, Stripe) are **NOT required** for Task 7.3 and do not block manual collections. When gateways are introduced in future phases, merchant routing rules will be required.
* **Candidate Proposals (For Future Review):**
  - *Proposal A (Direct School Merchant):* Each educational institution configures its own merchant API keys. Funds deposit directly to school bank account. Platform takes zero custody of tuition funds.
  - *Proposal B (Aggregator / Escrow Model):* Platform collects centrally and disburses to schools net of platform fees.

---

### UP-704: Teacher Percentage Revenue-Share Base & Student Qualification
* **Affected Tasks & Components:** Task 7.4 (Teacher Statements), Task 7.5 (Teacher Payable Journals)
* **Classification:** **SAFELY DELAYABLE** (Decide during Task 7.4)
* **Required Determination:** Product Owner + Financial Operations
* **Why It Matters:**  
  Under OD-707, one approved model is "Percentage of group/course revenue". The exact revenue base must be defined: Is it gross invoiced revenue (accrual) or actual collected cash? Furthermore, for "per qualifying student", what defines qualification (enrolled vs attended $\ge 1$ lesson)?
* **Candidate Proposals (For Review):**
  - *Proposal A (Collected Cash Basis):* Teacher percentage is calculated solely on actual cash collected from students for that group, protecting the center against bad debts.
  - *Proposal B (Accrued Invoiced Revenue Basis):* Teacher percentage is calculated on total invoiced billing, with subsequent adjustments if student defaults.
  - *Proposal C (Attending Student Definition):* A student qualifies for teacher payment only if they attend at least 1 session during the billing period.

---

### UP-705: Cashbox Discrepancy Tolerance Limits & Shortage/Overage Policy
* **Affected Tasks & Components:** Task 7.4 (Cashier Shifts)
* **Classification:** **SAFELY DELAYABLE** (Decide during Task 7.4)
* **Required Determination:** Product Owner + Internal Audit
* **Why It Matters:**  
  Under proposed OD-715, shift close compares expected cash vs actual physical cash. In physical cash operations, minor coin rounding differences occur routinely.
* **Candidate Proposals (For Review):**
  - *Proposal A (Zero Tolerance):* Every difference, even 1 EGP, flags as an audit discrepancy requiring Primary Manager resolution.
  - *Proposal B (Nominal Rounding Threshold):* Discrepancies $\le 10$ EGP are automatically booked to a `Cash Rounding Variance` account; differences $> 10$ EGP require cashier explanation and manager sign-off.

---

### UP-706: Student Refund Administrative Fees & Withdrawal Deadlines
* **Affected Tasks & Components:** Task 7.3 (Refund Calculation Engine)
* **Classification:** **SAFELY DELAYABLE** (Decide during Task 7.3)
* **Required Determination:** Product Owner Approval
* **Why It Matters:**  
  OD-708 approves prorated refunds based on consumed sessions or elapsed subscription time. The institution may require retention of an administrative registration fee or enforce withdrawal cut-off windows.
* **Candidate Proposals (For Review):**
  - *Proposal A (Pure Mathematical Proration):* `Refund = Total Paid - (Consumed Units * Unit Rate)`.
  - *Proposal B (Deductible Administrative Fee):* System permits deducting a fixed administrative fee (e.g., 100 EGP or 10%) from the calculated refundable amount.
  - *Proposal C (Withdrawal Window):* Withdrawals are permitted only within the first 14 days of enrollment; after 14 days, balance is non-refundable.

---

### UP-707: Institutional Fiscal Year Definition & Calendar Alignment
* **Affected Tasks & Components:** Task 7.5 (General Ledger), Task 7.7 (Period Closing)
* **Classification:** **SAFELY DELAYABLE** (Decide during Task 7.5)
* **Required Determination:** Product Owner + Accounting Advisory
* **Why It Matters:**  
  Commercial Egyptian corporate entities standardly use January 1 – December 31, whereas public educational institutions often align with July 1 – June 30 or September 1 – August 31.
* **Candidate Proposals (For Review):**
  - *Proposal A (Calendar Year):* 12 monthly periods from January 1 to December 31.
  - *Proposal B (Academic Year):* 12 monthly periods from September 1 to August 31.
  - *Proposal C (Configurable Setting):* Institution settings allow Primary Manager to select fiscal year start month.

---

### UP-708: Provisional Implementation Currency & Future Multi-Currency
* **Affected Tasks & Components:** Task 7.2, Task 7.6
* **Classification:** **SAFELY DELAYABLE** (Confirm initial currency before Task 7.2 pricing catalog)
* **Required Determination:** Product Owner Confirmation
* **Why It Matters:**  
  OD-712 is PENDING / NOT APPROVED. The current implementation scope does **NOT** assume multiple currencies or foreign-exchange accounting. EGP is a provisional initial scope assumption requiring Product Owner confirmation before hardcoding currency behavior. Multi-currency and FX journals wait for explicit policy approval.
* **Candidate Proposals (For Review):**
  - *Proposal A (Single Currency EGP Initial Release):* Platform operates strictly in EGP for Phase 7.1–7.7.
  - *Proposal B (Secondary Currency with Manual Daily Rate):* Primary Manager records bank exchange rate daily.
  - *Proposal C (Automated Central Bank API Feed):* Automated daily ingestion from Central Bank of Egypt (CBE) published rates.

---

### UP-709: Staff Operational Roles & Financial Delegation Limits
* **Affected Tasks & Components:** Task 7.1 (RBAC Scaffolding), Task 7.4 (Expenses), Task 7.7 (Security)
* **Classification:** **SAFELY DELAYABLE** (Decide during Task 7.1)
* **Required Determination:** Product Owner Approval
* **Why It Matters:**  
  Approved governance establishes exactly ONE Primary Manager with sovereign authority. Operational roles (Branch Manager, Accountant, Cashier) and their detailed permissions (cash collection, refund sign-off, journal posting, cashbox access, separation-of-duties matrix) are **NOT yet approved**. Task 7.1 may propose role designs, but unapproved permissions must not be implemented.
* **Candidate Proposals (For Review):**
  - *Proposal A (Configurable Per Institution):* Primary Manager sets explicit numerical caps (e.g., Branch Manager may approve expenses up to 2,000 EGP; expenses $> 2,000$ EGP escalate to Primary Manager).
  - *Proposal B (Centralized Execution):* All approvals, disbursements, and refunds require Primary Manager digital signature.

---

### UP-710: Financial Period Closing Locking & Reopening Protocol
* **Affected Tasks & Components:** Task 7.5 (GL Period Lock), Task 7.7 (Security Audit)
* **Classification:** **SAFELY DELAYABLE** (OD-710 is pending; not a hard blocker for Task 7.7)
* **Required Determination:** Internal Audit + Product Owner Approval
* **Why It Matters:**  
  Proposed OD-710 is PENDING / NOT APPROVED. Monthly locking is **NOT** an approved requirement. No specific close workflow or reopening permissions are approved. Period closing is **NOT** a hard prerequisite for Task 7.7. Task 7.7 focuses on transaction immutability, audit trails, and cutover reconciliation.
* **Candidate Proposals (For Review):**
  - *Proposal A (Optional Soft Lock):* Period can be flagged as closed to warn users, but does not hard-block corrections.
  - *Proposal B (Cryptographic Lock with Manager Reopen):* Primary Manager enters password and written justification to reopen.

---

### UP-711: Opening Balances Migration & Cutover Reconciliation Rules
* **Affected Tasks & Components:** Task 7.1 (Legacy Backfill), Task 7.5 (Opening GL Vouchers), Task 7.7 (Cutover)
* **Classification:** **SAFELY DELAYABLE** (Decide during Task 7.5)
* **Required Determination:** Accounting Advisory + Product Owner Approval
* **Why It Matters:**  
  When migrating existing institutions, historical balances (uncollected student receivables, cash on hand) must be introduced into the double-entry GL without creating synthetic historical transactions.
* **Candidate Proposals (For Review):**
  - *Proposal A (Balanced Opening Journal Voucher):* Single audited opening journal entry debiting Cash/AR and crediting Owner Equity/Retained Earnings as of cutover date.
  - *Proposal B (Detailed Subledger Ingestion):* Ingest outstanding invoices individually and post a summary balancing entry to equity.

---

### UP-712: Student Absence Session Package Consumption Policy
* **Affected Tasks & Components:** Task 7.3 (Attendance Billing), Task 7.6 (Revenue Recognition)
* **Classification:** **SAFELY DELAYABLE** (Decide before Task 7.3)
* **Required Determination:** Product Owner + Academic Operations
* **Why It Matters:**  
  OD-706 states: "Actual attendance consumes one session. Absence must not automatically consume a session until its policy is approved." A clear business rule is required for unexcused student absences.
* **Candidate Proposals (For Review):**
  - *Proposal A (Strict Attendance Only):* Unattended lessons never consume a session. A student can miss lessons indefinitely without financial consumption.
  - *Proposal B (Classroom Reservation Policy):* If student fails to attend without 24-hour advance notice, the session is consumed (treated as delivered).
  - *Proposal C (Center Configurable):* Center sets its absence policy (Permit X absences per package before auto-consumption).

---

### UP-713: Legal Entity Structure (Single Entity vs Multi-Entity Group)
* **Affected Tasks & Components:** Task 7.1, Task 7.5
* **Classification:** **SAFELY DELAYABLE** (Not a blocker for Task 7.1)
* **Required Determination:** Legal Advice + Product Owner Approval
* **Why It Matters:**  
  Proposed OD-713 is pending and is **NOT** a prerequisite for Task 7.1. Task 7.1 implements the approved single-institution and branch model (OD-701) without assuming multi-entity holding structures, consolidated multi-entity accounting, or inter-company settlements. Future extension points may be documented, but are not required.
* **Candidate Proposals (For Review):**
  - *Proposal A (Single Institution Model):* `Institution` directly maps 1:1 to educational center operations.
  - *Proposal B (Multi-Entity Holding):* Introduce explicit `LegalEntity` model to support educational groups that own multiple distinct commercial entities under one institutional umbrella.

---

### UP-714: Session Package Consumed Session Valuation & Recognition Method
* **Affected Tasks & Components:** Task 7.3 (Receivables Ledger), Task 7.5 (Automated Posting)
* **Classification:** **SAFELY DELAYABLE** (Decide before Task 7.5)
* **Required Determination:** Accounting Advisory + Product Owner Approval
* **Why It Matters:**  
  When an attendance event consumes 1 session from a package, what exact valuation formula is used to transfer unearned service value to earned revenue?
* **Candidate Proposals (For Review):**
  - *Proposal A (Linear Straight-Line Valuation):* $\text{Session Value} = \frac{\text{Package Contract Price}}{\text{Total Sessions Purchased}}$.
  - *Proposal B (Tiered / Discount-Adjusted Valuation):* First sessions valued at standard single-lesson rate; final sessions absorb package promotional discounts.

---

### UP-715: User Lifecycle & Historical Financial Protection Design
* **Affected Tasks & Components:** Task 7.1 (Architecture & Schema Design)
* **Classification:** **SAFELY DELAYABLE** (Evaluated in Task 7.1 Stage B)
* **Required Determination:** Technical Architecture Proposal + Product Owner Approval
* **Why It Matters:**  
  The approved invariant is that financial transactions and payment records must never be silently or destructively deleted when a user is deactivated or deleted. `deletedAt` on User and `onDelete: Restrict` on relations are **NOT approved implementation decisions**. Task 7.1 must inspect actual relations and deletion flows, evaluate options, and present the technical proposal for review before modifying schema or database behavior.
* **Candidate Proposals (For Stage B Evaluation):**
  - *Proposal A (Explicit Restrict on Financial Foreign Keys):* Enforce database `RESTRICT` on payments/attendance and prevent user deletion if records exist.
  - *Proposal B (User Soft Deletion):* Add `deletedAt` timestamp and filter active users in queries.
  - *Proposal C (Account Deactivation Status):* Use `AccountStatus` (`ACTIVE`, `INACTIVE`, `SUSPENDED`) and preserve user rows.
  - *Proposal D (Archival / Separation):* Archive deactivated users to separate table or dissociate auth credentials while retaining relational IDs.

---

*Cataloged and certified by Antigravity Architecture Agent under Product Owner mandate.*
