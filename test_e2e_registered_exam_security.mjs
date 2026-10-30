/**
 * Math Platform Registered Exam — Security & Anti-Cheat E2E Test Suite
 * Verifies actual HTTP responses, response codes, IDOR protection, 3-strike anti-cheat,
 * server timer enforcement, deduplication, auto-submit, and database state for Registered Students.
 *
 * Run: node test_e2e_registered_exam_security.mjs
 */

import axios from 'axios';
import { PrismaClient } from '@prisma/client';

const _testAdminPassword = process.env.TEST_ADMIN_PASSWORD || process.env.TEST_PASSWORD;
if (!_testAdminPassword) {
  console.error('❌ Environment configuration error: TEST_ADMIN_PASSWORD or TEST_PASSWORD must be configured in environment to run test_e2e_registered_exam_security.mjs.');
  process.exit(1);
}


const BASE_USERS = 'http://localhost:4002/api';
const BASE_AUTH = 'http://localhost:4001/api';
const BASE_COURSE = 'http://localhost:4004/api';
const RUN_ID = Date.now();

const db = new PrismaClient();

let passed = 0;
let failed = 0;
const failures = [];

function pass(name) {
  console.log(`✅ ${name}`);
  passed++;
}

function fail(name, reason, detail = '') {
  console.error(`❌ ${name}: ${reason}${detail ? ` — ${detail}` : ''}`);
  failed++;
  failures.push({ name, reason, detail });
}

async function http(method, url, data = null, token = null) {
  try {
    const headers = token ? { Authorization: `Bearer ${token}` } : {};
    const res = await axios({ method, url, data, headers, validateStatus: () => true });
    return { ok: res.status >= 200 && res.status < 300, status: res.status, data: res.data };
  } catch (err) {
    return { ok: false, status: 0, data: null, error: err.message };
  }
}

