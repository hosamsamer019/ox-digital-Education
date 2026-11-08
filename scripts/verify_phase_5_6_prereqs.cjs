const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const { PrismaClient } = require(path.resolve(__dirname, '../node_modules/@prisma/client'));

const prisma = new PrismaClient({
  datasources: { db: { url: process.env.DATABASE_URL } }
});

async function main() {
  console.log('=== STEP 3: MANDATORY INITIAL VERIFICATION ===\n');

  // A. Database identity check
  console.log('--- 3.A Database Identity ---');
  const dbInfo = await prisma.$queryRawUnsafe(`
    SELECT 
      current_database() AS db_name,
      current_user AS db_user,
      inet_server_addr() AS server_addr,
      inet_server_port() AS server_port,
      version() AS pg_version;
  `);
  console.log('Live Database Info:', JSON.stringify(dbInfo[0], null, 2));

  if (dbInfo[0].db_name !== 'ox_digital_dev_test' || dbInfo[0].db_user !== 'ox_dev_admin') {
    throw new Error(`CRITICAL: Database identity mismatch! Expected ox_digital_dev_test/ox_dev_admin, got ${dbInfo[0].db_name}/${dbInfo[0].db_user}`);
  }

  // B. FULL_PERIOD_FEE verification
  console.log('\n--- 3.B ObligationType Enum Verification ---');

  // 1. In schema.prisma
  const schemaPath = path.resolve(__dirname, '../packages/database/prisma/schema.prisma');
  const schemaContent = fs.readFileSync(schemaPath, 'utf8');
  const schemaMatch = schemaContent.match(/enum\s+ObligationType\s*\{([\s\S]*?)\}/);
  const schemaEnumValues = schemaMatch ? schemaMatch[1].split(/\s+/).filter(Boolean) : [];
  console.log('1. schema.prisma enum ObligationType values:', schemaEnumValues);
  const existsInSchema = schemaEnumValues.includes('FULL_PERIOD_FEE');
  console.log(`   -> FULL_PERIOD_FEE in schema.prisma: ${existsInSchema ? 'EXISTS' : 'NOT FOUND'}`);

  // 2. In generated Prisma Client
  const prismaClient = require(path.resolve(__dirname, '../node_modules/@prisma/client'));
  const clientEnumValues = prismaClient.ObligationType ? Object.values(prismaClient.ObligationType) : [];
  console.log('2. Prisma Client ObligationType values:', clientEnumValues);
  const existsInClient = clientEnumValues.includes('FULL_PERIOD_FEE');
  console.log(`   -> FULL_PERIOD_FEE in Prisma Client: ${existsInClient ? 'EXISTS' : 'NOT FOUND'}`);

  // 3. In PostgreSQL pg_enum
  const pgEnumRows = await prisma.$queryRawUnsafe(`
    SELECT e.enumlabel, e.enumsortorder
    FROM pg_type t 
    JOIN pg_enum e ON t.oid = e.enumtypid  
    WHERE t.typname = 'ObligationType'
    ORDER BY e.enumsortorder;
  `);
  const pgEnumValues = pgEnumRows.map(r => r.enumlabel);
  console.log('3. PostgreSQL pg_enum ObligationType values:', pgEnumValues);
  const existsInPg = pgEnumValues.includes('FULL_PERIOD_FEE');
  console.log(`   -> FULL_PERIOD_FEE in PostgreSQL pg_enum: ${existsInPg ? 'EXISTS' : 'NOT FOUND'}`);

  // 4. Obligations in DB using FULL_PERIOD_FEE
  const fullPeriodCount = await prisma.studentObligation.count({
    where: { obligationType: 'FULL_PERIOD_FEE' }
  });
  const termFeeCount = await prisma.studentObligation.count({
    where: { obligationType: 'TERM_FEE' }
  });
  const totalObs = await prisma.studentObligation.count();
  console.log('\nCurrent Obligation counts in DB:');
  console.log(`- Total obligations: ${totalObs}`);
  console.log(`- FULL_PERIOD_FEE: ${fullPeriodCount}`);
  console.log(`- TERM_FEE: ${termFeeCount}`);

  await prisma.$disconnect();
}

main().catch(err => {
  console.error('Initial verification failed:', err);
  process.exit(1);
});

