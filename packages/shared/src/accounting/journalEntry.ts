/**
 * OX-DIGITAL Education — Financial Core Engine
 * Module C & D — Double-Entry Journal Engine & Lifecycle Management
 * Pure Domain Implementation of Institutional Ledger Invariants
 */

import {
  AccountNotFoundError,
  AccountingDomainError,
  CrossInstitutionError,
  DuplicateReversalError,
  ImmutablePostedEntryError,
  InvalidAmountError,
  InvalidLifecycleTransitionError,
  UnbalancedJournalEntryError
} from './errors.js';
import { Money, CurrencyCode } from './money.js';
import { Account, ChartOfAccounts } from './account.js';
import { BranchDimension } from './dimensions.js';
import { IAccountingPeriodPolicy, PermissivePeriodPolicy } from './periodPolicy.js';
import { AccountingAuditEvent, AuditEventCollector } from './audit.js';

export type EntryStatus = 'DRAFT' | 'VALIDATED' | 'POSTED';

export interface JournalLineProps {
  id: string;
  accountId: string;
  debit: Money;
  credit: Money;
  branchDimension?: BranchDimension | null;
  description?: string;
}

export class JournalLine {
  public readonly id: string;
  public readonly accountId: string;
  public readonly debit: Money;
  public readonly credit: Money;
  public readonly branchDimension: BranchDimension | null;
  public readonly description?: string;

  constructor(props: JournalLineProps) {
    if (!props.id) {
      throw new AccountingDomainError('Journal line must have an id.');
    }
    if (!props.accountId) {
      throw new AccountingDomainError('Journal line must specify an accountId.');
    }

    // Currency must match between debit and credit
    if (props.debit.currencyCode !== props.credit.currencyCode) {
      throw new AccountingDomainError('Debit and Credit in a single line must have identical currency.');
    }

    // Invariant: Exactly one of debit or credit must be strictly positive (> 0), other must be zero
    const hasDebit = props.debit.isPositive();
    const hasCredit = props.credit.isPositive();

    if (props.debit.isNegative() || props.credit.isNegative()) {
      throw new InvalidAmountError('Journal line debit and credit amounts must be positive or zero.');
    }

    if ((hasDebit && hasCredit) || (!hasDebit && !hasCredit)) {
      throw new InvalidAmountError(
        'Journal line must have either a positive debit OR a positive credit, never both and never neither.'
      );
    }

    this.id = props.id;
    this.accountId = props.accountId;
    this.debit = props.debit;
    this.credit = props.credit;
    this.branchDimension = props.branchDimension || null;
    this.description = props.description;

    Object.freeze(this);
  }

  public get amount(): Money {
    return this.debit.isPositive() ? this.debit : this.credit;
  }

  public get isDebit(): boolean {
    return this.debit.isPositive();
  }

  public get isCredit(): boolean {
    return this.credit.isPositive();
  }
}

export interface JournalEntryProps {
  id: string;
  institutionId: string;
  transactionDate: Date;
  accountingDate: Date;
  currency?: CurrencyCode;
  description: string;
  referenceId?: string;
  reversalOfEntryId?: string;
  lines?: JournalLine[];
  createdBy: string;
}

export class JournalEntry {
  public readonly id: string;
  public readonly institutionId: string;
  public readonly currency: CurrencyCode;
  public readonly description: string;
  public readonly referenceId?: string;
  public readonly createdBy: string;

  private readonly _transactionDate: Date;
  private readonly _accountingDate: Date;
  private readonly _createdAt: Date;
  private _status: EntryStatus = 'DRAFT';
  private _lines: JournalLine[] = [];
  private _postedAt?: Date;
  private _postedBy?: string;
  private readonly _reversalOfEntryId?: string;

  private readonly auditCollector: AuditEventCollector;

  constructor(props: JournalEntryProps, auditCollector?: AuditEventCollector) {
    if (!props.id) throw new AccountingDomainError('Journal entry must have an id.');
    if (!props.institutionId) throw new AccountingDomainError('Journal entry must have an institutionId.');
    if (!props.description || props.description.trim().length === 0) {
      throw new AccountingDomainError('Journal entry description cannot be empty.');
    }
    if (!props.createdBy) throw new AccountingDomainError('Journal entry must record createdBy actor.');

    this.id = props.id;
    this.institutionId = props.institutionId;
    this._transactionDate = new Date(props.transactionDate);
    this._accountingDate = new Date(props.accountingDate);
    this.currency = props.currency || 'EGP';
    this.description = props.description.trim();
    this.referenceId = props.referenceId;
    this._reversalOfEntryId = props.reversalOfEntryId;
    this.createdBy = props.createdBy;
    this._createdAt = new Date();

    this.auditCollector = auditCollector || new AuditEventCollector();

    if (props.lines && props.lines.length > 0) {
      for (const line of props.lines) {
        this.addLine(line);
      }
    }

    this.auditCollector.record('ENTRY_CREATED', this.institutionId, this.id, this.createdBy, {
      description: this.description,
      accountingDate: this._accountingDate.toISOString(),
      currency: this.currency
    });
  }

