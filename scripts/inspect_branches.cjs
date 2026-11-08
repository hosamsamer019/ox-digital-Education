const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const { PrismaClient } = require(path.resolve(__dirname, '../node_modules/@prisma/client'));

const db = new PrismaClient({
  datasources: { db: { url: process.env.DATABASE_URL } }
});

async function main() {
  const branches = await db.branch.findMany();
  console.log('Branches:', JSON.stringify(branches, null, 2));
  await db.$disconnect();
}

main().catch(console.error);

