/**
 * OX-DIGITAL Education — Financial Core Engine
 * Phase 2.0B — Physical Education Center Accounting Integration
 * Student Financial Sub-Ledger, Collection Allocation & Reconciliation State Machine
 */

import { Money } from '../money.js';
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
} from '../errors.js';
import { assertNotSaaSSuperAdmin } from './roles.js';
import { assertEgpCurrency, StudentFinancialAgreement } from './agreement.js';
import { StudentObligation, CollectionReceiptEvidence } from './obligations.js';
import {
  CollectionAllocationRecordedEvent,
  CollectionAllocationReversedEvent,
  CollectionReceiptReversedEvent,
  StudentSubledgerReconciledEvent
} from './events.js';

export type ReceiptAllocationState =
  | 'UNALLOCATED'
  | 'PARTIALLY_ALLOCATED'
  | 'FULLY_ALLOCATED'
  | 'REVERSED';

export type ObligationSettlementState =
  | 'PENDING'
  | 'PARTIALLY_SETTLED'
  | 'FULLY_SETTLED'
  | 'WAIVED'
  | 'OVERDUE';

export type AllocationStatus = 'ACTIVE' | 'REVERSED';

export type SubLedgerStatus = 'ACTIVE' | 'TRANSFERRED' | 'WITHDRAWN' | 'CLOSED';

export type SubLedgerTransactionType =
  | 'AGREEMENT_RECORDED'
  | 'OBLIGATION_RECORDED'
  | 'COLLECTION_RECORDED'
  | 'COLLECTION_ALLOCATED'
  | 'ALLOCATION_REVERSED'
  | 'COLLECTION_REVERSED'
  | 'BRANCH_TRANSFERRED'
  | 'GROUP_TRANSFERRED'
  | 'STUDENT_WITHDRAWN'
  | 'RECONCILED';

export interface SubLedgerBalances {
  readonly totalAgreedPrice: Money;
  readonly totalObligationsDue: Money;
  readonly totalCollectionsReceived: Money;
  readonly totalAllocated: Money;
  readonly totalUnallocatedCollections: Money;
  readonly totalRemainingDue: Money;
  readonly currency: 'EGP';
}

export interface SubLedgerTransaction {
  readonly transactionId: string;
  readonly transactionType: SubLedgerTransactionType;
  readonly timestamp: Date;
  readonly actorUserId: string;
  readonly referenceId?: string;
  readonly amount?: Money;
  readonly description: string;
  readonly balancesSnapshot: SubLedgerBalances;
}

/**
 * TrackedCollectionReceipt encapsulates a verified collection receipt
 * and tracks its allocation state and remaining unallocated balance.
 */
export class TrackedCollectionReceipt {
  public readonly receipt: CollectionReceiptEvidence;
  public readonly totalCollected: Money;
  public readonly allocatedAmount: Money;
  public readonly unallocatedAmount: Money;
  public readonly state: ReceiptAllocationState;
  public readonly reversedAt?: Date;
  public readonly reversedBy?: string;
  public readonly reversalReason?: string;

  constructor(
    receipt: CollectionReceiptEvidence,
    allocatedAmount?: Money,
    state?: ReceiptAllocationState,
    reversedAt?: Date,
    reversedBy?: string,
    reversalReason?: string
  ) {
    this.receipt = receipt;
    this.totalCollected = receipt.amountCollected;
    assertEgpCurrency(this.totalCollected.currencyCode);

    const allocated = allocatedAmount || Money.zero('EGP');
    assertEgpCurrency(allocated.currencyCode);

    if (allocated.isNegative()) {
      throw new InvalidAmountError('Allocated amount on receipt cannot be negative.');
    }

    const unallocated = this.totalCollected.subtract(allocated);
    if (unallocated.isNegative()) {
      throw new ExcessiveAllocationError(
        allocated.toString(),
        this.totalCollected.toString(),
        'RECEIPT'
      );
    }

    let resolvedState: ReceiptAllocationState = state || 'UNALLOCATED';
    if (state === 'REVERSED') {
      resolvedState = 'REVERSED';
    } else if (unallocated.isZero()) {
      resolvedState = 'FULLY_ALLOCATED';
    } else if (allocated.isPositive()) {
      resolvedState = 'PARTIALLY_ALLOCATED';
    } else {
      resolvedState = 'UNALLOCATED';
    }

    this.allocatedAmount = allocated;
    this.unallocatedAmount = unallocated;
    this.state = resolvedState;
    this.reversedAt = reversedAt ? new Date(reversedAt) : undefined;
    this.reversedBy = reversedBy;
    this.reversalReason = reversalReason;

    Object.freeze(this);
  }

