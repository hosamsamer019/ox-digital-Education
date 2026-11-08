import { jsPDF } from 'jspdf';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { logger } from '@shared/utils';

export interface ReceiptData {
  id: string;
  receiptNumber: string;
  amountCollected: number | string;
  allocatedAmount?: number | string;
  unallocatedAmount?: number | string;
  collectedAt: Date | string;
  institutionId: string;
  status: string;
  notes?: string | null;
  institution?: { name?: string; code?: string };
  branch?: { name?: string; code?: string };
  student?: { id?: string; name?: string; phone?: string; academicLevel?: string };
  payer?: { name?: string; phone?: string };
  payerName?: string | null;
  payerPhone?: string | null;
  cashier?: { id?: string; name?: string; email?: string };
  cashbox?: { name?: string; code?: string };
  tenders?: Array<{
    tenderType: string;
    amount: number | string;
    cardLastFour?: string | null;
    posAuthCode?: string | null;
    bankReferenceNumber?: string | null;
  }>;
  allocations?: Array<{
    id?: string;
    amount: number | string;
    obligation?: {
      scheduleItemNumber?: number;
      dueDate?: Date | string;
      title?: string;
    };
  }>;
}

/**
 * Computes authoritative anti-tamper cryptographic digest for a receipt
 */
export function computeReceiptDigest(collection: {
  id: string;
  receiptNumber: string;
  amountCollected: any;
  collectedAt: Date | string;
  institutionId: string;
}): string {
  const dateStr = collection.collectedAt instanceof Date 
    ? collection.collectedAt.toISOString() 
    : new Date(collection.collectedAt).toISOString();
  const payload = `${collection.id}:${collection.receiptNumber}:${Number(collection.amountCollected).toFixed(2)}:${dateStr}:${collection.institutionId}`;
  return crypto.createHash('sha256').update(payload).digest('hex');
}

/**
 * Generates an official, immutable binary PDF receipt
 */
