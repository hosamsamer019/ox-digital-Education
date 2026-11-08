# PHASE 7.1 — CURRENT-STATE ARCHITECTURE AUDIT
**Product:** OX-DIGITAL Education  
**Workspace:** `D:\OX-DIGITAL\Mathe\OX-DIGITAL-GITHUB`  
**Repository:** `https://github.com/hosamsamer019/ox-digital-Education.git`  
**Audit Date:** November 2026 (Stage C Final Refinement)  
**Execution Mode:** READ-ONLY FORENSIC AUDIT (PHASE 7.1 PRE-IMPLEMENTATION)

---

## 1. Executive Summary

This forensic audit establishes the complete baseline architectural state of the OX-DIGITAL Education codebase across `packages/database`, `packages/shared`, `services/auth-service`, `services/user-service`, `services/course-service`, `services/analytics-service`, and `apps/frontend`.

The audit was performed under strictly read-only execution boundaries to prepare the foundation for **Task 7.1: Institution, Branch & Identity Foundation** in compliance with approved Product Owner decisions **OD-701** (Institution Governance & Single Primary Manager), **OD-702** (Domain Separation), **OD-703** (Unified General Ledger with Branch Dimensions), and **OD-708** (Payment Deletion Protection Invariant).

### Forensic Verdict
The existing codebase operates on a **flat, single-institution, single-teacher monolithic paradigm**:
1. **Zero Tenant Identifiers Across 28 Database Models:** None of the 28 persistent models in `packages/database/prisma/schema.prisma` possess an `institutionId` or `branchId` column.
2. **Global Admin Privilege Escalation:** Any account with the `ADMIN` role is treated as an omnipotent platform superuser. All administrative queries execute without tenant boundaries (e.g., `db.user.findMany({})`, `db.course.delete({ where: { id } })`). If multiple institutions were onboarded today, an administrator from Institution A would be able to view, edit, or delete all students, courses, exams, and financials of Institution B.
3. **Catastrophic Financial & Academic Cascade Destruction:** Account deletion in `services/user-service/src/controllers/user.controller.ts` executes physical database deletion (`tx.user.delete`). PostgreSQL foreign-key cascades (`onDelete: Cascade`) permanently destroy legal payment records, attendances, exam attempts, and submissions.
4. **Financial Domain Co-Mingling (OD-702 Defect):** Student course tuition payments are summed globally as "Total Revenue" in `services/analytics-service/src/controllers/analytics.controller.ts`, co-mingling institutional collections (Domain B) with SaaS commercial finances (Domain A).
5. **Unpartitioned Infrastructure:** WebSockets join shared global rooms (`'admin'`, `'teachers'`), BullMQ background workers iterate across all database records globally, and S3/R2 storage paths are keyed solely by `userId` without institutional partitioning.

---

## 2. Identity and Authentication Audit

### 2.1 The Existing `User` Model (`packages/database/prisma/schema.prisma`)

```prisma
enum Role {
  ADMIN
  TEACHER
  ONLINE_STUDENT
  CENTER_STUDENT
  PARENT
}

model User {
  id             String              @id @default(uuid())
  email          String              @unique
  password       String
  name           String
  createdAt      DateTime            @default(now())
  centerGroupId  String?
  parentId       String?
  updatedAt      DateTime            @updatedAt
  role           Role
  academicLevel  AcademicLevel?
  country        CountryCode?
  educationLevel EducationLevel?
  gradeLevel     GradeLevel?
  language       String              @default("ar")
  phone          String?
  isGuest        Boolean             @default(false)
  
  // Relations
  attendances    Attendance[]
  chatSessions   ChatSession[]
  taughtCourses  Course[]            @relation("TeacherCourses")
  enrollments    CourseEnrollment[]
  examAttempts   ExamAttempt[]
  notifications  Notification[]
  payments       Payment[]
  questionBank   QuestionBank[]
  mathSolutions  SavedMathSolution[]
  submissions    Submission[]
  centerGroup    CenterGroup?        @relation(fields: [centerGroupId], references: [id])
  parent         User?               @relation("ParentChildren", fields: [parentId], references: [id])
  children       User[]              @relation("ParentChildren")
  sessions       UserSession[]
  videoProgress  VideoProgress[]
  videoUploads   VideoUpload[]

  teacherAssessments Assessment[]    @relation("TeacherAssessments")
  assessmentAttempts AssessmentAttempt[]
}
```

