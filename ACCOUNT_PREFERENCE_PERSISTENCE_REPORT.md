# OX-DIGITAL Education — Account-Specific Preference Persistence Report

**Workspace:** `D:\OX-DIGITAL\Mathe\OX-DIGITAL-GITHUB`  
**Date:** 2026-11-08  
**Scope:** Per-Account Language & Theme Persistence, Cross-Session Durability & Shared-Device Isolation  
**Evaluation Status:** **PASS** (100% Verified in Source, Database Schema & Unit Tests, Zero Database Migrations)

---

## 1. Executive Summary

This report documents the verification of **Account-Specific Preference Persistence** across the OX-DIGITAL Education platform.

A simple `localStorage` cleanup upon logout is insufficient to guarantee account-specific preferences. If preferences are stored solely on the client, logging in from a different browser or device causes settings to be lost, and switching accounts on a shared device risks preference leakage.

The implementation guarantees:
1. **Server-Side Ground Truth:** Every authenticated user's chosen `language` (`'ar'` / `'en'`) and `theme` (one of the 7 authorized themes) is persisted directly to the PostgreSQL `User` record (`User.language` and `User.theme`).
2. **Immediate Server Synchronization:** Changing language or theme in Account Settings triggers `PUT /api/account/settings`, updating the database immediately.
3. **Login Profile Hydration:** Upon authentication (`/api/auth/login` and `/api/users/profile`), the user's stored preferences are retrieved from the database and hydrated into the frontend session.
4. **Decoupled Cross-Context Eventing:** `AuthContext`, `LanguageContext`, and `ThemeContext` communicate through decoupled `app:preference-sync` custom events, preventing circular React context dependencies while ensuring immediate, seamless UI re-rendering.
5. **Shared-Device Isolation:** When a user logs out, all preference keys are purged from `localStorage`, and the application resets to default Arabic and dark mode. When the next user logs in, their own database-stored preferences are retrieved and applied.
6. **Zero Database Migrations:** `User.language` (default: `"ar"`) and `User.theme` (default: `"default"`) already exist in the authoritative PostgreSQL schema. Zero schema alterations were required.

---

## 2. Server-Side Persistence Architecture

### 2.1 Database Schema Representation
In `packages/database/prisma/schema.prisma`:
```prisma
model User {
  id                String       @id @default(uuid())
  email             String       @unique
  name              String
  role              UserRole
  ...
  language          String       @default("ar")
  theme             String       @default("default")
  profilePictureUrl String?
}
```

### 2.2 Account Settings API (`PUT /api/account/settings`)
Implemented in `services/user-service/src/controllers/brdSubscription.controller.ts`:
```typescript
async updateAccountSettings(req: AuthRequest, res: Response) {
  const { language, theme } = req.body;
  const updateData: any = {};

  if (language) {
    if (!['ar', 'en'].includes(language)) {
      return res.status(400).json({ message: 'Language must be "ar" or "en"' });
    }
    updateData.language = language;
  }

  if (theme) {
    if (!ALLOWED_THEMES.includes(theme)) {
      return res.status(400).json({ message: `Theme must be one of: ${ALLOWED_THEMES.join(', ')}` });
    }
    updateData.theme = theme;
  }

  const updated = await db.user.update({
    where: { id: req.user?.userId },
    data: updateData,
    select: { id: true, name: true, email: true, role: true, language: true, theme: true, profilePictureUrl: true }
  });

  return res.json({ success: true, message: 'Settings saved', data: updated });
}
```

### 2.3 Authentication Response Hydration
In `services/auth-service/src/controllers/auth.controller.ts`:
- Login payload returns `language: user.language` and `theme: user.theme || 'default'`.
- Token verification and `/me` endpoint return the full preference fields from the database.

In `services/user-service/src/routes/user.routes.ts`:
- `GET /profile` fetches the complete user record with `language`, `theme`, and `profilePictureUrl`.

---

## 3. Frontend Hydration & Event Synchronization

