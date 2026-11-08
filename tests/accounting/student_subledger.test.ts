/**
 * OX-DIGITAL Education — Accounting Track Phase 2.0B
 * Increment 3 Test Suite: Student Sub-Ledger, Collection Allocation & Reconciliation State Machine
 * Mode: Pure Domain Invariants (Zero DB, Zero Mocks)
 */

import { Money } from '../../packages/shared/src/accounting/money.js';
import {
  AgreementPriceSnapshot,
  PaymentArrangementScheduleItem,
  StudentFinancialAgreement
} from '../../packages/shared/src/accounting/center/agreement.js';
import {
  StudentObligation,
  CollectionReceiptEvidence
} from '../../packages/shared/src/accounting/center/obligations.js';
import {
  StudentSubLedger,
  TrackedCollectionReceipt,
  CollectionAllocationRecord
} from '../../packages/shared/src/accounting/center/subLedger.js';
import {
  InvalidAmountError,
  PrematurePostingError,
  InvalidEvidenceError,
  ExcessiveAllocationError,
  DuplicateReceiptError,
  IneligibleObligationError,
  CrossStudentAllocationError,
  CrossBranchAllocationError,
  CrossInstitutionError,
  ConflictingAllocationReplayError,
  InvalidLifecycleTransitionError,
  DuplicateReversalError
} from '../../packages/shared/src/accounting/errors.js';

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function assert(condition: boolean, testName: string): void {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`  [PASS] ${testName}`);
  } else {
    failedTests++;
    console.error(`  [FAIL] ${testName}`);
  }
}

function assertThrows<T extends Error>(
  fn: () => void,
  expectedErrorClass: new (...args: any[]) => T,
  testName: string
): void {
  totalTests++;
  try {
    fn();
    failedTests++;
    console.error(`  [FAIL] ${testName} (Expected exception ${expectedErrorClass.name}, but none was thrown)`);
  } catch (err: any) {
    if (err instanceof expectedErrorClass) {
      passedTests++;
      console.log(`  [PASS] ${testName}`);
    } else {
      failedTests++;
      console.error(
        `  [FAIL] ${testName} (Expected ${expectedErrorClass.name}, received ${err.constructor.name}: ${err.message})`
      );
    }
  }
}

console.log('===================================================================');
console.log('OX-DIGITAL Phase 2.0B — Increment 3: Student Sub-Ledger Tests');
console.log('Mode: Pure Domain Sub-Ledger & Collection Allocation Invariants');
console.log(`Timestamp: ${new Date().toISOString()}`);
console.log('===================================================================\n');

// Standard Test Fixtures
function createStandardAgreement(overrides: Partial<any> = {}): StudentFinancialAgreement {
  const catalogPrice = Money.egp('1200.00');
  const discount = Money.egp('200.00');
  const netPrice = Money.egp('1000.00');

  const snapshot = new AgreementPriceSnapshot({
    catalogPrice,
    discountAmount: discount,
    netAgreedPrice: netPrice
  });

  const schedule = [
    new PaymentArrangementScheduleItem({
      scheduleItemNumber: 1,
      dueDate: new Date('2026-11-15'),
      amountDue: Money.egp('500.00'),
      description: 'First due arrangement'
    }),
    new PaymentArrangementScheduleItem({
      scheduleItemNumber: 2,
      dueDate: new Date('2026-12-15'),
      amountDue: Money.egp('500.00'),
      description: 'Second due arrangement'
    })
  ];

  return new StudentFinancialAgreement({
    agreementId: overrides.agreementId || 'agr_std_001',
    studentId: overrides.studentId || 'usr_student_alpha',
    centerGroupId: overrides.centerGroupId || 'grp_math_sec1',
    institutionId: overrides.institutionId || 'inst_synth_alpha',
    branchId: overrides.branchId || 'br_alpha_cairo',
    priceSnapshot: snapshot,
    arrangementSchedule: schedule,
    status: 'ACTIVE'
  });
}

