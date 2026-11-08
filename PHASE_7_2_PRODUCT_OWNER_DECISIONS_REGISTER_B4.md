# OX-DIGITAL Education
# Task 7.2 — Product Owner Decision Register
## Revision: B.4 — Workshop Decisions & Policy Selections

**Workspace:** `D:\OX-DIGITAL\Mathe\OX-DIGITAL-GITHUB`  
**GitHub Repository:** `https://github.com/hosamsamer019/ox-digital-Education.git`  
**Current Git HEAD:** `0500b93e65c24ed881349c4acea7f523332c5e9f` (branch `main`)  
**Workshop Date:** November 2, 2026  
**Implementation Authorization:** STRICTLY NOT GRANTED  
**Database/Migration Authorization:** STRICTLY NOT GRANTED  

---

## 1. Executive Workshop Preamble

This register documents the explicit policy determinations and technical architectural selections rendered by the **Product Owner** during the **Stage B.4 Interactive Decision Workshop**.

In strict accordance with the Task 7.2 governance framework:
- Selections recorded below represent the definitive choices of the Product Owner for the Stage B design baseline.
- All selections are classified as `PROVISIONAL_PRODUCT_OWNER_SELECTION` or `PROPOSED_TECHNICAL_DIRECTION_SELECTED` pending formal executive sign-off in the Stage C review gate.
- **Zero implementation, code changes, schema alterations, or database migrations are authorized by this document.**

---

## 2. Product Owner Selections: Task 7.2 Core Decisions

### OD-721 — Pricing Management Authority
- **Selected Option:** `PRIMARY_MANAGER_ONLY`
- **Governance Status:** `PROVISIONAL_PRODUCT_OWNER_SELECTION`
- **Date Selected:** November 2, 2026
- **Product Owner Selection:** Strictly centralized control; only the institution's designated Primary Manager can create, edit draft prices, publish price versions, configure branch-specific overrides, supersede prices, and retire catalog items. Branch staff have zero write access.
- **Technical Impact:**
  - Enforced in API Gateway and domain services via `assertPrimaryManagerPricingAuthority(tenantContext)`.
  - Requires `isPrimaryManager === true` and `role === 'PRIMARY_MANAGER'` matching `institutionId`.
  - Platform Super-Admin (`admin@edu.com`) is hard-blocked from institutional catalog management (OD-703, OD-718).
- **Financial Impact:** Eliminates unauthorized campus discounting, rogue fee modifications, and revenue leakage.
- **Remaining Conditions:** Stage D unit tests verifying RBAC rejection for non-Primary Manager roles.

---

### OD-722 — Physical Session Package Policy

#### OD-722.1: Session Consumption Trigger
- **Selected Option:** `PRESENT_ONLY`
- **Governance Status:** `PROVISIONAL_PRODUCT_OWNER_SELECTION`
- **Product Owner Selection:** A session is consumed **only** when attendance status is explicitly recorded as `PRESENT`. Absences (excused or unexcused) never consume sessions.
- **Technical Impact:** Real-time trigger on `Attendance` check-in creates `SessionConsumption` referencing `attendanceId` with `@@unique([attendanceId])`.
- **Financial Impact:** Revenue recognized only upon verified pedagogical service delivery (OD-704, OD-705).

#### OD-722.2: Unused Session Expiration
- **Selected Option:** `CONFIGURABLE_PER_PACKAGE`
- **Governance Status:** `PROVISIONAL_PRODUCT_OWNER_SELECTION`
- **Product Owner Selection:** Expiration rules and validity windows are configured per package template (e.g. 90 days from activation or end of term).
- **Technical Impact:** `SessionPackage` stores `validTo: DateTime?`. Scheduled worker amortizes remaining unconsumed balances upon expiration.
- **Financial Impact:** Transfers unconsumed deferred liabilities to recognized expired package revenue upon term conclusion.

#### OD-722.3: Package Refund Policy
- **Selected Option:** `CONFIGURABLE_PER_PACKAGE`
- **Governance Status:** `PROVISIONAL_PRODUCT_OWNER_SELECTION`
- **Product Owner Selection:** Refundability is defined per package contract terms, subject to mandatory statutory consumer protection laws.
- **Technical Impact:** `SessionPackage` stores `isRefundable: Boolean` and `refundPolicyTerms: String`.
- **Financial Impact:** Protects institutional cash flow while respecting statutory legal withdrawal mandates.

#### OD-722.4: Accounting Valuation Method
- **Selected Option:** `EQUAL_ALLOCATION`
- **Governance Status:** `PROVISIONAL_PRODUCT_OWNER_SELECTION`
- **Product Owner Selection:** Straight-line equal valuation ($\text{Net Package Price} \div \text{Total Sessions}$) recognized per completed session.
- **Technical Impact:** `SessionPackage.unitSessionPrice = Decimal(12,2)`. Each consumption debits `Deferred Revenue` and credits `Earned Tuition Revenue` by `unitSessionPrice`.
- **Financial Impact:** Perfect matching of earned revenue with attendance delivery.

