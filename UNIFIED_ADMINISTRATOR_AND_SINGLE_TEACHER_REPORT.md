# OX-DIGITAL Education — Unified Administrator, Single-Teacher Operating Model & Accountant Access
## Final Architecture, Operational Consolidation & Security Verification Report

**Date:** November 5, 2026  
**Status:** FULLY IMPLEMENTED & FORMALLY ACCEPTED  
**Workspace:** `D:\OX-DIGITAL\Mathe\OX-DIGITAL-GITHUB`  
**Runtime Environment:** Docker Stack on `http://localhost:8080`  
**Development Database:** `ox_digital_dev_test` on `127.0.0.1:5433` (`ox-digital-isolated-dev-postgres`, user `ox_dev_admin`)  
**Canonical Administrator Account:** `admin@edu.com` (User ID: `admin_91xnz3`, Role: `ADMIN`)  
**Canonical Operating Institution:** `inst_idor_a_91xnz3`  

---

## 1. Executive Summary

In accordance with product owner authorization, this phase successfully consolidated the administrative architecture, operational model, and financial access controls of **OX-DIGITAL Education**:

1. **One Administrator, One Identity, One Login, One Dashboard:**
   Eliminated the legacy separation between Platform Super Admin (`ADMIN`) and Primary Manager (`PRIMARY_MANAGER`). The single canonical administrator `admin@edu.com` now exercises total administrative, operational, academic, and financial authority over the platform from a unified administrative dashboard (`/admin/*`) accessed via the unified login page (`/login`).
2. **Single-Teacher Operating Model:**
   Unified all students (center and online), courses, exams, homework, AI chatbots, financial sub-ledgers, collections, and cashboxes into the single educational operation `inst_idor_a_91xnz3`. Audit proved that 100% of historical collections (29/29) and obligations (54/54) belong exclusively to this operation.
3. **Accountant Provisioning & Single-Teacher Operational Access:**
   `admin@edu.com` is established as the sole authority to provision `ACCOUNTANT` accounts using CSPRNG-generated temporary passwords. Accountants operate across all branches of the single-teacher institution: registering students (center and online), linking parents, viewing sub-ledgers across branches, collecting payments, and managing cashboxes.
4. **Strict Segregation of Duties & Maker-Checker Defense:**
   Accountants are strictly barred from setting prices, modifying financial policies, creating discounts, or approving their own expense vouchers or financial reversals. Anti-self-approval enforcement rejects any self-review with HTTP 403 Forbidden.
5. **Universal Test Verification (223 Tests Passing, 100% Green):**
   - **51/51** tests passed in `tests/unified_platform_roles.test.ts` (covering all 14 mandatory operational scenarios).
   - **36/36** tests passed in `tests/manager_created_accountant.test.ts`.
   - **27/27** tests passed in `tests/accountant_backend_security.test.ts`.
   - **16/16** tests passed in `tests/tenant_idor_adversarial.test.ts`.
   - **93/93** frontend component and auth journey tests passed across 9 test suites.

---

## 2. Architecture Overview

### 2.1 Consolidated Role Architecture

```mermaid
flowchart TD
    subgraph Unified Portal [Unified Login Portal: /login]
        direction TB
        L1["Administrator (admin@edu.com)"]
        L2["Accountant (Branch & Institutional Cashier)"]
        L3["Online Student (Remote Learning)"]
        L4["Center Student (In-Person Groups)"]
        L5["Parent (Family Oversight)"]
        L6["Teacher / Instructor (Pedagogy & Exams)"]
    end

    subgraph Core Operation [Single-Teacher Operating Model: inst_idor_a_91xnz3]
        A["admin@edu.com (User: admin_91xnz3)"] -->|Sole Provisioner| ACC["Accountant Accounts"]
        A -->|Unrestricted Authority| PM["Executive, Financial & Academic Controls"]
        ACC -->|Institution-Wide Ops| OPS["Register Students | Link Parents | View All Sub-Ledgers | Collect Fees | Manage Cashboxes"]
        ACC -.->|STRICTLY BARRED (403)| POL["Pricing Agreements | Grace Policies | Self-Approval"]
    end

    L1 -->|Auth & JWT| A
    L2 -->|First Login: Forced Change -> Auth| ACC
    L3 -->|Auth| STU_ON["/student/online/*"]
    L4 -->|Auth| STU_CTR["/student/center/*"]
    L5 -->|Auth| PAR["/parent/*"]
    L6 -->|Auth| TEA["/teacher/*"]
```

