# OX-DIGITAL Education — Phase 4: Workstream A
## Step A1: Prisma Financial Schema Drafting & Syntax Validation
### Deliverable 4: Hybrid Agreement Persistence Specification (UP-714)

**Workspace:** `D:\OX-DIGITAL\Mathe\OX-DIGITAL-GITHUB`  
**Target:** `docs/phase-4/workstream-a/step-a1/HYBRID_AGREEMENT_PERSISTENCE.md`  
**Execution Authorization:** EXPLICITLY APPROVED BY PRODUCT OWNER FOR STEP A1 ONLY  
**Date:** November 4, 2026  
**Author:** Lead Software Architect & Financial Systems Designer  

---

## 1. Executive Summary

Under approved Product Owner Policy `UP-714` (Hybrid Package Allocation: Physical Campus Education vs. Digital LMS Platform), commercial student enrollment agreements for hybrid educational programs bundle two fundamentally distinct service components:
1. **Physical Center Education Services:** Classroom teaching, lab facilities, and physical branch attendance.
2. **Digital Platform Access Services:** Video-on-demand lessons, AI math solver access, and online assessment tools.

This document details the database-level persistence implementation for hybrid agreements drafted into `StudentFinancialAgreement` in Step A1. It defines the mathematical conservation invariants, specifies the strict boundary between physical session recognition and deferred digital billing, and documents the shared domain code extension awaiting separate Product Owner authorization.

---

## 2. Schema Fields Implemented in `StudentFinancialAgreement`

In `packages/database/prisma/schema.prisma` (lines 880–934), model `StudentFinancialAgreement` encapsulates the complete itemized price snapshot:

```prisma
model StudentFinancialAgreement {
  id                    String            @id @default(uuid())
  institutionId         String
  branchId              String
  studentId             String
  accountId             String
  centerGroupId         String?
  agreementNumber       String            // e.g. AGR-2026-0001

  // Hybrid Allocation Breakdown (UP-714)
  catalogPrice          Decimal           @db.Decimal(12, 2)
  discountAmount        Decimal           @default(0) @db.Decimal(12, 2)
  netAgreedPrice        Decimal           @db.Decimal(12, 2)
  physicalCampusAmount  Decimal           @db.Decimal(12, 2)
  digitalPlatformAmount Decimal           @db.Decimal(12, 2)

  totalSessionsCount    Int               // Number of physical classroom sessions
  currency              String            @default("EGP")
  status                AgreementStatus   @default(ACTIVE)
  termsNotes            String?

  ...
}
```

### Key Field Responsibilities:
* `catalogPrice`: Published educational catalog price before scholarships or promotional discounts.
* `discountAmount`: Approved commercial discount granted to the student (`default(0)`).
* `netAgreedPrice`: Total binding contractual obligation ($5,500.00\text{ EGP}$ in `SFP-01`).
* `physicalCampusAmount`: Unbundled contractual portion allocated exclusively to physical center classroom delivery ($4,500.00\text{ EGP}$).
* `digitalPlatformAmount`: Unbundled contractual portion allocated to online platform access ($1,000.00\text{ EGP}$).
* `totalSessionsCount`: Total physical curriculum sessions (e.g. 30 lessons).

---

## 3. Strict Mathematical Invariants

Every persisted hybrid agreement must satisfy two core mathematical conservation equations:

### Invariant 1: Net Commercial Price Conservation
$$\text{catalogPrice} - \text{discountAmount} \equiv \text{netAgreedPrice}$$

### Invariant 2: Hybrid Unbundled Allocation Conservation (UP-714)
$$\text{physicalCampusAmount} + \text{digitalPlatformAmount} \equiv \text{netAgreedPrice}$$

*Example from Accepted Phase 2 Benchmark (`SFP-01`):*
$$\begin{aligned}
\text{catalogPrice} &= 6,000.00\text{ EGP} \\
\text{discountAmount} &= 500.00\text{ EGP} \\
\text{netAgreedPrice} &= 5,500.00\text{ EGP} \\
\text{physicalCampusAmount} &= 4,500.00\text{ EGP} \\
\text{digitalPlatformAmount} &= 1,000.00\text{ EGP} \\
4,500.00 + 1,000.00 &\equiv 5,500.00\text{ EGP} \quad (\text{CONSERVED})
\end{aligned}$$

---

## 4. Boundary Between Physical Recognition & Deferred Digital Revenue

In strict compliance with Product Owner instructions:
1. **Physical Session Valuation Bound Strictly to `physicalCampusAmount`:**  
   The equal-session valuation rule (`OD-722.4`) applies **ONLY** to `physicalCampusAmount`:
   $$\text{Standard Unit Value} = \texttt{physicalCampusAmount.divide(totalSessionsCount, 'HALF\_UP')}$$
   $$\text{Example: } \frac{4,500.00\text{ EGP}}{30\text{ lessons}} = 150.00\text{ EGP per certified lesson}$$
2. **Zero Allocation of Digital Fees Across Physical Lessons:**  
   The digital LMS portion (`digitalPlatformAmount` = $1,000.00\text{ EGP}$) must **NEVER** be allocated across physical classroom lessons. Treating digital platform access as physical lesson revenue would violate Egyptian accounting standards and distort physical center branch profitability.
3. **Deferral of Digital Revenue Recognition:**  
   Digital recurring subscriptions, monthly amortizations, and digital earned revenue recognition remain **DEFERRED** out of scope for the current physical-centers-first rollout. The $1,000.00\text{ EGP}$ digital portion remains classified as an unearned customer contract balance until digital recognition engines are authorized in a future phase.

---

## 5. Domain Code Contract Extension Requiring Separate PO Authorization

The Prisma schema drafted in Step A1 provides full persistence support for `physicalCampusAmount` and `digitalPlatformAmount`. However, the in-memory TypeScript class `AgreementPriceSnapshot` (`packages/shared/src/accounting/center/agreement.ts`) currently defines:

```typescript
export interface AgreementPriceSnapshotProps {
  catalogPrice: Money;
  discountAmount: Money;
  netAgreedPrice: Money;
}
```

> [!IMPORTANT]
> **UNAUTHORIZED DOMAIN CODE MODIFICATION PREVENTED IN STEP A1:**  
> In strict accordance with the Step A1 boundary ("Do not modify shared accounting code. Document any required domain-code extension separately for explicit Product Owner approval"), no edits were made to `packages/shared/src/accounting/center/agreement.ts`.  
> 
> To align the in-memory domain engine with the persisted schema in a future workstream, the following extension will be submitted for explicit Product Owner approval:
> ```typescript
> export interface AgreementPriceSnapshotProps {
>   catalogPrice: Money;
>   discountAmount: Money;
>   netAgreedPrice: Money;
>   physicalCampusAmount: Money;
>   digitalPlatformAmount: Money;
> }
> ```
> with class constructor invariant:
> ```typescript
> if (!props.physicalCampusAmount.add(props.digitalPlatformAmount).equals(props.netAgreedPrice)) {
>   throw new InvalidPriceSnapshotError('physicalCampusAmount + digitalPlatformAmount must equal netAgreedPrice.');
> }
> ```

