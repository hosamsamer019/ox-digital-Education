const fs = require('fs');
const p = 'D:/OX-DIGITAL/Mathe/OX-DIGITAL-GITHUB/apps/frontend/src/app/test/AuthPagesAndSplash.test.tsx';
let s = fs.readFileSync(p, 'utf8');

s = s.replace(
  "case 'ADMIN': return '/admin/home';",
  "case 'ADMIN': return '/admin/home';\n      case 'PRIMARY_MANAGER': return '/manager/home';\n      case 'ACCOUNTANT': return '/accountant/home';"
);

s = s.replace(
  "it('renders all 5 user roles on initial step', () => {",
  "it('renders all institutional user roles and platform admin portal on initial step', () => {"
);

s = s.replace(
  /expect\(screen\.getByText\('طالب أونلاين'\)\)\.toBeInTheDocument\(\);[\s\S]*?expect\(screen\.getByText\('تسجيل دخول المدير العام للإدارة'\)\)\.toBeInTheDocument\(\);/,
  `expect(screen.getByText('مدير المؤسسة (المدير الأساسي)')).toBeInTheDocument();
      expect(screen.getByText('محاسب الفرع')).toBeInTheDocument();
      expect(screen.getByText('طالب أونلاين')).toBeInTheDocument();
      expect(screen.getByText('طالب سنتر')).toBeInTheDocument();
      expect(screen.getByText('معلم / محاضر')).toBeInTheDocument();
      expect(screen.getByText('ولي أمر')).toBeInTheDocument();
      expect(screen.getByText(/Platform Super Admin/i)).toBeInTheDocument();`
);

fs.writeFileSync(p, s, 'utf8');
console.log('PATCHED AUTH TEST');

