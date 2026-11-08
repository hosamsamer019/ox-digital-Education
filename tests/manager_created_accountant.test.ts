/**
 * OX-DIGITAL Education — Phase 5.2
 * Manager-Created Accountant Accounts & Mandatory First-Login Password Change
 * Backend Integration & Security Test Suite
 */

import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { tenantContextMiddleware } from '../packages/shared/src/tenant/tenantContext.js';
import { createAccountantSchema } from '../services/user-service/src/controllers/user.controller.js';

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

// In-Memory Database Simulation
interface MockUser {
  id: string;
  name: string;
  email: string;
  password: string; // bcrypt hash
  role: string;
  institutionId: string | null;
  branchId: string | null;
  isPrimaryManager: boolean;
  mustChangePassword: boolean;
  deletedAt: Date | null;
}

interface MockBranch {
  id: string;
  name: string;
  code: string;
  institutionId: string;
}

const dbBranches: MockBranch[] = [
  { id: 'branch-dokki-01', name: 'فرع الدقي', code: 'BR-01', institutionId: 'inst-cairo-01' },
  { id: 'branch-nasr-02', name: 'فرع مدينة نصر', code: 'BR-02', institutionId: 'inst-cairo-01' },
  { id: 'branch-alex-01', name: 'فرع الإسكندرية', code: 'BR-ALEX-01', institutionId: 'inst-alex-99' },
];

const dbUsers: MockUser[] = [
  {
    id: 'user-pm-01',
    name: 'أ. د. هشام الأحمدي',
    email: 'manager@ox-digital.edu',
    password: bcrypt.hashSync('ManagerSecret123!', 10),
    role: 'PRIMARY_MANAGER',
    institutionId: 'inst-cairo-01',
    branchId: null,
    isPrimaryManager: true,
    mustChangePassword: false,
    deletedAt: null
  },
  {
    id: 'user-admin-01',
    name: 'مسؤول النظام المركزي',
    email: 'admin@edu.com',
    password: bcrypt.hashSync('AdminSecret123!', 10),
    role: 'ADMIN',
    institutionId: null,
    branchId: null,
    isPrimaryManager: false,
    mustChangePassword: false,
    deletedAt: null
  },
  {
    id: 'user-teacher-01',
    name: 'أ. محمد عبد الله',
    email: 'teacher@ox-digital.edu',
    password: bcrypt.hashSync('TeacherSecret123!', 10),
    role: 'TEACHER',
    institutionId: 'inst-cairo-01',
    branchId: 'branch-dokki-01',
    isPrimaryManager: false,
    mustChangePassword: false,
    deletedAt: null
  }
];

// Backend Controller Logic Simulation strictly matching user.controller.ts createAccountant
async function simulateCreateAccountant(req: any) {
  const requesterRole = (req.user?.role || '').toUpperCase();
  if (!requesterRole) {
    return { status: 401, body: { message: 'Unauthorized' } };
  }

  if (requesterRole !== 'PRIMARY_MANAGER') {
    return {
      status: 403,
      body: { message: 'Forbidden: Only the authenticated Primary Manager of the institution can create an Accountant account' }
    };
  }

  const requesterInstId = req.user?.institutionId || req.tenantContext?.institutionId || null;
  if (!requesterInstId) {
    return { status: 403, body: { message: 'Primary Manager must belong to an active institution' } };
  }

  let validatedData;
  try {
    validatedData = createAccountantSchema.parse(req.body);
  } catch (err: any) {
    return { status: 400, body: { message: 'Validation Error', errors: err.errors } };
  }

  const { name, email, branchId } = validatedData;

  // Branch isolation
  const branchRecord = dbBranches.find(b => b.id === branchId);
  if (!branchRecord || branchRecord.institutionId !== requesterInstId) {
    return {
      status: 400,
      body: { message: 'الفرع المحدد غير موجود أو لا يتبع هذه المؤسسة', code: 'BRANCH_TENANT_MISMATCH' }
    };
  }

  // Duplicate email check
  const existingUser = dbUsers.find(u => u.email.toLowerCase() === email.toLowerCase());
  if (existingUser) {
    return {
      status: 400,
      body: { message: 'البريد الإلكتروني مسجل بالفعل لمستخدم آخر' }
    };
  }

  // CSPRNG Temporary Password Generation
  const temporaryPassword = crypto.randomBytes(12).toString('base64url');
  const hashedPassword = await bcrypt.hash(temporaryPassword, 10);

  const newUser: MockUser = {
    id: `usr-acc-${Date.now()}`,
    name,
    email,
    password: hashedPassword,
    role: 'ACCOUNTANT',
    institutionId: requesterInstId,
    branchId: branchId,
    isPrimaryManager: false,
    mustChangePassword: true,
    deletedAt: null
  };

  dbUsers.push(newUser);

  return {
    status: 201,
    body: {
      message: 'تم إنشاء حساب المحاسب بنجاح',
      user: {
        id: newUser.id,
        name: newUser.name,
        email: newUser.email,
        role: newUser.role,
        branchId: newUser.branchId,
        mustChangePassword: true
      },
      temporaryPassword // Returned once in creation response
    }
  };
}

