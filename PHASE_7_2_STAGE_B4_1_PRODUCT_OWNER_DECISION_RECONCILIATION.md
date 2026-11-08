# OX-DIGITAL Education — Task 7.2
## Stage B.4.1: Product Owner Decision Reconciliation Baseline

**Workspace:** `D:\OX-DIGITAL\Mathe\OX-DIGITAL-GITHUB`  
**GitHub Repository:** `https://github.com/hosamsamer019/ox-digital-Education.git`  
**Current Git HEAD:** `0500b93e65c24ed881349c4acea7f523332c5e9f` (branch `main`)  
**Phase:** 7.2 — Pricing Catalog & Subscription Agreements  
**Stage:** Stage B.4.1 — Policy Reconciliation, Financial Rules & Architecture Refinement  
**Date:** November 2, 2026  
**Execution Mode:** DOCUMENTATION-ONLY POLICY RECONCILIATION  
**Implementation Authorization:** STRICTLY NOT GRANTED  
**Database/Migration Authorization:** STRICTLY NOT GRANTED  

---

## 1. Governance Preamble & Baseline Hierarchy

This document establishes the **authoritative, reconciled baseline** for all business, operational, contract, and accounting decisions governing Task 7.2. It synthesizes the outcomes of the Stage B.4 Product Owner Decision Workshop, addresses cross-policy interactions, and incorporates technical safeguards.

