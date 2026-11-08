# OX-DIGITAL Education — Runtime Recovery Initial Audit

**Date:** November 8, 2026  
**System:** OX-DIGITAL Education Platform  
**Target Workspace:** `D:\OX-DIGITAL\Mathe\OX-DIGITAL-GITHUB`  
**Execution Phase:** Phase A — Initial Read-Only Environment and Git Audit  
**Status:** **AUDIT COMPLETE — ALL TOPOLOGY, GIT & DOCKER CONSTRAINTS VERIFIED**

---

## 1. Executive Summary

This initial audit establishes the pre-modification state of the **OX-DIGITAL Education** platform prior to executing the runtime recovery, Docker connectivity validation, startup automation, and GitHub synchronization.

The immediate symptoms reported by the browser at `http://localhost:8080/` are:
```text
index-BDvkzBgg.js:872 Vite preload chunk failure after reload retry: Event
ReferenceError: Settings is not defined at AdminDashboard-DZjIzYjx.js:18:15811
```

The initial investigation confirms:
1. The project workspace is strictly `D:\OX-DIGITAL\Mathe\OX-DIGITAL-GITHUB`.
2. The Git remote points to the authorized repository `https://github.com/hosamsamer019/ox-digital-Education.git` on branch `main`.
3. Sibling platform AL-SADEN (`alsaden-*` containers) is active on port 80/443 and completely isolated.
4. The approved development database is `ox-digital-isolated-dev-postgres` on port `5433` (database `ox_digital_dev_test`). Port `5432` (`ox-digital-staging-postgres`) is strictly protected and untouched.
5. The runtime crash is localized to an undeclared icon reference `Settings` in `AdminDashboard.tsx`, which triggers module execution failure and cascading Vite preload chunk errors.

---

## 2. Project Architecture & Workspace Structure

### 2.1 Workspace Identity
- **Absolute Path:** `D:\OX-DIGITAL\Mathe\OX-DIGITAL-GITHUB`
- **Git Root:** `D:/OX-DIGITAL/Mathe/OX-DIGITAL-GITHUB`
- **Active Branch:** `main` (Tracking `origin/main`)
- **Remote URL:** `https://github.com/hosamsamer019/ox-digital-Education.git`

### 2.2 Application Components Inventory
- **Frontend SPA:** `apps/frontend/` (React 18 + Vite 5 + TypeScript + Tailwind CSS + Lucide React + KaTeX)
- **Backend Microservices:**
  - `services/auth-service/` (Port 4001): Authentication, JWT token issuance, login preference delivery.
  - `services/user-service/` (Port 4002): Profile, team, student management, and BRD Section 15 settings (`PUT /api/users/account/settings`).
  - `services/ai-service/` (Port 4003): Math engine and AI chatbot support.
  - `services/course-service/` (Port 4004): Courses, homework, exams, HLS video streaming, WebSocket support.
  - `services/analytics-service/` (Port 4005): Performance metrics, academic attendance logs.
  - `services/video-worker/` (Port 4006 / 4000): Video transcoding pipeline.
- **Reverse Proxy / Ingress:** `nginx/` (Listens on ports `8080` HTTP and `8443` HTTPS; routes API traffic to internal Docker services and `/` to `frontend:80`).
- **Shared Libraries & Database:**
  - `packages/shared/`: Shared TypeScript utilities, auth middlewares, tenant filters, accounting governance.
  - `packages/database/`: Prisma schema, migrations, and shared Prisma client.

### 2.3 Docker Compose Files
- `docker-compose.production.yml`: Main production Compose specification defining `ox-digital-*` containers under project name `ox-digital-education`.
- `docker-compose.staging.yml`: Staging topology.
- `docker-compose.dev-hls.yml`: HLS video streaming development composition.
- `docker-compose.yml`: Default development configuration.

