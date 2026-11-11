# OX-DIGITAL Education — Final Language & Account Isolation Verification Report

**Audit Date:** November 8, 2026  
**Audited Directory:** `D:\OX-DIGITAL\Mathe\OX-DIGITAL-GITHUB`  
**Database Audited:** `ox-digital-isolated-dev-postgres` (`127.0.0.1:5433`, db `ox_digital_dev_test`)  
**Audit Character:** Strictly Read-Only Forensic Source & Data Verification  

---

## 1. Executive Summary & Core Contradiction Resolution

A primary purpose of this audit is to resolve the direct contradiction in previous documentation:
- The **Localization Audit** claimed complete, verified per-account language isolation.
- The **Comprehensive Acceptance Report** marked real multi-user concurrent session testing as **NOT VERIFIED**.

### Forensic Resolution:
1. **Source-Level Architecture is Database-Backed:** The platform architecture genuinely includes database persistence for language preferences (`User.language` column in PostgreSQL) and provides an authenticated API endpoint (`PUT /api/users/account/settings`) strictly scoped to the session's authenticated user ID (`req.user.userId`).
2. **Current Database State:** Direct read-only database query (`SELECT id, email, role, language, theme FROM "User";`) confirms that all 7 active user accounts in the isolated development database have non-null language records (`hosam@gmail.com`: `en`, `center@gmail.com`: `en`, `admin@edu.com`: `ar`, `teacher@gmail.com`: `ar`, `acount@gmail.com`: `ar`, `acount1@gmail.com`: `ar`, `samer@gmail.com`: `ar`).
3. **Browser Storage Contamination Vector Discovered:** In `LanguageContext.tsx` and `AuthContext.tsx`, `localStorage` keys (`preferred_language`, `edu-lang`, `edu-user`) act as an immediate client-side cache. If a user does not explicitly click "Logout" (which clears these keys), or if an account in the database has a `null` language property, logging into another account in the same browser session or opening an unauthenticated tab will inherit the previous user's cached `preferred_language`.
4. **English Fallback Mechanism Leaks Arabic:** In `LanguageContext.tsx` (lines 88–107), if an English translation key is missing from both `translations.en` and `UI_TRANSLATIONS_EN` and no explicit fallback argument was supplied to `t(key)`, the function automatically falls back to `translations.ar[key]`, which returns the Arabic string even when the interface is set to English.
5. **Final Isolation Status:** Multi-account concurrent and sequential isolation is **SOURCE VERIFIED** at the API and database levels, and **AUTOMATED TEST VERIFIED** at the unit mock level, but **REMAINS NOT VERIFIED IN REAL LIVE BROWSER SESSIONS** because no disposable, non-production test accounts were authorized for live browser mutation.

---

## 2. Detailed Verification Item Breakdown & Evidence Classification

