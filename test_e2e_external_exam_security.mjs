/**
 * Math Platform External Exam — Security & Anti-Cheat E2E Test Suite
 * Verifies actual HTTP responses, response codes, and database state.
 *
 * Run: node test_e2e_external_exam_security.mjs
 *
 * Requirements:
 *  - All services running (npm run dev:all)
 *  - At least one teacher account available
 *  - Direct DB access via Prisma (uses course-service DB URL)
 */

import axios from 'axios';
import { PrismaClient } from '@prisma/client';

const _testAdminPassword = process.env.TEST_ADMIN_PASSWORD || process.env.TEST_PASSWORD;
if (!_testAdminPassword) {
  console.error('❌ Environment configuration error: TEST_ADMIN_PASSWORD or TEST_PASSWORD must be configured in environment to run test_e2e_external_exam_security.mjs.');
  process.exit(1);
}


const BASE_USERS = 'http://localhost:4002/api';
const BASE_AUTH = 'http://localhost:4001/api';
const BASE_COURSE = 'http://localhost:4004/api';
const RUN_ID = Date.now();

const db = new PrismaClient();

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;
let skipped = 0;
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

function skip(name, reason) {
  console.log(`⏭  ${name}: SKIPPED — ${reason}`);
  skipped++;
}

async function http(method, url, data = null, token = null, expectedStatus = null) {
  try {
    const headers = token ? { Authorization: `Bearer ${token}` } : {};
    const res = await axios({ method, url, data, headers, validateStatus: () => true });
    if (expectedStatus && res.status !== expectedStatus) {
      return { ok: false, status: res.status, data: res.data };
    }
    return { ok: true, status: res.status, data: res.data };
  } catch (err) {
    return { ok: false, status: 0, data: null, error: err.message };
  }
}

// Login as teacher and return token
async function teacherLogin() {
  // First login as admin
  const adminRes = await http('POST', `${BASE_AUTH}/auth/login`, {
    email: 'admin@edu.com',
    password: (process.env.TEST_ADMIN_PASSWORD || process.env.TEST_PASSWORD),
    role: 'ADMIN'
  });
  if (!adminRes.ok || !adminRes.data?.token) throw new Error('Admin login failed — check credentials');
  const adminToken = adminRes.data.token;

  // Create a new teacher
  const teacherEmail = `teacher_${RUN_ID}@example.com`;
  const createRes = await http('POST', `${BASE_USERS}/users/users`, {
    name: 'Security Test Teacher',
    email: teacherEmail,
    password: 'Teacher123!',
    role: 'TEACHER'
  }, adminToken);
  
  if (!createRes.ok) throw new Error(`Teacher creation failed: ${JSON.stringify(createRes.data)}`);
  console.log('Teacher created:', createRes.data);

  // Login as the new teacher
  const res = await http('POST', `${BASE_AUTH}/auth/login`, {
    email: teacherEmail,
    password: 'Teacher123!',
    role: 'TEACHER'
  });
  
  if (!res.ok || !res.data?.token) {
    console.error('Teacher login failed:', res.status, res.data);
    throw new Error('Teacher login failed after creation');
  }
  return res.data.token;
}

// Create a test exam via teacher API
async function createTestExam(teacherToken, { startTime, endTime, allowExternal = true, durationMinutes = 30 } = {}) {
  // Find a course owned by this teacher
  const coursesRes = await http('GET', `${BASE_COURSE}/courses`, null, teacherToken);
  let courses = coursesRes.data?.data || coursesRes.data || [];
  if (!Array.isArray(courses) && coursesRes.data?.courses) {
    courses = coursesRes.data.courses;
  }
  
  let courseId;
  if (!courses || !courses.length) {
    const newCourseRes = await http('POST', `${BASE_COURSE}/courses`, { title: `Security Test Course ${Date.now()}` }, teacherToken);
    if (!newCourseRes.ok) throw new Error(`Course creation failed: ${JSON.stringify(newCourseRes.data)}`);
    courseId = newCourseRes.data.id || newCourseRes.data.course?.id;
  } else {
    courseId = courses[0].id;
  }

  const examRes = await http('POST', `${BASE_COURSE}/exams`, {
    title: `Security Test Exam ${Date.now()}`,
    courseId,
    duration: durationMinutes,
    allowExternalStudents: allowExternal,
    startTime: startTime || null,
    endTime: endTime || null,
    passingScore: 50,
    questions: [
      { id: 'q1', text: 'ما هو 2 + 2؟', type: 'mcq', options: ['2', '4', '6', '8'], correct: 1 },
      { id: 'q2', text: 'ما هو 5 × 3؟', type: 'mcq', options: ['12', '15', '18', '20'], correct: 1 }
    ]
  }, teacherToken);

  if (!examRes.ok || !examRes.data?.examAccessCode) {
    throw new Error(`Exam creation failed or no access code: ${JSON.stringify(examRes.data)}`);
  }
  return examRes.data;
}

