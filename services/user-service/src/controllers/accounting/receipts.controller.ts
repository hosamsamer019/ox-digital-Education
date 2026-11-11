import { Response } from 'express';
import { db } from '../../../../../packages/database/src/index.js';
import { AuthRequest } from '../../middlewares/auth.middleware.js';
import { logger } from '@shared/utils';
import {
  computeReceiptDigest,
  generateReceiptPdfBuffer,
  persistReceiptPdf,
  getPersistedReceiptPdf
} from '../../services/receiptPdf.service.js';

export { computeReceiptDigest };

/**
 * GET /api/accounting/receipts/:id
 * Retrieve verified receipt with cryptographic seal and audit details (JSON)
 */
export const getReceiptDetails = async (req: AuthRequest, res: Response) => {
  try {
    const institutionId = req.user?.institutionId || req.tenantContext?.institutionId;
    if (!institutionId) {
      return res.status(401).json({ message: 'Unauthorized: Missing tenant identity' });
    }

    const { id } = req.params;

    const collection: any = await db.collection.findFirst({
      where: {
        institutionId: institutionId as string,
        OR: [
          { id },
          { receiptNumber: id }
        ]
      },
      include: {
        institution: { select: { id: true, name: true, code: true } },
        branch: { select: { id: true, name: true, code: true } },
        student: { select: { id: true, name: true, phone: true, email: true, academicLevel: true, parentId: true } },
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
      return res.status(404).json({ message: 'Receipt not found' });
    }

    const userRole = (req.user?.role || '').toUpperCase();
    const currentUserId = req.user?.userId;

    if (userRole === 'PARENT') {
      if (collection.student?.parentId !== currentUserId) {
        return res.status(403).json({ message: 'Forbidden: Cannot access receipts of non-linked students' });
      }
    } else if (['STUDENT', 'ONLINE_STUDENT', 'CENTER_STUDENT'].includes(userRole)) {
      if (collection.student?.id !== currentUserId) {
        return res.status(403).json({ message: 'Forbidden: Cannot access receipts of other students' });
      }
    } else if (userRole === 'ACCOUNTANT') {
      const accountantBranchId = req.user?.branchId;
      if (!accountantBranchId) {
        return res.status(403).json({
          success: false,
          error: 'ACCOUNTANT_BRANCH_UNASSIGNED',
          message: 'Forbidden: Accountant is not assigned to any branch.'
        });
      }
      if (collection.branchId !== accountantBranchId) {
        return res.status(403).json({
          success: false,
          error: 'CROSS_BRANCH_ACCESS_DENIED',
          message: 'Forbidden: Branch accountants can only access receipts of their assigned branch.'
        });
      }
    }

    const digitalDigest = computeReceiptDigest(collection);

    return res.json({
      receiptNumber: collection.receiptNumber,
      collectionId: collection.id,
      institution: collection.institution,
      branch: collection.branch,
      student: collection.student,
      payer: {
        name: collection.payerName || collection.payer?.name || collection.student.name,
        phone: collection.payerPhone || collection.payer?.phone || collection.student.phone
      },
      cashier: collection.cashier,
      amountCollected: Number(collection.amountCollected),
      allocatedAmount: Number(collection.allocatedAmount),
      unallocatedAmount: Number(collection.unallocatedAmount),
      currency: 'EGP',
      paymentMethod: collection.paymentMethod,
      tenders: collection.tenders.map((t: any) => ({
        tenderType: t.tenderType,
        amount: Number(t.amount),
        cardLastFour: t.cardLastFour,
        posAuthCode: t.posAuthCode,
        bankReferenceNumber: t.bankReferenceNumber
      })),
      allocations: collection.allocations.map((a: any) => ({
        id: a.id,
        obligationScheduleNumber: a.obligation?.scheduleItemNumber,
        amountAllocated: Number(a.amount),
        dueDate: a.obligation?.dueDate
      })),
      collectedAt: collection.collectedAt,
      status: collection.status,
      digitalSignature: digitalDigest,
      notes: collection.notes
    });
  } catch (error: any) {
    logger.error(`[Accounting] Error fetching receipt details: ${error.message}`);
    return res.status(500).json({ message: 'Error fetching receipt details', error: error.message });
  }
};

/**
 * GET /api/accounting/receipts/:id/pdf
 * Returns an authentic, immutable binary PDF document (%PDF-) with SHA-256 seal
 */
export const getReceiptPdf = async (req: AuthRequest, res: Response) => {
  try {
    const institutionId = req.user?.institutionId || req.tenantContext?.institutionId;
    if (!institutionId) {
      return res.status(401).json({ message: 'Unauthorized: Missing tenant identity' });
    }

    const { id } = req.params;
    const isReprint = req.query.reprint === 'true' || Number(req.query.reprintCount) > 0;
    const reprintCount = req.query.reprintCount ? Number(req.query.reprintCount) : isReprint ? 1 : 0;
    const reprintingUser = req.user?.email || req.user?.userId || 'Authorized Staff';

    const collection: any = await db.collection.findFirst({
      where: {
        institutionId: institutionId as string,
        OR: [
          { id },
          { receiptNumber: id }
        ]
      },
      include: {
        institution: { select: { id: true, name: true, code: true } },
        branch: { select: { id: true, name: true, code: true } },
        student: { select: { id: true, name: true, phone: true, academicLevel: true, parentId: true } },
        cashier: { select: { id: true, name: true, email: true } },
        cashbox: { select: { id: true, name: true, code: true } },
        tenders: true,
        allocations: {
          include: { obligation: true }
        }
      }
    });

    if (!collection) {
      return res.status(404).json({ message: 'Receipt not found' });
    }

    const userRole = (req.user?.role || '').toUpperCase();
    const currentUserId = req.user?.userId;

    if (userRole === 'PARENT') {
      if (collection.student?.parentId !== currentUserId) {
        return res.status(403).json({ message: 'Forbidden: Cannot access receipts of non-linked students' });
      }
    } else if (['STUDENT', 'ONLINE_STUDENT', 'CENTER_STUDENT'].includes(userRole)) {
      if (collection.student?.id !== currentUserId) {
        return res.status(403).json({ message: 'Forbidden: Cannot access receipts of other students' });
      }
    } else if (userRole === 'ACCOUNTANT') {
      const accountantBranchId = req.user?.branchId;
      if (!accountantBranchId) {
        return res.status(403).json({
          success: false,
          error: 'ACCOUNTANT_BRANCH_UNASSIGNED',
          message: 'Forbidden: Accountant is not assigned to any branch.'
        });
      }
      if (collection.branchId !== accountantBranchId) {
        return res.status(403).json({
          success: false,
          error: 'CROSS_BRANCH_ACCESS_DENIED',
          message: 'Forbidden: Branch accountants can only access receipts of their assigned branch.'
        });
      }
    }

    const digest = computeReceiptDigest(collection);

    let pdfBuffer: Buffer;
    let servedDigest = digest;

    if (isReprint) {
      // Reprint: Generate distinct watermarked reprint copy without mutating original persisted artifact
      pdfBuffer = generateReceiptPdfBuffer(collection, {
        reprintCount,
        reprintingUser,
        reprintTimestamp: new Date()
      });
      res.setHeader('X-Receipt-Reprint', `REPRINT #${reprintCount}`);
    } else {
      // Original Receipt: Retrieve durable persisted artifact from storage
      const persisted = getPersistedReceiptPdf(collection.receiptNumber);
      if (persisted) {
        pdfBuffer = persisted.buffer;
        servedDigest = persisted.sha256Digest;
        res.setHeader('X-Receipt-Storage', 'PERSISTED_DURABLE_STORAGE');
      } else {
        // First retrieval or cache miss: persist synchronously
        const saved = await persistReceiptPdf(collection);
        pdfBuffer = saved.buffer;
        servedDigest = saved.sha256Digest;
        res.setHeader('X-Receipt-Storage', 'PERSISTED_NEW');
      }
    }

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="receipt-${collection.receiptNumber}.pdf"`);
    res.setHeader('Content-Length', pdfBuffer.length);
    res.setHeader('X-Receipt-Digest', servedDigest);
    res.setHeader('Cache-Control', 'private, max-age=3600');

    return res.end(pdfBuffer);
  } catch (error: any) {
    logger.error(`[Accounting] Error generating receipt binary PDF: ${error.message}`);
    return res.status(500).json({ message: 'Error generating receipt PDF', error: error.message });
  }
};

/**
 * GET /api/accounting/receipts/:id/preview
 * Returns clean, tamper-evident HTML receipt representation
 * IMPORTANT: Does NOT contain auto-print scripts (no window.print()).
 * User clicks print explicitly.
 */
export const getReceiptHtml = async (req: AuthRequest, res: Response) => {
  try {
    const institutionId = req.user?.institutionId || req.tenantContext?.institutionId;
    if (!institutionId) {
      return res.status(401).send('<h1>Unauthorized: Missing tenant identity</h1>');
    }

    const { id } = req.params;

    const collection: any = await db.collection.findFirst({
      where: {
        institutionId: institutionId as string,
        OR: [
          { id },
          { receiptNumber: id }
        ]
      },
      include: {
        institution: { select: { id: true, name: true, code: true } },
        branch: { select: { id: true, name: true, code: true } },
        student: { select: { id: true, name: true, phone: true, parentId: true } },
        cashier: { select: { id: true, name: true, email: true } },
        tenders: true,
        allocations: {
          include: { obligation: true }
        }
      }
    });

    if (!collection) {
      return res.status(404).send('<h1>Receipt Not Found</h1>');
    }

    const userRole = (req.user?.role || '').toUpperCase();
    const currentUserId = req.user?.userId;

    if (userRole === 'PARENT') {
      if (collection.student?.parentId !== currentUserId) {
        return res.status(403).send('<h1>Forbidden: Cannot access receipts of non-linked students</h1>');
      }
    } else if (['STUDENT', 'ONLINE_STUDENT', 'CENTER_STUDENT'].includes(userRole)) {
      if (collection.student?.id !== currentUserId) {
        return res.status(403).send('<h1>Forbidden: Cannot access receipts of other students</h1>');
      }
    } else if (userRole === 'ACCOUNTANT') {
      const accountantBranchId = req.user?.branchId;
      if (!accountantBranchId) {
        return res.status(403).send('<h1>Forbidden: Accountant is not assigned to any branch</h1>');
      }
      if (collection.branchId !== accountantBranchId) {
        return res.status(403).send('<h1>Forbidden: Branch accountants can only access receipts of their assigned branch</h1>');
      }
    }

    const digest = computeReceiptDigest(collection);
    const formattedDate = new Date(collection.collectedAt).toLocaleString('ar-EG', {
      dateStyle: 'medium',
      timeStyle: 'short'
    });

    const tendersList = (collection.tenders || [])
      .map((t: any) => `<li><strong>${t.tenderType}:</strong> ${Number(t.amount).toFixed(2)} EGP ${t.cardLastFour ? `(بطاقة تنتهي بـ ${t.cardLastFour})` : ''}</li>`)
      .join('');

    const allocationsList = (collection.allocations || [])
      .map((a: any) => `<tr><td>استحقاق أكاديمي #${a.obligation?.scheduleItemNumber || '-'}</td><td>${a.obligation?.dueDate ? new Date(a.obligation.dueDate).toISOString().slice(0, 10) : '-'}</td><td>${Number(a.amount).toFixed(2)} EGP</td></tr>`)
      .join('');

    const html = `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8">
  <title>إيصال سداد رقم ${collection.receiptNumber}</title>
  <style>
    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 0; padding: 24px; color: #1e293b; background: #fff; }
    .receipt-container { max-width: 650px; margin: 0 auto; border: 2px solid #0f172a; padding: 24px; border-radius: 8px; }
    .header { text-align: center; border-bottom: 2px dashed #94a3b8; padding-bottom: 16px; margin-bottom: 20px; }
    .header h1 { margin: 0 0 6px 0; color: #0f172a; font-size: 24px; }
    .header p { margin: 0; color: #64748b; font-size: 14px; }
    .meta-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 20px; font-size: 14px; }
    .meta-item strong { color: #334155; }
    .badge { display: inline-block; padding: 4px 10px; border-radius: 4px; font-weight: bold; font-size: 13px; }
    .badge-paid { background: #dcfce7; color: #166534; }
    .badge-reversed { background: #fee2e2; color: #991b1b; }
    table { width: 100%; border-collapse: collapse; margin-top: 14px; margin-bottom: 20px; font-size: 14px; }
    th, td { border: 1px solid #cbd5e1; padding: 8px 12px; text-align: right; }
    th { background: #f8fafc; color: #475569; }
    .amount-box { background: #f1f5f9; padding: 14px; border-radius: 6px; text-align: center; margin-bottom: 20px; }
    .amount-box .val { font-size: 26px; font-weight: bold; color: #0284c7; }
    .security-seal { border-top: 1px dashed #cbd5e1; padding-top: 14px; font-size: 11px; color: #64748b; word-break: break-all; }
    .print-btn { display: inline-block; margin: 16px 0; padding: 10px 20px; background: #0284c7; color: #fff; border: none; border-radius: 6px; cursor: pointer; font-size: 14px; font-weight: 600; text-decoration: none; }
    @media print {
      .no-print { display: none !important; }
      body { padding: 0; }
      .receipt-container { border: none; }
    }
  </style>
</head>
<body>
  <div class="no-print" style="text-align: center; margin-bottom: 16px;">
    <button class="print-btn" onclick="window.print()">طباعة الإيصال الرسمي</button>
  </div>
  <div class="receipt-container">
    <div class="header">
      <h1>${collection.institution?.name || 'OX-DIGITAL Education'}</h1>
      <p>فرع: ${collection.branch?.name || 'المركز الرئيسي'} | إيصال سداد رسوم دراسية</p>
    </div>

    <div class="meta-grid">
      <div class="meta-item"><strong>رقم الإيصال:</strong> ${collection.receiptNumber}</div>
      <div class="meta-item"><strong>التاريخ والوقت:</strong> ${formattedDate}</div>
      <div class="meta-item"><strong>اسم الطالب:</strong> ${collection.student?.name || '-'}</div>
      <div class="meta-item"><strong>اسم القائم بالسداد:</strong> ${collection.payerName || collection.student?.name || '-'}</div>
      <div class="meta-item"><strong>المحصل المسؤول:</strong> ${collection.cashier?.name || collection.cashier?.email || '-'}</div>
      <div class="meta-item">
        <strong>حالة الإيصال:</strong> 
        <span class="badge ${collection.status === 'COLLECTED' ? 'badge-paid' : 'badge-reversed'}">
          ${collection.status === 'COLLECTED' ? 'معتمد ومحصل' : 'ملغي / مسترد'}
        </span>
      </div>
    </div>

    <div class="amount-box">
      <div>المبلغ المحصل الإجمالي</div>
      <div class="val">${Number(collection.amountCollected).toFixed(2)} جنيه مصري</div>
    </div>

    <div>
      <h3 style="margin: 0 0 6px 0; font-size: 15px;">وسائل الدفع:</h3>
      <ul style="margin: 0 0 16px 0; padding-right: 20px; font-size: 14px;">
        ${tendersList}
      </ul>
    </div>

    ${collection.allocations && collection.allocations.length > 0 ? `
    <h3 style="margin: 0 0 6px 0; font-size: 15px;">توزيع السداد على الالتزامات الأكاديمية:</h3>
    <table>
      <thead>
        <tr>
          <th>الالتزام الأكاديمي</th>
          <th>تاريخ الاستحقاق</th>
          <th>المبلغ المسدد</th>
        </tr>
      </thead>
      <tbody>
        ${allocationsList}
      </tbody>
    </table>
    ` : ''}

    <div class="security-seal">
      <strong>الختم الرقمي لمكافحة التلاعب (SHA-256 Digest):</strong><br>
      <code>${digest}</code>
    </div>
  </div>
</body>
</html>`;

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.send(html);
  } catch (error: any) {
    logger.error(`[Accounting] Error rendering receipt HTML: ${error.message}`);
    return res.status(500).send('<h1>Error generating receipt</h1>');
  }
};
