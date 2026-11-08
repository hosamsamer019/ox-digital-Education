/**
 * OX-DIGITAL Education — Financial Core Engine
 * Phase 2.0B — Physical Education Center Accounting Integration
 * Approved Roles Matrix & SaaS Super-Admin Tenancy Guards
 */

import { InvalidRoleAssignmentError } from '../errors.js';

export type CenterRole = 'PRIMARY_MANAGER' | 'ACCOUNTANT' | 'CASHIER' | 'TEACHER';

export const APPROVED_ROLES: ReadonlySet<string> = new Set<CenterRole>([
  'PRIMARY_MANAGER',
  'ACCOUNTANT',
  'CASHIER',
  'TEACHER'
]);

export const FORBIDDEN_ROLES: ReadonlySet<string> = new Set<string>([
  'BRANCH_MANAGER',
  'SUPER_ADMIN',
  'PLATFORM_ADMIN',
  'HEAD_OF_BRANCH'
]);

export const SAAS_PLATFORM_SUPER_ADMIN_EMAIL = 'admin@edu.com';

/**
 * Validates that an operational accounting role is strictly within the four approved roles.
 * Rejects 'BRANCH_MANAGER' and any unapproved role (OD-701, OD-718).
 */
export function assertApprovedRole(role: string): CenterRole {
  const normalized = role.trim().toUpperCase();

  if (normalized === 'BRANCH_MANAGER') {
    throw new InvalidRoleAssignmentError(
      role,
      "The 'Branch Manager' role is explicitly forbidden. Primary Manager exercises multi-branch institutional authority (OD-701)."
    );
  }

  if (!APPROVED_ROLES.has(normalized as CenterRole)) {
    throw new InvalidRoleAssignmentError(
      role,
      `Only the four approved institutional roles may participate in financial operations: Primary Manager, Accountant, Cashier, and Teacher.`
    );
  }

  return normalized as CenterRole;
}

/**
 * Validates that SaaS Platform Super-Admin (admin@edu.com) is NOT assigned
 * to institutional tenancy, agreements, cashiering, or teacher roles (OD-718).
 */
export function assertNotSaaSSuperAdmin(emailOrUserId: string, operation: string): void {
  if (emailOrUserId.toLowerCase().trim() === SAAS_PLATFORM_SUPER_ADMIN_EMAIL) {
    throw new InvalidRoleAssignmentError(
      'SAAS_SUPER_ADMIN',
      `SaaS Platform Super-Admin ('${SAAS_PLATFORM_SUPER_ADMIN_EMAIL}') is isolated outside institutional tenancy and cannot be assigned to '${operation}' (OD-718).`
    );
  }
}

