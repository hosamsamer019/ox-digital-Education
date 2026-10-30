# Homepage Implementation Plan: OX-DIGITAL Education

**Document Version:** 1.0.0  
**Phase:** Specification & Pre-Implementation Planning  
**Execution Scope:** Public Homepage Experience (`/`)  
**Target Delivery:** High-craft, institutional-grade educational web experience  

---

## 1. Technical Stack Analysis & Dependencies

### Already Installed & Ready to Use
| Package | Version | Purpose in Redesign |
|---------|---------|---------------------|
| `motion` | `12.23.24` | Kinematics, layout transitions, spring micro-interactions |
| `lucide-react` | `0.487.0` | Disciplined 1.75px dual-tone educational iconography |
| `katex` & `react-katex` | `^0.18.4` / `^3.1.0` | Authentic mathematical typesetting for interactive problem solving |
| `@radix-ui/react-accordion` | `1.2.3` | Accessible, robust FAQ accordion primitives |
| `@radix-ui/react-dialog` | `1.1.6` | Accessible mobile navigation slide-over drawer |
| `embla-carousel-react` | `8.6.0` | Curriculum & pedagogical showcase slider on mobile/tablet |
| `clsx` & `tailwind-merge` | `2.1.1` / `3.2.0` | Class composition utilities |
| `@tailwindcss/vite` & `tailwindcss` | `4.1.12` | CSS-first Tailwind engine (theme tokens, inline variants) |
| `canvas-confetti` | `1.9.4` | Subtle micro-reward upon completing a sample math problem step |

### Dependencies to Consider for Installation
1. **`gsap` (`^3.12.7`) & `@gsap/react` (`^2.1.2`):**
   - *Status:* Optional / Recommended for timeline-based hero choreography and ScrollTrigger pinned syllabus sections.
   - *Alternative:* Native `motion` (v12) is already installed and can handle standard scroll and entrance kinematics.
   - *Decision Point for User:* We can implement all core interactions cleanly using the installed `motion` v12 library, or install `gsap` if advanced ScrollTrigger pinning is strictly desired. We recommend using `motion` first to avoid adding package weight unless complex scrubbed timelines are required.

---

## 2. Component Architecture & Files to Modify

All changes are strictly isolated to the public frontend experience. No backend APIs, database connections, authentication rules, or dashboard routes will be altered.

```
apps/frontend/
├── index.html                                        <-- Theme color & meta polish
├── src/
│   ├── app/
│   │   ├── components/
│   │   │   ├── landing/
│   │   │   │   ├── LandingPage.tsx                  <-- Main assembly & layout shell
│   │   │   │   ├── components/
│   │   │   │   │   ├── LandingNavbar.tsx            <-- Responsive header + mobile drawer
│   │   │   │   │   ├── LandingHero.tsx              <-- Asymmetric hero + Live Exam Console
│   │   │   │   │   ├── QuickExamTerminal.tsx        <-- Direct code entry (/external-exam)
│   │   │   │   │   ├── TriRoleEcosystem.tsx         <-- Student, Teacher, Parent pillars
│   │   │   │   │   ├── InteractiveMathSolver.tsx    <-- Real KaTeX step-by-step showcase
│   │   │   │   │   ├── CurriculumNavigator.tsx      <-- Secondary & Prep stage modules
│   │   │   │   │   ├── InstitutionalSecurity.tsx    <-- Anti-cheat & video tracking proof
│   │   │   │   │   ├── CuratedFaq.tsx               <-- Accessible split FAQ + support
│   │   │   │   │   └── LandingFooter.tsx            <-- Academic institutional footer
│   │   │   │   └── ui/
│   │   │   │       ├── MathGridBackground.tsx       <-- Subtle geometric grid (adapted React Bits)
│   │   │   │       └── StepReveal.tsx               <-- Pedagogical problem reveal kinematics
│   │   │   └── ui/
│   │   │       └── SplashScreen.tsx                 <-- Fix dual <h1> SEO tag conflict
│   │   └── styles/
│   │       └── theme.css                            <-- Color variables & architectural borders
```

---

## 3. Section-by-Section Proposed Information Architecture

### Section 1: Institutional Header & Responsive Navigation (`LandingNavbar`)
- **Brand Identity:** High-resolution OX-DIGITAL insignia with crisp typography.
- **Desktop Navigation:** Five high-intent anchor links (`#ecosystem`, `#math-engine`, `#curriculum`, `#security`, `#faq`).
- **Action Group:**
  - "دخول امتحان بكود" (Quick Exam Button with branded highlight and direct navigation to `/external-exam`).
  - "تسجيل الدخول" (Primary Crimson Button navigating to `/login`).
  - "بوابة المعلم" (Subtle outline action navigating to `/admin/login`).
- **Mobile/Tablet Drawer:** Accessible slide-over sheet triggered by hamburger icon, providing direct access to all sections and authentication gateways.

