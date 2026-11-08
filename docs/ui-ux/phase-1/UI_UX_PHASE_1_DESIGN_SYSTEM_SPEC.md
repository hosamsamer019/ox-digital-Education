# OX-DIGITAL Education — UI/UX Design Track — Phase 1
# Document 7: Design System Specification & Visual Guidelines
**Document ID:** `UI_UX_PHASE_1_DESIGN_SYSTEM_SPEC`  
**Status:** REVISED & ALIGNED — READY FOR PRODUCT OWNER REVIEW  
**Date:** 2026-11-03  
**Workspace:** `D:\OX-DIGITAL\Mathe\OX-DIGITAL-GITHUB`  
**Classification:** Design Tokens, Components & Styling Foundation  

---

## 1. Design System Philosophy & Identity

OX-DIGITAL Education is designed as an authoritative, commercial, high-trust SaaS platform for educational center operations and multi-branch management.

### Core Principles
1. **High Information Density Without Visual Fatigue:** Educational centers handle hundreds of daily transactions and students. Interfaces prioritize compact data grids, clear typography, and scannable visual anchors over decorative whitespace.
2. **First-Class Arabic RTL Architecture:** Designed natively for right-to-left layout flow, natural eye-scanning paths, and Arabic reading conventions, while maintaining seamless LTR internationalization capability.
3. **Financial State Transparency:** Distinct visual tokens differentiate unallocated funds, active obligations, posted entries, and append-only reversals at a glance.
4. **Anti-Gimmick Design:** Strictly zero neon gradients, zero decorative glowing borders, zero oversized hero cards, and zero unbacked metrics.

---

## 2. Typography & Arabic Localization Hierarchy

### 2.1 Font Stack
- **Primary Interface Font (Arabic & English):** `Cairo`, `Tajawal`, system `-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`.
- **Financial Figures & Numeric Tables:** Standard monospace with tabular lining figures: `font-mono tabular-nums font-semibold` to guarantee vertical decimal alignment across multi-row financial ledgers.

### 2.2 Typographic Scale
| Token | Size | Line Height | Weight | Usage |
| :--- | :--- | :--- | :--- | :--- |
| `text-display` | 28px (1.75rem) | 36px | Bold (700) | Executive Dashboard KPI Hero Values |
| `text-h1` | 22px (1.375rem)| 30px | Bold (700) | Screen Main Title |
| `text-h2` | 18px (1.125rem)| 26px | SemiBold (600) | Section Headers, Modal Titles |
| `text-h3` | 15px (0.9375rem)| 22px | SemiBold (600) | Card Titles, Table Headers |
| `text-body` | 13px (0.8125rem)| 20px | Regular (400) | Form Labels, Table Cell Data |
| `text-caption`| 11px (0.6875rem)| 16px | Medium (500) | Metadata, Badges, Timestamps, Footers |

### 2.3 RTL / LTR Bi-Directional Layout Rules
- **CSS Logical Properties:** Use `ms-*` (margin-inline-start), `me-*` (margin-inline-end), `ps-*` (padding-inline-start), and `pe-*` (padding-inline-end).
- **Text Alignment:** Always use `text-start` and `text-end` rather than `text-left` or `text-right`.
- **Directional Icons:** Chevrons, back arrows, and flow indicators automatically flip based on document direction (`dir="rtl"` vs `dir="ltr"`).

---

## 3. Color Tokens & Brand Asset Audit

### 3.1 Existing Repository Color Baseline
Inspection of the existing frontend codebase reveals the active theme configuration:
- **Active Stylesheet (`apps/frontend/src/styles/theme.css`):**
  - `--primary: #b62626;` (Established rich red brand token)
  - `--destructive: #d4183d;`
  - `--sidebar-primary: #030213;`
  - `--background: #ffffff;` (Dark mode: `oklch(0.145 0 0)`)
- **Fallback Stylesheet (`apps/frontend/default_shadcn_theme.css`):**
  - `--primary: #030213;` (Default dark slate fallback)

### 3.2 Provisional Color Exploration (Subject to PO Approval)
> [!NOTE]
> The deep crimson shade `#9e1b1b` represents a **provisional design exploration** intended for high-contrast academic SaaS governance. It is **NOT** an approved brand identity decision. Final brand color authority rests exclusively with the Product Owner.

| Token Name | Active Repository Token | Provisional Exploration | Status | Usage |
| :--- | :--- | :--- | :---: | :--- |
| **Brand Primary** | `#b62626` | `#9e1b1b` | **Provisional Exploration** | Active navigation, primary action buttons, logo accents |
| **Brand Primary Hover** | `#9e1b1b` | `#7f1d1d` | **Provisional Exploration** | Hover and pressed states for primary buttons |
| **Destructive** | `#d4183d` | `#dc2626` | Baseline Active | Dangerous actions, reverse transaction, cancel |
| **Canvas Background** | `#ffffff` / `#f8fafc` | `#f8fafc` | Baseline Active | Main application view background |
| **Surface Card** | `#ffffff` | `#ffffff` | Baseline Active | Table containers, metric cards, modals |
| **Dividers & Borders** | `rgba(0,0,0,0.1)` / `#e2e8f0` | `#e2e8f0` | Baseline Active | Table row borders, input field outlines |

