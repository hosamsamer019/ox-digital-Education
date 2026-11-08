/**
 * OX-DIGITAL Education — Financial Core Engine
 * Module B — Account Domain & Chart of Accounts
 * Pure Domain Model for Multi-Tenant Accounting Hierarchy
 */

import {
  AccountNotFoundError,
  CircularHierarchyError,
  DuplicateAccountCodeError,
  InactiveAccountError,
  NonPostableAccountError,
  AccountingDomainError
} from './errors.js';
import { CurrencyCode } from './money.js';
import { deepFreeze } from './audit.js';

export type AccountType = 'ASSET' | 'LIABILITY' | 'EQUITY' | 'REVENUE' | 'EXPENSE';
export type NormalBalanceDirection = 'DEBIT' | 'CREDIT';

export interface AccountProps {
  id: string;
  code: string;
  name: string;
  type: AccountType;
  institutionId: string;
  parentId?: string | null;
  isActive?: boolean;
  isPostable?: boolean;
  currency?: CurrencyCode;
  description?: string;
  metadata?: Record<string, any>;
}

/**
 * Normal balance direction rules:
 * - ASSET: DEBIT
 * - EXPENSE: DEBIT
 * - LIABILITY: CREDIT
 * - EQUITY: CREDIT
 * - REVENUE: CREDIT
 */
export function getNormalBalance(type: AccountType): NormalBalanceDirection {
  switch (type) {
    case 'ASSET':
    case 'EXPENSE':
      return 'DEBIT';
    case 'LIABILITY':
    case 'EQUITY':
    case 'REVENUE':
      return 'CREDIT';
    default:
      throw new AccountingDomainError(`Unknown account type: ${type}`);
  }
}

export class Account {
  public readonly id: string;
  public readonly code: string;
  public readonly name: string;
  public readonly type: AccountType;
  public readonly institutionId: string;
  public readonly parentId: string | null;
  public readonly isActive: boolean;
  public readonly isPostable: boolean;
  public readonly currency: CurrencyCode;
  public readonly description?: string;
  public readonly metadata?: Record<string, any>;
  public readonly normalBalance: NormalBalanceDirection;

  constructor(props: AccountProps) {
    if (!props.code || props.code.trim().length === 0) {
      throw new AccountingDomainError('Account code cannot be empty.');
    }
    if (!props.name || props.name.trim().length === 0) {
      throw new AccountingDomainError('Account name cannot be empty.');
    }
    if (!props.institutionId) {
      throw new AccountingDomainError('Account must belong to a specific institution (OD-701).');
    }

    this.id = props.id;
    this.code = props.code.trim();
    this.name = props.name.trim();
    this.type = props.type;
    this.institutionId = props.institutionId;
    this.parentId = props.parentId || null;
    this.isActive = props.isActive ?? true;
    this.isPostable = props.isPostable ?? true;
    this.currency = props.currency ?? 'EGP';
    this.description = props.description;
    this.metadata = props.metadata ? deepFreeze({ ...props.metadata }) : undefined;
    this.normalBalance = getNormalBalance(props.type);

    Object.freeze(this);
  }

  public assertEligibleForPosting(): void {
    if (!this.isActive) {
      throw new InactiveAccountError(this.code);
    }
    if (!this.isPostable) {
      throw new NonPostableAccountError(this.code);
    }
  }
}

/**
 * In-memory Chart of Accounts scoped to a single institution.
 * Enforces hierarchy, uniqueness, and structural invariants.
 */
export class ChartOfAccounts {
  public readonly institutionId: string;
  private readonly accountsById: Map<string, Account> = new Map();
  private readonly accountsByCode: Map<string, Account> = new Map();

  constructor(institutionId: string, initialAccounts: Account[] = []) {
    if (!institutionId) {
      throw new AccountingDomainError('ChartOfAccounts must be initialized with an institutionId.');
    }
    this.institutionId = institutionId;
    for (const acc of initialAccounts) {
      this.addAccount(acc);
    }
  }

  public addAccount(account: Account): void {
    if (account.institutionId !== this.institutionId) {
      throw new AccountingDomainError(
        `Cannot add account '${account.code}' of institution '${account.institutionId}' to chart of '${this.institutionId}'.`
      );
    }

    if (this.accountsByCode.has(account.code)) {
      throw new DuplicateAccountCodeError(account.code, this.institutionId);
    }

    if (this.accountsById.has(account.id)) {
      throw new AccountingDomainError(`Duplicate account ID '${account.id}' in chart of accounts.`);
    }

    // Validate parent relationship if parent is specified
    if (account.parentId) {
      const parent = this.accountsById.get(account.parentId);
      if (parent) {
        if (parent.type !== account.type) {
          throw new AccountingDomainError(
            `Account type mismatch: Child '${account.code}' (${account.type}) cannot have parent '${parent.code}' (${parent.type}). Child must match parent type.`
          );
        }
      }
    }

    this.accountsById.set(account.id, account);
    this.accountsByCode.set(account.code, account);

    // Validate full hierarchy after addition
    this.validateHierarchy();
  }

  public getById(id: string): Account | undefined {
    return this.accountsById.get(id);
  }

  public getByCode(code: string): Account | undefined {
    return this.accountsByCode.get(code);
  }

  public getOrThrow(idOrCode: string): Account {
    const acc = this.accountsById.get(idOrCode) || this.accountsByCode.get(idOrCode);
    if (!acc) {
      throw new AccountNotFoundError(idOrCode, this.institutionId);
    }
    return acc;
  }

  public getAll(): Account[] {
    return Array.from(this.accountsById.values());
  }

  public validateHierarchy(): void {
    for (const [id, account] of this.accountsById.entries()) {
      const visited = new Set<string>();
      let current: Account | undefined = account;
      const path: string[] = [account.code];

      while (current && current.parentId) {
        if (visited.has(current.id)) {
          throw new CircularHierarchyError(account.code, path);
        }
        visited.add(current.id);

        const parent = this.accountsById.get(current.parentId);
        if (!parent) {
          // Parent not yet in chart or external — allowed during incremental build, but parent must exist if referenced
          break;
        }

        path.push(parent.code);
        if (parent.id === account.id) {
          throw new CircularHierarchyError(account.code, path);
        }
        current = parent;
      }
    }
  }
}

