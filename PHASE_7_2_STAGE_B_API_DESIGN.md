# Phase 7.2 — Stage B: Architecture Design
## Document 2: API Specification & Service Contracts

**Workspace:** `D:\OX-DIGITAL\Mathe\OX-DIGITAL-GITHUB`  
**Phase:** 7.2 — Pricing Catalog & Subscription Agreements  
**Stage:** Stage B — Architecture Design  
**Date:** November 2026  
**Status:** DESIGN ONLY — IMPLEMENTATION NOT AUTHORIZED  

---

## 1. Overview & Protocol Standards

The Pricing Catalog and Subscription Agreement APIs operate as modular endpoints within `services/payment-service` and `services/course-service`, coordinated through the API Gateway.

### Core Architectural Standards:
1. **RESTful Resource Scoping:** All tenant-scoped administrative routes are prefixed with `/api/v1/institutions/:institutionId`.
2. **Strict Idempotency:** Any mutating financial or agreement operation (`POST`, `PATCH`) must supply an `Idempotency-Key: <UUIDv4>` header.
3. **Exact Decimal Serialization:** Currency amounts are transmitted as stringified fixed-point decimals (e.g. `"1500.00"`) in JSON payloads to prevent JavaScript JSON parser precision truncation.
4. **Tenant Context Verification:** Every request evaluates JWT claims (`institutionId`, `role`, `branchId`) against path parameters before invoking business logic.

---

## 2. Pricing Catalog API Endpoints

### 2.1 Create Price Catalog
- **Method & Path:** `POST /api/v1/institutions/:institutionId/catalogs`
- **RBAC Requirement:** `PRIMARY_MANAGER` only (OD-721 / UP-709).
- **Request Body:**
  ```json
  {
    "name": "Standard Academic Year 2026/2027",
    "code": "CAT-AY2627-STD",
    "description": "Standard institutional tuition catalog for all branches",
    "isDefault": true,
    "currency": "EGP"
  }
  ```
- **Response (`201 Created`):**
  ```json
  {
    "success": true,
    "data": {
      "id": "cat_c0a8012e-8f1b",
      "institutionId": "inst_01j7x9...",
      "name": "Standard Academic Year 2026/2027",
      "code": "CAT-AY2627-STD",
      "status": "DRAFT",
      "isDefault": true,
      "currency": "EGP",
      "createdAt": "2026-11-02T12:00:00.000Z"
    }
  }
  ```

---

### 2.2 Add Catalog Item
- **Method & Path:** `POST /api/v1/institutions/:institutionId/catalogs/:catalogId/items`
- **RBAC Requirement:** `PRIMARY_MANAGER`
- **Request Body:**
  ```json
  {
    "courseId": "crs_math_sec3",
    "serviceType": "COURSE",
    "itemCode": "ITEM-MATH-SEC3-MONTHLY",
    "name": "Secondary 3 Advanced Mathematics (Monthly)",
    "billingFrequency": "MONTHLY"
  }
  ```
- **Response (`201 Created`):** Returns the created `PriceCatalogItem` object with `id: "item_91b7..."`.

---

### 2.3 Publish Price Version
- **Method & Path:** `POST /api/v1/institutions/:institutionId/items/:itemId/versions`
- **RBAC Requirement:** `PRIMARY_MANAGER`
- **Headers:** `Idempotency-Key: <UUID>`
- **Request Body:**
  ```json
  {
    "basePrice": "850.00",
    "currency": "EGP",
    "effectiveFrom": "2026-12-01T00:00:00.000Z",
    "effectiveTo": null,
    "changeReason": "Annual inflation rate adjustment approved by Board"
  }
  ```
- **Validation Rules:**
  - `effectiveFrom` cannot be in the past beyond the current day.
  - Automatically supersedes any active version whose range intersects with `effectiveFrom`.
- **Response (`201 Created`):**
  ```json
  {
    "success": true,
    "data": {
      "id": "pv_34d9a...",
      "catalogItemId": "item_91b7...",
      "versionNumber": 2,
      "basePrice": "850.00",
      "currency": "EGP",
      "effectiveFrom": "2026-12-01T00:00:00.000Z",
      "effectiveTo": null,
      "status": "ACTIVE",
      "publishedAt": "2026-11-02T14:30:00.000Z",
      "publishedBy": "usr_mgr_01..."
    }
  }
  ```

