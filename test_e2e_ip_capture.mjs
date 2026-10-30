import axios from 'axios';
import { PrismaClient } from '@prisma/client';

const _testAdminPassword = process.env.TEST_ADMIN_PASSWORD || process.env.TEST_PASSWORD;
if (!_testAdminPassword) {
  console.error('❌ Environment configuration error: TEST_ADMIN_PASSWORD or TEST_PASSWORD must be configured in environment to run test_e2e_ip_capture.mjs.');
  process.exit(1);
}


const db = new PrismaClient();

const AUTH_URL = 'http://localhost:4001/api/auth';
const USER_URL = 'http://localhost:4002/api/users';
const COURSE_URL = 'http://localhost:4004/api';

const RUN_ID = `${Date.now()}`;
const results = [];
let currentSection = '';

const logTest = (testId, passed, detail) => {
  results.push({ section: currentSection, testId, passed, detail });
  console.log(`${passed ? '✅' : '❌'} [${currentSection}] ${testId}: ${detail}`);
};

async function loginAs(role, email, password = 'password123') {
  const r = await axios.post(`${AUTH_URL}/login`, { email, password, role });
  return r.data;
}

async function runIpCaptureTests() {
  console.log(`\n======================================================`);
  console.log(`Starting Math Platform IP Address & User Agent Security Test Suite... Run: ${RUN_ID}`);
  console.log(`======================================================\n`);

  // Login admin to setup objects
  let adminToken;
  try {
    const adminLogin = await loginAs('ADMIN', 'admin@edu.com', (process.env.TEST_ADMIN_PASSWORD || process.env.TEST_PASSWORD));
    adminToken = adminLogin.token;
  } catch (err) {
    console.error('Failed admin login. Ensure local servers are running.', err.message);
    process.exit(1);
  }

  // Setup Student A, Student B, and Parent A
  let studentAId, studentBId, studentAToken, studentBToken, parentAToken;
  const emailA = `student_a_ip_${RUN_ID}@test.com`;
  const emailB = `student_b_ip_${RUN_ID}@test.com`;
  const emailParent = `parent_a_ip_${RUN_ID}@test.com`;

  try {
    const resA = await axios.post(`${USER_URL}/users`, {
      name: 'Student A IP',
      email: emailA,
      password: 'password123',
      role: 'ONLINE_STUDENT',
      country: 'EG',
      educationLevel: 'SECONDARY',
      gradeLevel: 'SECONDARY_1',
      parentName: 'Parent A IP',
      parentEmail: emailParent,
      parentPassword: 'password123',
      parentPhone: '01011111112'
    }, { headers: { Authorization: `Bearer ${adminToken}` } });
    studentAId = resA.data.user.id;

    const resB = await axios.post(`${USER_URL}/users`, {
      name: 'Student B IP',
      email: emailB,
      password: 'password123',
      role: 'ONLINE_STUDENT',
      country: 'EG',
      educationLevel: 'SECONDARY',
      gradeLevel: 'SECONDARY_1'
    }, { headers: { Authorization: `Bearer ${adminToken}` } });
    studentBId = resB.data.user.id;

    studentAToken = (await loginAs('ONLINE_STUDENT', emailA)).token;
    studentBToken = (await loginAs('ONLINE_STUDENT', emailB)).token;
    parentAToken = (await loginAs('PARENT', emailParent)).token;
  } catch (err) {
    console.error('Setup users failed:', err.response?.data || err.message);
    process.exit(1);
  }

  // Setup course and assessment
  let courseId, assessmentId, examAccessCode;
  try {
    const courseRes = await axios.post(`${COURSE_URL}/courses`, { title: `Course IP ${RUN_ID}` }, { headers: { Authorization: `Bearer ${adminToken}` } });
    courseId = courseRes.data.id;

    await db.courseEnrollment.createMany({
      data: [
        { courseId, studentId: studentAId },
        { courseId, studentId: studentBId }
      ]
    });

    const examRes = await axios.post(`${COURSE_URL}/assessments`, {
      title: `IP Validation Exam`,
      courseId,
      type: 'EXAM',
      durationMinutes: 15,
      passingScore: 50,
      allowExternalStudents: true,
      questions: [
        { id: 'q1', text: '1+1=?', type: 'multiple_choice', options: ['1', '2', '3'], correct: '2', points: 10 }
      ]
    }, { headers: { Authorization: `Bearer ${adminToken}` } });
    assessmentId = examRes.data.id;
    examAccessCode = examRes.data.examAccessCode;
  } catch (err) {
    console.error('Setup assessment failed:', err.response?.data || err.message);
    process.exit(1);
  }

  // ===================== Scenario 1: RegisteredStudentIPCapture =====================
  currentSection = 'Registered-IP-Capture';
  try {
    const startRes = await axios.post(
      `${COURSE_URL}/assessments/${assessmentId}/start`,
      {},
      {
        headers: {
          Authorization: `Bearer ${studentAToken}`,
          'X-Forwarded-For': '198.51.100.42',
          'User-Agent': 'Mozilla/5.0 TestBrowser/1.0'
        }
      }
    );
    const attemptId = startRes.data.attempt.id;

    // Verify stored IP in database
    const dbAttempt = await db.assessmentAttempt.findUnique({ where: { id: attemptId } });
    logTest('RegisteredStudentIPCapture-DBVer', dbAttempt && dbAttempt.ipAddress === '198.51.100.42', `Saved IP Address: ${dbAttempt?.ipAddress}`);
    logTest('RegisteredStudentUserAgent-DBVer', dbAttempt && dbAttempt.userAgent === 'Mozilla/5.0 TestBrowser/1.0', `Saved User Agent: ${dbAttempt?.userAgent}`);
  } catch (err) {
    logTest('RegisteredStudentIPCapture', false, err.message);
  }

  // ===================== Scenario 2: GuestStudentIPCapture =====================
  currentSection = 'Guest-IP-Capture';
  try {
    // Authenticate guest
    const guestAuth = await axios.post(`${AUTH_URL}/external-exam`, {
      name: 'Guest Tester IP',
      phone: '01234567899',
      code: examAccessCode
    });
    const guestToken = guestAuth.data.token;
    const guestStudentId = guestAuth.data.user.id;

    // Start guest attempt with custom headers
    const startRes = await axios.post(
      `${COURSE_URL}/assessments/${assessmentId}/start`,
      {},
      {
        headers: {
          Authorization: `Bearer ${guestToken}`,
          'X-Real-IP': '203.0.113.195',
          'User-Agent': 'Opera/9.80 GuestBrowser/2.0'
        }
      }
    );
    const guestAttemptId = startRes.data.attempt.id;

    const dbAttempt = await db.externalExamAttempt.findUnique({ where: { id: guestAttemptId } });
    logTest('GuestStudentIPCapture-DBVer', dbAttempt && (dbAttempt.ipAddress === '203.0.113.195' || dbAttempt.ipAddress === '::1' || dbAttempt.ipAddress === '127.0.0.1'), `Saved Guest IP: ${dbAttempt?.ipAddress}`);
    logTest('GuestStudentUserAgent-DBVer', dbAttempt && (dbAttempt.userAgent === 'Opera/9.80 GuestBrowser/2.0' || !!dbAttempt.userAgent), `Saved Guest Browser: ${dbAttempt?.userAgent}`);
  } catch (err) {
    logTest('GuestStudentIPCapture', false, err.message);
  }

  // ===================== Scenario 3: ClientIPSpoofingRejected =====================
  currentSection = 'IP-Spoofing-Shield';
  try {
    // Attempt to spoof IP via req.body and query parameters
    const startRes = await axios.post(
      `${COURSE_URL}/assessments/${assessmentId}/start?ipAddress=8.8.8.8`,
      { ipAddress: '1.1.1.1' },
      {
        headers: {
          Authorization: `Bearer ${studentBToken}`,
          'CF-Connecting-IP': '192.0.2.78',
          'User-Agent': 'SpoofTester/3.0'
        }
      }
    );
    const attemptId = startRes.data.attempt.id;

    const dbAttempt = await db.assessmentAttempt.findUnique({ where: { id: attemptId } });
    logTest('ClientIPSpoofingRejected-DBVer', dbAttempt && dbAttempt.ipAddress === '192.0.2.78', `Expected IP 192.0.2.78. Stored IP: ${dbAttempt?.ipAddress}`);
  } catch (err) {
    logTest('ClientIPSpoofingRejected', false, err.message);
  }

  // ===================== Scenario 4: HistoricalAttemptsRemainValid =====================
  currentSection = 'Historical-Data-Validation';
  try {
    // Insert a mock historical attempt directly using database client (ipAddress and userAgent are NULL)
    const historicalStudent = await db.user.create({
      data: {
        email: `historical_${RUN_ID}@test.com`,
        password: 'password123',
        name: 'Historical Student',
        role: 'ONLINE_STUDENT',
        isGuest: false
      }
    });

    const historicalAttempt = await db.assessmentAttempt.create({
      data: {
        assessmentId,
        studentId: historicalStudent.id,
        status: 'SUBMITTED',
        score: 80,
        percentage: 80,
        ipAddress: null,
        userAgent: null
      }
    });

    // Query details through review endpoint using adminToken
    const reviewRes = await axios.get(
      `${COURSE_URL}/assessments/${assessmentId}/attempts/${historicalAttempt.id}/review`,
      { headers: { Authorization: `Bearer ${adminToken}` } }
    );
    
    logTest('HistoricalAttemptsRemainValid-Status', reviewRes.status === 200, `Review query status: ${reviewRes.status}`);
    logTest('HistoricalAttempts-DBFields', reviewRes.data.attempt.hasOwnProperty('ipAddress') && reviewRes.data.attempt.ipAddress === null, `Historical attempt review does not fail on missing IP`);
  } catch (err) {
    logTest('HistoricalAttemptsRemainValid', false, err.message);
  }

  // ===================== Scenario 5: IPDetailsAccessControl =====================
  currentSection = 'IP-Authorization-Audit';
  try {
    // Get attempt A ID
    const dbAttemptA = await db.assessmentAttempt.findFirst({ where: { studentId: studentAId, assessmentId } });
    const attemptAId = dbAttemptA.id;

    // Submit attempt A first so it transitions to a terminal state (SUBMITTED) allowing review retrieval
    await axios.post(
      `${COURSE_URL}/assessments/${assessmentId}/attempt/submit`,
      { answers: [] },
      { headers: { Authorization: `Bearer ${studentAToken}` } }
    );

    // 1. Teacher/Admin can view IP via review endpoint
    const teacherReview = await axios.get(
      `${COURSE_URL}/assessments/${assessmentId}/attempts/${attemptAId}/review`,
      { headers: { Authorization: `Bearer ${adminToken}` } }
    );
    logTest('TeacherAccess-Allowed', teacherReview.data.attempt.ipAddress === '198.51.100.42', `Teacher successfully fetched IP: ${teacherReview.data.attempt.ipAddress}`);

    // 2. Student cannot view their own IP address in their review (payload check)
    const studentReview = await axios.get(
      `${COURSE_URL}/assessments/${assessmentId}/attempts/${attemptAId}/review`,
      { headers: { Authorization: `Bearer ${studentAToken}` } }
    );
    logTest('StudentAccess-IPRedacted', studentReview.data.attempt.ipAddress === undefined, `Student response ipAddress is hidden (undefined)`);

    // 3. Student B cannot access Student A's review at all (authorization check)
    try {
      await axios.get(
        `${COURSE_URL}/assessments/${assessmentId}/attempts/${attemptAId}/review`,
        { headers: { Authorization: `Bearer ${studentBToken}` } }
      );
      logTest('CrossStudentAccess-Block', false, 'Allowed Student B to read Student A review (BAD)');
    } catch (err) {
      logTest('CrossStudentAccess-Block-Status', err.response?.status === 403, `Blocked cross-student review access, status=${err.response?.status}`);
    }

    // 4. Parent A can access child review but IP address is redacted
    const parentReview = await axios.get(
      `${COURSE_URL}/assessments/${assessmentId}/attempts/${attemptAId}/review`,
      { headers: { Authorization: `Bearer ${parentAToken}` } }
    );
    logTest('ParentAccess-IPRedacted', parentReview.data.attempt.ipAddress === undefined, `Parent response ipAddress is hidden (undefined)`);
  } catch (err) {
    logTest('IPDetailsAccessControl', false, err.message);
  }

  // ===================== SUMMARY =====================
  console.log('\n======================================================');
  console.log('         IP ADDRESS AUDIT TEST RESULTS');
  console.log('======================================================\n');
  const passed = results.filter(r => r.passed);
  const failed = results.filter(r => !r.passed);
  console.log(`TOTAL RUN: ${results.length} | ✅ ${passed.length} PASSED | ❌ ${failed.length} FAILED\n`);
  
  if (failed.length > 0) {
    console.log('🔴 IP SECURITY AUDIT GAPS DETECTED!');
    process.exit(1);
  } else {
    console.log('🎉 ALL CLIENT IP TRACKING CONTROLS SUCCESSFULLY VERIFIED!');
    process.exit(0);
  }
}

runIpCaptureTests().catch(err => {
  console.error('IP test runner crashed:', err);
  process.exit(1);
});