async function main() {
  console.log('\n===============================================================');
  console.log('  STARTING REGISTERED STUDENT EXAM SECURITY & ANTI-CHEAT E2E TEST');
  console.log('===============================================================\n');

  try {
    // ─── SETUP ACCOUNTS ───
    const adminRes = await http('POST', `${BASE_AUTH}/auth/login`, {
      email: 'admin@edu.com',
      password: (process.env.TEST_ADMIN_PASSWORD || process.env.TEST_PASSWORD),
      role: 'ADMIN'
    });
    if (!adminRes.ok || !adminRes.data?.token) throw new Error('Admin login failed');
    const adminToken = adminRes.data.token;

    // Create Teacher
    const teacherEmail = `teacher_reg_${RUN_ID}@example.com`;
    await http('POST', `${BASE_USERS}/users/users`, {
      name: 'Reg Test Teacher',
      email: teacherEmail,
      password: 'Password123!',
      role: 'TEACHER'
    }, adminToken);

    const teacherAuth = await http('POST', `${BASE_AUTH}/auth/login`, {
      email: teacherEmail,
      password: 'Password123!',
      role: 'TEACHER'
    });
    const teacherToken = teacherAuth.data.token;

    // Create Course by Teacher
    const courseRes = await http('POST', `${BASE_COURSE}/courses`, {
      title: `Reg Security Course ${RUN_ID}`,
      description: 'Test Course'
    }, teacherToken);
    const courseId = courseRes.data.id || courseRes.data.course?.id;

    // Create Student A
    const s1Email = `student1_${RUN_ID}@example.com`;
    const s1Res = await http('POST', `${BASE_USERS}/users/users`, {
      name: 'Registered Student A',
      email: s1Email,
      password: 'Password123!',
      role: 'ONLINE_STUDENT',
      country: 'EG',
      educationLevel: 'SECONDARY',
      gradeLevel: 'SECONDARY_1'
    }, adminToken);
    if (!s1Res.ok) throw new Error(`Student A creation failed: ${JSON.stringify(s1Res.data)}`);
    const s1Id = s1Res.data?.user?.id || s1Res.data?.id;

    const s1Auth = await http('POST', `${BASE_AUTH}/auth/login`, {
      email: s1Email,
      password: 'Password123!',
      role: 'ONLINE_STUDENT'
    });
    const s1Token = s1Auth.data.token;

    // Create Student B
    const s2Email = `student2_${RUN_ID}@example.com`;
    const s2Res = await http('POST', `${BASE_USERS}/users/users`, {
      name: 'Registered Student B',
      email: s2Email,
      password: 'Password123!',
      role: 'ONLINE_STUDENT',
      country: 'EG',
      educationLevel: 'SECONDARY',
      gradeLevel: 'SECONDARY_1'
    }, adminToken);
    if (!s2Res.ok) throw new Error(`Student B creation failed: ${JSON.stringify(s2Res.data)}`);
    const s2Id = s2Res.data?.user?.id || s2Res.data?.id;

    const s2Auth = await http('POST', `${BASE_AUTH}/auth/login`, {
      email: s2Email,
      password: 'Password123!',
      role: 'ONLINE_STUDENT'
    });
    const s2Token = s2Auth.data.token;

    // Enroll students in course
    await db.courseEnrollment.createMany({
      data: [
        { studentId: s1Id, courseId },
        { studentId: s2Id, courseId }
      ]
    });

    // Create Assessment via /exams
    const examRes = await http('POST', `${BASE_COURSE}/exams`, {
      title: `Registered Exam ${RUN_ID}`,
      courseId,
      durationMinutes: 30,
      duration: 30,
      passingScore: 50,
      questions: [
        { id: 'q1', text: '1+1=?', type: 'mcq', options: ['1', '2', '3', '4'], correct: 1, points: 10 },
        { id: 'q2', text: '2+2=?', type: 'mcq', options: ['2', '3', '4', '5'], correct: 2, points: 10 }
      ]
    }, teacherToken);
    if (!examRes.ok) throw new Error(`Exam creation failed: ${JSON.stringify(examRes.data)}`);
    const examId = examRes.data.id || examRes.data.exam?.id || examRes.data.assessment?.id;

    // ─────────────────────────────────────────────────────────────────────────
    // 1. AUTHENTICATION & ATTEMPT INITIALIZATION
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n--- Section 1: Authentication & Attempt Initialization ---');

    const start1 = await http('POST', `${BASE_COURSE}/assessments/${examId}/start`, {}, s1Token);
    if (start1.ok && (start1.data.attempt?.id || start1.data.id)) {
      pass('T1: Registered Student A can start own exam attempt');
    } else {
      fail('T1: Registered Student A failed to start exam attempt', JSON.stringify(start1));
    }
    const attempt1Id = start1.data.attempt?.id || start1.data.id;

    const start1Repeat = await http('POST', `${BASE_COURSE}/assessments/${examId}/start`, {}, s1Token);
    if (start1Repeat.ok && (start1Repeat.data.attempt?.id === attempt1Id || start1Repeat.data.id === attempt1Id)) {
      pass('T2: Starting existing active attempt returns same attempt without creating duplicate');
    } else {
      fail('T2: Multi-tab/restart created duplicate attempt', JSON.stringify(start1Repeat));
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 2. IDOR PROTECTION
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n--- Section 2: IDOR Protection ---');

    // Student B attempts to report violation against Student A's exam/attempt
    const idorViolation = await http('POST', `${BASE_COURSE}/assessments/${examId}/attempt/violation`, {
      type: 'TAB_SWITCH',
      attemptId: attempt1Id
    }, s2Token);
    // Student B has not started exam, so s2 lookup for this assessment finds no attempt (or returns 404/error)
    if (idorViolation.status === 404 || idorViolation.status === 403 || idorViolation.data?.message?.includes('not found')) {
      pass('T3: Student B cannot report violation against Student A attempt (IDOR Protected)');
    } else {
      fail('T3: IDOR vulnerability on reportAssessmentViolation', `status=${idorViolation.status}`);
    }

    // Student B attempts to save answers for Student A
    const idorSave = await http('PUT', `${BASE_COURSE}/assessments/${examId}/attempt/answers`, {
      answers: [{ questionId: 'q1', answer: '1' }]
    }, s2Token);
    if (idorSave.status === 404 || idorSave.status === 403) {
      pass('T4: Student B cannot save answers for Student A attempt (IDOR Protected)');
    } else {
      fail('T4: IDOR vulnerability on saveAnswers', `status=${idorSave.status}`);
    }

    // Student B attempts to submit Student A's attempt
    const idorSubmit = await http('POST', `${BASE_COURSE}/assessments/${examId}/attempt/submit`, {
      answers: [{ questionId: 'q1', answer: '1' }]
    }, s2Token);
    if (idorSubmit.status === 404 || idorSubmit.status === 403) {
      pass('T5: Student B cannot submit Student A attempt (IDOR Protected)');
    } else {
      fail('T5: IDOR vulnerability on submitAssessment', `status=${idorSubmit.status}`);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 3. THREE-STRIKE ANTI-CHEAT SYSTEM
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n--- Section 3: Three-Strike Anti-Cheat System ---');

    // Informational type VISIBILITY_VISIBLE
    const vis1 = await http('POST', `${BASE_COURSE}/assessments/${examId}/attempt/violation`, { type: 'VISIBILITY_VISIBLE' }, s1Token);
    if (vis1.ok && vis1.data.violationCount === 0) {
      pass('T6: VISIBILITY_VISIBLE is informational and does NOT increment violation count');
    } else {
      fail('T6: VISIBILITY_VISIBLE incremented violation count', JSON.stringify(vis1));
    }

    // Strike 1: VISIBILITY_HIDDEN
    const v1 = await http('POST', `${BASE_COURSE}/assessments/${examId}/attempt/violation`, { type: 'VISIBILITY_HIDDEN' }, s1Token);
    if (v1.ok && v1.data.violationCount === 1 && v1.data.isDisqualified === false) {
      pass('T7: First violation (VISIBILITY_HIDDEN) increments count to 1 and exam continues');
    } else {
      fail('T7: First violation handling failed', JSON.stringify(v1));
    }

    // Strike 2: WINDOW_BLUR
    const v2 = await http('POST', `${BASE_COURSE}/assessments/${examId}/attempt/violation`, { type: 'WINDOW_BLUR' }, s1Token);
    if (v2.ok && v2.data.violationCount === 2 && v2.data.isDisqualified === false) {
      pass('T8: Second violation (WINDOW_BLUR) increments count to 2 and exam continues');
    } else {
      fail('T8: Second violation handling failed', JSON.stringify(v2));
    }

    // Strike 3: TAB_SWITCH
    const v3 = await http('POST', `${BASE_COURSE}/assessments/${examId}/attempt/violation`, { type: 'TAB_SWITCH' }, s1Token);
    if (v3.ok && v3.data.violationCount === 3 && v3.data.isDisqualified === true && v3.data.status === 'CHEATING') {
      pass('T9: Third violation increments count to 3 and triggers CHEATING disqualification');
    } else {
      fail('T9: Third violation disqualification failed', JSON.stringify(v3));
    }

    // Verify DB state after Strike 3
    const dbAttempt = await db.assessmentAttempt.findUnique({ where: { id: attempt1Id } });
    if (
      dbAttempt &&
      dbAttempt.status === 'CHEATING' &&
      dbAttempt.cheatingDetected === true &&
      dbAttempt.score === 0 &&
      dbAttempt.percentage === 0 &&
      dbAttempt.submittedAt !== null
    ) {
      pass('T10: Database state correctly finalized (status=CHEATING, score=0, cheatingDetected=true, submittedAt set)');
    } else {
      fail('T10: DB state after strike 3 invalid', JSON.stringify(dbAttempt));
    }

    // Post-cheating actions lock out
    const postSave = await http('PUT', `${BASE_COURSE}/assessments/${examId}/attempt/answers`, {
      answers: [{ questionId: 'q1', answer: '1' }]
    }, s1Token);
    if (postSave.status === 403) {
      pass('T11: Save answers rejected after cheating disqualification (403)');
    } else {
      fail('T11: Save answers allowed after cheating', `status=${postSave.status}`);
    }

    const postSubmit = await http('POST', `${BASE_COURSE}/assessments/${examId}/attempt/submit`, {
      answers: [{ questionId: 'q1', answer: '1' }]
    }, s1Token);
    if (postSubmit.status === 403) {
      pass('T12: Submit exam rejected after cheating disqualification (403)');
    } else {
      fail('T12: Submit allowed after cheating', `status=${postSubmit.status}`);
    }

    const postStart = await http('POST', `${BASE_COURSE}/assessments/${examId}/start`, {}, s1Token);
    if (postStart.data?.attempt?.status === 'CHEATING' || postStart.data?.status === 'CHEATING' || postStart.status === 403) {
      pass('T13: Refreshing/re-starting cheated exam returns CHEATING state and remains locked out');
    } else {
      fail('T13: Cheated exam re-start allowed active state', JSON.stringify(postStart));
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 4. RACE CONDITION & CONCURRENCY TESTING
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n--- Section 4: Race Condition & Concurrency Testing ---');

    // Start Student B attempt
    const start2 = await http('POST', `${BASE_COURSE}/assessments/${examId}/start`, {}, s2Token);
    const attempt2Id = start2.data.attempt?.id || start2.data.id;

    // Send 4 violation requests to verify 3-strike threshold and terminal state under rapid calls
    for (let i = 0; i < 4; i++) {
      await http('POST', `${BASE_COURSE}/assessments/${examId}/attempt/violation`, { type: 'TAB_SWITCH' }, s2Token);
    }

    const dbAttempt2 = await db.assessmentAttempt.findUnique({ where: { id: attempt2Id } });
    if (dbAttempt2 && dbAttempt2.status === 'CHEATING' && dbAttempt2.violationCount <= 3) {
      pass('T14: Multiple violation requests correctly capped violationCount <= 3 and set CHEATING status');
    } else {
      fail('T14: Violation requests caused invalid state', `violationCount=${dbAttempt2?.violationCount}, status=${dbAttempt2?.status}`);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 5. SERVER TIMER ENFORCEMENT & AUTO EXPIRATION
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n--- Section 5: Server Timer Enforcement & Auto Expiration ---');

    // Create Student C for timer testing
    const s3Email = `student3_${RUN_ID}@example.com`;
    const s3Res = await http('POST', `${BASE_USERS}/users/users`, {
      name: 'Registered Student C',
      email: s3Email,
      password: 'Password123!',
      role: 'ONLINE_STUDENT',
      country: 'EG',
      educationLevel: 'SECONDARY',
      gradeLevel: 'SECONDARY_1'
    }, adminToken);
    if (!s3Res.ok) throw new Error(`Student C creation failed: ${JSON.stringify(s3Res.data)}`);
    const s3Id = s3Res.data?.user?.id || s3Res.data?.id;
    const s3Auth = await http('POST', `${BASE_AUTH}/auth/login`, { email: s3Email, password: 'Password123!', role: 'ONLINE_STUDENT' });
    const s3Token = s3Auth.data.token;
    await db.courseEnrollment.create({ data: { studentId: s3Id, courseId } });

    // Create short duration exam
    const start3 = await http('POST', `${BASE_COURSE}/assessments/${examId}/start`, {}, s3Token);
    const attempt3Id = start3.data.attempt?.id || start3.data.id;

    // Save valid answer before expiry
    const saveOk = await http('PUT', `${BASE_COURSE}/assessments/${examId}/attempt/answers`, {
      answers: [{ questionId: 'q1', answer: '1' }]
    }, s3Token);
    if (saveOk.ok) {
      pass('T15: Active exam accepts answer saving before expiration');
    } else {
      fail('T15: Failed saving answers on active attempt', JSON.stringify(saveOk));
    }

    // Manually simulate expiration by setting expiresAt in the past
    await db.assessmentAttempt.update({
      where: { id: attempt3Id },
      data: { expiresAt: new Date(Date.now() - 5000) }
    });

    // Save answer after expiration
    const saveExpired = await http('PUT', `${BASE_COURSE}/assessments/${examId}/attempt/answers`, {
      answers: [{ questionId: 'q2', answer: '2' }]
    }, s3Token);
    if (saveExpired.status === 403 && saveExpired.data?.code === 'EXAM_TIME_EXPIRED') {
      pass('T16: Save answers after expiresAt is rejected with EXAM_TIME_EXPIRED (403)');
    } else {
      fail('T16: Save answers after expiration allowed or returned wrong code', JSON.stringify(saveExpired));
    }

    // Auto submission after expiration
    const submitExpired = await http('POST', `${BASE_COURSE}/assessments/${examId}/attempt/submit`, {
      answers: [{ questionId: 'q1', answer: '1' }]
    }, s3Token);
    if (submitExpired.ok && (submitExpired.data?.status === 'TIME_EXPIRED' || submitExpired.data?.attempt?.status === 'TIME_EXPIRED')) {
      pass('T17: Submission after expiration auto-finalizes status to TIME_EXPIRED');
    } else {
      fail('T17: Submission after expiration failed', JSON.stringify(submitExpired));
    }

    // Idempotent duplicate submission
    const resubmit = await http('POST', `${BASE_COURSE}/assessments/${examId}/attempt/submit`, {
      answers: [{ questionId: 'q1', answer: '1' }]
    }, s3Token);
    if (resubmit.ok && (resubmit.data?.status === 'TIME_EXPIRED' || resubmit.data?.attempt?.status === 'TIME_EXPIRED')) {
      pass('T18: Duplicate submission for finalized exam is idempotent (returns 200 with result)');
    } else {
      fail('T18: Duplicate submission failed idempotency check', JSON.stringify(resubmit));
    }

  } catch (err) {
    console.error('Fatal error during test run:', err);
  } finally {
    await db.$disconnect();
  }

  console.log('\n===============================================================');
  console.log(`  RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('===============================================================\n');

  if (failed > 0) {
    console.error('Failures summary:');
    failures.forEach(f => console.error(` - ${f.name}: ${f.reason}`));
    process.exit(1);
  }
}

main();
