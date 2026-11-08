import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ThemeProvider } from '../contexts/ThemeContext';
import LoginPage from '../components/auth/LoginPage';
import AdminLoginPage from '../components/auth/AdminLoginPage';
import ForgotPasswordPage from '../components/auth/ForgotPasswordPage';
import ResetPasswordPage from '../components/auth/ResetPasswordPage';
import PermissionDeniedPage from '../components/auth/PermissionDeniedPage';
import SplashScreen from '../components/ui/SplashScreen';

// Mock useAuth
const mockLogin = vi.fn();
const mockLogout = vi.fn();
let mockUser: any = null;
let mockIsAuthenticated = false;

vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({
    user: mockUser,
    isAuthenticated: mockIsAuthenticated,
    login: mockLogin,
    logout: mockLogout,
  }),
  getDefaultRouteForRole: (role: string) => {
    switch (role) {
      case 'ONLINE_STUDENT': return '/student/online/home';
      case 'CENTER_STUDENT': return '/student/center/home';
      case 'TEACHER': return '/teacher/home';
      case 'PARENT': return '/parent/home';
      case 'ADMIN': return '/admin/home';
      case 'PRIMARY_MANAGER': return '/manager/home';
      case 'ACCOUNTANT': return '/accountant/home';
      default: return '/';
    }
  },
}));

