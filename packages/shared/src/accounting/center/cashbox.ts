/**
 * OX-DIGITAL Education — Financial Core Engine
 * Phase 2.0B — Physical Education Center Accounting Integration
 * Cashbox Operations, Cash Movements & Daily Reconciliation Engine
 */

import { Money } from '../money.js';
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
  CashboxTransferImbalanceError,
  DuplicateReconciliationError,
  InvalidReconciliationBalanceError,
  InvalidLifecycleTransitionError
} from '../errors.js';
import { assertApprovedRole, assertNotSaaSSuperAdmin, CenterRole } from './roles.js';
import { assertEgpCurrency } from './agreement.js';
import { CollectionReceiptEvidence } from './obligations.js';
import {
  CashboxCreatedEvent,
  CashboxCollectionRecordedEvent,
  CashboxExpenseRecordedEvent,
  CashboxTransferExecutedEvent,
  CashboxDailyReconciledEvent,
  CashboxMovementReversedEvent
} from './events.js';

export type CashboxStatus = 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';

export type CashMovementType =
  | 'COLLECTION'
  | 'EXPENSE'
  | 'TRANSFER_IN'
  | 'TRANSFER_OUT'
  | 'COLLECTION_REVERSED'
  | 'EXPENSE_REVERSED'
  | 'TRANSFER_REVERSED';

export type MovementStatus = 'POSTED' | 'REVERSED';

export interface CashboxTransactionProps {
  transactionId: string;
  cashboxId: string;
  institutionId: string;
  branchId: string;
  type: CashMovementType;
  amount: Money;
  balanceAfter: Money;
  businessDate: string; // YYYY-MM-DD
  timestamp: Date;
  actorUserId: string;
  actorRole: CenterRole;
  referenceId?: string;
  notes?: string;
  status?: MovementStatus;
  reversalDetails?: {
    reversedAt: Date;
    reversedBy: string;
    reason: string;
  };
}

/**
 * CashboxTransaction represents an immutable financial movement within an educational center cashbox.
 */
export class CashboxTransaction {
  public readonly transactionId: string;
  public readonly cashboxId: string;
  public readonly institutionId: string;
  public readonly branchId: string;
  public readonly type: CashMovementType;
  public readonly amount: Money;
  public readonly balanceAfter: Money;
  public readonly businessDate: string;
  public readonly timestamp: Date;
  public readonly actorUserId: string;
  public readonly actorRole: CenterRole;
  public readonly referenceId?: string;
  public readonly notes?: string;
  public readonly status: MovementStatus;
  public readonly reversalDetails?: Readonly<{
    reversedAt: Date;
    reversedBy: string;
    reason: string;
  }>;

  constructor(props: CashboxTransactionProps) {
    if (!props.transactionId) throw new InvalidAmountError('transactionId is required.');
    if (!props.cashboxId) throw new InvalidAmountError('cashboxId is required.');
    if (!props.institutionId) throw new InvalidAmountError('institutionId is required.');
    if (!props.branchId) throw new InvalidAmountError('branchId is required.');
    assertNotSaaSSuperAdmin(props.actorUserId, 'Cashbox transaction actor');
    const role = assertApprovedRole(props.actorRole);

    assertEgpCurrency(props.amount.currencyCode);
    assertEgpCurrency(props.balanceAfter.currencyCode);
    if (props.amount.isZero() || props.amount.isNegative()) {
      throw new InvalidAmountError('Transaction amount must be strictly positive.');
    }
    if (props.balanceAfter.isNegative()) {
      throw new InvalidAmountError('balanceAfter cannot be negative.');
    }
    if (!props.businessDate || !/^\d{4}-\d{2}-\d{2}$/.test(props.businessDate)) {
      throw new InvalidAmountError(`businessDate must be in YYYY-MM-DD format. Received: '${props.businessDate}'.`);
    }

    this.transactionId = props.transactionId;
    this.cashboxId = props.cashboxId;
    this.institutionId = props.institutionId;
    this.branchId = props.branchId;
    this.type = props.type;
    this.amount = props.amount;
    this.balanceAfter = props.balanceAfter;
    this.businessDate = props.businessDate;
    this.timestamp = new Date(props.timestamp);
    this.actorUserId = props.actorUserId;
    this.actorRole = role;
    this.referenceId = props.referenceId;
    this.notes = props.notes;
    this.status = props.status || 'POSTED';
    this.reversalDetails = props.reversalDetails
      ? Object.freeze({
          reversedAt: new Date(props.reversalDetails.reversedAt),
          reversedBy: props.reversalDetails.reversedBy,
          reason: props.reversalDetails.reason
        })
      : undefined;

    Object.freeze(this);
  }

  public reverse(reversedBy: string, reason: string): CashboxTransaction {
    if (this.status === 'REVERSED') {
      throw new DuplicateReversalError(this.transactionId, 'ALREADY_REVERSED');
    }
    if (!reversedBy) throw new InvalidEvidenceError('reversedBy is required for movement reversal.');
    if (!reason || reason.trim() === '') throw new InvalidEvidenceError('reason is required for movement reversal.');

    return new CashboxTransaction({
      transactionId: this.transactionId,
      cashboxId: this.cashboxId,
      institutionId: this.institutionId,
      branchId: this.branchId,
      type: this.type,
      amount: this.amount,
      balanceAfter: this.balanceAfter,
      businessDate: this.businessDate,
      timestamp: this.timestamp,
      actorUserId: this.actorUserId,
      actorRole: this.actorRole,
      referenceId: this.referenceId,
      notes: this.notes,
      status: 'REVERSED',
      reversalDetails: {
        reversedAt: new Date(),
        reversedBy,
        reason
      }
    });
  }
}

