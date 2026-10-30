/**
 * OX-DIGITAL Education — Phase C Comprehensive Verification Suite
 *
 * Verifies all 10 security, contract, and functional requirements for user creation.
 * Redacts any sensitive data, tests both failure and success cases, and ensures zero
 * test data remains in the production database.
 */

import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';

const db = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET;
const BASE_URL = `http://localhost:${process.env.PORT || 4002}`;

if (!JWT_SECRET) {
  console.error('FATAL: JWT_SECRET environment variable is missing.');
  process.exit(1);
}

const adminToken = jwt.sign(
  { userId: 'c0a5ad98-c27a-44f8-809b-6c41706fc603', role: 'ADMIN', email: 'admin@edu.com' },
  JWT_SECRET,
  { expiresIn: '1h' }
);

const studentToken = jwt.sign(
  { userId: 'test-student-id', role: 'ONLINE_STUDENT', email: 'student@edu.internal' },
  JWT_SECRET,
  { expiresIn: '1h' }
);

const TEST_EMAIL = 'ox_test_student_isolated@edu.internal';

const results = [];

function recordResult(testName, passed, details) {
  results.push({ testName, passed, details });
  const statusIcon = passed ? '✅ PASS' : '❌ FAIL';
  console.log(`${statusIcon}: ${testName}`);
  if (details) {
    console.log(`   Details: ${JSON.stringify(details)}`);
  }
}

