# OX-DIGITAL Education — Phase 4: Workstream A
## Step A0: Pre-Implementation Schema Audit & Migration Plan
### Deliverable 1: Existing Prisma Schema Inventory & Infrastructure Audit

**Workspace:** `D:\OX-DIGITAL\Mathe\OX-DIGITAL-GITHUB`  
**Target:** `docs/phase-4/workstream-a/step-a0/EXISTING_PRISMA_SCHEMA_INVENTORY.md`  
**Execution Mode:** STRICTLY READ-ONLY AUDIT & IMPLEMENTATION PLANNING  
**Date:** November 4, 2026  
**Author:** Lead Software Architect & Financial Systems Security Reviewer  

---

## 1. Executive Summary

This inventory provides an exhaustive, field-level audit of the current persistence schema (`packages/database/prisma/schema.prisma`), database migrations history (`packages/database/prisma/migrations/`), and relevant database-level configurations within the OX-DIGITAL Education codebase.

### Key Audit Findings:
1. **Total Existing Models Inspected:** Exactly **31 Prisma Models**.
2. **Total Existing Enums Inspected:** Exactly **14 Enums**.
3. **Existing Financial Accounting Models:** **0 Models (0% Financial Persistence)**. Zero tables currently exist for physical cashboxes, till movements, multi-stage cash transfers, shift reconciliations, expense vouchers, commercial student agreements, installment payment schedules, collection receipts, waterfall allocations, journal entries, or revenue recognition.
4. **Existing Tenancy Infrastructure:** The multi-tenant baseline established in Task 7.1 (`Institution`, `Branch`, `PrimaryManagerInvitation`) exists in `schema.prisma` and is structurally sound.
5. **Existing Payment Model:** A single `Payment` model exists, but it was designed for legacy single-charge online checkout (utilizing IEEE 754 floating-point `Float` values, simple status flags, and zero double-entry or cashbox integration). It cannot serve as the institutional physical center sub-ledger or cashbox till intake without severe architectural corruption.

---

## 2. Complete Inventory of Existing Prisma Models (31 Models)

The table below catalogs all 31 existing models in `packages/database/prisma/schema.prisma`, their domain classification, primary keys, tenant scoping, and relevance to financial accounting:

| # | Model Name | Domain Classification | Primary Key | Tenant Scoped (`institutionId`) | Branch Scoped (`branchId`) | Financial Role / Reuse Evaluation |
| :-: | :--- | :--- | :---: | :---: | :---: | :--- |
| **1** | `Institution` | Tenancy Root | `id` (UUID / TEXT) | N/A (Root) | N/A | **Tenant Root Entity:** Master boundary for all institutional accounting. Contains `status`, `code`, `primaryManagerId`, `fiscalYearStartMonth` parameter (`UP-707`). |
| **2** | `Branch` | Tenancy Dimension | `id` (UUID / TEXT) | YES (`NOT NULL`) | N/A (Branch) | **Operating Dimension Entity:** Physical centers (`BR-01` Dokki, `BR-02` Nasr City) and online branch (`isOnline = true`). Primary dimension for branch accounting. |
| **3** | `PrimaryManagerInvitation` | Tenancy Security | `id` (UUID / TEXT) | YES (`NOT NULL`) | NO | **Security Entity:** Governs onboarding of the institutional Primary Manager (`OD-718`). Non-financial. |
| **4** | `User` | Identity & Auth | `id` (UUID / TEXT) | YES (`NULLABLE`) | YES (`NULLABLE`) | **Actor Master Entity:** Identity for Cashiers, Accountants, Primary Managers, Teachers, and Students. Role-based financial actor. |
| **5** | `CenterGroup` | Academic Core | `id` (UUID / TEXT) | YES (`NULLABLE`) | YES (`NULLABLE`) | **Academic Context:** Center group/class cohort. Directly linked to group pricing agreements and classroom attendance. |
| **6** | `Course` | Academic Core | `id` (UUID / TEXT) | YES (`NULLABLE`) | YES (`NULLABLE`) | **Academic Context:** Course catalog entity. Links to teachers and lessons. |
| **7** | `CourseEnrollment` | Academic Core | `id` (UUID / TEXT) | NO (Via Course) | NO (Via Course) | **Academic Context:** Student-to-course link. Does not store financial obligations. |
| **8** | `Lesson` | Academic Core | `id` (UUID / TEXT) | NO (Via Course) | NO (Via Course) | **Academic Context:** Scheduled syllabus lesson. Target anchor for `LessonDeliveryEvidence`. |
| **9** | `Exam` | Academic Core | `id` (UUID / TEXT) | NO (Via Course) | NO (Via Course) | Academic assessment entity. Non-financial. |
| **10**| `ExamAttempt` | Academic Core | `id` (UUID / TEXT) | NO (Via Exam) | NO (Via Exam) | Academic assessment submission. Non-financial. |
| **11**| `Homework` | Academic Core | `id` (UUID / TEXT) | NO (Via Course) | NO (Via Course) | Academic assignment entity. Non-financial. |
| **12**| `Submission` | Academic Core | `id` (UUID / TEXT) | NO (Via Homework)| NO (Via Homework)| Academic homework submission. Non-financial. |
| **13**| `Attendance` | Academic Core | `id` (UUID / TEXT) | NO (Via User) | NO | **Academic Attendance:** Pure student attendance log (`date`, `status`). Lacks lesson/course link and supervisor sign-off. |
| **14**| `Payment` | Legacy Billing | `id` (UUID / TEXT) | YES (`NULLABLE`) | YES (`NULLABLE`) | **Legacy Online Payment:** Single-record electronic payment tracking. Uses floating point `Float`. Incompatible with double-entry. |
| **15**| `VideoProgress` | Digital LMS | `id` (UUID / TEXT) | NO (Via User) | NO | Digital student playback tracking. Non-financial. |
| **16**| `Assessment` | Unified Exams | `id` (UUID / TEXT) | NO (Via Course) | NO | Assessment definitions. Non-financial. |
| **17**| `ExternalExamAttempt` | Unified Exams | `id` (UUID / TEXT) | NO | NO | External exam tracking. Non-financial. |
| **18**| `AssessmentAttempt` | Unified Exams | `id` (UUID / TEXT) | NO | NO | Unified exam attempts. Non-financial. |
| **19**| `StudentRiskHistory` | Analytics | `id` (UUID / TEXT) | NO | NO | Student drop-out and performance risk history. Non-financial. |
| **20**| `LessonQuiz` | Academic Core | `id` (UUID / TEXT) | NO (Via Lesson) | NO | Micro-quizzes attached to lessons. Non-financial. |
| **21**| `ChatSession` | Communication | `id` (UUID / TEXT) | NO | NO | AI/tutor chat sessions. Non-financial. |
| **22**| `ChatMessage` | Communication | `id` (UUID / TEXT) | NO | NO | Messages inside chat sessions. Non-financial. |
| **23**| `Notification` | System Services | `id` (UUID / TEXT) | NO (Via User) | NO | System and user notifications. Target for financial alerts. |
| **24**| `QuestionBank` | Academic Core | `id` (UUID / TEXT) | YES (`NULLABLE`) | NO | Repository of exam questions. Non-financial. |
| **25**| `SavedMathSolution` | AI Service | `id` (UUID / TEXT) | NO | NO | Saved OCR/AI math step solutions. Non-financial. |
| **26**| `VideoUpload` | Media Pipeline | `id` (UUID / TEXT) | NO | NO | Raw video processing uploads. Non-financial. |
| **27**| `UserSession` | Authentication | `id` (UUID / TEXT) | NO (Via User) | NO | Active user auth sessions and refresh tokens. |
| **28**| `DailyPlatformStats` | Analytics | `id` (UUID / TEXT) | NO | NO | Global system aggregation statistics. Non-financial. |
| **29**| `ExamViolation` | Proctoring | `id` (UUID / TEXT) | NO | NO | Exam proctoring cheating flags. Non-financial. |
| **30**| `TemporaryAsset` | Storage Engine | `id` (UUID / TEXT) | NO | NO | Ephemeral file upload tokens. Non-financial. |
| **31**| `ProcessedMedia` | Media Pipeline | `id` (UUID / TEXT) | YES (`NULLABLE`) | NO | Transcoded educational video assets. Non-financial. |

