import { Response } from 'express';
import { db } from '../../../../../packages/database/src/index.js';
import { AuthRequest, isAuthorizedPrimaryManager } from '../../middlewares/auth.middleware.js';
import { resolveAccountingReportScope, resolveDateRangeFilter } from '../../utils/accountingScope.util.js';
import { NotificationEventService } from '../../services/notificationEvent.service.js';
import { logger } from '@shared/utils';

/**
 * GET /api/accounting/cashbox
 * List all cashboxes for institution/branch with strict branch isolation for Accountants
 */
export const listCashboxes = async (req: AuthRequest, res: Response) => {
  try {
    const scope = await resolveAccountingReportScope(req);
    if (!scope.ok) {
      return res.status(scope.status || 403).json({ message: scope.message });
    }

    const where: any = { institutionId: scope.institutionId, deletedAt: null };
    if (scope.branchId) where.branchId = scope.branchId;

    const cashboxes = await db.cashbox.findMany({
      where,
      orderBy: { createdAt: 'asc' },
      include: {
        branch: { select: { id: true, name: true, code: true } },
        assignedCashier: { select: { id: true, name: true, email: true } },
        _count: {
          select: {
            transactions: true,
            collections: true,
            reconciliations: true
          }
        }
      }
    });

    return res.json(cashboxes);
  } catch (error: any) {
    logger.error(`[Accounting] Error listing cashboxes: ${error.message}`);
    return res.status(500).json({ message: 'Error listing cashboxes', error: error.message });
  }
};

/**
 * POST /api/accounting/cashbox
 * Create a new cashbox for a branch
 */
export const createCashbox = async (req: AuthRequest, res: Response) => {
  try {
    const institutionId = req.user?.institutionId || req.tenantContext?.institutionId;
    const defaultBranchId = req.user?.branchId || req.tenantContext?.branchId;
    const userRole = (req.user?.role || '').toUpperCase();

    if (!institutionId) {
      return res.status(401).json({ message: 'Unauthorized: Missing tenant identity' });
    }

    if (userRole !== 'ACCOUNTANT' && !isAuthorizedPrimaryManager(req.user)) {
      return res.status(403).json({ message: 'Forbidden: Insufficient permissions to create cashbox' });
    }

    const { code, name, branchId, currency = 'EGP', assignedCashierId } = req.body;

    if (!code || !name) {
      return res.status(400).json({ message: 'Cashbox code and name are required' });
    }

    // Critical Fix C: Strict branch scoping for Accountants
    if (userRole === 'ACCOUNTANT') {
      const accountantBranchId = req.user?.branchId;
      if (!accountantBranchId) {
        return res.status(403).json({
          success: false,
          error: 'ACCOUNTANT_BRANCH_UNASSIGNED',
          message: 'Forbidden: Accountant is not assigned to any branch.'
        });
      }
      if (branchId && branchId !== accountantBranchId) {
        return res.status(403).json({
          success: false,
          error: 'CROSS_BRANCH_ACCESS_DENIED',
          message: 'Forbidden: Accountants cannot create cashboxes for other branches.'
        });
      }
    }

    const targetBranchId = userRole === 'ACCOUNTANT'
      ? (req.user?.branchId as string)
      : (branchId || defaultBranchId || (await db.branch.findFirst({
          where: { institutionId: institutionId as string, isDefault: true }
        }))?.id);

    if (!targetBranchId) {
      return res.status(400).json({ message: 'Valid branchId required to create cashbox' });
    }

    const existing = await db.cashbox.findFirst({
      where: { institutionId: institutionId as string, code: code.trim().toUpperCase() }
    });

    if (existing) {
      return res.status(409).json({ message: `Cashbox with code '${code}' already exists in this institution` });
    }

    const cashbox = await db.cashbox.create({
      data: {
        institutionId: institutionId as string,
        branchId: targetBranchId,
        code: code.trim().toUpperCase(),
        name: name.trim(),
        currency,
        currentBalance: 0,
        status: 'ACTIVE',
        assignedCashierId: assignedCashierId || null
      },
      include: {
        branch: { select: { id: true, name: true, code: true } },
        assignedCashier: { select: { id: true, name: true, email: true } }
      }
    });

    return res.status(201).json({
      message: 'Cashbox created successfully',
      cashbox
    });
  } catch (error: any) {
    logger.error(`[Accounting] Error creating cashbox: ${error.message}`);
    return res.status(500).json({ message: 'Error creating cashbox', error: error.message });
  }
};

/**
 * POST /api/accounting/cashbox/:id/reconcile
 * Submit blind count reconciliation at end of shift/day
 * NEVER blocks shift closing, records full audit, flags discrepancy to PM immediately
 */
