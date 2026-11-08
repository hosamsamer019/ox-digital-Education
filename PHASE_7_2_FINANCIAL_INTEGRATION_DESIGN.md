# OX-DIGITAL Education — Phase 7.2
# Financial Integration & Downstream Accounting Design
## Institutional Ledger Integration, SaaS Separation & Accrual Mapping

**Document ID:** `OD-7204-FINANCIAL-INTEGRATION-DESIGN`  
**Workspace:** `D:\OX-DIGITAL\Mathe\OX-DIGITAL-GITHUB`  
**Repository:** `https://github.com/hosamsamer019/ox-digital-Education.git`  
**Git HEAD:** `0500b93e65c24ed881349c4acea7f523332c5e9f` (Branch: `main`)  
**Audit Date:** November 2026  
**Execution Mode:** READ-ONLY (ZERO APPLICATION CODE OR DATABASE MUTATIONS)  
**Status:** **STAGE A READ-ONLY AUDIT COMPLETE — IMPLEMENTATION NOT AUTHORIZED**

---

## 1. Executive Summary

This architecture design defines how the Task 7.2 Pricing Catalog and Subscription Agreements integrate into the broader Phase 7 financial system. It establishes strict financial boundary separation between the OX-DIGITAL SaaS platform and educational institutions (OD-702), while laying the groundwork for downstream invoicing (Task 7.3), manual cashbox collections (Task 7.4), and double-entry general ledger accounting (Task 7.5) under accrual accounting (OD-704) and deferred revenue recognition (OD-705).

---

## 2. Mandatory Financial Separation (OD-702)

A critical architectural mandate approved in OD-702 is the strict separation between:
1. **OX-DIGITAL SaaS Platform Commercial Accounting:** Platform software subscription fees, hosting charges, and SaaS billing charged by OX-DIGITAL to the school entity.
2. **Educational Institution Financial Books:** Student tuition, physical classroom fees, exam pack sales, teacher payouts, and campus operational cash flows.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    STRICT DOMAIN SEPARATION (OD-702)                        │
│                                                                             │
│  ┌─────────────────────────────────┐   ┌─────────────────────────────────┐  │
│  │   OX-DIGITAL SaaS COMMERCIAL    │   │      EDUCATIONAL INSTITUTION     │  │
│  │             BOOKS               │   │         FINANCIAL BOOKS         │  │
│  ├─────────────────────────────────┤   ├─────────────────────────────────┤  │
│  │ • SaaS Subscription Plans       │   │ • Student Tuition Catalog       │  │
│  │ • School Platform Licensing     │   │ • Physical Center Cohort Fees   │  │
│  │ • Cloud Storage Overages        │   │ • Online Course Subscriptions   │  │
│  │ • SaaS Revenue & Billing (EGP)  │   │ • Student Invoices & Receivables│  │
│  │ • Managed by Platform Admin     │   │ • Campus Cashboxes & Collections│  │
│  │   (admin@edu.com OD-718)        │   │ • Institutional General Ledger  │  │
│  │                                 │   │ • Managed by Primary Manager    │  │
│  │                                 │   │   (OD-701)                      │  │
│  └─────────────────────────────────┘   └─────────────────────────────────┘  │
│                  ▲                                       ▲                  │
│                  │           STRICT PARTITION            │                  │
│                  └───────────────────X───────────────────┘                  │
│                   No co-mingling of student agreements or                   │
│                   institutional tuition into SaaS revenue                   │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Architectural Guarantees:
* **Tenant Isolation:** All `PriceCatalog`, `PriceVersion`, and `SubscriptionAgreement` entities carry an immutable `institutionId` foreign key.
* **No Platform SaaS Leakage:** A student purchasing an institutional math course executes an agreement with the *educational institution*, never with OX-DIGITAL. The revenue flows entirely to the institution's institutional receivables.
* **Super-Admin Protection (OD-718):** Platform administrators (`admin@edu.com`) have zero operational authority to execute student agreements or withdraw institutional funds.

---

## 3. Downstream Financial Integration Roadmap

The Pricing Catalog and Subscription Agreements created in Task 7.2 serve as the foundational contractual anchor for all subsequent Phase 7 modules:

```
[Task 7.2: Pricing Catalog & Subscription Agreements]
                       │
                       │ Generates Contractual Obligation
                       ▼
[Task 7.3: Invoicing, Receivables & Billing Schedules]
  • Issue Invoices (INV-2026-0001) based on agreed schedule
  • Debit: Accounts Receivable (1100)
  • Credit: Deferred Revenue (2100) [Accrual OD-704/OD-705]
                       │
                       │ Collects Payments
                       ▼
[Task 7.4: Cashboxes, Shift Closing & Payment Gateway]
  • Physical cash collection at campus cashbox
  • Digital collection via Fawry/Paymob/Stripe
  • Debit: Cash / Bank (1010)
  • Credit: Accounts Receivable (1100)
                       │
                       │ Earns Revenue Over Time
                       ▼
[Task 7.5: General Ledger & Automated Journal Engine]
  • Daily/Monthly Revenue Recognition Schedule
  • Debit: Deferred Revenue (2100)
  • Credit: Subscription Revenue (4010) [Attributed to Branch OD-703]
                       │
                       │ Generates Financial Statements
                       ▼
[Task 7.6: Financial Reporting & Auditing]
  • Trial Balance, Income Statement, AR Aging by Branch
```

---

## 4. Accrual Accounting & Deferred Revenue Mechanics (OD-704 & OD-705)

When a student signs a subscription agreement and makes a payment, cash collection does **not** equal immediate revenue.

### 4.1 Example: 3-Month Online Math Subscription (1,500 EGP)
* **Contract Execution (Day 1):** Student signs `SubscriptionAgreement` for 1,500 EGP spanning October 1 to December 31.
  * Task 7.3 Invoicing issues `INV-2026-1001` for 1,500 EGP.
  * **Journal Entry 1 (Invoicing):**
    * `DR 1100 Accounts Receivable` : 1,500 EGP
    * `CR 2100 Deferred Revenue (Online Branch)` : 1,500 EGP
* **Payment Collection (Day 2):** Student pays via Paymob.
  * Task 7.4 records collection against invoice.
  * **Journal Entry 2 (Collection):**
    * `DR 1020 Paymob Clearing Account` : 1,500 EGP
    * `CR 1100 Accounts Receivable` : 1,500 EGP
* **Monthly Revenue Recognition (October 31):** 1/3 of the service period has elapsed.
  * Task 7.5 automated revenue recognition worker runs.
  * **Journal Entry 3 (October Earned Revenue):**
    * `DR 2100 Deferred Revenue (Online Branch)` : 500 EGP
    * `CR 4010 Online Subscription Revenue (Branch: Online)` : 500 EGP
* **Subsequent Months:** Similar 500 EGP entries are recognized on November 30 and December 31.
* **Unearned Liability:** On October 31, the institution's balance sheet accurately reflects 1,000 EGP in `Deferred Revenue` liabilities for services owed to the student.

---

## 5. Controlled Reversal & Refund Compliance (OD-708)

If a student withdraws mid-subscription:
1. **Zero Row Deletions:** The `SubscriptionAgreement`, `Payment`, and `Invoice` rows remain permanently in the database.
2. **Reversal Mechanism:**
   * Agreement status transitions to `CANCELLED`.
   * Unearned deferred revenue (e.g. 1,000 EGP) is released via an authorized `CreditNote` (Task 7.3).
   * Reversal journal entry:
     * `DR 2100 Deferred Revenue` : 1,000 EGP
     * `CR 1100 Accounts Receivable / Refund Payable` : 1,000 EGP
3. **Audit Immutability:** Full historical records remain intact for institutional and tax auditing.

---

## 6. Audit Verdict

| Integration Dimension | Downstream Task | Compatibility Status |
|---|---|:---:|
| **SaaS vs Institutional Separation (OD-702)** | Task 7.2 Foundation | **VERIFIED & PARTITIONED** |
| **Invoicing Contract Anchor** | Task 7.3 Invoicing | **DESIGNED** |
| **Cashbox Collection Hook** | Task 7.4 Cashboxes | **DESIGNED** |
| **Accrual & Deferred Revenue (OD-704/OD-705)** | Task 7.5 General Ledger | **DESIGNED** |
| **Non-Destructive Reversals (OD-708)** | All Modules | **DESIGNED** |

**Conclusion:** The Financial Integration Design provides complete accounting alignment between Task 7.2 and the downstream financial modules, fully respecting accrual accounting and SaaS separation.

