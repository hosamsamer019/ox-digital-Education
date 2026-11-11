# OX-DIGITAL Education — Final Homework Socket.IO Room Integration Audit

**Audit Date:** November 9, 2026  
**Workspace:** `D:\OX-DIGITAL\Mathe\OX-DIGITAL-GITHUB`  
**Mode:** STRICT READ-ONLY AUDIT  
**Status:** BLOCKED (Branch-to-Institution Ownership Unproven & Unenforced; Emitter/Handshake Room Names Matched; Global Broadcast Eliminated)

---

## 1. Executive Verdict & Summary

### Verdict: **BLOCKED**

#### Justification:
1. **Room Name Compatibility:** **PASS**. The emitter rooms in `emitHomeworkSubmissionNotification` (`teacher:${course.teacherId}`, `institution:${course.institutionId}:admin`, `branch:${course.branchId}:admin`) character-for-character match the rooms joined during handshake in `services/course-service/src/index.ts` (`teacher:${resolvedUserId}`, `institution:${decoded.institutionId}:admin`, `branch:${decoded.branchId}:admin`).
2. **Global Broadcast Elimination:** **PASS**. The legacy unscoped `io.to('admin')` emission has been completely eliminated from all active controllers and production source files. No wildcard or unscoped global broadcast remains.
3. **Branch-to-Institution Ownership:** **BLOCKED (UNPROVEN / UNENFORCED)**.
   - The PostgreSQL/Prisma schema defines separate foreign keys for `Course.institutionId -> Institution.id` and `Course.branchId -> Branch.id`. There is **no composite foreign key** constraint requiring `(branchId, institutionId)` to match `Branch(id, institutionId)`.
   - In `services/course-service/src/controllers/course.controller.ts`, both `createCourse` (line 871) and `updateCourse` (line 946) accept `branchId` from the client request body for managers/admins without verifying that the referenced branch belongs to the course's `institutionId`.
   - In `services/course-service/src/controllers/homework.controller.ts`, `submitHomework` loads `homework.course` with `{ select: { id: true, teacherId: true, institutionId: true, branchId: true } }` without joining `Branch` to verify that `course.branch.institutionId === course.institutionId`.
   - In `emitHomeworkSubmissionNotification`, room targeting performs only a **mere presence check** (`if (course?.institutionId) { ... if (course.branchId) { ... } }`).
   - Consequently, if a course record is associated with a `branchId` from an unrelated institution, student homework submission events are emitted directly to the admin room of the foreign branch (`branch:${course.branchId}:admin`), violating multi-tenant isolation.
4. **Integration Test Reality:** **MOCKED ONLY**. All 20 tests in `services/course-service/socket_security_isolation.test.ts` run against in-memory `MockSocket` and `MockSocketIOServer` with a duplicate mock auth function. No real Socket.IO network transport or live controller integration tests have been executed.

Per Section 8 rules (*"BLOCKED if any recipient room name is mismatched, branch ownership cannot be established, or a global/unscoped broadcast remains active. Do not downgrade a security issue to a documentation limitation."*), the integration is marked **BLOCKED**.

---

## 2. Exact Source Files Inspected

1. `services/course-service/src/index.ts` (Socket.IO server creation, JWT handshake middleware, room assignment)
2. `services/course-service/src/socket.ts` (Socket.IO instance proxy and `setIO` export)
3. `services/course-service/src/controllers/homework.controller.ts` (`emitHomeworkSubmissionNotification`, `submitHomework`)
4. `services/course-service/src/controllers/course.controller.ts` (`createCourse`, `updateCourse`, tenant context validation)
5. `services/course-service/src/controllers/exam.controller.ts` (Socket.IO emissions review)
6. `packages/database/prisma/schema.prisma` (`Institution`, `Branch`, `Course`, `Homework`, `Submission` models)
7. `services/course-service/socket_security_isolation.test.ts` (Mock test suite, assertions, mock server)
8. `services/course-service/sec004_runtime.test.ts` (Legacy runtime isolation scratch script)
9. `apps/frontend/src/app/contexts/SocketContext.tsx` (Client connection initialization, auth payload)
10. `apps/frontend/src/app/hooks/useSmartNavigationCounters.ts` (Client Socket event listeners, deduplication, counter refresh)

