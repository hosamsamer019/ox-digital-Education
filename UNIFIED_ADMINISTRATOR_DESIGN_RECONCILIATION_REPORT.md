# OX-DIGITAL Education — Unified Administrator Design Reconciliation & Login Recovery Audit Report

**Date:** November 6, 2026  
**Status:** INVESTIGATION COMPLETE — AWAITING OPERATOR APPROVAL  
**Workspace:** `D:\OX-DIGITAL\Mathe\OX-DIGITAL-GITHUB`  
**Target Environment:** Isolated Local Development (`127.0.0.1:5433`, `ox_digital_dev_test`)  
**Verified Database Container:** `ox-digital-isolated-dev-postgres` (User: `ox_dev_admin`)  
**Authoritative Reference:** Client Approved Direction & BRD (November 6, 2026)  

---

## Executive Summary

This investigation was conducted to resolve the client's login difficulty and clarify the architectural discrepancy between the **unified administrator design** approved by the client and the current database/codebase state.

### Core Findings at a Glance
1. **The Client's Approved Direction is Valid and Authoritative:**  
   The client explicitly rejected separating the "Executive Manager" and "Center Manager / Administrator" into two different accounts and disconnected dashboards. The approved specification requires **ONE unified administrative login account** and **ONE unified administrative dashboard** that consolidates all center governance, financial controls, branch management, and academic tools.
2. **The Canonical Account is `admin@edu.com`:**  
   The single canonical administrator account intended for client center operations is **`admin@edu.com`** (Account ID: `admin_91xnz3`). In the authorized database, this account is already linked to the institution (`inst_idor_a_91xnz3`), is marked `isPrimaryManager: true`, and is registered as the institution's `primaryManagerId`.
3. **The Root Cause of the Login Failure:**  
   When using the main public login portal (`http://localhost:8080/login`) and selecting the **"المدير التنفيذي / مدير المؤسسة"** card, the frontend sends `role: 'PRIMARY_MANAGER'`. However, in the database, `admin@edu.com` has `role: 'ADMIN'`. The backend authentication controller (`auth.controller.ts`) executes an exact compound match:
   ```typescript
   where: { email: validatedData.email, role: validatedData.role }
   ```
   Because `ADMIN != PRIMARY_MANAGER`, the query returns `null`, and the client receives a misleading HTTP 401 error (`البريد الإلكتروني أو كلمة المرور غير صحيحة`).
4. **Current Immediate Access Route:**  
   The account `admin@edu.com` is completely healthy, active, and fully configured. It can log in immediately via the dedicated administrative login route:
   **`http://localhost:8080/admin/login`**  
   Upon login, it lands on the fully unified dashboard at `/admin/home`.
5. **No Dangerous Changes Needed:**  
   The 39 `PRIMARY_MANAGER` records in the database (such as `pm_262912@ox-digital.edu`) are synthetic fixtures generated during automated test runs, NOT client accounts. No accounts need to be deleted or recreated. A simple, non-destructive auth reconciliation will restore login directly from the main `/login` portal.

---

## 1. Final Approved Design & Historical Context

### 1.1 The Client's Explicit Direction
Prior to the latest revisions, an earlier iteration attempted to introduce a rigid multi-tenant SaaS distinction:
- A "Platform Super Admin" (`ADMIN`) responsible only for platform-level cloud hosting and server health.
- A "Primary Manager" (`PRIMARY_MANAGER`) responsible for educational and branch management.

**The client explicitly rejected this split.** For the OX-DIGITAL Education platform, the center director/manager is the top administrator. The client instructed the team to maintain:
- **One unified administrator identity and login account:** The manager must not have to juggle multiple emails or credentials.
- **One unified administration dashboard:** The manager must have single-pane visibility over branches, pricing in EGP, accountants, subscriptions, cashboxes, sequential receipts, student enrollment, courses, exams, homework, and AI chatbots.
- **No artificial separation:** Center management and platform administration are one operational responsibility.

### 1.2 How the Discrepancy Re-emerged on November 6
On November 6, 2026, the client supplied the updated specification document:
*`BRD – Accounts, Branches & Subscriptions Module for the Center Management Platform (English)`*.

