const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const { db } = require('../packages/database/dist/index.js');
const { BrdSubscriptionService } = require('../services/user-service/dist/services/user-service/src/services/brdSubscription.service.js');

async function testConcurrentReceipts() {
  console.log('--- STARTING CONCURRENT RECEIPT GENERATION TEST ---');

  // 1. Find existing manager and institution
  const manager = await db.user.findFirst({ where: { role: 'PRIMARY_MANAGER' } });
  const inst = await db.institution.findFirst();

  // Create dedicated test branch
  const branch = await db.branch.create({
    data: {
      name: `Concurrent Branch ${Date.now()}`,
      code: `C${String(Date.now()).slice(-3)}`,
      status: 'ACTIVE',
      institutionId: inst ? inst.id : undefined
    }
  });

  // 2. Create accountant and teacher in branch
  const accountant = await db.user.create({
    data: {
      name: 'Concurrent Accountant',
      email: `conc.acc.${Date.now()}@edu.com`,
      password: 'hash',
      role: 'ACCOUNTANT',
      branchId: branch.id
    }
  });

  const teacher = await db.user.create({
    data: {
      name: 'Concurrent Teacher',
      email: `conc.teach.${Date.now()}@edu.com`,
      password: 'hash',
      role: 'TEACHER',
      branchId: branch.id
    }
  });

  const now = new Date();
  const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  // Set teacher pricing via BrdSubscriptionService
  await BrdSubscriptionService.setTeacherGradePrice(
    { id: manager.id, role: 'PRIMARY_MANAGER' },
    {
      teacherId: teacher.id,
      grade: 'SECONDARY_1',
      price: 350,
      effectiveMonth: currentMonthKey,
      reason: 'Concurrency Verification'
    }
  );

  // 3. Create 5 test students enrolled with teacher
  const studentIds = [];
  for (let i = 0; i < 5; i++) {
    const s = await db.user.create({
      data: {
        name: `Concurrent Student ${i + 1}`,
        email: `conc.student.${i}.${Date.now()}@edu.com`,
        password: 'hash',
        role: 'CENTER_STUDENT',
        gradeLevel: 'SECONDARY_1',
        branchId: branch.id,
        responsibleTeacherId: teacher.id
      }
    });
    studentIds.push(s.id);

    await db.studentTeacher.create({
      data: {
        studentId: s.id,
        teacherId: teacher.id,
        creatorId: teacher.id,
        status: 'ACTIVE',
        accessStatus: 'ACTIVE'
      }
    });
  }

  // 4. Fire 5 concurrent payment submissions
  console.log(`Firing 5 concurrent payment transactions for branch: ${branch.code} (Branch ID: ${branch.id})`);

  const paymentPromises = studentIds.map((studentId, idx) => {
    return BrdSubscriptionService.recordSubscriptionPayment(
      { id: accountant.id, role: 'ACCOUNTANT', branchId: branch.id },
      {
        studentId,
        teacherId: teacher.id,
        months: [{ year: now.getFullYear(), month: now.getMonth() + 1 }],
        amount: 350,
        receivingMethod: 'CASH',
        notes: `Concurrent test payment #${idx + 1}`
      }
    );
  });

  const results = await Promise.all(paymentPromises);
  console.log('All 5 concurrent transactions settled.');

  // 5. Collect receipt numbers and sequence numbers
  const receiptNumbers = results.map(r => r.receipt.receiptNumber);
  const sequenceNumbers = results.map(r => r.receipt.sequenceNumber).sort((a, b) => a - b);

  console.log('Generated Receipt Numbers:', receiptNumbers);
  console.log('Sequence Numbers (Sorted):', sequenceNumbers);

  // Assertions
  const uniqueSequences = new Set(sequenceNumbers);
  if (uniqueSequences.size !== 5) {
    throw new Error(`CONCURRENCY VIOLATION: Duplicate sequences detected! Unique count: ${uniqueSequences.size}`);
  }

  // Check strictly consecutive 1, 2, 3, 4, 5
  for (let i = 0; i < 5; i++) {
    const expected = i + 1;
    if (sequenceNumbers[i] !== expected) {
      throw new Error(`GAP DETECTED: Expected sequence ${expected}, got ${sequenceNumbers[i]}`);
    }
  }

  console.log('VERIFIED: All 5 receipts are strictly unique, sequential (1 to 5), with NO DUPLICATES and NO GAPS!');
  console.log('--- CONCURRENT RECEIPT GENERATION TEST PASSED ---');

  await db.$disconnect();
}

testConcurrentReceipts().catch(e => {
  console.error('Test failed:', e);
  process.exit(1);
});
