# OX-DIGITAL Education — Accounting Implementation Track
## Phase 1 — Financial Core Engine: Deferred Integration Items & Dependency Matrix

**Workspace:** `D:\OX-DIGITAL\Mathe\OX-DIGITAL-GITHUB`  
**Git HEAD:** `0500b93e65c24ed881349c4acea7f523332c5e9f` on branch `main`  
**Scope:** Explicit Inventory of Deferred Financial Capabilities & Downstream Dependencies  
**Date:** November 3, 2026  

---

## 1. Executive Summary & Boundaries

In strict adherence to the Phase 1 Implementation Authorization, the Financial Core Engine has been delivered exclusively as a pure domain model.

This document records the complete inventory of financial capabilities, database persistence models, reporting features, and statutory integrations that are **strictly deferred to subsequent phases** and were **not touched or implemented** during Phase 1.

---

## 2. Comprehensive Deferred Integration Inventory

| Deferred Capability / Module | Current Implementation Status | Governing Policy / Decision Gate | Target Downstream Phase | Blocking Prerequisite / Dependency |
| :--- | :---: | :--- | :--- | :--- |
| **Prisma Schema Ledger Models** (`Account`, `JournalEntry`, `JournalLine`) | **DEFERRED (0% schema changes)** | Stage B Data Architecture | Phase 2 (Ledger Persistence) | Requires Product Owner authorization for schema migration generation. |
| **PostgreSQL Database Migrations** | **DEFERRED (0 migrations executed)** | OD-716, OD-717 Maintenance Window | Phase 2 (Ledger Persistence) | Blocked by Task 7.1 Staging benchmark and migration deployment. |
| **Production Accounting REST API Routes** | **DEFERRED (0 routes created)** | RESTful API Design | Phase 3 (Accounting API) | Requires Phase 2 persistence repositories. |
| **Production Financial Reporting** (Trial Balance, General Ledger, P&L, Balance Sheet) | **DEFERRED (0 reporting endpoints)** | OD-703 Single GL Architecture | Phase 4 (Financial Reporting) | Requires indexed transaction persistence. |
| **Student Billing & Invoicing Integration** | **DEFERRED (Existing Payment code untouched)** | UP-702, UP-713 | Task 7.3 (Invoicing & Tax) | **POLICY_GATED_PENDING_SPECIALIST:** Requires Egyptian Tax Counsel opinion on VAT Law 67/2016 and ETA e-invoicing. |
| **Egyptian Statutory Chart of Accounts (COA)** | **DEFERRED (Configurable engine only)** | UP-701 | Task 7.5 (General Ledger Setup) | **POLICY_GATED_PENDING_SPECIALIST:** Requires written review from Certified Egyptian Public Accountant (مراقب حسابات قانوني). |
| **Accounting Period Close/Reopen Engine** | **DEFERRED (Decoupled interface implemented)** | **OD-710 (UNRESOLVED)** | Phase 2 / Task 7.5 | **PENDING_PRODUCT_OWNER_CLARIFICATION:** Requires Product Owner selection of period closing model (Monthly hard vs Soft close). |
| **Maker-Checker Dual Approval Workflow** | **DEFERRED (0 approval guards)** | UP-709 | Task 7.3 & 7.5 | Requires integration with Primary Manager workflow engine (> 10% discount, > 500 EGP cumulative adjustment). |
| **Subscription Agreements Financial Posting** | **DEFERRED (Task 7.2 decoupled)** | OD-721 to OD-726 | Task 7.2 Stage D | Blocked by Task 7.1 Staging completion. |
| **Payment Webhook Live Ledger Posting** | **DEFERRED (Fawry/Paymob webhooks untouched)** | OD-704 Accrual Accounting | Phase 3 (Payment Posting Engine) | Requires database persistence and idempotent event consumer. |

---

## 3. Policy Gates & Specialist Review Dependencies

Four critical external specialist gates govern the progression of deferred accounting modules into production:

### 3.1 Statutory Chart of Accounts (UP-701)
- **Status:** `POLICY_GATED_PENDING_SPECIALIST`.
- **Specialist Required:** Certified Egyptian Public Accountant (CPA).
- **Mandate:** Phase 1 delivers a generic, configurable `ChartOfAccounts` engine supporting 5 standard account classes. A specific 5-digit Egyptian statutory chart of accounts will **not** be hardcoded until formal CPA sign-off is obtained.

### 3.2 Egyptian VAT & ETA E-Invoicing / E-Receipt (UP-702, UP-713)
- **Status:** `POLICY_GATED_PENDING_SPECIALIST`.
- **Specialist Required:** Qualified Egyptian Tax Counsel.
- **Mandate:** Billing and invoice generation cannot post tax liabilities until written tax counsel determines the institution's exemption or liability status under Egyptian VAT Law 67/2016 and ETA e-invoicing mandates.

### 3.3 Consumer Refund & Cancellation Fees (UP-706)
- **Status:** `PROVISIONAL_SELECTION_PENDING_LEGAL`.
- **Specialist Required:** Egyptian Commercial / Consumer Protection Legal Counsel.
- **Mandate:** Reversal entries in Phase 1 support 100% full reversal. Administrative cancellation fee deductions under Law 181/2018 remain deferred until fee structures are finalized.

### 3.4 Data Retention & Statutory Ledger Archival (UP-715)
- **Status:** `POLICY_GATED_PENDING_SPECIALIST`.
- **Specialist Required:** Data Protection & Commercial Legal Counsel.
- **Mandate:** Persistent general ledger storage must balance the 10-year commercial books retention requirement against Egyptian Data Protection Law 151/2020 student PII erasure rights.

---

## 4. Preservation & Non-Interference Statement

Phase 1 development maintained 100% isolation from existing operational subsystems:
- **Zero Schema Churn:** `packages/database/prisma/schema.prisma` is completely unchanged.
- **Zero Payment Service Disruption:** Fawry, Paymob, and Stripe webhook controllers in `services/course-service/` continue operating without modification.
- **Zero Migration State Impact:** No PostgreSQL databases or staging volumes were touched.
- **Clean Monorepo Export:** All financial logic resides safely behind `@shared/utils/accounting`.

