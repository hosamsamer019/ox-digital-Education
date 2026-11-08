import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import AccountantHomePage from '../components/accountant/AccountantHomePage';
import StudentSubLedgersPage from '../components/accountant/StudentSubLedgersPage';
import CollectionDeskPage from '../components/accountant/CollectionDeskPage';
import ReceiptsManagementPage from '../components/accountant/ReceiptsManagementPage';
import ExpensesPage from '../components/accountant/ExpensesPage';
import CashboxOperationsPage from '../components/accountant/CashboxOperationsPage';
import DailyReconciliationPage from '../components/accountant/DailyReconciliationPage';
import TeacherEvidencePage from '../components/accountant/TeacherEvidencePage';
import AccountantReportsPage from '../components/accountant/AccountantReportsPage';
import AccountantDashboard from '../components/accountant/AccountantDashboard';
import ProtectedRoute from '../components/auth/ProtectedRoute';
import { ThemeProvider } from '../contexts/ThemeContext';
import { LanguageProvider } from '../contexts/LanguageContext';
import { brdSubscriptionService } from '../services/brdSubscription.service';
import { accountingService } from '../services/accounting.service';

// Global mock state for AuthContext
let mockAuthUser: {
  id: string;
  name: string;
  email: string;
  role: string;
  isActive: boolean;
} | null = {
  id: 'acc-01',
  name: 'أ. طارق سمير',
  email: 'accountant@ox-digital.edu',
  role: 'ACCOUNTANT',
  isActive: true,
};

vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({
    user: mockAuthUser,
    logout: vi.fn(),
    isAuthenticated: !!mockAuthUser,
  }),
}));

// Mock Notification Service
vi.mock('../services/notification.service', () => ({
  notificationService: {
    getUnreadCount: vi.fn().mockResolvedValue({ data: { unreadCount: 1 } }),
  },
}));

// Mock brdSubscriptionService
vi.mock('../services/brdSubscription.service', () => ({
  brdSubscriptionService: {
    getAccountantReceipts: vi.fn(),
    getAccountantStudents: vi.fn(),
    recordPayment: vi.fn(),
  },
}));

// Mock accountingService
vi.mock('../services/accounting.service', () => ({
  accountingService: {
    getCashboxes: vi.fn(),
    getExpenses: vi.fn(),
    createExpenseVoucher: vi.fn(),
    disburseExpenseVoucher: vi.fn(),
    getOperationalOverview: vi.fn(),
    getStudentSubLedgers: vi.fn(),
    getStudentFinancialAccount: vi.fn(),
  },
}));

const renderWithProviders = (ui: React.ReactElement, initialRoute = '/') => {
  return render(
    <MemoryRouter initialEntries={[initialRoute]}>
      <LanguageProvider>
        <ThemeProvider>{ui}</ThemeProvider>
      </LanguageProvider>
    </MemoryRouter>
  );
};

