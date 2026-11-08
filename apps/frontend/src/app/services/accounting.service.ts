import { accountingApi, managerApi, userApi } from './api';

export interface CollectionTenderInput {
  tenderType: 'CASH' | 'POS_CARD' | 'BANK_TRANSFER' | 'CHEQUE' | 'OTHER';
  amount: number;
  cashboxId?: string;
  posTerminalId?: string;
  posAuthCode?: string;
  cardLastFour?: string;
  bankReferenceNumber?: string;
}

export interface CreateCollectionPayload {
  studentId: string;
  cashboxId?: string;
  amount: number;
  currency?: string;
  tenders?: CollectionTenderInput[];
  paymentMethod?: string;
  payerUserId?: string;
  payerName?: string;
  payerPhone?: string;
  notes?: string;
  idempotencyKey?: string;
}

export interface ReconcileCashboxPayload {
  actualCountedClosingBalance: number;
  notes?: string;
}

export interface CreateExpensePayload {
  category: string;
  payeeName: string;
  amount: number;
  description: string;
  paymentSource?: 'CASHBOX' | 'BANK_ACCOUNT';
  cashboxId?: string;
  bankAccountId?: string;
  branchId?: string;
  receiptAttachmentUrl?: string;
  notes?: string;
}

export interface CreateStudentAgreementPayload {
  studentId: string;
  branchId?: string;
  centerGroupId?: string;
  catalogPrice: number;
  discountAmount?: number;
  totalSessionsCount?: number;
  installmentsCount?: number;
  startDate?: string;
  termsNotes?: string;
}

export const accountingService = {
  // Collections
  recordCollection: async (payload: CreateCollectionPayload) => {
    const res = await accountingApi.post('/collections', payload);
    return res.data;
  },
  getCollections: async (params?: any) => {
    const res = await accountingApi.get('/collections', { params });
    return res.data;
  },
  getCollection: async (id: string) => {
    const res = await accountingApi.get(`/collections/${id}`);
    return res.data;
  },
  requestReversal: async (collectionId: string, reason: string, amount?: number) => {
    const res = await accountingApi.post(`/collections/${collectionId}/reversal-request`, { reason, amount });
    return res.data;
  },
  reviewReversal: async (adjustmentId: string, decision: 'APPROVE' | 'REJECT', notes?: string) => {
    const res = await accountingApi.post(`/reversals/${adjustmentId}/review`, { decision, notes });
    return res.data;
  },

  // Cashbox
  getCashboxes: async () => {
    const res = await accountingApi.get('/cashbox');
    return res.data;
  },
  createCashbox: async (payload: { code: string; name: string; branchId?: string; currency?: string; assignedCashierId?: string }) => {
    const res = await accountingApi.post('/cashbox', payload);
    return res.data;
  },
  reconcileCashbox: async (cashboxId: string, payload: ReconcileCashboxPayload) => {
    const res = await accountingApi.post(`/cashbox/${cashboxId}/reconcile`, payload);
    return res.data;
  },
  getCashboxTransactions: async (cashboxId: string, params?: any) => {
    const res = await accountingApi.get(`/cashbox/${cashboxId}/transactions`, { params });
    return res.data;
  },
  getCashboxReconciliations: async (params?: any) => {
    const res = await accountingApi.get('/cashbox/reconciliations', { params });
    return res.data;
  },

  // Expenses
  getExpenses: async (params?: any) => {
    const res = await accountingApi.get('/expenses', { params });
    return res.data;
  },
  createExpenseVoucher: async (payload: CreateExpensePayload) => {
    const res = await accountingApi.post('/expenses', payload);
    return res.data;
  },
  approveExpenseVoucher: async (id: string, decision: 'APPROVE' | 'REJECT', notes?: string) => {
    const res = await accountingApi.post(`/expenses/${id}/approve`, { decision, notes });
    return res.data;
  },
  disburseExpenseVoucher: async (id: string, payload?: { cashboxId?: string; notes?: string }) => {
    const res = await accountingApi.post(`/expenses/${id}/disburse`, payload || {});
    return res.data;
  },

  // Pricing & Student Agreements
  getPricingAgreements: async (params?: any) => {
    const res = await accountingApi.get('/pricing', { params });
    return res.data;
  },
  createPricingAgreement: async (payload: any) => {
    const res = await accountingApi.post('/pricing', payload);
    return res.data;
  },
  createStudentAgreement: async (payload: CreateStudentAgreementPayload) => {
    const res = await accountingApi.post('/agreements', payload);
    return res.data;
  },
  getStudentFinancialAccount: async (studentId: string) => {
    const res = await accountingApi.get(`/students/${studentId}/account`);
    return res.data;
  },
  getStudentSubLedgers: async (params?: any) => {
    const res = await accountingApi.get('/students/sub-ledgers', { params });
    return res.data;
  },

  // Receipts
  getReceiptDetails: async (id: string) => {
    const res = await accountingApi.get(`/receipts/${id}`);
    return res.data;
  },
  getReceiptPdfUrl: (id: string) => `/api/accounting/receipts/${id}/pdf`,

  // Monthly Fee Financial Access Control
  getFinancialAccessPolicy: async () => {
    const res = await managerApi.get('/financial-access-policy');
    return res.data;
  },
  updateFinancialAccessPolicy: async (payload: {
    policyMode?: 'GLOBAL' | 'PER_BRANCH';
    gracePeriodDays?: number;
    isEnabled?: boolean;
    reason?: string;
    branchOverrides?: Array<{ branchId: string; gracePeriodDays: number; isEnabled: boolean }>;
  }) => {
    const res = await managerApi.put('/financial-access-policy', payload);
    return res.data;
  },
  getFinancialRestrictions: async () => {
    const res = await managerApi.get('/financial-restrictions');
    return res.data;
  },
  triggerFinancialEvaluation: async (dryRun: boolean = false) => {
    const res = await managerApi.post('/financial-access/evaluate', { dryRun });
    return res.data;
  },
  getMyFinancialAccessStatus: async () => {
    const res = await userApi.get('/financial-access-status');
    return res.data;
  },

  // Reports
  getFinancialSummary: async (params?: any) => {
    const res = await accountingApi.get('/reports/summary', { params });
    return res.data;
  },
  getArrearsReport: async (params?: any) => {
    const res = await accountingApi.get('/reports/arrears', { params });
    return res.data;
  },
  getIncomeBreakdown: async (days: number = 30, params?: any) => {
    const res = await accountingApi.get('/reports/income-breakdown', { params: { days, ...(params || {}) } });
    return res.data;
  }
};
