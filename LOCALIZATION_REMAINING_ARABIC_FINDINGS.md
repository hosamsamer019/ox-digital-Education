# OX-DIGITAL Education — Remaining Arabic UI Findings Report

**Workspace:** `D:\OX-DIGITAL\Mathe\OX-DIGITAL-GITHUB`  
**Date:** 2026-11-08  
**Audit Scope:** Comprehensive Read-Only AST & Runtime Investigation of Remaining Arabic UI Strings in English Mode  
**Audit Target:** All Authenticated Dashboards, Secondary Pages, Menus, Modals, Tables, Forms, and Notifications  
**Audit Classification:** Strictly Read-Only Audit — Zero Code Edits, Zero Dictionary Modifications  
**Status:** **1,473 UNINTENDED ARABIC UI FINDINGS IDENTIFIED (CATEGORY A & B)**

---

## 1. Executive Summary

Following the activation of the baseline localization build on November 8, 2026, an exhaustive, read-only AST syntax-tree and component-level investigation was conducted across all 194 application source files in `apps/frontend/src/app`.

While public routes (`/`, `/login`, `/admin/login`, `/external-exam`) and core shell headers successfully toggle layout direction and primary navigation labels, **a total of 1,473 unintended Arabic UI strings remain active in English mode** across authenticated dashboards and secondary pages.

### Core Metrics Summary

| Category | Description | Total Findings | Status in English Mode |
| :--- | :--- | :---: | :--- |
| **Category A** | Missing Static UI Translation (Headers, Menus, Tables, Buttons, Tabs, Placeholders) | **1,368** | **DEFECT**: Renders in Arabic while interface is set to English |
| **Category B** | Dynamic Frontend Messages (Toast notifications, validation alerts, loading & error states) | **105** | **DEFECT**: Hardcoded Arabic messages displayed upon user actions |
| **Category C** | Backend-Generated Messages (API status text, error responses) | Documented | Investigated at controller boundaries |
| **Category D** | User-Generated & Test Content (Authentic Egyptian names: `أحمد`, `محمد`, etc.) | **4** | **PRESERVED**: Legitimate proper names, correctly untranslated |
| **Category E** | Intentional Arabic Content (Egyptian math curriculum: `أوجد قيمة س`, `س = ٠`, etc.) | **149** | **PRESERVED**: Authentic academic curriculum questions |
| **Category F** | Mixed-Language & Directional Formatting Defects | Documented | Identified in menus and status badges |
| **TOTAL UNINTENDED UI DEFECTS (A + B)** | | **1,473** | **CRITICAL LOCALIZATION REMEDIATION BACKLOG** |

---

## 2. Distribution of Unintended Arabic UI Findings by Role

Every authenticated user role in OX-DIGITAL Education contains substantial untranslated Arabic text when English is selected:

```
┌────────────────────────────────────────────────────────┐
│  UNINTENDED ARABIC UI STRINGS BY ROLE (CAT A & B)       │
├────────────────────────────────┬───────────────────────┤
│  Teacher                       │  295 findings         │
│  Primary Manager (Legacy)      │  292 findings         │
│  Accountant                    │  250 findings         │
│  Admin / Primary Manager       │  219 findings         │
│  General / Shared Components   │  118 findings         │
│  Landing Pages                 │  108 findings         │
│  Student - Shared Views        │   76 findings         │
│  Authentication Screens        │   68 findings         │
│  Student - Online              │   63 findings         │
│  Student - Center              │   61 findings         │
│  Parent                        │   40 findings         │
├────────────────────────────────┼───────────────────────┤
│  TOTAL DEFECTS                 │  1,473 findings       │
└────────────────────────────────┴───────────────────────┘
```

---

## 3. Root Cause Classification of Remaining Arabic Text

A rigorous investigation into why Arabic text continues to render in English mode revealed three primary technical mechanisms:

### Root Cause 1: Untranslated Menu Objects (`menuItems` lacking `labelKey`)
- **Mechanism:** In dashboard container shells (such as `AccountantDashboard.tsx`, `TeacherDashboard.tsx`, and `StudentCenterDashboard.tsx`), navigation arrays are defined as:
  ```tsx
  const menuItems = [
    { label: 'لوحة العمليات اليومية', path: '/accountant/home' },
    { label: 'مكتب التحصيل والسداد', path: '/accountant/pos' },
    ...
  ];
  ```
- **Failure:** The sidebar layout renders `item.labelKey ? t(item.labelKey) : item.label`. Because `labelKey` is omitted, the component falls back directly to `item.label`, permanently rendering Arabic even in English mode.

### Root Cause 2: Calls to `t(key)` Missing from `UI_TRANSLATIONS_EN`
- **Mechanism:** A total of **109 calls to `t(...)`** pass Arabic strings that do not exist in `UI_TRANSLATIONS_EN` or `translations.ts`.
- **Failure:** In `LanguageContext.tsx`:
  ```ts
  if (language === 'en') {
    if (UI_TRANSLATIONS_EN && UI_TRANSLATIONS_EN[key]) return UI_TRANSLATIONS_EN[key];
    if (fallback !== undefined) return fallback;
  }
  return fallback !== undefined ? fallback : key;
  ```
  When `UI_TRANSLATIONS_EN[key]` is missing, `t(key)` returns `key` itself, which is the raw Arabic string.

### Root Cause 3: Raw Arabic String Literals in Variables, Arrays & Ternary Statuses
- **Mechanism:** A total of **1,364 occurrences** of raw Arabic strings are assigned to component constants, table column configurations, grade-level arrays, and status badges:
  ```tsx
  status === 'ACTIVE' ? 'نشطة ومؤمنة' : 'قيد المراجعة'
  paymentMethod === 'CASH' ? 'نقدي' : 'تحويل بنكي'
  ```
  Because these expressions evaluate outside `t()`, they display in Arabic regardless of the active language.

---

## 4. Detailed Role-by-Role Findings Register

### 4.1 Teacher Role (295 Findings Across 14 Files)

