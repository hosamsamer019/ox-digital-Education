# OX-DIGITAL Education — Accounting Implementation Track
## Phase 2.0A.2 — Dimension Integrity Audit Report
### Head Office and Branch Dimension Integrity Architecture (The Dimension Representation Evaluation)

**Project:** OX-DIGITAL Education  
**Phase:** Phase 2.0A.2 — Independent Evidence-Based Acceptance Audit  
**Author:** Independent Senior Financial Systems Architect & Database Security Reviewer  
**Date:** November 3, 2026  
**Workspace:** `D:\OX-DIGITAL\Mathe\OX-DIGITAL-GITHUB`  
**Git Baseline:** HEAD `0500b93e65c24ed881349c4acea7f523332c5e9f` on branch `main`  
**Status:** COMPLETE — CANONICAL AUDIT ARTIFACT  

---

## 1. Executive Summary & Objective

In multi-tenant financial accounting, every journal entry line must be strictly bound to a tenant (`institution_id`) and attributed to an operating dimension. In educational centers operating under OX-DIGITAL Education, transactions originate either at:
1. **The Institutional Level (Head Office / Central Treasury):** Center-wide overhead, centralized tax withholdings, enterprise software licenses, bank account interest, central supplier disbursements.
2. **A Physical Operating Branch:** Tuition fee collections, classroom rental, teacher lesson payouts, cashbox drawer reconciliations, on-site material purchases.

During Phase 2.0A and Phase 2.0A.1, the architectural representation of dimensions was debated. Specifically:
- Should Head Office be modeled as a synthetic 59th entity or pseudo-branch record in the `Branch` table?
- Should dimensions be modeled via a polymorphic `AccountingDimension` table?
- Or should dimensions be modeled directly via a discriminator column (`dimension_type`) and a composite foreign key on `JournalLine`?

This audit independently investigates the relational safety, SQL constraint capabilities, foreign key mechanisms, performance implications, and application lifecycle constraints of these choices.

---

## 2. Fundamental Relational Limitation: Why a SQL `CHECK` Constraint Alone Cannot Guarantee Cross-Tenant Integrity

A common architectural misconception is that an integrity rule such as:
> *"A journal line with branch_id must reference a branch belonging to the line's institution_id"*

can be enforced via a simple database `CHECK` constraint on `JournalLine`.

### 2.1 The Technical Limitation of PostgreSQL `CHECK` Constraints
Under ANSI SQL standards and PostgreSQL engine specifications:
1. A `CHECK` constraint evaluates expressions **strictly within the boundary of the individual row being inserted or updated**.
2. A `CHECK` constraint **cannot execute a subquery**, cannot access another table, and cannot evaluate `WHERE EXISTS (SELECT 1 FROM "Branch" b WHERE b.id = NEW.branch_id AND b.institution_id = NEW.institution_id)`.
3. In PostgreSQL, attempting to include a subquery in a table or column `CHECK` constraint raises:
   ```sql
   ERROR: cannot use subquery in check constraint
   ```

Therefore, relying on a `CHECK` constraint alone leaves a catastrophic multi-tenant vulnerability:
A malicious or buggy query could insert a `JournalLine` where `institution_id = 'TENANT_A'` and `branch_id = 'BRANCH_OF_TENANT_B'`. A single-column foreign key `FOREIGN KEY (branch_id) REFERENCES "Branch"(id)` would verify that the branch exists in the database, but would be completely blind to the fact that it belongs to an entirely different tenant.

---

## 3. Comparative Evaluation: Option A vs. Option B

### Option A: Discriminator + Nullable Branch Foreign Key with Composite Key
In this model:
- `JournalLine` contains `dimension_type VARCHAR(20) NOT NULL` (values: `'HEAD_OFFICE'`, `'BRANCH'`).
- `JournalLine` contains `branch_id VARCHAR(36) NULL`.
- A check constraint enforces:
  ```sql
  CONSTRAINT chk_journal_line_dimension_safety CHECK (
      (dimension_type = 'HEAD_OFFICE' AND branch_id IS NULL) OR
      (dimension_type = 'BRANCH' AND branch_id IS NOT NULL)
  )
  ```
