# OX-DIGITAL Education — Phase 3 Readiness Assessment
# Frontend & Backend Integration Gaps

**Workspace:** `D:\OX-DIGITAL\Mathe\OX-DIGITAL-GITHUB`  
**Target:** `docs/ui-ux/phase-3-readiness/FRONTEND_BACKEND_INTEGRATION_GAPS.md`  
**Execution Mode:** STRICTLY READ-ONLY TECHNICAL ASSESSMENT  
**Baseline References:** Phase 2 Batches 1–6 (`docs/ui-ux/phase-2/`), Frontend Codebase (`apps/frontend/src/`), Backend Services (`services/`), Tenancy Middleware (`packages/shared/src/tenant/`)

---

## 1. Executive Summary

This document performs an exhaustive architectural audit of the technical gaps between the accepted Phase 2 UI/UX design specifications and the current software implementation across both frontend (`apps/frontend/`) and backend (`services/`) layers.

While the domain layer in `packages/shared/src/accounting/center/` is mature (~90% complete), there is currently **zero integration** between this domain logic and the user-facing web application. Neither frontend routes nor backend HTTP controllers exist for the Phase 2 financial workflows.

---

## 2. Frontend Integration Gaps (`apps/frontend/`)

### 2.1 Missing Route Architecture in `App.tsx`

Inspection of `apps/frontend/src/app/App.tsx` reveals that the router currently only defines routes for general authentication, super-admin course/institution management, student dashboard, and basic teacher screens. **All Phase 2 financial routes are missing:**

```typescript
// Current state in App.tsx (Missing financial routes):
// - /executive/* (PRIMARY_MANAGER Portal) -> MISSING
// - /accounting/* (ACCOUNTANT Workspace) -> MISSING
// - /students/:id/finance/* (Student Financial Profile) -> MISSING
// - /cashbox/* (Cashbox Management Directory & Transfers) -> MISSING
```

#### Required Route Topology to Implement:
1. **Primary Manager Portal (`/executive/`):**
   - `/executive/dashboard` (`PM-DASH-01`): Executive overview, institution-wide cash position ($87,900 EGP), approvals counter.
   - `/executive/approvals` (`PM-APPR-01`): Pending transfers and expense vouchers decision queue.
   - `/executive/branches` (`PM-BR-01`): Multi-branch governance and liquidity table.
   - `/executive/reports` (`PM-RPT-01`): Financial digests and revenue summaries.
   - `/executive/teachers/dues` (`PM-TCH-01`): Teacher compensation oversight (flagged for UP-704).
2. **Accountant Workspace (`/accounting/`):**
   - `/accounting/workspace` (`ACC-DASH-01`): Daily operational till overview and quick actions.
   - `/accounting/collections` (`ACC-COLL-01`): Student collection receipt audit ledger.
   - `/accounting/expenses` (`ACC-EXP-01`): Expense voucher drafting and tracking.
   - `/accounting/reconciliations` (`ACC-REC-01`): Daily cashbox shift count reviews.
   - `/accounting/gl-movements` (`ACC-GL-01`): Operational GL sync (blocked by UP-701 specialist review).
3. **Cashbox Management Workspace (`/cashbox/`):**
   - `/cashbox/directory` (`CBM-OVR-01`): Master directory of all 4 cashboxes (CB-01, CB-02, CB-MAIN, CB-03).
   - `/cashbox/:id/movements` (`CBM-DET-01`): Physical cashbox immutable movement ledger.
   - `/cashbox/transfers` (`CBM-TRF-01`): 5-stage internal transfer workspace with live transit indicator.
   - `/cashbox/:id/reconciliations` (`CBM-REC-01`): Daily physical count audit table.
4. **Student Financial Profile (`/students/:id/finance/`):**
   - `/students/:id/finance/agreement` (`SFP-AGREE-01`): Master commercial agreement summary.
   - `/students/:id/finance/timeline` (`SFP-HIST-01`): 4-tier sub-ledger financial history timeline.
   - `/students/:id/finance/revenue` (`SFP-REV-01`): Dual-prerequisite revenue recognition audit trail.

---

### 2.2 Missing Navigation & Layout Shell Components

Phase 2 Batch 1 established a unified application shell with role-aware sidebars and top bars. Currently, `apps/frontend/src/` lacks these components:

