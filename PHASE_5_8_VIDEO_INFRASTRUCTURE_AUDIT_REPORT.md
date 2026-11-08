# OX-DIGITAL Education — Phase 5.8
# Video Infrastructure Audit, Root Cause Analysis & Controlled Remediation Report

**Date:** November 1, 2026  
**Repository:** `D:\OX-DIGITAL\Mathe\OX-DIGITAL-GITHUB`  
**Target Environment:** Local Docker Compose Runtime (`http://localhost:8080/`)  
**Status:** Audit & Safe Testing Complete (Stage A, B, C Complete — Awaiting Stage D Gate Approval)

---

## 1. Executive Summary

A comprehensive, non-destructive audit and safe diagnostic testing suite was executed across the entire OX-DIGITAL video subsystem, encompassing Docker containers, configuration parameters, BullMQ queues, backend API endpoints, PostgreSQL schema alignment, and frontend video player integration.

### High-Level Summary of Findings:
1. **Container Crash Loop (`ox-digital-video-worker`)**: The background video processing worker container is trapped in an infinite crash loop (exit code 1 every ~60 seconds with `restart: always`). The process terminates at startup due to strict fatal checks requiring non-empty values for `CLOUDFLARE_R2_ENDPOINT`, `CLOUDFLARE_R2_ACCESS_KEY_ID`, and `CLOUDFLARE_R2_SECRET_ACCESS_KEY`, which are currently defined as empty strings in `.env.production`.
2. **Database Schema Divergence in Prisma Client (`Lesson.mediaGeneration`)**: Both the HLS streaming gateway endpoint (`GET /api/courses/lessons/:id/hls/master.m3u8`) and the recurring risk engine job (`riskEngine.job.ts`) crash with Prisma error code `P2022` (`column Lesson.mediaGeneration does not exist in the current database`). This occurs because the generated Prisma client includes `mediaGeneration` from unapplied migration scripts (`20261026_processed_media`), while the live PostgreSQL database was never migrated to add this column.
3. **Database Table Incompatibility in Worker (`ProcessedMedia`)**: The video worker's Google Drive ingestion handler (`processDriveIngestionJob`) queries `db.processedMedia.findUnique`. However, the table `ProcessedMedia` does not exist in the live database schema, meaning any Drive ingestion job handled by the worker would immediately fail with a database fatal error.
4. **Current Playback Functionality Status**:
   - **YouTube Playback**: **Fully Operational (100%)**. Tickets are successfully issued (`GET /api/courses/lessons/:id/video-ticket`), and streams redirect via HTTP 302 to YouTube, rendered by the frontend `UnifiedVideoPlayer` iframe.
   - **Google Drive Playback**: **Fully Operational (100%)**. The backend proxy stream (`GET /api/courses/lessons/:id/stream`) issues tickets and successfully streams chunked binary MP4 data via HTTP 206 Partial Content range requests.
   - **HLS Native Transcoded Playback**: **Blocked (0%)**. Blocked by missing HLS assets, missing R2 configuration, and the Prisma query crash on `Lesson.mediaGeneration` in `streamLessonHls`.

---

## 2. Findings Matrix

