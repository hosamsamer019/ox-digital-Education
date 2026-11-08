import {
  BranchScopeOption,
  FinancialKpis,
  BranchPerformance,
  ApprovalQueueItem,
  AuditedFinancialMovement,
  TeamMember
} from './types';

export const BRANCH_SCOPES: BranchScopeOption[] = [
  {
    id: 'INST-CONSOLIDATED',
    name: 'المركز بالكامل (عرض موحد - شامل الفروع)',
    code: 'INST-01',
    type: 'CONSOLIDATED',
    isPhysical: true,
    statusText: 'عرض موحد لكافة الفروع التشغيلية'
  },
  {
    id: 'BR-01',
    name: 'فرع الدقي (المقر الرئيسي)',
    code: 'BR-01',
    type: 'PHYSICAL',
    isPhysical: true,
    statusText: 'حضوري - تشغيل نشط'
  },
  {
    id: 'BR-02',
    name: 'فرع مدينة نصر',
    code: 'BR-02',
    type: 'PHYSICAL',
    isPhysical: true,
    statusText: 'حضوري - تشغيل نشط'
  },
  {
    id: 'BR-ONLINE',
    name: 'الفرع الأونلاين (المنصة الرقمية)',
    code: 'BR-ONLINE',
    type: 'ONLINE',
    isPhysical: false,
    statusText: 'مؤجل — خارج النطاق المالي الحالي'
  }
];

export const KPIS_BY_SCOPE: Record<string, FinancialKpis> = {
  'INST-CONSOLIDATED': {
    actualCollections: 110500,
    collectionsToday: 12400,
    overdueReceivables: 39700,
    criticalOverdue: 14000,
    cashboxLiquidity: 86400,
    activeCashboxesCount: 4,
    recognizedRevenue: 93000,
    certifiedLessonsCount: 620
  },
  'BR-01': {
    actualCollections: 62000,
    collectionsToday: 7600,
    overdueReceivables: 18200,
    criticalOverdue: 6000,
    cashboxLiquidity: 68400,
    activeCashboxesCount: 3,
    recognizedRevenue: 52000,
    certifiedLessonsCount: 345
  },
  'BR-02': {
    actualCollections: 48500,
    collectionsToday: 4800,
    overdueReceivables: 21500,
    criticalOverdue: 8000,
    cashboxLiquidity: 18000,
    activeCashboxesCount: 1,
    recognizedRevenue: 41000,
    certifiedLessonsCount: 275
  },
  'BR-ONLINE': {
    actualCollections: 0,
    collectionsToday: 0,
    overdueReceivables: 0,
    criticalOverdue: 0,
    cashboxLiquidity: 0,
    activeCashboxesCount: 0,
    recognizedRevenue: 0,
    certifiedLessonsCount: 0
  }
};

export const BRANCH_PERFORMANCE_LIST: BranchPerformance[] = [
  {
    id: 'BR-01',
    code: 'BR-01',
    name: 'فرع الدقي (الرئيسي)',
    isPhysical: true,
    isHeadquarters: true,
    status: 'ACTIVE',
    statusLabel: 'نشط - حضوري',
    collections: 62000,
    cashboxBalance: 68400,
    recognizedRevenue: 52000,
    overdueReceivables: 18200,
    closingStatus: 'BALANCED',
    closingStatusLabel: 'مطابقة تامة [تم الإغلاق]',
    tillsCount: 3
  },
  {
    id: 'BR-02',
    code: 'BR-02',
    name: 'فرع مدينة نصر',
    isPhysical: true,
    status: 'ACTIVE',
    statusLabel: 'نشط - حضوري',
    collections: 48500,
    cashboxBalance: 18000,
    recognizedRevenue: 41000,
    overdueReceivables: 21500,
    closingStatus: 'DISCREPANCY_INVESTIGATION',
    closingStatusLabel: 'يوجد فرق عجز قيد التحقيق (UP-705)',
    discrepancyAmount: -150,
    tillsCount: 1
  },
  {
    id: 'BR-ONLINE',
    code: 'BR-ONLINE',
    name: 'الفرع الأونلاين - منصة التعليم',
    isPhysical: false,
    status: 'DEFERRED',
    statusLabel: 'مؤجل — خارج النطاق المالي (حضوري أولاً)',
    collections: null,
    cashboxBalance: null,
    recognizedRevenue: null,
    overdueReceivables: null,
    closingStatus: 'NOT_APPLICABLE',
    closingStatusLabel: 'غير منطبق - لا توجد خزائن نقدية',
    tillsCount: 0
  }
];

