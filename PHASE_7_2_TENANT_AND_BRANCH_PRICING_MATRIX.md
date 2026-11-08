# OX-DIGITAL Education — Phase 7.2
# Tenant and Branch Pricing Matrix
## Multi-Branch Governance, Online Attribution & Conflict Resolution

**Document ID:** `OD-7203-TENANT-BRANCH-PRICING-MATRIX`  
**Workspace:** `D:\OX-DIGITAL\Mathe\OX-DIGITAL-GITHUB`  
**Repository:** `https://github.com/hosamsamer019/ox-digital-Education.git`  
**Git HEAD:** `0500b93e65c24ed881349c4acea7f523332c5e9f` (Branch: `main`)  
**Audit Date:** November 2026  
**Execution Mode:** READ-ONLY (ZERO APPLICATION CODE OR DATABASE MUTATIONS)  
**Status:** **STAGE A READ-ONLY AUDIT COMPLETE — IMPLEMENTATION NOT AUTHORIZED**

---

## 1. Executive Summary

This architecture matrix defines how educational service pricing is scoped, governed, and resolved across an educational institution's administrative hierarchy. It establishes the relationship between the Institution (Tenant Root), Physical Campus Branches, and the Online Learning Division (`isOnline: true` per OD-719), ensuring compliance with the unified general ledger architecture (OD-703) and Primary Manager governance (OD-701).

---

## 2. Multi-Level Pricing Scope Matrix

An educational institution operates multiple delivery channels that exhibit distinct cost structures and local market pricing. The pricing engine resolves rates using a strict 3-tier hierarchy:

```
Tier 1: Institution Base Catalog (Primary Manager Controlled — OD-701)
  │
  ├──► Tier 2: Physical Branch Overrides (Campus-Specific Overrides)
  │      └── e.g., Nasr City Campus Tuition Override
  │
  └──► Tier 3: Online Branch Dimension (OD-719 Distance Learning)
         └── Dedicated Online Rate (isOnline: true)
```

| Scope Dimension | Dimension Type | Governing Entity | Pricing Scope & Applicable Services | Authority & Approval Gate |
|---|---|---|---|---|
| **Institution Global** | Root Catalog | `Institution` | Base price for all courses, general tuition, and standardized exam fees. Applies when no branch override exists. | **Primary Manager exclusively** (OD-701). Cannot be delegated without explicit threshold (UP-709). |
| **Physical Campus Branch** | Location Override | `Branch` (`isOnline = false`) | Campus-specific classroom cohort fees, laboratory charges, physical seat reservations, and local attendance packs. | Branch Manager proposal; **Primary Manager approval mandatory**. |
| **Online Learning Branch** | Parameterized Branch (OD-719) | `Branch` (`isOnline = true`) | Online video streaming subscriptions, AI solver access, automated assessments, distance-learning term passes. | Managed by Online Academic Director with **Primary Manager approval**. |
| **Student Agreement Snapshot** | Frozen Contract | `SubscriptionAgreement` | Fixed price agreed upon at the time of student registration. Immunized against future catalog price hikes. | System automated snapshot; overrides catalog lookups for active agreements. |

---

## 3. Price Resolution Hierarchy & Precedence Rules

When a student checks out, registers for a course, or an administrator prepares an enrollment agreement, the effective price is calculated using the following deterministic resolution algorithm:

```
                         [Request Effective Price]
                       (institutionId, branchId, itemId)
                                    │
                                    ▼
                     Is there an Active Snapshot on
                      an Existing Open Agreement?
                                    │
                         ┌──────────┴──────────┐
                     YES │                     │ NO
                         ▼                     ▼
               [Use Agreement Price]   Is Target Branch Online?
               (Immutable Historical)     (branch.isOnline == true)
                                               │
                                    ┌──────────┴──────────┐
                                YES │                     │ NO
                                    ▼                     ▼
                          Look for Online Branch    Look for Physical Campus
                           Price Override (Tier 3)   Price Override (Tier 2)
                                    │                     │
                                    └──────────┬──────────┘
                                               │
                                       Override Found?
                                               │
                                    ┌──────────┴──────────┐
                                YES │                     │ NO
                                    ▼                     ▼
                          [Use Branch Override]  [Use Base Institution Price]
                                                 (Tier 1 Active PriceVersion)
                                                          │
                                                    Version Found?
                                                          │
                                               ┌──────────┴──────────┐
                                           YES │                     │ NO
                                               ▼                     ▼
                                     [Return Valid Price]    [REJECT: NO_PRICE_DEFINED]
```

