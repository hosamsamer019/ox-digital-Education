/**
 * OX-DIGITAL Education — Financial Core Engine
 * Phase 1 Unit Tests: Journal Lifecycle, Immutability & Reversals
 */
'use strict';

import { Money } from '../../packages/shared/src/accounting/money.js';
import { Account, ChartOfAccounts } from '../../packages/shared/src/accounting/account.js';
import { JournalEntry, JournalLine } from '../../packages/shared/src/accounting/journalEntry.js';
import { ExplicitPeriodPolicy } from '../../packages/shared/src/accounting/periodPolicy.js';
import {
  ImmutablePostedEntryError,
  DuplicateReversalError,
  InvalidLifecycleTransitionError,
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

export async function runLifecycleTests(): Promise<{ passed: number; failed: number }> {
  console.log('\n--- Suite: Journal Lifecycle, Immutability & Reversals ---');

  const instId = 'inst_lifecycle_alpha';
  const chart = new ChartOfAccounts(instId);
  const accCash = new Account({ id: 'acc_cash', code: '1010', name: 'Cash', type: 'ASSET', institutionId: instId, isPostable: true });
  const accRevenue = new Account({ id: 'acc_rev', code: '4010', name: 'Revenue', type: 'REVENUE', institutionId: instId, isPostable: true });
  chart.addAccount(accCash);
  chart.addAccount(accRevenue);

  // 1. Valid Draft Creation
  const entry = new JournalEntry({
    id: 'je_life_01',
    institutionId: instId,
    transactionDate: new Date('2026-11-03'),
    accountingDate: new Date('2026-11-03'),
    currency: 'EGP',
    description: 'Initial student payment',
    createdBy: 'usr_staff_01',
    lines: [
      new JournalLine({ id: 'l1', accountId: 'acc_cash', debit: Money.egp('500.00'), credit: Money.zero() }),
      new JournalLine({ id: 'l2', accountId: 'acc_rev', debit: Money.zero(), credit: Money.egp('500.00') })
    ]
  });

  assert(entry.status === 'DRAFT', 'Newly created entry has status DRAFT');
  assert(entry.auditEvents.length >= 1, 'ENTRY_CREATED audit event logged');

  // 2. Successful Validation
  entry.validate(chart);
  assert(entry.status === 'VALIDATED', 'Validated entry has status VALIDATED');
  assert(entry.auditEvents.some(e => e.eventType === 'ENTRY_VALIDATED'), 'ENTRY_VALIDATED audit event logged');

  // 3. Successful Posting
  entry.post('usr_primary_mgr', chart);
  assert(entry.status === 'POSTED', 'Entry successfully transitions to POSTED');
  assert(entry.postedBy === 'usr_primary_mgr', 'postedBy recorded accurately');
  assert(entry.postedAt instanceof Date, 'postedAt timestamp recorded');
  assert(entry.auditEvents.some(e => e.eventType === 'ENTRY_POSTED'), 'ENTRY_POSTED audit event logged');

  // 4. Idempotent Duplicate Posting
  entry.post('usr_primary_mgr', chart); // Second call
  assert(entry.status === 'POSTED', 'Calling post() again on POSTED entry is idempotent (no error)');

  // 5. Posted Entry Immutability (Cannot add lines to posted entry)
  let caughtImmutability = false;
  try {
    entry.addLine(new JournalLine({ id: 'l_illegal', accountId: 'acc_cash', debit: Money.egp('10.00'), credit: Money.zero() }));
  } catch (err: any) {
    if (err instanceof ImmutablePostedEntryError) {
      caughtImmutability = true;
    }
  }
  assert(caughtImmutability, 'Modifying posted entry throws ImmutablePostedEntryError');

  // 6. Successful Reversal & Inversion of Debits/Credits
  const reversalEntry = entry.reverse('usr_primary_mgr', 'Student cancelled subscription within notice window');
  assert(entry.status === 'POSTED', 'Original entry permanently retains POSTED status (pure append-only invariant)');
  assert(entry.isReversed === true, 'Original entry is marked as reversed via audit index');
  assert(entry.reversedBy === 'usr_primary_mgr', 'reversedBy derived from audit event');
  assert(entry.reversedAt instanceof Date, 'reversedAt timestamp derived from audit event');
  assert(entry.reversalEntryId === reversalEntry.id, 'Original entry points to reversalEntryId via audit');
  assert(reversalEntry.reversalOfEntryId === entry.id, 'Reversal entry points back to reversalOfEntryId');

  // Deep Immutability: Verify lines array is frozen
  assert(Object.isFrozen(entry.lines), 'entry.lines is deep-frozen against runtime mutation');

  // Verify Debits and Credits are Inverted
  const revLine1 = reversalEntry.lines[0];
  const revLine2 = reversalEntry.lines[1];
  assert(revLine1.credit.toFixed(2) === '500.00' && revLine1.debit.isZero(), 'Original debit 500 inverted to credit 500');
  assert(revLine2.debit.toFixed(2) === '500.00' && revLine2.credit.isZero(), 'Original credit 500 inverted to debit 500');

  // Original entry lines remain completely preserved
  assert(entry.lines[0].debit.toFixed(2) === '500.00', 'Original entry lines preserved intact');

  // Verify Audit Events are Frozen
  const auditEvents = entry.auditEvents;
  assert(Object.isFrozen(auditEvents[0]), 'Audit event object is frozen against mutation');
  assert(Object.isFrozen(auditEvents[0].details), 'Audit event details object is frozen against mutation');

  let caughtAuditMutation = false;
  try {
    (auditEvents[0] as any).actorId = 'malicious_actor';
  } catch {
    caughtAuditMutation = true;
  }
  assert(caughtAuditMutation, 'Mutating audit event throws error under strict mode');

  // Audit A: Date Setter Mutation Protection via Defensive Copying
  const txDateCopy = entry.transactionDate;
  txDateCopy.setFullYear(2099);
  assert(entry.transactionDate.getFullYear() === 2026, 'Mutating returned transactionDate copy does NOT alter internal entry date');

  const eventDateCopy = auditEvents[0].timestamp;
  eventDateCopy.setFullYear(2099);
  assert(auditEvents[0].timestamp.getFullYear() !== 2099, 'Mutating returned audit event timestamp copy does NOT alter internal audit timestamp');

  // Audit A: Line and Dimension Object Immutability
  let caughtLineMutation = false;
  try {
    (entry.lines[0] as any).accountId = 'acc_hacked';
  } catch {
    caughtLineMutation = true;
  }
  assert(caughtLineMutation, 'Mutating JournalLine properties directly throws TypeError');

  // 7. Reversal Entry Can Be Validated and Posted
  reversalEntry.validate(chart);
  assert(reversalEntry.status === 'VALIDATED', 'Reversal entry validates cleanly');
  reversalEntry.post('usr_primary_mgr', chart);
  assert(reversalEntry.status === 'POSTED', 'Reversal entry posts cleanly');

  // Audit B: Reversing a Posted Reversal Entry (Compensating Correction)
  const correctionEntry = reversalEntry.reverse('usr_primary_mgr', 'Correcting accidental reversal');
  assert(reversalEntry.status === 'POSTED', 'Posted reversal entry remains POSTED when corrected');
  assert(correctionEntry.reversalOfEntryId === reversalEntry.id, 'Correction entry points to reversal entry');
  correctionEntry.validate(chart);
  correctionEntry.post('usr_primary_mgr', chart);
  assert(correctionEntry.status === 'POSTED', 'Correction entry validates and posts cleanly');

  // 8. Duplicate Reversal Rejected
  let caughtDupReversal = false;
  try {
    entry.reverse('usr_primary_mgr', 'Second reversal attempt');
  } catch (err: any) {
    if (err instanceof DuplicateReversalError || err instanceof InvalidLifecycleTransitionError) {
      caughtDupReversal = true;
    }
  }
  assert(caughtDupReversal, 'Attempting duplicate reversal throws DuplicateReversalError');

  // 9. Reversing a DRAFT or VALIDATED entry rejected
  let caughtDraftReversal = false;
  try {
    const draftEntry = new JournalEntry({
      id: 'je_draft_only',
      institutionId: instId,
      transactionDate: new Date(),
      accountingDate: new Date(),
      description: 'Draft only',
      createdBy: 'usr_staff_01',
      lines: [
        new JournalLine({ id: 'd1', accountId: 'acc_cash', debit: Money.egp('100.00'), credit: Money.zero() }),
        new JournalLine({ id: 'd2', accountId: 'acc_rev', debit: Money.zero(), credit: Money.egp('100.00') })
      ]
    });
    draftEntry.reverse('usr_mgr', 'Trying to reverse draft');
  } catch (err: any) {
    if (err instanceof InvalidLifecycleTransitionError) {
      caughtDraftReversal = true;
    }
  }
  assert(caughtDraftReversal, 'Reversing a DRAFT entry throws InvalidLifecycleTransitionError');

  // 10. Accounting Period Closure Enforcement (OD-710 Test)
  const strictPeriodPolicy = new ExplicitPeriodPolicy();
  strictPeriodPolicy.closePeriod(instId, 2026, 10); // Close October 2026

  const closedDateEntry = new JournalEntry({
    id: 'je_closed_period',
    institutionId: instId,
    transactionDate: new Date('2026-10-15'),
    accountingDate: new Date('2026-10-15'), // In closed period
    description: 'Posting to closed period',
    createdBy: 'usr_staff_01',
    lines: [
      new JournalLine({ id: 'p1', accountId: 'acc_cash', debit: Money.egp('200.00'), credit: Money.zero() }),
      new JournalLine({ id: 'p2', accountId: 'acc_rev', debit: Money.zero(), credit: Money.egp('200.00') })
    ]
  });

  let caughtClosedPeriod = false;
  try {
    closedDateEntry.validate(chart, strictPeriodPolicy);
  } catch (err: any) {
    if (err instanceof AccountingDomainError && err.message.includes('CLOSED')) {
      caughtClosedPeriod = true;
    }
  }
  assert(caughtClosedPeriod, 'Posting to a closed accounting period is blocked by policy');
  assert(closedDateEntry.auditEvents.some(e => e.eventType === 'TRANSITION_REJECTED'), 'TRANSITION_REJECTED audit event recorded on period failure');

  return { passed, failed };
}

