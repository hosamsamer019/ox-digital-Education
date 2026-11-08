# Phase 7.2 — Stage B: Architecture Design
## Document 7: Master Architecture Synthesis & Final Design Report

**Workspace:** `D:\OX-DIGITAL\Mathe\OX-DIGITAL-GITHUB`  
**Git Repository:** `https://github.com/hosamsamer019/ox-digital-Education.git`  
**Git HEAD:** `0500b93e65c24ed881349c4acea7f523332c5e9f` (branch `main`)  
**Phase:** 7.2 — Pricing Catalog & Subscription Agreements  
**Stage:** Stage B — Architecture Design  
**Date:** November 2026  
**Final Status:** `TASK 7.2 — STAGE B ARCHITECTURE DESIGN COMPLETE — PRODUCT OWNER APPROVAL REQUIRED — IMPLEMENTATION NOT AUTHORIZED`  

---

## 1. Executive Master Synthesis

Phase 7.2 Stage B establishes the complete architectural blueprint for transitioning the OX-DIGITAL platform from an unversioned single-float pricing model (`Course.price Float`) into an institutional-grade, multi-tenant **Pricing Catalog and Subscription Agreement Engine**.

### Core Architecture Highlights:
1. **Tenant Integrity:** Every pricing and contractual record is strictly rooted in `Institution(id)` (OD-701) and attributed to an explicit physical campus or online branch (`Branch.isOnline: true`, OD-719).
2. **Immutable Contract Traceability:** Accepted student agreements freeze commercial terms via SHA-256 snapshotted records (`AgreementPriceSnapshot`), guaranteeing that subsequent catalog adjustments never mutate historical student obligations.
3. **Double-Entry & Accrual Compliance:** Commercial contracts (`SubscriptionAgreement`) are decoupled from billing (`Invoice`), cash collection (`PaymentTransaction`), and general ledger postings (`JournalEntry`), enforcing strict accrual revenue recognition (OD-704/705).
4. **Resilient Non-Breaking Migration:** A 3-phase rollout architecture guarantees zero downtime and zero access disruptions for existing students via dual-read and grandfathered agreement adapters.

---

## 2. Visual Architecture & System Flows

### 2.1 Entity-Relationship Model (ERD)

```mermaid
erDiagram
    INSTITUTION ||--o{ PRICE_CATALOG : "owns"
    INSTITUTION ||--o{ BRANCH : "operates"
    INSTITUTION ||--o{ SUBSCRIPTION_AGREEMENT : "contracts"
    BRANCH ||--o{ BRANCH_PRICE_OVERRIDE : "applies"
    BRANCH ||--o{ SUBSCRIPTION_AGREEMENT : "attributed to"

    PRICE_CATALOG ||--o{ PRICE_CATALOG_ITEM : "contains"
    PRICE_CATALOG_ITEM ||--o{ PRICE_VERSION : "versions"
    PRICE_CATALOG_ITEM ||--o{ BRANCH_PRICE_OVERRIDE : "overrides"

    USER ||--o{ SUBSCRIPTION_AGREEMENT : "signs as student"
    COURSE ||--o{ SUBSCRIPTION_AGREEMENT : "enrolled in"
    PRICE_VERSION ||--o{ SUBSCRIPTION_AGREEMENT : "referenced by"

    SUBSCRIPTION_AGREEMENT ||--|| AGREEMENT_PRICE_SNAPSHOT : "freezes"
    SUBSCRIPTION_AGREEMENT ||--o{ AGREEMENT_LIFECYCLE_EVENT : "audits"
    SUBSCRIPTION_AGREEMENT ||--o{ SUBSCRIPTION_RENEWAL : "schedules"
    SUBSCRIPTION_AGREEMENT ||--o{ SESSION_PACKAGE : "entitles"

    SESSION_PACKAGE ||--o{ SESSION_CONSUMPTION : "consumes"
    SESSION_PACKAGE ||--o{ SESSION_ADJUSTMENT : "adjusts"
    ATTENDANCE ||--o| SESSION_CONSUMPTION : "verifies"

    PRICE_CATALOG {
        string id PK
        string institutionId FK
        string code
        string status
        string currency
    }

    PRICE_VERSION {
        string id PK
        string catalogItemId FK
        int versionNumber
        decimal basePrice
        datetime effectiveFrom
        datetime effectiveTo
        string status
    }

    SUBSCRIPTION_AGREEMENT {
        string id PK
        string institutionId FK
        string studentId FK
        string branchId FK
        string status
        datetime startsAt
        datetime endsAt
        boolean autoRenew
    }

    AGREEMENT_PRICE_SNAPSHOT {
        string id PK
        string agreementId FK
        decimal netAgreedAmount
        string currency
        string termsHash
    }

    SESSION_PACKAGE {
        string id PK
        string agreementId FK
        int totalSessions
        int consumedSessions
        int remainingSessions
        decimal unitSessionPrice
    }
```

