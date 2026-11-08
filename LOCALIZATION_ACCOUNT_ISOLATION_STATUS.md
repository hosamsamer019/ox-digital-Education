# OX-DIGITAL Education — Per-Account Language Isolation & Preference Persistence Status

**Date:** November 8, 2026  
**System:** OX-DIGITAL Education Platform  
**Target Workspace:** `D:\OX-DIGITAL\Mathe\OX-DIGITAL-GITHUB`  
**Target Database:** `ox_digital_dev_test` on `127.0.0.1:5433` (PostgreSQL 15 via container `ox-digital-isolated-dev-postgres`)  
**Scope:** Architectural Evaluation & Operational Verification Status of Account Preferences  
**Overall Verdict:** **ARCHITECTURE SOUND & VERIFIED AT SOURCE/DB / OPERATIONAL LIVE MULTI-USER ISOLATION `NOT VERIFIED`**

---

## 1. Executive Summary

This document defines the architectural implementation and operational verification status of per-account language preferences in the **OX-DIGITAL Education** platform.

A critical design requirement of the platform is that user language and theme preferences must be:
1. **Account-Specific:** Tied directly to the user's account record in the database rather than existing purely as ephemeral browser state.
2. **Persistent:** Retained across multiple logins, devices, and sessions.
3. **Isolated:** Protected against leakage across different user sessions sharing the same browser or computer terminal.

The source-code and database audits confirm that the persistence architecture is fully implemented and sound across the PostgreSQL database, backend profile APIs, and frontend authentication context. However, in accordance with strict workspace safety instructions that prohibit credential alterations, database writes, or unauthorized account sign-ins, live concurrent multi-user sequential session isolation is formally declared **`NOT VERIFIED`**.

---

## 2. Preference Persistence Architecture

The platform implements an end-to-end, multi-tier architecture for managing user preferences:

```
┌────────────────────────────────────────────────────────────────────────┐
│                        PREFERENCE ARCHITECTURE                         │
├────────────────────────────────────────────────────────────────────────┤
│ 1. POSTGRESQL DATABASE                                                 │
│    Table "User"                                                        │
│    ├── language: text NOT NULL DEFAULT 'ar'                            │
│    └── theme: text NOT NULL DEFAULT 'default'                          │
│                                                                        │
│ 2. BACKEND API & JWT PAYLOAD                                           │
│    POST /api/auth/login -> Issues JWT containing user ID & role        │
│    GET  /api/users/profile -> Returns full User record (language,theme)│
│    PATCH /api/users/profile -> Persists user preference updates        │
│                                                                        │
│ 3. CLIENT-SIDE AUTH & HYDRATION                                        │
│    AuthContext.applyUserPreferences(userObj)                           │
│    ├── localStorage.setItem('preferred_language', user.language)       │
│    ├── localStorage.setItem('edu-lang', user.language)                 │
│    ├── localStorage.setItem('preferred_theme', user.theme)            │
│    ├── localStorage.setItem('edu-user', JSON.stringify(user))          │
│    ├── document.documentElement.lang = user.language                   │
│    ├── document.documentElement.dir = (lang === 'ar' ? 'rtl' : 'ltr')  │
│    └── window.dispatchEvent(new CustomEvent('app:preference-sync'))   │
│                                                                        │
│ 4. LOGOUT PURGE & ANTI-LEAKAGE                                         │
│    AuthContext.logout()                                                │
│    ├── localStorage.removeItem('token')                                │
│    ├── localStorage.removeItem('edu-user')                             │
│    ├── localStorage.removeItem('preferred_language')                   │
│    ├── localStorage.removeItem('edu-lang')                             │
│    ├── localStorage.removeItem('preferred_theme')                      │
│    ├── localStorage.removeItem('edu-theme')                            │
│    └── localStorage.removeItem('theme')                                │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Database Layer Verification

A read-only SQL inspection of the development database `ox_digital_dev_test` confirmed:

### 3.1 Table `"User"` Schema
```sql
                                  Table "public.User"
   Column   |  Type  | Collation | Nullable |              Default              
------------+--------+-----------+----------+-----------------------------------
 id         | text   |           | not null | 
 email      | text   |           | not null | 
 role       | "Role" |           | not null | 
 language   | text   |           | not null | 'ar'::text
 theme      | text   |           | not null | 'default'::text
```

### 3.2 Pre-Existing Account Preferences Distribution
A read-only aggregation query on existing database records yielded:
```
 count | language |  theme  
-------+----------+---------
     1 | ar       | dark
     5 | ar       | default
     1 | en       | default
