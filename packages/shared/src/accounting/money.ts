/**
 * OX-DIGITAL Education — Financial Core Engine
 * Module A — Money & Currency Foundation
 * Exact Decimal Monetary Arithmetic (Zero Floating-Point)
 */

import { CurrencyMismatchError, InvalidAmountError, MultiCurrencyDisabledError } from './errors.js';

export type CurrencyCode = 'EGP' | string;

export interface CurrencyDefinition {
  code: string;
  numericCode: number;
  minorUnits: number;
  symbol: string;
  name: string;
}

/**
 * ISO 4217 Currency Registry
 * EGP is the primary operational currency (OD-725).
 */
export const CURRENCY_REGISTRY: Record<string, CurrencyDefinition> = {
  EGP: {
    code: 'EGP',
    numericCode: 818,
    minorUnits: 2,
    symbol: 'E£',
    name: 'Egyptian Pound'
  }
};

export type RoundingMode = 'HALF_UP' | 'HALF_EVEN' | 'CEILING' | 'FLOOR' | 'TRUNCATE';

/**
 * Pure Exact Decimal Value implementation using BigInt.
 * Guarantees zero floating-point approximation errors.
 */
export class DecimalValue {
  public readonly unscaled: bigint;
  public readonly scale: number;

  constructor(unscaled: bigint, scale: number = 0) {
    if (scale < 0 || !Number.isInteger(scale)) {
      throw new InvalidAmountError(`Decimal scale must be a non-negative integer. Received: ${scale}`);
    }
    this.unscaled = unscaled;
    this.scale = scale;
  }

  public static zero(scale: number = 2): DecimalValue {
    return new DecimalValue(0n, scale);
  }

  public static fromString(valueStr: string): DecimalValue {
    if (typeof valueStr !== 'string') {
      throw new InvalidAmountError(`Expected string input for DecimalValue, received: ${typeof valueStr}`);
    }
    const trimmed = valueStr.trim();
    if (!trimmed || trimmed === 'NaN' || trimmed === 'Infinity' || trimmed === '-Infinity') {
      throw new InvalidAmountError(`Invalid numeric string representation: '${valueStr}'`);
    }

    const regex = /^([+-])?(\d+)(?:\.(\d+))?$/;
    const match = trimmed.match(regex);
    if (!match) {
      throw new InvalidAmountError(`Invalid decimal format: '${valueStr}'. Must be standard numeric decimal.`);
    }

    const sign = match[1] === '-' ? -1n : 1n;
    const integerPart = match[2];
    const fractionalPart = match[3] || '';
    const scale = fractionalPart.length;

    const unscaled = sign * BigInt(integerPart + fractionalPart);
    return new DecimalValue(unscaled, scale);
  }

  public static fromNumber(num: number): DecimalValue {
    if (!Number.isFinite(num)) {
      throw new InvalidAmountError(`Cannot construct DecimalValue from non-finite number: ${num}`);
    }
    return DecimalValue.fromString(num.toString());
  }

  public static fromMinorUnits(minorUnits: bigint | number, scale: number = 2): DecimalValue {
    return new DecimalValue(BigInt(minorUnits), scale);
  }

  public toMinorUnits(targetScale?: number): bigint {
    const scale = targetScale ?? this.scale;
    const rounded = this.round(scale, 'HALF_UP');
    return rounded.unscaled;
  }

  public isZero(): boolean {
    return this.unscaled === 0n;
  }

  public isPositive(): boolean {
    return this.unscaled > 0n;
  }

  public isNegative(): boolean {
    return this.unscaled < 0n;
  }

  public abs(): DecimalValue {
    return this.unscaled < 0n ? new DecimalValue(-this.unscaled, this.scale) : this;
  }

  public negate(): DecimalValue {
    return new DecimalValue(-this.unscaled, this.scale);
  }

  public add(other: DecimalValue): DecimalValue {
    const maxScale = Math.max(this.scale, other.scale);
    const scaledThis = this.unscaled * (10n ** BigInt(maxScale - this.scale));
    const scaledOther = other.unscaled * (10n ** BigInt(maxScale - other.scale));
    return new DecimalValue(scaledThis + scaledOther, maxScale);
  }

  public subtract(other: DecimalValue): DecimalValue {
    const maxScale = Math.max(this.scale, other.scale);
    const scaledThis = this.unscaled * (10n ** BigInt(maxScale - this.scale));
    const scaledOther = other.unscaled * (10n ** BigInt(maxScale - other.scale));
    return new DecimalValue(scaledThis - scaledOther, maxScale);
  }

  public multiply(other: DecimalValue | number | string): DecimalValue {
    const otherDec = other instanceof DecimalValue ? other : DecimalValue.fromString(other.toString());
    const newUnscaled = this.unscaled * otherDec.unscaled;
    const newScale = this.scale + otherDec.scale;
    return new DecimalValue(newUnscaled, newScale);
  }

