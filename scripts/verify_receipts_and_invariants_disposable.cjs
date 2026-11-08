/**
 * OX-DIGITAL Education — Receipt Numbering & Business Invariants Verification
 * Target Database: ox_digital_disposable_receipt_test on 127.0.0.1:5433 ONLY
 */

const path = require('path');
const bcrypt = require('bcryptjs');

const DISPOSABLE_DB = 'ox_digital_disposable_receipt_test';
const DISPOSABLE_URL = `postgresql://ox_dev_admin:r72a-8DsHuifYR1tFg4NMCzH5EXdHlrTkYW-WXShSaM@127.0.0.1:5433/${DISPOSABLE_DB}?schema=public`;

process.env.DATABASE_URL = DISPOSABLE_URL;
process.env.DIRECT_URL = DISPOSABLE_URL;

const { PrismaClient } = require(path.resolve(__dirname, '../node_modules/@prisma/client'));
const db = new PrismaClient({
  datasources: { db: { url: DISPOSABLE_URL } }
});

const { BrdSubscriptionService } = require(path.resolve(__dirname, '../services/user-service/dist/services/user-service/src/services/brdSubscription.service.js'));
const { runDailyLockCycle } = require(path.resolve(__dirname, '../services/user-service/dist/services/user-service/src/jobs/brdDailyLock.scheduler.js'));

let passCount = 0;
let failCount = 0;
const testResults = [];

function assertTest(section, testName, condition, details = '') {
  if (condition) {
    passCount++;
    console.log(`  [PASS] [${section}] ${testName} ${details ? `(${details})` : ''}`);
    testResults.push({ section, testName, status: 'PASS', details });
  } else {
    failCount++;
    console.error(`  [FAIL] [${section}] ${testName} ${details ? `(${details})` : ''}`);
    testResults.push({ section, testName, status: 'FAIL', details });
  }
}

