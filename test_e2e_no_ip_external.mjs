import axios from 'axios';
import { PrismaClient } from '@prisma/client';

const _testAdminPassword = process.env.TEST_ADMIN_PASSWORD || process.env.TEST_PASSWORD;
if (!_testAdminPassword) {
  console.error('❌ Environment configuration error: TEST_ADMIN_PASSWORD or TEST_PASSWORD must be configured in environment to run test_e2e_no_ip_external.mjs.');
  process.exit(1);
}


const db = new PrismaClient();
const AUTH_URL = 'http://localhost:4001/api/auth';
const USERS_URL = 'http://localhost:4002/api/users';
const COURSE_URL = 'http://localhost:4004/api/courses';
const ASSESS_URL = 'http://localhost:4004/api/assessments';

const RUN_ID = Date.now();
const results = [];

function log(testName, pass, details = '') {
  results.push({ testName, pass, details });
  console.log(`${pass ? '✅' : '❌'} ${testName}: ${details}`);
}

async function run() {
  console.log('\n======================================================');
  console.log('   Math Platform External Exam — Complete No-IP Verification');
  console.log(`   Timestamp: ${RUN_ID}`);
  console.log('======================================================\n');

  let adminToken, teacherToken, courseId, openExamId, openExamCode, closedExamId, closedExamCode, normalExamId, normalExamCode;

  try {
    // Setup Admin
    const adminRes = await axios.post(`${AUTH_URL}/login`, {
      email: 'admin@edu.com',
      password: (process.env.TEST_ADMIN_PASSWORD || process.env.TEST_PASSWORD),
      role: 'ADMIN'
    });
    adminToken = adminRes.data.token;

    // Setup Teacher
    const teacherEmail = `t_${RUN_ID}@edu.com`;
    await axios.post(`${USERS_URL}/users`, {
      name: `Teacher ${RUN_ID}`,
      email: teacherEmail,
      password: 'password123',
      role: 'TEACHER'
    }, { headers: { Authorization: `Bearer ${adminToken}` } });

    const teacherLogin = await axios.post(`${AUTH_URL}/login`, {
      email: teacherEmail,
      password: 'password123',
      role: 'TEACHER'
    });
    teacherToken = teacherLogin.data.token;

    // Create course
    const courseRes = await axios.post(`${COURSE_URL}`, {
      title: `Course ${RUN_ID}`,
      description: 'Test Course'
    }, { headers: { Authorization: `Bearer ${teacherToken}` } });
    courseId = courseRes.data.id;

    // Create 1: Open external exam
    const openExamRes = await axios.post(`${ASSESS_URL}`, {
      title: `Open External Exam ${RUN_ID}`,
      courseId,
      type: 'EXAM',
      allowExternalStudents: true,
      questions: [
        { id: 'q1', text: '1 + 1 = ?', type: 'mcq', options: ['1', '2', '3'], correct: '2', points: 10 }
      ]
    }, { headers: { Authorization: `Bearer ${teacherToken}` } });
    openExamId = openExamRes.data.id;
    openExamCode = openExamRes.data.examAccessCode;

    // Create 2: Closed external exam (closed in past)
    const closedExamRes = await axios.post(`${ASSESS_URL}`, {
      title: `Closed External Exam ${RUN_ID}`,
      courseId,
      type: 'EXAM',
      allowExternalStudents: true,
      closeAt: new Date(Date.now() - 3600000).toISOString(),
      questions: [
        { id: 'q1', text: '2 + 2 = ?', type: 'mcq', options: ['4', '5'], correct: '4', points: 10 }
      ]
    }, { headers: { Authorization: `Bearer ${teacherToken}` } });
    closedExamId = closedExamRes.data.id;
    closedExamCode = closedExamRes.data.examAccessCode;

    // Create 3: Normal exam (allowExternalStudents = false)
    const normalExamRes = await axios.post(`${ASSESS_URL}`, {
      title: `Internal Exam Only ${RUN_ID}`,
      courseId,
      type: 'EXAM',
      allowExternalStudents: false,
      questions: [
        { id: 'q1', text: '3 + 3 = ?', type: 'mcq', options: ['6', '7'], correct: '6', points: 10 }
      ]
    }, { headers: { Authorization: `Bearer ${teacherToken}` } });
    normalExamId = normalExamRes.data.id;
    // Explicitly set examAccessCode on non-external exam to test rejection
    normalExamCode = `NORM-${RUN_ID.toString().slice(-4)}-TEST`;
    await db.assessment.update({
      where: { id: normalExamId },
      data: { examAccessCode: normalExamCode, allowExternalStudents: false }
    });

  } catch (e) {
    console.error('Setup failed', e.response?.data || e.message);
    process.exit(1);
  }

  // Test 1: External Student + valid code + name -> SUCCESS
  const t1Name = `Student T1 ${RUN_ID}`;
  let t1Token;
  try {
    const res = await axios.post(`${AUTH_URL}/external-exam`, {
      code: openExamCode,
      name: t1Name
    });
    t1Token = res.data.token;
    log('Test 1: Valid Code + Name', res.status === 200 && !!t1Token, `Token generated: ${!!t1Token}`);
  } catch (e) {
    log('Test 1: Valid Code + Name', false, e.response?.data?.message || e.message);
  }

  // Test 2: External Student + valid code + name + phone -> SUCCESS
  const t2Name = `Student T2 ${RUN_ID}`;
  let t2Token;
  try {
    const res = await axios.post(`${AUTH_URL}/external-exam`, {
      code: openExamCode,
      name: t2Name,
      phone: '01099887766'
    });
    t2Token = res.data.token;
    log('Test 2: Valid Code + Name + Phone', res.status === 200 && !!t2Token, `Token generated: ${!!t2Token}`);
  } catch (e) {
    log('Test 2: Valid Code + Name + Phone', false, e.response?.data?.message || e.message);
  }

  // Test 3: External Student + invalid code -> REJECT
  try {
    const res = await axios.post(`${AUTH_URL}/external-exam`, {
      code: 'INVALID-9999-CODE',
      name: `Student T3 ${RUN_ID}`
    }, { validateStatus: () => true });
    log('Test 3: Invalid Code Rejected', res.status === 404 || res.status === 400, `HTTP status: ${res.status}`);
  } catch (e) {
    log('Test 3: Invalid Code Rejected', false, e.message);
  }

  // Test 4: External Student + closed exam -> REJECT
  try {
    const res = await axios.post(`${AUTH_URL}/external-exam`, {
      code: closedExamCode,
      name: `Student T4 ${RUN_ID}`
    }, { validateStatus: () => true });
    log('Test 4: Closed Exam Rejected', res.status === 400, `HTTP status: ${res.status}`);
  } catch (e) {
    log('Test 4: Closed Exam Rejected', false, e.message);
  }

  // Test 5: External Student + exam not allowing external students -> REJECT
  try {
    const res = await axios.post(`${AUTH_URL}/external-exam`, {
      code: normalExamCode,
      name: `Student T5 ${RUN_ID}`
    }, { validateStatus: () => true });
    log('Test 5: Non-External Exam Rejected', res.status === 404, `HTTP status: ${res.status}`);
  } catch (e) {
    log('Test 5: Non-External Exam Rejected', false, e.message);
  }

  // Test 6: External Student + whitespace-only name -> REJECT
  try {
    const res = await axios.post(`${AUTH_URL}/external-exam`, {
      code: openExamCode,
      name: '     '
    }, { validateStatus: () => true });
    log('Test 6: Whitespace-Only Name Rejected', res.status === 400, `HTTP status: ${res.status}`);
  } catch (e) {
    log('Test 6: Whitespace-Only Name Rejected', false, e.message);
  }

  // Test 7: External Student from any network (arbitrary IP headers) -> SUCCESS
  try {
    const res = await axios.post(`${AUTH_URL}/external-exam`, {
      examCode: openExamCode,
      name: `Student Any Network ${RUN_ID}`,
      phone: '01122334455'
    }, {
      headers: {
        'X-Forwarded-For': '185.220.101.5, 10.0.0.1',
        'CF-Connecting-IP': '203.0.113.195',
        'X-Real-IP': '198.51.100.77'
      }
    });
    log('Test 7: External Student From Any Network Allowed', res.status === 200 && !!res.data.token, `HTTP 200, Token: ${!!res.data.token}`);
  } catch (e) {
    log('Test 7: External Student From Any Network Allowed', false, e.response?.data?.message || e.message);
  }

  // Test 8: No User record created
  try {
    const user1 = await db.user.findFirst({ where: { name: t1Name } });
    const user2 = await db.user.findFirst({ where: { name: t2Name } });
    log('Test 8: No User Record Created', user1 === null && user2 === null, `User1 in DB: ${!!user1}, User2 in DB: ${!!user2}`);
  } catch (e) {
    log('Test 8: No User Record Created', false, e.message);
  }

  // Test 9: ExternalExamAttempt created
  try {
    const extAtt1 = await db.externalExamAttempt.findFirst({ where: { studentName: t1Name, assessmentId: openExamId } });
    const extAtt2 = await db.externalExamAttempt.findFirst({ where: { studentName: t2Name, assessmentId: openExamId } });
    log('Test 9: ExternalExamAttempt Created', extAtt1 !== null && extAtt2 !== null, `Att1 ID: ${extAtt1?.id}, Att2 ID: ${extAtt2?.id}`);
  } catch (e) {
    log('Test 9: ExternalExamAttempt Created', false, e.message);
  }

  // Test 10: External scoped JWT created with isExternalStudent = true and role = EXTERNAL_STUDENT
  try {
    const payload = JSON.parse(Buffer.from(t1Token.split('.')[1], 'base64').toString('utf8'));
    const isScoped = payload.isExternalStudent === true && payload.role === 'EXTERNAL_STUDENT' && payload.assessmentId === openExamId;
    log('Test 10: Scoped JWT Verified', isScoped, `role: ${payload.role}, isExternalStudent: ${payload.isExternalStudent}`);
  } catch (e) {
    log('Test 10: Scoped JWT Verified', false, e.message);
  }

  // Test 11: Student reaches /take/:assessmentId (Fetches questions & Starts attempt successfully)
  try {
    const detailsRes = await axios.get(`${ASSESS_URL}/${openExamId}`, {
      headers: { Authorization: `Bearer ${t1Token}` }
    });
    const startRes = await axios.post(`${ASSESS_URL}/${openExamId}/start`, {}, {
      headers: { Authorization: `Bearer ${t1Token}` }
    });
    const success = detailsRes.status === 200 && startRes.status === 200 && startRes.data.attempt?.status === 'IN_PROGRESS';
    log('Test 11: Student Reaches and Starts Exam Flow', success, `Details: ${detailsRes.status}, Start: ${startRes.status}`);
  } catch (e) {
    log('Test 11: Student Reaches and Starts Exam Flow', false, e.response?.data?.message || e.message);
  }

  // Test 12: Registered Student Login regression test passes
  try {
    const regStudentEmail = `reg_student_${RUN_ID}@edu.com`;
    await axios.post(`${USERS_URL}/users`, {
      name: `Registered Student ${RUN_ID}`,
      email: regStudentEmail,
      password: 'password123',
      role: 'ONLINE_STUDENT',
      country: 'EG',
      educationLevel: 'SECONDARY',
      gradeLevel: 'SECONDARY_3'
    }, { headers: { Authorization: `Bearer ${adminToken}` } });

    const regLoginRes = await axios.post(`${AUTH_URL}/login`, {
      email: regStudentEmail,
      password: 'password123',
      role: 'ONLINE_STUDENT'
    });
    const regToken = regLoginRes.data.token;
    const regRole = regLoginRes.data.user?.role;
    log('Test 12: Registered Student Login Regression', regLoginRes.status === 200 && !!regToken && regRole === 'ONLINE_STUDENT', `Role: ${regRole}, Token received: ${!!regToken}`);
  } catch (e) {
    log('Test 12: Registered Student Login Regression', false, e.response?.data?.message || e.message);
  }

  // Summary
  console.log('\n======================================================');
  console.log('                 FINAL RESULTS');
  console.log('======================================================\n');
  const passed = results.filter(r => r.pass);
  const failed = results.filter(r => !r.pass);
  console.log(`TOTAL TESTS: ${results.length} | ✅ ${passed.length} PASSED | ❌ ${failed.length} FAILED\n`);

  await db.$disconnect();
  if (failed.length > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

run().catch(async (err) => {
  console.error('Fatal error:', err);
  await db.$disconnect();
  process.exit(1);
});
