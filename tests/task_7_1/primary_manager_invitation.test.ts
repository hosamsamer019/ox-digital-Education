import crypto from 'crypto';
import {
  generateInvitationToken,
  hashInvitationToken,
  PrimaryManagerInvitationService,
  InvitationRecord,
  InvitationDeliveryService
} from '../../packages/shared/src/index.js';

let passed = 0;
let failed = 0;

function assert(condition: boolean, testName: string, errorMsg?: string) {
  if (condition) {
    console.log(`[PASS] [UNIT/MOCKED] ${testName}`);
    passed++;
  } else {
    console.error(`[FAIL] [UNIT/MOCKED] ${testName} -> ${errorMsg || 'Condition failed'}`);
    failed++;
  }
}

async function runPrimaryManagerTests() {
  console.log('===================================================================');
  console.log('OX-DIGITAL Task 7.1 — Primary Manager Option 3B & Delivery Tests');
  console.log('===================================================================\n');

  // Suite 1: Token Generation & Entropy
  console.log('--- Suite 1: Cryptographic Token Generation (Option 3B) ---');
  const tokenPair1 = generateInvitationToken();
  const tokenPair2 = generateInvitationToken();

  assert(typeof tokenPair1.rawToken === 'string' && tokenPair1.rawToken.length === 64, 'Raw token has 64 hex chars (32 bytes entropy)');
  assert(typeof tokenPair1.tokenHash === 'string' && tokenPair1.tokenHash.length === 64, 'Token hash is valid 64-char SHA-256');
  assert(tokenPair1.rawToken !== tokenPair2.rawToken, 'Subsequent tokens are distinct (cryptographically unguessable)');

  // Verify hash computation matches crypto.createHash
  const expectedHash = crypto.createHash('sha256').update(tokenPair1.rawToken).digest('hex');
  assert(tokenPair1.tokenHash === expectedHash, 'tokenHash accurately matches SHA-256 digest of raw token');
  assert(hashInvitationToken(tokenPair1.rawToken) === expectedHash, 'hashInvitationToken returns correct SHA-256 hash');

  // Suite 2: Invitation Service Factory
  console.log('\n--- Suite 2: Invitation Creation & Expiry Calculation ---');
  const createdInv = PrimaryManagerInvitationService.createInvitation({
    institutionId: 'inst-test-123',
    email: 'Manager@institution.edu',
    expiresInHours: 48
  });

  assert(createdInv.institutionId === 'inst-test-123', 'Institution ID correctly set');
  assert(createdInv.email === 'manager@institution.edu', 'Email normalized to lowercase');
  assert(typeof createdInv.rawToken === 'string' && createdInv.rawToken.length === 64, 'Raw token generated');
  assert(createdInv.tokenHash === hashInvitationToken(createdInv.rawToken), 'Token hash matches raw token');
  const now = Date.now();
  const diffHours = (createdInv.expiresAt.getTime() - now) / (1000 * 60 * 60);
  assert(diffHours > 47.9 && diffHours <= 48.1, 'Expiry accurately calculated to 48 hours');

  // Suite 3: Super-Admin Separation (OD-718)
  console.log('\n--- Suite 3: SaaS Platform Super-Admin Protection ---');
  let superAdminRejected = false;
  try {
    PrimaryManagerInvitationService.createInvitation({
      institutionId: 'inst-test-123',
      email: 'admin@edu.com'
    });
  } catch (e: any) {
    if (e.status === 400 && e.message.includes('Platform Super-Admin')) {
      superAdminRejected = true;
    }
  }
  assert(superAdminRejected === true, 'admin@edu.com cannot be invited or bound as Primary Manager');

  // Suite 4: OD-701 1:1 Invariant Guard
  console.log('\n--- Suite 4: OD-701 Unique Primary Manager Invariant ---');
  let existingManagerRejected = false;
  try {
    PrimaryManagerInvitationService.assertNoExistingPrimaryManager({ primaryManagerId: 'existing-user-uuid-123' });
  } catch (e: any) {
    if (e.status === 409 && e.message.includes('already has an active Primary Manager')) {
      existingManagerRejected = true;
    }
  }
  assert(existingManagerRejected === true, 'Institution with existing primaryManagerId rejects new assignment (409 Conflict)');

  let unassignedAllowed = false;
  try {
    PrimaryManagerInvitationService.assertNoExistingPrimaryManager({ primaryManagerId: null });
    unassignedAllowed = true;
  } catch (e) {
    unassignedAllowed = false;
  }
  assert(unassignedAllowed === true, 'Institution with null primaryManagerId permits assignment');

  // Suite 5: Invitation Verification Logic & Replay Prevention
  console.log('\n--- Suite 5: Invitation Verification & Replay Defense ---');
  const pendingRecord: InvitationRecord = {
    id: createdInv.invitationId,
    institutionId: createdInv.institutionId,
    email: createdInv.email,
    tokenHash: createdInv.tokenHash,
    status: 'PENDING',
    expiresAt: createdInv.expiresAt
  };

  const validResult = PrimaryManagerInvitationService.verifyInvitationForAcceptance(pendingRecord);
  assert(validResult.isValid === true, 'Pending unexpired invitation verifies as valid');

  // Accepted invitation (Replay attack defense)
  const acceptedRecord: InvitationRecord = {
    ...pendingRecord,
    status: 'ACCEPTED',
    acceptedAt: new Date(),
    acceptedByUserId: 'user-manager-1'
  };
  const replayResult = PrimaryManagerInvitationService.verifyInvitationForAcceptance(acceptedRecord);
  assert(replayResult.isValid === false, 'Already accepted invitation is rejected');
  assert(replayResult.reason?.includes('already been accepted') === true, 'Reason states already accepted');

  // Revoked invitation
  const revokedRecord: InvitationRecord = {
    ...pendingRecord,
    status: 'REVOKED'
  };
  const revokedResult = PrimaryManagerInvitationService.verifyInvitationForAcceptance(revokedRecord);
  assert(revokedResult.isValid === false, 'Revoked invitation is rejected');

  // Expired invitation
  const expiredRecord: InvitationRecord = {
    ...pendingRecord,
    status: 'PENDING',
    expiresAt: new Date(Date.now() - 3600 * 1000)
  };
  const expiredResult = PrimaryManagerInvitationService.verifyInvitationForAcceptance(expiredRecord);
  assert(expiredResult.isValid === false, 'Expired invitation is rejected');
  assert(expiredResult.reason?.includes('expired') === true, 'Reason states invitation expired');

  // Suite 6: Remediation F — Email Delivery Abstraction & Fail-Closed Behavior
  console.log('\n--- Suite 6: Remediation F — Invitation Delivery Fail-Closed ---');
  delete process.env.EMAIL_DELIVERY_ENABLED;
  delete process.env.SMTP_HOST;
  delete process.env.SENDGRID_API_KEY;

  assert(InvitationDeliveryService.isTransportConfigured() === false, 'Transport correctly detected as unconfigured');

  let deliveryBlocked = false;
  try {
    await InvitationDeliveryService.dispatchInvitation('director@testschool.edu', createdInv.rawToken, 'Test School');
  } catch (e: any) {
    if (e.status === 503 && e.message.includes('Email delivery provider is unconfigured')) {
      deliveryBlocked = true;
    }
  }
  assert(deliveryBlocked === true, 'Dispatch fails closed with 503 when transport is unconfigured');

  console.log('\n===================================================================');
  console.log(`RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('===================================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runPrimaryManagerTests().catch(err => {
  console.error('Test execution error:', err);
  process.exit(1);
});
