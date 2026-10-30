import axios from 'axios';
import { PrismaClient } from '@prisma/client';

const _testAdminPassword = process.env.TEST_ADMIN_PASSWORD || process.env.TEST_PASSWORD;
if (!_testAdminPassword) {
  console.error('❌ Environment configuration error: TEST_ADMIN_PASSWORD or TEST_PASSWORD must be configured in environment to run test_e2e_blackbox.mjs.');
  process.exit(1);
}


const db = new PrismaClient();

const AUTH_URL = 'http://localhost:4001/api/auth';
const USER_URL = 'http://localhost:4002/api/users';
const COURSE_URL = 'http://localhost:4004/api';
const ANALYTICS_URL = 'http://localhost:4005/api/analytics';

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

async function runE2ETests() {
  console.log(`Starting Math Platform Black-Box E2E Integration and Security Hardening Suite... Run: ${RUN_ID}`);
  
  // Login as Admin to obtain management permissions
  let adminToken;
  try {
    const adminLogin = await loginAs('ADMIN', 'admin@edu.com', (process.env.TEST_ADMIN_PASSWORD || process.env.TEST_PASSWORD));
    adminToken = adminLogin.token;
  } catch (err) {
    console.error('Failed to authenticate admin. Make sure servers are running on ports 4001-4005.', err.message);
    process.exit(1);
  }

  // ===================== PART 2: STUDENT ↔ PARENT RELATIONSHIP =====================
  currentSection = 'Student-Parent';
  
  const studentEmail = `student_${RUN_ID}@test.com`;
  const parentEmail = `parent_${RUN_ID}@test.com`;
  const studentName = `Student ${RUN_ID}`;
  const parentName = `Parent ${RUN_ID}`;
  let studentId, parentId;

  // 1. Create Student with a nested New Parent
  try {
    const studentRes = await axios.post(`${USER_URL}/users`, {
      name: studentName,
      email: studentEmail,
      password: 'password123',
      role: 'ONLINE_STUDENT',
      country: 'EG',
      educationLevel: 'SECONDARY',
      gradeLevel: 'SECONDARY_1',
      parentName: parentName,
      parentEmail: parentEmail,
      parentPassword: 'password123',
      parentPhone: '01012345678'
    }, { headers: { Authorization: `Bearer ${adminToken}` } });

    studentId = studentRes.data.user.id;
    parentId = studentRes.data.user.parentId;

    logTest('CreateStudentWithNewParent-Status', studentRes.status === 201 || studentRes.status === 200, `studentId=${studentId}, parentId=${parentId}`);
    
    // Verify in database
    const dbStudent = await db.user.findUnique({ where: { id: studentId }, include: { parent: true } });
    logTest('CreateStudentWithNewParent-DB', dbStudent && dbStudent.parentId === parentId && dbStudent.parent.phone === '01012345678', `parentId=${dbStudent?.parentId}, parentPhone=${dbStudent?.parent?.phone}`);
  } catch (err) {
    logTest('CreateStudentWithNewParent', false, `Error: ${err.response?.data?.message || err.message}`);
  }

  // 2. Edit Student and modify Parent phone and details
  try {
    const editRes = await axios.put(`${USER_URL}/users/${studentId}`, {
      name: `${studentName} Edited`,
      role: 'ONLINE_STUDENT',
      country: 'EG',
      educationLevel: 'SECONDARY',
      gradeLevel: 'SECONDARY_1',
      parentName: `${parentName} Edited`,
      parentEmail: parentEmail,
      parentPhone: '01099999999'
    }, { headers: { Authorization: `Bearer ${adminToken}` } });

    logTest('EditParentDetails-Status', editRes.status === 200, `status=${editRes.status}`);

    const dbParent = await db.user.findUnique({ where: { id: parentId } });
    logTest('EditParentDetails-DB', dbParent && dbParent.name === `${parentName} Edited` && dbParent.phone === '01099999999', `name=${dbParent?.name}, phone=${dbParent?.phone}`);
  } catch (err) {
    logTest('EditParentDetails', false, `Error: ${err.response?.data?.message || err.message}`);
  }

  // 3. Unlink Parent from Student
  try {
    const unlinkRes = await axios.put(`${USER_URL}/users/${studentId}`, {
      name: `${studentName} Edited`,
      role: 'ONLINE_STUDENT',
      country: 'EG',
      educationLevel: 'SECONDARY',
      gradeLevel: 'SECONDARY_1',
      parentId: null // unlink parent
    }, { headers: { Authorization: `Bearer ${adminToken}` } });

    logTest('UnlinkParent-Status', unlinkRes.status === 200, `status=${unlinkRes.status}`);

    const dbStudent = await db.user.findUnique({ where: { id: studentId } });
    logTest('UnlinkParent-DB', dbStudent && dbStudent.parentId === null, `parentId=${dbStudent?.parentId}`);
  } catch (err) {
    logTest('UnlinkParent', false, `Error: ${err.response?.data?.message || err.message}`);
  }

  // 4. Replace Parent with a new parent
  const parentEmail2 = `parent_new_${RUN_ID}@test.com`;
  const parentName2 = `Parent 2 ${RUN_ID}`;
  try {
    const replaceRes = await axios.put(`${USER_URL}/users/${studentId}`, {
      name: `${studentName} Edited`,
      role: 'ONLINE_STUDENT',
      country: 'EG',
      educationLevel: 'SECONDARY',
      gradeLevel: 'SECONDARY_1',
      parentName: parentName2,
      parentEmail: parentEmail2,
      parentPassword: 'password123',
      parentPhone: '01088888888'
    }, { headers: { Authorization: `Bearer ${adminToken}` } });

    const newParentId = replaceRes.data.user.parentId;
    logTest('ReplaceParent-Status', replaceRes.status === 200 && newParentId !== parentId, `newParentId=${newParentId}`);

    const dbStudent = await db.user.findUnique({ where: { id: studentId }, include: { parent: true } });
    logTest('ReplaceParent-DB', dbStudent && dbStudent.parentId === newParentId && dbStudent.parent.email === parentEmail2, `email=${dbStudent?.parent?.email}`);
  } catch (err) {
    logTest('ReplaceParent', false, `Error: ${err.response?.data?.message || err.message}`);
  }

  // 5. Transaction Safety Rollback: Try to create student with non-existent parent UUID
  const rollbackStudentEmail = `student_dup_${RUN_ID}@test.com`;
  try {
    await axios.post(`${USER_URL}/users`, {
      name: 'E2E Student Failed',
      email: rollbackStudentEmail,
      password: 'password123',
      role: 'ONLINE_STUDENT',
      country: 'EG',
      educationLevel: 'SECONDARY',
      gradeLevel: 'SECONDARY_1',
      parentId: '00000000-0000-0000-0000-000000000000' // Non-existent foreign key
    }, { headers: { Authorization: `Bearer ${adminToken}` } });

    logTest('TransactionRollback', false, 'Allowed non-existent parent linking nested creation (BAD)');
  } catch (err) {
    logTest('TransactionRollback-Status', err.response?.status === 500 || err.response?.status === 400 || err.response?.status === 404, `status=${err.response?.status}`);
    
    // Verify no orphan student was created in database
    const dbOrphan = await db.user.findUnique({ where: { email: rollbackStudentEmail } });
    logTest('TransactionRollback-DBClean', !dbOrphan, `orphanCreated=${!!dbOrphan}`);
  }

  // ===================== PART 3 & 4 & 5: THREE-STRIKE ANTI-CHEAT SYSTEM =====================
  currentSection = 'Anti-Cheat';

  // Login as a teacher to create course and exam
  const teacherEmail = `teacher_${RUN_ID}@test.com`;
  let teacherToken, courseId, examId, studentToken;

  try {
    await axios.post(`${USER_URL}/users`, {
      name: `E2E Teacher ${RUN_ID}`,
      email: teacherEmail,
      password: 'password123',
      role: 'TEACHER'
    }, { headers: { Authorization: `Bearer ${adminToken}` } });

    teacherToken = (await loginAs('TEACHER', teacherEmail)).token;

    // Create course
    const courseRes = await axios.post(`${COURSE_URL}/courses`, { title: `Course ${RUN_ID}` }, { headers: { Authorization: `Bearer ${teacherToken}` } });
    courseId = courseRes.data.id;

    // Enroll student in the course
    await db.courseEnrollment.create({ data: { courseId, studentId } });
    studentToken = (await loginAs('ONLINE_STUDENT', studentEmail)).token;

    // Create exam
    const examRes = await axios.post(`${COURSE_URL}/assessments`, {
      title: `Exam ${RUN_ID}`,
      courseId,
      type: 'EXAM',
      duration: 30,
      passingScore: 50,
      allowExternalStudents: true,
      randomization: false,
      questions: [
        { id: 'q1', text: '1+1=?', type: 'multiple_choice', options: ['1', '2', '3'], correct: '2', points: 10 }
      ]
    }, { headers: { Authorization: `Bearer ${teacherToken}` } });

    examId = examRes.data.id;
    logTest('SetupExam', !!examId, `examId=${examId}`);
  } catch (err) {
    logTest('SetupExam', false, `Error: ${err.response?.data?.message || err.message}`);
  }

  // Start exam attempt
  let attemptId;
  try {
    const startRes = await axios.post(`${COURSE_URL}/assessments/${examId}/start`, {}, { headers: { Authorization: `Bearer ${studentToken}` } });
    attemptId = startRes.data.attempt.id;
    logTest('StartExamAttempt', !!attemptId, `attemptId=${attemptId}`);
  } catch (err) {
    logTest('StartExamAttempt', false, `Error: ${err.response?.data?.message || err.message}`);
  }

  // Send Strike 1
  try {
    const strike1 = await axios.post(`${COURSE_URL}/assessments/${examId}/attempt/violation`, { type: 'TAB_SWITCH' }, { headers: { Authorization: `Bearer ${studentToken}` } });
    logTest('ViolationStrike1', strike1.status === 200 && strike1.data.violationCount === 1, `violationCount=${strike1.data.violationCount}`);
  } catch (err) {
    logTest('ViolationStrike1', false, `Error: ${err.response?.data?.message || err.message}`);
  }

  // Send Strike 2
  try {
    const strike2 = await axios.post(`${COURSE_URL}/assessments/${examId}/attempt/violation`, { type: 'BLUR' }, { headers: { Authorization: `Bearer ${studentToken}` } });
    logTest('ViolationStrike2', strike2.status === 200 && strike2.data.violationCount === 2, `violationCount=${strike2.data.violationCount}`);
  } catch (err) {
    logTest('ViolationStrike2', false, `Error: ${err.response?.data?.message || err.message}`);
  }

  // Send Strike 3
  try {
    const strike3 = await axios.post(`${COURSE_URL}/assessments/${examId}/attempt/violation`, { type: 'TAB_SWITCH' }, { headers: { Authorization: `Bearer ${studentToken}` } });
    logTest('ViolationStrike3', strike3.status === 200 && strike3.data.status === 'CHEATING', `status=${strike3.data.status}, isDisqualified=${strike3.data.isDisqualified}`);
    
    // Verify DB constraints: attempt score must be 0 and percentage must be 0
    const dbAttempt = await db.assessmentAttempt.findUnique({ where: { id: attemptId } });
    logTest('CheatingDBConsistency', dbAttempt && dbAttempt.status === 'CHEATING' && dbAttempt.score === 0 && dbAttempt.percentage === 0, `score=${dbAttempt?.score}, percentage=${dbAttempt?.percentage}, status=${dbAttempt?.status}`);
  } catch (err) {
    logTest('ViolationStrike3', false, `Error: ${err.response?.data?.message || err.message}`);
  }

  // Attempt to saveAnswers after cheating lockout
  try {
    await axios.put(`${COURSE_URL}/assessments/${examId}/attempt/answers`, {
      answers: [{ questionId: 'q1', selectedOption: '2' }]
    }, { headers: { Authorization: `Bearer ${studentToken}` } });
    logTest('PostCheatingWriteLock-Save', false, 'Allowed saveAnswers after CHEATING status lock (BAD)');
  } catch (err) {
    logTest('PostCheatingWriteLock-Save-Status', err.response?.status === 403, `Blocked saveAnswers, status=${err.response?.status}`);
  }

  // Attempt to submit exam after cheating lockout
  try {
    await axios.post(`${COURSE_URL}/assessments/${examId}/attempt/submit`, {
      answers: [{ questionId: 'q1', selectedOption: '2' }]
    }, { headers: { Authorization: `Bearer ${studentToken}` } });
    logTest('PostCheatingWriteLock-Submit', false, 'Allowed submitAssessment after CHEATING status lock (BAD)');
  } catch (err) {
    logTest('PostCheatingWriteLock-Submit-Status', err.response?.status === 403, `Blocked submitAssessment, status=${err.response?.status}`);
  }

  // Concurrent violations check: Send multiple violations rapidly
  try {
    const promises = [
      axios.post(`${COURSE_URL}/assessments/${examId}/attempt/violation`, { type: 'BLUR' }, { headers: { Authorization: `Bearer ${studentToken}` } }).catch(e => e),
      axios.post(`${COURSE_URL}/assessments/${examId}/attempt/violation`, { type: 'TAB_SWITCH' }, { headers: { Authorization: `Bearer ${studentToken}` } }).catch(e => e)
    ];
    const results = await Promise.all(promises);
    logTest('ConcurrentViolations-Status', results.every(res => res.status === 403 || res.response?.status === 403), 'All concurrent post-lock violations safely rejected');
  } catch (err) {
    logTest('ConcurrentViolations', false, `Error: ${err.message}`);
  }

  // ===================== PART 10 & 11 & 12: GUEST / EXTERNAL EXAM SYSTEM =====================
  currentSection = 'Guest-Exam';

  let guestToken, guestAssessmentId, guestAccessCode;

  try {
    const dbExam = await db.assessment.findUnique({ where: { id: examId } });
    guestAccessCode = dbExam.examAccessCode;
    logTest('GuestAccessCodeGenerated', !!guestAccessCode, `code=${guestAccessCode}`);
  } catch (err) {
    logTest('GuestAccessCodeGenerated', false, `Error: ${err.message}`);
  }

  // 1. Guest login with valid access code
  const guestPhone = `010${Math.floor(10000000 + Math.random() * 90000000)}`;
  const guestName = `Guest ${RUN_ID}`;
  try {
    const loginRes = await axios.post(`${AUTH_URL}/external-exam`, {
      name: guestName,
      phone: guestPhone,
      code: guestAccessCode
    });

    guestToken = loginRes.data.token;
    guestAssessmentId = loginRes.data.assessmentId;

    logTest('GuestLogin-Status', loginRes.status === 200, `token=${guestToken?.substring(0, 15)}..., assessmentId=${guestAssessmentId}`);
    
    // Verify DB does NOT create a User record (External students have no User account)
    const dbGuest = await db.user.findFirst({ where: { name: guestName } });
    const dbExtAttempt = await db.externalExamAttempt.findFirst({ where: { studentName: guestName, assessmentId: guestAssessmentId } });
    logTest('GuestUserFlagged-DB', !dbGuest && !!dbExtAttempt, `noUserAccountCreated=${!dbGuest}, extAttemptCreated=${!!dbExtAttempt}`);
  } catch (err) {
    logTest('GuestLogin', false, `Error: ${err.response?.data?.message || err.message}`);
  }

  // 2. Guest login with invalid access code
  try {
    await axios.post(`${AUTH_URL}/external-exam`, {
      name: guestName,
      phone: guestPhone,
      code: 'INVALID-CODE-9999'
    });
    logTest('GuestLoginInvalidCode', false, 'Allowed guest login with invalid access code (BAD)');
  } catch (err) {
    logTest('GuestLoginInvalidCode-Status', err.response?.status === 400 || err.response?.status === 404, `Rejected invalid code: status=${err.response?.status}`);
  }

  // 3. Guest Scoped API Tokens Shielding Verification (Part 11)
  // Allowed: get own exam
  try {
    const ownExam = await axios.get(`${COURSE_URL}/assessments/${guestAssessmentId}`, { headers: { Authorization: `Bearer ${guestToken}` } });
    logTest('GuestTokenRestriction-OwnExam', ownExam.status === 200, `Allowed own exam fetch: status=${ownExam.status}`);
  } catch (err) {
    logTest('GuestTokenRestriction-OwnExam', false, `Error: ${err.response?.data?.message || err.message}`);
  }

  // Blocked: get all assessments
  try {
    await axios.get(`${COURSE_URL}/assessments`, { headers: { Authorization: `Bearer ${guestToken}` } });
    logTest('GuestTokenRestriction-AllExams', false, 'Allowed guest to retrieve other courses assessments (BAD)');
  } catch (err) {
    logTest('GuestTokenRestriction-AllExams-Status', err.response?.status === 403, `Blocked other assessments list: status=${err.response?.status}`);
  }

  // Blocked: fetch AI solver service or users
  try {
    await axios.get(`${USER_URL}/users`, { headers: { Authorization: `Bearer ${guestToken}` } });
    logTest('GuestTokenRestriction-UsersAPI', false, 'Allowed guest to access Users directory (BAD)');
  } catch (err) {
    logTest('GuestTokenRestriction-UsersAPI-Status', err.response?.status === 403, `Blocked users API: status=${err.response?.status}`);
  }

  // Blocked: fetch analytics admin data
  try {
    await axios.get(`${ANALYTICS_URL}/admin`, { headers: { Authorization: `Bearer ${guestToken}` } });
    logTest('GuestTokenRestriction-Analytics', false, 'Allowed guest to read Teacher/Admin analytics dashboard (BAD)');
  } catch (err) {
    logTest('GuestTokenRestriction-Analytics-Status', err.response?.status === 403, `Blocked analytics API: status=${err.response?.status}`);
  }

  // 4. Guest Exam taking, grading, and idempotency
  let guestAttemptId;
  try {
    // Start attempt
    const startRes = await axios.post(`${COURSE_URL}/assessments/${guestAssessmentId}/start`, {}, { headers: { Authorization: `Bearer ${guestToken}` } });
    guestAttemptId = startRes.data.attempt.id;
    logTest('GuestStartAttempt', !!guestAttemptId, `attemptId=${guestAttemptId}`);

    // Try fetching review before submission (New security test case)
    try {
      await axios.get(`${COURSE_URL}/assessments/${guestAssessmentId}/attempts/${guestAttemptId}/review`, { headers: { Authorization: `Bearer ${guestToken}` } });
      logTest('GuestReviewActiveLock', false, 'Allowed guest to review active attempt before submission (BAD)');
    } catch (err) {
      logTest('GuestReviewActiveLock-Status', err.response?.status === 403, `Blocked review of active attempt, status=${err.response?.status}`);
    }

    // Submit with correct answer
    const submitRes = await axios.post(`${COURSE_URL}/assessments/${guestAssessmentId}/attempt/submit`, {
      answers: [{ questionId: 'q1', selectedOption: '2' }]
    }, { headers: { Authorization: `Bearer ${guestToken}` } });

    logTest('GuestGrading-Correct', submitRes.status === 200 && submitRes.data.score === 10, `score=${submitRes.data.score}, percentage=${submitRes.data.percentage}`);

    // Submission Idempotency: Submit again immediately
    try {
      await axios.post(`${COURSE_URL}/assessments/${guestAssessmentId}/attempt/submit`, {
        answers: [{ questionId: 'q1', selectedOption: '2' }]
      }, { headers: { Authorization: `Bearer ${guestToken}` } });
      logTest('GuestSubmissionIdempotency', false, 'Allowed resubmitting final assessment attempts (BAD)');
    } catch (err) {
      logTest('GuestSubmissionIdempotency-Status', err.response?.status === 403 || err.response?.status === 400, `Blocked resubmission: status=${err.response?.status}`);
    }

    // Verify DB integrity
    const dbAttempt = await db.externalExamAttempt.findUnique({ where: { id: guestAttemptId } });
    logTest('GuestSubmissionDBVerify', dbAttempt && (dbAttempt.status === 'GRADED' || dbAttempt.status === 'SUBMITTED') && dbAttempt.percentage === 100, `status=${dbAttempt?.status}, pct=${dbAttempt?.percentage}`);
  } catch (err) {
    logTest('GuestGradingFlow', false, `Error: ${err.response?.data?.message || err.message}`);
  }

  // ===================== SUMMARY =====================
  console.log('\n======================================================');
  console.log('            BLACK-BOX E2E AUDIT RESULTS');
  console.log('======================================================\n');
  const passed = results.filter(r => r.passed);
  const failed = results.filter(r => !r.passed);
  console.log(`TOTAL RUN: ${results.length} | ✅ ${passed.length} PASSED | ❌ ${failed.length} FAILED\n`);
  
  if (failed.length > 0) {
    console.log('🔴 CRITICAL FAILURE DETECTED:');
    for (const f of failed) {
      console.log(`  - [${f.section}] ${f.testId}: ${f.detail}`);
    }
    process.exit(1);
  } else {
    console.log('🎉 ALL INTEGRATION SCENARIOS FULLY VERIFIED AND PASSING!');
    process.exit(0);
  }
}

runE2ETests().catch(err => {
  console.error('E2E runner crashed:', err);
  process.exit(1);
});
