import { execSync } from 'child_process';

console.log('===================================================================');
console.log('OX-DIGITAL Task 7.1 — Complete Test Suite Execution');
console.log('===================================================================\n');

async function main() {
  const suites = [
    { name: 'Tenant Isolation & IDOR Protection', path: 'D:/OX-DIGITAL/Mathe/OX-DIGITAL-GITHUB/tests/task_7_1/tenant_isolation.test.ts' },
    { name: 'Primary Manager Option 3B Verification', path: 'D:/OX-DIGITAL/Mathe/OX-DIGITAL-GITHUB/tests/task_7_1/primary_manager_invitation.test.ts' },
    { name: 'Lifecycle Safeties & Data Preservation', path: 'D:/OX-DIGITAL/Mathe/OX-DIGITAL-GITHUB/tests/task_7_1/lifecycle_safeties.test.ts' },
    { name: 'Alternative B Backfill Simulation & Reconciliation', path: 'D:/OX-DIGITAL/Mathe/OX-DIGITAL-GITHUB/tests/task_7_1/backfill_validation.test.ts' }
  ];

  for (const suite of suites) {
    console.log(`\n===================================================================`);
    console.log(`SUITE: ${suite.name}`);
    console.log(`===================================================================`);
    await import(`file:///${suite.path.replace(/\\/g, '/')}`);
  }

  console.log('\n===================================================================');
  console.log('SUMMARY: ALL TASK 7.1 TEST SUITES EXECUTED AND VERIFIED');
  console.log('===================================================================');
}

main().catch(err => {
  console.error('Master runner failed:', err);
  process.exit(1);
});

