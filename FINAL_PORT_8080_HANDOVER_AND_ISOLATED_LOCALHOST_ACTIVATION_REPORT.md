# OX-DIGITAL Education — Final Port 8080 Handover & Isolated Localhost Activation Report

**Date:** November 11, 2026  
**Workspace:** `D:\OX-DIGITAL\Mathe\OX-DIGITAL-GITHUB`  
**Compose Project Name:** `ox-digital-github-dev`  
**Gateway Target:** `http://localhost:8080` (`127.0.0.1:8080->80`)  
**Authorized Database Target:** `ox-digital-isolated-dev-postgres` (`127.0.0.1:5433`, DB `ox_digital_dev_test`, User `ox_dev_admin`, Volume `ox_digital_isolated_dev_pgdata`)

---

## 1. Executive Decision Matrix

| Area | Classification | Evidence Basis |
|---|---|---|
| Phase B Dependency-Order Builds & TypeScript | **PASS** | `packages/shared`, `packages/database`, all 6 backend services, `apps/frontend`, and all 7 Compose Docker images built cleanly with exit code `0`. |
| Phase D Approved Port `8080` Handover | **PASS** | Inspected and stopped ONLY verified legacy container `ox-digital-nginx` (`f9547dd676f9e5e46e3e75987c9a3f2da333b1a4d0a22d5420d148c033fe0be6`); all 10 other legacy containers, staging, AL-SADEN, and all volumes remained untouched. |
| Phase E Isolated Compose Activation (`ox-digital-github-dev`) | **PASS** | All 9 project-scoped containers `Up (healthy)`, mounting `./nginx/nginx.conf` & `./nginx/ssl` from `D:\OX-DIGITAL\Mathe\OX-DIGITAL-GITHUB`, bound strictly to `127.0.0.1:8080->80/tcp`. |
| Gateway & Service Health Endpoints (`/`, `/health`, `/login`, `/admin/login`, `/api/*/health`, assets) | **PASS** | HTTP `200` with valid Vite JS/CSS chunks (`index-Bv2Cfn3B.js`, `index-DW1YtGyn.css`), JSON API health responses, dotfile `403`, unauthenticated `/api/*` `401`, JSON `404` catch-all. |
| Auth Service Validation / CORS Error Mapping | **FAIL** | Live probes against `POST /api/auth/login` without `role` field and disallowed CORS preflight logged `Unhandled Exception` and returned `500 Internal Server Error` instead of `400` / `403`. (`POST /api/auth/login` with valid `role` and wrong password returned `401` properly.) |
| Live Authentication & Role Journeys (`ADMIN`, `PRIMARY_MANAGER`, `ACCOUNTANT`, `TEACHER`, `ONLINE_STUDENT`, `CENTER_STUDENT`, `PARENT`) | **BLOCKED** | Plaintext test passwords for the 9 existing `ox_digital_dev_test` accounts are unavailable (11 repository candidate passwords checked read-only returned `NO_MATCH`), and password resets / DB mutations are prohibited. |
| Live Business Workflows (Homework, Accounting Disbursement, Smart Counters, Parent/Onboarding) | **BLOCKED** | Blocked on live user credentials plus empty transactional tables (`Homework`: `0`, `Submission`: `0`, `ExpenseVoucher`: `0`, `CourseEnrollment`: `0`) with DB mutations prohibited. Covered in-memory by passing regression suites (below). |
| Public & Login UI: Responsive Layout & 7 Themes (`1440×900`, `768×1024`, `390×844`) | **PASS WITH LIMITATIONS** | Real Chrome verified zero console/page/network errors, zero broken images, zero horizontal overflow, interactive theme toggle, and all 7 themes (`default`, `light`, `dark`, `blue`, `green`, `purple`, `warm-orange`) across reload on `/`, `/login`, `/admin/login`. Authenticated dashboards are **BLOCKED**. |
| Public & Login UI: English LTR Localization | **FAIL** | On `preferred_language = 'en'` (`dir="ltr"`, `lang="en"` persisted cleanly), `/` and `/admin/login` (and `/login` descriptions) retain untranslated Arabic text and mixed Arabic/English string fragments (`"التعليم الأكاديمي and Smart بمعايير رصينة،وتقنيات تقييم متقدمة no تقبل المساومة."`). |
| Socket.IO Live Network Verification | **PASS WITH LIMITATIONS** | Unauthenticated and forged-JWT handshakes at `http://localhost:8080/socket.io` rejected cleanly with `Authentication error` (**PASS** live). Multi-account cross-tenant room delivery is **NOT VERIFIED** (requires two valid live authenticated sessions). |
| Post-Activation Regression Suites (`tsx` + `Vitest`) | **PASS** *(In-Memory / Mocked)* | All 6 backend security/counter scripts (142 assertions, 0 failed) and all 17 frontend Vitest files (177 tests, 0 failed) passed cleanly after activation. |

