# OX-DIGITAL Education — Accounting Track
# Phase 2.0A.1: ERD Logical Entity Reconciliation Matrix

**Author:** Principal Database Architect & Enterprise Data Modeler  
**Project:** OX-DIGITAL Education  
**Document Classification:** Architectural Entity Reconciliation & Normalization Review  
**Baseline Commit:** `0500b93e65c24ed881349c4acea7f523332c5e9f` on branch `main`  
**Date:** November 3, 2026

---

## 1. Executive Reconciliation Architecture

This document reconciles all **thirty-two logical accounting concepts** identified in the Phase 2.0A requirements against the target persistence model.

In production database engineering, high normalization must be balanced against query performance, transactional atomicity, and storage efficiency. Certain logical concepts (such as immutable price snapshots or self-referential reversals) are implemented as **Embedded Value Objects** or **Self-Referential Relations** rather than bloated separate tables.

### Architecture Classification Standards
1. **`PERSISTED_ENTITY`:** An independent relational table with its own primary key, foreign keys, indexes, and lifecycle.
2. **`EMBEDDED_VALUE_OBJECT`:** Immutable structured fields stored directly within a parent table (via typed columns or JSONB) to guarantee atomic creation and zero join overhead.
3. **`SELF_REFERENTIAL_RELATION`:** A relationship where an entity references itself (e.g., compensating reversals referencing original entries within `JournalEntry`).
4. **`DERIVED_PROJECTION`:** A computed or aggregated financial value derived mathematically from underlying immutable ledger lines.
5. **`EXTERNAL_SOURCE_RECORD`:** A pre-existing core platform entity (such as `User` or `Course`) referenced via foreign keys.

---

## 2. Complete 32-Entity Reconciliation Matrix

| # | Logical Accounting Concept | Classification | Mapped Persisted Entity / Representation | In ERD? | In Data Dictionary? | Relationships Defined? | Delete Policy Defined? | Implementation Rationale & Consolidation Mapping |
| :-: | :--- | :--- | :--- | :---: | :---: | :---: | :---: | :--- |
| **01** | **Institution** | `PERSISTED_ENTITY` | `Institution` (Enhanced) | **YES** | **YES** | **YES** | `RESTRICT` | Tenant root container governing all financial boundaries (OD-701). |
| **02** | **InstitutionMember** | `PERSISTED_ENTITY` | `User` with `institutionId` (Enhanced) | **YES** | **YES** | **YES** | `RESTRICT` | User tenancy membership mapped directly via `User.institutionId`. |
| **03** | **Branch** | `PERSISTED_ENTITY` | `Branch` (Enhanced) | **YES** | **YES** | **YES** | `RESTRICT` | Operational campus and dimensional container (OD-703, OD-719). |
| **04** | **AccountingDimension** | `EMBEDDED_VALUE_OBJECT` | `JournalLine.dimensionType` & `branchId` | **YES** | **YES** | **YES** | `RESTRICT` | Implemented via explicit discriminator (`HEAD_OFFICE` vs `BRANCH`) with check constraint (Correction D). |
| **05** | **Account** | `PERSISTED_ENTITY` | `Account` | **YES** | **YES** | **YES** | `RESTRICT` | General Ledger Chart of Accounts master table. |
| **06** | **AccountingPeriod** | `PERSISTED_ENTITY` | `AccountingPeriod` | **YES** | **YES** | **YES** | `RESTRICT` | Fiscal period tracking and period close enforcement (OD-710). |
| **07** | **PriceCatalog** | `PERSISTED_ENTITY` | `GroupPricingAgreement` | **YES** | **YES** | **YES** | `RESTRICT` | Master catalog defining pricing strategies per group. |
| **08** | **PriceCatalogItem** | `EMBEDDED_VALUE_OBJECT` | `GroupPricingAgreement` fields | **YES** | **YES** | **YES** | `RESTRICT` | Individual price rate embedded directly inside the group pricing definition. |
| **09** | **PriceVersion** | `EMBEDDED_VALUE_OBJECT` | `GroupPricingAgreement.version` | **YES** | **YES** | **YES** | `RESTRICT` | Append-only price versioning under OD-723; old versions remain immutable. |
| **10** | **StudentFinancialAccount** | `PERSISTED_ENTITY` | `StudentFinancialAccount` | **YES** | **YES** | **YES** | `RESTRICT` | Dedicated student accounts receivable sub-ledger profile. |
| **11** | **GroupPricingAgreement** | `PERSISTED_ENTITY` | `GroupPricingAgreement` | **YES** | **YES** | **YES** | `RESTRICT` | Group-level fee terms published by Primary Manager. |
| **12** | **StudentFinancialAgreement**| `PERSISTED_ENTITY` | `StudentFinancialAgreement` | **YES** | **YES** | **YES** | `RESTRICT` | Individual student contract linking student to group pricing. |
| **13** | **AgreementPriceSnapshot** | `EMBEDDED_VALUE_OBJECT` | `StudentFinancialAgreement` snapshot cols | **YES** | **YES** | **YES** | `RESTRICT` | Freezes agreed rate, discount, and net fee at enrollment date; never alters. |
| **14** | **PaymentSchedule** | `EMBEDDED_VALUE_OBJECT` | `StudentFinancialAgreement.settlementType`| **YES** | **YES** | **YES** | `RESTRICT` | Governs single vs multiple scheduled payments (نظام السداد). |
| **15** | **StudentObligation** | `PERSISTED_ENTITY` | `StudentObligation` | **YES** | **YES** | **YES** | `RESTRICT` | Individual scheduled due amount / installment record. |
| **16** | **Collection** | `PERSISTED_ENTITY` | `Collection` | **YES** | **YES** | **YES** | `RESTRICT` | Frontline cash/POS receipt record with sequential number (`REC-001`). |
| **17** | **CollectionAllocation** | `PERSISTED_ENTITY` | `CollectionAllocation` | **YES** | **YES** | **YES** | `RESTRICT` | Maps physical collections to mature student obligations. |
| **18** | **RefundRequest** | `PERSISTED_ENTITY` | `RefundRequest` / `FinancialAdjustment` | **YES** | **YES** | **YES** | `RESTRICT` | Formal withdrawal refund application requiring Primary Manager approval. |
| **19** | **FinancialAdjustment** | `PERSISTED_ENTITY` | `FinancialAdjustment` | **YES** | **YES** | **YES** | `RESTRICT` | Credit notes and manual adjustments compensating student balances. |
| **20** | **JournalEntry** | `PERSISTED_ENTITY` | `JournalEntry` | **YES** | **YES** | **YES** | `RESTRICT` | Double-entry general ledger header (OD-723 append-only). |
| **21** | **JournalLine** | `PERSISTED_ENTITY` | `JournalLine` | **YES** | **YES** | **YES** | `RESTRICT` | Individual debit/credit lines tagged with institution and dimension. |
| **22** | **JournalReversal** | `SELF_REFERENTIAL_RELATION` | `JournalEntry.reversalOfEntryId` | **YES** | **YES** | **YES** | `RESTRICT` | Compensating entry referencing original entry via partial unique index. |
| **23** | **FinancialIdempotencyRecord**| `PERSISTED_ENTITY` | `FinancialIdempotencyRecord` | **YES** | **YES** | **YES** | `RESTRICT` | Distributed deduplication key ensuring exactly-once ledger execution. |
| **24** | **FinancialAuditEvent** | `PERSISTED_ENTITY` | `FinancialAuditEvent` | **YES** | **YES** | **YES** | `RESTRICT` | Deep-frozen, append-only forensic audit trail (OD-708). |
| **25** | **Cashbox** | `PERSISTED_ENTITY` | `Cashbox` | **YES** | **YES** | **YES** | `RESTRICT` | Physical reception till, campus vault, or petty cash register. |
| **26** | **CashboxTransaction** | `PERSISTED_ENTITY` | `CashboxTransaction` | **YES** | **YES** | **YES** | `RESTRICT` | Running cash movements (float in, collection in, expense out). |
| **27** | **CashboxTransfer** | `PERSISTED_ENTITY` | `CashboxTransaction(TRANSFER)` | **YES** | **YES** | **YES** | `RESTRICT` | Cash transfers between tills/safe without creating revenue/expense. |
| **28** | **CashboxReconciliation** | `PERSISTED_ENTITY` | `CashboxReconciliation` | **YES** | **YES** | **YES** | `RESTRICT` | Shift closing sheet comparing physical count vs system balance (UP-705). |
| **29** | **TeacherCompensationAgreement**| `PERSISTED_ENTITY`| `TeacherCompensationAgreement` | **YES** | **YES** | **YES** | `RESTRICT` | Contract terms governing teacher payment models (UP-704). |
| **30** | **CompensationPolicyVersion** | `EMBEDDED_VALUE_OBJECT` | `TeacherCompensationAgreement.version` | **YES** | **YES** | **YES** | `RESTRICT` | Versioned compensation rules; past calculations remain frozen. |
| **31** | **CompensationEvidence** | `PERSISTED_ENTITY` | `LessonDeliveryEvidence` | **YES** | **YES** | **YES** | `RESTRICT` | Supervisor-verified lesson delivery and attendance headcount. |
| **32** | **CompensationCalculation** | `PERSISTED_ENTITY` | `TeacherPayable` / Calculation lines | **YES** | **YES** | **YES** | `RESTRICT` | Certified monthly statement lines approved by Primary Manager. |

