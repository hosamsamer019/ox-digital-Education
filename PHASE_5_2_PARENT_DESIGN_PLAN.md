# OX-DIGITAL Education — Phase 5.2 Parent Dashboard Design Plan

**Status:** PROPOSAL. Awaiting approval. No source files changed.
**Direction:** Academic Precision & Digital Mastery, adapted to a calmer, family-facing tone.

---

## 1. Principles

1. **Only real, scoped data.** Use only `/users/parent/children`, `/analytics/parent/child/:id/overview`, `/attendance/student/:id`, notifications, and profile.
2. **Calm, not alarming.** Use neutral surfaces and crimson for identity and the active state only. Reserve amber for "needs attention" and emerald for "present/good".
3. **One selected child drives the whole view.** The selection is kept in the URL query (`?child=<id>`) so it survives navigation between Home, Children, and Reports.
4. **Honest labels.** Remove displays of fields the backend doesn't provide, and explain computed figures.

## 2. Tokens

The tokens are the same as the Admin redesign, for consistency:

| Token | Dark | Light |
| :--- | :--- | :--- |
| Page | `#090b10` | `#f8f7f4` (academic ivory) |
| Card | `#0f131d` | `#ffffff` |
| Well | `#161c28` | `#f1f0ec` |
| Accent | `#9e1b1b` | `#9e1b1b` |
| Status | emerald / amber / slate | same, light tints |

Fonts: Cairo for headings and Tajawal for body text, if they are already loaded globally (verify in `theme.css` before relying on them). The theme continues to come from `useTheme()` and is persisted in `edu-theme`.

## 3. Shell

- `ParentDashboard.tsx`: change `gradientFrom/gradientTo` to the existing `academic-crimson` preset. Title: "OX-DIGITAL Education", subtitle: "بوابة ولي الأمر". **No edit to `SharedLayout.tsx`.**
- Menu changes (honesty fixes, routes unchanged):
  - Rename "التواصل مع المعلم" → "الإشعارات", and point it to the existing `/parent/messages` route. The badge stays the unread-notification count, which is now accurately labelled. Remove the static `badge: 2`.
  - Subscription stays listed. The page displays only "الخدمة قيد التطوير".
- **Decision needed:** keep `/parent/messages` as a notifications view, or hide it. No route will be deleted without approval.

## 4. `/parent/home` — Family Overview

```
[Header] أهلاً، {اسم ولي الأمر} · آخر تحديث
[Child selector] — horizontally scrollable chips (snap) on mobile, wrapping row on desktop
[Selected-child summary card]
   name · grade level (from gradeLevel/educationLevel if present)
   3 compact metrics: الامتحانات المنجزة · الواجبات المسلّمة · نسبة الحضور (if attendance summary exists)
   link → التقرير المفصل (/parent/reports?child=id)
[Two columns ≥lg, stacked on mobile]
   أحدث النتائج (last 5 from overview.recent; type badge, score, date)
   آخر التنبيهات (last 5 notifications; unread dot; real timestamps)
```

- If there is a single child, the selector is hidden.
- If there are no children: an EmptyState that explains linking is done by the administration (the existing copy).

## 5. `/parent/children` — Child Detail

- Same selector component.
- Metric row: **remove "المرتبة"** (D1). Keep: المتوسط العام (with a "يشمل الامتحانات والواجبات" hint), الامتحانات, الواجبات, نسبة الحضور.
- Recent activity list (last 5) restyled.
- Attendance: summary chips (present / late / absent / %), plus the last 5 records with a status pill.

## 6. `/parent/reports` — Academic Reports

- Exam bar chart and homework line chart restyled (crimson bars, neutral grid, RTL tooltip).
- Results table: keep the columns. Hide the "Actions" column entirely, because `assessmentId` is never returned (D2). Note this as a backend recommendation rather than faking a link.
- On narrow screens, the table becomes stacked cards below `sm`.

## 7. `/parent/subscription`

- Replace the fabricated plans and prices with an honest "خدمة الاشتراكات قيد التطوير" panel. **Decision needed:** removing the plans changes visible content, so this needs your confirmation.

## 8. Shared Pieces (parent-local, new files under `components/parent/`)

- `ChildSelector.tsx`: accessible `role="tablist"`, keyboard arrows, horizontal scroll on mobile.
- `useSelectedChild.ts`: loads children once and syncs `?child=` with the URL. It falls back to the first child and ignores IDs that are not in the parent's list (it never fetches an arbitrary ID from the URL).
- `ParentStateViews.tsx`: loading skeleton, empty state, and **error state with retry** (fixes §6 of the audit).
- Request-race guard: ignore stale responses when the selected child changes.

## 9. States

| State | Behaviour |
| :--- | :--- |
| Loading | Skeleton cards matching the final layout |
| No children | EmptyState with the admin-linking guidance |
| Overview error | Inline amber panel "تعذر تحميل بيانات {child}" + retry. Other sections still render. |
| Attendance error | Distinct from "no records": "تعذر تحميل سجل الحضور" + retry |
| 401 | Existing `api.ts` interceptor (unchanged) |
| 403/404 for a child | "هذا الطالب غير مرتبط بحسابك" and the selection is reset |

## 10. Backend Recommendations (NOT to be implemented in this phase)

1. Return `assessmentId` (and the attempt `id`) in `recent` so the review link can work.
2. Count ungraded homework separately instead of as `0` in `overallRate`.
3. Add `checkRole(['parent'])` to `GET /users/parent/children` (defence in depth).
4. Narrow `getParentAnalytics` with an explicit `select` before any UI uses it.