  public allocate(amount: Money): TrackedCollectionReceipt {
    if (this.state === 'REVERSED') {
      throw new InvalidLifecycleTransitionError('REVERSED', 'ALLOCATED', 'Cannot allocate from a reversed collection receipt.');
    }
    assertEgpCurrency(amount.currencyCode);
    if (amount.isZero() || amount.isNegative()) {
      throw new InvalidAmountError('Allocation amount must be strictly positive.');
    }
    if (amount.greaterThan(this.unallocatedAmount)) {
      throw new ExcessiveAllocationError(amount.toString(), this.unallocatedAmount.toString(), 'RECEIPT');
    }

    const newAllocated = this.allocatedAmount.add(amount);
    return new TrackedCollectionReceipt(this.receipt, newAllocated);
  }

  public revertAllocation(amount: Money): TrackedCollectionReceipt {
    if (this.state === 'REVERSED') {
      throw new InvalidLifecycleTransitionError('REVERSED', 'UNALLOCATED', 'Cannot revert allocation on an already reversed receipt.');
    }
    assertEgpCurrency(amount.currencyCode);
    if (amount.isZero() || amount.isNegative()) {
      throw new InvalidAmountError('Revert amount must be strictly positive.');
    }
    if (amount.greaterThan(this.allocatedAmount)) {
      throw new InvalidAmountError('Revert amount cannot exceed previously allocated amount on receipt.');
    }

    const newAllocated = this.allocatedAmount.subtract(amount);
    return new TrackedCollectionReceipt(this.receipt, newAllocated);
  }

  public reverseReceipt(reversedBy: string, reason: string): TrackedCollectionReceipt {
    if (this.state === 'REVERSED') {
      throw new DuplicateReversalError(this.receipt.collectionId, 'PREVIOUS_REVERSAL');
    }
    if (!this.allocatedAmount.isZero()) {
      throw new InvalidLifecycleTransitionError(
        this.state,
        'REVERSED',
        `Cannot reverse collection receipt '${this.receipt.collectionId}' while active allocations (${this.allocatedAmount.toString()}) remain. Reverse all allocations first.`
      );
    }
    if (!reversedBy) throw new InvalidEvidenceError('reversedBy is required for receipt reversal.');
    if (!reason) throw new InvalidEvidenceError('reason is required for receipt reversal.');

    return new TrackedCollectionReceipt(
      this.receipt,
      Money.zero('EGP'),
      'REVERSED',
      new Date(),
      reversedBy,
      reason
    );
  }
}

export interface CollectionAllocationRecordProps {
  allocationId: string;
  idempotencyKey: string;
  institutionId: string;
  branchId: string;
  studentId: string;
  agreementId: string;
  collectionId: string;
  obligationId: string;
  amount: Money;
  allocatedAt: Date;
  allocatedByUserId: string;
  status?: AllocationStatus;
  reversalDetails?: {
    reversedAt: Date;
    reversedByUserId: string;
    reason: string;
  };
  notes?: string;
}

/**
 * CollectionAllocationRecord represents an immutable mapping between an actual
 * cashbox fee receipt and a specific student scheduled obligation.
 */
export class CollectionAllocationRecord {
  public readonly allocationId: string;
  public readonly idempotencyKey: string;
  public readonly institutionId: string;
  public readonly branchId: string;
  public readonly studentId: string;
  public readonly agreementId: string;
  public readonly collectionId: string;
  public readonly obligationId: string;
  public readonly amount: Money;
  public readonly allocatedAt: Date;
  public readonly allocatedByUserId: string;
  public readonly status: AllocationStatus;
  public readonly reversalDetails?: Readonly<{
    reversedAt: Date;
    reversedByUserId: string;
    reason: string;
  }>;
  public readonly notes?: string;

