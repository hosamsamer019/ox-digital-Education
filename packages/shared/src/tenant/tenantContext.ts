import { Request, Response, NextFunction } from 'express';
import { HttpError } from '../errorHandler';

export interface TenantContext {
  institutionId: string | null;
  branchId: string | null;
  userId: string;
  role: string;
  isPlatformSuperAdmin: boolean;
  isPrimaryManager: boolean;
}

declare global {
  namespace Express {
    interface Request {
      tenantContext?: TenantContext;
    }
  }
}

/**
 * Legacy helper retained only for API compatibility.
 * Email-based Super-Admin privilege elevation has been removed (fail-closed).
 */
export function isPlatformSuperAdminUser(_user?: { email?: string; role?: string }): boolean {
  return false;
}

export interface TenantContextOptions {
  requireTenant?: boolean;
}

/**
 * Tenant Context Middleware handler
 */
function handleTenantContext(
  req: Request,
  res: Response,
  next: NextFunction,
  options: TenantContextOptions = {}
) {
  const user = (req as any).user;

  if (!user) {
    return res.status(401).json({ message: 'Unauthorized: Authentication required for tenant context' });
  }

  // Mandatory First-Login Password Change Enforcement (Phase 5.2)
  if (user?.mustChangePassword) {
    return res.status(403).json({
      message: 'Forbidden: Temporary password must be replaced before accessing application resources.',
      code: 'PASSWORD_CHANGE_REQUIRED'
    });
  }

  const isPrimaryManager = Boolean(user.isPrimaryManager || user.role === 'PRIMARY_MANAGER');

  // Resolve tenant strictly from authenticated user identity
  const institutionId = user.institutionId || null;
  const branchId = user.branchId || null;

  const requestedInstitutionId = (req.headers['x-institution-id'] || req.headers['x-tenant-id']) as string | undefined;

  if (requestedInstitutionId && requestedInstitutionId !== institutionId) {
    // Rejection of Client-Supplied Cross-Tenant Spoofing (SEC-01 / SEC-02)
    return res.status(403).json({
      message: 'Forbidden: Cross-tenant access attempt detected. Client header does not match authenticated institution.',
      code: 'CROSS_TENANT_IDOR_BLOCKED'
    });
  }

  if (options.requireTenant && !institutionId) {
    return res.status(403).json({
      message: 'Forbidden: User is not assigned to an active institution',
      code: 'TENANT_CONTEXT_MISSING'
    });
  }

  req.tenantContext = {
    institutionId,
    branchId,
    userId: user.userId || user.id,
    role: user.role,
    isPlatformSuperAdmin: false,
    isPrimaryManager
  };

  next();
}

/**
 * Tenant Context Middleware
 * Enforces server-side tenant isolation. Resolves institution and branch context
 * from the authenticated token/session. NEVER trusts client-supplied headers without validation.
 * Supports both `app.use(tenantContextMiddleware)` and `app.use(tenantContextMiddleware({ requireTenant: true }))`.
 */
export function tenantContextMiddleware(
  reqOrOptions?: Request | TenantContextOptions,
  res?: Response,
  next?: NextFunction
): any {
  if (reqOrOptions && (reqOrOptions as any).headers && res && next) {
    // Called directly as express middleware: tenantContextMiddleware(req, res, next)
    return handleTenantContext(reqOrOptions as Request, res, next, {});
  }

  // Called as a factory: tenantContextMiddleware(options)(req, res, next)
  const options = (reqOrOptions as TenantContextOptions) || {};
  return (req: Request, response: Response, nextFn: NextFunction) => {
    return handleTenantContext(req, response, nextFn, options);
  };
}

/**
 * Assert Tenant Access Guard
 * Verifies that a target resource belongs to the authenticated user's institution.
 */
export function assertTenantAccess(
  context: TenantContext | undefined,
  resourceInstitutionId: string | null | undefined
): void {
  if (!context) {
    throw new HttpError(401, 'Unauthorized: Missing tenant context');
  }

  if (!context.institutionId) {
    throw new HttpError(403, 'Forbidden: Missing authenticated institution context');
  }

  if (!resourceInstitutionId) {
    throw new HttpError(403, 'Forbidden: Resource has no tenant attribution (unresolved / quarantined)');
  }

  if (context.institutionId !== resourceInstitutionId) {
    throw new HttpError(403, 'Forbidden: Cross-tenant resource access denied');
  }
}

/**
 * Assert Branch Access Guard
 * Verifies that a branch-specific resource belongs to the permitted branch context.
 */
export function assertBranchAccess(
  context: TenantContext | undefined,
  resourceBranchId: string | null | undefined,
  allowInstitutionWide: boolean = true
): void {
  if (!context) {
    throw new HttpError(401, 'Unauthorized: Missing tenant context');
  }

  if (context.isPrimaryManager) {
    // Primary managers have institution-wide branch oversight within their authenticated institution
    return;
  }

  // If resource is institution-wide (branchId is null) and allowed
  if (!resourceBranchId && allowInstitutionWide) {
    return;
  }

  if (context.branchId && resourceBranchId && context.branchId !== resourceBranchId) {
    throw new HttpError(403, 'Forbidden: Cross-branch access denied');
  }
}
