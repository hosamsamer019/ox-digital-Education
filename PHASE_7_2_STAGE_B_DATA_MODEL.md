# Phase 7.2 — Stage B: Architecture Design
## Document 1: Target Data Model Specification

**Workspace:** `D:\OX-DIGITAL\Mathe\OX-DIGITAL-GITHUB`  
**Phase:** 7.2 — Pricing Catalog & Subscription Agreements  
**Stage:** Stage B — Architecture Design  
**Date:** November 2026  
**Status:** DESIGN ONLY — IMPLEMENTATION NOT AUTHORIZED  

---

## 1. Mandatory Design Principles

1. **Institution as Root Tenant:** Every pricing entity (`PriceCatalog`, `PriceVersion`, `BranchPriceOverride`) and contractual entity (`SubscriptionAgreement`, `AgreementPriceSnapshot`, `SessionPackage`) must have a non-nullable foreign key referencing `Institution(id)` (OD-701).
2. **Exact Decimal Monetary Representation:** All currency amounts must be stored as `Decimal(12,2)` in PostgreSQL via Prisma's `Decimal` type. IEEE-754 floating-point arithmetic is strictly forbidden.
3. **Immutable Price Snapshots:** When a student or parent accepts an agreement or completes checkout, the agreed unit price, discount, tax, currency, and billing terms are snapshotted into an immutable child record (`AgreementPriceSnapshot`). Updating catalog prices never modifies existing agreements.
4. **Auditability & Append-Only State:** State transitions on agreements and session entitlements must generate immutable audit records (`AgreementLifecycleEvent`, `SessionAdjustment`).
5. **No Physical Deletions:** Soft deletes only (`deletedAt DateTime?`). Financial and contract records must never be physically purged from the database.
6. **Separation of Concerns:**
   - A `PriceCatalogItem` is an offering template.
   - A `SubscriptionAgreement` is a legally binding contract.
   - An `Invoice` (Task 7.3) is a demand for payment.
   - A `PaymentTransaction` (Task 7.4) is a settlement record.
   - A `JournalEntry` (Task 7.5) is an accounting ledger posting.

---

## 2. Target Prisma Schema Specification (Design Draft)

> [!NOTE]
> The following schema is an architectural design document. It must NOT be added to `schema.prisma` until Stage D authorization is granted by the Product Owner.

