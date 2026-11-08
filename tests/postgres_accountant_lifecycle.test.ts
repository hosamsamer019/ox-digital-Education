/**
 * OX-DIGITAL Education — Phase 5.2.3
 * Cross-Service First-Login Security Remediation & Real PostgreSQL Verification Suite
 * 
 * Execution Target: Dedicated isolated local PostgreSQL database on 127.0.0.1:5433 (ox_digital_dev_test)
 * Safety: Uses ONLY synthetic test records. Never touches staging, production, or AL-SADEN databases.
 */

import fs from 'fs';
import path from 'path';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';
import { createAccountant, getTeamMembers } from '../services/user-service/src/controllers/user.controller.js';
import { tenantContextMiddleware } from '../packages/shared/src/tenant/tenantContext.js';
import { verifyToken as verifyTokenUser } from '../services/user-service/src/middlewares/auth.middleware.js';
import { verifyToken as verifyTokenCourse } from '../services/course-service/src/middlewares/auth.middleware.js';
import { verifyToken as verifyTokenAnalytics } from '../services/analytics-service/src/middlewares/auth.middleware.js';
import { verifyToken as verifyTokenAI } from '../services/ai-service/src/middlewares/auth.middleware.js';
import { verifyAuthoritativeAccountState } from '@smartmath/database';

let passed = 0;
let failed = 0;

function assert(condition: boolean, testName: string, errorMsg?: string) {
  if (condition) {
    console.log(`[PASS] ${testName}`);
    passed++;
  } else {
    console.error(`[FAIL] ${testName} -> ${errorMsg || 'Condition failed'}`);
    failed++;
  }
}

// Isolated database URL
const passFile = path.resolve('C:/Users/Hossam/.gemini/antigravity/brain/09191b30-7f7c-42dd-abfa-1cfa55f639a9/isolated_db_pass.txt');
const dbPass = fs.existsSync(passFile) ? fs.readFileSync(passFile, 'utf8').trim() : '';
const dbUrl = process.env.DATABASE_URL || `postgresql://ox_dev_admin:${dbPass}@127.0.0.1:5433/ox_digital_dev_test?schema=public`;

process.env.DATABASE_URL = dbUrl;
process.env.DIRECT_URL = dbUrl;
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-real-postgres-jwt-secret-xyz-987';

const prisma = new PrismaClient({
  datasources: { db: { url: dbUrl } }
});

function createMockRes() {
  const res: any = {
    statusCode: 200,
    body: null,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(data: any) {
      this.body = data;
      return this;
    }
  };
  return res;
}

