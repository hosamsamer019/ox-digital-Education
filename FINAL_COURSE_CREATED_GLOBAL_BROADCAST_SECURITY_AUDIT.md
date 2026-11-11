# OX-DIGITAL Education — Read-Only Security Audit of Global `course_created` Socket.IO Broadcast

**Audit Date:** November 9, 2026  
**Workspace:** `D:\OX-DIGITAL\Mathe\OX-DIGITAL-GITHUB`  
**Audit Mode:** STRICT READ-ONLY SECURITY AUDIT  
**Target:** `io.emit('course_created', course)` in `services/course-service/src/controllers/course.controller.ts:919`  
**Execution Mode:** INSPECT → TRACE → TEST REVIEW → REPORT → STOP  

---

## 1. Executive Verdict & Core Findings

### Verdict: **UNSAFE**

#### Justification:
1. **Unscoped Global Broadcast:** `services/course-service/src/controllers/course.controller.ts:919` executes `io.emit('course_created', course)`. In Socket.IO, `io.emit` bypasses all room scoping and broadcasts to every connected, authenticated socket across the entire server.
2. **Cross-Tenant Information Leakage:** Any authenticated user connected to `course-service`—including administrators, teachers, students, parents, and accountants from unrelated competitor institutions—receives the real-time event.
3. **Full Database Record Exposure:** The emitted payload is the raw, unredacted Prisma `Course` record (`db.course.create` result), which includes internal database UUIDs, course pricing (`price`), assigned `teacherId`, `institutionId`, `branchId`, curriculum descriptions, and academic levels.
4. **Unpublished Draft Disclosure:** The event fires for *all* created courses, including those created with `status: 'DRAFT'`. Unreleased draft courses, experimental curricula, and unapproved pricing structures are immediately broadcast across tenants before publication.
5. **Client-Side DevTools Accessibility:** While the two existing frontend components (`student-center/CoursesPage.tsx` and `student-online/CoursesPage.tsx`) do not inspect the payload argument, the raw course object is transmitted in cleartext over the WebSocket connection frame. Any client can inspect the WebSocket stream via browser Developer Tools or a custom client script to extract the exposed cross-tenant data.

---

## 2. Phase A — Event Producers Analysis

A comprehensive workspace-wide search for `course_created`, `io.emit`, `socket.emit`, and related dispatchers identified **exactly one active producer**:

### Producer Specification

- **File:** `services/course-service/src/controllers/course.controller.ts`
- **Line:** Line 919
- **Function:** `createCourse(req: AuthRequest, res: Response)`
- **Emission Type:** **Global Broadcast (`io.emit`)** — zero room targeting (`.to(...)` is not used).
- **Surrounding Implementation:**
  ```typescript
  // services/course-service/src/controllers/course.controller.ts:903-920
  const course = await db.course.create({
    data: {
      title: data.title,
      description: data.description,
      category: data.category,
      price: data.price,
      status: data.status,
      teacherId,
      institutionId,
      branchId,
      academicLevel: data.academicLevel as any,
      country: (data.country || null) as any,
      educationLevel: (data.educationLevel || null) as any,
      gradeLevel: (data.gradeLevel || null) as any
    }
  });
  io.emit('course_created', course);
  res.status(201).json(course);
  ```

### Pre-Emission Authorization Checks
Before reaching line 919, the following server-side checks execute:
1. Requester authentication (`requesterId` exists; HTTP 401 if absent).
2. Requester teacher authorization (`teacher.role === 'TEACHER' | 'ADMIN' | 'PRIMARY_MANAGER'`; HTTP 403 if invalid).
3. Manager tenant boundary check (`teacher.institutionId === tenantContext.institutionId`; HTTP 403 if mismatched).
4. Branch ownership validation (`validateBranchOwnership(branchId, institutionId)`; HTTP 400 if branch does not belong to the institution).

**Finding:** The HTTP course-creation request itself is properly authorized and tenant-isolated. However, once created, the backend uses `io.emit`, stripping all tenant isolation from the real-time notification.

---

## 3. Phase B — Event Consumers Analysis

A search across all frontend and backend services identified **exactly two active consumers**:

### Consumer 1: Center Student Courses Page
- **File:** `apps/frontend/src/app/components/student-center/CoursesPage.tsx`
- **Lines:** 108–121
- **Code:**
  ```typescript
  if (socket) {
    const handleSync = () => fetchCourses();
    socket.on('course_created', handleSync);
    socket.on('course_updated', handleSync);
    socket.on('course_deleted', handleSync);
    return () => {
      ...
      socket.off('course_created', handleSync);
    };
  }
  ```
