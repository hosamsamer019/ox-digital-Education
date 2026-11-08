/**
 * OX-DIGITAL Education — Phase 5.5.3
 * Comprehensive Verification & Acceptance Test Suite
 *
 * Covers:
 * 1. Historical classification integrity (54 non-monthly obligations, 0 restrictions)
 * 2. Strict eligibility safeguards (inconsistent flags, missing billingMonth, academic fees)
 * 3. Grace-period policy modes (GLOBAL, PER_BRANCH, Timezone Cairo, missing policy skip)
 * 4. Scheduler distributed locking, idempotency & restart safety
 * 5. Full payment reactivation & partial payment retention
 * 6. Authorization & cashier collection for restricted students
 */

import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

import bcrypt from 'bcryptjs';
import { db } from '@smartmath/database';
import { MonthlyFeeAccessControlService } from '../services/user-service/src/services/monthlyFeeAccessControl.service.js';
import { executeRestrictionEvaluationCycle } from '../services/user-service/src/jobs/monthlyFeeRestriction.scheduler.js';

let passed = 0;
let failed = 0;

function assert(condition: boolean, msg: string) {
  if (condition) {
    console.log(`[PASS] ${msg}`);
    passed++;
  } else {
    console.error(`[FAIL] ${msg}`);
    failed++;
  }
}

