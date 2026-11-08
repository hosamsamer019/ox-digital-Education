const fs = require('fs');
const path = require('path');

const filePath = path.resolve('services/user-service/src/controllers/user.controller.ts');
let content = fs.readFileSync(filePath, 'utf8');

const targetStr = "role: newUser.role,";
const replaceStr = "role: newUser.role,\n        institutionId: newUser.institutionId,";

if (content.includes(targetStr)) {
  content = content.replace(targetStr, replaceStr);
  fs.writeFileSync(filePath, content, 'utf8');
  console.log('[OK] Added institutionId to createAccountant response in user.controller.ts');
} else {
  console.log('[WARN] Target not found');
}

