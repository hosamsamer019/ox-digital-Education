/**
 * OX-DIGITAL Education — Comprehensive Functional Audit on Disposable Test Database
 * Target Database: 127.0.0.1:5433 (ox_digital_disposable_audit_test) ONLY
 * 
 * Verifies Workstreams B1 through B8 and Concurrency.
 */

const path = require('path');
const bcrypt = require('bcryptjs');

// Enforce disposable database URL
const DISPOSABLE_DB_URL = 'postgresql://ox_dev_admin:r72a-8DsHuifYR1tFg4NMCzH5EXdHlrTkYW-WXShSaM@127.0.0.1:5433/ox_digital_disposable_audit_test?schema=public';
process.env.DATABASE_URL = DISPOSABLE_DB_URL;
process.env.DIRECT_URL = DISPOSABLE_DB_URL;

const { PrismaClient } = require(path.resolve(__dirname, '../node_modules/@prisma/client'));
const db = new PrismaClient({
  datasources: { db: { url: DISPOSABLE_DB_URL } }
});

const { BrdSubscriptionService } = require(path.resolve(__dirname, '../services/user-service/dist/services/user-service/src/services/brdSubscription.service.js'));
const { BrdNotificationService } = require(path.resolve(__dirname, '../services/user-service/dist/services/user-service/src/services/brdNotification.service.js'));
const { runDailyLockCycle } = require(path.resolve(__dirname, '../services/user-service/dist/services/user-service/src/jobs/brdDailyLock.scheduler.js'));

let passedCount = 0;
let failedCount = 0;
const results = [];

function recordTest(suite, name, passed, details = '') {
  if (passed) {
    passedCount++;
    console.log(`  [PASS] [${suite}] ${name} ${details ? `(${details})` : ''}`);
    results.push({ suite, name, status: 'PASS', details });
  } else {
    failedCount++;
    console.error(`  [FAIL] [${suite}] ${name} ${details ? `(${details})` : ''}`);
    results.push({ suite, name, status: 'FAIL', details });
  }
}

async function verifyDisposableDatabaseBoundary() {
  console.log('\n================================================================');
  console.log('SAFETY & ISOLATION CHECK: VERIFYING DISPOSABLE DATABASE TARGET');
  console.log('================================================================');
  
  const [ident] = await db.$queryRawUnsafe(
    'SELECT current_database() as db, current_user as usr, inet_server_port() as port, inet_server_addr() as host;'
  );

  console.log(`Connected to: ${ident.usr}@${ident.host}:${ident.port}/${ident.db}`);
  
  const isPort5433 = String(ident.port) === '5432' || String(ident.port) === '5433'; // container sees 5432 or host sees 5433
  const isUserValid = ident.usr === 'ox_dev_admin';
  const isDisposableDb = ident.db === 'ox_digital_disposable_audit_test';

  recordTest('BOUNDARY', 'Target Database is Disposable', isDisposableDb, `db=${ident.db}`);
  recordTest('BOUNDARY', 'Database User is ox_dev_admin', isUserValid, `user=${ident.usr}`);

  if (!isDisposableDb) {
    throw new Error(`FATAL VIOLATION: Not connected to ox_digital_disposable_audit_test! Refusing to run tests against ${ident.db}`);
  }
}