| ID | Component | Severity | Description | Evidence & Root Cause | Direct Impact | Recommended Action |
|---|---|---|---|---|---|---|
| **F-01** | `video-worker` | **CRITICAL** | Worker container continuously exits and restarts (exit code 1). | `services/video-worker/src/index.ts` lines 31-35 logs `[FATAL] video-worker missing required environment variables: CLOUDFLARE_R2_ENDPOINT...` and calls `process.exit(1)`. Empty strings in `.env.production`. | Container burns CPU/log resources cycling every 60s; completely blocks async video transcoding and background Google Drive ingestion. | Update worker startup logic to support standby/graceful fallback mode when R2 is unconfigured, or provide valid R2 credentials. |
| **F-02** | `course-service` | **HIGH** | HLS streaming gateway returns HTTP 500 on all lessons. | `services/course-service/src/controllers/course.controller.ts` line 1561 (`streamLessonHls`) invokes `(db as any).lesson.findUnique({ where: { id }, include: { course: true } })` without an explicit `select` projection. Prisma attempts to select non-existent column `mediaGeneration`, triggering `P2022`. | HLS streaming cannot serve manifest or media segments; client receives 500 error instead of clean fallback or 404. | Update `streamLessonHls` in `course.controller.ts` to use explicit column projection excluding `mediaGeneration`. |
| **F-03** | `course-service` | **HIGH** | `RiskEngine` scheduled job fails every minute with database error. | `services/course-service/src/jobs/riskEngine.job.ts` line 48 invokes `prisma.courseEnrollment.findMany({ include: { course: { include: { lessons: true } } } })`. Prisma selects non-existent column `Lesson.mediaGeneration`. | Logs are flooded with `[RiskEngine] Job repeat:... failed with error: column Lesson.mediaGeneration does not exist`. Academic risk calculations fail to complete. | Add explicit `select` projections to `riskEngine.job.ts` or ensure queries only select physical database columns. |
| **F-04** | `video-worker` | **HIGH** | Missing `ProcessedMedia` table in live PostgreSQL database. | `services/video-worker/src/index.ts` line 932 calls `db.processedMedia.findUnique`. Table `ProcessedMedia` does not exist in live DB (migration `20261026_processed_media` pending). | If a Drive ingestion job is enqueued, worker will throw fatal Prisma `P2021` (`table does not exist`) error. | Guard or align worker database queries with the live database schema without destructive migrations. |
| **F-05** | `.env.production` | **MEDIUM** | Incomplete Cloudflare R2 and video service environment variables. | `CLOUDFLARE_R2_ENDPOINT`, `CLOUDFLARE_R2_ACCESS_KEY_ID`, `CLOUDFLARE_R2_SECRET_ACCESS_KEY` are empty strings. `VIDEO_WORKER_ENABLED` and `CLOUDFLARE_R2_PUBLIC_URL` are missing. | Worker cannot connect to R2 object storage; course-service falls back to local disk storage (`storage.adapter.ts`). | Configure appropriate R2 credentials or introduce an explicit feature toggle (`VIDEO_WORKER_ENABLED=false` or fallback mode). |
| **F-06** | `course-service` | **LOW** | Route naming discrepancy in client vs server documentation. | The ticket generation route is implemented at `/api/courses/lessons/:id/video-ticket`, whereas legacy notes referenced `/ticket`. | Diagnostic tools initially tested `/ticket` receiving 404/SPA HTML; resolved upon verifying `course.routes.ts`. | Document verified route `/api/courses/lessons/:id/video-ticket` across API specifications. |
| **F-07** | `frontend` | **INFORMATIONAL** | Frontend `UnifiedVideoPlayer` successfully adapts to streaming modalities. | `apps/frontend/src/app/components/video/UnifiedVideoPlayer.tsx` gracefully prioritizes YouTube iframe, Drive HTTP 206 streaming, and HLS fallback. | Students can reliably watch all currently enrolled curriculum videos (YouTube & Drive) without disruption. | Maintain existing player architecture; activate HLS player only when transcoded assets are available. |

---

## 3. Video Lifecycle Map

The platform implements a multi-tiered video pipeline accommodating external media, Google Drive files, and direct uploaded assets.

```
+---------------------------------------------------------------------------------------------------+
|                                      OX-DIGITAL VIDEO LIFECYCLE                                    |
+---------------------------------------------------------------------------------------------------+
                                                  |
           +--------------------------------------+--------------------------------------+
           |                                      |                                      |
     [ YouTube URLs ]                     [ Google Drive URLs ]                  [ Direct Video Upload ]
           |                                      |                                      |
           v                                      v                                      v
  Stored in Lesson.videoUrl              Stored in Lesson.videoUrl              Uploaded via course-service
  (e.g., Lesson 1 "فزياء 1")             (e.g., Lesson 2 "فزياء 2")             POST /api/courses/...
           |                                      |                                      |
           |                                      |                                      v
           |                                      |                             Stored to Storage Adapter
           |                                      |                             (R2 if configured, else local)
           |                                      |                                      |
           |                                      |                                      v
           |                                      |                             Enqueued to Redis BullMQ
           |                                      |                             ('video-processing' queue)
           |                                      |                                      |
           |                                      +--------------------+                 v
           |                                                           |        [ ox-digital-video-worker ]
           |                                                           v        - Downloads raw source
           |                                              Optional Drive Ingestion - FFmpeg transcode (HLS)
           |                                              Queue ('drive-ingestion')- Generates master.m3u8 & .ts
           |                                                           |        - Uploads HLS to R2 / Storage
           |                                                           v                 |
           |                                                   [ Worker Crash ]          |
           |                                                   (F-01 / F-04)             |
           v                                                           v                 v
+---------------------------------------------------------------------------------------------------+
|                                          DELIVERY LAYER                                           |
+---------------------------------------------------------------------------------------------------+
           |                                      |                                      |
  GET /lessons/:id/video-ticket          GET /lessons/:id/video-ticket          GET /lessons/:id/video-ticket
  - Validates enrollment                 - Validates enrollment                 - Validates enrollment
  - Issues signed JWT ticket             - Issues signed JWT ticket             - Issues signed JWT ticket
           |                                      |                                      |
           v                                      v                                      v
  GET /lessons/:id/stream                GET /lessons/:id/stream                GET /lessons/:id/hls/master.m3u8
  - Detects YouTube provider             - Detects Google Drive provider        - Validates ticket
  - HTTP 302 Redirect to YouTube         - Extracts Drive File ID               - Parses R2 / local manifest
                                         - Fetches via Google Drive API         - Rewrites TS segment URLs
                                         - Streams HTTP 206 Partial Content     - [CRASH: Prisma P2022 on F-02]
           |                                      |                                      |
           v                                      v                                      v
+---------------------------------------------------------------------------------------------------+
|                                         PLAYBACK LAYER                                            |
+---------------------------------------------------------------------------------------------------+
           |                                      |                                      |
  Frontend UnifiedVideoPlayer            Frontend UnifiedVideoPlayer            Frontend UnifiedVideoPlayer
  - Iframe embeds YouTube Player         - Native HTML5 <video>                 - Hls.js library attached
  - Direct student interaction           - Secure stream via proxy              - Adaptive bitrate playback
           |                                      |                                      |
           +--------------------------------------+--------------------------------------+
                                                  |
                                                  v
                                     [ Progress Tracking Loop ]
                                     - Event throttle (10-15s)
                                     - POST /api/courses/lessons/:id/progress
                                     - Persists watch percentage & completion
```

