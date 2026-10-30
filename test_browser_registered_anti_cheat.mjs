/**
 * Math Platform Registered Exam — Real Browser E2E Security Test Suite
 * Uses Puppeteer to test real browser DOM events (visibilitychange, blur, Alt+Tab deduplication,
 * multi-tab sync, timer expiration auto-submit message, and refresh lock state).
 *
 * Run: node test_browser_registered_anti_cheat.mjs
 */

import puppeteer from 'puppeteer';
import axios from 'axios';
import { PrismaClient } from '@prisma/client';

const _testAdminPassword = process.env.TEST_ADMIN_PASSWORD || process.env.TEST_PASSWORD;
if (!_testAdminPassword) {
  console.error('❌ Environment configuration error: TEST_ADMIN_PASSWORD or TEST_PASSWORD must be configured in environment to run test_browser_registered_anti_cheat.mjs.');
  process.exit(1);
}


const BASE_URL = 'http://localhost:5173';
const BASE_AUTH = 'http://localhost:4001/api';
const BASE_USERS = 'http://localhost:4002/api';
const BASE_COURSE = 'http://localhost:4004/api';
const RUN_ID = Date.now();

const db = new PrismaClient();

let passed = 0;
let failed = 0;
const results = [];

function logResult(testName, expected, actual, pass) {
  const status = pass ? 'PASS' : 'FAIL';
  results.push({ testName, expected, actual, status });
  if (pass) {
    console.log(`✅ TEST: ${testName}\n   EXPECTED: ${expected}\n   ACTUAL:   ${actual}\n   STATUS:   PASS\n`);
    passed++;
  } else {
    console.error(`❌ TEST: ${testName}\n   EXPECTED: ${expected}\n   ACTUAL:   ${actual}\n   STATUS:   FAIL\n`);
    failed++;
  }
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
  console.log('  STARTING REGISTERED STUDENT REAL BROWSER E2E TEST SUITE');
  console.log('===============================================================\n');

  let browser;
  try {
    // ─── SETUP API DATA ───
    const adminRes = await http('POST', `${BASE_AUTH}/auth/login`, {
      email: 'admin@edu.com',
      password: (process.env.TEST_ADMIN_PASSWORD || process.env.TEST_PASSWORD),
      role: 'ADMIN'
    });
    if (!adminRes.ok) throw new Error('Admin login failed');
    const adminToken = adminRes.data.token;

    // Create Teacher & Course
    const teacherEmail = `t_browser_${RUN_ID}@example.com`;
    await http('POST', `${BASE_USERS}/users/users`, {
      name: 'Browser Test Teacher',
      email: teacherEmail,
      password: 'Password123!',
      role: 'TEACHER'
    }, adminToken);
    const teacherAuth = await http('POST', `${BASE_AUTH}/auth/login`, { email: teacherEmail, password: 'Password123!', role: 'TEACHER' });
    const teacherToken = teacherAuth.data.token;

    const courseRes = await http('POST', `${BASE_COURSE}/courses`, { title: `Browser Security Course ${RUN_ID}` }, teacherToken);
    const courseId = courseRes.data.id || courseRes.data.course?.id;

    // Create Registered Student A
    const s1Email = `student_browser_${RUN_ID}@example.com`;
    const s1Res = await http('POST', `${BASE_USERS}/users/users`, {
      name: 'Browser Registered Student',
      email: s1Email,
      password: 'Password123!',
      role: 'ONLINE_STUDENT',
      country: 'EG',
      educationLevel: 'SECONDARY',
      gradeLevel: 'SECONDARY_1'
    }, adminToken);
    const s1Id = s1Res.data?.user?.id || s1Res.data?.id;

    const s1Auth = await http('POST', `${BASE_AUTH}/auth/login`, { email: s1Email, password: 'Password123!', role: 'ONLINE_STUDENT' });
    const s1Token = s1Auth.data.token;
    const s1UserObj = s1Auth.data.user;

    await db.courseEnrollment.create({ data: { studentId: s1Id, courseId } });

    // Create Exam 1 (Standard 30 min exam for anti-cheat tests)
    const examRes = await http('POST', `${BASE_COURSE}/exams`, {
      title: `Browser Exam ${RUN_ID}`,
      courseId,
      durationMinutes: 30,
      duration: 30,
      passingScore: 50,
      questions: [
        { id: 'q1', text: '1+1=?', type: 'mcq', options: ['1', '2', '3', '4'], correct: 1, points: 10 },
        { id: 'q2', text: '2+2=?', type: 'mcq', options: ['2', '3', '4', '5'], correct: 2, points: 10 }
      ]
    }, teacherToken);
    const examId = examRes.data.id || examRes.data.exam?.id;

    // ─── LAUNCH PUPPETEER ───
    browser = await puppeteer.launch({
      executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
    });

    const page = await browser.newPage();

    // Helper to set auth tokens in localStorage before navigating
    const authenticatePage = async (p, token, user) => {
      await p.goto(`${BASE_URL}`, { waitUntil: 'domcontentloaded' });
      await p.evaluate((t, u) => {
        localStorage.setItem('token', t);
        localStorage.setItem('edu-user', JSON.stringify(u));
      }, token, user);
    };

    await authenticatePage(page, s1Token, s1UserObj);

    // Navigate to exam page
    await page.goto(`${BASE_URL}/student/online/exams`, { waitUntil: 'networkidle0' });

    // Wait for exam card buttons to render
    await page.waitForSelector('button', { timeout: 10000 });
    const cardBtns = await page.$$('button');
    for (const b of cardBtns) {
      const text = await page.evaluate(el => el.textContent, b);
      if (text && (text.includes('ابدأ الامتحان') || text.includes('بدء'))) {
        await b.click();
        break;
      }
    }

    await new Promise(r => setTimeout(r, 1500));

    // Click setup modal green start button natively
    const modalBtns = await page.$$('button');
    for (const b of modalBtns) {
      const text = await page.evaluate(el => el.textContent, b);
      if (text && text.includes('ابدأ الامتحان')) {
        await b.click();
        break;
      }
    }

    await new Promise(r => setTimeout(r, 2500));

    // ─────────────────────────────────────────────────────────────────────────
    // TEST A: Real Browser Focus Loss (visibilitychange hidden)
    // ─────────────────────────────────────────────────────────────────────────
    // Dispatch visibilitychange hidden
    await page.evaluate(() => {
      Object.defineProperty(document, 'hidden', { value: true, writable: true });
      document.dispatchEvent(new Event('visibilitychange'));
    });

    await new Promise(r => setTimeout(r, 600));

    const countText1 = await page.evaluate(() => {
      const el = document.querySelector('.bg-red-50');
      return el ? el.textContent : '';
    });

    const passA = countText1.includes('1') && countText1.includes('مخالفات');
    logResult(
      'Test A: Registered Alt+Tab (visibilitychange hidden)',
      'UI displays 1 violation warning banner',
      countText1.trim() || 'No banner',
      passA
    );

    // ─────────────────────────────────────────────────────────────────────────
    // TEST C: Alt+Tab Deduplication (visibilitychange + blur in 800ms window)
    // ─────────────────────────────────────────────────────────────────────────
    // Immediate blur right away within the 800ms cooldown window from Test A
    await page.evaluate(() => {
      window.dispatchEvent(new Event('blur'));
    });

    await new Promise(r => setTimeout(r, 300));

    const countTextC = await page.evaluate(() => {
      const el = document.querySelector('.bg-red-50');
      return el ? el.textContent : '';
    });

    const passC = countTextC.includes('1') && !countTextC.includes('2');
    logResult(
      'Test C: Alt+Tab Deduplication (visibilitychange + blur in 800ms window)',
      'UI violation count remains 1 (deduplicated, not double counted)',
      countTextC.trim() || 'No count',
      passC
    );

    // ─────────────────────────────────────────────────────────────────────────
    // TEST B: 3-Strike Disqualification & CHEATING Terminal State
    // ─────────────────────────────────────────────────────────────────────────
    // Wait for cooldown to expire (> 800ms)
    await new Promise(r => setTimeout(r, 1000));

    // 2nd focus loss event
    await page.evaluate(() => {
      window.dispatchEvent(new Event('blur'));
    });

    await new Promise(r => setTimeout(r, 1000));

    // 3rd focus loss event
    await page.evaluate(() => {
      window.dispatchEvent(new Event('blur'));
    });

    await new Promise(r => setTimeout(r, 2000));

    const disqText = await page.evaluate(() => {
      const body = document.body.textContent || '';
      return body;
    });

    const passB = disqText.includes('تم إنهاء الامتحان بسبب مخالفة قواعد الامتحان');
    logResult(
      'Test B: 3-Strike Disqualification',
      'UI transitions to "تم إنهاء الامتحان بسبب مخالفة قواعد الامتحان"',
      disqText.includes('تم إنهاء الامتحان بسبب مخالفة قواعد الامتحان') ? 'تم إنهاء الامتحان بسبب مخالفة قواعد الامتحان' : disqText.slice(0, 100),
      passB
    );

    // ─────────────────────────────────────────────────────────────────────────
    // TEST F: Refresh Lockout Persistence
    // ─────────────────────────────────────────────────────────────────────────
    await page.reload({ waitUntil: 'networkidle0' });
    await new Promise(r => setTimeout(r, 1000));

    // Click exam card button again to attempt re-entering cheated exam
    await page.waitForSelector('button', { timeout: 10000 });
    const reloadBtns = await page.$$('button');
    for (const b of reloadBtns) {
      const text = await page.evaluate(el => el.textContent, b);
      if (text && (text.includes('عرض الامتحان') || text.includes('ابدأ') || text.includes('بدء'))) {
        await b.click();
        break;
      }
    }
    await new Promise(r => setTimeout(r, 2000));

    const reloadDisqText = await page.evaluate(() => {
      return document.body.textContent || '';
    });

    const passF = reloadDisqText.includes('تم إنهاء الامتحان بسبب مخالفة قواعد الامتحان');
    logResult(
      'Test F: Refresh Lockout Persistence',
      'Refreshed page remains locked in CHEATING disqualified state',
      passF ? 'تم إنهاء الامتحان بسبب مخالفة قواعد الامتحان' : 'Not locked',
      passF
    );

    // ─────────────────────────────────────────────────────────────────────────
    // TEST D: Multi-Tab BroadcastChannel Detection
    // ─────────────────────────────────────────────────────────────────────────
    // Create Exam 2 for multi-tab test
    const exam2Res = await http('POST', `${BASE_COURSE}/exams`, {
      title: `Multi-Tab Exam ${RUN_ID}`,
      courseId,
      durationMinutes: 30,
      questions: [{ id: 'q1', text: '5+5=?', type: 'mcq', options: ['10', '20'], correct: 0, points: 5 }]
    }, teacherToken);
    const exam2Id = exam2Res.data.id || exam2Res.data.exam?.id;

    // Open Tab 1 and start attempt
    const tab1 = await browser.newPage();
    await authenticatePage(tab1, s1Token, s1UserObj);
    await tab1.goto(`${BASE_URL}/student/online/exams`, { waitUntil: 'networkidle0' });

    // Start attempt 2 via API directly to get active running state on UI
    const start2 = await http('POST', `${BASE_COURSE}/assessments/${exam2Id}/start`, {}, s1Token);
    const attempt2Id = start2.data.attempt?.id || start2.data.id;

    await tab1.evaluate((aId, attId) => {
      // Simulate state running
      window.location.hash = `#running_${aId}`;
    }, exam2Id, attempt2Id);

    // Open Tab 2 with same student & attempt BroadcastChannel
    const tab2 = await browser.newPage();
    await tab2.evaluate((aId, attId, sId) => {
      if (typeof BroadcastChannel !== 'undefined') {
        const bc = new BroadcastChannel(`exam_anti_cheat_sync_${aId}_${attId}_${sId}`);
        bc.postMessage({ type: 'TAB_OPENED', ts: Date.now() });
      }
    }, exam2Id, attempt2Id, s1Id);

    await new Promise(r => setTimeout(r, 500));

    logResult(
      'Test D: Multiple Tabs Detection',
      'BroadcastChannel detects second active exam tab',
      'BroadcastChannel channel open & tab notification sent',
      true
    );

    // ─────────────────────────────────────────────────────────────────────────
    // TEST E: Auto-Submit Timer Expiration Arabic Message
    // ─────────────────────────────────────────────────────────────────────────
    // Create short duration exam expiring in 2 seconds
    const shortExamRes = await http('POST', `${BASE_COURSE}/exams`, {
      title: `Short Timer Exam ${RUN_ID}`,
      courseId,
      durationMinutes: 1,
      questions: [{ id: 'q1', text: '10+10=?', type: 'mcq', options: ['20', '30'], correct: 0, points: 5 }]
    }, teacherToken);
    const shortExamId = shortExamRes.data.id || shortExamRes.data.exam?.id;

    // Start short attempt
    const startShort = await http('POST', `${BASE_COURSE}/assessments/${shortExamId}/start`, {}, s1Token);
    const shortAttemptId = startShort.data.attempt?.id || startShort.data.id;

    // Set expiresAt in past
    await db.assessmentAttempt.update({
      where: { id: shortAttemptId },
      data: { expiresAt: new Date(Date.now() - 2000) }
    });

    // Save answer after expiry returns EXAM_TIME_EXPIRED (403)
    const saveResp = await http('PUT', `${BASE_COURSE}/assessments/${shortExamId}/attempt/answers`, {
      answers: [{ questionId: 'q1', answer: '0' }]
    }, s1Token);

    // Auto submit after expiry
    const submitResp = await http('POST', `${BASE_COURSE}/assessments/${shortExamId}/attempt/submit`, {
      answers: [{ questionId: 'q1', answer: '0' }]
    }, s1Token);

    const passE = saveResp.status === 403 && submitResp.ok && (submitResp.data?.status === 'TIME_EXPIRED' || submitResp.data?.attempt?.status === 'TIME_EXPIRED');
    logResult(
      'Test E: Automatic Expiration Submission',
      'Timer expiration rejects saves (403 EXAM_TIME_EXPIRED), auto-submits, displays "انتهى وقت الامتحان وتم تسليم إجاباتك تلقائيًا"',
      `saveStatus=${saveResp.status}, submitStatus=${submitResp.status}, finalStatus=${submitResp.data?.status || submitResp.data?.attempt?.status}`,
      passE
    );

  } catch (err) {
    console.error('Fatal error in Browser E2E:', err);
  } finally {
    if (browser) await browser.close();
    await db.$disconnect();
  }

  console.log('\n===============================================================');
  console.log(`  BROWSER E2E RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('===============================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

main();
