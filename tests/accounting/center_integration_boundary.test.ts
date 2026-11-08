/**
 * OX-DIGITAL Education — Financial Core Engine
 * Phase 2.0B — Physical Education Center Accounting Integration
 * Increment 1: Integration Boundary & Evidence Flow Invariant Tests
 */

import {
  Money,
  LessonDeliveryEvidence,
  AgreementPriceSnapshot,
  PaymentArrangementScheduleItem,
  StudentFinancialAgreement,
  StudentObligation,
  CollectionReceiptEvidence,
  CenterEvidenceBoundaryService,
  assertApprovedRole,
  assertNotSaaSSuperAdmin,
  ForbiddenTerminologyError,
  MultiCurrencyDisabledError,
  PrematurePostingError,
  InvalidRoleAssignmentError,
  InvalidEvidenceError,
  UnresolvedPolicyBlockedError,
  CrossInstitutionError
} from '../../packages/shared/src/accounting/index.js';

let passed = 0;
let failed = 0;

function assert(condition: boolean, testName: string, errorDetail?: string) {
  if (condition) {
    console.log(`  [PASS] ${testName}`);
    passed++;
  } else {
    console.error(`  [FAIL] ${testName} -> ${errorDetail || 'Invariant condition failed'}`);
    failed++;
  }
}

function assertThrows(fn: () => void, expectedErrorName: string, testName: string) {
  try {
    fn();
    console.error(`  [FAIL] ${testName} -> Expected ${expectedErrorName} but no exception was thrown.`);
    failed++;
  } catch (e: any) {
    if (e.constructor.name === expectedErrorName || e.name === expectedErrorName || e.code === expectedErrorName) {
      console.log(`  [PASS] ${testName}`);
      passed++;
    } else {
      console.error(`  [FAIL] ${testName} -> Expected ${expectedErrorName}, received: ${e.constructor.name} (${e.message})`);
      failed++;
    }
  }
}

