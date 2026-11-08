# Phase 7.2 — Stage B: Architecture Design
## Document 3: Access Control & Tenant Isolation Architecture

**Workspace:** `D:\OX-DIGITAL\Mathe\OX-DIGITAL-GITHUB`  
**Phase:** 7.2 — Pricing Catalog & Subscription Agreements  
**Stage:** Stage B — Architecture Design  
**Date:** November 2026  
**Status:** DESIGN ONLY — IMPLEMENTATION NOT AUTHORIZED  

---

## 1. Overview & Core Access Philosophy

In the target architecture, educational access to LMS content (videos, exams, lessons, homework) is governed dynamically by valid, active **Subscription Agreements** and **Session Packages**, rather than static, perpetual `CourseEnrollment` records.

### Core Security Principles:
1. **Tenant Root Scoping:** Access permissions are strictly confined within the student's and course's shared `institutionId` (OD-701).
2. **Zero Commercial Ledger Access for End Users:** Students, parents, and teachers have zero read/write access to institutional pricing catalogs, price versions, branch overrides, or financial ledger entries.
3. **Defense-in-Depth:** Tenant isolation is enforced across three distinct layers:
   - *Layer 1: Gateway / Route Guard* (JWT signature, tenant ID parameter extraction).
   - *Layer 2: Service / Domain Middleware* (Tenant context verification against authenticated claims).
   - *Layer 3: Data Access Layer / Prisma Scoping* (Explicit `where: { institutionId }` on all queries). Middleware mounting alone is never treated as sufficient proof of isolation.

---

## 2. Dynamic LMS Access Engine (`checkLmsAccess`)

### 2.1 Specification & Execution Flow

```
                      [ Client Requests LMS Content ]
                                    │
                                    ▼
                 [ checkLmsAccess(studentId, courseId) ]
                                    │
                                    ▼
                     { Is Feature Flag Active? }
                     /                         \
           YES      /                           \      NO (Legacy Mode)
                   ▼                             ▼
        [ Query SubscriptionAgreement ]    [ Query CourseEnrollment ]
        - institutionId matches             - userId == studentId
        - studentId == studentId            - courseId == courseId
        - courseId == courseId                      │
        - status == ACTIVE                          ▼
                   │                           [ Grant Access ]
                   ▼
        { Agreement Found? }
         /                \
   YES  /                  \  NO
       ▼                    ▼
{ Check Dates }     { Is Grandfathered? }
startsAt <= now       (Fallback to CourseEnrollment)
endsAt > now               /              \
     /    \          YES  /                \  NO
   PASS   FAIL           ▼                  ▼
   /        \     [ Grant Access ]     [ Access Denied ]
  ▼          ▼
[ Grant ]  [ Access Denied ]
```

### 2.2 Formal Policy Evaluation Matrix

| Agreement Status | Payment Status | Access Evaluation | Business Justification & Enforcement |
|---|---|---|---|
| **ACTIVE** | Fully Paid | **GRANTED** | Standard in-term subscription. Full LMS access permitted. |
| **ACTIVE** | Partially Paid | **CONDITIONAL** | *Unresolved Business Rule (Policy Gate):* Subject to institution grace period (e.g. 7 days). If grace period active → GRANTED; if exceeded → transitions to SUSPENDED. |
| **PENDING** | Unpaid / Awaiting Settlement | **DENIED** | Agreement drafted or accepted, but payment not yet confirmed by gateway or bank receipt. Access held until payment clears. |
| **SUSPENDED** | Default / Delinquent | **DENIED** | Administrative or financial lock. Access immediately revoked; frontend displays custom suspension notification with payment link. |
| **EXPIRED** | Past `endsAt` | **DENIED** | Billing term concluded without renewal. Access revoked at `23:59:59` on expiration date. |
| **CANCELLED** | Terminated | **DENIED** | Contract voided or student refunded. Access permanently severed. |
| **DRAFT** | N/A | **DENIED** | Cart state only. Zero educational entitlement. |

---

## 3. Transition Strategy: Legacy `CourseEnrollment` Handling

To ensure existing students are not locked out during platform rollout, the access evaluator implements a **Two-Tier Fallback Hierarchy**:

