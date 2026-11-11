import jwt from 'jsonwebtoken';
import crypto from 'crypto';

interface VideoTicketPayload {
  userId: string;
  lessonId: string;
  purpose: 'video-stream';
  role?: string;
  institutionId?: string | null;
}

export function generateVideoTicket(params: {
  userId: string;
  lessonId: string;
  role?: string;
  institutionId?: string | null;
  expiresInSeconds?: number;
}): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET is not configured');

  const payload: VideoTicketPayload = {
    userId: params.userId,
    lessonId: params.lessonId,
    purpose: 'video-stream',
    ...(params.role && { role: params.role }),
    ...(params.institutionId !== undefined && { institutionId: params.institutionId })
  };

  return jwt.sign(payload, secret, {
    expiresIn: params.expiresInSeconds !== undefined ? params.expiresInSeconds : 14400, // 4 hours viewing session ticket
  });
}

export function verifyVideoTicket(
  ticket: string,
  expectedLessonId: string
): { userId: string; lessonId: string; role?: string; institutionId?: string | null } | null {
  const secret = process.env.JWT_SECRET;
  if (!secret || !ticket) return null;

  try {
    const decoded = jwt.verify(ticket, secret) as any;
    if (decoded.purpose !== 'video-stream') {
      return null;
    }
    if (decoded.lessonId !== expectedLessonId) {
      return null;
    }
    return {
      userId: decoded.userId,
      lessonId: decoded.lessonId,
      role: decoded.role,
      institutionId: decoded.institutionId
    };
  } catch (err) {
    return null;
  }
}
