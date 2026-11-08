# OX-DIGITAL Education — Phase 7.1
# Legacy Data Migration & Tenant Architecture Specification

**Document ID:** `OD-7104-MIGRATION`  
**Workspace:** `D:\OX-DIGITAL\Mathe\OX-DIGITAL-GITHUB`  
**Repository:** `https://github.com/hosamsamer019/ox-digital-Education.git`  
**Execution Mode:** Architectural Planning & Design Refinement (Stage C Final Correctness Deliverable)  
**Safety Status:** READ-ONLY DESIGN — ZERO DATABASE MUTATIONS AUTHORIZED  

---

## 1. Executive Summary & Design Refinement Mandate

This document provides the authoritative architectural blueprint and data migration plan for **Task 7.1: Institution, Branch & Identity Foundation**, incorporating the final Stage C correctness directives from the Product Owner.

The transition from a single-tenant academic LMS to a multi-institution, multi-branch commercial educational management platform requires backfilling tenant ownership across all existing database records without data loss, downtime, or security breaches.

In accordance with approved Product Owner decisions:
- **OD-701:** Institution Governance & Single Primary Manager (single institution with 1 or more branches; central management over pricing and policies).
- **OD-702:** Strict Financial Separation (OX-DIGITAL SaaS Domain A vs. Institution Domain B).
- **OD-703:** Unified General Ledger with Branch Dimensions.
- **OD-708:** Payment Deletion Protection Invariant (historical payments and transactions must never be silently or destructively deleted).

> [!CAUTION]
> **STRICT SAFETY CONSTRAINT:** This document specifies the *execution architecture and verification protocol* for future data migration. **No migration scripts, database alters, backfill jobs, or seed operations are permitted during Stage C.** All implementation and data modification require separate Product Owner sign-off before proceeding to Stage D.

---

## 2. Non-Operational Placeholders, Identity Governance & Two-State Migration Architecture

### 2.1 Strictly Separated Pre-Approval vs. Post-Approval Migration States
To guarantee that unapproved tenant assignments never execute prematurely, the migration architecture strictly enforces two discrete operational states:

```
+----------------------------------------------------------------------------------------------------+
|                                STATE 1: PRE-APPROVAL (CURRENT IN FORCE)                            |
|                                                                                                    |
| 1. Non-Operational Identifiers: INST-LEGACY-001, BR-MAIN, and BR-ONLINE are illustrative          |
|                                placeholders only. No DB records exist or may be created.           |
| 2. Zero Tenant Invention:       Triggers MUST reject writes that cannot establish valid ownership  |
|                                rather than inventing a fallback assignment.                        |
| 3. Zero Account Promotion:     Existing bootstrap admin (admin@edu.com) is NOT promoted to         |
|                                Institution Primary Manager.                                        |
| 4. Quarantine / Hold:          Records with ambiguous ownership are held unchanged or quarantined. |
+----------------------------------------------------------------------------------------------------+
                                                  |
                  [Product Owner Review & Explicit Sign-Off on Parameters]
                                                  v
+----------------------------------------------------------------------------------------------------+
|                                STATE 2: POST-APPROVAL (STAGE D AUTHORIZED)                         |
|                                                                                                    |
| 1. Parameterized Activation:   Approved institution and branch IDs are activated as explicit       |
|                                parameters: TARGET_INSTITUTION_ID, TARGET_DEFAULT_BRANCH_ID.        |
| 2. Validated Legacy Backfill:  Legacy assignment executed strictly under approved ownership rules. |
| 3. Verified Branch Evidence:   User role ALONE is NOT sufficient evidence of branch ownership;     |
|                                explicit center enrollment or CenterGroup link required.            |
| 4. Verified Primary Manager:   Primary Manager onboarded via verified cryptographic invitation.    |
+----------------------------------------------------------------------------------------------------+
```

#### How the Architecture Supports Both States Without Accidental Pre-Approval Writes:
- A database-level migration control table gates all trigger fallback behavior:
  ```sql
  CREATE TABLE _migration_control (
    is_approved BOOLEAN DEFAULT FALSE,
    target_institution_id UUID NULL,
    target_default_branch_id UUID NULL,
    target_online_branch_id UUID NULL
  );
  ```
- **In State 1 (Pre-Approval):** `is_approved` is `FALSE`. If a database trigger encounters a write where `institutionId` is NULL and cannot derive ownership from a valid parent foreign key, the trigger executes `RAISE EXCEPTION 'UNAPPROVED_TENANT_ASSIGNMENT: Database write lacks explicit tenant context and migration is not approved'`. Fallback assignment is physically impossible.
- **In State 2 (Post-Approval):** Upon explicit Product Owner sign-off, `_migration_control` is populated with approved parameters and `is_approved := TRUE`. Triggers and backfill scripts reference these parameters dynamically without altering underlying SQL logic.

### 2.2 Separation of SaaS Super-Admin vs. Institution Primary Manager
To enforce multi-tenant governance and prevent privilege escalation, the architecture strictly decouples platform administration from educational institution management:

1. **OX-DIGITAL SaaS Platform Super-Admin (Domain A):**
   - Manages cloud infrastructure, database health, global platform configuration, tenant container provisioning, and institutional SaaS licensing contracts.
   - **Crucial Rule:** The existing bootstrap administrator (`admin@edu.com`) must **NOT** automatically become the Institution Primary Manager. A global platform administrator does not inherently belong to any educational institution and possesses no instructional, grading, or internal financial signing authority within an institution's private ledger.
2. **Educational Institution Primary Manager (Domain B):**
   - The single authoritative owner/manager governing an educational institution under **OD-701**.
   - Governs the central product catalog, pricing, physical branches, online dimension, institution staff appointments, cashboxes, and internal financial ledgers.

### 2.3 Identity Verification & Account Provisioning Protocol
When Stage D implementation is authorized, the Primary Manager account for an institution must be established through a verified, multi-step provisioning process:
1. **Identity & Authority Verification:** Verification of organizational legal standing, institutional domain ownership, and authorized signatory credentials.
2. **Cryptographic Provisioning Invitation:** The SaaS platform generates a single-use, time-bound cryptographic onboarding token sent to the verified email address.
3. **Explicit Institution Association:** The Primary Manager completes registration or authenticates, explicitly claiming institutional governance. The institution's `primaryManagerId` is set to this verified user ID (`onDelete: Restrict`).
4. **Primary Manager Reassignment Protocol:** If an institution transitions to a new Primary Manager, the change requires two-party cryptographic authorization (outgoing manager + verified board authorization). Upon reassignment, `tokenVersion` is incremented for both accounts, immediately revoking stale permissions.

---

## 3. Financial Domain Architecture (OD-702)

### 3.1 Strict Domain Separation: Domain A vs. Domain B
Approved Decision **OD-702** mandates absolute financial separation between OX-DIGITAL SaaS commercial finances and every educational institution's internal financial operations.

```
+----------------------------------------------------------------------------------------------------+
|                                    DOMAIN A: OX-DIGITAL SAAS FINANCE                               |
|  - OX-DIGITAL Chart of Accounts & General Ledger                                                   |
|  - SaaS Subscription Plans & Institutional Licensing Contracts                                     |
|  - SaaS Invoices issued to Institutions (Platform fees, seat fees, storage)                       |
|  - SaaS Collections & Accounts Receivable (Institutions as Debtors)                                |
|  - Platform Infrastructure & Operating Expenses                                                    |
+----------------------------------------------------------------------------------------------------+
                                      |                       ^
                 SaaS Billing Invoice |                       | Bank Transfer / Receipt
                                      v                       |
+----------------------------------------------------------------------------------------------------+
|                                DOMAIN B: INSTITUTION INTERNAL FINANCE                              |
|  - Institution Chart of Accounts & General Ledger (Isolated per Institution)                       |
|  - Student Agreements, Course Pricing Catalog & Attendance Billing                                 |
|  - Student Invoices, Receivables & Collections (Students/Parents as Debtors)                       |
|  - Platform Software Expense & Accounts Payable (OX-DIGITAL as Creditor)                           |
|  - Branch Cashboxes, Shift Closings & Teacher Compensation                                         |
+----------------------------------------------------------------------------------------------------+
```

### 3.2 Independent Accounting Records & Prohibition of Shared Ledgers
1. **Zero Co-Mingling:** Domain A and Domain B maintain completely independent accounting records, independent Charts of Accounts, and independent General Ledgers.
2. **No Shared Ledgers:** There is no shared table where SaaS revenue and student tuition meet.
3. **No Automatic Netting or Settlement:** There is strictly **no automatic netting** between student collections and SaaS licensing fees. An institution collecting tuition does not automatically credit OX-DIGITAL's SaaS receivables.
4. **Inter-Domain Contractual Transactions:**
   - When OX-DIGITAL bills an institution for software licensing:
     - **In Domain A (OX-DIGITAL Ledger):** Debit `Accounts Receivable (Institution A)`, Credit `SaaS Licensing Revenue`.
     - **In Domain B (Institution A Ledger):** Debit `Software Licensing Expense`, Credit `Accounts Payable (OX-DIGITAL)`.
   - When the institution settles the invoice via bank transfer or credit payment:
     - **In Domain B (Institution A Ledger):** Debit `Accounts Payable (OX-DIGITAL)`, Credit `Bank/Cash`.
     - **In Domain A (OX-DIGITAL Ledger):** Debit `Bank/Cash`, Credit `Accounts Receivable (Institution A)`.
   - Each legal transaction is recorded independently by the respective party's accounting system with verified external documentation.

### 3.3 Reporting Isolation
- **Preventing Institutional Collections from Becoming SaaS Revenue:**
  - In `analytics.controller.ts`, queries computing platform financial health must query Domain A billing records exclusively.
  - Institutional student tuition (`Payment` table) is classified strictly as **Domain B (Institution Student Collection)** and is filtered exclusively by `req.tenantContext.institutionId`.
  - Platform super-admin dashboards are architecturally prohibited from summing Domain B student payments into platform revenue metrics.

> [!NOTE]
> All model names mentioned in this section (e.g. `SaasInvoice`, `SaasPayment`) are architectural illustrations explaining domain boundaries and do not constitute an approved final financial schema.

---

## 4. Complete 28-Model Migration Mapping & Protection Matrix

The complete mapping matrix for all 28 models in `packages/database/prisma/schema.prisma` is published below.

> [!IMPORTANT]
> **Current Schema vs. Proposed Target Clarification:** In the verified current Prisma schema, **ZERO** tables contain `institutionId` or `branchId`. The references below to "Direct FK (`institutionId`)" and "Direct FK (`branchId`)" represent the **Proposed Stage D Architecture Design Target**, NOT current database columns. In the current database, all records exist without tenant scoping.

### 4.1 Exhaustive 28-Model Multi-Tenant Mapping Matrix

| # | Model Name | Existing PK & Foreign Keys | Institution Ownership Source | Branch Attribution Source | Direct or Inherited | Exact Relationship Chain | Cross-Tenant Validation Rule | Orphan-Record Handling | Backfill Strategy | Historical Data Preservation Requirement |
| :---: | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **1** | `User` | PK: `id`<br/>FK: `centerGroupId` -> `CenterGroup.id`, `parentId` -> `User.id` | Direct FK (`institutionId`) | Direct FK (`branchId` for center students; null for staff) | **Direct** | `User.institutionId -> Institution.id` | `user.institutionId === ctx.institutionId` | If `centerGroupId` invalid, link to default branch | Update `institutionId = TARGET_INSTITUTION_ID`. Link center students to default branch. | Historical account records preserved; evaluate `AccountStatus` deactivation. |
| **2** | `CenterGroup` | PK: `id`<br/>FK: None | Direct FK (`institutionId`) | Direct FK (`branchId`) | **Direct** | `CenterGroup.institutionId -> Institution.id`, `CenterGroup.branchId -> Branch.id` | `group.institutionId === ctx.institutionId` | Assign to default branch if branch unspecified | Map to `TARGET_INSTITUTION_ID` and default branch | Group schedules and student links preserved intact. |
| **3** | `Course` | PK: `id`<br/>FK: `teacherId` -> `User.id` | Direct FK (`institutionId`) | Direct FK (`branchId` if branch-exclusive; null or online branch if online) | **Direct** | `Course.institutionId -> Institution.id` | `course.institutionId === teacher.institutionId === ctx.institutionId` | If teacher belongs to another institution, quarantine | Update `institutionId = TARGET_INSTITUTION_ID`. Set `branchId = TARGET_ONLINE_BRANCH_ID` for online courses. | **All course curricula preserved.** Never cascade delete on teacher removal. |
| **4** | `CourseEnrollment` | PK: `id`<br/>FK: `courseId` -> `Course.id`, `studentId` -> `User.id` | Inherited via `Course` & `User` | Inherited via `Course` / `User` | **Inherited** | `CourseEnrollment -> Course.institutionId`<br/>`CourseEnrollment -> User.institutionId` | **Crucial:** Assert `student.institutionId === course.institutionId === ctx.institutionId` | Quarantine if student and course belong to different institutions | Validated during migration; both sides mapped to target institution | **Historical enrollments must survive.** Essential for student academic transcript. |
| **5** | `Lesson` | PK: `id`<br/>FK: `courseId` -> `Course.id`, `activeMediaId` -> `ProcessedMedia.id` | Inherited via `Course` | Inherited via `Course` | **Inherited** | `Lesson.courseId -> Course.institutionId` | `lesson.course.institutionId === ctx.institutionId` | Delete cascade blocked if enrollments exist | Inherited from parent course | Lesson content and media references preserved intact. |
| **6** | `Exam` | PK: `id`<br/>FK: `courseId` -> `Course.id` | Inherited via `Course` | Inherited via `Course` | **Inherited** | `Exam.courseId -> Course.institutionId` | `exam.course.institutionId === ctx.institutionId` | Exam must have valid parent course | Inherited from parent course | **Exam structures must survive.** Linked to attempts. |
| **7** | `ExamAttempt` | PK: `id`<br/>FK: `examId` -> `Exam.id`, `studentId` -> `User.id` | Inherited via `Exam` & `User` | Inherited via `User` | **Inherited** | `ExamAttempt -> Exam -> Course.institutionId`<br/>`ExamAttempt -> User.institutionId` | **Crucial:** Assert `student.institutionId === exam.course.institutionId === ctx.institutionId` | Quarantine attempt if student and exam belong to different tenants | Validated in pre-migration checksum | **All student scores, grades, and attempts must be permanently preserved.** |
| **8** | `Homework` | PK: `id`<br/>FK: `courseId` -> `Course.id`, `lessonId` -> `Lesson.id` | Inherited via `Course` | Inherited via `Course` | **Inherited** | `Homework.courseId -> Course.institutionId` | `homework.course.institutionId === ctx.institutionId` | Assert `lesson.courseId === homework.courseId` | Inherited from parent course | Homework assignment specifications preserved. |
| **9** | `Submission` | PK: `id`<br/>FK: `homeworkId` -> `Homework.id`, `studentId` -> `User.id` | Inherited via `Homework` & `User` | Inherited via `User` | **Inherited** | `Submission -> Homework -> Course.institutionId`<br/>`Submission -> User.institutionId` | **Crucial:** Assert `student.institutionId === homework.course.institutionId === ctx.institutionId` | Quarantine submission if student tenant != homework tenant | Validated in pre-migration checksum | **All student submissions, answers, and teacher grading remarks must survive.** |
| **10** | `Attendance` | PK: `id`<br/>FK: `studentId` -> `User.id` | Direct FK (`institutionId`) | Direct FK (`branchId`) | **Direct** | `Attendance.institutionId -> Institution.id`, `Attendance.branchId -> Branch.id` | **Crucial:** Assert `student.institutionId === attendance.institutionId === attendance.branch.institutionId` | If student has no branch, assign default branch | Backfilled to `TARGET_INSTITUTION_ID` and default branch | **All physical attendance logs must survive.** Used for session billing verification. |
| **11** | `Payment` | PK: `id`<br/>FK: `userId` -> `User.id`, `courseId` -> `Course.id` | Direct FK (`institutionId`) | Direct FK (`branchId` based on course/user) | **Direct** | `Payment.institutionId -> Institution.id`, `Payment.branchId -> Branch.id` | `payment.institutionId === user.institutionId === ctx.institutionId` | If course is null, attribute to user's branch | Backfilled to `TARGET_INSTITUTION_ID`. Set `branchId` to online branch (if online) or default branch. | **ABSOLUTE INVARIANT (OD-708): Historical financial records must NEVER be deleted.** |
| **12** | `VideoProgress` | PK: `id`<br/>FK: `studentId` -> `User.id`, `lessonId` -> `Lesson.id` | Inherited via `User` & `Lesson` | Inherited via `Lesson` | **Inherited** | `VideoProgress -> Lesson -> Course.institutionId`<br/>`VideoProgress -> User.institutionId` | Assert `student.institutionId === lesson.course.institutionId === ctx.institutionId` | Quarantine mismatched records | Inherited under legacy anchor | Student video viewing duration and completion records preserved. |
| **13** | `Assessment` | PK: `id`<br/>FK: `teacherId` -> `User.id`, `courseId` -> `Course.id`, `lessonId` -> `Lesson.id` | Direct FK (`institutionId`) | Optional FK (`branchId`) | **Direct** | `Assessment.institutionId -> Institution.id` | `assessment.institutionId === teacher.institutionId === ctx.institutionId` | Quarantine if teacher tenant != assessment tenant | Backfilled to `TARGET_INSTITUTION_ID` | Teacher evaluations and assessment rubrics preserved. |
| **14** | `ExternalExamAttempt` | PK: `id`<br/>FK: `assessmentId` -> `Assessment.id` | Inherited via `Assessment` | Inherited via `Assessment` | **Inherited** | `ExternalExamAttempt -> Assessment.institutionId` | `attempt.assessment.institutionId === ctx.institutionId` | Verify parent assessment exists | Inherited under legacy anchor | External testing attempt records preserved. |
| **15** | `AssessmentAttempt` | PK: `id`<br/>FK: `assessmentId` -> `Assessment.id`, `studentId` -> `User.id` | Inherited via `Assessment` & `User` | Inherited via `User` | **Inherited** | `AssessmentAttempt -> Assessment.institutionId`<br/>`AssessmentAttempt -> User.institutionId` | Assert `student.institutionId === assessment.institutionId === ctx.institutionId` | Quarantine mismatched student/assessment pairs | Inherited under legacy anchor | Evaluation scores and competency assessment logs preserved. |
| **16** | `StudentRiskHistory` | PK: `id`<br/>FK: `studentId` -> `User.id` | Inherited via `User` | Inherited via `User` | **Inherited** | `StudentRiskHistory -> User.institutionId` | `history.student.institutionId === ctx.institutionId` | Verify student exists | Inherited under legacy anchor | Academic risk scoring history preserved. |
| **17** | `LessonQuiz` | PK: `id`<br/>FK: `lessonId` -> `Lesson.id` | Inherited via `Lesson` | Inherited via `Lesson` | **Inherited** | `LessonQuiz -> Lesson -> Course.institutionId` | `quiz.lesson.course.institutionId === ctx.institutionId` | Verify parent lesson exists | Inherited under legacy anchor | In-lesson quiz questions preserved. |
| **18** | `ChatSession` | PK: `id`<br/>FK: `userId` -> `User.id` | Direct FK (`institutionId`) | Explicitly N/A (User-scoped conversation) | **Direct** | `ChatSession.institutionId -> Institution.id` | `session.institutionId === user.institutionId === ctx.institutionId` | Verify user exists | Backfilled to `TARGET_INSTITUTION_ID` | AI tutoring chat history preserved. |
| **19** | `ChatMessage` | PK: `id`<br/>FK: `sessionId` -> `ChatSession.id`, `senderId` -> `User.id` | Inherited via `ChatSession` | Explicitly N/A | **Inherited** | `ChatMessage -> ChatSession.institutionId` | `message.session.institutionId === ctx.institutionId` | Verify parent session exists | Inherited under legacy anchor | Chat interaction history preserved. |
| **20** | `Notification` | PK: `id`<br/>FK: `userId` -> `User.id` | Direct FK (`institutionId`) | Explicitly N/A (User alert) | **Direct** | `Notification.institutionId -> Institution.id` | `notification.institutionId === user.institutionId === ctx.institutionId` | Verify user exists | Backfilled to `TARGET_INSTITUTION_ID` | User notification history preserved. |
| **21** | `QuestionBank` | PK: `id`<br/>FK: `creatorId` -> `User.id` | Direct FK (`institutionId`) | Explicitly N/A (Institution-wide question pool) | **Direct** | `QuestionBank.institutionId -> Institution.id` | `question.institutionId === creator.institutionId === ctx.institutionId` | Verify creator exists | Backfilled to `TARGET_INSTITUTION_ID` | Question items and pedagogical tags preserved. |
| **22** | `SavedMathSolution` | PK: `id`<br/>FK: `studentId` -> `User.id` | Direct FK (`institutionId`) | Explicitly N/A (Student notebook) | **Direct** | `SavedMathSolution.institutionId -> Institution.id` | `solution.institutionId === student.institutionId === ctx.institutionId` | Verify student exists | Backfilled to `TARGET_INSTITUTION_ID` | Solved math solutions preserved. |
| **23** | `VideoUpload` | PK: `id`<br/>FK: `userId` -> `User.id` | Direct FK (`institutionId`) | Explicitly N/A (Teacher asset upload) | **Direct** | `VideoUpload.institutionId -> Institution.id` | `upload.institutionId === user.institutionId === ctx.institutionId` | Verify user exists | Backfilled to `TARGET_INSTITUTION_ID` | Video upload metadata and storage tracking preserved. |
| **24** | `UserSession` | PK: `id`<br/>FK: `userId` -> `User.id` | Direct FK (`institutionId`) | Optional FK (`branchId`) | **Direct** | `UserSession.institutionId -> Institution.id` | `session.institutionId === user.institutionId === ctx.institutionId` | Verify user exists | Backfilled to `TARGET_INSTITUTION_ID` | Active authentication sessions preserved. |
| **25** | `DailyPlatformStats` | PK: `id`<br/>Unique: `date`<br/>FK: None | Explicitly N/A (Domain A SaaS Platform Level) | Explicitly N/A | **Platform Level** | None (Domain A SaaS Aggregate) | Platform super-admin access only | Standalone table | Retained unmodified as platform-level historical statistics | Historical platform metrics preserved. |
| **26** | `ExamViolation` | PK: `id`<br/>FK: `attemptId` -> `ExamAttempt.id` | Inherited via `ExamAttempt` | Inherited via `ExamAttempt` | **Inherited** | `ExamViolation -> ExamAttempt -> Exam -> Course.institutionId` | `violation.attempt.student.institutionId === ctx.institutionId` | Verify attempt exists | Inherited under legacy anchor | Exam proctoring logs and violation timestamps preserved. |
| **27** | `TemporaryAsset` | PK: `id`<br/>FK: `assessmentId` -> `Assessment.id` | Inherited via `Assessment` | Inherited via `Assessment` | **Inherited** | `TemporaryAsset -> Assessment.institutionId` | `asset.assessment.institutionId === ctx.institutionId` | Verify assessment exists | Inherited under legacy anchor | Assessment asset metadata preserved. |
| **28** | `ProcessedMedia` | PK: `id`<br/>FK: `lessonId` -> `Lesson.id` (`onDelete: SetNull`) | **ARCHITECTURAL DEFECT:** Inherited via `Lesson` only while `lessonId IS NOT NULL`. Orphaned with zero tenant provenance when `lessonId` is SET NULL on Lesson deletion. | Inherited via `Lesson` (severed if `lessonId` null) | **Inherited (Defective)** | `ProcessedMedia -> Lesson -> Course.institutionId` (Broken when `lessonId IS NULL`) | Cannot validate once `lessonId` is NULL. **Requires direct `institutionId` column.** | **CRITICAL BLOCKER:** If parent `Lesson` is deleted, `lessonId` becomes NULL and row loses all tenant scope. | Backfill `institutionId` directly onto `ProcessedMedia` in Stage D schema migration. | Video rendition keys and HLS master playlist references preserved. |