| Component Identifier | Required File Path | Current Status | Description & Requirements |
| :--- | :--- | :--- | :--- |
| **`AppShell`** | `components/layout/AppShell.tsx` | `MISSING` | Global container handling header, sidebar collapse, branch selector, and tenant context. |
| **`PrimaryManagerNav`**| `components/layout/PrimaryManagerNav.tsx`| `MISSING` | Role-filtered sidebar links: Executive Dashboard, Decision Center, Branch Governance, Reports. |
| **`AccountantNav`** | `components/layout/AccountantNav.tsx` | `MISSING` | Role-filtered sidebar links: Till Status, Daily Shift Counts, Collections, Expenses, Transfers. |
| **`BranchSwitcher`** | `components/layout/BranchSwitcher.tsx` | `MISSING` | Dropdown allowing Primary Manager to filter views across Main Campus, Downtown, Online, or Institutional Consolidated. |
| **`FinancialBadge`** | `components/ui/FinancialBadge.tsx` | `MISSING` | Standard badge for statuses (`IN_TRANSIT`, `POSTED`, `RECONCILED`, `DISCREPANCY_PENDING_INVESTIGATION`). |
| **`MoneyDisplay`** | `components/ui/MoneyDisplay.tsx` | `MISSING` | Formatter ensuring standard 2-decimal display with explicit `EGP` currency symbol (OD-702). |

---

### 2.3 Role-Based Routing & Security Guards

Inspection of frontend route guards indicates that `RoleRoute.tsx` only handles legacy academic roles (`ADMIN`, `STUDENT`, `TEACHER`).
The application **must implement role-based route protection** using the 4 independent institutional roles defined in `packages/shared/src/accounting/center/roles.ts`:

1. **`PRIMARY_MANAGER` Guard:** Exclusively authorizes institutional executive oversight, transfer approvals, and report consumption.
2. **`ACCOUNTANT` Guard:** Exclusively authorizes journal entry preparation, cashbox drafting, shift reconciliation input, and sub-ledger maintenance.
3. **`CASHIER` Guard:** Strictly limited to daily collection receipt issuance and shift count declarations.
4. **`TEACHER` Guard:** Academic session management and lesson delivery evidence submission.
5. **Super-Admin Route Isolation:** The SaaS Super-Admin (`admin@edu.com`) must be **strictly prevented** from accessing institutional accounting routes, as required by non-negotiable security invariant #3.

---

### 2.4 State Management & API Hook Layer

The frontend currently uses fragmented Axios calls in individual components without centralized cache invalidation or structured data fetching. For financial integrity, the application requires:
- **TanStack React Query Hooks:** To ensure cache synchronization across screens (e.g., approving a transfer in `PM-APPR-01` must immediately invalidate the cashbox balance in `CBM-OVR-01` and `PM-DASH-01`).
- **Mutation Idempotency Wrapper:** Custom hook appending an `Idempotency-Key: UUIDv4` header to all financial POST/PUT operations (`recordCollection`, `initiateTransfer`, `dispatchTransfer`, `receiveTransfer`, `postAdjustment`).

---

## 3. Backend Integration Gaps (`services/`)

### 3.1 Service Decomposition vs. Monolith Architecture

The workspace contains microservice folders (`user-service/`, `course-service/`, `analytics-service/`, `auth-service/`), but lacks an **Accounting Service** or **Financial Controller Layer**.

#### Gap Architecture Decision:
- **Finding:** The accounting core in `packages/shared/src/accounting/` contains rich domain classes (`Cashbox`, `StudentAgreement`, `RevenueRecognitionEngine`) designed to operate on a shared relational database.
- **Architectural Risk:** Exposing these domain models through separate microservices without a shared transaction manager risks breaking the atomic invariants of double-entry bookkeeping and sub-ledger conservation.
- **Required Action:** The backend must implement a dedicated `financial-service` (or integrate a financial API router into the core backend application) that wraps the `packages/shared/src/accounting/` domain engines inside ACID transaction boundaries (`prisma.$transaction`).

---

### 3.2 Missing REST API Endpoints & Controllers

Below is the complete inventory of backend endpoints required by Phase 2 design specifications that are currently **missing** from the backend services:

```mermaid
flowchart TD
    Client["Frontend (React)"] --> Router["Express Financial Router (/api/v1/...)"]
    
    subgraph Missing Controllers
        Router --> C1["Executive Overview Controller"]
        Router --> C2["Cashbox & Transfers Controller"]
        Router --> C3["Student Sub-Ledger Controller"]
        Router --> C4["Revenue Recognition Controller"]
        Router --> C5["Shift Reconciliation Controller"]
    end
    
    subgraph Existing Domain (Shared)
        C1 & C2 --> D1["cashbox.ts"]
        C3 --> D2["subLedger.ts"]
        C4 --> D3["revenueRecognitionEngine.ts"]
        C5 --> D1
    end
```

#### Detailed Missing Endpoint Catalog:

| HTTP Method & Route | Target Controller Action | Domain Engine Invocation | Gap Status |
| :--- | :--- | :--- | :--- |
| `GET /api/v1/executive/overview` | `getExecutiveOverview` | Query DB aggregates for total cash, transit, dues | `MISSING` |
| `GET /api/v1/executive/approvals` | `getApprovalQueue` | Query pending transfers and vouchers | `MISSING` |
| `GET /api/v1/executive/branches` | `getBranchSummaries` | Group cashboxes and collections by branch | `MISSING` |
| `GET /api/v1/accounting/cashboxes/overview` | `listCashboxes` | Load 4 cashboxes with live book balances & transit | `MISSING` |
| `GET /api/v1/accounting/cashboxes/:id/movements` | `getCashboxMovements` | Fetch immutable movement ledger for cashbox | `MISSING` |
| `POST /api/v1/accounting/transfers` | `createTransferRequest` | `Cashbox.initiateTransfer()` | `MISSING` |
| `POST /api/v1/accounting/transfers/:id/approve` | `approveTransfer` | `CashboxTransferRequest.approve()` | `MISSING` |
| `POST /api/v1/accounting/transfers/:id/reject` | `rejectTransfer` | `CashboxTransferRequest.reject()` | `MISSING` |
| `POST /api/v1/accounting/transfers/:id/dispatch`| `dispatchTransfer` | `CashboxTransferRequest.dispatch()` | `MISSING` |
| `POST /api/v1/accounting/transfers/:id/receive` | `receiveTransfer` | `CashboxTransferRequest.receive()` | `MISSING` |
| `POST /api/v1/accounting/cashboxes/:id/reconcile`| `submitDailyReconciliation`| `Cashbox.reconcileDailyShift()` | `MISSING` |
| `GET /api/v1/students/:id/agreement` | `getStudentAgreement` | Load agreement, milestones, and balances | `MISSING` |
| `POST /api/v1/students/:id/collections` | `recordStudentCollection`| `StudentAgreement.recordCollection()` | `MISSING` |
| `POST /api/v1/students/:id/adjustments` | `postStudentAdjustment` | `StudentAgreement.postAdjustment()` | `MISSING` |
| `POST /api/v1/teacher/evidence` | `submitLessonEvidence` | `LessonDeliveryEvidence.submit()` | `MISSING` |
| `POST /api/v1/accounting/revenue/recognize` | `triggerRevenueRecognition` | `RevenueRecognitionEngine.recognizeRevenue()` | `MISSING` |

---

### 3.3 Multi-Tenant Middleware & Context Injection

The repository contains `packages/shared/src/tenant/tenantContext.ts` which provides the data structure for tenancy (`institutionId`, `branchId`, `userId`, `roles`).
However, the HTTP middleware pipeline in `services/` has **not wired this context into incoming requests**:
1. **Header Parsing Gap:** Incoming HTTP requests must be intercepted by a middleware that reads `X-Institution-Id` and `X-Branch-Id` (or extracts them from the verified JWT payload).
2. **Context Propagation:** The extracted tenancy context must be injected into the async execution context (or `req.tenant`) so that every Prisma query automatically appends `where: { institutionId }`.
3. **Branch Isolation:** A cashier or accountant scoped to `BRANCH_01` (Downtown) must be authoritatively blocked by backend middleware from querying cashbox movements of `BRANCH_02` (Main Campus).

---

### 3.4 Data Validation Schemas (Zod DTOs)

Currently, backend services lack formal Zod validation schemas for financial requests:
- **Transfer Initiation Schema:** Must validate that `amount > 0`, `sourceCashboxId !== destinationCashboxId`, and `businessReason` is provided.
- **Collection Intake Schema:** Must validate `studentId`, `amount > 0`, `paymentMethod` (`CASH` vs `BANK_TRANSFER`), and `receiptNumber`.
- **Shift Count Schema:** Must validate physical counted breakdown by denomination and verify that `declaredPhysicalCount >= 0`.

---

### 3.5 Idempotency & Audit Logging Infrastructure

Financial mutations must never be executed twice due to network retries:
1. **Idempotency Key Store:** The backend lacks a Redis-backed or database-backed `IdempotencyRecord` table. If a user clicks "Submit Receipt" twice, the second request must return the cached initial response rather than posting two collections.
2. **Audit Vault Logger:** The backend lacks an automated audit interceptor to record every financial state transition (who, when, previous balance, new balance, IP address, justification).

---

## 4. Remediation Architecture & Priority

To bridge these integration gaps without architectural debt, the implementation must follow a strict three-layer bridge:

```
[Layer 1: Database]   Prisma Models & Schema Migrations (Workstream A)
       │
[Layer 2: Backend]    Express Financial Router + Zod DTOs + Prisma Repository (Workstream B)
       │
[Layer 3: Frontend]   React Query API Hooks + Role-Guarded Pages + App Shell (Workstreams C–G)
```

Proceeding to implement frontend screens before backend persistence and API contracts are established would result in brittle, unverified mock code. Therefore, backend schema and controller readiness is the absolute critical path prerequisite.

