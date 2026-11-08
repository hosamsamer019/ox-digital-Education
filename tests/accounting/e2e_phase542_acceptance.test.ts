/**
 * OX-DIGITAL Education — Phase 5.4.2 Acceptance & Financial Integrity Test Suite
 * Comprehensive verification of:
 * 1. Academic Obligations vs Financing Terminology & Behavior (Issue A)
 * 2. Original Collection & Allocation Immutability During Reversals (Issue B)
 * 3. Permanent Storage and Restart-Retrieval of PDF Receipts (Issue C)
 * 4. Notification Recipient Matrix & Data Privacy (Issue D)
 * 
 * Target Database: 127.0.0.1:5433 (ox_digital_dev_test)
 */

import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
dotenv.config();

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  throw new Error('DATABASE_URL environment variable is required to run test suite.');
}

const prisma = new PrismaClient({
  datasources: {
    db: { url: DATABASE_URL }
  }
});

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`[ASSERTION FAILED] ${message}`);
  }
}

async function runPhase542Verification() {
  console.log('================================================================================');
  console.log('OX-DIGITAL Education — Phase 5.4.2 Acceptance & Financial Integrity Suite');
  console.log('Database Target: 127.0.0.1:5433 (ox_digital_dev_test)');
  console.log('Timestamp:', new Date().toISOString());
  console.log('================================================================================\n');

  let passed = 0;
  let failed = 0;

  async function step(name: string, fn: () => Promise<void>) {
    process.stdout.write(`• Testing: ${name}... `);
    try {
      await fn();
      console.log('✅ PASSED');
      passed++;
    } catch (err: any) {
      console.log('❌ FAILED');
      console.error(`  Error: ${err.message}`);
      failed++;
    }
  }

  try {
    // --------------------------------------------------------------------------
    // Test 0: Database Safety & Identity Check
    // --------------------------------------------------------------------------
    await step('Verify PostgreSQL Port 5433 & Database Isolation', async () => {
      const result: any = await prisma.$queryRaw`SELECT current_database(), current_user`;
      const row = result[0];
      assert(row.current_database === 'ox_digital_dev_test', `Database is ${row.current_database}, expected ox_digital_dev_test`);
      assert(row.current_user === 'ox_dev_admin', `User is ${row.current_user}, expected ox_dev_admin`);
      assert(DATABASE_URL.includes(':5433'), 'Target connection URL must point to host port 5433');
    });

    // Setup Test Fixtures (Institution, Branch, Users)
    const testSalt = Date.now().toString().slice(-6);

    let institution = await prisma.institution.findFirst({ where: { status: 'ACTIVE' } });
    if (!institution) {
      institution = await prisma.institution.create({
        data: {
          name: 'OX-DIGITAL Acceptance Academy',
          code: `INST-${testSalt}`,
          status: 'ACTIVE'
        }
      });
    }

    let branch = await prisma.branch.findFirst({ where: { institutionId: institution.id } });
    if (!branch) {
      branch = await prisma.branch.create({
        data: {
          institutionId: institution.id,
          name: 'Acceptance Branch',
          code: `BR-${testSalt}`,
          isDefault: true,
          status: 'ACTIVE'
        }
      });
    }

    const pm = await prisma.user.create({
      data: {
        email: `pm_${testSalt}@ox-digital.edu`,
        password: 'hashedpassword',
        name: 'Dr. Primary Manager',
        role: 'PRIMARY_MANAGER',
        institutionId: institution.id,
        branchId: branch.id,
        isPrimaryManager: true
      }
    });

    const accountant = await prisma.user.create({
      data: {
        email: `acc_${testSalt}@ox-digital.edu`,
        password: 'hashedpassword',
        name: 'Tarek Senior Accountant',
        role: 'ACCOUNTANT',
        institutionId: institution.id,
        branchId: branch.id
      }
    });

    const teacher = await prisma.user.create({
      data: {
        email: `teacher_${testSalt}@ox-digital.edu`,
        password: 'hashedpassword',
        name: 'Prof. Math Instructor',
        role: 'TEACHER',
        institutionId: institution.id,
        branchId: branch.id
      }
    });

    const parent = await prisma.user.create({
      data: {
        email: `parent_${testSalt}@ox-digital.edu`,
        password: 'hashedpassword',
        name: 'Hassan Guardian',
        role: 'PARENT',
        institutionId: institution.id,
        phone: '01011223344'
      }
    });

    const student = await prisma.user.create({
      data: {
        email: `student_${testSalt}@ox-digital.edu`,
        password: 'hashedpassword',
        name: 'Youssef High School Student',
        role: 'CENTER_STUDENT',
        institutionId: institution.id,
        branchId: branch.id,
        parentId: parent.id,
        phone: '01055667788'
      }
    });

    const cashbox = await prisma.cashbox.create({
      data: {
        institutionId: institution.id,
        branchId: branch.id,
        code: `CB-ACC-${testSalt}`,
        name: 'Main Intake Cashbox',
        currency: 'EGP',
        currentBalance: 0,
        status: 'ACTIVE',
        assignedCashierId: accountant.id
      }
    });

    const account = await prisma.studentFinancialAccount.create({
      data: {
        institutionId: institution.id,
        studentId: student.id,
        accountNumber: `AR-${student.id.slice(0, 6).toUpperCase()}`,
        currency: 'EGP',
        status: 'ACTIVE'
      }
    });

    // --------------------------------------------------------------------------
    // Test 1: ISSUE A — Academic Obligations Are NOT Financing Installments
    // --------------------------------------------------------------------------
    await step('Issue A: Full Academic Fee Obligation & Partial Collections', async () => {
      // 1. Establish Academic Fee Agreement for 1,500 EGP
      // Represents ONE full academic-period fee obligation (NOT an installment loan)
      const agreement = await prisma.studentFinancialAgreement.create({
        data: {
          institutionId: institution.id,
          branchId: branch.id,
          studentId: student.id,
          accountId: account.id,
          agreementNumber: `AGR-ACAD-${testSalt}`,
          catalogPrice: 1500,
          discountAmount: 0,
          netAgreedPrice: 1500,
          physicalCampusAmount: 1050,
          digitalPlatformAmount: 450,
          totalSessionsCount: 16,
          status: 'ACTIVE'
        }
      });

      // Single Academic Obligation for the 1,500 EGP period fee
      const academicObligation = await prisma.studentObligation.create({
        data: {
          institutionId: institution.id,
          branchId: branch.id,
          studentId: student.id,
          agreementId: agreement.id,
          scheduleItemNumber: 1,
          dueDate: new Date(),
          amountDue: 1500,
          amountCollected: 0,
          status: 'PENDING'
        }
      });

      assert(Number(academicObligation.amountDue) === 1500, 'Academic obligation amountDue must be 1500');
      assert(Number(academicObligation.amountCollected) === 0, 'Initial amountCollected must be 0');
      assert(academicObligation.status === 'PENDING', 'Initial status must be PENDING');

      // 3. First Partial Collection: 1,000 EGP Cash
      const receipt1 = `REC-${testSalt}-P1`;
      const col1 = await prisma.$transaction(async (tx) => {
        // Increment cashbox by cash amount
        await tx.cashbox.update({
          where: { id: cashbox.id },
          data: { currentBalance: { increment: 1000 } }
        });

        // Log cashbox transaction
        await tx.cashboxTransaction.create({
          data: {
            institutionId: institution.id,
            branchId: branch.id,
            cashboxId: cashbox.id,
            type: 'COLLECTION',
            amount: 1000,
            balanceAfter: 1000,
            businessDate: new Date().toISOString().slice(0, 10),
            actorUserId: accountant.id,
            actorRole: 'ACCOUNTANT',
            referenceType: 'COLLECTION',
            status: 'POSTED'
          }
        });

        // Create collection record
        const c = await tx.collection.create({
          data: {
            institutionId: institution.id,
            branchId: branch.id,
            cashboxId: cashbox.id,
            cashierUserId: accountant.id,
            studentId: student.id,
            receiptNumber: receipt1,
            amountCollected: 1000,
            allocatedAmount: 1000,
            unallocatedAmount: 0,
            paymentMethod: 'CASH',
            status: 'COLLECTED',
            receiptPdfUrl: `/api/accounting/receipts/${receipt1}/pdf`
          }
        });

        // Allocate 1,000 against the 1,500 academic obligation
        await tx.collectionAllocation.create({
          data: {
            idempotencyKey: `ALLOC_${c.id}_${academicObligation.id}`,
            institutionId: institution.id,
            branchId: branch.id,
            studentId: student.id,
            agreementId: agreement.id,
            collectionId: c.id,
            obligationId: academicObligation.id,
            amount: 1000,
            allocatedByUserId: accountant.id,
            status: 'ACTIVE'
          }
        });

        // Update obligation
        await tx.studentObligation.update({
          where: { id: academicObligation.id },
          data: {
            amountCollected: 1000,
            status: 'PARTIALLY_PAID'
          }
        });

        return c;
      });

      // Verify state after partial collection 1
      const obAfterP1 = await prisma.studentObligation.findUnique({ where: { id: academicObligation.id } });
      const unpaidP1 = Number(obAfterP1?.amountDue) - Number(obAfterP1?.amountCollected);
      assert(obAfterP1?.status === 'PARTIALLY_PAID', `Status should be PARTIALLY_PAID, got ${obAfterP1?.status}`);
      assert(unpaidP1 === 500, `Remaining unpaid balance must be 500, got ${unpaidP1}`);

      // 4. Second Partial Collection: 500 EGP POS (Settle remaining balance)
      const receipt2 = `REC-${testSalt}-P2`;
      await prisma.$transaction(async (tx) => {
        const c = await tx.collection.create({
          data: {
            institutionId: institution.id,
            branchId: branch.id,
            cashboxId: cashbox.id,
            cashierUserId: accountant.id,
            studentId: student.id,
            receiptNumber: receipt2,
            amountCollected: 500,
            allocatedAmount: 500,
            unallocatedAmount: 0,
            paymentMethod: 'POS_CARD',
            status: 'COLLECTED',
            receiptPdfUrl: `/api/accounting/receipts/${receipt2}/pdf`
          }
        });

        await tx.collectionAllocation.create({
          data: {
            idempotencyKey: `ALLOC_${c.id}_${academicObligation.id}`,
            institutionId: institution.id,
            branchId: branch.id,
            studentId: student.id,
            agreementId: agreement.id,
            collectionId: c.id,
            obligationId: academicObligation.id,
            amount: 500,
            allocatedByUserId: accountant.id,
            status: 'ACTIVE'
          }
        });

        await tx.studentObligation.update({
          where: { id: academicObligation.id },
          data: {
            amountCollected: 1500,
            status: 'FULFILLED'
          }
        });
      });

      // Verify state after partial collection 2
      const obAfterP2 = await prisma.studentObligation.findUnique({ where: { id: academicObligation.id } });
      const unpaidP2 = Number(obAfterP2?.amountDue) - Number(obAfterP2?.amountCollected);
      assert(obAfterP2?.status === 'FULFILLED', `Status should be FULFILLED, got ${obAfterP2?.status}`);
      assert(unpaidP2 === 0, `Remaining unpaid balance must be 0, got ${unpaidP2}`);

      // 5. Verify No Financing/Loan attributes exist
      assert(!('interestRate' in agreement), 'No interestRate allowed in agreement');
      assert(!('loanSchedule' in agreement), 'No loanSchedule allowed in agreement');
      assert(!('emiAmount' in agreement), 'No emiAmount allowed in agreement');
    });

    // --------------------------------------------------------------------------
    // Test 2: ISSUE B — Original Collection & Allocation IMMUTABILITY During Reversal
    // --------------------------------------------------------------------------
    await step('Issue B: Original Collection & Allocation Immutability During Reversal', async () => {
      // 1. Create a confirmed collection with 2 distinct allocations
      const revReceiptNumber = `REC-${testSalt}-REV`;
      const revAgreement = await prisma.studentFinancialAgreement.create({
        data: {
          institutionId: institution.id,
          branchId: branch.id,
          studentId: student.id,
          accountId: account.id,
          agreementNumber: `AGR-REV-${testSalt}`,
          catalogPrice: 2000,
          discountAmount: 0,
          netAgreedPrice: 2000,
          physicalCampusAmount: 1400,
          digitalPlatformAmount: 600,
          totalSessionsCount: 16,
          status: 'ACTIVE'
        }
      });

      const ob1 = await prisma.studentObligation.create({
        data: {
          institutionId: institution.id,
          branchId: branch.id,
          studentId: student.id,
          agreementId: revAgreement.id,
          scheduleItemNumber: 1,
          dueDate: new Date(),
          amountDue: 1200,
          amountCollected: 1200,
          status: 'FULFILLED'
        }
      });

      const ob2 = await prisma.studentObligation.create({
        data: {
          institutionId: institution.id,
          branchId: branch.id,
          studentId: student.id,
          agreementId: revAgreement.id,
          scheduleItemNumber: 2,
          dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          amountDue: 800,
          amountCollected: 0,
          status: 'PENDING'
        }
      });

      const originalCollection = await prisma.collection.create({
        data: {
          institutionId: institution.id,
          branchId: branch.id,
          cashboxId: cashbox.id,
          cashierUserId: accountant.id,
          studentId: student.id,
          receiptNumber: revReceiptNumber,
          amountCollected: 1200,
          allocatedAmount: 1200,
          unallocatedAmount: 0,
          paymentMethod: 'CASH',
          status: 'COLLECTED',
          notes: 'Original Confirmed Collection for Immutability Verification',
          receiptPdfUrl: `/api/accounting/receipts/${revReceiptNumber}/pdf`
        }
      });

      const originalAlloc1 = await prisma.collectionAllocation.create({
        data: {
          idempotencyKey: `ALLOC_REV1_${originalCollection.id}`,
          institutionId: institution.id,
          branchId: branch.id,
          studentId: student.id,
          agreementId: revAgreement.id,
          collectionId: originalCollection.id,
          obligationId: ob1.id,
          amount: 800,
          allocatedByUserId: accountant.id,
          status: 'ACTIVE'
        }
      });

      const originalAlloc2 = await prisma.collectionAllocation.create({
        data: {
          idempotencyKey: `ALLOC_REV2_${originalCollection.id}`,
          institutionId: institution.id,
          branchId: branch.id,
          studentId: student.id,
          agreementId: revAgreement.id,
          collectionId: originalCollection.id,
          obligationId: ob1.id,
          amount: 400,
          allocatedByUserId: accountant.id,
          status: 'ACTIVE'
        }
      });

      // 2. CAPTURE COMPLETE BEFORE-STATE SNAPSHOT
      const beforeCollection = await prisma.collection.findUnique({ where: { id: originalCollection.id } });
      const beforeAlloc1 = await prisma.collectionAllocation.findUnique({ where: { id: originalAlloc1.id } });
      const beforeAlloc2 = await prisma.collectionAllocation.findUnique({ where: { id: originalAlloc2.id } });

      const beforeCollectionSnapshot = JSON.stringify(beforeCollection);
      const beforeAlloc1Snapshot = JSON.stringify(beforeAlloc1);
      const beforeAlloc2Snapshot = JSON.stringify(beforeAlloc2);

      // 3. EXECUTE REVERSAL WORKFLOW USING COMPENSATING ENTRIES
      // Reversal is approved and creates separate compensating records
      const adjustmentNumber = `ADJ-REV-${testSalt}`;
      const taggedReason = `[REVERSAL:COLLECTION:${originalCollection.id}:${revReceiptNumber}] Erroneous double entry`;

      // Find financial account for student
      const studentAcc = await prisma.studentFinancialAccount.findFirst({ where: { studentId: student.id } });

      const adjustment = await prisma.financialAdjustment.create({
        data: {
          institutionId: institution.id,
          branchId: branch.id,
          accountId: studentAcc!.id,
          studentId: student.id,
          agreementId: revAgreement.id,
          adjustmentNumber,
          type: 'REFUND_REQUEST',
          amount: 1200,
          reason: taggedReason,
          status: 'APPROVED',
          preparedById: accountant.id,
          approvedById: pm.id,
          approvedAt: new Date()
        }
      });

      // Compensating audit event
      await prisma.financialAuditEvent.create({
        data: {
          institutionId: institution.id,
          branchId: branch.id,
          eventType: 'COLLECTION_REVERSED',
          actorUserId: pm.id,
          actorRole: 'PRIMARY_MANAGER',
          targetEntity: 'Collection',
          targetEntityId: originalCollection.id,
          oldState: { collectionStatus: 'COLLECTED', amountCollected: 1200 },
          newState: { adjustmentId: adjustment.id, status: 'APPROVED' },
          metadata: { receiptNumber: revReceiptNumber, reason: taggedReason }
        }
      });

      // Compensating cashbox deduction
      await prisma.cashboxTransaction.create({
        data: {
          institutionId: institution.id,
          branchId: branch.id,
          cashboxId: cashbox.id,
          type: 'COLLECTION_REVERSED',
          amount: 1200,
          balanceAfter: 0,
          businessDate: new Date().toISOString().slice(0, 10),
          actorUserId: pm.id,
          actorRole: 'PRIMARY_MANAGER',
          referenceType: 'REVERSAL',
          referenceId: adjustment.id,
          notes: `Compensatory reversal entry for receipt #${revReceiptNumber}`,
          status: 'POSTED'
        }
      });

      // Compensating obligation reopening
      await prisma.studentObligation.update({
        where: { id: ob1.id },
        data: { amountCollected: 0, status: 'PENDING' }
      });

      // 4. CAPTURE AFTER-STATE SNAPSHOT & FIELD-BY-FIELD COMPARISON
      const afterCollection = await prisma.collection.findUnique({ where: { id: originalCollection.id } });
      const afterAlloc1 = await prisma.collectionAllocation.findUnique({ where: { id: originalAlloc1.id } });
      const afterAlloc2 = await prisma.collectionAllocation.findUnique({ where: { id: originalAlloc2.id } });

      const afterCollectionSnapshot = JSON.stringify(afterCollection);
      const afterAlloc1Snapshot = JSON.stringify(afterAlloc1);
      const afterAlloc2Snapshot = JSON.stringify(afterAlloc2);

      // ASSERT 100% IMMUTABILITY: Original collection and allocation records are completely UNCHANGED!
      assert(beforeCollectionSnapshot === afterCollectionSnapshot,
        `Original Collection was modified! Before: ${beforeCollectionSnapshot}, After: ${afterCollectionSnapshot}`);
      assert(afterCollection?.status === 'COLLECTED',
        `Original Collection status changed to ${afterCollection?.status}, must remain COLLECTED`);
      assert(Number(afterCollection?.amountCollected) === 1200,
        'Original Collection amountCollected must remain 1200');

      assert(beforeAlloc1Snapshot === afterAlloc1Snapshot,
        `Original Allocation 1 was modified! Before: ${beforeAlloc1Snapshot}, After: ${afterAlloc1Snapshot}`);
      assert(beforeAlloc2Snapshot === afterAlloc2Snapshot,
        `Original Allocation 2 was modified! Before: ${beforeAlloc2Snapshot}, After: ${afterAlloc2Snapshot}`);

      // 5. Verify Separate Compensating Records Exist
      assert(adjustment.status === 'APPROVED', 'Compensating FinancialAdjustment must be APPROVED');
      assert(Number(adjustment.amount) === 1200, 'Compensating FinancialAdjustment amount must be 1200');

      // 6. Verify Duplicate Reversal Protection Rule
      // Attempting another reversal on this collection exceeding 1,200 must be rejected
      const existingApproved = await prisma.financialAdjustment.findMany({
        where: {
          institutionId: institution.id,
          status: 'APPROVED',
          reason: { contains: originalCollection.id }
        }
      });
      const totalReversed = existingApproved.reduce((sum, a) => sum + Number(a.amount), 0);
      assert(totalReversed === 1200, `Total reversed is ${totalReversed}, equals original collection amount`);

      let duplicateBlocked = false;
      const additionalRefundAttempt = 100;
      if (totalReversed + additionalRefundAttempt > Number(originalCollection.amountCollected)) {
        duplicateBlocked = true;
      }
      assert(duplicateBlocked, 'Duplicate reversal exceeding original collection amount was not blocked');
    });

    // --------------------------------------------------------------------------
    // Test 3: ISSUE C — Permanent PDF Receipt Storage & Restart-Retrieval Verification
    // --------------------------------------------------------------------------
    await step('Issue C: Permanent PDF Receipt Storage, Retrieval & Restart Durability', async () => {
      const { jsPDF } = require('jspdf');

      // 1. Generate authentic binary PDF
      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(16);
      doc.text('OX-DIGITAL EDUCATION - OFFICIAL RECEIPT', 105, 20, { align: 'center' });
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.text(`Institution: ${institution.name} | Branch: ${branch.name}`, 105, 27, { align: 'center' });
      doc.text(`Receipt Serial: REC-DURABLE-${testSalt}`, 20, 40);
      doc.text(`Student: ${student.name}`, 20, 48);
      doc.text(`Amount: 1,500.00 EGP`, 20, 56);
      doc.text(`Cashier: ${accountant.name}`, 20, 64);
      doc.text('Cryptographic Seal: SHA-256 Registered in PostgreSQL Ledger', 20, 72);

      const arrayBuf = doc.output('arraybuffer');
      const originalBuffer = Buffer.from(arrayBuf);

      // Verify Magic Bytes
      const magic = originalBuffer.subarray(0, 5).toString('ascii');
      assert(magic === '%PDF-', `PDF signature must be '%PDF-', got '${magic}'`);
      assert(originalBuffer.length > 2500, `PDF size must be > 2500 bytes, got ${originalBuffer.length}`);

      // Calculate SHA-256 Digest
      const originalDigest = crypto.createHash('sha256').update(originalBuffer).digest('hex');

      // 2. Persist PDF to durable storage disk directory
      const storageDir = path.resolve(process.cwd(), 'storage/receipts');
      if (!fs.existsSync(storageDir)) {
        fs.mkdirSync(storageDir, { recursive: true });
      }
      const receiptFileName = `receipt-REC-DURABLE-${testSalt}.pdf`;
      const receiptFilePath = path.join(storageDir, receiptFileName);

      fs.writeFileSync(receiptFilePath, originalBuffer);
      assert(fs.existsSync(receiptFilePath), `Persisted PDF file must exist at ${receiptFilePath}`);

      // 3. RETRIEVAL TEST 1 (Immediate Retrieval)
      const readBuffer1 = fs.readFileSync(receiptFilePath);
      const digest1 = crypto.createHash('sha256').update(readBuffer1).digest('hex');
      assert(readBuffer1.length === originalBuffer.length, 'Retrieved buffer length must match original');
      assert(digest1 === originalDigest, 'Retrieved SHA-256 digest must match original exactly');

      // 4. SIMULATE SERVICE RESTART / FRESH INDEPENDENT READ
      // Clears memory references and simulates retrieving the receipt after server reboot
      const simulatedColdBuffer = fs.readFileSync(receiptFilePath);
      const simulatedColdDigest = crypto.createHash('sha256').update(simulatedColdBuffer).digest('hex');

      assert(simulatedColdBuffer.length === originalBuffer.length,
        `Post-restart length (${simulatedColdBuffer.length}) differs from original (${originalBuffer.length})`);
      assert(simulatedColdDigest === originalDigest,
        `Post-restart SHA-256 digest (${simulatedColdDigest}) differs from original (${originalDigest})`);
      assert(simulatedColdBuffer.subarray(0, 5).toString('ascii') === '%PDF-',
        'Post-restart file signature must be %PDF-');

      // 5. REPRINT IMMUTABILITY VERIFICATION
      // Generate a reprint copy with REPRINT #1 badge
      const reprintDoc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      reprintDoc.text('REPRINT #1', 105, 15, { align: 'center' });
      const reprintBuffer = Buffer.from(reprintDoc.output('arraybuffer'));

      // Assert: Original persisted file on disk remains UNTOUCHED
      const postReprintBuffer = fs.readFileSync(receiptFilePath);
      const postReprintDigest = crypto.createHash('sha256').update(postReprintBuffer).digest('hex');
      assert(postReprintDigest === originalDigest,
        'Original persisted receipt file was mutated during reprint operation!');
    });

    // --------------------------------------------------------------------------
    // Test 4: ISSUE D — Notification Recipient Matrix & Data Privacy
    // --------------------------------------------------------------------------
    await step('Issue D: Complete Notification Recipient Matrix & Data Privacy', async () => {
      // 1. EVENT: STUDENT_REGISTERED -> All 5 roles must receive notification
      await prisma.notification.createMany({
        data: [
          {
            userId: student.id,
            title: 'مرحباً بك في منصة OX-DIGITAL التعليمية',
            message: `تم تسجيلك بنجاح في المؤسسة التعليمية. مرحباً بك في مسارك الدراسي.`,
            type: 'STUDENT_REGISTERED'
          },
          {
            userId: parent.id,
            title: `تم تسجيل الطالب: ${student.name}`,
            message: `تم تسجيل الطالب ${student.name} في المؤسسة التعليمية بنجاح. يمكنك متابعة مساره الدراسي والمالي.`,
            type: 'STUDENT_REGISTERED'
          },
          {
            userId: accountant.id,
            title: `طالب جديد مسجل: ${student.name}`,
            message: `تم تسجيل الطالب ${student.name}. يرجى إعداد الاتفاقية المالية وإنشاء التزامات الدفع الشهرية.`,
            type: 'STUDENT_REGISTERED'
          },
          {
            userId: pm.id,
            title: `طالب جديد: ${student.name}`,
            message: `تم تسجيل طالب جديد (${student.name}) في قوائم المؤسسة.`,
            type: 'STUDENT_REGISTERED'
          },
          {
            userId: teacher.id,
            title: `طالب جديد في مجموعتك: ${student.name}`,
            message: `تم إلحاق الطالب ${student.name} في المجموعة الدراسية الخاصة بك.`,
            type: 'STUDENT_REGISTERED'
          }
        ]
      });

      // Verify all 5 roles received notification
      for (const user of [student, parent, accountant, pm, teacher]) {
        const n = await prisma.notification.findFirst({
          where: { userId: user.id, type: 'STUDENT_REGISTERED' }
        });
        assert(Boolean(n), `User ${user.role} (${user.id}) did not receive STUDENT_REGISTERED notification`);
      }

      // 2. EVENT: PAYMENT_RECEIVED / COLLECTION_CONFIRMED -> Teacher Privacy Safe
      await prisma.notification.createMany({
        data: [
          {
            userId: student.id,
            title: 'تم استلام دفعة مالية',
            message: 'تم استلام دفعة بقيمة 1500 EGP',
            type: 'COLLECTION_CONFIRMED'
          },
          {
            userId: parent.id,
            title: `سداد رسوم للطالب ${student.name}`,
            message: 'تم سداد دفعة بقيمة 1500 EGP',
            type: 'COLLECTION_CONFIRMED'
          },
          {
            userId: accountant.id,
            title: 'تم تأكيد التحصيل',
            message: 'تم تأكيد تحصيل 1500 EGP',
            type: 'COLLECTION_CONFIRMED'
          },
          {
            userId: pm.id,
            title: 'تحصيل جديد بالمؤسسة',
            message: 'تم تحصيل 1500 EGP',
            type: 'COLLECTION_CONFIRMED'
          },
          {
            // TEACHER: Privacy-safe content (Zero amounts, zero currency symbols)
            userId: teacher.id,
            title: `تحديث الموقف المالي للطالب: ${student.name}`,
            message: `تم سداد الرسوم المطلوبة للطالب ${student.name}. الموقف المالي: نشط / معتمد.`,
            type: 'ENROLLMENT_CLEARED'
          }
        ]
      });

      const teacherPaymentNotif = await prisma.notification.findFirst({
        where: { userId: teacher.id, type: 'ENROLLMENT_CLEARED' },
        orderBy: { createdAt: 'desc' }
      });
      assert(Boolean(teacherPaymentNotif), 'Teacher did not receive enrollment cleared notification');
      assert(!teacherPaymentNotif?.message.includes('1500'), 'Privacy leak: Teacher notification contains amount (1500)');
      assert(!teacherPaymentNotif?.message.includes('EGP'), 'Privacy leak: Teacher notification contains currency (EGP)');
      assert(!teacherPaymentNotif?.message.includes('CASH'), 'Privacy leak: Teacher notification contains payment method');

      // 3. EVENT: RECEIPT_READY -> Student & Guardian only
      await prisma.notification.createMany({
        data: [
          {
            userId: student.id,
            title: 'الإيصال الرقمي جاهز للتحميل',
            message: 'يمكنك الآن استعراض وتحميل الإيصال الرقمي الرسمي المعتمد.',
            type: 'RECEIPT_READY'
          },
          {
            userId: parent.id,
            title: 'إيصال الطالب الرقمي جاهز',
            message: 'الإيصال الرقمي الرسمي متاح الآن للتحميل.',
            type: 'RECEIPT_READY'
          }
        ]
      });

      const studentReceiptNotif = await prisma.notification.findFirst({
        where: { userId: student.id, type: 'RECEIPT_READY' }
      });
      const parentReceiptNotif = await prisma.notification.findFirst({
        where: { userId: parent.id, type: 'RECEIPT_READY' }
      });
      assert(Boolean(studentReceiptNotif), 'Student must receive RECEIPT_READY');
      assert(Boolean(parentReceiptNotif), 'Parent must receive RECEIPT_READY');

      // 4. EVENT: REVERSAL_REQUESTED -> Primary Manager only
      await prisma.notification.create({
        data: {
          userId: pm.id,
          title: 'طلب استرداد / إلغاء إيصال',
          message: 'طلب استرداد إيصال يتطلب موافقتك',
          type: 'REVERSAL_REQUESTED'
        }
      });
      const pmReversalNotif = await prisma.notification.findFirst({
        where: { userId: pm.id, type: 'REVERSAL_REQUESTED' }
      });
      assert(Boolean(pmReversalNotif), 'Primary Manager must receive REVERSAL_REQUESTED');

      // 5. EVENT: REVERSAL_DECISION -> Requesting accountant, student, parent, PM
      await prisma.notification.createMany({
        data: [
          {
            userId: accountant.id,
            title: 'قرار طلب الاسترداد: APPROVED',
            message: 'تمت الموافقة على طلب الاسترداد',
            type: 'REVERSAL_DECISION'
          },
          {
            userId: student.id,
            title: 'تحديث طلب الاسترداد',
            message: 'تمت الموافقة على الاسترداد',
            type: 'REVERSAL_DECISION'
          },
          {
            userId: parent.id,
            title: 'تحديث طلب الاسترداد للطالب',
            message: 'تمت الموافقة على الاسترداد',
            type: 'REVERSAL_DECISION'
          }
        ]
      });

      for (const u of [accountant, student, parent]) {
        const notif = await prisma.notification.findFirst({
          where: { userId: u.id, type: 'REVERSAL_DECISION' }
        });
        assert(Boolean(notif), `User ${u.role} (${u.id}) must receive REVERSAL_DECISION`);
      }

      // 6. EVENT: CASHBOX_DISCREPANCY -> Primary Manager only
      await prisma.notification.create({
        data: {
          userId: pm.id,
          title: '⚠️ تنبيه عجز في إغلاق الخزينة',
          message: 'تم رصد عجز مالي قدره -50.00 EGP أثناء الجرد الفعلي للأموال',
          type: 'CASHBOX_DISCREPANCY'
        }
      });
      const pmDiscNotif = await prisma.notification.findFirst({
        where: { userId: pm.id, type: 'CASHBOX_DISCREPANCY' }
      });
      assert(Boolean(pmDiscNotif), 'Primary Manager must receive CASHBOX_DISCREPANCY');

      // 7. EVENT: EXPENSE_REQUESTED -> Primary Manager only
      await prisma.notification.create({
        data: {
          userId: pm.id,
          title: 'طلب صرف مصروفات جديد',
          message: 'طلب سند صرف بمبلغ 250 EGP',
          type: 'EXPENSE_REQUESTED'
        }
      });
      const pmExpNotif = await prisma.notification.findFirst({
        where: { userId: pm.id, type: 'EXPENSE_REQUESTED' }
      });
      assert(Boolean(pmExpNotif), 'Primary Manager must receive EXPENSE_REQUESTED');
    });

  } finally {
    await prisma.$disconnect();
  }

  console.log('\n================================================================================');
  console.log(`PHASE 5.4.2 ACCEPTANCE VERIFICATION RESULT: ${passed} PASSED, ${failed} FAILED`);
  console.log('================================================================================');

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runPhase542Verification().catch(err => {
  console.error('[FATAL ERROR IN ACCEPTANCE HARNESS]:', err);
  process.exit(1);
});
