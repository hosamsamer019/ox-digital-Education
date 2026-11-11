/**
 * OX-DIGITAL Education — Accountant Disbursement Counter & Parent Children Backend Suite (Mock DB)
 *
 * Covers Phase C & Phase D backend requirements:
 * 1. APPROVED and undisbursed (disbursedAt=null, disbursedById=null) -> counted.
 * 2. APPROVED with non-null disbursedAt -> excluded by backend WHERE & aggregate.
 * 3. APPROVED with non-null disbursedById -> excluded by backend WHERE & aggregate.
 * 4. APPLIED / PENDING_APPROVAL / REJECTED / DRAFT -> excluded from APPROVED disbursement query.
 * 5. Successful disburseExpenseVoucher immediately removes voucher from subsequent APPROVED count.
 * 6. Cross-branch and unassigned-branch accountant denials (403) + cross-institution denial.
 * 7. Aggregate summary.totalCount / pagination.total consistency with >50 vouchers (55 actionable -> page 50, totalCount 55).
 * 8. Parent getParentChildren authorization, deletedAt filtering, and cross-parent isolation.
 */

process.env.DATABASE_URL = 'postgresql://ox_digital_dev:ox_digital_dev@127.0.0.1:5433/ox_digital_dev_test?schema=public';
process.env.JWT_SECRET = 'test-jwt-secret-ox-digital-test-key-32chars';

const INST_1 = '11111111-1111-4111-8111-000000000001';
const INST_2 = '22222222-2222-4222-8222-000000000002';
const BRANCH_1 = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const BRANCH_2 = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const BRANCH_INST2 = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';

const VOUCHERS = new Map<string, any>();
const CASHBOXES = new Map<string, any>([
  ['cb-1', { id: 'cb-1', institutionId: INST_1, branchId: BRANCH_1, name: 'Main Cashbox', code: 'CB-01', currentBalance: 50000, status: 'ACTIVE', deletedAt: null }]
]);

function seedVouchers() {
  VOUCHERS.clear();
  // 1. Valid actionable approved voucher in Branch 1
  VOUCHERS.set('v-actionable-1', {
    id: 'v-actionable-1',
    institutionId: INST_1,
    branchId: BRANCH_1,
    voucherNumber: 'EXP-202611-0001',
    category: 'UTILITIES',
    payeeName: 'Power Co',
    amount: 500,
    description: 'Electricity',
    paymentSource: 'CASHBOX',
    cashboxId: 'cb-1',
    status: 'APPROVED',
    preparedById: 'prep-1',
    approvedById: 'mgr-1',
    disbursedAt: null,
    disbursedById: null,
    createdAt: new Date('2026-11-10T10:00:00Z')
  });
  // 2. Anomaly: APPROVED but disbursedAt is set -> MUST be excluded by backend
  VOUCHERS.set('v-disbursed-at', {
    id: 'v-disbursed-at',
    institutionId: INST_1,
    branchId: BRANCH_1,
    voucherNumber: 'EXP-202611-0002',
    category: 'UTILITIES',
    payeeName: 'Water Co',
    amount: 200,
    description: 'Water',
    paymentSource: 'CASHBOX',
    status: 'APPROVED',
    preparedById: 'prep-1',
    disbursedAt: new Date('2026-11-10T11:00:00Z'),
    disbursedById: null,
    createdAt: new Date('2026-11-10T09:00:00Z')
  });
  // 3. Anomaly: APPROVED but disbursedById is set -> MUST be excluded by backend
  VOUCHERS.set('v-disbursed-by', {
    id: 'v-disbursed-by',
    institutionId: INST_1,
    branchId: BRANCH_1,
    voucherNumber: 'EXP-202611-0003',
    category: 'SUPPLIES',
    payeeName: 'Paper Co',
    amount: 300,
    description: 'Paper',
    paymentSource: 'CASHBOX',
    status: 'APPROVED',
    preparedById: 'prep-1',
    disbursedAt: null,
    disbursedById: 'acc-1',
    createdAt: new Date('2026-11-10T08:00:00Z')
  });
  // 4. Already APPLIED
  VOUCHERS.set('v-applied', {
    id: 'v-applied',
    institutionId: INST_1,
    branchId: BRANCH_1,
    voucherNumber: 'EXP-202611-0004',
    status: 'APPLIED',
    amount: 100,
    disbursedAt: new Date(),
    disbursedById: 'acc-1',
    createdAt: new Date()
  });
  // 5. PENDING_APPROVAL
  VOUCHERS.set('v-pending', {
    id: 'v-pending',
    institutionId: INST_1,
    branchId: BRANCH_1,
    voucherNumber: 'EXP-202611-0005',
    status: 'PENDING_APPROVAL',
    amount: 400,
    disbursedAt: null,
    disbursedById: null,
    createdAt: new Date()
  });
  // 6. REJECTED & DRAFT
  VOUCHERS.set('v-rejected', {
    id: 'v-rejected',
    institutionId: INST_1,
    branchId: BRANCH_1,
    voucherNumber: 'EXP-202611-0006',
    status: 'REJECTED',
    amount: 150,
    disbursedAt: null,
    disbursedById: null,
    createdAt: new Date()
  });
  // 7. Branch 2 (same inst) & Foreign Inst
  VOUCHERS.set('v-branch-2', {
    id: 'v-branch-2',
    institutionId: INST_1,
    branchId: BRANCH_2,
    voucherNumber: 'EXP-202611-0007',
    status: 'APPROVED',
    amount: 600,
    disbursedAt: null,
    disbursedById: null,
    createdAt: new Date()
  });
  VOUCHERS.set('v-inst-2', {
    id: 'v-inst-2',
    institutionId: INST_2,
    branchId: BRANCH_INST2,
    voucherNumber: 'EXP-202611-0008',
    status: 'APPROVED',
    amount: 700,
    disbursedAt: null,
    disbursedById: null,
    createdAt: new Date()
  });
}

