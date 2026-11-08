const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const { PrismaClient } = require(path.resolve(__dirname, '../node_modules/@prisma/client'));

const prisma = new PrismaClient({
  datasources: { db: { url: process.env.DATABASE_URL } }
});

async function main() {
  const pms = await prisma.user.findMany({
    where: { role: 'PRIMARY_MANAGER' },
    select: { id: true, email: true, name: true, institutionId: true, isPrimaryManager: true }
  });
  console.log('Primary Managers count:', pms.length);
  console.log('Sample Primary Managers:', pms.slice(0, 5));

  const admins = await prisma.user.findMany({
    where: { role: 'ADMIN' },
    select: { id: true, email: true, name: true, institutionId: true, isPrimaryManager: true }
  });
  console.log('Admins count:', admins.length);
  console.log('Admins:', admins);

  await prisma.$disconnect();
}

main().catch(console.error);