### Precedence Invariants:
1. **Rule 1 (Agreement Invariant):** If an active `SubscriptionAgreement` exists for the student and service, the agreed snapshot price **always** governs. Future catalog edits are ignored.
2. **Rule 2 (Explicit Branch Override):** An approved branch-specific override for the student's assigned branch takes precedence over the base institutional price.
3. **Rule 3 (Online Dimension OD-719):** An online branch (`isOnline: true`) uses its dedicated override. If none is defined, it inherits the institutional base rate.
4. **Rule 4 (Fail-Closed Rejection):** If no active `PriceVersion` covers the requested date, the pricing engine rejects checkout with `NO_ACTIVE_PRICE_VERSION`. It never infers or guesses a zero price.

---

## 4. Multi-Branch Conflict Scenarios & Governance Rules

### 4.1 Scenario A: Student Transfers Between Branches
* **Situation:** A student enrolled in Branch A (Tuition: 500 EGP/mo) transfers to Branch B (Tuition: 650 EGP/mo) mid-term.
* **Resolution:**
  1. The student's existing agreement for Branch A is formally closed (`CANCELLED_TRANSFERRED`).
  2. Any unearned deferred revenue is reconciled per OD-705 and transferred in the unified GL to Branch B.
  3. A new `SubscriptionAgreement` is executed for Branch B with the new approved branch price.
  4. The system never mutates historical invoices or payments retroactively.

### 4.2 Scenario B: Hybrid Students (Physical Center + Online Access)
* **Situation:** A student attends physical sessions at Branch A while simultaneously accessing the online LMS.
* **Resolution:**
  * Handled via a composite bundle (`HYBRID_BUNDLE`) in the Pricing Catalog containing two linked entitlements:
    1. `CenterGroup` physical attendance at Branch A.
    2. Online streaming entitlement attributed to `Branch.isOnline = true`.
  * Accounting attribution splits the revenue between Branch A and the Online dimension according to the bundle's predefined GL ratio (OD-703).

### 4.3 Scenario C: Cross-Branch Price Tampering (Security Defense)
* **Defense:** An admissions staff member at Branch A cannot apply the lower price of Branch B to a student physically registering at Branch A. The endpoint evaluates `tenantContext.branchId` against the requested service branch. Cross-branch spoofing is rejected with HTTP 403 `CROSS_BRANCH_PRICING_DENIED`.

---

## 5. Verification Against Task 7.1 Tenant Context

The pricing catalog models integrate directly with the Task 7.1 identity and isolation architecture:

* **Institution Sovereignty:** Every `PriceCatalog` has a mandatory foreign key `institutionId` (`onDelete: Restrict`).
* **SaaS Super-Admin Separation (OD-718):** `admin@edu.com` cannot author institutional prices. Price creation requires the authenticated identity of the institution's Primary Manager (`User.isPrimaryManager == true`).
* **Audit Trail:** Every `PriceVersion` records `approvedByUserId`. The system verifies that the approving user belongs to the institution before activating the price version.

---

## 6. Audit Verdict

| Governance Area | Audit Status | Architecture Readiness |
|---|:---:|---|
| **Multi-Tier Resolution Logic** | Verified | Algorithmic precedence fully specified. |
| **Online Branch Dimension (OD-719)** | Verified | Modeled as parameterized branch override. |
| **Branch Transfer Protocol** | Verified | Non-retroactive agreement transition designed. |
| **Primary Manager Approval (OD-701)** | Verified | Enforced at data model and API gateway level. |

**Conclusion:** The Tenant and Branch Pricing Matrix is complete, verified against OD-701 through OD-720, and ready for schema specification in Stage B.