(3 rows)
```

**Key Findings:**
- Existing user accounts independently store different language configurations (`'ar'` and `'en'`).
- Existing user accounts independently store different theme configurations (`'dark'` and `'default'`).
- The database schema is fully equipped to persist individual user choices independently of client-side storage.

---

## 4. Frontend Client Lifecycle & Isolation Mechanics

### 4.1 Login Hydration (`AuthContext.tsx`)
When a user signs in, `applyUserPreferences(fullUser)` executes:
```typescript
const applyUserPreferences = (userObj: any) => {
  if (!userObj) return;

  // Synchronize language from user record
  if (userObj.language) {
    const lang = userObj.language === 'en' ? 'en' : 'ar';
    localStorage.setItem('preferred_language', lang);
    localStorage.setItem('edu-lang', lang);
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
  }

  // Synchronize theme from user record
  if (userObj.theme) {
    localStorage.setItem('preferred_theme', userObj.theme);
    localStorage.setItem('edu-theme', userObj.theme);
    document.documentElement.setAttribute('data-theme', userObj.theme);
  }

  // Broadcast sync event to reactive listeners
  window.dispatchEvent(new CustomEvent('app:preference-sync', {
    detail: { language: userObj.language, theme: userObj.theme }
  }));
};
```

### 4.2 In-Session Switching (`LanguageContext.tsx` & `AccountSettingsPage.tsx`)
When a user switches languages via the settings UI:
1. `LanguageContext.setLanguage(newLang)` updates local React state and updates `document.documentElement` attributes.
2. An asynchronous API request is dispatched to `PATCH /api/users/profile` with `{ language: newLang }`.
3. The database updates the `User.language` column for that authenticated user's ID.

### 4.3 Session Logout Purge (`AuthContext.tsx`)
To prevent preference leakage between different users on shared browser sessions, `AuthContext.logout()` executes an unconditional purge of all stored preference keys:
```typescript
const logout = () => {
  setUser(null);
  localStorage.removeItem('token');
  localStorage.removeItem('edu-user');
  localStorage.removeItem('preferred_language');
  localStorage.removeItem('edu-lang');
  localStorage.removeItem('preferred_theme');
  localStorage.removeItem('edu-theme');
  localStorage.removeItem('theme');

  // Reset DOM to neutral platform default
  document.documentElement.lang = 'ar';
  document.documentElement.dir = 'rtl';
  document.documentElement.setAttribute('data-theme', 'default');
};
```

---

## 5. Non-Interference Guarantee

During the localization remediation phase:
1. **No Global Overrides:** No global language override or hardcoded single-language forced state was introduced.
2. **Context Integrity Preserved:** `LanguageContext` continues to source its initial language from `localStorage` (`preferred_language` / `edu-lang`) and syncs bidirectionally with `AuthContext`.
3. **Database Schema Unaltered:** Zero database migrations, schema edits, or column defaults were altered.
4. **No Synthetic Inter-Session Coupling:** User preference state remains strictly tied to the individual authenticated user lifecycle.

---

## 6. Operational Multi-User Verification Status

### Status: `NOT VERIFIED` (Operational Multi-User Live Testing)

**Reasoning:**
- Strict safety boundaries mandate that the agent must not execute database writes, reset passwords, create synthetic user accounts, or sign into live accounts without explicit owner authorization.
- While source code analysis, unit tests, and PostgreSQL schema inspections confirm that the isolation architecture is correct, a live sequential two-account switch test (Account A signs in with `en` -> logs out -> Account B signs in with `ar` -> verifies zero cross-contamination) requires live authentication credentials and session manipulation.
- Therefore, operational multi-user live isolation status remains declared **`NOT VERIFIED`** pending owner authorization for controlled live multi-user acceptance testing.

---

## 7. Account Isolation Status Scorecard

| Isolation Requirement | Evaluation Level | Status | Evidence / Verification Method |
| :--- | :---: | :---: | :--- |
| **PostgreSQL User Schema Persistence** | Database | **PASS** | Verified columns `language` and `theme` in `User` table. |
| **Database Preference Independence** | Database | **PASS** | Verified existing records have distinct stored languages (`ar`, `en`). |
| **Login Preference Hydration** | Source Code / Unit Test | **PASS** | `AuthContext.test.tsx` passes; `applyUserPreferences` sets DOM & storage. |
| **Logout Anti-Leakage Purge** | Source Code / Unit Test | **PASS** | `AuthContext.test.tsx` passes; all 7 storage keys purged on logout. |
| **In-Session Dynamic Sync** | Source Code / Unit Test | **PASS** | `AccountSettingsPage.test.tsx` passes; `app:preference-sync` emitted. |
| **Non-Interference with Isolation** | Source Code Inspection | **PASS** | Zero global overrides introduced during localization remediation. |
| **Live Concurrent Multi-User Execution** | Operational Runtime | **NOT VERIFIED** | Deferred per workspace safety guidelines prohibiting account tampering. |

