# OX-DIGITAL Education — UI/UX Phase 2 (Batch 1)
# Document 1: App Shell Visual & Layout Specification
**Document ID:** `APP_SHELL_VISUAL_SPEC`  
**Status:** REVISED & ALIGNED — READY FOR PRODUCT OWNER REVIEW  
**Date:** 2026-11-03  
**Workspace:** `D:\OX-DIGITAL\Mathe\OX-DIGITAL-GITHUB`  
**Classification:** Visual Architecture & Layout System Specification  

> [!NOTE] Demonstration Data Policy
> All names, emails, institution codes, branch profiles, balances, transaction logs, and operational figures cited in this specification and its accompanying visual prototypes are **SYNTHETIC DEMONSTRATION DATA (DEMO DATA — NOT REAL)**. They illustrate interface structure and spatial density without representing real database records.

---

## 1. Executive Layout System & Geometry

The OX-DIGITAL Education application shell serves as the unified host environment for all multi-branch operational screens. It provides consistent spatial grounding, institutional tenant context, fast role-specific navigation, and uninterrupted workflow execution.

### 1.1 Structural Layout Grid (Desktop 1440px+)

```text
+-----------------------------------------------------------------------------------------------------------------------+
| TOPBAR (Height: 64px, Sticky top-0, z-index: 40, border-b border-[var(--border)])                                    |
| [Institution Logo & Name] | [Branch Selector Pill] | [Search Ctrl/⌘+K] | (Future Notifications) | (Theme) | [User Menu] |
+-----------------------------------------------------------------------------------------------------------------------+
| SIDEBAR                 | MAIN CANVAS (Flex-1, min-h-[calc(100vh-64px)], overflow-y-auto, bg-[var(--background)])     |
| (Width: 260px expanded  |---------------------------------------------------------------------------------------------|
|  or 72px collapsed rail | BREADCRUMBS ZONE (Height: 40px, flex items-center, text-caption)                             |
|  Sticky start-0         | الرئيسية  >  الخزائن والنقدية  >  مطابقة وإقفال النقدية اليومية                               |
|  z-index: 30)           |---------------------------------------------------------------------------------------------|
|                         | PAGE HEADER & CONTEXTUAL ACTION BAR (Padding-y: 20px, flex items-center justify-between)    |
| - Role Identity Badge   | Title: مطابقة وإقفال النقدية اليومية (CB-RECON-01)          [إجراء ثانوي]  [إجراء رئيسي جديد] |
| - Nav Section 1         | Subtitle: خزينة الاستقبال 1 • كود: CB-01 • الوردية: مفتوحة • DEMO DATA                       |
| - Nav Section 2         |---------------------------------------------------------------------------------------------|
| - Nav Section 3         | MAIN CONTENT VIEWPORT CONTAINER                                                             |
|                         | Padding: 24px (p-6) Desktop / 16px (p-4) Tablet                                              |
| - Collapse Toggle       | (Individual operational screen views, financial grids, and data cards inject here)           |
| - Design Status Only    | [حالة الاتصال غير معروضة في النموذج]                                                        |
+-----------------------------------------------------------------------------------------------------------------------+
```

### 1.2 Layout Dimensions & Geometry Tokens
| Token | Pixel Dimension | Tailwind Utility | CSS Variable / Behavior |
| :--- | :--- | :--- | :--- |
| **TopBar Height** | `64px` | `h-16` | Fixed height across all viewports; contains institutional context. |
| **Sidebar Width (Expanded)** | `260px` | `w-[260px]` | Default on Desktop (1280px+); comfortably fits Arabic navigation titles. |
| **Sidebar Width (Collapsed Rail)** | `72px` | `w-[72px]` | Optional compact mode on Desktop; default on Tablet Landscape (1024px). |
| **Main Content Max-Width** | `1600px` | `max-w-[1600px]` | Centered container to prevent excessive data row stretching on ultra-wide screens. |
| **Dense Table Canvas** | `100% fluid` | `w-full max-w-none` | Full bleed for wide financial sub-ledgers and journals with horizontal scroll protection. |
| **Viewport Padding (Desktop)**| `24px` | `p-6` | Generous gutter spacing adhering to 8px spatial grid. |
| **Viewport Padding (Tablet)** | `16px` | `p-4` | Space-efficient padding preserving maximum table width. |

