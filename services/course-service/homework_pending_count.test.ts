/**
 * OX-DIGITAL Education — Student Pending Homework Count & Status Contract Suite (Mock DB)
 *
 * Covers Phase B requirements:
 * 1. Unsubmitted actionable homework in published enrolled course -> counted.
 * 2. Submitted homework (Submission record) -> excluded.
 * 3. Completed homework (AssessmentAttempt SUBMITTED/GRADED/TIME_EXPIRED) -> excluded.
 * 4. Draft/deleted course or unavailable/expired/future-openAt homework -> excluded.
 * 5. Locked homework (lessonId present without watched progress) -> excluded.
 * 6. Homework outside student's enrollment or belonging to foreign institution -> excluded.
 * 7. More than 10 actionable items (> default limit=10) -> full exact count returned without truncation.
 * 8. Center (CENTER_STUDENT) and Online (ONLINE_STUDENT) student consistency.
 * 9. Cross-student query tampering ignored & non-student roles denied with 403; unauthenticated -> 401.
 * 10. getAllHomeworks consistency for student status mapping ('available', 'completed', 'unavailable').
 */

process.env.DATABASE_URL = 'postgresql://ox_digital_dev:ox_digital_dev@127.0.0.1:5433/ox_digital_dev_test?schema=public';
process.env.JWT_SECRET = 'test-jwt-secret-ox-digital-test-key-32chars';

const INST_1 = '11111111-1111-4111-8111-000000000001';
const INST_2 = '22222222-2222-4222-8222-000000000002';

const STUDENT_CENTER_1 = 'stu-center-1';
const STUDENT_ONLINE_1 = 'stu-online-1';
const STUDENT_OTHER = 'stu-other-2';

const COURSES = new Map<string, any>([
  ['c-pub-1', { id: 'c-pub-1', institutionId: INST_1, status: 'PUBLISHED', deletedAt: null, enrollments: [STUDENT_CENTER_1, STUDENT_ONLINE_1] }],
  ['c-draft', { id: 'c-draft', institutionId: INST_1, status: 'DRAFT', deletedAt: null, enrollments: [STUDENT_CENTER_1, STUDENT_ONLINE_1] }],
  ['c-deleted', { id: 'c-deleted', institutionId: INST_1, status: 'PUBLISHED', deletedAt: new Date(), enrollments: [STUDENT_CENTER_1] }],
  ['c-unlisted', { id: 'c-unlisted', institutionId: INST_1, status: 'PUBLISHED', deletedAt: null, enrollments: [STUDENT_OTHER] }],
  ['c-foreign', { id: 'c-foreign', institutionId: INST_2, status: 'PUBLISHED', deletedAt: null, enrollments: [STUDENT_CENTER_1] }],
]);

const now = Date.now();
const PAST = new Date(now - 3600_000);
const FUTURE = new Date(now + 86400_000);