function createReceipt(overrides: Partial<any> = {}): CollectionReceiptEvidence {
  return new CollectionReceiptEvidence({
    collectionId: overrides.collectionId || `col_rec_${Date.now()}_${Math.random()}`,
    institutionId: overrides.institutionId || 'inst_synth_alpha',
    branchId: overrides.branchId || 'br_alpha_cairo',
    isPhysicalBranch: overrides.isPhysicalBranch !== undefined ? overrides.isPhysicalBranch : true,
    cashboxId: overrides.cashboxId || 'cb_cairo_main',
    cashierUserId: overrides.cashierUserId || 'usr_cashier_1',
    cashierRole: overrides.cashierRole || 'CASHIER',
    studentId: overrides.studentId || 'usr_student_alpha',
    amountCollected: overrides.amountCollected || Money.egp('500.00'),
    collectedAt: overrides.collectedAt || new Date('2026-11-05'),
    receiptNumber: overrides.receiptNumber || 'REC-CAIRO-001',
    paymentMethod: overrides.paymentMethod || 'CASH'
  });
}

// -----------------------------------------------------------------------------
// Suite 1: Sub-Ledger Initialization & Conservation Invariants
// -----------------------------------------------------------------------------
console.log('--- Suite 1: Sub-Ledger Initialization & Conservation Invariants ---');
{
  const agreement = createStandardAgreement();
  const subLedger = new StudentSubLedger(agreement, 'usr_mgr_1');

  assert(subLedger.studentId === 'usr_student_alpha', 'Student identity bound correctly');
  assert(subLedger.institutionId === 'inst_synth_alpha', 'Institution boundary bound correctly');
  assert(subLedger.branchId === 'br_alpha_cairo', 'Branch dimension bound correctly');
  assert(subLedger.status === 'ACTIVE', 'Initial sub-ledger status is ACTIVE');
  assert(subLedger.obligations.size === 2, 'Two scheduled obligations initialized');

  const balances = subLedger.getBalances();
  assert(balances.totalAgreedPrice.equals(Money.egp('1000.00')), 'Agreed price matches 1000.00 EGP');
  assert(balances.totalObligationsDue.equals(Money.egp('1000.00')), 'Total obligations due matches 1000.00 EGP');
  assert(balances.totalCollectionsReceived.isZero(), 'Initial collections received is zero');
  assert(balances.totalAllocated.isZero(), 'Initial total allocated is zero');
  assert(balances.totalUnallocatedCollections.isZero(), 'Initial unallocated collections is zero');
  assert(balances.totalRemainingDue.equals(Money.egp('1000.00')), 'Initial remaining due matches 1000.00 EGP');

  // Exact Piaster Conservation: allocated + unallocated == collections; allocated + remaining == due
  assert(
    balances.totalAllocated.add(balances.totalUnallocatedCollections).equals(balances.totalCollectionsReceived),
    'Conservation: Allocated + Unallocated == Collected'
  );
  assert(
    balances.totalAllocated.add(balances.totalRemainingDue).equals(balances.totalObligationsDue),
    'Conservation: Allocated + Remaining == Due'
  );

  // Initial Transaction history contains Agreement & Obligation records
  assert(subLedger.transactionHistory.length === 3, 'Transaction log initialized with agreement and 2 obligations');
}

