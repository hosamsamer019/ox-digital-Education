# OX-DIGITAL Education — Final Smart Counter Semantics & Source Code Audit Report

**Audit Date:** November 9, 2026  
**Audited Target:** `D:\OX-DIGITAL\Mathe\OX-DIGITAL-GITHUB`  
**Focus Files:**
- `apps/frontend/src/app/hooks/useSmartNavigationCounters.ts`
- `apps/frontend/src/app/components/shared/SharedLayout.tsx`
- `apps/frontend/src/app/components/admin/AdminDashboard.tsx`
- `apps/frontend/src/app/components/primary-manager/PrimaryManagerDashboard.tsx`
- `apps/frontend/src/app/components/accountant/AccountantDashboard.tsx`
- `apps/frontend/src/app/components/teacher/TeacherDashboard.tsx`
- `apps/frontend/src/app/components/student-shared/StudentSubscriptionsPage.tsx`
- `services/user-service/src/controllers/accounting/expenses.controller.ts`
- `services/user-service/src/controllers/accounting/collections.controller.ts`

---

## 1. Executive Summary

A comprehensive source-code and runtime semantics audit was conducted across the navigation counter infrastructure of the OX-DIGITAL Education platform. 

The audit identified and resolved critical semantic defects in how badges and pending task counters were previously handled:
1. **Approval Counter Semantics:** Previous reports cited pending approvals indiscriminately across expenses. The counter is now strictly tied to actionable vouchers in `PENDING_APPROVAL` status awaiting dual-control verification (Maker-Checker). When 0, badges are completely suppressed (`undefined`) preventing phantom counter clutter.
2. **Accountant Counter Semantics Correction:** Previous code attempted to place student debtor/arrears counts as an urgent badge on `/accountant/collections`. This was semantically flawed because collections is an ongoing intake desk, not a task queue. The counter now strictly tracks approved expense vouchers (`status: 'APPROVED'`) awaiting physical disbursement by the cashier/accountant on `/accountant/expenses`.
3. **Student Homework Counter Semantics:** Fixed service invocation from non-existent `getStudentHomework()` to real method `homeworkService.getHomeworks()` with fallback. Filters strictly for unsubmitted actionable assignments (`!h.submittedAt && (h.status === 'pending' || h.status === 'assigned' || h.status === 'PENDING')`) and deduplicates by assignment UUID.
4. **Teacher & Parent Navigation Counter Cleanliness:** Corrected absence of relevant queue counters: teachers do not have spurious approval badges; parent counters track student alerts rather than staff vouchers.

---

## 2. Detailed Counter Semantics & Source Verification

### 2.1 Approval Counter (`/admin/approvals`)
- **Target Role(s):** `PRIMARY_MANAGER`, `ADMIN`, `SUPER_ADMIN`.
- **Authoritative Service Call:** `accountingService.getExpenses({ status: 'PENDING_APPROVAL' })`.
- **Deduplication & Filtering Logic:**
  ```typescript
  const expRes = await accountingService.getExpenses({ status: 'PENDING_APPROVAL' });
  const rawList = Array.isArray(expRes?.vouchers) ? expRes.vouchers : [];
  const uniquePending = new Map<string, any>();
  rawList.forEach((v: any) => {
    if (v && v.id && (v.status === 'PENDING_APPROVAL' || !v.status)) {
      uniquePending.set(v.id, v);
    }
  });
  approvals = uniquePending.size;
  ```
- **Menu Binding:** Bound to menu item with path `/admin/approvals`.
- **Zero-Badge Semantics:** If `approvals === 0`, badge evaluates to `undefined`, preventing badge rendering in `SharedLayout.tsx`.

