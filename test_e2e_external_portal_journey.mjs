import axios from 'axios';
import { PrismaClient } from '@prisma/client';

const _testAdminPassword = process.env.TEST_ADMIN_PASSWORD || process.env.TEST_PASSWORD;
if (!_testAdminPassword) {
  console.error('❌ Environment configuration error: TEST_ADMIN_PASSWORD or TEST_PASSWORD must be configured in environment to run test_e2e_external_portal_journey.mjs.');
  process.exit(1);
}


const db = new PrismaClient();
const AUTH_URL = 'http://localhost:4001/api/auth';
const USERS_URL = 'http://localhost:4002/api/users';
const COURSE_URL = 'http://localhost:4004/api/courses';
const ASSESS_URL = 'http://localhost:4004/api/assessments';

const RUN_ID = Date.now();
const results = [];

function log(id, pass, detail) {
  results.push({ id, pass, detail });
  console.log(`${pass ? '✅' : '❌'} ${id}: ${detail}`);
}

async function run() {
  console.log('\n======================================================');
  console.log('  Math Platform External Student Exam Portal Journey E2E');
  console.log(`  Run Timestamp: ${RUN_ID}`);
  console.log('======================================================\n');

  let adminToken, teacherToken, courseId, examId, examAccessCode;

  // 1. Setup Admin & Teacher & Exam
  try {
    const adminRes = await axios.post(`${AUTH_URL}/login`, {
      email: 'admin@edu.com',
      password: (process.env.TEST_ADMIN_PASSWORD || process.env.TEST_PASSWORD),
      role: 'ADMIN'
    });
    adminToken = adminRes.data.token;

    const teacherEmail = `teacher_ext_${RUN_ID}@edu.com`;
    const teacherCreate = await axios.post(`${USERS_URL}/users`, {
      name: `Teacher Ext ${RUN_ID}`,
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
      title: `Math Course ${RUN_ID}`,
      description: 'Calculus and Geometry'
    }, { headers: { Authorization: `Bearer ${teacherToken}` } });
    courseId = courseRes.data.id;

    // Create exam allowing external students
    const examRes = await axios.post(`${ASSESS_URL}`, {
      title: `Calculus Exam ${RUN_ID}`,
      courseId,
      type: 'EXAM',
      durationMinutes: 45,
      passingScore: 60,
      allowExternalStudents: true,
      questions: [
        {
          id: 'q1',
          text: 'ما هو ناتج $\\lim_{x \\to 0} \\frac{\\sin x}{x}$؟',
          type: 'multiple_choice',
          options: ['0', '1', '\\infty', 'غير معرف'],
          correct: '1',
          points: 10
        },
        {
          id: 'q2',
          text: 'مشتقة $f(x) = x^3$ هي $3x^2$',
          type: 'true_false',
          options: ['صواب', 'خطأ'],
          correct: 'صواب',
          points: 10
        },
        {
          id: 'q3',
          text: 'أوجد قيمة $\\int 2x dx$',
          type: 'multiple_choice',
          options: ['x^2 + C', '2x^2 + C', 'x + C', '2 + C'],
          correct: 'x^2 + C',
          points: 10
        }
      ]
    }, { headers: { Authorization: `Bearer ${teacherToken}` } });

    examId = examRes.data.id;
    examAccessCode = examRes.data.examAccessCode;
    log('Setup-ExamCreated', !!examId && !!examAccessCode, `examId=${examId}, accessCode=${examAccessCode}`);
  } catch (err) {
    console.error('Setup failed:', err.response?.data || err.message);
    process.exit(1);
  }

  // 2. Test Invalid Code Entry
  try {
    const invalidRes = await axios.post(`${AUTH_URL}/external-exam`, {
      name: 'Bad Code Student',
      code: 'XXXX-YYYY-ZZZZ'
    }, { validateStatus: () => true });
    log('Auth-InvalidCodeRejected', invalidRes.status === 404 || invalidRes.status === 400, `status=${invalidRes.status}`);
  } catch (err) {
    log('Auth-InvalidCodeRejected', false, err.message);
  }

  // 3. Test Empty Name Entry
  try {
    const emptyNameRes = await axios.post(`${AUTH_URL}/external-exam`, {
      name: '   ',
      code: examAccessCode
    }, { validateStatus: () => true });
    log('Auth-EmptyNameRejected', emptyNameRes.status === 400, `status=${emptyNameRes.status}`);
  } catch (err) {
    log('Auth-EmptyNameRejected', false, err.message);
  }

  // 4. Test Valid External Student Login (Ahmed El-Sayed)
  let studentToken, studentSessionId;
  const studentName = `Ahmed El-Sayed ${RUN_ID}`;
  const studentPhone = '01012345678';
  try {
    const loginRes = await axios.post(`${AUTH_URL}/external-exam`, {
      name: studentName,
      phone: studentPhone,
      code: examAccessCode
    });

    studentToken = loginRes.data.token;
    log('Auth-ValidLoginSuccess', loginRes.status === 200 && !!studentToken, `tokenReceived=${!!studentToken}`);
    log('Auth-RoleExternalStudent', loginRes.data.user?.role === 'EXTERNAL_STUDENT', `role=${loginRes.data.user?.role}`);

    // Verify no User table row was inserted
    const userRow = await db.user.findFirst({ where: { name: studentName } });
    log('DB-NoUserAccountCreated', userRow === null, `userInTable=${!!userRow}`);

    // Verify ExternalExamAttempt was created
    const extAttempt = await db.externalExamAttempt.findFirst({
      where: { assessmentId: examId, studentName }
    });
    log('DB-ExternalExamAttemptCreated', extAttempt !== null, `attemptId=${extAttempt?.id}`);
    studentSessionId = extAttempt?.accessSessionId;
  } catch (err) {
    log('Auth-ValidLogin', false, err.response?.data?.message || err.message);
  }

  // 5. External Student Fetches Exam Details (Sanitized Questions)
  try {
    const examDetailsRes = await axios.get(`${ASSESS_URL}/${examId}`, {
      headers: { Authorization: `Bearer ${studentToken}` }
    });
    const questions = examDetailsRes.data.questions || [];
    const hasAnswers = questions.some(q => q.correct !== undefined || q.correctAnswer !== undefined);
    log('Exam-FetchDetailsSanitized', examDetailsRes.status === 200 && !hasAnswers, `qCount=${questions.length}, answersLeaked=${hasAnswers}`);
  } catch (err) {
    log('Exam-FetchDetails', false, err.response?.data?.message || err.message);
  }

  // 6. External Student Starts Attempt
  let attemptId;
  try {
    const startRes = await axios.post(`${ASSESS_URL}/${examId}/start`, {}, {
      headers: { Authorization: `Bearer ${studentToken}` }
    });
    attemptId = startRes.data.attempt?.id;
    log('Exam-StartAttempt', startRes.status === 200 && !!attemptId, `attemptId=${attemptId}, status=${startRes.data.attempt?.status}`);
  } catch (err) {
    log('Exam-StartAttempt', false, err.response?.data?.message || err.message);
  }

  // 7. Autosave answers
  try {
    const saveRes = await axios.put(`${ASSESS_URL}/${examId}/attempt/answers`, {
      answers: [
        { questionId: 'q1', answer: '1' },
        { questionId: 'q2', answer: 'صواب' }
      ]
    }, { headers: { Authorization: `Bearer ${studentToken}` } });
    log('Exam-AutosaveAnswers', saveRes.status === 200, `autosaveStatus=${saveRes.status}`);

    const dbAttemptAfterSave = await db.externalExamAttempt.findUnique({ where: { id: attemptId } });
    const savedAnswers = dbAttemptAfterSave?.answers || [];
    log('DB-AutosavePersisted', savedAnswers.length === 2, `savedCount=${savedAnswers.length}`);
  } catch (err) {
    log('Exam-AutosaveAnswers', false, err.response?.data?.message || err.message);
  }

  // 8. Submit Answers and Verify Server-Side Grading
  try {
    // Attempt client score injection (sending score: 999, percentage: 100)
    const submitRes = await axios.post(`${ASSESS_URL}/${examId}/attempt/submit`, {
      answers: [
        { questionId: 'q1', answer: '1' },      // Correct (10 pts)
        { questionId: 'q2', answer: 'صواب' },   // Correct (10 pts)
        { questionId: 'q3', answer: 'x^2 + C' } // Correct (10 pts)
      ],
      score: 999,
      percentage: 100
    }, { headers: { Authorization: `Bearer ${studentToken}` } });

    log('Exam-SubmitSuccess', submitRes.status === 200, `status=${submitRes.status}`);
    log('Grading-ServerCalculatedScore', submitRes.data.score === 30, `score=${submitRes.data.score}/30`);
    log('Grading-ServerCalculatedPct', submitRes.data.percentage === 100, `percentage=${submitRes.data.percentage}%`);

    const dbAttemptFinal = await db.externalExamAttempt.findUnique({ where: { id: attemptId } });
    log('DB-AttemptGraded', dbAttemptFinal.status === 'GRADED' && dbAttemptFinal.score === 30, `status=${dbAttemptFinal.status}, score=${dbAttemptFinal.score}`);
  } catch (err) {
    log('Exam-Submit', false, err.response?.data?.message || err.message);
  }

  // 9. Resubmission Idempotency Block
  try {
    const resubmitRes = await axios.post(`${ASSESS_URL}/${examId}/attempt/submit`, {
      answers: []
    }, {
      headers: { Authorization: `Bearer ${studentToken}` },
      validateStatus: () => true
    });
    log('Security-DoubleSubmitBlocked', resubmitRes.status === 403, `status=${resubmitRes.status}`);
  } catch (err) {
    log('Security-DoubleSubmitBlocked', false, err.message);
  }

  // 10. Student Reviews their own completed attempt
  try {
    const reviewRes = await axios.get(`${ASSESS_URL}/${examId}/attempts/${attemptId}/review`, {
      headers: { Authorization: `Bearer ${studentToken}` }
    });
    const reviewQuestions = reviewRes.data.questions || [];
    log('Review-OwnAttemptAllowed', reviewRes.status === 200 && reviewQuestions.length === 3, `qCount=${reviewQuestions.length}`);
    log('Review-ScoreMatches', reviewRes.data.attempt?.score === 30, `reviewScore=${reviewRes.data.attempt?.score}`);
  } catch (err) {
    log('Review-OwnAttempt', false, err.response?.data?.message || err.message);
  }

  // 11. Security: External token cannot access other assessment reviews or admin/teacher endpoints
  try {
    const blockedRes = await axios.get(`${ASSESS_URL}/admin/external-attempts`, {
      headers: { Authorization: `Bearer ${studentToken}` },
      validateStatus: () => true
    });
    log('Security-ExternalBlockedFromAdmin', blockedRes.status === 403, `status=${blockedRes.status}`);
  } catch (err) {
    log('Security-ExternalBlockedFromAdmin', false, err.message);
  }

  try {
    const blockedTeacherRes = await axios.get(`${ASSESS_URL}/teacher/external-results/${examId}`, {
      headers: { Authorization: `Bearer ${studentToken}` },
      validateStatus: () => true
    });
    log('Security-ExternalBlockedFromTeacherResults', blockedTeacherRes.status === 403, `status=${blockedTeacherRes.status}`);
  } catch (err) {
    log('Security-ExternalBlockedFromTeacherResults', false, err.message);
  }

  // 12. Teacher views External Results
  try {
    const teacherResultsRes = await axios.get(`${ASSESS_URL}/teacher/external-results/${examId}`, {
      headers: { Authorization: `Bearer ${teacherToken}` }
    });
    const externalResults = teacherResultsRes.data || [];
    const foundStudent = externalResults.find(r => r.studentName === studentName);
    log('Teacher-ViewsExternalResults', teacherResultsRes.status === 200 && !!foundStudent, `found=${!!foundStudent}, score=${foundStudent?.score}`);
    log('Teacher-ResultHasIpAddress', foundStudent?.ipAddress !== undefined, `ip=${foundStudent?.ipAddress}`);
  } catch (err) {
    log('Teacher-ViewsExternalResults', false, err.response?.data?.message || err.message);
  }

  // 13. Admin views all external attempts platform-wide
  try {
    const adminAttemptsRes = await axios.get(`${ASSESS_URL}/admin/external-attempts`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    const allAttempts = adminAttemptsRes.data || [];
    const hasCurrent = allAttempts.some(a => a.id === attemptId);
    log('Admin-ViewsAllExternalAttempts', adminAttemptsRes.status === 200 && hasCurrent, `totalAttempts=${allAttempts.length}`);
  } catch (err) {
    log('Admin-ViewsAllExternalAttempts', false, err.response?.data?.message || err.message);
  }

  // 14. IP Independence Verification: Student can enter from ANY network/headers
  try {
    const arbitraryIpLogin = await axios.post(`${AUTH_URL}/external-exam`, {
      name: `Student From Any IP ${RUN_ID}`,
      phone: '01234567890',
      examCode: examAccessCode
    }, {
      headers: {
        'X-Forwarded-For': '203.0.113.195, 198.51.100.1',
        'CF-Connecting-IP': '198.51.100.22',
        'X-Real-IP': '192.0.2.100'
      }
    });

    log('Security-NoIpRestriction', arbitraryIpLogin.status === 200 && !!arbitraryIpLogin.data.token, `status=${arbitraryIpLogin.status}, tokenReceived=${!!arbitraryIpLogin.data.token}`);
  } catch (err) {
    log('Security-NoIpRestriction', false, err.message);
  }

  // 15. Anti-Cheat 3-Strike Disqualification for External Students
  try {
    // Create new external student attempt
    const cheatingStudentName = `Cheater Student ${RUN_ID}`;
    const cheatLogin = await axios.post(`${AUTH_URL}/external-exam`, {
      name: cheatingStudentName,
      code: examAccessCode
    });
    const cheatToken = cheatLogin.data.token;

    // Start
    const cheatStart = await axios.post(`${ASSESS_URL}/${examId}/start`, {}, {
      headers: { Authorization: `Bearer ${cheatToken}` }
    });
    const cheatAttemptId = cheatStart.data.attempt.id;

    // Strike 1
    const s1 = await axios.post(`${ASSESS_URL}/${examId}/attempt/violation`, { type: 'TAB_SWITCH' }, {
      headers: { Authorization: `Bearer ${cheatToken}` }
    });
    log('AntiCheat-Strike1', s1.data.violationCount === 1, `strikeCount=${s1.data.violationCount}`);

    // Strike 2
    const s2 = await axios.post(`${ASSESS_URL}/${examId}/attempt/violation`, { type: 'BLUR' }, {
      headers: { Authorization: `Bearer ${cheatToken}` }
    });
    log('AntiCheat-Strike2', s2.data.violationCount === 2, `strikeCount=${s2.data.violationCount}`);

    // Strike 3 (Disqualification)
    const s3 = await axios.post(`${ASSESS_URL}/${examId}/attempt/violation`, { type: 'TAB_SWITCH' }, {
      headers: { Authorization: `Bearer ${cheatToken}` }
    });
    log('AntiCheat-Strike3Disqualified', s3.data.status === 'CHEATING' && s3.data.violationCount === 3, `status=${s3.data.status}`);

    // Verify DB
    const dbCheater = await db.externalExamAttempt.findUnique({ where: { id: cheatAttemptId } });
    log('DB-CheatingLocked', dbCheater.status === 'CHEATING' && dbCheater.cheatingDetected === true && dbCheater.score === 0, `status=${dbCheater.status}, score=${dbCheater.score}`);

    // Verify blocked from saving or submitting after disqualification
    const saveAfterCheat = await axios.put(`${ASSESS_URL}/${examId}/attempt/answers`, {
      answers: [{ questionId: 'q1', answer: '1' }]
    }, {
      headers: { Authorization: `Bearer ${cheatToken}` },
      validateStatus: () => true
    });
    log('Security-SaveBlockedAfterCheating', saveAfterCheat.status === 403, `status=${saveAfterCheat.status}`);
  } catch (err) {
    log('AntiCheat-Disqualification', false, err.message);
  }

  // ===================== SUMMARY =====================
  console.log('\n======================================================');
  console.log('       EXTERNAL STUDENT JOURNEY E2E SUMMARY');
  console.log('======================================================\n');
  const passed = results.filter(r => r.pass);
  const failed = results.filter(r => !r.pass);
  console.log(`TOTAL CHECKS: ${results.length} | ✅ ${passed.length} PASSED | ❌ ${failed.length} FAILED\n`);

  if (failed.length > 0) {
    console.log('Failed tests:');
    failed.forEach(f => console.log(`  - ${f.id}: ${f.detail}`));
    await db.$disconnect();
    process.exit(1);
  }

  console.log('🎉 ALL 24 EXTERNAL STUDENT JOURNEY SCENARIOS VERIFIED 100% PASSING!\n');
  await db.$disconnect();
  process.exit(0);
}

run().catch(async (e) => {
  console.error('Fatal test error:', e);
  await db.$disconnect();
  process.exit(1);
});