---

## 3. Audit A — Exact Socket.IO Room Name Compatibility

### 3.1 Room Compatibility Evidence Table

| Recipient | Claimed in Prompt/Prose | Actual Emitter Source Room | Actual Handshake Join Room | Authorized Role & Handshake Rule | Match Status |
|:---|:---|:---|:---|:---|:---|
| **Owning Teacher** | `user_${teacherId}` | `teacher:${course.teacherId}` (`homework.controller.ts:355`) | `teacher:${resolvedUserId}` (`src/index.ts:117`) | `userRole === 'TEACHER'` && `resolvedUserId` | **PASS** (Exact Match) |
| **Institution Admin** | `institution_${institutionId}` | `institution:${course.institutionId}:admin` (`homework.controller.ts:361`) | `institution:${decoded.institutionId}:admin` (`src/index.ts:104`) | `(userRole === 'ADMIN' \|\| userRole === 'PRIMARY_MANAGER')` && `decoded.institutionId` | **PASS** (Exact Match) |
| **Branch Admin** | `branch_${branchId}` | `branch:${course.branchId}:admin` (`homework.controller.ts:366`) | `branch:${decoded.branchId}:admin` (`src/index.ts:106`) | `(userRole === 'ADMIN' \|\| userRole === 'PRIMARY_MANAGER')` && `decoded.institutionId` && `decoded.branchId` | **PASS** (Exact Match) |

> [!NOTE]
> The previous user prompt and report prose referenced an underscore format (`user_${teacherId}`, `institution_${institutionId}`, `branch_${branchId}`). Source code inspection reveals that the actual implementation consistently uses colon notation (`teacher:${id}`, `institution:${id}:admin`, `branch:${id}:admin`) across both emitter and handshake. They match each other character-for-character.

### 3.2 Handshake Authorization Rules & Personal Rooms
1. **Personal User Rooms:** In `index.ts:84`, every authenticated socket executes `socket.join(`user:${resolvedUserId}`)`. However, `emitHomeworkSubmissionNotification` explicitly targets `teacher:${course.teacherId}`, which is only joined by users with `role === 'TEACHER'`.
2. **Platform Admin Rejection:** In `index.ts:102-111`, normal `ADMIN` and `PRIMARY_MANAGER` sockets without `isPlatformSuperAdmin === true` or `role === 'SUPER_ADMIN'` are strictly scoped to their tenant rooms. If `decoded.institutionId` is absent, they are rejected with a fail-closed warning and never join `admin`.
3. **Room Symmetry Audit:**
   - `user:${resolvedUserId}`: Joined by all users; never emitted to in `course-service`.
   - `admin`: Joined by super-admins; zero emissions in `course-service` (legacy broadcast eliminated).
   - `teacher:${id}`: Joined by teacher; emitted to by homework controller.
   - `institution:${id}:admin`: Joined by institution admins; emitted to by homework controller.
   - `branch:${id}:admin`: Joined by branch managers; emitted to by homework controller.
   - `course:${id}`: Joined by enrolled students and owning teacher; emitted to on lesson/course/exam events.

### 3.3 Frontend Consumer Compatibility
In `apps/frontend/src/app/hooks/useSmartNavigationCounters.ts`:
- Line 237: `socket.on('homework_submitted', hwSubmittedHandler)`.
- Line 197-223: `handleRealtimeEvent` receives payload, deduplicates via `payload.id` (`submission.id`), and triggers `fetchCounters()`.
- Because `submission` contains `id`, `studentId`, `homeworkId`, `grade`, `url`, `answers`, deduplication succeeds and valid counter refreshes are invoked.

---

## 4. Audit B — Authoritative Branch-to-Institution Relationship

### 4.1 Prisma Schema & Database Constraints
In `packages/database/prisma/schema.prisma`:
```prisma
model Course {
  id             String        @id @default(uuid())
  institutionId  String?
  branchId       String?
  ...
  institution    Institution?  @relation(fields: [institutionId], references: [id])
  branch         Branch?       @relation(fields: [branchId], references: [id])
  ...
}

model Branch {
  id            String       @id @default(uuid())
  institutionId String
  ...
  institution   Institution  @relation(fields: [institutionId], references: [id], onDelete: Restrict)
  ...
  @@unique([institutionId, code])
}
```
**Database Analysis:**
- There is **no composite foreign key constraint** between `Course` and `Branch` (e.g., `FOREIGN KEY (institutionId, branchId) REFERENCES Branch(institutionId, id)`).
- PostgreSQL only checks that `branchId` exists in `Branch` table. It does not enforce that `Branch.institutionId === Course.institutionId`.