- **Audience:** Center Students (`CENTER_STUDENT`).
- **Payload Handling:** **Ignored**. The handler signature is `() => fetchCourses()`. It does not accept or read the payload.
- **Side Effect:** Triggers an authenticated REST fetch (`courseService.getCourses()` and `courseService.getAvailableCourses()`).
- **REST Isolation:** Both backend REST endpoints (`getCourses` and `getAvailableCourses`) strictly filter by `tenantContext.institutionId` and `status: 'PUBLISHED'`.
- **UI Exposure:** The UI itself does not display cross-tenant courses because the REST response is tenant-filtered. However, the client's network layer has already received the raw WebSocket frame.

### Consumer 2: Online Student Courses Page
- **File:** `apps/frontend/src/app/components/student-online/CoursesPage.tsx`
- **Lines:** 111–124
- **Code:** Identical to Consumer 1: `const handleSync = () => fetchCourses(); socket.on('course_created', handleSync);`.
- **Audience:** Online Students (`ONLINE_STUDENT`).
- **Payload Handling:** Ignored. Serves exclusively as a cache-invalidation trigger.

### Other Dashboards & Roles
- **Teachers:** `TeacherDashboard.tsx` and teacher pages do **not** listen to `course_created`.
- **Administrators & Primary Managers:** `AdminDashboard.tsx` and `PrimaryManagerDashboard.tsx` do **not** listen to `course_created`.
- **Accountants & Parents:** Do **not** listen to `course_created`.
- **Backend Services:** No background worker, queue, or microservice subscribes to `course_created`.

---

## 4. Phase C — Socket Authentication and Room Membership

Inspection of `services/course-service/src/index.ts` lines 72–135 reveals the room-joining topology:

```typescript
io.use(async (socket, next) => {
  const token = socket.handshake.auth?.token;
  ...
  // Every user joins personal room
  socket.join(`user:${resolvedUserId}`);

  // Super Admin
  if (isPlatformSuperAdmin) {
    socket.join('admin');
  }

  // Admin & Primary Manager
  if (userRole === 'ADMIN' || userRole === 'PRIMARY_MANAGER') {
    if (decoded.institutionId) {
      socket.join(`institution:${decoded.institutionId}:admin`);
      if (decoded.branchId) {
        socket.join(`branch:${decoded.branchId}:admin`);
      }
    }
  }

  // Teacher
  if (userRole === 'TEACHER') {
    socket.join(`teacher:${resolvedUserId}`);
    courses.forEach(c => socket.join(`course:${c.id}`));
  }

  // Student & Parent
  if (userRole.includes('STUDENT') || userRole === 'PARENT') {
    enrollments.forEach(e => socket.join(`course:${e.courseId}`));
  }
});
```

### Critical Findings:
1. **Connection Authentication:** Handshake requires a signed, unexpired JWT. Unauthenticated clients are rejected.
2. **Room Scoping Irrelevance:** In Socket.IO architecture, `io.emit(event, data)` sends data to the default root namespace (`/`), delivering to every connected socket regardless of which rooms (`socket.join`) the client has entered.
3. **Student Room Topology:** Notice that students **never** join an institution room (`institution:${id}`). Students only join `user:${id}` and `course:${enrolledCourseId}`. When a course is newly created, zero students are enrolled, meaning `course:${newCourseId}` has zero subscribers.
4. **Timing:** `io.emit` occurs immediately after `db.course.create` completes, prior to returning HTTP 201 to the client.

---

## 5. Phase D — Payload and Data Exposure Analysis

### Emitted Data Structure
The object emitted over `io.emit('course_created', course)` contains:

| Field Name | Type | Sensitivity Level | Business / Security Impact |
|:---|:---|:---|:---|
| `id` | `UUID` | Low | Internal course entity identifier |
| `title` | `String` | **HIGH** | Exposes course names, curriculum topics, and upcoming offerings to competitor institutions |
| `description` | `String?` | **HIGH** | Exposes internal syllabus, pedagogical notes, and private descriptions across tenants |
| `category` | `String?` | Medium | Exposes curriculum categorization |
| `price` | `Float` | **HIGH** | Exposes institutional pricing strategies, discounts, and fee structures to competitors |
| `status` | `String` | **CRITICAL** | If `'DRAFT'`, exposes unreleased or unapproved courses to students and external institutions |
| `teacherId` | `UUID` | **HIGH** | Exposes teacher staffing and assignments across independent institutions |
| `institutionId` | `UUID?` | **HIGH** | Discloses the creating tenant, enabling competitor monitoring |
| `branchId` | `UUID?` | Medium | Discloses physical branch allocations |
| `academicLevel` | `Enum?` | Low | Target academic stage (`PREP_1` to `SEC_3`) |
| `createdAt` | `DateTime` | Low | Timestamp of creation |

### Role-by-Role Exposure Assessment

1. **Competitor Institution Administrator / Manager:**
   - **Impact:** Can observe every new course created by other schools/centers on the platform, including unreleased drafts, assigned teachers, and pricing strategies.
2. **Teacher from Another Institution:**
   - **Impact:** Can monitor competitor teachers' course development in real time.