// -----------------------------------------------------------------------------
// Suite 2: Actual Collection Receipts & Allocation State Transitions
// -----------------------------------------------------------------------------
console.log('\n--- Suite 2: Actual Collection Receipts & Allocation State Transitions ---');
{
  const agreement = createStandardAgreement();
  const subLedger = new StudentSubLedger(agreement, 'usr_mgr_1');

  const receipt = createReceipt({
    collectionId: 'rec_001',
    amountCollected: Money.egp('600.00'),
    receiptNumber: 'REC-001'
  });

  const tracked = subLedger.recordCollection(receipt, 'usr_cashier_1');
  assert(tracked.state === 'UNALLOCATED', 'Receipt initially in UNALLOCATED state');
  assert(tracked.unallocatedAmount.equals(Money.egp('600.00')), 'Full 600.00 EGP is unallocated');

  let balances = subLedger.getBalances();
  assert(balances.totalCollectionsReceived.equals(Money.egp('600.00')), 'Total collections is 600.00 EGP');
  assert(balances.totalUnallocatedCollections.equals(Money.egp('600.00')), 'Total unallocated is 600.00 EGP');
  assert(balances.totalRemainingDue.equals(Money.egp('1000.00')), 'Total remaining due is 1000.00 EGP');

  // Partial allocation: Allocate 400.00 EGP to Obligation 1 (amountDue 500.00)
  const allocRes1 = subLedger.allocate(
    {
      collectionId: 'rec_001',
      obligationId: 'ob_agr_std_001_1',
      amount: Money.egp('400.00')
    },
    'usr_cashier_1'
  );

  assert(!allocRes1.isReplay, 'First allocation is not a replay');
  assert(allocRes1.allocation.status === 'ACTIVE', 'Allocation status is ACTIVE');

  const trackedAfterAlloc1 = subLedger.receipts.get('rec_001')!;
  assert(trackedAfterAlloc1.state === 'PARTIALLY_ALLOCATED', 'Receipt transitioned to PARTIALLY_ALLOCATED');
  assert(trackedAfterAlloc1.allocatedAmount.equals(Money.egp('400.00')), 'Receipt allocated 400.00 EGP');
  assert(trackedAfterAlloc1.unallocatedAmount.equals(Money.egp('200.00')), 'Receipt unallocated 200.00 EGP');

  const ob1AfterAlloc1 = subLedger.obligations.get('ob_agr_std_001_1')!;
  assert(ob1AfterAlloc1.status === 'PARTIALLY_COLLECTED', 'Obligation transitioned to PARTIALLY_COLLECTED');
  assert(ob1AfterAlloc1.amountCollected.equals(Money.egp('400.00')), 'Obligation collected 400.00 EGP');
  assert(ob1AfterAlloc1.remainingDue.equals(Money.egp('100.00')), 'Obligation remaining due 100.00 EGP');

  balances = subLedger.getBalances();
  assert(balances.totalAllocated.equals(Money.egp('400.00')), 'Total allocated is 400.00 EGP');
  assert(balances.totalUnallocatedCollections.equals(Money.egp('200.00')), 'Total unallocated is 200.00 EGP');
  assert(balances.totalRemainingDue.equals(Money.egp('600.00')), 'Total remaining due is 600.00 EGP');
  assert(
    balances.totalAllocated.add(balances.totalUnallocatedCollections).equals(balances.totalCollectionsReceived),
    'Conservation after partial allocation'
  );

  // Complete Obligation 1: Allocate remaining 100.00 EGP from receipt
  const allocRes2 = subLedger.allocate(
    {
      collectionId: 'rec_001',
      obligationId: 'ob_agr_std_001_1',
      amount: Money.egp('100.00')
    },
    'usr_cashier_1'
  );

  assert(!allocRes2.isReplay, 'Second allocation is not a replay');
  const ob1AfterAlloc2 = subLedger.obligations.get('ob_agr_std_001_1')!;
  assert(ob1AfterAlloc2.status === 'COLLECTED', 'Obligation transitioned to fully COLLECTED (settled)');
  assert(ob1AfterAlloc2.remainingDue.isZero(), 'Obligation remaining due is 0.00 EGP');

  // Allocate remaining 100.00 EGP to Obligation 2 (Fully consumes receipt)
  subLedger.allocate(
    {
      collectionId: 'rec_001',
      obligationId: 'ob_agr_std_001_2',
      amount: Money.egp('100.00')
    },
    'usr_cashier_1'
  );

  const trackedFinal = subLedger.receipts.get('rec_001')!;
  assert(trackedFinal.state === 'FULLY_ALLOCATED', 'Receipt transitioned to FULLY_ALLOCATED');
  assert(trackedFinal.unallocatedAmount.isZero(), 'Receipt unallocated is 0.00 EGP');
}

