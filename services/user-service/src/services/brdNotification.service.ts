import { db } from '../../../../packages/database/src/index.js';
import { logger } from '@shared/utils';

export const BrdNotificationService = {
  /**
   * Helper to find managers of an institution
   */
  async getManagerIds(institutionId?: string): Promise<string[]> {
    if (!institutionId) {
      const managers = await db.user.findMany({
        where: { role: { in: ['PRIMARY_MANAGER', 'ADMIN'] } },
        select: { id: true }
      });
      return managers.map(m => m.id);
    }
    const managers = await db.user.findMany({
      where: {
        role: { in: ['PRIMARY_MANAGER', 'ADMIN'] },
        OR: [
          { institutionId },
          { isPrimaryManager: true }
        ]
      },
      select: { id: true }
    });
    return managers.map(m => m.id);
  },

  /**
   * Safe create in-app notification
   */
  async createNotification(params: {
    userId: string;
    title: string;
    message: string;
    type: string;
    metadata?: any;
  }) {
    try {
      const userExists = await db.user.findFirst({ where: { id: params.userId, deletedAt: null } });
      if (!userExists) return;

      await db.notification.create({
        data: {
          userId: params.userId,
          title: params.title,
          message: params.message,
          type: params.type,
          metadata: params.metadata || {}
        }
      });
    } catch (err: any) {
      logger.error(`[BrdNotificationService] Failed to create notification for ${params.userId}: ${err.message}`);
    }
  },

  /**
   * 1. Event: New student
   * Recipients: Student, Parent, Teacher, Manager
   */
  async notifyNewStudent(payload: {
    studentId: string;
    studentName: string;
    teacherId: string;
    teacherName: string;
    parentId?: string | null;
    institutionId: string;
  }) {
    const { studentId, studentName, teacherId, teacherName, parentId, institutionId } = payload;

    // Student
    await this.createNotification({
      userId: studentId,
      title: 'مرحباً بك في المنصة التعليمية',
      message: `تم إنشاء حسابك وتعيينك مع المعلم ${teacherName} بنجاح.`,
      type: 'NEW_STUDENT',
      metadata: { studentId, teacherId }
    });

    // Parent
    if (parentId) {
      await this.createNotification({
        userId: parentId,
        title: 'تسجيل طالب جديد',
        message: `تم ربط حسابك ببيانات الطالب ${studentName} مع المعلم ${teacherName}.`,
        type: 'NEW_STUDENT',
        metadata: { studentId, teacherId }
      });
    }

    // Teacher
    await this.createNotification({
      userId: teacherId,
      title: 'طالب جديد في قائمتك',
      message: `تمت إضافة الطالب ${studentName} إلى قائمة طلابك.`,
      type: 'NEW_STUDENT',
      metadata: { studentId }
    });

    // Managers
    const managerIds = await this.getManagerIds(institutionId);
    for (const mId of managerIds) {
      await this.createNotification({
        userId: mId,
        title: 'تسجيل طالب جديد',
        message: `تم تسجيل الطالب ${studentName} وتعيينه للمعلم ${teacherName}.`,
        type: 'NEW_STUDENT',
        metadata: { studentId, teacherId }
      });
    }
  },

  /**
   * 2. Event: Payment and receipt
   * Recipients: Student, Parent, Teacher, Manager
   * (Teacher's payment notification identifies student and payment without unnecessary sensitive payment details)
   */
  async notifyPaymentAndReceipt(payload: {
    receiptNumber: string;
    studentId: string;
    studentName: string;
    teacherId: string;
    teacherName: string;
    parentId?: string | null;
    amount: number;
    monthsCovered: string;
    receivingMethod: string;
    institutionId: string;
  }) {
    const { receiptNumber, studentId, studentName, teacherId, teacherName, parentId, amount, monthsCovered, receivingMethod, institutionId } = payload;

    // Student
    await this.createNotification({
      userId: studentId,
      title: 'تم تأكيد السداد وإصدار الإيصال',
      message: `تم سداد اشتراك شهر (${monthsCovered}) للمعلم ${teacherName} بمبلغ ${amount} ج.م (إيصال رقم ${receiptNumber}).`,
      type: 'PAYMENT_AND_RECEIPT',
      metadata: { receiptNumber, amount, monthsCovered }
    });

    // Parent
    if (parentId) {
      await this.createNotification({
        userId: parentId,
        title: 'إشعار سداد وإيصال رسمي',
        message: `تم تأكيد سداد اشتراك الطالب ${studentName} لشهر (${monthsCovered}) للمعلم ${teacherName} بمبلغ ${amount} ج.م (إيصال رقم ${receiptNumber}).`,
        type: 'PAYMENT_AND_RECEIPT',
        metadata: { receiptNumber, studentId, amount, monthsCovered }
      });
    }

    // Teacher (identifies student and payment event without unnecessary sensitive payment details)
    await this.createNotification({
      userId: teacherId,
      title: 'سداد اشتراك طالب',
      message: `قام الطالب ${studentName} بسداد اشتراك شهر (${monthsCovered}). تم تفعيل الوصول بالكامل.`,
      type: 'PAYMENT_AND_RECEIPT',
      metadata: { studentId, monthsCovered }
    });

    // Managers
    const managerIds = await this.getManagerIds(institutionId);
    for (const mId of managerIds) {
      await this.createNotification({
        userId: mId,
        title: 'تحصيل اشتراك شهري جديد',
        message: `تم تحصيل مبلغ ${amount} ج.م للطالب ${studentName} للمعلم ${teacherName} (${monthsCovered}) عبر ${receivingMethod} (إيصال ${receiptNumber}).`,
        type: 'PAYMENT_AND_RECEIPT',
        metadata: { receiptNumber, studentId, teacherId, amount }
      });
    }
  },

  /**
   * 3. Event: Grace-period reminder
   * Recipients: Student, Parent (Teacher and Manager: NO)
   */
  async notifyGracePeriodReminder(payload: {
    studentId: string;
    studentName: string;
    teacherName: string;
    parentId?: string | null;
    daysRemaining: number;
    month: number;
    year: number;
  }) {
    const { studentId, studentName, teacherName, parentId, daysRemaining, month, year } = payload;

    // Student
    await this.createNotification({
      userId: studentId,
      title: 'تذكير بمهلة سداد الاشتراك الشهري',
      message: `متبقي ${daysRemaining} يوم على انتهاء مهلة سداد اشتراك شهر ${month}/${year} للمعلم ${teacherName}. يرجى السداد لتجنب إيقاف المحتوى.`,
      type: 'GRACE_PERIOD_REMINDER',
      metadata: { month, year, daysRemaining }
    });

    // Parent
    if (parentId) {
      await this.createNotification({
        userId: parentId,
        title: 'تذكير بمهلة سداد اشتراك الطالب',
        message: `متبقي ${daysRemaining} يوم على انتهاء مهلة سداد اشتراك شهر ${month}/${year} للطالب ${studentName} للمعلم ${teacherName}.`,
        type: 'GRACE_PERIOD_REMINDER',
        metadata: { studentId, month, year, daysRemaining }
      });
    }
  },

  /**
   * 4. Event: Account locked
   * Recipients: Student, Parent, Teacher, Manager
   */
  async notifyAccountLocked(payload: {
    studentId: string;
    studentName: string;
    teacherId: string;
    teacherName: string;
    parentId?: string | null;
    month: number;
    year: number;
    lockMessage: string;
    institutionId: string;
  }) {
    const { studentId, studentName, teacherId, teacherName, parentId, month, year, lockMessage, institutionId } = payload;

    // Student
    await this.createNotification({
      userId: studentId,
      title: 'تم إيقاف الوصول لمحتوى المعلم',
      message: lockMessage || `تم إيقاف الوصول لدروس واختبارات المعلم ${teacherName} لعدم سداد اشتراك شهر ${month}/${year}.`,
      type: 'ACCOUNT_LOCKED',
      metadata: { teacherId, month, year }
    });

    // Parent
    if (parentId) {
      await this.createNotification({
        userId: parentId,
        title: 'إيقاف مؤقت لحساب الطالب',
        message: `تم إيقاف الوصول لمحتوى المعلم ${teacherName} للطالب ${studentName} لعدم سداد اشتراك شهر ${month}/${year}.`,
        type: 'ACCOUNT_LOCKED',
        metadata: { studentId, teacherId, month, year }
      });
    }

    // Teacher
    await this.createNotification({
      userId: teacherId,
      title: 'إيقاف حساب طالب لعدم السداد',
      message: `تم إيقاف وصول الطالب ${studentName} لمحتواك الأكاديمي لعدم سداد اشتراك شهر ${month}/${year}.`,
      type: 'ACCOUNT_LOCKED',
      metadata: { studentId, month, year }
    });

    // Managers
    const managerIds = await this.getManagerIds(institutionId);
    for (const mId of managerIds) {
      await this.createNotification({
        userId: mId,
        title: 'إيقاف وصول طالب (نظامي تلقائي)',
        message: `تم إيقاف وصول الطالب ${studentName} لمحتوى المعلم ${teacherName} تلقائياً لانتهاء مهلة سداد شهر ${month}/${year}.`,
        type: 'ACCOUNT_LOCKED',
        metadata: { studentId, teacherId, month, year }
      });
    }
  },

  /**
   * 5. Event: Account reopened after payment
   * Recipients: Student, Parent (Teacher and Manager: NO)
   */
  async notifyAccountReopened(payload: {
    studentId: string;
    studentName: string;
    teacherName: string;
    parentId?: string | null;
    month: number;
    year: number;
  }) {
    const { studentId, studentName, teacherName, parentId, month, year } = payload;

    // Student
    await this.createNotification({
      userId: studentId,
      title: 'تمت إعادة فتح الوصول بنجاح',
      message: `تم تأكيد سداد اشتراك شهر ${month}/${year} وإعادة فتح وصولك الكامل لدروس واختبارات المعلم ${teacherName}.`,
      type: 'ACCOUNT_REOPENED',
      metadata: { month, year }
    });

    // Parent
    if (parentId) {
      await this.createNotification({
        userId: parentId,
        title: 'إعادة فتح حساب الطالب',
        message: `تمت إعادة فتح الوصول لمحتوى المعلم ${teacherName} للطالب ${studentName} بعد تأكيد السداد.`,
        type: 'ACCOUNT_REOPENED',
        metadata: { studentId, month, year }
      });
    }
  },

  /**
   * 6. Event: Subscription price/settings change
   * Recipients: Manager only
   */
  async notifyPriceSettingsChange(payload: {
    teacherId: string;
    teacherName: string;
    grade: string;
    newPrice: number;
    effectiveMonth: string;
    managerId: string;
    institutionId: string;
  }) {
    const { teacherId, teacherName, grade, newPrice, effectiveMonth, managerId, institutionId } = payload;
    const managerIds = await this.getManagerIds(institutionId);
    for (const mId of managerIds) {
      await this.createNotification({
        userId: mId,
        title: 'تحديث سعر اشتراك المعلم',
        message: `تم تحديث سعر اشتراك الصف ${grade} للمعلم ${teacherName} إلى ${newPrice} ج.م ابتداءً من شهر ${effectiveMonth}.`,
        type: 'PRICE_SETTINGS_CHANGED',
        metadata: { teacherId, grade, newPrice, effectiveMonth, changedById: managerId }
      });
    }
  }
};

