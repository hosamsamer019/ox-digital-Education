const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const { PrismaClient } = require(path.resolve(__dirname, '../node_modules/@prisma/client'));

const prisma = new PrismaClient({
  datasources: { db: { url: process.env.DATABASE_URL } }
});

async function main() {
  console.log('Connecting to DATABASE_URL:', process.env.DATABASE_URL.replace(/:[^:@]+@/, ':***@'));
  const identity = await prisma.$queryRawUnsafe(
    'SELECT current_database(), current_user, inet_server_port(), inet_server_addr(), version()'
  );
  console.log('Database identity verification:', identity);
  await prisma.$disconnect();
}

main().catch(err => {
  console.error('Database identity check failed:', err);
  process.exit(1);
});