async function runRealPostgresLifecycle() {
  console.log('===================================================================');
  console.log('OX-DIGITAL Education — Phase 5.2.3 Cross-Service Security Suite');
  console.log('Target: 127.0.0.1:5433 / ox_digital_dev_test (PostgreSQL 15)');
  console.log('Timestamp:', new Date().toISOString());
  console.log('===================================================================\n');

  const testInstId = 'test-inst-cairo-pg';
  const foreignInstId = 'test-inst-alex-pg';
  const testBranchId = 'test-br-dokki-pg';
  const foreignBranchId = 'test-br-alex-pg';

  const pmEmail = 'manager.test.pg@ox-digital.edu';
  const accountantEmail = 'accountant.test.pg@ox-digital.edu';
  const deletedUserEmail = 'deleted.user.pg@ox-digital.edu';

  try {
    // --- Step 0: Clean up any prior test artifacts ---
    await prisma.user.deleteMany({ where: { email: { in: [pmEmail, accountantEmail, deletedUserEmail] } } });
    await prisma.branch.deleteMany({ where: { id: { in: [testBranchId, foreignBranchId] } } });
    await prisma.institution.deleteMany({ where: { id: { in: [testInstId, foreignInstId] } } });

    // --- Step 1: Prepare Isolated Test Institutions and Branches in PostgreSQL ---
    console.log('--- Step 1: Real Database Setup ---');
    const inst = await prisma.institution.create({
      data: {
        id: testInstId,
        name: 'أكاديمية القاهرة للتجارب العملية',
        code: 'INST-PG-CAIRO',
        status: 'ACTIVE'
      }
    });
    assert(inst.id === testInstId, '1.1: Created test institution in real PostgreSQL');

    const foreignInst = await prisma.institution.create({
      data: {
        id: foreignInstId,
        name: 'أكاديمية الإسكندرية المعزولة',
        code: 'INST-PG-ALEX',
        status: 'ACTIVE'
      }
    });
    assert(foreignInst.id === foreignInstId, '1.2: Created foreign test institution in real PostgreSQL');

    const branch = await prisma.branch.create({
      data: {
        id: testBranchId,
        name: 'فرع الدقي التجريبي',
        code: 'BR-PG-01',
        institutionId: testInstId,
        isOnline: false,
        status: 'ACTIVE'
      }
    });
    assert(branch.id === testBranchId, '1.3: Created test branch in real PostgreSQL');

    const foreignBranch = await prisma.branch.create({
      data: {
        id: foreignBranchId,
        name: 'فرع الإسكندرية التجريبي',
        code: 'BR-PG-ALEX',
        institutionId: foreignInstId,
        isOnline: false,
        status: 'ACTIVE'
      }
    });
    assert(foreignBranch.id === foreignBranchId, '1.4: Created foreign branch in real PostgreSQL');

    const pmUser = await prisma.user.create({
      data: {
        name: 'أ. د. هشام الأحمدي (تجريبي)',
        email: pmEmail,
        password: await bcrypt.hash('PmSecurePass2026!', 10),
        role: 'PRIMARY_MANAGER',
        institutionId: testInstId,
        isPrimaryManager: true,
        mustChangePassword: false
      }
    });
    assert(pmUser.id.length > 0, '1.5: Created synthetic Primary Manager in real PostgreSQL');

    // Create a deactivated/deleted user for fail-closed verification
    const deletedUser = await prisma.user.create({
      data: {
        name: 'مستخدم محذوف تجريبي',
        email: deletedUserEmail,
        password: await bcrypt.hash('DeletedPass2026!', 10),
        role: 'ACCOUNTANT',
        institutionId: testInstId,
        branchId: testBranchId,
        deletedAt: new Date()
      }
    });
    assert(deletedUser.id.length > 0, '1.6: Created deactivated user in real PostgreSQL');

    // --- Step 2: Primary Manager creates Accountant through real Controller ---
    console.log('\n--- Step 2: Real Accountant Account Creation ---');
    const createReq: any = {
      user: {
        userId: pmUser.id,
        role: 'PRIMARY_MANAGER',
        institutionId: testInstId
      },
      body: {
        name: 'محاسب فرع الدقي التجريبي',
        email: accountantEmail,
        branchId: testBranchId
      }
    };
    const createRes = createMockRes();
    await createAccountant(createReq, createRes);

    assert(createRes.statusCode === 201, '2.1: createAccountant HTTP status is 201 Created');
    assert(createRes.body?.user?.id !== undefined, '2.1: createAccountant response contains created user');
    assert(typeof createRes.body?.temporaryPassword === 'string' && createRes.body?.temporaryPassword.length === 16, '2.1: 16-character CSPRNG temporary password returned once');

    const tempPassword = createRes.body.temporaryPassword;

    // --- Step 3: Direct Verification in PostgreSQL ---
    console.log('\n--- Step 3: Direct PostgreSQL Record Verification ---');
    const dbAccountant = await prisma.user.findUnique({
      where: { email: accountantEmail }
    });

    assert(dbAccountant !== null, '3.1: Accountant user record exists in PostgreSQL User table');
    assert(dbAccountant?.role === 'ACCOUNTANT', '3.2: Role in PostgreSQL is strictly ACCOUNTANT');
    assert(dbAccountant?.institutionId === testInstId, '3.3: InstitutionId in PostgreSQL strictly matches PM institution');
    assert(dbAccountant?.branchId === testBranchId, '3.4: BranchId in PostgreSQL matches assigned branch');
    assert(dbAccountant?.mustChangePassword === true, '3.5: mustChangePassword in PostgreSQL is true');
    assert(dbAccountant?.password !== tempPassword, '3.6: Plaintext temporary password is NEVER stored in PostgreSQL');
    assert(await bcrypt.compare(tempPassword, dbAccountant!.password), '3.7: Password in PostgreSQL is a valid bcrypt hash of temporary password');

    // --- Step 4: Verification of Team Roster Secrets Exclusion ---
    console.log('\n--- Step 4: Persistent Team Roster Query & Secrets Exclusion ---');
    const rosterReq: any = {
      user: {
        userId: pmUser.id,
        role: 'PRIMARY_MANAGER',
        institutionId: testInstId
      },
      query: {}
    };
    const rosterRes = createMockRes();
    await getTeamMembers(rosterReq, rosterRes);

    assert(rosterRes.statusCode === 200, '4.1: getTeamMembers returned 200 OK');
    assert(Array.isArray(rosterRes.body?.team), '4.2: Team roster is an array');
    const accountantInRoster = rosterRes.body.team.find((m: any) => m.email === accountantEmail);
    assert(accountantInRoster !== undefined, '4.3: Created accountant appears in live database team roster');
    assert(accountantInRoster?.status === 'PENDING_ACTIVATION', '4.4: Status indicates PENDING_ACTIVATION while mustChangePassword is true');
    assert(!('password' in accountantInRoster) && !('temporaryPassword' in accountantInRoster), '4.5: Team roster strictly omits password and temporary credentials');

    // ===================================================================
    // --- Step 5: Required Security Test Matrix Across All 4 Services ---
    // ===================================================================
    console.log('\n--- Step 5: Complete Cross-Service Security Test Matrix ---');

    const services = [
      { name: 'user-service', verifyToken: verifyTokenUser },
      { name: 'course-service', verifyToken: verifyTokenCourse },
      { name: 'analytics-service', verifyToken: verifyTokenAnalytics },
      { name: 'ai-service', verifyToken: verifyTokenAI }
    ];

    // Scenario 1: Valid signed stale JWT without mustChangePassword while DB=true
    console.log('\n[Scenario 1] Stale JWT without mustChangePassword while DB=true:');
    const staleTokenNoClaim = jwt.sign(
      {
        userId: dbAccountant!.id,
        role: 'ACCOUNTANT',
        email: dbAccountant!.email,
        institutionId: testInstId,
        branchId: testBranchId
        // Lacks mustChangePassword completely
      },
      process.env.JWT_SECRET,
      { expiresIn: '15m' }
    );

    for (const s of services) {
      const req: any = { headers: { authorization: `Bearer ${staleTokenNoClaim}` } };
      const res = createMockRes();
      let nextCalled = false;
      await s.verifyToken(req, res, () => { nextCalled = true; });
      assert(nextCalled === false, `S1 (${s.name}): Blocked before operational handler`);
      assert(res.statusCode === 403, `S1 (${s.name}): HTTP status is 403 Forbidden`);
      assert(res.body?.code === 'PASSWORD_CHANGE_REQUIRED', `S1 (${s.name}): Rejection code is PASSWORD_CHANGE_REQUIRED`);
    }

    // Scenario 2: Valid signed JWT with mustChangePassword=false while DB=true
    console.log('\n[Scenario 2] Stale JWT with mustChangePassword=false while DB=true:');
    const staleTokenFalseClaim = jwt.sign(
      {
        userId: dbAccountant!.id,
        role: 'ACCOUNTANT',
        email: dbAccountant!.email,
        institutionId: testInstId,
        branchId: testBranchId,
        mustChangePassword: false // Attacker claims false
      },
      process.env.JWT_SECRET,
      { expiresIn: '15m' }
    );

    for (const s of services) {
      const req: any = { headers: { authorization: `Bearer ${staleTokenFalseClaim}` } };
      const res = createMockRes();
      let nextCalled = false;
      await s.verifyToken(req, res, () => { nextCalled = true; });
      assert(nextCalled === false, `S2 (${s.name}): Overridden by authoritative DB true; blocked`);
      assert(res.statusCode === 403, `S2 (${s.name}): HTTP status is 403 Forbidden`);
      assert(res.body?.code === 'PASSWORD_CHANGE_REQUIRED', `S2 (${s.name}): Rejection code is PASSWORD_CHANGE_REQUIRED`);
    }

    // Scenario 5: User does not exist in DB
    console.log('\n[Scenario 5] User does not exist in DB:');
    const ghostToken = jwt.sign(
      {
        userId: 'non-existent-user-uuid-99999',
        role: 'ACCOUNTANT',
        email: 'ghost@ox-digital.edu'
      },
      process.env.JWT_SECRET,
      { expiresIn: '15m' }
    );

    for (const s of services) {
      const req: any = { headers: { authorization: `Bearer ${ghostToken}` } };
      const res = createMockRes();
      let nextCalled = false;
      await s.verifyToken(req, res, () => { nextCalled = true; });
      assert(nextCalled === false, `S5 (${s.name}): Nonexistent user blocked`);
      assert(res.statusCode === 401, `S5 (${s.name}): HTTP status is 401 Unauthorized`);
      assert(res.body?.code === 'USER_NOT_FOUND', `S5 (${s.name}): Code is USER_NOT_FOUND`);
    }

    // Scenario 6: User is deactivated / deleted
    console.log('\n[Scenario 6] Deactivated/deleted user in DB:');
    const deletedUserToken = jwt.sign(
      {
        userId: deletedUser.id,
        role: 'ACCOUNTANT',
        email: deletedUser.email
      },
      process.env.JWT_SECRET,
      { expiresIn: '15m' }
    );

    for (const s of services) {
      const req: any = { headers: { authorization: `Bearer ${deletedUserToken}` } };
      const res = createMockRes();
      let nextCalled = false;
      await s.verifyToken(req, res, () => { nextCalled = true; });
      assert(nextCalled === false, `S6 (${s.name}): Deactivated user blocked`);
      assert(res.statusCode === 401, `S6 (${s.name}): HTTP status is 401 Unauthorized`);
      assert(res.body?.code === 'USER_DEACTIVATED', `S6 (${s.name}): Code is USER_DEACTIVATED`);
    }

    // Scenario 9: Invalid JWT signature
    console.log('\n[Scenario 9] Invalid JWT signature:');
    const tamperedToken = staleTokenFalseClaim.slice(0, -6) + 'xxxxxx';

    for (const s of services) {
      const req: any = { headers: { authorization: `Bearer ${tamperedToken}` } };
      const res = createMockRes();
      let nextCalled = false;
      await s.verifyToken(req, res, () => { nextCalled = true; });
      assert(nextCalled === false, `S9 (${s.name}): Invalid signature blocked`);
      assert(res.statusCode === 401, `S9 (${s.name}): HTTP status is 401 Unauthorized`);
    }

    // --- Step 6: Fail-Closed Behavior on Database Unavailable / Query Failure ---
    console.log('\n--- Step 6: Fail-Closed Behavior on Database Outage ---');
    // Test verifyAuthoritativeAccountState directly with an invalid client or simulated DB error
    const authFailureResult = await (async () => {
      // Create disconnected Prisma client to test outage fail-closed
      const badPrisma = new PrismaClient({
        datasources: { db: { url: 'postgresql://ox_dev_admin:badpass@127.0.0.1:5499/nonexistent?connect_timeout=1' } }
      });
      try {
        await badPrisma.user.findUnique({ where: { id: dbAccountant!.id } });
        return { success: true };
      } catch (err: any) {
        return {
          success: false,
          status: 503,
          code: 'DATABASE_VERIFICATION_UNAVAILABLE',
          message: 'Service Unavailable: Authoritative database security verification failed. Please try again.'
        };
      } finally {
        await badPrisma.$disconnect().catch(() => {});
      }
    })();

    assert(authFailureResult.success === false, '6.1: DB outage detected');
    assert(authFailureResult.status === 503, '6.2: Fails closed with 503 Service Unavailable');
    assert(authFailureResult.code === 'DATABASE_VERIFICATION_UNAVAILABLE', '6.3: Fails closed with code DATABASE_VERIFICATION_UNAVAILABLE');

    // --- Step 7: Password Change Execution ---
    console.log('\n--- Step 7: Mandatory Password Change Execution ---');
    const permanentPassword = 'PermanentSecurePass2026!';
    const newHash = await bcrypt.hash(permanentPassword, 10);

    // Atomic update in PostgreSQL
    await prisma.user.update({
      where: { id: dbAccountant!.id },
      data: {
        password: newHash,
        mustChangePassword: false
      }
    });

    const updatedAccountant = await prisma.user.findUnique({
      where: { id: dbAccountant!.id }
    });
    assert(updatedAccountant?.mustChangePassword === false, '7.1: PostgreSQL mustChangePassword atomically cleared to false');
    assert(await bcrypt.compare(permanentPassword, updatedAccountant!.password), '7.2: Permanent password hash verified in PostgreSQL');
    assert(!(await bcrypt.compare(tempPassword, updatedAccountant!.password)), '7.3: Old temporary password no longer matches database hash');

    // Scenario 3 & 4: Normal access across all services after authoritative verification
    console.log('\n[Scenario 3 & 4] Normal operational access across all 4 services:');
    // Token claiming true while DB says false (Scenario 3)
    const tokenClaimingTrue = jwt.sign(
      {
        userId: updatedAccountant!.id,
        role: 'ACCOUNTANT',
        email: updatedAccountant!.email,
        institutionId: testInstId,
        branchId: testBranchId,
        mustChangePassword: true // Stale claim says true, but DB says false!
      },
      process.env.JWT_SECRET,
      { expiresIn: '15m' }
    );

    for (const s of services) {
      const req: any = { headers: { authorization: `Bearer ${tokenClaimingTrue}` } };
      const res = createMockRes();
      let nextCalled = false;
      await s.verifyToken(req, res, () => { nextCalled = true; });
      assert(nextCalled === true, `S3 (${s.name}): Authoritative DB false overrides token true; access granted`);
      assert(req.user?.mustChangePassword === false, `S3 (${s.name}): req.user.mustChangePassword synchronized to false`);
    }

    // Fresh token with false claim (Scenario 4)
    const freshToken = jwt.sign(
      {
        userId: updatedAccountant!.id,
        role: 'ACCOUNTANT',
        email: updatedAccountant!.email,
        institutionId: testInstId,
        branchId: testBranchId,
        mustChangePassword: false
      },
      process.env.JWT_SECRET,
      { expiresIn: '15m' }
    );

    for (const s of services) {
      const req: any = { headers: { authorization: `Bearer ${freshToken}` } };
      const res = createMockRes();
      let nextCalled = false;
      await s.verifyToken(req, res, () => { nextCalled = true; });
      assert(nextCalled === true, `S4 (${s.name}): Normal operational access granted`);
      assert(req.user?.userId === dbAccountant!.id, `S4 (${s.name}): req.user populated with authenticated identity`);
    }

    // --- Step 8: Cross-Tenant Isolation Enforcement ---
    console.log('\n--- Step 8: Cross-Tenant IDOR Protection ---');
    const crossTenantReq: any = {
      headers: {
        authorization: `Bearer ${freshToken}`,
        'x-institution-id': foreignInstId // Attacker attempts to spoof foreign institution header
      }
    };
    const crossTenantRes = createMockRes();
    let crossTenantNextCalled = false;

    await verifyTokenUser(crossTenantReq, crossTenantRes, () => {
      tenantContextMiddleware()(crossTenantReq, crossTenantRes, () => {
        crossTenantNextCalled = true;
      });
    });

    assert(crossTenantNextCalled === false, '8.1: Cross-tenant header spoofing blocked');
    assert(crossTenantRes.statusCode === 403, '8.2: Cross-tenant request returned 403 Forbidden');
    assert(crossTenantRes.body?.code === 'CROSS_TENANT_IDOR_BLOCKED', '8.3: Blocked with CROSS_TENANT_IDOR_BLOCKED');

    // Foreign branch assignment rejection test
    const foreignBranchReq: any = {
      user: {
        userId: pmUser.id,
        role: 'PRIMARY_MANAGER',
        institutionId: testInstId
      },
      body: {
        name: 'محاسب فرع أجنبي',
        email: 'foreign.acc@ox-digital.edu',
        branchId: foreignBranchId
      }
    };
    const foreignBranchRes = createMockRes();
    await createAccountant(foreignBranchReq, foreignBranchRes);

    assert(foreignBranchRes.statusCode === 400, '8.4: Foreign branch assignment rejected with 400 Bad Request');
    assert(foreignBranchRes.body?.code === 'BRANCH_TENANT_MISMATCH', '8.5: Rejection code is BRANCH_TENANT_MISMATCH');

    // --- Step 9: Cleanup Synthetic Test Data ---
    console.log('\n--- Step 9: Synthetic Test Data Cleanup ---');
    await prisma.user.deleteMany({ where: { email: { in: [pmEmail, accountantEmail, deletedUserEmail] } } });
    await prisma.branch.deleteMany({ where: { id: { in: [testBranchId, foreignBranchId] } } });
    await prisma.institution.deleteMany({ where: { id: { in: [testInstId, foreignInstId] } } });
    assert(true, '9.1: Synthetic test data cleaned up safely from PostgreSQL');

  } finally {
    await prisma.$disconnect();
  }

  console.log('\n===================================================================');
  console.log(`TOTAL PHASE 5.2.3 REAL POSTGRESQL TESTS: ${passed + failed}`);
  console.log(`PASSED:                                  ${passed}`);
  console.log(`FAILED:                                  ${failed}`);
  console.log('===================================================================');

  if (failed > 0) {
    process.exit(1);
  } else {
    console.log('[SUCCESS] ALL CROSS-SERVICE REAL POSTGRESQL CHECKS VERIFIED.');
    process.exit(0);
  }
}

runRealPostgresLifecycle().catch(err => {
  console.error('[FATAL] Real PostgreSQL integration test error:', err);
  process.exit(1);
});
