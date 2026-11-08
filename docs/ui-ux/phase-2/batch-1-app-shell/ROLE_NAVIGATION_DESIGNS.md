# OX-DIGITAL Education — UI/UX Phase 2 (Batch 1)
# Document 2: Role-Based Navigation Specifications
**Document ID:** `ROLE_NAVIGATION_DESIGNS`  
**Status:** ALIGNED & COMPLETE — READY FOR PRODUCT OWNER ACCEPTANCE  
**Date:** 2026-11-03  
**Workspace:** `D:\OX-DIGITAL\Mathe\OX-DIGITAL-GITHUB`  
**Classification:** Navigation Architecture & Role Security Specification  

> [!NOTE] Demonstration Data Policy
> All persona names, email addresses, financial figures, transaction counts, and branch titles in this document and accompanying mockups are **SYNTHETIC DEMONSTRATION DATA (DEMO DATA — NOT REAL)**.

---

## 1. Executive Role Architecture & Product Owner Alignment

In strict alignment with the Product Owner's authoritative decision, the accounting UI/UX architecture establishes a streamlined institutional role hierarchy:

### Fundamental Governance & Role Principles
1. **No Independent Cashier Role:** There is **NO independent Cashier role, Cashier Dashboard, or Cashier navigation shell** in the accounting UI/UX design. Cashbox operations and frontline fee collections are integrated directly into the **Primary Manager** and **Accountant** interfaces.
2. **Exactly Three Roles in Accounting Scope:**
   - `PRIMARY_MANAGER`: Executive governance, approvals, cashbox management, collections oversight, cashbox transfers, daily reconciliation & discrepancy review, expense approvals, and financial reports.
   - `ACCOUNTANT`: Dedicated Accountant Dashboard, student accounts and balances, recording collections and issuing receipts (subject to permissions), expense recording, preparing teacher dues, daily cashbox reconciliation, and preliminary financial reports.
   - `TEACHER`: **Extension of the existing platform Teacher interface** with approved educational delivery evidence and personal approved dues history.
3. **Preservation of Existing Platform Roles:** This accounting design does not replace existing platform roles (`ADMIN`, `ONLINE_STUDENT`, `CENTER_STUDENT`, `PARENT`) or student-facing navigation.
4. **Strict Maker-Checker Segregation:**
   - The Accountant prepares eligible transactions (vouchers, reconciliations, dues drafts).
   - The Primary Manager authorizes transactions requiring approval (discrepancy resolutions, payouts).
   - The Accountant cannot approve their own posted entries.
5. **Prohibited Branch Manager Role (`OD-701`):** No generic "Branch Manager" role exists in any menu, route, or permission check.
6. **Platform Super-Admin Isolation (`OD-718`):** The SaaS platform administrator (`admin@edu.com`) operates in an isolated management back-office outside institutional tenant shells.

---

## 2. Configuration A: Primary Manager Navigation (`PRIMARY_MANAGER`)

### 2.1 Persona Overview & Capabilities
- **Role Identity:** Executive Director / Managing Partner.
- **Scope:** Institution-wide, multi-branch consolidated oversight with full cross-branch drill-down.
- **Cashbox & Accounting Capabilities:**
  - Full cashbox management and register oversight.
  - Collections and receipts monitoring across all tills.
  - Cashbox transfer approvals and liquidity balancing.
  - Daily closing reconciliation and discrepancy review under `UP-705`.
  - Operational expense authorization and dual-approval vouchers.
  - Comprehensive earned revenue, dues aging, and audit reports.

