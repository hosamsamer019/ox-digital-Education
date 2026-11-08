import { db } from '../../../../packages/database/src/index.js';
import { logger } from '@shared/utils';

export type PlatformEventType =
  | 'STUDENT_REGISTERED'
  | 'COLLECTION_CONFIRMED'
  | 'RECEIPT_READY'
  | 'REVERSAL_REQUESTED'
  | 'REVERSAL_DECISION'
  | 'CASHBOX_DISCREPANCY'
  | 'EXPENSE_REQUESTED'
  | 'EXPENSE_APPROVED'
  | 'EXPENSE_DISBURSED';

interface BaseEventPayload {
  institutionId: string;
  branchId?: string | null;
}

export interface StudentRegisteredPayload extends BaseEventPayload {
  studentId: string;
  studentName: string;
  studentPhone?: string | null;
  parentId?: string | null;
  teacherIds?: string[];
}

export interface CollectionConfirmedPayload extends BaseEventPayload {
  collectionId: string;
  receiptNumber: string;
  studentId: string;
  studentName: string;
  totalAmount: number;
  currency: string;
  payerName?: string | null;
  cashierId: string;
  cashierName: string;
  teacherIds?: string[];
}

export interface ReceiptReadyPayload extends BaseEventPayload {
  collectionId: string;
  receiptNumber: string;
  studentId: string;
  receiptPdfUrl: string;
  totalAmount: number;
  currency: string;
}

export interface ReversalRequestedPayload extends BaseEventPayload {
  adjustmentId: string;
  collectionId: string;
  receiptNumber: string;
  amount: number;
  currency: string;
  reason: string;
  requestedById: string;
  requestedByName: string;
}

export interface ReversalDecisionPayload extends BaseEventPayload {
  adjustmentId: string;
  collectionId: string;
  receiptNumber: string;
  amount: number;
  currency: string;
  status: 'APPROVED' | 'REJECTED';
  reviewedById: string;
  reviewedByName: string;
  studentId: string;
  requesterId?: string;
}

export interface CashboxDiscrepancyPayload extends BaseEventPayload {
  cashboxId: string;
  cashboxName: string;
  cashierId: string;
  cashierName: string;
  systemExpected: number;
  actualCounted: number;
  difference: number;
  currency: string;
}

export interface ExpenseRequestedPayload extends BaseEventPayload {
  voucherId: string;
  voucherNumber: string;
  amount: number;
  currency: string;
  category: string;
  description: string;
  requesterId: string;
  requesterName: string;
}

export interface ExpenseApprovedPayload extends BaseEventPayload {
  voucherId: string;
  voucherNumber: string;
  amount: number;
  currency: string;
  approverId: string;
  approverName: string;
  requesterId: string;
}

export interface ExpenseDisbursedPayload extends BaseEventPayload {
  voucherId: string;
  voucherNumber: string;
  amount: number;
  currency: string;
  disburserId: string;
  disburserName: string;
  requesterId: string;
  paymentMethod: string;
}

/**
 * Persists an in-app notification in PostgreSQL with deduplication and error isolation
 */
async function createNotificationRecord(data: {
  userId: string;
  title: string;
  message: string;
  type: string;
  metadata?: any;
}) {
  try {
    return await db.notification.create({
      data: {
        userId: data.userId,
        title: data.title,
        message: data.message,
        type: data.type,
        metadata: data.metadata || null,
        read: false
      }
    });
  } catch (err: any) {
    logger.error(`[NotificationService] Failed to create notification for user ${data.userId}: ${err.message}`);
    return null;
  }
}

/**
 * Resolves institution Primary Managers, Admins, and Accountants
 */
async function getStaffRecipients(institutionId: string, roles: ('PRIMARY_MANAGER' | 'ADMIN' | 'ACCOUNTANT')[]) {
  try {
    const staff = await db.user.findMany({
      where: {
        institutionId,
        role: { in: roles },
        deletedAt: null
      },
      select: { id: true, role: true, name: true }
    });
    return staff;
  } catch (err: any) {
    logger.error(`[NotificationService] Error querying staff recipients: ${err.message}`);
    return [];
  }
}