const USERS = [
  { id: 'child-1', parentId: 'parent-1', name: 'Child One', email: 'c1@ox.edu', role: 'ONLINE_STUDENT', deletedAt: null },
  { id: 'child-2', parentId: 'parent-1', name: 'Child Two', email: 'c2@ox.edu', role: 'CENTER_STUDENT', deletedAt: null },
  { id: 'child-deleted', parentId: 'parent-1', name: 'Deleted Child', email: 'cd@ox.edu', role: 'ONLINE_STUDENT', deletedAt: new Date() },
  { id: 'child-other', parentId: 'parent-2', name: 'Other Child', email: 'co@ox.edu', role: 'ONLINE_STUDENT', deletedAt: null },
];

function filterVouchers(where: any) {
  return Array.from(VOUCHERS.values()).filter((v) => {
    if (where.institutionId && v.institutionId !== where.institutionId) return false;
    if (where.branchId && v.branchId !== where.branchId) return false;
    if (where.status && v.status !== where.status) return false;
    if (where.disbursedAt === null && v.disbursedAt !== null) return false;
    if (where.disbursedById === null && v.disbursedById !== null) return false;
    return true;
  });
}

const mockDb: any = {
  branch: {
    findUnique: async ({ where }: any) => {
      if (where.id === BRANCH_1) return { id: BRANCH_1, institutionId: INST_1, name: 'Branch 1', code: 'B1' };
      if (where.id === BRANCH_2) return { id: BRANCH_2, institutionId: INST_1, name: 'Branch 2', code: 'B2' };
      if (where.id === BRANCH_INST2) return { id: BRANCH_INST2, institutionId: INST_2, name: 'Inst2 Branch', code: 'B3' };
      return null;
    }
  },
  expenseVoucher: {
    findMany: async ({ where, skip = 0, take = 50 }: any) => {
      return filterVouchers(where).slice(skip, skip + take);
    },
    count: async ({ where }: any) => filterVouchers(where).length,
    aggregate: async ({ where }: any) => {
      const matches = filterVouchers(where);
      const sum = matches.reduce((acc, v) => acc + Number(v.amount || 0), 0);
      return { _sum: { amount: sum }, _count: { id: matches.length } };
    },
    findFirst: async ({ where }: any) => {
      const v = VOUCHERS.get(where.id);
      if (!v) return null;
      if (where.institutionId && v.institutionId !== where.institutionId) return null;
      return v;
    },
    update: async ({ where, data }: any) => {
      const existing = VOUCHERS.get(where.id);
      const updated = { ...existing, ...data };
      VOUCHERS.set(where.id, updated);
      return updated;
    }
  },
  cashbox: {
    findFirst: async ({ where }: any) => {
      const cb = CASHBOXES.get(where.id);
      if (!cb || cb.institutionId !== where.institutionId || cb.branchId !== where.branchId || cb.deletedAt !== null) return null;
      return cb;
    },
    update: async ({ where, data }: any) => {
      const cb = CASHBOXES.get(where.id);
      if (data.currentBalance?.decrement) {
        cb.currentBalance -= data.currentBalance.decrement;
      }
      return cb;
    }
  },
  cashboxTransaction: {
    create: async ({ data }: any) => ({ id: 'tx-1', ...data })
  },
  notification: {
    create: async ({ data }: any) => ({ id: 'notif-1', ...data })
  },
  user: {
    findMany: async ({ where }: any) => {
      return USERS.filter((u) => {
        if (where.parentId && u.parentId !== where.parentId) return false;
        if (where.deletedAt === null && u.deletedAt !== null) return false;
        if (where.institutionId && (u as any).institutionId !== where.institutionId) return false;
        if (where.role?.in && !where.role.in.includes(u.role)) return false;
        return true;
      });
    },
    findUnique: async ({ where, include }: any) => {
      let base: any = null;
      if (where.id === 'parent-1') {
        base = { id: 'parent-1', role: 'PARENT', institutionId: INST_1, branchId: null };
      } else if (where.id === 'parent-2') {
        base = { id: 'parent-2', role: 'PARENT', institutionId: INST_1, branchId: null };
      }
      if (!base) return null;
      if (!include) return base;

      const childrenWhere = include.children?.where;
      const children = USERS.filter((u) => {
        if (u.parentId !== base.id) return false;
        if (childrenWhere?.deletedAt === null && u.deletedAt !== null) return false;
        return true;
      });
      return {
        ...base,
        branch: null,
        parent: null,
        children,
        studentTeacherLinks: []
      };
    }
  },
  $transaction: async (fn: any) => fn(mockDb)
};