---

### 4.2 Comprehensive Protection Coverage & Enforcement Classification for All 28 Models

Every persistent model in the schema is classified below into its precise enforcement category:
- **Category 1: Database-Enforced Direct Trigger Models (12 models):** Direct triggers intercept writes and enforce tenant boundaries at the database engine level (`User`, `CenterGroup`, `Course`, `Attendance`, `Payment`, `Assessment`, `ChatSession`, `Notification`, `QuestionBank`, `SavedMathSolution`, `VideoUpload`, `UserSession`).
- **Category 2: Database-Enforced Inherited Foreign Key Cascade Models (8 models):** Pure single-parent hierarchical children protected by foreign key cascades from a tenant-scoped parent (`Lesson`, `Exam`, `Homework`, `LessonQuiz`, `ExternalExamAttempt`, `StudentRiskHistory`, `ExamViolation`, `TemporaryAsset`).
- **Category 2 Exception / Architectural Defect: Orphaned on Parent Deletion (1 model):** `ProcessedMedia` has `onDelete: SetNull` on `lessonId`, leaving orphaned rows with severed tenant provenance.
- **Category 3: Application-Enforced Scoped Join Models (6 models):** Dual-parent entities linking two independent entities, lacking engine-level composite cross-table foreign keys (`CourseEnrollment`, `ExamAttempt`, `Submission`, `VideoProgress`, `AssessmentAttempt`, `ChatMessage`).
- **Category 4: Platform-Level Standalone Model (1 model):** Platform-wide Domain A metrics table (`DailyPlatformStats`).

$$\text{Total Models} = 12 + 8 + 1 + 6 + 1 = 28\text{ models (100\% accounted for)}$$

| # | Model Name | Category & Primary Enforcement Mechanism | Authoritative Institution Source | Authoritative Branch Source | Database-Level Protection Description | Application-Level Validation Description | Deletion / Orphan Scenario Handling |
| :---: | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **1** | `User` | **Category 1: DB Direct Trigger** | Direct column | Direct (`CENTER_STUDENT`) | `trg_tenant_user` validates/assigns tenant. `onUpdate: Restrict` prevents cross-tenant reassignment. | Middleware asserts `user.institutionId === ctx.institutionId`. | User deletion restricted if payments/courses exist (`onDelete: Restrict`). |
| **2** | `CenterGroup` | **Category 1: DB Direct Trigger** | Direct column | Direct column | `trg_tenant_centergroup` validates branch and institution FKs. | Center controller scopes queries by `ctx.institutionId`. | Deletion restricted if active students linked. |
| **3** | `Course` | **Category 1: DB Direct Trigger** | Direct column | Optional direct | `trg_tenant_course` recomputes and asserts `teacher.institutionId === Course.institutionId`. | Route guards assert caller owns course's institution. | Deletion restricted if enrollments or submissions exist. |
| **4** | `Attendance` | **Category 1: DB Direct Trigger** | Direct column | Direct column | `trg_tenant_attendance` derives and asserts `student.institutionId === Attendance.institutionId === branch.institutionId`. | Attendance service scopes all operations to `ctx.branchId`. | Physical attendance logs permanently preserved; deletion restricted. |
| **5** | `Payment` | **Category 1: DB Direct Trigger** | Direct column | Direct column | `trg_tenant_payment` derives and asserts tenant. `Payment.user` has `onDelete: Restrict`. | Payment service verifies tenant context. Domain B isolation enforced. | **ABSOLUTE INVARIANT (OD-708):** Deletion forbidden at DB engine level. |
| **6** | `Assessment` | **Category 1: DB Direct Trigger** | Direct column | Optional direct | `trg_tenant_assessment` derives and asserts `teacher.institutionId === Assessment.institutionId`. | Assessment routes scope by `ctx.institutionId`. | Assessment deletion restricted if attempts exist. |
| **7** | `ChatSession` | **Category 1: DB Direct Trigger** | Direct column | N/A (User chat) | `trg_tenant_chatsession` derives `institutionId` from `User.id`. | Chat gateway scopes session lookups to `ctx.institutionId`. | Session preserved under user account. |
| **8** | `Notification` | **Category 1: DB Direct Trigger** | Direct column | N/A (User alert) | `trg_tenant_notification` derives `institutionId` from `User.id`. | Notification service publishes only to scoped user rooms. | Notification logs preserved. |
| **9** | `QuestionBank` | **Category 1: DB Direct Trigger** | Direct column | N/A (Question pool)| `trg_tenant_questionbank` derives `institutionId` from creator. | Question bank controller filters queries by `ctx.institutionId`. | Questions preserved; reassignable on teacher transfer. |
| **10** | `SavedMathSolution` | **Category 1: DB Direct Trigger** | Direct column | N/A (Notebook) | `trg_tenant_savedmathsolution` derives `institutionId` from student. | Student notebook controller filters by `ctx.institutionId`. | Preserved under student account. |
| **11** | `VideoUpload` | **Category 1: DB Direct Trigger** | Direct column | N/A (Media upload) | `trg_tenant_videoupload` derives `institutionId` from user. | Storage controller validates upload path matches tenant prefix. | Media references preserved. |
| **12** | `UserSession` | **Category 1: DB Direct Trigger** | Direct column | Optional direct | `trg_tenant_usersession` derives `institutionId` from user. | Auth service validates session belongs to user's tenant. | Revoked on logout or deactivation. |
| **13** | `Lesson` | **Category 2: DB Inherited FK** | `Course.institutionId` | Inherited | Bound strictly to `Course` via `courseId`. Cascades from Course. | Controllers join `Course` with `where: { institutionId: ctx.institutionId }`. | Lesson deleted with course; un-scoped access impossible without valid course. |
| **14** | `Exam` | **Category 2: DB Inherited FK** | `Course.institutionId` | Inherited | Bound strictly to `Course` via `courseId`. Inherits tenant scope. | Exam controller verifies `course.institutionId === ctx.institutionId`. | Exam protected against deletion if attempts exist. |
| **15** | `Homework` | **Category 2: DB Inherited FK** | `Course.institutionId` | Inherited | Bound strictly to `Course` via `courseId`. | Homework controller scopes queries through parent course. | Cascades from course; protected if submissions exist. |
| **16** | `LessonQuiz` | **Category 2: DB Inherited FK** | `Lesson.Course` | Inherited | Bound strictly to `Lesson` via `lessonId`. | Quiz controller verifies lesson parent course tenant. | Cascades from lesson. |
| **17** | `ExternalExamAttempt`| **Category 2: DB Inherited FK** | `Assessment` | Inherited | Bound strictly to `Assessment` via `assessmentId`. | External exam controller verifies assessment tenant. | Attempt records preserved intact. |
| **18** | `StudentRiskHistory` | **Category 2: DB Inherited FK** | `User` (Student) | Inherited | Bound strictly to `User` via `studentId`. | Risk engine worker scopes execution by student's institution. | Risk logs preserved. |
| **19** | `ExamViolation` | **Category 2: DB Inherited FK** | `ExamAttempt` | Inherited | Bound strictly to `ExamAttempt` via `attemptId`. | Proctoring service scopes violations through parent attempt. | Proctoring logs preserved. |
| **20** | `TemporaryAsset` | **Category 2: DB Inherited FK** | `Assessment` | Inherited | Bound strictly to `Assessment` via `assessmentId`. | Media service verifies asset parent assessment tenant. | Expires/cleaned up via background worker. |
| **21** | `ProcessedMedia` | **Category 2 Exception: Defective FK** | `Lesson.Course` (when not null) | Inherited | **ARCHITECTURAL DEFECT:** Bound to `Lesson` via `lessonId` with `onDelete: SetNull`. Parent deletion sets `lessonId := NULL`, leaving row orphaned with NO tenant ID. | Streaming service joins `Lesson -> Course` before serving. Fails if `lessonId` is null. | **UNVERIFIED / ARCHITECTURAL BLOCKER:** Orphaned row retains video rendition assets without tenant scope. |
| **22** | `CourseEnrollment` | **Category 3: App-Enforced Scoped Join** | `Course` & `Student` | Inherited | Inherits via FKs. **DB Limitation:** Lacks cross-table composite FK. | Enrollment service verifies `student.institutionId === course.institutionId`. | Cascades on course/student deletion; enrollment audit log survives. |
| **23** | `ExamAttempt` | **Category 3: App-Enforced Scoped Join** | `Exam` & `Student` | Inherited | Inherits via FKs. **DB Limitation:** Lacks cross-table composite FK. | Exam attempt controller asserts `student.institutionId === exam.course.institutionId`. | **Permanent historical preservation.** Deletion forbidden. |
| **24** | `Submission` | **Category 3: App-Enforced Scoped Join** | `Homework` & `Student` | Inherited | Inherits via FKs. **DB Limitation:** Lacks cross-table composite FK. | Submission controller verifies dual-ended institution match. | **Permanent historical preservation.** Student work must survive. |
| **25** | `VideoProgress` | **Category 3: App-Enforced Scoped Join** | `Student` & `Lesson` | Inherited | Inherits via FKs. **DB Limitation:** Lacks cross-table composite FK. | Video controller asserts student matches session tenant. | Progress preserved under student account. |
| **26** | `AssessmentAttempt` | **Category 3: App-Enforced Scoped Join** | `Assessment` & `Student`| Inherited | Inherits via FKs. **DB Limitation:** Lacks cross-table composite FK. | Assessment service verifies student and assessment share tenant. | Evaluation scores preserved permanently. |
| **27** | `ChatMessage` | **Category 3: App-Enforced Scoped Join** | `ChatSession` & `User` | N/A | Inherits via FKs (`sessionId` + `senderId`). **DB Limitation:** No composite FK. | Chat controller asserts sender belongs to session's institution. | Cascades from chat session. |
| **28** | `DailyPlatformStats` | **Category 4: Platform Standalone** | Domain A Platform | Explicitly N/A | Standalone aggregation table. Zero tenant foreign keys. | Super-admin dashboard only. Domain B prohibited from querying. | Platform metrics preserved. |

> [!WARNING]
> **Transparent Integrity Limitation:** For the 6 models classified as *Application-Enforced Scoped Join* (models 22–27: `CourseEnrollment`, `ExamAttempt`, `Submission`, `VideoProgress`, `AssessmentAttempt`, `ChatMessage`), PostgreSQL lacks native cross-table composite foreign keys to guarantee at the database engine level that both parents share the same `institutionId`. Referential integrity to each parent is enforced by the database, but cross-tenant alignment is asserted by application route guards and verified by pre-migration SQL sweeps.

---

### 4.2.1 Deep-Dive Architectural Audit: ProcessedMedia Bidirectional Lifecycle & Tenant Ownership Design (Gate 1)

A critical architectural challenge exists in the current schema representation of `ProcessedMedia`. There are **two opposing foreign key relationships** connecting `ProcessedMedia` and `Lesson` in `packages/database/prisma/schema.prisma` (`Lesson` lines 98–120; `ProcessedMedia` lines 636–670):

```prisma
// packages/database/prisma/schema.prisma (Lines 98-120)
model Lesson {
  id              String          @id @default(uuid())
  title           String
  videoUrl        String?
  mediaGeneration Int             @default(0)
  activeMediaId   String?         @unique
  createdAt       DateTime        @default(now())
  publishedAt     DateTime?
  courseId        String
  updatedAt       DateTime        @updatedAt
  pdfUrl          String?
  Homework        Homework[]
  course          Course          @relation(fields: [courseId], references: [id], onDelete: Cascade)
  quizzes         LessonQuiz[]
  progress        VideoProgress[]
  assessments     Assessment[]

  activeMedia     ProcessedMedia?  @relation("ActiveLessonMedia", fields: [activeMediaId], references: [id], onDelete: SetNull)
  processedMedia  ProcessedMedia[] @relation("LessonProcessedMedia")

  @@index([courseId])
}

// packages/database/prisma/schema.prisma (Lines 636-670)
model ProcessedMedia {
  id                 String               @id @default(uuid())
  lessonId           String?
  mediaGeneration    Int
  sourceType         MediaSourceType
  sourceFileId       String?
  canonicalSource    String
  sourceUrlHash      String               @db.Char(64)
  storagePrefix      String
  masterPlaylistKey  String?
  renditions         Json?
  durationSeconds    Int?
  status             ProcessedMediaStatus @default(PENDING)
  fencingToken       BigInt               @default(0)
  workerId           String?
  heartbeatAt        DateTime?
  retryCount         Int                  @default(0)
  errorMessage       String?
  cleanupToken       BigInt               @default(0)
  cleanupWorkerId    String?
  cleanupHeartbeatAt DateTime?
  supersededAt       DateTime?
  completedAt        DateTime?
  createdAt          DateTime             @default(now())
  updatedAt          DateTime             @updatedAt

  lesson          Lesson? @relation("LessonProcessedMedia", fields: [lessonId], references: [id], onDelete: SetNull)
  activeForLesson Lesson? @relation("ActiveLessonMedia")

  @@unique([lessonId, mediaGeneration])
  @@index([sourceUrlHash])
  @@index([status, heartbeatAt])
  @@index([status, supersededAt])
  @@index([status, cleanupHeartbeatAt])
}
```

#### 1. Evidence-Based Inspection of Current Schema Facts:
1. **`Lesson.deletedAt` Non-Existence:**
   - Inspection of `packages/database/prisma/schema.prisma` lines 98–120 verifies that `Lesson` **DOES NOT POSSESS A `deletedAt` FIELD**.
   - The only temporal and visibility fields on `Lesson` are `createdAt`, `updatedAt`, and `publishedAt DateTime?`.
   - Proposing `UPDATE "Lesson" SET "deletedAt" = NOW()` is **NOT implementable on the existing schema**.
2. **Current Foreign-Key Directions & Referential Actions:**
   - **Direction A (`ProcessedMedia.lessonId -> Lesson.id`, `onDelete: SetNull`):** Container relationship (1 Lesson owns N historical/active media renditions). Nullable foreign key (`lessonId String?`).
   - **Direction B (`Lesson.activeMediaId -> ProcessedMedia.id`, `onDelete: SetNull`):** Active playback pointer (1 Lesson points to exactly 1 active media rendition). Unique nullable foreign key (`activeMediaId String? @unique`).
3. **Current Enum Constraints (`ProcessedMediaStatus`):**
   - Inspection of `packages/database/prisma/schema.prisma` lines 626–634 establishes the exact enum values:
     `PENDING`, `DOWNLOADING`, `TRANSCODING`, `COMPLETED`, `FAILED`, `SUPERSEDED`, `PURGING`.
   - **`READY` and `ARCHIVED` DO NOT EXIST in the enum.**
   - Setting `status = 'ARCHIVED'` or `status = 'READY'` is strictly invalid under the current database constraints.
   - The current schema natively supports `SUPERSEDED` (with `supersededAt DateTime?`), which is the verified state for retired renditions.

#### 2. Lifecycle Guarantees, Deletion Realities & Circular Deadlock Analysis:
- **Application-Level Route Protection vs. Database-Level Referential Integrity:**
  - Application-level route guards (e.g. Express controller middleware, route permissions) only intercept incoming HTTP requests from frontends. They provide **zero database-level protection** against background jobs, scheduled tasks, Prisma CLI commands, seed scripts, or direct SQL terminal sessions (`psql`).
  - In the database itself, `Lesson.courseId -> Course.id` specifies `onDelete: Cascade`. Deleting a teacher or course cascades destructively to delete all lessons.
- **Physical Lesson Deletion Remains Fully Possible Today:**
  - Under the current schema, physical deletion of a `Lesson` can occur at any time via `DELETE FROM "Lesson" WHERE id = ...;`, `db.lesson.delete(...)`, or cascade from `Course`.
  - When a `Lesson` is physically deleted, PostgreSQL executes `onDelete: SetNull` on `ProcessedMedia.lessonId`. The media row survives in the database, but its container reference is destroyed, instantly creating an untracked storage orphan with `lessonId = NULL`.
- **Handling of `activeMediaId` During Restoration:**
  - If a `Lesson` was physically deleted, its row and the `activeMediaId` pointer are destroyed. If a user subsequently attempts to "restore" the lesson by creating a new lesson record, the new record is assigned a new UUID. The surviving orphaned `ProcessedMedia` rows **cannot automatically re-attach**, and `Lesson.activeMediaId` cannot be automatically recovered without manual forensic analysis of storage logs.
  - If media was merely superseded (active pointer switched from media $A$ to media $B$), restoration is trivial and safe: the container relation `ProcessedMedia.lessonId` was never severed, so rolling back merely requires updating `Lesson.activeMediaId := $mediaA.id`.
- **`publishedAt = NULL` Is NOT Equivalent to Soft Deletion:**
  - `Lesson.publishedAt` (`schema.prisma` line 105) is strictly a curriculum visibility timestamp indicating when course content becomes accessible to enrolled students.
  - Setting `publishedAt = NULL` merely unpublishes the lesson back to draft status. The lesson remains fully active, editable, and visible in teacher and administrator course management screens. It is **not** a deletion or archival flag. True soft-deletion requires an explicit `deletedAt DateTime?` field.
