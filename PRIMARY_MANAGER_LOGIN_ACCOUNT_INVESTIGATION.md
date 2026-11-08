# OX-DIGITAL Education — Primary Manager Login Account Investigation Report

**Date:** November 6, 2026  
**Workspace:** `D:\OX-DIGITAL\Mathe\OX-DIGITAL-GITHUB`  
**Database:** `ox_digital_dev_test` on `127.0.0.1:5433` (Container: `ox-digital-isolated-dev-postgres`, User: `ox_dev_admin`)  
**Investigation Mode:** Strict Read-Only Forensic Audit  

---

## Executive Summary & Root Cause Finding

### The Root Cause of the Login Failure
The primary reason you cannot log in is an **architectural role and route separation**:
1. The account **`admin@edu.com`** is registered in the database with role **`ADMIN`** (**Platform Super Admin**), **NOT** `PRIMARY_MANAGER`.
2. The main login page at **`http://localhost:8080/login`** requires selecting an institutional role card. If you select **"المدير التنفيذي / مدير المؤسسة (Manager)"**, the frontend submits `role: "PRIMARY_MANAGER"`.
3. The authentication controller (`services/auth-service/src/controllers/auth.controller.ts`, lines 42–47) queries:
   ```typescript
   const user = await db.user.findFirst({
     where: {
       email: validatedData.email,  // "admin@edu.com"
       role: validatedData.role      // "PRIMARY_MANAGER"
     }
   });
   ```
   Because `admin@edu.com` has role `ADMIN`, PostgreSQL returns **zero records**, and the server responds with:  
   `401 Unauthorized: "البريد الإلكتروني أو كلمة المرور غير صحيحة"`.

4. **Two distinct login pathways exist in the platform:**
   - **For Platform Super Admin (`admin@edu.com`):** You must navigate to the dedicated administrator portal at **`http://localhost:8080/admin/login`**.
   - **For Primary Manager (`PRIMARY_MANAGER`):** You must navigate to **`http://localhost:8080/login`**, select **"المدير التنفيذي / مدير المؤسسة (Manager)"**, and use a verified **`PRIMARY_MANAGER`** email address (such as `pm_262912@ox-digital.edu`).

---

## 1. Verified Database Identity

Direct PostgreSQL identity queries executed against the active development container (`ox-digital-isolated-dev-postgres`) on port `5433`:
```sql
SELECT current_database(), current_user, inet_server_addr(), inet_server_port();
```

**Verified Identity Values:**
| Parameter | Value | Audit Verification |
|---|---|---|
| **Database Name** | `ox_digital_dev_test` | **MATCH** (Authorized isolated dev target) |
| **Database User** | `ox_dev_admin` | **MATCH** |
| **Host Port** | `5433` | **MATCH** (`127.0.0.1:5433 -> 5432/tcp`) |
| **Container ID** | `c45dfd885d9c` | **MATCH** (`ox-digital-isolated-dev-postgres`) |
| **Storage Volume** | `ox_digital_isolated_dev_pgdata` | **MATCH** |

*Staging (port 5432) and production infrastructure were untouched.*

---

## 2. Platform Roles & Authentication Architecture

### 2.1 Role Identifiers (`packages/database/prisma/schema.prisma`)
The system recognizes two distinct managerial roles:
```prisma
enum Role {
  ADMIN            // SaaS Platform Super Admin (Global platform governance, technical health)
  PRIMARY_MANAGER  // Center / Educational Institution Executive Manager (BRD Module authority)
  ACCOUNTANT       // Branch-scoped financial collector
  TEACHER          // Course instructor
  ONLINE_STUDENT   // Remote student
  CENTER_STUDENT   // Center student
  PARENT           // Guardian
}
```

### 2.2 Server-Side Role Enforcement
In `services/auth-service/src/controllers/auth.controller.ts`:
- Login requires a strict 3-tuple: `email`, `password`, and `role`.
- The database lookup strictly couples `email` with `role`:
  ```typescript
  where: {
    email: validatedData.email,
    role: validatedData.role
  }
  ```
- **Consequence:** If the role passed in the login payload does not exactly match the database column `User.role`, authentication fails immediately with HTTP 401, regardless of whether the password is correct.

---

## 3. Account Analysis: `admin@edu.com` vs. Primary Manager

### 3.1 `admin@edu.com` Forensic Record
Query result from `SELECT * FROM "User" WHERE email = 'admin@edu.com'`:
- **Account ID:** `admin_91xnz3`
- **Name:** `Platform Super Admin`
- **Exact Email in DB:** `admin@edu.com` (lowercase)
- **Role:** **`ADMIN`**
- **`isPrimaryManager` Flag:** `true` (Historical flag from pre-realignment schema)
- **Institution ID:** `inst_idor_a_91xnz3` (`Institution A 91xnz3`)
- **Branch ID:** `null` (Global platform scope)
- **Active Status:** **ACTIVE** (`deletedAt = null`)
- **Must Change Password:** `false`
- **Created At:** `2026-11-05T11:15:12.664Z`

**Conclusion on `admin@edu.com`:**  
`admin@edu.com` is a **Platform Super Admin (`ADMIN`)**. It is **not** a `PRIMARY_MANAGER`.  
Attempting to log into `admin@edu.com` from `/login` under the `PRIMARY_MANAGER` card will **always fail with HTTP 401**.

---

### 3.2 Existing Primary Manager (`PRIMARY_MANAGER`) Accounts

Direct query of all accounts with `role = 'PRIMARY_MANAGER'` in `ox_digital_dev_test`:

#### Canonical Institution Manager Accounts (`Institution A 91xnz3`):
| # | Account ID | Display Name | Exact Email Address | Linked Institution | Status |
|---|---|---|---|---|---|
| **1** | `29021705-0a0b-4ece-b206-3f63faa34c61` | Dr. Primary Manager | **`pm_262912@ox-digital.edu`** | `inst_idor_a_91xnz3` | **ACTIVE** (`deletedAt: null`) |
| **2** | `586c8cc1-b277-49da-80d5-829cbb633ad9` | Dr. Primary Manager | **`pm_262010@ox-digital.edu`** | `inst_idor_a_91xnz3` | **ACTIVE** (`deletedAt: null`) |
| **3** | `44ae3059-4949-4c7c-acb9-964b1b6e33bd` | Dr. Primary Manager | **`pm_593750@ox-digital.edu`** | `inst_idor_a_91xnz3` | **ACTIVE** (`deletedAt: null`) |
| **4** | `ece44430-a8ec-4539-8033-04bc949ee25d` | Dr. Primary Manager | **`pm_418469@ox-digital.edu`** | `inst_idor_a_91xnz3` | **ACTIVE** (`deletedAt: null`) |
| **5** | `56a64d94-fc3f-4cc3-9cca-2e3861a4c58f` | Dr. Primary Manager | **`pm_060003@ox-digital.edu`** | `inst_idor_a_91xnz3` | **ACTIVE** (`deletedAt: null`) |
| **6** | `pm_a_91xnz3` | PM A | **`pma_91xnz3@ox.com`** | `inst_idor_a_91xnz3` | **ACTIVE** (`deletedAt: null`) |

#### Secondary Institution Manager Accounts:
| # | Account ID | Display Name | Exact Email Address | Linked Institution | Status |
|---|---|---|---|---|---|
| **7** | `pm_b_91xnz3` | PM B | **`pmb_91xnz3@ox.com`** | `inst_idor_b_91xnz3` (50 branches) | **ACTIVE** (`deletedAt: null`) |
| **8** | `pm_p553_esm2rl` | Test PM | **`pm_esm2rl@test.com`** | `inst_p553_esm2rl` | **ACTIVE** (`deletedAt: null`) |

*Note: Document `UNIFIED_PLATFORM_AND_ROLE_BASED_LOGIN_REPORT.md` (line 42) explicitly recognizes **`pm_262912@ox-digital.edu`** as the canonical sample identity for the `PRIMARY_MANAGER` role.*

---

## 4. Login Portals, URLs & Role Selection Guide

### Scenario A: You Want to Log in as Platform Super Admin (`admin@edu.com`)
- **Correct Login URL:** **`http://localhost:8080/admin/login`**
- **Role Selection:** No role card selection needed. The `/admin/login` portal hardcodes `role: "ADMIN"`.
- **Target Dashboard:** `/admin/home` (Global SaaS tenant administration, platform health, user provisioning).
- **Why `/login` fails:** On `/login`, the manager card sends `role: "PRIMARY_MANAGER"`, causing a database role mismatch.

---

### Scenario B: You Want to Log in as Center Primary Manager
- **Correct Login URL:** **`http://localhost:8080/login`**
- **Step 1 — Role Selection:** Select Card 1:
  > **المدير التنفيذي / مدير المؤسسة (Manager)**  
  > *شارة: إدارة عليا وحوكمة*  
  > *الوصف: إدارة فروع المؤسسة، المعلمين، حوكمة الأسعار والاشتراكات، وسجل الطلاب المركزي*
- **Step 2 — Email Field:** Enter an existing Primary Manager email:
  > **`pm_262912@ox-digital.edu`** (or `pma_91xnz3@ox.com`)
- **Step 3 — Password Field:** Enter the account password.
- **Target Dashboard:** `/manager/home` (Multi-branch overview, teacher subscription pricing, cashboxes, student ownership transfers).

---

## 5. Potential Pitfalls Explaining Login Failures

1. **Email Case Sensitivity:**
   - In PostgreSQL and Prisma, `where: { email }` performs an exact case-sensitive match.
   - Entering `Admin@edu.com` or `PM_262912@ox-digital.edu` (with capital letters) will fail.
   - **Resolution:** Type the email in **strictly lowercase**: `admin@edu.com` or `pm_262912@ox-digital.edu`.

2. **Accidental Trailing Spaces:**
   - Copy-pasting an email often introduces a hidden trailing space (`"admin@edu.com "`).
   - The backend Zod validator checks `.email()`, but Prisma does not auto-trim.
   - **Resolution:** Ensure no leading or trailing whitespace.

3. **Wrong Portal for the Account:**
   - Using `admin@edu.com` on `http://localhost:8080/login` fails because `/login` only supports institutional roles (`PRIMARY_MANAGER`, `TEACHER`, `ACCOUNTANT`, `STUDENT`, `PARENT`).
   - Super Admin `admin@edu.com` must use `http://localhost:8080/admin/login`.

---

## 6. Verification Summary Checklist

| Objective | Verified Finding |
|---|---|
| **Database Target Verified** | `127.0.0.1:5433` / `ox_digital_dev_test` (Container: `ox-digital-isolated-dev-postgres`) |
| **`admin@edu.com` Role** | **`ADMIN`** (Platform Super Admin). NOT `PRIMARY_MANAGER`. |
| **`admin@edu.com` Correct URL** | **`http://localhost:8080/admin/login`** |
| **Canonical Primary Manager Email** | **`pm_262912@ox-digital.edu`** (ID: `29021705-0a0b-4ece-b206-3f63faa34c61`) |
| **Primary Manager Correct URL** | **`http://localhost:8080/login`** -> Select **"المدير التنفيذي / مدير المؤسسة (Manager)"** |
| **Account Active Status** | Verified `deletedAt = null` (Active) for both accounts |
| **Safety Integrity** | Read-only investigation. Zero passwords, hashes, or records modified. |

