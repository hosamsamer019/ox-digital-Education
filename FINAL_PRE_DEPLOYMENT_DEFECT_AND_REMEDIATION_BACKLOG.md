# Final Pre-Deployment Defect & Remediation Backlog

**Platform:** OX-DIGITAL Education  
**Repository:** `D:\OX-DIGITAL\Mathe\OX-DIGITAL-GITHUB`  
**Date:** 2026-11-08  
**Scope:** Complete Backlog of Known Issues, Root Causes, Severity Classifications & Prescribed Remediations  

---

## 1. Defect Backlog Summary

| Defect ID | Component | Title | Severity | Remediation State | Action Required Prior to Deployment |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **DEF-01** | `docker-compose.staging.yml` | Duplicate YAML mapping keys under `nginx`, `course-service`, `postgres`, `redis` & missing top-level avatars volume. | Medium | **REMEDIATED & VERIFIED** | None. YAML manifests verified clean with 0 duplicate keys. |
| **DEF-02** | `UnifiedVideoPlayer.tsx` | Background audio and timeline progression continue when student leaves video page or loses focus (Anti-Cheat Bypass). | High / Critical | **ROOT CAUSE DIAGNOSED & PATCH SPECIFIED** | Apply ref-based `pausePlayback` and `visibilitychange` event listener hook in `UnifiedVideoPlayer.tsx` (Deliverable 4). |
| **DEF-03** | `docker-compose.staging.yml` | Staging database port 5432 published on localhost (`127.0.0.1:5432:5432`). | Low | **DOCUMENTED** | If running alongside a host postgres instance on 5432, update host port mapping in staging environment (e.g. `5434:5432`). |
| **DEF-04** | `UnifiedVideoPlayer.tsx` | YouTube player iframe click causes active element to become IFRAME, preventing subsequent blur handling. | Medium | **PATCH SPECIFIED** | Wrap YouTube player container in focus interception layer to maintain window blur sensitivity. |
| **DEF-05** | `nginx.conf` | Rate limit burst settings for video streaming route. | Low | **VERIFIED** | Byte-range video route explicitly bypasses request buffering and rate limits. |

---

## 2. Detailed Remediation Action Items

### Priority 1: Video Background Audio Defect (DEF-02)
- **Target File:** `apps/frontend/src/app/components/video/UnifiedVideoPlayer.tsx`
- **Action:** Replace stale closure `pausePlayback` with ref-based direct invocation of `htmlVideoRef.current.pause()` and `ytPlayerRef.current.pauseVideo()`, and attach `document.addEventListener('visibilitychange')`.
- **Approval Scope:** Application source change authorized under separate owner approval.

### Priority 2: Staging PostgreSQL Port Collision Check (DEF-03)
- **Target File:** `docker-compose.staging.yml`
- **Action:** Ensure port `5432` on staging host does not collide with local developer database servers or staging host services.
- **Remediation:** Already bound to `127.0.0.1:5432` by default; can be mapped to `${POSTGRES_PORT:-5432}:5432`.

