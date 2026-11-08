# Phase 7.2 — Implementation Roadmap
## Pricing Catalog & Subscription Agreements Engine

**Workspace:** `D:\OX-DIGITAL\Mathe\OX-DIGITAL-GITHUB`  
**Phase:** 7.2 — Pricing Catalog & Subscription Agreements  
**Status:** DRAFT ROADMAP FOR STAGE A DISCOVERY & READINESS  
**Date:** November 2026  

---

## 1. Executive Summary & Phased Progression Model

Phase 7.2 establishes the commercial and contract-enforcement backbone of the OX-DIGITAL platform. Moving away from the unversioned flat-float paradigm (`Course.price Float`), Phase 7.2 introduces an immutable, audited Pricing Catalog alongside legally binding `SubscriptionAgreement` contracts.

To ensure stability across production systems and maintain strict financial auditability, Phase 7.2 adheres to the platform's standard four-stage engineering governance framework:

```
[ Stage A: Read-Only Discovery & Readiness ] <--- CURRENT STAGE
       │
       ▼
[ Stage B: Architecture & Schema Design ] (Draft Prisma models, API contracts, Mock tests)
       │
       ▼
[ Stage C: Product Owner Review Gate ] (Approval of OD-721, OD-722, Migration Strategy)
       │
       ▼
[ Stage D: Authorized Implementation ] (Schema migration, Service logic, Integration tests)
```

> [!IMPORTANT]
> **Strict Governance Boundary:** No code modifications, database schema migrations, or execution scripts are authorized during Stage A. This roadmap delineates the sequence to be executed only after formal Product Owner authorization.

---

## 2. Upstream Dependencies & System Prerequisites

Task 7.2 cannot be deployed into any environment without fulfilling the structural and data integrity prerequisites established in Task 7.1.

| Dependency | Required State | Critical Rationale |
|---|---|---|
| **Task 7.1 Schema Migration** (`20261102_task_7_1_institution_branch_foundation`) | Applied to Database | Task 7.2 models (`PriceCatalog`, `BranchPriceOverride`, `SubscriptionAgreement`) possess foreign keys targeting `Institution` and `Branch`. |
| **Task 7.1 Historical Backfill** (`scripts/backfill_task_7_1_tenancy.ts`) | Executed & Verified | All existing `User`, `Course`, `CourseEnrollment`, and `ProcessedMedia` records must have valid `institutionId` and (where applicable) `branchId`. |
| **Platform Super-Admin vs Primary Manager Separation** (OD-703, OD-718) | Enforced in Auth Service | Price catalog administration must be restricted strictly to verified tenant `PRIMARY_MANAGER` accounts (UP-709 / OD-721). |
| **Branch Parameterization & Online Dimension** (OD-719) | Enforced in Data Layer | Online course catalogs and physical branch catalogs depend on the `Branch.isOnline` boolean flag for resolution logic. |

---

## 3. Staged Engineering Sequence

### Stage A: Read-Only Discovery & Readiness Audit (Current)
- **Objective:** Exhaustive audit of existing pricing and enrollment mechanics across all microservices, identification of vulnerabilities (e.g. float arithmetic, client tampering, infinite access grants), and preparation of architectural designs.
- **Deliverables:**
  1. `PHASE_7_2_PRICING_CATALOG_AUDIT.md`
  2. `PHASE_7_2_SUBSCRIPTION_AGREEMENTS_AUDIT.md`
  3. `PHASE_7_2_TENANT_AND_BRANCH_PRICING_MATRIX.md`
  4. `PHASE_7_2_FINANCIAL_INTEGRATION_DESIGN.md`
  5. `PHASE_7_2_PRODUCT_OWNER_DECISIONS_REGISTER.md`
  6. `PHASE_7_2_IMPLEMENTATION_ROADMAP.md` (This document)
  7. `PHASE_7_2_FINAL_READINESS_REPORT.md`
