import {
  AccountantKpis,
  StudentSubLedger,
  ReceiptItem,
  ExpenseVoucher,
  CashboxTill,
  TransferRequestItem,
  ShiftReconciliationRecord,
  TeacherLessonEvidence
} from './types';

export const ACCOUNTANT_KPIS: AccountantKpis = {
  collectionsToday: 12400,
  collectionsTodayCount: 14,
  tillLiquidity: 38400,
  activeTillsCount: 2,
  overdueDues: 18200,
  overdueStudentsCount: 8,
  pendingVouchersAmount: 2500,
  pendingVouchersCount: 1,
  unallocatedCashPool: 750
};

export const INITIAL_STUDENTS_SUBLEDGERS: StudentSubLedger[] = [
  {
    id: 'stu-01',
    studentCode: 'STU-8821',
    fullName: 'عمر شريف فاروق',
    grade: 'الصف الثالث الثانوي',
    branchName: 'فرع الدقي (الرئيسي)',
    parentName: 'شريف فاروق محمد',
    parentPhone: '01002233441',
    agreementNumber: 'CONT-2026-089',
    agreementDate: '2026-09-01',
    totalAgreementValue: 6000,
    specialDiscount: 500,
    netAgreementValue: 5500,
    totalDuesUntilToday: 3000,
    totalCollected: 2500,
    remainingPayable: 500,
    unallocatedPrepayment: 0,
    recognizedRevenue: 2000,
    certifiedLessonsCount: 4,
    status: 'PAYMENT_PENDING',
    schedule: [
      {
        id: 'sch-01',
        milestoneTitle: 'دفعة التسجيل وحجز المقعد',
        dueDate: '2026-09-01',
        amountDue: 1500,
        amountCollected: 1500,
        remainingBalance: 0,
        status: 'PAID',
        receiptReference: '#REC-9102'
      },
      {
        id: 'sch-02',
        milestoneTitle: 'دفعة شهر أكتوبر 2026',
        dueDate: '2026-10-01',
        amountDue: 1000,
        amountCollected: 1000,
        remainingBalance: 0,
        status: 'PAID',
        receiptReference: '#REC-9450'
      },
      {
        id: 'sch-03',
        milestoneTitle: 'دفعة شهر نوفمبر 2026',
        dueDate: '2026-11-01',
        amountDue: 1000,
        amountCollected: 0,
        remainingBalance: 1000,
        status: 'OVERDUE'
      },
      {
        id: 'sch-04',
        milestoneTitle: 'دفعة شهر ديسمبر 2026',
        dueDate: '2026-12-01',
        amountDue: 1000,
        amountCollected: 0,
        remainingBalance: 1000,
        status: 'UPCOMING'
      },
      {
        id: 'sch-05',
        milestoneTitle: 'دفعة الفصل الدراسي الثاني والمراجعات',
        dueDate: '2027-01-15',
        amountDue: 1000,
        amountCollected: 0,
        remainingBalance: 1000,
        status: 'UPCOMING'
      }
    ]
  },
  {
    id: 'stu-02',
    studentCode: 'STU-8822',
    fullName: 'سارة محمود عثمان',
    grade: 'الصف الثالث الثانوي',
    branchName: 'فرع الدقي (الرئيسي)',
    parentName: 'محمود عثمان السيد',
    parentPhone: '01123456789',
    agreementNumber: 'CONT-2026-090',
    agreementDate: '2026-09-05',
    totalAgreementValue: 5500,
    specialDiscount: 0,
    netAgreementValue: 5500,
    totalDuesUntilToday: 3000,
    totalCollected: 3000,
    remainingPayable: 0,
    unallocatedPrepayment: 0,
    recognizedRevenue: 2500,
    certifiedLessonsCount: 5,
    status: 'ACTIVE_GOOD_STANDING',
    schedule: [
      {
        id: 'sch-201',
        milestoneTitle: 'دفعة التسجيل وحجز المقعد',
        dueDate: '2026-09-05',
        amountDue: 1500,
        amountCollected: 1500,
        remainingBalance: 0,
        status: 'PAID',
        receiptReference: '#REC-9115'
      },
      {
        id: 'sch-202',
        milestoneTitle: 'دفعة شهر أكتوبر 2026',
        dueDate: '2026-10-01',
        amountDue: 1000,
        amountCollected: 1000,
        remainingBalance: 0,
        status: 'PAID',
        receiptReference: '#REC-9462'
      },
      {
        id: 'sch-203',
        milestoneTitle: 'دفعة شهر نوفمبر 2026',
        dueDate: '2026-11-01',
        amountDue: 1000,
        amountCollected: 1000,
        remainingBalance: 0,
        status: 'PAID',
        receiptReference: '#REC-9818'
      }
    ]
  },
  {
    id: 'stu-03',
    studentCode: 'STU-8823',
    fullName: 'يوسف عادل منصور',
    grade: 'الصف الثاني الثانوي',
    branchName: 'فرع الدقي (الرئيسي)',
    parentName: 'عادل منصور فهمي',
    parentPhone: '01234567890',
    agreementNumber: 'CONT-2026-112',
    agreementDate: '2026-09-10',
    totalAgreementValue: 4800,
    specialDiscount: 0,
    netAgreementValue: 4800,
    totalDuesUntilToday: 2400,
    totalCollected: 1200,
    remainingPayable: 1200,
    unallocatedPrepayment: 0,
    recognizedRevenue: 1000,
    certifiedLessonsCount: 2,
    status: 'OVERDUE_RESTRICTED',
    schedule: [
      {
        id: 'sch-301',
        milestoneTitle: 'دفعة التسجيل وحجز المقعد',
        dueDate: '2026-09-10',
        amountDue: 1200,
        amountCollected: 1200,
        remainingBalance: 0,
        status: 'PAID',
        receiptReference: '#REC-9201'
      },
      {
        id: 'sch-302',
        milestoneTitle: 'دفعة شهر أكتوبر 2026',
        dueDate: '2026-10-01',
        amountDue: 1200,
        amountCollected: 0,
        remainingBalance: 1200,
        status: 'OVERDUE'
      }
    ]
  },
  {
    id: 'stu-04',
    studentCode: 'STU-8824',
    fullName: 'نورهان طارق السيد',
    grade: 'الصف الأول الثانوي',
    branchName: 'فرع الدقي (الرئيسي)',
    parentName: 'طارق السيد كمال',
    parentPhone: '01011223344',
    agreementNumber: 'CONT-2026-145',
    agreementDate: '2026-09-15',
    totalAgreementValue: 4200,
    specialDiscount: 0,
    netAgreementValue: 4200,
    totalDuesUntilToday: 1800,
    totalCollected: 1000,
    remainingPayable: 800,
    unallocatedPrepayment: 0,
    recognizedRevenue: 800,
    certifiedLessonsCount: 2,
    status: 'PAYMENT_PENDING',
    schedule: [
      {
        id: 'sch-401',
        milestoneTitle: 'دفعة التسجيل وحجز المقعد',
        dueDate: '2026-09-15',
        amountDue: 1000,
        amountCollected: 1000,
        remainingBalance: 0,
        status: 'PAID',
        receiptReference: '#REC-9280'
      },
      {
        id: 'sch-402',
        milestoneTitle: 'دفعة شهر أكتوبر 2026',
        dueDate: '2026-10-01',
        amountDue: 800,
        amountCollected: 0,
        remainingBalance: 800,
        status: 'OVERDUE'
      }
    ]
  }
];

