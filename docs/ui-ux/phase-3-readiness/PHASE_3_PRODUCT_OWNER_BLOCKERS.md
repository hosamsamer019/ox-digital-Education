# OX-DIGITAL Education — Phase 3 Readiness Assessment
# Product Owner Blockers & Specialist Pre-Production Gates

**Workspace:** `D:\OX-DIGITAL\Mathe\OX-DIGITAL-GITHUB`  
**Target:** `docs/ui-ux/phase-3-readiness/PHASE_3_PRODUCT_OWNER_BLOCKERS.md`  
**Execution Mode:** STRICTLY READ-ONLY TECHNICAL ASSESSMENT  
**Baseline References:** `PHASE_2_PENDING_DECISIONS_AND_GATES.md` (Batch 6), Authoritative Product Owner Decisions

---

## 1. Executive Summary

This document categorizes all remaining open policy decisions and specialist governance gates that intersect with the technical implementation of OX-DIGITAL Education.

To ensure rapid engineering progress while preserving absolute compliance, each blocker is classified into:
1. **Implementation Isolation Strategy:** How engineers can safely build underlying software infrastructure (using interfaces, stubs, and feature flags) without being blocked.
2. **Hard Production Blocker:** Capabilities that **cannot** be deployed to live production without explicit Product Owner resolution or external specialist sign-off.

---

## 2. Unresolved Policy Decisions (UP / OD Register)

The table below details the active unresolved decisions, their architectural impact, and the engineering isolation strategy:

| Decision ID | Policy Title | Current Status | Technical Impact | Engineering Isolation Strategy (Safe Path Forward) |
| :--- | :--- | :---: | :--- | :--- |
| **`UP-704`** | Teacher Variable Compensation Base | `UNRESOLVED` | Formula for calculating teacher performance dues (per-student, per-hour, or fixed percentage) is undefined. | **Interface & Stub:** Model `TeacherCompensationService` as an abstract interface. Implement dual-prerequisite session logging now; stub variable payout calculation with a configurable placeholder until PO decides. |
| **`UP-705`** | Cashbox Discrepancy Sign-Off Policy | `UNRESOLVED` | Final financial settlement for physical till variances (write-off vs employee liability vs institutional loss) is open. | **Neutral Investigation Dossier:** Build the full reconciliation screen and `DiscrepancyInvestigationDossier` UI/DB entity. Mark discrepancies as `PENDING_INVESTIGATION`. Block posting of automated GL adjustment journals. |
| **`UP-708`** | FX Rate Source Provenance | `UNRESOLVED` | Official source for foreign exchange rates (Central Bank of Egypt vs commercial API) is undefined. | **Launch Currency Fixity:** Enforce launch currency strictly as `EGP` (OD-702). Include optional `currency` column in schema for ISO-4217 extensibility, but hardcode rate to 1.00 and disable multi-currency UI. |
| **`UP-710`** | Overdue Payment Grace Periods & Penalties | `UNRESOLVED` | Business policy regarding grace periods, suspension of LMS access, or late penalty fees is undefined. | **Read-Only Milestone Tracking:** Implement milestone schedules (`PaymentScheduleItem`) showing `dueDate` and `remainingBalance`. Do NOT implement automated penalty fees, interest calculations, or account locks. |
| **`UP-711`** | Third-Party Collection Agent Fees | `UNRESOLVED` | Accounting treatment of commission fees deducted by external collection agents (e.g. Fawry, Aman). | **Gross Collection Recording:** Record 100% of collected student amount in sub-ledger. Defer automated net settlement fees until PO defines third-party agent contract rules. |
| **`UP-712`** | Student Absence Credit vs. Forfeiture | `UNRESOLVED` | Whether a student who misses an active lesson retains credit or forfeits session value is open. | **Equal Session Recognition:** Recognize revenue based strictly on signed teacher delivery evidence for the class session (OD-722.4). Individual absence adjustments remain manual accountant interventions. |
| **`UP-713`** | External Legal Entity Structure | `UNRESOLVED` | Corporate holding structure vs multi-company statutory separation is undefined. | **Branch Multi-Tenancy:** Maintain clean operational multi-tenancy at the `Institution` and `Branch` level (OD-703). Isolate corporate tax/statutory entity models from the current operational release. |
| **`OD-710`** | Payment Gateway Merchant Credentials | `UNRESOLVED` | Selection and credentialing of live Egyptian online payment processors (Paymob, FawryPay). | **Cash & Manual Bank Wire Focus:** Complete physical cashbox and manual bank transfer intake workflows first. Provide clean webhooks/API interfaces for gateway integration when credentials arrive. |
| **`OD-724.5`**| Offline Till Receipt Thermal Hardware | `UNRESOLVED` | ESC/POS thermal receipt printer specifications and browser driver integration are undefined. | **Standard Web Print Stylesheet:** Implement print-optimized CSS for collection receipts (`window.print()`). Defer native USB/raw thermal printer driver integration to a hardware phase. |

