# PHASE 7.1 — TARGET ARCHITECTURE & FOUNDATION SPECIFICATION
**Product:** OX-DIGITAL Education  
**Workspace:** `D:\OX-DIGITAL\Mathe\OX-DIGITAL-GITHUB`  
**Repository:** `https://github.com/hosamsamer019/ox-digital-Education.git`  
**Date:** November 2026  
**Execution Mode:** ARCHITECTURE SPECIFICATION & DESIGN BLUEPRINT (PHASE 7.1 PRE-IMPLEMENTATION)

---

## 1. Executive Summary

This document specifies the target architecture for **Phase 7.1: Institution, Branch & Identity Foundation**. It operationalizes the Product Owner's approved decisions:
- **OD-701:** Institution Governance & Single Primary Manager Authority.
- **OD-702:** Financial Domain Separation (Domain A SaaS vs. Domain B Institution).
- **OD-703:** Unified Institutional General Ledger with Branch Dimensions.
- **OD-709:** Financial Approval Authority & Configurable Delegated Limits.
- **OD-713:** Legal Entity Structure (Default 1 legal entity; multi-entity group support).

The target architecture transitions OX-DIGITAL from a flat academic application into an enterprise-grade multi-tenant educational platform where data ownership, administrative authority, and financial liabilities are strictly isolated per institution and dimensioned per branch.

---

## 2. Target Entity Hierarchy & Ownership Model

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                       TARGET ORGANIZATIONAL HIERARCHY                       │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  [Institution] (Tenant Root — Bound to Exactly ONE Primary Manager)         │
│        │                                                                    │
│        ├── 1:N ──> [LegalEntity] (OD-713: Tax & Legal Corporate Anchor)     │
│        │                 │                                                  │
│        │                 └── 1:N ──> [Branch] (Nasr City, Dokki, Online)    │
│        │                               │                                    │
│        │                               ├── 1:N ──> [Classroom / Facility]   │
│        │                               ├── 1:N ──> [CenterGroup]            │
│        │                               ├── 1:N ──> [Cashbox / Register]     │
│        │                               └── 1:N ──> [Attendance / Session]  │
│        │                                                                    │
│        ├── 1:N ──> [InstitutionMember] (User Roles & Delegated Scopes)     │
│        │                 │                                                  │
│        │                 └── 1:N ──> [BranchAssignment]                     │
│        │                                                                    │
│        └── 1:1 ──> [InstitutionLedger] (Domain B Accounting Engine)         │
│                          │                                                  │
│                          └── 1:N ──> [JournalLine] (Stamped with branchId)  │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Data Model Blueprint (Prisma Schema Specification)

### 3.1 Proposed New Models

