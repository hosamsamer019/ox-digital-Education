const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const { PrismaClient } = require(path.resolve(__dirname, '../node_modules/@prisma/client'));

const prisma = new PrismaClient({
  datasources: { db: { url: process.env.DATABASE_URL } }
});

async function main() {
  const counts = {};

  const models = [
    'user',
    'institution',
    'branch',
    'studentProfile',
    'teacherProfile',
    'parentProfile',
    'subscriptionAgreement',
    'studentObligation',
    'collection',
    'receipt',
    'notification',
    'cashbox',
    'cashboxTransaction',
    'expenseVoucher',
    'course',
    'exam',
    'homework'
  ];

  for (const m of models) {
    if (prisma[m]) {
      try {
        counts[m] = await prisma[m].count();
      } catch (e) {
        counts[m] = `error: ${e.message}`;
      }
    } else {
      counts[m] = 'model_not_found';
    }
  }

  // Count users by role
  try {
    const roles = await prisma.user.groupBy({
      by: ['role'],
      _count: { id: true }
    });
    counts.usersByRole = roles.map(r => ({ role: r.role, count: r._count.id }));
  } catch (e) {
    counts.usersByRole = `error: ${e.message}`;
  }

  console.log('BASELINE DATABASE COUNTS:');
  console.log(JSON.stringify(counts, null, 2));

  await prisma.$disconnect();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});

