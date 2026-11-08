# OX-DIGITAL Education — Task 7.2
## Stage B.4.2: Final Product Owner Decision Register

**Workspace:** `D:\OX-DIGITAL\Mathe\OX-DIGITAL-GITHUB`  
**GitHub Repository:** `https://github.com/hosamsamer019/ox-digital-Education.git`  
**Current Git HEAD:** `0500b93e65c24ed881349c4acea7f523332c5e9f` (branch `main`)  
**Phase:** 7.2 — Pricing Catalog & Subscription Agreements  
**Stage:** Stage B.4.2 — Final Product Owner Decision Closure & Implementation Authorization Readiness  
**Date:** November 2, 2026  
**Execution Mode:** STRICT READ-ONLY AUDIT + DOCUMENTATION ONLY  
**Implementation Authorization:** STRICTLY NOT GRANTED  
**Database/Migration Authorization:** STRICTLY NOT GRANTED  

---

## 1. Governance Preamble & Status Definitions

This register represents the **definitive, canonical record** of all architectural, business, and financial decisions governing Task 7.2. It synthesizes all determinations from Stages B, B.1, B.2, B.3, and B.4.1 into an auditable standard.

### Mandatory Status Taxonomy:
- **`APPROVED_BY_PRODUCT_OWNER`**: Formally and explicitly approved as final policy by the Product Owner. (Precedent decisions OD-701 through OD-720, and Task 7.2 decision OD-723 hold this status).
- **`PROVISIONAL_PRODUCT_OWNER_SELECTION`**: Selected by the Product Owner as the operational baseline; pending formal Stage C sign-off and prerequisite technical validation.
- **`PROPOSED_TECHNICAL_DIRECTION_SELECTED — NOT EXPLICITLY APPROVED AS FINAL POLICY`**: Recommended by engineering and selected as design direction; **not** approved as final binding policy.
- **`POLICY_GATED_PENDING_SPECIALIST`**: Selected in principle, but implementation is strictly blocked pending written opinion from external certified legal, tax, or accounting counsel.
- **`PENDING_PRODUCT_OWNER_CLARIFICATION`**: Specific operational parameter requiring explicit executive determination.

---

## 2. Reconciled Decision Register (OD-721 through OD-726)

### OD-721 — Pricing Management Authority
- **Exact Decision Statement:** Only the institution's designated Primary Manager may create, edit draft prices, publish price versions, configure branch-specific overrides, supersede prices, and retire catalog items. Branch staff have zero pricing write permissions. SaaS Platform Super-Admin (`admin@edu.com`) remains institutionally separate and barred from catalog management (OD-703, OD-718). Every pricing action records the actor user ID and timestamp.
- **Canonical Status:** `PROVISIONAL_PRODUCT_OWNER_SELECTION`
- **Classification:** Provisional Product Owner Selection.
- **Approving Authority:** Product Owner (formal Stage C sign-off).
- **Implementation Dependency:** Enforced in API Gateway and domain services via `assertPrimaryManagerPricingAuthority(tenantContext)`.
- **Evidence Classification:** `PARTIALLY_VERIFIED` (`Role.PRIMARY_MANAGER` in `schema.prisma:628`; `User.isPrimaryManager` in `schema.prisma:89`; middleware in `packages/shared/src/tenant/tenantContext.ts:37-168`; route pricing guards are `DESIGN_ONLY`).

---

### OD-722 — Physical Session Package Policy

#### OD-722.1: Session Consumption Trigger
- **Exact Decision Statement:** A prepaid physical session is consumed strictly upon recorded valid attendance where `status == 'PRESENT'`. Absences (excused or unexcused) never consume sessions.
- **Canonical Status:** `PROVISIONAL_PRODUCT_OWNER_SELECTION`
- **Classification:** Provisional Product Owner Selection.
- **Approving Authority:** Product Owner.
- **Implementation Dependency:** Real-time trigger on attendance check-in creating `SessionConsumption` with unique constraint on `attendanceId`.
- **Evidence Classification:** `PARTIALLY_VERIFIED` (`model Attendance` in `schema.prisma:291-302`; `SessionConsumption` is `DESIGN_ONLY`).

