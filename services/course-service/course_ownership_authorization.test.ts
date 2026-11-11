/**
 * OX-DIGITAL Education — Teacher Course Ownership, Visibility & Authorization Regression Suite
 *
 * Verifies all 21 required acceptance scenarios:
 * 1. Teacher A creates Course 1: Course 1 has teacherId = Teacher A, institutionId & branchId populated.
 * 2. Teacher A requests /api/courses: Course 1 appears in list.
 * 3. Teacher A requests course details: Course 1 details returned.
 * 4. Teacher A adds Lesson 1 to Course 1: Allowed.
 * 5. Teacher A edits Lesson 1 in Course 1: Allowed.
 * 6. Teacher A requests video ticket for Lesson 1: Allowed without student enrollment.
 * 7. Teacher B requests /api/courses: Course 1 does NOT appear in Teacher B's courses.
 * 8. Teacher B attempts to edit/delete Course 1 or Lesson 1: Rejected with 403 Forbidden.
 * 9. Primary Manager requests /api/courses: Course 1 appears in manager list.
 * 10. Primary Manager edits/manages Course 1 or Lesson 1: Allowed.
 * 11. Tenant Isolation in Course List: Teacher A (Inst 1) does NOT see foreign course (Inst 2).
 * 12. Legacy Course Scoping: Teacher A sees own legacy unscoped course, does NOT see Teacher B legacy course.
 * 13. Manager Tenant Scoping: Manager (Inst 1) does NOT see foreign courses (Inst 2) or unscoped courses of another teacher.
 * 14. Cross-Tenant Detail Access Guard: Teacher or Manager from Inst 1 accessing Inst 2 course rejected with 403 Forbidden.
 * 15. Cross-Tenant Course Creation Guard: Manager (Inst 1) creating course for Teacher C (Inst 2) rejected with 403 Forbidden.
 * 16. Teacher Branch Integrity: Teacher attempting to override branchId during course creation/update has server branch preserved.
 * 17. Cross-Tenant Video Access Guard: Foreign user (Inst 2) requesting video ticket for Inst 1 lesson rejected with 403 Forbidden.
 * 18. Lesson Listing Tenant Scoping: Teacher A and Manager 1 only receive authorized lessons; foreign lessons excluded.
 * 19. Quiz Submission Tenant & Enrollment Protection: Unenrolled or cross-tenant student rejected with 403 Forbidden.
 * 20. Video Ticket Lesson Scope Mismatch Defense: Ticket scoped to Lesson 1 rejected when attempting to stream Lesson 2.
 * 21. Course Enrollment Tenant Boundary: Student from Inst 1 attempting to enroll in Inst 2 course rejected with 403 Forbidden.
 */

// Set isolated environment variables before any module imports
process.env.DATABASE_URL = 'postgresql://ox_digital_dev:ox_digital_dev@127.0.0.1:5433/ox_digital_dev_test?schema=public';
process.env.JWT_SECRET = 'test-jwt-secret-ox-digital-test-key-32chars';

import assert from 'assert';
import jwt from 'jsonwebtoken';
import { db } from '../../packages/database/src/index.js';
import {
  createCourse,
  getCourses,
  getCourseDetails,
  updateCourse,
  deleteCourse,
  createLesson,
  updateLesson,
  deleteLesson,
  getLessons,
  generateLessonVideoTicket,
  streamLessonVideo,
  submitLessonQuiz,
  enrollCourse
} from './src/controllers/course.controller.js';
import { checkUserEnrollment } from './src/utils/enrollment.js';
import { verifyToken } from './src/middlewares/auth.middleware.js';

console.log('===================================================================');
console.log('OX-DIGITAL Education — Teacher Course Ownership & Authorization Test');
console.log('===================================================================');

const COURSE_1_ID = '11111111-1111-4111-8111-111111111111';
const LESSON_1_ID = '22222222-2222-4222-8222-222222222222';
const LESSON_2_ID = '22222222-2222-4222-8222-333333333333';
const COURSE_LEGACY_A_ID = '33333333-3333-4333-8333-333333333333';
const COURSE_LEGACY_B_ID = '44444444-4444-4444-8444-444444444444';
const COURSE_INST_2_ID = '55555555-5555-4555-8555-555555555555';
const LESSON_INST_2_ID = '66666666-6666-4666-8666-666666666666';
const QUIZ_1_ID = '77777777-7777-4777-8777-777777777777';

const TEACHER_A_ID = '11111111-0000-0000-0000-000000000001';
const TEACHER_B_ID = '22222222-0000-0000-0000-000000000002';
const MANAGER_ID = '33333333-0000-0000-0000-000000000003';
const STUDENT_ID = '44444444-0000-0000-0000-000000000004';
const TEACHER_C_INST2_ID = '55555555-0000-0000-0000-000000000005';
const MANAGER_INST2_ID = '66666666-0000-0000-0000-000000000006';

// In-Memory Data Store to simulate database without persistent writes
const users = new Map<string, any>([
  [TEACHER_A_ID, {
    id: TEACHER_A_ID,
    name: 'أحمد محمود',
    role: 'TEACHER',
    email: 'teacher.a@ox-digital.edu',
    institutionId: 'inst-001',
    branchId: 'branch-001'
  }],
  [TEACHER_B_ID, {
    id: TEACHER_B_ID,
    name: 'سارة خالد',
    role: 'TEACHER',
    email: 'teacher.b@ox-digital.edu',
    institutionId: 'inst-001',
    branchId: 'branch-002'
  }],
  [MANAGER_ID, {
    id: MANAGER_ID,
    name: 'المدير العام',
    role: 'ADMIN',
    isPrimaryManager: true,
    email: 'manager@ox-digital.edu',
    institutionId: 'inst-001',
    branchId: null
  }],
  [STUDENT_ID, {
    id: STUDENT_ID,
    name: 'طالب مجتهد',
    role: 'ONLINE_STUDENT',
    email: 'student@ox-digital.edu',
    institutionId: 'inst-001',
    branchId: null
  }],
  [TEACHER_C_INST2_ID, {
    id: TEACHER_C_INST2_ID,
    name: 'محمود عبد الله (مؤسسة أخرى)',
    role: 'TEACHER',
    email: 'teacher.c@foreign-inst.edu',
    institutionId: 'inst-002',
    branchId: 'branch-foreign'
  }],
  [MANAGER_INST2_ID, {
    id: MANAGER_INST2_ID,
    name: 'مدير المؤسسة الثانية',
    role: 'PRIMARY_MANAGER',
    isPrimaryManager: true,
    email: 'manager@foreign-inst.edu',
    institutionId: 'inst-002',
    branchId: null
  }],
  ['77777777-0000-0000-0000-000000000007', {
    id: '77777777-0000-0000-0000-000000000007',
    name: 'طالب مقيد مالياً',
    role: 'CENTER_STUDENT',
    financialAccessStatus: 'RESTRICTED',
    email: 'restricted@ox-digital.edu',
    institutionId: 'inst-001',
    branchId: 'branch-001'
  }],
  ['88888888-0000-0000-0000-000000000008', {
    id: '88888888-0000-0000-0000-000000000008',
    name: 'صاحب بريد إداري سابق',
    role: 'ONLINE_STUDENT',
    email: 'admin@edu.com',
    institutionId: 'inst-002',
    branchId: null
  }]
]);

