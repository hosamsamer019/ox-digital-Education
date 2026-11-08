# PHASE 7.0 — FINANCIAL SECURITY AND AUDITABILITY
**Product:** OX-DIGITAL Education  
**Workspace:** `D:\OX-DIGITAL\Mathe\OX-DIGITAL-GITHUB`  
**Audit Date:** November 2026  
**Status:** COMPLETE (READ-ONLY SECURITY & AUDITABILITY DESIGN)

---

## 1. Executive Summary

Financial systems require a dramatically higher standard of security, integrity, and non-repudiation than standard academic portals. A system managing real money must guarantee:
1. That funds cannot be collected without an unalterable receipt.
2. That posted transactions cannot be edited, deleted, or back-dated.
3. That unauthorized discounts and refunds cannot be granted collusively.
4. That account balances cannot be tampered with via database updates.
5. That complete tenant and branch data isolation is mathematically enforced.

This document establishes the security architecture, role separation rules, approval workflows, and audit controls for Phase 7.

---

## 2. Role-Based Financial Permissions (RBAC) & Separation of Duties (SoD)

### 2.1 Granular Financial Roles Matrix

The monolithic `ADMIN` role is replaced in the financial domain with segregated duties:

| Financial Role | Primary Responsibility | Permissions & Boundaries | Prohibited Actions (SoD) |
| :--- | :--- | :--- | :--- |
| **Front-Desk Cashier** (`BRANCH_CASHIER`) | Physical center student check-in, cash collection, manual receipts. | Open/close assigned cashbox, generate cash receipts, issue student registration invoices. | **CANNOT** post journal entries, approve refunds, create discounts, or view institution P&L. |
| **Branch Accountant** (`BRANCH_ACCOUNTANT`) | Daily branch bookkeeping, supplier invoices, cash count reconciliation. | Create draft journals for branch expenses, verify cashier daily shifts, view branch AR aging. | **CANNOT** close accounting periods, issue unapproved refunds, or access other branches. |
| **Chief Financial Officer / Head Accountant** (`FINANCE_MANAGER`) | Institution-wide accounting, financial reporting, payroll approval, period close. | Post journal entries, approve refunds up to limit, execute period locking, configure COA. | **CANNOT** act as front-desk cashier collecting physical cash (prevents self-reconciliation). |
| **Institution General Manager** (`INSTITUTION_OWNER`) | Executive oversight, strategic pricing, high-value approval. | Approve exceptional refunds, set central pricing, review consolidated balance sheets. | **CANNOT** tamper with posted double-entry journals. |
| **Financial Auditor** (`FINANCIAL_AUDITOR`) | Independent internal or statutory external audit inspection. | Read-only access to all journal entries, audit logs, bank reconciliations, and ledgers. | **STRICTLY READ-ONLY**. No create, edit, post, or delete access anywhere. |

### 2.2 Separation of Duties (SoD) Enforcement Rules

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         SEPARATION OF DUTIES RULES                          │
├─────────────────────────────────────────────────────────────────────────────┤
│ Rule 1: No Self-Receipting                                                  │
│   • A user who creates an invoice cannot be the sole approver of a waiver   │
│     or discount on that same invoice.                                       │
│                                                                             │
│ Rule 2: Two-Person Rule for Cash Reconciliation                             │
│   • The cashier counting the physical cash drawer CANNOT be the accountant   │
│     who signs off on the cashbox session closure and variance write-off.    │
│                                                                             │
│ Rule 3: Four-Eyes Principle on Journal Posting                              │
│   • Manual journal entries exceeding 10,000 EGP created by an accountant    │
│     must be approved and posted by a second authorized financial manager.   │
│                                                                             │
│ Rule 4: Decoupled Refund Authorization                                      │
│   • Cashiers who initiate a refund request cannot approve the refund.       │
│     Refund payouts require manager authorization.                           │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Tiered Approval Workflows

### 3.1 Refund Authorization Tiers

Refunds represent direct cash outflows and high fraud exposure. All refunds require automated workflow state progression: `REQUESTED` ➔ `UNDER_REVIEW` ➔ `APPROVED` ➔ `DISBURSED`.

| Refund Amount (EGP) | Required Approval Level | Verification Requirements |
| :--- | :--- | :--- |
| **≤ 200 EGP** | Branch Accountant | Reason code documented + student withdrawal logged. |
| **201 – 1,000 EGP** | Branch Manager | Academic supervisor confirmation + attendance check. |
| **1,001 – 5,000 EGP** | Chief Financial Officer | Formal withdrawal petition + original payment verification. |
| **> 5,000 EGP** | Institution General Manager / Owner | Full financial review + board-level sign-off. |

### 3.2 Discount & Scholarship Authorization Tiers
- **Standard Promotional Codes:** Pre-configured in the Central Price Catalog with capped percentage, maximum usage quota, and validity window. Auto-validated by the system.
- **Discretionary Staff Discounts (Sibling, Hardship, Employee Child):**
  - Up to 15%: Branch Manager approval required.
  - > 15% or 100% Scholarship: Finance Manager or Institution Owner approval required.
  - **Zero "Manual Price Overrides":** Cashiers cannot arbitrarily alter the price input field during invoice generation.

---

## 4. Cash Collection Accountability & Shift Governance