export const reconcileCashbox = async (req: AuthRequest, res: Response) => {
  try {
    const institutionId = req.user?.institutionId || req.tenantContext?.institutionId;
    const cashierId = req.user?.userId;
    const { id } = req.params;
    const { actualCountedClosingBalance, notes } = req.body;

    if (!institutionId || !cashierId) {
      return res.status(401).json({ message: 'Unauthorized: Missing tenant or user identity' });
    }

    if (actualCountedClosingBalance === undefined || actualCountedClosingBalance === null) {
      return res.status(400).json({ message: 'Blind counted closing balance is required' });
    }

    const actualCounted = Number(actualCountedClosingBalance);
    if (isNaN(actualCounted) || actualCounted < 0) {
      return res.status(400).json({ message: 'Counted balance must be a non-negative number' });
    }

    const cashbox = await db.cashbox.findFirst({
      where: { id, institutionId: institutionId as string, deletedAt: null }
    });

    if (!cashbox) {
      return res.status(404).json({ message: 'Cashbox not found' });
    }

    // Critical Fix C: Object-level branch verification for Accountants
    const userRole = (req.user?.role || '').toUpperCase();
    if (userRole === 'ACCOUNTANT') {
      const accountantBranchId = req.user?.branchId;
      if (!accountantBranchId) {
        return res.status(403).json({
          success: false,
          error: 'ACCOUNTANT_BRANCH_UNASSIGNED',
          message: 'Forbidden: Accountant is not assigned to any branch.'
        });
      }
      if (cashbox.branchId !== accountantBranchId) {
        return res.status(403).json({
          success: false,
          error: 'CROSS_BRANCH_ACCESS_DENIED',
          message: 'Forbidden: Accountants cannot reconcile cashboxes of other branches.'
        });
      }
    }

    const businessDate = new Date().toISOString().slice(0, 10);
    const expectedClosingBalance = Number(cashbox.currentBalance);
    const difference = actualCounted - expectedClosingBalance;
    const isDiscrepancy = Math.abs(difference) > 0.001;
    const status = isDiscrepancy ? 'DISCREPANCY_PENDING_INVESTIGATION' : 'BALANCED';

    // Calculate aggregated shift movements for today
    const transactions = await db.cashboxTransaction.findMany({
      where: {
        cashboxId: cashbox.id,
        businessDate,
        status: 'POSTED'
      }
    });

    let totalCollections = 0;
    let totalIncomingTransfers = 0;
    let totalOutgoingTransfers = 0;
    let totalExpenses = 0;

    for (const tx of transactions) {
      const amt = Number(tx.amount);
      if (tx.type === 'COLLECTION') totalCollections += amt;
      else if (tx.type === 'TRANSFER_IN') totalIncomingTransfers += amt;
      else if (tx.type === 'TRANSFER_OUT') totalOutgoingTransfers += amt;
      else if (tx.type === 'EXPENSE') totalExpenses += amt;
      else if (tx.type === 'COLLECTION_REVERSED') totalCollections -= amt;
      else if (tx.type === 'EXPENSE_REVERSED') totalExpenses -= amt;
    }

    const openingBalance = expectedClosingBalance - totalCollections - totalIncomingTransfers + totalOutgoingTransfers + totalExpenses;

    // Check if reconciliation already exists for today; if so, update or create with unique timestamp
    let reconciliation;
    const existingRec = await db.cashboxReconciliation.findUnique({
      where: {
        cashboxId_businessDate: {
          cashboxId: cashbox.id,
          businessDate
        }
      }
    });

    if (existingRec) {
      reconciliation = await db.cashboxReconciliation.update({
        where: { id: existingRec.id },
        data: {
          actualCountedClosingBalance: actualCounted,
          expectedClosingBalance,
          difference,
          status,
          reconciledByUserId: cashierId,
          notes: notes || existingRec.notes,
          reconciledAt: new Date()
        }
      });
    } else {
      reconciliation = await db.cashboxReconciliation.create({
        data: {
          institutionId: institutionId as string,
          branchId: cashbox.branchId,
          cashboxId: cashbox.id,
          businessDate,
          reconciledByUserId: cashierId,
          openingBalance: Math.max(0, openingBalance),
          totalCollections,
          totalIncomingTransfers,
          totalOutgoingTransfers,
          totalExpenses,
          expectedClosingBalance,
          actualCountedClosingBalance: actualCounted,
          difference,
          status,
          notes: notes || null
        }
      });
    }

    // High Priority Notification to Primary Manager if discrepancy detected
    if (isDiscrepancy) {
      await NotificationEventService.onCashboxDiscrepancy({
        institutionId: institutionId as string,
        branchId: cashbox.branchId,
        cashboxId: cashbox.id,
        cashboxName: cashbox.name,
        cashierId: cashierId,
        cashierName: req.user?.email || 'Cashier',
        systemExpected: expectedClosingBalance,
        actualCounted,
        difference,
        currency: cashbox.currency
      });
    }

    return res.json({
      success: true,
      message: isDiscrepancy
        ? `Reconciliation recorded with discrepancy of ${difference} ${cashbox.currency}. Discrepancy flagged for management.`
        : 'Cashbox reconciled and balanced successfully.',
      reconciliation,
      hasDiscrepancy: isDiscrepancy,
      difference
    });
  } catch (error: any) {
    logger.error(`[Accounting] Error reconciling cashbox: ${error.message}`);
    return res.status(500).json({ message: 'Error reconciling cashbox', error: error.message });
  }
};

