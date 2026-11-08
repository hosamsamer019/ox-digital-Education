# Phase 7.2 — Stage B.4: Architecture Impact Assessment
## Technical & Structural Impact of Product Owner Workshop Decisions

**Workspace:** `D:\OX-DIGITAL\Mathe\OX-DIGITAL-GITHUB`  
**Git Repository:** `https://github.com/hosamsamer019/ox-digital-Education.git`  
**Git HEAD:** `0500b93e65c24ed881349c4acea7f523332c5e9f` (branch `main`)  
**Phase:** 7.2 — Pricing Catalog & Subscription Agreements  
**Stage:** Stage B.4 — Product Owner Decision Workshop  
**Date:** November 2026  
**Final Status:** `TASK 7.2 STAGE B.4 — PRODUCT OWNER DECISION WORKSHOP — NO IMPLEMENTATION OR DATABASE AUTHORIZATION`  

---

## 1. Executive Summary

During the **Stage B.4 Decision Workshop**, the Product Owner rendered explicit selections across all unresolved business, operational, and financial policy gates. 

This document evaluates the architectural, data-model, API, and downstream accounting impacts of those selections, demonstrating how the Stage B design baseline adapts to satisfy executive determinations while maintaining strict technical rigor.

---

## 2. Impact on Target Data Models (Prisma DDL Specifications)

### 2.1 Refinement of `PriceVersion` (OD-723: Pure Append-Only)
- **Architectural Modification:** Completely eliminate the mutable `effectiveTo` column.
- **Model Invariant:** Published versions are strictly write-once.
- **Refined Model:**
  ```prisma
  model PriceVersion {
    id              String             @id @default(uuid())
    institutionId   String
    catalogItemId   String
    versionNumber   Int                // 1, 2, 3...
    basePrice       Decimal            @db.Decimal(12, 2)
    currency        String             @default("EGP") @db.VarChar(3)
    effectiveFrom   DateTime
    status          PriceVersionStatus @default(DRAFT)
    publishedAt     DateTime?
    publishedBy     String?            // User.id of Primary Manager (OD-721)
    changeReason    String?            @db.VarChar(255)
    createdAt       DateTime           @default(now())

    institution     Institution        @relation(fields: [institutionId], references: [id], onDelete: Restrict)
    catalogItem     PriceCatalogItem   @relation(fields: [catalogItemId], references: [id], onDelete: Restrict)
    agreements      SubscriptionAgreement[]

    @@unique([catalogItemId, versionNumber])
    @@index([catalogItemId, status, effectiveFrom])
    @@map("price_versions")
  }
  ```

---

### 2.2 Refinement of `SessionPackage` & `SessionConsumption` (OD-722)
- **Architectural Modifications:**
  - Add `expirationPolicy` and `validityPeriodDays` to support configurable package expirations (OD-722.2).
  - Add `isRefundable` and `refundPolicyTerms` for package-level refund rules (OD-722.3).
  - `SessionConsumption` strictly triggered on `status == 'PRESENT'` (OD-722.1).
  - Add `SessionAdjustment` reversal types (`TEACHER_CANCELLATION`, `STUDENT_NOTICE_CANCELLATION`) (OD-722.5).
