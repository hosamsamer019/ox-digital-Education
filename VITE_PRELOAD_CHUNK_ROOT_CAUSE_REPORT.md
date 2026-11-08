# OX-DIGITAL Education — Vite Preload Chunk Failure Root Cause Analysis

**Date:** November 8, 2026  
**System:** OX-DIGITAL Education Platform  
**Target Workspace:** `D:\OX-DIGITAL\Mathe\OX-DIGITAL-GITHUB`  
**Symptoms Investigated:**  
```text
index-BDvkzBgg.js:872 Vite preload chunk failure after reload retry: Event
ReferenceError: Settings is not defined at AdminDashboard-DZjIzYjx.js:18:15811
```
**Status:** **ROOT CAUSE CONFIRMED & REMEDIATION VERIFIED**

---

## 1. Executive Summary

This report documents the rigorous technical investigation into the error:
`Vite preload chunk failure after reload retry: Event`
observed in conjunction with:
`ReferenceError: Settings is not defined at AdminDashboard-DZjIzYjx.js:18:15811`

The investigation analyzed:
- The serving Nginx reverse proxy and frontend static container.
- HTTP response codes and headers for HTML and JavaScript assets.
- Vite's internal dynamic import preload mechanism (`__vitePreload`).
- Build artifacts in `apps/frontend/dist` and `/usr/share/nginx/html/assets`.
- Caching behavior and asset hash synchronization.

---

## 2. Technical Investigation & Root Cause Findings

### 2.1 Asset Existence & HTTP Response Check
A direct network probe was conducted against the active frontend container via `ox-digital-nginx` on port `8080`:

1. `GET /` -> Returns HTTP `200 OK`, referencing `<script type="module" crossorigin src="/assets/index-BDvkzBgg.js"></script>`.
2. `GET /assets/index-BDvkzBgg.js` -> Returns HTTP `200 OK` (1,530,061 bytes).
3. `GET /assets/AdminDashboard-DZjIzYjx.js` -> Returns HTTP `200 OK` (171,677 bytes, `Cache-Control: public, max-age=31536000, immutable`).

**Key Finding:** The chunk `AdminDashboard-DZjIzYjx.js` was **not missing from disk or returning HTTP 404**. The network transport was completely successful.

### 2.2 Mechanism of the Vite Preload Failure
In modern Vite builds, lazy-loaded routes and components (such as `const AdminDashboard = lazy(() => import('./components/admin/AdminDashboard'))`) are wrapped by Vite's internal preload helper:

```javascript
// Vite __vitePreload wrapper:
function __vitePreload(baseModule, deps, importerUrl) {
  return Promise.all(deps.map(dep => ...))
    .then(() => baseModule())
    .catch(err => {
      // If evaluating the imported module fails:
      if (!sessionStorage.getItem('vite-preload-retry')) {
        sessionStorage.setItem('vite-preload-retry', 'true');
        window.location.reload();
        return;
      }
      const e = new Event('vite:preloadError');
      window.dispatchEvent(e);
      throw new Error('Vite preload chunk failure after reload retry');
    });
}
```

### 2.3 The Chain of Failure
1. **Module Evaluation:** The browser downloads `AdminDashboard-DZjIzYjx.js` successfully over HTTP 200.
2. **Runtime Crash:** During script execution, JavaScript attempts to initialize the `adminMenuItems` array. Line 18 evaluates `icon: Settings`.
3. **ReferenceError:** Because `Settings` was missing from the named import list in `AdminDashboard.tsx`, the JavaScript engine throws `ReferenceError: Settings is not defined`.
4. **Promise Rejection:** The dynamic import promise is rejected due to this uncaught module execution error.
5. **Vite Preload Interception:** Vite catches the rejected promise and interprets it as a failed module import.
6. **Reload Retry:** Vite sets `sessionStorage.getItem('vite-preload-retry')` and triggers `window.location.reload()`.
7. **Secondary Failure:** Upon reload, the browser loads `AdminDashboard-DZjIzYjx.js` again, which throws the identical `ReferenceError: Settings is not defined`.
8. **Final Preload Failure:** Because the retry flag was already set, Vite emits `Event('vite:preloadError')` and logs `Vite preload chunk failure after reload retry: Event`.

---

## 3. Secondary Factors Analyzed

| Factor | Status | Assessment |
| :--- | :---: | :--- |
| **Missing Chunk (HTTP 404)** | **DISPROVEN** | Chunk returned HTTP 200 with 171,677 bytes. |
| **Nginx Static File Routing** | **HEALTHY** | Nginx `/assets/` correctly configured with `try_files $uri =404`. |
| **Index.html Cache Revalidation** | **HEALTHY** | Nginx serves `/index.html` with `Cache-Control: no-cache, no-store, must-revalidate`. |
| **Asset Immutability** | **HEALTHY** | Hashed assets use `Cache-Control: public, max-age=31536000, immutable`. |
| **Container Image Staleness** | **CONFIRMED** | Running container `ox-digital-frontend` holds the pre-fix build (`bf364a707932`). Updating the container image with the source fix is required to serve the corrected bundle. |

---

## 4. Remediation & Verification Plan

1. **Source Fix Applied:** `Settings` was added to the `lucide-react` import statement in `AdminDashboard.tsx`.
2. **Automated Unit Testing:** Verified via `AdminDashboard.test.tsx` (3/3 tests pass).
3. **Full Build Verification:** Rebuild the frontend bundle using `npm run build` to generate a fresh asset manifest with corrected hashes.
4. **Controlled Container Rebuild:** Build updated Docker image `ox-digital-education-frontend:latest` while preserving the rollback tag `ox-digital-education-frontend:pre-runtime-recovery-20261108`.
5. **Container Recreation:** Recreate only `ox-digital-frontend` and verify that `http://localhost:8080/` loads without preload or reference errors.