export const INITIAL_RECEIPTS: ReceiptItem[] = [
  {
    id: 'rec-01',
    receiptNumber: '#REC-9821',
    studentCode: 'STU-8821',
    studentName: 'عمر شريف فاروق',
    amount: 750,
    paymentMethod: 'CASH',
    paymentMethodLabel: 'نقدي (كاشير 1)',
    cashboxCode: 'CB-01',
    cashboxName: 'خزينة كاشير الاستقبال 1',
    accountantName: 'أ. طارق سمير (محاسب الفرع)',
    timestamp: 'اليوم، 11:45 ص',
    status: 'POSTED',
    statusLabel: 'معتمد ومرحل للخزينة',
    allocatedMilestone: 'دفعة شهر نوفمبر 2026 (سداد جزئي)',
    notes: 'سداد جزئي لدفعة نوفمبر — متبقي 250 ج.م'
  },
  {
    id: 'rec-02',
    receiptNumber: '#REC-9818',
    studentCode: 'STU-8822',
    studentName: 'سارة محمود عثمان',
    amount: 1000,
    paymentMethod: 'CASH',
    paymentMethodLabel: 'نقدي (كاشير 1)',
    cashboxCode: 'CB-01',
    cashboxName: 'خزينة كاشير الاستقبال 1',
    accountantName: 'أ. طارق سمير (محاسب الفرع)',
    timestamp: 'اليوم، 10:15 ص',
    status: 'POSTED',
    statusLabel: 'معتمد ومرحل للخزينة',
    allocatedMilestone: 'دفعة شهر نوفمبر 2026 (سداد كامل)',
    notes: 'سداد كامل القسط الثالث لشهر نوفمبر'
  },
  {
    id: 'rec-03',
    receiptNumber: '#REC-9815',
    studentCode: 'STU-8819',
    studentName: 'كريم إبراهيم الدسوقي',
    amount: 1200,
    paymentMethod: 'POS_CARD',
    paymentMethodLabel: 'بطاقة فيزا POS',
    cashboxCode: 'CB-02',
    cashboxName: 'خزينة كاشير الاستقبال 2',
    accountantName: 'أ. طارق سمير (محاسب الفرع)',
    timestamp: 'اليوم، 09:30 ص',
    status: 'POSTED',
    statusLabel: 'معتمد ومرحل للخزينة',
    allocatedMilestone: 'دفعة شهر نوفمبر 2026',
    notes: 'إيصال ماكينة بنك مصر #81729'
  },
  {
    id: 'rec-04',
    receiptNumber: '#REC-9790',
    studentCode: 'STU-8805',
    studentName: 'أحمد وائل عبد المنعم',
    amount: 500,
    paymentMethod: 'CASH',
    paymentMethodLabel: 'نقدي (كاشير 1)',
    cashboxCode: 'CB-01',
    cashboxName: 'خزينة كاشير الاستقبال 1',
    accountantName: 'أ. طارق سمير (محاسب الفرع)',
    timestamp: 'أمس، 04:20 م',
    status: 'COMPENSATING_REVERSAL_APPLIED',
    statusLabel: 'تم إلغاؤه بقيد تعويضي',
    allocatedMilestone: 'دفعة شهر أكتوبر (خطأ تسجيل)',
    notes: 'تم إصدار قيد عكسي بناء على خطأ في اختيار الطالب',
    compensatingReversalRef: 'REV-2026-012'
  }
];

