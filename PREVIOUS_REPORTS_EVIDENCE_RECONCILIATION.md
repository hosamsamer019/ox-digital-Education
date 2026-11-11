# OX-DIGITAL Education — Previous Reports & Evidence Reconciliation

**Audit Date:** November 8, 2026  
**Audited Directory:** `D:\OX-DIGITAL\Mathe\OX-DIGITAL-GITHUB`  
**Reports Reconciled:** `LOCALIZATION_REMAINING_ARABIC_FINDINGS.md`, `LOCALIZATION_REMEDIATION_REPORT.md`, `COMPREHENSIVE_ACCOUNT_EXPERIENCE_ACCEPTANCE.md`, `THEME_AND_COLOR_SYSTEM_AUDIT.md`, `TEACHER_BRANCH_ACCOUNTANT_WORKFLOW_AUDIT.md`  
**Audit Character:** Forensic Discrepancy & Verification Reconciliation  

---

## 1. Executive Summary

This report performs an item-by-item reconciliation of all factual contradictions, ambiguous metrics, and over-optimistic verification claims identified across prior audit and acceptance reports.

Every discrepancy is analyzed against the concrete evidence found in the codebase, database, test runners, and Docker inspect logs.

---

## 2. Reconciled Discrepancies Register

### Discrepancy 1: Multi-Account Language Isolation Claim
- **Original Claim:** `COMPREHENSIVE_ACCOUNT_EXPERIENCE_ACCEPTANCE.md` marked live multi-user concurrent testing as **NOT VERIFIED (Safeguarded)** to protect the dev database.
- **Later Claim:** The executive summary of the previous turn claimed "100% verification and acceptance of per-account language isolation."
- **Available Evidence:**
  - Database persistence (`User.language`) is **SOURCE VERIFIED** and **DATABASE VERIFIED** via direct PostgreSQL inspect.
  - Browser storage synchronization (`AuthContext.tsx`, `LanguageContext.tsx`) is **SOURCE VERIFIED**.
  - Live concurrent multi-browser testing across distinct physical windows was **never executed** with disposable test accounts.
  - A client-side cache inheritance vulnerability exists when accounts have `language: null`.
- **Status:** **RECONCILED.** The code implementation is verified; the claim of live browser verification was overstated and is downgraded to **SOURCE VERIFIED ONLY**. Live concurrent browser testing remains **NOT VERIFIED**.

---

### Discrepancy 2: Six Roles vs. Seven Roles in Platform Matrix
- **Original Claim:** Several reports referenced "6 platform roles" (Primary Manager, Teacher, Accountant, Student, Parent, Admin).
- **Later Claim:** Other tables listed 7 roles, splitting Student into "Online Student" and "Center Student".
- **Available Evidence:**
  - Prisma schema (`schema.prisma`) defines enum `UserRole`:
    `ADMIN`, `TEACHER`, `ONLINE_STUDENT`, `CENTER_STUDENT`, `PARENT`, `ACCOUNTANT`.
  - In addition, an `ADMIN` with `isPrimaryManager: true` represents the distinct administrative identity `PRIMARY_MANAGER`.
- **Status:** **RECONCILED.** There are **7 functional user identities**:
  1. `ADMIN`
  2. `PRIMARY_MANAGER` (ADMIN with `isPrimaryManager: true`)
  3. `TEACHER`
  4. `ACCOUNTANT`
  5. `ONLINE_STUDENT`
  6. `CENTER_STUDENT`
  7. `PARENT`  
  Referring to "6 roles" occurred when `ONLINE_STUDENT` and `CENTER_STUDENT` were grouped together under "Student". The authoritative platform role count is **7**.

---

