process.env.DATABASE_URL = 'postgresql://postgres:postgres@127.0.0.1:5433/ox_digital_dev_test';
process.env.DIRECT_URL = 'postgresql://postgres:postgres@127.0.0.1:5433/ox_digital_dev_test';
process.env.JWT_SECRET = 'test-jwt-secret-ox-digital-dev';

import { BrdSubscriptionController } from '../src/controllers/brdSubscription.controller.js';
import { getUsers, updateUser } from '../src/controllers/user.controller.js';
import { isAuthorizedPrimaryManager } from '../src/middlewares/auth.middleware.js';
import { resolveAccountingReportScope } from '../src/utils/accountingScope.util.js';
import { tenantContextMiddleware, assertTenantAccess, assertBranchAccess } from '../../../packages/shared/src/tenant/tenantContext.js';
import { disburseExpenseVoucher } from '../src/controllers/accounting/expenses.controller.js';
import { getReceiptDetails } from '../src/controllers/accounting/receipts.controller.js';
import { createCollection, getCollectionById } from '../src/controllers/accounting/collections.controller.js';
import { reconcileCashbox, getCashboxTransactions } from '../src/controllers/accounting/cashbox.controller.js';
import { createStudentAgreement, getStudentFinancialAccount } from '../src/controllers/accounting/pricing.controller.js';
import { db } from '../../../packages/database/src/index.js';
import zlib from 'zlib';

function createPngChunk(type: string, data: Buffer): Buffer {
  const lenBuf = Buffer.alloc(4);
  lenBuf.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const crcBuf = Buffer.from([0xae, 0x42, 0x60, 0x82]);
  return Buffer.concat([lenBuf, typeBuf, data, crcBuf]);
}

