# OX-DIGITAL Education — Profile Image Lifecycle Verification Report

**Workspace:** `D:\OX-DIGITAL\Mathe\OX-DIGITAL-GITHUB`  
**Date:** 2026-11-07  
**Implementation Phase:** Phase C & G  
**Status:** COMPLETE & VERIFIED  

---

## 1. Executive Summary

This report documents the verification of the complete user profile picture lifecycle within OX-DIGITAL Education.

Previously, profile picture uploads experienced a broken serving loop:
1. `user-service` persisted avatar files to `storage/avatars/` and generated an absolute URL path `/storage/avatars/...`.
2. Nginx had no location block routing `/storage` to `user-service`.
3. Express did not serve `/storage` statically, resulting in 404 Not Found responses.
4. `SharedLayout.tsx` and role dashboards did not reference `user.profilePictureUrl`, unconditionally rendering static first-letter initials.

The remediation establishes:
1. Validated upload lifecycle (JPG, PNG, WebP <= 2MB).
2. Proper endpoint URL generation: `/api/users/avatars/:filename`.
3. Public static image serving in `user-service` with path-traversal protection and HTTP cache headers.
4. Global avatar rendering across headers and navigation sidebars with resilient `onError` fallback to styled user initials.

---

## 2. Server-Side Avatar Pipeline

### 2.1 File Validation & Storage
In `services/user-service/src/controllers/brdSubscription.controller.ts`:
- **Size Limit:** File sizes exceeding 2MB (`2 * 1024 * 1024` bytes) are rejected with HTTP 400 (`File size exceeds 2MB limit`).
- **MIME Validation:** Validated against `image/jpeg`, `image/png`, and `image/webp`. Magic-byte signature checking ensures file contents match their declared MIME types.
- **Storage Target:** Files are stored in `storage/avatars/avatar-${userId}-${timestamp}.${ext}` with unique file identifiers preventing collision and caching stale images.

### 2.2 Serving Endpoint (`/api/users/avatars/:filename`)
Because Nginx proxies `/api/users` directly to `user-service:4002`, serving avatars under `/api/users/avatars/:filename` works immediately through existing routing without requiring Nginx reloads:
- **Public Access:** Registered in `brdSubscription.routes.ts` *before* `verifyToken` middleware, allowing standard browser `<img src="/api/users/avatars/...">` tags to load images without needing authorization headers.
- **Path Traversal Protection:** Validates that `filename` contains no `..`, `/`, or `\` path traversal characters.
- **MIME Headers:** Sets accurate `Content-Type` (`image/jpeg`, `image/png`, `image/webp`).
- **Caching Headers:** Emits `Cache-Control: public, max-age=86400, stale-while-revalidate=604800` for optimal client performance.

---

## 3. Frontend Avatar Display & Fallback Architecture

### 3.1 SharedLayout Integration
In `apps/frontend/src/app/components/shared/SharedLayout.tsx`:
Both the desktop sidebar user profile card and the top navigation header bar render the live profile picture:

```tsx
<div className="relative flex-shrink-0">
  {user?.profilePictureUrl ? (
    <>
      <img
        src={user.profilePictureUrl}
        alt={user?.name || 'User Avatar'}
        className="w-8 h-8 rounded-full object-cover shadow-xs ring-1 ring-border/50"
        onError={(e) => {
          e.currentTarget.style.display = 'none';
          const fallback = e.currentTarget.nextElementSibling;
          if (fallback) (fallback as HTMLElement).style.display = 'flex';
        }}
      />
      <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground hidden items-center justify-center font-bold text-sm shadow-xs">
        {userInitial}
      </div>
    </>
  ) : (
    <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold text-sm shadow-xs">
      {userInitial}
    </div>
  )}
</div>
```

### 3.2 Account Settings Profile Picture Manager
In `apps/frontend/src/app/components/shared/AccountSettingsPage.tsx`:
- Users can preview their profile picture before saving.
- Real-time client-side file size and format validation (rejects files > 2MB or non-image formats).
- Save action calls `userService.uploadProfilePicture(formData)`.
- Updates `AuthContext` immediately via `updateUser({ profilePictureUrl: newUrl })`, updating header and sidebar avatars across the application without requiring a page reload.
- Remove action allows clearing the profile picture and reverting to styled initials.

---

## 4. Verification Matrix

| Test Case | Verification Check | Expected Behavior | Result |
| :--- | :--- | :--- | :--- |
| **TC-AV-01** | Upload file > 2MB | Rejected with HTTP 400 | PASS |
| **TC-AV-02** | Upload non-image (e.g. .pdf, .exe) | Rejected with HTTP 400 invalid MIME | PASS |
| **TC-AV-03** | Upload valid JPEG / PNG / WebP | Persisted to storage, returns `/api/users/avatars/...` | PASS |
| **TC-AV-04** | Directory traversal in filename (`/avatars/..%2F..%2Fetc%2Fpasswd`) | Blocked with HTTP 400 | PASS |
| **TC-AV-05** | Browser `<img>` tag load | Image stream returned with correct MIME & Cache-Control | PASS |
| **TC-AV-06** | Image loading error (network glitch or missing file) | Gracefully displays styled user initial | PASS |
| **TC-AV-07** | Immediate UI synchronization | Avatar updates in header and sidebar without page reload | PASS |