### 4.2 Application-Level Validation in Course Controller
In `services/course-service/src/controllers/course.controller.ts`:
- **Course Creation (`createCourse`, lines 870-872):**
  ```typescript
  const institutionId = tenantContext?.institutionId || teacher.institutionId || null;
  const branchId = (isManagerOrAdmin && data.branchId) ? data.branchId : (tenantContext?.branchId || teacher.branchId || null);
  ```
  `data.branchId` is written directly to the database without querying `db.branch.findFirst({ where: { id: branchId, institutionId } })`.
- **Course Update (`updateCourse`, line 946):**
  ```typescript
  ...(isManagerOrAdmin && data.branchId !== undefined && { branchId: data.branchId }),
  ```
  `data.branchId` is accepted without verifying branch existence or tenant ownership.

### 4.3 Homework Submission & Notification Dispatch
In `services/course-service/src/controllers/homework.controller.ts`:
- **Query (lines 393-395):**
  ```typescript
  const homework = await db.homework.findUnique({
    where: { id: homeworkId },
    include: { course: { select: { id: true, teacherId: true, institutionId: true, branchId: true } } }
  });
  ```
  The query does not join `Branch` or verify that `branch.institutionId === course.institutionId`.
- **Emitter (`emitHomeworkSubmissionNotification`, lines 360-369):**
  ```typescript
  if (course?.institutionId) {
    const instRoom = `institution:${course.institutionId}:admin`;
    ioInstance.to(instRoom).emit('homework_submitted', submission);
    targetedRooms.push(instRoom);

    if (course.branchId) {
      const branchRoom = `branch:${course.branchId}:admin`;
      ioInstance.to(branchRoom).emit('homework_submitted', submission);
      targetedRooms.push(branchRoom);
    }
  }
  ```
  This is a **mere presence check**.

### 4.4 Risk Evaluation
If a course record in the database contains `institutionId: "inst-1"` and `branchId: "branch-99-of-inst-2"` (via manual database edit, legacy seed, or API exploit), student homework submissions are broadcast to `branch:branch-99-of-inst-2:admin`, exposing student submission data to managers of an unrelated institution.

**Status:** **UNPROVEN / UNENFORCED** (Triggers BLOCKED verdict).

---

## 5. Audit C — Real Socket.IO Integration Coverage

### 5.1 Analysis of `socket_security_isolation.test.ts`
All 20 tests in `services/course-service/socket_security_isolation.test.ts` execute exclusively against mock infrastructure:
1. `MockSocket` (in-memory Set of rooms and array of received events).
2. `MockSocketIOServer` (in-memory map of sockets and custom `to().emit()` implementation).
3. `authenticateAndScopeSocket` (in-file duplicated function mirroring `src/index.ts` rather than calling the real server middleware).

### 5.2 Chain Link Verification Matrix

| Chain Link | Verification Method | Status |
|:---|:---|:---|
| 1. Authenticated socket handshake | Tested via `MockSocket` passing `{ token }` to mock auth function | **MOCKED** |
| 2. JWT verification | Tested via `jwt.verify(token, TEST_JWT_SECRET)` in mock auth function | **UNIT TESTED** |
| 3. Authorized room join | Tested via `s.rooms.has(...)` on `MockSocket` | **MOCKED** |
| 4. Homework submission HTTP endpoint (`submitHomework`) | NOT executed in `socket_security_isolation.test.ts` | **NOT EXERCISED** |
| 5. Notification helper (`emitHomeworkSubmissionNotification`) | Directly imported and executed | **UNIT TESTED** |
| 6. Room emission dispatch | Recorded in `MockSocketIOServer.emissions` | **MOCKED** |
| 7. Authorized recipient event receipt | Asserted on `MockSocket.receivedEvents` | **MOCKED** |
| 8. Real WebSocket network transport | No real HTTP server, TCP port, or `socket.io-client` network traffic | **NOT EXERCISED** |

