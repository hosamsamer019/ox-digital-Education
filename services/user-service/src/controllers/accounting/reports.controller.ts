import { Response } from 'express';
import { db } from '../../../../../packages/database/src/index.js';
import { AuthRequest } from '../../middlewares/auth.middleware.js';
import { resolveAccountingReportScope, resolveDateRangeFilter } from '../../utils/accountingScope.util.js';
import { logger } from '@shared/utils';

/**
 * GET /api/accounting/reports/summary
 * Executive financial health KPI overview with strict branch and date-range scoping
 */
export const getFinancialSummary = async (req: AuthRequest, res: Response) => {
  try {
    const scope = await resolveAccountingReportScope(req);
    if (!scope.ok) {
      return res.status(scope.status || 403).json({ message: scope.message });
    }

    const dateRange = resolveDateRangeFilter(req);
    if (!dateRange.ok) {
      return res.status(dateRange.status || 400).json({ message: dateRange.message });
    }

    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const now = new Date();

    const collectionWhere: any = { institutionId: scope.institutionId, status: 'COLLECTED' };
    const expenseWhere: any = { institutionId: scope.institutionId, status: 'APPLIED' };
    const cashboxWhere: any = { institutionId: scope.institutionId, status: 'ACTIVE', deletedAt: null };
    const arrearsWhere: any = {
      institutionId: scope.institutionId,
      status: { in: ['PENDING', 'PARTIALLY_PAID', 'OVERDUE'] },
      dueDate: { lt: now }
    };

    if (scope.branchId) {
      collectionWhere.branchId = scope.branchId;
      expenseWhere.branchId = scope.branchId;
      cashboxWhere.branchId = scope.branchId;
      arrearsWhere.branchId = scope.branchId;
    }

    if (dateRange.startDate || dateRange.endDate) {
      collectionWhere.collectedAt = {};
      expenseWhere.disbursedAt = {};
      if (dateRange.startDate) {
        collectionWhere.collectedAt.gte = dateRange.startDate;
        expenseWhere.disbursedAt.gte = dateRange.startDate;
      }
      if (dateRange.endDate) {
        collectionWhere.collectedAt.lte = dateRange.endDate;
        expenseWhere.disbursedAt.lte = dateRange.endDate;
      }
    }

    // 1. Total Collections (Lifetime/Filtered & MTD)
    const [allCollections, mtdCollections] = await Promise.all([
      db.collection.aggregate({
        where: collectionWhere,
        _sum: { amountCollected: true },
        _count: { id: true }
      }),
      db.collection.aggregate({
        where: {
          ...collectionWhere,
          collectedAt: {
            ...(collectionWhere.collectedAt || {}),
            gte: dateRange.startDate && dateRange.startDate > startOfMonth ? dateRange.startDate : startOfMonth
          }
        },
        _sum: { amountCollected: true },
        _count: { id: true }
      })
    ]);

    // 2. Total Disbursed Expenses (Lifetime/Filtered & MTD)
    const [allExpenses, mtdExpenses] = await Promise.all([
      db.expenseVoucher.aggregate({
        where: expenseWhere,
        _sum: { amount: true },
        _count: { id: true }
      }),
      db.expenseVoucher.aggregate({
        where: {
          ...expenseWhere,
          disbursedAt: {
            ...(expenseWhere.disbursedAt || {}),
            gte: dateRange.startDate && dateRange.startDate > startOfMonth ? dateRange.startDate : startOfMonth
          }
        },
        _sum: { amount: true },
        _count: { id: true }
      })
    ]);

    // 3. Current Cash in Tills
    const cashboxes = await db.cashbox.aggregate({
      where: cashboxWhere,
      _sum: { currentBalance: true },
      _count: { id: true }
    });

    // 4. Student Arrears
    const overdueObligations = await db.studentObligation.findMany({
      where: arrearsWhere,
      select: {
        amountDue: true,
        amountCollected: true
      }
    });

    let totalArrears = 0;
    for (const ob of overdueObligations) {
      totalArrears += (Number(ob.amountDue) - Number(ob.amountCollected));
    }

    const totalIncome = Number(allCollections._sum.amountCollected || 0);
    const totalOutflow = Number(allExpenses._sum.amount || 0);
    const netCashPosition = totalIncome - totalOutflow;

    const mtdIncome = Number(mtdCollections._sum.amountCollected || 0);
    const mtdOutflow = Number(mtdExpenses._sum.amount || 0);
    const mtdNet = mtdIncome - mtdOutflow;

    return res.json({
      currency: 'EGP',
      branchId: scope.branchId || 'ALL',
      lifetime: {
        totalCollections: totalIncome,
        collectionsCount: allCollections._count.id,
        totalExpenses: totalOutflow,
        expensesCount: allExpenses._count.id,
        netOperatingBalance: netCashPosition
      },
      currentMonth: {
        totalCollections: mtdIncome,
        collectionsCount: mtdCollections._count.id,
        totalExpenses: mtdOutflow,
        expensesCount: mtdExpenses._count.id,
        netOperatingBalance: mtdNet
      },
      liquidity: {
        cashInTills: Number(cashboxes._sum.currentBalance || 0),
        activeCashboxesCount: cashboxes._count.id
      },
      receivables: {
        totalArrears,
        overdueObligationsCount: overdueObligations.length
      }
    });
  } catch (error: any) {
    logger.error(`[Accounting] Error generating financial summary: ${error.message}`);
    return res.status(500).json({ message: 'Error generating financial summary', error: error.message });
  }
};