---

### 2.2 Subscription Agreement State Machine

```mermaid
stateDiagram-v2
    [*] --> DRAFT : Initiate Checkout (Cart)
    DRAFT --> PENDING : Accept Terms & Lock Price Snapshot
    DRAFT --> CANCELLED : Expired Price Lock (60 min) or Abandoned
    
    PENDING --> ACTIVE : Payment Settled (Task 7.4 Gateway Hook)
    PENDING --> CANCELLED : Payment Failed or Timeout
    
    ACTIVE --> SUSPENDED : Overdue Payment / Administrative Lock
    SUSPENDED --> ACTIVE : Payment Resolved / Reinstatement
    
    ACTIVE --> EXPIRED : Reached endsAt (Auto-Renew False)
    ACTIVE --> RENEWED : Scheduled Renewal Executed (Auto-Renew True)
    ACTIVE --> CANCELLED : Early Cancellation / Student Withdrawal
    
    SUSPENDED --> CANCELLED : Permanent Default / Expulsion
    RENEWED --> [*]
    EXPIRED --> [*]
    CANCELLED --> [*]
```

---

### 2.3 Runtime Price Resolution Precedence Flow

```mermaid
flowchart TD
    Start["Client Requests Price Resolution<br>(institutionId, branchId, courseId, asOfDate)"] --> FindItem["Query PriceCatalogItem<br>where courseId == courseId"]
    
    FindItem --> ItemCheck{"Item Found?"}
    ItemCheck -- No --> FailNotFound["Return Error: CATALOG_ITEM_NOT_FOUND"]
    ItemCheck -- Yes --> BranchCheck{"Is branchId Provided?"}
    
    BranchCheck -- Yes --> QueryOverride["Query BranchPriceOverride<br>where branchId == branchId<br>AND isActive == true<br>AND effectiveFrom <= date<br>AND (effectiveTo >= date OR null)"]
    BranchCheck -- No --> QueryBaseVersion
    
    QueryOverride --> OverrideCheck{"Override Found?"}
    OverrideCheck -- Yes --> ReturnOverride["Return Override Price<br>(source: BRANCH_OVERRIDE)"]
    OverrideCheck -- No --> QueryBaseVersion["Query PriceVersion<br>where catalogItemId == itemId<br>AND status == ACTIVE<br>AND effectiveFrom <= date<br>AND (effectiveTo >= date OR null)"]
    
    QueryBaseVersion --> VersionCheck{"Version Found?"}
    VersionCheck -- Yes --> ReturnBase["Return Base Catalog Price<br>(source: BASE_CATALOG)"]
    VersionCheck -- No --> FailNoPrice["Return Error: NO_ACTIVE_PRICE_VERSION"]
```

---

## 3. Transaction Boundaries & Database Isolation Levels

Financial operations must withstand high concurrency and network partitions without generating phantom prices or double-deductions.

### 3.1 Checkout & Price Snapshot Creation
- **Isolation Level:** `READ COMMITTED` with `FOR UPDATE` row-level lock on `PriceVersion`.
- **Transaction Boundary:**
  1. Acquire lock on active `PriceVersion` (and `BranchPriceOverride` if applicable).
  2. Create `SubscriptionAgreement` in `PENDING` state.
  3. Insert immutable `AgreementPriceSnapshot` recording SHA-256 legal hash and exact decimal amount.
  4. Write audit record to `AgreementLifecycleEvent`.
  5. Commit transaction.

### 3.2 Price Version Publication & Supersession
- **Isolation Level:** `SERIALIZABLE`.
- **Transaction Boundary:**
  1. Validate date ranges against all existing versions of `catalogItemId`.
  2. Set preceding active version `effectiveTo = new.effectiveFrom - 1 second` and `status = SUPERSEDED`.
  3. Insert new `PriceVersion` with `status = ACTIVE`.
  4. Emit cache invalidation event across Redis/in-memory caches.

### 3.3 Session Package Consumption (Attendance Check-In)
- **Isolation Level:** `REPEATABLE READ`.
- **Transaction Boundary:**
  1. Select `SessionPackage` with `FOR UPDATE`.
  2. Verify `remainingSessions > 0` and `status == ACTIVE`.
  3. Insert `SessionConsumption` referencing `Attendance.id`.
  4. Decrement `remainingSessions` by 1 and increment `consumedSessions` by 1.
  5. Commit transaction.

