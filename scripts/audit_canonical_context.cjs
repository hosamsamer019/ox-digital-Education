require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  await prisma.user.update({
    where: { email: 'admin@edu.com' },
    data: {
      institutionId: 'inst_idor_a_91xnz3',
      isPrimaryManager: true
    }
  });

  await prisma.institution.update({
    where: { id: 'inst_idor_a_91xnz3' },
    data: {
      primaryManagerId: 'admin_91xnz3'
    }
  });

  const admin = await prisma.user.findUnique({ where: { email: 'admin@edu.com' } });
  console.log('Updated Admin:', admin.id, admin.email, 'inst:', admin.institutionId, 'isPM:', admin.isPrimaryManager, 'role:', admin.role);

  const inst = await prisma.institution.findUnique({ where: { id: 'inst_idor_a_91xnz3' } });
  console.log('Updated Inst:', inst.id, inst.name, 'PM id:', inst.primaryManagerId);
}

main().catch(console.error).finally(() => prisma.$disconnect());
