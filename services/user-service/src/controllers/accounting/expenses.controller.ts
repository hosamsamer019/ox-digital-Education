import { Response } from 'express';
import { db } from '../../../../../packages/database/src/index.js';
import { AuthRequest, isAuthorizedPrimaryManager } from '../../middlewares/auth.middleware.js';
import { resolveAccountingReportScope, resolveDateRangeFilter } from '../../utils/accountingScope.util.js';
import { NotificationEventService } from '../../services/notificationEvent.service.js';
import { logger } from '@shared/utils';

/**
 * Generate unique sequential voucher number
 * Format: EXP-YYYYMM-XXXX
 */
function generateVoucherNumber(): string {
  const ym = new Date().toISOString().slice(0, 7).replace(/-/g, '');
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `EXP-${ym}-${rand}`;
}

/**
 * POST /api/accounting/expenses
 * Submit a new expense voucher
 */
export const createExpenseVoucher = async (req: AuthRequest, res: Response) => {
  try {
    const institutionId = req.user?.institutionId || req.tenantContext?.institutionId;
    const defaultBranchId = req.user?.branchId || req.tenantContext?.branchId;
    const preparedById = req.user?.userId;

    if (!institutionId || !preparedById) {
      return res.status(401).json({ message: 'Unauthorized: Missing tenant or user identity' });
    }

    const {
      category,
      payeeName,
      amount,
      description,
      paymentSource = 'CASHBOX',
      cashboxId,
      bankAccountId,
      branchId,
      receiptAttachmentUrl,
      notes
    } = req.body;

    if (!category || !payeeName || !amount || Number(amount) <= 0 || !description) {
      return res.status(400).json({
        message: 'category, payeeName, positive amount, and description are mandatory'
      });
    }

    const numAmount = Number(amount);
    const userRole = (req.user?.role || '').toUpperCase();

    // Strict branch scoping for Accountants
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
          message: 'Forbidden: Accountants cannot create expense vouchers for other branches.'
        });
      }
    }

    const targetBranchId = userRole === 'ACCOUNTANT'
      ? (req.user?.branchId as string)
      : (branchId || defaultBranchId || (await db.branch.findFirst({
          where: { institutionId: institutionId as string, isDefault: true }
        }))?.id);

    if (!targetBranchId) {
      return res.status(400).json({ message: 'Valid branchId required for expense voucher' });
    }

    const voucherNumber = generateVoucherNumber();

    const voucher = await db.expenseVoucher.create({
      data: {
        institutionId: institutionId as string,
        branchId: targetBranchId,
        voucherNumber,
        category: category.trim().toUpperCase(),
        payeeName: payeeName.trim(),
        amount: numAmount,
        description: description.trim(),
        paymentSource: paymentSource.toUpperCase(),
        cashboxId: cashboxId || null,
        bankAccountId: bankAccountId || null,
        status: 'PENDING_APPROVAL',
        preparedById,
        receiptAttachmentUrl: receiptAttachmentUrl || null,
        notes: notes || null
      },
      include: {
        preparedBy: { select: { id: true, name: true, email: true } },
        branch: { select: { id: true, name: true } },
        cashbox: { select: { id: true, name: true, code: true } }
      }
    });

    // Alert Primary Managers
    await NotificationEventService.onExpenseRequested({
      institutionId: institutionId as string,
      branchId: targetBranchId,
      voucherId: voucher.id,
      voucherNumber: voucher.voucherNumber,
      amount: numAmount,
      currency: 'EGP',
      category: voucher.category,
      description: voucher.description,
      requesterId: preparedById,
      requesterName: req.user?.email || 'Staff'
    });

    return res.status(201).json({
      message: 'Expense voucher submitted for management approval',
      voucher
    });
  } catch (error: any) {
    logger.error(`[Accounting] Error submitting expense voucher: ${error.message}`);
    return res.status(500).json({ message: 'Error submitting expense voucher', error: error.message });
  }
};

/**
 * GET /api/accounting/expenses
 * List expense vouchers with strict server-side branch scoping, date range validation, and summary totals
 */
