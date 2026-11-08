# OX-DIGITAL Education — Accounting Track
# Phase 2.0A.1: Architecture Correction Matrix

**Author:** Independent Senior Financial Systems Architect & Principal Auditor  
**Project:** OX-DIGITAL Education  
**Workspace:** `D:\OX-DIGITAL\Mathe\OX-DIGITAL-GITHUB`  
**Git Baseline Commit:** `0500b93e65c24ed881349c4acea7f523332c5e9f` on branch `main`  
**Date:** November 3, 2026

---

## 1. Executive Purpose

This matrix establishes the authoritative reconciliation of all six architectural corrections identified in the Phase 2.0A review, citing the original finding, verified source-code evidence, specific technical correction applied, affected documentation deliverables, remaining operational risks, and final acceptance status.

---

## 2. Comprehensive Correction Matrix

| Correction ID & Domain | Original Phase 2.0A Finding | Verified Codebase Evidence | Specific Architecture Correction Applied | Documentation Files Affected | Remaining Risk & Mitigation | Acceptance Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **CORR-A**<br>**Attendance & Financial Evidence Retention** | Stated that attendance records could disappear on student deletion, but lacked explicit delete-policy matrix and multi-stage distinction. | [`schema.prisma#L297`](file:///D:/OX-DIGITAL/Mathe/OX-DIGITAL-GITHUB/packages/database/prisma/schema.prisma#L297):<br>`student User @relation(fields: [studentId], references: [id], onDelete: Cascade)`. | 1. Defined 5-stage distinction: Academic Attendance, Lesson Delivery, Session Consumption, Revenue Recognition, Posted Journal.<br>2. Mandated `onDelete: Restrict` for all financially referenced evidence.<br>3. Specified compensating adjustment workflow for post-recognition attendance corrections. | `..._ROLE_SECURITY_RETENTION.md`<br>`..._CENTER_INTEGRATION_MAPPING.md`<br>`..._ERD.md` | Risk: Rogue manual SQL delete on legacy table.<br>Mitigation: Phase 2 database migration alters FK to `Restrict`. | **ACCEPTED & RESOLVED** |
| **CORR-B**<br>**Teacher Variable Compensation Basis (UP-704)** | Indicated that revenue share could use a configurable basis as an approved default. | No revenue share model exists in `schema.prisma`. UP-704 is explicitly unresolved in decision register. | 1. Removed any claim that configurable basis is approved.<br>2. Removed default calculation basis.<br>3. Documented 4-stage lesson lifecycle: Scheduled $\rightarrow$ Delivered $\rightarrow$ Verified $\rightarrow$ Approved.<br>4. Re-affirmed UP-704 as a blocking Product Owner decision. | `..._CENTER_INTEGRATION_MAPPING.md`<br>`..._DECISION_REGISTER.md`<br>`..._ERD.md` | Risk: Disputed teacher payouts.<br>Mitigation: Variable model implementation blocked until PO selects basis. | **ACCEPTED & RESOLVED** |
| **CORR-C**<br>**Cashbox Discrepancy Policy (UP-705)** | Proposed a default shortage sign-off threshold of 50.00 EGP for automatic Accountant reconciliation. | No threshold exists in `schema.prisma`. UP-705 is unresolved in decision register. | 1. Completely excised "50.00 EGP" from all documentation, diagrams, and text.<br>2. Zero substitute threshold assumed.<br>3. Explicitly decoupled 5 cashbox concepts: Counted, Expected, Discrepancy, Reconciliation Status, Manager Sign-off.<br>4. All discrepancies require investigation/approval until a policy threshold is approved. | `..._CENTER_INTEGRATION_MAPPING.md`<br>`..._DECISION_REGISTER.md`<br>`..._ERD.md` | Risk: Cashier bottlenecks on small coin variances.<br>Mitigation: Product Owner must review and approve policy limit. | **ACCEPTED & RESOLVED** |
| **CORR-D**<br>**Head Office Dimension & Null Branch Safety** | Used `branchId = NULL` on `JournalLine` to represent Head Office, introducing null ambiguity. | `Branch` model in `schema.prisma#L35` represents campuses, but Head Office is an institutional dimension, not a branch. | 1. Introduced explicit `dimensionType: ENUM('HEAD_OFFICE', 'BRANCH')` on `JournalLine`.<br>2. Specified PostgreSQL check constraint:<br>`CHECK ((dimension_type = 'HEAD_OFFICE' AND branch_id IS NULL) OR (dimension_type = 'BRANCH' AND branch_id IS NOT NULL))`.<br>3. Completely eliminated validation bypass via null branch. | `..._TARGET_PERSISTENCE_ARCHITECTURE.md`<br>`..._JOURNAL_AND_IDEMPOTENCY_PERSISTENCE.md`<br>`..._ERD.md` | Risk: Data migration mapping.<br>Mitigation: Backfill script sets `dimensionType = 'HEAD_OFFICE'` when branch is null. | **ACCEPTED & RESOLVED** |
| **CORR-E**<br>**ERD Completeness & Logical Reconciliation** | Presented a 20-model ERD without formal reconciliation against all 32 logical accounting concepts. | Design contained 20 physical models but combined several concepts (e.g., price catalog items, snapshots, settlements). | 1. Produced comprehensive reconciliation matrix across all 32 logical concepts in Section 8.<br>2. Classified each concept as Persisted Entity, Value Object, Derived Projection, or External Source.<br>3. Documented exact table consolidation rationales, constraints, and cardinalities. | `..._ERD.md`<br>`..._ERD_ENTITY_RECONCILIATION.md` | Risk: Schema over-engineering.<br>Mitigation: Logical value objects embedded inside JSONB or parent tables. | **ACCEPTED & RESOLVED** |
| **CORR-F**<br>**Legacy Gateway Payment Coexistence** | Analyzed `Payment` table but needed strict coexistence boundaries to protect Paymob/Stripe online flows. | `payment.controller.ts:10` handles course gateway webhooks; `Payment.amount` is `Float`. | 1. Confirmed legacy `Payment` table remains operational for online digital courses.<br>2. Physical center collections written strictly to new `Collection` table with `Decimal(12, 2)`.<br>3. Zero conversion of old payments into cashbox collections.<br>4. Zero online gateway payments treated as immediate earned center revenue. | `..._CURRENT_DATABASE_REALITY_AUDIT.md`<br>`..._MIGRATION_AND_COEXISTENCE_STRATEGY.md`<br>`..._CENTER_INTEGRATION_MAPPING.md` | Risk: Reporting fragmentation.<br>Mitigation: Consolidated reporting views join legacy and new ledgers cleanly. | **ACCEPTED & RESOLVED** |

---

## 3. Governance Certification

All six corrections have been thoroughly inspected against source code, updated in existing documentation, cross-checked for internal consistency, and certified as compliant with the governance baseline.