export interface CashboxTransferProps {
  transferId: string;
  institutionId: string;
  sourceCashboxId: string;
  sourceBranchId: string;
  destinationCashboxId: string;
  destinationBranchId: string;
  amount: Money;
  businessDate: string;
  executedAt: Date;
  actorUserId: string;
  actorRole: CenterRole;
  sourceTransactionId: string;
  destinationTransactionId: string;
  status?: 'EXECUTED' | 'REVERSED';
  reversalDetails?: {
    reversedAt: Date;
    reversedBy: string;
    reason: string;
  };
}

/**
 * CashboxTransfer represents an atomic funds transfer between two cashboxes of the same institution.
 */
export class CashboxTransfer {
  public readonly transferId: string;
  public readonly institutionId: string;
  public readonly sourceCashboxId: string;
  public readonly sourceBranchId: string;
  public readonly destinationCashboxId: string;
  public readonly destinationBranchId: string;
  public readonly amount: Money;
  public readonly businessDate: string;
  public readonly executedAt: Date;
  public readonly actorUserId: string;
  public readonly actorRole: CenterRole;
  public readonly sourceTransactionId: string;
  public readonly destinationTransactionId: string;
  public readonly status: 'EXECUTED' | 'REVERSED';
  public readonly reversalDetails?: Readonly<{
    reversedAt: Date;
    reversedBy: string;
    reason: string;
  }>;

  constructor(props: CashboxTransferProps) {
    if (!props.transferId) throw new InvalidAmountError('transferId is required.');
    if (!props.institutionId) throw new InvalidAmountError('institutionId is required.');
    if (props.sourceCashboxId === props.destinationCashboxId) {
      throw new SameCashboxTransferError(props.sourceCashboxId);
    }
    assertEgpCurrency(props.amount.currencyCode);
    if (props.amount.isZero() || props.amount.isNegative()) {
      throw new InvalidAmountError('Transfer amount must be strictly positive.');
    }

    this.transferId = props.transferId;
    this.institutionId = props.institutionId;
    this.sourceCashboxId = props.sourceCashboxId;
    this.sourceBranchId = props.sourceBranchId;
    this.destinationCashboxId = props.destinationCashboxId;
    this.destinationBranchId = props.destinationBranchId;
    this.amount = props.amount;
    this.businessDate = props.businessDate;
    this.executedAt = new Date(props.executedAt);
    this.actorUserId = props.actorUserId;
    this.actorRole = props.actorRole;
    this.sourceTransactionId = props.sourceTransactionId;
    this.destinationTransactionId = props.destinationTransactionId;
    this.status = props.status || 'EXECUTED';
    this.reversalDetails = props.reversalDetails
      ? Object.freeze({
          reversedAt: new Date(props.reversalDetails.reversedAt),
          reversedBy: props.reversalDetails.reversedBy,
          reason: props.reversalDetails.reason
        })
      : undefined;

    Object.freeze(this);
  }
}

export interface CashboxDailyReconciliationProps {
  reconciliationId: string;
  cashboxId: string;
  institutionId: string;
  branchId: string;
  businessDate: string;
  reconciledAt: Date;
  reconciledByUserId: string;
  openingBalance: Money;
  totalCollections: Money;
  totalIncomingTransfers: Money;
  totalOutgoingTransfers: Money;
  totalExpenses: Money;
  actualCountedClosingBalance: Money;
  notes?: string;
}

/**
 * CashboxDailyReconciliation represents an immutable daily closing reconciliation snapshot.
 *
 * Core Equation:
 * Expected Closing Balance = Opening Balance + Collections + Incoming Transfers - Outgoing Transfers - Expenses
 * Difference = Actual Counted Closing Balance - Expected Closing Balance
 */
export class CashboxDailyReconciliation {
  public readonly reconciliationId: string;
  public readonly cashboxId: string;
  public readonly institutionId: string;
  public readonly branchId: string;
  public readonly businessDate: string;
  public readonly reconciledAt: Date;
  public readonly reconciledByUserId: string;
  public readonly openingBalance: Money;
  public readonly totalCollections: Money;
  public readonly totalIncomingTransfers: Money;
  public readonly totalOutgoingTransfers: Money;
  public readonly totalExpenses: Money;
  public readonly expectedClosingBalance: Money;
  public readonly actualCountedClosingBalance: Money;
  public readonly difference: Money;
  public readonly status: 'BALANCED' | 'DISCREPANCY_PENDING_INVESTIGATION';
  public readonly notes?: string;

