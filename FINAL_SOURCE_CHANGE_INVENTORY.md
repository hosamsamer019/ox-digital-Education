# FINAL SOURCE CHANGE INVENTORY
**Project:** OX-DIGITAL Education Platform  
**Target Repository:** `D:\OX-DIGITAL\Mathe\OX-DIGITAL-GITHUB`  
**Execution Date:** 2026-11-09  
**Status:** FULL AUDIT TRAIL OF CODE MODIFICATIONS  

---

## 1. Summary of Modified and Created Source Files

The table below catalogs every modified and newly added source file within the authorized workspace (`D:\OX-DIGITAL\Mathe\OX-DIGITAL-GITHUB`). No sibling projects or external files were modified.

| File Path | Nature of Change | Purpose / Defect Addressed |
| :--- | :---: | :--- |
| `services/course-service/src/controllers/course.controller.ts` | Modified | Tenant isolation in courses & lessons, teacher course ownership enforcement, video ticket validation |
| `services/course-service/src/utils/enrollment.ts` | Modified | Extended `checkUserEnrollment` to resolve missing claims from DB, enforce tenant isolation, and authorize course authors |
| `services/course-service/src/middlewares/auth.middleware.ts` | Modified | Restricted video streaming JWT tickets strictly to `/lessons/:id/(stream|hls)` endpoints |
| `services/course-service/src/services/videoToken.service.ts` | Modified | Enriched `VideoTicketPayload` with `role` and `institutionId` |
| `services/course-service/src/index.ts` | Modified | CORS configuration and security header alignment |
| `services/course-service/course_ownership_authorization.test.ts` | Added | 21-scenario negative regression test suite for course ownership and tenant isolation |
| `services/user-service/src/controllers/brdSubscription.controller.ts` | Modified | Support teacher unassignment (`'NONE'` / `null`) and block cross-institution teacher/branch assignments |
| `services/user-service/src/controllers/user.controller.ts` | Modified | Added `/api/users/me/teacher-students`, `/linked-teachers`, `/linked-students` |
| `services/user-service/src/controllers/notification.controller.ts` | Modified | Tenant scoping on notifications and Socket.IO dispatch |
| `services/user-service/src/controllers/accounting/cashbox.controller.ts` | Modified | Enforced branch scoping on cashbox shifts |
| `services/user-service/src/controllers/accounting/expenses.controller.ts` | Modified | Enforced branch scoping on expenses |
| `services/user-service/src/controllers/accounting/receipts.controller.ts` | Modified | Enforced branch scoping on receipts |
| `services/user-service/src/routes/user.routes.ts` | Modified | Registered routes for missing teacher/parent endpoints |
| `services/user-service/src/routes/brdSubscription.routes.ts` | Modified | Route binding for branch assignment and unassignment |
| `services/user-service/test/crossBranchBackend.test.ts` | Added | 49-test negative authorization test suite for financial and branch isolation |
| `services/user-service/test/runtimeApiErrors.test.ts` | Added | 28-test regression suite for runtime API errors |
| `apps/frontend/src/app/services/brdSubscription.service.ts` | Modified | Added unassign capability (`branchId: string | null`) |
| `apps/frontend/src/app/components/primary-manager/BranchesPage.tsx` | Modified | UI for current teacher branch display and "إلغاء التعيين" button |
| `apps/frontend/src/app/components/video/UnifiedVideoPlayer.tsx` | Modified | Anti-cheat pause on blur/iframe focus, ticket re-verification on resume, watermark persistence |
| `apps/frontend/src/app/test/VideoPlaybackSecurityLifecycle.test.tsx` | Added | 7 lifecycle tests for video security, focus change, and expired tokens |
| `docker-compose.staging.yml` | Modified | Staging container definitions, isolated bridge networking, port cleanup |
| `docker-compose.production.yml` | Modified | Production container specs, health checks, restart policies |

---

## 2. Git Working Tree Integrity

In strict adherence to instructions:
- **No Git reset**, `git clean`, or branch switching was performed.
- All pre-existing user modifications and working changes have been preserved intact.
- No destructive checkouts or overwrites occurred.