// -----------------------------------------------------------------------------
// Suite 3: Multi-Obligation Allocation & Multi-Receipt Consolidation
// -----------------------------------------------------------------------------
console.log('\n--- Suite 3: Multi-Obligation Allocation & Multi-Receipt Consolidation ---');
{
  const agreement = createStandardAgreement();
  const subLedger = new StudentSubLedger(agreement, 'usr_mgr_1');

  // 1 Receipt across multiple obligations
  const receipt1 = createReceipt({
    collectionId: 'rec_multi_1',
    amountCollected: Money.egp('700.00')
  });
  subLedger.recordCollection(receipt1, 'usr_cashier_1');

  const multiAllocs = subLedger.allocateMultiObligations(
    {
      collectionId: 'rec_multi_1',
      targets: [
        { obligationId: 'ob_agr_std_001_1', amount: Money.egp('500.00') },
        { obligationId: 'ob_agr_std_001_2', amount: Money.egp('200.00') }
      ]
    },
    'usr_cashier_1'
  );

  assert(multiAllocs.length === 2, '2 allocations created from single receipt');
  assert(subLedger.obligations.get('ob_agr_std_001_1')!.status === 'COLLECTED', 'Obligation 1 fully settled');
  assert(subLedger.obligations.get('ob_agr_std_001_2')!.remainingDue.equals(Money.egp('300.00')), 'Obligation 2 has 300.00 EGP due');

  // Multiple receipts against one obligation: Second receipt settling remaining 300.00 of Obligation 2
  const receipt2 = createReceipt({
    collectionId: 'rec_multi_2',
    amountCollected: Money.egp('300.00')
  });
  subLedger.recordCollection(receipt2, 'usr_cashier_1');

  subLedger.allocate(
    {
      collectionId: 'rec_multi_2',
      obligationId: 'ob_agr_std_001_2',
      amount: Money.egp('300.00')
    },
    'usr_cashier_1'
  );

  assert(subLedger.obligations.get('ob_agr_std_001_2')!.status === 'COLLECTED', 'Obligation 2 fully settled via 2 distinct receipts');
  assert(subLedger.getBalances().totalRemainingDue.isZero(), 'Agreement fully settled; remaining due is 0.00 EGP');
}

// -----------------------------------------------------------------------------
// Suite 4: Reversal Mechanics & State Machine Transitions
// -----------------------------------------------------------------------------
console.log('\n--- Suite 4: Reversal Mechanics & State Machine Transitions ---');
{
  const agreement = createStandardAgreement();
  const subLedger = new StudentSubLedger(agreement, 'usr_mgr_1');

  const receipt = createReceipt({
    collectionId: 'rec_rev_1',
    amountCollected: Money.egp('500.00')
  });
  subLedger.recordCollection(receipt, 'usr_cashier_1');

  const { allocation } = subLedger.allocate(
    {
      collectionId: 'rec_rev_1',
      obligationId: 'ob_agr_std_001_1',
      amount: Money.egp('500.00')
    },
    'usr_cashier_1'
  );

  assert(subLedger.obligations.get('ob_agr_std_001_1')!.status === 'COLLECTED', 'Obligation 1 settled');

  // Reverse Allocation
  const reversedAlloc = subLedger.reverseAllocation(
    allocation.allocationId,
    'usr_mgr_1',
    'Customer payment applied to wrong arrangement schedule'
  );

  assert(reversedAlloc.status === 'REVERSED', 'Allocation status transitioned to REVERSED');
  assert(reversedAlloc.reversalDetails?.reason.includes('wrong arrangement schedule') === true, 'Reversal reason recorded');

  const obAfterRev = subLedger.obligations.get('ob_agr_std_001_1')!;
  assert(obAfterRev.status === 'PENDING', 'Obligation status reverted to PENDING');
  assert(obAfterRev.remainingDue.equals(Money.egp('500.00')), 'Obligation remaining due restored to 500.00 EGP');

  const receiptAfterRev = subLedger.receipts.get('rec_rev_1')!;
  assert(receiptAfterRev.state === 'UNALLOCATED', 'Receipt state reverted to UNALLOCATED');
  assert(receiptAfterRev.unallocatedAmount.equals(Money.egp('500.00')), 'Receipt unallocated balance restored to 500.00 EGP');

  // Reverse the Collection Receipt
  const reversedReceipt = subLedger.reverseCollectionReceipt(
    'rec_rev_1',
    'usr_mgr_1',
    'Bounced cheque / fraudulent transaction cancelled'
  );

  assert(reversedReceipt.state === 'REVERSED', 'Receipt status transitioned to REVERSED');
  assert(subLedger.getBalances().totalCollectionsReceived.isZero(), 'Collections received drops to 0 after receipt reversal');
  assert(subLedger.getBalances().totalUnallocatedCollections.isZero(), 'Unallocated collections drops to 0');
}

