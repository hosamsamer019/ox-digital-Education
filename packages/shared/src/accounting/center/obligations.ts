/**
 * OX-DIGITAL Education — Financial Core Engine
 * Phase 2.0B — Physical Education Center Accounting Integration
 * Amounts Due & Actual Collection Evidence
 */

import { Money } from '../money.js';
import {
  InvalidAmountError,
  PrematurePostingError,
  InvalidEvidenceError
} from '../errors.js';
import { assertApprovedRole, assertNotSaaSSuperAdmin, CenterRole } from './roles.js';
import { assertEgpCurrency } from './agreement.js';

export type ObligationStatus =
  | 'PENDING'
  | 'PARTIALLY_COLLECTED'
  | 'COLLECTED'
  | 'OVERDUE'
  | 'WAIVED';

export interface StudentObligationProps {
  obligationId: string;
  agreementId: string;
  studentId: string;
  institutionId: string;
  branchId: string;
  scheduleItemNumber: number;
  dueDate: Date;
  amountDue: Money;
  amountCollected?: Money;
  status?: ObligationStatus;
}

/**
 * StudentObligation represents an amount due under an active payment arrangement.
 * Tracks amountDue, amountCollected, and remainingDue in EGP minor units.
 */
export class StudentObligation {
  public readonly obligationId: string;
  public readonly agreementId: string;
  public readonly studentId: string;
  public readonly institutionId: string;
  public readonly branchId: string;
  public readonly scheduleItemNumber: number;
  public readonly dueDate: Date;
  public readonly amountDue: Money;
  public readonly amountCollected: Money;
  public readonly remainingDue: Money;
  public readonly status: ObligationStatus;

  constructor(props: StudentObligationProps) {
    if (!props.obligationId) throw new InvalidAmountError('obligationId is required.');
    if (!props.agreementId) throw new InvalidAmountError('agreementId is required.');
    if (!props.studentId) throw new InvalidAmountError('studentId is required.');
    assertNotSaaSSuperAdmin(props.studentId, 'Student obligation');
    if (!props.institutionId) throw new InvalidAmountError('institutionId is required.');
    if (!props.branchId) throw new InvalidAmountError('branchId is required.');

    assertEgpCurrency(props.amountDue.currencyCode);
    const collected = props.amountCollected || Money.zero('EGP');
    assertEgpCurrency(collected.currencyCode);

    if (collected.isNegative()) {
      throw new InvalidAmountError('amountCollected cannot be negative.');
    }

    const remaining = props.amountDue.subtract(collected);
    if (remaining.isNegative()) {
      throw new InvalidAmountError('amountCollected cannot exceed amountDue on a single obligation.');
    }

    let resolvedStatus: ObligationStatus = 'PENDING';
    if (props.status === 'WAIVED') {
      resolvedStatus = 'WAIVED';
    } else if (remaining.isZero()) {
      resolvedStatus = 'COLLECTED';
    } else if (collected.isPositive()) {
      resolvedStatus = 'PARTIALLY_COLLECTED';
    } else if (props.status === 'OVERDUE') {
      resolvedStatus = 'OVERDUE';
    }

    this.obligationId = props.obligationId;
    this.agreementId = props.agreementId;
    this.studentId = props.studentId;
    this.institutionId = props.institutionId;
    this.branchId = props.branchId;
    this.scheduleItemNumber = props.scheduleItemNumber;
    this.dueDate = new Date(props.dueDate);
    this.amountDue = props.amountDue;
    this.amountCollected = collected;
    this.remainingDue = remaining;
    this.status = resolvedStatus;

    Object.freeze(this);
  }

  /**
   * Applies an actual collection to this obligation.
   */
  public applyCollection(collectionAmount: Money): StudentObligation {
    assertEgpCurrency(collectionAmount.currencyCode);
    if (collectionAmount.isZero() || collectionAmount.isNegative()) {
      throw new InvalidAmountError('Collection amount applied must be strictly positive.');
    }

    const newCollected = this.amountCollected.add(collectionAmount);
    return new StudentObligation({
      obligationId: this.obligationId,
      agreementId: this.agreementId,
      studentId: this.studentId,
      institutionId: this.institutionId,
      branchId: this.branchId,
      scheduleItemNumber: this.scheduleItemNumber,
      dueDate: this.dueDate,
      amountDue: this.amountDue,
      amountCollected: newCollected
    });
  }

  /**
   * Reverses an allocated collection from this obligation, restoring remainingDue.
   */
  public revertCollectionAllocation(reversalAmount: Money): StudentObligation {
    assertEgpCurrency(reversalAmount.currencyCode);
    if (reversalAmount.isZero() || reversalAmount.isNegative()) {
      throw new InvalidAmountError('Reversal amount must be strictly positive.');
    }
    const newCollected = this.amountCollected.subtract(reversalAmount);
    if (newCollected.isNegative()) {
      throw new InvalidAmountError('Reversal amount cannot exceed previously collected amount on obligation.');
    }
    return new StudentObligation({
      obligationId: this.obligationId,
      agreementId: this.agreementId,
      studentId: this.studentId,
      institutionId: this.institutionId,
      branchId: this.branchId,
      scheduleItemNumber: this.scheduleItemNumber,
      dueDate: this.dueDate,
      amountDue: this.amountDue,
      amountCollected: newCollected
    });
  }
}

