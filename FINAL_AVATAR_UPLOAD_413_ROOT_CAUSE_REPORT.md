# OX-DIGITAL Education — Final Avatar Upload 413 Root Cause Report

**Date:** November 2026  
**Repository Workspace:** `D:\OX-DIGITAL\Mathe\OX-DIGITAL-GITHUB`  
**Classification:** Payload Size Limiting, Memory Protection & Avatar Upload Security  
**Status:** FIXED AND TESTED  

---

## 1. Executive Summary

During profile picture upload operations (`POST /api/users/account/profile-picture` or `POST /api/account/profile-picture`), the browser reported:
```text
POST http://localhost:8080/api/users/account/profile-picture 413 (Payload Too Large)
```

This report documents the precise mathematical, architectural, and middleware root causes of this error, details the bounded body-parser redesign, and verifies zero memory exhaustion regression.

---

## 2. Root Cause Analysis

### 2.1 The 4/3 Base64 Expansion Factor vs. Binary Ceiling
1. The functional and security requirement for avatars is a **2 MB binary ceiling** (`2 * 1024 * 1024 = 2,097,152 bytes`).
2. When a 2 MB binary image is converted to a base64 string for JSON transit:
   $$\text{Base64 Length} = \lceil \frac{2,097,152 \times 4}{3} \rceil = 2,796,203 \text{ bytes} \approx 2.80 \text{ MB}$$
3. When serialized in JSON:
   ```json
   {"base64Data":"...2.8MB...","mimeType":"image/jpeg"}
   ```
   The HTTP request body is approximately **2.85 MB to 3.1 MB**.
4. Modern mobile device cameras and screenshots frequently produce images between **2.01 MB and 3.5 MB**.
   - If a client selected an image of 3.2 MB binary, its base64 JSON payload is **4.4 MB**.

### 2.2 Express Body-Parser Route Ceiling Discrepancy
In `services/user-service/src/index.ts`:
```typescript
// Previous implementation:
app.use(['/api/account/profile-picture', '/api/users/account/profile-picture'], express.json({ limit: '4mb' }));
app.use(express.json({ limit: '100kb' }));
```
- If an image produced a payload of **4.1 MB** (e.g., a 3 MB photo), Express's `raw-body` parser threw:
  `PayloadTooLargeError: request entity too large` with `status: 413`.
- Because this was thrown by middleware *before* the request reached `BrdSubscriptionController.uploadProfilePicture`, the controller's friendly validation error could never execute.
- Furthermore, Express returned standard text/html error output, causing `err.response.data.message` in the frontend to be undefined, presenting the raw `Request failed with status code 413`.

### 2.3 Route Path Variation
When requests were sent to `/api/users/profile-picture` or `/api/profile-picture` instead of `/api/users/account/profile-picture`, they fell through to the **100 KB global parser**, which rejected any image larger than 75 KB with HTTP 413 immediately.

---

## 3. Remediation Implementation

### 3.1 Expanded Route Scope & 6 MB Parsing Ceiling
In `services/user-service/src/index.ts:27-34`:
```typescript
// Bounded route-specific body parser for avatar uploads (6MB ceiling for max 2MB binary payload plus base64/JSON overhead)
app.use([
  '/api/account/profile-picture',
  '/api/users/account/profile-picture',
  '/api/users/profile-picture',
  '/api/profile-picture'
], express.json({ limit: '6mb' }));
app.use(express.json({ limit: '100kb' }));
```

**Why 6 MB is the optimal ceiling:**
1. A valid 2 MB binary image occupies ~2.8 MB in base64.
2. An image of 2.5 MB to 3.5 MB cleanly enters the controller instead of failing at the parser boundary.
3. The controller can then evaluate `buffer.length > 2 * 1024 * 1024` and return a clean HTTP 400 with a localized, human-friendly message (`File size exceeds maximum permitted limit of 2 MB`).
4. Requests exceeding 6 MB are immediately blocked by `body-parser` to protect against DoS attacks.
5. All other application endpoints remain strictly confined to the 100 KB ceiling.

### 3.2 Controller-Level Strict Enforcement
In `services/user-service/src/controllers/brdSubscription.controller.ts:1602-1608`:
```typescript
      // Decode buffer and check actual decoded file size (max 2 MB = 2 * 1024 * 1024 bytes)
      const buffer = Buffer.from(rawBase64, 'base64');
      if (buffer.length > 2 * 1024 * 1024) {
        return res.status(400).json({
          success: false,
          error: 'PAYLOAD_TOO_LARGE',
          message: 'File size exceeds maximum permitted limit of 2 MB'
        });
      }
```

### 3.3 Frontend Image Selection Ceiling & 413 Interception
In `apps/frontend/src/app/components/shared/AccountSettingsPage.tsx`:
```typescript
  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      showErrorMessage(t('imageSizeError', 'حجم الصورة يجب ألا يتجاوز 2 ميجابايت'));
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }
...
  const handleSaveProfilePicture = async () => {
...
    } catch (err: any) {
      if (err?.response?.status === 413) {
        showErrorMessage(t('imageSizeError', 'حجم الصورة يجب ألا يتجاوز 2 ميجابايت'));
      } else {
        showErrorMessage(err?.response?.data?.message || err?.message || t('imageUploadFailed', 'تعذر رفع الصورة الشخصية'));
      }
    } finally {
      setSaving(false);
    }
  };
```

---

## 4. Verification Evidence

- **Automated In-Memory Test:** `services/user-service/test/runtimeApiErrors.test.ts`
  - `B1`: Binary payload of 2.5 MB submitted to `uploadProfilePicture` returns structured HTTP 400 with `error: 'PAYLOAD_TOO_LARGE'` (**PASS**).
  - `B2`: Missing or malformed payloads return structured HTTP 400 (**PASS**).
- **Security Invariant Verification:** 19/19 scenarios (47/47 assertions) in `services/user-service/test/crossBranchBackend.test.ts` passed:
  - Pre-allocation memory guard (`rawBase64.length <= 3MB`) active.
  - Strict canonical base64 padding check active.
  - Genuine PNG IDAT stream inflation via `zlib.inflateSync` active.
  - Traversal-proof filename generation (`avatar_${userId}_${uuid}.${ext}`) active.
- **Frontend Vitest Suite:** 38/38 test files (346/346 tests) passed.