In that BRD, the formal role terminology used for cross-branch governance was **"Primary Manager"** (`PRIMARY_MANAGER`). The previous implementation team mistakenly interpreted this terminology as an instruction to resurrect the previously rejected architecture:
- In `BRD_REALIGNMENT_AND_IMPLEMENTATION_FINAL_REPORT.md`, the team reported that *"the rejected unified administrator model has been dismantled and replaced by the authoritative 5-role institutional model"*, isolating `ADMIN` to `/admin/login` and putting `PRIMARY_MANAGER` on `/login`.
- However, as the client noted in the audit request, the presence of these separate records does NOT mean the separate-account architecture was approved. The client's approved direction remains **ONE unified administrator**.

### 1.3 Responsibilities of the Unified Administrator
The unified administrator (`admin@edu.com`) possesses full authority across both domains:

| Domain | Administrative Capabilities | Component / Route |
| :--- | :--- | :--- |
| **Branch Governance** | Create branches, toggle active/inactive status, physical vs. online | `/admin/branches` |
| **Financial Governance** | Set subject pricing in EGP, price change histories, grace/lock periods | `/admin/financial-policy` |
| **Staff Provisioning** | Create accountant accounts, assign to branches, view teachers | `/admin/team` |
| **Subscription Oversight** | Cross-branch student subscription matrix, lock overrides | `/admin/subscriptions` |
| **Cashbox & Receipts** | Inspect branch cashboxes, approve expense vouchers, review reversals | `/admin/cashbox`, `/admin/approvals` |
| **Receipt Audit** | Central sequential receipts log with tamper-evident serials | `/admin/receipts` |
| **Academic Oversight** | Central student roster, course creation, exam and homework management | `/admin/students`, `/admin/courses`, `/admin/exams` |
| **AI & Platform Risk** | System health, AI chatbot parameters, student academic risk matrix | `/admin/chatbot`, `/admin/risk` |

---

## 2. Actual Current Codebase Architecture

An inspection of the workspace code shows that the backend and dashboard are **already 90% unified**, and only the login entrypoint and role-card check are out of alignment.

### 2.1 Prisma Schema (`packages/database/prisma/schema.prisma`)
- **`Role` Enum (Lines 742–750):**
  ```prisma
  enum Role {
    ADMIN
    PRIMARY_MANAGER
    ACCOUNTANT
    TEACHER
    ONLINE_STUDENT
    CENTER_STUDENT
    PARENT
  }
  ```
- **`User` Model (Lines 117–158):**
  Contains both `role Role` and `isPrimaryManager Boolean @default(false)`:
  ```prisma
  institutionId      String?
  branchId           String?
  isPrimaryManager   Boolean             @default(false)
  role               Role
  managedInstitution Institution?        @relation("InstitutionPrimaryManager")
  ```
- **`Institution` Model (Lines 12–30):**
  Contains `primaryManagerId String? @unique` pointing to `User(id)`.

### 2.2 Backend Authorization Checks (`services/user-service/src/routes/`)
The backend route handlers have **already been unified** to accept both `ADMIN` and `PRIMARY_MANAGER` interchangeably:
- `router.post('/accountants', checkRole(['PRIMARY_MANAGER', 'ADMIN']), createAccountant);`
- `router.get('/team', checkRole(['PRIMARY_MANAGER', 'ADMIN']), getTeamMembers);`
- `router.post('/pricing', checkRole(['PRIMARY_MANAGER', 'ADMIN']), createPricingAgreement);`
- `router.post('/expenses/:id/approve', checkRole(['PRIMARY_MANAGER', 'ADMIN']), approveExpenseVoucher);`
- `router.post('/reversals/:adjustmentId/review', checkRole(['PRIMARY_MANAGER', 'ADMIN']), reviewReversal);`
- `router.get('/cashbox', checkRole(['ACCOUNTANT', 'PRIMARY_MANAGER', 'ADMIN']), listCashboxes);`
- All subscription, branch, and financial routes allow `['PRIMARY_MANAGER', 'ADMIN']`.

