# OX-DIGITAL Education — UI/UX Design Track — Phase 1
# Document 1: Discovery & Technical Capability Audit
**Document ID:** `UI_UX_PHASE_1_DISCOVERY_AUDIT`  
**Status:** COMPLETE — READY FOR PRODUCT OWNER REVIEW  
**Date:** 2026-11-03  
**Workspace:** `D:\OX-DIGITAL\Mathe\OX-DIGITAL-GITHUB`  
**Classification:** Architectural Discovery & Feasibility Audit  

---

## 1. Executive Summary & Objective

This discovery audit provides a rigorous, code-grounded baseline of the existing frontend and backend architecture in the OX-DIGITAL Education repository. Its purpose is to anchor the Phase 1 UI/UX information architecture and screen specifications in verified technical reality, identifying what can be reused immediately, what is partially implemented, what is missing, and what requires formal Product Owner decisions.

---

## 2. Existing Frontend Architecture

### 2.1 Technology Stack & Build Pipeline
- **Core Framework:** React 18/19 with Vite 6 (`apps/frontend/`).
- **Language:** TypeScript 5.x.
- **Routing:** `react-router-dom` v7 (`BrowserRouter`, `Routes`, `Route`, `Navigate`).
- **Styling & Theming:**
  - Tailwind CSS v4 (`@tailwindcss/vite` 4.1.12, `tw-animate-css`).
  - Class utilities: `clsx`, `tailwind-merge` (`cn` utility pattern).
  - Custom `ThemeContext` supporting Dark and Light modes.
  - Active repository primary brand token (`--primary: #b62626` in `theme.css`) with `#9e1b1b` evaluated as a provisional design exploration pending Product Owner approval.
- **Component Libraries & Primitives:**
  - Radix UI (`@radix-ui/react-*` covering dialogs, dropdowns, popovers, tabs, accordion, tooltips, select, scroll-area).
  - Material UI Icons (`@mui/icons-material`) and Lucide React (`lucide-react` 0.487.0).
  - Motion / Animation: `motion` 12.x, `gsap` 3.x, `canvas-confetti`.
  - Data Visualizations: `recharts` 2.15.2 (Bar, Line, Pie, ResponsiveContainer).
  - Form & Validation: `react-hook-form` 7.55.0.
  - Notifications & Drawers: `sonner` 2.0.3, `vaul` 1.1.2.
  - Command Palette: `cmdk` 1.1.1.
- **Internationalization (i18n) & RTL:**
  - `LanguageContext` exists with Arabic default (`dir="rtl"`) and font hierarchy (`Cairo`, `Tajawal`, sans-serif).
  - Loading screens, toasts, and layout wrappers contain RTL flexbox alignments and Arabic strings.