function createValid1x1Png(): Buffer {
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(1, 0);
  ihdrData.writeUInt32BE(1, 4);
  ihdrData.writeUInt8(8, 8);
  ihdrData.writeUInt8(2, 9);
  ihdrData.writeUInt8(0, 10);
  ihdrData.writeUInt8(0, 11);
  ihdrData.writeUInt8(0, 12);
  const ihdrChunk = createPngChunk('IHDR', ihdrData);
  const rawScanline = Buffer.from([0x00, 0xff, 0x00, 0x00]);
  const compressedScanline = zlib.deflateSync(rawScanline);
  const idatChunk = createPngChunk('IDAT', compressedScanline);
  const iendChunk = createPngChunk('IEND', Buffer.alloc(0));
  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

function createValid1x1Jpeg(): Buffer {
  return Buffer.from([
    0xff, 0xd8,
    0xff, 0xc0, 0x00, 0x11, 0x08, 0x00, 0x01, 0x00, 0x01, 0x03, 0x01, 0x11, 0x00, 0x02, 0x11, 0x01, 0x03, 0x11, 0x01,
    0xff, 0xda, 0x00, 0x0c, 0x03, 0x01, 0x00, 0x02, 0x11, 0x03, 0x11, 0x00, 0x3f, 0x00,
    0xbf, 0x00,
    0xff, 0xd9
  ]);
}

interface MockResponse {
  statusCode: number;
  data: any;
  headers: Record<string, string>;
  statusCodeSet: boolean;
  status(code: number): MockResponse;
  json(data: any): MockResponse;
  send(data: any): MockResponse;
  setHeader(name: string, value: string): MockResponse;
}

function createMockResponse(): MockResponse {
  const res: MockResponse = {
    statusCode: 200,
    statusCodeSet: false,
    data: null,
    headers: {},
    status(code: number) {
      this.statusCode = code;
      this.statusCodeSet = true;
      return this;
    },
    json(payload: any) {
      this.data = payload;
      return this;
    },
    send(payload: any) {
      this.data = payload;
      return this;
    },
    setHeader(name: string, value: string) {
      this.headers[name] = value;
      return this;
    }
  };
  return res;
}

let passedCount = 0;
let failedCount = 0;

function assert(condition: boolean, testName: string, detail?: string) {
  if (condition) {
    console.log(`  [PASS] ${testName}`);
    passedCount++;
  } else {
    console.error(`  [FAIL] ${testName} - Detail: ${detail}`);
    failedCount++;
  }
}

async function runCrossBranchBackendSecurityTests() {
  console.log('================================================================');
  console.log('OX-DIGITAL Education: Comprehensive Backend Security Unit Tests');
  console.log('Target: services/user-service controllers & security utilities');
  console.log('Mode: Strictly In-Memory Unit Testing (Zero Live DB Writes)');
  console.log('================================================================\n');

  // --------------------------------------------------------------------------
  // TEST 1: SEC-XB-01: Cross-Branch Accountant Receipts / Subscription Filter
  // --------------------------------------------------------------------------
  {
    console.log('Scenario 1 (SEC-XB-01): Accountant querying receipts of another branch');
    const req: any = {
      user: {
        userId: 'acc-dokki-001',
        role: 'ACCOUNTANT',
        branchId: 'branch-dokki-uuid'
      },
      query: {
        branchId: 'branch-nasr-city-uuid' // Cross-branch attempt
      }
    };
    const res = createMockResponse();

    await BrdSubscriptionController.getAccountantReceipts(req, res as any);

    assert(
      res.statusCode === 403,
      'SEC-XB-01 Status Code is HTTP 403 Forbidden',
      `Expected 403, got ${res.statusCode}`
    );
    assert(
      res.data?.message?.includes('Forbidden: Branch accountants are strictly restricted to their assigned branch.'),
      'SEC-XB-01 Rejection Message Enforces Branch Confinement',
      `Got message: "${res.data?.message}"`
    );
  }

  // --------------------------------------------------------------------------
  // TEST 2: SEC-XB-02: Accountant Accessing Receipt from Another Branch
  // --------------------------------------------------------------------------
  {
    console.log('\nScenario 2 (SEC-XB-02): Accountant accessing single receipt of another branch');
    
    // Mock db.branchSequentialReceipt.findUnique to return a receipt belonging to Branch Nasr City
    const originalFindUnique = db.branchSequentialReceipt.findUnique;
    (db.branchSequentialReceipt as any).findUnique = async () => ({
      id: 'rcpt-nasr-999',
      receiptNumber: 'RCPT-2026-0099',
      branchId: 'branch-nasr-city-uuid',
      studentId: 'student-001',
      student: { parentId: 'parent-001' },
      teacherId: 'teacher-001',
      amount: 1500
    });

    const req: any = {
      user: {
        userId: 'acc-dokki-001',
        role: 'ACCOUNTANT',
        branchId: 'branch-dokki-uuid'
      },
      params: {
        id: 'rcpt-nasr-999'
      }
    };
    const res = createMockResponse();

    try {
      await BrdSubscriptionController.getReceiptById(req, res as any);

      assert(
        res.statusCode === 403,
        'SEC-XB-02 Status Code is HTTP 403 Forbidden',
        `Expected 403, got ${res.statusCode}`
      );
      assert(
        res.data?.message?.includes('Forbidden: Receipt belongs to another branch'),
        'SEC-XB-02 Rejection Message Enforces Single-Branch Receipt Boundary',
        `Got message: "${res.data?.message}"`
      );
    } finally {
      (db.branchSequentialReceipt as any).findUnique = originalFindUnique;
    }
  }

  // --------------------------------------------------------------------------
  // TEST 3: SEC-XB-03: Teacher Self-Reassignment / Modifying branchId
  // --------------------------------------------------------------------------
  {
    console.log('\nScenario 3 (SEC-XB-03): Non-admin user (TEACHER) attempting to set/change branchId');
    const req: any = {
      user: {
        userId: 'teacher-001',
        role: 'TEACHER',
        isPrimaryManager: false
      },
      params: {
        id: 'teacher-001'
      },
      body: {
        name: 'Teacher Attempting Escalation',
        branchId: 'branch-dokki-uuid' // Forbidden field
      }
    };
    const res = createMockResponse();

    await updateUser(req, res as any);

    assert(
      res.statusCode === 403,
      'SEC-XB-03 Status Code is HTTP 403 Forbidden',
      `Expected 403, got ${res.statusCode}`
    );
    assert(
      res.data?.message?.includes('Only the canonical Primary Manager can modify academic profile, role, center group, or parent account associations/credentials'),
      'SEC-XB-03 Rejection Message Enforces Forbidden Fields Guard',
      `Got message: "${res.data?.message}"`
    );
  }

  // --------------------------------------------------------------------------
  // TEST 4: SEC-XB-04: Non-Primary-Manager Assigning Branch
  // --------------------------------------------------------------------------
  {
    console.log('\nScenario 4 (SEC-XB-04): Teacher invoking assignTeacherBranch endpoint');
    const req: any = {
      user: {
        userId: 'teacher-001',
        role: 'TEACHER',
        isPrimaryManager: false
      },
      params: {
        teacherId: 'teacher-002'
      },
      body: {
        branchId: 'branch-dokki-uuid'
      }
    };
    const res = createMockResponse();

    await BrdSubscriptionController.assignTeacherBranch(req, res as any);

    assert(
      res.statusCode === 403,
      'SEC-XB-04 Status Code is HTTP 403 Forbidden',
      `Expected 403, got ${res.statusCode}`
    );
    assert(
      res.data?.message === 'Forbidden',
      'SEC-XB-04 Rejection Message is "Forbidden"',
      `Got message: "${res.data?.message}"`
    );
  }

  // --------------------------------------------------------------------------
  // TEST 5: SEC-XB-05: Accountant with Null / Unassigned Branch
  // --------------------------------------------------------------------------
  {
    console.log('\nScenario 5 (SEC-XB-05): Unassigned Accountant attempting to query receipts');
    const req: any = {
      user: {
        userId: 'acc-unassigned-001',
        role: 'ACCOUNTANT',
        branchId: null // No branch assigned
      },
      query: {}
    };
    const res = createMockResponse();

    await BrdSubscriptionController.getAccountantReceipts(req, res as any);

    assert(
      res.statusCode === 403,
      'SEC-XB-05 Status Code is HTTP 403 Forbidden for Unassigned Accountant',
      `Expected 403, got ${res.statusCode}`
    );
    assert(
      res.data?.message?.includes('Accountant has no assigned branch'),
      'SEC-XB-05 Rejection Message Enforces Assigned Branch Prerequisite',
      `Got message: "${res.data?.message}"`
    );
  }

  // --------------------------------------------------------------------------
  // TEST 6: SEC-XB-06: Normal ADMIN without isPrimaryManager === true Rejection
  // --------------------------------------------------------------------------
  {
    console.log('\nScenario 6 (SEC-XB-06): Standard ADMIN without isPrimaryManager flag attempting assignTeacherBranch');
    const req: any = {
      user: {
        userId: 'admin-secondary-001',
        role: 'ADMIN',
        isPrimaryManager: false // Not the canonical Primary Manager!
      },
      params: {
        teacherId: 'teacher-002'
      },
      body: {
        branchId: 'branch-dokki-uuid'
      }
    };
    const res = createMockResponse();

    await BrdSubscriptionController.assignTeacherBranch(req, res as any);

    assert(
      res.statusCode === 403,
      'SEC-XB-06 Secondary ADMIN without isPrimaryManager is Rejected with HTTP 403',
      `Expected 403, got ${res.statusCode}`
    );
  }

  // --------------------------------------------------------------------------
  // TEST 7: SEC-XB-07: isAuthorizedPrimaryManager Dual-Condition Guard
  // --------------------------------------------------------------------------
  {
    console.log('\nScenario 7 (SEC-XB-07): Verification of isAuthorizedPrimaryManager invariant matrix');
    
    // Invariant: Requires BOTH (role === 'ADMIN' || role === 'PRIMARY_MANAGER') AND isPrimaryManager === true
    assert(
      isAuthorizedPrimaryManager({ role: 'ADMIN', isPrimaryManager: true, userId: 'u1', email: 'e1' }) === true,
      'ADMIN with isPrimaryManager === true is AUTHORIZED'
    );
    assert(
      isAuthorizedPrimaryManager({ role: 'PRIMARY_MANAGER', isPrimaryManager: true, userId: 'u2', email: 'e2' }) === true,
      'PRIMARY_MANAGER with isPrimaryManager === true is AUTHORIZED'
    );
    assert(
      isAuthorizedPrimaryManager({ role: 'ADMIN', isPrimaryManager: false, userId: 'u3', email: 'e3' }) === false,
      'ADMIN with isPrimaryManager === false is REJECTED'
    );
    assert(
      isAuthorizedPrimaryManager({ role: 'ACCOUNTANT', isPrimaryManager: true, userId: 'u4', email: 'e4' }) === false,
      'ACCOUNTANT with isPrimaryManager === true is REJECTED'
    );
    assert(
      isAuthorizedPrimaryManager({ role: 'TEACHER', isPrimaryManager: true, userId: 'u5', email: 'e5' }) === false,
      'TEACHER with isPrimaryManager === true is REJECTED'
    );
    assert(
      isAuthorizedPrimaryManager(undefined) === false,
      'Undefined user is REJECTED'
    );
  }

  // --------------------------------------------------------------------------
  // TEST 8: SEC-XB-08: Financial Accounting Scope Tampering
  // --------------------------------------------------------------------------
  {
    console.log('\nScenario 8 (SEC-XB-08): Accountant parameter tampering in resolveAccountingReportScope');
    
    const reqTampering: any = {
      user: {
        userId: 'acc-dokki-001',
        role: 'ACCOUNTANT',
        branchId: 'branch-dokki-uuid',
        institutionId: 'inst-001'
      },
      query: {
        branchId: 'branch-nasr-city-uuid' // Client tampering attempt
      }
    };

    const scopeTampering = await resolveAccountingReportScope(reqTampering);

    assert(
      scopeTampering.ok === false && scopeTampering.status === 403,
      'SEC-XB-08 resolveAccountingReportScope Rejects Query Parameter Tampering with HTTP 403',
      `Expected status 403, got ${scopeTampering.status}`
    );
    assert(
      scopeTampering.message?.includes('Forbidden: Branch accountants are strictly restricted to their assigned branch.'),
      'SEC-XB-08 Scope Guard Message Enforces Single-Branch Restriction'
    );

    // Unassigned accountant in accounting scope
    const reqUnassigned: any = {
      user: {
        userId: 'acc-unassigned-001',
        role: 'ACCOUNTANT',
        branchId: null,
        institutionId: 'inst-001'
      },
      query: {}
    };

    const scopeUnassigned = await resolveAccountingReportScope(reqUnassigned);

    assert(
      scopeUnassigned.ok === false && scopeUnassigned.status === 403,
      'SEC-XB-08 resolveAccountingReportScope Rejects Unassigned Accountant with HTTP 403',
      `Expected status 403, got ${scopeUnassigned.status}`
    );
  }

  // --------------------------------------------------------------------------
  // TEST 9: SEC-AV-01: Avatar Upload Pre-Allocation DoS Heap Guard
  // --------------------------------------------------------------------------
  {
    console.log('\nScenario 9 (SEC-AV-01): Avatar upload pre-allocation memory guard');
    
    // Create an oversized string (> 3MB)
    const oversizedBase64 = 'A'.repeat(3 * 1024 * 1024 + 10);
    const req: any = {
      user: { userId: 'user-001' },
      body: {
        mimeType: 'image/jpeg',
        base64Data: oversizedBase64
      }
    };
    const res = createMockResponse();

    await BrdSubscriptionController.uploadProfilePicture(req, res as any);

    assert(
      res.statusCode === 400,
      'SEC-AV-01 Oversized base64 string (>3MB) is rejected with HTTP 400 before allocation',
      `Expected 400, got ${res.statusCode}`
    );
    assert(
      res.data?.message?.includes('File size exceeds maximum permitted limit of 2 MB'),
      'SEC-AV-01 Rejection message enforces 2 MB limit'
    );
  }

  // --------------------------------------------------------------------------
  // TEST 10: SEC-AV-02: Avatar Upload Base64 Syntax and Canonical Validation
  // --------------------------------------------------------------------------
  {
    console.log('\nScenario 10 (SEC-AV-02): Avatar upload invalid base64 syntax rejection');
    
    const req: any = {
      user: { userId: 'user-001' },
      body: {
        mimeType: 'image/jpeg',
        base64Data: 'not-valid-base64!@#$%' // Invalid base64 characters
      }
    };
    const res = createMockResponse();

    await BrdSubscriptionController.uploadProfilePicture(req, res as any);

    assert(
      res.statusCode === 400,
      'SEC-AV-02 Invalid base64 characters rejected with HTTP 400',
      `Expected 400, got ${res.statusCode}`
    );
    assert(
      res.data?.message?.includes('Invalid or malformed base64 encoding'),
      'SEC-AV-02 Message states invalid base64 encoding'
    );
  }

  // --------------------------------------------------------------------------
  // TEST 11: SEC-AV-03: Avatar Binary Structural Checks & MIME Consistency
  // --------------------------------------------------------------------------
  {
    console.log('\nScenario 11 (SEC-AV-03): Image binary signature & structural completeness');

    // Case A: Forged JPEG (starts with 0xFF 0xD8 but truncated, missing 0xFF 0xD9 EOI)
    const forgedJpegBuffer = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x00, 0x00]);
    const reqA: any = {
      user: { userId: 'user-001' },
      body: {
        mimeType: 'image/jpeg',
        base64Data: forgedJpegBuffer.toString('base64')
      }
    };
    const resA = createMockResponse();

    await BrdSubscriptionController.uploadProfilePicture(reqA, resA as any);

    assert(
      resA.statusCode === 400,
      'SEC-AV-03 Truncated JPEG missing EOI marker is rejected with HTTP 400',
      `Expected 400, got ${resA.statusCode}`
    );
    assert(
      resA.data?.message?.includes('Missing EOI marker') || resA.data?.message?.includes('Invalid or forged JPEG content'),
      'SEC-AV-03 Rejection specifies forged JPEG content'
    );

    // Case B: MIME mismatch (PNG binary claiming to be JPEG)
    const validPngBuffer = createValid1x1Png();
    const reqB: any = {
      user: { userId: 'user-001' },
      body: {
        mimeType: 'image/jpeg', // Claims JPEG, but payload is PNG!
        base64Data: validPngBuffer.toString('base64')
      }
    };
    const resB = createMockResponse();

    await BrdSubscriptionController.uploadProfilePicture(reqB, resB as any);

    assert(
      resB.statusCode === 400,
      'SEC-AV-03 MIME mismatch (PNG payload submitted as JPEG) is rejected with HTTP 400',
      `Expected 400, got ${resB.statusCode}`
    );

    // Case C: Valid complete PNG binary
    const originalUpdate = db.user.update;
    (db.user as any).update = async () => ({ id: 'user-001', profilePictureUrl: '/api/users/avatars/test.png' });

    try {
      const reqC: any = {
        user: { userId: 'user-001' },
        body: {
          mimeType: 'image/png',
          base64Data: validPngBuffer.toString('base64')
        }
      };
      const resC = createMockResponse();

      await BrdSubscriptionController.uploadProfilePicture(reqC, resC as any);

      assert(
        resC.statusCode === 200 && resC.data?.success === true,
        'SEC-AV-03 Valid complete PNG with matching MIME is successfully accepted (HTTP 200)'
      );
      assert(
        resC.data?.profilePictureUrl?.startsWith('/api/users/avatars/avatar_user-001_'),
        'SEC-AV-03 Generates secure UUID avatar URL'
      );
      assert(
        resC.data?.dimensions?.width === 1 && resC.data?.dimensions?.height === 1,
        'SEC-AV-03 Genuine image decoding extracts authentic dimensions'
      );
    } finally {
      (db.user as any).update = originalUpdate;
    }

    // Case D: Valid complete JPEG binary
    (db.user as any).update = async () => ({ id: 'user-001', profilePictureUrl: '/api/users/avatars/test.jpg' });
    try {
      const validJpegBuffer = createValid1x1Jpeg();
      const reqD: any = {
        user: { userId: 'user-001' },
        body: {
          mimeType: 'image/jpeg',
          base64Data: validJpegBuffer.toString('base64')
        }
      };
      const resD = createMockResponse();

      await BrdSubscriptionController.uploadProfilePicture(reqD, resD as any);

      assert(
        resD.statusCode === 200 && resD.data?.success === true,
        'SEC-AV-03 Valid complete JPEG with matching MIME is successfully accepted (HTTP 200)'
      );
    } finally {
      (db.user as any).update = originalUpdate;
    }
  }

  // --------------------------------------------------------------------------
  // TEST 12: SEC-AV-04: Avatar Retrieval Traversal & Filename Safety
  // --------------------------------------------------------------------------
  {
    console.log('\nScenario 12 (SEC-AV-04): Avatar streaming filename validation & traversal defense');

    // Case A: Path traversal attempt
    const reqA: any = {
      params: { filename: '../../etc/passwd.jpg' }
    };
    const resA = createMockResponse();

    await BrdSubscriptionController.getAvatar(reqA, resA as any);

    assert(
      resA.statusCode === 400,
      'SEC-AV-04 Path traversal filename rejected with HTTP 400',
      `Expected 400, got ${resA.statusCode}`
    );

    // Case B: Non-avatar filename
    const reqB: any = {
      params: { filename: 'malicious.php' }
    };
    const resB = createMockResponse();

    await BrdSubscriptionController.getAvatar(reqB, resB as any);

    assert(
      resB.statusCode === 400,
      'SEC-AV-04 Invalid non-avatar filename format rejected with HTTP 400',
      `Expected 400, got ${resB.statusCode}`
    );
  }

  // --------------------------------------------------------------------------
  // TEST 13: SEC-XB-09: Expense Voucher Cross-Branch Disbursement Rejection
  // --------------------------------------------------------------------------
  {
    console.log('\nScenario 13 (SEC-XB-09): Accountant from Branch A attempting to disburse Branch B voucher');
    const originalFindFirst = (db as any).expenseVoucher.findFirst;
    (db as any).expenseVoucher.findFirst = async () => ({
      id: 'voucher-beta-001',
      voucherNumber: 'EXP-202611-0001',
      branchId: 'branch-beta-uuid',
      status: 'APPROVED',
      amount: 1500,
      paymentSource: 'CASHBOX',
      cashboxId: 'box-beta-uuid',
      preparedById: 'staff-001'
    });

    try {
      const req: any = {
        user: {
          userId: 'acc-alpha-001',
          role: 'ACCOUNTANT',
          branchId: 'branch-alpha-uuid',
          institutionId: 'inst-001'
        },
        params: { id: 'voucher-beta-001' },
        body: {}
      };
      const res = createMockResponse();

      await disburseExpenseVoucher(req, res as any);

      assert(
        res.statusCode === 403,
        'SEC-XB-09 Cross-branch expense voucher disbursement rejected with HTTP 403',
        `Expected 403, got ${res.statusCode}`
      );
      assert(
        res.data?.error === 'CROSS_BRANCH_ACCESS_DENIED',
        'SEC-XB-09 Error code is CROSS_BRANCH_ACCESS_DENIED'
      );
    } finally {
      (db as any).expenseVoucher.findFirst = originalFindFirst;
    }
  }

  // --------------------------------------------------------------------------
  // TEST 14: SEC-XB-10: Unassigned Accountant Expense Disbursement Rejection
  // --------------------------------------------------------------------------
  {
    console.log('\nScenario 14 (SEC-XB-10): Unassigned Accountant attempting voucher disbursement');
    const req: any = {
      user: {
        userId: 'acc-unassigned-001',
        role: 'ACCOUNTANT',
        branchId: null, // Unassigned
        institutionId: 'inst-001'
      },
      params: { id: 'voucher-alpha-001' },
      body: {}
    };
    const res = createMockResponse();

    await disburseExpenseVoucher(req, res as any);

    assert(
      res.statusCode === 403,
      'SEC-XB-10 Unassigned accountant voucher disbursement rejected with HTTP 403',
      `Expected 403, got ${res.statusCode}`
    );
    assert(
      res.data?.error === 'ACCOUNTANT_BRANCH_UNASSIGNED',
      'SEC-XB-10 Error code is ACCOUNTANT_BRANCH_UNASSIGNED'
    );
  }

  // --------------------------------------------------------------------------
  // TEST 15: SEC-XB-11: Receipts Detail Branch Isolation (Null Branch & Cross-Branch)
  // --------------------------------------------------------------------------
  {
    console.log('\nScenario 15 (SEC-XB-11): Receipts detail branch boundary enforcement');
    const originalFindCollection = (db as any).collection.findFirst;
    (db as any).collection.findFirst = async () => ({
      id: 'coll-beta-001',
      receiptNumber: 'REC-20261108-0001',
      branchId: 'branch-beta-uuid',
      status: 'COLLECTED',
      amountCollected: 500,
      allocatedAmount: 500,
      unallocatedAmount: 0,
      student: { id: 'student-beta-001', name: 'Beta Student' },
      tenders: [],
      allocations: []
    });

    try {
      // Case A: Unassigned accountant
      const reqA: any = {
        user: { userId: 'acc-unassigned-001', role: 'ACCOUNTANT', branchId: null, institutionId: 'inst-001' },
        params: { id: 'coll-beta-001' }
      };
      const resA = createMockResponse();
      await getReceiptDetails(reqA, resA as any);

      assert(
        resA.statusCode === 403 && resA.data?.error === 'ACCOUNTANT_BRANCH_UNASSIGNED',
        'SEC-XB-11 Unassigned accountant accessing receipt details rejected with HTTP 403 ACCOUNTANT_BRANCH_UNASSIGNED'
      );

      // Case B: Cross-branch accountant
      const reqB: any = {
        user: { userId: 'acc-alpha-001', role: 'ACCOUNTANT', branchId: 'branch-alpha-uuid', institutionId: 'inst-001' },
        params: { id: 'coll-beta-001' }
      };
      const resB = createMockResponse();
      await getReceiptDetails(reqB, resB as any);

      assert(
        resB.statusCode === 403 && resB.data?.error === 'CROSS_BRANCH_ACCESS_DENIED',
        'SEC-XB-11 Cross-branch accountant accessing receipt details rejected with HTTP 403 CROSS_BRANCH_ACCESS_DENIED'
      );
    } finally {
      (db as any).collection.findFirst = originalFindCollection;
    }
  }

  // --------------------------------------------------------------------------
  // TEST 16: SEC-XB-12: Collection Creation & Retrieval Branch Isolation
  // --------------------------------------------------------------------------
  {
    console.log('\nScenario 16 (SEC-XB-12): Collection creation & single collection branch boundary');
    const originalFindUser = (db as any).user.findFirst;
    (db as any).user.findFirst = async () => ({
      id: 'student-beta-001',
      name: 'Beta Student',
      branchId: 'branch-beta-uuid'
    });

    try {
      // Case A: Unassigned accountant creating collection
      const reqA: any = {
        user: { userId: 'acc-unassigned-001', role: 'ACCOUNTANT', branchId: null, institutionId: 'inst-001' },
        body: { studentId: 'student-beta-001', amount: 300 }
      };
      const resA = createMockResponse();
      await createCollection(reqA, resA as any);

      assert(
        resA.statusCode === 403 && resA.data?.error === 'ACCOUNTANT_BRANCH_UNASSIGNED',
        'SEC-XB-12 Unassigned accountant creating collection rejected with HTTP 403 ACCOUNTANT_BRANCH_UNASSIGNED'
      );

      // Case B: Accountant from Branch A attempting collection for student in Branch B
      const reqB: any = {
        user: { userId: 'acc-alpha-001', role: 'ACCOUNTANT', branchId: 'branch-alpha-uuid', institutionId: 'inst-001' },
        body: { studentId: 'student-beta-001', amount: 300 }
      };
      const resB = createMockResponse();
      await createCollection(reqB, resB as any);

      assert(
        resB.statusCode === 403 && resB.data?.error === 'CROSS_BRANCH_ACCESS_DENIED',
        'SEC-XB-12 Cross-branch student collection attempt rejected with HTTP 403 CROSS_BRANCH_ACCESS_DENIED'
      );
    } finally {
      (db as any).user.findFirst = originalFindUser;
    }
  }

  // --------------------------------------------------------------------------
  // TEST 17: SEC-XB-13: Cashbox Reconciliation & Ledger Branch Isolation
  // --------------------------------------------------------------------------
  {
    console.log('\nScenario 17 (SEC-XB-13): Cashbox operations branch boundary enforcement');
    const originalFindCashbox = (db as any).cashbox.findFirst;
    (db as any).cashbox.findFirst = async () => ({
      id: 'box-beta-001',
      branchId: 'branch-beta-uuid',
      currentBalance: 5000,
      currency: 'EGP'
    });

    try {
      // Case A: Unassigned accountant reconciling cashbox
      const reqA: any = {
        user: { userId: 'acc-unassigned-001', role: 'ACCOUNTANT', branchId: null, institutionId: 'inst-001' },
        params: { id: 'box-beta-001' },
        body: { actualCountedClosingBalance: 5000 }
      };
      const resA = createMockResponse();
      await reconcileCashbox(reqA, resA as any);

      assert(
        resA.statusCode === 403 && resA.data?.error === 'ACCOUNTANT_BRANCH_UNASSIGNED',
        'SEC-XB-13 Unassigned accountant reconciling cashbox rejected with HTTP 403 ACCOUNTANT_BRANCH_UNASSIGNED'
      );

      // Case B: Cross-branch accountant reconciling cashbox
      const reqB: any = {
        user: { userId: 'acc-alpha-001', role: 'ACCOUNTANT', branchId: 'branch-alpha-uuid', institutionId: 'inst-001' },
        params: { id: 'box-beta-001' },
        body: { actualCountedClosingBalance: 5000 }
      };
      const resB = createMockResponse();
      await reconcileCashbox(reqB, resB as any);

      assert(
        resB.statusCode === 403 && resB.data?.error === 'CROSS_BRANCH_ACCESS_DENIED',
        'SEC-XB-13 Cross-branch cashbox reconciliation rejected with HTTP 403 CROSS_BRANCH_ACCESS_DENIED'
      );

      // Case C: Cross-branch accountant viewing cashbox transactions ledger
      const reqC: any = {
        user: { userId: 'acc-alpha-001', role: 'ACCOUNTANT', branchId: 'branch-alpha-uuid', institutionId: 'inst-001' },
        params: { id: 'box-beta-001' },
        query: {}
      };
      const resC = createMockResponse();
      await getCashboxTransactions(reqC, resC as any);

      assert(
        resC.statusCode === 403 && resC.data?.error === 'CROSS_BRANCH_ACCESS_DENIED',
        'SEC-XB-13 Cross-branch cashbox transactions ledger access rejected with HTTP 403 CROSS_BRANCH_ACCESS_DENIED'
      );
    } finally {
      (db as any).cashbox.findFirst = originalFindCashbox;
    }
  }

  // --------------------------------------------------------------------------
  // TEST 18: SEC-AV-05: Non-Canonical Base64 Round-Trip Verification
  // --------------------------------------------------------------------------
  {
    console.log('\nScenario 18 (SEC-AV-05): Non-canonical base64 round-trip rejection');
    // "Zm8=" is canonical for "fo"
    // "Zm9=" has dirty bits in the padding byte
    const nonCanonicalBase64 = 'Zm9=';
    const req: any = {
      user: { userId: 'user-001' },
      body: {
        mimeType: 'image/png',
        base64Data: nonCanonicalBase64
      }
    };
    const res = createMockResponse();

    await BrdSubscriptionController.uploadProfilePicture(req, res as any);

    assert(
      res.statusCode === 400 && res.data?.error === 'NON_CANONICAL_BASE64',
      'SEC-AV-05 Non-canonical base64 rejected with HTTP 400 NON_CANONICAL_BASE64'
    );
  }

  // --------------------------------------------------------------------------
  // TEST 19: SEC-AV-06: Genuine Image Decoding & Corrupted Scanline Defense
  // --------------------------------------------------------------------------
  {
    console.log('\nScenario 19 (SEC-AV-06): Genuine image decoding & corrupted IDAT scanline defense');
    // Create a PNG that has valid signatures and valid IHDR, but corrupted IDAT payload that fails zlib inflate
    const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    const ihdrData = Buffer.alloc(13);
    ihdrData.writeUInt32BE(1, 0);
    ihdrData.writeUInt32BE(1, 4);
    ihdrData.writeUInt8(8, 8);
    ihdrData.writeUInt8(2, 9);
    const ihdrChunk = createPngChunk('IHDR', ihdrData);
    const corruptedIdatChunk = createPngChunk('IDAT', Buffer.from([0xde, 0xad, 0xbe, 0xef])); // Corrupted non-zlib data!
    const iendChunk = createPngChunk('IEND', Buffer.alloc(0));
    const corruptedPng = Buffer.concat([signature, ihdrChunk, corruptedIdatChunk, iendChunk]);

    const req: any = {
      user: { userId: 'user-001' },
      body: {
        mimeType: 'image/png',
        base64Data: corruptedPng.toString('base64')
      }
    };
    const res = createMockResponse();

    await BrdSubscriptionController.uploadProfilePicture(req, res as any);

    assert(
      res.statusCode === 400 && res.data?.error === 'CORRUPTED_OR_MALFORMED_IMAGE',
      'SEC-AV-06 Corrupted PNG IDAT decompression fails with HTTP 400 CORRUPTED_OR_MALFORMED_IMAGE'
    );
    assert(
      res.data?.message?.includes('PNG decompression failed'),
      'SEC-AV-06 Message specifies PNG decompression failure'
    );
  }

  // --------------------------------------------------------------------------
  // TEST 20: SEC-XB-14: Cross-Institution Teacher Assignment Rejection
  // --------------------------------------------------------------------------
  {
    console.log('\nScenario 20 (SEC-XB-14): Manager in Inst 1 attempting to assign teacher from Inst 2');
    
    // Mock target teacher belonging to institution 2
    (db.user as any).findUnique = async ({ where }: any) => {
      if (where.id === 'teacher-inst2') {
        return {
          id: 'teacher-inst2',
          role: 'TEACHER',
          institutionId: 'inst-002',
          branchId: null
        };
      }
      return null;
    };

    const req: any = {
      user: {
        userId: 'manager-inst1',
        role: 'PRIMARY_MANAGER',
        isPrimaryManager: true,
        institutionId: 'inst-001'
      },
      params: { teacherId: 'teacher-inst2' },
      body: { branchId: 'branch-dokki-uuid' }
    };
    const res = createMockResponse();

    await BrdSubscriptionController.assignTeacherBranch(req, res as any);

    assert(
      res.statusCode === 403,
      'SEC-XB-14 Cross-institution teacher assignment rejected with HTTP 403',
      `Expected 403, got ${res.statusCode}`
    );
  }

  // --------------------------------------------------------------------------
  // TEST 21: SEC-XB-15: Cross-Institution Branch Target Rejection
  // --------------------------------------------------------------------------
  {
    console.log('\nScenario 21 (SEC-XB-15): Manager in Inst 1 attempting to assign teacher to branch of Inst 2');
    
    // Mock target teacher belonging to institution 1
    (db.user as any).findUnique = async ({ where }: any) => {
      if (where.id === 'teacher-inst1') {
        return {
          id: 'teacher-inst1',
          role: 'TEACHER',
          institutionId: 'inst-001',
          branchId: null
        };
      }
      return null;
    };

    // Mock branch belonging to institution 2
    (db.branch as any).findUnique = async ({ where }: any) => {
      if (where.id === 'branch-inst2') {
        return {
          id: 'branch-inst2',
          name: 'فرع مؤسسة 2',
          institutionId: 'inst-002'
        };
      }
      return null;
    };

    const req: any = {
      user: {
        userId: 'manager-inst1',
        role: 'PRIMARY_MANAGER',
        isPrimaryManager: true,
        institutionId: 'inst-001'
      },
      params: { teacherId: 'teacher-inst1' },
      body: { branchId: 'branch-inst2' }
    };
    const res = createMockResponse();

    await BrdSubscriptionController.assignTeacherBranch(req, res as any);

    assert(
      res.statusCode === 403,
      'SEC-XB-15 Cross-institution branch target rejected with HTTP 403',
      `Expected 403, got ${res.statusCode}`
    );
  }

  // --------------------------------------------------------------------------
  // TEST 22: Email admin@edu.com & isPlatformSuperAdmin claim cannot bypass assignTeacherBranch
  // --------------------------------------------------------------------------
  {
    console.log('\nScenario 22 (SEC-PRIV-01): admin@edu.com email / isPlatformSuperAdmin rejected across institution boundary in assignTeacherBranch');

    (db.user as any).findUnique = async ({ where }: any) => {
      if (where.id === 'teacher-inst2') {
        return { id: 'teacher-inst2', role: 'TEACHER', institutionId: 'inst-002', branchId: null };
      }
      if (where.id === 'teacher-inst1') {
        return { id: 'teacher-inst1', role: 'TEACHER', institutionId: 'inst-001', branchId: null };
      }
      return null;
    };
    (db.branch as any).findUnique = async ({ where }: any) => {
      if (where.id === 'branch-inst2') {
        return { id: 'branch-inst2', name: 'Inst 2 Branch', institutionId: 'inst-002' };
      }
      if (where.id === 'branch-inst1') {
        return { id: 'branch-inst1', name: 'Inst 1 Branch', code: 'B1', isOnline: false, institutionId: 'inst-001' };
      }
      return null;
    };
    (db.user as any).update = async ({ where, data }: any) => ({
      id: where.id,
      name: 'Teacher One',
      branchId: data.branchId
    });

    const reqCrossTeacher: any = {
      user: {
        userId: 'manager-email-spoof',
        role: 'ADMIN',
        email: 'admin@edu.com',
        isPrimaryManager: true,
        institutionId: 'inst-001'
      },
      tenantContext: { institutionId: 'inst-001', isPlatformSuperAdmin: true },
      params: { teacherId: 'teacher-inst2' },
      body: { branchId: 'branch-inst1' }
    };
    const resCrossTeacher = createMockResponse();
    await BrdSubscriptionController.assignTeacherBranch(reqCrossTeacher, resCrossTeacher as any);
    assert(resCrossTeacher.statusCode === 403, 'SEC-PRIV-01a admin@edu.com & isPlatformSuperAdmin rejected assigning foreign teacher (403)');

    const reqNoInst: any = {
      user: {
        userId: 'manager-no-inst',
        role: 'PRIMARY_MANAGER',
        email: 'admin@edu.com',
        isPrimaryManager: true,
        institutionId: null
      },
      params: { teacherId: 'teacher-inst1' },
      body: { branchId: 'branch-inst1' }
    };
    const resNoInst = createMockResponse();
    await BrdSubscriptionController.assignTeacherBranch(reqNoInst, resNoInst as any);
    assert(resNoInst.statusCode === 403, 'SEC-PRIV-01b Missing manager institutionId rejected fail-closed (403)');

    // Legitimate Primary Manager in same institution succeeds
    const reqLegit: any = {
      user: {
        userId: 'manager-inst1',
        role: 'PRIMARY_MANAGER',
        isPrimaryManager: true,
        institutionId: 'inst-001'
      },
      params: { teacherId: 'teacher-inst1' },
      body: { branchId: 'branch-inst1' }
    };
    const resLegit = createMockResponse();
    await BrdSubscriptionController.assignTeacherBranch(reqLegit, resLegit as any);
    assert(resLegit.statusCode === 200 && resLegit.data?.success === true, 'SEC-PRIV-01c Legitimate same-institution Primary Manager branch assignment succeeds');
  }

  // --------------------------------------------------------------------------
  // TEST 23: Shared tenantContextMiddleware, assertTenantAccess & assertBranchAccess reject email/super-admin bypass
  // --------------------------------------------------------------------------
  {
    console.log('\nScenario 23 (SEC-PRIV-02): Shared tenantContext guards reject email override and synthetic isPlatformSuperAdmin');

    const middleware = tenantContextMiddleware({ requireTenant: true });
    const reqHeaderSpoof: any = {
      user: { userId: 'u-email-admin', role: 'ADMIN', email: 'admin@edu.com', institutionId: 'inst-001', branchId: 'b-1' },
      headers: { 'x-institution-id': 'inst-002' }
    };
    const resHeaderSpoof = createMockResponse();
    let nextCalled = false;
    middleware(reqHeaderSpoof, resHeaderSpoof as any, () => { nextCalled = true; });
    assert(resHeaderSpoof.statusCode === 403 && !nextCalled, 'SEC-PRIV-02a admin@edu.com cannot override institution via x-institution-id header');

    const reqMissingTenant: any = {
      user: { userId: 'u-email-noinst', role: 'ADMIN', email: 'admin@edu.com', institutionId: null },
      headers: {}
    };
    const resMissingTenant = createMockResponse();
    middleware(reqMissingTenant, resMissingTenant as any, () => { nextCalled = true; });
    assert(resMissingTenant.statusCode === 403, 'SEC-PRIV-02b requireTenant rejects missing institutionId even for admin@edu.com');

    const reqValid: any = {
      user: { userId: 'u-mgr', role: 'PRIMARY_MANAGER', email: 'admin@edu.com', institutionId: 'inst-001', isPrimaryManager: true },
      headers: {}
    };
    const resValid = createMockResponse();
    middleware(reqValid, resValid as any, () => { nextCalled = true; });
    assert(nextCalled && reqValid.tenantContext?.isPlatformSuperAdmin === false, 'SEC-PRIV-02c tenantContextMiddleware forces isPlatformSuperAdmin=false');

    let crossTenantBlocked = false;
    try {
      assertTenantAccess(
        { institutionId: 'inst-001', branchId: 'b-1', userId: 'u-1', role: 'ADMIN', isPlatformSuperAdmin: true, isPrimaryManager: false },
        'inst-002'
      );
    } catch {
      crossTenantBlocked = true;
    }
    assert(crossTenantBlocked, 'SEC-PRIV-02d assertTenantAccess rejects cross-tenant access even with synthetic isPlatformSuperAdmin=true');

    let crossBranchBlocked = false;
    try {
      assertBranchAccess(
        { institutionId: 'inst-001', branchId: 'b-1', userId: 'u-1', role: 'ACCOUNTANT', isPlatformSuperAdmin: true, isPrimaryManager: false },
        'b-2',
        false
      );
    } catch {
      crossBranchBlocked = true;
    }
    assert(crossBranchBlocked, 'SEC-PRIV-02e assertBranchAccess rejects cross-branch access even with synthetic isPlatformSuperAdmin=true');
  }

  // --------------------------------------------------------------------------
  // TEST 24: user.controller getUsers fails closed when tenant context is missing
  // --------------------------------------------------------------------------
  {
    console.log('\nScenario 24 (SEC-PRIV-03): getUsers fails closed without institutionId even with isPlatformSuperAdmin=true');

    let capturedWhere: any = null;
    (db.user as any).findMany = async ({ where }: any) => {
      capturedWhere = where;
      return [];
    };
    (db.user as any).count = async () => 0;

    const reqNoInst: any = {
      user: { userId: 'mgr-noinst', role: 'PRIMARY_MANAGER', isPrimaryManager: true, institutionId: null },
      tenantContext: { institutionId: null, isPlatformSuperAdmin: true },
      query: {}
    };
    const resNoInst = createMockResponse();
    await getUsers(reqNoInst, resNoInst as any);
    assert(resNoInst.statusCode === 200 && capturedWhere?.institutionId === 'FAIL_CLOSED_NO_TENANT', 'SEC-PRIV-03a Missing institutionId fails closed in getUsers');

    const reqScoped: any = {
      user: { userId: 'mgr-1', role: 'PRIMARY_MANAGER', isPrimaryManager: true, institutionId: 'inst-001' },
      tenantContext: { institutionId: 'inst-001', isPlatformSuperAdmin: false },
      query: {}
    };
    const resScoped = createMockResponse();
    await getUsers(reqScoped, resScoped as any);
    assert(resScoped.statusCode === 200 && capturedWhere?.institutionId === 'inst-001', 'SEC-PRIV-03b Authenticated Primary Manager getUsers strictly scopes to inst-001');
  }

  console.log('\n================================================================');
  console.log(`Backend Security Tests Completed: ${passedCount} Passed, ${failedCount} Failed`);
  console.log('================================================================');

  if (failedCount > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runCrossBranchBackendSecurityTests().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