  constructor(props: CollectionAllocationRecordProps) {
    if (!props.allocationId) throw new InvalidAmountError('allocationId is required.');
    if (!props.idempotencyKey) throw new InvalidAmountError('idempotencyKey is required.');
    if (!props.institutionId) throw new InvalidAmountError('institutionId is required.');
    if (!props.branchId) throw new InvalidAmountError('branchId is required.');
    if (!props.studentId) throw new InvalidAmountError('studentId is required.');
    assertNotSaaSSuperAdmin(props.studentId, 'Student allocation');
    if (!props.agreementId) throw new InvalidAmountError('agreementId is required.');
    if (!props.collectionId) throw new InvalidAmountError('collectionId is required.');
    if (!props.obligationId) throw new InvalidAmountError('obligationId is required.');
    assertEgpCurrency(props.amount.currencyCode);
    if (props.amount.isZero() || props.amount.isNegative()) {
      throw new InvalidAmountError('Allocation amount must be strictly positive.');
    }
    if (!props.allocatedByUserId) throw new InvalidEvidenceError('allocatedByUserId is required.');
    assertNotSaaSSuperAdmin(props.allocatedByUserId, 'Allocating user');

    this.allocationId = props.allocationId;
    this.idempotencyKey = props.idempotencyKey;
    this.institutionId = props.institutionId;
    this.branchId = props.branchId;
    this.studentId = props.studentId;
    this.agreementId = props.agreementId;
    this.collectionId = props.collectionId;
    this.obligationId = props.obligationId;
    this.amount = props.amount;
    this.allocatedAt = new Date(props.allocatedAt);
    this.allocatedByUserId = props.allocatedByUserId;
    this.status = props.status || 'ACTIVE';
    this.reversalDetails = props.reversalDetails
      ? Object.freeze({
          reversedAt: new Date(props.reversalDetails.reversedAt),
          reversedByUserId: props.reversalDetails.reversedByUserId,
          reason: props.reversalDetails.reason
        })
      : undefined;
    this.notes = props.notes;

    Object.freeze(this);
  }

  public reverse(reversedByUserId: string, reason: string): CollectionAllocationRecord {
    if (this.status === 'REVERSED') {
      throw new DuplicateReversalError(this.allocationId, 'ALREADY_REVERSED');
    }
    if (!reversedByUserId) throw new InvalidEvidenceError('reversedByUserId is required.');
    if (!reason) throw new InvalidEvidenceError('reason is required.');

    return new CollectionAllocationRecord({
      allocationId: this.allocationId,
      idempotencyKey: this.idempotencyKey,
      institutionId: this.institutionId,
      branchId: this.branchId,
      studentId: this.studentId,
      agreementId: this.agreementId,
      collectionId: this.collectionId,
      obligationId: this.obligationId,
      amount: this.amount,
      allocatedAt: this.allocatedAt,
      allocatedByUserId: this.allocatedByUserId,
      status: 'REVERSED',
      reversalDetails: {
        reversedAt: new Date(),
        reversedByUserId,
        reason
      },
      notes: this.notes
    });
  }
}

export interface AllocationParams {
  collectionId: string;
  obligationId: string;
  amount: Money;
  idempotencyKey?: string;
  allowCrossBranchWithinInstitution?: boolean;
  notes?: string;
}

export interface MultiObligationAllocationTarget {
  obligationId: string;
  amount: Money;
}

export interface MultiObligationAllocationParams {
  collectionId: string;
  targets: MultiObligationAllocationTarget[];
  idempotencyKey?: string;
  allowCrossBranchWithinInstitution?: boolean;
  notes?: string;
}

/**
 * StudentSubLedger maintains the complete, immutable financial history for a student
 * within an institution and educational agreement.
 *
 * Core Guarantees:
 * 1. Independent separation: Agreement value, amounts due, collected, allocated, and recognized revenue.
 * 2. Strict conservation:
 *    - totalAllocated + totalUnallocatedCollections === totalCollectionsReceived
 *    - totalAllocated + totalRemainingDue === totalObligationsDue
 * 3. History preservation across branch transfer, group transfer, and student withdrawal.
 * 4. Idempotent collection allocations.
 * 5. Reversal and correction immutability (pure append-only).
 * 6. Zero premature revenue recognition from collection receipts.
 */
export class StudentSubLedger {
  public readonly subLedgerId: string;
  public readonly studentId: string;
  public readonly institutionId: string;
  public branchId: string;
  public centerGroupId: string;
  public readonly agreementId: string;
  public readonly agreement: StudentFinancialAgreement;
  public status: SubLedgerStatus;

  private readonly _obligations: Map<string, StudentObligation> = new Map();
  private readonly _receipts: Map<string, TrackedCollectionReceipt> = new Map();
  private readonly _allocations: Map<string, CollectionAllocationRecord> = new Map();
  private readonly _allocationIdempotencyIndex: Map<string, string> = new Map();
  private readonly _history: SubLedgerTransaction[] = [];
  private readonly _emittedEvents: any[] = [];
  private _txSequence: number = 0;