#### Forensic Deficiencies in `User`:
- **No Institutional Scoping:** No foreign key to `Institution`. A user exists in a global flat namespace. Global platform administrators currently have no tenant boundary and do not inherently belong to any specific educational institution.
- **No Branch Assignment:** Physical students can be linked to a `centerGroupId`, but `CenterGroup` has no branch link. Teachers and staff have no branch membership.
- **No Account Lifecycle / Status:** No `isActive`, `status`, or `deletedAt` column. Deactivating an account without deleting it is impossible; only destructive deletion exists.
- **No Delegated Financial / Operational Roles:** The `Role` enum is coarse and academic. Specialized roles approved in Phase 7.0 (e.g., `BRANCH_CASHIER`, `BRANCH_ACCOUNTANT`, `FINANCE_MANAGER`) cannot be represented.

### 2.2 Token Issuance & Claims (`services/auth-service/src/controllers/auth.controller.ts`)

In `auth.controller.ts` (Lines 60–76):
```typescript
if (!process.env.JWT_SECRET || !process.env.REFRESH_TOKEN_SECRET) {
  throw new Error('FATAL ERROR: JWT_SECRET or REFRESH_TOKEN_SECRET is not defined');
}

// Short-lived access token (15 minutes)
const token = jwt.sign(
  { userId: user.id, role: user.role, email: user.email },
  process.env.JWT_SECRET,
  { expiresIn: '15m' }
);
```

#### Forensic Deficiencies in Tokens:
- **Missing Tenant Context:** The JWT payload contains only `{ userId, role, email }`.
- **Zero Scope Validation:** When any downstream service receives this token, it has no cryptographic proof of which institution or branch the user belongs to.
- **Client Forgery Vulnerability:** Any service attempting to determine `institutionId` must either execute an extra database lookup per HTTP request or trust a client-supplied header (`X-Institution-Id`), creating an immediate Insecure Direct Object Reference (IDOR) vulnerability.
- **Stale Token Vulnerability:** A 15-minute JWT cannot be invalidated mid-flight if a user's role, institution membership, or active status is revoked, because there is no `tokenVersion` or authoritative server-side check.

---

## 3. Consolidated Deletion-Impact Matrix & Data Destruction Analysis

A deep forensic inspection across controllers and Prisma relations reveals multiple destructive deletion cascades:

### 3.1 Physical User Deletion Routine (`user.controller.ts`, lines 669–713)

```typescript
export const deleteUser = async (req: AuthRequest, res: Response) => {
  try {
    const requesterRole = (req.user?.role || '').toUpperCase();
    if (requesterRole !== 'ADMIN') {
      return res.status(403).json({ message: 'Only admins can delete users' });
    }
    const { id } = req.params;
    
    await db.$transaction(async (tx) => {
        if (id === req.user?.userId) {
            throw new Error('Cannot delete your own account');
        }
        
        const user = await tx.user.findUnique({ where: { id }, select: { role: true } });
        if (!user) throw new Error('User not found');
        
        if (user.role === 'ADMIN') {
            const totalAdmins = await tx.user.count({ where: { role: 'ADMIN' } });
            if (totalAdmins <= 1) throw new Error('Cannot delete the last remaining admin account');
        }
        
        await tx.assessment.deleteMany({
            where: { teacherId: id }
        });

        await tx.course.deleteMany({
            where: { teacherId: id }
        });

        await tx.user.updateMany({
            where: { parentId: id },
            data: { parentId: null }
        });
        
        await tx.user.delete({ where: { id } });
    });
    
    res.json({ message: 'User deleted successfully' });
  } catch (error: any) {
    // ...
  }
};
```

### 3.2 Consolidated Deletion-Impact Matrix

The following matrix documents every destructive path identified across the codebase, identifying the exact historical academic and financial records destroyed and proposing non-destructive lifecycle alternatives:

| Destructive Path & Trigger | Code Location & Mechanism | Direct Cascading Targets in Schema | Indirect Cascades | Historical Records Destroyed | Invariant Violation | Proposed Safe Lifecycle / Archival Alternative |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Path 1: User Deletion (Student / Parent)** | `user.controller.ts`<br/>`tx.user.delete({ where: { id } })` | `Payment`<br/>`Attendance`<br/>`CourseEnrollment`<br/>`ExamAttempt`<br/>`Submission`<br/>`VideoProgress`<br/>`ChatSession`<br/>`Notification`<br/>`UserSession` | `ExamAttempt` cascades to `ExamViolation`.<br/>`ChatSession` cascades to `ChatMessage`. | **Payment Receipts & History** (Legal financial audit trail destroyed).<br/>Attendance logs.<br/>Exam scores.<br/>Homework submissions. | **OD-708 Invariant Violation** (Destructive deletion of financial records). Academic continuity loss. | **Candidate Lifecycle Design:**<br/>1. Evaluate DB `onDelete: Restrict` on `Payment.user` to prevent destructive delete.<br/>2. Introduce `AccountStatus` (`ACTIVE`, `SUSPENDED`, `DEACTIVATED`, `ARCHIVED`). Replace delete with deactivation. |
| **Path 2: Teacher Deletion** | `user.controller.ts`<br/>`tx.course.deleteMany({ teacherId })`<br/>`tx.assessment.deleteMany({ teacherId })`<br/>`tx.user.delete` | `Course` (via `deleteMany`)<br/>`Assessment` (via `deleteMany`)<br/>`QuestionBank`<br/>`VideoUpload` | `Course` cascades to `Lesson`, `Homework`, `Exam`, `CourseEnrollment`.<br/>`Exam` cascades to `ExamAttempt` (ALL students).<br/>`Homework` cascades to `Submission` (ALL students).<br/>`Assessment` cascades to `AssessmentAttempt`, `ExternalExamAttempt`. | **All Course Content**.<br/>**All Students' Exam Attempts & Scores** across teacher's courses.<br/>**All Students' Homework Submissions**.<br/>Assessment questions and grading logs. | Catastrophic loss of academic student transcripts and accreditation data. | **Candidate Lifecycle Design:**<br/>1. Prevent physical deletion of teachers with active or historical courses (`onDelete: Restrict`).<br/>2. Course ownership transfer or course archival workflow. |
| **Path 3: Course Deletion** | `course.controller.ts` (lines 170–186)<br/>`db.course.delete({ where: { id } })` | `Lesson`<br/>`Homework`<br/>`Exam`<br/>`CourseEnrollment` | `Exam` cascades to `ExamAttempt` & `ExamViolation`.<br/>`Homework` cascades to `Submission`.<br/>`Lesson` cascades to `LessonQuiz`. | **All Student Submissions**.<br/>**All Student Exam Attempts**.<br/>Enrollment history.<br/>Lesson quizzes. | Academic audit trail destroyed for all enrolled students. | **Candidate Lifecycle Design:**<br/>1. Soft-delete / course archival status (`CourseStatus: ARCHIVED`).<br/>2. Forbid deletion if enrollments or submissions exist. |
| **Path 4: Assessment Deletion** | Assessment controllers<br/>`db.assessment.delete({ where: { id } })` | `AssessmentAttempt`<br/>`ExternalExamAttempt`<br/>`TemporaryAsset` | None | Student assessment attempts, scores, and external exam attempt logs. | Educational evaluation and grading records erased. | **Candidate Lifecycle Design:**<br/>Archive assessment; restrict deletion if attempts exist. |
| **Path 5: Bulk User Deletion** | `user.controller.ts` (lines 715–740)<br/>Iterative `tx.user.delete` in loop | Same as Path 1 & Path 2 for every target user ID | Same cascade tree as Path 1 & 2 | Mass destruction of payments, attendances, courses, exam attempts, and student submissions. | High-risk mass data loss. | **Candidate Lifecycle Design:**<br/>Replace bulk physical deletion with bulk status transition to `DEACTIVATED`. |

---

## 4. Financial Domain Co-Mingling Audit (OD-702)

### 4.1 Existing Payment Architecture & Webhooks
- In `packages/database/prisma/schema.prisma` (lines 211–225):
  ```prisma
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
  }
  ```
- In `services/analytics-service/src/controllers/stripe.webhook.ts`:
  Stripe checkout sessions directly create records in `db.payment.create(...)` on `checkout.session.completed`.
