import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import ManagerAccountsPage from '../components/primary-manager/ManagerAccountsPage';
import PrimaryManagerDashboard from '../components/primary-manager/PrimaryManagerDashboard';
import ProtectedRoute from '../components/auth/ProtectedRoute';
import { accountingService } from '../services/accounting.service';

let mockAuthUser: {
  id: string;
  name: string;
  email: string;
  role: string;
  isActive: boolean;
} | null = {
  id: 'pm-01',
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

vi.mock('../contexts/ThemeContext', () => ({
  useTheme: () => ({
    theme: 'light',
    isDark: false,
    toggleTheme: vi.fn(),
  }),
}));

vi.mock('../services/notification.service', () => ({
  notificationService: {
    getUnreadCount: vi.fn().mockResolvedValue({ data: { unreadCount: 3 } }),
  },
}));

vi.mock('../services/accounting.service', () => ({
  accountingService: {
    getFinancialSummary: vi.fn(),
    getCollections: vi.fn(),
    getCashboxes: vi.fn(),
    getStudentSubLedgers: vi.fn(),
    getArrearsReport: vi.fn(),
    getExpenses: vi.fn(),
    getFinancialAccessPolicy: vi.fn(),
    approveExpenseVoucher: vi.fn(),
  },
}));

vi.mock('sonner', () => ({
  toast: {
    info: vi.fn(),
    success: vi.fn(),
    error: vi.fn(),
  },
}));

describe('Manager Accounts Page & Financial Dashboard Integration', () => {
  beforeEach(() => {
    mockAuthUser = {
      id: 'pm-01',
      name: 'أ. د. هشام الأحمدي',
      email: 'manager@ox-digital.edu',
      role: 'PRIMARY_MANAGER',
      isActive: true,
    };
    vi.clearAllMocks();

    vi.mocked(accountingService.getFinancialSummary).mockResolvedValue({
      currency: 'EGP',
      lifetime: {
        totalCollections: 125000,
        collectionsCount: 28,
        totalExpenses: 35000,
        expensesCount: 13,
        netOperatingBalance: 90000,
      },
      currentMonth: {
        totalCollections: 45000,
        collectionsCount: 10,
        totalExpenses: 12000,
        expensesCount: 4,
        netOperatingBalance: 33000,
      },
      liquidity: {
        cashInTills: 86400,
        activeCashboxesCount: 4,
      },
      receivables: {
        totalArrears: 39700,
        overdueObligationsCount: 15,
      },
    });

    vi.mocked(accountingService.getCollections).mockResolvedValue({
      collections: [
        {
          id: 'col-01',
          receiptNumber: 'REC-20261105-001',
          amountCollected: 1500,
          currency: 'EGP',
          collectedAt: new Date().toISOString(),
          student: { name: 'أحمد محمود رضوان' },
          cashier: { name: 'عمر خالد المحاسب' },
          cashbox: { name: 'خزينة الاستقبال 1' },
        },
      ],
      pagination: { total: 1, page: 1, limit: 20 },
    });

    vi.mocked(accountingService.getCashboxes).mockResolvedValue([
      {
        id: 'cb-01',
        code: 'CB-MAIN-01',
        name: 'الخزينة المركزية - فرع الدقي',
        currentBalance: 50000,
        currency: 'EGP',
        branch: { name: 'فرع الدقي' },
        assignedCashier: { name: 'عمر خالد' },
      },
    ]);

    vi.mocked(accountingService.getStudentSubLedgers).mockResolvedValue({
      students: [],
      pagination: { total: 0, page: 1, limit: 20 },
    });

    vi.mocked(accountingService.getArrearsReport).mockResolvedValue([
      {
        obligationId: 'ob-01',
        studentName: 'محمود علي',
        studentPhone: '01012345678',
        agreementNumber: 'AGR-2026-001',
        amountDue: 2000,
        amountCollected: 500,
        outstandingAmount: 1500,
        dueDate: '2026-11-01',
        daysOverdue: 4,
        currency: 'EGP',
      },
    ]);

    vi.mocked(accountingService.getExpenses).mockResolvedValue([
      {
        id: 'exp-01',
        voucherNumber: 'VOUCH-001',
        category: 'أدوات ومطبوعات تعليمية',
        payeeName: 'مطبعة الأهرام',
        amount: 3500,
        currency: 'EGP',
        status: 'PENDING_APPROVAL',
        createdAt: new Date().toISOString(),
      },
    ]);

    vi.mocked(accountingService.getFinancialAccessPolicy).mockResolvedValue({
      policyMode: 'GLOBAL',
      gracePeriodDays: 7,
      isEnabled: true,
    });
  });

  it('renders executive KPI cards with live backend summary data', async () => {
    render(
      <MemoryRouter>
        <ManagerAccountsPage />
      </MemoryRouter>
    );

    // Title and breadcrumb
    expect(screen.getByText('المركز المالي وحسابات المؤسسة المركزية')).toBeInTheDocument();
    expect(screen.getByText('الحسابات والإدارة المالية (PM-ACC-01)')).toBeInTheDocument();

    // KPI cards loaded from getFinancialSummary
    expect(await screen.findByText(/125,000 EGP/)).toBeInTheDocument(); // Total collections
    expect(screen.getByText(/86,400 EGP/)).toBeInTheDocument(); // Liquidity
    expect(screen.getByText(/39,700 EGP/)).toBeInTheDocument(); // Arrears
    expect(screen.getByText(/35,000 EGP/)).toBeInTheDocument(); // Operating expenses
  });

  it('renders recent collections table in overview tab', async () => {
    render(
      <MemoryRouter>
        <ManagerAccountsPage />
      </MemoryRouter>
    );

    expect(await screen.findByText('REC-20261105-001')).toBeInTheDocument();
    expect(screen.getByText('أحمد محمود رضوان')).toBeInTheDocument();
    expect(screen.getByText('+1,500 EGP')).toBeInTheDocument();
  });

  it('switches to cashboxes tab and displays central tills', async () => {
    render(
      <MemoryRouter>
        <ManagerAccountsPage />
      </MemoryRouter>
    );

    const cashboxTab = screen.getByTestId('tab-cashboxes');
    fireEvent.click(cashboxTab);

    expect(await screen.findByText('CB-MAIN-01')).toBeInTheDocument();
    expect(screen.getByText('الخزينة المركزية - فرع الدقي')).toBeInTheDocument();
    expect(screen.getByText('50,000 EGP')).toBeInTheDocument();
  });

  it('switches to arrears tab and displays student overdue records', async () => {
    render(
      <MemoryRouter>
        <ManagerAccountsPage />
      </MemoryRouter>
    );

    const subledgerTab = screen.getByTestId('tab-subledgers');
    fireEvent.click(subledgerTab);

    expect(await screen.findByText('محمود علي')).toBeInTheDocument();
    expect(screen.getByText('1,500 EGP')).toBeInTheDocument();
    expect(screen.getByText('4 يوم تأخير')).toBeInTheDocument();
  });

  it('switches to expenses tab and allows approving pending vouchers', async () => {
    vi.mocked(accountingService.approveExpenseVoucher).mockResolvedValueOnce({ success: true });

    render(
      <MemoryRouter>
        <ManagerAccountsPage />
      </MemoryRouter>
    );

    const expensesTab = screen.getByTestId('tab-expenses');
    fireEvent.click(expensesTab);

    expect(await screen.findByText('VOUCH-001')).toBeInTheDocument();
    expect(screen.getByText('مطبعة الأهرام')).toBeInTheDocument();

    const approveBtn = screen.getByRole('button', { name: 'اعتماد' });
    fireEvent.click(approveBtn);

    await waitFor(() => {
      expect(accountingService.approveExpenseVoucher).toHaveBeenCalledWith(
        'exp-01',
        'APPROVE',
        expect.any(String)
      );
    });
  });

  it('switches to policy tab and shows governance settings', async () => {
    render(
      <MemoryRouter>
        <ManagerAccountsPage />
      </MemoryRouter>
    );

    const policyTab = screen.getByTestId('tab-policy');
    fireEvent.click(policyTab);

    expect(await screen.findByText('حوكمة سياسة الرسوم الشهرية والمهلة')).toBeInTheDocument();
    expect(screen.getByText('موحد على المؤسسة (GLOBAL)')).toBeInTheDocument();
    expect(screen.getByText('7 أيام بعد الاستحقاق')).toBeInTheDocument();
    expect(screen.getByText('مفعل وقيد التشغيل')).toBeInTheDocument();
  });

  it('enforces role security: rejects ACCOUNTANT and TEACHER from /manager/accounts', () => {
    // 1. ACCOUNTANT denied
    mockAuthUser = {
      id: 'acc-01',
      name: 'Accountant User',
      email: 'acc@ox.com',
      role: 'ACCOUNTANT',
      isActive: true,
    };

    const { unmount } = render(
      <MemoryRouter initialEntries={['/manager/accounts']}>
        <Routes>
          <Route element={<ProtectedRoute allowedRoles={['PRIMARY_MANAGER']} />}>
            <Route path="/manager/accounts" element={<ManagerAccountsPage />} />
          </Route>
          <Route path="/unauthorized" element={<div data-testid="unauthorized-page">Unauthorized</div>} />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByTestId('unauthorized-page')).toBeInTheDocument();
    expect(screen.queryByText('المركز المالي وحسابات المؤسسة المركزية')).not.toBeInTheDocument();
    unmount();

    // 2. TEACHER denied
    mockAuthUser = {
      id: 'tch-01',
      name: 'Teacher User',
      email: 'teacher@ox.com',
      role: 'TEACHER',
      isActive: true,
    };

    render(
      <MemoryRouter initialEntries={['/manager/accounts']}>
        <Routes>
          <Route element={<ProtectedRoute allowedRoles={['PRIMARY_MANAGER']} />}>
            <Route path="/manager/accounts" element={<ManagerAccountsPage />} />
          </Route>
          <Route path="/unauthorized" element={<div data-testid="unauthorized-page">Unauthorized</div>} />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByTestId('unauthorized-page')).toBeInTheDocument();
    expect(screen.queryByText('المركز المالي وحسابات المؤسسة المركزية')).not.toBeInTheDocument();
  });

  it('renders Accounts navigation item within PrimaryManagerDashboard navigation shell', () => {
    mockAuthUser = {
      id: 'pm-01',
      name: 'أ. د. هشام الأحمدي',
      email: 'manager@ox-digital.edu',
      role: 'PRIMARY_MANAGER',
      isActive: true,
    };

    render(
      <MemoryRouter initialEntries={['/manager/accounts']}>
        <Routes>
          <Route path="/manager/*" element={<PrimaryManagerDashboard />} />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getAllByText('الحسابات والإدارة المالية').length).toBeGreaterThan(0);
  });
});
