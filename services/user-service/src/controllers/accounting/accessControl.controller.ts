import { Response } from 'express';
import { db } from '../../../../../packages/database/src/index.js';
import { AuthRequest, isAuthorizedPrimaryManager } from '../../middlewares/auth.middleware.js';
import { MonthlyFeeAccessControlService } from '../../services/monthlyFeeAccessControl.service.js';
import { logger } from '@shared/utils';

/**
 * GET /api/manager/financial-access-policy
 * Primary Manager: Fetch current grace policy configuration and audit history
 */
export const getFinancialAccessPolicy = async (req: AuthRequest, res: Response) => {
  try {
    if (!isAuthorizedPrimaryManager(req.user)) {
      return res.status(403).json({
        message: 'Forbidden: Strictly restricted to the canonical Primary Manager (role=ADMIN, isPrimaryManager=true).'
      });
    }
    const institutionId = req.user?.institutionId || req.tenantContext?.institutionId;
    if (!institutionId) {
      return res.status(401).json({ message: 'Unauthorized: Missing institution context' });
    }

    const policies = await db.monthlyFeePolicy.findMany({
      where: { institutionId },
      include: {
        branch: { select: { id: true, name: true, code: true } }
      }
    });

    let globalPolicy = policies.find(p => p.branchId === null);
    const branchOverrides = policies.filter(p => p.branchId !== null);

    const audits = await db.monthlyFeePolicyAudit.findMany({
      where: { institutionId },
      orderBy: { createdAt: 'desc' },
      take: 20,
      include: {
        changedBy: { select: { id: true, name: true, email: true } }
      }
    });

    if (!globalPolicy) {
      return res.json({
        success: true,
        configured: false,
        policy: null,
        branchOverrides: [],
        recentAudits: audits,
        message: 'No monthly fee policy is currently configured for this institution.'
      });
    }

    return res.json({
      success: true,
      policy: {
        mode: globalPolicy.policyMode,
        isEnabled: globalPolicy.isEnabled,
        globalGraceDays: globalPolicy.gracePeriodDays,
        updatedAt: globalPolicy.updatedAt
      },
      branchOverrides: branchOverrides.map(b => ({
        branchId: b.branchId,
        branchName: b.branch?.name,
        branchCode: b.branch?.code,
        gracePeriodDays: b.gracePeriodDays,
        isEnabled: b.isEnabled
      })),
      recentAudits: audits
    });
  } catch (error: any) {
    logger.error(`[AccessControl] Error retrieving policy: ${error.message}`);
    return res.status(500).json({ message: 'Error retrieving policy', error: error.message });
  }
};

/**
 * PUT /api/manager/financial-access-policy
 * Primary Manager: Update policy mode, global days, and branch overrides
 */
export const updateFinancialAccessPolicy = async (req: AuthRequest, res: Response) => {
  try {
    const institutionId = req.user?.institutionId || req.tenantContext?.institutionId;
    const actorUserId = req.user?.userId;
    const actorRole = (req.user?.role || '').toUpperCase();

    if (!institutionId || !actorUserId) {
      return res.status(401).json({ message: 'Unauthorized: Missing user or tenant context' });
    }

    // Role Gate: ONLY Canonical Primary Manager (role=ADMIN, isPrimaryManager=true) can update policy
    if (!isAuthorizedPrimaryManager(req.user)) {
      return res.status(403).json({
        message: 'Forbidden: Only Primary Managers have authority to configure monthly fee grace policies.'
      });
    }

    const { policyMode, gracePeriodDays, isEnabled, branchOverrides, reason } = req.body;

    const currentGlobal = await db.monthlyFeePolicy.findFirst({
      where: { institutionId, branchId: null }
    });

    const previousMode = currentGlobal?.policyMode || 'GLOBAL';
    const previousDays = currentGlobal?.gracePeriodDays || 5;

    const newMode = policyMode ? (policyMode === 'PER_BRANCH' ? 'PER_BRANCH' : 'GLOBAL') : previousMode;
    const newDays = gracePeriodDays !== undefined ? Math.max(0, Math.min(60, Number(gracePeriodDays))) : previousDays;
    const newEnabled = isEnabled !== undefined ? Boolean(isEnabled) : (currentGlobal ? currentGlobal.isEnabled : true);

    await db.$transaction(async (tx) => {
      // 1. Upsert Global Policy
      await tx.monthlyFeePolicy.upsert({
        where: {
          institutionId_branchId: {
            institutionId: institutionId as string,
            branchId: null as any
          }
        },
        create: {
          institutionId: institutionId as string,
          branchId: null,
          policyMode: newMode,
          gracePeriodDays: newDays,
          isEnabled: newEnabled,
          configuredById: actorUserId
        },
        update: {
          policyMode: newMode,
          gracePeriodDays: newDays,
          isEnabled: newEnabled,
          configuredById: actorUserId
        }
      });

      // 2. Log Audit Entry
      await tx.monthlyFeePolicyAudit.create({
        data: {
          institutionId: institutionId as string,
          branchId: null,
          previousMode,
          newMode,
          previousDays,
          newDays,
          changedById: actorUserId,
          reason: reason || `Updated monthly fee grace policy to ${newMode} mode (${newDays} days)`
        }
      });

      // 3. Process Per-Branch Overrides if in PER_BRANCH mode
      if (newMode === 'PER_BRANCH' && Array.isArray(branchOverrides)) {
        for (const override of branchOverrides) {
          if (!override.branchId) continue;
          const bDays = Math.max(0, Math.min(60, Number(override.gracePeriodDays || newDays)));
          const bEnabled = override.isEnabled !== undefined ? Boolean(override.isEnabled) : true;

          await tx.monthlyFeePolicy.upsert({
            where: {
              institutionId_branchId: {
                institutionId: institutionId as string,
                branchId: override.branchId
              }
            },
            create: {
              institutionId: institutionId as string,
              branchId: override.branchId,
              policyMode: 'PER_BRANCH',
              gracePeriodDays: bDays,
              isEnabled: bEnabled,
              configuredById: actorUserId
            },
            update: {
              policyMode: 'PER_BRANCH',
              gracePeriodDays: bDays,
              isEnabled: bEnabled,
              configuredById: actorUserId
            }
          });
        }
      }
    });

    // 4. Trigger immediate re-evaluation across all active students
    let evaluationSummary = null;
    try {
      evaluationSummary = await MonthlyFeeAccessControlService.runScheduledFinancialAccessEvaluation(institutionId as string);
    } catch (evalErr: any) {
      logger.error(`[AccessControl] Error during post-update re-evaluation: ${evalErr.message}`);
    }

    return res.json({
      success: true,
      message: 'Monthly fee grace policy updated successfully',
      policy: {
        mode: newMode,
        gracePeriodDays: newDays,
        isEnabled: newEnabled
      },
      evaluationSummary
    });
  } catch (error: any) {
    logger.error(`[AccessControl] Error updating policy: ${error.message}`);
    return res.status(500).json({ message: 'Error updating policy', error: error.message });
  }
};