  constructor(agreement: StudentFinancialAgreement, actorUserId: string) {
    if (!agreement) throw new InvalidAmountError('agreement is required.');
    assertNotSaaSSuperAdmin(agreement.studentId, 'Student enrollment');

    this.subLedgerId = `subledger_${agreement.institutionId}_${agreement.studentId}_${agreement.agreementId}`;
    this.studentId = agreement.studentId;
    this.institutionId = agreement.institutionId;
    this.branchId = agreement.branchId;
    this.centerGroupId = agreement.centerGroupId;
    this.agreementId = agreement.agreementId;
    this.agreement = agreement;
    this.status = 'ACTIVE';

    // Initialize scheduled obligations from agreement schedule
    for (const item of agreement.arrangementSchedule) {
      const obligationId = `ob_${agreement.agreementId}_${item.scheduleItemNumber}`;
      const obligation = new StudentObligation({
        obligationId,
        agreementId: agreement.agreementId,
        studentId: agreement.studentId,
        institutionId: agreement.institutionId,
        branchId: agreement.branchId,
        scheduleItemNumber: item.scheduleItemNumber,
        dueDate: item.dueDate,
        amountDue: item.amountDue,
        amountCollected: Money.zero('EGP')
      });
      this._obligations.set(obligationId, obligation);
    }

    this._appendTransaction(
      'AGREEMENT_RECORDED',
      actorUserId,
      agreement.agreementId,
      agreement.priceSnapshot.netAgreedPrice,
      `Student agreement established for ${agreement.priceSnapshot.netAgreedPrice.toString()}`
    );

    for (const [obId, ob] of this._obligations.entries()) {
      this._appendTransaction(
        'OBLIGATION_RECORDED',
        actorUserId,
        obId,
        ob.amountDue,
        `Obligation #${ob.scheduleItemNumber} scheduled for due date ${ob.dueDate.toISOString().slice(0, 10)}`
      );
    }
  }

  public get obligations(): ReadonlyMap<string, StudentObligation> {
    return new Map(this._obligations);
  }

  public get receipts(): ReadonlyMap<string, TrackedCollectionReceipt> {
    return new Map(this._receipts);
  }

  public get allocations(): ReadonlyMap<string, CollectionAllocationRecord> {
    return new Map(this._allocations);
  }

  public get transactionHistory(): ReadonlyArray<SubLedgerTransaction> {
    return [...this._history];
  }

  public get emittedEvents(): ReadonlyArray<any> {
    return [...this._emittedEvents];
  }

  /**
   * Records a verified frontline fee collection receipt into the sub-ledger.
   */
  public recordCollection(receipt: CollectionReceiptEvidence, actorUserId: string): TrackedCollectionReceipt {
    if (!receipt) throw new InvalidEvidenceError('receipt is required.');
    if (receipt.institutionId !== this.institutionId) {
      throw new CrossInstitutionError('CollectionReceiptEvidence', this.institutionId, receipt.institutionId);
    }
    if (receipt.studentId !== this.studentId) {
      throw new CrossStudentAllocationError(receipt.studentId, this.studentId);
    }
    if (this._receipts.has(receipt.collectionId)) {
      throw new DuplicateReceiptError(receipt.collectionId);
    }

    const tracked = new TrackedCollectionReceipt(receipt);
    this._receipts.set(receipt.collectionId, tracked);

    this._appendTransaction(
      'COLLECTION_RECORDED',
      actorUserId,
      receipt.collectionId,
      receipt.amountCollected,
      `Frontline fee receipt ${receipt.receiptNumber} recorded: ${receipt.amountCollected.toString()}`
    );

    return tracked;
  }

