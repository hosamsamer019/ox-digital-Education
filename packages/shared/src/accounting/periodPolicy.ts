/**
 * OX-DIGITAL Education — Financial Core Engine
 * Module D — Accounting Period Policy Interface
 * Governed by OD-710 (Unresolved Product Owner Decision)
 */

export interface PeriodValidationResult {
  isOpen: boolean;
  periodId?: string;
  reason?: string;
}

/**
 * Interface for accounting period validation.
 * 
 * NOTE: Production integration of period close/reopen is pending formal Product Owner determination
 * on decision OD-710. The accounting engine enforces this interface to prevent hardcoding an unapproved policy.
 */
export interface IAccountingPeriodPolicy {
  isDateOpenForPosting(institutionId: string, accountingDate: Date): PeriodValidationResult;
}

/**
 * Permissive Period Policy for Phase 1 isolated testing.
 * Flags that production integration is deferred pending OD-710.
 */
export class PermissivePeriodPolicy implements IAccountingPeriodPolicy {
  public isDateOpenForPosting(institutionId: string, accountingDate: Date): PeriodValidationResult {
    return {
      isOpen: true,
      periodId: `PERIOD-${accountingDate.getFullYear()}-${accountingDate.getMonth() + 1}`,
      reason: 'PERMISSIVE_PHASE_1_TEST_POLICY (OD-710 Decision Pending)'
    };
  }
}

/**
 * Strict Period Policy that allows defining explicit closed periods for testing invariants.
 */
export class ExplicitPeriodPolicy implements IAccountingPeriodPolicy {
  private readonly closedPeriods: Set<string> = new Set();

  public closePeriod(institutionId: string, year: number, month: number): void {
    this.closedPeriods.add(`${institutionId}:${year}-${month}`);
  }

  public isDateOpenForPosting(institutionId: string, accountingDate: Date): PeriodValidationResult {
    const key = `${institutionId}:${accountingDate.getFullYear()}-${accountingDate.getMonth() + 1}`;
    if (this.closedPeriods.has(key)) {
      return {
        isOpen: false,
        periodId: key,
        reason: `Accounting period ${key} is CLOSED for institution '${institutionId}'. Postings are barred.`
      };
    }
    return {
      isOpen: true,
      periodId: key
    };
  }
}