// 15 actionable homeworks + 1 submitted + 1 assessment-completed + 1 locked + 1 draft-course + 1 future + 1 expired + 1 unenrolled + 1 foreign
const HOMEWORKS: any[] = [];
for (let i = 1; i <= 15; i++) {
  HOMEWORKS.push({
    id: `hw-act-${i}`,
    title: `Actionable HW ${i}`,
    courseId: 'c-pub-1',
    openAt: PAST,
    closeAt: FUTURE,
    deadline: FUTURE,
    lessonId: i === 15 ? 'lesson-watched' : null,
    createdAt: new Date(now - i * 1000),
    questions: []
  });
}
HOMEWORKS.push(
  { id: 'hw-submitted', title: 'Submitted HW', courseId: 'c-pub-1', openAt: PAST, closeAt: FUTURE, deadline: FUTURE, lessonId: null, createdAt: new Date(), questions: [] },
  { id: 'hw-attempt-done', title: 'Attempt Graded HW', courseId: 'c-pub-1', openAt: PAST, closeAt: FUTURE, deadline: FUTURE, lessonId: null, createdAt: new Date(), questions: [] },
  { id: 'hw-locked', title: 'Locked Video HW', courseId: 'c-pub-1', openAt: PAST, closeAt: FUTURE, deadline: FUTURE, lessonId: 'lesson-unwatched', createdAt: new Date(), questions: [] },
  { id: 'hw-draft-course', title: 'Draft Course HW', courseId: 'c-draft', openAt: PAST, closeAt: FUTURE, deadline: FUTURE, lessonId: null, createdAt: new Date(), questions: [] },
  { id: 'hw-deleted-course', title: 'Deleted Course HW', courseId: 'c-deleted', openAt: PAST, closeAt: FUTURE, deadline: FUTURE, lessonId: null, createdAt: new Date(), questions: [] },
  { id: 'hw-future', title: 'Future OpenAt HW', courseId: 'c-pub-1', openAt: FUTURE, closeAt: new Date(now + 172800_000), deadline: null, lessonId: null, createdAt: new Date(), questions: [] },
  { id: 'hw-expired', title: 'Expired HW', courseId: 'c-pub-1', openAt: new Date(now - 7200_000), closeAt: PAST, deadline: PAST, lessonId: null, createdAt: new Date(), questions: [] },
  { id: 'hw-not-enrolled', title: 'Other Student HW', courseId: 'c-unlisted', openAt: PAST, closeAt: FUTURE, deadline: FUTURE, lessonId: null, createdAt: new Date(), questions: [] },
  { id: 'hw-foreign-inst', title: 'Foreign Inst HW', courseId: 'c-foreign', openAt: PAST, closeAt: FUTURE, deadline: FUTURE, lessonId: null, createdAt: new Date(), questions: [] }
);

const SUBMISSIONS = [
  { id: 'sub-1', homeworkId: 'hw-submitted', studentId: STUDENT_CENTER_1, grade: 90 },
  { id: 'sub-2', homeworkId: 'hw-submitted', studentId: STUDENT_ONLINE_1, grade: 95 },
];

const ATTEMPTS = [
  { assessmentId: 'hw-attempt-done', studentId: STUDENT_CENTER_1, status: 'GRADED' },
  { assessmentId: 'hw-attempt-done', studentId: STUDENT_ONLINE_1, status: 'SUBMITTED' },
  { assessmentId: 'hw-act-1', studentId: STUDENT_CENTER_1, status: 'STARTED' }, // In progress, NOT completed
];

const PROGRESS = [
  { lessonId: 'lesson-watched', studentId: STUDENT_CENTER_1, watched: true },
  { lessonId: 'lesson-watched', studentId: STUDENT_ONLINE_1, watched: true },
  { lessonId: 'lesson-unwatched', studentId: STUDENT_CENTER_1, watched: false },
];

function matchesStudentCourseWhere(hw: any, where: any): boolean {
  const course = COURSES.get(hw.courseId);
  if (!course) return false;
  const cf = where?.course;
  if (!cf) return true;
  if (cf.status && course.status !== cf.status) return false;
  if (cf.deletedAt === null && course.deletedAt !== null) return false;
  if (cf.institutionId && course.institutionId !== cf.institutionId) return false;
  if (cf.enrollments?.some?.studentId) {
    if (!course.enrollments.includes(cf.enrollments.some.studentId)) return false;
  }
  return true;
}

const mockDb: any = {
  homework: {
    findMany: async ({ where, skip = 0, take, include, select }: any) => {
      const studentId = where?.course?.enrollments?.some?.studentId;
      let list = HOMEWORKS.filter((hw) => matchesStudentCourseWhere(hw, where));
      if (typeof take === 'number') {
        list = list.slice(skip, skip + take);
      }
      return list.map((hw) => {
        const course = COURSES.get(hw.courseId);
        const subs = studentId
          ? SUBMISSIONS.filter((s) => s.homeworkId === hw.id && s.studentId === studentId)
          : [];
        const prog = studentId && hw.lessonId
          ? PROGRESS.filter((p) => p.lessonId === hw.lessonId && p.studentId === studentId)
          : [];
        const out: any = { ...hw };
        if (include?.course || select?.course) {
          out.course = { title: course.title, status: course.status, deletedAt: course.deletedAt };
        }
        if (include?.submissions || select?.submissions) {
          out.submissions = subs;
        }
        if (include?.Lesson || select?.Lesson) {
          out.Lesson = hw.lessonId ? { progress: prog } : null;
        }
        return out;
      });
    },
    count: async ({ where }: any) => {
      return HOMEWORKS.filter((hw) => matchesStudentCourseWhere(hw, where)).length;
    }
  },
  assessmentAttempt: {
    findMany: async ({ where }: any) => {
      return ATTEMPTS.filter((a) => {
        if (where.studentId && a.studentId !== where.studentId) return false;
        if (where.assessmentId?.in && !where.assessmentId.in.includes(a.assessmentId)) return false;
        if (where.status?.in && !where.status.in.includes(a.status)) return false;
        return true;
      });
    }
  }
};

