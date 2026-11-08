/**
 * OX-DIGITAL Education — Financial Core Engine
 * Phase 2.0B — Physical Education Center Accounting Integration
 * Integration Boundary Service & Unresolved Policy Blocking Guards
 */

import {
  UnresolvedPolicyBlockedError,
  CrossInstitutionError,
  PrematurePostingError,
  InvalidEvidenceError
} from '../errors.js';
import { LessonDeliveryEvidence } from './evidence.js';
import { StudentFinancialAgreement } from './agreement.js';
import { StudentObligation, CollectionReceiptEvidence } from './obligations.js';
import {
  LessonDeliveryCertifiedEvent,
  StudentAgreementEstablishedEvent,
  FeeDueScheduledEvent,
  FeeCollectionReceivedEvent,
  DeliveryProofLinkedEvent
} from './events.js';

/**
 * CenterEvidenceBoundaryService serves as the authoritative boundary manager
 * between existing educational-center operations and the accounting domain engine.
 *
 * It enforces:
 * 1. Decoupled lifecycle transitions (no auto-posting).
 * 2. Multi-tenant and branch isolation.
 * 3. Fail-closed guards on unresolved Product Owner policy gates.
 */
export class CenterEvidenceBoundaryService {
  /**
   * Evaluates academic delivery evidence and registers certification.
   */
  public static registerDeliveryCertification(evidence: LessonDeliveryEvidence): LessonDeliveryCertifiedEvent {
    if (evidence.status !== 'CERTIFIED') {
      throw new InvalidEvidenceError('Cannot emit delivery certified event: Evidence is not in CERTIFIED status.');
    }

    return {
      eventType: 'LESSON_DELIVERY_CERTIFIED',
      evidenceId: evidence.evidenceId,
      institutionId: evidence.institutionId,
      branchId: evidence.branchId,
      centerGroupId: evidence.centerGroupId,
      lessonId: evidence.lessonId,
      courseId: evidence.courseId,
      teacherId: evidence.teacherId,
      deliveredAt: evidence.deliveredAt.toISOString(),
      certifiedByUserId: evidence.certifiedByUserId || 'UNKNOWN',
      certifiedAt: evidence.certifiedAt?.toISOString() || new Date().toISOString(),
      attendedStudentCount: evidence.getAttendedStudentCount()
    };
  }

  /**
   * Registers a student financial agreement establishment.
   * Crucial: Emits event WITHOUT posting revenue or journal entries.
   */
  public static registerAgreementEstablished(agreement: StudentFinancialAgreement): StudentAgreementEstablishedEvent {
    return {
      eventType: 'STUDENT_AGREEMENT_ESTABLISHED',
      agreementId: agreement.agreementId,
      studentId: agreement.studentId,
      centerGroupId: agreement.centerGroupId,
      institutionId: agreement.institutionId,
      branchId: agreement.branchId,
      netAgreedPrice: agreement.priceSnapshot.netAgreedPrice.toString(),
      currency: 'EGP',
      scheduledItemsCount: agreement.arrangementSchedule.length,
      establishedAt: agreement.createdAt.toISOString()
    };
  }

  /**
   * Registers scheduled fee obligation.
   */
  public static registerFeeDue(obligation: StudentObligation): FeeDueScheduledEvent {
    return {
      eventType: 'FEE_DUE_SCHEDULED',
      obligationId: obligation.obligationId,
      agreementId: obligation.agreementId,
      studentId: obligation.studentId,
      institutionId: obligation.institutionId,
      branchId: obligation.branchId,
      scheduleItemNumber: obligation.scheduleItemNumber,
      dueDate: obligation.dueDate.toISOString(),
      amountDue: obligation.amountDue.toString(),
      currency: 'EGP'
    };
  }

  /**
   * Registers fee collection receipt.
   */
  public static registerFeeCollection(receipt: CollectionReceiptEvidence): FeeCollectionReceivedEvent {
    return {
      eventType: 'FEE_COLLECTION_RECEIVED',
      collectionId: receipt.collectionId,
      institutionId: receipt.institutionId,
      branchId: receipt.branchId,
      cashboxId: receipt.cashboxId,
      cashierUserId: receipt.cashierUserId,
      studentId: receipt.studentId,
      obligationId: receipt.obligationId,
      amountCollected: receipt.amountCollected.toString(),
      currency: 'EGP',
      receiptNumber: receipt.receiptNumber,
      paymentMethod: receipt.paymentMethod,
      collectedAt: receipt.collectedAt.toISOString()
    };
  }