export const INITIAL_APPROVAL_QUEUE: ApprovalQueueItem[] = [
  {
    id: 'appr-01',
    referenceNumber: 'EXP-1049',
    type: 'EXPENSE_VOUCHER',
    title: 'سند صرف نثريات: صيانة معامل وشبكات الحاسب',
    branchName: 'فرع الدقي (الرئيسي)',
    branchId: 'BR-01',
    amount: 2500,
    submittedBy: 'أ. طارق سمير (محاسب الفرع)',
    submittedAt: 'اليوم، 11:30 ص',
    justification: 'إصلاح راوتر القاعة المركزية واستبدال كابلات شبكة معمل الاختبارات',
    supportingDocuments: ['فاتورة شركة النيل للتوريدات #4881', 'تقرير الفني مهندس إبراهيم'],
    status: 'SUBMITTED'
  },
  {
    id: 'appr-02',
    referenceNumber: 'REC-882',
    type: 'CASHBOX_DISCREPANCY',
    title: 'محضر جرد وإغلاق خزينة كاشير 1 (عجز نقدي)',
    branchName: 'فرع مدينة نصر',
    branchId: 'BR-02',
    amount: -150,
    submittedBy: 'أ. كمال إبراهيم (رئيس الحسابات)',
    submittedAt: 'اليوم، 01:15 م',
    justification: 'عجز بالعد الفعلي لخزينة كاشير 1 بمقدار 150.00 ج.م يتطلب تحقيقاً محايداً دون تسوية تلقائية',
    supportingDocuments: ['شيت الجرد المطبوع', 'تقرير الكاشير أ. هاني عبد الله'],
    status: 'UNDER_INVESTIGATION',
    policyReference: 'UP-705 (سياسة فوارق الخزائن المحايدة)'
  },
  {
    id: 'appr-03',
    referenceNumber: 'ADJ-044',
    type: 'STUDENT_DISCOUNT',
    title: 'طلب خصم استثنائي وتعديل اتفاقية سداد',
    branchName: 'فرع الدقي (الرئيسي)',
    branchId: 'BR-01',
    amount: 500,
    submittedBy: 'أ. منى زكي (مسؤولة التسجيل)',
    submittedAt: 'أمس، 04:20 م',
    justification: 'منحة تفوق دراسي للطالب أحمد سمير علي بموجب شهادة التميز بالمدرسة الثانوية',
    supportingDocuments: ['شهادة تفوق معتمدة', 'موافقة المشرف الأكاديمي'],
    status: 'SUBMITTED'
  },
  {
    id: 'appr-04',
    referenceNumber: 'TCH-102',
    type: 'TEACHER_SETTLEMENT',
    title: 'تسوية عدد 14 حصة معتمدة للمحاضر أ. وليد زهران',
    branchName: 'فرع الدقي (الرئيسي)',
    branchId: 'BR-01',
    amount: 0,
    submittedBy: 'المشرف الأكاديمي د. عادل مرسي',
    submittedAt: 'اليوم، 09:00 ص',
    justification: 'اعتماد تنفيذ الحصص الحضورية المكتملة وتوثيق الحضور. القيمة المالية في انتظار اعتماد لائحة الأجور',
    supportingDocuments: ['دفتر الحضور الإلكتروني المعملي', 'توقيع المشرف الأكاديمي'],
    status: 'SUBMITTED',
    policyReference: 'UP-704 (في انتظار اعتماد لائحة أجور المعلمين)'
  }
];

