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

async function verifyLocalStartup() {
  console.log('================================================================');
  console.log('LOCAL PROJECT STARTUP & LIVE HTTP INGRESS VERIFICATION');
  console.log('================================================================');

  const GATEWAY = 'http://localhost:8080';

  // 1. Frontend Delivery & Public Entry Points
  console.log('\n--- 1. Testing Frontend Delivery Through Gateway (Port 8080) ---');
  const homeRes = await httpRequest(`${GATEWAY}/`);
  console.log(`  GET / status: ${homeRes.statusCode} (HTML length: ${homeRes.body.length})`);
  if (homeRes.statusCode !== 200 || !homeRes.body.includes('<!DOCTYPE html>')) {
    throw new Error('Failed to load frontend root /');
  }

  const loginRes = await httpRequest(`${GATEWAY}/login`);
  console.log(`  GET /login status: ${loginRes.statusCode} (HTML length: ${loginRes.body.length})`);
  if (loginRes.statusCode !== 200 || !loginRes.body.includes('<!DOCTYPE html>')) {
    throw new Error('Failed to load frontend /login');
  }

  const adminLoginRes = await httpRequest(`${GATEWAY}/admin/login`);
  console.log(`  GET /admin/login status: ${adminLoginRes.statusCode} (HTML length: ${adminLoginRes.body.length})`);
  if (adminLoginRes.statusCode !== 200 || !adminLoginRes.body.includes('<!DOCTYPE html>')) {
    throw new Error('Failed to load frontend /admin/login');
  }

  // 2. Backend Health Checks
  console.log('\n--- 2. Testing Backend Service Health ---');
  const userHealth = await httpRequest(`${GATEWAY}/api/users/health`);
  console.log(`  GET /api/users/health status: ${userHealth.statusCode} (Body: ${JSON.stringify(userHealth.body)})`);
  if (userHealth.statusCode !== 200 || userHealth.body?.status !== 'OK') {
    throw new Error('User Service health check failed');
  }

  // 3. Create Isolated Test Fixture Set (Manager, Teacher, Accountant, Student, Parent)
  console.log('\n--- 3. Setting Up Ephemeral Verification Accounts ---');
  const suffix = Date.now();
  const rawPass = 'StartupTest@2026!Secured';
  const hashedPass = await bcrypt.hash(rawPass, 10);

  const inst = await db.institution.findFirst();
  const branch = await db.branch.create({
    data: {
      name: `Startup Branch ${suffix}`,
      code: `SB${suffix.toString().slice(-4)}`,
      institutionId: inst.id,
      status: 'ACTIVE'
    }
  });

  const manager = await db.user.create({
    data: {
      email: `mgr.${suffix}@startup.com`,
      password: hashedPass,
      name: `Manager ${suffix}`,
      role: 'PRIMARY_MANAGER',
      institutionId: inst.id
    }
  });

  const teacher = await db.user.create({
    data: {
      email: `teach.${suffix}@startup.com`,
      password: hashedPass,
      name: `Teacher ${suffix}`,
      role: 'TEACHER',
      institutionId: inst.id,
      branchId: branch.id
    }
  });

  const accountant = await db.user.create({
    data: {
      email: `acc.${suffix}@startup.com`,
      password: hashedPass,
      name: `Accountant ${suffix}`,
      role: 'ACCOUNTANT',
      institutionId: inst.id,
      branchId: branch.id
    }
  });

  const parent = await db.user.create({
    data: {
      email: `parent.${suffix}@startup.com`,
      password: hashedPass,
      name: `Parent ${suffix}`,
      role: 'PARENT',
      institutionId: inst.id
    }
  });

  const student = await db.user.create({
    data: {
      email: `stud.${suffix}@startup.com`,
      password: hashedPass,
      name: `Student ${suffix}`,
      role: 'CENTER_STUDENT',
      institutionId: inst.id,
      branchId: branch.id,
      responsibleTeacherId: teacher.id,
      creatorId: teacher.id,
      parentId: parent.id
    }
  });

  await db.studentTeacher.create({
    data: {
      studentId: student.id,
      teacherId: teacher.id,
      creatorId: teacher.id,
      accessStatus: 'ACTIVE'
    }
  });

  const testUserIds = [manager.id, teacher.id, accountant.id, parent.id, student.id];
  console.log(`  Provisioned 5 ephemeral verification accounts for live HTTP workflow testing.`);

  // 4. Live Login & Role Dashboards
  console.log('\n--- 4. Live Authentication & Role-Based Workflows via Ingress ---');

  async function loginAndGetToken(email, role) {
    const res = await httpRequest(`${GATEWAY}/api/auth/login`, {
      method: 'POST'
    }, JSON.stringify({ email, password: rawPass, role }));
    if (res.statusCode !== 200 || !res.body?.token) {
      throw new Error(`Login failed for ${role}: ${res.statusCode} ${JSON.stringify(res.body)}`);
    }
    return res.body.token;
  }

  // A. Primary Manager
  const managerToken = await loginAndGetToken(manager.email, 'PRIMARY_MANAGER');
  console.log('  [PASS] Primary Manager Login successful (JWT acquired)');
  const mgrBranches = await httpRequest(`${GATEWAY}/api/users/manager/branches`, {
    headers: { Authorization: `Bearer ${managerToken}` }
  });
  console.log(`  Primary Manager GET /manager/branches status: ${mgrBranches.statusCode} (Count: ${mgrBranches.body?.data?.length})`);
  const mgrStudents = await httpRequest(`${GATEWAY}/api/users/manager/students`, {
    headers: { Authorization: `Bearer ${managerToken}` }
  });
  console.log(`  Primary Manager GET /manager/students status: ${mgrStudents.statusCode} (Count: ${mgrStudents.body?.data?.length})`);
  if (mgrBranches.statusCode !== 200 || mgrStudents.statusCode !== 200) {
    throw new Error('Primary Manager dashboard API failed');
  }
  console.log('  [PASS] Primary Manager Dashboard workflows verified live.');

  // B. Teacher
  const teacherToken = await loginAndGetToken(teacher.email, 'TEACHER');
  console.log('  [PASS] Teacher Login successful (JWT acquired)');
  const teacherStudents = await httpRequest(`${GATEWAY}/api/users/teacher/my-students`, {
    headers: { Authorization: `Bearer ${teacherToken}` }
  });
  console.log(`  Teacher GET /teacher/my-students status: ${teacherStudents.statusCode} (Count: ${teacherStudents.body?.data?.length})`);
  if (teacherStudents.statusCode !== 200 || teacherStudents.body?.data?.length !== 1) {
    throw new Error('Teacher my-students API failed');
  }
  console.log('  [PASS] Teacher Dashboard workflow verified live.');

  // C. Accountant
  const accountantToken = await loginAndGetToken(accountant.email, 'ACCOUNTANT');
  console.log('  [PASS] Accountant Login successful (JWT acquired)');
  const accStudents = await httpRequest(`${GATEWAY}/api/users/accountant/students`, {
    headers: { Authorization: `Bearer ${accountantToken}` }
  });
  console.log(`  Accountant GET /accountant/students status: ${accStudents.statusCode} (Count: ${accStudents.body?.data?.length})`);
  const accReceipts = await httpRequest(`${GATEWAY}/api/users/accountant/receipts`, {
    headers: { Authorization: `Bearer ${accountantToken}` }
  });
  console.log(`  Accountant GET /accountant/receipts status: ${accReceipts.statusCode} (Count: ${accReceipts.body?.data?.length})`);
  if (accStudents.statusCode !== 200 || accReceipts.statusCode !== 200) {
    throw new Error('Accountant dashboard API failed');
  }
  console.log('  [PASS] Accountant Dashboard workflow verified live.');

  // D. Student Self-Service
  const studentToken = await loginAndGetToken(student.email, 'CENTER_STUDENT');
  console.log('  [PASS] Center Student Login successful (JWT acquired)');
  const studentSubs = await httpRequest(`${GATEWAY}/api/users/subscriptions/my-subscriptions`, {
    headers: { Authorization: `Bearer ${studentToken}` }
  });
  console.log(`  Student GET /subscriptions/my-subscriptions status: ${studentSubs.statusCode}`);
  if (studentSubs.statusCode !== 200) {
    throw new Error('Student self-service subscriptions API failed');
  }
  console.log('  [PASS] Student Self-Service workflow verified live.');

  // E. Parent Self-Service
  const parentToken = await loginAndGetToken(parent.email, 'PARENT');
  console.log('  [PASS] Parent Login successful (JWT acquired)');
  const parentSubs = await httpRequest(`${GATEWAY}/api/users/subscriptions/my-subscriptions`, {
    headers: { Authorization: `Bearer ${parentToken}` }
  });
  console.log(`  Parent GET /subscriptions/my-subscriptions status: ${parentSubs.statusCode}`);
  if (parentSubs.statusCode !== 200) {
    throw new Error('Parent self-service subscriptions API failed');
  }
  console.log('  [PASS] Parent Self-Service workflow verified live.');

  // 5. Unauthenticated Protected Route Rejection
  console.log('\n--- 5. Testing Unauthenticated Request Rejection ---');
  const unauthRes = await httpRequest(`${GATEWAY}/api/users/manager/branches`);
  console.log(`  GET /manager/branches without token status: ${unauthRes.statusCode} (Expected: 401)`);
  if (unauthRes.statusCode !== 401) {
    throw new Error(`Expected 401 for unauthenticated request, got ${unauthRes.statusCode}`);
  }
  console.log('  [PASS] Unauthenticated access properly rejected by gateway with 401.');

  // 6. Cleanup
  console.log('\n--- 6. Cleaning Up Ephemeral Verification Accounts ---');
  await db.studentTeacher.deleteMany({ where: { studentId: student.id } });
  await db.user.deleteMany({ where: { id: { in: testUserIds } } });
  await db.branch.deleteMany({ where: { id: branch.id } });
  console.log('  Ephemeral test accounts cleaned up. Zero operational records touched.');

  await db.$disconnect();
  console.log('\n================================================================');
  console.log('LOCAL PROJECT STARTUP VERIFICATION COMPLETED (100% PASS)');
  console.log('================================================================');
}

verifyLocalStartup().catch(err => {
  console.error('Fatal startup verification error:', err);
  process.exit(1);
});
