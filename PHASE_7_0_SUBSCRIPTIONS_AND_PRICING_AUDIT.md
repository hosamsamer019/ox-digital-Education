# PHASE 7.0 — SUBSCRIPTIONS AND PRICING AUDIT
**Product:** OX-DIGITAL Education  
**Workspace:** `D:\OX-DIGITAL\Mathe\OX-DIGITAL-GITHUB`  
**Audit Date:** November 2026  
**Status:** COMPLETE (READ-ONLY FORENSIC AUDIT)

---

## 1. Executive Summary

This forensic audit investigates the subscription, pricing, billing, and course monetization mechanics in the OX-DIGITAL codebase. It audits the existing database schema, API controllers, payment gateway integrations, and frontend interfaces to determine their architectural completeness and accounting viability.

### Core Verdict
The platform **does not possess an actual subscription or pricing engine**. What exists is an **ephemeral one-off checkout mechanism** for individual online courses:
1. `Course.price` is a flat float on the `Course` table.
2. There are no `Subscription`, `SubscriptionPlan`, `Invoice`, `BillingSchedule`, `Discount`, or `Receivable` entities in Prisma.
3. Access is permanently granted upon webhook receipt without an expiration timestamp (`CourseEnrollment` contains only `createdAt`).
4. Physical center pricing, recurring student tuition, group rates, and teacher commission splits are completely unrepresented in the code.
5. Historical price preservation is absent; changing a course's price modifies future lookups without protecting historical transaction integrity.

---

## 2. Forensic Code Inventory & Implementation Analysis

### 2.1 Database Models (`packages/database/prisma/schema.prisma`)

```prisma
model Course {
  id             String             @id @default(uuid())
  title          String
  description    String?
  createdAt      DateTime           @default(now())
  teacherId      String
  updatedAt      DateTime           @updatedAt
  category       String?
  price          Float              @default(0)       // <--- Sole price field
  status         String             @default("PUBLISHED")
  // ...
  enrollments    CourseEnrollment[]
}

model CourseEnrollment {
  id        String   @id @default(uuid())
  studentId String
  courseId  String
  createdAt DateTime @default(now())                  // <--- No expiresAt, no status, no term
  course    Course   @relation(fields: [courseId], references: [id], onDelete: Cascade)
  student   User     @relation(fields: [studentId], references: [id], onDelete: Cascade)

  @@unique([studentId, courseId])
  @@index([studentId])
  @@index([courseId])
}

model Payment {
  id              String        @id @default(uuid())
  userId          String
  amount          Float
  createdAt       DateTime      @default(now())
  updatedAt       DateTime      @updatedAt
  date            DateTime      @default(now())
  courseId        String?
  currency        String        @default("EGP")
  metadata        Json?
  provider        String?
  providerOrderId String?
  status          PaymentStatus @default(PENDING)
  user            User          @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
  @@index([providerOrderId])
  @@index([createdAt])
}
```

### 2.2 Payment Controller Workflow (`services/course-service/src/controllers/payment.controller.ts`)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                       CURRENT PAYMENT LIFECYCLE                             │
│                                                                             │
│ [Student Browser]                                                           │
│        │                                                                    │
│        ▼ POST /api/payments/create { provider, courseId, amount }           │
│ [Payment Controller]                                                        │
│        │── Fetch course: db.course.findUnique({ id })                       │
│        │── Validate amount: Math.abs(clientAmount - course.price) <= 0.01   │
│        │── Create external gateway order (Paymob/Fawry/Stripe)              │
│        └── Insert Payment row (status: PENDING)                             │
│                                                                             │
│ [External Gateway Webhook]                                                  │
│        │                                                                    │
│        ▼ POST /api/payments/webhook/:provider                               │
│ [Payment Controller (Webhook)]                                              │
│        │── Verify gateway signature/HMAC                                    │
│        └── db.$transaction:                                                 │
│               ├── Update Payment row: status = 'COMPLETED'                  │
│               └── Upsert CourseEnrollment (studentId, courseId)             │
│                   (Grants PERPETUAL access, no renewal, no invoice)         │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Detailed Forensic Gaps & Vulnerabilities

### 3.1 Absence of Subscription and Billing Cycle Modeling
- **Zero Term Tracking:** `CourseEnrollment` stores only `createdAt`. There is no `startsAt`, `expiresAt`, `renewsAt`, or `cancellationDate`. A student enrolled in a monthly course remains enrolled indefinitely.
- **No Recurring Billing:** There is no recurring billing worker, card tokenization engine, or scheduled invoice dispatcher. 
- **Stripe Webhook Dead Code:** In `services/analytics-service/src/controllers/stripe.webhook.ts` (Line 79):
  ```typescript
  case 'customer.subscription.deleted': {
    // Placeholder — extend when subscription model is added to schema
    logger.info('[Stripe] Subscription cancelled', { subscriptionId: event.data.object.id });
    break;
  }
  ```
  The developer left an explicit comment admitting that subscriptions do not exist in the database schema.

