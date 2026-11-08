# Phase 7.2 — Stage B.4: Unresolved Policy Gates
## Register of External Specialist Reviews & Pre-Implementation Prerequisites

**Workspace:** `D:\OX-DIGITAL\Mathe\OX-DIGITAL-GITHUB`  
**Git Repository:** `https://github.com/hosamsamer019/ox-digital-Education.git`  
**Git HEAD:** `0500b93e65c24ed881349c4acea7f523332c5e9f` (branch `main`)  
**Phase:** 7.2 — Pricing Catalog & Subscription Agreements  
**Stage:** Stage B.4 — Product Owner Decision Workshop  
**Date:** November 2026  
**Final Status:** `TASK 7.2 STAGE B.4 — PRODUCT OWNER DECISION WORKSHOP — NO IMPLEMENTATION OR DATABASE AUTHORIZATION`  

---

## 1. Executive Summary & Regulatory Boundary

While all product and architectural policy choices were resolved by the Product Owner during the Stage B.4 Workshop, full legal and accounting compliance requires **external professional validation** before downstream financial tasks (Tasks 7.3 through 7.7) can be implemented.

> [!CRITICAL]
> **Regulatory Boundary:** Engineering design and software architecture cannot substitute for certified legal or accounting counsel. The gates documented below require formal written opinions from certified Egyptian practitioners.

---

## 2. External Specialist Review Gates

| Policy Gate | Statutory & Regulatory Domain | Required External Specialist | Deliverable / Output Required | Downstream Task Blocked |
|---|---|---|---|---|
| **UP-701** | Egyptian Commercial Accounting Standards (EAS) | Certified Egyptian Public Accountant (مراقب حسابات قانوني) | Formal sign-off on the standard 5-digit institutional Chart of Accounts (COA) structure and account code mapping. | **Task 7.5 (General Ledger)** |
| **UP-702** | Egyptian Value Added Tax Law (Law 67/2016) & ETA e-Invoicing Mandates | Egyptian Tax Counsel / Licensed Tax Advisor (مستشار ضريبي) | Written tax opinion determining: (1) Institution VAT exemption eligibility under Article 26 / Table of Exemptions; (2) ETA e-Invoicing phase requirements for B2B; (3) ETA e-Receipt phase for B2C student payments. | **Task 7.3 (Invoicing)** |
| **UP-706** | Egyptian Consumer Protection Law (Law 181/2018) | Egyptian Commercial Legal Counsel | Written legal review confirming the enforceability of the fixed administrative cancellation processing fee and digital content withdrawal conditions. | **Task 7.4 (Payments & Refunds)** |
| **UP-713** | Institutional Legal Entity Formation | Corporate Legal Advisor | Determination of tax registration profile, commercial registry registration, and licensing status (Ministry of Education vs commercial training entity). | **Task 7.3 (Invoicing)** |
| **UP-715** | Egyptian Personal Data Protection Law (Law 151/2020) | Data Privacy & Compliance Attorney | Formal legal validation that retaining immutable `userId` references on financial ledgers for 5–10 years while scrubbing PII satisfies Egyptian data privacy erasure mandates. | **Task 7.7 (Auditing & Compliance)** |

---

## 3. Upstream Technical Prerequisites (Task 7.1 Staging Gate)

In addition to specialist legal/tax opinions, Task 7.2 implementation is strictly gated by physical technical prerequisites in Task 7.1:

```
[ Task 7.1 Remediation Completed Locally (74 Tests Passing) ]
                             │
                             ▼
[ Task 7.1 Staging PostgreSQL Deployment ]  <-- HARD PREREQUISITE GATE
  - Execute Migration: 20261102_task_7_1_institution_branch_foundation
  - Execute Backfill: scripts/backfill_task_7_1_tenancy.ts
  - Run Staging Benchmark: Measure maintenance window duration (OD-717)
  - Verify 28-Model Referential Integrity
                             │
                             ▼
[ Task 7.2 Stage D Implementation Authorized ]
```

### Technical Elements Permitted to Proceed vs. Blocked:
- **PERMITTED (Design & Mock Phase):**
  - Finalizing Stage B documentation and API contracts.
  - Authoring in-memory mock unit tests for pricing resolution and agreement state transitions.
  - Drafting migration SQL in staging branch.
- **STRICTLY BLOCKED:**
  - Modifying `packages/database/prisma/schema.prisma`.
  - Generating Prisma migrations for Task 7.2.
  - Executing legacy `CourseEnrollment` conversion on any database.
  - Live staging or production deployment.

---

## 4. Explicit Governance Statement

```
TASK 7.2 STAGE B.4 — PRODUCT OWNER DECISION WORKSHOP — NO IMPLEMENTATION OR DATABASE AUTHORIZATION
```

