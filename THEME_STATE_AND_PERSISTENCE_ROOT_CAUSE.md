# OX-DIGITAL Education — Theme State Architecture & Persistence Root Cause Analysis

**Document ID:** `OX-ROOT-CAUSE-PERSIST-20261107-02`  
**Workspace:** `D:\OX-DIGITAL\Mathe\OX-DIGITAL-GITHUB`  
**Target:** State Ownership, Persistence Layer, Backend Preferences & DOM Cascading  
**Remediation Status:** Fully Resolved & Tested  

---

## 1. Complete Theme Lifecycle Trace (User Click to Rendered Surface)

The complete lifecycle of a theme change was traced through every architectural layer:

```
[ User Clicks Palette Button in AccountSettingsPage ]
               │
               ▼
[ handleThemeChange(newTheme) ]
  ├── 1. setTheme(newTheme) in ThemeContext
  │      ├── Updates React state in ThemeProvider
  │      ├── Sets root.setAttribute('data-theme', newTheme)
  │      ├── Toggles root.classList.add/remove('dark') based on DARK_THEMES
  │      ├── Writes to localStorage ('preferred_theme', 'edu-theme', 'edu-user')
  │      └── Dispatches StorageEvent across open browser tabs
  │
  └── 2. brdSubscriptionService.updateAccountSettings({ theme: newTheme })
         ├── Sends PUT /api/account/settings to Backend (user-service)
         ├── Controller validates against ALLOWED_THEMES
         └── Persists theme string to User table in PostgreSQL database
```

---

## 2. Root Cause Technical Breakdown

### Root Cause 1: Backend Rejection of Light Theme (`ALLOWED_THEMES`)
* **Defect Location:** `services/user-service/src/controllers/brdSubscription.controller.ts:10`
* **Defect Code:**
  ```typescript
  export const ALLOWED_THEMES = ['default', 'dark', 'blue', 'green', 'purple', 'warm-orange'];
  ```
* **Failure Mechanism:** The `'light'` theme was completely omitted from the backend's allowed theme list. When a user in Account Settings clicked "Light Minimal", the frontend sent `PUT /api/account/settings` with `{ theme: 'light' }`. The backend rejected it with:
  `400 Bad Request: "Theme must be one of: default, dark, blue, green, purple, warm-orange"`.
* **Remediation:** Added `'light'` to `ALLOWED_THEMES` in `brdSubscription.controller.ts`:
  ```typescript
  export const ALLOWED_THEMES = ['default', 'light', 'dark', 'blue', 'green', 'purple', 'warm-orange'];
  ```

---

### Root Cause 2: Settings Mount Overwrite Race Condition
* **Defect Location:** `apps/frontend/src/app/components/shared/AccountSettingsPage.tsx:47-63`
* **Defect Code:**
  ```typescript
  useEffect(() => {
    brdSubscriptionService.getAccountSettings()
      .then((res) => {
        const userObj = res.data || res.user;
        if (userObj && userObj.theme) {
          setTheme(userObj.theme as Theme); // Blindly overwrote user preference!
        }
      });
  }, [setTheme]);
  ```
* **Failure Mechanism:** Every user in the database has a default value for `theme` (`@default("default")`). If a user selected `'blue'` or `'warm-orange'`, but refreshed the page or navigated back to Settings, this `useEffect` ran immediately on mount, fetched `userObj.theme` from the backend, and overwrote the user's active theme back to whatever was stored on the server!
* **Remediation:** Enhanced `AccountSettingsPage.tsx` so that server preferences never clobber an explicit local preference:
  ```typescript
  const serverTheme = resolveThemeAlias(userObj.theme);
  const localTheme = resolveThemeAlias(
    localStorage.getItem('preferred_theme') || localStorage.getItem('edu-theme')
  );
  if (serverTheme && !localTheme) {
    setTheme(serverTheme);
  }
  ```

---

### Root Cause 3: Theme Field Omitted in Auth & Session Restoration
* **Defect Location:** `services/auth-service/src/controllers/auth.controller.ts:148, 161`
* **Failure Mechanism:** When users logged in or refreshed their session (`/api/auth/me`), `auth.controller.ts` did not include `theme` in the returned `user` payload or in the `select` projection. Consequently, the user's saved appearance preference in the database was never communicated to the frontend session during login.
* **Remediation:**
  1. In `auth.controller.ts:149`, added `theme: user.theme || 'default'` to the login response payload.
  2. In `auth.controller.ts:161`, added `theme: true` to the `select` projection of `getMe`.
  3. In `apps/frontend/src/app/contexts/AuthContext.tsx`, added `theme?: string` to the `User` interface and synchronized `preferred_theme` upon successful authentication.

---

### Root Cause 4: Component Hardcoding Overrode Semantic CSS Tokens
* **Defect Location:** 8+ core role dashboard pages across Manager, Teacher, Accountant, Student, and Admin.
* **Defect Code:**
  ```tsx
  className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800"
  className="bg-slate-50 dark:bg-slate-800/60 text-slate-700 dark:text-slate-300"
  ```
* **Failure Mechanism:** Whenever `.dark` was present on `<html>` (which occurs for Dark, Blue, Green, Purple, and Warm Orange), Tailwind evaluated `dark:bg-slate-900`. The actual custom properties defined by the theme (`--card: #0f1b38` for Blue, `#0b2416` for Green, `#180c2a` for Purple, `#22160a` for Warm Orange) were completely overridden by the hardcoded `bg-slate-900` utility class. The application appeared as a flat charcoal gray rather than showing the selected theme.
* **Remediation:** Replaced hardcoded classes across `PrimaryManagerHomePage.tsx`, `TeamManagementPage.tsx`, `ManagerAccountsPage.tsx`, `AccountantHomePage.tsx`, `TeacherStudentsPage.tsx`, `TeacherCoursesPage.tsx`, `ExamsPage.tsx`, and `AdminUsersPage.tsx` with semantic design tokens:
  - Surface Card: `bg-card border-border text-card-foreground`
  - Secondary/Muted: `bg-muted text-muted-foreground`
  - Primary Text: `text-foreground`
  - Structural Border: `border-border`

---

## 3. Persistence Matrix Across User Scenarios

| User Scenario | Behavior | Persistence Mechanism |
| :--- | :--- | :--- |
| **Unauthenticated Guest Splash** | Defaults to Institutional Dark | `ThemeContext.tsx` default fallback |
| **User Changes Theme in Settings** | Applied instantly to DOM & saved to localStorage | `applyThemeToDOM` + `setThemeState` |
| **User Navigates Between Routes** | Preserved continuously across routes | Single `ThemeProvider` state in `App.tsx` |
| **User Refreshes the Browser** | Restored from `localStorage.preferred_theme` | `useState` initializer in `ThemeContext.tsx` |
| **User Logs In** | Theme from user profile syncs to localStorage | `AuthContext.tsx` login handler |
| **Multi-Tab Sync** | Changes in Tab A instantly apply to Tab B | Window `StorageEvent` listener in `ThemeContext` |

---
**Report Approved by:** Lead Frontend Software Architect  
**Date:** November 7, 2026