  constructor(props: CashboxDailyReconciliationProps) {
    if (!props.reconciliationId) throw new InvalidAmountError('reconciliationId is required.');
    if (!props.cashboxId) throw new InvalidAmountError('cashboxId is required.');
    if (!props.institutionId) throw new InvalidAmountError('institutionId is required.');
    if (!props.branchId) throw new InvalidAmountError('branchId is required.');
    assertNotSaaSSuperAdmin(props.reconciledByUserId, 'Reconciling user');

    assertEgpCurrency(props.openingBalance.currencyCode);
    assertEgpCurrency(props.totalCollections.currencyCode);
    assertEgpCurrency(props.totalIncomingTransfers.currencyCode);
    assertEgpCurrency(props.totalOutgoingTransfers.currencyCode);
    assertEgpCurrency(props.totalExpenses.currencyCode);
    assertEgpCurrency(props.actualCountedClosingBalance.currencyCode);

    if (props.openingBalance.isNegative()) {
      throw new InvalidReconciliationBalanceError('Opening balance cannot be negative.');
    }
    if (props.actualCountedClosingBalance.isNegative()) {
      throw new InvalidReconciliationBalanceError('Actual counted closing balance cannot be negative.');
    }

    // Expected Closing Balance = Opening + Collections + Incoming - Outgoing - Expenses
    const credits = props.openingBalance.add(props.totalCollections).add(props.totalIncomingTransfers);
    const debits = props.totalOutgoingTransfers.add(props.totalExpenses);

    const expected = credits.subtract(debits);
    if (expected.isNegative()) {
      throw new InvalidReconciliationBalanceError(
        `Expected closing balance (${expected.toString()}) cannot be negative. Debits (${debits.toString()}) exceed available credits (${credits.toString()}).`
      );
    }

    // Difference = Actual Counted - Expected Closing
    const diff = props.actualCountedClosingBalance.subtract(expected);

    this.reconciliationId = props.reconciliationId;
    this.cashboxId = props.cashboxId;
    this.institutionId = props.institutionId;
    this.branchId = props.branchId;
    this.businessDate = props.businessDate;
    this.reconciledAt = new Date(props.reconciledAt);
    this.reconciledByUserId = props.reconciledByUserId;
    this.openingBalance = props.openingBalance;
    this.totalCollections = props.totalCollections;
    this.totalIncomingTransfers = props.totalIncomingTransfers;
    this.totalOutgoingTransfers = props.totalOutgoingTransfers;
    this.totalExpenses = props.totalExpenses;
    this.expectedClosingBalance = expected;
    this.actualCountedClosingBalance = props.actualCountedClosingBalance;
    this.difference = diff;
    this.status = diff.isZero() ? 'BALANCED' : 'DISCREPANCY_PENDING_INVESTIGATION';
    this.notes = props.notes;

    Object.freeze(this);
  }

  /**
   * UP-705 Guard: Automated shortage write-off is barred.
   */
  public writeOffShortage(): never {
    throw new UnresolvedPolicyBlockedError(
      'UP-705',
      'Automated shortage write-off or manager discrepancy absorption is blocked pending Product Owner approval under UP-705.'
    );
  }

  /**
   * UP-705 Guard: Automated surplus income recognition is barred.
   */
  public recognizeSurplusIncome(): never {
    throw new UnresolvedPolicyBlockedError(
      'UP-705',
      'Automated surplus income recognition or balancing ledger adjustment is blocked pending Product Owner approval under UP-705.'
    );
  }

  /**
   * UP-705 Guard: Discrepancy threshold policies (such as the rejected 50 EGP rule) are barred.
   */
  public applyVarianceThreshold(_thresholdEgp: number): never {
    throw new UnresolvedPolicyBlockedError(
      'UP-705',
      'Cashbox discrepancy sign-off and clearing threshold policy is pending Product Owner approval.'
    );
  }
}

export interface CashboxProps {
  cashboxId: string;
  institutionId: string;
  branchId: string;
  isPhysicalBranch: boolean;
  name: string;
  currency?: 'EGP';
  status?: CashboxStatus;
  initialBalance?: Money;
  createdAt?: Date;
  createdByUserId: string;
}

export interface RecordExpenseParams {
  voucherNumber: string;
  amount: Money;
  reason: string;
  businessDate: string;
  notes?: string;
}

export interface DailyReconciliationParams {
  businessDate: string;
  openingBalance: Money;
  actualCountedClosingBalance: Money;
  notes?: string;
}

/**
 * Cashbox encapsulates physical reception till / safe operations for an educational campus.
 *
 * Core Guarantees:
 * 1. Multi-cashbox support per branch.
 * 2. Immutable, append-only cash movements.
 * 3. Prevention of negative cash balances.
 * 4. Linking to Increment 3 collection receipts without duplicate counting.
 * 5. Strict UP-705 fail-closed guards on shortage/surplus adjustments.
 * 6. Cash movement never triggers revenue recognition.
 */
export class Cashbox {
  public readonly cashboxId: string;
  public readonly institutionId: string;
  public readonly branchId: string;
  public readonly isPhysicalBranch: boolean;
  public readonly name: string;
  public readonly currency: 'EGP';
  public status: CashboxStatus;
  public readonly createdAt: Date;
  public readonly createdByUserId: string;

  private _currentBalance: Money;
  private readonly _transactions: Map<string, CashboxTransaction> = new Map();
  private readonly _receiptIndex: Set<string> = new Set();
  private readonly _reconciliations: Map<string, CashboxDailyReconciliation> = new Map();
  private readonly _reversalIndex: Map<string, string> = new Map();
  private readonly _emittedEvents: any[] = [];
  private _txSequence: number = 0;

