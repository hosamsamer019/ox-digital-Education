import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const db = new PrismaClient();

const ACCOUNTS = [
  {
    name: 'OX-DIGITAL Administrator',
    email: 'admin@edu.com',
    password: process.env.ADMIN_PASSWORD || 'Admin123456!',
    role: 'ADMIN'
  },
  {
    name: 'Professor Ahmed (Teacher)',
    email: 'teacher@edu.com',
    password: process.env.TEACHER_PASSWORD || 'Password123!',
    role: 'TEACHER'
  },
  {
    name: 'Omar Ali (Student)',
    email: 'student@edu.com',
    password: process.env.STUDENT_PASSWORD || 'Password123!',
    role: 'ONLINE_STUDENT'
  },
  {
    name: 'Ali Hassan (Parent)',
    email: 'parent@edu.com',
    password: process.env.PARENT_PASSWORD || 'Password123!',
    role: 'PARENT'
  }
];

async function main() {
  console.log('================================================================');
  console.log('OX-DIGITAL Education — Standard Accounts Bootstrapper');
  console.log('================================================================\n');

  let parentId = null;
  let studentId = null;

  for (const acc of ACCOUNTS) {
    const existing = await db.user.findFirst({
      where: { email: acc.email }
    });

    const hash = await bcrypt.hash(acc.password, 10);

    if (existing) {
      const updated = await db.user.update({
        where: { id: existing.id },
        data: {
          password: hash,
          name: acc.name,
          role: acc.role
        }
      });
      console.log(`✅ [UPDATED] ${acc.role.padEnd(14)} : ${acc.email} (${acc.name})`);
      if (acc.role === 'PARENT') parentId = updated.id;
      if (acc.role === 'ONLINE_STUDENT') studentId = updated.id;
    } else {
      const created = await db.user.create({
        data: {
          email: acc.email,
          password: hash,
          name: acc.name,
          role: acc.role
        }
      });
      console.log(`✅ [CREATED] ${acc.role.padEnd(14)} : ${acc.email} (${acc.name})`);
      if (acc.role === 'PARENT') parentId = created.id;
      if (acc.role === 'ONLINE_STUDENT') studentId = created.id;
    }
  }

  // Link Parent to Student
  if (parentId && studentId) {
    await db.user.update({
      where: { id: studentId },
      data: { parentId }
    });
    console.log('\n🔗 Successfully linked Student (student@edu.com) to Parent (parent@edu.com).');
  }

  console.log('\n================================================================');
  console.log('All standard accounts bootstrapped successfully!');
  console.log('================================================================');
}

main()
  .catch((err) => {
    console.error('❌ Bootstrap failed:', err.message);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