- **Refined Models:**
  ```prisma
  model SessionPackage {
    id                 String               @id @default(uuid())
    institutionId      String
    agreementId        String
    studentId          String
    branchId           String
    totalSessions      Int
    consumedSessions   Int                  @default(0)
    refundedSessions   Int                  @default(0)
    remainingSessions  Int
    unitSessionPrice   Decimal              @db.Decimal(12, 2) // OD-722.4 Equal Allocation
    status             SessionPackageStatus @default(ACTIVE)
    validFrom          DateTime
    validTo            DateTime?            // OD-722.2 Configurable expiration
    isRefundable       Boolean              @default(true) // OD-722.3 Configurable refund
    createdAt          DateTime             @default(now())
    updatedAt          DateTime             @updatedAt

    institution        Institution          @relation(fields: [institutionId], references: [id], onDelete: Restrict)
    agreement          SubscriptionAgreement @relation(fields: [agreementId], references: [id], onDelete: Restrict)
    consumptions       SessionConsumption[]
    adjustments        SessionAdjustment[]

    @@map("session_packages")
  }

  model SessionConsumption {
    id               String                   @id @default(uuid())
    packageId        String
    attendanceId     String?                  @unique // Unique database guard
    consumedSessions Int                      @default(1)
    reason           SessionConsumptionReason @default(ATTENDANCE_PRESENT) // OD-722.1 PRESENT ONLY
    consumedAt       DateTime                 @default(now())
    recordedBy       String

    package          SessionPackage           @relation(fields: [packageId], references: [id], onDelete: Restrict)
    attendance       Attendance?              @relation(fields: [attendanceId], references: [id], onDelete: SetNull)

    @@map("session_consumptions")
  }

  model SessionAdjustment {
    id             String   @id @default(uuid())
    packageId      String
    adjustmentType String   @db.VarChar(64) // "TEACHER_CANCELLATION", "STUDENT_NOTICE_CANCELLATION", "EXPIRATION"
    sessionDelta   Int      // +1 or -1
    reason         String   @db.VarChar(255)
    authorizedBy   String
    createdAt      DateTime @default(now())

    package        SessionPackage @relation(fields: [packageId], references: [id], onDelete: Restrict)

    @@map("session_adjustments")
  }
  ```

---

### 2.3 Refinement of `SubscriptionAgreement` (OD-724 & OD-726)
- **Architectural Modifications:**
  - Add `previousAgreementId` self-reference to link renewals (OD-726).
  - Add `renewalCycleNumber` with unique constraint `@@unique([previousAgreementId, renewalCycleNumber])`.
  - Add `autoRenew: Boolean` supporting explicit opt-in only (OD-726.1).
  - Add `isGrandfathered: Boolean` and `gracePeriodEndsAt: DateTime?` supporting the 60-day migration cutoff (OD-724.1).
- **Refined Model:**
  ```prisma
  model SubscriptionAgreement {
    id                  String            @id @default(uuid())
    institutionId       String
    studentId           String
    branchId            String?
    courseId            String?
    priceVersionId      String
    agreementNumber     String            @db.VarChar(64)
    status              AgreementStatus   @default(DRAFT)
    billingFrequency    BillingFrequency
    startsAt            DateTime
    endsAt              DateTime?
    nextBillingDate     DateTime?
    autoRenew           Boolean           @default(false) // OD-726.1 Opt-in required
    previousAgreementId String?           // OD-726 Link to prior agreement
    renewalCycleNumber  Int               @default(1)
    isGrandfathered     Boolean           @default(false) // OD-724 Legacy flag
    gracePeriodEndsAt   DateTime?         // OD-724 60-day deadline
    createdAt           DateTime          @default(now())
    updatedAt           DateTime          @updatedAt

    institution         Institution       @relation(fields: [institutionId], references: [id], onDelete: Restrict)
    student             User              @relation(fields: [studentId], references: [id], onDelete: Restrict)
    course              Course?           @relation(fields: [courseId], references: [id], onDelete: Restrict)
    priceVersion        PriceVersion      @relation(fields: [priceVersionId], references: [id], onDelete: Restrict)
    previousAgreement   SubscriptionAgreement?  @relation("AgreementRenewals", fields: [previousAgreementId], references: [id])
    nextRenewals        SubscriptionAgreement[] @relation("AgreementRenewals")
    priceSnapshot       AgreementPriceSnapshot?

    @@unique([institutionId, agreementNumber])
    @@unique([previousAgreementId, renewalCycleNumber])
    @@map("subscription_agreements")
  }
  ```

---

## 3. Impact on API Contracts & Core Services