// -----------------------------------------------------------------------------
// Suite 5: Idempotency & Replay Defense
// -----------------------------------------------------------------------------
console.log('\n--- Suite 5: Idempotency & Replay Defense ---');
{
  const agreement = createStandardAgreement();
  const subLedger = new StudentSubLedger(agreement, 'usr_mgr_1');

  const receipt = createReceipt({
    collectionId: 'rec_idem_1',
    amountCollected: Money.egp('500.00')
  });
  subLedger.recordCollection(receipt, 'usr_cashier_1');

  const idempKey = 'ALLOC_IDEMP_TEST_001';
  const alloc1 = subLedger.allocate(
    {
      collectionId: 'rec_idem_1',
      obligationId: 'ob_agr_std_001_1',
      amount: Money.egp('250.00'),
      idempotencyKey: idempKey
    },
    'usr_cashier_1'
  );

  assert(!alloc1.isReplay, 'First invocation is not replay');

  // Idempotent Replay with exact same parameters
  const allocReplay = subLedger.allocate(
    {
      collectionId: 'rec_idem_1',
      obligationId: 'ob_agr_std_001_1',
      amount: Money.egp('250.00'),
      idempotencyKey: idempKey
    },
    'usr_cashier_1'
  );

  assert(allocReplay.isReplay, 'Second invocation is marked isReplay: true');
  assert(allocReplay.allocation.allocationId === alloc1.allocation.allocationId, 'Same allocation record returned on replay');
  assert(subLedger.getBalances().totalAllocated.equals(Money.egp('250.00')), 'Total allocated remains exactly 250.00 EGP (no double allocation)');
}

