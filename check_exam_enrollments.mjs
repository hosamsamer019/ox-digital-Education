import { PrismaClient } from '@prisma/client';
const db = new PrismaClient();

async function main() {
  const examIds = [
    'c16cf3d9-2c91-4cbe-bfce-a91664cd4335',
    'a8667aa4-2c0a-44b1-8ad9-f0ff83ef8e7e',
    '1f4375ca-7106-4d43-83b8-29e7788b56f1'
  ];

  for (const id of examIds) {
    const exam = await db.exam.findUnique({
      where: { id },
      include: {
        course: {
          include: {
            enrollments: {
              include: { student: true }
            }
          }
        }
      }
    });

    if (!exam) {
      console.log(`Exam ${id} NOT FOUND`);
      continue;
    }

    console.log(`\nExam: ${exam.title} (${exam.id})`);
    console.log(`Course: ${exam.course.title} (${exam.course.id})`);
    console.log(`Enrolled Students: ${exam.course.enrollments.length}`);
    for (const e of exam.course.enrollments) {
      console.log(`  - Student: ${e.student.name} (${e.student.email}, ID: ${e.student.id})`);
    }
  }
}

main()
  .catch(console.error)
  .finally(() => db.$disconnect());
