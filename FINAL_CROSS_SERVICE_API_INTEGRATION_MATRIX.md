# OX-DIGITAL Education — Final Cross-Service API Integration Matrix

**Date:** November 2026  
**Repository Workspace:** `D:\OX-DIGITAL\Mathe\OX-DIGITAL-GITHUB`  
**Classification:** Cross-Service Routing, API Gateway Contracts & Security Architecture  
**Status:** FULLY RECONCILED & VERIFIED  

---

## 1. Executive Summary

This matrix documents the end-to-end integration contracts across all five backend microservices (`auth-service`, `user-service`, `ai-service`, `course-service`, `analytics-service`), the Nginx API gateway reverse proxy, and the frontend client layers.

Every endpoint involved in the 5 runtime errors has been audited, mapped, and aligned.

---

## 2. Comprehensive Service Integration Matrix

| # | Client Origin Path | Nginx Ingress Route | Upstream Service & Port | Backend Route Handler | Body Limit | Auth & Role Requirements | Status |
|---|---|---|---|---|---|---|---|
| **1** | `/api/users/linked-relationships` | `location /api/users` | `user-service:4002` | `user.routes.ts` -> `getLinkedRelationships` | 100 KB | `verifyToken`, `tenantContext` (All Roles) | **VERIFIED & OPERATIONAL** |
| **2** | `/api/account/relationships` | `location /api/account` | `user-service:4002` | `brdSubscription.routes.ts` -> `getLinkedRelationships` | 100 KB | `verifyToken` (All Roles) | **VERIFIED & OPERATIONAL** |
| **3** | `/api/users/account/relationships` | `location /api/users` | `user-service:4002` | `user.routes.ts` & `brdSubscription.routes.ts` | 100 KB | `verifyToken` (All Roles) | **VERIFIED & OPERATIONAL** |
| **4** | `/api/users/account/profile-picture` | `location /api/users` | `user-service:4002` | `brdSubscription.routes.ts` -> `uploadProfilePicture` | **6 MB** | `verifyToken` (All Roles; 2MB binary limit enforced) | **VERIFIED & OPERATIONAL** |
| **5** | `/api/account/profile-picture` | `location /api/account` | `user-service:4002` | `brdSubscription.routes.ts` -> `uploadProfilePicture` | **6 MB** | `verifyToken` (All Roles; 2MB binary limit enforced) | **VERIFIED & OPERATIONAL** |
| **6** | `/api/users/teacher/students` | `location /api/users` | `user-service:4002` | `brdSubscription.routes.ts` -> `getTeacherStudents` | 100 KB | `verifyToken`, `checkRole(['TEACHER'])` | **VERIFIED & OPERATIONAL** |
| **7** | `/api/teacher/my-students` | `location /api/teacher` | `user-service:4002` | `brdSubscription.routes.ts` -> `getTeacherStudents` | 100 KB | `verifyToken`, `checkRole(['TEACHER'])` | **VERIFIED & OPERATIONAL** |
| **8** | `/api/teacher/students` | `location /api/teacher` | `user-service:4002` | `brdSubscription.routes.ts` -> `getTeacherStudents` | 100 KB | `verifyToken`, `checkRole(['TEACHER'])` | **VERIFIED & OPERATIONAL** |
| **9** | `/api/notifications/unread-count` | `location /api/notifications` | `user-service:4002` | `notification.routes.ts` -> `getUnreadCount` | 100 KB | `verifyToken`, `tenantContext` (All Authenticated Roles) | **VERIFIED & OPERATIONAL** |
| **10** | `/api/notifications` | `location /api/notifications` | `user-service:4002` | `notification.routes.ts` -> `getNotifications` | 100 KB | `verifyToken`, `tenantContext` (All Authenticated Roles) | **VERIFIED & OPERATIONAL** |
| **11** | `/socket.io` | `location /socket.io` | `course-service:4004` | `index.ts` -> `io.use` (JWT handshake) | N/A (WS) | Handshake `auth: { token }` (`ADMIN`, `PRIMARY_MANAGER`, `TEACHER`, `STUDENT`, `PARENT`) | **VERIFIED & OPERATIONAL** |
| **12** | `/api/account/settings` | `location /api/account` | `user-service:4002` | `brdSubscription.routes.ts` -> `getAccountSettings` | 100 KB | `verifyToken` (All Roles) | **VERIFIED & OPERATIONAL** |
| **13** | `/api/users/account/settings` | `location /api/users` | `user-service:4002` | `brdSubscription.routes.ts` -> `getAccountSettings` | 100 KB | `verifyToken` (All Roles) | **VERIFIED & OPERATIONAL** |
| **14** | `/api/manager/branches` | `location /api/manager` | `user-service:4002` | `brdSubscription.routes.ts` -> `getBranches` | 100 KB | `requirePrimaryManager` (`ADMIN` + `isPrimaryManager: true`) | **VERIFIED & OPERATIONAL** |
| **15** | `/api/accounting/cashbox/reconcile` | `location /api/accounting` | `user-service:4002` | `cashbox.controller.ts` -> `reconcileCashbox` | 100 KB | `checkRole(['ACCOUNTANT'])`, Single Branch Confinement | **VERIFIED & OPERATIONAL** |
| **16** | `/api/accounting/expenses/:id/disburse` | `location /api/accounting` | `user-service:4002` | `expenses.controller.ts` -> `disburseExpenseVoucher` | 100 KB | `checkRole(['ACCOUNTANT'])`, Voucher Branch Match | **VERIFIED & OPERATIONAL** |

---

## 3. Nginx API Gateway Ingress Conformance

```
                    ┌────────────────────────────┐
                    │  Client (Browser / SPA)    │
                    └─────────────┬──────────────┘
                                  │ Port 8080
                                  ▼
                    ┌────────────────────────────┐
                    │    Nginx Reverse Proxy     │
                    └──────┬───────┬───────┬─────┘
                           │       │       │
       /api/auth ──────────┘       │       └────────── /socket.io, /api/courses
                                   ▼
                   /api/users, /api/account,
                   /api/teacher, /api/notifications,
                   /api/accounting, /api/manager
                                   │
                                   ▼
                    ┌────────────────────────────┐
                    │     User Service (4002)    │
                    │   - Body Limit: 6MB (Avatar)│
                    │   - Body Limit: 100KB (All) │
                    └────────────────────────────┘
```

1. **Fail-Closed API Gateway:**
   - Unmapped `/api/*` endpoints fall through to Nginx line 226:
     `return 404 '{"status":404,"error":"Not Found","message":"API route not found"}';`
   - All legitimate application routes (`/api/users`, `/api/account`, `/api/teacher`, `/api/notifications`, `/api/accounting`, `/api/manager`) are explicitly mapped.
2. **WebSocket Upgrade Headers:**
   - `proxy_http_version 1.1;`
   - `proxy_set_header Upgrade $http_upgrade;`
   - `proxy_set_header Connection $connection_upgrade;`
   - `proxy_read_timeout 86400s;`
   - Successfully handles persistent Socket.IO connections through Course Service (4004).

---

## 4. Verification Evidence

- Backend In-Memory Regression Suite: **47/47 Passed**.
- Targeted Runtime API Unit Tests: **28/28 Passed**.
- Frontend Vitest Test Suites: **38/38 Files Passed, 346/346 Tests Passed**.
- TypeScript Compilation across all services: **0 Errors**.
- Frontend Production Bundle Build: **0 Errors**.