  public divide(divisor: DecimalValue | number | string, targetScale: number = 4, rounding: RoundingMode = 'HALF_UP'): DecimalValue {
    const divDec = divisor instanceof DecimalValue ? divisor : DecimalValue.fromString(divisor.toString());
    if (divDec.isZero()) {
      throw new InvalidAmountError('Division by zero in monetary arithmetic.');
    }

    // Multiply numerator to provide extra precision for rounding
    const extraDigits = 2;
    const totalScale = targetScale + extraDigits;
    const factor = 10n ** BigInt(totalScale + divDec.scale - this.scale);
    const scaledNumerator = this.unscaled * factor;

    const unroundedQuotient = scaledNumerator / divDec.unscaled;
    const intermediate = new DecimalValue(unroundedQuotient, totalScale);
    return intermediate.round(targetScale, rounding);
  }

  public round(targetScale: number, mode: RoundingMode = 'HALF_UP'): DecimalValue {
    if (this.scale <= targetScale) {
      // Pad with trailing zeros to reach targetScale
      const factor = 10n ** BigInt(targetScale - this.scale);
      return new DecimalValue(this.unscaled * factor, targetScale);
    }

    const diff = this.scale - targetScale;
    const divisor = 10n ** BigInt(diff);
    const half = divisor / 2n;

    const sign = this.unscaled < 0n ? -1n : 1n;
    const absUnscaled = this.unscaled < 0n ? -this.unscaled : this.unscaled;

    let quotient = absUnscaled / divisor;
    const remainder = absUnscaled % divisor;

    switch (mode) {
      case 'TRUNCATE':
      case 'FLOOR':
        if (mode === 'FLOOR' && sign === -1n && remainder > 0n) {
          quotient += 1n;
        }
        break;
      case 'CEILING':
        if (sign === 1n && remainder > 0n) {
          quotient += 1n;
        }
        break;
      case 'HALF_UP':
        if (remainder >= half) {
          quotient += 1n;
        }
        break;
      case 'HALF_EVEN':
        if (remainder > half) {
          quotient += 1n;
        } else if (remainder === half) {
          if (quotient % 2n !== 0n) {
            quotient += 1n;
          }
        }
        break;
    }

    return new DecimalValue(sign * quotient, targetScale);
  }

  public equals(other: DecimalValue): boolean {
    const diff = this.subtract(other);
    return diff.unscaled === 0n;
  }

  public greaterThan(other: DecimalValue): boolean {
    return this.subtract(other).unscaled > 0n;
  }

  public greaterThanOrEqual(other: DecimalValue): boolean {
    return this.subtract(other).unscaled >= 0n;
  }

  public lessThan(other: DecimalValue): boolean {
    return this.subtract(other).unscaled < 0n;
  }

  public lessThanOrEqual(other: DecimalValue): boolean {
    return this.subtract(other).unscaled <= 0n;
  }

  public toFixed(digits: number = 2): string {
    const rounded = this.round(digits, 'HALF_UP');
    const sign = rounded.unscaled < 0n ? '-' : '';
    const absVal = rounded.unscaled < 0n ? -rounded.unscaled : rounded.unscaled;
    const factor = 10n ** BigInt(digits);

    const intPart = (absVal / factor).toString();
    const fracPart = (absVal % factor).toString().padStart(digits, '0');

    return digits > 0 ? `${sign}${intPart}.${fracPart}` : `${sign}${intPart}`;
  }

  public toString(): string {
    return this.toFixed(this.scale);
  }

  public toJSON(): string {
    return this.toString();
  }
}

/**
 * Immutable Money Value Object representing an exact amount in a specific currency.
 */
export class Money {
  public readonly amount: DecimalValue;
  public readonly currency: CurrencyDefinition;

  constructor(amount: DecimalValue | string | number, currencyCode: CurrencyCode = 'EGP') {
    const upperCode = currencyCode.toUpperCase();
    const curr = CURRENCY_REGISTRY[upperCode];
    if (!curr) {
      if (upperCode !== 'EGP') {
        throw new MultiCurrencyDisabledError(currencyCode);
      }
      throw new InvalidAmountError(
        `Unsupported currency code '${currencyCode}'. Initial release strictly supports EGP (OD-725).`
      );
    }
    this.currency = curr;

    if (amount instanceof DecimalValue) {
      this.amount = amount;
    } else if (typeof amount === 'string') {
      this.amount = DecimalValue.fromString(amount);
    } else if (typeof amount === 'number') {
      this.amount = DecimalValue.fromNumber(amount);
    } else {
      throw new InvalidAmountError('Invalid amount type passed to Money constructor.');
    }
  }

  public static egp(amount: DecimalValue | string | number): Money {
    return new Money(amount, 'EGP');
  }

