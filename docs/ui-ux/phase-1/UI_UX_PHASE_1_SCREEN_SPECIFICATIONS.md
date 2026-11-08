# OX-DIGITAL Education — UI/UX Design Track — Phase 1
# Document 4: Screen Specifications & Wireframe Definitions
**Document ID:** `UI_UX_PHASE_1_SCREEN_SPECIFICATIONS`  
**Status:** COMPLETE — READY FOR PRODUCT OWNER REVIEW  
**Date:** 2026-11-03  
**Workspace:** `D:\OX-DIGITAL\Mathe\OX-DIGITAL-GITHUB`  
**Classification:** Wireframe Specifications & Component Layouts  

---

## 1. Specification Methodology

Each screen specification defines:
1. **Screen Header & Context:** Title, subtitle, breadcrumb, active permissions, and route.
2. **Visual Wireframe Layout:** Conceptual ASCII structure of screen elements.
3. **Component Hierarchy:** Breakdown of cards, tables, modals, and drawers.
4. **Data Elements & Form Fields:** Field labels (Arabic/English), types, constraints, and defaults.
5. **Operational States:**
   - *Default / Populated State*
   - *Loading State (Skeletons)*
   - *Empty State (Actionable Call to Action)*
   - *Error State (Actionable Recovery)*
6. **Validation & Interaction Rules:** Field-level checks, debounce, and fail-closed behaviors.
7. **Responsive Adaptations:** Desktop (1440px+), Tablet (768px–1024px), Mobile (<768px).

---

## 2. Core Screen Specifications

### 2.1 Primary Manager Executive Hub (`PM-DASH-01`)

#### Overview
- **Route:** `/manager/dashboard`
- **Persona:** `PRIMARY_MANAGER`
- **Purpose:** Provide an authoritative executive snapshot of operational and financial health across all campus branches without unverified forecasts.

#### Wireframe Layout
```text
+---------------------------------------------------------------------------------------------------------+
| [Header] OX-DIGITAL | Branch: [All Branches v] | Role: [Primary Manager]         (Theme) (Lang) [Avatar]|
+---------------------------------------------------------------------------------------------------------+
| [Sidebar]    | Breadcrumbs: الرئيسية > لوحة المؤشرات التنفيذية                                          |
|  - Dashboard |-----------------------------------------------------------------------------------------|
|  - Branches  | [KPI 1: المقبوضات الفعلية]  [KPI 2: الذمم المستحقة] [KPI 3: رصيد الخزائن]  [KPI 4: معلقات]|
|  - Approvals |   142,500.00 ج.م            48,200.00 ج.م          86,400.00 ج.م           3 طلبات اعتمـاد |
|  - Cashboxes |   اليوم: 12,400 ج.م         متأخر: 14,000 ج.م      4 خزائن نشطة           2 فوارق خزينة   |
|  - Staff     |-----------------------------------------------------------------------------------------|
|  - Reports   | [Section A: أداء الفروع الحية (Branch Cards)]                                          |
|              | +-----------------------------+ +-----------------------------+                         |
|              | | فرع القاهرة (رئيسي)          | | فرع الإسكندرية (أكاديمي)     |                         |
|              | | رصيد الخزائن: 62,000.00 ج.م    | | رصيد الخزائن: 24,400.00 ج.م    |                         |
|              | | مقبوضات اليوم: 8,500.00 ج.م    | | مقبوضات اليوم: 3,900.00 ج.م    |                         |
|              | | إقفال اليومية: متطابق [OK]   | | إقفال اليومية: قيد التحقيق [!] |                         |
|              | +-----------------------------+ +-----------------------------+                         |
|              |-----------------------------------------------------------------------------------------|
|              | [Section B: قائمة الموافقات المعلقة]       | [Section C: آخر الحركات المالية الموثقة]    |
|              | - طلب صرف: صيانة معامل (2,500 ج.م) [اعتماد] | - إيصال قبض #1042 - أحمد سمير (500 ج.م)     |
|              | - تسوية معلمين: شهر نوفمبر (18,000 ج.م)[مراجعة]| - إيصال قبض #1041 - مريم خالد (750 ج.م)  |
|              | - تحويل خزينة: الفرعي -> الرئيسي (5,000 ج.م) | - حركة مصروف #88 - أحبار ومطبوعات (320 ج.م) |
+---------------------------------------------------------------------------------------------------------+
```

