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

  console.log('=== FULL TABLE INVENTORY OF ox_digital_dev_test ===');
  const inventory = [];

  for (const row of tables) {
    const tableName = row.table_name;
    const [{ count }] = await db.$queryRawUnsafe(`SELECT count(*) as count FROM "${tableName}";`);
    if (parseInt(count, 10) > 0) {
      inventory.push({ table: tableName, count: parseInt(count, 10) });
      console.log(`${tableName.padEnd(32)}: ${count}`);
    }
  }

  console.log('\nTotal non-empty tables:', inventory.length);
  await db.$disconnect();
}

main().catch(console.error);

