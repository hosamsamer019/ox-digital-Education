# Phase 7.2 — Stage B.3: Technical Evidence Matrix
## Independent Classification of Validation Claims Against Physical Source Code

**Workspace:** `D:\OX-DIGITAL\Mathe\OX-DIGITAL-GITHUB`  
**Git Repository:** `https://github.com/hosamsamer019/ox-digital-Education.git`  
**Git HEAD:** `0500b93e65c24ed881349c4acea7f523332c5e9f` (branch `main`)  
**Phase:** 7.2 — Pricing Catalog & Subscription Agreements  
**Stage:** Stage B.3 — Final Cross-Document Consistency & Technical Evidence Review  
**Date:** November 2026  
**Final Status:** `TASK 7.2 STAGE B.3 — DOCUMENTATION AND EVIDENCE REVIEW ONLY — NO IMPLEMENTATION AUTHORIZED`  

---

## 1. Classification Methodology & Status Taxonomy

Every technical claim made in the Stage B and B.2 validation documents has been re-examined against the actual physical repository files, TypeScript sources, and Prisma schema definitions.

Each claim is assigned **exactly one** classification status:
- **`VERIFIED_IN_SOURCE`**: Directly demonstrated by existing committed source code, schema models, or unit tests.
- **`DESIGN_ONLY`**: Defined in architectural documentation or design drafts, but not yet implemented in physical code or schema.
- **`PARTIALLY_VERIFIED`**: Foundational elements exist in physical code, but the complete feature or invariant is not fully established.
- **`NOT_TESTED`**: Conceptual implementation exists or is designed, but runtime execution has not been verified in an active test environment.
- **`BLOCKED_BY_TASK_7_1`**: Structurally or operationally dependent on Task 7.1 database migration and offline backfill execution, which have not occurred.

---

## 2. Re-Assessment of the Nine B.2 Technical Validation Claims

### Claim 1: Verification of Relational Consistency Against Task 7.1 Schema
- **Assigned Status:** `PARTIALLY_VERIFIED`
- **Physical Source Evidence:**
  - `Institution` model exists: `packages/database/prisma/schema.prisma:12-33`.
  - `Branch` model with `isOnline Boolean @default(false)` exists: `packages/database/prisma/schema.prisma:35-59`.
  - `Branch.institution` foreign key with `onDelete: Restrict`: `packages/database/prisma/schema.prisma:49`.
  - `User.institutionId` & `User.branchId`: `packages/database/prisma/schema.prisma:87-88`.
  - `Course.institutionId` & `Course.branchId`: `packages/database/prisma/schema.prisma:146-147`.
  - `CourseEnrollment(studentId, courseId)`: `packages/database/prisma/schema.prisma:176-187`.
  - `Attendance(studentId, date, status)`: `packages/database/prisma/schema.prisma:291-302`.
- **Gaps / Untested Elements:**
  - The target Phase 7.2 pricing and agreement entities (`PriceCatalog`, `PriceVersion`, `BranchPriceOverride`, `SubscriptionAgreement`, `SessionPackage`) are `DESIGN_ONLY` and do **not** exist in `schema.prisma`.
  - Physical PostgreSQL constraints and foreign-key referential integrity cannot be tested because the database migration has not been applied (`BLOCKED_BY_TASK_7_1`).

---

### Claim 2: Pure Append-Only Price Version Resolution & Concurrency (OD-723)
- **Assigned Status:** `DESIGN_ONLY`
- **Physical Source Evidence:**
  - Zero models for `PriceCatalog` or `PriceVersion` exist in `packages/database/prisma/schema.prisma`.
- **Gaps / Untested Elements:**
  - The removal of `effectiveTo` and pure append-only query resolution (`ORDER BY effective_from DESC, version_number DESC LIMIT 1`) is an architectural design specification.
  - Concurrency safety under high transaction volume and database-level immutability enforcement have not been tested or implemented in executable code.
  - Furthermore, the Product Owner has **not** explicitly approved OD-723.

---

### Claim 3: Pricing Management Authority & Ownership Enforcement (OD-721)
- **Assigned Status:** `PARTIALLY_VERIFIED`
- **Physical Source Evidence:**
  - `Role.PRIMARY_MANAGER` enum value exists: `packages/database/prisma/schema.prisma:628`.
  - `User.isPrimaryManager Boolean @default(false)`: `packages/database/prisma/schema.prisma:89`.
  - `Institution.primaryManagerId String? @unique`: `packages/database/prisma/schema.prisma:17`.
  - Dedicated tenant context middleware exists: `packages/shared/src/tenant/tenantContext.ts:37-91`.
  - Identity separation for Platform Super-Admin (`admin@edu.com`): `packages/shared/src/tenant/tenantContext.ts:26-28`.
  - Service-level tenant and branch guards exist: `assertTenantAccess()` and `assertBranchAccess()` in `packages/shared/src/tenant/tenantContext.ts:120-168`.
- **Gaps / Untested Elements:**
  - Specific pricing catalog controllers, pricing route middleware, and `assertPrimaryManagerPricingAuthority` guards are `DESIGN_ONLY`.

---

### Claim 4: Legacy Grace-Period Migration & Eligibility Rules (OD-724)
- **Assigned Status:** `BLOCKED_BY_TASK_7_1`
- **Physical Source Evidence:**
  - `CourseEnrollment` exists: `packages/database/prisma/schema.prisma:176-187`.
  - Offline backfill script for Task 7.1 exists: `scripts/backfill_task_7_1_tenancy.ts`.
