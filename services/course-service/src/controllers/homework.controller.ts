import { Request, Response } from 'express';
import { db } from '../../../../packages/database/src/index.js';
import { AuthRequest } from '../middlewares/auth.middleware.js';
import { checkUserEnrollment } from '../utils/enrollment.js';
import { io } from '../socket.js';
import { sanitizeQuestionsForStudent, linkQuestionAssetsToAssessment } from './assessment.controller.js';
import { logger } from '@shared/utils';

/**
 * Builds the authoritative Prisma course scope for an authenticated student.
 * Fail-closed: always binds to an authoritative non-empty institutionId.
 */
export function buildStudentHomeworkWhere(studentId: string, institutionId?: string | null) {
  const safeInstitutionId =
    typeof institutionId === 'string' && institutionId.trim() ? institutionId.trim() : '__NO_TENANT_ACCESS__';
  return {
    course: {
      enrollments: {
        some: { studentId }
      },
      status: 'PUBLISHED',
      deletedAt: null,
      institutionId: safeInstitutionId
    }
  };
}

/**
 * Evaluates whether a homework item is genuinely actionable for the student:
 * - Course is published and active
 * - Not already submitted or completed (Submission or AssessmentAttempt)
 * - Within active availability window (openAt <= now, closeAt/deadline not expired)
 * - Not locked behind an unwatched lesson video
 */
export function isActionableStudentHomework(
  hw: any,
  completedAssessmentIds: Set<string>,
  now: Date = new Date()
): boolean {
  if (!hw || !hw.id) return false;
  if (hw.course && (hw.course.status !== 'PUBLISHED' || hw.course.deletedAt)) {
    return false;
  }
  if (Array.isArray(hw.submissions) && hw.submissions.length > 0) {
    return false;
  }
  if (completedAssessmentIds.has(hw.id)) {
    return false;
  }
  if (hw.openAt && new Date(hw.openAt) > now) {
    return false;
  }
  const effectiveCloseAt = hw.closeAt || hw.deadline;
  if (effectiveCloseAt && now > new Date(effectiveCloseAt)) {
    return false;
  }
  if (hw.lessonId) {
    const progress = hw.Lesson?.progress;
    if (!Array.isArray(progress) || progress.length === 0 || !progress[0]?.watched) {
      return false;
    }
  }
  return true;
}

export const getStudentPendingHomeworkCount = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId || (req.user as any)?.id;
    const requesterRole = (req.user?.role || '').toUpperCase();
    const rawInstitutionId = (req as any).tenantContext?.institutionId ?? (req.user as any)?.institutionId;
    const institutionId = typeof rawInstitutionId === 'string' ? rawInstitutionId.trim() : '';

    if (!userId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }
    if (!requesterRole.includes('STUDENT')) {
      return res.status(403).json({ message: 'Forbidden: Only students can access personal pending homework count' });
    }
    if (!institutionId) {
      return res.status(403).json({
        message: 'Forbidden: Student account requires an active institution context',
        code: 'TENANT_CONTEXT_MISSING'
      });
    }

    const whereClause = buildStudentHomeworkWhere(userId, institutionId);
    const homeworks = await db.homework.findMany({
      where: whereClause,
      select: {
        id: true,
        openAt: true,
        closeAt: true,
        deadline: true,
        lessonId: true,
        course: { select: { status: true, deletedAt: true } },
        submissions: { where: { studentId: userId }, select: { id: true } },
        Lesson: {
          select: {
            progress: {
              where: { studentId: userId },
              select: { watched: true }
            }
          }
        }
      }
    });

    const hwIds = homeworks.map((h: any) => h.id).filter(Boolean);
    const completedAssessmentIds = new Set<string>();
    if (hwIds.length > 0 && typeof (db as any).assessmentAttempt?.findMany === 'function') {
      const attempts = await (db as any).assessmentAttempt.findMany({
        where: {
          studentId: userId,
          assessmentId: { in: hwIds },
          status: { in: ['SUBMITTED', 'GRADED', 'TIME_EXPIRED'] }
        },
        select: { assessmentId: true }
      });
      if (Array.isArray(attempts)) {
        attempts.forEach((a: any) => {
          if (a?.assessmentId) completedAssessmentIds.add(a.assessmentId);
        });
      }
    }

    const now = new Date();
    const pendingCount = homeworks.filter((hw: any) =>
      isActionableStudentHomework(hw, completedAssessmentIds, now)
    ).length;

    return res.json({
      pendingCount,
      total: homeworks.length
    });
  } catch (error: any) {
    return res.status(500).json({ message: 'Error counting pending homeworks', error: error.message });
  }
};

