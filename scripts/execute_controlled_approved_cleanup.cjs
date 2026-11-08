const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const { PrismaClient } = require(path.resolve(__dirname, '../node_modules/@prisma/client'));

const db = new PrismaClient({
  datasources: { db: { url: process.env.DATABASE_URL } }
});

async function main() {
  console.log('=======================================================');
  console.log('STEP 6: CONTROLLED ATOMIC CLEANUP OF APPROVED RECORDS');
  console.log('=======================================================');

  // 1. Double-check DB identity
  const [ident] = await db.$queryRawUnsafe(
    'SELECT current_database(), current_user, inet_server_port(), inet_server_addr()'
  );
  console.log('Active DB Identity:', ident);
  if (ident.current_database !== 'ox_digital_dev_test' || ident.current_user !== 'ox_dev_admin') {
    throw new Error('Database identity mismatch! Aborting.');
  }

  // 2. Define Approved Deletion Target IDs
  const APPROVED_TARGETS = {
    testBranch: '152b6c2a-e5d8-4151-b557-393cd3285632', // اختبار
    testBranchB: 'br_idor_b_w4adp2', // فرع مدينة نصر
    testInstB: 'inst_idor_b_w4adp2', // Institution B w4adp2
    courseA: 'crs_a_91xnz3', // Math A 91xnz3
    courseB: 'crs_b_w4adp2', // Math B w4adp2
    examA: 'exam_a_91xnz3',
    examB: 'exam_b_w4adp2',
    hwA: 'hw_a_91xnz3',
    hwB: 'hw_b_w4adp2'
  };

  // 3. Define Protected Records
  const PROTECTED_IDS = {
    canonicalInst: 'inst_idor_a_91xnz3',
    canonicalBranch: 'br_idor_a_91xnz3',
    adminUser: 'admin_91xnz3',
    teacherUser: 'teach_b_w4adp2',
    accountantUser: 'acc_a_w4adp2',
    cashbox: 'c4faf1ce-dfb7-48c2-8664-17db21883eb5',
    unapprovedInstA: 'inst_idor_a_w4adp2',
    unapprovedBranchA: 'br_idor_a_w4adp2'
  };

  console.log('\n--- Pre-Deletion Precondition Check ---');

  // Verify all targets exist
  const b1 = await db.branch.findUnique({ where: { id: APPROVED_TARGETS.testBranch } });
  const bB = await db.branch.findUnique({ where: { id: APPROVED_TARGETS.testBranchB } });
  const iB = await db.institution.findUnique({ where: { id: APPROVED_TARGETS.testInstB } });
  const cA = await db.course.findUnique({ where: { id: APPROVED_TARGETS.courseA } });
  const cB = await db.course.findUnique({ where: { id: APPROVED_TARGETS.courseB } });
  const eA = await db.exam.findUnique({ where: { id: APPROVED_TARGETS.examA } });
  const eB = await db.exam.findUnique({ where: { id: APPROVED_TARGETS.examB } });
  const hA = await db.homework.findUnique({ where: { id: APPROVED_TARGETS.hwA } });
  const hB = await db.homework.findUnique({ where: { id: APPROVED_TARGETS.hwB } });

  if (!b1 || !bB || !iB || !cA || !cB || !eA || !eB || !hA || !hB) {
    throw new Error('One or more approved target records were not found in the database! Aborting.');
  }

  // Verify protected entities exist
  const canInst = await db.institution.findUnique({ where: { id: PROTECTED_IDS.canonicalInst } });
  const canBr = await db.branch.findUnique({ where: { id: PROTECTED_IDS.canonicalBranch } });
  const canAdmin = await db.user.findUnique({ where: { id: PROTECTED_IDS.adminUser } });
  const canTeach = await db.user.findUnique({ where: { id: PROTECTED_IDS.teacherUser } });
  const canAcc = await db.user.findUnique({ where: { id: PROTECTED_IDS.accountantUser } });
  const canCb = await db.cashbox.findUnique({ where: { id: PROTECTED_IDS.cashbox } });
  const unInstA = await db.institution.findUnique({ where: { id: PROTECTED_IDS.unapprovedInstA } });
  const unBrA = await db.branch.findUnique({ where: { id: PROTECTED_IDS.unapprovedBranchA } });

  if (!canInst || !canBr || !canAdmin || !canTeach || !canAcc || !canCb || !unInstA || !unBrA) {
    throw new Error('One or more protected records are missing before cleanup! Aborting.');
  }

  console.log('[PASS] All targets and protected records verified in database.');

  // Execute in an atomic interactive transaction
  console.log('\n--- Executing Atomic Deletion Transaction ---');
  const deletionLog = [];

  const result = await db.$transaction(async (tx) => {
    // 1. Delete Homeworks
    console.log('1. Deleting Homework records...');
    const delHwA = await tx.homework.delete({ where: { id: APPROVED_TARGETS.hwA } });
    deletionLog.push({ table: 'Homework', id: delHwA.id, title: delHwA.title });
    const delHwB = await tx.homework.delete({ where: { id: APPROVED_TARGETS.hwB } });
    deletionLog.push({ table: 'Homework', id: delHwB.id, title: delHwB.title });

    // 2. Delete Exams
    console.log('2. Deleting Exam records...');
    const delExA = await tx.exam.delete({ where: { id: APPROVED_TARGETS.examA } });
    deletionLog.push({ table: 'Exam', id: delExA.id, title: delExA.title });
    const delExB = await tx.exam.delete({ where: { id: APPROVED_TARGETS.examB } });
    deletionLog.push({ table: 'Exam', id: delExB.id, title: delExB.title });

    // 3. Delete Courses
    console.log('3. Deleting Course records...');
    const delCoA = await tx.course.delete({ where: { id: APPROVED_TARGETS.courseA } });
    deletionLog.push({ table: 'Course', id: delCoA.id, title: delCoA.title });
    const delCoB = await tx.course.delete({ where: { id: APPROVED_TARGETS.courseB } });
    deletionLog.push({ table: 'Course', id: delCoB.id, title: delCoB.title });

    // 4. Delete Branches (اختبار and فرع مدينة نصر)
    console.log('4. Deleting Branch records...');
    const delBr1 = await tx.branch.delete({ where: { id: APPROVED_TARGETS.testBranch } });
    deletionLog.push({ table: 'Branch', id: delBr1.id, name: delBr1.name, code: delBr1.code });
    const delBrB = await tx.branch.delete({ where: { id: APPROVED_TARGETS.testBranchB } });
    deletionLog.push({ table: 'Branch', id: delBrB.id, name: delBrB.name, code: delBrB.code });

    // 5. Delete Institution B
    console.log('5. Deleting Institution B record...');
    const delInB = await tx.institution.delete({ where: { id: APPROVED_TARGETS.testInstB } });
    deletionLog.push({ table: 'Institution', id: delInB.id, name: delInB.name, code: delInB.code });

    // In-transaction validation
    const branchCount = await tx.branch.count();
    const instCount = await tx.institution.count();
    const courseCount = await tx.course.count();
    const examCount = await tx.exam.count();
    const hwCount = await tx.homework.count();
    const userCount = await tx.user.count();
    const cashboxCount = await tx.cashbox.count();

    if (branchCount !== 2) throw new Error(`Unexpected branch count in transaction: ${branchCount} (Expected: 2)`);
    if (instCount !== 2) throw new Error(`Unexpected institution count in transaction: ${instCount} (Expected: 2)`);
    if (courseCount !== 0) throw new Error(`Unexpected course count in transaction: ${courseCount} (Expected: 0)`);
    if (examCount !== 0) throw new Error(`Unexpected exam count in transaction: ${examCount} (Expected: 0)`);
    if (hwCount !== 0) throw new Error(`Unexpected hw count in transaction: ${hwCount} (Expected: 0)`);
    if (userCount !== 3) throw new Error(`Unexpected user count in transaction: ${userCount} (Expected: 3)`);
    if (cashboxCount !== 1) throw new Error(`Unexpected cashbox count in transaction: ${cashboxCount} (Expected: 1)`);

    return { branchCount, instCount, courseCount, examCount, hwCount, userCount, cashboxCount };
  });

  console.log('\n[SUCCESS] Transaction committed successfully!');
  console.log('Deletion Log:');
  console.table(deletionLog);
  console.log('Post-Transaction Verified Counts:', result);

  await db.$disconnect();
}

main().catch(err => {
  console.error('\n[FATAL] Cleanup transaction failed and rolled back:', err);
  process.exit(1);
});

