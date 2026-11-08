import { Router } from 'express';
import { verifyToken, checkRole, requirePrimaryManager } from '../middlewares/auth.middleware.js';
import { tenantContextMiddleware } from '@shared/utils';

import {
  createCollection,
  listCollections,
  getCollectionById,
  requestReversal,
  reviewReversal
} from '../controllers/accounting/collections.controller.js';

import {
  listCashboxes,
  createCashbox,
  reconcileCashbox,
  getCashboxTransactions,
  getCashboxReconciliations
} from '../controllers/accounting/cashbox.controller.js';

import {
  createExpenseVoucher,
  listExpenseVouchers,
  approveExpenseVoucher,
  disburseExpenseVoucher
} from '../controllers/accounting/expenses.controller.js';

import {
  listPricingAgreements,
  createPricingAgreement,
  createStudentAgreement,
  getStudentFinancialAccount,
  listStudentSubLedgers
} from '../controllers/accounting/pricing.controller.js';

import {
  getReceiptDetails,
  getReceiptPdf,
  getReceiptHtml
} from '../controllers/accounting/receipts.controller.js';

import {
  getFinancialSummary,
  getArrearsReport,
  getIncomeBreakdown
} from '../controllers/accounting/reports.controller.js';

const router = Router();

// Enforce authentication & tenant context across all accounting routes
router.use(verifyToken, tenantContextMiddleware());

// ----------------------------------------------------------------------------
// Collections & Reversals
// ----------------------------------------------------------------------------
router.post('/collections', checkRole(['ACCOUNTANT', 'PRIMARY_MANAGER', 'ADMIN']), createCollection);
router.get('/collections', checkRole(['ACCOUNTANT', 'PRIMARY_MANAGER', 'ADMIN']), listCollections);
router.get('/collections/:id', checkRole(['ACCOUNTANT', 'PRIMARY_MANAGER', 'ADMIN', 'STUDENT', 'ONLINE_STUDENT', 'CENTER_STUDENT', 'PARENT']), getCollectionById);
router.post('/collections/:id/reversal-request', checkRole(['ACCOUNTANT', 'PRIMARY_MANAGER', 'ADMIN']), requestReversal);
router.post('/reversals/:adjustmentId/review', requirePrimaryManager, reviewReversal);

// ----------------------------------------------------------------------------
// Cashbox Operations
// ----------------------------------------------------------------------------
router.get('/cashbox/reconciliations', checkRole(['ACCOUNTANT', 'PRIMARY_MANAGER', 'ADMIN']), getCashboxReconciliations);
router.get('/cashbox', checkRole(['ACCOUNTANT', 'PRIMARY_MANAGER', 'ADMIN']), listCashboxes);
router.post('/cashbox', checkRole(['ACCOUNTANT', 'PRIMARY_MANAGER', 'ADMIN']), createCashbox);
router.post('/cashbox/:id/reconcile', checkRole(['ACCOUNTANT', 'PRIMARY_MANAGER', 'ADMIN']), reconcileCashbox);
router.get('/cashbox/:id/transactions', checkRole(['ACCOUNTANT', 'PRIMARY_MANAGER', 'ADMIN']), getCashboxTransactions);

// ----------------------------------------------------------------------------
// Expenses
// ----------------------------------------------------------------------------
router.post('/expenses', checkRole(['ACCOUNTANT', 'PRIMARY_MANAGER', 'ADMIN', 'TEACHER']), createExpenseVoucher);
router.get('/expenses', checkRole(['ACCOUNTANT', 'PRIMARY_MANAGER', 'ADMIN']), listExpenseVouchers);
router.post('/expenses/:id/approve', requirePrimaryManager, approveExpenseVoucher);
router.post('/expenses/:id/disburse', checkRole(['ACCOUNTANT', 'PRIMARY_MANAGER', 'ADMIN']), disburseExpenseVoucher);

// ----------------------------------------------------------------------------
// Pricing & Student Financial Agreements
// ----------------------------------------------------------------------------
router.get('/pricing', checkRole(['ACCOUNTANT', 'PRIMARY_MANAGER', 'ADMIN', 'TEACHER']), listPricingAgreements);
router.post('/pricing', requirePrimaryManager, createPricingAgreement);
router.post('/agreements', checkRole(['ACCOUNTANT', 'PRIMARY_MANAGER', 'ADMIN']), createStudentAgreement);
router.get('/students/sub-ledgers', checkRole(['ACCOUNTANT', 'PRIMARY_MANAGER', 'ADMIN']), listStudentSubLedgers);
router.get('/students/:studentId/account', checkRole(['ACCOUNTANT', 'PRIMARY_MANAGER', 'ADMIN', 'STUDENT', 'ONLINE_STUDENT', 'CENTER_STUDENT', 'PARENT', 'TEACHER']), getStudentFinancialAccount);

// ----------------------------------------------------------------------------
// Receipts
// ----------------------------------------------------------------------------
router.get('/receipts/:id', checkRole(['ACCOUNTANT', 'PRIMARY_MANAGER', 'ADMIN', 'STUDENT', 'ONLINE_STUDENT', 'CENTER_STUDENT', 'PARENT']), getReceiptDetails);
router.get('/receipts/:id/pdf', checkRole(['ACCOUNTANT', 'PRIMARY_MANAGER', 'ADMIN', 'STUDENT', 'ONLINE_STUDENT', 'CENTER_STUDENT', 'PARENT']), getReceiptPdf);
router.get('/receipts/:id/preview', checkRole(['ACCOUNTANT', 'PRIMARY_MANAGER', 'ADMIN', 'STUDENT', 'ONLINE_STUDENT', 'CENTER_STUDENT', 'PARENT']), getReceiptHtml);

// ----------------------------------------------------------------------------
// Financial Reports & Analytics
// ----------------------------------------------------------------------------
router.get('/reports/summary', checkRole(['PRIMARY_MANAGER', 'ADMIN', 'ACCOUNTANT']), getFinancialSummary);
router.get('/reports/arrears', checkRole(['PRIMARY_MANAGER', 'ADMIN', 'ACCOUNTANT']), getArrearsReport);
router.get('/reports/income-breakdown', checkRole(['PRIMARY_MANAGER', 'ADMIN', 'ACCOUNTANT']), getIncomeBreakdown);

export default router;