export const getAllHomeworks = async (req: AuthRequest, res: Response) => {
  try {
    let whereClause: any = {};
    const requesterRole = (req.user?.role || '').toUpperCase();
    const requesterId = req.user?.userId || (req.user as any)?.id;
    if (requesterRole === 'TEACHER') {
      whereClause = { course: { teacherId: requesterId } };
    } else if (requesterRole.includes('STUDENT')) {
      if (!requesterId) {
        return res.status(401).json({ message: 'Unauthorized' });
      }
      const rawInstId = (req as any).tenantContext?.institutionId ?? (req.user as any)?.institutionId;
      const studentInstId = typeof rawInstId === 'string' ? rawInstId.trim() : '';
      if (!studentInstId) {
        return res.status(403).json({
          message: 'Forbidden: Student account requires an active institution context',
          code: 'TENANT_CONTEXT_MISSING'
        });
      }
      whereClause = buildStudentHomeworkWhere(requesterId, studentInstId);
    }

    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.max(1, parseInt(req.query.limit as string) || 10);
    const skip = (page - 1) * limit;

    const homeworks = await db.homework.findMany({
      where: whereClause,
      skip,
      take: limit,
      include: {
        _count: { select: { submissions: true } },
        course: { select: { title: true, status: true, deletedAt: true } },
        submissions: requesterRole.includes('STUDENT') ? { where: { studentId: requesterId } } : false,
        Lesson: requesterRole.includes('STUDENT') ? {
          select: {
            progress: {
              where: { studentId: requesterId }
            }
          }
        } : false
      },
      orderBy: { createdAt: 'desc' }
    });

    const completedAssessmentIds = new Set<string>();
    if (requesterRole.includes('STUDENT') && homeworks.length > 0 && typeof (db as any).assessmentAttempt?.findMany === 'function') {
      const hwIds = homeworks.map((h: any) => h.id).filter(Boolean);
      const attempts = await (db as any).assessmentAttempt.findMany({
        where: {
          studentId: requesterId,
          assessmentId: { in: hwIds },
          status: { in: ['SUBMITTED', 'GRADED', 'TIME_EXPIRED'] }
        },
        select: { assessmentId: true }
      });
      if (Array.isArray(attempts)) {
        attempts.forEach((a: any) => {
          if (a?.assessmentId) completedAssessmentIds.add(a.assessmentId);
        });
      }
    }

    const now = new Date();
    const mappedHomeworks = homeworks.map((hw: any) => {
      let status = 'available';
      let score = null;
      if ((hw.submissions && hw.submissions.length > 0) || completedAssessmentIds.has(hw.id)) {
        status = 'completed';
        score = hw.submissions?.[0]?.grade ?? null;
      } else if (requesterRole.includes('STUDENT')) {
        const notYetOpen = hw.openAt && new Date(hw.openAt) > now;
        const effectiveCloseAt = hw.closeAt || hw.deadline;
        const expired = effectiveCloseAt && now > new Date(effectiveCloseAt);
        if (notYetOpen || expired) {
          status = 'unavailable';
        }
      }
      let isLocked = false;
      if (hw.lessonId && hw.Lesson?.progress) {
        if (hw.Lesson.progress.length === 0 || !hw.Lesson.progress[0].watched) {
          isLocked = true;
        }
      }
      if (requesterRole !== 'ADMIN' && requesterRole !== 'TEACHER') {
        hw.questions = sanitizeQuestionsForStudent(hw.questions as any) as any;
      }
      const { submissions, Lesson, ...rest } = hw as any;
      return { ...rest, status, score, isLocked };
    });
    
    const total = await db.homework.count({ where: whereClause });
    
    res.json({
      data: mappedHomeworks,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    });
  } catch (error: any) {
    res.status(500).json({ message: 'Error fetching all homeworks', error: error.message });
  }
};

