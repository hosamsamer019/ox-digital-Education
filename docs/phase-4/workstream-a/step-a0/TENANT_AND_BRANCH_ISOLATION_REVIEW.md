# OX-DIGITAL Education — Phase 4: Workstream A
## Step A0: Pre-Implementation Schema Audit & Migration Plan
### Deliverable 4: Multi-Tenant & Branch Isolation Security Review

**Workspace:** `D:\OX-DIGITAL\Mathe\OX-DIGITAL-GITHUB`  
**Target:** `docs/phase-4/workstream-a/step-a0/TENANT_AND_BRANCH_ISOLATION_REVIEW.md`  
**Execution Mode:** STRICTLY READ-ONLY AUDIT & IMPLEMENTATION PLANNING  
**Date:** November 4, 2026  
**Author:** Lead Software Architect & Financial Systems Security Reviewer  

---

## 1. Executive Summary

In educational SaaS financial applications, tenant isolation is a critical security and compliance requirement. A failure in tenant isolation could expose student financial agreements, cashbox till balances, or fee collection records across competing educational institutions.

This review evaluates the multi-tenant architecture established in Task 7.1 (`Institution`, `Branch`, `packages/shared/src/tenant/`) and defines the database-level isolation requirements for all financial models introduced in Phase 4 Workstream A.

---

## 2. Universal Institutional Tenant Scoping (`institutionId`)

### 2.1 The Universal Anchor Invariant
Every newly created financial model must possess an immutable, non-nullable foreign key referencing `Institution(id)`:
$$\texttt{institutionId String}$$
$$\texttt{institution Institution @relation(fields: [institutionId], references: [id], onDelete: Restrict)}$$

### 2.2 Model-by-Model Tenant Scoping Audit for Workstream A:

| Model Name | Has `institutionId`? | Nullability | Foreign Key Action | Tenant Uniqueness Scope | Isolation Guarantee |
| :--- | :---: | :---: | :---: | :--- | :--- |
| `StudentFinancialAccount` | **YES** | `NOT NULL` | `ON DELETE RESTRICT` | `@@unique([institutionId, studentId])`<br/>`@@unique([institutionId, accountNumber])` | Scopes account uniqueness per tenant. (See Section 2.3 for compound FK A1 validation requirement). |
| `Cashbox` | **YES** | `NOT NULL` | `ON DELETE RESTRICT` | `@@unique([institutionId, code])` | Tills cannot be shared across institutions. |
| `CashboxMovement` | **YES** | `NOT NULL` | `ON DELETE RESTRICT` | `@@index([institutionId, cashboxId])`| Cash movements strictly bound to tenant till. |
| `CashboxTransferRequest` | **YES** | `NOT NULL` | `ON DELETE RESTRICT` | `@@unique([institutionId, transferNumber])`| Transfers strictly intra-institutional; cross-tenant blocked. |
| `DailyCashboxReconciliation`| **YES** | `NOT NULL` | `ON DELETE RESTRICT` | `@@index([institutionId, status])` | Reconciliations isolated to institutional cashbox. |
| `ExpenseVoucher` | **YES** | `NOT NULL` | `ON DELETE RESTRICT` | `@@unique([institutionId, voucherNumber])` | Vouchers numbered and approved within tenant. |
| `StudentAgreement` | **YES** | `NOT NULL` | `ON DELETE RESTRICT` | `@@unique([institutionId, agreementNumber])` | Commercial agreements bound to single institution. |
| `PaymentScheduleItem` | Indirect | Via Agreement | `ON DELETE RESTRICT` | `@@unique([agreementId, milestoneNumber])` | Milestone belongs to tenant-bound agreement. |
| `CollectionReceipt` | **YES** | `NOT NULL` | `ON DELETE RESTRICT` | `@@unique([institutionId, receiptNumber])` | Receipt numbers unique and audited per tenant. |
| `PaymentAllocation` | Indirect | Via Receipt | `ON DELETE RESTRICT` | `@@index([receiptId, scheduleItemId])` | Allocation joins tenant-scoped receipt and milestone. |
| `LessonDeliveryEvidence` | **YES** | `NOT NULL` | `ON DELETE RESTRICT` | `@@index([institutionId, branchId])` | Evidence anchored to tenant physical campus. |
| `RevenueRecognitionEntry` | Indirect | Via Agreement | `ON DELETE RESTRICT` | `@@index([agreementId, recognizedAt])` | Revenue attributed to tenant student agreement. |
| `FinancialIdempotencyRecord`| **YES** | `NOT NULL` | `ON DELETE RESTRICT` | `@@unique([institutionId, idempotencyKey])` | Prevents cross-tenant idempotency collision. |
| `FinancialAuditEvent` | **YES** | `NOT NULL` | `ON DELETE RESTRICT` | `@@index([institutionId, createdAt])` | Audit trails strictly partitioned by tenant. |