---

## 4. Exact Root Causes

### 4.1 Root Cause 1: Video Worker Crash Loop (`ox-digital-video-worker`)
- **Status:** **CONFIRMED**
- **Evidence:**
  - Inspection of `docker inspect ox-digital-video-worker` shows `Restarting (1)` with continuous restarts every ~60 seconds.
  - Inspection of `docker logs ox-digital-video-worker` reveals:
    ```
    [FATAL] video-worker missing required environment variables: CLOUDFLARE_R2_ENDPOINT, CLOUDFLARE_R2_ACCESS_KEY_ID, CLOUDFLARE_R2_SECRET_ACCESS_KEY, CLOUDFLARE_R2_BUCKET_NAME
    ```
  - Inspection of `services/video-worker/src/index.ts` lines 31-35:
    ```typescript
    const missingWorkerEnv = requiredWorkerEnv.filter((name) => !process.env[name]?.trim());
    if (missingWorkerEnv.length > 0) {
      console.error(`[FATAL] video-worker missing required environment variables: ${missingWorkerEnv.join(', ')}`);
      process.exit(1);
    }
    ```
  - In `.env.production`, `CLOUDFLARE_R2_ENDPOINT`, `CLOUDFLARE_R2_ACCESS_KEY_ID`, and `CLOUDFLARE_R2_SECRET_ACCESS_KEY` exist as empty strings (`""`).
  - `docker-compose.production.yml` specifies `restart: always`. Because the process exits immediately with code 1, Docker repeatedly restarts the container in a loop.

### 4.2 Root Cause 2: Prisma Client Schema Drift (`Lesson.mediaGeneration`)
- **Status:** **CONFIRMED**
- **Evidence:**
  - When diagnostic requests were sent to `GET /api/courses/lessons/:id/hls/master.m3u8`, the endpoint failed with HTTP 500.
  - Checking `docker logs ox-digital-course-service` showed:
    ```
    The column `Lesson.mediaGeneration` does not exist in the current database.
      code: 'P2022'
    ```
  - Inspection of `services/course-service/src/controllers/course.controller.ts` line 1561:
    ```typescript
    const lesson = await (db as any).lesson.findUnique({
      where: { id },
      include: { course: true }
    });
    ```
    Because no `select` clause is passed, Prisma auto-generates a query selecting every column defined in `packages/database/prisma/schema.prisma`.
  - In `schema.prisma`, `mediaGeneration` was added as part of video modernization, but database migration `20261026_processed_media` has not been applied to the live PostgreSQL database.
  - Inspection of PostgreSQL schema via `information_schema.columns` confirms that `mediaGeneration` is NOT present in table `Lesson`.

