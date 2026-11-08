# OX-DIGITAL Education — Phase 7.2
# Student Subscription Agreements Audit
## Stage A — Read-Only Forensic Architecture & Lifecycle Assessment

**Document ID:** `OD-7202-SUBSCRIPTION-AGREEMENTS-AUDIT`  
**Workspace:** `D:\OX-DIGITAL\Mathe\OX-DIGITAL-GITHUB`  
**Repository:** `https://github.com/hosamsamer019/ox-digital-Education.git`  
**Git HEAD:** `0500b93e65c24ed881349c4acea7f523332c5e9f` (Branch: `main`)  
**Audit Date:** November 2026  
**Execution Mode:** READ-ONLY (ZERO APPLICATION CODE OR DATABASE MUTATIONS)  
**Status:** **STAGE A READ-ONLY AUDIT COMPLETE — IMPLEMENTATION NOT AUTHORIZED**

---

## 1. Executive Summary

This forensic audit evaluates the legal, contractual, and operational mechanics governing student educational access, course enrollment, subscription terms, and financial obligations in OX-DIGITAL Education.

### Core Forensic Finding
The platform currently has **no subscription agreement concept**. Student access is modeled exclusively through a bare join table:
```prisma
// packages/database/prisma/schema.prisma:42-53
model CourseEnrollment {
  id        String   @id @default(uuid())
  studentId String
  courseId  String
  createdAt DateTime @default(now())
  course    Course   @relation(fields: [courseId], references: [id], onDelete: Cascade)
  student   User     @relation(fields: [studentId], references: [id], onDelete: Cascade)

  @@unique([studentId, courseId])
  @@index([studentId])
  @@index([courseId])
}
```
`CourseEnrollment` stores only `createdAt`. It contains no expiration timestamp, no billing cycle, no agreed monetary value, no payment reference, and no cancellation/suspension state. A single webhook completion grants **permanent, perpetual access** to an entire educational course without ongoing financial tracking or receivables.

---

## 2. Forensic Analysis of Current Student Enrollment Flow

### 2.1 The Perpetual Access Grant (`services/course-service/src/controllers/payment.controller.ts`)
In `payment.controller.ts` (lines 121–136):
```typescript
if (payment.status !== 'COMPLETED') {
  await tx.payment.update({
    where: { id: payment.id },
    data: { status: 'COMPLETED' },
  });

  // Auto-enroll student in the course
  if (payment.courseId) {
    await tx.courseEnrollment.upsert({
      where: {
        studentId_courseId: {
          studentId: payment.userId,
          courseId: payment.courseId,
        },
      },
      update: {},
      create: {
        studentId: payment.userId,
        courseId: payment.courseId,
      },
    });
  }
}
```

### 2.2 Critical Legal & Accounting Vulnerabilities
1. **Perpetual Free Access After Expiry:** A student paying for "October Tuition" receives an enrollment row that has no expiration date. The LMS checks `checkUserEnrollment(studentId, courseId)` which simply evaluates whether a row exists in `CourseEnrollment`. The student retains full video streaming and exam access for years without paying November tuition.
2. **No Receivable or Debt Tracking:** The platform cannot track students who attended physical center classes but have not yet paid their monthly fees. There is no agreement representing the student's legal obligation to pay.
3. **Absence of Suspension / Default States:** If a student fails to pay, staff cannot suspend their access while preserving their academic history. Staff must either delete the `CourseEnrollment` row (destroying student analytics) or leave it active.
4. **No Price Locking:** If an institution raises course tuition from 400 EGP to 600 EGP, existing students have no contractual record proving they enrolled under a fixed 400 EGP rate.

---

## 3. Subscription Agreement Target Model

To comply with enterprise educational standards and accrual accounting (OD-704, OD-705), the platform must introduce an authoritative **`SubscriptionAgreement`** entity that serves as the legal contract between the Student and the Educational Institution.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                      SUBSCRIPTION AGREEMENT STRUCTURE                       │
│                                                                             │
│  [Student (User)] ◄──────┐                                                  │
│                          │                                                  │
│  [Institution]    ◄──────┼─── [SubscriptionAgreement]                      │
│                          │          │                                       │
│  [Branch / Online] ◄─────┘          ├── Agreement Serial (AGR-2026-0001)    │
│                                     ├── Status State Machine                │
│  [PriceCatalogItem]                 ├── Agreed Fixed Amount (Snapshot)      │
│         │                           ├── Service Period (startsAt, endsAt)   │
│         └── [PriceVersion] ─────────┤                                       │
│             (Snapshot at Agreement) ├── Downstream Invoices (Task 7.3)      │
│                                     └── Downstream Receivables & GL (Task 7.5)
└─────────────────────────────────────────────────────────────────────────────┘
```

### 3.1 Proposed Data Structure: `SubscriptionAgreement`
* **Identification:** `id String @id @default(uuid())`, `agreementNumber String @unique` (e.g., `AGR-2026-000001`).
* **Tenant Root:** `institutionId String` (FK -> `Institution`, `onDelete: Restrict`).
* **Branch / Online Attribution (OD-703, OD-719):** `branchId String` (FK -> `Branch`). If `branch.isOnline == true`, attributes revenue to the Online division.
* **Student Identity:** `studentId String` (FK -> `User`, `onDelete: Restrict`).
* **Educational Target:**
  * `courseId String?` (FK -> `Course`).
  * `centerGroupId String?` (FK -> `CenterGroup`).
* **Pricing Snapshot (Immutability Guarantee):**
  * `priceCatalogItemId String`.
  * `priceVersionNumber Int`.
  * `agreedAmount Decimal @db.Decimal(12, 2)`.
  * `currency String @default("EGP")`.
  * `billingInterval BillingInterval` (`MONTHLY`, `TERM`, `ANNUAL`, `PER_SESSION`).
* **Term & Service Period:**
  * `agreementDate DateTime @default(now())`.
  * `startsAt DateTime`.
  * `endsAt DateTime`.
  * `renewsAt DateTime?`.
  * `gracePeriodEndsAt DateTime?`.
* **Financial Tracking:**
  * `totalAgreedAmount Decimal @db.Decimal(12, 2)`.
  * `paidAmount Decimal @default(0) @db.Decimal(12, 2)`.
  * `outstandingBalance Decimal @db.Decimal(12, 2)`.
* **Audit Trail:**
  * `createdByUserId String`.
  * `approvedByUserId String?`.
  * `cancellationReason String?`.
  * `cancelledAt DateTime?`.

---

## 4. Agreement Lifecycle State Machine

A student subscription agreement transitions through a strict, deterministic state machine:

```
                  ┌──────────────┐
                  │    DRAFT     │
                  └──────┬───────┘
                         │ Submit for Approval
                         ▼
                  ┌──────────────┐
                  │   PENDING    │
                  └──────┬───────┘
                         │ Approved & Effective
                         ▼
        ┌─────────► ┌──────────────┐ ◄──────────┐
        │           │    ACTIVE    │            │
        │           └──────┬───────┘            │
        │ Payment          │                    │ Payment Restored
        │ Made             ▼ Non-Payment / Hold │
        │           ┌──────────────┐            │
        └───────────┤  SUSPENDED   ├────────────┘
                    └──────┬───────┘
                           │
             ┌─────────────┴─────────────┐
             ▼                           ▼
      ┌──────────────┐            ┌──────────────┐
      │   EXPIRED    │            │  CANCELLED   │
      └──────┬───────┘            └──────────────┘
             │ (Withdrawal OD-708)
             ▼
      ┌──────────────┐
      │   RENEWED    │
      └──────────────┘
