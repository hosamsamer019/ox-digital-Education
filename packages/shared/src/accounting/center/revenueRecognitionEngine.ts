/**
 * OX-DIGITAL Education — Financial Core Engine
 * Phase 2.0B — Increment 2: Accrual Revenue Recognition Pairing Engine
 * Double-Entry Journal Posting & Evidence Pairing Engine
 */

import { Money } from '../money.js';
import {
  InvalidEvidenceError,
  CrossInstitutionError,
  PrematurePostingError,
  EvidenceAlreadyConsumedError,
  ExcessiveRevenueRecognitionError,
  AccountingDomainError
} from '../errors.js';
import { ChartOfAccounts } from '../account.js';
import { BranchDimension } from '../dimensions.js';
import { JournalEntry, JournalLine } from '../journalEntry.js';
import { IAccountingPeriodPolicy, PermissivePeriodPolicy } from '../periodPolicy.js';
import { LessonDeliveryEvidence } from './evidence.js';
import { StudentFinancialAgreement } from './agreement.js';
import { RevenueAllocationPlan } from './revenueAllocation.js';

/**
 * Provisional Internal Chart of Accounts Reference (Awaiting UP-701 Specialist Review)
 * Core Rule 3.D: Does not claim legally approved statutory status.
 */
export interface ProvisionalAccountMapping {
  deferredRevenueAccountCode: string;
  earnedTuitionRevenueAccountCode: string;
  awaitingStatutoryReview: 'UP-701';
}

export const DEFAULT_PROVISIONAL_MAPPING: Readonly<ProvisionalAccountMapping> = Object.freeze({
  deferredRevenueAccountCode: '2210', // Provisional Unearned Tuition Liability
  earnedTuitionRevenueAccountCode: '4100', // Provisional Earned Tuition Revenue
  awaitingStatutoryReview: 'UP-701'
});

export type RecognitionRecordStatus = 'POSTED' | 'REVERSED';

export interface RevenueRecognitionRecord {
  idempotencyKey: string;
  evidenceId: string;
  agreementId: string;
  studentId: string;
  lessonId: string;
  centerGroupId: string;
  institutionId: string;
  branchId: string;
  amountRecognized: Money;
  journalEntry: JournalEntry;
  recognizedAt: Date;
  status: RecognitionRecordStatus;
  reversalJournalEntry?: JournalEntry;
  reversalReason?: string;
}

export interface IConsumedEvidenceStore {
  hasConsumed(evidenceId: string, studentId: string): boolean;
  getByIdempotencyKey(key: string): RevenueRecognitionRecord | undefined;
  record(record: RevenueRecognitionRecord): void;
  markReversed(idempotencyKey: string, reversalEntry: JournalEntry, reason: string): void;
}

/**
 * In-memory domain implementation of evidence consumption tracking.
 */
export class InMemoryConsumedEvidenceStore implements IConsumedEvidenceStore {
  private readonly consumedKeys = new Map<string, RevenueRecognitionRecord>();
  private readonly evidenceStudentPairs = new Map<string, string>(); // evidenceId:studentId -> idempotencyKey

  public hasConsumed(evidenceId: string, studentId: string): boolean {
    const pairKey = `${evidenceId}:${studentId}`;
    const idempKey = this.evidenceStudentPairs.get(pairKey);
    if (!idempKey) return false;
    const record = this.consumedKeys.get(idempKey);
    return record?.status === 'POSTED';
  }

  public getByIdempotencyKey(key: string): RevenueRecognitionRecord | undefined {
    return this.consumedKeys.get(key);
  }

  public record(record: RevenueRecognitionRecord): void {
    const pairKey = `${record.evidenceId}:${record.studentId}`;
    this.consumedKeys.set(record.idempotencyKey, record);
    this.evidenceStudentPairs.set(pairKey, record.idempotencyKey);
  }

