const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const { db } = require('../packages/database/dist/index.js');

async function auditDatabaseIntegrity() {
  console.log('================================================================');
  console.log('DATABASE AND ACCOUNT RELATIONSHIP INTEGRITY AUDIT');
  console.log('================================================================');

  // 1. User Roles Distribution
  const roleDistribution = await db.user.groupBy({
    by: ['role'],
    _count: { id: true }
  });
  console.log('\n--- 1. User Role Distribution ---');
  for (const r of roleDistribution) {
    console.log(`  Role: ${r.role.padEnd(18)} Count: ${r._count.id}`);
  }

  // 2. Foreign-Key and Relationship Integrity
  console.log('\n--- 2. Relational Integrity Checks ---');

  // A. Orphaned responsibleTeacherId
  const orphanedTeacherRefs = await db.$queryRawUnsafe(`
    SELECT count(*)::int as count 
    FROM "User" 
    WHERE "responsibleTeacherId" IS NOT NULL 
      AND "responsibleTeacherId" NOT IN (SELECT id FROM "User" WHERE role = 'TEACHER');
  `);
  console.log(`  Orphaned responsibleTeacherId references: ${orphanedTeacherRefs[0].count} (Expected: 0)`);

  // B. Orphaned StudentTeacher links
  const orphanedStudentTeacher = await db.$queryRawUnsafe(`
    SELECT count(*)::int as count 
    FROM "StudentTeacher" 
    WHERE "studentId" NOT IN (SELECT id FROM "User")
       OR "teacherId" NOT IN (SELECT id FROM "User");
  `);
  console.log(`  Orphaned StudentTeacher links: ${orphanedStudentTeacher[0].count} (Expected: 0)`);

  // C. Orphaned parentId on students
  const orphanedParentRefs = await db.$queryRawUnsafe(`
    SELECT count(*)::int as count 
    FROM "User" 
    WHERE "parentId" IS NOT NULL 
      AND "parentId" NOT IN (SELECT id FROM "User" WHERE role = 'PARENT');
  `);
  console.log(`  Orphaned parentId on students: ${orphanedParentRefs[0].count} (Expected: 0)`);

  // D. Teachers with invalid branchId
  const invalidTeacherBranch = await db.$queryRawUnsafe(`
    SELECT count(*)::int as count 
    FROM "User" 
    WHERE role = 'TEACHER' 
      AND "branchId" IS NOT NULL 
      AND "branchId" NOT IN (SELECT id FROM "Branch");
  `);
  console.log(`  Teachers with invalid branchId: ${invalidTeacherBranch[0].count} (Expected: 0)`);

  // E. Accountants without valid branchId
  const accountantsWithoutBranch = await db.$queryRawUnsafe(`
    SELECT count(*)::int as count 
    FROM "User" 
    WHERE role = 'ACCOUNTANT' 
      AND ("branchId" IS NULL OR "branchId" NOT IN (SELECT id FROM "Branch"));
  `);
  console.log(`  Accountants without valid branchId: ${accountantsWithoutBranch[0].count} (Expected: 0)`);

  // F. Orphaned SubscriptionPaymentItem
  const orphanedPaymentItems = await db.$queryRawUnsafe(`
    SELECT count(*)::int as count 
    FROM "SubscriptionPaymentItem" 
    WHERE "paymentId" NOT IN (SELECT id FROM "SubscriptionPayment")
       OR "subscriptionId" NOT IN (SELECT id FROM "StudentMonthlySubscription");
  `);
  console.log(`  Orphaned SubscriptionPaymentItem: ${orphanedPaymentItems[0].count} (Expected: 0)`);

  // G. Orphaned BranchSequentialReceipt
  const orphanedReceipts = await db.$queryRawUnsafe(`
    SELECT count(*)::int as count 
    FROM "BranchSequentialReceipt" 
    WHERE "paymentId" NOT IN (SELECT id FROM "SubscriptionPayment")
       OR "branchId" NOT IN (SELECT id FROM "Branch");
  `);
  console.log(`  Orphaned BranchSequentialReceipt: ${orphanedReceipts[0].count} (Expected: 0)`);

  // 3. Duplicate or Conflicting Ownerships
  console.log('\n--- 3. Duplicate Ownership Checks ---');
  const duplicateOwnership = await db.$queryRawUnsafe(`
    SELECT "studentId", "teacherId", count(*)::int as count 
    FROM "StudentTeacher" 
    GROUP BY "studentId", "teacherId" 
    HAVING count(*) > 1;
  `);
  console.log(`  Duplicate (studentId, teacherId) links: ${duplicateOwnership.length} (Expected: 0)`);

  const duplicateSubscriptions = await db.$queryRawUnsafe(`
    SELECT "studentId", "teacherId", "billingYear", "billingMonth", count(*)::int as count 
    FROM "StudentMonthlySubscription" 
    GROUP BY "studentId", "teacherId", "billingYear", "billingMonth" 
    HAVING count(*) > 1;
  `);
  console.log(`  Duplicate monthly subscription slots: ${duplicateSubscriptions.length} (Expected: 0)`);

  // 4. Unresolved Student Ownership Analysis
  console.log('\n--- 4. Unresolved Student Ownership Analysis ---');
  const totalStudents = await db.user.count({
    where: { role: { in: ['CENTER_STUDENT', 'ONLINE_STUDENT'] } }
  });
  const unresolvedStudents = await db.user.findMany({
    where: {
      role: { in: ['CENTER_STUDENT', 'ONLINE_STUDENT'] },
      responsibleTeacherId: null
    },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      createdAt: true,
      branchId: true
    }
  });

  const resolvedStudents = totalStudents - unresolvedStudents.length;
  console.log(`  Total Students in DB: ${totalStudents}`);
  console.log(`  Resolved Students (responsibleTeacherId != null): ${resolvedStudents}`);
  console.log(`  Unresolved Students (responsibleTeacherId == null): ${unresolvedStudents.length}`);

  // Count how many of unresolved are legacy (created before today's realignment date 2026-11-06)
  const legacyCutoff = new Date('2026-11-06T00:00:00Z');
  const legacyUnresolved = unresolvedStudents.filter(s => new Date(s.createdAt) < legacyCutoff);
  const newUnresolved = unresolvedStudents.filter(s => new Date(s.createdAt) >= legacyCutoff);
  console.log(`  Legacy Unresolved Students: ${legacyUnresolved.length}`);
  console.log(`  Newly Created Unresolved Test Students: ${newUnresolved.length}`);

  // 5. Active Branches and Primary Manager Check
  console.log('\n--- 5. Primary Manager and Institution Check ---');
  const institutions = await db.institution.findMany({
    include: {
      primaryManager: { select: { id: true, name: true, email: true, role: true } },
      branches: { select: { id: true, name: true, code: true, status: true } }
    }
  });
  for (const inst of institutions) {
    console.log(`  Institution: ${inst.name} (${inst.code})`);
    console.log(`    Primary Manager: ${inst.primaryManager ? `${inst.primaryManager.name} (${inst.primaryManager.role})` : 'NONE'}`);
    console.log(`    Active Branches Count: ${inst.branches.length}`);
  }

  await db.$disconnect();
  console.log('\n================================================================');
  console.log('AUDIT COMPLETE');
  console.log('================================================================');
}

auditDatabaseIntegrity().catch(err => {
  console.error('Fatal audit error:', err);
  process.exit(1);
});
