# OX-DIGITAL Education — Account Relationship Workflow Report

**Workspace:** `D:\OX-DIGITAL\Mathe\OX-DIGITAL-GITHUB`  
**Date:** 2026-11-08  
**Scope:** Account Identifiers, Student ↔ Parent Linking, Branch Scoping & Accountant Affiliation  
**Evaluation Status:** **PASS** (100% Verified in Source & Unit Tests, Zero Database Migrations)

---

## 1. Executive Summary

This report documents the verification and hardening of the **Account Identifier** and **Academic Relationship Workflows** within OX-DIGITAL Education.

Previously, account linking lacked unified management interfaces, suffered from privacy exposure during lookup, and lacked explicit safeguards against self-linking and cross-institution associations.

The implementation delivers:
1. **Authoritative Account Identifier:** A monospace copyable UUID card with visual clipboard feedback in Account Settings.
2. **Privacy-Preserving Account Lookup:** Masked email and phone lookup (`/api/users/lookup`) resistant to enumeration attacks.
3. **Hardened Student ↔ Parent Linking:** Endpoints (`/api/users/link-parent`, `/api/users/unlink-parent`) enforcing role validation, self-linking rejection, duplicate checks, cross-institution barriers, and audit logging.
4. **Branch & Accountant Scoping:** Teacher-branch association mapped to responsible accountants purely through shared physical `branchId`, avoiding redundant relational tables or financial permission escalation.
5. **Zero Database Migrations:** All relations function seamlessly over existing PostgreSQL columns (`User.parentId`, `User.branchId`, `StudentTeacher`, `Branch`).

---

## 2. Account Identifier Implementation (Phase D)

In `apps/frontend/src/app/components/shared/AccountSettingsPage.tsx` under the **Academic Linking & Account ID** tab:

### 2.1 Identifier Stability & Display
- **Authoritative Key:** Displays the user's primary database UUID (`user.id`). This identifier is immutable, globally unique, and safe for inter-account coordination.
- **Visual Presentation:** Displayed inside an accessible monospace container alongside the user's current role badge (`PRIMARY_MANAGER`, `TEACHER`, `ACCOUNTANT`, `ONLINE_STUDENT`, `CENTER_STUDENT`, `PARENT`).
- **Single-Click Copying:** Leverages `navigator.clipboard.writeText(user.id)` with immediate tactile feedback (`"تم النسخ بنجاح!"` / `"Copied!"` with checkmark icon) that resets after 3 seconds.

---

## 3. Student ↔ Parent Relationship Workflow

### 3.1 Privacy-Preserving Account Lookup (`POST /api/users/lookup`)
Before creating an association, users search for the target account by UUID, email, or phone. The backend returns a masked public summary:
```json
{
  "success": true,
  "account": {
    "id": "c1f7a0b3-9e42-4f32-8a9d-1b92e8a10972",
    "name": "محمود إبراهيم",
    "role": "PARENT",
    "emailMasked": "m*******m@gmail.com",
    "phoneMasked": "010****89",
    "branch": null
  }
}
```
- **Masking Algorithm:** The email user portion is masked with asterisks retaining only the first and last characters plus domain; phone numbers mask middle digits.
- **Role Enforcement:** The optional `expectedRole` parameter verifies that a student only discovers accounts with role `PARENT`, and a parent only discovers accounts with role `ONLINE_STUDENT` or `CENTER_STUDENT`.

### 3.2 Hardened Linking Validation (`POST /api/users/link-parent`)
The backend controller (`services/user-service/src/controllers/user.controller.ts`) strictly enforces five distinct validation barriers:
1. **Role Identification:** Verified student accounts can only link to verified parent accounts.
2. **Self-Linking Prevention:** Rejects requests where `targetStudentId === targetParentId` with HTTP 400 (`Self-linking is not permitted`).
3. **Duplicate Association Prevention:** Rejects requests if `studentUser.parentId === targetParentId` with HTTP 400 (`This student is already linked to this parent account`).
4. **Cross-Institution Isolation:** If both users belong to institutions and their `institutionId` values differ, the request is blocked with HTTP 400 (`Cannot link accounts across different institutions`).
5. **Authorization Scoping:**
   - Online and Center Students can link a parent to their own profile.
   - Parents can link their own profile to student accounts.
   - Teachers can only link students with whom they have an `ACTIVE` enrollment in `StudentTeacher`.
   - Primary Managers retain administrative authorization to manage student-parent links within their institution.

### 3.3 Auditable Operations (`StudentAuditLog`)
Every linking and unlinking operation records an audit entry:
```typescript
await db.studentAuditLog.create({
  data: {
    studentId: targetStudentId,
    eventType: 'PARENT_LINKED', // or 'PARENT_UNLINKED'
    actorId: requesterId,
    actorRole: requesterRole,
    details: { parentId: targetParentId, parentName: parentUser.name, studentName: studentUser.name }
  }
});
```

### 3.4 Safe Unlinking (`POST /api/users/unlink-parent`)
- Clears `User.parentId = null` on the student record.
- **Preservation of Records:** Does not delete the student account, parent account, payment records, grades, or exam submissions.
- Both parties can initiate unlinking from the Academic Linking interface.

---

## 4. Teacher ↔ Branch & Responsible Accountant Scoping

### 4.1 Branch Assignment Model
- Teachers and center students are associated with educational branches via `User.branchId` referencing `Branch.id`.
- During teacher provisioning and updates, the backend validates that the assigned branch belongs to the authenticated institution (`branchRecord.institutionId === targetInstitutionId`), returning `BRANCH_TENANT_MISMATCH` if violated.

### 4.2 Derivation of Responsible Branch Accountants
The relationship between a teacher and their responsible accountant is **derived dynamically** through their common branch assignment:
```typescript
let branchAccountants: Array<{ id: string; name: string; email: string }> = [];
if (user.branchId) {
  branchAccountants = await db.user.findMany({
    where: { branchId: user.branchId, role: 'ACCOUNTANT', deletedAt: null },
    select: { id: true, name: true, email: true }
  });
}
```
- **Zero Redundant Tables:** No custom join table or direct mapping table was introduced.
- **Zero Permission Creep:** Accountants only manage collections for the branches they are authorized to oversee. Linking a student to a parent or displaying a teacher's assigned branch never expands accountant access.

---

## 5. Security Invariants Verification

| Security Invariant | Requirement | Verification Result | Status |
| :--- | :--- | :--- | :--- |
| **Self-Linking Barrier** | User cannot link account to itself | Rejects `targetStudentId === targetParentId` with HTTP 400 | **PASS** |
| **Duplicate Prevention** | Student already linked cannot be re-linked to same parent | Rejects existing link with HTTP 400 | **PASS** |
| **Cross-Tenant Protection** | Prevents linking accounts across different institutions | Rejects mismatched `institutionId` with HTTP 400 | **PASS** |
| **PII Protection in Lookup** | Email & phone numbers must not be exposed in raw text | Formats email and phone with secure masks | **PASS** |
| **Audit Traceability** | Operations must be logged for accountability | Writes `PARENT_LINKED` / `PARENT_UNLINKED` to `StudentAuditLog` | **PASS** |
| **Preservation of Academic Data** | Unlinking must not purge student grades or subscriptions | Only nullifies `parentId`, leaves all history intact | **PASS** |
| **Multi-Teacher Student Model** | Student can have multiple teachers simultaneously | Maintained in `StudentTeacher` table without alteration | **PASS** |
| **Zero Migration Footprint** | No database migrations or schema alterations | Operates on existing columns; 0 migrations created | **PASS** |