### 2.4 Existing Launcher Scripts
- `start_server.bat`: Existing batch launcher verifying working directory, Docker availability, config sanity, and launching browser at `http://localhost:8080/`.
- `start.bat`: Secondary convenience launcher.
- `stop.bat`: Safe container shutdown script without volume deletion.
- `GITHUB_PULL.bat` / `GITHUB_PUSH.bat`: Pre-existing sync utilities.

---

## 3. Docker Topology & Service Connectivity Baseline

An inspection of active Docker containers confirms the operational topology:

| Container Name | Image Identity | Internal Port | Published Port | Health Status | Role in Topology |
| :--- | :--- | :---: | :---: | :---: | :--- |
| **`ox-digital-nginx`** | `nginx:alpine` | 80, 443 | `0.0.0.0:8080->80`<br>`0.0.0.0:8443->443` | Healthy | External ingress & reverse proxy |
| **`ox-digital-frontend`** | `ox-digital-education-frontend:latest`<br>(`sha256:bf364a707932`) | 80 | None (Internal) | Healthy | Serves built Vite static assets |
| **`ox-digital-user-service`** | `ox-digital-education-user-service:latest`<br>(`sha256:9a03fc03fb59`) | 4000 (mapped to 4002 via Nginx) | None (Internal) | Healthy | Core user & preference API |
| **`ox-digital-auth-service`** | `ox-digital-education-auth-service:latest`<br>(`sha256:987e5abe87e3`) | 4000 (mapped to 4001 via Nginx) | None (Internal) | Healthy | Authentication & JWT service |
| **`ox-digital-course-service`**| `ox-digital-education-course-service:latest` | 4000 (mapped to 4004 via Nginx) | None (Internal) | Healthy | Course, exam, content service |
| **`ox-digital-analytics-service`**| `ox-digital-education-analytics-service:latest` | 4000 (mapped to 4005 via Nginx) | None (Internal) | Healthy | Analytics & tracking |
| **`ox-digital-ai-service`** | `ox-digital-education-ai-service:latest` | 4000 (mapped to 4003 via Nginx) | None (Internal) | Healthy | AI math assistance |
| **`ox-digital-video-worker`** | `ox-digital-education-video-worker:latest` | 4000 (mapped to 4006 via Nginx) | None (Internal) | Healthy | Background video transcoder |
| **`ox-digital-redis`** | `redis:7-alpine` | 6379 | None (Internal) | Healthy | Session cache & rate limiting |
| **`ox-digital-isolated-dev-postgres`**| `postgres:15-alpine` | 5432 | `127.0.0.1:5433->5432` | Up | **Approved Dev Database** |
| **`ox-digital-staging-postgres`**| `postgres:15-alpine` | 5432 | `127.0.0.1:5432->5432` | Healthy | **Protected Staging DB (Do Not Touch)** |

### Strict Sibling Platform Isolation
The `alsaden-*` containers are running on ports 80/443 and belong to `Mathteachersmartplatform-main`. They are completely isolated and untouched.

---

## 4. Git Working Tree & Remote Audit

- **Git Remote:** `origin` -> `https://github.com/hosamsamer019/ox-digital-Education.git`
- **Head Commit:** `0500b93 docs: update README.md with OX-DIGITAL identity and developer credentials`
- **Divergence:** Working tree is clean with respect to tracked code; contains uncommitted markdown reports and previously modified frontend files awaiting regression verification and atomic commit.
- **Untracked / Preserved Items:** Existing documentation reports, test scripts, and backups are identified and preserved.

---

## 5. Mandatory Safety & Database Boundary Attestation

1. The approved development database `ox_digital_dev_test` on `127.0.0.1:5433` is running and intact.
2. Port `5432` (`ox-digital-staging-postgres`) is strictly protected against writes, migrations, seeds, or restarts.
3. No database migrations, `prisma db push`, resets, or seed operations will be executed.
4. Existing user accounts, passwords, and preferences in PostgreSQL will be preserved without modification.