| Verification Item | Implementation Reality | Evidence Classification | Exact Location & Notes |
| :--- | :--- | :--- | :--- |
| **1. Storage Mechanism** | Stored in PostgreSQL (`User.language`), synchronized to React Context state and mirrored in `localStorage` (`preferred_language`, `edu-lang`, `edu-user`). | **SOURCE VERIFIED** & **DATABASE VERIFIED** | `packages/database/prisma/schema.prisma:194`, `LanguageContext.tsx:49-59`. |
| **2. Database Persistence** | `PUT /api/users/account/settings` accepts `{ language: 'ar' \| 'en' }` and executes `db.user.update({ where: { id: req.user.userId }, data: { language } })`. | **SOURCE VERIFIED** | `services/user-service/src/controllers/brdSubscription.controller.ts:1221-1249`. |
| **3. Update Scoping** | Enforces `where: { id: req.user?.userId }`. The authenticated user ID originates exclusively from the verified token payload. | **SOURCE VERIFIED** | `brdSubscription.controller.ts:1236`. |
| **4. Login / Profile Restoration** | On login, `AuthContext.login` calls `fetchExtendedProfile`, retrieving `/api/users/profile`, then invokes `applyUserPreferences(fullUser)`. | **SOURCE VERIFIED** | `AuthContext.tsx:130-145`, `user.routes.ts:39-54`. |
| **5. LocalStorage Override Risk** | If user B has `language: null`, `applyUserPreferences` skips updating the language, allowing user A's leftover `preferred_language` to control the UI. | **SOURCE VERIFIED** (Defect/Risk Identified) | `AuthContext.tsx:130` (`if (userObj.language)` skips when null). |
| **6. Stale Language on Logout / Switch** | `AuthContext.logout()` explicitly clears `preferred_language`, `edu-lang`, and `edu-user` and dispatches `app:preference-sync`. However, hard browser navigation or token expiration without logout preserves localStorage. | **SOURCE VERIFIED** | `AuthContext.tsx:219-233`. |
| **7. Multi-Account Preference Independence** | In PostgreSQL, distinct accounts hold independent values (e.g. `hosam@gmail.com` = `en`, `admin@edu.com` = `ar`). In a shared browser without logout, client-side leakage can occur. | **DATABASE VERIFIED** (DB level) / **NOT VERIFIED** (Live Browser Session) | Dev Postgres query output confirmed independent database records. |
| **8. DOM Attributes (`lang` & `dir`)** | `applyLanguageToDOM` updates both `document.documentElement.lang` (`ar` or `en`) and `dir` (`rtl` or `ltr`). | **AUTOMATED TEST VERIFIED** | `LanguageContext.tsx:45-46`, `FinalLocalizationRenderedUI.test.tsx`. |
| **9. English Fallback Leaking Arabic** | When `language === 'en'`, if a string is missing in `UI_TRANSLATIONS_EN` and `translations.en`, `t()` cascades to `translations.ar[key]`, displaying raw Arabic in English mode. | **SOURCE VERIFIED** (Architectural Risk Identified) | `LanguageContext.tsx:101-106`. |
| **10. Dynamic Messages & Backend Labels** | Dynamic frontend alerts, receipt statuses, and report headers now call `t()`. However, direct backend error strings (Category C) returned from Express controllers remain in English/Arabic according to controller code. | **SOURCE VERIFIED** & **AUTOMATED TEST VERIFIED** | `CollectionDeskPage.tsx`, `AccountantReportsPage.tsx`, `translationsDictionary.ts`. |

---

## 3. Evidence Classification Summary

```
Total Claims Evaluated: 10
├── SOURCE VERIFIED:           6 (Items 1, 2, 3, 4, 6, 9)
├── DATABASE VERIFIED:         2 (Items 1, 7 - DB level)
├── AUTOMATED TEST VERIFIED:   2 (Items 8, 10)
└── NOT VERIFIED:              1 (Item 7 - Live multi-account concurrent browser interaction)
```

---

## 4. Reconciled Verdict on the "100% Localization Acceptance" Claim

- **Supported Elements:**
  - Zero raw Arabic strings remain in key target production JSX layouts (down to 0 unhandled `bg-white` and 0 raw untranslated JSX headers in accountant/manager spaces).
  - All 6 platform role shells (Primary Manager, Teacher, Accountant, Online Student, Center Student, Parent, Admin) support dynamic language switching.
  - The database schema and user-service controllers accurately persist per-account language choices to PostgreSQL.
- **Unsupported / Overstated Elements:**
  - The claim that multi-user account isolation is 100% verified across live browser sessions is **unsupported** by runtime proof. No multi-browser interactive trace exists demonstrating User A logging in as English, User B concurrently logging in as Arabic on the same machine, and neither experiencing cache contamination.
  - The claim of zero possibility of Arabic text appearing in English mode is **unsupported** because the cascade in `LanguageContext.tsx` explicitly falls back to `translations.ar` whenever an English translation key is missing.

