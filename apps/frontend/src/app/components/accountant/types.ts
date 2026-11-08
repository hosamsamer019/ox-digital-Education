export interface AccountantKpis {
  collectionsToday: number;
  collectionsTodayCount: number;
  tillLiquidity: number;
  activeTillsCount: number;
  overdueDues: number;
  overdueStudentsCount: number;
  pendingVouchersAmount: number;
  pendingVouchersCount: number;
  unallocatedCashPool: number;
}

export interface PaymentScheduleItem {
  id: string;
  milestoneTitle: string;
  dueDate: string;
  amountDue: number;
  amountCollected: number;
  remainingBalance: number;
  status: 'PAID' | 'PARTIAL' | 'OVERDUE' | 'UPCOMING';
  receiptReference?: string;
}

export interface StudentSubLedger {
  id: string;
  studentCode: string;
  fullName: string;
  grade: string;
  branchName: string;
  parentName: string;
  parentPhone: string;
  agreementNumber: string;
  agreementDate: string;
  totalAgreementValue: number;
  specialDiscount: number;
  netAgreementValue: number;
  totalDuesUntilToday: number;
  totalCollected: number;
  remainingPayable: number;
  unallocatedPrepayment: number;
  recognizedRevenue: number;
  certifiedLessonsCount: number;
  status: 'ACTIVE_GOOD_STANDING' | 'PAYMENT_PENDING' | 'OVERDUE_RESTRICTED';
  schedule: PaymentScheduleItem[];
}

export interface ReceiptItem {
  id: string;
  receiptNumber: string;
  studentCode: string;
  studentName: string;
  amount: number;
  paymentMethod: 'CASH' | 'POS_CARD' | 'BANK_TRANSFER';
  paymentMethodLabel: string;
  cashboxCode: string;
  cashboxName: string;
  accountantName: string;
  timestamp: string;
  status: 'POSTED' | 'COMPENSATING_REVERSAL_APPLIED' | 'SUBMITTED_FOR_PM_APPROVAL';
  statusLabel: string;
  allocatedMilestone: string;
  notes?: string;
  compensatingReversalRef?: string;
  targetReceiptNumber?: string;
}

export interface ExpenseVoucher {
  id: string;
  voucherNumber: string;
  title: string;
  costCenter: string;
  amount: number;
  justification: string;
  supportingDocs: string[];
  preparedBy: string;
  submittedAt: string;
  status: 'SUBMITTED_TO_CHECKER' | 'APPROVED' | 'REJECTED';
  statusLabel: string;
  rejectionReason?: string;
}

export interface CashboxTill {
  code: string;
  name: string;
  branchName: string;
  currentBookBalance: number;
  status: 'OPEN_SESSION' | 'BALANCED_CLOSED' | 'DISCREPANCY_UNDER_REVIEW';
  statusLabel: string;
  cashierName: string;
  sessionOpenedAt: string;
  todayInflows: number;
  todayOutflows: number;
}

export interface TransferRequestItem {
  id: string;
  transferNumber: string;
  sourceTillCode: string;
  destTillCode: string;
  amount: number;
  reason: string;
  dispatcher: string;
  submittedAt: string;
  status: 'SUBMITTED_TO_CHECKER' | 'AUTHORIZED_BY_PM' | 'DISPATCHED_IN_TRANSIT' | 'RECEIVED_CONFIRMED';
  statusLabel: string;
  stageNumber: number; // 1 to 5
}

export interface DenominationCount {
  value: number;
  count: number;
}

export interface ShiftReconciliationRecord {
  tillCode: string;
  tillName: string;
  expectedClosing: number;
  openingBalance: number;
  totalInflows: number;
  totalOutflows: number;
  countedPhysicalTotal: number;
  discrepancy: number;
  status: 'BALANCED' | 'DEFICIT_UNDER_REVIEW' | 'SURPLUS_UNDER_REVIEW';
  statusLabel: string;
  policyNote: string;
  denominations: Record<number, number>;
}

export interface TeacherLessonEvidence {
  id: string;
  teacherId: string;
  teacherName: string;
  subject: string;
  grade: string;
  lessonTitle: string;
  deliveredDate: string;
  attendanceVerifiedStudents: number;
  attendanceSheetDoc: string;
  provisionalHours: number;
  accruedCompensationHolding: number;
  status: 'HELD_PENDING_UP704';
  statusLabel: string;
}