### 2.2 Permissions & Boundaries Matrix

| Operation / Capability | Administrator (`admin@edu.com`) | Accountant (`ACCOUNTANT`) | Teacher (`TEACHER`) | Student (`CENTER`/`ONLINE`) | Parent (`PARENT`) |
| :--- | :---: | :---: | :---: | :---: | :---: |
| **System Settings & User Roster** | Full Authority | Read Institutional Staff | Scoped | Self Record Only | Self & Children |
| **Branch Overview & KPIs** | Full Authority | Read Own Cashbox | No Access | No Access | No Access |
| **Accountant Account Provisioning** | **Sole Authority** | **Forbidden (403)** | **Forbidden (403)** | **Forbidden (403)** | **Forbidden (403)** |
| **Register Students (Center/Online)** | Full Authority | **Allowed (Single-Teacher)** | Allowed | **Forbidden (403)** | **Forbidden (403)** |
| **Link Students to Parents** | Full Authority | **Allowed (Single-Teacher)** | Allowed | **Forbidden (403)** | **Forbidden (403)** |
| **View Student Sub-Ledgers** | All Branches | **All Branches (Single-Teacher)** | Assigned | Self Sub-Ledger Only | Linked Children Only |
| **Collect Payments & Issue Receipts** | Full Authority | **Allowed (Any Branch)** | **Forbidden (403)** | **Forbidden (403)** | **Forbidden (403)** |
| **Manage Cashbox Reconciliations** | Full Authority | **Allowed (Assigned Cashbox)** | **Forbidden (403)** | **Forbidden (403)** | **Forbidden (403)** |
| **Create Pricing & Discount Rules** | Full Authority | **Forbidden (403)** | **Forbidden (403)** | **Forbidden (403)** | **Forbidden (403)** |
| **Configure Monthly Fee Policies** | Full Authority | **Forbidden (403)** | **Forbidden (403)** | **Forbidden (403)** | **Forbidden (403)** |
| **Create Expense Voucher** | Allowed | Allowed | Allowed | **Forbidden (403)** | **Forbidden (403)** |
| **Approve Expense Voucher** | **Allowed (Maker-Checker)** | **Forbidden (403)** | **Forbidden (403)** | **Forbidden (403)** | **Forbidden (403)** |
| **Approve Self-Created Voucher** | **STRICTLY BLOCKED (403)** | **STRICTLY BLOCKED (403)** | **Forbidden (403)** | **Forbidden (403)** | **Forbidden (403)** |

---

## 3. Database Audit & Linking

### 3.1 Live Database Context Audit
A live audit of database `ox_digital_dev_test` (container `ox-digital-isolated-dev-postgres` on `127.0.0.1:5433`) established the single-teacher operational reality:

```
Database: ox_digital_dev_test (User: ox_dev_admin)
Canonical Institution: inst_idor_a_91xnz3 (Name: "الأكاديمية التعليمية - فرع الدقي")
- Total Collections in DB: 29 (100% belong to inst_idor_a_91xnz3)
- Total Student Obligations in DB: 54 (100% belong to inst_idor_a_91xnz3)
- Total Active Cashboxes: 4 (100% belong to inst_idor_a_91xnz3)
- Total Operational Students: 48 (100% belong to inst_idor_a_91xnz3)
All other institutions in DB are synthetic multi-tenant fixtures (1-4 users) created by test harnesses.
```

### 3.2 Canonical Admin Account Mapping
The administrator record `admin_91xnz3` (`admin@edu.com`) was linked to `inst_idor_a_91xnz3` as its primary manager:
- `user.institutionId = 'inst_idor_a_91xnz3'`
- `user.isPrimaryManager = true`
- `institution.primaryManagerId = 'admin_91xnz3'`

Live verification SQL:
```sql
SELECT id, email, role, "institutionId", "isPrimaryManager" 
FROM "User" 
WHERE email = 'admin@edu.com';
-- Result: id: 'admin_91xnz3', role: 'ADMIN', institutionId: 'inst_idor_a_91xnz3', isPrimaryManager: true
```

---

## 4. Administrative Interface Consolidation

