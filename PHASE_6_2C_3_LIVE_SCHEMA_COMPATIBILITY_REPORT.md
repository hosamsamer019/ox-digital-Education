# OX-DIGITAL Education — Phase 6.2C.3
# Live Schema Compatibility & State Report

**Document ID:** `PHASE_6_2C_3_LIVE_SCHEMA_COMPATIBILITY_REPORT`  
**Workspace:** `D:\OX-DIGITAL\Mathe\OX-DIGITAL-GITHUB`  
**Live Target Database:** `ox_digital_education` @ `ox-digital-postgres:5432`  
**Prisma Provider:** PostgreSQL 15.19  
**Execution Mode:** STRICT READ-ONLY FORENSIC AUDIT  
**Date:** November 2026  

---

## 1. Executive Summary

This report documents the actual schema state of the live PostgreSQL database (`ox_digital_education`), verifying its compatibility with the pending migration `20261102_exam_lifecycle_alignment`.

Forensic queries confirmed that the live database is clean, consistent with migration history, and ready to receive the pending DDL changes without conflict.

---

## 2. Actual Live Migration History (`_prisma_migrations`)

Queried live table `_prisma_migrations`:
```sql
SELECT id, migration_name, finished_at, rolled_back_at FROM _prisma_migrations ORDER BY finished_at ASC;
```

**Results:**
| Migration ID | Migration Name | Applied Timestamp | Status |
|---|---|---|---|
| `d3320bed-e75a-4460-9da4-3a84fb4666d6` | `0_init` | `2026-10-22 18:59:22 UTC` | **APPLIED (SUCCESS)** |
| `e9b8319f-fd57-438f-9c96-0dba8f38970e` | `20261001_enable_rls` | `2026-10-22 18:59:22 UTC` | **APPLIED (SUCCESS)** |
| *(Pending)* | `20261102_exam_lifecycle_alignment` | *Not applied* | **PENDING** |

**Confirmation:**
- Zero rolled-back or failed migrations exist in the database.
- The migration sequence is contiguous and clean.

---

## 3. Actual Live Table Schemas

### 3.1 Live `Exam` Table Definition
```
Table "public.Exam"
     Column     |            Type             | Nullable |      Default      
----------------+-----------------------------+----------+-------------------
 id             | text                        | not null | 
 title          | text                        | not null | 
 courseId       | text                        | not null | 
 duration       | integer                     | not null | 60
 createdAt      | timestamp without time zone | not null | CURRENT_TIMESTAMP
 updatedAt      | timestamp without time zone | not null | 
 questions      | jsonb                       |          | 
 requiresCamera | boolean                     | not null | false
 endTime        | timestamp without time zone |          | 
 passingScore   | double precision            | not null | 50
 randomization  | boolean                     | not null | false
 startTime      | timestamp without time zone |          | 
 instantGrading | boolean                     | not null | true
 showResult     | boolean                     | not null | true
Indexes:
    "Exam_pkey" PRIMARY KEY, btree (id)
Foreign-key constraints:
    "Exam_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"(id) ON UPDATE CASCADE ON DELETE CASCADE
Referenced by:
    TABLE ""ExamAttempt"" CONSTRAINT "ExamAttempt_examId_fkey" FOREIGN KEY ("examId") REFERENCES "Exam"(id) ON UPDATE CASCADE ON DELETE CASCADE
Current Row Count: 0
```

### 3.2 Live `ExamAttempt` Table Definition
```
Table "public.ExamAttempt"
  Column   |            Type             | Nullable | Default 
-----------+-----------------------------+----------+---------
 id        | text                        | not null | 
 examId    | text                        | not null | 
 score     | double precision            | not null | 
 createdAt | timestamp without time zone | not null | CURRENT_TIMESTAMP
 studentId | text                        | not null | 
 answers   | jsonb                       |          | 
Indexes:
    "ExamAttempt_pkey" PRIMARY KEY, btree (id)
    "ExamAttempt_examId_idx" btree ("examId")
    "ExamAttempt_studentId_idx" btree ("studentId")
Foreign-key constraints:
    "ExamAttempt_examId_fkey" FOREIGN KEY ("examId") REFERENCES "Exam"(id) ON UPDATE CASCADE ON DELETE CASCADE
    "ExamAttempt_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"(id) ON UPDATE CASCADE ON DELETE CASCADE
Current Row Count: 0
```

---

## 4. Live Custom Enums Verification

Queried PostgreSQL catalog `pg_type` and `pg_enum`:
```sql
SELECT enumlabel FROM pg_enum JOIN pg_type ON pg_enum.enumtypid = pg_type.oid 
WHERE pg_type.typname = 'AttemptStatus' ORDER BY enumsortorder;
```

**Results:**
- `STARTED`
- `IN_PROGRESS`
- `SUBMITTED`
- `TIME_EXPIRED`
- `GRADED`
- `CHEATING`

**Compatibility Assessment:**
The custom enum `"AttemptStatus"` already exists in PostgreSQL with the identical 6 states specified in `packages/database/prisma/schema.prisma`. Therefore, `ALTER TABLE "ExamAttempt" ADD COLUMN IF NOT EXISTS "status" "AttemptStatus"` will resolve immediately without type creation errors.

---

## 5. Constraint & Index Alignment with Policy Decisions

1. **Unique Constraint Absence:**
   - There is NO unique constraint on `("studentId", "examId")` in `ExamAttempt`.
   - **Policy Alignment:** This strictly aligns with **OD-11 (Assessment Retake Policy)**, which authorizes students to retake assessments across multiple distinct sessions, with the engine selecting the chronologically latest completed attempt.
2. **Foreign Key Integrity:**
   - Both `Exam.courseId` and `ExamAttempt.studentId` / `ExamAttempt.examId` have active foreign keys with `ON UPDATE CASCADE ON DELETE CASCADE`.
   - The migration does not touch or invalidate any foreign key references.

---

## 6. Downstream Application Consumers

| Service | Controller / Job | Query Pattern | Impact of Migration |
|---|---|---|---|
| `course-service` | `exam.controller.ts` | Writes `status`, `submittedAt`, `isGraded`, `percentage`, `totalPoints` | Restores field persistence; resolves transient GPA loss |
| `analytics-service` | `analytics.controller.ts` | Filters `{ status: 'GRADED', isGraded: true }` | Eliminates ghost 0% penalty grades from unsubmitted attempts |
| `user-service` | `user.controller.ts` | Filters `{ status: 'GRADED', isGraded: true }` | Restores accurate GPA computation on student profile |
| `course-service` | `riskEngine.job.ts` | Evaluates academic assessment via `evaluateAttemptEligibility` | Guarantees only verified attempts contribute to academic dimension |

**Compatibility Verdict:** **100% COMPATIBLE**.

