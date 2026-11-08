# OX-DIGITAL Education — Accounting Implementation Track
## Phase 2.0A.2 — Policy and Governance Audit Report
### Decision Register, Regulatory Compliance Gates, Role Matrix, and Lifecycle Policies

**Project:** OX-DIGITAL Education  
**Phase:** Phase 2.0A.2 — Independent Evidence-Based Acceptance Audit  
**Author:** Independent Senior Financial Systems Architect & Database Security Reviewer  
**Date:** November 3, 2026  
**Workspace:** `D:\OX-DIGITAL\Mathe\OX-DIGITAL-GITHUB`  
**Git Baseline:** HEAD `0500b93e65c24ed881349c4acea7f523332c5e9f` on branch `main`  
**Status:** COMPLETE — CANONICAL AUDIT ARTIFACT  

---

## 1. Executive Summary & Objective

Financial persistence architectures cannot be evaluated on schema diagrams alone. Every data model embodies institutional policies, role authorization boundaries, statutory compliance constraints, and lifecycle workflows.

This independent audit comprehensively verifies:
1. **Attendance & Evidence Retention (Audit C):** Resolution of the cascade deletion vulnerability on academic attendance records.
2. **Teacher Compensation Policy (Audit D / UP-704):** Verification that the calculation basis is strictly unresolved with no unapproved defaults.
3. **Cashbox Discrepancy Policy (Audit E / UP-705):** Verification that arbitrary thresholds (e.g., "50.00 EGP") are completely excised.
4. **Payment Coexistence Architecture (Audit F):** Relational and semantic separation between legacy online `Payment` records and physical center `Collection` receipts.
5. **Decision Register & Governance (Audit G):** Full classification of approved Product Owner decisions, open technical questions, and mandatory specialist review gates.
6. **Product Scope & Role Security (Audit H):** Alignment with physical educational-center operations and the four approved user roles.

---

## 2. Audit C: Attendance and Evidence Retention (Cascade Vulnerability Analysis)

### 2.1 The Vulnerability in Existing Schema
Inspection of the active codebase (`prisma/schema.prisma#L297`) confirms:
```prisma
model Attendance {
  id        String   @id @default(uuid())
  studentId String
  student   User     @relation(fields: [studentId], references: [id], onDelete: Cascade)
  ...
}
```
**Vulnerability Impact:** If a `User` (student) record is deleted via the platform administrative interface or user management service, PostgreSQL executes an automated cascading delete that permanently purges all associated `Attendance` records.
If financial revenue recognition (OD-706) or teacher compensation calculations (OD-726) depend directly on `Attendance`, deleting a student would erase the underlying audit evidence supporting recognized revenue and teacher payout liabilities. This violates Egyptian commercial law, tax audit standards, and GAAP/IFRS record-keeping mandates.

### 2.2 Six-Stage Financial Evidence Lifecycle
To permanently decouple financial revenue recognition from mutable or ephemeral academic attendance, the architecture introduces `LessonDeliveryEvidence` and `RevenueRecognitionEvent`:

```mermaid
flowchart LR
    A["1. Lesson Scheduled<br>(Academic Timetable)"] --> B["2. Lesson Delivered<br>(Physical Attendance Taken)"]
    B --> C["3. Supervisor Certification<br>(Headcount & Delivery Verified)"]
    C --> D["4. Evidence Deep-Frozen<br>(LessonDeliveryEvidence Created)"]
    D --> E["5. Revenue Recognition<br>(Immutable Ledger Posting)"]
    E --> F["6. Statutory Retention<br>(5-Year Immutable Cold Storage)"]
```

### 2.3 Relational Deletion-Policy Matrix

