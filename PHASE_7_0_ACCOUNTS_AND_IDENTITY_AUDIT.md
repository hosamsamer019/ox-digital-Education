# PHASE 7.0 — ACCOUNTS AND IDENTITY MANAGEMENT AUDIT
**Product:** OX-DIGITAL Education  
**Workspace:** `D:\OX-DIGITAL\Mathe\OX-DIGITAL-GITHUB`  
**Audit Date:** November 2026  
**Status:** COMPLETE (READ-ONLY FORENSIC AUDIT)

---

## 1. Executive Summary

This forensic audit evaluates the identity, account management, authorization, and data ownership structures of the OX-DIGITAL platform in its current state (`packages/database/prisma/schema.prisma`, `services/auth-service`, `services/user-service`, and `apps/frontend`). 

The objective is to determine whether the existing identity and account models can support **institutional financial ownership**, **multi-branch role-based permissions**, **cash collection accountability**, and **auditable financial transaction lifecycles**.

### Core Verdict
The current identity implementation is designed for a **single-institution, monolithic academic application** centered on course delivery and attendance. It **completely lacks**:
1. Multi-tenant institution scoping (`institutionId`).
2. Multi-branch organizational hierarchy (`branchId`).
3. Financial role segregation (e.g., Accountant, Cashier, Financial Auditor, Billing Manager).
4. Account lifecycle controls (no `isActive`, `status`, or deactivation states; only destructive deletion).
5. Immutable financial transaction preservation (account deletion cascades and permanently destroys payment records).
6. Dedicated financial audit logs.

---

## 2. Inventory of Current Models and Enums

### 2.1 Database Schema (`packages/database/prisma/schema.prisma`)

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

  // Unified Assessments
  teacherAssessments Assessment[]        @relation("TeacherAssessments")
  assessmentAttempts AssessmentAttempt[]
}
```

### 2.2 Account Analysis by Role

| Role Enum | Description in Codebase | Financial / Ownership Capability | Forensic Evaluation |
| :--- | :--- | :--- | :--- |
| `ADMIN` | Superuser with unrestricted global system access. | Can view global analytics revenue and execute destructive user deletes. | **Unscoped**. Acts as both platform maintainer and educational center manager. Cannot be restricted to branch or institutional finances. |
| `TEACHER` | Instructs courses, creates exams, and views assigned courses. | Can view student academic risk, but has no revenue-share, payroll, or compensation data. | Has no salary, commission rate, billing ledger, or branch assignment. |
| `ONLINE_STUDENT` | Remote student who purchases courses online. | Direct payer in `Payment` model linked via `userId`. | Has no billing balance, invoice history, subscription term, or installment plan. |
| `CENTER_STUDENT` | Physical student attending a local educational center. | Linked to `CenterGroup` via `centerGroupId`. | Has no center tuition ledger, physical cash receipt record, or tuition discount schedule. |
| `PARENT` | Self-contained parent account linked to children via `parentId`. | Currently views academic progress; subscription tab displays "Coming Soon". | Cannot act as the legal billing party responsible for invoices, receipts, or corporate billing. |

---

## 3. Account Lifecycle & Workflows

### 3.1 Public Registration vs. Administrative Provisioning
- **Location:** `services/auth-service/src/controllers/auth.controller.ts` (Lines 32–36)
- **Current Behavior:**
  ```typescript
  export const register = async (req: Request, res: Response) => {
    return res.status(403).json({ 
      message: 'Public registration is disabled. Please contact an administrator to create an account.' 
    });
  };
  ```
- **Finding:** Public self-registration is explicitly disabled by product decision. All accounts are manually provisioned by administrators via `services/user-service/src/controllers/user.controller.ts` (`createUser`).
- **Financial Implication:** Because public checkout and self-service registration are disabled, financial accounts (students, parents, center groups) must be provisioned through administrative staff. There is currently no workflow for:
  - Capturing initial registration fees.
  - Setting up billing agreements or subscription contracts upon account creation.
  - Recording the cashier or administrator responsible for collecting the physical registration deposit.

### 3.2 Authentication, Password Management & Session Security
- **Authentication:** JWT tokens issued in `auth-service` with 7-day expiration (`jwt.sign({ userId, email, role }, JWT_SECRET, { expiresIn: '7d' })`).
- **Session Tracking:** `UserSession` model tracks token, IP address, user agent, and expiration.
- **Rate Limiting:** IP-based rate limiting on `/login` (5 requests/15 min) and password reset.
- **Critical Financial Defect:** JWT payload contains only `{ userId, email, role }`. It does not contain `institutionId`, `branchId`, or financial permission scopes (`canRefund`, `canCollectCash`, `canPostJournal`). Any token issued remains valid even if a cashier is reassigned to another branch.

### 3.3 Account Status & Deactivation Controls
- **Finding:** The `User` model lacks an `isActive`, `status`, or `suspendedAt` boolean/enum.
- **Financial Implication:** If a student defaults on fees or an employee leaves the institution, administrators cannot "suspend" or "freeze" the account. The system only provides password change or complete database deletion.

---

## 4. Critical Defect: Financial Destruction via Account Deletion

### 4.1 Cascade Deletion Architecture
In `packages/database/prisma/schema.prisma`:
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

  @@index([userId])
}
```