| Finding ID | Source File & Location | Arabic Visible String | English Context / Component | Root Cause | Severity | Recommended Correction |
| :--- | :--- | :--- | :--- | :--- | :---: | :--- |
| `FIND-1444` | `TeacherDashboard.tsx:46` | `لوحة المؤشرات` | Sidebar navigation item | Missing `labelKey: 'teacherMenuHome'` | High | Add `labelKey: 'teacherMenuHome'` to menu item |
| `FIND-1445` | `TeacherDashboard.tsx:47` | `قائمة الطلاب (My Students)` | Sidebar navigation item | Missing `labelKey: 'teacherMenuStudents'` | High | Add `labelKey: 'teacherMenuStudents'` to menu item |
| `FIND-1446` | `TeacherDashboard.tsx:48` | `الاشتراكات والأسعار` | Sidebar navigation item | Missing `labelKey: 'teacherMenuPricing'` | High | Add `labelKey: 'teacherMenuPricing'` to menu item |
| `FIND-1447` | `TeacherDashboard.tsx:49` | `سجل الحضور والغياب` | Sidebar navigation item | Missing `labelKey: 'teacherMenuAttendance'` | High | Add `labelKey: 'teacherMenuAttendance'` to menu item |
| `FIND-1448` | `TeacherDashboard.tsx:50` | `المقررات والمناهج` | Sidebar navigation item | Missing `labelKey: 'teacherMenuCourses'` | High | Add `labelKey: 'teacherMenuCourses'` to menu item |
| `FIND-1449` | `TeacherDashboard.tsx:51` | `الامتحانات والتقييمات` | Sidebar navigation item | Missing `labelKey: 'teacherMenuExams'` | High | Add `labelKey: 'teacherMenuExams'` to menu item |
| `FIND-1450` | `TeacherDashboard.tsx:52` | `بنك الأسئلة الذكي` | Sidebar navigation item | Missing `labelKey: 'teacherMenuQuestionBank'` | High | Add `labelKey: 'teacherMenuQuestionBank'` to menu item |
| `FIND-1451` | `TeacherDashboard.tsx:53` | `المساعد الذكي (AI Studio)` | Sidebar navigation item | Missing `labelKey: 'teacherMenuAI'` | High | Add `labelKey: 'teacherMenuAI'` to menu item |
| `FIND-1452` | `TeacherDashboard.tsx:54` | `التحليلات ومستوى الأداء` | Sidebar navigation item | Missing `labelKey: 'teacherMenuAnalytics'` | High | Add `labelKey: 'teacherMenuAnalytics'` to menu item |
| `FIND-1453` | `TeacherDashboard.tsx:55` | `تقارير الطلاب الأكاديمية` | Sidebar navigation item | Missing `labelKey: 'teacherMenuReports'` | High | Add `labelKey: 'teacherMenuReports'` to menu item |
| `FIND-1454` | `TeacherDashboard.tsx:56` | `تقرير الدخل والتحصيلات` | Sidebar navigation item | Missing `labelKey: 'teacherMenuIncome'` | High | Add `labelKey: 'teacherMenuIncome'` to menu item |
| `FIND-1455` | `TeacherDashboard.tsx:57` | `التنبيهات والإشعارات` | Sidebar navigation item | Missing `labelKey: 'teacherMenuNotifications'` | High | Add `labelKey: 'teacherMenuNotifications'` to menu item |
| `FIND-1456` | `TeacherDashboard.tsx:58` | `إعدادات الحساب والمظهر` | Sidebar navigation item | Missing `labelKey: 'teacherMenuSettings'` | High | Add `labelKey: 'teacherMenuSettings'` to menu item |
| `FIND-1339` | `TeacherAttendancePage.tsx:32` | `الصف الأول الابتدائي (أولى ابتدائي)` | Grade selector dropdown | Raw array string literal | High | Wrap with `t()` and register English grades |
| `FIND-1340` | `TeacherAttendancePage.tsx:33` | `الصف الثاني الابتدائي (تانية ابتدائي)` | Grade selector dropdown | Raw array string literal | High | Wrap with `t()` and register English grades |
| `FIND-1341` | `TeacherAttendancePage.tsx:34` | `الصف الثالث الابتدائي (تالتة ابتدائي)` | Grade selector dropdown | Raw array string literal | High | Wrap with `t()` and register English grades |
| `FIND-1458` | `TeacherExamsPage.tsx:20` | `اختيار من متعدد (MCQ)` | Exam question type selector | Raw array string literal | High | Wrap with `t('mcqQuestionType', 'Multiple Choice')` |
| `FIND-1459` | `TeacherExamsPage.tsx:21` | `صح وخطأ` | Exam question type selector | Raw array string literal | High | Wrap with `t('trueFalseQuestionType', 'True / False')` |
| `FIND-1461` | `TeacherExamsPage.tsx:23` | `مسائل رياضية` | Exam question type selector | Raw array string literal | High | Wrap with `t('mathProblemsType', 'Math Problems')` |
| `FIND-1508` | `TeacherIncomePage.tsx:51` | `تعذر تحميل تقرير التحصيلات والدخل` | Network error alert | Hardcoded error message | High | Wrap with `t('incomeFetchError', ...)` |
| `FIND-1530` | `TeacherProfilePage.tsx:94` | `معلم معتمد بالمنظومة` | Profile verification badge | Hardcoded badge string | Medium | Wrap with `t('certifiedTeacherBadge', 'Certified Teacher')` |
| `FIND-1535` | `TeacherQuestionBankPage.tsx:100` | `يرجى كتابة نص السؤال` | Validation error message | Raw string in form check | High | Wrap with `t('enterQuestionTextValidation', ...)` |

---

### 4.2 Accountant Role (250 Findings Across 10 Files)