  public get transactionDate(): Date {
    return new Date(this._transactionDate.getTime());
  }

  public get accountingDate(): Date {
    return new Date(this._accountingDate.getTime());
  }

  public get createdAt(): Date {
    return new Date(this._createdAt.getTime());
  }

  public get status(): EntryStatus {
    return this._status;
  }

  public get lines(): readonly JournalLine[] {
    return Object.freeze([...this._lines]);
  }

  public get postedAt(): Date | undefined {
    return this._postedAt ? new Date(this._postedAt.getTime()) : undefined;
  }

  public get postedBy(): string | undefined {
    return this._postedBy;
  }

  public get isReversed(): boolean {
    return this.auditCollector.isEntryReversed(this.id);
  }

  public get reversedAt(): Date | undefined {
    const revEvent = this.auditCollector.getReversalEvent(this.id);
    return revEvent ? revEvent.timestamp : undefined;
  }

  public get reversedBy(): string | undefined {
    const revEvent = this.auditCollector.getReversalEvent(this.id);
    return revEvent ? revEvent.actorId : undefined;
  }

  public get reversalOfEntryId(): string | undefined {
    return this._reversalOfEntryId;
  }

  public get reversalEntryId(): string | undefined {
    const revEvent = this.auditCollector.getReversalEvent(this.id);
    return revEvent ? (revEvent.details.reversalEntryId as string | undefined) : undefined;
  }

  public get auditEvents(): readonly AccountingAuditEvent[] {
    return this.auditCollector.getEventsForEntry(this.id);
  }

  public addLine(line: JournalLine): void {
    if (this._status !== 'DRAFT') {
      throw new ImmutablePostedEntryError(this.id, 'addLine');
    }

    if (line.debit.currencyCode !== this.currency || line.credit.currencyCode !== this.currency) {
      throw new AccountingDomainError(
        `Journal line currency '${line.debit.currencyCode}' does not match entry currency '${this.currency}'.`
      );
    }

    if (line.branchDimension) {
      line.branchDimension.assertBelongsToInstitution(this.institutionId);
    }

    this._lines.push(line);
  }

  public getTotalDebits(): Money {
    let sum = Money.zero(this.currency);
    for (const line of this._lines) {
      sum = sum.add(line.debit);
    }
    return sum;
  }

  public getTotalCredits(): Money {
    let sum = Money.zero(this.currency);
    for (const line of this._lines) {
      sum = sum.add(line.credit);
    }
    return sum;
  }

  public isBalanced(): boolean {
    const debits = this.getTotalDebits();
    const credits = this.getTotalCredits();
    return debits.equals(credits);
  }

  /**
   * Validates all core accounting invariants against a specific Chart of Accounts.
   */
  public validate(chart: ChartOfAccounts, periodPolicy: IAccountingPeriodPolicy = new PermissivePeriodPolicy()): void {
    if (this._status === 'POSTED') {
      return; // Already validated and posted
    }

    if (this.institutionId !== chart.institutionId) {
      throw new CrossInstitutionError('Chart of Accounts', this.institutionId, chart.institutionId);
    }

    // Invariant 1: At least 2 lines (minimum 1 debit, 1 credit)
    if (this._lines.length < 2) {
      this.recordRejectedTransition('VALIDATE', 'Entry must contain at least two lines.');
      throw new AccountingDomainError(`Journal entry '${this.id}' must contain at least two lines (one debit, one credit).`);
    }

    const hasDebit = this._lines.some(l => l.isDebit);
    const hasCredit = this._lines.some(l => l.isCredit);
    if (!hasDebit || !hasCredit) {
      this.recordRejectedTransition('VALIDATE', 'Entry must contain at least one debit and one credit line.');
      throw new AccountingDomainError(`Journal entry '${this.id}' must have at least one debit line and one credit line.`);
    }

    // Invariant 2: Total Debits == Total Credits
    const debits = this.getTotalDebits();
    const credits = this.getTotalCredits();
    if (!debits.equals(credits)) {
      this.recordRejectedTransition('VALIDATE', `Unbalanced: Debits (${debits}) != Credits (${credits})`);
      throw new UnbalancedJournalEntryError(debits.toString(), credits.toString());
    }

    // Invariant 3: Validate accounts exist, are active, are postable, and match institution
    for (const line of this._lines) {
      const account = chart.getOrThrow(line.accountId);
      if (account.institutionId !== this.institutionId) {
        throw new CrossInstitutionError(`Account '${account.code}'`, this.institutionId, account.institutionId);
      }
      account.assertEligibleForPosting();
    }

    // Invariant 4: Validate accounting period
    const periodCheck = periodPolicy.isDateOpenForPosting(this.institutionId, this.accountingDate);
    if (!periodCheck.isOpen) {
      this.recordRejectedTransition('VALIDATE', periodCheck.reason || 'Period is closed');
      throw new AccountingDomainError(
        periodCheck.reason || `Accounting date ${this.accountingDate.toISOString()} is in a closed accounting period.`
      );
    }

    this._status = 'VALIDATED';
    this.auditCollector.record('ENTRY_VALIDATED', this.institutionId, this.id, this.createdBy, {
      totalAmount: debits.toString(),
      linesCount: this._lines.length
    });
  }