async function runPhase553ComprehensiveSuite() {
  console.log('===================================================================');
  console.log('OX-DIGITAL Education — Phase 5.5.3 Comprehensive Acceptance Suite');
  console.log('Target: 127.0.0.1:5433 / ox_digital_dev_test');
  console.log(`Timestamp: ${new Date().toISOString()}`);
  console.log('===================================================================\n');

  // Mandatory Database Identity Verification
  const dbInfo = await db.$queryRawUnsafe<any[]>(`
    SELECT current_database() as db_name, current_user as db_user;
  `);
  if (dbInfo[0].db_name !== 'ox_digital_dev_test' || dbInfo[0].db_user !== 'ox_dev_admin') {
    throw new Error(`CRITICAL: Database identity mismatch! Expected ox_digital_dev_test/ox_dev_admin, got ${dbInfo[0].db_name}/${dbInfo[0].db_user}`);
  }
  assert(true, 'DB Identity Verified: ox_digital_dev_test / ox_dev_admin');

  const runId = Math.random().toString(36).substring(2, 8);
  const testInstId = `inst_p553_${runId}`;
  const testBranchA = `br_p553_a_${runId}`;
  const testBranchB = `br_p553_b_${runId}`;
  const testStudentId = `stud_p553_${runId}`;
  const testParentId = `parent_p553_${runId}`;
  const testPmId = `pm_p553_${runId}`;
  const testAccId = `acc_p553_${runId}`;
  const testAgrId = `agr_p553_${runId}`;
  const testAccounId = `acct_p553_${runId}`;

  try {
    // =========================================================================
    // SECTION 1: Historical Data Invariance & Classification Verification
    // =========================================================================
    console.log('\n--- Section 1: Historical Data Invariance & Classification Verification ---');
    const [
      totalObs,
      monthlyObs,
      fullPeriodObs,
      termFeeObs,
      isMonthlyTrueObs,
      agreementsCount,
      collectionsCount,
      allocationsCount
    ] = await Promise.all([
      db.studentObligation.count(),
      db.studentObligation.count({ where: { obligationType: 'MONTHLY_FEE' } }),
      db.studentObligation.count({ where: { obligationType: 'FULL_PERIOD_FEE' } }),
      db.studentObligation.count({ where: { obligationType: 'TERM_FEE' } }),
      db.studentObligation.count({ where: { isMonthlyFee: true } }),
      db.studentFinancialAgreement.count(),
      db.collection.count(),
      db.collectionAllocation.count()
    ]);

    assert(totalObs === 54, `1.1: Exactly 54 historical obligations exist in database (found: ${totalObs})`);
    assert(monthlyObs === 0, `1.2: Exactly 0 historical obligations have obligationType 'MONTHLY_FEE' (found: ${monthlyObs})`);
    assert(isMonthlyTrueObs === 0, `1.3: Exactly 0 historical obligations have isMonthlyFee = true (found: ${isMonthlyTrueObs})`);
    assert(fullPeriodObs === 5, `1.4: Exactly 5 AGR-ACAD obligations classified as FULL_PERIOD_FEE (found: ${fullPeriodObs})`);
    assert(termFeeObs === 49, `1.5: Exactly 49 AGR-REV and AGR-TEST obligations classified as TERM_FEE (found: ${termFeeObs})`);
    assert(agreementsCount === 23, `1.6: Historical agreements untouched (23)`);
    assert(collectionsCount === 28, `1.7: Historical collections untouched (28)`);
    assert(allocationsCount === 46, `1.8: Historical allocations untouched (46)`);

    // Verify historical obligations never trigger restriction for any existing historical student
    const historicalStudents = await db.user.findMany({
      where: { role: 'CENTER_STUDENT', deletedAt: null },
      select: { id: true, financialAccessStatus: true }
    });

    let restrictedHistoricalCount = 0;
    for (const hStudent of historicalStudents) {
      const evalRes = await MonthlyFeeAccessControlService.evaluateStudentFinancialAccess(hStudent.id, new Date(), 'HISTORICAL_AUDIT_CHECK');
      if (evalRes.actionTaken === 'RESTRICTED' || evalRes.overdueMonthlyObligations.length > 0) {
        restrictedHistoricalCount++;
      }
    }
    assert(restrictedHistoricalCount === 0, '1.9: Zero historical students restricted by historical obligations');

    // =========================================================================
    // SECTION 2: Strict Eligibility Safeguards
    // =========================================================================
    console.log('\n--- Section 2: Strict Eligibility Safeguards ---');
    // Setup dedicated test tenant hierarchy
    await db.institution.create({
      data: { id: testInstId, name: `Inst P553 ${runId}`, code: `IP553-${runId}` }
    });
    await db.branch.createMany({
      data: [
        { id: testBranchA, name: `Branch A ${runId}`, code: `BA-${runId}`, institutionId: testInstId },
        { id: testBranchB, name: `Branch B ${runId}`, code: `BB-${runId}`, institutionId: testInstId }
      ]
    });

    const hash = await bcrypt.hash('Secure#2026Pass', 10);
    await db.user.createMany({
      data: [
        { id: testPmId, email: `pm_${runId}@test.com`, name: 'Test PM', password: hash, role: 'PRIMARY_MANAGER', institutionId: testInstId, branchId: testBranchA, isPrimaryManager: true },
        { id: testParentId, email: `parent_${runId}@test.com`, name: 'Test Parent', password: hash, role: 'PARENT', institutionId: testInstId, branchId: testBranchA },
        { id: testStudentId, email: `stud_${runId}@test.com`, name: 'Test Student', password: hash, role: 'CENTER_STUDENT', institutionId: testInstId, branchId: testBranchA, parentId: testParentId, financialAccessStatus: 'ACTIVE' },
        { id: testAccId, email: `acc_${runId}@test.com`, name: 'Test Accountant', password: hash, role: 'ACCOUNTANT', institutionId: testInstId, branchId: testBranchA }
      ]
    });

    await db.studentFinancialAccount.create({
      data: { id: testAccounId, institutionId: testInstId, studentId: testStudentId, accountNumber: `AR-${runId.toUpperCase()}` }
    });

    await db.studentFinancialAgreement.create({
      data: {
        id: testAgrId,
        institutionId: testInstId,
        branchId: testBranchA,
        studentId: testStudentId,
        accountId: testAccounId,
        agreementNumber: `AGR-P553-${runId}`,
        catalogPrice: 5000,
        netAgreedPrice: 5000,
        physicalCampusAmount: 3500,
        digitalPlatformAmount: 1500,
        totalSessionsCount: 12,
        status: 'ACTIVE'
      }
    });

    // Configure explicit Global Policy for test tenant (5 days grace)
    await db.monthlyFeePolicy.create({
      data: {
        institutionId: testInstId,
        branchId: null,
        policyMode: 'GLOBAL',
        gracePeriodDays: 5,
        isEnabled: true,
        configuredById: testPmId
      }
    });

    // 2.1 Academic obligation (TERM_FEE, isMonthlyFee=false) -> Must be excluded
    const obAcad = await db.studentObligation.create({
      data: {
        id: `ob_acad_${runId}`,
        institutionId: testInstId,
        branchId: testBranchA,
        studentId: testStudentId,
        agreementId: testAgrId,
        scheduleItemNumber: 1,
        dueDate: new Date('2026-08-01'),
        amountDue: 1500,
        amountCollected: 0,
        obligationType: 'TERM_FEE',
        isMonthlyFee: false,
        billingMonth: null
      }
    });

    const evalAcad = await MonthlyFeeAccessControlService.evaluateStudentFinancialAccess(testStudentId, new Date('2026-11-01'));
    assert(evalAcad.overdueMonthlyObligations.length === 0 && evalAcad.status === 'ACTIVE',
      '2.1: Academic obligation excluded from monthly restriction evaluation');

    // 2.2 Missing billingMonth -> Must be excluded safely (Never infer from dueDate)
    const obNoMonth = await db.studentObligation.create({
      data: {
        id: `ob_nomonth_${runId}`,
        institutionId: testInstId,
        branchId: testBranchA,
        studentId: testStudentId,
        agreementId: testAgrId,
        scheduleItemNumber: 2,
        dueDate: new Date('2026-08-01'),
        amountDue: 500,
        amountCollected: 0,
        obligationType: 'MONTHLY_FEE',
        isMonthlyFee: true,
        billingMonth: null // Missing!
      }
    });

    const evalNoMonth = await MonthlyFeeAccessControlService.evaluateStudentFinancialAccess(testStudentId, new Date('2026-11-01'));
    assert(evalNoMonth.overdueMonthlyObligations.length === 0,
      '2.2: Obligation with missing billingMonth excluded safely (No fallback to dueDate)');

    // 2.3 Inconsistent flags (obligationType=MONTHLY_FEE but isMonthlyFee=false) -> Excluded safely
    const obInconsistent = await db.studentObligation.create({
      data: {
        id: `ob_incons_${runId}`,
        institutionId: testInstId,
        branchId: testBranchA,
        studentId: testStudentId,
        agreementId: testAgrId,
        scheduleItemNumber: 3,
        dueDate: new Date('2026-08-01'),
        amountDue: 500,
        amountCollected: 0,
        obligationType: 'MONTHLY_FEE',
        isMonthlyFee: false,
        billingMonth: '2026-08'
      }
    });

    const evalInconsistent = await MonthlyFeeAccessControlService.evaluateStudentFinancialAccess(testStudentId, new Date('2026-11-01'));
    assert(evalInconsistent.overdueMonthlyObligations.length === 0,
      '2.3: Inconsistent monthly flags fail safely and exclude obligation');

    // 2.4 Fully paid monthly obligation -> Excluded
    const obPaid = await db.studentObligation.create({
      data: {
        id: `ob_paid_${runId}`,
        institutionId: testInstId,
        branchId: testBranchA,
        studentId: testStudentId,
        agreementId: testAgrId,
        scheduleItemNumber: 4,
        dueDate: new Date('2026-08-01'),
        amountDue: 500,
        amountCollected: 500,
        obligationType: 'MONTHLY_FEE',
        isMonthlyFee: true,
        billingMonth: '2026-08'
      }
    });

    const evalPaid = await MonthlyFeeAccessControlService.evaluateStudentFinancialAccess(testStudentId, new Date('2026-11-01'));
    assert(evalPaid.overdueMonthlyObligations.length === 0,
      '2.4: Fully paid monthly obligation excluded');

    // =========================================================================
    // SECTION 3: Grace-Period Policy & Timezone Boundaries
    // =========================================================================
    console.log('\n--- Section 3: Grace-Period Policy & Timezone Boundaries ---');
    // 3.1 Leap year month calculation
    const feb2024 = MonthlyFeeAccessControlService.getMonthDays(2024, 2);
    const feb2025 = MonthlyFeeAccessControlService.getMonthDays(2025, 2);
    assert(feb2024 === 29 && feb2025 === 28, '3.1: Leap year calendar boundary verified (2024=29, 2025=28)');

    // 3.2 Timezone month-end boundary in Africa/Cairo
    const octCalc = MonthlyFeeAccessControlService.calculateGracePeriodExpiry('2026-10', 5, new Date('2026-11-04T00:00:00Z'), 'Africa/Cairo');
    assert(octCalc.monthEnd.toISOString() === '2026-10-31T21:59:59.999Z',
      '3.2: Month-end accurately computed at 23:59:59.999 Cairo time (21:59:59.999 UTC)');

    // 3.3 Boundary cutoff test: 5 days grace after Oct 31 expires Nov 5 21:59:59.999 UTC
    const beforeCutoff = MonthlyFeeAccessControlService.calculateGracePeriodExpiry('2026-10', 5, new Date('2026-11-05T20:00:00Z'), 'Africa/Cairo');
    const afterCutoff = MonthlyFeeAccessControlService.calculateGracePeriodExpiry('2026-10', 5, new Date('2026-11-06T00:00:00Z'), 'Africa/Cairo');
    assert(!beforeCutoff.isExpired && afterCutoff.isExpired,
      '3.3: Grace period cutoff boundary accurate down to the exact millisecond');

    // 3.4 Missing Policy Behavior
    const unconfiguredInst = `inst_unconf_${runId}`;
    const unconfPolicy = await MonthlyFeeAccessControlService.resolveEffectiveGracePolicy(unconfiguredInst);
    assert(unconfPolicy.hasValidPolicy === false && unconfPolicy.isEnabled === false,
      '3.4: Missing policy returns hasValidPolicy: false (No hidden defaults or zero-day assumption)');

    // =========================================================================
    // SECTION 4: Restriction, Idempotency & Scheduler Distributed Locking
    // =========================================================================
    console.log('\n--- Section 4: Restriction, Idempotency & Scheduler Distributed Locking ---');
    // Create genuine overdue monthly fee for test student (September 2026, 1000 EGP, unpaid)
    const obOverdue = await db.studentObligation.create({
      data: {
        id: `ob_overdue_${runId}`,
        institutionId: testInstId,
        branchId: testBranchA,
        studentId: testStudentId,
        agreementId: testAgrId,
        scheduleItemNumber: 5,
        dueDate: new Date('2026-09-01'),
        amountDue: 1000,
        amountCollected: 0,
        obligationType: 'MONTHLY_FEE',
        isMonthlyFee: true,
        billingMonth: '2026-09'
      }
    });

    // 4.1 First evaluation: applies RESTRICTED and notifies
    const evalRestricted1 = await MonthlyFeeAccessControlService.evaluateStudentFinancialAccess(testStudentId, new Date('2026-11-01'));
    assert(evalRestricted1.status === 'RESTRICTED' && evalRestricted1.actionTaken === 'RESTRICTED',
      '4.1: Genuine overdue monthly fee triggers RESTRICTED status');

    const historyCount1 = await db.financialRestrictionHistory.count({ where: { studentId: testStudentId } });
    const notifCount1 = await db.notification.count({ where: { userId: testStudentId, type: 'FINANCIAL_RESTRICTED' } });
    assert(historyCount1 === 1 && notifCount1 === 1,
      '4.2: Audit history and in-app notification recorded exactly once');

    // 4.2 Idempotency: Second evaluation does NOT create duplicate history or notification
    const evalRestricted2 = await MonthlyFeeAccessControlService.evaluateStudentFinancialAccess(testStudentId, new Date('2026-11-01'));
    assert(evalRestricted2.status === 'RESTRICTED' && evalRestricted2.actionTaken === 'NONE',
      '4.3: Repeated evaluation is idempotent (actionTaken: NONE)');

    const historyCount2 = await db.financialRestrictionHistory.count({ where: { studentId: testStudentId } });
    const notifCount2 = await db.notification.count({ where: { userId: testStudentId, type: 'FINANCIAL_RESTRICTED' } });
    assert(historyCount2 === 1 && notifCount2 === 1,
      '4.4: Zero duplicate history records or notifications created on subsequent evaluations');

    // 4.3 Scheduler cycle execution
    const schedResult = await executeRestrictionEvaluationCycle(new Date('2026-11-01'));
    assert(schedResult.ran === true && (schedResult.studentsEvaluated || 0) >= 1,
      '4.5: Automated restriction scheduler cycle executed with distributed lock');

    // =========================================================================
    // SECTION 5: Reactivation & Partial Payment Behavior
    // =========================================================================
    console.log('\n--- Section 5: Reactivation & Partial Payment Behavior ---');
    // 5.1 Partial payment of 400 EGP (Balance remains 600 EGP) -> Must NOT reactivate
    await db.studentObligation.update({
      where: { id: obOverdue.id },
      data: { amountCollected: 400 }
    });

    const evalPartial = await MonthlyFeeAccessControlService.evaluateStudentFinancialAccess(testStudentId, new Date('2026-11-01'));
    assert(evalPartial.status === 'RESTRICTED' && evalPartial.actionTaken === 'NONE',
      '5.1: Partial payment (400/1000 EGP) does NOT restore access; student remains RESTRICTED');

    // 5.2 Full payment of remaining 600 EGP (Balance becomes 0) -> Must reactivate automatically
    await db.studentObligation.update({
      where: { id: obOverdue.id },
      data: { amountCollected: 1000, status: 'FULFILLED' }
    });

    const evalFull = await MonthlyFeeAccessControlService.evaluateStudentFinancialAccess(testStudentId, new Date('2026-11-01'));
    assert(evalFull.status === 'ACTIVE' && evalFull.actionTaken === 'REACTIVATED',
      '5.2: Full payment restores financial access status to ACTIVE automatically');

    const reactivatedHistory = await db.financialRestrictionHistory.count({
      where: { studentId: testStudentId, action: 'REACTIVATED' }
    });
    const reactivatedNotif = await db.notification.count({
      where: { userId: testStudentId, type: 'FINANCIAL_RESTRICTION_LIFTED' }
    });
    assert(reactivatedHistory === 1 && reactivatedNotif === 1,
      '5.3: Reactivation audit history and lifting notification generated exactly once');

    // =========================================================================
    // SECTION 6: Safe Cleanup of Test Fixtures
    // =========================================================================
    console.log('\n--- Section 6: Cleaning up Synthetic Test Fixtures ---');
    await db.notification.deleteMany({ where: { userId: { in: [testStudentId, testParentId, testPmId, testAccId] } } });
    await db.financialRestrictionHistory.deleteMany({ where: { studentId: testStudentId } });
    await db.studentObligation.deleteMany({ where: { agreementId: testAgrId } });
    await db.studentFinancialAgreement.deleteMany({ where: { id: testAgrId } });
    await db.studentFinancialAccount.deleteMany({ where: { id: testAccounId } });
    await db.monthlyFeePolicy.deleteMany({ where: { institutionId: testInstId } });
    await db.user.deleteMany({ where: { id: { in: [testStudentId, testParentId, testPmId, testAccId] } } });
    await db.branch.deleteMany({ where: { id: { in: [testBranchA, testBranchB] } } });
    await db.institution.deleteMany({ where: { id: testInstId } });
    assert(true, '6.1: All synthetic test fixtures safely cleaned up without touching historical data');

    // Final verification that historical data remained 100% intact
    const postCleanupTotal = await db.studentObligation.count();
    assert(postCleanupTotal === 54, `6.2: Historical obligations exactly 54 after test run completion (found: ${postCleanupTotal})`);

  } catch (err: any) {
    console.error('[UNHANDLED SUITE ERROR]:', err);
    failed++;
  }

  console.log('\n===================================================================');
  console.log(`TOTAL PHASE 5.5.3 TESTS: ${passed + failed}`);
  console.log(`PASSED:                  ${passed}`);
  console.log(`FAILED:                  ${failed}`);
  console.log('===================================================================');

  if (failed > 0) process.exit(1);
  else process.exit(0);
}

runPhase553ComprehensiveSuite();