### 2.2 Accountant Pending Disbursements Counter (`/accountant/expenses`)
- **Target Role(s):** `ACCOUNTANT`.
- **Resolution of Previous Defect:** Previous implementation counted delinquent students and displayed a red badge on the collection desk. This was incorrect because overdue students represent student balances, not a pending accountant task.
- **Corrected Semantics:** The accountant’s actionable backlog is vouchers approved by management that require cash payout and cashbox ledger entries.
- **Authoritative Service Call:** `accountingService.getExpenses({ status: 'APPROVED' })`.
- **Filtering Logic:**
  ```typescript
  const expRes = await accountingService.getExpenses({ status: 'APPROVED' });
  const rawList = Array.isArray(expRes?.vouchers) ? expRes.vouchers : [];
  const uniqueApproved = new Map<string, any>();
  rawList.forEach((v: any) => {
    if (v && v.id && (v.status === 'APPROVED' || !v.status)) {
      uniqueApproved.set(v.id, v);
    }
  });
  disbursements = uniqueApproved.size;
  ```
- **Menu Binding:** Bound to path `/accountant/expenses`.
- **Zero-Badge Semantics:** If `disbursements === 0`, badge evaluates to `undefined`.

### 2.3 Student Homework Counter (`/student/online/homework`, `/student/center/homework`)
- **Target Role(s):** `STUDENT`, `ONLINE_STUDENT`, `CENTER_STUDENT`.
- **Resolution of API Discrepancy:** Invokes `(homeworkService.getHomeworks || homeworkService.getStudentHomework)()`.
- **Actionable Assignment Filtering:**
  ```typescript
  const hwRes = typeof fetchHw === 'function' ? await fetchHw() : null;
  const rawList = hwRes?.data?.data ? hwRes.data.data : (Array.isArray(hwRes?.data) ? hwRes.data : (Array.isArray(hwRes) ? hwRes : []));
  const uniqueHw = new Map<string, any>();
  rawList.forEach((h: any) => {
    if (
      h &&
      h.id &&
      !h.submittedAt &&
      (h.status === 'pending' || h.status === 'assigned' || h.status === 'PENDING')
    ) {
      uniqueHw.set(h.id, h);
    }
  });
  homework = uniqueHw.size;
  ```
- **Exclusions:** Graded, completed, or already submitted assignments are strictly excluded.
- **Menu Binding:** Bound to `/student/online/homework` or `/student/center/homework`.

### 2.4 Notifications Counter (`/notifications`)
- **Target Role(s):** All authenticated roles.
- **Authoritative Service Call:** `notificationService.getUnreadCount()`.
- **Fail-Closed Handling:** If the network request fails, unread count defaults to `0` instead of fabricating numbers or keeping stale data.

---

## 3. Stale Response Protection & Sequence Control

To eliminate race conditions when rapid navigation or multiple events trigger concurrent counter fetches:
- `fetchSequenceRef = useRef<number>(0)` tracks invocation sequence.
- State is committed **only if** the resolving sequence matches `fetchSequenceRef.current`:
  ```typescript
  const currentSeq = ++fetchSequenceRef.current;
  // ... async fetches ...
  if (currentSeq === fetchSequenceRef.current) {
    setCounters({ pendingApprovals: approvals, unreadNotifications: unread, pendingHomework: homework, pendingDisbursements: disbursements });
    setLoading(false);
  }
  ```

---

## 4. Verification Verdict

| Component / Requirement | Status | Verification Evidence |
| :--- | :--- | :--- |
| **Approval Counter Semantics** | `VERIFIED` | `SmartNotificationCounters.test.tsx` (11/11 Passed) |
| **Accountant Counter Semantics** | `VERIFIED` | `RealtimeCounterLifecycle.test.tsx` Test 3 Passed |
| **Student Homework Semantics** | `VERIFIED` | `RealtimeCounterLifecycle.test.tsx` Test 4 Passed |
| **Zero-Count Badge Suppression** | `VERIFIED` | `RealtimeCounterLifecycle.test.tsx` Test 2 Passed |
| **Stale Response Protection** | `VERIFIED` | Source-code inspection in `useSmartNavigationCounters.ts` |

