import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const db = new PrismaClient();

async function main() {
  const TS = Date.now();
  const studentEmail = `student_cam_${TS}@edu.com`;
  
  // Create student
  const student = await db.user.create({
    data: { 
      name: 'Student Camera Test', 
      email: studentEmail, 
      password: await bcrypt.hash('password123', 10), 
      role: 'ONLINE_STUDENT' 
    }
  });

  // Create course
  const course = await db.course.create({
    data: {
      title: 'Camera Test Course',
      category: 'Math',
      teacherId: (await db.user.findFirst({ where: { role: 'TEACHER' } })).id
    }
  });

  // Enroll student
  await db.courseEnrollment.create({
    data: { studentId: student.id, courseId: course.id }
  });

  // Create Exam OFF (requiresCamera: false)
  await db.exam.create({
    data: {
      title: 'Exam Cam OFF',
      courseId: course.id,
      requiresCamera: false,
      duration: 60,
      questions: [{ id: 1, text: '2+2?', options: ['3','4'], correct: 1 }]
    }
  });

  // Create Exam ON (requiresCamera: true)
  await db.exam.create({
    data: {
      title: 'Exam Cam ON',
      courseId: course.id,
      requiresCamera: true,
      duration: 60,
      questions: [{ id: 1, text: '3+3?', options: ['5','6'], correct: 1 }]
    }
  });

  console.log(`Student Email: ${studentEmail}`);
  console.log(`Student Password: password123`);
}

main().catch(console.error).finally(() => db.$disconnect());
