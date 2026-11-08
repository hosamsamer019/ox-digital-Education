import { Response } from 'express';
import { db } from '../../../../../packages/database/src/index.js';
import { AuthRequest, isAuthorizedPrimaryManager } from '../../middlewares/auth.middleware.js';
import { resolveAccountingReportScope, resolveDateRangeFilter } from '../../utils/accountingScope.util.js';
import { NotificationEventService } from '../../services/notificationEvent.service.js';
import { persistReceiptPdf } from '../../services/receiptPdf.service.js';
import { MonthlyFeeAccessControlService } from '../../services/monthlyFeeAccessControl.service.js';
import { logger } from '@shared/utils';
import crypto from 'crypto';

/**
 * Generate a sequential, human-readable, unique receipt number
 * Format: REC-YYYYMMDD-XXXXX
 */
function generateReceiptNumber(): string {
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const randomPart = Math.floor(10000 + Math.random() * 90000);
  return `REC-${dateStr}-${randomPart}`;
}

/**
 * POST /api/accounting/collections
 * Record a student fee collection (single or mixed payment methods)
 */
export const createCollection = async (req: AuthRequest, res: Response) => {
  try {
    const institutionId = req.user?.institutionId || req.tenantContext?.institutionId;
    const branchId = req.user?.branchId || req.tenantContext?.branchId;
    const cashierUserId = req.user?.userId;
    const userRole = (req.user?.role || '').toUpperCase();

    if (!institutionId || !cashierUserId) {
      return res.status(401).json({ message: 'Unauthorized: Missing tenant or user identity' });
    }

    if (userRole !== 'ACCOUNTANT' && !isAuthorizedPrimaryManager(req.user)) {
      return res.status(403).json({ message: 'Forbidden: Insufficient permissions to record collections' });
    }

    const {
      studentId,
      cashboxId,
      amount,
      currency = 'EGP',
      tenders = [],
      payerUserId,
      payerName,
      payerPhone,
      notes,
      idempotencyKey
    } = req.body;

    if (!studentId || !amount || Number(amount) <= 0) {
      return res.status(400).json({ message: 'Invalid payload: studentId and positive amount are required' });
    }

    const numAmount = Number(amount);

    // Idempotency Check
    if (idempotencyKey) {
      const existingIdempotency = await db.financialIdempotencyRecord.findUnique({
        where: {
          institutionId_idempotencyKey: {
            institutionId: institutionId as string,
            idempotencyKey
          }
        }
      });
      if (existingIdempotency) {
        return res.status(existingIdempotency.statusCode).json(existingIdempotency.responsePayload);
      }
    }

    // Verify student exists and belongs to institution
    const student = await db.user.findFirst({
      where: {
        id: studentId,
        institutionId: institutionId as string,
        deletedAt: null
      },
      select: { id: true, name: true, phone: true, parentId: true, branchId: true }
    });

    if (!student) {
      return res.status(404).json({ message: 'Student not found in this institution' });
    }

    const targetBranchId = branchId || student.branchId || (await db.branch.findFirst({
      where: { institutionId: institutionId as string, isDefault: true }
    }))?.id;

    if (!targetBranchId) {
      return res.status(400).json({ message: 'No valid branch resolved for collection' });
    }

    // Validate tenders or default to single tender
    let normalizedTenders: Array<{
      tenderType: 'CASH' | 'POS_CARD' | 'BANK_TRANSFER' | 'CHEQUE' | 'OTHER';
      amount: number;
      cashboxId?: string | null;
      posTerminalId?: string | null;
      posAuthCode?: string | null;
      cardLastFour?: string | null;
      bankReferenceNumber?: string | null;
    }> = [];

    if (Array.isArray(tenders) && tenders.length > 0) {
      normalizedTenders = tenders.map((t: any) => ({
        tenderType: t.tenderType || t.method || 'CASH',
        amount: Number(t.amount || 0),
        cashboxId: t.cashboxId || null,
        posTerminalId: t.posTerminalId || null,
        posAuthCode: t.posAuthCode || null,
        cardLastFour: t.cardLastFour || null,
        bankReferenceNumber: t.bankReferenceNumber || null
      }));
    } else {
      normalizedTenders = [{
        tenderType: (req.body.paymentMethod || 'CASH') as any,
        amount: numAmount,
        cashboxId: cashboxId || null
      }];
    }

    // Verify sum of tenders equals total amount
    const tendersSum = normalizedTenders.reduce((sum, t) => sum + t.amount, 0);
    if (Math.abs(tendersSum - numAmount) > 0.01) {
      return res.status(400).json({
        message: `Tenders total (${tendersSum}) does not match collection amount (${numAmount})`
      });
    }

    // Check cashbox requirements if any tender is CASH
    const cashTenders = normalizedTenders.filter(t => t.tenderType === 'CASH');
    let resolvedCashbox: any = null;

    if (cashTenders.length > 0) {
      const targetCashboxId = cashboxId || cashTenders[0].cashboxId;
      if (targetCashboxId) {
        resolvedCashbox = await db.cashbox.findFirst({
          where: { id: targetCashboxId, institutionId: institutionId as string, status: 'ACTIVE', deletedAt: null }
        });
      } else {
        // Fallback: find first active cashbox for branch or institution
        resolvedCashbox = await db.cashbox.findFirst({
          where: { institutionId: institutionId as string, branchId: targetBranchId, status: 'ACTIVE', deletedAt: null }
        });
      }

      if (!resolvedCashbox) {
        return res.status(400).json({
          message: 'An active cashbox is required to receive cash payments'
        });
      }
    }

    const receiptNumber = generateReceiptNumber();

    // Execute atomic transaction for Collection, Tenders, Cashbox Inflow, Allocations & Student Financial Account
    const result: any = await db.$transaction(async (tx) => {
      // 1. Process Cashbox increment if cash involved
      const totalCash = cashTenders.reduce((sum, t) => sum + t.amount, 0);
      if (totalCash > 0 && resolvedCashbox) {
        const updatedCashbox = await tx.cashbox.update({
          where: { id: resolvedCashbox.id },
          data: {
            currentBalance: { increment: totalCash }
          }
        });

        await tx.cashboxTransaction.create({
          data: {
            institutionId: institutionId as string,
            branchId: targetBranchId,
            cashboxId: resolvedCashbox.id,
            type: 'COLLECTION',
            amount: totalCash,
            balanceAfter: updatedCashbox.currentBalance,
            businessDate: new Date().toISOString().slice(0, 10),
            actorUserId: cashierUserId,
            actorRole: (userRole as any) || 'ACCOUNTANT',
            referenceType: 'COLLECTION',
            notes: `Receipt #${receiptNumber} - Student: ${student.name}`,
            status: 'POSTED'
          }
        });
      }

      // 2. Create Collection Record
      const collection = await tx.collection.create({
        data: {
          institutionId: institutionId as string,
          branchId: targetBranchId,
          cashboxId: resolvedCashbox ? resolvedCashbox.id : null,
          cashierUserId,
          studentId,
          receiptNumber,
          amountCollected: numAmount,
          allocatedAmount: 0,
          unallocatedAmount: numAmount,
          paymentMethod: normalizedTenders.length === 1 ? normalizedTenders[0].tenderType : 'OTHER',
          status: 'COLLECTED',
          notes: notes || null,
          payerUserId: payerUserId || null,
          payerName: payerName || null,
          payerPhone: payerPhone || null,
          receiptPdfUrl: `/api/accounting/receipts/${receiptNumber}/pdf`
        }
      });

      // 3. Create Collection Tenders
      for (const tender of normalizedTenders) {
        await tx.collectionTender.create({
          data: {
            collectionId: collection.id,
            tenderType: tender.tenderType,
            amount: tender.amount,
            cashboxId: tender.tenderType === 'CASH' && resolvedCashbox ? resolvedCashbox.id : null,
            posTerminalId: tender.posTerminalId || null,
            posAuthCode: tender.posAuthCode || null,
            cardLastFour: tender.cardLastFour || null,
            bankReferenceNumber: tender.bankReferenceNumber || null
          }
        });
      }

      // 4. Automatic FIFO Allocation to Oldest Pending Obligations
      let remainingToAllocate = numAmount;
      let totalAllocated = 0;

      const pendingObligations = await tx.studentObligation.findMany({
        where: {
          studentId,
          institutionId: institutionId as string,
          status: { in: ['PENDING', 'PARTIALLY_PAID', 'OVERDUE'] }
        },
        orderBy: { dueDate: 'asc' }
      });

      for (const obligation of pendingObligations) {
        if (remainingToAllocate <= 0) break;

        const due = Number(obligation.amountDue);
        const collected = Number(obligation.amountCollected);
        const unpaid = due - collected;

        if (unpaid <= 0) continue;

        const allocationForThis = Math.min(remainingToAllocate, unpaid);

        await tx.collectionAllocation.create({
          data: {
            idempotencyKey: `ALLOC_${collection.id}_${obligation.id}`,
            institutionId: institutionId as string,
            branchId: targetBranchId,
            studentId,
            agreementId: obligation.agreementId,
            collectionId: collection.id,
            obligationId: obligation.id,
            amount: allocationForThis,
            allocatedByUserId: cashierUserId,
            status: 'ACTIVE',
            notes: `Auto-allocated from receipt #${receiptNumber}`
          }
        });

        const newCollected = collected + allocationForThis;
        const newStatus = newCollected >= due ? 'FULFILLED' : 'PARTIALLY_PAID';

        await tx.studentObligation.update({
          where: { id: obligation.id },
          data: {
            amountCollected: newCollected,
            status: newStatus
          }
        });

        remainingToAllocate -= allocationForThis;
        totalAllocated += allocationForThis;
      }

      // Update collection with final allocated & unallocated amounts
      const updatedCollection = await tx.collection.update({
        where: { id: collection.id },
        data: {
          allocatedAmount: totalAllocated,
          unallocatedAmount: numAmount - totalAllocated
        },
        include: {
          tenders: true,
          allocations: true,
          student: { select: { id: true, name: true, phone: true } },
          cashier: { select: { id: true, name: true } }
        }
      });

      // 5. Ensure Student Financial Account exists
      let financialAccount = await tx.studentFinancialAccount.findFirst({
        where: { institutionId: institutionId as string, studentId }
      });
      if (!financialAccount) {
        financialAccount = await tx.studentFinancialAccount.create({
          data: {
            institutionId: institutionId as string,
            studentId,
            accountNumber: `AR-${studentId.slice(0, 8).toUpperCase()}`,
            currency,
            status: 'ACTIVE'
          }
        });
      }

      return updatedCollection;
    });

    // Lookup any teachers assigned to this student for enrollment clearance notifications
    const enrollments = await db.courseEnrollment.findMany({
      where: { studentId },
      include: { course: { select: { teacherId: true } } }
    });
    const teacherIds = Array.from(new Set(enrollments.map(e => e.course?.teacherId).filter(Boolean))) as string[];

    // Dispatch Central In-App Notifications
    await NotificationEventService.onCollectionConfirmed({
      institutionId: institutionId as string,
      branchId: targetBranchId,
      collectionId: result.id,
      receiptNumber: result.receiptNumber,
      studentId: student.id,
      studentName: student.name,
      totalAmount: numAmount,
      currency,
      payerName: payerName || student.name,
      cashierId: cashierUserId,
      cashierName: req.user?.email || 'Accountant',
      teacherIds
    });

    // Permanently persist the original binary PDF receipt to durable disk storage
    let pdfPersisted = false;
    try {
      const fullReceipt: any = await db.collection.findUnique({
        where: { id: result.id },
        include: {
          institution: { select: { id: true, name: true, code: true } },
          branch: { select: { id: true, name: true, code: true } },
          student: { select: { id: true, name: true, phone: true, academicLevel: true } },
          cashier: { select: { id: true, name: true, email: true } },
          cashbox: { select: { id: true, name: true, code: true } },
          tenders: true,
          allocations: { include: { obligation: true } }
        }
      });
      if (fullReceipt) {
        await persistReceiptPdf(fullReceipt);
        pdfPersisted = true;
      }
    } catch (pdfErr: any) {
      logger.error(`[Accounting] Failed to persist original PDF receipt: ${pdfErr.message}`);
    }

    if (pdfPersisted) {
      await NotificationEventService.onReceiptReady({
        institutionId: institutionId as string,
        branchId: targetBranchId,
        collectionId: result.id,
        receiptNumber: result.receiptNumber,
        studentId: student.id,
        receiptPdfUrl: `/api/accounting/receipts/${result.id}/pdf`,
        totalAmount: numAmount,
        currency
      });
    }

    // Save Idempotency response if key supplied
    if (idempotencyKey) {
      await db.financialIdempotencyRecord.create({
        data: {
          institutionId: institutionId as string,
          idempotencyKey,
          requestHash: crypto.createHash('sha256').update(JSON.stringify(req.body)).digest('hex'),
          operationType: 'COLLECTION_INTAKE',
          responsePayload: result as any,
          statusCode: 201,
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000)
        }
      });
    }

    // Automatic Reactivation on confirmed collection (MANDATORY RULE 5.5)
    try {
      await MonthlyFeeAccessControlService.evaluateStudentFinancialAccess(
        student.id,
        new Date(),
        'FULL_COLLECTION_REACTIVATION'
      );
    } catch (evalErr: any) {
      logger.error(`[Accounting] Error evaluating student financial access after collection: ${evalErr.message}`);
    }

    return res.status(201).json({
      success: true,
      message: 'Collection recorded successfully',
      collection: result
    });
  } catch (error: any) {
    logger.error(`[Accounting] Error recording collection: ${error.message}`);
    return res.status(500).json({ message: 'Error recording collection', error: error.message });
  }
};