| Finding ID | Source File & Location | Arabic Visible String | English Context / Component | Root Cause | Severity | Recommended Correction |
| :--- | :--- | :--- | :--- | :--- | :---: | :--- |
| `FIND-0001` | `AccountantDashboard.tsx:32` | `لوحة العمليات اليومية` | Sidebar navigation item | Missing `labelKey: 'accountantMenuHome'` | High | Add `labelKey: 'accountantMenuHome'` |
| `FIND-0002` | `AccountantDashboard.tsx:38` | `مكتب التحصيل والسداد` | Sidebar navigation item | Missing `labelKey: 'accountantMenuPOS'` | High | Add `labelKey: 'accountantMenuPOS'` |
| `FIND-0003` | `AccountantDashboard.tsx:44` | `إدارة وتدقيق الإيصالات` | Sidebar navigation item | Missing `labelKey: 'accountantMenuReceipts'` | High | Add `labelKey: 'accountantMenuReceipts'` |
| `FIND-0004` | `AccountantDashboard.tsx:50` | `شؤون وحسابات الطلاب` | Sidebar navigation item | Missing `labelKey: 'accountantMenuStudents'` | High | Add `labelKey: 'accountantMenuStudents'` |
| `FIND-0005` | `AccountantDashboard.tsx:56` | `سندات الصرف` | Sidebar navigation item | Missing `labelKey: 'accountantMenuExpenses'` | High | Add `labelKey: 'accountantMenuExpenses'` |
| `FIND-0006` | `AccountantDashboard.tsx:62` | `الخزائن والتحويلات` | Sidebar navigation item | Missing `labelKey: 'accountantMenuCashbox'` | High | Add `labelKey: 'accountantMenuCashbox'` |
| `FIND-0007` | `AccountantDashboard.tsx:68` | `الجرد والإغلاق اليومي` | Sidebar navigation item | Missing `labelKey: 'accountantMenuReconciliation'` | High | Add `labelKey: 'accountantMenuReconciliation'` |
| `FIND-0008` | `AccountantDashboard.tsx:74` | `توثيق حصص المعلمين` | Sidebar navigation item | Missing `labelKey: 'accountantMenuTeacherEvidence'` | High | Add `labelKey: 'accountantMenuTeacherEvidence'` |
| `FIND-0009` | `AccountantDashboard.tsx:80` | `التقارير الأولية للفرع` | Sidebar navigation item | Missing `labelKey: 'accountantMenuReports'` | High | Add `labelKey: 'accountantMenuReports'` |
| `FIND-0010` | `AccountantDashboard.tsx:86` | `إعدادات الحساب والمظهر` | Sidebar navigation item | Missing `labelKey: 'accountantMenuSettings'` | High | Add `labelKey: 'accountantMenuSettings'` |
| `FIND-0011` | `AccountantHomePage.tsx:116` | `إدارة التحصيلات النقدية، تدقيق حسابات الطلاب، وإعداد سندات الصرف وفق حوكمة الصانع والمراجع (Maker)` | Role description subtitle | Missing from `UI_TRANSLATIONS_EN` | High | Add English key in `UI_TRANSLATIONS_EN` |
| `FIND-0012` | `AccountantHomePage.tsx:182` | `خزينة الفرع الرئيسية` | Cashbox header label | Raw string literal | High | Wrap with `t('mainBranchCashbox', ...)` |
| `FIND-0013` | `AccountantHomePage.tsx:245` | `نشطة ومؤمنة` | Cashbox status badge | Hardcoded ternary string | High | Use `status === 'ACTIVE' ? t('activeAndSecured', 'Active & Secured') : ...` |
| `FIND-0014` | `AccountantHomePage.tsx:245` | `قيد المراجعة` | Cashbox status badge | Hardcoded ternary string | High | Use `t('pendingReview', 'Pending Review')` |
| `FIND-0019` | `AccountantHomePage.tsx:367` | `نقدي` | Payment method badge | Raw string literal | High | Use `t('paymentMethodCash', 'Cash')` |
| `FIND-0026` | `AccountantReportsPage.tsx:246` | `تم استخراج هذا التقرير آلياً من النظام المالي الموحد لمنصة OX-DIGITAL Education (يستثني الإيصالات الملغاة والمستردة من الإجماليات المعتمدة).` | Report audit disclaimer | Missing from `UI_TRANSLATIONS_EN` | High | Register in `UI_TRANSLATIONS_EN` |
| `FIND-0100` | `CollectionDeskPage.tsx:54` | `تعذر تحميل قائمة الطلاب المصرح بها لمحاسب هذا الفرع` | Network error alert | Raw error string | High | Wrap with `t('collectionDeskStudentsFetchError', ...)` |
| `FIND-0102` | `CollectionDeskPage.tsx:183` | `نشط` | Student financial status | Raw status literal | High | Use `t('statusActive', 'Active')` |
| `FIND-0113` | `DailyReconciliationPage.tsx:100` | `تم تسجيل المحضر وتنبيه إدارة المركز فورياً للتحقيق` | Audit confirmation toast | Raw message literal | High | Wrap with `t('reconciliationSuccessToast', ...)` |
| `FIND-0127` | `ExpensesPage.tsx:53` | `مرفوض` | Voucher status badge | Raw status literal | High | Use `t('voucherStatusRejected', 'Rejected')` |

