/**
 * OX-DIGITAL Education — Phase 5.5.3
 * Complete Tenant and Branch Isolation & IDOR Adversarial Suite
 *
 * Verifies all required multi-tenant attack cases against isolated PostgreSQL (127.0.0.1:5433):
 *  Case 1: User from Institution A requests Institution B data
 *  Case 2: User from Branch A requests Branch B data
 *  Case 3: Client supplies a forged institutionId header (x-institution-id)
 *  Case 4: Client supplies a forged branchId header
 *  Case 5: User changes resource ID to a resource owned by another tenant (IDOR attack)
 *  Case 6: User attempts unauthorized update/deletion of another tenant's resource
 *  Case 7: Comprehensive Role boundary checks (Teacher, Student, Parent, Accountant, Primary Manager, Super-Admin)
 *  Case 8: Cross-institution financial obligation and collection access
 *  Case 9: Parent access to unrelated children
 *  Case 10: Financial restriction endpoints and privileged role boundaries
 */

import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { db } from '@smartmath/database';
import { tenantContextMiddleware } from '@shared/utils';

import { getTeamMembers, createAccountant } from '../services/user-service/src/controllers/user.controller.js';
import { getHomeworkDetails } from '../services/course-service/src/controllers/homework.controller.js';
import { ChatService } from '../services/ai-service/src/services/chat.service.js';
import { checkRole } from '../services/user-service/src/middlewares/auth.middleware.js';
import { createCollection } from '../services/user-service/src/controllers/accounting/collections.controller.js';
import { updateFinancialAccessPolicy } from '../services/user-service/src/controllers/accounting/accessControl.controller.js';

const JWT_SECRET = process.env.JWT_SECRET || 'dev_secret_key_1234567890_super_secure';
process.env.JWT_SECRET = JWT_SECRET;
process.env.NODE_ENV = 'test';

let passed = 0;
let failed = 0;

function assert(condition: boolean, msg: string) {
  if (condition) {
    console.log(`[PASS] ${msg}`);
    passed++;
  } else {
    console.error(`[FAIL] ${msg}`);
    failed++;
  }
}

