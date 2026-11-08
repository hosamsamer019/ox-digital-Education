/**
 * OX-DIGITAL Education — Financial Core Engine
 * Master Test Runner for Accounting Phase 1 Domain Suite
 */

import { runMoneyTests } from './money.test.js';
import { runAccountTests } from './account.test.js';
import { runJournalTests } from './journal.test.js';
import { runLifecycleTests } from './lifecycle.test.js';

console.log('===================================================================');
console.log('OX-DIGITAL Education — Accounting Track Phase 1 Test Runner');
console.log('Financial Core Engine Domain & Invariants Test Suite');
console.log('Mode: STRICTLY IN-MEMORY & ISOLATED (NO DATABASE / DOCKER)');
console.log('Timestamp:', new Date().toISOString());
console.log('===================================================================');

async function main() {
  const moneyRes = await runMoneyTests();
  const accountRes = await runAccountTests();
  const journalRes = await runJournalTests();
  const lifecycleRes = await runLifecycleTests();

  const totalPassed = moneyRes.passed + accountRes.passed + journalRes.passed + lifecycleRes.passed;
  const totalFailed = moneyRes.failed + accountRes.failed + journalRes.failed + lifecycleRes.failed;

  console.log('\n===================================================================');
  console.log('FINAL ACCOUNTING PHASE 1 TEST SUMMARY');
  console.log('===================================================================');
  console.log(`Money & Currency Tests:      ${moneyRes.passed} Passed, ${moneyRes.failed} Failed`);
  console.log(`Account & Hierarchy Tests:   ${accountRes.passed} Passed, ${accountRes.failed} Failed`);
  console.log(`Journal Invariants Tests:    ${journalRes.passed} Passed, ${journalRes.failed} Failed`);
  console.log(`Lifecycle & Reversal Tests:  ${lifecycleRes.passed} Passed, ${lifecycleRes.failed} Failed`);
  console.log('-------------------------------------------------------------------');
  console.log(`TOTAL EXECUTED:              ${totalPassed + totalFailed}`);
  console.log(`TOTAL PASSED:                ${totalPassed}`);
  console.log(`TOTAL FAILED:                ${totalFailed}`);
  console.log('===================================================================');

  if (totalFailed > 0) {
    console.error(`\n[FATAL] Accounting Phase 1 test suite failed with ${totalFailed} failure(s).`);
    process.exit(1);
  } else {
    console.log('\n[SUCCESS] ALL ACCOUNTING PHASE 1 INVARIANTS VERIFIED.');
    process.exit(0);
  }
}

main().catch(err => {
  console.error('Master accounting test runner crashed:', err);
  process.exit(1);
});