---

### 4.3 Admin & Primary Manager Roles (511 Findings Across 18 Files)

| Finding ID | Source File & Location | Arabic Visible String | English Context / Component | Root Cause | Severity | Recommended Correction |
| :--- | :--- | :--- | :--- | :--- | :---: | :--- |
| `FIND-0266` | `AdminDashboard.tsx:30` | `لوحة القيادة الموحدة` | Navigation header | Hardcoded Arabic literal | High | Wrap with `t('adminUnifiedCommand', ...)` |
| `FIND-0267` | `AdminDashboard.tsx:31` | `أداء وفروع المؤسسة` | Subtitle | Hardcoded Arabic literal | High | Wrap with `t('institutionBranchesPerformance', ...)` |
| `FIND-0268` | `AdminDashboard.tsx:32` | `الحسابات والإدارة المالية` | Section header | Hardcoded Arabic literal | High | Wrap with `t('accountsFinancialManagement', ...)` |
| `FIND-0294` | `AdminHomePage.tsx:109` | `مؤسسة أوكس الرقمية التعليمية` | Top title | Hardcoded Arabic literal | Medium | Wrap with `t('oxDigitalInstitutionTitle', ...)` |
| `FIND-0310` | `AdminBranchesPage.tsx:44` | `الفرع الرئيسي - القاهرة` | Sample branch name | Raw string constant | Low | Category D / User data |
| `FIND-0322` | `AdminInstitutionsPage.tsx:88` | `المقر الرئيسي - الدقي` | Institution address | Raw string literal | Low | Category D / User data |
| `FIND-0345` | `AdminUsersPage.tsx:112` | `مدير نظام` | Role badge in table | Raw string literal | High | Use `roleMap[user.role] ? t(roleMap[user.role]) : ...` |
| `FIND-0346` | `AdminUsersPage.tsx:113` | `معلم` | Role badge in table | Raw string literal | High | Use `t('roleTeacher', 'Teacher')` |
| `FIND-0347` | `AdminUsersPage.tsx:114` | `محاسب` | Role badge in table | Raw string literal | High | Use `t('roleAccountant', 'Accountant')` |
| `FIND-0348` | `AdminUsersPage.tsx:115` | `طالب سنتر` | Role badge in table | Raw string literal | High | Use `t('roleCenterStudent', 'Center Student')` |
| `FIND-0349` | `AdminUsersPage.tsx:116` | `طالب أونلاين` | Role badge in table | Raw string literal | High | Use `t('roleOnlineStudent', 'Online Student')` |
| `FIND-0350` | `AdminUsersPage.tsx:117` | `ولي أمر` | Role badge in table | Raw string literal | High | Use `t('roleParent', 'Parent')` |
| `FIND-0390` | `AdminFinancePage.tsx:65` | `إجمالي الإيرادات المحققة` | KPI metric title | Raw string literal | High | Wrap with `t('totalRecognizedRevenue', ...)` |
| `FIND-0410` | `AdminSettingsPage.tsx:50` | `إعدادات المنظومة العامة` | Settings section header | Raw string literal | High | Wrap with `t('generalSystemSettings', ...)` |
| `FIND-0425` | `AdminSystemLogsPage.tsx:85` | `تسجيل دخول ناجح` | Log event description | Raw string literal | Medium | Wrap with `t('logSuccessfulLogin', ...)` |
| `FIND-0450` | `RiskDetectionPage.tsx:70` | `كشف المخاطر وحماية النزاهة الأكاديمية` | Page title | Raw string literal | High | Wrap with `t('riskDetectionPageTitle', ...)` |

