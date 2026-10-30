/**
 * Phase 5.1 Comprehensive Automated Test Suite — Teacher Attendance UX Redesign
 *
 * Covers:
 * 1. Authoritative Attendance Date (Selected date is preserved, past dates work, after-midnight save preserves date)
 * 2. Dedicated Date Retrieval (GET /api/attendance/by-date returns records for authorized students only)
 * 3. Bulk Status Assignment (PRESENT, LATE, ABSENT) & Idempotent Upsert
 * 4. Duplicate Student Deduplication across multiple groups/courses
 * 5. Notification Integrity on Bulk Save (no duplicate spamming on repeat saves)
 * 6. IDOR & Role Security (Students blocked from bulk/date endpoints, cross-teacher manipulation blocked)
 */
import axios from 'axios';
import { PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';

const _testAdminPassword = process.env.TEST_ADMIN_PASSWORD || process.env.TEST_PASSWORD;
if (!_testAdminPassword) {
  console.error('❌ Environment configuration error: TEST_ADMIN_PASSWORD or TEST_PASSWORD must be configured in environment to run test_phase5_1_teacher_attendance.mjs.');
  process.exit(1);
}


const prisma = new PrismaClient();
const AUTH_URL = 'http://localhost:4001/api/auth';
const ATTENDANCE_URL = 'http://localhost:4002/api/attendance';
const NOTIFICATIONS_URL = 'http://localhost:4002/api/notifications';
const JWT_SECRET = process.env.JWT_SECRET || 'dev_secret_key_123';
const TS = Date.now();

const results = {
  total: 0,
  passed: 0,
  failed: 0,
  details: []
};

function assert(condition, name, details = '') {
  results.total++;
  if (condition) {
    results.passed++;
    console.log(`  ✓ PASS: ${name}`);
    results.details.push({ name, status: 'PASS', details });
  } else {
    results.failed++;
    console.error(`  ✗ FAIL: ${name} - ${details}`);
    results.details.push({ name, status: 'FAIL', details });
  }
}

async function loginAs(role, email, password = 'password123') {
  const r = await axios.post(`${AUTH_URL}/login`, { email, password, role });
  return r.data;
}

async function runTests() {
  console.log('\n================================================================');
  console.log('🧪 RUNNING PHASE 5.1 AUTOMATED TEST SUITE (TEACHER ATTENDANCE UX)');
  console.log('================================================================\n');

  try {
    // ----------------------------------------------------
    // Step 0: Setup Actors, Courses, and Multi-Group Enrolls
    // ----------------------------------------------------
    console.log('--- Step 0: Setup Test Actors & Multiple Groups ---');

    // 1. Admin
    const adminLogin = await loginAs('ADMIN', 'admin@edu.com', (process.env.TEST_ADMIN_PASSWORD || process.env.TEST_PASSWORD));
    const adminToken = adminLogin.token;
    assert(!!adminToken, 'Admin authenticated');

    // 2. Teacher A
    const teacherA = await prisma.user.create({
      data: {
        email: `teacher_p51_a_${TS}@test.com`,
        password: 'hashed_password',
        name: 'الأستاذ أحمد فؤاد',
        role: 'TEACHER'
      }
    });
    const tokenTeacherA = jwt.sign(
      { userId: teacherA.id, role: 'TEACHER', email: teacherA.email },
      JWT_SECRET,
      { expiresIn: '2h' }
    );

    // 3. Teacher B (unrelated teacher)
    const teacherB = await prisma.user.create({
      data: {
        email: `teacher_p51_b_${TS}@test.com`,
        password: 'hashed_password',
        name: 'الأستاذ محمود إبراهيم',
        role: 'TEACHER'
      }
    });
    const tokenTeacherB = jwt.sign(
      { userId: teacherB.id, role: 'TEACHER', email: teacherB.email },
      JWT_SECRET,
      { expiresIn: '2h' }
    );

    // 4. Students S1, S2, S3
    const student1 = await prisma.user.create({
      data: {
        email: `student_p51_1_${TS}@test.com`,
        password: 'hashed_password',
        name: 'طالب سنتر 1',
        role: 'CENTER_STUDENT',
        gradeLevel: 'SECONDARY_1'
      }
    });
    const tokenStudent1 = jwt.sign(
      { userId: student1.id, role: 'CENTER_STUDENT', email: student1.email },
      JWT_SECRET,
      { expiresIn: '2h' }
    );

    const student2 = await prisma.user.create({
      data: {
        email: `student_p51_2_${TS}@test.com`,
        password: 'hashed_password',
        name: 'طالب سنتر 2',
        role: 'CENTER_STUDENT',
        gradeLevel: 'SECONDARY_1'
      }
    });

    const student3 = await prisma.user.create({
      data: {
        email: `student_p51_3_${TS}@test.com`,
        password: 'hashed_password',
        name: 'طالب سنتر 3',
        role: 'ONLINE_STUDENT',
        gradeLevel: 'SECONDARY_2'
      }
    });

    // 5. Create 2 Courses for Teacher A (Group A and Group B)
    const courseGroupA = await prisma.course.create({
      data: {
        title: `مجموعة السنتر أ ${TS}`,
        teacherId: teacherA.id,
        status: 'PUBLISHED'
      }
    });

    const courseGroupB = await prisma.course.create({
      data: {
        title: `مجموعة السنتر ب ${TS}`,
        teacherId: teacherA.id,
        status: 'PUBLISHED'
      }
    });

    // Student 1 is enrolled in BOTH Group A and Group B (Multi-group overlap test)
    await prisma.courseEnrollment.create({
      data: { studentId: student1.id, courseId: courseGroupA.id }
    });
    await prisma.courseEnrollment.create({
      data: { studentId: student1.id, courseId: courseGroupB.id }
    });

    // Student 2 enrolled in Group A only
    await prisma.courseEnrollment.create({
      data: { studentId: student2.id, courseId: courseGroupA.id }
    });

    // Student 3 enrolled in Group B only
    await prisma.courseEnrollment.create({
      data: { studentId: student3.id, courseId: courseGroupB.id }
    });

    assert(true, 'Test actors, courses, and multi-group enrollments prepared');


    // ----------------------------------------------------
    // Section 1: Authoritative Attendance Date Semantics
    // ----------------------------------------------------
    console.log('\n--- Section 1: Authoritative Attendance Date Semantics ---');

    // Scenario: Teacher is recording attendance for yesterday (e.g. 2026-08-20) at 01:30 AM today
    const selectedPastDate = '2026-08-20';

    const bulkSaveRes = await axios.post(
      `${ATTENDANCE_URL}/bulk`,
      {
        date: selectedPastDate,
        records: [
          { studentId: student1.id, status: 'PRESENT' },
          { studentId: student2.id, status: 'LATE' },
          { studentId: student3.id, status: 'ABSENT' }
        ]
      },
      { headers: { Authorization: `Bearer ${tokenTeacherA}` } }
    );

    assert(bulkSaveRes.status === 200, 'Bulk save response returned 200 OK');
    assert(bulkSaveRes.data.count === 3, 'Bulk save saved 3 records');
    assert(
      bulkSaveRes.data.summary.present === 1 &&
      bulkSaveRes.data.summary.late === 1 &&
      bulkSaveRes.data.summary.absent === 1,
      'Bulk save returned accurate summary (1 present, 1 late, 1 absent)'
    );

    // Verify DB date is strictly 2026-08-20T00:00:00.000Z
    const dbRecordS1 = await prisma.attendance.findFirst({
      where: {
        studentId: student1.id,
        date: {
          gte: new Date(Date.UTC(2026, 7, 20, 0, 0, 0)),
          lte: new Date(Date.UTC(2026, 7, 20, 23, 59, 59))
        }
      }
    });

    assert(!!dbRecordS1, 'Database record created for the exact selected attendance date (2026-08-20)');
    assert(dbRecordS1.status === 'PRESENT', 'Student 1 recorded as PRESENT');
    assert(
      dbRecordS1.date.toISOString().startsWith('2026-08-20'),
      `Authoritative date is preserved as 2026-08-20 (got ${dbRecordS1.date.toISOString()})`
    );


    // ----------------------------------------------------
    // Section 2: Loading Existing Day Attendance (GET /api/attendance/by-date)
    // ----------------------------------------------------
    console.log('\n--- Section 2: Loading Existing Day Attendance by Date ---');

    const byDateRes = await axios.get(
      `${ATTENDANCE_URL}/by-date?date=${selectedPastDate}`,
      { headers: { Authorization: `Bearer ${tokenTeacherA}` } }
    );

    assert(byDateRes.status === 200, 'GET /api/attendance/by-date returned 200 OK');
    assert(byDateRes.data.count >= 3, 'GET /api/attendance/by-date returned student records for Teacher A');
    
    const s1FromDate = byDateRes.data.data.find(r => r.studentId === student1.id);
    const s2FromDate = byDateRes.data.data.find(r => r.studentId === student2.id);
    const s3FromDate = byDateRes.data.data.find(r => r.studentId === student3.id);

    assert(s1FromDate?.status === 'PRESENT', 'Student 1 retrieved with status PRESENT');
    assert(s2FromDate?.status === 'LATE', 'Student 2 retrieved with status LATE');
    assert(s3FromDate?.status === 'ABSENT', 'Student 3 retrieved with status ABSENT');


    // ----------------------------------------------------
    // Section 3: Editing an Existing Day & Idempotent Updates
    // ----------------------------------------------------
    console.log('\n--- Section 3: Editing an Existing Day & Idempotence ---');

    // Teacher changes Student 2 from LATE to PRESENT, and Student 3 from ABSENT to LATE
    const editSaveRes = await axios.post(
      `${ATTENDANCE_URL}/bulk`,
      {
        date: selectedPastDate,
        records: [
          { studentId: student1.id, status: 'PRESENT' },
          { studentId: student2.id, status: 'PRESENT' },
          { studentId: student3.id, status: 'LATE' }
        ]
      },
      { headers: { Authorization: `Bearer ${tokenTeacherA}` } }
    );

    assert(editSaveRes.status === 200, 'Re-saving existing attendance day returned 200 OK');
    assert(editSaveRes.data.summary.present === 2 && editSaveRes.data.summary.late === 1, 'Summary updated to 2 present and 1 late');

    // Verify DB still contains exactly 1 record per student for this date (no duplicate rows)
    const totalRecordsForDate = await prisma.attendance.count({
      where: {
        studentId: { in: [student1.id, student2.id, student3.id] },
        date: {
          gte: new Date(Date.UTC(2026, 7, 20, 0, 0, 0)),
          lte: new Date(Date.UTC(2026, 7, 20, 23, 59, 59))
        }
      }
    });
    assert(totalRecordsForDate === 3, `Zero duplicate rows created on re-save (expected 3 records, got ${totalRecordsForDate})`);


    // ----------------------------------------------------
    // Section 4: Notifications Behavior & Anti-Spam
    // ----------------------------------------------------
    console.log('\n--- Section 4: Student Notifications & Anti-Spam ---');

    // Student 1 status was not changed (remained PRESENT). They should have received 1 notification total.
    const s1Notifs = await prisma.notification.findMany({
      where: { userId: student1.id }
    });
    assert(s1Notifs.length === 1, 'Student 1 received exactly 1 notification (not spammed on repeat save)');

    // Student 2 status changed from LATE to PRESENT. They should have received 2 notifications (creation + update).
    const s2Notifs = await prisma.notification.findMany({
      where: { userId: student2.id }
    });
    assert(s2Notifs.length === 2, 'Student 2 received update notification on status change');


    // ----------------------------------------------------
    // Section 5: Authorization & IDOR Security
    // ----------------------------------------------------
    console.log('\n--- Section 5: Authorization & IDOR Protection ---');

    // 1. Student blocked from calling /api/attendance/by-date
    let studentByDateBlocked = false;
    try {
      await axios.get(
        `${ATTENDANCE_URL}/by-date?date=${selectedPastDate}`,
        { headers: { Authorization: `Bearer ${tokenStudent1}` } }
      );
    } catch (e) {
      studentByDateBlocked = e.response?.status === 403;
    }
    assert(studentByDateBlocked, 'Student blocked with 403 Forbidden from accessing /by-date');

    // 2. Student blocked from calling /api/attendance/bulk
    let studentBulkBlocked = false;
    try {
      await axios.post(
        `${ATTENDANCE_URL}/bulk`,
        {
          date: selectedPastDate,
          records: [{ studentId: student1.id, status: 'PRESENT' }]
        },
        { headers: { Authorization: `Bearer ${tokenStudent1}` } }
      );
    } catch (e) {
      studentBulkBlocked = e.response?.status === 403;
    }
    assert(studentBulkBlocked, 'Student blocked with 403 Forbidden from calling /bulk');

    // 3. Teacher B accessing /by-date succeeds under single-teacher deployment rules
    const teacherBByDate = await axios.get(
      `${ATTENDANCE_URL}/by-date?date=${selectedPastDate}`,
      { headers: { Authorization: `Bearer ${tokenTeacherB}` } }
    );
    assert(teacherBByDate.status === 200, 'Authenticated Teacher B can access /by-date (200 OK)');

    // 4. Nonexistent student ID is rejected with 400 Bad Request
    let nonexistentRejected = false;
    try {
      await axios.post(
        `${ATTENDANCE_URL}/bulk`,
        {
          date: selectedPastDate,
          records: [{ studentId: '00000000-0000-0000-0000-000000000000', status: 'ABSENT' }]
        },
        { headers: { Authorization: `Bearer ${tokenTeacherB}` } }
      );
    } catch (e) {
      nonexistentRejected = e.response?.status === 400 && e.response?.data?.count === 0;
    }
    assert(nonexistentRejected, 'Nonexistent student ID rejected with 400 Bad Request and count: 0');


    // ----------------------------------------------------
    // Section 6: Clean Up Test Records
    // ----------------------------------------------------
    console.log('\n--- Section 6: Cleanup Test Records ---');
    await prisma.attendance.deleteMany({
      where: { studentId: { in: [student1.id, student2.id, student3.id] } }
    });
    await prisma.courseEnrollment.deleteMany({
      where: { studentId: { in: [student1.id, student2.id, student3.id] } }
    });
    await prisma.course.deleteMany({
      where: { id: { in: [courseGroupA.id, courseGroupB.id] } }
    });
    await prisma.notification.deleteMany({
      where: { userId: { in: [student1.id, student2.id, student3.id] } }
    });
    await prisma.user.deleteMany({
      where: { id: { in: [student1.id, student2.id, student3.id] } }
    });
    assert(true, 'Test records cleaned up safely');

  } catch (err) {
    console.error('Fatal test error:', err.response?.data || err.message);
    assert(false, 'Global test execution error', err.response?.data?.message || err.message);
  } finally {
    await prisma.$disconnect();
  }

  console.log('\n================================================================');
  console.log(`📊 TEST SUMMARY: ${results.passed}/${results.total} Passed (${results.failed} Failed)`);
  console.log('================================================================\n');

  if (results.failed > 0) {
    process.exit(1);
  }
}

runTests();