  constructor(props: CashboxProps) {
    if (!props.cashboxId) throw new InvalidAmountError('cashboxId is required.');
    if (!props.institutionId) throw new InvalidAmountError('institutionId is required.');
    if (!props.branchId) throw new InvalidAmountError('branchId is required.');
    if (!props.isPhysicalBranch) {
      throw new InvalidEvidenceError(
        `Physical Cashbox Invariant: Cashbox operations are permitted only at physical campus branches. Branch '${props.branchId}' is non-physical.`
      );
    }
    if (!props.name || props.name.trim() === '') {
      throw new InvalidEvidenceError('Cashbox name is required.');
    }
    assertNotSaaSSuperAdmin(props.createdByUserId, 'Cashbox creator');

    const curr = props.currency || 'EGP';
    assertEgpCurrency(curr);

    const initial = props.initialBalance || Money.zero('EGP');
    assertEgpCurrency(initial.currencyCode);
    if (initial.isNegative()) {
      throw new InvalidAmountError('Initial cashbox balance cannot be negative.');
    }

    this.cashboxId = props.cashboxId;
    this.institutionId = props.institutionId;
    this.branchId = props.branchId;
    this.isPhysicalBranch = props.isPhysicalBranch;
    this.name = props.name.trim();
    this.currency = 'EGP';
    this.status = props.status || 'ACTIVE';
    this.createdAt = props.createdAt ? new Date(props.createdAt) : new Date();
    this.createdByUserId = props.createdByUserId;
    this._currentBalance = initial;

    const event: CashboxCreatedEvent = {
      eventType: 'CASHBOX_CREATED',
      cashboxId: this.cashboxId,
      institutionId: this.institutionId,
      branchId: this.branchId,
      name: this.name,
      currency: 'EGP',
      createdAt: this.createdAt.toISOString(),
      createdByUserId: this.createdByUserId
    };
    this._emittedEvents.push(event);
  }

  public get currentBalance(): Money {
    return this._currentBalance;
  }

  public get transactions(): ReadonlyMap<string, CashboxTransaction> {
    return new Map(this._transactions);
  }

  public get reconciliations(): ReadonlyMap<string, CashboxDailyReconciliation> {
    return new Map(this._reconciliations);
  }

  public get emittedEvents(): ReadonlyArray<any> {
    return [...this._emittedEvents];
  }

  public isMovementReversed(transactionId: string): boolean {
    return this._reversalIndex.has(transactionId);
  }

  public getReversalFor(transactionId: string): CashboxTransaction | undefined {
    const revId = this._reversalIndex.get(transactionId);
    return revId ? this._transactions.get(revId) : undefined;
  }

  public get reversalIndex(): ReadonlyMap<string, string> {
    return new Map(this._reversalIndex);
  }

  /**
   * Internal rollback method for atomic two-phase transfers.
   * Reverts uncommitted transfer movement in-memory if counterpart operation fails.
   */
  public _rollbackTransferMovement(
    transactionId: string,
    amount: Money,
    type: 'TRANSFER_OUT' | 'TRANSFER_IN'
  ): void {
    if (this._transactions.has(transactionId)) {
      this._transactions.delete(transactionId);
      if (type === 'TRANSFER_OUT') {
        this._currentBalance = this._currentBalance.add(amount);
      } else {
        this._currentBalance = this._currentBalance.subtract(amount);
      }
    }
  }

  /**
   * Records frontline fee collection cash received into the cashbox.
   * Links directly to Increment 3 CollectionReceiptEvidence.
   */
  public recordCollection(
    receipt: CollectionReceiptEvidence,
    cashierUserId: string,
    cashierRole: CenterRole,
    businessDate?: string
  ): CashboxTransaction {
    if (this.status !== 'ACTIVE') {
      throw new InvalidLifecycleTransitionError(this.status, 'COLLECTION', `Cashbox '${this.cashboxId}' is not ACTIVE.`);
    }
    if (!receipt) throw new InvalidEvidenceError('Collection receipt is required.');

    // Institution isolation
    if (receipt.institutionId !== this.institutionId) {
      throw new CrossInstitutionError('CollectionReceiptEvidence', this.institutionId, receipt.institutionId);
    }

    // Branch isolation
    if (receipt.branchId !== this.branchId) {
      throw new CrossBranchAllocationError(
        receipt.branchId,
        this.branchId,
        `Receipt branch does not match cashbox branch.`
      );
    }

    // Cashbox identity check
    if (receipt.cashboxId !== this.cashboxId) {
      throw new InvalidEvidenceError(
        `Receipt cashboxId ('${receipt.cashboxId}') does not match this cashbox ('${this.cashboxId}').`
      );
    }

    // Duplicate receipt guard: receipt cannot be collected twice
    if (this._receiptIndex.has(receipt.collectionId)) {
      throw new DuplicateCashboxTransactionError(
        receipt.collectionId,
        `Receipt '${receipt.receiptNumber}' has already been processed in cashbox '${this.cashboxId}'.`
      );
    }

    assertNotSaaSSuperAdmin(cashierUserId, 'Cashier');
    const role = assertApprovedRole(cashierRole);
    if (role !== 'CASHIER' && role !== 'PRIMARY_MANAGER') {
      throw new InvalidEvidenceError(
        `Cashier authority error: Only a Cashier or Primary Manager can record cash receipts. Provided role: '${cashierRole}'.`
      );
    }

    const amount = receipt.amountCollected;
    assertEgpCurrency(amount.currencyCode);
    if (amount.isZero() || amount.isNegative()) {
      throw new InvalidAmountError('Collection receipt amount must be strictly positive.');
    }

    const dateStr = businessDate || receipt.collectedAt.toISOString().slice(0, 10);
    const newBalance = this._currentBalance.add(amount);

    const transactionId = `ctx_${this.cashboxId}_col_${++this._txSequence}`;
    const tx = new CashboxTransaction({
      transactionId,
      cashboxId: this.cashboxId,
      institutionId: this.institutionId,
      branchId: this.branchId,
      type: 'COLLECTION',
      amount,
      balanceAfter: newBalance,
      businessDate: dateStr,
      timestamp: new Date(),
      actorUserId: cashierUserId,
      actorRole: role,
      referenceId: receipt.collectionId,
      notes: `Receipt ${receipt.receiptNumber} (${receipt.paymentMethod}) for student ${receipt.studentId}`,
      status: 'POSTED'
    });

    this._currentBalance = newBalance;
    this._transactions.set(transactionId, tx);
    this._receiptIndex.add(receipt.collectionId);

    const event: CashboxCollectionRecordedEvent = {
      eventType: 'CASHBOX_COLLECTION_RECORDED',
      transactionId,
      cashboxId: this.cashboxId,
      institutionId: this.institutionId,
      branchId: this.branchId,
      collectionId: receipt.collectionId,
      receiptNumber: receipt.receiptNumber,
      studentId: receipt.studentId,
      amount: amount.toString(),
      currency: 'EGP',
      balanceAfter: newBalance.toString(),
      businessDate: dateStr,
      recordedAt: tx.timestamp.toISOString(),
      cashierUserId,
      revenueRecognized: false
    };
    this._emittedEvents.push(event);

    return tx;
  }

