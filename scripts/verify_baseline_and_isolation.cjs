const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const { PrismaClient } = require(path.resolve(__dirname, '../node_modules/@prisma/client'));

const db = new PrismaClient({
  datasources: { db: { url: process.env.DATABASE_URL } }
});

async function main() {
  console.log('--- Checking Isolation and Database Identity ---');
  const [ident] = await db.$queryRawUnsafe(
    'SELECT current_database() as db, current_user as usr, inet_server_port() as port, inet_server_addr() as host;'
  );
  console.log('Database identity:', ident);
  
  if (ident.db !== 'ox_digital_dev_test' || ident.usr !== 'ox_dev_admin' || String(ident.port) !== '5432') {
    // Note: inside container port is 5432, host port is 5433
    console.log('Internal port:', ident.port);
  }

  const urlPort = (process.env.DATABASE_URL.match(/:(\d+)\//) || [])[1];
  console.log('Host connection port from env:', urlPort);
  if (urlPort !== '5433') {
    throw new Error(`ABORT: Host connection port is ${urlPort}, must be 5433!`);
  }
  if (ident.db !== 'ox_digital_dev_test') {
    throw new Error(`ABORT: Database is ${ident.db}, must be ox_digital_dev_test!`);
  }

  const instCount = await db.institution.count();
  const branchCount = await db.branch.count();
  const userCount = await db.user.count();
  const cashboxCount = await db.cashbox.count();
  const pricingCount = await db.teacherGradePricing.count();
  const courseCount = await db.course.count();
  const examCount = await db.exam.count();
  const hwCount = await db.homework.count();
  const [mig] = await db.$queryRawUnsafe('SELECT count(*)::int as count FROM _prisma_migrations;');

  const counts = {
    institution: instCount,
    branch: branchCount,
    user: userCount,
    cashbox: cashboxCount,
    teacherGradePricing: pricingCount,
    course: courseCount,
    exam: examCount,
    homework: hwCount,
    _prisma_migrations: mig.count
  };

  console.log('Current baseline counts:', counts);

  const expected = {
    institution: 2,
    branch: 2,
    user: 3,
    cashbox: 1,
    teacherGradePricing: 2,
    course: 0,
    exam: 0,
    homework: 0,
    _prisma_migrations: 11
  };

  let matched = true;
  for (const [k, v] of Object.entries(expected)) {
    if (counts[k] !== v) {
      console.error(`MISMATCH: ${k} expected ${v}, got ${counts[k]}`);
      matched = false;
    }
  }

  if (matched) {
    console.log('[SUCCESS] Retained development database matches exact expected baseline.');
  } else {
    throw new Error('Retained database counts do not match expected baseline!');
  }

  await db.$disconnect();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
