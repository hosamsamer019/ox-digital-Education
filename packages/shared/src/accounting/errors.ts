/**
 * OX-DIGITAL Education — Financial Core Engine
 * Accounting Domain Errors
 * Phase 1 — Pure Domain Error Hierarchy
 */

export class AccountingDomainError extends Error {
  public readonly code: string;

  constructor(message: string, code: string = 'ACCOUNTING_DOMAIN_ERROR') {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class CurrencyMismatchError extends AccountingDomainError {
  constructor(expected: string, actual: string) {
    super(
      `Currency mismatch: Expected '${expected}', but received '${actual}'. Financial operations require identical currencies.`,
      'CURRENCY_MISMATCH'
    );
  }
}

export class InvalidAmountError extends AccountingDomainError {
  constructor(message: string) {
    super(message, 'INVALID_AMOUNT');
  }
}

export class UnbalancedJournalEntryError extends AccountingDomainError {
  public readonly totalDebits: string;
  public readonly totalCredits: string;

  constructor(totalDebits: string, totalCredits: string) {
    super(
      `Double-entry invariant violated: Total debits (${totalDebits}) do not equal total credits (${totalCredits}).`,
      'UNBALANCED_JOURNAL_ENTRY'
    );
    this.totalDebits = totalDebits;
    this.totalCredits = totalCredits;
  }
}

export class InactiveAccountError extends AccountingDomainError {
  constructor(accountCode: string) {
    super(
      `Posting rejected: Account '${accountCode}' is INACTIVE. Inactive accounts cannot accept postings.`,
      'INACTIVE_ACCOUNT'
    );
  }
}

export class NonPostableAccountError extends AccountingDomainError {
  constructor(accountCode: string) {
    super(
      `Posting rejected: Account '${accountCode}' is marked as NON-POSTABLE (parent/header account).`,
      'NON_POSTABLE_ACCOUNT'
    );
  }
}

export class AccountNotFoundError extends AccountingDomainError {
  constructor(accountCodeOrId: string, institutionId: string) {
    super(
      `Account '${accountCodeOrId}' not found in Chart of Accounts for institution '${institutionId}'.`,
      'ACCOUNT_NOT_FOUND'
    );
  }
}

export class CircularHierarchyError extends AccountingDomainError {
  constructor(accountCode: string, cyclePath: string[]) {
    super(
      `Circular hierarchy detected for account '${accountCode}'. Cycle path: ${cyclePath.join(' -> ')}.`,
      'CIRCULAR_HIERARCHY'
    );
  }
}

export class DuplicateAccountCodeError extends AccountingDomainError {
  constructor(accountCode: string, institutionId: string) {
    super(
      `Duplicate account code '${accountCode}' within institution '${institutionId}'. Account codes must be unique within an institution's chart.`,
      'DUPLICATE_ACCOUNT_CODE'
    );
  }
}

export class CrossInstitutionError extends AccountingDomainError {
  constructor(entityType: string, expectedInstitutionId: string, actualInstitutionId: string) {
    super(
      `Cross-institution mixing rejected: ${entityType} belongs to institution '${actualInstitutionId}', but journal entry belongs to '${expectedInstitutionId}'.`,
      'CROSS_INSTITUTION_VIOLATION'
    );
  }
}

export class ImmutablePostedEntryError extends AccountingDomainError {
  constructor(entryId: string, operation: string) {
    super(
      `Modification rejected: Journal entry '${entryId}' is in POSTED status and is immutable. Operation '${operation}' is barred. Use reversal or compensating entries instead.`,
      'IMMUTABLE_POSTED_ENTRY'
    );
  }
}

export class DuplicateReversalError extends AccountingDomainError {
  constructor(entryId: string, existingReversalId: string) {
    super(
      `Duplicate reversal rejected: Journal entry '${entryId}' has already been reversed by entry '${existingReversalId}'.`,
      'DUPLICATE_REVERSAL'
    );
  }
}

export class InvalidLifecycleTransitionError extends AccountingDomainError {
  constructor(currentStatus: string, targetStatus: string, reason?: string) {
    super(
      `Invalid journal lifecycle transition: Cannot transition from '${currentStatus}' to '${targetStatus}'.${reason ? ' ' + reason : ''}`,
      'INVALID_LIFECYCLE_TRANSITION'
    );
  }
}

/**
 * Phase 2.0B Integration Errors — Mandatory Business Invariants
 */

export class ForbiddenTerminologyError extends AccountingDomainError {
  constructor(field: string, term: string) {
    super(
      `Business Invariant Violation: Prohibited customer-facing term '${term}' found in '${field}'. Customer-facing terms must use 'payment arrangement', 'payment schedule', 'due', 'collected', and 'remaining'. The word 'installments' is strictly forbidden.`,
      'FORBIDDEN_TERMINOLOGY'
    );
  }
}

export class MultiCurrencyDisabledError extends AccountingDomainError {
  constructor(currency: string) {
    super(
      `Business Invariant Violation: Currency '${currency}' rejected. Multi-currency remains disabled. EGP is the sole authorized launch currency.`,
      'MULTI_CURRENCY_DISABLED'
    );
  }
}

export class UnresolvedPolicyBlockedError extends AccountingDomainError {
  public readonly policyGateId: string;

  constructor(policyGateId: string, description: string) {
    super(
      `Policy Execution Blocked: Cannot execute operation governed by unresolved policy gate '${policyGateId}' (${description}). No default policy may be silently assumed without explicit Product Owner approval.`,
      'UNRESOLVED_POLICY_BLOCKED'
    );
    this.policyGateId = policyGateId;
  }
}

export class PrematurePostingError extends AccountingDomainError {
  constructor(sourceLifecycle: string, operation: string) {
    super(
      `Accrual Accounting Invariant Violation: Premature journal posting rejected from '${sourceLifecycle}'. Operation '${operation}' cannot recognize revenue or post general ledger entries merely because an agreement was created or delivery was recorded. Revenue recognition requires verified pairing and approval under the approved service-delivery policy.`,
      'PREMATURE_POSTING_BLOCKED'
    );
  }
}

export class InvalidRoleAssignmentError extends AccountingDomainError {
  constructor(role: string, reason: string) {
    super(
      `Role Governance Violation: Role '${role}' is not an authorized accounting role. Only Primary Manager, Accountant, Cashier, and Teacher are approved. ${reason}`,
      'INVALID_ROLE_ASSIGNMENT'
    );
  }
}

export class InvalidEvidenceError extends AccountingDomainError {
  constructor(message: string) {
    super(message, 'INVALID_EVIDENCE');
  }
}

export class UnsupportedAllocationBasisError extends AccountingDomainError {
  constructor(reason: string) {
    super(
      `Revenue Allocation Error: Unsupported or undefined service allocation basis. ${reason}`,
      'UNSUPPORTED_ALLOCATION_BASIS'
    );
  }
}

export class ExcessiveRevenueRecognitionError extends AccountingDomainError {
  public readonly netAgreedPrice: string;
  public readonly attemptedTotal: string;

  constructor(netAgreedPrice: string, attemptedTotal: string) {
    super(
      `Accrual Invariant Violation: Total recognized revenue (${attemptedTotal}) cannot exceed agreement net service value (${netAgreedPrice}). Over-recognition is strictly barred.`,
      'EXCESSIVE_REVENUE_RECOGNITION'
    );
    this.netAgreedPrice = netAgreedPrice;
    this.attemptedTotal = attemptedTotal;
  }
}

export class EvidenceAlreadyConsumedError extends AccountingDomainError {
  public readonly evidenceId: string;
  public readonly studentId: string;

  constructor(evidenceId: string, studentId: string, details?: string) {
    super(
      `Duplicate Revenue Recognition Rejected: Delivery evidence '${evidenceId}' has already been consumed for student '${studentId}'. Each evidence item can only be consumed once for the same eligible service.${details ? ' ' + details : ''}`,
      'EVIDENCE_ALREADY_CONSUMED'
    );
    this.evidenceId = evidenceId;
    this.studentId = studentId;
  }
}

/**
 * Increment 3 — Sub-Ledger & Collection Allocation Errors
 */

export class ExcessiveAllocationError extends AccountingDomainError {
  public readonly requestedAmount: string;
  public readonly availableBalance: string;
  public readonly targetType: 'RECEIPT' | 'OBLIGATION';

  constructor(requestedAmount: string, availableBalance: string, targetType: 'RECEIPT' | 'OBLIGATION') {
    super(
      `Allocation Exceeded: Requested allocation amount (${requestedAmount}) exceeds available balance (${availableBalance}) on ${targetType}.`,
      'EXCESSIVE_ALLOCATION'
    );
    this.requestedAmount = requestedAmount;
    this.availableBalance = availableBalance;
    this.targetType = targetType;
  }
}

export class DuplicateReceiptError extends AccountingDomainError {
  public readonly collectionId: string;

  constructor(collectionId: string) {
    super(
      `Duplicate receipt rejected: Collection receipt '${collectionId}' has already been recorded in sub-ledger.`,
      'DUPLICATE_RECEIPT'
    );
    this.collectionId = collectionId;
  }
}

export class IneligibleObligationError extends AccountingDomainError {
  public readonly obligationId: string;
  public readonly status: string;

  constructor(obligationId: string, status: string, reason?: string) {
    super(
      `Ineligible Obligation: Obligation '${obligationId}' is in status '${status}' and cannot receive allocations.${reason ? ' ' + reason : ''}`,
      'INELIGIBLE_OBLIGATION'
    );
    this.obligationId = obligationId;
    this.status = status;
  }
}

export class CrossStudentAllocationError extends AccountingDomainError {
  public readonly receiptStudentId: string;
  public readonly obligationStudentId: string;

  constructor(receiptStudentId: string, obligationStudentId: string) {
    super(
      `Cross-student allocation rejected: Receipt belongs to student '${receiptStudentId}', but obligation belongs to student '${obligationStudentId}'.`,
      'CROSS_STUDENT_ALLOCATION'
    );
    this.receiptStudentId = receiptStudentId;
    this.obligationStudentId = obligationStudentId;
  }
}

export class CrossBranchAllocationError extends AccountingDomainError {
  public readonly receiptBranchId: string;
  public readonly obligationBranchId: string;

  constructor(receiptBranchId: string, obligationBranchId: string, reason?: string) {
    super(
      `Cross-branch allocation rejected: Receipt branch '${receiptBranchId}' does not match obligation branch '${obligationBranchId}'.${reason ? ' ' + reason : ''}`,
      'CROSS_BRANCH_ALLOCATION'
    );
    this.receiptBranchId = receiptBranchId;
    this.obligationBranchId = obligationBranchId;
  }
}

export class ConflictingAllocationReplayError extends AccountingDomainError {
  public readonly idempotencyKey: string;

  constructor(idempotencyKey: string, reason: string) {
    super(
      `Idempotent allocation replay rejected for key '${idempotencyKey}': Parameters conflict with prior allocation. ${reason}`,
      'CONFLICTING_ALLOCATION_REPLAY'
    );
    this.idempotencyKey = idempotencyKey;
  }
}

/**
 * Increment 4 — Cashbox Operations & Daily Reconciliation Errors
 */

export class CashboxNotFoundError extends AccountingDomainError {
  public readonly cashboxId: string;

  constructor(cashboxId: string, details?: string) {
    super(
      `Cashbox '${cashboxId}' not found.${details ? ' ' + details : ''}`,
      'CASHBOX_NOT_FOUND'
    );
    this.cashboxId = cashboxId;
  }
}

export class InsufficientCashboxBalanceError extends AccountingDomainError {
  public readonly cashboxId: string;
  public readonly requested: string;
  public readonly available: string;

  constructor(cashboxId: string, requested: string, available: string) {
    super(
      `Insufficient Cashbox Balance: Cashbox '${cashboxId}' has available balance ${available}, but operation requested ${requested}. Cashbox cannot drop below zero.`,
      'INSUFFICIENT_CASHBOX_BALANCE'
    );
    this.cashboxId = cashboxId;
    this.requested = requested;
    this.available = available;
  }
}

export class DuplicateCashboxTransactionError extends AccountingDomainError {
  public readonly referenceId: string;

  constructor(referenceId: string, reason?: string) {
    super(
      `Duplicate Cashbox Movement Rejected: Transaction reference '${referenceId}' has already been processed in cashbox.${reason ? ' ' + reason : ''}`,
      'DUPLICATE_CASHBOX_TRANSACTION'
    );
    this.referenceId = referenceId;
  }
}

export class SameCashboxTransferError extends AccountingDomainError {
  public readonly cashboxId: string;

  constructor(cashboxId: string) {
    super(
      `Invalid Cashbox Transfer: Source and destination cashboxes cannot be identical ('${cashboxId}').`,
      'SAME_CASHBOX_TRANSFER'
    );
    this.cashboxId = cashboxId;
  }
}

export class CashboxTransferImbalanceError extends AccountingDomainError {
  public readonly sourceAmount: string;
  public readonly destinationAmount: string;

  constructor(sourceAmount: string, destinationAmount: string) {
    super(
      `Cashbox Transfer Imbalance: Source movement amount (${sourceAmount}) does not equal destination movement amount (${destinationAmount}).`,
      'CASHBOX_TRANSFER_IMBALANCE'
    );
    this.sourceAmount = sourceAmount;
    this.destinationAmount = destinationAmount;
  }
}

export class DuplicateReconciliationError extends AccountingDomainError {
  public readonly cashboxId: string;
  public readonly businessDate: string;

  constructor(cashboxId: string, businessDate: string) {
    super(
      `Duplicate Daily Reconciliation: Cashbox '${cashboxId}' has already been reconciled for business date '${businessDate}'. Daily reconciliation is immutable and cannot be re-executed.`,
      'DUPLICATE_RECONCILIATION'
    );
    this.cashboxId = cashboxId;
    this.businessDate = businessDate;
  }
}

export class InvalidReconciliationBalanceError extends AccountingDomainError {
  constructor(message: string) {
    super(message, 'INVALID_RECONCILIATION_BALANCE');
  }
}