---

## 2. Top Navigation Bar (TopBar) Components

The TopBar provides persistent institutional identity, branch context switching, system-level tools, and user profile management.

### 2.1 Component Breakdown (RTL Flow: Right-to-Left)

```text
[RTL Start: Right Edge]                                                                                                [RTL End: Left Edge]
+-----------------------------------------------------------------------------------------------------------------------------------------+
| [Toggle Rail] [Inst Logo] [Academy Name (INST-01)] | [Branch Selector Pill v] | [Search Ctrl/⌘+K] ... [Bell] [Theme] [User Avatar v]    |
+-----------------------------------------------------------------------------------------------------------------------------------------+
```

1. **Sidebar Collapse / Expand Toggle:**
   - Dedicated icon button (`PanelRightOpen` / `PanelRightClose` flipping dynamically based on direction).
   - Allows users to maximize horizontal workspace for dense accounting tables.
2. **Institution Identity Zone:**
   - Reuses existing repository asset `apps/frontend/public/logo.jpeg` rendered in a crisp 36x36px rounded container (`rounded-lg border border-[var(--border)]`).
   - Displays tenant name: e.g. **أكاديمية أوكس الرقمية** (`font-semibold text-sm`).
   - Displays tenant code badge: `INST-01 [DEMO]` (`text-caption bg-[var(--muted)] text-[var(--muted-foreground)] px-1.5 py-0.5 rounded`).
   - Strict Isolation: Super-admin platform controls (`admin@edu.com`) are strictly excluded from this shell.
3. **Interactive Branch Selector Pill:**
   - Positioned prominently in the top bar to maintain persistent branch awareness.
   - Renders current branch scope:
     - For `PRIMARY_MANAGER`: Shows active selection (e.g. `🏛️ فرع القاهرة الرئيسي` or `🌐 جميع الفروع (إجمالي المؤسسة)`). Clicking opens a search-enabled branch selection popover containing the 3 active demo branches (`BR-01`, `BR-02`, `BR-ON`).
     - For `ACCOUNTANT` / `TEACHER`: Shows assigned branch (e.g. `🏛️ فرع القاهرة`). If the user is assigned to a single branch, the pill is **locked read-only** with a subtle lock icon (`Lock` 12px), preventing unauthorized cross-branch switching.
4. **Global Command & Search Bar (`Ctrl / ⌘ + K`):**
   - Cross-platform quick-access search input: `بحث عن طالب أو إيصال أو شاشة... [Ctrl / ⌘ + K]`.
5. **Notifications Entry Point (Future Placeholder):**
   - Renders standard bell icon (`Bell` 20px) with subtle empty state indicator.
   - **Architectural Boundary Note:** Since no live push-notification microservice exists in the current backend architecture, clicking this icon reveals a clean placeholder drawer:
     *Title:* `الإشعارات والتنبيهات`
     *Subtitle:* `لا توجد تنبيهات جديدة في الوقت الحالي. ميزة الإشعارات الحية قيد الربط البرمجي.`
   - No mock unbacked notification counts are displayed.
6. **Theme & Locale Switchers:**
   - Dark/Light mode toggle (`Sun` / `Moon`).
   - Locale switcher pill: `العربية` (default) with smooth toggle to `English`.
7. **User Profile & Session Menu:**
   - Displays avatar image or user initials in primary brand circular frame.
   - Shows user display name (e.g. `أ. نادية حسن`) and role badge chip (`محاسب`).
   - Clicking opens the User Profile Dropdown (detailed in Section 4).

---

## 3. Sidebar Navigation Architecture

The sidebar navigation provides role-tailored operational pathways. It enforces strict Maker-Checker segregation of duties and role permissions.

### 3.1 Visual Anatomy of Sidebar