- In `services/analytics-service/src/controllers/analytics.controller.ts` (lines 83–94):
  ```typescript
  const successfulPayments = await db.payment.findMany({ where: { status: 'COMPLETED' }, select: { amount: true, date: true } });
  const totalRevenue = successfulPayments.reduce((sum, p) => sum + p.amount, 0);
  ```

### 4.2 Forensic Finding on Domain Co-Mingling:
1. **Flawed Revenue Aggregation:** Student course payments are summed globally as `totalRevenue`. There is zero distinction between OX-DIGITAL platform licensing fees (Domain A) and institution student collections (Domain B).
2. **Why adding `institutionId` alone is insufficient:**
   - The current `Payment` table records student course tuition and fees.
   - Under **OD-702**, OX-DIGITAL SaaS commercial revenue (Domain A) consists of platform licensing, seat fees, and institutional subscriptions.
   - Educational institutions collect student tuition, center fees, and attendance charges (Domain B).
   - If SaaS platform billing and institutional collections share the same un-partitioned table and dashboard queries, student tuition collected by an educational center appears as gross revenue on OX-DIGITAL SaaS financial statements.
   - **Resolution:** A complete domain separation requires recognizing `Payment` strictly as **Domain B (Institution Student Collection)** and maintaining independent, isolated records for **Domain A (Platform Commercial Finances)**. Neither domain may net, auto-settle, or co-mingle ledgers.

---

## 5. Communications, Background Jobs & Media Storage Isolation Audit

### 5.1 WebSocket Global Leakage (`services/course-service/src/index.ts`)
Lines 80–90:
```typescript
io.use(async (socket, next) => {
  // ...
  if (decoded.role === 'ADMIN') socket.join('admin');
  if (decoded.role === 'TEACHER') {
    socket.join('teachers');
    const courses = await db.course.findMany({ where: { teacherId: decoded.userId }, select: { id: true } });
    courses.forEach(c => socket.join(`course:${c.id}`));
  }
  // ...
});
```
- **Finding:** Every admin from every institution joins the shared room `'admin'`. Every teacher joins `'teachers'`.
- **Impact:** Any administrative broadcast event is received by all administrators across all institutions.

### 5.2 Background Worker Global Sweep (`services/course-service/src/jobs/riskEngine.job.ts`)
Lines 42–55:
```typescript
worker = new Worker('RiskEngineQueue', async (job: Job) => {
  const enrollments = await db.courseEnrollment.findMany({
    select: {
      id: true,
      studentId: true,
      courseId: true,
      // ...
    }
  });
  // Evaluates risk across entire database in a single unpartitioned pass
});
```
- **Finding:** BullMQ worker evaluates student enrollments globally without tenant partitioning, generating un-scoped notifications.

### 5.3 Storage Key Path Unpartitioned (`services/course-service/src/services/storage.adapter.ts`)
Lines 70–75:
```typescript
export async function generateSignedUploadUrl(userId: string, filename: string, mimetype: string, fileSize: number) {
  const ext = path.extname(filename);
  const uuidFilename = `${userId}/${randomUUID()}${ext}`;
  // ...
}
```
- **Finding:** Cloudflare R2 / S3 storage keys are formatted as `${userId}/${randomUUID()}.${ext}`.
- **Impact:** Buckets commingle private institutional assets without tenant folder boundaries.

### 5.4 ProcessedMedia & Lesson Bidirectional Lifecycle Forensic Audit
- **Exact Schema Evidence:** `packages/database/prisma/schema.prisma` lines 98–120 (`Lesson`), lines 636–670 (`ProcessedMedia`), and lines 626–634 (`ProcessedMediaStatus`).
- **Forensic Findings:**
  1. **Absence of Soft-Delete Fields:** `Lesson` contains **zero** `deletedAt` or `status` fields. `publishedAt DateTime?` is strictly a draft visibility toggle, NOT a soft-delete flag.
  2. **Enum Value Boundary:** `ProcessedMediaStatus` contains `PENDING, DOWNLOADING, TRANSCODING, COMPLETED, FAILED, SUPERSEDED, PURGING`. Neither `READY` nor `ARCHIVED` exists. `SUPERSEDED` is not an immutable or tamper-proof state without future Stage D triggers.
  3. **Bidirectional SetNull Nullification Trap:** Both `ProcessedMedia.lessonId -> Lesson.id` and `Lesson.activeMediaId -> ProcessedMedia.id` specify `onDelete: SetNull`. Physical deletion of a lesson nullifies `ProcessedMedia.lessonId`, severing tenant derivation and leaving untracked video renditions in cloud storage.
  4. **Source File Semantic Disconnection:** `ProcessedMedia.sourceFileId` stores the external Google Drive file ID (`services/course-service/src/services/driveIngestion.service.ts#L293-L308`), having zero relation to `VideoUpload.id` (`schema.prisma#L468-L483`). Historical orphaned media with `lessonId = NULL` have no verifiable tenant owner and must follow OD-720 Indefinite Cold Archival.
  5. **Physical Deletion Reality:** Physical deletion of `Lesson` remains fully possible through Prisma or SQL today. Restoring a deleted lesson assigns a new UUID, leaving prior orphaned media un-reconnectable without manual forensic recovery.

