/**
 * OX-DIGITAL Education — Accounting Track Phase 2.0B
 * Increment 4 Test Suite: Cashbox Operations, Cash Movements & Daily Reconciliation Engine
 * Mode: Pure Domain Invariants (Zero DB, Zero Mocks)
 */

import { Money } from '../../packages/shared/src/accounting/money.js';
import {
  Cashbox,
  CashboxTransaction,
  CashboxTransfer,
  CashboxDailyReconciliation,
  CashboxTransferEngine
} from '../../packages/shared/src/accounting/center/cashbox.js';
import { CollectionReceiptEvidence } from '../../packages/shared/src/accounting/center/obligations.js';
import {
  StudentSubLedger
} from '../../packages/shared/src/accounting/center/subLedger.js';
import {
  AgreementPriceSnapshot,
  PaymentArrangementScheduleItem,
  StudentFinancialAgreement
} from '../../packages/shared/src/accounting/center/agreement.js';
import {
  InvalidAmountError,
  PrematurePostingError,
  InvalidEvidenceError,
  CrossInstitutionError,
  CrossBranchAllocationError,
  DuplicateReversalError,
  UnresolvedPolicyBlockedError,
  CashboxNotFoundError,
  InsufficientCashboxBalanceError,
  DuplicateCashboxTransactionError,
  SameCashboxTransferError,
  DuplicateReconciliationError,
  InvalidReconciliationBalanceError,
  MultiCurrencyDisabledError,
  InvalidLifecycleTransitionError,
  CashboxTransferImbalanceError
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
console.log('OX-DIGITAL Phase 2.0B — Increment 4: Cashbox Operations & Reconciliation Tests');
console.log('Mode: Pure Domain Cash Movements & UP-705 Reconciliation Invariants');
console.log(`Timestamp: ${new Date().toISOString()}`);
console.log('===================================================================\n');

// Standard Fixtures
function createTestCashbox(overrides: Partial<any> = {}): Cashbox {
  return new Cashbox({
    cashboxId: overrides.cashboxId || 'cb_cairo_reception_1',
    institutionId: overrides.institutionId || 'inst_synth_alpha',
    branchId: overrides.branchId || 'br_alpha_cairo',
    isPhysicalBranch: overrides.isPhysicalBranch !== undefined ? overrides.isPhysicalBranch : true,
    name: overrides.name || 'Cairo Reception Till 1',
    currency: 'EGP',
    status: overrides.status || 'ACTIVE',
    initialBalance: overrides.initialBalance || Money.zero('EGP'),
    createdByUserId: overrides.createdByUserId || 'usr_mgr_1'
  });
}

function createTestReceipt(overrides: Partial<any> = {}): CollectionReceiptEvidence {
  return new CollectionReceiptEvidence({
    collectionId: overrides.collectionId || `rec_${Date.now()}_${Math.random()}`,
    institutionId: overrides.institutionId || 'inst_synth_alpha',
    branchId: overrides.branchId || 'br_alpha_cairo',
    isPhysicalBranch: true,
    cashboxId: overrides.cashboxId || 'cb_cairo_reception_1',
    cashierUserId: overrides.cashierUserId || 'usr_cashier_1',
    cashierRole: overrides.cashierRole || 'CASHIER',
    studentId: overrides.studentId || 'usr_student_alpha',
    amountCollected: overrides.amountCollected || Money.egp('500.00'),
    collectedAt: overrides.collectedAt || new Date('2026-11-03T10:00:00Z'),
    receiptNumber: overrides.receiptNumber || 'REC-CAIRO-001',
    paymentMethod: overrides.paymentMethod || 'CASH'
  });
}

// -----------------------------------------------------------------------------
// Suite 1: Cashbox Initialization & Multi-Cashbox Branch Support
// -----------------------------------------------------------------------------
console.log('--- Suite 1: Cashbox Initialization & Multi-Cashbox Branch Support ---');
{
  const cb1 = createTestCashbox({
    cashboxId: 'cb_cairo_till_1',
    name: 'Cairo Front Till 1',
    initialBalance: Money.egp('500.00')
  });

  const cb2 = createTestCashbox({
    cashboxId: 'cb_cairo_safe_vault',
    name: 'Cairo Campus Main Vault',
    initialBalance: Money.egp('5000.00')
  });

  assert(cb1.cashboxId === 'cb_cairo_till_1', 'Cashbox 1 identity verified');
  assert(cb1.institutionId === 'inst_synth_alpha', 'Cashbox 1 institution verified');
  assert(cb1.branchId === 'br_alpha_cairo', 'Cashbox 1 branch verified');
  assert(cb1.currentBalance.equals(Money.egp('500.00')), 'Cashbox 1 initial balance verified');
  assert(cb1.status === 'ACTIVE', 'Cashbox 1 status is ACTIVE');

  assert(cb2.cashboxId === 'cb_cairo_safe_vault', 'Cashbox 2 identity verified');
  assert(cb2.currentBalance.equals(Money.egp('5000.00')), 'Cashbox 2 initial balance verified');
  assert(cb1.branchId === cb2.branchId, 'Multiple independent cashboxes supported in same branch');

  assert(cb1.emittedEvents.some(e => e.eventType === 'CASHBOX_CREATED'), 'Cashbox creation event emitted');
}

// -----------------------------------------------------------------------------
// Suite 2: Actual Cash Collections Linked to Sub-Ledger Receipts
// -----------------------------------------------------------------------------
console.log('\n--- Suite 2: Actual Cash Collections Linked to Sub-Ledger Receipts ---');
{
  const cashbox = createTestCashbox();
  const receipt = createTestReceipt({
    collectionId: 'rec_link_001',
    amountCollected: Money.egp('750.00'),
    receiptNumber: 'REC-001'
  });

  const tx = cashbox.recordCollection(receipt, 'usr_cashier_1', 'CASHIER', '2026-11-03');

  assert(tx.type === 'COLLECTION', 'Transaction type is COLLECTION');
  assert(tx.amount.equals(Money.egp('750.00')), 'Transaction amount is 750.00 EGP');
  assert(tx.balanceAfter.equals(Money.egp('750.00')), 'Cashbox balance updated to 750.00 EGP');
  assert(tx.referenceId === 'rec_link_001', 'Directly links to receipt.collectionId');
  assert(tx.businessDate === '2026-11-03', 'Business date accurately recorded');
  assert(cashbox.currentBalance.equals(Money.egp('750.00')), 'Cashbox current balance is 750.00 EGP');

  // Verify revenue recognition decoupling
  const event = cashbox.emittedEvents.find(e => e.eventType === 'CASHBOX_COLLECTION_RECORDED');
  assert(event !== undefined, 'CashboxCollectionRecordedEvent emitted');
  assert(event.revenueRecognized === false, 'Revenue recognition explicitly remains false');
}

// -----------------------------------------------------------------------------
// Suite 3: Cash Expenses & Non-Negative Balance Enforcement
// -----------------------------------------------------------------------------
console.log('\n--- Suite 3: Cash Expenses & Non-Negative Balance Enforcement ---');
{
  const cashbox = createTestCashbox({ initialBalance: Money.egp('1000.00') });

  const expenseTx = cashbox.recordExpense(
    {
      voucherNumber: 'VOUCHER-OFFICE-01',
      amount: Money.egp('250.00'),
      reason: 'Emergency whiteboard markers & stationery',
      businessDate: '2026-11-03'
    },
    'usr_cashier_1',
    'CASHIER'
  );

  assert(expenseTx.type === 'EXPENSE', 'Expense transaction recorded');
  assert(expenseTx.amount.equals(Money.egp('250.00')), 'Expense amount is 250.00 EGP');
  assert(expenseTx.balanceAfter.equals(Money.egp('750.00')), 'Cashbox balance decreased to 750.00 EGP');
  assert(cashbox.currentBalance.equals(Money.egp('750.00')), 'Cashbox balance matches 750.00 EGP');
}

// -----------------------------------------------------------------------------
// Suite 4: Inter-Cashbox Funds Transfers & Atomic Two-Sided Rollback
// -----------------------------------------------------------------------------
console.log('\n--- Suite 4: Inter-Cashbox Funds Transfers & Atomic Two-Sided Rollback ---');
{
  const sourceTill = createTestCashbox({
    cashboxId: 'cb_source_till',
    name: 'Source Till',
    initialBalance: Money.egp('2000.00')
  });

  const destVault = createTestCashbox({
    cashboxId: 'cb_dest_vault',
    name: 'Destination Vault',
    initialBalance: Money.egp('500.00')
  });

  // 1. Successful transfer changes both balances by exactly the same amount
  const transfer = CashboxTransferEngine.executeTransfer({
    transferId: 'txfr_successful_001',
    sourceCashbox: sourceTill,
    destinationCashbox: destVault,
    amount: Money.egp('1200.00'),
    businessDate: '2026-11-03',
    actorUserId: 'usr_mgr_1',
    actorRole: 'PRIMARY_MANAGER'
  });

  assert(transfer.status === 'EXECUTED', 'Transfer status is EXECUTED');
  assert(transfer.amount.equals(Money.egp('1200.00')), 'Transfer amount is 1200.00 EGP');
  assert(sourceTill.currentBalance.equals(Money.egp('800.00')), 'Source till balance reduced from 2000 to 800 EGP');
  assert(destVault.currentBalance.equals(Money.egp('1700.00')), 'Destination vault balance increased from 500 to 1700 EGP');

  const sourceMovement = sourceTill.transactions.get(transfer.sourceTransactionId)!;
  const destMovement = destVault.transactions.get(transfer.destinationTransactionId)!;

  assert(sourceMovement.type === 'TRANSFER_OUT', 'Source movement is TRANSFER_OUT');
  assert(destMovement.type === 'TRANSFER_IN', 'Destination movement is TRANSFER_IN');
  assert(sourceMovement.amount.equals(destMovement.amount), 'Exact conservation: source amount equals dest amount');

  // 2. Duplicate transfer attempts cannot create additional movements
  assertThrows(
    () => {
      CashboxTransferEngine.executeTransfer({
        transferId: 'txfr_successful_001',
        sourceCashbox: sourceTill,
        destinationCashbox: destVault,
        amount: Money.egp('100.00'),
        businessDate: '2026-11-03',
        actorUserId: 'usr_mgr_1',
        actorRole: 'PRIMARY_MANAGER'
      });
    },
    DuplicateCashboxTransactionError,
    'Duplicate transfer execution is rejected'
  );
  assert(sourceTill.currentBalance.equals(Money.egp('800.00')), 'Source balance unchanged on duplicate transfer attempt');
  assert(destVault.currentBalance.equals(Money.egp('1700.00')), 'Dest balance unchanged on duplicate transfer attempt');

  // Pre-validation failure: Inactive destination cashbox rejects transfer without mutating source
  const inactiveDest = createTestCashbox({
    cashboxId: 'cb_dest_inactive',
    status: 'INACTIVE',
    initialBalance: Money.egp('100.00')
  });
  const sourceBalBeforeInactive = sourceTill.currentBalance;
  const sourceTxCountBeforeInactive = sourceTill.transactions.size;

  assertThrows(
    () => {
      CashboxTransferEngine.executeTransfer({
        sourceCashbox: sourceTill,
        destinationCashbox: inactiveDest,
        amount: Money.egp('200.00'),
        businessDate: '2026-11-03',
        actorUserId: 'usr_mgr_1',
        actorRole: 'PRIMARY_MANAGER'
      });
    },
    InvalidLifecycleTransitionError,
    'Transfer to INACTIVE destination rejected during pre-validation'
  );
  assert(sourceTill.currentBalance.equals(sourceBalBeforeInactive), 'Source balance untouched when destination inactive');
  assert(sourceTill.transactions.size === sourceTxCountBeforeInactive, 'No dangling source transaction when destination inactive');

  // Pre-validation failure: Suspended destination cashbox rejects transfer without mutating source
  const suspendedDest = createTestCashbox({
    cashboxId: 'cb_dest_suspended',
    status: 'SUSPENDED',
    initialBalance: Money.egp('100.00')
  });

  assertThrows(
    () => {
      CashboxTransferEngine.executeTransfer({
        sourceCashbox: sourceTill,
        destinationCashbox: suspendedDest,
        amount: Money.egp('200.00'),
        businessDate: '2026-11-03',
        actorUserId: 'usr_mgr_1',
        actorRole: 'PRIMARY_MANAGER'
      });
    },
    InvalidLifecycleTransitionError,
    'Transfer to SUSPENDED destination rejected during pre-validation'
  );
  assert(sourceTill.currentBalance.equals(sourceBalBeforeInactive), 'Source balance untouched when destination suspended');
  assert(sourceTill.transactions.size === sourceTxCountBeforeInactive, 'No dangling source transaction when destination suspended');

  // Failure Path 1: Destination movement failure leaves both cashboxes unchanged
  {
    const sBalBefore = sourceTill.currentBalance;
    const dBalBefore = destVault.currentBalance;
    const sTxIdsBefore = Array.from(sourceTill.transactions.keys());
    const dTxIdsBefore = Array.from(destVault.transactions.keys());
    const testTransferId = 'txfr_fail_path_1';

    CashboxTransferEngine._faultInjector = (stage) => {
      if (stage === 'AFTER_SOURCE') throw new Error('Fault Injection: Destination movement failed');
    };

    assertThrows(
      () => {
        CashboxTransferEngine.executeTransfer({
          transferId: testTransferId,
          sourceCashbox: sourceTill,
          destinationCashbox: destVault,
          amount: Money.egp('100.00'),
          businessDate: '2026-11-03',
          actorUserId: 'usr_mgr_1',
          actorRole: 'PRIMARY_MANAGER'
        });
      },
      Error,
      'Failure Path 1: Destination failure caught and rolled back'
    );
    CashboxTransferEngine._faultInjector = undefined;

    assert(sourceTill.currentBalance.equals(sBalBefore), 'Path 1: Source balance restored');
    assert(destVault.currentBalance.equals(dBalBefore), 'Path 1: Destination balance restored');
    assert(sourceTill.transactions.size === sTxIdsBefore.length, 'Path 1: Source transaction count unchanged');
    assert(JSON.stringify(Array.from(sourceTill.transactions.keys())) === JSON.stringify(sTxIdsBefore), 'Path 1: Source transaction IDs unchanged');
    assert(destVault.transactions.size === dTxIdsBefore.length, 'Path 1: Destination transaction count unchanged');
    assert(JSON.stringify(Array.from(destVault.transactions.keys())) === JSON.stringify(dTxIdsBefore), 'Path 1: Destination transaction IDs unchanged');
    assert(CashboxTransferEngine.getTransfer(testTransferId) === undefined, 'Path 1: Transfer not registered in history');
  }

  // Failure Path 2: Conservation-check failure after both movements applied restores both cashboxes
  {
    const sBalBefore = sourceTill.currentBalance;
    const dBalBefore = destVault.currentBalance;
    const sTxIdsBefore = Array.from(sourceTill.transactions.keys());
    const dTxIdsBefore = Array.from(destVault.transactions.keys());
    const testTransferId = 'txfr_fail_path_2';

    // Simulate destination returning an amount mismatch to trigger CashboxTransferImbalanceError
    const originalApply = destVault._applyTransferMovement.bind(destVault);
    (destVault as any)._applyTransferMovement = (...args: any[]) => {
      const realTx = originalApply(...args);
      return new CashboxTransaction({
        transactionId: realTx.transactionId,
        cashboxId: realTx.cashboxId,
        institutionId: realTx.institutionId,
        branchId: realTx.branchId,
        type: realTx.type,
        amount: Money.egp('9999.00'), // Tampered amount to trigger conservation failure
        balanceAfter: realTx.balanceAfter,
        businessDate: realTx.businessDate,
        timestamp: realTx.timestamp,
        actorUserId: realTx.actorUserId,
        actorRole: realTx.actorRole,
        referenceId: realTx.referenceId,
        notes: realTx.notes,
        status: realTx.status
      });
    };

    assertThrows(
      () => {
        CashboxTransferEngine.executeTransfer({
          transferId: testTransferId,
          sourceCashbox: sourceTill,
          destinationCashbox: destVault,
          amount: Money.egp('150.00'),
          businessDate: '2026-11-03',
          actorUserId: 'usr_mgr_1',
          actorRole: 'PRIMARY_MANAGER'
        });
      },
      CashboxTransferImbalanceError,
      'Failure Path 2: Conservation check failure triggers two-sided rollback'
    );
    (destVault as any)._applyTransferMovement = originalApply;

    assert(sourceTill.currentBalance.equals(sBalBefore), 'Path 2: Source balance restored after conservation failure');
    assert(destVault.currentBalance.equals(dBalBefore), 'Path 2: Destination balance restored after conservation failure');
    assert(sourceTill.transactions.size === sTxIdsBefore.length, 'Path 2: Source transaction count unchanged');
    assert(JSON.stringify(Array.from(sourceTill.transactions.keys())) === JSON.stringify(sTxIdsBefore), 'Path 2: Source transaction IDs unchanged');
    assert(destVault.transactions.size === dTxIdsBefore.length, 'Path 2: Destination transaction count unchanged');
    assert(JSON.stringify(Array.from(destVault.transactions.keys())) === JSON.stringify(dTxIdsBefore), 'Path 2: Destination transaction IDs unchanged');
    assert(CashboxTransferEngine.getTransfer(testTransferId) === undefined, 'Path 2: Transfer not registered in history');
  }

  // Failure Path 3: Transfer record construction failure restores both cashboxes
  {
    const sBalBefore = sourceTill.currentBalance;
    const dBalBefore = destVault.currentBalance;
    const sTxIdsBefore = Array.from(sourceTill.transactions.keys());
    const dTxIdsBefore = Array.from(destVault.transactions.keys());
    const testTransferId = 'txfr_fail_path_3';

    CashboxTransferEngine._faultInjector = (stage) => {
      if (stage === 'BEFORE_RECORD') throw new Error('Fault Injection: CashboxTransfer constructor failed');
    };

    assertThrows(
      () => {
        CashboxTransferEngine.executeTransfer({
          transferId: testTransferId,
          sourceCashbox: sourceTill,
          destinationCashbox: destVault,
          amount: Money.egp('100.00'),
          businessDate: '2026-11-03',
          actorUserId: 'usr_mgr_1',
          actorRole: 'PRIMARY_MANAGER'
        });
      },
      Error,
      'Failure Path 3: Transfer record construction failure caught and rolled back'
    );
    CashboxTransferEngine._faultInjector = undefined;

    assert(sourceTill.currentBalance.equals(sBalBefore), 'Path 3: Source balance restored');
    assert(destVault.currentBalance.equals(dBalBefore), 'Path 3: Destination balance restored');
    assert(sourceTill.transactions.size === sTxIdsBefore.length, 'Path 3: Source transaction count unchanged');
    assert(destVault.transactions.size === dTxIdsBefore.length, 'Path 3: Destination transaction count unchanged');
    assert(CashboxTransferEngine.getTransfer(testTransferId) === undefined, 'Path 3: Transfer not registered in history');
  }

  // Failure Path 4: Transfer history registration failure does not leave either cashbox changed
  {
    const sBalBefore = sourceTill.currentBalance;
    const dBalBefore = destVault.currentBalance;
    const sTxIdsBefore = Array.from(sourceTill.transactions.keys());
    const dTxIdsBefore = Array.from(destVault.transactions.keys());
    const testTransferId = 'txfr_fail_path_4';

    CashboxTransferEngine._faultInjector = (stage) => {
      if (stage === 'BEFORE_HISTORY') throw new Error('Fault Injection: Transfer history registration failed');
    };

    assertThrows(
      () => {
        CashboxTransferEngine.executeTransfer({
          transferId: testTransferId,
          sourceCashbox: sourceTill,
          destinationCashbox: destVault,
          amount: Money.egp('100.00'),
          businessDate: '2026-11-03',
          actorUserId: 'usr_mgr_1',
          actorRole: 'PRIMARY_MANAGER'
        });
      },
      Error,
      'Failure Path 4: History registration failure caught and rolled back'
    );
    CashboxTransferEngine._faultInjector = undefined;

    assert(sourceTill.currentBalance.equals(sBalBefore), 'Path 4: Source balance restored');
    assert(destVault.currentBalance.equals(dBalBefore), 'Path 4: Destination balance restored');
    assert(sourceTill.transactions.size === sTxIdsBefore.length, 'Path 4: Source transaction count unchanged');
    assert(destVault.transactions.size === dTxIdsBefore.length, 'Path 4: Destination transaction count unchanged');
    assert(CashboxTransferEngine.getTransfer(testTransferId) === undefined, 'Path 4: Transfer not in history');
  }
}

// -----------------------------------------------------------------------------
// Suite 5: Append-Only Compensating Reversals (Collections, Expenses & Transfers)
// -----------------------------------------------------------------------------
console.log('\n--- Suite 5: Append-Only Compensating Reversals ---');
{
  const cashbox = createTestCashbox({ initialBalance: Money.egp('500.00') });
  const receipt = createTestReceipt({
    collectionId: 'rec_to_rev_cash',
    amountCollected: Money.egp('300.00'),
    receiptNumber: 'REC-REV-01'
  });

  const colTx = cashbox.recordCollection(receipt, 'usr_cashier_1', 'CASHIER', '2026-11-03');
  assert(cashbox.currentBalance.equals(Money.egp('800.00')), 'Balance is 800 EGP after collection');

  // Reverse collection
  const revTx = cashbox.reverseMovement(colTx.transactionId, 'usr_accountant_1', 'ACCOUNTANT', 'Bounced receipt reversal');
  assert(revTx.type === 'COLLECTION_REVERSED', 'Reversal movement type is COLLECTION_REVERSED');
  assert(revTx.amount.equals(Money.egp('300.00')), 'Reversal amount is 300 EGP');
  assert(cashbox.currentBalance.equals(Money.egp('500.00')), 'Balance restored to 500 EGP');

  const originalAfterRev = cashbox.transactions.get(colTx.transactionId)!;
  assert(originalAfterRev.status === 'POSTED', 'Original transaction status remains POSTED (append-only immutability)');
  assert(cashbox.isMovementReversed(colTx.transactionId) === true, 'Reversal index records original transaction as reversed');
  const compensating = cashbox.getReversalFor(colTx.transactionId)!;
  assert(compensating !== undefined && compensating.transactionId === revTx.transactionId, 'Compensating transaction retrievable via getReversalFor');
  assert(compensating.notes?.includes('Bounced receipt') === true, 'Audit reason preserved in compensating movement');

  // Reverse an expense
  const expTx = cashbox.recordExpense(
    {
      voucherNumber: 'VOUCHER-CANCEL',
      amount: Money.egp('100.00'),
      reason: 'Cancelled supplier advance',
      businessDate: '2026-11-03'
    },
    'usr_cashier_1',
    'CASHIER'
  );
  assert(cashbox.currentBalance.equals(Money.egp('400.00')), 'Balance after expense is 400 EGP');

  const revExpTx = cashbox.reverseMovement(expTx.transactionId, 'usr_accountant_1', 'ACCOUNTANT', 'Supplier refund received');
  assert(cashbox.currentBalance.equals(Money.egp('500.00')), 'Balance restored to 500 EGP after expense reversal');
  assert(cashbox.isMovementReversed(expTx.transactionId) === true, 'Expense movement indexed as reversed');
  assert(cashbox.getReversalFor(expTx.transactionId)?.transactionId === revExpTx.transactionId, 'Expense reversal retrievable');
  assert(cashbox.transactions.get(expTx.transactionId)!.status === 'POSTED', 'Original expense transaction status remains POSTED');

  // Reverse inter-cashbox transfer movements and verify append-only history preservation
  const xferSource = createTestCashbox({
    cashboxId: 'cb_xfer_rev_src',
    initialBalance: Money.egp('1000.00')
  });
  const xferDest = createTestCashbox({
    cashboxId: 'cb_xfer_rev_dst',
    initialBalance: Money.egp('500.00')
  });

  const executedXfer = CashboxTransferEngine.executeTransfer({
    transferId: 'txfr_to_reverse_001',
    sourceCashbox: xferSource,
    destinationCashbox: xferDest,
    amount: Money.egp('400.00'),
    businessDate: '2026-11-03',
    actorUserId: 'usr_mgr_1',
    actorRole: 'PRIMARY_MANAGER'
  });

  assert(xferSource.currentBalance.equals(Money.egp('600.00')), 'Source balance is 600 after transfer');
  assert(xferDest.currentBalance.equals(Money.egp('900.00')), 'Dest balance is 900 after transfer');

  // Reverse source TRANSFER_OUT: puts 400 back into source
  const srcRev = xferSource.reverseMovement(
    executedXfer.sourceTransactionId,
    'usr_accountant_1',
    'ACCOUNTANT',
    'Transfer cancelled by manager'
  );
  assert(srcRev.type === 'TRANSFER_REVERSED', 'Source reversal movement type is TRANSFER_REVERSED');
  assert(xferSource.currentBalance.equals(Money.egp('1000.00')), 'Source balance restored to 1000 EGP');
  assert(xferSource.transactions.get(executedXfer.sourceTransactionId)!.status === 'POSTED', 'Original source transfer movement remains POSTED');
  assert(xferSource.isMovementReversed(executedXfer.sourceTransactionId) === true, 'Source transfer marked as reversed in index');

  // Reverse dest TRANSFER_IN: takes 400 back out of dest
  const dstRev = xferDest.reverseMovement(
    executedXfer.destinationTransactionId,
    'usr_accountant_1',
    'ACCOUNTANT',
    'Transfer cancelled by manager'
  );
  assert(dstRev.type === 'TRANSFER_REVERSED', 'Dest reversal movement type is TRANSFER_REVERSED');
  assert(xferDest.currentBalance.equals(Money.egp('500.00')), 'Dest balance restored to 500 EGP');
  assert(xferDest.transactions.get(executedXfer.destinationTransactionId)!.status === 'POSTED', 'Original dest transfer movement remains POSTED');
  assert(xferDest.isMovementReversed(executedXfer.destinationTransactionId) === true, 'Dest transfer marked as reversed in index');
}

// -----------------------------------------------------------------------------
// Suite 6: Daily Reconciliation & UP-705 Discrepancy Invariants
// -----------------------------------------------------------------------------
console.log('\n--- Suite 6: Daily Reconciliation & UP-705 Discrepancy Invariants ---');
{
  const cashbox = createTestCashbox({
    cashboxId: 'cb_recon_cairo',
    initialBalance: Money.egp('1000.00')
  });

  // Collections: 500 EGP
  const receipt = createTestReceipt({
    collectionId: 'rec_recon_day',
    cashboxId: 'cb_recon_cairo',
    amountCollected: Money.egp('500.00'),
    receiptNumber: 'REC-RECON-1'
  });
  cashbox.recordCollection(receipt, 'usr_cashier_1', 'CASHIER', '2026-11-03');

  // Expense: 200 EGP
  cashbox.recordExpense(
    {
      voucherNumber: 'EXP-RECON-1',
      amount: Money.egp('200.00'),
      reason: 'Classroom stationery',
      businessDate: '2026-11-03'
    },
    'usr_cashier_1',
    'CASHIER'
  );

  // Expected Closing = Opening (1000) + Col (500) - Exp (200) = 1300 EGP
  // 1. Balanced Case: Actual Counted === 1300.00 EGP
  const balancedRecon = cashbox.reconcileDaily(
    {
      businessDate: '2026-11-03',
      openingBalance: Money.egp('1000.00'),
      actualCountedClosingBalance: Money.egp('1300.00')
    },
    'usr_mgr_1'
  );

  assert(balancedRecon.expectedClosingBalance.equals(Money.egp('1300.00')), 'Expected closing balance is 1300.00 EGP');
  assert(balancedRecon.actualCountedClosingBalance.equals(Money.egp('1300.00')), 'Actual counted is 1300.00 EGP');
  assert(balancedRecon.difference.isZero(), 'Difference is zero');
  assert(balancedRecon.status === 'BALANCED', 'Reconciliation status is BALANCED');

  // 2. Discrepancy Case: Shortage & Surplus on another cashbox
  const cbShortage = createTestCashbox({ cashboxId: 'cb_shortage_test', initialBalance: Money.egp('1000.00') });
  const shortageRecon = cbShortage.reconcileDaily(
    {
      businessDate: '2026-11-03',
      openingBalance: Money.egp('1000.00'),
      actualCountedClosingBalance: Money.egp('950.00') // 50 EGP shortage
    },
    'usr_mgr_1'
  );

  assert(shortageRecon.difference.equals(Money.egp('-50.00')), 'Difference is -50.00 EGP (shortage)');
  assert(shortageRecon.status === 'DISCREPANCY_PENDING_INVESTIGATION', 'Status is DISCREPANCY_PENDING_INVESTIGATION');

  const cbSurplus = createTestCashbox({ cashboxId: 'cb_surplus_test', initialBalance: Money.egp('1000.00') });
  const surplusRecon = cbSurplus.reconcileDaily(
    {
      businessDate: '2026-11-03',
      openingBalance: Money.egp('1000.00'),
      actualCountedClosingBalance: Money.egp('1050.00') // 50 EGP surplus
    },
    'usr_mgr_1'
  );

  assert(surplusRecon.difference.equals(Money.egp('50.00')), 'Difference is +50.00 EGP (surplus)');
  assert(surplusRecon.status === 'DISCREPANCY_PENDING_INVESTIGATION', 'Surplus status is DISCREPANCY_PENDING_INVESTIGATION');
}

// -----------------------------------------------------------------------------
// Suite 7: Consecutive Business Day Balance Continuity
// -----------------------------------------------------------------------------
console.log('\n--- Suite 7: Consecutive Business Day Balance Continuity ---');
{
  const cashbox = createTestCashbox({ initialBalance: Money.egp('1000.00') });

  // Day 1: 2026-11-03
  cashbox.reconcileDaily(
    {
      businessDate: '2026-11-03',
      openingBalance: Money.egp('1000.00'),
      actualCountedClosingBalance: Money.egp('1000.00')
    },
    'usr_mgr_1'
  );

  // Day 2 valid continuity: Day 2 opening balance equals Day 1 closing balance
  const day2Recon = cashbox.reconcileDaily(
    {
      businessDate: '2026-11-04',
      openingBalance: Money.egp('1000.00'), // matches Day 1 closing
      actualCountedClosingBalance: Money.egp('1000.00')
    },
    'usr_mgr_1'
  );

  assert(day2Recon.businessDate === '2026-11-04', 'Day 2 reconciled with continuity');

  // Day 3 continuity failure: Mismatched opening balance throws error
  assertThrows(
    () => {
      cashbox.reconcileDaily(
        {
          businessDate: '2026-11-05',
          openingBalance: Money.egp('1200.00'), // mismatch against Day 2 closing (1000.00)
          actualCountedClosingBalance: Money.egp('1200.00')
        },
        'usr_mgr_1'
      );
    },
    InvalidReconciliationBalanceError,
    'Mismatched opening balance on contiguous business day rejected'
  );
}

// -----------------------------------------------------------------------------
// Suite 8: Negative Invariant & Security Rejection Tests (20+ Scenarios)
// -----------------------------------------------------------------------------
console.log('\n--- Suite 8: Negative Invariant & Security Rejection Tests ---');
{
  const cb = createTestCashbox({
    cashboxId: 'cb_neg_cairo',
    initialBalance: Money.egp('500.00')
  });

  // 1. Cross-institution cashbox collection rejected
  assertThrows(
    () => {
      const foreignReceipt = createTestReceipt({
        collectionId: 'rec_foreign_inst_cb',
        institutionId: 'inst_synth_beta',
        cashboxId: 'cb_neg_cairo'
      });
      cb.recordCollection(foreignReceipt, 'usr_cashier_1', 'CASHIER');
    },
    CrossInstitutionError,
    'Negative 1: Cross-institution cashbox receipt rejected'
  );

  // 2. Cross-branch cashbox access rejected
  assertThrows(
    () => {
      const foreignBranchReceipt = createTestReceipt({
        collectionId: 'rec_foreign_br_cb',
        branchId: 'br_alpha_alex',
        cashboxId: 'cb_neg_cairo'
      });
      cb.recordCollection(foreignBranchReceipt, 'usr_cashier_1', 'CASHIER');
    },
    CrossBranchAllocationError,
    'Negative 2: Cross-branch cashbox receipt rejected'
  );

  // 3. Receipt cashboxId mismatch rejected
  assertThrows(
    () => {
      const mismatchedReceipt = createTestReceipt({
        collectionId: 'rec_mismatch_cb',
        cashboxId: 'cb_other_till'
      });
      cb.recordCollection(mismatchedReceipt, 'usr_cashier_1', 'CASHIER');
    },
    InvalidEvidenceError,
    'Negative 3: Receipt cashboxId mismatch rejected'
  );

  // 4. Duplicate receipt registration rejected
  const rValid = createTestReceipt({
    collectionId: 'rec_valid_single',
    cashboxId: 'cb_neg_cairo',
    amountCollected: Money.egp('100.00')
  });
  cb.recordCollection(rValid, 'usr_cashier_1', 'CASHIER', '2026-11-03');

  assertThrows(
    () => {
      cb.recordCollection(rValid, 'usr_cashier_1', 'CASHIER', '2026-11-03');
    },
    DuplicateCashboxTransactionError,
    'Negative 4: Duplicate receipt registration in cashbox rejected'
  );

  // 5. Expense exceeding cashbox balance rejected (balance cannot go negative)
  assertThrows(
    () => {
      cb.recordExpense(
        {
          voucherNumber: 'EXP-TOO-BIG',
          amount: Money.egp('9999.00'), // balance is 600
          reason: 'Excessive expense',
          businessDate: '2026-11-03'
        },
        'usr_cashier_1',
        'CASHIER'
      );
    },
    InsufficientCashboxBalanceError,
    'Negative 5: Expense exceeding cashbox balance rejected'
  );

  // 6. Zero or negative expense rejected
  assertThrows(
    () => {
      cb.recordExpense(
        {
          voucherNumber: 'EXP-ZERO',
          amount: Money.egp('0.00'),
          reason: 'Zero expense',
          businessDate: '2026-11-03'
        },
        'usr_cashier_1',
        'CASHIER'
      );
    },
    InvalidAmountError,
    'Negative 6: Zero expense amount rejected'
  );

  // 7. Transfer to same cashbox rejected
  assertThrows(
    () => {
      CashboxTransferEngine.executeTransfer({
        sourceCashbox: cb,
        destinationCashbox: cb,
        amount: Money.egp('100.00'),
        businessDate: '2026-11-03',
        actorUserId: 'usr_mgr_1',
        actorRole: 'PRIMARY_MANAGER'
      });
    },
    SameCashboxTransferError,
    'Negative 7: Transfer to same cashbox rejected'
  );

  // 8. Cross-institution transfer rejected
  const foreignCb = createTestCashbox({
    cashboxId: 'cb_foreign_inst',
    institutionId: 'inst_synth_beta',
    branchId: 'br_beta_alex'
  });

  assertThrows(
    () => {
      CashboxTransferEngine.executeTransfer({
        sourceCashbox: cb,
        destinationCashbox: foreignCb,
        amount: Money.egp('100.00'),
        businessDate: '2026-11-03',
        actorUserId: 'usr_mgr_1',
        actorRole: 'PRIMARY_MANAGER'
      });
    },
    CrossInstitutionError,
    'Negative 8: Cross-institution transfer rejected'
  );

  // 9. Transfer exceeding source balance rejected
  const destCb = createTestCashbox({ cashboxId: 'cb_dest_ok' });
  assertThrows(
    () => {
      CashboxTransferEngine.executeTransfer({
        sourceCashbox: cb,
        destinationCashbox: destCb,
        amount: Money.egp('50000.00'), // cb balance is 600
        businessDate: '2026-11-03',
        actorUserId: 'usr_mgr_1',
        actorRole: 'PRIMARY_MANAGER'
      });
    },
    InsufficientCashboxBalanceError,
    'Negative 9: Transfer exceeding source balance rejected'
  );

  // 10. Duplicate daily reconciliation rejected
  cb.reconcileDaily(
    {
      businessDate: '2026-11-03',
      openingBalance: Money.egp('500.00'),
      actualCountedClosingBalance: Money.egp('600.00')
    },
    'usr_mgr_1'
  );

  assertThrows(
    () => {
      cb.reconcileDaily(
        {
          businessDate: '2026-11-03',
          openingBalance: Money.egp('500.00'),
          actualCountedClosingBalance: Money.egp('600.00')
        },
        'usr_mgr_1'
      );
    },
    DuplicateReconciliationError,
    'Negative 10: Duplicate daily reconciliation on same business date rejected'
  );

  // 11. UP-705 Shortage write-off attempt blocked
  const reconShortage = new CashboxDailyReconciliation({
    reconciliationId: 'rec_short_blocked',
    cashboxId: 'cb_test_short',
    institutionId: 'inst_synth_alpha',
    branchId: 'br_alpha_cairo',
    businessDate: '2026-11-03',
    reconciledAt: new Date(),
    reconciledByUserId: 'usr_mgr_1',
    openingBalance: Money.egp('500.00'),
    totalCollections: Money.zero('EGP'),
    totalIncomingTransfers: Money.zero('EGP'),
    totalOutgoingTransfers: Money.zero('EGP'),
    totalExpenses: Money.zero('EGP'),
    actualCountedClosingBalance: Money.egp('450.00')
  });

  assertThrows(
    () => {
      reconShortage.writeOffShortage();
    },
    UnresolvedPolicyBlockedError,
    'Negative 11: UP-705 Automated shortage write-off blocked'
  );

  // 12. UP-705 Surplus income recognition attempt blocked
  assertThrows(
    () => {
      reconShortage.recognizeSurplusIncome();
    },
    UnresolvedPolicyBlockedError,
    'Negative 12: UP-705 Automated surplus income recognition blocked'
  );

  // 13. UP-705 Variance threshold policy application blocked
  assertThrows(
    () => {
      reconShortage.applyVarianceThreshold(50);
    },
    UnresolvedPolicyBlockedError,
    'Negative 13: UP-705 Discrepancy approval threshold blocked'
  );

  // 14. Mutation of frozen transaction rejected
  const tx = Array.from(cb.transactions.values())[0];
  assert(Object.isFrozen(tx), 'Negative 14: CashboxTransaction is deep-frozen');
  let threwMutationError = false;
  try {
    const mutator = new Function('tx', "'use strict'; tx.status = 'REVERSED';");
    mutator(tx);
  } catch (err: any) {
    if (err instanceof TypeError) {
      threwMutationError = true;
    }
  }
  assert(threwMutationError, 'Negative 14: Runtime mutation of frozen transaction throws TypeError');

  // 15. Duplicate reversal of a cashbox movement rejected
  const expToRev = cb.recordExpense(
    {
      voucherNumber: 'EXP-REV-TEST',
      amount: Money.egp('50.00'),
      reason: 'Reversible expense',
      businessDate: '2026-11-04'
    },
    'usr_cashier_1',
    'CASHIER'
  );

  const firstRev = cb.reverseMovement(expToRev.transactionId, 'usr_mgr_1', 'PRIMARY_MANAGER', 'First reversal');
  assert(cb.transactions.get(expToRev.transactionId)!.status === 'POSTED', 'Original movement status remains POSTED after reversal');
  assert(cb.isMovementReversed(expToRev.transactionId) === true, 'Original movement marked as reversed in index');
  assertThrows(
    () => {
      cb.reverseMovement(expToRev.transactionId, 'usr_mgr_1', 'PRIMARY_MANAGER', 'Duplicate reversal');
    },
    DuplicateReversalError,
    'Negative 15: Duplicate movement reversal rejected'
  );

  // 15b. Attempting to reverse a reversal movement itself is rejected
  assertThrows(
    () => {
      cb.reverseMovement(firstRev.transactionId, 'usr_mgr_1', 'PRIMARY_MANAGER', 'Reversing a reversal');
    },
    InvalidLifecycleTransitionError,
    'Negative 15b: Reversal of a reversal movement rejected'
  );

  // 16. Premature revenue recognition guard on cashbox
  assertThrows(
    () => {
      cb.recognizeDirectRevenue();
    },
    PrematurePostingError,
    'Negative 16: recognizeDirectRevenue on Cashbox throws PrematurePostingError'
  );

  // 17. Multi-currency attempt rejected
  assertThrows(
    () => {
      new Cashbox({
        cashboxId: 'cb_usd',
        institutionId: 'inst_synth_alpha',
        branchId: 'br_alpha_cairo',
        isPhysicalBranch: true,
        name: 'USD Till',
        currency: 'USD' as any,
        createdByUserId: 'usr_mgr_1'
      });
    },
    MultiCurrencyDisabledError,
    'Negative 17: Multi-currency cashbox rejected (EGP only)'
  );

  // 18. Cashier without authority cannot reverse movements
  const expAuth = cb.recordExpense(
    {
      voucherNumber: 'EXP-AUTH',
      amount: Money.egp('10.00'),
      reason: 'Role authority test',
      businessDate: '2026-11-04'
    },
    'usr_cashier_1',
    'CASHIER'
  );

  assertThrows(
    () => {
      cb.reverseMovement(expAuth.transactionId, 'usr_cashier_1', 'CASHIER', 'Cashier unauthorized reversal');
    },
    InvalidEvidenceError,
    'Negative 18: Cashier role alone cannot reverse posted movements'
  );
}

// -----------------------------------------------------------------------------
// Suite 9: Integration Boundary Isolation with Increment 3 Sub-Ledger
// -----------------------------------------------------------------------------
console.log('\n--- Suite 9: Integration Boundary Isolation with Increment 3 Sub-Ledger ---');
{
  const snapshot = new AgreementPriceSnapshot({
    catalogPrice: Money.egp('1000.00'),
    netAgreedPrice: Money.egp('1000.00')
  });
  const schedule = [
    new PaymentArrangementScheduleItem({
      scheduleItemNumber: 1,
      dueDate: new Date(),
      amountDue: Money.egp('1000.00'),
      description: 'Arrangement 1'
    })
  ];
  const agreement = new StudentFinancialAgreement({
    agreementId: 'agr_boundary_1',
    studentId: 'usr_student_alpha',
    centerGroupId: 'grp_boundary',
    institutionId: 'inst_synth_alpha',
    branchId: 'br_alpha_cairo',
    priceSnapshot: snapshot,
    arrangementSchedule: schedule
  });
  const subLedger = new StudentSubLedger(agreement, 'usr_mgr_1');

  const receipt = createTestReceipt({
    collectionId: 'rec_shared_boundary_1',
    amountCollected: Money.egp('500.00'),
    receiptNumber: 'REC-BOUND-01'
  });

  // 1. Record receipt in student subledger
  subLedger.recordCollection(receipt, 'usr_cashier_1');

  // 2. Record receipt in cashbox
  const cashbox = createTestCashbox();
  const tx = cashbox.recordCollection(receipt, 'usr_cashier_1', 'CASHIER', '2026-11-03');

  assert(tx.referenceId === receipt.collectionId, 'Same receipt identity referenced in cashbox');
  assert(tx.amount.equals(receipt.amountCollected), 'Amounts match exactly across modules');

  // 3. Reverse cashbox movement: Verify subledger is NOT silently altered
  cashbox.reverseMovement(tx.transactionId, 'usr_mgr_1', 'PRIMARY_MANAGER', 'Wrong cashbox till selected');
  const subBalances = subLedger.getBalances();

  assert(
    subBalances.totalCollectionsReceived.equals(Money.egp('500.00')),
    'Cashbox reversal does NOT silently reverse student subledger collection'
  );
  assert(subLedger.receipts.get('rec_shared_boundary_1')!.state === 'UNALLOCATED', 'Student receipt remains unallocated in subledger');
}

console.log('\n===================================================================');
console.log(`INCREMENT 4 TEST RESULTS: ${passedTests} PASSED, ${failedTests} FAILED`);
console.log('===================================================================\n');

if (failedTests > 0) {
  process.exit(1);
}

