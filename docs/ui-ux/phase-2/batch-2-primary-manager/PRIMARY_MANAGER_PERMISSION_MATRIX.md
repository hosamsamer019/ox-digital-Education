# OX-DIGITAL Education — UI/UX Phase 2 (Batch 2)
# Document 4: Primary Manager Permission Matrix & Governance Boundaries
**Document ID:** `PRIMARY_MANAGER_PERMISSION_MATRIX`  
**Status:** COMPLETE & AUTHORITATIVE — READY FOR PRODUCT OWNER REVIEW  
**Date:** 2026-11-03  
**Workspace:** `D:\OX-DIGITAL\Mathe\OX-DIGITAL-GITHUB`  
**Target Path:** `docs/ui-ux/phase-2/batch-2-primary-manager/PRIMARY_MANAGER_PERMISSION_MATRIX.md`  
**Classification:** Role-Based Access Control (RBAC) & Maker-Checker Security  

> [!NOTE] Demonstration Data Policy
> Any user identities, security tokens, role identifiers, or branch assignments cited in this document are **SYNTHETIC DEMONSTRATION DATA (DEMO DATA — NOT REAL)**.

---

## 1. Executive Role Architecture & Security Principles

The OX-DIGITAL Education accounting security model establishes definitive boundaries across institutional personas. It prevents financial fraud, unauthorized data access, and conflicts of interest through three core structural pillars:

1. **Sole Institutional Primary Manager:** Each educational tenant institution (`INST-01`) has an authoritative Primary Manager role with institution-wide and branch-level jurisdiction.
2. **Defensive Maker-Checker Segregation:** No single individual possesses the capability to both initiate and unilaterally authorize a financial disbursement or balance adjustment.
3. **Strict Persona Isolation:**
   - **No Independent Cashier Role:** Frontline collection and register operations are embedded within the Accountant and Primary Manager interfaces.
   - **No Branch Manager Role (`OD-701`):** Branch-level oversight is exercised directly by the Primary Manager.
   - **SaaS Platform Super-Admin Isolation (`OD-718`):** The platform operator (`admin@edu.com`) maintains system infrastructure and tenant provisioning, but has **zero operational, viewing, or signing privileges** within the institutional accounting ledger.
   - **Teacher Domain Isolation:** Teachers have read-only visibility into their own educational delivery evidence and personal approved dues. They cannot view center cashboxes, general ledger entries, or other students' financial records.

---

## 2. Comprehensive RBAC Entitlements Matrix

| Operational Capability | Primary Manager (`PRIMARY_MANAGER`) | Accountant (`ACCOUNTANT`) | Teacher (`TEACHER`) | Platform Admin (`admin@edu.com`) | Maker-Checker Security Constraint |
| :--- | :---: | :---: | :---: | :---: | :--- |
| **View Consolidated Dashboard (`PM-DASH-01`)** | **ALLOW (Full)** | DENY | DENY | DENY | Executive institution-wide consolidation reserved for PM. |
| **Switch Between Campus Branches** | **ALLOW (All)** | RESTRICTED (Assigned Branch Only) | RESTRICTED (Assigned Branch Only) | DENY | Accountant and Teacher viewports locked to assigned physical/online campus. |
| **Initiate Frontline Collection Receipt (`ACC-REC-NEW`)** | ALLOW (Oversight/Backup) | **ALLOW (Primary Maker)** | DENY | DENY | Collection receipt creation logged with operator identity. |
| **Draft Expense Voucher (`EXP-NEW-01`)** | ALLOW | **ALLOW (Primary Maker)** | DENY | DENY | Maker drafts voucher with flexible supporting documents (invoices, receipts, delivery notes, service reports). |
| **Authorize Expense Voucher Disbursement** | **ALLOW (Sole Checker)** | **DENY (Strict)** | DENY | DENY | **Zero self-approval.** Accountant cannot approve vouchers. |
| **Initiate Inter-Cashbox Transfer** | ALLOW | **ALLOW (Maker)** | DENY | DENY | Transfer requires physical custody confirmation by receiving till/vault. All cashboxes bound to approved branches. |
| **Authorize Inter-Cashbox Transfer** | **ALLOW (Sole Checker)** | DENY | DENY | DENY | PM authorizes intra-institution transfer between branch cashboxes. Cross-institution transfers prohibited. |
| **Perform Daily Cashbox Blind Count** | ALLOW (Auditor) | **ALLOW (Custodian)** | DENY | DENY | Accountant/Till Custodian performs physical blind count. |
| **Countersign Balanced Cashbox Closing** | **ALLOW (Checker)** | ALLOW (Maker Signature) | DENY | DENY | Dual-signature required for daily closing lock. |
| **Adjudicate Cashbox Discrepancy (`UP-705`)** | **ALLOW (Neutral Reviewer)** | DENY (Subject of Count) | DENY | DENY | PM maintains neutral review dossier. No write-off, employee liability transfer, surplus recognition, or accounting entries permitted. |
| **Draft Student Fee Adjustment / Discount** | ALLOW | **ALLOW (Maker)** | DENY | DENY | Accountant drafts adjustment with academic scholarship justification. |
| **Authorize Student Fee Adjustment** | **ALLOW (Sole Checker)** | **DENY (Strict)** | DENY | DENY | PM approval required to adjust net agreed price or installment schedule. |
| **Log Educational Lesson Attendance** | ALLOW (Oversight) | DENY | **ALLOW (Academic Maker)** | DENY | Teacher logs student attendance; creates delivery evidence (`TCH-EVID-01`). |
| **Approve Educational Delivery Evidence** | **ALLOW (Academic Director)**| DENY | DENY | DENY | Management verification of delivered classes. |
| **Calculate / Settle Teacher Compensation** | **LOCKED (UP-704)** | **LOCKED (UP-704)** | DENY | DENY | **Fail-closed.** Compensation calculation locked pending policy ratification. |
| **View Student Sub-Ledger Profile (`STU-FIN-01`)**| **ALLOW (Full Multi-Branch)** | ALLOW (Assigned Branch) | DENY | DENY | Teachers cannot view student payment or balance records. |
| **Export Audited Financial Reports (`PM-RPT-01`)**| **ALLOW (All Reports)** | RESTRICTED (Draft Reports) | DENY | DENY | Executive financial exports reserved for PM. |
| **Create New Institutional Branch** | **ALLOW** | DENY | DENY | DENY | Direct institutional governance capability. |
| **Modify Database Schemas or Execute SQL** | **DENY (Strict)** | **DENY (Strict)** | **DENY (Strict)** | **DENY (In Shell)** | Production databases protected against direct UI tampering. |

