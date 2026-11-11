import { Response } from 'express';
import { db } from '../../../../packages/database/src/index.js';
import { AuthRequest } from '../middlewares/auth.middleware.js';
import { z } from 'zod';
import { logger } from '@shared/utils';

const markAttendanceSchema = z.object({
  studentId: z.string().uuid(),
  status: z.enum(['PRESENT', 'ABSENT', 'LATE', 'CANCELLED']),
  date: z.string().optional()
});

const updateAttendanceSchema = z.object({
  status: z.enum(['PRESENT', 'ABSENT', 'LATE', 'CANCELLED']).optional(),
  date: z.string().optional()
});

const bulkMarkAttendanceSchema = z.object({
  records: z.array(z.object({
    studentId: z.string().uuid(),
    status: z.enum(['PRESENT', 'ABSENT', 'LATE', 'CANCELLED', 'UNSET', 'UNRECORDED'])
  })).min(1),
  date: z.string().optional()
});

const clearAttendanceSchema = z.object({
  studentId: z.string().uuid(),
  date: z.string().optional()
});

const statusMapArabic: Record<string, string> = {
  'PRESENT': 'حاضر',
  'ABSENT': 'غائب',
  'LATE': 'متأخر',
  'CANCELLED': 'ملغي'
};

/**
 * Normalizes any date string or Date object to the UTC day boundaries (00:00:00 to 23:59:59.999)
 * to ensure consistent date-only uniqueness and prevent timezone shifting.
 */
function normalizeDateRange(dateInput?: string | Date): { dayStart: Date; dayEnd: Date } {
  let year: number, month: number, day: number;
  if (typeof dateInput === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateInput.trim())) {
    const parts = dateInput.trim().split('-').map(Number);
    year = parts[0];
    month = parts[1] - 1;
    day = parts[2];
  } else {
    const parsed = dateInput ? new Date(dateInput) : new Date();
    if (isNaN(parsed.getTime())) {
      throw new Error('Invalid date format');
    }
    year = parsed.getUTCFullYear();
    month = parsed.getUTCMonth();
    day = parsed.getUTCDate();
  }
  const dayStart = new Date(Date.UTC(year, month, day, 0, 0, 0, 0));
  const dayEnd = new Date(Date.UTC(year, month, day, 23, 59, 59, 999));
  return { dayStart, dayEnd };
}

export interface AttendanceRequesterContext {
  userId?: string;
  role?: string;
  institutionId?: string | null;
  branchId?: string | null;
  isPrimaryManager?: boolean;
}

export function extractAttendanceRequesterContext(req: AuthRequest): AttendanceRequesterContext {
  return {
    userId: req.user?.userId || (req as any).tenantContext?.userId,
    role: (req.user?.role || (req as any).tenantContext?.role || '').toUpperCase(),
    institutionId: (req as any).tenantContext?.institutionId ?? req.user?.institutionId ?? null,
    branchId: (req as any).tenantContext?.branchId ?? req.user?.branchId ?? null,
    isPrimaryManager: Boolean(req.user?.isPrimaryManager || (req as any).tenantContext?.isPrimaryManager)
  };
}

/**
 * Strict fail-closed verification of teacher/admin authorization for managing student attendance.
 * Enforces:
 * 1. Valid authenticated requester identity with authoritative institution context.
 * 2. Target student exists, is active (deletedAt is null), and belongs to the exact same institution.
 * 3. Branch boundaries: If requester is branch-scoped, target student must belong to the exact same branch.
 * 4. Educational relationship (for TEACHER): Requester must be linked via active StudentTeacher record
 *    OR student must be enrolled in an active course taught by the requester.
 * 5. Managers/Admins: Authorized across their institution (or branch if branch-scoped).
 */
