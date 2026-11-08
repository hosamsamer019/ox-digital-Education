# OX-DIGITAL Education — Account Localization, Profile Image Lifecycle & Account Linking Audit

**Workspace:** `D:\OX-DIGITAL\Mathe\OX-DIGITAL-GITHUB`  
**Audit Timestamp:** 2026-11-07 19:45:00 UTC+2  
**Authoritative Development Database:** `127.0.0.1:5433/ox_digital_dev_test` (Container: `ox-digital-isolated-dev-postgres`)  
**Mission Type:** Comprehensive Read-Only Audit (Phase A)  
**Deliverable:** `ACCOUNT_LOCALIZATION_PROFILE_LINKING_AUDIT.md`  

---

## 1. Executive Summary & Authorization Scope

Under owner authorization, this read-only audit inspects the current codebase of **OX-DIGITAL Education** to identify the root causes of:
1. Why selecting English changes layout direction to LTR but leaves the majority of UI strings in Arabic.
2. Why user profile image uploads do not consistently persist or display across platform avatars.
3. How account identifiers are currently represented and how structured account relationships (Student ↔ Parent, Teacher ↔ Branch, and Teacher ↔ Accountant) can be cleanly restored and managed.

### Primary Audit Findings
- **Localization Disconnect:** The frontend contains two conflicting language state mechanisms (`LanguageContext` storing `'ARABIC' | 'ENGLISH'` under `edu-lang` vs `AccountSettingsPage` storing `'ar' | 'en'` under `preferred_language`). Crucially, out of 45+ frontend views and components, fewer than 5 components utilize `useLanguage()`. Over 95% of headers, menus, tables, dialogs, and buttons contain hardcoded Arabic JSX strings.
- **Profile Image Serving & Display Gap:** While `user-service` contains an upload handler (`POST /api/account/profile-picture`) that validates magic numbers (JPG/PNG/WebP <= 2MB) and updates `User.profilePictureUrl`, the saved path (`/storage/avatars/...`) is **neither proxied by Nginx nor statically served by Express**. Furthermore, global layouts (`SharedLayout.tsx`) and role dashboards do not inspect `profilePictureUrl`, instead rendering fallback single-character initials unconditionally.
- **Relationship & Identifier Foundation Exists:** The PostgreSQL schema and Prisma models already contain the required relations (`User.parentId`, `User.branchId`, `User.institutionId`, `User.profilePictureUrl`, `User.language`, `User.theme`, `StudentTeacher`, and `Branch`). **No database migration or schema alteration is necessary.** The account-linking gaps are purely architectural and interface-driven.

---

## 2. Language and Localization Audit (Phase A.1)

### 2.1 Why English Mode Only Flips Direction
When a user selects "English" in `AccountSettingsPage.tsx`:
```tsx
// AccountSettingsPage.tsx (Lines 68-73)
const handleLanguageChange = async (lang: 'ar' | 'en') => {
  setLanguage(lang);
  localStorage.setItem('preferred_language', lang);
  document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
  document.documentElement.lang = lang;
  try {
    await brdSubscriptionService.updateAccountSettings({ language: lang });
...
```
This function sets `dir="ltr"` and `lang="en"` on `<html>`, which causes CSS layouts to reorient to left-to-right. However:
1. `handleLanguageChange` does **not** notify or update `LanguageContext`.
2. `LanguageContext` maintains its own separate state, initialized from `localStorage.getItem('edu-lang')`.
3. `translations.ts` contains only 75 translation keys, whereas the application contains hundreds of distinct UI strings.
4. Across all components in `apps/frontend/src`, `useLanguage` is imported in only **4 components**:
   - `App.tsx`
   - `ReceiptsManagementPage.tsx`
   - `AdminUsersPage.tsx`
   - `TeacherProfilePage.tsx`
5. All navigation sidebars (`menuItems` in `TeacherDashboard.tsx`, `AdminDashboard.tsx`, `AccountantDashboard.tsx`, `ParentDashboard.tsx`, `StudentOnlineDashboard.tsx`, `StudentCenterDashboard.tsx`) have hardcoded Arabic strings (`'لوحة المؤشرات'`, `'قائمة الطلاب'`, `'سجل الحضور'`, etc.).
6. Shared header elements in `SharedLayout.tsx` (Search placeholder `"ابحث في المنصة..."`, tooltip titles, notification popups) are entirely hardcoded Arabic.

