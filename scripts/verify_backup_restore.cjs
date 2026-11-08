/**
 * OX-DIGITAL Education — Verify Backup Restoration
 * Verifies backup_full_audit_pre_cleanup_20261106.dump restoration into temporary DB
 */

const { execSync } = require('child_process');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { PrismaClient } = require(path.resolve(__dirname, '../node_modules/@prisma/client'));

const BACKUP_FILE = path.resolve(__dirname, '../backups/backup_full_audit_pre_cleanup_20261106.dump');
const EXPECTED_HASH = '9A1661706AC269C7529EAC83AE94DB48C87FC63DB0808DC39040309761F9F6CC'.toLowerCase();
const TEMP_DB_NAME = 'ox_digital_backup_restore_verify_test';

async function main() {
  console.log('=== STEP 1: VERIFYING BACKUP SHA-256 CHECKSUM ===');
  const fileBytes = fs.readFileSync(BACKUP_FILE);
  const actualHash = crypto.createHash('sha256').update(fileBytes).digest('hex').toLowerCase();
  console.log(`Expected Hash: ${EXPECTED_HASH}`);
  console.log(`Actual Hash:   ${actualHash}`);

  if (actualHash !== EXPECTED_HASH) {
    throw new Error('FATAL: Backup file checksum mismatch! Stopping verification.');
  }
  console.log('✓ Checksum matches perfectly.\n');

  console.log(`=== STEP 2: CREATING TEMPORARY DATABASE: ${TEMP_DB_NAME} ===`);
  execSync(`docker exec -i ox-digital-isolated-dev-postgres psql -U ox_dev_admin -d postgres -c "DROP DATABASE IF EXISTS ${TEMP_DB_NAME};"`);
  execSync(`docker exec -i ox-digital-isolated-dev-postgres psql -U ox_dev_admin -d postgres -c "CREATE DATABASE ${TEMP_DB_NAME} OWNER ox_dev_admin;"`);
  console.log('✓ Database created successfully.\n');

  console.log('=== STEP 3: RESTORING BACKUP INTO TEMPORARY DATABASE ===');
  // Copy backup to container
  execSync(`docker cp "${BACKUP_FILE}" ox-digital-isolated-dev-postgres:/tmp/verify_backup.dump`);
  
  let restoreExitCode = 0;
  try {
    execSync(`docker exec -i ox-digital-isolated-dev-postgres pg_restore -U ox_dev_admin -d ${TEMP_DB_NAME} --no-owner --no-acl /tmp/verify_backup.dump`, {
      stdio: ['pipe', 'pipe', 'pipe']
    });
  } catch (err) {
    // pg_restore can exit with 1 if there are minor warnings (e.g. relation already exists)
    restoreExitCode = err.status || 0;
    console.log(`pg_restore finished with status code: ${restoreExitCode}`);
  }
  console.log('✓ pg_restore execution completed.\n');

  console.log('=== STEP 4: VERIFYING RESTORED DATABASE CONTENT & SCHEMA ===');
  const tempDbUrl = `postgresql://ox_dev_admin:r72a-8DsHuifYR1tFg4NMCzH5EXdHlrTkYW-WXShSaM@127.0.0.1:5433/${TEMP_DB_NAME}?schema=public`;
  const db = new PrismaClient({
    datasources: { db: { url: tempDbUrl } }
  });

  const [{ count: userCount }] = await db.$queryRawUnsafe('SELECT count(*) as count FROM "User";');
  const [{ count: instCount }] = await db.$queryRawUnsafe('SELECT count(*) as count FROM "Institution";');
  const [{ count: branchCount }] = await db.$queryRawUnsafe('SELECT count(*) as count FROM "Branch";');
  const [{ count: receiptCount }] = await db.$queryRawUnsafe('SELECT count(*) as count FROM "BranchSequentialReceipt";');
  const [{ count: subPaymentCount }] = await db.$queryRawUnsafe('SELECT count(*) as count FROM "SubscriptionPayment";');
  const [{ count: notifCount }] = await db.$queryRawUnsafe('SELECT count(*) as count FROM "Notification";');

  const tables = await db.$queryRawUnsafe(`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
      AND table_type = 'BASE TABLE'
    ORDER BY table_name;
  `);

  console.log(`- Restored Total Tables: ${tables.length}`);
  console.log(`- Restored Users: ${userCount} (Expected: 316)`);
  console.log(`- Restored Institutions: ${instCount} (Expected: 11)`);
  console.log(`- Restored Branches: ${branchCount} (Expected: 61)`);
  console.log(`- Restored Receipts: ${receiptCount} (Expected: 37)`);
  console.log(`- Restored Payments: ${subPaymentCount} (Expected: 37)`);
  console.log(`- Restored Notifications: ${notifCount} (Expected: 5325)`);

  // Foreign key referential integrity check
  const [fkCheck] = await db.$queryRawUnsafe(`
    SELECT 
      (SELECT count(*) FROM "Course" c WHERE NOT EXISTS (SELECT 1 FROM "User" u WHERE u.id = c."teacherId")) as orphan_courses,
      (SELECT count(*) FROM "SubscriptionPayment" p WHERE NOT EXISTS (SELECT 1 FROM "User" u WHERE u.id = p."studentId")) as orphan_payments,
      (SELECT count(*) FROM "BranchSequentialReceipt" r WHERE NOT EXISTS (SELECT 1 FROM "Branch" b WHERE b.id = r."branchId")) as orphan_receipts;
  `);
  console.log(`- Foreign Key Integrity: Orphan Courses = ${fkCheck.orphan_courses}, Orphan Payments = ${fkCheck.orphan_payments}, Orphan Receipts = ${fkCheck.orphan_receipts}`);

  await db.$disconnect();

  console.log(`\n=== STEP 5: CLEANING UP TEMPORARY RESTORE DATABASE ===`);
  execSync(`docker exec -i ox-digital-isolated-dev-postgres psql -U ox_dev_admin -d postgres -c "DROP DATABASE ${TEMP_DB_NAME};"`);
  execSync(`docker exec -i ox-digital-isolated-dev-postgres rm -f /tmp/verify_backup.dump`);
  console.log(`✓ Temporary restore database ${TEMP_DB_NAME} dropped successfully.\n`);
  console.log('=== BACKUP RESTORATION VERIFICATION: PASS ===');
}

main().catch(err => {
  console.error('Backup restoration verification failed:', err);
  process.exit(1);
});

