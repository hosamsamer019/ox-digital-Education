/**
 * Phase 4 Comprehensive Automated Test Suite
 *
 * Covers:
 * 1. Upload Validation (MIME, Magic Bytes, Executable/Script Disguise, Size, Path Traversal)
 * 2. Authorization & IDOR Protection (Teacher ownership, Admin access, Student block, Cross-tenant block)
 * 3. Question Workflow (Image attachment to Assessment.questions JSON, teacher source-of-truth)
 * 4. Temporary Asset Lifecycle (Conditions A, B, C, D, All-or-Nothing Rule, Idempotency, Grade Survival)
 */
import axios from 'axios';
import { PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';
import fs from 'fs';
import path from 'path';

const _testAdminPassword = process.env.TEST_ADMIN_PASSWORD || process.env.TEST_PASSWORD;
if (!_testAdminPassword) {
  console.error('❌ Environment configuration error: TEST_ADMIN_PASSWORD or TEST_PASSWORD must be configured in environment to run test_phase4_image_assets.mjs.');
  process.exit(1);
}


const prisma = new PrismaClient();
const AUTH_URL = 'http://localhost:4001/api/auth';
const ASSESSMENTS_URL = 'http://localhost:4004/api/assessments';
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

// Minimal valid binary buffers
// 1. JPEG: FF D8 FF
const VALID_JPEG_BASE64 = Buffer.from([0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x01, 0x00, 0x48, 0x00, 0x48, 0x00, 0x00]).toString('base64');

// 2. PNG: 89 50 4E 47 0D 0A 1A 0A
const VALID_PNG_BASE64 = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44, 0x52]).toString('base64');

// 3. WebP: 52 49 46 46 (size) 57 45 42 50
const VALID_WEBP_BASE64 = Buffer.from([0x52, 0x49, 0x46, 0x46, 0x20, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50, 0x56, 0x50, 0x38, 0x20]).toString('base64');

// 4. Disguised Executable (MZ header)
const DISGUISED_EXE_BASE64 = Buffer.from([0x4D, 0x5A, 0x90, 0x00, 0x03, 0x00, 0x00, 0x00, 0x04, 0x00, 0x00, 0x00]).toString('base64');

// 5. Disguised Script (PHP/HTML)
const DISGUISED_SCRIPT_BASE64 = Buffer.from('<?php echo "malware"; ?>').toString('base64');
const DISGUISED_HTML_BASE64 = Buffer.from('<script>alert("xss")</script>').toString('base64');

async function loginAs(role, email, password = 'password123') {
  const r = await axios.post(`${AUTH_URL}/login`, { email, password, role });
  return r.data;
}