---

### 2.4 Set Branch Price Override
- **Method & Path:** `POST /api/v1/institutions/:institutionId/items/:itemId/overrides`
- **RBAC Requirement:** `PRIMARY_MANAGER`
- **Request Body:**
  ```json
  {
    "branchId": "br_cairo_nasrcity",
    "overridePrice": "950.00",
    "currency": "EGP",
    "effectiveFrom": "2026-12-01T00:00:00.000Z",
    "effectiveTo": null,
    "reason": "Nasr City premium lab facility surcharge"
  }
  ```
- **Response (`201 Created`):** Returns the active `BranchPriceOverride` record.

---

### 2.5 Runtime Price Resolution API
- **Method & Path:** `GET /api/v1/pricing/resolve`
- **RBAC Requirement:** Authenticated user or checkout client.
- **Query Parameters:**
  - `institutionId` (required): UUID
  - `branchId` (optional): UUID of physical campus or online branch
  - `courseId` (required): UUID of course
  - `asOfDate` (optional): ISO timestamp (defaults to `now()`)
- **Precedence Logic:**
  1. Checks for active `BranchPriceOverride` where `branchId` matches and date falls within range.
  2. If none, checks for active `PriceVersion` in the institution's default catalog.
- **Response (`200 OK`):**
  ```json
  {
    "success": true,
    "data": {
      "resolvedPrice": "950.00",
      "currency": "EGP",
      "pricingSource": "BRANCH_OVERRIDE",
      "priceVersionId": "pv_34d9a...",
      "overrideId": "ovr_882a...",
      "catalogItemId": "item_91b7...",
      "billingFrequency": "MONTHLY",
      "effectiveFrom": "2026-12-01T00:00:00.000Z"
    }
  }
  ```

---

## 3. Subscription Agreement Endpoints

### 3.1 Create Draft Agreement (Initiate Checkout)
- **Method & Path:** `POST /api/v1/subscriptions/agreements`
- **RBAC Requirement:** Authenticated Student, Parent, or Admin.
- **Headers:** `Idempotency-Key: <UUID>`
- **Request Body:**
  ```json
  {
    "institutionId": "inst_01j7x9...",
    "studentId": "usr_std_001",
    "courseId": "crs_math_sec3",
    "branchId": "br_cairo_nasrcity",
    "billingFrequency": "MONTHLY",
    "startsAt": "2026-12-01T00:00:00.000Z",
    "autoRenew": true
  }
  ```
- **Behavior:**
  - Resolves current authoritative price.
  - Generates unique `agreementNumber` (e.g. `AGR-2026-000412`).
  - Sets initial state to `DRAFT`.
  - Holds price lock for 60 minutes.
- **Response (`201 Created`):**
  ```json
  {
    "success": true,
    "data": {
      "agreementId": "agr_f982...",
      "agreementNumber": "AGR-2026-000412",
      "status": "DRAFT",
      "studentId": "usr_std_001",
      "amount": "950.00",
      "currency": "EGP",
      "expiresAt": "2026-11-02T15:30:00.000Z"
    }
  }
  ```

---

### 3.2 Accept Agreement & Lock Price Snapshot
- **Method & Path:** `POST /api/v1/subscriptions/agreements/:agreementId/accept`
- **RBAC Requirement:** Student or Parent owner.
- **Headers:** `Idempotency-Key: <UUID>`
- **Request Body:**
  ```json
  {
    "termsAccepted": true,
    "termsVersion": "v2.1-2026",
    "signaturePayload": {
      "ipAddress": "197.34.12.8",
      "userAgent": "Mozilla/5.0...",
      "signedAt": "2026-11-02T14:45:00.000Z"
    }
  }
  ```
- **Behavior:**
  - Validates that agreement is in `DRAFT`.
  - Calculates SHA-256 hash of legal terms.
  - Creates immutable `AgreementPriceSnapshot` recording net agreed amount (`950.00 EGP`).
  - Transitions agreement status to `PENDING` (awaiting payment settlement).
  - Emits `AgreementLifecycleEvent(OFFER_ACCEPTED)`.
