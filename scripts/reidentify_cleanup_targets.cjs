const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const { PrismaClient } = require(path.resolve(__dirname, '../node_modules/@prisma/client'));

const db = new PrismaClient({
  datasources: { db: { url: process.env.DATABASE_URL } }
});

async function main() {
  const [ident] = await db.$queryRawUnsafe('SELECT current_database(), current_user, inet_server_port(), inet_server_addr()');
  console.log('=== DB IDENTITY ===', ident);

  const targetBranch1 = '152b6c2a-e5d8-4151-b557-393cd3285632'; // اختبار
  const targetInstB = 'inst_idor_b_w4adp2'; // Institution B w4adp2
  const targetBranchB = 'br_idor_b_w4adp2'; // فرع مدينة نصر
  const targetCourseA = 'crs_a_91xnz3'; // Math A 91xnz3
  const targetCourseB = 'crs_b_w4adp2'; // Math B w4adp2

  console.log('\n--- 1. Target Branch 1 (اختبار) ---');
  const b1 = await db.branch.findUnique({ where: { id: targetBranch1 } });
  console.log('Branch 1 record:', b1);

  console.log('\n--- 2. Target Institution B & Branch B ---');
  const instB = await db.institution.findUnique({ where: { id: targetInstB } });
  console.log('Institution B record:', instB);
  const bB = await db.branch.findUnique({ where: { id: targetBranchB } });
  console.log('Branch B record:', bB);

  console.log('\n--- 3. Target Courses ---');
  const cA = await db.course.findUnique({
    where: { id: targetCourseA },
    include: { exams: true, homeworks: true, lessons: true, enrollments: true }
  });
  console.log('Course A:', {
    id: cA?.id,
    title: cA?.title,
    teacherId: cA?.teacherId,
    institutionId: cA?.institutionId,
    branchId: cA?.branchId,
    exams: cA?.exams?.map(e => ({ id: e.id, title: e.title })),
    homeworks: cA?.homeworks?.map(h => ({ id: h.id, title: h.title })),
    lessonsCount: cA?.lessons?.length,
    enrollmentsCount: cA?.enrollments?.length
  });

  const cB = await db.course.findUnique({
    where: { id: targetCourseB },
    include: { exams: true, homeworks: true, lessons: true, enrollments: true }
  });
  console.log('Course B:', {
    id: cB?.id,
    title: cB?.title,
    teacherId: cB?.teacherId,
    institutionId: cB?.institutionId,
    branchId: cB?.branchId,
    exams: cB?.exams?.map(e => ({ id: e.id, title: e.title })),
    homeworks: cB?.homeworks?.map(h => ({ id: h.id, title: h.title })),
    lessonsCount: cB?.lessons?.length,
    enrollmentsCount: cB?.enrollments?.length
  });

  console.log('\n--- 4. Scanning all tables in database for any reference to targets ---');
  const targets = [
    { type: 'Branch: اختبار', id: targetBranch1 },
    { type: 'Inst: Institution B', id: targetInstB },
    { type: 'Branch: فرع مدينة نصر', id: targetBranchB },
    { type: 'Course: Math A', id: targetCourseA },
    { type: 'Course: Math B', id: targetCourseB },
    { type: 'Exam: Exam A', id: 'ex_a_91xnz3' },
    { type: 'Exam: Exam B', id: 'ex_b_w4adp2' },
    { type: 'HW: HW A', id: 'hw_a_91xnz3' },
    { type: 'HW: HW B', id: 'hw_b_w4adp2' }
  ];

  // Get all columns of type text or character varying or uuid in public schema
  const cols = await db.$queryRawUnsafe(`
    SELECT table_name, column_name 
    FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND data_type IN ('text', 'character varying', 'uuid')
      AND table_name != '_prisma_migrations'
    ORDER BY table_name, column_name;
  `);

  console.log(`Checking ${cols.length} text/uuid columns across database...`);

  for (const t of targets) {
    console.log(`\nChecking references to ${t.type} (ID: ${t.id})...`);
    let matches = [];
    for (const col of cols) {
      try {
        const query = `SELECT count(*) as count FROM "${col.table_name}" WHERE "${col.column_name}"::text = $1;`;
        const res = await db.$queryRawUnsafe(query, t.id);
        const cnt = parseInt(res[0].count, 10);
        if (cnt > 0) {
          matches.push({ table: col.table_name, column: col.column_name, count: cnt });
        }
      } catch (err) {
        // column type mismatch or not searchable, ignore
      }
    }
    console.log(`Found references for ${t.id}:`, matches);
  }

  await db.$disconnect();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});