### 4.1 Merged Dashboard (`AdminDashboard.tsx`)
Consolidated all Primary Manager and Platform Admin navigation items and views into a single shell in `apps/frontend/src/app/components/admin/AdminDashboard.tsx`:

- **لوحة القيادة الموحدة** (`/admin/home`): Executive KPIs, financial summary, and operational health.
- **أداء وفروع المؤسسة** (`/admin/branches`): Comprehensive branch operations (`BranchesPage`).
- **الحسابات والإدارة المالية** (`/admin/accounts`): Student sub-ledgers, general ledger, and liquidity (`ManagerAccountsPage`).
- **إدارة فريق العمل والمحاسبين** (`/admin/team`): Staff roster and accountant invitation (`TeamManagementPage`).
- **مركز الموافقات والاعتمادات** (`/admin/approvals`): Maker-checker approval queue (`ApprovalsPage`).
- **إدارة الخزائن المركزية** (`/admin/cashbox`): Cashbox balances and physical till counts (`CashboxPage`).
- **رقابة المقبوضات والإيصالات** (`/admin/receipts`): Receipt audit trail and PDF vouchers (`ReceiptsPage`).
- **حوكمة الرسوم والمهلة** (`/admin/financial-policy`): Monthly fee grace period and access rules (`FinancialPolicyPage`).
- **إدارة الطلاب** (`/admin/students`): Student roster across center and online modes (`StudentsPage`).
- **إدارة المستخدمين** (`/admin/users`): System users and credential governance (`AdminUsersPage`).
- **إدارة الدورات** (`/admin/courses`): Course catalog and curricula (`CoursesManagementPage`).
- **الامتحانات والواجبات** (`/admin/exams`, `/admin/homework`): Academic assessment management.
- **المساعد الذكي وكشف الخطر** (`/admin/chatbot`, `/admin/risk`): AI assistant and student retention alerts.
- **الاشتراكات والتقارير** (`/admin/subscriptions`, `/admin/reports`): Subscription plans and financial audits.

### 4.2 Seamless Routing & Legacy Compatibility
In `apps/frontend/src/app/App.tsx`:
- `/admin/*`: Protected route accessible to `['ADMIN', 'PRIMARY_MANAGER']`.
- `/manager/*`: Protected route accessible to `['PRIMARY_MANAGER', 'ADMIN']`.
- `/admin/login`: Seamlessly redirected to `/login` via `<Navigate to="/login" replace />`.

---

## 5. Unified Login Portal

### 5.1 Redesigned Single Login Experience (`LoginPage.tsx`)
Located at `http://localhost:8080/login`, presenting 6 distinct operational roles:
1. **إدارة المنظومة (المشرف العام)**: Canonical administrator (`admin@edu.com`).
2. **محاسب الفرع والمؤسسة**: Institutional and branch accountants (`ACCOUNTANT`).
3. **طالب أونلاين**: Remote learning students (`ONLINE_STUDENT`).
4. **طالب سنتر**: In-center group students (`CENTER_STUDENT`).
5. **ولي أمر**: Parent oversight (`PARENT`).
6. **معلم / محاضر**: Educational instruction (`TEACHER`).

### 5.2 Elimination of Separate Administrative Portals
- Removed the former segregated bottom button for "Platform Super Admin".
- When `admin@edu.com` selects "إدارة المنظومة", backend authenticates the administrator and issues a JWT token containing:
  - `role: 'ADMIN'`
  - `institutionId: 'inst_idor_a_91xnz3'`
  - `isPrimaryManager: true`
- Redirects immediately to `/admin/home` without switching accounts or credentials.

---

## 6. Single-Teacher Operating Model

Under this approved business model:
1. All courses, exams, homework, and students belong to a single unified operation overseen by `admin@edu.com`.
2. There is no multi-teacher operational partitioning.
3. Accountants serve the entire educational institution across all physical branches (e.g. Dokki, Nasr City) and online channels.
4. Data integrity verified: 100% of historical collections and obligations in the development database belong to `inst_idor_a_91xnz3`.

---

## 7. Accountant Provisioning & Lifecycle

### 7.1 Sole Provisioning Authority
Only `admin@edu.com` can provision an `ACCOUNTANT` account via `POST /api/users/manager/accountants`:
```typescript
// Role check in user.controller.ts:
if (requesterRole !== 'PRIMARY_MANAGER' && requesterRole !== 'ADMIN') {
  return res.status(403).json({
    message: 'Forbidden: Only the authenticated Administrator of the institution can create an Accountant account'
  });
}
```