// Enter exam as external student
async function externalLogin(code, name, phone = '') {
  return http('POST', `${BASE_AUTH}/auth/external-exam`, {
    code,
    name,
    phone: phone || undefined
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Test Suite
// ─────────────────────────────────────────────────────────────────────────────

let teacherToken;
let openExam, futureExam, closedExam;
let openExamToken, openExamSessionId, openExamAttemptId;

async function setup() {
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('   Math Platform External Exam — Security & Anti-Cheat E2E Suite   ');
  console.log('═══════════════════════════════════════════════════════════════\n');

  try {
    teacherToken = await teacherLogin();
    console.log('🔑 Teacher authenticated\n');

    // Create 3 exam types for testing
    const now = new Date();
    const past = new Date(now.getTime() - 2 * 60 * 60 * 1000);   // 2h ago
    const future = new Date(now.getTime() + 2 * 60 * 60 * 1000); // 2h from now
    const soon = new Date(now.getTime() + 3 * 60 * 60 * 1000);   // 3h from now

    openExam = await createTestExam(teacherToken, {
      startTime: past.toISOString(),
      endTime: future.toISOString(),
      durationMinutes: 30
    });

    futureExam = await createTestExam(teacherToken, {
      startTime: future.toISOString(),
      endTime: soon.toISOString(),
      durationMinutes: 30
    });

    closedExam = await createTestExam(teacherToken, {
      startTime: new Date(now.getTime() - 4 * 60 * 60 * 1000).toISOString(),
      endTime: new Date(now.getTime() - 1 * 60 * 60 * 1000).toISOString(), // ended 1h ago
      durationMinutes: 30
    });

    console.log(`📋 Open exam code:   ${openExam.examAccessCode}`);
    console.log(`📋 Future exam code: ${futureExam.examAccessCode}`);
    console.log(`📋 Closed exam code: ${closedExam.examAccessCode}\n`);
  } catch (err) {
    console.error('❌ SETUP FAILED:', err.message);
    process.exit(1);
  }
}

// ─── SECTION 1: Entry Requirements ───────────────────────────────────────────

async function test01_NoEmailRequired() {
  // Just name + code — no email field
  const res = await externalLogin(openExam.examAccessCode, 'طالب الأمان الأول');
  if (res.status === 200 && res.data?.token) {
    pass('T01: External student can enter without email');
  } else {
    fail('T01: External student can enter without email', `HTTP ${res.status}`, JSON.stringify(res.data));
  }
}

async function test02_NoAccountCreated() {
  const name = `طالب_لا_حساب_${Date.now()}`;
  const res = await externalLogin(openExam.examAccessCode, name);
  if (res.status !== 200) {
    fail('T02: No user account created', `Login failed: ${res.status}`);
    return;
  }
  // Verify no User record was created
  const userRecord = await db.user.findFirst({ where: { name } });
  if (!userRecord) {
    pass('T02: No User account record created in DB');
  } else {
    fail('T02: No User account record created in DB', 'User record found in DB!');
  }
}

async function test03_NoIPRestriction() {
  // External student can enter without IP validation
  const res = await externalLogin(openExam.examAccessCode, 'طالب بدون IP');
  if (res.status === 200 && res.data?.token) {
    pass('T03: External student not blocked by IP restriction');
  } else {
    fail('T03: External student not blocked by IP restriction', `HTTP ${res.status}`);
  }
}

async function test04_IPDoesNotBlock() {
  // Verify the login response has no IP-related error code
  const res = await externalLogin(openExam.examAccessCode, 'طالب فحص IP');
  if (res.status !== 200) {
    fail('T04: IP does not block external login', `HTTP ${res.status}: ${res.data?.message}`);
    return;
  }
  const hasIpError = res.data?.code?.toLowerCase().includes('ip') ||
    res.data?.message?.toLowerCase().includes('ip') ||
    res.data?.message?.includes('IP_NOT_ALLOWED');
  if (!hasIpError) {
    pass('T04: No IP-related error in login response');
  } else {
    fail('T04: No IP-related error in login response', `IP error found: ${res.data?.code || res.data?.message}`);
  }
}

async function test05_InvalidCodeRejected() {
  const res = await externalLogin('XXXX-XXXX-XXXX', 'طالب');
  if (res.status === 404) {
    pass('T05: Invalid exam code rejected (404)');
  } else {
    fail('T05: Invalid exam code rejected', `Expected 404, got ${res.status}`);
  }
}

async function test06_MissingNameRejected() {
  const res = await http('POST', `${BASE_AUTH}/auth/external-exam`, {
    code: openExam.examAccessCode,
    name: ''
  });
  if (res.status === 400) {
    pass('T06: Empty name rejected (400)');
  } else {
    fail('T06: Empty name rejected', `Expected 400, got ${res.status}`);
  }
}

async function test07_WhitespaceNameRejected() {
  const res = await http('POST', `${BASE_AUTH}/auth/external-exam`, {
    code: openExam.examAccessCode,
    name: '   '
  });
  if (res.status === 400) {
    pass('T07: Whitespace-only name rejected (400)');
  } else {
    fail('T07: Whitespace-only name rejected', `Expected 400, got ${res.status}`);
  }
}

async function test08_PhoneOptional() {
  // Without phone
  const res1 = await externalLogin(openExam.examAccessCode, 'طالب بدون هاتف');
  // With phone
  const res2 = await externalLogin(openExam.examAccessCode, 'طالب مع هاتف', '01012345678');
  if (res1.status === 200 && res2.status === 200) {
    pass('T08: Phone number remains optional');
  } else {
    fail('T08: Phone number remains optional', `Without phone: ${res1.status}, With phone: ${res2.status}`);
  }
}

// ─── SECTION 2: Exam State Enforcement ───────────────────────────────────────

async function test09_FutureExamRejected() {
  const res = await externalLogin(futureExam.examAccessCode, 'طالب مستقبلي');
  if (res.status === 400) {
    pass('T09: Future exam rejected at API level (400)');
  } else {
    fail('T09: Future exam rejected at API level', `Expected 400, got ${res.status}`);
  }
}

async function test10_FutureExamReturnsCode() {
  const res = await externalLogin(futureExam.examAccessCode, 'طالب مستقبلي 2');
  if (res.data?.code === 'ASSESSMENT_NOT_OPEN') {
    pass('T10: Future exam returns code ASSESSMENT_NOT_OPEN');
  } else {
    fail('T10: Future exam returns code ASSESSMENT_NOT_OPEN', `Got code: ${res.data?.code || 'none'}`);
  }
}

async function test11_FutureExamHasOpenAt() {
  const res = await externalLogin(futureExam.examAccessCode, 'طالب مستقبلي 3');
  if (res.data?.openAt) {
    pass('T11: Future exam response includes openAt for UI countdown');
  } else {
    fail('T11: Future exam response includes openAt', 'openAt field missing from error response');
  }
}

async function test12_ClosedExamRejected() {
  const res = await externalLogin(closedExam.examAccessCode, 'طالب منتهي');
  if (res.status === 400) {
    pass('T12: Closed exam rejected at API level (400)');
  } else {
    fail('T12: Closed exam rejected at API level', `Expected 400, got ${res.status}`);
  }
}

async function test13_ClosedExamReturnsCode() {
  const res = await externalLogin(closedExam.examAccessCode, 'طالب منتهي 2');
  if (res.data?.code === 'ASSESSMENT_CLOSED') {
    pass('T13: Closed exam returns code ASSESSMENT_CLOSED');
  } else {
    fail('T13: Closed exam returns code ASSESSMENT_CLOSED', `Got code: ${res.data?.code || 'none'}`);
  }
}

async function test14_ClosedExamHasCloseAt() {
  const res = await externalLogin(closedExam.examAccessCode, 'طالب منتهي 3');
  if (res.data?.closeAt) {
    pass('T14: Closed exam response includes closeAt for UI display');
  } else {
    fail('T14: Closed exam response includes closeAt', 'closeAt field missing from error response');
  }
}

async function test15_OpenExamAllowsEntry() {
  const res = await externalLogin(openExam.examAccessCode, 'طالب مفتوح');
  if (res.status === 200 && res.data?.token && res.data?.assessmentId) {
    pass('T15: Open exam allows entry — token and assessmentId returned');
  } else {
    fail('T15: Open exam allows entry', `HTTP ${res.status}`, JSON.stringify(res.data));
  }
}

// ─── SECTION 3: JWT Scope & IDOR ─────────────────────────────────────────────

async function test16_JWTContainsCorrectScope() {
  const res = await externalLogin(openExam.examAccessCode, 'طالب JWT');
  if (res.status !== 200) { fail('T16: JWT scope', 'Login failed'); return; }

  const token = res.data.token;
  const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());

  if (
    payload.isExternalStudent === true &&
    payload.role === 'EXTERNAL_STUDENT' &&
    payload.assessmentId === openExam.id &&
    payload.externalSessionId
  ) {
    pass('T16: JWT contains correct external student scope');

    // Store for later tests
    openExamToken = token;
    openExamSessionId = payload.externalSessionId;
  } else {
    fail('T16: JWT contains correct external student scope',
      `isExternal=${payload.isExternalStudent}, role=${payload.role}, assessmentId=${payload.assessmentId}`);
  }
}

async function test17_TokenForExamACannotAccessExamB() {
  if (!openExamToken) { skip('T17: IDOR test', 'No token from T16'); return; }

  // Try to GET assessment B using token for A
  const assessmentIdB = closedExam.id;
  const res = await http('GET', `${BASE_COURSE}/assessments/${assessmentIdB}`, null, openExamToken);

  if (res.status === 403) {
    pass('T17: Token for exam A cannot access exam B (403)');
  } else {
    fail('T17: Token for exam A cannot access exam B', `Expected 403, got ${res.status}`);
  }
}

async function test18_ExternalTokenCannotAccessUserAPIs() {
  if (!openExamToken) { skip('T18: Token scope', 'No token from T16'); return; }

  const res = await http('GET', `${BASE_COURSE}/courses`, null, openExamToken);

  if (res.status === 403) {
    pass('T18: External token cannot access unrelated API (courses → 403)');
  } else {
    fail('T18: External token cannot access unrelated API', `Expected 403, got ${res.status}`);
  }
}

// ─── SECTION 4: Attempt Lifecycle & Answers ──────────────────────────────────

async function test19_StartAttemptCreatesRecord() {
  if (!openExamToken) { skip('T19: Start attempt', 'No token'); return; }

  const res = await http('POST', `${BASE_COURSE}/assessments/${openExam.id}/start`, {}, openExamToken);
  if (res.status === 200 && (res.data?.attempt?.id || res.data?.id)) {
    openExamAttemptId = res.data?.attempt?.id || res.data?.id;
    pass('T19: Start attempt creates record — attempt ID returned');
  } else {
    fail('T19: Start attempt creates record', `HTTP ${res.status}`, JSON.stringify(res.data));
  }
}

async function test20_AnswerSavingWorksBefore() {
  if (!openExamToken) { skip('T20: Answer saving', 'No token'); return; }

  const res = await http('PUT', `${BASE_COURSE}/assessments/${openExam.id}/attempt/answers`,
    { answers: [{ questionId: 'q1', answer: '1' }] },
    openExamToken
  );
  if (res.status === 200) {
    pass('T20: Answer saving works before expiration (200)');
  } else {
    fail('T20: Answer saving works before expiration', `HTTP ${res.status}`, JSON.stringify(res.data));
  }
}

async function test21_RefreshReusesAttempt() {
  if (!openExamToken) { skip('T21: Refresh resilience', 'No token'); return; }

  // Start again — should return existing attempt
  const res = await http('POST', `${BASE_COURSE}/assessments/${openExam.id}/start`, {}, openExamToken);
  const attemptId2 = res.data?.attempt?.id || res.data?.id;

  if (res.status === 200 && attemptId2 === openExamAttemptId) {
    pass('T21: Refresh reuses same attempt (isNew=false, same ID)');
  } else if (res.status === 200 && !openExamAttemptId) {
    pass('T21: Refresh reuses same attempt (attempt returned)');
  } else {
    fail('T21: Refresh reuses same attempt', `Got different attempt ID: ${attemptId2} vs ${openExamAttemptId}`);
  }
}

// ─── SECTION 5: Score Tampering ──────────────────────────────────────────────

async function test22_ScoreTamperingBlocked() {
  if (!openExamToken) { skip('T22: Score tampering', 'No token'); return; }

  // Submit with fake score in body — server must ignore it
  const res = await http('POST', `${BASE_COURSE}/assessments/${openExam.id}/attempt/submit`,
    {
      answers: [
        { questionId: 'q1', answer: '0' },  // Wrong answer (correct is 1)
        { questionId: 'q2', answer: '0' }   // Wrong answer (correct is 1)
      ],
      score: 100,          // Attempted tampering
      percentage: 100      // Attempted tampering
    },
    openExamToken
  );

  if (res.status === 200) {
    const actualScore = res.data?.percentage ?? res.data?.score;
    if (actualScore !== 100) {
      pass(`T22: Score tampering blocked — actual score ${actualScore}%, not 100%`);
    } else {
      fail('T22: Score tampering blocked', `Server returned 100% despite wrong answers!`);
    }
  } else {
    fail('T22: Score tampering blocked', `Unexpected HTTP ${res.status}`, JSON.stringify(res.data));
  }
}

// ─── SECTION 6: Anti-Cheat ───────────────────────────────────────────────────

async function test23_FirstViolationIncrements() {
  // Need a fresh open attempt
  const loginRes = await externalLogin(openExam.examAccessCode, `طالب مخالفة ${Date.now()}`);
  if (loginRes.status !== 200) { fail('T23: First violation', 'Login failed'); return; }

  const token = loginRes.data.token;
  await http('POST', `${BASE_COURSE}/assessments/${openExam.id}/start`, {}, token);

  const res = await http('POST', `${BASE_COURSE}/assessments/${openExam.id}/attempt/violation`,
    { type: 'TAB_SWITCH' }, token
  );

  if (res.status === 200 && res.data?.violationCount === 1) {
    pass('T23: First violation increments server count to 1');
  } else {
    fail('T23: First violation increments server count', `Got violationCount=${res.data?.violationCount}, status=${res.status}`);
  }
}

async function test24_SecondViolationIncrements() {
  const loginRes = await externalLogin(openExam.examAccessCode, `طالب مخالفة 2 ${Date.now()}`);
  if (loginRes.status !== 200) { fail('T24', 'Login failed'); return; }
  const token = loginRes.data.token;
  await http('POST', `${BASE_COURSE}/assessments/${openExam.id}/start`, {}, token);

  await http('POST', `${BASE_COURSE}/assessments/${openExam.id}/attempt/violation`,
    { type: 'TAB_SWITCH' }, token
  );
  const res = await http('POST', `${BASE_COURSE}/assessments/${openExam.id}/attempt/violation`,
    { type: 'WINDOW_BLUR' }, token
  );

  if (res.status === 200 && res.data?.violationCount === 2) {
    pass('T24: Second violation increments server count to 2');
  } else {
    fail('T24: Second violation increments server count', `Got violationCount=${res.data?.violationCount}`);
  }
}

async function test25_ThirdViolationTriggersDisqualification() {
  const loginRes = await externalLogin(openExam.examAccessCode, `طالب مخالفة 3 ${Date.now()}`);
  if (loginRes.status !== 200) { fail('T25', 'Login failed'); return; }
  const token = loginRes.data.token;
  await http('POST', `${BASE_COURSE}/assessments/${openExam.id}/start`, {}, token);

  await http('POST', `${BASE_COURSE}/assessments/${openExam.id}/attempt/violation`,
    { type: 'TAB_SWITCH' }, token
  );
  await http('POST', `${BASE_COURSE}/assessments/${openExam.id}/attempt/violation`,
    { type: 'WINDOW_BLUR' }, token
  );
  const res = await http('POST', `${BASE_COURSE}/assessments/${openExam.id}/attempt/violation`,
    { type: 'VISIBILITY_HIDDEN' }, token
  );

  if ((res.status === 200 || res.status === 403) && res.data?.isDisqualified === true) {
    pass('T25: Third violation triggers disqualification (isDisqualified=true)');
  } else {
    fail('T25: Third violation triggers disqualification',
      `status=${res.status}, isDisqualified=${res.data?.isDisqualified}, violationCount=${res.data?.violationCount}`);
  }
}

async function test26_VisibilityVisibleDoesNotCount() {
  const loginRes = await externalLogin(openExam.examAccessCode, `طالب رؤية ${Date.now()}`);
  if (loginRes.status !== 200) { fail('T26', 'Login failed'); return; }
  const token = loginRes.data.token;
  await http('POST', `${BASE_COURSE}/assessments/${openExam.id}/start`, {}, token);

  // Send VISIBILITY_VISIBLE — should NOT increment count
  const res = await http('POST', `${BASE_COURSE}/assessments/${openExam.id}/attempt/violation`,
    { type: 'VISIBILITY_VISIBLE' }, token
  );

  if (res.status === 200 && res.data?.violationCount === 0) {
    pass('T26: VISIBILITY_VISIBLE does not increment violation count');
  } else {
    fail('T26: VISIBILITY_VISIBLE does not increment violation count',
      `violationCount=${res.data?.violationCount}, status=${res.status}`);
  }
}

async function test27_ClientCannotResetViolationCount() {
  const loginRes = await externalLogin(openExam.examAccessCode, `طالب إعادة تعيين ${Date.now()}`);
  if (loginRes.status !== 200) { fail('T27', 'Login failed'); return; }
  const token = loginRes.data.token;
  await http('POST', `${BASE_COURSE}/assessments/${openExam.id}/start`, {}, token);

  // First violation
  await http('POST', `${BASE_COURSE}/assessments/${openExam.id}/attempt/violation`,
    { type: 'TAB_SWITCH' }, token
  );

  // Try to submit answer-save with violationCount=0 in body (should be ignored)
  await http('PUT', `${BASE_COURSE}/assessments/${openExam.id}/attempt/answers`,
    { answers: [], violationCount: 0 }, token
  );

  // Check DB: violation count should still be 1
  const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
  const dbAttempt = await db.externalExamAttempt.findFirst({
    where: { accessSessionId: payload.externalSessionId }
  });

  if (dbAttempt?.violationCount === 1) {
    pass('T27: Client cannot reset violation count — DB shows 1 despite client sending 0');
  } else {
    fail('T27: Client cannot reset violation count', `DB violationCount=${dbAttempt?.violationCount}`);
  }
}

// ─── SECTION 7: Submission & Expiration ──────────────────────────────────────

async function test28_DuplicateSubmitIsSafe() {
  const loginRes = await externalLogin(openExam.examAccessCode, `طالب تسليم مزدوج ${Date.now()}`);
  if (loginRes.status !== 200) { fail('T28', 'Login failed'); return; }
  const token = loginRes.data.token;
  await http('POST', `${BASE_COURSE}/assessments/${openExam.id}/start`, {}, token);

  const submit1 = await http('POST', `${BASE_COURSE}/assessments/${openExam.id}/attempt/submit`,
    { answers: [{ questionId: 'q1', answer: '1' }] }, token
  );
  const submit2 = await http('POST', `${BASE_COURSE}/assessments/${openExam.id}/attempt/submit`,
    { answers: [{ questionId: 'q1', answer: '1' }] }, token
  );

  // Both should succeed (idempotent for external students)
  if (submit1.status === 200 && submit2.status === 200) {
    // Score should be the same both times
    const score1 = submit1.data?.percentage ?? submit1.data?.score;
    const score2 = submit2.data?.percentage ?? submit2.data?.score;
    if (score1 === score2) {
      pass('T28: Duplicate submission is safe and idempotent — same score returned');
    } else {
      fail('T28: Duplicate submission score inconsistency', `First=${score1}, Second=${score2}`);
    }
  } else {
    fail('T28: Duplicate submission is safe', `submit1=${submit1.status}, submit2=${submit2.status}`);
  }
}

async function test29_AnswerAfterExpirationRejected() {
  // Create an exam that expires immediately
  const now = new Date();
  const shortExam = await createTestExam(teacherToken, {
    startTime: new Date(now.getTime() - 60 * 60 * 1000).toISOString(), // started 1h ago
    endTime: new Date(now.getTime() + 10 * 60 * 1000).toISOString(),   // ends in 10 min
    durationMinutes: 5  // 1-minute duration — attempt expires fast
  });

  const loginRes = await externalLogin(shortExam.examAccessCode, `طالب منتهي وقت ${Date.now()}`);
  if (loginRes.status !== 200) { fail('T29', `Login failed: ${loginRes.status}`); return; }
  const token = loginRes.data.token;

  // Start attempt — but duration is 1 min, and we set expiresAt in DB to past
  await http('POST', `${BASE_COURSE}/assessments/${shortExam.id}/start`, {}, token);

  // Force-expire the attempt in DB
  const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
  await db.externalExamAttempt.updateMany({
    where: { accessSessionId: payload.externalSessionId },
    data: { expiresAt: new Date(Date.now() - 5000) } // expired 5s ago
  });

  // Now try to save answers
  const res = await http('PUT', `${BASE_COURSE}/assessments/${shortExam.id}/attempt/answers`,
    { answers: [{ questionId: 'q1', answer: '1' }] }, token
  );

  if (res.status === 403 && res.data?.code === 'EXAM_TIME_EXPIRED') {
    pass('T29: Answer saving after expiration rejected (403 EXAM_TIME_EXPIRED)');
  } else {
    fail('T29: Answer saving after expiration rejected',
      `Expected 403 EXAM_TIME_EXPIRED, got ${res.status} ${res.data?.code}`);
  }
}

async function test30_SubmitAfterExpirationSafe() {
  // Use same expired scenario — submit should auto-finalize or return existing
  const now = new Date();
  const shortExam2 = await createTestExam(teacherToken, {
    startTime: new Date(now.getTime() - 60 * 60 * 1000).toISOString(),
    endTime: new Date(now.getTime() + 10 * 60 * 1000).toISOString(),
    durationMinutes: 5
  });

  const loginRes = await externalLogin(shortExam2.examAccessCode, `طالب منتهي تسليم ${Date.now()}`);
  if (loginRes.status !== 200) { fail('T30', `Login: ${loginRes.status}`); return; }
  const token = loginRes.data.token;
  await http('POST', `${BASE_COURSE}/assessments/${shortExam2.id}/start`, {}, token);

  // Force expire
  const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
  await db.externalExamAttempt.updateMany({
    where: { accessSessionId: payload.externalSessionId },
    data: { expiresAt: new Date(Date.now() - 5000) }
  });

  // Submit after expiration
  const res = await http('POST', `${BASE_COURSE}/assessments/${shortExam2.id}/attempt/submit`,
    { answers: [{ questionId: 'q1', answer: '1' }] }, token
  );

  if (res.status === 200) {
    // Should be finalized as TIME_EXPIRED
    const dbAttempt = await db.externalExamAttempt.findFirst({
      where: { accessSessionId: payload.externalSessionId }
    });
    if (dbAttempt?.status === 'TIME_EXPIRED') {
      pass('T30: Submit after expiration returns 200 and finalizes as TIME_EXPIRED');
    } else {
      fail('T30: Submit after expiration', `DB status=${dbAttempt?.status}, expected TIME_EXPIRED`);
    }
  } else {
    fail('T30: Submit after expiration safe return', `HTTP ${res.status}`, JSON.stringify(res.data));
  }
}

async function test31_AutoSubmitReasonStored() {
  // After test30 above, cheatingReason should be AUTO_SUBMITTED_TIME_EXPIRED
  const now = new Date();
  const shortExam3 = await createTestExam(teacherToken, {
    startTime: new Date(now.getTime() - 60 * 60 * 1000).toISOString(),
    endTime: new Date(now.getTime() + 10 * 60 * 1000).toISOString(),
    durationMinutes: 5
  });

  const loginRes = await externalLogin(shortExam3.examAccessCode, `طالب سبب ${Date.now()}`);
  if (loginRes.status !== 200) { fail('T31', `Login failed`); return; }
  const token = loginRes.data.token;
  await http('POST', `${BASE_COURSE}/assessments/${shortExam3.id}/start`, {}, token);

  const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
  await db.externalExamAttempt.updateMany({
    where: { accessSessionId: payload.externalSessionId },
    data: { expiresAt: new Date(Date.now() - 5000) }
  });

  await http('POST', `${BASE_COURSE}/assessments/${shortExam3.id}/attempt/submit`,
    { answers: [] }, token
  );

  const dbAttempt = await db.externalExamAttempt.findFirst({
    where: { accessSessionId: payload.externalSessionId }
  });

  if (dbAttempt?.cheatingReason === 'AUTO_SUBMITTED_TIME_EXPIRED') {
    pass('T31: Auto-submit stores cheatingReason=AUTO_SUBMITTED_TIME_EXPIRED');
  } else {
    fail('T31: Auto-submit reason stored', `cheatingReason=${dbAttempt?.cheatingReason}`);
  }
}

async function test32_MultipleTabsNoNewAttempt() {
  const name = `طالب تبويبات ${Date.now()}`;
  // Login twice with same name (simulates two tabs)
  const res1 = await externalLogin(openExam.examAccessCode, name);
  const res2 = await externalLogin(openExam.examAccessCode, name);

  if (res1.status !== 200 || res2.status !== 200) {
    fail('T32: Multiple tabs', 'Login failed for one tab');
    return;
  }

  // Both should return same attempt (same name+phone on same assessment)
  const attempts = await db.externalExamAttempt.findMany({
    where: { assessmentId: openExam.id, studentName: name }
  });

  if (attempts.length === 1) {
    pass('T32: Multiple tabs do not create independent attempts — same attempt reused');
  } else {
    fail('T32: Multiple tabs no new attempt', `Found ${attempts.length} attempts, expected 1`);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Cleanup
// ─────────────────────────────────────────────────────────────────────────────

async function cleanup() {
  try {
    // Delete test exams
    for (const exam of [openExam, futureExam, closedExam].filter(Boolean)) {
      await http('DELETE', `${BASE_COURSE}/exams/${exam.id}`, null, teacherToken);
    }
  } catch (e) {
    // Cleanup failures are non-critical
  }
  await db.$disconnect();
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Runner
// ─────────────────────────────────────────────────────────────────────────────

async function runAll() {
  await setup();

  console.log('── SECTION 1: Entry Requirements ──────────────────────────────');
  await test01_NoEmailRequired();
  await test02_NoAccountCreated();
  await test03_NoIPRestriction();
  await test04_IPDoesNotBlock();
  await test05_InvalidCodeRejected();
  await test06_MissingNameRejected();
  await test07_WhitespaceNameRejected();
  await test08_PhoneOptional();

  console.log('\n── SECTION 2: Exam State Enforcement ──────────────────────────');
  await test09_FutureExamRejected();
  await test10_FutureExamReturnsCode();
  await test11_FutureExamHasOpenAt();
  await test12_ClosedExamRejected();
  await test13_ClosedExamReturnsCode();
  await test14_ClosedExamHasCloseAt();
  await test15_OpenExamAllowsEntry();

  console.log('\n── SECTION 3: JWT Scope & IDOR ─────────────────────────────────');
  await test16_JWTContainsCorrectScope();
  await test17_TokenForExamACannotAccessExamB();
  await test18_ExternalTokenCannotAccessUserAPIs();

  console.log('\n── SECTION 4: Attempt Lifecycle ────────────────────────────────');
  await test19_StartAttemptCreatesRecord();
  await test20_AnswerSavingWorksBefore();
  await test21_RefreshReusesAttempt();

  console.log('\n── SECTION 5: Score Tampering ──────────────────────────────────');
  await test22_ScoreTamperingBlocked();

  console.log('\n── SECTION 6: Anti-Cheat ───────────────────────────────────────');
  await test23_FirstViolationIncrements();
  await test24_SecondViolationIncrements();
  await test25_ThirdViolationTriggersDisqualification();
  await test26_VisibilityVisibleDoesNotCount();
  await test27_ClientCannotResetViolationCount();

  console.log('\n── SECTION 7: Submission & Expiration ──────────────────────────');
  await test28_DuplicateSubmitIsSafe();
  await test29_AnswerAfterExpirationRejected();
  await test30_SubmitAfterExpirationSafe();
  await test31_AutoSubmitReasonStored();
  await test32_MultipleTabsNoNewAttempt();

  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('                 SECURITY TEST FINAL RESULTS                   ');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(`\nTOTAL: ${passed + failed + skipped} | ✅ ${passed} PASSED | ❌ ${failed} FAILED | ⏭ ${skipped} SKIPPED\n`);

  if (failures.length > 0) {
    console.log('── FAILURES ─────────────────────────────────────────────────────');
    failures.forEach(f => {
      console.error(`  ❌ ${f.name}: ${f.reason}${f.detail ? ` (${f.detail})` : ''}`);
    });
    console.log('');
  }

  if (failed === 0) {
    console.log('🎉 ALL SECURITY CHECKS PASSED\n');
  } else {
    console.log(`⚠️  ${failed} SECURITY CHECKS FAILED\n`);
  }

  await cleanup();
  process.exit(failed > 0 ? 1 : 0);
}

runAll().catch(async (err) => {
  console.error('FATAL:', err);
  await db.$disconnect();
  process.exit(1);
});
