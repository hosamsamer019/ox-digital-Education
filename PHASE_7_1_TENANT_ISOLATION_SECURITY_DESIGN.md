# PHASE 7.1 — TENANT ISOLATION SECURITY DESIGN
**Product:** OX-DIGITAL Education  
**Workspace:** `D:\OX-DIGITAL\Mathe\OX-DIGITAL-GITHUB`  
**Repository:** `https://github.com/hosamsamer019/ox-digital-Education.git`  
**Date:** November 2026  
**Execution Mode:** SECURITY ARCHITECTURE SPECIFICATION (PHASE 7.1 PRE-IMPLEMENTATION)

---

## 1. Threat Model & Security Objectives

In a multi-tenant commercial education platform, cross-tenant data leakage represents an existential legal, commercial, and statutory risk. If an educational center can view another center's students, exams, pricing, or financial balances, the platform fails its primary duty of confidentiality.

### Primary Security Objectives
1. **Zero Cross-Tenant Read/Write (Zero IDOR):** No user, administrator, teacher, or student from Institution A can read, create, update, or delete records belonging to Institution B.
2. **Untrusted Client Inputs:** The server **never trusts** `institutionId` or `branchId` provided in client HTTP headers, query strings, or request bodies without cryptographically verifying it against the authenticated user's authorized membership.
3. **Defense in Depth:** Isolation is enforced at multiple layers:
   - Layer 1: Cryptographic JWT authentication claims.
   - Layer 2: API Gateway / Express Tenant Context Middleware.
   - Layer 3: Controller-level authorization & parameter verification.
   - Layer 4: Automated database repository query filtering via Prisma Client Extensions.
   - Layer 5: PostgreSQL Row-Level Security (RLS) policies.
4. **Asynchronous Isolation:** Background jobs, WebSocket channels, Redis caches, and S3/R2 storage buckets must enforce strict tenant namespacing.

---

## 2. Authenticated Tenant Context & Claims Pipeline

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                       TENANT CONTEXT RESOLUTION PIPELINE                    │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  [HTTP Request with Bearer Token]                                           │
│         │                                                                   │
│         ▼                                                                   │
│  [verifyToken Middleware]                                                   │
│    • Validates HMAC/RSA signature, expiration, and issuer.                  │
│    • Decodes token claims:                                                  │
│      {                                                                      │
│        userId: "usr_9481",                                                  │
│        institutionId: "inst_alnoor",                                        │
│        defaultBranchId: "br_nasrcity",                                      │
│        isPrimaryManager: true,                                              │
│        role: "PRIMARY_MANAGER"                                              │
│      }                                                                      │
│         │                                                                   │
│         ▼                                                                   │
│  [tenantContext Middleware]                                                 │
│    • Resolves target branch context:                                        │
│      - If header X-Branch-Id is present:                                    │
│          Verifies user has an active BranchAssignment for that branch.      │
│      - If header is absent:                                                 │
│          Defaults to defaultBranchId (Single-Branch Transparency).          │
│    • Attaches verified context to Express Request:                          │
│      req.tenantContext = {                                                  │
│        institutionId: "inst_alnoor",                                        │
│        branchId: "br_nasrcity",                                             │
│        isPrimaryManager: true,                                              │
│        permissions: [...]                                                   │
│      }                                                                      │
│         │                                                                   │
│         ▼                                                                   │
│  [Tenant-Scoped Prisma Client Execution]                                    │
│    • Auto-injects { institutionId: "inst_alnoor" } into query clauses.      │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Critical Rule for Untrusted Client Inputs:
```typescript
// SECURE PATTERN:
// Server IGNORES client-supplied body.institutionId
const newCourse = await scopedDb.course.create({
  data: {
    ...bodyData,
    institutionId: req.tenantContext.institutionId, // AUTHORITATIVE SERVER CONTEXT
  }
});
```

---

## 3. Enforcement Strategy: Centralized Repository vs. Service Middleware

A fundamental architectural question for OX-DIGITAL is whether to enforce tenant scoping at the **Service/Controller layer** or at the **Centralized Database Repository layer**.

### Comparative Analysis:

| Architectural Approach | Advantages | Disadvantages | Suitability for Codebase |
| :--- | :--- | :--- | :--- |
| **Approach A: Service / Controller Layer Only** (Manual `where: { institutionId }` in every controller) | No database abstraction changes. | Extreme human-error risk; a developer omitting `where: { institutionId }` in a single route creates an immediate global data leak. | **Unacceptable Risk** |
| **Approach B: PostgreSQL Row-Level Security (RLS) Only** | Pure database enforcement. | Requires configuring PostgreSQL session variables (`SET app.current_tenant = ...`) on every connection pool checkout, creating latency and connection pool complexity with Prisma. | **High Complexity** |
| **Approach C: Hybrid Defense (Recommended)** (Prisma Client Extension + Context Middleware) | Automatic query filtering on all Prisma queries, combined with controller guards and validation. Eliminates developer omission mistakes. | Requires instantiating tenant-bound Prisma client per request or using Prisma `$extends`. | **OPTIMAL FOR CODEBASE** |

### Recommended Implementation: Prisma `$extends` Query Middleware

In `packages/database/src/tenantClient.ts`:
```typescript
import { db } from './index.js';

export function getTenantDb(institutionId: string) {
  return db.$extends({
    query: {
      $allModels: {
        async findMany({ model, args, query }) {
          if ('institutionId' in (db as any)[model].fields) {
            args.where = { ...args.where, institutionId };
          }
          return query(args);
        },
        async findFirst({ model, args, query }) {
          if ('institutionId' in (db as any)[model].fields) {
            args.where = { ...args.where, institutionId };
          }
          return query(args);
        },
        async updateMany({ model, args, query }) {
          if ('institutionId' in (db as any)[model].fields) {
            args.where = { ...args.where, institutionId };
          }
          return query(args);
        },
        async deleteMany({ model, args, query }) {
          if ('institutionId' in (db as any)[model].fields) {
            args.where = { ...args.where, institutionId };
          }
          return query(args);
        }
      }
    }
  });
}
```

---

## 4. Protection Against Cross-Institution IDOR Attacks

An Insecure Direct Object Reference (IDOR) occurs when an endpoint accepts a database UUID (e.g., `DELETE /api/courses/:id` or `GET /api/exams/:id`) and updates/deletes the record by primary key without verifying tenant ownership.

### Strict IDOR Prevention Rules:

```typescript
// INSECURE PATTERN (CURRENT CODEBASE):
export const deleteCourse = async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const course = await db.course.findUnique({ where: { id } }); // NO TENANT CHECK
  await db.course.delete({ where: { id } });                    // CROSS-TENANT DELETION!
};

// SECURE PATTERN (TARGET ARCHITECTURE):
export const deleteCourse = async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const institutionId = req.tenantContext.institutionId;

  // Query MUST scope by both primary key and tenant root
  const course = await db.course.findFirst({
    where: { 
      id,
      institutionId // MATHEMATICALLY PREVENTS CROSS-TENANT ACCESS
    }
  });

  if (!course) {
    // Return 404 to avoid leaking existence of foreign tenant's record
    return res.status(404).json({ message: 'Course not found' });
  }

  // Authorization check within the tenant
  if (!req.tenantContext.isPrimaryManager && course.teacherId !== req.user.userId) {
    return res.status(403).json({ message: 'Forbidden: Insufficient privileges' });
  }

  await db.course.delete({ where: { id } });
  res.json({ message: 'Course deleted successfully' });
};
```

---

## 5. Asynchronous Infrastructure Isolation

### 5.1 WebSocket Room Isolation
WebSocket connections in `course-service` must enforce tenant-scoped room naming:

```typescript
io.use(async (socket, next) => {
  try {
    const token = socket.handshake.auth?.token;
    const decoded = jwt.verify(token, process.env.JWT_SECRET) as any;
    
    const { userId, institutionId, isPrimaryManager, role } = decoded;
    socket.data.user = decoded;
    
    // User-specific private room
    socket.join(`tenant:${institutionId}:user:${userId}`);
    
    // Tenant-scoped admin room
    if (isPrimaryManager || role === 'ADMIN') {
      socket.join(`tenant:${institutionId}:admin`);
    }
    
    // Tenant-scoped teachers room
    if (role === 'TEACHER') {
      socket.join(`tenant:${institutionId}:teachers`);
    }
    
    next();
  } catch (err) {
    next(new Error('Authentication failed'));
  }
});
```