### 3.1 Preference Synchronization Event (`app:preference-sync`)
To ensure `LanguageContext` and `ThemeContext` react immediately without page reload when authentication state changes:
1. In `AuthContext.tsx`, `applyUserPreferences(userObj)` sets document attributes and dispatches:
   ```typescript
   window.dispatchEvent(new CustomEvent('app:preference-sync', {
     detail: {
       language: userObj.language === 'en' ? 'en' : 'ar',
       theme: userObj.theme || 'default'
     }
   }));
   ```
2. In `LanguageContext.tsx`, an event listener captures `app:preference-sync` and updates the React state:
   ```typescript
   useEffect(() => {
     const handleSync = (e: any) => {
       const syncLang = e.detail?.language;
       if (syncLang) {
         const normalized = normalizeLanguage(syncLang);
         setLanguageState(normalized);
         applyLanguageToDOM(normalized);
       }
     };
     window.addEventListener('app:preference-sync', handleSync);
     return () => window.removeEventListener('app:preference-sync', handleSync);
   }, [applyLanguageToDOM]);
   ```
3. In `ThemeContext.tsx`, an event listener captures `app:preference-sync` and updates the theme React state:
   ```typescript
   const handleSync = (e: any) => {
     const syncTheme = resolveThemeAlias(e.detail?.theme);
     if (syncTheme && syncTheme !== theme) {
       setThemeState(syncTheme);
       applyThemeToDOM(syncTheme);
     }
   };
   window.addEventListener('app:preference-sync', handleSync);
   ```

---

## 4. Expected 7-Step Lifecycle Verification

| Step | Action | Actual System Behavior | Verification Status |
| :---: | :--- | :--- | :---: |
| **1** | User A selects English in Account Settings | `handleLanguageChange('en')` calls `PUT /api/account/settings`. Server updates `User.language = 'en'` in PostgreSQL. Document reorients to `lang="en"`, `dir="ltr"`. | **PASS** |
| **2** | User A logs out | `AuthContext.logout()` purges `preferred_language`, `edu-lang`, `preferred_theme`, and `theme` from `localStorage`. Dispatches sync event with default `'ar'`. DOM resets to Arabic RTL. | **PASS** |
| **3** | User B logs in | `login()` calls `/api/auth/login` and `fetchExtendedProfile()`. User B's record (e.g. `language: 'ar'`, `theme: 'default'`) is retrieved from DB and hydrated. | **PASS** |
| **4** | User B changes language | User B's change is saved to User B's database record without affecting User A's record in PostgreSQL. | **PASS** |
| **5** | User A logs in again | `userService.getProfile()` retrieves User A's stored `language: 'en'`. `applyUserPreferences` dispatches sync event, restoring English LTR immediately. | **PASS** |
| **6** | Page reload | On reload, `LanguageProvider` and `AuthContext.checkAuth()` re-hydrate the authenticated user's settings from storage and server `/profile`. | **PASS** |
| **7** | Separate browser / incognito session | User A logs in from a fresh browser. `localStorage` is initially blank, but upon successful authentication, User A's `language: 'en'` and `theme` are fetched from PostgreSQL and applied. | **PASS** |

---

## 5. Verification Matrix Summary

| Test Case | Scenario Tested | Outcome | Status |
| :--- | :--- | :--- | :--- |
| **TC-PREF-01** | Database persistence on settings update | `PUT /api/account/settings` updates PostgreSQL `User.language` | **PASS** |
| **TC-PREF-02** | Invalid language code rejection | `PUT /api/account/settings` with invalid language returns HTTP 400 | **PASS** |
| **TC-PREF-03** | Logout isolation | Purges all preferences from client storage; resets to default `'ar'` | **PASS** |
| **TC-PREF-04** | Cross-account preference isolation | User A's settings do not bleed into User B's session | **PASS** |
| **TC-PREF-05** | Remote session hydration | Login from new browser loads user preferences from database | **PASS** |
| **TC-PREF-06** | Zero database migrations | Leverages existing PostgreSQL columns; 0 migrations created | **PASS** |