  /**
   * Records a petty cash expense or campus cash disbursement.
   * Guarantees cashbox balance cannot drop below zero.
   */
  public recordExpense(
    params: RecordExpenseParams,
    actorUserId: string,
    actorRole: CenterRole
  ): CashboxTransaction {
    if (this.status !== 'ACTIVE') {
      throw new InvalidLifecycleTransitionError(this.status, 'EXPENSE', `Cashbox '${this.cashboxId}' is not ACTIVE.`);
    }
    if (!params.voucherNumber || params.voucherNumber.trim() === '') {
      throw new InvalidEvidenceError('Expense voucherNumber is required.');
    }
    if (!params.reason || params.reason.trim() === '') {
      throw new InvalidEvidenceError('Expense reason is required.');
    }
    assertNotSaaSSuperAdmin(actorUserId, 'Expense actor');
    const role = assertApprovedRole(actorRole);

    assertEgpCurrency(params.amount.currencyCode);
    if (params.amount.isZero() || params.amount.isNegative()) {
      throw new InvalidAmountError('Expense amount must be strictly positive.');
    }

    if (params.amount.greaterThan(this._currentBalance)) {
      throw new InsufficientCashboxBalanceError(
        this.cashboxId,
        params.amount.toString(),
        this._currentBalance.toString()
      );
    }

    const newBalance = this._currentBalance.subtract(params.amount);
    const transactionId = `ctx_${this.cashboxId}_exp_${++this._txSequence}`;

    const tx = new CashboxTransaction({
      transactionId,
      cashboxId: this.cashboxId,
      institutionId: this.institutionId,
      branchId: this.branchId,
      type: 'EXPENSE',
      amount: params.amount,
      balanceAfter: newBalance,
      businessDate: params.businessDate,
      timestamp: new Date(),
      actorUserId,
      actorRole: role,
      referenceId: params.voucherNumber.trim(),
      notes: params.reason.trim(),
      status: 'POSTED'
    });

    this._currentBalance = newBalance;
    this._transactions.set(transactionId, tx);

    const event: CashboxExpenseRecordedEvent = {
      eventType: 'CASHBOX_EXPENSE_RECORDED',
      transactionId,
      cashboxId: this.cashboxId,
      institutionId: this.institutionId,
      branchId: this.branchId,
      voucherNumber: params.voucherNumber.trim(),
      amount: params.amount.toString(),
      currency: 'EGP',
      balanceAfter: newBalance.toString(),
      businessDate: params.businessDate,
      reason: params.reason.trim(),
      recordedAt: tx.timestamp.toISOString(),
      actorUserId
    };
    this._emittedEvents.push(event);

    return tx;
  }

  /**
   * Internal package method: applies incoming or outgoing transfer movement.
   */
  public _applyTransferMovement(
    type: 'TRANSFER_IN' | 'TRANSFER_OUT',
    amount: Money,
    transferId: string,
    counterpartCashboxId: string,
    businessDate: string,
    actorUserId: string,
    actorRole: CenterRole
  ): CashboxTransaction {
    if (this.status !== 'ACTIVE') {
      throw new InvalidLifecycleTransitionError(this.status, type, `Cashbox '${this.cashboxId}' is not ACTIVE.`);
    }
    assertEgpCurrency(amount.currencyCode);
    if (amount.isZero() || amount.isNegative()) {
      throw new InvalidAmountError('Transfer amount must be strictly positive.');
    }

    let newBalance: Money;
    if (type === 'TRANSFER_OUT') {
      if (amount.greaterThan(this._currentBalance)) {
        throw new InsufficientCashboxBalanceError(
          this.cashboxId,
          amount.toString(),
          this._currentBalance.toString()
        );
      }
      newBalance = this._currentBalance.subtract(amount);
    } else {
      newBalance = this._currentBalance.add(amount);
    }

    const transactionId = `ctx_${this.cashboxId}_${type.toLowerCase()}_${++this._txSequence}`;
    const tx = new CashboxTransaction({
      transactionId,
      cashboxId: this.cashboxId,
      institutionId: this.institutionId,
      branchId: this.branchId,
      type,
      amount,
      balanceAfter: newBalance,
      businessDate,
      timestamp: new Date(),
      actorUserId,
      actorRole,
      referenceId: transferId,
      notes: `${type === 'TRANSFER_OUT' ? 'To' : 'From'} cashbox ${counterpartCashboxId}`,
      status: 'POSTED'
    });

    this._currentBalance = newBalance;
    this._transactions.set(transactionId, tx);
    return tx;
  }