/**
 * GET /api/accounting/reports/arrears
 * Overdue aging roster with guardian contact info, strict branch isolation, and date range filtering
 */
export const getArrearsReport = async (req: AuthRequest, res: Response) => {
  try {
    const scope = await resolveAccountingReportScope(req);
    if (!scope.ok) {
      return res.status(scope.status || 403).json({ message: scope.message });
    }

    const dateRange = resolveDateRangeFilter(req);
    if (!dateRange.ok) {
      return res.status(dateRange.status || 400).json({ message: dateRange.message });
    }

    const now = new Date();
    const dueDateFilter: any = { lt: now };
    if (dateRange.startDate) {
      dueDateFilter.gte = dateRange.startDate;
    }
    if (dateRange.endDate) {
      dueDateFilter.lte = dateRange.endDate < now ? dateRange.endDate : now;
    }

    const where: any = {
      institutionId: scope.institutionId,
      status: { in: ['PENDING', 'PARTIALLY_PAID', 'OVERDUE'] },
      dueDate: dueDateFilter
    };

    if (scope.branchId) {
      where.branchId = scope.branchId;
    }

    const [overdueObligations, branchInfo] = await Promise.all([
      db.studentObligation.findMany({
        where,
        orderBy: { dueDate: 'asc' },
        include: {
          branch: { select: { id: true, name: true, code: true } },
          student: {
            select: {
              id: true,
              name: true,
              phone: true,
              email: true,
              parentId: true
            }
          },
          agreement: {
            select: {
              agreementNumber: true,
              catalogPrice: true
            }
          }
        }
      }),
      scope.branchId
        ? db.branch.findUnique({ where: { id: scope.branchId }, select: { id: true, name: true, code: true } })
        : Promise.resolve(null)
    ]);

    const report = overdueObligations.map((ob: any) => {
      const due = Number(ob.amountDue);
      const collected = Number(ob.amountCollected);
      const outstanding = Math.max(0, due - collected);
      const daysOverdue = Math.max(0, Math.floor((now.getTime() - new Date(ob.dueDate).getTime()) / (1000 * 60 * 60 * 24)));

      return {
        obligationId: ob.id,
        branchId: ob.branchId,
        branchName: ob.branch?.name,
        agreementNumber: ob.agreement?.agreementNumber,
        scheduleItemNumber: ob.scheduleItemNumber,
        studentId: ob.student?.id,
        studentName: ob.student?.name,
        studentPhone: ob.student?.phone,
        dueDate: ob.dueDate,
        amountDue: due,
        amountCollected: collected,
        outstandingAmount: outstanding,
        daysOverdue,
        currency: 'EGP'
      };
    });

    const totalAmountDue = report.reduce((sum, item) => sum + item.amountDue, 0);
    const totalAmountCollected = report.reduce((sum, item) => sum + item.amountCollected, 0);
    const totalArrearsAmount = report.reduce((sum, item) => sum + item.outstandingAmount, 0);

    return res.json({
      branchScope: branchInfo || { id: 'ALL', name: 'جميع فروع المؤسسة', code: 'ALL' },
      totalOverdueCount: report.length,
      totalArrearsAmount,
      summary: {
        totalCount: report.length,
        totalAmountDue,
        totalAmountCollected,
        totalAmount: totalArrearsAmount,
        currency: 'EGP'
      },
      currency: 'EGP',
      records: report
    });
  } catch (error: any) {
    logger.error(`[Accounting] Error generating arrears report: ${error.message}`);
    return res.status(500).json({ message: 'Error generating arrears report', error: error.message });
  }
};

/**
 * GET /api/accounting/reports/income-breakdown
 * Collections breakdown by payment method and timeline with branch scoping
 */
export const getIncomeBreakdown = async (req: AuthRequest, res: Response) => {
  try {
    const scope = await resolveAccountingReportScope(req);
    if (!scope.ok) {
      return res.status(scope.status || 403).json({ message: scope.message });
    }

    const dateRange = resolveDateRangeFilter(req);
    if (!dateRange.ok) {
      return res.status(dateRange.status || 400).json({ message: dateRange.message });
    }

    const { days = '30' } = req.query;
    const daysNum = parseInt(days as string, 10) || 30;
    const defaultStartDate = new Date();
    defaultStartDate.setDate(defaultStartDate.getDate() - daysNum);

    const collectionWhere: any = {
      institutionId: scope.institutionId,
      status: 'COLLECTED',
      collectedAt: {
        gte: dateRange.startDate || defaultStartDate,
        ...(dateRange.endDate ? { lte: dateRange.endDate } : {})
      }
    };

    if (scope.branchId) {
      collectionWhere.branchId = scope.branchId;
    }

    const tenders = await db.collectionTender.findMany({
      where: {
        collection: collectionWhere
      },
      select: {
        tenderType: true,
        amount: true
      }
    });

    const methodTotals: Record<string, { total: number; count: number }> = {};
    for (const t of tenders) {
      const type = t.tenderType;
      const amt = Number(t.amount);
      if (!methodTotals[type]) {
        methodTotals[type] = { total: 0, count: 0 };
      }
      methodTotals[type].total += amt;
      methodTotals[type].count += 1;
    }

    return res.json({
      branchId: scope.branchId || 'ALL',
      periodDays: daysNum,
      startDate: dateRange.startDate || defaultStartDate,
      endDate: dateRange.endDate || null,
      byPaymentMethod: methodTotals
    });
  } catch (error: any) {
    return res.status(500).json({ message: 'Error generating income breakdown', error: error.message });
  }
};