```text
+------------------------------------------+
| USER CONTEXT BANNER                      |
| [Avatar 44px] نادية حسن                  |
| دور النظام: محاسب معتمد (ACCOUNTANT)     |
| الفرع المرتبط: فرع القاهرة               |
+------------------------------------------+
| SECTION: الإدارة المالية اليومية          |
| [Icon] لوحة المؤشرات المالية             |
| [Icon] نقطة التحصيل (إيصالات القبض)       |
| [Icon] الأستاذ المساعد للطلاب            |
| [Icon] تخصيص المقبوضات                   |
+------------------------------------------+
| SECTION: الخزائن والعمليات النقدية       |
| [Icon] سجل الخزائن النقدية               |
| [Icon] التحويلات بين الخزائن             |
| [Icon] مطابقة وإقفال اليومية (CB-RECON)  |
| [Icon] سندات المصروفات التشغيلية         |
+------------------------------------------+
| SECTION: القيود والتقارير المحاسبية      |
| [Icon] شجرة الحسابات ودفتر القيود        |
| [Icon] تقرير الإيراد المستحق الفعلي      |
+------------------------------------------+
| FOOTER UTILITIES                         |
| [Icon] المساعدة والدعم الفني             |
| [Icon] تسجيل الخروج الآمن                |
+------------------------------------------+
```

### 3.2 Visual States of Navigation Items
- **Default Inactive Item:**
  - `text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--accent)] rounded-lg px-3 py-2.5 transition-all text-sm font-medium flex items-center gap-3`.
  - Icon size: 18x18px, stroke width 1.75px.
- **Active Navigation Item:**
  - `bg-[var(--primary)]/10 text-[var(--primary)] font-semibold rounded-lg px-3 py-2.5 flex items-center gap-3 relative`.
  - In RTL: A vertical primary brand indicator pill (3px wide, 20px high, `rounded-full bg-[var(--primary)]`) anchors the inner edge (`end-0` or `start-0`).
  - Active icon inherits `text-[var(--primary)]` with stroke width 2px.
- **Hover & Focus Ring:**
  - Keyboard accessible with clean focus visible ring: `focus-visible:ring-2 focus-visible:ring-[var(--ring)] outline-none`.
- **Badge Indicators:**
  - For items requiring review (e.g. `PM-APPR-01` Approvals), renders an amber pill (`bg-amber-100 text-amber-800 text-xs px-2 py-0.5 rounded-full font-bold`).

---

## 4. Dropdowns, Menus & Overlay Specifications

### 4.1 Branch Selector Dropdown Popover (`BR-SELECT-01`)
- **Trigger:** TopBar Branch Selector Pill (`bg-[var(--card)] border border-[var(--border)] px-3 py-1.5 rounded-lg shadow-sm hover:border-[var(--primary)]/50`).
- **Popover Dimensions:** Width 320px, max-height 380px, `rounded-xl border border-[var(--border)] shadow-lg bg-[var(--card)] p-2 z-50`.
- **Internal Structure:**
  1. *Quick Search Input:* Filter branches by name or city code (`ms-input text-xs`).
  2. *Consolidated Option (Primary Manager Only):*
     - `🌐 جميع الفروع (المقر الرئيسي والأفرع) - رؤية مجمعة`
  3. *Physical Branch List:*
     - `🏛️ فرع القاهرة الرئيسي (كود: BR-01 • المعادي)` — Status: `نشط`
     - `🏛️ فرع الإسكندرية الأكاديمي (كود: BR-02 • سموحة)` — Status: `نشط`
  4. *Online Branch:*
     - `💻 الفرع الرقمي / التعلم الإلكتروني (كود: BR-ON)` — Status: `نشط`
- **Selection Persistence:** Selecting a branch writes to application state and updates all downstream screen contexts immediately without full page reload.

### 4.2 User Profile Menu Popover (`USER-MENU-01`)
- **Trigger:** TopBar user avatar with down-chevron.
- **Popover Dimensions:** Width 260px, `rounded-xl border border-[var(--border)] shadow-xl bg-[var(--card)] p-2 z-50`.
- **Menu Items:**
  1. *User Info Header:* Full name, email (`nadia.hassan@ox-edu.eg`), role tag (`محاسب معتمد`).
  2. *Divider (`border-t border-[var(--border)] my-1`)*.
  3. *Profile Settings (`الملف الشخصي وإعدادات الحساب`)*.
  4. *Security & Password (`الأمان وكلمة المرور`)*.
  5. *Keyboard Shortcuts Modal (`اختصارات لوحة المفاتيح Ctrl / ⌘ + /`)*.
  6. *Divider*.
  7. *Secure Logout (`تسجيل الخروج الآمن`):* Highlighted in `text-rose-600 hover:bg-rose-50 rounded-lg px-2.5 py-2 text-sm flex items-center gap-2`. Clears auth token and redirects to `/login`.

