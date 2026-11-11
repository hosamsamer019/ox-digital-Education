# OX-DIGITAL Education — Final Avatar Storage Durability & Docker Configuration Assessment

**Audit Date:** November 8, 2026  
**Audited Directory:** `D:\OX-DIGITAL\Mathe\OX-DIGITAL-GITHUB`  
**Container Inspected:** `ox-digital-user-service`  
**Audit Character:** Strictly Read-Only Container, Volume & Storage Forensic Inspection  

---

## 1. Executive Summary

This forensic assessment investigated the storage durability, Docker deployment configuration, and image security validation mechanisms for user profile avatars.

### Core Audit Discoveries:
1. **Zero Volume Mounts on Running `user-service` Container:** Inspection of the active container `ox-digital-user-service` via Docker engine inspect (`docker inspect ox-digital-user-service --format "{{json .Mounts}}"`) returned `[]` (empty list). The running container has **zero storage mounts**.
2. **Ephemeral Storage Risk Confirmed:** Avatars uploaded via `uploadProfilePicture` write directly to `/app/storage/avatars` inside the container's overlay2 filesystem layer. Any container recreation, image upgrade, or Docker compose restart will **permanently delete all avatar image files on disk**, while leaving PostgreSQL database pointers (`User.profilePictureUrl`) intact, resulting in permanent HTTP 404 broken image placeholders.
3. **Repository Docker Compose Omission:** In `D:\OX-DIGITAL\Mathe\OX-DIGITAL-GITHUB\docker-compose.production.yml`, `user-service` defines only `./storage/receipts:/app/storage/receipts` under `volumes:`. The path `./storage/avatars` is **completely absent**.
4. **Host Directory Absence:** On the host filesystem at `D:\OX-DIGITAL\Mathe\OX-DIGITAL-GITHUB\storage`, only the `receipts` subfolder exists. The `avatars` subfolder does **not exist**.
5. **Storage Durability Status:** **NOT VERIFIED / DEFECT CONFIRMED.** Avatar persistence across container recreation is physically impossible under the current container and Compose configurations.

---

## 2. Answers to Critical Audit Questions

### 1. Which Docker Compose file defines the relevant `user-service`?
`D:\OX-DIGITAL\Mathe\OX-DIGITAL-GITHUB\docker-compose.production.yml` (lines 93–119) defines the canonical `user-service` for this repository.

### 2. Which Compose file was used by the current local runtime?
Inspection of container labels revealed an operational divergence:
- `ox-digital-frontend` has label:  
  `com.docker.compose.project.config_files: "D:\\OX-DIGITAL\\Mathe\\OX-DIGITAL-GITHUB\\docker-compose.production.yml"`.
- `ox-digital-user-service` has label:  
  `com.docker.compose.project.config_files: "D:\\OX-DIGITAL\\Mathe\\Mathteachersmartplatform-main\\docker-compose.production.yml"`.  
This demonstrates that `user-service` is currently still executing an older container instance spawned prior to the activation of the `OX-DIGITAL-GITHUB` workspace.

### 3. Does the running `user-service` have a persistent mount covering `/app/storage/avatars`?
**NO.** `Mounts: []`. Neither named volumes nor bind mounts are attached to `/app/storage/avatars` or `/app/storage/receipts` in the active container.

### 4. Does the application save avatars to the same path that the proposed mount would cover?
**YES.** In `services/user-service/src/controllers/brdSubscription.controller.ts` (line 1288):
```typescript
const uploadDir = path.resolve('storage/avatars');
```
Inside the container (where `WORKDIR` is `/app`), this resolves to `/app/storage/avatars`. A host bind mount mapping `./storage/avatars:/app/storage/avatars` directly targets this exact path.

### 5. Does the existing deployment use a bind mount, named volume, or container overlay filesystem?
It uses the **container overlay filesystem** (ephemeral writable layer).

