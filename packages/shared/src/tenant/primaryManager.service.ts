import crypto from 'crypto';
import { HttpError } from '../errorHandler';

export interface CreateInvitationParams {
  institutionId: string;
  email: string;
  expiresInHours?: number;
}

export interface GeneratedInvitation {
  invitationId: string;
  institutionId: string;
  email: string;
  rawToken: string; // Expose strictly for email delivery; never persist in logs or DB
  tokenHash: string;
  expiresAt: Date;
}

export interface InvitationRecord {
  id: string;
  institutionId: string;
  email: string;
  tokenHash: string;
  status: 'PENDING' | 'ACCEPTED' | 'REVOKED' | 'EXPIRED';
  expiresAt: Date;
  acceptedAt?: Date | null;
  acceptedByUserId?: string | null;
}

/**
 * Generates a cryptographically secure token and its SHA-256 hash.
 */
export function generateInvitationToken(): { rawToken: string; tokenHash: string } {
  const rawToken = crypto.randomBytes(32).toString('hex');
  const tokenHash = hashInvitationToken(rawToken);
  return { rawToken, tokenHash };
}

/**
 * Computes the SHA-256 hash of a raw invitation token.
 */
export function hashInvitationToken(rawToken: string): string {
  return crypto.createHash('sha256').update(rawToken).digest('hex');
}

/**
 * Primary Manager Invitation Service (Option 3B — Approved OD-718)
 * Manages the full lifecycle of cryptographically verified Primary Manager invitations.
 */
export class PrimaryManagerInvitationService {
  /**
   * Validates invitation parameters and generates a time-limited invitation.
   */
  static createInvitation(params: CreateInvitationParams): GeneratedInvitation {
    const { institutionId, email, expiresInHours = 72 } = params;

    if (!institutionId) {
      throw new HttpError(400, 'Institution ID is required');
    }

    if (!email || !email.includes('@')) {
      throw new HttpError(400, 'Valid email address is required');
    }

    // Safety constraint: SaaS Platform Super-Admin must not be invited as an institution manager
    if (email.toLowerCase() === 'admin@edu.com') {
      throw new HttpError(400, 'admin@edu.com is the reserved SaaS Platform Super-Admin and cannot be assigned as an institution Primary Manager (OD-718)');
    }

    const { rawToken, tokenHash } = generateInvitationToken();
    const expiresAt = new Date(Date.now() + expiresInHours * 60 * 60 * 1000);

    return {
      invitationId: crypto.randomUUID(),
      institutionId,
      email: email.toLowerCase().trim(),
      rawToken,
      tokenHash,
      expiresAt
    };
  }

  /**
   * Verifies an invitation token before acceptance.
   * Checks expiration, status, and single-use constraint.
   */
  static verifyInvitationForAcceptance(invitation: InvitationRecord): { isValid: boolean; reason?: string } {
    if (!invitation) {
      return { isValid: false, reason: 'Invitation not found' };
    }

    if (invitation.status === 'ACCEPTED') {
      return { isValid: false, reason: 'Invitation has already been accepted (single-use constraint)' };
    }

    if (invitation.status === 'REVOKED') {
      return { isValid: false, reason: 'Invitation has been revoked' };
    }

    if (new Date() > new Date(invitation.expiresAt)) {
      return { isValid: false, reason: 'Invitation has expired' };
    }

    if (invitation.status !== 'PENDING') {
      return { isValid: false, reason: `Invitation status invalid: ${invitation.status}` };
    }

    return { isValid: true };
  }

  /**
   * Evaluates if an institution already possesses an active Primary Manager.
   * Enforces the single Primary Manager invariant (OD-701).
   */
  static assertNoExistingPrimaryManager(institution: { primaryManagerId?: string | null }): void {
    if (institution.primaryManagerId) {
      throw new HttpError(409, 'Conflict: Institution already has an active Primary Manager assigned (OD-701 single-manager invariant)');
    }
  }
}