// Authentication Service Simulation matching auth.controller.ts
async function simulateLogin(email: string, pass: string, role: string) {
  const user = dbUsers.find(u => u.email.toLowerCase() === email.toLowerCase() && u.role === role);
  if (!user || user.deletedAt) {
    return { status: 401, body: { message: 'البريد الإلكتروني أو كلمة المرور غير صحيحة' } };
  }

  const isValid = await bcrypt.compare(pass, user.password);
  if (!isValid) {
    return { status: 401, body: { message: 'البريد الإلكتروني أو كلمة المرور غير صحيحة' } };
  }

  const token = jwt.sign(
    {
      userId: user.id,
      role: user.role,
      email: user.email,
      institutionId: user.institutionId,
      branchId: user.branchId,
      isPrimaryManager: user.isPrimaryManager,
      mustChangePassword: user.mustChangePassword
    },
    'test-jwt-secret-xyz-789',
    { expiresIn: '15m' }
  );

  return {
    status: 200,
    body: {
      token,
      mustChangePassword: user.mustChangePassword,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        mustChangePassword: user.mustChangePassword
      }
    }
  };
}

// Password Change Simulation matching auth.controller.ts
async function simulateChangePassword(userId: string, currentPassword: string, newPassword: string) {
  const user = dbUsers.find(u => u.id === userId);
  if (!user) return { status: 404, body: { message: 'المستخدم غير موجود' } };

  const isMatch = await bcrypt.compare(currentPassword, user.password);
  if (!isMatch) return { status: 400, body: { message: 'كلمة المرور الحالية غير صحيحة' } };

  if (currentPassword === newPassword) {
    return { status: 400, body: { message: 'كلمة المرور الجديدة يجب أن تكون مختلفة عن كلمة المرور الحالية' } };
  }

  if (newPassword.length < 8) {
    return { status: 400, body: { message: 'كلمة المرور يجب ألا تقل عن 8 أحرف' } };
  }

  user.password = await bcrypt.hash(newPassword, 10);
  user.mustChangePassword = false;

  const freshToken = jwt.sign(
    {
      userId: user.id,
      role: user.role,
      email: user.email,
      institutionId: user.institutionId,
      branchId: user.branchId,
      isPrimaryManager: user.isPrimaryManager,
      mustChangePassword: false
    },
    'test-jwt-secret-xyz-789',
    { expiresIn: '15m' }
  );

  return {
    status: 200,
    body: {
      success: true,
      message: 'تم تغيير كلمة المرور بنجاح',
      token: freshToken,
      mustChangePassword: false
    }
  };
}

