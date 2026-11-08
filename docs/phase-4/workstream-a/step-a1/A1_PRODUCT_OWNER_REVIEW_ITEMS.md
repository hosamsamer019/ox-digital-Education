# OX-DIGITAL Education — Phase 4: Workstream A
## Step A1: Prisma Financial Schema Drafting & Syntax Validation
### Deliverable 8: Product Owner Decision & Review Register

**Workspace:** `D:\OX-DIGITAL\Mathe\OX-DIGITAL-GITHUB`  
**Target:** `docs/phase-4/workstream-a/step-a1/A1_PRODUCT_OWNER_REVIEW_ITEMS.md`  
**Execution Authorization:** EXPLICITLY APPROVED BY PRODUCT OWNER FOR STEP A1 ONLY  
**Date:** November 4, 2026  
**Author:** Lead Software Architect & Financial Systems Designer  

---

## 1. Executive Summary

Step A1 has successfully drafted and statically validated the complete canonical financial accounting schema for Phase 4 Workstream A.

Before Phase 4 can progress to Step A2 (Migration Dry-Run Planning & Draft DDL Generation), the Product Owner is requested to review and formally approve the five architectural items documented below.

---

## 2. Decision Register for Product Owner Authorization

### Item 1: Acceptance of the 14 Canonical Financial Models & 14 Enums
* **Description:** Approval of the concrete Prisma schema models drafted into `packages/database/prisma/schema.prisma`:
  - 12 frontline operational and subledger models: `Cashbox`, `CashboxTransaction`, `CashboxReconciliation`, `StudentFinancialAgreement`, `StudentObligation`, `Collection`, `CollectionAllocation`, `FinancialAdjustment`, `GroupPricingAgreement`, `StudentFinancialAccount`, `FinancialIdempotencyRecord`, `FinancialAuditEvent`.
  - 2 Domain 7 extensions: `LessonDeliveryEvidence`, `RevenueRecognitionEntry`.
  - 14 specialized enums governing financial lifecycles.
* **Evidence:** Validated via `npx prisma validate` with exit code `0`. 100% backward compatible with existing academic models and legacy `Payment`.
* **Recommended Action:** **APPROVE**.

---

### Item 2: Canonical `CashboxTransaction` Architecture & Transfer Semantics
* **Description:** Formal adoption of `CashboxTransaction` (Canonical Table #17) as the single authoritative physical till ledger, rejecting any split into competing movement ledgers:
  - Records all inflows (`COLLECTION`), outflows (`EXPENSE`), and transfers (`TRANSFER_IN`, `TRANSFER_OUT`).
  - Inter-cashbox transfers execute via two atomic records linked by `counterpartCashboxId`, `counterpartTransactionId`, and `referenceId`.
  - Reversals execute via compensating append-only movements (`COLLECTION_REVERSED`, `EXPENSE_REVERSED`, `TRANSFER_REVERSED`).
* **Recommended Action:** **APPROVE**.

---

### Item 3: Tenant Isolation Boundary & Endorsement of Layered Defense
* **Description:** Formal acknowledgment of the database-level relational constraints regarding the `User` model:
  - `StudentFinancialAccount` enforces institution-scoped composite uniqueness `@@unique([institutionId, studentId])` and `@@unique([institutionId, accountNumber])`.
  - Because `User.institutionId` is nullable (`String?`) to preserve Platform Super-Admin Quarantine (`admin@edu.com`) and unassigned users, Prisma's type checker prohibits compound foreign keys without weakening tenant non-nullability or breaking Super-Admin rules.
  - Cross-tenant references are prevented via application middleware (`tenantContext.ts`) and domain guards (`center/guards.ts`).
* **Recommended Action:** **APPROVE AND ENDORSE LAYERED TENANT DEFENSE**.

---

### Item 4: Shared Domain Code Extension for Hybrid Agreements (UP-714)
* **Description:** Authorization to extend the in-memory domain class `AgreementPriceSnapshot` (`packages/shared/src/accounting/center/agreement.ts`) in a future workstream to include itemized properties:
  - `physicalCampusAmount: Money`
  - `digitalPlatformAmount: Money`
  - Invariant: `physicalCampusAmount.add(digitalPlatformAmount).equals(netAgreedPrice)`.
* **Note:** No domain code was edited in Step A1. This item is submitted for formal authorization before domain code modification.
* **Recommended Action:** **APPROVE FOR INCLUSION IN WORKSTREAM B**.

---

### Item 5: Formal Governance Gate — Authorization for Step A2
* **Description:** Authorization to close Step A1 and advance to Step A2 (Migration Dry-Run Planning & Draft DDL Generation).
* **Governance Notice:** In accordance with strict development protocol, **Step A2 will NOT begin without explicit written authorization from the Product Owner.**
* **Recommended Action:** **AUTHORIZE STEP A2 WHEN READY**.

