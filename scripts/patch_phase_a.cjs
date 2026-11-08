const fs = require('fs');
const path = require('path');

// 1. Patch user.service.ts
const userServicePath = path.resolve(__dirname, '../apps/frontend/src/app/services/user.service.ts');
let userServiceContent = fs.readFileSync(userServicePath, 'utf8');

if (!userServiceContent.includes('getManagerBranches:')) {
  const target = 'createAccountant: async';
  const addition = `getManagerBranches: async (): Promise<any[]> => {
    try {
      const response = await managerApi.get('/branches');
      return response.data?.branches || response.data || [];
    } catch (err: any) {
      if (err.response?.status === 400 || err.response?.status === 401 || err.response?.status === 403) {
        throw err;
      }
      const response = await userApi.get('/manager/branches');
      return response.data?.branches || response.data || [];
    }
  },

  createAccountant: async`;
  
  userServiceContent = userServiceContent.replace(target, addition);
  fs.writeFileSync(userServicePath, userServiceContent, 'utf8');
  console.log('[SUCCESS] user.service.ts patched with getManagerBranches');
} else {
  console.log('[SKIP] user.service.ts already has getManagerBranches');
}

// 2. Patch brdSubscription.service.ts (tenant isolation in provisionBranchAccountant)
const brdSubServicePath = path.resolve(__dirname, '../services/user-service/src/services/brdSubscription.service.ts');
let brdSubContent = fs.readFileSync(brdSubServicePath, 'utf8');

if (!brdSubContent.includes('BRANCH_TENANT_MISMATCH')) {
  const target = `    const branch = await db.branch.findUnique({ where: { id: params.branchId } });
    if (!branch) {
      throw new Error('Branch not found');
    }`;

  const replacement = `    const branch = await db.branch.findUnique({ where: { id: params.branchId } });
    if (!branch) {
      const err: any = new Error('الفرع المحدد غير موجود');
      err.code = 'BRANCH_NOT_FOUND';
      err.status = 404;
      throw err;
    }

    if (managerUser.institutionId && branch.institutionId !== managerUser.institutionId) {
      const err: any = new Error('الفرع المحدد لا يتبع لنفس مؤسسة المدير المسؤول');
      err.code = 'BRANCH_TENANT_MISMATCH';
      err.status = 403;
      throw err;
    }`;

  brdSubContent = brdSubContent.replace(target, replacement);
  fs.writeFileSync(brdSubServicePath, brdSubContent, 'utf8');
  console.log('[SUCCESS] brdSubscription.service.ts patched with branch tenant boundary check');
} else {
  console.log('[SKIP] brdSubscription.service.ts already has BRANCH_TENANT_MISMATCH');
}

// 3. Patch brdSubscription.controller.ts (institution filtering in getBranches)
const brdSubCtrlPath = path.resolve(__dirname, '../services/user-service/src/controllers/brdSubscription.controller.ts');
let brdSubCtrlContent = fs.readFileSync(brdSubCtrlPath, 'utf8');

if (!brdSubCtrlContent.includes('whereClause.institutionId = req.user.institutionId')) {
  const target = `      const branches = await db.branch.findMany({
        include: {
          users: {
            where: { deletedAt: null },
            select: { id: true, role: true }
          }
        },
        orderBy: { createdAt: 'desc' }
      });`;

  const replacement = `      const whereClause: any = { deletedAt: null };
      if (req.user?.institutionId) {
        whereClause.institutionId = req.user.institutionId;
      }

      const branches = await db.branch.findMany({
        where: whereClause,
        include: {
          users: {
            where: { deletedAt: null },
            select: { id: true, role: true }
          }
        },
        orderBy: { createdAt: 'desc' }
      });`;

  brdSubCtrlContent = brdSubCtrlContent.replace(target, replacement);
  fs.writeFileSync(brdSubCtrlPath, brdSubCtrlContent, 'utf8');
  console.log('[SUCCESS] brdSubscription.controller.ts patched with institution filtering in getBranches');
} else {
  console.log('[SKIP] brdSubscription.controller.ts already has institution filtering');
}