---

## 3. Complete Inventory of Existing Enums (14 Enums)

The table below catalogs all 14 existing enums in `schema.prisma`:

| # | Enum Name | Values | Classification & Accounting Impact |
| :-: | :--- | :--- | :--- |
| **1** | `Role` | `STUDENT`, `TEACHER`, `ADMIN`, `PARENT`, `PRIMARY_MANAGER` | **Auth Hierarchy:** Contains `PRIMARY_MANAGER`. Missing dedicated `ACCOUNTANT` and `CASHIER` values (currently managed in memory via `packages/shared/src/accounting/center/roles.ts`). |
| **2** | `InstitutionStatus` | `ACTIVE`, `SUSPENDED`, `ARCHIVED` | Tenancy state machine. |
| **3** | `BranchStatus` | `ACTIVE`, `INACTIVE`, `ARCHIVED` | Branch operational lifecycle state machine. |
| **4** | `InvitationStatus` | `PENDING`, `ACCEPTED`, `REVOKED`, `EXPIRED` | Primary Manager onboarding workflow. |
| **5** | `UploadStatus` | `UPLOADING`, `PROCESSING`, `COMPLETED`, `FAILED` | Media processing pipeline state. |
| **6** | `AcademicLevel` | `PRIMARY`, `PREPARATORY`, `SECONDARY` | Egyptian educational staging levels. |
| **7** | `PaymentStatus` | `PENDING`, `PAID`, `FAILED`, `REFUNDED` | **Legacy Status:** Basic 4-state payment flag. Incompatible with multi-stage sub-ledger and cash reconciliations. |
| **8** | `CountryCode` | `EG`, `SA`, `AE`, `KW`, `QA`, `BH`, `OM`, `JO`, `US`, `GB` | Country classification. Launch default `EG`. |
| **9** | `EducationLevel` | `THANAWEYA_AMMA`, `IGCSE`, `AMERICAN_DIPLOMA`, `STEM`, `AZHAR` | Curriculum tracks in Egypt. |
| **10**| `GradeLevel` | `GRADE_1` through `GRADE_12` | K-12 academic grade classifications. |
| **11**| `AssessmentType` | `EXAM`, `QUIZ`, `HOMEWORK`, `ASSESSMENT` | Assessment categorization. |
| **12**| `AttemptStatus` | `STARTED`, `IN_PROGRESS`, `SUBMITTED`, `EVALUATED`, `ABANDONED` | Exam student workflow. |
| **13**| `MediaSourceType` | `DIRECT_UPLOAD`, `YOUTUBE`, `EXTERNAL` | Video sourcing origin. |
| **14**| `ProcessedMediaStatus` | `PENDING`, `PROCESSING`, `READY`, `FAILED` | Transcoding lifecycle. |

---

## 4. Database Migration History Audit

The directory `packages/database/prisma/migrations/` contains 5 historical migration directories:

```
packages/database/prisma/migrations/
├── 0_init/
├── 20261001_enable_rls/
├── 20261026_processed_media/
├── 20261102_exam_lifecycle_alignment/
└── 20261102_task_7_1_institution_branch_foundation/
```

### Analysis of Key Migrations:

1. **`0_init`:**  
   Establishes base legacy models: `User`, `Course`, `Lesson`, `Exam`, `Attendance`, `Payment`, etc.  
   - All primary keys use `TEXT` with `gen_random_uuid()::text`.
   - Float fields used for currency and scoring.
   - Cascading foreign keys (`ON DELETE CASCADE`) were prevalent across relations.