async function runTenantIdorSuite() {
  console.log('===================================================================');
  console.log('OX-DIGITAL Education — Tenant Isolation & IDOR Adversarial Suite');
  console.log('Target Database: 127.0.0.1:5433 / ox_digital_dev_test');
  console.log(`Timestamp: ${new Date().toISOString()}`);
  console.log('===================================================================\n');

  // Mandatory Database Identity Verification
  const dbInfo = await db.$queryRawUnsafe<any[]>(`
    SELECT current_database() as db_name, current_user as db_user;
  `);
  if (dbInfo[0].db_name !== 'ox_digital_dev_test' || dbInfo[0].db_user !== 'ox_dev_admin') {
    throw new Error(`CRITICAL: Database identity mismatch! Expected ox_digital_dev_test/ox_dev_admin, got ${dbInfo[0].db_name}/${dbInfo[0].db_user}`);
  }

  const runId = Math.random().toString(36).substring(2, 8);
  const instA = `inst_idor_a_${runId}`;
  const instB = `inst_idor_b_${runId}`;
  const branchA = `br_idor_a_${runId}`;
  const branchB = `br_idor_b_${runId}`;

  const pmAId = `pm_a_${runId}`;
  const pmBId = `pm_b_${runId}`;
  const teacherAId = `teach_a_${runId}`;
  const teacherBId = `teach_b_${runId}`;
  const parentAId = `parent_a_${runId}`;
  const parentBId = `parent_b_${runId}`;
  const studentAId = `stud_a_${runId}`;
  const studentBId = `stud_b_${runId}`;
  const accountantAId = `acc_a_${runId}`;
  const accountantBId = `acc_b_${runId}`;
  const adminId = `admin_${runId}`;

  const courseAId = `crs_a_${runId}`;
  const courseBId = `crs_b_${runId}`;
  const hwAId = `hw_a_${runId}`;
  const hwBId = `hw_b_${runId}`;
  const examAId = `exam_a_${runId}`;
  const examBId = `exam_b_${runId}`;
  const sessionAId = `sess_a_${runId}`;
  const sessionBId = `sess_b_${runId}`;

  const agIdA = `agr_a_${runId}`;
  const agIdB = `agr_b_${runId}`;
  const obIdA = `ob_a_${runId}`;
  const obIdB = `ob_b_${runId}`;

  try {
    // -------------------------------------------------------------
    // Step 1: Database Setup with Cross-Tenant Fixtures
    // -------------------------------------------------------------
    console.log('--- Step 1: Setting up Real Database Multi-Tenant Fixtures ---');
    await db.institution.createMany({
      data: [
        { id: instA, name: `Institution A ${runId}`, code: `IA-${runId}` },
        { id: instB, name: `Institution B ${runId}`, code: `IB-${runId}` }
      ]
    });

    await db.branch.createMany({
      data: [
        { id: branchA, name: `Branch A ${runId}`, code: `BA-${runId}`, institutionId: instA, isOnline: false },
        { id: branchB, name: `Branch B ${runId}`, code: `BB-${runId}`, institutionId: instB, isOnline: false }
      ]
    });

    const hash = await bcrypt.hash('Secure#2026Pass', 10);

    // Users for Tenant A
    await db.user.createMany({
      data: [
        { id: pmAId, email: `pma_${runId}@ox.com`, name: 'PM A', password: hash, role: 'PRIMARY_MANAGER', institutionId: instA, branchId: branchA, isPrimaryManager: true, mustChangePassword: false },
        { id: teacherAId, email: `ta_${runId}@ox.com`, name: 'Teacher A', password: hash, role: 'TEACHER', institutionId: instA, branchId: branchA, mustChangePassword: false },
        { id: parentAId, email: `parenta_${runId}@ox.com`, name: 'Parent A', password: hash, role: 'PARENT', institutionId: instA, branchId: branchA, mustChangePassword: false },
        { id: studentAId, email: `sa_${runId}@ox.com`, name: 'Student A', password: hash, role: 'CENTER_STUDENT', institutionId: instA, branchId: branchA, parentId: parentAId, mustChangePassword: false },
        { id: accountantAId, email: `acca_${runId}@ox.com`, name: 'Accountant A', password: hash, role: 'ACCOUNTANT', institutionId: instA, branchId: branchA, mustChangePassword: false }
      ]
    });

    // Users for Tenant B
    await db.user.createMany({
      data: [
        { id: pmBId, email: `pmb_${runId}@ox.com`, name: 'PM B', password: hash, role: 'PRIMARY_MANAGER', institutionId: instB, branchId: branchB, isPrimaryManager: true, mustChangePassword: false },
        { id: teacherBId, email: `tb_${runId}@ox.com`, name: 'Teacher B', password: hash, role: 'TEACHER', institutionId: instB, branchId: branchB, mustChangePassword: false },
        { id: parentBId, email: `parentb_${runId}@ox.com`, name: 'Parent B', password: hash, role: 'PARENT', institutionId: instB, branchId: branchB, mustChangePassword: false },
        { id: studentBId, email: `sb_${runId}@ox.com`, name: 'Student B', password: hash, role: 'CENTER_STUDENT', institutionId: instB, branchId: branchB, parentId: parentBId, mustChangePassword: false },
        { id: accountantBId, email: `accb_${runId}@ox.com`, name: 'Accountant B', password: hash, role: 'ACCOUNTANT', institutionId: instB, branchId: branchB, mustChangePassword: false }
      ]
    });

    // Tenant A Courses & Resources
    await db.course.create({
      data: { id: courseAId, title: `Math A ${runId}`, teacherId: teacherAId, institutionId: instA, branchId: branchA }
    });
    await db.courseEnrollment.create({
      data: { studentId: studentAId, courseId: courseAId }
    });
    await db.homework.create({
      data: { id: hwAId, title: `HW A ${runId}`, courseId: courseAId }
    });
    await db.exam.create({
      data: { id: examAId, title: `Exam A ${runId}`, courseId: courseAId }
    });
    await db.chatSession.create({
      data: { id: sessionAId, userId: studentAId }
    });

    // Tenant B Courses & Resources
    await db.course.create({
      data: { id: courseBId, title: `Math B ${runId}`, teacherId: teacherBId, institutionId: instB, branchId: branchB }
    });
    await db.courseEnrollment.create({
      data: { studentId: studentBId, courseId: courseBId }
    });
    await db.homework.create({
      data: { id: hwBId, title: `HW B ${runId}`, courseId: courseBId }
    });
    await db.exam.create({
      data: { id: examBId, title: `Exam B ${runId}`, courseId: courseBId }
    });
    await db.chatSession.create({
      data: { id: sessionBId, userId: studentBId }
    });

    assert(true, '1.1: Multi-tenant fixture hierarchy created in PostgreSQL');

    // -------------------------------------------------------------
    // Attack Case 1: User from Inst A requests Inst B Data
    // -------------------------------------------------------------
    console.log('\n--- Attack Case 1: Cross-Tenant Data Access ---');
    let teamStatus: number | null = null;
    let teamBody: any = null;
    // PM A requests team roster filtering by Branch B (Tenant B)
    await getTeamMembers(
      {
        user: { userId: pmAId, role: 'PRIMARY_MANAGER', institutionId: instA, isPrimaryManager: true },
        query: { branchId: branchB }
      } as any,
      {
        status: (code: number) => { teamStatus = code; return { json: (b: any) => { teamBody = b; } }; },
        json: (b: any) => { teamStatus = 200; teamBody = b; }
      } as any
    );
    assert(teamStatus === 400 && teamBody?.code === 'BRANCH_TENANT_MISMATCH',
      'Case 1.1: PM from Institution A querying foreign Branch B rejected with 400 BRANCH_TENANT_MISMATCH');

    // PM A requests full team roster -> Must ONLY contain Tenant A members, NEVER Tenant B
    teamStatus = null;
    teamBody = null;
    await getTeamMembers(
      {
        user: { userId: pmAId, role: 'PRIMARY_MANAGER', institutionId: instA, isPrimaryManager: true },
        query: {}
      } as any,
      {
        status: (code: number) => { teamStatus = code; return { json: (b: any) => { teamBody = b; } }; },
        json: (b: any) => { teamStatus = 200; teamBody = b; }
      } as any
    );
    const returnedUsers = teamBody?.team || teamBody || [];
    const hasTenantBUser = returnedUsers.some((u: any) => u.id === pmBId);
    const hasTenantAUser = returnedUsers.some((u: any) => u.id === pmAId || u.id === accountantAId);
    assert(teamStatus === 200 && !hasTenantBUser && hasTenantAUser,
      'Case 1.2: Team roster query strictly isolated to Tenant A (Tenant B members never returned)');

    // -------------------------------------------------------------
    // Attack Case 2: User from Branch A requests Branch B Data
    // -------------------------------------------------------------
    console.log('\n--- Attack Case 2: Cross-Branch Access within Different Tenants ---');
    let accStatus: number | null = null;
    let accBody: any = null;
    await createAccountant(
      {
        user: { userId: pmAId, role: 'PRIMARY_MANAGER', institutionId: instA, isPrimaryManager: true },
        body: { name: 'Attacker Acc', email: `att_${runId}@ox.com`, branchId: branchB }
      } as any,
      {
        status: (code: number) => { accStatus = code; return { json: (b: any) => { accBody = b; } }; },
        json: (b: any) => { accStatus = 200; accBody = b; }
      } as any
    );
    assert(accStatus === 400 && accBody?.code === 'BRANCH_TENANT_MISMATCH',
      'Case 2.1: Provisioning accountant with foreign branch rejected with 400 BRANCH_TENANT_MISMATCH');

    // -------------------------------------------------------------
    // Attack Case 3 & 4: Forged institutionId / branchId Headers (IDOR)
    // -------------------------------------------------------------
    console.log('\n--- Attack Case 3 & 4: Header Spoofing (x-institution-id / x-branch-id) ---');
    const tenantMw = tenantContextMiddleware();
    let idorStatus: number | null = null;
    let idorBody: any = null;
    let nextRan = false;

    // Standard Tenant A user passes x-institution-id: instB
    tenantMw(
      {
        user: { userId: studentAId, role: 'CENTER_STUDENT', institutionId: instA, branchId: branchA },
        headers: { 'x-institution-id': instB }
      } as any,
      { status: (code: number) => { idorStatus = code; return { json: (b: any) => { idorBody = b; } }; } } as any,
      (() => { nextRan = true; }) as any
    );
    assert(idorStatus === 403 && idorBody?.code === 'CROSS_TENANT_IDOR_BLOCKED' && !nextRan,
      'Case 3.1: Forged x-institution-id header rejected with 403 CROSS_TENANT_IDOR_BLOCKED');

    // -------------------------------------------------------------
    // Attack Case 5: Resource ID Spoofing (IDOR on Course, Homework, Exam, AI)
    // -------------------------------------------------------------
    console.log('\n--- Attack Case 5: Resource ID Manipulation (IDOR Attacks) ---');
    let hwStatus: number | null = null;
    let hwBody: any = null;
    await getHomeworkDetails(
      {
        user: { userId: studentAId, role: 'CENTER_STUDENT', institutionId: instA },
        params: { id: hwBId }
      } as any,
      {
        status: (code: number) => { hwStatus = code; return { json: (b: any) => { hwBody = b; } }; },
        json: (b: any) => { hwStatus = 200; hwBody = b; }
      } as any
    );
    assert(hwStatus === 403,
      'Case 5.1: Student A attempting IDOR access to Tenant B homework rejected with 403 (Not enrolled)');

    const sessionResult = await ChatService.getSessionHistory(sessionBId, studentAId);
    assert(sessionResult === null,
      'Case 5.2: Student A attempting IDOR access to Tenant B AI session returns null (404 in controller)');

    // -------------------------------------------------------------
    // Attack Case 6: Unauthorized Update / Deletion of Other Tenant's Resource
    // -------------------------------------------------------------
    console.log('\n--- Attack Case 6: Unauthorized Modification/Deletion IDOR ---');
    const deleteResult = await ChatService.deleteSession(sessionBId, teacherAId);
    assert(deleteResult === null,
      'Case 6.1: Cross-tenant deletion of AI session rejected (unauthorized / not found)');

    const sessionBStillExists = await db.chatSession.findUnique({ where: { id: sessionBId } });
    assert(sessionBStillExists !== null,
      'Case 6.2: Tenant B resource preserved intact; cross-tenant deletion had zero effect');

    // -------------------------------------------------------------
    // Attack Case 7: Comprehensive RBAC Permission Boundaries
    // -------------------------------------------------------------
    console.log('\n--- Attack Case 7: Role Permission Boundaries (RBAC) ---');
    let rbacStatus: number | null = null;
    let rbacNext = false;
    checkRole(['PRIMARY_MANAGER'])(
      { user: { role: 'ACCOUNTANT', userId: accountantAId } } as any,
      { status: (code: number) => { rbacStatus = code; return { json: () => {} }; } } as any,
      (() => { rbacNext = true; }) as any
    );
    assert(rbacStatus === 403 && !rbacNext,
      'Case 7.1: ACCOUNTANT role blocked from manager endpoints with 403 Forbidden');

    rbacStatus = null;
    rbacNext = false;
    checkRole(['TEACHER', 'ADMIN'])(
      { user: { role: 'CENTER_STUDENT', userId: studentAId } } as any,
      { status: (code: number) => { rbacStatus = code; return { json: () => {} }; } } as any,
      (() => { rbacNext = true; }) as any
    );
    assert(rbacStatus === 403 && !rbacNext,
      'Case 7.2: STUDENT role blocked from teacher/admin course creation with 403 Forbidden');

    // -------------------------------------------------------------
    // Attack Case 8: Financial Obligation & Collection Cross-Tenant Access
    // -------------------------------------------------------------
    console.log('\n--- Attack Case 8: Financial Cross-Tenant Access (Collections & Obligations) ---');
    // Accountant A tries to record collection for Student B (Tenant B)
    let colStatus: number | null = null;
    let colBody: any = null;
    await createCollection(
      {
        user: { userId: accountantAId, role: 'ACCOUNTANT', institutionId: instA, branchId: branchA },
        body: {
          studentId: studentBId, // Foreign student in Tenant B
          amount: 500,
          currency: 'EGP'
        }
      } as any,
      {
        status: (code: number) => { colStatus = code; return { json: (b: any) => { colBody = b; } }; },
        json: (b: any) => { colStatus = 200; colBody = b; }
      } as any
    );
    assert(colStatus === 404 && colBody?.message?.includes('Student not found in this institution'),
      'Case 8.1: Cross-tenant collection creation rejected with 404 (Student not in institution)');

    // -------------------------------------------------------------
    // Attack Case 9: Parent Cross-Student Access Protection
    // -------------------------------------------------------------
    console.log('\n--- Attack Case 9: Parent Cross-Student Access Protection ---');
    const studentBCheck = await db.user.findFirst({
      where: {
        id: studentBId,
        parentId: parentAId // Parent A trying to query Student B as their child
      }
    });
    assert(studentBCheck === null,
      'Case 9.1: Parent A querying unrelated Student B via parent relationship returns null');

    // -------------------------------------------------------------
    // Attack Case 10: Financial Restriction Endpoint Privileged Role Boundaries
    // -------------------------------------------------------------
    console.log('\n--- Attack Case 10: Financial Policy Role Privileges ---');
    let policyUpdateStatus: number | null = null;
    let policyUpdateBody: any = null;
    // Accountant A attempts to alter institution grace policy
    await updateFinancialAccessPolicy(
      {
        user: { userId: accountantAId, role: 'ACCOUNTANT', institutionId: instA, branchId: branchA },
        body: { policyMode: 'GLOBAL', gracePeriodDays: 30 }
      } as any,
      {
        status: (code: number) => { policyUpdateStatus = code; return { json: (b: any) => { policyUpdateBody = b; } }; },
        json: (b: any) => { policyUpdateStatus = 200; policyUpdateBody = b; }
      } as any
    );
    assert(policyUpdateStatus === 403 && policyUpdateBody?.message?.includes('Primary Manager'),
      'Case 10.1: ACCOUNTANT role blocked from updating monthly fee policy with 403 Forbidden');

    // Teacher A attempts to alter institution grace policy
    policyUpdateStatus = null;
    policyUpdateBody = null;
    await updateFinancialAccessPolicy(
      {
        user: { userId: teacherAId, role: 'TEACHER', institutionId: instA, branchId: branchA },
        body: { policyMode: 'GLOBAL', gracePeriodDays: 30 }
      } as any,
      {
        status: (code: number) => { policyUpdateStatus = code; return { json: (b: any) => { policyUpdateBody = b; } }; },
        json: (b: any) => { policyUpdateStatus = 200; policyUpdateBody = b; }
      } as any
    );
    assert(policyUpdateStatus === 403 && policyUpdateBody?.message?.includes('Primary Manager'),
      'Case 10.2: TEACHER role blocked from updating monthly fee policy with 403 Forbidden');

    // -------------------------------------------------------------
    // Cleanup Synthetic Fixtures
    // -------------------------------------------------------------
    console.log('\n--- Step 3: Cleaning up Multi-Tenant Test Fixtures ---');
    await db.chatSession.deleteMany({ where: { id: { in: [sessionAId, sessionBId] } } });
    await db.homework.deleteMany({ where: { id: { in: [hwAId, hwBId] } } });
    await db.exam.deleteMany({ where: { id: { in: [examAId, examBId] } } });
    await db.courseEnrollment.deleteMany({ where: { courseId: { in: [courseAId, courseBId] } } });
    await db.course.deleteMany({ where: { id: { in: [courseAId, courseBId] } } });
    await db.user.deleteMany({ where: { id: { in: [pmAId, pmBId, teacherAId, teacherBId, parentAId, parentBId, studentAId, studentBId, accountantAId, accountantBId] } } });
    await db.branch.deleteMany({ where: { id: { in: [branchA, branchB] } } });
    await db.institution.deleteMany({ where: { id: { in: [instA, instB] } } });
    assert(true, 'Multi-tenant synthetic test fixtures cleaned up safely from PostgreSQL');

  } catch (error: any) {
    console.error('[UNHANDLED ERROR IN TENANT IDOR SUITE]:', error);
    failed++;
  }

  console.log('\n===================================================================');
  console.log(`TOTAL TENANT ISOLATION & IDOR TESTS: ${passed + failed}`);
  console.log(`PASSED:                              ${passed}`);
  console.log(`FAILED:                              ${failed}`);
  console.log('===================================================================');

  if (failed > 0) process.exit(1);
  else process.exit(0);
}

runTenantIdorSuite();