```prisma
// =========================================================================
// ENUMS FOR PRICING & SUBSCRIPTION LIFECYCLE
// =========================================================================

enum CatalogStatus {
  DRAFT
  ACTIVE
  ARCHIVED
}

enum PriceVersionStatus {
  DRAFT
  SCHEDULED
  ACTIVE
  SUPERSEDED
  ARCHIVED
}

enum BillingFrequency {
  ONE_TIME          // Single non-recurring payment
  WEEKLY            // Weekly recurring billing
  MONTHLY           // Monthly recurring billing
  QUARTERLY         // 3-month recurring billing
  SEMESTER          // Academic semester billing
  ANNUAL            // Full academic year billing
  PER_SESSION_PACK  // Prepaid batch of sessions (Center/Physical)
}

enum AgreementStatus {
  DRAFT             // Cart / quote generated, awaiting checkout
  PENDING           // Awaiting payment or student/parent signature
  ACTIVE            // Contract in force; access active
  SUSPENDED         // Temporarily halted (non-payment, disciplinary)
  EXPIRED           // Term ended without renewal
  CANCELLED         // Contract terminated early (voided or refunded)
  RENEWED           // Superseded by a subsequent agreement
}

enum AgreementEventType {
  CREATED
  OFFER_ACCEPTED
  PAYMENT_LINKED
  ACTIVATED
  SUSPENDED
  REACTIVATED
  EXPIRED
  CANCELLED
  RENEWAL_INITIATED
  AMENDED
}

enum SessionPackageStatus {
  ACTIVE
  DEPLETED
  EXPIRED
  REFUNDED
  FROZEN
}

enum SessionConsumptionReason {
  ATTENDANCE_PRESENT
  ATTENDANCE_LATE
  UNEXCUSED_ABSENCE       // Subject to OD-722 policy gate
  MANUAL_STAFF_DEDUCTION
}

// =========================================================================
// 1. PRICING CATALOG ENTITIES
// =========================================================================

model PriceCatalog {
  id              String         @id @default(uuid())
  institutionId   String
  name            String         @db.VarChar(120)
  code            String         @db.VarChar(64)
  description     String?        @db.Text
  status          CatalogStatus  @default(DRAFT)
  isDefault       Boolean        @default(false)
  currency        String         @default("EGP") @db.VarChar(3) // Subject to UP-712
  createdAt       DateTime       @default(now())
  updatedAt       DateTime       @updatedAt
  deletedAt       DateTime?

  // Tenant Relationship
  institution     Institution    @relation(fields: [institutionId], references: [id], onDelete: Restrict)
  items           PriceCatalogItem[]

  @@unique([institutionId, code], name: "uq_catalog_institution_code")
  @@index([institutionId, status])
  @@map("price_catalogs")
}

model PriceCatalogItem {
  id              String         @id @default(uuid())
  institutionId   String
  catalogId       String
  courseId        String?        // Nullable if item is a non-course service (e.g. lab fee, books)
  serviceType     String         @default("COURSE") @db.VarChar(64)
  itemCode        String         @db.VarChar(64)
  name            String         @db.VarChar(120)
  description     String?        @db.Text
  billingFrequency BillingFrequency @default(MONTHLY)
  createdAt       DateTime       @default(now())
  updatedAt       DateTime       @updatedAt
  deletedAt       DateTime?

  // Relations
  institution     Institution    @relation(fields: [institutionId], references: [id], onDelete: Restrict)
  catalog         PriceCatalog   @relation(fields: [catalogId], references: [id], onDelete: Restrict)
  course          Course?        @relation(fields: [courseId], references: [id], onDelete: SetNull)
  versions        PriceVersion[]
  branchOverrides BranchPriceOverride[]

  @@unique([catalogId, itemCode], name: "uq_item_catalog_code")
  @@index([institutionId, courseId])
  @@map("price_catalog_items")
}

model PriceVersion {
  id              String             @id @default(uuid())
  institutionId   String
  catalogItemId   String
  versionNumber   Int                @default(1)
  basePrice       Decimal            @db.Decimal(12, 2)
  currency        String             @default("EGP") @db.VarChar(3)
  effectiveFrom   DateTime
  effectiveTo     DateTime?          // Null represents indefinite validity until superseded
  status          PriceVersionStatus @default(DRAFT)
  publishedAt     DateTime?
  publishedBy     String?            // User ID of PRIMARY_MANAGER (OD-721)
  changeReason    String?            @db.VarChar(255)
  createdAt       DateTime           @default(now())
  updatedAt       DateTime           @updatedAt

  // Relations
  institution     Institution        @relation(fields: [institutionId], references: [id], onDelete: Restrict)
  catalogItem     PriceCatalogItem   @relation(fields: [catalogItemId], references: [id], onDelete: Restrict)
  agreements      SubscriptionAgreement[]

  @@unique([catalogItemId, versionNumber], name: "uq_item_version_number")
  @@index([catalogItemId, status, effectiveFrom, effectiveTo])
  @@index([institutionId, effectiveFrom])
  @@map("price_versions")
}

model BranchPriceOverride {
  id              String         @id @default(uuid())
  institutionId   String
  catalogItemId   String
  branchId        String         // Target physical campus or online branch (OD-719)
  overridePrice   Decimal        @db.Decimal(12, 2)
  currency        String         @default("EGP") @db.VarChar(3)
  effectiveFrom   DateTime
  effectiveTo     DateTime?
  isActive        Boolean        @default(true)
  reason          String?        @db.VarChar(255)
  createdAt       DateTime       @default(now())
  updatedAt       DateTime       @updatedAt

  // Relations
  institution     Institution    @relation(fields: [institutionId], references: [id], onDelete: Restrict)
  catalogItem     PriceCatalogItem @relation(fields: [catalogItemId], references: [id], onDelete: Restrict)
  branch          Branch         @relation(fields: [branchId], references: [id], onDelete: Restrict)

  @@unique([catalogItemId, branchId, effectiveFrom], name: "uq_branch_override_schedule")
  @@index([institutionId, branchId, isActive])
  @@map("branch_price_overrides")
}

// =========================================================================
// 2. SUBSCRIPTION AGREEMENT ENTITIES
// =========================================================================

model SubscriptionAgreement {
  id                String            @id @default(uuid())
  institutionId     String
  studentId         String            // User.id of student
  branchId          String?           // Attributed Branch (Physical campus or Online branch)
  courseId          String?           // Target course if course subscription
  priceVersionId    String            // The version referenced at inception
  agreementNumber   String            @db.VarChar(64) // e.g. "AGR-2026-000142"
  status            AgreementStatus   @default(DRAFT)
  billingFrequency  BillingFrequency
  startsAt          DateTime
  endsAt            DateTime?         // Nullable for ongoing rolling subscriptions
  nextBillingDate   DateTime?
  autoRenew         Boolean           @default(false)
  cancellationDate  DateTime?
  cancellationReason String?          @db.VarChar(255)
  isGrandfathered   Boolean           @default(false) // Flag for legacy backfilled enrollments
  createdAt         DateTime          @default(now())
  updatedAt         DateTime          @updatedAt
  deletedAt         DateTime?

  // Relations
  institution       Institution       @relation(fields: [institutionId], references: [id], onDelete: Restrict)
  student           User              @relation("StudentAgreements", fields: [studentId], references: [id], onDelete: Restrict)
  branch            Branch?           @relation(fields: [branchId], references: [id], onDelete: SetNull)
  course            Course?           @relation(fields: [courseId], references: [id], onDelete: Restrict)
  priceVersion      PriceVersion      @relation(fields: [priceVersionId], references: [id], onDelete: Restrict)
  
  priceSnapshot     AgreementPriceSnapshot?
  lifecycleEvents   AgreementLifecycleEvent[]
  renewals          SubscriptionRenewal[]
  sessionPackages   SessionPackage[]

  @@unique([institutionId, agreementNumber], name: "uq_institution_agreement_num")
  @@index([institutionId, studentId, status])
  @@index([institutionId, branchId, courseId])
  @@index([status, nextBillingDate])
  @@map("subscription_agreements")
}

model AgreementPriceSnapshot {
  id                  String         @id @default(uuid())
  agreementId         String         @unique
  currency            String         @default("EGP") @db.VarChar(3)
  baseAmount          Decimal        @db.Decimal(12, 2)
  discountAmount      Decimal        @default(0.00) @db.Decimal(12, 2)
  taxAmount           Decimal        @default(0.00) @db.Decimal(12, 2)
  netAgreedAmount     Decimal        @db.Decimal(12, 2)
  billingCycleLength  Int            @default(1) // Number of cycle units (e.g., 1 month)
  paymentTermsDays    Int            @default(0) // Due upon receipt = 0, Net 15 = 15
  termsHash           String         @db.VarChar(64) // SHA-256 hash of agreed legal terms
  snapshotAt          DateTime       @default(now())

  // Relation
  agreement           SubscriptionAgreement @relation(fields: [agreementId], references: [id], onDelete: Restrict)

  @@map("agreement_price_snapshots")
}

model AgreementLifecycleEvent {
  id              String             @id @default(uuid())
  agreementId     String
  eventType       AgreementEventType
  previousStatus  AgreementStatus?
  newStatus       AgreementStatus
  performedBy     String             // User ID or "SYSTEM"
  reason          String?            @db.VarChar(255)
  metadata        Json?              // Contextual payload (IP, user-agent, transactionId)
  timestamp       DateTime           @default(now())

  // Relation
  agreement       SubscriptionAgreement @relation(fields: [agreementId], references: [id], onDelete: Restrict)

  @@index([agreementId, timestamp])
  @@map("agreement_lifecycle_events")
}

model SubscriptionRenewal {
  id                    String         @id @default(uuid())
  agreementId           String
  renewalIndex          Int            @default(1)
  periodStart           DateTime
  periodEnd             DateTime
  billedAmount          Decimal        @db.Decimal(12, 2)
  invoiceId             String?        // Link to downstream Invoice (Task 7.3)
  isExecuted            Boolean        @default(false)
  executedAt            DateTime?
  failureReason         String?        @db.VarChar(255)
  createdAt             DateTime       @default(now())

  // Relation
  agreement             SubscriptionAgreement @relation(fields: [agreementId], references: [id], onDelete: Restrict)

  @@unique([agreementId, renewalIndex], name: "uq_agreement_renewal_index")
  @@index([periodStart, isExecuted])
  @@map("subscription_renewals")
}

// =========================================================================
// 3. PHYSICAL SESSION PACKAGE ENTITIES (PREPAID CENTER PACKS)
// =========================================================================

model SessionPackage {
  id                  String               @id @default(uuid())
  institutionId       String
  agreementId         String
  studentId           String
  branchId            String               // Physical campus where sessions occur
  totalSessions       Int                  // Total purchased sessions (e.g. 10 sessions)
  consumedSessions    Int                  @default(0)
  refundedSessions    Int                  @default(0)
  remainingSessions   Int                  // Computed column: totalSessions - consumedSessions - refundedSessions
  unitSessionPrice    Decimal              @db.Decimal(12, 2) // Package price / totalSessions
  status              SessionPackageStatus @default(ACTIVE)
  validFrom           DateTime
  validTo             DateTime?            // Expiration date (Subject to OD-722 approval)
  createdAt           DateTime             @default(now())
  updatedAt           DateTime             @updatedAt

  // Relations
  institution         Institution          @relation(fields: [institutionId], references: [id], onDelete: Restrict)
  agreement           SubscriptionAgreement @relation(fields: [agreementId], references: [id], onDelete: Restrict)
  student             User                 @relation(fields: [studentId], references: [id], onDelete: Restrict)
  branch              Branch               @relation(fields: [branchId], references: [id], onDelete: Restrict)
  consumptions        SessionConsumption[]
  adjustments         SessionAdjustment[]

  @@index([institutionId, studentId, status])
  @@index([agreementId])
  @@map("session_packages")
}

model SessionConsumption {
  id                  String                   @id @default(uuid())
  packageId           String
  attendanceId        String?                  @unique // Direct FK to Attendance (packages/database)
  consumedSessions    Int                      @default(1)
  reason              SessionConsumptionReason @default(ATTENDANCE_PRESENT)
  consumedAt          DateTime                 @default(now())
  recordedBy          String                   // Teacher or Staff User ID
  notes               String?                  @db.VarChar(255)

  // Relations
  package             SessionPackage           @relation(fields: [packageId], references: [id], onDelete: Restrict)
  attendance          Attendance?              @relation(fields: [attendanceId], references: [id], onDelete: SetNull)

  @@index([packageId, consumedAt])
  @@map("session_consumptions")
}

model SessionAdjustment {
  id                  String             @id @default(uuid())
  packageId           String
  adjustmentType      String             @db.VarChar(32) // "CREDIT", "REFUND", "EXPIRATION"
  sessionDelta        Int                // Positive (grant) or Negative (deduct)
  reason              String             @db.VarChar(255)
  authorizedBy        String             // Staff User ID
  createdAt           DateTime           @default(now())

  // Relation
  package             SessionPackage     @relation(fields: [packageId], references: [id], onDelete: Restrict)

  @@index([packageId, createdAt])
  @@map("session_adjustments")
}
```