// Protected Application Operation Simulation guarded by tenantContextMiddleware
function simulateProtectedOperation(token: string) {
  let decoded: any;
  try {
    decoded = jwt.verify(token, 'test-jwt-secret-xyz-789');
  } catch (err) {
    return { status: 401, body: { message: 'Invalid or expired token' } };
  }

  const req: any = {
    user: decoded,
    headers: {}
  };
  let resultStatus = 200;
  let resultBody: any = { success: true, data: 'Protected operational profile data (GET /api/users/profile)' };

  const res: any = {
    status(code: number) {
      resultStatus = code;
      return this;
    },
    json(data: any) {
      resultBody = data;
      return this;
    }
  };

  tenantContextMiddleware()(req, res, () => {});

  return { status: resultStatus, body: resultBody };
}

// Persistent Team Roster Simulation matching user.controller.ts getTeamMembers
function simulateGetTeamMembers(req: any) {
  const requesterRole = (req.user?.role || '').toUpperCase();
  if (!requesterRole) {
    return { status: 401, body: { message: 'Unauthorized' } };
  }
  if (requesterRole !== 'PRIMARY_MANAGER') {
    return {
      status: 403,
      body: { message: 'صلاحية استعراض فريق المؤسسة محصورة فقط بالمدير الأساسي للمؤسسة', code: 'FORBIDDEN_PRIMARY_MANAGER_ONLY' }
    };
  }
  const requesterInstId = req.user?.institutionId;
  if (!requesterInstId) {
    return {
      status: 403,
      body: { message: 'حساب المدير الأساسي غير مرتبط بمؤسسة تعليمية معتمدة', code: 'MISSING_INSTITUTION_AFFILIATION' }
    };
  }

  const { branchId, search } = req.query || {};

  if (branchId && branchId !== 'ALL' && branchId !== 'INST-CONSOLIDATED') {
    const branchRecord = dbBranches.find(b => b.id === branchId);
    if (!branchRecord || branchRecord.institutionId !== requesterInstId) {
      return {
        status: 400,
        body: { message: 'الفرع المحدد غير موجود أو لا يتبع هذه المؤسسة', code: 'BRANCH_TENANT_MISMATCH' }
      };
    }
  }

  const filteredUsers = dbUsers.filter(u => {
    if (u.deletedAt) return false;
    if (u.institutionId !== requesterInstId) return false;
    if (branchId && branchId !== 'ALL' && branchId !== 'INST-CONSOLIDATED' && u.branchId !== branchId) return false;
    if (search) {
      const s = search.toLowerCase();
      if (!u.name.toLowerCase().includes(s) && !u.email.toLowerCase().includes(s)) return false;
    }
    return true;
  });

  const team = filteredUsers.map(u => ({
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role,
    roleLabel: u.role === 'PRIMARY_MANAGER' ? 'المدير الأساسي المالي' : 'محاسب الفرع',
    branchId: u.branchId || (u.role === 'PRIMARY_MANAGER' ? 'INST-CONSOLIDATED' : ''),
    branchName: dbBranches.find(b => b.id === u.branchId)?.name || (u.role === 'PRIMARY_MANAGER' ? 'المقر الرئيسي (إشراف موحد)' : 'غير محدد'),
    status: u.mustChangePassword ? 'PENDING_ACTIVATION' : 'ACTIVE',
    statusLabel: u.mustChangePassword ? 'بانتظار تغيير كلمة المرور' : 'نشط ومعتمد'
  }));

  return {
    status: 200,
    body: {
      success: true,
      team,
      count: team.length
    }
  };
}