- **Exit Criteria:** Product Owner acceptance of Stage A audit and formal sign-off on open decision gates.

---

### Stage B: Architecture & Schema Design (Post-Stage A Authorization)
- **Objective:** Synthesize data contracts, Prisma schema definitions, and migration specifications without modifying the active production database.
- **Detailed Tasks:**
  1. **Prisma Model Specification:** Define target models in `packages/database/prisma/schema.prisma`:
     - `PriceCatalog` & `PriceCatalogItem`
     - `PriceVersion` (with `Decimal(12,2)` amounts and temporal `effectiveFrom`/`effectiveTo`)
     - `BranchPriceOverride`
     - `SubscriptionAgreement` & `AgreementItem`
     - `BillingCycle` & `DiscountRule`
  2. **API & Service Contracts:**
     - `POST /api/v1/institutions/:institutionId/catalogs`
     - `POST /api/v1/institutions/:institutionId/catalogs/:catalogId/versions`
     - `GET /api/v1/pricing/resolve` (Tenant, branch, currency, and date context)
     - `POST /api/v1/subscriptions/agreements`
     - `PATCH /api/v1/subscriptions/agreements/:id/status`
  3. **Mock & Unit Verification Suite:**
     - Build isolated unit test harness verifying price resolution precedence (Campus Override > Base Catalog > System Default).
     - Build state transition validator for agreements (`DRAFT` → `PENDING` → `ACTIVE` → `EXPIRED`/`CANCELLED`/`RENEWED`).
- **Exit Criteria:** Complete design package ready for formal Product Owner review.

---

### Stage C: Product Owner Review Gate (Governance Checkpoint)
- **Objective:** Formal executive review of the proposed architecture, migration plan, and unresolved policy choices.
- **Key Decision Gates:**
  1. **OD-721 (UP-709): Primary Manager Pricing Authority** — Confirmation that only `PRIMARY_MANAGER` (or delegated financial managers) may publish price versions.
  2. **OD-722 (UP-714): Physical Attendance vs Time-Based Recognition** — Confirmation of revenue recognition model for hybrid/center attendance packs.
  3. **Migration Strategy Sign-Off** — Approval of the non-breaking dual-write transition strategy for legacy `Course.price` and `CourseEnrollment`.
- **Exit Criteria:** Signed approval record authorizing Stage D implementation.

---

### Stage D: Authorized Implementation & Engineering Rollout
- **Objective:** Code implementation, automated testing, migration generation, and staged deployment.
- **Work Package Breakdown:**

#### WP-1: Schema Migration & Database Layer
- Generate Prisma migration: `2026110X_task_7_2_pricing_and_agreements`.
- Implement non-breaking dual-write compatibility:
  - Keep `Course.price` as a legacy fallback field.
  - Automatically populate a default `PriceCatalog` and initial `PriceVersion` from existing `Course.price` values.
  - Retain `CourseEnrollment` records while generating corresponding `SubscriptionAgreement` records in `ACTIVE` state with grandfathered terms.

#### WP-2: Core Pricing Service (`packages/shared/src/pricing` & `services/payment-service`)
- Implement `PricingResolutionEngine`:
  - Enforce tenant isolation via `institutionId`.
  - Resolve branch-specific overrides with cache-invalidated query execution.
  - Guarantee fixed-point `Decimal` calculations using `decimal.js`.
- Refactor `payment.controller.ts`:
  - Eliminate raw `course.price` usage.
  - Require cryptographically verifiable `PriceVersion` or `SubscriptionAgreement` ID during checkout initiation.

#### WP-3: Subscription Agreement Lifecycle Service
- Implement `SubscriptionAgreementService`:
  - Manage state transitions via transactional database operations.
  - Implement price locking: copy immutable `priceSnapshot` upon checkout initiation.
  - Expose `checkLmsAccess(studentId, courseId)` hook integrating with `apps/frontend` and `services/course-service`.

