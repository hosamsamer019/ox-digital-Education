export type BranchScopeId = 'INST-CONSOLIDATED' | 'BR-01' | 'BR-02' | 'BR-ONLINE';

export interface BranchScopeOption {
  id: BranchScopeId;
  name: string;
  code: string;
  type: 'CONSOLIDATED' | 'PHYSICAL' | 'ONLINE';
  isPhysical: boolean;
  statusText: string;
}

export interface FinancialKpis {
  actualCollections: number;
  collectionsToday: number;
  overdueReceivables: number;
  criticalOverdue: number;
  cashboxLiquidity: number;
  activeCashboxesCount: number;
  recognizedRevenue: number;
  certifiedLessonsCount: number;
}

export interface BranchPerformance {
  id: string;
  code: string;
  name: string;
  isPhysical: boolean;
  isHeadquarters?: boolean;
  status: 'ACTIVE' | 'DEFERRED';
  statusLabel: string;
  collections: number | null;
  cashboxBalance: number | null;
  recognizedRevenue: number | null;
  overdueReceivables: number | null;
  closingStatus: 'BALANCED' | 'DISCREPANCY_INVESTIGATION' | 'NOT_APPLICABLE';
  closingStatusLabel: string;
  discrepancyAmount?: number;
  tillsCount: number;
}

export interface ApprovalQueueItem {
  id: string;
  referenceNumber: string;
  type: 'EXPENSE_VOUCHER' | 'CASHBOX_DISCREPANCY' | 'STUDENT_DISCOUNT' | 'TEACHER_SETTLEMENT';
  title: string;
  branchName: string;
  branchId: string;
  amount: number;
  submittedBy: string;
  submittedAt: string;
  justification: string;
  supportingDocuments: string[];
  status: 'SUBMITTED' | 'APPROVED' | 'REJECTED' | 'UNDER_INVESTIGATION';
  policyReference?: string;
}

export interface AuditedFinancialMovement {
  id: string;
  receiptNumber: string;
  partyName: string;
  movementType: 'COLLECTION' | 'TRANSFER' | 'EXPENSE';
  movementTypeLabel: string;
  amount: number;
  paymentMethod: 'CASH' | 'POS_CARD' | 'BANK_TRANSFER' | 'INTERNAL_TRANSFER';
  paymentMethodLabel: string;
  cashboxCode: string;
  branchName: string;
  branchId: string;
  cashierName: string;
  timestamp: string;
  status: 'POSTED_AND_ROUTED' | 'BALANCED_TRANSFER' | 'AUTHORIZED_EXPENSE';
  statusLabel: string;
  notes?: string;
}

export interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: 'ACCOUNTANT' | 'PRIMARY_MANAGER' | 'TEACHER';
  roleLabel: string;
  branchId: string;
  branchName: string;
  status: 'ACTIVE' | 'PENDING_ACTIVATION' | 'DEACTIVATED';
  statusLabel: string;
  invitedAt?: string;
  joinedAt?: string;
}

