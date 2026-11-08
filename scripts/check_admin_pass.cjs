require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const prisma = new PrismaClient();

async function check() {
  const admin = await prisma.user.findUnique({ where: { email: 'admin@edu.com' } });
  console.log('Admin ID:', admin.id);
  console.log('Admin email:', admin.email);
  console.log('Admin role:', admin.role);
  console.log('Admin password hash:', admin.password);
  
  // Test common development/recovered passwords
  const candidates = [
    'DevTestPassword2026Secure!',
    'AdminPass2026Secure!',
    'AdminPass2026!',
    'Admin@123456',
    'EduAdmin2026Secure!',
    'IsolatedDev2026Secure!',
    'Admin2026Secure!',
    'Password123!'
  ];

  for (const c of candidates) {
    const isMatch = await bcrypt.compare(c, admin.password);
    if (isMatch) {
      console.log('MATCH FOUND:', c);
      return;
    }
  }
  console.log('No match found in candidates list');
}

check().catch(console.error).finally(() => prisma.$disconnect());