/**
 * GET /api/manager/financial-restrictions
 * Primary Manager / Accountant: Review all currently restricted students and history
 */
export const getFinancialRestrictionsList = async (req: AuthRequest, res: Response) => {
  try {
    const institutionId = req.user?.institutionId || req.tenantContext?.institutionId;
    if (!institutionId) {
      return res.status(401).json({ message: 'Unauthorized: Missing institution context' });
    }

    const restrictedStudents = await db.user.findMany({
      where: {
        institutionId,
        role: 'CENTER_STUDENT',
        financialAccessStatus: 'RESTRICTED',
        deletedAt: null
      },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        branchId: true,
        branch: { select: { id: true, name: true, code: true } },
        studentObligations: {
          where: {
            isMonthlyFee: true,
            status: { notIn: ['FULFILLED', 'WAIVED'] }
          },
          select: {
            id: true,
            billingMonth: true,
            amountDue: true,
            amountCollected: true,
            dueDate: true,
            status: true
          }
        },
        studentRestrictionHistories: {
          orderBy: { createdAt: 'desc' },
          take: 5
        }
      }
    });

    const recentHistory = await db.financialRestrictionHistory.findMany({
      where: { institutionId },
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: {
        student: { select: { id: true, name: true, email: true } },
        branch: { select: { id: true, name: true } }
      }
    });

    return res.json({
      success: true,
      restrictedCount: restrictedStudents.length,
      restrictedStudents: restrictedStudents.map(s => {
        const totalOverdue = s.studentObligations.reduce((sum, o) => sum + (Number(o.amountDue) - Number(o.amountCollected)), 0);
        return {
          id: s.id,
          name: s.name,
          email: s.email,
          phone: s.phone,
          branch: s.branch,
          totalOutstandingMonthlyBalance: totalOverdue,
          overdueMonthlyObligations: s.studentObligations.map(o => ({
            id: o.id,
            billingMonth: o.billingMonth,
            amountDue: Number(o.amountDue),
            amountCollected: Number(o.amountCollected),
            unpaidBalance: Number(o.amountDue) - Number(o.amountCollected),
            dueDate: o.dueDate
          })),
          latestRestrictionEvent: s.studentRestrictionHistories[0] || null
        };
      }),
      recentHistory
    });
  } catch (error: any) {
    logger.error(`[AccessControl] Error fetching restrictions: ${error.message}`);
    return res.status(500).json({ message: 'Error fetching restrictions', error: error.message });
  }
};

/**
 * POST /api/manager/financial-access/evaluate
 * Primary Manager: On-demand evaluation trigger
 */
