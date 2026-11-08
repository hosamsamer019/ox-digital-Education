const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const { PrismaClient } = require(path.resolve(__dirname, '../node_modules/@prisma/client'));

const db = new PrismaClient({
  datasources: { db: { url: process.env.DATABASE_URL } }
});

async function main() {
  const instA = await db.institution.findUnique({ where: { id: 'inst_idor_a_w4adp2' } });
  console.log('Preserved Institution A:', instA);
  const brA = await db.branch.findUnique({ where: { id: 'br_idor_a_w4adp2' } });
  console.log('Preserved Branch A:', brA);
  await db.$disconnect();
}

main().catch(console.error);

