import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const db = new PrismaClient();

async function main() {
  if (process.env.NODE_ENV === 'production') {
    console.warn('⚠️ Seeding is disabled in production environments.');
    return;
  }

  // 1. Check if an administrator account already exists
  const existingAdmin = await db.user.findFirst({
    where: {
      OR: [
        { role: 'ADMIN' },
        { email: 'admin@edu.com' }
      ]
    },
    select: {
      id: true,
      email: true,
      role: true
    }
  });

  if (existingAdmin) {
    console.log(`ℹ️ Existing administrator account verified (${existingAdmin.email}). Existing credentials preserved intact.`);
    return;
  }

  // 2. Initial Administrator Bootstrap: requires explicit environment configuration
  const initialPassword = process.env.INITIAL_ADMIN_PASSWORD;

  if (!initialPassword || initialPassword.length < 8) {
    console.warn('⚠️ No administrator account found.');
    console.warn('   Initial administrator creation requires setting the INITIAL_ADMIN_PASSWORD environment variable (minimum 8 characters).');
    console.warn('   Hardcoded default passwords are prohibited. No account created.');
    return;
  }

  const hash = await bcrypt.hash(initialPassword, 10);
  await db.user.create({
    data: {
      email: 'admin@edu.com',
      password: hash,
      name: 'Administrator',
      role: 'ADMIN'
    }
  });

  console.log('✅ Initial administrator account created safely with explicit credentials.');
}

main()
  .catch((e) => {
    console.error('❌ Seed execution error:', e.message);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
