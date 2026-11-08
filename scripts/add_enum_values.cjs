const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const { PrismaClient } = require(path.resolve(__dirname, '../node_modules/@prisma/client'));

async function main() {
  const prisma = new PrismaClient({
    datasources: {
      db: {
        url: process.env.DATABASE_URL
      }
    }
  });

  console.log('Connecting to DATABASE_URL:', process.env.DATABASE_URL.replace(/:[^:@]+@/, ':***@'));

  try {
    await prisma.$executeRawUnsafe(`ALTER TYPE "FinancialAccessStatus" ADD VALUE IF NOT EXISTS 'GRACE_PERIOD';`);
    console.log('Added GRACE_PERIOD');
  } catch (err) {
    console.log('GRACE_PERIOD:', err.message);
  }

  try {
    await prisma.$executeRawUnsafe(`ALTER TYPE "FinancialAccessStatus" ADD VALUE IF NOT EXISTS 'LOCKED';`);
    console.log('Added LOCKED');
  } catch (err) {
    console.log('LOCKED:', err.message);
  }

  const res = await prisma.$queryRawUnsafe(`
    SELECT enumlabel 
    FROM pg_enum 
    JOIN pg_type ON pg_enum.enumtypid = pg_type.oid 
    WHERE typname = 'FinancialAccessStatus';
  `);
  console.log('FinancialAccessStatus values:', res);

  await prisma.$disconnect();
}

main().catch(console.error);