3. **Student:**
   - **Impact:** Receives WebSocket event in browser memory. Can monitor DevTools network traffic to see draft courses that teachers have not yet published, private tutoring courses not intended for their center, or courses in foreign institutions.
4. **Parent / Accountant:**
   - **Impact:** Unnecessary metadata exposure over WebSocket connection.
5. **Unauthenticated / Disconnected Client:**
   - **Impact:** None. Handshake strictly enforces JWT authentication.

---

## 6. Phase E — Test Coverage Analysis

An exhaustive audit of all test files across the repository (`services/course-service` and `apps/frontend`) revealed:

- **Unit Tests for `course_created`:** **ZERO**.
- **Integration Tests for `course_created`:** **ZERO**.
- **Mock Tests exercising `course_created`:** **ZERO**.
- In `services/course-service/socket_security_isolation.test.ts`, tests 1–10d cover `admin`, `teacher:${id}`, `institution:${id}:admin`, and `homework_submitted`, but do not test `course_created`.
- In `apps/frontend`, tests for `CoursesPage` mock `useSocket: () => ({ socket: null })`, bypassing the event listener completely.

**Assessment:** The global broadcast behavior is completely unverified by automated tests.

---

## 7. Evidence Synthesis & Conclusion

| Assessment Vector | Evidence | Security Status |
|:---|:---|:---|
| Emission Scope | `io.emit('course_created', course)` without room scoping | **VULNERABLE** |
| Payload Minimization | Full raw Prisma record including price, status, description, tenant IDs | **VULNERABLE** |
| Draft State Protection | Draft courses emitted immediately upon creation | **VULNERABLE** |
| Handshake Security | JWT verification strictly required; unauthenticated blocked | **SECURE** |
| UI State Injection | Frontend ignores payload and triggers authorized REST fetch | **PARTIAL MITIGATION** (Network payload still exposed) |
| Active Consumer Value | Only 2 student components consume it as a 20s cache invalidator | **LOW VALUE / REDUNDANT** |

**Conclusion:** The implementation is **UNSAFE**. While the UI does not directly display foreign courses due to downstream REST scoping, broadcasting raw course records platform-wide violates multi-tenant confidentiality and leaks commercial pricing and draft content across tenant boundaries.

---

## 8. Remediation Design & Recommendations (Non-Implemented)

Because the only active consumers (`student-center/CoursesPage.tsx` and `student-online/CoursesPage.tsx`) ignore the payload and already maintain a 20-second background polling cycle and tab-visibility auto-refresh, the smallest, safest, and most robust remediation strategy is:

### Option A: Remove the Global Emission Completely (Recommended — Minimal Footprint)
- **Rationale:**
  1. No teacher, admin, or manager interface listens to `course_created`.
  2. The only two consumers are student catalog pages that already poll every 20 seconds. Course creation is an administrative action; a 0–20 second delay for a student catalog refresh is standard, acceptable, and completely eliminates the cross-tenant exposure risk without adding new room subscriptions or Socket dependencies.
  3. Eliminates zero-day payload leakage and removes unnecessary network overhead.
- **Files Modified:** Exactly 1 file:
  - `services/course-service/src/controllers/course.controller.ts` (remove line 919).
  - Clean up the 2 listener hooks in `student-center/CoursesPage.tsx` and `student-online/CoursesPage.tsx`.

### Option B: Scope Emission to Institution Students (If Instant Refresh Is Mandatory)
If the product strictly requires instant 0-second updates for students:
1. **Student Room Enrollment:** Update `services/course-service/src/index.ts` so that students join an institution room (e.g. `institution:${decoded.institutionId}:students`).
2. **Publication Guard:** Only emit when `course.status === 'PUBLISHED'` and `course.institutionId` is non-null. Draft courses must NEVER be emitted.
3. **Payload Minimization:** Do not emit the full course record. Emit only a minimal cache-invalidation token:
   ```typescript
   if (course.status === 'PUBLISHED' && course.institutionId) {
     io.to(`institution:${course.institutionId}:students`).emit('course_created', {
       id: course.id,
       institutionId: course.institutionId
     });
   }
   ```
4. **Files Modified:**
   - `services/course-service/src/index.ts` (handshake room join)
   - `services/course-service/src/controllers/course.controller.ts` (scoped emission logic)
   - `services/course-service/socket_security_isolation.test.ts` (new regression tests)

---

## 9. Operational Integrity Statement

- **Strict Read-Only Audit:** Zero files were modified, created (outside this report), renamed, or deleted.
- **Zero Database Operations:** Ports 5432 and 5433 were not accessed; no migrations, SQL queries, or seeds were executed.
- **Zero Docker / Runtime Operations:** No containers were started, stopped, or inspected; Localhost was not activated.
- **Zero Git Operations:** No commits, checkouts, pushes, or branch changes were made.
- **STOP:** Execution has halted. Awaiting your explicit instructions.