#### OD-722.5: Cancellations, Late Cancellations & Make-Up Sessions
- **Selected Option:** `TEACHER_RESTORES_STUDENT_RESTORES_ON_NOTICE`
- **Governance Status:** `PROVISIONAL_PRODUCT_OWNER_SELECTION`
- **Product Owner Selection:** Teacher/institution cancellation automatically restores the consumed session. Student cancellation submitted before policy deadline restores the session. Late cancellation without notice consumes the session. Make-up attendance creates a distinct, new attendance record.
- **Technical Impact:** Generates compensating `SessionAdjustment(type: 'CANCELLATION_REVERSAL', sessionDelta: +1)` to restore balance. Make-up check-in creates a separate `SessionConsumption` entry.
- **Financial Impact:** Prevents teacher labor cost waste while maintaining fair student attendance incentives.

---

### OD-723 — Price Version Immutability
- **Selected Option:** `PURE_APPEND_ONLY_VERSIONING`
- **Governance Status:** `PROPOSED_TECHNICAL_DIRECTION_SELECTED`
- **Date Selected:** November 2, 2026
- **Product Owner Selection:** Published price versions are strictly write-once. Price modifications create new sequential version rows. Zero in-place row mutations.
- **Technical Impact:**
  - `PriceVersion` eliminates the `effectiveTo` column.
  - Active version resolved by:
    ```sql
    SELECT * FROM price_versions 
    WHERE catalog_item_id = $1 AND status = 'PUBLISHED' AND effective_from <= $2 
    ORDER BY effective_from DESC, version_number DESC LIMIT 1;
    ```
  - Concurrency collision prevented via `@@unique([catalogItemId, versionNumber])`.
- **Financial Impact:** 100% cryptographic auditability; historical contracts retain their exact agreed price snapshots (`AgreementPriceSnapshot`).
- **Remaining Conditions:** Formal Stage C sign-off.

---

### OD-724 — Legacy Enrollment Transition

#### OD-724.1: Grace Period Duration
- **Selected Option:** `60_DAYS`
- **Governance Status:** `PROVISIONAL_PRODUCT_OWNER_SELECTION`
- **Product Owner Selection:** 60 calendar days transition grace period for eligible legacy enrollments.
- **Technical Impact:** `graceDeadline = institutionMigrationDate + 60 days`. Grandfathered agreements set `endsAt = graceDeadline`.
- **Financial Impact:** Provides a structured 2-month window for student commercial onboarding without revenue drop-off.

#### OD-724.2: Grace Period Start Date
- **Selected Option:** `INSTITUTION_MIGRATION_DATE`
- **Governance Status:** `PROVISIONAL_PRODUCT_OWNER_SELECTION`
- **Product Owner Selection:** Uniform institution-wide deadline calculated from the official institution migration activation date.
- **Technical Impact:** All legacy enrollments share an identical, synchronized expiration timestamp. Simplifies batch expiration sweeping.
- **Financial Impact:** Predictable renewal cutover across the entire student population.

#### OD-724.3: Expiration Access Behavior
- **Selected Option:** `AUTOMATIC_HARD_CUTOFF`
- **Governance Status:** `PROVISIONAL_PRODUCT_OWNER_SELECTION`
- **Product Owner Selection:** Access ends automatically at the grace deadline. An active `SubscriptionAgreement` under the new catalog is mandatory to regain access.
- **Technical Impact:** Dynamic access evaluator (`checkLmsAccess`) denies access immediately when `now() > graceDeadline`.
- **Financial Impact:** Eliminates perpetual free access leakage.

#### OD-724.4: Unmapped Legacy Records
- **Selected Option:** `COLD_ARCHIVE_WITH_MANUAL_REVIEW`
- **Governance Status:** `PROVISIONAL_PRODUCT_OWNER_SELECTION`
- **Product Owner Selection:** Unmapped or ambiguous legacy records remain inaccessible in cold archive (OD-720). Can only be restored through documented Primary Manager mapping and approval. Zero synthetic entities permitted.
- **Technical Impact:** Quarantined records excluded from conversion scripts; administrative review UI provided in Stage D.
- **Financial Impact:** Prevents cross-tenant revenue attribution corruption.

---

### OD-725 — Initial Currency Policy
- **Selected Option:** `EGP_LAUNCH_WITH_SCHEMA_EXTENSIBILITY`
- **Governance Status:** `PROVISIONAL_PRODUCT_OWNER_SELECTION`
- **Date Selected:** November 2, 2026
- **Product Owner Selection:** Egyptian Pound (`EGP`) is the sole operating currency for launch. Data models store ISO-4217 code (`VarChar(3)`) to enable seamless future multi-currency support without schema rewrites.
- **Technical Impact:** `Decimal(12,2)` amounts with `currency = 'EGP'`. Multi-currency conversion logic and FX ledgers remain disabled until UP-712 approval.
- **Financial Impact:** Eliminates foreign exchange volatility and balance-sheet revaluation complexity during initial rollout.