  public markReversed(idempotencyKey: string, reversalEntry: JournalEntry, reason: string): void {
    const record = this.consumedKeys.get(idempotencyKey);
    if (!record) {
      throw new AccountingDomainError(`Recognition record not found for idempotency key: ${idempotencyKey}`);
    }
    const updated: RevenueRecognitionRecord = {
      ...record,
      status: 'REVERSED',
      reversalJournalEntry: reversalEntry,
      reversalReason: reason
    };
    this.consumedKeys.set(idempotencyKey, updated);
  }
}

export interface AccrualRecognitionParams {
  evidence: LessonDeliveryEvidence;
  agreement: StudentFinancialAgreement;
  studentId: string;
  allocationPlan: RevenueAllocationPlan;
  evidenceStore: IConsumedEvidenceStore;
  chartOfAccounts: ChartOfAccounts;
  periodPolicy?: IAccountingPeriodPolicy;
  actor: string;
  entryDate?: Date;
  branchCode?: string;
  provisionalMapping?: ProvisionalAccountMapping;
}

export interface AccrualRecognitionResult {
  journalEntry: JournalEntry;
  record: RevenueRecognitionRecord;
  updatedAllocationPlan: RevenueAllocationPlan;
  isIdempotentReplay: boolean;
}

export interface AccrualReversalParams {
  idempotencyKey: string;
  reversalEntryId: string;
  actor: string;
  reason: string;
  evidenceStore: IConsumedEvidenceStore;
  chartOfAccounts: ChartOfAccounts;
  periodPolicy?: IAccountingPeriodPolicy;
  allocationPlan: RevenueAllocationPlan;
}

export interface AccrualReversalResult {
  reversalJournalEntry: JournalEntry;
  updatedRecord: RevenueRecognitionRecord;
  revertedAllocationPlan: RevenueAllocationPlan;
}

/**
 * AccrualRevenueRecognitionEngine is the authoritative pairing and journal
 * posting engine for physical education centers.
 */
export class AccrualRevenueRecognitionEngine {
  /**
   * Generates a deterministic domain-level idempotency key.
   */
  public static computeIdempotencyKey(
    institutionId: string,
    agreementId: string,
    evidenceId: string,
    studentId: string
  ): string {
    return `REV_REC_${institutionId}_${agreementId}_${evidenceId}_${studentId}`;
  }