(globalThis as any).prismaGlobal = mockDb;

import assert from 'assert';
import { listExpenseVouchers, disburseExpenseVoucher } from '../src/controllers/accounting/expenses.controller.js';
import { getParentChildren, getLinkedRelationships } from '../src/controllers/user.controller.js';

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

async function runSuite() {
  console.log('=== RUNNING BACKEND ACCOUNTING DISBURSEMENT & PARENT CHILDREN SUITE ===\n');
  let passed = 0;
  let failed = 0;

  const runTest = async (desc: string, fn: () => Promise<void>) => {
    try {
      await fn();
      console.log(`PASS: ${desc}`);
      passed++;
    } catch (err: any) {
      console.error(`FAIL: ${desc} -> ${err.message}`);
      failed++;
    }
  };

  await runTest('1. Accountant APPROVED list & summary count strictly exclude disbursedAt!=null, disbursedById!=null, APPLIED, PENDING_APPROVAL, REJECTED, and other branches', async () => {
    seedVouchers();
    const req: any = {
      user: { userId: 'acc-1', role: 'ACCOUNTANT', institutionId: INST_1, branchId: BRANCH_1 },
      query: { status: 'APPROVED' }
    };
    const res = createMockRes();
    await listExpenseVouchers(req, res);
    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.body.vouchers.length, 1);
    assert.strictEqual(res.body.vouchers[0].id, 'v-actionable-1');
    assert.strictEqual(res.body.summary.totalCount, 1);
    assert.strictEqual(res.body.pagination.total, 1);
  });

  await runTest('2. Successful disburseExpenseVoucher immediately drops actionable count from 1 to 0', async () => {
    seedVouchers();
    const disburseReq: any = {
      user: { userId: 'acc-1', role: 'ACCOUNTANT', institutionId: INST_1, branchId: BRANCH_1, email: 'acc1@ox.edu' },
      params: { id: 'v-actionable-1' },
      body: { cashboxId: 'cb-1' }
    };
    const disburseRes = createMockRes();
    await disburseExpenseVoucher(disburseReq, disburseRes);
    assert.strictEqual(disburseRes.statusCode, 200);
    assert.strictEqual(disburseRes.body.voucher.status, 'APPLIED');

    const listReq: any = {
      user: { userId: 'acc-1', role: 'ACCOUNTANT', institutionId: INST_1, branchId: BRANCH_1 },
      query: { status: 'APPROVED' }
    };
    const listRes = createMockRes();
    await listExpenseVouchers(listReq, listRes);
    assert.strictEqual(listRes.statusCode, 200);
    assert.strictEqual(listRes.body.vouchers.length, 0);
    assert.strictEqual(listRes.body.summary.totalCount, 0);
  });

  await runTest('3. Cross-branch accountant query & unassigned-branch accountant fail closed with 403', async () => {
    seedVouchers();
    const crossBranchReq: any = {
      user: { userId: 'acc-1', role: 'ACCOUNTANT', institutionId: INST_1, branchId: BRANCH_1 },
      query: { status: 'APPROVED', branchId: BRANCH_2 }
    };
    const res1 = createMockRes();
    await listExpenseVouchers(crossBranchReq, res1);
    assert.strictEqual(res1.statusCode, 403);

    const unassignedReq: any = {
      user: { userId: 'acc-unassigned', role: 'ACCOUNTANT', institutionId: INST_1, branchId: null },
      query: { status: 'APPROVED' }
    };
    const res2 = createMockRes();
    await listExpenseVouchers(unassignedReq, res2);
    assert.strictEqual(res2.statusCode, 403);
  });

  await runTest('4. Primary Manager PENDING_APPROVAL query scopes to institutionId and excludes foreign institution & APPROVED vouchers', async () => {
    seedVouchers();
    const req: any = {
      user: { userId: 'mgr-1', role: 'PRIMARY_MANAGER', institutionId: INST_1, isPrimaryManager: true },
      query: { status: 'PENDING_APPROVAL' }
    };
    const res = createMockRes();
    await listExpenseVouchers(req, res);
    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.body.summary.totalCount, 1);
    assert.strictEqual(res.body.vouchers[0].id, 'v-pending');
  });

  await runTest('5. Aggregate summary.totalCount remains exact when >50 actionable APPROVED vouchers exist', async () => {
    VOUCHERS.clear();
    for (let i = 1; i <= 55; i++) {
      VOUCHERS.set(`v-bulk-${i}`, {
        id: `v-bulk-${i}`,
        institutionId: INST_1,
        branchId: BRANCH_1,
        voucherNumber: `EXP-BULK-${i}`,
        status: 'APPROVED',
        amount: 100,
        disbursedAt: null,
        disbursedById: null,
        createdAt: new Date()
      });
    }
    const req: any = {
      user: { userId: 'acc-1', role: 'ACCOUNTANT', institutionId: INST_1, branchId: BRANCH_1 },
      query: { status: 'APPROVED' }
    };
    const res = createMockRes();
    await listExpenseVouchers(req, res);
    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.body.vouchers.length, 50);
    assert.strictEqual(res.body.summary.totalCount, 55);
    assert.strictEqual(res.body.pagination.total, 55);
  });

  await runTest('6. Parent getParentChildren returns only active children belonging to authenticated parent and denies non-parents', async () => {
    const reqParent1: any = { user: { userId: 'parent-1', role: 'PARENT' } };
    const res1 = createMockRes();
    await getParentChildren(reqParent1, res1);
    assert.strictEqual(res1.statusCode, 200);
    assert.strictEqual(res1.body.length, 2, 'Excludes soft-deleted child and parent-2 child');
    assert.deepStrictEqual(res1.body.map((c: any) => c.id), ['child-1', 'child-2']);

    const reqParentEmpty: any = { user: { userId: 'parent-no-kids', role: 'PARENT' } };
    const resEmpty = createMockRes();
    await getParentChildren(reqParentEmpty, resEmpty);
    assert.strictEqual(resEmpty.statusCode, 200);
    assert.strictEqual(resEmpty.body.length, 0);

    const reqNonParent: any = { user: { userId: 'parent-1', role: 'TEACHER' } };
    const resForbidden = createMockRes();
    await getParentChildren(reqNonParent, resForbidden);
    assert.strictEqual(resForbidden.statusCode, 403);

    const reqUnauth: any = { user: undefined, query: { parentId: 'parent-1' } };
    const resUnauth = createMockRes();
    await getParentChildren(reqUnauth, resUnauth);
    assert.strictEqual(resUnauth.statusCode, 401);

    const reqTamper: any = { user: { userId: 'parent-1', role: 'PARENT' }, query: { parentId: 'parent-2' } };
    const resTamper = createMockRes();
    await getParentChildren(reqTamper, resTamper);
    assert.strictEqual(resTamper.statusCode, 200);
    assert.deepStrictEqual(resTamper.body.map((c: any) => c.id), ['child-1', 'child-2']);
  });

  await runTest('7. getLinkedRelationships excludes soft-deleted children and enforces cross-parent isolation', async () => {
    const reqParent1: any = { user: { userId: 'parent-1', role: 'PARENT' } };
    const res1 = createMockRes();
    await getLinkedRelationships(reqParent1, res1);
    assert.strictEqual(res1.statusCode, 200);
    assert.strictEqual(res1.body.success, true);
    assert.deepStrictEqual(
      res1.body.data.children.map((c: any) => c.id),
      ['child-1', 'child-2'],
      'getLinkedRelationships must exclude soft-deleted child-deleted and foreign child-other'
    );

    const reqParent2: any = { user: { userId: 'parent-2', role: 'PARENT' }, query: { userId: 'parent-1' } };
    const res2 = createMockRes();
    await getLinkedRelationships(reqParent2, res2);
    assert.strictEqual(res2.statusCode, 200);
    assert.deepStrictEqual(res2.body.data.children.map((c: any) => c.id), ['child-other']);
  });

  console.log(`\nACCOUNTING & PARENT BACKEND RESULTS: ${passed} PASSED, ${failed} FAILED`);
  if (failed > 0) process.exit(1);
}

runSuite().catch((err) => {
  console.error('Unhandled suite error:', err);
  process.exit(1);
});
