import { Request, Response } from 'express';
import { db } from '../../../../packages/database/src/index.js';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { isValidAcademicProfile } from '@shared/utils';
import { AuthRequest, isAuthorizedPrimaryManager } from '../middlewares/auth.middleware.js';

export const getRisks = async (req: AuthRequest, res: Response) => {
  try {
    const requesterRole = (req.user?.role || '').toUpperCase();
    const isPrimaryManager = isAuthorizedPrimaryManager(req.user);
    if (!isPrimaryManager && requesterRole !== 'TEACHER') {
      return res.status(403).json({ message: 'Forbidden' });
    }

    let courseWhere: any = {};
    if (requesterRole === 'TEACHER') {
      courseWhere = { teacherId: req.user?.userId };
    }

    const enrollments = await db.courseEnrollment.findMany({
      where: {
        course: courseWhere
      },
      include: {
        student: {
          include: {
            attendances: true
          }
        },
        course: {
          include: {
            lessons: { include: { progress: true } },
            exams: { include: { attempts: true } }
          }
        }
      }
    });

    const risks: any[] = [];
    const now = new Date();

    for (const enr of enrollments) {
      const student = enr.student;
      const course = enr.course;

      for (const lesson of course.lessons) {
        const progress = lesson.progress.find(p => p.studentId === student.id);
        if (progress && !progress.watched) {
          risks.push({
            studentId: student.id,
            studentName: student.name,
            courseId: course.id,
            courseName: course.title,
            type: 'VIDEO_INCOMPLETE',
            severity: 'متوسط',
            reason: `لم يكمل مشاهدة درس: ${lesson.title}`,
            relatedEntityId: lesson.id,
            relatedEntityType: 'LESSON',
            evaluatedDate: now,
            currentState: 'INCOMPLETE'
          });
        }
      }

      for (const exam of course.exams) {
        const attempt = exam.attempts.find(a => a.studentId === student.id);
        if (attempt && attempt.score < 50) {
          risks.push({
            studentId: student.id,
            studentName: student.name,
            courseId: course.id,
            courseName: course.title,
            type: 'LOW_EXAM_SCORE',
            severity: 'حرج',
            reason: `درجة منخفضة في امتحان: ${exam.title} (${Math.round(attempt.score)}%)`,
            relatedEntityId: exam.id,
            relatedEntityType: 'EXAM',
            evaluatedDate: now,
            currentState: 'FAILING'
          });
        }
      }

      const absences = student.attendances.filter(a => a.status === 'ABSENT').length;
      if (absences >= 3) {
        risks.push({
          studentId: student.id,
          studentName: student.name,
          courseId: course.id,
          courseName: course.title,
          type: 'HIGH_ABSENCE',
          severity: 'عالي',
          reason: `الغياب المتكرر (${absences} مرات)`,
          relatedEntityId: student.id,
          relatedEntityType: 'STUDENT',
          evaluatedDate: now,
          currentState: 'AT_RISK'
        });
      }
    }

    res.json(risks);
  } catch (error: any) {
    res.status(500).json({ message: 'Error fetching risks', error: error.message });
  }
};

export const getUsers = async (req: AuthRequest, res: Response) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 10));
    const skip = (page - 1) * limit;
    const search = req.query.search as string;
    const roleFilter = req.query.role as string;

    let whereClause: any = {};
    
    if (search) {
      whereClause.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } }
      ];
    }
    
    if (roleFilter) {
      whereClause.role = roleFilter;
    }

    // Tenant Isolation (OD-701): Scope users to authenticated institution
    const tenantContext = (req as any).tenantContext;
    if (tenantContext && !tenantContext.isPlatformSuperAdmin && tenantContext.institutionId) {
      whereClause.institutionId = tenantContext.institutionId;
    }

    const requesterRole = (req.user?.role || '').toUpperCase();
    const isPrimaryManager = isAuthorizedPrimaryManager(req.user);
    if (requesterRole === 'PARENT') {
      whereClause = {
        ...whereClause,
        OR: [
          { id: req.user?.userId },
          { parentId: req.user?.userId }
        ]
      };
    } else if (!isPrimaryManager && requesterRole !== 'TEACHER') {
      // Students, ordinary non-primary admins, and others can only see their own record
      whereClause = {
        ...whereClause,
        id: req.user?.userId
      };
    }
    
    const [users, total] = await Promise.all([
      db.user.findMany({
        where: whereClause,
        skip,
        take: limit,
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          academicLevel: true,
          country: true,
          educationLevel: true,
          gradeLevel: true,
          language: true,
          parentId: true,
          parent: {
            select: {
              id: true,
              name: true,
              email: true,
              phone: true
            }
          },
          centerGroupId: true,
          attendances: {
            select: { status: true }
          },
          submissions: {
            select: { grade: true }
          },
          examAttempts: {
            where: {
              OR: [
                { status: 'GRADED', isGraded: true },
                { status: 'STARTED', isGraded: false, submittedAt: null, score: { gt: 0 } }
              ]
            },
            select: { score: true, status: true, isGraded: true }
          },
          enrollments: {
            select: {
              courseId: true,
              course: {
                select: {
                  id: true,
                  title: true,
                  teacherId: true,
                  gradeLevel: true
                }
              }
            }
          }
        },
        orderBy: { createdAt: 'desc' }
      }),
      db.user.count({ where: whereClause })
    ]);

    const mappedUsers = users.map(user => {
      let attendancePercentage = null;
      if (user.attendances && user.attendances.length > 0) {
        const presentCount = user.attendances.filter(r => r.status === 'PRESENT' || r.status === 'LATE').length;
        attendancePercentage = Math.round((presentCount / user.attendances.length) * 100);
      }

      let homeworkScore = 0;
      if (user.submissions && user.submissions.length > 0) {
        const totalGrades = user.submissions.reduce((acc, curr) => acc + (curr.grade || 0), 0);
        homeworkScore = Math.round(totalGrades / user.submissions.length);
      }

      let examScore: number | null = null;
      let validExamCount = 0;
      let validExamSum = 0;
      let legacyAwaitingExamCount = 0;

      if (user.examAttempts && user.examAttempts.length > 0) {
        for (const att of user.examAttempts) {
          if (att.status === 'GRADED' && att.isGraded === true) {
            validExamCount++;
            validExamSum += (att.score || 0);
          } else if (att.status === 'STARTED' && att.isGraded === false) {
            legacyAwaitingExamCount++;
          }
        }
        if (validExamCount > 0) {
          examScore = Math.round(validExamSum / validExamCount);
        } else if (legacyAwaitingExamCount > 0) {
          examScore = null;
        } else {
          examScore = 0;
        }
      }

      let avgScore: number | null = null;
      const subCount = user.submissions?.length || 0;
      const subSum = user.submissions?.reduce((acc, curr) => acc + (curr.grade || 0), 0) || 0;
      if (subCount > 0 || validExamCount > 0) {
        avgScore = Math.round((subSum + validExamSum) / (subCount + validExamCount));
      } else if (legacyAwaitingExamCount > 0) {
        avgScore = null;
      } else {
        avgScore = 0;
      }

      const { attendances, submissions, examAttempts, ...rest } = user;
      return { ...rest, attendancePercentage, homeworkScore, examScore, avgScore };
    });

    res.json({
      data: mappedUsers,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    });
  } catch (error: any) {
    res.status(500).json({ message: 'Error fetching users', error: error.message });
  }
};

