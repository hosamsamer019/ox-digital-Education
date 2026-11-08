const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const { PrismaClient } = require(path.resolve(__dirname, '../node_modules/@prisma/client'));

const prisma = new PrismaClient({
  datasources: { db: { url: process.env.DATABASE_URL } }
});

async function main() {
  console.log('=== INSPECTING CURRENT STUDENT & TEACHER DATA ===');

  const students = await prisma.user.findMany({
    where: { role: { in: ['CENTER_STUDENT', 'ONLINE_STUDENT'] } },
    include: {
      parent: { select: { id: true, name: true, email: true } },
      enrollments: { include: { course: { select: { id: true, title: true, teacherId: true } } } },
      centerGroup: true
    }
  });

  console.log(`Found ${students.length} students in database.`);
  for (const s of students) {
    const courses = s.enrollments.map(e => ({ courseId: e.course.id, teacherId: e.course.teacherId }));
    console.log(`Student [${s.id}] ${s.name} (${s.email}, ${s.role}, grade: ${s.gradeLevel}): parent=${s.parent?.email || 'none'}, branch=${s.branchId || 'none'}, coursesWithTeachers=${JSON.stringify(courses)}`);
  }

  await prisma.$disconnect();
}

main().catch(console.error);

