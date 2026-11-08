# OX-DIGITAL Education — Phase 7.2
# Centralized Institutional Pricing Catalog Audit
## Stage A — Read-Only Forensic Architecture & Readiness Assessment

**Document ID:** `OD-7201-PRICING-CATALOG-AUDIT`  
**Workspace:** `D:\OX-DIGITAL\Mathe\OX-DIGITAL-GITHUB`  
**Repository:** `https://github.com/hosamsamer019/ox-digital-Education.git`  
**Git HEAD:** `0500b93e65c24ed881349c4acea7f523332c5e9f` (Branch: `main`)  
**Audit Date:** November 2026  
**Execution Mode:** READ-ONLY (ZERO APPLICATION CODE OR DATABASE MUTATIONS)  
**Status:** **STAGE A READ-ONLY AUDIT COMPLETE — IMPLEMENTATION NOT AUTHORIZED**

---

## 1. Executive Summary

This forensic audit investigates the pricing, fee modeling, catalog architecture, and currency mechanisms in the OX-DIGITAL Education codebase. Its objective is to establish the technical foundation for a centralized institutional pricing catalog compliant with the approved Phase 7 financial architecture (OD-701 through OD-720).

### Core Forensic Finding
The existing platform contains **no institutional pricing catalog**. Current course monetization is implemented as a single mutable scalar field:
```prisma
// packages/database/prisma/schema.prisma:34
model Course {
  ...
  price Float @default(0)
  ...
}
```
This flat float field lacks versioning, effective dates, branch overrides, recurring billing cycles, physical center tuition rates, and bundle structures. Changing `Course.price` silently alters future checkouts and compromises historical transaction verification.

---

## 2. Current Implementation Analysis & Concrete Code Evidence

### 2.1 The Flat Float Model (`packages/database/prisma/schema.prisma`)
The sole pricing attribute in the entire database schema is `Course.price` (line 34).
* **No `PriceCatalog` or `PriceItem` models exist.**
* **No `BillingPeriod` or `PricingTier` models exist.**
* `CenterGroup` (physical classroom cohorts) has **zero pricing attributes**, making center tuition completely unmodellable in the current schema.
* `Payment` (lines 388–405) records `amount Float` and optional `courseId String?`, but lacks any foreign key link to a catalog item, discount structure, or pricing version.

### 2.2 Payment Controller Price Verification (`services/course-service/src/controllers/payment.controller.ts`)
In `services/course-service/src/controllers/payment.controller.ts` (lines 22–33):
```typescript
// Authoritative course lookup from database
const course = await (db as any).course.findUnique({ where: { id: courseId } });
if (!course) {
  return res.status(404).json({ message: 'Course not found' });
}

const authoritativeAmount = Number(course.price) || 0;

// Reject client-side price tampering if client attempted to send custom amount
if (clientAmount !== undefined && Math.abs(Number(clientAmount) - authoritativeAmount) > 0.01) {
  return res.status(400).json({ message: 'Invalid payment amount. Course price mismatch.' });
}
```
**Forensic Defect Analysis:**
1. **Dynamic Volatility:** The payment intent references the live, instantaneous `course.price`. If a teacher or admin edits the course price while a student is completing checkout at Fawry or Paymob, the payment verification fails or charges an unintended amount.
2. **Absence of Price Locking:** Because the transaction stores only `amount` without linking to a catalog version or subscription agreement, the platform cannot reconstruct *why* a particular student was charged a specific amount.
3. **No Support for Tiered, Branch, or Package Pricing:** Only a single flat course price can be evaluated.

---

## 3. Pricing Catalog Target Architecture