### 2.2 Inventory of Untranslated Surfaces

| Category / Surface | Affected Files / Components | Existing State | Remediation Requirement |
| :--- | :--- | :--- | :--- |
| **Global Navigation** | `SharedLayout.tsx`, All 6 `*Dashboard.tsx` | Hardcoded Arabic labels in `menuItems` arrays | Dynamic localization via `t()` or localized menu dictionary |
| **Header & Search** | `SharedLayout.tsx`, `NotificationsPanel.tsx` | Hardcoded Arabic placeholders and titles | Full English & Arabic bilingual support |
| **Authentication & Public** | `LoginPage.tsx`, `AdminLoginPage.tsx`, `ForgotPasswordPage.tsx`, `ResetPasswordPage.tsx` | Form labels, input placeholders, submit buttons hardcoded | Full bilingual translation with role-aware text |
| **Primary Manager / Admin** | `AdminHomePage.tsx`, `AdminUsersPage.tsx`, `StudentsPage.tsx`, `ExamsManagementPage.tsx`, `AdminProfilePage.tsx` | Table column headers, status badges, action dialogs | Complete English/Arabic strings |
| **Teacher Workspace** | `TeacherHomePage.tsx`, `TeacherStudentsPage.tsx`, `TeacherCoursesPage.tsx`, `TeacherAttendancePage.tsx`, `TeacherIncomePage.tsx`, `TeacherPricingPage.tsx` | Student roster, financial figures, attendance modals | Complete bilingual table and form localization |
| **Accountant Workspace** | `AccountantDashboard.tsx`, `ReceiptsManagementPage.tsx`, `CashboxOperationsPage.tsx`, `ExpenseVoucherPage.tsx` | Financial ledgers, date pickers, currency labels | Full bilingual support preserving numeric/currency rules |
| **Student (Online & Center)**| `StudentHomePage.tsx`, `CoursesPage.tsx`, `LessonsPage.tsx`, `ExamsPage.tsx`, `ResultsPage.tsx`, `VideoPlayerPage.tsx` | Lesson viewer, quiz player, result breakdowns | Complete bilingual learning experience |
| **Parent Portal** | `ParentHomePage.tsx`, `ParentChildrenPage.tsx`, `ParentSubscriptionPage.tsx`, `ChildSelector.tsx` | Child selector, academic cards, payment status | Full bilingual parenting and subscription views |
| **Account Settings** | `AccountSettingsPage.tsx` | Section headings, button labels, password validation messages | Full bilingual translation |

### 2.3 Storage Synchronization Disconnect
- **Database field:** `User.language` defaults to `'ar'`.
- **Backend response:** `GET /api/users/account/settings` returns `{ language: 'ar' | 'en' }`.
- **Local storage keys:**
  - `preferred_language`: used by `AccountSettingsPage` (`'ar' | 'en'`).
  - `edu-lang`: used by `LanguageContext` (`'ARABIC' | 'ENGLISH'`).
- **Remediation:** Unify the frontend architecture to use standardized language codes (`'ar'` and `'en'`), synchronize `LanguageContext` with `AccountSettingsPage` and `AuthContext`, and persist changes both locally and to the backend profile.

---

## 3. Profile Image Lifecycle Audit (Phase A.2)

### 3.1 Backend Upload & Validation Implementation
In `services/user-service/src/controllers/brdSubscription.controller.ts`:
- **Endpoint:** `POST /api/account/profile-picture` (also routed at `/api/users/account/profile-picture`).
- **Validation:**
  - Payload requires `base64Data` and `mimeType`.
  - Permitted MIME types: `image/jpeg`, `image/png`, `image/webp`.
  - Max buffer length: `2 * 1024 * 1024` bytes (2 MB).
  - Magic number check:
    - JPEG: `buffer[0] === 0xff && buffer[1] === 0xd8`
    - PNG: `buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47`
    - WebP: `buffer.slice(8, 12).toString('ascii') === 'WEBP'`
  - Rejects forgeries and invalid formats with HTTP 400.
