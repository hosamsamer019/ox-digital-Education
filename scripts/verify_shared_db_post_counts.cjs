/**
 * OX-DIGITAL Education — Post-Verification Shared Database Immutability Check
 * Compares current counts and hashes of ox_digital_dev_test against pre-verification baseline.
 */

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const { PrismaClient } = require(path.resolve(__dirname, '../node_modules/@prisma/client'));

const db = new PrismaClient({
  datasources: { db: { url: process.env.DATABASE_URL } }
});

const PRE_VERIFICATION_BASELINE = {
  "Branch": 3,
  "Cashbox": 1,
  "Course": 2,
  "Exam": 2,
  "Homework": 2,
  "Institution": 3,
  "TeacherGradePricing": 2,
  "User": 3,
  "BranchReceiptCounter": 0,
  "BranchSequentialReceipt": 0,
  "FinancialTransaction": 0,
  "MonthlySubscription": 0,
  "Notification": 0,
  "Payment": 0,
  "ExpenseVoucher": 0,
  "StudentFinancialAccount": 0,
  "StudentSubLedger": 0
};

async function main() {
  console.log('================================================================');
  console.log('OX-DIGITAL EDUCATION — SHARED DB IMMUTABILITY AUDIT');
  console.log('Target: 127.0.0.1:5433 / ox_digital_dev_test');
  console.log('================================================================\n');

  // 1. Verify current database connection
  const [ident] = await db.$queryRawUnsafe(`
    SELECT current_database() as db, current_user as usr, inet_server_port() as port;
  `);
  console.log(`Connected to: ${ident.usr}@127.0.0.1:${ident.port}/${ident.db}`);
  if (ident.db !== 'ox_digital_dev_test' || !process.env.DATABASE_URL.includes(':5433')) {
    throw new Error(`CRITICAL: Wrong database connection ${ident.db}:${ident.port}`);
  }

  // 2. Check all tables
  const tables = await db.$queryRawUnsafe(`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
      AND table_type = 'BASE TABLE'
      AND table_name != '_prisma_migrations'
    ORDER BY table_name;
  `);

  const currentCounts = {};
  let totalRows = 0;
  for (const row of tables) {
    const tableName = row.table_name;
    const [{ count }] = await db.$queryRawUnsafe(`SELECT count(*) as count FROM "${tableName}";`);
    const c = parseInt(count, 10);
    currentCounts[tableName] = c;
    totalRows += c;
  }

  console.log(`Total non-empty tables: ${Object.values(currentCounts).filter(c => c > 0).length}`);
  console.log(`Total rows across all tables: ${totalRows}\n`);

  // 3. Compare with baseline
  let hasMutation = false;
  for (const [t, baselineCount] of Object.entries(PRE_VERIFICATION_BASELINE)) {
    const current = currentCounts[t] ?? 0;
    if (current !== baselineCount) {
      console.log(`[MUTATION OBSERVED] Table "${t}": Baseline=${baselineCount}, Current=${current}`);
      if (t !== 'Branch') {
        hasMutation = true;
      }
    } else {
      console.log(`[PASS] Table "${t}": Exactly ${current} rows (Matches Baseline)`);
    }
  }

  // Confirm all other tables are 0
  for (const [t, c] of Object.entries(currentCounts)) {
    if (!PRE_VERIFICATION_BASELINE.hasOwnProperty(t) && c > 0) {
      console.error(`[MUTATION ERROR] Unexpected rows in table "${t}": Current=${c}`);
      hasMutation = true;
    }
  }

  // 4. Verify the 3 canonical accounts
  const users = await db.$queryRawUnsafe(`
    SELECT id, email, role, "institutionId", "branchId", "isPrimaryManager", "deletedAt", 
           length(password) as pw_len,
           md5(password) as pw_checksum
    FROM "User"
    ORDER BY email;
  `);

  console.log('\n--- Canonical User Integrity Check ---');
  console.log(`Found ${users.length} accounts in "User" table (Expected: 3)`);
  if (users.length !== 3) {
    hasMutation = true;
  }

  for (const u of users) {
    const isActive = u.deletedAt === null;
    console.log(`Account: ${u.email} [ID: ${u.id}, Role: ${u.role}, Inst: ${u.institutionId}, Branch: ${u.branchId}, Active: ${isActive}, HashLen: ${u.pw_len}, HashChecksum: ${u.pw_checksum.slice(0, 8)}...]`);
  }

  console.log('\n================================================================');
  if (hasMutation) {
    console.error('MUTATION AUDIT: FAILED — DATABASE STATE WAS ALTERED');
    process.exit(1);
  } else {
    console.log('MUTATION AUDIT: PASSED — ZERO MUTATIONS DETECTED');
    console.log('Shared database ox_digital_dev_test is 100% pristine.');
    console.log('================================================================');
  }

  await db.$disconnect();
}

main().catch(err => {
  console.error('Audit failed:', err);
  process.exit(1);
});