### 4.2 Deletion Implementation in `user.controller.ts`
Lines 142–175 of `services/user-service/src/controllers/user.controller.ts`:
```typescript
export const deleteUser = async (req: AuthRequest, res: Response) => {
  // ...
  await tx.user.delete({ where: { id } });
  // ...
};
```
Furthermore, `getDeletionImpact` (Lines 180–230) explicitly calculates how many `payments` will be destroyed:
```typescript
const users = await db.user.findMany({
  where: { id: { in: targetUserIds } },
  select: {
    _count: {
      select: {
        taughtCourses: true,
        enrollments: true,
        examAttempts: true,
        payments: true,       // <--- Payments counted for destruction
        submissions: true,
        attendances: true,
      }
    }
  }
});
```

### 4.3 Forensic Assessment of Risk
> [!CAUTION]
> **Severe Statutory and Accounting Violation:**
> In double-entry bookkeeping and statutory accounting standards (IFRS / Egyptian Accounting Standards), financial transactions are permanent legal records. Deleting a student account triggers a cascading `DELETE FROM "Payment" WHERE "userId" = ?`, which permanently destroys receipts, audit trails, and bank reconciliation evidence. 

---

## 5. Relational Mapping Audit

```
┌─────────────────────────────────────────────────────────────┐
│                       CURRENT STATE                         │
│                                                             │
│  [User: Parent] ──(parentId)──> [User: Student]             │
│                                      │                      │
│                                      ├──(centerGroupId)──> [CenterGroup]  (No branch, no fee)
│                                      │                      │
│                                      ├──(enrollment)─────> [Course] ◄──(teacherId)── [User: Teacher]
│                                      │                      │
│                                      └──(userId)─────────> [Payment]      (No invoice, cascade delete)
└─────────────────────────────────────────────────────────────┘
```

### Key Gaps Identified:
1. **No Institutional Tenant:** No entity ties `User` to an educational institution or commercial customer.
2. **No Branch Anchor:** Center students are assigned to a `CenterGroup`, but `CenterGroup` has no branch, facility, or geographical anchor.
3. **No Financial Counterparty:** A student is modeled strictly as a learner, not as a customer/debtor with a sub-ledger account.
4. **No Financial Hierarchy:** There is no separation between the billing contact (e.g., Parent or Corporate Sponsor) and the beneficiary (Student).

---

## 6. Audit Logging & Traceability

1. **Database Audit Tables:** None. No `AuditLog`, `SecurityLog`, or `FinancialLog` table exists in PostgreSQL.
2. **Application Logging:** Events are logged to standard output / Winston files (`packages/shared/src/logger.ts`), which are ephemeral, unindexed, and non-queryable by financial auditors.
3. **User Action Attribution:** `Payment` records have no `createdByUserId` or `cashierId`. It is impossible to know which staff member received cash or issued a refund.

---

## 7. Conclusions and Mandatory Remediation for Phase 7

1. **Introduce Soft-Delete and Status Lifecycle:** Add `AccountStatus` (`ACTIVE`, `SUSPENDED`, `ARCHIVED`) to `User`. Remove `onDelete: Cascade` on financial records; replace with strict foreign-key protection (`onDelete: Restrict`).
2. **Tenant and Branch Scoping:** Add `institutionId` and optional `branchId` to all identity and administrative records.
3. **Granular Financial Roles & Permissions:** Replace the monolithic `Role` enum with role-based permission sets (`ACCOUNTING_MANAGER`, `BRANCH_CASHIER`, `AUDITOR`, `ACADEMIC_ADMIN`).
4. **Billing Entity Separation:** Formally decouple the "Student Profile" (academic learner) from the "Customer Account" (financial billing entity / debtor ledger).

