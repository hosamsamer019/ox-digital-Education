const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: 'postgresql://ox_dev_admin:r72a-8DsHuifYR1tFg4NMCzH5EXdHlrTkYW-WXShSaM@127.0.0.1:5433/ox_digital_dev_test?schema=public'
    }
  }
});

async function main() {
  const [ident] = await prisma.$queryRawUnsafe('SELECT current_database() as db, inet_server_addr() as host, inet_server_port() as port, current_user as usr;');
  console.log('Connected to DB:', ident);

  const branches = await prisma.branch.findMany({
    select: {
      id: true,
      name: true,
      code: true,
      institutionId: true,
      status: true,
      deletedAt: true,
      createdAt: true,
      phone: true
    },
    orderBy: { createdAt: 'asc' }
  });
  console.log('\n=== BRANCHES (' + branches.length + ') ===');
  console.table(branches);

  const insts = await prisma.institution.findMany({
    select: {
      id: true,
      name: true,
      code: true,
      status: true,
      deletedAt: true,
      createdAt: true
    },
    orderBy: { createdAt: 'asc' }
  });
  console.log('\n=== INSTITUTIONS (' + insts.length + ') ===');
  console.table(insts);

  // Check relationship of each branch
  console.log('\n=== BRANCH-INSTITUTION LINKAGES ===');
  for (const b of branches) {
    const parent = insts.find(i => i.id === b.institutionId);
    console.log(`Branch [${b.code}] "${b.name}" (ID: ${b.id}) -> Institution [${parent?.code || 'ORPHAN'}] "${parent?.name || 'NOT FOUND'}" (ID: ${b.institutionId})`);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