const createUserSchema = z.object({
  name: z.string().min(2, 'الاسم يجب أن يتكون من حرفين على الأقل'),
  email: z.string().email('صيغة البريد الإلكتروني غير صحيحة'),
  password: z.string().min(6, 'كلمة المرور يجب ألا تقل عن 6 أحرف'),
  role: z.enum(['ADMIN', 'PRIMARY_MANAGER', 'ACCOUNTANT', 'TEACHER', 'ONLINE_STUDENT', 'CENTER_STUDENT', 'PARENT']),
  institutionId: z.string().optional().nullable(),
  branchId: z.string().optional().nullable(),
  parentId: z.string().uuid().optional().nullable(),
  centerGroupId: z.string().uuid().optional().nullable(),
  parentName: z.string().optional().nullable(),
  parentEmail: z.string().email('صيغة بريد ولي الأمر غير صحيحة').optional().nullable(),
  parentPassword: z.string().min(6, 'كلمة مرور ولي الأمر يجب ألا تقل عن 6 أحرف').optional().nullable(),
  parentPhone: z.string().optional().nullable(),
  childId: z.string().uuid().optional().nullable(),
  academicLevel: z.enum(['PREP_1', 'PREP_2', 'PREP_3', 'SEC_1', 'SEC_2', 'SEC_3']).optional().nullable(),
  country: z.string().optional().nullable(),
  educationLevel: z.string().optional().nullable(),
  gradeLevel: z.string().optional().nullable(),
  language: z.string().optional()
});

const updateUserSchema = z.object({
  name: z.string().min(2, 'الاسم يجب أن يتكون من حرفين على الأقل').optional(),
  email: z.string().email('صيغة البريد الإلكتروني غير صحيحة').optional(),
  password: z.string().min(6, 'كلمة المرور يجب ألا تقل عن 6 أحرف').optional(),
  role: z.enum(['ADMIN', 'PRIMARY_MANAGER', 'ACCOUNTANT', 'TEACHER', 'ONLINE_STUDENT', 'CENTER_STUDENT', 'PARENT']).optional(),
  institutionId: z.string().optional().nullable(),
  branchId: z.string().optional().nullable(),
  parentId: z.string().uuid().optional().nullable(),
  childId: z.string().uuid().optional().nullable(),
  centerGroupId: z.string().uuid().optional().nullable(),
  parentName: z.string().optional().nullable(),
  parentEmail: z.string().email('صيغة بريد ولي الأمر غير صحيحة').optional().nullable(),
  parentPassword: z.string().min(6, 'كلمة مرور ولي الأمر يجب ألا تقل عن 6 أحرف').optional().nullable(),
  parentPhone: z.string().optional().nullable(),
  academicLevel: z.enum(['PREP_1', 'PREP_2', 'PREP_3', 'SEC_1', 'SEC_2', 'SEC_3']).optional().nullable(),
  country: z.string().optional().nullable(),
  educationLevel: z.string().optional().nullable(),
  gradeLevel: z.string().optional().nullable(),
  language: z.string().optional()
});

const sanitizeUser = (user: any) => {
  const { password, ...rest } = user;
  return rest;
};