// -----------------------------------------------------------------------------
// Suite 6: Student Lifecycle & Financial History Preservation
// -----------------------------------------------------------------------------
console.log('\n--- Suite 6: Student Lifecycle & Financial History Preservation ---');
{
  const agreement = createStandardAgreement();
  const subLedger = new StudentSubLedger(agreement, 'usr_mgr_1');

  const receipt = createReceipt({
    collectionId: 'rec_life_1',
    amountCollected: Money.egp('500.00')
  });
  subLedger.recordCollection(receipt, 'usr_cashier_1');

  subLedger.allocate(
    {
      collectionId: 'rec_life_1',
      obligationId: 'ob_agr_std_001_1',
      amount: Money.egp('500.00')
    },
    'usr_cashier_1'
  );

  const txCountBefore = subLedger.transactionHistory.length;

  // 1. Branch Transfer
  subLedger.transferBranch('br_alpha_alex', 'usr_mgr_1', 'Family relocated to Alexandria campus');
  assert(subLedger.branchId === 'br_alpha_alex', 'Sub-ledger branch updated to Alexandria');
  assert(subLedger.status === 'TRANSFERRED', 'Status transitioned to TRANSFERRED');
  assert(subLedger.getBalances().totalAllocated.equals(Money.egp('500.00')), 'Financial balances preserved after branch transfer');

  // 2. Group Transfer
  subLedger.transferGroup('grp_physics_sec1', 'usr_mgr_1', 'Academic schedule change');
  assert(subLedger.centerGroupId === 'grp_physics_sec1', 'Center group updated');
  assert(subLedger.getBalances().totalRemainingDue.equals(Money.egp('500.00')), 'Financial balances preserved after group transfer');

  // 3. Student Withdrawal
  subLedger.withdrawStudent('usr_mgr_1', 'Medical leave of absence');
  assert(subLedger.status === 'WITHDRAWN', 'Status transitioned to WITHDRAWN');
  assert(subLedger.transactionHistory.length === txCountBefore + 3, 'All lifecycle changes appended to transaction log');
  assert(subLedger.receipts.size === 1, 'Receipts preserved 100% after withdrawal');
  assert(subLedger.obligations.size === 2, 'Obligations preserved 100% after withdrawal');
  assert(subLedger.allocations.size === 1, 'Allocations preserved 100% after withdrawal');
}

