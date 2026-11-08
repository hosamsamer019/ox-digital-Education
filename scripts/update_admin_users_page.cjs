const fs = require('fs');
const path = require('path');

const filePath = path.resolve('D:/OX-DIGITAL/Mathe/OX-DIGITAL-GITHUB/apps/frontend/src/app/components/admin/AdminUsersPage.tsx');
let content = fs.readFileSync(filePath, 'utf8');

// 1. Update role filter dropdown
const filterTarget = `<option value="ADMIN">مدير</option>`;
const filterReplacement = `<option value="ADMIN">مدير</option>
              <option value="PRIMARY_MANAGER">مدير تنفيذي</option>
              <option value="ACCOUNTANT">محاسب</option>`;

if (content.includes(filterTarget)) {
  content = content.replace(filterTarget, filterReplacement);
  console.log('Successfully updated role filter options');
} else {
  console.log('Target for role filter not found directly, checking regex...');
  content = content.replace(/<option value="ADMIN">.*?<\/option>/, `<option value="ADMIN">مدير</option>\n              <option value="PRIMARY_MANAGER">مدير تنفيذي</option>\n              <option value="ACCOUNTANT">محاسب</option>`);
  console.log('Updated role filter via regex');
}

// 2. Update form role dropdown
const formRoleTarget = `<option value="ADMIN">ADMIN (مدير)</option>`;
const formRoleReplacement = `<option value="ADMIN">ADMIN (مدير)</option>
                  <option value="ACCOUNTANT">ACCOUNTANT (محاسب)</option>`;

if (content.includes(formRoleTarget)) {
  content = content.replace(formRoleTarget, formRoleReplacement);
  console.log('Successfully updated form role select');
} else {
  console.log('Target for form role not found directly, checking regex...');
  content = content.replace(/<option value="ADMIN">ADMIN.*?<\/option>/, `<option value="ADMIN">ADMIN (مدير)</option>\n                  <option value="ACCOUNTANT">ACCOUNTANT (محاسب)</option>`);
  console.log('Updated form role via regex');
}

fs.writeFileSync(filePath, content, 'utf8');
console.log('AdminUsersPage.tsx written successfully.');

