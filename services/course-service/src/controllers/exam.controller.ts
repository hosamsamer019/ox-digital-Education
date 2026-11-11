import { Request, Response } from 'express';
import { db } from '../../../../packages/database/src/index.js';
import { AuthRequest } from '../middlewares/auth.middleware.js';
import { checkUserEnrollment } from '../utils/enrollment.js';
import { io } from '../socket.js';
import { normalizeExamQuestions } from '../utils/question.helper.js';
import { sanitizeQuestionsForStudent, generateExamAccessCode, linkQuestionAssetsToAssessment } from './assessment.controller.js';

export const getAllExams = async (req: AuthRequest, res: Response) => {
  try {
    let whereClause: any = {};
    const requesterRole = (req.user?.role || '').toUpperCase();
    if (requesterRole === 'TEACHER') {
      whereClause = { course: { teacherId: req.user?.userId } };
    } else if (requesterRole.includes('STUDENT')) {
      whereClause = {
        course: {
          enrollments: {
            some: { studentId: req.user?.userId }
          }
        }
      };
    }

    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 10));
    const skip = (page - 1) * limit;

    const exams = await db.exam.findMany({
      where: whereClause,
      skip,
      take: limit,
      include: {
        _count: { select: { attempts: true } },
        course: { select: { title: true } },
        attempts: requesterRole.includes('STUDENT') ? { where: { studentId: req.user?.userId } } : false
      },
      orderBy: { createdAt: 'desc' }
    });

    // Fetch corresponding assessments to include allowExternalStudents, examAccessCode, allowedIps
    const examIds = exams.map(e => e.id);
    const assessments = await db.assessment.findMany({
      where: { id: { in: examIds } },
      select: { id: true, allowExternalStudents: true, examAccessCode: true, allowedIps: true }
    });
    const assessmentMap = new Map(assessments.map(a => [a.id, a]));
    
    const mappedExams = exams.map(exam => {
      let status = 'available';
      let score = null;
      if (exam.attempts && exam.attempts.length > 0) {
        status = 'completed';
        score = exam.attempts[0].score;
      }
      if (requesterRole !== 'ADMIN' && requesterRole !== 'TEACHER') {
        exam.questions = sanitizeQuestionsForStudent(exam.questions as any) as any;
      }
      const { attempts, ...rest } = exam as any;
      const assessData = assessmentMap.get(exam.id);
      return {
        ...rest,
        status,
        score,
        allowExternalStudents: assessData?.allowExternalStudents ?? false,
        examAccessCode: assessData?.examAccessCode ?? null,
        allowedIps: assessData?.allowedIps ?? null
      };
    });
    
    const total = await db.exam.count({ where: whereClause });
    
    res.json({
      data: mappedExams,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    });
  } catch (error: any) {
    res.status(500).json({ message: 'Error fetching exams', error: error.message });
  }
};

export const getExamsByCourse = async (req: AuthRequest, res: Response) => {
  try {
    const { courseId } = req.params;
    
    const isEnrolled = await checkUserEnrollment(req.user, courseId);
    if (!isEnrolled) return res.status(403).json({ message: 'Not enrolled in this course' });

    const exams = await db.exam.findMany({
      where: { courseId },
      include: {
        _count: { select: { attempts: true } }
      }
    });
    res.json(exams);
  } catch (error: any) {
    res.status(500).json({ message: 'Error fetching exams', error: error.message });
  }
};

