const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const { db } = require('../packages/database/dist/index.js');
const {
  getCairoDateInfo,
  runBrdDailyLockEvaluation
} = require('../services/user-service/dist/services/user-service/src/jobs/brdDailyLock.scheduler.js');
const { BrdSubscriptionService } = require('../services/user-service/dist/services/user-service/src/services/brdSubscription.service.js');
const bcrypt = require('bcryptjs');

async function testSchedulerAndIsolation() {
  console.log('================================================================');
  console.log('VERIFICATION D: SCHEDULER & TEACHER-SPECIFIC ACCESS ISOLATION');
  console.log('================================================================');

  const now = Date.now();
  const hashedPassword = await bcrypt.hash('Password123!', 10);
  const createdUserIds = [];

  // 1. Test Cairo Timezone & Daylight Saving handling
  console.log('\n--- 1. Testing Cairo Timezone (Africa/Cairo) ---');
  // Winter time date (Jan 15)
  const winterDate = new Date('2026-01-15T22:00:00Z'); // 22:00 UTC = 00:00 Cairo (UTC+2)
  const winterInfo = getCairoDateInfo(winterDate);
  console.log('  Winter 22:00 UTC -> Cairo hour:', winterInfo.hour, '(Expected 0)');
  if (winterInfo.hour !== 0) throw new Error('Winter Cairo timezone conversion failed');

  // Summer / DST date (July 15)
  const summerDate = new Date('2026-07-15T21:00:00Z'); // 21:00 UTC = 00:00 Cairo (UTC+3 in DST)
  const summerInfo = getCairoDateInfo(summerDate);
  console.log('  Summer 21:00 UTC -> Cairo hour:', summerInfo.hour, '(Expected 0)');
  if (summerInfo.hour !== 0) throw new Error('Summer Cairo timezone conversion failed');
  console.log('  [PASS] Cairo timezone formatting handled accurately across seasonal offsets.');

  // 2. Setup isolated test fixtures for Multi-Teacher Isolation test
  const inst = await db.institution.findFirst();
  const branch = await db.branch.create({
    data: { name: `Sched Branch ${now}`, code: `SB${String(now).slice(-3)}`, status: 'ACTIVE', institutionId: inst.id }
  });

  const manager = await db.user.create({
    data: { name: 'Sched Manager', email: `smgr.${now}@edu.com`, password: hashedPassword, role: 'PRIMARY_MANAGER', isPrimaryManager: true, branchId: branch.id }
  });
  createdUserIds.push(manager.id);

  const teacherA = await db.user.create({
    data: { name: 'Teacher Math', email: `tmath.${now}@edu.com`, password: hashedPassword, role: 'TEACHER', branchId: branch.id }
  });
  createdUserIds.push(teacherA.id);

  const teacherB = await db.user.create({
    data: { name: 'Teacher Physics', email: `tphys.${now}@edu.com`, password: hashedPassword, role: 'TEACHER', branchId: branch.id }
  });
  createdUserIds.push(teacherB.id);

  const student = await db.user.create({
    data: { name: 'Multi Subject Student', email: `multi.${now}@edu.com`, password: hashedPassword, role: 'CENTER_STUDENT', gradeLevel: 'SECONDARY_1', branchId: branch.id, responsibleTeacherId: teacherA.id }
  });
  createdUserIds.push(student.id);

  const accountant = await db.user.create({
    data: { name: 'Sched Accountant', email: `sacc.${now}@edu.com`, password: hashedPassword, role: 'ACCOUNTANT', branchId: branch.id }
  });
  createdUserIds.push(accountant.id);

  // Set prices for both teachers (350 EGP each)
  await db.teacherGradePricing.create({
    data: { teacherId: teacherA.id, grade: 'SECONDARY_1', price: 350, effectiveMonth: '2026-11' }
  });
  await db.teacherGradePricing.create({
    data: { teacherId: teacherB.id, grade: 'SECONDARY_1', price: 350, effectiveMonth: '2026-11' }
  });

  // Enroll student with BOTH Teacher A and Teacher B
  const linkA = await db.studentTeacher.create({
    data: { studentId: student.id, teacherId: teacherA.id, creatorId: teacherA.id, status: 'ACTIVE', accessStatus: 'ACTIVE' }
  });
  const linkB = await db.studentTeacher.create({
    data: { studentId: student.id, teacherId: teacherB.id, creatorId: teacherB.id, status: 'ACTIVE', accessStatus: 'ACTIVE' }
  });

  // Pay Teacher A in full (350 EGP)
  console.log('\n--- 2. Paying Teacher A only (Teacher B remains unpaid) ---');
  await BrdSubscriptionService.recordSubscriptionPayment(
    { id: accountant.id, role: 'ACCOUNTANT', branchId: branch.id },
    {
      studentId: student.id,
      teacherId: teacherA.id,
      months: [{ year: 2026, month: 11 }],
      amount: 350,
      receivingMethod: 'CASH',
      notes: 'Payment for Math only'
    }
  );
  console.log('  Payment recorded for Teacher A.');

  // 3. Test Grace Period Evaluation (Day 3 at 00:00 Cairo time)
  console.log('\n--- 3. Testing Grace Period (Day 3) ---');
  const day3Date = new Date('2026-11-03T00:00:00+02:00');
  await runBrdDailyLockEvaluation(day3Date);

  const statusADay3 = (await db.studentTeacher.findUnique({ where: { id: linkA.id } })).accessStatus;
  const statusBDay3 = (await db.studentTeacher.findUnique({ where: { id: linkB.id } })).accessStatus;
  console.log(`  Day 3 - Teacher A access status: ${statusADay3} (Expected ACTIVE)`);
  console.log(`  Day 3 - Teacher B access status: ${statusBDay3} (Expected GRACE_PERIOD)`);
  if (statusADay3 !== 'ACTIVE' || statusBDay3 !== 'GRACE_PERIOD') {
    throw new Error('Grace period evaluation failed!');
  }
  console.log('  [PASS] Paid teacher is ACTIVE, unpaid teacher is GRACE_PERIOD.');

  // 4. Test Lock Boundary Evaluation (Day 6 at 00:00 Cairo time)
  console.log('\n--- 4. Testing Cairo Lock Boundary (Day 6, 00:00 Cairo) ---');
  const day6Date = new Date('2026-11-06T00:00:00+02:00');
  await runBrdDailyLockEvaluation(day6Date);

  const statusADay6 = (await db.studentTeacher.findUnique({ where: { id: linkA.id } })).accessStatus;
  const statusBDay6 = (await db.studentTeacher.findUnique({ where: { id: linkB.id } })).accessStatus;
  console.log(`  Day 6 - Teacher A access status: ${statusADay6} (Expected ACTIVE)`);
  console.log(`  Day 6 - Teacher B access status: ${statusBDay6} (Expected LOCKED)`);
  if (statusADay6 !== 'ACTIVE' || statusBDay6 !== 'LOCKED') {
    throw new Error('Day 6 lock boundary evaluation failed!');
  }
  console.log('  [PASS] Teacher-specific isolation verified: Teacher A remains ACTIVE, only Teacher B is LOCKED.');

  // 5. Test Idempotency (Repeat Day 6 evaluation immediately)
  console.log('\n--- 5. Testing Scheduler Idempotency (Repeated Run) ---');
  const initialAuditCount = await db.studentAuditLog.count({
    where: { studentId: student.id, eventType: 'ACCESS_LOCKED' }
  });
  await runBrdDailyLockEvaluation(day6Date);
  const secondAuditCount = await db.studentAuditLog.count({
    where: { studentId: student.id, eventType: 'ACCESS_LOCKED' }
  });
  console.log(`  ACCESS_LOCKED audit count before: ${initialAuditCount}, after second run: ${secondAuditCount}`);
  if (initialAuditCount !== secondAuditCount) {
    throw new Error('Scheduler is not idempotent! Duplicate audit logs created.');
  }
  console.log('  [PASS] Scheduler execution is completely idempotent with zero duplicate audit events.');

  // 6. Test Manager Access Exception (Must restore access without creating financial payment)
  console.log('\n--- 6. Testing Manager Exception (Access without financial distortion) ---');
  const paymentsBeforeException = await db.subscriptionPayment.count({ where: { studentId: student.id } });
  
  await BrdSubscriptionService.grantManagerException(
    { id: manager.id, role: 'PRIMARY_MANAGER' },
    student.id,
    teacherB.id,
    'Compassionate financial waiver'
  );

  // Evaluate on Day 7 with exception active
  const day7Date = new Date('2026-11-07T00:00:00+02:00');
  await runBrdDailyLockEvaluation(day7Date);

  const statusBException = (await db.studentTeacher.findUnique({ where: { id: linkB.id } })).accessStatus;
  const paymentsAfterException = await db.subscriptionPayment.count({ where: { studentId: student.id } });

  console.log(`  With exception active, Teacher B access status: ${statusBException} (Expected ACTIVE)`);
  console.log(`  Payments count before: ${paymentsBeforeException}, after: ${paymentsAfterException} (Expected equal)`);
  if (statusBException !== 'ACTIVE' || paymentsBeforeException !== paymentsAfterException) {
    throw new Error('Manager exception failed or distorted financial payments!');
  }
  console.log('  [PASS] Manager exception restored access with ZERO financial payments created.');

  // 7. Cleanup disposable test fixtures
  console.log('\n--- 7. Cleaning up test fixtures ---');
  await db.subscriptionPaymentItem.deleteMany({ where: { payment: { studentId: student.id } } });
  await db.branchSequentialReceipt.deleteMany({ where: { studentId: student.id } });
  await db.subscriptionPayment.deleteMany({ where: { studentId: student.id } });
  await db.studentMonthlySubscription.deleteMany({ where: { studentId: student.id } });
  await db.studentAuditLog.deleteMany({ where: { studentId: student.id } });
  await db.studentTeacher.deleteMany({ where: { studentId: student.id } });
  await db.teacherGradePricing.deleteMany({ where: { teacherId: { in: [teacherA.id, teacherB.id] } } });
  await db.user.deleteMany({ where: { id: { in: createdUserIds } } });
  await db.branch.deleteMany({ where: { id: branch.id } });
  console.log('  Disposable test fixtures cleaned up cleanly.');

  await db.$disconnect();
  console.log('\n================================================================');
  console.log('ALL VERIFICATION D TESTS PASSED (100%)');
  console.log('================================================================');
}

testSchedulerAndIsolation().catch(e => {
  console.error('Fatal scheduler test error:', e);
  process.exit(1);
});