### 3.3 Semantic Financial & Status Badges
| State | Light Mode Style | Dark Mode Style | Usage |
| :--- | :--- | :--- | :--- |
| **Success / Paid / Balanced** | `bg-emerald-50 border-emerald-200 text-emerald-700` | `bg-emerald-950/40 border-emerald-800 text-emerald-300` | Fully paid obligations, balanced daily closing, verified service delivery. |
| **Warning / Partial / Due** | `bg-amber-50 border-amber-200 text-amber-700` | `bg-amber-950/40 border-amber-800 text-amber-300` | Partially allocated receipts, pending payment dues, shift handover pending. |
| **Destructive / Shortage / Reversal** | `bg-rose-50 border-rose-200 text-rose-700` | `bg-rose-950/40 border-rose-800 text-rose-300` | Cashbox shortage, rejected vouchers, compensating reversal records. |
| **Pending Investigation (`UP-705`)** | `bg-purple-50 border-purple-200 text-purple-700` | `bg-purple-950/40 border-purple-800 text-purple-300` | Reconciliation variance awaiting formal management investigation. |
| **Informational / Scheduled** | `bg-sky-50 border-sky-200 text-sky-700` | `bg-sky-950/40 border-sky-800 text-sky-300` | Scheduled future obligations, till identifiers, active branch indicators. |

---

## 4. Monetary Formatting & Currency Standards

Financial figures represent institutional liquidity and legally binding student agreements. Formatting must follow rigorous standards:

### 4.1 Canonical Currency Specification
- **Canonical Currency Code:** `EGP` (ISO 4217, enforced under approved policy `OD-725`).
- **Single Currency Architecture:** Multi-currency pickers and exchange rate calculations are strictly omitted.

### 4.2 Localized Display Standards
- **Arabic Locale Display Format:** `ج.م` placed adjacent to the tabular number:
  - Example: `1,250.00 ج.م` (or Arabic numerals `١,٢٥٠.٠٠ ج.م` where full localization is active).
  - Unambiguous Arabic currency symbol: `ج.م` (جنيه مصري).
- **English Locale Display Format:** `EGP`:
  - Example: `1,250.00 EGP`.
- **Prohibited Currency Symbols:** Rogue informal symbols such as `E£` must not be used to prevent character-encoding and locale inconsistencies.

### 4.3 Number Formatting Rules
1. **Mandatory Two Decimal Places:** Always format exact minor units with 2 decimals (e.g. `1,250.00 ج.م`). Zero-value renders as `0.00 ج.م` / `0.00 EGP`.
2. **Thousand Separators:** Use standard grouping comma `,` for thousands separation: `1,450,200.50 ج.م`.
3. **Negative Balances & Outflows:**
   - Outgoing cash movements: `(500.00 ج.م)` or `-500.00 ج.م` in `text-rose-600 font-mono`.
   - Incoming collections: `+750.00 ج.م` in `text-emerald-600 font-mono`.
4. **Currency Indicator Always Visible:** The currency designation (`ج.م` or `EGP`) must never be omitted from financial summary cards, total rows, or receipts.

---

## 5. Supported Accounting Terminology

To prevent commercial and legal misrepresentation, all interface copy must strictly conform to authorized terminology:

| Approved Term (Arabic) | Approved Term (English) | Prohibited / Rejected Term | Reason |
| :--- | :--- | :--- | :--- |
| **جدول السداد** | Payment Schedule | أقساط (Installments) | Avoids regulated consumer installment credit / interest implications. |
| **مستحق** | Due | دين (Debt) | Represents agreed educational obligation due on schedule. |
| **محصل** | Collected | إيراد فوري (Instant Revenue) | Accrual basis: collection is not earned revenue until lesson delivery. |
| **متبقي** | Remaining | متأخرات ربوية (Penalty Arrears) | Zero finance charges or interest are supported. |
| **إيصال قبض** | Collection Receipt | فاتورة إيراد (Revenue Invoice) | Frontline receipt records receipt of funds, not recognized revenue. |
| **حركة نقدية** | Cash Movement | سحب عشوائي (Casual Withdrawal) | All cashbox operations require formal typed movement categorization. |
| **تسوية يومية** | Daily Reconciliation | إغلاق شكلي (Nominal Close) | Strict physical count verification required by `UP-705`. |
| **قيد تسوية عكسي** | Compensating Reversal | تعديل أو حذف (Edit or Delete) | Enforces append-only immutable financial accounting. |

---

## 6. Component Guidelines & Accessibility

### 6.1 Financial Data Tables
- **Sticky Headers:** Table header remains fixed during vertical scrolling.
- **Header Alignment:** Text columns align `text-start`; monetary numbers align `text-end`.
- **Row Hover & Density:** Compact padding (`py-2.5 px-4`), alternating subtle zebra row backgrounds in light mode, crisp border dividers.
- **Action Column:** Fixed on trailing edge (left edge in RTL, right in LTR) containing standardized icon buttons (View, Print, Audit).
- **Pagination Footer:** Displays total record count, current page range (`عرض 1 إلى 25 من أصل 140 سجل`), and direct page jump.

### 6.2 Forms & Fast-Entry Terminals
- **Label Placement:** Top-aligned labels with required indicator (`*`).
- **Autofocus & Tab Indexing:** The Cashier Collection Terminal (`CSH-DESK-01`) defines logical tab order: Search Input -> Select Obligation -> Enter Cash -> Submit.
- **Keyboard Shortcuts:** Common operational actions bind to standard function keys (e.g., `F9` for Submit & Print Receipt; `Esc` for Clear/Cancel).
- **Inline Validation:** Instant, debounced feedback with friendly Arabic error text. Errors highlight input borders in `border-rose-500` with descriptive error captions.

### 6.3 Skeletons & Empty States
- **Loading State:** Replaces content with animated pulse skeletons matching the exact card/table layout to eliminate visual layout shift (CLS).
- **Empty State:** When no records exist, renders a clean SVG illustration, supportive Arabic title, explanatory subtitle, and optional primary action button.