Front-desk cash handling is the highest-risk area for shrinkage in physical educational centers.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                       CASH SHIFT INTEGRITY CONTROLS                         │
│                                                                             │
│ 1. Mandatory Register Opening:                                              │
│    • Cashier must verify starting float (e.g., 200 EGP petty cash).          │
│    • System stamps timestamp, IP, terminal ID, and cashier userId.          │
│                                                                             │
│ 2. Blind Cash Count at Shift Close:                                         │
│    • System HIDES the calculated cash balance from the cashier.             │
│    • Cashier must physically count denominations:                           │
│      [200 EGP x N] + [100 EGP x N] + [50 EGP x N] + ...                     │
│    • Cashier submits the counted total blind.                               │
│                                                                             │
│ 3. Automated Discrepancy Capture:                                           │
│    • System calculates Variance = Counted - Expected.                       │
│    • Any variance > 10 EGP triggers an incident notification to the         │
│      Finance Manager.                                                       │
│    • Discrepancy is automatically posted to General Ledger:                 │
│      - Shortage: Debit 5330 (Cash Shortage Expense)                         │
│      - Overage: Credit 4330 (Cash Over Collection Income)                   │
│                                                                             │
│ 4. Mandatory Shift Handoff Voucher:                                         │
│    • Both the outgoing cashier and incoming cashier (or supervisor) must    │
│      sign off digitally before the drawer is unlocked for the next shift.   │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 5. Ledger Immutability & Audit Trails

### 5.1 Append-Only Ledger Principle
In double-entry accounting, **data is never updated or deleted**.
- **No `UPDATE` on `JournalEntry` or `JournalLine`:** Once `status == 'POSTED'`, database-level triggers or Prisma middleware block any `UPDATE` statements on financial columns (`debit`, `credit`, `accountId`, `entryDate`).
- **No `DELETE` on Posted Records:** Hard deletion is strictly prohibited.
- **Accounting Reversals:** If an error occurs, an authorized user executes a **Reversal Entry**. The system creates a new, linked journal entry with reversed debits and credits:
  ```
  Original Entry #1042:  Debit: Cash (500)       Credit: Revenue (500)
  Reversal Entry #1043:  Debit: Revenue (500)    Credit: Cash (500)
                         (References: originalEntryId = 1042)
  ```

### 5.2 Cryptographic Audit Logging
Every financial mutation generates an unalterable audit log entry containing:
1. `id`: UUIDv4.
2. `timestamp`: ISO 8601 UTC.
3. `actorId`: User ID of the initiator.
4. `action`: e.g., `INVOICE_ISSUED`, `CASH_COLLECTED`, `JOURNAL_POSTED`, `PERIOD_CLOSED`.
5. `targetEntity`: Table name and record ID.
6. `beforeState` & `afterState`: JSON diff of modified attributes.
7. `ipAddress` & `userAgent`: Network forensic markers.
8. `payloadHash`: SHA-256 hash chaining each log entry to the previous entry, preventing retro-active log tampering.

---

## 6. Financial Idempotency & Concurrency Hardening

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          IDEMPOTENCY ARCHITECTURE                           │
│                                                                             │
│ [Client Request]                                                            │
│   Header: Idempotency-Key: "pay_req_9f83a2c0-8192-4d8e"                     │
│         │                                                                   │
│         ▼                                                                   │
│ [Idempotency Middleware]                                                    │
│   ├── Check Redis / DB for key                                              │
│   ├── Case A (Key Found & Processed):                                       │
│   │     └── Return cached HTTP response immediately (Prevents duplicate)    │
│   ├── Case B (Key Found & IN_FLIGHT):                                       │
│   │     └── Return 409 Conflict: "Transaction in progress"                  │
│   └── Case C (Key Not Found):                                               │
│         ├── Acquire Redis distributed lock                                  │
│         ├── Execute financial database transaction ($transaction)           │
│         ├── Store result with key (TTL: 24 hours)                           │
│         └── Release lock and return response                                │
└─────────────────────────────────────────────────────────────────────────────┘
```

- **Duplicate Payment Prevention:** In gateway webhooks (Paymob/Fawry/Stripe), the `providerOrderId` and webhook signature are checked atomically inside a database lock to eliminate race conditions.

---

## 7. Accounting Period Closing & Period Locking

To protect the integrity of financial statements, the system supports **Period Locking**:
1. **Monthly Closing:** At month-end, the Finance Manager closes the accounting period (e.g., `2026-10-31`).
2. **Lock Effect:** Once a period is closed, **no journal entry with an `entryDate` within that period can be posted**, regardless of user permissions.
3. **Reopening Governance:** Reopening a closed period requires dual executive approval (Finance Manager + General Manager), logs an immediate high-severity security alert, and requires an explicit statutory justification.

---

## 8. Tenant & Branch Data Isolation

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    TENANT & BRANCH ENFORCEMENT ENGINE                       │
│                                                                             │
│ 1. Scoped Middleware:                                                       │
│    • Extracts tenant context from verified JWT:                             │
│      req.context = { institutionId: "inst_123", branchId: "br_dokki" }      │
│                                                                             │
│ 2. Automated Query Scoping (Prisma Client Extension):                       │
│    • Injects where: { institutionId: req.context.institutionId } into       │
│      EVERY database operation.                                              │
│    • Completely prevents cross-institution data leakage.                    │
│                                                                             │
│ 3. Row-Level Security (PostgreSQL RLS):                                     │
│    • Direct database-level policies ensuring tenant isolation even if an     │
│      application query omits the filter.                                    │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 9. Sensitive Data & Privacy Protections

1. **Credit Card & Banking Information:**
   - The platform **never stores raw credit card numbers, CVVs, or bank account PINs**.
   - Gateway card tokens only are stored (`providerPaymentToken`).
2. **PII Masking in Financial Reports:**
   - Student national IDs, parent phone numbers, and home addresses are masked in operational accounting extracts.
   - Financial audit exports display only account numbers, invoice references, and customer identifiers.