export const listExpenseVouchers = async (req: AuthRequest, res: Response) => {
  try {
    const scope = await resolveAccountingReportScope(req);
    if (!scope.ok) {
      return res.status(scope.status || 403).json({ message: scope.message });
    }

    const dateRange = resolveDateRangeFilter(req);
    if (!dateRange.ok) {
      return res.status(dateRange.status || 400).json({ message: dateRange.message });
    }

    const { status, category, pendingDisbursement, page = '1', limit = '50' } = req.query;

    const pageNum = Math.max(1, parseInt(page as string, 10) || 1);
    const limitNum = Math.min(200, Math.max(1, parseInt(limit as string, 10) || 50));
    const skip = (pageNum - 1) * limitNum;

    const where: any = { institutionId: scope.institutionId };
    if (scope.branchId) {
      where.branchId = scope.branchId;
    }

    const normalizedStatus = typeof status === 'string' ? status.trim().toUpperCase() : undefined;
    if (normalizedStatus === 'APPROVED' || pendingDisbursement === 'true') {
      // Strictly actionable approved vouchers awaiting physical disbursement
      where.status = 'APPROVED';
      where.disbursedAt = null;
      where.disbursedById = null;
    } else if (normalizedStatus) {
      where.status = normalizedStatus as any;
    }
    if (category) where.category = category as string;

    if (dateRange.startDate || dateRange.endDate) {
      where.createdAt = {};
      if (dateRange.startDate) where.createdAt.gte = dateRange.startDate;
      if (dateRange.endDate) where.createdAt.lte = dateRange.endDate;
    }

    const [vouchers, total, aggregateTotals, branchInfo] = await Promise.all([
      db.expenseVoucher.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limitNum,
        include: {
          branch: { select: { id: true, name: true, code: true } },
          preparedBy: { select: { id: true, name: true, email: true } },
          approvedBy: { select: { id: true, name: true, email: true } },
          disbursedBy: { select: { id: true, name: true, email: true } },
          cashbox: { select: { id: true, name: true, code: true } },
          bankAccount: { select: { id: true, bankName: true, accountNumber: true } }
        }
      }),
      db.expenseVoucher.count({ where }),
      db.expenseVoucher.aggregate({
        where,
        _sum: { amount: true },
        _count: { id: true }
      }),
      scope.branchId
        ? db.branch.findUnique({ where: { id: scope.branchId }, select: { id: true, name: true, code: true } })
        : Promise.resolve(null)
    ]);

    return res.json({
      vouchers,
      branchScope: branchInfo || { id: 'ALL', name: 'جميع فروع المؤسسة', code: 'ALL' },
      summary: {
        totalCount: aggregateTotals._count.id,
        totalAmount: Number(aggregateTotals._sum.amount || 0),
        currency: 'EGP'
      },
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum)
      }
    });
  } catch (error: any) {
    return res.status(500).json({ message: 'Error listing expense vouchers', error: error.message });
  }
};

/**
 * POST /api/accounting/expenses/:id/approve
 * Review and Approve/Reject an expense voucher
 * STRICT RULE: Anti-self-approval enforcement
 */
export const approveExpenseVoucher = async (req: AuthRequest, res: Response) => {
  try {
    const institutionId = req.user?.institutionId || req.tenantContext?.institutionId;
    const reviewerId = req.user?.userId;
    const reviewerRole = (req.user?.role || '').toUpperCase();
    const { id } = req.params;
    const { decision, notes } = req.body;

    if (!institutionId || !reviewerId) {
      return res.status(401).json({ message: 'Unauthorized: Missing tenant or user identity' });
    }

    if (!isAuthorizedPrimaryManager(req.user)) {
      return res.status(403).json({ message: 'Forbidden: Only Primary Managers can approve expense vouchers' });
    }

    if (!['APPROVE', 'REJECT'].includes(decision)) {
      return res.status(400).json({ message: 'decision must be APPROVE or REJECT' });
    }

    const voucher = await db.expenseVoucher.findFirst({
      where: { id, institutionId: institutionId as string }
    });

    if (!voucher) {
      return res.status(404).json({ message: 'Expense voucher not found' });
    }

    if (voucher.status !== 'PENDING_APPROVAL') {
      return res.status(400).json({ message: `Voucher is already in ${voucher.status} state` });
    }

    // MANDATORY AUDIT RULE: Enforce anti-self-approval
    if (voucher.preparedById === reviewerId) {
      return res.status(403).json({
        message: 'Forbidden: Self-approval of expense vouchers is strictly prohibited by internal controls.'
      });
    }

    const isApproval = decision === 'APPROVE';
    const updated = await db.expenseVoucher.update({
      where: { id: voucher.id },
      data: {
        status: isApproval ? 'APPROVED' : 'REJECTED',
        approvedById: reviewerId,
        approvedAt: new Date(),
        notes: notes ? (voucher.notes ? `${voucher.notes} | ${notes}` : notes) : voucher.notes
      },
      include: {
        preparedBy: { select: { id: true, name: true, email: true } },
        approvedBy: { select: { id: true, name: true, email: true } }
      }
    });

    if (isApproval) {
      await NotificationEventService.onExpenseApproved({
        institutionId: institutionId as string,
        branchId: voucher.branchId,
        voucherId: voucher.id,
        voucherNumber: voucher.voucherNumber,
        amount: Number(voucher.amount),
        currency: 'EGP',
        approverId: reviewerId,
        approverName: req.user?.email || 'Primary Manager',
        requesterId: voucher.preparedById
      });
    }

    return res.json({
      message: `Voucher ${decision.toLowerCase()}d successfully`,
      voucher: updated
    });
  } catch (error: any) {
    logger.error(`[Accounting] Error reviewing expense voucher: ${error.message}`);
    return res.status(500).json({ message: 'Error reviewing voucher', error: error.message });
  }
};

/**
 * POST /api/accounting/expenses/:id/disburse
 * Execute cash or bank payout for an approved expense voucher
 */