### 3.1 Pricing Resolution Engine (`GET /api/v1/pricing/resolve`)
- Adapts to pure append-only query resolution:
  ```sql
  -- Branch Override Resolution (Priority 1)
  SELECT override_price, currency, id 
  FROM branch_price_overrides
  WHERE catalog_item_id = $1 AND branch_id = $2 AND is_active = true AND effective_from <= $3
  ORDER BY effective_from DESC LIMIT 1;

  -- Base Catalog Resolution (Priority 2)
  SELECT base_price, currency, id, version_number 
  FROM price_versions
  WHERE catalog_item_id = $1 AND status = 'PUBLISHED' AND effective_from <= $2
  ORDER BY effective_from DESC, version_number DESC LIMIT 1;
  ```

### 3.2 Dynamic Access Evaluator (`checkLmsAccess`)
- **Single System of Record:** Removes the dynamic fallback query to `CourseEnrollment`.
- Evaluates access strictly against `SubscriptionAgreement`:
  ```typescript
  export async function checkLmsAccess(tenantContext: TenantContext, studentId: string, courseId: string) {
    const agreement = await prisma.subscriptionAgreement.findFirst({
      where: {
        institutionId: tenantContext.institutionId,
        studentId,
        courseId,
        status: 'ACTIVE',
        startsAt: { lte: new Date() },
        OR: [
          { endsAt: null },
          { endsAt: { gt: new Date() } }
        ]
      }
    });

    if (agreement) {
      return { allowed: true, agreementId: agreement.id };
    }

    return { allowed: false, reason: 'No active subscription agreement' };
  }
  ```
- Grandfathered legacy enrollments converted with `endsAt = migrationDate + 60 days` expire automatically on that exact second, enforcing the hard cutoff (OD-724.3).

### 3.3 Renewal Generator Worker (OD-726)
- Evaluates agreements with `autoRenew === true` and `now() >= nextBillingDate - 3 days`.
- Resolves current published catalog price (OD-726.2).
- Sets `newAgreement.startsAt = currentAgreement.endsAt` (OD-726.3 Contiguous Extension).
- Inserts new agreement and transitions previous agreement to `RENEWED` upon payment settlement.

---

## 4. Impact on Downstream Financial Modules (Tasks 7.3–7.7)

| Financial Module | Workshop Selection | Architectural Implementation Requirement |
|---|---|---|
| **Task 7.3: Invoicing** | UP-702 (VAT/ETA Opinion) | Schema supports multi-tax categories (`taxCategoryId`). Invoice engine reserves fields for `etaUuid`, digital signatures, and National IDs. |
| **Task 7.3: Invoicing** | UP-714 (Unbundled Hybrid) | Hybrid packages split invoice lines into discrete physical lab fees (attributed to physical campus) and digital LMS platform access (attributed to online branch). |
| **Task 7.4: Payments** | UP-706 (Admin Fee Refund) | Automated credit note generation deducting the fixed administrative processing fee from gross refund amounts. |
| **Task 7.5: General Ledger** | UP-701 (Statutory COA Review) | General Ledger engine design requires signed Chart of Accounts review by an Egyptian Certified Accountant before code rollout. |
| **Task 7.5: General Ledger** | UP-707 (Fiscal Year Start) | General Ledger accounting intervals parameterized via `Institution.fiscalYearStartMonth` (1 to 12). |
| **Task 7.5: General Ledger** | UP-709 (Dual Approval) | State machine introduces `PENDING_APPROVAL` status for discounts > 10% or adjustments > 500 EGP, requiring Primary Manager secondary signature. |
| **Task 7.7: Auditing** | UP-715 (Statutory Retention) | User account deletion preserves immutable `userId` on all financial records, while a batch anonymization worker scrubs PII (name, email, phone) to satisfy Law 151/2020. |

---

## 5. Explicit Governance Statement

```
TASK 7.2 STAGE B.4 — PRODUCT OWNER DECISION WORKSHOP — NO IMPLEMENTATION OR DATABASE AUTHORIZATION
```