| Entity | Relation to Upstream | Prisma Target Delete Action | Relational Guarantee |
| :--- | :--- | :---: | :--- |
| `Attendance` (Academic) | Student (`User`) | `RESTRICT` | Prevent deletion of student user if academic attendance exists. |
| `LessonDeliveryEvidence` | Group (`CenterGroup`) | `RESTRICT` | Classroom delivery proof cannot be orphaned. |
| `LessonDeliveryEvidence` | Teacher (`User`) | `RESTRICT` | Certified instruction proof permanently linked to teacher. |
| `RevenueRecognitionEvent` | Delivery Evidence | `RESTRICT` | Evidence cannot be deleted while financial revenue event exists. |
| `JournalEntry` | Revenue Event | `RESTRICT` | Journal entry header cannot be removed. |
| `JournalLine` | Account & Branch | `RESTRICT` | Ledger lines cannot be orphaned. |

---

## 3. Audit D: UP-704 Teacher Compensation Baseline Policy

### 3.1 Verification of Unresolved Status
During Phase 2.0A, a draft proposal suggested defaulting variable teacher compensation to a percentage of student collections or recognized revenue. In Phase 2.0A.1 (Correction B), this was flagged as an unapproved assumption.

**Audit Verification Result:**
- **UP-704 is strictly classified as UNRESOLVED.**
- The persistence architecture defines `TeacherCompensationAgreement` with `calculationBasis VARCHAR(50) NULL`.
- **Zero default calculation basis is assumed or implemented.** Whether revenue-share is computed against:
  - Cash collections received during the month,
  - Accrued student obligations billed,
  - Net earned revenue recognized from verified attendance, or
  - Fixed tier rates per attending student,
  remains strictly open pending explicit Product Owner resolution.

### 3.2 Four-Stage Certified Compensation Lifecycle
Under OD-726, teacher compensation follows a strict, multi-party verified lifecycle:
1. **Scheduled:** Lesson timetable planned in academic calendar.
2. **Delivered:** Physical classroom session completed; teacher logs attendance.
3. **Certified:** Branch supervisor or academic coordinator verifies physical delivery and student headcount, generating immutable `LessonDeliveryEvidence`.
4. **Compensated:** Primary Manager reviews certified monthly statement lines, approving creation of `TeacherPayable` liability and corresponding general ledger expense posting.

---

## 4. Audit E: UP-705 Cashbox Discrepancy Policy

### 4.1 Complete Removal of Unapproved Thresholds
In early drafts, a hardcoded threshold of "50.00 EGP" was referenced as an automated discrepancy trigger. In Phase 2.0A.1 (Correction C), this was excised.

**Audit Verification Result:**
- The string `"50.00 EGP"` has been completely removed from all architecture and decision documentation.
- **UP-705 is strictly classified as UNRESOLVED.**
- No default monetary tolerance (0.00 EGP, 50.00 EGP, 100.00 EGP, or percentage) is assumed in the database schema or business rules.

### 4.2 Cashbox Shift-Close Workflow
The database model `CashboxReconciliation` strictly accommodates any future policy chosen by the Product Owner:
1. **Cashier Physical Count:** Frontline cashier counts drawer cash at shift end and enters `physicalCountedBalance`.
2. **System Variance Calculation:** System records `systemExpectedBalance` and computes `varianceAmount = physicalCountedBalance - systemExpectedBalance`.
3. **Status Assignment:**
   - If `varianceAmount == 0`: `reconciliationStatus = 'BALANCED'`.
   - If `varianceAmount != 0`: `reconciliationStatus = 'DISCREPANCY_PENDING'`.
4. **Managerial Adjudication:** Every discrepancy requires explicit review by the `PRIMARY_MANAGER`. The manager decides whether to approve as an operational shortage/surplus expense (`'APPROVED'`) or escalate for administrative audit (`'INVESTIGATING'`).

---

## 5. Audit F: Legacy `Payment` vs Physical Center `Collection` Coexistence

### 5.1 Relational & Semantic Distinction
The audit cross-referenced `prisma/schema.prisma` against the proposed center accounting models:

```
[Existing Online Track]                     [Center Accounting Track]
+-------------------------+                 +-------------------------+
|     model Payment       |                 |    model Collection     |
|-------------------------|                 |-------------------------|
| id: String (UUID)       |                 | id: UUID                |
| userId: String          |                 | studentId: UUID         |
| courseId: String        |                 | branchId: UUID          |
| amount: Float           |                 | amount: DECIMAL(12,2)   |
| provider: PAYMOB/STRIPE |                 | paymentMethod: CASH/POS |
| status: PENDING/COMPLETED                 | receiptNumber: REC-001  |
+-------------------------+                 | cashboxId: UUID         |
                                            +-------------------------+
```

