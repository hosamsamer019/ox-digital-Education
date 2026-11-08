# OX-DIGITAL Education — Phase 4: Workstream A
## Step A0: Pre-Implementation Schema Audit & Migration Plan
### Deliverable 6: Migration & Rollback Strategy (Zero-Downtime Methodology & Proposed Rollback Runbook)

**Workspace:** `D:\OX-DIGITAL\Mathe\OX-DIGITAL-GITHUB`  
**Target:** `docs/phase-4/workstream-a/step-a0/MIGRATION_AND_ROLLBACK_STRATEGY.md`  
**Execution Mode:** STRICTLY READ-ONLY AUDIT & IMPLEMENTATION PLANNING  
**Date:** November 4, 2026 (Reconciled)  
**Author:** Lead Software Architect & Financial Systems Security Reviewer  

---

## 1. Executive Summary

Applying schema changes to an active educational platform requires a structured, non-breaking migration methodology. Any migration that locks tables for extended periods, deletes existing columns, or introduces incompatible types can disrupt active academic users (teachers taking attendance, students watching lessons, or parents reviewing grades).

This document establishes the **Migration & Proposed Rollback Methodology** governing Phase 4 Workstream A. In strict adherence to audit governance, migration safety is evaluated across clear verification tiers, distinguishing design-level evaluations from future staging execution evidence.

---

## 2. The Expand-and-Contract Architecture (Design-Level Assessment)

Workstream A operates exclusively in the **"Expand" Phase**:
* All proposed database changes are **Design-Level Additive**.
* Zero pre-existing tables (`User`, `Course`, `Lesson`, `Attendance`, `Payment`, etc.) will be dropped or renamed.
* Zero pre-existing columns will be removed or have their data types altered.
* Existing academic and administrative features will continue running without awareness of the new financial tables.
* Backwards compatibility is preserved by design; if the application is rolled back to a previous Git commit, the pre-existing codebase continues functioning normally alongside the dormant financial tables.

---

## 3. Safe Migration Invariants

When the SQL migration script is drafted in Step A2, it must satisfy seven mandatory safety invariants:

1. **Transactional DDL Execution:**  
   PostgreSQL supports transactional DDL. The entire migration script must run inside a single transaction block:
   ```sql
   BEGIN;
   -- All DDL statements
   COMMIT;
   ```
   If any statement fails (e.g. syntax error or foreign key violation), the entire migration automatically aborts, rolling back the database to its pristine pre-migration state without leaving orphaned tables.
2. **Strict Append-Only Deletion Safeguards:**  
   Every foreign key added must specify `ON DELETE RESTRICT`. Never use `ON DELETE CASCADE` or `ON DELETE SET NULL` on financial lines.
3. **Non-Blocking Index Creation:**  
   Indexes on newly created tables can be created inline during table definition. If indexes are added to existing high-traffic tables (e.g. `User`), they should use `CREATE INDEX CONCURRENTLY` outside transaction blocks if table locking is a concern.
4. **Zero Default Inventions for Unresolved Decisions:**  
   The migration must not insert speculative seed data or default formulas for unresolved decisions (`UP-701`, `UP-704`, `UP-705`, `UP-708`).
5. **Idempotent DDL Statements:**  
   Use `CREATE TABLE IF NOT EXISTS`, `CREATE INDEX IF NOT EXISTS`, and `DO $$ ... $$` blocks for enums to ensure the script can be safely re-run without crashing if partially applied.

---

## 4. Proposed Rollback Strategy & Draft Reverse DDL

If a defect is discovered during future staging verification or deployment, a structured rollback plan must be immediately available. Because PostgreSQL enforces referential integrity, rollback must execute in **strict reverse topological order**.

> [!WARNING]
> **Proposed Strategy Notice:**  
> The DDL script below represents a **Proposed Rollback Strategy / Draft Reverse DDL Script**. Because Step A0 is strictly read-only and has not executed any database modifications, this script has NOT been executed or verified against a live database. Runtime execution verification will take place in Step A5.

### 4.1 Reverse Topological Rollback Plan:
1. **Drop Tier 4 (Bridge & Revenue Tables):**
   - Drop `PaymentAllocation`
   - Drop `RevenueRecognitionEntry`
2. **Drop Tier 3 (Sub-Ledger Lines, Adjustments & Milestones):**
   - Drop `CollectionReceipt`
   - Drop `PaymentScheduleItem`
   - Drop `FinancialAdjustment`
3. **Drop Tier 2 (Operational Masters & State Machines):**
   - Drop `DailyCashboxReconciliation`
   - Drop `ExpenseVoucher`
   - Drop `CashboxTransferRequest`
   - Drop `CashboxMovement`
   - Drop `StudentAgreement`
   - Drop `LessonDeliveryEvidence`