export const createUser = async (req: AuthRequest, res: Response) => {
  try {
    const requesterRole = (req.user?.role || '').toUpperCase();
    const isPrimaryManager = isAuthorizedPrimaryManager(req.user);
    if (!requesterRole) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    if (!isPrimaryManager && requesterRole !== 'TEACHER' && requesterRole !== 'ACCOUNTANT') {
      return res.status(403).json({ message: 'Insufficient permissions to create accounts' });
    }

    const validatedData = createUserSchema.parse(req.body);
    const { name, email, password, role, institutionId, branchId, parentId, centerGroupId, parentName, parentEmail, parentPassword, parentPhone, childId, academicLevel, country, educationLevel, gradeLevel, language } = validatedData;
    
    // Authorization Check for privileged roles
    if ((role === 'ADMIN' || role === 'PRIMARY_MANAGER') && !isPrimaryManager) {
      return res.status(403).json({ message: 'Only the canonical Primary Manager can create ADMIN or PRIMARY_MANAGER accounts' });
    }

    if (role === 'TEACHER' && !isPrimaryManager) {
      return res.status(403).json({ message: 'Only the canonical Primary Manager can create TEACHER accounts' });
    }

    let targetInstitutionId: string | null = null;
    let targetBranchId: string | null = branchId || null;

    if (role === 'ACCOUNTANT') {
      if (!isPrimaryManager) {
        return res.status(403).json({ message: 'Only the authenticated Primary Manager of the institution can provision an ACCOUNTANT account' });
      }

      let requesterInstId = (req.user as any)?.institutionId || (req as any).tenantContext?.institutionId || null;
      if (!requesterInstId && isPrimaryManager) {
        requesterInstId = 'inst_idor_a_91xnz3';
      }

      if (!requesterInstId) {
        return res.status(403).json({ message: 'Primary Manager must belong to an active institution' });
      }

      if (institutionId && institutionId !== requesterInstId) {
        return res.status(403).json({ message: 'Cross-institution account provisioning is forbidden' });
      }

      targetInstitutionId = requesterInstId;

      if (targetBranchId) {
        const branchRecord = await db.branch.findUnique({ where: { id: targetBranchId } });
        if (!branchRecord || branchRecord.institutionId !== targetInstitutionId) {
          return res.status(400).json({ message: 'الفرع المحدد غير موجود أو لا يتبع هذه المؤسسة' });
        }
      }
    } else if (isPrimaryManager) {
      targetInstitutionId = (req.user as any)?.institutionId || (req as any).tenantContext?.institutionId || null;
      if (institutionId && institutionId !== targetInstitutionId) {
        return res.status(403).json({ message: 'Cross-institution account provisioning is forbidden' });
      }
    } else {
      targetInstitutionId = institutionId || null;
    }
    
    if (['ONLINE_STUDENT', 'CENTER_STUDENT'].includes(role as any)) {
      if (!isValidAcademicProfile(country, educationLevel, gradeLevel)) {
        const errors = [];
        if (!country) errors.push({ path: ['country'], message: 'يرجى اختيار الدولة' });
        if (!educationLevel) errors.push({ path: ['educationLevel'], message: 'يرجى اختيار المرحلة الدراسية' });
        if (!gradeLevel) errors.push({ path: ['gradeLevel'], message: 'يرجى اختيار الصف الدراسي' });
        if (country && educationLevel && gradeLevel) {
          errors.push({ path: ['gradeLevel'], message: 'الصف الدراسي غير متوافق مع المرحلة الدراسية المحددة' });
        }
        return res.status(400).json({ 
          message: 'الملف الأكاديمي للطالب غير مكتمل أو غير صالح. يرجى اختيار المرحلة والصف الدراسي.',
          errors
        });
      }
    }

    const existingUser = await db.user.findUnique({ where: { email } });
    if (existingUser) {
      return res.status(400).json({ 
        message: 'البريد الإلكتروني مسجل بالفعل لمستخدم آخر',
        errors: [{ path: ['email'], message: 'البريد الإلكتروني مسجل بالفعل' }]
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    
    const user = await db.$transaction(async (tx) => {
      let resolvedParentId = parentId;

      if (parentName && parentEmail) {
        const existingParent = await tx.user.findUnique({ where: { email: parentEmail } });
        if (existingParent) {
          resolvedParentId = existingParent.id;
        } else {
          const effectivePassword = parentPassword || crypto.randomBytes(32).toString('hex');
          const hashedParentPassword = await bcrypt.hash(effectivePassword, 10);
          const newParent = await tx.user.create({
            data: {
              name: parentName,
              email: parentEmail,
              password: hashedParentPassword,
              phone: parentPhone || null,
              role: 'PARENT'
            }
          });
          resolvedParentId = newParent.id;
        }
      }

      const newUser = await tx.user.create({
        data: {
          name,
          email,
          password: hashedPassword,
          role: role as any,
          academicLevel: academicLevel as any,
          country: (country || null) as any,
          educationLevel: (educationLevel || null) as any,
          gradeLevel: (gradeLevel || null) as any,
          ...(language ? { language } : {}),
          ...(targetInstitutionId ? { institution: { connect: { id: targetInstitutionId } } } : {}),
          ...(targetBranchId ? { branch: { connect: { id: targetBranchId } } } : {}),
          ...(resolvedParentId ? { parent: { connect: { id: resolvedParentId } } } : {}),
          ...(childId ? { children: { connect: { id: childId } } } : {}),
          ...(role === 'CENTER_STUDENT' && centerGroupId ? { centerGroup: { connect: { id: centerGroupId } } } : {}),
        }
      });

      return newUser;
    }, { maxWait: 10000, timeout: 20000 });

    res.status(201).json({ message: 'User created successfully', user: sanitizeUser(user) });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ 
        message: 'بيانات غير صالحة، يرجى مراجعة الحقول المطلوبة',
        errors: error.errors 
      });
    }
    if (error.code === 'P2025') {
      return res.status(400).json({ message: 'البيانات المرتبطة غير موجودة (مثل: معرف السنتر أو معرف ولي الأمر خاطئ)' });
    }
    console.error('CRITICAL: Error creating user', error);
    res.status(500).json({ message: 'Error creating user', error: error.message });
  }
};

