import { Response } from 'express';
import { db } from '../../../../../packages/database/src/index.js';
import { AuthRequest, isAuthorizedPrimaryManager } from '../../middlewares/auth.middleware.js';
import { resolveAccountingReportScope } from '../../utils/accountingScope.util.js';
import { NotificationEventService } from '../../services/notificationEvent.service.js';
import { logger } from '@shared/utils';

/**
 * GET /api/accounting/pricing
 * List catalog pricing agreements for institution/branch
 */
export const listPricingAgreements = async (req: AuthRequest, res: Response) => {
  try {
    const institutionId = req.user?.institutionId || req.tenantContext?.institutionId;
    if (!institutionId) {
      return res.status(401).json({ message: 'Unauthorized: Missing tenant identity' });
    }

    const { isActive = 'true', courseId, centerGroupId } = req.query;

    const where: any = { institutionId: institutionId as string };
    if (isActive !== 'all') where.isActive = isActive === 'true';
    if (courseId) where.courseId = courseId as string;
    if (centerGroupId) where.centerGroupId = centerGroupId as string;

    const pricing = await db.groupPricingAgreement.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        branch: { select: { id: true, name: true } },
        centerGroup: { select: { id: true, name: true } },
        course: { select: { id: true, title: true } }
      }
    });

    return res.json(pricing);
  } catch (error: any) {
    logger.error(`[Accounting] Error listing pricing agreements: ${error.message}`);
    return res.status(500).json({ message: 'Error listing pricing agreements', error: error.message });
  }
};

/**
 * POST /api/accounting/pricing
 * Create or update group pricing agreement catalog item
 */
export const createPricingAgreement = async (req: AuthRequest, res: Response) => {
  try {
    const institutionId = req.user?.institutionId || req.tenantContext?.institutionId;
    const defaultBranchId = req.user?.branchId || req.tenantContext?.branchId;
    const userRole = (req.user?.role || '').toUpperCase();

    if (!institutionId) {
      return res.status(401).json({ message: 'Unauthorized: Missing tenant identity' });
    }

    if (!isAuthorizedPrimaryManager(req.user)) {
      return res.status(403).json({ message: 'Forbidden: Only Primary Managers can configure pricing catalog' });
    }

    const {
      code,
      name,
      standardPrice,
      discountAmount = 0,
      currency = 'EGP',
      startDate,
      endDate,
      branchId,
      centerGroupId,
      courseId
    } = req.body;

    if (!code || !name || !standardPrice || Number(standardPrice) <= 0) {
      return res.status(400).json({ message: 'code, name, and positive standardPrice are required' });
    }

    const stdPrice = Number(standardPrice);
    const disc = Number(discountAmount || 0);
    const effPrice = Math.max(0, stdPrice - disc);

    const targetBranchId = branchId || defaultBranchId;

    const agreement = await db.groupPricingAgreement.create({
      data: {
        institutionId: institutionId as string,
        branchId: targetBranchId || null,
        centerGroupId: centerGroupId || null,
        courseId: courseId || null,
        code: code.trim().toUpperCase(),
        name: name.trim(),
        standardPrice: stdPrice,
        discountAmount: disc,
        effectivePrice: effPrice,
        currency,
        startDate: startDate ? new Date(startDate) : new Date(),
        endDate: endDate ? new Date(endDate) : null,
        isActive: true
      }
    });

    return res.status(201).json({
      message: 'Pricing agreement created successfully',
      pricing: agreement
    });
  } catch (error: any) {
    logger.error(`[Accounting] Error creating pricing agreement: ${error.message}`);
    return res.status(500).json({ message: 'Error creating pricing agreement', error: error.message });
  }
};

/**
 * POST /api/accounting/agreements
 * Establish student financial agreement and generate scheduled obligations
 */