### Discrepancy 3: 1,473 Localization Findings vs. 1,252 Remediated Occurrences
- **Original Claim:** `LOCALIZATION_REMAINING_ARABIC_FINDINGS.md` cataloged **1,473 unintended Arabic findings** (1,368 Category A + 105 Category B).
- **Later Claim:** `LOCALIZATION_REMEDIATION_REPORT.md` reported **1,252 resolved occurrences** across 854 unique strings, 575 rewritten dictionary entries, and 109 added keys.
- **Available Evidence:**
  - 1,473 was the gross register of all reported findings, including duplicate occurrences across views and static mock data fixtures.
  - 1,252 represented the exact count of active production UI occurrences remediated in application components.
  - 221 items were duplicate lines, test fixtures, or static mock datasets (`mockData.ts`).
  - The 1,252 production occurrences mapped to **854 distinct unique Arabic strings**:
    - 272 were already clean in the dictionary.
    - 575 had machine-translation artifacts (Arabic text in English values) and were rewritten.
    - 7 were multiline strings missing from the dictionary and were added.
  - The 109 added keys were calls to `t(...)` whose keys previously had no English dictionary definition.
- **Status:** **RECONCILED.** The figures are mathematically consistent and represent distinct subsets of the original 1,473 backlog.

---

### Discrepancy 4: Scope of the 333 Automated Tests
- **Original Claim:** The recent regression report claimed that all newly added features (teacher assignment modal, accountant teacher endpoint) were validated by the 333 passing automated tests.
- **Later Assessment:** Did the 333 tests actually run the new backend code?
- **Available Evidence:**
  - Inspection of `apps/frontend/src/app/test/AccountantDashboard.test.tsx` shows that `brdSubscriptionService.getAccountantTeachers` was mocked using `vi.fn().mockResolvedValue({ success: true, teachers: [] })`.
  - The tests verified that `CollectionDeskPage.tsx` and `TeacherEvidencePage.tsx` render properly when this mock is called.
  - The actual Express backend route `GET /api/users/accountant/teachers` and controller `BrdSubscriptionController.getAccountantTeachers` were **never executed by Vitest**.
- **Status:** **RECONCILED.** The 333 automated tests validate **frontend component state and mock integration only**. They do not validate the Express backend routes against PostgreSQL.

---

### Discrepancy 5: Backend Cross-Branch Authorization Evidence
- **Original Claim:** Cross-branch access control was reported as "completely verified" based on the passing test suite.
- **Later Assessment:** Does the repository contain tests asserting cross-branch access rejections?
- **Available Evidence:**
  - Search across all test files (`*.test.ts*`) for `getAccountantStudents`, `assignTeacherBranch`, and cross-branch negative assertions yielded **zero backend integration tests**.
  - All passing tests in `apps/frontend/src/app/test/` test frontend UI routing guards, not server-side database access controls.
- **Status:** **RECONCILED.** Backend cross-branch authorization is **SOURCE VERIFIED** through manual code inspection of controller queries, but **AUTOMATED BACKEND TEST COVERAGE IS MISSING (0/10 scenarios tested)**.

---

### Discrepancy 6: Profile Image Durability Claims
- **Original Claim:** Profile image upload and rendering was declared "verified."
- **Later Assessment:** Does test passing prove persistent avatar storage?
- **Available Evidence:**
  - Automated tests verified client file validation (size <= 2MB, MIME type check) and mock upload calls.
  - Docker inspect of the active container `ox-digital-user-service` confirmed that `/app/storage/avatars` has **no volume mount** (`Mounts: []`).
- **Status:** **RECONCILED.** Avatar upload *logic* is source-verified, but avatar *storage durability* is **NOT VERIFIED** and is currently defective at the Docker infrastructure layer.

---

### Discrepancy 7: Theme Contrast Verification Depth
- **Original Claim:** All 7 themes were reported as displaying verified visual contrast in both light and dark modes.
- **Later Assessment:** Did automated tests measure rendered visual contrast?
- **Available Evidence:**
  - `SevenThemesVerification.test.tsx` and `CriticalThemeLifecycle.test.tsx` run in `jsdom`.
  - `jsdom` does not implement a layout or pixel rendering engine; it only verifies DOM attributes (`data-theme`, `classList.contains('dark')`) and CSS classes in the virtual DOM.
  - No automated tool measured actual computed RGB values or WCAG 2.1 contrast ratios on rendered pixels.
