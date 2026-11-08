/**
 * Capture full table counts of ox_digital_dev_test
 */
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const { PrismaClient } = require(path.resolve(__dirname, '../node_modules/@prisma/client'));

const db = new PrismaClient({
  datasources: { db: { url: process.env.DATABASE_URL } }
});

async function main() {
  const tables = await db.$queryRawUnsafe(`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
      AND table_type = 'BASE TABLE'
      AND table_name != '_prisma_migrations'
    ORDER BY table_name;
  `);

  const counts = {};
  for (const row of tables) {
    const tableName = row.table_name;
    const [{ count }] = await db.$queryRawUnsafe(`SELECT count(*) as count FROM "${tableName}";`);
    counts[tableName] = parseInt(count, 10);
  }

  console.log(JSON.stringify(counts, null, 2));
  await db.$disconnect();
}

main().catch(console.error);

