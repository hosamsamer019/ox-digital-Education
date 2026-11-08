import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import LoginPage from '../components/auth/LoginPage';
import ProtectedRoute from '../components/auth/ProtectedRoute';
import AccountantDashboard from '../components/accountant/AccountantDashboard';
import { ThemeProvider } from '../contexts/ThemeContext';
import { getDefaultRouteForRole, UserRole } from '../contexts/AuthContext';

// Mock AuthContext
let mockUser: any = null;
let mockIsAuthenticated = false;
const mockLogin = vi.fn();
const mockLogout = vi.fn();

vi.mock('../contexts/AuthContext', async (importOriginal) => {
  const actual: any = await importOriginal();
  return {
    ...actual,
    useAuth: () => ({
      user: mockUser,
      isAuthenticated: mockIsAuthenticated,
      login: mockLogin,
      logout: mockLogout,
    }),
  };
});

describe('Accountant Authentication & Login Journey Test Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUser = null;
    mockIsAuthenticated = false;
    localStorage.clear();
  });

  it('renders the Accountant role card on the unified login page alongside existing roles', () => {
    render(
      <MemoryRouter initialEntries={['/login']}>
        <ThemeProvider>
          <LoginPage />
        </ThemeProvider>
      </MemoryRouter>
    );

    // 1. Accountant role card is present on the unified login screen
    expect(screen.getByText(/محاسب الفرع/i)).toBeInTheDocument();
    expect(screen.getByText(/حسابات وتحصيلات الفرع/i)).toBeInTheDocument();
    expect(screen.getByText(/تحصيل الرسوم وإصدار الإيصالات/i)).toBeInTheDocument();

    // 2. Existing roles are preserved
    expect(screen.getByText('طالب أونلاين')).toBeInTheDocument();
    expect(screen.getByText('طالب سنتر')).toBeInTheDocument();
    expect(screen.getByText(/معلم \/ محاضر/i)).toBeInTheDocument();
    expect(screen.getByText('ولي أمر')).toBeInTheDocument();
    expect(screen.getByText(/إدارة المنظومة/i)).toBeInTheDocument();
  });

  it('Verification 1: Valid Accountant credentials submit role ACCOUNTANT and redirect to /accountant/home', async () => {
    mockLogin.mockResolvedValueOnce(true);

    render(
      <MemoryRouter initialEntries={['/login']}>
        <ThemeProvider>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/accountant/home" element={<div data-testid="accountant-home">Accountant Home Destination</div>} />
          </Routes>
        </ThemeProvider>
      </MemoryRouter>
    );

    // Click Accountant card
    fireEvent.click(screen.getByText(/محاسب الفرع/i));

    // Form fields should be visible
    const emailInput = screen.getByPlaceholderText('example@ox-digital.edu');
    const passwordInput = screen.getByPlaceholderText('••••••••');
    const submitBtn = screen.getByRole('button', { name: /تسجيل الدخول/i });

    fireEvent.change(emailInput, { target: { value: 'accountant@ox-digital.edu' } });
    fireEvent.change(passwordInput, { target: { value: 'CorrectPassword123' } });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalledWith('accountant@ox-digital.edu', 'CorrectPassword123', 'ACCOUNTANT');
      expect(screen.getByTestId('accountant-home')).toBeInTheDocument();
    });
  });

  it('Verification 2: Invalid credentials display normal login failure without crashing or redirecting', async () => {
    mockLogin.mockResolvedValueOnce(false);

    render(
      <MemoryRouter initialEntries={['/login']}>
        <ThemeProvider>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/accountant/home" element={<div data-testid="accountant-home">Should Not Render</div>} />
          </Routes>
        </ThemeProvider>
      </MemoryRouter>
    );

    // Select Accountant
    fireEvent.click(screen.getByText(/محاسب الفرع/i));

    fireEvent.change(screen.getByPlaceholderText('example@ox-digital.edu'), {
      target: { value: 'wrong@ox-digital.edu' },
    });
    fireEvent.change(screen.getByPlaceholderText('••••••••'), {
      target: { value: 'WrongPassword' },
    });
    fireEvent.click(screen.getByRole('button', { name: /تسجيل الدخول/i }));

    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalledWith('wrong@ox-digital.edu', 'WrongPassword', 'ACCOUNTANT');
      expect(screen.getByText(/البريد الإلكتروني أو كلمة المرور غير صحيحة/i)).toBeInTheDocument();
      expect(screen.queryByTestId('accountant-home')).not.toBeInTheDocument();
    });
  });

  it('Verification 3: Teacher login redirects to existing Teacher destination', () => {
    expect(getDefaultRouteForRole('TEACHER')).toBe('/teacher/home');
  });

  it('Verification 4: Student login redirects to existing Student destinations', () => {
    expect(getDefaultRouteForRole('ONLINE_STUDENT')).toBe('/student/online/home');
    expect(getDefaultRouteForRole('CENTER_STUDENT')).toBe('/student/center/home');
  });

  it('Verification 5: Primary Manager login redirects to existing Manager destination', () => {
    expect(getDefaultRouteForRole('PRIMARY_MANAGER')).toBe('/admin/home');
  });

  it('Verification 6: Unauthorized roles cannot access /accountant/* and are redirected to /unauthorized', () => {
    // Authenticated as TEACHER
    mockUser = {
      id: 'usr-teach',
      name: 'معلم معتمد',
      role: 'TEACHER',
      isActive: true,
    };
    mockIsAuthenticated = true;

    const { unmount } = render(
      <MemoryRouter initialEntries={['/accountant/home']}>
        <Routes>
          <Route element={<ProtectedRoute allowedRoles={['ACCOUNTANT']} />}>
            <Route path="/accountant/*" element={<div data-testid="accountant-screen">Protected Accountant Screen</div>} />
          </Route>
          <Route path="/unauthorized" element={<div data-testid="unauthorized-screen">Access Denied</div>} />
          <Route path="/login" element={<div data-testid="login-screen">Login</div>} />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByTestId('unauthorized-screen')).toBeInTheDocument();
    expect(screen.queryByTestId('accountant-screen')).not.toBeInTheDocument();
    unmount();

    // Authenticated as ONLINE_STUDENT
    mockUser = {
      id: 'usr-stu',
      name: 'طالب أونلاين',
      role: 'ONLINE_STUDENT',
      isActive: true,
    };
    mockIsAuthenticated = true;

    render(
      <MemoryRouter initialEntries={['/accountant/home']}>
        <Routes>
          <Route element={<ProtectedRoute allowedRoles={['ACCOUNTANT']} />}>
            <Route path="/accountant/*" element={<div data-testid="accountant-screen">Protected Accountant Screen</div>} />
          </Route>
          <Route path="/unauthorized" element={<div data-testid="unauthorized-screen">Access Denied</div>} />
          <Route path="/login" element={<div data-testid="login-screen">Login</div>} />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByTestId('unauthorized-screen')).toBeInTheDocument();
    expect(screen.queryByTestId('accountant-screen')).not.toBeInTheDocument();
  });

  it('Verification 7: Direct refresh of /accountant/home preserves valid authenticated access for ACCOUNTANT role', () => {
    // Authenticated Accountant user persisted in session
    mockUser = {
      id: 'acc-01',
      name: 'أ. طارق سمير (محاسب الفرع)',
      email: 'accountant@ox-digital.edu',
      role: 'ACCOUNTANT',
      isActive: true,
    };
    mockIsAuthenticated = true;

    render(
      <MemoryRouter initialEntries={['/accountant/home']}>
        <Routes>
          <Route element={<ProtectedRoute allowedRoles={['ACCOUNTANT']} />}>
            <Route path="/accountant/*" element={<div data-testid="accountant-screen">Valid Accountant Session Restored</div>} />
          </Route>
          <Route path="/login" element={<div data-testid="login-screen">Login</div>} />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByTestId('accountant-screen')).toBeInTheDocument();
    expect(screen.queryByTestId('login-screen')).not.toBeInTheDocument();
  });
});