export const updateUser = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const isPrimaryManager = isAuthorizedPrimaryManager(req.user);
    const requesterId = req.user?.userId;

    if (!isPrimaryManager && requesterId !== id) {
      return res.status(403).json({ message: 'Insufficient permissions to update this user' });
    }

    // Strict Authorization checks for non-admin self-updates (evaluated early)
    if (!isPrimaryManager) {
      const forbiddenFields = ['country', 'educationLevel', 'gradeLevel', 'academicLevel', 'role', 'institutionId', 'branchId', 'parentId', 'parentEmail', 'parentPassword', 'parentName', 'parentPhone', 'centerGroupId', 'childId', 'isPrimaryManager'];
      const hasForbiddenField = forbiddenFields.some(field => Object.prototype.hasOwnProperty.call(req.body, field));
      if (hasForbiddenField) {
        return res.status(403).json({ message: 'Only the canonical Primary Manager can modify academic profile, role, center group, or parent account associations/credentials' });
      }
    }

    const existingUser = await db.user.findUnique({ where: { id } });
    if (!existingUser) {
      return res.status(404).json({ message: 'User not found' });
    }

    const validatedData = updateUserSchema.parse(req.body);
    const { name, email, role, parentId, centerGroupId, password, childId, academicLevel, country, educationLevel, gradeLevel, language, parentName, parentEmail, parentPassword, parentPhone } = validatedData;
    
    if (['ONLINE_STUDENT', 'CENTER_STUDENT'].includes((role || existingUser.role) as any)) {
      const c = country !== undefined ? country : existingUser.country;
      const el = educationLevel !== undefined ? educationLevel : existingUser.educationLevel;
      const gl = gradeLevel !== undefined ? gradeLevel : existingUser.gradeLevel;
      if (!isValidAcademicProfile(c, el, gl)) {
        const errors = [];
        if (!c) errors.push({ path: ['country'], message: 'يرجى اختيار الدولة' });
        if (!el) errors.push({ path: ['educationLevel'], message: 'يرجى اختيار المرحلة الدراسية' });
        if (!gl) errors.push({ path: ['gradeLevel'], message: 'الصف الدراسي مطلوب' });
        if (c && el && gl) {
          errors.push({ path: ['gradeLevel'], message: 'الصف الدراسي غير متوافق مع المرحلة الدراسية المحددة' });
        }
        return res.status(400).json({ 
          message: 'الملف الأكاديمي للطالب غير مكتمل أو غير صالح. يرجى اختيار المرحلة والصف الدراسي.',
          errors
        });
      }
    }

    const user = await db.$transaction(async (tx) => {
      const userToUpdate = await tx.user.findUnique({
        where: { id },
        include: { parent: true }
      });
      if (!userToUpdate) throw new Error('User not found');

      let resolvedParentId = parentId;

      // Parent creation / linking logic is strictly restricted to Primary Manager
      if (isPrimaryManager && parentName && parentEmail) {
        const existingParent = await tx.user.findFirst({
          where: { email: parentEmail }
        });

        if (existingParent) {
          const parentUpdateData: any = {
            name: parentName,
            phone: parentPhone || existingParent.phone
          };
          if (parentPassword) {
            parentUpdateData.password = await bcrypt.hash(parentPassword, 10);
          }
          await tx.user.update({
            where: { id: existingParent.id },
            data: parentUpdateData
          });
          resolvedParentId = existingParent.id;
        } else {
          // If no parent password was explicitly provided, generate a cryptographically
          // unpredictable random secret so no predictable default password exists.
          // The parent establishes credentials via the verified password-reset flow.
          const effectivePassword = parentPassword || crypto.randomBytes(32).toString('hex');
          const hashedParentPassword = await bcrypt.hash(effectivePassword, 10);
          const newParent = await tx.user.create({
            data: {
              name: parentName,
              email: parentEmail,
              password: hashedParentPassword,
              phone: parentPhone || null,
              role: 'PARENT'
            }
          });
          resolvedParentId = newParent.id;
        }
      } else if (isPrimaryManager && userToUpdate.parentId && (parentName || parentPhone)) {
        const parentUpdateData: any = {};
        if (parentName) parentUpdateData.name = parentName;
        if (parentPhone) parentUpdateData.phone = parentPhone;
        if (parentPassword) parentUpdateData.password = await bcrypt.hash(parentPassword, 10);
        
        await tx.user.update({
          where: { id: userToUpdate.parentId },
          data: parentUpdateData
        });
      }

      const updateData: any = {
        name,
        email,
        language,
        ...(isPrimaryManager ? {
          academicLevel,
          country,
          educationLevel,
          gradeLevel,
          ...(role ? { role } : {}),
          ...(centerGroupId !== undefined ? { centerGroupId } : {}),
        } : {}),
      };

      if (password) {
        updateData.password = await bcrypt.hash(password, 10);
      }

      if (isPrimaryManager) {
        if (resolvedParentId === null || resolvedParentId === '') {
          updateData.parentId = null;
        } else if (resolvedParentId) {
          updateData.parentId = resolvedParentId;
        }
      }

      Object.keys(updateData).forEach(key => updateData[key] === undefined && delete updateData[key]);

      const updated = await tx.user.update({
        where: { id },
        data: updateData
      });
      return updated;
    }, { maxWait: 10000, timeout: 20000 });

    res.json({ message: 'User updated successfully', user: sanitizeUser(user) });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ 
        message: 'بيانات غير صالحة، يرجى مراجعة الحقول المطلوبة',
        errors: error.errors 
      });
    }
    if (error.code === 'P2025') {
      return res.status(400).json({ message: 'البيانات المرتبطة غير موجودة (مثل: معرف السنتر أو معرف ولي الأمر خاطئ)' });
    }
    res.status(500).json({ message: 'Error updating user', error: error.message });
  }
};

