# OX-DIGITAL Education — Final Read-Only Security & Implementation Audit

**Audit Date:** November 9, 2026  
**Auditor:** Antigravity AI Engine  
**Authorized Target Workspace:** `D:\OX-DIGITAL\Mathe\OX-DIGITAL-GITHUB`  
**Operational Mode:** STRICT READ-ONLY AUDIT (Zero Container, Database, or Source Code Modifications)  

---

## 1. Executive Verdict

This document delivers an independent, strict read-only audit of the remediation and evidence documented in `FINAL_APPROVED_REMEDIATION_AND_REGRESSION_REPORT.md`.

Every finding in this report is based on direct source-code inspection of controllers, middleware, data models, Docker Compose configurations, and test suites.

```
┌────────────────────────────────────────────────────────────────────────┐
│                      FINAL AUDIT VERDICT MATRIX                        │
├────────────────────────────────────────────────────────────────────────┤
│ 1. Socket.IO Authentication & Scoping: PASS — VERIFIED IN CODE         │
│ 2. Public Teachers Room Elimination:   PASS — VERIFIED IN CODE         │
│ 3. Socket.IO Automated Test Coverage:  PARTIAL — MOCKED TEST HARNESS   │
│ 4. Accounting Counter Status Query:    PASS — VERIFIED IN CODE         │
│ 5. Accounting Pagination Total Semantics: PASS — VERIFIED IN CODE     │
│ 6. Parent Child-Linking Deep-Link:     PASS — VERIFIED IN CODE         │
│ 7. Parent Child-Linking Test Coverage: PARTIAL — TEST COVERAGE GAP     │
│ 8. Production Compose DB Hostname:     FAIL — CONFIGURATION DEFECT     │
│ 9. Missing Auth-Service extra_hosts:   FAIL — CONFIGURATION DEFECT     │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Exact Inspected Files & Line Ranges

| File Path | Inspected Lines | Subject Matter |
| :--- | :---: | :--- |
| `services/course-service/src/index.ts` | 60–123 | Real Socket.IO server initialization, JWT auth middleware, room join handlers |
| `services/course-service/src/controllers/homework.controller.ts` | 340–370, 415–440 | Homework submission handler, DB course ownership query, targeted emission logic |
| `services/course-service/socket_security_isolation.test.ts` | 1–347 | Socket.IO security regression test suite, mock harness implementation |
| `services/user-service/src/controllers/accounting/expenses.controller.ts` | 137–215 | `listExpenseVouchers` controller, Prisma `where`, `count`, and `aggregate` queries |
| `services/user-service/src/utils/accountingScope.util.ts` | 25–95 | `resolveAccountingReportScope` authorization, role-based institution & branch isolation |
| `apps/frontend/src/app/services/accounting.service.ts` | 95–120 | `accountingService.getExpenses` frontend API wrapper |
| `apps/frontend/src/app/hooks/useSmartNavigationCounters.ts` | 50–125 | Smart counter calculation hook, status filter, `summary.totalCount` handling |
| `apps/frontend/src/app/components/shared/ContextualGuidanceBanner.tsx` | 70–90, 220–250 | Onboarding guidance routing, financial blocker, parent linking action route |
| `apps/frontend/src/app/components/shared/AccountSettingsPage.tsx` | 10–38, 390–425, 634–780 | `useSearchParams` hook, tab switching lifecycle, child linking tab interface |
| `apps/frontend/src/app/components/parent/ParentDashboard.tsx` | 15–80 | Parent portal router configuration, `/settings` and `/profile` routes |
| `apps/frontend/src/app/test/SmartNotificationCounters.test.tsx` | 80–145, 360–420 | Smart counters unit tests, guidance banner action route assertions |
| `docker-compose.production.yml` | 1–125, 290–330 | Production Compose service inventory, network configuration, `extra_hosts` |
| `.env.production.example` | 20–55 | Production environment configuration template, database documentation comments |

---

## 3. AUDIT A — Socket.IO Real Server Security

### 3.1 Authentication (Audit A1)
- **Token Extraction:** In `services/course-service/src/index.ts:73`, the server extracts the bearer token from `socket.handshake.auth?.token`.
- **JWT Signature Verification:** Verified synchronously at line 77 via `jwt.verify(token, process.env.JWT_SECRET as string)`.
- **Secret Configuration:** Uses the authoritative environment secret `process.env.JWT_SECRET`.
- **Token Expiration & Malformed Tokens:** Handled by `jsonwebtoken`. Any expired token, signature mismatch, or malformed payload throws an exception caught at line 112, passing `next(new Error('Authentication error'))` to reject connection.
- **Identity Attachment:** On successful verification, line 78 sets `socket.data.user = decoded`.
- **User ID Derivation:** The user ID is strictly derived at line 79: `const resolvedUserId = decoded.userId || decoded.id`. No client query parameter or handshake header can override this server-verified identity.
- **Verdict:** `PASS — VERIFIED IN IMPLEMENTATION`.

### 3.2 Private Teacher Rooms (Audit A2)
- **Room Name Construction:** In `services/course-service/src/index.ts:95-101`:
  ```typescript
  if (userRole === 'TEACHER') {
    if (resolvedUserId) {
      socket.join(`teacher:${resolvedUserId}`);
      const courses = await db.course.findMany({ where: { teacherId: resolvedUserId }, select: { id: true } });
      courses.forEach(c => socket.join(`course:${c.id}`));
    }
  }
  ```
- **Arbitrary Room Join Defense:** Lines 117-122 define only `io.on('connection')` with a `disconnect` listener. **Zero client-facing `socket.on('join')` or `socket.on('subscribe')` handlers exist.** Clients cannot join arbitrary rooms through socket payloads.
- **Course Relationship Enforcement:** The teacher joins `course:${c.id}` only for courses where `teacherId === resolvedUserId` in PostgreSQL.
- **Disconnection Cleanup:** Socket.IO native lifecycle automatically discards all room memberships when the socket disconnects.
- **Verdict:** `PASS — VERIFIED IN IMPLEMENTATION`.

### 3.3 Administrative Rooms (Audit A3)
- **Room Scoping Logic:** In `services/course-service/src/index.ts:83-92`:
  ```typescript
  if (userRole === 'ADMIN' || userRole === 'PRIMARY_MANAGER') {
    if (decoded.institutionId) {
      socket.join(`institution:${decoded.institutionId}:admin`);
      if (decoded.branchId) {
        socket.join(`branch:${decoded.branchId}:admin`);
      }
    } else {
      socket.join('admin');
    }
  }
  ```
- **Tenant Isolation:** A Primary Manager or Admin with `institutionId: 'inst-1'` joins `institution:inst-1:admin` and `branch:branch-1:admin`. They **never join** `admin` (the global platform super-admin room) and cannot join other institutions' rooms.
- **Platform-Level Access:** Unscoped platform super-administrators (users without `institutionId` in their JWT) join `admin`.
- **Verdict:** `PASS — VERIFIED IN IMPLEMENTATION`.

### 3.4 Homework Submission Event (Audit A4)
- **End-to-End Trace:**
  1. Student submits via `POST /api/homework/:id/submit`. `userId` is obtained from verified `req.user.userId`.
  2. Database query at `homework.controller.ts:344-347`:
     ```typescript
     const homework = await db.homework.findUnique({
       where: { id: homeworkId },
       include: { course: { select: { id: true, teacherId: true, institutionId: true, branchId: true } } }
     });
     ```
     `teacherId`, `institutionId`, and `branchId` are derived directly from the database record of the course.
  3. Emission at `homework.controller.ts:424-434`:
     ```typescript
     if (homework.course?.teacherId) {
       io.to(`teacher:${homework.course.teacherId}`).emit('homework_submitted', submission);
     }
     if (homework.course?.institutionId) {
       io.to(`institution:${homework.course.institutionId}:admin`).emit('homework_submitted', submission);
       if (homework.course?.branchId) {
         io.to(`branch:${homework.course.branchId}:admin`).emit('homework_submitted', submission);
       }
     } else {
       io.to('admin').emit('homework_submitted', submission);
     }
     ```
- **Elimination of Global Broadcast:** The defective line `io.to('teachers').emit('homework_submitted', submission);` has been completely deleted.
- **Data Protection:** `submission` (containing `answers`, `grade`, and student identity) is delivered strictly to the course owner's private room and the institution's admin room. Unrelated teachers and peer students in course rooms never receive this event.
- **Verdict:** `PASS — VERIFIED IN IMPLEMENTATION`.

### 3.5 Test Authenticity & Coverage Assessment (Audit A5)

Line-by-line inspection of `services/course-service/socket_security_isolation.test.ts` reveals:
- Lines 25–47: Defines `class MockSocket` which tracks room joins in `this.rooms = new Set<string>()`.
- Lines 50–78: Defines `class MockSocketIOServer` which stores sockets in a `Map` and matches `to(...rooms)` against socket room sets.
- Lines 81–114: Duplicates the auth and room join logic of `index.ts` in function `authenticateAndScopeSocket`.
- Lines 117–129: Duplicates the emission logic of `homework.controller.ts` in function `emitHomeworkSubmission`.

**Authenticity Finding:**  
`socket_security_isolation.test.ts` is an **isolated unit/mock test**. It executes with zero external dependencies and does not start an HTTP listener or invoke the real Socket.IO engine. This design was required because the Windows sandbox blocks loopback TCP `connect` calls with `EACCES`. While the mathematical logic of the room scoping algorithm is verified, it is **not a live integration test of the Express/Socket.IO runtime**.

#### Security Property Audit Matrix

| Security Property | Actual Implementation Evidence | Test Method | Confidence | Remaining Gap |
| :--- | :--- | :--- | :---: | :--- |
| **Token Authentication** | `course-service/src/index.ts:72-115` | Isolated unit test in `socket_security_isolation.test.ts:145-165` | `HIGH` | Requires live HTTP WebSocket handshake against running container |
| **Teacher Private Room** | `course-service/src/index.ts:97` | Isolated unit test in `socket_security_isolation.test.ts:168-183` | `HIGH` | Requires live multi-client socket connection in running container |
| **No Global `teachers` Join** | `course-service/src/index.ts:94-101` | Source-code inspection & `socket_security_isolation.test.ts:178` | `VERY HIGH` | Confirmed absent from both `index.ts` and `homework.controller.ts` |
| **Institution Admin Room** | `course-service/src/index.ts:85` | Isolated unit test in `socket_security_isolation.test.ts:186-198` | `HIGH` | Requires live multi-tenant socket integration |
| **Branch Admin Room** | `course-service/src/index.ts:87` | Isolated unit test in `socket_security_isolation.test.ts:258-285` | `HIGH` | Requires live multi-branch socket integration |
| **Arbitrary Room Join Block** | `course-service/src/index.ts:117-122` | Source-code inspection (absence of client join handlers) | `VERY HIGH` | Confirmed no `socket.on('join')` handler exists on server |
| **Scoped Submission Broadcast** | `homework.controller.ts:424-434` | Isolated unit test in `socket_security_isolation.test.ts:209-240` | `HIGH` | Requires live end-to-end HTTP POST submission + WebSocket receive |

---

## 4. AUDIT B — Accounting Counter Correctness

### 4.1 Count Query Trace (Audit B1)
In `services/user-service/src/controllers/accounting/expenses.controller.ts:137-208`:
1. `scope` is resolved by `resolveAccountingReportScope(req)`.
   - Rejects unassigned accountants (`403 Forbidden`).
   - For accountants: strictly enforces `where.branchId = req.user.branchId`.
   - For primary managers: strictly enforces `where.institutionId = req.user.institutionId`.
2. Status filter query at lines 149, 159:
   ```typescript
   const { status, category, page = '1', limit = '50' } = req.query;
   ...
   if (status) where.status = status as any;
   ```
3. Database queries at lines 182–188:
   ```typescript
   db.expenseVoucher.count({ where }),
   db.expenseVoucher.aggregate({
     where,
     _sum: { amount: true },
     _count: { id: true }
   })
   ```

### 4.2 Count Sources Comparison (Audit B2)
- `db.expenseVoucher.count({ where })` and `db.expenseVoucher.aggregate({ where, ... })` use the **exact same `where` object**.
- `total` in pagination equals `aggregateTotals._count.id` in `summary.totalCount`.

### 4.3 Frontend vs Backend Semantics (Audit B3)
In `apps/frontend/src/app/hooks/useSmartNavigationCounters.ts:68-93`:
1. **Primary Manager Approvals:**
   - Frontend calls `accountingService.getExpenses({ status: 'PENDING_APPROVAL' })`.
   - Sends query `GET /api/accounting/expenses?status=PENDING_APPROVAL`.
   - Backend controller applies `where.status = 'PENDING_APPROVAL'`.
   - Backend `summary.totalCount` represents **only pending approval vouchers** for that institution.
   - Frontend code:
     ```typescript
     approvals = typeof expRes?.summary?.totalCount === 'number'
       ? expRes.summary.totalCount
       : (typeof expRes?.pagination?.total === 'number' ? expRes.pagination.total : uniquePending.size);
     ```
2. **Accountant Disbursements:**
   - Frontend calls `accountingService.getExpenses({ status: 'APPROVED' })`.
   - Sends query `GET /api/accounting/expenses?status=APPROVED`.
   - Backend controller applies `where.status = 'APPROVED'` and `where.branchId = accountant.branchId`.
   - Backend `summary.totalCount` represents **only approved vouchers awaiting disbursement** in that accountant's branch.
   - Frontend code:
     ```typescript
     disbursements = typeof expRes?.summary?.totalCount === 'number'
       ? expRes.summary.totalCount
       : (typeof expRes?.pagination?.total === 'number' ? expRes.pagination.total : uniqueApproved.size);
     ```
3. **Semantic Guarantee:**  
   Because the frontend explicitly supplies `status` in the request parameters, the backend `summary.totalCount` is strictly filtered by that status. The scalar total count matches the semantic meaning of the counter badge.

### 4.4 Pagination & Deduplication Analysis (Audit B4)
- **More than 50 records:** When 75 pending vouchers exist, backend returns page slice of 50 in `vouchers`, but `summary.totalCount = 75`. The frontend adopts `75`, eliminating the 50-item cap defect.
- **Fallback safety:** If `expRes.summary.totalCount` is absent or malformed (e.g. non-number), the code falls back to `uniquePending.size`, which iterates through `rawList` and applies `v.status === 'PENDING_APPROVAL'`, deduplicating by stable `v.id`.
- **Status Validation:** Records with null, undefined, rejected, or paid status are excluded.

#### Accounting Counter Semantic Matrix

| Counter | Required Business Meaning | Backend `where` Scope | Returned Total Meaning | Frontend Calculation | Verdict |
| :--- | :--- | :--- | :--- | :--- | :---: |
| **`pendingApprovals`** | Expense vouchers submitted awaiting Primary Manager approval | `{ institutionId, status: 'PENDING_APPROVAL' }` | Count of `PENDING_APPROVAL` vouchers in institution | `summary.totalCount` with fallback to `uniquePending.size` | `PASS — VERIFIED IN IMPLEMENTATION` |
| **`pendingDisbursements`** | Approved vouchers awaiting physical cash payout by branch accountant | `{ institutionId, branchId: accountantBranch, status: 'APPROVED' }` | Count of `APPROVED` vouchers in assigned branch | `summary.totalCount` with fallback to `uniqueApproved.size` | `PASS — VERIFIED IN IMPLEMENTATION` |
| **`pendingHomework`** | Unsubmitted, active homework for authenticated student | `{ studentId, isLocked: false }` | Total homeworks in course (includes completed) | Filtered array length (`!submittedAt && available/pending`) | `PASS — VERIFIED IN IMPLEMENTATION` |

---

## 5. AUDIT C — Parent Child-Linking Deep Link

### 5.1 Navigation Lifecycle Verification
1. **Guidance Banner Route:** `ContextualGuidanceBanner.tsx:243`:
   `actionRoute: '/parent/settings?tab=linking'`.
2. **Parent Dashboard Route:** `ParentDashboard.tsx:75`:
   `<Route path="/settings" element={<AccountSettingsPage />} />`.
3. **Tab Parsing in `AccountSettingsPage.tsx:20-34`:**
   ```typescript
   const [searchParams, setSearchParams] = useSearchParams();
   const validTabs: Array<'preferences' | 'profile' | 'linking' | 'security'> = ['preferences', 'profile', 'linking', 'security'];
   const queryTab = searchParams.get('tab') as any;
   const [activeTab, setActiveTab] = useState(
     queryTab && validTabs.includes(queryTab) ? queryTab : 'preferences'
   );

   useEffect(() => {
     const tab = searchParams.get('tab') as any;
     if (tab && validTabs.includes(tab) && tab !== activeTab) {
       setActiveTab(tab);
     }
   }, [searchParams]);
   ```
4. **Behavior Evaluation:**
   - **Initial Mount with `?tab=linking`:** State initializes to `'linking'`.
   - **Linking Tab Rendering:** Lines 634–780 render the Account Identifier copy card and the linked student list / lookup form.
   - **Browser Refresh:** Preserves `?tab=linking` in URL; page re-mounts directly on linking tab.
   - **Back / Forward Navigation:** Handled via `useEffect([searchParams])`.
   - **Invalid Query (e.g. `?tab=hacked`):** Rejected by `validTabs.includes(queryTab)`; safely defaults to `'preferences'`.

### 5.2 Test Coverage Gap
In `apps/frontend/src/app/test/SmartNotificationCounters.test.tsx:403-415`:
The test renders `ContextualGuidanceBanner` and asserts:
```typescript
const guidance = resolveStateAwareGuidance(currentMockUser, { childrenCount: 0 });
expect(guidance?.actionRoute).toBe('/parent/settings?tab=linking');
```
**Finding:**  
The test verifies that the banner generates the URL `/parent/settings?tab=linking`. It **does not render `AccountSettingsPage`** to assert that the linking tab DOM elements mount.  
- Guidance action route generation: `PASS — VERIFIED BY TEST`.
- `AccountSettingsPage` deep-link parsing & tab activation: `PASS — VERIFIED BY SOURCE INSPECTION ONLY` (Automated component test coverage gap exists).

---

## 6. AUDIT D — Production Database Hostname

### 6.1 Configuration Inspection
1. **`docker-compose.production.yml` Service Analysis:**
   - Services defined: `nginx`, `frontend`, `auth-service`, `user-service`, `course-service`, `ai-service`, `analytics-service`, `redis`, `pg-backup`.
   - **PostgreSQL Database Service:** **NONE.** `docker-compose.production.yml` contains zero PostgreSQL database server containers.
   - **External Network:** The compose file defines a local bridge network `ox-digital-network`. No external network is attached.
   - **DNS / Alias `postgres`:** No network alias or DNS entry for `postgres` exists on `ox-digital-network`.
2. **`extra_hosts` Inventory:**
   - `user-service:101`: `extra_hosts: - "host.docker.internal:host-gateway"`
   - `course-service:132`: `extra_hosts: - "host.docker.internal:host-gateway"`
   - `ai-service:175`: `extra_hosts: - "host.docker.internal:host-gateway"`
   - `analytics-service:241`: `extra_hosts: - "host.docker.internal:host-gateway"`
   - **`auth-service` (lines 53–89):** **MISSING `extra_hosts`!**
   - **`pg-backup` (lines 296–315):** **MISSING `extra_hosts`!**
3. **`.env.production.example` Review:**
   - Line 32: `# For docker-compose.production.yml, the internal service hostname is 'postgres'.`
   - Line 35: `DATABASE_URL=postgresql://ox_admin:[DB_PASSWORD]@postgres:5432/ox_digital_education?schema=public`
   - Lines 38–41:
     ```ini
     POSTGRES_USER=ox_admin
     POSTGRES_PASSWORD=replace_with_strong_database_password
     POSTGRES_DB=ox_digital_education
     ```