#### Key Fields & Metrics
- **Actual Collections (المقبوضات الفعلية):** Strictly sum of verified `COLLECTION` receipts in EGP for selected period (no projections).
- **Outstanding Dues (الأرصدة المستحقة):** Sum of active student schedule items with `dueDate <= Today` and remaining balance > 0.
- **Cashbox Balance (السيولة النقدية بالخزائن):** Sum of `currentBalance` across all active physical cashboxes.
- **Pending Approvals Badge:** Count of unapproved expense vouchers, discrepancy investigations, and settlement statements.

#### Responsive Behavior
- **Desktop:** 4-column KPI grid, 2-column branch cards, split approval/activity lists.
- **Tablet:** 2-column KPI grid, stacked tables.
- **Mobile:** Single-column stacked cards, bottom navigation sheet for quick actions.

---

### 2.2 Cashier Rapid Collection Desk (`CSH-DESK-01`)

#### Overview
- **Route:** `/cashier/collect`
- **Persona:** `CASHIER`, `ACCOUNTANT`
- **Purpose:** Maximum efficiency, error-resistant collection terminal for physical center reception tills.

#### Wireframe Layout
```text
+---------------------------------------------------------------------------------------------------------+
| [Header] فرع القاهرة - نقطة تحصيل الاستقبال 1 | الرصيد الحالي للخزينة: 8,450.00 ج.م | الوردية: مفتوحة      |
+---------------------------------------------------------------------------------------------------------+
| [Step 1: البحث والتحقق من الطالب]                                                                       |
|  بحث بالاسم أو كود الطالب أو رقم الهاتف: [ 201099887766                      ] [ بحث السريع (Enter) ]   |
+---------------------------------------------------------------------------------------------------------+
| [Student Identity Verified Box]                                                                         |
|  الصورة: [Avatar] | اسم الطالب: عمر شريف فاروق (كود: STU-8821) | الصف: الثالث الثانوي | الفرع: القاهرة   |
|  المجموعة: مجموعة الفيزياء المتقدمة (أ. أيمن) | ولي الأمر: شريف فاروق (0100223344)                      |
+---------------------------------------------------------------------------------------------------------+
| [Step 2: بنود الاستحقاق الحالية للطالب (Pending Due Obligations)]                                       |
|  [x] الدفعة المستحقة 1: دفعة شهر نوفمبر (تاريخ الاستحقاق: 2026-11-01) ............ المطلوب: 500.00 ج.م    |
|  [ ] رسوم المذكرات والامتحانات الدورية ........................................... المطلوب: 150.00 ج.م    |
|  إجمالي المبلغ المحدد للتحصيل: [ 500.00 ج.م ]                                                           |
+---------------------------------------------------------------------------------------------------------+
| [Step 3: تسجيل الدفع الفعلي]                                                                            |
|  طريقة السداد: (*) نقداً (Cash)   ( ) بطاقة بنكية (POS Card)                                            |
|  المبلغ المدفوع فعلياً: [ 500.00      ] ج.م                                                               |
|  ملاحظات الإيصال: [ سداد نقدي بخزينة الاستقبال                               ]                           |
|                                                                                                         |
|  [ إلغاء الأمر (Esc) ]                        [ إصدار إيصال القبض وطباعة فورية (F9 / Submit) ]          |
+---------------------------------------------------------------------------------------------------------+
```

#### Field Specifications & Interaction Rules
1. **Search Input:** Debounced (300ms) search supporting student name, barcode student card, national ID, or phone number.
2. **Student Identity Box:** Instant display of student photo, current center group, and home branch. Rejects students belonging to other institutions.
3. **Obligation Checkbox List:** Displays active obligations with due dates. Cashier selects item(s) being paid; total automatically sums.
4. **Payment Method:** Strictly restricted to enabled physical payment methods: `CASH` or `POS_CARD`.
5. **Double-Click Defense:** Submit button is debounced and immediately disabled upon first click, passing idempotency keys to prevent duplicate collection receipts.
6. **Instant Print Dialog:** On success, immediately triggers silent / standard thermal slip printing (`STU-REC-01`).

