# OX-DIGITAL Education — UI/UX Phase 2 (Batch 1)
# Document 3: Responsive Layout & Adaptive Viewport Specification
**Document ID:** `RESPONSIVE_LAYOUT_SPEC`  
**Status:** REVISED & ALIGNED — READY FOR PRODUCT OWNER REVIEW  
**Date:** 2026-11-03  
**Workspace:** `D:\OX-DIGITAL\Mathe\OX-DIGITAL-GITHUB`  
**Classification:** Responsive Grid, Breakpoint & Interaction Specification  

> [!NOTE] Demonstration Data Policy
> All viewport illustrations, campus branch codes, and metric counts shown herein are **SYNTHETIC DEMONSTRATION DATA (DEMO DATA — NOT REAL)**.

---

## 1. Viewport Matrix & Breakpoint System

The OX-DIGITAL Education application shell adapts seamlessly across physical educational center workstations—from widescreen desktop monitors at director desks to compact tablet touchscreens at reception counters.

### 1.1 Standard Breakpoints
| Viewport Profile | Width Range | Primary Target Hardware | Layout Architecture |
| :--- | :--- | :--- | :--- |
| **Desktop Ultra / Widescreen** | `1440px` and above | 24"-27" Desktop monitors (Executive / Accounting) | Full 260px Sidebar, 1600px centered canvas, full multi-column data grids. |
| **Desktop Standard / Laptop** | `1280px` – `1439px` | 13"-15" Laptops, standard office PCs | Full 260px Sidebar, fluid canvas with `p-6` gutter. |
| **Tablet Landscape** | `1024px` – `1279px` | 11"-13" iPad Pro / Android Tablets (Landscape) | Collapsed 72px Icon Rail by default, compact TopBar, condensed table columns. |
| **Tablet Portrait** | `768px` – `1023px` | Standard iPad / Tablet counter terminals | Off-canvas Drawer Sidebar (overlay with backdrop blur), TopBar hamburger trigger. |
| **Mobile Device** | Below `768px` | Smartphone inspection / emergency check | Off-canvas Drawer, single-column stacked view, bottom-floating action bar. |

---

## 2. Sidebar Behavioral States

The navigation sidebar transitions smoothly between three responsive operating modes:

```text
+-------------------------+    +------------------+    +------------------------------+
| 1. EXPANDED (260px)     |    | 2. RAIL (72px)   |    | 3. OFF-CANVAS DRAWER         |
| Desktop 1280px+         |    | Tablet Landscape |    | Tablet Portrait & Mobile     |
|                         |    |                  |    |                              |
| [Logo] أكاديمية أوكس    |    | [Logo 36px]      |    | [X] إغلاق القائمة            |
| ─────────────────────── |    | ──────────────── |    | ──────────────────────────── |
| [Icon] لوحة القيادة     |    | [Icon 20px] (Tip)|    | [Icon] لوحة القيادة          |
| [Icon] الخزائن والنقدية |    | [Icon 20px] (Tip)|    | [Icon] الخزائن والنقدية      |
| [Icon] الأستاذ المساعد  |    | [Icon 20px] (Tip)|    | [Icon] الأستاذ المساعد       |
| [Icon] إقفال اليومية    |    | [Icon 20px] (Tip)|    | [Icon] إقفال اليومية         |
| ─────────────────────── |    | ──────────────── |    | ──────────────────────────── |
| [<] تصغير القائمة       |    | [>] توسيع القائمة|    | [Backdrop Overlay: 50% Black]|
+-------------------------+    +------------------+    +------------------------------+
```

### 2.1 State 1: Expanded Sidebar (260px Width)
- **Active Range:** Desktop viewports (`>= 1280px`).
- **Features:** Displays full section headers, descriptive item labels in Arabic Cairo font, status badge pills, and nested item chevrons.
- **Toggle Action:** Clicking the footer collapse button transitions the rail to 72px width via a 200ms cubic-bezier transition (`transition-[width] duration-200 ease-in-out`). State persists in client storage (`localStorage.setItem('ox_sidebar', 'collapsed')`).

### 2.2 State 2: Collapsed Icon Rail (72px Width)
- **Active Range:** Default on Tablet Landscape (`1024px` – `1279px`); optional user toggle on Desktop.
- **Features:** Labels and badges are visually hidden. Navigation icons are centered with 40x40px touch targets (`rounded-lg flex items-center justify-center`).
- **Hover Micro-Experience:** Hovering over an icon reveals a high-contrast floating Tooltip on the outer edge (`placement="left"` in RTL):
  - Displays title (e.g. `الأستاذ المساعد للطلاب`).
  - Displays shortcut (e.g. `STU-FIN-01`).
  - Displays pending badge if applicable (e.g. `3 معلق`).

### 2.3 State 3: Off-Canvas Drawer (Overlay)
- **Active Range:** Tablet Portrait and Mobile (`< 1024px`).
- **Features:** Sidebar slides in from the right edge in RTL (left edge in LTR) with a 50% opacity backdrop blur overlay (`bg-slate-900/50 backdrop-blur-sm`).
- **Dismissal:** Tapping outside the drawer, clicking the close icon (`X`), or selecting a navigation route immediately closes the drawer.

---

## 3. TopBar Adaptive Reflow & Component Collapse