---

### OD-726 — Subscription Renewal Model

#### OD-726.1: Customer Acceptance Policy
- **Selected Option:** `AUTOMATIC_RENEWAL_WITH_EXPLICIT_OPT_IN`
- **Governance Status:** `PROVISIONAL_PRODUCT_OWNER_SELECTION`
- **Product Owner Selection:** Recurring automated renewal is permitted **only** when the student/parent explicitly opted in during initial checkout; otherwise, manual renewal acceptance is mandatory.
- **Technical Impact:** `SubscriptionAgreement.autoRenew: Boolean`. If `false`, agreement transitions to `EXPIRED` at `endsAt`. If `true`, billing worker triggers successor agreement creation.
- **Financial Impact:** Balances recurring revenue retention with consumer opt-in protection.

#### OD-726.2: Renewal Pricing Rule
- **Selected Option:** `CURRENT_PUBLISHED_CATALOG_PRICE`
- **Governance Status:** `PROVISIONAL_PRODUCT_OWNER_SELECTION`
- **Product Owner Selection:** The successor renewal agreement applies the active published catalog price effective on the renewal date.
- **Technical Impact:** Renewal generator resolves current price via `GET /api/v1/pricing/resolve` rather than copying the prior snapshot.
- **Financial Impact:** Protects institutional profit margins against academic inflation and currency devaluation.

#### OD-726.3: Early Renewal Service Period
- **Selected Option:** `CONTIGUOUS_EXTENSION`
- **Governance Status:** `PROVISIONAL_PRODUCT_OWNER_SELECTION`
- **Product Owner Selection:** Early renewal service term begins immediately after the current agreement's `endsAt` date, seamlessly extending the subscription term without losing remaining paid days.
- **Technical Impact:** `newAgreement.startsAt = currentAgreement.endsAt`, preserving contiguous service continuity.
- **Financial Impact:** Encourages early payment without penalizing students.

---

## 3. Product Owner Selections: Financial Policy Gates

| Policy Gate | Canonical Topic | Selected Policy / Workshop Determination | Governance Status |
|---|---|---|---|
| **UP-701** | Statutory Chart of Accounts | `SPECIALIST_REVIEW_MANDATORY`: Certified Egyptian accountant must review and approve standard Chart of Accounts before Task 7.5 implementation. | `POLICY_GATED_PENDING_SPECIALIST` |
| **UP-702** | Egyptian VAT & ETA Invoicing | `EXTERNAL_TAX_OPINION_REQUIRED`: Qualified Egyptian tax counsel written opinion required for VAT status and ETA e-invoicing/e-receipt requirements before Task 7.3. Schema supports multi-tax categories. | `POLICY_GATED_PENDING_SPECIALIST` |
| **UP-706** | Cancellation Deductions | `STATUTORY_AND_ADMIN_FEE`: Pro-rata refund for unserved educational periods minus a fixed administrative processing fee, subject to Egyptian consumer protection law review. | `PROVISIONAL_PRODUCT_OWNER_SELECTION` |
| **UP-707** | Fiscal Calendar | `PARAMETERIZED_PER_INSTITUTION`: Each institution configures its fiscal year start month (`fiscalYearStartMonth`), supporting Egyptian academic (July–June) and international (Jan–Dec) cycles. | `PROVISIONAL_PRODUCT_OWNER_SELECTION` |
| **UP-709** | Staff Financial Thresholds | `DUAL_APPROVAL_MAKER_CHECKER`: Primary Manager approval required for manual discounts > 10% or adjustments > 500 EGP. Cashiers have collection-only rights. | `PROVISIONAL_PRODUCT_OWNER_SELECTION` |
| **UP-712** | Multi-Currency Enablement | Deferred until international student expansion; data models ISO-4217 compliant. | `DEFERRED` |
| **UP-713** | Legal Entity Structure | To be determined by institutional legal counsel during tenant onboarding. | `POLICY_GATED_PENDING_SPECIALIST` |
| **UP-714** | Hybrid Package Valuation | `UNBUNDLED_ITEMIZED_ALLOCATION`: Hybrid packages itemize discrete physical classroom fees (attributed to campus) and digital LMS platform access (attributed to online branch) for distinct revenue amortization. | `PROVISIONAL_PRODUCT_OWNER_SELECTION` |
| **UP-715** | User Deletion vs Retention | `STATUTORY_RETENTION_WITH_PII_SCRUBBING`: Preserve immutable `userId` references on financial records for statutory 5-to-10-year retention under Egyptian Commercial Code, while scrubbing/anonymizing PII upon user deletion under Law 151/2020. | `PROVISIONAL_PRODUCT_OWNER_SELECTION` |

---

## 4. Explicit Governance Statement

```
TASK 7.2 STAGE B.4 — PRODUCT OWNER DECISION WORKSHOP — NO IMPLEMENTATION OR DATABASE AUTHORIZATION
```

