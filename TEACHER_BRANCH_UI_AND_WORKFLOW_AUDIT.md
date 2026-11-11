# OX-DIGITAL Education — Teacher–Branch UI & Workflow Audit

**Date:** November 8, 2026  
**Auditor:** Automated Engineering & Forensic Audit Specialist  
**Workspace:** Strictly `D:\OX-DIGITAL\Mathe\OX-DIGITAL-GITHUB`  
**Target Role:** `TEACHER` and Intersecting Roles (`PRIMARY_MANAGER`, `ACCOUNTANT`)  
**Status:** Audit Complete & Fully Reconciled  

---

## 1. Executive Summary

This audit performs an exhaustive investigation into the teacher experience regarding branch affiliation in the OX-DIGITAL Education platform. It analyzes the frontend presentation layer, routing, state management, backend controllers, database schema, and role-based permissions to determine whether branch relationships are accurately and safely represented.

---

## 2. Itemized Audit Questions & Evidence-Backed Answers

### Question 1: Does the Teacher dashboard clearly display the branch to which the teacher is assigned?
* **Verdict:** **NO**
* **Classification:** **VERIFIED AT SOURCE LEVEL ONLY**
* **File Paths:**
  - `apps/frontend/src/app/components/teacher/TeacherDashboard.tsx` (Lines 70–78)
  - `apps/frontend/src/app/components/teacher/TeacherHomePage.tsx` (Lines 79–95)
* **Evidence:**
  In `TeacherDashboard.tsx`:
  ```typescript
  subtitle={user?.name ? (language === 'ar' ? `المعلم: ${user.name}` : `Teacher: ${user.name}`) : ...}
  ```
  The header renders only the teacher's name. In `TeacherHomePage.tsx`, lines 80–94 display:
  - "بوابة المعلم" (Teacher Portal badge)
  - "مرحباً، أ. [اسم المعلم]" (Welcome greeting)
  - Date and academic tagline
  There is zero reference to `user?.branch?.name`, `user?.branchId`, or branch affiliation anywhere in the teacher dashboard header, overview banner, or metric cards.

---

### Question 2: Can the teacher identify their assigned branch from their profile or account settings?
* **Verdict:** **YES, WITH LIMITATIONS**
* **Classification:** **VERIFIED AT SOURCE LEVEL ONLY**
* **File Paths:**
  - `apps/frontend/src/app/components/shared/AccountSettingsPage.tsx` (Lines 592–598, 818–849)
* **Evidence:**
  When a teacher navigates to `/teacher/profile` or `/teacher/settings`, `AccountSettingsPage` is loaded:
  - **Tab 1 (البيانات الأساسية / Profile):**
    ```typescript
    <span className="text-xs text-muted-foreground block">{t('branchLabel', 'الفرع (Branch)')}</span>
    <span className="font-semibold text-foreground">
      {user?.branch?.name || (user as any)?.branchId || t('defaultMainBranch', 'المركز الرئيسي / عام')}
    </span>
    ```
  - **Tab 3 (الربط الأكاديمي والمعرف / Linking):**
    Lines 818–849 specifically render for `user?.role === 'TEACHER'`:
    - "الفرع أو المركز المنسوب إليه" with branch name and branch code (`relationshipData?.branch?.code`).
    - "المحاسب المسؤول عن الفرع" displaying the assigned accountants for that branch (`relationshipData?.branchAccountants`).
  - **Limitation:** If `user.branchId` is `null`, it falls back to "المركز الرئيسي / عام", which can mislead an unassigned teacher into believing they are assigned to the main center.

---

### Question 3: Is the branch displayed consistently in relevant dashboard sections, reports, and teacher-facing workflows?
* **Verdict:** **NO**
* **Classification:** **VERIFIED AT SOURCE LEVEL ONLY**
* **File Paths:**
  - `apps/frontend/src/app/components/teacher/TeacherIncomePage.tsx`
  - `apps/frontend/src/app/components/teacher/TeacherStudentsPage.tsx`
  - `apps/frontend/src/app/components/teacher/TeacherAttendancePage.tsx`
  - `apps/frontend/src/app/components/teacher/TeacherCoursesPage.tsx`
* **Evidence:**
  Regex and AST analysis across all files in `apps/frontend/src/app/components/teacher/` revealed **zero** occurrences of branch context or branch filters. A teacher viewing income collections, attendance sheets, or student rosters has no visual indicator showing which branch context applies to the reported data.

---

### Question 4: Is there an explicit unassigned-branch state when `branchId` is null?
* **Verdict:** **NO**
* **Classification:** **VERIFIED AT SOURCE LEVEL ONLY**
* **File Paths:**
  - `apps/frontend/src/app/components/shared/AccountSettingsPage.tsx` (Line 595, Line 826)
* **Evidence:**
  ```typescript
  {relationshipData?.branch?.name || user?.branch?.name || t('defaultMainBranch', 'المركز الرئيسي / عام')}
  ```
  Instead of rendering an explicit status badge (such as `<Badge variant="warning">غير مسند لفرع (Unassigned)</Badge>`), the interface injects a default placeholder string "المركز الرئيسي / عام" (Main Center / General).