2. **`20261001_enable_rls`:**  
   Introduces PostgreSQL Row-Level Security baseline on selected user tables.

3. **`20261102_task_7_1_institution_branch_foundation`:**  
   The critical architectural migration that established institutional multi-tenancy:
   - Created `Institution`, `Branch`, and `PrimaryManagerInvitation` tables.
   - Added `institutionId` and `branchId` foreign keys to `User`, `CenterGroup`, `Course`, `Payment`, `QuestionBank`, `ProcessedMedia`.
   - **Crucial Financial Safety Fix (OD-708 Invariant):** Altered `Payment.userId` to drop `ON DELETE CASCADE` and replace it with `ON DELETE RESTRICT`, preventing cascading deletion of financial payment history when a user is removed.
   - Created `_migration_quarantine` table for unmapped historical data cold archival.
   - Created institutional isolation indexes: `idx_branch_institution`, `idx_user_institution`, `idx_user_inst_branch`, `idx_payment_institution`.

---

## 5. Critical Inspection of the Existing `Payment` Model

The current `Payment` model in `schema.prisma` lines 304–328:

```prisma
model Payment {
  id              String        @id @default(uuid())
  userId          String
  institutionId   String?
  branchId        String?
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
  user            User          @relation(fields: [userId], references: [id], onDelete: Restrict)
  institution     Institution?  @relation(fields: [institutionId], references: [id], onDelete: Restrict)
  branch          Branch?       @relation(fields: [branchId], references: [id], onDelete: SetNull)

  @@index([userId])
  @@index([providerOrderId])
  @@index([createdAt])
  @@index([institutionId])
  @@index([branchId])
}
```

### Architectural & Accounting Gaps of the `Payment` Model:
1. **IEEE 754 Floating-Point Numeric Type (`Float`):**  
   Financial amounts stored as 64-bit IEEE 754 floating-point values suffer from binary rounding errors (e.g., `0.1 + 0.2 = 0.30000000000000004`). Accounting systems require exact precision using PostgreSQL `NUMERIC(12, 2)` mapped to Prisma `Decimal`.
2. **Missing Cashbox & Physical Till Association:**  
   `Payment` contains no link to a physical `Cashbox`, cashier till session, shift count, or teller ID. It was designed exclusively for third-party payment gateway callbacks (`provider`, `providerOrderId`).
3. **Missing Commercial Agreement & Sub-Ledger Allocation:**  
   Physical education centers do not collect ad-hoc lump sums without a contractual context. Collections must link to a `StudentAgreement` and satisfy sequential `PaymentScheduleItem` milestones via `PaymentAllocation` bridge records.
4. **Missing Maker-Checker & Receipt Metadata:**  
   No manual receipt serial number (`receiptNumber`), cash denomination tracking, or cashier signature exists.
5. **Architectural Determination:**  
   The `Payment` model must be retained untouched for legacy compatibility and future online card checkouts (`UP-703`), while a dedicated, mathematically exact sub-ledger collection entity (`CollectionReceipt` / `Collection`) is introduced for physical center financial intake.

---

## 6. Structural Synthesis of Existing Tenancy Infrastructure

The tenancy structures in `schema.prisma` provide the necessary foreign key anchors:
- `Institution.id` is available as the universal root tenant key (`institutionId`).
- `Branch.id` is available as the operational operating center key (`branchId`), differentiating physical campuses (`BR-01` Dokki, `BR-02` Nasr City) from online operations (`isOnline = true`).
- `User.id` is available as the actor key for cashiers, accountants, and approving managers.
- `CenterGroup.id` and `Course.id` are available for fee catalog rates and student group pricing.

All financial entities introduced in Phase 4 Workstream A will cleanly anchor to these verified tenancy models without breaking existing academic functionality.