  /**
   * Reverses a posted cashbox movement using an append-only compensating transaction.
   */
  public reverseMovement(
    transactionId: string,
    actorUserId: string,
    actorRole: CenterRole,
    reason: string
  ): CashboxTransaction {
    if (!transactionId) throw new InvalidAmountError('transactionId is required.');
    assertNotSaaSSuperAdmin(actorUserId, 'Reversing actor');
    const role = assertApprovedRole(actorRole);
    if (role !== 'ACCOUNTANT' && role !== 'PRIMARY_MANAGER') {
      throw new InvalidEvidenceError('Cashbox movements can only be reversed by an Accountant or Primary Manager.');
    }
    if (!reason || reason.trim() === '') {
      throw new InvalidEvidenceError('Reason is required for cashbox movement reversal.');
    }

    const originalTx = this._transactions.get(transactionId);
    if (!originalTx) {
      throw new InvalidEvidenceError(`Transaction '${transactionId}' not found in cashbox '${this.cashboxId}'.`);
    }
    if (this._reversalIndex.has(transactionId)) {
      throw new DuplicateReversalError(transactionId, 'ALREADY_REVERSED');
    }
    if (originalTx.type.endsWith('_REVERSED')) {
      throw new InvalidLifecycleTransitionError(originalTx.type, 'REVERSED', 'Cannot reverse a reversal transaction.');
    }

    let reversalType: CashMovementType;
    let newBalance: Money;

    switch (originalTx.type) {
      case 'COLLECTION':
        // Collection brought money IN; reversal takes money OUT
        if (originalTx.amount.greaterThan(this._currentBalance)) {
          throw new InsufficientCashboxBalanceError(
            this.cashboxId,
            originalTx.amount.toString(),
            this._currentBalance.toString()
          );
        }
        newBalance = this._currentBalance.subtract(originalTx.amount);
        reversalType = 'COLLECTION_REVERSED';
        // Remove from receipt index so receipt is not trapped if re-evaluated under valid correction
        if (originalTx.referenceId) {
          this._receiptIndex.delete(originalTx.referenceId);
        }
        break;

      case 'EXPENSE':
        // Expense took money OUT; reversal puts money IN
        newBalance = this._currentBalance.add(originalTx.amount);
        reversalType = 'EXPENSE_REVERSED';
        break;

      case 'TRANSFER_IN':
        // Incoming transfer brought money IN; reversal takes money OUT
        if (originalTx.amount.greaterThan(this._currentBalance)) {
          throw new InsufficientCashboxBalanceError(
            this.cashboxId,
            originalTx.amount.toString(),
            this._currentBalance.toString()
          );
        }
        newBalance = this._currentBalance.subtract(originalTx.amount);
        reversalType = 'TRANSFER_REVERSED';
        break;

      case 'TRANSFER_OUT':
        // Outgoing transfer took money OUT; reversal puts money IN
        newBalance = this._currentBalance.add(originalTx.amount);
        reversalType = 'TRANSFER_REVERSED';
        break;

      default:
        throw new InvalidLifecycleTransitionError(originalTx.type, 'REVERSED', 'Cannot reverse a reversal transaction.');
    }

    const reversalTxId = `ctx_${this.cashboxId}_rev_${++this._txSequence}`;
    const reversalTx = new CashboxTransaction({
      transactionId: reversalTxId,
      cashboxId: this.cashboxId,
      institutionId: this.institutionId,
      branchId: this.branchId,
      type: reversalType,
      amount: originalTx.amount,
      balanceAfter: newBalance,
      businessDate: originalTx.businessDate,
      timestamp: new Date(),
      actorUserId,
      actorRole: role,
      referenceId: originalTx.transactionId,
      notes: `Reversal of ${originalTx.transactionId}. Reason: ${reason}`,
      status: 'POSTED'
    });

    // APPEND-ONLY: Original posted movement remains immutable and permanently retrievable with status 'POSTED'.
    // Reversal is appended as a distinct compensating movement and indexed in _reversalIndex.
    this._currentBalance = newBalance;
    this._transactions.set(reversalTxId, reversalTx);
    this._reversalIndex.set(transactionId, reversalTxId);

    const event: CashboxMovementReversedEvent = {
      eventType: 'CASHBOX_MOVEMENT_REVERSED',
      transactionId: originalTx.transactionId,
      reversalTransactionId: reversalTxId,
      cashboxId: this.cashboxId,
      institutionId: this.institutionId,
      branchId: this.branchId,
      originalType: originalTx.type,
      amount: originalTx.amount.toString(),
      currency: 'EGP',
      balanceAfter: newBalance.toString(),
      reversedAt: new Date().toISOString(),
      reversedByUserId: actorUserId,
      reason
    };
    this._emittedEvents.push(event);

    return reversalTx;
  }