### 5.2 Background Worker (BullMQ) Isolation
Background jobs must carry authoritative tenant metadata in their job payload:
```typescript
interface TenantJobPayload {
  institutionId: string;
  triggeredByUserId: string;
  data: any;
}

worker = new Worker('RiskEngineQueue', async (job: Job<TenantJobPayload>) => {
  const { institutionId } = job.data;
  
  // All queries executed by worker MUST be scoped to institutionId
  const enrollments = await db.courseEnrollment.findMany({
    where: {
      course: { institutionId }
    },
    // ...
  });
});
```

### 5.3 S3 / Cloudflare R2 Storage Prefix Isolation
File keys must follow a strict tenant-isolated hierarchy:
```
tenants/{institutionId}/branches/{branchId}/{resourceType}/{resourceId}/{randomUUID}.{ext}
```
Pre-signed upload URL generators assert that:
1. `req.tenantContext.institutionId` matches the storage path prefix.
2. The user has permission to upload to the specified branch.

### 5.4 Cache & Redis Isolation
All keys in Redis must be prefixed with the tenant identifier:
```
tenant:{institutionId}:session:{sessionId}
tenant:{institutionId}:rate_limit:{ip}
tenant:{institutionId}:lock:cashbox:{cashboxId}
```

---

## 6. Audit Logging & Security Event Provenance

A dedicated `SecurityAuditLog` table records all security-sensitive events across the platform:
- Tenant membership changes.
- Branch assignment changes.
- User status modifications (Suspension/Deactivation).
- Role and permission escalations.
- Cross-tenant access attempts (flagged as high-severity anomalies).

Every audit log entry records: `timestamp`, `institutionId`, `branchId`, `actorUserId`, `action`, `targetEntity`, `targetId`, `ipAddress`, `userAgent`, and `outcome` (`SUCCESS` or `DENIED`).

---

## 7. Negative Security Test Cases (Automated Assertion Matrix)

The test suite must mathematically prove that Institution A cannot interact with Institution B under any circumstance:

| Test ID | Security Scenario | Attack Vector / HTTP Request | Expected System Behavior |
| :--- | :--- | :--- | :--- |
| **SEC-01** | Cross-Tenant Course Inspection | Institution A Admin calls `GET /api/courses/{INST_B_COURSE_ID}` | Returns **HTTP 404 Not Found** (prevents ID confirmation). |
| **SEC-02** | Cross-Tenant Course Deletion | Institution A Admin calls `DELETE /api/courses/{INST_B_COURSE_ID}` | Returns **HTTP 404 Not Found**; zero database mutations. |
| **SEC-03** | Cross-Tenant User Listing | Institution A Admin calls `GET /api/users` | Response `data` contains **only Institution A users**; zero Institution B users returned. |
| **SEC-04** | Header Forgery Attack | Institution A User sends `X-Institution-Id: inst_b` | Header is **ignored**; server enforces token's verified `institutionId`. |
| **SEC-05** | Cross-Tenant Student Enrollment | Institution A Admin calls `POST /api/courses/{INST_A_COURSE}/enroll` with `studentId = INST_B_STUDENT` | Returns **HTTP 400 Bad Request** (*"Student does not belong to institution"*). |
| **SEC-06** | Cross-Tenant Attendance Manipulation | Institution A Teacher marks attendance for Institution B student | Returns **HTTP 403 Forbidden**; zero attendance rows created. |
| **SEC-07** | WebSocket Cross-Tenant Eavesdropping | Institution A Client attempts `socket.emit('join', 'tenant:inst_b:admin')` | Server **rejects subscription**; disconnects socket on violation. |
| **SEC-08** | Cross-Tenant Storage Overwrite | Institution A User requests upload URL with path `tenants/inst_b/...` | URL generator **rejects request** with HTTP 403. |
| **SEC-09** | Subordinate Branch Cashier Escalation | Branch Cashier attempts to call `POST /api/pricing-catalogs` (Manager only) | Returns **HTTP 403 Forbidden** (*"Primary Manager authority required"*). |