---

## 2. Phase B — Pre-Handover Build & Compilation Evidence

Executed inside `D:\OX-DIGITAL\Mathe\OX-DIGITAL-GITHUB` before stopping legacy Nginx:

| Target | Command | Exit Code | Notes |
|---|---|---|---|
| `packages/shared` | `npm.cmd run build --prefix packages/shared` | `0` | Updated `tenantContext` output compiled cleanly to `dist/`. |
| `packages/database` | `npm.cmd run build --prefix packages/database` | `0` | `prisma generate && tsc` (schema client generated locally; zero DB mutation). |
| `services/auth-service` | `npx.cmd tsc --noEmit && npm.cmd run build` | `0` | Clean typecheck & `dist/` build. |
| `services/user-service` | `npx.cmd tsc --noEmit && npm.cmd run build` | `0` | Clean typecheck & `dist/` build. |
| `services/course-service` | `npx.cmd tsc --noEmit && npm.cmd run build` | `0` | Clean typecheck & `dist/` build. |
| `services/ai-service` | `npx.cmd tsc --noEmit && npm.cmd run build` | `0` | Clean typecheck & `dist/` build. |
| `services/analytics-service` | `npx.cmd tsc --noEmit && npm.cmd run build` | `0` | Clean typecheck & `dist/` build. |
| `services/video-worker` | `npx.cmd tsc --noEmit && npm.cmd run build` | `0` | Clean typecheck & `dist/` build. |
| `apps/frontend` | `npx.cmd tsc --noEmit && npm.cmd run build` | `0` | 0 TS errors; Vite built 3,165 modules (`dist/assets/index-CKlHaD0a.js`, fonts, CSS). |
| Isolated Docker Images | `docker compose -p ox-digital-github-dev --env-file .env.production -f docker-compose.production.yml -f docker-compose.isolated-dev.override.yml build` | `0` | Built `ox-digital-github-dev-{frontend,auth-service,user-service,course-service,ai-service,analytics-service,video-worker}:local`. |

---

## 3. Phase D — Port `8080` Handover & Legacy Preservation Evidence

### 3.1 Verified Stopped Container
- **Container Name:** `/ox-digital-nginx`
- **Full Container ID:** `f9547dd676f9e5e46e3e75987c9a3f2da333b1a4d0a22d5420d148c033fe0be6`
- **Verified Pre-Stop Labels:**
  - `com.docker.compose.project`: `ox-digital-education`
  - `com.docker.compose.project.working_dir`: `D:\OX-DIGITAL\Mathe\Mathteachersmartplatform-main`
  - `com.docker.compose.project.config_files`: `D:\OX-DIGITAL\Mathe\Mathteachersmartplatform-main\docker-compose.production.yml`
  - **Pre-Stop Ports:** `0.0.0.0:8080->80/tcp`, `[::]:8080->80/tcp`, `0.0.0.0:8443->443/tcp`, `[::]:8443->443/tcp` (sole Docker container publishing `8080`)
