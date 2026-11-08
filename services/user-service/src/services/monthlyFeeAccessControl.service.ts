import { db } from '../../../../packages/database/src/index.js';
import { logger } from '@shared/utils';

export interface GracePeriodCalculation {
  billingMonth: string; // "YYYY-MM"
  monthEnd: Date;
  graceDays: number;
  graceExpiry: Date;
  isExpired: boolean;
  timezone: string;
}

export const MonthlyFeeAccessControlService = {
  /**
   * Accurate calendar month boundary calculation with leap-year support
   */
  getMonthDays(year: number, month: number): number {
    // month is 1-12
    if (month === 2) {
      const isLeap = (year % 4 === 0 && year % 100 !== 0) || (year % 400 === 0);
      return isLeap ? 29 : 28;
    }
    if ([4, 6, 9, 11].includes(month)) return 30;
    return 31;
  },

  /**
   * Calculates the exact grace expiry date for a given billing month and grace duration.
   * Month-end is defined as 23:59:59.999 in the institution's configured timezone (default Africa/Cairo).
   */
  calculateGracePeriodExpiry(
    billingMonth: string,
    graceDays: number,
    asOfDate: Date = new Date(),
    timeZone: string = 'Africa/Cairo'
  ): GracePeriodCalculation {
    const [yearStr, monthStr] = billingMonth.split('-');
    const year = parseInt(yearStr, 10);
    const month = parseInt(monthStr, 10);

    const totalDays = this.getMonthDays(year, month);

    // Compute month-end in target timeZone
    let monthEnd: Date;
    try {
      const approxDate = new Date(Date.UTC(year, month - 1, totalDays, 21, 59, 59, 999));
      const formatter = new Intl.DateTimeFormat('en-US', { timeZone, timeZoneName: 'shortOffset' });
      const parts = formatter.formatToParts(approxDate);
      const tzPart = parts.find(p => p.type === 'timeZoneName')?.value;
      let offsetMinutes = 120; // Default Cairo (GMT+2)
      if (tzPart) {
        const match = tzPart.match(/GMT([+-])(\d+)(?::(\d+))?/);
        if (match) {
          const sign = match[1] === '+' ? 1 : -1;
          const hours = parseInt(match[2], 10);
          const mins = match[3] ? parseInt(match[3], 10) : 0;
          offsetMinutes = sign * (hours * 60 + mins);
        }
      }
      const utcTime = Date.UTC(year, month - 1, totalDays, 23, 59, 59, 999) - (offsetMinutes * 60 * 1000);
      monthEnd = new Date(utcTime);
    } catch {
      monthEnd = new Date(Date.UTC(year, month - 1, totalDays, 23, 59, 59, 999));
    }
    
    // Grace expiry: add graceDays in milliseconds (zero grace days expires at month-end)
    const graceExpiry = new Date(monthEnd.getTime() + graceDays * 24 * 60 * 60 * 1000);
    const isExpired = asOfDate.getTime() > graceExpiry.getTime();

    return {
      billingMonth,
      monthEnd,
      graceDays,
      graceExpiry,
      isExpired,
      timezone: timeZone
    };
  },

  /**
   * Resolves the effective grace period days for an institution and branch.
   * STRICT RULE (Section 4.3): If no persisted policy exists, skip automatic restriction
   * and produce a clear operational warning. Never apply an arbitrary default or zero-day grace period.
   */
  async resolveEffectiveGracePolicy(institutionId: string, branchId?: string | null): Promise<{
    hasValidPolicy: boolean;
    isEnabled: boolean;
    policyMode: 'GLOBAL' | 'PER_BRANCH';
    graceDays: number;
    timezone: string;
  }> {
    const policies = await db.monthlyFeePolicy.findMany({
      where: { institutionId }
    });

    const globalPolicy = policies.find(p => p.branchId === null);
    if (!globalPolicy) {
      logger.warn(`[AccessControl] Operational Warning: No persisted MonthlyFeePolicy found for institution "${institutionId}". Skipping automatic restriction.`);
      return {
        hasValidPolicy: false,
        isEnabled: false,
        policyMode: 'GLOBAL',
        graceDays: 0,
        timezone: 'Africa/Cairo'
      };
    }

    const isEnabled = globalPolicy.isEnabled;
    const policyMode = globalPolicy.policyMode;

    if (!isEnabled) {
      return {
        hasValidPolicy: true,
        isEnabled: false,
        policyMode,
        graceDays: globalPolicy.gracePeriodDays,
        timezone: 'Africa/Cairo'
      };
    }

    if (policyMode === 'PER_BRANCH' && branchId) {
      const branchPolicy = policies.find(p => p.branchId === branchId);
      if (branchPolicy) {
        if (!branchPolicy.isEnabled) {
          return {
            hasValidPolicy: true,
            isEnabled: false,
            policyMode: 'PER_BRANCH',
            graceDays: branchPolicy.gracePeriodDays,
            timezone: 'Africa/Cairo'
          };
        }
        return {
          hasValidPolicy: true,
          isEnabled: true,
          policyMode: 'PER_BRANCH',
          graceDays: branchPolicy.gracePeriodDays,
          timezone: 'Africa/Cairo'
        };
      }
      // If branch has no override in PER_BRANCH mode, inherit global grace days
      return {
        hasValidPolicy: true,
        isEnabled: true,
        policyMode: 'PER_BRANCH',
        graceDays: globalPolicy.gracePeriodDays,
        timezone: 'Africa/Cairo'
      };
    }

    return {
      hasValidPolicy: true,
      isEnabled: true,
      policyMode: 'GLOBAL',
      graceDays: globalPolicy.gracePeriodDays,
      timezone: 'Africa/Cairo'
    };
  },

  /**
   * Evaluates student's financial access state and applies restrictions or automatic reactivations.
   * STRICT RULES (Section 3.1 & 4.5):
   * - Applies EXCLUSIVELY to genuine monthly fees with valid billingMonth.
   * - NEVER infer monthly status from dueDate.
   * - Full payment of entire overdue monthly balance required for automatic reactivation.
   * - Idempotent: Does not create duplicate history records or duplicate notifications.
   */
  async evaluateStudentFinancialAccess(
    studentId: string,
    asOfDate: Date = new Date(),
    triggeredBy: string = 'SYSTEM_EVALUATION'
  ): Promise<{
    status: 'ACTIVE' | 'RESTRICTED';
    studentId: string;
    actionTaken?: 'RESTRICTED' | 'REACTIVATED' | 'NONE';
    overdueMonthlyObligations: Array<{
      obligationId: string;
      billingMonth: string;
      amountDue: number;
      amountCollected: number;
      unpaidBalance: number;
      graceExpiry: Date;
    }>;
  }> {
    const student = await db.user.findUnique({
      where: { id: studentId },
      select: {
        id: true,
        name: true,
        role: true,
        institutionId: true,
        branchId: true,
        financialAccessStatus: true,
        parentId: true
      }
    });

    if (!student || student.role !== 'CENTER_STUDENT' || !student.institutionId) {
      return { status: 'ACTIVE', studentId, overdueMonthlyObligations: [] };
    }

    const institutionId = student.institutionId;
    const branchId = student.branchId;

    // Resolve institution grace policy
    const policy = await this.resolveEffectiveGracePolicy(institutionId, branchId);
    if (!policy.hasValidPolicy || !policy.isEnabled) {
      // Policy disabled or unconfigured: restore student if currently restricted
      if (student.financialAccessStatus === 'RESTRICTED') {
        await db.user.update({
          where: { id: studentId },
          data: { financialAccessStatus: 'ACTIVE' }
        });
        await db.financialRestrictionHistory.create({
          data: {
            institutionId,
            branchId: branchId || 'DEFAULT',
            studentId,
            action: 'REACTIVATED',
            reason: policy.hasValidPolicy ? 'Policy disabled by administration' : 'No active policy configured for institution',
            relevantMonth: 'N/A',
            outstandingAmount: 0,
            triggeredBy
          }
        });
      }
      return { status: 'ACTIVE', studentId, overdueMonthlyObligations: [] };
    }

    // Query active obligations for student that are specifically monthly fees
    const obligations = await db.studentObligation.findMany({
      where: {
        studentId,
        institutionId,
        isMonthlyFee: true,
        obligationType: 'MONTHLY_FEE',
        status: { notIn: ['FULFILLED', 'WAIVED'] }
      }
    });

    const overdueMonthlyObligations: Array<{
      obligationId: string;
      billingMonth: string;
      amountDue: number;
      amountCollected: number;
      unpaidBalance: number;
      graceExpiry: Date;
    }> = [];

    for (const ob of obligations) {
      // 1. Strict schema consistency checks
      if (ob.obligationType !== 'MONTHLY_FEE' || ob.isMonthlyFee !== true) {
        logger.warn(`[AccessControl] Safety Skip: Obligation ${ob.id} has inconsistent monthly flags (type=${ob.obligationType}, isMonthlyFee=${ob.isMonthlyFee})`);
        continue;
      }

      // 2. Strict billingMonth validation (Section 3.1: Never infer from dueDate)
      if (!ob.billingMonth || typeof ob.billingMonth !== 'string') {
        logger.warn(`[AccessControl] Safety Skip: Obligation ${ob.id} lacks valid billingMonth. Never inferring monthly status from dueDate.`);
        continue;
      }

      const match = ob.billingMonth.match(/^(\d{4})-(0[1-9]|1[0-2])$/);
      if (!match) {
        logger.warn(`[AccessControl] Safety Skip: Obligation ${ob.id} has malformed billingMonth: "${ob.billingMonth}"`);
        continue;
      }

      const year = parseInt(match[1], 10);
      if (year < 2000 || year > 2100) {
        logger.warn(`[AccessControl] Safety Skip: Obligation ${ob.id} has out-of-range billingYear: ${year}`);
        continue;
      }

      // 3. Strict student & branch association
      if (!ob.studentId || !ob.branchId || !ob.institutionId) {
        logger.warn(`[AccessControl] Safety Skip: Obligation ${ob.id} lacks complete student/branch/institution association`);
        continue;
      }

      // 4. Outstanding balance check
      const unpaid = Number(ob.amountDue) - Number(ob.amountCollected);
      if (unpaid <= 0) continue;

      const calc = this.calculateGracePeriodExpiry(ob.billingMonth, policy.graceDays, asOfDate, policy.timezone);
      if (calc.isExpired) {
        overdueMonthlyObligations.push({
          obligationId: ob.id,
          billingMonth: ob.billingMonth,
          amountDue: Number(ob.amountDue),
          amountCollected: Number(ob.amountCollected),
          unpaidBalance: unpaid,
          graceExpiry: calc.graceExpiry
        });
      }
    }

    const hasOverdueMonthlyFee = overdueMonthlyObligations.length > 0;

    // Restriction Branch
    if (hasOverdueMonthlyFee) {
      const primaryOverdue = overdueMonthlyObligations[0];
      const totalOutstanding = overdueMonthlyObligations.reduce((sum, o) => sum + o.unpaidBalance, 0);

      // Only restrict and notify if NOT already restricted (Strict Idempotency)
      if (student.financialAccessStatus !== 'RESTRICTED') {
        await db.user.update({
          where: { id: studentId },
          data: { financialAccessStatus: 'RESTRICTED' }
        });

        await db.financialRestrictionHistory.create({
          data: {
            institutionId,
            branchId: branchId || 'DEFAULT',
            studentId,
            obligationId: primaryOverdue.obligationId,
            action: 'RESTRICTED',
            reason: `Overdue monthly fee for ${primaryOverdue.billingMonth} exceeding grace period (${policy.graceDays} days)`,
            relevantMonth: primaryOverdue.billingMonth,
            outstandingAmount: totalOutstanding,
            triggeredBy
          }
        });

        try {
          await this.notifyRestriction({
            institutionId,
            branchId,
            studentId,
            studentName: student.name,
            parentId: student.parentId,
            billingMonth: primaryOverdue.billingMonth,
            outstandingAmount: totalOutstanding
          });
        } catch (e: any) {
          logger.error(`[AccessControl] Error dispatching restriction notifications: ${e.message}`);
        }

        return {
          status: 'RESTRICTED',
          studentId,
          actionTaken: 'RESTRICTED',
          overdueMonthlyObligations
        };
      }

      return {
        status: 'RESTRICTED',
        studentId,
        actionTaken: 'NONE',
        overdueMonthlyObligations
      };
    }

    // Automatic Reactivation Branch (Requires full payment of all overdue monthly fees)
    if (!hasOverdueMonthlyFee && student.financialAccessStatus === 'RESTRICTED') {
      await db.user.update({
        where: { id: studentId },
        data: { financialAccessStatus: 'ACTIVE' }
      });

      await db.financialRestrictionHistory.create({
        data: {
          institutionId,
          branchId: branchId || 'DEFAULT',
          studentId,
          action: 'REACTIVATED',
          reason: 'All overdue monthly fees have been fully collected and confirmed.',
          relevantMonth: 'RESTORED',
          outstandingAmount: 0,
          triggeredBy
        }
      });

      try {
        await this.notifyReactivation({
          institutionId,
          studentId,
          studentName: student.name,
          parentId: student.parentId
        });
      } catch (e: any) {
        logger.error(`[AccessControl] Error dispatching reactivation notifications: ${e.message}`);
      }

      return {
        status: 'ACTIVE',
        studentId,
        actionTaken: 'REACTIVATED',
        overdueMonthlyObligations: []
      };
    }

    return {
      status: 'ACTIVE',
      studentId,
      actionTaken: 'NONE',
      overdueMonthlyObligations: []
    };
  },

  /**
   * Dispatches in-app notifications upon restriction
   */
  async notifyRestriction(data: {
    institutionId: string;
    branchId?: string | null;
    studentId: string;
    studentName: string;
    parentId?: string | null;
    billingMonth: string;
    outstandingAmount: number;
  }) {
    // 1. Notify Student
    await db.notification.create({
      data: {
        userId: data.studentId,
        title: '⚠️ تنبيه: تقييد الوصول التعليمي نظراً لوجود رسوم شهرية مستحقة',
        message: `تم تقييد الوصول إلى المحاضرات والاختبارات التفاعلية نظراً لانتهاء مهلة سداد الرسوم الشهرية لشهر (${data.billingMonth}) بمبلغ ${data.outstandingAmount} ج.م. يرجى التوجه لمكتب الخزينة/المحاسب لتسوية الرسوم واستعادة الخدمة فوراً.`,
        type: 'FINANCIAL_RESTRICTED',
        metadata: { billingMonth: data.billingMonth, amount: data.outstandingAmount }
      }
    });

    // 2. Notify Guardian
    if (data.parentId) {
      await db.notification.create({
        data: {
          userId: data.parentId,
          title: `⚠️ تنبيه مالي: تقييد الوصول التعليمي للطالب ${data.studentName}`,
          message: `نحيطكم علماً بأنه تم تقييد الوصول التعليمي للطالب ${data.studentName} لتأخر سداد رسوم شهر (${data.billingMonth}) بمبلغ ${data.outstandingAmount} ج.م. بعد انتهاء فترة السماح. يرجى تسوية الرسوم لفتح المنصة تلقائياً.`,
          type: 'FINANCIAL_RESTRICTED',
          metadata: { studentId: data.studentId, billingMonth: data.billingMonth, amount: data.outstandingAmount }
        }
      });
    }

    // 3. Notify Branch Accountants
    const accountants = await db.user.findMany({
      where: {
        institutionId: data.institutionId,
        role: 'ACCOUNTANT',
        deletedAt: null
      },
      select: { id: true }
    });

    for (const acc of accountants) {
      await db.notification.create({
        data: {
          userId: acc.id,
          title: `تقييد مالي: الطالب ${data.studentName}`,
          message: `تم تقييد حساب الطالب ${data.studentName} آلياً لعدم سداد رسوم شهر (${data.billingMonth}) بمبلغ ${data.outstandingAmount} ج.م.`,
          type: 'FINANCIAL_RESTRICTED',
          metadata: { studentId: data.studentId, billingMonth: data.billingMonth, amount: data.outstandingAmount }
        }
      });
    }

    // 4. Notify Primary Manager
    const managers = await db.user.findMany({
      where: {
        institutionId: data.institutionId,
        role: { in: ['PRIMARY_MANAGER', 'ADMIN'] },
        deletedAt: null
      },
      select: { id: true }
    });

    for (const mgr of managers) {
      await db.notification.create({
        data: {
          userId: mgr.id,
          title: `تقييد مالي لطالب: ${data.studentName}`,
          message: `انتهت فترة السماح للطالب ${data.studentName} عن شهر (${data.billingMonth}) بمتبقي ${data.outstandingAmount} ج.م. تم تقييد الوصول التعليمي آلياً.`,
          type: 'FINANCIAL_RESTRICTED',
          metadata: { studentId: data.studentId, billingMonth: data.billingMonth, amount: data.outstandingAmount }
        }
      });
    }
  },

  /**
   * Dispatches in-app notifications upon automatic reactivation
   */
  async notifyReactivation(data: {
    institutionId: string;
    studentId: string;
    studentName: string;
    parentId?: string | null;
  }) {
    // 1. Notify Student
    await db.notification.create({
      data: {
        userId: data.studentId,
        title: '✅ تم استعادة الوصول التعليمي بالكامل',
        message: 'تم تأكيد تحصيل الرسوم الشهرية المستحقة بالكامل، وتمت استعادة وصولك لجميع المحاضرات والواجبات والاختبارات بنجاح.',
        type: 'FINANCIAL_RESTRICTION_LIFTED',
        metadata: { studentId: data.studentId }
      }
    });

    // 2. Notify Guardian
    if (data.parentId) {
      await db.notification.create({
        data: {
          userId: data.parentId,
          title: `✅ تم تفعيل حساب الطالب: ${data.studentName}`,
          message: `تم سداد الرسوم الشهرية المقررة للطالب ${data.studentName} بالكامل، وتم فتح المنصة والمسارات التعليمية تلقائياً.`,
          type: 'FINANCIAL_RESTRICTION_LIFTED',
          metadata: { studentId: data.studentId }
        }
      });
    }
  },

  /**
   * Batch run across all students in an institution
   */
  async runScheduledFinancialAccessEvaluation(institutionId: string, asOfDate: Date = new Date()): Promise<{
    evaluatedCount: number;
    restrictedCount: number;
    reactivatedCount: number;
  }> {
    const policy = await this.resolveEffectiveGracePolicy(institutionId);
    if (!policy.hasValidPolicy) {
      logger.warn(`[AccessControl] Batch run skipped for institution ${institutionId}: No valid policy configured.`);
      return { evaluatedCount: 0, restrictedCount: 0, reactivatedCount: 0 };
    }

    const students = await db.user.findMany({
      where: {
        institutionId,
        role: 'CENTER_STUDENT',
        deletedAt: null
      },
      select: { id: true }
    });

    let restrictedCount = 0;
    let reactivatedCount = 0;

    for (const stu of students) {
      const res = await this.evaluateStudentFinancialAccess(stu.id, asOfDate, 'SCHEDULED_BATCH_RUN');
      if (res.actionTaken === 'RESTRICTED') restrictedCount++;
      if (res.actionTaken === 'REACTIVATED') reactivatedCount++;
    }

    return {
      evaluatedCount: students.length,
      restrictedCount,
      reactivatedCount
    };
  }
};