### 2.2 Navigation Tree & Screen Mapping
```text
+---------------------------------------------------------------------------------------------------------+
| PRIMARY MANAGER SIDEBAR STRUCTURE (Expanded: 260px)                                                     |
+---------------------------------------------------------------------------------------------------------+
| [HEADER]                                                                                                |
|   🏛️ أكاديمية أوكس الرقمية (INST-01) [DEMO DATA]                                                        |
|   👤 د. طارق عبد الرحمن • مدير رئيسي (المقر الرئيسي) [DEMO]                                             |
|                                                                                                         |
| SECTION 1: الإشراف والحوكمة التنفيذية (Executive Governance)                                            |
|   ├── [Icon: LayoutDashboard] لوحة القيادة التنفيذية ............ `PM-DASH-01` (المسار: /manager)      |
|   ├── [Icon: Building2] أداء وفروع المؤسسة ..................... `PM-BR-01`   (المسار: /manager/branches)|
|   └── [Icon: ShieldCheck] مركز الموافقات والاعتمادات .......... `PM-APPR-01` (المسار: /manager/approvals)|
|       └── [Badge: 3 معلق [DEMO]] (اعتماد سندات صرف، تسويات معلمين، فوارق جرد)                           |
|                                                                                                         |
| SECTION 2: إدارة الخزائن والمقبوضات (Cashboxes & Collections Oversight)                                |
|   ├── [Icon: Vault] إدارة الخزائن المركزية .................... `CB-LIST-01`  (المسار: /manager/cashbox)|
|   ├── [Icon: Receipt] رقابة المقبوضات والإيصالات .............. `PM-REC-01`   (المسار: /manager/receipts)|
|   ├── [Icon: ArrowLeftRight] تحويلات الخزائن والسيولة ......... `CB-XFER-01`  (المسار: /manager/transfers)|
|   ├── [Icon: AlertOctagon] مراجعة مطابقات وفوارق الجرد (UP-705) `CB-DISC-01`  (المسار: /manager/closing)|
|   └── [Icon: FileCheck] اعتماد سندات المصروفات ................ `EXP-LIST-01` (المسار: /manager/expenses)|
|                                                                                                         |
| SECTION 3: الشؤون الأكاديمية والطلاب (Academic Operations)                                              |
|   ├── [Icon: GraduationCap] دليل الطلاب والاتفاقيات ............ `STU-DIR-01`  (المسار: /students)      |
|   ├── [Icon: Users] المجموعات والفصول الدراسية ................ `GRP-LIST-01` (المسار: /groups)        |
|   ├── [Icon: AlertTriangle] مؤشرات مخاطر الطلاب (Risk Engine) .. `RISK-01`    (المسار: /analytics/risk) |
|   └── [Icon: UserCheck] هيئة التدريس والمحاضرين ................ `TCH-DIR-01`  (المسار: /teachers)      |
|                                                                                                         |
| SECTION 4: التقارير والتدقيق النظامي (Auditing & Financial Reports)                                     |
|   ├── [Icon: TrendingUp] تقرير الإيراد التعليمي المستحق ....... `REP-EARN-01` (المسار: /reports/earned) |
|   ├── [Icon: Banknote] إجمالي مقبوضات الفروع .................. `REP-COL-01`  (المسار: /reports/collect)|
|   ├── [Icon: ClockAlert] تقرير أعمار الديون والذمم ............. `REP-DUE-01`  (المسار: /reports/dues)   |
|   └── [Icon: History] سجل التدقيق الشامل (Audit Trail) ........ `AUDIT-01`    (المسار: /audit)          |
|                                                                                                         |
| [FOOTER UTILITIES]                                                                                      |
|   ├── [Icon: Settings] إعدادات المؤسسة والفروع ................. `PM-SETT-01` (المسار: /settings)       |
|   └── [Icon: LogOut] تسجيل الخروج الآمن                                                                 |
+---------------------------------------------------------------------------------------------------------+
```

---

## 3. Configuration B: Accountant Navigation (`ACCOUNTANT`)

### 3.1 Persona Overview & Capabilities
- **Role Identity:** Center Chief Accountant / Financial Officer.
- **Scope:** Branch-assigned operational and general ledger accounting.
- **Cashbox & Collection Capabilities:**
  - Dedicated Accountant Dashboard (`ACC-DASH-01`).
  - Student financial sub-ledgers and outstanding fee balances (`ACC-STU-01`).
  - Recording frontline collections and issuing official receipts (`ACC-REC-NEW` / `CSH-DESK-01`).
  - Managing collection receipts register (`ACC-REC-01`).
  - Sub-ledger collection allocation engine (`ACC-ALLOC-01`).
  - Compensating reversals desk (`ACC-REV-01`).
  - Recording operating expenses and voucher attachments (`EXP-NEW-01`).
  - Preparing teacher dues settlement statements (`TCOMP-PREP-01`).
  - Daily cashbox reconciliation closing under `UP-705` (`CB-RECON-01`).
  - Executing inter-cashbox transfers (`CB-XFER-01`).
  - General ledger journal explorer (`ACC-GL-01`) and preliminary financial reports (`REP-COL-01`).
