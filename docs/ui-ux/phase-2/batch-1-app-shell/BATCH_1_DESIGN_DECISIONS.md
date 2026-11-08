# OX-DIGITAL Education — UI/UX Phase 2 (Batch 1)
# Document 4: Batch 1 Design Decisions & Architectural Log
**Document ID:** `BATCH_1_DESIGN_DECISIONS`  
**Status:** REVISED & ALIGNED — READY FOR PRODUCT OWNER REVIEW  
**Date:** 2026-11-03  
**Workspace:** `D:\OX-DIGITAL\Mathe\OX-DIGITAL-GITHUB`  
**Classification:** Design Decisions, Governance Rationales & Constraints Log  

> [!NOTE] Demonstration Data Policy
> All persona names, email addresses, financial figures, transaction counts, and branch titles in this document and accompanying mockups are **SYNTHETIC DEMONSTRATION DATA (DEMO DATA — NOT REAL)**.

---

## 1. Overview & Decision Framework

This document logs all fundamental visual, layout, and interaction decisions established during Batch 1 of Phase 2 (App Shell, Navigation & Global Layout). Every decision is grounded strictly in the accepted Phase 1 architecture and verified repository capabilities.

---

## 2. Formal Design Decisions Log

### Decision D-01: Native Arabic RTL as Primary Flow with Logical LTR Mirroring
- **Decision:** The application shell is architected with native Arabic Right-to-Left (`dir="rtl"`) as the primary design flow. All margins, paddings, borders, and directional icons use CSS logical properties (`ms-*`, `me-*`, `ps-*`, `pe-*`, `border-inline-*`, `text-start`, `text-end`).
- **Rationale:** OX-DIGITAL Education primarily serves educational centers in Egypt and the Middle East where front-desk receptionists, cashiers, and accountants operate natively in Arabic. By implementing pure logical properties, LTR internationalization functions automatically without code duplication.

### Decision D-02: Brand Color Authority & Preservation of Repository Baseline
- **Decision:** 
  - The active repository baseline in `apps/frontend/src/styles/theme.css` (`--primary: #b62626;`, `--destructive: #d4183d;`, `--sidebar-primary: #030213;`) is formally preserved as the operational theme baseline.
  - The deep crimson shade `#9e1b1b` is documented strictly as a **provisional design exploration** for high-contrast academic governance, awaiting explicit Product Owner approval.
  - No new logo or brand identity is invented; the shell reuses `apps/frontend/public/logo.jpeg` in an institutional frame.
- **Rationale:** Strict adherence to project governance boundaries prevents unapproved branding drift while providing high-contrast visual exploration options for executive evaluation.

### Decision D-03: Tabular Monospace Financial Figures & Currency Display
- **Decision:**
  - All monetary values across TopBar pills, summary badges, and sidebar metrics enforce tabular lining numbers (`font-mono tabular-nums font-semibold`).
  - Canonical ISO code: `EGP`.
  - Arabic display format: `ج.م` (e.g. `1,250.00 ج.م`).
  - English display format: `EGP` (e.g. `1,250.00 EGP`).
  - Prohibited informal tokens such as `E£` are strictly excluded.
- **Rationale:** In financial software, uneven digit widths cause decimals to misalign vertically across rows, increasing operator reading errors. Tabular figures guarantee precision.

### Decision D-04: Notifications Entry Point Designated as Future Placeholder
- **Decision:** The TopBar includes a standard notification bell icon (`Bell` 20px), but clicking it opens a clean placeholder flyout explicitly stating that live notifications are a future backend enhancement. No unbacked mock notification badges (e.g. "5 new alerts") are displayed.
- **Rationale:** Auditing the backend microservices confirms that while database models exist, there is no active WebSocket or push-notification broker for financial events. Displaying artificial notification counters would compromise user trust.

### Decision D-05: Multi-Branch vs Single-Branch Selector Locking
- **Decision:**
  - `PRIMARY_MANAGER`: Dynamic selector with search capability, listing 3 active demo branches (`BR-01` Cairo, `BR-02` Alexandria, `BR-ON` Digital) plus an executive `جميع الفروع (إجمالي المؤسسة)` option.
  - `ACCOUNTANT` / `TEACHER`: If assigned to a single branch, the Branch Selector Pill is **hard-locked in read-only mode** with a subtle lock icon (`Lock` 12px). If explicitly granted multi-branch rights by management, the selector allows switching only between authorized branches.
- **Rationale:** Prevents frontline staff from accidentally recording transactions or issuing receipts under the wrong campus branch dimension.