export const getExamDetails = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const exam = await db.exam.findUnique({
      where: { id },
      include: { course: { select: { id: true, teacherId: true } } }
    });
    if (!exam) return res.status(404).json({ message: 'Exam not found' });

    const assessData = await db.assessment.findUnique({
      where: { id },
      select: { allowExternalStudents: true, examAccessCode: true, allowedIps: true }
    });

    const requesterRole = (req.user?.role || '').toUpperCase();
    const requesterId = req.user?.userId;

    // Authorization & Enrollment checks
    if (requesterRole === 'TEACHER') {
      if (exam.course && exam.course.teacherId !== requesterId) {
        return res.status(403).json({ message: 'Forbidden: You do not own this course or exam.' });
      }
    } else if (requesterRole !== 'ADMIN') {
      // Student, Parent, Guest, External Student
      if (exam.courseId) {
        const isEnrolled = await checkUserEnrollment(req.user, exam.courseId);
        const isAllowedGuest = assessData?.allowExternalStudents && (req.user?.isGuest || req.user?.isExternalStudent);
        if (!isEnrolled && !isAllowedGuest) {
          return res.status(403).json({ message: 'Not enrolled in this course.' });
        }
      }
    }

    // Fetch attempts scoped strictly by role
    let attempts: any[] = [];
    if (requesterRole === 'ADMIN' || requesterRole === 'TEACHER') {
      attempts = await db.assessmentAttempt.findMany({
        where: { assessmentId: id },
        include: {
          student: { select: { name: true, email: true } },
        }
      });
    } else if (requesterRole === 'PARENT') {
      attempts = await db.assessmentAttempt.findMany({
        where: { assessmentId: id, student: { parentId: requesterId } },
        include: {
          student: { select: { name: true, email: true } },
        }
      });
    } else {
      // Student: only own attempts
      attempts = await db.assessmentAttempt.findMany({
        where: { assessmentId: id, studentId: requesterId },
        include: {
          student: { select: { name: true, email: true } },
        }
      });
    }

    if (requesterRole !== 'ADMIN' && requesterRole !== 'TEACHER') {
      exam.questions = sanitizeQuestionsForStudent(exam.questions as any) as any;
    }

    res.json({
      ...exam,
      allowExternalStudents: assessData?.allowExternalStudents ?? false,
      examAccessCode: requesterRole === 'ADMIN' || requesterRole === 'TEACHER' ? (assessData?.examAccessCode ?? null) : null,
      allowedIps: requesterRole === 'ADMIN' || requesterRole === 'TEACHER' ? (assessData?.allowedIps ?? null) : null,
      attempts
    });
  } catch (error: any) {
    res.status(500).json({ message: 'Error fetching exam details', error: error.message });
  }
};


import { z } from 'zod';

const createExamSchema = z.object({
  title: z.string().min(2),
  courseId: z.string().min(1),
  duration: z.number().min(5).optional(),
  requiresCamera: z.boolean().optional(),
  startTime: z.string().optional().nullable(),
  endTime: z.string().optional().nullable(),
  randomization: z.boolean().optional(),
  passingScore: z.number().optional(),
  totalPoints: z.number().positive().optional(),
  allowExternalStudents: z.boolean().optional(),
  allowedIps: z.string().optional().nullable(),
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
  }).passthrough()).optional()
});

export const createExam = async (req: AuthRequest, res: Response) => {
  try {
    const requesterRole = (req.user?.role || '').toUpperCase();
    const requesterId = req.user?.userId;

    const validatedData = createExamSchema.parse(req.body);
    const { title, courseId, duration, questions, requiresCamera, startTime, endTime, randomization, passingScore, totalPoints, allowExternalStudents, allowedIps } = validatedData;
    
    const course = await db.course.findUnique({ where: { id: courseId } });
    if (!course) return res.status(404).json({ message: 'Course not found' });

    if (requesterRole !== 'ADMIN') {
      if (course.teacherId !== requesterId) {
        return res.status(403).json({ message: 'Forbidden: You do not own this course' });
      }
    }

    const exam = await db.exam.create({
      data: {
        title,
        courseId,
        duration: duration || 60,
        questions: (questions || []) as any,
        requiresCamera: requiresCamera || false,
        startTime: startTime ? new Date(startTime) : null,
        endTime: endTime ? new Date(endTime) : null,
        randomization: randomization || false,
        passingScore: passingScore || 50,
        totalPoints: ((typeof totalPoints === 'number' && totalPoints > 0) ? totalPoints : (Array.isArray(questions) && questions.length > 0 ? (questions.reduce((acc: number, q: any) => acc + (typeof q.points === 'number' && q.points > 0 ? q.points : 0), 0) || null) : null))
      }
    });

    const examAccessCode = allowExternalStudents ? generateExamAccessCode() : null;

    // Mirror to unified Assessment table
    await db.assessment.create({
      data: {
        id: exam.id,
        title: exam.title,
        type: 'EXAM',
        courseId: exam.courseId,
        teacherId: course.teacherId,
        durationMinutes: exam.duration,
        questions: exam.questions as any,
        passingScore: exam.passingScore,
        randomization: exam.randomization,
        openAt: exam.startTime,
        closeAt: exam.endTime,
        allowExternalStudents: !!allowExternalStudents,
        examAccessCode,
        allowedIps: allowedIps || null,
        status: 'PUBLISHED'
      }
    });

    if (exam.questions && Array.isArray(exam.questions)) {
      await linkQuestionAssetsToAssessment(exam.id, exam.questions as any[]);
    }

    io.to(`course:${courseId}`).emit('exam_created', exam);
    
    // Notify enrolled students and their parents
    const { notifyCourseStudents } = await import('../utils/notification.helper.js');
    await notifyCourseStudents(courseId, 'امتحان جديد', `تم نشر امتحان جديد: ${title}`);

    res.status(201).json({
      ...exam,
      allowExternalStudents: !!allowExternalStudents,
      examAccessCode,
      allowedIps: allowedIps || null
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ errors: error.errors });
    }
    res.status(500).json({ message: 'Error creating exam', error: error.message });
  }
};

