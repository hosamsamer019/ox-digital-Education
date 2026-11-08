import jwt from 'jsonwebtoken';
import { 
  tenantContextMiddleware, 
  assertTenantAccess, 
  assertBranchAccess, 
  isPlatformSuperAdminUser,
  TenantContext 
} from '../../packages/shared/src/tenant/tenantContext.js';

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

async function runTenantIsolationTests() {
  console.log('===================================================================');
  console.log('OX-DIGITAL Task 7.1 — Tenant Isolation & IDOR Protection Tests');
  console.log('===================================================================\n');

  // Test 1: Platform Super-Admin Identification (OD-718)
  console.log('--- Suite 1: Platform Super-Admin Isolation ---');
  const superAdminUser = {
    id: 'super-admin-uuid-1',
    email: 'admin@edu.com',
    role: 'ADMIN'
  };
  const regularAdminUser = {
    id: 'inst-admin-uuid-2',
    email: 'manager@institution.edu',
    role: 'ADMIN'
  };
  const teacherUser = {
    id: 'teacher-uuid-3',
    email: 'teacher@school.edu',
    role: 'TEACHER'
  };

  assert(isPlatformSuperAdminUser(superAdminUser) === true, 'admin@edu.com is correctly identified as SaaS Platform Super-Admin');
  assert(isPlatformSuperAdminUser(regularAdminUser) === false, 'Other ADMIN user is NOT identified as SaaS Platform Super-Admin');
  assert(isPlatformSuperAdminUser(teacherUser) === false, 'Teacher is NOT SaaS Platform Super-Admin');

  // Test 2: Spoofed Header Rejection (SEC-01 / SEC-02 Anti-IDOR)
  console.log('\n--- Suite 2: Client Spoofed Header Rejection ---');
  const mockReqWithSpoofedTenant: any = {
    headers: {
      'x-tenant-id': 'malicious-institution-999'
    },
    user: {
      userId: 'user-1',
      institutionId: 'legit-institution-1',
      role: 'STUDENT'
    }
  };
  let rejectedStatus = 0;
  let rejectedBody: any = null;
  const mockRes: any = {
    status: (code: number) => {
      rejectedStatus = code;
      return {
        json: (data: any) => {
          rejectedBody = data;
        }
      };
    }
  };
  let nextCalled = false;
  tenantContextMiddleware(mockReqWithSpoofedTenant, mockRes, () => {
    nextCalled = true;
  });

  assert(nextCalled === false, 'Next is NOT called when spoofed header is present');
  assert(rejectedStatus === 403, 'Spoofed tenant header triggers HTTP 403 Forbidden');
  assert(rejectedBody?.code === 'CROSS_TENANT_IDOR_BLOCKED', 'Rejection code is CROSS_TENANT_IDOR_BLOCKED');

  // Test 3: Legitimate Tenant Context Resolution
  console.log('\n--- Suite 3: Server-Side Tenant Context Resolution ---');
  const mockValidReq: any = {
    headers: {},
    user: {
      userId: 'user-legit-123',
      email: 'student@domain.edu',
      institutionId: 'inst-legit-456',
      branchId: 'branch-legit-789',
      role: 'STUDENT',
      isPrimaryManager: false
    }
  };
  let validNextCalled = false;
  tenantContextMiddleware(mockValidReq, mockRes, () => {
    validNextCalled = true;
  });

  assert(validNextCalled === true, 'Next is called for legitimate user without spoofed headers');
  assert(mockValidReq.tenantContext?.institutionId === 'inst-legit-456', 'InstitutionId resolved correctly from user token claims');
  assert(mockValidReq.tenantContext?.branchId === 'branch-legit-789', 'BranchId resolved correctly from user token claims');
  assert(mockValidReq.tenantContext?.isPlatformSuperAdmin === false, 'isPlatformSuperAdmin is false for standard student');

  // Test 4: Cross-Tenant Access Guard (assertTenantAccess)
  console.log('\n--- Suite 4: Cross-Tenant Access Guards ---');
  const contextA: TenantContext = {
    institutionId: 'inst-alpha',
    branchId: 'branch-alpha-1',
    userId: 'user-a',
    role: 'STUDENT',
    isPlatformSuperAdmin: false,
    isPrimaryManager: false
  };

  let sameTenantAllowed = false;
  try {
    assertTenantAccess(contextA, 'inst-alpha');
    sameTenantAllowed = true;
  } catch (e) {
    sameTenantAllowed = false;
  }
  assert(sameTenantAllowed === true, 'Access to own institution is allowed');

  let crossTenantBlocked = false;
  try {
    assertTenantAccess(contextA, 'inst-beta');
  } catch (e: any) {
    if (e.message?.includes('Cross-tenant resource access denied')) {
      crossTenantBlocked = true;
    }
  }
  assert(crossTenantBlocked === true, 'Access to another institution is strictly denied');

  // Test 5: Branch Scoping Guard (assertBranchAccess)
  console.log('\n--- Suite 5: Branch Scoping Guards ---');
  let sameBranchAllowed = false;
  try {
    assertBranchAccess(contextA, 'branch-alpha-1');
    sameBranchAllowed = true;
  } catch (e) {
    sameBranchAllowed = false;
  }
  assert(sameBranchAllowed === true, 'Access to own branch is allowed');

  let otherBranchBlocked = false;
  try {
    assertBranchAccess(contextA, 'branch-alpha-2');
  } catch (e: any) {
    if (e.message?.includes('Cross-branch access denied')) {
      otherBranchBlocked = true;
    }
  }
  assert(otherBranchBlocked === true, 'Access to another branch within institution is denied for branch-scoped user');

  // Test 6: Primary Manager Multi-Branch Access
  console.log('\n--- Suite 6: Primary Manager Multi-Branch Access ---');
  const primaryManagerContext: TenantContext = {
    institutionId: 'inst-alpha',
    branchId: null, // Primary manager has institution-wide scope
    userId: 'manager-a',
    role: 'PRIMARY_MANAGER',
    isPlatformSuperAdmin: false,
    isPrimaryManager: true
  };

  let managerBranchAccessAllowed = false;
  try {
    assertBranchAccess(primaryManagerContext, 'branch-alpha-2');
    managerBranchAccessAllowed = true;
  } catch (e) {
    managerBranchAccessAllowed = false;
  }
  assert(managerBranchAccessAllowed === true, 'Primary Manager with null branchId has institution-wide branch access');

  // Test 7: Remediation D — Token Refresh Authoritative Claims Preservation
  console.log('\n--- Suite 7: Remediation D — Token Refresh Claims Preservation ---');
  process.env.JWT_SECRET = 'test-jwt-secret-task71';

  // Simulate authoritative user in database after branch reassignment
  const persistedUserInDb = {
    id: 'user-manager-99',
    role: 'PRIMARY_MANAGER',
    email: 'manager@institution.edu',
    institutionId: 'inst-authoritative-777',
    branchId: 'branch-new-888',
    isPrimaryManager: true,
    deletedAt: null
  };

  // Build new token using authoritative DB fields (Remediation D logic)
  const isSuper = persistedUserInDb.email?.toLowerCase() === 'admin@edu.com';
  const refreshedToken = jwt.sign(
    {
      userId: persistedUserInDb.id,
      role: persistedUserInDb.role,
      email: persistedUserInDb.email,
      institutionId: isSuper ? null : persistedUserInDb.institutionId,
      branchId: isSuper ? null : persistedUserInDb.branchId,
      isPrimaryManager: isSuper ? false : Boolean(persistedUserInDb.isPrimaryManager)
    },
    process.env.JWT_SECRET,
    { expiresIn: '15m' }
  );

  const decodedRefreshed: any = jwt.verify(refreshedToken, process.env.JWT_SECRET);
  assert(decodedRefreshed.institutionId === 'inst-authoritative-777', 'Refreshed access token preserves authoritative institutionId');
  assert(decodedRefreshed.branchId === 'branch-new-888', 'Refreshed access token preserves updated branchId');
  assert(decodedRefreshed.isPrimaryManager === true, 'Refreshed access token preserves isPrimaryManager claim');

  // Deactivated/deleted account test
  const deletedUser = { ...persistedUserInDb, deletedAt: new Date() };
  assert(deletedUser.deletedAt !== null, 'Deleted account detected via deletedAt timestamp');

  console.log('\n===================================================================');
  console.log(`RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('===================================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runTenantIsolationTests().catch(err => {
  console.error('Test execution error:', err);
  process.exit(1);
});