### 2.3 Frontend Dashboard Architecture (`apps/frontend/src/app/`)
- In `App.tsx` (Lines 93–102):
  ```tsx
  {/* Admin Dashboard */}
  <Route element={<ProtectedRoute allowedRoles={['ADMIN', 'PRIMARY_MANAGER']} />}>
    <Route path="/admin/*" element={<AdminDashboard />} />
  </Route>

  {/* Primary Manager Dashboard */}
  <Route element={<ProtectedRoute allowedRoles={['PRIMARY_MANAGER', 'ADMIN']} />}>
    <Route path="/manager/*" element={<PrimaryManagerDashboard />} />
  </Route>
  ```
- In `AdminDashboard.tsx`:
  The dashboard already imports and mounts the full primary manager toolset:
  - `ManagerAccountsPage` (`/admin/accounts`)
  - `BranchesPage` (`/admin/branches`)
  - `TeamManagementPage` (`/admin/team`)
  - `ApprovalsPage` (`/admin/approvals`)
  - `CashboxPage` (`/admin/cashbox`)
  - `ReceiptsPage` (`/admin/receipts`)
  - `FinancialPolicyPage` (`/admin/financial-policy`)
  - `SubscriptionsPage` (`/admin/subscriptions`)
  - PLUS `StudentsPage`, `CoursesManagementPage`, `ExamsManagementPage`, `HomeworkManagementPage`, `ChatbotSettings`, `RiskManagementPage`.
  **`AdminDashboard.tsx` is genuinely the unified administrative interface.**

### 2.4 The Exact Implementation Discrepancy: The Login Gate
The separation exists solely at the login form:
1. In `apps/frontend/src/app/components/auth/LoginPage.tsx`:
   The portal only renders cards for `PRIMARY_MANAGER`, `TEACHER`, `ACCOUNTANT`, `ONLINE_STUDENT`, `CENTER_STUDENT`, `PARENT`. It has **no** card for `ADMIN`. Clicking the Manager card forces `role: 'PRIMARY_MANAGER'`.
2. In `services/auth-service/src/controllers/auth.controller.ts` (Lines 42–47):
   ```typescript
   const user = await db.user.findFirst({
     where: {
       email: validatedData.email,
       role: validatedData.role as any
     }
   });
   if (!user) {
     return res.status(401).json({ 
       message: 'البريد الإلكتروني أو كلمة المرور غير صحيحة'
     });
   }
   ```
   When the client enters `admin@edu.com` on the main `/login` screen under the Manager card, `findFirst` looks for `email = 'admin@edu.com' AND role = 'PRIMARY_MANAGER'`. Because `admin@edu.com` is stored with `role = 'ADMIN'`, the query returns `null`, producing an authentication failure.

---

## 3. Database Account Census & Reconciliation

A live inspection of the authorized development database (`ox_digital_dev_test` on `127.0.0.1:5433`) revealed the following exact state:

### 3.1 The Canonical Administrator Account
```sql
SELECT id, email, name, role, "isPrimaryManager", "institutionId", "branchId", "deletedAt", "financialAccessStatus"
FROM "User" WHERE email = 'admin@edu.com';
```
- **ID:** `admin_91xnz3`
- **Email:** `admin@edu.com`
- **Name:** Platform Super Admin
- **Role:** `ADMIN`
- **isPrimaryManager:** `true` (`t`)
- **Institution Linkage:** `inst_idor_a_91xnz3` ("Institution A 91xnz3")
- **Branch Linkage:** `NULL` (unrestricted, cross-branch authority)
- **Status:** Active (`deletedAt: null`, `financialAccessStatus: ACTIVE`)
- **Institution Table Verification:**
  `SELECT id, name, "primaryManagerId" FROM "Institution" WHERE id = 'inst_idor_a_91xnz3';`
  -> `primaryManagerId` is explicitly set to **`admin_91xnz3`**.

This proves that `admin@edu.com` is **already** the primary manager and owner of the institution in the database.

