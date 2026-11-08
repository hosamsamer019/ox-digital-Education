const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const { PrismaClient } = require(path.resolve(__dirname, '../node_modules/@prisma/client'));

const db = new PrismaClient({
  datasources: { db: { url: process.env.DATABASE_URL } }
});

async function main() {
  const [ident] = await db.$queryRawUnsafe('SELECT current_database() as db, inet_server_addr() as host, inet_server_port() as port, current_user as usr;');
  console.log('=== DB IDENTITY ===', ident);

  console.log('\n=== USERS (PASSWORD HASHES EXCLUDED) ===');
  const users = await db.user.findMany({
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      isPrimaryManager: true,
      institutionId: true,
      branchId: true,
      financialAccessStatus: true,
      deletedAt: true,
      createdAt: true
    },
    orderBy: { createdAt: 'asc' }
  });
  console.table(users);

  console.log('\n=== CASHBOXES ===');
  const cashboxes = await db.cashbox.findMany();
  console.table(cashboxes);

  console.log('\n=== TEACHER GRADE PRICING ===');
  const pricing = await db.teacherGradePricing.findMany();
  console.table(pricing);

  console.log('\n=== COURSES ===');
  const courses = await db.course.findMany({
    select: {
      id: true,
      title: true,
      teacherId: true,
      institutionId: true,
      branchId: true,
      gradeLevel: true,
      createdAt: true
    }
  });
  console.table(courses);

  console.log('\n=== EXAMS ===');
  const exams = await db.exam.findMany({
    select: {
      id: true,
      title: true,
      courseId: true,
      createdAt: true
    }
  });
  console.table(exams);

  console.log('\n=== HOMEWORKS ===');
  const homeworks = await db.homework.findMany({
    select: {
      id: true,
      title: true,
      courseId: true,
      createdAt: true
    }
  });
  console.table(homeworks);

  console.log('\n=== ALL TABLES IN PUBLIC SCHEMA WITH ROW COUNTS ===');
  const allTables = await db.$queryRawUnsafe(`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
      AND table_type = 'BASE TABLE'
    ORDER BY table_name;
  `);

  const tableSummary = [];
  for (const t of allTables) {
    const tableName = t.table_name;
    const [{ count }] = await db.$queryRawUnsafe(`SELECT count(*) as count FROM "${tableName}";`);
    tableSummary.push({ table_name: tableName, row_count: parseInt(count, 10) });
  }

  console.log(`Total tables found: ${tableSummary.length}`);
  console.log(JSON.stringify(tableSummary, null, 2));

  await db.$disconnect();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