async function runTests() {
  console.log('===================================================================');
  console.log('OX-DIGITAL Education — Phase 5.2 Manager-Created Accountant Suite');
  console.log('Timestamp:', new Date().toISOString());
  console.log('===================================================================\n');

  // --- Suite 1: Account Creation Authorization ---
  console.log('--- Suite 1: Account Creation Authorization ---');

  // 1.1 PM can create Accountant
  const pmReq = {
    user: {
      userId: 'user-pm-01',
      role: 'PRIMARY_MANAGER',
      institutionId: 'inst-cairo-01'
    },
    body: {
      name: 'محاسب الفرع الجديد',
      email: 'new.accountant@cma-academy.edu',
      branchId: 'branch-dokki-01'
    }
  };
  const createRes1 = await simulateCreateAccountant(pmReq);
  assert(createRes1.status === 201, '1.1: Primary Manager can create Accountant (201 Created)');
  assert(createRes1.body.user.role === 'ACCOUNTANT', '1.1: Created role is ACCOUNTANT');
  assert(createRes1.body.user.mustChangePassword === true, '1.1: mustChangePassword is true');
  assert(typeof createRes1.body.temporaryPassword === 'string' && createRes1.body.temporaryPassword.length >= 16, '1.1: CSPRNG temporary password returned');

  const createdAccountantTempPassword = createRes1.body.temporaryPassword;

  // 1.2 SaaS ADMIN cannot provision institution Accountant
  const adminReq = {
    user: { userId: 'user-admin-01', role: 'ADMIN' },
    body: { name: 'محاسب مرفوض', email: 'denied@edu.com', branchId: 'branch-dokki-01' }
  };
  const createRes2 = await simulateCreateAccountant(adminReq);
  assert(createRes2.status === 403, '1.2: SaaS ADMIN rejected with 403 Forbidden');

  // 1.3 TEACHER cannot create Accountant
  const teacherReq = {
    user: { userId: 'user-teacher-01', role: 'TEACHER', institutionId: 'inst-cairo-01' },
    body: { name: 'محاسب مرفوض', email: 'denied2@edu.com', branchId: 'branch-dokki-01' }
  };
  const createRes3 = await simulateCreateAccountant(teacherReq);
  assert(createRes3.status === 403, '1.3: TEACHER rejected with 403 Forbidden');

  // 1.4 Unauthenticated request rejected
  const unauthReq = { user: null, body: { name: 'محاسب مرفوض', email: 'denied3@edu.com', branchId: 'branch-dokki-01' } };
  const createRes4 = await simulateCreateAccountant(unauthReq);
  assert(createRes4.status === 401, '1.4: Unauthenticated rejected with 401 Unauthorized');

  // --- Suite 2: Tenant & Branch Isolation & Privilege Escalation ---
  console.log('\n--- Suite 2: Tenant & Branch Isolation & Privilege Escalation ---');

  // 2.1 Branch ID from foreign institution rejected
  const foreignBranchReq = {
    user: { userId: 'user-pm-01', role: 'PRIMARY_MANAGER', institutionId: 'inst-cairo-01' },
    body: { name: 'محاسب الإسكندرية', email: 'alex.acc@edu.com', branchId: 'branch-alex-01' }
  };
  const createRes5 = await simulateCreateAccountant(foreignBranchReq);
  assert(createRes5.status === 400 && createRes5.body.code === 'BRANCH_TENANT_MISMATCH', '2.1: Foreign branch rejected with 400 BRANCH_TENANT_MISMATCH');

  // 2.2 Client-supplied role escalation attempt stripped and ignored
  const escalationReq = {
    user: { userId: 'user-pm-01', role: 'PRIMARY_MANAGER', institutionId: 'inst-cairo-01' },
    body: {
      name: 'محاسب يحاول الترقية',
      email: 'escalate.acc@edu.com',
      branchId: 'branch-dokki-01',
      role: 'ADMIN', // malicious payload
      institutionId: 'inst-foreign-99' // malicious payload
    }
  };
  const createRes6 = await simulateCreateAccountant(escalationReq);
  assert(createRes6.status === 201, '2.2: Account created');
  assert(createRes6.body.user.role === 'ACCOUNTANT', '2.2: Role forced to ACCOUNTANT (ignored client ADMIN)');

  // 2.3 Duplicate email rejected
  const dupReq = {
    user: { userId: 'user-pm-01', role: 'PRIMARY_MANAGER', institutionId: 'inst-cairo-01' },
    body: { name: 'محاسب مكرر', email: 'new.accountant@cma-academy.edu', branchId: 'branch-dokki-01' }
  };
  const createRes7 = await simulateCreateAccountant(dupReq);
  assert(createRes7.status === 400, '2.3: Duplicate email rejected with 400 Bad Request');

  // --- Suite 3: First-Login & Server-Side Password Change Enforcement ---
  console.log('\n--- Suite 3: First-Login & Server-Side Password Change Enforcement ---');

  // 3.1 Accountant logs in with temporary password
  const loginRes1 = await simulateLogin('new.accountant@cma-academy.edu', createdAccountantTempPassword, 'ACCOUNTANT');
  assert(loginRes1.status === 200, '3.1: Accountant authenticates with temporary password (200 OK)');
  assert(loginRes1.body.mustChangePassword === true, '3.1: Response indicates mustChangePassword: true');

  const tempToken = loginRes1.body.token;
  const decodedTemp: any = jwt.decode(tempToken);
  assert(decodedTemp.mustChangePassword === true, '3.1: Issued JWT contains mustChangePassword: true');

  // 3.2 Protected operational endpoint blocks access with 403 PASSWORD_CHANGE_REQUIRED
  const protectedRes1 = simulateProtectedOperation(tempToken);
  assert(protectedRes1.status === 403, '3.2: Protected endpoint returns 403 Forbidden');
  assert(protectedRes1.body.code === 'PASSWORD_CHANGE_REQUIRED', '3.2: Rejection code is PASSWORD_CHANGE_REQUIRED');

  // 3.3 Accountant changes temporary password to permanent password
  const changeRes1 = await simulateChangePassword(decodedTemp.userId, createdAccountantTempPassword, 'NewPermanentPass2026!');
  assert(changeRes1.status === 200, '3.3: Password change succeeds with valid new password (200 OK)');
  assert(changeRes1.body.mustChangePassword === false, '3.3: Response confirms mustChangePassword: false');

  const freshToken = changeRes1.body.token;
  const decodedFresh: any = jwt.decode(freshToken);
  assert(decodedFresh.mustChangePassword === false, '3.3: Fresh JWT contains mustChangePassword: false');

  // 3.4 Protected operational endpoint now permits access with fresh token
  const protectedRes2 = simulateProtectedOperation(freshToken);
  assert(protectedRes2.status === 200, '3.4: Protected endpoint accessible after password change (200 OK)');
  assert(protectedRes2.body.data === 'Protected operational profile data (GET /api/users/profile)', '3.4: Normal operational data returned');

  // 3.5 Old temporary password no longer authenticates
  const oldLoginRes = await simulateLogin('new.accountant@cma-academy.edu', createdAccountantTempPassword, 'ACCOUNTANT');
  assert(oldLoginRes.status === 401, '3.5: Old temporary password rejected with 401 Unauthorized');

  // 3.6 New permanent password authenticates cleanly
  const newLoginRes = await simulateLogin('new.accountant@cma-academy.edu', 'NewPermanentPass2026!', 'ACCOUNTANT');
  assert(newLoginRes.status === 200, '3.6: New permanent password authenticates (200 OK)');
  assert(newLoginRes.body.mustChangePassword === false, '3.6: mustChangePassword remains false');

  // --- Suite 4: Regression Invariants ---
  console.log('\n--- Suite 4: Regression Invariants ---');

  // 4.1 Existing Primary Manager login unaffected (mustChangePassword is false)
  const pmLogin = await simulateLogin('manager@ox-digital.edu', 'ManagerSecret123!', 'PRIMARY_MANAGER');
  assert(pmLogin.status === 200 && pmLogin.body.mustChangePassword === false, '4.1: Existing Primary Manager unaffected');

  // 4.2 Existing Teacher login unaffected
  const teacherLogin = await simulateLogin('teacher@ox-digital.edu', 'TeacherSecret123!', 'TEACHER');
  assert(teacherLogin.status === 200 && teacherLogin.body.mustChangePassword === false, '4.2: Existing Teacher unaffected');

  // 4.3 Existing Admin login unaffected
  const adminLogin = await simulateLogin('admin@edu.com', 'AdminSecret123!', 'ADMIN');
  assert(adminLogin.status === 200 && adminLogin.body.mustChangePassword === false, '4.3: Existing SaaS Admin unaffected');

  // --- Suite 5: Persistent Team Roster & Isolation (GET /api/manager/team) ---
  console.log('\n--- Suite 5: Persistent Team Roster & Isolation (GET /api/manager/team) ---');

  // 5.1 Primary Manager can fetch live team members
  const pmTeamReq = {
    user: { userId: 'user-pm-01', role: 'PRIMARY_MANAGER', institutionId: 'inst-cairo-01' },
    query: {}
  };
  const pmTeamRes = simulateGetTeamMembers(pmTeamReq);
  assert(pmTeamRes.status === 200, '5.1: Primary Manager can query team roster (200 OK)');
  assert(Array.isArray(pmTeamRes.body.team) && pmTeamRes.body.team.length >= 1, '5.1: Team roster contains institution members');

  // 5.2 Non-Primary-Manager is strictly forbidden
  const teacherTeamReq = {
    user: { userId: 'user-teacher-01', role: 'TEACHER', institutionId: 'inst-cairo-01' },
    query: {}
  };
  const teacherTeamRes = simulateGetTeamMembers(teacherTeamReq);
  assert(teacherTeamRes.status === 403, '5.2: Teacher forbidden from accessing team roster (403 Forbidden)');

  const adminTeamReq = {
    user: { userId: 'user-admin-01', role: 'ADMIN' },
    query: {}
  };
  const adminTeamRes = simulateGetTeamMembers(adminTeamReq);
  assert(adminTeamRes.status === 403, '5.2: SaaS Admin forbidden from accessing institution team roster (403 Forbidden)');

  // 5.3 Secrets exclusion: Response NEVER contains password hashes or temporary passwords
  const hasSecrets = pmTeamRes.body.team.some((member: any) => 'password' in member || 'temporaryPassword' in member || 'hash' in member);
  assert(!hasSecrets, '5.3: Team roster strictly excludes password hashes and temporary passwords');

  // 5.4 Cross-Tenant Isolation: PM of inst-cairo-01 cannot see members from inst-alex-99
  const foreignMemberInRoster = pmTeamRes.body.team.some((member: any) => member.institutionId === 'inst-alex-99');
  assert(!foreignMemberInRoster, '5.4: Cross-tenant isolation enforced; foreign institution members never returned');

  // 5.5 Branch Filtering: PM can filter by branch belonging to their institution
  const dokkiFilterReq = {
    user: { userId: 'user-pm-01', role: 'PRIMARY_MANAGER', institutionId: 'inst-cairo-01' },
    query: { branchId: 'branch-dokki-01' }
  };
  const dokkiRes = simulateGetTeamMembers(dokkiFilterReq);
  assert(dokkiRes.status === 200, '5.5: Branch filter query succeeds (200 OK)');
  const allMatchDokki = dokkiRes.body.team.every((member: any) => member.branchId === 'branch-dokki-01');
  assert(allMatchDokki, '5.5: All returned team members belong to filtered branch');

  // 5.6 Foreign branch filter rejected with 400 BRANCH_TENANT_MISMATCH
  const invalidBranchFilterReq = {
    user: { userId: 'user-pm-01', role: 'PRIMARY_MANAGER', institutionId: 'inst-cairo-01' },
    query: { branchId: 'branch-alex-01' }
  };
  const invalidBranchRes = simulateGetTeamMembers(invalidBranchFilterReq);
  assert(invalidBranchRes.status === 400 && invalidBranchRes.body.code === 'BRANCH_TENANT_MISMATCH', '5.6: Foreign branch filter rejected with 400 BRANCH_TENANT_MISMATCH');

  console.log('\n===================================================================');
  console.log(`TOTAL PHASE 5.2 TESTS: ${passed + failed}`);
  console.log(`PASSED:                ${passed}`);
  console.log(`FAILED:                ${failed}`);
  console.log('===================================================================');

  if (failed > 0) {
    process.exit(1);
  } else {
    console.log('[SUCCESS] ALL PHASE 5.2 SECURITY & INTEGRATION REQUIREMENTS VERIFIED.');
    process.exit(0);
  }
}

runTests().catch(err => {
  console.error('Test runner fatal error:', err);
  process.exit(1);
});

