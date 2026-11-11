# OX-DIGITAL Education — Avatar Upload Security & Storage Durability Final Assessment

**Date:** November 8, 2026  
**Auditor / Security Engineer:** Forensic Security & Infrastructure Resilience Specialist  
**Workspace:** Strictly `D:\OX-DIGITAL\Mathe\OX-DIGITAL-GITHUB`  
**Target:** Profile Image Upload Pipeline, Base64 Controller Parsing, and Storage Layer  
**Status:** **CODE HARDENING VERIFIED; STORAGE MIGRATION BLOCKED — OWNER APPROVAL REQUIRED**

---

## 1. Executive Summary

This assessment provides the final forensic and architectural evaluation of user profile picture upload, persistence, and storage durability within the OX-DIGITAL Education platform.

Two key findings define the current avatar state:
1. **Application-Layer Denial of Service (DoS) Hardening (COMPLETED & VERIFIED):**  
   The controller `services/user-service/src/controllers/brdSubscription.controller.ts:1332` was hardened by introducing an early pre-allocation base64 payload length check (`base64Data.length > 3 * 1024 * 1024`). This prevents malicious clients from allocating massive uncompressed Buffers on the Node.js V8 heap, eliminating the vulnerability of process crashes or Out-Of-Memory (OOM) events.
2. **Infrastructure Storage Durability (BLOCKED — OWNER APPROVAL REQUIRED):**  
   Avatars are currently written to an ephemeral directory inside the running microservice container (`/app/uploads/avatars`). Without mounting a dedicated, named Docker volume (e.g., `ox_digital_avatars_data`), any container recreation, restart, or deployment replacement will immediately erase all stored user avatars. Modifying Docker Compose or mounting volumes is strictly forbidden without explicit Owner Approval.

---

## 2. Controller Vulnerability Remediation & Hardening

### The Vulnerability
In previous versions of `uploadProfilePicture`:
```typescript
const matches = image.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
const buffer = Buffer.from(matches[2], 'base64'); // Heap allocation before size validation!
if (buffer.length > 2 * 1024 * 1024) {
  return res.status(400).json({ message: 'حجم الصورة يجب ألا يتجاوز 2 ميجابايت' });
}
```
If an attacker transmitted a 100MB base64 string, Node.js attempted to allocate the uncompressed Buffer in heap memory *before* evaluating whether the resulting buffer exceeded the 2MB threshold. Multiple concurrent requests of this nature would exhaust Node's heap memory and crash the microservice.

### The Source Fix
In `services/user-service/src/controllers/brdSubscription.controller.ts:1328-1338`:
```typescript
const matches = image.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
if (!matches || matches.length !== 3) {
  return res.status(400).json({ message: 'صيغة الصورة غير صالحة' });
}

const mimeType = matches[1].toLowerCase();
const base64Data = matches[2];

// Pre-allocation heap exhaustion guard (enforce 3MB base64 string ceiling for 2MB binary)
if (base64Data.length > 3 * 1024 * 1024) {
  return res.status(400).json({ message: 'حجم الصورة يجب ألا يتجاوز 2 ميجابايت' });
}

const buffer = Buffer.from(base64Data, 'base64');
if (buffer.length > 2 * 1024 * 1024) {
  return res.status(400).json({ message: 'حجم الصورة يجب ألا يتجاوز 2 ميجابايت' });
}
```

### Verification
- **Pre-Allocation Guard:** Active and tested.
- **MIME Whitelist:** Strictly permits `image/jpeg`, `image/png`, and `image/webp`.
- **Magic Bytes Validation:** Inspects file binary signatures before persisting.
- **Sanitized Filename:** Random UUID v4 prevents path traversal attacks (`path.join(uploadDir, \`\${crypto.randomUUID()}.\${ext}\`)`).

---

## 3. Storage Durability Risk Analysis

### Current Architecture: Container Ephemeral Local Disk
The controller writes files to:
```typescript
const uploadDir = path.resolve(process.cwd(), 'uploads/avatars');
```
Inside Docker, `process.cwd()` resolves to `/app`, meaning files reside at `/app/uploads/avatars` on the container's writable overlay layer.

### Critical Operational Risk
| Action | Impact on Stored Avatars | Severity |
| :--- | :--- | :--- |
| Normal container restart (`docker restart`) | Data usually retained on local overlay | Low |
| Container recreation (`docker compose down && up`) | **Total Data Loss (100% of avatar files erased)** | **CRITICAL** |
| Image rebuild / redeploy | **Total Data Loss (100% of avatar files erased)** | **CRITICAL** |
| Database references | Orphaned DB records: `profilePictureUrl` points to missing files (HTTP 404) | High |

---

## 4. Recommended Infrastructure Architecture (For Owner Approval)

To achieve enterprise-grade durability, the platform requires one of two architectures:

### Option A: Named Docker Persistent Volume (Recommended for On-Premise/VPS)
1. Define volume in `docker-compose.yml`:
   ```yaml
   volumes:
     ox_digital_avatars_data:
       name: ox_digital_avatars_data
   ```
2. Mount to microservices serving or writing avatars:
   ```yaml
   services:
     user-service:
       volumes:
         - ox_digital_avatars_data:/app/uploads/avatars
     api-gateway:
       volumes:
         - ox_digital_avatars_data:/app/uploads/avatars:ro
   ```

### Option B: S3-Compatible Object Storage (Cloud Ready)
- Stream uploads directly to AWS S3, Cloudflare R2, or MinIO.
- Zero container storage dependencies; infinite scalability.

---

## 5. Execution Boundary Compliance

In strict adherence to instructions:
- **No Docker containers were recreated, replaced, restarted, or deleted.**
- **No Docker volumes were created or mounted.**
- **No Compose configuration files were altered.**
- **Classification:**
  - Application Security Hardening: **VERIFIED**
  - Infrastructure Storage Migration: **BLOCKED — OWNER APPROVAL REQUIRED**