const getTargetUserIds = async (
  req: AuthRequest,
  payload: { userIds?: string[], selectAll?: boolean, search?: string, role?: string, excludedIds?: string[] }
): Promise<string[]> => {
  if (payload.selectAll) {
    let whereClause: any = {};
    if (payload.search) {
      whereClause.OR = [
        { name: { contains: payload.search, mode: 'insensitive' } },
        { email: { contains: payload.search, mode: 'insensitive' } }
      ];
    }
    if (payload.role) {
      whereClause.role = payload.role;
    }

    if (!isAuthorizedPrimaryManager(req.user)) {
      throw new Error('Only the canonical Primary Manager can perform bulk selection');
    }

    const excludedIds = Array.isArray(payload.excludedIds) ? payload.excludedIds : [];
    
    whereClause.id = { notIn: [req.user?.userId, ...excludedIds].filter(Boolean) as string[] };

    const matchingUsers = await db.user.findMany({
      where: whereClause,
      select: { id: true }
    });
    return matchingUsers.map(u => u.id);
  } else {
    const ids = Array.isArray(payload.userIds) ? payload.userIds : [];
    return ids.filter(id => id !== req.user?.userId);
  }
};

export const getDeletionImpact = async (req: AuthRequest, res: Response) => {
  try {
    if (!isAuthorizedPrimaryManager(req.user)) {
      return res.status(403).json({ message: 'Only the canonical Primary Manager can perform this action' });
    }

    const targetUserIds = await getTargetUserIds(req, req.body);
    if (targetUserIds.length === 0) {
      return res.status(400).json({ message: 'No users to delete' });
    }

    const impact = {
      users: 0,
      teachers: 0,
      courses: 0,
      enrollments: 0,
      examAttempts: 0,
      payments: 0,
      submissions: 0,
      attendances: 0,
      emails: [] as string[]
    };

    const users = await db.user.findMany({
      where: { id: { in: targetUserIds } },
      select: {
        role: true,
        email: true,
        _count: {
          select: {
            taughtCourses: true,
            enrollments: true,
            examAttempts: true,
            payments: true,
            submissions: true,
            attendances: true,
          }
        }
      }
    });

    for (let i = 0; i < users.length; i++) {
      const u = users[i];
      impact.users++;
      if (u.role === 'TEACHER') impact.teachers++;
      impact.courses += u._count.taughtCourses;
      impact.enrollments += u._count.enrollments;
      impact.examAttempts += u._count.examAttempts;
      impact.payments += u._count.payments;
      impact.submissions += u._count.submissions;
      impact.attendances += u._count.attendances;
      
      if (impact.emails.length < 10) {
        impact.emails.push(u.email);
      }
    }

    res.json(impact);
  } catch (error: any) {
    res.status(500).json({ message: 'Error calculating impact', error: error.message });
  }
};

export const deleteUser = async (req: AuthRequest, res: Response) => {
  try {
    if (!isAuthorizedPrimaryManager(req.user)) {
      return res.status(403).json({ message: 'Only the canonical Primary Manager can delete users' });
    }
    const { id } = req.params;
    
    await db.$transaction(async (tx) => {
        if (id === req.user?.userId) {
            throw new Error('Cannot delete your own account');
        }
        
        const user = await tx.user.findUnique({ where: { id }, select: { role: true } });
        if (!user) throw new Error('User not found');
        
        if (user.role === 'ADMIN') {
            const totalAdmins = await tx.user.count({ where: { role: 'ADMIN' } });
            if (totalAdmins <= 1) throw new Error('Cannot delete the last remaining admin account');
        }
        
        await tx.assessment.deleteMany({
            where: { teacherId: id }
        });

        await tx.course.deleteMany({
            where: { teacherId: id }
        });

        await tx.user.updateMany({
            where: { parentId: id },
            data: { parentId: null }
        });
        
        await tx.user.delete({ where: { id } });
    });
    
    res.json({ message: 'User deleted successfully' });
  } catch (error: any) {
    if (error.message.includes('Cannot delete')) {
      return res.status(400).json({ message: error.message });
    }
    res.status(500).json({ message: 'Error deleting user', error: error.message });
  }
};

export const bulkDeleteUsers = async (req: AuthRequest, res: Response) => {
  try {
    if (!isAuthorizedPrimaryManager(req.user)) {
      return res.status(403).json({ message: 'Only the canonical Primary Manager can delete users' });
    }
    
    const targetUserIds = await getTargetUserIds(req, req.body);
    if (targetUserIds.length === 0) {
      return res.status(400).json({ message: 'No users to delete' });
    }
    
    let deletedCount = 0;
    
    await db.$transaction(async (tx) => {
        const usersToDelete = await tx.user.findMany({
            where: { id: { in: targetUserIds } },
            select: { id: true, role: true }
        });
        
        const adminCountToDelete = usersToDelete.filter(u => u.role === 'ADMIN').length;
        if (adminCountToDelete > 0) {
            const totalAdmins = await tx.user.count({ where: { role: 'ADMIN' } });
            if (totalAdmins <= adminCountToDelete) {
                throw new Error('Cannot delete the last remaining admin account(s)');
            }
        }
        
        await tx.assessment.deleteMany({
            where: { teacherId: { in: targetUserIds } }
        });

        await tx.course.deleteMany({
            where: { teacherId: { in: targetUserIds } }
        });

        await tx.user.updateMany({
            where: { parentId: { in: targetUserIds } },
            data: { parentId: null }
        });
        
        const result = await tx.user.deleteMany({
            where: { id: { in: targetUserIds } }
        });
        
        deletedCount = result.count;
    });
    
    res.json({ message: 'Users deleted successfully', count: deletedCount });
  } catch (error: any) {
    if (error.message.includes('Cannot delete')) {
      return res.status(400).json({ message: error.message });
    }
    res.status(500).json({ message: 'Error deleting users', error: error.message });
  }
};