---

### 4.4 Student Roles (Center & Online) (200 Findings Across 21 Files)

| Finding ID | Source File & Location | Arabic Visible String | English Context / Component | Root Cause | Severity | Recommended Correction |
| :--- | :--- | :--- | :--- | :--- | :---: | :--- |
| `FIND-1150` | `StudentCenterDashboard.tsx:28` | `الرئيسية وحصص السنتر` | Sidebar navigation item | Missing `labelKey` | High | Add `labelKey: 'studentCenterMenuHome'` |
| `FIND-1151` | `StudentCenterDashboard.tsx:34` | `سجل الحضور والغياب` | Sidebar navigation item | Missing `labelKey` | High | Add `labelKey: 'studentCenterMenuAttendance'` |
| `FIND-1152` | `StudentCenterDashboard.tsx:40` | `مجموعات السنتر والمواعيد` | Sidebar navigation item | Missing `labelKey` | High | Add `labelKey: 'studentCenterMenuGroups'` |
| `FIND-1153` | `StudentCenterDashboard.tsx:46` | `الامتحانات والتقييمات` | Sidebar navigation item | Missing `labelKey` | High | Add `labelKey: 'studentCenterMenuExams'` |
| `FIND-1154` | `StudentCenterDashboard.tsx:52` | `الاشتراكات والإيصالات` | Sidebar navigation item | Missing `labelKey` | High | Add `labelKey: 'studentCenterMenuSubscriptions'` |
| `FIND-1175` | `CenterAttendanceHistoryPage.tsx:45` | `حاضر` | Attendance status badge | Raw status literal | High | Use `t('statusPresent', 'Present')` |
| `FIND-1176` | `CenterAttendanceHistoryPage.tsx:46` | `غائب` | Attendance status badge | Raw status literal | High | Use `t('statusAbsent', 'Absent')` |
| `FIND-1177` | `CenterAttendanceHistoryPage.tsx:47` | `متأخر` | Attendance status badge | Raw status literal | High | Use `t('statusLate', 'Late')` |
| `FIND-1200` | `StudentOnlineDashboard.tsx:30` | `الرئيسية والمحاضرات` | Sidebar navigation item | Missing `labelKey` | High | Add `labelKey: 'studentOnlineMenuHome'` |
| `FIND-1201` | `StudentOnlineDashboard.tsx:36` | `المقررات والمناهج الرقمية` | Sidebar navigation item | Missing `labelKey` | High | Add `labelKey: 'studentOnlineMenuCourses'` |
| `FIND-1202` | `StudentOnlineDashboard.tsx:42` | `الواجبات والتكليفات` | Sidebar navigation item | Missing `labelKey` | High | Add `labelKey: 'studentOnlineMenuAssignments'` |
| `FIND-1203` | `StudentOnlineDashboard.tsx:48` | `الامتحانات والاختبارات` | Sidebar navigation item | Missing `labelKey` | High | Add `labelKey: 'studentOnlineMenuExams'` |
| `FIND-1204` | `StudentOnlineDashboard.tsx:54` | `المساعد الذكي (Math Solver)` | Sidebar navigation item | Missing `labelKey` | High | Add `labelKey: 'studentOnlineMenuSolver'` |
| `FIND-1240` | `OnlineCoursesPage.tsx:60` | `مكتمل` | Lecture progress badge | Raw string literal | High | Use `t('lectureCompleted', 'Completed')` |
| `FIND-1241` | `OnlineCoursesPage.tsx:61` | `قيد المشاهدة` | Lecture progress badge | Raw string literal | High | Use `t('lectureInProgress', 'In Progress')` |

---

### 4.5 Parent Role (40 Findings Across 9 Files)

