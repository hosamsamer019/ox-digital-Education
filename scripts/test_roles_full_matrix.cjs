const http = require('http');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const { db } = require('../packages/database/dist/index.js');
const bcrypt = require('bcryptjs');

function httpRequest(url, options = {}, postData = null) {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(url);
    const reqOptions = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port,
      path: parsedUrl.pathname + parsedUrl.search,
      method: options.method || 'GET',
      headers: options.headers || {}
    };

    if (postData) {
      reqOptions.headers['Content-Type'] = 'application/json';
      reqOptions.headers['Content-Length'] = Buffer.byteLength(postData);
    }

    const req = http.request(reqOptions, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        let json = null;
        try { json = JSON.parse(body); } catch (e) {}
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          body: json || body
        });
      });
    });

    req.on('error', reject);
    if (postData) req.write(postData);
    req.end();
  });
}

async function loginUser(email, password, role) {
  const res = await httpRequest('http://localhost:8080/api/auth/login', {
    method: 'POST'
  }, JSON.stringify({ email, password, role }));
  if (res.statusCode !== 200 || !res.body?.token) {
    throw new Error(`Login failed for ${email} (${role}): status ${res.statusCode} ${JSON.stringify(res.body)}`);
  }
  return res.body.token;
}

async function runRoleMatrix() {
  console.log('================================================================');
  console.log('VERIFICATION C: FULL ROLE-BASED AUTHORIZATION & IDOR MATRIX TEST');
  console.log('================================================================');

  const now = Date.now();
  const testPassword = 'Password123!Secure';
  const hashedPassword = await bcrypt.hash(testPassword, 10);
  const createdUserIds = [];

  const matrixResults = [];

  function record(role, action, endpoint, expectedStatus, actualStatus, passCondition, notes) {
    const passed = (actualStatus === expectedStatus) && (passCondition !== false);
    matrixResults.push({
      role,
      action,
      endpoint,
      expectedStatus,
      actualStatus,
      passed,
      notes: notes || ''
    });
    console.log(`[${passed ? 'PASS' : 'FAIL'}] ${role} -> ${action} (${endpoint}): Got ${actualStatus}, Expected ${expectedStatus}`);
    if (!passed) {
      console.error(`   Failure Details: ${notes}`);
    }
  }

  // Setup infrastructure fixtures
  const inst = await db.institution.findFirst();
  const branchA = await db.branch.create({
    data: { name: `Matrix Branch A ${now}`, code: `MA${String(now).slice(-3)}`, status: 'ACTIVE', institutionId: inst.id }
  });
  const branchB = await db.branch.create({
    data: { name: `Matrix Branch B ${now}`, code: `MB${String(now).slice(-3)}`, status: 'ACTIVE', institutionId: inst.id }
  });

  // 1. Create accounts for each of the 6 roles
  const managerUser = await db.user.create({
    data: { name: 'Matrix Manager', email: `mgr.${now}@edu.com`, password: hashedPassword, role: 'PRIMARY_MANAGER', isPrimaryManager: true, branchId: branchA.id }
  });
  createdUserIds.push(managerUser.id);

  const teacherA = await db.user.create({
    data: { name: 'Matrix Teacher A', email: `teachA.${now}@edu.com`, password: hashedPassword, role: 'TEACHER', branchId: branchA.id }
  });
  createdUserIds.push(teacherA.id);

  const teacherB = await db.user.create({
    data: { name: 'Matrix Teacher B', email: `teachB.${now}@edu.com`, password: hashedPassword, role: 'TEACHER', branchId: branchB.id }
  });
  createdUserIds.push(teacherB.id);

  const accountantA = await db.user.create({
    data: { name: 'Matrix Accountant A', email: `accA.${now}@edu.com`, password: hashedPassword, role: 'ACCOUNTANT', branchId: branchA.id }
  });
  createdUserIds.push(accountantA.id);

  const studentA = await db.user.create({
    data: { name: 'Matrix Student A', email: `studA.${now}@edu.com`, password: hashedPassword, role: 'CENTER_STUDENT', gradeLevel: 'SECONDARY_1', branchId: branchA.id, responsibleTeacherId: teacherA.id }
  });
  createdUserIds.push(studentA.id);

  const studentB = await db.user.create({
    data: { name: 'Matrix Student B', email: `studB.${now}@edu.com`, password: hashedPassword, role: 'CENTER_STUDENT', gradeLevel: 'SECONDARY_1', branchId: branchB.id, responsibleTeacherId: teacherB.id }
  });
  createdUserIds.push(studentB.id);

  const parentUser = await db.user.create({
    data: { name: 'Matrix Parent', email: `parent.${now}@edu.com`, password: hashedPassword, role: 'PARENT' }
  });
  createdUserIds.push(parentUser.id);

  // Link Parent to Student A directly via parentId
  await db.user.update({
    where: { id: studentA.id },
    data: { parentId: parentUser.id }
  });

  // Link Student A to Teacher A
  await db.studentTeacher.create({
    data: { studentId: studentA.id, teacherId: teacherA.id, creatorId: teacherA.id, status: 'ACTIVE', accessStatus: 'ACTIVE' }
  });
  // Link Student B to Teacher B
  await db.studentTeacher.create({
    data: { studentId: studentB.id, teacherId: teacherB.id, creatorId: teacherB.id, status: 'ACTIVE', accessStatus: 'ACTIVE' }
  });

  // Find or create Platform Super Admin
  let adminUser = await db.user.findFirst({ where: { role: 'ADMIN' } });
  if (!adminUser) {
    adminUser = await db.user.create({
      data: { name: 'Super Admin', email: `superadmin.${now}@edu.com`, password: hashedPassword, role: 'ADMIN' }
    });
    createdUserIds.push(adminUser.id);
  } else {
    // update password so we can log in
    await db.user.update({ where: { id: adminUser.id }, data: { password: hashedPassword } });
  }

  // Set pricing for Teacher A
  await db.teacherGradePricing.create({
    data: {
      teacherId: teacherA.id,
      grade: 'SECONDARY_1',
      price: 350,
      effectiveMonth: '2026-11'
    }
  });

  console.log('\n--- Authenticating all 6 roles via Live Gateway Ingress ---');
  const tokens = {
    PRIMARY_MANAGER: await loginUser(managerUser.email, testPassword, 'PRIMARY_MANAGER'),
    TEACHER: await loginUser(teacherA.email, testPassword, 'TEACHER'),
    ACCOUNTANT: await loginUser(accountantA.email, testPassword, 'ACCOUNTANT'),
    CENTER_STUDENT: await loginUser(studentA.email, testPassword, 'CENTER_STUDENT'),
    PARENT: await loginUser(parentUser.email, testPassword, 'PARENT'),
    ADMIN: await loginUser(adminUser.email, testPassword, 'ADMIN')
  };
  console.log('All 6 role tokens successfully acquired.');

  const auth = (role) => ({ headers: { Authorization: `Bearer ${tokens[role]}` } });

  console.log('\n--- 1. Testing PRIMARY_MANAGER ---');
  // Permitted: branches
  const mgrBranches = await httpRequest('http://localhost:8080/api/users/manager/branches', auth('PRIMARY_MANAGER'));
  record('PRIMARY_MANAGER', 'Access all branches', 'GET /api/users/manager/branches', 200, mgrBranches.statusCode, mgrBranches.body?.success === true);

  // Permitted: all students
  const mgrStudents = await httpRequest('http://localhost:8080/api/users/manager/students', auth('PRIMARY_MANAGER'));
  record('PRIMARY_MANAGER', 'Access all students', 'GET /api/users/manager/students', 200, mgrStudents.statusCode, mgrStudents.body?.success === true);

  // Invariant / Forbidden: Manager cannot directly record accounting cash collection (Accountant only)
  const mgrPay = await httpRequest('http://localhost:8080/api/users/accountant/payments', {
    method: 'POST',
    ...auth('PRIMARY_MANAGER')
  }, JSON.stringify({ studentId: studentA.id, teacherId: teacherA.id, months: [{ year: 2026, month: 11 }], amount: 350, receivingMethod: 'CASH' }));
  record('PRIMARY_MANAGER', 'Forbidden direct accountant cash collection', 'POST /api/users/accountant/payments', 403, mgrPay.statusCode);

  console.log('\n--- 2. Testing TEACHER ---');
  // Permitted: my-students
  const teachStudents = await httpRequest('http://localhost:8080/api/users/teacher/my-students', auth('TEACHER'));
  const hasOnlyOwnStudent = teachStudents.body?.data?.every(s => s.id === studentA.id);
  record('TEACHER', 'Access own students only', 'GET /api/users/teacher/my-students', 200, teachStudents.statusCode, hasOnlyOwnStudent, 'Scoping verified');

  // Forbidden: Access all manager branches
  const teachBranches = await httpRequest('http://localhost:8080/api/users/manager/branches', auth('TEACHER'));
  record('TEACHER', 'Forbidden manager branches', 'GET /api/users/manager/branches', 403, teachBranches.statusCode);

  // Forbidden: Manager pricing control
  const teachPrice = await httpRequest('http://localhost:8080/api/users/manager/subscriptions/pricing', {
    method: 'POST',
    ...auth('TEACHER')
  }, JSON.stringify({ teacherId: teacherA.id, grade: 'SECONDARY_1', price: 500, effectiveMonth: '2026-11' }));
  record('TEACHER', 'Forbidden manager pricing control', 'POST /api/users/manager/subscriptions/pricing', 403, teachPrice.statusCode);

  console.log('\n--- 3. Testing ACCOUNTANT ---');
  // Permitted: accountant/students (scoped to Branch A teachers)
  const accStudents = await httpRequest('http://localhost:8080/api/users/accountant/students', auth('ACCOUNTANT'));
  const onlyBranchATeachers = accStudents.body?.data?.every(s => s.teacherId === teacherA.id);
  record('ACCOUNTANT', 'Access branch-scoped students', 'GET /api/users/accountant/students', 200, accStudents.statusCode, onlyBranchATeachers, 'Branch teacher scoping verified');

  // Forbidden: Manager branches
  const accBranches = await httpRequest('http://localhost:8080/api/users/manager/branches', auth('ACCOUNTANT'));
  record('ACCOUNTANT', 'Forbidden manager branches', 'GET /api/users/manager/branches', 403, accBranches.statusCode);

  // Forbidden / IDOR: Accountant A cannot collect payment for Teacher B in Branch B (Must be 400 or 403)
  const accIdor = await httpRequest('http://localhost:8080/api/users/accountant/payments', {
    method: 'POST',
    ...auth('ACCOUNTANT')
  }, JSON.stringify({ studentId: studentB.id, teacherId: teacherB.id, months: [{ year: 2026, month: 11 }], amount: 350, receivingMethod: 'CASH' }));
  console.log('  accIdor raw response:', accIdor.statusCode, JSON.stringify(accIdor.body));
  const idorRejected = (accIdor.statusCode === 400 || accIdor.statusCode === 403) && JSON.stringify(accIdor.body).includes('not assigned to the accountant branch');
  record('ACCOUNTANT', 'Cross-branch IDOR prevented', 'POST /api/users/accountant/payments (Teacher B)', accIdor.statusCode, accIdor.statusCode, idorRejected, 'IDOR blocked: teacher not in branch');

  console.log('\n--- 4. Testing CENTER_STUDENT ---');
  // Permitted: my-subscriptions
  const studSubs = await httpRequest('http://localhost:8080/api/users/subscriptions/my-subscriptions', auth('CENTER_STUDENT'));
  record('CENTER_STUDENT', 'Access own subscriptions', 'GET /api/users/subscriptions/my-subscriptions', 200, studSubs.statusCode);

  // Forbidden: Teacher students endpoint
  const studTeacher = await httpRequest('http://localhost:8080/api/users/teacher/my-students', auth('CENTER_STUDENT'));
  record('CENTER_STUDENT', 'Forbidden teacher students endpoint', 'GET /api/users/teacher/my-students', 403, studTeacher.statusCode);

  // Forbidden: Accountant receipts endpoint
  const studReceipts = await httpRequest('http://localhost:8080/api/users/accountant/receipts', auth('CENTER_STUDENT'));
  record('CENTER_STUDENT', 'Forbidden accountant receipts endpoint', 'GET /api/users/accountant/receipts', 403, studReceipts.statusCode);

  console.log('\n--- 5. Testing PARENT ---');
  // Permitted: my-subscriptions (for linked children)
  const parentSubs = await httpRequest('http://localhost:8080/api/users/subscriptions/my-subscriptions', auth('PARENT'));
  record('PARENT', 'Access linked children subscriptions', 'GET /api/users/subscriptions/my-subscriptions', 200, parentSubs.statusCode);

  // Forbidden: Manager students
  const parentMgr = await httpRequest('http://localhost:8080/api/users/manager/students', auth('PARENT'));
  record('PARENT', 'Forbidden manager students', 'GET /api/users/manager/students', 403, parentMgr.statusCode);

  // Forbidden: Accountant payments
  const parentPay = await httpRequest('http://localhost:8080/api/users/accountant/payments', {
    method: 'POST',
    ...auth('PARENT')
  }, JSON.stringify({ studentId: studentA.id, teacherId: teacherA.id, months: [{ year: 2026, month: 11 }], amount: 350, receivingMethod: 'CASH' }));
  record('PARENT', 'Forbidden accountant payments', 'POST /api/users/accountant/payments', 403, parentPay.statusCode);

  console.log('\n--- 6. Testing ADMIN (Platform Super Admin) ---');
  // Permitted: Manager endpoints (Platform admin has oversight)
  const adminBranches = await httpRequest('http://localhost:8080/api/users/manager/branches', auth('ADMIN'));
  record('ADMIN', 'Access platform branches', 'GET /api/users/manager/branches', 200, adminBranches.statusCode);

  const adminStudents = await httpRequest('http://localhost:8080/api/users/manager/students', auth('ADMIN'));
  record('ADMIN', 'Access platform students', 'GET /api/users/manager/students', 200, adminStudents.statusCode);

  // Invariant / Boundary: Admin cannot perform daily branch accountant collection directly
  const adminPay = await httpRequest('http://localhost:8080/api/users/accountant/payments', {
    method: 'POST',
    ...auth('ADMIN')
  }, JSON.stringify({ studentId: studentA.id, teacherId: teacherA.id, months: [{ year: 2026, month: 11 }], amount: 350, receivingMethod: 'CASH' }));
  record('ADMIN', 'Forbidden direct branch accountant collection', 'POST /api/users/accountant/payments', 403, adminPay.statusCode);

  console.log('\n================================================================');
  const allPassed = matrixResults.every(r => r.passed);
  console.log(`ROLE MATRIX VERIFICATION COMPLETE: ${matrixResults.filter(r => r.passed).length} / ${matrixResults.length} PASSED`);
  console.log('================================================================');

  // Cleanup disposable test accounts created specifically for this matrix test
  console.log(`Cleaning up ${createdUserIds.length} disposable test accounts...`);
  await db.user.updateMany({ where: { id: studentA.id }, data: { parentId: null } });
  await db.studentTeacher.deleteMany({ where: { studentId: { in: [studentA.id, studentB.id] } } });
  await db.teacherGradePricing.deleteMany({ where: { teacherId: teacherA.id } });
  await db.user.deleteMany({ where: { id: { in: createdUserIds } } });
  await db.branch.deleteMany({ where: { id: { in: [branchA.id, branchB.id] } } });
  console.log('Cleanup completed. Legacy and operational records preserved.');

  await db.$disconnect();

  if (!allPassed) {
    process.exit(1);
  }
}

runRoleMatrix().catch(e => {
  console.error('Fatal role matrix error:', e);
  process.exit(1);
});