  /**
   * Executes deterministic daily closing reconciliation for a specific business date.
   */
  public reconcileDaily(
    params: DailyReconciliationParams,
    actorUserId: string
  ): CashboxDailyReconciliation {
    if (!params.businessDate || !/^\d{4}-\d{2}-\d{2}$/.test(params.businessDate)) {
      throw new InvalidAmountError('businessDate must be in YYYY-MM-DD format.');
    }
    if (this._reconciliations.has(params.businessDate)) {
      throw new DuplicateReconciliationError(this.cashboxId, params.businessDate);
    }

    // Continuity verification with previous contiguous business date if present
    const previousDate = this._findPrecedingBusinessDate(params.businessDate);
    if (previousDate && this._reconciliations.has(previousDate)) {
      const prevReconciliation = this._reconciliations.get(previousDate)!;
      if (!params.openingBalance.equals(prevReconciliation.actualCountedClosingBalance)) {
        throw new InvalidReconciliationBalanceError(
          `Opening balance continuity failure: Opening balance (${params.openingBalance.toString()}) does not match previous closing balance (${prevReconciliation.actualCountedClosingBalance.toString()}) for date ${previousDate}.`
        );
      }
    }

    // Calculate movement totals for the specific business date
    let totalCollections = Money.zero('EGP');
    let totalIncomingTransfers = Money.zero('EGP');
    let totalOutgoingTransfers = Money.zero('EGP');
    let totalExpenses = Money.zero('EGP');

    for (const tx of this._transactions.values()) {
      if (tx.businessDate === params.businessDate && tx.status === 'POSTED') {
        switch (tx.type) {
          case 'COLLECTION':
            totalCollections = totalCollections.add(tx.amount);
            break;
          case 'EXPENSE':
            totalExpenses = totalExpenses.add(tx.amount);
            break;
          case 'TRANSFER_IN':
            totalIncomingTransfers = totalIncomingTransfers.add(tx.amount);
            break;
          case 'TRANSFER_OUT':
            totalOutgoingTransfers = totalOutgoingTransfers.add(tx.amount);
            break;
          case 'COLLECTION_REVERSED':
            totalCollections = totalCollections.subtract(tx.amount);
            break;
          case 'EXPENSE_REVERSED':
            totalExpenses = totalExpenses.subtract(tx.amount);
            break;
          case 'TRANSFER_REVERSED':
            // Check reference to see if it was in or out
            break;
        }
      }
    }

    const reconciliationId = `rec_${this.cashboxId}_${params.businessDate}`;
    const reconciliation = new CashboxDailyReconciliation({
      reconciliationId,
      cashboxId: this.cashboxId,
      institutionId: this.institutionId,
      branchId: this.branchId,
      businessDate: params.businessDate,
      reconciledAt: new Date(),
      reconciledByUserId: actorUserId,
      openingBalance: params.openingBalance,
      totalCollections,
      totalIncomingTransfers,
      totalOutgoingTransfers,
      totalExpenses,
      actualCountedClosingBalance: params.actualCountedClosingBalance,
      notes: params.notes
    });

    this._reconciliations.set(params.businessDate, reconciliation);

    const event: CashboxDailyReconciledEvent = {
      eventType: 'CASHBOX_DAILY_RECONCILED',
      reconciliationId,
      cashboxId: this.cashboxId,
      institutionId: this.institutionId,
      branchId: this.branchId,
      businessDate: params.businessDate,
      openingBalance: reconciliation.openingBalance.toString(),
      totalCollections: reconciliation.totalCollections.toString(),
      totalIncomingTransfers: reconciliation.totalIncomingTransfers.toString(),
      totalOutgoingTransfers: reconciliation.totalOutgoingTransfers.toString(),
      totalExpenses: reconciliation.totalExpenses.toString(),
      expectedClosingBalance: reconciliation.expectedClosingBalance.toString(),
      actualCountedClosingBalance: reconciliation.actualCountedClosingBalance.toString(),
      difference: reconciliation.difference.toString(),
      status: reconciliation.status,
      reconciledAt: reconciliation.reconciledAt.toISOString(),
      reconciledByUserId: actorUserId
    };
    this._emittedEvents.push(event);

    return reconciliation;
  }

  /**
   * Invariant Guard: Confirms that fee collections in cashboxes CANNOT recognize tuition revenue.
   */
  public recognizeDirectRevenue(): never {
    throw new PrematurePostingError(
      'Cashbox Operations Engine',
      'Direct Tuition Revenue Recognition'
    );
  }

  private _findPrecedingBusinessDate(currentDateStr: string): string | null {
    const dates = Array.from(this._reconciliations.keys()).sort();
    const idx = dates.indexOf(currentDateStr);
    if (idx > 0) return dates[idx - 1];
    const earlierDates = dates.filter(d => d < currentDateStr);
    return earlierDates.length > 0 ? earlierDates[earlierDates.length - 1] : null;
  }
}

export interface ExecuteTransferParams {
  transferId?: string;
  sourceCashbox: Cashbox;
  destinationCashbox: Cashbox;
  amount: Money;
  businessDate: string;
  actorUserId: string;
  actorRole: CenterRole;
  notes?: string;
}

/**
 * CashboxTransferEngine coordinates atomic funds transfers between two cashboxes of an institution.
 */
export class CashboxTransferEngine {
  private static readonly _transferHistory: Map<string, CashboxTransfer> = new Map();

  /** @internal Optional fault injection hook for testing atomicity failure modes */
  public static _faultInjector?: (
    stage: 'AFTER_SOURCE' | 'AFTER_DEST' | 'BEFORE_RECORD' | 'BEFORE_HISTORY'
  ) => void;