/**
 * GET /api/accounting/collections
 * List collections with strict server-side branch scoping, reversed-receipt exclusion, date range validation, and summary totals
 */
export const listCollections = async (req: AuthRequest, res: Response) => {
  try {
    const scope = await resolveAccountingReportScope(req);
    if (!scope.ok) {
      return res.status(scope.status || 403).json({ message: scope.message });
    }

    const dateRange = resolveDateRangeFilter(req);
    if (!dateRange.ok) {
      return res.status(dateRange.status || 400).json({ message: dateRange.message });
    }

    const {
      studentId,
      cashboxId,
      status,
      includeReversed,
      receiptNumber,
      page = '1',
      limit = '50'
    } = req.query;

    const pageNum = Math.max(1, parseInt(page as string, 10) || 1);
    const limitNum = Math.min(200, Math.max(1, parseInt(limit as string, 10) || 50));
    const skip = (pageNum - 1) * limitNum;

    const where: any = { institutionId: scope.institutionId };

    // Strict server-side branch isolation (mandatory for ACCOUNTANT, optional validated filter for PRIMARY_MANAGER)
    if (scope.branchId) {
      where.branchId = scope.branchId;
    }

    if (studentId) where.studentId = studentId as string;
    if (cashboxId) where.cashboxId = cashboxId as string;
    if (receiptNumber) where.receiptNumber = { contains: receiptNumber as string, mode: 'insensitive' };

    // Exclude reversed/voided/cancelled receipts from active collection reports and totals by default
    const wantsReversedAudit = includeReversed === 'true' || String(status || '').toUpperCase() === 'REVERSED';
    if (wantsReversedAudit) {
      if (status) {
        where.status = String(status).toUpperCase() as any;
      }
    } else {
      where.status = 'COLLECTED';
    }

    if (dateRange.startDate || dateRange.endDate) {
      where.collectedAt = {};
      if (dateRange.startDate) where.collectedAt.gte = dateRange.startDate;
      if (dateRange.endDate) where.collectedAt.lte = dateRange.endDate;
    }

    const [collections, total, aggregateTotals, branchInfo] = await Promise.all([
      db.collection.findMany({
        where,
        orderBy: { collectedAt: 'desc' },
        skip,
        take: limitNum,
        include: {
          branch: { select: { id: true, name: true, code: true } },
          student: { select: { id: true, name: true, phone: true } },
          cashier: { select: { id: true, name: true, email: true } },
          cashbox: { select: { id: true, name: true, code: true } },
          tenders: true,
          allocations: {
            include: {
              obligation: true
            }
          }
        }
      }),
      db.collection.count({ where }),
      db.collection.aggregate({
        where,
        _sum: { amountCollected: true },
        _count: { id: true }
      }),
      scope.branchId
        ? db.branch.findUnique({ where: { id: scope.branchId }, select: { id: true, name: true, code: true } })
        : Promise.resolve(null)
    ]);

    const totalAmount = Number(aggregateTotals._sum.amountCollected || 0);

    return res.json({
      collections,
      branchScope: branchInfo || { id: 'ALL', name: 'جميع فروع المؤسسة', code: 'ALL' },
      summary: {
        totalCount: aggregateTotals._count.id,
        totalAmount,
        currency: 'EGP',
        excludesReversed: !wantsReversedAudit
      },
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum)
      }
    });
  } catch (error: any) {
    logger.error(`[Accounting] Error listing collections: ${error.message}`);
    return res.status(500).json({ message: 'Error listing collections', error: error.message });
  }
};