### Historical Lineage & Document Precedence:
1. **Precedent Foundation (Immutable):** OD-701 through OD-720 remain fully authoritative.
2. **Prior Review Records (Preserved):** 
   - [`PHASE_7_2_STAGE_B1_FINAL_DECISION_MATRIX.md`](file:///D:/OX-DIGITAL/Mathe/OX-DIGITAL-GITHUB/PHASE_7_2_STAGE_B1_FINAL_DECISION_MATRIX.md)
   - [`PHASE_7_2_PRODUCT_OWNER_DECISIONS_REGISTER_B2.md`](file:///D:/OX-DIGITAL/Mathe/OX-DIGITAL-GITHUB/PHASE_7_2_PRODUCT_OWNER_DECISIONS_REGISTER_B2.md)
   - [`PHASE_7_2_STAGE_B2_TECHNICAL_VALIDATION.md`](file:///D:/OX-DIGITAL/Mathe/OX-DIGITAL-GITHUB/PHASE_7_2_STAGE_B2_TECHNICAL_VALIDATION.md)
   - [`PHASE_7_2_PRODUCT_OWNER_DECISIONS_REGISTER_B3.md`](file:///D:/OX-DIGITAL/Mathe/OX-DIGITAL-GITHUB/PHASE_7_2_PRODUCT_OWNER_DECISIONS_REGISTER_B3.md)
   - [`PHASE_7_2_STAGE_B3_CROSS_DOCUMENT_CONSISTENCY.md`](file:///D:/OX-DIGITAL/Mathe/OX-DIGITAL-GITHUB/PHASE_7_2_STAGE_B3_CROSS_DOCUMENT_CONSISTENCY.md)
   - [`PHASE_7_2_STAGE_B3_TECHNICAL_EVIDENCE_MATRIX.md`](file:///D:/OX-DIGITAL/Mathe/OX-DIGITAL-GITHUB/PHASE_7_2_STAGE_B3_TECHNICAL_EVIDENCE_MATRIX.md)
   - [`PHASE_7_2_STAGE_B3_FINAL_READINESS_REPORT.md`](file:///D:/OX-DIGITAL/Mathe/OX-DIGITAL-GITHUB/PHASE_7_2_STAGE_B3_FINAL_READINESS_REPORT.md)
   - [`PHASE_7_2_PRODUCT_OWNER_DECISIONS_REGISTER_B4.md`](file:///D:/OX-DIGITAL/Mathe/OX-DIGITAL-GITHUB/PHASE_7_2_PRODUCT_OWNER_DECISIONS_REGISTER_B4.md)
   - [`PHASE_7_2_STAGE_B4_ARCHITECTURE_IMPACT_ASSESSMENT.md`](file:///D:/OX-DIGITAL/Mathe/OX-DIGITAL-GITHUB/PHASE_7_2_STAGE_B4_ARCHITECTURE_IMPACT_ASSESSMENT.md)
   - [`PHASE_7_2_STAGE_B4_UNRESOLVED_POLICY_GATES.md`](file:///D:/OX-DIGITAL/Mathe/OX-DIGITAL-GITHUB/PHASE_7_2_STAGE_B4_UNRESOLVED_POLICY_GATES.md)
   - [`PHASE_7_2_STAGE_B4_FINAL_WORKSHOP_REPORT.md`](file:///D:/OX-DIGITAL/Mathe/OX-DIGITAL-GITHUB/PHASE_7_2_STAGE_B4_FINAL_WORKSHOP_REPORT.md)
3. **Current Active Canonical Baseline:** This Stage B.4.1 suite (`PHASE_7_2_STAGE_B4_1_*`) supersedes prior draft inconsistencies while strictly preserving the Product Owner's workshop selections.

---

## 2. Reconciled Decision Inventory & Governance Status

```
+-----------------------------------------------------------------------------------------------------+
| STATUS TAXONOMY                                                                                     |
| - PROVISIONAL_PRODUCT_OWNER_SELECTION: Selected by the PO; pending formal Stage C sign-off.        |
| - PROPOSED_TECHNICAL_DIRECTION_SELECTED: Selected technical approach; unapproved as final policy. |
| - POLICY_GATED_PENDING_SPECIALIST: Awaiting external certified legal, tax, or accounting opinion.  |
| - PENDING_PRODUCT_OWNER_CLARIFICATION: Outstanding parameter requiring explicit executive policy.   |
+-----------------------------------------------------------------------------------------------------+
```

| Decision ID | Canonical Name | Selected Option / Reconciled Baseline | Current Governance Status | Technical Implications | Financial & Accounting Implications | Required External Review | Blocked by Task 7.1? |
|---|---|---|---|---|---|---|---|
| **OD-721** | Pricing Management Authority | `PRIMARY_MANAGER_ONLY` | `PROVISIONAL_PRODUCT_OWNER_SELECTION` | Hard-coded RBAC checks in API Gateway and domain services; branch staff have zero write access; Platform Super-Admin excluded (OD-703, OD-718). | Prevents unauthorized campus discounting and revenue leakage. Centralized pricing control. | None (Internal governance) | No (Can be drafted in code) |
| **OD-722.1** | Session Consumption Trigger | `PRESENT_ONLY` | `PROVISIONAL_PRODUCT_OWNER_SELECTION` | Real-time trigger on attendance `status == 'PRESENT'`; unique index on `SessionConsumption(attendanceId)`. | Consumption reflects verified pedagogical delivery; absences never consume prepaid sessions. | None (Internal policy) | No (Models drafted) |
| **OD-722.2** | Unused Session Expiration | `CONFIGURABLE_PER_PACKAGE` | `PROVISIONAL_PRODUCT_OWNER_SELECTION` | `SessionPackage` stores `validTo` and validity rules; expiration sweep job clears balances. | Amortizes unconsumed deferred liabilities into recognized expired package revenue upon term conclusion. | Consumer protection review for contract validity | No |
| **OD-722.3** | Package Refundability | `CONFIGURABLE_PER_PACKAGE` | `PROVISIONAL_PRODUCT_OWNER_SELECTION` | `SessionPackage` stores `isRefundable: Boolean` and contractual withdrawal terms. Subordinated to UP-706. | Reconciled under 6-tier policy hierarchy (see Document 2). Non-refundable terms subject to law. | Egyptian Consumer Protection Law (Law 181/2018) | No |
| **OD-722.4** | Session Accounting Valuation | `EQUAL_ALLOCATION` | `PROVISIONAL_PRODUCT_OWNER_SELECTION` | Net package consideration divided equally across sessions; minor-unit residual allocated deterministically. | Straight-line revenue recognition per completed session. Distinguishes operational consumption from accounting posting. | Certified Egyptian Accountant review (UP-701) | No |
| **OD-722.5** | Cancellations & Make-Ups | `TEACHER_RESTORES_STUDENT_RESTORES_ON_NOTICE` | `PROVISIONAL_PRODUCT_OWNER_SELECTION` | `SessionAdjustment` compensating reversal types (`TEACHER_CANCELLATION`, `STUDENT_NOTICE_CANCELLATION`). Make-ups create new records. | Compensating adjustment restores package entitlement without rewriting historical ledger transactions. | None (Internal policy) | No |
| **OD-723** | Price Version Immutability | `PURE_APPEND_ONLY_VERSIONING` | `PROPOSED_TECHNICAL_DIRECTION_SELECTED — NOT YET EXPLICITLY APPROVED AS FINAL POLICY` | `PriceVersion` eliminates `effectiveTo`; published prices are write-once; sequential `versionNumber`; resolved via index scan. | Absolute historical contract auditability; agreements freeze exact price snapshots (`AgreementPriceSnapshot`). | None (Architecture validation) | No |
| **OD-724** | Legacy Enrollment Transition | `FIXED_TRANSITION_GRACE_PERIOD` (60 Days from Activation) | `PROVISIONAL_PRODUCT_OWNER_SELECTION` | Grace period commences upon explicit `institutionMigrationActivatedAt` event; automated hard cutoff at $t+60\text{d}$; unmapped in cold archive. | Predictable 60-day commercial transition window; zero synthetic entities; eliminates perpetual free access leakage. | None (Internal policy) | **YES (Strictly Blocked by Task 7.1 Staging Backfill)** |
| **OD-725** | Initial Currency Policy | `EGP_LAUNCH_WITH_SCHEMA_EXTENSIBILITY` | `PROVISIONAL_PRODUCT_OWNER_SELECTION` | Operational currency fixed to Egyptian Pound (`EGP`); models maintain ISO-4217 code (`VarChar(3)`); FX engine disabled. | Eliminates foreign exchange risk and ledger translation adjustments during launch. | Egyptian Central Bank / Tax compliance | No |
| **OD-726** | Subscription Renewal Model | `NEW_AGREEMENT_PER_RENEWAL` (Opt-In Auto-Renew, Current Price, Contiguous) | `PROVISIONAL_PRODUCT_OWNER_SELECTION` | Successor agreement linked via `previousAgreementId`; auto-renew requires explicit opt-in; early renewal contiguously extends `endsAt`. | Protects recurring revenue while respecting consumer consent; prevents accidental double-charging. | Consumer protection review for auto-renewal disclosure | No |
| **UP-701** | Statutory Chart of Accounts | `SPECIALIST_REVIEW_MANDATORY` | `POLICY_GATED_PENDING_SPECIALIST` | Requires certified Egyptian Public Accountant review and sign-off on 5-digit institutional Chart of Accounts before Task 7.5 implementation. | Guarantees compliance with Egyptian Commercial Accounting Standards (EAS). | **Certified Egyptian Public Accountant** | No (Blocks Task 7.5) |
| **UP-702** | Egyptian VAT & ETA Invoicing | `EXTERNAL_TAX_OPINION_REQUIRED` | `POLICY_GATED_PENDING_SPECIALIST` | Multi-tax category schema support (`taxCategoryId`). Invoicing engine reserves fields for `etaUuid`, digital signatures, and National IDs. | Prepares platform for B2B e-Invoicing and B2C e-Receipt compliance without hard-coding premature tax exemptions. | **Qualified Egyptian Tax Counsel** | No (Blocks Task 7.3) |
| **UP-706** | Cancellation Admin Fee | `STATUTORY_AND_ADMIN_FEE` | `PROVISIONAL_PRODUCT_OWNER_SELECTION` | Automated credit note generation deducting administrative fee from unserved educational pro-rata refund. | Offsets gateway transaction overhead. Reconciled under refund policy hierarchy. Fee amounts pending legal review. | **Egyptian Commercial Legal Counsel** | No (Blocks Task 7.4) |
| **UP-707** | Fiscal Calendar Policy | `PARAMETERIZED_PER_INSTITUTION` | `PROVISIONAL_PRODUCT_OWNER_SELECTION` | General Ledger accounting intervals parameterized via `Institution.fiscalYearStartMonth` (1 to 12). | Supports Egyptian academic year (July–June) and international calendar year (Jan–Dec) reporting. | None (Internal parameter) | No (Blocks Task 7.5) |
| **UP-709** | Staff Approval Thresholds | `DUAL_APPROVAL_MAKER_CHECKER` | `PROVISIONAL_PRODUCT_OWNER_SELECTION` | Workflow engine requires Primary Manager dual approval for discounts > 10% or adjustments > 500 EGP. Cashiers collection-only. | Anti-splitting controls prevent threshold evasion. Enforces internal fiscal discipline. | None (Internal control) | No (Blocks Task 7.3 & 7.5) |
| **UP-712** | Multi-Currency Future Roadmap| `DEFERRED` | `DEFERRED` | Multi-currency accounting, currency translation, and FX ledger accounts deferred until international expansion. | Eliminates FX balance-sheet volatility. Schema remains ISO-4217 compliant. | Product Owner approval for future phase | No |
| **UP-713** | Legal Entity Formation | `POLICY_GATED_PENDING_SPECIALIST` | `POLICY_GATED_PENDING_SPECIALIST` | Institution profile records tax registration number, commercial registry, and licensing status (Ministry of Education vs training academy). | Determines output VAT liability and statutory invoice presentation requirements. | **Corporate Legal Advisor** | No (Blocks Task 7.3) |
| **UP-714** | Hybrid Package Valuation | `UNBUNDLED_ITEMIZED_ALLOCATION` | `PROVISIONAL_PRODUCT_OWNER_SELECTION` | Agreements itemize discrete physical classroom fees (attributed to physical campus) and digital LMS platform access (attributed to online branch). | Distinct revenue amortization schedules (attendance-based vs time-based) within single institutional general ledger (OD-702, OD-703). | Accounting policy review | No (Blocks Task 7.3 & 7.5) |
| **UP-715** | User Deletion & Retention | `STATUTORY_RETENTION_WITH_PII_SCRUBBING` | `PROVISIONAL_PRODUCT_OWNER_SELECTION` | Preserves immutable `userId` foreign keys on financial records for statutory retention, while PII is scrubbed under Law 151/2020. | Defends against tax audit penalties while respecting data privacy erasure mandates. Subject to legal review matrix. | **Data Privacy Legal Counsel** | No (Blocks Task 7.7) |

---

## 3. Explicit Governance Declaration

```
TASK 7.2 STAGE B.4.1 — DOCUMENTATION-ONLY POLICY RECONCILIATION — NO SOURCE, SCHEMA, DATABASE OR MIGRATION AUTHORIZATION
```

