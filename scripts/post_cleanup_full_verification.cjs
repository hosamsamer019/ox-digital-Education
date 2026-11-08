const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const { PrismaClient } = require(path.resolve(__dirname, '../node_modules/@prisma/client'));

const db = new PrismaClient({
  datasources: { db: { url: process.env.DATABASE_URL } }
});

async function main() {
  console.log('=======================================================');
  console.log('STEP 7: POST-CLEANUP DATA INTEGRITY & REFERENTIAL CHECK');
  console.log('=======================================================');

  // 1. Confirm Deleted Records are strictly null
  console.log('\n--- 1. Confirming Deleted Target IDs are NULL ---');
  const deletedChecks = [
    { table: 'Branch', id: '152b6c2a-e5d8-4151-b557-393cd3285632' },
    { table: 'Branch', id: 'br_idor_b_w4adp2' },
    { table: 'Institution', id: 'inst_idor_b_w4adp2' },
    { table: 'Course', id: 'crs_a_91xnz3' },
    { table: 'Course', id: 'crs_b_w4adp2' },
    { table: 'Exam', id: 'exam_a_91xnz3' },
    { table: 'Exam', id: 'exam_b_w4adp2' },
    { table: 'Homework', id: 'hw_a_91xnz3' },
    { table: 'Homework', id: 'hw_b_w4adp2' }
  ];

  for (const item of deletedChecks) {
    const res = await db[item.table.toLowerCase()].findUnique({ where: { id: item.id } });
    if (res !== null) {
      throw new Error(`Target ${item.table} (ID: ${item.id}) was NOT deleted! Found: ${JSON.stringify(res)}`);
    }
    console.log(`[PASS] ${item.table} (${item.id}): DELETED (null)`);
  }

  // 2. Confirm Preserved Records
  console.log('\n--- 2. Confirming Preserved Protected Records ---');
  const insts = await db.institution.findMany({ select: { id: true, name: true, code: true } });
  console.log('Active Institutions (2 expected):', insts);
  if (insts.length !== 2) throw new Error(`Expected 2 institutions, found ${insts.length}`);

  const branches = await db.branch.findMany({ select: { id: true, name: true, code: true, institutionId: true } });
  console.log('Active Branches (2 expected):', branches);
  if (branches.length !== 2) throw new Error(`Expected 2 branches, found ${branches.length}`);

  const users = await db.user.findMany({
    select: { id: true, email: true, name: true, role: true, isPrimaryManager: true, institutionId: true, branchId: true }
  });
  console.log('Active Users (3 expected):', users);
  if (users.length !== 3) throw new Error(`Expected 3 users, found ${users.length}`);

  const cashboxes = await db.cashbox.findMany();
  console.log('Active Cashbox (1 expected):', cashboxes);
  if (cashboxes.length !== 1) throw new Error(`Expected 1 cashbox, found ${cashboxes.length}`);

  const pricings = await db.teacherGradePricing.findMany();
  console.log('Active Pricings (2 expected):', pricings);
  if (pricings.length !== 2) throw new Error(`Expected 2 pricings, found ${pricings.length}`);

  // 3. Confirm 0 rows in Course, Exam, Homework
  const courseCount = await db.course.count();
  const examCount = await db.exam.count();
  const hwCount = await db.homework.count();
  console.log('\nAcademic Counts (all expected 0):', { courseCount, examCount, hwCount });
  if (courseCount !== 0 || examCount !== 0 || hwCount !== 0) {
    throw new Error('Course/Exam/Homework count is not 0!');
  }

  // 4. Check for Foreign Key Violations across Schema
  console.log('\n--- 3. Checking for Foreign Key Orphan Violations ---');
  // Check users pointing to non-existent institution or branch
  const orphanUsers = await db.$queryRawUnsafe(`
    SELECT u.id, u.email, u."institutionId", u."branchId"
    FROM "User" u
    LEFT JOIN "Institution" i ON u."institutionId" = i.id
    LEFT JOIN "Branch" b ON u."branchId" = b.id
    WHERE (u."institutionId" IS NOT NULL AND i.id IS NULL)
       OR (u."branchId" IS NOT NULL AND b.id IS NULL);
  `);
  console.log('Orphan Users:', orphanUsers);
  if (orphanUsers.length > 0) throw new Error('Found orphan users!');

  // Check branches pointing to non-existent institution
  const orphanBranches = await db.$queryRawUnsafe(`
    SELECT b.id, b.name, b."institutionId"
    FROM "Branch" b
    LEFT JOIN "Institution" i ON b."institutionId" = i.id
    WHERE b."institutionId" IS NOT NULL AND i.id IS NULL;
  `);
  console.log('Orphan Branches:', orphanBranches);
  if (orphanBranches.length > 0) throw new Error('Found orphan branches!');

  // Check cashbox pointing to non-existent institution or branch
  const orphanCashbox = await db.$queryRawUnsafe(`
    SELECT c.id, c."institutionId", c."branchId"
    FROM "Cashbox" c
    LEFT JOIN "Institution" i ON c."institutionId" = i.id
    LEFT JOIN "Branch" b ON c."branchId" = b.id
    WHERE (c."institutionId" IS NOT NULL AND i.id IS NULL)
       OR (c."branchId" IS NOT NULL AND b.id IS NULL);
  `);
  console.log('Orphan Cashbox:', orphanCashbox);
  if (orphanCashbox.length > 0) throw new Error('Found orphan cashbox!');

  console.log('[PASS] Zero orphan foreign keys detected.');

  // 5. Full Inventory of all 65 Tables
  console.log('\n--- 4. Full Table Count Inventory of ox_digital_dev_test ---');
  const allTables = await db.$queryRawUnsafe(`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
      AND table_type = 'BASE TABLE'
    ORDER BY table_name;
  `);

  const summary = [];
  let totalNonEmpty = 0;
  for (const t of allTables) {
    const tableName = t.table_name;
    const [{ count }] = await db.$queryRawUnsafe(`SELECT count(*) as count FROM "${tableName}";`);
    const c = parseInt(count, 10);
    summary.push({ table: tableName, count: c });
    if (c > 0) {
      totalNonEmpty++;
      console.log(`  ${tableName.padEnd(32)}: ${c}`);
    }
  }

  console.log(`\nTotal tables in public schema: ${allTables.length}`);
  console.log(`Total non-empty tables:        ${totalNonEmpty}`);
  console.log('All expected counts verified!');

  await db.$disconnect();
}

main().catch(err => {
  console.error('\n[FATAL] Post-cleanup check failed:', err);
  process.exit(1);
});

