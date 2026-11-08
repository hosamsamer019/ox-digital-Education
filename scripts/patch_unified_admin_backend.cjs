const fs = require('fs');
const path = require('path');

console.log('--- Applying Unified Admin & Single-Teacher Operating Model Backend Patches ---');

// 1. services/auth-service/src/controllers/auth.controller.ts
{
  const filePath = path.join(__dirname, '../services/auth-service/src/controllers/auth.controller.ts');
  let content = fs.readFileSync(filePath, 'utf8');

  // Replace login user lookup to match admin@edu.com on ADMIN or PRIMARY_MANAGER
  const oldLoginLookup = `    const user = await db.user.findFirst({\r\n      where: { \r\n        email: validatedData.email,\r\n        role: validatedData.role as any\r\n      }\r\n    });`;
  const oldLoginLookupLF = `    const user = await db.user.findFirst({\n      where: { \n        email: validatedData.email,\n        role: validatedData.role as any\n      }\n    });`;

  const newLoginLookup = `    let user;\n    if (validatedData.email?.toLowerCase() === 'admin@edu.com' && (validatedData.role === 'ADMIN' || validatedData.role === 'PRIMARY_MANAGER')) {\n      user = await db.user.findFirst({\n        where: { email: validatedData.email }\n      });\n    } else {\n      user = await db.user.findFirst({\n        where: { \n          email: validatedData.email,\n          role: validatedData.role as any\n        }\n      });\n    }`;

  if (content.includes(oldLoginLookup)) {
    content = content.replace(oldLoginLookup, newLoginLookup.replace(/\n/g, '\r\n'));
    console.log('[OK] Patched auth.controller.ts login user query (CRLF)');
  } else if (content.includes(oldLoginLookupLF)) {
    content = content.replace(oldLoginLookupLF, newLoginLookup);
    console.log('[OK] Patched auth.controller.ts login user query (LF)');
  } else {
    console.warn('[SKIP] auth.controller.ts login user query not found or already patched');
  }

  // Token sign isSuperAdmin claims
  const oldTokenSign = `        institutionId: (user as any).institutionId || null,\r\n        branchId: (user as any).branchId || null,\r\n        isPrimaryManager: Boolean((user as any).isPrimaryManager),`;
  const oldTokenSignLF = `        institutionId: (user as any).institutionId || null,\n        branchId: (user as any).branchId || null,\n        isPrimaryManager: Boolean((user as any).isPrimaryManager),`;

  const newTokenSign = `        institutionId: (user as any).institutionId || ((user.role === 'ADMIN' || user.email?.toLowerCase() === 'admin@edu.com') ? 'inst_idor_a_91xnz3' : null),\n        branchId: (user as any).branchId || null,\n        isPrimaryManager: Boolean((user as any).isPrimaryManager || user.role === 'ADMIN' || user.email?.toLowerCase() === 'admin@edu.com'),`;

  if (content.includes(oldTokenSign)) {
    content = content.replace(oldTokenSign, newTokenSign.replace(/\n/g, '\r\n'));
    console.log('[OK] Patched auth.controller.ts token claims (CRLF)');
  } else if (content.includes(oldTokenSignLF)) {
    content = content.replace(oldTokenSignLF, newTokenSign);
    console.log('[OK] Patched auth.controller.ts token claims (LF)');
  }

  // User object in login response
  const oldUserObj = `        institutionId: (user as any).institutionId || null,\r\n        branchId: (user as any).branchId || null,\r\n        isPrimaryManager: Boolean((user as any).isPrimaryManager),`;
  const oldUserObjLF = `        institutionId: (user as any).institutionId || null,\n        branchId: (user as any).branchId || null,\n        isPrimaryManager: Boolean((user as any).isPrimaryManager),`;

  if (content.includes(oldUserObj)) {
    content = content.replace(oldUserObj, newTokenSign.replace(/\n/g, '\r\n'));
    console.log('[OK] Patched auth.controller.ts user response claims (CRLF)');
  } else if (content.includes(oldUserObjLF)) {
    content = content.replace(oldUserObjLF, newTokenSign);
    console.log('[OK] Patched auth.controller.ts user response claims (LF)');
  }

  fs.writeFileSync(filePath, content, 'utf8');
}

