const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const { PrismaClient } = require(path.resolve(__dirname, '../node_modules/@prisma/client'));

const prisma = new PrismaClient({
  datasources: { db: { url: process.env.DATABASE_URL } }
});

async function check() {
  const collectionCount = await prisma.collection.count();
  const obligationCount = await prisma.studentObligation.count();
  const cashboxCount = await prisma.cashbox.count();
  const expenseCount = await prisma.expenseVoucher.count();
  console.log({
    collectionCount,
    obligationCount,
    cashboxCount,
    expenseCount
  });

  const cashboxes = await prisma.cashbox.findMany({
    select: { id: true, code: true, name: true, currentBalance: true, branchId: true }
  });
  console.log('Cashboxes:', cashboxes);

  await prisma.$disconnect();
}

check().catch(console.error);

