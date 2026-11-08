/**
 * OX-DIGITAL Education — Financial Core Engine
 * Phase 2.0B — Physical Education Center Accounting Integration
 * Domain Events & Evidence Boundary Contracts
 */

export interface LessonDeliveryCertifiedEvent {
  eventType: 'LESSON_DELIVERY_CERTIFIED';
  evidenceId: string;
  institutionId: string;
  branchId: string;
  centerGroupId: string;
  lessonId: string;
  courseId: string;
  teacherId: string;
  deliveredAt: string;
  certifiedByUserId: string;
  certifiedAt: string;
  attendedStudentCount: number;
}

export interface StudentAgreementEstablishedEvent {
  eventType: 'STUDENT_AGREEMENT_ESTABLISHED';
  agreementId: string;
  studentId: string;
  centerGroupId: string;
  institutionId: string;
  branchId: string;
  netAgreedPrice: string;
  currency: 'EGP';
  scheduledItemsCount: number;
  establishedAt: string;
}

export interface FeeDueScheduledEvent {
  eventType: 'FEE_DUE_SCHEDULED';
  obligationId: string;
  agreementId: string;
  studentId: string;
  institutionId: string;
  branchId: string;
  scheduleItemNumber: number;
  dueDate: string;
  amountDue: string;
  currency: 'EGP';
}

export interface FeeCollectionReceivedEvent {
  eventType: 'FEE_COLLECTION_RECEIVED';
  collectionId: string;
  institutionId: string;
  branchId: string;
  cashboxId: string;
  cashierUserId: string;
  studentId: string;
  obligationId?: string;
  amountCollected: string;
  currency: 'EGP';
  receiptNumber: string;
  paymentMethod: string;
  collectedAt: string;
}

export interface DeliveryProofLinkedEvent {
  eventType: 'DELIVERY_PROOF_LINKED';
  evidenceId: string;
  agreementId: string;
  studentId: string;
  lessonId: string;
  centerGroupId: string;
  institutionId: string;
  branchId: string;
  linkedAt: string;
  /**
   * Crucial: DeliveryProofLinked indicates that evidence has met pairing criteria.
   * Revenue recognition posting is explicitly decoupled and executed via approved policy.
   */
  revenueRecognized: false;
}

export interface CollectionAllocationRecordedEvent {
  eventType: 'COLLECTION_ALLOCATION_RECORDED';
  allocationId: string;
  idempotencyKey: string;
  institutionId: string;
  branchId: string;
  studentId: string;
  agreementId: string;
  collectionId: string;
  obligationId: string;
  allocatedAmount: string;
  currency: 'EGP';
  receiptUnallocatedRemaining: string;
  obligationRemainingDue: string;
  allocatedAt: string;
  allocatedByUserId: string;
}

export interface CollectionAllocationReversedEvent {
  eventType: 'COLLECTION_ALLOCATION_REVERSED';
  allocationId: string;
  institutionId: string;
  branchId: string;
  studentId: string;
  agreementId: string;
  collectionId: string;
  obligationId: string;
  reversedAmount: string;
  currency: 'EGP';
  reversedAt: string;
  reversedByUserId: string;
  reason: string;
}

export interface CollectionReceiptReversedEvent {
  eventType: 'COLLECTION_RECEIPT_REVERSED';
  collectionId: string;
  institutionId: string;
  branchId: string;
  studentId: string;
  amount: string;
  currency: 'EGP';
  reversedAt: string;
  reversedByUserId: string;
  reason: string;
}

export interface StudentSubledgerReconciledEvent {
  eventType: 'STUDENT_SUBLEDGER_RECONCILED';
  institutionId: string;
  branchId: string;
  studentId: string;
  agreementId: string;
  totalAgreedPrice: string;
  totalObligationsDue: string;
  totalCollectionsReceived: string;
  totalAllocated: string;
  totalUnallocatedCollections: string;
  totalRemainingDue: string;
  currency: 'EGP';
  reconciledAt: string;
}

/**
 * Increment 4 — Cashbox Operations & Reconciliation Events
 */

export interface CashboxCreatedEvent {
  eventType: 'CASHBOX_CREATED';
  cashboxId: string;
  institutionId: string;
  branchId: string;
  name: string;
  currency: 'EGP';
  createdAt: string;
  createdByUserId: string;
}

export interface CashboxCollectionRecordedEvent {
  eventType: 'CASHBOX_COLLECTION_RECORDED';
  transactionId: string;
  cashboxId: string;
  institutionId: string;
  branchId: string;
  collectionId: string;
  receiptNumber: string;
  studentId: string;
  amount: string;
  currency: 'EGP';
  balanceAfter: string;
  businessDate: string;
  recordedAt: string;
  cashierUserId: string;
  revenueRecognized: false;
}

export interface CashboxExpenseRecordedEvent {
  eventType: 'CASHBOX_EXPENSE_RECORDED';
  transactionId: string;
  cashboxId: string;
  institutionId: string;
  branchId: string;
  voucherNumber: string;
  amount: string;
  currency: 'EGP';
  balanceAfter: string;
  businessDate: string;
  reason: string;
  recordedAt: string;
  actorUserId: string;
}

export interface CashboxTransferExecutedEvent {
  eventType: 'CASHBOX_TRANSFER_EXECUTED';
  transferId: string;
  institutionId: string;
  sourceCashboxId: string;
  sourceBranchId: string;
  destinationCashboxId: string;
  destinationBranchId: string;
  amount: string;
  currency: 'EGP';
  businessDate: string;
  executedAt: string;
  actorUserId: string;
  sourceBalanceAfter: string;
  destinationBalanceAfter: string;
}

export interface CashboxDailyReconciledEvent {
  eventType: 'CASHBOX_DAILY_RECONCILED';
  reconciliationId: string;
  cashboxId: string;
  institutionId: string;
  branchId: string;
  businessDate: string;
  openingBalance: string;
  totalCollections: string;
  totalIncomingTransfers: string;
  totalOutgoingTransfers: string;
  totalExpenses: string;
  expectedClosingBalance: string;
  actualCountedClosingBalance: string;
  difference: string;
  status: 'BALANCED' | 'DISCREPANCY_PENDING_INVESTIGATION';
  reconciledAt: string;
  reconciledByUserId: string;
}

export interface CashboxMovementReversedEvent {
  eventType: 'CASHBOX_MOVEMENT_REVERSED';
  transactionId: string;
  reversalTransactionId: string;
  cashboxId: string;
  institutionId: string;
  branchId: string;
  originalType: string;
  amount: string;
  currency: 'EGP';
  balanceAfter: string;
  reversedAt: string;
  reversedByUserId: string;
  reason: string;
}