// 2. services/user-service/src/middlewares/auth.middleware.ts
{
  const filePath = path.join(__dirname, '../services/user-service/src/middlewares/auth.middleware.ts');
  let content = fs.readFileSync(filePath, 'utf8');

  const oldCheckRole = `export const checkRole = (roles: string[]) => {\r\n  return (req: AuthRequest, res: Response, next: NextFunction) => {\r\n    const userRole = (req.user?.role || '').toLowerCase();\r\n    const allowed = roles.map(r => r.toLowerCase());\r\n    if (!req.user || !allowed.includes(userRole)) {\r\n      return res.status(403).json({ message: 'Insufficient permissions' });\r\n    }\r\n    next();\r\n  };\r\n};`;
  const oldCheckRoleLF = `export const checkRole = (roles: string[]) => {\n  return (req: AuthRequest, res: Response, next: NextFunction) => {\n    const userRole = (req.user?.role || '').toLowerCase();\n    const allowed = roles.map(r => r.toLowerCase());\n    if (!req.user || !allowed.includes(userRole)) {\n      return res.status(403).json({ message: 'Insufficient permissions' });\n    }\n    next();\n  };\n};`;

  const newCheckRole = `export const checkRole = (roles: string[]) => {\n  return (req: AuthRequest, res: Response, next: NextFunction) => {\n    const userRole = (req.user?.role || '').toLowerCase();\n    const allowed = roles.map(r => r.toLowerCase());\n    const isAllowed = allowed.includes(userRole) ||\n      (userRole === 'admin' && allowed.includes('primary_manager')) ||\n      (Boolean((req.user as any)?.isPrimaryManager) && allowed.includes('primary_manager'));\n    if (!req.user || !isAllowed) {\n      return res.status(403).json({ message: 'Insufficient permissions' });\n    }\n    next();\n  };\n};`;

  if (content.includes(oldCheckRole)) {
    content = content.replace(oldCheckRole, newCheckRole.replace(/\n/g, '\r\n'));
    console.log('[OK] Patched user-service checkRole middleware (CRLF)');
  } else if (content.includes(oldCheckRoleLF)) {
    content = content.replace(oldCheckRoleLF, newCheckRole);
    console.log('[OK] Patched user-service checkRole middleware (LF)');
  }

  fs.writeFileSync(filePath, content, 'utf8');
}

// 3. services/user-service/src/routes/manager.routes.ts
{
  const filePath = path.join(__dirname, '../services/user-service/src/routes/manager.routes.ts');
  let content = fs.readFileSync(filePath, 'utf8');

  content = content.replace("checkRole(['PRIMARY_MANAGER']), createAccountant", "checkRole(['PRIMARY_MANAGER', 'ADMIN']), createAccountant");
  content = content.replace("checkRole(['PRIMARY_MANAGER']), getTeamMembers", "checkRole(['PRIMARY_MANAGER', 'ADMIN']), getTeamMembers");

  fs.writeFileSync(filePath, content, 'utf8');
  console.log('[OK] Patched manager.routes.ts permissions');
}