To satisfy enterprise institutional governance (OD-701, OD-703, OD-719), the pricing system must transition from a mutable course attribute to an authoritative, versioned Institutional Pricing Catalog.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                 INSTITUTIONAL PRICING CATALOG ARCHITECTURE                  │
│                                                                             │
│  [Institution (Tenant Root)]                                                │
│         │                                                                   │
│         ├── [PriceCatalog] (Managed by Primary Manager OD-701)              │
│         │        │                                                          │
│         │        ├── [PriceCatalogItem] (Subject, Grade, Service Type)      │
│         │        │        │                                                 │
│         │        │        ├── [PriceVersion] (validFrom, validTo, Status)   │
│         │        │        │        │                                        │
│         │        │        │        ├── Base Institutional Price             │
│         │        │        │        ├── Branch Price Overrides (Campus)      │
│         │        │        │        └── Online Branch Dimension (OD-719)     │
│         │        │        │                                                 │
│         │        │        └── Snapshot at Enrollment ───────────────────────┼──┐
│         │        │                                                             │
│         ▼        ▼                                                             ▼
│  [Course]   [CenterGroup]                                            [SubscriptionAgreement]
│  (Curriculum) (Physical Cohort)                                        (Frozen Price & Terms)
└─────────────────────────────────────────────────────────────────────────────┘
```

### 3.1 Proposed Data Models

#### 1. `PriceCatalog`
* Tenant Root: `institutionId String` (references `Institution.id`, `onDelete: Restrict`).
* Attributes: `name String`, `code String`, `description String?`, `currency String @default("EGP")`, `status CatalogStatus @default(ACTIVE)`.
* Constraints: Unique per institution code `@@unique([institutionId, code])`.

#### 2. `PriceCatalogItem`
* Association: `catalogId String` (references `PriceCatalog.id`, `onDelete: Cascade`).
* Target Item Type:
  * `ONLINE_COURSE_SUBSCRIPTION`
  * `CENTER_PHYSICAL_TUITION`
  * `PRIVATE_TUTORING_PACKAGE`
  * `EXAM_ACCESS_PACK`
  * `ACADEMIC_TERM_BUNDLE`
* Target Reference: Optional links to `courseId String?`, `gradeLevel GradeLevel?`, `academicLevel AcademicLevel?`.
* Billing Period: `BillingInterval` (`MONTHLY`, `TERM`, `ANNUAL`, `PER_SESSION`, `ONE_TIME`).

#### 3. `PriceVersion` (Immutability & Effective Dates)
To prevent silent price tampering:
* Attributes: `itemId String`, `versionNumber Int`, `basePrice Decimal @db.Decimal(12, 2)`, `currency String @default("EGP")`.
* Effective Window: `validFrom DateTime`, `validTo DateTime?` (null indicates active head version).
* Approval Audit: `approvedByUserId String` (Primary Manager or delegated authority per UP-709), `approvedAt DateTime`.
* Invariant: **A `PriceVersion` once published and referenced by any agreement can NEVER be edited or deleted.**

#### 4. `BranchPriceOverride` (Branch & Online Dimension OD-719)
* Scoping: `versionId String`, `branchId String` (references `Branch.id`).
* Attributes: `price Decimal @db.Decimal(12, 2)`, `isActive Boolean @default(true)`.
* Online Dimension: If `branch.isOnline == true` (OD-719), this sets the dedicated online distance-learning rate.

---

## 4. Multi-Period & Package Modeling

Educational institutions offer diverse commercial packaging that cannot be reduced to single-course purchases:

| Package Type | Educational Context | Billing Interval | Pricing Basis | Service Entitlement |
|---|---|---|---|---|
| **Monthly Online Subscription** | Online regular math curriculum | `MONTHLY` | Flat monthly recurring fee | Unlimited streaming, quizzes, AI solver for 30 days |
| **Academic Term Package** | Prep/Sec full term tuition | `TERM` (e.g. 4 months) | Fixed term fee | Full term access through final exam date |
| **Physical Center Monthly Cohort** | Classroom group (CenterGroup) | `MONTHLY` | Monthly cohort fee | 8 physical sessions/month + physical attendance |
| **Physical Session Pack** | Flexible center attendance | `PER_SESSION` (e.g. 10 pack) | Unit price x session count | Decremented on verified physical attendance (UP-714) |
| **Annual Comprehensive Bundle** | Full academic year | `ANNUAL` | Annual fixed rate (discounted) | 10 months continuous access across all branches |

---

## 5. Currency & Decimal Precision Strategy

* **Current State:** `Payment.amount` is `Float`. Floating-point numbers risk rounding inaccuracies (e.g., `0.1 + 0.2 = 0.30000000000000004`).
* **Target Standard:** All financial amounts in Task 7.2 must use `Decimal @db.Decimal(12, 2)` (supporting up to 9,999,999,999.99 with exact 2-decimal precision).
* **Currency Support:** Default currency is Egyptian Pound (`EGP`). Field `currency VARCHAR(3)` is explicitly stored. Multi-currency exchange rate conversions are out of scope until formal treasury policies are defined.

---

## 6. Audit Verdict & Implementation Readiness

| Audit Criterion | Current Capability | Target Requirement | Readiness Gap |
|---|---|---|:---:|
| **Central Price Governance** | Mutable float on `Course` | Primary Manager controlled `PriceCatalog` | **CRITICAL GAP** |
| **Branch Price Differentiation** | None | `BranchPriceOverride` (including `isOnline: true`) | **CRITICAL GAP** |
| **Effective Dates & Versioning** | None | `PriceVersion` with `validFrom` / `validTo` | **CRITICAL GAP** |
| **Historical Price Locking** | Dynamic lookup | Snapshot on `SubscriptionAgreement` | **CRITICAL GAP** |
| **Physical Center Pricing** | Completely absent | `CenterGroup` tuition catalog items | **CRITICAL GAP** |

**Conclusion:** Task 7.2 Stage A discovery confirms that the platform requires a dedicated pricing catalog architecture. Proceeding to Stage B (Architecture & Schema Design) is required once Product Owner decisions on approval delegation (UP-709) and session valuation (UP-714) are established.