const courses = new Map<string, any>();
const lessons = new Map<string, any>();
const enrollments = new Map<string, any>();
const quizzes = new Map<string, any>();

function matchesWhere(c: any, where: any): boolean {
  if (!where) return true;
  if (where.teacherId && c.teacherId !== where.teacherId) return false;
  if (where.institutionId && c.institutionId !== where.institutionId) return false;
  if (where.OR && Array.isArray(where.OR)) {
    const match = where.OR.some((cond: any) => {
      let condMatch = true;
      if (cond.institutionId !== undefined) {
        if (cond.institutionId === null && c.institutionId !== null) condMatch = false;
        if (cond.institutionId !== null && c.institutionId !== cond.institutionId) condMatch = false;
      }
      if (cond.teacherId !== undefined && c.teacherId !== cond.teacherId) condMatch = false;
      return condMatch;
    });
    if (!match) return false;
  }
  return true;
}

const mockDb: any = {
  branch: {
    findFirst: async ({ where }: any) => {
      // Validate branch belongs to the same institution
      if (where.id && where.institutionId) {
        if (where.id.includes('foreign') && where.institutionId === 'inst-001') return null;
        return { id: where.id, institutionId: where.institutionId, deletedAt: null };
      }
      return null;
    }
  },
  user: {
    findUnique: async ({ where }: any) => {
      return users.get(where.id) || null;
    }
  },
  course: {
    create: async ({ data }: any) => {
      const id = data.id || COURSE_1_ID;
      const record = { id, createdAt: new Date(), updatedAt: new Date(), ...data };
      courses.set(id, record);
      return record;
    },
    count: async ({ where }: any) => {
      return Array.from(courses.values()).filter(c => matchesWhere(c, where)).length;
    },
    findUnique: async ({ where }: any) => {
      const c = courses.get(where.id);
      if (!c) return null;
      const courseLessons = Array.from(lessons.values()).filter(l => l.courseId === c.id);
      return {
        ...c,
        lessons: courseLessons,
        teacher: users.get(c.teacherId) || null,
        _count: { lessons: courseLessons.length, enrollments: 0, exams: 0, homeworks: 0 }
      };
    },
    findMany: async ({ where }: any) => {
      return Array.from(courses.values())
        .filter(c => matchesWhere(c, where))
        .map(c => ({
          ...c,
          lessons: Array.from(lessons.values()).filter(l => l.courseId === c.id)
        }));
    },
    update: async ({ where, data }: any) => {
      const c = courses.get(where.id);
      if (!c) throw new Error('Not found');
      const updated = { ...c, ...data, updatedAt: new Date() };
      courses.set(where.id, updated);
      return updated;
    },
    delete: async ({ where }: any) => {
      const c = courses.get(where.id);
      courses.delete(where.id);
      return c;
    }
  },
  lesson: {
    create: async ({ data }: any) => {
      const id = data.id || LESSON_1_ID;
      const record = { id, createdAt: new Date(), updatedAt: new Date(), ...data };
      lessons.set(id, record);
      return record;
    },
    findUnique: async ({ where }: any) => {
      const l = lessons.get(where.id);
      if (!l) return null;
      const parentCourse = courses.get(l.courseId);
      return {
        ...l,
        course: parentCourse ? { teacherId: parentCourse.teacherId, institutionId: parentCourse.institutionId } : null
      };
    },
    findMany: async ({ where }: any) => {
      let list = Array.from(lessons.values());
      if (where?.course) {
        list = list.filter(l => {
          const parentCourse = courses.get(l.courseId);
          if (!parentCourse) return false;
          if (where.course.teacherId && parentCourse.teacherId !== where.course.teacherId) return false;
          if (where.course.institutionId && parentCourse.institutionId !== where.course.institutionId) return false;
          if (where.course.OR) {
            const orMatch = where.course.OR.some((cond: any) => {
              if (cond.institutionId !== undefined) {
                if (cond.institutionId === null && parentCourse.institutionId !== null) return false;
                if (cond.institutionId !== null && parentCourse.institutionId !== cond.institutionId) return false;
              }
              if (cond.teacherId !== undefined && parentCourse.teacherId !== cond.teacherId) return false;
              return true;
            });
            if (!orMatch) return false;
          }
          return true;
        });
      }
      return list.map(l => ({
        ...l,
        course: { title: courses.get(l.courseId)?.title || '' }
      }));
    },
    count: async ({ where }: any) => {
      let list = Array.from(lessons.values());
      if (where?.course) {
        list = list.filter(l => {
          const parentCourse = courses.get(l.courseId);
          if (!parentCourse) return false;
          if (where.course.teacherId && parentCourse.teacherId !== where.course.teacherId) return false;
          if (where.course.institutionId && parentCourse.institutionId !== where.course.institutionId) return false;
          if (where.course.OR) {
            const orMatch = where.course.OR.some((cond: any) => {
              if (cond.institutionId !== undefined) {
                if (cond.institutionId === null && parentCourse.institutionId !== null) return false;
                if (cond.institutionId !== null && parentCourse.institutionId !== cond.institutionId) return false;
              }
              if (cond.teacherId !== undefined && parentCourse.teacherId !== cond.teacherId) return false;
              return true;
            });
            if (!orMatch) return false;
          }
          return true;
        });
      }
      return list.length;
    },
    update: async ({ where, data }: any) => {
      const l = lessons.get(where.id);
      if (!l) throw new Error('Not found');
      const updated = { ...l, ...data, updatedAt: new Date() };
      lessons.set(where.id, updated);
      return updated;
    },
    delete: async ({ where }: any) => {
      const l = lessons.get(where.id);
      lessons.delete(where.id);
      return l;
    }
  },
  lessonQuiz: {
    findUnique: async ({ where }: any) => {
      return quizzes.get(where.id) || null;
    },
    findMany: async ({ where }: any) => {
      return Array.from(quizzes.values()).filter(q => !where?.lessonId || q.lessonId === where.lessonId);
    }
  },
  videoProgress: {
    findUnique: async () => null,
    upsert: async ({ create }: any) => create
  },
  courseEnrollment: {
    create: async ({ data }: any) => {
      const record = { id: 'enr-' + Date.now(), ...data };
      enrollments.set(record.id, record);
      return record;
    },
    findFirst: async ({ where }: any) => {
      return Array.from(enrollments.values()).find(
        e => e.studentId === where.studentId && e.courseId === where.courseId
      ) || null;
    },
    findMany: async () => Array.from(enrollments.values())
  }
};