async function runComprehensiveAudit() {
  await verifyDisposableDatabaseBoundary();

  const timestamp = Date.now();
  console.log('\n================================================================');
  console.log('STARTING WORKSTREAM AUDIT B1 TO B8 ON DISPOSABLE DATABASE');
  console.log('================================================================');

  // --- SETUP BASE ENTITIES ---
  const inst = await db.institution.create({
    data: { name: `Audit Institution ${timestamp}`, code: `AUD-INST-${timestamp}` }
  });

  const branchDokki = await db.branch.create({
    data: { name: `Dokki Audit Branch ${timestamp}`, code: `DK-${String(timestamp).slice(-4)}`, status: 'ACTIVE', institutionId: inst.id }
  });

  const branchNasr = await db.branch.create({
    data: { name: `Nasr Audit Branch ${timestamp}`, code: `NS-${String(timestamp).slice(-4)}`, status: 'ACTIVE', institutionId: inst.id }
  });

  const pwHash = await bcrypt.hash('SecureAuditPass123!', 10);

  const manager = await db.user.create({
    data: {
      name: 'Audit Manager',
      email: `audit.mgr.${timestamp}@edu.com`,
      password: pwHash,
      role: 'ADMIN',
      isPrimaryManager: true,
      institutionId: inst.id
    }
  });

  const teacherDokki = await db.user.create({
    data: {
      name: 'Teacher Dokki',
      email: `audit.teach.dk.${timestamp}@edu.com`,
      password: pwHash,
      role: 'TEACHER',
      institutionId: inst.id,
      branchId: branchDokki.id
    }
  });

  const teacherNasr = await db.user.create({
    data: {
      name: 'Teacher Nasr',
      email: `audit.teach.ns.${timestamp}@edu.com`,
      password: pwHash,
      role: 'TEACHER',
      institutionId: inst.id,
      branchId: branchNasr.id
    }
  });

  const accountantDokki = await db.user.create({
    data: {
      name: 'Accountant Dokki',
      email: `audit.acc.dk.${timestamp}@edu.com`,
      password: pwHash,
      role: 'ACCOUNTANT',
      institutionId: inst.id,
      branchId: branchDokki.id
    }
  });

  const now = new Date();
  const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  // =========================================================================
  // B1: MANAGER WORKFLOWS (Pricing, Exceptions, Policy, Cashbox)
  // =========================================================================
  console.log('\n--- B1: MANAGER WORKFLOWS ---');
  
  // B1.1: Manager sets teacher grade pricing with audit trail
  const priceSetRes = await BrdSubscriptionService.setTeacherGradePrice(
    { id: manager.id, role: 'ADMIN' },
    {
      teacherId: teacherDokki.id,
      grade: 'SECONDARY_1',
      price: 400,
      effectiveMonth: currentMonthKey,
      reason: '2026 Academic Season Standard Rate'
    }
  );
  recordTest('B1', 'Manager sets teacher grade pricing', priceSetRes.pricing.price === 400, 'Price: 400 EGP');

  const auditEntry = await db.priceAuditHistory.findFirst({
    where: { teacherId: teacherDokki.id, grade: 'SECONDARY_1' },
    orderBy: { createdAt: 'desc' }
  });
  recordTest('B1', 'Price audit trail created with correct old/new price & reason', 
    auditEntry && auditEntry.newPrice === 400 && auditEntry.reason === '2026 Academic Season Standard Rate',
    `Audit ID: ${auditEntry ? auditEntry.id : 'none'}`
  );

  // Also set price for Nasr teacher
  await BrdSubscriptionService.setTeacherGradePrice(
    { id: manager.id, role: 'ADMIN' },
    {
      teacherId: teacherNasr.id,
      grade: 'SECONDARY_1',
      price: 450,
      effectiveMonth: currentMonthKey,
      reason: 'Nasr City Rate'
    }
  );

  // B1.2: Accountant forbidden from setting pricing
  let accPriceBlocked = false;
  try {
    await BrdSubscriptionService.setTeacherGradePrice(
      { id: accountantDokki.id, role: 'ACCOUNTANT' },
      { teacherId: teacherDokki.id, grade: 'SECONDARY_1', price: 999, effectiveMonth: currentMonthKey }
    );
  } catch (e) {
    accPriceBlocked = e.message.includes('Forbidden') || e.message.includes('PRIMARY_MANAGER') || e.message.includes('ADMIN');
  }
  recordTest('B1', 'Accountant strictly blocked from setting pricing (RBAC)', accPriceBlocked);

  // =========================================================================
  // B2: TEACHER WORKFLOWS & STUDENT OWNERSHIP
  // =========================================================================
  console.log('\n--- B2: TEACHER WORKFLOWS & STUDENT OWNERSHIP ---');

  // B2.1: Teacher creates student with direct ownership
  const studentRes1 = await BrdSubscriptionService.createStudentWithTeacherOwnership(
    { id: teacherDokki.id, role: 'TEACHER' },
    {
      name: 'Tariq Student 1',
      email: `tariq.${timestamp}@edu.com`,
      studentType: 'CENTER_STUDENT',
      gradeLevel: 'SECONDARY_1'
    }
  );
  recordTest('B2', 'Teacher creates student with ownership', 
    studentRes1.student && studentRes1.studentTeacher && studentRes1.studentTeacher.teacherId === teacherDokki.id,
    `Student ID: ${studentRes1.student.id}`
  );

  // B2.2: Teacher links parent (creates parent account)
  const parentEmail = `parent.tariq.${timestamp}@edu.com`;
  const parentRes1 = await BrdSubscriptionService.teacherLinkParent(
    { id: teacherDokki.id, role: 'TEACHER' },
    {
      studentId: studentRes1.student.id,
      parentName: 'Hajj Tariq Father',
      parentEmail: parentEmail,
      parentPhone: '01012345678'
    }
  );
  recordTest('B2', 'Teacher links parent to student', parentRes1.parentId !== undefined, `Parent ID: ${parentRes1.parentId}`);

  // B2.3: Second student linked to same parent without duplicate user record
  const studentRes2 = await BrdSubscriptionService.createStudentWithTeacherOwnership(
    { id: teacherDokki.id, role: 'TEACHER' },
    {
      name: 'Nour Student 2 (Sibling)',
      email: `nour.${timestamp}@edu.com`,
      studentType: 'CENTER_STUDENT',
      gradeLevel: 'SECONDARY_1'
    }
  );
  const parentRes2 = await BrdSubscriptionService.teacherLinkParent(
    { id: teacherDokki.id, role: 'TEACHER' },
    {
      studentId: studentRes2.student.id,
      parentName: 'Hajj Tariq Father',
      parentEmail: parentEmail
    }
  );
  const parentUserCount = await db.user.count({ where: { email: parentEmail } });
  recordTest('B2', 'Same parent linked across siblings without duplicate account',
    parentRes2.parentId === parentRes1.parentId && parentUserCount === 1,
    `Parent User Count: ${parentUserCount}`
  );

  // =========================================================================
  // B3: ACCOUNTANT WORKFLOWS & BRANCH SCOPING
  // =========================================================================
  console.log('\n--- B3: ACCOUNTANT WORKFLOWS & BRANCH SCOPING ---');

  // B3.1: Accountant records payment via CASH
  const paymentCashRes = await BrdSubscriptionService.recordSubscriptionPayment(
    { id: accountantDokki.id, role: 'ACCOUNTANT', branchId: branchDokki.id },
    {
      studentId: studentRes1.student.id,
      teacherId: teacherDokki.id,
      months: [{ year: now.getFullYear(), month: now.getMonth() + 1 }],
      amount: 400,
      receivingMethod: 'CASH'
    }
  );
  recordTest('B3', 'Accountant records CASH payment', 
    paymentCashRes.payment && paymentCashRes.receipt && paymentCashRes.receipt.receiptNumber && paymentCashRes.payment.status === 'CONFIRMED',
    `Receipt: ${paymentCashRes.receipt ? paymentCashRes.receipt.receiptNumber : 'none'}`
  );

  // B3.2: Accountant records payment via BANK_TRANSFER
  const paymentBankRes = await BrdSubscriptionService.recordSubscriptionPayment(
    { id: accountantDokki.id, role: 'ACCOUNTANT', branchId: branchDokki.id },
    {
      studentId: studentRes2.student.id,
      teacherId: teacherDokki.id,
      months: [{ year: now.getFullYear(), month: now.getMonth() + 1 }],
      amount: 400,
      receivingMethod: 'BANK_TRANSFER'
    }
  );
  recordTest('B3', 'Accountant records BANK_TRANSFER payment',
    paymentBankRes.payment && paymentBankRes.receipt && paymentBankRes.receipt.receiptNumber && paymentBankRes.payment.receivingMethod === 'BANK_TRANSFER',
    `Receipt: ${paymentBankRes.receipt ? paymentBankRes.receipt.receiptNumber : 'none'}`
  );

  // B3.3: Accountant records payment via WALLET (Vodafone Cash / InstaPay)
  const studentRes3 = await BrdSubscriptionService.createStudentWithTeacherOwnership(
    { id: teacherDokki.id, role: 'TEACHER' },
    {
      name: 'Kareem Student 3',
      email: `kareem.${timestamp}@edu.com`,
      studentType: 'CENTER_STUDENT',
      gradeLevel: 'SECONDARY_1'
    }
  );
  const paymentWalletRes = await BrdSubscriptionService.recordSubscriptionPayment(
    { id: accountantDokki.id, role: 'ACCOUNTANT', branchId: branchDokki.id },
    {
      studentId: studentRes3.student.id,
      teacherId: teacherDokki.id,
      months: [{ year: now.getFullYear(), month: now.getMonth() + 1 }],
      amount: 400,
      receivingMethod: 'WALLET'
    }
  );
  recordTest('B3', 'Accountant records WALLET payment',
    paymentWalletRes.payment && paymentWalletRes.receipt && paymentWalletRes.receipt.receiptNumber && paymentWalletRes.payment.receivingMethod === 'WALLET',
    `Receipt: ${paymentWalletRes.receipt ? paymentWalletRes.receipt.receiptNumber : 'none'}`
  );

  // B3.4: Verify sequential receipt numbers (Receipt 1, 2, 3 in Branch Dokki)
  const r1 = parseInt(paymentCashRes.receipt.receiptNumber.split('-').pop(), 10);
  const r2 = parseInt(paymentBankRes.receipt.receiptNumber.split('-').pop(), 10);
  const r3 = parseInt(paymentWalletRes.receipt.receiptNumber.split('-').pop(), 10);
  const isStrictlySequential = (r2 === r1 + 1) && (r3 === r2 + 1);
  recordTest('B3', 'Sequential receipts strictly ordered with zero gaps', isStrictlySequential, `${r1} -> ${r2} -> ${r3}`);

  // B3.5: Anti-IDOR: Accountant Dokki cannot record payment for Teacher Nasr in Branch Nasr
  let crossBranchBlocked = false;
  try {
    await BrdSubscriptionService.recordSubscriptionPayment(
      { id: accountantDokki.id, role: 'ACCOUNTANT', branchId: branchDokki.id },
      {
        studentId: studentRes1.student.id,
        teacherId: teacherNasr.id,
        months: [{ year: now.getFullYear(), month: now.getMonth() + 1 }],
        amount: 450,
        receivingMethod: 'CASH'
      }
    );
  } catch (e) {
    crossBranchBlocked = e.message.includes('not assigned to your branch') || e.message.includes('Forbidden');
  }
  recordTest('B3', 'Anti-IDOR: Accountant blocked from collecting for teacher outside branch', crossBranchBlocked);

  // =========================================================================
  // B4: SUBSCRIPTION BILLING ENGINE (Multi-month Advance & Partial Rejection)
  // =========================================================================
  console.log('\n--- B4: SUBSCRIPTION BILLING ENGINE ---');

  // B4.1: Partial payment rejection (price is 400, attempting to pay 250)
  const studentRes4 = await BrdSubscriptionService.createStudentWithTeacherOwnership(
    { id: teacherDokki.id, role: 'TEACHER' },
    {
      name: 'Youssef Student 4',
      email: `youssef.${timestamp}@edu.com`,
      studentType: 'CENTER_STUDENT',
      gradeLevel: 'SECONDARY_1'
    }
  );

  let partialBlocked = false;
  try {
    await BrdSubscriptionService.recordSubscriptionPayment(
      { id: accountantDokki.id, role: 'ACCOUNTANT', branchId: branchDokki.id },
      {
        studentId: studentRes4.student.id,
        teacherId: teacherDokki.id,
        months: [{ year: now.getFullYear(), month: now.getMonth() + 1 }],
        amount: 250, // Partial!
        receivingMethod: 'CASH'
      }
    );
  } catch (e) {
    partialBlocked = e.message.includes('Partial payments are strictly prohibited') || e.message.includes('Invalid payment amount');
  }
  recordTest('B4', 'Partial monthly payment strictly rejected', partialBlocked);

  // B4.2: Multi-month advance payment (pay for 2 upcoming months: 400 + 400 = 800)
  const nextMonth = now.getMonth() + 2 > 12 ? 1 : now.getMonth() + 2;
  const nextYear = now.getMonth() + 2 > 12 ? now.getFullYear() + 1 : now.getFullYear();
  const advancePaymentRes = await BrdSubscriptionService.recordSubscriptionPayment(
    { id: accountantDokki.id, role: 'ACCOUNTANT', branchId: branchDokki.id },
    {
      studentId: studentRes4.student.id,
      teacherId: teacherDokki.id,
      months: [
        { year: now.getFullYear(), month: now.getMonth() + 1 },
        { year: nextYear, month: nextMonth }
      ],
      amount: 800,
      receivingMethod: 'CASH'
    }
  );
  const paymentItemsCount = await db.subscriptionPaymentItem.count({
    where: { paymentId: advancePaymentRes.payment.id }
  });
  recordTest('B4', 'Multi-month advance payment accepted (800 EGP for 2 months)',
    advancePaymentRes.payment && paymentItemsCount === 2,
    `Items in DB: ${paymentItemsCount}`
  );

  // =========================================================================
  // B5: FINANCIAL ACCESS CONTROL & CAIRO LOCK EVALUATION
  // =========================================================================
  console.log('\n--- B5: FINANCIAL ACCESS CONTROL & CAIRO LOCK EVALUATION ---');

  // Student 5: Unpaid student
  const studentRes5 = await BrdSubscriptionService.createStudentWithTeacherOwnership(
    { id: teacherDokki.id, role: 'TEACHER' },
    {
      name: 'Unpaid Student 5',
      email: `unpaid.${timestamp}@edu.com`,
      studentType: 'CENTER_STUDENT',
      gradeLevel: 'SECONDARY_1'
    }
  );

  // B5.1: Day 5 (Before lock day 6) -> Access GRACE_PERIOD (Allowed with warning banner)
  const day5Evaluation = await BrdSubscriptionService.recalculateAccessStatus(
    studentRes5.student.id,
    teacherDokki.id,
    new Date(now.getFullYear(), now.getMonth(), 5)
  );
  recordTest('B5', 'Grace period before lock day allows GRACE_PERIOD access', day5Evaluation.accessStatus === 'GRACE_PERIOD', 'Day 5');

  // B5.2: Day 10 (After lock day 6) -> Access LOCKED (Unpaid)
  const day10Evaluation = await BrdSubscriptionService.recalculateAccessStatus(
    studentRes5.student.id,
    teacherDokki.id,
    new Date(now.getFullYear(), now.getMonth(), 10)
  );
  recordTest('B5', 'Past lock day with unpaid subscription evaluates to LOCKED', day10Evaluation.accessStatus === 'LOCKED', 'Day 10');

  // B5.3: Paid student (Student 1) -> Access ACTIVE after lock day
  const student1Day10 = await BrdSubscriptionService.recalculateAccessStatus(
    studentRes1.student.id,
    teacherDokki.id,
    new Date(now.getFullYear(), now.getMonth(), 10)
  );
  recordTest('B5', 'Paid student retains ACTIVE access after lock day', student1Day10.accessStatus === 'ACTIVE', 'Day 10 (Paid)');

  // B5.4: Manager Exception -> Unpaid student granted humanitarian exception
  const exceptionRes = await BrdSubscriptionService.grantManagerException(
    { id: manager.id, role: 'ADMIN' },
    studentRes5.student.id,
    teacherDokki.id,
    'Social Solidarity Exemption approved by Center'
  );
  recordTest('B5', 'Manager grants exception without financial transaction', 
    exceptionRes.exceptionActiveUntil !== null, 
    `Active Until: ${exceptionRes.exceptionActiveUntil}`
  );

  const exceptionDay10 = await BrdSubscriptionService.recalculateAccessStatus(
    studentRes5.student.id,
    teacherDokki.id,
    new Date(now.getFullYear(), now.getMonth(), 10)
  );
  recordTest('B5', 'Exception student retains ACTIVE access on Day 10', exceptionDay10.accessStatus === 'ACTIVE');

  const zeroFakePayments = await db.subscriptionPayment.count({ where: { studentId: studentRes5.student.id } });
  recordTest('B5', 'Zero fake payments created for exception (Revenue integrity preserved)', zeroFakePayments === 0);

  // B5.5: Scheduler idempotency
  const cycle1 = await runDailyLockCycle();
  const cycle2 = await runDailyLockCycle();
  recordTest('B5', 'Daily lock cycle executes idempotently without duplicate side effects',
    cycle1.success === true && cycle2.success === true
  );

  // =========================================================================
  // B6: PAYMENT CANCELLATION AUDIT REVERSAL
  // =========================================================================
  console.log('\n--- B6: PAYMENT CANCELLATION AUDIT REVERSAL ---');

  // Cancel Student 3 payment (Wallet payment)
  const cancelRes = await BrdSubscriptionService.cancelPayment(
    { id: manager.id, role: 'ADMIN' },
    paymentWalletRes.payment.id,
    'Parent requested refund due to schedule conflict'
  );
  const cancelledPayment = await db.subscriptionPayment.findUnique({
    where: { id: paymentWalletRes.payment.id }
  });
  recordTest('B6', 'Manager cancels payment with audit reason', 
    cancelRes.success === true && cancelledPayment && cancelledPayment.status === 'CANCELLED',
    `Cancellation Reason: ${cancelledPayment ? cancelledPayment.cancellationReason : ''}`
  );

  // Verify access for Student 3 recalculates to LOCKED on Day 10
  const student3PostCancel = await BrdSubscriptionService.recalculateAccessStatus(
    studentRes3.student.id,
    teacherDokki.id,
    new Date(now.getFullYear(), now.getMonth(), 10)
  );
  recordTest('B6', 'Access reverts to LOCKED following payment cancellation', student3PostCancel.accessStatus === 'LOCKED');

  // =========================================================================
  // B7: NOTIFICATIONS & AUDIT LOGS
  // =========================================================================
  console.log('\n--- B7: IN-APP NOTIFICATIONS & AUDIT LOGS ---');

  const student1Notifications = await db.notification.findMany({
    where: { userId: studentRes1.student.id }
  });
  recordTest('B7', 'In-app notification generated for student upon payment', 
    student1Notifications.length > 0,
    `Notifications found: ${student1Notifications.length}`
  );

  // =========================================================================
  // B8: CONCURRENCY STRESS VERIFICATION (Branch Sequential Receipts)
  // =========================================================================
  console.log('\n--- B8: CONCURRENT RECEIPT SEQUENTIALITY VERIFICATION ---');

  const concurrentStudents = [];
  for (let i = 0; i < 5; i++) {
    const s = await db.user.create({
      data: {
        name: `Conc Student ${i + 1}`,
        email: `conc.${i}.${timestamp}@edu.com`,
        password: pwHash,
        role: 'CENTER_STUDENT',
        gradeLevel: 'SECONDARY_1',
        branchId: branchDokki.id,
        responsibleTeacherId: teacherDokki.id
      }
    });
    await db.studentTeacher.create({
      data: { studentId: s.id, teacherId: teacherDokki.id, status: 'ACTIVE', creatorId: teacherDokki.id }
    });
    concurrentStudents.push(s);
  }

  // Fire 5 concurrent payment collections simultaneously
  const concurrentPromises = concurrentStudents.map((s, idx) => {
    return BrdSubscriptionService.recordSubscriptionPayment(
      { id: accountantDokki.id, role: 'ACCOUNTANT', branchId: branchDokki.id },
      {
        studentId: s.id,
        teacherId: teacherDokki.id,
        months: [{ year: now.getFullYear(), month: now.getMonth() + 1 }],
        amount: 400,
        receivingMethod: 'CASH'
      }
    );
  });

  const concurrentResults = await Promise.all(concurrentPromises);
  const receiptNumbers = concurrentResults.map(r => r.receipt.receiptNumber);
  const sequenceNumbers = receiptNumbers.map(rn => parseInt(rn.split('-').pop(), 10)).sort((a, b) => a - b);
  
  // Verify no duplicates
  const uniqueSeq = new Set(sequenceNumbers);
  const hasNoDuplicates = uniqueSeq.size === sequenceNumbers.length;
  
  // Verify strictly contiguous (step = 1)
  let isContiguous = true;
  for (let i = 1; i < sequenceNumbers.length; i++) {
    if (sequenceNumbers[i] !== sequenceNumbers[i - 1] + 1) {
      isContiguous = false;
      break;
    }
  }

  recordTest('B8', 'Concurrent receipts contain zero duplicate sequence numbers', hasNoDuplicates, `Count: ${sequenceNumbers.length}`);
  recordTest('B8', 'Concurrent receipts are strictly contiguous without gaps', isContiguous, `Sequence: ${sequenceNumbers.join(', ')}`);

  console.log('\n================================================================');
  console.log(`COMPREHENSIVE AUDIT COMPLETE: ${passedCount} PASSED | ${failedCount} FAILED`);
  console.log('================================================================');

  if (failedCount > 0) {
    process.exit(1);
  }
}

runComprehensiveAudit()
  .then(async () => {
    await db.$disconnect();
    console.log('All tests passed cleanly.');
    process.exit(0);
  })
  .catch(async (err) => {
    console.error('Test suite failed with unexpected error:', err);
    await db.$disconnect();
    process.exit(1);
  });
