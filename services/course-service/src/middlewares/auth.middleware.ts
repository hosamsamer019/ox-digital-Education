import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

export interface AuthRequest extends Request {
  user?: {
    userId: string;
    role: string;
    email: string;
    isGuest?: boolean;
    guestAssessmentId?: string;
    isExternalStudent?: boolean;
    assessmentId?: string;
    externalSessionId?: string;
  };
}

export const verifyToken = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  const token = (authHeader && authHeader.split(' ')[1]) || (req.query.token as string);

  if (!token) {
    return res.status(401).json({ message: 'Authentication token required' });
  }

  try {
    if (!process.env.JWT_SECRET) throw new Error('JWT_SECRET is not configured');
    const decoded = jwt.verify(token, process.env.JWT_SECRET) as any;
    req.user = decoded;

    // Reject video tickets on normal API endpoints
    if (decoded.purpose === 'video-stream') {
      const isStreamingEndpoint =
        req.originalUrl.includes('/stream') ||
        req.path.includes('/stream') ||
        req.originalUrl.includes('/hls') ||
        req.path.includes('/hls');
      const requestedLessonId = req.params?.id;
      if (!isStreamingEndpoint || (requestedLessonId && decoded.lessonId !== requestedLessonId)) {
        return res.status(403).json({ message: 'Forbidden: Video stream ticket cannot be used for standard API requests.' });
      }
    }

    // Enforce guest access scope
    if (decoded.isGuest && decoded.guestAssessmentId) {
      const isAssessmentsEndpoint = req.baseUrl === '/api/assessments' || req.originalUrl.startsWith('/api/assessments');
      const isExamsEndpoint = req.baseUrl === '/api/exams' || req.originalUrl.startsWith('/api/exams');
      const targetId = decoded.guestAssessmentId;
      const isMatchingAssessment = targetId && (req.originalUrl.includes(targetId) || req.params?.id === targetId || req.params?.assessmentId === targetId);
      
      if ((!isAssessmentsEndpoint && !isExamsEndpoint) || !isMatchingAssessment) {
        return res.status(403).json({ message: 'Forbidden: Guest accounts have strictly scoped exam access.' });
      }
    }

    // Enforce external student access scope
    if (decoded.isExternalStudent) {
      const isAssessmentsEndpoint = req.baseUrl === '/api/assessments' || req.originalUrl.startsWith('/api/assessments');
      const isExamsEndpoint = req.baseUrl === '/api/exams' || req.originalUrl.startsWith('/api/exams');
      const targetId = decoded.assessmentId || decoded.guestAssessmentId;
      const isMatchingAssessment = targetId && (req.originalUrl.includes(targetId) || req.params?.id === targetId || req.params?.assessmentId === targetId);
      
      if ((!isAssessmentsEndpoint && !isExamsEndpoint) || !isMatchingAssessment) {
        return res.status(403).json({ message: 'Forbidden: External student accounts have strictly scoped exam access.' });
      }
    }

    // Phase 5.2.3: Authoritative Database Account State Verification for standard registered users (Fail-Closed)
    if (!decoded.isGuest && !decoded.isExternalStudent && decoded.purpose !== 'video-stream') {
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

      if (dbUser.mustChangePassword) {
        return res.status(403).json({
          message: 'Forbidden: Temporary password must be replaced before accessing application resources.',
          code: 'PASSWORD_CHANGE_REQUIRED'
        });
      }

      // Phase 5.5: Monthly Fee Financial Access Restriction Enforcement
      if (dbUser.role === 'CENTER_STUDENT' && dbUser.financialAccessStatus === 'RESTRICTED') {
        return res.status(403).json({
          message: 'تم تعليق الوصول التعليمي بسبب تأخر الرسوم الشهرية. يرجى مراجعة الخزينة لسداد الرسوم المستحقة واستعادة الخدمة فوراً.',
          code: 'FINANCIAL_RESTRICTED',
          financialAccessStatus: 'RESTRICTED',
          requiresPayment: true
        });
      }
    }

    next();
  } catch (error) {
    return res.status(401).json({ message: 'Invalid or expired token' });
  }
};

export const checkRole = (roles: string[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    const userRole = (req.user?.role || '').toLowerCase();
    const allowedRoles = roles.map(r => r.toLowerCase());
    
    if (!req.user || !userRole || !allowedRoles.includes(userRole)) {
      return res.status(403).json({ message: 'Permission denied. Insufficient role.' });
    }
    next();
  };
};
