# Phase 7.2 — Stage B.4.2: Dependency Gates
## Upstream Prerequisites, Specialist Approvals & Execution Boundaries

**Workspace:** `D:\OX-DIGITAL\Mathe\OX-DIGITAL-GITHUB`  
**Git Repository:** `https://github.com/hosamsamer019/ox-digital-Education.git`  
**Git HEAD:** `0500b93e65c24ed881349c4acea7f523332c5e9f` (branch `main`)  
**Phase:** 7.2 — Pricing Catalog & Subscription Agreements  
**Stage:** Stage B.4.2 — Final Product Owner Decision Closure & Implementation Authorization Readiness  
**Date:** November 2, 2026  
**Final Status:** `STAGE B.4.2 — FINAL DOCUMENTATION RECONCILIATION — NO IMPLEMENTATION OR DATABASE AUTHORIZATION`  

---

## 1. Executive Dependency Architecture

Before any application source code or database migrations for Task 7.2 can be implemented or deployed, two mandatory categories of prerequisite gates must be satisfied:

```
+----------------------------------------------------------------------------------------------------+
| 1. TECHNICAL DEPENDENCY: TASK 7.1 STAGING GATEWAY (Physical PostgreSQL Validation)                |
+----------------------------------------------------------------------------------------------------+
                                                  │
                                                  ▼
+----------------------------------------------------------------------------------------------------+
| 2. GOVERNANCE DEPENDENCY: FORMAL STAGE C SIGN-OFF & EXTERNAL SPECIALIST REVIEWS                    |
+----------------------------------------------------------------------------------------------------+
                                                  │
                                                  ▼
+----------------------------------------------------------------------------------------------------+
| 3. TASK 7.2 STAGE D IMPLEMENTATION AUTHORIZED                                                      |
+----------------------------------------------------------------------------------------------------+
```

---

## 2. Upstream Task 7.1 Technical Dependency Gate

> [!CRITICAL]
> **Hard Physical Blocker:** While Task 7.1 codebase remediation is complete and verified locally with 74 passing tests, the physical PostgreSQL database migration (`20261102_task_7_1_institution_branch_foundation`) and offline backfill script (`scripts/backfill_task_7_1_tenancy.ts`) have **NOT** been applied to any live or staging database.

### 2.1 Reality Check on Task 7.1 Evidence:
1. **Mocked Tests $\ne$ Physical Database Deployment:**
   - The 74 passing tests in `tests/task_7_1/` execute against mocked database repositories and in-memory data structures.
   - They demonstrate controller and service logic in isolation, but **do not establish** PostgreSQL migration success, table lock safety, index performance, or foreign-key integrity under real database workloads.
2. **Backfill Script Unexecuted:**
   - The backfill script (`scripts/backfill_task_7_1_tenancy.ts`) has **not** been run against real legacy data.
   - In any active PostgreSQL environment, legacy `User`, `Course`, and `ProcessedMedia` records currently lack non-nullable `institutionId` values.
3. **Task 7.2 Structural Failure Invariant:**
   - The proposed Task 7.2 models (`PriceCatalog`, `PriceVersion`, `SubscriptionAgreement`, `SessionPackage`) establish foreign keys directly targeting `Institution(id)` and `Branch(id)`.
   - Attempting to generate or apply Task 7.2 migrations in PostgreSQL before Task 7.1 is applied will result in an immediate database relational error (`relation "institutions" does not exist`).

### 2.2 Task 7.1 Staging Prerequisite Checklist:
Before Task 7.2 physical implementation can begin:
- [ ] Task 7.1 migration executed cleanly in Staging PostgreSQL.
- [ ] Task 7.1 authoritative backfill script executed in Staging.
- [ ] Maintenance window benchmark duration measured and recorded (OD-717).
- [ ] All 28 data models verified with zero cross-tenant orphaned records.
- [ ] Foreign-key referential integrity fully validated in physical schema.

---

## 3. External Specialist Review Gates

The table below delineates the statutory and professional reviews required before downstream financial modules can be implemented:

| Module / Milestone | Specialist Review Required | Professional Standard & Regulatory Domain | Deliverable Required Before Implementation |
|---|---|---|---|
| **Task 7.3: Invoicing** | **Qualified Egyptian Tax Counsel** | Egyptian Value Added Tax Law (Law 67/2016) & ETA e-Invoicing/e-Receipt Mandates (UP-702, UP-713). | Written legal tax opinion specifying: (1) Institution VAT exemption eligibility; (2) ETA B2B e-Invoicing phase requirements; (3) ETA B2C e-Receipt requirements. |
| **Task 7.4: Payments & Refunds** | **Commercial Legal Counsel** | Egyptian Consumer Protection Law (Law 181/2018) regarding digital content withdrawal and administrative cancellation fees (UP-706). | Written legal opinion validating administrative fee enforceability and contractual non-refundable conditions. |
| **Task 7.5: General Ledger** | **Certified Egyptian Public Accountant** | Egyptian Commercial Accounting Standards (EAS) regarding 5-digit Chart of Accounts structure (UP-701). | Signed formal Chart of Accounts mapping and revenue recognition policy approval. |
| **Task 7.7: Auditing & Compliance** | **Data Privacy Attorney** | Egyptian Personal Data Protection Law (Law 151/2020) regarding statutory retention vs. PII erasure (UP-715). | Written privacy counsel validation of statutory financial retention workflows and PII scrubbing scripts. |

---

## 4. Execution Boundaries: What is Permitted vs. Prohibited

### 4.1 Permitted Activities (Design & Preparation Phase):
- Authoring and updating architectural specifications and documentation.
- Designing API schemas, request/response contracts, and TypeScript interfaces.
- Authoring in-memory mock unit test suites for pricing resolution and agreement state transitions.
- Authoring draft migration SQL in isolated development branches for review.

### 4.2 Strictly Prohibited Activities (Pending Authorization):
- Modifying `packages/database/prisma/schema.prisma`.
- Generating or applying Prisma migrations (`prisma migrate dev/deploy`).
- Connecting to live or staging PostgreSQL databases or executing SQL.
- Executing data backfill, conversion, or transformation scripts.
- Modifying Docker, infrastructure, environment variables, or CI/CD pipelines.
- Committing, pushing, resetting, or switching Git branches.
- Implementing payment gateway webhooks or General Ledger posting code.

---

## 5. Exact Next Authorized Governance Steps

1. **Conduct Product Owner Executive Session:** Present the canonical Stage B.4.2 Decision Register and Open Decisions Matrix for formal Stage C approval.
2. **Authorize Task 7.1 Staging Benchmark:** Deploy Task 7.1 migration and offline backfill to Staging PostgreSQL to fulfill the technical prerequisite gate.
3. **Engage External Tax Counsel & Accountant:** Commission written opinions for UP-701 and UP-702 to unblock Task 7.3 and Task 7.5.

---

## 6. Explicit Governance Statement

```
STAGE B.4.2 — FINAL DOCUMENTATION RECONCILIATION — NO IMPLEMENTATION OR DATABASE AUTHORIZATION
```