- Cross-tenant branch references are prevented via a **Composite Foreign Key**:
  ```sql
  CONSTRAINT fk_journal_line_branch_tenant
      FOREIGN KEY (institution_id, branch_id)
      REFERENCES "Branch"(institution_id, id)
      ON DELETE RESTRICT
  ```

### Option B: Dedicated `AccountingDimension` Entity (Polymorphic Table)
In this model:
- An intermediate table `accounting_dimensions` is introduced:
  - `id VARCHAR(36) PRIMARY KEY`
  - `institution_id VARCHAR(36) NOT NULL`
  - `dimension_type VARCHAR(20) NOT NULL` (`'HEAD_OFFICE'`, `'BRANCH'`)
  - `branch_id VARCHAR(36) NULL UNIQUE`
  - `name VARCHAR(100) NOT NULL`
- Every `JournalLine` has a non-nullable `dimension_id VARCHAR(36)` referencing `accounting_dimensions(id)`.
- For every new institution, a default `'HEAD_OFFICE'` dimension row must be seeded.
- For every branch created in `Branch`, an automated trigger or service hook must insert a corresponding `accounting_dimensions` row.

### 3.1 Architectural Trade-Off Analysis

| Criteria | Option A (Direct Discriminator + Composite FK) | Option B (Dedicated `AccountingDimension` Table) | Winner / Recommendation |
| :--- | :--- | :--- | :--- |
| **Relational Overhead** | Zero additional tables. Direct 1:1 join to `Branch` when dimension is `'BRANCH'`. | Requires 1 additional table (`accounting_dimensions`), additional foreign keys, and 1 extra join on every financial ledger query. | **Option A** |
| **Data Synchronization** | Single source of truth: `Branch` table. No lifecycle hooks, no dual-writes, no risk of unsynchronized dimension records. | Requires dual-write or database trigger whenever a Branch is created, renamed, or deactivated. High risk of sync drift. | **Option A** |
| **Storage & Index Footprint** | Extremely compact: 1 enum/varchar column + 1 nullable FK column indexed alongside tenant. | Additional synthetic UUIDs, additional indexes, overhead on high-frequency ledger rows. | **Option A** |
| **Tenant Safety Guarantee** | Guaranteed 100% at the engine level via PostgreSQL composite foreign key. | Guaranteed via foreign key, but requires composite FK on `(institution_id, dimension_id)` to prevent cross-tenant dimension assignment. | **Tie** |
| **Query Complexity** | Simple: `WHERE institution_id = $1 AND (branch_id = $2 OR $2 IS NULL)`. | Requires joining through `accounting_dimensions` to reach branch metadata. | **Option A** |
| **Synthetic Records Risk** | Zero synthetic branch records created in domain tables. Clean separation of Head Office. | Creates synthetic "Head Office" pseudo-dimension rows for every institution. | **Option A** |

**Independent Audit Conclusion:**  
**Option A is decisively superior.** Option B introduces unnecessary architectural bloat, synchronization fragility, and extra join penalties on high-throughput financial reports without providing any additional security or integrity benefits over Option A's composite foreign key.

---

## 4. The Authoritative Composite Foreign Key & Constraint Specification

To achieve mathematical certainty and 100% relational integrity for Option A, the database schema must implement the following three coordinated primitives:

### 4.1 Target Unique Constraint on `Branch`
In the Task 7.1 draft migration (`prisma/migrations/20261103000000_task_7_1_institution_branch/migration.sql`), `Branch` has a primary key `("id")` and a unique constraint `("institution_id", "code")`.

To allow `(institution_id, branch_id)` on `JournalLine` to reference `Branch`, PostgreSQL requires a UNIQUE constraint covering `(institution_id, id)`:
```sql
ALTER TABLE "Branch" 
    ADD CONSTRAINT uq_branch_institution_id 
    UNIQUE ("institution_id", "id");
```
*(Note: Because `id` is globally unique as a primary key, adding `(institution_id, id)` is logically redundant from an identity standpoint but syntactically mandatory in SQL to establish a multi-column foreign key).*

### 4.2 Composite Foreign Key on `JournalLine`
```sql
ALTER TABLE "journal_lines"
    ADD CONSTRAINT fk_journal_line_branch_tenant
    FOREIGN KEY ("institution_id", "branch_id")
    REFERENCES "Branch"("institution_id", "id")
    ON DELETE RESTRICT
    ON UPDATE RESTRICT;
```

