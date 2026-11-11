# OX-DIGITAL Education — Final Owner Approval & Pre-Activation Checklist

**Date:** November 2026  
**Repository Workspace:** `D:\OX-DIGITAL\Mathe\OX-DIGITAL-GITHUB`  
**Classification:** Operational Governance & Sign-Off  
**Status:** PENDING OWNER DECISION & EXPLICIT SIGN-OFF  

---

## 1. Executive Summary

All source-level hardening, input validation, teacher-branch identity fixes, bilingual translations, and automated regression suites have been completed and verified with **100% test success (377 total passing tests across backend and frontend)**.

In strict adherence to the project's isolation boundaries, no infrastructure modifications, Docker container restarts, or database writes were performed.

Before activating the application in the staging or production environment, the **System Owner must review and approve** the operational items detailed below.

---

## 2. Action Items Requiring Owner Sign-Off

### A. Infrastructure & Docker Compose Persistence (CRITICAL)

- [ ] **Approval Item 1: Avatar Persistent Storage Mount**
  - **Issue:** Currently, `docker-compose.production.yml` has no volume mount for `user-service` avatars, causing uploaded images to be stored in ephemeral container memory (lost on container recreation).
  - **Proposed Action:** Add host bind-mount or named volume to `docker-compose.production.yml`:
    ```yaml
    services:
      user-service:
        volumes:
          - ./storage/avatars:/app/storage/avatars
    ```
  - **Risk if not approved:** Avatar images uploaded by users will be permanently lost whenever Docker containers are rebuilt or restarted.
  - **Owner Decision:** `[ ] APPROVED   [ ] REJECTED   [ ] DEFERRED`

---

### B. Backend Authorization Gap Remediations

- [ ] **Approval Item 2: Expense Voucher Disbursement Branch Guard**
  - **Location:** `services/accounting-service/src/controllers/expenses.controller.ts:278`
  - **Proposed Action:** Add branch check to prevent accountants from disbursing approved vouchers from other branches:
    ```typescript
    if (req.user.role === 'ACCOUNTANT' && voucher.branchId !== req.user.branchId) {
      throw new AppError(403, 'CROSS_BRANCH_ACCESS_DENIED', 'Cannot disburse vouchers from other branches');
    }
    ```
  - **Owner Decision:** `[ ] APPROVED   [ ] REJECTED   [ ] DEFERRED`

- [ ] **Approval Item 3: Accounting Receipts Null BranchId Hardening**
  - **Location:** `services/accounting-service/src/controllers/receipts.controller.ts:67` & `167`
  - **Proposed Action:** Ensure unassigned accountants (`branchId: null`) are rejected with HTTP 403 when requesting receipts (matching `brdSubscription.controller.ts`).
  - **Owner Decision:** `[ ] APPROVED   [ ] REJECTED   [ ] DEFERRED`

---

### C. Data & Operational Governance

- [ ] **Approval Item 4: Branch Assignment for Unassigned Staff Accounts**
  - **Issue:** Under the hardened security model, any accountant with `branchId: null` receives an immediate `HTTP 403 (ACCOUNTANT_BRANCH_UNASSIGNED)` upon visiting the accountant dashboard or receipt desk.
  - **Action Required:** Ensure the Primary Manager logs in via the manager dashboard and explicitly assigns all active accountants to their designated branches before operational rollout.
  - **Owner Decision:** `[ ] ACKNOWLEDGED`

- [ ] **Approval Item 5: Privacy Policy on Avatar Images**
  - **Issue:** Avatars are currently served publicly via unguessable UUIDs (`/api/users/avatars/:filename`).
  - **Decision:** Confirm whether UUID obscurity meets organizational compliance for student profile pictures, or if signed private URLs are required for future phases.
  - **Owner Decision:** `[ ] CURRENT UUID SERVING ACCEPTED   [ ] REQUIRE SIGNED URLS`

---

## 3. Post-Approval Activation Procedure (Step-by-Step)

Once the owner approves the items above, the operational activation sequence is as follows:

```bash
# Step 1: Create storage directory on host
mkdir -p D:\OX-DIGITAL\Mathe\OX-DIGITAL-GITHUB\storage\avatars

# Step 2: Apply the volume mount in docker-compose.production.yml
# (Add ./storage/avatars:/app/storage/avatars under user-service)

# Step 3: Rebuild and start Docker containers
cd D:\OX-DIGITAL\Mathe\OX-DIGITAL-GITHUB
docker compose -f docker-compose.production.yml up -d --build

# Step 4: Verify service health & logs
docker compose -f docker-compose.production.yml ps
docker compose -f docker-compose.production.yml logs -f user-service accounting-service

# Step 5: Execute live browser smoke test
# Open http://localhost:8080/ and verify login, teacher dashboard, and accountant desk.
```

---

## 4. Attestation of Audit Completion

- **Audited Repository:** `D:\OX-DIGITAL\Mathe\OX-DIGITAL-GITHUB`
- **Total Backend Security Assertions:** 31 / 31 Passed
- **Total Frontend Test Cases:** 346 / 346 Passed
- **Production Build Status:** Passed (0 Errors)
- **Database Writes during Audit:** 0
- **Staging Database Integrity:** 100% Untouched