  /**
   * Links certified delivery evidence to an active student agreement.
   * Establishes delivery proof pairing WITHOUT executing premature revenue recognition.
   */
  public static linkDeliveryProof(
    evidence: LessonDeliveryEvidence,
    agreement: StudentFinancialAgreement,
    studentId: string
  ): DeliveryProofLinkedEvent {
    // Cross-tenant guard
    if (evidence.institutionId !== agreement.institutionId) {
      throw new CrossInstitutionError('LessonDeliveryEvidence', agreement.institutionId, evidence.institutionId);
    }

    // Branch match check
    if (evidence.branchId !== agreement.branchId) {
      throw new InvalidEvidenceError(
        `Branch mismatch: Evidence branch '${evidence.branchId}' does not match agreement branch '${agreement.branchId}'.`
      );
    }

    // Group match check
    if (evidence.centerGroupId !== agreement.centerGroupId) {
      throw new InvalidEvidenceError(
        `Group mismatch: Evidence group '${evidence.centerGroupId}' does not match agreement group '${agreement.centerGroupId}'.`
      );
    }

    // Certification check
    if (evidence.status !== 'CERTIFIED') {
      throw new InvalidEvidenceError('Cannot link uncertified lesson delivery evidence.');
    }

    // Attendance verification
    if (!evidence.isStudentAttended(studentId)) {
      throw new InvalidEvidenceError(
        `Student '${studentId}' was not marked PRESENT in lesson delivery evidence '${evidence.evidenceId}'.`
      );
    }

    return {
      eventType: 'DELIVERY_PROOF_LINKED',
      evidenceId: evidence.evidenceId,
      agreementId: agreement.agreementId,
      studentId,
      lessonId: evidence.lessonId,
      centerGroupId: evidence.centerGroupId,
      institutionId: evidence.institutionId,
      branchId: evidence.branchId,
      linkedAt: new Date().toISOString(),
      revenueRecognized: false
    };
  }

  // ============================================================================
  // UNRESOLVED POLICY GATES (FAIL-CLOSED BLOCKING GUARDS)
  // Section 4 of Phase 2.0B Specification
  // ============================================================================

  /**
   * UP-704: Teacher Compensation Variable Revenue-Share / Per-Student Calculation.
   * Fails closed: Variable revenue sharing cannot be computed until Product Owner approves formula basis.
   */
  public static guardTeacherVariableCompensation(compensationModelType: string): void {
    if (compensationModelType === 'REVENUE_SHARE' || compensationModelType === 'PER_STUDENT') {
      throw new UnresolvedPolicyBlockedError(
        'UP-704',
        'Teacher variable revenue-share or per-student compensation calculation basis is pending Product Owner policy approval.'
      );
    }
  }

  /**
   * UP-705: Cashbox Till Discrepancy Sign-Off Threshold.
   * Fails closed: Automated variance absorption or manager write-off cannot proceed without approved threshold.
   */
  public static guardCashboxDiscrepancyThreshold(discrepancyAmountEgp: number): void {
    if (discrepancyAmountEgp !== 0) {
      throw new UnresolvedPolicyBlockedError(
        'UP-705',
        'Cashbox discrepancy sign-off and clearing threshold policy is pending Product Owner approval.'
      );
    }
  }

  /**
   * OD-710: Accounting Period Closing & Reopening Workflow.
   * Fails closed: Automated hard-close of fiscal periods is blocked until audit reopening policy is approved.
   */
  public static guardAccountingPeriodCloseWorkflow(operation: 'CLOSE_PERIOD' | 'REOPEN_PERIOD'): void {
    throw new UnresolvedPolicyBlockedError(
      'OD-710',
      `Accounting period operation '${operation}' is blocked pending Product Owner period close and reopening governance policy.`
    );
  }

  /**
   * UP-701: Statutory Chart of Accounts Egyptian Regulatory Review.
   */
  public static guardStatutoryChartReview(): void {
    throw new UnresolvedPolicyBlockedError(
      'UP-701',
      'Statutory chart of accounts requires formal Egyptian accounting specialist review before production ledger lock.'
    );
  }

  /**
   * UP-702: Written Egyptian Tax Counsel Opinion.
   */
  public static guardEgyptianTaxCounselOpinion(): void {
    throw new UnresolvedPolicyBlockedError(
      'UP-702',
      'Tax rate assumptions and withholding treatments require written Egyptian tax counsel opinion.'
    );
  }

  /**
   * UP-706: Student Refund Policy Legal Review.
   */
  public static guardRefundProcessing(): void {
    throw new UnresolvedPolicyBlockedError(
      'UP-706',
      'Student refund processing policy is pending formal legal review and Product Owner authorization.'
    );
  }

  /**
   * UP-715: Statutory Retention & PII Scrubbing Policy.
   */
  public static guardRetentionAndPiiScrubbing(): void {
    throw new UnresolvedPolicyBlockedError(
      'UP-715',
      'Statutory 5-year retention and PII scrubbing rules are pending specialist compliance review.'
    );
  }

  /**
   * UP-711: Real Legacy Opening Balances Migration Policy.
   */
  public static guardLegacyOpeningBalances(): void {
    throw new UnresolvedPolicyBlockedError(
      'UP-711',
      'Real legacy opening balance migration policy is pending Product Owner data reconciliation.'
    );
  }
}
