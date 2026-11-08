import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

export interface AuthRequest extends Request {
  user?: {
    userId: string;
    role: string;
    email: string;
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
    
    if (decoded.isGuest) {
      return res.status(403).json({ message: 'Forbidden: Guest accounts have strictly scoped exam access.' });
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
      isPrimaryManager: dbUser.isPrimaryManager,
      mustChangePassword: dbUser.mustChangePassword
    };

    // Fail-Closed First-Login Enforcement
    if (dbUser.mustChangePassword) {
      return res.status(403).json({
        message: 'Forbidden: Temporary password must be replaced before accessing application resources.',
        code: 'PASSWORD_CHANGE_REQUIRED'
      });
    }

    // Phase 5.5: Monthly Fee Financial Access Restriction Enforcement
    if (dbUser.role === 'CENTER_STUDENT' && dbUser.financialAccessStatus === 'RESTRICTED') {
      return res.status(403).json({
        message: 'تم تعليق الوصول لخدمات الذكاء الاصطناعي بسبب تأخر الرسوم الشهرية. يرجى مراجعة الخزينة للسداد واستعادة الخدمة فوراً.',
        code: 'FINANCIAL_RESTRICTED',
        financialAccessStatus: 'RESTRICTED',
        requiresPayment: true
      });
    }

    next();
  } catch (error) {
    return res.status(401).json({ message: 'Invalid or expired token' });
  }
};