- **Response (`200 OK`):**
  ```json
  {
    "success": true,
    "data": {
      "agreementId": "agr_f982...",
      "status": "PENDING",
      "snapshotId": "snap_0182...",
      "netAgreedAmount": "950.00",
      "paymentRequired": true
    }
  }
  ```

---

### 3.3 Update Agreement Status (Admin Lifecycle Operations)
- **Method & Path:** `PATCH /api/v1/institutions/:institutionId/agreements/:agreementId/status`
- **RBAC Requirement:** `PRIMARY_MANAGER` or authorized Staff.
- **Request Body:**
  ```json
  {
    "action": "SUSPEND", // Options: "SUSPEND", "REACTIVATE", "CANCEL"
    "reason": "Payment overdue past 14-day grace period",
    "metadata": {
      "internalTicket": "FIN-2026-881"
    }
  }
  ```
- **Behavior:**
  - Transitions state (e.g. `ACTIVE` → `SUSPENDED`).
  - Appends audit record to `AgreementLifecycleEvent`.
  - Immediately invalidates cached LMS access token for the student.
- **Response (`200 OK`):**
  ```json
  {
    "success": true,
    "data": {
      "agreementId": "agr_f982...",
      "previousStatus": "ACTIVE",
      "newStatus": "SUSPENDED",
      "updatedAt": "2026-11-02T15:00:00.000Z"
    }
  }
  ```

---

## 4. Physical Session Package APIs

### 4.1 Issue Session Entitlement
- **Method & Path:** `POST /api/v1/institutions/:institutionId/packages`
- **RBAC Requirement:** `PRIMARY_MANAGER` or Center Staff.
- **Request Body:**
  ```json
  {
    "agreementId": "agr_f982...",
    "studentId": "usr_std_001",
    "branchId": "br_cairo_nasrcity",
    "totalSessions": 10,
    "unitSessionPrice": "150.00",
    "validFrom": "2026-11-01T00:00:00.000Z",
    "validTo": "2027-01-31T23:59:59.000Z"
  }
  ```
- **Response (`201 Created`):** Returns `SessionPackage` with `remainingSessions: 10`.

---

### 4.2 Consume Session (Attendance Check-In)
- **Method & Path:** `POST /api/v1/institutions/:institutionId/packages/:packageId/consume`
- **RBAC Requirement:** Teacher or Center Attendance Staff.
- **Headers:** `Idempotency-Key: <UUID>`
- **Request Body:**
  ```json
  {
    "attendanceId": "att_01jk98...", // Direct reference to Attendance record
    "sessionsToDeduct": 1,
    "reason": "ATTENDANCE_PRESENT",
    "notes": "Verified physical presence in Classroom 3B"
  }
  ```
- **Validation Rules:**
  - Verifies package status is `ACTIVE`.
  - Verifies `remainingSessions >= sessionsToDeduct`.
  - Validates `Attendance.userId == SessionPackage.studentId`.
- **Response (`200 OK`):**
  ```json
  {
    "success": true,
    "data": {
      "consumptionId": "csm_8812...",
      "packageId": "pkg_01j...",
      "consumedSessions": 1,
      "remainingSessions": 9,
      "consumedAt": "2026-11-02T16:00:00.000Z"
    }
  }
  ```

---

## 5. Comprehensive Error Catalog

| Error Code | HTTP Status | Description / Resolution |
|---|---|---|
| `TENANT_MISMATCH` | 403 Forbidden | Request path `institutionId` does not match authenticated token. |
| `ROLE_NOT_AUTHORIZED` | 403 Forbidden | User lacks `PRIMARY_MANAGER` role required for catalog publishing. |
| `PRICE_VERSION_OVERLAP` | 409 Conflict | The proposed effective date range conflicts with an existing active version. |
| `AGREEMENT_EXPIRED` | 410 Gone | The draft agreement was not accepted within the 60-minute price lock window. |
| `AGREEMENT_LOCKED` | 400 Bad Request | Commercial terms cannot be modified on an accepted agreement. |
| `INSUFFICIENT_SESSIONS` | 422 Unprocessable | Package has 0 remaining sessions; attendance cannot be consumed. |
| `INVALID_IDEMPOTENCY_KEY`| 400 Bad Request | Header missing or payload differs from previous invocation with this key. |
| `BRANCH_MISMATCH` | 422 Unprocessable | The requested session consumption branch does not match the package branch. |