- **Maker-Checker Boundary:**
  - Prepares financial records, expenses, and reconciliation files.
  - Cannot approve their own posted entries or clear discrepancy investigations.

### 3.2 Navigation Tree & Screen Mapping
```text
+---------------------------------------------------------------------------------------------------------+
| ACCOUNTANT SIDEBAR STRUCTURE (Expanded: 260px)                                                          |
+---------------------------------------------------------------------------------------------------------+
| [HEADER]                                                                                                |
|   🏛️ فرع القاهرة الرئيسي (BR-01) [DEMO DATA]                                                            |
|   👤 أ. نادية حسن • محاسب الفرع [DEMO]                                                                  |
|                                                                                                         |
| SECTION 1: التحصيل وحسابات الطلاب (Collections & Student Accounts)                                      |
|   ├── [Icon: LayoutDashboard] لوحة العمليات المالية ........... `ACC-DASH-01` (المسار: /accountant)     |
|   ├── [Icon: Banknote] تسجيل المقبوضات وإصدار الإيصالات ....... `ACC-REC-NEW` (المسار: /collections/new)|
|   ├── [Icon: ReceiptText] سجل إيصالات القبض اليومية ........... `ACC-REC-01`  (المسار: /receipts)       |
|   ├── [Icon: Contact] حسابات الطلاب والأرصدة المستحقة ......... `ACC-STU-01`  (المسار: /subledgers)     |
|   ├── [Icon: Split] محرك تخصيص المقبوضات (Allocation Engine) .. `ACC-ALLOC-01`(المسار: /allocations)    |
|   └── [Icon: RotateCcw] مكتب حركات التسوية العكسية ............ `ACC-REV-01`   (المسار: /reversals)     |
|                                                                                                         |
| SECTION 2: الخزائن والمصروفات اليومية (Cashboxes, Reconciliations & Expenses)                           |
|   ├── [Icon: CalendarCheck] مطابقة وإقفال النقدية اليومية (UP-705) `CB-RECON-01` (المسار: /cashboxes/recon)|
|   ├── [Icon: Vault] الخزائن النقدية بالفرع .................... `CB-LIST-01`  (المسار: /cashboxes)      |
|   ├── [Icon: ArrowLeftRight] تحويل نقدية بين الخزائن .......... `CB-XFER-01`  (المسار: /cashboxes/trans)|
|   ├── [Icon: FilePlus2] تسجيل سندات المصروفات والنثريات ....... `EXP-NEW-01`   (المسار: /expenses/new)  |
|   └── [Icon: FileCheck2] إعداد تسويات مستحقات المعلمين ........ `TCOMP-PREP-01`(المسار: /teachers/prep)|
|                                                                                                         |
| SECTION 3: القيود والتقارير الأولية (Ledgers & Preliminary Reporting)                                   |
|   ├── [Icon: BookOpen] مستعرض القيود المحاسبية (GL Explorer) .. `ACC-GL-01`   (المسار: /journal)        |
|   └── [Icon: FileBarChart] التقارير المالية الأولية ........... `REP-COL-01`  (المسار: /reports/prelim) |
+---------------------------------------------------------------------------------------------------------+
```

---

## 4. Configuration C: Extended Teacher Interface (`TEACHER`)

### 4.1 Persona Overview & Capabilities
- **Role Identity:** Classroom Teacher / Academic Instructor.
- **Architecture Baseline:** **Extension of the existing Teacher interface** (`TeacherDashboard.tsx`, `TeacherHomePage.tsx`, `TeacherCoursesPage.tsx`, `TeacherAttendancePage.tsx`).
- **Core Principle:** Does NOT create a separate dashboard or separate menu. Extends existing teacher navigation with accounting-adjacent educational proof and compensation review capabilities.
- **Approved Capabilities Added:**
  - Lesson delivery evidence submission and attendance rosters (`TCH-EVID-01`).
  - Approved educational lessons and student group rosters.
  - Teacher's personal approved completed lessons and payment history (`TCH-DUES-01`).
- **Policy Boundary on Compensation (`UP-704`):**
  - Displays verified physical delivery units (completed lessons, attendance counts).
  - Any financial payout figure remains strictly subject to unresolved policy `UP-704`. Zero unapproved calculation formulas are implied.