### 2.3 Critical Tenant Isolation Analysis: Independent Foreign Keys vs. Composite Key Validation
A rigorous analysis of schema-level isolation reveals an important architectural distinction:
1. **The Role of `@@unique([institutionId, studentId])`:**  
   Enforcing `@@unique([institutionId, studentId])` on `StudentFinancialAccount` guarantees that within a specific institution, a student identity cannot hold more than one financial account. It also allows the same `User` to hold separate financial accounts across different institutions.
2. **The Limitation of Independent Foreign Keys:**  
   - An inspection of `packages/database/prisma/schema.prisma` shows that `User` declares:
     ```prisma
     institutionId String?
     branchId      String?
     ```
   - In `StudentFinancialAccount`, the relations are defined via independent foreign keys:
     ```prisma
     institutionId String
     studentId     String
     institution   Institution @relation(fields: [institutionId], references: [id], onDelete: Restrict)
     student       User        @relation(fields: [studentId], references: [id], onDelete: Restrict)
     ```
   - These independent FKs ensure that `institutionId` exists in `Institution` and `studentId` exists in `User`. However, PostgreSQL does **NOT** mechanically enforce that `User.institutionId === StudentFinancialAccount.institutionId`.
3. **Compound Foreign Key Constraint Requirement:**  
   To mechanically prevent cross-tenant assignment at the PostgreSQL constraint level, a composite foreign key would be required:
   $$\texttt{FOREIGN KEY ("institutionId", "studentId") REFERENCES "User"("institutionId", "id")}$$
   This constraint requires PostgreSQL to have a corresponding composite unique index on the target table:
   $$\texttt{@@unique([institutionId, id]) \quad \text{on model User}}$$
4. **Classification as an A1 Schema-Design Validation Requirement:**  
   Because `User.institutionId` is nullable (`String?`) to accommodate multi-tenant administrative roles and global identities, adding a compound unique index to `User` alters core authentication structures and must be evaluated against existing auth flows.  
   Therefore, database-level enforcement of tenant consistency across independent FKs cannot yet be proven without altering `User`'s identity structure. This is explicitly designated as an **A1 schema-design validation requirement** (to evaluate compound foreign keys on `User` vs. application-layer tenant middleware validation) rather than claiming independent foreign keys alone prevent cross-tenant references.

---

## 3. Operating Branch Dimension (`branchId`) & Campus Typing

### 3.1 Physical Centers vs. Online Branch
Under `OD-703` and `OD-719`, educational institutions operate multiple branches:
1. **Physical Campuses:** `BR-01` Dokki, `BR-02` Nasr City (`isOnline = false`).
2. **Digital Online Branch:** `BR-ONLINE` (`isOnline = true`).

### 3.2 Branch Dimension Invariants in the Financial Domain:
1. **Physical Cashbox Attribution:**  
   Physical cashboxes (`CB-01`, `CB-02`, `CB-MAIN`, `CB-03`) must belong to a physical campus branch (`isOnline = false`). A digital/online branch cannot possess physical cash till boxes.
2. **Lesson Delivery Evidence Verification:**  
   Under `packages/shared/src/accounting/center/evidence.ts` (lines 78–82), lesson delivery evidence can only be created for physical campus branches (`isPhysicalBranch = true`). Online classes do not generate physical center delivery evidence under current physical-first scope.