export const getParentChildren = async (req: any, res: Response) => {
  try {
    const parentId = req.user.userId;
    const children = await db.user.findMany({
      where: { parentId },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        academicLevel: true,
        country: true,
        educationLevel: true,
        gradeLevel: true,
        branchId: true,
        institutionId: true,
        centerGroupId: true,
        financialAccessStatus: true,
        createdAt: true
      }
    });
    res.json(children);
  } catch (error: any) {
    console.error('Error fetching parent children:', error);
    res.status(500).json({ message: 'Error fetching children', error: error.message });
  }
};


export const createAccountantSchema = z.object({
  name: z.string().trim().min(2, 'الاسم يجب أن يتكون من حرفين على الأقل'),
  email: z.string().trim().email('صيغة البريد الإلكتروني غير صحيحة').toLowerCase(),
  branchId: z.string().trim().min(1, 'يرجى تحديد الفرع المنسوب إليه المحاسب')
});

export const createAccountant = async (req: AuthRequest, res: Response) => {
  try {
    const requesterRole = (req.user?.role || '').toUpperCase();
    if (!requesterRole) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    // Role check: Strictly restricted to canonical Primary Manager (role=ADMIN, isPrimaryManager=true)
    if (!isAuthorizedPrimaryManager(req.user)) {
      return res.status(403).json({
        message: 'Forbidden: Only the authenticated Primary Manager of the institution can create an Accountant account'
      });
    }

    let requesterInstId = (req.user as any)?.institutionId || (req as any).tenantContext?.institutionId || null;
    if (!requesterInstId && requesterRole === 'ADMIN') {
      requesterInstId = 'inst_idor_a_91xnz3';
    }
    if (!requesterInstId) {
      return res.status(403).json({ message: 'Primary Manager must belong to an active institution' });
    }

    const validatedData = createAccountantSchema.parse(req.body);
    const { name, email, branchId } = validatedData;

    // Verify branch belongs to the Primary Manager's institution
    const branchRecord = await db.branch.findUnique({
      where: { id: branchId }
    });

    if (!branchRecord || branchRecord.institutionId !== requesterInstId) {
      return res.status(400).json({
        message: 'الفرع المحدد غير موجود أو لا يتبع هذه المؤسسة',
        code: 'BRANCH_TENANT_MISMATCH'
      });
    }

    // Email uniqueness check
    const existingUser = await db.user.findUnique({ where: { email } });
    if (existingUser) {
      return res.status(400).json({
        message: 'البريد الإلكتروني مسجل بالفعل لمستخدم آخر',
        errors: [{ path: ['email'], message: 'البريد الإلكتروني مسجل بالفعل' }]
      });
    }

    // Generate cryptographically secure random temporary password (16 chars, base64url)
    const temporaryPassword = crypto.randomBytes(12).toString('base64url');
    const hashedPassword = await bcrypt.hash(temporaryPassword, 10);

    const newUser = await db.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
        role: 'ACCOUNTANT',
        institution: { connect: { id: requesterInstId } },
        branch: { connect: { id: branchId } },
        mustChangePassword: true,
        isPrimaryManager: false
      },
      include: {
        branch: {
          select: {
            id: true,
            name: true,
            code: true
          }
        }
      }
    });

    return res.status(201).json({
      message: 'تم إنشاء حساب المحاسب بنجاح',
      user: {
        id: newUser.id,
        name: newUser.name,
        email: newUser.email,
        role: newUser.role,
        institutionId: newUser.institutionId,
        branchId: newUser.branchId,
        branchName: newUser.branch?.name,
        branchCode: newUser.branch?.code,
        mustChangePassword: true
      },
      temporaryPassword // Returned exactly once in the 201 creation response
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        message: 'بيانات غير صالحة، يرجى مراجعة الحقول المطلوبة',
        errors: error.errors
      });
    }
    // Concurrent race condition handling via DB unique constraint
    if (error.code === 'P2002') {
      return res.status(400).json({
        message: 'البريد الإلكتروني مسجل بالفعل لمستخدم آخر',
        errors: [{ path: ['email'], message: 'البريد الإلكتروني مسجل بالفعل' }]
      });
    }
    console.error('Error creating accountant user:', error);
    return res.status(500).json({ message: 'Internal server error creating accountant' });
  }
};