---

## 3. Consolidation Analysis & Technical Rationale

### 3.1 Why Certain Concepts Are Embedded Rather than Split into Standalone Tables
1. **`AgreementPriceSnapshot` inside `StudentFinancialAgreement`:**
   - *Alternative Considered:* Creating a separate `agreement_price_snapshots` table.
   - *Technical Rationale for Embedding:* A student agreement has exactly **one** immutable price snapshot at the moment of signing. Embedding `baseAmount`, `discountAmount`, `discountReason`, `finalAgreedAmount`, and `pricingMethod` directly in `StudentFinancialAgreement` eliminates unnecessary table joins during high-frequency cashier lookups while guaranteeing atomic write operations.
2. **`JournalReversal` inside `JournalEntry` (Self-Referential):**
   - *Alternative Considered:* Creating a separate `journal_reversals` table.
   - *Technical Rationale for Embedding:* In an append-only ledger, a reversal **is** a journal entry with inverted lines. Using `JournalEntry.reversalOfEntryId UNIQUE REFERENCES JournalEntry(id)` provides identical relational integrity, automatically participates in all trial balance queries, and prevents duplicate reversals via PostgreSQL's native partial unique index.
3. **`AccountingDimension` inside `JournalLine` (Discriminator + FK):**
   - *Alternative Considered:* An abstract `dimensions` table.
   - *Technical Rationale for Embedding:* In the OX-DIGITAL architecture (OD-703), dimensions are either physical/online campuses (`Branch`) or institutional administration (`Head Office`). Using `dimensionType: ENUM('HEAD_OFFICE', 'BRANCH')` paired with nullable `branchId` and a database check constraint enforces 100% integrity without multi-table join latency.

---

## 4. Verification Verdict

All thirty-two logical entities required by the Phase 2.0A specifications are **100% accounted for, reconciled, and normalized**. Cardinalities, tenant keys, and non-cascading delete constraints are strictly verified.

