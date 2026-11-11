# OX-DIGITAL Education — Final Notifications Authentication Fix Report

**Date:** November 2026  
**Repository Workspace:** `D:\OX-DIGITAL\Mathe\OX-DIGITAL-GITHUB`  
**Classification:** Authentication Lifecycle, Notification Polling & Background Task Resilience  
**Status:** FIXED AND TESTED  

---

## 1. Executive Summary

During initial page loads, role dashboard visits, and background polling, the browser console reported:
```text
GET http://localhost:8080/api/notifications/unread-count 401 (Unauthorized)
```

This report documents the authentication lifecycle mismatch that caused unauthenticated requests to fire before credentials were fully loaded, details the dual-layer client and server remediation, and proves elimination of 401 console noise.

---

## 2. Root Cause Analysis

### 2.1 The Authentication State Hydration Race Condition
1. In `apps/frontend/src/app/contexts/AuthContext.tsx`:
   - `user` is restored synchronously on initial component mount from `localStorage.getItem('edu-user')`.
   - However, during login transitions, page refreshes, or when sessions expire, `localStorage.getItem('edu-user')` may exist while `localStorage.getItem('token')` has been cleared or expired.
2. In `apps/frontend/src/app/components/shared/SharedLayout.tsx`:
   ```typescript
   // Previous implementation:
   const fetchUnreadCount = async () => {
     if (!user) return; // <--- FLAW: Only checked user object, not the presence of a valid token!
     try {
       const res = await notificationService.getUnreadCount();
       setUnreadCount(res.data?.unreadCount || 0);
     } catch {}
   };
   ```
   - Because `user` was non-null, `fetchUnreadCount` executed immediately upon mount and every 30 seconds via `setInterval`.
3. In `apps/frontend/src/app/services/api.ts`:
   - The request interceptor attaches the token:
     ```typescript
     const token = localStorage.getItem('token');
     if (token) {
       config.headers.Authorization = `Bearer ${token}`;
     }
     ```
   - When `token` was missing or empty, `Authorization` was omitted entirely.
4. In `services/user-service/src/routes/notification.routes.ts`:
   - Both `router.use(verifyToken, ...)` and `router.get('/unread-count', verifyToken, ...)` enforced token verification.
   - Without an `Authorization` header, `verifyToken` returned:
     `res.status(401).json({ message: 'Authentication token required' })`.
   - The browser logged the 401 failure to the console.

---

## 3. Remediation Implementation

### 3.1 Client-Side Notification Service Auth Guard
In `apps/frontend/src/app/services/notification.service.ts:16-30`:
```typescript
export const notificationService = {
  getNotifications: (params?: { limit?: number; unread?: boolean }) => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    if (!token) {
      return Promise.resolve({ data: [] as Notification[] });
    }
    return notificationApi.get<Notification[]>('/', { params });
  },

  getUnreadCount: () => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    if (!token) {
      return Promise.resolve({ data: { unreadCount: 0 } });
    }
    return notificationApi.get<{ unreadCount: number }>('/unread-count');
  },
...
```
- **Zero Console Spam:** If the client is unauthenticated or mid-transition, `getUnreadCount()` resolves immediately with `{ data: { unreadCount: 0 } }` without initiating an unauthorized HTTP request.

### 3.2 Dual Auth Condition & Dependency Stabilization in SharedLayout
In `apps/frontend/src/app/components/shared/SharedLayout.tsx:51-66`:
```typescript
  const fetchUnreadCount = async () => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    if (!user || !token) {
      setUnreadCount(0);
      return;
    }
    try {
      const res = await notificationService.getUnreadCount();
      setUnreadCount(typeof res.data?.unreadCount === 'number' ? res.data.unreadCount : 0);
    } catch {
      // Graceful fallback on network/auth errors
    }
  };

  useEffect(() => {
    fetchUnreadCount();
    const interval = setInterval(fetchUnreadCount, 30000);
    return () => clearInterval(interval);
  }, [user?.id]);
```
- Only invokes `notificationService.getUnreadCount` when both `user` and `token` exist.
- Uses `[user?.id]` as the dependency array instead of `[user]`, preventing the 30-second interval from being recreated whenever non-identity properties of `user` (theme, language, avatar) are modified.

### 3.3 Server-Side Identity Resolution Resilience
In `services/user-service/src/controllers/notification.controller.ts:57-61`:
```typescript
export const getUnreadCount = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId || (req.user as any)?.id;
    if (!userId) return res.status(401).json({ message: 'Unauthorized' });
...
```

---

## 4. Verification Evidence

- **Unit Test Suite:** `services/user-service/test/runtimeApiErrors.test.ts`
  - `D1`: Unauthenticated request to `getUnreadCount` properly returns HTTP 401 when accessed directly (**PASS**).
  - `D2`: Authenticated request returns HTTP 200 with accurate unread count scoped strictly to `userId` (**PASS**).
- **Frontend Regression Suite:** All notification-related tests passed:
  - `TeacherDashboard.test.tsx`: Notification fetching, badge count, and markAsRead passed.
  - `ParentDashboard.test.tsx`: Parent notification panel and markAsRead passed.
  - `TargetedRemediationStateHandling.test.tsx`: NotificationsPanel error/empty state passed.
- **Frontend Build:** `npm run build` completed with 0 errors.

