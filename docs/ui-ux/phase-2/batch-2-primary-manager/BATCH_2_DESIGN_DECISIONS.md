# OX-DIGITAL Education — UI/UX Phase 2 (Batch 2)
# Document 6: Batch 2 Design Decisions & Governance Log
**Document ID:** `BATCH_2_DESIGN_DECISIONS`  
**Status:** COMPLETE & AUTHORITATIVE — READY FOR PRODUCT OWNER REVIEW  
**Date:** 2026-11-03  
**Workspace:** `D:\OX-DIGITAL\Mathe\OX-DIGITAL-GITHUB`  
**Target Path:** `docs/ui-ux/phase-2/batch-2-primary-manager/BATCH_2_DESIGN_DECISIONS.md`  
**Classification:** Architectural Governance & Audit Decisions  

> [!NOTE] Demonstration Data Policy
> All figures, persona references, voucher identifiers, and branch structures described in this document are **SYNTHETIC DEMONSTRATION DATA (DEMO DATA — NOT REAL)**.

---

## 1. Executive Summary & Purpose

This document formally records all design decisions, architectural invariants, policy protections, and assumptions deliberately avoided during the design of **Phase 2 — Batch 2 (Primary Manager Dashboard)**. It ensures complete alignment with the Product Owner's mandates and preserves all unresolved policy gates.

---

## 2. Key Batch 2 Architectural & Design Decisions

### Decision D-07: Multi-Branch Consolidated vs Granular Drill-Down Architecture
- **Context:** The educational institution operates multiple physical branches and an online digital branch (`Branch.isOnline = true`). The Primary Manager requires instant institution-wide visibility without losing the ability to audit individual campus operations.
- **Decision:** The dashboard features a persistent, authoritative Branch Selector in the TopBar defaulting to **`المركز بالكامل (عرض موحد - شامل الفروع)`**. When a specific branch is selected, the dashboard dynamically isolates branch cashboxes, local receipt streams, and branch-specific expense queues. Every cashbox is strictly associated with an approved institution branch dimension (the Central Vault `CB-MAIN` is associated with Primary Branch `BR-01`). Intra-institution cash transfers are recognized as liquidity-neutral movements in consolidated mode; cross-institution transfers are prohibited.
- **Prohibited Alternative Avoided:** Creating a separate "Branch Manager" role or distinct branch manager dashboard (`OD-701`). Direct branch governance remains the sole purview of the Primary Manager.

---

### Decision D-08: Four-Tier Separation of Financial Commitments and Revenue
- **Context:** Commercial educational software often conflates total tuition agreements with earned revenue or cash collections, creating severe misleading accounting distortion.
- **Decision:** The Primary Manager interface strictly separates and labels four distinct financial tiers:
  1. **Tier 1 — Financial Agreement (`العقد والاتفاق المالي`):** Total contractual commitment and approved scholarship discounts.
  2. **Tier 2 — Amount Due (`المستحق الواجب سداده`):** Billed installments past or at their due date according to the payment schedule.
  3. **Tier 3 — Actual Collections (`التحصيلات الفعلية والنقدية`):** Real funds verified and debited to cashbox tills or digital payment gateways.
  4. **Tier 4 — Recognized Revenue (`الإيراد التعليمي المحقق`):** Value of educational services actually delivered to students derived strictly from the approved immutable course allocation plan and certified lesson-delivery evidence (attendance).
- **Protection:** Uncollected agreement values and unearned prepaid tuition are strictly excluded from recognized revenue. Teacher compensation under UP-704 is never inferred from recognized student revenue or lesson counts.

---

### Decision D-09: Uncompromising Maker-Checker Segregation
- **Context:** Financial risk is heightened when operational personnel can initiate and approve cash outflows or ledger adjustments.
- **Decision:** The Accountant acts strictly as the **Maker** (drafting expense vouchers with flexible supporting documents such as invoices, receipts, delivery notes, or service reports; submitting closing cash counts; drafting scholarship adjustments). The Primary Manager acts as the sole **Checker / Approver** (inspecting attachments, verifying budget lines, signing disbursements, authorizing adjustments).
- **Protection:** Zero self-approval. No Accountant can approve or disburse their own posted vouchers. Tax calculations, VAT, and withholding taxes are completely excluded.

---