// -----------------------------------------------------------------------------
// Suite 7: Negative Invariant & Security Rejection Tests
// -----------------------------------------------------------------------------
console.log('\n--- Suite 7: Negative Invariant & Security Rejection Tests ---');
{
  const agreement = createStandardAgreement();
  const subLedger = new StudentSubLedger(agreement, 'usr_mgr_1');

  // 1. Cross-institution receipt rejected
  assertThrows(
    () => {
      const foreignReceipt = createReceipt({
        collectionId: 'rec_foreign_inst',
        institutionId: 'inst_synth_beta'
      });
      subLedger.recordCollection(foreignReceipt, 'usr_cashier_1');
    },
    CrossInstitutionError,
    'Negative 1: Cross-institution receipt recording rejected'
  );

  // 2. Cross-student receipt rejected
  assertThrows(
    () => {
      const foreignStudentReceipt = createReceipt({
        collectionId: 'rec_foreign_stud',
        studentId: 'usr_student_charlie'
      });
      subLedger.recordCollection(foreignStudentReceipt, 'usr_cashier_1');
    },
    CrossStudentAllocationError,
    'Negative 2: Cross-student receipt recording rejected'
  );

  // 3. Duplicate receipt rejected
  const receiptValid = createReceipt({ collectionId: 'rec_valid_dup' });
  subLedger.recordCollection(receiptValid, 'usr_cashier_1');
  assertThrows(
    () => {
      subLedger.recordCollection(receiptValid, 'usr_cashier_1');
    },
    DuplicateReceiptError,
    'Negative 3: Duplicate collection receipt ID rejected'
  );

  // 4. Cross-branch allocation where prohibited (without explicit authorization)
  const subLedgerCairo = new StudentSubLedger(agreement, 'usr_mgr_1');
  assertThrows(
    () => {
      const r = createReceipt({ collectionId: 'rec_cb_1', branchId: 'br_alpha_other' });
      subLedgerCairo.recordCollection(r, 'usr_cashier_1');
      subLedgerCairo.allocate(
        {
          collectionId: 'rec_cb_1',
          obligationId: 'ob_agr_std_001_1',
          amount: Money.egp('100.00'),
          allowCrossBranchWithinInstitution: false
        },
        'usr_cashier_1'
      );
    },
    CrossBranchAllocationError,
    'Negative 4: Cross-branch allocation without explicit permission rejected'
  );

  // 5. Conflicting idempotency replay
  const idempKey2 = 'IDEMP_CONFLICT_TEST';
  subLedger.allocate(
    {
      collectionId: 'rec_valid_dup',
      obligationId: 'ob_agr_std_001_1',
      amount: Money.egp('100.00'),
      idempotencyKey: idempKey2
    },
    'usr_cashier_1'
  );

  assertThrows(
    () => {
      subLedger.allocate(
        {
          collectionId: 'rec_valid_dup',
          obligationId: 'ob_agr_std_001_1',
          amount: Money.egp('200.00'), // Conflict in amount
          idempotencyKey: idempKey2
        },
        'usr_cashier_1'
      );
    },
    ConflictingAllocationReplayError,
    'Negative 5: Idempotent replay with conflicting parameters rejected'
  );

  // 6. Allocation exceeding receipt balance
  assertThrows(
    () => {
      subLedger.allocate(
        {
          collectionId: 'rec_valid_dup',
          obligationId: 'ob_agr_std_001_1',
          amount: Money.egp('9999.00')
        },
        'usr_cashier_1'
      );
    },
    ExcessiveAllocationError,
    'Negative 6: Allocation exceeding unallocated receipt balance rejected'
  );

  // 7. Allocation exceeding obligation remaining balance
  // ob1 has 400.00 EGP remaining
  const rBig = createReceipt({ collectionId: 'rec_big_1', amountCollected: Money.egp('1000.00') });
  subLedger.recordCollection(rBig, 'usr_cashier_1');
  assertThrows(
    () => {
      subLedger.allocate(
        {
          collectionId: 'rec_big_1',
          obligationId: 'ob_agr_std_001_1',
          amount: Money.egp('450.00') // ob1 only needs 400
        },
        'usr_cashier_1'
      );
    },
    ExcessiveAllocationError,
    'Negative 7: Allocation exceeding obligation remaining due rejected'
  );

  // 8. Allocation to fully settled obligation rejected
  // First settle ob1 with 400.00
  subLedger.allocate(
    {
      collectionId: 'rec_big_1',
      obligationId: 'ob_agr_std_001_1',
      amount: Money.egp('400.00')
    },
    'usr_cashier_1'
  );
  assertThrows(
    () => {
      subLedger.allocate(
        {
          collectionId: 'rec_big_1',
          obligationId: 'ob_agr_std_001_1',
          amount: Money.egp('10.00')
        },
        'usr_cashier_1'
      );
    },
    IneligibleObligationError,
    'Negative 8: Allocation to fully settled obligation rejected'
  );

  // 9. Negative or zero allocation amount rejected
  assertThrows(
    () => {
      subLedger.allocate(
        {
          collectionId: 'rec_big_1',
          obligationId: 'ob_agr_std_001_2',
          amount: Money.egp('0.00')
        },
        'usr_cashier_1'
      );
    },
    InvalidAmountError,
    'Negative 9: Zero allocation amount rejected'
  );

  // 10. Allocating from a reversed receipt rejected
  const rToRev = createReceipt({ collectionId: 'rec_to_rev', amountCollected: Money.egp('200.00') });
  subLedger.recordCollection(rToRev, 'usr_cashier_1');
  subLedger.reverseCollectionReceipt('rec_to_rev', 'usr_mgr_1', 'Cancelled check');
  assertThrows(
    () => {
      subLedger.allocate(
        {
          collectionId: 'rec_to_rev',
          obligationId: 'ob_agr_std_001_2',
          amount: Money.egp('100.00')
        },
        'usr_cashier_1'
      );
    },
    InvalidLifecycleTransitionError,
    'Negative 10: Allocating from a reversed receipt rejected'
  );

  // 11. Reversing a receipt with active allocations rejected
  const rWithAlloc = createReceipt({ collectionId: 'rec_active_alloc', amountCollected: Money.egp('300.00') });
  subLedger.recordCollection(rWithAlloc, 'usr_cashier_1');
  const { allocation: activeAlloc } = subLedger.allocate(
    {
      collectionId: 'rec_active_alloc',
      obligationId: 'ob_agr_std_001_2',
      amount: Money.egp('200.00')
    },
    'usr_cashier_1'
  );
  assertThrows(
    () => {
      subLedger.reverseCollectionReceipt('rec_active_alloc', 'usr_mgr_1', 'Attempt reversal with active alloc');
    },
    InvalidLifecycleTransitionError,
    'Negative 11: Reversing collection receipt with active allocations rejected'
  );

  // 12. Reversing an already reversed allocation rejected
  subLedger.reverseAllocation(activeAlloc.allocationId, 'usr_mgr_1', 'First valid reversal');
  assertThrows(
    () => {
      subLedger.reverseAllocation(activeAlloc.allocationId, 'usr_mgr_1', 'Second reversal attempt');
    },
    DuplicateReversalError,
    'Negative 12: Reversing an already reversed allocation rejected'
  );

  // 13. Reversing an already reversed receipt rejected
  assertThrows(
    () => {
      subLedger.reverseCollectionReceipt('rec_to_rev', 'usr_mgr_1', 'Second reversal attempt');
    },
    DuplicateReversalError,
    'Negative 13: Reversing an already reversed collection receipt rejected'
  );

  // 14. Fee Collection / Allocation attempting to recognize revenue directly
  assertThrows(
    () => {
      subLedger.recognizeDirectRevenue();
    },
    PrematurePostingError,
    'Negative 14: Sub-ledger recognizeDirectRevenue throws PrematurePostingError'
  );

  // 15. Attempting to mutate deep-frozen records
  const rec = subLedger.allocations.get(activeAlloc.allocationId)!;
  assert(Object.isFrozen(rec), 'Negative 15: CollectionAllocationRecord is deep-frozen with Object.isFrozen');
  let threwMutationError = false;
  try {
    const mutator = new Function('rec', "'use strict'; rec.status = 'ACTIVE';");
    mutator(rec);
  } catch (err: any) {
    if (err instanceof TypeError) {
      threwMutationError = true;
    }
  }
  assert(threwMutationError, 'Negative 15: Runtime mutation of frozen CollectionAllocationRecord throws TypeError under strict mode');
  assert(rec.status === 'REVERSED', 'Negative 15: Frozen record status permanently preserved as REVERSED');
}