- **`SUPERSEDED` Is NOT an Immutable or Archival State:**
  - `status = 'SUPERSEDED'` is merely an enum label in `ProcessedMediaStatus`.
  - In the existing codebase, there are **no database-level triggers, check constraints, or application guards** preventing a `SUPERSEDED` record from being modified, overwritten, or physically purged. It is not an immutable state until Stage D introduces state machine constraints.
- **The Circular Deletion Deadlock Trap (Naive Dual-`Restrict`):**
  - If Stage D naively alters both `ProcessedMedia.lessonId` and `Lesson.activeMediaId` to `onDelete: Restrict`:
    - Deleting a `Lesson` fails because dependent `ProcessedMedia` rows exist (`Restrict`).
    - Attempting to delete `ProcessedMedia` first fails because `Lesson.activeMediaId` points to it (`Restrict`).
    - Neither record can be deleted, creating a permanent circular foreign-key deletion deadlock.
- **Cycle-Breaking Operational Protocol:**
  - To safely delete or replace media under referential integrity constraints, the application must break the active pointer first:
    1. Nullify active pointer: `UPDATE "Lesson" SET "activeMediaId" = NULL WHERE "id" = :lessonId;`.
    2. Mark child renditions superseded: `UPDATE "ProcessedMedia" SET "status" = 'SUPERSEDED', "supersededAt" = NOW() WHERE "lessonId" = :lessonId;`.
    3. Remove or unpublish lesson: Under current schema, set `publishedAt = NULL`. In Stage D, soft-deactivate via `AccountStatus`/`deletedAt` column addition.
- **Mandatory Future Stage D Schema & Migration Controls:**
  - To prevent accidental deletion and orphan creation in Stage D:
    1. Add `deletedAt DateTime?` to `Lesson` and root entities for true soft deletion.
    2. Add direct `institutionId` to `ProcessedMedia` so that media records remain tenant-scoped even if unlinked from a lesson.
    3. In database migration, alter `ProcessedMedia.lessonId -> Lesson.id` to `onDelete: Restrict` (paired with cycle-breaking application logic: `activeMediaId = NULL` first).
    4. Alter `Course -> Lesson` to `onDelete: Restrict` if lessons exist.
    5. Install PostgreSQL `BEFORE DELETE` triggers or revoke physical `DELETE` privileges for application roles on business entities.

#### 3. Media Replacement Safety Analysis:
- When a teacher uploads an updated video for an existing lesson:
  1. Video worker transcodes new media and creates `ProcessedMedia` with `lessonId = :lessonId`, `status = 'COMPLETED'`, `mediaGeneration = nextGen`.
  2. In an atomic transaction:
     - Set prior active media: `UPDATE "ProcessedMedia" SET "status" = 'SUPERSEDED', "supersededAt" = NOW() WHERE "id" = :oldMediaId;`.
     - Update active pointer: `UPDATE "Lesson" SET "activeMediaId" = :newMediaId WHERE "id" = :lessonId;`.
  3. **Data Preservation Guarantee:** The container foreign key `ProcessedMedia.lessonId` remains untouched pointing to `Lesson.id`. Older superseded renditions remain linked to the lesson in the database, preserving all historical playback audit trails and student risk engine telemetry.

#### 4. Historical Orphaned Media (`lessonId = NULL`) & Strict Anti-Synthesization Policy:
- In the legacy database, `ProcessedMedia` rows may exist with `lessonId IS NULL` (caused by unlinked transcodings, failed ingestion pipelines, or historical lesson deletions).
- **Forensic Verification of Field Semantics:**
  - `sourceFileId` in `ProcessedMedia` (`schema.prisma` line 641) stores the external Google Drive file ID (when `sourceType = 'GOOGLE_DRIVE'`), as proven by `services/course-service/src/services/driveIngestion.service.ts` (lines 293–308) and `services/video-worker/src/index.ts` (lines 951–1061).
  - `sourceFileId` **DOES NOT REFERENCE `VideoUpload.id`**. There is zero foreign key, zero unique constraint, and zero relational lineage between `ProcessedMedia` and `VideoUpload` (`schema.prisma` lines 468–483).
  - `canonicalSource` is a raw source URL string (e.g. Google Drive sharing link) and does not contain a verified tenant identifier.
- **Authoritative Orphan Governance (OD-720 Compliance):**
  - For records where `lessonId IS NOT NULL`: Proven derivation path `ProcessedMedia.lessonId -> Lesson.id -> Lesson.courseId -> Course.id -> Course.institutionId`.
  - For records where `lessonId IS NULL`: **Tenant ownership cannot be proven.**
  - **PROHIBITION:** Under no circumstance may an orphaned media record be synthetically assigned to a default institution or guessed user.
  - **MANDATORY QUARANTINE:** All historical `ProcessedMedia` rows with `lessonId IS NULL` must retain `institutionId = NULL` and be routed to `MigrationQuarantine` (`quarantineReason = 'ORPHAN_MEDIA_NULL_LESSON'`) under **OD-720 (Indefinite Cold Archival)**.
  - **ZERO STORAGE DESTRUCTION:** All S3/MinIO media files (`storagePrefix`, `masterPlaylistKey`, HLS segments) must be preserved in cold archival. Zero deletion of storage blobs or database records is permitted.

#### 5. Complete Lifecycle State Matrix:

| Lifecycle Phase | Current Schema Mechanism | Proposed Stage D Target | Referential Action & Impact | Historical Data & Audit Preservation |
| :--- | :--- | :--- | :--- | :--- |
| **Media Ingestion** | Worker inserts `status = 'PENDING'` $\to$ `'DOWNLOADING'` $\to$ `'TRANSCODING'` $\to$ `'COMPLETED'`. | Worker populates `institutionId` derived from `Lesson.course.institutionId`. | `ProcessedMedia.lessonId -> Lesson.id` links child to container. | Generation number increments (`mediaGeneration`); original source preserved. |
| **Active Replacement** | Atomic transaction: `Lesson.activeMediaId := newId`; old media `status := 'SUPERSEDED'`, `supersededAt := NOW()`. | Atomic transaction: update pointer; old media retains `institutionId` and `lessonId`. | Direction B pointer moves. Container relation (Direction A) remains intact. | Historical media rows remain in DB. Playback history and risk telemetry preserved. |
| **Lesson Deactivation / Archival** | Current schema lacks `deletedAt`. Unpublish via `Lesson.publishedAt := NULL`. | Add `Lesson.deletedAt DateTime?`. Mark lesson deleted; child media retained as `SUPERSEDED`. | Cycle broken: application clears `Lesson.activeMediaId := NULL` prior to archiving. | All media rows retained in DB under tenant scope. Zero data destruction. |
| **Lesson Restoration** | If `publishedAt` was cleared, restore via `Lesson.publishedAt := NOW()`. Active media re-pointed if needed. | Clear `Lesson.deletedAt := NULL`. Active media remains bound if not unlinked. | No referential change needed if container links were preserved. | Full historical link restored immediately. |
| **Physical Deletion (Emergency DBA Only)** | `Lesson` delete triggers `SetNull` on `ProcessedMedia.lessonId`. Child survives un-scoped. | Enforce `onDelete: Restrict` on container. Application must clear active pointer first. | Circular deadlock prevented by two-step cycle break (`activeMediaId = NULL` first). | Physical deletion blocked by application guards in production. |
| **Historical Orphan Handling (`lessonId = NULL`)** | Row exists unlinked with cloud storage keys (`storagePrefix`). | Retain `institutionId = NULL`. Log in `MigrationQuarantine` under OD-720 Indefinite Cold Archival. | No valid parent relation exists. Zero synthetic assignment. | Database row and S3/MinIO storage blobs preserved indefinitely in cold archival. |

*(Status: ARCHITECTURAL DESIGN RECONCILED WITH REPOSITORY EVIDENCE — Pre-Implementation Gate 1 Passed).*

---

### 4.3 Complete Prisma Referential-Integrity Evidence Matrix (All 27 Deletable Models Reconciled)

The existing schema contains **28 models**. Exactly **27 models** can experience deletes, while **1 model** (`DailyPlatformStats`) is an append-only SaaS platform aggregate table that contains zero tenant data and zero deletes.

> [!IMPORTANT]
> **Verified Current Schema vs. Proposed Designs:**
> - **Current Schema Facts:** In the current `schema.prisma`, **ZERO** models possess `institutionId` or `branchId`. Furthermore, **ZERO** database triggers exist in the current database.
> - **Proposed Stage D Designs:** All tenant columns (`institutionId`, `branchId`) are strictly **PROPOSED STAGE D FIELDS**. All triggers (`trg_tenant_*`, `_migration_tombstones` triggers) are strictly **PROPOSED STAGE D DESIGNS**.
> - **OD-708 Status:** The Payment Deletion Protection Invariant is an approved architectural requirement, but is **NOT yet implemented in the database**. The current schema still defines `Payment.userId -> User.id` with `onDelete: Cascade`.

| # | Model Name & PK | Verified Current Schema FK Relations & Actions | Current Behavior When Parent Is Deleted | Historical Data Preservation Risk (Current Schema) | Proposed Stage D Remediation | Blocker / Invariant Classification | Proposed Stage D DELETE Trigger & Provenance |
| :---: | :--- | :--- | :--- | :--- | :--- | :---: | :--- |
| **1** | `User`<br/>PK: `id` (UUID) | Root model.<br/>`centerGroupId -> CenterGroup.id` (NO ACTION / RESTRICT default)<br/>`parentId -> User.id` (NO ACTION / RESTRICT default) | N/A (Root entity). Parent deletion restricted if child user rows exist. | User account deletion is currently unconstrained by financial checks, cascading into payments and academic records. | Add `institutionId` and `branchId` (PROPOSED STAGE D FIELDS). Enforce application-level deactivation (`AccountStatus = 'DEACTIVATED'`) rather than physical deletion. | **ARCHITECTURAL GATE** (Root Identity) | Proposed Stage D trigger logs `OLD.institutionId`, `OLD.branchId`, `OLD.role`. |
| **2** | `CenterGroup`<br/>PK: `id` (UUID) | Root model.<br/>No outgoing foreign keys in current schema. | N/A (Root entity). | Deletion of group leaves student `centerGroupId` unconstrained unless validated by app. | Add `institutionId` and `branchId` (PROPOSED STAGE D FIELDS). Enforce RESTRICT on deletion if active students linked. | Safe with validation | Proposed Stage D trigger logs `OLD.institutionId`, `OLD.branchId`. |
| **3** | `Course`<br/>PK: `id` (UUID) | `teacherId -> User.id`<br/>`onDelete: Cascade` (current schema) | Deleting a teacher cascades delete to all their Course records. | **CRITICAL SCHEMA RISK:** Deleting a teacher automatically wipes out all courses, lessons, exams, and student enrollments! | Alter FK to `onDelete: Restrict` in Stage D migration. Reassign courses upon teacher departure. Add `institutionId` (PROPOSED STAGE D FIELD). | **HARD BLOCKER** (Curriculum Loss) | Proposed Stage D trigger logs `OLD.institutionId`, `OLD.teacherId`. |
| **4** | `CourseEnrollment`<br/>PK: `id` (UUID) | `courseId -> Course.id` (CASCADE)<br/>`studentId -> User.id` (CASCADE) | Deletion of Course or Student cascades delete to enrollment row. | Historical enrollment records erased when student or course deleted, corrupting student transcripts. | Soft-delete enrollment audit logs; restrict student/course physical deletion. | Preservation risk | Proposed Stage D trigger captures `OLD.courseId`, `OLD.studentId`; resolves tenant via parent. |
| **5** | `Lesson`<br/>PK: `id` (UUID) | `courseId -> Course.id` (CASCADE)<br/>`activeMediaId -> ProcessedMedia.id` (SET NULL) | Deletion of Course cascades delete to Lesson. Sets `activeMediaId` NULL on ProcessedMedia deletion. | Course deletion destroys lessons. Deletion of Lesson orphans `ProcessedMedia` without tenant scope. | Add `institutionId` (PROPOSED STAGE D FIELD). Alter Course delete to RESTRICT if lessons exist. | Linked to Blocker | Proposed Stage D trigger resolves `institutionId` from parent `Course`. |
| **6** | `Exam`<br/>PK: `id` (UUID) | `courseId -> Course.id` (CASCADE) | Deletion of Course cascades delete to Exam. | Course deletion wipes out exams and cascades to all student attempts. | Alter FK to `onDelete: Restrict` if attempts exist. Add `institutionId` (PROPOSED STAGE D FIELD). | Preservation risk | Proposed Stage D trigger resolves `institutionId` from parent `Course`. |
| **7** | `ExamAttempt`<br/>PK: `id` (UUID) | `examId -> Exam.id` (CASCADE)<br/>`studentId -> User.id` (CASCADE) | **Cascades from multiple parents:**<br/>1. Student deleted -> Attempt deleted.<br/>2. Exam deleted -> Attempt deleted.<br/>3. Course deleted -> Exam -> Attempt deleted.<br/>4. Teacher deleted -> Course -> Exam -> Attempt deleted. | **CRITICAL SCHEMA RISK:** Four separate parent deletion paths silently destroy permanent student grades, exam scores, and academic transcripts! | Prohibit physical deletion of attempts. Restrict parent deletions across all 4 levels. | **HARD BLOCKER** (Transcript Preservation) | Proposed Stage D trigger logs `OLD.examId`, `OLD.studentId`. |
| **8** | `Homework`<br/>PK: `id` (UUID) | `courseId -> Course.id` (CASCADE)<br/>`lessonId -> Lesson.id` (CASCADE) | Deletion of Course or Lesson cascades delete to Homework. | Homework specifications wiped out; cascades to delete student submissions. | Restrict deletion if submissions exist. Add `institutionId` (PROPOSED STAGE D FIELD). | Preservation risk | Proposed Stage D trigger resolves `institutionId` from parent `Course`. |
| **9** | `Submission`<br/>PK: `id` (UUID) | `homeworkId -> Homework.id` (CASCADE)<br/>`studentId -> User.id` (CASCADE) | **Cascades from multiple parents:**<br/>1. Student deleted -> Submission deleted.<br/>2. Homework deleted -> Submission deleted.<br/>3. Lesson deleted -> Homework -> Submission deleted.<br/>4. Course deleted -> Homework -> Submission deleted.<br/>5. Teacher deleted -> Course -> Homework -> Submission deleted. | **CRITICAL SCHEMA RISK:** Five separate parent deletion paths silently destroy student homework answers, teacher remarks, and grading history! | Prohibit physical deletion of student submissions. Restrict parent deletions. | **HARD BLOCKER** (Student Work Preservation) | Proposed Stage D trigger logs `OLD.homeworkId`, `OLD.studentId`. |
| **10** | `Attendance`<br/>PK: `id` (UUID) | `studentId -> User.id` (CASCADE in current schema) | Deletion of Student cascades delete to Attendance. | Physical center attendance records permanently lost on student deletion, compromising billing audits. | Alter FK to `onDelete: Restrict`. Add `institutionId` and `branchId` (PROPOSED STAGE D FIELDS). | Preservation risk | Proposed Stage D trigger logs `OLD.institutionId`, `OLD.branchId`. |
| **11** | `Payment`<br/>PK: `id` (UUID) | `userId -> User.id`<br/>`onDelete: Cascade` (current schema) | Deleting a User silently cascade-deletes all associated Payment records. | **CRITICAL INVARIANT VIOLATION (OD-708):** Historical financial ledger destroyed if user is deleted! Current database schema offers ZERO payment deletion protection. | Alter FK to `onDelete: Restrict` in Stage D migration. Install PostgreSQL `BEFORE DELETE` trigger raising exception to abort. Add `institutionId` (PROPOSED STAGE D FIELD). | **HARD INVARIANT BLOCKER (OD-708)** | Proposed Stage D trigger raises exception to abort transaction; tombstones count MUST equal 0. |
| **12** | `VideoProgress`<br/>PK: `id` (UUID) | `lessonId -> Lesson.id` (CASCADE)<br/>`studentId -> User.id` (CASCADE)<br/>Constraint: `@@unique([studentId, lessonId])` | Deletion of Lesson or Student cascades delete to VideoProgress. | Student viewing history, watch sessions, and risk metrics wiped out. Cascades to `StudentRiskHistory`. | Restrict parent deletions. Retain progress for course completion verification. | Preservation risk | Proposed Stage D trigger logs `OLD.lessonId`, `OLD.studentId`. |
| **13** | `Assessment`<br/>PK: `id` (UUID) | `courseId -> Course.id` (CASCADE)<br/>`lessonId -> Lesson.id` (CASCADE)<br/>`teacherId -> User.id` (RESTRICT default) | Deletion of Course or Lesson cascades delete to Assessment. Teacher deletion blocked. | Course deletion destroys teacher assessment rubrics and competency definitions. | Restrict deletion if attempts exist. Add `institutionId` (PROPOSED STAGE D FIELD). | Preservation risk | Proposed Stage D trigger logs `OLD.institutionId`. |
| **14** | `ExternalExamAttempt`<br/>PK: `id` (UUID) | `assessmentId -> Assessment.id` (CASCADE) | Deletion of Assessment cascades delete to ExternalExamAttempt. | External exam scores wiped out if parent assessment is deleted. | Restrict assessment deletion. Add `institutionId` (PROPOSED STAGE D FIELD). | Preservation risk | Proposed Stage D trigger resolves `institutionId` from Assessment. |
| **15** | `AssessmentAttempt`<br/>PK: `id` (UUID) | `assessmentId -> Assessment.id` (CASCADE)<br/>`studentId -> User.id` (CASCADE) | Deletion of Assessment or Student cascades delete to Attempt. | Competency scores and rubric evaluation remarks wiped out. | Prohibit physical deletion. Add `institutionId` (PROPOSED STAGE D FIELD). | Preservation risk | Proposed Stage D trigger logs `OLD.assessmentId`, `OLD.studentId`. |
| **16** | `StudentRiskHistory`<br/>PK: `id` (UUID) | `videoProgress VideoProgress @relation(fields: [studentId, lessonId], references: [studentId, lessonId], onDelete: Cascade)` | Deletion of parent `VideoProgress` cascades delete to `StudentRiskHistory`. (Triggered by Lesson or User deletion). | **Compound Key Finding:** Has **NO direct FK to User or Lesson**. Deletion of VideoProgress cascades delete to risk log history. | Retain historical risk evaluations. Add direct tenant context or maintain parent link. | Architecture check | Proposed Stage D trigger logs `OLD.studentId`, `OLD.lessonId`. |
| **17** | `LessonQuiz`<br/>PK: `id` (UUID) | `lessonId -> Lesson.id` (CASCADE) | Deletion of Lesson cascades delete to Quiz questions. | In-video quiz questions erased when lesson deleted. | Soft-delete lesson content. | Preservation risk | Proposed Stage D trigger resolves `institutionId` from Lesson. |
| **18** | `ChatSession`<br/>PK: `id` (UUID) | `userId -> User.id` (CASCADE) | Deletion of User cascades delete to ChatSession. | AI tutoring conversations erased on user deletion. | Add `institutionId` (PROPOSED STAGE D FIELD). Restrict user deletion. | Minor / User log | Proposed Stage D trigger logs `OLD.institutionId`, `OLD.userId`. |
| **19** | `ChatMessage`<br/>PK: `id` (UUID) | `sessionId -> ChatSession.id` (CASCADE) | Deletion of ChatSession cascades delete to ChatMessage. | Chat messages erased when session deleted. | Retain chat transcripts for pedagogical review. | Minor / User log | Proposed Stage D trigger resolves `institutionId` from ChatSession. |
| **20** | `Notification`<br/>PK: `id` (UUID) | `userId -> User.id` (CASCADE) | Deletion of User cascades delete to Notification. | Notification audit trail erased on user deletion. | Add `institutionId` (PROPOSED STAGE D FIELD). | Minor / User alert | Proposed Stage D trigger logs `OLD.institutionId`, `OLD.userId`. |
| **21** | `QuestionBank`<br/>PK: `id` (UUID) | `creatorId -> User.id` (CASCADE) | Deletion of creator User cascades delete to QuestionBank items. | Deleting a teacher user wipes out institution question repository! | Alter FK to `onDelete: Restrict` or `SetNull`. Add `institutionId` (PROPOSED STAGE D FIELD). | **HARD BLOCKER** (Asset Loss) | Proposed Stage D trigger logs `OLD.institutionId`, `OLD.creatorId`. |
| **22** | `SavedMathSolution`<br/>PK: `id` (UUID) | `studentId -> User.id` (CASCADE) | Deletion of Student cascades delete to SavedMathSolution. | Student math scratchpad notes wiped out. | Add `institutionId` (PROPOSED STAGE D FIELD). | Minor / Student note | Proposed Stage D trigger logs `OLD.institutionId`, `OLD.studentId`. |
| **23** | `VideoUpload`<br/>PK: `id` (UUID) | `userId -> User.id` (CASCADE) | Deletion of User cascades delete to VideoUpload metadata. | Raw video upload tracking logs erased on user deletion. | Add `institutionId` (PROPOSED STAGE D FIELD). Restrict user deletion. | Minor / Media tracking | Proposed Stage D trigger logs `OLD.institutionId`, `OLD.userId`. |
| **24** | `UserSession`<br/>PK: `id` (UUID) | `userId -> User.id` (CASCADE) | Deletion of User cascades delete to UserSession. | Active authentication sessions terminated (expected auth lifecycle). | Add `institutionId` (PROPOSED STAGE D FIELD). | Ephemeral auth | Proposed Stage D trigger logs `OLD.institutionId`, `OLD.userId`. |
| **25** | `ExamViolation`<br/>PK: `id` (UUID) | `attemptId -> ExamAttempt.id` (CASCADE) | Deletion of parent `ExamAttempt` cascades delete to Violation. | Proctoring violation logs and timestamps destroyed if attempt deleted. | Preserve attempt and proctoring violation logs. | Preservation risk | Proposed Stage D trigger resolves `institutionId` from ExamAttempt. |
| **26** | `TemporaryAsset`<br/>PK: `id` (UUID) | `assessmentId -> Assessment.id` (CASCADE) | Deletion of Assessment cascades delete to TemporaryAsset. | Ephemeral assessment uploads cleaned up on assessment deletion. | Expired by background cleanup worker. | Ephemeral asset | Proposed Stage D trigger resolves `institutionId` from Assessment. |
| **27** | `ProcessedMedia`<br/>PK: `id` (UUID) | `lessonId -> Lesson.id` (**SET NULL**)<br/>`activeForLesson -> Lesson.activeMediaId` (**SET NULL**) | **DOES NOT CASCADE DELETE.** When `Lesson` deleted, `lessonId` set to NULL. Row survives un-scoped. When `ProcessedMedia` deleted, `Lesson.activeMediaId` set to NULL. | **CRITICAL ARCHITECTURAL FLAW:** Media renditions and S3 paths survive with zero tenant scope after Lesson deletion. Cannot be derived or isolated. | Add direct `institutionId` (PROPOSED STAGE D FIELD). Install direct delete trigger. Evaluate altering FK to `Cascade` or `Restrict`. | **HARD ARCHITECTURAL BLOCKER** | Proposed Stage D trigger logs `OLD.institutionId`. Cannot resolve tenant if `lessonId` is null. |
| **28** | `DailyPlatformStats`<br/>PK: `id` (UUID) | Standalone aggregate metrics table.<br/>No foreign keys. | N/A (Root standalone table). | Aggregated platform-level metric counts. Never deleted during regular application lifecycle. | Standalone SaaS Domain A table. Zero tenant columns. Excluded from tenant isolation and migration tombstones. | **NOT APPLICABLE** (Domain A) | Excluded from delete tombstones. Zero tenant scope. |