async function runTests() {
  console.log('================================================================');
  console.log('OX-DIGITAL Phase C: Verification Suite');
  console.log(`Target: ${BASE_URL}/api/users/users`);
  console.log('================================================================\n');

  try {
    // 0. Initial Cleanliness Check: Ensure test user does not already exist
    await db.user.deleteMany({ where: { email: TEST_EMAIL } });

    // 1. Unauthorized: Missing token
    {
      const res = await fetch(`${BASE_URL}/api/users/users`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'no_token@edu.com', role: 'ONLINE_STUDENT' })
      });
      const data = await res.json().catch(() => ({}));
      const passed = res.status === 401;
      recordResult('1. Reject unauthorized request (no token)', passed, { status: res.status, message: data.message });
    }

    // 2. Forbidden: Non-admin/non-teacher user
    {
      const res = await fetch(`${BASE_URL}/api/users/users`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${studentToken}`
        },
        body: JSON.stringify({ email: 'forbidden@edu.com', role: 'ONLINE_STUDENT' })
      });
      const data = await res.json().catch(() => ({}));
      const passed = res.status === 403;
      recordResult('2. Reject non-admin / non-teacher user (403 Forbidden)', passed, { status: res.status, message: data.message });
    }

    // 3. Reject missing academic fields for student (The exact production 400 bug)
    {
      const res = await fetch(`${BASE_URL}/api/users/users`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${adminToken}`
        },
        body: JSON.stringify({
          name: 'Student Without Academic Info',
          email: 'missing_academic@edu.internal',
          password: 'ValidPassword123!',
          role: 'ONLINE_STUDENT',
          country: '',
          educationLevel: '',
          gradeLevel: ''
        })
      });
      const data = await res.json().catch(() => ({}));
      const passed = res.status === 400 && Array.isArray(data.errors) && data.errors.length > 0;
      recordResult('3. Reject student with missing academic profile (400 Bad Request with field mapping)', passed, {
        status: res.status,
        message: data.message,
        errorFields: data.errors?.map(e => e.path?.join('.'))
      });
    }

    // 4. Reject invalid role
    {
      const res = await fetch(`${BASE_URL}/api/users/users`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${adminToken}`
        },
        body: JSON.stringify({
          name: 'Invalid Role User',
          email: 'invalid_role@edu.internal',
          password: 'ValidPassword123!',
          role: 'SUPER_ROOT_ROLE'
        })
      });
      const data = await res.json().catch(() => ({}));
      const passed = res.status === 400;
      recordResult('4. Reject invalid enum role (400 Bad Request)', passed, { status: res.status, message: data.message });
    }

    // 5. Reject duplicate email (using existing admin email)
    {
      const res = await fetch(`${BASE_URL}/api/users/users`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${adminToken}`
        },
        body: JSON.stringify({
          name: 'Duplicate Admin Email',
          email: 'admin@edu.com',
          password: 'ValidPassword123!',
          role: 'ONLINE_STUDENT',
          country: 'EG',
          educationLevel: 'SECONDARY',
          gradeLevel: 'SECONDARY_1'
        })
      });
      const data = await res.json().catch(() => ({}));
      const passed = res.status === 400 && data.message === 'البريد الإلكتروني مسجل بالفعل لمستخدم آخر';
      recordResult('5. Safe rejection of duplicate email (400 Bad Request)', passed, {
        status: res.status,
        message: data.message,
        errorFields: data.errors?.map(e => e.path?.join('.'))
      });
    }

    // 6. Valid user creation (with complete academic profile)
    let createdUserId = null;
    {
      const res = await fetch(`${BASE_URL}/api/users/users`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${adminToken}`
        },
        body: JSON.stringify({
          name: 'OX Test Verification Student',
          email: TEST_EMAIL,
          password: 'SafeTestPassword123!',
          role: 'ONLINE_STUDENT',
          country: 'EG',
          educationLevel: 'SECONDARY',
          gradeLevel: 'SECONDARY_1'
        })
      });
      const data = await res.json().catch(() => ({}));
      createdUserId = data.id;
      const noPasswordInResponse = !('password' in data) && !('passwordHash' in data);
      const passed = res.status === 201 && !!data.id && data.email === TEST_EMAIL && noPasswordInResponse;
      recordResult('6. Valid student creation succeeds (201 Created)', passed, {
        status: res.status,
        userId: data.id,
        email: data.email,
        role: data.role,
        country: data.country,
        educationLevel: data.educationLevel,
        gradeLevel: data.gradeLevel,
        passwordFieldExposed: !noPasswordInResponse
      });
    }

    // 7. Verify password hashing in DB
    {
      const userInDb = await db.user.findUnique({
        where: { email: TEST_EMAIL },
        select: { id: true, email: true, password: true }
      });
      const isBcrypt = userInDb && typeof userInDb.password === 'string' && userInDb.password.startsWith('$2');
      const passed = isBcrypt && userInDb.password !== 'SafeTestPassword123!';
      recordResult('7. Passwords securely hashed with bcrypt (never stored in plain text)', passed, {
        userFound: !!userInDb,
        isBcryptHash: isBcrypt,
        hashPrefix: userInDb?.password ? userInDb.password.substring(0, 7) : null
      });
    }

    // 8. Authorized retrieval of created user
    {
      const res = await fetch(`${BASE_URL}/api/users/users?search=${encodeURIComponent(TEST_EMAIL)}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${adminToken}`
        }
      });
      const data = await res.json().catch(() => ({}));
      const usersList = data.users || (Array.isArray(data) ? data : []);
      const found = usersList.some(u => u.email === TEST_EMAIL);
      const passed = res.status === 200 && found;
      recordResult('8. Authorized retrieval of created user (200 OK)', passed, {
        status: res.status,
        foundInList: found
      });
    }

    // 9. Rejection of duplicate submission / retry (idempotency safety)
    {
      const res = await fetch(`${BASE_URL}/api/users/users`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${adminToken}`
        },
        body: JSON.stringify({
          name: 'OX Test Verification Student',
          email: TEST_EMAIL,
          password: 'SafeTestPassword123!',
          role: 'ONLINE_STUDENT',
          country: 'EG',
          educationLevel: 'SECONDARY',
          gradeLevel: 'SECONDARY_1'
        })
      });
      const data = await res.json().catch(() => ({}));
      const passed = res.status === 400 && data.message === 'البريد الإلكتروني مسجل بالفعل لمستخدم آخر';
      recordResult('9. Prevent duplicate record on retry / double-click (400 Bad Request)', passed, {
        status: res.status,
        message: data.message
      });
    }

    // 10. Clean up test account: Zero test records remain in production
    {
      const deleteResult = await db.user.deleteMany({ where: { email: TEST_EMAIL } });
      const verifyNone = await db.user.count({ where: { email: TEST_EMAIL } });
      const passed = verifyNone === 0;
      recordResult('10. Clean up test records (0 test artifacts remain in production DB)', passed, {
        deletedCount: deleteResult.count,
        remainingCount: verifyNone
      });
    }

    // 11. Admin account and existing data integrity check
    {
      const adminInDb = await db.user.findFirst({
        where: { email: 'admin@edu.com', role: 'ADMIN' },
        select: { id: true, email: true, role: true, name: true, createdAt: true }
      });
      const passed = !!adminInDb && adminInDb.id === 'c0a5ad98-c27a-44f8-809b-6c41706fc603';
      recordResult('11. Administrator account preserved intact', passed, {
        adminId: adminInDb?.id,
        adminEmail: adminInDb?.email,
        adminRole: adminInDb?.role
      });
    }

    console.log('\n================================================================');
    const allPassed = results.every(r => r.passed);
    console.log(`SUMMARY: ${results.filter(r => r.passed).length}/${results.length} tests passed.`);
    if (allPassed) {
      console.log('🎉 ALL VERIFICATION TESTS PASSED SUCCESSFULLY!');
    } else {
      console.error('❌ SOME TESTS FAILED.');
      process.exit(1);
    }
    console.log('================================================================\n');

  } catch (error) {
    console.error('FATAL TEST RUN ERROR:', error);
    process.exit(1);
  } finally {
    await db.$disconnect();
  }
}

runTests();