  public static zero(currencyCode: CurrencyCode = 'EGP'): Money {
    return new Money(DecimalValue.zero(2), currencyCode);
  }

  public static fromMinorUnits(minorUnits: bigint | number, currencyCode: CurrencyCode = 'EGP'): Money {
    const upperCode = currencyCode.toUpperCase();
    const curr = CURRENCY_REGISTRY[upperCode];
    if (!curr) {
      throw new InvalidAmountError(`Unsupported currency code '${currencyCode}'.`);
    }
    const dec = DecimalValue.fromMinorUnits(minorUnits, curr.minorUnits);
    return new Money(dec, upperCode);
  }

  public toMinorUnits(): bigint {
    return this.amount.toMinorUnits(this.currency.minorUnits);
  }

  public get currencyCode(): string {
    return this.currency.code;
  }

  private assertSameCurrency(other: Money): void {
    if (this.currency.code !== other.currency.code) {
      throw new CurrencyMismatchError(this.currency.code, other.currency.code);
    }
  }

  public add(other: Money): Money {
    this.assertSameCurrency(other);
    return new Money(this.amount.add(other.amount), this.currency.code);
  }

  public subtract(other: Money): Money {
    this.assertSameCurrency(other);
    return new Money(this.amount.subtract(other.amount), this.currency.code);
  }

  public multiply(scalar: DecimalValue | number | string, rounding: RoundingMode = 'HALF_UP'): Money {
    const raw = this.amount.multiply(scalar);
    const rounded = raw.round(this.currency.minorUnits, rounding);
    return new Money(rounded, this.currency.code);
  }

  public divide(scalar: DecimalValue | number | string, rounding: RoundingMode = 'HALF_UP'): Money {
    const rounded = this.amount.divide(scalar, this.currency.minorUnits, rounding);
    return new Money(rounded, this.currency.code);
  }

  /**
   * Proportional allocation across ratios without penny-loss (Hare-Niemeyer largest-remainder method).
   * Ensures sum(allocated) === original total exactly.
   */
  public allocate(ratios: number[]): Money[] {
    if (!ratios || ratios.length === 0) {
      throw new InvalidAmountError('Allocation requires at least one ratio.');
    }
    const totalRatio = ratios.reduce((acc, r) => {
      if (r < 0) throw new InvalidAmountError('Allocation ratio cannot be negative.');
      return acc + r;
    }, 0);

    if (totalRatio === 0) {
      throw new InvalidAmountError('Sum of allocation ratios must be greater than zero.');
    }

    const totalMinor = this.toMinorUnits();
    const totalRatioBig = BigInt(Math.round(totalRatio * 10000));
    const results: bigint[] = [];
    const remainders: { index: number; remainder: bigint }[] = [];

    let allocatedSum = 0n;

    for (let i = 0; i < ratios.length; i++) {
      const ratioBig = BigInt(Math.round(ratios[i] * 10000));
      const shareExact = totalMinor * ratioBig;
      const share = shareExact / totalRatioBig;
      const rem = shareExact % totalRatioBig;

      results.push(share);
      remainders.push({ index: i, remainder: rem });
      allocatedSum += share;
    }

    let unallocated = totalMinor - allocatedSum;
    // Distribute remaining minor units to largest remainders
    remainders.sort((a, b) => (b.remainder > a.remainder ? 1 : b.remainder < a.remainder ? -1 : 0));

    for (let i = 0; i < Number(unallocated); i++) {
      results[remainders[i].index] += 1n;
    }

    return results.map(minor => Money.fromMinorUnits(minor, this.currency.code));
  }

  public isZero(): boolean {
    return this.amount.isZero();
  }

  public isPositive(): boolean {
    return this.amount.isPositive();
  }

  public isNegative(): boolean {
    return this.amount.isNegative();
  }

  public abs(): Money {
    return new Money(this.amount.abs(), this.currency.code);
  }

  public negate(): Money {
    return new Money(this.amount.negate(), this.currency.code);
  }

  public equals(other: Money): boolean {
    return this.currency.code === other.currency.code && this.amount.equals(other.amount);
  }

  public greaterThan(other: Money): boolean {
    this.assertSameCurrency(other);
    return this.amount.greaterThan(other.amount);
  }

  public lessThan(other: Money): boolean {
    this.assertSameCurrency(other);
    return this.amount.lessThan(other.amount);
  }

  public toFixed(digits: number = 2): string {
    return this.amount.toFixed(digits);
  }

  public toString(): string {
    return `${this.amount.toFixed(this.currency.minorUnits)} ${this.currency.code}`;
  }

  public toJSON(): { amount: string; currency: string } {
    return {
      amount: this.amount.toFixed(this.currency.minorUnits),
      currency: this.currency.code
    };
  }

  public static fromJSON(json: { amount: string | number; currency: string }): Money {
    return new Money(json.amount, json.currency);
  }
}
