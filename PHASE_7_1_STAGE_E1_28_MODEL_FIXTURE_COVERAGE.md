# OX-DIGITAL Education — Task 7.1
## Stage E.1: Synthetic 28-Model Fixture Coverage & Baseline Matrix

**Authorized Workspace:** `D:\OX-DIGITAL\Mathe\OX-DIGITAL-GITHUB`  
**GitHub Repository:** `https://github.com/hosamsamer019/ox-digital-Education.git`  
**Current Git HEAD:** `0500b93e65c24ed881349c4acea7f523332c5e9f` (branch `main`)  
**Scope:** Exhaustive Fixture Plan for all 28 Pre-Existing Prisma Models + 3 Foundation Models  
**Execution Mode:** SPECIFICATION & AUDIT ONLY (NO DATA INSERTED)  
**Date:** November 2, 2026  

---

## 1. Architectural Baseline & Model Count Reconciliation

A strict audit of `packages/database/prisma/schema.prisma` confirms:
- **Original Baseline Pre-Task 7.1 Models:** Exactly **28 models**.
- **Task 7.1 Foundation Tenancy Models:** Exactly **3 models** (`Institution`, `Branch`, `PrimaryManagerInvitation`).
- **Migration Archival Table:** Exactly **1 non-Prisma auxiliary table** (`_migration_quarantine`).
- **Total Entities in Schema:** Exactly **31 Prisma models**.

The 3 new foundation models are strictly isolated from the 28-model baseline to prevent baseline drift.

---

## 2. Complete 28-Model Synthetic Fixture Specification

The matrix below defines target record volumes across three planning profiles:
- **Profile S (Small):** Rapid functional and structural validation.
- **Profile M (Medium):** Comprehensive relationship, edge-case, and referential validation.
- **Profile L (Large):** High-concurrency performance, index build, and lock-duration benchmark.