export const createStudentAgreement = async (req: AuthRequest, res: Response) => {
  try {
    const institutionId = req.user?.institutionId || req.tenantContext?.institutionId;
    const defaultBranchId = req.user?.branchId || req.tenantContext?.branchId;
    const userRole = (req.user?.role || '').toUpperCase();

    if (!institutionId) {
      return res.status(401).json({ message: 'Unauthorized: Missing tenant identity' });
    }

    if (!['ACCOUNTANT', 'PRIMARY_MANAGER', 'ADMIN'].includes(userRole)) {
      return res.status(403).json({ message: 'Forbidden: Insufficient permissions to create agreements' });
    }

    const {
      studentId,
      branchId,
      centerGroupId,
      catalogPrice,
      discountAmount = 0,
      totalSessionsCount = 12,
      periodsCount,
      installmentsCount,
      startDate = new Date().toISOString(),
      termsNotes
    } = req.body;

    if (!studentId || !catalogPrice || Number(catalogPrice) <= 0) {
      return res.status(400).json({ message: 'studentId and positive catalogPrice are required' });
    }

    const catPrice = Number(catalogPrice);
    const discount = Number(discountAmount || 0);
    const netAgreed = Math.max(0, catPrice - discount);

    // Verify student
    const student = await db.user.findFirst({
      where: { id: studentId, institutionId: institutionId as string, deletedAt: null }
    });

    if (!student) {
      return res.status(404).json({ message: 'Student not found in this institution' });
    }

    const currentUserId = req.user?.userId;

    if (userRole === 'PARENT') {
      if (student.parentId !== currentUserId) {
        return res.status(403).json({ message: 'Forbidden: Parents can only access financial statements of their linked children' });
      }
    } else if (['STUDENT', 'ONLINE_STUDENT', 'CENTER_STUDENT'].includes(userRole)) {
      if (student.id !== currentUserId) {
        return res.status(403).json({ message: 'Forbidden: Students can only access their own financial account' });
      }
    } else if (userRole === 'ACCOUNTANT') {
      const accountantBranchId = req.user?.branchId;
      if (!accountantBranchId) {
        return res.status(403).json({
          success: false,
          error: 'ACCOUNTANT_BRANCH_UNASSIGNED',
          message: 'Forbidden: Accountant is not assigned to any branch.'
        });
      }
      if (student.branchId && student.branchId !== accountantBranchId) {
        return res.status(403).json({
          success: false,
          error: 'CROSS_BRANCH_ACCESS_DENIED',
          message: 'Forbidden: Branch accountants can only access students in their assigned branch.'
        });
      }
      if (branchId && branchId !== accountantBranchId) {
        return res.status(403).json({
          success: false,
          error: 'CROSS_BRANCH_ACCESS_DENIED',
          message: 'Forbidden: Accountants cannot create agreements for other branches.'
        });
      }
    }

    const targetBranchId = userRole === 'ACCOUNTANT'
      ? (req.user?.branchId as string)
      : (branchId || defaultBranchId || student.branchId || (await db.branch.findFirst({
          where: { institutionId: institutionId as string, isDefault: true }
        }))?.id);

    if (!targetBranchId) {
      return res.status(400).json({ message: 'Valid branchId required for agreement' });
    }

    const agreementNumber = `AGR-${Date.now().toString().slice(-6)}`;

    const result = await db.$transaction(async (tx) => {
      // 1. Ensure StudentFinancialAccount exists
      let account = await tx.studentFinancialAccount.findFirst({
        where: { institutionId: institutionId as string, studentId }
      });

      if (!account) {
        account = await tx.studentFinancialAccount.create({
          data: {
            institutionId: institutionId as string,
            studentId,
            accountNumber: `AR-${studentId.slice(0, 8).toUpperCase()}`,
            currency: 'EGP',
            status: 'ACTIVE'
          }
        });
      }

      // Hybrid allocation split (e.g. 70% physical campus, 30% digital platform)
      const campusShare = Math.round(netAgreed * 0.7 * 100) / 100;
      const platformShare = Math.round((netAgreed - campusShare) * 100) / 100;

      // 2. Create StudentFinancialAgreement (Academic Fee Agreement)
      const agreement = await tx.studentFinancialAgreement.create({
        data: {
          institutionId: institutionId as string,
          branchId: targetBranchId,
          studentId,
          accountId: account.id,
          centerGroupId: centerGroupId || null,
          agreementNumber,
          catalogPrice: catPrice,
          discountAmount: discount,
          netAgreedPrice: netAgreed,
          physicalCampusAmount: campusShare,
          digitalPlatformAmount: platformShare,
          totalSessionsCount: Number(totalSessionsCount),
          status: 'ACTIVE',
          termsNotes: termsNotes || null,
          activatedAt: new Date()
        }
      });

      // 3. Generate Academic Fee Obligations (Default to 1 full academic period obligation)
      // Note: Academic fee obligations represent genuine academic period fees, NOT loan installments.
      const requestedPeriods = periodsCount || installmentsCount || 1;
      const numPeriods = Math.max(1, Math.min(12, Number(requestedPeriods)));
      const basePeriodAmount = Math.floor((netAgreed / numPeriods) * 100) / 100;
      let allocatedTotal = 0;

      const obligations = [];
      const start = new Date(startDate);

      for (let i = 1; i <= numPeriods; i++) {
        // Last period takes any rounding remainder
        const periodAmount = i === numPeriods ? (netAgreed - allocatedTotal) : basePeriodAmount;
        allocatedTotal += periodAmount;

        const dueDate = new Date(start);
        dueDate.setMonth(dueDate.getMonth() + (i - 1));
        const billingMonth = dueDate.toISOString().slice(0, 7);
        // Section 3.2: Academic obligations must continue to be classified independently
        // and must NOT inherit monthly defaults. An obligation is ONLY monthly if explicitly requested.
        const isMonthly = Boolean(req.body.isMonthlyFee) || req.body.obligationType === 'MONTHLY_FEE';
        const resolvedType = req.body.obligationType || (isMonthly ? 'MONTHLY_FEE' : (numPeriods === 1 ? 'FULL_PERIOD_FEE' : 'TERM_FEE'));

        // Prevent/reject incomplete monthly obligations
        if (isMonthly) {
          if (!targetBranchId || !studentId) {
            throw new Error('Incomplete monthly obligation: branchId and studentId are required.');
          }
          if (periodAmount <= 0) {
            throw new Error('Incomplete monthly obligation: amountDue must be greater than zero.');
          }
        }

        const obligation = await tx.studentObligation.create({
          data: {
            institutionId: institutionId as string,
            branchId: targetBranchId,
            studentId,
            agreementId: agreement.id,
            scheduleItemNumber: i,
            dueDate,
            amountDue: periodAmount,
            amountCollected: 0,
            status: 'PENDING',
            title: isMonthly ? `رسوم شهرية - استحقاق #${i}` : (numPeriods === 1 ? 'رسوم الفترة الأكاديمية المقررة' : `استحقاق أكاديمي #${i}`),
            isMonthlyFee: isMonthly,
            obligationType: resolvedType as any,
            billingMonth: isMonthly ? billingMonth : null
          }
        });
        obligations.push(obligation);
      }

      return { agreement, obligations, account };
    });

    return res.status(201).json({
      message: 'Student agreement and payment obligations established successfully',
      agreement: result.agreement,
      obligations: result.obligations
    });
  } catch (error: any) {
    logger.error(`[Accounting] Error creating student agreement: ${error.message}`);
    return res.status(500).json({ message: 'Error creating student agreement', error: error.message });
  }
};