export const disburseExpenseVoucher = async (req: AuthRequest, res: Response) => {
  try {
    const institutionId = req.user?.institutionId || req.tenantContext?.institutionId;
    const disburserId = req.user?.userId;
    const disburserRole = (req.user?.role || '').toUpperCase();
    const { id } = req.params;
    const { cashboxId, bankAccountId, notes } = req.body;

    if (!institutionId || !disburserId) {
      return res.status(401).json({ message: 'Unauthorized: Missing tenant or user identity' });
    }

    if (disburserRole !== 'ACCOUNTANT' && !isAuthorizedPrimaryManager(req.user)) {
      return res.status(403).json({ message: 'Forbidden: Insufficient permissions to disburse expenses' });
    }

    // Critical Fix A: Strict Branch Ownership verification for Accountants
    if (disburserRole === 'ACCOUNTANT') {
      const accountantBranchId = req.user?.branchId;
      if (!accountantBranchId) {
        return res.status(403).json({
          success: false,
          error: 'ACCOUNTANT_BRANCH_UNASSIGNED',
          message: 'Forbidden: Accountant is not assigned to any branch.'
        });
      }
    }

    const voucher = await db.expenseVoucher.findFirst({
      where: { id, institutionId: institutionId as string },
      include: { preparedBy: true }
    });

    if (!voucher) {
      return res.status(404).json({ message: 'Expense voucher not found' });
    }

    // Critical Fix A: Object-level branch verification before any state changes
    if (disburserRole === 'ACCOUNTANT') {
      const accountantBranchId = req.user?.branchId;
      if (voucher.branchId !== accountantBranchId) {
        return res.status(403).json({
          success: false,
          error: 'CROSS_BRANCH_ACCESS_DENIED',
          message: 'Forbidden: Accountants cannot disburse expense vouchers belonging to other branches.'
        });
      }
    }

    if (voucher.status !== 'APPROVED') {
      return res.status(400).json({ message: `Cannot disburse voucher in ${voucher.status} state. Only APPROVED vouchers can be disbursed.` });
    }

    const amountNum = Number(voucher.amount);

    const result = await db.$transaction(async (tx) => {
      let resolvedCashboxId = cashboxId || voucher.cashboxId;

      if (voucher.paymentSource === 'CASHBOX') {
        if (!resolvedCashboxId) {
          const defaultBox = await tx.cashbox.findFirst({
            where: { institutionId: institutionId as string, branchId: voucher.branchId, status: 'ACTIVE', deletedAt: null }
          });
          resolvedCashboxId = defaultBox?.id;
        }

        if (!resolvedCashboxId) {
          throw new Error('An active cashbox is required to disburse cash expenses');
        }

        const cashbox = await tx.cashbox.findFirst({
          where: { id: resolvedCashboxId, institutionId: institutionId as string, branchId: voucher.branchId, status: 'ACTIVE', deletedAt: null }
        });

        if (!cashbox) {
          throw new Error('Cashbox not found or is inactive');
        }

        if (Number(cashbox.currentBalance) < amountNum) {
          throw new Error(`Insufficient cashbox balance (${cashbox.currentBalance} EGP) for voucher amount (${amountNum} EGP)`);
        }

        const updatedCashbox = await tx.cashbox.update({
          where: { id: cashbox.id },
          data: {
            currentBalance: { decrement: amountNum }
          }
        });

        await tx.cashboxTransaction.create({
          data: {
            institutionId: institutionId as string,
            branchId: voucher.branchId,
            cashboxId: cashbox.id,
            type: 'EXPENSE',
            amount: amountNum,
            balanceAfter: updatedCashbox.currentBalance,
            businessDate: new Date().toISOString().slice(0, 10),
            actorUserId: disburserId,
            actorRole: (disburserRole as any) || 'ACCOUNTANT',
            referenceId: voucher.id,
            referenceType: 'EXPENSE',
            notes: `Disbursement for voucher #${voucher.voucherNumber} to ${voucher.payeeName}`,
            status: 'POSTED'
          }
        });
      }

      const disbursedVoucher = await tx.expenseVoucher.update({
        where: { id: voucher.id },
        data: {
          status: 'APPLIED',
          disbursedById: disburserId,
          disbursedAt: new Date(),
          cashboxId: resolvedCashboxId || null,
          notes: notes ? (voucher.notes ? `${voucher.notes} | ${notes}` : notes) : voucher.notes
        },
        include: {
          preparedBy: { select: { id: true, name: true, email: true } },
          approvedBy: { select: { id: true, name: true, email: true } },
          disbursedBy: { select: { id: true, name: true, email: true } },
          cashbox: { select: { id: true, name: true, code: true } }
        }
      });

      return disbursedVoucher;
    });

    await NotificationEventService.onExpenseDisbursed({
      institutionId: institutionId as string,
      voucherId: result.id,
      voucherNumber: result.voucherNumber,
      amount: amountNum,
      currency: 'EGP',
      disburserId: disburserId,
      disburserName: req.user?.email || 'Cashier',
      requesterId: result.preparedById,
      paymentMethod: result.paymentSource
    });

    return res.json({
      message: 'Expense disbursed successfully',
      voucher: result
    });
  } catch (error: any) {
    logger.error(`[Accounting] Error disbursing expense: ${error.message}`);
    return res.status(500).json({ message: error.message || 'Error disbursing expense' });
  }
};
