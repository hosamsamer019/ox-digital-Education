# Phase 7.2 — Stage B: Architecture Design
## Document 4: Financial & Accounting Integration Architecture

**Workspace:** `D:\OX-DIGITAL\Mathe\OX-DIGITAL-GITHUB`  
**Phase:** 7.2 — Pricing Catalog & Subscription Agreements  
**Stage:** Stage B — Architecture Design  
**Date:** November 2026  
**Status:** DESIGN ONLY — IMPLEMENTATION NOT AUTHORIZED  

---

## 1. Domain Separation of Commercial & Accounting Artifacts

To maintain financial auditability and satisfy institutional accounting standards, four distinct concepts must never be conflated:

```
[ SubscriptionAgreement ] ──> [ Invoice ] ──> [ PaymentTransaction ] ──> [ JournalEntry ]
       (Contract)                (Bill)           (Settlement)             (Accounting)
```

1. **SubscriptionAgreement (Task 7.2):** The contractual commitment between the student/parent and the institution defining agreed rates, billing terms, start/end dates, and educational entitlements. It is **not** a financial debt instrument by itself.
2. **Invoice (Task 7.3):** The legal demand for payment issued for a specific billing cycle or session package. Issuing an invoice legally establishes an account receivable.
3. **PaymentTransaction (Task 7.4):** The actual receipt of monetary funds (via Paymob gateway, Fawry cash, bank wire, or center POS).
4. **JournalEntry (Task 7.5):** The double-entry general ledger posting recording the debits, credits, dimensions, and accounts impacted by commercial transactions.

---

## 2. End-to-End Financial Lifecycle & Illustrative Journal Entries

Below is the complete 8-step financial lifecycle for an illustrative **3-Month Term Subscription** at **1,500.00 EGP** (500.00 EGP/month) for a student enrolled in a physical branch (Nasr City Campus).

```
Step 1: Agreement Acceptance ────> (Contract Locked; No GL Entry)
                                          │
Step 2 & 3: Invoice Issuance ────> Debit Accounts Receivable / Credit Deferred Revenue
                                          │
Step 4 & 5: Cash Collection ─────> Debit Cash at Bank / Credit Accounts Receivable
                                          │
Step 6 & 7: Monthly Recognition ─> Debit Deferred Revenue / Credit Subscription Revenue
                                          │
Step 8: Mid-Term Cancellation ───> Debit Credit Note / Credit Accounts Receivable (or Refund)
```

---

### Step 1: Agreement Acceptance & Price Snapshot
- **Trigger Event:** Student/parent accepts terms via `POST /agreements/:id/accept`.
- **System Action:** Creates immutable `AgreementPriceSnapshot` (`1,500.00 EGP`).
- **Accounting Posting:** **NONE.** An accepted contract represents an executory agreement, not an accrued transaction or realized financial debt.

---

### Steps 2 & 3: Receivable Creation & Invoice Issuance
- **Trigger Event:** Automated billing job runs on agreement start date (`startsAt`), invoking Task 7.3 Invoice Engine.
- **System Action:** Generates `Invoice` (`INV-2026-00891`) for `1,500.00 EGP` with Net 15 payment terms.
- **Illustrative General Ledger Entry (Double-Entry Posting):**

| Line | Account Name | Account Code | Dimension (Branch) | Debit (EGP) | Credit (EGP) |
|---|---|---|---|---|---|
| 1 | Accounts Receivable — Students | `11200` | Nasr City (`br_cairo_nasr`) | 1,500.00 | — |
| 2 | Deferred Revenue — Tuition (Liability) | `22100` | Nasr City (`br_cairo_nasr`) | — | 1,500.00 |

*Posting Explanation:* The institution now possesses a legal claim against the student (Asset $\uparrow$), offset by an unearned service obligation (Liability $\uparrow$). Under accrual accounting (OD-704/705), revenue cannot be recognized until teaching is delivered.

---

### Steps 4 & 5: Cash Collection & Payment Allocation
- **Trigger Event:** Payment gateway webhook fires or cashier records cash receipt for `1,500.00 EGP` (Task 7.4).
- **System Action:** `PaymentTransaction` clears invoice; transitions agreement to `ACTIVE`.
- **Illustrative General Ledger Entry:**

| Line | Account Name | Account Code | Dimension (Branch) | Debit (EGP) | Credit (EGP) |
|---|---|---|---|---|---|
| 1 | Cash at Bank — Clearing | `11110` | Central Treasury | 1,500.00 | — |
| 2 | Accounts Receivable — Students | `11200` | Nasr City (`br_cairo_nasr`) | — | 1,500.00 |

