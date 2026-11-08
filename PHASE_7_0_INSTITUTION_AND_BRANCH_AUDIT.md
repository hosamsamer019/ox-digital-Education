# PHASE 7.0 — INSTITUTION AND BRANCH MANAGEMENT AUDIT
**Product:** OX-DIGITAL Education  
**Workspace:** `D:\OX-DIGITAL\Mathe\OX-DIGITAL-GITHUB`  
**Audit Date:** November 2026 (Updated Phase 7.0.1)  
**Status:** COMPLETE (READ-ONLY FORENSIC AUDIT & APPROVED GOVERNANCE MODEL)

---

## 1. Executive Summary

This forensic audit evaluates the institutional hierarchy, multi-branch modeling, physical center operations, and data-isolation boundaries of the OX-DIGITAL platform.

### Core Verdict
The platform currently operates as a **single-institution, single-teacher, flat-hierarchy monolith**. 
- There is **no `Institution` entity**, **no `Branch` entity**, and **no physical facility or room entity** in the schema.
- The sole physical grouping entity is `CenterGroup`, which is an orphaned record containing only a name string and a schedule string.
- Authorization logic explicitly assumes a single educator (`"In the current single-teacher deployment, any authenticated TEACHER or ADMIN is authorized to record/manage attendance for any registered student"` — `attendance.controller.ts`).
- **Data Isolation Risk:** Extremely High. If multiple educational institutions or multiple branches operate concurrently, their financial transactions, teacher payroll, attendance, and student receivables will be co-mingled in a single unpartitioned database namespace.

---

## 2. Forensic Code Inventory & Implementation Analysis

### 2.1 The Existing `CenterGroup` Entity (`schema.prisma`)

```prisma
model CenterGroup {
  id        String   @id @default(uuid())
  name      String
  schedule  String
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  students  User[]
}
```

#### Observations:
1. **Orphaned Hierarchy:** `CenterGroup` does not belong to any branch, institution, or physical address.
2. **No Academic Ownership:** It has no foreign keys to `Course`, `Subject`, or `AcademicLevel`.
3. **No Teacher Link:** There is no relation between `CenterGroup` and the `Teacher` conducting the class.
4. **No Financial Attributes:** It lacks tuition rates, session pricing, room capacity, or billing cycles.

### 2.2 Attendance Tracking Architecture (`user-service/src/controllers/attendance.controller.ts`)

In `attendance.controller.ts` (Lines 60–73):
```typescript
/**
 * Helper to verify teacher/admin authorization for a student.
 * In the current single-teacher deployment, any authenticated TEACHER or ADMIN
 * is authorized to record/manage attendance for any registered student.
 */
async function verifyTeacherOrAdminAccess(requesterId: string, requesterRole: string, studentId: string): Promise<boolean> {
  const upperRole = requesterRole.toUpperCase();
  if (upperRole === 'ADMIN' || upperRole === 'TEACHER') {
    // Verify target student exists in the database
    const studentExists = await db.user.findUnique({
      where: { id: studentId },
      select: { id: true, role: true }
    });
    return !!studentExists;
  }
  return false;
}
```
Furthermore, the `Attendance` model in `schema.prisma` is unanchored:
```prisma
model Attendance {
  id        String   @id @default(uuid())
  studentId String
  date      DateTime
  status    String
  createdAt DateTime @default(now())
  student   User     @relation(fields: [studentId], references: [id], onDelete: Cascade)

  @@index([studentId])
  @@index([date])
  @@index([studentId, date])
}
```
- **The Defect:** Attendance is recorded as a date and status (`PRESENT`, `ABSENT`, `LATE`) against a student ID only.
- **Consequences for Accounting:**
  1. Attendance cannot be attributed to a specific lesson, group, course, or teacher.
  2. Per-lesson student billing (e.g., deducting 1 session credit upon physical check-in) is impossible because there is no link between `Attendance` and an invoiced service.
  3. Teacher compensation per lesson or per student present cannot be calculated from attendance records because the teacher ID is omitted.
  4. Attendance cannot be segregated by branch facility.

