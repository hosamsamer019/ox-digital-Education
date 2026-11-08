# Phase 7.2 — Stage B.1: Architecture Validation
## Document 3: Security, Access Control & Tenant Isolation Review

**Workspace:** `D:\OX-DIGITAL\Mathe\OX-DIGITAL-GITHUB`  
**Git Repository:** `https://github.com/hosamsamer019/ox-digital-Education.git`  
**Git HEAD:** `0500b93e65c24ed881349c4acea7f523332c5e9f` on branch `main`  
**Phase:** 7.2 — Pricing Catalog & Subscription Agreements  
**Stage:** Stage B.1 — Independent Architecture Validation & PO Decision Review  
**Date:** November 2026  
**Status:** DESIGN REVIEW ONLY — IMPLEMENTATION NOT AUTHORIZED  

---

## 1. Executive Security Assessment

This review evaluates the access control engine (`checkLmsAccess`), tenant isolation mechanisms, permission models, and background authorization pathways proposed in Stage B Document 3.

### Key Security Findings:
1. **Critical Legacy Fallback Vulnerability:** The proposed `checkLmsAccess` fallback blindly checks `CourseEnrollment.findFirst({ where: { userId, courseId } })`. If kept indefinitely, **any historical enrollment grants perpetual free access**, completely bypassing the subscription engine.
2. **Cache Synchronization Lag on Suspension:** When an administrator suspends an agreement (`ACTIVE` $\rightarrow$ `SUSPENDED`), active HTTP sessions and video-streaming workers may continue serving content unless explicit distributed cache invalidation is enforced.
3. **Multi-Channel Coverage Inconsistency:** While HTTP routes are gated, WebSocket connections (`SocketContext`), background batch jobs, and media-signing endpoints in `video-worker` must share identical authorization contracts.

---

## 2. In-Depth Audit of the `checkLmsAccess` Engine

### 2.1 The Legacy Fallback Hazard & Remediation

In Stage B Document 3 (Section 3), the proposed logic implements:
```typescript
// Proposed Stage B Fallback
const legacyEnrollment = await prisma.courseEnrollment.findFirst({
  where: { userId: studentId, courseId }
});
if (legacyEnrollment) {
  return { allowed: true, reason: 'Grandfathered legacy enrollment' };
}
```

#### Security Vulnerability Identified:
- **Perpetual Free Access Loophole:** Because legacy `CourseEnrollment` records do not contain an expiration date or tenant check, a student who purchased a course 2 years ago would retain access indefinitely. Even if an institution creates a new subscription agreement that later expires or is suspended, the fallback query would still return `allowed: true`!
- **Recommended Remediation (Controlled Grandfathering):**
  1. **Deprecate Direct Table Queries:** Do not query `CourseEnrollment` dynamically at runtime.
  2. **Authoritative Backfill Mirroring:** During Task 7.2 deployment, every legacy `CourseEnrollment` is backfilled into a `SubscriptionAgreement` with:
     - `status: ACTIVE`
     - `isGrandfathered: true`
     - `endsAt: <EXPLICIT_TRANSITION_DEADLINE>` (e.g. end of current semester, or 6 months).
  3. **Single System of Record:** `checkLmsAccess` queries **only** `SubscriptionAgreement`. If no active agreement exists, access is denied.

---

### 2.2 Partial Payment & Grace Period Policy Audit

The Stage B proposal classified partial payments as a conditional business rule:

| Scenario | Proposed Behavior | Security & Financial Assessment |
|---|---|---|
| **Installment 1 Paid, Installment 2 Overdue** | Access permitted during grace period (e.g. 7 days). | **Operational Risk:** If grace period is unmetered, students access premium exam/lesson content and drop out without settling dues. |
| **Partial Cash Deposit at Campus** | Manually marked `ACTIVE` by center cashier. | **Audit Risk:** Cashiers could collude with students to grant LMS access without full settlement. |

#### Architectural Recommendation:
- Introduce explicit enum values in `SubscriptionAgreement`:
  - `status: ACTIVE` $\rightarrow$ Fully in good standing.
  - `status: GRACE_PERIOD` $\rightarrow$ Payment overdue; system displays warning banner; access expires automatically on `gracePeriodEndsAt`.
  - `status: SUSPENDED` $\rightarrow$ Grace period lapsed; hard lockout.