---

## 3. Precision, Currency & Rounding Policy

### 3.1 Exact Decimal Storage
- **Precision:** `Decimal(12,2)` allows monetary values up to `9,999,999,999.99` with 2 decimal places.
- **Runtime Processing:** In Node.js services, all calculations must utilize `decimal.js` or `BigNumber.js`. Native JavaScript `Number` operators (`+`, `-`, `*`, `/`) on monetary amounts are prohibited by lint rules.

### 3.2 Rounding Strategy
- **Half-Even Rounding (Banker's Rounding):** Minimizes statistical bias when aggregating ledger transactions across thousands of students.
- **Total-Level Rounding:** Line items store unrounded subtotal decimals; rounding to the nearest minor currency unit (e.g. 0.01 EGP) occurs strictly at the invoice/snapshot total line.

### 3.3 Currency Governance (Dependency on UP-712)
- Current base architecture fixes currency to the institution's primary operating currency (`EGP` for Egypt).
- Multi-currency support remains conditional on Product Owner decision **UP-712**. In this architecture, all records store an ISO-4217 currency code field (`VarChar(3)`), laying the groundwork for multi-currency without premature schema churn.

---

## 4. Conflict Prevention & Temporal Overlaps

To prevent overlapping active price versions for the same catalog item:
1. **Application-Level Temporal Exclusion:** When publishing a `PriceVersion`, an explicit transaction checks for existing versions where:
   $$\text{existing.effectiveFrom} \le \text{new.effectiveTo} \quad \text{AND} \quad (\text{existing.effectiveTo} \ge \text{new.effectiveFrom} \lor \text{existing.effectiveTo IS NULL})$$
2. **Supersession Protocol:** Publishing a new version with an indefinite `effectiveTo` automatically sets the preceding active version's `effectiveTo = new.effectiveFrom - 1 second` and marks it `SUPERSEDED`.
3. **Database Guardrails:** A PostgreSQL exclusion constraint using range types will be proposed for Stage D:
   ```sql
   ALTER TABLE price_versions 
   ADD CONSTRAINT exclude_overlapping_versions 
   EXCLUDE USING gist (
     catalog_item_id WITH =, 
     tsrange(effective_from, COALESCE(effective_to, 'infinity'::timestamp)) WITH &&
   ) WHERE (status = 'ACTIVE');
   ```

---

## 5. Summary of Data Model Boundaries

- **No Hard Cascade Deletes:** All foreign keys targeting institution, branch, course, or student use `onDelete: Restrict` or `SetNull` to preserve contract traceability.
- **Bi-Directional Auditability:** From an invoice or LMS access request, one can trace directly to the `SubscriptionAgreement`, the `AgreementPriceSnapshot`, the parent `PriceVersion`, and the publishing manager.