---

### 4.3.1 Critical Deletion Paths — Compact Referential-Integrity Evidence Table

The table below provides direct, line-by-line evidence extracted from `packages/database/prisma/schema.prisma` for the critical deletion paths. Every relation field, referenced field, and `onDelete` action represents verified current schema code, while proposed remediations are strictly labeled as future Stage D proposals.

| Critical Entity | Child Model & Exact Relation Field(s) | Parent Model & Referenced Field(s) | Current Schema `onDelete` Action | Verified Cascade Path(s) | Historical / Financial Data Impact (Current State) | Proposed Stage D Action (PROPOSED & UNIMPLEMENTED) | Blocker / Gate Status |
| :--- | :--- | :--- | :---: | :--- | :--- | :--- | :---: |
| **`ExamAttempt`** | `ExamAttempt.examId`<br/>`ExamAttempt.studentId` | `Exam.id`<br/>`User.id` | `Cascade`<br/>`Cascade` | **Direct Paths:**<br/>- `User` (student) deleted -> `ExamAttempt` deleted (`Cascade`).<br/>- `Exam` deleted -> `ExamAttempt` deleted (`Cascade`).<br/>**Indirect Paths:**<br/>- `Course` deleted -> `Exam` -> `ExamAttempt` deleted (`Cascade`).<br/>- `User` (teacher) deleted -> `Course` -> `Exam` -> `ExamAttempt` deleted (`Cascade`). | **Catastrophic Academic Loss:** Deleting a teacher, course, exam, or student silently wipes out permanent exam attempts, question scores, and student transcripts. | **Proposed Stage D Design:** Alter FKs on `examId` and `studentId` to `onDelete: Restrict` in database migration. Prohibit physical deletion. Enforce soft deactivation (`AccountStatus = 'DEACTIVATED'`). | **HARD BLOCKER** (Academic Transcript) |
| **`Submission`** | `Submission.homeworkId`<br/>`Submission.studentId` | `Homework.id`<br/>`User.id` | `Cascade`<br/>`Cascade` | **Direct Paths:**<br/>- `User` (student) deleted -> `Submission` deleted (`Cascade`).<br/>- `Homework` deleted -> `Submission` deleted (`Cascade`).<br/>**Indirect Paths:**<br/>- `Lesson` deleted -> `Homework` -> `Submission` deleted (`Cascade`).<br/>- `Course` deleted -> `Homework` -> `Submission` deleted (`Cascade`).<br/>- `User` (teacher) deleted -> `Course` -> `Homework` -> `Submission` deleted (`Cascade`). | **Catastrophic Student Work Loss:** Deleting a teacher, course, lesson, homework, or student silently deletes student answers, file uploads, teacher remarks, and assignment grades. | **Proposed Stage D Design:** Alter FKs on `homeworkId` and `studentId` to `onDelete: Restrict`. Prohibit physical deletion of historical submissions. | **HARD BLOCKER** (Student Work Preservation) |
| **`Payment`** | `Payment.userId` | `User.id` | `Cascade` | **Direct Path:**<br/>- `User` deleted -> `Payment` deleted (`Cascade`). | **Critical Financial Invariant Breach (OD-708):** Deleting a student, parent, or staff account silently cascade-deletes financial transactions, revenue logs, and audit trails. Current DB offers zero deletion protection. | **Proposed Stage D Design:** Alter `Payment.userId -> User.id` to `onDelete: Restrict`. Install PostgreSQL `BEFORE DELETE` trigger on `Payment` raising an exception to abort transactions. Add `institutionId` (PROPOSED STAGE D FIELD). | **HARD INVARIANT BLOCKER (OD-708)** |
| **`Course.teacherId`** | `Course.teacherId` | `User.id` | `Cascade` | **Direct Path:**<br/>- `User` (teacher) deleted -> `Course` deleted (`Cascade`).<br/>**Downstream Cascade:**<br/>- Deleting Course cascades to delete all `Lesson`, `Exam`, `Homework`, `CourseEnrollment`, `Assessment`, `ExamAttempt`, and `Submission` records! | **Total Curriculum & Academic Wiping:** Deleting a teacher account cascades destructively through the entire academic tree for all courses taught by that teacher. | **Proposed Stage D Design:** Alter `Course.teacherId -> User.id` to `onDelete: Restrict` in Stage D migration. Reassign courses upon teacher departure; enforce soft deactivation. Add `institutionId` (PROPOSED STAGE D FIELD). | **HARD BLOCKER** (Curriculum Loss) |
| **`StudentRiskHistory`** | `StudentRiskHistory.[studentId, lessonId]` | `VideoProgress.[studentId, lessonId]` (backed by `@@unique([studentId, lessonId])`) | `Cascade` | **Compound Indirect Paths:**<br/>- `User` (student) deleted -> `VideoProgress` -> `StudentRiskHistory` deleted (`Cascade`).<br/>- `Lesson` deleted -> `VideoProgress` -> `StudentRiskHistory` deleted (`Cascade`).<br/>- `Course` deleted -> `Lesson` -> `VideoProgress` -> `StudentRiskHistory` deleted (`Cascade`).<br/>- `User` (teacher) deleted -> `Course` -> `Lesson` -> `VideoProgress` -> `StudentRiskHistory` deleted (`Cascade`).<br/>*(Note: Has NO direct FK to User or Lesson).* | **Risk Evaluation History Loss:** Risk engine intervention logs, dropout probability scores, and historical telemetry are destroyed if student, lesson, course, or teacher is deleted. | **Proposed Stage D Design:** Prohibit physical deletion of historical risk events. Maintain video progress completion records for auditing. | **ARCHITECTURAL GATE** (Telemetry History) |
| **`ProcessedMedia` (Direction A)** | `ProcessedMedia.lessonId` | `Lesson.id` | `SetNull` | **Nullification Path (No Delete):**<br/>- `Lesson` deleted -> PostgreSQL sets `ProcessedMedia.lessonId := NULL`. Row survives in database. | **Tenant Severance & Orphaned Storage:** Row survives un-scoped with no `institutionId` and no parent link. Cloud storage prefixes (`storagePrefix`, `masterPlaylistKey`) become untracked orphans. Child delete triggers do not fire. | **Proposed Stage D Design:** Add direct `institutionId` (PROPOSED STAGE D FIELD). Install direct `BEFORE INSERT/UPDATE` trigger. Install direct `AFTER DELETE` trigger. Evaluate changing FK to `Restrict`. | **HARD ARCHITECTURAL BLOCKER** |
| **`ProcessedMedia` (Direction B)** | `Lesson.activeMediaId` | `ProcessedMedia.id` | `SetNull` | **Nullification Path (No Delete):**<br/>- `ProcessedMedia` deleted -> PostgreSQL sets `Lesson.activeMediaId := NULL`. Lesson survives in database. | **Loss of Active Playback Pointer:** Lesson row is preserved, but loses its pointer to active video rendition. If `ProcessedMedia` was deleted directly while `lessonId` was NULL, tombstone cannot record tenant ID. | **Proposed Stage D Design:** Ensure `ProcessedMedia` carries direct `institutionId` so tombstone triggers capture tenant context even if unlinked from lesson. | **HARD ARCHITECTURAL BLOCKER** |

---

### 4.4 Complete Model-by-Model Tenant and Branch Ownership Matrix (All 28 Actual Models — Gate 3)

The table below covers all **28 actual models** defined in `packages/database/prisma/schema.prisma`. Every single field, foreign key, compound constraint, and relation is reconciled directly against repository schema facts. In accordance with strict data-integrity rules:
- No relationships are invented.
- No ambiguous "User OR Course" expressions are permitted: an explicit **selection rule** and **conflict-handling policy** are established for every entity with multiple relational links.
- Where historical ownership cannot be proven with mathematical or cryptographic certainty, the record is designated as **Unresolved** and routed to **OD-720 Indefinite Cold Archival** with `institutionId = NULL`. Zero synthetic tenant assignment is permitted.

| # | Model Name & PK | Domain (OD-702) | Direct `institutionId`? | Direct `branchId`? | Exact Verified Relational Lineage Path | Authoritative Selection Rule & Conflict Resolution | Global Config Data? | Proven for Legacy? | Quarantine Eligibility & Conditions | Unresolved Ambiguity / Edge Cases |
| :---: | :--- | :---: | :---: | :---: | :--- | :--- | :---: | :---: | :--- | :--- |
| **1** | `User`<br/>`id` (UUID) | Domain B | **YES** (Stage D Root) | **YES** (Optional) | Root identity entity (`schema.prisma#L12-L50`). Nullable self-relation `parentId -> User.id`, nullable `centerGroupId -> CenterGroup.id`. | Root identity model. Role determines branch attribution (`CENTER_STUDENT` $\to$ `CenterGroup.branchId`; `ONLINE_STUDENT` $\to$ OD-719 Online Branch). | NO | YES | **ELIGIBLE**: Users with contradictory, dangling, or unresolvable institutional context quarantined. | Legacy users with zero enrollments, zero payments, and zero course activity. |
| **2** | `CenterGroup`<br/>`id` (UUID) | Domain B | **YES** (Stage D Root) | **YES** (Physical Branch) | Physical classroom schedule container (`schema.prisma#L51-L59`). Zero outgoing FKs. | Root physical group container. Direct `institutionId` and physical `branchId` assigned in Stage D. | NO | YES | **ELIGIBLE**: Groups lacking verifiable physical branch assignment quarantined. | Group schedule strings without physical location metadata. |
| **3** | `Course`<br/>`id` (UUID) | Domain B | **YES** (Stage D Root) | **YES** (Optional / Online) | Curriculum container (`schema.prisma#L60-L84`). Foreign key `teacherId -> User.id`. | **Authoritative Legacy Mapping Rule:** Under OD-701/OD-716, the Course is an institutional curriculum asset belonging directly to the migrated Institution (`target_institution_id`).<br/>**Conflict Handling:** Ownership is **NOT derived from teacher**. If `teacher.institutionId` differs or teacher is unassigned/deleted, Course remains assigned to `target_institution_id`; teacher pointer is flagged for administrative review. | NO | YES | **ELIGIBLE**: Quarantined only if institutional context is fundamentally unresolvable. Not quarantined merely because teacher is absent. | Curriculum created by departed teachers or external guest instructors. |
| **4** | `CourseEnrollment`<br/>`id` (UUID) | Domain B | **NO** (Derived) | **NO** (Derived) | Many-to-many academic join (`schema.prisma#L85-L97`). FKs: `courseId -> Course.id`, `studentId -> User.id`. Unique constraint: `@@unique([studentId, courseId])`. | **Selection Rule: `Course` is authoritative.** Derivation: `courseId -> Course.institutionId`.<br/>**Conflict Handling:** If `student.institutionId != course.institutionId`, the enrollment represents an illegal cross-tenant join and is quarantined. | NO | YES | **ELIGIBLE**: Quarantined if `student.institutionId != course.institutionId` or if course/student missing. | Historical enrollments where student or course was soft-deleted. |
| **5** | `Lesson`<br/>`id` (UUID) | Domain B | **NO** (Derived) | **NO** (Derived) | Curriculum unit (`schema.prisma#L98-L121`). Direct FK: `courseId -> Course.id`. Active media pointer: `activeMediaId -> ProcessedMedia.id` (`onDelete: SetNull`). | **Selection Rule: `Course` is authoritative.** Derivation: `courseId -> Course.institutionId`. Branch inherits from `Course`. | NO | YES | **ELIGIBLE**: Orphaned lessons whose parent `Course` is missing are quarantined. | Lessons where `publishedAt` is NULL (unpublished draft lessons). |
| **6** | `Exam`<br/>`id` (UUID) | Domain B | **NO** (Derived) | **NO** (Derived) | Assessment container (`schema.prisma#L122-L141`). Direct FK: `courseId -> Course.id`. | **Selection Rule: `Course` is authoritative.** Derivation: `courseId -> Course.institutionId`. Branch inherits from `Course`. | NO | YES | **ELIGIBLE**: Orphaned exams without parent `Course` quarantined. | None. |
| **7** | `ExamAttempt`<br/>`id` (UUID) | Domain B | **NO** (Derived) | **NO** (Derived) | Student exam submission (`schema.prisma#L142-L162`). Direct FKs: `examId -> Exam.id`, `studentId -> User.id`. | **Selection Rule: Academic container (`Exam`) is authoritative.** Derivation: `examId -> Exam.courseId -> Course.institutionId`.<br/>**Conflict Handling:** If `student.institutionId != course.institutionId`, attempt is quarantined. | NO | YES | **ELIGIBLE**: Quarantined on tenant mismatch or missing exam/student. | Attempts submitted by unassigned students. |
| **8** | `Homework`<br/>`id` (UUID) | Domain B | **NO** (Derived) | **NO** (Derived) | Homework assignment (`schema.prisma#L163-L181`). FKs: `courseId -> Course.id`, optional `lessonId -> Lesson.id`. | **Selection Rule: `Course` is authoritative.** Derivation: `courseId -> Course.institutionId`. If `lessonId` present, asserts `Lesson.courseId == Course.id`. | NO | YES | **ELIGIBLE**: Quarantined if parent `Course` is missing or if `Lesson.courseId != Homework.courseId`. | None. |
| **9** | `Submission`<br/>`id` (UUID) | Domain B | **NO** (Derived) | **NO** (Derived) | Student homework submission (`schema.prisma#L182-L197`). FKs: `homeworkId -> Homework.id`, `studentId -> User.id`. | **Selection Rule: Academic container (`Homework`) is authoritative.** Derivation: `homeworkId -> Homework.courseId -> Course.institutionId`.<br/>**Conflict Handling:** If `student.institutionId != course.institutionId`, quarantined. | NO | YES | **ELIGIBLE**: Quarantined on student-homework tenant mismatch. | Submissions for archived or unassigned homeworks. |
| **10** | `Attendance`<br/>`id` (UUID) | Domain B | **NO** (Derived) | **NO** (Derived) | Physical center attendance event (`schema.prisma#L198-L210`). Direct FK: `studentId -> User.id`. **Note: Schema contains NO `centerGroupId` and NO `branchId` column.** | **Selection Rule: `studentId` derives tenant ownership only.** Derivation: `studentId -> User.institutionId`.<br/>**Branch Attribution:** **UNRESOLVED / NULL.** Student's current `centerGroupId` represents mutable current group membership and CANNOT prove where historical attendance occurred. Branch is marked unresolved; record is fully preserved. | NO | YES | **ELIGIBLE**: Preserved unconditionally; quarantined only if student is missing. | Historical branch location is fundamentally unprovable from existing schema. |
| **11** | `Payment`<br/>`id` (UUID) | Domain B | **YES** (Stage D Root) | **YES** (Optional / Online) | Financial collection transaction (`schema.prisma#L211-L230`). Direct FK: `userId -> User.id`. Scalar: `courseId String?` (unconstrained scalar string, no relational FK). | **Selection Rule: `userId` is the sole relational foreign key.** Derivation: `userId -> User.institutionId`. Scalar `courseId` is advisory metadata, NOT authoritative proof.<br/>**OD-708 Invariant:** Zero deletion allowed. Branch marked UNRESOLVED unless digital gateway (OD-719 Online). | NO | YES | **ELIGIBLE**: Quarantined if user cannot be verified; MUST NOT BE DELETED under any circumstance. | Historical cash collections where physical payment desk was not captured in schema. |
| **12** | `VideoProgress`<br/>`id` (UUID) | Domain B | **NO** (Derived) | **NO** (Derived) | Student video playback telemetry (`schema.prisma#L231-L262`). FKs: `studentId -> User.id`, `lessonId -> Lesson.id`. Constraint: `@@unique([studentId, lessonId])`. | **Selection Rule: `Lesson` is authoritative.** Derivation: `lessonId -> Lesson.courseId -> Course.institutionId`.<br/>**Conflict Handling:** If `student.institutionId != course.institutionId`, quarantined. | NO | YES | **ELIGIBLE**: Quarantined on compound tenant mismatch or missing lesson. | Progress records where lesson was deleted and recreated. |
| **13** | `Assessment`<br/>`id` (UUID) | Domain B | **NO** (Derived) | **NO** (Derived) | Unified assessment rubric (`schema.prisma#L263-L300`). FKs: `courseId -> Course.id`, optional `lessonId -> Lesson.id`, `teacherId -> User.id`. | **Selection Rule: `Course` is authoritative.** Derivation: `courseId -> Course.institutionId`.<br/>**Conflict Handling:** Asserts `teacher.institutionId == course.institutionId`. | NO | YES | **ELIGIBLE**: Quarantined if course missing or teacher cross-tenant mismatch. | Assessments with unassigned teachers. |
| **14** | `AssessmentAttempt`<br/>`id` (UUID) | Domain B | **NO** (Derived) | **NO** (Derived) | Registered student assessment attempt (`schema.prisma#L333-L367`). FKs: `assessmentId -> Assessment.id`, `studentId -> User.id`. | **Selection Rule: `Assessment` is authoritative.** Derivation: `assessmentId -> Assessment.courseId -> Course.institutionId`.<br/>**Conflict Handling:** If `student.institutionId != course.institutionId`, quarantined. | NO | YES | **ELIGIBLE**: Quarantined on student-assessment tenant mismatch. | Attempts by deregistered students. |
| **15** | `ExternalExamAttempt`<br/>`id` (UUID) | Domain B | **NO** (Derived) | **NO** (Derived) | Guest student exam submission (`schema.prisma#L301-L332`). Direct FK: `assessmentId -> Assessment.id`. **Note: Has NO `userId` or `studentId` column.** | **Selection Rule: `Assessment` is the sole relational link.** Derivation: `assessmentId -> Assessment.courseId -> Course.institutionId`. Branch inherits from Course (or OD-719 Online Branch). | NO | YES | **ELIGIBLE**: Quarantined if parent assessment is missing or deleted. | Guest attempts taking assessment outside institution boundary. |
| **16** | `StudentRiskHistory`<br/>`id` (UUID) | Domain B | **NO** (Derived) | **NO** (Derived) | Risk engine intervention history (`schema.prisma#L368-L380`). Compound FK: `[studentId, lessonId] -> VideoProgress.[studentId, lessonId]`. **Note: Has NO direct FK to User or Lesson.** | **Selection Rule: `VideoProgress` is authoritative.** Derivation: `VideoProgress.lessonId -> Lesson.courseId -> Course.institutionId`.<br/>**Conflict Handling:** Reconciles `VideoProgress.studentId -> User.institutionId`. Quarantined on mismatch. | NO | YES | **ELIGIBLE**: Quarantined if compound parent `VideoProgress` row is missing or mismatched. | Historical risk events where parent video progress was purged. |
| **17** | `LessonQuiz`<br/>`id` (UUID) | Domain B | **NO** (Derived) | **NO** (Derived) | In-video quiz prompt (`schema.prisma#L381-L391`). Direct FK: `lessonId -> Lesson.id`. | **Selection Rule: `Lesson` is authoritative.** Derivation: `lessonId -> Lesson.courseId -> Course.institutionId`. | NO | YES | **ELIGIBLE**: Quarantined if parent lesson is missing. | None. |
| **18** | `ChatSession`<br/>`id` (UUID) | Domain B | **NO** (Derived) | **NO** (Derived) | AI tutoring session (`schema.prisma#L392-L400`). Direct FK: `userId -> User.id`. **Note: Has NO `courseId` or Course relation.** | **Selection Rule: `User` is the sole relational link.** Derivation: `userId -> User.id -> User.institutionId`. | NO | YES | **ELIGIBLE**: Quarantined if user is unassigned or deleted. | Guest AI chat sessions where user is unassigned. |
| **19** | `ChatMessage`<br/>`id` (UUID) | Domain B | **NO** (Derived) | **NO** (Derived) | Individual AI message (`schema.prisma#L401-L410`). Direct FK: `sessionId -> ChatSession.id`. | **Selection Rule: `ChatSession` is authoritative.** Derivation: `sessionId -> ChatSession.userId -> User.institutionId`. | NO | YES | **ELIGIBLE**: Quarantined if parent session missing. | None. |
| **20** | `Notification`<br/>`id` (UUID) | Domain B | **NO** (Derived) | **NO** (Derived) | In-app notification alert (`schema.prisma#L411-L427`). Direct FK: `userId -> User.id`. | **Selection Rule: `User` is the sole relational link.** Derivation: `userId -> User.id -> User.institutionId`. | NO | YES | **ELIGIBLE**: Quarantined if target user is unassigned. | System broadcast notifications without target user. |
| **21** | `QuestionBank`<br/>`id` (UUID) | Domain B | **YES** (Stage D Root) | **NO** | Reusable curriculum question repository (`schema.prisma#L428-L457`). Direct FK: `creatorId -> User.id`. | **Selection Rule: Direct `institutionId` assigned in Stage D.** Derivation for legacy: `creatorId -> User.institutionId`. If creator deleted, retained under institution repository. | NO | YES | **ELIGIBLE**: Quarantined if creator cannot be resolved to any institution. | Shared curriculum items created by former multi-group teachers. |
| **22** | `SavedMathSolution`<br/>`id` (UUID) | Domain B | **NO** (Derived) | **NO** (Derived) | Student scratchpad solution (`schema.prisma#L458-L467`). Direct FK: `studentId -> User.id`. | **Selection Rule: `User` is the sole relational link.** Derivation: `studentId -> User.id -> User.institutionId`. | NO | YES | **ELIGIBLE**: Quarantined if student is missing or unassigned. | None. |
| **23** | `VideoUpload`<br/>`id` (UUID) | Domain B | **NO** (Derived) | **NO** (Derived) | Raw teacher upload log (`schema.prisma#L468-L484`). Direct FK: `userId -> User.id`. **Note: Has NO relation to `ProcessedMedia`.** | **Selection Rule: `User` is the sole relational link.** Derivation: `userId -> User.id -> User.institutionId`. | NO | YES | **ELIGIBLE**: Quarantined if uploader user is unassigned. | Upload tracking rows where physical upload failed to complete. |
| **24** | `UserSession`<br/>`id` (UUID) | Domain B | **NO** (Derived) | **NO** (Derived) | Refresh token auth session (`schema.prisma#L485-L498`). Direct FK: `userId -> User.id`. | **Selection Rule: `User` is the sole relational link.** Derivation: `userId -> User.id -> User.institutionId`. | NO | YES | **Revocation**: Ephemeral auth sessions with missing user revoked immediately. | Lingering sessions for deleted or revoked users. |
| **25** | `ExamViolation`<br/>`id` (String) | Domain B | **NO** (Derived) | **NO** (Derived) | Anti-cheat proctoring incident (`schema.prisma#L513-L522`). Direct FK: `attemptId -> ExamAttempt.id`. | **Selection Rule: `ExamAttempt` is authoritative.** Derivation: `attemptId -> ExamAttempt.examId -> Exam.courseId -> Course.institutionId`. | NO | YES | **ELIGIBLE**: Quarantined if parent exam attempt is missing. | Violations recorded during orphaned test attempts. |
| **26** | `TemporaryAsset`<br/>`id` (UUID) | Domain B | **NO** (Derived) | **NO** (Derived) | Ephemeral assessment file upload (`schema.prisma#L601-L635`). Nullable FK: `assessmentId -> Assessment.id` (`onDelete: Cascade`). | **Selection Rule: `Assessment` is authoritative if present.** Derivation: `assessmentId -> Assessment.courseId -> Course.institutionId`.<br/>**Orphan Rule:** If `assessmentId IS NULL`, ownership cannot be proven. | NO | Conditional | **ELIGIBLE (OD-720 Archival)**: Quarantined if `assessmentId IS NULL` or unresolvable. Expired by cleanup worker. | Unattached uploads created during draft question authoring. |
| **27** | `ProcessedMedia`<br/>`id` (UUID) | Domain B | **YES** (Stage D Root) | **NO** | Transcoded HLS media rendition (`schema.prisma#L636-L670`). Nullable FKs: `lessonId -> Lesson.id` (`onDelete: SetNull`), `Lesson.activeMediaId -> ProcessedMedia.id` (`onDelete: SetNull`). | **Selection Rule:**<br/>- If `lessonId IS NOT NULL`: Proven derivation via `lessonId -> Lesson.courseId -> Course.institutionId`.<br/>- If `lessonId IS NULL`: **Ownership UNPROVABLE**. Zero relation to `VideoUpload`. Quarantined under OD-720 cold archival (`institutionId = NULL`). | NO | Conditional | **MANDATORY QUARANTINE (OD-720)**: All historical media with `lessonId IS NULL` retained in cold storage with `institutionId = NULL`. Zero synthetic assignment. Zero storage deletion. | Historical orphaned transcodings where lesson was previously deleted. |
| **28** | `DailyPlatformStats`<br/>`id` (UUID) | **Domain A** | **NO** (Category 4 Platform) | **NO** | SaaS system-wide operational metrics rollup (`schema.prisma#L499-L512`). Zero foreign keys. Unique constraint: `@@unique([date])`. | **Domain A SaaS Platform Telemetry.** Excluded from tenant scoping. Historical metrics record aggregate platform-wide system volume. | **YES** (Platform Telemetry) | N/A (Platform) | **NOT ELIGIBLE**: System-wide platform telemetry; never quarantined. | Aggregate revenue field reflects historical pre-multitenancy system total. |