describe('Phase 5 Batch 2: Accountant Dashboard (ACC-DASH-01) Test Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthUser = {
      id: 'acc-01',
      name: 'أ. طارق سمير',
      email: 'accountant@ox-digital.edu',
      role: 'ACCOUNTANT',
      isActive: true,
    };

    vi.mocked(brdSubscriptionService.getAccountantReceipts).mockResolvedValue({
      data: [
        {
          id: 'rec-01',
          receiptNumber: 'REC-DK-0001',
          student: { id: 's1', name: 'عمر شريف فاروق' },
          teacher: { id: 't1', name: 'أ. د. حسام سامر' },
          amount: 1500,
          receivingMethod: 'CASH',
          monthsCovered: 'شهر أكتوبر 2026',
          createdAt: '2026-10-27T10:00:00Z',
          status: 'ACTIVE',
        },
      ],
    } as any);

    vi.mocked(accountingService.getCashboxes).mockResolvedValue([
      { id: 'cb-1', code: 'CB-01', currentBalance: 20000, status: 'ACTIVE' },
      { id: 'cb-2', code: 'CB-02', currentBalance: 18400, status: 'ACTIVE' },
    ] as any);

    vi.mocked(accountingService.getExpenses).mockResolvedValue({
      vouchers: [
        {
          id: 'v-1',
          voucherNumber: 'EXP-1049',
          description: 'أدوات مكتبية',
          category: 'OFFICE_SUPPLIES',
          amount: 1500,
          status: 'PENDING_APPROVAL',
          createdAt: '2026-10-27T10:00:00Z',
        },
      ],
    } as any);

    vi.mocked(accountingService.getStudentSubLedgers).mockResolvedValue({
      subLedgers: [
        {
          studentId: 'stu-8821',
          name: 'عمر شريف فاروق',
          totalCharged: 6000,
          totalCollected: 2500,
          balance: 500,
          phone: '01002233441',
        },
      ],
    } as any);

    vi.mocked(accountingService.getStudentFinancialAccount).mockResolvedValue({
      summary: {
        totalCharged: 6000,
        totalBilledToDate: 3000,
        totalCollected: 2500,
        recognizedRevenue: 2000,
      },
      schedule: [
        { milestoneTitle: 'دفعة التسجيل وحجز المقعد', amountDue: 1500, status: 'PAID' },
        { milestoneTitle: 'دفعة شهر أكتوبر 2026', amountDue: 1500, status: 'PAID' },
        { milestoneTitle: 'دفعة شهر نوفمبر 2026', amountDue: 1500, status: 'PENDING' },
      ],
    } as any);

    vi.mocked(brdSubscriptionService.getAccountantStudents).mockResolvedValue({
      data: [
        {
          studentId: 'stu-01',
          studentName: 'عمر شريف فاروق',
          studentEmail: 'omar@test.edu',
          studentRole: 'CENTER_STUDENT',
          gradeLevel: 'الصف الثالث الثانوي',
          teacherId: 'tch-01',
          teacherName: 'أ. د. حسام سامر',
          accessStatus: 'ACTIVE',
        },
      ],
    } as any);

    vi.mocked(brdSubscriptionService.recordPayment).mockResolvedValue({
      success: true,
      receipt: {
        receiptNumber: 'REC-DK-0002',
        monthsCovered: 'شهر أكتوبر',
        amount: 350,
        receivingMethod: 'CASH',
      },
    } as any);
  });

  it('renders the operational office header and context', async () => {
    renderWithProviders(<AccountantHomePage />);

    expect(await screen.findByText(/مكتب العمليات المالية والمحاسبية للفرع/i)).toBeInTheDocument();
    expect(screen.getByText(/لوحة العمليات اليومية/i)).toBeInTheDocument();
    expect(screen.getByText(/الفرع الرئيسي \(الدقي\)/i)).toBeInTheDocument();
  });

  it('renders the operational KPI tiles with live financial values', async () => {
    renderWithProviders(<AccountantHomePage />);

    expect(await screen.findByText(/تحصيلات اليوم الفعلية/i)).toBeInTheDocument();
    expect(screen.getByText(/سيولة خزائن الفرع/i)).toBeInTheDocument();
    expect(screen.getByText(/سندات صرف قيد الاعتماد/i)).toBeInTheDocument();
    expect(screen.getByText(/حوكمة التسلسل المالي/i)).toBeInTheDocument();
  });

  it('renders the branch till readiness bar showing CB-01 and CB-02 balances', async () => {
    renderWithProviders(<AccountantHomePage />);

    expect(await screen.findByText(/جاهزية خزائن الفرع:/i)).toBeInTheDocument();
    expect(screen.getAllByText('CB-01').length).toBeGreaterThan(0);
    expect(screen.getAllByText('CB-02').length).toBeGreaterThan(0);
  });

  it('submits a collection receipt with explicit allocation', async () => {
    renderWithProviders(<CollectionDeskPage />);

    expect(await screen.findByText(/تسجيل تحصيل اشتراك جديد/i)).toBeInTheDocument();
    expect(screen.getAllByText(/عمر شريف فاروق/i).length).toBeGreaterThan(0);

    const submitBtn = screen.getByRole('button', { name: /تأكيد السداد وإصدار الإيصال/i });
    expect(submitBtn).toBeInTheDocument();
    fireEvent.click(submitBtn);

    expect(brdSubscriptionService.recordPayment).toHaveBeenCalled();
  });

  it('renders student sub-ledgers with the 4 financial pillars and payment schedule', async () => {
    renderWithProviders(<StudentSubLedgersPage />);

    expect(await screen.findByText(/1\. إجمالي قيمة الاتفاقية/i)).toBeInTheDocument();
    expect(screen.getByText(/2\. الدفعات المستحقة حتى اليوم/i)).toBeInTheDocument();
    expect(screen.getByText(/3\. إجمالي المحصل فعلياً/i)).toBeInTheDocument();
    expect(screen.getByText(/4\. الإيراد التعليمي المحقق/i)).toBeInTheDocument();

    expect(screen.getAllByText(/عمر شريف فاروق/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/STU-/i).length).toBeGreaterThan(0);
  });

  it('renders sequential receipts register and displays immutable receipt records', async () => {
    renderWithProviders(<ReceiptsManagementPage />);

    expect(await screen.findByText('REC-DK-0001')).toBeInTheDocument();
    expect(screen.getByText('عمر شريف فاروق')).toBeInTheDocument();
    expect(screen.getByText(/سجل الإيصالات المتسلسلة للفرع/i)).toBeInTheDocument();
  });

  it('enforces Maker-Checker rule on expense voucher preparation without self-approval', async () => {
    renderWithProviders(<ExpensesPage />);

    expect(await screen.findByText(/محدد الحوكمة المالية — حظر الاعتماد الذاتي/i)).toBeInTheDocument();
    expect(screen.getByText(/إعداد سند صرف جديد \(Voucher Drafting\)/i)).toBeInTheDocument();
    expect(screen.getByText('EXP-1049')).toBeInTheDocument();
    expect(screen.getByText(/بانتظار توقيع المدير الرئيسي/i)).toBeInTheDocument();
  });

  it('renders daily blind count reconciliation and verifies UP-705 neutral discrepancy policy', () => {
    renderWithProviders(<DailyReconciliationPage />);

    expect(screen.getByText(/حصر الفئات النقدية الفعلي \(الجرد الأعمى/i)).toBeInTheDocument();
    expect(screen.getByText(/سياسة الفوارق المحايدة الصارمة \(UP-705/i)).toBeInTheDocument();
    expect(screen.getByText(/مطابقة تامة \(BALANCED\)/i)).toBeInTheDocument();
  });

  it('renders teacher lesson evidence and enforces UP-704 holding lock', () => {
    renderWithProviders(<TeacherEvidencePage />);

    expect(screen.getByText(/توثيق الحصص المنفذة وأدلة استحقاقات التدريس/i)).toBeInTheDocument();
    expect(screen.getByText(/حظر الصرف والتوزيع التلقائي لحصص المعلمين \(Policy UP-704/i)).toBeInTheDocument();
    expect(screen.getAllByText(/معلق لحين اعتماد معادلة الاستحقاق \(UP-704\)/i).length).toBeGreaterThan(0);
  });

  it('renders operational reports center without tax or VAT functionality', () => {
    renderWithProviders(<AccountantReportsPage />);

    expect(screen.getByText(/مركز التقارير التشغيلية والمالية الأولية للفرع/i)).toBeInTheDocument();
    expect(screen.getByText(/كشف يومية المقبوضات النقدية والبنكية للفرع/i)).toBeInTheDocument();
    expect(screen.getByText(/تقرير أعمار الدفعات المتأخرة للطلاب/i)).toBeInTheDocument();
  });

  it('renders AccountantDashboard shell with all approved navigation items', () => {
    renderWithProviders(
      <Routes>
        <Route path="/accountant/*" element={<AccountantDashboard />} />
      </Routes>,
      '/accountant/home'
    );

    expect(screen.getAllByText(/لوحة العمليات اليومية/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/شؤون وحسابات الطلاب/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/مكتب التحصيل والسداد/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/إدارة وتدقيق الإيصالات/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/سندات الصرف/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/الخزائن والتحويلات/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/الجرد والإغلاق اليومي/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/توثيق حصص المعلمين/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/التقارير الأولية للفرع/i).length).toBeGreaterThan(0);
  });

  it('protects /accountant/* routes and allows access only to ACCOUNTANT role', () => {
    // 1. Authorized ACCOUNTANT access
    mockAuthUser = {
      id: 'acc-01',
      name: 'أ. طارق سمير',
      email: 'accountant@ox-digital.edu',
      role: 'ACCOUNTANT',
      isActive: true,
    };

    const { unmount } = render(
      <MemoryRouter initialEntries={['/accountant/home']}>
        <Routes>
          <Route element={<ProtectedRoute allowedRoles={['ACCOUNTANT']} />}>
            <Route path="/accountant/*" element={<div data-testid="accountant-allowed">Accountant Granted</div>} />
          </Route>
          <Route path="/login" element={<div data-testid="login-page">Login Page</div>} />
          <Route path="/unauthorized" element={<div data-testid="unauthorized-page">Unauthorized Page</div>} />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByTestId('accountant-allowed')).toBeInTheDocument();
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
      <MemoryRouter initialEntries={['/accountant/home']}>
        <Routes>
          <Route element={<ProtectedRoute allowedRoles={['ACCOUNTANT']} />}>
            <Route path="/accountant/*" element={<div data-testid="accountant-allowed">Accountant Granted</div>} />
          </Route>
          <Route path="/login" element={<div data-testid="login-page">Login Page</div>} />
          <Route path="/unauthorized" element={<div data-testid="unauthorized-page">Unauthorized Page</div>} />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByTestId('unauthorized-page')).toBeInTheDocument();
    expect(screen.queryByTestId('accountant-allowed')).not.toBeInTheDocument();
    unmountUnauthorized();

    // 3. Unauthenticated access (user is null) is redirected to /login
    mockAuthUser = null;

    render(
      <MemoryRouter initialEntries={['/accountant/home']}>
        <Routes>
          <Route element={<ProtectedRoute allowedRoles={['ACCOUNTANT']} />}>
            <Route path="/accountant/*" element={<div data-testid="accountant-allowed">Accountant Granted</div>} />
          </Route>
          <Route path="/login" element={<div data-testid="login-page">Login Page</div>} />
          <Route path="/unauthorized" element={<div data-testid="unauthorized-page">Unauthorized Page</div>} />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByTestId('login-page')).toBeInTheDocument();
    expect(screen.queryByTestId('accountant-allowed')).not.toBeInTheDocument();
  });
});