/**
 * Resolves student's linked parent
 */
async function getParentRecipient(studentId: string, explicitParentId?: string | null) {
  try {
    if (explicitParentId) {
      const parent = await db.user.findUnique({
        where: { id: explicitParentId },
        select: { id: true }
      });
      if (parent) return parent.id;
    }

    const student = await db.user.findUnique({
      where: { id: studentId },
      select: { parentId: true }
    });
    return student?.parentId || null;
  } catch (err: any) {
    logger.error(`[NotificationService] Error querying parent recipient: ${err.message}`);
    return null;
  }
}

/**
 * Central In-App Notification Event Dispatcher
 */
export const NotificationEventService = {
  /**
   * Event: STUDENT_REGISTERED
   * Alerts Student, Linked Guardian, Accountants, Primary Managers, and assigned Teachers
   */
  async onStudentRegistered(payload: StudentRegisteredPayload) {
    const { institutionId, studentId, studentName, studentPhone, parentId, teacherIds } = payload;

    // 1. Notify Student
    await createNotificationRecord({
      userId: studentId,
      title: 'مرحباً بك في منصة OX-DIGITAL التعليمية',
      message: `تم تسجيلك بنجاح في المؤسسة التعليمية. مرحباً بك في مسارك الدراسي.`,
      type: 'STUDENT_REGISTERED',
      metadata: { studentId, studentName }
    });

    // 2. Notify Linked Guardian / Parent
    const parentUserId = await getParentRecipient(studentId, parentId);
    if (parentUserId) {
      await createNotificationRecord({
        userId: parentUserId,
        title: `تم تسجيل الطالب: ${studentName}`,
        message: `تم تسجيل الطالب ${studentName} في المؤسسة التعليمية بنجاح. يمكنك متابعة مساره الدراسي والمالي.`,
        type: 'STUDENT_REGISTERED',
        metadata: { studentId, studentName }
      });
    }

    // 3. Notify Accountants to create financial agreements and obligations
    const accountants = await getStaffRecipients(institutionId, ['ACCOUNTANT']);
    for (const acc of accountants) {
      await createNotificationRecord({
        userId: acc.id,
        title: `طالب جديد مسجل: ${studentName}`,
        message: `تم تسجيل الطالب ${studentName}. يرجى إعداد الاتفاقية المالية وإنشاء التزامات الدفع الشهرية.`,
        type: 'STUDENT_REGISTERED',
        metadata: { studentId, studentName, studentPhone, action: 'CREATE_AGREEMENT' }
      });
    }

    // 4. Notify Primary Managers
    const managers = await getStaffRecipients(institutionId, ['PRIMARY_MANAGER', 'ADMIN']);
    for (const mgr of managers) {
      await createNotificationRecord({
        userId: mgr.id,
        title: `طالب جديد: ${studentName}`,
        message: `تم تسجيل طالب جديد (${studentName}) في قوائم المؤسسة.`,
        type: 'STUDENT_REGISTERED',
        metadata: { studentId, studentName }
      });
    }

    // 5. Notify assigned teachers
    if (teacherIds && teacherIds.length > 0) {
      for (const tId of teacherIds) {
        await createNotificationRecord({
          userId: tId,
          title: `طالب جديد في مجموعتك: ${studentName}`,
          message: `تم إلحاق الطالب ${studentName} في المجموعة الدراسية الخاصة بك.`,
          type: 'STUDENT_REGISTERED',
          metadata: { studentId, studentName }
        });
      }
    }
  },

  /**
   * Event: COLLECTION_CONFIRMED
   * Notifies Student, Parent, Cashier, Primary Manager, and privacy-safe Teacher
   */
  async onCollectionConfirmed(payload: CollectionConfirmedPayload) {
    const {
      institutionId,
      collectionId,
      receiptNumber,
      studentId,
      studentName,
      totalAmount,
      currency,
      cashierId,
      cashierName,
      teacherIds
    } = payload;

    // 1. Student notification
    await createNotificationRecord({
      userId: studentId,
      title: `تم استلام دفعة - إيصال رقم #${receiptNumber}`,
      message: `تم تسجيل دفعتك المالية بقيمة ${totalAmount} ${currency} بنجاح. إيصال رقم #${receiptNumber} متاح الآن.`,
      type: 'COLLECTION_CONFIRMED',
      metadata: { collectionId, receiptNumber, amount: totalAmount, currency, receiptUrl: `/api/accounting/receipts/${collectionId}/pdf` }
    });

    // 2. Parent notification (if linked)
    const parentUserId = await getParentRecipient(studentId);
    if (parentUserId) {
      await createNotificationRecord({
        userId: parentUserId,
        title: `تم سداد رسوم للطالب ${studentName}`,
        message: `تم استلام دفعة بقيمة ${totalAmount} ${currency} للطالب ${studentName} بموجب إيصال رقم #${receiptNumber}.`,
        type: 'COLLECTION_CONFIRMED',
        metadata: { collectionId, receiptNumber, amount: totalAmount, currency, receiptUrl: `/api/accounting/receipts/${collectionId}/pdf` }
      });
    }

    // 3. Cashier/Accountant confirmation
    if (cashierId) {
      await createNotificationRecord({
        userId: cashierId,
        title: `تم تسجيل التحصيل #${receiptNumber}`,
        message: `تم بنجاح حفظ عملية التحصيل #${receiptNumber} بمبلغ ${totalAmount} ${currency} للطالب ${studentName}.`,
        type: 'COLLECTION_CONFIRMED',
        metadata: { collectionId, receiptNumber, amount: totalAmount }
      });
    }

    // 4. Primary Manager oversight
    const managers = await getStaffRecipients(institutionId, ['PRIMARY_MANAGER', 'ADMIN']);
    for (const mgr of managers) {
      // Don't duplicate if the cashier is the manager
      if (mgr.id !== cashierId) {
        await createNotificationRecord({
          userId: mgr.id,
          title: `تحصيل جديد: #${receiptNumber}`,
          message: `قام ${cashierName} بتحصيل مبلغ ${totalAmount} ${currency} من الطالب ${studentName}.`,
          type: 'COLLECTION_CONFIRMED',
          metadata: { collectionId, receiptNumber, amount: totalAmount }
        });
      }
    }

    // 5. Teachers PRIVACY-SAFE notification (strictly no monetary figures or receipt details)
    if (teacherIds && teacherIds.length > 0) {
      for (const tId of teacherIds) {
        await createNotificationRecord({
          userId: tId,
          title: `تحديث الموقف المالي للطالب: ${studentName}`,
          message: `تم سداد الرسوم المطلوبة للطالب ${studentName}. الموقف المالي: نشط / معتمد.`,
          type: 'ENROLLMENT_CLEARED',
          metadata: { studentId, studentName, status: 'CLEARED' }
        });
      }
    }
  },

  /**
   * Event: RECEIPT_READY
   */
  async onReceiptReady(payload: ReceiptReadyPayload) {
    const { collectionId, receiptNumber, studentId, receiptPdfUrl, totalAmount, currency } = payload;
    await createNotificationRecord({
      userId: studentId,
      title: `الإيصال الرسمي جاهز #${receiptNumber}`,
      message: `يمكنك الآن استعراض وتحميل الإيصال الرقمي الرسمي المعتمد بقيمة ${totalAmount} ${currency}.`,
      type: 'RECEIPT_READY',
      metadata: { collectionId, receiptNumber, receiptPdfUrl }
    });

    const parentUserId = await getParentRecipient(studentId);
    if (parentUserId) {
      await createNotificationRecord({
        userId: parentUserId,
        title: `إيصال رسمي جاهز #${receiptNumber}`,
        message: `الإيصال الرقمي الرسمي رقم #${receiptNumber} متاح الآن للتحميل.`,
        type: 'RECEIPT_READY',
        metadata: { collectionId, receiptNumber, receiptPdfUrl }
      });
    }
  },

  /**
   * Event: REVERSAL_REQUESTED
   * Alerts Primary Manager for approval
   */
  async onReversalRequested(payload: ReversalRequestedPayload) {
    const { institutionId, adjustmentId, collectionId, receiptNumber, amount, currency, reason, requestedByName } = payload;
    const managers = await getStaffRecipients(institutionId, ['PRIMARY_MANAGER', 'ADMIN']);
    for (const mgr of managers) {
      await createNotificationRecord({
        userId: mgr.id,
        title: `طلب استرداد / إلغاء إيصال: #${receiptNumber}`,
        message: `قدم ${requestedByName} طلباً لاسترداد مبلغ ${amount} ${currency} للإيصال رقم #${receiptNumber}. السبب: "${reason}".`,
        type: 'REVERSAL_REQUESTED',
        metadata: { adjustmentId, collectionId, receiptNumber, amount, currency, reason }
      });
    }
  },

  /**
   * Event: REVERSAL_DECISION
   * Notifies Requester, Student, and Parent of Manager's decision
   */
  async onReversalDecision(payload: ReversalDecisionPayload) {
    const { adjustmentId, collectionId, receiptNumber, amount, currency, status, reviewedByName, studentId, requesterId } = payload;
    const arabicStatus = status === 'APPROVED' ? 'تمت الموافقة عليه' : 'تم رفضه';

    // Notify requester (accountant)
    if (requesterId) {
      await createNotificationRecord({
        userId: requesterId,
        title: `قرار طلب الاسترداد #${receiptNumber}: ${status}`,
        message: `طلب استرداد الإيصال #${receiptNumber} بمبلغ ${amount} ${currency} ${arabicStatus} بواسطة ${reviewedByName}.`,
        type: 'REVERSAL_DECISION',
        metadata: { adjustmentId, collectionId, receiptNumber, status, amount }
      });
    }

    // Notify student and parent
    await createNotificationRecord({
      userId: studentId,
      title: `تحديث طلب الاسترداد للإيصال #${receiptNumber}`,
      message: `طلب الاسترداد للإيصال #${receiptNumber} ${arabicStatus}.`,
      type: 'REVERSAL_DECISION',
      metadata: { adjustmentId, collectionId, receiptNumber, status }
    });

    const parentUserId = await getParentRecipient(studentId);
    if (parentUserId) {
      await createNotificationRecord({
        userId: parentUserId,
        title: `تحديث طلب الاسترداد للإيصال #${receiptNumber}`,
        message: `طلب الاسترداد للإيصال #${receiptNumber} ${arabicStatus}.`,
        type: 'REVERSAL_DECISION',
        metadata: { adjustmentId, collectionId, receiptNumber, status }
      });
    }

    // Notify other management users
    const managers = await getStaffRecipients(payload.institutionId, ['PRIMARY_MANAGER', 'ADMIN']);
    for (const mgr of managers) {
      if (mgr.id !== requesterId) {
        await createNotificationRecord({
          userId: mgr.id,
          title: `قرار استرداد الإيصال #${receiptNumber}`,
          message: `تم اتخاذ القرار (${arabicStatus}) لطلب استرداد الإيصال #${receiptNumber} بمبلغ ${amount} ${currency} بواسطة ${reviewedByName}.`,
          type: 'REVERSAL_DECISION',
          metadata: { adjustmentId, collectionId, receiptNumber, status, amount }
        });
      }
    }
  },

  /**
   * Event: CASHBOX_DISCREPANCY
   * High-priority alert to Primary Managers when a blind reconciliation shows a mismatch
   */
  async onCashboxDiscrepancy(payload: CashboxDiscrepancyPayload) {
    const {
      institutionId,
      cashboxId,
      cashboxName,
      cashierId,
      cashierName,
      systemExpected,
      actualCounted,
      difference,
      currency
    } = payload;

    const diffText = difference > 0 ? `+${difference}` : `${difference}`;
    const managers = await getStaffRecipients(institutionId, ['PRIMARY_MANAGER', 'ADMIN']);
    for (const mgr of managers) {
      await createNotificationRecord({
        userId: mgr.id,
        title: `⚠️ تنبيه عجز/فائض في إغلاق الخزينة: ${cashboxName}`,
        message: `تم إغلاق الخزينة '${cashboxName}' بواسطة ${cashierName} مع وجود فارق قدره ${diffText} ${currency} (المتوقع نظاماً: ${systemExpected}، الفعلي المحصور: ${actualCounted}). تم توثيق التسوية رسمياً.`,
        type: 'CASHBOX_DISCREPANCY',
        metadata: { cashboxId, cashboxName, cashierId, cashierName, systemExpected, actualCounted, difference, currency }
      });
    }
  },

  /**
   * Event: EXPENSE_REQUESTED
   */
  async onExpenseRequested(payload: ExpenseRequestedPayload) {
    const { institutionId, voucherId, voucherNumber, amount, currency, category, description, requesterId, requesterName } = payload;
    const managers = await getStaffRecipients(institutionId, ['PRIMARY_MANAGER', 'ADMIN']);
    for (const mgr of managers) {
      // If the requester is a manager, still send notification to other managers or log it
      await createNotificationRecord({
        userId: mgr.id,
        title: `طلب صرف مصروفات جديد: #${voucherNumber}`,
        message: `قدم ${requesterName} طلب سند صرف بمبلغ ${amount} ${currency} لبند (${category}): "${description}". يتطلب موافقتك.`,
        type: 'EXPENSE_REQUESTED',
        metadata: { voucherId, voucherNumber, amount, currency, category, requesterId }
      });
    }
  },

  /**
   * Event: EXPENSE_APPROVED
   */
  async onExpenseApproved(payload: ExpenseApprovedPayload) {
    const { institutionId, voucherId, voucherNumber, amount, currency, approverName, requesterId } = payload;

    // Notify requester
    await createNotificationRecord({
      userId: requesterId,
      title: `تمت الموافقة على سند الصرف: #${voucherNumber}`,
      message: `تمت الموافقة على سند الصرف #${voucherNumber} بمبلغ ${amount} ${currency} من قِبل ${approverName}. جاهز للصرف من الخزينة.`,
      type: 'EXPENSE_APPROVED',
      metadata: { voucherId, voucherNumber, amount, currency }
    });

    // Notify accountants to disburse
    const accountants = await getStaffRecipients(institutionId, ['ACCOUNTANT']);
    for (const acc of accountants) {
      if (acc.id !== requesterId) {
        await createNotificationRecord({
          userId: acc.id,
          title: `سند صرف معتمد جاهز للصرف: #${voucherNumber}`,
          message: `تم اعتماد سند الصرف #${voucherNumber} (${amount} ${currency}). يمكن الآن صرفه نقداً أو تحويلاً بنكياً.`,
          type: 'EXPENSE_APPROVED',
          metadata: { voucherId, voucherNumber, amount, currency }
        });
      }
    }
  },

  /**
   * Event: EXPENSE_DISBURSED
   */
  async onExpenseDisbursed(payload: ExpenseDisbursedPayload) {
    const { institutionId, voucherId, voucherNumber, amount, currency, disburserName, requesterId, paymentMethod } = payload;

    // Notify requester
    await createNotificationRecord({
      userId: requesterId,
      title: `تم صرف سند المصروفات: #${voucherNumber}`,
      message: `تم صرف سند المصروفات #${voucherNumber} بمبلغ ${amount} ${currency} طريقة (${paymentMethod}) بواسطة ${disburserName}.`,
      type: 'EXPENSE_DISBURSED',
      metadata: { voucherId, voucherNumber, amount, paymentMethod }
    });

    // Notify managers
    const managers = await getStaffRecipients(institutionId, ['PRIMARY_MANAGER', 'ADMIN']);
    for (const mgr of managers) {
      await createNotificationRecord({
        userId: mgr.id,
        title: `تم صرف سند #${voucherNumber}`,
        message: `قام ${disburserName} بصرف سند المصروفات #${voucherNumber} (${amount} ${currency} - ${paymentMethod}).`,
        type: 'EXPENSE_DISBURSED',
        metadata: { voucherId, voucherNumber, amount, paymentMethod }
      });
    }
  }
};