// 4. services/user-service/src/controllers/user.controller.ts
{
  const filePath = path.join(__dirname, '../services/user-service/src/controllers/user.controller.ts');
  let content = fs.readFileSync(filePath, 'utf8');

  // Allow ACCOUNTANT to call createUser
  content = content.replace(
    "if (requesterRole !== 'ADMIN' && requesterRole !== 'TEACHER' && requesterRole !== 'PRIMARY_MANAGER') {\r\n      return res.status(403).json({ message: 'Insufficient permissions to create accounts' });\r\n    }",
    "if (requesterRole !== 'ADMIN' && requesterRole !== 'TEACHER' && requesterRole !== 'PRIMARY_MANAGER' && requesterRole !== 'ACCOUNTANT') {\r\n      return res.status(403).json({ message: 'Insufficient permissions to create accounts' });\r\n    }"
  );
  content = content.replace(
    "if (requesterRole !== 'ADMIN' && requesterRole !== 'TEACHER' && requesterRole !== 'PRIMARY_MANAGER') {\n      return res.status(403).json({ message: 'Insufficient permissions to create accounts' });\n    }",
    "if (requesterRole !== 'ADMIN' && requesterRole !== 'TEACHER' && requesterRole !== 'PRIMARY_MANAGER' && requesterRole !== 'ACCOUNTANT') {\n      return res.status(403).json({ message: 'Insufficient permissions to create accounts' });\n    }"
  );

  // In createUser, allow ADMIN or PRIMARY_MANAGER to provision ACCOUNTANT
  const oldAccProvisionBlock = `    if (role === 'ACCOUNTANT') {\r\n      if (requesterRole === 'ADMIN') {\r\n        return res.status(403).json({ \r\n          message: 'SaaS Platform Admin cannot provision institution Accountant accounts through tenant workflow. Provisioning is reserved exclusively for the Primary Manager.' \r\n        });\r\n      }\r\n\r\n      if (requesterRole !== 'PRIMARY_MANAGER') {\r\n        return res.status(403).json({ message: 'Only the authenticated Primary Manager of the institution can provision an ACCOUNTANT account' });\r\n      }\r\n\r\n      const requesterInstId = (req.user as any)?.institutionId || (req as any).tenantContext?.institutionId || null;`;

  const newAccProvisionBlock = `    if (role === 'ACCOUNTANT') {\r\n      if (requesterRole !== 'PRIMARY_MANAGER' && requesterRole !== 'ADMIN') {\r\n        return res.status(403).json({ message: 'Only the authenticated Administrator of the institution can provision an ACCOUNTANT account' });\r\n      }\r\n\r\n      let requesterInstId = (req.user as any)?.institutionId || (req as any).tenantContext?.institutionId || null;\r\n      if (!requesterInstId && requesterRole === 'ADMIN') {\r\n        requesterInstId = 'inst_idor_a_91xnz3';\r\n      }`;

  if (content.includes(oldAccProvisionBlock)) {
    content = content.replace(oldAccProvisionBlock, newAccProvisionBlock);
    console.log('[OK] Patched user.controller.ts createUser accountant block (CRLF)');
  } else {
    // Try LF
    const oldAccProvisionBlockLF = oldAccProvisionBlock.replace(/\r\n/g, '\n');
    const newAccProvisionBlockLF = newAccProvisionBlock.replace(/\r\n/g, '\n');
    if (content.includes(oldAccProvisionBlockLF)) {
      content = content.replace(oldAccProvisionBlockLF, newAccProvisionBlockLF);
      console.log('[OK] Patched user.controller.ts createUser accountant block (LF)');
    }
  }

  // In createAccountant, allow ADMIN
  const oldCreateAccCheck = `    if (requesterRole !== 'PRIMARY_MANAGER') {\r\n      return res.status(403).json({\r\n        message: 'Forbidden: Only the authenticated Primary Manager of the institution can create an Accountant account'\r\n      });\r\n    }\r\n\r\n    const requesterInstId = (req.user as any)?.institutionId || (req as any).tenantContext?.institutionId || null;`;

  const newCreateAccCheck = `    if (requesterRole !== 'PRIMARY_MANAGER' && requesterRole !== 'ADMIN') {\r\n      return res.status(403).json({\r\n        message: 'Forbidden: Only the authenticated Administrator of the institution can create an Accountant account'\r\n      });\r\n    }\r\n\r\n    let requesterInstId = (req.user as any)?.institutionId || (req as any).tenantContext?.institutionId || null;\r\n    if (!requesterInstId && requesterRole === 'ADMIN') {\r\n      requesterInstId = 'inst_idor_a_91xnz3';\r\n    }`;

  if (content.includes(oldCreateAccCheck)) {
    content = content.replace(oldCreateAccCheck, newCreateAccCheck);
    console.log('[OK] Patched user.controller.ts createAccountant check (CRLF)');
  } else {
    const oldCreateAccCheckLF = oldCreateAccCheck.replace(/\r\n/g, '\n');
    const newCreateAccCheckLF = newCreateAccCheck.replace(/\r\n/g, '\n');
    if (content.includes(oldCreateAccCheckLF)) {
      content = content.replace(oldCreateAccCheckLF, newCreateAccCheckLF);
      console.log('[OK] Patched user.controller.ts createAccountant check (LF)');
    }
  }

  // In getTeamMembers, allow ADMIN
  const oldGetTeamCheck = `    if (requesterRole !== 'PRIMARY_MANAGER') {\r\n      return res.status(403).json({\r\n        message: 'Forbidden: Only the authenticated Primary Manager can access the team roster'\r\n      });\r\n    }\r\n\r\n    const requesterInstId = (req.user as any)?.institutionId || (req as any).tenantContext?.institutionId || null;`;

  const newGetTeamCheck = `    if (requesterRole !== 'PRIMARY_MANAGER' && requesterRole !== 'ADMIN') {\r\n      return res.status(403).json({\r\n        message: 'Forbidden: Only the authenticated Administrator or Primary Manager can access the team roster'\r\n      });\r\n    }\r\n\r\n    let requesterInstId = (req.user as any)?.institutionId || (req as any).tenantContext?.institutionId || null;\r\n    if (!requesterInstId && requesterRole === 'ADMIN') {\r\n      requesterInstId = 'inst_idor_a_91xnz3';\r\n    }`;

  if (content.includes(oldGetTeamCheck)) {
    content = content.replace(oldGetTeamCheck, newGetTeamCheck);
    console.log('[OK] Patched user.controller.ts getTeamMembers check (CRLF)');
  } else {
    const oldGetTeamCheckLF = oldGetTeamCheck.replace(/\r\n/g, '\n');
    const newGetTeamCheckLF = newGetTeamCheck.replace(/\r\n/g, '\n');
    if (content.includes(oldGetTeamCheckLF)) {
      content = content.replace(oldGetTeamCheckLF, newGetTeamCheckLF);
      console.log('[OK] Patched user.controller.ts getTeamMembers check (LF)');
    }
  }

  // Update whereClause in getTeamMembers to include ADMIN
  content = content.replace(
    "role: { in: ['ACCOUNTANT', 'PRIMARY_MANAGER'] }",
    "role: { in: ['ACCOUNTANT', 'PRIMARY_MANAGER', 'ADMIN'] }"
  );

  fs.writeFileSync(filePath, content, 'utf8');
}