### 6.2 Critical Defect Findings
1. **Defect D1 (Startup Crash on Default Hostname):**  
   If an administrator configures `.env.production` using hostname `postgres` as instructed by `.env.production.example`, all backend services will fail to connect on startup with `getaddrinfo ENOTFOUND postgres`. The hostname `postgres` does not resolve inside `ox-digital-network`.
2. **Defect D2 (Dead Example Variables):**  
   `POSTGRES_USER`, `POSTGRES_PASSWORD`, and `POSTGRES_DB` are not referenced anywhere in `docker-compose.production.yml`. Documenting them as "Required by docker-compose.production.yml" is factually incorrect.
3. **Defect D3 (`auth-service` Host Gateway Blind Spot):**  
   If an administrator uses `host.docker.internal` as the database host on a Linux Docker host, `user-service` and `course-service` will resolve it through `host-gateway`, but `auth-service` will fail to resolve `host.docker.internal` because lines 53–89 omit the `extra_hosts` configuration.
- **Verdict:** `FAIL — CONFIGURATION DEFECT`.

---

## 7. Cross-Check of Previous Report Claims

| Claim in `FINAL_APPROVED_REMEDIATION_AND_REGRESSION_REPORT.md` | Audit Verification | Accuracy Rating | Auditor Commentary |
| :--- | :--- | :---: | :--- |
| **"Global `teachers` room eliminated"** | Verified in `index.ts:95-101` and `homework.controller.ts:424` | `ACCURATE` | `socket.join('teachers')` and `io.to('teachers')` are completely deleted. |
| **"Private teacher rooms authenticated"** | Verified in `index.ts:97` | `ACCURATE` | Strictly joins `teacher:${resolvedUserId}` from verified JWT claims. |
| **"Administrative rooms scoped by institution and branch"** | Verified in `index.ts:85, 87` | `ACCURATE` | Scoped to `institution:${instId}:admin` and `branch:${branchId}:admin`. |
| **"Homework events delivered only to authorized recipients"** | Verified in `homework.controller.ts:424-434` | `ACCURATE` | Delivered strictly to course owner and institution admin. |
| **"`summary.totalCount` is appropriate for the frontend counters"** | Verified in `expenses.controller.ts:159, 183-198` | `ACCURATE WITH CAVEAT` | Accurate because frontend supplies `?status=...`, filtering the total at database level. Caveat: Frontend does not re-validate the scalar number. |
| **"Parent query-string navigation activates the real linking tab"** | Verified in `ContextualGuidanceBanner.tsx` & `AccountSettingsPage.tsx` | `ACCURATE IN CODE; TEST GAP` | Code implementation is fully wired; existing test only tests banner URL generation. |
| **"Backend Multi-Tenant Socket.IO Security Suite: 9 / 9 Scenarios Passed"** | Verified in `socket_security_isolation.test.ts` | `ACCURATE AS UNIT TEST; NOT REAL INTEGRATION` | Previous report should have explicitly specified that the test uses a mock socket harness rather than live network sockets. |