- Grace period parameters must be configured in `Institution.financialPolicies` and signed off by the Primary Manager (OD-721).

---

## 3. Real-Time Revocation & Distributed Invalidation

When an agreement transitions to `SUSPENDED`, `EXPIRED`, or `CANCELLED`, access must terminate immediately across all channels.

```
[ Admin / System Suspends Agreement ]
                 │
                 ▼
[ SubscriptionAgreementService.updateStatus() ]
                 │
                 ├─► 1. Update Database Status to SUSPENDED
                 ├─► 2. Write AgreementLifecycleEvent(SUSPENDED)
                 ├─► 3. Evict Redis Access Cache:
                 │      DEL lms:access:{institutionId}:{studentId}:{courseId}
                 ├─► 4. Broadcast WebSocket Revocation:
                 │      EMIT 'ACCESS_REVOKED' -> room(institution_{instId}:student_{stdId})
                 └─► 5. Revoke Active CDN Video Signing Tokens (TTL <= 15 min)
```

### 3.1 Media & Video Worker Security (`video-worker`)
- Current video streaming relies on HLS chunk delivery.
- If video URLs are generated with long-lived tokens (e.g. 24 hours), a suspended student can continue watching videos.
- **Security Invariant:** HLS manifest and encryption key signing tokens must have a maximum Time-To-Live (TTL) of **15 minutes**, requiring periodic re-validation against `checkLmsAccess`.

---

## 4. Multi-Layer Tenant Isolation Matrix

Tenant isolation must not rely solely on route-level Express middleware. The table below verifies defense-in-depth across the application stack:

| Application Layer | Isolation Mechanism | Potential Failure Mode | Hardened Architecture Requirement |
|---|---|---|---|
| **Gateway / Route Layer** | JWT claims verification (`institutionId`, `role`, `branchId`). | Path parameter tampering (e.g. `institutionId` in URL differs from JWT). | Assert `req.params.institutionId === req.user.institutionId` on all non-superadmin routes. |
| **Service Layer** | Explicit `assertTenantMatch()` guard calls before business operations. | Developer omits guard call in a newly created controller. | Service constructors inject and require an immutable `TenantContext` object. |
| **Database Layer** | Explicit `where: { institutionId }` in Prisma queries. | Missing filter in raw SQL or sub-queries leaking records. | Prisma Client `$extends` middleware automatically injects `institutionId` into every pricing/financial query. |
| **WebSocket Layer** | Tenant-scoped rooms (`institution_${id}`). | Socket client listening to global un-namespaced channels. | Handshake middleware validates JWT and binds socket strictly to tenant room. |
| **Background Jobs** | BullMQ workers process jobs within explicit tenant context. | Worker picks up cross-tenant job and updates wrong accounts. | Job payloads must serialize `institutionId`; worker initializes tenant context before execution. |

---

## 5. Commercial Ledger & Administrative Privilege Separation

In strict accordance with OD-702, OD-703, and OD-718:
1. **Zero Access for End Users:**
   - Role checks in `packages/shared/src/tenant` must enforce that roles `STUDENT`, `PARENT`, and `TEACHER` have zero access to pricing catalogs, price versions, branch overrides, discount rules, invoices, and accounting ledgers.
   - Any API request from these roles targeting `/api/v1/institutions/:institutionId/catalogs` or `/ledgers` must immediately return `403 Forbidden` and log a security audit event.
2. **Platform Super-Admin Restriction (OD-703, OD-718):**
   - The SaaS Platform Super-Admin (`admin@edu.com`) cannot publish or alter institutional pricing catalogs or view private institutional student ledgers. Their scope is strictly restricted to platform-level tenant management.

---

## 6. Conclusion & Actionable Security Gates

1. **Eliminate Dynamic Legacy Fallback:** Replace the open `CourseEnrollment` query in `checkLmsAccess` with backfilled `SubscriptionAgreement` records carrying an explicit transition validity date.
2. **Implement 15-Minute Media Token Expiry:** Configure `services/video-worker` to sign HLS stream keys with a maximum 15-minute TTL.
3. **Mandate Prisma Extension Filtering:** Implement automated tenant filtering on all new Phase 7.2 tables to guarantee query isolation.