---

## 3. High-Risk Action Boundaries & Prohibited Capabilities

The following actions are explicitly prohibited by architecture and cannot be granted to any role:

```text
+-----------------------------------------------------------------------------------------------------------------------+
| PROHIBITED ACTIONS IN OX-DIGITAL EDUCATION ACCOUNTING ENGINE                                                          |
+-----------------------------------------------------------------------------------------------------------------------+
| [X] AUTOMATED DISCREPANCY WRITE-OFF & EMPLOYEE LIABILITY: Neither PM nor Accountant can automatically write off      |
|     cashbox shortages, transfer shortages into employee liabilities, absorb surpluses into P&L, or generate          |
|     balancing accounting entries without formal resolution of UP-705.                                                 |
| [X] RETROACTIVE RECEIPT MUTATION: Posted collection receipts are immutable and append-only. No role can edit or       |
|     delete an issued financial receipt. (Corrections require explicit, balanced reversal receipts).                   |
| [X] REVENUE RECOGNITION FROM UNBILLED AGREEMENTS: Total tuition agreement contracts cannot be credited to earned      |
|     revenue prior to verified lesson delivery evidence.                                                               |
| [X] SPECULATIVE FUTURE FORECASTING: No predictive revenue modeling or artificial growth projections are permitted    |
|     in executive reports.                                                                                             |
| [X] STATUTORY TAX CALCULATIONS & VAT SCREENS: Egyptian VAT, commercial withholding taxes, and tax returns are          |
|     explicitly excluded from the current product scope.                                                               |
| [X] BYPASSING MAKER-CHECKER FOR DISBURSEMENTS: No single user can prepare, approve, and disburse cash above the      |
|     petty cash threshold in a single operation.                                                                       |
+-----------------------------------------------------------------------------------------------------------------------+
```

---

## 4. Cross-Branch Data Boundary Isolation

To protect multi-branch data integrity and confidentiality:
1. **Branch Scoping Enclosure:**
   - Any API request dispatched from the UI carries the tenant token `institutionId` and target `branchId`.
   - The backend validates that the requesting `userId` has permission to query the specified branch.
2. **Accountant Scoping Restriction:**
   - When an Accountant assigned to `BR-01` (فرع الدقي) logs in, the branch selector is locked read-only.
   - Any attempt to forge an API call targeting `BR-02` (فرع مدينة نصر) returns `403 Forbidden`.
3. **Primary Manager Unrestricted Scoping:**
   - The Primary Manager session carries the wildcard branch scope `*`, enabling aggregated consolidation and granular campus drill-down without permission elevation prompts.