---

## 8. Remaining Security and Implementation Gaps

1. **Production Docker Compose Hostname & Network Inconsistency (Operational Blocker):**
   - Classification: `FAIL — CONFIGURATION DEFECT`.
   - Impact: Containers cannot connect to PostgreSQL if deployed with `.env.production.example` settings.
   - Required Correction (when authorized):
     - In `.env.production.example`: Update comments to state that `DATABASE_URL` must point to the external database host IP/DNS (e.g. `db.prod.internal` or `host.docker.internal`). Remove dead `POSTGRES_USER/PASSWORD/DB` comments.
     - In `docker-compose.production.yml`: Add `extra_hosts: - "host.docker.internal:host-gateway"` to `auth-service` and `pg-backup`.
2. **Socket.IO Live Network Integration Test Coverage:**
   - Classification: `PARTIAL — TEST COVERAGE GAP`.
   - Impact: Algorithm is verified via unit mocks; actual WebSocket handshake over TCP port 4004 is unverified in live containers.
   - Prerequisite: Requires container runtime activation.
3. **`AccountSettingsPage` Component Deep-Link Test Coverage:**
   - Classification: `PARTIAL — TEST COVERAGE GAP`.
   - Impact: Guidance route verified; actual React component rendering of linking tab from query parameter is unasserted in automated tests.
   - Safe to fix in source-code authorization without runtime.
