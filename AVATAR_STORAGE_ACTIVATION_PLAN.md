# OX-DIGITAL Education — Avatar Storage Activation Plan

**Workspace:** `D:\OX-DIGITAL\Mathe\OX-DIGITAL-GITHUB`  
**Date:** 2026-11-08  
**Document Type:** Pre-Activation Technical Plan (Preparation Only — No Runtime Changes Applied)  
**Target Service:** `user-service` (`container_name: ox-digital-user-service`)  
**Deployment Files Affected:** `docker-compose.production.yml` and `docker-compose.staging.yml`  
**Status:** READY FOR OWNER REVIEW & SEPARATE AUTHORIZATION  

---

## 1. Executive Summary & Problem Statement

In the previous audit round, the avatar upload and serving pipeline was verified to be cryptographically secure and functional in source code (`brdSubscription.controller.ts`).

However, an exhaustive inspection of the Docker configuration revealed that **avatar storage is not mounted to a durable host volume**:
- `user-service` in `docker-compose.production.yml` mounts `./storage/receipts:/app/storage/receipts`, but **does NOT mount `./storage/avatars`**.
- As a result, in containerized production and staging runtimes, uploaded avatars are written to the container's temporary overlay filesystem.
- **Consequence:** Recreating the container, upgrading Node base images, or redeploying `user-service` will permanently destroy all user profile pictures stored inside the container.

This plan details the exact, tested, non-breaking configuration required to achieve durable persistence across container lifecycles, scheduled for execution only upon explicit owner authorization.

---

## 2. Path Resolution & Environment Analysis

### 2.1 Backend Runtime Path Resolution
In `services/user-service/src/controllers/brdSubscription.controller.ts`:
- Upload target: `const uploadDir = path.resolve('storage/avatars');`
- Serving target: `const filePath = path.join(uploadDir, filename);`

In `services/Dockerfile`:
- Stage 2 (Runner): `WORKDIR /app`
- Non-root user creation: `adduser -S nodejs -u 1001 -G nodejs`
- Service working directory: `WORKDIR /app/services/${SERVICE_NAME}` (which is `/app/services/user-service` for `user-service`).

When Node executes within `/app/services/user-service`, `path.resolve('storage/avatars')` resolves to:
```
/app/services/user-service/storage/avatars
```
To ensure seamless compatibility between local development (where the process runs at repo root) and container runtimes (where working directory is `/app/services/user-service` or `/app`), the backend controller should support an explicit environment variable:
```typescript
const uploadDir = process.env.AVATAR_STORAGE_DIR || (
  fs.existsSync('/app/storage/avatars') 
    ? '/app/storage/avatars' 
    : path.resolve('storage/avatars')
);
```

### 2.2 Host vs Container Volume Mapping
To mirror the existing sequential receipts volume architecture:
```yaml
# Existing receipts volume in docker-compose.production.yml
volumes:
  - ./storage/receipts:/app/storage/receipts
```
The exact proposed bind mount for avatars is:
```yaml
volumes:
  - ./storage/receipts:/app/storage/receipts
  - ./storage/avatars:/app/storage/avatars
```
Along with the environment variable added to `user-service` environment block:
```yaml
environment:
  - AVATAR_STORAGE_DIR=/app/storage/avatars
```

---

## 3. Host Directory Setup & Ownership Requirements

In Alpine Linux containers, `user-service` runs under the non-root user `nodejs` with:
- **UID:** `1001`
- **GID:** `1001`

If the host directory `./storage/avatars` is created by `root` on a Linux production host with default `0755` permissions, the `nodejs` process inside the container will encounter `EACCES: permission denied` when calling `fs.mkdirSync` or `fs.writeFileSync`.

### Pre-Activation Host Commands (Linux Production Server)
```bash
# 1. Create the durable storage directory on the host
mkdir -p storage/avatars

# 2. Assign ownership to container UID/GID (1001:1001)
chown -R 1001:1001 storage/avatars

# 3. Ensure read/write/execute permissions for the owner and group
chmod -R 775 storage/avatars
```

---

## 4. Multi-Instance & Cloud Scaling Strategy

### 4.1 Single-Host Docker Compose (Current Architecture)
For the current production setup running on a single host via Docker Compose:
- Host bind mount `./storage/avatars:/app/storage/avatars` is 100% durable, low-latency, and zero-overhead.
- Files persist through `docker compose down`, `docker compose up -d`, and image rebuilds.

### 4.2 Multi-Instance Clustered Architecture (Future Cloud Scaling)
If OX-DIGITAL scales horizontally to multiple compute nodes running behind a round-robin load balancer:
- Local host bind mounts cannot be shared across different physical hosts without a networked filesystem (NFS / GlusterFS).
- *Recommended Long-Term Path:* Leverage the existing S3/MinIO infrastructure already in place for HLS video processing (`docker-compose.dev-hls.yml` runs MinIO on port 9000/9100). The `uploadProfilePicture` controller can be adapted to stream avatar buffers to an `ox-digital-avatars` MinIO/S3 bucket using `@aws-sdk/client-s3`.

---

## 5. Backup & Disaster Recovery Implications

Avatar files represent user-uploaded institutional assets and must be incorporated into platform backup routines:

### Backup Procedure
Add avatar directory archiving to the daily backup script (`scripts/pg_backup.sh`):
```bash
# Archive avatars alongside database dumps
AVATAR_BACKUP_DIR="${BACKUP_BASE_DIR}/avatars"
mkdir -p "${AVATAR_BACKUP_DIR}"
tar -czf "${AVATAR_BACKUP_DIR}/avatars_$(date +%Y%m%d_%H%M%S).tar.gz" -C storage/ avatars/
```

### Restoration Procedure
```bash
# Extract archived avatars into active storage
tar -xzf "${AVATAR_BACKUP_DIR}/avatars_<TIMESTAMP>.tar.gz" -C storage/
chown -R 1001:1001 storage/avatars
```

---

## 6. Pre-Activation Diff (Pending Owner Authorization)

```diff
--- a/docker-compose.production.yml
+++ b/docker-compose.production.yml
@@ -111,6 +111,7 @@ services:
       - TRUST_PROXY=${TRUST_PROXY:-1}
       - SENTRY_DSN=${SENTRY_DSN:-}
       - SENTRY_ENVIRONMENT=${SENTRY_ENVIRONMENT:-production}
+      - AVATAR_STORAGE_DIR=/app/storage/avatars
     volumes:
       - ./storage/receipts:/app/storage/receipts
+      - ./storage/avatars:/app/storage/avatars
     restart: always
```

---

## 7. Step-by-Step Activation Checklist (To Be Executed in Activation Phase)

- [ ] **Step 1:** Obtain explicit written authorization from the platform owner.
- [ ] **Step 2:** Ensure host directory exists and verify ownership: `mkdir -p storage/avatars && chown -R 1001:1001 storage/avatars`.
- [ ] **Step 3:** Apply the diff to `docker-compose.production.yml` and `docker-compose.staging.yml`.
- [ ] **Step 4:** Recreate `user-service` container: `docker compose -f docker-compose.production.yml up -d --no-deps --build user-service`.
- [ ] **Step 5:** Upload a test profile picture via Account Settings.
- [ ] **Step 6:** Verify file creation on host: `ls -la storage/avatars/`.
- [ ] **Step 7:** Recreate container (`docker compose restart user-service`) and confirm image is still accessible via browser `<img>` at `/api/users/avatars/<FILENAME>`.