- **Action Executed:** `docker stop f9547dd676f9e5e46e3e75987c9a3f2da333b1a4d0a22d5420d148c033fe0be6` (`STOP_EXIT=0`). Container was stopped only — **not removed, recreated, or modified via `compose down`**.
- **Port `8080` Release Verification:** `docker ps --filter "publish=8080"` returned 0 containers; IPv4 `127.0.0.1:8080` and `0.0.0.0:8080` had 0 listeners (note: `wslrelay.exe` PID `13368` held `[::1]:8080` IPv6 loopback forwarding on the host).

### 3.2 Legacy & Unrelated Stacks Untouched Confirmation
Verified via `docker ps -a` and `docker volume ls --filter name=ox`:
- **Untouched legacy `ox-digital-education` containers (`Up 2 hours`):** `ox-digital-frontend`, `ox-digital-auth-service`, `ox-digital-user-service`, `ox-digital-course-service`, `ox-digital-ai-service`, `ox-digital-analytics-service`, `ox-digital-video-worker`, `ox-digital-pg-backup`, `ox-digital-postgres`, `ox-digital-redis`. (`ox-digital-nginx` remains `Exited (0)`.)
- **Untouched staging:** `ox-digital-staging-postgres` (`Up 2 hours (healthy)`, `127.0.0.1:5432->5432`, volume `ox-digital-staging-postgres-data`). Zero connections made to port `5432`.
- **Untouched AL-SADEN / sibling stack:** All `alsaden-*` containers (`mathteachersmartplatform-main`) remained `Up 2 hours` without changes.
- **Untouched legacy files:** Zero files modified inside `D:\OX-DIGITAL\Mathe\Mathteachersmartplatform-main`.

---

## 4. Phase E — Isolated Deployment Configuration, Health, Mounts & DB Identity

### 4.1 Compose Configuration & Files Changed
- **Project Name:** `ox-digital-github-dev`
- **Command:** `docker compose -p ox-digital-github-dev --env-file .env.production -f docker-compose.production.yml -f docker-compose.isolated-dev.override.yml up -d` (`COMPOSE_UP_EXIT=0`, without `--remove-orphans`)
- **Repository-Local Override Created:** `D:\OX-DIGITAL\Mathe\OX-DIGITAL-GITHUB\docker-compose.isolated-dev.override.yml`
  - Resets hardcoded `container_name` values (`!reset`) so Compose generates project-scoped names (`ox-digital-github-dev-*-1`).
  - Uses isolated image tags (`ox-digital-github-dev-*:local`) to avoid overwriting legacy image tags.
  - Isolates `nginx`, `frontend`, and `redis` onto `ox-digital-github-dev-network` (with `REDIS_URL=redis://github-dev-redis:6379` alias) so Nginx upstream DNS cannot collide with legacy containers on `ox-digital-network`.
  - Attaches DB-client services (`auth-service`, `user-service`, `ai-service`, `course-service`, `analytics-service`, `video-worker`) to existing external `ox-digital-network` to reach `ox-digital-isolated-dev-postgres:5432` without altering Postgres configuration or network attachments.
  - Creates isolated volumes (`ox-digital-github-dev-redis-data`, `ox-digital-github-dev-course-uploads`, `ox_digital_github_dev_avatars_data`) and disables `pg-backup` (`profiles: ["disabled"]`).

### 4.2 Container Status, Labels, Port Binding & Nginx Mounts
All 9 `ox-digital-github-dev` containers reported `Up ... (healthy)` with `com.docker.compose.project.working_dir = D:\OX-DIGITAL\Mathe\OX-DIGITAL-GITHUB` and `com.docker.compose.project.config_files = D:\OX-DIGITAL\Mathe\OX-DIGITAL-GITHUB\docker-compose.production.yml,D:\OX-DIGITAL\Mathe\OX-DIGITAL-GITHUB\docker-compose.isolated-dev.override.yml`:

| Container | Status | Ports | Key Isolation / Startup Evidence |
|---|---|---|---|
| `ox-digital-github-dev-nginx-1` | `Up (healthy)` | `127.0.0.1:8080->80/tcp` | Bind mounts: `D:\OX-DIGITAL\Mathe\OX-DIGITAL-GITHUB\nginx\nginx.conf` (`/etc/nginx/nginx.conf:ro`), `D:\OX-DIGITAL\Mathe\OX-DIGITAL-GITHUB\nginx\ssl` (`/etc/nginx/ssl:ro`). No `0.0.0.0:8080` or `8443` binding. |
| `ox-digital-github-dev-frontend-1` | `Up (healthy)` | `80/tcp` (internal) | Nginx SPA container on `ox-digital-github-dev-network` only. |
| `ox-digital-github-dev-auth-service-1` | `Up (healthy)` | `4000/tcp` (internal, port `4001`) | Logs: `Auth Service running on http://localhost:4001`, `Redis connected successfully.` |
| `ox-digital-github-dev-user-service-1` | `Up (healthy)` | `4000/tcp` (internal, port `4002`) | Logs: `User Service running on http://localhost:4002`, schedulers initialized cleanly. Mounts `./storage/receipts` & `ox_digital_github_dev_avatars_data`. |
| `ox-digital-github-dev-course-service-1` | `Up (healthy)` | `4000/tcp` (internal, port `4004`) | Logs: `Course Service (w/ Socket.IO) running on http://localhost:4004`, `[Storage] Backend: Local Disk (Fallback)`. Mounts `ox-digital-github-dev-course-uploads`. |
| `ox-digital-github-dev-ai-service-1` | `Up (healthy)` | `4000/tcp` (internal, port `4003`) | Logs: `[AI-Service] OpenRouter API configuration loaded successfully`, `AI Service running on http://localhost:4003`. |
| `ox-digital-github-dev-analytics-service-1` | `Up (healthy)` | `4000/tcp` (internal, port `4005`) | Logs: `Analytics Service running on http://localhost:4005`. |
| `ox-digital-github-dev-video-worker-1` | `Up (healthy)` | `4000/tcp` (internal) | Logs: idle standby mode (Cloudflare R2 credentials unset; BullMQ consumer paused cleanly). |
| `ox-digital-github-dev-redis-1` | `Up (healthy)` | `6379/tcp` (internal) | Isolated volume `ox-digital-github-dev-redis-data` on `ox-digital-github-dev-network`. |

### 4.3 Database Identity & Unchanged Volume Evidence
Read-only query executed against `ox-digital-isolated-dev-postgres` (`127.0.0.1:5433->5432`, volume `ox_digital_isolated_dev_pgdata`):
- `current_database()`: `ox_digital_dev_test`, `current_user`: `ox_dev_admin`.
- Existing row inventory (unchanged; 0 migrations, 0 seeds, 0 writes performed): `User`: `9` (`ADMIN` w/ `isPrimaryManager=true`: `1`, `TEACHER`: `1`, `ONLINE_STUDENT`: `1`, `CENTER_STUDENT`: `2`, `PARENT`: `1`, `ACCOUNTANT`: `3`), `Institution`: `2`, `Branch`: `4`, `Course`: `8` (`0` with `branchId`/`institutionId`), `Notification`: `3`, `StudentTeacher`: `1`, `Homework`: `0`, `Submission`: `0`, `ExpenseVoucher`: `0`, `CourseEnrollment`: `0`.

---

## 5. Phase F — HTTP Gateway, Security Probes & Socket.IO Results