/**
 * GET /api/accounting/collections/:id
 * Fetch single collection with detailed breakdown
 */
export const getCollectionById = async (req: AuthRequest, res: Response) => {
  try {
    const institutionId = req.user?.institutionId || req.tenantContext?.institutionId;
    if (!institutionId) {
      return res.status(401).json({ message: 'Unauthorized: Missing tenant identity' });
    }

    const { id } = req.params;

    const collection = await db.collection.findFirst({
      where: { id, institutionId: institutionId as string },
      include: {
        student: { select: { id: true, name: true, phone: true, parentId: true } },
        cashier: { select: { id: true, name: true, email: true } },
        cashbox: { select: { id: true, name: true, code: true } },
        payer: { select: { id: true, name: true, phone: true } },
        tenders: true,
        allocations: {
          include: {
            obligation: true
          }
        }
      }
    });

    if (!collection) {
      return res.status(404).json({ message: 'Collection not found' });
    }

    const userRole = (req.user?.role || '').toUpperCase();
    const currentUserId = req.user?.userId;

    if (userRole === 'PARENT') {
      if (collection.student?.parentId !== currentUserId) {
        return res.status(403).json({ message: 'Forbidden: Cannot access collections of non-linked students' });
      }
    } else if (['STUDENT', 'ONLINE_STUDENT', 'CENTER_STUDENT'].includes(userRole)) {
      if (collection.studentId !== currentUserId) {
        return res.status(403).json({ message: 'Forbidden: Cannot access collections of other students' });
      }
    } else if (userRole === 'ACCOUNTANT') {
      if (req.user?.branchId && collection.branchId && collection.branchId !== req.user.branchId) {
        return res.status(403).json({ message: 'Forbidden: Branch accountants can only access collections of their assigned branch' });
      }
    }

    return res.json(collection);
  } catch (error: any) {
    return res.status(500).json({ message: 'Error fetching collection', error: error.message });
  }
};

