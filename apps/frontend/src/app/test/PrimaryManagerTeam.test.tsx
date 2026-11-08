import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import TeamManagementPage from '../components/primary-manager/TeamManagementPage';
import PrimaryManagerDashboard from '../components/primary-manager/PrimaryManagerDashboard';
import ProtectedRoute from '../components/auth/ProtectedRoute';
import { userService } from '../services/user.service';
import { INITIAL_TEAM_MEMBERS } from '../components/primary-manager/mockData';

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

vi.mock('../services/user.service', () => ({
  userService: {
    getTeamMembers: vi.fn(),
    createAccountant: vi.fn(),
    getManagerBranches: vi.fn(),
  },
}));

// Mock Sonner toast
vi.mock('sonner', () => ({
  toast: {
    info: vi.fn(),
    success: vi.fn(),
    error: vi.fn(),
  },
}));

describe('Primary Manager Team Management & Accountant Invitation Suite', () => {
  beforeEach(() => {
    mockAuthUser = {
      id: 'pm-01',
      name: 'أ. د. هشام الأحمدي',
      email: 'manager@ox-digital.edu',
      role: 'PRIMARY_MANAGER',
      isActive: true,
    };
    vi.clearAllMocks();
    vi.mocked(userService.getTeamMembers).mockResolvedValue(INITIAL_TEAM_MEMBERS);
    vi.mocked(userService.getManagerBranches).mockResolvedValue([
      { id: 'BR-01', name: 'فرع الدقي (المقر الرئيسي)' },
      { id: 'BR-02', name: 'فرع مدينة نصر' },
    ]);
    vi.mocked(userService.createAccountant).mockResolvedValue({
      user: {
        id: 'acc-new-01',
        name: 'عمر خالد المحاسب',
        email: 'omar.acc@cma-academy.edu',
        role: 'ACCOUNTANT',
        branchId: 'BR-01',
        branchName: 'فرع الدقي (المقر الرئيسي)',
        mustChangePassword: true,
      },
      temporaryPassword: 'TempPass2026!xyz',
      message: 'تم إنشاء حساب المحاسب بنجاح',
    });
  });

  it('renders Team Management page header, KPI cards, and team members roster', async () => {
    render(
      <MemoryRouter>
        <TeamManagementPage />
      </MemoryRouter>
    );

    // Header
    expect(screen.getByText('سجل فريق العمل وحوكمة المحاسبين المعتمدين')).toBeInTheDocument();
    expect(screen.getByText('إدارة فريق العمل والمحاسبين (PM-TEAM-01)')).toBeInTheDocument();

    // Summary Cards
    expect(screen.getByText('إجمالي المحاسبين')).toBeInTheDocument();
    expect(screen.getByText('دعوات بانتظار التفعيل')).toBeInTheDocument();
    expect(screen.getByText('صلاحية التعيين')).toBeInTheDocument();
    expect(screen.getByText('المدير الأساسي حصراً')).toBeInTheDocument();

    // Roster Members
    expect(await screen.findByText('سارة عبد الرحمن حسن')).toBeInTheDocument();
    expect(screen.getByText('sara.accountant@cma-academy.edu')).toBeInTheDocument();
    expect(screen.getByText('أحمد محمود رضوان')).toBeInTheDocument();
    expect(screen.getByText('ahmed.accountant@cma-academy.edu')).toBeInTheDocument();
  });

  it('filters team members by search term and branch', async () => {
    render(
      <MemoryRouter>
        <TeamManagementPage />
      </MemoryRouter>
    );

    expect(await screen.findByText('سارة عبد الرحمن حسن')).toBeInTheDocument();

    const searchInput = screen.getByTestId('team-search-input');

    // Filter by name
    fireEvent.change(searchInput, { target: { value: 'سارة' } });
    expect(screen.getByText('سارة عبد الرحمن حسن')).toBeInTheDocument();
    expect(screen.queryByText('أحمد محمود رضوان')).not.toBeInTheDocument();

    // Reset search
    fireEvent.change(searchInput, { target: { value: '' } });
    expect(screen.getByText('أحمد محمود رضوان')).toBeInTheDocument();

    // Branch filter: Nasr City
    const branchSelect = screen.getByTestId('branch-filter-select');
    fireEvent.change(branchSelect, { target: { value: 'BR-02' } });
    expect(screen.getByText('سارة عبد الرحمن حسن')).toBeInTheDocument();
    expect(screen.queryByText('أحمد محمود رضوان')).not.toBeInTheDocument();

    // Search for non-existent member -> empty state
    fireEvent.change(searchInput, { target: { value: 'اسم غير موجود إطلاقاً' } });
    expect(screen.getByTestId('team-empty-state')).toBeInTheDocument();
    expect(screen.getByText('لا توجد نتائج مطابقة لمعايير البحث')).toBeInTheDocument();
  });

  it('validates the invite accountant form and enforces fixed role ACCOUNTANT', async () => {
    render(
      <MemoryRouter>
        <TeamManagementPage />
      </MemoryRouter>
    );

    // Open invite modal
    const inviteBtn = screen.getByTestId('invite-accountant-btn');
    fireEvent.click(inviteBtn);

    // Modal appears
    expect(screen.getByTestId('invite-modal')).toBeInTheDocument();
    expect(screen.getByText('دعوة محاسب مالي جديد')).toBeInTheDocument();

    // Critical Gate Notice
    expect(screen.getByText(/حالة مسار الدعوات: بانتظار اعتماد بنية الرموز المشفرة/)).toBeInTheDocument();

    // Fixed role
    expect(screen.getByTestId('fixed-role-badge')).toHaveTextContent('ACCOUNTANT (محاسب معتمد)');
    expect(screen.getByText('مغلق بالحوكمة')).toBeInTheDocument();

    // Submit without input -> validation errors
    const submitBtn = screen.getByTestId('submit-invite-btn');
    fireEvent.click(submitBtn);

    expect(screen.getByText('يرجى إدخال الاسم الكامل للمحاسب')).toBeInTheDocument();
    expect(screen.getByText('يرجى إدخال البريد الإلكتروني')).toBeInTheDocument();

    // Fill invalid email
    const nameInput = screen.getByTestId('invite-name-input');
    const emailInput = screen.getByTestId('invite-email-input');

    fireEvent.change(nameInput, { target: { value: 'عمر خالد المحاسب' } });
    fireEvent.change(emailInput, { target: { value: 'invalid-email-format' } });
    fireEvent.click(submitBtn);

    expect(screen.getByText('صيغة البريد الإلكتروني غير صحيحة')).toBeInTheDocument();

    // Fill valid email and branch
    fireEvent.change(emailInput, { target: { value: 'omar.accountant@cma-academy.edu' } });
    const branchSelect = await screen.findByTestId('invite-branch-select');
    fireEvent.change(branchSelect, { target: { value: 'BR-01' } });

    fireEvent.click(submitBtn);

    // Modal closes and member is registered in table with PENDING_ACTIVATION
    await waitFor(() => {
      expect(screen.queryByTestId('invite-modal')).not.toBeInTheDocument();
    });
    expect(await screen.findByText('عمر خالد المحاسب')).toBeInTheDocument();
    expect(screen.getByText('omar.accountant@cma-academy.edu')).toBeInTheDocument();
  });

  it('displays the server-returned temporary password exactly once and does not generate client passwords', async () => {
    vi.mocked(userService.createAccountant).mockResolvedValueOnce({
      user: {
        id: 'acc-sec-01',
        name: 'كريم مالي',
        email: 'karim@ox-digital.edu',
        role: 'ACCOUNTANT',
        branchId: 'BR-01',
        branchName: 'فرع الدقي (المقر الرئيسي)',
        mustChangePassword: true,
      },
      temporaryPassword: 'ServerOnlySecretPass123!',
      message: 'تم إنشاء حساب المحاسب بنجاح',
    });

    render(
      <MemoryRouter>
        <TeamManagementPage />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByTestId('invite-accountant-btn'));
    fireEvent.change(screen.getByTestId('invite-name-input'), { target: { value: 'كريم مالي' } });
    fireEvent.change(screen.getByTestId('invite-email-input'), { target: { value: 'karim@ox-digital.edu' } });
    const branchSelect = await screen.findByTestId('invite-branch-select');
    fireEvent.change(branchSelect, { target: { value: 'BR-01' } });

    fireEvent.click(screen.getByTestId('submit-invite-btn'));

    // Temporary password modal appears with the server-supplied password
    const modal = await screen.findByTestId('temporary-password-modal');
    expect(modal).toBeInTheDocument();
    expect(screen.getByTestId('temp-password-display')).toHaveTextContent('ServerOnlySecretPass123!');

    // Close modal
    fireEvent.click(screen.getByTestId('close-temp-password-modal-btn'));
    expect(screen.queryByTestId('temporary-password-modal')).not.toBeInTheDocument();
  });

  it('verifies route access rules: allows PRIMARY_MANAGER and rejects unauthorized roles', () => {
    // 1. PRIMARY_MANAGER allowed
    mockAuthUser = {
      id: 'pm-01',
      name: 'أ. د. هشام الأحمدي',
      email: 'manager@ox-digital.edu',
      role: 'PRIMARY_MANAGER',
      isActive: true,
    };

    const { unmount } = render(
      <MemoryRouter initialEntries={['/manager/team']}>
        <Routes>
          <Route element={<ProtectedRoute allowedRoles={['PRIMARY_MANAGER']} />}>
            <Route path="/manager/team" element={<div data-testid="team-allowed">Team Page Rendered</div>} />
          </Route>
          <Route path="/unauthorized" element={<div data-testid="unauthorized-page">Unauthorized</div>} />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByTestId('team-allowed')).toBeInTheDocument();
    unmount();

    // 2. ACCOUNTANT denied access to /manager/team
    mockAuthUser = {
      id: 'acc-01',
      name: 'سارة عبد الرحمن',
      email: 'sara@cma-academy.edu',
      role: 'ACCOUNTANT',
      isActive: true,
    };

    const { unmount: unmountAccountant } = render(
      <MemoryRouter initialEntries={['/manager/team']}>
        <Routes>
          <Route element={<ProtectedRoute allowedRoles={['PRIMARY_MANAGER']} />}>
            <Route path="/manager/team" element={<div data-testid="team-allowed">Team Page Rendered</div>} />
          </Route>
          <Route path="/unauthorized" element={<div data-testid="unauthorized-page">Unauthorized</div>} />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByTestId('unauthorized-page')).toBeInTheDocument();
    expect(screen.queryByTestId('team-allowed')).not.toBeInTheDocument();
    unmountAccountant();

    // 3. SaaS ADMIN denied access through tenant Primary Manager route
    mockAuthUser = {
      id: 'admin-01',
      name: 'Super Admin',
      email: 'admin@edu.com',
      role: 'ADMIN',
      isActive: true,
    };

    const { unmount: unmountAdmin } = render(
      <MemoryRouter initialEntries={['/manager/team']}>
        <Routes>
          <Route element={<ProtectedRoute allowedRoles={['PRIMARY_MANAGER']} />}>
            <Route path="/manager/team" element={<div data-testid="team-allowed">Team Page Rendered</div>} />
          </Route>
          <Route path="/unauthorized" element={<div data-testid="unauthorized-page">Unauthorized</div>} />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByTestId('unauthorized-page')).toBeInTheDocument();
    expect(screen.queryByTestId('team-allowed')).not.toBeInTheDocument();
    unmountAdmin();

    // 4. TEACHER denied
    mockAuthUser = {
      id: 'tch-01',
      name: 'Teacher User',
      email: 'teacher@cma-academy.edu',
      role: 'TEACHER',
      isActive: true,
    };

    render(
      <MemoryRouter initialEntries={['/manager/team']}>
        <Routes>
          <Route element={<ProtectedRoute allowedRoles={['PRIMARY_MANAGER']} />}>
            <Route path="/manager/team" element={<div data-testid="team-allowed">Team Page Rendered</div>} />
          </Route>
          <Route path="/unauthorized" element={<div data-testid="unauthorized-page">Unauthorized</div>} />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByTestId('unauthorized-page')).toBeInTheDocument();
    expect(screen.queryByTestId('team-allowed')).not.toBeInTheDocument();
  });

  it('renders Team Management navigation item within PrimaryManagerDashboard shell', () => {
    mockAuthUser = {
      id: 'pm-01',
      name: 'أ. د. هشام الأحمدي',
      email: 'manager@ox-digital.edu',
      role: 'PRIMARY_MANAGER',
      isActive: true,
    };

    render(
      <MemoryRouter initialEntries={['/manager/home']}>
        <Routes>
          <Route path="/manager/*" element={<PrimaryManagerDashboard />} />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getAllByText('إدارة فريق العمل').length).toBeGreaterThan(0);
    expect(screen.getAllByText('لوحة القيادة التنفيذية').length).toBeGreaterThan(0);
    expect(screen.getAllByText('الفروع والمحاسبين').length).toBeGreaterThan(0);
  });
  it('displays error banner and retry action on network fetch failure', async () => {
    vi.mocked(userService.getTeamMembers).mockRejectedValueOnce(new Error('Network error'));

    render(
      <MemoryRouter>
        <TeamManagementPage />
      </MemoryRouter>
    );

    // Error banner appears
    const errorBanner = await screen.findByTestId('roster-error-banner');
    expect(errorBanner).toBeInTheDocument();
    expect(screen.getByText('فشل في تحميل سجل فريق العمل من الخادم. يرجى التحقق من الاتصال والمحاولة مرة أخرى.')).toBeInTheDocument();

    // Retry button is present
    const retryBtn = screen.getByTestId('roster-retry-btn');
    expect(retryBtn).toBeInTheDocument();
  });

  it('retries loading roster when retry button is clicked', async () => {
    vi.mocked(userService.getTeamMembers).mockRejectedValueOnce(new Error('Network error'));

    render(
      <MemoryRouter>
        <TeamManagementPage />
      </MemoryRouter>
    );

    const retryBtn = await screen.findByTestId('roster-retry-btn');
    expect(retryBtn).toBeInTheDocument();

    // Now mock resolves
    vi.mocked(userService.getTeamMembers).mockResolvedValueOnce(INITIAL_TEAM_MEMBERS);

    fireEvent.click(retryBtn);

    // Error banner disappears, team member appears
    expect(await screen.findByText('سارة عبد الرحمن حسن')).toBeInTheDocument();
    expect(screen.queryByTestId('roster-error-banner')).not.toBeInTheDocument();
  });

  it('renders empty roster state when no accountants are registered', async () => {
    vi.mocked(userService.getTeamMembers).mockResolvedValueOnce([]);

    render(
      <MemoryRouter>
        <TeamManagementPage />
      </MemoryRouter>
    );

    expect(await screen.findByText('لا توجد نتائج مطابقة لمعايير البحث')).toBeInTheDocument();
  });
});