### Section 2: Asymmetric Editorial Hero & Live Exam Terminal (`LandingHero` + `QuickExamTerminal`)
- **Right Column (RTL Editorial):**
  - Institutional status tag: `المنصة الأكاديمية الرائدة لتعليم الرياضيات والتقييم الذكي`.
  - Display Title: Solid, crisp ivory typography:
    ```
    التعليم الرياضي بمعايير أكاديمية
    وتقنيات تقييم ذكية لا تقبل المساومة.
    ```
  - Subtitle: Clear value statement highlighting student progress, teacher authority, and instant examination verification.
  - CTAs: "ابدأ كطالب" (`/login`) + "دخول المعلمين والمراكز" (`/admin/login`).
- **Left Column (Live Exam Terminal):**
  - A real, interactive card allowing students to test or enter their live exam code directly (`/external-exam/:code`).
  - Real-time features showcase:
    - `نظام اختبارات آمن ومقاوم للغش`
    - `تصحيح تلقائي فوري للمسائل والخطوات`
    - `متابعة مستمرة لزمن المشاهدة والاستيعاب`

### Section 3: The Tri-Role Pedagogical Ecosystem (`TriRoleEcosystem`)
- Replaces the 6 generic rainbow cards with 3 tailored institutional pillars:
  1. **الطالب (The Student):** HD lesson player with second-by-second progress tracking, interactive step explanations, instant feedback question bank.
  2. **المعلم والمركز (The Teacher & Academy):** Automated exam generator from centralized question bank, student attendance verification, detailed comprehension analytics.
  3. **ولي الأمر (The Parent):** Instant grade notifications, attendance reports, academic alerts before exam milestones.

### Section 4: The Live Mathematical Reasoning Engine (`InteractiveMathSolver`)
- Real KaTeX-rendered mathematical equation demonstration (e.g., differential calculus or quadratic factorization).
- Visitors can click `عرض خطوات الحل` (Show Solution Steps):
  - Step 1: Definition of variables & domain.
  - Step 2: Algorithmic transformation with mathematical annotations.
  - Step 3: Final verified solution with graphical confirmation.
- Eliminates fake chatbot bubbles with emojis and proves genuine pedagogical software depth.

### Section 5: Curriculum & Academic Stage Navigator (`CurriculumNavigator`)
- Interactive stage switcher:
  - **الصف الأول الثانوي** (جبر، حساب مثلثات، هندسة تحليلية)
  - **الصف الثاني الثانوي** (تفاضل وتكامل، استاتيكا، جبر متقدم)
  - **الصف الثالث الثانوي** (رياضيات بحتة، رياضيات تطبيقية، إحصاء)
- Detailed module cards showing lesson structure, exam blueprints, and problem counts.

### Section 6: Institutional Trust, Security & Anti-Cheat Architecture (`InstitutionalSecurity`)
- Focuses on real system capabilities:
  - **مراقبة وحماية الامتحانات:** Real-time IP and browser integrity verification.
  - **تتبع مشاهدة الفيديو بدقة الثانية:** Prevention of skipped lessons to ensure complete mastery.
  - **بنك أسئلة ذكي ومتدرج:** Randomized variable generation preventing question sharing.
  - **حماية المحتوى التعليمي:** Watermarked video streaming and end-to-end token encryption.

### Section 7: Curated FAQ & Support Desk (`CuratedFaq`)
- Dual-column layout:
  - Left column: Direct assistance, teacher onboarding contacts, and WhatsApp support card.
  - Right column: 6 refined, high-legibility FAQ items with accessible Radix UI mechanics and smooth spring expansion.

### Section 8: Authoritative Institutional CTA & Academic Footer (`LandingFooter`)
- Deep obsidian canvas with architectural hairline border.
- Official copyright statement: `© منصة أو إكس الرقمية التعليمية (OX-DIGITAL Education) — جميع الحقوق محفوظة`.
- System status indicator: `أنظمة مشفرة وآمنة بنسبة 100%`.

---

## 4. React Bits & Animation Integration Strategy

### React Bits Component Adaptation:
Any imported React Bits pattern must undergo strict stylistic normalization:
1. **Mathematical Grid Backdrop (`MathGridBackground`):**
   - Derived from React Bits Animated Grid, but stripped of neon glows.
   - Rendered with `0.04` opacity slate hairlines with subtle coordinate axes, evoking graphing paper and coordinate geometry.
2. **Text Reveal (`StepReveal`):**
   - Used only for the mathematical step solver to animate line-by-line equation derivations.
   - Physics: `stiffness: 300, damping: 28` using `motion/react`.

### Motion Kinematics & Transition Rules:
- **Duration Cap:** No entrance transition may exceed `0.5s`.
- **Easing Curve:** `cubic-bezier(0.16, 1, 0.3, 1)` (easeOutQuart) for crisp, responsive physical feel.
- **ScrollTrigger / inView Thresholds:** `amount: 0.15` and `once: true`. Elements MUST NOT disappear or flicker when users scroll up and down.
- **Full `prefers-reduced-motion` compliance:** Disables all translations and relies solely on instantaneous opacity.

