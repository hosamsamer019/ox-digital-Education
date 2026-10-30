/**
 * Phase 5.4 Comprehensive Test Suite
 * Simplified Teacher Attendance Authorization for Current Single-Teacher Deployment
 */
import axios from 'axios';
import { PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';

const prisma = new PrismaClient();
const AUTH_URL = 'http://localhost:4001/api/auth';
const ATTENDANCE_URL = 'http://localhost:4002/api/attendance';
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
  console.log('🧪 RUNNING PHASE 5.4 TEST SUITE (SIMPLIFIED TEACHER AUTHORIZATION)');
  console.log('==================================================================\n');

  try {
    // ----------------------------------------------------
    // Step 0: Setup Actors (Teacher, Admin, Students, Parent)
    // ----------------------------------------------------
    console.log('--- Step 0: Setup Test Actors ---');

    // 1. Admin
    const admin = await prisma.user.create({
      data: {
        email: `admin_p54_${TS}@test.com`,
        password: 'hashed_password',
        name: 'مدير النظام',
        role: 'ADMIN'
      }
    });
    const tokenAdmin = jwt.sign(
      { userId: admin.id, role: 'ADMIN', email: admin.email },
      JWT_SECRET,
      { expiresIn: '2h' }
    );
    assert(!!tokenAdmin, 'Admin created & authenticated');

    // 2. Teacher (Single teacher deployment)
    const teacher = await prisma.user.create({
      data: {
        email: `teacher_p54_${TS}@test.com`,
        password: 'hashed_password',
        name: 'أستاذ الرياضيات العام',
        role: 'TEACHER'
      }
    });
    const tokenTeacher = jwt.sign(
      { userId: teacher.id, role: 'TEACHER', email: teacher.email },
      JWT_SECRET,
      { expiresIn: '2h' }
    );
    assert(!!tokenTeacher, 'Teacher created & authenticated');

    // 3. Parent
    const parent = await prisma.user.create({
      data: {
        email: `parent_p54_${TS}@test.com`,
        password: 'hashed_password',
        name: 'ولي أمر الطالب محمد',
        role: 'PARENT'
      }
    });
    const tokenParent = jwt.sign(
      { userId: parent.id, role: 'PARENT', email: parent.email },
      JWT_SECRET,
      { expiresIn: '2h' }
    );

    // 4. Student 1: Center Student (child of Parent) - No explicit course enrollment required
    const student1 = await prisma.user.create({
      data: {
        email: `student1_p54_${TS}@test.com`,
        password: 'hashed_password',
        name: 'محمد حسام (أولى ثانوي سنتر)',
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

    // 5. Student 2: Online Student (unenrolled in any specific course table)
    const student2 = await prisma.user.create({
      data: {
        email: `student2_p54_${TS}@test.com`,
        password: 'hashed_password',
        name: 'ريم طارق (تانية ثانوي أونلاين)',
        role: 'ONLINE_STUDENT',
        gradeLevel: 'SECONDARY_2',
        academicLevel: 'SEC_2'
      }
    });
    const tokenStudent2 = jwt.sign(
      { userId: student2.id, role: 'ONLINE_STUDENT', email: student2.email },
      JWT_SECRET,
      { expiresIn: '2h' }
    );

    // 6. Student 3: Center Student
    const student3 = await prisma.user.create({
      data: {
        email: `student3_p54_${TS}@test.com`,
        password: 'hashed_password',
        name: 'علي محمود (تالتة ثانوي سنتر)',
        role: 'CENTER_STUDENT',
        gradeLevel: 'SECONDARY_3',
        academicLevel: 'SEC_3'
      }
    });
    const tokenStudent3 = jwt.sign(
      { userId: student3.id, role: 'CENTER_STUDENT', email: student3.email },
      JWT_SECRET,
      { expiresIn: '2h' }
    );

    assert(true, 'Test actors created successfully');

    // ----------------------------------------------------
    // Section 1: Teacher Can Mark Attendance For Any Student (Single-Teacher Deployment)
    // ----------------------------------------------------
    console.log('\n--- Section 1: Teacher Allowed to Record Attendance for Any Registered Student ---');

    const testDate = '2026-08-20';
    const bulkSaveRes = await axios.post(
      `${ATTENDANCE_URL}/bulk`,
      {
        date: testDate,
        records: [
          { studentId: student1.id, status: 'PRESENT' },
          { studentId: student2.id, status: 'LATE' },
          { studentId: student3.id, status: 'ABSENT' }
        ]
      },
      { headers: { Authorization: `Bearer ${tokenTeacher}` } }
    );

    assert(bulkSaveRes.status === 200, 'POST /api/attendance/bulk returned 200 OK for Teacher');
    assert(bulkSaveRes.data.success === true, 'Bulk save reported success: true');
    assert(bulkSaveRes.data.count === 3, 'Saved count equals 3 (all students recorded)', `Got: ${bulkSaveRes.data.count}`);
    assert(bulkSaveRes.data.summary.present === 1, 'Summary present equals 1');
    assert(bulkSaveRes.data.summary.late === 1, 'Summary late equals 1');
    assert(bulkSaveRes.data.summary.absent === 1, 'Summary absent equals 1');

    // Verify DB records
    const dbRecords = await prisma.attendance.findMany({
      where: { studentId: { in: [student1.id, student2.id, student3.id] } },
      orderBy: { createdAt: 'asc' }
    });
    assert(dbRecords.length === 3, 'Exactly 3 attendance rows persisted in PostgreSQL');
    assert(dbRecords.find(r => r.studentId === student1.id)?.status === 'PRESENT', 'Student 1 persisted as PRESENT');
    assert(dbRecords.find(r => r.studentId === student2.id)?.status === 'LATE', 'Student 2 persisted as LATE');
    assert(dbRecords.find(r => r.studentId === student3.id)?.status === 'ABSENT', 'Student 3 persisted as ABSENT');

    // ----------------------------------------------------
    // Section 2: Admin Can Also Mark Attendance
    // ----------------------------------------------------
    console.log('\n--- Section 2: Admin Allowed to Record Attendance ---');

    const adminSaveRes = await axios.post(
      `${ATTENDANCE_URL}/bulk`,
      {
        date: '2026-08-21',
        records: [
          { studentId: student1.id, status: 'PRESENT' },
          { studentId: student2.id, status: 'PRESENT' }
        ]
      },
      { headers: { Authorization: `Bearer ${tokenAdmin}` } }
    );
    assert(adminSaveRes.status === 200 && adminSaveRes.data.count === 2, 'Admin successfully recorded attendance (200 OK)');

    // ----------------------------------------------------
    // Section 3: Forbidden Roles Blocked from Writing Attendance
    // ----------------------------------------------------
    console.log('\n--- Section 3: Students & Parents Forbidden (403) from Writing Attendance ---');

    // 1. Student attempting bulk write
    let studentBulkForbidden = false;
    try {
      await axios.post(
        `${ATTENDANCE_URL}/bulk`,
        {
          date: testDate,
          records: [{ studentId: student1.id, status: 'PRESENT' }]
        },
        { headers: { Authorization: `Bearer ${tokenStudent1}` } }
      );
    } catch (err) {
      studentBulkForbidden = err.response?.status === 403;
    }
    assert(studentBulkForbidden, 'Student blocked with 403 Forbidden from POST /api/attendance/bulk');

    // 2. Student attempting single write
    let studentSingleForbidden = false;
    try {
      await axios.post(
        `${ATTENDANCE_URL}`,
        { studentId: student1.id, status: 'PRESENT', date: testDate },
        { headers: { Authorization: `Bearer ${tokenStudent1}` } }
      );
    } catch (err) {
      studentSingleForbidden = err.response?.status === 403;
    }
    assert(studentSingleForbidden, 'Student blocked with 403 Forbidden from POST /api/attendance');

    // 3. Parent attempting bulk write
    let parentBulkForbidden = false;
    try {
      await axios.post(
        `${ATTENDANCE_URL}/bulk`,
        {
          date: testDate,
          records: [{ studentId: student1.id, status: 'PRESENT' }]
        },
        { headers: { Authorization: `Bearer ${tokenParent}` } }
      );
    } catch (err) {
      parentBulkForbidden = err.response?.status === 403;
    }
    assert(parentBulkForbidden, 'Parent blocked with 403 Forbidden from POST /api/attendance/bulk');

    // 4. Parent attempting single write
    let parentSingleForbidden = false;
    try {
      await axios.post(
        `${ATTENDANCE_URL}`,
        { studentId: student1.id, status: 'PRESENT', date: testDate },
        { headers: { Authorization: `Bearer ${tokenParent}` } }
      );
    } catch (err) {
      parentSingleForbidden = err.response?.status === 403;
    }
    assert(parentSingleForbidden, 'Parent blocked with 403 Forbidden from POST /api/attendance');

    // 5. Unauthenticated write
    let unauthForbidden = false;
    try {
      await axios.post(`${ATTENDANCE_URL}/bulk`, {
        date: testDate,
        records: [{ studentId: student1.id, status: 'PRESENT' }]
      });
    } catch (err) {
      unauthForbidden = err.response?.status === 401;
    }
    assert(unauthForbidden, 'Unauthenticated request blocked with 401 Unauthorized');

    // ----------------------------------------------------
    // Section 4: Student Isolation & Parent View Authorization
    // ----------------------------------------------------
    console.log('\n--- Section 4: Student Isolation & Parent View Authorization ---');

    // 1. Student 1 queries own attendance
    const s1AttendanceRes = await axios.get(`${ATTENDANCE_URL}/my-attendance`, {
      headers: { Authorization: `Bearer ${tokenStudent1}` }
    });
    assert(s1AttendanceRes.status === 200, 'Student 1 can access own attendance via /my-attendance');
    assert(s1AttendanceRes.data.data.some(r => r.date.startsWith('2026-08-20') && r.status === 'PRESENT'), 'Student 1 sees PRESENT on 2026-08-20');

    // 2. Student 1 attempting to query Student 2 attendance
    let s1QueryS2Forbidden = false;
    try {
      await axios.get(`${ATTENDANCE_URL}/student/${student2.id}`, {
        headers: { Authorization: `Bearer ${tokenStudent1}` }
      });
    } catch (err) {
      s1QueryS2Forbidden = err.response?.status === 403;
    }
    assert(s1QueryS2Forbidden, 'Student 1 forbidden (403) from querying Student 2 attendance by ID');

    // 3. Parent queries child (Student 1)
    const parentQueryChild = await axios.get(`${ATTENDANCE_URL}/student/${student1.id}`, {
      headers: { Authorization: `Bearer ${tokenParent}` }
    });
    assert(parentQueryChild.status === 200, 'Parent allowed to view registered child attendance');
    assert(parentQueryChild.data.data.some(r => r.status === 'PRESENT'), 'Parent sees child PRESENT status');

    // 4. Parent queries unrelated student (Student 2)
    let parentQueryUnrelatedForbidden = false;
    try {
      await axios.get(`${ATTENDANCE_URL}/student/${student2.id}`, {
        headers: { Authorization: `Bearer ${tokenParent}` }
      });
    } catch (err) {
      parentQueryUnrelatedForbidden = err.response?.status === 403;
    }
    assert(parentQueryUnrelatedForbidden, 'Parent forbidden (403) from querying non-child student attendance');

    // ----------------------------------------------------
    // Section 5: Date Normalization & Authoritative Date Semantics
    // ----------------------------------------------------
    console.log('\n--- Section 5: Authoritative Date Semantics ---');

    const s1Row = await prisma.attendance.findFirst({
      where: { studentId: student1.id, date: { gte: new Date('2026-08-20T00:00:00.000Z'), lte: new Date('2026-08-20T23:59:59.999Z') } }
    });
    const s1RowDate = new Date(s1Row.date);
    assert(
      s1RowDate.getUTCFullYear() === 2026 && s1RowDate.getUTCMonth() === 7 && s1RowDate.getUTCDate() === 20,
      'Attendance date represents exactly 2026-08-20 UTC session date',
      `DB Date: ${s1Row.date.toISOString()}`
    );

    // ----------------------------------------------------
    // Section 6: Idempotent Updates & Deduplication
    // ----------------------------------------------------
    console.log('\n--- Section 6: Idempotent Updates & Duplicate Payload Protection ---');

    // 1. Update Student 3 from ABSENT to PRESENT on 2026-08-20
    const updateRes = await axios.post(
      `${ATTENDANCE_URL}/bulk`,
      {
        date: testDate,
        records: [
          { studentId: student3.id, status: 'PRESENT' }
        ]
      },
      { headers: { Authorization: `Bearer ${tokenTeacher}` } }
    );
    assert(updateRes.status === 200 && updateRes.data.summary.present === 1, 'Status updated from ABSENT to PRESENT (200 OK)');

    const s3Rows = await prisma.attendance.findMany({
      where: {
        studentId: student3.id,
        date: { gte: new Date('2026-08-20T00:00:00.000Z'), lte: new Date('2026-08-20T23:59:59.999Z') }
      }
    });
    assert(s3Rows.length === 1, 'Zero duplicate rows created on update (Exactly 1 row in DB)');
    assert(s3Rows[0].status === 'PRESENT', 'Database row status is now PRESENT');

    // 2. Duplicate student IDs in single request payload
    const duplicatePayloadRes = await axios.post(
      `${ATTENDANCE_URL}/bulk`,
      {
        date: '2026-08-25',
        records: [
          { studentId: student1.id, status: 'PRESENT' },
          { studentId: student1.id, status: 'LATE' }
        ]
      },
      { headers: { Authorization: `Bearer ${tokenTeacher}` } }
    );
    assert(duplicatePayloadRes.status === 200 && duplicatePayloadRes.data.count === 1, 'Duplicate student IDs in single payload deduplicated (count: 1)');

    // 3. Nonexistent student IDs
    let nonexistentRejected = false;
    try {
      await axios.post(
        `${ATTENDANCE_URL}/bulk`,
        {
          date: '2026-08-25',
          records: [
            { studentId: '00000000-0000-0000-0000-000000000000', status: 'PRESENT' }
          ]
        },
        { headers: { Authorization: `Bearer ${tokenTeacher}` } }
      );
    } catch (err) {
      nonexistentRejected = err.response?.status === 400 && err.response?.data?.count === 0;
    }
    assert(nonexistentRejected, 'Nonexistent student IDs properly rejected with 400 Bad Request and count: 0');

  } catch (err) {
    console.error('Fatal test error:', err.message);
    if (err.response) {
      console.error('API Response Data:', err.response.data);
    }
    assert(false, 'Fatal test execution failure', err.message);
  } finally {
    await prisma.$disconnect();

    console.log('\n==================================================================');
    console.log(`📊 PHASE 5.4 TEST SUMMARY: ${results.passed}/${results.total} Passed (${results.failed} Failed)`);
    console.log('==================================================================\n');

    if (results.failed > 0) {
      process.exit(1);
    }
  }
}

runTests();
