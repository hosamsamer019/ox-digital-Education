/**
 * OX-DIGITAL Education — Financial Core Engine
 * Phase 1 Unit Tests: Double-Entry Journal Engine Invariants
 */

import { Money } from '../../packages/shared/src/accounting/money.js';
import { Account, ChartOfAccounts } from '../../packages/shared/src/accounting/account.js';
import { JournalEntry, JournalLine } from '../../packages/shared/src/accounting/journalEntry.js';
import { BranchDimension } from '../../packages/shared/src/accounting/dimensions.js';
import {
  UnbalancedJournalEntryError,
  AccountNotFoundError,
  InactiveAccountError,
  NonPostableAccountError,
  CrossInstitutionError,
  InvalidAmountError,
  AccountingDomainError
} from '../../packages/shared/src/accounting/errors.js';

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

export async function runJournalTests(): Promise<{ passed: number; failed: number }> {
  console.log('\n--- Suite: Double-Entry Journal Engine Invariants ---');

  const instA = 'inst_alpha';
  const instB = 'inst_beta';

  // Setup Standard Chart of Accounts for Institution A
  const chartA = new ChartOfAccounts(instA);
  const accCash = new Account({ id: 'acc_cash', code: '1010', name: 'Cash', type: 'ASSET', institutionId: instA, isPostable: true });
  const accTuition = new Account({ id: 'acc_tuition', code: '4010', name: 'Tuition Revenue', type: 'REVENUE', institutionId: instA, isPostable: true });
  const accHeader = new Account({ id: 'acc_hdr', code: '1000', name: 'Asset Header', type: 'ASSET', institutionId: instA, isPostable: false });
  const accInactive = new Account({ id: 'acc_inact', code: '1999', name: 'Old Bank Account', type: 'ASSET', institutionId: instA, isActive: false, isPostable: true });

  chartA.addAccount(accCash);
  chartA.addAccount(accTuition);
  chartA.addAccount(accHeader);
  chartA.addAccount(accInactive);

  // Setup Dimensions
  const branchCairo = BranchDimension.physical(instA, 'br_cairo', 'CAIRO');
  const branchOnline = BranchDimension.online(instA, 'br_online', 'ONLINE');
  const foreignBranch = BranchDimension.physical(instB, 'br_giza', 'GIZA');

  // 1. Balanced Entry Accepted (Dr Cash 1,000, Cr Tuition 1,000)
  const validEntry = new JournalEntry({
    id: 'je_valid_01',
    institutionId: instA,
    transactionDate: new Date('2026-11-03'),
    accountingDate: new Date('2026-11-03'),
    currency: 'EGP',
    description: 'Student course enrollment payment',
    createdBy: 'usr_cashier_01',
    lines: [
      new JournalLine({
        id: 'line_1',
        accountId: 'acc_cash',
        debit: Money.egp('1000.00'),
        credit: Money.zero('EGP'),
        branchDimension: branchCairo,
        description: 'Payment collected at Cairo branch'
      }),
      new JournalLine({
        id: 'line_2',
        accountId: 'acc_tuition',
        debit: Money.zero('EGP'),
        credit: Money.egp('1000.00'),
        branchDimension: branchCairo,
        description: 'Course tuition revenue recognized'
      })
    ]
  });

  assert(validEntry.isBalanced(), 'Valid entry reports isBalanced() === true');
  validEntry.validate(chartA);
  assert(validEntry.status === 'VALIDATED', 'Valid entry successfully transitions to VALIDATED');

  // 2. Unbalanced Entry Rejected: Debit > Credit
  let caughtUnbalanced1 = false;
  try {
    const unbal1 = new JournalEntry({
      id: 'je_unbal_01',
      institutionId: instA,
      transactionDate: new Date(),
      accountingDate: new Date(),
      currency: 'EGP',
      description: 'Unbalanced entry test',
      createdBy: 'usr_cashier_01',
      lines: [
        new JournalLine({ id: 'l1', accountId: 'acc_cash', debit: Money.egp('1500.00'), credit: Money.zero() }),
        new JournalLine({ id: 'l2', accountId: 'acc_tuition', debit: Money.zero(), credit: Money.egp('1000.00') })
      ]
    });
    unbal1.validate(chartA);
  } catch (err: any) {
    if (err instanceof UnbalancedJournalEntryError) {
      caughtUnbalanced1 = true;
    }
  }
  assert(caughtUnbalanced1, 'Unbalanced entry (Debit > Credit) throws UnbalancedJournalEntryError');

  // 3. Unbalanced Entry Rejected: Credit > Debit
  let caughtUnbalanced2 = false;
  try {
    const unbal2 = new JournalEntry({
      id: 'je_unbal_02',
      institutionId: instA,
      transactionDate: new Date(),
      accountingDate: new Date(),
      currency: 'EGP',
      description: 'Unbalanced entry test 2',
      createdBy: 'usr_cashier_01',
      lines: [
        new JournalLine({ id: 'l1', accountId: 'acc_cash', debit: Money.egp('500.00'), credit: Money.zero() }),
        new JournalLine({ id: 'l2', accountId: 'acc_tuition', debit: Money.zero(), credit: Money.egp('800.00') })
      ]
    });
    unbal2.validate(chartA);
  } catch (err: any) {
    if (err instanceof UnbalancedJournalEntryError) {
      caughtUnbalanced2 = true;
    }
  }
  assert(caughtUnbalanced2, 'Unbalanced entry (Credit > Debit) throws UnbalancedJournalEntryError');

  // 4. Missing Account Rejected
  let caughtMissingAcc = false;
  try {
    const missingAccEntry = new JournalEntry({
      id: 'je_missing_acc',
      institutionId: instA,
      transactionDate: new Date(),
      accountingDate: new Date(),
      description: 'Missing account test',
      createdBy: 'usr_cashier_01',
      lines: [
        new JournalLine({ id: 'l1', accountId: 'non_existent_acc', debit: Money.egp('100.00'), credit: Money.zero() }),
        new JournalLine({ id: 'l2', accountId: 'acc_tuition', debit: Money.zero(), credit: Money.egp('100.00') })
      ]
    });
    missingAccEntry.validate(chartA);
  } catch (err: any) {
    if (err instanceof AccountNotFoundError) {
      caughtMissingAcc = true;
    }
  }
  assert(caughtMissingAcc, 'Line referencing non-existent account throws AccountNotFoundError');

  // 5. Inactive Account Rejected
  let caughtInactive = false;
  try {
    const inactEntry = new JournalEntry({
      id: 'je_inactive',
      institutionId: instA,
      transactionDate: new Date(),
      accountingDate: new Date(),
      description: 'Inactive account test',
      createdBy: 'usr_cashier_01',
      lines: [
        new JournalLine({ id: 'l1', accountId: 'acc_inact', debit: Money.egp('100.00'), credit: Money.zero() }),
        new JournalLine({ id: 'l2', accountId: 'acc_tuition', debit: Money.zero(), credit: Money.egp('100.00') })
      ]
    });
    inactEntry.validate(chartA);
  } catch (err: any) {
    if (err instanceof InactiveAccountError) {
      caughtInactive = true;
    }
  }
  assert(caughtInactive, 'Line referencing inactive account throws InactiveAccountError');

  // 6. Non-Postable Header Account Rejected
  let caughtNonPostable = false;
  try {
    const nonPostEntry = new JournalEntry({
      id: 'je_non_post',
      institutionId: instA,
      transactionDate: new Date(),
      accountingDate: new Date(),
      description: 'Non-postable header test',
      createdBy: 'usr_cashier_01',
      lines: [
        new JournalLine({ id: 'l1', accountId: 'acc_hdr', debit: Money.egp('100.00'), credit: Money.zero() }),
        new JournalLine({ id: 'l2', accountId: 'acc_tuition', debit: Money.zero(), credit: Money.egp('100.00') })
      ]
    });
    nonPostEntry.validate(chartA);
  } catch (err: any) {
    if (err instanceof NonPostableAccountError) {
      caughtNonPostable = true;
    }
  }
  assert(caughtNonPostable, 'Line referencing non-postable header account throws NonPostableAccountError');

  // 7. Cross-Institution Account Rejected
  let caughtCrossInstAcc = false;
  try {
    const chartB = new ChartOfAccounts(instB);
    validEntry.validate(chartB); // Chart belongs to instB, entry belongs to instA
  } catch (err: any) {
    if (err instanceof CrossInstitutionError) {
      caughtCrossInstAcc = true;
    }
  }
  assert(caughtCrossInstAcc, 'Validating entry against foreign institution chart throws CrossInstitutionError');

  // 8. Cross-Institution Branch Dimension Rejected
  let caughtCrossBranch = false;
  try {
    new JournalEntry({
      id: 'je_cross_branch',
      institutionId: instA,
      transactionDate: new Date(),
      accountingDate: new Date(),
      description: 'Cross branch test',
      createdBy: 'usr_cashier_01',
      lines: [
        new JournalLine({
          id: 'l1',
          accountId: 'acc_cash',
          debit: Money.egp('100.00'),
          credit: Money.zero(),
          branchDimension: foreignBranch // Belongs to instB!
        }),
        new JournalLine({ id: 'l2', accountId: 'acc_tuition', debit: Money.zero(), credit: Money.egp('100.00') })
      ]
    });
  } catch (err: any) {
    if (err instanceof CrossInstitutionError) {
      caughtCrossBranch = true;
    }
  }
  assert(caughtCrossBranch, 'Line referencing foreign institution branch dimension throws CrossInstitutionError');

  // 9. Negative and Invalid Line Amounts Rejected
  let caughtNegative = false;
  try {
    new JournalLine({
      id: 'l_neg',
      accountId: 'acc_cash',
      debit: Money.egp('-100.00'),
      credit: Money.zero()
    });
  } catch (err: any) {
    if (err instanceof InvalidAmountError) {
      caughtNegative = true;
    }
  }
  assert(caughtNegative, 'Negative line amount throws InvalidAmountError');

  let caughtBothSides = false;
  try {
    new JournalLine({
      id: 'l_both',
      accountId: 'acc_cash',
      debit: Money.egp('100.00'),
      credit: Money.egp('100.00') // Both positive
    });
  } catch (err: any) {
    if (err instanceof InvalidAmountError) {
      caughtBothSides = true;
    }
  }
  assert(caughtBothSides, 'Line with both positive debit and credit throws InvalidAmountError');

  // 10. Compound Entry with Multiple Debits and Credits
  const compoundEntry = new JournalEntry({
    id: 'je_compound',
    institutionId: instA,
    transactionDate: new Date(),
    accountingDate: new Date(),
    description: 'Split payment: 600 cash + 400 bank = 1000 tuition',
    createdBy: 'usr_cashier_01',
    lines: [
      new JournalLine({ id: 'c1', accountId: 'acc_cash', debit: Money.egp('600.00'), credit: Money.zero() }),
      new JournalLine({ id: 'c2', accountId: 'acc_cash', debit: Money.egp('400.00'), credit: Money.zero() }),
      new JournalLine({ id: 'c3', accountId: 'acc_tuition', debit: Money.zero(), credit: Money.egp('1000.00'), branchDimension: branchOnline })
    ]
  });
  compoundEntry.validate(chartA);
  assert(compoundEntry.isBalanced(), 'Compound entry with 2 debits and 1 credit balances exactly');
  assert(compoundEntry.status === 'VALIDATED', 'Compound entry validates successfully');

  return { passed, failed };
}

