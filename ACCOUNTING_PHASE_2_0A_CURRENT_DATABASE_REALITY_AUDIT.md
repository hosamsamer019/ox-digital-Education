# OX-DIGITAL Education — Accounting Track
# Phase 2.0A: Current Database Reality & Legacy Entity Audit

**Author:** Senior Database Architect & Financial Systems Auditor  
**Project:** OX-DIGITAL Education  
**Workspace:** `D:\OX-DIGITAL\Mathe\OX-DIGITAL-GITHUB`  
**Git Baseline Commit:** `0500b93e65c24ed881349c4acea7f523332c5e9f` on branch `main`  
**Prisma Schema Path:** [`packages/database/prisma/schema.prisma`](file:///D:/OX-DIGITAL/Mathe/OX-DIGITAL-GITHUB/packages/database/prisma/schema.prisma)  
**Execution Mode:** STRICT READ-ONLY AUDIT (NO DATABASE CONNECTIONS / NO SCHEMA EDITS)  
**Date:** November 3, 2026

---

## 1. Executive Summary

This audit establishes the baseline technical reality of the existing OX-DIGITAL database by inspecting [`packages/database/prisma/schema.prisma`](file:///D:/OX-DIGITAL/Mathe/OX-DIGITAL-GITHUB/packages/database/prisma/schema.prisma) and relevant backend service controllers.

### Critical Database Reality Findings
1. **Physical Center Operational Baseline:** The current database models in-person centers through `CenterGroup` and `User` (`role: 'CENTER_STUDENT'`). There are **no tables or columns** representing online course subscriptions, recurring card tokenization, or automated digital membership renewals.
2. **The `Payment` Table Reality:**
   - Field `amount` is defined as `Float` (IEEE-754 double precision floating point), **not** `Decimal(12, 2)` or `BigInt` minor units.
   - `Payment` records represent **one-off online course purchases** via external payment gateways (Paymob/Stripe) associated with `courseId`.
   - `Payment` records do **not** represent physical center tuition collections, reception desk cash receipts, or installments.
   - `Payment.status` is an enum (`PENDING`, `PROCESSING`, `COMPLETED`, `FAILED`, `REFUNDED`).
3. **Absence of Student Financial Sub-Ledgers:**
   - There are **no accounts receivable tables**, no student fee agreements, no payment schedules, and no student balance fields in `model User`.
4. **Attendance Disconnect:**
   - `model Attendance` contains only `id`, `studentId`, `date`, and `status: String`.
   - It has **no** foreign keys to `institutionId`, `branchId`, `centerGroupId`, `courseId`, or `lessonId`.
   - `student` relation has `onDelete: Cascade`.
5. **Center Group Data Gaps:**
   - `model CenterGroup` contains only `id`, `name`, `schedule: String`, `institutionId`, `branchId`, `deletedAt`.
   - It has **no pricing method**, fee amounts, teacher assignment, room, or subject link.
   - Student membership is stored directly on `User.centerGroupId`. Group changes overwrite this foreign key without preserving membership history.
6. **Task 7.1 Foundation State:**
   - `Institution`, `Branch`, and `PrimaryManagerInvitation` models exist in `schema.prisma`.
   - Migration `packages/database/prisma/migrations/20261102_task_7_1_institution_branch_foundation/migration.sql` was drafted in Stage D, but has **not been applied** to a live database.

---

## 2. Comprehensive Model-by-Model Database Reality Audit

| Model Name | Primary Key | Tenancy (`institutionId`) | Branch (`branchId`) | Monetary Fields | Status / Type Fields | Delete Behavior (`onDelete`) | Lifecycle & Service Implementation | Verified Financial Meaning |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **`User`**<br>([schema.prisma#L79](file:///D:/OX-DIGITAL/Mathe/OX-DIGITAL-GITHUB/packages/database/prisma/schema.prisma#L79)) | `id: String @id @default(uuid())` | `institutionId: String?` (FK to `Institution`) | `branchId: String?` (FK to `Branch`) | None | `role: Role`<br>(`ADMIN`, `PRIMARY_MANAGER`, `TEACHER`, `ONLINE_STUDENT`, `CENTER_STUDENT`, `PARENT`) | Referenced with `onDelete: Restrict` by Payment; `onDelete: Cascade` by Attendance | Managed by `user.controller.ts`. Handles registration, profile edits. Overwrites `centerGroupId` on group transfer. | Represents human identity. `CENTER_STUDENT` denotes center attendee. Has **no** balance or sub-ledger. |
| **`Institution`**<br>([schema.prisma#L12](file:///D:/OX-DIGITAL/Mathe/OX-DIGITAL-GITHUB/packages/database/prisma/schema.prisma#L12)) | `id: String @id @default(uuid())` | Tenant Root (`code: String @unique`) | Parent of `Branch[]` | None | `status: InstitutionStatus`<br>(`ACTIVE`, `SUSPENDED`, `ARCHIVED`) | Referenced with `onDelete: Restrict` | Root tenant entity introduced in Task 7.1. Single `primaryManagerId` unique constraint. | Legal/commercial educational institution tenant boundary. |
| **`Branch`**<br>([schema.prisma#L35](file:///D:/OX-DIGITAL/Mathe/OX-DIGITAL-GITHUB/packages/database/prisma/schema.prisma#L35)) | `id: String @id @default(uuid())` | `institutionId: String`<br>(FK to `Institution`) | Self | None | `isOnline: Boolean`<br>`status: BranchStatus`<br>(`ACTIVE`, `INACTIVE`, `ARCHIVED`) | Referenced with `onDelete: Restrict` by User; `onDelete: SetNull` by Payment | Physical campus or digital branch container. `isOnline = true` denotes online campus. | Operational campus unit within an institution. Dimension of institution GL under OD-703. |
| **`CenterGroup`**<br>([schema.prisma#L127](file:///D:/OX-DIGITAL/Mathe/OX-DIGITAL-GITHUB/packages/database/prisma/schema.prisma#L127)) | `id: String @id @default(uuid())` | `institutionId: String?` | `branchId: String?` | None | None | `deletedAt: DateTime?` (Soft delete) | Plain cohort container. Managed via admin dashboard. `schedule` is an unstructured text string. | Physical classroom cohort. Currently lacks pricing, billing terms, teacher assignment, or curriculum. |
| **`Course`**<br>([schema.prisma#L144](file:///D:/OX-DIGITAL/Mathe/OX-DIGITAL-GITHUB/packages/database/prisma/schema.prisma#L144)) | `id: String @id @default(uuid())` | `institutionId: String?` | `branchId: String?` | `price: Float @default(0)` | `status: String @default("PUBLISHED")` | `teacher: User` (`onDelete: Cascade` on enrollment) | Managed by `course.controller.ts`. Represents academic subject / course. | Academic subject. `price` is a flat catalog amount for online enrollment, not group tuition. |
| **`Lesson`**<br>([schema.prisma#L189](file:///D:/OX-DIGITAL/Mathe/OX-DIGITAL-GITHUB/packages/database/prisma/schema.prisma#L189)) | `id: String @id @default(uuid())` | Inferred via `Course` | Inferred via `Course` | None | `deletedAt: DateTime?` | `course: Course` (`onDelete: Cascade`) | Online video / curriculum unit. Contains video uploads, quizzes, homework. | Digital curriculum unit. Has **no** connection to physical center classroom attendance. |
| **`Attendance`**<br>([schema.prisma#L291](file:///D:/OX-DIGITAL/Mathe/OX-DIGITAL-GITHUB/packages/database/prisma/schema.prisma#L291)) | `id: String @id @default(uuid())` | **NONE** (No FK) | **NONE** (No FK) | None | `status: String`<br>('PRESENT', 'ABSENT', 'LATE') | `student: User` (`onDelete: Cascade`) | Managed by `attendance.controller.ts`. Teacher/Admin marks student status on a specific date. | Operational attendance record. Lacks branch, group, and lesson references. Does not trigger revenue. |
| **`Payment`**<br>([schema.prisma#L304](file:///D:/OX-DIGITAL/Mathe/OX-DIGITAL-GITHUB/packages/database/prisma/schema.prisma#L304)) | `id: String @id @default(uuid())` | `institutionId: String?` | `branchId: String?` | `amount: Float`<br>`currency: String @default("EGP")` | `status: PaymentStatus`<br>(`PENDING`, `PROCESSING`, `COMPLETED`, `FAILED`, `REFUNDED`) | `user: User` (`onDelete: Restrict`)<br>`branch: Branch` (`onDelete: SetNull`) | Managed by `payment.controller.ts`. Webhook updates status from gateway; triggers `CourseEnrollment`. | One-off online gateway payment for digital courses. **Not** center tuition cash receipts. |
| **`CourseEnrollment`**<br>([schema.prisma#L176](file:///D:/OX-DIGITAL/Mathe/OX-DIGITAL-GITHUB/packages/database/prisma/schema.prisma#L176)) | `id: String @id @default(uuid())` | Inferred via `Course` | Inferred via `Course` | None | None | `student: User` (`onDelete: Cascade`)<br>`course: Course` (`onDelete: Cascade`) | Created upon online payment completion or manual admin enrollment. | Digital course access grant. Has no financial billing schedule. |
| **`PrimaryManagerInvitation`**<br>([schema.prisma#L61](file:///D:/OX-DIGITAL/Mathe/OX-DIGITAL-GITHUB/packages/database/prisma/schema.prisma#L61)) | `id: String @id @default(uuid())` | `institutionId: String` | None | None | `status: InvitationStatus`<br>(`PENDING`, `ACCEPTED`, `REVOKED`, `EXPIRED`) | `institution: Institution` (`onDelete: Restrict`) | Cryptographic token (32-byte entropy SHA-256 hash). 48-hr expiry. (Option 3B OD-718). | Institutional onboarding invitation. |

---

## 3. Deep Analysis of Existing Financial & Operational Lifecycles

### 3.1 The `Payment` Lifecycle Analysis
Inspection of [`services/course-service/src/controllers/payment.controller.ts`](file:///D:/OX-DIGITAL/Mathe/OX-DIGITAL-GITHUB/services/course-service/src/controllers/payment.controller.ts):
```typescript
// 1. Client requests payment creation:
POST /api/payments/create -> createPayment()
// 2. Looks up Course from database:
const course = await db.course.findUnique({ where: { id: courseId } });
// 3. Calls external payment provider (Paymob, Stripe) to obtain intent:
const intent = await provider.createPaymentIntent({ amount: course.price, ... });
// 4. Inserts row into Payment with status = 'PENDING':
const payment = await db.payment.create({
  data: { userId, amount: course.price, currency: 'EGP', status: 'PENDING', provider, providerOrderId, courseId }
});
// 5. External Webhook callback:
POST /api/payments/webhook/:provider -> handleWebhook()
// 6. Validates HMAC signature, checks paidAmount >= expectedAmount, updates:
await tx.payment.update({ where: { id: payment.id }, data: { status: 'COMPLETED' } });
// 7. Auto-enrolls student in CourseEnrollment:
await tx.courseEnrollment.upsert({ where: { studentId_courseId: ... }, create: { studentId, courseId } });
```

#### Verified Findings on Existing Payments
1. **Timing of Creation:** `Payment` records are created **before** payment confirmation with `status: 'PENDING'`.
2. **Status Mutability:** Status is mutated in-place (`PENDING` -> `COMPLETED` or `FAILED`).
3. **No General Ledger Connection:** Successful payment creates a `CourseEnrollment` record. It generates **no** double-entry journal entries, no ledger line items, and no cash account postings.
4. **Float Precision Vulnerability:** `amount: Float` introduces potential IEEE-754 precision rounding errors in monetary sums.
5. **No Connection to Physical Centers:** `courseId` links to `model Course`. There is no link to `CenterGroup`, no receipt number, and no cashier identification.

### 3.2 The `Attendance` Lifecycle Analysis
Inspection of [`services/user-service/src/controllers/attendance.controller.ts`](file:///D:/OX-DIGITAL/Mathe/OX-DIGITAL-GITHUB/services/user-service/src/controllers/attendance.controller.ts):
```typescript
POST /api/attendance/mark -> markAttendance()
// Validates: studentId (UUID), status ('PRESENT' | 'ABSENT' | 'LATE'), date (optional)
// Verifies teacher or admin authorization:
const isAuthorized = await verifyTeacherOrAdminAccess(requesterId, requesterRole, studentId);
// Creates or updates Attendance row:
await db.attendance.create({ data: { studentId, status, date: normalizedDate } });
```

#### Verified Findings on Existing Attendance
1. **Date-Only Context:** Normalizes to day boundaries (`00:00:00` to `23:59:59.999`).
2. **Missing Group & Lesson Lineage:** Does not store which `CenterGroup` was attending, which `Lesson` was taught, or which teacher conducted the classroom session.
3. **Absence of Provenance:** In Task 7.1 migration audit, legacy attendance records had unresolved branch provenance (`branchId: null`).
4. **Cascade Deletion Danger:** `student User @relation(fields: [studentId], references: [id], onDelete: Cascade)`. Deleting a student user cascades and permanently erases all attendance history!

### 3.3 The `CenterGroup` & Student Transfer Analysis
Inspection of [`services/user-service/src/controllers/user.controller.ts`](file:///D:/OX-DIGITAL/Mathe/OX-DIGITAL-GITHUB/services/user-service/src/controllers/user.controller.ts#L399-L536):
- When an admin updates a student's group, `updateData.centerGroupId = centerGroupId;` directly overwrites the field on `model User`.
- **Zero Membership History:** There is no history log of when the student joined or left the previous group.
- **Financial Consequence:** If group fees are tied solely to `User.centerGroupId`, changing groups would retroactively detach or scramble the student's historical billing context.

---

## 4. Synthesis of Database Gaps & Architecture Requirements

| Domain Need | Current Schema State | Architecture Requirement for Phase 2.0A |
| :--- | :--- | :--- |
| **Monetary Integrity** | `Payment.amount` is `Float` | Propose `Decimal(12, 2)` or integer minor units (piasters) for all new accounting tables. |
| **Data Preservation (OD-708)**| `Attendance` and `CourseEnrollment` cascade-delete on User deletion | Financial sub-ledgers and journal lines must strictly use `onDelete: Restrict`. Financial history must never be cascade-deleted. |
| **Student Sub-Ledger** | Non-existent (no accounts receivable or balance fields) | Propose dedicated `StudentFinancialAccount`, `StudentFinancialAgreement`, and `StudentObligation` entities. |
| **Group Pricing Models** | `CenterGroup` has no pricing attributes | Propose `GroupPricingAgreement` with extensible pricing strategies (Fixed Term, Monthly, Per-Session). |
| **Tamper-Evident Receipts**| No receipt tables or sequential receipt numbers | Propose `Collection` entity with contiguous branch receipt numbers (`REC-{BRANCH}-{YEAR}-{SEQ}`). |
| **Cashbox Management** | No cash register or till entities | Propose `Cashbox`, `CashboxTransaction`, and `CashboxReconciliation` entities. |
| **Append-Only Ledger (OD-723)**| No general ledger, accounts, or journal entry tables | Propose `Account`, `JournalEntry`, `JournalLine`, and database immutability triggers. |
| **Attendance Lineage** | `Attendance` lacks group/lesson FKs | Propose `LessonDeliveryEvidence` linking `CenterGroup`, `Lesson`, and `Attendance` before triggering revenue recognition. |