export async function verifyTeacherOrAdminAccess(
  requester: AttendanceRequesterContext,
  studentId: string
): Promise<{ authorized: boolean; reason?: string }> {
  const { userId: requesterId, role: requesterRole, institutionId, branchId } = requester;

  if (!requesterId || !institutionId) {
    return { authorized: false, reason: 'Missing requester identity or institution context' };
  }

  const role = (requesterRole || '').toUpperCase();
  if (role !== 'ADMIN' && role !== 'PRIMARY_MANAGER' && role !== 'TEACHER') {
    return { authorized: false, reason: 'Unsupported role for attendance management' };
  }

  // 1. Fetch student with tenant and branch boundaries
  const student = await db.user.findUnique({
    where: { id: studentId },
    select: {
      id: true,
      role: true,
      institutionId: true,
      branchId: true,
      deletedAt: true
    }
  });

  if (!student || student.deletedAt) {
    return { authorized: false, reason: 'Student not found or deleted' };
  }

  // 2. Strict Institution Isolation (Cross-tenant access forbidden)
  if (!student.institutionId || student.institutionId !== institutionId) {
    return { authorized: false, reason: 'Cross-tenant student access forbidden' };
  }

  // 3. Ensure target is actually a student
  const studentRoleStr = String(student.role).toUpperCase();
  const validStudentRoles = ['STUDENT', 'ONLINE_STUDENT', 'EXTERNAL_STUDENT'];
  if (!validStudentRoles.includes(studentRoleStr)) {
    return { authorized: false, reason: 'Target user is not a student' };
  }

  // 4. Branch Scoping (Phase II-D-B Remediation D: Explicit Branch Scope for Teachers)
  if (role === 'TEACHER') {
    if (!branchId) {
      return { authorized: false, reason: 'Teacher must be assigned to an authoritative branch to manage attendance' };
    }
    if (!student.branchId) {
      return { authorized: false, reason: 'Student must be assigned to an authoritative branch' };
    }
    if (student.branchId !== branchId) {
      return { authorized: false, reason: 'Cross-branch student access forbidden' };
    }
  } else if (branchId) {
    // For branch-assigned admins and managers
    if (!student.branchId || student.branchId !== branchId) {
      return { authorized: false, reason: 'Cross-branch student access forbidden' };
    }
  } else if (!requester.isPrimaryManager) {
    // Workstream C (GAP-IIDD-002): Fail-closed for unassigned Ordinary Admin
    return {
      authorized: false,
      reason: 'Administrator must be assigned to an authoritative branch or possess Primary Manager authorization'
    };
  }

  // 5. Manager / Admin Role Hierarchy
  if (role === 'ADMIN' || role === 'PRIMARY_MANAGER') {
    return { authorized: true };
  }

  // 6. Teacher Educational Relationship Verification
  if (role === 'TEACHER') {
    // Check 6a: Active direct StudentTeacher link
    const directLink = await db.studentTeacher.findFirst({
      where: {
        teacherId: requesterId,
        studentId: studentId,
        status: 'ACTIVE'
      }
    });

    if (directLink) {
      return { authorized: true };
    }

    // Check 6b: Enrollment in teacher-owned course
    const courseEnrollment = await db.courseEnrollment.findFirst({
      where: {
        studentId: studentId,
        course: {
          teacherId: requesterId,
          institutionId: institutionId,
          deletedAt: null
        }
      }
    });

    if (courseEnrollment) {
      return { authorized: true };
    }

    return { authorized: false, reason: 'No authorized educational relationship with student' };
  }

  return { authorized: false, reason: 'Unauthorized' };
}

/**
 * Calculate attendance statistics summary
 */
function calculateAttendanceSummary(records: any[]) {
  const totalSessions = records.length;
  const presentCount = records.filter(r => r.status === 'PRESENT').length;
  const absentCount = records.filter(r => r.status === 'ABSENT').length;
  const lateCount = records.filter(r => r.status === 'LATE').length;
  const percentage = totalSessions > 0 ? Math.round(((presentCount + lateCount) / totalSessions) * 100) : 0;

  return {
    totalSessions,
    presentCount,
    absentCount,
    lateCount,
    percentage: totalSessions > 0 ? percentage : null
  };
}