---

## 3. Specialist Pre-Production Governance Gates

Before the financial modules can be deployed into a live production environment with real monetary transactions, the following **7 Mandatory Specialist Gates** must be formally satisfied and signed off:

```mermaid
flowchart LR
    G1["Gate 1: CPA Statutory Review (UP-701)"] --> G2["Gate 2: Consumer Protection / Legal"]
    G2 --> G3["Gate 3: Data Protection / DPO"]
    G3 --> G4["Gate 4: Security Pentest"]
    G4 --> G5["Gate 5: Banking Compliance"]
    G5 --> G6["Gate 6: Labor Law Review"]
    G6 --> G7["Gate 7: Executive Discrepancy Policy"]
    G7 --> Prod["Live Production Release"]
```

### Gate 1: Mandatory CPA Review of Statutory Chart of Accounts (UP-701)
- **Authority:** Certified Public Accountant (CPA) / Egyptian Statutory Auditor.
- **Requirement:** Review and approve the account codes, hierarchy, and debit/credit mapping of the General Ledger Bridge (`ACC-GL-01`) against Egyptian Accounting Standards (EAS).
- **Engineering Status:** Operational cashbox and student sub-ledgers can be built; GL journal posting export remains locked until signed.

### Gate 2: Consumer Protection & Legal Review of Student Refunds
- **Authority:** Institutional Legal Counsel / Egyptian Consumer Protection Agency specialist.
- **Requirement:** Formal verification that student enrollment agreement terms, milestone forfeiture clauses, and refund reversal workflows comply with educational consumer protection regulations.
- **Engineering Status:** Reversal mechanics (`SFP-ADJ-01`) built with immutable audit trails; operational refund rules configured per legal guidelines.

### Gate 3: Data Protection Officer (DPO) Sign-Off for Financial Retention
- **Authority:** Data Protection Officer / Compliance Specialist.
- **Requirement:** Approval of financial document storage (`SFP-DOC-01`), encryption at rest, access logging, and retention periods (e.g. 5–10 years for statutory tax audits under Egyptian law).
- **Engineering Status:** Document metadata modeled in schema; actual S3/storage buckets configured with WORM (Write Once, Read Many) policies.

### Gate 4: Independent Security Penetration Testing
- **Authority:** Certified Ethical Hacker / Third-Party Cybersecurity Firm.
- **Requirement:** Rigorous penetration testing of all financial endpoints, verifying that multi-tenant isolation cannot be bypassed, Maker-Checker boundaries are tamper-proof, and IDOR attacks are impossible.
- **Engineering Status:** Complete test suite and strict JWT/Prisma tenancy middleware implemented in Workstream B and Workstream I.

### Gate 5: Banking Compliance for Settlement
- **Authority:** Partner Bank / Payment Aggregator Compliance Officer.
- **Requirement:** Verification of merchant KYC, electronic settlement reconciliation workflows, and anti-money laundering (AML) controls for student intake.
- **Engineering Status:** Scoped to cash and manual bank wire intake initially.

### Gate 6: Labor Law Specialist Review of Teacher Compensation
- **Authority:** Labor Law Attorney.
- **Requirement:** Legal sign-off that variable compensation calculations based on attendance and delivery evidence comply with Egyptian Labor Law No. 12.
- **Engineering Status:** Payout module kept in draft/review state (`PM-TCH-01`) pending formula approval under UP-704.

### Gate 7: Executive Institutional Sign-Off on Discrepancy Policy (UP-705)
- **Authority:** Institution Board of Directors / Chief Financial Officer.
- **Requirement:** Formal written policy establishing acceptable cashbox variance tolerances, mandatory police reporting thresholds, and employee liability rules.
- **Engineering Status:** Discrepancy investigation dossier (`CBM-DISC-01`) built in neutral state, ready to apply approved workflow.

---

## 4. Implementation Guidance Matrix

| Can Be Implemented Immediately (Zero Blocker) | Requires Interface Stubs / Feature Flags | Strictly Blocked from Production Deployment |
| :--- | :--- | :--- |
| - Prisma Financial Schema (11 Models) | - Teacher Variable Compensation (`UP-704`) | - Automated Discrepancy Write-Offs (`UP-705`) |
| - Express Financial API Router & Middleware | - Online Payment Gateways (`OD-710`) | - Multi-Currency Conversion (`UP-708`) |
| - Application Shell & Unified Navbars | - Thermal Printer Drivers (`OD-724.5`) | - Live Statutory GL Sync (`UP-701` / Gate 1) |
| - Cashbox Directory & 5-Stage Transfers | - Student Late Penalty Calculations (`UP-710`) | - Live Financial Transactions without Pentest (Gate 4) |
| - Daily Shift Reconciliation Engine | | |
| - Student Agreement & Waterfall Allocations | | |
| - Dual-Prerequisite Revenue Engine | | |
| - Role Isolation & Super-Admin Quarantine | | |

