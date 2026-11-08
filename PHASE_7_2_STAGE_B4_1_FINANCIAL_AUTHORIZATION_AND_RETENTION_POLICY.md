# Phase 7.2 — Stage B.4.1: Internal Controls & Data Governance
## Critical Reconciliation: Maker-Checker Financial Controls & Statutory Data Retention

**Workspace:** `D:\OX-DIGITAL\Mathe\OX-DIGITAL-GITHUB`  
**Git Repository:** `https://github.com/hosamsamer019/ox-digital-Education.git`  
**Git HEAD:** `0500b93e65c24ed881349c4acea7f523332c5e9f` (branch `main`)  
**Phase:** 7.2 — Pricing Catalog & Subscription Agreements  
**Stage:** Stage B.4.1 — Policy Reconciliation, Financial Rules & Architecture Refinement  
**Date:** November 2, 2026  
**Final Status:** `TASK 7.2 STAGE B.4.1 — DOCUMENTATION-ONLY POLICY RECONCILIATION — NO SOURCE, SCHEMA, DATABASE OR MIGRATION AUTHORIZATION`  

---

## 1. Critical Reconciliation E: Maker-Checker Internal Financial Controls (UP-709)

Under provisional decision **UP-709**, institutional financial administration enforces strict segregation of duties through a **Maker-Checker Dual-Approval Workflow** for monetary adjustments and manual discounts.

### 1.1 Provisional Approval Thresholds
- **Manual Discounts:** Any discount exceeding **10%** of the published catalog reference price requires Primary Manager approval.
- **Balance Adjustments:** Any balance adjustment or credit note exceeding **500.00 EGP** requires Primary Manager approval.
- *Status:* Both thresholds remain **provisional** and are subject to final executive confirmation.

---

### 1.2 Operational Rules & Anti-Splitting Controls

```
[ Staff Initiates Discount or Adjustment (Maker) ]
                         │
                         ▼
        { Does Total Value Exceed Threshold? }
        - Discount > 10% OR
        - Adjustment > 500 EGP OR
        - 24-Hour Rolling Aggregate > Threshold
                 /               \
         YES    /                 \    NO
               ▼                   ▼
    [ Status: PENDING_APPROVAL ]  [ Status: APPROVED (Auto) ]
    [ Primary Manager Queue ]     [ Direct Execution ]
               │
               ▼
    { Primary Manager Decision (Checker) }
         /                \
    APPROVED            REJECTED
        │                   │
        ▼                   ▼
[ Execute Posting ]    [ Void Request ]
```

1. **Discount Reference Price Standard:**
   - The 10% discount threshold is calculated strictly against the active, published `PriceVersion.basePrice` (or active `BranchPriceOverride.overridePrice`).
   - Staff cannot inflate an arbitrary quote to create the appearance of a compliant discount.
2. **Cumulative Discount Invariant:**
   - If multiple discounts (e.g. sibling discount + early-bird promotion) are applied to a single agreement, the threshold evaluates the **aggregate cumulative discount percentage**.
   - If total discount $\ge 10.01\%$, the agreement enters `PENDING_APPROVAL` status.
3. **Anti-Splitting Controls (Threshold Evasion Prevention):**
   - **The Vulnerability:** An operator could attempt to bypass the 500 EGP threshold by issuing three consecutive adjustments of 300 EGP, 300 EGP, and 200 EGP (total 800 EGP).
   - **System Enforcement Rule:** The workflow engine evaluates adjustments against a **24-hour rolling window** and **billing cycle aggregate** per student agreement:
     $$\text{Total Window Adjustments} = \sum_{t \in [-24\text{h}, \text{now}]} \text{AdjustmentAmount}_t$$
     If $\text{Total Window Adjustments} > 500.00 \text{ EGP}$, dual approval is strictly triggered regardless of individual transaction size.
4. **Strict Role Separation Invariants:**
   - **Self-Approval Prohibition:** A user cannot approve their own financial request (`requesterUserId !== approverUserId`).
   - **Amount Immutability:** An approver cannot edit or alter the requested discount or adjustment amount in-flight. Modifying an amount rejects the pending request and mandates the creation of a new request cycle.
   - **Cashier Restriction:** Users assigned to collection or cashier roles hold **collection-only rights**; they are hard-blocked from initiating manual discounts, fee waivers, or credit adjustments.
5. **Open Policy Clarification on Adjustment Basis:**
   - *Status:* **PENDING_PRODUCT_OWNER_CLARIFICATION**.
   - Whether the 500 EGP threshold should be evaluated strictly per-line item, per-invoice, or per-academic semester remains an open operational question for the Product Owner.

---

## 2. Critical Reconciliation F: User Data Retention & Compliance (UP-715)