/**
 * POST /api/attendance
 * Mark or upsert attendance for a single student on a given date.
 */
export const markAttendance = async (req: AuthRequest, res: Response) => {
  try {
    const validatedData = markAttendanceSchema.parse(req.body);
    const requester = extractAttendanceRequesterContext(req);

    if (!requester.userId) return res.status(401).json({ message: 'Unauthorized' });
    if (!requester.institutionId) return res.status(401).json({ message: 'Unauthorized: Missing tenant identity' });

    if (requester.role !== 'TEACHER' && requester.role !== 'ADMIN' && requester.role !== 'PRIMARY_MANAGER') {
      return res.status(403).json({ message: 'Forbidden: Only teachers and admins can mark attendance' });
    }

    const authCheck = await verifyTeacherOrAdminAccess(requester, validatedData.studentId);
    if (!authCheck.authorized) {
      return res.status(403).json({ message: `Forbidden: ${authCheck.reason || 'Unauthorized student access'}` });
    }

    const { dayStart, dayEnd } = normalizeDateRange(validatedData.date);

    // Check if attendance record already exists for this student on this date
    const existing = await db.attendance.findFirst({
      where: {
        studentId: validatedData.studentId,
        date: {
          gte: dayStart,
          lte: dayEnd
        }
      }
    });

    let attendance;
    let statusCode = 201;

    if (existing) {
      // Idempotent update of existing day record
      attendance = await db.attendance.update({
        where: { id: existing.id },
        data: {
          status: validatedData.status,
          date: dayStart
        }
      });
      statusCode = 200;
    } else {
      // Create new attendance record
      attendance = await db.attendance.create({
        data: {
          studentId: validatedData.studentId,
          date: dayStart,
          status: validatedData.status
        }
      });
      statusCode = 201;
    }

    const statusArabic = statusMapArabic[validatedData.status] || validatedData.status;

    // Send notification to student
    try {
      await db.notification.create({
        data: {
          userId: validatedData.studentId,
          title: 'تسجيل الحضور',
          message: `تم تسجيلك كـ "${statusArabic}" في الحصة بتاريخ ${dayStart.toLocaleDateString('ar-EG')}`,
          type: 'info'
        }
      });
    } catch (notifErr: any) {
      // Non-blocking notification failure with structured logging (OBS-IIDD-001)
      logger.error(`[AttendanceNotification] Failed to create attendance notification for student ${validatedData.studentId}: ${notifErr?.message || notifErr}`);
    }

    res.status(statusCode).json(attendance);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ errors: error.errors });
    }
    res.status(500).json({ message: 'Error marking attendance', error: error.message });
  }
};

/**
 * GET /api/attendance/my-attendance
 * Retrieve attendance history and summary for the authenticated student.
 */
export const getStudentAttendance = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ message: 'Unauthorized' });

    const records = await db.attendance.findMany({
      where: { studentId: userId },
      orderBy: { date: 'desc' }
    });

    const summary = calculateAttendanceSummary(records);

    res.json({
      data: records,
      summary
    });
  } catch (error: any) {
    res.status(500).json({ message: 'Error fetching attendance', error: error.message });
  }
};

/**
 * GET /api/attendance/student/:studentId
 * Retrieve attendance history and summary for a specific student (Teacher / Admin / Parent).
 */