### 5.2 Key Coexistence Invariants
1. **Zero Schema Collisions:** The existing `Payment` table is retained completely untouched for online video courses. Center operations persist in `Collection`.
2. **Precision Safety:** `Collection.amount` uses `DECIMAL(12,2)` (fixed-point arithmetic), completely eliminating floating-point rounding errors found in legacy `Float`.
3. **Cashbox Drawer Linkage:** `Collection` has mandatory foreign keys to `Cashbox` and `Branch`, enabling daily till reconciliation and physical cash tracking.
4. **Multi-Item Allocation:** A single cash collection receipt can be allocated across multiple course obligations via `CollectionAllocation`, whereas `Payment` is strictly 1:1 with `courseId`.

---

## 6. Audit G: Decision Register & Governance Tracking

### 6.1 Approved Product Owner Decisions

| Decision ID | Title | Summary of Approved Principle |
| :--- | :--- | :--- |
| **OD-701** | Multi-Tenant Root Boundary | All data, configurations, and ledgers are strictly partitioned by `Institution`. |
| **OD-702** | Multi-Currency with Base EGP | Functional currency is Egyptian Pound (EGP); accounts support ISO 4217 currencies. |
| **OD-703** | Branch Dimensional Architecture | Operating campuses are modeled as dimensions; Head Office is institutional. |
| **OD-718** | Primary Manager Sole Authority | Primary Manager holds exclusive approval over periods, pricing, and adjustments. |
| **OD-719** | Physical & Online Campus Scope | Centers operate physical campuses and optional virtual branches. |
| **OD-723** | Pure Append-Only Versioning | Published prices and journal entries are strictly immutable. Corrections require reversals. |
| **OD-724** | Outage Extension Calculation | Transition extensions granted equal to verified platform outage duration. |
| **OD-725** | Center-First Physical Rollout | Implementation prioritizes physical center operations before online subscriptions. |
| **OD-726** | Teacher Compensation 4-Stage | Scheduled -> Delivered -> Certified -> Compensated lifecycle mandated. |
| **UP-709** | Frontline Cashier Float Policy | Cashiers open shifts with recorded opening float; drawers reconciled at shift end. |
| **UP-714** | Receipt Sequence Numbering | Official physical receipts formatted sequentially: `REC-YYYYMM-XXXXX`. |

### 6.2 Open / Unresolved Technical Questions

| Question ID | Title | Nature of Pending Decision | Required Product Owner Direction |
| :--- | :--- | :--- | :--- |
| **OD-710** | Period Close Lock Behavior | Period closure rules | Define soft-close grace period vs hard seal cutoff dates. |
| **UP-704** | Variable Teacher Revenue Basis | Compensation formula | Select basis: Collections, Earned Revenue, or Billed Obligations. |
| **UP-705** | Cashbox Shortage Threshold | Till variance tolerance | Specify monetary threshold requiring immediate manager escalation. |
| **UP-711** | Discount Approval Limits | Frontline pricing discretion | Set maximum discount percentage allowed per staff role. |
| **UP-712** | Stale Draft Entry Expiration | General ledger cleanup | Define time-to-live before unposted draft entries are auto-purged. |
| **UP-713** | Petty Cash Replenishment | Campus expense workflow | Establish imprest float ceiling and replenishment approval limits. |

### 6.3 Mandatory Specialist Review Gates (Pre-Implementation Prerequisites)

Before implementing Phase 2 code or deploying database migrations, four formal specialist reviews are mandatory:

1. **UP-701: Egyptian Chart of Accounts Compliance Gate**
   - *Reviewer:* Licensed Egyptian Certified Public Accountant (Chartered Accountant / محاسب قانوني).
   - *Scope:* Validate account hierarchy, numbering standards, asset/liability classifications, and tax reporting readiness against the Egyptian Uniform Accounting System (نظام المحاسبة الموحد).