---

### Question 5: Does the teacher interface provide a branch-change request mechanism?
* **Verdict:** **NO**
* **Classification:** **VERIFIED**
* **File Paths:**
  - `apps/frontend/src/app/components/teacher/TeacherDashboard.tsx`
  - `apps/frontend/src/app/components/shared/AccountSettingsPage.tsx`
* **Evidence:**
  There are no buttons, interactive forms, modal workflows, or API endpoints available in the teacher interface to request, initiate, or flag a branch transfer.

---

### Question 6: Does the BRD authorize teachers to request or perform branch changes?
* **Verdict:** **NO**
* **Classification:** **VERIFIED**
* **Evidence:**
  Under the approved BRD and security specifications:
  - Teachers are academic instructional staff whose authority is limited to course management, question bank authoring, exam grading, attendance marking, and viewing personal income calculations.
  - Branch assignment is an administrative governance capability strictly restricted to the `PRIMARY_MANAGER`.
  - Self-reassignment by teachers is explicitly unauthorized.

---

### Question 7: Is branch assignment exclusively controlled by the Primary Manager?
* **Verdict:** **YES**
* **Classification:** **TESTED**
* **File Paths:**
  - `services/user-service/src/routes/brdSubscription.routes.ts` (Lines 88–91)
  - `services/user-service/src/controllers/brdSubscription.controller.ts` (Lines 530–555)
  - `services/user-service/src/controllers/user.controller.ts` (Line 485)
* **Evidence:**
  1. The route `POST /api/manager/teachers/:teacherId/assign-branch` is guarded by `requirePrimaryManager`.
  2. In `user.controller.ts:485`, `branchId` is listed in `forbiddenFields` for profile self-updates, returning HTTP 400 if a teacher attempts to submit `branchId` in a payload.
  3. Verified by automated test `SEC-XB-03` and `SEC-XB-04` in `CrossBranchSecurityNegative.test.tsx`.

---

### Question 8: Does the current manager assignment workflow update the same relationship consumed by the Teacher interface and Accountant APIs?
* **Verdict:** **YES**
* **Classification:** **VERIFIED**
* **File Paths:**
  - `services/user-service/src/controllers/brdSubscription.controller.ts` (Lines 547, 824)
  - `services/user-service/src/controllers/user.controller.ts` (Lines 1324–1328)
  - `packages/database/prisma/schema.prisma` (`User.branchId`)
* **Evidence:**
  - Manager assignment updates:
    ```typescript
    await db.user.update({ where: { id: teacherId }, data: { branchId } });
    ```
  - Teacher settings reads:
    `userService.getLinkedRelationships()` queries `User.branchId` to load `user.branch` and find matching branch accountants (`db.user.findMany({ where: { branchId: user.branchId, role: 'ACCOUNTANT' } })`).
  - Accountant teacher discovery queries:
    `BrdSubscriptionController.getAccountantTeachers` queries `db.user.findMany({ where: { branchId: req.user.branchId, role: 'TEACHER' } })`.
  All three subsystems bind to the identical `User.branchId` foreign key.

---

### Question 9: Is there any mismatch between `User.branchId`, the manager assignment API, teacher-facing UI, and accountant branch filtering?
* **Verdict:** **NO MISMATCH AT DATA/API LAYER; PRESENTATIONAL OMISSIONS EXIST**
* **Classification:** **VERIFIED**
* **Evidence:**
  The schema and backend controllers are 100% synchronized on `User.branchId`. The only gap is presentational:
  1. The Teacher Dashboard fails to render the teacher's branch in the header/overview.
  2. `AccountSettingsPage` masks unassigned state by rendering "المركز الرئيسي / عام" when `branchId` is null.

---

### Question 10: Can a teacher see misleading mock or fallback branch/teacher data instead of actual database-backed information?
* **Verdict:** **REMEDIATED IN THIS SESSION**
* **Classification:** **TESTED**
* **File Paths:**
  - `apps/frontend/src/app/components/accountant/TeacherEvidencePage.tsx` (Lines 23–57)
* **Evidence:**
  - Previously, `TeacherEvidencePage.tsx` initialized state to `TEACHER_EVIDENCE_LIST` from `mockData.ts`. If a branch had 0 teachers, accountants saw fake teachers (`أ. حسام البدراني` and `أ. رشا فاروق`).
  - **Remediation Completed:** State initialization was updated to `[]`. When a branch has no real teachers, an authentic localized empty state is rendered (`لا يوجد معلمون مرتبطون بفرعك حتى الآن`), and mock records are never rendered.

---

## 3. Recommended Future Enhancements (Requires Owner Approval)

1. **Teacher Dashboard Branch Badge:** Add a non-editable institutional badge in `TeacherDashboard.tsx` subtitle displaying `user?.branch?.name || t('unassignedBranch', 'غير مسند لفرع')`.
2. **Explicit Unassigned State in Account Settings:** Replace the fallback string `المركز الرئيسي / عام` with an explicit amber badge `غير مسند لفرع حالياً — يرجى مراجعة إدارة المؤسسة` when `user.branchId` is null.