export const getStudentAttendanceById = async (req: AuthRequest, res: Response) => {
  try {
    const { studentId } = req.params;
    const requester = extractAttendanceRequesterContext(req);
    const requesterRole = (requester.role || '').toUpperCase();

    if (!requester.userId) return res.status(401).json({ message: 'Unauthorized' });

    if (requesterRole.includes('STUDENT')) {
      if (studentId !== requester.userId) {
        return res.status(403).json({ message: 'Access denied: You can only view your own attendance' });
      }
    } else if (requesterRole === 'PARENT') {
      const parentUser = await db.user.findFirst({
        where: { id: requester.userId, children: { some: { id: studentId } } }
      });
      if (!parentUser) {
        return res.status(403).json({ message: 'Access denied: Student is not your registered child' });
      }
    } else {
      const authCheck = await verifyTeacherOrAdminAccess(requester, studentId);
      if (!authCheck.authorized) {
        return res.status(403).json({ message: `Access denied: ${authCheck.reason || 'Student is not in your courses or classes'}` });
      }
    }

    const records = await db.attendance.findMany({
      where: { studentId },
      orderBy: { date: 'desc' }
    });

    const summary = calculateAttendanceSummary(records);

    res.json({
      data: records,
      summary
    });
  } catch (error: any) {
    res.status(500).json({ message: 'Error fetching student attendance', error: error.message });
  }
};

/**
 * GET /api/attendance/:studentId/percentage
 * Legacy / backward-compatible percentage endpoint.
 */
export const getAttendancePercentage = async (req: AuthRequest, res: Response) => {
  try {
    const { studentId } = req.params;
    const requester = extractAttendanceRequesterContext(req);
    const requesterRole = (requester.role || '').toUpperCase();

    if (!requester.userId) return res.status(401).json({ message: 'Unauthorized' });

    if (requesterRole.includes('STUDENT')) {
      if (studentId !== requester.userId) {
        return res.status(403).json({ message: 'Access denied. You can only view your own attendance.' });
      }
    } else if (requesterRole === 'PARENT') {
      const parentUser = await db.user.findFirst({
        where: { id: requester.userId, children: { some: { id: studentId } } }
      });
      if (!parentUser) {
        return res.status(403).json({ message: 'Access denied: Student is not your child' });
      }
    } else {
      const authCheck = await verifyTeacherOrAdminAccess(requester, studentId);
      if (!authCheck.authorized) {
        return res.status(403).json({ message: `Access denied: ${authCheck.reason || 'Student is not enrolled in your courses.'}` });
      }
    }

    const records = await db.attendance.findMany({
      where: { studentId }
    });

    if (records.length === 0) {
      return res.json({ percentage: null, message: 'لا توجد بيانات' });
    }

    const summary = calculateAttendanceSummary(records);

    res.json({
      percentage: summary.percentage,
      totalSessions: summary.totalSessions,
      present: summary.presentCount + summary.lateCount,
      presentCount: summary.presentCount,
      absentCount: summary.absentCount,
      lateCount: summary.lateCount
    });
  } catch (error: any) {
    res.status(500).json({ message: 'Error calculating attendance percentage', error: error.message });
  }
};

/**
 * PUT /api/attendance/:id
 * Update an existing attendance record.
 */
export const updateAttendanceRecord = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const validatedData = updateAttendanceSchema.parse(req.body);
    const requester = extractAttendanceRequesterContext(req);

    if (!requester.userId) return res.status(401).json({ message: 'Unauthorized' });
    if (!requester.institutionId) return res.status(401).json({ message: 'Unauthorized: Missing tenant identity' });

    if (requester.role !== 'TEACHER' && requester.role !== 'ADMIN' && requester.role !== 'PRIMARY_MANAGER') {
      return res.status(403).json({ message: 'Forbidden: Only teachers and admins can modify attendance' });
    }

    const existing = await db.attendance.findUnique({
      where: { id },
      include: {
        student: {
          select: {
            id: true,
            role: true,
            institutionId: true,
            branchId: true,
            deletedAt: true
          }
        }
      }
    });

    // Uniform fail-closed response for nonexistent, foreign-tenant, or unauthorized records (DEF-AUDIT-002)
    if (!existing || existing.student?.deletedAt || existing.student?.institutionId !== requester.institutionId) {
      return res.status(404).json({ message: 'Attendance record not found' });
    }

    const authCheck = await verifyTeacherOrAdminAccess(requester, existing.studentId);
    if (!authCheck.authorized) {
      return res.status(404).json({ message: 'Attendance record not found' });
    }

    let updatedDate = existing.date;
    if (validatedData.date) {
      const { dayStart } = normalizeDateRange(validatedData.date);
      updatedDate = dayStart;
    }

    const updated = await db.attendance.update({
      where: { id },
      data: {
        status: validatedData.status || existing.status,
        date: updatedDate
      }
    });

    res.json(updated);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ errors: error.errors });
    }
    res.status(500).json({ message: 'Error updating attendance record', error: error.message });
  }
};