---

## 5. Responsive Behavior Matrix

| Feature | Desktop (1440px+) | Tablet (768px - 1024px) | Mobile (375px - 640px) |
|---------|-------------------|-------------------------|------------------------|
| **Navigation** | Full horizontal links + 2 action buttons | Compact links + exam code button | Logo + direct exam code + slide-over drawer |
| **Hero Layout** | 60/40 Asymmetric split | 50/50 Split or stacked with clear margins | Single column: Headline → Quick Exam Input → Primary CTAs |
| **Exam Terminal** | Embedded interactive console | Full-width embedded card | Streamlined single-field input with instant submit |
| **Ecosystem Cards** | 3-column architectural grid | 2+1 layout with prominent teacher card | Swipeable Embla carousel or vertical progressive cards |
| **Math Solver** | Split equation & explanation layout | Stacked step-by-step layout | Full-width step cards with horizontal scroll for wide formulas |
| **Curriculum Tabs** | Horizontal architectural pill tabs | Horizontal scrollable tab list | Segmented control with clear active indicators |
| **Footer** | 4-column organized sitemap | 2-column sitemap | Single-column grouped accordion with copyright badge |

---

## 6. Accessibility & SEO Compliance Plan

1. **Heading Structure Remediation:**
   - Modify `SplashScreen.tsx` to use `<div role="status" aria-label="شاشة التحميل">` so that the homepage contains **strictly one `<h1>` element**.
   - Ensure strict heading descent: `H1` (Hero Display) → `H2` (Major Sections) → `H3` (Component Cards) → `H4` (Metadata Labels).
2. **Color Contrast Verification:**
   - All text combinations must meet **WCAG 2.2 AA standards (minimum 4.5:1 for body, 3:1 for display titles)**.
   - Ivory text (`#f9fafb`) on Obsidian Slate (`#0c0f17`) achieves `16.2:1` (WCAG AAA).
   - Brand Crimson (`#9e1b1b`) on white surfaces achieves `7.4:1` (WCAG AAA).
3. **Keyboard & Screen Reader Navigability:**
   - Add accessible "انتقل إلى المحتوى الرئيسي" (Skip to Content) hidden link at the very top of `LandingPage.tsx`.
   - Ensure all interactive inputs have linked `<label>` tags with descriptive ARIA descriptions.
   - Full keyboard focus rings with `focus-visible:ring-2 focus-visible:ring-crimson-600 focus-visible:ring-offset-2`.
4. **Metadata & Canonical Tag Alignment:**
   - Update `index.html` theme-color from `#2563eb` to `#9e1b1b`.
   - Update Open Graph descriptions and schema to match the upgraded institutional copy.

---

## 7. Performance & Engineering Safeguards

1. **Zero Layout Shifts (CLS < 0.05):**
   - Reserve explicit aspect ratio and dimensions for the logo (`w-10 h-10` / `40x40px`).
   - Use CSS `min-height` on dynamic equation step containers to prevent container jumping during reveals.
2. **Asset Optimization:**
   - Clean SVG icons via Lucide React (tree-shakeable imports).
   - KaTeX rendering handled synchronously with lightweight math strings to prevent rendering flashes.
3. **Bundle Size Discipline:**
   - Modular subcomponents ensure clean code organization without monolithic files.
   - Avoid installing redundant third-party libraries; leverage existing `motion/react`, `@radix-ui`, and Tailwind v4.

---

## 8. Visual QA Checklist

Before concluding any future implementation phase, every item on this checklist must be verified:

- [ ] **No AI Slop Patterns:** Confirm absence of all 12 banned slop patterns (no floating blobs, no rainbow squircles, no generic gradient text, no fake user stars).
- [ ] **Single H1 Verification:** Verify via browser DOM query that only 1 `<h1>` tag exists on the entire page.
- [ ] **Sticky Header Integrity:** Verify that clicking anchor links (`#ecosystem`, `#math-engine`, etc.) does not cause section titles to be clipped beneath the navbar.
- [ ] **Mobile Drawer Testing:** Open and close mobile drawer across iPhone (375px), Pixel (412px), and iPad (768px). Confirm no body scroll leakage.
- [ ] **External Exam Route Fidelity:** Confirm typing a code or clicking "دخول امتحان بكود" routes cleanly to `/external-exam`.
- [ ] **Authentication Route Fidelity:** Confirm "تسجيل الدخول" routes to `/login` and "دخول المعلم والمدير" routes to `/admin/login`.
- [ ] **No Horizontal Overflow:** Confirm `document.documentElement.scrollWidth === window.innerWidth` across all viewports.
- [ ] **RTL Visual Flow:** Confirm natural right-to-left optical reading hierarchy, correct chevron directions, and proper text alignments.
- [ ] **KaTeX Math Fidelity:** Verify equations render crisp vector mathematical glyphs with zero layout distortion.
- [ ] **Contrast Compliance:** Test computed color contrast ratios in Edge/Chromium DevTools for all body and heading elements.