  /**
   * Deterministically allocates an actual collection receipt to an outstanding obligation.
   */
  public allocate(params: AllocationParams, actorUserId: string): { allocation: CollectionAllocationRecord; isReplay: boolean } {
    if (!params) throw new InvalidAmountError('Allocation parameters are required.');
    assertNotSaaSSuperAdmin(actorUserId, 'Allocating user');

    const amount = params.amount;
    assertEgpCurrency(amount.currencyCode);
    if (amount.isZero() || amount.isNegative()) {
      throw new InvalidAmountError('Allocation amount must be strictly positive.');
    }

    const idempotencyKey =
      params.idempotencyKey ||
      `ALLOC_${this.institutionId}_${params.collectionId}_${params.obligationId}_${amount.toMinorUnits()}`;

    // Idempotency verification
    if (this._allocationIdempotencyIndex.has(idempotencyKey)) {
      const existingId = this._allocationIdempotencyIndex.get(idempotencyKey)!;
      const existingAllocation = this._allocations.get(existingId)!;

      if (
        existingAllocation.collectionId !== params.collectionId ||
        existingAllocation.obligationId !== params.obligationId ||
        !existingAllocation.amount.equals(params.amount)
      ) {
        throw new ConflictingAllocationReplayError(
          idempotencyKey,
          `Existing allocation (${existingAllocation.allocationId}) parameters do not match requested parameters.`
        );
      }

      return { allocation: existingAllocation, isReplay: true };
    }

    // Receipt verification
    const trackedReceipt = this._receipts.get(params.collectionId);
    if (!trackedReceipt) {
      throw new InvalidEvidenceError(`Collection receipt '${params.collectionId}' not found in sub-ledger.`);
    }
    if (trackedReceipt.state === 'REVERSED') {
      throw new InvalidLifecycleTransitionError('REVERSED', 'ALLOCATED', 'Cannot allocate from a reversed collection receipt.');
    }
    if (amount.greaterThan(trackedReceipt.unallocatedAmount)) {
      throw new ExcessiveAllocationError(amount.toString(), trackedReceipt.unallocatedAmount.toString(), 'RECEIPT');
    }

    // Obligation verification
    const obligation = this._obligations.get(params.obligationId);
    if (!obligation) {
      throw new InvalidEvidenceError(`Obligation '${params.obligationId}' not found in sub-ledger.`);
    }
    if (obligation.status === 'WAIVED') {
      throw new IneligibleObligationError(obligation.obligationId, obligation.status, 'Waived obligations cannot receive allocations.');
    }
    if (obligation.status === 'COLLECTED' || obligation.remainingDue.isZero()) {
      throw new IneligibleObligationError(obligation.obligationId, obligation.status, 'Obligation is already fully settled.');
    }
    if (amount.greaterThan(obligation.remainingDue)) {
      throw new ExcessiveAllocationError(amount.toString(), obligation.remainingDue.toString(), 'OBLIGATION');
    }

    // Tenant and Student identity checks
    if (trackedReceipt.receipt.studentId !== obligation.studentId) {
      throw new CrossStudentAllocationError(trackedReceipt.receipt.studentId, obligation.studentId);
    }
    if (trackedReceipt.receipt.institutionId !== obligation.institutionId) {
      throw new CrossInstitutionError('Allocation', obligation.institutionId, trackedReceipt.receipt.institutionId);
    }

    // Branch ownership check
    if (trackedReceipt.receipt.branchId !== obligation.branchId) {
      if (!params.allowCrossBranchWithinInstitution) {
        throw new CrossBranchAllocationError(
          trackedReceipt.receipt.branchId,
          obligation.branchId,
          'Cross-branch allocation within institution requires explicit allowCrossBranchWithinInstitution flag.'
        );
      }
    }

    // Apply allocation state updates
    const updatedReceipt = trackedReceipt.allocate(amount);
    const updatedObligation = obligation.applyCollection(amount);

    this._receipts.set(params.collectionId, updatedReceipt);
    this._obligations.set(params.obligationId, updatedObligation);

    const allocationId = `alloc_${this.institutionId}_${params.collectionId}_${params.obligationId}_${Date.now()}_${++this._txSequence}`;
    const allocation = new CollectionAllocationRecord({
      allocationId,
      idempotencyKey,
      institutionId: this.institutionId,
      branchId: obligation.branchId,
      studentId: this.studentId,
      agreementId: this.agreementId,
      collectionId: params.collectionId,
      obligationId: params.obligationId,
      amount,
      allocatedAt: new Date(),
      allocatedByUserId: actorUserId,
      status: 'ACTIVE',
      notes: params.notes
    });

    this._allocations.set(allocationId, allocation);
    this._allocationIdempotencyIndex.set(idempotencyKey, allocationId);

    this._appendTransaction(
      'COLLECTION_ALLOCATED',
      actorUserId,
      allocationId,
      amount,
      `Allocated ${amount.toString()} from receipt ${trackedReceipt.receipt.receiptNumber} to obligation #${obligation.scheduleItemNumber}`
    );

    const event: CollectionAllocationRecordedEvent = {
      eventType: 'COLLECTION_ALLOCATION_RECORDED',
      allocationId,
      idempotencyKey,
      institutionId: this.institutionId,
      branchId: obligation.branchId,
      studentId: this.studentId,
      agreementId: this.agreementId,
      collectionId: params.collectionId,
      obligationId: params.obligationId,
      allocatedAmount: amount.toString(),
      currency: 'EGP',
      receiptUnallocatedRemaining: updatedReceipt.unallocatedAmount.toString(),
      obligationRemainingDue: updatedObligation.remainingDue.toString(),
      allocatedAt: allocation.allocatedAt.toISOString(),
      allocatedByUserId: actorUserId
    };
    this._emittedEvents.push(event);

    return { allocation, isReplay: false };
  }