/**
 * DELETE /api/attendance/:id
 * Delete an attendance record.
 */
export const deleteAttendanceRecord = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const requester = extractAttendanceRequesterContext(req);

    if (!requester.userId) return res.status(401).json({ message: 'Unauthorized' });
    if (!requester.institutionId) return res.status(401).json({ message: 'Unauthorized: Missing tenant identity' });

    if (requester.role !== 'TEACHER' && requester.role !== 'ADMIN' && requester.role !== 'PRIMARY_MANAGER') {
      return res.status(403).json({ message: 'Forbidden: Only teachers and admins can delete attendance' });
    }

    const existing = await db.attendance.findUnique({
      where: { id },
      include: {
        student: {
          select: {
            id: true,
            role: true,
            institutionId: true,
            branchId: true,
            deletedAt: true
          }
        }
      }
    });

    // Uniform fail-closed response for nonexistent, foreign-tenant, or unauthorized records (DEF-AUDIT-002)
    if (!existing || existing.student?.deletedAt || existing.student?.institutionId !== requester.institutionId) {
      return res.status(404).json({ message: 'Attendance record not found' });
    }

    const authCheck = await verifyTeacherOrAdminAccess(requester, existing.studentId);
    if (!authCheck.authorized) {
      return res.status(404).json({ message: 'Attendance record not found' });
    }

    await db.attendance.delete({ where: { id } });

    res.json({ message: 'Attendance record deleted successfully', id });
  } catch (error: any) {
    res.status(500).json({ message: 'Error deleting attendance record', error: error.message });
  }
};

/**
 * GET /api/attendance/by-date?date=YYYY-MM-DD
 * Retrieve attendance records for the requester's authorized students for a specific date.
 */
export const getAttendanceByDate = async (req: AuthRequest, res: Response) => {
  try {
    const requester = extractAttendanceRequesterContext(req);
    const dateQuery = req.query.date as string;

    if (!requester.userId) return res.status(401).json({ message: 'Unauthorized' });
    if (!requester.institutionId) return res.status(401).json({ message: 'Unauthorized: Missing tenant identity' });

    if (requester.role !== 'TEACHER' && requester.role !== 'ADMIN' && requester.role !== 'PRIMARY_MANAGER') {
      return res.status(403).json({ message: 'Forbidden: Only teachers and admins can access attendance by date' });
    }

    const { dayStart, dayEnd } = normalizeDateRange(dateQuery);

    const studentWhere: any = {
      institutionId: requester.institutionId,
      deletedAt: null
    };

    if (requester.role === 'TEACHER') {
      if (!requester.branchId) {
        return res.status(403).json({ message: 'Forbidden: Teacher must be assigned to an authoritative branch' });
      }
      studentWhere.branchId = requester.branchId;
      studentWhere.OR = [
        {
          studentTeacherLinks: {
            some: {
              teacherId: requester.userId,
              status: 'ACTIVE'
            }
          }
        },
        {
          enrollments: {
            some: {
              course: {
                teacherId: requester.userId,
                deletedAt: null
              }
            }
          }
        }
      ];
    } else {
      // ADMIN or PRIMARY_MANAGER
      if (requester.branchId) {
        // Workstream B (GAP-IIDD-001): Scope branch-assigned administrator strictly to their branch on date read
        studentWhere.branchId = requester.branchId;
      } else if (!requester.isPrimaryManager) {
        // Workstream C (GAP-IIDD-002): Fail-closed for unassigned Ordinary Admin
        return res.status(403).json({
          message: 'Forbidden: Administrator must be assigned to an authoritative branch or possess Primary Manager authorization'
        });
      }
      // Authorized institution-wide Primary Manager retains full institution-wide scope
    }

    const records = await db.attendance.findMany({
      where: {
        date: {
          gte: dayStart,
          lte: dayEnd
        },
        student: studentWhere
      },
      include: {
        student: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            gradeLevel: true,
            educationLevel: true,
            branchId: true
          }
        }
      },
      orderBy: { createdAt: 'asc' }
    });

    res.json({
      date: dayStart.toISOString().split('T')[0],
      dayStart,
      dayEnd,
      count: records.length,
      data: records
    });
  } catch (error: any) {
    res.status(500).json({ message: 'Error fetching attendance by date', error: error.message });
  }
};