#### WP-4: Automated Verification Suite
- **Unit Tests:**
  - 100% coverage of state machine transitions in `SubscriptionAgreement`.
  - Decimal precision tests preventing rounding drift across recurring periods.
- **Integration Tests:**
  - Cross-service tenant boundary isolation tests.
  - Multi-branch override resolution tests.
  - High-concurrency checkout and price locking tests.

---

## 4. Migration Strategy & Zero-Downtime Transition

To prevent disruption to existing student access and ongoing checkouts, Task 7.2 employs a **3-Phase Non-Breaking Schema Evolution Strategy**:

```
Phase 1 (Dual-Read / Legacy Primary):
  - Add new pricing tables.
  - Backfill existing courses into default PriceCatalog.
  - Reads check PriceCatalog; fall back to Course.price if not found.

Phase 2 (Dual-Write / Catalog Primary):
  - Catalog becomes authoritative source for all checkout operations.
  - Updates to PriceCatalog sync backward to Course.price for legacy clients.
  - Every successful checkout creates both SubscriptionAgreement and CourseEnrollment.

Phase 3 (Deprecation & Final Cutover):
  - Course.price marked @deprecated.
  - CourseEnrollment subordinated to SubscriptionAgreement.
  - Full financial ledger integration active.
```

---

## 5. Risk Assessment & Mitigation Matrix

| Risk Scenario | Severity | Impact | Mitigation Strategy |
|---|---|---|---|
| **Stale Price Checkout Race Condition** | High | Student charged an expired or modified price. | Lock price snapshot in `SubscriptionAgreement` in `PENDING` status for 60 minutes. After 60 minutes, the agreement expires and re-evaluation is mandatory. |
| **Rounding Drift in Multi-Period Invoicing** | High | Cumulative accounting discrepancies across cycles. | Enforce `Decimal(12,2)` throughout Prisma and `decimal.js` in Node.js. Round only on final invoice line totals. |
| **Cross-Tenant Catalog Leakage** | Critical | Institution B sees or applies Institution A's negotiated prices. | Enforce strict `institutionId` scoping at Prisma query level and through Task 7.1 tenant context middleware. |
| **Legacy Student Access Interruption** | Critical | Existing students locked out of enrolled courses. | Backfill existing `CourseEnrollment` records into perpetual `SubscriptionAgreement` entries with `status: ACTIVE` and `isGrandfathered: true`. |
| **Task 7.1 Migration Lag** | High | Task 7.2 migrations fail due to missing tenant foreign keys. | Hard deployment gate: Task 7.2 deployment script checks for Task 7.1 migration record in `_prisma_migrations` prior to execution. |

---

## 6. Implementation Timeline & Milestone Gates

```
Milestone 1: Stage A Discovery & Audit ---------------- [ COMPLETED ]
Milestone 2: Stage B Architecture & Schema Design ----- [ Awaiting Stage A Closure ]
Milestone 3: Stage C Product Owner Review & Sign-Off -- [ Gate: OD-721, OD-722 ]
Milestone 4: Stage D WP-1 Schema & Migration ---------- [ Technical Rollout ]
Milestone 5: Stage D WP-2 Pricing Resolution Engine --- [ Technical Rollout ]
Milestone 6: Stage D WP-3 Agreement State Machine ----- [ Technical Rollout ]
Milestone 7: Stage D WP-4 End-to-End Test Suite ------- [ Technical Rollout ]
Milestone 8: Staging Deployment & Dry-Run Benchmark --- [ Verification Gate ]
Milestone 9: Production Cutover ----------------------- [ Final Phase Closure ]
```

---

## 7. Status Declaration

`TASK 7.2 — STAGE A READ-ONLY AUDIT COMPLETE — IMPLEMENTATION NOT AUTHORIZED`  
*Engineering roadmap prepared strictly for governance review and implementation readiness assessment.*

