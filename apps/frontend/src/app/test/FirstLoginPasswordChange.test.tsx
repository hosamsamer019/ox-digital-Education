import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import FirstLoginChangePasswordPage from '../components/auth/FirstLoginChangePasswordPage';
import ProtectedRoute from '../components/auth/ProtectedRoute';
import { userService } from '../services/user.service';

// Mock AuthContext
let mockUser: any = null;
let mockIsAuthenticated = false;
const mockMarkPasswordChanged = vi.fn();
const mockLogout = vi.fn();

vi.mock('../contexts/AuthContext', async (importOriginal) => {
  const actual: any = await importOriginal();
  return {
    ...actual,
    useAuth: () => ({
      user: mockUser,
      isAuthenticated: mockIsAuthenticated,
      markPasswordChanged: mockMarkPasswordChanged,
      logout: mockLogout,
    }),
    getDefaultRouteForRole: (role: string) => (role === 'ACCOUNTANT' ? '/accountant/home' : '/'),
  };
});

vi.mock('../services/user.service', () => ({
  userService: {
    changePassword: vi.fn(),
  },
}));

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

describe('Phase 5.2: First-Login Password Change & Protection Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUser = null;
    mockIsAuthenticated = false;
  });

  it('1. Redirects unauthenticated users to /login', () => {
    mockUser = null;
    mockIsAuthenticated = false;

    render(
      <MemoryRouter initialEntries={['/first-login/change-password']}>
        <Routes>
          <Route path="/first-login/change-password" element={<FirstLoginChangePasswordPage />} />
          <Route path="/login" element={<div data-testid="login-page">Login Page</div>} />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByTestId('login-page')).toBeInTheDocument();
  });

  it('2. Redirects users who already have permanent passwords to their home dashboard', () => {
    mockUser = {
      id: 'acc-01',
      name: 'محاسب معتمد',
      role: 'ACCOUNTANT',
      mustChangePassword: false,
    };
    mockIsAuthenticated = true;

    render(
      <MemoryRouter initialEntries={['/first-login/change-password']}>
        <Routes>
          <Route path="/first-login/change-password" element={<FirstLoginChangePasswordPage />} />
          <Route path="/accountant/home" element={<div data-testid="accountant-home">Accountant Home</div>} />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByTestId('accountant-home')).toBeInTheDocument();
  });

  it('3. Renders FirstLoginChangePasswordPage when mustChangePassword is true', () => {
    mockUser = {
      id: 'acc-01',
      name: 'أحمد محمود',
      role: 'ACCOUNTANT',
      mustChangePassword: true,
    };
    mockIsAuthenticated = true;

    render(
      <MemoryRouter initialEntries={['/first-login/change-password']}>
        <Routes>
          <Route path="/first-login/change-password" element={<FirstLoginChangePasswordPage />} />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText('تعيين كلمة المرور الدائمة')).toBeInTheDocument();
    expect(screen.getByText(/إجراء أمني إلزامي/i)).toBeInTheDocument();
    expect(screen.getByTestId('current-temp-password-input')).toBeInTheDocument();
    expect(screen.getByTestId('new-permanent-password-input')).toBeInTheDocument();
    expect(screen.getByTestId('confirm-new-password-input')).toBeInTheDocument();
    expect(screen.getByTestId('submit-first-login-btn')).toBeInTheDocument();
  });

  it('4. Enforces validation: blocks submission when password is too short or mismatched', () => {
    mockUser = {
      id: 'acc-01',
      name: 'أحمد محمود',
      role: 'ACCOUNTANT',
      mustChangePassword: true,
    };
    mockIsAuthenticated = true;

    render(
      <MemoryRouter initialEntries={['/first-login/change-password']}>
        <Routes>
          <Route path="/first-login/change-password" element={<FirstLoginChangePasswordPage />} />
        </Routes>
      </MemoryRouter>
    );

    const submitBtn = screen.getByTestId('submit-first-login-btn');
    expect(submitBtn).toBeDisabled();

    const currentInput = screen.getByTestId('current-temp-password-input');
    const newInput = screen.getByTestId('new-permanent-password-input');
    const confirmInput = screen.getByTestId('confirm-new-password-input');

    // Fill short password
    fireEvent.change(currentInput, { target: { value: 'Temp1234' } });
    fireEvent.change(newInput, { target: { value: 'short' } });
    fireEvent.change(confirmInput, { target: { value: 'short' } });

    expect(submitBtn).toBeDisabled();

    // Fill valid length but mismatched
    fireEvent.change(newInput, { target: { value: 'Permanent123!' } });
    fireEvent.change(confirmInput, { target: { value: 'Different123!' } });

    expect(submitBtn).toBeDisabled();

    // Fill matching valid permanent password
    fireEvent.change(confirmInput, { target: { value: 'Permanent123!' } });
    expect(submitBtn).not.toBeDisabled();
  });

  it('5. Successfully changes password, clears mustChangePassword, and routes to /accountant/home', async () => {
    mockUser = {
      id: 'acc-01',
      name: 'أحمد محمود',
      role: 'ACCOUNTANT',
      mustChangePassword: true,
    };
    mockIsAuthenticated = true;

    (userService.changePassword as any).mockResolvedValueOnce({
      success: true,
      message: 'تم تغيير كلمة المرور بنجاح',
      token: 'fresh-unrestricted-jwt-token',
    });

    render(
      <MemoryRouter initialEntries={['/first-login/change-password']}>
        <Routes>
          <Route path="/first-login/change-password" element={<FirstLoginChangePasswordPage />} />
          <Route path="/accountant/home" element={<div data-testid="accountant-dashboard">Accountant Dashboard Active</div>} />
        </Routes>
      </MemoryRouter>
    );

    const currentInput = screen.getByTestId('current-temp-password-input');
    const newInput = screen.getByTestId('new-permanent-password-input');
    const confirmInput = screen.getByTestId('confirm-new-password-input');
    const submitBtn = screen.getByTestId('submit-first-login-btn');

    fireEvent.change(currentInput, { target: { value: 'TemporaryPass123' } });
    fireEvent.change(newInput, { target: { value: 'PermanentSecure456!' } });
    fireEvent.change(confirmInput, { target: { value: 'PermanentSecure456!' } });

    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(userService.changePassword).toHaveBeenCalledWith('TemporaryPass123', 'PermanentSecure456!');
      expect(mockMarkPasswordChanged).toHaveBeenCalledWith('fresh-unrestricted-jwt-token');
      expect(screen.getByTestId('accountant-dashboard')).toBeInTheDocument();
    });
  });

  it('6. ProtectedRoute intercepts an Accountant with mustChangePassword=true attempting direct access', () => {
    mockUser = {
      id: 'acc-01',
      name: 'أحمد محمود',
      role: 'ACCOUNTANT',
      mustChangePassword: true,
    };
    mockIsAuthenticated = true;

    render(
      <MemoryRouter initialEntries={['/accountant/home']}>
        <Routes>
          <Route element={<ProtectedRoute allowedRoles={['ACCOUNTANT']} />}>
            <Route path="/accountant/home" element={<div data-testid="financial-ledger">Protected Financial Ledger</div>} />
          </Route>
          <Route path="/first-login/change-password" element={<div data-testid="password-change-screen">First Login Password Change Required</div>} />
        </Routes>
      </MemoryRouter>
    );

    // Assert that the protected ledger is NOT rendered
    expect(screen.queryByTestId('financial-ledger')).not.toBeInTheDocument();
    // Assert redirect to the first login screen
    expect(screen.getByTestId('password-change-screen')).toBeInTheDocument();
  });
});