export function generateReceiptPdfBuffer(
  receipt: ReceiptData,
  options: {
    reprintCount?: number;
    reprintingUser?: string;
    reprintTimestamp?: Date;
  } = {}
): Buffer {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const digest = computeReceiptDigest(receipt);
  const collectedDateStr = new Date(receipt.collectedAt).toUTCString();
  const totalAmount = Number(receipt.amountCollected).toFixed(2);
  const allocatedAmount = Number(receipt.allocatedAmount || 0).toFixed(2);
  const unallocatedAmount = Number(receipt.unallocatedAmount || 0).toFixed(2);

  // Outer Security Border
  doc.setDrawColor(30, 41, 59);
  doc.setLineWidth(0.8);
  doc.rect(10, 10, 190, 277);
  doc.setLineWidth(0.3);
  doc.rect(12, 12, 186, 273);

  // Header
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(15, 23, 42);
  doc.text('OX-DIGITAL EDUCATION', 105, 22, { align: 'center' });

  doc.setFontSize(11);
  doc.setTextColor(71, 85, 105);
  const institutionName = receipt.institution?.name || 'Institutional Academic Management';
  const branchName = receipt.branch?.name || receipt.branch?.code || 'Main Campus';
  doc.text(`${institutionName} — ${branchName}`, 105, 28, { align: 'center' });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(2, 132, 199);
  doc.text('OFFICIAL FINANCIAL RECEIPT', 105, 36, { align: 'center' });

  // Reprint watermark / badge if applicable
  if (options.reprintCount && options.reprintCount > 0) {
    doc.setFillColor(254, 242, 242);
    doc.rect(130, 15, 62, 10, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(185, 28, 28);
    doc.text(`REPRINT #${options.reprintCount}`, 161, 21, { align: 'center' });
  }

  // Divider line
  doc.setDrawColor(203, 213, 225);
  doc.line(16, 40, 194, 40);

  // Meta Section Box
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(16, 43, 178, 26, 2, 2, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(51, 65, 85);

  doc.text('Receipt Serial:', 20, 49);
  doc.setFont('helvetica', 'normal');
  doc.text(receipt.receiptNumber, 50, 49);

  doc.setFont('helvetica', 'bold');
  doc.text('Date / Time:', 110, 49);
  doc.setFont('helvetica', 'normal');
  doc.text(collectedDateStr, 135, 49);

  doc.setFont('helvetica', 'bold');
  doc.text('Cashier:', 20, 56);
  doc.setFont('helvetica', 'normal');
  doc.text(receipt.cashier?.name || receipt.cashier?.email || 'System Cashier', 50, 56);

  doc.setFont('helvetica', 'bold');
  doc.text('Cashbox Code:', 110, 56);
  doc.setFont('helvetica', 'normal');
  doc.text(receipt.cashbox?.code || receipt.cashbox?.name || 'CENTRAL-01', 135, 56);

  doc.setFont('helvetica', 'bold');
  doc.text('Receipt Status:', 20, 63);
  doc.setFont('helvetica', 'normal');
  const isCollected = receipt.status === 'COLLECTED';
  doc.setTextColor(isCollected ? 22 : 185, isCollected ? 101 : 28, isCollected ? 52 : 28);
  doc.text(isCollected ? 'CONFIRMED / COLLECTED' : receipt.status, 50, 63);

  // Student & Payer Box
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(15, 23, 42);
  doc.text('1. Student & Payer Information', 16, 75);

  doc.setFillColor(248, 250, 252);
  doc.roundedRect(16, 78, 178, 24, 2, 2, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(51, 65, 85);
  doc.text('Student Name:', 20, 84);
  doc.setFont('helvetica', 'normal');
  doc.text(receipt.student?.name || 'N/A', 50, 84);

  doc.setFont('helvetica', 'bold');
  doc.text('Academic Level:', 110, 84);
  doc.setFont('helvetica', 'normal');
  doc.text(receipt.student?.academicLevel || 'General', 140, 84);

  doc.setFont('helvetica', 'bold');
  doc.text('Payer Name:', 20, 91);
  doc.setFont('helvetica', 'normal');
  const payerName = receipt.payerName || receipt.payer?.name || receipt.student?.name || 'Self';
  doc.text(payerName, 50, 91);

  doc.setFont('helvetica', 'bold');
  doc.text('Contact Phone:', 110, 91);
  doc.setFont('helvetica', 'normal');
  const payerPhone = receipt.payerPhone || receipt.payer?.phone || receipt.student?.phone || 'N/A';
  doc.text(payerPhone, 140, 91);

  doc.setFont('helvetica', 'bold');
  doc.text('Student ID:', 20, 98);
  doc.setFont('helvetica', 'normal');
  doc.text(receipt.student?.id || receipt.id, 50, 98);

  // Financial Breakdown Box
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(15, 23, 42);
  doc.text('2. Financial Collection & Tenders Breakdown', 16, 110);

  // Big Total Amount Banner
  doc.setFillColor(240, 249, 255);
  doc.setDrawColor(2, 132, 199);
  doc.roundedRect(16, 113, 178, 16, 2, 2, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(3, 105, 161);
  doc.text('TOTAL AMOUNT COLLECTED:', 22, 123);
  doc.setFontSize(14);
  doc.setTextColor(2, 132, 199);
  doc.text(`${totalAmount} EGP`, 186, 123, { align: 'right' });

  // Tenders Table
  let currentY = 135;
  doc.setFillColor(241, 245, 249);
  doc.rect(16, currentY, 178, 7, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(51, 65, 85);
  doc.text('Tender Type', 20, currentY + 5);
  doc.text('Amount (EGP)', 70, currentY + 5);
  doc.text('Payment Reference / Card Authorization', 115, currentY + 5);

  currentY += 7;
  const tenders = receipt.tenders && receipt.tenders.length > 0
    ? receipt.tenders
    : [{ tenderType: 'CASH', amount: receipt.amountCollected, cardLastFour: null, posAuthCode: null, bankReferenceNumber: null }];

  for (const t of tenders) {
    doc.line(16, currentY, 194, currentY);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(30, 41, 59);

    doc.text(t.tenderType, 20, currentY + 5);
    doc.text(`${Number(t.amount).toFixed(2)} EGP`, 70, currentY + 5);

    let details = 'Standard Settlement';
    if (t.cardLastFour) {
      details = `Card: ****${t.cardLastFour}${t.posAuthCode ? ` | Auth: ${t.posAuthCode}` : ''}`;
    } else if (t.bankReferenceNumber) {
      details = `Bank Ref: ${t.bankReferenceNumber}`;
    }
    doc.text(details, 115, currentY + 5);
    currentY += 7;
  }
  doc.line(16, currentY, 194, currentY);

  // Allocations Section
  currentY += 8;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(15, 23, 42);
  doc.text('3. Fee Schedule Allocation & Ledger Application', 16, currentY);

  currentY += 4;
  doc.setFillColor(241, 245, 249);
  doc.rect(16, currentY, 178, 7, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(51, 65, 85);
  doc.text('Schedule / Component', 20, currentY + 5);
  doc.text('Due Date', 85, currentY + 5);
  doc.text('Allocated Amount', 140, currentY + 5);

  currentY += 7;
  if (receipt.allocations && receipt.allocations.length > 0) {
    for (const a of receipt.allocations) {
      doc.line(16, currentY, 194, currentY);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor(30, 41, 59);

      const title = a.obligation?.title || `Obligation Schedule Item #${a.obligation?.scheduleItemNumber || '1'}`;
      doc.text(title, 20, currentY + 5);

      const dueDate = a.obligation?.dueDate ? new Date(a.obligation.dueDate).toISOString().slice(0, 10) : 'Current';
      doc.text(dueDate, 85, currentY + 5);

      doc.text(`${Number(a.amount).toFixed(2)} EGP`, 140, currentY + 5);
      currentY += 7;
    }
  } else {
    doc.line(16, currentY, 194, currentY);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.text('Direct Account Credit', 20, currentY + 5);
    doc.text('Immediate', 85, currentY + 5);
    doc.text(`${totalAmount} EGP`, 140, currentY + 5);
    currentY += 7;
  }
  doc.line(16, currentY, 194, currentY);

  // Balance Summary
  currentY += 4;
  doc.setFillColor(248, 250, 252);
  doc.rect(16, currentY, 178, 12, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(71, 85, 105);
  doc.text(`Applied to Obligations: ${allocatedAmount} EGP`, 20, currentY + 8);
  doc.text(`Unallocated (Advance Credit): ${unallocatedAmount} EGP`, 105, currentY + 8);

  // Security Seal & Digest
  currentY += 20;
  doc.setFillColor(254, 252, 232);
  doc.setDrawColor(234, 179, 8);
  doc.roundedRect(16, currentY, 178, 20, 2, 2, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(161, 98, 7);
  doc.text('CRYPTOGRAPHIC ANTI-TAMPER SECURITY SEAL', 20, currentY + 6);

  doc.setFont('courier', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(30, 41, 59);
  doc.text(`SHA-256 Digest: ${digest}`, 20, currentY + 12);
  doc.text('Verification: Canonical record registered in OX-DIGITAL PostgreSQL double-entry audit ledger', 20, currentY + 16);

  // Footer / Reprint Info
  const footerY = 270;
  doc.setDrawColor(203, 213, 225);
  doc.line(16, footerY, 194, footerY);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(148, 163, 184);
  const nowStr = new Date().toISOString();
  doc.text(`System ID: OX-DIGITAL-ACC-5.4.1 | Printed: ${nowStr}`, 16, footerY + 5);

  if (options.reprintCount && options.reprintCount > 0) {
    const userStr = options.reprintingUser ? ` by ${options.reprintingUser}` : '';
    doc.setTextColor(220, 38, 38);
    doc.text(`REPRINT #${options.reprintCount} generated${userStr}`, 130, footerY + 5);
  } else {
    doc.text('Official Copy — Original Issuance', 145, footerY + 5);
  }

  const arrayBuffer = doc.output('arraybuffer');
  return Buffer.from(arrayBuffer);
}

/**
 * Retrieves previously persisted binary PDF receipt from disk if available
 */
export function getPersistedReceiptPdf(
  receiptNumber: string,
  storageBaseDir?: string
): { buffer: Buffer; filePath: string; sha256Digest: string } | null {
  const baseDir = storageBaseDir || path.resolve(process.cwd(), 'storage/receipts');
  const fileName = `receipt-${receiptNumber}.pdf`;
  const filePath = path.join(baseDir, fileName);

  if (fs.existsSync(filePath)) {
    const buffer = fs.readFileSync(filePath);
    const sha256Digest = crypto.createHash('sha256').update(buffer).digest('hex');
    return { buffer, filePath, sha256Digest };
  }
  return null;
}

/**
 * Persists the binary PDF receipt to durable disk storage and returns path, buffer, and digest.
 * IMMUTABILITY GUARANTEE: If the file already exists, it is never overwritten.
 */
export async function persistReceiptPdf(
  receipt: ReceiptData,
  storageBaseDir?: string
): Promise<{ buffer: Buffer; filePath: string; sha256Digest: string }> {
  const baseDir = storageBaseDir || path.resolve(process.cwd(), 'storage/receipts');
  if (!fs.existsSync(baseDir)) {
    fs.mkdirSync(baseDir, { recursive: true });
  }

  const fileName = `receipt-${receipt.receiptNumber}.pdf`;
  const filePath = path.join(baseDir, fileName);

  // If already persisted, return existing immutable artifact
  if (fs.existsSync(filePath)) {
    const existingBuffer = fs.readFileSync(filePath);
    const sha256Digest = crypto.createHash('sha256').update(existingBuffer).digest('hex');
    return { buffer: existingBuffer, filePath, sha256Digest };
  }

  const buffer = generateReceiptPdfBuffer(receipt);
  const sha256Digest = crypto.createHash('sha256').update(buffer).digest('hex');

  fs.writeFileSync(filePath, buffer);
  logger.info(`[Accounting] Persisted binary PDF receipt at ${filePath} (${buffer.length} bytes, SHA-256: ${sha256Digest})`);

  return { buffer, filePath, sha256Digest };
}

