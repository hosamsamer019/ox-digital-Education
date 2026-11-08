/**
 * OX-DIGITAL Education — Controlled Synthetic Data Cleanup Script (Full Foreign-Key Aware)
 * Target Database: ox_digital_dev_test on 127.0.0.1:5433
 */

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const { PrismaClient } = require(path.resolve(__dirname, '../node_modules/@prisma/client'));

const db = new PrismaClient({
  datasources: { db: { url: process.env.DATABASE_URL } }
});

async function runControlledCleanup() {
  console.log('================================================================');
  console.log('OX-DIGITAL EDUCATION — CONTROLLED SYNTHETIC DATA CLEANUP');
  console.log('================================================================');

  // 1. Boundary verification
  const [ident] = await db.$queryRawUnsafe(
    'SELECT current_database() as db, current_user as usr, inet_server_port() as port;'
  );
  console.log(`Verified DB Target: ${ident.usr} on ${ident.db} (port ${ident.port})`);
  if (ident.db !== 'ox_digital_dev_test' || ident.usr !== 'ox_dev_admin') {
    throw new Error('FATAL: Refusing execution on non-authorized database target!');
  }

  // 2. Identify canonical entities
  const canonicalUsers = await db.user.findMany({
    where: {
      email: { in: ['admin@edu.com', 'teacher@gmail.com', 'acount@gmail.com'] }
    }
  });

  if (canonicalUsers.length !== 3) {
    throw new Error(`FATAL: Expected 3 canonical users, found ${canonicalUsers.length}`);
  }

  const preservedUserIds = canonicalUsers.map(u => u.id);
  const preservedInstIds = ['inst_idor_a_91xnz3', 'inst_idor_b_w4adp2', 'inst_idor_a_w4adp2'];
  const preservedBranchIds = ['br_idor_a_91xnz3', 'br_idor_b_w4adp2', 'br_idor_a_w4adp2'];

  console.log('Canonical Users Preserved:', canonicalUsers.map(u => `${u.email} (${u.id})`));
  console.log('Preserved Institutions:', preservedInstIds);
  console.log('Preserved Branches:', preservedBranchIds);

  // Take Before Counts
  console.log('\n--- CAPTURING BEFORE COUNTS ---');
  const getCounts = async () => {
    const [users] = await db.$queryRawUnsafe('SELECT count(*) FROM "User";');
    const [insts] = await db.$queryRawUnsafe('SELECT count(*) FROM "Institution";');
    const [branches] = await db.$queryRawUnsafe('SELECT count(*) FROM "Branch";');
    const [subPayments] = await db.$queryRawUnsafe('SELECT count(*) FROM "SubscriptionPayment";');
    const [receipts] = await db.$queryRawUnsafe('SELECT count(*) FROM "BranchSequentialReceipt";');
    const [monthlySubs] = await db.$queryRawUnsafe('SELECT count(*) FROM "StudentMonthlySubscription";');
    const [obligations] = await db.$queryRawUnsafe('SELECT count(*) FROM "StudentObligation";');
    const [studentTeachers] = await db.$queryRawUnsafe('SELECT count(*) FROM "StudentTeacher";');
    const [notifications] = await db.$queryRawUnsafe('SELECT count(*) FROM "Notification";');
    const [auditLogs] = await db.$queryRawUnsafe('SELECT count(*) FROM "StudentAuditLog";');
    const [cashboxes] = await db.$queryRawUnsafe('SELECT count(*) FROM "Cashbox";');
    const [expenses] = await db.$queryRawUnsafe('SELECT count(*) FROM "ExpenseVoucher";');
    const [courses] = await db.$queryRawUnsafe('SELECT count(*) FROM "Course";');

    return {
      users: parseInt(users.count, 10),
      insts: parseInt(insts.count, 10),
      branches: parseInt(branches.count, 10),
      subPayments: parseInt(subPayments.count, 10),
      receipts: parseInt(receipts.count, 10),
      monthlySubs: parseInt(monthlySubs.count, 10),
      obligations: parseInt(obligations.count, 10),
      studentTeachers: parseInt(studentTeachers.count, 10),
      notifications: parseInt(notifications.count, 10),
      auditLogs: parseInt(auditLogs.count, 10),
      cashboxes: parseInt(cashboxes.count, 10),
      expenses: parseInt(expenses.count, 10),
      courses: parseInt(courses.count, 10)
    };
  };

  const before = await getCounts();
  console.log('Before Counts:', before);

  // 3. Reassign crs_a_91xnz3 teacher to teach_b_w4adp2 so it remains valid in main branch
  await db.$executeRawUnsafe(`
    UPDATE "Course" 
    SET "teacherId" = 'teach_b_w4adp2' 
    WHERE id = 'crs_a_91xnz3';
  `);

  // Delete synthetic course children and courses
  await db.$executeRawUnsafe(`DELETE FROM "Homework" WHERE "courseId" NOT IN ('crs_a_91xnz3', 'crs_b_w4adp2');`);
  await db.$executeRawUnsafe(`DELETE FROM "Exam" WHERE "courseId" NOT IN ('crs_a_91xnz3', 'crs_b_w4adp2');`);
  await db.$executeRawUnsafe(`DELETE FROM "CourseEnrollment" WHERE "courseId" NOT IN ('crs_a_91xnz3', 'crs_b_w4adp2');`);
  await db.$executeRawUnsafe(`DELETE FROM "Course" WHERE id NOT IN ('crs_a_91xnz3', 'crs_b_w4adp2');`);
  console.log('Cleaned synthetic courses, exams, homeworks, and enrollments.');

  // 4. Delete dependent synthetic records
  console.log('\n--- EXECUTING DEPENDENCY-AWARE PURGE OF SYNTHETIC DATA ---');

  // a. Student academic activity (attempts, submissions, attendance, video progress)
  await db.$executeRawUnsafe(`DELETE FROM "ExamAttempt";`);
  await db.$executeRawUnsafe(`DELETE FROM "Submission";`);
  await db.$executeRawUnsafe(`DELETE FROM "Attendance";`);
  await db.$executeRawUnsafe(`DELETE FROM "VideoProgress";`);
  await db.$executeRawUnsafe(`DELETE FROM "AssessmentAttempt";`);
  await db.$executeRawUnsafe(`DELETE FROM "UserSession";`);
  console.log('Purged transient academic and session activity.');

  // b. Notifications & Audit Logs
  await db.$executeRawUnsafe(`
    DELETE FROM "Notification" 
    WHERE "userId" NOT IN ('admin_91xnz3', 'teach_b_w4adp2', 'acc_a_w4adp2');
  `);
  console.log('Purged Notifications of synthetic users.');

  await db.$executeRawUnsafe(`
    DELETE FROM "StudentAuditLog" 
    WHERE "studentId" NOT IN ('admin_91xnz3', 'teach_b_w4adp2', 'acc_a_w4adp2');
  `);
  console.log('Purged StudentAuditLog of synthetic students.');

  // c. Financial collections and obligations
  await db.$executeRawUnsafe(`DELETE FROM "CollectionTender";`);
  await db.$executeRawUnsafe(`DELETE FROM "CollectionAllocation";`);
  await db.$executeRawUnsafe(`DELETE FROM "Collection";`);
  await db.$executeRawUnsafe(`
    DELETE FROM "StudentObligation"
    WHERE "studentId" NOT IN ('admin_91xnz3', 'teach_b_w4adp2', 'acc_a_w4adp2');
  `);
  console.log('Purged StudentObligation.');

  await db.$executeRawUnsafe(`DELETE FROM "FinancialAdjustment";`);
  await db.$executeRawUnsafe(`DELETE FROM "FinancialAuditEvent";`);
  await db.$executeRawUnsafe(`DELETE FROM "StudentFinancialAgreement";`);
  await db.$executeRawUnsafe(`DELETE FROM "StudentFinancialAccount";`);
  console.log('Purged legacy collections and financial adjustment records.');

  // d. Subscriptions, Payments & Receipts
  await db.$executeRawUnsafe(`
    DELETE FROM "BranchSequentialReceipt" 
    WHERE "studentId" NOT IN ('admin_91xnz3', 'teach_b_w4adp2', 'acc_a_w4adp2')
       OR "branchId" NOT IN ('br_idor_a_91xnz3', 'br_idor_b_w4adp2', 'br_idor_a_w4adp2');
  `);
  console.log('Purged BranchSequentialReceipt of synthetic records.');

  await db.$executeRawUnsafe(`DELETE FROM "SubscriptionPaymentItem";`);
  console.log('Purged SubscriptionPaymentItem.');

  await db.$executeRawUnsafe(`
    DELETE FROM "SubscriptionPayment"
    WHERE "studentId" NOT IN ('admin_91xnz3', 'teach_b_w4adp2', 'acc_a_w4adp2');
  `);
  console.log('Purged SubscriptionPayment.');

  await db.$executeRawUnsafe(`
    DELETE FROM "StudentMonthlySubscription"
    WHERE "studentId" NOT IN ('admin_91xnz3', 'teach_b_w4adp2', 'acc_a_w4adp2');
  `);
  console.log('Purged StudentMonthlySubscription.');

  await db.$executeRawUnsafe(`
    DELETE FROM "StudentTeacher"
    WHERE "studentId" NOT IN ('admin_91xnz3', 'teach_b_w4adp2', 'acc_a_w4adp2');
  `);
  console.log('Purged StudentTeacher.');

  // e. Cashbox transactions and mock cashboxes
  await db.$executeRawUnsafe(`DELETE FROM "CashboxTransaction";`);
  await db.$executeRawUnsafe(`DELETE FROM "CashboxReconciliation";`);
  await db.$executeRawUnsafe(`DELETE FROM "ExpenseVoucher";`);
  await db.$executeRawUnsafe(`DELETE FROM "Cashbox";`);
  console.log('Purged synthetic cashbox transactions, reconciliations, expense vouchers, and cashboxes.');

  // f. Teacher grade pricing, transfer history, and audit
  await db.$executeRawUnsafe(`DELETE FROM "PriceAuditHistory";`);
  await db.$executeRawUnsafe(`DELETE FROM "TeacherTransferHistory";`);
  await db.$executeRawUnsafe(`DELETE FROM "TeacherSubscriptionSetting";`);
  await db.$executeRawUnsafe(`DELETE FROM "TeacherGradePricing";`);
  console.log('Purged synthetic teacher grade pricing and price audit history.');

  // g. Chat sessions
  await db.$executeRawUnsafe(`DELETE FROM "ChatMessage";`);
  await db.$executeRawUnsafe(`DELETE FROM "ChatSession";`);
  console.log('Purged chat sessions.');

  // h. Receipt counters for synthetic branches
  await db.$executeRawUnsafe(`
    DELETE FROM "BranchReceiptCounter"
    WHERE "branchId" NOT IN ('br_idor_a_91xnz3', 'br_idor_b_w4adp2', 'br_idor_a_w4adp2');
  `);
  console.log('Purged BranchReceiptCounter for synthetic branches.');

  // i. Clear self-referencing foreign keys on synthetic users before user deletion
  await db.$executeRawUnsafe(`
    UPDATE "User"
    SET "parentId" = NULL, "creatorId" = NULL, "responsibleTeacherId" = NULL;
  `);
  await db.$executeRawUnsafe(`
    UPDATE "Institution"
    SET "primaryManagerId" = NULL
    WHERE id != 'inst_idor_a_91xnz3';
  `);

  // j. Purge all synthetic users
  await db.$executeRawUnsafe(`
    DELETE FROM "User"
    WHERE id NOT IN ('admin_91xnz3', 'teach_b_w4adp2', 'acc_a_w4adp2');
  `);
  console.log('Purged all synthetic User records.');

  // k. Purge synthetic branches
  await db.$executeRawUnsafe(`
    DELETE FROM "Branch"
    WHERE id NOT IN ('br_idor_a_91xnz3', 'br_idor_b_w4adp2', 'br_idor_a_w4adp2');
  `);
  console.log('Purged synthetic Branch records.');

  // l. Purge synthetic institutions
  await db.$executeRawUnsafe(`
    DELETE FROM "Institution"
    WHERE id NOT IN ('inst_idor_a_91xnz3', 'inst_idor_b_w4adp2', 'inst_idor_a_w4adp2');
  `);
  console.log('Purged synthetic Institution records.');

  // 5. Establish Pristine Baseline Configuration
  console.log('\n--- ESTABLISHING PRISTINE BASELINE CONFIGURATION ---');

  // Friendly names for institutions and branches
  await db.institution.update({
    where: { id: 'inst_idor_a_91xnz3' },
    data: { name: 'مؤسسة أوكس التعليمية - المركز الرئيسي' }
  });

  await db.branch.update({
    where: { id: 'br_idor_a_91xnz3' },
    data: { name: 'الفرع الرئيسي (الدقي)', code: 'DK-01' }
  });

  await db.branch.update({
    where: { id: 'br_idor_b_w4adp2' },
    data: { name: 'فرع مدينة نصر', code: 'NS-01' }
  });

  // Re-link accountant and teacher to the primary manager institution so they appear on the Manager's dashboard
  await db.user.update({
    where: { id: 'acc_a_w4adp2' },
    data: {
      institutionId: 'inst_idor_a_91xnz3',
      branchId: 'br_idor_a_91xnz3',
      name: 'محاسب المركز الرئيسي'
    }
  });

  await db.user.update({
    where: { id: 'teach_b_w4adp2' },
    data: {
      institutionId: 'inst_idor_a_91xnz3',
      branchId: 'br_idor_a_91xnz3',
      name: 'أستاذ الرياضيات المعتمد'
    }
  });

  // Update courses to reference the primary institution and branch
  await db.course.updateMany({
    where: { id: { in: ['crs_a_91xnz3', 'crs_b_w4adp2'] } },
    data: {
      institutionId: 'inst_idor_a_91xnz3',
      branchId: 'br_idor_a_91xnz3'
    }
  });

  // Create clean initial Cashbox for the main branch
  const mainCashbox = await db.cashbox.create({
    data: {
      code: 'CB-MAIN-01',
      name: 'خزينة الاستقبال المركزية',
      branchId: 'br_idor_a_91xnz3',
      institutionId: 'inst_idor_a_91xnz3',
      currentBalance: 0,
      assignedCashierId: 'acc_a_w4adp2',
      status: 'ACTIVE'
    }
  });
  console.log(`Created baseline Cashbox: ${mainCashbox.code} (${mainCashbox.name})`);

  // Create clean active pricing for Teacher
  const now = new Date();
  const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const pricing1 = await db.teacherGradePricing.create({
    data: {
      teacherId: 'teach_b_w4adp2',
      grade: 'SECONDARY_1',
      price: 350,
      effectiveMonth: currentMonthKey
    }
  });
  const pricing2 = await db.teacherGradePricing.create({
    data: {
      teacherId: 'teach_b_w4adp2',
      grade: 'SECONDARY_2',
      price: 400,
      effectiveMonth: currentMonthKey
    }
  });
  console.log(`Created baseline TeacherGradePricing: SEC_1=350 EGP, SEC_2=400 EGP`);

  // Take After Counts
  console.log('\n--- CAPTURING AFTER COUNTS ---');
  const after = await getCounts();
  console.log('After Counts:', after);

  console.log('\n================================================================');
  console.log('CLEANUP SUMMARY:');
  console.log(`- Users: ${before.users} -> ${after.users} (Preserved 3: admin, teacher, accountant)`);
  console.log(`- Institutions: ${before.insts} -> ${after.insts}`);
  console.log(`- Branches: ${before.branches} -> ${after.branches}`);
  console.log(`- Cashboxes: ${before.cashboxes} -> ${after.cashboxes} (1 clean active cashbox)`);
  console.log(`- Courses: ${before.courses} -> ${after.courses} (2 active published courses)`);
  console.log(`- Subscriptions / Payments: Cleaned down to 0`);
  console.log('================================================================');

  await db.$disconnect();
}

runControlledCleanup().catch(err => {
  console.error('Fatal cleanup error:', err);
  process.exit(1);
});