### 6. Could container recreation remove avatar files while leaving database URLs intact?
**YES.** The PostgreSQL database records (`User.profilePictureUrl`) are stored in `ox-digital-isolated-dev-postgres` (backed by the Docker volume `ox_digital_isolated_dev_pgdata`). The files, however, are stored in the ephemeral container layer. Recreating `ox-digital-user-service` will destroy the files while leaving the database pointing to non-existent disk paths.

### 7. Are avatar URLs publicly accessible without authentication?
**YES.** In `services/user-service/src/routes/brdSubscription.routes.ts` (lines 8–9):
```typescript
router.get('/avatars/:filename', BrdSubscriptionController.getAvatar);
router.get('/storage/avatars/:filename', BrdSubscriptionController.getAvatar);
router.use(verifyToken);
```
Both routes are mounted **above** `verifyToken`.

### 8. Is public access intentional and consistent with platform privacy requirements?
Public access is intentional from an architectural standpoint because standard HTML `<img src="/api/users/avatars/avatar_xxx.jpg">` tags cannot attach `Authorization: Bearer <token>` headers without custom blob fetching. However, from a data privacy standpoint:
- Avatars are accessible to anyone who possesses the filename.
- The filename format is `avatar_${userId}_${timestamp}.${ext}`. Because `userId` is a UUID, URLs are obscure, but not cryptographically signed or time-limited.

### 9. Does the current image validation perform actual image decoding, or only partial signature checks?
**Partial signature checks only.** In `brdSubscription.controller.ts` (lines 1279–1285):
- JPEG: Checks `buffer[0] === 0xFF && buffer[1] === 0xD8`.
- PNG: Checks `buffer[0..3] === 0x89 0x50 0x4E 0x47`.
- WebP: Checks `buffer[8..11] === 'WEBP'`.
It does **NOT** decode image pixels using a parsing library (such as Sharp or Libvips). An attacker could construct a polyglot file containing a valid 4-byte header followed by arbitrary malicious payloads.

### 10. Is base64 input size bounded before large memory allocations?
**NO.** In `brdSubscription.controller.ts` (lines 1273–1275):
```typescript
const buffer = Buffer.from(base64Data, 'base64');
if (buffer.length > 2 * 1024 * 1024) { ... }
```
The application allocates the full Buffer in Node.js process memory **before** evaluating its size. A payload of 100 MB of base64 text will allocate approximately 75 MB of heap memory before being rejected, exposing the service to heap exhaustion (Denial of Service).

---

## 3. Storage Configuration Comparison Matrix

| Component | Current Running Container | Repository Compose File (`OX-DIGITAL-GITHUB`) | Proposed Secure State |
| :--- | :--- | :--- | :--- |
| **Compose Source** | `Mathteachersmartplatform-main` | `OX-DIGITAL-GITHUB` | `OX-DIGITAL-GITHUB` |
| **Receipts Storage Mount** | None (`Mounts: []`) | `./storage/receipts:/app/storage/receipts` | `./storage/receipts:/app/storage/receipts` |
| **Avatars Storage Mount** | **None** | **None** | `./storage/avatars:/app/storage/avatars` |
| **Host Directory** | Absent | Absent | `D:\OX-DIGITAL\Mathe\OX-DIGITAL-GITHUB\storage\avatars` |
| **Durability on Recreate** | **0% (Immediate Data Loss)** | **0% (Immediate Data Loss)** | **100% (Persistent on Host)** |

---

## 4. Remediation Plan (Requires Owner Approval)

To achieve true, verifiable avatar durability, the following two-step operational change must be authorized:

1. **Host Directory Preparation:**
   Create `D:\OX-DIGITAL\Mathe\OX-DIGITAL-GITHUB\storage\avatars` with appropriate read/write permissions.
2. **Compose Volume Mapping:**
   Update `D:\OX-DIGITAL\Mathe\OX-DIGITAL-GITHUB\docker-compose.production.yml` under `user-service`:
   ```yaml
       volumes:
         - ./storage/receipts:/app/storage/receipts
         - ./storage/avatars:/app/storage/avatars
   ```
3. **Recreate Container:**
   Recreate `ox-digital-user-service` using the updated Compose file and verify the mount via `docker inspect`.

