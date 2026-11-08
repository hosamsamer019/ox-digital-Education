const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const { PrismaClient } = require(path.resolve(__dirname, '../node_modules/@prisma/client'));

const db = new PrismaClient({
  datasources: { db: { url: process.env.DATABASE_URL } }
});

async function main() {
  const exams = await db.exam.findMany({
    include: { attempts: true }
  });
  console.log('Exams details:', exams);

  const hws = await db.homework.findMany({
    include: { submissions: true }
  });
  console.log('Homework details:', hws);

  await db.$disconnect();
}

main().catch(console.error);