```

### State Definitions & Access Rules:
1. **`DRAFT`:** Agreement configured by admissions or parent; no LMS access granted.
2. **`PENDING`:** Awaiting institutional manager approval or initial deposit payment.
3. **`ACTIVE`:** Valid agreement within service period (`startsAt <= NOW <= endsAt`); **LMS access granted** (streaming, exams, physical attendance enabled).
4. **`SUSPENDED`:** Temporary hold due to non-payment or administrative hold; **LMS access blocked**, academic progress and enrollment records preserved.
5. **`EXPIRED`:** Agreement reached `endsAt` without renewal; LMS access terminated; student records preserved.
6. **`CANCELLED`:** Agreement terminated by parent or school; triggers withdrawal accounting protocol (OD-708 reversal/credit note, zero physical deletion).
7. **`RENEWED`:** Agreement succeeded by a new agreement term; links `parentAgreementId` for continuous student history.

---

## 5. Price-Locking Mechanics (Snapshot at Enrollment)

A core requirement of institutional governance is that **price changes never silently modify an existing agreement**.

### Price Locking Protocol:
1. When a student registers or enrolls, the system resolves the current active `PriceVersion` for that item and branch.
2. The agreement persists:
   * `agreedAmount = priceVersion.price`
   * `priceVersionNumber = priceVersion.versionNumber`
3. Subsequent changes to the master `PriceCatalog`:
   * Update the catalog's current `PriceVersion`.
   * Apply exclusively to *new* agreements executed after `validFrom`.
   * Existing agreements retain `agreedAmount` permanently until the end of their contracted service period.
4. Any contractual price adjustment for an existing student requires an explicit, audited `AgreementAmendment` or a new `SubscriptionAgreement` with manager approval.

---

## 6. Integration with Course Enrollment (`CourseEnrollment`)

Rather than `CourseEnrollment` serving as an unconstrained access grant, it must become an operational mirror of the authoritative `SubscriptionAgreement`:

* `CourseEnrollment` is enhanced with `subscriptionAgreementId String?`.
* LMS Access Enforcement Guard:
  ```typescript
  export async function checkLmsAccess(studentId: string, courseId: string): Promise<boolean> {
    const agreement = await db.subscriptionAgreement.findFirst({
      where: {
        studentId,
        courseId,
        status: 'ACTIVE',
        startsAt: { lte: new Date() },
        endsAt: { gte: new Date() }
      }
    });
    return Boolean(agreement);
  }
  ```
* When an agreement expires or is suspended, LMS access terminates immediately without deleting student submissions, grades, or historical exam attempts.

---

## 7. Audit Verdict & Readiness

| Assessment Dimension | Existing State | Target Architecture | Readiness Status |
|---|---|---|:---:|
| **Contractual Agreement Record** | None (`CourseEnrollment` join table) | Dedicated `SubscriptionAgreement` entity | **READY FOR STAGE B DESIGN** |
| **Lifecycle State Machine** | None (Binary enrolled/not-enrolled) | 7-stage state machine with access sync | **READY FOR STAGE B DESIGN** |
| **Historical Price Locking** | None (Live float lookup) | Snapshot of agreed price on agreement | **READY FOR STAGE B DESIGN** |
| **Physical Center Agreements** | Completely unrepresented | Supported via `centerGroupId` & branch | **READY FOR STAGE B DESIGN** |
| **Withdrawal / Cancellation Policy** | None (Physical deletion risk) | OD-708 controlled reversal & suspension | **READY FOR STAGE B DESIGN** |

**Conclusion:** The Student Subscription Agreements architecture is fully specified and ready for formal data modeling in Stage B. Implementation is blocked until Task 7.1 migrations are applied in staging and Product Owner policy UP-709 is confirmed.

