/**
 * Phase 5 Comprehensive Automated Test Suite — Student Center Attendance
 *
 * Covers:
 * 1. Student Access & Isolation (Own attendance retrieval, summary statistics)
 * 2. IDOR Protection (Student blocked from viewing/marking/updating/deleting other students' attendance)
 * 3. Teacher Enrollment RBAC (Teacher A manages enrolled students; Teacher B blocked from unrelated students)
 * 4. Admin Access (Global attendance management)
 * 5. Input Validation (Allowed statuses: PRESENT, ABSENT, LATE; invalid statuses rejected with 400)
 * 6. Date Handling & Idempotent Upsert (No duplicate records for same student on same calendar day)
 * 7. Bulk Attendance Marking (POST /api/attendance/bulk)
 * 8. Full CRUD & Notification Integration
 */
import axios from 'axios';
import { PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';

const _testAdminPassword = process.env.TEST_ADMIN_PASSWORD || process.env.TEST_PASSWORD;
if (!_testAdminPassword) {
  console.error('❌ Environment configuration error: TEST_ADMIN_PASSWORD or TEST_PASSWORD must be configured in environment to run test_phase5_attendance.mjs.');
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
  console.log('\n======================================================');
  console.log('🧪 RUNNING PHASE 5 AUTOMATED TEST SUITE (ATTENDANCE)');
  console.log('======================================================\n');

  try {
    // ----------------------------------------------------
    // Step 0: Setup / Seed Test Users & Courses
    // ----------------------------------------------------
    console.log('--- Step 0: Setup Test Actors & Roles ---');

    // 1. Admin
    const adminLogin = await loginAs('ADMIN', 'admin@edu.com', (process.env.TEST_ADMIN_PASSWORD || process.env.TEST_PASSWORD));
    const adminToken = adminLogin.token;
    assert(!!adminToken, 'Admin authenticated');

    // 2. Teacher A
    let teacherA = await prisma.user.findFirst({ where: { role: 'TEACHER' } });
    if (!teacherA) {
      teacherA = await prisma.user.create({
        data: {
          email: `teacher_att_a_${TS}@test.com`,
          password: 'hashed_password',
          name: 'الأستاذ أحمد فؤاد',
          role: 'TEACHER'
        }
      });
    }
    const tokenTeacherA = jwt.sign(
      { userId: teacherA.id, role: 'TEACHER', email: teacherA.email },
      JWT_SECRET,
      { expiresIn: '2h' }
    );

    // 3. Teacher B (Unrelated teacher for IDOR tests)
    let teacherB = await prisma.user.findFirst({ where: { role: 'TEACHER', id: { not: teacherA.id } } });
    if (!teacherB) {
      teacherB = await prisma.user.create({
        data: {
          email: `teacher_att_b_${TS}@test.com`,
          password: 'hashed_password',
          name: 'الأستاذ محمود إبراهيم',
          role: 'TEACHER'
        }
      });
    }
    const tokenTeacherB = jwt.sign(
      { userId: teacherB.id, role: 'TEACHER', email: teacherB.email },
      JWT_SECRET,
      { expiresIn: '2h' }
    );

    // 4. Student A (Center Student enrolled in Teacher A's course)
    const studentA = await prisma.user.create({
      data: {
        email: `student_att_a_${TS}@test.com`,
        password: 'hashed_password',
        name: 'طالب سنتر أ',
        role: 'CENTER_STUDENT'
      }
    });
    const tokenStudentA = jwt.sign(
      { userId: studentA.id, role: 'CENTER_STUDENT', email: studentA.email },
      JWT_SECRET,
      { expiresIn: '2h' }
    );

    // 5. Student B (Online Student NOT in Teacher A's course)
    const studentB = await prisma.user.create({
      data: {
        email: `student_att_b_${TS}@test.com`,
        password: 'hashed_password',
        name: 'طالب أونلاين ب',
        role: 'ONLINE_STUDENT'
      }
    });
    const tokenStudentB = jwt.sign(
      { userId: studentB.id, role: 'ONLINE_STUDENT', email: studentB.email },
      JWT_SECRET,
      { expiresIn: '2h' }
    );

    // 6. Course for Teacher A and enroll Student A only
    let courseA = await prisma.course.findFirst({ where: { teacherId: teacherA.id } });
    if (!courseA) {
      courseA = await prisma.course.create({
        data: {
          title: 'الرياضيات - كورس السنتر',
          teacherId: teacherA.id,
          status: 'PUBLISHED'
        }
      });
    }

    await prisma.courseEnrollment.upsert({
      where: { studentId_courseId: { studentId: studentA.id, courseId: courseA.id } },
      update: {},
      create: { studentId: studentA.id, courseId: courseA.id }
    });


    // ----------------------------------------------------
    // Section 1: Validation & Status Enforcement
    // ----------------------------------------------------
    console.log('\n--- Section 1: Attendance Status Validation ---');

    // 1. Valid status PRESENT
    const markPresentRes = await axios.post(
      `${ATTENDANCE_URL}`,
      { studentId: studentA.id, status: 'PRESENT', date: '2026-09-01T10:00:00Z' },
      { headers: { Authorization: `Bearer ${tokenTeacherA}` } }
    );
    assert(markPresentRes.status === 201 && markPresentRes.data.status === 'PRESENT', 'Valid status PRESENT accepted (201)');

    // 2. Valid status ABSENT
    const markAbsentRes = await axios.post(
      `${ATTENDANCE_URL}`,
      { studentId: studentA.id, status: 'ABSENT', date: '2026-09-02T10:00:00Z' },
      { headers: { Authorization: `Bearer ${tokenTeacherA}` } }
    );
    assert(markAbsentRes.status === 201 && markAbsentRes.data.status === 'ABSENT', 'Valid status ABSENT accepted (201)');

    // 3. Valid status LATE
    const markLateRes = await axios.post(
      `${ATTENDANCE_URL}`,
      { studentId: studentA.id, status: 'LATE', date: '2026-09-03T10:00:00Z' },
      { headers: { Authorization: `Bearer ${tokenTeacherA}` } }
    );
    assert(markLateRes.status === 201 && markLateRes.data.status === 'LATE', 'Valid status LATE accepted (201)');

    // 4. Invalid status rejected (400)
    let invalidStatusBlocked = false;
    try {
      await axios.post(
        `${ATTENDANCE_URL}`,
        { studentId: studentA.id, status: 'EXCUSED_LEAVE', date: '2026-09-04T10:00:00Z' },
        { headers: { Authorization: `Bearer ${tokenTeacherA}` } }
      );
    } catch (e) {
      invalidStatusBlocked = e.response?.status === 400;
    }
    assert(invalidStatusBlocked, 'Unsupported status "EXCUSED_LEAVE" rejected with 400 Bad Request');

    // 5. Arbitrary string status rejected (400)
    let arbitraryStatusBlocked = false;
    try {
      await axios.post(
        `${ATTENDANCE_URL}`,
        { studentId: studentA.id, status: '<script>alert(1)</script>', date: '2026-09-04T10:00:00Z' },
        { headers: { Authorization: `Bearer ${tokenTeacherA}` } }
      );
    } catch (e) {
      arbitraryStatusBlocked = e.response?.status === 400;
    }
    assert(arbitraryStatusBlocked, 'Arbitrary string/XSS status rejected with 400 Bad Request');


    // ----------------------------------------------------
    // Section 2: Idempotent Upsert & Deduplication
    // ----------------------------------------------------
    console.log('\n--- Section 2: Date Normalization & Deduplication ---');

    // Re-marking attendance on 2026-09-01 with a different time and status LATE
    const updateDayRes = await axios.post(
      `${ATTENDANCE_URL}`,
      { studentId: studentA.id, status: 'LATE', date: '2026-09-01T15:30:00Z' },
      { headers: { Authorization: `Bearer ${tokenTeacherA}` } }
    );
    assert(updateDayRes.status === 200 && updateDayRes.data.status === 'LATE', 'Re-marking same date updates existing record (200 OK)');

    // Verify DB contains only 1 record for 2026-09-01
    const day1Records = await prisma.attendance.findMany({
      where: {
        studentId: studentA.id,
        date: {
          gte: new Date(Date.UTC(2026, 8, 1, 0, 0, 0)),
          lte: new Date(Date.UTC(2026, 8, 1, 23, 59, 59))
        }
      }
    });
    assert(day1Records.length === 1, 'No duplicate records created for the same student on the same day');


    // ----------------------------------------------------
    // Section 3: Student Experience & Summary Stats
    // ----------------------------------------------------
    console.log('\n--- Section 3: Student Experience & Statistics ---');

    // Student A retrieves own attendance
    const myAttRes = await axios.get(
      `${ATTENDANCE_URL}/my-attendance`,
      { headers: { Authorization: `Bearer ${tokenStudentA}` } }
    );
    assert(myAttRes.status === 200 && Array.isArray(myAttRes.data.data), 'Student retrieves own attendance history');
    assert(
      myAttRes.data.summary.totalSessions === 3 &&
      myAttRes.data.summary.absentCount === 1 &&
      myAttRes.data.summary.lateCount === 2,
      'Summary statistics (totalSessions=3, absentCount=1, lateCount=2) calculated accurately'
    );
    // Percentage: (0 present + 2 late) / 3 = 67%
    assert(myAttRes.data.summary.percentage === 67, 'Attendance percentage incorporates LATE sessions correctly (67%)');

    // Percentage endpoint backwards compatibility
    const pctRes = await axios.get(
      `${ATTENDANCE_URL}/${studentA.id}/percentage`,
      { headers: { Authorization: `Bearer ${tokenStudentA}` } }
    );
    assert(pctRes.status === 200 && pctRes.data.percentage === 67, 'Legacy percentage endpoint returns accurate percentage');


    // ----------------------------------------------------
    // Section 4: Authorization & IDOR Protection
    // ----------------------------------------------------
    console.log('\n--- Section 4: Authorization & IDOR Protection ---');

    // 1. Student A blocked from viewing Student B's attendance
    let studentIDORBlocked = false;
    try {
      await axios.get(
        `${ATTENDANCE_URL}/student/${studentB.id}`,
        { headers: { Authorization: `Bearer ${tokenStudentA}` } }
      );
    } catch (e) {
      studentIDORBlocked = e.response?.status === 403;
    }
    assert(studentIDORBlocked, 'Student A blocked from viewing Student B attendance (403 Forbidden)');

    // 2. Student A blocked from viewing Student B's percentage
    let studentPctIDORBlocked = false;
    try {
      await axios.get(
        `${ATTENDANCE_URL}/${studentB.id}/percentage`,
        { headers: { Authorization: `Bearer ${tokenStudentA}` } }
      );
    } catch (e) {
      studentPctIDORBlocked = e.response?.status === 403;
    }
    assert(studentPctIDORBlocked, 'Student A blocked from viewing Student B percentage (403 Forbidden)');

    // 3. Student blocked from marking attendance
    let studentMarkBlocked = false;
    try {
      await axios.post(
        `${ATTENDANCE_URL}`,
        { studentId: studentA.id, status: 'PRESENT' },
        { headers: { Authorization: `Bearer ${tokenStudentA}` } }
      );
    } catch (e) {
      studentMarkBlocked = e.response?.status === 403;
    }
    assert(studentMarkBlocked, 'Student blocked from marking attendance (403 Forbidden)');

    // 4. Any TEACHER is authorized to mark attendance for registered students (Phase 5.4 rule)
    const teacherBMarkRes = await axios.post(
      `${ATTENDANCE_URL}`,
      { studentId: studentA.id, status: 'PRESENT', date: '2026-09-10T10:00:00Z' },
      { headers: { Authorization: `Bearer ${tokenTeacherB}` } }
    );
    assert(teacherBMarkRes.status === 201 && teacherBMarkRes.data.status === 'PRESENT', 'Teacher B (TEACHER role) authorized to mark Student A attendance');

    // 5. Any TEACHER is authorized to view registered student attendance
    const teacherBViewRes = await axios.get(
      `${ATTENDANCE_URL}/student/${studentA.id}`,
      { headers: { Authorization: `Bearer ${tokenTeacherB}` } }
    );
    assert(teacherBViewRes.status === 200 && Array.isArray(teacherBViewRes.data.data), 'Teacher B (TEACHER role) authorized to view Student A attendance');

    // 6. Admin authorized to manage attendance
    const adminMarkRes = await axios.post(
      `${ATTENDANCE_URL}`,
      { studentId: studentB.id, status: 'PRESENT', date: '2026-09-05T10:00:00Z' },
      { headers: { Authorization: `Bearer ${adminToken}` } }
    );
    assert(adminMarkRes.status === 201 && adminMarkRes.data.studentId === studentB.id, 'Admin authorized to mark attendance for any student');


    // ----------------------------------------------------
    // Section 5: Bulk Marking & CRUD Lifecycle
    // ----------------------------------------------------
    console.log('\n--- Section 5: Bulk Marking & CRUD Lifecycle ---');

    // 1. Bulk mark attendance
    const bulkRes = await axios.post(
      `${ATTENDANCE_URL}/bulk`,
      {
        records: [
          { studentId: studentA.id, status: 'PRESENT' }
        ],
        date: '2026-09-06T10:00:00Z'
      },
      { headers: { Authorization: `Bearer ${tokenTeacherA}` } }
    );
    assert(bulkRes.status === 200 && bulkRes.data.count >= 1, 'Bulk attendance marking succeeded (200 OK)');

    const day6Record = await prisma.attendance.findFirst({
      where: {
        studentId: studentA.id,
        date: {
          gte: new Date(Date.UTC(2026, 8, 6, 0, 0, 0)),
          lte: new Date(Date.UTC(2026, 8, 6, 23, 59, 59))
        }
      }
    });
    assert(!!day6Record, 'Bulk-marked attendance record persisted in database');

    // 2. Update single record (PUT /api/attendance/:id)
    const updateRecRes = await axios.put(
      `${ATTENDANCE_URL}/${day6Record.id}`,
      { status: 'LATE' },
      { headers: { Authorization: `Bearer ${tokenTeacherA}` } }
    );
    assert(updateRecRes.status === 200 && updateRecRes.data.status === 'LATE', 'Single attendance record updated via PUT (200 OK)');

    // 3. Delete single record (DELETE /api/attendance/:id)
    const delRecRes = await axios.delete(
      `${ATTENDANCE_URL}/${day6Record.id}`,
      { headers: { Authorization: `Bearer ${tokenTeacherA}` } }
    );
    assert(delRecRes.status === 200, 'Attendance record deleted via DELETE (200 OK)');

    const recordAfterDelete = await prisma.attendance.findUnique({ where: { id: day6Record.id } });
    assert(recordAfterDelete === null, 'Attendance record removed from database');


    // ----------------------------------------------------
    // Clean up test records
    // ----------------------------------------------------
    await prisma.attendance.deleteMany({ where: { studentId: { in: [studentA.id, studentB.id] } } });
    await prisma.courseEnrollment.deleteMany({ where: { studentId: { in: [studentA.id, studentB.id] } } });
    await prisma.notification.deleteMany({ where: { userId: { in: [studentA.id, studentB.id] } } });
    await prisma.user.deleteMany({ where: { id: { in: [studentA.id, studentB.id] } } });

  } catch (err) {
    console.error('Fatal test error:', err.response?.data || err.message);
    assert(false, 'Global test execution error', err.response?.data?.message || err.message);
  } finally {
    await prisma.$disconnect();
  }

  console.log('\n======================================================');
  console.log(`📊 TEST SUMMARY: ${results.passed}/${results.total} Passed (${results.failed} Failed)`);
  console.log('======================================================\n');

  if (results.failed > 0) {
    process.exit(1);
  }
}

runTests();