In addressing user deletion requests (such as under the Egyptian Personal Data Protection Law No. 151 of 2020), the platform must balance data subject rights with mandatory tax and accounting record-keeping requirements.

> [!WARNING]
> **Legal Caution:** Software design cannot provide legal indemnity. The preliminary 5-to-10-year retention range frequently cited in accounting contexts represents an architectural estimate, not a verified statutory rule. Qualified Egyptian data privacy and commercial legal counsel must provide written confirmation before automated erasure scripts are implemented.

---

### 2.1 Statutory Legal-Review Matrix

| Data Category | Physical Schema Entities | Primary Business Purpose | Proposed Lifecycle & Technical Treatment | Estimated Statutory Retention | Specialist Confirmation Required |
|---|---|---|---|---|---|
| **Financial Transactions** | `Payment`, `PaymentTransaction`, `JournalEntry` | Audit defense, statutory tax compliance, and double-entry accounting integrity. | **Strict Preservation:** Never physically deleted. Retained in read-only immutable ledgers. | 5 to 10 Years (Commercial Code / Tax Law) | **Certified Egyptian Tax Counsel** |
| **Contracts & Agreements** | `SubscriptionAgreement`, `AgreementPriceSnapshot` | Contractual evidence, legal claim defense, and terms snapshotting. | **Strict Preservation:** Contract terms, timestamps, and terms hashes preserved indefinitely. | Term of Contract + Statutory Limitation Period | **Commercial Legal Counsel** |
| **Student Profile PII** | `User.name`, `User.email`, `User.phone`, `User.nationalId` | Identity verification, communication, and educational delivery. | **PII Scrubbing upon Deletion:** Scrambled to `ANONYMIZED_USER_<UUID>` while preserving foreign key. | Duration of Enrollment + Grace Period | **Data Privacy Attorney (Law 151/2020)** |
| **Authentication Data** | `User.password`, `UserSession`, refresh tokens | Platform access control and session security. | **Immediate Destruction:** Password hash and session tokens permanently purged on account deletion. | Zero days post-account closure | Internal Security Audit |
| **Attendance & Academic History** | `Attendance`, `ExamAttempt`, `SessionConsumption` | Pedagogical tracking, attendance evidence, and grading records. | **Pseudonymized Archival:** Preserved for academic accreditation; linked only to anonymized student ID. | Duration required by Ministry of Education / Center Policy | Academic Regulatory Review |
| **Uploaded Identity Documents** | Identification scans, deposit slips, medical excuses | KYC verification, discount qualification, and withdrawal verification. | **Classified Archival:** Financial receipts archived; personal identity scans purged post-audit verification. | Tax audit window for receipts; purged for identity docs | **Data Privacy Attorney** |

---

### 2.2 Account Deactivation, Erasure & Legal Holds

```
[ User Submits Deletion Request ]
                 │
                 ▼
     { Is Account on Legal Hold? }
     - Active litigation OR
     - Unresolved financial dispute OR
     - Open tax audit window
              /             \
      YES    /               \    NO
            ▼                 ▼
  [ Deletion Blocked ]   [ Step 1: Deactivate Account (Soft Lock) ]
  [ Legal Notice Sent]                │
                                      ▼
                         { Has Financial History? }
                                  /       \
                          YES    /         \    NO
                                ▼           ▼
    [ Step 2: Scrub Profile PII ]     [ Complete Hard Deletion ]
    - Name -> 'ANONYMIZED'            - User row purged from DB
    - Email -> 'anon_<uuid>@purged'
    - Phone/Pass -> NULL
    - Keep User.id on Ledgers
```

### 2.3 Strict Definitions: Pseudonymization vs. Anonymization
1. **Pseudonymization:** Replaces identifying fields with artificial pseudonyms (e.g. UUIDs). It is technically reversible if a mapping key is retained.
2. **Anonymization:** Irreversibly destroys the linkage between the stored data and the real-world person, such that neither the platform nor any third party can re-identify the individual.
3. **Architectural Guardrail:** The engineering design **does not promise irreversible anonymization** where transaction histories (such as branch attendance times and fee payments) could theoretically be correlated with external real-world records. The system promises **statutory PII minimization and access restriction**, pending formal Data Protection Attorney review.
4. **Legal Hold Override:** Any active legal dispute, formal chargeback proceeding, or tax investigation places an immediate cryptographic `LEGAL_HOLD` flag on the account, suspending all automated erasure workflows.

---

## 3. Explicit Governance Statement

```
TASK 7.2 STAGE B.4.1 — DOCUMENTATION-ONLY POLICY RECONCILIATION — NO SOURCE, SCHEMA, DATABASE OR MIGRATION AUTHORIZATION
```