  /**
   * Core Recognition Workflow:
   * 1. Validates certified physical delivery evidence against student agreement.
   * 2. Checks idempotency & duplicate evidence consumption.
   * 3. Allocates deterministic service value via RevenueAllocationPlan.
   * 4. Produces, validates, and posts a balanced double-entry journal entry:
   *    DR Deferred Revenue (2210) / CR Earned Tuition (4100).
   * 5. Immutably records consumed evidence.
   */
  public static recognizeRevenue(params: AccrualRecognitionParams): AccrualRecognitionResult {
    const {
      evidence,
      agreement,
      studentId,
      allocationPlan,
      evidenceStore,
      chartOfAccounts,
      periodPolicy = new PermissivePeriodPolicy(),
      actor,
      entryDate = new Date(),
      branchCode = 'PHYSICAL_BRANCH',
      provisionalMapping = DEFAULT_PROVISIONAL_MAPPING
    } = params;

    // ------------------------------------------------------------------
    // STEP 1: Evidence & Agreement Matching Verification
    // ------------------------------------------------------------------

    if (evidence.status !== 'CERTIFIED') {
      throw new InvalidEvidenceError(
        `Revenue Recognition Rejected: Lesson delivery evidence '${evidence.evidenceId}' is in '${evidence.status}' status. Only CERTIFIED evidence is eligible for revenue recognition.`
      );
    }

    if (agreement.status !== 'ACTIVE') {
      throw new PrematurePostingError(
        'Lifecycle B (Student Financial Agreement)',
        `Agreement '${agreement.agreementId}' is in '${agreement.status}' status. Only ACTIVE agreements are eligible for revenue recognition.`
      );
    }

    // Cross-tenant verification
    if (evidence.institutionId !== agreement.institutionId) {
      throw new CrossInstitutionError(
        'LessonDeliveryEvidence',
        agreement.institutionId,
        evidence.institutionId
      );
    }

    // Branch match verification
    if (evidence.branchId !== agreement.branchId) {
      throw new InvalidEvidenceError(
        `Branch Mismatch: Evidence branch '${evidence.branchId}' does not match agreement branch '${agreement.branchId}'.`
      );
    }

    // CenterGroup match verification
    if (evidence.centerGroupId !== agreement.centerGroupId) {
      throw new InvalidEvidenceError(
        `Group Mismatch: Evidence group '${evidence.centerGroupId}' does not match agreement group '${agreement.centerGroupId}'.`
      );
    }

    // Student identity verification
    if (agreement.studentId !== studentId) {
      throw new InvalidEvidenceError(
        `Student Mismatch: Agreement belongs to student '${agreement.studentId}', but recognition was requested for '${studentId}'. Cross-student evidence pairing is strictly barred.`
      );
    }

    // Attendance verification
    if (!evidence.isStudentAttended(studentId)) {
      throw new InvalidEvidenceError(
        `Student Attendance Missing: Student '${studentId}' was not marked PRESENT in delivery evidence '${evidence.evidenceId}'. Unearned revenue cannot be recognized for unproven attendance.`
      );
    }

    // ------------------------------------------------------------------
    // STEP 2: Idempotency & Duplicate Consumption Protection
    // ------------------------------------------------------------------

    const idempotencyKey = this.computeIdempotencyKey(
      evidence.institutionId,
      agreement.agreementId,
      evidence.evidenceId,
      studentId
    );

    const existingRecord = evidenceStore.getByIdempotencyKey(idempotencyKey);
    if (existingRecord) {
      if (existingRecord.status === 'POSTED') {
        // Idempotent replay: return identical result without duplicate posting
        return {
          journalEntry: existingRecord.journalEntry,
          record: existingRecord,
          updatedAllocationPlan: allocationPlan,
          isIdempotentReplay: true
        };
      } else {
        throw new InvalidEvidenceError(
          `Recognition attempt rejected: Idempotency key '${idempotencyKey}' was previously REVERSED.`
        );
      }
    }

    // Duplicate evidence consumption guard across any other agreement
    if (evidenceStore.hasConsumed(evidence.evidenceId, studentId)) {
      throw new EvidenceAlreadyConsumedError(
        evidence.evidenceId,
        studentId,
        'Delivery evidence cannot be consumed multiple times for the same student.'
      );
    }

    // ------------------------------------------------------------------
    // STEP 3: Deterministic Service Allocation
    // ------------------------------------------------------------------

    const recognitionAmount = allocationPlan.calculateNextUnitRecognitionAmount();

    if (recognitionAmount.isZero() || recognitionAmount.isNegative()) {
      throw new AccountingDomainError('Recognition amount must be strictly positive.');
    }

    // ------------------------------------------------------------------
    // STEP 4: Double-Entry Journal Generation & Posting
    // ------------------------------------------------------------------

    const deferredAccount = chartOfAccounts.getOrThrow(provisionalMapping.deferredRevenueAccountCode);
    const revenueAccount = chartOfAccounts.getOrThrow(provisionalMapping.earnedTuitionRevenueAccountCode);

    const branchDim = BranchDimension.physical(
      evidence.institutionId,
      evidence.branchId,
      branchCode
    );

    const entryId = `JE_REV_${evidence.evidenceId}_${studentId}`;

    const debitLine = new JournalLine({
      id: `${entryId}_L1_DR`,
      accountId: deferredAccount.id,
      debit: recognitionAmount,
      credit: Money.zero('EGP'),
      branchDimension: branchDim,
      description: `Amortize unearned tuition for lesson ${evidence.lessonId} (student ${studentId})`
    });

    const creditLine = new JournalLine({
      id: `${entryId}_L2_CR`,
      accountId: revenueAccount.id,
      debit: Money.zero('EGP'),
      credit: recognitionAmount,
      branchDimension: branchDim,
      description: `Earned tuition revenue for lesson ${evidence.lessonId} (student ${studentId})`
    });

    const entry = new JournalEntry({
      id: entryId,
      institutionId: evidence.institutionId,
      transactionDate: entryDate,
      accountingDate: entryDate,
      currency: 'EGP',
      description: `Accrual Revenue Recognition: Lesson ${evidence.lessonId} delivered for student ${studentId}`,
      referenceId: evidence.evidenceId,
      lines: [debitLine, creditLine],
      createdBy: actor
    });

    // Validate double-entry balance and chart compliance
    entry.validate(chartOfAccounts, periodPolicy);

    // Immutable posting to General Ledger
    entry.post(actor, chartOfAccounts, periodPolicy);

    // ------------------------------------------------------------------
    // STEP 5: Record Consumed Evidence & Return
    // ------------------------------------------------------------------

    const record: RevenueRecognitionRecord = {
      idempotencyKey,
      evidenceId: evidence.evidenceId,
      agreementId: agreement.agreementId,
      studentId,
      lessonId: evidence.lessonId,
      centerGroupId: evidence.centerGroupId,
      institutionId: evidence.institutionId,
      branchId: evidence.branchId,
      amountRecognized: recognitionAmount,
      journalEntry: entry,
      recognizedAt: entryDate,
      status: 'POSTED'
    };

    evidenceStore.record(record);
    const updatedPlan = allocationPlan.advance(recognitionAmount);

    return {
      journalEntry: entry,
      record,
      updatedAllocationPlan: updatedPlan,
      isIdempotentReplay: false
    };
  }