export const getHomeworksByCourse = async (req: AuthRequest, res: Response) => {
  try {
    const { courseId } = req.params;
    
    const isEnrolled = await checkUserEnrollment(req.user, courseId);
    if (!isEnrolled) return res.status(403).json({ message: 'Not enrolled in this course' });

    const homeworks = await db.homework.findMany({
      where: { courseId },
      include: {
        _count: { select: { submissions: true } }
      }
    });

    const requesterRole = (req.user?.role || '').toUpperCase();
    if (requesterRole !== 'ADMIN' && requesterRole !== 'TEACHER') {
      homeworks.forEach(hw => {
        hw.questions = sanitizeQuestionsForStudent(hw.questions as any) as any;
      });
    }

    res.json(homeworks);
  } catch (error: any) {
    res.status(500).json({ message: 'Error fetching homeworks', error: error.message });
  }
};

export const getHomeworkDetails = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const homework = await db.homework.findUnique({
      where: { id },
      include: { submissions: true }
    });
    if (!homework) return res.status(404).json({ message: 'Homework not found' });

    const isEnrolled = await checkUserEnrollment(req.user, homework.courseId);
    if (!isEnrolled) return res.status(403).json({ message: 'Not enrolled in this course' });

    if (homework.lessonId && req.user?.role?.toUpperCase().includes('STUDENT')) {
      const progress = await db.videoProgress.findUnique({
        where: {
          studentId_lessonId: {
            studentId: req.user.userId,
            lessonId: homework.lessonId
          }
        }
      });
      
      if (!progress || !progress.watched) {
        return res.status(403).json({ message: 'يجب إكمال مشاهدة فيديو الدرس قبل فتح الواجب', locked: true });
      }
    }

    const requesterRole = (req.user?.role || '').toUpperCase();
    if (requesterRole !== 'ADMIN' && requesterRole !== 'TEACHER') {
      homework.questions = sanitizeQuestionsForStudent(homework.questions as any) as any;
    }

    res.json(homework);
  } catch (error: any) {
    res.status(500).json({ message: 'Error fetching homework details', error: error.message });
  }
};

import { z } from 'zod';

const createHomeworkSchema = z.object({
  title: z.string().min(2),
  courseId: z.string().uuid(),
  questions: z.array(z.object({
    id: z.union([z.number(), z.string()]),
    text: z.string(),
    type: z.string(),
    options: z.array(z.string()).optional(),
    correct: z.any().optional(),
    imageUrl: z.string().optional().nullable(),
    imageStorageKey: z.string().optional().nullable(),
    imageAssetId: z.string().optional().nullable(),
    points: z.number().optional().nullable(),
    explanation: z.string().optional().nullable(),
    mathExpression: z.string().optional().nullable(),
    diagram: z.any().optional().nullable(),
    given: z.any().optional().nullable(),
    required: z.string().optional().nullable(),
    generationLogic: z.any().optional(),
    solutionSteps: z.any().optional(),
    solutionExplanation: z.string().optional(),
    validationStatus: z.string().optional()
  }).passthrough()).optional(),
  lessonId: z.string().uuid().optional().nullable(),
  type: z.enum(['NORMAL', 'VIDEO_DEPENDENT']).optional().default('NORMAL'),
  openAt: z.string().optional().nullable(),
  closeAt: z.string().optional().nullable()
});

export const createHomework = async (req: AuthRequest, res: Response) => {
  try {
    const requesterRole = (req.user?.role || '').toUpperCase();
    const requesterId = req.user?.userId;

    const validatedData = createHomeworkSchema.parse(req.body);
    const { title, courseId, questions, lessonId, type, openAt, closeAt } = validatedData;
    
    const course = await db.course.findUnique({ where: { id: courseId } });
    if (!course) return res.status(404).json({ message: 'Course not found' });

    if (requesterRole !== 'ADMIN') {
      if (course.teacherId !== requesterId) {
        return res.status(403).json({ message: 'Forbidden: You do not own this course' });
      }
    }

    const homework = await db.homework.create({
      data: {
        title,
        courseId,
        questions: (questions || []) as any,
        lessonId: lessonId ?? undefined,
        type: lessonId ? 'VIDEO_DEPENDENT' : type,
        openAt: openAt ? new Date(openAt) : null,
        closeAt: closeAt ? new Date(closeAt) : null,
        deadline: closeAt ? new Date(closeAt) : null
      }
    });
    
    // Mirror to unified Assessment table
    await db.assessment.create({
      data: {
        id: homework.id,
        title: homework.title,
        type: 'ASSIGNMENT',
        courseId: homework.courseId,
        lessonId: homework.lessonId,
        teacherId: course.teacherId,
        questions: homework.questions as any,
        openAt: homework.openAt,
        closeAt: homework.closeAt
      }
    });

    if (homework.questions && Array.isArray(homework.questions)) {
      await linkQuestionAssetsToAssessment(homework.id, homework.questions as any[]);
    }

    io.to(`course:${courseId}`).emit('homework_assigned', homework);

    // Notify enrolled students and their parents
    const { notifyCourseStudents } = await import('../utils/notification.helper.js');
    await notifyCourseStudents(courseId, 'واجب جديد', `تم نشر واجب جديد: ${title}`);

    res.status(201).json(homework);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ errors: error.errors });
    }
    res.status(500).json({ message: 'Error creating homework', error: error.message });
  }
};