  public static getTransfer(transferId: string): CashboxTransfer | undefined {
    return this._transferHistory.get(transferId);
  }

  public static clearHistory(): void {
    this._transferHistory.clear();
  }

  public static executeTransfer(params: ExecuteTransferParams): CashboxTransfer {
    const source = params.sourceCashbox;
    const dest = params.destinationCashbox;

    if (!source) throw new CashboxNotFoundError('undefined', 'Source cashbox is required.');
    if (!dest) throw new CashboxNotFoundError('undefined', 'Destination cashbox is required.');

    // Institution isolation
    if (source.institutionId !== dest.institutionId) {
      throw new CrossInstitutionError(
        'CashboxTransfer',
        source.institutionId,
        dest.institutionId
      );
    }

    // Identity check
    if (source.cashboxId === dest.cashboxId) {
      throw new SameCashboxTransferError(source.cashboxId);
    }

    // Physical campus branch invariant
    if (!source.isPhysicalBranch) {
      throw new InvalidEvidenceError(`Source cashbox '${source.cashboxId}' is not in a physical campus branch.`);
    }
    if (!dest.isPhysicalBranch) {
      throw new InvalidEvidenceError(`Destination cashbox '${dest.cashboxId}' is not in a physical campus branch.`);
    }

    // Pre-validate BOTH cashboxes ACTIVE status before state mutation
    if (source.status !== 'ACTIVE') {
      throw new InvalidLifecycleTransitionError(
        source.status,
        'TRANSFER_OUT',
        `Source cashbox '${source.cashboxId}' is not ACTIVE (status: ${source.status}).`
      );
    }
    if (dest.status !== 'ACTIVE') {
      throw new InvalidLifecycleTransitionError(
        dest.status,
        'TRANSFER_IN',
        `Destination cashbox '${dest.cashboxId}' is not ACTIVE (status: ${dest.status}).`
      );
    }

    assertNotSaaSSuperAdmin(params.actorUserId, 'Transfer actor');
    const role = assertApprovedRole(params.actorRole);

    assertEgpCurrency(params.amount.currencyCode);
    if (params.amount.isZero() || params.amount.isNegative()) {
      throw new InvalidAmountError('Transfer amount must be strictly positive.');
    }

    if (!params.businessDate || !/^\d{4}-\d{2}-\d{2}$/.test(params.businessDate)) {
      throw new InvalidAmountError(`businessDate must be in YYYY-MM-DD format. Received: '${params.businessDate}'.`);
    }

    const transferId = params.transferId || `txfr_${source.cashboxId}_${dest.cashboxId}_${Date.now()}`;
    if (this._transferHistory.has(transferId)) {
      throw new DuplicateCashboxTransactionError(transferId, 'Transfer already executed.');
    }

    // Balance check on source
    if (params.amount.greaterThan(source.currentBalance)) {
      throw new InsufficientCashboxBalanceError(
        source.cashboxId,
        params.amount.toString(),
        source.currentBalance.toString()
      );
    }

    // Fully guarded atomic execution with two-sided rollback
    let sourceTx: CashboxTransaction | undefined;
    let destTx: CashboxTransaction | undefined;
    let historyRegistered = false;

    try {
      sourceTx = source._applyTransferMovement(
        'TRANSFER_OUT',
        params.amount,
        transferId,
        dest.cashboxId,
        params.businessDate,
        params.actorUserId,
        role
      );

      if (this._faultInjector) {
        this._faultInjector('AFTER_SOURCE');
      }

      destTx = dest._applyTransferMovement(
        'TRANSFER_IN',
        params.amount,
        transferId,
        source.cashboxId,
        params.businessDate,
        params.actorUserId,
        role
      );

      if (this._faultInjector) {
        this._faultInjector('AFTER_DEST');
      }

      // Exact conservation check
      if (!sourceTx.amount.equals(destTx.amount)) {
        throw new CashboxTransferImbalanceError(sourceTx.amount.toString(), destTx.amount.toString());
      }

      if (this._faultInjector) {
        this._faultInjector('BEFORE_RECORD');
      }

      const transfer = new CashboxTransfer({
        transferId,
        institutionId: source.institutionId,
        sourceCashboxId: source.cashboxId,
        sourceBranchId: source.branchId,
        destinationCashboxId: dest.cashboxId,
        destinationBranchId: dest.branchId,
        amount: params.amount,
        businessDate: params.businessDate,
        executedAt: new Date(),
        actorUserId: params.actorUserId,
        actorRole: role,
        sourceTransactionId: sourceTx.transactionId,
        destinationTransactionId: destTx.transactionId
      });

      if (this._faultInjector) {
        this._faultInjector('BEFORE_HISTORY');
      }

      this._transferHistory.set(transferId, transfer);
      historyRegistered = true;

      return transfer;
    } catch (err) {
      // Two-sided rollback: restore both cashboxes and history to exact pre-transfer state
      if (historyRegistered) {
        try {
          this._transferHistory.delete(transferId);
        } catch (_) {}
      }
      if (destTx) {
        try {
          dest._rollbackTransferMovement(destTx.transactionId, params.amount, 'TRANSFER_IN');
        } catch (_) {}
      }
      if (sourceTx) {
        try {
          source._rollbackTransferMovement(sourceTx.transactionId, params.amount, 'TRANSFER_OUT');
        } catch (_) {}
      }
      throw err;
    }
  }
}

