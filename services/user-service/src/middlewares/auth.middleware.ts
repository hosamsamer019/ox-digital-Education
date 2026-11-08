import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

export interface AuthRequest extends Request {
  user?: {
    userId: string;
    role: string;
    email: string;
    institutionId?: string | null;
    branchId?: string | null;
    isPrimaryManager?: boolean;
    mustChangePassword?: boolean;
    financialAccessStatus?: string;
  };
}

export const verifyToken = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ message: 'Authentication token required' });
  }

  try {
    if (!process.env.JWT_SECRET) throw new Error('JWT_SECRET is not configured');
    const decoded = jwt.verify(token, process.env.JWT_SECRET) as any;

    if (decoded.isGuest || decoded.isExternalStudent || decoded.role === 'EXTERNAL_STUDENT') {
      return res.status(403).json({ message: 'Forbidden: External students have strictly scoped exam access.' });
    }

    req.user = decoded;

    // Phase 5.2.3: Authoritative Database Account State Verification (Fail-Closed)
    const userId = decoded.userId || decoded.id;
    if (!userId) {
      return res.status(401).json({
        message: 'Unauthorized: Invalid token payload, missing user ID',
        code: 'UNAUTHORIZED_NO_USER_ID'
      });
    }

    const { verifyAuthoritativeAccountState } = await import('@smartmath/database');
    const authResult = await verifyAuthoritativeAccountState(userId);

    if (!authResult.success) {
      return res.status(authResult.status || 401).json({
        message: authResult.message,
        code: authResult.code
      });
    }

    const dbUser = authResult.user!;
    req.user = {
      ...decoded,
      userId: dbUser.id,
      role: dbUser.role,
      email: dbUser.email,
      institutionId: dbUser.institutionId,
      branchId: dbUser.branchId,
      isPrimaryManager: dbUser.isPrimaryManager === true,
      mustChangePassword: dbUser.mustChangePassword === true,
      financialAccessStatus: dbUser.financialAccessStatus
    };

    // Fail-Closed First-Login Enforcement
    if (dbUser.mustChangePassword) {
      return res.status(403).json({
        message: 'Forbidden: Temporary password must be replaced before accessing application resources.',
        code: 'PASSWORD_CHANGE_REQUIRED'
      });
    }

    next();
  } catch (error) {
    return res.status(401).json({ message: 'Invalid or expired token' });
  }
};

/**
 * Strict centralized Primary Manager guard:
 * Requires authoritative DB user state with role === 'ADMIN' (or 'PRIMARY_MANAGER')
 * AND strict boolean equality isPrimaryManager === true.
 */
export const isAuthorizedPrimaryManager = (user?: AuthRequest['user']): boolean => {
  if (!user) return false;
  const normalizedRole = String(user.role || '').toUpperCase();
  return (normalizedRole === 'ADMIN' || normalizedRole === 'PRIMARY_MANAGER') && user.isPrimaryManager === true;
};

export const requirePrimaryManager = (req: AuthRequest, res: Response, next: NextFunction) => {
  if (!req.user) {
    return res.status(401).json({ message: 'Authentication token required' });
  }
  if (!isAuthorizedPrimaryManager(req.user)) {
    return res.status(403).json({
      message: 'Forbidden: Strictly restricted to the canonical Primary Manager (role=ADMIN, isPrimaryManager=true).'
    });
  }
  next();
};

export const checkRole = (roles: string[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ message: 'Authentication token required' });
    }
    const userRole = String(req.user.role || '').toLowerCase();
    const allowed = roles.map(r => r.toLowerCase());

    let isAllowed = false;
    if (userRole === 'admin' || userRole === 'primary_manager') {
      // Any ADMIN / PRIMARY_MANAGER route check strictly requires isPrimaryManager === true
      if ((allowed.includes('admin') || allowed.includes('primary_manager')) && isAuthorizedPrimaryManager(req.user)) {
        isAllowed = true;
      }
    } else {
      isAllowed = allowed.includes(userRole) ||
        (userRole === 'online_student' && allowed.includes('student')) ||
        (userRole === 'student' && allowed.includes('online_student'));
    }

    if (!isAllowed) {
      return res.status(403).json({ message: 'Insufficient permissions' });
    }
    next();
  };
};

export const requirePasswordChanged = (req: AuthRequest, res: Response, next: NextFunction) => {
  if (req.user?.mustChangePassword) {
    return res.status(403).json({
      message: 'Forbidden: Temporary password must be replaced before accessing application resources.',
      code: 'PASSWORD_CHANGE_REQUIRED'
    });
  }
  next();
};