export const AUDITED_MOVEMENTS: AuditedFinancialMovement[] = [
  {
    id: 'mov-01',
    receiptNumber: '#REC-9821',
    partyName: 'عمر شريف فاروق',
    movementType: 'COLLECTION',
    movementTypeLabel: 'تحصيل قسط دراسي',
    amount: 750,
    paymentMethod: 'CASH',
    paymentMethodLabel: 'نقدي (كاشير 1)',
    cashboxCode: 'CB-01',
    branchName: 'فرع الدقي',
    branchId: 'BR-01',
    cashierName: 'أ. محمود حمدي',
    timestamp: 'منذ 15 دقيقة',
    status: 'POSTED_AND_ROUTED',
    statusLabel: 'معتمد ومرحل للخزينة',
    notes: 'سداد دفعة شهر نوفمبر لمجموعة الصف الثالث الثانوي'
  },
  {
    id: 'mov-02',
    receiptNumber: '#REC-9820',
    partyName: 'مريم خالد السعدني',
    movementType: 'COLLECTION',
    movementTypeLabel: 'رسوم حجز وبطاقة طالب',
    amount: 1200,
    paymentMethod: 'POS_CARD',
    paymentMethodLabel: 'كارت فيزا POS',
    cashboxCode: 'CB-02',
    branchName: 'فرع مدينة نصر',
    branchId: 'BR-02',
    cashierName: 'أ. هاني عبد الله',
    timestamp: 'منذ 42 دقيقة',
    status: 'POSTED_AND_ROUTED',
    statusLabel: 'معتمد ومرحل للخزينة',
    notes: 'إيصال ماكينة بنك مصر #74921 - حساب السنتر'
  },
  {
    id: 'mov-03',
    receiptNumber: '#XFER-041',
    partyName: 'الخزينة الرئيسية (CB-MAIN)',
    movementType: 'TRANSFER',
    movementTypeLabel: 'تحويل سيولة نقدية داخلي',
    amount: 5000,
    paymentMethod: 'INTERNAL_TRANSFER',
    paymentMethodLabel: 'تحويل نقدية بين الخزائن',
    cashboxCode: 'CB-01 -> CB-MAIN',
    branchName: 'فرع الدقي',
    branchId: 'BR-01',
    cashierName: 'أ. محمود حمدي -> أ. كمال إبراهيم',
    timestamp: 'اليوم، 12:10 م',
    status: 'BALANCED_TRANSFER',
    statusLabel: 'تم التحويل المتوازن (OK)',
    notes: 'تخفيض سيولة كاشير الاستقبال وترحيل الفائض للخزينة الحديدية'
  },
  {
    id: 'mov-04',
    receiptNumber: '#REC-9818',
    partyName: 'سارة محمود عثمان',
    movementType: 'COLLECTION',
    movementTypeLabel: 'سداد دفعة شهرية',
    amount: 600,
    paymentMethod: 'CASH',
    paymentMethodLabel: 'نقدي (كاشير 1)',
    cashboxCode: 'CB-01',
    branchName: 'فرع الدقي',
    branchId: 'BR-01',
    cashierName: 'أ. محمود حمدي',
    timestamp: 'اليوم، 11:45 ص',
    status: 'POSTED_AND_ROUTED',
    statusLabel: 'معتمد ومرحل للخزينة',
    notes: 'سداد دفعة الكورس المكثف لمادة الرياضيات'
  },
  {
    id: 'mov-05',
    receiptNumber: '#EXP-1048',
    partyName: 'مكتبة الفيروز للطباعة',
    movementType: 'EXPENSE',
    movementTypeLabel: 'صرف نثريات طباعة وتصوير',
    amount: 1850,
    paymentMethod: 'CASH',
    paymentMethodLabel: 'سحب من الخزينة الفرعية',
    cashboxCode: 'CB-03',
    branchName: 'فرع مدينة نصر',
    branchId: 'BR-02',
    cashierName: 'أ. هاني عبد الله',
    timestamp: 'اليوم، 10:20 ص',
    status: 'AUTHORIZED_EXPENSE',
    statusLabel: 'معتمد ومسجل بسند صرف',
    notes: 'طباعة كراسات التمارين الأسبوعية لطلاب الشهادة الإعدادية'
  },
  {
    id: 'mov-06',
    receiptNumber: '#REC-9815',
    partyName: 'يوسف أحمد إبراهيم',
    movementType: 'COLLECTION',
    movementTypeLabel: 'سداد دفعة دورة تأسيس',
    amount: 1500,
    paymentMethod: 'CASH',
    paymentMethodLabel: 'نقدي (كاشير 1)',
    cashboxCode: 'CB-01',
    branchName: 'فرع الدقي',
    branchId: 'BR-01',
    cashierName: 'أ. محمود حمدي',
    timestamp: 'اليوم، 09:35 ص',
    status: 'POSTED_AND_ROUTED',
    statusLabel: 'معتمد ومرحل للخزينة',
    notes: 'سداد مقدم البرنامج الشامل للفرعين'
  },
  {
    id: 'mov-07',
    receiptNumber: '#REC-9812',
    partyName: 'سلمى علي رضوان',
    movementType: 'COLLECTION',
    movementTypeLabel: 'اشتراك فصل تدريبي',
    amount: 900,
    paymentMethod: 'POS_CARD',
    paymentMethodLabel: 'كارت ميزة POS',
    cashboxCode: 'CB-02',
    branchName: 'فرع الدقي',
    branchId: 'BR-01',
    cashierName: 'أ. طارق سمير',
    timestamp: 'أمس، 07:15 م',
    status: 'POSTED_AND_ROUTED',
    statusLabel: 'معتمد ومرحل للخزينة',
    notes: 'إيصال الدفع الإلكتروني #44102'
  }
];