#### OD-722.2: Unused Session Expiration
- **Exact Decision Statement:** Unused session expiration is defined through package-specific contractual terms. Expiration rules and validity windows are configured per package template. No arbitrary platform default expiration is invented.
- **Canonical Status:** `PROVISIONAL_PRODUCT_OWNER_SELECTION`
- **Classification:** Provisional Product Owner Selection.
- **Approving Authority:** Product Owner.
- **Implementation Dependency:** `SessionPackage` stores `validTo: DateTime?` and validity rules; expiration sweep job clears balances.
- **Evidence Classification:** `DESIGN_ONLY`.

#### OD-722.3: Package Refundability
- **Exact Decision Statement:** Refundability is defined per package contract terms, subordinated to mandatory Egyptian statutory consumer protection law and the institution's approved refund policy (UP-706).
- **Canonical Status:** `PROVISIONAL_PRODUCT_OWNER_SELECTION`
- **Classification:** Provisional Product Owner Selection.
- **Approving Authority:** Product Owner + Egyptian Commercial Legal Counsel.
- **Implementation Dependency:** Governed by the 6-tier refund hierarchy; refunds execute strictly through compensating credit notes (zero deletions).
- **Evidence Classification:** `DESIGN_ONLY`.

#### OD-722.4: Session Accounting Valuation
- **Exact Decision Statement:** Package net consideration is allocated equally across all included sessions ($\text{Net Consideration} \div \text{Total Sessions}$), recognized straight-line per attended session, with minor-unit rounding residuals assigned deterministically. Operational session consumption is strictly decoupled from general ledger revenue recognition.
- **Canonical Status:** `PROVISIONAL_PRODUCT_OWNER_SELECTION`
- **Classification:** Provisional Product Owner Selection.
- **Approving Authority:** Product Owner + Certified Egyptian Public Accountant (UP-701).
- **Implementation Dependency:** Minor-unit allocation algorithm ($\sum V_i = P_{\text{net}}$); discounts applied to net consideration, never list price.
- **Evidence Classification:** `DESIGN_ONLY`.

#### OD-722.5: Cancellations, Late Cancellations & Make-Ups
- **Exact Decision Statement:** Teacher cancellation and student cancellation with timely notice restore the consumed session via compensating `SessionAdjustment`. Late cancellation without notice consumes the session. Make-up attendance creates a distinct, new attendance record.
- **Canonical Status:** `PROVISIONAL_PRODUCT_OWNER_SELECTION`
- **Classification:** Provisional Product Owner Selection.
- **Approving Authority:** Product Owner.
- **Implementation Dependency:** Compensating `SessionAdjustment(type: 'CANCELLATION_REVERSAL', sessionDelta: +1)` restores balance without rewriting historical ledger entries.
- **Evidence Classification:** `DESIGN_ONLY`.

---

### OD-723 — Price Version Immutability
- **Exact Decision Statement:** Published price versions are strictly write-once and never updated or deleted in place. Published price versions must never be modified in place. Any change to commercial pricing terms requires publishing a new immutable price version with an incremented sequential version number (`versionNumber`). `PriceVersion` eliminates the `effectiveTo` column. Historical agreements retain their original immutable price snapshots (`AgreementPriceSnapshot`), ensuring all historical contracts and pricing snapshots remain reproducible and cryptographically auditable. Active prices are resolved via index scan: `ORDER BY effective_from DESC, version_number DESC LIMIT 1`.
- **Canonical Status:** `APPROVED_BY_PRODUCT_OWNER`
- **Classification:** Approved Product Owner Decision.
- **Approving Authority:** Product Owner (Formally Approved).
- **Consequences of Formal Approval:** Guarantees 100% cryptographic auditability; published rates are immutable; historical contracts are fully insulated from price updates; eliminates row-level update locks and exclusion constraint overhead in database.
- **Consequences of Rejection:** N/A (Formally Approved).
- **Implementation Dependency:** Migration DDL for `PriceVersion` without `effectiveTo`.
- **Evidence Classification:** `DESIGN_ONLY`.

---