const updateHomeworkSchema = z.object({
  title: z.string().min(2).optional(),
  questions: z.array(z.object({
    id: z.union([z.number(), z.string()]),
    text: z.string(),
    type: z.string(),
    options: z.array(z.string()).optional(),
    correct: z.any().optional(),
    imageUrl: z.string().optional().nullable(),
    imageStorageKey: z.string().optional().nullable(),
    imageAssetId: z.string().optional().nullable(),
    points: z.number().optional().nullable(),
    explanation: z.string().optional().nullable(),
    mathExpression: z.string().optional().nullable(),
    diagram: z.any().optional().nullable(),
    given: z.any().optional().nullable(),
    required: z.string().optional().nullable(),
    generationLogic: z.any().optional(),
    solutionSteps: z.any().optional(),
    solutionExplanation: z.string().optional(),
    validationStatus: z.string().optional()
  }).passthrough()).optional(),
  lessonId: z.string().uuid().optional().nullable(),
  type: z.enum(['NORMAL', 'VIDEO_DEPENDENT']).optional(),
  openAt: z.string().optional().nullable(),
  closeAt: z.string().optional().nullable()
});

export const updateHomework = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const requesterRole = (req.user?.role || '').toUpperCase();
    const requesterId = req.user?.userId;

    const validatedData = updateHomeworkSchema.parse(req.body);
    const { title, questions, lessonId, type, openAt, closeAt } = validatedData;
    
    const homework = await db.homework.findUnique({ where: { id } });
    if (!homework) return res.status(404).json({ message: 'Homework not found' });

    if (requesterRole !== 'ADMIN') {
      const course = await db.course.findUnique({ where: { id: homework.courseId } });
      if (!course) return res.status(404).json({ message: 'Course not found' });
      if (course.teacherId !== requesterId) {
        return res.status(403).json({ message: 'Forbidden: You do not own this course' });
      }
    }

    const updatedHomework = await db.homework.update({
      where: { id },
      data: {
        ...(title && { title }),
        ...(questions && { questions: questions as any }),
        ...(lessonId !== undefined && { lessonId: lessonId ?? undefined }),
        ...(type !== undefined && { type }),
        ...(openAt !== undefined && { openAt: openAt ? new Date(openAt) : null }),
        ...(closeAt !== undefined && { 
           closeAt: closeAt ? new Date(closeAt) : null, 
           deadline: closeAt ? new Date(closeAt) : null 
        })
      }
    });

    // Mirror to unified Assessment table
    try {
      await db.assessment.update({
        where: { id },
        data: {
          ...(title && { title }),
          ...(lessonId !== undefined && { lessonId: lessonId ?? undefined }),
          ...(questions && { questions: questions as any }),
          ...(openAt !== undefined && { openAt: openAt ? new Date(openAt) : null }),
          ...(closeAt !== undefined && { closeAt: closeAt ? new Date(closeAt) : null })
        }
      });
    } catch (err) {
      // Ignore if it doesn't exist in Assessment yet for some reason
    }

    if (updatedHomework.questions && Array.isArray(updatedHomework.questions)) {
      await linkQuestionAssetsToAssessment(id, updatedHomework.questions as any[]);
    }

    res.json(updatedHomework);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ errors: error.errors });
    }
    res.status(500).json({ message: 'Error updating homework', error: error.message });
  }
};