On narrower viewports, TopBar elements reflow gracefully to prioritize branch context and user actions:

```text
DESKTOP (1440px+):
[Toggle] [Logo + Academy Name (INST-01)]  |  [Branch: Cairo Main v]  |  [Search Input 280px Ctrl/⌘+K]  |  (Future Notif) (Theme) [Avatar + Name]

TABLET LANDSCAPE (1024px):
[Toggle] [Logo] [Academy Name]  |  [Branch: Cairo v]  |  [Search Icon Ctrl/⌘+K]  |  (Theme) [Avatar]

TABLET PORTRAIT (768px):
[Hamburger] [Logo]  |  [Branch: CAI (BR-01) v]  |  [Search Icon]  |  [Avatar]
```

### 3.1 TopBar Reflow Rules
1. **Search Input Bar:**
   - On Desktop: Full expanded search input field (`w-64` to `w-72`).
   - On Tablet (`< 1280px`): Collapses into a cross-platform icon button (`Search` 20px). Tapping triggers the global Command Palette modal dialog (`Ctrl / ⌘ + K`).
2. **Branch Selector Pill:**
   - On Desktop: Displays full text: `🏛️ فرع القاهرة الرئيسي (المعادي) v`.
   - On Tablet Portrait: Truncates to compact code badge: `🏛️ القاهرة (BR-01) v`.
   - Popover dropdown remains fully functional with touch-friendly 44px list items.
3. **User Profile Capsule:**
   - On Desktop: Avatar (36px) + Name + Role Badge + Down chevron.
   - On Tablet Portrait: Avatar icon only with subtle status dot ring. Tapping opens the full user profile bottom-drawer or popover.

---

## 4. Breadcrumb Responsive Truncation

To prevent breadcrumb trails from wrapping or pushing page headers off-screen on tablets:

### 4.1 Path Truncation Hierarchy
- **Rule 1 (1-2 segments):** Never truncated (e.g. `الرئيسية > الخزائن`).
- **Rule 2 (3 segments on desktop):** Fully rendered (e.g. `الرئيسية > الخزائن > مطابقة وإقفال اليومية`).
- **Rule 3 (4+ segments or tablet portrait):** Middle segments collapse into an interactive ellipsis pill (`...`):
  - Display: `الرئيسية  >  [...]  >  مطابقة وإقفال اليومية`
  - Clicking `[...]` reveals a compact dropdown showing intermediate links (`الخزائن والنقدية`, `فرع القاهرة`).

---

## 5. Main Content Container & Dense Table Protection

Educational center operations depend heavily on dense multi-row accounting tables (sub-ledgers, daily reconciliations, cashbook registers).

### 5.1 Horizontal Scroll Containment
- **Table Container Wrapper:** All tables are encapsulated within a scroll-isolated container:
  ```html
  <div class="w-full overflow-x-auto rounded-xl border border-[var(--border)] shadow-sm bg-[var(--card)]">
    <table class="w-full text-start border-collapse min-w-[760px]">
      ...
    </table>
  </div>
  ```
- **Sticky Trailing Action Column:** On horizontal scroll, the action column (`إجراءات`) remains pinned to the trailing edge (left edge in RTL, right edge in LTR) with a subtle drop shadow to maintain one-click access to View/Print buttons.
- **Scroll Shadows:** Visual gradient shadows appear on inner table edges to indicate available horizontal content to touch/scroll operators.

---

## 6. Touch Targets & Accessibility Conformance

- **Minimum Touch Target:** All interactive controls (buttons, navigation rows, dropdown items, checkboxes) provide a minimum hit area of **44x44px** on touch-enabled tablet devices.
- **Contrast Ratios:** Text-to-background contrast adheres strictly to **WCAG 2.1 AA** (minimum 4.5:1 for normal text, 3:1 for large headers).
- **Tab Focus Rings:** All controls maintain visible focus rings (`ring-2 ring-[var(--ring)] ring-offset-2`) for keyboard and barcode-scanner tab navigation.

---

## 7. Prototype Verification & Known Technical Limitations

### 7.1 Verified Prototype Behaviors
The companion visual prototype (`visual-mockup.html`) accurately demonstrates:
1. **Desktop Widescreen (1440px+):** Full 260px expanded sidebar, full topbar search input with `Ctrl/⌘+K`, and 4-column KPI cards.
2. **Laptop (1280px):** Full layout with manual toggle between 260px expanded and 72px collapsed rail.
3. **Tablet Landscape (1024px):** Automatic collapse to 72px icon-only rail with outer-edge tooltips, compact topbar.
4. **Tablet Portrait (768px):** Off-canvas drawer with dimming backdrop overlay (`bg-slate-950/60 backdrop-blur-xs`), hamburger button trigger, and dismiss-on-backdrop click.

### 7.2 Technical Limitations of the Design Prototype
- **External CDN Dependency:** The prototype uses Tailwind CSS via Google gstatic CDN and web fonts via Google Fonts. It is **not fully offline**.
- **Touch Gesture Emulation:** Swipe-to-dismiss gestures for mobile drawers are not implemented in pure HTML/CSS; drawer dismissal relies on standard tap/click handlers.
- **Pure Design Mockup:** All interactions run strictly client-side in memory with zero backend API or database connectivity.