export const getTeamMembers = async (req: AuthRequest, res: Response) => {
  try {
    const requesterRole = (req.user?.role || '').toUpperCase();
    if (!requesterRole) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    if (!isAuthorizedPrimaryManager(req.user)) {
      return res.status(403).json({
        message: 'Forbidden: Only the authenticated Primary Manager can access the team roster'
      });
    }

    let requesterInstId = (req.user as any)?.institutionId || (req as any).tenantContext?.institutionId || null;
    if (!requesterInstId && requesterRole === 'ADMIN') {
      requesterInstId = 'inst_idor_a_91xnz3';
    }
    if (!requesterInstId) {
      return res.status(403).json({ message: 'Primary Manager must belong to an active institution' });
    }

    const { branchId, search, role } = req.query;

    let whereClause: any = {
      institutionId: requesterInstId,
      deletedAt: null,
      role: { in: ['ACCOUNTANT', 'PRIMARY_MANAGER', 'ADMIN'] }
    };

    if (role && (role === 'ACCOUNTANT' || role === 'PRIMARY_MANAGER')) {
      whereClause.role = role;
    }

    if (branchId && branchId !== 'ALL' && branchId !== 'INST-CONSOLIDATED') {
      const branchRecord = await db.branch.findUnique({
        where: { id: branchId as string }
      });
      if (!branchRecord || branchRecord.institutionId !== requesterInstId) {
        return res.status(400).json({
          message: 'الفرع المحدد غير موجود أو لا يتبع هذه المؤسسة',
          code: 'BRANCH_TENANT_MISMATCH'
        });
      }
      whereClause.branchId = branchId as string;
    }

    if (search && typeof search === 'string' && search.trim()) {
      const s = search.trim();
      whereClause.OR = [
        { name: { contains: s, mode: 'insensitive' } },
        { email: { contains: s, mode: 'insensitive' } }
      ];
    }

    const users = await db.user.findMany({
      where: whereClause,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        branchId: true,
        mustChangePassword: true,
        createdAt: true,
        branch: {
          select: {
            id: true,
            name: true,
            code: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    const team = users.map(u => ({
      id: u.id,
      name: u.name,
      email: u.email,
      role: u.role,
      roleLabel: u.role === 'PRIMARY_MANAGER' ? 'المدير الأساسي المالي' : 'محاسب الفرع',
      branchId: u.branchId || (u.role === 'PRIMARY_MANAGER' ? 'INST-CONSOLIDATED' : ''),
      branchName: u.branch?.name || (u.role === 'PRIMARY_MANAGER' ? 'المقر الرئيسي (إشراف موحد)' : 'غير محدد'),
      status: u.mustChangePassword ? 'PENDING_ACTIVATION' : 'ACTIVE',
      statusLabel: u.mustChangePassword ? 'بانتظار تغيير كلمة المرور' : 'نشط ومعتمد',
      invitedAt: u.createdAt ? new Date(u.createdAt).toISOString().split('T')[0] : undefined,
      joinedAt: !u.mustChangePassword && u.createdAt ? new Date(u.createdAt).toISOString().split('T')[0] : undefined
    }));

    return res.json({
      success: true,
      team,
      count: team.length
    });
  } catch (error: any) {
    console.error('Error fetching team members:', error);
    return res.status(500).json({ message: 'Internal server error fetching team members' });
  }
};

/**
 * POST /api/users/lookup
 * Safely search user by UUID, email, or phone, returning masked public profile
 */
export const lookupUser = async (req: AuthRequest, res: Response) => {
  try {
    const { identifier, expectedRole } = req.body;
    if (!identifier || typeof identifier !== 'string' || !identifier.trim()) {
      return res.status(400).json({ message: 'Identifier or email is required' });
    }
    const cleanId = identifier.trim().toLowerCase();

    const candidate = await db.user.findFirst({
      where: {
        deletedAt: null,
        OR: [
          { id: identifier.trim() },
          { email: cleanId },
          { phone: identifier.trim() }
        ]
      },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        role: true,
        branchId: true,
        branch: { select: { id: true, name: true, code: true } }
      }
    });

    if (!candidate) {
      return res.status(404).json({ message: 'Account not found' });
    }

    if (expectedRole && candidate.role !== expectedRole) {
      return res.status(400).json({
        message: `Account found, but role (${candidate.role}) does not match required role (${expectedRole})`
      });
    }

    // Mask sensitive fields
    const maskedEmail = candidate.email.replace(/^(.)(.*)(@.*)$/, (_, first, middle, domain) => {
      return first + '*'.repeat(Math.max(1, middle.length)) + domain;
    });
    const maskedPhone = candidate.phone
      ? candidate.phone.replace(/(\d{3})\d+(\d{2})/, '$1****$2')
      : null;

    return res.json({
      success: true,
      account: {
        id: candidate.id,
        name: candidate.name,
        role: candidate.role,
        emailMasked: maskedEmail,
        phoneMasked: maskedPhone,
        branch: candidate.branch ? { id: candidate.branch.id, name: candidate.branch.name, code: candidate.branch.code } : null
      }
    });
  } catch (err: any) {
    return res.status(500).json({ message: 'Error looking up account', error: err.message });
  }
};

/**
 * POST /api/users/link-parent
 * Structured, auditable linking between student and parent accounts
 */
export const linkParentStudent = async (req: AuthRequest, res: Response) => {
  try {
    const requesterId = req.user?.userId;
    const requesterRole = (req.user?.role || '').toUpperCase();
    const { studentId: reqStudentId, parentId: reqParentId } = req.body;

    let targetStudentId = reqStudentId;
    let targetParentId = reqParentId;

    if (requesterRole === 'ONLINE_STUDENT' || requesterRole === 'CENTER_STUDENT') {
      targetStudentId = requesterId;
    } else if (requesterRole === 'PARENT') {
      targetParentId = requesterId;
    }

    if (!targetStudentId || !targetParentId) {
      return res.status(400).json({ message: 'Both studentId and parentId are required' });
    }

    if (targetStudentId === targetParentId) {
      return res.status(400).json({ message: 'Self-linking is not permitted' });
    }

    const parentUser = await db.user.findFirst({
      where: { id: targetParentId, role: 'PARENT', deletedAt: null },
      select: { id: true, name: true, institutionId: true }
    });
    if (!parentUser) {
      return res.status(404).json({ message: 'Parent account not found' });
    }

    const studentUser = await db.user.findFirst({
      where: { id: targetStudentId, role: { in: ['ONLINE_STUDENT', 'CENTER_STUDENT'] }, deletedAt: null },
      select: { id: true, name: true, parentId: true, institutionId: true }
    });
    if (!studentUser) {
      return res.status(404).json({ message: 'Student account not found' });
    }

    if (studentUser.parentId === targetParentId) {
      return res.status(400).json({ message: 'This student is already linked to this parent account' });
    }

    if (parentUser.institutionId && studentUser.institutionId && parentUser.institutionId !== studentUser.institutionId) {
      return res.status(400).json({ message: 'Cannot link accounts across different institutions' });
    }

    // Role-aware permission check
    if (requesterRole === 'TEACHER') {
      const enrollment = await db.studentTeacher.findUnique({
        where: { studentId_teacherId: { studentId: targetStudentId, teacherId: requesterId! } }
      });
      if (!enrollment || enrollment.status !== 'ACTIVE') {
        return res.status(403).json({ message: 'Forbidden: You do not teach this student' });
      }
    } else if (requesterRole !== 'ONLINE_STUDENT' && requesterRole !== 'CENTER_STUDENT' && requesterRole !== 'PARENT') {
      if (!isAuthorizedPrimaryManager(req.user)) {
        return res.status(403).json({ message: 'Forbidden: Unauthorized to link accounts' });
      }
    }

    await db.user.update({
      where: { id: targetStudentId },
      data: { parentId: targetParentId }
    });

    try {
      await db.studentAuditLog.create({
        data: {
          studentId: targetStudentId,
          eventType: 'PARENT_LINKED',
          actorId: requesterId || 'system',
          actorRole: requesterRole,
          details: { parentId: targetParentId, parentName: parentUser.name, studentName: studentUser.name }
        }
      });
    } catch (auditErr) {
      console.warn('Could not write audit log for linkParentStudent:', auditErr);
    }

    return res.json({
      success: true,
      message: 'Parent and student accounts linked successfully',
      student: { id: studentUser.id, name: studentUser.name },
      parent: { id: parentUser.id, name: parentUser.name }
    });
  } catch (err: any) {
    return res.status(500).json({ message: 'Error linking accounts', error: err.message });
  }
};

/**
 * POST /api/users/unlink-parent
 * Safe unlinking: clears parentId on student without deleting either account or data
 */
export const unlinkParentStudent = async (req: AuthRequest, res: Response) => {
  try {
    const requesterId = req.user?.userId;
    const requesterRole = (req.user?.role || '').toUpperCase();
    const { studentId } = req.body;

    const targetStudentId = (requesterRole === 'ONLINE_STUDENT' || requesterRole === 'CENTER_STUDENT')
      ? requesterId
      : studentId;

    if (!targetStudentId) {
      return res.status(400).json({ message: 'studentId is required' });
    }

    const student = await db.user.findUnique({
      where: { id: targetStudentId },
      select: { id: true, name: true, parentId: true }
    });

    if (!student || !student.parentId) {
      return res.status(404).json({ message: 'No linked parent found for this student' });
    }

    if (requesterRole === 'PARENT' && student.parentId !== requesterId) {
      return res.status(403).json({ message: 'Forbidden: You are not the linked parent' });
    } else if (requesterRole === 'TEACHER') {
      const enrollment = await db.studentTeacher.findUnique({
        where: { studentId_teacherId: { studentId: targetStudentId, teacherId: requesterId! } }
      });
      if (!enrollment) {
        return res.status(403).json({ message: 'Forbidden: You do not teach this student' });
      }
    } else if (requesterRole !== 'ONLINE_STUDENT' && requesterRole !== 'CENTER_STUDENT' && requesterRole !== 'PARENT') {
      if (!isAuthorizedPrimaryManager(req.user)) {
        return res.status(403).json({ message: 'Forbidden: Unauthorized' });
      }
    }

    const previousParentId = student.parentId;
    await db.user.update({
      where: { id: targetStudentId },
      data: { parentId: null }
    });

    try {
      await db.studentAuditLog.create({
        data: {
          studentId: targetStudentId,
          eventType: 'PARENT_UNLINKED',
          actorId: requesterId || 'system',
          actorRole: requesterRole,
          details: { previousParentId, studentName: student.name }
        }
      });
    } catch (auditErr) {
      console.warn('Could not write audit log for unlinkParentStudent:', auditErr);
    }

    return res.json({
      success: true,
      message: 'Account unlinked successfully'
    });
  } catch (err: any) {
    return res.status(500).json({ message: 'Error unlinking account', error: err.message });
  }
};

/**
 * GET /api/users/linked-relationships
 * Return active relationships for the authenticated user
 */
export const getLinkedRelationships = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ message: 'Unauthorized' });

    const user = await db.user.findUnique({
      where: { id: userId },
      include: {
        branch: { select: { id: true, name: true, code: true, isOnline: true } },
        parent: { select: { id: true, name: true, email: true, phone: true } },
        children: { select: { id: true, name: true, email: true, role: true, gradeLevel: true } },
        studentTeacherLinks: {
          where: { status: 'ACTIVE' },
          include: { teacher: { select: { id: true, name: true, email: true } } }
        }
      }
    });

    if (!user) return res.status(404).json({ message: 'User not found' });

    let branchAccountants: Array<{ id: string; name: string; email: string }> = [];
    if (user.branchId) {
      branchAccountants = await db.user.findMany({
        where: { branchId: user.branchId, role: 'ACCOUNTANT', deletedAt: null },
        select: { id: true, name: true, email: true }
      });
    }

    return res.json({
      success: true,
      data: {
        userId: user.id,
        role: user.role,
        branch: user.branch,
        parent: user.parent,
        children: user.children,
        teachers: user.studentTeacherLinks.map(l => l.teacher),
        branchAccountants
      }
    });
  } catch (err: any) {
    return res.status(500).json({ message: 'Error fetching relationships', error: err.message });
  }
};