4. **Physical Browser Audio Termination:**
   - Classification: `NOT VERIFIED — REQUIRES RUNTIME`.
   - Impact: Audio element mute/pause logic verified in test mocks (10/10); physical OS audio hardware shutdown unverified in real browser.

---

## 9. Explicit Operational Restrictions Confirmation

In strict compliance with Section 2 of the Audit Mandate:
- **Zero code modifications** were made to existing project source files or test files.
- **Zero Docker containers** were started, stopped, restarted, or created.
- **Ports 5432 and 5433 were never contacted.** Zero database queries, migrations, or seeds were executed.
- **Zero Git commands** (`commit`, `push`, `pull`, `reset`, `clean`, `checkout`) were executed.
- The single file created is this audit report: `FINAL_READ_ONLY_SECURITY_AND_IMPLEMENTATION_AUDIT.md`.

---

## 10. Summary & Recommended Action Plan

### Safe to Fix Within Source-Code Authorization (Next Phase)
1. Add `extra_hosts: - "host.docker.internal:host-gateway"` to `auth-service` and `pg-backup` in `docker-compose.production.yml`.
2. Update `.env.production.example` comments to clearly document external database connection requirements and remove dead `POSTGRES_*` variables.
3. Add a dedicated component test in `apps/frontend/src/app/test/SmartNotificationCounters.test.tsx` mounting `AccountSettingsPage` with `MemoryRouter initialEntries={['/parent/settings?tab=linking']}` to assert that the child-linking form DOM renders.

### Requires Separate Operational Authorization
1. Staging container launch (`docker-compose.staging.yml up -d`).
2. Staging database migration (`prisma migrate deploy` on port 5432).
3. Live physical Chromium browser audio termination and streaming verification.
4. Production server provisioning and live deployment.