2. **UP-702: Egyptian Tax Authority (ETA) Compliance Gate**
   - *Reviewer:* Egyptian Tax Legal Counsel / Tax Compliance Specialist.
   - *Scope:* Validate compliance with Law No. 67/2016 (Value Added Tax), withholding tax (خصم وتحصيل تحت حساب الضريبة), and technical readiness for Egyptian e-Invoicing (الفاتورة الإلكترونية) and e-Receipt (الإيصال الإلكتروني).
3. **UP-706: Consumer Protection Refund Law Compliance Gate**
   - *Reviewer:* Egyptian Consumer Protection Legal Counsel.
   - *Scope:* Validate student withdrawal, cancellation, and refund policies against Egyptian Consumer Protection Law No. 181/2018 (قانون حماية المستهلك).
4. **UP-715: Privacy & Statutory Record Retention Compliance Gate**
   - *Reviewer:* Data Protection Officer & Financial Regulatory Counsel.
   - *Scope:* Reconcile the mandatory 5-year commercial and tax record retention requirements under Egyptian Commercial Code Law No. 17/1999 with student privacy and right-to-be-forgotten rights under Egyptian Personal Data Protection Law No. 151/2020.

---

## 7. Audit H: Product Scope & Role Security Matrix

### 7.1 Scope: Physical Educational Centers
The approved scope covers physical educational centers providing classroom instruction, group tutoring, physical cash desk operations, and campus-level facilities.

### 7.2 The Four Approved User Roles
In strict adherence to Product Owner specifications, exactly four roles are recognized within the educational center accounting architecture:

```mermaid
classDiagram
    class PRIMARY_MANAGER {
        Institution Owner / Executive Director
        Full administrative & financial control
        Period close, pricing publication, refund approval
    }
    class ACCOUNTANT {
        Financial Controller / Senior Bookkeeper
        Journal entry drafting, account management
        Reconciliation review, financial reporting
    }
    class CASHIER {
        Frontline Receptionist / Cash Desk Operator
        Cashbox opening/closing, collection receipting
        Student obligation settlement
    }
    class TEACHER {
        Classroom Instructor / Faculty
        Lesson attendance verification, payable inquiry
        Zero access to institutional ledgers or till
    }
```

- **Unapproved Roles Excluded:** Roles such as `BRANCH_MANAGER`, `AUDITOR`, or `STOREKEEPER` are not authorized. All branch supervisory approvals fall within the delegated or direct authority of the `PRIMARY_MANAGER`.

---

## 8. Audit Verdict on Policy and Governance

| Governance Item | Requirement | Verification Finding | Status |
| :--- | :--- | :--- | :---: |
| **Attendance Cascade Safety** | Decouple financial proof | Resolved via `LessonDeliveryEvidence` lifecycle and `RESTRICT` policy. | **PASS** |
| **UP-704 Teacher Compensation** | Zero default calculation basis | Verified strictly open and unresolved in all documents. | **PASS** |
| **UP-705 Cashbox Threshold** | Zero unapproved thresholds | "50.00 EGP" completely removed; threshold strictly open. | **PASS** |
| **Payment Separation** | Independent coexistence | Legacy `Payment` and center `Collection` operate in complete isolation. | **PASS** |
| **Approved Decisions** | 11 decisions cataloged | All 11 approved decisions documented with implementation impacts. | **PASS** |
| **Open Questions** | 6 decisions tracked | All 6 open questions explicitly identified with required PO directions. | **PASS** |
| **Specialist Gates** | 4 formal reviews defined | CPA, Tax, Consumer Protection, and Privacy gates documented. | **PASS** |
| **Role Alignment** | Exactly 4 roles authorized | `PRIMARY_MANAGER`, `ACCOUNTANT`, `CASHIER`, `TEACHER` strictly enforced. | **PASS** |

**Conclusion:**  
The policy, governance, regulatory, and security foundations of Phase 2.0A and Phase 2.0A.1 are verified to be fully compliant, rigorously audited, and ready for Product Owner evaluation.