### 5.1 Live HTTP Gateway & API Routing (`http://localhost:8080`)
- `GET http://localhost:8080/health` → `200 OK` (`text/plain`, body `OK`, served by Nginx).
- `GET http://localhost:8080/` → `200 OK` (`text/html`, 10,923 bytes, `Last-Modified: Wed, 11 Nov 2026 10:45:05 GMT`, served from `frontend`).
- `GET http://localhost:8080/login` & `/admin/login` → `200 OK` (`text/html`, 10,923 bytes, SPA routing).
- Vite chunks referenced by HTML: `/assets/index-Bv2Cfn3B.js` (`200 OK`, `application/javascript`, 1,571,375 bytes) & `/assets/index-DW1YtGyn.css` (`200 OK`, `text/css`, 316,022 bytes).
- Backend health routes:
  - `/api/auth/health` → `200 OK` (`{"status":"OK","service":"Auth Service",...}`)
  - `/api/users/health` → `200 OK` (`{"status":"OK","service":"User Service",...}`)
  - `/api/ai/health` → `200 OK` (`{"status":"OK","service":"AI Service","openRouterConfigured":true,...}`)
  - `/api/courses/health` & `/api/analytics/health` → `401` (fail closed without auth token).
- Security & ingress checks:
  - `/.env` and `/.git/config` → `403`.
  - `/api/nonexistent` → `404` JSON (`{"status":404,"error":"Not Found","message":"API route not found"}`), no SPA HTML fallback leak.
  - `OPTIONS /api/auth/health` with `Origin: http://localhost:8080` → `Access-Control-Allow-Origin: http://localhost:8080`.
  - `OPTIONS /api/auth/health` with `Origin: https://evil.example` → no `Access-Control-Allow-Origin` header returned (**note:** `auth-service` logged `Not allowed by CORS` as `Unhandled Exception`).
  - Unauthenticated calls to `/api/users/me`, `/api/courses`, `/api/homework`, `/api/accounting/receipts`, `/api/manager/branches`, `/api/analytics/student` → all `401 {"message":"Authentication token required"}`.
  - `POST /api/auth/login` with `{ email, password, role }` (`verify_canonical_logins_live.cjs` for `teacher@gmail.com`, `admin@edu.com`, `acount@gmail.com`) → `401` (`البريد الإلكتروني أو كلمة المرور غير صحيحة`).
  - **Runtime Defect (`FAIL`):** `POST /api/auth/login` omitting `role` (`{ email, password }`) caused Zod `.parse()` to throw into `auth-service` `Unhandled Exception`, returning `500 {"error":"Internal Server Error","status":500}` instead of `400 Bad Request`.

### 5.2 Real Socket.IO Handshake Probes (`http://localhost:8080/socket.io`)
Executed using `socket.io-client` (`transports: ['websocket', 'polling']`, `Origin: http://localhost:8080`):
- Unauthenticated connection → **PASS**: rejected cleanly (`connect_error: Authentication error`).
- Forged JWT (`role: SUPER_ADMIN`, invalid signature) → **PASS**: rejected cleanly (`connect_error: Authentication error`); `course-service` logs remained clean with zero unhandled exceptions.
- Two-account live cross-tenant broadcast delivery (`homework_assigned` / `homework_submitted`) → **NOT VERIFIED** (requires two live authenticated user sessions).

---

## 6. Real Chrome Browser Verification (Public & Login Routes)

Executed via headless Google Chrome (`Puppeteer`) against `http://localhost:8080`:

- **Routes & Viewports Checked:** `/`, `/login`, `/admin/login` at Desktop (`1440×900`), Tablet (`768×1024`), and Mobile (`390×844`):
  - **PASS:** `0` console errors, `0` uncaught `pageerror`, `0` failed HTTP `>= 400` asset/API requests, `0` broken `<img>` elements (`naturalWidth > 0`), and `overflowPx = 0` across all 9 route/viewport renders.
  - **PASS (7 Themes + Toggle Persistence):** Verified interactive UI theme toggle button on `/login` (`dark` → `default`, persisted on reload) plus all 7 theme keys (`default`, `light`, `dark`, `blue`, `green`, `purple`, `warm-orange`) updating `data-theme`, `html.dark`, and `body` palette (`rgb(248,250,252)`, `rgb(255,255,255)`, `rgb(11,15,25)`, `rgb(7,13,30)`, `rgb(5,19,11)`, `rgb(13,5,23)`, `rgb(20,13,5)`) cleanly across reloads and navigation (`/` ↔ `/login`) with `overflowPx = 0`. Visual screenshots inspected (`home_desktop_1440x900_ar.png`, `home_mobile_390x844_ar.png`, `login_blue.png`, `login_light.png`, `login_warm-orange.png` in conversation scratch dir).
  - **FAIL (English LTR Text on Guest/Admin Login Pages):** Setting `preferred_language = 'en'` persisted `dir="ltr"` and `lang="en"` across reloads, **but** `/` displayed mixed Arabic/English headline text (`"التعليم الأكاديمي and Smart بمعايير رصينة،وتقنيات تقييم متقدمة no تقبل المساومة."`), `/admin/login` displayed Arabic headings (`"دخول إدارة المنظومة"`), and `/login` retained Arabic role subtitles.
  - **BLOCKED:** Authenticated post-login browser routes for all 6 institutional roles (`Primary Manager`, `Accountant`, `Teacher`, `Online Student`, `Center Student`, `Parent`) and `Admin` could not be entered without valid plaintext passwords or DB password modification.

---

## 7. Post-Activation Regression Suites (`In-Memory / Mocked`)

All regression suites were re-executed **after** Docker activation (`Execution Mode: Strictly In-Memory / Mocked`; live DB was never modified by these tests):

### 7.1 Backend Security & Counter Suites (`npx.cmd tsx`)

| Suite | Command | Exit Code | Result |
|---|---|---|---|
| Cross-Branch & Privilege Boundary (`user-service`) | `npx.cmd tsx test/crossBranchBackend.test.ts` | `0` | **59 Passed, 0 Failed** (24 scenarios) |
| Accounting Disbursement & Parent Children (`user-service`) | `npx.cmd tsx test/accountingDisbursementCounter.test.ts` | `0` | **7 Passed, 0 Failed** |
| Course Ownership Authorization (`course-service`) | `npx.cmd tsx course_ownership_authorization.test.ts` | `0` | **29 / 29 Scenarios Passed** |
| Socket.IO Security Isolation (`course-service`) | `npx.cmd tsx socket_security_isolation.test.ts` | `0` | **20 Passed, 0 Failed** |
| Student Pending Homework Count (`course-service`) | `npx.cmd tsx homework_pending_count.test.ts` | `0` | **9 Passed, 0 Failed** |
| Course Branch Ownership & Notification (`course-service`) | `npx.cmd tsx course_branch_ownership_and_notification.test.ts` | `0` | **18 Passed, 0 Failed** |

### 7.2 Frontend Vitest Regression Matrix (`npx.cmd vitest run --no-file-parallelism`)