/**
 * GET /api/accounting/cashbox/:id/transactions
 * Cash movements ledger for a cashbox
 */
export const getCashboxTransactions = async (req: AuthRequest, res: Response) => {
  try {
    const institutionId = req.user?.institutionId || req.tenantContext?.institutionId;
    if (!institutionId) {
      return res.status(401).json({ message: 'Unauthorized: Missing tenant identity' });
    }

    const { id } = req.params;
    const { businessDate, type, page = '1', limit = '50' } = req.query;

    // Critical Fix C: Object-level cashbox branch verification for Accountants
    const userRole = (req.user?.role || '').toUpperCase();
    if (userRole === 'ACCOUNTANT') {
      const accountantBranchId = req.user?.branchId;
      if (!accountantBranchId) {
        return res.status(403).json({
          success: false,
          error: 'ACCOUNTANT_BRANCH_UNASSIGNED',
          message: 'Forbidden: Accountant is not assigned to any branch.'
        });
      }
      const cashbox = await db.cashbox.findFirst({
        where: { id, institutionId: institutionId as string, deletedAt: null }
      });
      if (!cashbox) {
        return res.status(404).json({ message: 'Cashbox not found' });
      }
      if (cashbox.branchId !== accountantBranchId) {
        return res.status(403).json({
          success: false,
          error: 'CROSS_BRANCH_ACCESS_DENIED',
          message: 'Forbidden: Accountants cannot view cashbox transactions of other branches.'
        });
      }
    }

    const pageNum = Math.max(1, parseInt(page as string, 10));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit as string, 10)));
    const skip = (pageNum - 1) * limitNum;

    const where: any = { cashboxId: id, institutionId: institutionId as string };
    if (businessDate) where.businessDate = businessDate as string;
    if (type) where.type = type as any;

    const [transactions, total] = await Promise.all([
      db.cashboxTransaction.findMany({
        where,
        orderBy: { timestamp: 'desc' },
        skip,
        take: limitNum,
        include: {
          actor: { select: { id: true, name: true, email: true, role: true } }
        }
      }),
      db.cashboxTransaction.count({ where })
    ]);

    return res.json({
      transactions,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum)
      }
    });
  } catch (error: any) {
    return res.status(500).json({ message: 'Error fetching cashbox transactions', error: error.message });
  }
};

/**
 * GET /api/accounting/cashbox/reconciliations
 * List historical reconciliations with strict server-side branch isolation and date range filtering
 */
export const getCashboxReconciliations = async (req: AuthRequest, res: Response) => {
  try {
    const scope = await resolveAccountingReportScope(req);
    if (!scope.ok) {
      return res.status(scope.status || 403).json({ message: scope.message });
    }

    const dateRange = resolveDateRangeFilter(req);
    if (!dateRange.ok) {
      return res.status(dateRange.status || 400).json({ message: dateRange.message });
    }

    const { cashboxId, status } = req.query;

    const where: any = { institutionId: scope.institutionId };
    if (scope.branchId) {
      where.branchId = scope.branchId;
    }
    if (cashboxId) where.cashboxId = cashboxId as string;
    if (status) where.status = status as any;

    if (dateRange.startDate || dateRange.endDate) {
      where.reconciledAt = {};
      if (dateRange.startDate) where.reconciledAt.gte = dateRange.startDate;
      if (dateRange.endDate) where.reconciledAt.lte = dateRange.endDate;
    }

    const reconciliations = await db.cashboxReconciliation.findMany({
      where,
      orderBy: { reconciledAt: 'desc' },
      take: 100,
      include: {
        branch: { select: { id: true, name: true, code: true } },
        cashbox: { select: { id: true, name: true, code: true, currency: true } },
        reconciledBy: { select: { id: true, name: true, email: true } }
      }
    });

    const mapped = reconciliations.map((rec: any) => ({
      ...rec,
      expectedBalance: Number(rec.expectedClosingBalance || 0),
      actualBalance: Number(rec.actualCountedClosingBalance || 0),
      variance: Number(rec.difference || 0),
      createdAt: rec.reconciledAt
    }));

    return res.json(mapped);
  } catch (error: any) {
    return res.status(500).json({ message: 'Error fetching reconciliations', error: error.message });
  }
};