/**
 * POST /api/accounting/collections/:id/reversal-request
 * Submit a refund/reversal request for a collection
 */
export const requestReversal = async (req: AuthRequest, res: Response) => {
  try {
    const institutionId = req.user?.institutionId || req.tenantContext?.institutionId;
    const requesterId = req.user?.userId;
    const { id } = req.params;
    const { reason, amount } = req.body;

    if (!institutionId || !requesterId) {
      return res.status(401).json({ message: 'Unauthorized: Missing tenant or user identity' });
    }

    if (!reason || !reason.trim()) {
      return res.status(400).json({ message: 'Reversal reason is mandatory' });
    }

    const collection = await db.collection.findFirst({
      where: { id, institutionId: institutionId as string },
      include: { student: true }
    });

    if (!collection) {
      return res.status(404).json({ message: 'Collection not found' });
    }

    const userRole = (req.user?.role || '').toUpperCase();
    const currentUserId = req.user?.userId;

    if (userRole === 'PARENT') {
      if (collection.student?.parentId !== currentUserId) {
        return res.status(403).json({ message: 'Forbidden: Cannot access collections of non-linked students' });
      }
    } else if (['STUDENT', 'ONLINE_STUDENT', 'CENTER_STUDENT'].includes(userRole)) {
      if (collection.studentId !== currentUserId) {
        return res.status(403).json({ message: 'Forbidden: Cannot access collections of other students' });
      }
    } else if (userRole === 'ACCOUNTANT') {
      if (req.user?.branchId && collection.branchId && collection.branchId !== req.user.branchId) {
        return res.status(403).json({ message: 'Forbidden: Branch accountants can only access collections of their assigned branch' });
      }
    }

    // Check for existing pending or approved reversals on this collection to prevent duplicate requests
    const existingReversals = await db.financialAdjustment.findMany({
      where: {
        institutionId: institutionId as string,
        status: { in: ['PENDING_APPROVAL', 'APPROVED'] },
        reason: { contains: collection.id }
      }
    });

    const alreadyReversedOrPending = existingReversals.reduce((sum, r) => sum + Number(r.amount), 0);
    const refundAmount = amount ? Number(amount) : Number(collection.amountCollected);

    if (alreadyReversedOrPending + refundAmount > Number(collection.amountCollected)) {
      return res.status(400).json({
        message: `Requested reversal (${refundAmount} EGP) exceeds remaining eligible amount (${Number(collection.amountCollected) - alreadyReversedOrPending} EGP)`
      });
    }

    // Ensure financial account exists
    let account = await db.studentFinancialAccount.findFirst({
      where: { institutionId: institutionId as string, studentId: collection.studentId }
    });
    if (!account) {
      account = await db.studentFinancialAccount.create({
        data: {
          institutionId: institutionId as string,
          studentId: collection.studentId,
          accountNumber: `AR-${collection.studentId.slice(0, 8).toUpperCase()}`,
          currency: 'EGP',
          status: 'ACTIVE'
        }
      });
    }

    const adjustmentNumber = `ADJ-REF-${Date.now().toString().slice(-6)}`;
    const taggedReason = `[REVERSAL:COLLECTION:${collection.id}:${collection.receiptNumber}] ${reason.trim()}`;

    const adjustment = await db.financialAdjustment.create({
      data: {
        institutionId: institutionId as string,
        branchId: collection.branchId,
        accountId: account.id,
        studentId: collection.studentId,
        adjustmentNumber,
        type: 'REFUND_REQUEST',
        amount: refundAmount,
        reason: taggedReason,
        status: 'PENDING_APPROVAL',
        preparedById: requesterId
      }
    });

    // Dispatch Reversal Requested notification to Primary Managers
    await NotificationEventService.onReversalRequested({
      institutionId: institutionId as string,
      branchId: collection.branchId,
      adjustmentId: adjustment.id,
      collectionId: collection.id,
      receiptNumber: collection.receiptNumber,
      amount: refundAmount,
      currency: 'EGP',
      reason: reason.trim(),
      requestedById: requesterId,
      requestedByName: req.user?.email || 'Accountant'
    });

    return res.status(201).json({
      message: 'Reversal request submitted for manager approval',
      adjustment
    });
  } catch (error: any) {
    logger.error(`[Accounting] Error requesting reversal: ${error.message}`);
    return res.status(500).json({ message: 'Error submitting reversal request', error: error.message });
  }
};

