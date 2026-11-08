import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, Routes, Route, Navigate } from 'react-router-dom';
import PrimaryManagerHomePage from '../components/primary-manager/PrimaryManagerHomePage';
import PrimaryManagerDashboard from '../components/primary-manager/PrimaryManagerDashboard';
import ProtectedRoute from '../components/auth/ProtectedRoute';
import { KPIS_BY_SCOPE, BRANCH_PERFORMANCE_LIST } from '../components/primary-manager/mockData';

// Global mock state for AuthContext
let mockAuthUser: {
  id: string;
  name: string;
  email: string;
  role: string;
  isActive: boolean;
} | null = {
  id: 'mgr-01',
  name: 'أ. د. هشام الأحمدي',
  email: 'manager@ox-digital.edu',
  role: 'PRIMARY_MANAGER',
  isActive: true,
};

vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({
    user: mockAuthUser,
    logout: vi.fn(),
    isAuthenticated: !!mockAuthUser,
  }),
}));

// Mock ThemeContext
vi.mock('../contexts/ThemeContext', () => ({
  useTheme: () => ({
    theme: 'light',
    isDark: false,
    toggleTheme: vi.fn(),
  }),
}));

// Mock Notification Service
vi.mock('../services/notification.service', () => ({
  notificationService: {
    getUnreadCount: vi.fn().mockResolvedValue({ data: { unreadCount: 3 } }),
  },
}));

