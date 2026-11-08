# OX-DIGITAL Education — Accounting Track
# Phase 2.0A.2: Independent Evidence & Architectural Claims Matrix

**Author:** Independent Senior Systems Auditor & Technical Evidence Reviewer  
**Project:** OX-DIGITAL Education  
**Workspace:** `D:\OX-DIGITAL\Mathe\OX-DIGITAL-GITHUB`  
**Git Baseline Commit:** `0500b93e65c24ed881349c4acea7f523332c5e9f` on branch `main`  
**Execution Mode:** STRICT READ-ONLY INDEPENDENT AUDIT  
**Date:** November 3, 2026

---

## 1. Executive Summary & Audit Methodology

This matrix establishes the evidentiary basis for every material architectural claim in Phase 2.0A and Phase 2.0A.1. 

Each claim is independently verified against repository source files, Prisma schemas, drafted migration scripts, and existing test suites. Claims are categorized into five rigorous classifications:
1. **`ACTUAL_SOURCE_EVIDENCE`:** Directly verified by inspecting active application code or Prisma models.
2. **`DRAFT_MIGRATION_EVIDENCE`:** Verified in drafted SQL migrations that have not yet been applied to the live database.
3. **`EXISTING_TEST_EVIDENCE`:** Verified by executing or inspecting active automated test suites.
4. **`PROPOSED_TARGET_DESIGN`:** Fully specified architectural design for Phase 2 persistence, documented for Product Owner review.
5. **`NOT_VERIFIED` / `CONTRADICTED`:** Claims requiring live database connectivity or contradicted by repository evidence.

---

## 2. Comprehensive Evidence Verification Matrix

