const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const { db } = require('../packages/database/dist/index.js');

async function investigateAccounts() {
  console.log('================================================================');
  console.log('INVESTIGATION OF PRIMARY MANAGER & ADMIN ACCOUNTS');
  console.log('================================================================');

  // 1. Check account admin@edu.com
  console.log('\n--- 1. Account admin@edu.com Inspection ---');
  const adminAccount = await db.user.findFirst({
    where: { email: { equals: 'admin@edu.com', mode: 'insensitive' } },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      isPrimaryManager: true,
      institutionId: true,
      branchId: true,
      deletedAt: true,
      mustChangePassword: true,
      createdAt: true
    }
  });

  if (adminAccount) {
    console.log('  admin@edu.com found:');
    console.log(`    ID: ${adminAccount.id}`);
    console.log(`    Name: ${adminAccount.name}`);
    console.log(`    Email (exact in DB): ${adminAccount.email}`);
    console.log(`    Role: ${adminAccount.role}`);
    console.log(`    isPrimaryManager flag: ${adminAccount.isPrimaryManager}`);
    console.log(`    Institution ID: ${adminAccount.institutionId}`);
    console.log(`    Branch ID: ${adminAccount.branchId}`);
    console.log(`    Deleted At: ${adminAccount.deletedAt ? adminAccount.deletedAt : 'ACTIVE (null)'}`);
    console.log(`    Must Change Password: ${adminAccount.mustChangePassword}`);
    console.log(`    Created At: ${adminAccount.createdAt}`);
  } else {
    console.log('  admin@edu.com NOT found in database.');
  }

  // 2. Query all accounts with role PRIMARY_MANAGER
  console.log('\n--- 2. All PRIMARY_MANAGER Role Accounts ---');
  const managers = await db.user.findMany({
    where: { role: 'PRIMARY_MANAGER' },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      isPrimaryManager: true,
      institutionId: true,
      branchId: true,
      deletedAt: true,
      mustChangePassword: true,
      createdAt: true
    },
    orderBy: { createdAt: 'asc' }
  });

  console.log(`  Total PRIMARY_MANAGER accounts found: ${managers.length}`);
  managers.forEach((m, i) => {
    console.log(`  [${i + 1}] ID: ${m.id}`);
    console.log(`      Name: ${m.name}`);
    console.log(`      Email: ${m.email}`);
    console.log(`      Role: ${m.role}`);
    console.log(`      isPrimaryManager: ${m.isPrimaryManager}`);
    console.log(`      Institution ID: ${m.institutionId}`);
    console.log(`      Deleted At: ${m.deletedAt ? m.deletedAt : 'ACTIVE (null)'}`);
    console.log(`      Must Change Password: ${m.mustChangePassword}`);
    console.log(`      Created At: ${m.createdAt}`);
  });

  // 3. Query all Institutions and their linked Primary Managers
  console.log('\n--- 3. Institutions & Linked Primary Managers ---');
  const institutions = await db.institution.findMany({
    select: {
      id: true,
      name: true,
      code: true,
      status: true,
      primaryManagerId: true,
      primaryManager: {
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          isPrimaryManager: true,
          deletedAt: true
        }
      }
    }
  });

  institutions.forEach((inst, i) => {
    console.log(`  [${i + 1}] Institution: ${inst.name} (Code: ${inst.code}, Status: ${inst.status})`);
    console.log(`      ID: ${inst.id}`);
    console.log(`      primaryManagerId field: ${inst.primaryManagerId || 'NULL'}`);
    if (inst.primaryManager) {
      console.log(`      Linked User Name: ${inst.primaryManager.name}`);
      console.log(`      Linked User Email: ${inst.primaryManager.email}`);
      console.log(`      Linked User Role: ${inst.primaryManager.role}`);
      console.log(`      Linked User isPrimaryManager: ${inst.primaryManager.isPrimaryManager}`);
      console.log(`      Linked User Status: ${inst.primaryManager.deletedAt ? 'DELETED' : 'ACTIVE'}`);
    } else {
      console.log('      Linked User: None');
    }
  });

  // 4. Query any users having isPrimaryManager = true regardless of role
  console.log('\n--- 4. Users with isPrimaryManager = true ---');
  const flagUsers = await db.user.findMany({
    where: { isPrimaryManager: true },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      isPrimaryManager: true,
      institutionId: true,
      deletedAt: true,
      createdAt: true
    }
  });
  console.log(`  Total users with isPrimaryManager = true: ${flagUsers.length}`);
  flagUsers.forEach((u, i) => {
    console.log(`  [${i + 1}] ID: ${u.id} | Email: ${u.email} | Role: ${u.role} | Institution: ${u.institutionId}`);
  });

  // 5. Query all ADMIN role accounts
  console.log('\n--- 5. All ADMIN Role Accounts ---');
  const admins = await db.user.findMany({
    where: { role: 'ADMIN' },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      isPrimaryManager: true,
      institutionId: true,
      deletedAt: true,
      createdAt: true
    }
  });
  console.log(`  Total ADMIN accounts found: ${admins.length}`);
  admins.forEach((a, i) => {
    console.log(`  [${i + 1}] ID: ${a.id} | Email: ${a.email} | Role: ${a.role} | Institution: ${a.institutionId}`);
  });

  await db.$disconnect();
  console.log('\n================================================================');
  console.log('INVESTIGATION COMPLETE');
  console.log('================================================================');
}

investigateAccounts().catch(e => {
  console.error('Fatal error during investigation:', e);
  process.exit(1);
});