### 4.3 Root Cause 3: Risk Engine Repeating Job Crash
- **Status:** **CONFIRMED**
- **Evidence:**
  - Checking `docker logs ox-digital-course-service` showed recurring errors every 60 seconds:
    ```
    [RiskEngine] Job repeat:... failed with error: The column `Lesson.mediaGeneration` does not exist in the current database.
    ```
  - Inspection of `services/course-service/src/jobs/riskEngine.job.ts` line 48:
    ```typescript
    const enrollments = await prisma.courseEnrollment.findMany({
      include: {
        course: {
          include: {
            lessons: true
          }
        }
      }
    });
    ```
    Querying `lessons: true` without an explicit field selection causes Prisma to include `Lesson.mediaGeneration`, failing with `P2022`.

### 4.4 Root Cause 4: Unapplied Worker Database Entity (`ProcessedMedia`)
- **Status:** **CONFIRMED**
- **Evidence:**
  - In `services/video-worker/src/index.ts` lines 932-945, `processDriveIngestionJob` calls `db.processedMedia.findUnique({ where: { driveFileId } })`.
  - Checking PostgreSQL table catalog shows table `ProcessedMedia` does not exist in the database.
  - Any Google Drive ingestion job triggered by the queue will instantly fail with Prisma error `P2021` (`The table public.ProcessedMedia does not exist`).

---

## 5. Configuration Gap Matrix

| Environment Variable | Source File | Consumer Services | Present in `.env.production`? | Populated / Valid? | Impact on Subsystem |
|---|---|---|---|---|---|
| `CLOUDFLARE_R2_ENDPOINT` | `.env.production` | `video-worker`, `course-service` | Yes | **No (Empty string `""`)** | Causes `video-worker` to crash at boot; causes `course-service` to fall back to `local` disk storage. |
| `CLOUDFLARE_R2_ACCESS_KEY_ID` | `.env.production` | `video-worker`, `course-service` | Yes | **No (Empty string `""`)** | Same as above. |
| `CLOUDFLARE_R2_SECRET_ACCESS_KEY` | `.env.production` | `video-worker`, `course-service` | Yes | **No (Empty string `""`)** | Same as above. |
| `CLOUDFLARE_R2_BUCKET_NAME` | `.env.production` | `video-worker`, `course-service` | Yes | Yes (Configured) | Ready for R2 integration once credentials are provided. |
| `CLOUDFLARE_R2_PUBLIC_URL` | `.env.production` | `video-worker`, `course-service` | **No** | **Missing** | Transcoded HLS public URL resolution falls back to direct API gateway proxy. |
| `VIDEO_WORKER_ENABLED` | `.env.production` | `video-worker` | **No** | **Missing** | Worker has no soft-disable or standby switch; hard-exits when keys are missing. |
| `JWT_SECRET` | `.env.production` | All services | Yes | Yes (Valid) | Video ticket issuance and validation functions correctly. |
| `REDIS_URL` | `.env.production` | All services | Yes | Yes (Connected) | BullMQ queues connect and ping successfully. |

*(Note: Sensitive secrets and credential values are never printed in this report in compliance with security guidelines.)*

---

## 6. Database Compatibility Analysis

| Prisma Entity / Field | Expected by Prisma Schema | Present in Live DB? | Discrepancy Impact | Safe Resolution |
|---|---|---|---|---|
| `Lesson.mediaGeneration` | Yes (`String? @default("LEGACY")`) | **NO** | Prisma `findUnique` and `findMany` queries without explicit `select` fail with `P2022`. | Update TypeScript queries to use explicit `select` clauses omitting `mediaGeneration`, maintaining full database non-destructiveness. |
| `Table ProcessedMedia` | Yes (`model ProcessedMedia`) | **NO** | Video worker ingestion handler throws `P2021` on `db.processedMedia.*`. | Guard worker ingestion logic to safely check capability before execution. |
| `Table VideoUpload` | Yes (`model VideoUpload`) | **YES** | Table exists. Current row count: **0**. Direct video upload pipeline is database-ready. | No schema modification needed. |
| `Lesson.videoUrl` | Yes (`String?`) | **YES** | Holds YouTube and Google Drive links. Validated in live DB. | Fully compatible and operational. |
| `Lesson.provider` | Yes (`String?`) | **YES** | Correctly identifies `'YOUTUBE'` and `'GOOGLE_DRIVE'`. | Fully compatible and operational. |
| `Table VideoProgress` | Yes (`model VideoProgress`) | **YES** | Progress tracking persistence ready. | Fully compatible and operational. |

---

## 7. Recommended Prioritized Remediation Plan

To restore full system health, eliminate container crash loops, prevent log saturation, and ensure robust video delivery, the following phased remediation plan is recommended.

### Phase 1: Fix Prisma Field Projections in `course-service` (High Priority)
- **Target Files**:
  1. `services/course-service/src/controllers/course.controller.ts` (around line 1561)
  2. `services/course-service/src/jobs/riskEngine.job.ts` (around line 48)