/**
 * GET /api/accounting/students/:studentId/account
 * Complete sub-ledger for a student: account, agreement, obligations, collections, arrears
 */
export const getStudentFinancialAccount = async (req: AuthRequest, res: Response) => {
  try {
    const institutionId = req.user?.institutionId || req.tenantContext?.institutionId;
    const { studentId } = req.params;

    if (!institutionId) {
      return res.status(401).json({ message: 'Unauthorized: Missing tenant identity' });
    }

    const student = await db.user.findFirst({
      where: { id: studentId, institutionId: institutionId as string, deletedAt: null },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        role: true,
        parentId: true,
        branchId: true,
        financialAccessStatus: true
      }
    });

    if (!student) {
      return res.status(404).json({ message: 'Student not found in this institution' });
    }

    const userRole = (req.user?.role || '').toUpperCase();
    const currentUserId = req.user?.userId;

    if (userRole === 'PARENT') {
      if (student.parentId !== currentUserId) {
        return res.status(403).json({ message: 'Forbidden: Parents can only access financial statements of their linked children' });
      }
    } else if (['STUDENT', 'ONLINE_STUDENT', 'CENTER_STUDENT'].includes(userRole)) {
      if (student.id !== currentUserId) {
        return res.status(403).json({ message: 'Forbidden: Students can only access their own financial account' });
      }
    } else if (userRole === 'ACCOUNTANT') {
      const accountantBranchId = req.user?.branchId;
      if (!accountantBranchId) {
        return res.status(403).json({
          success: false,
          error: 'ACCOUNTANT_BRANCH_UNASSIGNED',
          message: 'Forbidden: Accountant is not assigned to any branch.'
        });
      }
      if (student.branchId && student.branchId !== accountantBranchId) {
        return res.status(403).json({
          success: false,
          error: 'CROSS_BRANCH_ACCESS_DENIED',
          message: 'Forbidden: Branch accountants can only access students in their assigned branch.'
        });
      }
    } else if (userRole === 'TEACHER') {
      const teachesStudent = await db.courseEnrollment.findFirst({
        where: {
          studentId: student.id,
          course: { teacherId: currentUserId }
        }
      });
      if (!teachesStudent) {
        return res.status(403).json({
          success: false,
          error: 'TEACHER_NOT_ENROLLED',
          message: 'Forbidden: Teachers can only view financial accounts of their enrolled students.'
        });
      }
    }

    const [account, agreements, obligations, collections] = await Promise.all([
      db.studentFinancialAccount.findFirst({
        where: { institutionId: institutionId as string, studentId }
      }),
      db.studentFinancialAgreement.findMany({
        where: { institutionId: institutionId as string, studentId },
        orderBy: { createdAt: 'desc' },
        include: {
          centerGroup: { select: { id: true, name: true } }
        }
      }),
      db.studentObligation.findMany({
        where: { institutionId: institutionId as string, studentId },
        orderBy: { dueDate: 'asc' },
        include: {
          allocations: {
            include: {
              collection: { select: { id: true, receiptNumber: true, collectedAt: true } }
            }
          }
        }
      }),
      db.collection.findMany({
        where: { institutionId: institutionId as string, studentId },
        orderBy: { collectedAt: 'desc' },
        include: {
          tenders: true,
          cashier: { select: { id: true, name: true } }
        }
      })
    ]);

    // Financial Sub-Ledger Calculations
    let totalCharged = 0;
    let totalCollected = 0;
    let arrears = 0;
    const now = new Date();

    for (const ob of obligations) {
      const due = Number(ob.amountDue);
      const collected = Number(ob.amountCollected);
      totalCharged += due;
      totalCollected += collected;

      if (ob.status !== 'FULFILLED' && ob.dueDate < now) {
        arrears += (due - collected);
      }
    }

    const netBalance = totalCharged - totalCollected;

    return res.json({
      student,
      account: account || {
        accountNumber: `AR-${student.id.slice(0, 8).toUpperCase()}`,
        status: 'ACTIVE',
        currency: 'EGP'
      },
      summary: {
        totalCharged,
        totalCollected,
        netBalance,
        arrears: Math.max(0, arrears),
        hasArrears: arrears > 0,
        currency: 'EGP'
      },
      agreements,
      obligations,
      collections
    });
  } catch (error: any) {
    logger.error(`[Accounting] Error fetching student account: ${error.message}`);
    return res.status(500).json({ message: 'Error fetching student financial account', error: error.message });
  }
};

