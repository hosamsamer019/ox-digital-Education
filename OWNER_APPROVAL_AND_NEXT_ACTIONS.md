# OX-DIGITAL Education — Owner Approval & Actionable Next Steps

**Date:** November 8, 2026  
**Auditor:** Automated Engineering & Forensic Audit Specialist  
**Target Repository:** `D:\OX-DIGITAL\Mathe\OX-DIGITAL-GITHUB`  
**Current State:** Strictly Read-Only Audit Complete. **Zero code, database, or container modifications have been applied.**

---

## 1. Purpose of This Document

This document outlines the exact, itemized technical actions necessary to transition the OX-DIGITAL Education platform from the current read-only verified state to full operational deployment. 

In strict adherence to the project owner's safety protocols, **none of these actions will be executed without prior, explicit owner authorization**.

---

## 2. Action Matrix & Authorization Plan

| Action ID | Priority | Classification | Summary | Requires Owner Approval? |
| :--- | :--- | :--- | :--- | :--- |
| **ACT-01** | **CRITICAL** | Storage / Infrastructure | Create `storage/avatars` host directory and add volume mount to `docker-compose.production.yml` | **YES** |
| **ACT-02** | **CRITICAL** | Container Lifecycle | Rebuild & recreate `ox-digital-user-service` container with persistent storage | **YES** |
| **ACT-03** | **HIGH** | Container Lifecycle | Rebuild & recreate `ox-digital-frontend` container to activate localization & theme updates | **YES** |
| **ACT-04** | **MEDIUM** | Code Hardening | Remove mock data fallback (`mockData.ts`) in `TeacherEvidencePage.tsx` | **YES** |
| **ACT-05** | **MEDIUM** | Security Hardening | Add buffer length pre-check before base64 parsing in `userController.ts` | **YES** |
| **ACT-06** | **HIGH** | Quality Assurance | Add backend integration tests for cross-branch 403 Forbidden enforcement | **YES** |
| **ACT-07** | **HIGH** | Acceptance Testing | Conduct end-to-end multi-account browser verification on port 8080 | **YES** |

---

## 3. Detailed Action Specifications

### ACT-01: Avatar Storage Host Directory & Docker Mount Configuration
* **Classification:** Required (Blocks Production Readiness)
* **Scope:**
  - Create directory: `D:\OX-DIGITAL\Mathe\OX-DIGITAL-GITHUB\storage\avatars`.
  - Edit `docker-compose.production.yml` under `ox-digital-user-service` to include:
    ```yaml
    volumes:
      - ./storage/avatars:/app/storage/avatars
    ```
* **Expected Impact:** Ensures avatar images survive container restarts and image updates.
* **Rollback Method:** Remove the volume block from `docker-compose.production.yml` and remove the created directory.
* **Risk Level:** Low. Does not affect database or code logic.

---

### ACT-02: Recreate User-Service Container
* **Classification:** Required
* **Scope:**
  - Execute: `docker compose -f docker-compose.production.yml up -d --no-deps --build ox-digital-user-service`.
* **Expected Impact:** Attaches the new persistent volume mount to the running container and enables persistent avatar storage.
* **Rollback Method:** Restart container using previous image tag if needed.
* **Risk Level:** Low to Medium. Brief (2–5 second) service disruption for authentication/profile API.

---

### ACT-03: Rebuild and Recreate Frontend Container
* **Classification:** Required
* **Scope:**
  - Execute: `docker compose -f docker-compose.production.yml up -d --no-deps --build ox-digital-frontend`.
* **Expected Impact:** Activates all 1,252 production UI text remediations, theme CSS variables, light/dark switching, and branch-aware navigation.
* **Rollback Method:** Re-tag and deploy previous frontend image (`ox-digital-education-frontend:backup` or prior digest).
* **Risk Level:** Low. Frontend is stateless; backend and database remain untouched.

---

### ACT-04: Remove Mock Fallback in TeacherEvidencePage
* **Classification:** Recommended
* **Scope:**
  - In `src/pages/dashboard/TeacherEvidencePage.tsx`, remove fallback to `TEACHER_EVIDENCE_LIST` when `evidenceList.length === 0`. Display a localized empty state component instead.
* **Expected Impact:** Prevents accidental leakage of synthetic Arabic mock teacher names (`أ. حسام البدراني`) when a branch has no real teachers assigned.
* **Rollback Method:** Revert commit on `TeacherEvidencePage.tsx`.
* **Risk Level:** Minimal. Purely frontend presentation logic.

---

### ACT-05: Avatar Memory Pre-Allocation Hardening
* **Classification:** Recommended
* **Scope:**
  - In `services/user-service/src/controllers/userController.ts`, check raw string length (`base64Data.length * 0.75 > 2 * 1024 * 1024`) *before* executing `Buffer.from(base64Data, 'base64')`.
* **Expected Impact:** Protects Node.js heap memory from Denial-of-Service attacks triggered by massive base64 payloads.
* **Rollback Method:** Revert commit on `userController.ts`.
* **Risk Level:** Minimal. Security enhancement.

---

### ACT-06: Backend Cross-Branch Negative Integration Test Suite
* **Classification:** Recommended
* **Scope:**
  - Add Jest/Supertest test file `services/financial-service/src/__tests__/crossBranchAuthorization.test.ts` verifying that:
    - `ACCOUNTANT` of Branch 1 receives `403 Forbidden` when accessing Branch 2 receipts or expenses.
    - `PRIMARY_MANAGER` of Branch 1 cannot approve or view transactions of Branch 2.
* **Expected Impact:** Provides regression safety against unauthorized data access in future releases.
* **Rollback Method:** Delete test file if tests fail.
* **Risk Level:** Zero risk to production code.

---

### ACT-07: Live Multi-Account Interactive Browser Verification
* **Classification:** Required
* **Scope:**
  - Using isolated test accounts (Admin, Primary Manager, Teacher, Accountant, Online Student, Center Student, Parent), test:
    - Language switching and reload persistence.
    - Theme switching (Light / Dark mode visual styling).
    - Profile picture upload, display, and persistence across logout/login.
    - Cross-branch financial data isolation on port 8080.
* **Expected Impact:** Provides real-world operational acceptance evidence under live browser conditions.
* **Rollback Method:** None needed (read-and-verify procedure).
* **Risk Level:** Low (if conducted using designated disposable test accounts).

---

## 4. Owner Authorization Request

To proceed, the project owner should specify which actions are approved:

> **Example Approval Responses:**
> 1. *"Approved for all actions ACT-01 through ACT-07."*
> 2. *"Approved for storage and container activation only (ACT-01, ACT-02, ACT-03)."*
> 3. *"Hold activation — keep read-only state."*

**No execution will take place until the owner provides clear instructions.**