4. **Drop Tier 1 (Master Tables & Infrastructure):**
   - Drop `Cashbox`
   - Drop `FinancialAuditEvent`
   - Drop `FinancialIdempotencyRecord`
5. **Drop Tier 0 (PostgreSQL Enums):**
   - Drop `PaymentAllocationMethod`
   - Drop `AgreementStatus`
   - Drop `ReconciliationStatus`
   - Drop `TransferStatus`
   - Drop `CashboxMovementType`
   - Drop `CashboxStatus`

### 4.2 Proposed Reverse DDL Script (`rollback_step_a1.sql` Draft):

```sql
-- ==============================================================================
-- OX-DIGITAL Education — Workstream A Proposed Rollback Script (Reverse Topological Order)
-- Scope: Draft DDL to reverse proposed Step A1 financial schema additions
-- Status: PROPOSED DRAFT (Not executed; to be verified during Step A5 staging tests)
-- ==============================================================================

BEGIN;

-- 1. Drop Tier 4 Bridge & Allocation Tables
DROP TABLE IF EXISTS "PaymentAllocation" CASCADE;
DROP TABLE IF EXISTS "RevenueRecognitionEntry" CASCADE;

-- 2. Drop Tier 3 Sub-Ledger Items, Receipts & Adjustments
DROP TABLE IF EXISTS "CollectionReceipt" CASCADE;
DROP TABLE IF EXISTS "PaymentScheduleItem" CASCADE;
DROP TABLE IF EXISTS "FinancialAdjustment" CASCADE;

-- 3. Drop Tier 2 Operational Tables
DROP TABLE IF EXISTS "DailyCashboxReconciliation" CASCADE;
DROP TABLE IF EXISTS "ExpenseVoucher" CASCADE;
DROP TABLE IF EXISTS "CashboxTransferRequest" CASCADE;
DROP TABLE IF EXISTS "CashboxMovement" CASCADE;
DROP TABLE IF EXISTS "StudentAgreement" CASCADE;
DROP TABLE IF EXISTS "LessonDeliveryEvidence" CASCADE;

-- 4. Drop Tier 1 Master Financial & Infrastructure Tables
DROP TABLE IF EXISTS "Cashbox" CASCADE;
DROP TABLE IF EXISTS "StudentFinancialAccount" CASCADE;
DROP TABLE IF EXISTS "GroupPricingAgreement" CASCADE;
DROP TABLE IF EXISTS "FinancialAuditEvent" CASCADE;
DROP TABLE IF EXISTS "FinancialIdempotencyRecord" CASCADE;

-- 5. Drop Tier 0 Financial Enums
DROP TYPE IF EXISTS "PaymentAllocationMethod";
DROP TYPE IF EXISTS "AgreementStatus";
DROP TYPE IF EXISTS "ReconciliationStatus";
DROP TYPE IF EXISTS "TransferStatus";
DROP TYPE IF EXISTS "CashboxMovementType";
DROP TYPE IF EXISTS "CashboxStatus";

COMMIT;
```

---

## 5. Failure Scenarios & Disaster Recovery Runbook

| Failure Scenario | Immediate Impact | Recovery Protocol |
| :--- | :--- | :--- |
| **Prisma Validation Fails (`npx prisma validate`)** | CLI syntax error before migration generation. | Zero database impact. Correct model typing in `schema.prisma` and re-validate. |
| **SQL Syntax Error During Migration** | PostgreSQL transaction aborts automatically. | Zero database impact. Transaction rolls back cleanly. Fix SQL and re-apply. |
| **Deadlock on Existing Table** | Migration hangs attempting to acquire lock on `User` or `Institution`. | Abort migration. Schedule execution during low-traffic maintenance window. |
| **Post-Migration Bug in Application Code** | New financial routes fail, but existing academic features unaffected. | Application rollback to previous Git commit. Database remains intact because changes are purely additive. |
| **Total Migration Reversal Required** | Product Owner instructs total removal of financial tables. | Execute `rollback_step_a1.sql` draft. Verify all 31 core models remain 100% operational. |

---

## 6. Pre-Execution Verification Checklist (For Future Steps)

Before applying any migration in Step A2/A3:
- [ ] Database backup snapshot created and verified.
- [ ] Staging dry-run executed with zero errors.
- [ ] SQL migration script inspected line-by-line for destructive DDL (`DROP`, `ALTER TYPE`).
- [ ] Rollback draft script tested in an isolated staging/shadow database.
- [ ] Formal Product Owner authorization confirmed.
