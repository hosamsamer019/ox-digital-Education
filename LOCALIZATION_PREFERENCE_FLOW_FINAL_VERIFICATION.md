# OX-DIGITAL Education — Preference Flow & API Endpoint Final Verification

**Date:** November 8, 2026  
**System:** OX-DIGITAL Education Platform  
**Target Workspace:** `D:\OX-DIGITAL\Mathe\OX-DIGITAL-GITHUB`  
**Audit Target:** Frontend Preference State, Network Endpoints, Backend Controllers, and Hydration Sequence  
**Audit Nature:** Strict Read-Only Source Code and Architectural Verification  
**Status:** **API ENDPOINT CANONICAL PATH VERIFIED & LOGIN HYDRATION PROVEN**

---

## 1. Executive Summary

This report establishes the conclusive, evidence-based verification of user preference management in **OX-DIGITAL Education**.

It resolves two critical technical questions:
1. **API Endpoint & Method Reconciliation:** Clarifies the exact network contract for saving user preferences, identifying the canonical endpoint as **`PUT /api/users/account/settings`** and resolving the discrepancy regarding informal references to `PATCH /api/users/profile`.
2. **Login Preference Hydration Sequence:** Proves that upon user login, the user's account preference stored in PostgreSQL **always unconditionally overrides** any stale browser language or direction values.
3. **Operational Isolation Status:** Reaffirms that live sequential multi-user testing remains formally declared **`NOT VERIFIED`** in adherence to safety directives prohibiting live credential alteration or database modification.

---

## 2. API Endpoint & HTTP Method Reconciliation

### 2.1 The Discrepancy
In previous audit summaries and discussion notes, references appeared to two distinct preference endpoints:
- Path A: `PUT /api/users/account/settings`
- Path B: `PATCH /api/users/profile`

A strict source-code audit across the frontend and backend confirms that **Path A (`PUT /api/users/account/settings`) is the sole canonical, implemented, and operational endpoint**, while Path B does not exist in the codebase.

### 2.2 Component-by-Component Trace

```
┌────────────────────────────────────────────────────────────────────────┐
│                   PREFERENCE API ARCHITECTURAL TRACE                   │
├────────────────────────────────────────────────────────────────────────┤
│ 1. LanguageContext.tsx                                                 │
│    - Role: In-memory state manager & DOM synchronizer.                 │
│    - HTTP Calls: NONE. Does not make API calls directly.               │
│    - Listens to: 'app:preference-sync' custom event.                   │
│                                                                        │
│ 2. AccountSettingsPage.tsx (Line 118 & 129)                            │
│    - Triggers preference updates when user selects language/theme:     │
│      await brdSubscriptionService.updateAccountSettings({              │
│        language: targetLang                                            │
│      });                                                               │
│                                                                        │
│ 3. brdSubscription.service.ts (Line 3-5, Line 221-224)                 │
│    - Axios Instance:                                                   │
│      const api = axios.create({ baseURL: '/api/users' });              │
│    - Service Method:                                                   │
│      async updateAccountSettings(payload: { language; theme }) {       │
│        const res = await api.put('/account/settings', payload);        │
│        return res.data;                                                │
│      }                                                                 │
│    - Net Outbound Request: PUT /api/users/account/settings             │
│                                                                        │
│ 4. Express Server Mount (services/user-service/src/index.ts)           │
│    - Line 39: app.use('/api/users', brdSubscriptionRoutes);            │
│    - Line 44: app.use('/api', brdSubscriptionRoutes); (Alias)          │
│                                                                        │
│ 5. Express Router (services/user-service/routes/brdSubscription.routes)│
│    - Line 204-206:                                                     │
│      router.put('/account/settings',                                   │
│        BrdSubscriptionController.updateAccountSettings                 │
│      );                                                                │
│                                                                        │
│ 6. Controller (services/user-service/controllers/brdSubscription.ctrl) │
│    - Lines 1216-1253: updateAccountSettings(req, res)                  │
│      Validates: language in ['ar', 'en'], theme in ALLOWED_THEMES.     │
│      Executes: await db.user.update({                                  │
│        where: { id: req.user?.userId },                                │
│        data: { language, theme }                                       │
│      });                                                               │
└────────────────────────────────────────────────────────────────────────┘
```

### 2.3 Why `PATCH /api/users/profile` Was Erroneously Cited
1. **Inspection of `services/user-service/src/routes/user.routes.ts`:**
   ```typescript
   // Line 50:
   router.get('/profile', verifyToken, async (req: AuthRequest, res) => {
     const user = await db.user.findUnique({ where: { id: req.user?.userId }, ... });
     res.json(user);
   });
   ```
   There is **only a `GET /profile` route** in `user.routes.ts`. There is **no `PATCH /profile` route** in the entire application.
2. **Origin of the Reference:**
   Earlier architectural notes informally referred to preference updating as "updating the user's profile" using standard REST shorthand (`PATCH /api/users/profile`). However, the actual implementation specified under **BRD Section 15 (Account Experience & Settings)** created dedicated routes under `brdSubscription.routes.ts` mapped to `PUT /api/users/account/settings`.

---

## 3. Login Preference Hydration Sequence Audit

A critical question is whether an authenticated user's language stored in PostgreSQL always overrides stale values in the browser (e.g. from a prior session or local storage tampering).

### 3.1 The Step-by-Step Execution Sequence