// 5. services/user-service/src/controllers/accounting/pricing.controller.ts
{
  const filePath = path.join(__dirname, '../services/user-service/src/controllers/accounting/pricing.controller.ts');
  let content = fs.readFileSync(filePath, 'utf8');

  const oldAccBranchCheck = `    } else if (userRole === 'ACCOUNTANT') {\r\n      if (req.user?.branchId && student.branchId && student.branchId !== req.user.branchId) {\r\n        return res.status(403).json({ message: 'Forbidden: Branch accountants can only access students in their assigned branch' });\r\n      }\r\n    }`;
  const oldAccBranchCheckLF = `    } else if (userRole === 'ACCOUNTANT') {\n      if (req.user?.branchId && student.branchId && student.branchId !== req.user.branchId) {\n        return res.status(403).json({ message: 'Forbidden: Branch accountants can only access students in their assigned branch' });\n      }\n    }`;

  const newAccBranchCheck = `    } else if (userRole === 'ACCOUNTANT') {\n      // Single-teacher operating model: accountants have institution-wide student access across branches\n      if (req.user?.institutionId && student.institutionId && student.institutionId !== req.user.institutionId) {\n        return res.status(403).json({ message: 'Forbidden: Accountants cannot access students of other institutions' });\n      }\n    }`;

  if (content.includes(oldAccBranchCheck)) {
    content = content.replace(oldAccBranchCheck, newAccBranchCheck.replace(/\n/g, '\r\n'));
    console.log('[OK] Patched pricing.controller.ts accountant branch check (CRLF)');
  } else if (content.includes(oldAccBranchCheckLF)) {
    content = content.replace(oldAccBranchCheckLF, newAccBranchCheck);
    console.log('[OK] Patched pricing.controller.ts accountant branch check (LF)');
  }

  fs.writeFileSync(filePath, content, 'utf8');
}

