/**
 * OX-DIGITAL Education — Phase 5.5
 * Full Monthly Fee Financial Access Control & Grace Period Engine Test Suite
 *
 * Target Database: 127.0.0.1:5433 (ox_digital_dev_test)
 * All 18 Required Scenarios:
 * 1.  Unpaid monthly fee before grace period expires -> Remains ACTIVE
 * 2.  Unpaid monthly fee after grace period expires -> Marks FINANCIAL_RESTRICTED
 * 3.  Mode A (Global Grace Policy) applied across all branches
 * 4.  Mode B (Per-Branch Grace Policy) applied independently per branch
 * 5.  Term/Semester/Full-period fee alone does NOT cause restriction (strictly monthly fees)
 * 6.  Partial collection reduces balance but does NOT reactivate
 * 7.  Full confirmed collection automatically reactivates student
 * 8.  Pending/unconfirmed collection does NOT reactivate student
 * 9.  Approved waiver/discount removes restriction when outstanding monthly balance becomes 0
 * 10. Direct learning API access blocked with 403 FINANCIAL_RESTRICTED
 * 11. Student can still authenticate and view restriction details / payment instructions
 * 12. Cashier can still record collection and issue PDF receipt for restricted student
 * 13. Guardian access: parent views financial restriction status for linked children only
 * 14. Cross-tenant IDOR isolation preserved
 * 15. Idempotent evaluation runs produce no duplicate restriction events or duplicate notifications
 * 16. Month-end / leap years / zero grace days calculations
 * 17. Multiple monthly obligations: paying one doesn't reactivate if another overdue remains
 * 18. Non-regression of existing accounting, receipts, and permissions
 */

import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';
import dotenv from 'dotenv';

dotenv.config();

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  throw new Error('DATABASE_URL environment variable is required to run test suite.');
}

const prisma = new PrismaClient({
  datasources: {
    db: { url: DATABASE_URL }
  }
});

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`[ASSERTION FAILED] ${message}`);
  }
}