### 3.2 Violation of Historical Price Preservation
In `payment.controller.ts` (Lines 26–31):
```typescript
const course = await (db as any).course.findUnique({ where: { id: courseId } });
const authoritativeAmount = Number(course.price) || 0;

if (clientAmount !== undefined && Math.abs(Number(clientAmount) - authoritativeAmount) > 0.01) {
  return res.status(400).json({ message: 'Invalid payment amount. Course price mismatch.' });
}
```
- **The Defect:** The checkout process looks up the live `course.price` directly from `Course`. 
- **Consequence:** If an administrator changes `Course.price` from 500 EGP to 700 EGP while a student has an uncompleted payment intent or installment plan, the webhook or completion check fails. More critically, the database has no `PriceCatalog`, `PriceAgreement`, or `Contract` record tying the student to an agreed-upon historical price.

### 3.3 Complete Absence of Accounts Receivable (AR) & Invoicing
- **No Invoices:** Neither `CourseEnrollment` nor `Payment` generates a formal invoice or unique invoice serial number (e.g., `INV-2026-0001`).
- **No Installment or Partial Payments:** Payments are strictly all-or-nothing per course. A student cannot pay 50% upfront and 50% next month.
- **No Outstanding Balance Ledger:** There is no mechanism to track student debt, overdue fees, or advance prepayments.

### 3.4 Physical Center Tuition & Group Pricing Omission
- Center students attend physical groups (`CenterGroup`).
- In `packages/database/prisma/schema.prisma`, `CenterGroup` contains no price, tuition fee, session cost, or payment relationship.
- Physical centers collect tuition through cash, bank transfers, or manual center receipts; none of these can be recorded in the current system because `Payment` requires a `provider` (which maps only to Paymob, Fawry, or Stripe) and optionally a `courseId`.

### 3.5 Frontend Subscription Interfaces Audit
1. **Admin Subscription Page (`apps/frontend/src/app/components/admin/SubscriptionPage.tsx`):**
   - Purely synthetic mock data:
     ```typescript
     const revenueData = [
       { month: 'أكتوبر', revenue: 12400, subscribers: 124 },
       // ...
     ];
     ```
   - Renders mock charts and hardcoded plan distribution (`أساسي`, `احترافي`, `مؤسسي`). None of these plans exist in any backend service.
2. **Parent Subscription Page (`apps/frontend/src/app/components/parent/ParentSubscriptionPage.tsx`):**
   - Displays an explicit placeholder: *"قريباً — قيد التطوير والاعتماد — منظومة الاشتراكات الإلكترونية لأولياء الأمور"*.

---

## 4. Subscription & Pricing Gap Matrix

| Financial Capability | Expected Accounting Standard | Current Platform Implementation | Gap Severity |
| :--- | :--- | :--- | :--- |
| **Pricing Catalog** | Centrally versioned price list with effective dates and branch rules. | Single mutable float column `price` on `Course`. | **CRITICAL** |
| **Historical Price Locking** | Price snapshot recorded on agreement/order; unchanged by future catalog edits. | None. Dynamic lookup from `Course.price`. | **CRITICAL** |
| **Subscription Plans** | Multi-tiered plans (Monthly, Term, Annual, Subject-based) with feature entitlements. | None. Individual course purchases only. | **CRITICAL** |
| **Subscription Terms** | Start date, end date, grace period, renewal status, and auto-renew flags. | None. `CourseEnrollment` has only `createdAt`. | **CRITICAL** |
| **Invoicing** | Sequentially numbered, tax-compliant invoice documents. | None. Raw `Payment` rows without invoice linkage. | **CRITICAL** |
| **Installment Schedules** | Defined payment tranches linked to a master receivable. | None. Single transactions only. | **HIGH** |
| **Discounts & Exemptions** | Promotional vouchers, sibling discounts, scholarships, and fee waivers. | None. Hardcoded price matching. | **HIGH** |
| **Physical Center Fees** | Attendance-based session fees, monthly group tuition, and lab fees. | Completely absent from database and APIs. | **CRITICAL** |

---

## 5. Architectural Recommendations for Target System

1. **Central Price Catalog (`PriceCatalog` & `PriceCatalogItem`):**
   - Central definition of base prices for all services (Online Subscriptions, Center Tuition, Private Lessons, Exam Packs).
   - Versioned with `validFrom` and `validTo` timestamps.
2. **Student Billing Agreements (`BillingAgreement`):**
   - Captures agreed pricing at registration or enrollment.
   - Preserves agreed price permanently against future catalog inflation.
3. **Formal Invoicing Engine (`Invoice` & `InvoiceItem`):**
   - Issued prior to payment collection.
   - Tracks `status` (`DRAFT`, `ISSUED`, `PAID`, `PARTIALLY_PAID`, `VOID`, `OVERDUE`).
   - Links to double-entry Accounts Receivable ledger.
4. **Subscription Entitlement Engine (`Subscription`):**
   - Explicit lifecycle: `ACTIVE`, `TRIALING`, `PAST_DUE`, `CANCELED`, `EXPIRED`.
   - Automated provisioning and expiration sync with `CourseEnrollment` and LMS access tokens.