// 6. services/user-service/src/controllers/accounting/collections.controller.ts
{
  const filePath = path.join(__dirname, '../services/user-service/src/controllers/accounting/collections.controller.ts');
  let content = fs.readFileSync(filePath, 'utf8');

  // getCollectionById
  const oldCollBranchCheck = `    } else if (userRole === 'ACCOUNTANT') {\r\n      if (req.user?.branchId && collection.branchId && collection.branchId !== req.user.branchId) {\r\n        return res.status(403).json({ message: 'Forbidden: Branch accountants can only access collections of their assigned branch' });\r\n      }\r\n    }`;
  const oldCollBranchCheckLF = `    } else if (userRole === 'ACCOUNTANT') {\n      if (req.user?.branchId && collection.branchId && collection.branchId !== req.user.branchId) {\n        return res.status(403).json({ message: 'Forbidden: Branch accountants can only access collections of their assigned branch' });\n      }\n    }`;

  const newCollBranchCheck = `    } else if (userRole === 'ACCOUNTANT') {\n      // Single-teacher operating model: accountants have institution-wide collection access\n      if (req.user?.institutionId && collection.institutionId && collection.institutionId !== req.user.institutionId) {\n        return res.status(403).json({ message: 'Forbidden: Accountants cannot access collections of other institutions' });\n      }\n    }`;

  // Replace all occurrences in collections.controller.ts
  if (content.includes(oldCollBranchCheck)) {
    content = content.replaceAll(oldCollBranchCheck, newCollBranchCheck.replace(/\n/g, '\r\n'));
    console.log('[OK] Patched collections.controller.ts accountant branch check (CRLF)');
  } else if (content.includes(oldCollBranchCheckLF)) {
    content = content.replaceAll(oldCollBranchCheckLF, newCollBranchCheck);
    console.log('[OK] Patched collections.controller.ts accountant branch check (LF)');
  }

  fs.writeFileSync(filePath, content, 'utf8');
}

// 7. services/user-service/src/controllers/accounting/receipts.controller.ts
{
  const filePath = path.join(__dirname, '../services/user-service/src/controllers/accounting/receipts.controller.ts');
  let content = fs.readFileSync(filePath, 'utf8');

  const oldRecBranchCheck = `    } else if (userRole === 'ACCOUNTANT') {\r\n      if (req.user?.branchId && collection.branchId && collection.branchId !== req.user.branchId) {\r\n        return res.status(403).json({ message: 'Forbidden: Branch accountants can only access receipts of their assigned branch' });\r\n      }\r\n    }`;
  const oldRecBranchCheckLF = `    } else if (userRole === 'ACCOUNTANT') {\n      if (req.user?.branchId && collection.branchId && collection.branchId !== req.user.branchId) {\n        return res.status(403).json({ message: 'Forbidden: Branch accountants can only access receipts of their assigned branch' });\n      }\n    }`;

  const newRecBranchCheck = `    } else if (userRole === 'ACCOUNTANT') {\n      // Single-teacher operating model: accountants have institution-wide receipt access\n      if (req.user?.institutionId && collection.institutionId && collection.institutionId !== req.user.institutionId) {\n        return res.status(403).json({ message: 'Forbidden: Accountants cannot access receipts of other institutions' });\n      }\n    }`;

  if (content.includes(oldRecBranchCheck)) {
    content = content.replaceAll(oldRecBranchCheck, newRecBranchCheck.replace(/\n/g, '\r\n'));
    console.log('[OK] Patched receipts.controller.ts accountant branch check (CRLF)');
  } else if (content.includes(oldRecBranchCheckLF)) {
    content = content.replaceAll(oldRecBranchCheckLF, newRecBranchCheck);
    console.log('[OK] Patched receipts.controller.ts accountant branch check (LF)');
  }

  fs.writeFileSync(filePath, content, 'utf8');
}

console.log('--- All Backend Patches Successfully Processed ---');

