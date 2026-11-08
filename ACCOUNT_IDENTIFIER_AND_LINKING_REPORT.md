# OX-DIGITAL Education — Account Identifier & Academic Linking Report

**Workspace:** `D:\OX-DIGITAL\Mathe\OX-DIGITAL-GITHUB`  
**Date:** 2026-11-07  
**Implementation Phase:** Phase D, E & G  
**Status:** COMPLETE & VERIFIED  

---

## 1. Executive Summary

This report documents the restoration and structured implementation of the **Account Identifier** and **Academic Account Linking** within OX-DIGITAL Education.

Previously:
1. Account Settings lacked an explicit, copyable unique identifier section, making it difficult for students, parents, and teachers to coordinate account associations.
2. Academic linking (Student ↔ Parent, Teacher ↔ Branch, and Teacher ↔ Accountant) lacked unified management interfaces and privacy-preserving lookup endpoints.
3. Users had no visual clarity regarding their assigned organizational branch or responsible accountant.

The remediation establishes:
1. A copyable, authenticated Account Identifier card displaying the user's UUID (`user.id`) and role badge in Account Settings.
2. A privacy-preserving user lookup API (`GET /api/users/lookup`) that masks personal email and phone numbers before linking.
3. Role-aware bidirectional account linking and unlinking (`POST /api/users/link-parent` and `POST /api/users/unlink-parent`) with audit logging.
4. Active academic relationship querying (`GET /api/users/linked-relationships`) that maps students to parents, teachers to branches, and teachers to responsible branch accountants.
5. Zero database migrations: all relations utilize existing PostgreSQL columns (`User.parentId`, `User.branchId`, `StudentTeacher`, `Branch`).

---

## 2. Account Identifier Section (Phase D)

In `apps/frontend/src/app/components/shared/AccountSettingsPage.tsx` under the **Academic Linking & Account ID** tab:

### 2.1 UI Component Features
- **Prominent Identifier Card:** Displays the user's authoritative UUID (`user.id`) in an easy-to-read monospace block alongside their current system role.
- **Single-Click Copy Action:** Integrated `navigator.clipboard.writeText(user.id)` button providing immediate visual confirmation (`"تم النسخ بنجاح!"` / `"Copied!"` with green checkmark).
- **Clear Helper Context:** Explanatory text informing the user that this identifier is unique to their profile and is used to safely link parent and student accounts.

---

## 3. Structured Account Linking Architecture (Phase E)

### 3.1 Privacy-Preserving Account Lookup (`/api/users/lookup`)
Before establishing a link, users must verify the target account. The lookup endpoint accepts a UUID, email, or phone number and returns a masked public summary:
```json
{
  "id": "1e3b7b20-...",
  "name": "أحمد محمود",
  "role": "ONLINE_STUDENT",
  "emailMasked": "a***d@ox-digital.edu",
  "phoneMasked": "010****5678",
  "branch": "الفرع الرئيسي"
}
```
This prevents malicious enumeration of private contact details while giving the user enough information to confirm identity.

### 3.2 Student ↔ Parent Relationship Management
- **Student View:** Students can view their linked parent card. If no parent is linked, an inline lookup and link form allows linking a parent account.
- **Parent View:** Parents can view all linked children, inspect each child's academic grade and branch, and link additional children.
- **Unlinking:** Either party (or an Administrator) can unlink an account. Unlinking sets `User.parentId = null` without deleting either account or historical academic records.
- **Audit Logging:** Every linking and unlinking action records an entry in `StudentAuditLog` capturing timestamps, acting user ID, and action details.

### 3.3 Teacher ↔ Branch & Accountant Scoping
- **Branch Association:** Teachers and accountants display their assigned physical branch (`User.branchId` → `Branch.name`).
- **Teacher ↔ Accountant Mapping:** For teachers operating within an educational center, the system automatically resolves the responsible branch accountants through their shared `branchId`, displaying accountant names and support contacts.
- **Admin Management:** Administrators retain full oversight to link or unlink students, reassign branches, and manage staff affiliations through the centralized users management console.

---

## 4. Backend Endpoints Summary

| Method | Endpoint | Authorization | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/users/lookup?q=...` | Authenticated | Look up target user by ID, email, or phone with PII masking |
| `POST` | `/api/users/link-parent` | Authenticated | Link parent and student (role-authorized) |
| `POST` | `/api/users/unlink-parent` | Authenticated | Unlink parent and student |
| `GET` | `/api/users/linked-relationships` | Authenticated | Fetch active parent, children, branch, and responsible accountants |
| `GET` | `/api/users/profile` | Authenticated | Extended profile including branch and parent relation details |

---

## 5. Verification Results

| Test Scenario | Verification Check | Expected Outcome | Status |
| :--- | :--- | :--- | :--- |
| **UUID Copyability** | Monospace card + copy button | Copies valid UUID string with feedback | PASS |
| **Lookup PII Masking** | Query by email or phone | Returns masked email and phone strings | PASS |
| **Parent ↔ Student Link** | Parent links student account | Updates `User.parentId`, logs audit entry | PASS |
| **Unlink Action** | Unlink confirmed via modal | Sets `parentId = null`, preserves account history | PASS |
| **Branch Scoping** | Teacher views assigned branch | Displays branch name and responsible accountants | PASS |
| **Database Safety** | Inspect schema mutations | Zero schema alterations or migrations required | PASS |