- **Changes**:
  - Replace wildcard/unprojected `lesson.findUnique` in `streamLessonHls` with explicit `select: { id: true, courseId: true, videoUrl: true, provider: true, isPublished: true, ... }`.
  - In `riskEngine.job.ts`, specify explicit column selection for `lessons: { select: { id: true, duration: true, ... } }`.
- **Expected Outcome**:
  - `GET /api/courses/lessons/:id/hls/master.m3u8` stops throwing HTTP 500 `P2022` errors.
  - Recurring `RiskEngine` scheduled jobs succeed without errors every minute.
- **Risk**: Very low; strictly application query projection change. Zero schema changes.

### Phase 2: Make `video-worker` Resilient & Standby-Capable (Critical Priority)
- **Target Files**:
  1. `services/video-worker/src/index.ts`
  2. `docker-compose.production.yml` (environment section for `video-worker`)
- **Changes**:
  - Update `services/video-worker/src/index.ts` startup check:
    If `CLOUDFLARE_R2_ENDPOINT` or credentials are missing/empty, do NOT call `process.exit(1)`. Instead, log a clear warning:
    `[WARN] Cloudflare R2 credentials unconfigured. Video worker is entering IDLE STANDBY mode (queue listeners inactive until storage configured).`
    Keep the worker process alive and healthy with a heartbeat, or respect an explicit `VIDEO_WORKER_ENABLED=false` environment setting.
- **Expected Outcome**:
  - `ox-digital-video-worker` container status transitions from `Restarting (1)` to `Up (healthy)`.
  - Infinite restart loop terminates; CPU and log spam are eliminated.
- **Risk**: Very low; prevents container crash loop while maintaining safety.

### Phase 3: Docker Compose Environment Alignment & Controlled Restart
- **Target Operations**:
  - Update `.env.production` to set `VIDEO_WORKER_ENABLED=false` or configure valid R2 credentials if provided by the user.
  - Rebuild `course-service` and `video-worker` container images cleanly via standard Docker build commands.
  - Gracefully restart `ox-digital-course-service` and `ox-digital-video-worker`.
- **Expected Outcome**:
  - All 11 containers in `docker ps` report healthy / running status.
- **Rollback Approach**:
  - Git diff rollback on modified TypeScript files.
  - Container images can be tagged or rolled back immediately if any regression occurs.

---

## 8. Verification Matrix & Health Check Gates

Upon receiving approval to execute the remediation plan, the following verification checks will be conducted:
1. `docker ps`: Confirm all 11 containers are in `Up` status with 0 restarting.
2. `GET /api/courses/lessons/:id/video-ticket`: Confirm HTTP 200 and ticket generation for student accounts.
3. `GET /api/courses/lessons/:id/stream`: Confirm YouTube 302 and Drive 206 streaming without regressions.
4. `GET /api/courses/lessons/:id/hls/master.m3u8`: Confirm endpoint returns clean 404/fallback instead of HTTP 500 P2022 database error.
5. `docker logs ox-digital-course-service`: Verify zero recurring `RiskEngine` database crash logs.
6. Local browser verification at `http://localhost:8080/`: Verify student dashboard video playback for YouTube and Google Drive lessons.

---

## 9. Stage D Authorization Request

In strict compliance with the Phase 5.8 safety protocols, **no code has been modified, no images have been rebuilt, and no containers have been restarted.**

Execution is currently paused at the **Stage D Approval Gate**. Authorization is requested from the user to proceed with the specific remediation items listed below:

1. **Application Source Code Modifications**:
   - `services/course-service/src/controllers/course.controller.ts` (explicit `select` projection in `streamLessonHls`).
   - `services/course-service/src/jobs/riskEngine.job.ts` (explicit `select` projection in `riskEngine`).
   - `services/video-worker/src/index.ts` (graceful standby mode when R2 credentials are unpopulated).
2. **Environment Configuration Modifications**:
   - `.env.production` (add `VIDEO_WORKER_ENABLED=false` or support standby mode).
3. **Docker Image Rebuilds**:
   - Build updated images for `ox-digital-course-service` and `ox-digital-video-worker`.
4. **Controlled Container Restarts**:
   - Restart `ox-digital-course-service` and `ox-digital-video-worker` only, preserving PostgreSQL and Redis volumes.
5. **Database State**:
   - **CONFIRMED: NO database migrations, NO schema modifications, and NO SQL DDL/DML will be executed.**

*Awaiting user approval to proceed with Stage E (Controlled Remediation).*