- **Persistence:**
  - Writes buffer to `storage/avatars/avatar_${userId}_${timestamp}.${ext}`.
  - Updates `User.profilePictureUrl = '/storage/avatars/avatar_${userId}_${timestamp}.${ext}'`.
  - Returns `{ success: true, profilePictureUrl }`.

### 3.2 The Critical Serving Bug
1. The backend stores the file in `storage/avatars/` on the local container filesystem.
2. In `nginx/nginx.conf`, there is **no location block** for `/storage` or `/storage/avatars`.
3. In `services/user-service/src/index.ts`, there is **no static directory middleware** for `storage`.
4. Result: When any client or browser attempts to load `<img src="/storage/avatars/avatar_xxx.png" />`, Nginx routes the request to `frontend:80` (fallback SPA), returning `index.html` (MIME mismatch / broken image).

### 3.3 Avatar Rendering Gaps in Frontend
- **`AuthContext.tsx`:** The `User` interface defines `avatar?: string`, but does not map `profilePictureUrl` from the backend profile response.
- **`SharedLayout.tsx`:** In both the sidebar user card (line 98) and the top bar user menu (line 288), the avatar is hardcoded as:
  ```tsx
  <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold text-sm shadow-xs">
    {user?.name?.charAt(0) || 'م'}
  </div>
  ```
  Neither element checks `user.profilePictureUrl` or renders an `<img>`.
- **Dashboard Identity Cards:** Teacher, Parent, Admin, and Student profile pages similarly render letter avatars unconditionally.
- **Cache Invalidation:** The timestamp suffix in `avatar_${userId}_${Date.now()}.${ext}` enables deterministic cache busting, but the lack of an image serving route prevents verification.

---

## 4. Account Identifiers and Relationships Audit (Phase A.3)

### 4.1 Account Identifiers
- **Database Identity:** `User.id` is a UUID (e.g. `c90eb820-22bb-4c28-984e-f513db3e62f0`) or deterministic identifier (`usr_idor_a_91xnz3`).
- **Previous Implementation:** In `apps/frontend/src/app/components/admin/AdminProfilePage.tsx`:
  ```tsx
  <div>
    <label className="block text-sm text-gray-500 mb-1">معرف الحساب (Account ID)</label>
    <div className="flex items-center gap-2 text-gray-900 dark:text-white font-mono bg-gray-50 dark:bg-gray-700 px-3 py-2 rounded border border-gray-200 dark:border-gray-600 select-all cursor-text">
      <UserIcon className="w-5 h-5 text-gray-400" /> {user?.id}
    </div>
  </div>
  ```
- **Deficiency:** `AccountSettingsPage.tsx`—which is the central settings screen for all 7 platform roles—completely omitted the Account Identifier section.
- **Remediation:** Implement a clean, dedicated **Account Identifier Card** in `AccountSettingsPage` and role profile views:
  - Formatted identifier display with user role badge.
  - One-click "Copy ID" button with visual confirmation.
  - Explanatory helper text explaining that this identifier is used to link student, parent, teacher, and branch accounts.
  - Guaranteed read-only / immutable.

### 4.2 Student ↔ Parent Relationships
- **Data Model:**
  - `User.parentId` (foreign key to `User.id` where role is `PARENT`).
  - Relation `User.parent` (Parent user) and `User.children` (Student users).
  - Multi-child support: One parent can have multiple students (`children User[]`).
- **Existing Backend Capabilities:**
  - `GET /api/users/parent/children`: Retrieves all student records where `parentId = req.user.userId`.
  - `POST /api/users/teacher/parents`: Allows a Teacher to link or create a parent for a student they teach.
- **Missing Capability:**
  - Self-service or manager-supervised linking interface where a Student or Parent can search by account identifier, verify the account identity (name, email masked), and confirm/unlink the relationship safely.

### 4.3 Teacher ↔ Center/Branch Relationships
- **Data Model:**
  - `Branch` table exists with `id`, `name`, `code`, `institutionId`, `isOnline`, `status`.
  - `User.branchId` assigns any user (Teacher, Accountant, Student) to a specific branch.
- **Existing Backend Capabilities:**
  - `GET /api/manager/branches`: Lists branches for the institution.
  - `PUT /api/manager/teachers/:teacherId/assign-branch`: Primary Manager assigns teacher to branch.