---

### 2.3 Student Financial Profile (`STU-FIN-01`)

#### Overview
- **Route:** `/students/:id/financial`
- **Persona:** `ACCOUNTANT`, `PRIMARY_MANAGER`
- **Purpose:** Full transparency into student financial commitments, scheduled arrangements, actual receipts, and sub-ledger allocation audit trail.

#### Wireframe Layout
```text
+---------------------------------------------------------------------------------------------------------+
| الطالب: سارة محمود عبد العزيز (STU-1094) | الفرع: القاهرة | المجموعة: الكيمياء 2 | الحالة: منتظم [نشط]     |
+---------------------------------------------------------------------------------------------------------+
| [Financial Summary Cards]                                                                               |
|  [ سعر الاتفاقية الإجمالي ]   [ إجمالي المقبوضات المستلمة ]   [ المخصص للمستحقات ]   [ الرصيد المتبقي ]    |
|       1,000.00 ج.م                    600.00 ج.م                   400.00 ج.م              600.00 ج.م   |
|  خصم ممنوح: 0.00 ج.م          رصيد غير مخصص: 200.00 ج.م     حالة السداد: مسدد جزئياً                   |
+---------------------------------------------------------------------------------------------------------+
| [Tab Bar]: [ جدول السداد والمستحقات ]  |  [ سجل إيصالات القبض ]  |  [ تخصيص المقبوضات ]  |  [ القيود ]       |
+---------------------------------------------------------------------------------------------------------+
| [جدول السداد والمستحقات (Payment Schedule)]                                                             |
|  #  | البيان                 | تاريخ الاستحقاق | المبلغ المستحق | المسدد فعلياً | المتبقي    | الحالة     |
| --- | ---------------------- | --------------- | -------------- | ------------- | ---------- | ---------- |
| 1   | الدفعة الأولى (مقدم)   | 2026-10-01      | 500.00 ج.م     | 400.00 ج.م    | 100.00 ج.م | جزئي [!]   |
| 2   | الدفعة الثانية         | 2026-11-01      | 500.00 ج.م     | 0.00 ج.م      | 500.00 ج.م | معلق [ ]   |
+---------------------------------------------------------------------------------------------------------+
| [سجل إيصالات القبض (Collection Receipts)]                                                               |
|  رقم الإيصال | تاريخ الاستلام | طريقة السداد | المبلغ المحصل | الخزينة المودع بها | حالة التخصيص | إجراءات   |
|  REC-1092    | 2026-10-02    | نقداً        | 600.00 ج.م    | خزينة 1 (استقبال)   | مخصص جزئياً  | [عرض/طباعة]|
+---------------------------------------------------------------------------------------------------------+
| [سجل حركات التخصيص والأستاذ المساعد (Append-Only Allocation Log)]                                       |
|  تاريخ التخصيص | رقم الحركة | إيصال القبض | الالتزام المخصص له | المبلغ المخصص | الحالة  | تم بواسطة   |
|  2026-10-02    | AL-001     | REC-1092    | الدفعة الأولى      | 400.00 ج.م    | نشط     | محاسب 1     |
+---------------------------------------------------------------------------------------------------------+
```

#### Financial Nomenclature Invariants
- **Terminology:** Uses `جدول السداد` (Payment Schedule), `مستحق` (Due), `محصل` (Collected), `متبقي` (Remaining). The term "Installments" (أقساط) is **strictly forbidden**.
- **No Direct Edit/Delete:** Rows display immutable audit trails. Corrections are executed solely via `ACC-REV-01` (Compensating Reversals).
- **Branch Transfer Continuity:** If student transfers from Cairo to Alexandria, all historical Cairo receipts and allocations remain attributed to Cairo with historical ownership intact.

---

### 2.4 Multi-Cashbox Register & Daily Closing (`CB-LIST-01` & `CB-RECON-01`)

#### Overview
- **Route:** `/cashboxes` and `/cashboxes/:id/reconcile`
- **Persona:** `ACCOUNTANT`, `PRIMARY_MANAGER`
- **Purpose:** Manage multiple campus reception tills/safes, execute inter-cashbox transfers, and perform formal daily closing reconciliations.

