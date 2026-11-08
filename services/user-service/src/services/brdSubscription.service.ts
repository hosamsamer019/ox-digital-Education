import { db } from '../../../../packages/database/src/index.js';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { logger } from '@shared/utils';
import { BrdNotificationService } from './brdNotification.service.js';

export interface CreateStudentParams {
  name: string;
  email: string;
  password?: string;
  gradeLevel: string; // e.g. "SECONDARY_1", "SECONDARY_2", "SECONDARY_3", etc.
  studentType: 'ONLINE_STUDENT' | 'CENTER_STUDENT';
  centerGroupId?: string | null;
  parentId?: string | null;
  parentName?: string | null;
  parentEmail?: string | null;
  parentPhone?: string | null;
  parentPassword?: string | null;
  academicLevel?: string | null;
  country?: string | null;
  educationLevel?: string | null;
}

export const BrdSubscriptionService = {
  /**
   * Automatically derive teacher ownership and create student (Phase 1)
   */
  async createStudentWithTeacherOwnership(
    creatorUser: { id: string; role: string; institutionId?: string | null; branchId?: string | null },
    params: CreateStudentParams,
    explicitTeacherId?: string
  ) {
    const isTeacher = creatorUser.role === 'TEACHER';
    const isManager = creatorUser.role === 'PRIMARY_MANAGER' || creatorUser.role === 'ADMIN';

    if (!isTeacher && !isManager) {
      throw new Error('Forbidden: Only teachers and managers can create student accounts');
    }

    // For teachers, teacherId is strictly derived from session; do not trust client-supplied ID
    const responsibleTeacherId = isTeacher ? creatorUser.id : explicitTeacherId;

    if (!responsibleTeacherId) {
      throw new Error('Responsible teacher ID is required');
    }

    // Verify teacher exists
    const teacherRecord = await db.user.findUnique({
      where: { id: responsibleTeacherId },
      select: { id: true, role: true, branchId: true, institutionId: true, name: true }
    });

    if (!teacherRecord || teacherRecord.role !== 'TEACHER') {
      throw new Error('Specified responsible teacher not found');
    }

    const email = params.email.trim().toLowerCase();
    const existing = await db.user.findUnique({ where: { email } });
    if (existing) {
      const err: any = new Error('البريد الإلكتروني مسجل بالفعل لمستخدم آخر');
      err.code = 'DUPLICATE_EMAIL';
      err.status = 400;
      throw err;
    }

    const defaultPassword = params.password || 'Student@123456';
    const hashedPassword = await bcrypt.hash(defaultPassword, 10);

    const institutionId = teacherRecord.institutionId || creatorUser.institutionId || null;
    const branchId = teacherRecord.branchId || creatorUser.branchId || null;

    return await db.$transaction(async (tx) => {
      let resolvedParentId = params.parentId || null;

      // Handle Parent creation or linking
      if (params.parentEmail) {
        const pEmail = params.parentEmail.trim().toLowerCase();
        const existingParent = await tx.user.findUnique({ where: { email: pEmail } });
        if (existingParent) {
          resolvedParentId = existingParent.id;
        } else {
          const parentPass = params.parentPassword || 'Parent@123456';
          const hashedParentPass = await bcrypt.hash(parentPass, 10);
          const newParent = await tx.user.create({
            data: {
              name: params.parentName || `ولي أمر ${params.name}`,
              email: pEmail,
              password: hashedParentPass,
              phone: params.parentPhone || null,
              role: 'PARENT',
              institutionId,
              branchId
            }
          });
          resolvedParentId = newParent.id;
        }
      }

      // Create Student
      const student = await tx.user.create({
        data: {
          name: params.name.trim(),
          email,
          password: hashedPassword,
          role: params.studentType,
          gradeLevel: params.gradeLevel as any,
          academicLevel: params.academicLevel as any || null,
          educationLevel: params.educationLevel as any || null,
          country: params.country as any || null,
          institutionId,
          branchId,
          parentId: resolvedParentId,
          centerGroupId: params.centerGroupId || null,
          creatorId: creatorUser.id,
          responsibleTeacherId
        }
      });

      // Create explicit StudentTeacher relationship
      const studentTeacher = await tx.studentTeacher.create({
        data: {
          studentId: student.id,
          teacherId: responsibleTeacherId,
          creatorId: creatorUser.id,
          status: 'ACTIVE',
          accessStatus: 'ACTIVE'
        }
      });

      // Initialize monthly subscription for current Gregorian month if teacher pricing exists
      const now = new Date();
      const currentYear = now.getFullYear();
      const currentMonth = now.getMonth() + 1; // 1-12
      const monthStr = `${currentYear}-${String(currentMonth).padStart(2, '0')}`;

      const pricing = await tx.teacherGradePricing.findFirst({
        where: {
          teacherId: responsibleTeacherId,
          grade: params.gradeLevel,
          effectiveMonth: { lte: monthStr }
        },
        orderBy: { effectiveMonth: 'desc' }
      });

      const priceSnapshot = pricing ? pricing.price : 0;

      await tx.studentMonthlySubscription.create({
        data: {
          studentId: student.id,
          teacherId: responsibleTeacherId,
          branchId: branchId || 'DEFAULT_BRANCH',
          billingYear: currentYear,
          billingMonth: currentMonth,
          amountDue: priceSnapshot,
          amountPaid: 0,
          status: 'UNPAID',
          priceSnapshot
        }
      });

      // Audit Log
      await tx.studentAuditLog.create({
        data: {
          studentId: student.id,
          eventType: 'STUDENT_CREATED',
          actorId: creatorUser.id,
          actorRole: creatorUser.role,
          details: {
            name: student.name,
            email: student.email,
            role: student.role,
            gradeLevel: student.gradeLevel,
            responsibleTeacherId,
            branchId,
            parentId: resolvedParentId,
            initialSubscription: {
              year: currentYear,
              month: currentMonth,
              price: priceSnapshot
            }
          }
        }
      });

      // Dispatch Notifications asynchronously (after commit)
      setImmediate(() => {
        BrdNotificationService.notifyNewStudent({
          studentId: student.id,
          studentName: student.name,
          teacherId: responsibleTeacherId,
          teacherName: teacherRecord.name,
          parentId: resolvedParentId,
          institutionId: institutionId || ''
        }).catch(e => logger.error(`Notification failed for new student: ${e.message}`));
      });

      return {
        student,
        studentTeacher,
        parentId: resolvedParentId
      };
    });
  },

  /**
   * Teacher links parent account to existing student (Phase 1.3)
   */
  async teacherLinkParent(
    teacherUser: { id: string; role: string; institutionId?: string | null; branchId?: string | null },
    payload: {
      studentId: string;
      parentEmail?: string;
      parentName?: string;
      parentPhone?: string;
      parentPassword?: string;
      existingParentId?: string;
    }
  ) {
    if (teacherUser.role !== 'TEACHER' && teacherUser.role !== 'PRIMARY_MANAGER' && teacherUser.role !== 'ADMIN') {
      throw new Error('Forbidden: Only teachers can perform parent linking');
    }

    const { studentId, parentEmail, parentName, parentPhone, parentPassword, existingParentId } = payload;
    if (!studentId) {
      throw new Error('studentId is required');
    }

    if (teacherUser.role === 'TEACHER') {
      const enrollment = await db.studentTeacher.findUnique({
        where: { studentId_teacherId: { studentId, teacherId: teacherUser.id } }
      });
      if (!enrollment || enrollment.status !== 'ACTIVE') {
        throw new Error('Forbidden: You do not own this student record');
      }
    }

    let resolvedParentId = existingParentId;
    if (!resolvedParentId && parentEmail) {
      const pEmail = parentEmail.trim().toLowerCase();
      const existingParent = await db.user.findUnique({ where: { email: pEmail } });
      if (existingParent) {
        resolvedParentId = existingParent.id;
      } else {
        const pPass = parentPassword || 'Parent@123456';
        const hashed = await bcrypt.hash(pPass, 10);
        const newParent = await db.user.create({
          data: {
            name: parentName || 'ولي أمر',
            email: pEmail,
            password: hashed,
            phone: parentPhone || null,
            role: 'PARENT',
            institutionId: teacherUser.institutionId || null,
            branchId: teacherUser.branchId || null
          }
        });
        resolvedParentId = newParent.id;
      }
    }

    if (!resolvedParentId) {
      throw new Error('Parent email or existingParentId is required');
    }

    await db.user.update({
      where: { id: studentId },
      data: { parentId: resolvedParentId }
    });

    await db.studentAuditLog.create({
      data: {
        studentId,
        eventType: 'PARENT_LINKED',
        actorId: teacherUser.id,
        actorRole: teacherUser.role,
        details: { parentId: resolvedParentId }
      }
    });

    return { success: true, studentId, parentId: resolvedParentId };
  },

  /**
   * Enroll student with an additional teacher (Multi-teacher support, Phase 1.6)
   */
  async enrollWithAdditionalTeacher(
    studentId: string,
    teacherId: string,
    actorIdOrUser: string | { id: string; role?: string },
    actorRole?: string
  ) {
    const actorId = typeof actorIdOrUser === 'object' ? actorIdOrUser.id : actorIdOrUser;
    const resolvedRole = typeof actorIdOrUser === 'object' && actorIdOrUser.role
      ? actorIdOrUser.role
      : (actorRole || 'PRIMARY_MANAGER');

    const student = await db.user.findUnique({ where: { id: studentId } });
    if (!student || !['CENTER_STUDENT', 'ONLINE_STUDENT'].includes(student.role)) {
      throw new Error('Student not found');
    }

    const teacher = await db.user.findUnique({ where: { id: teacherId } });
    if (!teacher || teacher.role !== 'TEACHER') {
      throw new Error('Teacher not found');
    }

    return await db.$transaction(async (tx) => {
      const link = await tx.studentTeacher.upsert({
        where: {
          studentId_teacherId: {
            studentId,
            teacherId
          }
        },
        update: {
          status: 'ACTIVE',
          accessStatus: 'ACTIVE'
        },
        create: {
          studentId,
          teacherId,
          creatorId: actorId,
          status: 'ACTIVE',
          accessStatus: 'ACTIVE'
        }
      });

      // Initialize monthly subscription for current month
      const now = new Date();
      const currentYear = now.getFullYear();
      const currentMonth = now.getMonth() + 1;
      const monthStr = `${currentYear}-${String(currentMonth).padStart(2, '0')}`;

      const pricing = await tx.teacherGradePricing.findFirst({
        where: {
          teacherId,
          grade: (student.gradeLevel as string) || 'SECONDARY_1',
          effectiveMonth: { lte: monthStr }
        },
        orderBy: { effectiveMonth: 'desc' }
      });

      const priceSnapshot = pricing ? pricing.price : 0;

      await tx.studentMonthlySubscription.upsert({
        where: {
          studentId_teacherId_billingYear_billingMonth: {
            studentId,
            teacherId,
            billingYear: currentYear,
            billingMonth: currentMonth
          }
        },
        update: {},
        create: {
          studentId,
          teacherId,
          branchId: teacher.branchId || student.branchId || 'DEFAULT_BRANCH',
          billingYear: currentYear,
          billingMonth: currentMonth,
          amountDue: priceSnapshot,
          amountPaid: 0,
          status: 'UNPAID',
          priceSnapshot
        }
      });

      await tx.studentAuditLog.create({
        data: {
          studentId,
          eventType: 'ADDITIONAL_TEACHER_ENROLLED',
          actorId,
          actorRole: resolvedRole,
          details: {
            teacherId,
            teacherName: teacher.name,
            initialPrice: priceSnapshot
          }
        }
      });

      return link;
    });
  },

  /**
   * Manager transfers student to another teacher (Phase 1.4)
   */
  async transferStudentTeacher(
    managerId: string,
    studentId: string,
    toTeacherId: string,
    reason?: string
  ) {
    const student = await db.user.findUnique({
      where: { id: studentId },
      include: { studentTeacherLinks: true }
    });

    if (!student) {
      throw new Error('Student not found');
    }

    const toTeacher = await db.user.findUnique({ where: { id: toTeacherId } });
    if (!toTeacher || toTeacher.role !== 'TEACHER') {
      throw new Error('Target teacher not found');
    }

    const fromTeacherId = student.responsibleTeacherId;

    return await db.$transaction(async (tx) => {
      // 1. Update User responsibleTeacherId
      await tx.user.update({
        where: { id: studentId },
        data: {
          responsibleTeacherId: toTeacherId,
          branchId: toTeacher.branchId || student.branchId
        }
      });

      // 2. Mark previous teacher relation as TRANSFERRED
      if (fromTeacherId) {
        await tx.studentTeacher.updateMany({
          where: { studentId, teacherId: fromTeacherId },
          data: { status: 'TRANSFERRED' }
        });
      }

      // 3. Upsert target teacher relation as ACTIVE
      await tx.studentTeacher.upsert({
        where: {
          studentId_teacherId: {
            studentId,
            teacherId: toTeacherId
          }
        },
        update: {
          status: 'ACTIVE',
          accessStatus: 'ACTIVE'
        },
        create: {
          studentId,
          teacherId: toTeacherId,
          creatorId: managerId,
          status: 'ACTIVE',
          accessStatus: 'ACTIVE'
        }
      });

      // 4. Create immutable TeacherTransferHistory
      const transferRecord = await tx.teacherTransferHistory.create({
        data: {
          studentId,
          fromTeacherId,
          toTeacherId,
          transferredById: managerId,
          reason: reason || 'Manager transfer'
        }
      });

      // 5. Create StudentAuditLog
      await tx.studentAuditLog.create({
        data: {
          studentId,
          eventType: 'TEACHER_TRANSFERRED',
          actorId: managerId,
          actorRole: 'PRIMARY_MANAGER',
          details: {
            fromTeacherId,
            toTeacherId,
            toTeacherName: toTeacher.name,
            reason: reason || null
          }
        }
      });

      return transferRecord;
    });
  },

  /**
   * Manager provisions Branch Accountant (Phase 2.3)
   */
  async provisionBranchAccountant(
    managerUser: { id: string; role: string; institutionId?: string | null },
    params: { name: string; email: string; branchId: string }
  ) {
    if (managerUser.role !== 'PRIMARY_MANAGER' && managerUser.role !== 'ADMIN') {
      throw new Error('Forbidden: Only managers can provision branch accountants');
    }

    const branch = await db.branch.findUnique({ where: { id: params.branchId } });
    if (!branch) {
      const err: any = new Error('الفرع المحدد غير موجود');
      err.code = 'BRANCH_NOT_FOUND';
      err.status = 404;
      throw err;
    }

    if (managerUser.institutionId && branch.institutionId !== managerUser.institutionId) {
      const err: any = new Error('الفرع المحدد لا يتبع لنفس مؤسسة المدير المسؤول');
      err.code = 'BRANCH_TENANT_MISMATCH';
      err.status = 403;
      throw err;
    }

    const email = params.email.trim().toLowerCase();
    const existing = await db.user.findUnique({ where: { email } });
    if (existing) {
      const err: any = new Error('البريد الإلكتروني مسجل بالفعل لمستخدم آخر');
      err.code = 'DUPLICATE_EMAIL';
      err.status = 400;
      throw err;
    }

    // Secure CSPRNG temporary password
    const temporaryPassword = crypto.randomBytes(12).toString('base64url');
    const hashedPassword = await bcrypt.hash(temporaryPassword, 10);

    const accountant = await db.user.create({
      data: {
        name: params.name.trim(),
        email,
        password: hashedPassword,
        role: 'ACCOUNTANT',
        institutionId: branch.institutionId,
        branchId: branch.id,
        mustChangePassword: true,
        creatorId: managerUser.id
      }
    });

    // Create Audit entry
    await db.studentAuditLog.create({
      data: {
        studentId: accountant.id, // recording staff entity
        eventType: 'ACCOUNTANT_PROVISIONED',
        actorId: managerUser.id,
        actorRole: managerUser.role,
        details: {
          accountantName: accountant.name,
          accountantEmail: accountant.email,
          branchId: branch.id,
          branchName: branch.name
        }
      }
    });

    return {
      accountant: {
        id: accountant.id,
        name: accountant.name,
        email: accountant.email,
        role: accountant.role,
        branchId: accountant.branchId,
        mustChangePassword: true
      },
      temporaryPassword // Returned ONCE to manager
    };
  },

  /**
   * Teacher Pricing & Grace/Lock settings (Phase 3.1 & 3.2)
   */
  async setTeacherGradePrice(
    managerIdOrUser: string | { id: string; role: string },
    params: {
      teacherId: string;
      grade: string;
      price: number;
      effectiveMonth: string; // "YYYY-MM"
      reason?: string;
    }
  ) {
    const managerId = typeof managerIdOrUser === 'object' ? managerIdOrUser.id : managerIdOrUser;
    const managerRole = typeof managerIdOrUser === 'object' ? managerIdOrUser.role : 'PRIMARY_MANAGER';
    if (managerRole !== 'PRIMARY_MANAGER' && managerRole !== 'ADMIN') {
      throw new Error('Forbidden: Only managers can modify grade prices');
    }

    const { teacherId, grade, price, effectiveMonth, reason } = params;

    const teacher = await db.user.findUnique({ where: { id: teacherId } });
    if (!teacher || teacher.role !== 'TEACHER') {
      throw new Error('Teacher not found');
    }

    if (price < 0) {
      throw new Error('Price cannot be negative');
    }

    return await db.$transaction(async (tx) => {
      const existing = await tx.teacherGradePricing.findUnique({
        where: {
          teacherId_grade_effectiveMonth: {
            teacherId,
            grade,
            effectiveMonth
          }
        }
      });

      const previousPrice = existing ? existing.price : 0;

      const record = await tx.teacherGradePricing.upsert({
        where: {
          teacherId_grade_effectiveMonth: {
            teacherId,
            grade,
            effectiveMonth
          }
        },
        update: {
          price
        },
        create: {
          teacherId,
          grade,
          price,
          effectiveMonth
        }
      });

      // Price audit history
      const audit = await tx.priceAuditHistory.create({
        data: {
          teacherId,
          grade,
          previousPrice,
          newPrice: price,
          effectiveMonth,
          changedById: managerId,
          reason: reason || null
        }
      });

      // Update existing unpaid subscriptions for this month & grade so they reflect the new price
      const [yearStr, monthStr] = effectiveMonth.split('-');
      const effYear = parseInt(yearStr, 10);
      const effMonth = parseInt(monthStr, 10);

      const enrollments = await tx.studentTeacher.findMany({
        where: { teacherId },
        include: { student: { select: { id: true, gradeLevel: true } } }
      });
      const matchingStudentIds = enrollments
        .filter(st => st.student && st.student.gradeLevel === grade)
        .map(st => st.studentId);

      if (matchingStudentIds.length > 0) {
        await tx.studentMonthlySubscription.updateMany({
          where: {
            teacherId,
            studentId: { in: matchingStudentIds },
            billingYear: effYear,
            billingMonth: effMonth,
            amountPaid: 0
          },
          data: {
            amountDue: price,
            priceSnapshot: price,
            status: 'UNPAID'
          }
        });
      }

      // Notify Manager
      setImmediate(() => {
        BrdNotificationService.notifyPriceSettingsChange({
          teacherId,
          teacherName: teacher.name,
          grade,
          newPrice: price,
          effectiveMonth,
          managerId,
          institutionId: teacher.institutionId || ''
        }).catch(e => logger.error(`Notification failed for price change: ${e.message}`));
      });

      return { pricing: record, auditRecord: { oldPrice: previousPrice, newPrice: price, reason } };
    });
  },

  /**
   * Set Teacher Subscription Settings (Grace/Lock days)
   */
  async setTeacherSettings(
    teacherId: string,
    settings: {
      lastGraceDay?: number;
      lockDay?: number;
      lockMessageAr?: string;
      lockMessageEn?: string;
    }
  ) {
    const teacher = await db.user.findUnique({ where: { id: teacherId } });
    if (!teacher || teacher.role !== 'TEACHER') {
      throw new Error('Teacher not found');
    }

    return await db.teacherSubscriptionSetting.upsert({
      where: { teacherId },
      update: {
        ...(settings.lastGraceDay !== undefined ? { lastGraceDay: settings.lastGraceDay } : {}),
        ...(settings.lockDay !== undefined ? { lockDay: settings.lockDay } : {}),
        ...(settings.lockMessageAr ? { lockMessageAr: settings.lockMessageAr } : {}),
        ...(settings.lockMessageEn ? { lockMessageEn: settings.lockMessageEn } : {})
      },
      create: {
        teacherId,
        lastGraceDay: settings.lastGraceDay ?? 5,
        lockDay: settings.lockDay ?? 6,
        lockMessageAr: settings.lockMessageAr || 'تم إيقاف الوصول مؤقتاً لعدم سداد الاشتراك الشهري. يرجى مراجعة إدارة الفرع.',
        lockMessageEn: settings.lockMessageEn || 'Access has been temporarily suspended due to unpaid monthly subscription. Please contact branch administration.'
      }
    });
  },

  /**
   * Record Manual Payment by Accountant (Phase 3.4 & 3.6)
   * Atomic payment, full months only, sequential receipt number per branch, immediate unlock
   */
  async recordSubscriptionPayment(
    accountantUser: { id: string; role: string; branchId?: string | null },
    params: {
      studentId: string;
      teacherId: string;
      months: Array<{ year: number; month: number }>;
      amount: number;
      receivingMethod: 'CASH' | 'BANK_TRANSFER' | 'WALLET';
      notes?: string;
    }
  ) {
    if (accountantUser.role !== 'ACCOUNTANT') {
      throw new Error('Forbidden: Only branch accountants can record payments');
    }

    if (!accountantUser.branchId) {
      throw new Error('Accountant has no assigned branch');
    }

    const { studentId, teacherId, months, amount, receivingMethod, notes } = params;

    if (!months || months.length === 0) {
      throw new Error('At least one monthly subscription must be selected');
    }

    // Verify teacher belongs to accountant's branch (Scope check, Section 5.4)
    const teacher = await db.user.findUnique({
      where: { id: teacherId },
      select: { id: true, name: true, branchId: true, institutionId: true }
    });

    if (!teacher || teacher.branchId !== accountantUser.branchId) {
      throw new Error('Forbidden: Teacher is not assigned to the accountant branch');
    }

    // Verify student is enrolled with teacher
    const student = await db.user.findUnique({
      where: { id: studentId },
      include: { parent: true }
    });

    if (!student) {
      throw new Error('Student not found');
    }

    const enrollment = await db.studentTeacher.findUnique({
      where: { studentId_teacherId: { studentId, teacherId } }
    });

    if (!enrollment || enrollment.status !== 'ACTIVE') {
      throw new Error('Student is not actively enrolled with this teacher');
    }

    return await db.$transaction(async (tx) => {
      // 1. Fetch or create the requested monthly subscriptions
      const subscriptions = [];
      let calculatedTotalDue = 0;

      for (const m of months) {
        let sub = await tx.studentMonthlySubscription.findUnique({
          where: {
            studentId_teacherId_billingYear_billingMonth: {
              studentId,
              teacherId,
              billingYear: m.year,
              billingMonth: m.month
            }
          }
        });

        if (!sub) {
          // Look up applicable price snapshot
          const monthStr = `${m.year}-${String(m.month).padStart(2, '0')}`;
          const pricing = await tx.teacherGradePricing.findFirst({
            where: {
              teacherId,
              grade: (student.gradeLevel as string) || 'SECONDARY_1',
              effectiveMonth: { lte: monthStr }
            },
            orderBy: { effectiveMonth: 'desc' }
          });

          const price = pricing ? pricing.price : 0;
          sub = await tx.studentMonthlySubscription.create({
            data: {
              studentId,
              teacherId,
              branchId: accountantUser.branchId as string,
              billingYear: m.year,
              billingMonth: m.month,
              amountDue: price,
              amountPaid: 0,
              status: 'UNPAID',
              priceSnapshot: price
            }
          });
        } else if (sub.status !== 'PAID' && sub.amountDue === 0 && sub.amountPaid === 0) {
          const monthStr = `${m.year}-${String(m.month).padStart(2, '0')}`;
          const pricing = await tx.teacherGradePricing.findFirst({
            where: {
              teacherId,
              grade: (student.gradeLevel as string) || 'SECONDARY_1',
              effectiveMonth: { lte: monthStr }
            },
            orderBy: { effectiveMonth: 'desc' }
          });
          if (pricing && pricing.price > 0) {
            sub = await tx.studentMonthlySubscription.update({
              where: { id: sub.id },
              data: {
                amountDue: pricing.price,
                priceSnapshot: pricing.price
              }
            });
          }
        }

        if (sub.status === 'PAID') {
          throw new Error(`Month ${m.month}/${m.year} is already paid`);
        }

        const netDue = Math.max(0, sub.amountDue - sub.discountAmount);
        calculatedTotalDue += netDue;
        subscriptions.push(sub);
      }

      // BRD rule: Strict NO partial monthly payment. Amount must match calculatedTotalDue.
      if (Math.round(amount * 100) !== Math.round(calculatedTotalDue * 100)) {
        throw new Error(
          `Invalid payment amount: expected ${calculatedTotalDue} EGP for ${months.length} full month(s), got ${amount} EGP. Partial payments are strictly prohibited.`
        );
      }

      // 2. Generate unique sequential receipt number for the branch
      const counter = await tx.branchReceiptCounter.upsert({
        where: { branchId: accountantUser.branchId as string },
        update: { lastSequence: { increment: 1 } },
        create: { branchId: accountantUser.branchId as string, lastSequence: 1 }
      });

      const branchRecord = await tx.branch.findUnique({
        where: { id: accountantUser.branchId as string },
        select: { code: true }
      });

      const branchCode = branchRecord?.code || 'BR';
      const seqStr = String(counter.lastSequence).padStart(5, '0');
      const receiptNumber = `REC-${branchCode}-${seqStr}`;

      // 3. Create SubscriptionPayment
      const payment = await tx.subscriptionPayment.create({
        data: {
          branchId: accountantUser.branchId as string,
          studentId,
          accountantId: accountantUser.id,
          totalAmount: amount,
          receivingMethod,
          status: 'CONFIRMED',
          notes: notes || null
        }
      });

      // 4. Create Payment Items and update Subscriptions
      const now = new Date();
      for (const sub of subscriptions) {
        const netDue = Math.max(0, sub.amountDue - sub.discountAmount);
        await tx.subscriptionPaymentItem.create({
          data: {
            paymentId: payment.id,
            subscriptionId: sub.id,
            month: sub.billingMonth,
            year: sub.billingYear,
            amount: netDue
          }
        });

        await tx.studentMonthlySubscription.update({
          where: { id: sub.id },
          data: {
            status: 'PAID',
            amountPaid: netDue,
            paidAt: now
          }
        });
      }

      // 5. Create BranchSequentialReceipt
      const monthsCoveredStr = months.map(m => `${m.month}/${m.year}`).join(', ');
      const receipt = await tx.branchSequentialReceipt.create({
        data: {
          branchId: accountantUser.branchId as string,
          receiptNumber,
          sequenceNumber: counter.lastSequence,
          paymentId: payment.id,
          studentId,
          teacherId,
          accountantId: accountantUser.id,
          amount,
          receivingMethod,
          monthsCovered: monthsCoveredStr,
          pdfPath: `/storage/receipts/${receiptNumber}.pdf`
        }
      });

      // 6. Recalculate Student-Teacher Access Status & Reopen Immediately (Section 7.4)
      await tx.studentTeacher.update({
        where: { studentId_teacherId: { studentId, teacherId } },
        data: { accessStatus: 'ACTIVE' }
      });

      // 7. Audit Log
      await tx.studentAuditLog.create({
        data: {
          studentId,
          eventType: 'PAYMENT_RECORDED',
          actorId: accountantUser.id,
          actorRole: 'ACCOUNTANT',
          details: {
            paymentId: payment.id,
            receiptNumber,
            teacherId,
            teacherName: teacher.name,
            amount,
            receivingMethod,
            monthsCovered: monthsCoveredStr
          }
        }
      });

      // 8. Async Notifications (dispatched post-commit)
      setImmediate(() => {
        BrdNotificationService.notifyPaymentAndReceipt({
          receiptNumber,
          studentId,
          studentName: student.name,
          teacherId,
          teacherName: teacher.name,
          parentId: student.parentId,
          amount,
          monthsCovered: monthsCoveredStr,
          receivingMethod,
          institutionId: teacher.institutionId || ''
        }).catch(e => logger.error(`Notification failed for payment: ${e.message}`));
      });

      return {
        payment: { ...payment, amount: payment.totalAmount },
        receipt,
        accessStatus: 'ACTIVE'
      };
    });
  },

  /**
   * Manager Payment Cancellation with Reversal Record (Phase 3.5)
   */
  async cancelPayment(
    managerUser: { id: string; role: string },
    paymentId: string,
    cancellationReason: string
  ) {
    if (managerUser.role !== 'PRIMARY_MANAGER' && managerUser.role !== 'ADMIN') {
      throw new Error('Forbidden: Only managers can authorize payment cancellations');
    }

    const payment = await db.subscriptionPayment.findUnique({
      where: { id: paymentId },
      include: {
        items: { include: { subscription: true } },
        receipt: true,
        student: true
      }
    });

    if (!payment) {
      throw new Error('Payment not found');
    }

    if (payment.status === 'CANCELLED') {
      throw new Error('Payment is already cancelled');
    }

    return await db.$transaction(async (tx) => {
      // 1. Mark payment as cancelled
      const now = new Date();
      await tx.subscriptionPayment.update({
        where: { id: paymentId },
        data: {
          status: 'CANCELLED',
          cancelledAt: now,
          cancelledById: managerUser.id,
          cancellationReason
        }
      });

      // 2. Revert subscriptions to UNPAID
      for (const item of payment.items) {
        await tx.studentMonthlySubscription.update({
          where: { id: item.subscriptionId },
          data: {
            status: 'UNPAID',
            amountPaid: 0,
            paidAt: null
          }
        });
      }

      // 3. Recalculate access for affected student-teacher relationship
      const teacherId = payment.receipt?.teacherId || payment.items[0]?.subscription.teacherId;
      if (teacherId) {
        await this.recalculateAccessStatus(payment.studentId, teacherId, tx);
      }

      // 4. Audit Log
      await tx.studentAuditLog.create({
        data: {
          studentId: payment.studentId,
          eventType: 'PAYMENT_CANCELLED',
          actorId: managerUser.id,
          actorRole: managerUser.role,
          details: {
            paymentId,
            receiptNumber: payment.receipt?.receiptNumber,
            totalAmount: payment.totalAmount,
            cancellationReason
          }
        }
      });

      return { success: true, message: 'Payment successfully cancelled and reversed' };
    });
  },

  /**
   * Manager Manual Exception Activation (Phase 4.5)
   * Valid only until end of current Gregorian month; NOT a payment; zero income recorded.
   */
  async grantManagerException(
    managerUser: { id: string; role: string },
    studentId: string,
    teacherId: string,
    reason: string
  ) {
    if (managerUser.role !== 'PRIMARY_MANAGER' && managerUser.role !== 'ADMIN') {
      throw new Error('Forbidden: Only managers can grant exception activations');
    }

    const enrollment = await db.studentTeacher.findUnique({
      where: { studentId_teacherId: { studentId, teacherId } }
    });

    if (!enrollment) {
      throw new Error('Student-teacher enrollment not found');
    }

    const now = new Date();
    // End of current month at 23:59:59.999 Cairo time
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

    const updated = await db.studentTeacher.update({
      where: { studentId_teacherId: { studentId, teacherId } },
      data: {
        accessStatus: 'ACTIVE',
        exceptionActiveUntil: endOfMonth,
        exceptionReason: reason,
        exceptionGrantedById: managerUser.id
      }
    });

    await db.studentAuditLog.create({
      data: {
        studentId,
        eventType: 'EXCEPTION_ACTIVATED',
        actorId: managerUser.id,
        actorRole: managerUser.role,
        details: {
          teacherId,
          reason,
          validUntil: endOfMonth.toISOString(),
          note: 'Non-financial administrative access exception'
        }
      }
    });

    return updated;
  },

  /**
   * Recalculates student access status per teacher according to Cairo time and subscriptions
   */
  async recalculateAccessStatus(
    studentId: string,
    teacherId: string,
    referenceDateOrClientDb?: Date | any,
    clientDb: any = db
  ): Promise<{ accessStatus: 'ACTIVE' | 'GRACE_PERIOD' | 'LOCKED' }> {
    let referenceDate = new Date();
    let actualDb = clientDb;

    if (referenceDateOrClientDb instanceof Date) {
      referenceDate = referenceDateOrClientDb;
      actualDb = clientDb || db;
    } else if (referenceDateOrClientDb && typeof referenceDateOrClientDb === 'object' && referenceDateOrClientDb.studentTeacher) {
      actualDb = referenceDateOrClientDb;
    }

    const enrollment = await actualDb.studentTeacher.findUnique({
      where: { studentId_teacherId: { studentId, teacherId } }
    });

    if (!enrollment || enrollment.status !== 'ACTIVE') return { accessStatus: 'LOCKED' };

    const now = referenceDate;
    // Check if an unexpired manager exception exists
    if (enrollment.exceptionActiveUntil && enrollment.exceptionActiveUntil > now) {
      if (enrollment.accessStatus !== 'ACTIVE') {
        await actualDb.studentTeacher.update({
          where: { studentId_teacherId: { studentId, teacherId } },
          data: { accessStatus: 'ACTIVE' }
        });
      }
      return { accessStatus: 'ACTIVE' };
    }

    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;
    const currentDay = now.getDate();

    // Fetch teacher setting
    const setting = await actualDb.teacherSubscriptionSetting.findUnique({
      where: { teacherId }
    });

    const lastGraceDay = setting?.lastGraceDay ?? 5;
    const lockDay = setting?.lockDay ?? 6;

    // Fetch current month subscription
    let sub = await actualDb.studentMonthlySubscription.findUnique({
      where: {
        studentId_teacherId_billingYear_billingMonth: {
          studentId,
          teacherId,
          billingYear: currentYear,
          billingMonth: currentMonth
        }
      }
    });

    if (sub && sub.status !== 'PAID' && sub.amountDue === 0 && sub.amountPaid === 0) {
      const monthStr = `${currentYear}-${String(currentMonth).padStart(2, '0')}`;
      const student = await actualDb.user.findUnique({
        where: { id: studentId },
        select: { gradeLevel: true }
      });
      const pricing = await actualDb.teacherGradePricing.findFirst({
        where: {
          teacherId,
          grade: (student?.gradeLevel as string) || 'SECONDARY_1',
          effectiveMonth: { lte: monthStr }
        },
        orderBy: { effectiveMonth: 'desc' }
      });
      if (pricing && pricing.price > 0) {
        sub = await actualDb.studentMonthlySubscription.update({
          where: { id: sub.id },
          data: {
            amountDue: pricing.price,
            priceSnapshot: pricing.price
          }
        });
      }
    }

    const isPaid = sub && (sub.status === 'PAID' || sub.status === 'EXEMPT');

    let newStatus: 'ACTIVE' | 'GRACE_PERIOD' | 'LOCKED' = 'ACTIVE';

    if (isPaid) {
      newStatus = 'ACTIVE';
    } else {
      if (currentDay <= lastGraceDay) {
        newStatus = 'GRACE_PERIOD';
      } else {
        newStatus = 'LOCKED';
      }
    }

    if (enrollment.accessStatus !== newStatus) {
      await actualDb.studentTeacher.update({
        where: { studentId_teacherId: { studentId, teacherId } },
        data: { accessStatus: newStatus }
      });
    }

    return { accessStatus: newStatus };
  }
};