### Decision D-10: Fail-Closed Cashbox Discrepancy Gate (`UP-705`)
- **Context:** When daily physical cash counts differ from the system ledger balance, traditional systems often provide automated write-offs or speculative tolerance thresholds.
- **Decision:** Under open policy `UP-705`, any variance between physical cash and book balance locks the cashbox closing in neutral **`قيد المراجعة والتحقيق الإداري` (Under Investigation)** status. The Primary Manager is alerted via a dedicated incident dossier.
- **Protection:** No automated write-offs, no transfer of shortages to employee liability or cashier debt, no surplus income recognition, no balancing accounting entries, no mandatory investigation procedures, and no arbitrary tolerance thresholds (e.g. $\pm 50$ EGP) are implemented.

---

### Decision D-11: Fail-Closed Teacher Compensation Gate (`UP-704`)
- **Context:** Institutional policy regarding teacher compensation formulas (per-student percentage vs flat hourly rate vs tiered attendance tiers) remains unresolved under `UP-704`.
- **Decision:** The Primary Manager Teacher module (`PM-TCH-01`) displays verified educational lesson delivery evidence and student attendance counts only. Financial settlement preparation is explicitly marked as **`في انتظار اعتماد لائحة الأجور الرسمية`**. Teacher compensation is strictly decoupled from student recognized revenue.
- **Protection:** No default calculation formulas, percentage allocations, or fixed hourly rates are invented.

---

### Decision D-12: Total Exclusion of Tax/VAT Modules and Revenue Forecasting
- **Context:** Educational institutions frequently request tax calculations or automated growth forecasting, which are outside the currently authorized accounting foundation.
- **Decision:** Egyptian VAT, commercial withholding taxes, tax return screens, and predictive revenue forecasting are **100% excluded** from the Primary Manager Dashboard and report specifications.
- **Protection:** All reports and KPI tiles reflect only verified historical facts and confirmed ledger movements.

---

### Decision D-13: Demonstration Data Integrity & Neutral Connection Status
- **Context:** Visual mockups must not deceive stakeholders into believing real production data or live backend services are active.
- **Decision:** All sample figures, balances, and operational names carry a persistent, visible **`DEMO DATA — NOT REAL`** disclaimer. The sidebar connection indicator displays a neutral design-only status: **`حالة الاتصال غير معروضة في النموذج`**.
- **Protection:** Eliminates false representations of live database or microservice connectivity.

---

### Decision D-14: Physical-Centers-First Accounting Scope (Online Deferred)
- **Context:** The Product Owner has directed that the active accounting foundation be restricted strictly to physical educational campuses. Online subscriptions, digital recurring billing, payment gateway settlements (Fawry/Paymob), and online revenue recognition are deferred future scope.
- **Decision:** Consolidated KPIs ($110,500.00\text{ EGP}$ collections, $39,700.00\text{ EGP}$ overdue, $86,400.00\text{ EGP}$ cashbox liquidity, $93,000.00\text{ EGP}$ recognized revenue) consolidate physical centers only (Dokki and Nasr City). The digital branch structure (`BR-ONLINE`, `Branch.isOnline: true`) is retained as an architectural placeholder but clearly labeled as **`مؤجل — خارج النطاق المالي الحالي`** with zero active financial transactions.
- **Protection:** Prevents conflating complex digital subscription billing / gateway clearing with physical campus cashbox governance.

---

### Decision D-15: Elimination of Customer-Facing Installment Terminology
- **Context:** Commercial financing terms like `قسط` and `الأقساط` carry consumer lending / financing connotations inappropriate for Egyptian educational centers.
- **Decision:** Customer-facing terminology is strictly standardized to scheduled educational payments: **`جدول استحقاق الدفعات والمواعيد`**, **`مسمى الدفعة`**, **`الدفعة المستحقة`**, **`المبالغ المتأخرة`**, and **`المتبقي للسداد`**. Prohibited terms (`قسط`, `الأقساط`, `أقساط الطلاب`) are eliminated across all screens and specs.
- **Protection:** Aligns UI language with educational sector norms while preserving strict due dates and scheduled amount tracking.

---

