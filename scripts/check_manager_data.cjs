const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const { PrismaClient } = require(path.resolve(__dirname, '../node_modules/@prisma/client'));

const prisma = new PrismaClient({
  datasources: { db: { url: process.env.DATABASE_URL } }
});

async function check() {
  const institutions = await prisma.institution.findMany({ select: { id: true, name: true, code: true } });
  console.log('Institutions:', JSON.stringify(institutions, null, 2));

  const managers = await prisma.user.findMany({
    where: { role: 'PRIMARY_MANAGER' },
    select: { id: true, name: true, email: true, institutionId: true, branchId: true }
  });
  console.log('Primary Managers:', JSON.stringify(managers, null, 2));

  const branches = await prisma.branch.findMany({
    select: { id: true, name: true, code: true, institutionId: true }
  });
  console.log('Branches:', JSON.stringify(branches, null, 2));

  const accountants = await prisma.user.findMany({
    where: { role: 'ACCOUNTANT' },
    select: { id: true, name: true, email: true, institutionId: true, branchId: true, mustChangePassword: true }
  });
  console.log('Accountants:', JSON.stringify(accountants, null, 2));

  await prisma.$disconnect();
}

check().catch(console.error);
