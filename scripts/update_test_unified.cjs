const fs = require('fs');
const path = require('path');

const file = path.resolve('apps/frontend/src/app/test/AuthPagesAndSplash.test.tsx');
let content = fs.readFileSync(file, 'utf8');

const search = 'renders all institutional user roles and platform admin portal on initial step';
if (content.includes(search)) {
  content = content.replace(search, 'renders all institutional user roles on unified login portal');
}

const oldAdminRole = "expect(screen.getByText('مدير المؤسسة (المدير الأساسي)')).toBeInTheDocument();";
const newAdminRole = "expect(screen.getByText('إدارة المنظومة (المشرف العام)')).toBeInTheDocument();";
if (content.includes(oldAdminRole)) {
  content = content.replace(oldAdminRole, newAdminRole);
}

const oldSuperAdmin = "expect(screen.getByText(/Platform Super Admin/i)).toBeInTheDocument();";
const newSuperAdmin = "expect(screen.queryByText(/Platform Super Admin/i)).not.toBeInTheDocument();";
if (content.includes(oldSuperAdmin)) {
  content = content.replace(oldSuperAdmin, newSuperAdmin);
}

fs.writeFileSync(file, content, 'utf8');
console.log('Successfully updated AuthPagesAndSplash.test.tsx');

