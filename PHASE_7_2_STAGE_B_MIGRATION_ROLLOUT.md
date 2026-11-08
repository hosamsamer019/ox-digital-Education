# Phase 7.2 — Stage B: Architecture Design
## Document 5: Migration Strategy & Rollout Plan

**Workspace:** `D:\OX-DIGITAL\Mathe\OX-DIGITAL-GITHUB`  
**Phase:** 7.2 — Pricing Catalog & Subscription Agreements  
**Stage:** Stage B — Architecture Design  
**Date:** November 2026  
**Status:** DESIGN ONLY — IMPLEMENTATION NOT AUTHORIZED  

---

## 1. Upstream Staging Validation Prerequisite

Task 7.2 database migrations and code deployment are strictly gated by the formal completion and verification of Task 7.1 in Staging:

```
[ Task 7.1 Staging Deployment ] 
        │
        ├─► Apply Migration: 20261102_task_7_1_institution_branch_foundation
        ├─► Execute Backfill: scripts/backfill_task_7_1_tenancy.ts
        └─► Verify: All existing Users, Courses, Media have valid institutionId
        │
        ▼
[ Formal Staging Sign-Off (OD-716, OD-717, OD-720) ]
        │
        ▼
[ Task 7.2 Migration Authorized for Deployment ]
```

> [!WARNING]
> No Task 7.2 migrations or backfill scripts may be executed in any environment until the Task 7.1 migration and backfill have completed without referential integrity defects on a production-scale staging snapshot.

---

## 2. 3-Phase Non-Breaking Migration Strategy

To guarantee continuous student access and prevent checkout interruptions, Phase 7.2 utilizes an expandable dual-phase cutover architecture:

```
===================================================================================
PHASE 1: DUAL-READ / EXPAND (Shadow Pricing & Agreement Mirroring)
  - Single Source of Truth: Legacy Course.price & CourseEnrollment
  - Deploy new pricing & agreement tables (non-nullable columns have defaults or are nullable).
  - Background job backfills existing courses into a default PriceCatalog and active PriceVersion.
  - Background job mirrors existing CourseEnrollment records into ACTIVE SubscriptionAgreements (isGrandfathered: true).
  - LMS access queries check SubscriptionAgreement; fall back immediately to CourseEnrollment.
===================================================================================
                                      │
                                      ▼
===================================================================================
PHASE 2: DUAL-WRITE / CONTRACT (Catalog Authoritative)
  - Single Source of Truth: PriceCatalog & SubscriptionAgreement
  - Checkout flows require PriceVersion or SubscriptionAgreement ID.
  - New checkouts write to SubscriptionAgreement first, then dual-write to CourseEnrollment.
  - Primary Manager price edits write to PriceCatalog and sync backward to Course.price.
===================================================================================
                                      │
                                      ▼
===================================================================================
PHASE 3: COMPLETE CUTOVER / DEPRECATION
  - Single Source of Truth: PriceCatalog & SubscriptionAgreement Only
  - Course.price marked @deprecated in schema.
  - CourseEnrollment subordinated to SubscriptionAgreement.
  - Legacy dual-write adapters permanently removed.
===================================================================================
```

---

## 3. Duplicate Financial Event Prevention

During dual-read and dual-write phases, the risk of duplicate charges, invoices, or journal entries is mitigated through three cryptographic and database guarantees:

1. **Deterministic Idempotency Key:**
   - Every checkout initiation generates an `idempotencyKey` derived from:
     $$\text{hash}(\text{institutionId} + \text{studentId} + \text{courseId} + \text{billingPeriodStart})$$
   - Payment webhooks matching an existing key within a 24-hour window return the cached success response without re-triggering agreement or invoice generation.
2. **Database Unique Constraints:**
   - `SubscriptionAgreement` enforces unique index: `@@unique([institutionId, agreementNumber])`.
   - `SubscriptionRenewal` enforces unique index: `@@unique([agreementId, renewalIndex])`.
   - `SessionConsumption` enforces unique constraint: `@@unique([attendanceId])`.
3. **Transactional Boundary Enforcement:**
   - Database operations creating an agreement, capturing payment, and updating access run inside an explicit PostgreSQL `SERIALIZABLE` or `READ COMMITTED` transaction with row-level locks on the parent agreement.

---

## 4. Phase-by-Phase Rollback & Contingency Plan

| Failure Mode | Phase | Immediate Impact | Automated Rollback Procedure |
|---|---|---|---|
| **Shadow Backfill Script Failure** | Phase 1 | Script terminates on unmapped legacy record. | Zero production impact. Fix script logic, purge partially populated shadow tables (`price_catalogs`, `subscription_agreements`), and re-run. |
| **Pricing Resolution Drift** | Phase 2 | Checkout calculates incorrect override price. | Revert feature flag `ENABLE_CATALOG_PRICING=false`. Checkout immediately switches back to reading `Course.price`. |
| **LMS Access Denial for Valid Student** | Phase 2 | Student unable to view purchased video. | Evaluator fallback automatically checks `CourseEnrollment` if agreement lookup returns false or errors. |
| **Database Lock Contention During Migration** | Phase 1 | `ALTER TABLE` locks schema. | Migration uses `CONCURRENTLY` on index creation and adds nullable columns without table rewrites. Transaction timeout set to 5 seconds. |

---

## 5. Pre- and Post-Migration Validation Protocols

### 5.1 Pre-Migration Integrity Checks
1. Verify Task 7.1 migration presence:
   ```sql
   SELECT migration_name, finished_at 
   FROM _prisma_migrations 
   WHERE migration_name LIKE '%task_7_1%' AND rolled_back_at IS NULL;
   ```
2. Verify zero orphaned courses:
   ```sql
   SELECT COUNT(*) FROM courses WHERE institution_id IS NULL;
   -- Must return 0.
   ```

### 5.2 Post-Migration Verification Queries
1. Confirm all courses have a default catalog item:
   ```sql
   SELECT c.id, c.title 
   FROM courses c 
   LEFT JOIN price_catalog_items pci ON pci.course_id = c.id 
   WHERE pci.id IS NULL;
   -- Must return 0 rows.
   ```
2. Confirm agreement count equals or exceeds active enrollment count:
   ```sql
   SELECT 
     (SELECT COUNT(*) FROM course_enrollments) AS total_legacy_enrollments,
     (SELECT COUNT(*) FROM subscription_agreements WHERE is_grandfathered = true) AS backfilled_agreements;
   -- Difference must be 0.
   ```