/**
 * GET /api/accounting/students/sub-ledgers
 * Institutional roster of all student financial sub-ledgers with live balances and arrears
 */
export const listStudentSubLedgers = async (req: AuthRequest, res: Response) => {
  try {
    const scope = await resolveAccountingReportScope(req);
    if (!scope.ok) {
      return res.status(scope.status || 403).json({ message: scope.message });
    }

    const { hasArrears, search, page = '1', limit = '30' } = req.query;

    const pageNum = Math.max(1, parseInt(page as string, 10));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit as string, 10)));
    const skip = (pageNum - 1) * limitNum;

    const studentWhere: any = {
      institutionId: scope.institutionId,
      role: { in: ['CENTER_STUDENT', 'ONLINE_STUDENT'] },
      deletedAt: null
    };

    if (scope.branchId) studentWhere.branchId = scope.branchId;
    if (search) {
      studentWhere.OR = [
        { name: { contains: search as string, mode: 'insensitive' } },
        { phone: { contains: search as string } },
        { email: { contains: search as string, mode: 'insensitive' } }
      ];
    }

    const students = await db.user.findMany({
      where: studentWhere,
      skip,
      take: limitNum,
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        branchId: true,
        role: true,
        studentObligations: {
          where: {
            institutionId: scope.institutionId,
            ...(scope.branchId ? { branchId: scope.branchId } : {})
          },
          select: {
            amountDue: true,
            amountCollected: true,
            dueDate: true,
            status: true
          }
        }
      }
    });

    const now = new Date();
    const subLedgers = students.map((stu) => {
      let totalCharged = 0;
      let totalCollected = 0;
      let arrears = 0;

      for (const ob of stu.studentObligations) {
        const due = Number(ob.amountDue);
        const collected = Number(ob.amountCollected);
        totalCharged += due;
        totalCollected += collected;

        if (ob.status !== 'FULFILLED' && ob.dueDate < now) {
          arrears += (due - collected);
        }
      }

      return {
        studentId: stu.id,
        name: stu.name,
        email: stu.email,
        phone: stu.phone,
        totalCharged,
        totalCollected,
        balance: totalCharged - totalCollected,
        arrears: Math.max(0, arrears),
        hasArrears: arrears > 0,
        currency: 'EGP'
      };
    });

    // If client requested only accounts with arrears
    const filtered = hasArrears === 'true'
      ? subLedgers.filter(s => s.hasArrears)
      : subLedgers;

    return res.json({
      subLedgers: filtered,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total: filtered.length
      }
    });
  } catch (error: any) {
    logger.error(`[Accounting] Error listing student sub-ledgers: ${error.message}`);
    return res.status(500).json({ message: 'Error listing sub-ledgers', error: error.message });
  }
};