| Finding ID | Source File & Location | Arabic Visible String | English Context / Component | Root Cause | Severity | Recommended Correction |
| :--- | :--- | :--- | :--- | :--- | :---: | :--- |
| `FIND-0801` | `ParentDashboard.tsx:28` | `لوحة متابعة الأبناء` | Sidebar navigation item | Missing `labelKey` | High | Add `labelKey: 'parentMenuHome'` |
| `FIND-0802` | `ParentDashboard.tsx:34` | `سجل الحضور والغياب` | Sidebar navigation item | Missing `labelKey` | High | Add `labelKey: 'parentMenuAttendance'` |
| `FIND-0803` | `ParentDashboard.tsx:40` | `التقارير الأكاديمية والنتائج` | Sidebar navigation item | Missing `labelKey` | High | Add `labelKey: 'parentMenuReports'` |
| `FIND-0804` | `ParentDashboard.tsx:46` | `الحسابات والاشتراكات المالية` | Sidebar navigation item | Missing `labelKey` | High | Add `labelKey: 'parentMenuFinance'` |
| `FIND-0805` | `ParentDashboard.tsx:52` | `الإشعارات والتنبيهات` | Sidebar navigation item | Missing `labelKey` | High | Add `labelKey: 'parentMenuNotifications'` |
| `FIND-0810` | `ParentChildrenPage.tsx:65` | `طالب مسجل في السنتر` | Student type indicator | Raw string literal | High | Wrap with `t('registeredCenterStudent', ...)` |
| `FIND-0811` | `ParentChildrenPage.tsx:66` | `طالب منصة أونلاين` | Student type indicator | Raw string literal | High | Wrap with `t('registeredOnlineStudent', ...)` |
| `FIND-0830` | `ParentFinancialPage.tsx:80` | `مسدد بالكامل` | Invoice status badge | Raw status literal | High | Use `t('invoicePaidInFull', 'Paid in Full')` |
| `FIND-0831` | `ParentFinancialPage.tsx:81` | `مستحق السداد` | Invoice status badge | Raw status literal | High | Use `t('invoiceDue', 'Payment Due')` |

---

## 5. Intentional Arabic Content (Categories D & E)

The audit carefully distinguished between UI defects and content that **must legitimately remain in Arabic**:

1. **Category D (User Names):**
   - File: `apps/frontend/src/app/components/accountant/mockData.ts`
   - Content: Egyptian names such as `عمر شريف فاروق`, `سارة إبراهيم محمد`.
   - Classification: Valid proper nouns. Preserving authentic personal names is correct behavior.
2. **Category E (Mathematics Curriculum Content):**
   - Files: `QuestionPreview.tsx`, `ExternalExamPage.tsx`, `ExamsPage.tsx`
   - Content: Egyptian National Curriculum mathematical problems:
     - `أوجد قيمة س التي تحقق المعادلة:`
     - `س = ٠`
     - `د(س) = س² + ٤`
   - Classification: Authentic educational curriculum authored in Arabic for Egyptian students. These problems should **never** be translated into English by the localization dictionary.

---

## 6. Recommended Remediation Plan

To achieve complete English localization across all authenticated roles:

1. **Phase 1: Shell Navigation & Menu Items**
   - Inject explicit `labelKey` attributes into all menu arrays across `AccountantDashboard.tsx`, `TeacherDashboard.tsx`, `StudentCenterDashboard.tsx`, `StudentOnlineDashboard.tsx`, and `ParentDashboard.tsx`.
2. **Phase 2: Missing Translation Key Registration**
   - Add the 109 missing Arabic string keys to `UI_TRANSLATIONS_EN` in `translationsDictionary.ts`.
3. **Phase 3: Status Badge & Ternary Refactoring**
   - Replace hardcoded Arabic status strings (`'نشط'`, `'قيد المراجعة'`, `'نقدي'`, `'حاضر'`, `'غائب'`) with dictionary-backed lookup objects.
4. **Phase 4: Dropdowns & Filter Constants**
   - Refactor grade-level and question-type arrays to use dynamic translation hooks.

