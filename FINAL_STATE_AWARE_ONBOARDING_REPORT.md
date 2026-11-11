# OX-DIGITAL Education — Final State-Aware Onboarding & Guidance Report

**Audit Date:** November 9, 2026  
**Audited Target:** `D:\OX-DIGITAL\Mathe\OX-DIGITAL-GITHUB`  
**Focus Files:**
- `apps/frontend/src/app/components/shared/ContextualGuidanceBanner.tsx`
- `apps/frontend/src/app/test/StateAwareOnboarding.test.tsx`
- `apps/frontend/src/app/test/SmartNotificationCounters.test.tsx`

---

## 1. Executive Summary

This report documents the architectural overhaul and comprehensive verification of the **Contextual User Guidance & Onboarding System** in OX-DIGITAL Education.

Previously, user dashboards displayed static, generic welcome messages that provided no dynamic assistance or awareness of the user's actual academic, administrative, or financial state. 

The new system implements a deterministic state machine via `resolveStateAwareGuidance` in `ContextualGuidanceBanner.tsx`. Guidance banners now accurately reflect real user data, progress stages, and administrative blockers.

---

## 2. Role State Machine & Guidance Matrix

### 2.1 Student Journey State Transitions
| Academic / Financial State | `stepId` | Guidance Title (Arabic / English) | Primary Action Route | Priority / Type |
| :--- | :--- | :--- | :--- | :--- |
| `financialAccessStatus === 'RESTRICTED'` | `STUDENT_FINANCIAL_RESTRICTION` | تنبيه: تم تعليق صلاحية الوصول الأكاديمي مالياً / Notice: Academic Access Suspended | `/student/online/subscriptions` or `/student/center/subscription` | High Priority Blocker Banner |
| 0 Enrolled Courses (Online Student) | `STUDENT_EXPLORE_COURSES` | الخطوة الأولى: استكشف المقررات المتاحة وسجل في أول مقرر / Explore Courses & Enroll | `/student/online/courses` | Onboarding Action |
| 0 Enrolled Courses (Center Student) | `STUDENT_EXPLORE_COURSES` | الخطوة التالية: مراجعة مقررات المركز المعتمدة / Review Enrolled Center Courses | `/student/center/courses` | Onboarding Action |
| Pending Homework Count > 0 | `STUDENT_PENDING_HOMEWORK` | لديك واجبات وتطبيقات دراسية بانتظار التسليم / You have pending homework | `/student/online/homework` or `/student/center/homework` | Academic Task Action |
| 0 Pending Homework | `STUDENT_CONTINUE_LEARNING` | أنت على المسار التعليمي الصحيح / You are on the right learning path | `/student/online/courses` or `/student/center/courses` | Progress Confirmation |

### 2.2 Teacher Journey State Transitions
| Administrative / Academic State | `stepId` | Guidance Title (Arabic / English) | Primary Action Route | Priority / Type |
| :--- | :--- | :--- | :--- | :--- |
| `branchId === null` | `TEACHER_AWAITING_BRANCH` | تنبيه إداري: لم يتم إسنادك إلى فرع بعد / Not assigned to a branch yet | `/teacher/profile` | Administrative Blocker |
| Assigned, 0 Courses Authored | `TEACHER_CREATE_COURSE` | ابدأ ببناء مقررك التعليمي الأول / Start by creating your first course | `/teacher/courses` | Onboarding Action |
| Assigned, Courses Authored > 0 | `TEACHER_MONITOR_STUDENTS` | مرحباً بك في منظومة المعلم الأكاديمية / Welcome to Teacher Academic Portal | `/teacher/students` | Academic Workflow |

### 2.3 Accountant & Management Journeys
| Role & State | `stepId` | Guidance Title | Action Route |
| :--- | :--- | :--- | :--- |
| Accountant, Approved Vouchers > 0 | `ACCOUNTANT_PENDING_DISBURSEMENT` | سندات صرف معتمدة بانتظار الصرف الفعلي | `/accountant/expenses` |
| Accountant, Approved Vouchers == 0 | `ACCOUNTANT_COLLECTIONS_DESK` | مكتب التحصيل والسداد اليومي | `/accountant/collections` |
| Primary Manager, Pending Approvals > 0 | `MANAGER_PENDING_APPROVALS` | طلبات مالية وسندات بانتظار الاعتماد | `/admin/approvals` |
| Primary Manager, Pending Approvals == 0 | `MANAGER_BRANCHES_SETUP` | مرحباً بك في مركز الإدارة العامة والحوكمة | `/manager/branches` |

---

## 3. Persistent Dismissal Lifecycle

A critical usability requirement was ensuring that dismissing a banner does not suppress future guidance when a user advances to a new milestone or encounters an administrative blocker.

### Implementation:
- Dismissal keys are stored in browser `localStorage` scoped by:
  `ox_guidance_dismissed_${rawRole}_${user?.id}_${stepId}`
- If a user dismisses `STUDENT_EXPLORE_COURSES`, the banner disappears for that milestone.
- As soon as the student enrolls and receives their first assignment (`stepId` transitions to `STUDENT_PENDING_HOMEWORK`), the new step's banner is rendered automatically.
- Dismissing a guidance banner only suppresses visual display for that specific step and never alters backend data or marks requirements as completed.

---

## 4. Test Verification Evidence

The entire onboarding state machine was tested in `apps/frontend/src/app/test/StateAwareOnboarding.test.tsx`:

```
 RUN  v4.1.10 D:/OX-DIGITAL/Mathe/OX-DIGITAL-GITHUB/apps/frontend

 ✓ src/app/test/StateAwareOnboarding.test.tsx (15 tests) 159ms

 Test Files  1 passed (1)
      Tests  15 passed (15)
   Start at  14:38:23
   Duration  5.22s
```

All 15 scenarios passed with exit code 0:
1. Online student unenrolled -> `/student/online/courses` (**PASS**)
2. Center student unenrolled -> `/student/center/courses` (**PASS**)
3. Student pending homework -> `/student/online/homework` (**PASS**)
4. Student 0 pending homework -> `/student/online/courses` (**PASS**)
5. Financially restricted student -> Blocker banner with overdue fees warning (**PASS**)
6. Teacher without branch -> Administrative notice blocker banner (**PASS**)
7. Teacher assigned to branch, 0 courses -> Create course (**PASS**)
8. Teacher assigned with courses -> Monitor students (**PASS**)
9. Accountant with approved vouchers -> Disburse vouchers (**PASS**)
10. Accountant with 0 pending vouchers -> Collection desk (**PASS**)
11. Primary manager with pending vouchers -> Approvals center (**PASS**)
12. Primary manager with 0 pending vouchers -> Branch governance (**PASS**)
13. Scoped localStorage persistence per user, role, and stepId (**PASS**)
14. State transition re-engagement upon state change (**PASS**)
15. English localization rendering (**PASS**)

---

## 5. Final Verdict

**Onboarding & Guidance Status:** `VERIFIED`  
The state-aware guidance system correctly replaces generic static banners, integrates cleanly with role and progress states, and maintains persistent, milestone-scoped dismissal.