  /**
   * Posts the validated journal entry, transitioning to immutable POSTED status.
   */
  public post(
    postedBy: string,
    chart: ChartOfAccounts,
    periodPolicy: IAccountingPeriodPolicy = new PermissivePeriodPolicy()
  ): void {
    if (!postedBy) {
      throw new AccountingDomainError('Posting requires an explicit postedBy user identifier.');
    }

    // Idempotency: If already posted by same actor, return without re-posting
    if (this._status === 'POSTED') {
      return;
    }

    // Auto-validate if in DRAFT status
    if (this._status === 'DRAFT') {
      this.validate(chart, periodPolicy);
    }

    if (this._status !== 'VALIDATED') {
      this.recordRejectedTransition('POST', `Cannot post entry in status '${this._status}'`);
      throw new InvalidLifecycleTransitionError(this._status, 'POSTED');
    }

    this._status = 'POSTED';
    this._postedAt = new Date();
    this._postedBy = postedBy;

    this.auditCollector.record('ENTRY_POSTED', this.institutionId, this.id, postedBy, {
      postedAt: this._postedAt.toISOString(),
      totalAmount: this.getTotalDebits().toString()
    });
  }

  /**
   * Reverses this posted entry by creating an exact compensating entry with inverted debits and credits.
   * Note: In a pure append-only ledger, the original entry's status is NOT mutated; it remains POSTED.
   * The reversal relationship is established by the compensating entry's reversalOfEntryId and the ENTRY_REVERSED audit event.
   */
  public reverse(
    reversedBy: string,
    reason: string,
    reversalEntryId?: string,
    reversalDate: Date = new Date()
  ): JournalEntry {
    if (this._status !== 'POSTED') {
      this.recordRejectedTransition('REVERSE', `Cannot reverse entry in status '${this._status}'`);
      throw new InvalidLifecycleTransitionError(
        this._status,
        'POSTED',
        'Only POSTED journal entries can be reversed.'
      );
    }

    const existingReversal = this.auditCollector.getReversalEvent(this.id);
    if (existingReversal) {
      const existingRevId = (existingReversal.details.reversalEntryId as string) || '';
      throw new DuplicateReversalError(this.id, existingRevId);
    }

    const revId = reversalEntryId || `rev_${this.id}_${Date.now()}`;

    // Create inverted lines: debit becomes credit, credit becomes debit
    const invertedLines: JournalLine[] = this._lines.map((line, idx) => {
      return new JournalLine({
        id: `${revId}_line_${idx + 1}`,
        accountId: line.accountId,
        debit: line.credit, // Invert
        credit: line.debit, // Invert
        branchDimension: line.branchDimension,
        description: `Reversal of line ${line.id}: ${line.description || reason}`
      });
    });

    const reversalEntry = new JournalEntry(
      {
        id: revId,
        institutionId: this.institutionId,
        transactionDate: reversalDate,
        accountingDate: reversalDate,
        currency: this.currency,
        description: `REVERSAL of ${this.id}: ${reason}`,
        referenceId: this.id,
        reversalOfEntryId: this.id,
        lines: invertedLines,
        createdBy: reversedBy
      },
      this.auditCollector
    );

    // Pure append-only ledger invariant: original entry remains POSTED and immutable.
    // Reversal is recorded in the immutable audit event log.
    this.auditCollector.record('ENTRY_REVERSED', this.institutionId, this.id, reversedBy, {
      reversedAt: reversalDate.toISOString(),
      reversalEntryId: revId,
      reason
    });

    return reversalEntry;
  }

  private recordRejectedTransition(targetAction: string, reason: string): void {
    this.auditCollector.record('TRANSITION_REJECTED', this.institutionId, this.id, this.createdBy, {
      currentStatus: this._status,
      attemptedAction: targetAction,
      reason
    });
  }
}

