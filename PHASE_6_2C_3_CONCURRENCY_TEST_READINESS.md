# OX-DIGITAL Education — Phase 6.2C.3
# Concurrency Test Readiness & Execution Specification

**Document ID:** `PHASE_6_2C_3_CONCURRENCY_TEST_READINESS`  
**Workspace:** `D:\OX-DIGITAL\Mathe\OX-DIGITAL-GITHUB`  
**Harness File:** `services/course-service/src/test/concurrency_submission.integration.test.ts`  
**Target Environment:** `ox-digital-course-service` container on Docker network `ox-digital-network`  
**Execution Mode:** STRICT READ-ONLY PRE-EXECUTION AUDIT  
**Date:** November 2026  

---

## 1. Executive Summary

This report evaluates the readiness of the PostgreSQL integration test [`concurrency_submission.integration.test.ts`](file:///D:/OX-DIGITAL/Mathe/OX-DIGITAL-GITHUB/services/course-service/src/test/concurrency_submission.integration.test.ts) for execution against the live Docker network in Phase 6.2C.4.

The test was designed to validate PostgreSQL row-level locking (`SELECT ... FOR UPDATE`) and transaction advisory locking (`pg_advisory_xact_lock`) by launching 5 simultaneous submission requests against a single exam attempt.

---

## 2. Test Architecture & Concurrency Protocol

```
                                  [Test Initiation]
                                         │
                         Creates Isolated Test Course & Exam
                         Creates Initial Attempt (status: 'STARTED')
                                         │
                     ┌───────────────────┼───────────────────┐
                     ▼                   ▼                   ▼
                [Request 1]         [Request 2]        [Requests 3-5]
              (submitAttempt)     (submitAttempt)     (submitAttempt)
                     │                   │                   │
                     └───────────────────┼───────────────────┘
                                         ▼
                            [pg_advisory_xact_lock]
                           (Strict FIFO Serialization)
                                         │
                             Acquires Row Lock (FOR UPDATE)
                             Refetches Committed State
                                         │
                         ┌───────────────┴───────────────┐
                         ▼                               ▼
                 First Execution                 Subsequent 4 Executions
                 └── Calculates Score            └── Sees status: 'GRADED'
                 └── Updates to 'GRADED'         └── Idempotent short-circuit
                 └── Commits Transaction         └── Returns cached 100% score
                                         │
                                         ▼
                          [Test Assertions Evaluated]
                          ├── Exactly 1 primary graded result
                          ├── Exactly 4 idempotent responses
                          ├── All 5 return identical score & percentage
                          └── Database has exactly 1 attempt record
                                         │
                                         ▼
                               [Guaranteed Cleanup]
                               Deletes only test records in finally
```

---

## 3. Data Isolation & Safety Review

1. **UUID-Isolated Entity Keys:**
   - `testStudentId = 'test-student-concurrency-' + Date.now()`
   - `testExamId = 'test-exam-concurrency-' + Date.now()`
   - `testCourseId = 'test-course-concurrency-' + Date.now()`
   - Completely decoupled from real student IDs and production courses.
2. **Guaranteed Teardown in `finally`:**
   ```typescript
   finally {
     await db.examAttempt.deleteMany({ where: { studentId: testStudentId } });
     await db.exam.deleteMany({ where: { id: testExamId } });
   }
   ```
   Ensures that test artifacts are removed even if assertions fail or unhandled exceptions occur.
3. **Zero Production Mutation:** Does not query, read, or mutate existing student records.

---

## 4. Execution Dependency Gate

- **Prerequisite Migration Requirement:**
  The integration test directly writes and asserts modern schema fields:
  ```typescript
  status: 'STARTED', isGraded: false, totalPoints: 100
  ```
  And checks post-submission state:
  ```typescript
  assert.strictEqual(attemptsInDb[0].status, 'GRADED');
  assert.strictEqual(attemptsInDb[0].isGraded, true);
  ```
- **Live Schema Constraint:**
  As proven in Phase 6.2C.2.7, the live database currently has only the 6 legacy columns; `status` and `isGraded` do not yet exist in PostgreSQL.
- **Verdict:** The integration test **CANNOT and MUST NOT be executed** until the pending migration `20261102_exam_lifecycle_alignment` has been applied to PostgreSQL.
- **Phase 6.2C.3 Stop Condition:** The test was not executed in this phase, preserving zero-mutation guarantees.

---

## 5. Execution Plan for Phase 6.2C.4 (Post-Migration)

Once the migration is applied in Phase 6.2C.4, the test will be invoked inside the application container:
```bash
docker exec ox-digital-course-service node --loader ts-node/esm services/course-service/src/test/concurrency_submission.integration.test.ts
```
Expected output:
- `✓ PostgreSQL Connectivity: ESTABLISHED (Live DB available)`
- `Primary graded submissions: 1`
- `Idempotent deduplicated responses: 4`
- `✓ Live PostgreSQL concurrency verification SUCCEEDED with 100% data consistency.`

