const fs = require('fs');
const path = require('path');

const filePath = path.resolve('services/user-service/src/controllers/user.controller.ts');
let content = fs.readFileSync(filePath, 'utf8');

const targetStr = "} else if (requesterRole === 'PRIMARY_MANAGER') {";
const replaceStr = "} else if (requesterRole === 'PRIMARY_MANAGER' || requesterRole === 'ACCOUNTANT') {";

if (content.includes(targetStr)) {
  content = content.replace(targetStr, replaceStr);
  fs.writeFileSync(filePath, content, 'utf8');
  console.log('[OK] Successfully updated accountant targetInstitutionId assignment in user.controller.ts');
} else {
  console.log('[WARN] Target string not found in user.controller.ts');
}