---

## 5. Breadcrumb & Page Context Hierarchy

The breadcrumb path guarantees that operators always know their exact operational depth.

### 5.1 Breadcrumb Formatting Rules
- **Container:** Sticky or top-aligned bar with `h-10 px-6 flex items-center gap-2 text-xs text-[var(--muted-foreground)]`.
- **Directional Delimiter:** Chevron icon (`ChevronLeft` in RTL, `ChevronRight` in LTR) with automatic 180° flip.
- **Root Element:** Home / Dashboard icon + label: `الرئيسية`.
- **Terminal Element:** Current screen title: `font-semibold text-[var(--foreground)]` (non-clickable).
- **Truncation Behavior:** On tablet viewports, if the path exceeds 3 levels, intermediate segments collapse into an ellipsis dropdown (`...`).

---

## 6. Page Title & Contextual Action Bar

The Page Title Bar bridges global navigation with individual screen operations.

### 6.1 Layout & Action Slots
```text
+---------------------------------------------------------------------------------------------------------+
| [Page Title & Icon]                                                  [Secondary Actions] [Primary Action]|
| <h1> الأستاذ المساعد للطلاب (STU-FIN-01) </h1>                       [تصدير كشف حساب]  [+ إضافة اتفاقية] |
| <p> عرض السجلات المالية وجداول السداد وتخصيص إيصالات القبض • DEMO DATA </p>                             |
+---------------------------------------------------------------------------------------------------------+
```
- **Heading 1:** `text-xl font-bold text-[var(--foreground)] tracking-tight`.
- **Context Subtitle:** `text-xs text-[var(--muted-foreground)] mt-0.5`.
- **Status Pills Slot:** Contextual badges (e.g. `خزينة مغلقة`, `دفعة متأخرة`).
- **Action Buttons Slot:** Standardized button hierarchy:
  - *Primary Action:* `bg-[var(--primary)] text-[var(--primary-foreground)] hover:opacity-95 font-medium px-4 py-2 rounded-lg text-sm shadow-sm flex items-center gap-2`.
  - *Secondary Action:* `border border-[var(--border)] bg-[var(--card)] hover:bg-[var(--accent)] text-[var(--foreground)] px-3 py-2 rounded-lg text-sm flex items-center gap-2`.

---

## 7. Global Status, Banner & Feedback Patterns

### 7.1 System Warning Banners
When institutional invariants require attention (e.g. cashbox closing variance pending investigation under `UP-705`):
- **Full-Width Top Alert Banner:** Rendered directly below the TopBar with `bg-amber-500/10 border-b border-amber-500/20 text-amber-700 px-6 py-2.5 text-xs flex items-center justify-between`.
- Displays incident ID, branch context, and direct link to resolution workspace (`CB-DISC-01`), explicitly tagged as `DEMO DATA — NOT REAL`.
- Does not imply an approved shortage write-off or surplus-income recognition policy.

### 7.2 Toast Notifications (Sonner Standard)
- Toast notifications appear in the bottom-start corner (`bottom-6 end-6` in RTL = bottom-left of screen).
- Max width 360px, crisp elevation, dark/light aware.
- Semantic icons: Checkmark for success, AlertTriangle for warnings, OctagonAlert for errors.

---

## 8. External Dependencies & Offline Disclaimer

> [!WARNING] External Dependencies in Design Prototype
> The visual demonstration prototype (`visual-mockup.html`) utilizes external CDN dependencies for demonstration rendering:
> - **Tailwind CSS runtime:** `https://www.gstatic.com/antigravity/web/dev/tailwindcss.min.js`
> - **Typography fonts:** `Google Fonts (Cairo & JetBrains Mono)`
> The prototype is intended for design inspection and browser evaluation; it is **NOT fully offline or completely self-contained**. No production npm dependencies were installed.