```prisma
// ==========================================
// INSTITUTION TENANT ROOT & GOVERNANCE
// ==========================================

model Institution {
  id               String            @id @default(uuid())
  code             String            @unique // e.g. "INST-ALNOOR"
  name             String
  primaryManagerId String            // Exactly ONE Primary Institution Owner/Manager
  status           InstitutionStatus @default(ACTIVE)
  currency         String            @default("EGP")
  createdAt        DateTime          @default(now())
  updatedAt        DateTime          @updatedAt

  primaryManager   User              @relation("InstitutionPrimaryManager", fields: [primaryManagerId], references: [id], onDelete: Restrict)
  legalEntities    LegalEntity[]
  branches         Branch[]
  members          InstitutionMember[]
  courses          Course[]
  groups           CenterGroup[]

  @@index([status])
}

enum InstitutionStatus {
  ACTIVE
  SUSPENDED
  ARCHIVED
}

// ==========================================
// LEGAL ENTITY STRUCTURE (OD-713)
// ==========================================

model LegalEntity {
  id                   String            @id @default(uuid())
  institutionId       String
  name                 String            // Legal registered name
  taxRegistrationNumber String?           // Egyptian Tax Card / Card ID
  commercialRegister   String?           // Commercial Record (Sijill Tijari)
  currency             String            @default("EGP")
  isDefault            Boolean           @default(false)
  createdAt            DateTime          @default(now())
  updatedAt            DateTime          @updatedAt

  institution          Institution       @relation(fields: [institutionId], references: [id], onDelete: Restrict)
  branches             Branch[]

  @@unique([institutionId, name])
  @@index([institutionId])
}

// ==========================================
// BRANCH STRUCTURE (OD-701 / OD-703)
// ==========================================

model Branch {
  id              String            @id @default(uuid())
  institutionId   String
  legalEntityId   String
  code            String            // e.g. "MAIN", "DOKKI", "ONLINE"
  name            String
  isDefault       Boolean           @default(false) // Auto-provisioned for single-branch simplicity
  isOnline        Boolean           @default(false) // Dedicated Online/Head-Office Dimension
  status          BranchStatus      @default(ACTIVE)
  address         String?
  phone           String?
  createdAt       DateTime          @default(now())
  updatedAt       DateTime          @updatedAt

  institution     Institution       @relation(fields: [institutionId], references: [id], onDelete: Restrict)
  legalEntity     LegalEntity       @relation(fields: [legalEntityId], references: [id], onDelete: Restrict)
  classrooms      Classroom[]
  centerGroups    CenterGroup[]
  branchAssignments BranchAssignment[]

  @@unique([institutionId, code])
  @@index([institutionId, status])
  @@index([legalEntityId])
}

enum BranchStatus {
  ACTIVE
  INACTIVE
  CLOSED
}

model Classroom {
  id              String            @id @default(uuid())
  branchId        String
  name            String            // e.g. "Lecture Hall A", "Lab 1"
  capacity        Int               @default(30)
  branch          Branch            @relation(fields: [branchId], references: [id], onDelete: Restrict)

  @@index([branchId])
}

// ==========================================
// TENANT MEMBERSHIP & DELEGATED RBAC (OD-709)
// ==========================================

model InstitutionMember {
  id              String            @id @default(uuid())
  institutionId   String
  userId          String
  role            InstitutionalRole
  isPrimaryManager Boolean          @default(false)
  status          MemberStatus      @default(ACTIVE)
  permissions     Json?             // Explicit permission overrides / limits
  createdAt       DateTime          @default(now())
  updatedAt       DateTime          @updatedAt

  institution     Institution       @relation(fields: [institutionId], references: [id], onDelete: Restrict)
  user            User              @relation(fields: [userId], references: [id], onDelete: Cascade)
  branchAssignments BranchAssignment[]

  @@unique([institutionId, userId])
  @@index([institutionId, role])
  @@index([userId])
}

enum InstitutionalRole {
  PRIMARY_MANAGER
  BRANCH_MANAGER
  FINANCE_MANAGER
  BRANCH_ACCOUNTANT
  BRANCH_CASHIER
  TEACHER
  STAFF
  STUDENT
  PARENT
}

enum MemberStatus {
  ACTIVE
  SUSPENDED
  INVITED
  INACTIVE
}

model BranchAssignment {
  id              String            @id @default(uuid())
  memberId        String
  branchId        String
  isPrimary       Boolean           @default(false)
  createdAt       DateTime          @default(now())

  member          InstitutionMember @relation(fields: [memberId], references: [id], onDelete: Cascade)
  branch          Branch            @relation(fields: [branchId], references: [id], onDelete: Restrict)

  @@unique([memberId, branchId])
  @@index([branchId])
}
```

---

### 3.2 Proposed Modifications to Existing Models

#### 1. `User` Model Modifications
- Add `status AccountStatus @default(ACTIVE)`.
- Add relation `managedInstitutions Institution[] @relation("InstitutionPrimaryManager")`.
- Add relation `memberships InstitutionMember[]`.
- Remove `onDelete: Cascade` on critical relationships.

#### 2. `Course` Model Modifications
- Add `institutionId String`.
- Add foreign key relation `institution Institution @relation(fields: [institutionId], references: [id], onDelete: Restrict)`.
- Add `@@index([institutionId])`.

#### 3. `CenterGroup` Model Modifications
- Add `institutionId String`.
- Add `branchId String`.
- Add `teacherId String?`.
- Add foreign key relations to `Institution` and `Branch`.
- Add `@@index([institutionId, branchId])`.

#### 4. `Attendance` Model Modifications
- Add `institutionId String`.
- Add `branchId String`.
- Add `groupId String?`.
- Add `teacherId String?`.
- Add `lessonId String?`.
- Add `recordedByUserId String`.
- Add indexes on `[institutionId, branchId, date]`.

#### 5. `Payment` Model Modifications
- Add `institutionId String`.
- Add `branchId String?`.
- Change foreign key `user User @relation(..., onDelete: Restrict)` to prevent financial record destruction.
- Add `@@index([institutionId, branchId])`.

---

## 4. Entity Relationship Diagram (Mermaid ERD)

