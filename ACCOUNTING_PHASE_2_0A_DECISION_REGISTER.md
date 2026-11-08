# OX-DIGITAL Education — Accounting Track
# Phase 2.0A: Open Product Owner Decisions & Specialist Review Register

**Author:** Chief Governance Officer & Enterprise Systems Architect  
**Project:** OX-DIGITAL Education  
**Document Classification:** Authoritative Governance Gate & Decisions Register  
**Baseline Commit:** `0500b93e65c24ed881349c4acea7f523332c5e9f` on branch `main`  
**Date:** November 3, 2026

---

## 1. Executive Summary

This register catalogs the eleven open policy decisions, commercial rules, and external legal/tax specialist review gates governing the OX-DIGITAL Accounting Track.

To preserve architectural integrity, this phase does **NOT** invent answers or make arbitrary assumptions for unresolved policies. Each item is documented with its operational context, impacted schema models, architectural fallback, and the exact milestone blocked until resolution.

---

## 2. Unresolved Policy Decisions & Specialist Review Gates

| ID | Title & Core Question | Why It Matters | Impacted Schema Models / Constraints | Safe Design Fallback | Milestone Blocked | Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **OD-710** | **Period Close & Reopening Policy**<br>*May a closed accounting period ever be reopened?* | Hard close guarantees historical tax filings cannot change. Reopening introduces retrospective adjustment risks. | `AccountingPeriod`, `JournalEntry` (accountingDate check). | Design supports both via `IAccountingPeriodPolicy`. Default: Permanent Hard Close. | Blocks Task 7.4 (Period End Automation). | **OPEN — PENDING PO CHOICE** |
| **UP-704** | **Teacher Revenue-Share Qualifying Base**<br>*Is teacher share calculated on Gross Catalog Tuition, Net Agreed Tuition, or Net Collected Cash?* | Calculating on Gross when students receive 50% sibling discounts destroys center profit margins. | `TeacherCompensationAgreement.calculationBasis`, `CompensationCalculation`. | Design alternatives documented (Gross Catalog, Net Agreed, Net Collected). Basis is completely UNRESOLVED. No default selected. Variable compensation blocks until Product Owner choice is made. | Blocks Task 7.4 (Teacher Compensation Engine). | **OPEN — PENDING PO CHOICE** |
| **UP-705** | **Cashbox Discrepancy Policy**<br>*What is the threshold for mandatory Primary Manager shortage sign-off?* | Zero-tolerance blocks daily shift closes for minor coin shortages. High thresholds permit embezzlement. | `CashboxReconciliation.varianceAmount`, `CashboxTransaction`. | Threshold is completely UNRESOLVED. No default threshold assumed. Every discrepancy recorded; non-zero variances require investigation/approval until policy is enacted. | Blocks Phase 2 Service Implementation. | **OPEN — PENDING PO CHOICE** |
| **UP-711** | **Opening Balance Seeding Strategy**<br>*How are historical pre-system student debts/credits brought into the GL?* | Inventing opening balances corrupts the general ledger and trial balance. | `StudentFinancialAccount.currentBalance`, Opening `JournalEntry`. | Zero synthetic balances. Opening balances entered only upon certified schedule sign-off. | Blocks Production Migration / Cutover. | **OPEN — PENDING PO CHOICE** |
| **UP-712** | **Absence Package Consumption Policy**<br>*Does an unexcused absence consume a prepaid package session?* | Center operations require revenue for reserved seats; consumer regulations restrict charging for unrendered services. | `SessionConsumption.consumptionType`, `SessionPackage`. | Enforce `OD-722.1` (`PRESENT_ONLY`) as default; unexcused forfeiture configurable if agreed in contract. | Blocks Task 7.3 (Center Attendance Revenue). | **OPEN — PENDING PO CHOICE** |
| **UP-713** | **Legal Entity & Campus Ownership Structure**<br>*Are branches independent legal entities or internal operating locations?* | Determines whether branches require inter-company balancing accounts or single-entity profit centers. | `Branch`, `Account`, `JournalLine.branchId`. | Follows OD-703: Single General Ledger with multi-branch reporting dimensions. | Informational (Confirmed by OD-703). | **RESOLVED VIA OD-703** |
| **UP-701** | **Statutory Chart of Accounts Specialist Review**<br>*Formal audit of Egyptian 4-digit standardized accounting hierarchy.* | Guarantees compliance with Egyptian Accounting Standards (EAS) and tax authorities. | `Account`, `AccountCategory`, `NormalBalanceDirection`. | Master template drafted in Phase 1; requires independent Egyptian CPA review. | Blocks Task 7.5 (Financial Statement Delivery). | **SPECIALIST REVIEW GATE** |
| **UP-702** | **Written Egyptian Tax Counsel Opinion**<br>*VAT/Income Tax applicability on center tuition vs online digital courses.* | Educational tuition may enjoy specific VAT exemptions under Egyptian tax code (Law 67 of 2016). | `JournalLine` tax account codes (`2200 - Output VAT`). | Architecture isolates tax accounts; tax posting disabled until legal opinion received. | Blocks Task 7.3 (Tax & Billing Integration). | **SPECIALIST REVIEW GATE** |
| **UP-706** | **Student Withdrawal & Refund Legal Review**<br>*Statutory compliance of pro-rata refund terms and administrative fee caps.* | Egyptian Consumer Protection Law (Law 181 of 2018) overrides private center contracts. | `RefundRequest`, `FinancialAdjustment`. | Design allows pro-rata calculation and credit note issuance without hardcoding fee limits. | Blocks Task 7.3 (Refund Automation). | **SPECIALIST REVIEW GATE** |
| **UP-715** | **Statutory Retention & Privacy Scrubbing Review**<br>*Harmonizing Egyptian Tax retention (5-10 yrs) with Personal Data Protection Law.* | Legal penalty for premature record deletion vs penalty for retaining student PII indefinitely. | `User.deletedAt`, `StudentFinancialAccount`, `onDelete: Restrict`. | Anonymize personal profile data while preserving raw immutable financial ledger rows. | Blocks Long-Term Archival Automation. | **SPECIALIST REVIEW GATE** |
| **UP-709** | **Cumulative Adjustment Threshold Basis (500 EGP)**<br>*Clarify calculation basis and rolling window for cumulative adjustments.* | Controls unauthorized cashier credit note adjustments from eroding tuition revenues. | `FinancialAdjustment.amount`, `approvalRequired`. | Adjustments exceeding 500 EGP cumulatively per student/term require Primary Manager authorization. | Blocks Phase 2 Service Layer. | **OPEN — PENDING PO CHOICE** |

---

## 3. Governance Sign-Off Matrix

```text
========================================================================================
GOVERNANCE GATE STATUS:
DESIGN COMPLETE — IMPLEMENTATION BLOCKED PENDING RESOLUTION OF UP-704 & OD-710
========================================================================================
```