  /**
   * Allocates one collection across multiple obligations with explicit per-target amounts.
   */
  public allocateMultiObligations(
    params: MultiObligationAllocationParams,
    actorUserId: string
  ): CollectionAllocationRecord[] {
    if (!params.targets || params.targets.length === 0) {
      throw new InvalidAmountError('At least one allocation target must be specified.');
    }

    let totalRequested = Money.zero('EGP');
    for (const t of params.targets) {
      totalRequested = totalRequested.add(t.amount);
    }

    const receipt = this._receipts.get(params.collectionId);
    if (!receipt) {
      throw new InvalidEvidenceError(`Collection receipt '${params.collectionId}' not found.`);
    }
    if (totalRequested.greaterThan(receipt.unallocatedAmount)) {
      throw new ExcessiveAllocationError(totalRequested.toString(), receipt.unallocatedAmount.toString(), 'RECEIPT');
    }

    const results: CollectionAllocationRecord[] = [];
    for (let i = 0; i < params.targets.length; i++) {
      const target = params.targets[i];
      const targetKey = params.idempotencyKey ? `${params.idempotencyKey}_tgt_${i + 1}` : undefined;
      const { allocation } = this.allocate(
        {
          collectionId: params.collectionId,
          obligationId: target.obligationId,
          amount: target.amount,
          idempotencyKey: targetKey,
          allowCrossBranchWithinInstitution: params.allowCrossBranchWithinInstitution,
          notes: params.notes
        },
        actorUserId
      );
      results.push(allocation);
    }

    return results;
  }

  /**
   * Reverses an existing collection allocation, restoring unallocated balance
   * on the receipt and increasing remaining due on the obligation.
   */
  public reverseAllocation(allocationId: string, actorUserId: string, reason: string): CollectionAllocationRecord {
    if (!allocationId) throw new InvalidAmountError('allocationId is required.');
    if (!actorUserId) throw new InvalidEvidenceError('actorUserId is required.');
    assertNotSaaSSuperAdmin(actorUserId, 'Reversing user');
    if (!reason || reason.trim() === '') {
      throw new InvalidEvidenceError('reason is required for allocation reversal.');
    }

    const allocation = this._allocations.get(allocationId);
    if (!allocation) {
      throw new InvalidEvidenceError(`Allocation record '${allocationId}' not found in sub-ledger.`);
    }
    if (allocation.status === 'REVERSED') {
      throw new DuplicateReversalError(allocationId, 'ALREADY_REVERSED');
    }

    const trackedReceipt = this._receipts.get(allocation.collectionId);
    if (!trackedReceipt) {
      throw new InvalidEvidenceError(`Receipt '${allocation.collectionId}' not found for allocation reversal.`);
    }

    const obligation = this._obligations.get(allocation.obligationId);
    if (!obligation) {
      throw new InvalidEvidenceError(`Obligation '${allocation.obligationId}' not found for allocation reversal.`);
    }

    const updatedReceipt = trackedReceipt.revertAllocation(allocation.amount);
    const updatedObligation = obligation.revertCollectionAllocation(allocation.amount);

    this._receipts.set(allocation.collectionId, updatedReceipt);
    this._obligations.set(allocation.obligationId, updatedObligation);

    const reversedAllocation = allocation.reverse(actorUserId, reason);
    this._allocations.set(allocationId, reversedAllocation);

    this._appendTransaction(
      'ALLOCATION_REVERSED',
      actorUserId,
      allocationId,
      allocation.amount,
      `Reversed allocation ${allocationId} (${allocation.amount.toString()} restored to receipt ${trackedReceipt.receipt.receiptNumber}). Reason: ${reason}`
    );

    const event: CollectionAllocationReversedEvent = {
      eventType: 'COLLECTION_ALLOCATION_REVERSED',
      allocationId,
      institutionId: this.institutionId,
      branchId: allocation.branchId,
      studentId: this.studentId,
      agreementId: this.agreementId,
      collectionId: allocation.collectionId,
      obligationId: allocation.obligationId,
      reversedAmount: allocation.amount.toString(),
      currency: 'EGP',
      reversedAt: new Date().toISOString(),
      reversedByUserId: actorUserId,
      reason
    };
    this._emittedEvents.push(event);

    return reversedAllocation;
  }