---

---

## 5. PostgreSQL Triggers, Durable Change Tracking & Comprehensive Cascade Tombstones

### 5.1 Multi-Version Deployment Architecture
During rolling transition, instances of the old application version (v1) and new tenant-aware version (v2) execute concurrently. Because v1 code does not populate tenant columns, database triggers intercept un-scoped writes and enforce tenant boundaries.

```
                      +-----------------------------------+
                      |        LOAD BALANCER / TRAFFIC    |
                      +-----------------------------------+
                            /                       \
                           v                         v
                +--------------------+     +--------------------+
                | OLD INSTANCES (v1) |     | NEW INSTANCES (v2) |
                |  No tenant logic;  |     |  Populates verified|
                |  inserts NULL      |     |  institutionId &   |
                |  into new columns  |     |  branchId          |
                +--------------------+     +--------------------+
                            \                       /
                             v                     v
                      +-----------------------------------+
                      |      POSTGRESQL DATABASE ENGINE   |
                      |                                   |
                      |  1. BEFORE INSERT Triggers        |
                      |     -> Gated by _migration_control|
                      |                                   |
                      |  2. BEFORE UPDATE Triggers        |
                      |     -> Re-computes on FK changes  |
                      |     -> Rejects cross-tenant edits |
                      |                                   |
                      |  3. Durable Change Log Table      |
                      |     -> Captures INSERT/UPDATE/DEL |
                      |                                   |
                      |  4. All-Table Tombstone Triggers  |
                      |     -> Captures direct & cascaded |
                      |        deletes across 27 tables   |
                      +-----------------------------------+
```

### 5.2 Technical Specification of Separate INSERT vs. UPDATE Trigger Rules

#### 1. Rules for INSERT:
- **Gated Fallback Check:** Trigger queries `SELECT is_approved, target_institution_id FROM _migration_control LIMIT 1;`.
- If `institutionId` is NULL:
  - If `is_approved = FALSE` (Pre-approval): The trigger executes `RAISE EXCEPTION 'PRE_APPROVAL_REJECTION: Writes without tenant context are rejected before migration sign-off'`.
  - If `is_approved = TRUE` (Post-approval): Derives from parent FK if available; otherwise assigns `target_institution_id`.
- If explicit `institutionId` is provided (v2 write): Validates that it matches the parent record's `institutionId`. If mismatched, executes `RAISE EXCEPTION`.

#### 2. Rules for UPDATE (Why `COALESCE(NEW, OLD)` is Insufficient):
- **The Defect of `COALESCE(NEW, OLD)`:** If an existing course had `OLD.institutionId = INST_A` and `teacherId` was updated from Teacher A (`INST_A`) to Teacher B (`INST_B`), blindly executing `NEW.institutionId := COALESCE(NEW.institutionId, OLD.institutionId)` preserves `INST_A`. This creates a silent cross-tenant mismatch where Teacher B from Institution B controls a course belonging to Institution A!
- **Mandatory UPDATE Re-Validation Rule:**
  Whenever an ownership-bearing foreign key changes (`NEW.teacherId != OLD.teacherId`, `NEW.userId != OLD.userId`, `NEW.courseId != OLD.courseId`), the trigger **MUST re-fetch the parent record's tenant ID** and assert that it matches `NEW.institutionId`.
  ```sql
  CREATE OR REPLACE FUNCTION trg_tenant_course_update() RETURNS TRIGGER AS $$
  DECLARE v_new_teacher_inst UUID;
  BEGIN
    -- Check if parent relationship changed
    IF NEW."teacherId" != OLD."teacherId" THEN
      SELECT "institutionId" INTO v_new_teacher_inst FROM "User" WHERE id = NEW."teacherId";
      IF v_new_teacher_inst IS NULL THEN
        RAISE EXCEPTION 'CORRUPT_TEACHER_RECORD: Target teacher % has no institution', NEW."teacherId";
      END IF;
      
      -- Reject cross-tenant transfer via ordinary UPDATE
      IF v_new_teacher_inst != OLD."institutionId" THEN
        RAISE EXCEPTION 'CROSS_TENANT_TRANSFER_PROHIBITED: Cannot reassign Course to Teacher % belonging to different institution %', NEW."teacherId", v_new_teacher_inst;
      END IF;
    END IF;

    -- If tenant ID itself was explicitly altered
    IF NEW."institutionId" != OLD."institutionId" THEN
      RAISE EXCEPTION 'DIRECT_TENANT_MUTATION_PROHIBITED: Legitimate tenant transfers require an authorized multi-table migration transaction';
    END IF;

    RETURN NEW;
  END;
  $$ LANGUAGE plpgsql;
  ```
- **Legitimate Ownership Transfers:** A tenant transfer of a course or user is **prohibited via standard UPDATE**. It requires an authorized administrative workflow executing a multi-table atomic transaction that migrates all child records synchronously under strict verification.
- **Protecting Descendant Records:** Foreign keys on parent models configured with `onUpdate: Restrict` prevent reassigning parent tenant IDs if active child records exist.

---

### 5.3 Durable Change-Capture (CDC) Ordering, Replay & Consistency Boundary Protocol

#### 1. Fundamental Divergence Between `(txid, id)` Allocation Order and Commit Order:
In PostgreSQL, `BIGSERIAL id` sequence values and transaction IDs (`txid`/`xid8`) are allocated when an `INSERT`/`UPDATE`/`DELETE` statement executes inside an open transaction, **NOT when the transaction commits**:
- **Why Quiescence Cannot Retroactively Fix Allocation Order:**
  - Enabling application maintenance mode prevents new writes from arriving, but **it does not retroactively change the physical commit order of pre-maintenance transactions**.
  - **The Counterexample:**
    - Transaction $T_1$ starts at $t_1$, executes a statement, assigns CDC `id = 101`, and obtains transaction ID `txid = 100`.
    - Concurrent transaction $T_2$ starts at $t_2$, executes a statement, assigns CDC `id = 102`, and obtains `txid = 101`.
    - $T_2$ commits first at $t_3$.
    - $T_1$ commits afterward at $t_4 > t_3$.
    - The application then enters maintenance mode at $t_5 > t_4$.
  - In this real-world scenario, $T_2$ committed *before* $T_1$ in the PostgreSQL Write-Ahead Log (WAL).
  - However, in `_migration_change_log`, $T_1$ was allocated lower sequence `id = 101` and lower `txid = 100`.
  - Replaying CDC events ordered by `(txid, id)` processes $T_1$ before $T_2$, **inverting the physical commit sequence**!
  - Therefore, **the claim that quiescence makes `(txid, id)` equivalent to commit order is mathematically false and formally removed**. Neither sequence allocation order, transaction ID order, nor trigger firing timestamp (`clock_timestamp()`) can serve as a substitute for proven WAL commit order.

#### 2. Re-Assessment of `pg_snapshot_xmin()` and Identification of Boundary Events:
- **Exact PostgreSQL Types in PostgreSQL 13+:**
  - `pg_current_snapshot()` returns the PostgreSQL internal snapshot type `pg_snapshot`.
  - `pg_snapshot_xmin(pg_snapshot)` extracts the lowest active transaction ID as type `xid8` (a 64-bit transaction identifier representing epoch + 32-bit xid).
  - Legacy `txid_current()` returns `bigint`, but is deprecated in PostgreSQL 13+ in favor of `pg_current_xact_id()`, which returns `xid8`.
  - In `_migration_change_log`, storing `txid` as `BIGINT` requires explicit casting: `pg_current_xact_id()::text::bigint`.
- **Why `txid < pg_snapshot_xmin(...)` Fails as a Boundary Filter:**
  - By definition, `pg_snapshot_xmin(snap)` is the lowest transaction ID among all transactions that were still active (in-flight) at the instant the snapshot was taken.
  - **Transactions with `txid >= xmin` that have already committed:** If a long-running transaction $T_{\text{slow}}$ (e.g., `txid = 90`) is in-flight, `xmin` is 90. If transactions $T_A$ (`txid = 95`) and $T_B$ (`txid = 105`) started after $T_{\text{slow}}$ and committed, their transaction IDs are strictly $\ge xmin$. Filtering `WHERE txid < xmin` **completely excludes committed transactions $T_A$ and $T_B$**, erroneously dropping committed business data!
  - **Transactions in progress at boundary establishment:** If an application transaction was in progress when the boundary began, filtering by `txid < xmin` ignores it. If it commits afterward, its events are omitted from the snapshot drain.
  - **Conclusion:** `WHERE txid < pg_snapshot_xmin(...)` guarantees only that queried transactions are finalized with respect to the oldest in-flight transaction; it does **NOT** capture every transaction committed before the snapshot, nor does it establish commit order.

#### 3. Evaluation of Technically Valid Alternatives & Hard Blocker Status:

Because trigger-based CDC using sequence or transaction IDs cannot prove monotonic commit ordering across concurrent transactions, three architectural alternatives are evaluated:

| Alternative Architecture | Mechanism & Protocol | Concurrency & Ordering Properties | Operational Requirements & Limitations | Feasibility in Current Repository |
| :--- | :--- | :--- | :--- | :---: |
| **Alternative A: WAL/LSN-Based Logical Replication (Logical Decoding)** | Uses PostgreSQL native logical decoding (`pgoutput` / `test_decoding`) via a replication slot (`pg_create_logical_replication_slot`). | **Mathematically Proven Commit Order:** Transactions are reassembled strictly in WAL commit order (`commit_lsn`). Sequence skew and txid interleaving are completely eliminated. | Requires `wal_level = logical` in `postgresql.conf`, replication slot lifecycle management, WAL disk retention monitoring, and superuser/replication role privileges. | **UNCONFIGURED** in current Docker/database environment. |
| **Alternative B: Authoritative Full Offline Backfill (Maintenance Window)** | Bypasses incremental CDC replay entirely. Application writes are gated at the gateway. A Table Lock Barrier (`EXCLUSIVE MODE`) freezes all 27 business tables. Set-based backfills execute directly on the live tables (`UPDATE T SET "institutionId" = ... WHERE "institutionId" IS NULL`). | **Eliminates Commit-Order Dependency:** Live tables under full write freeze reflect the exact, final committed state of all historical transactions. No replay ordering is required. | Requires a scheduled application maintenance window (read-only / downtime for writes). Backfill execution time must fit within maintenance SLA. | **FEASIBLE**, but requires PO approval of maintenance window downtime. |
| **Alternative C: Commit Timestamp Tracking (`track_commit_timestamp`)** | Enables `track_commit_timestamp = on` in `postgresql.conf` and queries `pg_xact_commit_timestamp(txid)`. | Provides physical commit timestamps for committed transactions. | Cannot be queried inside a row-level trigger (the current transaction's commit timestamp does not exist until *after* the transaction commits to WAL). Requires separate asynchronous poller. | **UNCONFIGURED** in current infrastructure. |

> [!CAUTION]
> **HARD ARCHITECTURAL BLOCKER: CDC CUTOVER SAFETY NOT YET PROVEN:**  
> The current trigger-based CDC architecture cannot prove commit-order correctness or complete boundary draining under live concurrent writes. To resolve this blocker, the project must either:  
> 1. Formally adopt **Alternative B (Authoritative Full Offline Backfill under Maintenance Window)**, eliminating trigger CDC replay dependencies; OR  
> 2. Formally provision **Alternative A (PostgreSQL Logical Replication)** with WAL-level commit sequencing.  
> Until one of these alternatives is approved and designed, CDC cutover safety remains **UNPROVEN AND BLOCKED**.

#### 4. Detailed Operational Protocol for Alternative B (Authoritative Full Offline Backfill)

##### A. Evaluation: Why Alternative B Safely Replaces Trigger-Based CDC Replay Entirely
Alternative B eliminates the need for trigger-based CDC event capture (`_migration_change_log`), row-level tombstone logging during cutover, Safe Horizon calculations (`pg_snapshot_xmin`), and replay commit-order sorting. Under Alternative B:
1. Application write paths are completely halted and drained through a controlled, multi-stage quiescence protocol.
2. An explicit PostgreSQL table lock barrier (`EXCLUSIVE MODE`) freezes all 27 business tables.
3. The live tables themselves represent the static, authoritative committed state of all historical data.
4. Set-based direct batch updates (`UPDATE T SET "institutionId" = ... WHERE "institutionId" IS NULL`) execute directly on the live tables inside the locked migration transaction.
5. All CDC replay race conditions, transaction ID interleaving, sequence allocation inversions, and self-deadlocks are eliminated because **no incremental CDC replay occurs**.

##### B. PostgreSQL Write-Freeze Completeness & Lock Coverage Analysis
A complete write freeze cannot be established merely by executing `LOCK TABLE`. Every possible writer, background worker, and asynchronous mutation path must be identified, controlled, and accounted for:

1. **Exact Conflict Behavior of `EXCLUSIVE` Table Locks:**
   In PostgreSQL's 8-level lock hierarchy, `EXCLUSIVE MODE` has the following explicit conflict matrix:
   - **Conflicts with:**
     - `ROW SHARE` (acquired by `SELECT ... FOR UPDATE`, `SELECT ... FOR SHARE`, `SELECT ... FOR NO KEY UPDATE`, `SELECT ... FOR KEY SHARE`).
     - `ROW EXCLUSIVE` (acquired by `INSERT`, `UPDATE`, `DELETE`).
     - `SHARE UPDATE EXCLUSIVE` (acquired by `VACUUM` (non-full), `ANALYZE`, `CREATE INDEX CONCURRENTLY`, `ALTER TABLE VALIDATE CONSTRAINT`).
     - `SHARE` (acquired by `CREATE INDEX` non-concurrently).
     - `SHARE ROW EXCLUSIVE`.
     - `EXCLUSIVE` (acquired by other migration transactions).
     - `ACCESS EXCLUSIVE` (acquired by all DDL statements such as `ALTER TABLE`, `DROP TABLE`, `TRUNCATE`, `VACUUM FULL`, `REINDEX TABLE`).
   - **Permits (Does NOT conflict with):**
     - `ACCESS SHARE` (acquired by standard, read-only `SELECT` queries without locking clauses).

2. **Operations That May Still Modify Database State Despite `EXCLUSIVE` Table Locks:**
   Even when `EXCLUSIVE` locks are held on all 27 business tables, specific PostgreSQL operations can still mutate database state and must be accounted for:
   - **Standalone Sequence Increments:** Calling `nextval('seq_name')` or `setval(...)` operates outside table MVCC and table lock boundaries. Sequence values can advance even when tables are locked. (Because writes to the tables themselves are blocked, no rows consume sequence values, but direct sequence alteration is possible).
   - **Unlocked Auxiliary or Standalone Tables:** Any table omitted from the 27 list (e.g. `DailyPlatformStats`, `_migration_control`, or newly created tables) is not covered by the lock barrier. Writes to `DailyPlatformStats` are permissible because it is a Category 4 domain-independent table, but it must never contain tenant references.
   - **Global Cluster Catalog Mutations:** Global DDL statements (e.g. `CREATE DATABASE`, `CREATE ROLE`, `ALTER ROLE`, `CREATE EXTENSION`) operate on global catalogs (`pg_database`, `pg_authid`) and are not blocked by relation-level locks.
   - **External Storage, FDW & Filesystem Mutations:** File uploads to S3/MinIO, Redis key mutations, or mutations via Foreign Data Wrappers (`postgres_fdw`) or `dblink` operate outside PostgreSQL relation locks.
   - **Partitioned Table Children:** If any table is partitioned, acquiring a lock on the parent table does not automatically acquire locks on child partitions unless specified or inherited. (All 27 current business tables are non-partitioned standard PostgreSQL relations).
   - **Session-Local State:** `SET` and `SET LOCAL` modify session-level GUC parameters.

3. **Identification of All Database Writers & External Mutation Paths (Repository Grounded):**
   - **Application HTTP Microservices:** `auth-service`, `user-service`, `course-service`, `analytics-service`, and `ai-service` connecting via Prisma Client (`packages/database/src/index.ts#L13-L23`). Configured in `.env.production.example#L35-L39` with user `ox_admin` to database `ox_digital_education` (in staging: `ox_staging_admin` to `ox_digital_staging`). Controlled via Nginx Gateway maintenance mode (HTTP 503/423).
   - **Background Workers:** Dedicated container workers (e.g. `services/video-worker/src/index.ts`) processing video chunk assembly and transcoding. Must be stopped via container orchestration (`docker compose stop video-worker` / scaled to 0).
   - **Container-Internal Scheduled Jobs:** Scheduled cron jobs (e.g. `riskEngine.job.ts`) executing inside microservice containers. Must be paused or container-disabled.
   - **Asynchronous Queue Processors (BullMQ):** Redis-backed job queues executing background mutations. BullMQ workers must be paused (`queue.pause()`) and drained (`worker.close()`).
   - **External Webhooks & Callbacks:** Payment gateway callbacks (e.g. Paymob webhook endpoints) and notification webhooks. Must be buffered or rejected at reverse proxy level.
   - **Database-Level Scheduled Jobs (`pg_cron`):** PostgreSQL `cron.job` extensions running as `postgres` or administrative users. Must be explicitly disabled via `UPDATE cron.job SET active = false;`.
   - **Replication Writers & Standbys:** Streaming replication senders transmit WAL to read replicas (read-only); logical replication subscribers (if configured) apply writes. Ensure zero logical replication subscribers are configured to write to the primary.
   - **Administrative & DBA Sessions:** Interactive terminal sessions (`psql`, pgAdmin, DBeaver) running under administrative credentials. Must be audited and disconnected.
   - **Backup Agents & Monitoring Daemons:** Distinguish read-only operations from mutating operations:
     - *Ordinary `pg_dump` / Physical Snapshots:* Acquire only `ACCESS SHARE` locks. They do **NOT** mutate database state and can theoretically run concurrently, but they hold open long-running read transactions that block `VACUUM` and delay lock acquisition.
     - *Mutating Backup Tools:* Backup tools that write metadata to tracking tables must be suspended.

4. **Complete PostgreSQL Connection-Freeze & Privilege Procedure (Gate 2):**
   Arbitrary termination of database sessions (`pg_terminate_backend` on all non-self PIDs) is hazardous and strictly prohibited: it can abort system daemons, active logical replication slots, or backup processes. The connection-freeze protocol is designed with full engine-level completeness:

   - **A. Evidence-Based Analysis of Database Identities & Privileges:**
     - *Inventory of Configured Database Login Roles:*
       - **Production Runtime Role:** `POSTGRES_USER=ox_admin` (`.env.production.example#L39`, `docker-compose.production.yml#L303`), connecting to database catalog `ox_digital_education`.
       - **Staging Runtime Role:** `POSTGRES_USER=ox_staging_admin` (`.env.staging.example#L34`), connecting to database catalog `ox_digital_staging`.
       - **Development Runtime Role:** `POSTGRES_USER=postgres` (`docker-compose.yml#L116`), connecting to database catalog `ox_digital_dev`.
       - **Example Documentation Placeholders Discarded:** Roles such as `app_user` and `prisma_user` were generic documentation placeholders from earlier conceptual drafts. They do not exist in the repository configuration and are strictly discarded.
     - *Prisma Connection Pool & Worker Infrastructure:*
       - `packages/database/src/index.ts` lines 15–17 configure `connection_limit=5` per service instance in production. Each backend container (`auth-service`, `user-service`, `course-service`, `analytics-service`, `ai-service`) maintains a persistent connection pool.
       - Complete connection severance requires stopping workers (`docker compose stop video-worker`), pausing BullMQ queues (`queue.pause()`), and gating public traffic before connection drainage.
     - *Database Owner & Superuser Privilege Trap:*
       - In `docker-compose.production.yml` (line 303), `POSTGRES_USER` is configured as `ox_admin`. In standard PostgreSQL Docker environments, `POSTGRES_USER` is provisioned as a **SUPERUSER and the owner of the database**.
       > [!WARNING]
       > **The Superuser / Owner Bypass Trap:**  
       > In PostgreSQL, database owners and superusers **bypass database-level `CONNECT` permission checks**! Therefore, executing `REVOKE CONNECT ON DATABASE "ox_digital_education" FROM ox_admin;` WILL NOT PREVENT `ox_admin` from connecting if `ox_admin` is the database owner or a superuser!
     - *Mechanics of `ALTER ROLE ox_admin NOLOGIN` (Guaranteed Handshake Denial):*
       - In PostgreSQL, `ALTER ROLE ox_admin NOLOGIN;` sets `rolcanlogin = false` in `pg_authid`.
       - `rolcanlogin` is checked at the authentication handshake layer. A role with `NOLOGIN` **cannot establish a new connection under any circumstance**, completely closing the superuser/owner bypass.
       - **Critical Operational Limitation:** `ALTER ROLE ... NOLOGIN` only prevents **new** incoming client handshakes. It **does NOT terminate existing sessions** already established by connection pools, and it **does NOT block other login roles** (e.g. `postgres`, DBA accounts, or monitoring daemons). Therefore, `NOLOGIN` must be accompanied by explicit connection drainage and verification of all application sessions.

   - **B. Complete 6-Phase Connection Freeze & Drainage Procedure:**
     - **Phase 1: Pre-Freeze ACL Audit (`datacl` State Capture):**
       Inspect and capture the exact database ACL state before executing any permission alterations:
       ```sql
       SELECT datname, datacl IS NULL AS is_default_acl, datacl
       FROM pg_database
       WHERE datname = current_database();
       ```
       *PostgreSQL Default ACL Semantics:* If `datacl IS NULL`, default permissions apply: the database owner has all privileges, and `PUBLIC` possesses `CONNECT` and `TEMPORARY` privileges by default. If `datacl` is not null, explicit security hardening was previously applied.
     - **Phase 2: Ingress Severance & Worker Halt:**
       Route public traffic at Nginx/Gateway to HTTP 503 Maintenance screen. Stop background workers (`docker compose stop video-worker`). Pause BullMQ queues (`queue.pause()`).
     - **Phase 3: Engine-Level Connection Denial:**
       Connect as DBA / `postgres` and execute:
       ```sql
       ALTER ROLE ox_admin NOLOGIN;
       REVOKE CONNECT ON DATABASE "ox_digital_education" FROM PUBLIC;
       ```
       Any restarted container or rogue connection pool thread attempting to authenticate as `ox_admin` is immediately refused (`FATAL: role "ox_admin" is not permitted to log in`).
     - **Phase 4: Graceful 30-Second Drain Window:**
       Identify in-flight application queries without touching system daemons:
       ```sql
       SELECT pid, usename, application_name, client_addr, state, backend_start, xact_start, query
       FROM pg_stat_activity
       WHERE usename IN ('ox_admin', 'ox_staging_admin')
         AND state <> 'idle'
         AND pid <> pg_backend_pid();
       ```
       Wait 30 seconds for in-flight requests to complete naturally and transition to `idle`.
     - **Phase 5: Targeted Termination of Residual Application Sessions Only:**
       Terminate only the lingering connection pool sessions belonging to application roles:
       ```sql
       SELECT pg_terminate_backend(pid)
       FROM pg_stat_activity
       WHERE usename IN ('ox_admin', 'ox_staging_admin')
         AND pid <> pg_backend_pid();
       ```
       System processes (`backend_type IN ('autovacuum worker', 'autovacuum launcher', 'checkpointer', 'background writer', 'walwriter', 'archiver')`), replication slots, and administrative DBA sessions are never terminated.
     - **Phase 6: Zero-Writer Verification Barrier:**
       Assert that zero application connections remain:
       ```sql
       SELECT count(*) FROM pg_stat_activity WHERE usename IN ('ox_admin', 'ox_staging_admin') AND pid <> pg_backend_pid();
       ```
       Must return `0`. If `count > 0`, the cutover halts.

   - **C. Rigorous Access Restoration Protocol (Post-Cutover or Rollback):**
     > [!CRITICAL]
     > **State-Preserving ACL Restoration (Handling Default vs. Hardened ACLs):**  
     > Restoring privileges must strictly recreate the pre-cutover state recorded in Phase 1 without assuming that a generic `GRANT CONNECT` is appropriate:
     
     In Step 11 (or immediately following an aborted transaction rollback):
     1. Re-enable application login:
        ```sql
        ALTER ROLE ox_admin LOGIN;
        ```
     2. Restore database connection privileges based on Phase 1 audit:
        - **Case 1 (`is_default_acl = true`):** The database originally operated under PostgreSQL default privileges (`datacl IS NULL`). Restore default permissions by granting `CONNECT` and `TEMPORARY` back to `PUBLIC`:
          ```sql
          GRANT CONNECT, TEMPORARY ON DATABASE "ox_digital_education" TO PUBLIC;
          ```
        - **Case 2 (`is_default_acl = false`):** Explicit hardening previously revoked public access. **DO NOT grant to `PUBLIC`.** Restore connection privileges solely to the verified application role:
          ```sql
          GRANT CONNECT ON DATABASE "ox_digital_education" TO ox_admin;
          ```
          *(Note: If `ox_admin` is the database owner, `CONNECT` is inherent once `LOGIN` is restored; if unprivileged, the explicit `GRANT` re-authorizes connection).*
     3. Unpause BullMQ queues, scale `video-worker` back up, and remove Nginx maintenance mode.

   - **D. Hardened `SECURITY DEFINER` Execution Design:**
     - *Trusted Search Path:* Functions must be compiled with `SET search_path = pg_catalog, public;` to prevent object-shadowing attacks.
     - *Protection Against `pg_temp` Shadowing:* To prevent untrusted sessions from creating temporary tables, views, or operators that hijack `SECURITY DEFINER` logic, revoke temporary table creation on the database:
       ```sql
       REVOKE TEMPORARY ON DATABASE "ox_digital_education" FROM PUBLIC, ox_admin;
       ```
     - *Function Ownership & Execution Privileges:*
       Maintenance functions must be owned by `postgres` (superuser). Revoke `EXECUTE` from `PUBLIC` and grant `EXECUTE` solely to `ox_migrator`:
       ```sql
       REVOKE ALL ON FUNCTION process_migration_batch(text) FROM PUBLIC;
       GRANT EXECUTE ON FUNCTION process_migration_batch(text) TO ox_migrator;
       ```
     - *Role Isolation:* Application role (`ox_admin`) must have `NOINHERIT` and must not possess membership in `ox_migrator` or `postgres`.
     - *Direct Identity Verification:* The function explicitly asserts physical authentication:
       ```sql
       IF SESSION_USER <> 'ox_migrator' THEN
         RAISE EXCEPTION 'SECURITY_ALERT: Unauthorized caller % attempted migration function execution', SESSION_USER;
       END IF;
       ```
       This validates that the physical client connection was established with `ox_migrator` credentials, preventing privilege assumption via `SET ROLE`.
     - *Governance Distinction:* This procedure is an **authoritative architectural design specification for Stage D**. It has **not yet been executed or verified in the live production database**. *(Pre-Implementation Gate 2 Passed).*

##### C. Precise 11-Step Operational Sequence for Alternative B
To execute an authoritative, zero-loss, zero-replay offline cutover:

1. **Step 1: Application Maintenance Mode Entry:**
   - Route all incoming public HTTP traffic at the API Gateway / Cloudflare / Nginx layer to an HTTP 503 Service Unavailable / HTTP 423 Locked Maintenance screen.
   - Public read traffic to static CDN assets remains unaffected; all API mutation requests are stopped at the edge.

2. **Step 2: Draining and Stopping All Application Write Paths:**
   - Systematically drain and halt all asynchronous application write services:
     - Scale background workers (`video-worker`) to 0 pods.
     - Pause scheduled jobs (`riskEngine.job.ts`) in container schedulers.
     - Pause BullMQ queues and await in-flight worker job completion (`worker.close()`).
     - Buffer incoming external webhooks (e.g. payment callbacks) at the proxy.

3. **Step 3: Safe Draining Verification via Targeted `pg_stat_activity`:**
   - Execute the targeted application session drain protocol (Section 5.3.4.B.4). Confirm zero active or `idle in transaction` application connections.

4. **Step 4: Suspend Database-Level Background Writers:**
   - Deactivate `pg_cron` jobs: `UPDATE cron.job SET active = false WHERE active = true;`.
   - Verify no interactive DBA or automated schema-migration tools are actively connected.

5. **Step 5: Deterministic Business-Table Lock Acquisition:**
   - Connect using vaulted `ox_migrator` credentials. Initiate transaction and acquire `EXCLUSIVE` locks across all 27 business tables in strict alphabetical order:
     ```sql
     BEGIN TRANSACTION ISOLATION LEVEL READ COMMITTED;
     SET LOCAL lock_timeout = '10s';
     SET LOCAL statement_timeout = '600s';

     LOCK TABLE 
       "Assessment", "AssessmentAttempt", "Attendance", "CenterGroup", "ChatMessage",
       "ChatSession", "Course", "CourseEnrollment", "Exam", "ExamAttempt",
       "ExamViolation", "ExternalExamAttempt", "Homework", "Lesson", "LessonQuiz", "Notification",
       "Payment", "ProcessedMedia", "QuestionBank", "SavedMathSolution", "StudentRiskHistory",
       "Submission", "TemporaryAsset", "User", "UserSession", "VideoProgress", "VideoUpload"
     IN EXCLUSIVE MODE;
     ```
   - On error `55P03` or `40P01`, execute immediate `ROLLBACK;`, wait with randomized exponential backoff ($2^n \times 1\text{s} \pm 500\text{ms}$), and retry up to 3 times before halting.

6. **Step 6: Authoritative Consistent State Snapshot on Live Tables Directly:**
   - Live tables under lock represent the static, frozen state of all committed data.
   - Capture pre-backfill baseline counts, primary-key sets, and detailed payment records into temporary migration baseline tables (`_pre_migration_*_snapshot`).

7. **Step 7: Direct Batch Backfill Execution Without CDC Replay Overhead:**
   - Execute set-based direct SQL updates in strict dependency hierarchy order:
     - **Level 1 (Root Identity):** Assign default institution and branches (approved Post-Approval identifiers).
     - **Level 2 (Users):** `UPDATE "User" SET "institutionId" = :instId WHERE "institutionId" IS NULL;`
     - **Level 3 (Courses & Academics):** `UPDATE "Course" SET "institutionId" = :instId WHERE "institutionId" IS NULL;`
     - **Level 4 (Lessons, Groups, Quizzes):** Cascade derivations to child academic entities.
     - **Level 5 (Submissions, Attempts, Payments):** Derive and set `institutionId` across transactional entities.

8. **Step 8: Post-Backfill Validation Assertions:**
   - Execute the exhaustive 10-Point Data Integrity Validation Matrix (Section 5.4). If any single assertion fails, abort and rollback.

9. **Step 9: Final Phase 3 NOT NULL Constraints, Foreign Keys & Indexes:**
   - Apply structural schema constraints:
     ```sql
     ALTER TABLE "Course" ALTER COLUMN "institutionId" SET NOT NULL;
     ALTER TABLE "Course" ADD CONSTRAINT fk_course_institution FOREIGN KEY ("institutionId") REFERENCES "Institution"(id);
     CREATE INDEX IF NOT EXISTS idx_course_institution ON "Course"("institutionId");
     -- Repeat across all 27 tables
     ```

10. **Step 10: Commit and Atomic Lock Release:**
    - Issue `COMMIT;`. Atomically makes all backfilled tenant fields, constraints, and indexes permanent while simultaneously releasing all 27 table locks.

11. **Step 11: Controlled Service Restoration Sequence:**
    - **11a:** Database health check (verify read/write latency, connection pool responsiveness).
    - **11b:** Resume BullMQ workers and scheduled jobs with tenant-aware isolation logic.
    - **11c:** Restore application database connection privileges (`ALTER ROLE ox_admin LOGIN; GRANT CONNECT ON DATABASE "ox_digital_education" TO ox_admin;`, restoring the pre-cutover `datacl` state without generic `PUBLIC` grants).
    - **11d:** Reactivate `pg_cron` jobs (`UPDATE cron.job SET active = true;`).
    - **11e:** Un-gate API Gateway and monitor traffic, error rates, and connection pools.

##### D. Rollback Mechanics
- **Transaction-Level Automatic Rollback (Steps 5–9):** If any query fails, statement times out, or validation assertion is violated prior to Step 10, the migration runner immediately issues `ROLLBACK;`. PostgreSQL MVCC instantaneously drops all backfill updates, discards constraint alterations, and releases all table locks. The database returns to its exact pre-migration state without data corruption.
- **Post-Commit Manual Recovery (Step 11):** If unexpected application-level errors emerge after commit during service restoration, the API Gateway maintenance gate remains active while operations either:
  1. Apply hotfix application patches; or
  2. Execute a point-in-time recovery (PITR) to the restore point created immediately prior to Step 5.

##### E. Explicit Entry and Exit Conditions
- **Entry Conditions (All must be TRUE to initiate Step 5):**
  1. API Gateway maintenance screen active and verified.
  2. All application write workers and BullMQ queue consumers stopped.
  3. Active application database write sessions = 0 in `pg_stat_activity`.
  4. Active `pg_cron` jobs disabled.
  5. Full database backup verified.
- **Exit Conditions (All must be TRUE to complete Step 11):**
  1. All 10 validation matrix assertions pass with 100% compliance.
  2. All NOT NULL and Foreign Key constraints active and valid.
  3. Post-cutover automated smoke test suite passes with 100% success.
  4. API Gateway un-gated and public traffic flowing with error rate < 0.01%.

##### F. Downtime Duration Disclaimer
> [!IMPORTANT]
> **DOWNTIME DURATION CANNOT BE PROMISED WITHOUT EMPIRICAL WORKLOAD MEASUREMENTS:**  
> The total duration of application downtime under Alternative B depends directly on database volume (millions of rows across 27 tables), I/O throughput, lock acquisition latency, and index creation time. **No duration estimate (e.g. "15 minutes") can be promised or relied upon without executing full-scale mock migrations against staging environments populated with production-representative data volumes.**

---

#### 5. Establishing the Verifiable Consistency Boundary via Deterministic Table Lock Barrier (Alternative A / Trigger CDC Reference)

The previous reliance on `pg_stat_activity` query-text filtering (`query ILIKE '%INSERT%'`) is fundamentally flawed and removed. Text inspection misses prepared statements (`EXECUTE`), PL/pgSQL stored procedures, ORM connection-pool transactions in `idle in transaction` state, and internal driver batch writes. It is replaced by an ACID-compliant **Deterministic Table Lock Barrier**:

##### A. Table Scope Categorization:
The database tables during migration are strictly partitioned into three distinct operational categories:
1. **Protected Business Tables (27 domain tables in migration consistency scope):**
   `"Assessment"`, `"AssessmentAttempt"`, `"Attendance"`, `"CenterGroup"`, `"ChatMessage"`, `"ChatSession"`, `"Course"`, `"CourseEnrollment"`, `"Exam"`, `"ExamAttempt"`, `"ExamViolation"`, `"ExternalExamAttempt"`, `"Homework"`, `"Lesson"`, `"LessonQuiz"`, `"Notification"`, `"Payment"`, `"ProcessedMedia"`, `"QuestionBank"`, `"SavedMathSolution"`, `"StudentRiskHistory"`, `"Submission"`, `"TemporaryAsset"`, `"User"`, `"UserSession"`, `"VideoProgress"`, `"VideoUpload"`.
2. **Standalone SaaS Platform Table (1 table, excluded from migration scope):**
   `"DailyPlatformStats"` (Category 4 Domain A platform-wide aggregation table; zero tenant foreign keys; never locked or migrated under tenant boundaries).
3. **Migration Auxiliary & Control Tables (Engine & Tracking tables):**
   - `_migration_control`: Migration state machine flags and stage gates.
   - `_migration_change_log`: Transaction-level CDC event log.
   - `_migration_tombstones`: Row-level deletion tombstone log.
   - `_pre_migration_*_snapshot`: Read-only pre-migration baseline tables.
   - `MigrationQuarantine`: Diagnostic quarantine log for unresolvable records.

##### B. PostgreSQL Table Lock Semantics & Deadlock Behavior:
- **Lock Mode:** `EXCLUSIVE MODE`.
  - **Conflict & Waiting Behavior:** `EXCLUSIVE` locks conflict with `ROW EXCLUSIVE` locks (held by standard `INSERT`, `UPDATE`, `DELETE`). Therefore, acquiring an `EXCLUSIVE` lock automatically forces the lock acquisition statement to wait in the PostgreSQL lock queue behind all active in-flight write transactions.
  - **Post-Acquisition Behavior:** Once granted, `EXCLUSIVE MODE` prevents any new write transactions (`INSERT`, `UPDATE`, `DELETE`, `SELECT ... FOR UPDATE / FOR SHARE`) from starting on the locked tables, while permitting concurrent un-locked `SELECT` queries to proceed uninterrupted.
- **Handling In-Flight Transactions Started Before the Boundary:**
  - If a transaction started *before* the lock barrier was requested but is still active, the `LOCK TABLE` statement blocks synchronously until that transaction either issues `COMMIT` or `ROLLBACK`.
  - Once the lock is granted, PostgreSQL guarantees that **zero active uncommitted write transactions exist** across all 27 tables.
- **Lock Timeout as a Failure Threshold:**
  - `SET LOCAL lock_timeout = '10s';` is an **abort threshold**, NOT a guarantee that pre-existing transactions will finish within 10 seconds.
  - If any active transaction holds locks past 10 seconds, PostgreSQL raises error code `55P03 (lock_not_available)`.
  - **Mandatory Abort & Release Policy:** On encountering `55P03` or any lock error, the entire barrier transaction MUST immediately issue `ROLLBACK`, thereby releasing all acquired locks before entering backoff and retry. Locks must NEVER remain partially held.
- **Alphabetical Ordering Limitation:**
  - Tables are acquired strictly in **alphabetical order**: `"Assessment"`, `"AssessmentAttempt"`, ..., `"VideoUpload"`.
  - While alphabetical ordering is internally deterministic, **it does NOT eliminate deadlocks** with application transactions that acquire multiple tables in a different order (e.g., if an application transaction writes to `Course` then `User`, while the barrier locks `User` then `Course`).
  - If a circular lock dependency occurs, PostgreSQL's deadlock detector raises error code `40P01 (deadlock_detected)`.
  - On `40P01`, the barrier transaction rolls back immediately, waits with randomized exponential backoff ($2^n \times 1\text{s} \pm 500\text{ms}$), and retries up to 3 times before halting.

##### C. Complete CDC Finalization Sequence (9 Strict Steps):
To execute a verifiable, zero-loss cutover boundary:

1. **Step 1: Stop/Gate Application Writes (Application Maintenance Mode — MANDATORY BLOCKER):**
   - *Action:* Application write traffic is stopped or gated at the API Gateway level (routing writes to an HTTP 503 / HTTP 423 Maintenance screen).
   - *Why Required:* Gating writes at the application level reduces write concurrency to zero, preventing incoming HTTP requests from piling up in connection pools and timing out while the database locks are held.
2. **Step 2: Deterministic Business-Table Lock Acquisition:**
   - Inside a dedicated database transaction, set timeouts and acquire `EXCLUSIVE` locks across all 27 business tables in strict alphabetical order:
     ```sql
     BEGIN TRANSACTION ISOLATION LEVEL READ COMMITTED;
     SET LOCAL lock_timeout = '10s';
     SET LOCAL statement_timeout = '60s';

     LOCK TABLE 
       "Assessment", "AssessmentAttempt", "Attendance", "CenterGroup", "ChatMessage",
       "ChatSession", "Course", "CourseEnrollment", "Exam", "ExamAttempt",
       "ExamViolation", "ExternalExamAttempt", "Homework", "Lesson", "LessonQuiz", "Notification",
       "Payment", "ProcessedMedia", "QuestionBank", "SavedMathSolution", "StudentRiskHistory",
       "Submission", "TemporaryAsset", "User", "UserSession", "VideoProgress", "VideoUpload"
     IN EXCLUSIVE MODE;
     ```
3. **Step 3: Writer Draining Confirmation:**
   - *ACID Proof:* The successful granting of the `EXCLUSIVE` lock barrier is the mathematical and operational confirmation that all pre-existing conflicting write transactions have completed (committed or aborted). No query-text filtering of `pg_stat_activity` is used.
4. **Step 4: Boundary CDC Event Processing:**
   - Query all remaining un-replayed CDC events up to the consistency boundary:
     ```sql
     SELECT * FROM _migration_change_log 
     WHERE status = 'PENDING' 
     ORDER BY txid, id 
     FOR UPDATE;
     ```
5. **Step 5: Lock-Owning Transaction Replay (Self-Deadlock Prevention):**
   - The CDC worker executes replay writes directly **within the exact same database session and transaction that owns the `EXCLUSIVE` table locks**.
   - Because table locks in PostgreSQL are transaction-scoped, statements executed within the owning transaction already possess the lock and will not block or deadlock against themselves.
6. **Step 6: Secure Trigger-Side Authorization for CDC Replay Suppression & Row-Level Return Semantics:**
   - Replaying changes to business tables must NOT cause CDC triggers to recursively re-insert events into `_migration_change_log` or `_migration_tombstones`.
   - **Vulnerability of Custom GUC Alone:** A custom PostgreSQL GUC (e.g. `SET LOCAL ox.migration_skip_cdc = 'true'`) is NOT an authorization boundary on its own; any connected application client could issue `SET` to silently bypass auditing and CDC logging.
   - **Login Identity (`SESSION_USER`) vs. Execution Identity (`CURRENT_USER`):**
     - Inside a `SECURITY DEFINER` function, `CURRENT_USER` automatically switches to the owner of the function (e.g., `postgres`), losing the caller's identity for permission checks.
     - In contrast, `SESSION_USER` permanently retains the original authenticated database login role of the physical connection.
     - Therefore, the trigger MUST inspect `SESSION_USER` (or `pg_has_role(SESSION_USER, 'ox_migration_role', 'MEMBER')`), NOT `CURRENT_USER`.
   - **Protection Against `search_path` Hijacking:**
     - In PostgreSQL, all `SECURITY DEFINER` functions MUST declare a secure, immutable `search_path` (`SET search_path = pg_catalog, pg_temp`) to prevent search-path substitution attacks by unprivileged users. All table and relation references must be fully schema-qualified (e.g., `public."_migration_change_log"`, `public."User"`).
   - **PostgreSQL Migration Privilege Model: Direct Login vs. Role Membership:**
     - *Design Decision (Direct Login Recommended):* A single dedicated login role `ox_migrator` without intermediate role membership is the cleanest, least error-prone architecture. Direct check (`SESSION_USER = 'ox_migrator'`) eliminates unnecessary role inheritance risks and grant administration overhead.
     - *If Multi-Runner Role Membership is Required:*
       - In PostgreSQL 15/16: `CREATE ROLE ox_migration_role WITH NOLOGIN; CREATE ROLE ox_migrator WITH LOGIN PASSWORD 'vault_secret' NOINHERIT; GRANT ox_migration_role TO ox_migrator;`.
       - In PostgreSQL 16+: Enforce fine-grained grant boundaries: `GRANT ox_migration_role TO ox_migrator WITH INHERIT FALSE, SET TRUE;`.
       - *Invalidity of `REVOKE ADMIN OPTION FOR ... FROM PUBLIC`:* In PostgreSQL 15/16, user-defined roles do NOT grant `ADMIN OPTION` to `PUBLIC` by default; executing `REVOKE ADMIN OPTION` emits a warning. The correct security configuration is explicit revocation of all role privileges:
         ```sql
         REVOKE ALL ON ROLE ox_migration_role FROM PUBLIC, app_user, prisma_user;
         REVOKE ALL ON ROLE ox_migrator FROM PUBLIC, app_user, prisma_user;
         ```
     - *Why `NOINHERIT` Alone Does NOT Prevent `SET ROLE`:* `NOINHERIT` only controls automatic privilege inheritance during session queries without explicitly calling `SET ROLE`. It does **NOT** block `SET ROLE ox_migration_role`! Any role that has been granted membership can still execute `SET ROLE ox_migration_role` regardless of `NOINHERIT`. The true security boundary is **omission of grant**: never grant `ox_migration_role` or `ox_migrator` to application roles (`app_user`, `prisma_user`) or `PUBLIC`.
     - *Function and Trigger Ownership & DDL Permissions:*
       - **Ownership:** All `SECURITY DEFINER` functions, triggers, and migration tracking tables must be owned by `postgres` (or a dedicated trusted schema superuser), NOT by `ox_migrator` and NOT by `app_user`.
       - **DDL Access Control:** Only the object owner or superuser has privileges to `CREATE`, `ALTER`, or `DROP` triggers and functions. Application roles (`app_user`, `prisma_user`) possess zero DDL privileges on functions or schemas.
       - **Trigger Disabling Protection:** In PostgreSQL, executing `ALTER TABLE ... DISABLE TRIGGER ...` requires superuser or table owner privileges. Because application roles do NOT own the business tables, they are physically incapable of disabling, dropping, or tampering with CDC or tombstone triggers.
     - *Credentials Segregation:* The `ox_migrator` password must be stored strictly in an enterprise secret manager (e.g. HashiCorp Vault, AWS Secrets Manager), used exclusively by migration orchestration pipelines, and NEVER injected into application pod environment variables or `.env` files.
     - *Verified PostgreSQL DDL:*
       ```sql
       -- 1. Create dedicated migration role with LOGIN (credentials vaulted separately from apps)
       CREATE ROLE ox_migrator WITH LOGIN PASSWORD 'vault_managed_secret_only' NOINHERIT;
       CREATE ROLE ox_migration_role WITH NOLOGIN;
       GRANT ox_migration_role TO ox_migrator;

       -- 2. Strict Privilege Isolation (Revoke all access from application roles and PUBLIC)
       -- Note: PUBLIC does not hold ADMIN OPTION by default in PostgreSQL 15/16.
       REVOKE ALL ON ROLE ox_migration_role FROM PUBLIC, app_user, prisma_user;
       REVOKE ALL ON ROLE ox_migrator FROM PUBLIC, app_user, prisma_user;
       ```
   - **Formally Correct Row-Level Trigger Return Semantics:**
     In PL/pgSQL, row-level trigger return semantics differ fundamentally depending on timing and operation:
     - `BEFORE INSERT`:
       - Return `NEW`: continues the insert with the (possibly modified) row.
       - Return `NULL`: silently aborts/cancels the insert for this row (no error raised; row dropped).
     - `BEFORE UPDATE`:
       - Return `NEW`: continues the update with the (possibly modified) row.
       - Return `NULL`: silently aborts/cancels the update for this row.
     - `BEFORE DELETE`:
       - Return `OLD`: continues the delete operation.
       - Return `NULL`: silently aborts/cancels the delete operation.
       - **CRITICAL ENGINE PITFALL:** In PostgreSQL PL/pgSQL, the variable `NEW` is uninitialized during a `DELETE` trigger! If a `BEFORE DELETE` trigger returns `NEW`, it evaluates to `NULL` at runtime, which **silently cancels the delete operation**!
     - `AFTER` triggers:
       - Return value is ignored by the PostgreSQL execution engine (conventionally returns `NULL` or `NEW`/`OLD`).
     - *Corrected Hardened Trigger Function:*
       ```sql
       CREATE OR REPLACE FUNCTION trg_cdc_suppression_check()
       RETURNS trigger
       LANGUAGE plpgsql
       SECURITY DEFINER
       SET search_path = pg_catalog, pg_temp
       AS $$
       BEGIN
         IF current_setting('ox.migration_skip_cdc', true) = 'true' THEN
           -- Authorize strictly based on authenticated connection login (SESSION_USER)
           IF SESSION_USER = 'ox_migrator' OR pg_has_role(SESSION_USER, 'ox_migration_role', 'MEMBER') THEN
             -- Authorized migration replay bypass: return OLD for DELETE, NEW for INSERT/UPDATE
             IF TG_OP = 'DELETE' THEN
               RETURN OLD;
             ELSE
               RETURN NEW;
             END IF;
           ELSE
             -- Unauthorized attempt: abort immediately
             RAISE EXCEPTION 'SECURITY VIOLATION: Role % is not authorized to bypass migration CDC logging', SESSION_USER
               USING ERRCODE = 'insufficient_privilege';
           END IF;
         END IF;

         -- Standard execution path: return OLD for DELETE, NEW for INSERT/UPDATE
         IF TG_OP = 'DELETE' THEN
           RETURN OLD;
         ELSE
           RETURN NEW;
         END IF;
       END;
       $$;
       ```
   - **Impersonation Prevention:** Application microservices connect using `app_user` / Prisma credentials and are strictly denied `SET ROLE ox_migrator` or role membership. The `ox_migrator` password is never injected into application pods or `.env` files.
   - **Status:** Until `ox_migrator` credentials and permissions are formally provisioned in the deployment pipeline, this is classified as an **UNRESOLVED CONFIGURATION DEPENDENCY / STAGE D SECURITY REQUIREMENT**. A custom GUC alone cannot be considered secure.
7. **Step 7: Verification of Queue & Set Reconciliation:**
   - Assert `SELECT count(*) FROM _migration_change_log WHERE status = 'PENDING'` equals 0.
   - Execute the Master Event-Based Lifecycle Reconciliation assertions defined in Section 5.4.
8. **Step 8: Final Constraint Application:**
   - Apply Phase 3 `NOT NULL` constraints, validated foreign key constraints, and operational triggers only after all reconciliation assertions pass under the lock freeze.
9. **Step 9: Lock Release via Transaction Commit:**
   - Commit the transaction:
     ```sql
     COMMIT;
     ```
   - Committing the transaction atomically applies all schema constraints, records migration completion, and releases all 27 table locks simultaneously.

> [!CAUTION]
> **BLOCKING / REQUIRES APPLICATION MAINTENANCE WINDOW:**  
> Acquiring `EXCLUSIVE` table locks without gating application traffic causes connection pool exhaustion and dropped client requests. Step 1 (Application Maintenance Gate) is a **MANDATORY HARD BLOCKER**. Cutover cannot be executed on a live, ungated production environment.

---

### 5.4 Complete Event-Based Lifecycle Reconciliation Protocol

### 5.4 Comprehensive Data Integrity Proof & 10-Point Validation Matrix

#### 1. Limitations of Aggregate Totals, Checksums & Naive Non-Null Assertions
High-level summary metrics and simplistic non-null assertions do **not** constitute a complete proof of data integrity:
1. **Masking of Offsetting Financial Errors by Aggregates:**
   Relying on `SUM(amount)` or count totals is vulnerable to offsetting corruptions (e.g., one payment corrupted by $+\$500$ and another by $-\$500$ yields an identical sum; swapped currencies or mixed exchange rates produce false-positive passes). Financial verification requires **deterministic row-level record reconciliation across all financial attributes**.
2. **Limitations of Hash Checksums (`MD5` / `SHA256`):**
   - Checksums evaluate only the explicitly enumerated projection of columns; unprojected columns or newly added fields are omitted.
   - Text cast representations (e.g., numeric precision `10.5` vs `10.50`, timestamp timezone offsets) can cause false divergence or mask subtle semantic changes.
   - While cryptographic collision probability is negligible, a valid checksum proves only payload attribute preservation—it does **not** validate relational consistency or foreign-key ownership semantics.
3. **Fallacy of Naive `institutionId IS NOT NULL` Checks:**
   Asserting `institutionId IS NOT NULL` confirms that a column is populated, but **proves nothing about the logical correctness of tenant ownership**. A student record assigned to Tenant A enrolled in a course assigned to Tenant B passes `institutionId IS NOT NULL`, yet constitutes an immediate, catastrophic cross-tenant security breach. Ownership correctness requires **exhaustive relational join validation against parent entity hierarchies**.

---

#### 2. The 10-Point Data Integrity Validation Matrix
The cutover protocol enforces a deterministic 10-point validation suite. If any single assertion violates its invariant, the migration aborts and rolls back immediately:

| ID | Validation Scope | Source of Truth | Exact Relational Invariant | Failure Condition | Execution Phase |
| :--- | :--- | :--- | :--- | :--- | :---: |
| **V-01** | **Source and Target Row Counts** | `_pre_migration_T_snapshot` captured at Step 6 lock freeze. | $\forall T \in \{1 \dots 27\}: \text{Count}(T_{\text{live}}) \equiv \text{Count}(T_{\text{snap}})$. Zero rows created or deleted during backfill. | $\text{Count}(T_{\text{live}}) \neq \text{Count}(T_{\text{snap}})$ | **During Lock** (Post-Backfill) |
| **V-02** | **Primary-Key Set Equality & Duplicate Detection** | `_pre_migration_T_snapshot.id` for each table. | $\forall T: \{PK(T_{\text{live}})\} \equiv \{PK(T_{\text{snap}})\}$. Every primary key survives; zero synthetic PKs; zero duplicates ($\text{Count}(\text{DISTINCT } id) \equiv \text{Count}(*)$). | Orphan PKs in live table, missing PKs from snapshot, or duplicate PK count $> 0$. | **During Lock** (Post-Backfill) |
| **V-03** | **Foreign-Key Integrity & Orphan Detection** | Live relational schema across all 27 tables. | All child foreign keys must resolve to active, valid parent primary keys: $\forall c \in Child: c.parent\_id \in \{Parent.id\}$. Zero dangling pointers. | Left join where $Parent.id \text{ IS NULL}$ yields $> 0$ rows. | **During Lock** (Pre-Constraint) |
| **V-04** | **Tenant & Branch Ownership Logical Consistency** | Relational lineage joins (Parent $\to$ Child). | Tenant assignment must strictly match parent entity lineage: <br>1. $User.institutionId \equiv CourseEnrollment.institutionId$<br>2. $Course.institutionId \equiv Lesson.institutionId \equiv Submission.institutionId$<br>3. $Exam.institutionId \equiv ExamAttempt.institutionId$<br>4. $User.institutionId \equiv Payment.institutionId$. | Any child row whose `institutionId` differs from its verified parent entity. | **During Lock** (Post-Backfill) |
| **V-05** | **Non-Tenant Attribute Preservation** | `_pre_migration_T_snapshot` non-tenant columns. | Row-by-row non-tenant attributes remain unaltered: $\forall PK: T_{\text{live}}[A_{\text{business}}] \equiv T_{\text{snap}}[A_{\text{business}}]$. Verified via MD5/SHA256 projection equality across non-tenant fields. | Hash mismatch on non-tenant business attributes for any primary key. | **During Lock** (Post-Backfill) |
| **V-06** | **Payment-Level Financial Reconciliation (OD-708)** | `_pre_migration_payment_snapshot`. | Row-by-row equality across: `(id, amount, currency, status, userId, transactionId)`. Exactly 0 deleted payments; 0 modified amounts; 0 currency conversions; 0 detached users. | Any snapshot payment missing from live table, or any field divergence on payment attributes. | **During Lock** (Post-Backfill) |
| **V-07** | **Academic History Preservation** | Pre-migration snapshot of `ExamAttempt`, `Submission`, `ExamViolation`. | All submitted answers, numerical scores, percentage grades, start/finish timestamps, and proctoring violation logs are 100% identical to baseline. | Score divergence, altered timestamps, or modified answer payloads. | **During Lock** (Post-Backfill) |
| **V-08** | **Quarantine Membership & Reason Codes** | `MigrationQuarantine` audit log. | Quarantined records remain in source tables with `institutionId = NULL`. Diagnostic records have valid `tableName`, `recordId`, standardized `failureReason`, and timestamp. Active quarantine count equals count of null tenant fields. | Record in quarantine with non-null live `institutionId`, or null live row without quarantine log. | **During Lock** (Post-Backfill) |
| **V-09** | **ProcessedMedia Key Ownership & Orphan Detection** | `ProcessedMedia`, `Lesson`, S3/MinIO bucket manifests. | Every `ProcessedMedia` linked to an active `Lesson` inherits the lesson's `institutionId`. Orphaned media (`lessonId IS NULL`) must be cataloged in quarantine; storage key (`playbackUrl`, `storageKey`) must match storage manifest. | Unlinked `ProcessedMedia` assigned to tenant without parent proof, or missing storage key. | **During Lock** (Post-Backfill) |
| **V-10** | **Transaction Rollback & Controlled Recovery** | PostgreSQL Transaction Engine & Staging Backups. | **Pre-Commit:** Any failure in V-01 through V-09 triggers atomic `ROLLBACK;`, releasing locks and reverting all updates instantly.<br>**Post-Commit:** If smoke tests fail, API Gateway freeze is maintained; point-in-time recovery (PITR) restore point is engaged. | Transaction commits partially despite validation failure, or gateway opens with broken schema. | **Before Commit** (Auto) / **After Commit** (Manual) |

---

#### 3. Production SQL Anomaly Detection & Invariant Assertions

**Assertion 1: Row Count Equality Across All 27 Business Tables (V-01):**
```sql
-- Validates that live row count matches pre-migration snapshot exactly for table T:
SELECT 'T' AS table_name,
       (SELECT count(*) FROM "T") AS live_count,
       (SELECT count(*) FROM "_pre_migration_T_snapshot") AS snap_count
HAVING (SELECT count(*) FROM "T") <> (SELECT count(*) FROM "_pre_migration_T_snapshot");
-- Pass Condition: Exactly 0 rows returned across all 27 tables.
```

**Assertion 2: Primary-Key Set Equality & Duplicate Check (V-02):**
```sql
-- Check for missing or unexpected primary keys in table T:
SELECT s.id AS missing_snap_id, l.id AS unexpected_live_id
FROM "_pre_migration_T_snapshot" s
FULL OUTER JOIN "T" l ON s.id = l.id
WHERE s.id IS NULL OR l.id IS NULL;
-- Pass Condition: Exactly 0 rows.
```

**Assertion 3: Logical Relational Tenant Consistency Check (V-04):**
```sql
-- Invariant: Submission institutionId must strictly match Course institutionId
SELECT sub.id AS submission_id, sub."institutionId" AS sub_tenant, c."institutionId" AS course_tenant
FROM "Submission" sub
JOIN "Lesson" l ON sub."lessonId" = l.id
JOIN "Course" c ON l."courseId" = c.id
WHERE sub."institutionId" <> c."institutionId";
-- Pass Condition: Exactly 0 rows.

-- Invariant: Payment institutionId must strictly match User institutionId
SELECT p.id AS payment_id, p."institutionId" AS payment_tenant, u."institutionId" AS user_tenant
FROM "Payment" p
JOIN "User" u ON p."userId" = u.id
WHERE p."institutionId" <> u."institutionId";
-- Pass Condition: Exactly 0 rows.
```

**Assertion 4: Row-Level Financial Audit Equality (OD-708 / V-06):**
```sql
-- Row-by-row join comparing every payment record against snapshot baseline:
SELECT s.id, s.amount AS snap_amount, p.amount AS live_amount,
       s.currency AS snap_currency, p.currency AS live_currency,
       s.status AS snap_status, p.status AS live_status,
       s."userId" AS snap_user, p."userId" AS live_user
FROM "_pre_migration_payment_snapshot" s
LEFT JOIN "Payment" p ON s.id = p.id
WHERE p.id IS NULL
   OR s.amount <> p.amount
   OR s.currency <> p.currency
   OR s.status <> p.status
   OR s."userId" <> p."userId";
-- Pass Condition: Exactly 0 rows returned. Zero financial mutations tolerated.
```

**Assertion 5: Academic History Preservation (V-07):**
```sql
-- Invariant: Zero modification of ExamAttempt answers, scores, or states:
SELECT s.id FROM "_pre_migration_examattempt_snapshot" s
LEFT JOIN "ExamAttempt" a ON s.id = a.id
WHERE a.id IS NULL
   OR s.score IS DISTINCT FROM a.score
   OR s.status <> a.status
   OR s.answers::text <> a.answers::text
   OR s."submittedAt" IS DISTINCT FROM a."submittedAt";
-- Pass Condition: Exactly 0 rows returned.
```

**Assertion 6: ProcessedMedia Orphan & Tenant Validation (V-09):**
```sql
-- Identify any ProcessedMedia with null tenant or invalid lesson linkage:
SELECT pm.id, pm."lessonId", pm."institutionId"
FROM "ProcessedMedia" pm
LEFT JOIN "Lesson" l ON pm."lessonId" = l.id
WHERE (pm."lessonId" IS NOT NULL AND pm."institutionId" <> l."institutionId")
   OR (pm."lessonId" IS NULL AND pm."institutionId" IS NOT NULL);
-- Pass Condition: Exactly 0 rows. Orphaned records must be in MigrationQuarantine.
```

---

## 6. Token Versioning, Cache Consistency & Authorization Revocation

### 6.1 Authoritative Storage & Uniform Zero-Trust Verification Policy
To guarantee technical consistency across the system, the architecture enforces a **Uniform Zero-Trust Authorization Policy**:

```
+----------------------------------------------------------------------------------------------------+
|                               UNIFORM ZERO-TRUST AUTHORIZATION POLICY                              |
|                                                                                                    |
| 1. Authoritative State:   PostgreSQL User.tokenVersion: Int @default(0) is the SINGLE source       |
|                           of truth. Incremented synchronously on every revocation event.           |
|                                                                                                    |
| 2. Redis Acceleration:   Redis stores user:session:{userId} -> { tokenVersion, status }            |
|                           with a 60-second TTL. Revocations broadcast via Redis Pub/Sub.           |
|                                                                                                    |
| 3. Mandatory DB Fallback: On Redis cache miss or Redis outage, gateway MUST query PostgreSQL       |
|                           authoritative state directly. NO request bypasses version verification.  |
|                                                                                                    |
| 4. Fail-Closed Boundary:  If BOTH Redis AND PostgreSQL are unreachable, ALL authenticated          |
|                           endpoints FAIL CLOSED with HTTP 503. NO authenticated endpoint fails open|
|                           or trusts a stale token.                                                 |
+----------------------------------------------------------------------------------------------------+
```

### 6.2 Latency Targets vs. Guaranteed Upper Bounds
- **Operational Latency Target:** Under healthy network conditions, Redis Pub/Sub invalidates gateway in-memory caches within **< 50 milliseconds** (measured operational target, not a hard real-time latency guarantee).
- **Guaranteed Stale Authorization Bound:** If Redis Pub/Sub drops, gateway nodes poll Redis with a strict **60-second TTL**. The **guaranteed upper bound** for local cache staleness is **60 seconds**.
- **Under Complete Redis Outage:** Stale window is **0 seconds**, because all requests fall back to synchronous PostgreSQL query.
- **Under Complete Infrastructure Outage (Redis & DB Down):** Stale window is **0 seconds**, because all requests are rejected with `HTTP 503 Service Unavailable`.
- **Zero Exemption Policy:** Low-risk read endpoints (e.g. video viewing, reading course outlines) are **NOT permitted to bypass token verification during cache outages**. Every request carrying an `Authorization: Bearer` header must verify against Redis or PostgreSQL. Only public, unauthenticated static assets (e.g. landing page marketing images, public CSS/JS) proceed without token checks.

### 6.3 Multi-Channel Revocation Behavior
1. **HTTP REST Endpoints:** Middleware asserts `req.jwt.tokenVersion === authoritative.tokenVersion && authoritative.status === 'ACTIVE'`. Mismatch rejects with `HTTP 401 Unauthorized`.
2. **WebSocket Session Revalidation:** 
   - On receipt of a revocation Pub/Sub event, WebSocket servers terminate active socket connections via `socket.disconnect(true)`.
   - **Heartbeat Revalidation Loop:** To protect against missed Pub/Sub notifications, open WebSocket connections execute a background revalidation check **every 60 seconds** (and on every client message), asserting `tokenVersion` against Redis/PostgreSQL. Mismatches immediately sever the socket.
3. **BullMQ Background Workers:** 
   - Job consumers verify authoritative user status AND institution status (`user.status === 'ACTIVE' && institution.isActive === true && user.institutionId === job.institutionId`) at the exact start of job execution.
   - **Long-Running Job Fencing:** For long-running jobs, the worker checks a transactional cancellation query inside the database transaction before committing mutations:
     ```sql
     SELECT status, "tokenVersion" FROM "User" WHERE id = :userId FOR UPDATE;
     ```
     If status is no longer `ACTIVE`, the transaction rolls back and the job terminates safely without committing stale work.

---

## 7. MigrationQuarantine Privacy, Security & Retention Policy

### 7.1 Privacy-Safe Diagnostic Model (No Full JSON Copies)
Storing complete source records in plaintext JSON inside a quarantine table introduces serious PII and financial security violations. The refined model stores strictly **record references and non-sensitive diagnostic metadata**:

```prisma
model MigrationQuarantine {
  id              String   @id @default(uuid())
  tableName       String
  recordId        String   // Primary key of source row
  failureReason   String   // e.g. "TENANT_MISMATCH_COURSE_STUDENT", "ORPHAN_PARENT_LINK"
  diagnosticMeta  Json?    // Non-sensitive foreign keys, timestamps, and error codes
  quarantinedAt   DateTime @default(now())
  resolvedAt      DateTime?
  resolvedBy      String?

  @@index([tableName])
  @@index([quarantinedAt])
}
```

### 7.2 Access Control & Auditability
- **Access Control:** Restricted strictly to system maintenance administrators (`role === 'ADMIN'`).
- **Auditability:** Every review, reconciliation, or resolution of a quarantined entry generates an immutable audit log record detailing the administrator ID, timestamp, and resolution action taken.

### 7.3 Retention Alternatives (STAGE C GATES)
The previously mentioned 30-day retention period is an **unapproved proposal**. The Product Owner may select from the following retention policies:

| Retention Alternative | Duration | Cleanup Protocol | Appropriate Use Case |
| :--- | :--- | :--- | :--- |
| **Alternative 7A** | **14 Days Post-Cutover** | Automated purge job with PO notification | High-compliance environments requiring minimal data retention. |
| **Alternative 7B (Recommended Proposal)** | **30 Days Post-Cutover** | Manual PO sign-off required before purge | Standard balance between post-migration triage and privacy. |
| **Alternative 7C** | **60 Days Post-Cutover** | Retained in hot storage; purged on day 60 | Extended grace period for edge-case reconciliation. |
| **Alternative 7D** | **Indefinite Cold Archival** | Exported to encrypted, access-restricted cold storage | Strict statutory or regulatory audit requirements. |

### 7.4 Handling of Unresolved Records at Cutover
If any record remains in `MigrationQuarantine` when the cutover date arrives:
1. The record is **isolated in place** and is NOT updated with invalid tenant IDs.
2. In Phase 3 contract migrations, foreign keys and `NOT NULL` constraints apply only to active records. Quarantined records remain untouched in source tables with null tenant fields (or flagged with `quarantine = true`).
3. An unresolved record report is submitted to the Product Owner for manual disposition (manual re-association or administrative archival).

---

## 8. STAGE C — PRODUCT OWNER DECISIONS & TECHNICAL CLOSURE STATUS

### 8.1 Confirmed Approved Decisions (Authoritative & Enforced)
- **OD-701:** Single Primary Manager governance; centralized control over catalog, pricing, policies, and branches.
- **OD-702:** Strict financial separation between OX-DIGITAL SaaS Commercial Finance (Domain A) and Institution Internal Financial Management (Domain B).
- **OD-703:** Unified General Ledger with Branch Dimensions; online dimension represented.
- **OD-708:** Payment Deletion Protection Invariant; historical payments must never be silently or destructively deleted.
- **OD-716:** **Cutover Architecture (APPROVED):** Alternative B — Authoritative Full Offline Backfill. Tables frozen under `EXCLUSIVE MODE` table lock barrier; set-based backfill updates executed directly on authoritative live data, eliminating CDC replay skew.
- **OD-717:** **Maintenance Window (APPROVED IN PRINCIPLE):** Application write maintenance window approved in principle. Actual downtime duration must be established through representative Staging data volume benchmarks and an agreed operational schedule prior to production execution.
- **OD-718:** **Primary Manager Provisioning (APPROVED):** Option 3B — Dedicated verified cryptographic invitation workflow. The existing bootstrap administrator (`admin@edu.com`) remains strictly a separate SaaS Platform Super-Admin (Domain A) with zero automatic institution operational privileges.
- **OD-719:** **Online Dimension Representation (APPROVED):** Online dimension represented as a parameterized `Branch` record with `isOnline: true`, ensuring unified General Ledger accounting and 100% dimensional attribution.
- **OD-720:** **Quarantine Data Retention (APPROVED):** Option 7D — Indefinite cold archival. Diagnostic quarantine records and unlinked media storage keys preserved indefinitely in cold storage; zero unsupported synthetic tenant assignment; zero destructive deletion.

---

### 8.2 Technical Recommendations Awaiting Final Technical Closure
1. **28-Model Ownership Mapping & Protection Matrix:** The 28-model ownership and protection coverage matrix defined in Section 4.
2. **Dual-Layer Deletion Protection:** Configuring `onDelete: Restrict` at DB level on `Payment.user` and `Course.teacher`, combined with `AccountStatus` deactivation at application level.
3. **Uniform Zero-Trust Token Freshness:** `tokenVersion` server-side check with mandatory PostgreSQL fallback on cache miss and complete fail-closed boundary during outages.
4. **Separate INSERT/UPDATE Trigger Rules:** PostgreSQL triggers enforcing derivation on INSERT and preventing cross-tenant transfer on UPDATE.
5. **PostgreSQL Role Security & Trigger Return Semantics:** Vaulted direct login `ox_migrator` privilege boundary (`SESSION_USER = 'ox_migrator'`, omission of grant to application roles, `search_path = pg_catalog, pg_temp` lockdown, and explicit `TG_OP` row-level trigger return semantics).
6. **Redacted Quarantine Model:** The privacy-safe `MigrationQuarantine` model storing references and metadata without plaintext sensitive JSON dumps.

---

### 8.3 Formally Approved Business Decisions Summary
The Product Owner has reviewed and formally **APPROVED** all five key architectural and governance decisions:
1. **Cutover Architecture:** Alternative B (Authoritative Full Offline Backfill) is formally selected.
2. **Maintenance Window:** Approved in principle, conditional on empirical duration benchmarking on Staging.
3. **Primary Manager Provisioning:** Option 3B is formally selected; Platform Super-Admin and Institution Primary Manager remain strictly segregated.
4. **Online Dimension:** Parameterized `Branch` with `isOnline: true` is formally approved.
5. **Quarantine Retention:** Option 7D (Indefinite cold archival) is formally approved with zero synthetic assignment and zero destructive deletion.

---

### 8.4 Remaining Technical Closure Requirements (Pre-Stage D Technical Gates)

While all Product Owner decisions are now approved, Stage C cannot be declared fully closed and Stage D cannot be authorized until the following **Four Technical Closure Requirements** are satisfied:

1. **ProcessedMedia Tenant Ownership Remediation Design:**
   - *Issue:* The two-way `onDelete: SetNull` between `Lesson` and `ProcessedMedia` leaves media assets orphaned without a tenant derivation path upon lesson deletion.
   - *Technical Closure Specification:*
     - Add direct `institutionId String?` column to `ProcessedMedia` in Stage D schema migrations.
     - For active media (`lessonId IS NOT NULL`), derive `institutionId` from `Lesson -> Course -> institutionId`.
     - For orphaned media (`lessonId IS NULL`), attempt audit matching against `VideoUpload`. If ownership cannot be established with defensible evidence, **isolate in `MigrationQuarantine` with `institutionId = NULL` under Option 7D indefinite cold archival**. Zero synthetic tenant assignment. Both database rows and S3/MinIO objects are preserved intact without destructive deletion.
     - Replace `onDelete: SetNull` on `ProcessedMedia.lessonId` with `onDelete: Restrict` (or soft delete) in Stage D.
2. **PostgreSQL Connection Ingress Freeze & Role Security Substantiation:**
   - *Issue:* Table locks alone do not prevent connection pools from creating new active sessions during backfill.
   - *Technical Closure Specification:*
     - Engine-level connection freeze: In Step 2b, execute `REVOKE CONNECT ON DATABASE "ox_digital" FROM app_user, prisma_user;` and restore in Step 11 (`GRANT CONNECT ...`).
     - Role privilege substantiation: Direct login identity `ox_migrator` (no intermediate role needed; trigger verifies `SESSION_USER = 'ox_migrator'`).
     - Object ownership: All `SECURITY DEFINER` functions, triggers, and migration tracking tables owned strictly by `postgres` (or trusted schema superuser). Application roles possess zero DDL privileges and cannot execute `DISABLE TRIGGER`.
     - Secure path: Functions declare `SET search_path = pg_catalog, pg_temp;` and fully schema-qualify all user relation references.
3. **Table-by-Table Tenant & Branch Ownership Validation Mapping:**
   - Complete verification that all 27 business domain tables (and 1 platform table) have explicit relational lineage paths, non-null assertions, and foreign-key integrity constraints mapped in the 10-point validation matrix (Section 5.4).
4. **Staging Data Volume Benchmarking:**
   - Prior to scheduling production cutover, execute mock backfills on a Staging environment populated with production-representative data volumes to establish the empirical duration of lock acquisition, batch updates, and index builds.

---

### 8.5 Items Safely Deferrable to Later Tasks
- **OD-709:** Approval Limits & Financial Delegation (deferred to Task 7.4).
- **OD-712:** Multi-Currency Architecture (deferred; provisional EGP used for Task 7.1).
- **OD-713:** Legal Entity Structure (deferred; single-institution governance in Task 7.1 stands alone).
- **OD-714:** Tax Invoice Readiness (deferred to Task 7.3).
