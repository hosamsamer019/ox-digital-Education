const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const { PrismaClient } = require(path.resolve(__dirname, '../node_modules/@prisma/client'));

const prisma = new PrismaClient({
  datasources: { db: { url: process.env.DATABASE_URL } }
});

async function main() {
  console.log('=== DRY-RUN HISTORICAL OBLIGATION CLASSIFICATION PREVIEW ===');
  
  // Verify database identity
  const dbInfo = await prisma.$queryRawUnsafe(`
    SELECT current_database() as db_name, current_user as db_user;
  `);
  if (dbInfo[0].db_name !== 'ox_digital_dev_test' || dbInfo[0].db_user !== 'ox_dev_admin') {
    throw new Error(`CRITICAL: Database identity mismatch: ${dbInfo[0].db_name} / ${dbInfo[0].db_user}`);
  }

  const obligations = await prisma.$queryRawUnsafe(`
    SELECT 
      o.id AS obligation_id,
      o."institutionId",
      o."branchId",
      o."studentId",
      o."agreementId",
      a."agreementNumber",
      a.status as agreement_status,
      o."scheduleItemNumber",
      o."dueDate",
      o."amountDue",
      o."amountCollected",
      o.status,
      o."isMonthlyFee",
      o."obligationType",
      o."billingMonth",
      o.title
    FROM "StudentObligation" o
    JOIN "StudentFinancialAgreement" a ON o."agreementId" = a.id
    ORDER BY a."agreementNumber", o."scheduleItemNumber", o.id;
  `);

  console.log(`Total obligations found: ${obligations.length}`);

  const acadGroup = obligations.filter(o => o.agreementNumber.startsWith('AGR-ACAD-'));
  const revGroup = obligations.filter(o => o.agreementNumber.startsWith('AGR-REV-'));
  const testGroup = obligations.filter(o => o.agreementNumber.startsWith('AGR-TEST-'));
  const otherGroup = obligations.filter(o => 
    !o.agreementNumber.startsWith('AGR-ACAD-') && 
    !o.agreementNumber.startsWith('AGR-REV-') && 
    !o.agreementNumber.startsWith('AGR-TEST-')
  );

  console.log('\n--- GROUP COUNTS ---');
  console.log(`AGR-ACAD-* : ${acadGroup.length} (Expected: 5)`);
  console.log(`AGR-REV-*  : ${revGroup.length} (Expected: 10)`);
  console.log(`AGR-TEST-* : ${testGroup.length} (Expected: 39)`);
  console.log(`OTHER      : ${otherGroup.length} (Expected: 0)`);

  if (acadGroup.length !== 5 || revGroup.length !== 10 || testGroup.length !== 39 || obligations.length !== 54) {
    throw new Error(`SAFETY STOP: Discrepancy in obligation counts! Found total ${obligations.length}, ACAD=${acadGroup.length}, REV=${revGroup.length}, TEST=${testGroup.length}`);
  }

  console.log('\n--- TARGET CLASSIFICATIONS ---');
  console.log('1. AGR-ACAD-* (5 records) -> FULL_PERIOD_FEE (Full Academic Course Fee), isMonthlyFee=false, billingMonth=null');
  for (const o of acadGroup) {
    console.log(`  [ACAD] Ob ID: ${o.obligation_id} | Agr: ${o.agreementNumber} | Item: ${o.scheduleItemNumber} | Due: ${o.amountDue} | Paid: ${o.amountCollected} | CurrentType: ${o.obligationType} -> Target: FULL_PERIOD_FEE`);
  }

  console.log('\n2. AGR-REV-* (10 records) -> TERM_FEE (Split Academic Course Fee Schedule), isMonthlyFee=false, billingMonth=null');
  for (const o of revGroup) {
    console.log(`  [REV]  Ob ID: ${o.obligation_id} | Agr: ${o.agreementNumber} | Item: ${o.scheduleItemNumber} | Due: ${o.amountDue} | Paid: ${o.amountCollected} | CurrentType: ${o.obligationType} -> Target: TERM_FEE`);
  }

  console.log('\n3. AGR-TEST-* (39 records) -> TERM_FEE (Academic Course Fee Schedule), isMonthlyFee=false, billingMonth=null');
  for (const o of testGroup) {
    console.log(`  [TEST] Ob ID: ${o.obligation_id} | Agr: ${o.agreementNumber} | Item: ${o.scheduleItemNumber} | Due: ${o.amountDue} | Paid: ${o.amountCollected} | CurrentType: ${o.obligationType} -> Target: TERM_FEE`);
  }

  console.log('\n✅ All 54 obligations verified against exact agreement linkages.');
  await prisma.$disconnect();
}

main().catch(err => {
  console.error('Preview failed:', err);
  process.exit(1);
});
