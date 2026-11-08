const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const { PrismaClient } = require(path.resolve(__dirname, '../node_modules/@prisma/client'));

const DATABASE_URL = process.env.DATABASE_URL;

const prisma = new PrismaClient({
  datasources: {
    db: { url: DATABASE_URL }
  }
});

async function main() {
  console.log('=== DATABASE IDENTITY VERIFICATION ===');
  const identity = await prisma.$queryRawUnsafe(`
    SELECT 
      current_database() AS db_name,
      current_user AS db_user,
      inet_server_addr() AS server_addr,
      inet_server_port() AS server_port,
      version() AS pg_version;
  `);
  console.log('Identity:', JSON.stringify(identity[0], null, 2));

  if (identity[0].db_name !== 'ox_digital_dev_test' || identity[0].db_user !== 'ox_dev_admin') {
    throw new Error(`CRITICAL: Database identity mismatch! Expected ox_digital_dev_test/ox_dev_admin, got ${identity[0].db_name}/${identity[0].db_user}`);
  }

  console.log('\n=== RECORD COUNTS AUDIT ===');
  const [
    users,
    institutions,
    branches,
    agreements,
    obligations,
    collections,
    allocations,
    monthlyPolicies,
    restrictionHistory
  ] = await Promise.all([
    prisma.user.count(),
    prisma.institution.count(),
    prisma.branch.count(),
    prisma.studentFinancialAgreement.count(),
    prisma.studentObligation.count(),
    prisma.collection.count(),
    prisma.collectionAllocation.count(),
    prisma.monthlyFeePolicy.count(),
    prisma.financialRestrictionHistory.count()
  ]);

  console.log(JSON.stringify({
    users,
    institutions,
    branches,
    agreements,
    obligations,
    collections,
    allocations,
    monthlyPolicies,
    restrictionHistory
  }, null, 2));

  console.log('\n=== OBLIGATION TYPE BREAKDOWN ===');
  const typeBreakdown = await prisma.$queryRawUnsafe(`
    SELECT "obligationType", COUNT(*)::int as count 
    FROM "StudentObligation" 
    GROUP BY "obligationType";
  `);
  console.log('Obligation types in DB:', typeBreakdown);

  console.log('\n=== AGREEMENT GROUPS BREAKDOWN ===');
  const agreementBreakdown = await prisma.$queryRawUnsafe(`
    SELECT 
      CASE 
        WHEN a."agreementNumber" LIKE 'AGR-ACAD-%' THEN 'AGR-ACAD'
        WHEN a."agreementNumber" LIKE 'AGR-REV-%' THEN 'AGR-REV'
        WHEN a."agreementNumber" LIKE 'AGR-TEST-%' THEN 'AGR-TEST'
        ELSE 'OTHER'
      END AS agreement_group,
      o."obligationType",
      COUNT(*)::int as count
    FROM "StudentObligation" o
    JOIN "StudentFinancialAgreement" a ON o."agreementId" = a.id
    GROUP BY 1, 2
    ORDER BY 1, 2;
  `);
  console.log('Obligations by Agreement Group:', agreementBreakdown);

  console.log('\n=== CHECK COLUMNS OF StudentObligation ===');
  const cols = await prisma.$queryRawUnsafe(`
    SELECT column_name, data_type, udt_name, is_nullable, column_default 
    FROM information_schema.columns 
    WHERE table_name = 'StudentObligation'
    ORDER BY ordinal_position;
  `);
  console.log('StudentObligation Columns:', cols.map(c => `${c.column_name} (${c.data_type}/${c.udt_name}, default: ${c.column_default})`));

  console.log('\n=== CHECK POSTGRESQL ENUM ObligationType ===');
  const enumVals = await prisma.$queryRawUnsafe(`
    SELECT e.enumlabel
    FROM pg_type t 
    JOIN pg_enum e ON t.oid = e.enumtypid  
    JOIN pg_catalog.pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'ObligationType'
    ORDER BY e.enumsortorder;
  `);
  console.log('Postgres ObligationType Enum Values:', enumVals.map(e => e.enumlabel));

  await prisma.$disconnect();
}

main().catch(err => {
  console.error('Audit failed:', err);
  process.exit(1);
});