export const INITIAL_EXPENSE_VOUCHERS: ExpenseVoucher[] = [
  {
    id: 'exp-01',
    voucherNumber: 'EXP-1049',
    title: 'سند صرف نثريات: صيانة معامل وشبكات الحاسب',
    costCenter: 'تقنية المعلومات والصيانة (IT)',
    amount: 2500,
    justification: 'إصلاح راوتر القاعة المركزية واستبدال كابلات شبكة معمل الاختبارات التجريبية',
    supportingDocs: ['فاتورة شركة النيل للتوريدات #4881', 'تقرير الفني مهندس إبراهيم'],
    preparedBy: 'أ. طارق سمير (محاسب الفرع)',
    submittedAt: 'اليوم، 11:30 ص',
    status: 'SUBMITTED_TO_CHECKER',
    statusLabel: 'بانتظار توقيع المدير الرئيسي'
  },
  {
    id: 'exp-02',
    voucherNumber: 'EXP-1045',
    title: 'شراء أدوات نظافة ومستلزمات تعقيم للقاعات',
    costCenter: 'الخدمات والتشغيل المكتبي',
    amount: 850,
    justification: 'تجديد مخزون المنظفات والمعقمات لقاعات المحاضرات والمكاتب الإدارية',
    supportingDocs: ['فاتورة هايبر ماركت النصر #1029'],
    preparedBy: 'أ. طارق سمير (محاسب الفرع)',
    submittedAt: 'أمس، 02:15 م',
    status: 'APPROVED',
    statusLabel: 'معتمد ومصروف من الخزينة'
  }
];

export const CASHBOX_TILLS: CashboxTill[] = [
  {
    code: 'CB-01',
    name: 'خزينة كاشير الاستقبال 1',
    branchName: 'فرع الدقي (الرئيسي)',
    currentBookBalance: 24500,
    status: 'BALANCED_CLOSED',
    statusLabel: 'إغلاق مطابق ومعتمد',
    cashierName: 'أ. محمود حمدي (كاشير)',
    sessionOpenedAt: '08:00 ص',
    todayInflows: 7500,
    todayOutflows: 1500
  },
  {
    code: 'CB-02',
    name: 'خزينة كاشير الاستقبال 2',
    branchName: 'فرع الدقي (الرئيسي)',
    currentBookBalance: 13900,
    status: 'OPEN_SESSION',
    statusLabel: 'مفتوحة للجلسة المسائية',
    cashierName: 'أ. طارق سمير (محاسب الفرع)',
    sessionOpenedAt: '01:00 م',
    todayInflows: 3900,
    todayOutflows: 0
  }
];