#### How PostgreSQL Evaluates Nullable Columns in Composite Foreign Keys
Under ANSI SQL / PostgreSQL default `MATCH SIMPLE` foreign key semantics:
- When `dimension_type = 'BRANCH'`, `branch_id` is NOT NULL. Both `institution_id` and `branch_id` are populated. The PostgreSQL engine verifies that a row exists in `"Branch"` with the exact matching `institution_id` and `id`. Any cross-tenant reference is immediately rejected by the database engine with a foreign key violation.
- When `dimension_type = 'HEAD_OFFICE'`, `branch_id` is NULL. Under `MATCH SIMPLE`, if any column of a composite foreign key is NULL, the foreign key constraint is satisfied neutrally.
- Because `dimension_type = 'HEAD_OFFICE'` explicitly indicates that the transaction applies to the institution itself (Head Office), this is the mathematically exact behavior required.

### 4.3 Table-Level Check Constraint on `JournalLine`
To guarantee that a developer or query cannot set `dimension_type = 'BRANCH'` with a NULL `branch_id`, or `dimension_type = 'HEAD_OFFICE'` with an orphaned `branch_id`, the following check constraint is mandatory:
```sql
ALTER TABLE "journal_lines"
    ADD CONSTRAINT chk_journal_line_dimension_safety
    CHECK (
        (dimension_type = 'HEAD_OFFICE' AND branch_id IS NULL) OR
        (dimension_type = 'BRANCH' AND branch_id IS NOT NULL)
    );
```

---

## 5. Deletion & Lifecycle Constraints

### 5.1 Deletion Policy: Strict Prohibition (`ON DELETE RESTRICT`)
Financial accounting law and double-entry invariants prohibit the deletion of historical financial dimensions.
- If a physical branch is closed, relocated, or decommissioned, its historical ledger entries, balance sheets, and audit trails must remain permanently intact and reproducible.
- Therefore, the composite foreign key MUST specify `ON DELETE RESTRICT`.
- Attempting to delete a `Branch` record that has associated `JournalLine` rows will fail with a database foreign key violation.
- **Decommissioning Workflow:** Physical branches must only be deactivated via status transition (e.g., `status = 'INACTIVE'` or `status = 'DECOMMISSIONED'`), preserving historical immutability.

### 5.2 Posting-Time Application-Level Verification
In addition to database-level constraints, the TypeScript domain engine (`packages/shared/src/accounting/`) and persistence service must enforce:
1. **Tenant Active Verification:** Verify that `institution.status == 'ACTIVE'`.
2. **Branch Status Verification:** If `dimensionType == 'BRANCH'`, verify that `branch.status == 'ACTIVE'`. Posting new entries to a decommissioned branch must be blocked at the business logic layer.
3. **Account Operating Scope:** If an account in the Chart of Accounts is designated as "Head Office Only" (e.g., Central Retained Earnings, Central VAT Control), the service layer must reject posting lines with `dimensionType == 'BRANCH'`.

---

## 6. Audit Verdict on Dimension Integrity

| Audit Requirement | Verification Result | Status |
| :--- | :--- | :--- |
| **Check Constraint Limitation Recognized** | Fully documented and demonstrated; SQL subqueries cannot run in `CHECK`. | **VERIFIED** |
| **Multi-Tenant Protection Mechanism** | Explicitly defined via Composite Foreign Key `(institution_id, branch_id) -> Branch(institution_id, id)`. | **APPROVED** |
| **Head Office Modeling** | Evaluated and confirmed: represented via `dimension_type = 'HEAD_OFFICE'` with `branch_id = NULL`; no synthetic 59th entity created. | **APPROVED** |
| **Deletion Protection** | Strict `ON DELETE RESTRICT` specified across all dimension relations. | **APPROVED** |
| **Implementation Prerequisites** | Identified dependency on Task 7.1 migration and composite unique constraint on `Branch`. | **NOTED** |

**Conclusion:**  
The dimension integrity architecture specified in Phase 2.0A.1 and formalized herein satisfies all requirements for multi-tenant isolation, immutable auditability, and database engine enforcement.

