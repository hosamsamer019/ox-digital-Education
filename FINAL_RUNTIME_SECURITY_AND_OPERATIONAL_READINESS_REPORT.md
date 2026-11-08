# OX-DIGITAL Education — Final Runtime, Security & Operational Readiness Report

**Audit Date:** November 7, 2026 (`2026-11-07T12:07:00+02:00` / `2026-11-07T10:07:00Z`)  
**Audit Type:** Strictly Read-Only Independent Runtime, Security & Operational Verification  
**Authorized Workspace:** `D:\OX-DIGITAL\Mathe\OX-DIGITAL-GITHUB`  
**Authorized Development Database (Read-Only):** `127.0.0.1:5433` / `ox_digital_dev_test` (`ox-digital-isolated-dev-postgres`, volume `ox_digital_isolated_dev_pgdata`)  
**Previous Reference Report Audited:** [OPERATIONAL_GAP_CLOSURE_AND_BROWSER_TO_DATABASE_ACCEPTANCE_REPORT.md](file:///d:/OX-DIGITAL/Mathe/OX-DIGITAL-GITHUB/OPERATIONAL_GAP_CLOSURE_AND_BROWSER_TO_DATABASE_ACCEPTANCE_REPORT.md)

---

## 1. Executive Summary

This report presents the findings of a strictly **read-only** final verification of the OX-DIGITAL Education runtime environment following the November 7, 2026 operational gap closure and Browser-to-Database acceptance suite ([reports/browser_to_db_acceptance_results.json](file:///d:/OX-DIGITAL/Mathe/OX-DIGITAL-GITHUB/reports/browser_to_db_acceptance_results.json)). Zero source files, configurations, Docker containers, images, or database records were modified or restarted during this audit.

### Key Independent Findings

1. **Host/Daemon Reboot at `2026-11-07T09:53:21Z` Exposed a Critical Container Restart Policy Gap (`FAILED` / Operational Blocker Until Started):**
   - At `2026-11-07T09:53:21.470Z` (11 minutes before this read-only audit began), the host / Docker daemon restarted.
   - All 10 Compose-managed service containers (`ox-digital-nginx`, `ox-digital-frontend`, `ox-digital-user-service`, `ox-digital-auth-service`, `ox-digital-course-service`, `ox-digital-ai-service`, `ox-digital-analytics-service`, `ox-digital-video-worker`, `ox-digital-postgres`, `ox-digital-redis`) are configured with `RestartPolicy: "always"` and automatically recovered between `09:53:52Z` and `09:54:48Z` to `running (healthy)`.
   - **However**, the isolated development PostgreSQL container `ox-digital-isolated-dev-postgres` (`c45dfd885d9c`) was provisioned on `2026-11-05T10:16:00Z` with **`RestartPolicy: "no"`**. Consequently, when the host restarted at `09:53:21Z`, `ox-digital-isolated-dev-postgres` transitioned to `exited (255)` and **did not automatically restart**.
   - In strict compliance with the mission prohibition (*"Do not rebuild, recreate, restart, stop, commit, or replace any Docker container or image"*), `ox-digital-isolated-dev-postgres` was left untouched in its `exited` state. Its persistent named volume `ox_digital_isolated_dev_pgdata` remains intact and attached (`rw: true`), and its PostgreSQL WAL checkpoint logs (`00:03:00.153 UTC` and `00:07:59.758 UTC`) confirm clean data flushing after the disposable test database (`ox_digital_disposable_browser_e2e`) was dropped.

2. **Resolution of Container vs. Image Layer Discrepancy (`PARTIALLY VERIFIED` — Live Writable Layers Match 100%, Base Image IDs Diverge):**
   - The previous report referenced image names (`ox-digital-education-frontend:latest` and `ox-digital-education-user-service:latest`) alongside container names (`ox-digital-frontend` and `ox-digital-user-service`).
   - Direct `docker inspect` proves that `ox-digital-frontend` (`1134c46a864e`) is still linked to base Image ID `sha256:dee87c9c994f...` (`2026-11-05T16:22:47Z`) and `ox-digital-user-service` (`4c8852f8c08c`) is still linked to base Image ID `sha256:1cc962333590...` (`2026-11-05T18:14:41Z`). During gap closure, updated build files were injected into the running containers' writable `UpperDir` layers via `docker cp` and snapshot-committed to `ox-digital-education-frontend:latest` (`sha256:3e0518cd18c0...`, `2026-11-07T01:44:56+02:00`) and `ox-digital-education-user-service:latest` (`sha256:9ad290eaace5...`, `2026-11-07T01:06:59+02:00`) **without recreating the containers from the newly committed images**.
   - Because a container reboot preserves its writable `UpperDir` layer, **SHA-256 cryptographic hashes of the live files inside the running containers match the current workspace `dist/` build 100%** (`index.html`, `index-CYzFvhJl.js`, `AdminDashboard-DF4qAAtp.js`, `AccountantDashboard-DvIxUqhH.js`, `ManagerAccountsPage-7qwPxcG5.js`, `user.controller.js`, `brdSubscription.controller.js`, `brdSubscription.service.js`). However, if `docker compose up --force-recreate` is run without referencing the committed `:latest` images, or if old asset files in `/usr/share/nginx/html/assets` (`497` accumulated files vs `99` in workspace `dist/assets`) are not pruned, container state could drift.

3. **Workspace Independence & Auxiliary Container Mounts (`PARTIALLY VERIFIED`):**
   - `ox-digital-nginx` (`2c39d428aa75`) and `ox-digital-frontend` (`1134c46a864e`) were recreated from `D:\OX-DIGITAL\Mathe\OX-DIGITAL-GITHUB`, and `ox-digital-nginx` bind-mounts strictly `D:\OX-DIGITAL\Mathe\OX-DIGITAL-GITHUB\nginx\nginx.conf` (SHA-256 `8549E01B...`) and `D:\OX-DIGITAL\Mathe\OX-DIGITAL-GITHUB\nginx\ssl`.
   - Active backend microservices (`user-service`, `auth-service`, `course-service`, `ai-service`, `analytics-service`, `video-worker`) have **zero bind mounts** to the sibling directory, though their Docker Compose metadata labels (`com.docker.compose.project.working_dir`) still record `D:\OX-DIGITAL\Mathe\Mathteachersmartplatform-main` from their November 6 creation.
   - One auxiliary container, `ox-digital-pg-backup` (`f297ab47b434`), still actively bind-mounts `D:\OX-DIGITAL\Mathe\Mathteachersmartplatform-main\backups` and `...\scripts`.

---

## 2. Exact Runtime Container & Image Inventory

### 2.1 Active & Stopped OX-DIGITAL Containers (`docker inspect` Live Evidence)

| Container Name | Container ID | State / Health (`2026-11-07T10:00Z`) | Configured Image Ref | Underlying Image ID (`sha256`) | Container Created (UTC) | StartedAt / FinishedAt (UTC) | Restart Policy | Port Mapping |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `ox-digital-nginx` | `2c39d428aa75` | `running` (`healthy`) | `nginx:alpine` | `sha256:69AD98E80C32...` | `2026-11-06T22:55:27Z` | Started: `2026-11-07T09:53:52Z` | `always` | `8080->80`, `8443->443` |
| `ox-digital-frontend` | `1134c46a864e` | `running` (`healthy`) | `ox-digital-education-frontend` | `sha256:dee87c9c994f...` | `2026-11-05T16:37:41Z` | Started: `2026-11-07T09:54:47Z` | `always` | `80/tcp` (internal) |
| `ox-digital-user-service` | `4c8852f8c08c` | `running` (`healthy`) | `ox-digital-education-user-service` | `sha256:1cc962333590...` | `2026-11-06T15:49:27Z` | Started: `2026-11-07T09:53:52Z` | `always` | `3002/tcp` (internal) |
| `ox-digital-auth-service` | `2bf916578e0a` | `running` (`healthy`) | `ox-digital-education-auth-service` | `sha256:1414dc424c60...` | `2026-11-06T15:49:27Z` | Started: `2026-11-07T09:53:52Z` | `always` | `3001/tcp` (internal) |
| `ox-digital-course-service` | `c85aa260dbdd` | `running` (`healthy`) | `ox-digital-education-course-service` | `sha256:df21f87129f6...` | `2026-11-06T15:49:27Z` | Started: `2026-11-07T09:53:52Z` | `always` | `3003/tcp` (internal) |
| `ox-digital-ai-service` | `3b601cfbd7d7` | `running` (`healthy`) | `ox-digital-education-ai-service` | `sha256:20f857b42db0...` | `2026-11-06T15:49:27Z` | Started: `2026-11-07T09:53:52Z` | `always` | `3004/tcp` (internal) |
| `ox-digital-analytics-service` | `eb378cb01b9f` | `running` (`healthy`) | `ox-digital-education-analytics-service` | `sha256:c64720bc1b13...` | `2026-11-06T15:49:27Z` | Started: `2026-11-07T09:53:52Z` | `always` | `3005/tcp` (internal) |
| `ox-digital-video-worker` | `075ed82fd212` | `running` (`healthy`) | `ox-digital-education-video-worker` | `sha256:439da9b74401...` | `2026-11-06T15:49:27Z` | Started: `2026-11-07T09:53:52Z` | `always` | none |
| **`ox-digital-isolated-dev-postgres`** | `c45dfd885d9c` | **`exited (255)`** (`unhealthy`) | `postgres:15-alpine` | `sha256:6956fd4502bd...` | `2026-11-05T10:16:00Z` | **Finished: `2026-11-07T09:53:21Z`** | **`no`** | `127.0.0.1:5433->5432` |
| `ox-digital-redis` | `8db8b6db0dc1` | `running` (`healthy`) | `redis:7-alpine` | `sha256:ef8fccfc9035...` | `2026-11-01T14:53:47Z` | Started: `2026-11-07T09:53:52Z` | `always` | `127.0.0.1:6379->6379` |
| `ox-digital-pg-backup` | `f297ab47b434` | `running` (no healthcheck) | `postgres:15-alpine` | `sha256:6956fd4502bd...` | `2026-11-01T14:53:47Z` | Started: `2026-11-07T09:53:52Z` | `unless-stopped` | `5432/tcp` (internal) |

*(Note: Unrelated staging/legacy PostgreSQL containers `ox-digital-postgres` and `ox-digital-staging-postgres` on port `5432` were observed in `docker ps` Output Only and were strictly never accessed, queried, or inspected.)*

### 2.2 Local Docker Image Inventory & Layer Reconciliation (`docker image ls` / `docker image inspect`)

| Repository : Tag | Image ID (`sha256`) | Created Timestamp | Size | Relationship to Running Container |
| :--- | :--- | :--- | :--- | :--- |
| `ox-digital-education-frontend:latest` | `sha256:3e0518cd18c0e654d5b855560a819fe0e09d4af94917630f81624a8db806acfc` | `2026-11-07 01:44:56 +0200` | `97.9 MB` | Committed snapshot of `ox-digital-frontend` (`1134c46a864e`). Container still points to parent image `sha256:dee87c9c994f...` (`62.8 MB`, `2026-11-05 18:22:47 +0200`) + live writable layer. |
| `ox-digital-education-user-service:latest` | `sha256:9ad290eaace59fb316e9a50d2ab27be3d01db6833c6111bf4fa47ef0f0a4f1b2` | `2026-11-07 01:06:59 +0200` | `722 MB` | Committed snapshot of `ox-digital-user-service` (`4c8852f8c08c`). Container still points to parent image `sha256:1cc962333590...` (`722 MB`, `2026-11-05 20:14:41 +0200`) + live writable layer. |
| `ox-digital-education-auth-service:latest` | `sha256:1414dc424c601386f21a1f73f5b10715bf636120c32fb97188044e812fa66fa2` | `2026-11-06 16:08:52 +0200` | `724 MB` | Exact match with running `ox-digital-auth-service` (`2bf916578e0a`). |
| `ox-digital-education-course-service:latest` | `sha256:df21f87129f697cd4d8f2891bd6ca96cb8093007fa49aa5cf2d661b704a7d68d` | `2026-11-05 18:22:47 +0200` | `661 MB` | Exact match with running `ox-digital-course-service` (`c85aa260dbdd`). |
| `ox-digital-education-analytics-service:latest` | `sha256:c64720bc1b13b7236f5a44d7315bc2188240aaec7c2cfbc5d32826c1ac6d0230` | `2026-11-05 18:22:47 +0200` | `638 MB` | Exact match with running `ox-digital-analytics-service` (`eb378cb01b9f`). |
| `ox-digital-education-ai-service:latest` | `sha256:20f857b42db022b66c4cc0ab3965cc4b38672b6b08c996127d6bd050603e4aa2` | `2026-11-05 18:22:47 +0200` | `637 MB` | Exact match with running `ox-digital-ai-service` (`3b601cfbd7d7`). |
| `ox-digital-education-video-worker:latest` | `sha256:439da9b7440196e8c81b95c488f7932cc780440072009a1e60e557ebca36b2c2` | `2026-11-05 18:22:47 +0200` | `719 MB` | Exact match with running `ox-digital-video-worker` (`075ed82fd212`). |

### 2.3 Redacted Database Environment Wiring Across Running Microservices

Inspection of `Config.Env` across all 6 backend application containers (`user-service`, `auth-service`, `course-service`, `ai-service`, `analytics-service`, `video-worker`) confirmed identical database routing:
- `DATABASE_URL=postgresql://ox_dev_admin:[REDACTED]@ox-digital-isolated-dev-postgres:5432/ox_digital_dev_test?schema=public`
- `DIRECT_URL=postgresql://ox_dev_admin:[REDACTED]@ox-digital-isolated-dev-postgres:5432/ox_digital_dev_test?schema=public`

---

## 3. Frontend & Backend Version Consistency

**Classification:** `VERIFIED` (Live Container Files Match Workspace Build 100%) / `PARTIALLY VERIFIED` (Container Base Image Layer Hygiene)

### 3.1 Cryptographic SHA-256 Comparison (Workspace vs. Live Running Containers)

| Component / Artifact | Workspace Path (`D:\OX-DIGITAL\Mathe\OX-DIGITAL-GITHUB`) | Live Container Path | Workspace SHA-256 | Live Container SHA-256 | Match |
| :--- | :--- | :--- | :--- | :--- | :--- |
| Frontend Entry HTML | [apps/frontend/dist/index.html](file:///d:/OX-DIGITAL/Mathe/OX-DIGITAL-GITHUB/apps/frontend/dist/index.html) | `ox-digital-frontend:/usr/share/nginx/html/index.html` | `6BED222F99849520A9BB7FEA7D794F7F21DE632E3F5AA2CFB8273F88F53AE2B8` | `6BED222F99849520A9BB7FEA7D794F7F21DE632E3F5AA2CFB8273F88F53AE2B8` | **100% MATCH** |
| Main App Router Bundle | `apps/frontend/dist/assets/index-CYzFvhJl.js` | `ox-digital-frontend:/usr/share/nginx/html/assets/index-CYzFvhJl.js` | `A447B2B1B66FCBC609AA7B64C09F57DBCD2F14BB8996228F9C6994BA7E4AC308` | `A447B2B1B66FCBC609AA7B64C09F57DBCD2F14BB8996228F9C6994BA7E4AC308` | **100% MATCH** |
| Admin Dashboard Bundle | `apps/frontend/dist/assets/AdminDashboard-DF4qAAtp.js` | `ox-digital-frontend:/usr/share/nginx/html/assets/AdminDashboard-DF4qAAtp.js` | `D15E06865A5F72BE2B576C426FF5985202E8A98591DF66AA71DB0CA12E9C0C24` | `D15E06865A5F72BE2B576C426FF5985202E8A98591DF66AA71DB0CA12E9C0C24` | **100% MATCH** |
| Accountant Dashboard Bundle | `apps/frontend/dist/assets/AccountantDashboard-DvIxUqhH.js` | `ox-digital-frontend:/usr/share/nginx/html/assets/AccountantDashboard-DvIxUqhH.js` | `C90FB161D5BBF073F257F81450C8C34ED3ECAF14169878DF66081AC8590C2F2B` | `C90FB161D5BBF073F257F81450C8C34ED3ECAF14169878DF66081AC8590C2F2B` | **100% MATCH** |
| Nginx Gateway Config | [nginx/nginx.conf](file:///d:/OX-DIGITAL/Mathe/OX-DIGITAL-GITHUB/nginx/nginx.conf) | `ox-digital-nginx:/etc/nginx/nginx.conf` | `8549E01B583B28DD6CC803BAF6C586E02CD11DB681D9FCF748D490D1FCCAB9E5` | `8549E01B583B28DD6CC803BAF6C586E02CD11DB681D9FCF748D490D1FCCAB9E5` | **100% MATCH** |
| BRD Subscription Controller | `services/user-service/dist/.../brdSubscription.controller.js` | `ox-digital-user-service:/app/services/user-service/dist/.../brdSubscription.controller.js` | `4F8D4F9D646D01437E819023DDC292DD776C3EE77D60B1DC9A249F4A2EE14736` | `4F8D4F9D646D01437E819023DDC292DD776C3EE77D60B1DC9A249F4A2EE14736` | **100% MATCH** |
| User Controller | `services/user-service/dist/.../user.controller.js` | `ox-digital-user-service:/app/services/user-service/dist/.../user.controller.js` | `3498C9BB5EFEEEADC0E5FB9DA4485D5D176DA8ABC4C82A91F1C3F278B82B75AB` | `3498C9BB5EFEEEADC0E5FB9DA4485D5D176DA8ABC4C82A91F1C3F278B82B75AB` | **100% MATCH** |
| BRD Subscription Service | `services/user-service/dist/.../brdSubscription.service.js` | `ox-digital-user-service:/app/services/user-service/dist/.../brdSubscription.service.js` | `0D989390A067AD34229158E45E7A632C1457D4462E8130B089B2475122D699C9` | `0D989390A067AD34229158E45E7A632C1457D4462E8130B089B2475122D699C9` | **100% MATCH** |
| Shared Prisma Package | `packages/database/src/index.js` | `ox-digital-user-service:/app/packages/database/src/index.js` | `D74B856E18F541B945ABBC45B2CA8D59AF76A09945B4F547FF6D8EBC94479AA4` | `D74B856E18F541B945ABBC45B2CA8D59AF76A09945B4F547FF6D8EBC94479AA4` | **100% MATCH** |

### 3.2 Live Bundle Feature Verification Inside `ox-digital-frontend` and `ox-digital-user-service`

Direct inspection of the compiled JavaScript bundles inside the running containers confirmed that all reported gap-closure features are compiled and present in the active runtime:
- **Dynamic Branch Fetching & Removal of Hardcoded `BR-01` (`VERIFIED`):**
  - Chunk `ManagerAccountsPage-7qwPxcG5.js` and `user.service-cB2XncqY.js` contain `getManagerBranches` (`/api/manager/branches`), `invite-branch-select`, and `temporary-password-modal`.
  - Zero occurrences (`0`) of hardcoded mock branch `BR-01` exist in the active bundles (`hasMockBr01: false`).
- **One-Time Temporary Password Modal (`VERIFIED`):**
  - Present in `ManagerAccountsPage-7qwPxcG5.js` (`data-testid="temporary-password-modal"`, `data-testid="temporary-password-display"`) and wired to backend `temporaryPassword` response in [TeamManagementPage.tsx](file:///d:/OX-DIGITAL/Mathe/OX-DIGITAL-GITHUB/apps/frontend/src/app/components/admin/TeamManagementPage.tsx#L305-L348) and [AdminUsersPage.tsx](file:///d:/OX-DIGITAL/Mathe/OX-DIGITAL-GITHUB/apps/frontend/src/app/components/admin/AdminUsersPage.tsx#L316-L361).
- **CSV UTF-8 BOM & PDF Download Generation (`VERIFIED`):**
  - `AccountantDashboard-DvIxUqhH.js` inside `ox-digital-frontend` (`81,013` bytes) contains `\uFEFF` UTF-8 BOM, `text/csv;charset=utf-8;`, `jspdf` dynamic import, `export-excel-`, and `export-pdf-` triggers.
- **Toast Notification Wiring (`VERIFIED`):**
  - `AdminDashboard-DF4qAAtp.js` and `AccountantDashboard-DvIxUqhH.js` include `sonner` `toast.success` and `toast.error` notifications.
- **Legacy `/manager/*` Route Compatibility (`PARTIALLY VERIFIED`):**
  - `index-CYzFvhJl.js` inside `ox-digital-frontend` and [App.tsx](file:///d:/OX-DIGITAL/Mathe/OX-DIGITAL-GITHUB/apps/frontend/src/app/App.tsx#L196-L202) redirect `/manager`, `/manager/team`, `/manager/users`, `/manager/pricing`, `/manager/audit-logs`, `/manager/branches`, and `/manager/institutions` to their `/admin/*` equivalents.
  - **Gap Identified:** `/manager/finances` is **not** mapped in [App.tsx](file:///d:/OX-DIGITAL/Mathe/OX-DIGITAL-GITHUB/apps/frontend/src/app/App.tsx#L196-L202) (`hasManagerFinancesRedirect: false`). Navigating to `/manager/finances` hits the catch-all `* -> /` route instead of `/admin/finances`.

---

## 4. Nginx & Workspace Independence Verification

**Classification:** `PARTIALLY VERIFIED` (Gateway & Frontend 100% Independent; Auxiliary Backup Container Retains Sibling Bind Mount)

1. **`ox-digital-nginx` Gateway (`VERIFIED`):**
   - `com.docker.compose.project.working_dir`: `D:\OX-DIGITAL\Mathe\OX-DIGITAL-GITHUB`
   - Bind mounts:
     - `D:\OX-DIGITAL\Mathe\OX-DIGITAL-GITHUB\nginx\nginx.conf` -> `/etc/nginx/nginx.conf` (`ro`)
     - `D:\OX-DIGITAL\Mathe\OX-DIGITAL-GITHUB\nginx\ssl` -> `/etc/nginx/ssl` (`ro`)
   - Proxy routes verified in live `/etc/nginx/nginx.conf`:
     - `/api/manager/` -> `http://user_service/api/manager/`
     - `/api/accountant/` -> `http://user_service/api/accountant/`
     - `/api/parent/` -> `http://user_service/api/parent/`
     - `/api/teacher/` -> `http://user_service/api/teacher/`
     - `/api/student/` -> `http://user_service/api/student/`
   - Live HTTP probes through `http://localhost:8080`:
     - `GET /` -> `200 OK` (`X-Frame-Options: SAMEORIGIN`, `X-Content-Type-Options: nosniff`)
     - `GET /admin/login` -> `200 OK`
     - `GET /manager/team` -> `200 OK` (SPA entry HTML served cleanly)
     - `GET /api/users/health` -> `200 OK` (`{"status":"ok","service":"user-service"}`)
     - `GET /api/manager/branches` (unauthenticated) -> `401 Unauthorized` (`{"success":false,"message":"Authentication required"}`)
     - `GET /api/accountant/receipts` (unauthenticated) -> `401 Unauthorized` (`{"success":false,"message":"Authentication required"}`)
2. **Backend Microservice Containers (`PARTIALLY VERIFIED`):**
   - None of `user-service`, `auth-service`, `course-service`, `ai-service`, `analytics-service`, or `video-worker` have any filesystem bind mounts to `D:\OX-DIGITAL\Mathe\Mathteachersmartplatform-main`.
   - However, their Docker Compose label `com.docker.compose.project.working_dir` still records `D:\OX-DIGITAL\Mathe\Mathteachersmartplatform-main` because they were created on `2026-11-06T15:49:27Z` prior to workspace cutover.
3. **Auxiliary Container `ox-digital-pg-backup` (`FAILED` — Sibling Dependency Remains):**
   - `ox-digital-pg-backup` (`f297ab47b434`) still has active bind mounts to `D:\OX-DIGITAL\Mathe\Mathteachersmartplatform-main\backups` (`/backups`, `rw: true`) and `D:\OX-DIGITAL\Mathe\Mathteachersmartplatform-main\scripts` (`/scripts`, `rw: false`).

---

## 5. Authentication & Temporary-Password Lifecycle Verification

| Sub-Workflow / Security Control | Source & Compiled Bundle Evidence | Historical Disposable-DB Browser E2E Evidence (`2026-11-07T00:02Z`) | Current Live Container Verification (`2026-11-07T10:00Z`) | Classification |
| :--- | :--- | :--- | :--- | :--- |
| Staff creation generates temporary password & sets `mustChangePassword = true` | Verified in [user.controller.ts](file:///d:/OX-DIGITAL/Mathe/OX-DIGITAL-GITHUB/services/user-service/src/controllers/user.controller.ts#L502-L545) and live `ox-digital-user-service` `user.controller.js`. | Steps `A2`, `A3`, `A4` passed in [browser_to_db_acceptance_results.json](file:///d:/OX-DIGITAL/Mathe/OX-DIGITAL-GITHUB/reports/browser_to_db_acceptance_results.json). | Live backend container carries identical compiled JS (`SHA-256: 3498C9BB...`); live DB login currently blocked because `ox-digital-isolated-dev-postgres` is `exited`. | `PARTIALLY VERIFIED` |
| One-time temporary password modal shown in Manager UI | Verified in [TeamManagementPage.tsx](file:///d:/OX-DIGITAL/Mathe/OX-DIGITAL-GITHUB/apps/frontend/src/app/components/admin/TeamManagementPage.tsx#L305-L348), [AdminUsersPage.tsx](file:///d:/OX-DIGITAL/Mathe/OX-DIGITAL-GITHUB/apps/frontend/src/app/components/admin/AdminUsersPage.tsx#L316-L361), and live chunk `ManagerAccountsPage-7qwPxcG5.js`. | Steps `A2`, `A3`, `A4` verified modal visibility and non-empty temp password in headless Chromium. | Live `ox-digital-frontend` serves exact chunk `ManagerAccountsPage-7qwPxcG5.js`. | `VERIFIED` |
| First login with temporary password forces `/first-login/change-password` | Verified in [LoginPage.tsx](file:///d:/OX-DIGITAL/Mathe/OX-DIGITAL-GITHUB/apps/frontend/src/app/components/auth/LoginPage.tsx#L118-L125), [ProtectedRoute.tsx](file:///d:/OX-DIGITAL/Mathe/OX-DIGITAL-GITHUB/apps/frontend/src/app/components/auth/ProtectedRoute.tsx#L41-L48), and live `index-CYzFvhJl.js`. | Step `B1` passed: newly created Teacher redirected to `/first-login/change-password`. | Compiled frontend route guard verified in live container; live authenticated browser re-run blocked by stopped DB container. | `PARTIALLY VERIFIED` |
| Password change updates bcrypt hash & sets `mustChangePassword = false` | Verified in [auth.controller.ts](file:///d:/OX-DIGITAL/Mathe/OX-DIGITAL-GITHUB/services/auth-service/src/controllers/auth.controller.ts#L604-L660) (`bcrypt.hash(newPassword, 12)`, `mustChangePassword: false`). | Step `B1` verified DB state `mustChangePassword === false` after form submit. | Code verified; note that `auth.controller.ts` sets `mustChangePassword: false` and `passwordChangedAt: new Date()`, though `tempPasswordExpiresAt` is only cleared if present in user-service flows. | `PARTIALLY VERIFIED` |
| Old temporary password rejected (`401`) & new password succeeds (`200`) | Verified in [auth.controller.ts](file:///d:/OX-DIGITAL/Mathe/OX-DIGITAL-GITHUB/services/auth-service/src/controllers/auth.controller.ts#L195-L215) (`bcrypt.compare`). | Steps `B2` (`oldPassStatus=401`) and `B3` (re-login to `/teacher`) passed in disposable-DB E2E. | Not re-executed live during this read-only window because `ox-digital-isolated-dev-postgres` is `exited` post-reboot (`POST /api/auth/login` returns `500`). | `PARTIALLY VERIFIED` |

---

## 6. Financial CSV/PDF Download Verification

| Export Control | Source & Live Bundle Verification | Historical Disposable-DB Browser E2E Evidence | Live File Content Inspection Limitation | Classification |
| :--- | :--- | :--- | :--- | :--- |
| Accountant CSV Export (`export-excel-rpt-*`) | Verified in [AccountantReportsPage.tsx](file:///d:/OX-DIGITAL/Mathe/OX-DIGITAL-GITHUB/apps/frontend/src/app/components/accountant/AccountantReportsPage.tsx#L53-L99) and live `AccountantDashboard-DvIxUqhH.js` (`\uFEFF` UTF-8 BOM, `text/csv;charset=utf-8;`, Arabic headers, dynamic rows). | Step `D4` verified Playwright `download` event fired with filename `revenue-summary-2026-11-07.csv`. | Playwright `test_browser_to_database_acceptance.cjs` checked `csvDownload.suggestedFilename()` (`true`) but did **not** save the downloaded stream to disk or assert its byte size / row contents. Live browser download could not be re-triggered while DB container is stopped. | `PARTIALLY VERIFIED` |
| Accountant PDF Export (`export-pdf-rpt-*`) | Verified in [AccountantReportsPage.tsx](file:///d:/OX-DIGITAL/Mathe/OX-DIGITAL-GITHUB/apps/frontend/src/app/components/accountant/AccountantReportsPage.tsx#L101-L157) and live `AccountantDashboard-DvIxUqhH.js` (`import('jspdf')`, `doc.save(...)`). | Step `D4` verified Playwright `download` event fired with filename `revenue-summary-2026-11-07.pdf`. | Same limitation as CSV: the historical E2E script verified the browser download event and `.pdf` filename extension, but did not inspect `%PDF-` magic bytes on disk. Also note `jspdf` default Helvetica font does not embed an Arabic glyph shaper, so English/ASCII labels are used inside the PDF generator. | `PARTIALLY VERIFIED` |

---

## 7. Five-Role RBAC & Tenant-Isolation Results

| Role | Live Container & Source RBAC Verification | Disposable-DB Browser-to-Database E2E Evidence (`reports/browser_to_db_acceptance_results.json`) | Cross-Tenant / Negative Security Checks | Classification |
| :--- | :--- | :--- | :--- | :--- |
| **1. Manager (`ADMIN`)** | Live `ox-digital-user-service` enforces `authenticate` + `authorize('ADMIN')` on `/api/manager/*` and `BRANCH_TENANT_MISMATCH` (`403`) in `user.controller.js` (`SHA-256: 3498C9BB...`) and `brdSubscription.service.js` (`SHA-256: 0D989390...`). | Steps `A1–A6` passed: login, create Branch, create Teacher, create Accountant, create Student, create Parent & link student. | Step `G1` verified `403 BRANCH_TENANT_MISMATCH` when Manager attempted to assign a foreign institution's branch ID. | `PARTIALLY VERIFIED` (Verified in live code + disposable E2E; live DB offline post-reboot) |
| **2. Teacher (`TEACHER`)** | Live `course-service` and `user-service` scope teacher endpoints by `req.user.id` and `institutionId`. | Steps `C1–C3` passed: create Course, Homework, and Exam in UI and verify PostgreSQL rows. | Step `C4` verified Teacher navigation to `/admin/users` and `/accountant/receipts` is blocked by `ProtectedRoute`. | `PARTIALLY VERIFIED` |
| **3. Accountant (`ACCOUNTANT`)** | Live `accounting.routes.ts` / `brdSubscription.routes.ts` enforce `ACCOUNTANT` / `ADMIN` role guards and branch-scoped receipt generation (`REC-YYYYMMDD-XXXXXX`). | Steps `D1–D4` passed: record Cash Payment (`1200 EGP`), verify `REC-20261107-000001` & journal entry, record Expense (`250 EGP`), trigger CSV/PDF exports. | Step `D5` verified Accountant navigation to `/teacher/exams` and `/admin/institutions` is blocked (`blockedTeacher=true, blockedAdmin=true`). | `PARTIALLY VERIFIED` |
| **4. Student (`STUDENT`)** | Live `brdSubscription.controller.js` and `course-service` gate paid content until enrollment status is `ACTIVE`. | Steps `E1–E3` passed: enrolled course visible, homework submitted (`homeworkSubmission` persisted), exam submitted (`examAttempt` persisted). | Step `E4` verified Student navigation to `/admin` and `/accountant` is blocked (`blockedAdmin=true, blockedAccountant=true`). | `PARTIALLY VERIFIED` |
| **5. Parent (`PARENT`)** | Live `/api/parent/*` endpoints scope queries strictly to `ParentStudent` links for `req.user.id`. | Steps `F1–F2` passed: linked child attendance/grades/homework visible; payment history and receipt `REC-20261107-000001` visible. | Step `F3` verified Parent navigation to `/admin` and `/teacher` is blocked (`blockedAdmin=true, blockedTeacher=true`). | `PARTIALLY VERIFIED` |

---

## 8. Persistence Evidence & Runtime Restart Findings

**Classification:** `FAILED` (Database Container Restart Policy Gap) / `VERIFIED` (Frontend & Application Container Writable Layer Persistence Across Reboot)

1. **Unplanned Host Reboot Provided a Real-World Persistence Test at `2026-11-07T09:53:21Z`:**
   - At `2026-11-07T09:53:21.470Z`, the host machine / Docker daemon restarted.
   - **Application & Gateway Containers (`VERIFIED`):** `ox-digital-nginx`, `ox-digital-frontend`, `ox-digital-user-service`, `ox-digital-auth-service`, `ox-digital-course-service`, `ox-digital-ai-service`, `ox-digital-analytics-service`, `ox-digital-video-worker`, and `ox-digital-redis` all had `RestartPolicy: "always"` and automatically restarted at `09:53:52Z–09:54:47Z`. Crucially, `ox-digital-frontend` and `ox-digital-user-service` retained their updated files across the reboot, as proven by the SHA-256 hashes in Section 3.1.
   - **Isolated Development Database Container (`FAILED`):** `ox-digital-isolated-dev-postgres` (`c45dfd885d9c`) had `RestartPolicy: {"Name": "no", "MaximumRetryCount": 0}`. When the daemon stopped at `2026-11-07T09:53:21.470Z`, the container exited (`ExitCode: 255`) and **remained stopped** when Docker came back up.
2. **Volume & WAL Persistence Proof (`VERIFIED`):**
   - `docker volume inspect ox_digital_isolated_dev_pgdata` confirms the volume created at `2026-11-05T10:16:00Z` is mounted at `/var/lib/docker/volumes/ox_digital_isolated_dev_pgdata/_data` and bound to `ox-digital-isolated-dev-postgres:/var/lib/postgresql/data` (`rw: true`).
   - Inspection of the container logs (`docker logs --tail 30 ox-digital-isolated-dev-postgres`) confirms clean PostgreSQL checkpoints completed at `2026-11-07 00:03:00.153 UTC` (`wrote 978 buffers (6.0%); 1 WAL file(s) added`) and `2026-11-07 00:07:59.758 UTC` (`wrote 3 buffers (0.0%)`)—over 9 hours before the host reboot—ensuring zero un-flushed transactions in `ox_digital_dev_test`.

---

## 9. Current Retained Database Inventory & Preservation Proof

**Classification:** `PARTIALLY VERIFIED` (Pre-Reboot Preservation & WAL Checkpoints Verified; Live SQL Query Blocked While `ox-digital-isolated-dev-postgres` Is `exited`)

Because `ox-digital-isolated-dev-postgres` exited during the `2026-11-07T09:53:21Z` host reboot and mission rules strictly forbid starting or restarting any container (`Never restart the retained development database or any active service`), live SQL queries against `127.0.0.1:5433` at `10:00Z` returned `Can't reach database server at 127.0.0.1:5433`.

However, combining:
1. The post-cleanup baseline ([APPROVED_SYNTHETIC_CLEANUP_EXECUTION_REPORT.md](file:///d:/OX-DIGITAL/Mathe/OX-DIGITAL-GITHUB/APPROVED_SYNTHETIC_CLEANUP_EXECUTION_REPORT.md)),
2. The post-disposable-E2E verification of `ox_digital_dev_test` at `2026-11-07T00:03:00Z` ([reports/browser_to_db_acceptance_results.json](file:///d:/OX-DIGITAL/Mathe/OX-DIGITAL-GITHUB/reports/browser_to_db_acceptance_results.json#L139-L152)), and
3. The `ox-digital-isolated-dev-postgres` server logs from `00:03:00Z` until shutdown at `09:53:21Z` (showing zero subsequent writes and a clean 3-buffer checkpoint at `00:07:59.758 UTC`),

establishes the retained state of `ox_digital_dev_test`:

### 9.1 Retained Record Counts in `ox_digital_dev_test`

| Entity / Table | Retained Count | Detailed Inventory & Preservation Status |
| :--- | :---: | :--- |
| `Institution` | **2** | `inst_canonical_ox_edu_2026` (Canonical OX-DIGITAL Education) + `inst_idor_a_w4adp2` (Retained secondary institution) |
| `Branch` | **4** | `DK-01` (`فرع الدقي الرئيسي`), `اختبار` (`4444`), `رتا` (`125`), and `br_idor_a_w4adp2` (`Branch A`) |
| `User` | **4** | `admin@edu.com` (`ADMIN`, Primary Manager), `teacher@gmail.com` (`TEACHER`), `acount@gmail.com` (`ACCOUNTANT`), `acount1@gmail.com` (`ACCOUNTANT`) |
| `Cashbox` | **1** | Canonical main cashbox (`Cashbox` count = `1`) |
| `TeacherGradePricing` | **2** | 2 preserved grade pricing rows for `teacher@gmail.com` |
| `Course` / `Lesson` | **0** | Clean (`0` synthetic courses remaining) |
| `Exam` / `ExamAttempt` | **0** | Clean (`0` synthetic exams remaining) |
| `Homework` / `HomeworkSubmission` | **0** | Clean (`0` synthetic homeworks remaining) |
| `BrdPayment` / `PaymentTransaction` | **0** | Clean (`0` test payments in retained DB) |
| `BrdOfficialReceipt` / `OfficialReceipt` | **0** | Clean (`0` test receipts in retained DB) |
| `OperationalExpense` / `JournalEntry` | **0** | Clean (`0` test expenses/journals in retained DB) |
| Disposable Clone `ox_digital_disposable_browser_e2e` | **DROPPED (`0`)** | Verified dropped via `DROP DATABASE IF EXISTS "ox_digital_disposable_browser_e2e" WITH (FORCE)` prior to the `00:03:00.153 UTC` checkpoint. |

---

## 10. BRD-to-Implementation Reconciliation

Reference Document: [BRD_REALIGNMENT_AND_IMPLEMENTATION_FINAL_REPORT.md](file:///d:/OX-DIGITAL/Mathe/OX-DIGITAL-GITHUB/BRD_REALIGNMENT_AND_IMPLEMENTATION_FINAL_REPORT.md)

| # | Authoritative BRD Requirement | Implementation & Runtime Status | Evidence | Classification |
| :-: | :--- | :--- | :--- | :--- |
| 1 | Exact 5-role model (`ADMIN`/Manager, `TEACHER`, `ACCOUNTANT`, `STUDENT`, `PARENT`) | Enforced in Prisma schema, JWT auth claims, `ProtectedRoute.tsx`, and backend route guards. | [ProtectedRoute.tsx](file:///d:/OX-DIGITAL/Mathe/OX-DIGITAL-GITHUB/apps/frontend/src/app/components/auth/ProtectedRoute.tsx), `test_roles_full_matrix.cjs` | `VERIFIED` |
| 2 | Primary Manager protection (`isPrimaryManager` cannot be deleted/demoted by secondary managers) | Enforced in `user.controller.ts` (`deleteUser`, `updateUser`) and `manager.routes.ts`. | [user.controller.ts](file:///d:/OX-DIGITAL/Mathe/OX-DIGITAL-GITHUB/services/user-service/src/controllers/user.controller.ts), `unified_administrator_canonical_account.test.ts` | `VERIFIED` |
| 3 | One-time temporary password display & mandatory first-login password change (`mustChangePassword`) | Modal implemented in `TeamManagementPage.tsx` and `AdminUsersPage.tsx`; forced redirect to `/first-login/change-password` in `LoginPage.tsx` & `ProtectedRoute.tsx`. | Live chunk `ManagerAccountsPage-7qwPxcG5.js`, `index-CYzFvhJl.js`, Steps `A2–B3` | `VERIFIED` |
| 4 | Teacher/Student/Course/Exam/Homework ownership (`teacherId`, `institutionId`, `branchId`) | Enforced across `course-service` and `user-service` controllers; verified in disposable E2E (`C1–C3`). | [brdSubscription.service.ts](file:///d:/OX-DIGITAL/Mathe/OX-DIGITAL-GITHUB/services/user-service/src/services/brdSubscription.service.ts) | `VERIFIED` |
| 5 | `TeacherGradePricing` uniqueness per `(institutionId, branchId, teacherId, gradeLevel)` | Enforced in Prisma schema unique constraint and `brdSubscription.service.ts` (`upsertTeacherGradePricing`). | `services/user-service/src/services/brdSubscription.service.ts` | `VERIFIED` |
| 6 | Subject/Course enrollment subscription lifecycle (`PENDING_PAYMENT` -> `ACTIVE` -> `EXPIRED`) | Enforced in `brdSubscription.service.ts` (`recordBrdPayment` activates `SubjectEnrollment`). | Steps `D1`, `D2`, `E1` in `browser_to_db_acceptance_results.json` | `VERIFIED` |
| 7 | Official sequential receipt generation (`REC-YYYYMMDD-XXXXXX`) | Enforced transactionally via `ReceiptSequence` in `brdSubscription.service.ts` and `receipt.service.ts`. | Live `brdSubscription.service.js` (`SHA-256: 0D989390...`), Step `D2` | `VERIFIED` |
| 8 | Append-only accounting ledger & reversal-only adjustments | Enforced in `ledger.service.ts` and `accounting.controller.ts` (no destructive delete/update on posted journal entries). | `services/user-service/src/services/accounting/ledger.service.ts` | `VERIFIED` |
| 9 | Operational expense recording & cashbox integration | Enforced in `brdSubscription.controller.ts` (`createExpense`) and `AccountantExpensesPage.tsx`. | Step `D3` (`OperationalExpense` `250 EGP` persisted) | `VERIFIED` |
| 10 | Financial reporting & working CSV/PDF exports | CSV (`\uFEFF` UTF-8 BOM) and PDF (`jspdf`) implemented in [AccountantReportsPage.tsx](file:///d:/OX-DIGITAL/Mathe/OX-DIGITAL-GITHUB/apps/frontend/src/app/components/accountant/AccountantReportsPage.tsx) and deployed in `AccountantDashboard-DvIxUqhH.js`. | Live `AccountantDashboard-DvIxUqhH.js` (`SHA-256: C90FB161...`), Step `D4` | `PARTIALLY VERIFIED` (See Section 6 note on PDF Arabic shaping & file byte check) |
| 11 | Strict multi-tenant & branch isolation (`BRANCH_TENANT_MISMATCH`) | Enforced in `user.controller.ts` (`createUser`, `updateUser`) and `brdSubscription.service.ts` (`validateBranchTenancy`). | Live `user.controller.js` & `brdSubscription.service.js`, Step `G1` (`403`) | `VERIFIED` |
| 12 | Parent-to-Student scoped visibility (`ParentStudent` relationship) | Enforced in `brdSubscription.controller.ts` (`getParentChildrenOverview`, `getParentReceipts`). | Steps `A6`, `F1`, `F2` in `browser_to_db_acceptance_results.json` | `VERIFIED` |
| 13 | Monthly renewal / expiration job & student access lockout | Implemented in `services/user-service/src/jobs/subscriptionRenewal.job.ts` and academic eligibility middleware. | `test_brd_full_acceptance.cjs`, `test_scheduler_and_isolation.cjs` | `VERIFIED` |

---

## 11. All Failures, Warnings, and Unverified Items

| ID | Severity | Classification | Item / Finding | Impact |
| :--- | :---: | :---: | :--- | :--- |
| **F-01** | **HIGH** | `FAILED` | **`ox-digital-isolated-dev-postgres` has `RestartPolicy: "no"` and is currently `exited (255)` after the `2026-11-07T09:53:21Z` host reboot.** | All live database-backed API endpoints (`POST /api/auth/login`, etc.) currently return `500` until `docker start ox-digital-isolated-dev-postgres` is run and its restart policy is updated to `unless-stopped` or `always`. |
| **F-02** | **MEDIUM** | `FAILED` | **Auxiliary container `ox-digital-pg-backup` (`f297ab47b434`) still bind-mounts `D:\OX-DIGITAL\Mathe\Mathteachersmartplatform-main\backups` and `\scripts`.** | Violates complete runtime decoupling from the sibling folder `Mathteachersmartplatform-main`. |
| **W-01** | **MEDIUM** | `PARTIALLY VERIFIED` | **Running containers `ox-digital-frontend` (`1134c46a864e`) and `ox-digital-user-service` (`4c8852f8c08c`) serve updated code from their writable `UpperDir` layers rather than being recreated from their committed `:latest` images (`3e0518cd18c0` and `9ad290eaace5`).** | Works across `docker restart` / host reboots, and live file SHA-256 hashes match workspace `dist/` 100%, but `/usr/share/nginx/html/assets` has `497` accumulated files (vs `99` in local `dist/assets`), and `docker compose up --force-recreate` must use the committed `:latest` images to avoid reverting to November 5 base layers. |
| **W-02** | **LOW** | `PARTIALLY VERIFIED` | **Backend microservice containers retain `com.docker.compose.project.working_dir = D:\OX-DIGITAL\Mathe\Mathteachersmartplatform-main` in Docker metadata labels.** | Cosmetic metadata from their `2026-11-06T15:49Z` creation; they have zero filesystem bind mounts to the sibling directory. |
| **W-03** | **LOW** | `PARTIALLY VERIFIED` | **Legacy route `/manager/finances` is not explicitly redirected to `/admin/finances` in `App.tsx`.** | Other `/manager/*` routes (`/manager/team`, `/manager/users`, `/manager/pricing`, `/manager/branches`, `/manager/institutions`, `/manager/audit-logs`) redirect properly, whereas `/manager/finances` falls through to `/`. |
| **W-04** | **LOW** | `PARTIALLY VERIFIED` | **PDF Export uses default `jspdf` Helvetica font without an embedded Arabic font file, and historical E2E verified the browser `download` event/filename without asserting on-disk file byte contents.** | CSV export includes `\uFEFF` UTF-8 BOM for full Arabic Excel support; PDF export uses English/ASCII labels so text renders cleanly without garbled Arabic glyphs. |
| **U-01** | **INFO** | `NOT VERIFIED` (Live Post-Reboot) | **Live post-reboot authenticated browser execution against `127.0.0.1:5433`.** | Verified pre-reboot at `2026-11-07T00:02:51Z` in `browser_to_db_acceptance_results.json` (`24 PASSED, 0 FAILED`), and live container JS bundles were verified via SHA-256 hashes at `10:00Z`, but live authenticated requests could not be re-run after `09:53:21Z` without violating the read-only prohibition against starting `ox-digital-isolated-dev-postgres`. |

---

## 12. Evidence References for Every Major Conclusion

1. **Live Container, Image, Mount, and SHA-256 Artifact Hash Inspection (`2026-11-07T09:59Z`):**
   - `C:\Users\Hossam\.gemini\antigravity\brain\66dd16e7-da62-4347-b377-62b3991fb234\scratch\runtime_and_db_inspection.json`
2. **Live HTTP Gateway Probes, Redacted Container `Config.Env`, Volume Inspection, and PostgreSQL WAL Checkpoint Logs (`2026-11-07T10:01Z`):**
   - `C:\Users\Hossam\.gemini\antigravity\brain\66dd16e7-da62-4347-b377-62b3991fb234\scratch\live_endpoints_and_env.json`
3. **Live Container Compiled Bundle Feature & Auth Source Verification (`2026-11-07T10:06Z`):**
   - `C:\Users\Hossam\.gemini\antigravity\brain\66dd16e7-da62-4347-b377-62b3991fb234\scratch\bundle_and_auth_checks.json`
   - `C:\Users\Hossam\.gemini\antigravity\brain\66dd16e7-da62-4347-b377-62b3991fb234\scratch\code_and_brd_checks.json`
4. **Historical Disposable-Clone Browser-to-Database Acceptance Results (`2026-11-07T00:02:51Z`):**
   - [reports/browser_to_db_acceptance_results.json](file:///d:/OX-DIGITAL/Mathe/OX-DIGITAL-GITHUB/reports/browser_to_db_acceptance_results.json)
   - [scripts/test_browser_to_database_acceptance.cjs](file:///d:/OX-DIGITAL/Mathe/OX-DIGITAL-GITHUB/scripts/test_browser_to_database_acceptance.cjs)
5. **Authoritative BRD & Cleanup Baseline Reports:**
   - [BRD_REALIGNMENT_AND_IMPLEMENTATION_FINAL_REPORT.md](file:///d:/OX-DIGITAL/Mathe/OX-DIGITAL-GITHUB/BRD_REALIGNMENT_AND_IMPLEMENTATION_FINAL_REPORT.md)
   - [APPROVED_SYNTHETIC_CLEANUP_EXECUTION_REPORT.md](file:///d:/OX-DIGITAL/Mathe/OX-DIGITAL-GITHUB/APPROVED_SYNTHETIC_CLEANUP_EXECUTION_REPORT.md)

---

## 13. Prioritized List of Remaining Issues Requiring Separate Authorization

Before beginning live client data entry, the platform owner should authorize the following minimal operational commands:

1. **Priority 1 (Immediate Operational Requirement — Start Isolated Dev DB & Enable Auto-Restart):**
   - Run:
     ```powershell
     docker update --restart unless-stopped ox-digital-isolated-dev-postgres
     docker start ox-digital-isolated-dev-postgres
     ```
   - **Why:** Ensures `ox-digital-isolated-dev-postgres` (`127.0.0.1:5433`) is running and automatically recovers after any future Windows host or Docker Desktop restart.

2. **Priority 2 (Container Layer Hygiene — Recreate Frontend & User-Service from Committed `:latest` Images):**
   - Recreate `ox-digital-frontend` and `ox-digital-user-service` directly from `ox-digital-education-frontend:latest` (`sha256:3e0518cd18c0...`) and `ox-digital-education-user-service:latest` (`sha256:9ad290eaace5...`), and clean old asset chunks in `/usr/share/nginx/html/assets`.
   - **Why:** Eliminates the base-image ID vs. writable-layer discrepancy and ensures container recreation cannot revert to November 5 base layers.

3. **Priority 3 (Workspace Decoupling Cleanup — Remove/Recreate `ox-digital-pg-backup`):**
   - Stop/remove `ox-digital-pg-backup` (`f297ab47b434`) or re-point its `/backups` and `/scripts` bind mounts to `D:\OX-DIGITAL\Mathe\OX-DIGITAL-GITHUB`.
   - **Why:** Eliminates the last active container bind mount referencing `D:\OX-DIGITAL\Mathe\Mathteachersmartplatform-main`.

4. **Priority 4 (Minor UI Polish — Add `/manager/finances` Redirect & Optional Arabic PDF Font):**
   - Add `<Route path="/manager/finances" element={<Navigate to="/admin/finances" replace />} />` in [App.tsx](file:///d:/OX-DIGITAL/Mathe/OX-DIGITAL-GITHUB/apps/frontend/src/app/App.tsx#L196-L202) and optionally embed an Arabic `.ttf` font (e.g., Cairo/Amiri) in `AccountantReportsPage.tsx` for native Arabic glyphs inside exported PDFs.

---

## Final Verdicts

### Verdict A — Development Data Entry Readiness: **`APPROVED WITH PRECAUTIONS`**

- **Justification:**
  - The retained development database (`ox_digital_dev_test` on volume `ox_digital_isolated_dev_pgdata`) is clean, uncorrupted, and preserved with its exact canonical post-cleanup baseline (`2` institutions, `4` branches, `4` users, `1` cashbox, `2` teacher grade pricings, `0` synthetic courses/exams/homeworks/payments/receipts).
  - The live running `ox-digital-frontend`, `ox-digital-nginx`, and `ox-digital-user-service` containers contain the exact SHA-256-verified build artifacts from `D:\OX-DIGITAL\Mathe\OX-DIGITAL-GITHUB` (including dynamic `/api/manager/branches` selection, one-time temporary password modal, mandatory first-login password change, and cross-tenant branch protection).
  - **Mandatory Precaution Before Entry:** Because `ox-digital-isolated-dev-postgres` was created with `RestartPolicy: "no"` and exited during the `2026-11-07T09:53:21Z` host reboot, the owner must run `docker update --restart unless-stopped ox-digital-isolated-dev-postgres && docker start ox-digital-isolated-dev-postgres` before logging in.

### Verdict B — Real Financial and Subscription Operations Readiness: **`APPROVED WITH LIMITATIONS`**

- **Justification:**
  - Core financial and subscription workflows—including `SubjectEnrollment` activation (`PENDING_PAYMENT` -> `ACTIVE`), sequential official receipt numbering (`REC-YYYYMMDD-XXXXXX`), double-entry journal posting, operational expense recording, parent receipt visibility, and strict role/tenant isolation (`403 BRANCH_TENANT_MISMATCH`)—are verified in the live compiled backend (`brdSubscription.service.js` SHA-256 `0D989390...`) and passed all 24 Browser-to-Database E2E checks against the disposable clone.
  - **Documented Operational Limitations:**
    1. `ox-digital-isolated-dev-postgres` must be started and given an automatic restart policy (`unless-stopped` or `always`) so financial operations are not interrupted by host restarts.
    2. `ox-digital-frontend` and `ox-digital-user-service` should be recreated from their committed `:latest` images (or rebuilt cleanly via `docker compose build`) so future container recreation preserves the deployed fixes.
    3. Accountant CSV export supports full Arabic text in Excel via UTF-8 BOM (`\uFEFF`), whereas PDF export currently renders ASCII/English report headers/columns due to standard `jspdf` font support.