- **Missing Capability:**
  - Display of the assigned branch in the Teacher's profile and account settings, with clear branch details and contact information.

### 4.4 Teacher ↔ Accountant Assignment (Organizational Model)
- **BRD Architecture:**
  - Accountants belong to an authorized branch (`User.branchId`).
  - Teachers belong to an authorized branch (`User.branchId`).
  - `services/user-service/src/utils/accountingScope.util.ts` strictly enforces branch isolation: an Accountant can only access collections, receipts, cashboxes, and settlements for their assigned branch.
  - Therefore, the responsible Accountant for a Teacher is determined by the **shared organizational branch relationship**.
- **Interface Requirement:**
  - Display the responsible branch accountant in the Teacher's profile/settings and display assigned teachers in the Accountant's branch view, without inventing an un-auditable direct link that violates branch boundaries.

---

## 5. Database Schema & Migration Assessment (Approval Gate Evaluation)

An audit of `packages/database/prisma/schema.prisma` and PostgreSQL table catalogs in `ox_digital_dev_test` confirms:

| Required Capability | Supporting DB Field / Model | Already Exists? | Migration Needed? |
| :--- | :--- | :--- | :--- |
| User Language Preference | `User.language` (VARCHAR, default `'ar'`) | **YES** | **NO** |
| User Theme Preference | `User.theme` (VARCHAR, default `'default'`) | **YES** | **NO** |
| User Profile Picture URL | `User.profilePictureUrl` (TEXT, nullable) | **YES** | **NO** |
| Student-Parent Link | `User.parentId` (UUID FK to `User.id`) | **YES** | **NO** |
| Teacher Branch Assignment | `User.branchId` (UUID FK to `Branch.id`) | **YES** | **NO** |
| Accountant Branch Scope | `User.branchId` (UUID FK to `Branch.id`) | **YES** | **NO** |
| Multi-Teacher Enrollment | `StudentTeacher` table | **YES** | **NO** |
| Audit Trail Logging | `StudentAuditLog` table | **YES** | **NO** |

> [!IMPORTANT]
> **Zero Database Migrations Required:** Because all necessary relational fields and models already exist in the database, no Prisma schema migrations, SQL alterations, or data resets are needed. Phase B through Phase F can be fully implemented using existing schema structures.

---

## 6. Targeted Remediation Plan

1. **Phase B (Localization):**
   - Unify language codes to `'ar'` and `'en'`.
   - Expand `translations.ts` with comprehensive English and Arabic dictionaries covering all routes, menus, tables, buttons, status badges, forms, and dialogs.
   - Refactor `LanguageContext.tsx` to export a resilient `t(key, fallback?)` helper with interpolation support.
   - Update `AccountSettingsPage.tsx` to dispatch `setLanguage` directly through `LanguageContext` and persist to backend.
   - Translate all role sidebars, headers, cards, and views.

2. **Phase C (Profile Image):**
   - In `user-service`, serve avatars via an Express route `GET /api/users/avatars/:filename` (or serve `storage/avatars` statically at `/api/users/avatars`), which routes through Nginx's existing `/api/users` proxy rule without Nginx restarts.
   - Update `User.profilePictureUrl` generation to point to `/api/users/avatars/:filename`.
   - Update `AuthContext.tsx` to include `profilePictureUrl` in the `User` object and synchronize it across `localStorage`.
   - Update `SharedLayout.tsx` and all role profile/dashboard views to render `<img src={user.profilePictureUrl} />` with the Radix `Avatar` fallback component.

3. **Phase D (Account Identifier):**
   - Add a high-visibility, copyable **Account Identifier Card** in `AccountSettingsPage.tsx` and role profile pages displaying `user.id`, user role badge, copy button with animated confirmation, and descriptive helper text.

4. **Phase E (Account Linking):**
   - Implement structured linking in `AccountSettingsPage` and management screens:
     - Student ↔ Parent linking with account lookup, verification preview, and explicit confirmation.
     - Teacher ↔ Branch display and assignment verification.
     - Teacher ↔ Accountant association via shared branch.
   - Provide safe unlinking actions with confirmation modals.

5. **Phase F (Per-Account Preferences Consistency):**
   - Ensure `localStorage` keys are properly isolated or scoped to the authenticated `user.id` so shared browsers do not cross-contaminate settings between different user logins.