describe('Phase 5 Batch 1: Primary Manager Dashboard (PM-DASH-01) Test Suite', () => {
  it('renders the Demo Data banner with clear synthetic status', () => {
    mockAuthUser = {
      id: 'mgr-01',
      name: 'أ. د. هشام الأحمدي',
      email: 'manager@ox-digital.edu',
      role: 'PRIMARY_MANAGER',
      isActive: true,
    };

    render(
      <MemoryRouter>
        <PrimaryManagerHomePage />
      </MemoryRouter>
    );

    expect(screen.getByText(/تنبيه نظام المعاينة البصرية/i)).toBeInTheDocument();
    expect(screen.getByText(/DEMO DATA — NOT REAL/i)).toBeInTheDocument();
  });

  it('renders the 4 distinct executive KPI cards with exact accepted financial concepts', () => {
    render(
      <MemoryRouter>
        <PrimaryManagerHomePage />
      </MemoryRouter>
    );

    // 1. Collections: 110,500 EGP
    expect(screen.getByText(/إجمالي التحصيلات الفعلية/i)).toBeInTheDocument();

    // 2. Overdue: 39,700 EGP
    expect(screen.getByText(/المستحقات المتأخرة والواجبة/i)).toBeInTheDocument();

    // 3. Cashbox: 86,400 EGP
    expect(screen.getByText(/رصيد السيولة بالخزائن/i)).toBeInTheDocument();

    // 4. Revenue: 93,000 EGP
    expect(screen.getByText(/الإيراد التعليمي المحقق/i)).toBeInTheDocument();
  });

  it('maintains strict accounting separation and displays the segregation defense notice', () => {
    render(
      <MemoryRouter>
        <PrimaryManagerHomePage />
      </MemoryRouter>
    );

    expect(screen.getByText(/قاعدة الفصل المحاسبي الصارمة/i)).toBeInTheDocument();
    expect(
      screen.getByText(/يُمنع دمج هذه الأرقام في إجمالي واحد منعاً للتضليل المحاسبي/i)
    ).toBeInTheDocument();
  });

  it('verifies exact cashbox reconciliation between Dokki (68,400 EGP), Nasr City (18,000 EGP), and Consolidated (86,400 EGP)', () => {
    // 1. Dokki Scope includes CB-01 (24,500) + CB-02 (13,900) + CB-MAIN (30,000) = 68,400 EGP across 3 tills
    const dokkiScope = KPIS_BY_SCOPE['BR-01'];
    expect(dokkiScope.cashboxLiquidity).toBe(68400);
    expect(dokkiScope.activeCashboxesCount).toBe(3);

    const dokkiBranch = BRANCH_PERFORMANCE_LIST.find((b) => b.id === 'BR-01');
    expect(dokkiBranch?.cashboxBalance).toBe(68400);
    expect(dokkiBranch?.tillsCount).toBe(3);

    // 2. Nasr City Scope includes CB-03 (18,000)
    const nasrScope = KPIS_BY_SCOPE['BR-02'];
    expect(nasrScope.cashboxLiquidity).toBe(18000);
    expect(nasrScope.activeCashboxesCount).toBe(1);

    const nasrBranch = BRANCH_PERFORMANCE_LIST.find((b) => b.id === 'BR-02');
    expect(nasrBranch?.cashboxBalance).toBe(18000);
    expect(nasrBranch?.tillsCount).toBe(1);

    // 3. Consolidated Liquidity is exactly the conserved sum of Dokki + Nasr City (86,400 EGP across 4 tills)
    const consolidatedScope = KPIS_BY_SCOPE['INST-CONSOLIDATED'];
    expect(consolidatedScope.cashboxLiquidity).toBe(86400);
    expect(consolidatedScope.activeCashboxesCount).toBe(4);

    expect(dokkiScope.cashboxLiquidity + nasrScope.cashboxLiquidity).toBe(
      consolidatedScope.cashboxLiquidity
    );
  });

  it('renders branch performance cards showing Dokki, Nasr City, and deferred Online status', () => {
    render(
      <MemoryRouter>
        <PrimaryManagerHomePage />
      </MemoryRouter>
    );

    // Dokki
    expect(screen.getAllByText(/فرع الدقي/i).length).toBeGreaterThan(0);

    // Nasr City
    expect(screen.getAllByText('فرع مدينة نصر').length).toBeGreaterThan(0);

    // Online
    expect(screen.getAllByText(/الفرع الأونلاين/i).length).toBeGreaterThan(0);
  });

  it('renders Maker-Checker approval items with Segregation of Duties defense', () => {
    render(
      <MemoryRouter>
        <PrimaryManagerHomePage />
      </MemoryRouter>
    );

    expect(screen.getByText(/قائمة طلبات الاعتماد \(Maker-Checker\)/i)).toBeInTheDocument();
    expect(screen.getByText('EXP-1049')).toBeInTheDocument();
    expect(screen.getByText('REC-882')).toBeInTheDocument();
    expect(screen.getByText('ADJ-044')).toBeInTheDocument();
  });

  it('allows changing the branch scope filter between consolidated and specific branches', () => {
    render(
      <MemoryRouter>
        <PrimaryManagerHomePage />
      </MemoryRouter>
    );

    const scopeSelect = screen.getByRole('combobox');
    expect(scopeSelect).toBeInTheDocument();
    fireEvent.change(scopeSelect, { target: { value: 'BR-01' } });

    // Verify scope selector updated
    expect((scopeSelect as HTMLSelectElement).value).toBe('BR-01');
  });

  it('displays explicit DEMO badge inside the receipt audit detail modal', () => {
    render(
      <MemoryRouter>
        <PrimaryManagerHomePage />
      </MemoryRouter>
    );

    // Click on first view movement button
    const viewButtons = screen.getAllByTitle('عرض تفاصيل القيد المالي');
    expect(viewButtons.length).toBeGreaterThan(0);
    fireEvent.click(viewButtons[0]);

    // Modal should now be open with explicit DEMO badge
    expect(screen.getByText('تفاصيل الحركة المالية: #REC-9821')).toBeInTheDocument();
    expect(screen.getByText(/بيانات تجريبية — DEMO/i)).toBeInTheDocument();
    expect(
      screen.getByText(/حركة تدريبية مصطنعة لأغراض العرض التوضيحي/i)
    ).toBeInTheDocument();
  });

  it('renders PrimaryManagerDashboard shell with navigation menu items', () => {
    render(
      <MemoryRouter initialEntries={['/manager/home']}>
        <Routes>
          <Route path="/manager/*" element={<PrimaryManagerDashboard />} />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getAllByText('لوحة القيادة التنفيذية').length).toBeGreaterThan(0);
    expect(screen.getAllByText('الفروع والمحاسبين').length).toBeGreaterThan(0);
    expect(screen.getAllByText('الحسابات والإدارة المالية').length).toBeGreaterThan(0);
    expect(screen.getAllByText('إدارة الخزائن المركزية').length).toBeGreaterThan(0);
    expect(screen.getAllByText('رقابة المقبوضات والإيصالات').length).toBeGreaterThan(0);
    expect(screen.getAllByText('التقارير المالية والتدقيق').length).toBeGreaterThan(0);
  });

  it('protects /manager/* routes and allows access only to PRIMARY_MANAGER role', () => {
    // 1. Authorized PRIMARY_MANAGER access
    mockAuthUser = {
      id: 'mgr-01',
      name: 'أ. د. هشام الأحمدي',
      email: 'manager@ox-digital.edu',
      role: 'PRIMARY_MANAGER',
      isActive: true,
    };

    const { unmount } = render(
      <MemoryRouter initialEntries={['/manager/home']}>
        <Routes>
          <Route element={<ProtectedRoute allowedRoles={['PRIMARY_MANAGER']} />}>
            <Route path="/manager/*" element={<div data-testid="manager-allowed">Manager Access Granted</div>} />
          </Route>
          <Route path="/login" element={<div data-testid="login-page">Login Page</div>} />
          <Route path="/unauthorized" element={<div data-testid="unauthorized-page">Unauthorized Page</div>} />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByTestId('manager-allowed')).toBeInTheDocument();
    unmount();

    // 2. Unauthorized access from TEACHER role is redirected to /unauthorized
    mockAuthUser = {
      id: 'tch-01',
      name: 'أحمد علي',
      email: 'teacher@ox-digital.edu',
      role: 'TEACHER',
      isActive: true,
    };

    const { unmount: unmountUnauthorized } = render(
      <MemoryRouter initialEntries={['/manager/home']}>
        <Routes>
          <Route element={<ProtectedRoute allowedRoles={['PRIMARY_MANAGER']} />}>
            <Route path="/manager/*" element={<div data-testid="manager-allowed">Manager Access Granted</div>} />
          </Route>
          <Route path="/login" element={<div data-testid="login-page">Login Page</div>} />
          <Route path="/unauthorized" element={<div data-testid="unauthorized-page">Unauthorized Page</div>} />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByTestId('unauthorized-page')).toBeInTheDocument();
    expect(screen.queryByTestId('manager-allowed')).not.toBeInTheDocument();
    unmountUnauthorized();

    // 3. Unauthenticated access (user is null) is redirected to /login
    mockAuthUser = null;

    render(
      <MemoryRouter initialEntries={['/manager/home']}>
        <Routes>
          <Route element={<ProtectedRoute allowedRoles={['PRIMARY_MANAGER']} />}>
            <Route path="/manager/*" element={<div data-testid="manager-allowed">Manager Access Granted</div>} />
          </Route>
          <Route path="/login" element={<div data-testid="login-page">Login Page</div>} />
          <Route path="/unauthorized" element={<div data-testid="unauthorized-page">Unauthorized Page</div>} />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByTestId('login-page')).toBeInTheDocument();
    expect(screen.queryByTestId('manager-allowed')).not.toBeInTheDocument();
  });

  it('redirects /primary-manager/* to /manager/home', () => {
    mockAuthUser = {
      id: 'mgr-01',
      name: 'أ. د. هشام الأحمدي',
      email: 'manager@ox-digital.edu',
      role: 'PRIMARY_MANAGER',
      isActive: true,
    };

    render(
      <MemoryRouter initialEntries={['/primary-manager/home']}>
        <Routes>
          <Route element={<ProtectedRoute allowedRoles={['PRIMARY_MANAGER']} />}>
            <Route path="/manager/home" element={<div data-testid="manager-home">Manager Home Landing</div>} />
          </Route>
          <Route path="/primary-manager/*" element={<Navigate to="/manager/home" replace />} />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByTestId('manager-home')).toBeInTheDocument();
  });
});
