import { db } from '../../../../packages/database/src/index.js';
import { AuthRequest, isAuthorizedPrimaryManager } from '../middlewares/auth.middleware.js';

export interface ResolvedReportScope {
  ok: boolean;
  status?: number;
  message?: string;
  institutionId?: string;
  branchId?: string;
  isPrimaryManager?: boolean;
}

export interface ResolvedDateRange {
  ok: boolean;
  status?: number;
  message?: string;
  startDate?: Date;
  endDate?: Date;
  startDateStr?: string;
  endDateStr?: string;
}

/**
 * Resolves and enforces strict server-side branch and institution isolation
 * for Accountant and Primary Manager financial report queries.
 */
export async function resolveAccountingReportScope(req: AuthRequest): Promise<ResolvedReportScope> {
  const institutionId = req.user?.institutionId || (req as any).tenantContext?.institutionId;
  if (!institutionId) {
    return {
      ok: false,
      status: 401,
      message: 'Unauthorized: Missing tenant identity'
    };
  }

  const userRole = String(req.user?.role || '').toUpperCase();
  const requestedBranchId = req.query.branchId ? String(req.query.branchId).trim() : undefined;

  if (userRole === 'ACCOUNTANT') {
    const assignedBranchId = req.user?.branchId;
    if (!assignedBranchId) {
      return {
        ok: false,
        status: 403,
        message: 'Forbidden: Accountant is not assigned to an active branch.'
      };
    }

    // Never trust a client-supplied branchId that attempts to expand or switch branch scope
    if (requestedBranchId && requestedBranchId !== assignedBranchId) {
      return {
        ok: false,
        status: 403,
        message: 'Forbidden: Branch accountants are strictly restricted to their assigned branch.'
      };
    }

    return {
      ok: true,
      institutionId: String(institutionId),
      branchId: assignedBranchId,
      isPrimaryManager: false
    };
  }

  if (isAuthorizedPrimaryManager(req.user)) {
    if (requestedBranchId && requestedBranchId !== 'ALL' && requestedBranchId !== 'INST-CONSOLIDATED') {
      const branch = await db.branch.findUnique({
        where: { id: requestedBranchId },
        select: { id: true, institutionId: true }
      });

      if (!branch || branch.institutionId !== String(institutionId)) {
        return {
          ok: false,
          status: 403,
          message: 'Forbidden: Specified branch does not exist or does not belong to your institution.'
        };
      }

      return {
        ok: true,
        institutionId: String(institutionId),
        branchId: branch.id,
        isPrimaryManager: true
      };
    }

    return {
      ok: true,
      institutionId: String(institutionId),
      branchId: undefined,
      isPrimaryManager: true
    };
  }

  return {
    ok: false,
    status: 403,
    message: 'Forbidden: Insufficient permissions to access accounting reports.'
  };
}

/**
 * Validates and normalizes startDate / endDate (or from / to) query parameters.
 */
export function resolveDateRangeFilter(req: AuthRequest): ResolvedDateRange {
  const rawStart = (req.query.startDate ?? req.query.from) as string | undefined;
  const rawEnd = (req.query.endDate ?? req.query.to) as string | undefined;

  let startDate: Date | undefined;
  let endDate: Date | undefined;
  let startDateStr: string | undefined;
  let endDateStr: string | undefined;

  if (rawStart !== undefined && String(rawStart).trim() !== '') {
    const s = String(rawStart).trim();
    const parsed = /^\d{4}-\d{2}-\d{2}$/.test(s)
      ? new Date(`${s}T00:00:00.000Z`)
      : new Date(s);
    if (isNaN(parsed.getTime())) {
      return {
        ok: false,
        status: 400,
        message: 'Invalid startDate format. Expected YYYY-MM-DD or ISO-8601 date.'
      };
    }
    startDate = parsed;
    startDateStr = parsed.toISOString().slice(0, 10);
  }

  if (rawEnd !== undefined && String(rawEnd).trim() !== '') {
    const e = String(rawEnd).trim();
    const parsed = /^\d{4}-\d{2}-\d{2}$/.test(e)
      ? new Date(`${e}T23:59:59.999Z`)
      : new Date(e);
    if (isNaN(parsed.getTime())) {
      return {
        ok: false,
        status: 400,
        message: 'Invalid endDate format. Expected YYYY-MM-DD or ISO-8601 date.'
      };
    }
    endDate = parsed;
    endDateStr = parsed.toISOString().slice(0, 10);
  }

  if (startDate && endDate && startDate.getTime() > endDate.getTime()) {
    return {
      ok: false,
      status: 400,
      message: 'Invalid date range: startDate cannot be after endDate.'
    };
  }

  return {
    ok: true,
    startDate,
    endDate,
    startDateStr,
    endDateStr
  };
}
