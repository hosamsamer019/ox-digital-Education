/**
 * OX-DIGITAL Education — Financial Core Engine
 * Phase 2.0B — Increment 2: Accrual Revenue Recognition Pairing Engine
 * Service Value Allocation & Pricing Engine
 */

import { Money } from '../money.js';
import {
  UnsupportedAllocationBasisError,
  ExcessiveRevenueRecognitionError,
  InvalidAmountError
} from '../errors.js';
import { StudentFinancialAgreement } from './agreement.js';

export interface RevenueAllocationPlanProps {
  agreementId: string;
  netAgreedPrice: Money;
  totalEligibleUnits: number;
  recognizedUnitsCount?: number;
  accumulatedRecognizedAmount?: Money;
}

/**
 * RevenueAllocationPlan manages the deterministic, penny-exact service value
 * allocation for a student financial agreement.
 *
 * Invariants:
 * 1. totalEligibleUnits must be a positive integer > 0.
 * 2. unitServiceValue is calculated via DecimalValue division with HALF_UP rounding.
 * 3. Total recognized revenue can never exceed netAgreedPrice.
 * 4. The final remaining unit absorbs any penny rounding remainder so the
 *    sum of recognized units matches netAgreedPrice exactly.
 */
export class RevenueAllocationPlan {
  public readonly agreementId: string;
  public readonly netAgreedPrice: Money;
  public readonly totalEligibleUnits: number;
  public readonly recognizedUnitsCount: number;
  public readonly accumulatedRecognizedAmount: Money;

  constructor(props: RevenueAllocationPlanProps) {
    if (!props.agreementId) {
      throw new InvalidAmountError('agreementId is required.');
    }
    if (!props.netAgreedPrice || props.netAgreedPrice.isNegative() || props.netAgreedPrice.isZero()) {
      throw new InvalidAmountError('netAgreedPrice must be strictly positive.');
    }
    if (!props.totalEligibleUnits || props.totalEligibleUnits <= 0 || !Number.isInteger(props.totalEligibleUnits)) {
      throw new UnsupportedAllocationBasisError(
        `totalEligibleUnits must be a positive integer greater than zero. Received: ${props.totalEligibleUnits}. Cannot allocate service value without an approved unit basis.`
      );
    }

    const accumulated = props.accumulatedRecognizedAmount || Money.zero('EGP');
    const units = props.recognizedUnitsCount || 0;

    if (accumulated.greaterThan(props.netAgreedPrice)) {
      throw new ExcessiveRevenueRecognitionError(
        props.netAgreedPrice.toString(),
        accumulated.toString()
      );
    }

    this.agreementId = props.agreementId;
    this.netAgreedPrice = props.netAgreedPrice;
    this.totalEligibleUnits = props.totalEligibleUnits;
    this.recognizedUnitsCount = units;
    this.accumulatedRecognizedAmount = accumulated;

    Object.freeze(this);
  }

  /**
   * Initializes a plan from a StudentFinancialAgreement.
   */
  public static fromAgreement(
    agreement: StudentFinancialAgreement,
    totalLessonsInAgreement: number,
    recognizedUnitsCount: number = 0,
    accumulatedRecognizedAmount: Money = Money.zero('EGP')
  ): RevenueAllocationPlan {
    return new RevenueAllocationPlan({
      agreementId: agreement.agreementId,
      netAgreedPrice: agreement.priceSnapshot.netAgreedPrice,
      totalEligibleUnits: totalLessonsInAgreement,
      recognizedUnitsCount,
      accumulatedRecognizedAmount
    });
  }

  /**
   * Returns remaining unearned service value.
   */
  public get remainingUnearnedAmount(): Money {
    return this.netAgreedPrice.subtract(this.accumulatedRecognizedAmount);
  }

  /**
   * Returns true if all eligible units have been recognized.
   */
  public get isFullyRecognized(): boolean {
    return (
      this.recognizedUnitsCount >= this.totalEligibleUnits ||
      this.remainingUnearnedAmount.isZero()
    );
  }

  /**
   * Calculates the exact recognition amount for the next eligible delivered unit.
   * On the final unit, deterministically allocates remainingUnearnedAmount to avoid penny loss.
   */
  public calculateNextUnitRecognitionAmount(): Money {
    if (this.isFullyRecognized) {
      throw new ExcessiveRevenueRecognitionError(
        this.netAgreedPrice.toString(),
        this.accumulatedRecognizedAmount.toString()
      );
    }

    const nextUnitIndex = this.recognizedUnitsCount + 1;

    // Final unit absorbs any penny remainder
    if (nextUnitIndex >= this.totalEligibleUnits) {
      return this.remainingUnearnedAmount;
    }

    // Standard unit calculation: netAgreedPrice / totalEligibleUnits with HALF_UP
    const standardUnitValue = this.netAgreedPrice.divide(this.totalEligibleUnits, 'HALF_UP');

    // Invariant: never exceed remaining unearned amount
    if (standardUnitValue.greaterThan(this.remainingUnearnedAmount)) {
      return this.remainingUnearnedAmount;
    }

    return standardUnitValue;
  }

  /**
   * Advances the plan after recognizing one unit.
   */
  public advance(recognizedAmount: Money): RevenueAllocationPlan {
    const newAccumulated = this.accumulatedRecognizedAmount.add(recognizedAmount);
    return new RevenueAllocationPlan({
      agreementId: this.agreementId,
      netAgreedPrice: this.netAgreedPrice,
      totalEligibleUnits: this.totalEligibleUnits,
      recognizedUnitsCount: this.recognizedUnitsCount + 1,
      accumulatedRecognizedAmount: newAccumulated
    });
  }
}

