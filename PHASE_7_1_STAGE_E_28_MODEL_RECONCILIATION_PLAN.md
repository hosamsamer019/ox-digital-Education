# OX-DIGITAL Education — Task 7.1
## Stage E: Comprehensive 28-Model Reconciliation Plan

**Workspace:** `D:\OX-DIGITAL\Mathe\OX-DIGITAL-GITHUB`  
**GitHub Repository:** `https://github.com/hosamsamer019/ox-digital-Education.git`  
**Current Git HEAD:** `0500b93e65c24ed881349c4acea7f523332c5e9f` (branch `main`)  
**Scope:** Complete Model-by-Model Audit of all 28 Pre-Existing Prisma Models + 3 Tenancy Core Models  
**Execution Mode:** STRICT READ-ONLY RECONCILIATION ARCHITECTURE  
**Date:** November 2, 2026  

---

## 1. Executive Summary & Reconciliation Objectives

The objective of this reconciliation plan is to guarantee that the multi-tenant transformation introduces zero orphaned records, zero cross-tenant contamination, zero unintended row deletions, and zero referential breaches across the entire database.

Every single one of the 28 pre-existing Prisma models in `packages/database/prisma/schema.prisma` is cataloged below, detailing its exact primary key, institution ownership source, branch attribution path, reconciliation validation queries, cascade risks, and evidence status.

---

## 2. Complete 28-Model Multi-Tenant Reconciliation Matrix