#### Wireframe: Daily Closing Reconciliation Modal (`CB-RECON-01`)
```text
+---------------------------------------------------------------------------------------------------------+
| مطابقة وإقفال النقدية اليومية - خزينة الاستقبال الرئيسية (CB-CAIRO-01)                                    |
| التاريخ المحاسبي للتشغيل: [ 2026-11-03 ] | القائم بالإقفال: نادية حسن (محاسب)                           |
+---------------------------------------------------------------------------------------------------------+
| [1. معادلة رصيد الإقفال الدفتري المتوقع (Expected Closing Balance Equation)]                             |
|  (+) رصيد بداية اليوم (Opening Balance) ........................................  1,000.00 ج.م           |
|  (+) إجمالي المقبوضات المحصلة (Total Collections) ..............................  2,500.00 ج.م           |
|  (+) إجمالي التحويلات الواردة من خزائن أخرى (Incoming Transfers) ...............    500.00 ج.م           |
|  (-) إجمالي التحويلات الصادرة لخزائن أخرى (Outgoing Transfers) ...............  (1,000.00 ج.م)         |
|  (-) إجمالي المصروفات والنثريات المسددة (Total Expenses) ......................    (300.00 ج.م)         |
|  -----------------------------------------------------------------------------------------------------  |
|  (=) رصيد الإقفال الدفتري المتوقع (Expected Closing Balance) ....................  2,700.00 ج.م           |
+---------------------------------------------------------------------------------------------------------+
| [2. إثبات الجرد الفعلي للنقدية بالخزينة (Physical Cash Count Entry)]                                    |
|  الرصيد الفعلي المعدود بالخزينة (Actual Counted Closing Balance): [ 2,650.00      ] ج.م                  |
|                                                                                                         |
|  -----------------------------------------------------------------------------------------------------  |
|  الفارق المحاسبي المحتسب (Variance / Difference): [ -50.00 ج.م (عجز / Shortage) ]                        |
|  حالة الإقفال الناتجة: [ بانتظار التحقيق الإداري - DISCREPANCY_PENDING_INVESTIGATION ]                 |
+---------------------------------------------------------------------------------------------------------+
| [3. الملاحظات ومحضر الجرد]                                                                              |
|  سبب الفارق المبدئي: [ وجود عجز بقيمة 50 جنيه جاري مراجعة إيصالات الوردية المسائية                      ] |
|                                                                                                         |
|  [ إلغاء (Cancel) ]                            [ اعتماد وتثبيت إقفال اليومية (Confirm Daily Closing) ]   |
+---------------------------------------------------------------------------------------------------------+
```

#### Strict UP-705 Guards
- **Zero Automated Absorption:** The UI **never** offers buttons or options to "Write off shortage" or "Absorb discrepancy into income".
- **Zero Discrepancy Thresholds:** The UI strictly prohibits rules that auto-clear variances (e.g. "Ignore variances under 50 EGP").
- **Balance Continuity Check:** Day 2 opening balance is hard-locked to match Day 1 actual closing balance; mismatch throws an explicit continuity failure alert.

---

### 2.5 Center Expenses & Disbursements (`EXP-NEW-01`)

#### Overview
- **Route:** `/expenses/new`
- **Persona:** `ACCOUNTANT`
- **Purpose:** Record physical campus operational disbursements with mandatory supporting voucher documentation.

#### Key Form Fields
1. **Physical Branch:** Read-only bound to accountant's active branch.
2. **Disbursing Cashbox:** Selectable from active cashboxes having available balance >= expense amount.
3. **Physical Voucher Number (`voucherNumber`):** Required text string matching physical paper receipt slip.
4. **Expense Category:** `STATIONERY` (أدوات مكتبية), `MAINTENANCE` (صيانة وتجهيزات), `HOSPITALITY` (ضيافة), `UTILITIES` (خدمات ومرافق), `OTHER` (أخرى).
5. **Monetary Amount (`amount`):** Strictly positive decimal in EGP. Prevented from exceeding cashbox balance (no negative balances).
6. **Business Date:** YYYY-MM-DD.
7. **Supporting Document Upload:** File picker for scanned/photographed physical voucher.
8. **Justification / Reason:** Mandatory descriptive text.