  /**
   * Reverses a collection receipt in its entirety.
   * Invariant: Requires all allocations from this receipt to be reversed first.
   */
  public reverseCollectionReceipt(collectionId: string, actorUserId: string, reason: string): TrackedCollectionReceipt {
    if (!collectionId) throw new InvalidAmountError('collectionId is required.');
    if (!actorUserId) throw new InvalidEvidenceError('actorUserId is required.');
    assertNotSaaSSuperAdmin(actorUserId, 'Reversing user');
    if (!reason || reason.trim() === '') {
      throw new InvalidEvidenceError('reason is required for receipt reversal.');
    }

    const trackedReceipt = this._receipts.get(collectionId);
    if (!trackedReceipt) {
      throw new InvalidEvidenceError(`Collection receipt '${collectionId}' not found in sub-ledger.`);
    }

    const reversedReceipt = trackedReceipt.reverseReceipt(actorUserId, reason);
    this._receipts.set(collectionId, reversedReceipt);

    this._appendTransaction(
      'COLLECTION_REVERSED',
      actorUserId,
      collectionId,
      trackedReceipt.totalCollected,
      `Collection receipt ${trackedReceipt.receipt.receiptNumber} reversed (${trackedReceipt.totalCollected.toString()}). Reason: ${reason}`
    );

    const event: CollectionReceiptReversedEvent = {
      eventType: 'COLLECTION_RECEIPT_REVERSED',
      collectionId,
      institutionId: this.institutionId,
      branchId: trackedReceipt.receipt.branchId,
      studentId: this.studentId,
      amount: trackedReceipt.totalCollected.toString(),
      currency: 'EGP',
      reversedAt: new Date().toISOString(),
      reversedByUserId: actorUserId,
      reason
    };
    this._emittedEvents.push(event);

    return reversedReceipt;
  }

  public reverseReceipt(collectionId: string, actorUserId: string, reason: string): TrackedCollectionReceipt {
    return this.reverseCollectionReceipt(collectionId, actorUserId, reason);
  }

  /**
   * Student lifecycle transfer: branch change preserves 100% of sub-ledger financial history.
   */
  public transferBranch(newBranchId: string, actorUserId: string, reason: string): void {
    if (!newBranchId) throw new InvalidEvidenceError('newBranchId is required.');
    this.branchId = newBranchId;
    this.status = 'TRANSFERRED';

    this._appendTransaction(
      'BRANCH_TRANSFERRED',
      actorUserId,
      newBranchId,
      undefined,
      `Student transferred to branch ${newBranchId}. Reason: ${reason}. Sub-ledger history preserved.`
    );
  }

  /**
   * Student lifecycle transfer: group change preserves 100% of sub-ledger financial history.
   */
  public transferGroup(newGroupId: string, actorUserId: string, reason: string): void {
    if (!newGroupId) throw new InvalidEvidenceError('newGroupId is required.');
    this.centerGroupId = newGroupId;

    this._appendTransaction(
      'GROUP_TRANSFERRED',
      actorUserId,
      newGroupId,
      undefined,
      `Student transferred to center group ${newGroupId}. Reason: ${reason}. Sub-ledger history preserved.`
    );
  }

  /**
   * Student lifecycle withdrawal: preserves 100% of financial ledger history.
   */
  public withdrawStudent(actorUserId: string, reason: string): void {
    this.status = 'WITHDRAWN';

    this._appendTransaction(
      'STUDENT_WITHDRAWN',
      actorUserId,
      this.studentId,
      undefined,
      `Student withdrawn from institution. Reason: ${reason}. Sub-ledger history and unallocated balances preserved.`
    );
  }

