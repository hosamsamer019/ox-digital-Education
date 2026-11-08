const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const { PrismaClient } = require(path.resolve(__dirname, '../node_modules/@prisma/client'));

const prisma = new PrismaClient({
  datasources: { db: { url: process.env.DATABASE_URL } }
});

async function main() {
  console.log('=== AUDITING EXISTING SCHEMA DETAILS ===');

  // 1. Check User table columns
  const userColumns = await prisma.$queryRawUnsafe(`
    SELECT column_name, data_type, is_nullable, column_default
    FROM information_schema.columns
    WHERE table_name = 'User'
    ORDER BY ordinal_position;
  `);
  console.log('User Columns:', userColumns.map(c => `${c.column_name} (${c.data_type})`));

  // 2. Check if there are any teacher-student relations or enrollments
  const enrollmentCount = await prisma.courseEnrollment.count();
  console.log('CourseEnrollment count:', enrollmentCount);

  // 3. Check existing branches
  const branches = await prisma.branch.findMany({
    select: { id: true, code: true, name: true, institutionId: true, status: true, address: true, phone: true }
  });
  console.log('Branches in DB:', branches);

  // 4. Check existing teachers and their branch/institution assignments
  const teachers = await prisma.user.findMany({
    where: { role: 'TEACHER' },
    select: { id: true, email: true, name: true, institutionId: true, branchId: true }
  });
  console.log('Teachers count:', teachers.length, 'Sample teachers:', teachers.slice(0, 5));

  // 5. Check existing students and their assignments
  const students = await prisma.user.findMany({
    where: { role: { in: ['CENTER_STUDENT', 'ONLINE_STUDENT'] } },
    select: { id: true, email: true, name: true, role: true, institutionId: true, branchId: true, parentId: true, centerGroupId: true }
  });
  console.log('Students count:', students.length, 'Sample students:', students.slice(0, 5));

  // 6. Check existing accountants and their branch assignments
  const accountants = await prisma.user.findMany({
    where: { role: 'ACCOUNTANT' },
    select: { id: true, email: true, name: true, institutionId: true, branchId: true, mustChangePassword: true }
  });
  console.log('Accountants count:', accountants.length, 'Sample accountants:', accountants.slice(0, 5));

  // 7. Check existing tables in DB
  const tables = await prisma.$queryRawUnsafe(`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public'
    ORDER BY table_name;
  `);
  console.log('All DB Tables:', tables.map(t => t.table_name));

  await prisma.$disconnect();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