// -----------------------------------------------------------------------------
// Suite 8: Reconciliation & Audit Verification
// -----------------------------------------------------------------------------
console.log('\n--- Suite 8: Reconciliation & Audit Verification ---');
{
  const agreement = createStandardAgreement();
  const subLedger = new StudentSubLedger(agreement, 'usr_mgr_1');

  const receipt = createReceipt({
    collectionId: 'rec_recon_1',
    amountCollected: Money.egp('1000.00')
  });
  subLedger.recordCollection(receipt, 'usr_cashier_1');

  subLedger.allocate(
    {
      collectionId: 'rec_recon_1',
      obligationId: 'ob_agr_std_001_1',
      amount: Money.egp('500.00')
    },
    'usr_cashier_1'
  );

  const balances = subLedger.reconcile('usr_mgr_1');
  assert(balances.totalAgreedPrice.equals(Money.egp('1000.00')), 'Agreed price reconciled');
  assert(balances.totalAllocated.equals(Money.egp('500.00')), 'Allocated reconciled');
  assert(balances.totalUnallocatedCollections.equals(Money.egp('500.00')), 'Unallocated reconciled');
  assert(balances.totalRemainingDue.equals(Money.egp('500.00')), 'Remaining due reconciled');

  const reconEvents = subLedger.emittedEvents.filter(e => e.eventType === 'STUDENT_SUBLEDGER_RECONCILED');
  assert(reconEvents.length === 1, 'Reconciliation domain event emitted');
  assert(reconEvents[0].totalAllocated === '500.00 EGP', 'Event payload contains accurate totalAllocated');
}

console.log('\n===================================================================');
console.log(`INCREMENT 3 TEST RESULTS: ${passedTests} PASSED, ${failedTests} FAILED`);
console.log('===================================================================\n');

if (failedTests > 0) {
  process.exit(1);
}