  /**
   * Reverses a previously posted revenue recognition.
   * Preserves pure append-only accounting immutability.
   */
  public static reverseRevenueRecognition(params: AccrualReversalParams): AccrualReversalResult {
    const {
      idempotencyKey,
      reversalEntryId,
      actor,
      reason,
      evidenceStore,
      chartOfAccounts,
      periodPolicy = new PermissivePeriodPolicy(),
      allocationPlan
    } = params;

    const record = evidenceStore.getByIdempotencyKey(idempotencyKey);
    if (!record) {
      throw new AccountingDomainError(`Cannot reverse: Record for '${idempotencyKey}' does not exist.`);
    }

    if (record.status === 'REVERSED') {
      throw new AccountingDomainError(`Recognition for '${idempotencyKey}' has already been reversed.`);
    }

    // Pure append-only reversal of the original posted journal entry
    const reversalEntry = record.journalEntry.reverse(actor, reason, reversalEntryId);
    reversalEntry.validate(chartOfAccounts, periodPolicy);
    reversalEntry.post(actor, chartOfAccounts, periodPolicy);

    evidenceStore.markReversed(idempotencyKey, reversalEntry, reason);

    // Revert allocation plan balance
    const revertedAmount = record.amountRecognized;
    const currentAccum = allocationPlan.accumulatedRecognizedAmount;
    const newAccum = currentAccum.subtract(revertedAmount);
    const revertedPlan = new RevenueAllocationPlan({
      agreementId: allocationPlan.agreementId,
      netAgreedPrice: allocationPlan.netAgreedPrice,
      totalEligibleUnits: allocationPlan.totalEligibleUnits,
      recognizedUnitsCount: Math.max(0, allocationPlan.recognizedUnitsCount - 1),
      accumulatedRecognizedAmount: newAccum
    });

    const updatedRecord: RevenueRecognitionRecord = {
      ...record,
      status: 'REVERSED',
      reversalJournalEntry: reversalEntry,
      reversalReason: reason
    };

    return {
      reversalJournalEntry: reversalEntry,
      updatedRecord,
      revertedAllocationPlan: revertedPlan
    };
  }
}
