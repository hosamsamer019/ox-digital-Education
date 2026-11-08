/**
 * OX-DIGITAL Education — Prepare Synthetic Data Cleanup Manifest
 * Database Target: ox_digital_dev_test (port 5433)
 */

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const { PrismaClient } = require(path.resolve(__dirname, '../node_modules/@prisma/client'));

const db = new PrismaClient({
  datasources: { db: { url: process.env.DATABASE_URL } }
});

async function main() {
  console.log('=== ANALYZING ox_digital_dev_test FOR SYNTHETIC DATA CLEANUP ===\n');

  // 1. Verify DB identity
  const [ident] = await db.$queryRawUnsafe(
    'SELECT current_database() as db, current_user as usr, inet_server_port() as port;'
  );
  console.log(`Connected to: ${ident.usr} on DB: ${ident.db} (port ${ident.port})`);
  if (ident.db !== 'ox_digital_dev_test') {
    throw new Error('Not connected to ox_digital_dev_test');
  }

  // 2. Canonical accounts to preserve
  const CANONICAL_EMAILS = [
    'admin@edu.com',
    'teacher@gmail.com',
    'acount@gmail.com'
  ];

  const preservedUsers = await db.user.findMany({
    where: { email: { in: CANONICAL_EMAILS } },
    include: {
      institution: true,
      branch: true
    }
  });

  console.log('\n--- PRESERVED CANONICAL USERS ---');
  preservedUsers.forEach(u => {
    console.log(`- ID: ${u.id} | Email: ${u.email} | Role: ${u.role} | Institution: ${u.institutionId} (${u.institution?.name}) | Branch: ${u.branchId} (${u.branch?.name}) | PrimaryMgr: ${u.isPrimaryManager}`);
  });

  const preservedUserIds = preservedUsers.map(u => u.id);
  const preservedInstIds = [...new Set(preservedUsers.map(u => u.institutionId).filter(Boolean))];
  const preservedBranchIds = [...new Set(preservedUsers.map(u => u.branchId).filter(Boolean))];

  console.log('\nPreserved Institution IDs:', preservedInstIds);
  console.log('Preserved Branch IDs:', preservedBranchIds);

  // 3. Classify all users
  const allUsers = await db.user.findMany({
    select: { id: true, email: true, role: true, institutionId: true, branchId: true }
  });

  const usersToDelete = allUsers.filter(u => !preservedUserIds.includes(u.id));
  console.log(`\nTotal Users: ${allUsers.length}`);
  console.log(`Preserved Users: ${preservedUsers.length}`);
  console.log(`Users to Delete: ${usersToDelete.length}`);

  // Breakdown of users to delete by role
  const roleCounts = {};
  usersToDelete.forEach(u => {
    roleCounts[u.role] = (roleCounts[u.role] || 0) + 1;
  });
  console.log('Users to delete by role:', roleCounts);

  // 4. Classify Institutions and Branches
  const allInstitutions = await db.institution.findMany();
  const instToDelete = allInstitutions.filter(i => !preservedInstIds.includes(i.id));
  console.log(`\nTotal Institutions: ${allInstitutions.length}`);
  console.log(`Preserved Institutions: ${preservedInstIds.length}`);
  console.log(`Institutions to Delete: ${instToDelete.length}`);

  const allBranches = await db.branch.findMany();
  const branchesToDelete = allBranches.filter(b => !preservedBranchIds.includes(b.id));
  console.log(`\nTotal Branches: ${allBranches.length}`);
  console.log(`Preserved Branches: ${preservedBranchIds.length}`);
  console.log(`Branches to Delete: ${branchesToDelete.length}`);

  // 5. Dependent record counts for records linked to usersToDelete
  const delUserIds = usersToDelete.map(u => u.id);
  const delBranchIds = branchesToDelete.map(b => b.id);
  const delInstIds = instToDelete.map(i => i.id);

  const studentTeacherCount = await db.studentTeacher.count({
    where: { OR: [{ studentId: { in: delUserIds } }, { teacherId: { in: delUserIds } }] }
  });

  const subCount = await db.studentMonthlySubscription.count({
    where: { OR: [{ studentId: { in: delUserIds } }, { teacherId: { in: delUserIds } }, { branchId: { in: delBranchIds } }] }
  });

  const obligationsCount = await db.studentObligation.count({
    where: { studentId: { in: delUserIds } }
  });

  const receiptsCount = await db.branchSequentialReceipt.count({
    where: { OR: [{ studentId: { in: delUserIds } }, { teacherId: { in: delUserIds } }, { branchId: { in: delBranchIds } }] }
  });

  const paymentsCount = await db.subscriptionPayment.count({
    where: { OR: [{ studentId: { in: delUserIds } }, { branchId: { in: delBranchIds } }] }
  });

  const notificationsCount = await db.notification.count({
    where: { userId: { in: delUserIds } }
  });

  const auditLogsCount = await db.studentAuditLog.count({
    where: { OR: [{ studentId: { in: delUserIds } }, { actorId: { in: delUserIds } }] }
  });

  console.log('\n--- ASSOCIATED SYNTHETIC RECORDS TO PURGE ---');
  console.log(`StudentTeacher relations: ${studentTeacherCount}`);
  console.log(`StudentMonthlySubscription: ${subCount}`);
  console.log(`StudentObligation: ${obligationsCount}`);
  console.log(`BranchSequentialReceipt: ${receiptsCount}`);
  console.log(`SubscriptionPayment: ${paymentsCount}`);
  console.log(`Notification: ${notificationsCount}`);
  console.log(`StudentAuditLog: ${auditLogsCount}`);

  await db.$disconnect();
}

main().catch(err => {
  console.error('Manifest analysis failed:', err);
  process.exit(1);
});