/**
 * Emits real-time homework submission notifications strictly to authorized scoped rooms:
 * 1. Owning teacher private room: `teacher:${teacherId}`
 * 2. Scoped institution admin room: `institution:${institutionId}:admin`
 * 3. Scoped branch admin room: `branch:${branchId}:admin` (only when institutionId is present)
 *
 * SECURITY MANDATE:
 * - Legacy global `io.to('admin')` fallback is completely removed.
 * - No unpartitioned, wildcard, or global administrator broadcasts are permitted.
 * - If neither teacherId nor institutionId is present, the event is safely logged as undeliverable
 *   without exposing student answers, grades, or personal details.
 */
export function emitHomeworkSubmissionNotification(
  ioInstance: any,
  course: {
    id?: string;
    teacherId?: string | null;
    institutionId?: string | null;
    branchId?: string | null;
    branch?: { institutionId?: string | null } | null;
  } | null | undefined,
  submission: any,
  courseId?: string
): { delivered: boolean; targetedRooms: string[] } {
  const targetedRooms: string[] = [];

  if (!ioInstance) {
    return { delivered: false, targetedRooms };
  }

  // 1. Direct notification to owning teacher (legacy or institution-backed)
  if (course?.teacherId) {
    const teacherRoom = `teacher:${course.teacherId}`;
    ioInstance.to(teacherRoom).emit('homework_submitted', submission);
    targetedRooms.push(teacherRoom);
  }

  // 2. Multi-tenant scoped notification to institution & branch admins
  if (course?.institutionId) {
    const instRoom = `institution:${course.institutionId}:admin`;
    ioInstance.to(instRoom).emit('homework_submitted', submission);
    targetedRooms.push(instRoom);

    // Strict Fail-Closed Branch Notification:
    // Emit to branch:${branchId}:admin ONLY IF:
    // - course.institutionId is present
    // - course.branchId is present
    // - branch relation was loaded
    // - course.branch.institutionId is present
    // - course.branch.institutionId === course.institutionId
    if (course.branchId) {
      if (
        course.branch &&
        course.branch.institutionId &&
        course.branch.institutionId === course.institutionId
      ) {
        const branchRoom = `branch:${course.branchId}:admin`;
        ioInstance.to(branchRoom).emit('homework_submitted', submission);
        targetedRooms.push(branchRoom);
      } else {
        const safeCourseId = course.id || courseId || 'unknown';
        const safeBranchId = course.branchId;
        const reason = !course.branch
          ? 'branch relation not loaded or missing'
          : !course.branch.institutionId
          ? 'branch lacks institutionId'
          : 'branch institutionId does not match course institutionId';
        logger.warn(
          `[Homework] Branch notification withheld for course ${safeCourseId}, branch ${safeBranchId}: ${reason}.`
        );
      }
    }
  }

  const delivered = targetedRooms.length > 0;

  // 3. Safe logging for orphaned courses (no teacherId and no institutionId)
  if (!delivered) {
    const safeCourseId = course?.id || courseId || 'unknown';
    logger.warn(`[Homework] Real-time submission notification undeliverable: course ${safeCourseId} lacks both teacherId and institutionId.`);
  }

  return { delivered, targetedRooms };
}