(globalThis as any).prismaGlobal = mockDb;

function createMockReq(options: any = {}): any {
  return {
    user: options.user || null,
    tenantContext: options.tenantContext || null,
    body: options.body || {},
    params: options.params || {},
    query: options.query || {},
    headers: options.headers || {},
    originalUrl: options.originalUrl || '',
    path: options.path || ''
  };
}

function createMockRes(): any {
  const res: any = {
    statusCode: 200,
    body: null,
    status(code: number) {
      res.statusCode = code;
      return res;
    },
    json(data: any) {
      res.body = data;
      return res;
    }
  };
  return res;
}

async function runTests() {
  let passed = 0;
  let failed = 0;

  // Prepopulate legacy unscoped courses and Inst 2 foreign course
  courses.set(COURSE_LEGACY_A_ID, {
    id: COURSE_LEGACY_A_ID,
    title: 'دورة قديمة للأستاذ أحمد',
    category: 'الرياضيات',
    price: 100,
    status: 'PUBLISHED',
    teacherId: TEACHER_A_ID,
    institutionId: null,
    branchId: null,
    createdAt: new Date(),
    updatedAt: new Date()
  });

  courses.set(COURSE_LEGACY_B_ID, {
    id: COURSE_LEGACY_B_ID,
    title: 'دورة قديمة للأستاذة سارة',
    category: 'الفيزياء',
    price: 150,
    status: 'PUBLISHED',
    teacherId: TEACHER_B_ID,
    institutionId: null,
    branchId: null,
    createdAt: new Date(),
    updatedAt: new Date()
  });

  courses.set(COURSE_INST_2_ID, {
    id: COURSE_INST_2_ID,
    title: 'دورة المؤسسة الثانية',
    category: 'الكيمياء',
    price: 300,
    status: 'PUBLISHED',
    teacherId: TEACHER_C_INST2_ID,
    institutionId: 'inst-002',
    branchId: 'branch-foreign',
    createdAt: new Date(),
    updatedAt: new Date()
  });

  // Prepopulate lesson in Inst 2 course
  lessons.set(LESSON_INST_2_ID, {
    id: LESSON_INST_2_ID,
    title: 'درس كيمياء مؤسسة 2',
    courseId: COURSE_INST_2_ID,
    videoUrl: 'https://storage.ox-digital.internal/lessons/video-inst2.mp4',
    createdAt: new Date(),
    updatedAt: new Date()
  });

  // Scenario 1: Teacher A creates Course 1 -> teacherId = Teacher A, institutionId & branchId populated
  try {
    const req = createMockReq({
      user: { userId: TEACHER_A_ID, role: 'TEACHER' },
      tenantContext: { institutionId: 'inst-001', branchId: 'branch-001' },
      body: {
        title: 'الرياضيات المتقدمة للصف الثالث الثانوي',
        description: 'دورة شاملة في التفاضل والتكامل',
        category: 'الرياضيات',
        price: 250,
        academicLevel: 'SEC_3'
      }
    });
    const res = createMockRes();
    await createCourse(req, res);

    assert.strictEqual(res.statusCode, 201, 'Status code must be 201');
    assert.strictEqual(res.body.teacherId, TEACHER_A_ID, 'teacherId must match Teacher A');
    assert.strictEqual(res.body.institutionId, 'inst-001', 'institutionId must be populated from tenantContext/teacher');
    assert.strictEqual(res.body.branchId, 'branch-001', 'branchId must be populated');
    console.log('✅ Scenario 1 Passed: Teacher A creates Course 1 with teacherId, institutionId, and branchId properly set.');
    passed++;
  } catch (err: any) {
    console.error('❌ Scenario 1 Failed:', err.message);
    failed++;
  }

  // Scenario 2: Teacher A requests /api/courses -> Course 1 appears in list
  try {
    const req = createMockReq({
      user: { userId: TEACHER_A_ID, role: 'TEACHER' },
      tenantContext: { institutionId: 'inst-001' }
    });
    const res = createMockRes();
    await getCourses(req, res);

    assert.strictEqual(res.statusCode, 200);
    const courseList = res.body.data || res.body;
    assert(Array.isArray(courseList), 'Response data must be an array');
    const found = courseList.find((c: any) => c.teacherId === TEACHER_A_ID);
    assert(found, 'Teacher A must see their own created course');
    console.log('✅ Scenario 2 Passed: Teacher A retrieves courses and sees created Course 1.');
    passed++;
  } catch (err: any) {
    console.error('❌ Scenario 2 Failed:', err.message);
    failed++;
  }

  // Scenario 3: Teacher A requests course details -> Course 1 details returned
  try {
    const req = createMockReq({
      user: { userId: TEACHER_A_ID, role: 'TEACHER' },
      tenantContext: { institutionId: 'inst-001' },
      params: { id: COURSE_1_ID }
    });
    const res = createMockRes();
    await getCourseDetails(req, res);

    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.body.id, COURSE_1_ID);
    console.log('✅ Scenario 3 Passed: Teacher A requests course details and receives complete data.');
    passed++;
  } catch (err: any) {
    console.error('❌ Scenario 3 Failed:', err.message);
    failed++;
  }

  // Scenario 4: Teacher A adds Lesson 1 to Course 1 -> Allowed
  try {
    const req = createMockReq({
      user: { userId: TEACHER_A_ID, role: 'TEACHER' },
      tenantContext: { institutionId: 'inst-001' },
      body: {
        title: 'الدرس الأول: نهايات الدوال المثلثية',
        courseId: COURSE_1_ID,
        videoUrl: 'https://storage.ox-digital.internal/lessons/video1.mp4'
      }
    });
    const res = createMockRes();
    await createLesson(req, res);

    assert.strictEqual(res.statusCode, 201);
    assert.strictEqual(res.body.courseId, COURSE_1_ID);
    console.log('✅ Scenario 4 Passed: Teacher A successfully creates Lesson 1 in owned Course 1.');
    passed++;
  } catch (err: any) {
    console.error('❌ Scenario 4 Failed:', err.message);
    failed++;
  }

  // Scenario 5: Teacher A edits Lesson 1 in Course 1 -> Allowed
  try {
    const req = createMockReq({
      user: { userId: TEACHER_A_ID, role: 'TEACHER' },
      tenantContext: { institutionId: 'inst-001' },
      params: { id: LESSON_1_ID },
      body: {
        title: 'الدرس الأول: نهايات الدوال المثلثية (محدث)'
      }
    });
    const res = createMockRes();
    await updateLesson(req, res);

    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.body.title, 'الدرس الأول: نهايات الدوال المثلثية (محدث)');
    console.log('✅ Scenario 5 Passed: Teacher A successfully updates Lesson 1 in owned Course 1.');
    passed++;
  } catch (err: any) {
    console.error('❌ Scenario 5 Failed:', err.message);
    failed++;
  }

  // Scenario 6: Teacher A requests video ticket for Lesson 1 -> Allowed without student enrollment
  try {
    const req = createMockReq({
      user: { userId: TEACHER_A_ID, role: 'TEACHER', institutionId: 'inst-001' },
      tenantContext: { institutionId: 'inst-001' },
      params: { id: LESSON_1_ID }
    });
    const res = createMockRes();
    await generateLessonVideoTicket(req, res);

    assert.strictEqual(res.statusCode, 200);
    assert(res.body?.ticket, 'Valid ticket must be generated for course owner teacher');
    console.log('✅ Scenario 6 Passed: Teacher A obtains video streaming ticket without needing student enrollment.');
    passed++;
  } catch (err: any) {
    console.error('❌ Scenario 6 Failed:', err.message);
    failed++;
  }

  // Scenario 7: Teacher B requests /api/courses -> Course 1 does NOT appear
  try {
    const req = createMockReq({
      user: { userId: TEACHER_B_ID, role: 'TEACHER' },
      tenantContext: { institutionId: 'inst-001' }
    });
    const res = createMockRes();
    await getCourses(req, res);

    assert.strictEqual(res.statusCode, 200);
    const courseList = res.body.data || res.body;
    const found = courseList.find((c: any) => c.teacherId === TEACHER_A_ID);
    assert.strictEqual(found, undefined, 'Teacher B must NOT see courses owned by Teacher A');
    console.log('✅ Scenario 7 Passed: Teacher B cannot see Teacher A courses in /api/courses.');
    passed++;
  } catch (err: any) {
    console.error('❌ Scenario 7 Failed:', err.message);
    failed++;
  }

  // Scenario 8: Teacher B attempts to edit or delete Course 1 or Lesson 1 -> Rejected with 403 Forbidden
  try {
    // Attempt course update
    const reqUpdateCourse = createMockReq({
      user: { userId: TEACHER_B_ID, role: 'TEACHER' },
      tenantContext: { institutionId: 'inst-001' },
      params: { id: COURSE_1_ID },
      body: { title: 'اختراق الدورة' }
    });
    const resUpdateCourse = createMockRes();
    await updateCourse(reqUpdateCourse, resUpdateCourse);
    assert.strictEqual(resUpdateCourse.statusCode, 403, 'Unauthorized course update must yield 403');

    // Attempt lesson update
    const reqUpdateLesson = createMockReq({
      user: { userId: TEACHER_B_ID, role: 'TEACHER' },
      tenantContext: { institutionId: 'inst-001' },
      params: { id: LESSON_1_ID },
      body: { title: 'تعديل غير مصرح به' }
    });
    const resUpdateLesson = createMockRes();
    await updateLesson(reqUpdateLesson, resUpdateLesson);
    assert.strictEqual(resUpdateLesson.statusCode, 403, 'Unauthorized lesson update must yield 403');

    // Attempt lesson delete
    const reqDelLesson = createMockReq({
      user: { userId: TEACHER_B_ID, role: 'TEACHER' },
      tenantContext: { institutionId: 'inst-001' },
      params: { id: LESSON_1_ID }
    });
    const resDelLesson = createMockRes();
    await deleteLesson(reqDelLesson, resDelLesson);
    assert.strictEqual(resDelLesson.statusCode, 403, 'Unauthorized lesson delete must yield 403');

    console.log('✅ Scenario 8 Passed: Non-owner Teacher B is strictly rejected with 403 Forbidden on update/delete.');
    passed++;
  } catch (err: any) {
    console.error('❌ Scenario 8 Failed:', err.message);
    failed++;
  }

  // Scenario 9: Primary Manager requests /api/courses -> Course 1 appears in list
  try {
    const req = createMockReq({
      user: { userId: MANAGER_ID, role: 'ADMIN', isPrimaryManager: true },
      tenantContext: { institutionId: 'inst-001' }
    });
    const res = createMockRes();
    await getCourses(req, res);

    assert.strictEqual(res.statusCode, 200);
    const courseList = res.body.data || res.body;
    const found = courseList.find((c: any) => c.teacherId === TEACHER_A_ID);
    assert(found, 'Primary Manager must see institution courses created by teachers');
    console.log('✅ Scenario 9 Passed: Primary Manager sees Teacher A course in institution course list.');
    passed++;
  } catch (err: any) {
    console.error('❌ Scenario 9 Failed:', err.message);
    failed++;
  }

  // Scenario 10: Primary Manager edits/manages Course 1 and Lesson 1 -> Allowed
  try {
    // Manager updates course
    const reqUpdateCourse = createMockReq({
      user: { userId: MANAGER_ID, role: 'PRIMARY_MANAGER', isPrimaryManager: true },
      tenantContext: { institutionId: 'inst-001' },
      params: { id: COURSE_1_ID },
      body: { title: 'الرياضيات المتقدمة - مراجعة الإدارة' }
    });
    const resUpdateCourse = createMockRes();
    await updateCourse(reqUpdateCourse, resUpdateCourse);
    assert.strictEqual(resUpdateCourse.statusCode, 200, 'Primary manager must be allowed to update course');

    // Manager updates lesson
    const reqUpdateLesson = createMockReq({
      user: { userId: MANAGER_ID, role: 'PRIMARY_MANAGER', isPrimaryManager: true },
      tenantContext: { institutionId: 'inst-001' },
      params: { id: LESSON_1_ID },
      body: { title: 'الدرس الأول - موافقة الإدارة' }
    });
    const resUpdateLesson = createMockRes();
    await updateLesson(reqUpdateLesson, resUpdateLesson);
    assert.strictEqual(resUpdateLesson.statusCode, 200, 'Primary manager must be allowed to update lesson');

    // Manager requests lesson video ticket
    const reqTicket = createMockReq({
      user: { userId: MANAGER_ID, role: 'PRIMARY_MANAGER', isPrimaryManager: true, institutionId: 'inst-001' },
      tenantContext: { institutionId: 'inst-001' },
      params: { id: LESSON_1_ID }
    });
    const resTicket = createMockRes();
    await generateLessonVideoTicket(reqTicket, resTicket);
    assert.strictEqual(resTicket.statusCode, 200, 'Primary manager must be allowed to generate video ticket');

    console.log('✅ Scenario 10 Passed: Primary Manager has full administrative authority over courses and lessons.');
    passed++;
  } catch (err: any) {
    console.error('❌ Scenario 10 Failed:', err.message);
    failed++;
  }

  // Scenario 11: Tenant Isolation in Course List: Teacher A (Inst 1) does NOT see foreign course (Inst 2)
  try {
    const req = createMockReq({
      user: { userId: TEACHER_A_ID, role: 'TEACHER' },
      tenantContext: { institutionId: 'inst-001' }
    });
    const res = createMockRes();
    await getCourses(req, res);

    assert.strictEqual(res.statusCode, 200);
    const courseList = res.body.data || res.body;
    const foreign = courseList.find((c: any) => c.institutionId === 'inst-002');
    assert.strictEqual(foreign, undefined, 'Teacher A must NOT see courses belonging to inst-002');
    console.log('✅ Scenario 11 Passed: Tenant isolation verified — Inst 2 courses excluded from Teacher A course list.');
    passed++;
  } catch (err: any) {
    console.error('❌ Scenario 11 Failed:', err.message);
    failed++;
  }

  // Scenario 12: Legacy Course Scoping: Teacher A sees own legacy unscoped course, does NOT see Teacher B legacy course
  try {
    const req = createMockReq({
      user: { userId: TEACHER_A_ID, role: 'TEACHER' },
      tenantContext: { institutionId: 'inst-001' }
    });
    const res = createMockRes();
    await getCourses(req, res);

    assert.strictEqual(res.statusCode, 200);
    const courseList = res.body.data || res.body;
    const ownLegacy = courseList.find((c: any) => c.id === COURSE_LEGACY_A_ID);
    assert(ownLegacy, 'Teacher A must see their own legacy course with null institutionId');
    const otherLegacy = courseList.find((c: any) => c.id === COURSE_LEGACY_B_ID);
    assert.strictEqual(otherLegacy, undefined, 'Teacher A must NOT see Teacher B legacy course');
    console.log('✅ Scenario 12 Passed: Legacy courses strictly scoped to their author teacher.');
    passed++;
  } catch (err: any) {
    console.error('❌ Scenario 12 Failed:', err.message);
    failed++;
  }

  // Scenario 13: Manager Tenant Scoping: Manager (Inst 1) does NOT see foreign courses (Inst 2) or unscoped courses
  try {
    const req = createMockReq({
      user: { userId: MANAGER_ID, role: 'ADMIN', isPrimaryManager: true },
      tenantContext: { institutionId: 'inst-001' }
    });
    const res = createMockRes();
    await getCourses(req, res);

    assert.strictEqual(res.statusCode, 200);
    const courseList = res.body.data || res.body;
    const foreign = courseList.find((c: any) => c.institutionId === 'inst-002');
    assert.strictEqual(foreign, undefined, 'Inst 1 Manager must not see Inst 2 courses');
    const unscoped = courseList.find((c: any) => c.institutionId === null);
    assert.strictEqual(unscoped, undefined, 'Inst 1 Manager query strictly requires institutionId === inst-001');
    console.log('✅ Scenario 13 Passed: Manager course list strictly scoped to inst-001 without arbitrary unscoped exposure.');
    passed++;
  } catch (err: any) {
    console.error('❌ Scenario 13 Failed:', err.message);
    failed++;
  }

  // Scenario 14: Cross-Tenant Detail Access Guard: Teacher or Manager from Inst 1 accessing Inst 2 course rejected with 403 Forbidden
  try {
    const req = createMockReq({
      user: { userId: MANAGER_ID, role: 'ADMIN', isPrimaryManager: true },
      tenantContext: { institutionId: 'inst-001' },
      params: { id: COURSE_INST_2_ID }
    });
    const res = createMockRes();
    await getCourseDetails(req, res);

    assert.strictEqual(res.statusCode, 403, 'Cross-tenant course details access must return 403');
    console.log('✅ Scenario 14 Passed: Cross-tenant course detail access strictly rejected with 403 Forbidden.');
    passed++;
  } catch (err: any) {
    console.error('❌ Scenario 14 Failed:', err.message);
    failed++;
  }

  // Scenario 15: Cross-Tenant Course Creation Guard: Manager (Inst 1) creating course for Teacher C (Inst 2) rejected with 403
  try {
    const req = createMockReq({
      user: { userId: MANAGER_ID, role: 'PRIMARY_MANAGER', isPrimaryManager: true },
      tenantContext: { institutionId: 'inst-001' },
      body: {
        title: 'دورة غير مصرح بها لمعلم مؤسسة أخرى',
        category: 'الرياضيات',
        price: 100,
        academicLevel: 'SEC_1',
        teacherId: TEACHER_C_INST2_ID
      }
    });
    const res = createMockRes();
    await createCourse(req, res);

    assert.strictEqual(res.statusCode, 403, 'Manager creating course for teacher of another institution must return 403');
    console.log('✅ Scenario 15 Passed: Cross-tenant teacher course assignment rejected with 403 Forbidden.');
    passed++;
  } catch (err: any) {
    console.error('❌ Scenario 15 Failed:', err.message);
    failed++;
  }

  // Scenario 16: Teacher Branch Integrity: Teacher attempting to override branchId has server branch preserved
  try {
    const req = createMockReq({
      user: { userId: TEACHER_A_ID, role: 'TEACHER' },
      tenantContext: { institutionId: 'inst-001', branchId: 'branch-001' },
      body: {
        title: 'دورة تجربة حماية الفرع',
        category: 'الرياضيات',
        price: 150,
        academicLevel: 'SEC_2',
        branchId: '99999999-9999-4999-8999-999999999999' // Teacher tries to spoof branchId with valid UUID
      }
    });
    const res = createMockRes();
    await createCourse(req, res);

    assert.strictEqual(res.statusCode, 201);
    assert.strictEqual(res.body.branchId, 'branch-001', 'Teacher client-supplied branchId must be ignored in favor of server branch');
    console.log('✅ Scenario 16 Passed: Teacher branch integrity enforced — client cannot spoof branchId during creation.');
    passed++;
  } catch (err: any) {
    console.error('❌ Scenario 16 Failed:', err.message);
    failed++;
  }

  // Scenario 17: Cross-Tenant Video Access Guard: Foreign user (Inst 2) requesting video ticket for Inst 1 lesson rejected with 403
  try {
    const req = createMockReq({
      user: { userId: MANAGER_INST2_ID, role: 'PRIMARY_MANAGER', isPrimaryManager: true, institutionId: 'inst-002' },
      tenantContext: { institutionId: 'inst-002' },
      params: { id: LESSON_1_ID }
    });
    const res = createMockRes();
    await generateLessonVideoTicket(req, res);

    assert.strictEqual(res.statusCode, 403, 'Cross-tenant video ticket request must return 403');
    console.log('✅ Scenario 17 Passed: Cross-tenant video ticket access strictly blocked with 403 Forbidden.');
    passed++;
  } catch (err: any) {
    console.error('❌ Scenario 17 Failed:', err.message);
    failed++;
  }

  // Scenario 18: Lesson Listing Scoping (getLessons): Teacher A and Manager 1 only receive authorized lessons
  try {
    // Teacher A queries lessons
    const reqTeacher = createMockReq({
      user: { userId: TEACHER_A_ID, role: 'TEACHER' },
      tenantContext: { institutionId: 'inst-001' }
    });
    const resTeacher = createMockRes();
    await getLessons(reqTeacher, resTeacher);

    assert.strictEqual(resTeacher.statusCode, 200);
    const teacherLessons = resTeacher.body.data;
    assert(teacherLessons.some((l: any) => l.id === LESSON_1_ID), 'Teacher A must see Lesson 1');
    assert(!teacherLessons.some((l: any) => l.id === LESSON_INST_2_ID), 'Teacher A must NOT see Inst 2 lessons');

    // Manager 1 queries lessons
    const reqManager = createMockReq({
      user: { userId: MANAGER_ID, role: 'PRIMARY_MANAGER', isPrimaryManager: true },
      tenantContext: { institutionId: 'inst-001' }
    });
    const resManager = createMockRes();
    await getLessons(reqManager, resManager);

    assert.strictEqual(resManager.statusCode, 200);
    const managerLessons = resManager.body.data;
    assert(managerLessons.some((l: any) => l.id === LESSON_1_ID), 'Manager 1 must see Inst 1 lessons');
    assert(!managerLessons.some((l: any) => l.id === LESSON_INST_2_ID), 'Manager 1 must NOT see Inst 2 lessons');

    console.log('✅ Scenario 18 Passed: Lesson listing strictly scoped to authorized institution and creator.');
    passed++;
  } catch (err: any) {
    console.error('❌ Scenario 18 Failed:', err.message);
    failed++;
  }

  // Scenario 19: Quiz Submission Protection: Non-enrolled or foreign student rejected with 403
  try {
    quizzes.set(QUIZ_1_ID, {
      id: QUIZ_1_ID,
      lessonId: LESSON_1_ID,
      question: 'ما هي نهاية جا(س)/س عندما س تقترب من صفر؟',
      options: ['0', '1', 'غير معرف'],
      correctAnswer: '1'
    });

    const req = createMockReq({
      user: { userId: STUDENT_ID, role: 'ONLINE_STUDENT', institutionId: 'inst-001' },
      tenantContext: { institutionId: 'inst-001' },
      params: { id: LESSON_1_ID, quizId: QUIZ_1_ID },
      body: { answer: '1' }
    });
    const res = createMockRes();
    await submitLessonQuiz(req, res);

    assert.strictEqual(res.statusCode, 403, 'Non-enrolled student must be rejected with 403');
    console.log('✅ Scenario 19 Passed: Quiz submission rejected with 403 Forbidden for non-enrolled user.');
    passed++;
  } catch (err: any) {
    console.error('❌ Scenario 19 Failed:', err.message);
    failed++;
  }

  // Scenario 20: Video Ticket Lesson Scope Mismatch Defense
  try {
    // Generate valid ticket for Lesson 1
    const reqTicket = createMockReq({
      user: { userId: TEACHER_A_ID, role: 'TEACHER', institutionId: 'inst-001' },
      tenantContext: { institutionId: 'inst-001' },
      params: { id: LESSON_1_ID }
    });
    const resTicket = createMockRes();
    await generateLessonVideoTicket(reqTicket, resTicket);
    assert.strictEqual(resTicket.statusCode, 200);

    // Create a second lesson
    lessons.set(LESSON_2_ID, {
      id: LESSON_2_ID,
      title: 'الدرس الثاني: التفاضل الضمني',
      courseId: COURSE_1_ID,
      videoUrl: 'https://storage.ox-digital.internal/lessons/video2.mp4',
      createdAt: new Date(),
      updatedAt: new Date()
    });

    // Attempt to use Lesson 1's ticket to stream Lesson 2
    const reqStream = createMockReq({
      user: {
        userId: TEACHER_A_ID,
        lessonId: LESSON_1_ID, // Scoped to Lesson 1
        purpose: 'video-stream'
      },
      params: { id: LESSON_2_ID } // Requesting Lesson 2
    });
    const resStream = createMockRes();
    await streamLessonVideo(reqStream, resStream);

    assert.strictEqual(resStream.statusCode, 403, 'Ticket for Lesson 1 must be rejected when streaming Lesson 2');
    console.log('✅ Scenario 20 Passed: Video ticket lesson scope mismatch strictly rejected with 403 Forbidden.');
    passed++;
  } catch (err: any) {
    console.error('❌ Scenario 20 Failed:', err.message);
    failed++;
  }

  // Scenario 21: Course Enrollment Tenant Boundary: Student from Inst 1 attempting to enroll in Inst 2 course rejected with 403
  try {
    const req = createMockReq({
      user: { userId: STUDENT_ID, role: 'ONLINE_STUDENT', institutionId: 'inst-001' },
      tenantContext: { institutionId: 'inst-001' },
      params: { id: COURSE_INST_2_ID }
    });
    const res = createMockRes();
    await enrollCourse(req, res);

    assert.strictEqual(res.statusCode, 403, 'Cross-tenant course enrollment must return 403');
    console.log('✅ Scenario 21 Passed: Cross-tenant course enrollment rejected with 403 Forbidden.');
    passed++;
  } catch (err: any) {
    console.error('❌ Scenario 21 Failed:', err.message);
    failed++;
  }

  // Scenario 22: Non-owner Teacher B attempting to generate video ticket for Teacher A's lesson rejected with 403
  try {
    const req = createMockReq({
      user: { userId: TEACHER_B_ID, role: 'TEACHER', institutionId: 'inst-001' },
      tenantContext: { institutionId: 'inst-001' },
      params: { id: LESSON_1_ID }
    });
    const res = createMockRes();
    await generateLessonVideoTicket(req, res);

    assert.strictEqual(res.statusCode, 403, 'Non-owner teacher must be rejected from generating video ticket');
    console.log('✅ Scenario 22 Passed: Non-owner Teacher B rejected with 403 when requesting ticket for Teacher A lesson.');
    passed++;
  } catch (err: any) {
    console.error('❌ Scenario 22 Failed:', err.message);
    failed++;
  }

  // Scenario 23: Video streaming ticket cannot be used for standard API endpoints
  try {
    const req = createMockReq({
      headers: { authorization: `Bearer ${jwt.sign({ userId: TEACHER_A_ID, lessonId: LESSON_1_ID, purpose: 'video-stream' }, process.env.JWT_SECRET!)}` },
      originalUrl: '/api/courses',
      path: '/'
    });
    const res = createMockRes();
    let nextCalled = false;
    await verifyToken(req, res, () => { nextCalled = true; });

    assert.strictEqual(res.statusCode, 403, 'Video ticket on non-streaming API endpoint must return 403');
    assert.strictEqual(nextCalled, false, 'Next must not be called on rejected ticket');
    console.log('✅ Scenario 23 Passed: Video streaming ticket strictly rejected with 403 when used on standard API routes.');
    passed++;
  } catch (err: any) {
    console.error('❌ Scenario 23 Failed:', err.message);
    failed++;
  }

  // Scenario 24: Tampered signature on video ticket is rejected with 401 Unauthorized
  try {
    const forgedToken = jwt.sign({ userId: TEACHER_A_ID, lessonId: LESSON_1_ID, purpose: 'video-stream' }, 'wrong-secret-key');
    const req = createMockReq({
      headers: { authorization: `Bearer ${forgedToken}` },
      originalUrl: `/api/courses/lessons/${LESSON_1_ID}/stream`,
      path: `/lessons/${LESSON_1_ID}/stream`
    });
    const res = createMockRes();
    let nextCalled = false;
    await verifyToken(req, res, () => { nextCalled = true; });

    assert.strictEqual(res.statusCode, 401, 'Tampered token must return 401');
    assert.strictEqual(nextCalled, false);
    console.log('✅ Scenario 24 Passed: Tampered ticket signature rejected with 401 Unauthorized.');
    passed++;
  } catch (err: any) {
    console.error('❌ Scenario 24 Failed:', err.message);
    failed++;
  }

  // Scenario 25: Expired video ticket is rejected with 401 Unauthorized
  try {
    const expiredToken = jwt.sign(
      { userId: TEACHER_A_ID, lessonId: LESSON_1_ID, purpose: 'video-stream', iat: Math.floor(Date.now() / 1000) - 7200 },
      process.env.JWT_SECRET!,
      { expiresIn: '1s' }
    );
    const req = createMockReq({
      headers: { authorization: `Bearer ${expiredToken}` },
      originalUrl: `/api/courses/lessons/${LESSON_1_ID}/stream`,
      path: `/lessons/${LESSON_1_ID}/stream`
    });
    const res = createMockRes();
    let nextCalled = false;
    await verifyToken(req, res, () => { nextCalled = true; });

    assert.strictEqual(res.statusCode, 401, 'Expired token must return 401');
    assert.strictEqual(nextCalled, false);
    console.log('✅ Scenario 25 Passed: Expired video ticket rejected with 401 Unauthorized.');
    passed++;
  } catch (err: any) {
    console.error('❌ Scenario 25 Failed:', err.message);
    failed++;
  }

  // Scenario 26: Center student with financialAccessStatus: RESTRICTED blocked from video ticket
  try {
    const req = createMockReq({
      user: { userId: '77777777-0000-0000-0000-000000000007', role: 'CENTER_STUDENT', institutionId: 'inst-001' },
      tenantContext: { institutionId: 'inst-001' },
      params: { id: LESSON_1_ID }
    });
    const res = createMockRes();
    await generateLessonVideoTicket(req, res);

    assert.strictEqual(res.statusCode, 403, 'Financially restricted center student must be rejected with 403');
    console.log('✅ Scenario 26 Passed: Financially restricted student strictly blocked from video ticket with 403 Forbidden.');
    passed++;
  } catch (err: any) {
    console.error('❌ Scenario 26 Failed:', err.message);
    failed++;
  }

  // Scenario 27: Manager attempting to access legacy unscoped course (institutionId is null) rejected with 403
  try {
    const req = createMockReq({
      user: { userId: MANAGER_ID, role: 'PRIMARY_MANAGER', institutionId: 'inst-001', isPrimaryManager: true },
      tenantContext: { institutionId: 'inst-001' },
      params: { id: COURSE_LEGACY_A_ID } // Legacy unscoped course owned by Teacher A
    });
    const res = createMockRes();
    await getCourseDetails(req, res);

    assert.strictEqual(res.statusCode, 403, 'Arbitrary manager accessing legacy unscoped course must be rejected with 403');
    console.log('✅ Scenario 27 Passed: Arbitrary manager accessing legacy unscoped course strictly rejected with 403 Forbidden.');
    passed++;
  } catch (err: any) {
    console.error('❌ Scenario 27 Failed:', err.message);
    failed++;
  }

  // Scenario 28: Legacy email ('admin@edu.com') and synthetic SUPER_ADMIN / isPlatformSuperAdmin claims NEVER grant elevated or cross-tenant access
  try {
    const emailReq = createMockReq({
      user: {
        userId: '88888888-0000-0000-0000-000000000008',
        role: 'ONLINE_STUDENT',
        email: 'admin@edu.com',
        institutionId: 'inst-002'
      },
      tenantContext: { institutionId: 'inst-002', isPlatformSuperAdmin: true },
      params: { id: COURSE_1_ID }
    });
    const resEmailDetails = createMockRes();
    await getCourseDetails(emailReq, resEmailDetails);
    assert.strictEqual(resEmailDetails.statusCode, 403, 'Email admin@edu.com and isPlatformSuperAdmin claim must NEVER bypass inst-001 tenant isolation');

    const resEmailEnroll = createMockRes();
    await enrollCourse(emailReq, resEmailEnroll);
    assert.strictEqual(resEmailEnroll.statusCode, 403, 'Cross-tenant enrollment must fail with 403 even with admin@edu.com email');

    const enrolledViaSpoof = await checkUserEnrollment(
      {
        userId: '88888888-0000-0000-0000-000000000008',
        role: 'SUPER_ADMIN',
        email: 'admin@edu.com',
        isPlatformSuperAdmin: true,
        institutionId: 'inst-001'
      },
      COURSE_1_ID
    );
    assert.strictEqual(enrolledViaSpoof, false, 'checkUserEnrollment must verify authoritative DB role/institution and ignore admin@edu.com/SUPER_ADMIN');

    console.log('✅ Scenario 28 Passed: Legacy email admin@edu.com, SUPER_ADMIN, and isPlatformSuperAdmin claims rejected across course & enrollment checks.');
    passed++;
  } catch (err: any) {
    console.error('❌ Scenario 28 Failed:', err.message);
    failed++;
  }

  // Scenario 29: Unscoped legacy course and missing tenant fail closed even with synthetic SUPER_ADMIN / isPlatformSuperAdmin / admin@edu.com
  try {
    const legacyBypassReq = createMockReq({
      user: {
        userId: 'unscoped-admin-1',
        role: 'SUPER_ADMIN',
        email: 'admin@edu.com',
        isPlatformSuperAdmin: true
      },
      tenantContext: { institutionId: null, isPlatformSuperAdmin: true },
      params: { id: COURSE_LEGACY_A_ID },
      body: { title: 'محاولة تعديل غير مصرح بها' }
    });
    const resLegacyDetails = createMockRes();
    await getCourseDetails(legacyBypassReq, resLegacyDetails);
    assert.strictEqual(resLegacyDetails.statusCode, 403, 'Legacy course must fail closed for synthetic SUPER_ADMIN / admin@edu.com');

    const resLegacyUpdate = createMockRes();
    await updateCourse(legacyBypassReq, resLegacyUpdate);
    assert.strictEqual(resLegacyUpdate.statusCode, 403, 'Legacy course update must fail closed for synthetic SUPER_ADMIN / admin@edu.com');

    const resNoTenantList = createMockRes();
    await getCourses(legacyBypassReq, resNoTenantList);
    assert.strictEqual(resNoTenantList.statusCode, 200);
    assert.strictEqual((resNoTenantList.body.data || []).length, 0, 'Unscoped course list query must fail closed with 0 courses');

    const legacyEnrollCheck = await checkUserEnrollment(
      { userId: 'unscoped-admin-1', role: 'SUPER_ADMIN', email: 'admin@edu.com', isPlatformSuperAdmin: true },
      COURSE_LEGACY_A_ID
    );
    assert.strictEqual(legacyEnrollCheck, false, 'checkUserEnrollment must fail closed for unscoped course & synthetic claims');

    console.log('✅ Scenario 29 Passed: Unscoped legacy course and missing-tenant list fail closed against synthetic SUPER_ADMIN / admin@edu.com claims.');
    passed++;
  } catch (err: any) {
    console.error('❌ Scenario 29 Failed:', err.message);
    failed++;
  }

  console.log('===================================================================');
  console.log(`Final Result: ${passed} / ${passed + failed} Scenarios Passed`);
  console.log('===================================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Fatal Test Runner Error:', err);
  process.exit(1);
});