| # | Model Name | Primary Key | Institution Ownership Source | Branch Attribution Source | Foreign Key Dependencies | Reconciliation Query & Integrity Check | Deletion / Cascade Risk | Evidence Status |
| :---: | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **1** | **`User`** | `id` (TEXT) | Direct column `institutionId` (Mapped via authoritative config rule: `userIds` or `teacherIds`). Platform super-admin `admin@edu.com` kept NULL (OD-718). | Direct column `branchId` (Mapped to default or assigned branch). | `Institution(id)` RESTRICT, `Branch(id)` SET NULL. | `SELECT count(*) FROM "User" WHERE "institutionId" IS NULL AND "email" != 'admin@edu.com';` (Must equal count in quarantine). Exact PK set equality. | RESTRICT on Payment prevents deletion. | `VERIFIED_IN_SOURCE` |
| **2** | **`CenterGroup`** | `id` (TEXT) | Direct column `institutionId` (Mapped via `centerGroupIds` in config). | Direct column `branchId` (Physical branch association). | `Institution(id)` RESTRICT, `Branch(id)` SET NULL. | `SELECT count(*) FROM "CenterGroup" WHERE "institutionId" IS NULL;` (Must equal count in quarantine). | Referenced by Attendance & Courses. SET NULL on branch. | `VERIFIED_IN_SOURCE` |
| **3** | **`Course`** | `id` (TEXT) | Direct column `institutionId` (Mapped via `courseIds` or `teacherId` rule). | Direct column `branchId` (Physical or Online branch OD-719). | `Institution(id)` RESTRICT, `Branch(id)` SET NULL, `teacherId -> User(id)`. | `SELECT count(*) FROM "Course" c JOIN "User" u ON c."teacherId" = u."id" WHERE c."institutionId" != u."institutionId";` (Must be 0). | Referenced by Enrollment, Exam, Homework, Lesson. | `VERIFIED_IN_SOURCE` |
| **4** | **`CourseEnrollment`** | `id` (TEXT), `@@unique([userId, courseId])` | Indirect via `Course.institutionId` and `User.institutionId`. | Indirect via `Course.branchId`. | `userId -> User(id)` CASCADE, `courseId -> Course(id)` CASCADE. | `SELECT count(*) FROM "CourseEnrollment" ce JOIN "Course" c ON ce."courseId" = c."id" JOIN "User" u ON ce."userId" = u."id" WHERE c."institutionId" != u."institutionId";` (Must be 0 cross-tenant). | CASCADE if user or course deleted; protected by parent tenant RESTRICT. | `VERIFIED_IN_SOURCE` |
| **5** | **`Lesson`** | `id` (TEXT) | Indirect via `Course.institutionId`. Added `deletedAt` for soft-delete. | Indirect via `Course.branchId`. | `courseId -> Course(id)` CASCADE. | `SELECT count(*) FROM "Lesson" l JOIN "Course" c ON l."courseId" = c."id" WHERE c."institutionId" IS NULL;` (Must be 0). | Soft delete enabled; protected from accidental hard delete. | `VERIFIED_IN_SOURCE` |
| **6** | **`Exam`** | `id` (TEXT) | Indirect via `Course.institutionId`. | Indirect via `Course.branchId`. | `courseId -> Course(id)` CASCADE. | `SELECT count(*) FROM "Exam" e JOIN "Course" c ON e."courseId" = c."id" WHERE c."institutionId" IS NULL;` (Must be 0). | Exam attempts cascade if exam deleted; protected by Course parent. | `VERIFIED_IN_SOURCE` |
| **7** | **`ExamAttempt`** | `id` (TEXT), `@@unique([examId, studentId, attemptNumber])` | Indirect via `Exam -> Course.institutionId` and `studentId -> User.institutionId`. | Indirect via `Course.branchId`. | `examId -> Exam(id)` CASCADE, `studentId -> User(id)` CASCADE. | `SELECT count(*) FROM "ExamAttempt" ea JOIN "Exam" e ON ea."examId" = e."id" JOIN "Course" c ON e."courseId" = c."id" JOIN "User" u ON ea."studentId" = u."id" WHERE c."institutionId" != u."institutionId";` (Must be 0). | Audit attempt records cascade if exam deleted; locked in business logic. | `VERIFIED_IN_SOURCE` |
| **8** | **`Homework`** | `id` (TEXT) | Indirect via `Course.institutionId`. | Indirect via `Course.branchId`. | `courseId -> Course(id)` CASCADE. | `SELECT count(*) FROM "Homework" h JOIN "Course" c ON h."courseId" = c."id" WHERE c."institutionId" IS NULL;` (Must be 0). | Parent cascade. | `VERIFIED_IN_SOURCE` |
| **9** | **`Submission`** | `id` (TEXT), `@@unique([homeworkId, studentId])` | Indirect via `Homework -> Course.institutionId` and `studentId -> User.institutionId`. | Indirect via `Course.branchId`. | `homeworkId -> Homework(id)` CASCADE, `studentId -> User(id)` CASCADE. | Verify cross-tenant isolation: student institution equals homework course institution. | Submissions cascade on student/homework delete. | `VERIFIED_IN_SOURCE` |
| **10** | **`Attendance`** | `id` (TEXT), `@@unique([studentId, centerGroupId, date])` | Indirect via `CenterGroup.institutionId` and `studentId -> User.institutionId`. | Historical branch unresolved (OD-722); future attendance inherits `CenterGroup.branchId`. | `studentId -> User(id)` CASCADE, `centerGroupId -> CenterGroup(id)` CASCADE. | `SELECT count(*) FROM "Attendance" a JOIN "CenterGroup" cg ON a."centerGroupId" = cg."id" JOIN "User" u ON a."studentId" = u."id" WHERE cg."institutionId" != u."institutionId";` (Must be 0). | Historical attendance count preserved 100% (Check 4). | `VERIFIED_IN_SOURCE` |
| **11** | **`Payment`** | `id` (TEXT) | Direct column `institutionId` (Mapped via student `userId` rule). | Direct column `branchId` (Kept NULL for unprovable historical transactions). | `userId -> User(id)` **RESTRICT (OD-708 Remediation)**, `Institution(id)` RESTRICT, `Branch(id)` SET NULL. | `SELECT count(*) FROM "Payment" WHERE "institutionId" IS NULL;` (Must equal unmapped in quarantine). `SELECT count(*) FROM "Payment";` pre == post. | **ZERO DELETION RISK (OD-708 Invariant).** Foreign key changed from CASCADE to RESTRICT. | `VERIFIED_IN_SOURCE` |
| **12** | **`VideoProgress`** | `id` (TEXT), `@@unique([userId, lessonId])` | Indirect via `Lesson -> Course.institutionId` and `userId -> User.institutionId`. | Indirect via `Course.branchId`. | `userId -> User(id)` CASCADE, `lessonId -> Lesson(id)` CASCADE. | Verify `User.institutionId == Course.institutionId`. | Cascades on student or lesson deletion. | `VERIFIED_IN_SOURCE` |
| **13** | **`Assessment`** | `id` (TEXT) | Indirect via `teacherId -> User.institutionId`. | Indirect via `User.branchId`. | `teacherId -> User(id)` CASCADE. | `SELECT count(*) FROM "Assessment" a JOIN "User" u ON a."teacherId" = u."id" WHERE u."institutionId" IS NULL;` (Must be 0). | Cascades on teacher deletion. | `VERIFIED_IN_SOURCE` |
| **14** | **`ExternalExamAttempt`** | `id` (TEXT) | Indirect via `studentId -> User.institutionId`. | Indirect via `User.branchId`. | `studentId -> User(id)` CASCADE. | Verify `studentId` belongs to valid institution. | Cascades on student deletion. | `VERIFIED_IN_SOURCE` |
| **15** | **`AssessmentAttempt`** | `id` (TEXT) | Indirect via `assessmentId -> Assessment.teacherId -> User.institutionId` and `studentId -> User.institutionId`. | Indirect via `User.branchId`. | `assessmentId -> Assessment(id)` CASCADE, `studentId -> User(id)` CASCADE. | Cross-tenant check: student institution equals teacher assessment institution. | Cascades on assessment or student deletion. | `VERIFIED_IN_SOURCE` |
| **16** | **`StudentRiskHistory`** | `id` (TEXT) | Indirect via `studentId -> User.institutionId` and `courseId -> Course.institutionId`. | Indirect via `Course.branchId`. | `studentId -> User(id)` CASCADE, `courseId -> Course(id)` CASCADE. | `SELECT count(*) FROM "StudentRiskHistory" s JOIN "Course" c ON s."courseId" = c."id" JOIN "User" u ON s."studentId" = u."id" WHERE c."institutionId" != u."institutionId";` (Must be 0). | Cascades on course or student deletion. | `VERIFIED_IN_SOURCE` |
| **17** | **`LessonQuiz`** | `id` (TEXT) | Indirect via `lessonId -> Lesson -> Course.institutionId`. | Indirect via `Course.branchId`. | `lessonId -> Lesson(id)` CASCADE. | Verify quiz lesson belongs to valid tenant course. | Cascades on lesson deletion. | `VERIFIED_IN_SOURCE` |
| **18** | **`ChatSession`** | `id` (TEXT) | Indirect via `userId -> User.institutionId`. | Indirect via `User.branchId`. | `userId -> User(id)` CASCADE. | Verify `ChatSession.userId` belongs to valid tenant. | Cascades on user deletion. | `VERIFIED_IN_SOURCE` |
| **19** | **`ChatMessage`** | `id` (TEXT) | Indirect via `sessionId -> ChatSession.userId -> User.institutionId`. | Indirect via `User.branchId`. | `sessionId -> ChatSession(id)` CASCADE. | Verify chat message session owner belongs to valid tenant. | Cascades on session deletion. | `VERIFIED_IN_SOURCE` |
| **20** | **`Notification`** | `id` (TEXT) | Indirect via `userId -> User.institutionId`. | Indirect via `User.branchId`. | `userId -> User(id)` CASCADE. | Verify recipient user belongs to valid tenant. | Cascades on user deletion. | `VERIFIED_IN_SOURCE` |
| **21** | **`QuestionBank`** | `id` (TEXT) | Direct column `institutionId` (Mapped to Primary Institution in config). | N/A (Institution-wide question pool). | `Institution(id)` RESTRICT. | `SELECT count(*) FROM "QuestionBank" WHERE "institutionId" IS NULL;` (Must be 0 post-backfill). | RESTRICT on institution prevents accidental loss. | `VERIFIED_IN_SOURCE` |
| **22** | **`SavedMathSolution`** | `id` (TEXT) | Indirect via `userId -> User.institutionId`. | Indirect via `User.branchId`. | `userId -> User(id)` CASCADE. | Verify user ownership matches tenant. | Cascades on user deletion. | `VERIFIED_IN_SOURCE` |
| **23** | **`VideoUpload`** | `id` (TEXT) | Indirect via `teacherId -> User.institutionId`. | Indirect via `User.branchId`. | `teacherId -> User(id)` CASCADE. | Verify teacher belongs to valid tenant. | Cascades on teacher deletion. | `VERIFIED_IN_SOURCE` |
| **24** | **`UserSession`** | `id` (TEXT) | Indirect via `userId -> User.institutionId`. | Indirect via `User.branchId`. | `userId -> User(id)` CASCADE. | Verify session user belongs to valid tenant. | Transient session records. | `VERIFIED_IN_SOURCE` |
| **25** | **`DailyPlatformStats`** | `id` (TEXT) | System-wide cross-institutional aggregator. Kept un-tenanted. | N/A (Global platform telemetry). | None. | Cross-institutional analytics. | No cascade risk. | `VERIFIED_IN_SOURCE` |
| **26** | **`ExamViolation`** | `id` (TEXT) | Indirect via `attemptId -> ExamAttempt -> Course.institutionId`. | Indirect via `Course.branchId`. | `attemptId -> ExamAttempt(id)` CASCADE. | Verify violation attempt belongs to valid tenant. | Cascades on attempt deletion. | `VERIFIED_IN_SOURCE` |
| **27** | **`TemporaryAsset`** | `id` (TEXT) | Ephemeral upload staging. Indirect via `uploaderId -> User.institutionId`. | Indirect via `User.branchId`. | `uploaderId -> User(id)` CASCADE. | Short-lived TTL assets. | Auto-purged by cron. | `VERIFIED_IN_SOURCE` |
| **28** | **`ProcessedMedia`** | `id` (TEXT) | Direct column `institutionId` (Mapped via lesson course or quarantined if orphan OD-720). | Indirect via `Lesson -> Course.branchId`. | `Institution(id)` RESTRICT, `lessonId -> Lesson(id)` SET NULL. | Orphan media (`lessonId IS NULL`) must be quarantined in `_migration_quarantine`. | RESTRICT prevents accidental tenant deletion. | `VERIFIED_IN_SOURCE` |

