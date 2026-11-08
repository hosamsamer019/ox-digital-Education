/**
 * OX-DIGITAL Education — Financial Core Engine
 * Phase 2.0B — Physical Education Center Accounting Integration
 * Student Financial Agreements & Immutable Price Snapshots
 */

import { Money } from '../money.js';
import {
  ForbiddenTerminologyError,
  MultiCurrencyDisabledError,
  PrematurePostingError,
  InvalidAmountError
} from '../errors.js';
import { assertNotSaaSSuperAdmin } from './roles.js';

export const FORBIDDEN_TERMINOLOGY_REGEX = /\binstallments?\b/i;

/**
 * Validates customer-facing text to ensure strict compliance with approved terminology:
 * "payment arrangement", "payment schedule", "due", "collected", "remaining".
 * Rejects "installment" or "installments" (Phase 2.0B Invariant 11).
 */
export function assertApprovedTerminology(text: string, fieldName: string): void {
  if (FORBIDDEN_TERMINOLOGY_REGEX.test(text)) {
    const match = text.match(FORBIDDEN_TERMINOLOGY_REGEX);
    throw new ForbiddenTerminologyError(fieldName, match ? match[0] : 'installment');
  }
}

/**
 * Validates that currency is strictly EGP launch currency. Multi-currency remains disabled.
 */
export function assertEgpCurrency(currency: string): void {
  if (currency.toUpperCase() !== 'EGP') {
    throw new MultiCurrencyDisabledError(currency);
  }
}

export interface AgreementPriceSnapshotProps {
  catalogPrice: Money;
  discountAmount?: Money;
  netAgreedPrice: Money;
  frozenAt?: Date;
}

/**
 * AgreementPriceSnapshot is an immutable value object capturing the frozen
 * financial agreement rates at the moment of enrollment.
 */
export class AgreementPriceSnapshot {
  public readonly catalogPrice: Money;
  public readonly discountAmount: Money;
  public readonly netAgreedPrice: Money;
  public readonly currency: 'EGP';
  public readonly frozenAt: Date;

  constructor(props: AgreementPriceSnapshotProps) {
    assertEgpCurrency(props.catalogPrice.currencyCode);
    assertEgpCurrency(props.netAgreedPrice.currencyCode);
    if (props.discountAmount) {
      assertEgpCurrency(props.discountAmount.currencyCode);
    }

    const discount = props.discountAmount || Money.zero('EGP');

    // Invariant: catalogPrice - discount === netAgreedPrice
    const calculatedNet = props.catalogPrice.subtract(discount);
    if (!calculatedNet.equals(props.netAgreedPrice)) {
      throw new InvalidAmountError(
        `Agreement price calculation mismatch: Catalog price (${props.catalogPrice.toString()}) minus discount (${discount.toString()}) must equal net agreed price (${props.netAgreedPrice.toString()}). Calculated: ${calculatedNet.toString()}.`
      );
    }

    this.catalogPrice = props.catalogPrice;
    this.discountAmount = discount;
    this.netAgreedPrice = props.netAgreedPrice;
    this.currency = 'EGP';
    this.frozenAt = props.frozenAt ? new Date(props.frozenAt) : new Date();

    Object.freeze(this);
  }
}

export interface PaymentArrangementScheduleItemProps {
  scheduleItemNumber: number;
  dueDate: Date;
  amountDue: Money;
  description: string;
}

/**
 * PaymentArrangementScheduleItem represents a scheduled payment due under an agreement.
 * Rejects "installment" terminology; enforces EGP.
 */
export class PaymentArrangementScheduleItem {
  public readonly scheduleItemNumber: number;
  public readonly dueDate: Date;
  public readonly amountDue: Money;
  public readonly description: string;

  constructor(props: PaymentArrangementScheduleItemProps) {
    if (props.scheduleItemNumber <= 0 || !Number.isInteger(props.scheduleItemNumber)) {
      throw new InvalidAmountError(`scheduleItemNumber must be a positive integer. Received: ${props.scheduleItemNumber}`);
    }
    assertEgpCurrency(props.amountDue.currencyCode);
    if (props.amountDue.isZero() || props.amountDue.isNegative()) {
      throw new InvalidAmountError('amountDue in payment arrangement must be strictly positive.');
    }
    assertApprovedTerminology(props.description, `scheduleItem[${props.scheduleItemNumber}].description`);

    this.scheduleItemNumber = props.scheduleItemNumber;
    this.dueDate = new Date(props.dueDate);
    this.amountDue = props.amountDue;
    this.description = props.description;

    Object.freeze(this);
  }
}

export type AgreementStatus =
  | 'DRAFT'
  | 'ACTIVE'
  | 'COMPLETED'
  | 'TERMINATED'
  | 'TRANSFERRED';

export interface StudentFinancialAgreementProps {
  agreementId: string;
  studentId: string;
  centerGroupId: string;
  institutionId: string;
  branchId: string;
  priceSnapshot: AgreementPriceSnapshot;
  arrangementSchedule: PaymentArrangementScheduleItem[];
  status?: AgreementStatus;
  termsNotes?: string;
  createdAt?: Date;
  activatedAt?: Date;
  terminatedAt?: Date;
  transferDetails?: {
    priorBranchId: string;
    priorCenterGroupId: string;
    transferredAt: Date;
  };
}

