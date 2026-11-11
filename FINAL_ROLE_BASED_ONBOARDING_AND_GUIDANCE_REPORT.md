# OX-DIGITAL Education — Final Role-Based Onboarding & Guidance Report

**Generated Date:** November 9, 2026  
**Target Repository:** `D:\OX-DIGITAL\Mathe\OX-DIGITAL-GITHUB`  
**Components Covered:** `ContextualGuidanceBanner.tsx`, `SharedLayout.tsx`  
**Test Suite:** `apps/frontend/src/app/test/SmartNotificationCounters.test.tsx`  

---

## 1. Overview & Objectives

In accordance with Section 7.6 – 7.8, new users and returning users across the 5 core platform roles (Student, Teacher, Accountant, Manager/Admin, Parent) receive contextual next-steps guidance banners when entering the platform.

### Objectives Achieved:
1. Provide role-specific guidance pointing to real, authentic application routes.
2. Ensure full dismissibility per user and per role, persisted in `localStorage`.
3. Provide bilingual support (Arabic RTL and English LTR).
4. Strictly comply with the platform's 7 color themes by using semantic Tailwind CSS variables.

---

## 2. Role Guidance Configuration & Action Mapping

| Role | Arabic Guidance Title & Action | English Guidance Title & Action | Destination Route |
|:---|:---|:---|:---|
| **STUDENT (Online & Center)** | مرحباً بك في منصتك التعليمية المتكاملة<br>*(استعراض المقررات)* | Welcome to your OX-DIGITAL learning platform<br>*(Explore Courses)* | `/student/online/courses` or `/student/center/courses` |
| **TEACHER** | مرحباً بك في منظومة المعلم الأكاديمية<br>*(إدارة المقررات)* | Welcome to the Teacher Academic Portal<br>*(Manage Courses)* | `/teacher/courses` |
| **ACCOUNTANT** | مرحباً بك في مكتب الحسابات والتحصيل<br>*(مكتب التحصيل والسداد)* | Welcome to Financial & Collection Desk<br>*(Collection Desk)* | `/accountant/collections` |
| **PRIMARY MANAGER / ADMIN** | مرحباً بك في مركز الإدارة العامة والحوكمة<br>*(إدارة الفروع والتوزيع)* | Welcome to Governance & Executive Center<br>*(Manage Branches)* | `/manager/branches` (or `/admin/branches`) |
| **PARENT** | مرحباً بك في بوابة متابعة ولي الأمر<br>*(متابعة الأبناء)* | Welcome to Parent Portal<br>*(View Children)* | `/parent/children` |

---

## 3. Implementation Details

- **Component:** `apps/frontend/src/app/components/shared/ContextualGuidanceBanner.tsx`
- **Mount Point:** Integrated inside `<main id="main-content">` in `SharedLayout.tsx` directly above `{children}`, ensuring all authenticated dashboards display the banner.
- **Persistence Mechanism:** Stores `ox_guidance_dismissed_${role}_${userId} = 'true'` in `localStorage` upon clicking the dismiss ("X") button. Subsequent visits and page refreshes check this key and prevent the banner from rendering.
- **Theme Compliance:** Utilizes `bg-card`, `text-card-foreground`, `border-border`, `bg-primary/10`, `text-primary`, and `bg-primary text-primary-foreground`. Renders consistently across Academic Crimson, Midnight Navy, Forest Green, Royal Purple, Slate Charcoal, Warm Amber, and Cyber Neon.

---

## 4. Test Evidence

Tested within `SmartNotificationCounters.test.tsx`:
- `✓ renders student onboarding guidance with authentic explore courses action`
- `✓ renders teacher onboarding guidance with manage courses action`
- `✓ renders accountant onboarding guidance with collection desk action`
- `✓ renders primary manager onboarding guidance with branch management action`
- `✓ renders parent onboarding guidance with children monitoring action`
- `✓ dismisses banner and persists dismissal in localStorage per user and role`
- `✓ renders in English when English locale is selected`

- **Execution Result:** All 7 guidance tests passed cleanly.
- **Duration:** Included in the 522ms run.
- **Exit Code:** `0`.

---

## 5. Verdict

The Role-Based Contextual User Guidance system is **FULLY VERIFIED** and operational across all 5 roles.