export const updateExam = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const requesterRole = (req.user?.role || '').toUpperCase();
    const requesterId = req.user?.userId;

    const validatedData = createExamSchema.parse(req.body);
    const { title, courseId, duration, questions, requiresCamera, startTime, endTime, randomization, passingScore, allowExternalStudents, allowedIps } = validatedData;
    
    // Ensure the exam exists
    const existing = await db.exam.findUnique({ where: { id }, include: { course: true } });
    if (!existing) return res.status(404).json({ message: 'Exam not found' });

    if (requesterRole !== 'ADMIN' && existing.course.teacherId !== requesterId) {
      return res.status(403).json({ message: 'Forbidden: You do not own this exam' });
    }

    // If they are changing the courseId, verify they own the new course too
    if (existing.courseId !== courseId && requesterRole !== 'ADMIN') {
       const newCourse = await db.course.findUnique({ where: { id: courseId } });
       if (!newCourse) return res.status(404).json({ message: 'New course not found' });
       if (newCourse.teacherId !== requesterId) {
         return res.status(403).json({ message: 'Forbidden: You do not own the target course' });
       }
    }

    const updateData = {
      title,
      courseId,
      duration: duration || 60,
      questions: (questions || []) as any,
      requiresCamera: requiresCamera || false,
      startTime: startTime ? new Date(startTime) : null,
      endTime: endTime ? new Date(endTime) : null,
      randomization: randomization || false,
      passingScore: passingScore || 50
    };

    const updatedExam = await db.exam.update({
      where: { id },
      data: updateData
    });

    let existingAssess = await db.assessment.findUnique({ where: { id } });
    let examAccessCode = existingAssess?.examAccessCode;
    if (allowExternalStudents && !examAccessCode) {
      examAccessCode = generateExamAccessCode();
    }

    // Mirror to unified Assessment table
    try {
      if (existingAssess) {
        await db.assessment.update({
          where: { id },
          data: {
            ...(updateData.title && { title: updateData.title }),
            ...(updateData.duration && { durationMinutes: updateData.duration }),
            ...(updateData.questions && { questions: updateData.questions as any }),
            ...(updateData.passingScore && { passingScore: updateData.passingScore }),
            ...(updateData.randomization !== undefined && { randomization: updateData.randomization }),
            ...(updateData.startTime !== undefined && { openAt: updateData.startTime }),
            ...(updateData.endTime !== undefined && { closeAt: updateData.endTime }),
            ...(allowExternalStudents !== undefined && { allowExternalStudents: !!allowExternalStudents }),
            ...(allowedIps !== undefined && { allowedIps: allowedIps || null }),
            ...(examAccessCode !== undefined && { examAccessCode })
          }
        });
      } else {
        await db.assessment.create({
          data: {
            id: updatedExam.id,
            title: updatedExam.title,
            type: 'EXAM',
            courseId: updatedExam.courseId,
            teacherId: existing.course.teacherId,
            durationMinutes: updatedExam.duration,
            questions: updatedExam.questions as any,
            passingScore: updatedExam.passingScore,
            randomization: updatedExam.randomization,
            openAt: updatedExam.startTime,
            closeAt: updatedExam.endTime,
            allowExternalStudents: !!allowExternalStudents,
            examAccessCode,
            allowedIps: allowedIps || null,
            status: 'PUBLISHED'
          }
        });
      }
    } catch (err) {}

    if (updatedExam.questions && Array.isArray(updatedExam.questions)) {
      await linkQuestionAssetsToAssessment(id, updatedExam.questions as any[]);
    }

    io.to(`course:${updatedExam.courseId}`).emit('exam_updated', updatedExam);

    // Notify enrolled students and their parents
    const { notifyCourseStudents } = await import('../utils/notification.helper.js');
    await notifyCourseStudents(updatedExam.courseId, 'تحديث امتحان', `تم تحديث الامتحان: ${updatedExam.title}`);

    res.json({
      ...updatedExam,
      allowExternalStudents: !!allowExternalStudents,
      examAccessCode,
      allowedIps: allowedIps || null
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ errors: error.errors });
    }
    res.status(500).json({ message: 'Error updating exam', error: error.message });
  }
};