```mermaid
erDiagram
    Institution ||--o{ LegalEntity : "owns (1:N)"
    Institution ||--o{ Branch : "operates (1:N)"
    Institution ||--o{ InstitutionMember : "employs/enrolls (1:N)"
    Institution ||--o{ Course : "curates (1:N)"
    Institution ||--|| User : "governed by PrimaryManager (1:1)"

    LegalEntity ||--o{ Branch : "contains legal branches (1:N)"

    Branch ||--o{ Classroom : "houses (1:N)"
    Branch ||--o{ CenterGroup : "schedules (1:N)"
    Branch ||--o{ BranchAssignment : "assigns staff (1:N)"

    User ||--o{ InstitutionMember : "participates in (1:N)"
    InstitutionMember ||--o{ BranchAssignment : "scoped to branches (1:N)"

    Course ||--o{ Lesson : "contains (1:N)"
    Course ||--o{ Exam : "contains (1:N)"
    Course ||--o{ CourseEnrollment : "registers (1:N)"

    CenterGroup ||--o{ Attendance : "verifies session (1:N)"
    CenterGroup ||--o{ User : "contains students (M:N)"

    User ||--o{ CourseEnrollment : "studies (1:N)"
    User ||--o{ Attendance : "checked in (1:N)"
    User ||--o{ Payment : "transacts (1:N)"

    class Institution {
        String id PK
        String code UK
        String name
        String primaryManagerId FK
        InstitutionStatus status
    }
    class LegalEntity {
        String id PK
        String institutionId FK
        String taxRegistrationNumber
        String commercialRegister
    }
    class Branch {
        String id PK
        String institutionId FK
        String legalEntityId FK
        String code
        Boolean isDefault
        Boolean isOnline
    }
    class InstitutionMember {
        String id PK
        String institutionId FK
        String userId FK
        InstitutionalRole role
        Json permissions
    }
    class Course {
        String id PK
        String institutionId FK
        String teacherId FK
        Float price
    }
    class CenterGroup {
        String id PK
        String institutionId FK
        String branchId FK
        String schedule
    }
    class Attendance {
        String id PK
        String institutionId FK
        String branchId FK
        String studentId FK
        DateTime date
    }
    class Payment {
        String id PK
        String institutionId FK
        String branchId FK
        String userId FK
        Float amount
    }
```

---

## 5. Architectural Mechanisms for Multi-Tenant Isolation

### 5.1 Authenticated Tenant Context Lifecycle
Every incoming HTTP request traverses a unified tenant resolution pipeline:

```
[Incoming Request]
       │
       ├── 1. verifyToken (Validates JWT signature & expiration)
       │      Extracts: { userId, email, role, institutionId, branchId, isPrimaryManager }
       │
       ├── 2. tenantContextMiddleware
       │      Validates: User active in target institutionId
       │      Injects: req.tenant = { institutionId, branchId, isPrimaryManager, permissions }
       │
       ├── 3. Scoped Prisma Client Execution
       │      Automatically appends { institutionId: req.tenant.institutionId } to all queries
       │
       ▼
[Controller Handler] (Guaranteed zero cross-tenant leakage)
```

### 5.2 Single-Branch Zero-Overhead Operation (OD-701)
To ensure institutions operating a single physical branch face no administrative friction:
1. **Auto-Provisioning:** When an `Institution` is created, the system automatically creates:
   - One default `LegalEntity` (`isDefault = true`).
   - One default `Branch` (`code = "MAIN"`, `isDefault = true`).
   - One dedicated `Branch` (`code = "ONLINE"`, `isOnline = true`).
2. **Transparent Scope Fallback:** If a user belongs to an institution with exactly one physical branch, the server automatically defaults `branchId = defaultBranch.id` if omitted by the client. The user never needs to toggle branch selectors.
3. **Multi-Branch Scaling:** When the primary manager adds a second branch, the frontend surfaces branch filtering controls, and the backend mandates explicit branch scoping for localized operations.

### 5.3 WebSocket Room Namespacing
WebSockets in `course-service` must enforce strict tenant namespacing:
- Admin Room: `tenant:${institutionId}:admin` (replaces global `'admin'`).
- Teachers Room: `tenant:${institutionId}:teachers` (replaces global `'teachers'`).
- Branch Room: `tenant:${institutionId}:branch:${branchId}`.
- Course Room: `tenant:${institutionId}:course:${courseId}`.

### 5.4 S3 / Cloudflare R2 Storage Prefixing
Storage keys generated by `storage.adapter.ts` are restructured from flat `userId` to:
```
tenants/${institutionId}/branches/${branchId}/${resourceType}/${resourceId}/${uuid}.${ext}
```
Pre-signed upload URLs validate that the authenticated user belongs to `institutionId`.

### 5.5 Background Job Parameterization
BullMQ workers (such as `RiskEngineQueue`) must not iterate over the entire database. Jobs are partitioned per institution:
```typescript
await riskEngineQueue.add('evaluate-institution-risks', { institutionId: inst.id });
```
The worker processes each institution independently with explicit tenant-scoped queries.

