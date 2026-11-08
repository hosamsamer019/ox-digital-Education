# OX-DIGITAL Education — UI/UX Phase 1
# Targeted Documentation Correction & Acceptance Preparation Report

**Document ID:** `UI_UX_PHASE_1_TARGETED_CORRECTION_REPORT`  
**Execution Date:** 2026-11-03  
**Workspace:** `D:\OX-DIGITAL\Mathe\OX-DIGITAL-GITHUB`  
**Execution Mode:** STRICTLY DOCUMENTATION-ONLY (Zero application code or infrastructure changes)  
**Current HEAD:** `0500b93e65c24ed881349c4acea7f523332c5e9f` on branch `main`  

---

## 1. Overview of Targeted Corrections

In accordance with Product Owner instructions, a focused, documentation-only correction and governance alignment has been performed across the Phase 1 UI/UX deliverable suite in [`docs/ui-ux/phase-1/`](file:///d:/OX-DIGITAL/Mathe/OX-DIGITAL-GITHUB/docs/ui-ux/phase-1).

No discovery audits were repeated, no information architectures were redesigned, and zero application or infrastructure code was modified.

---

## 2. Exact Documents Changed

The following documents in `docs/ui-ux/phase-1/` were updated to resolve policy boundaries, correct design token statuses, remove prohibited terminology, and decouple multi-layer financial accounting statements:

| Document | File Path | Nature of Targeted Correction |
| :--- | :--- | :--- |
| **Document 8** | [`UI_UX_PHASE_1_PRODUCT_OWNER_DECISIONS.md`](file:///d:/OX-DIGITAL/Mathe/OX-DIGITAL-GITHUB/docs/ui-ux/phase-1/UI_UX_PHASE_1_PRODUCT_OWNER_DECISIONS.md) | Formally separated approved baseline policies from unresolved policy gates (`UP-704`, `UP-705`, `UP-706`). Marked all recommendations strictly as recommendations. Decoupled suspended student collection from educational access reactivation. Documented operational trade-offs for 80mm vs A4 receipt formats without establishing default decisions. |
| **Document 7** | [`UI_UX_PHASE_1_DESIGN_SYSTEM_SPEC.md`](file:///d:/OX-DIGITAL/Mathe/OX-DIGITAL-GITHUB/docs/ui-ux/phase-1/UI_UX_PHASE_1_DESIGN_SYSTEM_SPEC.md) | Designated deep crimson `#9e1b1b` strictly as a *provisional design exploration* pending formal Product Owner approval. Documented active repository brand color baseline (`--primary: #b62626` in `apps/frontend/src/styles/theme.css`). Established canonical currency code `EGP` with localized display formats `ج.م` (Arabic) and `EGP` (English). Eliminated informal `E£` tokens. Added approved vs prohibited accounting terminology table. |
| **Document 5** | [`UI_UX_PHASE_1_CORE_WORKFLOWS.md`](file:///d:/OX-DIGITAL/Mathe/OX-DIGITAL-GITHUB/docs/ui-ux/phase-1/UI_UX_PHASE_1_CORE_WORKFLOWS.md) | Decoupled frontline fee collection into four distinct operational and accounting layers: (1) Operational Collection Evidence, (2) Physical Cashbox Movement (`CASH_IN`), (3) Student Sub-Ledger Tracking (`UNALLOCATED` advances), and (4) General Ledger Journal Posting (Debit Cash Asset, Credit Deferred Revenue). Explicitly confirmed zero earned revenue is recognized upon collection. Added formal decoupled state machine for financial suspension, collection, and access reactivation. |
| **Document 6** | [`UI_UX_PHASE_1_DATA_API_DEPENDENCY_MATRIX.md`](file:///d:/OX-DIGITAL/Mathe/OX-DIGITAL-GITHUB/docs/ui-ux/phase-1/UI_UX_PHASE_1_DATA_API_DEPENDENCY_MATRIX.md) | Aligned screen data contracts for `CSH-DESK-01`, `TCH-DUES-01`, `CB-DISC-01`, and `STU-REC-01` to reflect four-layer accounting separation, fail-closed `UP-704`/`UP-705`/`UP-706` gates, and receipt rendering independence. |
| **Document 9** | [`UI_UX_PHASE_1_FINAL_SUMMARY.md`](file:///d:/OX-DIGITAL/Mathe/OX-DIGITAL-GITHUB/docs/ui-ux/phase-1/UI_UX_PHASE_1_FINAL_SUMMARY.md) | Synchronized executive summary, critical dependencies, governance gates, currency definitions, and final readiness declaration. |
| **Document 4** | [`UI_UX_PHASE_1_SCREEN_SPECIFICATIONS.md`](file:///d:/OX-DIGITAL/Mathe/OX-DIGITAL-GITHUB/docs/ui-ux/phase-1/UI_UX_PHASE_1_SCREEN_SPECIFICATIONS.md) | Replaced rogue informal `E£` tokens in wireframes with canonical Arabic currency designation `ج.م`. Replaced prohibited installment term `القسط المستحق` with `الدفعة المستحقة`. Fixed tab title stutter. |
| **Document 1** | [`UI_UX_PHASE_1_DISCOVERY_AUDIT.md`](file:///d:/OX-DIGITAL/Mathe/OX-DIGITAL-GITHUB/docs/ui-ux/phase-1/UI_UX_PHASE_1_DISCOVERY_AUDIT.md) | Replaced unconditional brand label with active repository `--primary: #b62626` and provisional exploration `#9e1b1b`. |
| **Document 2** | [`UI_UX_PHASE_1_INFORMATION_ARCHITECTURE.md`](file:///d:/OX-DIGITAL/Mathe/OX-DIGITAL-GITHUB/docs/ui-ux/phase-1/UI_UX_PHASE_1_INFORMATION_ARCHITECTURE.md) | Replaced hard-coded brand color reference with active/provisional token definition. |

---

## 3. Decisions Correctly Marked as Unresolved

Every decision in `UI_UX_PHASE_1_PRODUCT_OWNER_DECISIONS.md` has been verified against existing approved baseline decisions and active unresolved policies:

| Decision ID | Subject | Related Policy ID | Status Classification | Approved Invariant vs. Unresolved Scope |
| :--- | :--- | :---: | :---: | :--- |
| **POD-UI-01** | Cashbox Discrepancy Resolution | `UP-705` | **UNRESOLVED / FAIL-CLOSED** | **Approved Invariant:** Zero tolerance; non-zero difference forces `DISCREPANCY_PENDING_INVESTIGATION`. Zero automated write-offs or thresholds.<br>**Unresolved Scope:** In-app clearing mechanisms (Manager balancing voucher vs employee liability deduction vs permanent flag) remain neutral recommendations only. The UI models pending-investigation and review states only. |
| **POD-UI-02** | Teacher Variable Compensation Base | `UP-704` | **UNRESOLVED / FAIL-CLOSED** | **Approved Invariant:** Variable revenue share calculation is blocked fail-closed pending written PO approval. Fixed models (salary, fixed amount per lesson) are permissible.<br>**Unresolved Scope:** Neither Earned Delivered Revenue nor Collected Cash is approved as default. The calculation base remains strictly configurable at the specification level. |
| **POD-UI-03** | Student Withdrawal Refund Settlement | `UP-706` | **UNRESOLVED / SUBJECT TO SPECIALIST & LEGAL REVIEW** | **Approved Invariant:** Automated refund disbursement is blocked fail-closed. 100% of historical receipts and allocations remain append-only intact.<br>**Unresolved Scope:** Neither refund formula (session pro-rata vs milestone) is approved. UI represents refund request, review, approval, and adjustment as decoupled states without committing to a formula. |
| **POD-UI-04** | Collection on Financially Suspended Students | Operational Governance | **UNRESOLVED** | **Approved Invariant:** Financial suspension blocks classroom attendance.<br>**Unresolved Scope:** Payment does **NOT** automatically restore educational access. Financial suspension, collection, review, and access reactivation are decoupled. Reactivation requires explicit authorized permission. |
| **POD-UI-05** | Frontline Receipt Hardware Standard | Operational Governance | **PROPOSED OPTIONS ONLY** | **Approved Invariant:** Frontline collections require an official signed receipt evidence record.<br>**Unresolved Scope:** 80mm thermal roll and A4 PDF are documented as proposed options with trade-offs (speed, footprint, cost, archival longevity) for Product Owner selection; neither is an approved default. |

---

## 4. Financial UX Statement Validation & Four-Layer Decoupling

The assertion regarding cashier fee receipts and `StudentBalanceBucket.UNALLOCATED` has been audited and reconciled with the existing pure accounting domain (`packages/shared/src/accounting/center/subLedger.ts`, `cashbox.ts`, and `journalEntry.ts`).

The UI documentation now rigorously distinguishes the four operational and accounting layers:
1. **Layer 1: Operational Collection Evidence (`CollectionReceiptEvidence`):**
   - Frontline cashier records payment interaction, capturing tender method, cashier identity, branch till ID, timestamp, and payer metadata.
2. **Layer 2: Physical Cashbox Register Movement (`CashMovement`):**
   - A physical `CASH_IN` debit updates the branch cashbox register balance.
3. **Layer 3: Student Sub-Ledger Tracking (`StudentSubLedgerAccount`):**
   - The sub-ledger card tracks the unapplied advance under `StudentBalanceBucket.UNALLOCATED` before being allocated (`ALLOCATED`) against scheduled obligation line items.
4. **Layer 4: General Ledger Double-Entry Journal Posting (`JournalEntry`):**
   - Posts balanced entry: **Debit** Cashbox Asset (Account `1010`) / **Credit** Deferred Student Collections Liability (Account `2210`).
   - **Zero Recognized Revenue:** Earned revenue is NEVER posted upon collection.
5. **Layer 5: Accrual Revenue Recognition (`RevenueRecognitionEngine`):**
   - Tuition revenue recognition occurs exclusively upon verification of certified educational delivery evidence (`LessonDeliveryEvidence`), posting: **Debit** Deferred Revenue (Account `2210`) / **Credit** Educational Service Revenue (Account `4100`).

---

## 5. Remaining Contradictions & Quality Review

- **Terminology Integrity:** A repository-wide regex search confirms that prohibited terms (`أقساط` / `Installments`) appear only in explicit prohibition tables and warning callouts. All wireframes and user-facing specifications use `جدول السداد` (Payment Schedule), `مستحق` (Due), `محصل` (Collected), and `متبقي` (Remaining).
- **Currency Cleanliness:** All wireframes and display tokens now use canonical Arabic `ج.م` or English `EGP`. Informal tokens (`E£`) have been eradicated.
- **Brand Identity Decoupling:** Deep crimson `#9e1b1b` is nowhere asserted as an approved brand decision; it is labeled consistently as a provisional design exploration alongside the active repository token `--primary: #b62626`.
- **Contradiction Audit Result:** Zero remaining contradictions found across all 9 documents in `docs/ui-ux/phase-1/`.

---

## 6. Confirmation of System and Workspace Safety

- [x] **No Application Code Changed:** Zero frontend or backend source files (`apps/frontend/src/`, `services/`, `packages/`) were modified.
- [x] **No API Contracts or Routers Changed:** Zero controllers, routes, or HTTP endpoints were altered.
- [x] **No Database Schemas or Data Changed:** Zero Prisma migrations, SQL executions, or schema changes were performed.
- [x] **No Infrastructure / Docker Operations:** Staging, production, and Docker environments remained untouched.
- [x] **No Git State Changes:** Zero commits, resets, stashes, or branch checkouts were performed.
- [x] **Pre-existing Workspace Changes Preserved:** All 60 pre-existing tracked modified files remain in their exact pre-task status.
- [x] **Increment 5 Preserved:** Increment 5 features have NOT been started.

---

# PHASE 1 DOCUMENTATION READY FOR PRODUCT OWNER ACCEPTANCE

