/**
 * OX-DIGITAL Education — Financial Core Engine
 * Phase 1 Unit Tests: Money & Exact Decimal Arithmetic
 */

import { Money, DecimalValue, RoundingMode } from '../../packages/shared/src/accounting/money.js';
import { CurrencyMismatchError, InvalidAmountError } from '../../packages/shared/src/accounting/errors.js';

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

export async function runMoneyTests(): Promise<{ passed: number; failed: number }> {
  console.log('\n--- Suite: Money & Decimal Foundation ---');

  // 1. Exact Decimal Addition
  const m1 = Money.egp('100.25');
  const m2 = Money.egp('50.75');
  const sum = m1.add(m2);
  assert(sum.toFixed(2) === '151.00', 'Exact decimal addition: 100.25 + 50.75 = 151.00');
  assert(sum.toMinorUnits() === 15100n, 'Addition minor units: 15100 piasters');

  // 2. Floating-point error avoidance (0.1 + 0.2 != 0.3 in IEEE 754)
  const d1 = DecimalValue.fromString('0.1');
  const d2 = DecimalValue.fromString('0.2');
  const dSum = d1.add(d2);
  assert(dSum.toString() === '0.3', 'IEEE 754 trap avoided: 0.1 + 0.2 equals exactly 0.3');

  // 3. Exact Subtraction
  const sub = m1.subtract(m2);
  assert(sub.toFixed(2) === '49.50', 'Exact decimal subtraction: 100.25 - 50.75 = 49.50');

  // 4. Safe Multiplication
  const m3 = Money.egp('250.00');
  const mul = m3.multiply('0.14'); // 14% VAT test calculation
  assert(mul.toFixed(2) === '35.00', 'Multiplication by scalar: 250.00 * 0.14 = 35.00');

  // 5. Safe Division and Rounding (HALF_UP)
  const m4 = Money.egp('100.00');
  const div3 = m4.divide(3, 'HALF_UP');
  assert(div3.toFixed(2) === '33.33', 'Division with HALF_UP: 100 / 3 = 33.33');

  // 6. Rounding Boundaries
  const dBoundary = DecimalValue.fromString('10.555');
  assert(dBoundary.round(2, 'HALF_UP').toFixed(2) === '10.56', 'Rounding HALF_UP: 10.555 -> 10.56');
  assert(dBoundary.round(2, 'TRUNCATE').toFixed(2) === '10.55', 'Rounding TRUNCATE: 10.555 -> 10.55');
  assert(dBoundary.round(2, 'FLOOR').toFixed(2) === '10.55', 'Rounding FLOOR: 10.555 -> 10.55');
  assert(dBoundary.round(2, 'CEILING').toFixed(2) === '10.56', 'Rounding CEILING: 10.555 -> 10.56');

  // Banker's Rounding (HALF_EVEN)
  const dEven1 = DecimalValue.fromString('2.5'); // Round to nearest even integer -> 2
  const dEven2 = DecimalValue.fromString('3.5'); // Round to nearest even integer -> 4
  assert(dEven1.round(0, 'HALF_EVEN').toFixed(0) === '2', "Banker's rounding: 2.5 -> 2 (even)");
  assert(dEven2.round(0, 'HALF_EVEN').toFixed(0) === '4', "Banker's rounding: 3.5 -> 4 (even)");

  // 7. Proportional Allocation without Penny-Loss (Hare-Niemeyer method)
  const mAlloc = Money.egp('100.00');
  const allocated = mAlloc.allocate([1, 1, 1]);
  assert(allocated.length === 3, 'Allocated into 3 parts');
  assert(
    allocated[0].toFixed(2) === '33.34' &&
    allocated[1].toFixed(2) === '33.33' &&
    allocated[2].toFixed(2) === '33.33',
    'Penny-loss avoided: 100.00 divided 1:1:1 allocates 33.34, 33.33, 33.33'
  );
  const totalAlloc = allocated[0].add(allocated[1]).add(allocated[2]);
  assert(totalAlloc.toFixed(2) === '100.00', 'Sum of allocated parts equals exactly original amount');

  // 8. Currency Mismatch Protection
  let threwMismatch = false;
  try {
    const egp = Money.egp('100.00');
    // Simulate currency mismatch with hypothetical USD
    const foreign = new Money('100.00', 'EGP');
    (foreign as any).currency = { code: 'USD', minorUnits: 2 };
    egp.add(foreign);
  } catch (err: any) {
    if (err instanceof CurrencyMismatchError) {
      threwMismatch = true;
    }
  }
  assert(threwMismatch, 'Currency mismatch throws CurrencyMismatchError');

  // 9. Rejection of NaN, Infinity, and Invalid Decimal Strings
  let caughtNaN = false;
  try {
    DecimalValue.fromNumber(NaN);
  } catch (e: any) {
    if (e instanceof InvalidAmountError) caughtNaN = true;
  }
  assert(caughtNaN, 'DecimalValue rejects NaN input');

  let caughtInfinity = false;
  try {
    DecimalValue.fromNumber(Infinity);
  } catch (e: any) {
    if (e instanceof InvalidAmountError) caughtInfinity = true;
  }
  assert(caughtInfinity, 'DecimalValue rejects Infinity input');

  let caughtGarbage = false;
  try {
    DecimalValue.fromString('abc.xyz');
  } catch (e: any) {
    if (e instanceof InvalidAmountError) caughtGarbage = true;
  }
  assert(caughtGarbage, 'DecimalValue rejects non-numeric string');

  // 10. Negative and Zero Behavior
  const zeroMoney = Money.zero('EGP');
  assert(zeroMoney.isZero(), 'Money.zero() isZero() is true');
  assert(!zeroMoney.isPositive() && !zeroMoney.isNegative(), 'Zero is neither positive nor negative');

  const negMoney = Money.egp('-50.00');
  assert(negMoney.isNegative(), 'Negative money detected correctly');
  assert(negMoney.abs().toFixed(2) === '50.00', 'Money abs() converts negative to positive');

  // 11. Minor-Unit Serialization & Deserialization
  const fromMinor = Money.fromMinorUnits(50075n, 'EGP');
  assert(fromMinor.toFixed(2) === '500.75', 'fromMinorUnits: 50075n -> 500.75 EGP');
  assert(fromMinor.toMinorUnits() === 50075n, 'toMinorUnits: 500.75 EGP -> 50075n');

  // JSON Serialization
  const json = fromMinor.toJSON();
  assert(json.amount === '500.75' && json.currency === 'EGP', 'toJSON() outputs exact amount and currency string');
  const restored = Money.fromJSON(json);
  assert(restored.equals(fromMinor), 'fromJSON() reconstructs identical Money instance');

  return { passed, failed };
}

