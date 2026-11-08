/**
 * OX-DIGITAL Education — Financial Core Engine
 * Phase 1 Unit Tests: Account Domain & Hierarchy Validation
 */

import { Account, ChartOfAccounts, getNormalBalance } from '../../packages/shared/src/accounting/account.js';
import {
  CircularHierarchyError,
  DuplicateAccountCodeError,
  InactiveAccountError,
  NonPostableAccountError,
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

export async function runAccountTests(): Promise<{ passed: number; failed: number }> {
  console.log('\n--- Suite: Account Domain & Chart of Accounts Hierarchy ---');

  const instId = 'inst_test_alpha';

  // 1. Normal Balance Directions
  assert(getNormalBalance('ASSET') === 'DEBIT', 'Normal balance of ASSET is DEBIT');
  assert(getNormalBalance('EXPENSE') === 'DEBIT', 'Normal balance of EXPENSE is DEBIT');
  assert(getNormalBalance('LIABILITY') === 'CREDIT', 'Normal balance of LIABILITY is CREDIT');
  assert(getNormalBalance('EQUITY') === 'CREDIT', 'Normal balance of EQUITY is CREDIT');
  assert(getNormalBalance('REVENUE') === 'CREDIT', 'Normal balance of REVENUE is CREDIT');

  // 2. Valid Account Creation
  const cashAcc = new Account({
    id: 'acc_cash_01',
    code: '1010',
    name: 'Cash on Hand',
    type: 'ASSET',
    institutionId: instId,
    isActive: true,
    isPostable: true
  });
  assert(cashAcc.code === '1010', 'Account code initialized correctly');
  assert(cashAcc.normalBalance === 'DEBIT', 'Cash normal balance is DEBIT');

  // 3. Valid Parent-Child Hierarchy
  const chart = new ChartOfAccounts(instId);

  const currentAssets = new Account({
    id: 'acc_curr_assets',
    code: '1000',
    name: 'Current Assets',
    type: 'ASSET',
    institutionId: instId,
    isActive: true,
    isPostable: false // Non-postable header account
  });

  const pettyCash = new Account({
    id: 'acc_petty_cash',
    code: '1011',
    name: 'Petty Cash',
    type: 'ASSET',
    institutionId: instId,
    parentId: 'acc_curr_assets',
    isActive: true,
    isPostable: true // Postable sub-account
  });

  chart.addAccount(currentAssets);
  chart.addAccount(pettyCash);
  assert(chart.getAll().length === 2, 'Added parent and child accounts successfully');
  assert(chart.getByCode('1011')?.parentId === 'acc_curr_assets', 'Child correctly references parent account');

  // 4. Duplicate Account Code Rejection
  let caughtDuplicateCode = false;
  try {
    const dup = new Account({
      id: 'acc_duplicate_id',
      code: '1010', // duplicate of cashAcc
      name: 'Duplicate Cash Account',
      type: 'ASSET',
      institutionId: instId
    });
    chart.addAccount(cashAcc);
    chart.addAccount(dup);
  } catch (err: any) {
    if (err instanceof DuplicateAccountCodeError) {
      caughtDuplicateCode = true;
    }
  }
  assert(caughtDuplicateCode, 'Duplicate account code within same institution chart is rejected');

  // 5. Circular Hierarchy Rejection
  let caughtCycle = false;
  try {
    const cycleChart = new ChartOfAccounts(instId);
    const nodeA = new Account({ id: 'node_a', code: 'A', name: 'Node A', type: 'ASSET', institutionId: instId, parentId: 'node_b' });
    const nodeB = new Account({ id: 'node_b', code: 'B', name: 'Node B', type: 'ASSET', institutionId: instId, parentId: 'node_a' });
    cycleChart.addAccount(nodeA);
    cycleChart.addAccount(nodeB); // Should detect cycle A -> B -> A
  } catch (err: any) {
    if (err instanceof CircularHierarchyError) {
      caughtCycle = true;
    }
  }
  assert(caughtCycle, 'Circular account hierarchy (A -> B -> A) is rejected');

  // 6. Non-Postable Header Account Assertion
  let caughtNonPostable = false;
  try {
    currentAssets.assertEligibleForPosting();
  } catch (err: any) {
    if (err instanceof NonPostableAccountError) {
      caughtNonPostable = true;
    }
  }
  assert(caughtNonPostable, 'Posting to non-postable header account throws NonPostableAccountError');

  // 7. Inactive Account Assertion
  const inactiveAcc = new Account({
    id: 'acc_inactive',
    code: '9999',
    name: 'Discontinued Asset',
    type: 'ASSET',
    institutionId: instId,
    isActive: false,
    isPostable: true
  });
  let caughtInactive = false;
  try {
    inactiveAcc.assertEligibleForPosting();
  } catch (err: any) {
    if (err instanceof InactiveAccountError) {
      caughtInactive = true;
    }
  }
  assert(caughtInactive, 'Posting to inactive account throws InactiveAccountError');

  // 8. Cross-Type Parent-Child Mismatch Rejection
  let caughtTypeMismatch = false;
  try {
    const mismatchChart = new ChartOfAccounts(instId);
    const assetParent = new Account({ id: 'asset_p', code: '1000', name: 'Assets', type: 'ASSET', institutionId: instId, isPostable: false });
    const liabilityChild = new Account({ id: 'liab_c', code: '2001', name: 'Accounts Payable', type: 'LIABILITY', institutionId: instId, parentId: 'asset_p' });
    mismatchChart.addAccount(assetParent);
    mismatchChart.addAccount(liabilityChild);
  } catch (err: any) {
    if (err instanceof AccountingDomainError && err.message.includes('Account type mismatch')) {
      caughtTypeMismatch = true;
    }
  }
  assert(caughtTypeMismatch, 'Child account of type LIABILITY under parent ASSET is rejected');

  return { passed, failed };
}