/**
 * POST /api/attendance/bulk
 * Bulk mark/upsert attendance for multiple students in a class or course session.
 */
export const bulkMarkAttendance = async (req: AuthRequest, res: Response) => {
  try {
    const validatedData = bulkMarkAttendanceSchema.parse(req.body);
    const requester = extractAttendanceRequesterContext(req);

    if (!requester.userId) return res.status(401).json({ message: 'Unauthorized' });
    if (!requester.institutionId) return res.status(401).json({ message: 'Unauthorized: Missing tenant identity' });

    if (requester.role !== 'TEACHER' && requester.role !== 'ADMIN' && requester.role !== 'PRIMARY_MANAGER') {
      return res.status(403).json({ message: 'Forbidden: Only teachers and admins can mark attendance' });
    }

    const { dayStart, dayEnd } = normalizeDateRange(validatedData.date);
    const results: any[] = [];
    let presentCount = 0;
    let lateCount = 0;
    let absentCount = 0;
    let cancelledCount = 0;

    // Deduplicate records in payload by studentId to prevent duplicate processing
    const seenStudentIds = new Set<string>();
    const uniqueRecords = validatedData.records.filter(item => {
      if (seenStudentIds.has(item.studentId)) return false;
      seenStudentIds.add(item.studentId);
      return true;
    });

    // ATOMIC PRE-VALIDATION: Ensure all target students are authorized.
    // If any student is unauthorized, fail closed with 403 and do not mutate ANY record.
    for (const item of uniqueRecords) {
      const authCheck = await verifyTeacherOrAdminAccess(requester, item.studentId);
      if (!authCheck.authorized) {
        return res.status(403).json({
          success: false,
          message: `Forbidden: Unauthorized attendance modification for student ${item.studentId}. Reason: ${authCheck.reason}`,
          unauthorizedStudentId: item.studentId
        });
      }
    }

    // Collect pending notifications to dispatch outside the transaction
    const pendingNotifications: Array<{ userId: string; title: string; message: string }> = [];

    // DATABASE TRANSACTION ATOMICITY (Phase II-D-B Remediation C):
    // All attendance creates, updates, and deletes execute within a single transaction.
    // If any operation fails, Prisma rolls back all mutations in the batch.
    await db.$transaction(async (tx: any) => {
      for (const item of uniqueRecords) {
        const existing = await tx.attendance.findFirst({
          where: {
            studentId: item.studentId,
            date: { gte: dayStart, lte: dayEnd }
          }
        });

        // Handle explicit deselection / unrecording (Phase II-C Attendance Correction)
        if (item.status === 'UNSET' || item.status === 'UNRECORDED') {
          if (existing) {
            await tx.attendance.delete({ where: { id: existing.id } });
            results.push({ studentId: item.studentId, status: 'UNRECORDED', action: 'CLEARED' });
          }
          continue;
        }

        if (item.status === 'PRESENT') presentCount++;
        else if (item.status === 'LATE') lateCount++;
        else if (item.status === 'ABSENT') absentCount++;
        else if (item.status === 'CANCELLED') cancelledCount++;

        let record;
        if (existing) {
          record = await tx.attendance.update({
            where: { id: existing.id },
            data: { status: item.status, date: dayStart }
          });

          // Queue notification if status changed
          if (existing.status !== item.status) {
            const statusArabic = statusMapArabic[item.status] || item.status;
            pendingNotifications.push({
              userId: item.studentId,
              title: 'تحديث الحضور',
              message: `تم تحديث حالتك إلى "${statusArabic}" في الحصة بتاريخ ${dayStart.toLocaleDateString('ar-EG')}`
            });
          }
        } else {
          record = await tx.attendance.create({
            data: { studentId: item.studentId, date: dayStart, status: item.status }
          });

          const statusArabic = statusMapArabic[item.status] || item.status;
          pendingNotifications.push({
            userId: item.studentId,
            title: 'تسجيل الحضور',
            message: `تم تسجيلك كـ "${statusArabic}" في الحصة بتاريخ ${dayStart.toLocaleDateString('ar-EG')}`
          });
        }
        results.push(record);
      }
    });

    // Dispatch queued notifications after transaction commits successfully (safe side-effect)
    for (const notif of pendingNotifications) {
      try {
        await db.notification.create({
          data: {
            userId: notif.userId,
            title: notif.title,
            message: notif.message,
            type: 'info'
          }
        });
      } catch (notifErr: any) {
        // Non-blocking notification failure with structured logging (OBS-IIDD-001)
        logger.error(`[AttendanceNotification] Failed to dispatch bulk attendance notification for student ${notif.userId}: ${notifErr?.message || notifErr}`);
      }
    }

    if (results.length === 0 && validatedData.records.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'لم يتم حفظ أي سجلات: معرفات الطلاب غير صالحة أو غير موجودة.',
        count: 0
      });
    }

    res.json({
      success: true,
      count: results.length,
      summary: {
        total: results.length,
        present: presentCount,
        late: lateCount,
        absent: absentCount,
        cancelled: cancelledCount
      },
      data: results
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ errors: error.errors });
    }
    res.status(500).json({ message: 'Error bulk marking attendance', error: error.message });
  }
};

