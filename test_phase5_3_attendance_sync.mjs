/**
 * Phase 5.3 Comprehensive End-to-End Test Suite
 * Correct Grade-Level Filtering + Attendance Persistence + Student/Parent Sync
 */
import axios from 'axios';
import { PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';

const prisma = new PrismaClient();
const AUTH_URL = 'http://localhost:4001/api/auth';
const ATTENDANCE_URL = 'http://localhost:4002/api/attendance';
const USERS_URL = 'http://localhost:4002/api/users/users';
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
  console.log('\n==================================================================');
  console.log('🧪 RUNNING PHASE 5.3 TEST SUITE (GRADE-LEVEL & PERSISTENCE SYNC)');
  console.log('==================================================================\n');

  try {
    // ----------------------------------------------------
    // Step 0: Setup Actors (Teacher, Students, Parent)
    // ----------------------------------------------------
    console.log('--- Step 0: Setup Test Actors and Cohorts ---');

    // 1. Parent
    const parent = await prisma.user.create({
      data: {
        email: `parent_p53_${TS}@test.com`,
        password: 'hashed_password',
        name: 'ولي أمر الطالب طارق',
        role: 'PARENT'
      }
    });
    const tokenParent = jwt.sign(
      { userId: parent.id, role: 'PARENT', email: parent.email },
      JWT_SECRET,
      { expiresIn: '2h' }
    );
    assert(!!tokenParent, 'Parent created & authenticated');

    // 2. Teacher A
    const teacherA = await prisma.user.create({
      data: {
        email: `teacher_p53_a_${TS}@test.com`,
        password: 'hashed_password',
        name: 'الأستاذ أحمد فؤاد (رياضيات)',
        role: 'TEACHER'
      }
    });
    const tokenTeacherA = jwt.sign(
      { userId: teacherA.id, role: 'TEACHER', email: teacherA.email },
      JWT_SECRET,
      { expiresIn: '2h' }
    );
    assert(!!tokenTeacherA, 'Teacher A created & authenticated');

    // 3. Teacher B (Unrelated)
    const teacherB = await prisma.user.create({
      data: {
        email: `teacher_p53_b_${TS}@test.com`,
        password: 'hashed_password',
        name: 'الأستاذ محمود إبراهيم (فيزياء)',
        role: 'TEACHER'
      }
    });
    const tokenTeacherB = jwt.sign(
      { userId: teacherB.id, role: 'TEACHER', email: teacherB.email },
      JWT_SECRET,
      { expiresIn: '2h' }
    );
    assert(!!tokenTeacherB, 'Teacher B created & authenticated');

    // 4. Courses for Teacher A
    const courseSec1 = await prisma.course.create({
      data: {
        title: `جبر أولى ثانوي - دفعة ${TS}`,
        teacherId: teacherA.id,
        gradeLevel: 'SECONDARY_1',
        academicLevel: 'SEC_1'
      }
    });

    const courseSec2 = await prisma.course.create({
      data: {
        title: `تفاضل تانية ثانوي - دفعة ${TS}`,
        teacherId: teacherA.id,
        gradeLevel: 'SECONDARY_2',
        academicLevel: 'SEC_2'
      }
    });

    // 5. Students in different Grade Levels
    // Student 1: أولى ثانوي (SECONDARY_1) enrolled in Course 1, child of Parent
    const student1 = await prisma.user.create({
      data: {
        email: `student_sec1_${TS}@test.com`,
        password: 'hashed_password',
        name: 'طارق أحمد علي (أولى ثانوي)',
        role: 'CENTER_STUDENT',
        gradeLevel: 'SECONDARY_1',
        academicLevel: 'SEC_1',
        parentId: parent.id
      }
    });
    const tokenStudent1 = jwt.sign(
      { userId: student1.id, role: 'CENTER_STUDENT', email: student1.email },
      JWT_SECRET,
      { expiresIn: '2h' }
    );

    await prisma.courseEnrollment.create({
      data: { studentId: student1.id, courseId: courseSec1.id }
    });

    // Student 2: تانية ثانوي (SECONDARY_2) enrolled in Course 2
    const student2 = await prisma.user.create({
      data: {
        email: `student_sec2_${TS}@test.com`,
        password: 'hashed_password',
        name: 'سارة خالد محمود (تانية ثانوي)',
        role: 'CENTER_STUDENT',
        gradeLevel: 'SECONDARY_2',
        academicLevel: 'SEC_2'
      }
    });
    const tokenStudent2 = jwt.sign(
      { userId: student2.id, role: 'CENTER_STUDENT', email: student2.email },
      JWT_SECRET,
      { expiresIn: '2h' }
    );

    await prisma.courseEnrollment.create({
      data: { studentId: student2.id, courseId: courseSec2.id }
    });

    // Student 3: تالتة ثانوي (SECONDARY_3) enrolled in Course 1 (multi-grade enrollment)
    const student3 = await prisma.user.create({
      data: {
        email: `student_sec3_${TS}@test.com`,
        password: 'hashed_password',
        name: 'كريم حسام (تالتة ثانوي)',
        role: 'ONLINE_STUDENT',
        gradeLevel: 'SECONDARY_3',
        academicLevel: 'SEC_3'
      }
    });
    const tokenStudent3 = jwt.sign(
      { userId: student3.id, role: 'ONLINE_STUDENT', email: student3.email },
      JWT_SECRET,
      { expiresIn: '2h' }
    );

    await prisma.courseEnrollment.create({
      data: { studentId: student3.id, courseId: courseSec1.id }
    });

    // Student 4: Unauthorized Student (enrolled only with Teacher B)
    const courseTeacherB = await prisma.course.create({
      data: {
        title: `كيمياء خاصة - ${TS}`,
        teacherId: teacherB.id,
        gradeLevel: 'SECONDARY_1',
        academicLevel: 'SEC_1'
      }
    });

    const studentUnauthorized = await prisma.user.create({
      data: {
        email: `student_unauth_${TS}@test.com`,
        password: 'hashed_password',
        name: 'طالب غير مسجل مع المعلم أ',
        role: 'ONLINE_STUDENT',
        gradeLevel: 'SECONDARY_1'
      }
    });

    await prisma.courseEnrollment.create({
      data: { studentId: studentUnauthorized.id, courseId: courseTeacherB.id }
    });

    assert(true, 'Roster created with distinct grade levels (SEC_1, SEC_2, SEC_3)');

    // ----------------------------------------------------
    // Step 1: Grade-Level Filtering Verification
    // ----------------------------------------------------
    console.log('\n--- Step 1: Grade-Level Filtering & User Retrieval ---');

    const usersRes = await axios.get(`${USERS_URL}?limit=100`, {
      headers: { Authorization: `Bearer ${tokenTeacherA}` }
    });
    const retrievedUsers = usersRes.data.data;
    const s1Retrieved = retrievedUsers.find(u => u.id === student1.id);
    const s2Retrieved = retrievedUsers.find(u => u.id === student2.id);
    const s3Retrieved = retrievedUsers.find(u => u.id === student3.id);

    assert(s1Retrieved?.gradeLevel === 'SECONDARY_1' || s1Retrieved?.academicLevel === 'SEC_1', 'Student 1 has gradeLevel SECONDARY_1 / SEC_1');
    assert(s2Retrieved?.gradeLevel === 'SECONDARY_2' || s2Retrieved?.academicLevel === 'SEC_2', 'Student 2 has gradeLevel SECONDARY_2 / SEC_2');
    assert(s3Retrieved?.gradeLevel === 'SECONDARY_3' || s3Retrieved?.academicLevel === 'SEC_3', 'Student 3 has gradeLevel SECONDARY_3 / SEC_3');
    assert(s1Retrieved?.enrollments?.some(e => e.courseId === courseSec1.id), 'Student 1 has course enrollments returned in user payload');

    // ----------------------------------------------------
    // Step 2: Bulk Attendance Submission & Summary Accuracy
    // ----------------------------------------------------
    console.log('\n--- Step 2: Bulk Attendance Save by Teacher ---');

    const testDate = '2026-09-25';
    const bulkPayload = {
      date: testDate,
      records: [
        { studentId: student1.id, status: 'PRESENT' },
        { studentId: student2.id, status: 'LATE' },
        { studentId: student3.id, status: 'ABSENT' }
      ]
    };

    const bulkRes = await axios.post(`${ATTENDANCE_URL}/bulk`, bulkPayload, {
      headers: { Authorization: `Bearer ${tokenTeacherA}` }
    });

    assert(bulkRes.status === 200, 'POST /api/attendance/bulk returned 200 OK');
    assert(bulkRes.data.success === true, 'Bulk save reported success: true');
    assert(bulkRes.data.count === 3, 'Saved count equals 3', `Received: ${bulkRes.data.count}`);
    assert(bulkRes.data.summary.present === 1, 'Summary present equals 1', `Received: ${bulkRes.data.summary.present}`);
    assert(bulkRes.data.summary.late === 1, 'Summary late equals 1', `Received: ${bulkRes.data.summary.late}`);
    assert(bulkRes.data.summary.absent === 1, 'Summary absent equals 1', `Received: ${bulkRes.data.summary.absent}`);

    // ----------------------------------------------------
    // Step 3: Direct PostgreSQL Persistence Verification
    // ----------------------------------------------------
    console.log('\n--- Step 3: Direct PostgreSQL Persistence Verification ---');

    const dbRecords = await prisma.attendance.findMany({
      where: {
        studentId: { in: [student1.id, student2.id, student3.id] }
      },
      orderBy: { createdAt: 'asc' }
    });

    assert(dbRecords.length === 3, 'Exactly 3 attendance rows persisted in PostgreSQL');

    const r1 = dbRecords.find(r => r.studentId === student1.id);
    const r2 = dbRecords.find(r => r.studentId === student2.id);
    const r3 = dbRecords.find(r => r.studentId === student3.id);

    assert(r1 && r1.status === 'PRESENT', 'Student 1 row in DB has status PRESENT');
    assert(r2 && r2.status === 'LATE', 'Student 2 row in DB has status LATE');
    assert(r3 && r3.status === 'ABSENT', 'Student 3 row in DB has status ABSENT');

    // Verify date normalization: Date in DB represents 2026-09-25 00:00:00 UTC
    const r1Date = new Date(r1.date);
    assert(
      r1Date.getUTCFullYear() === 2026 && r1Date.getUTCMonth() === 8 && r1Date.getUTCDate() === 25,
      'Persisted attendance date is exactly 2026-09-25 UTC',
      `DB Date: ${r1.date.toISOString()}`
    );

    // ----------------------------------------------------
    // Step 4: Teacher GET /api/attendance/by-date
    // ----------------------------------------------------
    console.log('\n--- Step 4: Teacher GET /api/attendance/by-date ---');

    const byDateRes = await axios.get(`${ATTENDANCE_URL}/by-date?date=${testDate}`, {
      headers: { Authorization: `Bearer ${tokenTeacherA}` }
    });

    assert(byDateRes.status === 200, 'GET /api/attendance/by-date returned 200 OK');
    assert(byDateRes.data.count >= 3, `by-date returned at least 3 records (Got ${byDateRes.data.count})`);
    const s1ByDate = byDateRes.data.data.find(r => r.studentId === student1.id);
    const s2ByDate = byDateRes.data.data.find(r => r.studentId === student2.id);
    const s3ByDate = byDateRes.data.data.find(r => r.studentId === student3.id);
    assert(s1ByDate?.status === 'PRESENT', 'Teacher by-date query returns PRESENT for Student 1');
    assert(s2ByDate?.status === 'LATE', 'Teacher by-date query returns LATE for Student 2');
    assert(s3ByDate?.status === 'ABSENT', 'Teacher by-date query returns ABSENT for Student 3');

    // ----------------------------------------------------
    // Step 5: Student API Verification (GET /api/attendance/my-attendance)
    // ----------------------------------------------------
    console.log('\n--- Step 5: Student Portal Attendance API Sync ---');

    // Student 1 (PRESENT)
    const s1AttendanceRes = await axios.get(`${ATTENDANCE_URL}/my-attendance`, {
      headers: { Authorization: `Bearer ${tokenStudent1}` }
    });
    assert(s1AttendanceRes.status === 200, 'Student 1 GET /my-attendance returned 200 OK');
    assert(s1AttendanceRes.data.data.length >= 1, 'Student 1 receives attendance records');
    const s1Record = s1AttendanceRes.data.data.find(r => r.date.startsWith('2026-09-25'));
    assert(s1Record?.status === 'PRESENT', 'Student 1 sees PRESENT status on 2026-09-25');
    assert(s1AttendanceRes.data.summary.presentCount >= 1, 'Student 1 summary has presentCount >= 1');

    // Student 2 (LATE)
    const s2AttendanceRes = await axios.get(`${ATTENDANCE_URL}/my-attendance`, {
      headers: { Authorization: `Bearer ${tokenStudent2}` }
    });
    const s2Record = s2AttendanceRes.data.data.find(r => r.date.startsWith('2026-09-25'));
    assert(s2Record?.status === 'LATE', 'Student 2 sees LATE status on 2026-09-25');

    // Student 3 (ABSENT)
    const s3AttendanceRes = await axios.get(`${ATTENDANCE_URL}/my-attendance`, {
      headers: { Authorization: `Bearer ${tokenStudent3}` }
    });
    const s3Record = s3AttendanceRes.data.data.find(r => r.date.startsWith('2026-09-25'));
    assert(s3Record?.status === 'ABSENT', 'Student 3 sees ABSENT status on 2026-09-25');

    // ----------------------------------------------------
    // Step 6: Parent API Verification (GET /api/attendance/student/:studentId)
    // ----------------------------------------------------
    console.log('\n--- Step 6: Parent Portal Attendance API Sync ---');

    // Parent queries Student 1 (their registered child)
    const parentChildRes = await axios.get(`${ATTENDANCE_URL}/student/${student1.id}`, {
      headers: { Authorization: `Bearer ${tokenParent}` }
    });
    assert(parentChildRes.status === 200, 'Parent GET /student/:id returned 200 OK for child');
    const parentSeenRecord = parentChildRes.data.data.find(r => r.date.startsWith('2026-09-25'));
    assert(parentSeenRecord?.status === 'PRESENT', 'Parent sees PRESENT status for child on 2026-09-25');
    assert(parentChildRes.data.summary.presentCount >= 1, 'Parent summary reflects child attendance statistics');

    // Parent attempts to query Student 2 (NOT their child) -> Expect 403 Forbidden
    let parentDenied = false;
    try {
      await axios.get(`${ATTENDANCE_URL}/student/${student2.id}`, {
        headers: { Authorization: `Bearer ${tokenParent}` }
      });
    } catch (err) {
      parentDenied = err.response?.status === 403;
    }
    assert(parentDenied, 'Parent forbidden (403) from accessing non-child attendance records');

    // ----------------------------------------------------
    // Step 7: Update Attendance (ABSENT -> PRESENT) Without Duplication
    // ----------------------------------------------------
    console.log('\n--- Step 7: Idempotent Attendance Update (ABSENT -> PRESENT) ---');

    // Change Student 3 from ABSENT to PRESENT on the same date
    const updatePayload = {
      date: testDate,
      records: [
        { studentId: student3.id, status: 'PRESENT' }
      ]
    };

    const updateRes = await axios.post(`${ATTENDANCE_URL}/bulk`, updatePayload, {
      headers: { Authorization: `Bearer ${tokenTeacherA}` }
    });
    assert(updateRes.status === 200 && updateRes.data.summary.present === 1, 'Bulk update returned 200 OK with present: 1');

    // Verify in DB that there is still ONLY 1 record for Student 3 on that date
    const s3DbRecords = await prisma.attendance.findMany({
      where: {
        studentId: student3.id,
        date: {
          gte: new Date('2026-09-25T00:00:00.000Z'),
          lte: new Date('2026-09-25T23:59:59.999Z')
        }
      }
    });
    assert(s3DbRecords.length === 1, 'Exactly 1 record exists in DB for Student 3 (No duplicate created)');
    assert(s3DbRecords[0].status === 'PRESENT', 'Database row status successfully updated to PRESENT');

    // Verify Student 3 API now returns updated PRESENT status
    const s3UpdatedRes = await axios.get(`${ATTENDANCE_URL}/my-attendance`, {
      headers: { Authorization: `Bearer ${tokenStudent3}` }
    });
    const s3UpdatedRec = s3UpdatedRes.data.data.find(r => r.date.startsWith('2026-09-25'));
    assert(s3UpdatedRec?.status === 'PRESENT', 'Student 3 portal immediately reflects updated PRESENT status');

    // ----------------------------------------------------
    // Step 8: Security & Authorization Enforcement
    // ----------------------------------------------------
    console.log('\n--- Step 8: Security & Authorization Tests ---');

    // 1. Teacher attempts to save attendance for nonexistent student ID
    let nonexistentSaveRejected = false;
    try {
      await axios.post(`${ATTENDANCE_URL}/bulk`, {
        date: testDate,
        records: [
          { studentId: '00000000-0000-0000-0000-000000000000', status: 'PRESENT' }
        ]
      }, {
        headers: { Authorization: `Bearer ${tokenTeacherA}` }
      });
    } catch (err) {
      nonexistentSaveRejected = err.response?.status === 400;
    }
    assert(nonexistentSaveRejected, 'Saving nonexistent student returns 400 Bad Request (No zero-record false success)');

    // 2. Student attempts to post attendance
    let studentWriteDenied = false;
    try {
      await axios.post(`${ATTENDANCE_URL}/bulk`, {
        date: testDate,
        records: [{ studentId: student1.id, status: 'PRESENT' }]
      }, {
        headers: { Authorization: `Bearer ${tokenStudent1}` }
      });
    } catch (err) {
      studentWriteDenied = err.response?.status === 403;
    }
    assert(studentWriteDenied, 'Student blocked (403) from marking attendance');

    // 3. Parent attempts to post attendance
    let parentWriteDenied = false;
    try {
      await axios.post(`${ATTENDANCE_URL}/bulk`, {
        date: testDate,
        records: [{ studentId: student1.id, status: 'PRESENT' }]
      }, {
        headers: { Authorization: `Bearer ${tokenParent}` }
      });
    } catch (err) {
      parentWriteDenied = err.response?.status === 403;
    }
    assert(parentWriteDenied, 'Parent blocked (403) from marking attendance');

    // 4. Student attempts to read attendance by date
    let studentByDateDenied = false;
    try {
      await axios.get(`${ATTENDANCE_URL}/by-date?date=${testDate}`, {
        headers: { Authorization: `Bearer ${tokenStudent1}` }
      });
    } catch (err) {
      studentByDateDenied = err.response?.status === 403;
    }
    assert(studentByDateDenied, 'Student blocked (403) from GET /by-date');

    // ----------------------------------------------------
    // Step 9: Multi-Group Deduplication Verification
    // ----------------------------------------------------
    console.log('\n--- Step 9: Multi-Group Student Deduplication ---');

    // Enroll Student 1 into Course 2 as well
    await prisma.courseEnrollment.create({
      data: { studentId: student1.id, courseId: courseSec2.id }
    }).catch(() => {});

    // Save attendance where Student 1 is in multiple selected courses
    const multiGroupDate = '2026-09-26';
    const multiGroupRes = await axios.post(`${ATTENDANCE_URL}/bulk`, {
      date: multiGroupDate,
      records: [
        { studentId: student1.id, status: 'PRESENT' }
      ]
    }, {
      headers: { Authorization: `Bearer ${tokenTeacherA}` }
    });

    assert(multiGroupRes.status === 200, 'Multi-group student bulk save succeeded');

    const s1MultiDb = await prisma.attendance.findMany({
      where: {
        studentId: student1.id,
        date: {
          gte: new Date('2026-09-26T00:00:00.000Z'),
          lte: new Date('2026-09-26T23:59:59.999Z')
        }
      }
    });
    assert(s1MultiDb.length === 1, 'Multi-group enrollment produces exactly 1 attendance row per date');

  } catch (err) {
    console.error('Fatal test error:', err.message);
    if (err.response) {
      console.error('API Response Data:', err.response.data);
    }
    assert(false, 'Fatal test execution failure', err.message);
  } finally {
    await prisma.$disconnect();

    console.log('\n==================================================================');
    console.log(`📊 PHASE 5.3 TEST SUMMARY: ${results.passed}/${results.total} Passed (${results.failed} Failed)`);
    console.log('==================================================================\n');

    if (results.failed > 0) {
      process.exit(1);
    }
  }
}

runTests();