export const startAttempt = async (req: AuthRequest, res: Response) => {
  try {
    const { id: examId } = req.params;
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ message: 'Unauthorized' });

    const exam = await db.exam.findUnique({ where: { id: examId } });
    if (!exam) return res.status(404).json({ message: 'Exam not found' });

    // Enforce course lifecycle & archive protection (Phase II-C)
    if (exam.courseId) {
      const course = await db.course.findUnique({
        where: { id: exam.courseId },
        select: { id: true, status: true, deletedAt: true }
      });
      if (course && (course.status !== 'PUBLISHED' || course.deletedAt !== null)) {
        return res.status(403).json({ message: 'لا يمكن بدء الامتحان لدورة مؤرشفة أو غير منشورة' });
      }
    }

    const now = new Date();
    if (exam.startTime && now < exam.startTime) {
      return res.status(400).json({ message: 'Exam has not started yet' });
    }
    if (exam.endTime && now > exam.endTime) {
      return res.status(400).json({ message: 'Exam has already ended' });
    }

    const isEnrolled = await checkUserEnrollment(req.user, exam.courseId);
    if (!isEnrolled) return res.status(403).json({ message: 'Not enrolled in this course' });

    const attempt = await db.examAttempt.create({
      data: {
        studentId: userId,
        examId,
        score: 0,
        status: 'STARTED',
        isGraded: false,
        submittedAt: null,
        totalPoints: (typeof exam.totalPoints === 'number' && exam.totalPoints > 0) ? exam.totalPoints : null
      }
    });
    res.status(201).json(attempt);
  } catch (error: any) {
    res.status(400).json({ message: 'Error starting exam', error: error.message });
  }
};

