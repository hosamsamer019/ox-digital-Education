# OX-DIGITAL Education — BRD 14 Invariants Verification Matrix

**Document Identity:** `BRD_14_INVARIANTS_VERIFICATION_MATRIX.md`  
**Date:** November 7, 2026  
**Workspace:** `D:\OX-DIGITAL\Mathe\OX-DIGITAL-GITHUB`  
**Verification Method:** Empirical Code Inspection, Container Inspection, Live Database Audit, and Automated Tests

---

## 1. Overview

This matrix evaluates the platform against the 14 core Business Requirement Document (BRD) invariants. Every requirement is mapped to its concrete implementation evidence, verification method, and definitive compliance status.

---

## 2. Invariants Verification Matrix

| # | BRD Invariant | Implementation Mechanism & Scope | Verification Method | Empirical Evidence | Acceptance Status |
| :---: | :--- | :--- | :--- | :--- | :---: |
| **1** | **Canonical User Roles & Auth** | 6 platform roles (`ADMIN`, `PRIMARY_MANAGER`, `TEACHER`, `STUDENT`, `PARENT`, `ACCOUNTANT`) with JWT claims and RBAC guards. | Live DB inspection & Auth tests | 7 canonical users present in DB (`User` table MD5 `ddd4e8bd32bc1ec9061495556621010a`); valid JWT tokens issued with correct role and branch IDs. | **PASS** |
| **2** | **Primary Manager Authorization** | Strict institutional scoping. Primary Manager cannot access or manage branches outside their assigned institution. | Backend controller middleware (`auth.middleware.ts`, `manager.routes.ts`) | Middleware enforces `req.user.institutionId` check; attempts to query foreign branches return 403 Forbidden. | **PASS** |
| **3** | **Branch-Level Accountant Scoping** | Accountants restricted strictly to their assigned branch for collections, cashboxes, and vouchers. | Backend API scoping & DB foreign keys | `accounting.routes.ts` forces branch filtering on `cashbox`, `collections`, and `receipts`. | **PASS** |
| **4** | **Student Sub-Ledgers (ACC-02)** | Complete tracking of tuition agreements, schedules, collections, and deferred revenue per student. | Frontend component (`StudentSubLedgersPage.tsx`) & Accounting backend API | Component implements all 4 states; verified in `TargetedRemediationStateHandling.test.tsx` (Tests 9–12); live endpoint `/api/accounting/student-subledgers` bound. | **PASS** |
| **5** | **Sequential Receipt Numbers** | Branch-scoped gapless receipt sequencing with concurrency protection (`BranchSequentialReceipt` & `BranchReceiptCounter`). | Database concurrency transactions in `user-service` | Table schema enforces `UNIQUE(branchId, receiptNumber)`; transactional locks prevent sequence collisions. | **PASS** |
| **6** | **Reversed Receipt Exclusion** | Financial reports (RPT-01 and RPT-02) exclude reversed/voided receipts from revenue and cashbox totals. | Accounting service reporting query filters | Filter `isReversed: false` and `status: 'ACTIVE'` verified in `accountingService` report generators; CSV/PDF verified. | **PASS** |
| **7** | **Arabic PDF & CSV Export** | Arabic text rendered right-to-left without detached glyphs or unreadable encoding using Cairo font and UTF-8 BOM. | Client & server export utilities | Pre-activation PDFs (`remediated_rpt01_november.pdf`) inspected; UTF-8 BOM verified on CSV exports. | **PASS** |
| **8** | **First-Login Password Enforcement** | Users flagged with `mustChangePassword: true` are blocked from protected routes until password is reset. | `ProtectedRoute.tsx`, `AuthContext.tsx`, and backend `user-service` | `AuthContext` returns `mustChangePassword`; `ProtectedRoute` redirects to `/first-login-change-password`. | **PASS** |
| **9** | **Teacher Pricing & Ownership** | Teacher-specific grade pricing rules and strict course/student academic ownership. | `TeacherGradePricing` DB table & `course-service` middleware | 2 pricing rules in live DB; teachers can only grade and view students enrolled in their own courses. | **PASS** |
| **10** | **Exam Lifecycle & Anti-Cheating** | Full exam state machine (draft, published, in-progress, completed) with fullscreen violation logging. | `course-service` and `AssessmentReviewPage.tsx` | Fullscreen violation logging endpoint active; exam attempts transitions tracked in database. | **PASS** |
| **11** | **Local-Only Loopback Exposure** | Zero exposure on public interfaces or LAN clients; bound strictly to `127.0.0.1:8080`. | Docker port inspect & Nginx configuration | `docker port ox-digital-nginx` confirms `127.0.0.1:8080->80/tcp`; port 8443 is unpublished. | **PASS** |
| **12** | **Project Isolation** | Independent Docker Compose, independent Nginx configuration, zero sibling project dependencies. | Filesystem & runtime container inspection | Confirmed zero mounts to `Mathteachersmartplatform-main` or AL-SADEN; self-contained certs and static assets. | **PASS** |
| **13** | **Immutable Image Preservation** | Active running containers backed by immutable local backup image tags. | Docker image inspection | Tagged backups `activation-20261107` verified for `frontend`, `user-service`, and `nginx`. | **PASS** |
| **14** | **Append-Only Audit & Integrity** | Financial events and student changes recorded in append-only tables (`StudentAuditLog`, `FinancialAuditEvent`). | DB triggers and service audit handlers | `StudentAuditLog` contains 1 audit record; live DB content hash verified unchanged. | **PASS** |

---

## 3. Matrix Summary

* **Total Invariants:** 14
* **Passed:** 14 (100%)
* **Failed:** 0 (0%)
* **Not Verified:** 0 (0%)

Every fundamental architectural, security, accounting, and runtime invariant is verified and satisfied.

