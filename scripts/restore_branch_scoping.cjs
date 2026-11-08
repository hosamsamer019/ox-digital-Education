const fs = require('fs');
const path = require('path');

// 1. collections.controller.ts
{
  const p = path.resolve(__dirname, '../services/user-service/src/controllers/accounting/collections.controller.ts');
  let code = fs.readFileSync(p, 'utf8');
  const target = `    } else if (userRole === 'ACCOUNTANT') {
      // Single-teacher operating model: accountants have institution-wide collection access
      if (req.user?.institutionId && collection.institutionId && collection.institutionId !== req.user.institutionId) {
        return res.status(403).json({ message: 'Forbidden: Accountants cannot access collections of other institutions' });
      }
    }`;
  const replacement = `    } else if (userRole === 'ACCOUNTANT') {
      if (req.user?.branchId && collection.branchId && collection.branchId !== req.user.branchId) {
        return res.status(403).json({ message: 'Forbidden: Branch accountants can only access collections of their assigned branch' });
      }
    }`;
  code = code.split(target).join(replacement);
  // Also handle CRLF if needed
  const targetCRLF = target.replace(/\n/g, '\r\n');
  const replacementCRLF = replacement.replace(/\n/g, '\r\n');
  code = code.split(targetCRLF).join(replacementCRLF);
  fs.writeFileSync(p, code, 'utf8');
  console.log('Restored branch scoping in collections.controller.ts');
}

// 2. receipts.controller.ts
{
  const p = path.resolve(__dirname, '../services/user-service/src/controllers/accounting/receipts.controller.ts');
  let code = fs.readFileSync(p, 'utf8');
  const target = `    } else if (userRole === 'ACCOUNTANT') {
      // Single-teacher operating model: accountants have institution-wide receipt access
      if (req.user?.institutionId && collection.institutionId && collection.institutionId !== req.user.institutionId) {
        return res.status(403).json({ message: 'Forbidden: Accountants cannot access receipts of other institutions' });
      }
    }`;
  const replacement = `    } else if (userRole === 'ACCOUNTANT') {
      if (req.user?.branchId && collection.branchId && collection.branchId !== req.user.branchId) {
        return res.status(403).json({ message: 'Forbidden: Branch accountants can only access receipts of their assigned branch' });
      }
    }`;
  code = code.split(target).join(replacement);
  const targetCRLF = target.replace(/\n/g, '\r\n');
  const replacementCRLF = replacement.replace(/\n/g, '\r\n');
  code = code.split(targetCRLF).join(replacementCRLF);
  fs.writeFileSync(p, code, 'utf8');
  console.log('Restored branch scoping in receipts.controller.ts');
}

// 3. pricing.controller.ts
{
  const p = path.resolve(__dirname, '../services/user-service/src/controllers/accounting/pricing.controller.ts');
  let code = fs.readFileSync(p, 'utf8');
  const target = `    } else if (userRole === 'ACCOUNTANT') {
      // Single-teacher operating model: accountants have institution-wide student access across branches
      if (req.user?.institutionId && student.institutionId && student.institutionId !== req.user.institutionId) {
        return res.status(403).json({ message: 'Forbidden: Accountants cannot access students of other institutions' });
      }
    }`;
  const replacement = `    } else if (userRole === 'ACCOUNTANT') {
      if (req.user?.branchId && student.branchId && student.branchId !== req.user.branchId) {
        return res.status(403).json({ message: 'Forbidden: Branch accountants can only access students in their assigned branch' });
      }
    }`;
  code = code.split(target).join(replacement);
  const targetCRLF = target.replace(/\n/g, '\r\n');
  const replacementCRLF = replacement.replace(/\n/g, '\r\n');
  code = code.split(targetCRLF).join(replacementCRLF);
  fs.writeFileSync(p, code, 'utf8');
  console.log('Restored branch scoping in pricing.controller.ts');
}

