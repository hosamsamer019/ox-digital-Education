# OX-DIGITAL Education — Profile Image Upload & Storage Remediation Plan

**Date:** November 8, 2026  
**Auditor:** Automated Engineering & Forensic Audit Specialist  
**Workspace:** Strictly `D:\OX-DIGITAL\Mathe\OX-DIGITAL-GITHUB`  
**Target Microservice:** `services/user-service` (`ox-digital-user-service`)  
**Status:** Audit Complete — Structural Vulnerabilities Documented — Actionable Remediation Plan Established  

---

## 1. Executive Summary

This report delivers an exhaustive technical assessment of the profile picture (avatar) upload, validation, persistence, and storage durability architecture in the OX-DIGITAL Education platform. 

The upload code contains robust MIME and binary magic-number checks. However, **the persistent storage architecture is critically deficient**. Neither the running Docker container nor `docker-compose.production.yml` attaches a persistent volume to the avatar storage path. Any uploaded avatar is written directly to the container's ephemeral read-write layer and **will be permanently destroyed whenever the container is updated, rebuilt, or recreated**.

---

## 2. Forensic Code & Security Audit of the Upload Workflow

### 1. File Format & MIME Validation
In `services/user-service/src/controllers/brdSubscription.controller.ts:1328-1331`:
```typescript
const allowedMimes = ['image/jpeg', 'image/png', 'image/webp'];
if (!allowedMimes.includes(mimeType)) {
  return res.status(400).json({ message: 'Only JPG, PNG, and WebP images are permitted' });
}
```
Only standard image MIME types (`image/jpeg`, `image/png`, `image/webp`) are accepted.

### 2. Magic Number (Binary File Signature) Security Verification
In `brdSubscription.controller.ts:1340-1346`:
```typescript
const isJpeg = buffer[0] === 0xff && buffer[1] === 0xd8;
const isPng = buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47;
const isWebp = buffer.slice(8, 12).toString('ascii') === 'WEBP';

if (!isJpeg && !isPng && !isWebp) {
  return res.status(400).json({ message: 'Invalid or forged image file content' });
}
```
Content spoofing is prevented: an attacker cannot rename an executable (`.exe`, `.sh`, `.php`) or HTML payload to `.jpg` because the controller validates the first binary magic bytes against canonical image headers.

### 3. Base64 Input Size Pre-Allocation Hardening
*Defect Identified in Prior Code:* `const buffer = Buffer.from(base64Data, 'base64');` allocated heap memory before inspecting `buffer.length`. An attacker could transmit a 500 MB base64 payload and trigger Node.js heap exhaustion (Denial-of-Service).  
*Remediation Applied in this Session:*
```typescript
// Pre-allocation string length check (base64 overhead ~33%, 2MB ~ 2.8MB base64)
if (base64Data.length > 3 * 1024 * 1024) {
  return res.status(400).json({ message: 'File size exceeds maximum permitted limit of 2 MB' });
}
```
Payloads exceeding 3 MB are rejected immediately before any heap buffer allocation occurs.

### 4. File Retrieval & Path Traversal Defense
In `brdSubscription.controller.ts:1377-1380`:
```typescript
const { filename } = req.params;
if (!filename || filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
  return res.status(400).json({ message: 'Invalid filename' });
}
```
Any attempt to access host directories via directory traversal (`../`, `..\`) is rejected with HTTP 400.

### 5. Database Persistence & Static Serving
- The file is written to `path.join(uploadDir, fileName)`.
- The database record `User.profilePictureUrl` is updated to `/api/users/avatars/${fileName}`.
- `GET /api/users/avatars/:filename` streams the image with `Cache-Control: public, max-age=86400, stale-while-revalidate=604800`.

---

## 3. The Ephemeral Storage Defect & Data-Loss Mechanism

### Docker Runtime Inspection Evidence
Executing `docker inspect ox-digital-user-service` reveals:
```json
"Mounts": []
```
The running user-service container has **zero bind mounts or named volumes**.

### Compose Configuration Evidence
In `docker-compose.production.yml` lines 114–115:
```yaml
    volumes:
      - ./storage/receipts:/app/storage/receipts
```
The compose file configures a mount for `receipts`, but **omits `avatars` entirely**.

### Host Filesystem Evidence
The directory `D:\OX-DIGITAL\Mathe\OX-DIGITAL-GITHUB\storage` contains only `receipts/`. The directory `storage/avatars` **does not exist on the host**.

### Data Loss Impact Analysis
1. When a user uploads an avatar, Node.js writes the file to `/app/storage/avatars` inside the container's overlay2 read-write layer.
2. The database stores the path `/api/users/avatars/avatar_xxx.jpg`.
3. The image renders successfully during the container's immediate runtime.
4. **Catastrophic Failure Event:** The moment `docker compose down`, `docker compose up -d`, or an image rebuild is executed:
   - Docker deletes the container's writable overlay layer.
   - The files in `/app/storage/avatars` are permanently eradicated.
   - The database continues pointing to `/api/users/avatars/avatar_xxx.jpg`.
   - The user interface attempts to fetch the avatar, receives HTTP 404 Not Found, and displays broken image placeholders across dashboards.

---

## 4. Validated Path & Implementation Proposal

### Path Feasibility Validation
- Root Compose Working Directory: `D:\OX-DIGITAL\Mathe\OX-DIGITAL-GITHUB`
- Host Path: `./storage/avatars` resolves to `D:\OX-DIGITAL\Mathe\OX-DIGITAL-GITHUB\storage\avatars`
- Container Working Directory: `/app` (defined by Dockerfile `WORKDIR /app`)
- Controller Resolution: `path.resolve('storage/avatars')` in Node.js resolves to `/app/storage/avatars`
- **Result:** The proposed mount `./storage/avatars:/app/storage/avatars` is **100% path-consistent and valid**.

### Itemized Implementation Plan (Pending Owner Approval)

1. **Step 1 — Create Host Directory (Read-Only Safety Rule Respected):**
   ```powershell
   New-Item -ItemType Directory -Path "D:\OX-DIGITAL\Mathe\OX-DIGITAL-GITHUB\storage\avatars" -Force
   ```

2. **Step 2 — Update `docker-compose.production.yml`:**
   Add `./storage/avatars:/app/storage/avatars` under `ox-digital-user-service` volumes:
   ```yaml
       volumes:
         - ./storage/receipts:/app/storage/receipts
         - ./storage/avatars:/app/storage/avatars
   ```

3. **Step 3 — Controlled Container Recreation:**
   ```powershell
   docker compose -f docker-compose.production.yml up -d --no-deps --build ox-digital-user-service
   ```

4. **Step 4 — Verification of Durability:**
   - Upload an avatar via Account Settings.
   - Verify file is written to host directory `D:\OX-DIGITAL\Mathe\OX-DIGITAL-GITHUB\storage\avatars`.
   - Recreate the container (`docker compose stop ox-digital-user-service && docker compose start ox-digital-user-service`).
   - Refresh browser on `http://localhost:8080/` and verify the avatar remains accessible.

---

## 5. Domain Verdict

* **Audit Classification:** **BLOCKED**
* **Durability Status:** Ephemeral storage prevents production certification. Must remain `BLOCKED` until persistent volume mount is applied under explicit owner approval.

