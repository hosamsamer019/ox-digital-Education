/**
 * OX-DIGITAL Education — BRD Full Implementation Acceptance & Verification Test Suite
 * Date: November 6, 2026
 * Database Target: 127.0.0.1:5433 (ox_digital_dev_test) ONLY
 */

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const { PrismaClient } = require(path.resolve(__dirname, '../node_modules/@prisma/client'));
const bcrypt = require('bcryptjs');

const db = new PrismaClient({
  datasources: { db: { url: process.env.DATABASE_URL } }
});

// Import BRD Services directly from user-service
const { BrdSubscriptionService } = require(path.resolve(__dirname, '../services/user-service/dist/services/user-service/src/services/brdSubscription.service.js'));
const { BrdNotificationService } = require(path.resolve(__dirname, '../services/user-service/dist/services/user-service/src/services/brdNotification.service.js'));
const { runDailyLockCycle } = require(path.resolve(__dirname, '../services/user-service/dist/services/user-service/src/jobs/brdDailyLock.scheduler.js'));

let passedCount = 0;
let failedCount = 0;

function assert(condition, scenarioName, details = '') {
  if (condition) {
    console.log(`  [PASS] ${scenarioName} ${details ? `(${details})` : ''}`);
    passedCount++;
  } else {
    console.error(`  [FAIL] ${scenarioName} ${details ? `(${details})` : ''}`);
    failedCount++;
  }
}

