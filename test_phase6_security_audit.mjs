import axios from 'axios';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const prisma = new PrismaClient();

const AUTH_URL = 'http://localhost:4001/api/auth';
const USER_URL = 'http://localhost:4002/api/users';
const ATTENDANCE_URL = 'http://localhost:4002/api/attendance';
const NOTIF_URL = 'http://localhost:4002/api/notifications';
const COURSE_URL = 'http://localhost:4004/api/courses';
const ASSESSMENT_URL = 'http://localhost:4004/api/assessments';
const EXAM_URL = 'http://localhost:4004/api/exams';
const HOMEWORK_URL = 'http://localhost:4004/api/homeworks';
const QUESTION_URL = 'http://localhost:4004/api/questions';
const ANALYTICS_URL = 'http://localhost:4005/api/analytics';
const AI_URL = 'http://localhost:4003/api/ai';

const JWT_SECRET = process.env.JWT_SECRET || 'dev_secret_key_123';

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function assert(condition, message) {
  totalTests++;
  if (condition) {
    console.log(`  ✓ PASS: ${message}`);
    passedTests++;
  } else {
    console.error(`  ✗ FAIL: ${message}`);
    failedTests++;
  }
}

async function runSecurityAudit() {
  console.log('==================================================================');
  console.log('🧪 RUNNING PHASE 6 COMPREHENSIVE SECURITY AUDIT TEST SUITE');
  console.log('==================================================================\n');

  try {
    // ----------------------------------------------------
    // Step 0: Setup Actors & Test Context
    // ----------------------------------------------------
    console.log('--- Step 0: Setup Actors & Test Context ---');
    const timestamp = Date.now();
    const passwordHash = await bcrypt.hash('Password123!', 10);

    // 1. Admin
    const adminUser = await prisma.user.upsert({
      where: { email: `sec_admin_${timestamp}@example.com` },
      update: {},
      create: {
        name: 'Sec Admin',
        email: `sec_admin_${timestamp}@example.com`,
        password: passwordHash,
        role: 'ADMIN'
      }
    });
    const adminToken = jwt.sign({ userId: adminUser.id, role: 'ADMIN', email: adminUser.email }, JWT_SECRET);

    // 2. Teacher A
    const teacherA = await prisma.user.create({
      data: {
        name: 'Sec Teacher A',
        email: `sec_teachera_${timestamp}@example.com`,
        password: passwordHash,
        role: 'TEACHER'
      }
    });
    const tokenTeacherA = jwt.sign({ userId: teacherA.id, role: 'TEACHER', email: teacherA.email }, JWT_SECRET);

    // 3. Teacher B
    const teacherB = await prisma.user.create({
      data: {
        name: 'Sec Teacher B',
        email: `sec_teacherb_${timestamp}@example.com`,
        password: passwordHash,
        role: 'TEACHER'
      }
    });
    const tokenTeacherB = jwt.sign({ userId: teacherB.id, role: 'TEACHER', email: teacherB.email }, JWT_SECRET);

    // 4. Parent A
    const parentA = await prisma.user.create({
      data: {
        name: 'Sec Parent A',
        email: `sec_parenta_${timestamp}@example.com`,
        password: passwordHash,
        role: 'PARENT'
      }
    });
    const tokenParentA = jwt.sign({ userId: parentA.id, role: 'PARENT', email: parentA.email }, JWT_SECRET);

    // 5. Parent B
    const parentB = await prisma.user.create({
      data: {
        name: 'Sec Parent B',
        email: `sec_parentb_${timestamp}@example.com`,
        password: passwordHash,
        role: 'PARENT'
      }
    });
    const tokenParentB = jwt.sign({ userId: parentB.id, role: 'PARENT', email: parentB.email }, JWT_SECRET);

    // 6. Student A (Child of Parent A)
    const studentA = await prisma.user.create({
      data: {
        name: 'Sec Student A',
        email: `sec_studenta_${timestamp}@example.com`,
        password: passwordHash,
        role: 'ONLINE_STUDENT',
        country: 'EG',
        educationLevel: 'SECONDARY',
        gradeLevel: 'SECONDARY_1',
        academicLevel: 'SEC_1',
        parentId: parentA.id
      }
    });
    const tokenStudentA = jwt.sign({ userId: studentA.id, role: 'ONLINE_STUDENT', email: studentA.email }, JWT_SECRET);

    // 7. Student B (Child of Parent B)
    const studentB = await prisma.user.create({
      data: {
        name: 'Sec Student B',
        email: `sec_studentb_${timestamp}@example.com`,
        password: passwordHash,
        role: 'ONLINE_STUDENT',
        country: 'EG',
        educationLevel: 'SECONDARY',
        gradeLevel: 'SECONDARY_1',
        academicLevel: 'SEC_1',
        parentId: parentB.id
      }
    });
    const tokenStudentB = jwt.sign({ userId: studentB.id, role: 'ONLINE_STUDENT', email: studentB.email }, JWT_SECRET);

    // 8. Create Course owned by Teacher A and enroll Student A
    const courseA = await prisma.course.create({
      data: {
        title: `Sec Math Course ${timestamp}`,
        teacherId: teacherA.id,
        price: 0,
        status: 'PUBLISHED',
        country: 'EG',
        educationLevel: 'SECONDARY',
        gradeLevel: 'SECONDARY_1',
        academicLevel: 'SEC_1'
      }
    });

    await prisma.courseEnrollment.create({
      data: { studentId: studentA.id, courseId: courseA.id }
    });

    // 9. Assessment owned by Teacher A
    const assessmentA = await prisma.assessment.create({
      data: {
        title: `Sec Exam ${timestamp}`,
        type: 'EXAM',
        courseId: courseA.id,
        teacherId: teacherA.id,
        durationMinutes: 30,
        status: 'PUBLISHED',
        questions: [
          {
            id: 'q1',
            text: 'What is 5 + 7?',
            options: ['10', '11', '12', '13'],
            correctAnswer: 2,
            correct: 2,
            points: 10,
            solutionExplanation: '5 + 7 = 12',
            generationLogic: 'basic_addition',
            validationStatus: 'VALID'
          }
        ]
      }
    });

    console.log('  ✓ PASS: Actors and test course/assessment prepared\n');


    // ----------------------------------------------------
    // Section 1: Authentication & Token Security
    // ----------------------------------------------------
    console.log('--- Section 1: Authentication & Token Security ---');

    // 1. Unauthenticated request to /api/users
    let unauthUsersBlocked = false;
    try {
      await axios.get(`${USER_URL}/users`);
    } catch (e) {
      unauthUsersBlocked = e.response?.status === 401;
    }
    assert(unauthUsersBlocked, 'Unauthenticated request to /api/users blocked with 401');

    // 2. Unauthenticated request to /api/attendance/by-date
    let unauthAttBlocked = false;
    try {
      await axios.get(`${ATTENDANCE_URL}/by-date?date=2026-09-25`);
    } catch (e) {
      unauthAttBlocked = e.response?.status === 401;
    }
    assert(unauthAttBlocked, 'Unauthenticated request to /api/attendance blocked with 401');

    // 3. Forged JWT token with invalid signature
    let invalidSigBlocked = false;
    try {
      await axios.get(`${USER_URL}/profile`, {
        headers: { Authorization: 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.invalid.signature' }
      });
    } catch (e) {
      invalidSigBlocked = e.response?.status === 403;
    }
    assert(invalidSigBlocked, 'Forged JWT with invalid signature rejected with 403');

    // 4. External Student token blocked from general APIs
    const externalStudentToken = jwt.sign({
      role: 'EXTERNAL_STUDENT',
      isExternalStudent: true,
      assessmentId: assessmentA.id,
      externalSessionId: 'session_123'
    }, JWT_SECRET);

    let extTokenBlocked = false;
    try {
      await axios.get(`${USER_URL}/profile`, {
        headers: { Authorization: `Bearer ${externalStudentToken}` }
      });
    } catch (e) {
      extTokenBlocked = e.response?.status === 403;
    }
    assert(extTokenBlocked, 'External student token blocked from user service profile (403 Forbidden)');


    // ----------------------------------------------------
    // Section 2: RBAC & Privilege Escalation Protection
    // ----------------------------------------------------
    console.log('\n--- Section 2: RBAC & Privilege Escalation Protection ---');

    // 1. Student blocked from creating user
    let studentCreateUserBlocked = false;
    try {
      await axios.post(
        `${USER_URL}/users`,
        { name: 'Fake Teacher', email: `fake_${timestamp}@test.com`, password: 'password123', role: 'TEACHER' },
        { headers: { Authorization: `Bearer ${tokenStudentA}` } }
      );
    } catch (e) {
      studentCreateUserBlocked = e.response?.status === 403;
    }
    assert(studentCreateUserBlocked, 'Student blocked from creating users (403 Forbidden)');

    // 2. Student blocked from creating assessment
    let studentCreateAssessmentBlocked = false;
    try {
      await axios.post(
        `${ASSESSMENT_URL}`,
        { title: 'Fake Assessment', type: 'EXAM', courseId: courseA.id },
        { headers: { Authorization: `Bearer ${tokenStudentA}` } }
      );
    } catch (e) {
      studentCreateAssessmentBlocked = e.response?.status === 403;
    }
    assert(studentCreateAssessmentBlocked, 'Student blocked from creating assessments (403 Forbidden)');

    // 3. Student blocked from uploading question assets
    let studentUploadAssetBlocked = false;
    try {
      await axios.post(
        `${ASSESSMENT_URL}/assets/upload`,
        { imageBase64: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==' },
        { headers: { Authorization: `Bearer ${tokenStudentA}` } }
      );
    } catch (e) {
      studentUploadAssetBlocked = e.response?.status === 403;
    }
    assert(studentUploadAssetBlocked, 'Student blocked from uploading question assets (403 Forbidden)');

    // 4. Teacher blocked from deleting users
    let teacherDeleteUserBlocked = false;
    try {
      await axios.delete(
        `${USER_URL}/users/${studentA.id}`,
        { headers: { Authorization: `Bearer ${tokenTeacherA}` } }
      );
    } catch (e) {
      teacherDeleteUserBlocked = e.response?.status === 403;
    }
    assert(teacherDeleteUserBlocked, 'Teacher blocked from deleting users (403 Forbidden)');

    // 5. Parent blocked from creating courses or modifying attendance
    let parentCourseBlocked = false;
    try {
      await axios.post(
        `${COURSE_URL}`,
        { title: 'Parent Course' },
        { headers: { Authorization: `Bearer ${tokenParentA}` } }
      );
    } catch (e) {
      parentCourseBlocked = e.response?.status === 403;
    }
    assert(parentCourseBlocked, 'Parent blocked from creating courses (403 Forbidden)');


    // ----------------------------------------------------
    // Section 3: IDOR & Cross-Entity Isolation
    // ----------------------------------------------------
    console.log('\n--- Section 3: IDOR & Cross-Entity Isolation ---');

    // 1. Notification IDOR: Create notification for Student B, Student A tries to mark it as read
    const notifB = await prisma.notification.create({
      data: {
        userId: studentB.id,
        title: 'Secret Notification for B',
        message: 'Student B private alert',
        type: 'info'
      }
    });

    let notifIDORBlocked = false;
    try {
      await axios.put(
        `${NOTIF_URL}/${notifB.id}/read`,
        {},
        { headers: { Authorization: `Bearer ${tokenStudentA}` } }
      );
    } catch (e) {
      notifIDORBlocked = e.response?.status === 403;
    }
    assert(notifIDORBlocked, 'Student A blocked with 403 from marking Student B notification as read');

    // 2. Notification List Isolation: Student A only sees their own notifications
    const studentANotifs = await axios.get(
      `${NOTIF_URL}`,
      { headers: { Authorization: `Bearer ${tokenStudentA}` } }
    );
    const hasStudentBNotif = studentANotifs.data.some(n => n.id === notifB.id);
    assert(!hasStudentBNotif, 'Student A notification list excludes Student B notifications');

    // 3. Analytics Report IDOR: Student A cannot view Student B report
    let studentReportIDORBlocked = false;
    try {
      await axios.get(
        `${ANALYTICS_URL}/report/${studentB.id}`,
        { headers: { Authorization: `Bearer ${tokenStudentA}` } }
      );
    } catch (e) {
      studentReportIDORBlocked = e.response?.status === 403;
    }
    assert(studentReportIDORBlocked, 'Student A blocked with 403 from viewing Student B analytics report');

    // 4. Parent IDOR: Parent A cannot access Parent B child overview
    let parentChildIDORBlocked = false;
    try {
      await axios.get(
        `${ANALYTICS_URL}/parent/child/${studentB.id}/overview`,
        { headers: { Authorization: `Bearer ${tokenParentA}` } }
      );
    } catch (e) {
      parentChildIDORBlocked = e.response?.status === 404 || e.response?.status === 403;
    }
    assert(parentChildIDORBlocked, 'Parent A blocked from viewing Parent B child overview (404/403)');

    // 5. Parent Child Attendance IDOR: Parent A cannot view Student B attendance
    let parentAttIDORBlocked = false;
    try {
      await axios.get(
        `${ATTENDANCE_URL}/student/${studentB.id}`,
        { headers: { Authorization: `Bearer ${tokenParentA}` } }
      );
    } catch (e) {
      parentAttIDORBlocked = e.response?.status === 403;
    }
    assert(parentAttIDORBlocked, 'Parent A blocked with 403 from viewing Student B attendance');

    // 6. Authorized Parent CAN view own child attendance
    const parentOwnChildAtt = await axios.get(
      `${ATTENDANCE_URL}/student/${studentA.id}`,
      { headers: { Authorization: `Bearer ${tokenParentA}` } }
    );
    assert(parentOwnChildAtt.status === 200, 'Parent A authorized to view own child (Student A) attendance (200 OK)');


    // ----------------------------------------------------
    // Section 4: Assessment & Exam Security
    // ----------------------------------------------------
    console.log('\n--- Section 4: Assessment & Exam Security ---');

    // 1. Question Serialization: Student does not see correct answers before submitting
    const assessmentForStudent = await axios.get(
      `${ASSESSMENT_URL}/${assessmentA.id}`,
      { headers: { Authorization: `Bearer ${tokenStudentA}` } }
    );
    const q0 = assessmentForStudent.data.questions?.[0];
    const leakedCorrect = q0?.correct !== undefined || q0?.correctAnswer !== undefined || q0?.solutionExplanation !== undefined;
    assert(!leakedCorrect, 'Assessment questions sanitize and hide correct answers & explanations from students');

    // 2. Start Attempt
    const startRes = await axios.post(
      `${ASSESSMENT_URL}/${assessmentA.id}/start`,
      {},
      { headers: { Authorization: `Bearer ${tokenStudentA}` } }
    );
    const attemptId = startRes.data.attempt.id;
    assert(startRes.status === 200 && attemptId, 'Student A started assessment attempt successfully');

    // 3. Score Spoofing Ignored: Student submits wrong answer (index 0) with a fake client score
    const submitRes = await axios.post(
      `${ASSESSMENT_URL}/${assessmentA.id}/attempt/submit`,
      {
        answers: [{ questionId: 'q1', selectedOption: 0 }],
        score: 100 // Tampered client score
      },
      { headers: { Authorization: `Bearer ${tokenStudentA}` } }
    );
    assert(submitRes.status === 200 && submitRes.data.score === 0, 'Server authoritative grading computes score=0 (tampered client score ignored)');

    // 4. Duplicate Submission Idempotence
    const duplicateSubmitRes = await axios.post(
      `${ASSESSMENT_URL}/${assessmentA.id}/attempt/submit`,
      {
        answers: [{ questionId: 'q1', selectedOption: 2 }] // Attempting to resubmit correct answer
      },
      { headers: { Authorization: `Bearer ${tokenStudentA}` } }
    );
    assert(duplicateSubmitRes.data.score === 0, 'Duplicate submission safely returns original finalized score (0), preventing resubmission tampering');

    // 5. Cross-Student Attempt Review Blocked: Student B cannot review Student A attempt
    let studentReviewIDORBlocked = false;
    try {
      await axios.get(
        `${ASSESSMENT_URL}/${assessmentA.id}/attempts/${attemptId}/review`,
        { headers: { Authorization: `Bearer ${tokenStudentB}` } }
      );
    } catch (e) {
      studentReviewIDORBlocked = e.response?.status === 403;
    }
    assert(studentReviewIDORBlocked, 'Student B blocked with 403 from reviewing Student A attempt');

    // 6. Authorized Review: Student A can review own finalized attempt
    const ownReviewRes = await axios.get(
      `${ASSESSMENT_URL}/${assessmentA.id}/attempts/${attemptId}/review`,
      { headers: { Authorization: `Bearer ${tokenStudentA}` } }
    );
    assert(ownReviewRes.status === 200 && ownReviewRes.data.attempt.id === attemptId, 'Student A authorized to review own finalized attempt');


    // ----------------------------------------------------
    // Section 5: Attendance Authorization (Phase 5.4 Rules)
    // ----------------------------------------------------
    console.log('\n--- Section 5: Attendance Authorization (Phase 5.4 Rules) ---');

    // 1. Teacher marks attendance for Student A & B (Role-based authorization)
    const teacherBulkAttRes = await axios.post(
      `${ATTENDANCE_URL}/bulk`,
      {
        records: [
          { studentId: studentA.id, status: 'PRESENT' },
          { studentId: studentB.id, status: 'LATE' }
        ],
        date: '2026-09-25T10:00:00Z'
      },
      { headers: { Authorization: `Bearer ${tokenTeacherA}` } }
    );
    assert(teacherBulkAttRes.status === 200 && teacherBulkAttRes.data.count === 2, 'Teacher authorized to record attendance for registered students');

    // 2. Student blocked from marking attendance
    let studentMarkAttBlocked = false;
    try {
      await axios.post(
        `${ATTENDANCE_URL}`,
        { studentId: studentA.id, status: 'PRESENT', date: '2026-09-25T10:00:00Z' },
        { headers: { Authorization: `Bearer ${tokenStudentA}` } }
      );
    } catch (e) {
      studentMarkAttBlocked = e.response?.status === 403;
    }
    assert(studentMarkAttBlocked, 'Student blocked with 403 from writing attendance');

    // 3. Parent blocked from marking attendance
    let parentMarkAttBlocked = false;
    try {
      await axios.post(
        `${ATTENDANCE_URL}/bulk`,
        { records: [{ studentId: studentA.id, status: 'PRESENT' }], date: '2026-09-25T10:00:00Z' },
        { headers: { Authorization: `Bearer ${tokenParentA}` } }
      );
    } catch (e) {
      parentMarkAttBlocked = e.response?.status === 403;
    }
    assert(parentMarkAttBlocked, 'Parent blocked with 403 from writing attendance');


    // ----------------------------------------------------
    // Section 6: Upload & Disguised Payload Security
    // ----------------------------------------------------
    console.log('\n--- Section 6: Upload & Disguised Payload Security ---');

    // 1. Executable disguised as PNG
    const mzExecutableBuffer = Buffer.from([0x4D, 0x5A, 0x90, 0x00, 0x03, 0x00, 0x00, 0x00]);
    let executableBlocked = false;
    try {
      await axios.post(
        `${ASSESSMENT_URL}/assets/upload`,
        {
          imageBase64: `data:image/png;base64,${mzExecutableBuffer.toString('base64')}`,
          filename: 'malware.png',
          mimeType: 'image/png'
        },
        { headers: { Authorization: `Bearer ${tokenTeacherA}` } }
      );
    } catch (e) {
      executableBlocked = e.response?.status === 400;
    }
    assert(executableBlocked, 'Disguised executable (MZ header) rejected with 400 Bad Request');

    // 2. Script / Webshell disguised as image
    const scriptBuffer = Buffer.from('<?php system($_GET["cmd"]); ?>');
    let scriptBlocked = false;
    try {
      await axios.post(
        `${ASSESSMENT_URL}/assets/upload`,
        {
          imageBase64: `data:image/png;base64,${scriptBuffer.toString('base64')}`,
          filename: 'shell.png',
          mimeType: 'image/png'
        },
        { headers: { Authorization: `Bearer ${tokenTeacherA}` } }
      );
    } catch (e) {
      scriptBlocked = e.response?.status === 400;
    }
    assert(scriptBlocked, 'Disguised PHP script rejected with 400 Bad Request');

    // 3. HTML / XSS disguised as image
    const htmlBuffer = Buffer.from('<script>alert("xss")</script>');
    let htmlBlocked = false;
    try {
      await axios.post(
        `${ASSESSMENT_URL}/assets/upload`,
        {
          imageBase64: `data:image/png;base64,${htmlBuffer.toString('base64')}`,
          filename: 'xss.png',
          mimeType: 'image/png'
        },
        { headers: { Authorization: `Bearer ${tokenTeacherA}` } }
      );
    } catch (e) {
      htmlBlocked = e.response?.status === 400;
    }
    assert(htmlBlocked, 'Disguised HTML/script payload rejected with 400 Bad Request');

    // 4. Valid PNG upload works for Teacher
    const validPngBuffer = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44, 0x52]);
    const validUploadRes = await axios.post(
      `${ASSESSMENT_URL}/assets/upload`,
      {
        imageBase64: `data:image/png;base64,${validPngBuffer.toString('base64')}`,
        filename: 'diagram.png',
        mimeType: 'image/png',
        assessmentId: assessmentA.id
      },
      { headers: { Authorization: `Bearer ${tokenTeacherA}` } }
    );
    const assetId = validUploadRes.data.assetId;
    assert(validUploadRes.status === 201 && assetId, 'Valid PNG upload accepted (201 Created)');

    // 5. Cross-Teacher Asset Deletion Blocked: Teacher B cannot delete Teacher A asset
    let crossTeacherAssetDelBlocked = false;
    try {
      await axios.delete(
        `${ASSESSMENT_URL}/assets/${assetId}`,
        { headers: { Authorization: `Bearer ${tokenTeacherB}` } }
      );
    } catch (e) {
      crossTeacherAssetDelBlocked = e.response?.status === 403;
    }
    assert(crossTeacherAssetDelBlocked, 'Teacher B blocked with 403 from deleting Teacher A assessment asset');


    // ----------------------------------------------------
    // Section 7: Mass Assignment & Profile Tampering
    // ----------------------------------------------------
    console.log('\n--- Section 7: Mass Assignment & Profile Tampering ---');

    // 1. Student cannot escalate role to ADMIN
    await axios.put(
      `${USER_URL}/users/${studentA.id}`,
      { name: 'Updated Student A', role: 'ADMIN' },
      { headers: { Authorization: `Bearer ${tokenStudentA}` } }
    );

    const refreshedStudent = await prisma.user.findUnique({ where: { id: studentA.id } });
    assert(refreshedStudent.role === 'ONLINE_STUDENT', 'Mass assignment protection: Student role remains ONLINE_STUDENT despite submitting role=ADMIN');

    // 2. Student cannot tamper with educational grade profile
    let gradeTamperBlocked = false;
    try {
      await axios.put(
        `${USER_URL}/users/${studentA.id}`,
        { gradeLevel: 'THIRD_GRADE', educationLevel: 'SECONDARY' },
        { headers: { Authorization: `Bearer ${tokenStudentA}` } }
      );
    } catch (e) {
      gradeTamperBlocked = e.response?.status === 403;
    }
    assert(gradeTamperBlocked, 'Non-admin student blocked with 403 when attempting to tamper with academic profile');


    // ----------------------------------------------------
    // Section 8: Question Bank Authorization
    // ----------------------------------------------------
    console.log('\n--- Section 8: Question Bank Authorization ---');

    // 1. Student blocked from creating question in bank
    let studentQuestionBlocked = false;
    try {
      await axios.post(
        `${QUESTION_URL}`,
        { text: 'Fake question', options: ['A', 'B'], correctAnswer: 0 },
        { headers: { Authorization: `Bearer ${tokenStudentA}` } }
      );
    } catch (e) {
      studentQuestionBlocked = e.response?.status === 403;
    }
    assert(studentQuestionBlocked, 'Student blocked with 403 from creating question in question bank');

    // 2. Teacher A creates question in bank
    const createQRes = await axios.post(
      `${QUESTION_URL}`,
      { text: 'Sample Question', options: ['A', 'B'], correctAnswer: 0 },
      { headers: { Authorization: `Bearer ${tokenTeacherA}` } }
    );
    const qId = createQRes.data.id;
    assert(createQRes.status === 201 && qId, 'Teacher A authorized to create question in bank (201 Created)');

    // 3. Teacher B blocked from modifying Teacher A question
    let teacherBEditQBlocked = false;
    try {
      await axios.put(
        `${QUESTION_URL}/${qId}`,
        { text: 'Tampered Question', options: ['A', 'B'], correctAnswer: 1 },
        { headers: { Authorization: `Bearer ${tokenTeacherB}` } }
      );
    } catch (e) {
      teacherBEditQBlocked = e.response?.status === 403;
    }
    assert(teacherBEditQBlocked, 'Teacher B blocked with 403 from modifying Teacher A question in bank');

    // 4. Admin authorized to view/modify questions
    const adminUpdateQRes = await axios.put(
      `${QUESTION_URL}/${qId}`,
      { text: 'Admin Verified Question', options: ['A', 'B'], correctAnswer: 0 },
      { headers: { Authorization: `Bearer ${adminToken}` } }
    );
    assert(adminUpdateQRes.status === 200, 'Admin authorized to update question in bank (200 OK)');


    // ----------------------------------------------------
    // Cleanup
    // ----------------------------------------------------
    console.log('\n--- Section 9: Cleanup ---');
    try {
      await prisma.assessmentAttempt.deleteMany({ where: { assessmentId: assessmentA.id } });
      await prisma.temporaryAsset?.deleteMany({ where: { assessmentId: assessmentA.id } });
      await prisma.assessment.delete({ where: { id: assessmentA.id } });
      await prisma.courseEnrollment.deleteMany({ where: { courseId: courseA.id } });
      await prisma.course.delete({ where: { id: courseA.id } });
      await prisma.questionBank.deleteMany({ where: { id: qId } });
      await prisma.notification.deleteMany({ where: { userId: { in: [studentA.id, studentB.id] } } });
      await prisma.attendance.deleteMany({ where: { studentId: { in: [studentA.id, studentB.id] } } });
      await prisma.user.deleteMany({
        where: {
          id: {
            in: [studentA.id, studentB.id, parentA.id, parentB.id, teacherA.id, teacherB.id, adminUser.id]
          }
        }
      });
      console.log('  ✓ PASS: Cleaned up test entities safely');
    } catch (err) {
      console.log('  Notice: Cleanup encountered non-fatal error:', err.message);
    }

  } catch (err) {
    console.error('Fatal test error:', err);
  }

  console.log('\n==================================================================');
  console.log(`📊 PHASE 6 SECURITY AUDIT SUMMARY: ${passedTests}/${totalTests} Passed (${failedTests} Failed)`);
  console.log('==================================================================');

  await prisma.$disconnect();
  if (failedTests > 0) process.exit(1);
}

runSecurityAudit();
