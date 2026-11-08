/**
 * Verify pre-patch backup restoration into temporary database
 */
const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const { PrismaClient } = require(path.resolve(__dirname, '../node_modules/@prisma/client'));

const BACKUP_PATH = path.resolve(__dirname, '../backups/backup_remediation_pre_patch_20261106.dump');
const EXPECTED_HASH = "01B807F9F1647CDC9EFE1756959AC8A4F6F853699560A2A1B5150DD6252E8111";
const TEMP_DB = "ox_digital_backup_verify_test";

async function main() {
  console.log('--- 1. SHA-256 Verification ---');
  const fileBytes = fs.readFileSync(BACKUP_PATH);
  const actualHash = crypto.createHash('sha256').update(fileBytes).digest('hex').toUpperCase();
  console.log(`Calculated: ${actualHash}`);
  console.log(`Expected:   ${EXPECTED_HASH}`);
  if (actualHash !== EXPECTED_HASH) {
    throw new Error('SHA-256 hash mismatch!');
  }
  console.log('[PASS] Backup file hash matches exactly.\n');

  console.log('--- 2. Create Temporary Test Database ---');
  execSync(`docker exec ox-digital-isolated-dev-postgres dropdb -U ox_dev_admin --if-exists ${TEMP_DB}`, { stdio: 'inherit' });
  execSync(`docker exec ox-digital-isolated-dev-postgres createdb -U ox_dev_admin ${TEMP_DB}`, { stdio: 'inherit' });
  console.log('[PASS] Temporary database created.\n');

  console.log('--- 3. Restore Backup Archive ---');
  // Copy dump to container and restore
  execSync(`docker cp "${BACKUP_PATH}" ox-digital-isolated-dev-postgres:/tmp/test_backup.dump`, { stdio: 'inherit' });
  execSync(`docker exec ox-digital-isolated-dev-postgres pg_restore -U ox_dev_admin -d ${TEMP_DB} --clean --if-exists -O -x /tmp/test_backup.dump`, { stdio: 'inherit' });
  execSync(`docker exec ox-digital-isolated-dev-postgres rm -f /tmp/test_backup.dump`, { stdio: 'inherit' });
  console.log('[PASS] Restore completed.\n');

  console.log('--- 4. Verify Restored Data ---');
  const tempUrl = process.env.DATABASE_URL.replace(/\/[^/?]+(\?.*)?$/, `/${TEMP_DB}$1`);
  const db = new PrismaClient({ datasources: { db: { url: tempUrl } } });

  const [{ userCount }] = await db.$queryRawUnsafe(`SELECT count(*) as "userCount" FROM "User";`);
  const [{ branchCount }] = await db.$queryRawUnsafe(`SELECT count(*) as "branchCount" FROM "Branch";`);
  const [{ instCount }] = await db.$queryRawUnsafe(`SELECT count(*) as "instCount" FROM "Institution";`);
  const [{ cashboxCount }] = await db.$queryRawUnsafe(`SELECT count(*) as "cashboxCount" FROM "Cashbox";`);

  console.log(`Restored User count:        ${userCount} (Expected: 3)`);
  console.log(`Restored Branch count:      ${branchCount} (Expected: 4)`);
  console.log(`Restored Institution count: ${instCount} (Expected: 3)`);
  console.log(`Restored Cashbox count:     ${cashboxCount} (Expected: 1)`);

  if (parseInt(userCount) !== 3 || parseInt(branchCount) !== 4) {
    throw new Error('Restored counts do not match expected!');
  }

  // Check the manual branch exists
  const testBranch = await db.$queryRawUnsafe(`SELECT name, code FROM "Branch" WHERE name = 'اختبار';`);
  console.log('Manual branch verified in restore:', testBranch);
  if (testBranch.length !== 1) {
    throw new Error('Manual branch not found in restored backup!');
  }

  await db.$disconnect();
  console.log('[PASS] Restored database integrity verified.\n');

  console.log('--- 5. Clean up Temporary Database ---');
  execSync(`docker exec ox-digital-isolated-dev-postgres dropdb -U ox_dev_admin ${TEMP_DB}`, { stdio: 'inherit' });
  console.log('[PASS] Temporary database cleanly dropped.\n');
  console.log('>>> BACKUP IS RELIABLE AND VERIFIED. SAFE TO PROCEED <<<');
}

main().catch(err => {
  console.error('Backup verification failed:', err);
  process.exit(1);
});