export const INITIAL_TEAM_MEMBERS: TeamMember[] = [
  {
    id: 'tm-001',
    name: 'أ. د. سامر خليل',
    email: 'primary.manager@cma-academy.edu',
    role: 'PRIMARY_MANAGER',
    roleLabel: 'المدير الأساسي للمؤسسة',
    branchId: 'INST-CONSOLIDATED',
    branchName: 'المركز بالكامل (المقر الرئيسي)',
    status: 'ACTIVE',
    statusLabel: 'نشط',
    joinedAt: '2026-09-01'
  },
  {
    id: 'tm-002',
    name: 'أحمد محمود رضوان',
    email: 'ahmed.accountant@cma-academy.edu',
    role: 'ACCOUNTANT',
    roleLabel: 'محاسب الفرع',
    branchId: 'BR-01',
    branchName: 'فرع الدقي (المقر الرئيسي)',
    status: 'ACTIVE',
    statusLabel: 'نشط',
    joinedAt: '2026-09-15',
    invitedAt: '2026-09-10'
  },
  {
    id: 'tm-003',
    name: 'سارة عبد الرحمن حسن',
    email: 'sara.accountant@cma-academy.edu',
    role: 'ACCOUNTANT',
    roleLabel: 'محاسب الفرع',
    branchId: 'BR-02',
    branchName: 'فرع مدينة نصر',
    status: 'ACTIVE',
    statusLabel: 'نشط',
    joinedAt: '2026-10-01',
    invitedAt: '2026-09-25'
  },
  {
    id: 'tm-004',
    name: 'محمود كمال التوني',
    email: 'm.eltony@cma-academy.edu',
    role: 'ACCOUNTANT',
    roleLabel: 'محاسب فرع',
    branchId: 'BR-01',
    branchName: 'فرع الدقي (المقر الرئيسي)',
    status: 'PENDING_ACTIVATION',
    statusLabel: 'معلق بانتظار التفعيل',
    invitedAt: '2026-11-02'
  }
];