export const submitAttempt = async (req: AuthRequest, res: Response) => {
  try {
    const { id: examId } = req.params;
    const userId = req.user?.userId;
    const { answers } = req.body; 
    
    if (!userId) return res.status(401).json({ message: 'Unauthorized' });

    // Load exam and correct answers from database
    const exam = await db.exam.findUnique({ where: { id: examId } });
    if (!exam) return res.status(404).json({ message: 'Exam not found' });

    const now = new Date();
    if (exam.endTime && now > exam.endTime) {
       // Allow a small grace period for network latency (e.g., 2 minutes)
       if (now.getTime() - exam.endTime.getTime() > 120000) {
         return res.status(400).json({ message: 'Exam window has closed' });
       }
    }

    const isEnrolled = await checkUserEnrollment(req.user, exam.courseId);
    if (!isEnrolled) return res.status(403).json({ message: 'Not enrolled in this course' });

    let calculatedScore = 0;
    const questions = Array.isArray(exam.questions) ? exam.questions : [];
    
    // Concurrency protection: wrap entire attempt retrieval, validation, and update in transaction
    const submissionResult = await db.$transaction(async (tx) => {
      // 1. Transaction-level serialization for this student & exam
      // Uses PostgreSQL advisory xact lock to serialize concurrent attempts before row creation
      try {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${'ox_attempt:' + userId + ':' + examId}))`;
      } catch (lockErr) {
        // Fallback gracefully in testing / non-PostgreSQL environments
      }

      // 2. Fetch latest attempt under transaction
      let existingAttempt = await tx.examAttempt.findFirst({
        where: { studentId: userId, examId },
        orderBy: { createdAt: 'desc' }
      });

      // 3. Row-level lock using SELECT ... FOR UPDATE on the existing attempt row
      if (existingAttempt) {
        try {
          await tx.$executeRaw`SELECT "id" FROM "ExamAttempt" WHERE "id" = ${existingAttempt.id} FOR UPDATE`;
          // Refetch under the row lock to guarantee seeing the committed state from any preceding concurrent transaction
          existingAttempt = await tx.examAttempt.findUnique({
            where: { id: existingAttempt.id }
          });
        } catch (rawLockErr) {
          // Fallback gracefully if row-level locking raw query is unsupported
        }
      }

      // 4. Idempotent submission: if already in a terminal state, return existing attempt immediately
      // Terminal states: GRADED, SUBMITTED, CHEATING, TIME_EXPIRED
      if (existingAttempt) {
        if (existingAttempt.status === 'GRADED' || existingAttempt.status === 'SUBMITTED') {
          return {
            isAlreadySubmitted: true,
            statusCode: 200,
            payload: {
              success: true,
              score: existingAttempt.score,
              percentage: existingAttempt.percentage,
              totalPoints: existingAttempt.totalPoints,
              attempt: existingAttempt,
              idempotent: true
            }
          };
        }
        if (existingAttempt.status === 'CHEATING') {
          return {
            isAlreadySubmitted: true,
            statusCode: 403,
            payload: { message: 'Attempt disqualified due to cheating violations', attempt: existingAttempt }
          };
        }
        if (existingAttempt.status === 'TIME_EXPIRED') {
          return {
            isAlreadySubmitted: true,
            statusCode: 400,
            payload: { message: 'Attempt has expired and cannot be resubmitted', attempt: existingAttempt }
          };
        }
      }

      // Verified maximum points determination (DEF-02)
      let totalPossiblePoints: number | null = (typeof exam.totalPoints === 'number' && exam.totalPoints > 0)
        ? exam.totalPoints
        : null;

      if (!totalPossiblePoints && questions.length > 0) {
        const sumPoints = questions.reduce((acc: number, q: any) => acc + (typeof q.points === 'number' && q.points > 0 ? q.points : 0), 0);
        if (sumPoints > 0) totalPossiblePoints = sumPoints;
      }

      let calculatedScore = 0;
      if (questions.length > 0 && Array.isArray(answers)) {
        let earned = 0;
        let hasSpecificPoints = false;
        for (const ans of answers) {
          const q: any = questions.find((q: any) => q.id === ans.questionId);
          if (q && q.correct !== undefined && ans.selectedOption === q.correct) {
            if (typeof q.points === 'number' && q.points > 0) {
              earned += q.points;
              hasSpecificPoints = true;
            } else {
              earned += 1;
            }
          }
        }
        if (hasSpecificPoints && totalPossiblePoints) {
          calculatedScore = earned;
        } else {
          calculatedScore = totalPossiblePoints ? (earned / questions.length) * totalPossiblePoints : earned;
        }
      }

      // Verified percentage calculation: requires verified totalPossiblePoints > 0
      const percentage = (totalPossiblePoints !== null && totalPossiblePoints > 0)
        ? Math.round(((calculatedScore / totalPossiblePoints) * 100) * 10) / 10
        : null;

      // Check time limit
      if (existingAttempt) {
        const startedAt = existingAttempt.createdAt;
        const elapsedMinutes = (now.getTime() - startedAt.getTime()) / 60000;
        if (elapsedMinutes > exam.duration + 5) {
          const hasAnswers = Array.isArray(answers) && answers.length > 0;
          const expiredAttempt = await tx.examAttempt.update({
            where: { id: existingAttempt.id },
            data: {
              status: 'TIME_EXPIRED',
              score: calculatedScore,
              percentage,
              totalPoints: totalPossiblePoints,
              isGraded: hasAnswers && percentage !== null,
              submittedAt: now,
              answers: answers || []
            }
          });
          return {
            isAlreadySubmitted: true,
            statusCode: 400,
            payload: { message: 'Time limit exceeded', attempt: expiredAttempt }
          };
        }
      }

      let attempt;
      if (existingAttempt) {
        attempt = await tx.examAttempt.update({
          where: { id: existingAttempt.id },
          data: {
            score: calculatedScore,
            percentage,
            totalPoints: totalPossiblePoints,
            status: 'GRADED',
            isGraded: percentage !== null,
            submittedAt: now,
            answers: answers || []
          }
        });
      } else {
        attempt = await tx.examAttempt.create({
          data: {
            studentId: userId,
            examId,
            score: calculatedScore,
            percentage,
            totalPoints: totalPossiblePoints,
            status: 'GRADED',
            isGraded: percentage !== null,
            submittedAt: now,
            answers: answers || []
          }
        });
      }

      return {
        isAlreadySubmitted: false,
        statusCode: 200,
        payload: { success: true, score: calculatedScore, percentage, attempt }
      };
    });

    // Notify teacher of submission (outside transaction)
    if (!submissionResult.isAlreadySubmitted && submissionResult.statusCode === 200) {
      const { notifyTeacher } = await import('../utils/notification.helper.js');
      await notifyTeacher(exam.courseId, 'تسليم امتحان', `قام الطالب بتسليم امتحان: ${exam.title}`);
    }

    res.status(submissionResult.statusCode).json(submissionResult.payload);
  } catch (error: any) {
    res.status(400).json({ message: 'Error submitting exam', error: error.message });
  }
};

export const syncAttempt = async (req: AuthRequest, res: Response) => {
  try {
    const { id: examId } = req.params;
    const userId = req.user?.userId;
    const { answers } = req.body;
    
    if (!userId) return res.status(401).json({ message: 'Unauthorized' });

    const existingAttempt = await db.examAttempt.findFirst({
      where: { studentId: userId, examId },
      orderBy: { createdAt: 'desc' }
    });

    if (!existingAttempt) {
      return res.status(404).json({ message: 'No active attempt found to sync' });
    }

    // DEF-05: Strict attempt lifecycle immutability
    const TERMINAL_STATUSES = ['GRADED', 'CHEATING', 'TIME_EXPIRED', 'SUBMITTED'];
    if (TERMINAL_STATUSES.includes(existingAttempt.status)) {
      return res.status(403).json({
        message: `Attempt lifecycle is terminal (${existingAttempt.status}). Answer mutations are prohibited.`,
        status: existingAttempt.status
      });
    }

    // Only allow mutations for active states: STARTED or IN_PROGRESS
    if (existingAttempt.status !== 'STARTED' && existingAttempt.status !== 'IN_PROGRESS') {
      return res.status(403).json({
        message: `Invalid attempt state for autosave: ${existingAttempt.status}`,
        status: existingAttempt.status
      });
    }

    const updateData: any = { answers: answers || [] };
    if (existingAttempt.status === 'STARTED') {
      updateData.status = 'IN_PROGRESS';
    }
    
    await db.examAttempt.update({
      where: { id: existingAttempt.id },
      data: updateData
    });

    res.json({ success: true, status: updateData.status || existingAttempt.status });
  } catch (error: any) {
    res.status(400).json({ message: 'Error syncing exam attempt', error: error.message });
  }
};

export const reportViolation = async (req: AuthRequest, res: Response) => {
  try {
    const { id: examId } = req.params;
    const userId = req.user?.userId;
    const { type } = req.body;
    
    if (!userId) return res.status(401).json({ message: 'Unauthorized' });

    const attempt = await db.examAttempt.findFirst({
      where: { studentId: userId, examId },
      orderBy: { createdAt: 'desc' },
      include: { ExamViolation: true }
    });

    if (!attempt) return res.status(404).json({ message: 'No active attempt found' });

    const crypto = await import('crypto');
    await db.examViolation.create({
      data: {
        id: crypto.randomUUID(),
        attemptId: attempt.id,
        type: type || 'UNKNOWN'
      }
    });

    // If 2 or more violations, disqualify
    if (attempt.ExamViolation.length >= 1) { // They just got their 2nd violation (1 + 1 new)
      await db.examAttempt.update({
        where: { id: attempt.id },
        data: {
          score: 0,
          status: 'CHEATING',
          isGraded: false
        }
      });
      return res.status(403).json({ message: 'Disqualified due to multiple violations' });
    }

    res.json({ success: true, message: 'Violation recorded' });
  } catch (error: any) {
    res.status(400).json({ message: 'Error reporting violation', error: error.message });
  }
};

export const deleteExam = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const requesterRole = (req.user?.role || '').toUpperCase();
    const requesterId = req.user?.userId;

    const exam = await db.exam.findUnique({
      where: { id },
      include: { course: true }
    });

    if (!exam) {
      return res.status(404).json({ message: 'Exam not found' });
    }

    if (requesterRole !== 'ADMIN' && exam.course.teacherId !== requesterId) {
      return res.status(403).json({ message: 'Insufficient permissions to delete this exam' });
    }

    await db.exam.delete({ where: { id } });
    res.json({ message: 'Deleted successfully' });
  } catch (error: any) {
    res.status(500).json({ message: 'Error deleting exam', error: error.message });
  }
};