### OD-724 — Legacy Enrollment Transition
- **Exact Decision Statement:** Eligible legacy enrollments receive a 60 calendar day transition grace period terminating in an automated hard cutoff. The 60-day countdown begins **strictly upon explicit institution activation** (`institutionMigrationActivatedAt`) after Task 7.1 migration, authoritative backfill, 28-model reconciliation, tenant ownership validation, and security checks are completed in Staging. Unmapped records remain permanently quarantined in cold archive (OD-720) for manual review. Zero synthetic entities are created.
- **Outage Extension Policy:** The Product Owner has explicitly approved an extension equal to the verified duration of qualifying platform infrastructure outages that occur during the 60-day grace period. Before implementation, the outage evidence standard (e.g. synthetic monitor and uptime SLA telemetry), qualifying outage definition (e.g. total platform or billing unavailability > 15 consecutive minutes), calculation method (rounding up to whole hours/days), and approval/audit workflow (written Primary Manager petition and Platform Admin audit verification) must be documented.
- **Canonical Status:** `PROVISIONAL_PRODUCT_OWNER_SELECTION` (Operational parameters established; pending technical documentation).
- **Classification:** Provisional Product Owner Selection.
- **Approving Authority:** Product Owner.
- **Unresolved Parameter:** Qualifying outage technical telemetry integration and audit workflow documentation.
- **Implementation Dependency:** **STRICTLY BLOCKED BY TASK 7.1 STAGING MIGRATION AND BACKFILL.**
- **Evidence Classification:** `BLOCKED_BY_TASK_7_1`.

---

### OD-725 — Initial Currency Policy
- **Exact Decision Statement:** Operational pricing, agreements, and billing for initial release are denominated exclusively in Egyptian Pound (`EGP`). Data models store ISO-4217 currency code (`VarChar(3)`) to maintain future extensibility without schema churn. Multi-currency accounting and FX ledgers remain disabled until UP-712 is approved.
- **Canonical Status:** `PROVISIONAL_PRODUCT_OWNER_SELECTION`
- **Classification:** Provisional Product Owner Selection.
- **Approving Authority:** Product Owner.
- **Implementation Dependency:** `Decimal(12,2)` amounts with `currency: "EGP"`.
- **Evidence Classification:** `PARTIALLY_VERIFIED` (Legacy schema uses `Float` in `schema.prisma:155, 309`; target `Decimal` models are `DESIGN_ONLY`).

---

### OD-726 — Subscription Renewal Model
- **Exact Decision Statement:** Every renewal generates a distinct successor `SubscriptionAgreement` linked via `previousAgreementId`, preserving historical contracts unchanged. Automated recurring renewal is permitted **only** after explicit customer checkout opt-in. Renewals apply the current published catalog price on the renewal date. If the published catalog price has increased, an advance notice window of **exactly 30 calendar days** is required before the scheduled renewal date, and explicit customer re-consent is mandatory before charging the increased price. Early renewals contiguously extend service terms without overlapping or truncating already-paid days.
- **Canonical Status:** `PROVISIONAL_PRODUCT_OWNER_SELECTION` (30-day advance notice parameter selected; pending formal Stage C sign-off).
- **Classification:** Provisional Product Owner Selection.
- **Approving Authority:** Product Owner.
- **Implementation Dependency:** Compound unique constraint `@@unique([previousAgreementId, renewalCycleNumber])`; date calculation `newStartsAt = currentEndsAt`; 30-day scheduled event trigger for price increase notifications.
- **Evidence Classification:** `DESIGN_ONLY`.

---

## 3. Financial Policy Gates (UP-701 through UP-715)

