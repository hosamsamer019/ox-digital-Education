# OX-DIGITAL Education — Final HLS Playlist & Media Segment Security Report

**Audit Date:** November 9, 2026  
**Audited Target:** `D:\OX-DIGITAL\Mathe\OX-DIGITAL-GITHUB`  
**Focus Files:**
- `services/course-service/src/controllers/course.controller.ts` (`streamLessonHls`, `resolveLessonHlsMasterKey`)
- `services/course-service/src/middlewares/auth.middleware.ts` (`verifyToken`)
- `services/course-service/src/utils/enrollment.ts` (`checkUserEnrollment`)
- `services/course-service/src/services/storage.adapter.ts` (`getHlsObjectStream`, `setHlsStreamProviderForTests`)
- `services/course-service/hls_gateway.test.ts`
- `services/course-service/course_ownership_authorization.test.ts`

---

## 1. Executive Summary

This report establishes the security verification of the Authenticated Private HLS Streaming Gateway and video ticket boundary in OX-DIGITAL Education.

Private educational video assets (manifests `.m3u8` and media segments `.ts`) stored in Cloudflare R2 are protected against direct browser exposure, path traversal, token scope hijacking, cross-tenant leaking, and unauthorized access by unenrolled or financially restricted students.

---

## 2. HLS Gateway Architecture & Security Guardrails

```
Client Player (Hls.js / VideoJS)
   │
   ├─► 1. Request: GET /api/courses/lessons/:id/hls/master.m3u8 (with Authorization: Bearer <ticket>)
   │
   ▼
[verifyToken Middleware]
   │ ├─ Decodes JWT & checks signature (JWT_SECRET)
   │ ├─ Verifies expiration timestamp (`exp`)
   │ ├─ Checks purpose === 'video-stream'
   │ └─ Verifies ticket lesson scope: decoded.lessonId === requestedLessonId (Rejects mismatch with 403)
   │
   ▼
[streamLessonHls Controller]
   │ ├─ 2. Fetch Lesson: db.lesson.findUnique({ where: { id } })
   │ ├─ 3. Strict Enrollment Check: checkUserEnrollment(req.user, lesson.courseId)
   │ │     ├─ Financial check: Center students with RESTRICTED status -> REJECT (403)
   │ │     ├─ Tenant check: Institution mismatch -> REJECT (403)
   │ │     ├─ Teacher check: Must be course owner teacherId -> Else REJECT (403)
   │ │     └─ Student check: Verified enrollment record -> Else REJECT (403)
   │ │
   │ ├─ 4. Resolve Master Key: videos/{uploadId}/attempts/{attempt}/hls/master.m3u8
   │ ├─ 5. Attempt Prefix Boundary: locks scope strictly to attempt folder
   │ ├─ 6. Subpath Sanitization: decodeURIComponent, normalize path, reject `..`, absolute paths
   │ ├─ 7. Extension Allowlist: strictly allow ONLY `.m3u8` and `.ts` (reject `.key`, `.env`, `.php`, etc.)
   │ ├─ 8. Storage Fetch: getHlsObjectStream(targetR2Key, rangeHeader)
   │ ├─ 9. Cache-Control & CORP: `private, no-cache, no-store` (m3u8) / `private, max-age=86400, immutable` (ts)
   │ └─ 10. Zero-Token Header Rewriting: manifest URLs are NEVER polluted when using Authorization header
   │
   ▼
Stream to client (200 OK / 206 Partial Content)
```

---

## 3. Detailed Boundary Defense Implementations

### 3.1 Path Traversal & Extension Enforcement
Located in `services/course-service/src/controllers/course.controller.ts`:
```typescript
const normalizedSubpath = path.posix.normalize(decodedSubpath.replace(/\\/g, '/')).replace(/^\/+/, '');

// Strict rejection of path traversal
if (
  normalizedSubpath.includes('..') ||
  normalizedSubpath.startsWith('../') ||
  normalizedSubpath.includes('/../') ||
  normalizedSubpath.endsWith('/..') ||
  path.posix.isAbsolute(decodedSubpath) ||
  decodedSubpath.startsWith('/') ||
  decodedSubpath.startsWith('\\')
) {
  return res.status(400).json({ message: 'Path traversal forbidden' });
}

// Extension verification: only serve .m3u8 manifests and .ts media chunks
const isM3u8 = normalizedSubpath.endsWith('.m3u8');
const isTs = normalizedSubpath.endsWith('.ts');
if (!isM3u8 && !isTs) {
  return res.status(400).json({ message: 'Unsupported media format. Gateway only serves .m3u8 and .ts' });
}

// Prefix boundary enforcement
const targetR2Key = `${attemptPrefix}${normalizedSubpath}`;
if (!targetR2Key.startsWith(attemptPrefix)) {
  return res.status(400).json({ message: 'Access outside HLS scope forbidden' });
}
```