/**
 * POST /api/attendance/clear
 * Safely deselects/cancels attendance for a student on a specific date,
 * reverting the status to unrecorded without affecting enrollment.
 */
export const clearAttendanceRecord = async (req: AuthRequest, res: Response) => {
  try {
    const validatedData = clearAttendanceSchema.parse(req.body);
    const requester = extractAttendanceRequesterContext(req);

    if (!requester.userId) return res.status(401).json({ message: 'Unauthorized' });
    if (!requester.institutionId) return res.status(401).json({ message: 'Unauthorized: Missing tenant identity' });

    if (requester.role !== 'TEACHER' && requester.role !== 'ADMIN' && requester.role !== 'PRIMARY_MANAGER') {
      return res.status(403).json({ message: 'Forbidden: Only teachers and admins can modify attendance' });
    }

    const authCheck = await verifyTeacherOrAdminAccess(requester, validatedData.studentId);
    if (!authCheck.authorized) {
      return res.status(403).json({ message: `Forbidden: ${authCheck.reason || 'Unauthorized student access'}` });
    }

    const { dayStart, dayEnd } = normalizeDateRange(validatedData.date);
    const existing = await db.attendance.findFirst({
      where: {
        studentId: validatedData.studentId,
        date: { gte: dayStart, lte: dayEnd }
      }
    });

    if (existing) {
      await db.attendance.delete({ where: { id: existing.id } });
      return res.json({ success: true, message: 'تم إلغاء تسجيل الحضور وإعادته لغير مسجل', studentId: validatedData.studentId, action: 'CLEARED' });
    }

    return res.json({ success: true, message: 'لا يوجد تسجيل حضور سابق لهذا اليوم', studentId: validatedData.studentId, action: 'NONE' });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ errors: error.errors });
    }
    res.status(500).json({ message: 'Error clearing attendance record', error: error.message });
  }
};