---

## 3. Multi-Tenant and Multi-Branch Gap Matrix

| Requirement | Target Architecture Expectation | Current Codebase State | Forensic Assessment |
| :--- | :--- | :--- | :--- |
| **Institution Tenant Modeling** | Every database record scoped to `institutionId`. Multi-tenant SaaS isolation. | Zero tenant columns or filters in any query. | **ABSENT (100% Gap)** |
| **Multi-Branch Hierarchy** | Institutions can operate `N` physical branches with distinct locations and staff. | No `Branch` model exists. | **ABSENT (100% Gap)** |
| **Branch Staffing** | Teachers and staff assigned to specific branches with localized permissions. | Teachers have global access to all students across the entire database. | **CRITICAL DEFECT** |
| **Central Pricing with Branch Overrides** | Central catalog defines standard pricing; branches can have local visibility/modifiers. | Flat global `Course.price` float. No branch rules. | **ABSENT (100% Gap)** |
| **Branch Revenue Attribution** | Invoices, payments, and cash receipts attributed to the executing branch. | All payments land in a single global `Payment` table without branch attribution. | **CRITICAL GAP** |
| **Branch Expense & Cost Centers** | Rent, electricity, printing, and salaries tracked per branch. | No expense model exists; no cost centers exist. | **ABSENT (100% Gap)** |
| **Consolidated Institution Reporting** | Rollup of multi-branch revenue and P&L into head-office financial statements. | `analytics-service` sums all `Payment` records globally. | **UNAUDITABLE** |

---

## 4. Multi-Tenant Architectural Separation: Domain A vs. Domain B

In accordance with approved Product Owner requirements, the architecture strictly decouples:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                 CRITICAL BUSINESS ARCHITECTURE BOUNDARY                     │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  [DOMAIN A: OX-DIGITAL SaaS Commercial Billing]                             │
│  • Entity: OX-DIGITAL Platform Vendor                                       │
│  • Customers: Educational Institutions & Centers                            │
│  • Revenue: Platform subscriptions, hosting tiers, student seat licenses    │
│  • Bank Accounts: OX-DIGITAL Corporate Accounts                             │
│  • Ledger: Platform General Ledger                                          │
│                                                                             │
│  ═════════════════════════════════════════════════════════════════════════  │
│  [STRICT TENANT ISOLATION BOUNDARY: NO SHARED LEDGERS, BALANCES, OR CASH]  │
│  ═════════════════════════════════════════════════════════════════════════  │
│                                                                             │
│  [DOMAIN B: Institution Internal Financial Management]                      │
│  • Entity: Individual Educational Institution (Tenant N)                    │
│  • Customers: Students and Parents                                          │
│  • Revenue: Online subscriptions, physical center tuition, lesson fees      │
│  • Expenses: Teacher compensation, branch rent, utilities, operating costs  │
│  • Cashboxes / Banks: Center front-desk cash drawers, center bank accounts  │
│  • Ledgers: Independent Institution General Ledger with Branch Dimensions    │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Risk of Co-mingling:
In the current codebase, there is no separation between the platform owner and an institution administrator. The `ADMIN` role is treated as both the operator of the server and the manager of the school. If SaaS commercial billing were introduced into the current schema, platform licensing revenues would contaminate the educational center's student tuition reports.

---

## 5. Architectural Blueprint for Institution & Branch Foundation

To support single-branch and multi-branch institutions safely, the target schema establishes:

```
  [Institution] (Tenant Root)
       │  (Controlled by exactly ONE Primary Institution Manager)
       │
       ├── 1:N ──> [Branch] (Nasr City, Dokki, Online Branch)
       │              │  (Single-branch centers operate seamlessly with 1 auto-provisioned branch)
       │              │
       │              ├── 1:N ──> [Classroom / Facility]
       │              │
       │              ├── 1:N ──> [Cashbox / Register]
       │              │
       │              ├── 1:N ──> [BranchStaff / RoleAssignment]
       │              │
       │              └── 1:N ──> [CenterGroup]
       │                              │
       │                              ├── 1:N ──> [GroupSession] ◄── [Attendance]
       │                              │
       │                              └── M:N ──> [StudentEnrollment]
       │
       └── 1:1 ──> [InstitutionLedger] (Unified Chart of Accounts with Branch Dimensions)
```

---

## 6. Product Owner Approved Model: Centralized Institution Governance & Branch Attribution (Phase 7.0.1)

The Product Owner has formally approved the business and governance model for educational institutions and branches:

### 6.1 Approved Business Model & Ownership
1. **Single Primary Manager per Institution:**
   - Each educational institution has **exactly one primary institution owner/manager** (`primaryManagerId`).
   - That primary manager controls the entire institution, including all its branches, operations, and financial settings.
   - Do NOT introduce independent institution owners or independent financial administrators for individual branches as the default architecture.
2. **Branch Topology (Single-Branch & Multi-Branch Support):**
   - The institution may operate **one branch** or **multiple branches**.
   - **Single-Branch Compatibility:** A single-branch institution must operate with complete simplicity, without requiring unnecessary multi-branch administrative overhead. When an institution is provisioned, a default primary branch is automatically established so single-center operators never face multi-branch configuration hurdles.
   - The primary manager can create, edit, activate, and deactivate branches as the business scales.

### 6.2 Centralized Management Authority
The primary institution manager retains exclusive institution-wide authority over:
- **Central Price Catalog:** Defining base prices, promotional discounts, and fee structures.
- **Online Subscription Pricing:** Setting recurring terms and digital course rates.
- **Physical Center Pricing:** Setting group tuition, session fees, and lab/materials costs.
- **Branch Management:** Branch creation, lifecycle activation/deactivation, and facility configuration.
- **Financial Policies:** Approval thresholds, refund policies, and installment rules.
- **Financial Reporting:** Access to consolidated cross-branch financial statements.
- **Accounting Settings:** Chart of accounts configuration, accounting periods, and fiscal year rules.
- **Student & Staff Administration:** Institution-wide user rosters and subordinate staff assignments.
- *Operational Staff Role:* Branch staff (cashiers, receptionists, accountants) are strictly subordinate to the primary manager, possessing localized operational permissions within their assigned branch.

### 6.3 Branch Financial Reporting & General Ledger Structure
1. **Attributable Branch Financials:**
   Every physical branch must have separately attributable:
   - **Revenue:** Invoices and course fees generated at or attributed to the branch.
   - **Collections:** Physical cash and card payments collected at the branch.
   - **Outstanding Receivables:** Unpaid student invoices originating from branch enrollments.
   - **Operating Expenses:** Branch facility rent, electricity, cleaning, internet, and supplies.
   - **Cashboxes:** Front-desk physical cash drawers and cashier shifts.
   - **Teacher Compensation:** Lesson fees, per-student fees, or revenue shares tied to branch sessions.
   - **Branch Performance Reports:** Branch-level P&L, operating margin, and collection efficiency.
2. **Accounting Structure — Unified General Ledger with Branch Dimensions:**
   - **Structure:** Exactly **ONE institution-wide General Ledger** per institution.
   - **Cost-Center / Dimension:** Journal lines carry an attributable `branchId`.
   - **No Separate Ledgers:** The system does NOT create a separate legal entity or independent general ledger for every branch by default.
   - **Consolidated Reporting:** The primary manager can view full consolidated financial reports across all branches simultaneously, or filter down to any specific branch in a single click.
3. **Explicit Attribution for Online Services & Subscriptions:**
   - Online services, student subscriptions, and digital exam access must not float unassigned.
   - They are explicitly attributed to a dedicated **Online/Head-Office Branch Dimension** (`isOnline = true`), ensuring 100% of institutional revenues are accounted for cleanly in branch-dimensional reporting.
