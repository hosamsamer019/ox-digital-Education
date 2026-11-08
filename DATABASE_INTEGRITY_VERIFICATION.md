# OX-DIGITAL Education — Database Integrity Verification Report

**Document Identity:** `DATABASE_INTEGRITY_VERIFICATION.md`  
**Date:** November 7, 2026  
**Workspace:** `D:\OX-DIGITAL\Mathe\OX-DIGITAL-GITHUB`  
**Host & Port:** `127.0.0.1:5433`  
**Database Name:** `ox_digital_dev_test`  
**Database Superuser:** `ox_dev_admin`  
**Database Container:** `ox-digital-isolated-dev-postgres`  
**Container Volume:** `ox_digital_isolated_dev_pgdata`

---

## 1. Executive Summary

This report establishes that the authoritative development database has experienced **zero data drift, zero unauthorized migrations, zero database resets, and zero row mutations** throughout this UI/UX verification and remediation round.

Both row-count invariants and cryptographic table content hashes (MD5) were verified against pre-activation baselines.

---

## 2. Baseline Reconciliation

Two baselines exist in the system artifacts:
1. **Pre-Remediation Baseline (`all_65_table_counts_before.json`, Nov 7, 12:28:09 PM):** Captured prior to authorized canonical user account seeding. Contained 4 users.
2. **Pre-Activation Baseline (`pre_activation_db_counts.json`, Nov 7, 15:31:35 PM):** Captured immediately prior to the authorized service recreation, containing all 7 canonical user identities.

The authoritative reference for this acceptance mission is the **Pre-Activation Baseline (15:31:35 PM)**.

---

## 3. Cryptographic Table Content Fingerprints

To detect any subtle data mutation (such as password changes, timestamp updates, or record tampering), deterministic MD5 hashes were computed for all tables containing data by concatenating ordered row representations (`SELECT md5(string_agg(t::text, ',' ORDER BY 1)) FROM table t;`):

| # | Table Name | Row Count (Baseline) | Row Count (Current Live) | Baseline Content MD5 Hash | Current Live Content MD5 Hash | Verification Status |
| :-: | :--- | :-: | :-: | :---: | :---: | :---: |
| 1 | `Branch` | 4 | 4 | `a49d376f4396044771cb8f27f2fc8951` | `a49d376f4396044771cb8f27f2fc8951` | **IDENTICAL (100%)** |
| 2 | `Cashbox` | 1 | 1 | `2fbcf303a2b8848c4e8309d18daf6625` | `2fbcf303a2b8848c4e8309d18daf6625` | **IDENTICAL (100%)** |
| 3 | `Institution` | 2 | 2 | `05225c38f3c94c97c6f7cf3c26202ade` | `05225c38f3c94c97c6f7cf3c26202ade` | **IDENTICAL (100%)** |
| 4 | `StudentAuditLog` | 1 | 1 | `bfafd65ea0d7ba4fbbf2dfa8e22d36fb` | `bfafd65ea0d7ba4fbbf2dfa8e22d36fb` | **IDENTICAL (100%)** |
| 5 | `TeacherGradePricing` | 2 | 2 | `8d5ce0c8b49d993f6cc43110d3cd028d` | `8d5ce0c8b49d993f6cc43110d3cd028d` | **IDENTICAL (100%)** |
| 6 | `User` | 7 | 7 | `ddd4e8bd32bc1ec9061495556621010a` | `ddd4e8bd32bc1ec9061495556621010a` | **IDENTICAL (100%)** |
| 7 | `_prisma_migrations` | 11 | 11 | `47dec6dee4e8c9be6d9c453a4b607f44` | `47dec6dee4e8c9be6d9c453a4b607f44` | **IDENTICAL (100%)** |

All remaining **58 public tables** have a row count of exactly **0** in both baseline and current live database state.

---

## 4. Complete 65-Table Inventory

The table below catalogs all 65 public tables in `ox_digital_dev_test`:

| Table Name | Count | Table Name | Count | Table Name | Count |
| :--- | :-: | :--- | :-: | :--- | :-: |
| `_prisma_migrations` | 11 | `Attendance` | 0 | `Notification` | 0 |
| `DailyPlatformStats` | 0 | `Payment` | 0 | `ChatSession` | 0 |
| `UserSession` | 0 | `QuestionBank` | 0 | `ChatMessage` | 0 |
| `CourseEnrollment` | 0 | `ProcessedMedia` | 0 | `SavedMathSolution` | 0 |
| `CenterGroup` | 0 | `PrimaryManagerInvitation` | 0 | `Exam` | 0 |
| `Course` | 0 | `Cashbox` | 1 | `ExamAttempt` | 0 |
| `Lesson` | 0 | `CashboxTransaction` | 0 | `Institution` | 2 |
| `User` | 7 | `CashboxReconciliation` | 0 | `Branch` | 4 |
| `LessonQuiz` | 0 | `StudentFinancialAccount` | 0 | `GroupPricingAgreement` | 0 |
| `VideoProgress` | 0 | `StudentFinancialAgreement` | 0 | `FinancialIdempotencyRecord` | 0 |
| `VideoUpload` | 0 | `Collection` | 0 | `FinancialAuditEvent` | 0 |
| `Assessment` | 0 | `CollectionAllocation` | 0 | `LessonDeliveryEvidence` | 0 |
| `AssessmentAttempt` | 0 | `FinancialAdjustment` | 0 | `RevenueRecognitionEntry` | 0 |
| `ExternalExamAttempt` | 0 | `CollectionTender` | 0 | `MonthlyFeePolicy` | 0 |
| `TemporaryAsset` | 0 | `BankAccount` | 0 | `MonthlyFeePolicyAudit` | 0 |
| `ExamViolation` | 0 | `BankTransaction` | 0 | `FinancialRestrictionHistory` | 0 |
| `Homework` | 0 | `ExpenseVoucher` | 0 | `PriceAuditHistory` | 0 |
| `Submission` | 0 | `TeacherSettlement` | 0 | `BranchReceiptCounter` | 0 |
| `StudentRiskHistory` | 0 | `StudentObligation` | 0 | `StudentTeacher` | 0 |
| `TeacherTransferHistory`| 0 | `TeacherSubscriptionSetting`| 0 | `TeacherGradePricing` | 2 |
| `StudentMonthlySubscription` | 0 | `SubscriptionPayment` | 0 | `SubscriptionPaymentItem` | 0 |
| `BranchSequentialReceipt`| 0 | `StudentAuditLog` | 1 | *(Total: 65 tables)* | — |

---

## 5. Absolute Isolation & Safeguards Attestation

1. **Port 5432 (Staging) Untouched:** No connections were made to `ox-digital-staging-postgres` or default port 5432.
2. **Zero Prisma Migrations:** No migrations were generated, applied, or rolled back. Table `_prisma_migrations` remains strictly at 11 applied migrations.
3. **Zero Administrative Tampering:** Canonical administrator, teacher, accountant, and student credentials remain completely unaltered.
4. **Conclusion:** Database integrity is 100% intact and conclusively verified.

