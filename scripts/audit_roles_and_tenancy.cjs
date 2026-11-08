const { PrismaClient } = require('@prisma/client');
require('dotenv').config({ path: 'D:/OX-DIGITAL/Mathe/OX-DIGITAL-GITHUB/.env' });

const dbUrl = process.env.DATABASE_URL || 'postgresql://ox_dev_admin:IsolatedDev2026Secure!@127.0.0.1:5433/ox_digital_dev_test?schema=public';
const prisma = new PrismaClient({ datasources: { db: { url: dbUrl } } });

async function audit() {
  console.log('=== INSTITUTIONS ===');
  const institutions = await prisma.institution.findMany({
    include: {
      branches: true,
      primaryManager: { select: { id: true, email: true, name: true, role: true } }
    }
  });
  console.log(JSON.stringify(institutions, null, 2));

  console.log('\n=== PRIMARY MANAGERS ===');
  const pms = await prisma.user.findMany({
    where: { role: 'PRIMARY_MANAGER' },
    select: {
      id: true,
      email: true,
      name: true,
      institutionId: true,
      branchId: true,
      mustChangePassword: true,
      institution: { select: { id: true, name: true, code: true, primaryManagerId: true } },
      branch: { select: { id: true, name: true, code: true } }
    }
  });
  console.log(JSON.stringify(pms, null, 2));

  console.log('\n=== SAMPLE OF EACH ROLE ===');
  const roles = ['ADMIN', 'PRIMARY_MANAGER', 'ACCOUNTANT', 'ONLINE_STUDENT', 'CENTER_STUDENT', 'PARENT', 'TEACHER'];
  for (const r of roles) {
    const users = await prisma.user.findMany({
      where: { role: r },
      take: 2,
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        institutionId: true,
        branchId: true,
        parentId: true,
        mustChangePassword: true
      }
    });
    console.log(`Role [${r}] (${users.length} found):`, users);
  }

  console.log('\n=== PARENT-CHILD LINKS ===');
  const parentsWithChildren = await prisma.user.findMany({
    where: { role: 'PARENT' },
    take: 3,
    select: {
      id: true,
      email: true,
      name: true,
      children: {
        select: { id: true, email: true, name: true, role: true, branchId: true }
      }
    }
  });
  console.log(JSON.stringify(parentsWithChildren, null, 2));

  await prisma.$disconnect();
}

audit().catch(e => {
  console.error(e);
  process.exit(1);
});