- **Command:** `npx.cmd vitest run --no-file-parallelism src/app/test/SmartNotificationCounters.test.tsx src/app/test/RealtimeCounterLifecycle.test.tsx src/app/test/StateAwareOnboarding.test.tsx src/app/test/StudentCenterDashboard.test.tsx src/app/test/StudentOnlineDashboard.test.tsx src/app/test/ParentDashboard.test.tsx src/app/test/AccountantDashboard.test.tsx src/app/test/TeacherDashboard.test.tsx src/app/test/PrimaryManagerDashboard.test.tsx src/app/test/HomeworkPage.test.tsx src/app/test/CriticalThemeLifecycle.test.tsx src/app/test/SevenThemesVerification.test.tsx src/app/test/ComprehensiveLocalizationRemediation.test.tsx src/app/test/CrossBranchSecurityNegative.test.tsx src/app/test/TeacherBranchIdentity.test.tsx src/app/test/PrimaryManagerTeam.test.tsx src/app/test/CourseStatistics.test.tsx`
- **Exit Code:** `0` — **17 passed (17) files, 177 passed (177) tests, 0 failed, 0 skipped**:
  - `SmartNotificationCounters.test.tsx` (30), `StateAwareOnboarding.test.tsx` (15), `AccountantDashboard.test.tsx` (13), `ParentDashboard.test.tsx` (13), `RealtimeCounterLifecycle.test.tsx` (13), `TeacherDashboard.test.tsx` (12), `ComprehensiveLocalizationRemediation.test.tsx` (11), `PrimaryManagerDashboard.test.tsx` (11), `StudentCenterDashboard.test.tsx` (11), `StudentOnlineDashboard.test.tsx` (11), `PrimaryManagerTeam.test.tsx` (9), `TeacherBranchIdentity.test.tsx` (9), `CrossBranchSecurityNegative.test.tsx` (6), `CriticalThemeLifecycle.test.tsx` (5), `CourseStatistics.test.tsx` (3), `SevenThemesVerification.test.tsx` (3), `HomeworkPage.test.tsx` (2).

---

## 8. Files Changed During This Phase & Non-Destructive Rollback

### 8.1 Files Added / Updated in Workspace
- **Added:** `D:\OX-DIGITAL\Mathe\OX-DIGITAL-GITHUB\docker-compose.isolated-dev.override.yml` (isolated project override preventing legacy container/network/volume collisions).
- **Added:** `D:\OX-DIGITAL\Mathe\OX-DIGITAL-GITHUB\FINAL_PORT_8080_HANDOVER_AND_ISOLATED_LOCALHOST_ACTIVATION_REPORT.md` (this report).
- **Updated Build Outputs (`dist/`):** `packages/shared/dist`, `packages/database/dist`, `services/*/dist`, `apps/frontend/dist`. (Zero application source `.ts`/`.tsx` files modified; zero Git commits or mutations performed.)

### 8.2 Non-Destructive Rollback Instructions (Zero Volume Deletion)
To revert port `8080` ownership back without deleting or overwriting any Docker volume (`ox_digital_isolated_dev_pgdata` or any project volume):
1. Stop only the isolated stack containers (**do NOT pass `-v`**):
   ```powershell
   Set-Location "D:\OX-DIGITAL\Mathe\OX-DIGITAL-GITHUB"
   docker compose -p ox-digital-github-dev --env-file .env.production -f docker-compose.production.yml -f docker-compose.isolated-dev.override.yml stop
   ```
2. Optionally restart the preserved legacy Nginx container (if needed):
   ```powershell
   docker start f9547dd676f9e5e46e3e75987c9a3f2da333b1a4d0a22d5420d148c033fe0be6
   ```

---

## 9. Remaining Blockers & Open Issues
1. **[BLOCKED] Live Credentialed Login & Post-Login E2E Workflows:** Supply authorized plaintext development credentials (or authorize resetting/seeding non-production test passwords + sample `Homework`/`ExpenseVoucher`/`CourseEnrollment` fixtures in `ox_digital_dev_test`) to complete live authentication, authenticated 7-role browser navigation, two-account Socket.IO event propagation, and live counter/accounting/homework E2E checks.
2. **[FAIL] Auth Service `POST /api/auth/login` Zod / CORS `500` Handling:** Update `auth-service` error middleware to map `ZodError` (`role` required) to `400` and disallowed CORS origins to `403` rather than `500`.
3. **[FAIL] Guest/Admin Login English LTR Translations:** Complete English dictionary coverage for Landing Page (`/`), `/login` role descriptions, and `/admin/login` headings when `preferred_language = 'en'`.
4. **Host Note (`wslrelay.exe` IPv6 `[::1]:8080`):** Windows `wslrelay.exe` (PID `13368`) listens on `[::1]:8080`, while Nginx serves `127.0.0.1:8080` and `http://localhost:8080` cleanly over IPv4.