### 3.2 The `PRIMARY_MANAGER` Accounts in the Database
The query returned 39 records with `role = 'PRIMARY_MANAGER'`. Analysis of their emails, IDs, and creation dates confirms:
- Accounts like `pm_262912@ox-digital.edu`, `pm_593750@ox-digital.edu`, `pm_060003@ox-digital.edu`:
  Created by automated end-to-end integration test runners (`tests/unified_platform_roles.test.ts`, `tests/tenant_idor_adversarial.test.ts`).
- Accounts like `manager.1793982015338@edu.com`, `mgr.1793982229803@startup.com`:
  Created with Unix epoch timestamps during test suite execution.
- Accounts like `pma_91xnz3@ox.com`, `pmb_91xnz3@ox.com`:
  Created by multi-tenant IDOR isolation tests.

**None of these 39 accounts are client or operational accounts.** They are test artifacts left behind by integration test runs. They do NOT represent an approved alternative administrator.

---

## 4. Definitive Answers: Login Account & Route

| Question | Definitive Answer |
| :--- | :--- |
| **Which single email/account should the client use?** | **`admin@edu.com`** (Account ID: `admin_91xnz3`). |
| **Which login URL currently works?** | **`http://localhost:8080/admin/login`** |
| **Which dashboard opens upon login?** | **`/admin/home`** (which contains the unified suite: Branches, Accounts, Cashbox, Receipts, Pricing, Subscriptions, Students, Courses, Exams, Homework, AI Chatbot). |
| **Does the current implementation support that account?** | **Yes, 100%** via `/admin/login`. Backend token issuance, institution scoping, and API routes fully accept this identity. |
| **What mismatch prevents logging in at `/login`?** | `LoginPage.tsx` sends `role: 'PRIMARY_MANAGER'` when the Manager card is clicked, but `admin@edu.com` has `role: 'ADMIN'` in the database. `auth.controller.ts` queries `{ email, role }` strictly, rejecting the login with HTTP 401. |

---

## 5. Proposed Safe Remediation Plan (Awaiting Approval)

To realign the platform fully with the client's single-login, unified administrator requirement **without modifying or compromising database integrity**, the following plan is proposed:

### Step 1: Align Authentication Controller (`services/auth-service/src/controllers/auth.controller.ts`)
Instead of a rigid compound match on `role`, update `auth.controller.ts` so that administrative roles are unified:
```typescript
// If the user attempts to log in as PRIMARY_MANAGER or ADMIN:
const isManagerOrAdminLogin = validatedData.role === 'PRIMARY_MANAGER' || validatedData.role === 'ADMIN';

const user = await db.user.findFirst({
  where: {
    email: validatedData.email,
    ...(isManagerOrAdminLogin 
      ? { OR: [{ role: 'ADMIN' }, { role: 'PRIMARY_MANAGER' }, { isPrimaryManager: true }] }
      : { role: validatedData.role })
  }
});
```
*Effect:* `admin@edu.com` can log in directly from the main `/login` screen by clicking the "المدير التنفيذي / مدير المؤسسة" card.

### Step 2: Ensure Seamless Dashboard Navigation
In `LoginPage.tsx` and `AuthContext.tsx`, ensure that any user logging in with administrative authority (`role === 'ADMIN' || user.isPrimaryManager`) is routed directly to the unified dashboard at `/admin/home` (or `/manager/home` if aliased).

### Step 3: Zero Database Mutations
- Do **not** alter the `enum Role` in PostgreSQL.
- Do **not** delete or mutate test fixture accounts.
- Do **not** run destructive database migrations.
- Keep `admin@edu.com` intact with its existing credentials and institution linkage.

---

## Mandatory Stop & Operator Next Steps

This investigation is complete. In strict adherence to safety instructions:
- **No database records have been modified.**
- **No code changes or migrations have been applied.**
- **No passwords or credentials have been exposed.**

### Verification Action You Can Take Right Now:
You can log in immediately to verify the platform using:
- **URL:** `http://localhost:8080/admin/login`
- **Email:** `admin@edu.com`
- **Dashboard:** `/admin/home`

Please review this report and confirm whether you would like to approve executing the safe remediation plan in Step 5 (allowing `admin@edu.com` to log in directly through the main `/login` portal).