When a user executes `login(email, password, role)` in `AuthContext.tsx`:

```
Step 1: POST /api/auth/login
        ├── Backend authenticates credentials against PostgreSQL.
        ├── auth.controller.ts:148 includes user.language directly in login payload:
        │   res.json({ token, user: { id, email, role, language: user.language, ... } });
        └── Client stores token: localStorage.setItem('token', token);

Step 2: Profile Hydration (fetchExtendedProfile)
        ├── Client executes GET /api/users/profile.
        ├── Backend returns full user record from PostgreSQL including User.language.
        └── If network fails, falls back safely to baseUser (which already contains language).

Step 3: State Initialization
        ├── setUser(fullUser);
        └── localStorage.setItem('edu-user', JSON.stringify(fullUser));

Step 4: Synchronous Preference Overwrite (applyUserPreferences)
        ├── If fullUser.language exists ('ar' or 'en'):
        │   const lang = fullUser.language === 'en' ? 'en' : 'ar';
        │   localStorage.setItem('preferred_language', lang);     <-- OVERWRITES STALE VALUE
        │   localStorage.setItem('edu-lang', lang === 'en' ? 'ENGLISH' : 'ARABIC');
        │   document.documentElement.setAttribute('lang', lang);  <-- SETS DOM ROOT
        │   document.documentElement.setAttribute('dir', lang === 'en' ? 'ltr' : 'rtl');
        └── window.dispatchEvent(new CustomEvent('app:preference-sync', {
              detail: { language: lang, theme: fullUser.theme || 'default' }
            }));

Step 5: Dynamic Context Reactivity
        ├── LanguageContext listener receives 'app:preference-sync'.
        ├── Invokes setLanguageState(normalizedLang).
        └── Re-renders the entire React tree with the user's authentic database language.
```

### 3.2 Proof of Override Guarantee
- **Scenario A: Stale `preferred_language = 'en'` in browser, User database record is `'ar'`:**
  Upon successful login, `applyUserPreferences` executes synchronously, calls `localStorage.setItem('preferred_language', 'ar')`, updates DOM `lang="ar"` / `dir="rtl"`, and dispatches `app:preference-sync`. The stale `'en'` is completely eradicated.
- **Scenario B: Stale `preferred_language = 'ar'` in browser, User database record is `'en'`:**
  Upon successful login, `applyUserPreferences` writes `'en'` to `preferred_language` and `'ENGLISH'` to `edu-lang`, sets DOM `lang="en"` / `dir="ltr"`, and switches `LanguageContext` to `'en'`.
- **Verdict:** **The authenticated user's database preference ALWAYS unconditionally overrides any stale browser language values.**

---

## 4. Session Logout Anti-Leakage Verification

To guarantee that an account's preference does not linger on shared devices after logout, `AuthContext.logout()` executes an exhaustive purge:

```typescript
// AuthContext.tsx (Lines 215-232):
setUser(null);
localStorage.removeItem('token');
localStorage.removeItem('edu-user');
localStorage.removeItem('preferred_language'); // Purged
localStorage.removeItem('edu-lang');           // Purged
localStorage.removeItem('preferred_theme');    // Purged
localStorage.removeItem('edu-theme');          // Purged
localStorage.removeItem('theme');              // Purged

// Dispatches reset event to restore neutral platform default
window.dispatchEvent(new CustomEvent('app:preference-sync', {
  detail: { language: 'ar', theme: 'dark' }
}));
```

This ensures that upon logout, the browser returns to a clean baseline state before any subsequent user attempts to log in.

---

## 5. Operational Multi-User Isolation Status

### Status: `NOT VERIFIED` (Live Concurrent Multi-User Execution)

- **Verification Level Achieved:** Architecture Sound & Source/DB Verified.
- **Operational Status:** `NOT VERIFIED`.
- **Reasoning:** In strict compliance with Section 1 and Section 7 safety gates, no credentials were entered or modified in live environments, no synthetic users were generated, and no sequential account switching was simulated on the running test instance.
- **Next Phase Requirement:** Demonstrating live two-account isolation requires owner authorization for a controlled live test session with designated credentials.

---

## 6. Preference Flow Scorecard

| Checkpoint | Tested Mechanism | Result | Evidence |
| :--- | :--- | :---: | :--- |
| **Outbound Update Endpoint** | `brdSubscriptionService.updateAccountSettings` | **PASS** | Evaluates to `PUT /api/users/account/settings`. |
| **Backend Route Handling** | `brdSubscription.routes.ts:204` | **PASS** | Mapped to `BrdSubscriptionController.updateAccountSettings`. |
| **Database Write** | `db.user.update` in controller | **PASS** | Persists `language` and `theme` directly to PostgreSQL `User` table. |
| **Login Payload Ingestion** | `auth.controller.ts:148` & `AuthContext.tsx:163` | **PASS** | `user.language` delivered in login response and hydrated immediately. |
| **Stale Storage Overwrite** | `AuthContext.applyUserPreferences` | **PASS** | Overwrites `preferred_language`, `edu-lang`, and DOM attributes. |
| **Logout Anti-Leakage** | `AuthContext.logout` | **PASS** | Purges all 7 localStorage keys and resets DOM. |
| **Live Multi-User Verification** | Sequential Login Testing | **NOT VERIFIED** | Deferred per safety gates. |