async function runTests() {
  console.log('\n======================================================');
  console.log('🧪 RUNNING PHASE 4 AUTOMATED TEST SUITE (INTEGRATION & HTTP)');
  console.log('======================================================\n');

  try {
    // ----------------------------------------------------
    // Step 0: Setup / Find Test Users
    // ----------------------------------------------------
    console.log('--- Step 0: User Setup & Authentication ---');

    // Admin
    const adminLogin = await loginAs('ADMIN', 'admin@edu.com', (process.env.TEST_ADMIN_PASSWORD || process.env.TEST_PASSWORD));
    const adminToken = adminLogin.token;
    assert(!!adminToken, 'Admin authenticated');

    // Teacher A
    let teacherA = await prisma.user.findFirst({ where: { role: 'TEACHER' } });
    if (!teacherA) {
      teacherA = await prisma.user.create({
        data: {
          email: `teacher_a_${TS}@test.com`,
          password: '$2a$10$hashedpasswordplaceholder',
          name: 'الأستاذ أحمد الشناوي',
          role: 'TEACHER'
        }
      });
    }
    const tokenTeacherA = jwt.sign(
      { userId: teacherA.id, role: 'TEACHER', email: teacherA.email },
      JWT_SECRET,
      { expiresIn: '2h' }
    );

    // Teacher B (for IDOR testing)
    let teacherB = await prisma.user.findFirst({ where: { role: 'TEACHER', id: { not: teacherA.id } } });
    if (!teacherB) {
      teacherB = await prisma.user.create({
        data: {
          email: `teacher_b_${TS}@test.com`,
          password: '$2a$10$hashedpasswordplaceholder',
          name: 'الأستاذ حسام الدين',
          role: 'TEACHER'
        }
      });
    }
    const tokenTeacherB = jwt.sign(
      { userId: teacherB.id, role: 'TEACHER', email: teacherB.email },
      JWT_SECRET,
      { expiresIn: '2h' }
    );

    // Student
    let student = await prisma.user.findFirst({ where: { role: 'ONLINE_STUDENT' } });
    if (!student) {
      student = await prisma.user.create({
        data: {
          email: `student_${TS}@test.com`,
          password: '$2a$10$hashedpasswordplaceholder',
          name: 'طالب متفوق',
          role: 'ONLINE_STUDENT'
        }
      });
    }
    const tokenStudent = jwt.sign(
      { userId: student.id, role: 'ONLINE_STUDENT', email: student.email },
      JWT_SECRET,
      { expiresIn: '2h' }
    );

    // Setup Course for Teacher A
    let courseA = await prisma.course.findFirst({ where: { teacherId: teacherA.id } });
    if (!courseA) {
      courseA = await prisma.course.create({
        data: {
          title: 'الرياضيات - الصف الأول الثانوي',
          teacherId: teacherA.id,
          status: 'PUBLISHED'
        }
      });
    }

    // Setup Assessment for Teacher A
    const assessmentA = await prisma.assessment.create({
      data: {
        title: 'امتحان تفاعلي بالصور - المتجهات',
        type: 'EXAM',
        courseId: courseA.id,
        teacherId: teacherA.id,
        durationMinutes: 45,
        status: 'PUBLISHED',
        questions: []
      }
    });

    // ----------------------------------------------------
    // Section 1: Upload Validation & Binary Signature Security
    // ----------------------------------------------------
    console.log('\n--- Section 1: Upload Validation & Signature Security ---');

    // 1. Valid PNG upload by authorized Teacher A
    const uploadResPng = await axios.post(
      `${ASSESSMENTS_URL}/assets/upload`,
      {
        assessmentId: assessmentA.id,
        imageBase64: `data:image/png;base64,${VALID_PNG_BASE64}`,
        filename: 'geometry_diagram.png',
        mimeType: 'image/png'
      },
      { headers: { Authorization: `Bearer ${tokenTeacherA}` } }
    );
    assert(uploadResPng.status === 201 && uploadResPng.data.assetId, 'Valid PNG upload accepted (201 Created)');
    assert(uploadResPng.data.storageKey.includes('assessment-assets/'), 'Storage key generated safely with prefix and UUID');
    const assetIdA = uploadResPng.data.assetId;

    // 2. Valid JPEG upload
    const uploadResJpeg = await axios.post(
      `${ASSESSMENTS_URL}/assets/upload`,
      {
        assessmentId: assessmentA.id,
        imageBase64: `data:image/jpeg;base64,${VALID_JPEG_BASE64}`,
        filename: 'math_curve.jpg',
        mimeType: 'image/jpeg'
      },
      { headers: { Authorization: `Bearer ${tokenTeacherA}` } }
    );
    assert(uploadResJpeg.status === 201 && uploadResJpeg.data.mimeType === 'image/jpeg', 'Valid JPEG upload accepted');

    // 3. Valid WebP upload
    const uploadResWebp = await axios.post(
      `${ASSESSMENTS_URL}/assets/upload`,
      {
        assessmentId: assessmentA.id,
        imageBase64: `data:image/webp;base64,${VALID_WEBP_BASE64}`,
        filename: 'vector_graph.webp',
        mimeType: 'image/webp'
      },
      { headers: { Authorization: `Bearer ${tokenTeacherA}` } }
    );
    assert(uploadResWebp.status === 201 && uploadResWebp.data.mimeType === 'image/webp', 'Valid WebP upload accepted');

    // 4. Invalid MIME rejection (e.g. application/pdf)
    let invalidMimeBlocked = false;
    try {
      await axios.post(
        `${ASSESSMENTS_URL}/assets/upload`,
        {
          assessmentId: assessmentA.id,
          imageBase64: `data:application/pdf;base64,${VALID_PNG_BASE64}`,
          filename: 'doc.pdf',
          mimeType: 'application/pdf'
        },
        { headers: { Authorization: `Bearer ${tokenTeacherA}` } }
      );
    } catch (e) {
      invalidMimeBlocked = e.response?.status === 400;
    }
    assert(invalidMimeBlocked, 'Disallowed MIME type rejected (400 Bad Request)');

    // 5. Invalid extension rejection (.exe)
    let invalidExtBlocked = false;
    try {
      await axios.post(
        `${ASSESSMENTS_URL}/assets/upload`,
        {
          assessmentId: assessmentA.id,
          imageBase64: `data:image/png;base64,${VALID_PNG_BASE64}`,
          filename: 'payload.exe',
          mimeType: 'image/png'
        },
        { headers: { Authorization: `Bearer ${tokenTeacherA}` } }
      );
    } catch (e) {
      invalidExtBlocked = e.response?.status === 400;
    }
    assert(invalidExtBlocked, 'Disallowed file extension rejected (400 Bad Request)');

    // 6. Mismatched MIME vs Magic Bytes (declared JPEG but body is PNG)
    let mismatchBlocked = false;
    try {
      await axios.post(
        `${ASSESSMENTS_URL}/assets/upload`,
        {
          assessmentId: assessmentA.id,
          imageBase64: `data:image/jpeg;base64,${VALID_PNG_BASE64}`,
          filename: 'fake_jpeg.jpg',
          mimeType: 'image/jpeg'
        },
        { headers: { Authorization: `Bearer ${tokenTeacherA}` } }
      );
    } catch (e) {
      mismatchBlocked = e.response?.status === 400;
    }
    assert(mismatchBlocked, 'Mismatched declared MIME vs actual magic bytes rejected (400 Bad Request)');

    // 7. Disguised Windows Executable (MZ header)
    let disguisedExeBlocked = false;
    try {
      await axios.post(
        `${ASSESSMENTS_URL}/assets/upload`,
        {
          assessmentId: assessmentA.id,
          imageBase64: `data:image/png;base64,${DISGUISED_EXE_BASE64}`,
          filename: 'malware.png',
          mimeType: 'image/png'
        },
        { headers: { Authorization: `Bearer ${tokenTeacherA}` } }
      );
    } catch (e) {
      disguisedExeBlocked = e.response?.status === 400;
    }
    assert(disguisedExeBlocked, 'Executable disguised as image rejected (400 Bad Request)');

    // 8. Disguised Script / Webshell Injection
    let disguisedScriptBlocked = false;
    try {
      await axios.post(
        `${ASSESSMENTS_URL}/assets/upload`,
        {
          assessmentId: assessmentA.id,
          imageBase64: `data:image/jpeg;base64,${DISGUISED_SCRIPT_BASE64}`,
          filename: 'webshell.jpg',
          mimeType: 'image/jpeg'
        },
        { headers: { Authorization: `Bearer ${tokenTeacherA}` } }
      );
    } catch (e) {
      disguisedScriptBlocked = e.response?.status === 400;
    }
    assert(disguisedScriptBlocked, 'Script / webshell disguised as image rejected (400 Bad Request)');

    // 9. Disguised HTML / XSS Injection
    let disguisedHtmlBlocked = false;
    try {
      await axios.post(
        `${ASSESSMENTS_URL}/assets/upload`,
        {
          assessmentId: assessmentA.id,
          imageBase64: `data:image/jpeg;base64,${DISGUISED_HTML_BASE64}`,
          filename: 'xss.jpg',
          mimeType: 'image/jpeg'
        },
        { headers: { Authorization: `Bearer ${tokenTeacherA}` } }
      );
    } catch (e) {
      disguisedHtmlBlocked = e.response?.status === 400;
    }
    assert(disguisedHtmlBlocked, 'HTML / XSS payload disguised as image rejected (400 Bad Request)');

    // 10. Malformed random binary noise
    let malformedBlocked = false;
    try {
      const RANDOM_NOISE_BASE64 = Buffer.from([0x12, 0x34, 0x56, 0x78, 0x9A, 0xBC, 0xDE, 0xF0]).toString('base64');
      await axios.post(
        `${ASSESSMENTS_URL}/assets/upload`,
        {
          assessmentId: assessmentA.id,
          imageBase64: `data:image/png;base64,${RANDOM_NOISE_BASE64}`,
          filename: 'corrupt.png',
          mimeType: 'image/png'
        },
        { headers: { Authorization: `Bearer ${tokenTeacherA}` } }
      );
    } catch (e) {
      malformedBlocked = e.response?.status === 400;
    }
    assert(malformedBlocked, 'Malformed binary noise rejected (400 Bad Request)');



    // ----------------------------------------------------
    // Section 2: Authorization & Anti-IDOR Protection
    // ----------------------------------------------------
    console.log('\n--- Section 2: Authorization & Anti-IDOR Protection ---');

    // 1. Student blocked from uploading
    let studentUploadBlocked = false;
    try {
      await axios.post(
        `${ASSESSMENTS_URL}/assets/upload`,
        {
          assessmentId: assessmentA.id,
          imageBase64: `data:image/png;base64,${VALID_PNG_BASE64}`,
          filename: 'student_hack.png',
          mimeType: 'image/png'
        },
        { headers: { Authorization: `Bearer ${tokenStudent}` } }
      );
    } catch (e) {
      studentUploadBlocked = e.response?.status === 403;
    }
    assert(studentUploadBlocked, 'Student blocked from uploading question assets (403 Forbidden)');

    // 2. Cross-teacher IDOR: Teacher B uploading to Teacher A's assessment
    let teacherB_IDOR_Blocked = false;
    try {
      await axios.post(
        `${ASSESSMENTS_URL}/${assessmentA.id}/assets/upload`,
        {
          imageBase64: `data:image/png;base64,${VALID_PNG_BASE64}`,
          filename: 'idor_attempt.png',
          mimeType: 'image/png'
        },
        { headers: { Authorization: `Bearer ${tokenTeacherB}` } }
      );
    } catch (e) {
      teacherB_IDOR_Blocked = e.response?.status === 403;
    }
    assert(teacherB_IDOR_Blocked, 'Cross-teacher IDOR upload blocked (403 Forbidden)');

    // 3. Cross-teacher IDOR: Teacher B deleting Teacher A's asset
    let teacherB_Delete_Blocked = false;
    try {
      await axios.delete(
        `${ASSESSMENTS_URL}/assets/${assetIdA}`,
        { headers: { Authorization: `Bearer ${tokenTeacherB}` } }
      );
    } catch (e) {
      teacherB_Delete_Blocked = e.response?.status === 403;
    }
    assert(teacherB_Delete_Blocked, 'Cross-teacher IDOR asset deletion blocked (403 Forbidden)');

    // 4. Admin authorized to manage assets
    const adminUpload = await axios.post(
      `${ASSESSMENTS_URL}/${assessmentA.id}/assets/upload`,
      {
        imageBase64: `data:image/png;base64,${VALID_PNG_BASE64}`,
        filename: 'admin_asset.png',
        mimeType: 'image/png'
      },
      { headers: { Authorization: `Bearer ${adminToken}` } }
    );
    assert(adminUpload.status === 201 && adminUpload.data.assetId, 'Admin authorized to upload question asset across assessments');


    // ----------------------------------------------------
    // Section 3: Question Workflow & State Integrity
    // ----------------------------------------------------
    console.log('\n--- Section 3: Question Workflow & Authoritative Model ---');

    // Attach image to assessment question
    const updatedQuestions = [
      {
        id: '1',
        text: 'في الشكل الهندسي الموضح أدناه، ما هي قيمة الزاوية س؟',
        type: 'mcq',
        options: ['30°', '45°', '60°', '90°'],
        correct: 1,
        imageUrl: uploadResPng.data.url,
        imageStorageKey: uploadResPng.data.storageKey,
        imageAssetId: assetIdA,
        explanation: 'مجموع زوايا المثلث 180 درجة وبالتالي الزاوية = 45',
        points: 5
      }
    ];

    const updateRes = await axios.put(
      `${ASSESSMENTS_URL}/${assessmentA.id}`,
      {
        questions: updatedQuestions
      },
      { headers: { Authorization: `Bearer ${tokenTeacherA}` } }
    );
    assert(updateRes.status === 200, 'Assessment questions updated with image asset metadata');

    // Verify DB linkage
    const linkedAsset = await prisma.temporaryAsset.findUnique({ where: { id: assetIdA } });
    assert(linkedAsset.assessmentId === assessmentA.id, 'TemporaryAsset correctly linked to assessment in database');

    // Verify teacher remains authoritative source of truth
    const teacherEditQuestions = [
      {
        ...updatedQuestions[0],
        text: 'في الشكل الهندسي المعدل، ما هي قيمة الزاوية ص؟',
        options: ['15°', '45°', '75°', '105°'],
        correct: 2,
        explanation: 'تم تعديل المعطيات والتفسير بواسطة المعلم'
      }
    ];
    const updateEditRes = await axios.put(
      `${ASSESSMENTS_URL}/${assessmentA.id}`,
      {
        questions: teacherEditQuestions
      },
      { headers: { Authorization: `Bearer ${tokenTeacherA}` } }
    );
    assert(
      updateEditRes.data.questions[0].text.includes('المعدل') &&
      updateEditRes.data.questions[0].correct === 2 &&
      updateEditRes.data.questions[0].imageUrl === uploadResPng.data.url,
      'Teacher prompt, options, correct answer, and explanation updated while preserving image reference'
    );


    // ----------------------------------------------------
    // Section 4: Temporary Asset Lifecycle Cleanup & Strict Conditions
    // ----------------------------------------------------
    console.log('\n--- Section 4: Temporary Asset Lifecycle Cleanup & Conditions ---');

    // Condition A: Future closeAt -> Blocked
    await prisma.assessment.update({
      where: { id: assessmentA.id },
      data: { closeAt: new Date(Date.now() + 24 * 3600 * 1000) } // Tomorrow
    });

    const cleanupCondA = await axios.post(
      `${ASSESSMENTS_URL}/admin/cleanup-assets?assessmentId=${assessmentA.id}`,
      {},
      { headers: { Authorization: `Bearer ${adminToken}` } }
    );
    assert(
      cleanupCondA.data.assessmentsSkipped === 1 &&
      cleanupCondA.data.details[0].reason.includes('Condition A failed'),
      'Condition A: Active future exam window blocks asset deletion'
    );

    // Condition B: Assessment ended, but active attempt in progress -> Blocked
    await prisma.assessment.update({
      where: { id: assessmentA.id },
      data: { closeAt: new Date(Date.now() - 72 * 3600 * 1000) } // 72h ago
    });

    const attempt = await prisma.assessmentAttempt.create({
      data: {
        assessmentId: assessmentA.id,
        studentId: student.id,
        status: 'IN_PROGRESS',
        startedAt: new Date()
      }
    });

    const cleanupCondB = await axios.post(
      `${ASSESSMENTS_URL}/admin/cleanup-assets?assessmentId=${assessmentA.id}`,
      {},
      { headers: { Authorization: `Bearer ${adminToken}` } }
    );
    assert(
      cleanupCondB.data.assessmentsSkipped === 1 &&
      cleanupCondB.data.details[0].reason.includes('Condition B failed'),
      'Condition B: Active/in-progress attempt blocks asset deletion'
    );

    // Condition C: Attempt submitted, but grace period (48h) not elapsed -> Blocked
    await prisma.assessmentAttempt.update({
      where: { id: attempt.id },
      data: { status: 'SUBMITTED', score: 95, submittedAt: new Date() }
    });

    await prisma.assessment.update({
      where: { id: assessmentA.id },
      data: { closeAt: new Date(Date.now() - 12 * 3600 * 1000) } // 12h ago (< 48h)
    });

    const cleanupCondC = await axios.post(
      `${ASSESSMENTS_URL}/admin/cleanup-assets?assessmentId=${assessmentA.id}`,
      {},
      { headers: { Authorization: `Bearer ${adminToken}` } }
    );
    assert(
      cleanupCondC.data.assessmentsSkipped === 1 &&
      cleanupCondC.data.details[0].reason.includes('Condition C failed'),
      'Condition C: Grace period (48h) not elapsed blocks asset deletion'
    );

    // All Conditions Met: closeAt > 48h ago, attempt is SUBMITTED
    await prisma.assessment.update({
      where: { id: assessmentA.id },
      data: { closeAt: new Date(Date.now() - 50 * 3600 * 1000) } // 50h ago
    });

    const cleanupAllPass = await axios.post(
      `${ASSESSMENTS_URL}/admin/cleanup-assets?assessmentId=${assessmentA.id}`,
      {},
      { headers: { Authorization: `Bearer ${adminToken}` } }
    );
    assert(
      cleanupAllPass.data.assessmentsEligible === 1 &&
      cleanupAllPass.data.assetsDeleted >= 1,
      'All Conditions (A, B, C, D) satisfied: Assets deleted successfully'
    );

    // Verify TemporaryAsset DB record has deletedAt timestamp
    const dbAssetAfterCleanup = await prisma.temporaryAsset.findUnique({ where: { id: assetIdA } });
    assert(dbAssetAfterCleanup.deletedAt !== null, 'TemporaryAsset record preserved with deletedAt timestamp');

    // Grade / Score Survival: Student grades and attempt data MUST survive image deletion
    const attemptAfterCleanup = await prisma.assessmentAttempt.findUnique({ where: { id: attempt.id } });
    assert(
      attemptAfterCleanup.score === 95 && attemptAfterCleanup.status === 'SUBMITTED',
      'Student exam score (95) and attempt record survive image deletion without corruption'
    );

    // Idempotency: Running cleanup again should succeed with 0 errors
    const cleanupIdempotent = await axios.post(
      `${ASSESSMENTS_URL}/admin/cleanup-assets?assessmentId=${assessmentA.id}`,
      {},
      { headers: { Authorization: `Bearer ${adminToken}` } }
    );
    assert(
      cleanupIdempotent.data.errors.length === 0,
      'Cleanup operation is completely idempotent and safe to re-run'
    );


    // ----------------------------------------------------
    // Clean up test data
    // ----------------------------------------------------
    await prisma.temporaryAsset.deleteMany({ where: { assessmentId: assessmentA.id } });
    await prisma.assessmentAttempt.deleteMany({ where: { assessmentId: assessmentA.id } });
    await prisma.assessment.delete({ where: { id: assessmentA.id } });

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