(globalThis as any).prismaGlobal = mockDb;

import assert from 'assert';
import {
  getStudentPendingHomeworkCount,
  getAllHomeworks
} from './src/controllers/homework.controller.js';

function createMockRes() {
  const res: any = {
    statusCode: 200,
    body: null,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(data: any) {
      this.body = data;
      return this;
    }
  };
  return res;
}

async function runSuite() {
  console.log('=== RUNNING BACKEND STUDENT PENDING HOMEWORK COUNT TEST SUITE ===\n');
  let passed = 0;
  let failed = 0;

  const runTest = async (desc: string, fn: () => Promise<void>) => {
    try {
      await fn();
      console.log(`PASS: ${desc}`);
      passed++;
    } catch (err: any) {
      console.error(`FAIL: ${desc} -> ${err.message}`);
      failed++;
    }
  };

  await runTest('1. Unauthenticated request is rejected with 401', async () => {
    const req: any = { user: undefined, query: {} };
    const res = createMockRes();
    await getStudentPendingHomeworkCount(req, res);
    assert.strictEqual(res.statusCode, 401);
  });

  await runTest('2. Non-student roles (TEACHER / PARENT / ACCOUNTANT) are denied with 403', async () => {
    for (const role of ['TEACHER', 'PARENT', 'ACCOUNTANT']) {
      const req: any = { user: { userId: 'u-1', role, institutionId: INST_1 }, query: {} };
      const res = createMockRes();
      await getStudentPendingHomeworkCount(req, res);
      assert.strictEqual(res.statusCode, 403, `Role ${role} must get 403`);
    }
  });

  await runTest('3. Center student gets exact count (15 actionable, > limit 10) excluding submitted, completed, draft, deleted, locked, expired, future, unenrolled, and foreign', async () => {
    const req: any = {
      user: { userId: STUDENT_CENTER_1, role: 'CENTER_STUDENT', institutionId: INST_1 },
      query: { studentId: STUDENT_OTHER } // attempt to tamper via query must be ignored
    };
    const res = createMockRes();
    await getStudentPendingHomeworkCount(req, res);
    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.body.pendingCount, 15, 'Must count all 15 actionable homeworks without limit=10 truncation');
  });

  await runTest('4. Online student receives identical authoritative actionable semantics (15 actionable)', async () => {
    const req: any = {
      user: { userId: STUDENT_ONLINE_1, role: 'ONLINE_STUDENT', institutionId: INST_1 },
      query: {}
    };
    const res = createMockRes();
    await getStudentPendingHomeworkCount(req, res);
    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.body.pendingCount, 15);
  });

  await runTest('5. Other student outside c-pub-1 enrollment gets 0 for c-pub-1 and sees only own enrolled homework (0 if none in c-unlisted)', async () => {
    const req: any = {
      user: { userId: STUDENT_OTHER, role: 'ONLINE_STUDENT', institutionId: INST_1 },
      query: {}
    };
    const res = createMockRes();
    await getStudentPendingHomeworkCount(req, res);
    assert.strictEqual(res.statusCode, 200);
    // hw-not-enrolled is in c-unlisted (PUBLISHED, openAt in past, closeAt in future, not locked, not submitted) -> 1
    assert.strictEqual(res.body.pendingCount, 1);
  });

  await runTest('6. getAllHomeworks uses consistent student status mapping (available, completed, unavailable) and excludes draft/foreign courses', async () => {
    const req: any = {
      user: { userId: STUDENT_CENTER_1, role: 'CENTER_STUDENT', institutionId: INST_1 },
      query: { limit: '50' }
    };
    const res = createMockRes();
    await getAllHomeworks(req, res);
    assert.strictEqual(res.statusCode, 200);
    const items: any[] = res.body.data;
    assert.strictEqual(items.some((h) => h.id === 'hw-draft-course'), false, 'Draft course excluded');
    assert.strictEqual(items.some((h) => h.id === 'hw-deleted-course'), false, 'Deleted course excluded');
    assert.strictEqual(items.some((h) => h.id === 'hw-foreign-inst'), false, 'Foreign institution excluded');

    const subItem = items.find((h) => h.id === 'hw-submitted');
    const attemptDoneItem = items.find((h) => h.id === 'hw-attempt-done');
    const lockedItem = items.find((h) => h.id === 'hw-locked');
    const futureItem = items.find((h) => h.id === 'hw-future');
    const expiredItem = items.find((h) => h.id === 'hw-expired');
    const activeItem = items.find((h) => h.id === 'hw-act-1');

    assert.strictEqual(subItem?.status, 'completed');
    assert.strictEqual(attemptDoneItem?.status, 'completed');
    assert.strictEqual(lockedItem?.isLocked, true);
    assert.strictEqual(futureItem?.status, 'unavailable');
    assert.strictEqual(expiredItem?.status, 'unavailable');
    assert.strictEqual(activeItem?.status, 'available');
    assert.strictEqual(activeItem?.isLocked, false);
  });

  await runTest('7. Missing institutionId (undefined) fails closed with 403 on both count and list even with query tampering', async () => {
    const reqCount: any = {
      user: { userId: STUDENT_CENTER_1, role: 'CENTER_STUDENT' },
      query: { institutionId: INST_1 }
    };
    const resCount = createMockRes();
    await getStudentPendingHomeworkCount(reqCount, resCount);
    assert.strictEqual(resCount.statusCode, 403);
    assert.strictEqual(resCount.body.code, 'TENANT_CONTEXT_MISSING');

    const reqList: any = {
      user: { userId: STUDENT_ONLINE_1, role: 'ONLINE_STUDENT' },
      query: { institutionId: INST_1 }
    };
    const resList = createMockRes();
    await getAllHomeworks(reqList, resList);
    assert.strictEqual(resList.statusCode, 403);
    assert.strictEqual(resList.body.code, 'TENANT_CONTEXT_MISSING');
  });

  await runTest('8. Null or blank institutionId fails closed with 403 without widening homework query', async () => {
    for (const badInst of [null, '', '   ']) {
      const req: any = {
        user: { userId: STUDENT_ONLINE_1, role: 'ONLINE_STUDENT', institutionId: badInst },
        query: {}
      };
      const res = createMockRes();
      await getStudentPendingHomeworkCount(req, res);
      assert.strictEqual(res.statusCode, 403);
      assert.strictEqual(res.body.code, 'TENANT_CONTEXT_MISSING');
    }
  });

  await runTest('9. Database exception returns safe 500 error without misleading zero pendingCount', async () => {
    const originalFindMany = mockDb.homework.findMany;
    mockDb.homework.findMany = async () => {
      throw new Error('Simulated connection drop');
    };
    try {
      const req: any = {
        user: { userId: STUDENT_CENTER_1, role: 'CENTER_STUDENT', institutionId: INST_1 },
        query: {}
      };
      const res = createMockRes();
      await getStudentPendingHomeworkCount(req, res);
      assert.strictEqual(res.statusCode, 500);
      assert.strictEqual(res.body?.pendingCount, undefined);
    } finally {
      mockDb.homework.findMany = originalFindMany;
    }
  });

  console.log(`\nHOMEWORK COUNT RESULTS: ${passed} PASSED, ${failed} FAILED`);
  if (failed > 0) process.exit(1);
}

runSuite().catch((err) => {
  console.error('Unhandled suite error:', err);
  process.exit(1);
});