- **Strict Privacy & Isolation:**
  - Teachers have **zero access** to institution-wide financial books, general ledgers, cashboxes, or other students' financial commitments.

### 4.2 Extended Teacher Navigation Tree
```text
+---------------------------------------------------------------------------------------------------------+
| EXTENDED TEACHER SIDEBAR STRUCTURE (Expanded: 260px)                                                    |
+---------------------------------------------------------------------------------------------------------+
| [HEADER]                                                                                                |
|   🏛️ أكاديمية أوكس الرقمية [DEMO DATA]                                                                  |
|   👤 أ. أيمن منصور • معلم فيزياء [DEMO]                                                                 |
|                                                                                                         |
| SECTION 1: الجدول الدراسي والحصص (Existing Academic Portal Modules)                                     |
|   ├── [Icon: LayoutDashboard] لوحة الحصص والمجموعات (الرئيسية) . `TCH-DASH-01` (المسار: /teacher)       |
|   ├── [Icon: CalendarDays] جدول مواعيد الحصص الأسبوعي ......... `TCH-SCHED-01`(المسار: /teacher/sched)  |
|   ├── [Icon: UsersRound] قائمة طلاب المجموعات ................. `TCH-STU-01`   (المسار: /teacher/students)|
|   └── [Icon: ClipboardCheck] تسجيل الحضور والامتحانات ......... `TCH-ATT-01`   (المسار: /teacher/attendance)|
|                                                                                                         |
| SECTION 2: القدرات المالية الممتدة للمعلم (Extended Accounting-Adjacent Capabilities)                    |
|   ├── [Icon: CheckCircle2] إثبات تقديم الحصص وإصدار الشهادات .. `TCH-EVID-01` (المسار: /teacher/evidence)|
|   └── [Icon: WalletCards] بيان الحصص المعتمدة وسجل الدفعات .... `TCH-DUES-01` (المسار: /teacher/dues)    |
|       └── [Policy Note under UP-704: يعرض عدد الحصص المنفذة المعتمدة؛ سياسة الاحتساب قيد حسم السياسة]    |
|                                                                                                         |
| [SECURITY NOTICE]                                                                                       |
|   🔒 لا يملك المعلم صلاحية الاطلاع على حسابات المؤسسة المالية أو ذمم الطلاب المالية الأخرى             |
+---------------------------------------------------------------------------------------------------------+
```

---

## 5. Route & Permission Mapping Matrix

| Route Path | Associated Screen ID | Allowed Roles | Prohibited Roles (Redirect to `/unauthorized`) |
| :--- | :--- | :--- | :--- |
| `/manager/*` | `PM-DASH-01`, `PM-BR-01`, `PM-APPR-01`, `CB-LIST-01`, `PM-REC-01`, `EXP-LIST-01` | `PRIMARY_MANAGER` only | `ACCOUNTANT`, `TEACHER` |
| `/accountant/*` | `ACC-DASH-01`, `ACC-STU-01`, `ACC-ALLOC-01`, `ACC-REV-01`, `ACC-GL-01` | `ACCOUNTANT`, `PRIMARY_MANAGER` (Read-only) | `TEACHER` |
| `/collections/new` | `ACC-REC-NEW` (Formerly `CSH-DESK-01`) | `ACCOUNTANT`, `PRIMARY_MANAGER` | `TEACHER` |
| `/cashboxes/*` | `CB-LIST-01`, `CB-RECON-01`, `CB-XFER-01` | `ACCOUNTANT`, `PRIMARY_MANAGER` | `TEACHER` |
| `/expenses/*` | `EXP-LIST-01`, `EXP-NEW-01` | `ACCOUNTANT`, `PRIMARY_MANAGER` | `TEACHER` |
| `/teacher/*` | `TCH-DASH-01`, `TCH-EVID-01`, `TCH-DUES-01` | `TEACHER` | `ACCOUNTANT` (Academic modules read-only) |
| `/audit/*` | `AUDIT-01` | `PRIMARY_MANAGER` only | `ACCOUNTANT`, `TEACHER` |
| `/super-admin/*` | N/A (Platform Admin) | None inside tenant shell (`admin@edu.com` operates outside) | All institution roles |