### Decision D-16: Consolidated Cashbox Liquidity Reconciliation & Conservation Enforcement
- **Context:** An audit identified an inconsistency between branch overview summaries and the central cashbox register: Dokki reception tills totaled $38,400.00\text{ EGP}$ (`CB-01`: $24,500$ + `CB-02`: $13,900$), Central Vault totaled $30,000.00\text{ EGP}$ (`CB-MAIN`), while the Nasr City branch summary displayed $28,000.00\text{ EGP}$ (an unverified figure referencing a non-existent `CB-04`), causing an apparent discrepancy against the consolidated KPI of $86,400.00\text{ EGP}$.
- **Decision:** Reconciled Nasr City branch overview display to its exact and sole active physical cashbox: **`CB-03`** with a closing book balance of **$18,000.00\text{ EGP}$** ($17,850.00\text{ EGP}$ counted cash, with $-150.00\text{ EGP}$ discrepancy locked under `UP-705`). Consolidated cashbox liquidity is mathematically proven and established as **$86,400.00\text{ EGP}$**, which is the exact sum of all 4 active physical cashboxes ($24,500 + 13,900 + 30,000 + 18,000$). Intra-institution transfers are enforced as strictly conservation-preserving with zero reduction of consolidated institutional liquidity.
- **Protection:** Eliminates phantom cashbox references (`CB-04`) and guarantees that internal transfers never alter total cash liquidity.

---

## 3. Summary of Assumptions Explicitly Avoided

| Architectural Area | Speculative Assumption Avoided | Authoritative Design Treatment Applied |
| :--- | :--- | :--- |
| **Cashbox Tolerances** | "Small cash differences under 50 EGP can be automatically written off or loaded onto cashier." | **Rejected.** Every non-zero variance triggers neutral `UP-705` investigation; no liability transfer or write-off. |
| **Tuition Booking** | "When a student signs up for a 6,000 EGP course, recognize 6,000 EGP as income." | **Rejected.** Income recognized derived strictly from approved immutable allocation plan & certified attendance. |
| **Teacher Pay** | "Assume a default 50% teacher share or 200 EGP/hour fee." | **Rejected.** Display verified delivery units only; hold settlement pending `UP-704`. |
| **Branch Governance** | "Create a local Branch Manager persona to approve branch expenses." | **Rejected.** Sole Primary Manager governs all branches (`OD-701`). |
| **Platform Admin** | "Allow SaaS admin@edu.com to approve center expenses." | **Rejected.** Platform admin strictly isolated outside institutional tenant shell (`OD-718`). |
| **Future Forecasts** | "Show a 6-month projected revenue curve based on enrollment trends." | **Rejected.** Strictly audited historical data only; no speculative forecasting. |
| **Statutory Taxes** | "Deduct 1% withholding tax and add 14% VAT to expense vouchers." | **Rejected.** Tax functionality is explicitly outside the authorized scope. |
| **Online Billing Scope** | "Include Paymob/Fawry settlement balances in current liquidity and revenue." | **Rejected.** Physical centers first; online billing explicitly deferred (D-14). |
| **Commercial Financing** | "Frame tuition schedules as loan installments (`أقساط`)." | **Rejected.** Standardized as educational payment schedules (`جدول الدفعات`) (D-15). |
| **Cash Transfer Leakage** | "Deduct internal transfers from consolidated institutional cash liquidity." | **Rejected.** Internal transfers are strictly conservation-preserving; consolidated liquidity equals sum of all cashbox closing balances ($86,400.00\text{ EGP}$) (D-16). |

---

## 4. Status of Open Architectural Policies

| Policy ID | Domain Area | Status | Treatment in Batch 2 Deliverables |
| :--- | :--- | :---: | :--- |
| **`UP-701`** | Statutory Chart of Accounts Review | **OPEN** | Operational cost categories used; statutory COA not applied. |
| **`UP-704`** | Teacher Compensation Qualifying Base | **OPEN** | Fail-closed: Displays verified lesson evidence; settlement locked. |
| **`UP-705`** | Cashbox Discrepancy Sign-Off & Tolerances | **OPEN** | Fail-closed: Discrepancies locked in neutral investigation; no auto write-off, no liability shifts, no accounting entries. |
| **`UP-706`** | Student Refund Formula & Legal Review | **OPEN** | Fail-closed: Refund requests placed in legal/administrative review. |
| **`UP-710`** | Financial Period Close & Reopening Controls| **OPEN** | Daily closings do not permanently lock historic records without override. |