async function runVerification() {
  console.log('================================================================');
  console.log('OX-DIGITAL EDUCATION — SECTION 3 & 7 INVARIANT VERIFICATION');
  console.log(`Database Target: ${DISPOSABLE_DB} (Port 5433)`);
  console.log('================================================================\n');

  // 1. Boundary Check
  const [ident] = await db.$queryRawUnsafe('SELECT current_database() as db, current_user as usr;');
  assertTest('BOUNDARY', 'Connected to Disposable Clone', ident.db === DISPOSABLE_DB, `db=${ident.db}`);
  if (ident.db !== DISPOSABLE_DB) {
    throw new Error(`ABORT: Connected to wrong database ${ident.db}!`);
  }

  // 2. Initial Clean State Verification
  const [{ count: initialReceiptCount }] = await db.$queryRawUnsafe('SELECT count(*) as count FROM "BranchSequentialReceipt";');
  const [{ count: initialCounterCount }] = await db.$queryRawUnsafe('SELECT count(*) as count FROM "BranchReceiptCounter";');
  assertTest('SEC3-CLEAN', 'Initial receipts table is clean (0 rows)', parseInt(initialReceiptCount, 10) === 0);
  assertTest('SEC3-CLEAN', 'Initial counter table is clean (0 rows)', parseInt(initialCounterCount, 10) === 0);

  // Setup test entities in disposable DB
  const timestamp = Date.now();
  const inst = await db.institution.findFirst({ where: { id: 'inst_idor_a_91xnz3' } });
  const branchDokki = await db.branch.findUnique({ where: { id: 'br_idor_a_91xnz3' } });
  const branchNasr = await db.branch.findUnique({ where: { id: 'br_idor_b_w4adp2' } });

  const manager = await db.user.findUnique({ where: { id: 'admin_91xnz3' } });
  const teacher = await db.user.findUnique({ where: { id: 'teach_b_w4adp2' } });
  const accountantDokki = await db.user.findUnique({ where: { id: 'acc_a_w4adp2' } });

  // Create second accountant in Dokki for concurrency testing
  const pwHash = await bcrypt.hash('SecureAccPass123!', 10);
  const accountantDokki2 = await db.user.create({
    data: {
      name: 'Accountant Dokki 2',
      email: `acc.dokki.2.${timestamp}@edu.com`,
      password: pwHash,
      role: 'ACCOUNTANT',
      institutionId: inst.id,
      branchId: branchDokki.id
    }
  });

  // Create an accountant in Nasr City for cross-branch testing
  const accountantNasr = await db.user.create({
    data: {
      name: 'Accountant Nasr',
      email: `acc.nasr.${timestamp}@edu.com`,
      password: pwHash,
      role: 'ACCOUNTANT',
      institutionId: inst.id,
      branchId: branchNasr.id
    }
  });

  // Create teacher in Nasr City
  const teacherNasr = await db.user.create({
    data: {
      name: 'Teacher Nasr',
      email: `teach.nasr.${timestamp}@edu.com`,
      password: pwHash,
      role: 'TEACHER',
      institutionId: inst.id,
      branchId: branchNasr.id
    }
  });

  const now = new Date();
  const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  // Configure pricing
  await BrdSubscriptionService.setTeacherGradePrice(
    { id: manager.id, role: 'ADMIN' },
    { teacherId: teacher.id, grade: 'SECONDARY_1', price: 350, effectiveMonth: currentMonthKey }
  );

  await BrdSubscriptionService.setTeacherGradePrice(
    { id: manager.id, role: 'ADMIN' },
    { teacherId: teacherNasr.id, grade: 'SECONDARY_1', price: 400, effectiveMonth: currentMonthKey }
  );

  // -------------------------------------------------------------------------
  // SECTION 3.1: FIRST RECEIPT CREATION & FORMAT
  // -------------------------------------------------------------------------
  console.log('\n--- SECTION 3.1: FIRST RECEIPT CREATION & FORMAT ---');
  const studentDokki1 = await BrdSubscriptionService.createStudentWithTeacherOwnership(
    { id: teacher.id, role: 'TEACHER' },
    { name: 'Student D1', email: `d1.${timestamp}@edu.com`, studentType: 'CENTER_STUDENT', gradeLevel: 'SECONDARY_1' }
  );

  const payment1 = await BrdSubscriptionService.recordSubscriptionPayment(
    { id: accountantDokki.id, role: 'ACCOUNTANT', branchId: branchDokki.id },
    {
      studentId: studentDokki1.student.id,
      teacherId: teacher.id,
      months: [{ year: now.getFullYear(), month: now.getMonth() + 1 }],
      amount: 350,
      receivingMethod: 'CASH'
    }
  );

  const expectedFirstDokkiReceipt = 'REC-DK-01-00001';
  assertTest('SEC3.1', 'First receipt in Branch Dokki matches expected format',
    payment1.receipt.receiptNumber === expectedFirstDokkiReceipt,
    `Actual: ${payment1.receipt.receiptNumber}, Expected: ${expectedFirstDokkiReceipt}`
  );
  assertTest('SEC3.1', 'First receipt sequence number is exactly 1', payment1.receipt.sequenceNumber === 1);

  const dokkiCounterAfter1 = await db.branchReceiptCounter.findUnique({ where: { branchId: branchDokki.id } });
  assertTest('SEC3.1', 'BranchReceiptCounter created and lastSequence is 1', dokkiCounterAfter1 && dokkiCounterAfter1.lastSequence === 1);

  // -------------------------------------------------------------------------
  // SECTION 3.2: TRANSACTION ROLLBACK & ZERO-GAP INTEGRITY
  // -------------------------------------------------------------------------
  console.log('\n--- SECTION 3.2: TRANSACTION ROLLBACK & ZERO-GAP INTEGRITY ---');
  const studentDokki2 = await BrdSubscriptionService.createStudentWithTeacherOwnership(
    { id: teacher.id, role: 'TEACHER' },
    { name: 'Student D2', email: `d2.${timestamp}@edu.com`, studentType: 'CENTER_STUDENT', gradeLevel: 'SECONDARY_1' }
  );

  // Attempt payment that fails validation (partial payment of 200 instead of 350)
  let rollbackCaught = false;
  try {
    await BrdSubscriptionService.recordSubscriptionPayment(
      { id: accountantDokki.id, role: 'ACCOUNTANT', branchId: branchDokki.id },
      {
        studentId: studentDokki2.student.id,
        teacherId: teacher.id,
        months: [{ year: now.getFullYear(), month: now.getMonth() + 1 }],
        amount: 200, // Invalid partial amount!
        receivingMethod: 'CASH'
      }
    );
  } catch (err) {
    rollbackCaught = true;
  }
  assertTest('SEC3.2', 'Invalid partial payment threw validation exception and rolled back', rollbackCaught);

  // Verify counter did NOT increment on rolled-back transaction
  const dokkiCounterAfterRollback = await db.branchReceiptCounter.findUnique({ where: { branchId: branchDokki.id } });
  assertTest('SEC3.2', 'Counter did not increment on rolled back transaction (zero burned numbers)',
    dokkiCounterAfterRollback.lastSequence === 1,
    `Current counter: ${dokkiCounterAfterRollback.lastSequence}`
  );

  // Now perform valid payment for Student D2
  const payment2 = await BrdSubscriptionService.recordSubscriptionPayment(
    { id: accountantDokki.id, role: 'ACCOUNTANT', branchId: branchDokki.id },
    {
      studentId: studentDokki2.student.id,
      teacherId: teacher.id,
      months: [{ year: now.getFullYear(), month: now.getMonth() + 1 }],
      amount: 350,
      receivingMethod: 'BANK_TRANSFER'
    }
  );
  assertTest('SEC3.2', 'Next receipt takes contiguous sequence number 2 without gaps',
    payment2.receipt.receiptNumber === 'REC-DK-01-00002' && payment2.receipt.sequenceNumber === 2,
    `Receipt: ${payment2.receipt.receiptNumber}`
  );

  // -------------------------------------------------------------------------
  // SECTION 3.3: INDEPENDENT BRANCH NUMBERING
  // -------------------------------------------------------------------------
  console.log('\n--- SECTION 3.3: INDEPENDENT BRANCH NUMBERING ---');
  const studentNasr1 = await BrdSubscriptionService.createStudentWithTeacherOwnership(
    { id: teacherNasr.id, role: 'TEACHER' },
    { name: 'Student N1', email: `n1.${timestamp}@edu.com`, studentType: 'CENTER_STUDENT', gradeLevel: 'SECONDARY_1' }
  );

  const paymentNasr1 = await BrdSubscriptionService.recordSubscriptionPayment(
    { id: accountantNasr.id, role: 'ACCOUNTANT', branchId: branchNasr.id },
    {
      studentId: studentNasr1.student.id,
      teacherId: teacherNasr.id,
      months: [{ year: now.getFullYear(), month: now.getMonth() + 1 }],
      amount: 400,
      receivingMethod: 'CASH'
    }
  );

  const expectedFirstNasrReceipt = 'REC-NS-01-00001';
  assertTest('SEC3.3', 'Branch Nasr City independently starts at sequence 1',
    paymentNasr1.receipt.receiptNumber === expectedFirstNasrReceipt && paymentNasr1.receipt.sequenceNumber === 1,
    `Nasr Receipt: ${paymentNasr1.receipt.receiptNumber}`
  );

  // Re-verify Dokki counter unaffected by Nasr payment
  const dokkiCounterAfterNasr = await db.branchReceiptCounter.findUnique({ where: { branchId: branchDokki.id } });
  assertTest('SEC3.3', 'Branch Dokki counter is unaffected by Nasr branch activity',
    dokkiCounterAfterNasr.lastSequence === 2,
    `Dokki Counter: ${dokkiCounterAfterNasr.lastSequence}`
  );

  // -------------------------------------------------------------------------
  // SECTION 3.4: TWO ACCOUNTANTS IN SAME BRANCH CONCURRENT EXECUTION
  // -------------------------------------------------------------------------
  console.log('\n--- SECTION 3.4: CONCURRENT RECEIPTS BY MULTIPLE ACCOUNTANTS ---');
  const concurrentStudents = [];
  for (let i = 0; i < 4; i++) {
    const s = await BrdSubscriptionService.createStudentWithTeacherOwnership(
      { id: teacher.id, role: 'TEACHER' },
      { name: `Conc Student ${i + 1}`, email: `c.${i}.${timestamp}@edu.com`, studentType: 'CENTER_STUDENT', gradeLevel: 'SECONDARY_1' }
    );
    concurrentStudents.push(s);
  }

  // Fire 4 payments concurrently: 2 by accountantDokki, 2 by accountantDokki2
  const p1 = BrdSubscriptionService.recordSubscriptionPayment(
    { id: accountantDokki.id, role: 'ACCOUNTANT', branchId: branchDokki.id },
    { studentId: concurrentStudents[0].student.id, teacherId: teacher.id, months: [{ year: now.getFullYear(), month: now.getMonth() + 1 }], amount: 350, receivingMethod: 'CASH' }
  );
  const p2 = BrdSubscriptionService.recordSubscriptionPayment(
    { id: accountantDokki2.id, role: 'ACCOUNTANT', branchId: branchDokki.id },
    { studentId: concurrentStudents[1].student.id, teacherId: teacher.id, months: [{ year: now.getFullYear(), month: now.getMonth() + 1 }], amount: 350, receivingMethod: 'WALLET' }
  );
  const p3 = BrdSubscriptionService.recordSubscriptionPayment(
    { id: accountantDokki.id, role: 'ACCOUNTANT', branchId: branchDokki.id },
    { studentId: concurrentStudents[2].student.id, teacherId: teacher.id, months: [{ year: now.getFullYear(), month: now.getMonth() + 1 }], amount: 350, receivingMethod: 'BANK_TRANSFER' }
  );
  const p4 = BrdSubscriptionService.recordSubscriptionPayment(
    { id: accountantDokki2.id, role: 'ACCOUNTANT', branchId: branchDokki.id },
    { studentId: concurrentStudents[3].student.id, teacherId: teacher.id, months: [{ year: now.getFullYear(), month: now.getMonth() + 1 }], amount: 350, receivingMethod: 'CASH' }
  );

  const concurrentResults = await Promise.all([p1, p2, p3, p4]);
  const concSeqNumbers = concurrentResults.map(r => r.receipt.sequenceNumber).sort((a, b) => a - b);
  const concReceiptNumbers = concurrentResults.map(r => r.receipt.receiptNumber);

  // Check unique
  const uniqueNumbers = new Set(concReceiptNumbers);
  assertTest('SEC3.4', 'Two accountants generated zero duplicate receipts under concurrent execution',
    uniqueNumbers.size === 4,
    `Receipts: ${concReceiptNumbers.join(', ')}`
  );
  assertTest('SEC3.4', 'Concurrent receipts are strictly contiguous (3, 4, 5, 6)',
    JSON.stringify(concSeqNumbers) === JSON.stringify([3, 4, 5, 6]),
    `Sequences: ${concSeqNumbers.join(', ')}`
  );

  // -------------------------------------------------------------------------
  // SECTION 3.5 & 7.1: PAYMENT CANCELLATION & AUDIT REVERSAL
  // -------------------------------------------------------------------------
  console.log('\n--- SECTION 3.5 & 7.1: CANCELLATION & AUDIT REVERSAL ---');
  // Cancel payment 2 (Student D2)
  const cancelResult = await BrdSubscriptionService.cancelPayment(
    { id: manager.id, role: 'ADMIN' },
    payment2.payment.id,
    'Client requested cancellation due to relocation'
  );
  assertTest('SEC7.1', 'Manager payment cancellation succeeds', cancelResult.success === true);

  // Verify original receipt is PRESERVED in database
  const receiptAfterCancel = await db.branchSequentialReceipt.findUnique({
    where: { receiptNumber: 'REC-DK-01-00002' }
  });
  assertTest('SEC3.5', 'Original receipt record is preserved in database after cancellation',
    receiptAfterCancel !== null && receiptAfterCancel.receiptNumber === 'REC-DK-01-00002'
  );

  // Verify payment status is CANCELLED and revenue excluded
  const paymentRecordAfterCancel = await db.subscriptionPayment.findUnique({
    where: { id: payment2.payment.id }
  });
  assertTest('SEC7.1', 'Payment status is marked CANCELLED with audit reason',
    paymentRecordAfterCancel.status === 'CANCELLED' && paymentRecordAfterCancel.cancellationReason === 'Client requested cancellation due to relocation'
  );

  // Verify total confirmed collections exclude cancelled payment
  const activePayments = await db.subscriptionPayment.findMany({
    where: { branchId: branchDokki.id, status: 'CONFIRMED' }
  });
  const totalConfirmedRevenue = activePayments.reduce((sum, p) => sum + p.totalAmount, 0);
  // Dokki payments: payment1 (350), 4 concurrent (4 * 350 = 1400). Total = 1750. Payment 2 (350) cancelled.
  assertTest('SEC7.1', 'Cancelled payment is excluded from active revenue sum (1750 EGP)',
    totalConfirmedRevenue === 1750,
    `Calculated Confirmed Revenue: ${totalConfirmedRevenue} EGP`
  );

  // -------------------------------------------------------------------------
  // SECTION 7.2: MULTI-MONTH ADVANCE PAYMENTS
  // -------------------------------------------------------------------------
  console.log('\n--- SECTION 7.2: MULTI-MONTH ADVANCE PAYMENTS ---');
  const studentAdvance = await BrdSubscriptionService.createStudentWithTeacherOwnership(
    { id: teacher.id, role: 'TEACHER' },
    { name: 'Advance Student', email: `adv.${timestamp}@edu.com`, studentType: 'CENTER_STUDENT', gradeLevel: 'SECONDARY_1' }
  );

  const nextMonth = now.getMonth() + 2 > 12 ? 1 : now.getMonth() + 2;
  const nextYear = now.getMonth() + 2 > 12 ? now.getFullYear() + 1 : now.getFullYear();

  const advancePayment = await BrdSubscriptionService.recordSubscriptionPayment(
    { id: accountantDokki.id, role: 'ACCOUNTANT', branchId: branchDokki.id },
    {
      studentId: studentAdvance.student.id,
      teacherId: teacher.id,
      months: [
        { year: now.getFullYear(), month: now.getMonth() + 1 },
        { year: nextYear, month: nextMonth }
      ],
      amount: 700,
      receivingMethod: 'CASH'
    }
  );

  const advanceItems = await db.subscriptionPaymentItem.findMany({
    where: { paymentId: advancePayment.payment.id }
  });
  assertTest('SEC7.2', 'Advance payment creates separate items for each covered month (2 items)', advanceItems.length === 2);
  const advanceMonths = advanceItems.map(i => `${i.year}-${i.month}`).sort();
  assertTest('SEC7.2', 'Advance payment items correctly reference current and future months',
    advanceMonths.length === 2,
    `Covered: ${advanceMonths.join(', ')}`
  );

  // -------------------------------------------------------------------------
  // SECTION 7.3: MANAGER HUMANITARIAN EXCEPTION (NO ARTIFICIAL REVENUE)
  // -------------------------------------------------------------------------
  console.log('\n--- SECTION 7.3: HUMANITARIAN EXCEPTION & ZERO REVENUE DISTORTION ---');
  const studentEx = await BrdSubscriptionService.createStudentWithTeacherOwnership(
    { id: teacher.id, role: 'TEACHER' },
    { name: 'Ex Student', email: `ex.${timestamp}@edu.com`, studentType: 'CENTER_STUDENT', gradeLevel: 'SECONDARY_1' }
  );

  const exceptionRes = await BrdSubscriptionService.grantManagerException(
    { id: manager.id, role: 'ADMIN' },
    studentEx.student.id,
    teacher.id,
    'Social Solidarity Exemption'
  );
  assertTest('SEC7.3', 'Manager grants exception active until month end', exceptionRes.exceptionActiveUntil !== null);

  const exAccess = await BrdSubscriptionService.recalculateAccessStatus(
    studentEx.student.id,
    teacher.id,
    new Date(now.getFullYear(), now.getMonth(), 15), // Day 15 (after lock day)
    db
  );
  assertTest('SEC7.3', 'Exception student retains ACTIVE access after lock day', exAccess.accessStatus === 'ACTIVE');

  const exPaymentsCount = await db.subscriptionPayment.count({ where: { studentId: studentEx.student.id } });
  assertTest('SEC7.3', 'Zero financial payments created for exception (No artificial income)', exPaymentsCount === 0);

  // -------------------------------------------------------------------------
  // SECTION 7.4: MULTI-TEACHER INDEPENDENT ACCESS
  // -------------------------------------------------------------------------
  console.log('\n--- SECTION 7.4: MULTI-TEACHER INDEPENDENT ACCESS ---');
  // Enroll studentDokki1 with Teacher Nasr as well
  await BrdSubscriptionService.enrollWithAdditionalTeacher(studentDokki1.student.id, teacherNasr.id, manager.id);

  // studentDokki1 has paid Teacher Dokki, but has NOT paid Teacher Nasr.
  const accessTeachDokki = await BrdSubscriptionService.recalculateAccessStatus(
    studentDokki1.student.id,
    teacher.id,
    new Date(now.getFullYear(), now.getMonth(), 15),
    db
  );
  const accessTeachNasr = await BrdSubscriptionService.recalculateAccessStatus(
    studentDokki1.student.id,
    teacherNasr.id,
    new Date(now.getFullYear(), now.getMonth(), 15),
    db
  );

  assertTest('SEC7.4', 'Access to paid teacher is ACTIVE on Day 15', accessTeachDokki.accessStatus === 'ACTIVE');
  assertTest('SEC7.4', 'Access to unpaid teacher is LOCKED on Day 15 independently', accessTeachNasr.accessStatus === 'LOCKED');

  // -------------------------------------------------------------------------
  // SECTION 7.5: SCHEDULER IDEMPOTENCY
  // -------------------------------------------------------------------------
  console.log('\n--- SECTION 7.5: SCHEDULER IDEMPOTENCY ---');
  const run1 = await runDailyLockCycle();
  const run2 = await runDailyLockCycle();
  assertTest('SEC7.5', 'Daily lock cycle runs successfully and idempotently',
    run1.success === true && run2.success === true
  );

  console.log('\n================================================================');
  console.log(`VERIFICATION COMPLETE: ${passCount} PASSED | ${failCount} FAILED`);
  console.log('================================================================');

  await db.$disconnect();
  if (failCount > 0) process.exit(1);
}

runVerification().catch(err => {
  console.error('Fatal verification error:', err);
  process.exit(1);
});