---

## 4. Idempotency & Failure Scenarios Matrix

| Scenario | Risk | System Mitigation Architecture |
|---|---|---|
| **Duplicate Payment Webhook** | Double-activation or duplicate invoice creation. | Gateway webhook handler evaluates `Idempotency-Key` / `transactionId`. If agreement is already `ACTIVE`, system logs acknowledgment and returns `200 OK` without re-posting. |
| **Race Condition on Session Consumption** | Two teachers marking attendance for the same student concurrently in different classrooms. | PostgreSQL row lock (`FOR UPDATE`) on `SessionPackage` serializes the deduction. Database unique constraint on `attendanceId` prevents double-logging. |
| **Price Catalog Modification Mid-Checkout** | Primary Manager changes tuition price while student is entering credit card details. | Checkout binds strictly to the `AgreementPriceSnapshot` created at cart acceptance. Changing catalog rates has zero effect on pending or active agreements. |
| **Network Failure During Agreement Acceptance** | Client disconnects before receiving acceptance response. | Client retries `POST /agreements/:id/accept` with the identical `Idempotency-Key`. Server retrieves existing snapshot and returns `200 OK` safely. |

---

## 5. Architectural Deliverables Summary

The Phase 7.2 Stage B architectural documentation suite is complete:

1. [**`PHASE_7_2_STAGE_B_DATA_MODEL.md`**](file:///D:/OX-DIGITAL/Mathe/OX-DIGITAL-GITHUB/PHASE_7_2_STAGE_B_DATA_MODEL.md): Complete Prisma data model specifications for catalogs, versions, overrides, agreements, snapshots, events, and physical session packages.
2. [**`PHASE_7_2_STAGE_B_API_DESIGN.md`**](file:///D:/OX-DIGITAL/Mathe/OX-DIGITAL-GITHUB/PHASE_7_2_STAGE_B_API_DESIGN.md): RESTful endpoint specifications, request/response contracts, and error catalogs.
3. [**`PHASE_7_2_STAGE_B_ACCESS_CONTROL.md`**](file:///D:/OX-DIGITAL/Mathe/OX-DIGITAL-GITHUB/PHASE_7_2_STAGE_B_ACCESS_CONTROL.md): Dynamic LMS access engine (`checkLmsAccess`), legacy `CourseEnrollment` fallback hierarchy, and multi-layer tenant isolation.
4. [**`PHASE_7_2_STAGE_B_ACCOUNTING_INTEGRATION.md`**](file:///D:/OX-DIGITAL/Mathe/OX-DIGITAL-GITHUB/PHASE_7_2_STAGE_B_ACCOUNTING_INTEGRATION.md): 8-step financial lifecycle, illustrative double-entry journal postings, deferred revenue amortization, and branch revenue attribution.
5. [**`PHASE_7_2_STAGE_B_MIGRATION_ROLLOUT.md`**](file:///D:/OX-DIGITAL/Mathe/OX-DIGITAL-GITHUB/PHASE_7_2_STAGE_B_MIGRATION_ROLLOUT.md): Upstream Task 7.1 staging prerequisites, 3-phase dual-write strategy, and rollback procedures.
6. [**`PHASE_7_2_STAGE_B_DECISION_GATES.md`**](file:///D:/OX-DIGITAL/Mathe/OX-DIGITAL-GITHUB/PHASE_7_2_STAGE_B_DECISION_GATES.md): Unresolved policy register highlighting blocking gates **OD-721** and **OD-722** pending Product Owner approval.
7. [**`PHASE_7_2_STAGE_B_FINAL_DESIGN.md`**](file:///D:/OX-DIGITAL/Mathe/OX-DIGITAL-GITHUB/PHASE_7_2_STAGE_B_FINAL_DESIGN.md): This master synthesis document.

---

## 6. Verification of Strict Boundaries

- **Application Source Code Modifications:** 0 lines.
- **Prisma Schema Modifications:** 0 lines.
- **Migrations Created or Applied:** 0.
- **Database Connections / SQL Executed:** 0.
- **Git HEAD Unchanged:** `0500b93e65c24ed881349c4acea7f523332c5e9f` on branch `main`.
- **Pre-existing Working Tree Intact:** All 58 tracked modified files and 133 untracked files preserved.

---

## 7. Mandatory Final Status Declaration

```
TASK 7.2 — STAGE B ARCHITECTURE DESIGN COMPLETE — PRODUCT OWNER APPROVAL REQUIRED — IMPLEMENTATION NOT AUTHORIZED
```