export const submitHomework = async (req: AuthRequest, res: Response) => {
  try {
    const { id: homeworkId } = req.params;
    const userId = req.user?.userId;
    const { answers, grade: clientGrade, url } = req.body;

    if (!userId) {
      return res.status(401).json({ message: 'User unauthorized' });
    }

    // Load homework and correct answers from database
    const homework = await db.homework.findUnique({
      where: { id: homeworkId },
      include: {
        course: {
          select: {
            id: true,
            teacherId: true,
            institutionId: true,
            branchId: true,
            branch: {
              select: {
                institutionId: true
              }
            }
          }
        }
      }
    });
    if (!homework) return res.status(404).json({ message: 'Homework not found' });

    const isEnrolled = await checkUserEnrollment(req.user, homework.courseId);
    if (!isEnrolled) return res.status(403).json({ message: 'Not enrolled in this course' });

    const now = new Date();
    const effectiveCloseAt = homework.closeAt || homework.deadline;
    if (effectiveCloseAt && now > effectiveCloseAt) {
      if (now.getTime() - effectiveCloseAt.getTime() > 120000) { // 2 minute grace period
        return res.status(403).json({ message: 'انتهى موعد تسليم الواجب', code: 'ASSESSMENT_CLOSED' });
      }
    }

    const existingSubmission = await db.submission.findFirst({
      where: { homeworkId, studentId: userId }
    });
    if (existingSubmission) {
      return res.status(400).json({ message: 'لقد قمت بتسليم هذا الواجب مسبقاً' });
    }

    let calculatedGrade = 0;
    const questions = Array.isArray(homework.questions) ? homework.questions : [];
    
    if (questions.length > 0 && Array.isArray(answers)) {
      let correctCount = 0;
      for (const ans of answers) {
        const q: any = questions.find((q: any) => q.id === ans.questionId);
        if (q && q.correct !== undefined && ans.selectedOption === q.correct) {
          correctCount++;
        }
      }
      calculatedGrade = (correctCount / questions.length) * 100;
    }

    const gradeToSave = questions.length > 0 ? calculatedGrade : (clientGrade || 0);

    const submission = await db.submission.create({
      data: {
        studentId: userId,
        homeworkId,
        grade: gradeToSave,
        url: url || null,
        answers: answers || []
      }
    });

    // Notify teacher of submission
    const { notifyTeacher } = await import('../utils/notification.helper.js');
    await notifyTeacher(homework.courseId, 'تسليم واجب', `قام الطالب بتسليم واجب: ${homework.title}`);
    
    // The previous implementation sent a notification to the student, we'll keep that but also we could notify parent. 
    // Wait, the Student sees the score instantly, notifying the Parent of the score is better!
    const student = await db.user.findUnique({ where: { id: userId } });
    if (student?.parentId) {
      await db.notification.create({
        data: {
          userId: student.parentId,
          title: 'إشعار لولي الأمر: تم تصحيح الواجب',
          message: `تم تقييم أداء طالبك في ${homework.title} وحصل على ${calculatedGrade || clientGrade || 0}%`,
          type: 'success'
        }
      });
    }

    // Keep student notification
    await db.notification.create({
      data: {
        userId: userId,
        title: 'تم تصحيح الواجب',
        message: `تم تقييم أدائك في ${homework.title} وحصلت على ${calculatedGrade || clientGrade || 0}%`,
        type: 'success'
      }
    });
    
    // Emit exclusively to the course's authorized teacher and scoped institution admin rooms
    // (Prevents leaking student submission data across institutions, branches, or unrelated teachers)
    emitHomeworkSubmissionNotification(io, homework.course, submission, homework.courseId);
    
    res.status(201).json({ ...submission, score: calculatedGrade });
  } catch (error: any) {
    res.status(500).json({ message: 'Error submitting homework', error: error.message });
  }
};

export const deleteHomework = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const requesterRole = (req.user?.role || '').toUpperCase();
    const requesterId = req.user?.userId;

    const homework = await db.homework.findUnique({
      where: { id },
      include: { course: true }
    });

    if (!homework) {
      return res.status(404).json({ message: 'Homework not found' });
    }

    if (requesterRole !== 'ADMIN' && homework.course.teacherId !== requesterId) {
      return res.status(403).json({ message: 'Insufficient permissions to delete this homework' });
    }

    await db.homework.delete({ where: { id } });
    res.json({ message: 'Deleted successfully' });
  } catch (error: any) {
    res.status(500).json({ message: 'Error deleting homework', error: error.message });
  }
};

export const getStudentSubmission = async (req: AuthRequest, res: Response) => {
  try {
    const { id: homeworkId } = req.params;
    const userId = req.user?.userId;
    
    if (!userId) return res.status(401).json({ message: 'Unauthorized' });

    const submission = await db.submission.findFirst({
      where: { homeworkId, studentId: userId },
      orderBy: { createdAt: 'desc' }
    });
    
    // Some frontend components might expect just the object, others `{ submission: object }`
    // Based on common patterns in this app, returning the object directly or null is safest.
    res.json(submission || null);
  } catch (error: any) {
    res.status(500).json({ message: 'Error fetching submission', error: error.message });
  }
};

export const addQuestion = async (req: AuthRequest, res: Response) => {
  res.json({ message: 'Stub for addQuestion' });
};
