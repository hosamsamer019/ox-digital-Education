/**
 * OX-DIGITAL Education — Financial Core Engine
 * Phase 2.0B — Increment 2: Accrual Revenue Recognition Pairing Engine
 * Invariant & Negative Test Suite
 */

import {
  Money,
  Account,
  ChartOfAccounts,
  BranchDimension,
  JournalEntry,
  JournalLine,
  LessonDeliveryEvidence,
  AgreementPriceSnapshot,
  PaymentArrangementScheduleItem,
  StudentFinancialAgreement,
  RevenueAllocationPlan,
  AccrualRevenueRecognitionEngine,
  InMemoryConsumedEvidenceStore,
  DEFAULT_PROVISIONAL_MAPPING,
  InvalidEvidenceError,
  CrossInstitutionError,
  PrematurePostingError,
  EvidenceAlreadyConsumedError,
  ExcessiveRevenueRecognitionError,
  UnsupportedAllocationBasisError,
  ImmutablePostedEntryError,
  AccountNotFoundError,
  UnbalancedJournalEntryError
} from '../../packages/shared/src/accounting/index.js';

let passed = 0;
let failed = 0;

function assert(condition: boolean, testName: string, errorDetail?: string) {
  if (condition) {
    console.log(`  [PASS] ${testName}`);
    passed++;
  } else {
    console.error(`  [FAIL] ${testName} -> ${errorDetail || 'Condition failed'}`);
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

function createTestChartOfAccounts(institutionId: string = 'inst_synth_alpha'): ChartOfAccounts {
  const chart = new ChartOfAccounts(institutionId);

  // Provisional Unearned Tuition Liability (2210) awaiting UP-701
  chart.addAccount(
    new Account({
      id: 'acc_liab_2210',
      code: '2210',
      name: 'Unearned Tuition Liability (Provisional UP-701)',
      type: 'LIABILITY',
      institutionId,
      isPostable: true,
      currency: 'EGP'
    })
  );

  // Provisional Earned Tuition Revenue (4100) awaiting UP-701
  chart.addAccount(
    new Account({
      id: 'acc_rev_4100',
      code: '4100',
      name: 'Earned Tuition Revenue (Provisional UP-701)',
      type: 'REVENUE',
      institutionId,
      isPostable: true,
      currency: 'EGP'
    })
  );

  return chart;
}

function createTestFixtures() {
  const institutionId = 'inst_synth_alpha';
  const branchId = 'br_alpha_cairo';
  const centerGroupId = 'cg_math_sec3_cairo';
  const studentId = 'usr_student_s1';
  const teacherId = 'usr_teacher_adel';

  const chart = createTestChartOfAccounts(institutionId);
  const evidenceStore = new InMemoryConsumedEvidenceStore();

  const priceSnapshot = new AgreementPriceSnapshot({
    catalogPrice: Money.egp('1200.00'),
    discountAmount: Money.egp('200.00'),
    netAgreedPrice: Money.egp('1000.00')
  });

  const agreement = new StudentFinancialAgreement({
    agreementId: 'agr_s1_001',
    studentId,
    centerGroupId,
    institutionId,
    branchId,
    priceSnapshot,
    arrangementSchedule: [
      new PaymentArrangementScheduleItem({
        scheduleItemNumber: 1,
        dueDate: new Date('2026-11-15'),
        amountDue: Money.egp('500.00'),
        description: 'First arrangement due'
      }),
      new PaymentArrangementScheduleItem({
        scheduleItemNumber: 2,
        dueDate: new Date('2026-12-15'),
        amountDue: Money.egp('500.00'),
        description: 'Second arrangement due'
      })
    ]
  }).activate();

  const evidence = new LessonDeliveryEvidence({
    evidenceId: 'ev_lesson_01',
    institutionId,
    branchId,
    isPhysicalBranch: true,
    centerGroupId,
    lessonId: 'lsn_algebra_01',
    courseId: 'crs_math_sec3',
    teacherId,
    scheduledAt: new Date('2026-11-03T10:00:00Z'),
    deliveredAt: new Date('2026-11-03T12:00:00Z'),
    attendedStudents: [
      { studentId, status: 'PRESENT', verifiedByTeacher: true },
      { studentId: 'usr_student_s2', status: 'PRESENT', verifiedByTeacher: true },
      { studentId: 'usr_student_s3', status: 'ABSENT', verifiedByTeacher: false }
    ]
  }).certify('usr_pm_hassan', 'PRIMARY_MANAGER');

  return {
    institutionId,
    branchId,
    centerGroupId,
    studentId,
    teacherId,
    chart,
    evidenceStore,
    priceSnapshot,
    agreement,
    evidence
  };
}

async function runAccrualRevenueRecognitionTests() {
  console.log('===================================================================');
  console.log('OX-DIGITAL Phase 2.0B — Increment 2: Accrual Revenue Recognition Tests');
  console.log('Mode: Pure Domain Pairing Engine & Double-Entry Invariants');
  console.log('Timestamp:', new Date().toISOString());
  console.log('===================================================================\n');

  // -------------------------------------------------------------
  // SUITE 1: Positive Recognition & Balanced Journal Posting
  // -------------------------------------------------------------
  console.log('--- Suite 1: Positive Recognition & Balanced Journal Posting ---');

  const f1 = createTestFixtures();
  const totalLessons = 4; // 1000 EGP / 4 lessons = 250.00 EGP per lesson
  let plan = RevenueAllocationPlan.fromAgreement(f1.agreement, totalLessons);

  const res1 = AccrualRevenueRecognitionEngine.recognizeRevenue({
    evidence: f1.evidence,
    agreement: f1.agreement,
    studentId: f1.studentId,
    allocationPlan: plan,
    evidenceStore: f1.evidenceStore,
    chartOfAccounts: f1.chart,
    actor: 'usr_accountant_mona'
  });

  assert(res1.isIdempotentReplay === false, 'Fresh recognition is not an idempotent replay');
  assert(res1.record.status === 'POSTED', 'Recognition record status is POSTED');
  assert(res1.record.amountRecognized.equals(Money.egp('250.00')), 'Recognized amount is exactly 250.00 EGP');

  // Journal entry verification
  const je = res1.journalEntry;
  assert(je.status === 'POSTED', 'Journal entry status is POSTED');
  assert(je.isBalanced() === true, 'Double-entry balance verified: Total Debits == Total Credits');
  assert(je.getTotalDebits().equals(Money.egp('250.00')), 'Total Debits is 250.00 EGP');
  assert(je.getTotalCredits().equals(Money.egp('250.00')), 'Total Credits is 250.00 EGP');
  assert(je.lines.length === 2, 'Entry contains exactly 2 lines');

  const debitLine = je.lines.find(l => l.isDebit);
  const creditLine = je.lines.find(l => l.isCredit);
  assert(debitLine?.accountId === 'acc_liab_2210', 'Debit line targets Deferred Revenue (2210)');
  assert(creditLine?.accountId === 'acc_rev_4100', 'Credit line targets Earned Tuition (4100)');
  assert(debitLine?.branchDimension?.branchId === 'br_alpha_cairo', 'Branch dimension tagged correctly');

  // Plan advanced
  plan = res1.updatedAllocationPlan;
  assert(plan.recognizedUnitsCount === 1, 'Allocation plan advanced to unit 1');
  assert(plan.accumulatedRecognizedAmount.equals(Money.egp('250.00')), 'Accumulated recognized amount is 250.00 EGP');
  assert(plan.remainingUnearnedAmount.equals(Money.egp('750.00')), 'Remaining unearned amount is 750.00 EGP');

  // -------------------------------------------------------------
  // SUITE 2: Deterministic Multi-Unit Allocation & Penny Rounding
  // -------------------------------------------------------------
  console.log('\n--- Suite 2: Multi-Unit Allocation & Penny Rounding Invariant ---');

  // Agreement with 3 units on 1000.00 EGP: 1000 / 3 = 333.33, 333.33, final unit: 333.34
  const f2 = createTestFixtures();
  let threeUnitPlan = RevenueAllocationPlan.fromAgreement(f2.agreement, 3);

  const unit1Amount = threeUnitPlan.calculateNextUnitRecognitionAmount();
  assert(unit1Amount.equals(Money.egp('333.33')), 'Unit 1 allocated 333.33 EGP');
  threeUnitPlan = threeUnitPlan.advance(unit1Amount);

  const unit2Amount = threeUnitPlan.calculateNextUnitRecognitionAmount();
  assert(unit2Amount.equals(Money.egp('333.33')), 'Unit 2 allocated 333.33 EGP');
  threeUnitPlan = threeUnitPlan.advance(unit2Amount);

  const unit3Amount = threeUnitPlan.calculateNextUnitRecognitionAmount();
  assert(unit3Amount.equals(Money.egp('333.34')), 'Final Unit 3 deterministically absorbs remainder (333.34 EGP)');
  threeUnitPlan = threeUnitPlan.advance(unit3Amount);

  assert(threeUnitPlan.isFullyRecognized === true, 'Plan is fully recognized after 3 units');
  assert(threeUnitPlan.accumulatedRecognizedAmount.equals(Money.egp('1000.00')), 'Sum of recognized units equals exactly 1000.00 EGP (zero penny loss)');
  assert(threeUnitPlan.remainingUnearnedAmount.isZero(), 'Remaining unearned is exactly 0.00 EGP');

  // Attempting to calculate beyond total units throws ExcessiveRevenueRecognitionError
  assertThrows(
    () => threeUnitPlan.calculateNextUnitRecognitionAmount(),
    'ExcessiveRevenueRecognitionError',
    'Cannot recognize revenue beyond net agreed price'
  );

  // -------------------------------------------------------------
  // SUITE 3: Idempotency & Duplicate Prevention
  // -------------------------------------------------------------
  console.log('\n--- Suite 3: Idempotency & Duplicate Consumption ---');

  // Repeat exact request with f1 -> Idempotent replay, zero duplicate postings
  const repeatRes = AccrualRevenueRecognitionEngine.recognizeRevenue({
    evidence: f1.evidence,
    agreement: f1.agreement,
    studentId: f1.studentId,
    allocationPlan: plan,
    evidenceStore: f1.evidenceStore,
    chartOfAccounts: f1.chart,
    actor: 'usr_accountant_mona'
  });

  assert(repeatRes.isIdempotentReplay === true, 'Repeat request detected as idempotent replay');
  assert(repeatRes.journalEntry.id === res1.journalEntry.id, 'Idempotent replay returns original journal entry');

  // Attempting to consume the same evidence for the same student under another agreement
  const anotherAgreement = new StudentFinancialAgreement({
    ...f1.agreement,
    agreementId: 'agr_s1_another'
  });

  assertThrows(
    () => AccrualRevenueRecognitionEngine.recognizeRevenue({
      evidence: f1.evidence,
      agreement: anotherAgreement,
      studentId: f1.studentId,
      allocationPlan: plan,
      evidenceStore: f1.evidenceStore,
      chartOfAccounts: f1.chart,
      actor: 'usr_accountant_mona'
    }),
    'EvidenceAlreadyConsumedError',
    'Evidence already consumed for this student cannot be consumed twice'
  );

  // -------------------------------------------------------------
  // SUITE 4: Negative Matching Tests (Section 5 Compliance)
  // -------------------------------------------------------------
  console.log('\n--- Suite 4: Negative Matching Invariant Tests ---');

  // 1. Uncertified evidence
  const uncertifiedEvidence = new LessonDeliveryEvidence({
    ...f1.evidence,
    evidenceId: 'ev_uncertified',
    status: 'DELIVERED_PENDING_VERIFICATION'
  });
  assertThrows(
    () => AccrualRevenueRecognitionEngine.recognizeRevenue({
      evidence: uncertifiedEvidence,
      agreement: f1.agreement,
      studentId: f1.studentId,
      allocationPlan: plan,
      evidenceStore: f1.evidenceStore,
      chartOfAccounts: f1.chart,
      actor: 'usr_accountant_mona'
    }),
    'InvalidEvidenceError',
    'Uncertified evidence strictly rejected from revenue recognition'
  );

  // 2. Evidence from another institution
  const foreignInstEvidence = new LessonDeliveryEvidence({
    ...f1.evidence,
    evidenceId: 'ev_foreign_inst',
    institutionId: 'inst_foreign_beta'
  });
  assertThrows(
    () => AccrualRevenueRecognitionEngine.recognizeRevenue({
      evidence: foreignInstEvidence,
      agreement: f1.agreement,
      studentId: f1.studentId,
      allocationPlan: plan,
      evidenceStore: f1.evidenceStore,
      chartOfAccounts: f1.chart,
      actor: 'usr_accountant_mona'
    }),
    'CrossInstitutionError',
    'Cross-institution delivery evidence pairing strictly rejected'
  );

  // 3. Evidence from another branch
  const foreignBranchEvidence = new LessonDeliveryEvidence({
    ...f1.evidence,
    evidenceId: 'ev_foreign_branch',
    branchId: 'br_alpha_giza'
  });
  assertThrows(
    () => AccrualRevenueRecognitionEngine.recognizeRevenue({
      evidence: foreignBranchEvidence,
      agreement: f1.agreement,
      studentId: f1.studentId,
      allocationPlan: plan,
      evidenceStore: f1.evidenceStore,
      chartOfAccounts: f1.chart,
      actor: 'usr_accountant_mona'
    }),
    'InvalidEvidenceError',
    'Cross-branch delivery evidence pairing strictly rejected'
  );

  // 4. Evidence from another group
  const foreignGroupEvidence = new LessonDeliveryEvidence({
    ...f1.evidence,
    evidenceId: 'ev_foreign_group',
    centerGroupId: 'cg_physics_sec3'
  });
  assertThrows(
    () => AccrualRevenueRecognitionEngine.recognizeRevenue({
      evidence: foreignGroupEvidence,
      agreement: f1.agreement,
      studentId: f1.studentId,
      allocationPlan: plan,
      evidenceStore: f1.evidenceStore,
      chartOfAccounts: f1.chart,
      actor: 'usr_accountant_mona'
    }),
    'InvalidEvidenceError',
    'Cross-group delivery evidence pairing strictly rejected'
  );

  // 5. Student / Agreement mismatch
  assertThrows(
    () => AccrualRevenueRecognitionEngine.recognizeRevenue({
      evidence: f1.evidence,
      agreement: f1.agreement,
      studentId: 'usr_student_different',
      allocationPlan: plan,
      evidenceStore: f1.evidenceStore,
      chartOfAccounts: f1.chart,
      actor: 'usr_accountant_mona'
    }),
    'InvalidEvidenceError',
    'Student mismatch between request and agreement rejected'
  );

  // 6. Student marked ABSENT in certified evidence
  const evidence2 = new LessonDeliveryEvidence({
    ...f1.evidence,
    evidenceId: 'ev_lesson_02',
    attendedStudents: [
      { studentId: f1.studentId, status: 'ABSENT', verifiedByTeacher: false }
    ]
  }).certify('usr_pm_hassan', 'PRIMARY_MANAGER');

  assertThrows(
    () => AccrualRevenueRecognitionEngine.recognizeRevenue({
      evidence: evidence2,
      agreement: f1.agreement,
      studentId: f1.studentId,
      allocationPlan: plan,
      evidenceStore: f1.evidenceStore,
      chartOfAccounts: f1.chart,
      actor: 'usr_accountant_mona'
    }),
    'InvalidEvidenceError',
    'Revenue recognition rejected for student marked ABSENT'
  );

  // 7. Inactive / DRAFT agreement
  const draftAgreement = new StudentFinancialAgreement({
    ...f1.agreement,
    agreementId: 'agr_draft_only',
    status: 'DRAFT'
  });
  assertThrows(
    () => AccrualRevenueRecognitionEngine.recognizeRevenue({
      evidence: f1.evidence,
      agreement: draftAgreement,
      studentId: f1.studentId,
      allocationPlan: plan,
      evidenceStore: f1.evidenceStore,
      chartOfAccounts: f1.chart,
      actor: 'usr_accountant_mona'
    }),
    'PrematurePostingError',
    'Recognition rejected against DRAFT agreement'
  );

  // 8. Unsupported allocation basis (0 total lessons)
  assertThrows(
    () => RevenueAllocationPlan.fromAgreement(f1.agreement, 0),
    'UnsupportedAllocationBasisError',
    'Allocation plan with 0 units throws UnsupportedAllocationBasisError'
  );

  // 9. Unapproved / Missing statutory account in chart
  const freshEvidenceStore = new InMemoryConsumedEvidenceStore();
  const evidenceFresh = new LessonDeliveryEvidence({
    ...f1.evidence,
    evidenceId: 'ev_lesson_fresh_for_account_test'
  }).certify('usr_pm_hassan', 'PRIMARY_MANAGER');

  assertThrows(
    () => AccrualRevenueRecognitionEngine.recognizeRevenue({
      evidence: evidenceFresh,
      agreement: f1.agreement,
      studentId: f1.studentId,
      allocationPlan: plan,
      evidenceStore: freshEvidenceStore,
      chartOfAccounts: f1.chart,
      actor: 'usr_accountant_mona',
      provisionalMapping: {
        deferredRevenueAccountCode: '9999_NON_EXISTENT',
        earnedTuitionRevenueAccountCode: '4100',
        awaitingStatutoryReview: 'UP-701'
      }
    }),
    'AccountNotFoundError',
    'Unmapped account code in chart throws AccountNotFoundError'
  );

  // 10. Attempt to mutate a posted journal entry
  assertThrows(
    () => (res1.journalEntry as any).addLine(new JournalLine({
      id: 'illegal_line',
      accountId: 'acc_rev_4100',
      debit: Money.zero('EGP'),
      credit: Money.egp('10.00')
    })),
    'ImmutablePostedEntryError',
    'Attempt to mutate posted journal entry throws ImmutablePostedEntryError'
  );

  // 11. Tampered / Invalid price snapshot
  assertThrows(
    () => new AgreementPriceSnapshot({
      catalogPrice: Money.egp('1000.00'),
      discountAmount: Money.egp('100.00'),
      netAgreedPrice: Money.egp('950.00') // 1000 - 100 != 950
    }),
    'InvalidAmountError',
    'Tampered price snapshot with mismatched math is rejected'
  );

  // 12. Negative / Zero allocation plan net price
  assertThrows(
    () => new RevenueAllocationPlan({
      agreementId: 'agr_neg_test',
      netAgreedPrice: Money.egp('0.00'),
      totalEligibleUnits: 4
    }),
    'InvalidAmountError',
    'Zero net agreed price in allocation plan is rejected'
  );

  // 13. Unbalanced journal entry invariant rejection
  assertThrows(
    () => {
      const unbalancedEntry = new JournalEntry({
        id: 'JE_UNBALANCED_TEST',
        institutionId: f1.institutionId,
        transactionDate: new Date(),
        accountingDate: new Date(),
        description: 'Unbalanced test entry',
        createdBy: 'usr_accountant_mona',
        lines: [
          new JournalLine({
            id: 'unb_L1',
            accountId: 'acc_liab_2210',
            debit: Money.egp('250.00'),
            credit: Money.zero('EGP')
          }),
          new JournalLine({
            id: 'unb_L2',
            accountId: 'acc_rev_4100',
            debit: Money.zero('EGP'),
            credit: Money.egp('200.00') // 250 != 200
          })
        ]
      });
      unbalancedEntry.validate(f1.chart);
    },
    'UnbalancedJournalEntryError',
    'Unbalanced double-entry journal entry throws UnbalancedJournalEntryError'
  );

  // -------------------------------------------------------------
  // SUITE 5: Pure Append-Only Reversals & Compensating Entries
  // -------------------------------------------------------------
  console.log('\n--- Suite 5: Pure Append-Only Reversals ---');

  const revRes = AccrualRevenueRecognitionEngine.reverseRevenueRecognition({
    idempotencyKey: res1.record.idempotencyKey,
    reversalEntryId: 'JE_REV_REVERSAL_001',
    actor: 'usr_pm_hassan',
    reason: 'Lesson delivery evidence certified in error (class rescheduled)',
    evidenceStore: f1.evidenceStore,
    chartOfAccounts: f1.chart,
    allocationPlan: res1.updatedAllocationPlan
  });

  assert(revRes.updatedRecord.status === 'REVERSED', 'Record status transitioned to REVERSED');
  assert(revRes.reversalJournalEntry.status === 'POSTED', 'Reversal journal entry posted');
  assert(revRes.reversalJournalEntry.isBalanced() === true, 'Reversal entry is double-entry balanced');

  // Verify inversion of debits and credits
  const revDebit = revRes.reversalJournalEntry.lines.find(l => l.isDebit);
  const revCredit = revRes.reversalJournalEntry.lines.find(l => l.isCredit);
  assert(revDebit?.accountId === 'acc_rev_4100', 'Reversal DEBIT targets Earned Tuition Revenue');
  assert(revCredit?.accountId === 'acc_liab_2210', 'Reversal CREDIT targets Deferred Revenue Liability');
  assert(revDebit?.amount.equals(Money.egp('250.00')), 'Reversal amount is 250.00 EGP');

  // Original entry remains permanently in POSTED status (pure append-only invariant)
  assert(res1.journalEntry.status === 'POSTED', 'Original journal entry remains POSTED (immutable append-only)');

  // Allocation plan balance restored
  const revertedPlan = revRes.revertedAllocationPlan;
  assert(revertedPlan.recognizedUnitsCount === 0, 'Recognized units count reverted from 1 to 0');
  assert(revertedPlan.accumulatedRecognizedAmount.isZero(), 'Accumulated recognized amount reverted to 0.00 EGP');
  assert(revertedPlan.remainingUnearnedAmount.equals(Money.egp('1000.00')), 'Full 1000.00 EGP unearned balance restored');

  // Duplicate reversal attempt rejected
  assertThrows(
    () => AccrualRevenueRecognitionEngine.reverseRevenueRecognition({
      idempotencyKey: res1.record.idempotencyKey,
      reversalEntryId: 'JE_REV_REVERSAL_DUPLICATE',
      actor: 'usr_pm_hassan',
      reason: 'Duplicate reversal attempt',
      evidenceStore: f1.evidenceStore,
      chartOfAccounts: f1.chart,
      allocationPlan: revertedPlan
    }),
    'AccountingDomainError',
    'Duplicate reversal on same recognition record is rejected'
  );

  console.log('\n===================================================================');
  console.log(`INCREMENT 2 TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('===================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runAccrualRevenueRecognitionTests().catch((err) => {
  console.error('[FATAL TEST RUNNER ERROR]', err);
  process.exit(1);
});