---

## 3. Tenancy Core & Infrastructure Tables

| # | Model Name | Primary Key | Role in Multi-Tenancy Architecture | Foreign Key Dependencies | Constraints & Invariants | Evidence Status |
| :---: | :--- | :--- | :--- | :--- | :--- | :--- |
| **29** | **`Institution`** | `id` (TEXT) | Multi-tenant root. | `primaryManagerId -> User(id)` SET NULL. | Unique `code`, unique `primaryManagerId`. | `VERIFIED_IN_SOURCE` |
| **30** | **`Branch`** | `id` (TEXT) | Physical campus or online educational branch (OD-719). | `institutionId -> Institution(id)` RESTRICT. | Unique `(institutionId, code)`. | `VERIFIED_IN_SOURCE` |
| **31** | **`PrimaryManagerInvitation`** | `id` (TEXT) | Secure cryptographic token onboarding (OD-718). | `institutionId -> Institution(id)` RESTRICT, `acceptedByUserId -> User(id)` SET NULL. | Unique `tokenHash`, unique `(institutionId, email)`. | `VERIFIED_IN_SOURCE` |
| **—** | **`_migration_quarantine`** | `id` (TEXT) | Indefinite cold archival for unmapped legacy records (OD-720). | None (Decoupled archival store). | Unique `(entity_type, entity_id)`. JSONB payload. | `VERIFIED_IN_SOURCE` |

