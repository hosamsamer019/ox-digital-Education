# OX-DIGITAL Education — Critical Theme Runtime Diagnostic Report

**Document ID:** `OX-DIAG-RUNTIME-20261107-01`  
**Workspace:** `D:\OX-DIGITAL\Mathe\OX-DIGITAL-GITHUB`  
**Host URL:** `http://127.0.0.1:8080`  
**Authoritative Development Database:** `127.0.0.1:5433/ox_digital_dev_test` (Container: `ox-digital-isolated-dev-postgres`)  
**Diagnostic Date:** November 7, 2026  
**Status:** Root Causes Discovered & Fully Documented  

---

## 1. Executive Diagnostic Finding: The Source vs. Runtime Divergence

The owner's observation that *"changing the theme from account settings sometimes does nothing, the rest of the platform does not change, and colors remain incorrect in Default and Dark modes"* was **100% physically accurate**.

The primary technical reason for this disconnect is that **the running Docker container served at `http://127.0.0.1:8080` was running a stale static build baked into the container image on `Sat, 07 Nov 2026 13:37:21 GMT`**, prior to the previous remediation session.

Because strict container isolation prohibits restarting, rebuilding, or recreating Docker containers without explicit owner authorization, the changes made to the host workspace source files were never mounted into the running container.

---

## 2. Evidence of Runtime Divergence (Triple Comparison)

| Dimension | SOURCE CODE STATUS (`apps/frontend/`) | BUILD ARTIFACT STATUS (`dist/`) | CURRENTLY SERVED RUNTIME (`127.0.0.1:8080`) |
| :--- | :--- | :--- | :--- |
| **Asset Bundle** | TypeScript & Tailwind v4 Source Modules | `index-zDC4mVYI.js` & `index-BAV4RXrZ.css` | `index-DE4lXv92.js` & `index-BkN0cWwH.css` |
| **Bundle Build Time** | Active local development | Built Nov 7, 2026 19:12:09 | **Baked Nov 7, 2026 13:37:21 GMT** |
| **`index.html` Body** | Cleaned; controlled by Tailwind `@layer base` | Cleaned (no inline background color) | **Has `<style>html, body { background-color: #090b10; }</style>`** |
| **Account Settings** | Directly bound to `useTheme()`; PUT `/account/settings` | Contains updated `AccountSettingsPage` chunk | Uses isolated component state; `newTheme === 'light' ? remove('dark') : add('dark')` |
| **Settings Routes** | Declared in `/admin/settings`, `/teacher/settings`, etc. | Routes compiled into chunks | Missing in Teacher/Admin; routes 404'd or blank |
| **Component Tokens** | Semantic `bg-card border-border text-foreground` | Compiled to CSS variables | **Hardcoded `bg-white dark:bg-slate-900 border-slate-200`** |
| **Warm Orange `.dark`**| Included in `DARK_THEMES` (White text, 17.4:1 contrast) | Compiled to `.dark` class | Excluded from `DARK_THEMES` (Black text on brown, 1.1:1 contrast) |

### 2.1 Curl Probe Evidence from `http://127.0.0.1:8080`
Direct inspection of the response from `http://127.0.0.1:8080/`:
```http
HTTP/1.1 200 OK
Server: nginx
Date: Sat, 07 Nov 2026 16:58:26 GMT
Content-Type: text/html
Content-Length: 10956
Last-Modified: Sat, 07 Nov 2026 13:37:21 GMT
ETag: "6aef2991-2acc"
```
The HTML payload served by Nginx contains:
```html
<style>
  html, body {
    height: 100%;
    margin: 0;
    background-color: #090b10;
  }
</style>
<script type="module" crossorigin src="/assets/index-DE4lXv92.js"></script>
<link rel="stylesheet" crossorigin href="/assets/index-BkN0cWwH.css">
```
This confirms that the browser visiting `http://127.0.0.1:8080` was receiving JavaScript bundle `index-DE4lXv92.js` and CSS bundle `index-BkN0cWwH.css` from the stale container image.

---

## 3. Container Architecture Analysis

In `docker-compose.production.yml`:
```yaml
  frontend:
    image: ox-digital-education-frontend:latest
    build:
      context: .
      dockerfile: apps/frontend/Dockerfile
    container_name: ox-digital-frontend
    restart: always
    networks:
      - ox-digital-network
```
There is **no volume mount** mapping `apps/frontend/dist` or host source code into the `ox-digital-frontend` container. The container serves static files copied into its Nginx web root at image build time (`/usr/share/nginx/html`). 

Therefore, any change made on the host filesystem:
1. Compiles into `apps/frontend/dist/`.
2. Passes all Vitest unit and integration tests (which run in Node/JSDOM against host source code).
3. **Does not automatically propagate to `http://127.0.0.1:8080`** until the frontend container image is updated and activated.

---

## 4. Required Runtime Activation Action (Awaiting Owner Authorization)

To deliver the remediated frontend bundle to the running browser at `http://127.0.0.1:8080`, the following deployment/activation step is required:
1. Rebuild or update the `ox-digital-education-frontend` container with the latest built assets from `apps/frontend/dist/`.
2. In accordance with Section 1 of the prompt instructions:
   > *"Do not restart, rebuild, or replace any container to make the runtime match the source. Report the required activation action separately for the owner's approval."*
3. **No container restart, rebuild, or recreation has been executed.** All running containers remain in their continuous, untouched runtime state.

---
**Report Author:** Senior Systems & Runtime Diagnostic Engineer  
**Date:** November 7, 2026