---

## 6. Audit D — Global Room Regression Check

Workspace search results across all production code, tests, and documentation:

| Search Pattern | Occurrences | Classification | File & Line | Assessment |
|:---|:---|:---|:---|:---|
| `io.to('admin')` | 1 | Documentation Comment | `homework.controller.ts:341` | Harmless comment noting removal |
| `io.to("admin")` | 0 | None | - | Clean |
| `to('admin')` | 1 | Documentation Comment | `homework.controller.ts:341` | Harmless comment noting removal |
| `to("admin")` | 0 | None | - | Clean |
| `join('admin')` | 3 | Handshake Auth (Super-Admin) + Docs | `src/index.ts:98`, doc files | Scoped to super-admin claim only; no emissions |
| `to('admin_room')` | 1 | Legacy Test Fixture | `sec004_runtime.test.ts:48` | Test-only scratch file |
| `homework_submitted` | 7 | Production emitter, frontend hook, test suites | `homework.controller.ts`, `useSmartNavigationCounters.ts`, tests | Authoritative event name preserved |

**Findings:** Zero active production emissions to `admin` remain. No wildcard or unscoped room broadcasts were found for homework submissions.

---

## 7. Exact Unresolved Risks & Severity

| Risk ID | Description | Severity | Impact |
|:---|:---|:---|:---|
| **RISK-01** | Missing composite foreign key or application validation ensuring `course.branchId` belongs to `course.institutionId` | **HIGH** | If `course.branchId` belongs to a foreign institution, real-time submission data is leaked to managers of that branch. |
| **RISK-02** | Absence of real end-to-end Socket.IO integration tests (network transport, real middleware in `index.ts`, real `submitHomework` controller) | **MEDIUM** | Verifications rely on unit tests and mock implementations; runtime transport quirks remain unverified until consolidated activation. |
| **RISK-03** | Course creation (`course.controller.ts:889`) uses unscoped `io.emit('course_created', course)` | **LOW** | Broadcasts course creation platform-wide rather than scoping to institution or enrolled students (pre-existing pattern, unrelated to homework). |

---

## 8. Minimal Recommended Corrections (Non-Implemented)

1. **Course Creation & Update Branch Validation (`course.controller.ts`):**
   When `branchId` is provided, validate ownership before writing to the database:
   ```typescript
   if (branchId && institutionId) {
     const branchExists = await db.branch.findFirst({ where: { id: branchId, institutionId, deletedAt: null } });
     if (!branchExists) {
       return res.status(400).json({ message: 'الفرع المحدد غير تابع لهذه المؤسسة' });
     }
   }
   ```
2. **Notification Helper Defense-in-Depth (`homework.controller.ts`):**
   In `submitHomework`, load the branch relation:
   ```typescript
   include: { course: { select: { id: true, teacherId: true, institutionId: true, branchId: true, branch: { select: { institutionId: true } } } } }
   ```
   In `emitHomeworkSubmissionNotification`, only target the branch room if `course.branch?.institutionId === course.institutionId`:
   ```typescript
   if (course.branchId && (!course.branch || course.branch.institutionId === course.institutionId)) {
     const branchRoom = `branch:${course.branchId}:admin`;
     ioInstance.to(branchRoom).emit('homework_submitted', submission);
     targetedRooms.push(branchRoom);
   }
   ```
3. **Database Schema Hardening (Future Migration):**
   Add `@@unique([id, institutionId])` to `model Branch` and a composite relation in `model Course` to enforce branch-to-institution ownership at the PostgreSQL constraint level.

---

## 9. Operational Integrity Statement

- **Workspace Boundaries:** All inspections conducted exclusively within `D:\OX-DIGITAL\Mathe\OX-DIGITAL-GITHUB`.
- **Zero Modifications:** No project source files, tests, configurations, or environment files were modified.
- **Zero Runtime Operations:** No Docker containers were inspected, started, stopped, or built.
- **Zero Database Operations:** No database connections, SQL queries, Prisma migrations, or seed operations were executed.
- **Zero Git Operations:** No commits, checkouts, pushes, pulls, or branch changes were made.

