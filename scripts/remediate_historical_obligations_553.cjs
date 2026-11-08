const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const { PrismaClient } = require(path.resolve(__dirname, '../node_modules/@prisma/client'));

const prisma = new PrismaClient({
  datasources: { db: { url: process.env.DATABASE_URL } }
});

async function main() {
  console.log('=== PHASE 5.5.3 HISTORICAL OBLIGATION REMEDIATION TRANSACTION ===');

  // 1. Mandatory Database Identity Verification
  const dbInfo = await prisma.$queryRawUnsafe(`
    SELECT 
      current_database() AS db_name,
      current_user AS db_user,
      inet_server_addr() AS server_addr,
      inet_server_port() AS server_port;
  `);
  const { db_name, db_user, server_addr, server_port } = dbInfo[0];
  console.log(`Connected to: ${db_name} as ${db_user} (${server_addr}:${server_port})`);

  if (db_name !== 'ox_digital_dev_test' || db_user !== 'ox_dev_admin') {
    throw new Error(`CRITICAL SAFETY ABORT: Database identity mismatch! Expected ox_digital_dev_test/ox_dev_admin, got ${db_name}/${db_user}`);
  }

  // 2. Pre-execution counts and verification
  console.log('\n--- Step 1: Pre-Execution Verification ---');
  const [beforeTotal, beforeMonthly, beforeAgreements, beforeCols, beforeAllocs] = await Promise.all([
    prisma.studentObligation.count(),
    prisma.studentObligation.count({ where: { obligationType: 'MONTHLY_FEE' } }),
    prisma.studentFinancialAgreement.count(),
    prisma.collection.count(),
    prisma.collectionAllocation.count()
  ]);

  console.log(`Pre-counts: Total Obligations=${beforeTotal}, Monthly Obligations=${beforeMonthly}, Agreements=${beforeAgreements}, Collections=${beforeCols}, Allocations=${beforeAllocs}`);

  if (beforeTotal !== 54 || beforeMonthly !== 54) {
    throw new Error(`SAFETY ABORT: Expected exactly 54 total and 54 monthly obligations, found Total=${beforeTotal}, Monthly=${beforeMonthly}`);
  }

  // Fetch agreement mappings
  const rawObs = await prisma.$queryRawUnsafe(`
    SELECT o.id, a."agreementNumber", o."amountDue", o."amountCollected"
    FROM "StudentObligation" o
    JOIN "StudentFinancialAgreement" a ON o."agreementId" = a.id;
  `);

  const acadIds = rawObs.filter(o => o.agreementNumber.startsWith('AGR-ACAD-')).map(o => o.id);
  const revIds = rawObs.filter(o => o.agreementNumber.startsWith('AGR-REV-')).map(o => o.id);
  const testIds = rawObs.filter(o => o.agreementNumber.startsWith('AGR-TEST-')).map(o => o.id);

  console.log(`Matched ID counts: ACAD=${acadIds.length}, REV=${revIds.length}, TEST=${testIds.length}`);
  if (acadIds.length !== 5 || revIds.length !== 10 || testIds.length !== 39) {
    throw new Error(`SAFETY ABORT: Group count mismatch! Expected 5 ACAD, 10 REV, 39 TEST. Got: ${acadIds.length}, ${revIds.length}, ${testIds.length}`);
  }

  // 3. Execute Transaction
  console.log('\n--- Step 2: Executing Database Transaction ---');
  const txResult = await prisma.$transaction(async (tx) => {
    // 3.1 Update AGR-ACAD-* (5 records) to FULL_PERIOD_FEE, isMonthlyFee=false, billingMonth=null
    const resAcad = await tx.studentObligation.updateMany({
      where: { id: { in: acadIds } },
      data: {
        obligationType: 'FULL_PERIOD_FEE',
        isMonthlyFee: false,
        billingMonth: null
      }
    });

    // 3.2 Update AGR-REV-* (10 records) to TERM_FEE, isMonthlyFee=false, billingMonth=null
    const resRev = await tx.studentObligation.updateMany({
      where: { id: { in: revIds } },
      data: {
        obligationType: 'TERM_FEE',
        isMonthlyFee: false,
        billingMonth: null
      }
    });

    // 3.3 Update AGR-TEST-* (39 records) to TERM_FEE, isMonthlyFee=false, billingMonth=null
    const resTest = await tx.studentObligation.updateMany({
      where: { id: { in: testIds } },
      data: {
        obligationType: 'TERM_FEE',
        isMonthlyFee: false,
        billingMonth: null
      }
    });

    // 3.4 Safe column default adjustments so new obligations don't default to monthly fee
    await tx.$executeRawUnsafe(`ALTER TABLE "StudentObligation" ALTER COLUMN "isMonthlyFee" SET DEFAULT false;`);
    await tx.$executeRawUnsafe(`ALTER TABLE "StudentObligation" ALTER COLUMN "obligationType" SET DEFAULT 'TERM_FEE'::"ObligationType";`);

    return {
      acadUpdated: resAcad.count,
      revUpdated: resRev.count,
      testUpdated: resTest.count
    };
  });

  console.log('Transaction committed successfully:', txResult);

  // 4. Post-execution verification
  console.log('\n--- Step 3: Post-Execution Verification ---');
  const [
    afterTotal,
    afterMonthly,
    afterFullPeriod,
    afterTermFee,
    afterIsMonthlyTrue,
    afterAgreements,
    afterCols,
    afterAllocs
  ] = await Promise.all([
    prisma.studentObligation.count(),
    prisma.studentObligation.count({ where: { obligationType: 'MONTHLY_FEE' } }),
    prisma.studentObligation.count({ where: { obligationType: 'FULL_PERIOD_FEE' } }),
    prisma.studentObligation.count({ where: { obligationType: 'TERM_FEE' } }),
    prisma.studentObligation.count({ where: { isMonthlyFee: true } }),
    prisma.studentFinancialAgreement.count(),
    prisma.collection.count(),
    prisma.collectionAllocation.count()
  ]);

  console.log('Post-counts Audit:');
  console.log(`- Total Obligations: ${afterTotal} (Expected: 54)`);
  console.log(`- MONTHLY_FEE Obligations: ${afterMonthly} (Expected: 0)`);
  console.log(`- FULL_PERIOD_FEE Obligations: ${afterFullPeriod} (Expected: 5)`);
  console.log(`- TERM_FEE Obligations: ${afterTermFee} (Expected: 49)`);
  console.log(`- isMonthlyFee = true: ${afterIsMonthlyTrue} (Expected: 0)`);
  console.log(`- Agreements: ${afterAgreements} (Expected: ${beforeAgreements})`);
  console.log(`- Collections: ${afterCols} (Expected: ${beforeCols})`);
  console.log(`- Allocations: ${afterAllocs} (Expected: ${beforeAllocs})`);

  if (
    afterTotal !== 54 ||
    afterMonthly !== 0 ||
    afterFullPeriod !== 5 ||
    afterTermFee !== 49 ||
    afterIsMonthlyTrue !== 0 ||
    afterAgreements !== beforeAgreements ||
    afterCols !== beforeCols ||
    afterAllocs !== beforeAllocs
  ) {
    throw new Error('CRITICAL INTEGRITY FAILURE: Post-counts do not match expected values!');
  }

  console.log('\n✅ ALL 54 HISTORICAL OBLIGATIONS ARE NOW VERIFIED NON-MONTHLY.');
  console.log('✅ ZERO HISTORICAL OBLIGATIONS CAN TRIGGER MONTHLY FINANCIAL RESTRICTION.');
  await prisma.$disconnect();
}

main().catch(err => {
  console.error('Remediation failed:', err);
  process.exit(1);
});