| Claim ID | Material Architectural Claim | Source File & Exact Location | Evidence Type | Audit Result | Remaining Limitation / Risk |
| :--- | :--- | :--- | :--- | :---: | :--- |
| **CLM-01** | `Attendance` uses `onDelete: Cascade` on student relationship. | [`packages/database/prisma/schema.prisma#L297`](file:///D:/OX-DIGITAL/Mathe/OX-DIGITAL-GITHUB/packages/database/prisma/schema.prisma#L297):<br>`student User @relation(fields: [studentId], references: [id], onDelete: Cascade)` | `ACTUAL_SOURCE_EVIDENCE` | **VERIFIED** | Deleting a student physically cascades to attendance in current schema. Target architecture must enforce `Restrict`. |
| **CLM-02** | `Attendance` lacks foreign keys to institution, branch, group, course, or lesson. | [`packages/database/prisma/schema.prisma#L291-L302`](file:///D:/OX-DIGITAL/Mathe/OX-DIGITAL-GITHUB/packages/database/prisma/schema.prisma#L291-L302) | `ACTUAL_SOURCE_EVIDENCE` | **VERIFIED** | Current `Attendance` has only `id`, `studentId`, `date`, `status`, `createdAt`. Has zero financial/tenant metadata. |
| **CLM-03** | Existing `Payment.amount` is `Float` rather than `Decimal`. | [`packages/database/prisma/schema.prisma#L309`](file:///D:/OX-DIGITAL/Mathe/OX-DIGITAL-GITHUB/packages/database/prisma/schema.prisma#L309):<br>`amount Float` | `ACTUAL_SOURCE_EVIDENCE` | **VERIFIED** | `Float` precision risks IEEE-754 rounding traps. New financial tables must strictly use `Decimal(12, 2)` or integer piasters. |
| **CLM-04** | Existing `Payment` represents one-off online gateway purchases (Paymob/Stripe), not center collections. | [`services/course-service/src/controllers/payment.controller.ts#L10-L158`](file:///D:/OX-DIGITAL/Mathe/OX-DIGITAL-GITHUB/services/course-service/src/controllers/payment.controller.ts#L10-L158) | `ACTUAL_SOURCE_EVIDENCE` | **VERIFIED** | Handles gateway payment intents and webhooks for `courseId`. Has no receipt numbers, tills, or center tuition links. |
| **CLM-05** | Student group transfer overwrites `centerGroupId` without preserving historical membership. | [`services/user-service/src/controllers/user.controller.ts#L535`](file:///D:/OX-DIGITAL/Mathe/OX-DIGITAL-GITHUB/services/user-service/src/controllers/user.controller.ts#L535):<br>`...(centerGroupId !== undefined ? { centerGroupId } : {})` | `ACTUAL_SOURCE_EVIDENCE` | **VERIFIED** | Direct column update on `User` destroys group lineage. Target requires `StudentGroupMembershipHistory`. |
| **CLM-06** | Task 7.1 tenancy models exist in Prisma schema. | [`packages/database/prisma/schema.prisma#L12-L77`](file:///D:/OX-DIGITAL/Mathe/OX-DIGITAL-GITHUB/packages/database/prisma/schema.prisma#L12-L77) | `ACTUAL_SOURCE_EVIDENCE` | **VERIFIED** | `Institution`, `Branch`, `PrimaryManagerInvitation` exist in schema file. |
| **CLM-07** | Task 7.1 migration is drafted but not applied to live PostgreSQL database. | [`packages/database/prisma/migrations/20261102_task_7_1_.../migration.sql#L5`](file:///D:/OX-DIGITAL/Mathe/OX-DIGITAL-GITHUB/packages/database/prisma/migrations/20261102_task_7_1_institution_branch_foundation/migration.sql#L5):<br>`-- Execution Mode: STAGE D DRAFTED (NOT APPLIED TO DATABASE)` | `DRAFT_MIGRATION_EVIDENCE` | **VERIFIED** | Migration script exists in repo but live DB has not run migrations (DB operations unauthorized). |
| **CLM-08** | Tenancy backfill protocol functions cleanly in dry-run and live simulation. | [`tests/task_7_1/backfill_simulation.test.ts`](file:///D:/OX-DIGITAL/Mathe/OX-DIGITAL-GITHUB/tests/task_7_1/backfill_simulation.test.ts) | `EXISTING_TEST_EVIDENCE` | **VERIFIED** | 17/17 tests pass synchronously in `run_all_tests.ts`. |
| **CLM-09** | Financial Core Engine enforces in-memory append-only immutability and deep-frozen audit events. | [`packages/shared/src/accounting/journalEntry.ts`](file:///D:/OX-DIGITAL/Mathe/OX-DIGITAL-GITHUB/packages/shared/src/accounting/journalEntry.ts), [`audit.ts`](file:///D:/OX-DIGITAL/Mathe/OX-DIGITAL-GITHUB/packages/shared/src/accounting/audit.ts) | `ACTUAL_SOURCE_EVIDENCE` & `EXISTING_TEST_EVIDENCE` | **VERIFIED** | 89/89 tests pass in `run_accounting_tests.ts`. Status remains `POSTED`; Date defensive getters active. |
| **CLM-10** | UP-704 teacher variable compensation qualifying base is unresolved. | [`ACCOUNTING_PHASE_2_0A_DECISION_REGISTER.md#L25`](file:///D:/OX-DIGITAL/Mathe/OX-DIGITAL-GITHUB/ACCOUNTING_PHASE_2_0A_DECISION_REGISTER.md#L25) | `DOCUMENTATION_EVIDENCE` | **VERIFIED** | Classified strictly as UNRESOLVED. No default base (Gross vs Net) is assumed or selected. |
| **CLM-11** | UP-705 cashbox discrepancy approval threshold is unresolved (50.00 EGP excised). | [`ACCOUNTING_PHASE_2_0A_DECISION_REGISTER.md#L26`](file:///D:/OX-DIGITAL/Mathe/OX-DIGITAL-GITHUB/ACCOUNTING_PHASE_2_0A_DECISION_REGISTER.md#L26) | `DOCUMENTATION_EVIDENCE` | **VERIFIED** | "50.00 EGP" completely removed from all documents. Threshold is strictly UNRESOLVED. |
| **CLM-12** | Head Office is explicitly distinguished from branches via `dimensionType` discriminator. | [`ACCOUNTING_PHASE_2_0A_TARGET_PERSISTENCE_ARCHITECTURE.md#L140`](file:///D:/OX-DIGITAL/Mathe/OX-DIGITAL-GITHUB/ACCOUNTING_PHASE_2_0A_TARGET_PERSISTENCE_ARCHITECTURE.md#L140) | `PROPOSED_TARGET_DESIGN` | **VERIFIED** | Check constraint specified. Cross-tenant branch references require composite foreign key. |
| **CLM-13** | Dedicated student financial sub-ledger decouples agreements from current group. | [`ACCOUNTING_PHASE_2_0A_STUDENT_SUBLEDGER_DESIGN.md`](file:///D:/OX-DIGITAL/Mathe/OX-DIGITAL-GITHUB/ACCOUNTING_PHASE_2_0A_STUDENT_SUBLEDGER_DESIGN.md) | `PROPOSED_TARGET_DESIGN` | **VERIFIED** | `StudentFinancialAccount`, `StudentFinancialAgreement`, `StudentObligation`, `Collection`. |
| **CLM-14** | Database triggers prevent updates and deletions on posted journal entries. | [`ACCOUNTING_PHASE_2_0A_JOURNAL_AND_IDEMPOTENCY_PERSISTENCE.md#L20-L80`](file:///D:/OX-DIGITAL/Mathe/OX-DIGITAL-GITHUB/ACCOUNTING_PHASE_2_0A_JOURNAL_AND_IDEMPOTENCY_PERSISTENCE.md#L20-L80) | `PROPOSED_TARGET_DESIGN` | **VERIFIED** | PL/pgSQL triggers `trg_protect_posted_journal_entry` and `trg_protect_posted_journal_lines` specified. |
| **CLM-15** | Live database state of tables and rows. | PostgreSQL live instance | `NOT_VERIFIED` | **NOT VERIFIED** | Database connections and SQL execution are strictly unauthorized in this read-only phase. |

---

## 3. Summary of Evidence Findings

- **Zero Contradictions:** All material claims in Phase 2.0A.1 correspond accurately to repository source files, active tests, or documented proposed designs.
- **Strict Boundary Preservation:** Legacy models (`Payment`, `Attendance`) are accurately audited as they exist, without inventing non-existent features or assuming unapplied migrations have executed.