- **Status:** **RECONCILED.** Theme class application and state transitions are **AUTOMATED TEST VERIFIED**, but real-world pixel contrast is **VERIFIED BY CODE INSPECTION ONLY**, not by automated visual regression tools (e.g. Playwright / Percy).

---

### Discrepancy 8: Teacher-to-Branch Live API Verification
- **Original Claim:** Teacher-to-branch assignment workflow was reported as resolved and verified.
- **Later Assessment:** Was the workflow executed with live API responses?
- **Available Evidence:**
  - The UI components (`BranchesPage.tsx`, `CollectionDeskPage.tsx`) were updated and compiled cleanly.
  - The backend endpoints were written in `BrdSubscriptionController.ts`.
  - However, because containers were not rebuilt or restarted (per strict safety rules), the running container `ox-digital-user-service` does not yet contain these code changes.
  - In Vitest, the workflow was verified using mock API handlers.
- **Status:** **RECONCILED.** The teacher-to-branch workflow is **SOURCE VERIFIED and UNIT/MOCK TEST VERIFIED**, but **NOT VERIFIED AGAINST LIVE BACKEND CONTAINERS**.

---

### Discrepancy 9: `TeacherEvidencePage.tsx` Mock Data Fallback
- **Original Claim:** `TeacherEvidencePage.tsx` was converted to dynamically query live branch teachers.
- **Later Assessment:** Can the page still show hardcoded mock teachers?
- **Available Evidence:**
  - In `TeacherEvidencePage.tsx`:
    ```typescript
    const [evidenceList, setEvidenceList] = useState<TeacherLessonEvidence[]>(TEACHER_EVIDENCE_LIST);
    ```
  - `TEACHER_EVIDENCE_LIST` is imported from `mockData.ts` (containing synthetic teachers `أ. حسام البدراني` and `أ. رشا فاروق`).
  - If `loadBranchTeachers()` encounters a network error, returns 0 teachers, or while the query is in flight, `evidenceList` remains populated with synthetic mock teachers!
- **Status:** **RECONCILED.** The component attempts live data fetching, but retains a **synthetic mock data fallback** that can falsely display unrelated mock teachers if live data is empty or fails. This fallback should be removed in a future approved remediation.

---

## 3. Reconciliation Summary Table

| Discrepancy Topic | Code/Source Status | Test Suite Status | Live Runtime Status | Final Reconciled Finding |
| :--- | :---: | :---: | :---: | :--- |
| **1. Account Language Isolation** | Verified | Verified (Unit) | **Not Verified** | Source logic sound; concurrent browser session unproven. |
| **2. Role Count** | Verified (7 Roles) | Verified | N/A | 7 distinct identities (Admin, Primary Mgr, Teacher, Accountant, Online Stud, Center Stud, Parent). |
| **3. Finding Counts (1473 vs 1252)** | Verified | Verified | N/A | 1,473 gross backlog = 1,252 production UI occurrences + 221 test/fixture items. |
| **4. New Teacher Endpoint Tests** | Verified | **Mock Only** | **Not Verified** | Only tested via frontend Vitest mocks; backend route untested. |
| **5. Cross-Branch Negative Tests** | Verified | **Missing (0/10)** | **Not Verified** | Code logic enforces boundaries; negative integration tests absent. |
| **6. Avatar Storage Durability** | **Defective** | **Mock Only** | **Not Verified** | Container lacks volume mount (`Mounts: []`); data loss guaranteed on rebuild. |
| **7. Theme Contrast Evidence** | Verified | Verified (jsdom) | **Not Verified (Visual)** | DOM attributes tested; computed pixel contrast not measured by automated runner. |
| **8. Teacher Assignment Workflow** | Verified | **Mock Only** | **Not Verified** | Tested with frontend mocks; live container not yet updated. |
| **9. Teacher Evidence Mock Leak** | **Risk Found** | Verified | **Not Verified** | Component retains `mockData.ts` fallback when live data is empty. |

