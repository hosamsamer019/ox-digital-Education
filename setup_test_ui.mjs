import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const db = new PrismaClient();

async function main() {
  const TS = Date.now();
  const email = `teacher_ui_${TS}@edu.com`;
  const password = await bcrypt.hash('password123', 10);
  
  // Create teacher
  const teacher = await db.user.create({
    data: { name: 'Teacher UI Test', email, password, role: 'TEACHER' }
  });
  
  // Create courses
  await db.course.create({ data: { title: 'Algebra Course', category: 'Math', teacherId: teacher.id } });
  await db.course.create({ data: { title: 'Geometry Course', category: 'Math', teacherId: teacher.id } });
  
  console.log(`Teacher Email: ${email}`);
  console.log(`Teacher Password: password123`);
}

main().catch(console.error);