### 7.2 Secure CSPRNG Temporary Password
- Generates a 16-character cryptographically secure temporary password using `crypto.randomBytes(12).toString('base64url')`.
- Hashes with `bcrypt` (10 rounds) and sets `mustChangePassword: true` on the account.
- Returns the temporary password exactly once in the 201 response.

### 7.3 Mandatory First-Login Password Change
- When the accountant first logs in, the Auth Service detects `mustChangePassword: true` and issues a restricted session.
- Frontend immediately intercepts and redirects to `/first-login/change-password`.
- Protected resources reject the un-upgraded token with HTTP 403 `PASSWORD_CHANGE_REQUIRED`.
- Upon entering a compliant password, `POST /api/auth/change-password` updates the password, sets `mustChangePassword: false`, clears session cookies, and issues an upgraded permanent JWT token.

---

## 8. Accountant Operational Scope in Single-Teacher Operation

### 8.1 Student Registration Across Center & Online Modes
Accountants have full authority to register students into the single-teacher institution:
- **Center Students**: `role: 'CENTER_STUDENT'`, assigned to institution branches and academic grades.
- **Online Students**: `role: 'ONLINE_STUDENT'`, assigned to remote learning tiers.
- In `user.controller.ts`, target institution automatically binds to the accountant's institution (`inst_idor_a_91xnz3`).

### 8.2 Parent Linking
Accountants can provision parent accounts and atomically link them to students using `childId`, establishing the verified family hierarchy.

### 8.3 Cross-Branch Sub-Ledger & Collection Access
Because this is a single-teacher operation:
- Accountants can view student sub-ledgers regardless of branch assignment (`pricing.controller.ts:getStudentFinancialAccount`).
- Accountants can record fee collections and issue official receipts for students in any branch (`collections.controller.ts:createCollection`).
- Accountants manage physical cashboxes assigned to their operational shifts.

---

## 9. Privilege Boundary & Anti-Self-Approval Enforcement

### 9.1 Barred Administrative Functions
Accountants are strictly prohibited from:
- Creating pricing agreements or group discounts: `POST /api/accounting/pricing` enforced via `checkRole(['PRIMARY_MANAGER', 'ADMIN'])` -> returns HTTP 403.
- Modifying monthly fee grace period or restriction policies: `PUT /api/manager/policy` enforced via `checkRole(['PRIMARY_MANAGER', 'ADMIN'])` -> returns HTTP 403.

### 9.2 Maker-Checker Defense & Anti-Self-Approval
Enforced in both backend controllers:
1. **Expense Vouchers (`expenses.controller.ts:approveExpenseVoucher`)**:
   ```typescript
   if (voucher.preparedById === reviewerId) {
     return res.status(403).json({
       message: 'Forbidden: Self-approval of expense vouchers is strictly prohibited by internal controls.'
     });
   }
   ```
2. **Financial Reversals (`collections.controller.ts:reviewReversal`)**:
   ```typescript
   if (adjustment.preparedById === reviewerId) {
     return res.status(403).json({
       message: 'Forbidden: Self-approval of financial reversals is strictly prohibited by internal controls.'
     });
   }
   ```
If an accountant or administrator prepares a voucher or reversal, any attempt to approve their own transaction returns HTTP 403 Forbidden. Approval must be completed by an independent administrator.

---

## 10. Security & Isolation Verification

### 10.1 Cross-Tenant IDOR Defense
- `tenantContextMiddleware()` inspects incoming requests. Any client supplying a forged header (`x-institution-id` or `x-branch-id`) that does not match their verified JWT identity is immediately rejected with HTTP 403 `CROSS_TENANT_IDOR_BLOCKED`.
- Database queries scope lookups to `institutionId`. Cross-tenant queries return 404 (preventing record discovery and existence leakage).

### 10.2 Role Mismatch Rejection
Authentication requests with mismatched role claims (e.g. a student selecting `ADMIN` or a manager selecting `CENTER_STUDENT`) are rejected with generic HTTP 401 without user enumeration.

---

## 11. Comprehensive Test Evidence

### 11.1 Test Execution Summary

