# OX-DIGITAL Education
# Task 7.2 — Product Owner Decision Register
## Revision: B.2 — Provisional Decisions

**Workspace:** `D:\OX-DIGITAL\Mathe\OX-DIGITAL-GITHUB`  
**GitHub Repository:** `https://github.com/hosamsamer019/ox-digital-Education.git`  
**Status:** Provisional Product Owner Choices — Pending Technical and Policy Validation  
**Implementation Authorization:** NOT GRANTED  
**Database/Migration Authorization:** NOT GRANTED  
**Date:** November 2026  

---

## 1. Decisions Selected by the Product Owner

### OD-721 — Pricing Management Authority
**Selected Option:** `PRIMARY_MANAGER_ONLY`
- Only the institution's designated Primary Manager may create, edit drafts, publish, supersede, or retire pricing versions.
- Branch staff have no pricing publication or modification authority.
- No delegated pricing authority is included in the initial release.
- SaaS Platform Super-Admin remains separate from institutional financial administration.
- Every pricing operation must record the responsible user and timestamp.
- **Status:** PROVISIONAL — Technical RBAC validation required.

---

### OD-722 — Physical Session Package Consumption
**Selected Option:** `ATTENDANCE_BASED_CONSUMPTION`
- A session is consumed only after valid attendance is recorded.
- Absence does not automatically consume a session.
- Attendance corrections and reversals must be auditable.
- Duplicate attendance events must not consume multiple sessions.
- Session consumption must be idempotent and institution-scoped.
- **Not yet decided:**
  - Whether unused sessions expire.
  - Whether unused sessions are refundable.
  - Whether make-up sessions are allowed.
  - How cancellations and late attendance are handled.
  - The accounting valuation and revenue-recognition method.
- **Status:** PROVISIONAL — Operational and accounting validation required.

---

### OD-723 — Price Version Immutability
**Selected Technical Direction:** `PURE APPEND-ONLY VERSIONING`
- Published price versions must not be modified in place.
- Price changes create new versions.
- Existing accepted agreements retain their original price snapshots.
- Publication and supersession must be concurrency-safe.
- Historical price resolution must remain reproducible.
- **Status:** PROPOSED TECHNICAL DECISION — Final validation required before schema implementation.

---

### OD-724 — Legacy Enrollment Transition
**Selected Option:** `FIXED TRANSITION GRACE PERIOD`
- Existing eligible enrollments receive a defined transition grace period.
- During that period, legacy access is handled under a controlled transition policy.
- Legacy enrollments must be mapped to institution-owned records before conversion.
- No synthetic institution, branch, student, or agreement may be created.
- After the approved grace deadline, access requires a valid SubscriptionAgreement.
- Historical access and conversion decisions must be auditable.
- **Not yet decided:**
  - Exact grace-period duration.
  - How the deadline is calculated.
  - Treatment of students with incomplete or ambiguous legacy records.
  - Who approves exceptions.
- **Status:** PROVISIONAL — Duration and migration mapping require approval.

---

### OD-725 — Initial Currency Policy
**Selected Option:** `EGP_ONLY_INITIAL_RELEASE`
- Initial pricing and agreements use Egyptian Pound (EGP).
- Currency must be explicit in monetary records and snapshots.
- No implicit foreign-exchange conversion is permitted.
- Schema should not unnecessarily prevent future multi-currency support.
- **Status:** PROVISIONAL — Accounting and tax validation required.

---

### OD-726 — Subscription Renewal Model
**Selected Option:** `NEW_AGREEMENT_PER_RENEWAL`
- Every renewal creates a new SubscriptionAgreement.
- The new agreement references the previous agreement.
- Each agreement has its own immutable price snapshot and service period.
- Renewal must not overwrite the historical agreement.
- Renewal creation must be idempotent.
- **Not yet decided:**
  - Whether renewal requires explicit student/guardian acceptance.
  - Whether a new price applies automatically or requires acceptance.
  - Whether renewal can occur before the previous agreement expires.
- **Status:** PROVISIONAL — Contract and API validation required.

---

## 2. Existing Approved Decisions Remain Unchanged

The following previously approved decisions remain authoritative:
- **OD-701:** Institution governance and Primary Manager.
- **OD-702:** Separation of SaaS and institutional financial domains.
- **OD-703:** One institutional ledger with branch dimensions.
- **OD-704:** Accrual accounting.
- **OD-705:** Online subscription revenue recognition over the service period, with unearned amounts deferred.
- **OD-706:** Physical session packages and attendance-based consumption principles; absence is not automatically consumed.
- **OD-708:** Refunds and withdrawals through controlled reversals/adjustments.
- **OD-716:** Alternative B full offline backfill.
- **OD-717:** Maintenance window in principle, with duration determined by staging benchmark.
- **OD-718:** Dedicated verified Primary Manager invitation; `admin@edu.com` remains SaaS Super-Admin.
- **OD-719:** Online Branch represented by `Branch.isOnline = true`.
- **OD-720:** Indefinite cold archival for quarantined legacy records.

*These decisions must not be reinterpreted or silently overridden.*

---

## 3. Decisions and Reviews Still Required

| Item | Remaining Question | Required Action |
|---|---|---|
| **OD-722** | Expiration, refunds, make-up sessions | Product Owner policy |
| **OD-724** | Exact grace duration and deadline | Product Owner policy |
| **OD-726** | Renewal acceptance and pricing rules | Product Owner policy |
| **UP-702** | VAT and ETA obligations | Egyptian tax specialist |
| **UP-706** | Refund fees and deadlines | Product Owner + legal review |
| **UP-707** | Fiscal year | Product Owner |
| **UP-709** | Staff roles and approval thresholds | Product Owner |
| **UP-712** | Multi-currency future requirements | Defer unless needed |
| **UP-713** | Institution legal-entity structure | Legal/accounting review |
| **UP-714** | Hybrid package valuation | Accounting policy review |
| **UP-715** | User deletion and financial-record lifecycle | Legal/privacy review |
| **UP-701** | Statutory chart of accounts | Accountant/financial specialist |

---

## 4. Technical Validation Requirements

Before Stage D:
1. Verify all proposed relations against the actual Task 7.1 Prisma schema.
2. Validate pure append-only price version resolution and concurrency behavior.
3. Verify institution and branch ownership for every pricing and agreement operation.
4. Define exact legacy grace-period migration rules.
5. Verify attendance idempotency and correction handling.
6. Define agreement renewal linkage and acceptance semantics.
7. Validate EGP decimal precision, rounding, and serialization.
8. Validate the financial lifecycle with the future Invoice, Payment, and General Ledger models.
9. Verify that no policy recommendation has been silently converted into an approved decision.

---

## 5. Explicit Authorization Boundary

This register records provisional decisions only. It does NOT authorize:
- Source-code modifications.
- Prisma schema changes.
- Migration creation or execution.
- PostgreSQL connections.
- Backfill or data conversion.
- Docker or infrastructure changes.
- Git commits, pushes, resets, stashes, or branch switches.
- Task 7.3 implementation.

**Current Status:**  
`TASK 7.2 — PROVISIONAL PRODUCT OWNER DECISIONS RECORDED — TECHNICAL VALIDATION REQUIRED — IMPLEMENTATION NOT AUTHORIZED`