/**
 * StudentFinancialAgreement represents the contractual payment arrangement between
 * a student and an educational institution for physical educational center attendance.
 *
 * Core Invariants:
 * 1. Agreement value != recognized revenue. (Signing creates an arrangement, NOT earned revenue).
 * 2. Accrual principle: Revenue is recognized only upon verified lesson delivery.
 * 3. Sum of scheduled amounts due must exactly equal netAgreedPrice.
 * 4. Preserves complete financial history after transfer or withdrawal.
 * 5. Rejects "installments" in customer terms.
 * 6. SaaS super-admin (admin@edu.com) cannot be the student.
 */
export class StudentFinancialAgreement {
  public readonly agreementId: string;
  public readonly studentId: string;
  public readonly centerGroupId: string;
  public readonly institutionId: string;
  public readonly branchId: string;
  public readonly priceSnapshot: AgreementPriceSnapshot;
  public readonly arrangementSchedule: ReadonlyArray<PaymentArrangementScheduleItem>;
  public readonly status: AgreementStatus;
  public readonly termsNotes?: string;
  public readonly createdAt: Date;
  public readonly activatedAt?: Date;
  public readonly terminatedAt?: Date;
  public readonly transferDetails?: Readonly<{
    priorBranchId: string;
    priorCenterGroupId: string;
    transferredAt: Date;
  }>;

  constructor(props: StudentFinancialAgreementProps) {
    if (!props.agreementId) throw new InvalidAmountError('agreementId is required.');
    if (!props.studentId) throw new InvalidAmountError('studentId is required.');
    assertNotSaaSSuperAdmin(props.studentId, 'Student enrollment');
    if (!props.centerGroupId) throw new InvalidAmountError('centerGroupId is required.');
    if (!props.institutionId) throw new InvalidAmountError('institutionId is required.');
    if (!props.branchId) throw new InvalidAmountError('branchId is required.');

    if (props.termsNotes) {
      assertApprovedTerminology(props.termsNotes, 'termsNotes');
    }

    if (!props.arrangementSchedule || props.arrangementSchedule.length === 0) {
      throw new InvalidAmountError('Student financial agreement must contain at least one payment arrangement schedule item.');
    }

    // Verify sum of arrangement schedule amounts due equals priceSnapshot.netAgreedPrice
    let scheduleSum = Money.zero('EGP');
    for (const item of props.arrangementSchedule) {
      scheduleSum = scheduleSum.add(item.amountDue);
    }

    if (!scheduleSum.equals(props.priceSnapshot.netAgreedPrice)) {
      throw new InvalidAmountError(
        `Payment schedule reconciliation error: Total scheduled amounts due (${scheduleSum.toString()}) does not match net agreed price (${props.priceSnapshot.netAgreedPrice.toString()}). Penny-exact agreement balance is mandatory.`
      );
    }

    this.agreementId = props.agreementId;
    this.studentId = props.studentId;
    this.centerGroupId = props.centerGroupId;
    this.institutionId = props.institutionId;
    this.branchId = props.branchId;
    this.priceSnapshot = props.priceSnapshot;
    this.arrangementSchedule = Object.freeze([...props.arrangementSchedule]);
    this.status = props.status || 'DRAFT';
    this.termsNotes = props.termsNotes;
    this.createdAt = props.createdAt ? new Date(props.createdAt) : new Date();
    this.activatedAt = props.activatedAt ? new Date(props.activatedAt) : undefined;
    this.terminatedAt = props.terminatedAt ? new Date(props.terminatedAt) : undefined;
    this.transferDetails = props.transferDetails ? Object.freeze({ ...props.transferDetails }) : undefined;

    Object.freeze(this);
  }

  /**
   * Activates the agreement.
   * Crucial Guarantee: Activation establishes the payment arrangement; it does NOT recognize revenue.
   */
  public activate(activatedAt: Date = new Date()): StudentFinancialAgreement {
    if (this.status === 'ACTIVE') return this;
    if (this.status !== 'DRAFT') {
      throw new InvalidAmountError(`Cannot activate agreement currently in '${this.status}' state.`);
    }

    return new StudentFinancialAgreement({
      ...this,
      arrangementSchedule: [...this.arrangementSchedule],
      status: 'ACTIVE',
      activatedAt
    });
  }

  /**
   * Preserves historical student financial ledger while transferring to another campus group.
   */
  public transferTo(newBranchId: string, newCenterGroupId: string, transferredAt: Date = new Date()): StudentFinancialAgreement {
    return new StudentFinancialAgreement({
      ...this,
      branchId: newBranchId,
      centerGroupId: newCenterGroupId,
      arrangementSchedule: [...this.arrangementSchedule],
      status: 'TRANSFERRED',
      transferDetails: {
        priorBranchId: this.branchId,
        priorCenterGroupId: this.centerGroupId,
        transferredAt
      }
    });
  }

  /**
   * Invariant Guard: Confirms that agreement signing CANNOT post revenue to general ledger.
   */
  public postToGeneralLedger(): never {
    throw new PrematurePostingError(
      'Lifecycle B (Student Agreement & Payment Arrangement)',
      'Direct Revenue Journal Posting'
    );
  }
}