### 2.2 Current Application Structure & Navigation
The current frontend route tree in [`apps/frontend/src/app/App.tsx`](file:///d:/OX-DIGITAL/Mathe/OX-DIGITAL-GITHUB/apps/frontend/src/app/App.tsx) is divided into monolithic role containers:

1. **Authentication & Public Pages:**
   - `/` (Landing Page)
   - `/login` (Unified Login Page)
   - `/admin/login` (Admin Login Page)
   - `/forgot-password`, `/reset-password`
   - `/external-exam/*` (Public guest entrance for assessments)
2. **Role Dashboards:**
   - `/admin/*` (`AdminDashboard` — monolithic admin screen containing Users, Students, Courses, Exams, Homework, Chatbot, Reports, Risk Detection, Subscriptions)
   - `/teacher/*` (`TeacherDashboard` — Attendance, Students, Courses, Exams, Question Bank, Analytics, AI tools)
   - `/student/center/*` (`StudentCenterDashboard` — Center-based educational student portal)
   - `/student/online/*` (`StudentOnlineDashboard` — Remote/online educational student portal)
   - `/parent/*` (`ParentDashboard` — Guardian tracking portal)
3. **Layout Wrapper:**
   - [`SharedLayout.tsx`](file:///d:/OX-DIGITAL/Mathe/OX-DIGITAL-GITHUB/apps/frontend/src/app/components/shared/SharedLayout.tsx): Provides collapsible sidebar, top navigation, user profile trigger, theme toggle, and breadcrumbs.

---

## 3. Existing Backend & Domain Capabilities

### 3.1 Database & Tenancy Foundation (Task 7.1 Baseline)
The relational persistence layer ([`packages/database/prisma/schema.prisma`](file:///d:/OX-DIGITAL/Mathe/OX-DIGITAL-GITHUB/packages/database/prisma/schema.prisma)) includes:
- **`Institution`:** Multi-tenant root entity (`institutionId`, `code`, `name`, `status`, `primaryManagerId`).
- **`Branch`:** Campus operational dimension (`branchId`, `institutionId`, `code`, `name`, `isOnline`, `status`).
- **`PrimaryManagerInvitation`:** Secure cryptographic onboarding workflow for tenant directors.
- **`User`:** Bound to tenant hierarchy (`institutionId`, `branchId`, `isPrimaryManager`, `deletedAt`).
- **`CenterGroup`:** Physical cohort groupings bound to `branchId`.
- **`Course`, `Lesson`, `Attendance`, `Exam`, `Homework`:** Core educational entities.
- **`Payment`:** Legacy flat payment records (protected from deletion under OD-708).

### 3.2 Pure Domain Accounting Foundation (Phase 2.0B Baseline)
In [`packages/shared/src/accounting/`](file:///d:/OX-DIGITAL/Mathe/OX-DIGITAL-GITHUB/packages/shared/src/accounting/), four increments of pure in-memory accounting domain engines are completed and accepted:
1. **Increment 1 (Educational Boundary & Role Authority):**
   - 4 approved center roles: `PRIMARY_MANAGER`, `ACCOUNTANT`, `CASHIER`, `TEACHER`.
   - Strict platform super-admin (`admin@edu.com`) exclusion from center accounting operations.
   - Physical branch certification for educational delivery evidence.
   - Non-negotiable price snapshots and scheduled payment arrangements in EGP.
   - Complete fail-closed policy guards (`UP-701`, `UP-702`, `UP-704`, `UP-705`, `UP-706`, `UP-710`, `UP-711`, `UP-715`).
2. **Increment 2 (Accrual Revenue Recognition & Journal Posting):**
   - Pure accrual pairing engine matching certified lesson attendance against agreement price allocation plans.
   - Exact decimal monetary math with deterministic penny-rounding absorption.
   - Balanced double-entry General Ledger journal entries (`Deferred Tuition Revenue` liability debit -> `Earned Tuition Revenue` credit).
   - Append-only reversal journal postings.
3. **Increment 3 (Student Sub-Ledger & Collection Allocations):**
   - Student sub-ledger tracking: `agreedPrice`, `totalObligationsDue`, `totalCollectionsReceived`, `totalAllocated`, `totalUnallocated`, `remainingDue`.
   - Explicit collection receipt evidence (`CollectionReceiptEvidence`).
   - FIFO / specified allocation state machine (`UNALLOCATED` -> `PARTIALLY_ALLOCATED` -> `FULLY_ALLOCATED`).
   - Append-only allocation reversals.
   - Historical financial ownership retention across branch transfers and student withdrawals.
4. **Increment 4 (Cashbox Operations & Two-Sided Atomic Transfers):**
   - Physical cashbox management with multi-cashbox branch support.
   - Collections recording decoupled from revenue recognition.
   - Expense disbursement tracking with non-negative balance enforcement.
   - In-memory atomic funds transfer engine with deterministic two-sided rollback.
   - Append-only movement reversals via `_reversalIndex` and compensating records.
   - Daily closing reconciliation state machine with consecutive-day balance continuity.

---

## 4. Frontend & Backend Capability Classification

The platform capabilities are categorized into 5 operational states:

| Functional Area | Current Status | Technical Location | UI Implication |
| :--- | :--- | :--- | :--- |
| **User Authentication (JWT + Refresh)** | **IMPLEMENTED AND AVAILABLE** | `auth-service`, `AuthContext.tsx` | Can be reused directly for login, session restoration, and token expiration handling. |
| **Tenant Claims in JWT (`institutionId`, `branchId`)** | **IMPLEMENTED AND AVAILABLE** | `auth-service`, `tenantContext.ts` | Frontend can decode and enforce institution and branch scoping immediately. |
| **Academic Courses, Lessons & Attendance** | **IMPLEMENTED AND AVAILABLE** | `course-service`, `TeacherAttendancePage.tsx` | UI components and REST APIs exist for lesson scheduling and marking attendance. |
| **Exams, Homework & Question Banks** | **IMPLEMENTED AND AVAILABLE** | `course-service`, `ExamsManagementPage.tsx` | Complete operational UI exists for academic evaluations. |
| **Role Partitioning: `PRIMARY_MANAGER`, `ACCOUNTANT`, `CASHIER`** | **IMPLEMENTED BUT NOT EXPOSED THROUGH API** | `packages/shared/roles.ts` | Shared domain defines these roles, but frontend `AuthContext` only recognizes monolithic `ADMIN`. Auth API must expose the 4 discrete roles. |
| **Physical Cashbox Operations & Balances** | **IMPLEMENTED BUT NOT EXPOSED THROUGH API** | `packages/shared/cashbox.ts` | Full domain engine exists (balances, receipts, expenses, transfers, daily recon), but has no REST endpoints or database tables yet. |
| **Student Financial Agreements & Schedules** | **IMPLEMENTED BUT NOT EXPOSED THROUGH API** | `packages/shared/agreement.ts` | Pure domain model exists; needs REST CRUD endpoints and database persistence mapping. |
| **Student Sub-Ledger & Collection Receipts** | **IMPLEMENTED BUT NOT EXPOSED THROUGH API** | `packages/shared/subLedger.ts` | Sub-ledger calculations and allocation state machines exist; needs API exposure. |
| **Accrual Revenue Recognition & Journal Entries** | **IMPLEMENTED BUT NOT EXPOSED THROUGH API** | `packages/shared/revenueRecognitionEngine.ts` | Domain engine complete; needs backend service runner and reporting API endpoints. |
| **Branch Context Switcher (Header UI)** | **PARTIALLY IMPLEMENTED** | `SharedLayout.tsx` | Header shows institution name, but lacks dynamic multi-branch selector pill. |
| **Teacher Educational Evidence Review** | **PARTIALLY IMPLEMENTED** | `TeacherAttendancePage.tsx` | Teacher can take attendance, but cannot review formal certified lesson evidence or financial pairing state. |
| **Cashier Focused Workspace Screen** | **NOT IMPLEMENTED** | Frontend (`apps/frontend/`) | No dedicated cashier view exists; cashier currently has no UI in the repository. |
| **Accountant Ledger & Daily Closing UI** | **NOT IMPLEMENTED** | Frontend (`apps/frontend/`) | No accountant workspace, receipt allocation screens, or cashbox reconciliation views exist. |
| **Primary Manager Financial Overview Dashboard** | **NOT IMPLEMENTED** | Frontend (`apps/frontend/`) | Legacy `AdminDashboard` displays user cards and student lists, but zero cashbox, collection, or financial indicator cards. |
| **Maker-Checker Expense Approval Engine** | **NOT IMPLEMENTED** | Backend / Domain | Increment 5 scope (pending); only basic expense recording exists in Increment 4 cashbox. |
| **Automated Cashbox Discrepancy Write-Off** | **REQUIRES PRODUCT OWNER DECISION** | `UP-705 Guard` | Explicitly blocked fail-closed; UI must treat all discrepancies as `PENDING_INVESTIGATION`. |
| **Teacher Variable Compensation Base** | **REQUIRES PRODUCT OWNER DECISION** | `UP-704 Guard` | Blocked fail-closed; UI must not calculate or present variable compensation figures. |
| **Student Refund Policy & Fee Deductions** | **REQUIRES PRODUCT OWNER DECISION** | `UP-706 Guard` | Blocked fail-closed; refund workflows cannot be finalized in UI without legal/commercial policy. |
| **Customer-Facing Payment Terminology** | **RESOLVED PRODUCT POLICY** | Phase 2.0B / Increment 1 | Non-negotiable: Term "Installments" is strictly prohibited. UI must use "Payment Schedule", "Due", "Collected", "Remaining". |

---

## 5. Reusable Frontend Assets & Components

The following components and modules in `apps/frontend/src/app/` are robust, accessible, and must be reused in Phase 1 screen specifications:

1. **Layout Shell:** [`SharedLayout.tsx`](file:///d:/OX-DIGITAL/Mathe/OX-DIGITAL-GITHUB/apps/frontend/src/app/components/shared/SharedLayout.tsx)
   - Handles sidebar toggle, responsive mobile drawer, RTL layout flipping, and header user controls.
2. **State & Feedback Primitives:**
   - [`LoadingState.tsx`](file:///d:/OX-DIGITAL/Mathe/OX-DIGITAL-GITHUB/apps/frontend/src/app/components/ui/LoadingState.tsx): Accessible spinner with RTL Arabic loading message.
   - [`EmptyState.tsx`](file:///d:/OX-DIGITAL/Mathe/OX-DIGITAL-GITHUB/apps/frontend/src/app/components/ui/EmptyState.tsx): Configurable illustration, title, description, and action button.
   - [`PermissionDeniedPage.tsx`](file:///d:/OX-DIGITAL/Mathe/OX-DIGITAL-GITHUB/apps/frontend/src/app/components/auth/PermissionDeniedPage.tsx): Standardized HTTP 403 screen.
   - [`ErrorBoundary.tsx`](file:///d:/OX-DIGITAL/Mathe/OX-DIGITAL-GITHUB/apps/frontend/src/app/components/shared/ErrorBoundary.tsx): Global component catch shell.
3. **UI Elements:**
   - Buttons (`apps/frontend/src/app/components/ui/button.tsx` with variants: `default`, `outline`, `destructive`, `ghost`).
   - Skeletons (`skeleton.tsx` for loading tables and metric cards).
   - Dialogs & Drawers (`vaul`, Radix Dialog).
   - Notification Toasts (`sonner` via `toast.success()`, `toast.error()`).
4. **Data Tables:**
   - Existing table patterns in `StudentsPage.tsx` and `AdminUsersPage.tsx` (sticky headers, pagination bar, badge chips, action menus).

---

## 6. Integration Boundaries & Constraints

1. **Zero Fake APIs in Wireframes:** Wireframe specs and screen data requirements must map directly to either existing Prisma models or existing Phase 2.0B shared domain contracts.
2. **Pure Accrual Separation:** The UI must visually and semantically separate four distinct financial events:
   - *Agreement Creation:* Establishes scheduled commitments (no revenue, no cash).
   - *Fee Collection:* Generates cash receipt and sub-ledger allocation (cash in till, unearned liability).
   - *Lesson Delivery:* Academic certification by Primary Manager (educational evidence).
   - *Revenue Recognition:* Accrual engine pairs evidence with price snapshot to post General Ledger journal entries.
3. **No Database Modification:** The UI design track produces specifications only. No schema changes or backend mocks are to be written.