export const TRANSFER_REQUESTS: TransferRequestItem[] = [
  {
    id: 'xfer-01',
    transferNumber: 'XFER-041',
    sourceTillCode: 'CB-01',
    destTillCode: 'CB-MAIN (الخزينة المركزية)',
    amount: 5000,
    reason: 'توريد فوائض نقدية من كاشير 1 إلى الخزينة الحديدية الرئيسية',
    dispatcher: 'أ. محمود حمدي (كاشير)',
    submittedAt: 'اليوم، 12:10 م',
    status: 'RECEIVED_CONFIRMED',
    statusLabel: 'مكتمل ومستلم بالخزينة الرئيسية',
    stageNumber: 5
  },
  {
    id: 'xfer-02',
    transferNumber: 'XFER-042',
    sourceTillCode: 'CB-02',
    destTillCode: 'CB-MAIN (الخزينة المركزية)',
    amount: 3000,
    reason: 'تحويل سيولة مسائية مؤمنة للخزينة الرئيسية',
    dispatcher: 'أ. طارق سمير (محاسب الفرع)',
    submittedAt: 'اليوم، 02:40 م',
    status: 'SUBMITTED_TO_CHECKER',
    statusLabel: 'بانتظار موافقة المدير (المرحلة 2)',
    stageNumber: 2
  }
];

export const TEACHER_EVIDENCE_LIST: TeacherLessonEvidence[] = [
  {
    id: 'tch-ev-01',
    teacherId: 'TCH-001',
    teacherName: 'أ. د. محمود القاضي',
    subject: 'الرياضيات التطبيقية (الميكانيكا)',
    grade: 'الصف الثالث الثانوي',
    lessonTitle: 'عزوم القوى في الفراغ ثلاثي الأبعاد — المحاضرة 14',
    deliveredDate: '2026-11-03',
    attendanceVerifiedStudents: 42,
    attendanceSheetDoc: 'كشف حضور معتمد #ATT-DOKKI-2026-11-03-M14.pdf',
    provisionalHours: 2.5,
    accruedCompensationHolding: 1400,
    status: 'HELD_PENDING_UP704',
    statusLabel: 'معلق لحين اعتماد معادلة الاستحقاق (UP-704)'
  },
  {
    id: 'tch-ev-02',
    teacherId: 'TCH-002',
    teacherName: 'أ. إبراهيم نصر',
    subject: 'الجبر والهندسة الفراغية',
    grade: 'الصف الثالث الثانوي',
    lessonTitle: 'المصفوفات والمحددات ونظرية كرامر — المحاضرة 11',
    deliveredDate: '2026-11-04',
    attendanceVerifiedStudents: 38,
    attendanceSheetDoc: 'كشف حضور معتمد #ATT-DOKKI-2026-11-04-A11.pdf',
    provisionalHours: 2.0,
    accruedCompensationHolding: 1250,
    status: 'HELD_PENDING_UP704',
    statusLabel: 'معلق لحين اعتماد معادلة الاستحقاق (UP-704)'
  }
];

export const RECONCILIATION_FIXTURE: ShiftReconciliationRecord = {
  tillCode: 'CB-01',
  tillName: 'خزينة كاشير الاستقبال 1 (فرع الدقي)',
  openingBalance: 18500,
  totalInflows: 7500,
  totalOutflows: 1500,
  expectedClosing: 24500,
  countedPhysicalTotal: 24500,
  discrepancy: 0,
  status: 'BALANCED',
  statusLabel: 'جرد مطابق تماماً (صفر عجز / صفر زيادة)',
  policyNote: 'تم التحقق من تطابق العد الفعلي مع الرصيد الدفتري للنظام — جاهز للاعتماد النهائي',
  denominations: {
    200: 70, // 14,000
    100: 80, // 8,000
    50: 30,  // 1,500
    20: 30,  // 600
    10: 30,  // 300
    5: 20    // 100 -> Total = 24,500
  }
};