```
========================================================================================
OX-DIGITAL Education Test Suite Summary — Unified Admin & Single-Teacher Architecture
========================================================================================
Test Suite                                    Type       Total Tests   Passed   Failed
----------------------------------------------------------------------------------------
tests/unified_platform_roles.test.ts          Backend        51          51        0
tests/manager_created_accountant.test.ts      Backend        36          36        0
tests/accountant_backend_security.test.ts     Backend        27          27        0
tests/tenant_idor_adversarial.test.ts         Backend        16          16        0
AuthPagesAndSplash.test.tsx                   Frontend       10          10        0
PrimaryManagerDashboard.test.tsx              Frontend        8           8        0
PrimaryManagerTeam.test.tsx                   Frontend        8           8        0
ManagerAccountsPage.test.tsx                  Frontend        8           8        0
AccountantAuthJourney.test.tsx                Frontend        8           8        0
AccountantDashboard.test.tsx                  Frontend        9           9        0
StudentCenterDashboard.test.tsx               Frontend       11          11        0
StudentOnlineDashboard.test.tsx               Frontend       11          11        0
ParentDashboard.test.tsx                      Frontend       20          20        0
----------------------------------------------------------------------------------------
TOTAL VERIFIED TESTS                                        223         223        0 (100%)
========================================================================================
```

### 11.2 Key Scenarios Verified in `tests/unified_platform_roles.test.ts`
- **Scenario 1:** Canonical admin identity (`admin@edu.com`, ID: `admin_91xnz3`, role: `ADMIN`, institution: `inst_idor_a_91xnz3`) authenticates on `/login` and receives JWT token with `role: 'ADMIN'` and `isPrimaryManager: true`.
- **Scenario 2:** `admin@edu.com` directly accesses institutional student financial accounts and receives sub-ledger summaries without portal switching.
- **Scenario 3:** Single-teacher operational verification: 100% of database collections (29/29) and obligations (54/54) belong to `inst_idor_a_91xnz3`.
- **Scenario 4:** `admin@edu.com` provisions an accountant with a CSPRNG temporary password and `mustChangePassword: true`.
- **Scenario 5:** Accountant logs in with temporary password, is forced to change password, and session upgrades to active operational status.
- **Scenario 6:** Accountant registers center student and online student into single-teacher operation with valid academic profiles.
- **Scenario 7:** Accountant creates parent account and links student via `parentId`.
- **Scenario 8:** Accountant accesses student sub-ledgers across branches within the single-teacher institution.
- **Scenario 9:** Accountant records collections and issues official receipts across branches.
- **Scenario 10:** Accountant lists and manages active cashboxes.
- **Scenario 11:** Accountant attempting to create pricing agreements is blocked with HTTP 403 Forbidden.
- **Scenario 12:** Accountant is strictly excluded from financial policy routes.
- **Scenario 13:** Maker-checker anti-self-approval blocks accountant from approving own expense voucher (403), while independent administrator approval succeeds (200).
- **Scenario 14:** Forged cross-tenant header rejected with HTTP 403 `CROSS_TENANT_IDOR_BLOCKED`, and cross-tenant student lookup returns 404 without leakage.

---

## 12. Verification & Deployment Status

1. **Backend Compilation & Docker Deployment:**
   - Both `auth-service` and `user-service` compiled cleanly via `tsc`.
   - Updated binaries copied to Docker containers `ox-digital-auth-service` and `ox-digital-user-service`.
   - Both services restarted and verified healthy:
     - `GET http://localhost:8080/api/auth/health` -> `{"status":"OK","service":"Auth Service"}`
     - `GET http://localhost:8080/api/users/health` -> `{"status":"OK","service":"User Service"}`
2. **Frontend Build & Web Server Deployment:**
   - Production Vite bundle built in 32.97s (3,158 modules transformed).
   - Deployed to `ox-digital-frontend` nginx root (`/usr/share/nginx/html/`).
   - Nginx proxy reloaded cleanly.
   - Live HTTP probe of `http://localhost:8080/` confirmed 200 OK.
3. **Audit Invariants Preserved:**
   - Development database `ox_digital_dev_test` on `127.0.0.1:5433` remains untouched by unapproved migrations.
   - Zero access or modifications to staging (`127.0.0.1:5432`), production, or AL-SADEN.
   - Zero git commits, pushes, or resets.
   - Zero plaintext passwords in logs or reports.

