# OX-DIGITAL Education — Per-Account Language Persistence & Isolation Report

**Workspace:** `D:\OX-DIGITAL\Mathe\OX-DIGITAL-GITHUB`  
**Date:** 2026-11-08  
**Mission:** Comprehensive Audit of Per-Account Language Preference Persistence, Hydration, and Inter-Account Isolation  
**Target Database:** `ox_digital_dev_test` on `127.0.0.1:5433` (PostgreSQL 15 via container `ox-digital-isolated-dev-postgres`)  
**Target Runtime:** `http://127.0.0.1:8080` (Active frontend image: `bf364a707932`)  
**Audit Methodology:** Source-Code Analysis, PostgreSQL Schema/Data Inspection, and Interactive Browser Session Monitoring  
**Isolation Verdict:** **ARCHITECTURE SOUND & VERIFIED AT SOURCE/DB / LIVE MULTI-USER SIGN-IN `NOT VERIFIED`**

---

## 1. Executive Summary

This report evaluates whether user language preferences in **OX-DIGITAL Education** are persistently tied to individual user accounts in the database and isolated from leaking across different user sessions on shared devices.

### Summary Scorecard

| Verification Area | Result | Evidence & Technical Mechanism |
| :--- | :---: | :--- |
| **PostgreSQL Persistence Schema** | **PASS** | Table `"User"` defines dedicated `language` column (`text`, `DEFAULT 'ar'`) and `theme` column (`text`, `DEFAULT 'default'`). |
| **Database State Inspection** | **PASS** | Read-only inspection of 7 existing accounts confirmed independent stored preferences (1 `en`, 6 `ar`; 1 `dark`, 6 `default`). |
| **Login Preference Hydration** | **PASS** | `AuthContext.applyUserPreferences(fullUser)` reads the user's database record upon login and synchronizes `localStorage` and `document.documentElement`. |
| **Session Logout Purge & Anti-Leakage** | **PASS** | `AuthContext.logout()` unconditionally purges `token`, `edu-user`, `preferred_language`, `edu-lang`, `preferred_theme`, `edu-theme`, and `theme`. |
| **Dynamic In-Memory Preference Sync** | **PASS** | `app:preference-sync` custom event updates React state and DOM attributes dynamically without requiring browser refreshes. |
| **Live Sequential Two-Account Sign-In** | **NOT VERIFIED** | An interactive Chrome session was opened at `http://127.0.0.1:8080/login`, but per Section 5/10 safety rules, no credentials were entered or modified. |

---

## 2. PostgreSQL Preference Persistence & Schema Audit

A read-only SQL inspection was conducted on the development database `ox_digital_dev_test` via container `ox-digital-isolated-dev-postgres`:

### 2.1 Table `"User"` Schema Definition
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

### 2.2 Distribution of Existing User Preferences
A read-only aggregation query on existing database records yielded:

```
 count | language |  theme  
-------+----------+---------
     1 | ar       | dark
     5 | ar       | default
     1 | en       | default
(3 rows)
```

**Observations:**
1. The database holds 7 pre-existing accounts spanning multiple roles (`ADMIN`, `TEACHER`, `ACCOUNTANT`, `CENTER_STUDENT`, `ONLINE_STUDENT`, `PARENT`).
2. At least one existing account is configured with `language = 'en'` in PostgreSQL, while the majority are set to `'ar'`.
3. At least one existing account is configured with `theme = 'dark'`, while others use `'default'`.
4. Language and theme preferences are stored on the PostgreSQL record itself, establishing that preferences are first-class, database-backed account properties.

---

## 3. Client-Side Lifecycle & Session Isolation Architecture

Inspection of `apps/frontend/src/app/contexts/AuthContext.tsx` and `LanguageContext.tsx` reveals the exact end-to-end lifecycle of account preferences:

```
┌────────────────────────────────────────────────────────────────────────┐
│                        USER LOGIN LIFECYCLE                            │
└────────────────────────────────────────────────────────────────────────┘
                                 │
                     1. POST /api/auth/login
                                 ▼
                   Receives JWT & User Record
                                 │
             2. GET /api/users/profile (Extended Profile)
                                 ▼
                     Loads fullUser from Database
                                 │
                   3. applyUserPreferences(fullUser)
        ┌────────────────────────┼────────────────────────┐
        ▼                        ▼                        ▼
localStorage.setItem     document.documentElement   dispatchEvent
- preferred_language     - lang = user.language     - app:preference-sync
- edu-lang               - dir = rtl / ltr
- preferred_theme        - data-theme = user.theme
- edu-user
```