| # | Model Name | Profile S Target | Profile M Target | Profile L Target | Primary Key Format | Tenancy Ownership Type | Branch Scope | Parent Foreign Key Dependencies | Expected Orphan / Quarantine Action | Cascade / Deletion Risk |
| :---: | :--- | :---: | :---: | :---: | :--- | :--- | :--- | :--- | :--- | :--- |
| **1** | **`User`** | 10 | 100 | 2,500 | `usr_synth_{role}_{idx}` | Direct `institutionId` | Direct `branchId` | `Institution`, `Branch` | Unmapped legacy users routed to `_migration_quarantine`. | Protected by `Payment` RESTRICT. |
| **2** | **`CenterGroup`** | 2 | 10 | 100 | `cg_synth_{inst}_{idx}` | Direct `institutionId` | Direct `branchId` | `Institution`, `Branch` | Unmapped groups routed to `_migration_quarantine`. | Referenced by Course & Attendance. |
| **3** | **`Course`** | 4 | 20 | 200 | `crs_synth_{inst}_{idx}` | Direct `institutionId` | Direct `branchId` | `Institution`, `Branch`, `teacherId -> User` | Unmapped courses routed to `_migration_quarantine`. | Parent of Lesson, Exam, Homework. |
| **4** | **`CourseEnrollment`** | 15 | 200 | 5,000 | `enr_synth_{idx}` | Indirect via Course | Indirect via Course | `userId -> User`, `courseId -> Course` | Invalid if parent unmapped. | Cascades on student/course deletion. |
| **5** | **`Lesson`** | 12 | 100 | 1,000 | `lsn_synth_{idx}` | Indirect via Course | Indirect via Course | `courseId -> Course` | Preserved via parent; soft-delete enabled. | Cascades on Course delete. |
| **6** | **`Exam`** | 4 | 20 | 200 | `exm_synth_{idx}` | Indirect via Course | Indirect via Course | `courseId -> Course` | Preserved via parent. | Parent of ExamAttempt. |
| **7** | **`ExamAttempt`** | 15 | 150 | 4,000 | `eat_synth_{idx}` | Indirect via Exam/Course | Indirect via Exam | `examId -> Exam`, `studentId -> User` | Invalid if cross-tenant. | Cascades on Exam/User delete. |
| **8** | **`Homework`** | 6 | 40 | 400 | `hwk_synth_{idx}` | Indirect via Course | Indirect via Course | `courseId -> Course` | Preserved via parent. | Parent of Submission. |
| **9** | **`Submission`** | 15 | 150 | 4,000 | `sub_synth_{idx}` | Indirect via Homework | Indirect via Homework | `homeworkId -> Homework`, `studentId -> User` | Invalid if cross-tenant. | Cascades on Homework/User delete. |
| **10** | **`Attendance`** | 20 | 300 | 10,000 | `att_synth_{idx}` | Indirect via CenterGroup | Historical NULL; New from Group | `studentId -> User`, `centerGroupId -> CenterGroup` | Historical records kept with NULL branch. | Cascades on User/Group delete. |
| **11** | **`Payment`** | 10 | 150 | 3,000 | `pay_synth_{idx}` | Direct `institutionId` | NULL for historical | `userId -> User` (RESTRICT), `Institution` | Unmapped routed to `_migration_quarantine`. | **ZERO DELETION RISK (OD-708 Invariant).** |
| **12** | **`VideoProgress`** | 20 | 250 | 6,000 | `vpr_synth_{idx}` | Indirect via Lesson | Indirect via Lesson | `userId -> User`, `lessonId -> Lesson` | Preserved via parents. | Cascades on User/Lesson delete. |
| **13** | **`Assessment`** | 2 | 10 | 100 | `asm_synth_{idx}` | Indirect via Teacher | Indirect via Teacher | `teacherId -> User` | Preserved via teacher. | Cascades on Teacher delete. |
| **14** | **`ExternalExamAttempt`** | 5 | 50 | 1,000 | `eea_synth_{idx}` | Indirect via Student | Indirect via Student | `studentId -> User` | Preserved via student. | Cascades on Student delete. |
| **15** | **`AssessmentAttempt`** | 10 | 100 | 2,000 | `asa_synth_{idx}` | Indirect via Assessment | Indirect via Assessment | `assessmentId -> Assessment`, `studentId -> User` | Cross-tenant check required. | Cascades on Assessment/User delete. |
| **16** | **`StudentRiskHistory`** | 10 | 100 | 2,000 | `srh_synth_{idx}` | Indirect via Course/Student | Indirect via Course | `studentId -> User`, `courseId -> Course` | Preserved via parents. | Cascades on Course/Student delete. |
| **17** | **`LessonQuiz`** | 6 | 40 | 400 | `lqz_synth_{idx}` | Indirect via Lesson | Indirect via Lesson | `lessonId -> Lesson` | Preserved via lesson. | Cascades on Lesson delete. |
| **18** | **`ChatSession`** | 4 | 20 | 200 | `chs_synth_{idx}` | Indirect via User | Indirect via User | `userId -> User` | Preserved via user. | Cascades on User delete. |
| **19** | **`ChatMessage`** | 20 | 200 | 3,000 | `chm_synth_{idx}` | Indirect via Session | Indirect via Session | `sessionId -> ChatSession` | Preserved via session. | Cascades on Session delete. |
| **20** | **`Notification`** | 15 | 150 | 3,000 | `not_synth_{idx}` | Indirect via User | Indirect via User | `userId -> User` | Preserved via user. | Cascades on User delete. |
| **21** | **`QuestionBank`** | 2 | 10 | 50 | `qbk_synth_{idx}` | Direct `institutionId` | N/A (Institution-wide) | `Institution` | Mapped to primary institution. | RESTRICT on institution delete. |
| **22** | **`SavedMathSolution`** | 5 | 50 | 1,000 | `sms_synth_{idx}` | Indirect via User | Indirect via User | `userId -> User` | Preserved via user. | Cascades on User delete. |
| **23** | **`VideoUpload`** | 4 | 20 | 200 | `vup_synth_{idx}` | Indirect via Teacher | Indirect via Teacher | `teacherId -> User` | Preserved via teacher. | Cascades on Teacher delete. |
| **24** | **`UserSession`** | 10 | 100 | 1,500 | `uss_synth_{idx}` | Indirect via User | Indirect via User | `userId -> User` | Preserved via user. | Cascades on User delete. |
| **25** | **`DailyPlatformStats`** | 7 | 30 | 365 | `dps_synth_{idx}` | Global Aggregator | N/A | None | Kept un-tenanted. | Zero cascade risk. |
| **26** | **`ExamViolation`** | 2 | 20 | 300 | `exv_synth_{idx}` | Indirect via Attempt | Indirect via Attempt | `attemptId -> ExamAttempt` | Preserved via attempt. | Cascades on Attempt delete. |
| **27** | **`TemporaryAsset`** | 5 | 20 | 200 | `tas_synth_{idx}` | Ephemeral Staging | Ephemeral | `uploaderId -> User` | TTL lifecycle; cron auto-purged. | Cascades on Uploader delete. |
| **28** | **`ProcessedMedia`** | 8 | 80 | 800 | `med_synth_{idx}` | Direct `institutionId` | Indirect via Lesson | `Institution`, `lessonId -> Lesson` | **Orphans (`lessonId: null`) routed to `_migration_quarantine` (OD-720).** | RESTRICT on institution delete. |

---

## 3. Foundation Tenancy Models & Auxiliary Quarantine Entities

| # | Model Name | Profile S Target | Profile M Target | Profile L Target | Primary Key Format | Operational Purpose |
| :---: | :--- | :---: | :---: | :---: | :--- | :--- |
| **29** | **`Institution`** | 2 | 3 | 5 | `inst_synth_{code}` | Tenant Root Container (`ALPHA_EDU`, `BETA_STEM`). |
| **30** | **`Branch`** | 4 | 7 | 15 | `br_synth_{code}` | Physical campuses & Online branches (`isOnline: true`). |
| **31** | **`PrimaryManagerInvitation`** | 2 | 5 | 10 | `inv_synth_{code}` | Cryptographic token onboarding flow (OD-718). |
| **—** | **`_migration_quarantine`** | 2 (deliberate) | 5 (deliberate) | 20 (deliberate) | UUID (gen_random_uuid()) | Cold archival quarantine for orphan media & unmapped entities (OD-720). |

---

## 4. Aggregate Synthetic Record Totals

- **Profile S (Small):** $\sim 230$ total rows across all 31 models. (Rapid unit & smoke test).
- **Profile M (Medium):** $\sim 2,500$ total rows across all 31 models. (Comprehensive referential integrity & dry-run test).
- **Profile L (Large):** $\sim 50,000$ total rows across all 31 models. (Realistic lock contention & throughput benchmark).

*Note: All values are proposed design targets. Zero database records were created or inserted during this stage.*

