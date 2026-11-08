# OX-DIGITAL Education — Phase 6.2C.5B
# Live Concurrency Integration Verification & Phase Closure Report

**Date:** 2026-11-02  
**Workspace:** `D:\OX-DIGITAL\Mathe\OX-DIGITAL-GITHUB`  
**Git Baseline:** `main @ 0500b93e65c24ed881349c4acea7f523332c5e9f`  
**Execution Context:** `ox-digital-course-service` within `ox-digital-network` targeting PostgreSQL `ox_digital_education`  
**Final Status:** **`BLOCKED — LIVE TEST COULD NOT RUN`**

---

## 1. Executive Summary

In Phase 6.2C.5B, the objective was to execute the existing live concurrency integration test ([`concurrency_submission.integration.test.ts`](file:///D:/OX-DIGITAL/Mathe/OX-DIGITAL-GITHUB/services/course-service/src/test/concurrency_submission.integration.test.ts)) using the live Docker-network PostgreSQL connection to verify the 5-way concurrent submission serialization, row-level locking (`SELECT ... FOR UPDATE`), transaction advisory locking (`pg_advisory_xact_lock`), and idempotent responses.

During preflight inspection and runtime execution testing, two precise technical blockers were identified that prevented the existing test from executing in its current form:

1. **Runtime Execution & Module Loader Blocker:**  
   `concurrency_submission.integration.test.ts` is authored in TypeScript (`.ts`). The production container `ox-digital-course-service` operates in a pruned production runtime (`node:20-alpine`, `runner` stage) where `devDependencies` (including `tsx` and `typescript`) were omitted (`--omit=dev`). Node.js `v20.20.2` in the container does not natively parse TypeScript syntax, throwing:  
   `TypeError [ERR_UNKNOWN_FILE_EXTENSION]: Unknown file extension ".ts"`.

2. **Database Relational Schema Blocker (Foreign Key Constraints):**  
   The test setup logic synthesizes random standalone IDs (`testCourseId = 'test-course-concurrency-' + Date.now()` and `testStudentId = 'test-student-concurrency-' + Date.now()`). In the live PostgreSQL database, foreign key constraints are enforced:
   - `Exam.courseId` strictly references `Course.id` (`Exam_courseId_fkey`).
   - `ExamAttempt.studentId` strictly references `User.id` (`ExamAttempt_studentId_fkey`).  
   Attempting to insert test records with synthetic parent IDs immediately triggers PostgreSQL foreign key violations (`23503 foreign_key_violation`). In Phase 6.2C.2.5, this failure mode was masked because the test ran on the Windows host where `localhost:5432` was unreachable and skipped execution with `SKIPPED_DB_UNAVAILABLE`.

In strict adherence to Phase 6.2C.5B governance rules:
- No changes to application source code or test logic were made to force a pass.
- No infrastructure or Docker configurations were modified.
- No temporary records remain in the database.
- Execution was halted safely and documented with full empirical evidence under status **`BLOCKED — LIVE TEST COULD NOT RUN`**.

---

## 2. Preflight Verification

### 2.1 Workspace & Git State
- **Workspace Path:** `D:\OX-DIGITAL\Mathe\OX-DIGITAL-GITHUB`
- **Current Branch:** `main`
- **HEAD Commit:** `0500b93e65c24ed881349c4acea7f523332c5e9f`
- **Working Tree Integrity:** Preserved intact. All pre-existing modified and untracked files are untouched.

### 2.2 Live Database Migrations
Query executed against live PostgreSQL container `ox-digital-postgres`:
```sql
SELECT migration_name, finished_at, rolled_back_at FROM _prisma_migrations ORDER BY finished_at ASC;
```
| Migration Name | Finished At | Rolled Back At | State |
| :--- | :--- | :--- | :--- |
| `0_init` | `2026-10-22 18:59:22.535748+00` | `NULL` | Applied |
| `20261001_enable_rls` | `2026-10-22 18:59:22.64877+00` | `NULL` | Applied |
| `20261026_processed_media` | `2026-11-02 14:14:38.943689+00` | `NULL` | Applied |
| `20261102_exam_lifecycle_alignment` | `2026-11-02 14:15:31.86531+00` | `NULL` | Applied |

All 4 migrations are verified applied with `rolled_back_at = NULL`.

### 2.3 Course Service Health & Connectivity
- **Container Name:** `ox-digital-course-service`
- **Image:** `ox-digital-education-course-service` (rebuilt in Phase 6.2C.5A)
- **Status:** `Up (healthy)`
- **Database Target:** `postgresql://ox_admin:***@postgres:5432/ox_digital_education?schema=public`
- **Ingress Status:** `http://localhost:8080/health` returned HTTP 200 `OK`.

---

## 3. Detailed Inspection of the Existing Test Harness

**File:** `services/course-service/src/test/concurrency_submission.integration.test.ts`

### 3.1 Relative Import Expectations
The existing test defines:
```typescript
const { db } = await import('../../../../packages/database/dist/index.js');
const { submitAttempt } = await import('../controllers/exam.controller.js');
```
In the local development tree on the host:
- `../controllers/exam.controller.js` references `services/course-service/src/controllers/exam.controller.ts` (via tsx resolution).
- `../../../../packages/database/dist/index.js` references the monorepo root database build.

In the production container `ox-digital-course-service`:
- The compiled service entrypoint is located at `/app/services/course-service/dist/services/course-service/src/index.js`.
- `exam.controller.js` is at `/app/services/course-service/dist/services/course-service/src/controllers/exam.controller.js`.
- The database package is located at `/app/packages/database/dist/index.js` and exposed via `@smartmath/database`.

### 3.2 Relational Model & Foreign Key Constraints
The test setup logic (lines 46–77) executes:
```typescript
const testStudentId = 'test-student-concurrency-' + Date.now();
const testExamId = 'test-exam-concurrency-' + Date.now();
const testCourseId = 'test-course-concurrency-' + Date.now();

const exam = await db.exam.create({
  data: {
    id: testExamId,
    title: 'PostgreSQL Concurrency Test Exam',
    courseId: testCourseId,  // <-- Foreign key to Course.id
    ...
  }
});

const initialAttempt = await db.examAttempt.create({
  data: {
    studentId: testStudentId, // <-- Foreign key to User.id
    examId: testExamId,
    ...
  }
});
```
When run against live PostgreSQL, PostgreSQL enforces:
1. `Exam_courseId_fkey`: `FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE`
2. `ExamAttempt_studentId_fkey`: `FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE CASCADE`

Because `testCourseId` and `testStudentId` do not correspond to existing parent records, PostgreSQL rejects the queries with:
```text
Foreign key constraint violated: `Exam_courseId_fkey (index)`
```

---

## 4. Execution Attempt & Blocker Evidence

### 4.1 Invocation inside `ox-digital-course-service`
Command attempted:
```powershell
docker exec ox-digital-course-service node concurrency_submission.integration.test.ts
```
**Actual System Output:**
```text
node:internal/modules/esm/get_format:189
  throw new ERR_UNKNOWN_FILE_EXTENSION(ext, filepath);
        ^

TypeError [ERR_UNKNOWN_FILE_EXTENSION]: Unknown file extension ".ts" for /app/services/course-service/concurrency_submission.integration.test.ts
    at Object.getFileProtocolModuleFormat [as file:] (node:internal/modules/esm/get_format:189:9)
    at defaultGetFormat (node:internal/modules/esm/get_format:232:36)
    at defaultLoad (node:internal/modules/esm/load:145:22)
    at async ModuleLoader.loadAndTranslate (node:internal/modules/esm/loader:543:45)
    at async ModuleJob._link (node:internal/modules/esm/module_job:148:19) {
  code: 'ERR_UNKNOWN_FILE_EXTENSION'
}
```

### 4.2 Diagnostic Probe on Schema Constraints
A minimal test probe was executed inside `ox-digital-course-service`:
```javascript
const { db } = require('@smartmath/database');
await db.exam.create({
  data: { id: 'test-exam-probe', title: 'Probe', courseId: 'non-existent-course-id', questions: [] }
});
```
**Actual PostgreSQL Output:**
```text
Invalid `prisma.exam.create()` invocation:
Foreign key constraint violated: `Exam_courseId_fkey (index)`
```

---

## 5. Transaction & Locking Path Verification (Static Code Audit)

Although the live integration test harness could not execute due to test-script structure and runtime extension constraints, the concurrency protection implementation inside `services/course-service/src/controllers/exam.controller.ts` was audited and confirmed to enforce the required two-tier serialization model:

1. **Transaction Advisory Lock (`pg_advisory_xact_lock`):**
   ```typescript
   await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${'ox_attempt:' + studentId + ':' + examId}))`;
   ```
   - Serializes concurrent transactions for a given `(studentId, examId)` pair at the database engine level.
   - Automatically releases upon transaction commit or rollback.

2. **Row-Level Lock (`SELECT ... FOR UPDATE`):**
   ```typescript
   await tx.$executeRaw`SELECT "id" FROM "ExamAttempt" WHERE "id" = ${attempt.id} FOR UPDATE`;
   ```
   - Locks the specific committed `ExamAttempt` row before re-reading state within the active transaction.

3. **Terminal State Immutability & Idempotency:**
   ```typescript
   if (['GRADED', 'SUBMITTED'].includes(lockedAttempt.status)) {
     return res.status(200).json({
       score: lockedAttempt.score,
       totalPoints: lockedAttempt.totalPoints,
       percentage: lockedAttempt.percentage,
       status: lockedAttempt.status,
       isGraded: lockedAttempt.isGraded,
       idempotent: true
     });
   }
   ```
   - Concurrent duplicates block at the advisory lock.
   - When unblocked, they observe the committed `GRADED` state and return the cached score with `{ idempotent: true }` without re-evaluating or inserting duplicate records.

---

## 6. Database Verification & Immutability

Live database table row counts were verified before and after this phase:
```sql
SELECT count(*) FROM "Exam";
SELECT count(*) FROM "ExamAttempt";
SELECT count(*) FROM "User";
SELECT count(*) FROM "Lesson";
SELECT count(*) FROM "ProcessedMedia";
```

| Table | Baseline Count | Post-Phase Count | Net Change |
| :--- | :--- | :--- | :--- |
| `Exam` | 0 | 0 | 0 |
| `ExamAttempt` | 0 | 0 | 0 |
| `User` | 5 | 5 | 0 |
| `Lesson` | 2 | 2 | 0 |
| `ProcessedMedia` | 0 | 0 | 0 |

**Confirmation:** Zero database records were inserted, modified, or deleted. All temporary test files staged inside the container during diagnostics were completely removed.

---

## 7. Container & Infrastructure Health

Checked via `docker ps`:
| Container Name | Health Status | Runtime | Changes |
| :--- | :--- | :--- | :--- |
| `ox-digital-course-service` | `Up (healthy)` | 17+ minutes | None |
| `ox-digital-postgres` | `Up (healthy)` | 2+ hours | None |
| `ox-digital-redis` | `Up (healthy)` | 2+ hours | None |
| `ox-digital-nginx` | `Up (healthy)` | 2+ hours | None |
| `ox-digital-auth-service` | `Up (healthy)` | 2+ hours | None |
| `ox-digital-user-service` | `Up (healthy)` | 2+ hours | None |
| `ox-digital-analytics-service` | `Up (healthy)` | 2+ hours | None |
| `ox-digital-ai-service` | `Up (healthy)` | 2+ hours | None |
| `ox-digital-video-worker` | `Up (healthy)` | 2+ hours | None |

Zero infrastructure, Docker network, volume, or `.env` modifications were made.

---

## 8. Prescribed Remediation for Phase 6.2C.5B Approval

To cleanly execute the live concurrency integration test without modifying production code or container images, the Product Owner may authorize updating the test harness ([`concurrency_submission.integration.test.ts`](file:///D:/OX-DIGITAL/Mathe/OX-DIGITAL-GITHUB/services/course-service/src/test/concurrency_submission.integration.test.ts)) with the following minimal adjustments:

1. **Foreign Key Compliance in Test Fixture:**
   - Instead of synthesizing a random `testCourseId` and `testStudentId`, query an existing verified student (`role = 'ONLINE_STUDENT'` or `'CENTER_STUDENT'`) and course (`id` from existing `Course` table), OR create a temporary test user and test course within the test harness's `try...finally` block and delete them upon completion.
2. **Container-Compatible Test Execution:**
   - Transpile the test script to standard CommonJS or ES Module `.js` (e.g., `concurrency_submission.integration.test.cjs` or `.js`) and run it via `docker exec ox-digital-course-service node ...`, importing `@smartmath/database` and `/app/services/course-service/dist/.../exam.controller.js`.

---

## 9. Final Status

**Final Status:** **`BLOCKED — LIVE TEST COULD NOT RUN`**

In strict accordance with the mandatory safety rules of Phase 6.2C.5B:
- No unauthorized edits were made to force a pass.
- Application code, schema, migrations, and database records remain 100% intact.
- Phase 6.2C closure is paused pending Product Owner authorization of the test harness remediation.