| Decision ID | Canonical Topic & Decision Statement | Canonical Status | Classification | Approving Authority & Specialist Dependency | Implementation Dependency | Evidence Status |
|---|---|---|---|---|---|---|
| **UP-701** | **Statutory Chart of Accounts:** Standard 5-digit institutional COA must be reviewed and approved by a certified Egyptian accountant before Task 7.5 implementation. | `POLICY_GATED_PENDING_SPECIALIST` | Specialist Review Dependency | Certified Egyptian Public Accountant (مراقب حسابات قانوني) | Blocks Task 7.5 General Ledger | `DESIGN_ONLY` |
| **UP-702** | **Egyptian VAT & ETA Invoicing:** Multi-tax category schema supported (`taxCategoryId`). Qualified Egyptian tax counsel written opinion required before Task 7.3 to establish VAT Law 67/2016 status and ETA e-invoicing/e-receipt mandates. | `POLICY_GATED_PENDING_SPECIALIST` | Specialist Review Dependency | Qualified Egyptian Tax Counsel (مستشار ضريبي) | Blocks Task 7.3 Invoicing | `DESIGN_ONLY` |
| **UP-706** | **Cancellation & Refund Fees:** Pro-rata refund for unserved educational periods minus a fixed administrative processing fee, subject to Egyptian Consumer Protection Law (Law 181/2018) review. Fee amounts are not finalized. | `PROVISIONAL_PRODUCT_OWNER_SELECTION` | Provisional Selection + Specialist Dependency | Commercial Legal Counsel + Product Owner | Blocks Task 7.4 Payments | `DESIGN_ONLY` |
| **UP-707** | **Fiscal Calendar Policy:** Institutional accounting intervals parameterized via `Institution.fiscalYearStartMonth` (1 to 12), supporting both Egyptian academic (July–June) and international (Jan–Dec) cycles. | `PROVISIONAL_PRODUCT_OWNER_SELECTION` | Provisional Product Owner Selection | Product Owner | Blocks Task 7.5 General Ledger | `DESIGN_ONLY` |
| **UP-709** | **Maker-Checker Financial Thresholds:** Primary Manager dual-approval required for discounts > 10% or adjustments > 500 EGP. Product Owner selected **cumulative aggregation during the billing cycle** for the 500 EGP adjustment threshold (related transactions aggregated to prevent splitting). Existing discount threshold of > 10% remains unchanged; discount aggregation rules and percentage denominator remain pending specialist guidance. Cashiers collection-only. Self-approval barred. | `PROVISIONAL_PRODUCT_OWNER_SELECTION` | Provisional Selection (Adjustment aggregation baseline confirmed) | Product Owner + Financial Auditor | Blocks Task 7.3 & 7.5 | `DESIGN_ONLY` |
| **UP-712** | **Multi-Currency Roadmap:** Multi-currency operations, FX conversion, and currency translation adjustments remain disabled until international expansion. Schema remains ISO-4217 compliant. | `DEFERRED` | Deferred Policy | Product Owner (Future Phase) | Informs Schema | `DESIGN_ONLY` |
| **UP-713** | **Institutional Legal Structure:** Institution profile records commercial registration and tax profile (Ministry of Education licensed school vs commercial training academy) to determine tax liability. | `POLICY_GATED_PENDING_SPECIALIST` | Specialist Review Dependency | Corporate Legal Counsel | Blocks Task 7.3 Invoicing | `DESIGN_ONLY` |
| **UP-714** | **Hybrid Revenue Attribution:** Hybrid packages unbundle physical classroom sessions (attributed to physical campus) and digital LMS platform access (attributed to online branch `isOnline: true`). All components post to single general ledger (OD-702, OD-703). No synthetic entities. | `PROVISIONAL_PRODUCT_OWNER_SELECTION` | Provisional Product Owner Selection | Product Owner + Accountant | Blocks Task 7.3 & 7.5 | `DESIGN_ONLY` |
| **UP-715** | **User Deletion & Statutory Retention:** Financial transaction records and agreements preserved for statutory audit window under Egyptian Commercial Code with immutable `userId` foreign keys, while profile PII is scrubbed under Law 151/2020. No unverified statutory retention period is asserted as established law. | `POLICY_GATED_PENDING_SPECIALIST` | Specialist Review Dependency | Data Privacy Attorney (Law 151/2020) + Commercial Legal Counsel | Blocks Task 7.7 Auditing | `DESIGN_ONLY` |

---

## 4. Precedent Approved Foundations (OD-701 through OD-720)

The following precedent decisions remain immutable and binding:
- **OD-701:** Institution is the multi-tenant root.
- **OD-702:** Strict separation of SaaS platform commercial accounts and institution financial books.
- **OD-703:** Single institutional general ledger with branch dimension tagging.
- **OD-704:** Double-entry accrual accounting.
- **OD-705:** Online subscription revenue recognized straight-line over service period; unearned revenue deferred.
- **OD-706:** Physical session packages attendance-based consumption; absence does not consume sessions.
- **OD-708:** Posted financial transactions are immutable; adjustments via credit notes only; zero physical deletion.
- **OD-716:** Alternative B Authoritative Full Offline Backfill during maintenance window.
- **OD-717:** Maintenance window approved in principle; duration determined by representative Staging benchmark.
- **OD-718:** Dedicated verified Primary Manager invitation flow; `admin@edu.com` is SaaS Super-Admin only.
- **OD-719:** Parameterized `Branch` with `isOnline = true` representing digital education services.
- **OD-720:** Indefinite cold archival for unresolvable quarantined legacy records.

---

## 5. Explicit Governance Declaration

```
STAGE B.4.2 — FINAL DOCUMENTATION RECONCILIATION — NO IMPLEMENTATION OR DATABASE AUTHORIZATION
```