### Decision D-06: Removal of Independent Cashier Role & Maker-Checker Role Architecture
- **Decision:**
  - In strict compliance with Product Owner decision, there is **NO independent Cashier role, Cashier Dashboard, or separate Cashier navigation shell** in the accounting UI/UX design.
  - Cashbox operations and frontline fee collections are integrated directly into:
    1. **Primary Manager:** Cashbox management, collections/receipts oversight, cashbox transfers, daily reconciliation and discrepancy review under `UP-705`, expenses and financial approvals, and financial reports.
    2. **Accountant:** Dedicated Accountant Dashboard, student accounts and balances, recording collections and issuing receipts (subject to permissions), expense recording, preparing teacher dues, daily cashbox reconciliation, and preliminary financial reports.
  - **Maker-Checker Segregation:** Preserved strictly. Accountant may prepare eligible transactions; Primary Manager authorizes transactions requiring approval; Accountant cannot approve their own posted entries.
  - **Extension of Existing Teacher Interface:** Does not create a new Teacher Dashboard or separate menu; extends the existing platform Teacher interface with approved lesson delivery evidence and teacher's own approved dues/payment history under `UP-704`. Teachers have zero access to institution-wide accounting or other students' financial records.
  - Prohibited `Branch Manager` role (`OD-701`) is excluded.
  - Platform super-admin `admin@edu.com` (`OD-718`) operates outside the institution tenant shell.
  - No hidden-but-accessible routes: unauthorized navigation attempts redirect cleanly to `/unauthorized`.
- **Rationale:** Aligns accounting responsibilities with physical center operating reality, avoiding artificial role proliferation while preserving segregation of financial duties.

### Decision D-07: Anti-Gimmick Professional SaaS Aesthetic
- **Decision:** Visual designs avoid decorative neon glows, glassmorphism blurs on critical data cards, excessive gradients, and oversized hero sections.
- **Rationale:** Physical educational center counters operate under high-throughput conditions. Interfaces must prioritize information density, rapid scanning, and visual ergonomic comfort over consumer gimmicks.

### Decision D-08: Synthetic Demonstration Data Transparency
- **Decision:** All names, email addresses, institution titles, branch profiles, balances, transaction counts, and approval counts in the prototype and documentation are labeled as `DEMO DATA — NOT REAL`.
- **Rationale:** Eliminates any ambiguity regarding whether prototype figures represent real database records or live center metrics.

### Decision D-09: Neutral Connection Status in Sidebar Footer
- **Decision:** Replaced any real-time connection claims (`قاعدة البيانات متصلة`) with neutral design-only status (`حالة الاتصال غير معروضة في النموذج (تصميم فقط)`).
- **Rationale:** Prevents misleading operators into assuming active database connectivity or backend microservice health in a visual design prototype.

### Decision D-10: Strict Governance Boundary on Teacher Compensation (`UP-704`)
- **Decision:** The teacher navigation shell includes an entry point to certified delivery units (`TCH-DUES-01`), but displays zero unapproved fixed-unit calculation models or definitive earned-dues figures. Policy `UP-704` remains unresolved fail-closed.
- **Rationale:** Upholds approved accounting boundaries without preempting Product Owner commercial decisions.

### Decision D-11: Cross-Platform Keyboard Shortcuts
- **Decision:** Standardized global command and search shortcut display on `Ctrl / ⌘ + K` and modal help on `Ctrl / ⌘ + /`.
- **Rationale:** Avoids assuming macOS as the sole operating system on center reception workstations (typically Windows/PC).

### Decision D-12: External CDN Dependencies Disclosure
- **Decision:** Formally documented that `visual-mockup.html` loads Tailwind CSS from Google gstatic CDN and web fonts from Google Fonts.
- **Rationale:** Transparently identifies that the prototype is an interactive design preview that is not completely self-contained or offline-capable, while ensuring zero production dependencies were installed.

---

## 3. Summary of Design Invariants

| Invariant | Specification | Authority / Reference |
| :--- | :--- | :--- |
| **Primary Layout Direction** | Arabic Right-to-Left (`dir="rtl"`) | Phase 1 Design System Spec |
| **Active Theme Primary** | `--primary: #b62626` | `apps/frontend/src/styles/theme.css` |
| **Provisional Exploration**| `#9e1b1b` (Subject to PO Approval) | Phase 1 Document 7 |
| **Canonical Currency** | `EGP` (`ج.م` / `EGP`) | Approved Policy `OD-725` |
| **Allowed Tenant Accounting Roles** | `PRIMARY_MANAGER`, `ACCOUNTANT`, and extended `TEACHER` | PO Decision (Aligned) |
| **Independent Cashier Role** | Strictly REMOVED (Merged into Manager & Accountant) | PO Decision (Aligned) |
| **Branch Manager Role** | Strictly PROHIBITED | Approved Policy `OD-701` |
| **Super-Admin Placement** | Strictly OUTSIDE institution shell | Approved Policy `OD-718` |
| **Notifications Status** | Future Placeholder (No mock data) | Capability Audit Gate |
| **Demonstration Data** | Explicitly labeled `DEMO DATA — NOT REAL` | PO Directive |
| **Connection Claim** | `حالة الاتصال غير معروضة في النموذج` | PO Directive |
| **Teacher Compensation** | `UP-704` Unresolved (No model implied) | Approved Baseline |
| **Keyboard Shortcut** | `Ctrl / ⌘ + K` (Cross-platform) | PO Directive |
