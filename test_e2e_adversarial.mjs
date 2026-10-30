import axios from 'axios';
import { PrismaClient } from '@prisma/client';

const _testAdminPassword = process.env.TEST_ADMIN_PASSWORD || process.env.TEST_PASSWORD;
if (!_testAdminPassword) {
  console.error('❌ Environment configuration error: TEST_ADMIN_PASSWORD or TEST_PASSWORD must be configured in environment to run test_e2e_adversarial.mjs.');
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

async function runAdversarialTests() {
  console.log(`Starting Math Platform Adversarial Red-Team Production Validation Suite... Run: ${RUN_ID}`);

  // Login admin to setup objects
  let adminToken;
  try {
    const adminLogin = await loginAs('ADMIN', 'admin@edu.com', (process.env.TEST_ADMIN_PASSWORD || process.env.TEST_PASSWORD));
    adminToken = adminLogin.token;
  } catch (err) {
    console.error('Failed admin login. Ensure local servers are running.', err.message);
    process.exit(1);
  }

  // Create Student A, Student B, and Parent A
  let studentAId, studentBId, studentAToken, studentBToken, parentAToken;
  const emailA = `student_a_${RUN_ID}@test.com`;
  const emailB = `student_b_${RUN_ID}@test.com`;
  const emailParent = `parent_a_${RUN_ID}@test.com`;

  try {
    // Create Student A with nested Parent A
    const resA = await axios.post(`${USER_URL}/users`, {
      name: 'Student A',
      email: emailA,
      password: 'password123',
      role: 'ONLINE_STUDENT',
      country: 'EG',
      educationLevel: 'SECONDARY',
      gradeLevel: 'SECONDARY_1',
      parentName: 'Parent A',
      parentEmail: emailParent,
      parentPassword: 'password123',
      parentPhone: '01011111111'
    }, { headers: { Authorization: `Bearer ${adminToken}` } });
    studentAId = resA.data.user.id;

    // Create Student B standalone
    const resB = await axios.post(`${USER_URL}/users`, {
      name: 'Student B',
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
    console.error('Setup failed:', err.response?.data || err.message);
    process.exit(1);
  }

  // Setup course and assessments
  let courseId, examId, examAccessCode;
  try {
    const courseRes = await axios.post(`${COURSE_URL}/courses`, { title: `Course ${RUN_ID}` }, { headers: { Authorization: `Bearer ${adminToken}` } });
    courseId = courseRes.data.id;

    await db.courseEnrollment.createMany({
      data: [
        { courseId, studentId: studentAId },
        { courseId, studentId: studentBId }
      ]
    });

    const examRes = await axios.post(`${COURSE_URL}/assessments`, {
      title: `Adversarial Exam`,
      courseId,
      type: 'EXAM',
      duration: 15,
      passingScore: 50,
      allowExternalStudents: true,
      randomization: false,
      questions: [
        { id: 'q1', text: '1+1=?', type: 'multiple_choice', options: ['1', '2', '3'], correct: '2', points: 10 }
      ]
    }, { headers: { Authorization: `Bearer ${adminToken}` } });
    examId = examRes.data.id;
    examAccessCode = examRes.data.examAccessCode;
  } catch (err) {
    console.error('Setup course/exam failed:', err.response?.data || err.message);
    process.exit(1);
  }

  // ===================== Scenario 1: ActiveAttemptReviewLock =====================
  currentSection = 'Active-Review-Lock';
  try {
    const startRes = await axios.post(`${COURSE_URL}/assessments/${examId}/start`, {}, { headers: { Authorization: `Bearer ${studentAToken}` } });
    const attemptId = startRes.data.attempt.id;

    // Student A tries to review review before submit
    try {
      await axios.get(`${COURSE_URL}/assessments/${examId}/attempts/${attemptId}/review`, { headers: { Authorization: `Bearer ${studentAToken}` } });
      logTest('ActiveAttemptReviewLock', false, 'Student retrieved answer key of active attempt (BAD)');
    } catch (err) {
      logTest('ActiveAttemptReviewLock', err.response?.status === 403, `Blocked review of active attempt, status=${err.response?.status}`);
    }
  } catch (err) {
    logTest('ActiveAttemptReviewLock', false, `Setup failed: ${err.message}`);
  }

  // ===================== Scenario 2: GuestCrossAssessmentAccess & Scenario 3: GuestPrivilegeEscalation =====================
  currentSection = 'Guest-Access-Escalation';
  let guestToken, guestAssessmentId;
  try {
    // Generate guest token for examId
    const loginRes = await axios.post(`${AUTH_URL}/external-exam`, {
      name: `Guest X ${RUN_ID}`,
      phone: '01055555555',
      code: examAccessCode
    });
    guestToken = loginRes.data.token;
    guestAssessmentId = loginRes.data.assessmentId;

    // Attack: guest assessment ID manipulation (using guest token on another assessment)
    try {
      await axios.get(`${COURSE_URL}/assessments/00000000-0000-0000-0000-000000000000`, { headers: { Authorization: `Bearer ${guestToken}` } });
      logTest('GuestCrossAssessmentAccess', false, 'Guest token retrieved another assessment details (BAD)');
    } catch (err) {
      logTest('GuestCrossAssessmentAccess-Status', err.response?.status === 403, `Blocked guest from unrelated assessment, status=${err.response?.status}`);
    }

    // Privilege Escalation: access User directory
    try {
      await axios.get(`${USER_URL}/users`, { headers: { Authorization: `Bearer ${guestToken}` } });
      logTest('GuestPrivilegeEscalation', false, 'Guest token allowed fetching users directory (BAD)');
    } catch (err) {
      logTest('GuestPrivilegeEscalation-Status', err.response?.status === 403, `Blocked guest directory retrieval: status=${err.response?.status}`);
    }
  } catch (err) {
    logTest('GuestSetup', false, err.message);
  }

  // ===================== Scenario 7: CrossStudentAttemptAccess =====================
  currentSection = 'Cross-User-Access';
  try {
    // Student B attempts to start their own attempt
    const startB = await axios.post(`${COURSE_URL}/assessments/${examId}/start`, {}, { headers: { Authorization: `Bearer ${studentBToken}` } });
    const attemptBId = startB.data.attempt.id;

    // Student A attempts to read Student B's attempt details (Review page)
    try {
      await axios.get(`${COURSE_URL}/assessments/${examId}/attempts/${attemptBId}/review`, { headers: { Authorization: `Bearer ${studentAToken}` } });
      logTest('CrossStudentAttemptAccess', false, 'Student A viewed Student B attempt review (BAD)');
    } catch (err) {
      logTest('CrossStudentAttemptAccess-Status', err.response?.status === 403, `Blocked cross-student review access, status=${err.response?.status}`);
    }
  } catch (err) {
    logTest('CrossStudentAttemptAccess', false, err.message);
  }

  // ===================== Scenario 8: CrossParentAccess =====================
  try {
    // Parent A child ID is studentAId. Parent A tries to fetch student assessments of studentBId
    try {
      await axios.get(`${COURSE_URL}/assessments/parent/children/${studentBId}`, { headers: { Authorization: `Bearer ${parentAToken}` } });
      logTest('CrossParentAccess', false, 'Parent A retrieved student assessments of Student B who is not their child (BAD)');
    } catch (err) {
      logTest('CrossParentAccess-Status', err.response?.status === 403, `Blocked cross-parent student lookup, status=${err.response?.status}`);
    }
  } catch (err) {
    logTest('CrossParentAccess', false, err.message);
  }

  // ===================== Scenario 9: MassAssignmentProtection =====================
  currentSection = 'Mass-Assignment';
  try {
    // Student A tries to update their own role to ADMIN
    const updateRes = await axios.put(`${USER_URL}/users/${studentAId}`, {
      role: 'ADMIN'
    }, { headers: { Authorization: `Bearer ${studentAToken}` } });

    // Verify in database that Student A's role is still ONLINE_STUDENT
    const dbStudent = await db.user.findUnique({ where: { id: studentAId } });
    logTest('RoleMassAssignment-Status', updateRes.status === 200, `API request executed, role in response=${updateRes.data.user?.role}`);
    logTest('RoleMassAssignment-DBVer', dbStudent && dbStudent.role === 'ONLINE_STUDENT', `Role in database remains=${dbStudent?.role}`);
  } catch (err) {
    logTest('RoleMassAssignment', false, err.response?.data?.message || err.message);
  }

  // ===================== Scenario 10: ScoreManipulation =====================
  currentSection = 'Score-Manipulation';
  try {
    // Student B starts an attempt (if not started)
    const dbAttemptB = await db.assessmentAttempt.findUnique({ where: { studentId_assessmentId: { studentId: studentBId, assessmentId: examId } } });
    const attemptId = dbAttemptB.id;

    // Student B attempts to submit passing custom score: { score: 10, percentage: 100 }
    const submitRes = await axios.post(`${COURSE_URL}/assessments/${examId}/attempt/submit`, {
      answers: [{ questionId: 'q1', selectedOption: '0' }], // incorrect answer
      score: 10,
      percentage: 100
    }, { headers: { Authorization: `Bearer ${studentBToken}` } });

    logTest('ScoreManipulation-SubmitStatus', submitRes.status === 200, `Submitted successfully: score=${submitRes.data.score}, percentage=${submitRes.data.percentage}`);

    // Verify DB calculations: score must be 0 and percentage must be 0 because question answer option was incorrect ('0')
    const dbUpdated = await db.assessmentAttempt.findUnique({ where: { id: attemptId } });
    logTest('ScoreManipulation-DBVer', dbUpdated && dbUpdated.score === 0 && dbUpdated.percentage === 0, `Server-controlled score resolved to DB score=${dbUpdated?.score}, percentage=${dbUpdated?.percentage}`);
  } catch (err) {
    logTest('ScoreManipulation', false, err.message);
  }

  // ===================== Scenario 12: ExpiredGuestExam & Scenario 13: DisabledExternalExam =====================
  currentSection = 'Scheduling-Accessibility';
  let closedExamId, closedAccessCode, disabledExamId, disabledAccessCode;

  try {
    // Create an exam with closeAt in the past
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    const closedRes = await axios.post(`${COURSE_URL}/assessments`, {
      title: `Closed Exam`,
      courseId,
      type: 'EXAM',
      duration: 15,
      passingScore: 50,
      allowExternalStudents: true,
      randomization: false,
      closeAt: yesterday.toISOString(),
      questions: [{ id: 'q1', text: '1+1=?', type: 'multiple_choice', options: ['1', '2', '3'], correct: '2', points: 10 }]
    }, { headers: { Authorization: `Bearer ${adminToken}` } });

    closedExamId = closedRes.data.id;
    closedAccessCode = closedRes.data.examAccessCode;

    // Guest tries to validate code on closed exam -> should reject with 400
    try {
      await axios.post(`${AUTH_URL}/external-exam`, {
        name: `Guest Closed ${RUN_ID}`,
        phone: '01066666666',
        code: closedAccessCode
      });
      logTest('ExpiredGuestExam', false, 'Allowed guest token generation for expired closed exam (BAD)');
    } catch (err) {
      logTest('ExpiredGuestExam-Status', err.response?.status === 400, `Rejected expired code verification, status=${err.response?.status}`);
    }

    // Create an exam with disabled external students
    const disabledRes = await axios.post(`${COURSE_URL}/assessments`, {
      title: `Disabled Exam`,
      courseId,
      type: 'EXAM',
      duration: 15,
      passingScore: 50,
      allowExternalStudents: true, // Generate code first
      randomization: false,
      questions: [{ id: 'q1', text: '1+1=?', type: 'multiple_choice', options: ['1', '2', '3'], correct: '2', points: 10 }]
    }, { headers: { Authorization: `Bearer ${adminToken}` } });

    disabledExamId = disabledRes.data.id;
    disabledAccessCode = disabledRes.data.examAccessCode;

    // Mutate in DB to disable external access
    await db.assessment.update({
      where: { id: disabledExamId },
      data: { allowExternalStudents: false }
    });

    // Guest tries to login on disabled exam with valid generated code -> should reject with 404
    try {
      await axios.post(`${AUTH_URL}/external-exam`, {
        name: `Guest Disabled ${RUN_ID}`,
        phone: '01077777777',
        code: disabledAccessCode
      });
      logTest('DisabledExternalExam', false, 'Allowed guest token generation for disabled external access exam (BAD)');
    } catch (err) {
      logTest('DisabledExternalExam-Status', err.response?.status === 404, `Rejected disabled external exam code, status=${err.response?.status}`);
    }
  } catch (err) {
    logTest('SchedulingSetup', false, err.message);
  }

  // ===================== Scenario 15: DoubleSubmission =====================
  currentSection = 'Submission-Idempotency';
  try {
    const dbAttemptA = await db.assessmentAttempt.findUnique({ where: { studentId_assessmentId: { studentId: studentAId, assessmentId: examId } } });
    const attemptAId = dbAttemptA.id;

    // Verify initial submit
    const submit1 = await axios.post(`${COURSE_URL}/assessments/${examId}/attempt/submit`, {
      answers: [{ questionId: 'q1', selectedOption: '2' }]
    }, { headers: { Authorization: `Bearer ${studentAToken}` } });
    
    logTest('DoubleSubmission-Submit1', submit1.status === 200 && submit1.data.score === 10, `Initial submit succeeded, score=${submit1.data.score}`);

    // Try submit again
    try {
      await axios.post(`${COURSE_URL}/assessments/${examId}/attempt/submit`, {
        answers: [{ questionId: 'q1', selectedOption: '3' }] // malicious payload change
      }, { headers: { Authorization: `Bearer ${studentAToken}` } });
      logTest('DoubleSubmission-Submit2', false, 'Allowed double submission modifying attempt results (BAD)');
    } catch (err) {
      logTest('DoubleSubmission-Submit2-Status', err.response?.status === 403, `Blocked subsequent submissions, status=${err.response?.status}`);
    }
  } catch (err) {
    logTest('DoubleSubmission', false, err.message);
  }

  // ===================== Scenario 16: HomeworkScoreManipulation =====================
  currentSection = 'Homework-Score-Manipulation';
  try {
    // 1. Create a homework using adminToken
    const hwRes = await axios.post(`${COURSE_URL}/homework`, {
      title: `Adv Homework ${RUN_ID}`,
      courseId,
      questions: [
        { id: 'hq1', text: '2+2=?', type: 'multiple_choice', options: ['3', '4', '5'], correct: '4' }
      ]
    }, { headers: { Authorization: `Bearer ${adminToken}` } });
    const homeworkId = hwRes.data.id;

    // 2. Submit with wrong answer (correct is '4', selected option is '3') but malicious grade = 100
    const hwSubmit = await axios.post(`${COURSE_URL}/homework/${homeworkId}/submit`, {
      answers: [{ questionId: 'hq1', selectedOption: '3' }],
      grade: 100 // malicious
    }, { headers: { Authorization: `Bearer ${studentBToken}` } });

    logTest('HomeworkScoreManipulation-Status', hwSubmit.status === 201 || hwSubmit.status === 200, `Homework submitted successfully: score in response=${hwSubmit.data.score}`);

    // 3. Query DB to verify the saved grade is indeed 0
    const dbSub = await db.submission.findFirst({
      where: { homeworkId, studentId: studentBId }
    });
    logTest('HomeworkScoreManipulation-DBVer', dbSub && dbSub.grade === 0, `Homework grade stored in database resolved to=${dbSub?.grade}`);
  } catch (err) {
    logTest('HomeworkScoreManipulation', false, err.response?.data?.message || err.message);
  }

  // ===================== SUMMARY =====================
  console.log('\n======================================================');
  console.log('         ADVERSARIAL SECURITY AUDIT RESULTS');
  console.log('======================================================\n');
  const passed = results.filter(r => r.passed);
  const failed = results.filter(r => !r.passed);
  console.log(`TOTAL RUN: ${results.length} | ✅ ${passed.length} PASSED | ❌ ${failed.length} FAILED\n`);
  
  if (failed.length > 0) {
    console.log('🔴 ADVERSARIAL SECURITY GAPS DETECTED!');
    process.exit(1);
  } else {
    console.log('🎉 ALL SECURITY ESCALATION SCENARIOS SAFELY SHIELDED!');
    process.exit(0);
  }
}

runAdversarialTests().catch(err => {
  console.error('Adversarial runner crashed:', err);
  process.exit(1);
});