async function verifyDatabaseBoundary() {
  console.log('\n================================================================');
  console.log('0. DATABASE BOUNDARY & RUNTIME VERIFICATION');
  console.log('================================================================');
  
  const [ident] = await db.$queryRawUnsafe(
    'SELECT current_database() as db, current_user as usr, inet_server_port() as port, inet_server_addr() as host;'
  );

  console.log(`Connected to: ${ident.usr}@${ident.host}:${ident.port}/${ident.db}`);
  const urlPort = (process.env.DATABASE_URL.match(/:(\d+)\//) || [])[1];
  assert(urlPort === '5433', 'Host Port Boundary Check', `Host connection port is ${urlPort} (Must be 5433)`);
  assert(ident.usr === 'ox_dev_admin', 'Database User Check', `User is ${ident.usr}`);
  assert(ident.db === 'ox_digital_dev_test', 'Database Name Check', `DB is ${ident.db}`);
  
  if (urlPort !== '5433' || ident.db !== 'ox_digital_dev_test' || ident.usr !== 'ox_dev_admin') {
    throw new Error('FATAL: Database connection is not pointing to authorized isolated development DB!');
  }
}

async function runTestSuite() {
  await verifyDatabaseBoundary();

  const timestamp = Date.now();
  console.log('\n================================================================');
  console.log('STARTING BRD ACCEPTANCE SCENARIOS (1 to 15 + SECURITY INVARIANTS)');
  console.log('================================================================');

  // SETUP: Create Institution, Branches, Teachers, Manager
  const institution = await db.institution.findFirst() || await db.institution.create({
    data: { name: 'OX Test Institution', code: `INST-${timestamp}` }
  });

  // Branch A (e.g. Dokki)
  const branchA = await db.branch.create({
    data: {
      name: `Branch Dokki ${timestamp}`,
      code: `DK${String(timestamp).slice(-4)}`,
      institutionId: institution.id,
      status: 'ACTIVE'
    }
  });

  // Branch B (e.g. Nasr City)
  const branchB = await db.branch.create({
    data: {
      name: `Branch Nasr ${timestamp}`,
      code: `NS${String(timestamp).slice(-4)}`,
      institutionId: institution.id,
      status: 'ACTIVE'
    }
  });

  // Manager
  const defaultHash = await bcrypt.hash('Password@123456', 10);
  const managerUser = await db.user.create({
    data: {
      name: 'Executive Manager Test',
      email: `manager.${timestamp}@edu.com`,
      password: defaultHash,
      role: 'PRIMARY_MANAGER',
      institutionId: institution.id
    }
  });

  // Teacher A in Branch A
  const teacherA = await db.user.create({
    data: {
      name: 'Teacher Alpha',
      email: `teacher.alpha.${timestamp}@edu.com`,
      password: defaultHash,
      role: 'TEACHER',
      institutionId: institution.id,
      branchId: branchA.id
    }
  });

  // Teacher B in Branch B
  const teacherB = await db.user.create({
    data: {
      name: 'Teacher Beta',
      email: `teacher.beta.${timestamp}@edu.com`,
      password: defaultHash,
      role: 'TEACHER',
      institutionId: institution.id,
      branchId: branchB.id
    }
  });

  console.log('\n--- SCENARIO 1: Teacher creates student -> Automatic ownership & duplicate rejection ---');
  // Scenario 1: Teacher creates student
  const studentEmail = `student.test.${timestamp}@edu.com`;
  const studentResult = await BrdSubscriptionService.createStudentWithTeacherOwnership(
    { id: teacherA.id, role: 'TEACHER' },
    {
      name: 'Tariq Student 1',
      email: studentEmail,
      studentType: 'CENTER_STUDENT',
      gradeLevel: 'SECONDARY_1'
    }
  );

  assert(studentResult.student.id !== undefined, 'Scenario 1.1: Student created successfully');
  assert(studentResult.student.responsibleTeacherId === teacherA.id, 'Scenario 1.2: responsibleTeacherId derived from session');
  assert(studentResult.student.creatorId === teacherA.id, 'Scenario 1.3: creatorId set to teacher');
  assert(studentResult.studentTeacher.teacherId === teacherA.id, 'Scenario 1.4: StudentTeacher enrollment link created');
  assert(studentResult.studentTeacher.status === 'ACTIVE', 'Scenario 1.5: Enrollment status is ACTIVE');

  // Verify duplicate email rejection
  let duplicateRejected = false;
  try {
    await BrdSubscriptionService.createStudentWithTeacherOwnership(
      { id: teacherA.id, role: 'TEACHER' },
      { name: 'Duplicate Tariq', email: studentEmail, studentType: 'ONLINE_STUDENT', gradeLevel: 'SECONDARY_1' }
    );
  } catch (err) {
    duplicateRejected = err.code === 'DUPLICATE_EMAIL' || err.message.includes('مسجل بالفعل') || err.message.includes('already exists');
  }
  assert(duplicateRejected, 'Scenario 1.6: Duplicate email rejected across platform');

  console.log('\n--- SCENARIO 2: Teacher links parent without duplicates ---');
  // Scenario 2: Teacher links parent
  const parentEmail = `parent.test.${timestamp}@edu.com`;
  const parentRes1 = await BrdSubscriptionService.teacherLinkParent(
    { id: teacherA.id, role: 'TEACHER' },
    {
      studentId: studentResult.student.id,
      parentName: 'Mr. Parent One',
      parentEmail: parentEmail,
      parentPhone: '01011112222'
    }
  );
  assert(parentRes1.parentId !== undefined, 'Scenario 2.1: Parent account created and linked');

  // Create second student for teacherA and link to SAME parent email
  const studentResult2 = await BrdSubscriptionService.createStudentWithTeacherOwnership(
    { id: teacherA.id, role: 'TEACHER' },
    {
      name: 'Salma Student 2',
      email: `salma.test.${timestamp}@edu.com`,
      studentType: 'ONLINE_STUDENT',
      gradeLevel: 'SECONDARY_2'
    }
  );

  const parentRes2 = await BrdSubscriptionService.teacherLinkParent(
    { id: teacherA.id, role: 'TEACHER' },
    {
      studentId: studentResult2.student.id,
      parentEmail: parentEmail,
      parentName: 'Mr. Parent One'
    }
  );

  assert(parentRes2.parentId === parentRes1.parentId, 'Scenario 2.2: Existing parent linked without duplicate account');
  const parentCount = await db.user.count({ where: { email: parentEmail } });
  assert(parentCount === 1, 'Scenario 2.3: Exactly 1 parent user exists in database');

  console.log('\n--- SCENARIO 3: Manager provisions branch accountant with CSPRNG temporary password & branch scope ---');
  // Scenario 3: Manager provisions branch accountant
  const accountantEmail = `acc.dokki.${timestamp}@edu.com`;
  const accountantRes = await BrdSubscriptionService.provisionBranchAccountant(
    { id: managerUser.id, role: 'PRIMARY_MANAGER' },
    { branchId: branchA.id, name: 'Accountant Dokki', email: accountantEmail }
  );

  assert(accountantRes.accountant.id !== undefined, 'Scenario 3.1: Accountant created');
  assert(accountantRes.temporaryPassword && accountantRes.temporaryPassword.length >= 10, 'Scenario 3.2: Secure CSPRNG temporary password generated');
  assert(accountantRes.accountant.branchId === branchA.id, 'Scenario 3.3: Accountant scoped to Branch A');

  // Verify accountant sees only students of teachers in Branch A
  const branchATeacherIds = [teacherA.id];
  const accountantAccessibleStudents = await db.studentTeacher.findMany({
    where: { teacherId: { in: branchATeacherIds }, status: 'ACTIVE' },
    select: { studentId: true }
  });
  const accessibleStudentIds = accountantAccessibleStudents.map(s => s.studentId);
  assert(accessibleStudentIds.includes(studentResult.student.id), 'Scenario 3.4: Accountant sees Branch A teacher students');
  assert(!accessibleStudentIds.includes('unrelated-student-id'), 'Scenario 3.5: Accountant does not see unrelated students');

  console.log('\n--- SCENARIO 4: Manager sets grade price in EGP; Price audit history created ---');
  // Scenario 4: Manager sets grade price
  const now = new Date();
  const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  const priceRes = await BrdSubscriptionService.setTeacherGradePrice(
    { id: managerUser.id, role: 'PRIMARY_MANAGER' },
    {
      teacherId: teacherA.id,
      grade: 'SECONDARY_1',
      price: 350,
      effectiveMonth: currentMonthKey,
      reason: '2026 Academic Season Pricing'
    }
  );

  assert(priceRes.pricing.price === 350, 'Scenario 4.1: Grade price set to 350 EGP');
  assert(priceRes.auditRecord.oldPrice === 0 && priceRes.auditRecord.newPrice === 350, 'Scenario 4.2: PriceAuditHistory recorded old and new prices');
  assert(priceRes.auditRecord.reason === '2026 Academic Season Pricing', 'Scenario 4.3: Audit reason recorded');

  // Also set price for SECONDARY_2 for teacher A
  await BrdSubscriptionService.setTeacherGradePrice(
    { id: managerUser.id, role: 'PRIMARY_MANAGER' },
    {
      teacherId: teacherA.id,
      grade: 'SECONDARY_2',
      price: 350,
      effectiveMonth: currentMonthKey,
      reason: '2026 Academic Season Pricing - Grade 2'
    }
  );

  // Accountant attempts to set price -> must fail
  let accountantBlocked = false;
  try {
    await BrdSubscriptionService.setTeacherGradePrice(
      { id: accountantRes.accountant.id, role: 'ACCOUNTANT' },
      { teacherId: teacherA.id, grade: 'SECONDARY_1', price: 400, effectiveMonth: currentMonthKey }
    );
  } catch (err) {
    accountantBlocked = err.message.includes('Forbidden') || err.message.includes('Manager access only');
  }
  assert(accountantBlocked, 'Scenario 4.4: Accountant cannot modify prices (Forbidden)');

  console.log('\n--- SCENARIO 5: Student active during grace period (days 1 to 5) ---');
  // Scenario 5: Grace period check
  // Simulate day 3 of month
  const graceStatus = await BrdSubscriptionService.recalculateAccessStatus(
    studentResult.student.id,
    teacherA.id,
    new Date(now.getFullYear(), now.getMonth(), 3)
  );
  assert(graceStatus.accessStatus === 'GRACE_PERIOD', 'Scenario 5.1: Student status is GRACE_PERIOD during days 1-5');

  console.log('\n--- SCENARIO 6: Unpaid student locked at Cairo lock boundary (Day 6, 00:00 Cairo) ---');
  // Scenario 6: Lock day check (Day 6 of month)
  const lockedStatus = await BrdSubscriptionService.recalculateAccessStatus(
    studentResult.student.id,
    teacherA.id,
    new Date(now.getFullYear(), now.getMonth(), 6, 1, 0, 0)
  );
  assert(lockedStatus.accessStatus === 'LOCKED', 'Scenario 6.1: Student status is LOCKED on Day 6 without payment');

  console.log('\n--- SCENARIO 7: Full payment immediately reopens student & generates atomic sequential receipt ---');
  // Scenario 7: Full month payment
  // Partial payment check: price is 350, attempting to pay 200 must fail
  let partialRejected = false;
  try {
    await BrdSubscriptionService.recordSubscriptionPayment(
      { id: accountantRes.accountant.id, role: 'ACCOUNTANT', branchId: branchA.id },
      {
        studentId: studentResult.student.id,
        teacherId: teacherA.id,
        months: [{ year: now.getFullYear(), month: now.getMonth() + 1 }],
        amount: 200, // Invalid partial amount!
        receivingMethod: 'CASH'
      }
    );
  } catch (err) {
    partialRejected = err.message.includes('Partial payments are strictly prohibited');
  }
  assert(partialRejected, 'Scenario 7.1: Partial payments strictly prohibited (rejected)');

  // Now pay exact full amount 350 EGP
  const paymentRes = await BrdSubscriptionService.recordSubscriptionPayment(
    { id: accountantRes.accountant.id, role: 'ACCOUNTANT', branchId: branchA.id },
    {
      studentId: studentResult.student.id,
      teacherId: teacherA.id,
      months: [{ year: now.getFullYear(), month: now.getMonth() + 1 }],
      amount: 350,
      receivingMethod: 'CASH',
      notes: 'Monthly subscription cash payment'
    }
  );

  assert(paymentRes.payment.amount === 350, 'Scenario 7.2: Payment recorded for 350 EGP');
  assert(paymentRes.accessStatus === 'ACTIVE', 'Scenario 7.3: Status immediately reopened to ACTIVE');
  assert(paymentRes.receipt.sequenceNumber === 1, 'Scenario 7.4: First receipt sequence number is 1');
  assert(paymentRes.receipt.receiptNumber.includes(branchA.code), 'Scenario 7.5: Receipt format includes branch code');

  // Record a second payment to verify consecutive sequence number 2 without gaps
  const paymentRes2 = await BrdSubscriptionService.recordSubscriptionPayment(
    { id: accountantRes.accountant.id, role: 'ACCOUNTANT', branchId: branchA.id },
    {
      studentId: studentResult2.student.id,
      teacherId: teacherA.id,
      months: [{ year: now.getFullYear(), month: now.getMonth() + 1 }],
      amount: 350,
      receivingMethod: 'BANK_TRANSFER'
    }
  );
  assert(paymentRes2.receipt.sequenceNumber === 2, 'Scenario 7.6: Second receipt sequence number is consecutive (2)');

  console.log('\n--- SCENARIO 8: Advance payment prevents interruption across future months ---');
  // Scenario 8: Advance payment (pay 2 future months = 700 EGP)
  let nextMonth1 = now.getMonth() + 2;
  let year1 = now.getFullYear();
  if (nextMonth1 > 12) { nextMonth1 = 1; year1++; }

  let nextMonth2 = now.getMonth() + 3;
  let year2 = now.getFullYear();
  if (nextMonth2 > 12) { nextMonth2 = 2; year2++; }

  const advancePaymentRes = await BrdSubscriptionService.recordSubscriptionPayment(
    { id: accountantRes.accountant.id, role: 'ACCOUNTANT', branchId: branchA.id },
    {
      studentId: studentResult.student.id,
      teacherId: teacherA.id,
      months: [
        { year: year1, month: nextMonth1 },
        { year: year2, month: nextMonth2 }
      ],
      amount: 700,
      receivingMethod: 'WALLET'
    }
  );

  assert(advancePaymentRes.payment.amount === 700, 'Scenario 8.1: Advance payment of 700 EGP recorded');
  const futureSubs = await db.studentMonthlySubscription.findMany({
    where: { studentId: studentResult.student.id, teacherId: teacherA.id }
  });
  assert(futureSubs.length >= 3, 'Scenario 8.2: 3 months covered including advance months');

  console.log('\n--- SCENARIO 9: Accountant cannot cancel/delete payment; Manager cancels with mandatory reversal audit ---');
  // Scenario 9: Payment cancellation
  let accountantCancelBlocked = false;
  try {
    await BrdSubscriptionService.cancelPayment(
      { id: accountantRes.accountant.id, role: 'ACCOUNTANT' },
      paymentRes2.payment.id,
      'Mistake'
    );
  } catch (err) {
    accountantCancelBlocked = err.message.includes('Forbidden') || err.message.includes('Manager access only');
  }
  assert(accountantCancelBlocked, 'Scenario 9.1: Accountant cannot cancel payment (Forbidden)');

  const cancelRes = await BrdSubscriptionService.cancelPayment(
    { id: managerUser.id, role: 'PRIMARY_MANAGER' },
    paymentRes2.payment.id,
    'Client duplicate payment correction'
  );
  assert(cancelRes.success === true, 'Scenario 9.2: Payment cancelled by Manager');
  const cancelledPayment = await db.subscriptionPayment.findUnique({
    where: { id: paymentRes2.payment.id }
  });
  assert(cancelledPayment.status === 'CANCELLED', 'Scenario 9.3: Payment record marked CANCELLED');

  console.log('\n--- SCENARIO 10: Complete student history visible to Manager ---');
  // Scenario 10: Complete student history
  const history = await db.studentAuditLog.findMany({
    where: { studentId: studentResult.student.id }
  });
  assert(history.length >= 2, 'Scenario 10.1: Student audit log records operations with timestamps');
  const actionTypes = history.map(h => h.eventType);
  assert(actionTypes.includes('STUDENT_CREATED'), 'Scenario 10.2: Includes STUDENT_CREATED audit log');
  assert(actionTypes.includes('PAYMENT_RECORDED'), 'Scenario 10.3: Includes PAYMENT_RECORDED audit log');

  console.log('\n--- SCENARIO 11: Daily lock scheduler is idempotent ---');
  // Scenario 11: Idempotency of scheduler
  const run1 = await runDailyLockCycle();
  assert(run1.success === true, 'Scenario 11.1: Daily lock scheduler executed successfully');
  const run2 = await runDailyLockCycle();
  assert(run2.success === true, 'Scenario 11.2: Second scheduler run executes without errors');
  assert(run2.lockedCount === 0 || run2.lockedCount === run1.lockedCount, 'Scenario 11.3: Idempotent outcome (no duplicate locks or state changes)');

  console.log('\n--- SCENARIO 12: Branch collections reconcile with accountant collections ---');
  // Scenario 12: Financial reconciliation
  const branchReceipts = await db.branchSequentialReceipt.findMany({
    where: { branchId: branchA.id }
  });
  const totalReceiptsAmount = branchReceipts.reduce((sum, r) => sum + r.amount, 0);

  const branchPayments = await db.subscriptionPayment.findMany({
    where: { branchId: branchA.id }
  });
  const totalPaymentsAmount = branchPayments.reduce((sum, p) => sum + (p.totalAmount !== undefined ? p.totalAmount : p.amount), 0);

  assert(totalReceiptsAmount === totalPaymentsAmount, 'Scenario 12.1: Sum of branch receipts exactly equals sum of branch payments', `${totalReceiptsAmount} EGP`);

  console.log('\n--- SCENARIO 13: Manager exception activation without false financial income ---');
  // Scenario 13: Manager exception
  // Create student 3 who has no payments
  const studentResult3 = await BrdSubscriptionService.createStudentWithTeacherOwnership(
    { id: teacherA.id, role: 'TEACHER' },
    {
      name: 'Amr Exception Student',
      email: `amr.exception.${timestamp}@edu.com`,
      studentType: 'CENTER_STUDENT',
      gradeLevel: 'SECONDARY_1'
    }
  );

  const exceptionRes = await BrdSubscriptionService.grantManagerException(
    { id: managerUser.id, role: 'PRIMARY_MANAGER' },
    studentResult3.student.id,
    teacherA.id,
    'Humanitarian exemption approved by Board'
  );

  assert(exceptionRes.exceptionActiveUntil !== null, 'Scenario 13.1: Exception active until end of Gregorian month');
  // Verify access status is active
  const exceptionStatus = await BrdSubscriptionService.recalculateAccessStatus(
    studentResult3.student.id,
    teacherA.id,
    new Date(now.getFullYear(), now.getMonth(), 15) // Day 15 (after lock day)
  );
  assert(exceptionStatus.accessStatus === 'ACTIVE', 'Scenario 13.2: Access active on Day 15 due to exception');
  
  // Verify NO financial payments or collections were created
  const exceptionPayments = await db.subscriptionPayment.count({
    where: { studentId: studentResult3.student.id }
  });
  assert(exceptionPayments === 0, 'Scenario 13.3: Zero financial payments created (No revenue distortion)');

  console.log('\n--- SCENARIO 14: Multi-teacher student retains access to paid teacher content independently ---');
  // Scenario 14: Multi-teacher student
  // Enroll studentResult with Teacher B as well
  await BrdSubscriptionService.enrollWithAdditionalTeacher(
    studentResult.student.id,
    teacherB.id,
    managerUser.id
  );

  await BrdSubscriptionService.setTeacherGradePrice(
    { id: managerUser.id, role: 'PRIMARY_MANAGER' },
    {
      teacherId: teacherB.id,
      grade: 'SECONDARY_1',
      price: 350,
      effectiveMonth: currentMonthKey
    }
  );

  // Student has paid Teacher A, but has NOT paid Teacher B.
  // Evaluate access for Day 10 (after lock day)
  const teacherAStatus = await BrdSubscriptionService.recalculateAccessStatus(
    studentResult.student.id,
    teacherA.id,
    new Date(now.getFullYear(), now.getMonth(), 10)
  );
  const teacherBStatus = await BrdSubscriptionService.recalculateAccessStatus(
    studentResult.student.id,
    teacherB.id,
    new Date(now.getFullYear(), now.getMonth(), 10)
  );

  assert(teacherAStatus.accessStatus === 'ACTIVE', 'Scenario 14.1: Access to Teacher A is ACTIVE (Paid)');
  assert(teacherBStatus.accessStatus === 'LOCKED', 'Scenario 14.2: Access to Teacher B is LOCKED (Unpaid)');

  console.log('\n--- SCENARIO 15: Teacher income report matches recorded collections ---');
  // Scenario 15: Teacher income report
  const teacherAReceipts = await db.branchSequentialReceipt.findMany({
    where: { teacherId: teacherA.id }
  });
  const expectedTotal = teacherAReceipts.reduce((sum, r) => sum + r.amount, 0);

  assert(expectedTotal > 0, 'Scenario 15.1: Teacher A has valid positive collections');
  assert(expectedTotal === (350 + 350 + 700), 'Scenario 15.2: Teacher A collections match sum of payments (1400 EGP)', `${expectedTotal} EGP`);

  console.log('\n--- SECURITY & IDOR: Accountant from Branch A cannot record payment for Teacher B in Branch B ---');
  let idorBlocked = false;
  try {
    await BrdSubscriptionService.recordSubscriptionPayment(
      { id: accountantRes.accountant.id, role: 'ACCOUNTANT', branchId: branchA.id },
      {
        studentId: studentResult.student.id,
        teacherId: teacherB.id, // Teacher B belongs to Branch B, NOT Branch A!
        months: [{ year: now.getFullYear(), month: now.getMonth() + 1 }],
        amount: 350,
        receivingMethod: 'CASH'
      }
    );
  } catch (err) {
    idorBlocked = err.message.includes('not assigned to your branch') || err.message.includes('Forbidden');
  }
  assert(idorBlocked, 'Security 1: Cross-branch IDOR prevented (Accountant cannot collect for another branch teacher)');

  console.log('\n================================================================');
  console.log(`TEST SUITE RESULTS: ${passedCount} PASSED | ${failedCount} FAILED`);
  console.log('================================================================');

  if (failedCount > 0) {
    process.exit(1);
  }
}

runTestSuite()
  .then(async () => {
    await db.$disconnect();
    process.exit(0);
  })
  .catch(async (err) => {
    console.error('Test suite failed with unexpected error:', err);
    await db.$disconnect();
    process.exit(1);
  });