### 5.5 Database Infrastructure, Roles & Connection Pool Forensic Audit
- **Exact Configuration Evidence:** `docker-compose.production.yml` lines 298–315, `.env.production.example` lines 33–41, and `packages/database/src/index.ts` lines 13–23.
- **Forensic Findings:**
  1. **Configured Database Catalog:** Dedicated database name is `ox_digital_education` in production (`POSTGRES_DB=ox_digital_education`), `ox_digital_staging` in staging, and `ox_digital_dev` in development.
  2. **Configured Application Roles:** Backend services authenticate as `POSTGRES_USER=ox_admin` in production, `ox_staging_admin` in staging, and `postgres` in development. Placeholder names (`app_user`, `prisma_user`) are absent from repository configs.
  3. **Prisma Connection Pooling:** `packages/database/src/index.ts` appends `connection_limit=5` to `DATABASE_URL` in production, establishing persistent connection pools per microservice instance.
  4. **Superuser / Owner Bypass Vulnerability:** In standard PostgreSQL Docker deployments, `POSTGRES_USER=ox_admin` is provisioned as a superuser and database owner. Because superusers and database owners bypass database-level `CONNECT` privilege checks, `REVOKE CONNECT` alone is ineffective. A hardened connection freeze requires executing `ALTER ROLE ox_admin NOLOGIN;` in addition to revoking `CONNECT` from `PUBLIC`.
  5. **ACL Restoration Semantics:** When PostgreSQL databases are newly created, `datacl` in `pg_database` is `NULL` (default privileges apply). Post-cutover restoration must evaluate whether default or hardened ACLs were captured pre-freeze before granting privileges.

### 5.6 Historical Branch Attribution & Relational Provenance Audit
- **Course Ownership:** Courses are curriculum assets belonging to the migrated Institution (`target_institution_id`). While `teacherId` links a teacher, teacher departures, reassignments, or tenant mismatches do not alter the course's institutional ownership.
- **Attendance Branch Unprovability:** `Attendance` (`schema.prisma#L198-L210`) contains **only `studentId` and `date`**; it contains **zero `centerGroupId` or branch columns**. A student's *current* `centerGroupId` represents mutable present-day membership and cannot prove where attendance occurred historically. Historical attendance branch attribution must be recorded as **UNRESOLVED / NULL** rather than fabricated.
- **Payment Provenance:** `Payment` (`schema.prisma#L211-L230`) possesses a scalar `courseId String?` without relational foreign key constraints. Tenant ownership derives strictly via `Payment.userId -> User.institutionId`. Historical collection branch is unrecorded and must remain **UNRESOLVED / NULL** for cash transactions, while digital gateway payments are attributed to OD-719 Online Branch.

---

## 6. Audit Conclusions & Task 7.1 Scope Boundaries

1. **Decoupling Prerequisite:** **OD-713 (Legal Entity Structure) is NOT a prerequisite for Task 7.1.** Single-institution and branch governance (OD-701) must stand on its own.
2. **Payment Protection Invariant (OD-708):** Under no circumstance may Stage D implementation permit cascading deletion of `Payment` records.
3. **Data Preservation:** The retention and lifecycle design must protect both financial records (`Payment`) and academic records (`Course`, `Exam`, `Submission`, `ExamAttempt`).
4. **Mandatory Review Gate:** Stage A and B are completed. Refinements in response to Stage C review are documented below. Implementation (Stage D) is strictly unauthorized until Product Owner approval is received.
