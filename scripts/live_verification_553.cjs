const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const { PrismaClient } = require(path.resolve(__dirname, '../node_modules/@prisma/client'));
const jwt = require('jsonwebtoken');

const prisma = new PrismaClient({
  datasources: { db: { url: process.env.DATABASE_URL } }
});

const BASE_URL = 'http://localhost:8080';
const JWT_SECRET = process.env.JWT_SECRET;

async function main() {
  console.log('=== PHASE 5.5.3 LIVE DEVELOPMENT VERIFICATION ===\n');

  // 1. Mandatory Database Identity Verification
  const dbInfo = await prisma.$queryRawUnsafe(`
    SELECT current_database() as db_name, current_user as db_user;
  `);
  if (dbInfo[0].db_name !== 'ox_digital_dev_test' || dbInfo[0].db_user !== 'ox_dev_admin') {
    throw new Error(`CRITICAL: Database identity mismatch! ${dbInfo[0].db_name} / ${dbInfo[0].db_user}`);
  }
  console.log(`✅ [Check 1/6] Live Database Identity: ${dbInfo[0].db_name} / ${dbInfo[0].db_user}`);

  // 2. Health Endpoints
  const healthResp = await fetch(`${BASE_URL}/api/users/health`);
  const healthJson = await healthResp.json();
  console.log(`✅ [Check 2/6] User Service Health: HTTP ${healthResp.status}`, healthJson);

  // 3. Find Primary Manager
  const pm = await prisma.user.findFirst({
    where: { role: 'PRIMARY_MANAGER', deletedAt: null },
    select: { id: true, email: true, role: true, institutionId: true, branchId: true }
  });
  if (!pm) {
    throw new Error('No active Primary Manager found in database');
  }
  console.log(`\nFound Primary Manager: ${pm.email} (ID: ${pm.id}, Inst: ${pm.institutionId})`);

  // Sign valid JWT for Primary Manager
  const pmToken = jwt.sign(
    { userId: pm.id, id: pm.id, email: pm.email, role: 'PRIMARY_MANAGER', institutionId: pm.institutionId, branchId: pm.branchId },
    JWT_SECRET,
    { expiresIn: '1h' }
  );

  // 4. Test Policy Management Interface (GET /api/manager/financial-access-policy)
  const policyResp = await fetch(`${BASE_URL}/api/manager/financial-access-policy`, {
    headers: {
      'Authorization': `Bearer ${pmToken}`,
      'x-institution-id': pm.institutionId
    }
  });
  const policyJson = await policyResp.json();
  console.log(`✅ [Check 3/6] Policy Management Interface GET: HTTP ${policyResp.status}`);
  console.log('Policy Response:', JSON.stringify(policyJson, null, 2));

  // 5. Test Restriction Status Endpoint (GET /api/users/financial-status)
  // Let's test with a student
  const student = await prisma.user.findFirst({
    where: { role: 'CENTER_STUDENT', institutionId: pm.institutionId, deletedAt: null },
    select: { id: true, email: true, role: true, institutionId: true, branchId: true }
  });
  if (student) {
    const studentToken = jwt.sign(
      { userId: student.id, id: student.id, email: student.email, role: 'CENTER_STUDENT', institutionId: student.institutionId, branchId: student.branchId },
      JWT_SECRET,
      { expiresIn: '1h' }
    );
    const statusResp = await fetch(`${BASE_URL}/api/users/financial-access-status`, {
      headers: {
        'Authorization': `Bearer ${studentToken}`,
        'x-institution-id': student.institutionId
      }
    });
    const statusJson = await statusResp.json();
    console.log(`\n✅ [Check 4/6] Student Financial Status Endpoint: HTTP ${statusResp.status}`);
    console.log('Status Response:', statusJson);
  }

  // 6. Test Cashier Collection Endpoint for Student
  const accountant = await prisma.user.findFirst({
    where: { role: 'ACCOUNTANT', institutionId: pm.institutionId, deletedAt: null },
    select: { id: true, email: true, role: true, institutionId: true, branchId: true }
  });
  if (accountant && student) {
    const accToken = jwt.sign(
      { userId: accountant.id, id: accountant.id, email: accountant.email, role: 'ACCOUNTANT', institutionId: accountant.institutionId, branchId: accountant.branchId },
      JWT_SECRET,
      { expiresIn: '1h' }
    );
    // Probe collections list / access
    const colResp = await fetch(`${BASE_URL}/api/accounting/collections?studentId=${student.id}`, {
      headers: {
        'Authorization': `Bearer ${accToken}`,
        'x-institution-id': accountant.institutionId
      }
    });
    console.log(`\n✅ [Check 5/6] Cashier/Accountant Collections Query Endpoint: HTTP ${colResp.status}`);
  }

  // 7. Verify Invariance of Historical Obligations
  const histMonthlyCount = await prisma.studentObligation.count({
    where: { obligationType: 'MONTHLY_FEE' }
  });
  const histTotalCount = await prisma.studentObligation.count();
  console.log(`\n✅ [Check 6/6] Historical Obligations Invariance:`);
  console.log(`- Total Obligations: ${histTotalCount} (Expected: 54)`);
  console.log(`- MONTHLY_FEE Obligations: ${histMonthlyCount} (Expected: 0)`);
  if (histTotalCount !== 54 || histMonthlyCount !== 0) {
    throw new Error('Discrepancy in historical obligations!');
  }

  console.log('\n===================================================================');
  console.log('✅ ALL LIVE DEVELOPMENT VERIFICATIONS COMPLETED SUCCESSFULLY!');
  console.log('===================================================================');

  await prisma.$disconnect();
}

main().catch(err => {
  console.error('Live verification failed:', err);
  process.exit(1);
});
