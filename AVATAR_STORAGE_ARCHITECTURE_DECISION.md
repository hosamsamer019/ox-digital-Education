# OX-DIGITAL Education — Avatar Storage Architecture Decision & Durability Assessment

**Date:** November 2026  
**Repository Workspace:** `D:\OX-DIGITAL\Mathe\OX-DIGITAL-GITHUB`  
**Classification:** Critical Architectural Finding  
**Decision Status:** **BLOCKED — OWNER APPROVAL REQUIRED**  

---

## 1. Executive Summary & Durability Finding

During this comprehensive audit of **OX-DIGITAL Education**, a critical data-loss risk was identified in the avatar storage architecture.

### Current Reality: Ephemeral Storage (High Risk of Data Loss)
- In `services/user-service/src/controllers/brdSubscription.controller.ts`, uploaded avatars are saved to:
  ```typescript
  const uploadDir = path.resolve(process.env.STORAGE_DIR || 'storage/avatars');
  ```
- Inside the Docker container, the working directory is `/app` (`services/Dockerfile:35`). Consequently, files are written to `/app/storage/avatars`.
- **The Gap:** Inspection of `docker-compose.production.yml` reveals:
  - `accounting-service` mounts `./storage/receipts:/app/storage/receipts`.
  - `user-service` **HAS NO MOUNT** for `./storage/avatars` or any named volume.
- **Critical Consequence:** Any avatar uploaded by a student, teacher, or administrator is written directly to the Docker ephemeral container overlay layer. When `user-service` is rebuilt, updated, or recreated via `docker compose down && docker compose up`, **all uploaded avatar images will be permanently erased**, while the database will continue to point to dead image URLs.

---

## 2. Comparison of Architectural Solutions

To resolve this issue, two production-ready architectures were evaluated:

### Option A: Local Persistent Docker Volume / Host Bind-Mount
- **Architecture:** Mount a dedicated host directory or named Docker volume into the container at `/app/storage/avatars`.
  ```yaml
  # In docker-compose.production.yml
  user-service:
    volumes:
      - ./storage/avatars:/app/storage/avatars
  ```
  Or using a named Docker volume:
  ```yaml
  volumes:
    ox_digital_avatars_data:
  ```
- **Advantages:**
  1. Instant implementation with zero third-party dependencies.
  2. Zero recurring cloud storage or egress costs.
  3. Seamless compatibility with existing local file-serving route (`/api/users/avatars/:filename`).
- **Disadvantages:**
  1. Tied to a single physical server / host filesystem.
  2. Does not support horizontal multi-node scaling unless backed by distributed filesystems (e.g. NFS / GlusterFS / AWS EFS).
  3. Host disk backups must be manually configured.

### Option B: Cloud Object Storage (Amazon S3 / Cloudflare R2 / MinIO)
- **Architecture:** Uploaded avatars are streamed directly to an S3-compatible bucket via `@aws-sdk/client-s3`. The database stores the permanent S3 object key or CDN URL.
- **Advantages:**
  1. Infinite horizontal scalability and 99.999999999% data durability.
  2. Offloads static asset serving from Node.js Express process to a global CDN (e.g. Cloudflare / CloudFront).
  3. Native support for pre-signed private URLs for enhanced student privacy.
- **Disadvantages:**
  1. Requires cloud provider account, IAM credentials, bucket provisioning, and CORS setup.
  2. Incurs third-party storage and data transfer costs.
  3. Introduces external network latency and dependency on third-party cloud availability.

---

## 3. Recommended Phased Decision & Activation Strategy

| Phase | Strategy | Action Required |
|---|---|---|
| **Phase 1 (Immediate Staging & Single-Host Production)** | **Option A (Host Bind-Mount)** | Add `./storage/avatars:/app/storage/avatars` to `docker-compose.production.yml`. Ensure the host directory `D:\OX-DIGITAL\Mathe\OX-DIGITAL-GITHUB\storage\avatars` exists with write permissions. |
| **Phase 2 (High-Availability Cloud Expansion)** | **Option B (S3 / R2 Object Storage)** | Implement S3 adapter in `user-service` when migrating to multi-instance cloud cluster (AWS ECS / Kubernetes). |

---

## 4. Status: BLOCKED — OWNER APPROVAL REQUIRED

In strict compliance with the project's operational rules:
- Modifying `docker-compose.production.yml`, creating Docker volumes, and altering container mounting structures are **strictly prohibited** during this audit.
- Therefore, this issue is formally classified as **`BLOCKED — OWNER APPROVAL REQUIRED`**.
- The remediation patch is prepared and documented in the Owner Approval Checklist for immediate activation upon receiving explicit authorization.