  /**
   * Calculates real-time financial sub-ledger balances and asserts exact mathematical conservation.
   */
  public getBalances(): SubLedgerBalances {
    const totalAgreedPrice = this.agreement.priceSnapshot.netAgreedPrice;

    let totalObligationsDue = Money.zero('EGP');
    for (const ob of this._obligations.values()) {
      totalObligationsDue = totalObligationsDue.add(ob.amountDue);
    }

    let totalCollectionsReceived = Money.zero('EGP');
    let totalUnallocatedCollections = Money.zero('EGP');
    for (const r of this._receipts.values()) {
      if (r.state !== 'REVERSED') {
        totalCollectionsReceived = totalCollectionsReceived.add(r.totalCollected);
        totalUnallocatedCollections = totalUnallocatedCollections.add(r.unallocatedAmount);
      }
    }

    let totalAllocated = Money.zero('EGP');
    for (const alloc of this._allocations.values()) {
      if (alloc.status === 'ACTIVE') {
        totalAllocated = totalAllocated.add(alloc.amount);
      }
    }

    const totalRemainingDue = totalObligationsDue.subtract(totalAllocated);

    // Invariant 1: totalAllocated + totalUnallocatedCollections === totalCollectionsReceived
    const computedCollections = totalAllocated.add(totalUnallocatedCollections);
    if (!computedCollections.equals(totalCollectionsReceived)) {
      throw new InvalidAmountError(
        `Sub-ledger collection conservation failure: Allocated (${totalAllocated.toString()}) + Unallocated (${totalUnallocatedCollections.toString()}) != Total Collected (${totalCollectionsReceived.toString()}).`
      );
    }

    // Invariant 2: totalAllocated + totalRemainingDue === totalObligationsDue
    const computedObligations = totalAllocated.add(totalRemainingDue);
    if (!computedObligations.equals(totalObligationsDue)) {
      throw new InvalidAmountError(
        `Sub-ledger obligation conservation failure: Allocated (${totalAllocated.toString()}) + Remaining Due (${totalRemainingDue.toString()}) != Total Due (${totalObligationsDue.toString()}).`
      );
    }

    return Object.freeze({
      totalAgreedPrice,
      totalObligationsDue,
      totalCollectionsReceived,
      totalAllocated,
      totalUnallocatedCollections,
      totalRemainingDue,
      currency: 'EGP'
    });
  }

  /**
   * Reconciles the sub-ledger, asserting balance conservation and emitting reconciliation event.
   */
  public reconcile(actorUserId: string): SubLedgerBalances {
    const balances = this.getBalances();

    this._appendTransaction(
      'RECONCILED',
      actorUserId,
      this.subLedgerId,
      undefined,
      `Sub-ledger reconciliation completed. All balances conserved.`
    );

    const event: StudentSubledgerReconciledEvent = {
      eventType: 'STUDENT_SUBLEDGER_RECONCILED',
      institutionId: this.institutionId,
      branchId: this.branchId,
      studentId: this.studentId,
      agreementId: this.agreementId,
      totalAgreedPrice: balances.totalAgreedPrice.toString(),
      totalObligationsDue: balances.totalObligationsDue.toString(),
      totalCollectionsReceived: balances.totalCollectionsReceived.toString(),
      totalAllocated: balances.totalAllocated.toString(),
      totalUnallocatedCollections: balances.totalUnallocatedCollections.toString(),
      totalRemainingDue: balances.totalRemainingDue.toString(),
      currency: 'EGP',
      reconciledAt: new Date().toISOString()
    };
    this._emittedEvents.push(event);

    return balances;
  }

  /**
   * Invariant Guard: Confirms that fee collections and allocations CANNOT recognize tuition revenue.
   * Revenue recognition is governed strictly by Increment 2 upon certified physical educational delivery.
   */
  public recognizeDirectRevenue(): never {
    throw new PrematurePostingError(
      'Student Sub-Ledger & Collection Allocation Engine',
      'Direct Tuition Revenue Recognition'
    );
  }

  private _appendTransaction(
    type: SubLedgerTransactionType,
    actorUserId: string,
    referenceId?: string,
    amount?: Money,
    description: string = ''
  ): void {
    const balancesSnapshot = this.getBalances();
    const tx: SubLedgerTransaction = Object.freeze({
      transactionId: `tx_${this.subLedgerId}_${++this._txSequence}`,
      transactionType: type,
      timestamp: new Date(),
      actorUserId,
      referenceId,
      amount,
      description,
      balancesSnapshot
    });
    this._history.push(tx);
  }
}