*Posting Explanation:* The receivable is fully settled by cash. The obligation to deliver education remains in `Deferred Revenue`.

---

### Steps 6 & 7: Deferred Revenue Amortization & Recognition
- **Trigger Event:** Month 1 concludes (or daily straight-line amortization schedule executes).
- **Calculation:** $1,500.00 \div 3\text{ months} = 500.00\text{ EGP/month}$.
- **Illustrative General Ledger Entry (Month 1 Recognition):**

| Line | Account Name | Account Code | Dimension (Branch) | Debit (EGP) | Credit (EGP) |
|---|---|---|---|---|---|
| 1 | Deferred Revenue — Tuition | `22100` | Nasr City (`br_cairo_nasr`) | 500.00 | — |
| 2 | Earned Tuition Revenue — Branch | `41100` | Nasr City (`br_cairo_nasr`) | — | 500.00 |

*Posting Explanation:* One month of educational service has been rendered. The liability reduces by 500.00 EGP and moves into earned revenue attributed to the Nasr City Branch dimension. This repeats for Months 2 and 3.

---

### Step 8: Early Cancellation, Credit Note & Refund (Controlled Reversal OD-708)
- **Trigger Event:** Student withdraws at the start of Month 3. The institution policy authorizes a refund/credit of the unearned Month 3 portion (500.00 EGP).
- **System Action:** Agreement transitions to `CANCELLED`. A formal `CreditNote` is issued. **Zero records are deleted or modified directly.**
- **Illustrative General Ledger Entry (Compensating Adjustment):**

| Line | Account Name | Account Code | Dimension (Branch) | Debit (EGP) | Credit (EGP) |
|---|---|---|---|---|---|
| 1 | Deferred Revenue — Tuition | `22100` | Nasr City (`br_cairo_nasr`) | 500.00 | — |
| 2 | Accounts Payable / Refund Clearing | `21100` | Central Treasury | — | 500.00 |

- **Subsequent Cash Refund Settlement:**

| Line | Account Name | Account Code | Dimension (Branch) | Debit (EGP) | Credit (EGP) |
|---|---|---|---|---|---|
| 1 | Accounts Payable / Refund Clearing | `21100` | Central Treasury | 500.00 | — |
| 2 | Cash at Bank — Clearing | `11110` | Central Treasury | — | 500.00 |

---

## 3. Multi-Branch & Online Revenue Attribution Matrix

In compliance with OD-701, OD-702, and OD-719:
1. **Branch Dimension Tagging:** Every journal line referencing revenue (`4xxxx`), deferred revenue (`2xxxx`), or receivables (`1xxxx`) must carry the foreign key `branchId`.
2. **Online Educational Service (`isOnline: true`):**
   - For purely digital courses, the branch dimension points to the institution's designated Online Service Branch.
   - Journal lines tag `isOnline: true` in line metadata.
3. **Hybrid Student Split:** When a student enrolls in a hybrid program (physical labs + digital platform):
   - The agreement itemizes physical and online components.
   - Separate revenue lines attribute lab fees to the physical campus and digital access to the online branch.

---

## 4. Downstream Financial Roadmap (Tasks 7.3 through 7.7)

Phase 7.2 provides the contractual foundation upon which subsequent financial tasks integrate:

```
[ Task 7.2: Pricing Catalog & Subscription Agreements ]
                          │
                          ▼
[ Task 7.3: Invoicing & Billing Schedules ]
  - Generates recurring invoices from active SubscriptionAgreements
  - Calculates VAT/ETA compliance (UP-702)
                          │
                          ▼
[ Task 7.4: Multi-Channel Payment & Cashier Collection ]
  - Gateway webhooks, POS cash register, bank reconciliations
  - Clears Accounts Receivable
                          │
                          ▼
[ Task 7.5: Double-Entry General Ledger & Chart of Accounts ]
  - Immutable journal posting engine (OD-708)
  - Daily/monthly revenue amortization schedules (OD-704/705)
                          │
                          ▼
[ Task 7.6: Financial Reporting & Trial Balance ]
  - Balance Sheet, Income Statement, Branch P&L
                          │
                          ▼
[ Task 7.7: Auditing, Compliance & Fiscal Year Close ]
  - Fiscal period locks (UP-707), ETA e-invoicing export
```