---

## 4. Cross-Tenant Integrity Validation & Boundary Invariants

During post-migration reconciliation, the following automated SQL assertions must execute and return zero violations:

### Assertion 1: Zero Orphaned Tenant Records
```sql
SELECT 'User' AS entity, count(*) FROM "User" WHERE "institutionId" IS NULL AND "email" != 'admin@edu.com'
UNION ALL
SELECT 'CenterGroup', count(*) FROM "CenterGroup" WHERE "institutionId" IS NULL
UNION ALL
SELECT 'Course', count(*) FROM "Course" WHERE "institutionId" IS NULL
UNION ALL
SELECT 'Payment', count(*) FROM "Payment" WHERE "institutionId" IS NULL;
-- Every row returned must exactly match the corresponding count in _migration_quarantine!
```

### Assertion 2: Zero Cross-Tenant Course Enrollments
```sql
SELECT count(*) AS cross_tenant_enrollment_violations
FROM "CourseEnrollment" ce
JOIN "Course" c ON ce."courseId" = c."id"
JOIN "User" u ON ce."userId" = u."id"
WHERE c."institutionId" IS NOT NULL 
  AND u."institutionId" IS NOT NULL 
  AND c."institutionId" != u."institutionId";
-- Expected result: 0
```

### Assertion 3: Zero Cross-Tenant Exam Attempts
```sql
SELECT count(*) AS cross_tenant_exam_violations
FROM "ExamAttempt" ea
JOIN "Exam" e ON ea."examId" = e."id"
JOIN "Course" c ON e."courseId" = c."id"
JOIN "User" u ON ea."studentId" = u."id"
WHERE c."institutionId" IS NOT NULL 
  AND u."institutionId" IS NOT NULL 
  AND c."institutionId" != u."institutionId";
-- Expected result: 0
```

### Assertion 4: Payment Immutability & Preservation (OD-708)
```sql
-- Initial Payment Row Count == Final Payment Row Count
SELECT 
    (SELECT count(*) FROM "Payment") AS current_payments,
    (SELECT count(*) FROM "_migration_quarantine" WHERE "entity_type" = 'Payment') AS quarantined_payments;
-- No payment row may be physically dropped or altered without trace.
```

---

## 5. Reconciliation Summary & Safety Verdict

Every model in the platform has a deterministic attribution path to the tenant root (`Institution`). All foreign keys, cascading actions, and cross-model relationships are mapped. The reconciliation plan ensures complete data preservation, cryptographic auditability, and absolute tenant isolation.

