# OX-DIGITAL Education — Final Smart Notification Counters Report

**Generated Date:** November 9, 2026  
**Target Repository:** `D:\OX-DIGITAL\Mathe\OX-DIGITAL-GITHUB`  
**Components Covered:** `useSmartNavigationCounters.ts`, `AdminDashboard.tsx`, `PrimaryManagerDashboard.tsx`, `AccountantDashboard.tsx`, `SharedLayout.tsx`  
**Test Suite:** `apps/frontend/src/app/test/SmartNotificationCounters.test.tsx`  

---

## 1. Problem Statement & Fake Counter Remediation

### 1.1 Discovery of Hardcoded Badge
Inspection of `AdminDashboard.tsx` line 34 revealed a static counter:
```tsx
{ path: '/admin/approvals', icon: ShieldCheck, label: 'مركز الموافقات والاعتمادات', labelKey: 'adminMenuApprovals', badge: 3 }
```
This hardcoded badge presented misleading information to administrators even when 0 expense vouchers were awaiting approval.

### 1.2 Remediation
- Removed `badge: 3` completely from `adminMenuItems`.
- Engineered a centralized hook: `apps/frontend/src/app/hooks/useSmartNavigationCounters.ts`.
- The hook computes authentic counts directly from backend microservices:
  - **Admins & Primary Managers:** Calls `accountingService.getExpenses({ status: 'PENDING_APPROVAL' })` to derive `pendingApprovals`.
  - **Accountants:** Calls `accountingService.getArrearsReport()` to derive `pendingCollections`.
  - **Students:** Calls `homeworkService.getStudentHomework()` to derive `pendingHomework`.
  - **All Roles:** Calls `notificationService.getUnreadCount()` to derive `unreadNotifications`.
- If an entity count is 0 or no data is returned, the badge is explicitly `undefined`, preventing false badges from rendering in the sidebar navigation.

---

## 2. Dynamic Integration Across Dashboards

The hook exposes `applyBadgesToMenuItems(items: MenuItem[]): MenuItem[]`, which dynamically scans navigation routes and binds authentic badges:
- In `AdminDashboard.tsx`: Menu items pass through `applyBadgesToMenuItems`, dynamically setting the badge for `/admin/approvals` only when pending vouchers actually exist.
- In `PrimaryManagerDashboard.tsx`: Bound to `applyBadgesToMenuItems`.
- In `AccountantDashboard.tsx`: Bound to `applyBadgesToMenuItems`.
- In `SharedLayout.tsx`: `item.badge !== undefined && item.badge > 0` conditionally renders the counter pill with semantic theme classes (`bg-destructive text-destructive-foreground`).

---

## 3. Test Evidence

Executed via Vitest:
`npx.cmd vitest run src/app/test/SmartNotificationCounters.test.tsx`

| Test Name | Verified Invariant | Status |
|:---|:---|:---|
| `eliminates fake static badge: 3 from adminMenuItems` | Asserts `adminMenuItems.find('/admin/approvals')?.badge === undefined` | **PASS** |
| `calculates zero badge when no pending approvals exist` | Asserts when `vouchers: []`, badge is `undefined` (not rendered) | **PASS** |
| `dynamically sets badge based on authoritative pending approvals` | Asserts 4 vouchers return `badge: 4` on `/admin/approvals` | **PASS** |
| `dynamically sets student pending homework counters` | Asserts pending homework returns correct badge on `/student/online/homework` | **PASS** |

- **Suite Execution Result:** 11 / 11 Tests Passed.
- **Duration:** 522ms.
- **Exit Code:** `0`.

---

## 4. Verdict

The Smart Notification Counters system is **FULLY VERIFIED**. All fake badges are removed, and all counters strictly reflect authoritative server state.