export type PaymentMethod = 'CASH' | 'POS' | 'CHEQUE';
export type CollectionStatus = 'COLLECTED' | 'DEPOSITED' | 'REVERSED';

export interface CollectionReceiptEvidenceProps {
  collectionId: string;
  institutionId: string;
  branchId: string;
  isPhysicalBranch: boolean;
  cashboxId: string;
  cashierUserId: string;
  cashierRole: CenterRole;
  studentId: string;
  obligationId?: string;
  amountCollected: Money;
  collectedAt: Date;
  receiptNumber: string;
  paymentMethod: PaymentMethod;
  status?: CollectionStatus;
  notes?: string;
}

/**
 * CollectionReceiptEvidence represents verified proof of an actual fee receipt
 * at an educational center cashbox.
 *
 * Core Guarantees:
 * 1. Cashbox operations are strictly restricted to physical campus branches.
 * 2. Cashier must possess the 'CASHIER' or 'PRIMARY_MANAGER' role.
 * 3. Cashier and student cannot be admin@edu.com.
 * 4. Actual collections are held in liability/unearned revenue until verified delivery.
 */
export class CollectionReceiptEvidence {
  public readonly collectionId: string;
  public readonly institutionId: string;
  public readonly branchId: string;
  public readonly isPhysicalBranch: boolean;
  public readonly cashboxId: string;
  public readonly cashierUserId: string;
  public readonly cashierRole: CenterRole;
  public readonly studentId: string;
  public readonly obligationId?: string;
  public readonly amountCollected: Money;
  public readonly collectedAt: Date;
  public readonly receiptNumber: string;
  public readonly paymentMethod: PaymentMethod;
  public readonly status: CollectionStatus;
  public readonly notes?: string;

  constructor(props: CollectionReceiptEvidenceProps) {
    if (!props.collectionId) throw new InvalidEvidenceError('collectionId is required.');
    if (!props.institutionId) throw new InvalidEvidenceError('institutionId is required.');
    if (!props.branchId) throw new InvalidEvidenceError('branchId is required.');
    if (!props.isPhysicalBranch) {
      throw new InvalidEvidenceError(
        `Physical Cashbox Invariant: Cashbox collections are permitted only at physical educational center branches. Branch '${props.branchId}' is non-physical.`
      );
    }
    if (!props.cashboxId) throw new InvalidEvidenceError('cashboxId is required.');
    if (!props.cashierUserId) throw new InvalidEvidenceError('cashierUserId is required.');
    assertNotSaaSSuperAdmin(props.cashierUserId, 'Cashier role');
    assertNotSaaSSuperAdmin(props.studentId, 'Student');

    const role = assertApprovedRole(props.cashierRole);
    if (role !== 'CASHIER' && role !== 'PRIMARY_MANAGER') {
      throw new InvalidEvidenceError(
        `Cashier authority error: Only a Cashier or Primary Manager can collect fees. Provided role: '${props.cashierRole}'.`
      );
    }

    assertEgpCurrency(props.amountCollected.currencyCode);
    if (props.amountCollected.isZero() || props.amountCollected.isNegative()) {
      throw new InvalidAmountError('amountCollected must be strictly positive.');
    }
    if (!props.receiptNumber || props.receiptNumber.trim() === '') {
      throw new InvalidEvidenceError('receiptNumber is required for audit trail.');
    }

    this.collectionId = props.collectionId;
    this.institutionId = props.institutionId;
    this.branchId = props.branchId;
    this.isPhysicalBranch = props.isPhysicalBranch;
    this.cashboxId = props.cashboxId;
    this.cashierUserId = props.cashierUserId;
    this.cashierRole = role;
    this.studentId = props.studentId;
    this.obligationId = props.obligationId;
    this.amountCollected = props.amountCollected;
    this.collectedAt = new Date(props.collectedAt);
    this.receiptNumber = props.receiptNumber.trim();
    this.paymentMethod = props.paymentMethod;
    this.status = props.status || 'COLLECTED';
    this.notes = props.notes;

    Object.freeze(this);
  }

  /**
   * Invariant Guard: Confirms that fee collection alone CANNOT recognize revenue.
   * Under accrual accounting, unearned collections represent unearned tuition liabilities (Account 2210).
   */
  public recognizeDirectRevenue(): never {
    throw new PrematurePostingError(
      'Lifecycle C (Fee Collection Receipt)',
      'Direct Tuition Revenue Recognition'
    );
  }
}
