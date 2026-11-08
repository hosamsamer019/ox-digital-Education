import { runTenancyBackfill, BackfillMappingConfig } from '../../scripts/backfill_task_7_1_tenancy.js';

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

async function runBackfillValidationTests() {
  console.log('===================================================================');
  console.log('OX-DIGITAL Task 7.1 — Remediation G Backfill Simulation Tests');
  console.log('===================================================================\n');

  // Test 1: Fail Closed When No Authoritative Mapping is Supplied
  console.log('--- Test 1: Fail-Closed When Mapping is Missing ---');
  let missingMappingBlocked = false;
  try {
    await runTenancyBackfill({} as any, { dryRun: true });
  } catch (e: any) {
    if (e.message.includes('FATAL_MISSING_TENANT_MAPPING')) {
      missingMappingBlocked = true;
    }
  }
  assert(missingMappingBlocked === true, 'Backfill fails closed when authoritative mapping is omitted');

  // Authoritative approved mapping input
  const validApprovedMapping: BackfillMappingConfig = {
    formatVersion: '1.0.0',
    datasetId: 'SYNTH-STAGE-7.1-V1',
    approvedBy: 'Product Owner',
    approvedAt: '2026-11-02T20:00:00Z',
    institutions: [
      {
        targetInstitutionId: 'inst-approved-001',
        targetInstitutionName: 'Cairo Mathematics Academy',
        targetInstitutionCode: 'CMA-MAIN',
        defaultBranchId: 'branch-approved-001',
        defaultBranchName: 'Nasr City Campus',
        defaultBranchCode: 'CMA-NASR',
        onlineBranchId: 'branch-approved-002',
        onlineBranchName: 'Online Learning Hub',
        onlineBranchCode: 'CMA-ONLINE',
        matchCriteria: {
          teacherIds: ['user-teacher-1'],
          centerGroupIds: ['cg-1'],
          userIds: ['user-student-1'],
          courseIds: ['course-1']
        }
      }
    ]
  };

  // Construct in-memory mock PrismaClient
  const mockState: any = {
    institutions: [],
    branches: [],
    users: [
      { id: 'user-admin', email: 'admin@edu.com', role: 'ADMIN', institutionId: null, branchId: null, isPrimaryManager: false },
      { id: 'user-student-1', email: 'student1@school.edu', role: 'STUDENT', institutionId: null, branchId: null },
      { id: 'user-teacher-1', email: 'teacher1@school.edu', role: 'TEACHER', institutionId: null, branchId: null },
      { id: 'user-unmapped-orphan', email: 'orphan@other.edu', role: 'STUDENT', institutionId: null, branchId: null }
    ],
    centerGroups: [
      { id: 'cg-1', name: 'Group Alpha', institutionId: null, branchId: null }
    ],
    courses: [
      { id: 'course-1', title: 'Math 101', teacherId: 'user-teacher-1', institutionId: null, branchId: null },
      { id: 'course-unmapped', title: 'Unknown Course', teacherId: 'unknown-teacher', institutionId: null, branchId: null }
    ],
    payments: [
      { id: 'pay-1', userId: 'user-student-1', amount: 100, institutionId: null, branchId: null },
      { id: 'pay-unmapped', userId: 'unknown-user', amount: 50, institutionId: null, branchId: null }
    ],
    questionBanks: [
      { id: 'qb-1', name: 'Algebra Questions', institutionId: null }
    ],
    processedMedia: [
      { id: 'media-linked', lessonId: 'lesson-1', institutionId: null, originalUrl: 'https://example.com/1.mp4' },
      { id: 'media-orphan', lessonId: null, institutionId: null, originalUrl: 'https://example.com/orphan.mp4' }
    ],
    attendance: [
      { id: 'att-1', studentId: 'user-student-1' },
      { id: 'att-2', studentId: 'user-student-1' }
    ],
    quarantineLog: []
  };

  const mockPrisma: any = {
    user: {
      count: async () => mockState.users.length,
      findMany: async () => mockState.users.map((u: any) => ({ ...u })),
      update: async ({ where, data }: any) => {
        const u = mockState.users.find((x: any) => x.id === where.id);
        if (u) Object.assign(u, data);
        return u;
      }
    },
    centerGroup: {
      count: async () => mockState.centerGroups.length,
      findMany: async () => mockState.centerGroups.map((cg: any) => ({ ...cg })),
      update: async ({ where, data }: any) => {
        const cg = mockState.centerGroups.find((x: any) => x.id === where.id);
        if (cg) Object.assign(cg, data);
        return cg;
      }
    },
    course: {
      count: async () => mockState.courses.length,
      findMany: async () => mockState.courses.map((c: any) => ({ ...c })),
      update: async ({ where, data }: any) => {
        const c = mockState.courses.find((x: any) => x.id === where.id);
        if (c) Object.assign(c, data);
        return c;
      }
    },
    payment: {
      count: async () => mockState.payments.length,
      findMany: async () => mockState.payments.map((p: any) => ({ ...p })),
      update: async ({ where, data }: any) => {
        const p = mockState.payments.find((x: any) => x.id === where.id);
        if (p) Object.assign(p, data);
        return p;
      }
    },
    questionBank: {
      count: async () => mockState.questionBanks.length,
      findMany: async () => mockState.questionBanks.map((qb: any) => ({ ...qb })),
      update: async ({ where, data }: any) => {
        const qb = mockState.questionBanks.find((x: any) => x.id === where.id);
        if (qb) Object.assign(qb, data);
        return qb;
      }
    },
    processedMedia: {
      count: async () => mockState.processedMedia.length,
      findMany: async () => mockState.processedMedia.map((m: any) => ({ ...m })),
      update: async ({ where, data }: any) => {
        const m = mockState.processedMedia.find((x: any) => x.id === where.id);
        if (m) Object.assign(m, data);
        return m;
      }
    },
    attendance: {
      count: async () => mockState.attendance.length
    },
    institution: {
      upsert: async ({ create }: any) => {
        mockState.institutions.push(create);
        return create;
      }
    },
    branch: {
      upsert: async ({ create }: any) => {
        mockState.branches.push(create);
        return create;
      }
    },
    $executeRawUnsafe: async (query: string, ...args: any[]) => {
      mockState.quarantineLog.push(args);
      return 1;
    }
  };

  // Test 2: Dry-Run Mode Execution with Valid Mapping
  console.log('\n--- Test 2: Dry-Run Mode Execution (Strictly Read-Only) ---');
  const dryRunSummary = await runTenancyBackfill(mockPrisma, {
    dryRun: true,
    mappingConfig: validApprovedMapping
  });

  assert(dryRunSummary.dryRun === true, 'dryRunSummary correctly reflects dryRun=true');
  assert(dryRunSummary.overallStatus === 'PASS', 'Dry-run reconciliation passes');
  assert(dryRunSummary.counts.usersMigrated === 2, 'Maps 2 matching users to approved institution');
  assert(dryRunSummary.counts.usersQuarantined === 1, 'Quarantines 1 unmapped legacy user without synthetic assignment');
  assert(dryRunSummary.counts.coursesQuarantined === 1, 'Quarantines 1 unmapped course without synthetic assignment');
  assert(dryRunSummary.counts.paymentsQuarantined === 1, 'Quarantines 1 unmapped payment without synthetic assignment');
  assert(dryRunSummary.counts.processedMediaQuarantined === 1, 'Quarantines 1 orphan media (OD-720)');
  assert(mockState.institutions.length === 0, 'Dry-run does NOT create database records (Strictly Read-Only)');

  // Test 3: Live Execution Simulation with Valid Mapping
  console.log('\n--- Test 3: Live Execution Simulation ---');
  const liveSummary = await runTenancyBackfill(mockPrisma, {
    dryRun: false,
    mappingConfig: validApprovedMapping
  });

  assert(liveSummary.dryRun === false, 'liveSummary correctly reflects dryRun=false');
  assert(liveSummary.overallStatus === 'PASS', 'Live execution reconciliation passes');

  const adminUser = mockState.users.find((u: any) => u.email === 'admin@edu.com');
  assert(adminUser.institutionId === null, 'admin@edu.com has null institutionId (Super-Admin isolation)');
  assert(adminUser.isPrimaryManager === false, 'admin@edu.com has isPrimaryManager=false');

  const mappedStudent = mockState.users.find((u: any) => u.id === 'user-student-1');
  assert(mappedStudent.institutionId === 'inst-approved-001', 'Approved user assigned to target institution');

  const unmappedUser = mockState.users.find((u: any) => u.id === 'user-unmapped-orphan');
  assert(unmappedUser.institutionId === null, 'Unmapped user remains null institutionId (quarantined)');

  // Payment 100% row preservation check
  assert(mockState.payments.length === 2, 'All payment records preserved 100% (zero deletions OD-708)');
  const mappedPay = mockState.payments.find((p: any) => p.id === 'pay-1');
  assert(mappedPay.branchId === null, 'Payment branchId kept null (unprovable historical branch)');

  console.log('\n===================================================================');
  console.log(`RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('===================================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runBackfillValidationTests().catch(err => {
  console.error('Test execution error:', err);
  process.exit(1);
});