### 3.2 Ticket Scope Mismatch Defense
Located in `services/course-service/src/middlewares/auth.middleware.ts`:
```typescript
if (decoded.purpose === 'video-stream') {
  const origUrl = req.originalUrl || '';
  const reqPath = req.path || '';
  const isStreamingEndpoint =
    origUrl.includes('/stream') ||
    reqPath.includes('/stream') ||
    origUrl.includes('/hls') ||
    reqPath.includes('/hls');

  const urlLessonMatch = origUrl.match(/\/lessons\/([a-zA-Z0-9_-]+)\/(stream|hls)/);
  const requestedLessonId = urlLessonMatch ? urlLessonMatch[1] : req.params?.id;

  if (!isStreamingEndpoint || !requestedLessonId || decoded.lessonId !== requestedLessonId) {
    return res.status(403).json({ message: 'Forbidden: Video stream ticket cannot be used for standard API requests or other lessons.' });
  }
}
```

---

## 4. Test Verification Evidence

### 4.1 HLS Gateway Isolated Test Suite (`hls_gateway.test.ts`)
Executed directly using `npx tsx hls_gateway.test.ts`:

```
===================================================================
OX-DIGITAL Phase 2C.1 — Authenticated Private HLS Gateway Tests
===================================================================

[PASS] Test 1: unauthenticated request rejected (401)
[PASS] Test 2: authenticated authorized user allowed (200)
[PASS] Test 3: authenticated but unauthorized user rejected (403)
[PASS] Test 4: authorization failure does not reveal object existence (returns 403 not 404)
[PASS] Test 5: normal master.m3u8 path accepted
[PASS] Test 6: normal variant playlist accepted
[PASS] Test 7: normal .ts segment accepted
[PASS] Test 8: ../ traversal rejected (400)
[PASS] Test 9: encoded traversal rejected (400)
[PASS] Test 10: absolute path rejected (400)
[PASS] Test 11: arbitrary unrelated object key rejected (400)
[PASS] Test 12: prefix escape attempt rejected (400)
[PASS] Test 13: gateway requests only the expected lesson HLS prefix
[PASS] Test 14: raw source object cannot be requested through HLS route (400)
[PASS] Test 15: another lesson's HLS object cannot be requested through route
[PASS] Test 16: master/variant playlist returns HLS content type
[PASS] Test 17: .ts returns video/mp2t
[PASS] Test 18: storage 404 is handled safely (404)
[PASS] Test 19: storage failure does not expose internal exception details
[PASS] Test 20: playlist references remain gateway-safe with appended token
[PASS] Test 21: no private R2 URL or credentials leaked to browser
[PASS] Test 22: repeated authorized requests remain safe and idempotent
[PASS] Test 23: video stream ticket (purpose: 'video-stream') authenticated on HLS gateway
[PASS] Test 24: Authorization header accesses master playlist with ZERO token in manifest URLs
[PASS] Test 25: Authorization header accesses variant playlist with ZERO token in manifest URLs
[PASS] Test 26: Authorization header token accesses .ts segment with private cache headers
[PASS] Test 27: invalid Authorization header token is rejected (401)
[PASS] Test 28: expired Authorization header token is rejected (401)
[PASS] Test 29: single token works across master, variant, and segment without issuing new tokens
[PASS] Test 30: credentials and tokens are never included in error response bodies
[PASS] Test 31: query-token propagation uses exactly the authenticated ticket without generating new tokens

===================================================================
Results: 31 Passed, 0 Failed (Total 31)
===================================================================
Exit Code: 0
```

### 4.2 Course Ownership & Video Security Tests (`course_ownership_authorization.test.ts`)
Executed directly using `npx tsx course_ownership_authorization.test.ts`:
- **Scenario 6:** Teacher A obtains video streaming ticket without needing student enrollment -> **PASS**
- **Scenario 17:** Cross-tenant video ticket access strictly blocked with 403 Forbidden -> **PASS**
- **Scenario 20:** Video ticket lesson scope mismatch strictly rejected with 403 Forbidden -> **PASS**
- **Scenario 22:** Non-owner Teacher B rejected with 403 when requesting ticket for Teacher A lesson -> **PASS**
- **Scenario 23:** Video streaming ticket strictly rejected with 403 when used on standard API routes -> **PASS**
- **Scenario 24:** Tampered ticket signature rejected with 401 Unauthorized -> **PASS**
- **Scenario 25:** Expired video ticket rejected with 401 Unauthorized -> **PASS**
- **Scenario 26:** Financially restricted student strictly blocked from video ticket with 403 Forbidden -> **PASS**
- **Total Scenarios:** 27 / 27 Passed (Exit Code: 0).

---

## 5. Security Decision & Verdict

**HLS Gateway Security Status:** `VERIFIED`  
All 12 required security boundaries (playlist access, segment delivery, 401 on missing/expired/tampered tokens, 403 on lesson mismatch/cross-tenant/non-owner teacher/restricted student, 403 on ticket reuse, and 400 on traversal/unauthorized extensions) are enforced in production controllers and verified by automated regression suites.