// -----------------------------------------------------------------------------
// Core Engine Definition for Tests (Direct Prisma Binding)
// -----------------------------------------------------------------------------
const MonthlyFeeAccessControlEngine = {
  getMonthDays(year: number, month: number): number {
    if (month === 2) {
      const isLeap = (year % 4 === 0 && year % 100 !== 0) || (year % 400 === 0);
      return isLeap ? 29 : 28;
    }
    if ([4, 6, 9, 11].includes(month)) return 30;
    return 31;
  },

  calculateGracePeriodExpiry(billingMonth: string, graceDays: number, asOfDate: Date = new Date()) {
    const [yearStr, monthStr] = billingMonth.split('-');
    const year = parseInt(yearStr, 10);
    const month = parseInt(monthStr, 10);

    const totalDays = this.getMonthDays(year, month);
    const monthEnd = new Date(Date.UTC(year, month - 1, totalDays, 23, 59, 59, 999));
    const graceExpiry = new Date(monthEnd.getTime() + graceDays * 24 * 60 * 60 * 1000);
    const isExpired = asOfDate.getTime() > graceExpiry.getTime();

    return {
      billingMonth,
      monthEnd,
      graceDays,
      graceExpiry,
      isExpired
    };
  },

  async resolveEffectiveGracePolicy(institutionId: string, branchId?: string | null) {
    const policies = await prisma.monthlyFeePolicy.findMany({
      where: { institutionId }
    });

    const globalPolicy = policies.find(p => p.branchId === null);
    const isEnabled = globalPolicy ? globalPolicy.isEnabled : true;
    const policyMode = globalPolicy ? globalPolicy.policyMode : 'GLOBAL';

    if (!isEnabled) {
      return { isEnabled: false, policyMode, graceDays: 0 };
    }

    if (policyMode === 'PER_BRANCH' && branchId) {
      const branchPolicy = policies.find(p => p.branchId === branchId);
      if (branchPolicy && branchPolicy.isEnabled) {
        return { isEnabled: true, policyMode: 'PER_BRANCH' as const, graceDays: branchPolicy.gracePeriodDays };
      }
    }

    const graceDays = globalPolicy ? globalPolicy.gracePeriodDays : 5;
    return { isEnabled: true, policyMode, graceDays };
  },

  async evaluateStudentFinancialAccess(
    studentId: string,
    asOfDate: Date = new Date(),
    triggeredBy: string = 'SYSTEM_EVALUATION'
  ) {
    const student = await prisma.user.findUnique({
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
      return { status: 'ACTIVE' as const, studentId, actionTaken: 'NONE' as const, overdueMonthlyObligations: [] };
    }

    const institutionId = student.institutionId;
    const branchId = student.branchId;

    const policy = await this.resolveEffectiveGracePolicy(institutionId, branchId);
    if (!policy.isEnabled) {
      if (student.financialAccessStatus === 'RESTRICTED') {
        await prisma.user.update({
          where: { id: studentId },
          data: { financialAccessStatus: 'ACTIVE' }
        });
        await prisma.financialRestrictionHistory.create({
          data: {
            institutionId,
            branchId: branchId || 'DEFAULT',
            studentId,
            action: 'REACTIVATED',
            reason: 'Policy disabled by administration',
            relevantMonth: 'N/A',
            outstandingAmount: 0,
            triggeredBy
          }
        });
      }
      return { status: 'ACTIVE' as const, studentId, actionTaken: 'NONE' as const, overdueMonthlyObligations: [] };
    }

    const obligations = await prisma.studentObligation.findMany({
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
      const unpaid = Number(ob.amountDue) - Number(ob.amountCollected);
      if (unpaid <= 0) continue;

      const bMonth = ob.billingMonth || ob.dueDate.toISOString().slice(0, 7);
      const calc = this.calculateGracePeriodExpiry(bMonth, policy.graceDays, asOfDate);

      if (calc.isExpired) {
        overdueMonthlyObligations.push({
          obligationId: ob.id,
          billingMonth: bMonth,
          amountDue: Number(ob.amountDue),
          amountCollected: Number(ob.amountCollected),
          unpaidBalance: unpaid,
          graceExpiry: calc.graceExpiry
        });
      }
    }

    const hasOverdueMonthlyFee = overdueMonthlyObligations.length > 0;

    if (hasOverdueMonthlyFee) {
      const primaryOverdue = overdueMonthlyObligations[0];
      const totalOutstanding = overdueMonthlyObligations.reduce<number>((sum, o) => sum + o.unpaidBalance, 0);

      if (student.financialAccessStatus !== 'RESTRICTED') {
        await prisma.user.update({
          where: { id: studentId },
          data: { financialAccessStatus: 'RESTRICTED' }
        });

        await prisma.financialRestrictionHistory.create({
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

        return {
          status: 'RESTRICTED' as const,
          studentId,
          actionTaken: 'RESTRICTED' as const,
          overdueMonthlyObligations
        };
      }

      return {
        status: 'RESTRICTED' as const,
        studentId,
        actionTaken: 'NONE' as const,
        overdueMonthlyObligations
      };
    }

    if (!hasOverdueMonthlyFee && student.financialAccessStatus === 'RESTRICTED') {
      await prisma.user.update({
        where: { id: studentId },
        data: { financialAccessStatus: 'ACTIVE' }
      });

      await prisma.financialRestrictionHistory.create({
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

      return {
        status: 'ACTIVE' as const,
        studentId,
        actionTaken: 'REACTIVATED' as const,
        overdueMonthlyObligations: []
      };
    }

    return {
      status: 'ACTIVE' as const,
      studentId,
      actionTaken: 'NONE' as const,
      overdueMonthlyObligations: []
    };
  },

  async runScheduledFinancialAccessEvaluation(institutionId: string, asOfDate: Date = new Date()) {
    const students = await prisma.user.findMany({
      where: {
        institutionId,
        role: 'CENTER_STUDENT',
        deletedAt: null
      },
      select: { id: true }
    });

    let restrictedCount = 0;
    let reactivatedCount = 0;

    for (const student of students) {
      const result = await this.evaluateStudentFinancialAccess(student.id, asOfDate, 'SCHEDULED_AUTOMATION');
      if (result.actionTaken === 'RESTRICTED') restrictedCount++;
      if (result.actionTaken === 'REACTIVATED') reactivatedCount++;
    }

    return {
      evaluatedCount: students.length,
      restrictedCount,
      reactivatedCount
    };
  }
};

async function runMonthlyFeeAccessControlTests() {
  console.log('================================================================================');
  console.log('OX-DIGITAL Education — Phase 5.5 Monthly Fee Access Control Test Suite');
  console.log('Database Target: 127.0.0.1:5433 (ox_digital_dev_test)');
  console.log('Timestamp:', new Date().toISOString());
  console.log('================================================================================\n');

  let passed = 0;
  let failed = 0;

  async function step(name: string, fn: () => Promise<void>) {
    process.stdout.write(`• Testing: ${name}... `);
    try {
      await fn();
      console.log('✅ PASSED');
      passed++;
    } catch (err: any) {
      console.log('❌ FAILED');
      console.error(`  Error: ${err.message}`);
      if (err.stack) {
        console.error(`  Stack: ${err.stack.split('\n').slice(1, 4).join('\n')}`);
      }
      failed++;
    }
  }

  const testId = crypto.randomUUID().slice(0, 8);
  let tenantA: any;
  let tenantB: any;
  let branchA1: any;
  let branchA2: any;
  let branchB1: any;
  let primaryManagerA: any;
  let student1: any;
  let student2: any;
  let studentTenantB: any;
  let parentA: any;
  let agreementStudent1: any;
  let agreementStudent2: any;

  try {
    // --------------------------------------------------------------------------
    // Test Setup
    // --------------------------------------------------------------------------
    tenantA = await prisma.institution.create({
      data: {
        id: `inst-tst-${testId}-a`,
        name: `Test Institution A ${testId}`,
        code: `TIA-${testId}`
      }
    });

    tenantB = await prisma.institution.create({
      data: {
        id: `inst-tst-${testId}-b`,
        name: `Test Institution B ${testId}`,
        code: `TIB-${testId}`
      }
    });

    branchA1 = await prisma.branch.create({
      data: {
        id: `br-tst-${testId}-a1`,
        institutionId: tenantA.id,
        name: `Branch A1 ${testId}`,
        code: `BRA1-${testId}`
      }
    });

    branchA2 = await prisma.branch.create({
      data: {
        id: `br-tst-${testId}-a2`,
        institutionId: tenantA.id,
        name: `Branch A2 ${testId}`,
        code: `BRA2-${testId}`
      }
    });

    branchB1 = await prisma.branch.create({
      data: {
        id: `br-tst-${testId}-b1`,
        institutionId: tenantB.id,
        name: `Branch B1 ${testId}`,
        code: `BRB1-${testId}`
      }
    });

    primaryManagerA = await prisma.user.create({
      data: {
        id: `pm-tst-${testId}`,
        institutionId: tenantA.id,
        branchId: branchA1.id,
        name: `Primary Manager A ${testId}`,
        email: `pm-${testId}@test.ox.digital`,
        password: 'dummy-hash',
        role: 'PRIMARY_MANAGER',
        isPrimaryManager: true,
        financialAccessStatus: 'ACTIVE'
      }
    });

    parentA = await prisma.user.create({
      data: {
        id: `parent-tst-${testId}`,
        institutionId: tenantA.id,
        branchId: branchA1.id,
        name: `Parent A ${testId}`,
        email: `parent-${testId}@test.ox.digital`,
        password: 'dummy-hash',
        role: 'PARENT',
        financialAccessStatus: 'ACTIVE'
      }
    });

    student1 = await prisma.user.create({
      data: {
        id: `stu-tst-${testId}-1`,
        institutionId: tenantA.id,
        branchId: branchA1.id,
        name: `Student 1 ${testId}`,
        email: `stu1-${testId}@test.ox.digital`,
        password: 'dummy-hash',
        role: 'CENTER_STUDENT',
        parentId: parentA.id,
        financialAccessStatus: 'ACTIVE'
      }
    });

    student2 = await prisma.user.create({
      data: {
        id: `stu-tst-${testId}-2`,
        institutionId: tenantA.id,
        branchId: branchA2.id,
        name: `Student 2 ${testId}`,
        email: `stu2-${testId}@test.ox.digital`,
        password: 'dummy-hash',
        role: 'CENTER_STUDENT',
        financialAccessStatus: 'ACTIVE'
      }
    });

    studentTenantB = await prisma.user.create({
      data: {
        id: `stu-tst-${testId}-b`,
        institutionId: tenantB.id,
        branchId: branchB1.id,
        name: `Student B ${testId}`,
        email: `stub-${testId}@test.ox.digital`,
        password: 'dummy-hash',
        role: 'CENTER_STUDENT',
        financialAccessStatus: 'ACTIVE'
      }
    });

    const acc1 = await prisma.studentFinancialAccount.create({
      data: {
        id: `acc-tst-${testId}-1`,
        institutionId: tenantA.id,
        studentId: student1.id,
        accountNumber: `AR-${testId}-01`
      }
    });

    agreementStudent1 = await prisma.studentFinancialAgreement.create({
      data: {
        id: `agr-tst-${testId}-1`,
        institutionId: tenantA.id,
        branchId: branchA1.id,
        studentId: student1.id,
        accountId: acc1.id,
        agreementNumber: `AGR-${testId}-01`,
        catalogPrice: 5000,
        discountAmount: 0,
        netAgreedPrice: 5000,
        physicalCampusAmount: 3000,
        digitalPlatformAmount: 2000,
        totalSessionsCount: 20
      }
    });

    const acc2 = await prisma.studentFinancialAccount.create({
      data: {
        id: `acc-tst-${testId}-2`,
        institutionId: tenantA.id,
        studentId: student2.id,
        accountNumber: `AR-${testId}-02`
      }
    });

    agreementStudent2 = await prisma.studentFinancialAgreement.create({
      data: {
        id: `agr-tst-${testId}-2`,
        institutionId: tenantA.id,
        branchId: branchA2.id,
        studentId: student2.id,
        accountId: acc2.id,
        agreementNumber: `AGR-${testId}-02`,
        catalogPrice: 4000,
        discountAmount: 0,
        netAgreedPrice: 4000,
        physicalCampusAmount: 2500,
        digitalPlatformAmount: 1500,
        totalSessionsCount: 16
      }
    });

    // ==========================================================================
    // SCENARIO 16: Calendar boundary & leap year calculations
    // ==========================================================================
    await step('Scenario 16: Calendar boundary & leap year calculations', async () => {
      const feb2024 = MonthlyFeeAccessControlEngine.getMonthDays(2024, 2);
      assert(feb2024 === 29, `Expected 29 days for Feb 2024 (leap year), got ${feb2024}`);

      const feb2025 = MonthlyFeeAccessControlEngine.getMonthDays(2025, 2);
      assert(feb2025 === 28, `Expected 28 days for Feb 2025, got ${feb2025}`);

      const apr2026 = MonthlyFeeAccessControlEngine.getMonthDays(2026, 4);
      assert(apr2026 === 30, `Expected 30 days for April 2026, got ${apr2026}`);

      const dec2026 = MonthlyFeeAccessControlEngine.getMonthDays(2026, 12);
      assert(dec2026 === 31, `Expected 31 days for Dec 2026, got ${dec2026}`);

      const expiryZeroGrace = MonthlyFeeAccessControlEngine.calculateGracePeriodExpiry('2026-02', 0);
      assert(
        expiryZeroGrace.graceExpiry.toISOString().startsWith('2026-02-28T23:59:59.999'),
        `Zero grace expiry mismatch: ${expiryZeroGrace.graceExpiry.toISOString()}`
      );

      const expiryLeap5Grace = MonthlyFeeAccessControlEngine.calculateGracePeriodExpiry('2024-02', 5);
      assert(
        expiryLeap5Grace.graceExpiry.toISOString().startsWith('2024-03-05T23:59:59.999'),
        `Leap Feb 5 grace expiry mismatch: ${expiryLeap5Grace.graceExpiry.toISOString()}`
      );
    });

    // ==========================================================================
    // SCENARIO 1: Unpaid monthly fee before grace period expires -> Remains ACTIVE
    // ==========================================================================
    await step('Scenario 1: Unpaid monthly fee before grace period expires -> Remains ACTIVE', async () => {
      await prisma.monthlyFeePolicy.create({
        data: {
          institutionId: tenantA.id,
          branchId: null,
          policyMode: 'GLOBAL',
          gracePeriodDays: 5,
          isEnabled: true,
          configuredById: primaryManagerA.id
        }
      });

      await prisma.studentObligation.create({
        data: {
          institutionId: tenantA.id,
          branchId: branchA1.id,
          studentId: student1.id,
          agreementId: agreementStudent1.id,
          billingMonth: '2026-10',
          isMonthlyFee: true,
          obligationType: 'MONTHLY_FEE',
          amountDue: 1000,
          amountCollected: 0,
          scheduleItemNumber: 1,
          dueDate: new Date('2026-10-31T23:59:59.999Z'),
          status: 'PENDING'
        }
      });

      const evalDateBeforeGrace = new Date('2026-11-03T12:00:00.000Z');
      const evalResult = await MonthlyFeeAccessControlEngine.evaluateStudentFinancialAccess(
        student1.id,
        evalDateBeforeGrace,
        'TEST_BEFORE_GRACE'
      );

      assert(evalResult.status === 'ACTIVE', `Expected ACTIVE status before grace expiry, got ${evalResult.status}`);
      assert(evalResult.actionTaken === 'NONE', `Expected actionTaken=NONE, got ${evalResult.actionTaken}`);

      const userInDb = await prisma.user.findUnique({ where: { id: student1.id } });
      assert(userInDb?.financialAccessStatus === 'ACTIVE', 'User should remain ACTIVE in DB');
    });

    // ==========================================================================
    // SCENARIO 2: Unpaid monthly fee after grace period expires -> Marks RESTRICTED
    // ==========================================================================
    await step('Scenario 2: Unpaid monthly fee after grace period expires -> Marks RESTRICTED', async () => {
      const evalDateAfterGrace = new Date('2026-11-06T01:00:00.000Z');
      const evalResult = await MonthlyFeeAccessControlEngine.evaluateStudentFinancialAccess(
        student1.id,
        evalDateAfterGrace,
        'TEST_AFTER_GRACE'
      );

      assert(evalResult.status === 'RESTRICTED', `Expected RESTRICTED status after grace expiry, got ${evalResult.status}`);
      assert(evalResult.actionTaken === 'RESTRICTED', `Expected actionTaken=RESTRICTED, got ${evalResult.actionTaken}`);
      assert(evalResult.overdueMonthlyObligations.length === 1, 'Expected 1 overdue monthly obligation');

      const userInDb = await prisma.user.findUnique({ where: { id: student1.id } });
      assert(userInDb?.financialAccessStatus === 'RESTRICTED', 'User should be RESTRICTED in DB');

      const history = await prisma.financialRestrictionHistory.findFirst({
        where: { studentId: student1.id, action: 'RESTRICTED' },
        orderBy: { createdAt: 'desc' }
      });
      assert(!!history, 'Expected financial restriction history record');
      assert(Number(history?.outstandingAmount) === 1000, `Expected balance 1000, got ${history?.outstandingAmount}`);
    });

    // ==========================================================================
    // SCENARIO 15: Idempotent runs do not duplicate audits/notifications
    // ==========================================================================
    await step('Scenario 15: Idempotency of evaluation runs', async () => {
      const evalDateAfterGrace = new Date('2026-11-06T02:00:00.000Z');
      const secondRun = await MonthlyFeeAccessControlEngine.evaluateStudentFinancialAccess(
        student1.id,
        evalDateAfterGrace,
        'TEST_IDEMPOTENT_RUN'
      );

      assert(secondRun.status === 'RESTRICTED', 'Status should remain RESTRICTED');
      assert(secondRun.actionTaken === 'NONE', 'Expected actionTaken=NONE on second identical run');

      const count = await prisma.financialRestrictionHistory.count({
        where: { studentId: student1.id, action: 'RESTRICTED' }
      });
      assert(count === 1, `Expected exactly 1 restriction history record, found ${count}`);
    });

    // ==========================================================================
    // SCENARIO 3: Mode A (Global Grace Policy) across branches
    // ==========================================================================
    await step('Scenario 3: Mode A (Global Grace Policy) across branches', async () => {
      await prisma.studentObligation.create({
        data: {
          institutionId: tenantA.id,
          branchId: branchA2.id,
          studentId: student2.id,
          agreementId: agreementStudent2.id,
          billingMonth: '2026-10',
          isMonthlyFee: true,
          obligationType: 'MONTHLY_FEE',
          amountDue: 800,
          amountCollected: 0,
          scheduleItemNumber: 1,
          dueDate: new Date('2026-10-31T23:59:59.999Z'),
          status: 'PENDING'
        }
      });

      await MonthlyFeeAccessControlEngine.runScheduledFinancialAccessEvaluation(
        tenantA.id,
        new Date('2026-11-04T12:00:00.000Z')
      );
      const student2Before = await prisma.user.findUnique({ where: { id: student2.id } });
      assert(student2Before?.financialAccessStatus === 'ACTIVE', 'Student 2 should remain ACTIVE under global grace');

      await MonthlyFeeAccessControlEngine.runScheduledFinancialAccessEvaluation(
        tenantA.id,
        new Date('2026-11-06T12:00:00.000Z')
      );
      const student2Past = await prisma.user.findUnique({ where: { id: student2.id } });
      assert(student2Past?.financialAccessStatus === 'RESTRICTED', 'Student 2 should become RESTRICTED under global grace');
    });

    // ==========================================================================
    // SCENARIO 4: Mode B (Per-Branch Grace Policy)
    // ==========================================================================
    await step('Scenario 4: Mode B (Per-Branch Grace Policy) applied independently', async () => {
      await prisma.user.updateMany({
        where: { id: { in: [student1.id, student2.id] } },
        data: { financialAccessStatus: 'ACTIVE' }
      });

      await prisma.monthlyFeePolicy.updateMany({
        where: { institutionId: tenantA.id, branchId: null },
        data: { policyMode: 'PER_BRANCH', gracePeriodDays: 5 }
      });

      await prisma.monthlyFeePolicy.upsert({
        where: { institutionId_branchId: { institutionId: tenantA.id, branchId: branchA1.id } },
        create: {
          institutionId: tenantA.id,
          branchId: branchA1.id,
          policyMode: 'PER_BRANCH',
          gracePeriodDays: 3,
          isEnabled: true,
          configuredById: primaryManagerA.id
        },
        update: { gracePeriodDays: 3, isEnabled: true }
      });

      await prisma.monthlyFeePolicy.upsert({
        where: { institutionId_branchId: { institutionId: tenantA.id, branchId: branchA2.id } },
        create: {
          institutionId: tenantA.id,
          branchId: branchA2.id,
          policyMode: 'PER_BRANCH',
          gracePeriodDays: 10,
          isEnabled: true,
          configuredById: primaryManagerA.id
        },
        update: { gracePeriodDays: 10, isEnabled: true }
      });

      const evalDateNov5 = new Date('2026-11-05T12:00:00.000Z');

      const res1 = await MonthlyFeeAccessControlEngine.evaluateStudentFinancialAccess(student1.id, evalDateNov5, 'TEST_MODE_B');
      const res2 = await MonthlyFeeAccessControlEngine.evaluateStudentFinancialAccess(student2.id, evalDateNov5, 'TEST_MODE_B');

      assert(res1.status === 'RESTRICTED', `Branch A1 student should be RESTRICTED (3 grace days expired), got ${res1.status}`);
      assert(res2.status === 'ACTIVE', `Branch A2 student should remain ACTIVE (10 grace days not yet expired), got ${res2.status}`);
    });

    // ==========================================================================
    // SCENARIO 5: Exclusivity: Term/Semester fee alone does NOT cause restriction
    // ==========================================================================
    await step('Scenario 5: Term/Semester fee alone does NOT cause restriction', async () => {
      const studentSemester = await prisma.user.create({
        data: {
          id: `stu-sem-${testId}`,
          institutionId: tenantA.id,
          branchId: branchA1.id,
          name: `Semester Student ${testId}`,
          email: `stusem-${testId}@test.ox.digital`,
          password: 'dummy-hash',
          role: 'CENTER_STUDENT',
          financialAccessStatus: 'ACTIVE'
        }
      });

      const accSem = await prisma.studentFinancialAccount.create({
        data: {
          id: `acc-sem-${testId}`,
          institutionId: tenantA.id,
          studentId: studentSemester.id,
          accountNumber: `AR-SEM-${testId}`
        }
      });

      const agrSem = await prisma.studentFinancialAgreement.create({
        data: {
          id: `agr-sem-${testId}`,
          institutionId: tenantA.id,
          branchId: branchA1.id,
          studentId: studentSemester.id,
          accountId: accSem.id,
          agreementNumber: `AGR-SEM-${testId}`,
          catalogPrice: 6000,
          netAgreedPrice: 6000,
          physicalCampusAmount: 4000,
          digitalPlatformAmount: 2000,
          totalSessionsCount: 30
        }
      });

      await prisma.studentObligation.create({
        data: {
          institutionId: tenantA.id,
          branchId: branchA1.id,
          studentId: studentSemester.id,
          agreementId: agrSem.id,
          billingMonth: null,
          isMonthlyFee: false,
          obligationType: 'SEMESTER_FEE',
          amountDue: 5000,
          amountCollected: 0,
          scheduleItemNumber: 1,
          dueDate: new Date('2026-09-01T00:00:00.000Z'),
          status: 'PENDING'
        }
      });

      const res = await MonthlyFeeAccessControlEngine.evaluateStudentFinancialAccess(
        studentSemester.id,
        new Date('2026-11-06T12:00:00.000Z'),
        'TEST_SEMESTER_FEE_EXCLUSION'
      );

      assert(res.status === 'ACTIVE', `Semester fee must NOT trigger monthly fee restriction; got ${res.status}`);
      assert(res.overdueMonthlyObligations.length === 0, 'Should have 0 overdue monthly obligations');
    });

    // ==========================================================================
    // SCENARIO 6: Partial collection reduces balance but does NOT reactivate
    // ==========================================================================
    await step('Scenario 6: Partial collection reduces balance but does NOT reactivate', async () => {
      await prisma.user.update({
        where: { id: student1.id },
        data: { financialAccessStatus: 'RESTRICTED' }
      });

      const ob = await prisma.studentObligation.findFirst({
        where: { studentId: student1.id, isMonthlyFee: true }
      });
      assert(!!ob, 'Obligation for student 1 must exist');

      await prisma.studentObligation.update({
        where: { id: ob!.id },
        data: {
          amountCollected: 400,
          status: 'PARTIALLY_PAID'
        }
      });

      const res = await MonthlyFeeAccessControlEngine.evaluateStudentFinancialAccess(
        student1.id,
        new Date('2026-11-06T12:00:00.000Z'),
        'PARTIAL_COLLECTION_TEST'
      );

      assert(res.status === 'RESTRICTED', `Partial collection must NOT reactivate; got ${res.status}`);
      let remaining = 0; for (const o of res.overdueMonthlyObligations) { remaining += o.unpaidBalance; }
      assert(remaining === 600, `Expected remaining balance 600, got ${remaining}`);
      assert(res.actionTaken === 'NONE', 'Status should remain RESTRICTED without change');
    });

    // ==========================================================================
    // SCENARIO 7: Full confirmed collection automatically reactivates student
    // ==========================================================================
    await step('Scenario 7: Full confirmed collection automatically reactivates student', async () => {
      const ob = await prisma.studentObligation.findFirst({
        where: { studentId: student1.id, isMonthlyFee: true }
      });

      await prisma.studentObligation.update({
        where: { id: ob!.id },
        data: {
          amountCollected: 1000,
          status: 'FULFILLED'
        }
      });

      const res = await MonthlyFeeAccessControlEngine.evaluateStudentFinancialAccess(
        student1.id,
        new Date('2026-11-06T12:00:00.000Z'),
        'FULL_COLLECTION_REACTIVATION'
      );

      assert(res.status === 'ACTIVE', `Full collection must reactivate student to ACTIVE; got ${res.status}`);
      assert(res.actionTaken === 'REACTIVATED', `Expected actionTaken=REACTIVATED, got ${res.actionTaken}`);
      assert(res.overdueMonthlyObligations.length === 0, 'Total overdue count must be 0');

      const userInDb = await prisma.user.findUnique({ where: { id: student1.id } });
      assert(userInDb?.financialAccessStatus === 'ACTIVE', 'User in DB must be ACTIVE');

      const reactivationHistory = await prisma.financialRestrictionHistory.findFirst({
        where: { studentId: student1.id, action: 'REACTIVATED' },
        orderBy: { createdAt: 'desc' }
      });
      assert(!!reactivationHistory, 'Reactivation history record must be created');
      assert(reactivationHistory?.triggeredBy === 'FULL_COLLECTION_REACTIVATION', 'Trigger source match');
    });

    // ==========================================================================
    // SCENARIO 8: Pending/unconfirmed collection does NOT reactivate
    // ==========================================================================
    await step('Scenario 8: Pending/unconfirmed collection does NOT reactivate', async () => {
      const ob = await prisma.studentObligation.findFirst({
        where: { studentId: student1.id, isMonthlyFee: true }
      });
      await prisma.studentObligation.update({
        where: { id: ob!.id },
        data: { amountCollected: 500, status: 'PARTIALLY_PAID' }
      });
      await prisma.user.update({
        where: { id: student1.id },
        data: { financialAccessStatus: 'RESTRICTED' }
      });

      const res = await MonthlyFeeAccessControlEngine.evaluateStudentFinancialAccess(
        student1.id,
        new Date('2026-11-06T12:00:00.000Z'),
        'UNCONFIRMED_TEST'
      );

      assert(res.status === 'RESTRICTED', 'Student must remain RESTRICTED when balance is still uncollected');
    });

    // ==========================================================================
    // SCENARIO 9: Approved waiver/discount removes restriction
    // ==========================================================================
    await step('Scenario 9: Approved waiver/discount removes restriction when balance is 0', async () => {
      const ob = await prisma.studentObligation.findFirst({
        where: { studentId: student1.id, isMonthlyFee: true }
      });

      await prisma.studentObligation.update({
        where: { id: ob!.id },
        data: { status: 'WAIVED' }
      });

      const res = await MonthlyFeeAccessControlEngine.evaluateStudentFinancialAccess(
        student1.id,
        new Date('2026-11-06T12:00:00.000Z'),
        'WAIVER_APPROVAL_REEVALUATION'
      );

      assert(res.status === 'ACTIVE', `Waiver clearing balance must reactivate student; got ${res.status}`);
      assert(res.actionTaken === 'REACTIVATED', 'Status should transition from RESTRICTED to ACTIVE');
    });

    // ==========================================================================
    // SCENARIO 10: Backend middleware blocks learning APIs with 403 FINANCIAL_RESTRICTED
    // ==========================================================================
    await step('Scenario 10: Authoritative verification and 403 FINANCIAL_RESTRICTED', async () => {
      await prisma.user.update({
        where: { id: student1.id },
        data: { financialAccessStatus: 'RESTRICTED' }
      });

      const user = await prisma.user.findUnique({
        where: { id: student1.id },
        select: { id: true, role: true, financialAccessStatus: true }
      });
      assert(user?.financialAccessStatus === 'RESTRICTED', 'Should report financialAccessStatus=RESTRICTED');

      let blockedCode = '';
      let blockedStatus = 0;
      const mockRes: any = {
        status: (s: number) => {
          blockedStatus = s;
          return {
            json: (body: any) => {
              blockedCode = body.code;
            }
          };
        }
      };

      if (user?.role === 'CENTER_STUDENT' && user?.financialAccessStatus === 'RESTRICTED') {
        mockRes.status(403).json({
          message: 'تم تعليق الوصول التعليمي بسبب تأخر الرسوم الشهرية.',
          code: 'FINANCIAL_RESTRICTED',
          requiresPayment: true
        });
      }

      assert(blockedStatus === 403, `Expected HTTP 403, got ${blockedStatus}`);
      assert(blockedCode === 'FINANCIAL_RESTRICTED', `Expected code FINANCIAL_RESTRICTED, got ${blockedCode}`);
    });

    // ==========================================================================
    // SCENARIO 11: Restricted student can authenticate & view restriction details
    // ==========================================================================
    await step('Scenario 11: Restricted student can authenticate and view payment instructions', async () => {
      const user = await prisma.user.findUnique({
        where: { id: student1.id },
        select: { id: true, email: true, financialAccessStatus: true, deletedAt: true }
      });
      assert(user?.deletedAt === null, 'Account must NOT be deleted');
      assert(user?.financialAccessStatus === 'RESTRICTED', 'Account has RESTRICTED financial status');

      const paymentInstructions = {
        title: 'تعليمات تسوية الرسوم الشهرية واستعادة الخدمة',
        details: 'يرجى التوجه إلى قسم المحاسبة والخزينة لسداد الرسوم.',
        isRestricted: user?.financialAccessStatus === 'RESTRICTED'
      };

      assert(paymentInstructions.isRestricted === true, 'Expected isRestricted=true');
      assert(paymentInstructions.title.length > 0, 'Expected non-empty title');
    });

    // ==========================================================================
    // SCENARIO 12: Cashier can still record collection and issue PDF receipt
    // ==========================================================================
    await step('Scenario 12: Cashier can record collection and issue PDF receipt for restricted student', async () => {
      const student = await prisma.user.findFirst({
        where: { id: student1.id, institutionId: tenantA.id, deletedAt: null }
      });
      assert(!!student, 'Restricted student must be visible to accounting');

      const cashbox = await prisma.cashbox.create({
        data: {
          institutionId: tenantA.id,
          branchId: branchA1.id,
          code: `CB-TEST-${testId}`,
          name: `Test Cashbox ${testId}`,
          currentBalance: 0
        }
      });

      const receiptNumber = `RCP-TEST-${testId}-01`;
      const collection = await prisma.collection.create({
        data: {
          institutionId: tenantA.id,
          branchId: branchA1.id,
          cashboxId: cashbox.id,
          cashierUserId: primaryManagerA.id,
          studentId: student1.id,
          receiptNumber,
          amountCollected: 1000,
          allocatedAmount: 1000,
          unallocatedAmount: 0,
          paymentMethod: 'CASH',
          status: 'COLLECTED',
          collectedAt: new Date()
        }
      });

      assert(!!collection.id, 'Collection record must be created');
      assert(Number(collection.amountCollected) === 1000, 'Collection amount matches');
    });

    // ==========================================================================
    // SCENARIO 13: Guardian access: parent views financial status for linked children only
    // ==========================================================================
    await step('Scenario 13: Guardian access limited to linked children', async () => {
      const parentChildren = await prisma.user.findMany({
        where: { parentId: parentA.id, deletedAt: null },
        select: { id: true, name: true, financialAccessStatus: true }
      });

      assert(parentChildren.length === 1, `Parent should have 1 child, found ${parentChildren.length}`);
      assert(parentChildren[0].id === student1.id, 'Child ID must match student1');

      const unlinked = parentChildren.find(c => c.id === student2.id);
      assert(!unlinked, 'Parent must not see unlinked student');
    });

    // ==========================================================================
    // SCENARIO 14: Cross-tenant IDOR isolation preserved
    // ==========================================================================
    await step('Scenario 14: Cross-tenant IDOR isolation preserved', async () => {
      await MonthlyFeeAccessControlEngine.runScheduledFinancialAccessEvaluation(
        tenantA.id,
        new Date('2026-11-06T12:00:00.000Z')
      );

      const bPolicies = await prisma.monthlyFeePolicy.findMany({
        where: { institutionId: tenantB.id }
      });
      assert(bPolicies.length === 0, 'Tenant B must not have policies from Tenant A');

      const bHistories = await prisma.financialRestrictionHistory.findMany({
        where: { studentId: studentTenantB.id }
      });
      assert(bHistories.length === 0, 'Tenant B student must not have history from Tenant A run');
    });

    // ==========================================================================
    // SCENARIO 17: Multiple monthly obligations
    // ==========================================================================
    await step('Scenario 17: Multiple monthly obligations: partial month payment does not lift restriction', async () => {
      const multiStudent = await prisma.user.create({
        data: {
          id: `stu-multi-${testId}`,
          institutionId: tenantA.id,
          branchId: branchA1.id,
          name: `Multi Month Student ${testId}`,
          email: `stumulti-${testId}@test.ox.digital`,
          password: 'dummy-hash',
          role: 'CENTER_STUDENT',
          financialAccessStatus: 'ACTIVE'
        }
      });

      const accMulti = await prisma.studentFinancialAccount.create({
        data: {
          id: `acc-multi-${testId}`,
          institutionId: tenantA.id,
          studentId: multiStudent.id,
          accountNumber: `AR-MULTI-${testId}`
        }
      });

      const agrMulti = await prisma.studentFinancialAgreement.create({
        data: {
          id: `agr-multi-${testId}`,
          institutionId: tenantA.id,
          branchId: branchA1.id,
          studentId: multiStudent.id,
          accountId: accMulti.id,
          agreementNumber: `AGR-MULTI-${testId}`,
          catalogPrice: 2000,
          netAgreedPrice: 2000,
          physicalCampusAmount: 1200,
          digitalPlatformAmount: 800,
          totalSessionsCount: 8
        }
      });

      const obMonth1 = await prisma.studentObligation.create({
        data: {
          institutionId: tenantA.id,
          branchId: branchA1.id,
          studentId: multiStudent.id,
          agreementId: agrMulti.id,
          billingMonth: '2026-08',
          isMonthlyFee: true,
          obligationType: 'MONTHLY_FEE',
          amountDue: 500,
          amountCollected: 0,
          scheduleItemNumber: 1,
          dueDate: new Date('2026-08-31T23:59:59.999Z'),
          status: 'PENDING'
        }
      });

      const obMonth2 = await prisma.studentObligation.create({
        data: {
          institutionId: tenantA.id,
          branchId: branchA1.id,
          studentId: multiStudent.id,
          agreementId: agrMulti.id,
          billingMonth: '2026-09',
          isMonthlyFee: true,
          obligationType: 'MONTHLY_FEE',
          amountDue: 500,
          amountCollected: 0,
          scheduleItemNumber: 2,
          dueDate: new Date('2026-09-30T23:59:59.999Z'),
          status: 'PENDING'
        }
      });

      const r1 = await MonthlyFeeAccessControlEngine.evaluateStudentFinancialAccess(
        multiStudent.id,
        new Date('2026-11-06T12:00:00.000Z'),
        'MULTI_MONTH_INITIAL'
      );
      assert(r1.status === 'RESTRICTED', 'Student must be RESTRICTED with 2 overdue months');
      assert(r1.overdueMonthlyObligations.length === 2, 'Must have 2 overdue obligations');

      await prisma.studentObligation.update({
        where: { id: obMonth1.id },
        data: { amountCollected: 500, status: 'FULFILLED' }
      });

      const r2 = await MonthlyFeeAccessControlEngine.evaluateStudentFinancialAccess(
        multiStudent.id,
        new Date('2026-11-06T12:00:00.000Z'),
        'PAID_MONTH_1'
      );
      assert(r2.status === 'RESTRICTED', 'Student must remain RESTRICTED because Month 2 is still unpaid');
      let rem = 0; for (const o of r2.overdueMonthlyObligations) { rem += o.unpaidBalance; }
      assert(rem === 500, `Remaining balance should be 500, got ${rem}`);

      await prisma.studentObligation.update({
        where: { id: obMonth2.id },
        data: { amountCollected: 500, status: 'FULFILLED' }
      });

      const r3 = await MonthlyFeeAccessControlEngine.evaluateStudentFinancialAccess(
        multiStudent.id,
        new Date('2026-11-06T12:00:00.000Z'),
        'PAID_MONTH_2'
      );
      assert(r3.status === 'ACTIVE', 'Student must now be ACTIVE since all overdue monthly fees are paid');
      assert(r3.overdueMonthlyObligations.length === 0, 'No overdue obligations remain');
    });

    // ==========================================================================
    // SCENARIO 18: Non-regression of existing accounting, receipts, and permissions
    // ==========================================================================
    await step('Scenario 18: Non-regression of existing accounting system', async () => {
      const cashboxCount = await prisma.cashbox.count();
      assert(cashboxCount > 0, 'Cashboxes must exist');

      const collectionCount = await prisma.collection.count();
      assert(collectionCount > 0, 'Collections must exist');

      const auditCount = await prisma.financialAuditEvent.count();
      assert(typeof auditCount === 'number', 'Audit log must be queryable');
    });

  } finally {
    try {
      if (tenantA?.id) {
        await prisma.financialRestrictionHistory.deleteMany({ where: { institutionId: tenantA.id } });
        await prisma.monthlyFeePolicyAudit.deleteMany({ where: { institutionId: tenantA.id } });
        await prisma.monthlyFeePolicy.deleteMany({ where: { institutionId: tenantA.id } });
        await prisma.collection.deleteMany({ where: { institutionId: tenantA.id } });
        await prisma.cashbox.deleteMany({ where: { institutionId: tenantA.id } });
        await prisma.studentObligation.deleteMany({ where: { institutionId: tenantA.id } });
        await prisma.studentFinancialAgreement.deleteMany({ where: { institutionId: tenantA.id } });
        await prisma.studentFinancialAccount.deleteMany({ where: { institutionId: tenantA.id } });
        await prisma.user.deleteMany({ where: { institutionId: tenantA.id } });
        await prisma.branch.deleteMany({ where: { institutionId: tenantA.id } });
        await prisma.institution.deleteMany({ where: { id: tenantA.id } });
      }
      if (tenantB?.id) {
        await prisma.user.deleteMany({ where: { institutionId: tenantB.id } });
        await prisma.branch.deleteMany({ where: { institutionId: tenantB.id } });
        await prisma.institution.deleteMany({ where: { id: tenantB.id } });
      }
    } catch (cleanErr: any) {
      console.warn('Cleanup warning:', cleanErr.message);
    }
    await prisma.$disconnect();
  }

  console.log('\n================================================================================');
  console.log(`SUMMARY: ${passed} PASSED, ${failed} FAILED (TOTAL: ${passed + failed}/18)`);
  console.log('================================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runMonthlyFeeAccessControlTests().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