describe('Phase 4: Auth Pages, Splash Screen & Theme Verification', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUser = null;
    mockIsAuthenticated = false;
    localStorage.clear();
  });

  describe('LoginPage', () => {
    it('renders brand identity and multi-subject positioning', () => {
      render(
        <MemoryRouter>
          <ThemeProvider>
            <LoginPage />
          </ThemeProvider>
        </MemoryRouter>
      );

      // Product title & official Arabic subtitle
      expect(screen.getByText('OX-DIGITAL Education')).toBeInTheDocument();
      expect(screen.getByText('منصة التعليم الذكي المتكاملة')).toBeInTheDocument();

      // Ensure no math-only product branding exists
      expect(screen.queryByText(/منصة تعليم الرياضيات الذكية/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/يمكنك الدخول بأي بريد إلكتروني لتجربة المنصة/i)).not.toBeInTheDocument();
    });

    it('renders all institutional user roles on unified login portal', () => {
      render(
        <MemoryRouter>
          <ThemeProvider>
            <LoginPage />
          </ThemeProvider>
        </MemoryRouter>
      );

      expect(screen.getByText(/إدارة المنظومة/i)).toBeInTheDocument();
      expect(screen.getByText(/محاسب الفرع/i)).toBeInTheDocument();
      expect(screen.getByText('طالب أونلاين')).toBeInTheDocument();
      expect(screen.getByText('طالب سنتر')).toBeInTheDocument();
      expect(screen.getByText(/معلم \/ محاضر/i)).toBeInTheDocument();
      expect(screen.getByText('ولي أمر')).toBeInTheDocument();
      expect(screen.queryByText(/Platform Super Admin/i)).not.toBeInTheDocument();
    });

    it('transitions to credentials form upon selecting a role and allows going back', () => {
      render(
        <MemoryRouter>
          <ThemeProvider>
            <LoginPage />
          </ThemeProvider>
        </MemoryRouter>
      );

      // Click on Online Student role
      fireEvent.click(screen.getByText('طالب أونلاين'));

      // Form fields should now be visible
      expect(screen.getByPlaceholderText('example@ox-digital.edu')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('••••••••')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /تسجيل الدخول/i })).toBeInTheDocument();

      // Go back to role selection
      fireEvent.click(screen.getByText('تغيير الحساب'));
      expect(screen.getByText('طالب أونلاين')).toBeInTheDocument();
      expect(screen.getByText('طالب سنتر')).toBeInTheDocument();
    });

    it('provides an accessible theme toggle that switches themes', () => {
      render(
        <MemoryRouter>
          <ThemeProvider>
            <LoginPage />
          </ThemeProvider>
        </MemoryRouter>
      );

      const themeToggle = screen.getByRole('button', { name: /تبديل إلى الوضع/i });
      expect(themeToggle).toBeInTheDocument();

      const initialTheme = document.documentElement.getAttribute('data-theme');
      fireEvent.click(themeToggle);
      const newTheme = document.documentElement.getAttribute('data-theme');
      expect(newTheme).not.toBe(initialTheme);
      expect(localStorage.getItem('edu-theme')).toBe(newTheme);
    });
  });

  describe('AdminLoginPage', () => {
    it('renders admin portal with official brand and security notice', () => {
      render(
        <MemoryRouter>
          <ThemeProvider>
            <AdminLoginPage />
          </ThemeProvider>
        </MemoryRouter>
      );

      expect(screen.getByText('دخول إدارة المنظومة')).toBeInTheDocument();
      expect(screen.getByText(/بوابة الإدارة العامة المحمية/i)).toBeInTheDocument();
      expect(screen.getByPlaceholderText('admin@ox-digital.edu')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /دخول لوحة الإدارة/i })).toBeInTheDocument();
      expect(screen.getByText(/العودة لصفحة تسجيل الدخول الرئيسية/i)).toBeInTheDocument();
    });
  });

  describe('ForgotPasswordPage', () => {
    it('renders reset request form with institutional branding', () => {
      render(
        <MemoryRouter>
          <ThemeProvider>
            <ForgotPasswordPage />
          </ThemeProvider>
        </MemoryRouter>
      );

      expect(screen.getByText('استعادة كلمة المرور')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('example@ox-digital.edu')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /إرسال رابط الاستعادة/i })).toBeInTheDocument();
    });
  });

  describe('ResetPasswordPage', () => {
    it('renders reset password form with inputs and theme toggle', () => {
      render(
        <MemoryRouter initialEntries={['/reset-password?token=valid-secret-token']}>
          <ThemeProvider>
            <ResetPasswordPage />
          </ThemeProvider>
        </MemoryRouter>
      );

      expect(screen.getByText('تعيين كلمة مرور جديدة')).toBeInTheDocument();
      expect(screen.getAllByPlaceholderText('••••••••').length).toBe(2);
      expect(screen.getByRole('button', { name: /حفظ كلمة المرور الجديدة/i })).toBeInTheDocument();
    });

    it('shows error message if submitted without a token', async () => {
      render(
        <MemoryRouter initialEntries={['/reset-password']}>
          <ThemeProvider>
            <ResetPasswordPage />
          </ThemeProvider>
        </MemoryRouter>
      );

      const passwordInputs = screen.getAllByPlaceholderText('••••••••');
      fireEvent.change(passwordInputs[0], { target: { value: 'Secret12345!' } });
      fireEvent.change(passwordInputs[1], { target: { value: 'Secret12345!' } });

      const form = passwordInputs[0].closest('form')!;
      fireEvent.submit(form);

      expect(screen.getByText(/رابط استعادة كلمة المرور غير صالح أو منتهي الصلاحية/i)).toBeInTheDocument();
    });
  });

  describe('PermissionDeniedPage', () => {
    it('renders institutional denial state with return and logout actions', () => {
      render(
        <MemoryRouter>
          <ThemeProvider>
            <PermissionDeniedPage />
          </ThemeProvider>
        </MemoryRouter>
      );

      expect(screen.getByText('عذراً، الوصول غير مصرح')).toBeInTheDocument();
      expect(screen.getByText(/الحساب الحالي لا يمتلك الصلاحيات الأكاديمية الكافية/i)).toBeInTheDocument();
      expect(screen.getByText(/العودة للصفحة السابقة/i)).toBeInTheDocument();
      expect(screen.getByText(/تسجيل الخروج والتبديل لحساب آخر/i)).toBeInTheDocument();
    });
  });

  describe('SplashScreen', () => {
    it('renders official brand and multi-subject subtitle without duplicate H1', () => {
      render(<SplashScreen />);

      const heading = screen.getByRole('heading', { level: 2 });
      expect(heading).toHaveTextContent('OX-DIGITAL Education');
      expect(screen.getByText('منصة التعليم الذكي المتكاملة')).toBeInTheDocument();
    });
  });
});

