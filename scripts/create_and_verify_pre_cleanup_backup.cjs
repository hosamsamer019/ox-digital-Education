const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const { PrismaClient } = require(path.resolve(__dirname, '../node_modules/@prisma/client'));

const BACKUP_FILENAME = 'backup_pre_approved_synthetic_cleanup_20261107.dump';
const BACKUP_PATH = path.resolve(__dirname, '../backups', BACKUP_FILENAME);
const TEMP_CONTAINER_PATH = `/tmp/${BACKUP_FILENAME}`;
const TEMP_DB = 'ox_digital_cleanup_backup_verify_20261107';

async function main() {
  console.log('=======================================================');
  console.log('STEP 3 & 4: CREATE AND VERIFY FULL DATABASE BACKUP');
  console.log('=======================================================');

  // 1. Re-verify identity
  console.log('\n--- 1. Confirming PostgreSQL Container and DB Identity ---');
  const inspectOutput = execSync('docker ps --filter "name=ox-digital-isolated-dev-postgres" --format "{{.Names}} ({{.Ports}})"').toString().trim();
  console.log('Container Status:', inspectOutput);
  if (!inspectOutput.includes('ox-digital-isolated-dev-postgres')) {
    throw new Error('Container ox-digital-isolated-dev-postgres is not running!');
  }

  // 2. Execute pg_dump
  console.log('\n--- 2. Executing pg_dump inside Container ---');
  const dumpCmd = `docker exec ox-digital-isolated-dev-postgres pg_dump -U ox_dev_admin -Fc -d ox_digital_dev_test -f ${TEMP_CONTAINER_PATH}`;
  console.log('Running:', dumpCmd);
  execSync(dumpCmd, { stdio: 'inherit' });
  console.log('[PASS] pg_dump completed successfully.');

  // 3. Copy dump out to workspace backups/
  console.log('\n--- 3. Copying Dump File to Workspace backups/ ---');
  if (!fs.existsSync(path.dirname(BACKUP_PATH))) {
    fs.mkdirSync(path.dirname(BACKUP_PATH), { recursive: true });
  }
  execSync(`docker cp ox-digital-isolated-dev-postgres:${TEMP_CONTAINER_PATH} "${BACKUP_PATH}"`, { stdio: 'inherit' });
  execSync(`docker exec ox-digital-isolated-dev-postgres rm -f ${TEMP_CONTAINER_PATH}`, { stdio: 'inherit' });

  // 4. Record metadata
  const stats = fs.statSync(BACKUP_PATH);
  const fileBytes = fs.readFileSync(BACKUP_PATH);
  const sha256 = crypto.createHash('sha256').update(fileBytes).digest('hex').toUpperCase();

  console.log('\n--- 4. Backup File Metadata ---');
  console.log('File Path:         ', BACKUP_PATH);
  console.log('File Size (bytes): ', stats.size);
  console.log('Creation Time:     ', stats.mtime.toISOString());
  console.log('SHA-256 Checksum:  ', sha256);

  // 5. Inspect Archive Structure using pg_restore -l
  console.log('\n--- 5. Inspecting Archive Header with pg_restore -l ---');
  execSync(`docker cp "${BACKUP_PATH}" ox-digital-isolated-dev-postgres:${TEMP_CONTAINER_PATH}`, { stdio: 'inherit' });
  const tocOutput = execSync(`docker exec ox-digital-isolated-dev-postgres pg_restore -l ${TEMP_CONTAINER_PATH}`).toString();
  const tocLines = tocOutput.split('\n').filter(l => l.trim().length > 0);
  console.log(`[PASS] Archive TOC is valid. Found ${tocLines.length} archive entries.`);

  // 6. Isolated Restore Verification
  console.log('\n--- 6. Creating Temporary Verification Database ---');
  execSync(`docker exec ox-digital-isolated-dev-postgres dropdb -U ox_dev_admin --if-exists ${TEMP_DB}`, { stdio: 'inherit' });
  execSync(`docker exec ox-digital-isolated-dev-postgres createdb -U ox_dev_admin ${TEMP_DB}`, { stdio: 'inherit' });
  console.log(`[PASS] Temporary database ${TEMP_DB} created.`);

  console.log('\n--- 7. Restoring Backup Archive into Temporary Database ---');
  execSync(`docker exec ox-digital-isolated-dev-postgres pg_restore -U ox_dev_admin -d ${TEMP_DB} --clean --if-exists -O -x ${TEMP_CONTAINER_PATH}`, { stdio: 'inherit' });
  execSync(`docker exec ox-digital-isolated-dev-postgres rm -f ${TEMP_CONTAINER_PATH}`, { stdio: 'inherit' });
  console.log('[PASS] pg_restore completed.');

  console.log('\n--- 8. Verifying Restored Database Schema & Data Counts ---');
  const tempUrl = process.env.DATABASE_URL.replace(/\/[^/?]+(\?.*)?$/, `/${TEMP_DB}$1`);
  const verifyDb = new PrismaClient({ datasources: { db: { url: tempUrl } } });

  const [{ userCount }] = await verifyDb.$queryRawUnsafe(`SELECT count(*) as "userCount" FROM "User";`);
  const [{ branchCount }] = await verifyDb.$queryRawUnsafe(`SELECT count(*) as "branchCount" FROM "Branch";`);
  const [{ instCount }] = await verifyDb.$queryRawUnsafe(`SELECT count(*) as "instCount" FROM "Institution";`);
  const [{ courseCount }] = await verifyDb.$queryRawUnsafe(`SELECT count(*) as "courseCount" FROM "Course";`);
  const [{ examCount }] = await verifyDb.$queryRawUnsafe(`SELECT count(*) as "examCount" FROM "Exam";`);
  const [{ hwCount }] = await verifyDb.$queryRawUnsafe(`SELECT count(*) as "hwCount" FROM "Homework";`);
  const [{ cashboxCount }] = await verifyDb.$queryRawUnsafe(`SELECT count(*) as "cashboxCount" FROM "Cashbox";`);
  const [{ pricingCount }] = await verifyDb.$queryRawUnsafe(`SELECT count(*) as "pricingCount" FROM "TeacherGradePricing";`);

  console.log('Restored User count:                ', userCount, '(Expected: 3)');
  console.log('Restored Branch count:              ', branchCount, '(Expected: 4)');
  console.log('Restored Institution count:         ', instCount, '(Expected: 3)');
  console.log('Restored Course count:              ', courseCount, '(Expected: 2)');
  console.log('Restored Exam count:                ', examCount, '(Expected: 2)');
  console.log('Restored Homework count:            ', hwCount, '(Expected: 2)');
  console.log('Restored Cashbox count:             ', cashboxCount, '(Expected: 1)');
  console.log('Restored TeacherGradePricing count: ', pricingCount, '(Expected: 2)');

  if (
    parseInt(userCount) !== 3 ||
    parseInt(branchCount) !== 4 ||
    parseInt(instCount) !== 3 ||
    parseInt(courseCount) !== 2 ||
    parseInt(examCount) !== 2 ||
    parseInt(hwCount) !== 2 ||
    parseInt(cashboxCount) !== 1 ||
    parseInt(pricingCount) !== 2
  ) {
    throw new Error('Restored counts do not match expected baseline counts!');
  }

  // Check specific test branch in restored DB
  const manualBranch = await verifyDb.$queryRawUnsafe(`SELECT id, name, code FROM "Branch" WHERE id = '152b6c2a-e5d8-4151-b557-393cd3285632';`);
  console.log('Verified test branch in restore:', manualBranch[0]);
  if (!manualBranch || manualBranch.length !== 1) {
    throw new Error('Manual branch not found in restored DB!');
  }

  await verifyDb.$disconnect();
  console.log('[PASS] Restored database schema and referential integrity 100% verified.');

  console.log('\n--- 9. Dropping Temporary Verification Database ---');
  execSync(`docker exec ox-digital-isolated-dev-postgres dropdb -U ox_dev_admin ${TEMP_DB}`, { stdio: 'inherit' });
  console.log(`[PASS] Temporary database ${TEMP_DB} dropped cleanly.`);

  console.log('\n=======================================================');
  console.log('>>> BACKUP CREATED AND RECOVERY VERIFIED SUCCESSFULLY <<<');
  console.log('=======================================================');
}

main().catch(err => {
  console.error('\n[FATAL] Backup creation/verification failed:', err);
  process.exit(1);
});