/**
 * POST /api/accounting/reversals/:adjustmentId/review
 * Primary Manager review of reversal request (APPROVE or REJECT)
 */
export const reviewReversal = async (req: AuthRequest, res: Response) => {
  try {
    const institutionId = req.user?.institutionId || req.tenantContext?.institutionId;
    const reviewerId = req.user?.userId;
    const reviewerRole = (req.user?.role || '').toUpperCase();
    const { adjustmentId } = req.params;
    const { decision, notes } = req.body;

    if (!institutionId || !reviewerId) {
      return res.status(401).json({ message: 'Unauthorized: Missing tenant or user identity' });
    }

    if (!isAuthorizedPrimaryManager(req.user)) {
      return res.status(403).json({ message: 'Forbidden: Only Primary Managers can review reversals' });
    }

    if (!['APPROVE', 'REJECT'].includes(decision)) {
      return res.status(400).json({ message: 'Decision must be either APPROVE or REJECT' });
    }

    const adjustment = await db.financialAdjustment.findFirst({
      where: { id: adjustmentId, institutionId: institutionId as string, status: 'PENDING_APPROVAL' },
      include: { student: true, preparedBy: true }
    });

    if (!adjustment) {
      return res.status(404).json({ message: 'Pending adjustment not found' });
    }

    // MANDATORY AUDIT RULE: Enforce anti-self-approval
    if (adjustment.preparedById === reviewerId) {
      return res.status(403).json({
        message: 'Forbidden: Self-approval of financial reversals is strictly prohibited by internal controls.'
      });
    }

    if (decision === 'REJECT') {
      const updated = await db.financialAdjustment.update({
        where: { id: adjustment.id },
        data: {
          status: 'REJECTED',
          approvedById: reviewerId,
          approvedAt: new Date()
        }
      });

      await NotificationEventService.onReversalDecision({
        institutionId: institutionId as string,
        adjustmentId: adjustment.id,
        collectionId: '',
        receiptNumber: adjustment.adjustmentNumber,
        amount: Number(adjustment.amount),
        currency: 'EGP',
        status: 'REJECTED',
        reviewedById: reviewerId,
        reviewedByName: req.user?.email || 'Primary Manager',
        studentId: adjustment.studentId,
        requesterId: adjustment.preparedById
      });

      return res.json({ message: 'Reversal request rejected', adjustment: updated });
    }

    // Execute atomic approval & compensation
    const result: any = await db.$transaction(async (tx) => {
      // 1. Extract collection ID from adjustment reason if tagged, or find latest confirmed collection for student
      let targetCollectionId: string | null = null;
      const match = adjustment.reason.match(/\[REVERSAL:COLLECTION:([a-f0-9\-]+):/i);
      if (match && match[1]) {
        targetCollectionId = match[1];
      }

      const collection: any = await tx.collection.findFirst({
        where: {
          institutionId: institutionId as string,
          ...(targetCollectionId ? { id: targetCollectionId } : { studentId: adjustment.studentId }),
          status: 'COLLECTED'
        },
        orderBy: { collectedAt: 'desc' },
        include: { tenders: true, allocations: true }
      });

      if (!collection) {
        throw new Error('Associated confirmed collection not found for reversal compensation');
      }

      // Check remaining eligible reversal amount
      const priorApproved = await tx.financialAdjustment.findMany({
        where: {
          institutionId: institutionId as string,
          status: 'APPROVED',
          reason: { contains: collection.id },
          id: { not: adjustment.id }
        }
      });
      const sumPrior = priorApproved.reduce((sum, r) => sum + Number(r.amount), 0);
      const refundAmount = Number(adjustment.amount);

      if (sumPrior + refundAmount > Number(collection.amountCollected)) {
        throw new Error(`Reversal amount exceeds remaining eligible collection balance`);
      }

      // 2. Mark adjustment approved (Separate compensating record)
      const updatedAdj = await tx.financialAdjustment.update({
        where: { id: adjustment.id },
        data: {
          status: 'APPROVED',
          approvedById: reviewerId,
          approvedAt: new Date()
        }
      });

      // 3. Log Financial Audit Event (Immutability audit trail)
      await tx.financialAuditEvent.create({
        data: {
          institutionId: institutionId as string,
          branchId: collection.branchId,
          eventType: 'COLLECTION_REVERSED',
          actorUserId: reviewerId,
          actorRole: (reviewerRole as any) || 'PRIMARY_MANAGER',
          targetEntity: 'Collection',
          targetEntityId: collection.id,
          oldState: {
            collectionId: collection.id,
            receiptNumber: collection.receiptNumber,
            amountCollected: Number(collection.amountCollected),
            status: collection.status
          },
          newState: {
            adjustmentId: adjustment.id,
            adjustmentNumber: adjustment.adjustmentNumber,
            reversalAmount: refundAmount,
            status: 'APPROVED'
          },
          metadata: {
            reason: adjustment.reason,
            reviewerId,
            approvedAt: new Date().toISOString()
          }
        }
      });

      // 4. Mark collection status as REVERSED when fully reversed while preserving original amounts and allocations for audit history
      if (sumPrior + refundAmount >= Number(collection.amountCollected) - 0.01) {
        await tx.collection.update({
          where: { id: collection.id },
          data: { status: 'REVERSED' }
        });
      }

      // 5. Compensating entry: Restore unpaid balance on student obligations
      const refundRatio = Math.min(1, refundAmount / Number(collection.amountCollected));
      for (const alloc of (collection.allocations || [])) {
        const allocReversalPortion = Math.round(Number(alloc.amount) * refundRatio * 100) / 100;
        if (allocReversalPortion > 0) {
          const ob = await tx.studentObligation.findUnique({ where: { id: alloc.obligationId } });
          if (ob) {
            const newCollected = Math.max(0, Number(ob.amountCollected) - allocReversalPortion);
            const newStatus = newCollected <= 0 ? 'PENDING' : 'PARTIALLY_PAID';
            await tx.studentObligation.update({
              where: { id: alloc.obligationId },
              data: {
                amountCollected: newCollected,
                status: newStatus
              }
            });
          }
        }
      }

      // 6. Deduct from cashbox via compensatory transaction if CASH was used
      const cashTenders = (collection.tenders || []).filter((t: any) => t.tenderType === 'CASH');
      const totalCashInCollection = cashTenders.reduce((sum: number, t: any) => sum + Number(t.amount), 0);
      const cashToDeduct = Math.round(totalCashInCollection * refundRatio * 100) / 100;

      if (cashToDeduct > 0 && collection.cashboxId) {
        const updatedCashbox = await tx.cashbox.update({
          where: { id: collection.cashboxId },
          data: { currentBalance: { decrement: cashToDeduct } }
        });

        await tx.cashboxTransaction.create({
          data: {
            institutionId: institutionId as string,
            branchId: collection.branchId,
            cashboxId: collection.cashboxId,
            type: 'COLLECTION_REVERSED',
            amount: cashToDeduct,
            balanceAfter: updatedCashbox.currentBalance,
            businessDate: new Date().toISOString().slice(0, 10),
            actorUserId: reviewerId,
            actorRole: (reviewerRole as any) || 'PRIMARY_MANAGER',
            referenceType: 'REVERSAL',
            referenceId: adjustment.id,
            notes: `Compensatory reversal entry for receipt #${collection.receiptNumber} via adjustment #${adjustment.adjustmentNumber}`,
            status: 'POSTED'
          }
        });
      }

      return { updatedAdj, collection };
    });

    await NotificationEventService.onReversalDecision({
      institutionId: institutionId as string,
      adjustmentId: adjustment.id,
      collectionId: result.collection?.id || '',
      receiptNumber: result.collection?.receiptNumber || adjustment.adjustmentNumber,
      amount: Number(adjustment.amount),
      currency: 'EGP',
      status: 'APPROVED',
      reviewedById: reviewerId,
      reviewedByName: req.user?.email || 'Primary Manager',
      studentId: adjustment.studentId,
      requesterId: adjustment.preparedById
    });

    // Re-evaluate student's financial access status (Reversal may restore overdue monthly balance)
    try {
      await MonthlyFeeAccessControlService.evaluateStudentFinancialAccess(
        adjustment.studentId,
        new Date(),
        'REVERSAL_REEVALUATION'
      );
    } catch (evalErr: any) {
      logger.error(`[Accounting] Error evaluating student financial access after reversal: ${evalErr.message}`);
    }

    return res.json({
      message: 'Reversal approved and compensatory financial entries posted',
      adjustment: result.updatedAdj
    });
  } catch (error: any) {
    logger.error(`[Accounting] Error reviewing reversal: ${error.message}`);
    return res.status(500).json({ message: 'Error reviewing reversal', error: error.message });
  }
};