```typescript
// Architectural Design Specification (Not active code)
interface AccessCheckResult {
  allowed: boolean;
  reason: string;
  source: 'ACTIVE_AGREEMENT' | 'GRANDFATHERED_ENROLLMENT' | 'DENIED';
  agreementId?: string;
}

export async function checkLmsAccess(
  tenantContext: TenantContext,
  studentId: string,
  courseId: string
): Promise<AccessCheckResult> {
  const { institutionId } = tenantContext;

  // Tier 1: Check Authoritative Subscription Agreements
  const activeAgreement = await prisma.subscriptionAgreement.findFirst({
    where: {
      institutionId,
      studentId,
      courseId,
      status: 'ACTIVE',
      startsAt: { lte: new Date() },
      OR: [
        { endsAt: null },
        { endsAt: { gt: new Date() } }
      ]
    }
  });

  if (activeAgreement) {
    return { allowed: true, reason: 'Valid active agreement', source: 'ACTIVE_AGREEMENT', agreementId: activeAgreement.id };
  }

  // Tier 2: Fallback to Grandfathered Legacy CourseEnrollment
  const legacyEnrollment = await prisma.courseEnrollment.findFirst({
    where: {
      userId: studentId,
      courseId
    }
  });

  if (legacyEnrollment) {
    return { allowed: true, reason: 'Grandfathered legacy enrollment', source: 'GRANDFATHERED_ENROLLMENT' };
  }

  return { allowed: false, reason: 'No active subscription agreement or valid enrollment', source: 'DENIED' };
}
```

---

## 4. Physical Session Package Access Control

For physical center courses, classroom entry and teacher attendance tracking are governed by `SessionPackage` entitlements:

1. **Check-In Validation Rule:**
   $$\text{Package Access Granted} \iff (\text{package.status} = \text{ACTIVE}) \land (\text{package.remainingSessions} > 0) \land (\text{branchId} = \text{session.branchId})$$
2. **Attendance vs. Consumption Separation:**
   - Marking a student `PRESENT` in `Attendance` triggers a background or inline call to `SessionConsumption`.
   - If `remainingSessions == 0`, the student is marked as "Present — Pending Payment" and an alert is flagged to the center administration desk.
   - Absences (`ABSENT_EXCUSED` or `ABSENT_UNEXCUSED`) do NOT automatically deduct a session entitlement unless explicitly mandated under **OD-722**.

---

## 5. Security & Multi-Tenant Isolation Architecture

### 5.1 Role-Based Access Control (RBAC) Permissions Matrix

| Endpoint Domain | Platform Super-Admin (SaaS) | Primary Manager (Institution) | Branch Staff / Accountant | Teacher | Student / Parent |
|---|---|---|---|---|---|
| **View Catalogs & Items** | Read-Only (Support) | Full Access (CRUD) | Read-Only (Assigned Branch) | None | Read-Only (Public Rates) |
| **Publish Price Versions** | Denied | **Sole Approver (OD-721)** | Denied | Denied | Denied |
| **Set Branch Overrides** | Denied | Full Access | Denied (Read-Only) | Denied | Denied |
| **Draft Agreements** | Denied | Full Access | Full Access | Denied | Self Only (Checkout) |
| **Accept Agreements** | Denied | Denied | Denied | Denied | **Self / Child Only** |
| **Suspend / Cancel Agreements**| Denied | Full Access | Branch Scoped | Denied | Denied |
| **Access LMS Content** | Denied | Denied | Denied | Read-Only | **Entitled Only** |
| **Commercial General Ledger** | Platform Books Only (OD-702) | Full Tenant Books | Branch Sub-Ledger | Denied | **Zero Access** |

### 5.2 Multi-Layer Tenant Isolation Enforcement

#### Layer 1: JWT & Context Extraction
- The API Gateway extracts `institutionId`, `userId`, `role`, and `branchId` from the cryptographically verified JWT.
- Injects an immutable `tenantContext` object into the request context.

#### Layer 2: Service-Level Invariant Checking
```typescript
// Explicit Invariant Check inside Domain Service
function assertTenantMatch(tenantContext: TenantContext, resourceInstitutionId: string) {
  if (tenantContext.role === 'PLATFORM_SUPER_ADMIN') {
    // Platform Super-Admin is explicitly prohibited from institutional commercial actions (OD-703, OD-718)
    throw new ForbiddenException('Platform Super-Admins cannot operate institutional pricing.');
  }
  if (tenantContext.institutionId !== resourceInstitutionId) {
    throw new ForbiddenException('Cross-tenant data access violation.');
  }
}
```

#### Layer 3: Database Query Scoping
- All Prisma queries MUST include `institutionId: tenantContext.institutionId` in the top-level `where` clause.
- Prisma extensions (e.g. `$extends({ query: ... })`) will enforce mandatory tenant filtering on all financial and pricing models, preventing accidental developer omission.

### 5.3 Isolation Across Supporting Channels
- **WebSockets (`SocketContext`):** Subscription status update events (e.g. `AGREEMENT_SUSPENDED`) are broadcast strictly to tenant-scoped rooms: `institution_${institutionId}:student_${studentId}`.
- **Background Jobs (BullMQ / Cron):** All subscription renewal jobs and expiration processors must group queue tasks by `institutionId`, executing within an explicit tenant context.
- **Storage & Video Workers (`video-worker`):** Video URLs generated for streaming check `checkLmsAccess` before signing HLS / MP4 CDN tokens.