- **Gaps / Untested Elements:**
  - Task 7.1 migration (`20261102_task_7_1_institution_branch_foundation`) has **not** been applied to PostgreSQL, and the backfill script has **not** been executed.
  - In the live database, `User.institutionId` and `Course.institutionId` remain unpopulated.
  - Eligibility filtering and grandfathered agreement conversion cannot execute or be tested until Task 7.1 staging deployment is completed.
  - The grace period duration and start-date parameters remain unresolved Product Owner choices.

---

### Claim 5: Attendance-Based Session Consumption & Idempotency (OD-722)
- **Assigned Status:** `PARTIALLY_VERIFIED`
- **Physical Source Evidence:**
  - `model Attendance` exists with `id`, `studentId`, `date`, `status String`: `packages/database/prisma/schema.prisma:291-302`.
- **Gaps / Untested Elements:**
  - `SessionPackage`, `SessionConsumption`, and `SessionAdjustment` are `DESIGN_ONLY`.
  - The proposed database unique constraint `@@unique([attendanceId])` does not exist in `schema.prisma`.
  - Transactional atomicity, concurrent check-in locking, and compensating reversal logic have **not** been implemented or tested in code.
  - Package expiration and refund valuation remain unresolved Product Owner policies.

---

### Claim 6: Subscription Renewal Linkage & Idempotency (OD-726)
- **Assigned Status:** `DESIGN_ONLY`
- **Physical Source Evidence:**
  - None in source code or schema.
- **Gaps / Untested Elements:**
  - The self-referencing relationship `SubscriptionAgreement.previousAgreementId` and unique index `@@unique([previousAgreementId, renewalCycleNumber])` are architectural designs only.
  - Renewal workers, automated billing triggers, and acceptance workflows are not yet implemented.

---

### Claim 7: EGP Decimal Precision, Rounding & Serialization (OD-725)
- **Assigned Status:** `PARTIALLY_VERIFIED`
- **Physical Source Evidence:**
  - Current physical models use `Float`: `Course.price Float @default(0)` (`schema.prisma:155`) and `Payment.amount Float` (`schema.prisma:309`).
  - Prisma CLI natively supports `Decimal(12,2)`.
- **Gaps / Untested Elements:**
  - Exact Decimal fields exist only in the proposed Phase 7.2 draft schema (`DESIGN_ONLY`).
  - Runtime Banker's Rounding (Half-Even) via `decimal.js` and stringified decimal API serialization (`"1500.00"`) are architectural specifications that have `NOT_TESTED` in physical service controllers.

---

### Claim 8: Financial Lifecycle Decoupling Across Tasks 7.3–7.5
- **Assigned Status:** `DESIGN_ONLY`
- **Physical Source Evidence:**
  - Legacy `Payment` model exists (`schema.prisma:304-332`) recording basic transaction metadata.
- **Gaps / Untested Elements:**
  - The target entities representing the decoupled financial lifecycle (`SubscriptionAgreement`, `Invoice`, `PaymentTransaction`, `JournalEntry`) do not exist in the codebase.
  - The separation of concerns is established as an architectural design constraint, but zero accounting subsystems or ledger tables currently exist in code.

---

### Claim 9: Governance Integrity & Zero Premature Implementation
- **Assigned Status:** `VERIFIED_IN_SOURCE`
- **Physical Source Evidence:**
  - Git status check across `D:\OX-DIGITAL\Mathe\OX-DIGITAL-GITHUB` confirms that **zero application source files** and **zero schema files** have been modified.
  - Git HEAD is verified at `0500b93e65c24ed881349c4acea7f523332c5e9f` on branch `main`.
  - All 58 tracked modified files from previous tasks are preserved intact.
  - Documentation files strictly maintain provisional and pending status labels.

---

## 3. Summary of Technical Evidence Classifications

| Claim # | Architectural Dimension | Assigned Evidence Status | Primary Constraint / Evidence Citation |
|---|---|---|---|
| **Claim 1** | Prisma Schema Relations | `PARTIALLY_VERIFIED` | Existing entities in `schema.prisma:12-302`; proposed pricing models are `DESIGN_ONLY`. |
| **Claim 2** | Append-Only Immutability | `DESIGN_ONLY` | Pure append-only resolution is an unapproved design proposal (`OD-723`). |
| **Claim 3** | Pricing Authorization | `PARTIALLY_VERIFIED` | `Role.PRIMARY_MANAGER` in `schema.prisma:628`; middleware in `tenantContext.ts:37-168`. |
| **Claim 4** | Legacy Conversion | `BLOCKED_BY_TASK_7_1` | Task 7.1 migration/backfill has not been executed on PostgreSQL. |
| **Claim 5** | Attendance Consumption | `PARTIALLY_VERIFIED` | `Attendance` in `schema.prisma:291-302`; `SessionConsumption` is `DESIGN_ONLY`. |
| **Claim 6** | Renewal Idempotency | `DESIGN_ONLY` | `previousAgreementId` and renewal cycles exist only in design documents. |
| **Claim 7** | Monetary Decimal Precision| `PARTIALLY_VERIFIED` | Current schema uses `Float`; target `Decimal(12,2)` models are `DESIGN_ONLY`. |
| **Claim 8** | Financial Decoupling | `DESIGN_ONLY` | Architecture design only; downstream models do not exist in code. |
| **Claim 9** | Governance Integrity | `VERIFIED_IN_SOURCE` | Zero unauthorized source changes; Git working tree 100% verified. |

---

## 4. Explicit Governance Declaration

```
TASK 7.2 STAGE B.3 — DOCUMENTATION AND EVIDENCE REVIEW ONLY — NO IMPLEMENTATION AUTHORIZED
```