### 3.1 Login Hydration (`AuthContext.tsx:114–146`)
```typescript
const applyUserPreferences = (userObj: any) => {
  if (!userObj) return;

  // Language synchronization from database record
  if (userObj.language) {
    const lang = userObj.language === 'en' ? 'en' : 'ar';
    localStorage.setItem('preferred_language', lang);
    localStorage.setItem('edu-lang', lang === 'en' ? 'ENGLISH' : 'ARABIC');
    document.documentElement.setAttribute('lang', lang);
    document.documentElement.setAttribute('dir', lang === 'en' ? 'ltr' : 'rtl');
  }

  // Theme synchronization from database record
  if (userObj.theme) {
    localStorage.setItem('preferred_theme', userObj.theme);
    localStorage.setItem('edu-theme', userObj.theme);
    document.documentElement.setAttribute('data-theme', userObj.theme);
    if (['dark', 'blue', 'green', 'purple', 'warm-orange'].includes(userObj.theme)) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('app:preference-sync', {
      detail: {
        language: userObj.language === 'en' ? 'en' : 'ar',
        theme: userObj.theme || 'default'
      }
    }));
  }
};
```

### 3.2 Logout Isolation & Anti-Leakage (`AuthContext.tsx:209–235`)
When a user logs out, `logout()` explicitly cleans up the browser environment:

```typescript
const logout = async () => {
  try {
    await authApi.post('/logout');
  } catch (error) {
    console.error('Logout API failed:', error);
  } finally {
    setUser(null);
    localStorage.removeItem('token');
    localStorage.removeItem('edu-user');
    
    // Clear preferences on logout to prevent leakage between users on shared devices
    localStorage.removeItem('preferred_language');
    localStorage.removeItem('edu-lang');
    localStorage.removeItem('preferred_theme');
    localStorage.removeItem('edu-theme');
    localStorage.removeItem('theme');

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('app:preference-sync', {
        detail: {
          language: 'ar',
          theme: 'dark'
        }
      }));
    }
  }
};
```

**Anti-Leakage Guarantees:**
1. A user who logged in with English (`en`) will have their tokens, user payload, and `preferred_language` keys completely deleted upon logout.
2. The next user who signs in on the same browser will not inherit the previous user's English preference from `localStorage`.
3. Upon subsequent login, `applyUserPreferences()` always re-hydrates preferences fresh from the newly authenticated user's database row.

---

## 4. Live Browser Isolation Verification & Testing Execution

### 4.1 Interactive Browser Session
To perform live verification with existing accounts:
1. An interactive Google Chrome window (`Chrome/157.0.8103.38`) was launched with remote debugging enabled on port `9222`:
   ```powershell
   & "C:\Program Files\Google\Chrome\Application\chrome.exe" `
     --remote-debugging-port=9222 `
     --remote-allow-origins=* `
     --user-data-dir="C:\Users\Hossam\.gemini\antigravity\brain\66dd16e7-da62-4347-b377-62b3991fb234\scratch\interactive_chrome_profile" `
     http://127.0.0.1:8080/login
   ```
2. A background CDP monitoring agent (`scratch/monitor_and_audit.cjs`) actively polled the browser target every 2 seconds for authentication state changes (`localStorage.getItem('token')` and `localStorage.getItem('edu-user')`).
3. The browser window rendered the unified login screen at `http://127.0.0.1:8080/login`.

### 4.2 Sequential Sign-In Status: `NOT VERIFIED`
Per Section 5 and Section 10 of the audit instructions:
- "Never ask the owner to paste passwords or tokens into Antigravity logs, source files, or reports."
- "Do not reset passwords or bypass authentication."
- "To declare account isolation PASS, demonstrate actual sequential use of two existing accounts with distinct saved language preferences. If this cannot be completed safely, report: `NOT VERIFIED — Actual two-account isolation could not be demonstrated.`"

Because no test credentials were submitted during the monitoring window, live sequential sign-in across Account A (Arabic) and Account B (English) could not be executed without violating the non-mutating safety gates.

Therefore, the live multi-user sequential verification is formally declared:

> **`NOT VERIFIED — Actual two-account isolation could not be demonstrated.`**

---

## 5. Potential Preference Vulnerability Points

While the core architecture is sound, the audit identified three potential areas where preference desynchronization could occur:

1. **Storage Disconnect in Unauthenticated State:**
   In `LanguageContext.tsx:24–38`, when no user is logged in, the initial state reads `localStorage.getItem('preferred_language')`. If a public user toggles language on the landing page, `preferred_language` is updated in `localStorage`. If an existing user logs in whose profile fetch fails (e.g., due to a temporary network blip), the public `localStorage` setting could persist instead of the user's database setting.
2. **Missing In-App Language Toggle in Role Headers:**
   Certain role dashboards (e.g. `AccountantDashboard` and `StudentCenterDashboard`) omit a visible language toggle button in their top header bar, forcing users to navigate to `AccountSettingsPage` to change language.
3. **Optimistic LocalStorage Updates:**
   In `AccountSettingsPage.tsx`, changing language updates `localStorage` immediately before the `PUT /api/users/account/settings` request completes. If the backend API call fails, the client and database preferences become desynchronized.