export const triggerFinancialEvaluation = async (req: AuthRequest, res: Response) => {
  try {
    if (!isAuthorizedPrimaryManager(req.user)) {
      return res.status(403).json({
        message: 'Forbidden: Strictly restricted to the canonical Primary Manager (role=ADMIN, isPrimaryManager=true).'
      });
    }
    const institutionId = req.user?.institutionId || req.tenantContext?.institutionId;
    if (!institutionId) {
      return res.status(401).json({ message: 'Unauthorized: Missing institution context' });
    }

    const { studentId } = req.body;
    if (studentId) {
      const result = await MonthlyFeeAccessControlService.evaluateStudentFinancialAccess(studentId, new Date(), 'MANUAL_TRIGGER');
      return res.json({ success: true, result });
    }

    const summary = await MonthlyFeeAccessControlService.runScheduledFinancialAccessEvaluation(institutionId, new Date());
    return res.json({ success: true, summary });
  } catch (error: any) {
    logger.error(`[AccessControl] Error triggering evaluation: ${error.message}`);
    return res.status(500).json({ message: 'Error triggering evaluation', error: error.message });
  }
};

/**
 * GET /api/users/financial-access-status
 * Student / Guardian: Retrieve own financial access status, restriction details, and payment instructions
 */
export const getMyFinancialAccessStatus = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    const role = (req.user?.role || '').toUpperCase();
    const institutionId = req.user?.institutionId;

    if (!userId) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    // Student self-check
    if (role === 'CENTER_STUDENT') {
      const student = await db.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          name: true,
          financialAccessStatus: true,
          branch: { select: { id: true, name: true, code: true } },
          institution: { select: { id: true, name: true } },
          studentObligations: {
            where: {
              isMonthlyFee: true,
              status: { notIn: ['FULFILLED', 'WAIVED'] }
            },
            select: {
              id: true,
              billingMonth: true,
              amountDue: true,
              amountCollected: true,
              dueDate: true
            }
          }
        }
      });

      if (!student) {
        return res.status(404).json({ message: 'Student account not found' });
      }

      const overdue = student.studentObligations.map(o => ({
        id: o.id,
        billingMonth: o.billingMonth,
        amountDue: Number(o.amountDue),
        amountCollected: Number(o.amountCollected),
        unpaidBalance: Number(o.amountDue) - Number(o.amountCollected),
        dueDate: o.dueDate
      }));

      const totalOutstanding = overdue.reduce((sum, o) => sum + o.unpaidBalance, 0);

      return res.json({
        isRestricted: student.financialAccessStatus === 'RESTRICTED',
        financialAccessStatus: student.financialAccessStatus,
        studentName: student.name,
        branchName: student.branch?.name || 'الفرع الرئيسي',
        totalOutstanding,
        overdueMonthlyObligations: overdue,
        paymentInstructions: {
          title: 'تعليمات تسوية الرسوم الشهرية واستعادة الخدمة',
          details: 'يرجى التوجه إلى قسم المحاسبة والخزينة في فرعك التعليمي لسداد الرسوم المقررة (نقداً أو عبر نقاط البيع الإلكترونية POS). فور إتمام السداد وإصدار الإيصال الرسمي، يتم رفع التقييد واستعادة الوصول تلقائياً دون الحاجة لأي إجراء إضافي.',
          cashboxLocation: student.branch?.name || 'مكتب الخزينة الرئيسي'
        }
      });
    }

    // Guardian check: linked children
    if (role === 'PARENT') {
      const children = await db.user.findMany({
        where: {
          parentId: userId,
          deletedAt: null
        },
        select: {
          id: true,
          name: true,
          financialAccessStatus: true,
          branch: { select: { id: true, name: true } },
          studentObligations: {
            where: {
              isMonthlyFee: true,
              status: { notIn: ['FULFILLED', 'WAIVED'] }
            },
            select: {
              id: true,
              billingMonth: true,
              amountDue: true,
              amountCollected: true,
              dueDate: true
            }
          }
        }
      });

      return res.json({
        role: 'PARENT',
        children: children.map(c => {
          const overdue = c.studentObligations.map(o => ({
            id: o.id,
            billingMonth: o.billingMonth,
            amountDue: Number(o.amountDue),
            amountCollected: Number(o.amountCollected),
            unpaidBalance: Number(o.amountDue) - Number(o.amountCollected)
          }));
          const totalOutstanding = overdue.reduce((sum, o) => sum + o.unpaidBalance, 0);
          return {
            studentId: c.id,
            studentName: c.name,
            branchName: c.branch?.name,
            financialAccessStatus: c.financialAccessStatus,
            isRestricted: c.financialAccessStatus === 'RESTRICTED',
            totalOutstanding,
            overdueMonthlyObligations: overdue
          };
        })
      });
    }

    return res.json({
      isRestricted: false,
      financialAccessStatus: 'ACTIVE'
    });
  } catch (error: any) {
    logger.error(`[AccessControl] Error checking status: ${error.message}`);
    return res.status(500).json({ message: 'Error checking financial access status', error: error.message });
  }
};