3. **Branch-Level Composite Indexes:**  
   To ensure fast query performance and strict tenant-branch isolation, composite indexes must be maintained:
   - `@@index([institutionId, branchId])` on `Cashbox` and `LessonDeliveryEvidence`.
   - `@@index([institutionId, isDefault])` and `@@index([institutionId, isOnline])` on `Branch`.

---

## 4. Platform Super-Admin Operational Quarantine (`OD-701`, `OD-718`)

### 4.1 The Security Vulnerability: Super-Admin Privilege Escalation
In multi-tenant SaaS platforms, system administrators (`admin@edu.com`) have global access to manage infrastructure, provisioning, and tenant status. If a Super-Admin can post financial transactions, sign off on cashbox transfers, or approve student discounts, the segregation of duties is destroyed, creating fraud risk and violating statutory compliance.

### 4.2 Architectural Quarantine Enforced in Database & Domain:
1. **Zero Tenant Ownership:**  
   The platform Super-Admin user does NOT belong to any `Institution` (`User.institutionId = NULL`).
2. **Domain Guard Enforcement:**  
   Every financial state transition in `packages/shared/src/accounting/center/roles.ts` invokes:
   ```typescript
   export function assertNotSaaSSuperAdmin(userId: string, context: string): void {
     if (userId === 'admin@edu.com' || userId === 'superadmin') {
       throw new SuperAdminQuarantineError(
         `SaaS Super-Admin Quarantine Violation: '${userId}' is strictly forbidden from executing institutional financial operations in ${context}.`
       );
     }
   }
   ```
3. **Database Relational Safeguard:**  
   Foreign keys on financial tables (`CashboxMovement.performedById`, `CashboxTransferRequest.initiatedById`, `CashboxTransferRequest.approvedById`, `CollectionReceipt.collectedById`, `ExpenseVoucher.preparedById`, `ExpenseVoucher.approvedById`) reference `User(id)`. When financial services execute mutations, database queries join `User` and assert `User.institutionId === context.institutionId`. Because the Super-Admin has `institutionId = NULL`, any attempt to record a financial transaction for the Super-Admin fails relational validation.

---

## 5. Prevention of Cascading Deletion (`ON DELETE RESTRICT`)

### 5.1 The Danger of `CASCADE` in Financial Tables
If an institution or branch is archived, or a student user account is deactivated, standard `ON DELETE CASCADE` would purge all associated financial history. This destroys audit trails and conflicts with statutory record retention requirements currently under specialist review in `UP-715`.

### 5.2 Mandatory Rule for Workstream A:
**Every foreign key on every financial model MUST specify `onDelete: Restrict`.**  
No financial record, cashbox movement, collection receipt, or audit log may ever be deleted via cascading deletion. If an administrative entity must be deactivated, soft-deletion (`deletedAt DateTime?` or status flag) must be utilized.

---

## 6. Multi-Tenant Query Scoping & Middleware Strategy

### 6.1 Database Row-Level Isolation
To ensure that application code never queries data across tenant boundaries, Workstream B will integrate Prisma client extension middleware (`tenantContext.ts`):
1. **Automated Tenant Filter Injection:**  
   Every `findMany`, `findFirst`, `findUnique`, `count`, and `aggregate` query on financial models automatically injects `where: { institutionId: currentTenant.institutionId }`.
2. **Automated Mutation Tenant Stamping:**  
   Every `create` or `createMany` operation automatically injects `data: { institutionId: currentTenant.institutionId }`.
3. **Cross-Tenant Mutation Blocking:**  
   If an incoming request specifies an `institutionId` differing from the authenticated session context, the middleware immediately rejects the transaction with `CrossInstitutionError`.

---

## 7. Security Conclusion

The multi-tenant and branch isolation architecture designed for Workstream A ensures:
* Total data partitioning by institution at the schema level.
* Elimination of intra-institution duplicate financial accounts via composite uniqueness, with compound foreign key enforcement on `User` designated as an A1 schema-design validation requirement.
* Complete segregation of duties and operational quarantine of `admin@edu.com`.
* Immutable audit preservation via strict `ON DELETE RESTRICT` constraints.