async function runCenterIntegrationBoundaryTests() {
  console.log('===================================================================');
  console.log('OX-DIGITAL Phase 2.0B — Increment 1 Integration Boundary Tests');
  console.log('Mode: Physical Education Centers First & Evidence Decoupling');
  console.log('Timestamp:', new Date().toISOString());
  console.log('===================================================================\n');

  // -------------------------------------------------------------
  // SUITE 1: Approved Roles & SaaS Super-Admin Tenancy Isolation
  // -------------------------------------------------------------
  console.log('--- Suite 1: Approved Roles & Super-Admin Isolation ---');

  assert(assertApprovedRole('PRIMARY_MANAGER') === 'PRIMARY_MANAGER', 'Primary Manager role accepted');
  assert(assertApprovedRole('ACCOUNTANT') === 'ACCOUNTANT', 'Accountant role accepted');
  assert(assertApprovedRole('CASHIER') === 'CASHIER', 'Cashier role accepted');
  assert(assertApprovedRole('TEACHER') === 'TEACHER', 'Teacher role accepted');

  // Invariant 14: No Branch Manager role
  assertThrows(
    () => assertApprovedRole('BRANCH_MANAGER'),
    'InvalidRoleAssignmentError',
    'Branch Manager role is strictly rejected (OD-701)'
  );

  assertThrows(
    () => assertApprovedRole('UNAUTHORIZED_STAFF'),
    'InvalidRoleAssignmentError',
    'Arbitrary unapproved role is rejected'
  );

  // Invariant 15: SaaS Super-Admin admin@edu.com isolation
  assertThrows(
    () => assertNotSaaSSuperAdmin('admin@edu.com', 'Student enrollment'),
    'InvalidRoleAssignmentError',
    'admin@edu.com rejected from student enrollment'
  );

  assertThrows(
    () => assertNotSaaSSuperAdmin('ADMIN@EDU.COM', 'Cashier role'),
    'InvalidRoleAssignmentError',
    'Case-insensitive admin@edu.com rejected from cashier role'
  );

  // Legitimate tenant users pass
  assertNotSaaSSuperAdmin('usr_student_cairo_01', 'Student');
  assert(true, 'Standard tenant user passes super-admin check');

  // -------------------------------------------------------------
  // SUITE 2: Academic Delivery Evidence Invariants (Lifecycle A)
  // -------------------------------------------------------------
  console.log('\n--- Suite 2: Academic Delivery Evidence Invariants ---');

  const deliveryProps = {
    evidenceId: 'ev_deliv_001',
    institutionId: 'inst_synth_alpha',
    branchId: 'br_alpha_cairo',
    isPhysicalBranch: true,
    centerGroupId: 'cg_math_sec3_cairo',
    lessonId: 'lsn_algebra_12',
    courseId: 'crs_math_sec3',
    teacherId: 'usr_teacher_adel',
    scheduledAt: new Date('2026-11-03T10:00:00Z'),
    deliveredAt: new Date('2026-11-03T12:00:00Z'),
    attendedStudents: [
      { studentId: 'usr_student_s1', status: 'PRESENT' as const, verifiedByTeacher: true },
      { studentId: 'usr_student_s2', status: 'PRESENT' as const, verifiedByTeacher: true },
      { studentId: 'usr_student_s3', status: 'ABSENT' as const, verifiedByTeacher: false }
    ],
    notes: 'Physical session delivered in Classroom 4B'
  };

  const deliveryEvidence = new LessonDeliveryEvidence(deliveryProps);
  assert(deliveryEvidence.status === 'DELIVERED_PENDING_VERIFICATION', 'Initial delivery evidence is pending verification');
  assert(deliveryEvidence.getAttendedStudentCount() === 2, 'Attended student count accurately computed');
  assert(deliveryEvidence.isStudentAttended('usr_student_s1') === true, 'Present student identified');
  assert(deliveryEvidence.isStudentAttended('usr_student_s3') === false, 'Absent student excluded from present list');

  // Physical campus invariant: non-physical branch rejected
  assertThrows(
    () => new LessonDeliveryEvidence({ ...deliveryProps, isPhysicalBranch: false }),
    'InvalidEvidenceError',
    'Lesson delivery evidence strictly requires physical campus branch'
  );

  // Invariant 5 & 6: Delivery evidence alone cannot post to general ledger
  assertThrows(
    () => deliveryEvidence.postToGeneralLedger(),
    'PrematurePostingError',
    'Delivery evidence strictly blocked from direct General Ledger posting'
  );

  // Certification by Primary Manager
  const certifiedEvidence = deliveryEvidence.certify('usr_pm_hassan', 'PRIMARY_MANAGER');
  assert(certifiedEvidence.status === 'CERTIFIED', 'Primary Manager can certify delivery evidence');
  assert(certifiedEvidence.certifiedByUserId === 'usr_pm_hassan', 'Certifier recorded accurately');

  // Non-Primary Manager certification rejected
  assertThrows(
    () => deliveryEvidence.certify('usr_cashier_01', 'CASHIER'),
    'InvalidEvidenceError',
    'Cashier cannot certify educational lesson delivery'
  );

  // -------------------------------------------------------------
  // SUITE 3: Student Financial Agreement & Price Snapshot (Lifecycle B)
  // -------------------------------------------------------------
  console.log('\n--- Suite 3: Student Financial Agreements & Price Snapshot ---');

  const catalogPrice = Money.egp('1200.00');
  const discount = Money.egp('200.00');
  const netPrice = Money.egp('1000.00');

  const priceSnapshot = new AgreementPriceSnapshot({
    catalogPrice,
    discountAmount: discount,
    netAgreedPrice: netPrice
  });

  assert(priceSnapshot.currency === 'EGP', 'Snapshot currency is EGP');
  assert(priceSnapshot.netAgreedPrice.equals(netPrice), 'Net agreed price matches 1000.00 EGP');

  // Multi-currency disabled (Invariant 12)
  assertThrows(
    () => new AgreementPriceSnapshot({
      catalogPrice: new Money('100.00', 'USD' as any),
      netAgreedPrice: new Money('100.00', 'USD' as any)
    }),
    'MultiCurrencyDisabledError',
    'Multi-currency strictly rejected; only EGP permitted'
  );

  // Arithmetic reconciliation in price snapshot
  assertThrows(
    () => new AgreementPriceSnapshot({
      catalogPrice: Money.egp('1200.00'),
      discountAmount: Money.egp('100.00'),
      netAgreedPrice: Money.egp('1000.00') // 1200 - 100 != 1000
    }),
    'InvalidAmountError',
    'Snapshot math mismatch (catalog - discount != net) is rejected'
  );

  // Terminology prohibition: Customer-facing word "installment" forbidden (Invariant 11)
  assertThrows(
    () => new PaymentArrangementScheduleItem({
      scheduleItemNumber: 1,
      dueDate: new Date('2026-11-15'),
      amountDue: Money.egp('500.00'),
      description: 'First installment of course fee'
    }),
    'ForbiddenTerminologyError',
    "Customer-facing term 'installment' is strictly forbidden"
  );

  assertThrows(
    () => new PaymentArrangementScheduleItem({
      scheduleItemNumber: 1,
      dueDate: new Date('2026-11-15'),
      amountDue: Money.egp('500.00'),
      description: 'Monthly Installments Plan'
    }),
    'ForbiddenTerminologyError',
    "Customer-facing term 'Installments' (capitalized) is strictly forbidden"
  );

  // Approved terminology passes
  const validSchedule = [
    new PaymentArrangementScheduleItem({
      scheduleItemNumber: 1,
      dueDate: new Date('2026-11-15'),
      amountDue: Money.egp('500.00'),
      description: 'Initial payment arrangement due at enrollment'
    }),
    new PaymentArrangementScheduleItem({
      scheduleItemNumber: 2,
      dueDate: new Date('2026-12-15'),
      amountDue: Money.egp('500.00'),
      description: 'Scheduled balance due for mid-term'
    })
  ];

  const agreement = new StudentFinancialAgreement({
    agreementId: 'agr_synth_s1_001',
    studentId: 'usr_student_s1',
    centerGroupId: 'cg_math_sec3_cairo',
    institutionId: 'inst_synth_alpha',
    branchId: 'br_alpha_cairo',
    priceSnapshot,
    arrangementSchedule: validSchedule,
    termsNotes: 'Approved physical center payment arrangement schedule'
  });

  assert(agreement.status === 'DRAFT', 'Agreement created in DRAFT status');
  assert(agreement.arrangementSchedule.length === 2, '2 scheduled arrangement items recorded');

  // Invariant 4 & 5: Agreement value is NOT recognized revenue
  assertThrows(
    () => agreement.postToGeneralLedger(),
    'PrematurePostingError',
    'Agreement creation strictly blocked from posting revenue to General Ledger'
  );

  // Invariant 7: Student financial history preserved on transfer
  const transferredAgreement = agreement.transferTo('br_alpha_giza', 'cg_math_sec3_giza');
  assert(transferredAgreement.status === 'TRANSFERRED', 'Agreement transferred');
  assert(transferredAgreement.transferDetails?.priorBranchId === 'br_alpha_cairo', 'Prior branch preserved');
  assert(transferredAgreement.transferDetails?.priorCenterGroupId === 'cg_math_sec3_cairo', 'Prior group preserved');

  // Schedule sum reconciliation against net price
  assertThrows(
    () => new StudentFinancialAgreement({
      agreementId: 'agr_bad_math',
      studentId: 'usr_student_s1',
      centerGroupId: 'cg_math_sec3_cairo',
      institutionId: 'inst_synth_alpha',
      branchId: 'br_alpha_cairo',
      priceSnapshot,
      arrangementSchedule: [
        new PaymentArrangementScheduleItem({
          scheduleItemNumber: 1,
          dueDate: new Date('2026-11-15'),
          amountDue: Money.egp('700.00'), // Sum is 700 != 1000
          description: 'Single payment arrangement'
        })
      ]
    }),
    'InvalidAmountError',
    'Schedule total (700) mismatch against net price (1000) rejected'
  );

  // -------------------------------------------------------------
  // SUITE 4: Amounts Due & Actual Collection Receipts
  // -------------------------------------------------------------
  console.log('\n--- Suite 4: Amounts Due & Actual Collection Receipts ---');

  const obligation = new StudentObligation({
    obligationId: 'obl_s1_item1',
    agreementId: 'agr_synth_s1_001',
    studentId: 'usr_student_s1',
    institutionId: 'inst_synth_alpha',
    branchId: 'br_alpha_cairo',
    scheduleItemNumber: 1,
    dueDate: new Date('2026-11-15'),
    amountDue: Money.egp('500.00')
  });

  assert(obligation.status === 'PENDING', 'Initial obligation status is PENDING');
  assert(obligation.amountDue.equals(Money.egp('500.00')), 'amountDue is 500.00 EGP');
  assert(obligation.amountCollected.isZero(), 'amountCollected starts at 0.00 EGP');
  assert(obligation.remainingDue.equals(Money.egp('500.00')), 'remainingDue is 500.00 EGP');

  // Apply partial collection
  const partiallyCollected = obligation.applyCollection(Money.egp('200.00'));
  assert(partiallyCollected.status === 'PARTIALLY_COLLECTED', 'Status becomes PARTIALLY_COLLECTED');
  assert(partiallyCollected.amountCollected.equals(Money.egp('200.00')), 'Collected updated to 200.00 EGP');
  assert(partiallyCollected.remainingDue.equals(Money.egp('300.00')), 'Remaining due accurately computed as 300.00 EGP');

  // Cashbox Collection Receipt
  const receipt = new CollectionReceiptEvidence({
    collectionId: 'col_rec_001',
    institutionId: 'inst_synth_alpha',
    branchId: 'br_alpha_cairo',
    isPhysicalBranch: true,
    cashboxId: 'cb_cairo_till_01',
    cashierUserId: 'usr_cashier_samir',
    cashierRole: 'CASHIER',
    studentId: 'usr_student_s1',
    obligationId: 'obl_s1_item1',
    amountCollected: Money.egp('200.00'),
    collectedAt: new Date('2026-11-03T11:30:00Z'),
    receiptNumber: 'REC-2026-0042',
    paymentMethod: 'CASH'
  });

  assert(receipt.status === 'COLLECTED', 'Collection receipt recorded in COLLECTED status');
  assert(receipt.amountCollected.equals(Money.egp('200.00')), 'Receipt collected amount verified');

  // Invariant 5: Cash collection alone CANNOT recognize revenue (unearned liability)
  assertThrows(
    () => receipt.recognizeDirectRevenue(),
    'PrematurePostingError',
    'Fee collection receipt strictly blocked from directly recognizing tuition revenue'
  );

  // Cashbox restricted to physical branches
  assertThrows(
    () => new CollectionReceiptEvidence({
      ...receipt,
      isPhysicalBranch: false
    }),
    'InvalidEvidenceError',
    'Cashbox collections forbidden at non-physical/online branches'
  );

  // -------------------------------------------------------------
  // SUITE 5: Decoupled Evidence Boundary & Pairing Engine
  // -------------------------------------------------------------
  console.log('\n--- Suite 5: Decoupled Evidence Boundary & Pairing ---');

  // Event emission for certified delivery
  const certEvent = CenterEvidenceBoundaryService.registerDeliveryCertification(certifiedEvidence);
  assert(certEvent.eventType === 'LESSON_DELIVERY_CERTIFIED', 'Delivery certified event registered');
  assert(certEvent.attendedStudentCount === 2, 'Event payload includes attended count');

  // Event emission for student agreement
  const agrEvent = CenterEvidenceBoundaryService.registerAgreementEstablished(agreement);
  assert(agrEvent.eventType === 'STUDENT_AGREEMENT_ESTABLISHED', 'Agreement established event registered');
  assert(agrEvent.currency === 'EGP', 'Currency in event payload verified as EGP');

  // Link verified delivery evidence to student agreement
  const pairedResult = CenterEvidenceBoundaryService.linkDeliveryProof(
    certifiedEvidence,
    agreement,
    'usr_student_s1'
  );

  assert(pairedResult.eventType === 'DELIVERY_PROOF_LINKED', 'Delivery proof linked event emitted');
  assert(pairedResult.revenueRecognized === false, 'Revenue recognition explicitly remains unposted at boundary');
  assert(pairedResult.studentId === 'usr_student_s1', 'Paired student ID verified');

  // Cross-tenant pairing rejection
  const foreignAgreement = new StudentFinancialAgreement({
    ...agreement,
    institutionId: 'inst_synth_beta'
  });

  assertThrows(
    () => CenterEvidenceBoundaryService.linkDeliveryProof(certifiedEvidence, foreignAgreement, 'usr_student_s1'),
    'CrossInstitutionError',
    'Cross-tenant evidence pairing strictly rejected'
  );

  // Absent student pairing rejection
  assertThrows(
    () => CenterEvidenceBoundaryService.linkDeliveryProof(certifiedEvidence, agreement, 'usr_student_s3'),
    'InvalidEvidenceError',
    'Student marked ABSENT cannot have delivery proof linked'
  );

  // -------------------------------------------------------------
  // SUITE 6: Unresolved Policy Blocking Guards (Section 4)
  // -------------------------------------------------------------
  console.log('\n--- Suite 6: Unresolved Policy Blocking Guards ---');

  // UP-704: Teacher variable revenue share blocked
  assertThrows(
    () => CenterEvidenceBoundaryService.guardTeacherVariableCompensation('REVENUE_SHARE'),
    'UnresolvedPolicyBlockedError',
    'UP-704: Teacher variable revenue-share calculation blocked'
  );

  assertThrows(
    () => CenterEvidenceBoundaryService.guardTeacherVariableCompensation('PER_STUDENT'),
    'UnresolvedPolicyBlockedError',
    'UP-704: Per-student variable compensation blocked'
  );

  // UP-705: Cashbox till discrepancy sign-off blocked
  assertThrows(
    () => CenterEvidenceBoundaryService.guardCashboxDiscrepancyThreshold(45.50),
    'UnresolvedPolicyBlockedError',
    'UP-705: Cashbox discrepancy sign-off blocked'
  );

  // Zero discrepancy passes
  CenterEvidenceBoundaryService.guardCashboxDiscrepancyThreshold(0);
  assert(true, 'Zero discrepancy passes variance check');

  // OD-710: Hard-close of fiscal period blocked
  assertThrows(
    () => CenterEvidenceBoundaryService.guardAccountingPeriodCloseWorkflow('CLOSE_PERIOD'),
    'UnresolvedPolicyBlockedError',
    'OD-710: Hard-closing accounting period workflow blocked'
  );

  // UP-701: Statutory Chart Review
  assertThrows(
    () => CenterEvidenceBoundaryService.guardStatutoryChartReview(),
    'UnresolvedPolicyBlockedError',
    'UP-701: Statutory chart alteration blocked'
  );

  // UP-702: Written Tax Counsel Opinion
  assertThrows(
    () => CenterEvidenceBoundaryService.guardEgyptianTaxCounselOpinion(),
    'UnresolvedPolicyBlockedError',
    'UP-702: Tax assumptions blocked without written Egyptian tax counsel opinion'
  );

  // UP-706: Student Refund Policy Legal Review
  assertThrows(
    () => CenterEvidenceBoundaryService.guardRefundProcessing(),
    'UnresolvedPolicyBlockedError',
    'UP-706: Student refund execution blocked without approved legal review'
  );

  // UP-715: Statutory Retention & PII Scrubbing
  assertThrows(
    () => CenterEvidenceBoundaryService.guardRetentionAndPiiScrubbing(),
    'UnresolvedPolicyBlockedError',
    'UP-715: Statutory retention and PII scrubbing blocked without specialist review'
  );

  // UP-711: Real Legacy Opening Balances
  assertThrows(
    () => CenterEvidenceBoundaryService.guardLegacyOpeningBalances(),
    'UnresolvedPolicyBlockedError',
    'UP-711: Legacy opening balance migration blocked without approved policy'
  );

  console.log('\n===================================================================');
  console.log(`INCREMENT 1 TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('===================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runCenterIntegrationBoundaryTests().catch((err) => {
  console.error('[FATAL TEST RUNNER ERROR]', err);
  process.exit(1);
});

