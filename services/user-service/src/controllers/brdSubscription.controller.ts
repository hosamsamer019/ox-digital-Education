import { Request, Response } from 'express';
import { db } from '../../../../packages/database/src/index.js';
import { AuthRequest, isAuthorizedPrimaryManager } from '../middlewares/auth.middleware.js';
import { BrdSubscriptionService } from '../services/brdSubscription.service.js';
import { runBrdDailyLockEvaluation, getCairoDateInfo } from '../jobs/brdDailyLock.scheduler.js';
import path from 'path';
import fs from 'fs';

// Allowed themes per BRD Section 15
export const ALLOWED_THEMES = ['default', 'light', 'dark', 'blue', 'green', 'purple', 'warm-orange'];

export const BrdSubscriptionController = {
  // ==========================================================================
  // TEACHER ENDPOINTS
  // ==========================================================================

  /**
   * GET /api/teacher/my-students
   * Teacher views only their own students with search, filters, subscription status
   */
  async getTeacherStudents(req: AuthRequest, res: Response) {
    try {
      const teacherId = req.user?.userId;
      const role = (req.user?.role || '').toUpperCase();

      if (role !== 'TEACHER') {
        return res.status(403).json({ message: 'Forbidden: Only teachers can access this roster' });
      }

      const { search, grade, type, subscriptionStatus } = req.query;

      const whereClause: any = {
        teacherId,
        status: 'ACTIVE'
      };

      if (subscriptionStatus) {
        whereClause.accessStatus = subscriptionStatus;
      }

      const links = await db.studentTeacher.findMany({
        where: whereClause,
        include: {
          student: {
            select: {
              id: true,
              name: true,
              email: true,
              role: true,
              gradeLevel: true,
              academicLevel: true,
              phone: true,
              createdAt: true,
              profilePictureUrl: true,
              parentId: true,
              parent: {
                select: { id: true, name: true, email: true, phone: true }
              },
              studentMonthlySubscriptions: {
                where: { teacherId },
                orderBy: [{ billingYear: 'desc' }, { billingMonth: 'desc' }],
                take: 12
              }
            }
          }
        },
        orderBy: { createdAt: 'desc' }
      });

      let results = links.map(link => {
        const student = link.student;
        const currentSub = student.studentMonthlySubscriptions[0] || null;
        return {
          id: student.id,
          name: student.name,
          email: student.email,
          role: student.role,
          gradeLevel: student.gradeLevel,
          academicLevel: student.academicLevel,
          phone: student.phone,
          profilePictureUrl: student.profilePictureUrl,
          parent: student.parent,
          accessStatus: link.accessStatus,
          exceptionActiveUntil: link.exceptionActiveUntil,
          currentSubscription: currentSub,
          recentSubscriptions: student.studentMonthlySubscriptions,
          enrolledAt: link.createdAt
        };
      });

      // Filter in-memory for search and grade/type
      if (search && typeof search === 'string') {
        const q = search.toLowerCase();
        results = results.filter(s => s.name.toLowerCase().includes(q) || s.email.toLowerCase().includes(q));
      }
      if (grade && typeof grade === 'string' && grade !== 'ALL') {
        results = results.filter(s => s.gradeLevel === grade);
      }
      if (type && typeof type === 'string' && type !== 'ALL') {
        results = results.filter(s => s.role === type);
      }

      return res.json({ success: true, count: results.length, data: results });
    } catch (err: any) {
      return res.status(500).json({ message: 'Error fetching teacher students', error: err.message });
    }
  },

  /**
   * POST /api/teacher/students
   * Teacher creates student account with automatic ownership
   */
  async teacherCreateStudent(req: AuthRequest, res: Response) {
    try {
      const teacherId = req.user?.userId;
      const role = (req.user?.role || '').toUpperCase();

      if (role !== 'TEACHER') {
        return res.status(403).json({ message: 'Forbidden: Only teachers can access this creation portal' });
      }

      const { name, email, password, gradeLevel, studentType, parentId, parentName, parentEmail, parentPhone, parentPassword, centerGroupId } = req.body;

      if (!name || !email || !gradeLevel || !studentType) {
        return res.status(400).json({ message: 'Name, email, gradeLevel, and studentType are required' });
      }

      const result = await BrdSubscriptionService.createStudentWithTeacherOwnership(
        { id: teacherId as string, role: 'TEACHER', branchId: req.user?.branchId, institutionId: req.user?.institutionId },
        {
          name,
          email,
          password,
          gradeLevel,
          studentType,
          parentId,
          parentName,
          parentEmail,
          parentPhone,
          parentPassword,
          centerGroupId
        }
      );

      return res.status(201).json({
        success: true,
        message: 'Student account created and linked automatically with teacher',
        student: result.student,
        parentId: result.parentId
      });
    } catch (err: any) {
      if (err.code === 'DUPLICATE_EMAIL') {
        return res.status(400).json({ message: err.message });
      }
      return res.status(500).json({ message: 'Error creating student account', error: err.message });
    }
  },

  /**
   * POST /api/teacher/parents
   * Teacher links or creates parent account for their student
   */
  async teacherLinkParent(req: AuthRequest, res: Response) {
    try {
      const teacherId = req.user?.userId;
      const role = (req.user?.role || '').toUpperCase();
      const institutionId = req.user?.institutionId;
      const branchId = req.user?.branchId;

      const result = await BrdSubscriptionService.teacherLinkParent(
        { id: teacherId as string, role, institutionId, branchId },
        req.body
      );

      return res.json({ success: true, message: 'Parent successfully linked to student', parentId: result.parentId });
    } catch (err: any) {
      const status = err.message?.includes('Forbidden') ? 403 : err.message?.includes('required') ? 400 : 500;
      return res.status(status).json({ message: err.message });
    }
  },

  /**
   * GET /api/teacher/pricing
   * Teacher views their own pricing & grace/lock settings (Read-only)
   */
  async getTeacherPricing(req: AuthRequest, res: Response) {
    try {
      const teacherId = req.user?.userId;
      const role = (req.user?.role || '').toUpperCase();

      if (role !== 'TEACHER') {
        return res.status(403).json({ message: 'Forbidden: Only teachers can access this pricing overview' });
      }

      const settings = await db.teacherSubscriptionSetting.findUnique({
        where: { teacherId: teacherId as string }
      });

      const pricings = await db.teacherGradePricing.findMany({
        where: { teacherId: teacherId as string },
        orderBy: [{ grade: 'asc' }, { effectiveMonth: 'desc' }]
      });

      return res.json({
        success: true,
        data: {
          teacherId,
          settings: settings || {
            lastGraceDay: 5,
            lockDay: 6,
            lockMessageAr: 'تم إيقاف الوصول مؤقتاً لعدم سداد الاشتراك الشهري. يرجى مراجعة إدارة الفرع.',
            lockMessageEn: 'Access has been temporarily suspended due to unpaid monthly subscription. Please contact branch administration.'
          },
          pricings
        }
      });
    } catch (err: any) {
      return res.status(500).json({ message: 'Error fetching teacher pricing', error: err.message });
    }
  },

  /**
   * GET /api/teacher/income-report
   * Teacher monthly income report (BRD Section 5.6)
   */
  async getTeacherIncomeReport(req: AuthRequest, res: Response) {
    try {
      const teacherId = req.user?.userId;
      const role = (req.user?.role || '').toUpperCase();
      const isPrimaryManager = isAuthorizedPrimaryManager(req.user);

      if (role !== 'TEACHER' && !isPrimaryManager) {
        return res.status(403).json({ message: 'Forbidden' });
      }

      const targetTeacherId = role === 'TEACHER' ? teacherId : (req.query.teacherId as string || teacherId);

      // Get active (non-cancelled) payments for this teacher through receipts
      const receipts = await db.branchSequentialReceipt.findMany({
        where: {
          teacherId: targetTeacherId as string,
          payment: { status: 'CONFIRMED' }
        },
        include: {
          student: { select: { id: true, name: true, gradeLevel: true } },
          payment: { select: { id: true, status: true } }
        },
        orderBy: { createdAt: 'desc' }
      });

      // Group collections by month, grade, and method
      const monthlyTotals: Record<string, {
        total: number;
        count: number;
        byGrade: Record<string, number>;
        byMethod: { CASH: number; BANK_TRANSFER: number; WALLET: number };
      }> = {};

      for (const r of receipts) {
        const d = new Date(r.createdAt);
        const mKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        const grade = (r.student.gradeLevel as string) || 'UNKNOWN';
        const method = (r.receivingMethod as 'CASH' | 'BANK_TRANSFER' | 'WALLET') || 'CASH';

        if (!monthlyTotals[mKey]) {
          monthlyTotals[mKey] = {
            total: 0,
            count: 0,
            byGrade: {},
            byMethod: { CASH: 0, BANK_TRANSFER: 0, WALLET: 0 }
          };
        }
        monthlyTotals[mKey].total += r.amount;
        monthlyTotals[mKey].count += 1;
        monthlyTotals[mKey].byGrade[grade] = (monthlyTotals[mKey].byGrade[grade] || 0) + r.amount;
        if (monthlyTotals[mKey].byMethod[method] !== undefined) {
          monthlyTotals[mKey].byMethod[method] += r.amount;
        } else {
          monthlyTotals[mKey].byMethod[method] = r.amount;
        }
      }

      return res.json({
        success: true,
        teacherId: targetTeacherId,
        totalReceiptsCount: receipts.length,
        monthlyTotals,
        receipts: receipts.slice(0, 50).map(r => ({
          id: r.id,
          receiptNumber: r.receiptNumber,
          studentName: r.student.name,
          gradeLevel: r.student.gradeLevel,
          amount: r.amount,
          receivingMethod: r.receivingMethod,
          monthsCovered: r.monthsCovered,
          createdAt: r.createdAt
        }))
      });
    } catch (err: any) {
      return res.status(500).json({ message: 'Error fetching income report', error: err.message });
    }
  },

  // ==========================================================================
  // MANAGER ENDPOINTS
  // ==========================================================================

  /**
   * GET /api/manager/branches
   * List branches with metrics
   */
  async getBranches(req: AuthRequest, res: Response) {
    try {
      if (!isAuthorizedPrimaryManager(req.user)) {
        return res.status(403).json({ message: 'Forbidden: Primary Manager access only' });
      }

      const whereClause: any = { deletedAt: null };
      if (req.user?.institutionId) {
        whereClause.institutionId = req.user.institutionId;
      }

      const branches = await db.branch.findMany({
        where: whereClause,
        include: {
          users: {
            where: { deletedAt: null },
            select: { id: true, role: true }
          }
        },
        orderBy: { createdAt: 'desc' }
      });

      const now = new Date();
      const currentYear = now.getFullYear();
      const currentMonth = now.getMonth() + 1;

      const summary = await Promise.all(branches.map(async (b) => {
        const teacherCount = b.users.filter(u => u.role === 'TEACHER').length;
        const accountantCount = b.users.filter(u => u.role === 'ACCOUNTANT').length;

        // Student counts and subscriptions in this branch
        const subscriptions = await db.studentMonthlySubscription.findMany({
          where: {
            branchId: b.id,
            billingYear: currentYear,
            billingMonth: currentMonth
          }
        });

        const totalCollectedThisMonth = subscriptions
          .filter(s => s.status === 'PAID')
          .reduce((sum, s) => sum + s.amountPaid, 0);

        const lateUnpaidAmount = subscriptions
          .filter(s => s.status === 'UNPAID')
          .reduce((sum, s) => sum + Math.max(0, s.amountDue - s.discountAmount), 0);

        // Active and locked student count
        const links = await db.studentTeacher.findMany({
          where: {
            teacher: { branchId: b.id },
            status: 'ACTIVE'
          },
          select: { studentId: true, accessStatus: true }
        });

        const activeStudents = links.filter(l => l.accessStatus === 'ACTIVE' || l.accessStatus === 'GRACE_PERIOD').length;
        const lockedStudents = links.filter(l => l.accessStatus === 'LOCKED').length;

        return {
          id: b.id,
          name: b.name,
          code: b.code,
          status: b.status,
          address: b.address,
          phone: b.phone,
          isOnline: b.isOnline,
          isDefault: b.isDefault,
          teacherCount,
          accountantCount,
          activeStudents,
          lockedStudents,
          totalCollectedThisMonth,
          lateUnpaidAmount
        };
      }));

      return res.json({ success: true, data: summary, branches: summary });
    } catch (err: any) {
      return res.status(500).json({ message: 'Error fetching branches', error: err.message });
    }
  },

  /**
   * POST /api/manager/branches
   */
  async createBranch(req: AuthRequest, res: Response) {
    try {
      if (!isAuthorizedPrimaryManager(req.user)) {
        return res.status(403).json({ message: 'Forbidden: Primary Manager access only' });
      }

      const { name, code, address, phone, isOnline } = req.body;
      if (!name || !code) {
        return res.status(400).json({ message: 'Branch name and code are required' });
      }

      const institutionId = req.user?.institutionId || 'inst_idor_a_91xnz3';

      const existing = await db.branch.findUnique({
        where: { institutionId_code: { institutionId, code } }
      });
      if (existing) {
        return res.status(400).json({ message: 'كود الفرع مستخدم بالفعل في هذه المؤسسة' });
      }

      const branch = await db.branch.create({
        data: {
          institutionId,
          name,
          code,
          address: address || null,
          phone: phone || null,
          isOnline: Boolean(isOnline),
          status: 'ACTIVE'
        }
      });

      return res.status(201).json({ success: true, branch });
    } catch (err: any) {
      return res.status(500).json({ message: 'Error creating branch', error: err.message });
    }
  },

  /**
   * PUT /api/manager/branches/:id
   */
  async updateBranch(req: AuthRequest, res: Response) {
    try {
      if (!isAuthorizedPrimaryManager(req.user)) {
        return res.status(403).json({ message: 'Forbidden' });
      }

      const { id } = req.params;
      const { name, address, phone } = req.body;

      const branch = await db.branch.update({
        where: { id },
        data: {
          ...(name ? { name } : {}),
          ...(address !== undefined ? { address } : {}),
          ...(phone !== undefined ? { phone } : {})
        }
      });

      return res.json({ success: true, branch });
    } catch (err: any) {
      return res.status(500).json({ message: 'Error updating branch', error: err.message });
    }
  },

  /**
   * POST /api/manager/branches/:id/deactivate
   * Deactivate branch without deleting historical or financial data (BRD Section 5.1)
   */
  async deactivateBranch(req: AuthRequest, res: Response) {
    try {
      if (!isAuthorizedPrimaryManager(req.user)) {
        return res.status(403).json({ message: 'Forbidden' });
      }

      const { id } = req.params;

      const branch = await db.branch.update({
        where: { id },
        data: { status: 'INACTIVE' }
      });

      return res.json({ success: true, message: 'Branch deactivated successfully (data preserved)', branch });
    } catch (err: any) {
      return res.status(500).json({ message: 'Error deactivating branch', error: err.message });
    }
  },

  /**
   * POST /api/manager/branches/:id/accountants
   * Manager provisions accountant for a specific branch
   */
  async createBranchAccountant(req: AuthRequest, res: Response) {
    try {
      const role = (req.user?.role || '').toUpperCase();
      if (!isAuthorizedPrimaryManager(req.user)) {
        return res.status(403).json({ message: 'Forbidden: Primary Manager access only' });
      }

      const { id: branchId } = req.params;
      const { name, email } = req.body;

      if (!name || !email) {
        return res.status(400).json({ message: 'Name and email are required' });
      }

      const result = await BrdSubscriptionService.provisionBranchAccountant(
        { id: req.user?.userId as string, role, institutionId: req.user?.institutionId },
        { name, email, branchId }
      );

      return res.status(201).json({
        success: true,
        message: 'Accountant provisioned successfully',
        accountant: result.accountant,
        temporaryPassword: result.temporaryPassword
      });
    } catch (err: any) {
      if (err.code === 'DUPLICATE_EMAIL') {
        return res.status(400).json({ message: err.message });
      }
      return res.status(500).json({ message: 'Error provisioning accountant', error: err.message });
    }
  },

  /**
   * POST /api/manager/teachers/:teacherId/assign-branch
   * Link teacher to single branch (BRD Section 5.2)
   */
  async assignTeacherBranch(req: AuthRequest, res: Response) {
    try {
      if (!isAuthorizedPrimaryManager(req.user)) {
        return res.status(403).json({ message: 'Forbidden' });
      }

      const { teacherId } = req.params;
      const { branchId } = req.body;

      if (!branchId) {
        return res.status(400).json({ message: 'branchId is required' });
      }

      const branch = await db.branch.findUnique({ where: { id: branchId } });
      if (!branch) {
        return res.status(404).json({ message: 'Branch not found' });
      }

      const teacher = await db.user.update({
        where: { id: teacherId },
        data: { branchId }
      });

      return res.json({ success: true, message: 'Teacher successfully assigned to branch', teacher: { id: teacher.id, name: teacher.name, branchId } });
    } catch (err: any) {
      return res.status(500).json({ message: 'Error assigning teacher branch', error: err.message });
    }
  },

  /**
   * GET /api/manager/students
   * Manager views all students across branches with responsible teacher
   */
  async getManagerStudents(req: AuthRequest, res: Response) {
    try {
      if (!isAuthorizedPrimaryManager(req.user)) {
        return res.status(403).json({ message: 'Forbidden: Primary Manager access only' });
      }

      const { search, branchId, teacherId, grade, status } = req.query;

      const whereClause: any = {
        role: { in: ['CENTER_STUDENT', 'ONLINE_STUDENT'] },
        deletedAt: null
      };

      if (branchId) whereClause.branchId = branchId;
      if (teacherId) whereClause.responsibleTeacherId = teacherId;
      if (grade && grade !== 'ALL') whereClause.gradeLevel = grade;

      const students = await db.user.findMany({
        where: whereClause,
        include: {
          branch: { select: { id: true, name: true, code: true } },
          responsibleTeacher: { select: { id: true, name: true, email: true } },
          parent: { select: { id: true, name: true, email: true, phone: true } },
          studentTeacherLinks: {
            include: {
              teacher: { select: { id: true, name: true, email: true } }
            }
          },
          studentMonthlySubscriptions: {
            orderBy: [{ billingYear: 'desc' }, { billingMonth: 'desc' }],
            take: 6
          }
        },
        orderBy: { createdAt: 'desc' }
      });

      let results = students.map(s => ({
        id: s.id,
        name: s.name,
        email: s.email,
        role: s.role,
        gradeLevel: s.gradeLevel,
        academicLevel: s.academicLevel,
        branch: s.branch,
        responsibleTeacher: s.responsibleTeacher,
        parent: s.parent,
        teachers: s.studentTeacherLinks.map(l => ({
          teacherId: l.teacherId,
          teacherName: l.teacher.name,
          accessStatus: l.accessStatus,
          exceptionActiveUntil: l.exceptionActiveUntil
        })),
        recentSubscriptions: s.studentMonthlySubscriptions,
        createdAt: s.createdAt
      }));

      if (search && typeof search === 'string') {
        const q = search.toLowerCase();
        results = results.filter(s => s.name.toLowerCase().includes(q) || s.email.toLowerCase().includes(q));
      }

      return res.json({ success: true, count: results.length, data: results });
    } catch (err: any) {
      return res.status(500).json({ message: 'Error fetching manager students', error: err.message });
    }
  },

  /**
   * POST /api/manager/students/:studentId/transfer-teacher
   */
  async transferStudent(req: AuthRequest, res: Response) {
    try {
      if (!isAuthorizedPrimaryManager(req.user)) {
        return res.status(403).json({ message: 'Forbidden' });
      }

      const { studentId } = req.params;
      const { toTeacherId, reason } = req.body;

      if (!toTeacherId) {
        return res.status(400).json({ message: 'toTeacherId is required' });
      }

      const transfer = await BrdSubscriptionService.transferStudentTeacher(
        req.user?.userId as string,
        studentId,
        toTeacherId,
        reason
      );

      return res.json({ success: true, message: 'Student transferred successfully', transfer });
    } catch (err: any) {
      return res.status(500).json({ message: 'Error transferring student', error: err.message });
    }
  },

  /**
   * GET /api/manager/students/:studentId/history
   * Complete chronological student audit trail (BRD Section 7.8)
   */
  async getStudentHistory(req: AuthRequest, res: Response) {
    try {
      const role = (req.user?.role || '').toUpperCase();
      const requesterId = req.user?.userId;
      const { studentId } = req.params;

      // Access control: Primary Manager has full access; Teacher sees only for their own students
      if (role === 'TEACHER') {
        const enrollment = await db.studentTeacher.findUnique({
          where: { studentId_teacherId: { studentId, teacherId: requesterId as string } }
        });
        if (!enrollment) {
          return res.status(403).json({ message: 'Forbidden: You do not teach this student' });
        }
      } else if (!isAuthorizedPrimaryManager(req.user)) {
        return res.status(403).json({ message: 'Forbidden' });
      }

      const logs = await db.studentAuditLog.findMany({
        where: { studentId },
        orderBy: { createdAt: 'desc' }
      });

      return res.json({ success: true, studentId, count: logs.length, data: logs });
    } catch (err: any) {
      return res.status(500).json({ message: 'Error fetching student history', error: err.message });
    }
  },

  /**
   * Pricing endpoints for Manager
   */
  async setPricing(req: AuthRequest, res: Response) {
    try {
      if (!isAuthorizedPrimaryManager(req.user)) {
        return res.status(403).json({ message: 'Forbidden: Primary Manager access only' });
      }

      const teacherId = req.body.teacherId || req.params.teacherId || (req.params as any).id;
      const grade = req.body.grade || req.body.gradeLevel;
      const price = req.body.price;
      const now = new Date();
      const defaultMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      const effectiveMonth = req.body.effectiveMonth || defaultMonth;
      const reason = req.body.reason;

      if (!teacherId || !grade || price === undefined || !effectiveMonth) {
        return res.status(400).json({ message: 'teacherId, grade, price, and effectiveMonth are required' });
      }

      const record = await BrdSubscriptionService.setTeacherGradePrice(
        req.user?.userId as string,
        { teacherId, grade, price: Number(price), effectiveMonth, reason }
      );

      return res.json({ success: true, message: 'Pricing configured successfully', pricing: record });
    } catch (err: any) {
      return res.status(500).json({ message: 'Error setting pricing', error: err.message });
    }
  },

  async setSettings(req: AuthRequest, res: Response) {
    try {
      if (!isAuthorizedPrimaryManager(req.user)) {
        return res.status(403).json({ message: 'Forbidden' });
      }

      const { teacherId, lastGraceDay, lockDay, lockMessageAr, lockMessageEn } = req.body;
      if (!teacherId) {
        return res.status(400).json({ message: 'teacherId is required' });
      }

      const settings = await BrdSubscriptionService.setTeacherSettings(teacherId, {
        lastGraceDay: lastGraceDay !== undefined ? Number(lastGraceDay) : undefined,
        lockDay: lockDay !== undefined ? Number(lockDay) : undefined,
        lockMessageAr,
        lockMessageEn
      });

      return res.json({ success: true, message: 'Teacher subscription settings updated', settings });
    } catch (err: any) {
      return res.status(500).json({ message: 'Error setting settings', error: err.message });
    }
  },

  async grantException(req: AuthRequest, res: Response) {
    try {
      const role = (req.user?.role || '').toUpperCase();
      if (!isAuthorizedPrimaryManager(req.user)) {
        return res.status(403).json({ message: 'Forbidden' });
      }

      const studentId = req.body.studentId || req.params.studentId || (req.params as any).id;
      const { teacherId, reason } = req.body;
      if (!studentId || !teacherId || !reason) {
        return res.status(400).json({ message: 'studentId, teacherId, and reason are required' });
      }

      const updated = await BrdSubscriptionService.grantManagerException(
        { id: req.user?.userId as string, role },
        studentId,
        teacherId,
        reason
      );

      return res.json({ success: true, message: 'Manager exception granted until end of current month', updated });
    } catch (err: any) {
      return res.status(500).json({ message: 'Error granting exception', error: err.message });
    }
  },

  async cancelPayment(req: AuthRequest, res: Response) {
    try {
      const role = (req.user?.role || '').toUpperCase();
      if (!isAuthorizedPrimaryManager(req.user)) {
        return res.status(403).json({ message: 'Forbidden' });
      }

      const { paymentId } = req.params;
      const { cancellationReason } = req.body;

      if (!cancellationReason) {
        return res.status(400).json({ message: 'cancellationReason is required' });
      }

      const result = await BrdSubscriptionService.cancelPayment(
        { id: req.user?.userId as string, role },
        paymentId,
        cancellationReason
      );

      return res.json({ success: true, result });
    } catch (err: any) {
      return res.status(500).json({ message: 'Error cancelling payment', error: err.message });
    }
  },

  // ==========================================================================
  // ACCOUNTANT ENDPOINTS (Scoped strictly to branch & teachers)
  // ==========================================================================

  /**
   * GET /api/accountant/students
   * Accountant views only students of teachers in accountant's branch (BRD Section 5.4)
   */
  async getAccountantStudents(req: AuthRequest, res: Response) {
    try {
      const role = (req.user?.role || '').toUpperCase();
      const branchId = req.user?.branchId;

      if (role !== 'ACCOUNTANT') {
        return res.status(403).json({ message: 'Forbidden: Accountant access only' });
      }

      if (!branchId) {
        return res.status(400).json({ message: 'Accountant has no assigned branch' });
      }

      // 1. Fetch teachers assigned to this branch
      const branchTeachers = await db.user.findMany({
        where: { branchId, role: 'TEACHER', deletedAt: null },
        select: { id: true, name: true, email: true }
      });

      const teacherIds = branchTeachers.map(t => t.id);

      // 2. Fetch students belonging to these teachers
      const enrollments = await db.studentTeacher.findMany({
        where: {
          teacherId: { in: teacherIds },
          status: 'ACTIVE'
        },
        include: {
          teacher: { select: { id: true, name: true } },
          student: {
            select: {
              id: true,
              name: true,
              email: true,
              role: true,
              gradeLevel: true,
              parent: { select: { id: true, name: true, email: true, phone: true } },
              studentMonthlySubscriptions: {
                where: { teacherId: { in: teacherIds } },
                orderBy: [{ billingYear: 'desc' }, { billingMonth: 'desc' }],
                take: 6
              }
            }
          }
        }
      });

      const data = enrollments.map(e => ({
        studentId: e.student.id,
        studentName: e.student.name,
        studentEmail: e.student.email,
        studentRole: e.student.role,
        gradeLevel: e.student.gradeLevel,
        parent: e.student.parent,
        teacherId: e.teacherId,
        teacherName: e.teacher.name,
        accessStatus: e.accessStatus,
        recentSubscriptions: e.student.studentMonthlySubscriptions
      }));

      return res.json({
        success: true,
        branchId,
        teachersCount: branchTeachers.length,
        studentsCount: data.length,
        data
      });
    } catch (err: any) {
      return res.status(500).json({ message: 'Error fetching accountant students', error: err.message });
    }
  },

  /**
   * POST /api/accountant/payments
   * Accountant records payment (manual, full months only, atomic sequential receipt)
   */
  async recordPayment(req: AuthRequest, res: Response) {
    try {
      const role = (req.user?.role || '').toUpperCase();
      const accountantId = req.user?.userId;
      const branchId = req.user?.branchId;

      if (role !== 'ACCOUNTANT') {
        return res.status(403).json({ message: 'Forbidden: Accountant access only' });
      }

      const { studentId, teacherId, months, amount, receivingMethod, notes } = req.body;

      if (!studentId || !teacherId || !months || !amount || !receivingMethod) {
        return res.status(400).json({ message: 'studentId, teacherId, months, amount, and receivingMethod are required' });
      }

      const result = await BrdSubscriptionService.recordSubscriptionPayment(
        { id: accountantId as string, role: 'ACCOUNTANT', branchId },
        {
          studentId,
          teacherId,
          months,
          amount: Number(amount),
          receivingMethod,
          notes
        }
      );

      return res.status(201).json({
        success: true,
        message: 'Payment recorded and official sequential receipt generated successfully',
        payment: result.payment,
        receipt: result.receipt,
        accessStatus: result.accessStatus
      });
    } catch (err: any) {
      return res.status(400).json({ message: err.message });
    }
  },

  /**
   * GET /api/accountant/receipts
   * List confirmed receipts for accountant's branch
   */
  async getAccountantReceipts(req: AuthRequest, res: Response) {
    try {
      const role = (req.user?.role || '').toUpperCase();
      const branchId = req.user?.branchId;
      const isPrimaryManager = isAuthorizedPrimaryManager(req.user);

      if (role !== 'ACCOUNTANT' && !isPrimaryManager) {
        return res.status(403).json({ message: 'Forbidden' });
      }

      const includeCancelled = req.query.includeCancelled === 'true';
      const whereClause: any = includeCancelled ? {} : { payment: { status: 'CONFIRMED' } };
      if (role === 'ACCOUNTANT') {
        if (!branchId) return res.status(403).json({ message: 'Accountant has no assigned branch' });
        if (req.query.branchId && String(req.query.branchId) !== branchId) {
          return res.status(403).json({ message: 'Forbidden: Branch accountants are strictly restricted to their assigned branch.' });
        }
        whereClause.branchId = branchId;
      } else if (req.query.branchId && req.query.branchId !== 'ALL') {
        whereClause.branchId = String(req.query.branchId);
      }

      const receipts = await db.branchSequentialReceipt.findMany({
        where: whereClause,
        include: {
          student: { select: { id: true, name: true, gradeLevel: true } },
          teacher: { select: { id: true, name: true } },
          accountant: { select: { id: true, name: true } },
          payment: { select: { id: true, status: true, cancelledAt: true, cancellationReason: true } }
        },
        orderBy: { createdAt: 'desc' }
      });

      return res.json({ success: true, count: receipts.length, data: receipts });
    } catch (err: any) {
      return res.status(500).json({ message: 'Error fetching receipts', error: err.message });
    }
  },

  // ==========================================================================
  // STUDENT & PARENT ENDPOINTS
  // ==========================================================================

  /**
   * GET /api/subscriptions/my-subscriptions
   * Student or parent views their own subscriptions & access status per teacher
   */
  async getMySubscriptions(req: AuthRequest, res: Response) {
    try {
      const userId = req.user?.userId;
      const role = (req.user?.role || '').toUpperCase();

      let targetStudentIds: string[] = [];

      if (['ONLINE_STUDENT', 'CENTER_STUDENT'].includes(role)) {
        targetStudentIds = [userId as string];
      } else if (role === 'PARENT') {
        const children = await db.user.findMany({
          where: { parentId: userId as string },
          select: { id: true }
        });
        targetStudentIds = children.map(c => c.id);
      } else {
        return res.status(403).json({ message: 'Forbidden' });
      }

      const enrollments = await db.studentTeacher.findMany({
        where: {
          studentId: { in: targetStudentIds },
          status: 'ACTIVE'
        },
        include: {
          teacher: { select: { id: true, name: true, email: true } },
          student: { select: { id: true, name: true, gradeLevel: true } }
        }
      });

      const subscriptions = await db.studentMonthlySubscription.findMany({
        where: { studentId: { in: targetStudentIds } },
        include: {
          teacher: { select: { id: true, name: true } }
        },
        orderBy: [{ billingYear: 'desc' }, { billingMonth: 'desc' }]
      });

      const receipts = await db.branchSequentialReceipt.findMany({
        where: { studentId: { in: targetStudentIds } },
        orderBy: { createdAt: 'desc' }
      });

      return res.json({
        success: true,
        teachers: enrollments.map(e => ({
          studentId: e.studentId,
          studentName: e.student.name,
          teacherId: e.teacherId,
          teacherName: e.teacher.name,
          accessStatus: e.accessStatus,
          exceptionActiveUntil: e.exceptionActiveUntil
        })),
        subscriptions,
        receipts
      });
    } catch (err: any) {
      return res.status(500).json({ message: 'Error fetching subscriptions', error: err.message });
    }
  },

  /**
   * GET /api/student/teachers/:teacherId/access
   * Student teacher-specific subscription access status & lock enforcement
   */
  async getStudentTeacherAccess(req: AuthRequest, res: Response) {
    try {
      const userId = req.user?.userId;
      const role = (req.user?.role || '').toUpperCase();
      const { teacherId } = req.params;

      if (!userId || !teacherId) {
        return res.status(400).json({ message: 'studentId and teacherId are required' });
      }

      let studentId = userId;
      if (role === 'PARENT') {
        const requestedStudentId = req.query.studentId as string | undefined;
        const children = await db.user.findMany({
          where: { parentId: userId },
          select: { id: true }
        });
        const childIds = children.map(c => c.id);
        if (requestedStudentId) {
          if (!childIds.includes(requestedStudentId)) {
            return res.status(403).json({ message: 'Forbidden: Cannot access non-linked student' });
          }
          studentId = requestedStudentId;
        } else if (childIds.length > 0) {
          studentId = childIds[0];
        } else {
          return res.status(404).json({ message: 'No linked students found for parent' });
        }
      } else if (role === 'TEACHER') {
        studentId = (req.query.studentId as string) || userId;
        if (teacherId !== userId) {
          return res.status(403).json({ message: 'Forbidden: Teachers can only query access for their own courses' });
        }
      } else if (isAuthorizedPrimaryManager(req.user)) {
        studentId = (req.query.studentId as string) || userId;
      } else if (!['ONLINE_STUDENT', 'CENTER_STUDENT', 'STUDENT'].includes(role)) {
        return res.status(403).json({ message: 'Forbidden' });
      }

      const link = await db.studentTeacher.findUnique({
        where: {
          studentId_teacherId: {
            studentId,
            teacherId
          }
        },
        include: {
          teacher: { select: { id: true, name: true, email: true } }
        }
      });

      if (!link || link.status !== 'ACTIVE') {
        return res.json({
          success: true,
          studentId,
          teacherId,
          enrolled: false,
          accessStatus: 'LOCKED',
          isLocked: true,
          allowed: false,
          subscription: null
        });
      }

      const evalResult = await BrdSubscriptionService.recalculateAccessStatus(studentId, teacherId);
      const accessStatus = evalResult.accessStatus;

      const now = new Date();
      const currentSub = await db.studentMonthlySubscription.findUnique({
        where: {
          studentId_teacherId_billingYear_billingMonth: {
            studentId,
            teacherId,
            billingYear: now.getFullYear(),
            billingMonth: now.getMonth() + 1
          }
        }
      });

      return res.json({
        success: true,
        studentId,
        teacherId,
        teacherName: link.teacher?.name,
        enrolled: true,
        accessStatus,
        isLocked: accessStatus === 'LOCKED',
        allowed: accessStatus !== 'LOCKED',
        exceptionActiveUntil: link.exceptionActiveUntil,
        subscription: currentSub
      });
    } catch (err: any) {
      return res.status(500).json({ message: 'Error checking student teacher access', error: err.message });
    }
  },

  /**
   * GET /api/receipts/:id
   * View single receipt (anti-IDOR protected)
   */
  async getReceiptById(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const userId = req.user?.userId;
      const role = (req.user?.role || '').toUpperCase();

      const receipt = await db.branchSequentialReceipt.findUnique({
        where: { id },
        include: {
          student: { select: { id: true, name: true, gradeLevel: true, parentId: true } },
          teacher: { select: { id: true, name: true } },
          accountant: { select: { id: true, name: true } },
          payment: true
        }
      });

      if (!receipt) {
        return res.status(404).json({ message: 'Receipt not found' });
      }

      // Anti-IDOR Authorization Check
      if (role === 'ONLINE_STUDENT' || role === 'CENTER_STUDENT') {
        if (receipt.studentId !== userId) {
          return res.status(403).json({ message: 'Forbidden: You cannot access receipts of another student' });
        }
      } else if (role === 'PARENT') {
        if (receipt.student.parentId !== userId) {
          return res.status(403).json({ message: 'Forbidden: You cannot access receipts of another family' });
        }
      } else if (role === 'TEACHER') {
        if (receipt.teacherId !== userId) {
          return res.status(403).json({ message: 'Forbidden: You cannot access receipts of another teacher' });
        }
      } else if (role === 'ACCOUNTANT') {
        if (receipt.branchId !== req.user?.branchId) {
          return res.status(403).json({ message: 'Forbidden: Receipt belongs to another branch' });
        }
      }

      return res.json({ success: true, receipt });
    } catch (err: any) {
      return res.status(500).json({ message: 'Error fetching receipt', error: err.message });
    }
  },

  // ==========================================================================
  // ACCOUNT SETTINGS (BRD SECTION 15 - ALL ROLES)
  // ==========================================================================

  /**
   * GET /api/account/settings
   */
  async getAccountSettings(req: AuthRequest, res: Response) {
    try {
      const user = await db.user.findUnique({
        where: { id: req.user?.userId },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          language: true,
          theme: true,
          profilePictureUrl: true,
          phone: true
        }
      });

      if (!user) return res.status(404).json({ message: 'User not found' });
      return res.json({ success: true, data: user });
    } catch (err: any) {
      return res.status(500).json({ message: 'Error fetching account settings', error: err.message });
    }
  },

  /**
   * PUT /api/account/settings
   * Update language and theme (persists to DB across devices)
   */
  async updateAccountSettings(req: AuthRequest, res: Response) {
    try {
      const { language, theme } = req.body;
      const updateData: any = {};

      if (language) {
        if (!['ar', 'en'].includes(language)) {
          return res.status(400).json({ message: 'Language must be "ar" or "en"' });
        }
        updateData.language = language;
      }

      if (theme) {
        if (!ALLOWED_THEMES.includes(theme)) {
          return res.status(400).json({ message: `Theme must be one of: ${ALLOWED_THEMES.join(', ')}` });
        }
        updateData.theme = theme;
      }

      const updated = await db.user.update({
        where: { id: req.user?.userId },
        data: updateData,
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          language: true,
          theme: true,
          profilePictureUrl: true
        }
      });

      return res.json({ success: true, message: 'Settings saved', data: updated });
    } catch (err: any) {
      return res.status(500).json({ message: 'Error saving settings', error: err.message });
    }
  },

  /**
   * POST /api/account/profile-picture
   * Upload square cropped profile picture (JPG, PNG, WebP <= 2MB with content check)
   */
  async uploadProfilePicture(req: AuthRequest, res: Response) {
    try {
      const { base64Data, mimeType } = req.body;

      if (!base64Data || !mimeType) {
        return res.status(400).json({ message: 'base64Data and mimeType are required' });
      }

      const allowedMimes = ['image/jpeg', 'image/png', 'image/webp'];
      if (!allowedMimes.includes(mimeType)) {
        return res.status(400).json({ message: 'Only JPG, PNG, and WebP images are permitted' });
      }

      // Check file size (max 2 MB = 2 * 1024 * 1024 bytes)
      const buffer = Buffer.from(base64Data, 'base64');
      if (buffer.length > 2 * 1024 * 1024) {
        return res.status(400).json({ message: 'File size exceeds maximum permitted limit of 2 MB' });
      }

      // Magic number check for security
      const isJpeg = buffer[0] === 0xff && buffer[1] === 0xd8;
      const isPng = buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47;
      const isWebp = buffer.slice(8, 12).toString('ascii') === 'WEBP';

      if (!isJpeg && !isPng && !isWebp) {
        return res.status(400).json({ message: 'Invalid or forged image file content' });
      }

      const ext = mimeType === 'image/jpeg' ? 'jpg' : mimeType === 'image/png' ? 'png' : 'webp';
      const uploadDir = path.resolve('storage/avatars');
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }

      const fileName = `avatar_${req.user?.userId}_${Date.now()}.${ext}`;
      const filePath = path.join(uploadDir, fileName);
      fs.writeFileSync(filePath, buffer);

      const profilePictureUrl = `/api/users/avatars/${fileName}`;

      await db.user.update({
        where: { id: req.user?.userId },
        data: { profilePictureUrl }
      });

      return res.json({ success: true, profilePictureUrl });
    } catch (err: any) {
      return res.status(500).json({ message: 'Error uploading profile picture', error: err.message });
    }
  },

  /**
   * GET /api/users/avatars/:filename
   * Stream avatar image safely with MIME and caching headers
   */
  async getAvatar(req: Request, res: Response) {
    try {
      const { filename } = req.params;
      if (!filename || filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
        return res.status(400).json({ message: 'Invalid filename' });
      }

      const uploadDir = path.resolve('storage/avatars');
      const filePath = path.join(uploadDir, filename);

      if (!fs.existsSync(filePath)) {
        return res.status(404).json({ message: 'Avatar image not found' });
      }

      const ext = path.extname(filename).toLowerCase();
      const contentType = ext === '.png' ? 'image/png' : ext === '.webp' ? 'image/webp' : 'image/jpeg';

      res.setHeader('Content-Type', contentType);
      res.setHeader('Cache-Control', 'public, max-age=86400, stale-while-revalidate=604800');
      fs.createReadStream(filePath).pipe(res);
      return;
    } catch (err: any) {
      return res.status(500).json({ message: 'Error serving avatar', error: err.message });
    }
  },

  /**
   * DELETE /api/account/profile-picture
   */
  async deleteProfilePicture(req: AuthRequest, res: Response) {
    try {
      await db.user.update({
        where: { id: req.user?.userId },
        data: { profilePictureUrl: null }
      });
      return res.json({ success: true, message: 'Profile picture removed' });
    } catch (err: any) {
      return res.status(500).json({ message: 'Error removing profile picture', error: err.message });
    }
  },

  /**
   * DELETE /api/manager/users/:userId/profile-picture
   * Manager can remove an inappropriate profile picture with an audit record (BRD Section 9.2 / 15.2)
   */
  async managerRemoveProfilePicture(req: AuthRequest, res: Response) {
    try {
      const role = (req.user?.role || '').toUpperCase();
      if (!isAuthorizedPrimaryManager(req.user)) {
        return res.status(403).json({ message: 'Forbidden: Only Primary Managers can remove users profile pictures' });
      }

      const { userId } = req.params;
      const { reason } = req.body;

      const user = await db.user.findUnique({ where: { id: userId } });
      if (!user) return res.status(404).json({ message: 'User not found' });

      await db.user.update({
        where: { id: userId },
        data: { profilePictureUrl: null }
      });

      // Audit Record
      await db.studentAuditLog.create({
        data: {
          studentId: userId,
          eventType: 'PROFILE_PICTURE_REMOVED_BY_MANAGER',
          actorId: req.user?.userId as string,
          actorRole: role,
          details: {
            reason: reason || 'Inappropriate profile picture removed by administrator'
          }
        }
      });

      return res.json({ success: true, message: 'Profile picture removed by manager and audit record logged' });
    } catch (err: any) {
      return res.status(500).json({ message: 'Error removing profile picture', error: err.message });
    }
  },

  /**
   * POST /api/subscriptions/scheduler/trigger
   * Trigger the Cairo daily lock scheduler for testing or manual evaluation
   */
  async triggerSchedulerEvaluation(req: AuthRequest, res: Response) {
    try {
      if (!isAuthorizedPrimaryManager(req.user)) {
        return res.status(403).json({ message: 'Forbidden' });
      }

      const { dateStr } = req.body;
      const refDate = dateStr ? new Date(dateStr) : new Date();

      const result = await runBrdDailyLockEvaluation(refDate);
      return res.json({ success: true, result });
    } catch (err: any) {
      return res.status(500).json({ message: 'Scheduler trigger failed', error: err.message });
    }
  }
};
