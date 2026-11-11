/**
 * OX-DIGITAL Education — Auth Service Financial Access Status Remediation Test Suite
 *
 * Verifies DEF-AUDIT-005:
 * Elimination of fail-open fallback in auth-service (formerly `financialAccessStatus || 'ACTIVE'`).
 * Validates fail-closed resolution for missing, null, undefined, empty, and unrecognized values.
 */

import { resolveAuthFinancialStatus } from './src/controllers/auth.controller.js';

function runAuthFinancialStatusTests() {
  console.log('================================================================');
  console.log('  OX-DIGITAL: Auth Service Financial Access Status Suite');
  console.log('================================================================\n');

  let passed = 0;
  let total = 0;

  function record(desc: string, ok: boolean) {
    total++;
    if (ok) {
      passed++;
      console.log(`  ✓ Test ${total}: ${desc}`);
    } else {
      console.error(`  ✗ Test ${total} FAILED: ${desc}`);
    }
  }

  // 1. Authoritative ACTIVE
  record('Authoritative ACTIVE status preserved', resolveAuthFinancialStatus('ACTIVE') === 'ACTIVE');

  // 2. Authoritative GRACE_PERIOD
  record('Authoritative GRACE_PERIOD status preserved', resolveAuthFinancialStatus('GRACE_PERIOD') === 'GRACE_PERIOD');

  // 3. Authoritative RESTRICTED
  record('Authoritative RESTRICTED status preserved', resolveAuthFinancialStatus('RESTRICTED') === 'RESTRICTED');

  // 4. Authoritative LOCKED
  record('Authoritative LOCKED status preserved', resolveAuthFinancialStatus('LOCKED') === 'LOCKED');

  // 5. Case-insensitivity for valid statuses
  record('Case-insensitive normalization for "active" -> ACTIVE', resolveAuthFinancialStatus('active') === 'ACTIVE');
  record('Case-insensitive normalization for "restricted" -> RESTRICTED', resolveAuthFinancialStatus('restricted') === 'RESTRICTED');

  // 6. Fail-closed on null input
  record('DEF-AUDIT-005: null input fails closed to LOCKED (no fail-open ACTIVE)', resolveAuthFinancialStatus(null) === 'LOCKED');

  // 7. Fail-closed on undefined input
  record('DEF-AUDIT-005: undefined input fails closed to LOCKED', resolveAuthFinancialStatus(undefined) === 'LOCKED');

  // 8. Fail-closed on empty string input
  record('DEF-AUDIT-005: empty string input fails closed to LOCKED', resolveAuthFinancialStatus('') === 'LOCKED');

  // 9. Fail-closed on whitespace string input
  record('DEF-AUDIT-005: whitespace input fails closed to LOCKED', resolveAuthFinancialStatus('   ') === 'LOCKED');

  // 10. Fail-closed on unrecognized / corrupted string
  record('DEF-AUDIT-005: unrecognized status "BOGUS_STATUS" fails closed to LOCKED', resolveAuthFinancialStatus('BOGUS_STATUS') === 'LOCKED');
  record('DEF-AUDIT-005: partial status "ACT" fails closed to LOCKED', resolveAuthFinancialStatus('ACT') === 'LOCKED');

  console.log(`\n================================================================`);
  console.log(`  Auth Financial Status Suite Summary: ${passed}/${total} Tests Passed`);
  console.log(`================================================================\n`);

  if (passed !== total) {
    process.exit(1);
  }
}

try {
  runAuthFinancialStatusTests();
} catch (err) {
  console.error('Fatal Test Error:', err);
  process.exit(1);
}

