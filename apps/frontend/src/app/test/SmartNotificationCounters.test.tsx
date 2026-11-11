import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, renderHook, act } from '@testing-library/react';
import { MemoryRouter, useNavigate } from 'react-router-dom';
import { adminMenuItems } from '../components/admin/AdminDashboard';
import ContextualGuidanceBanner, { resolveStateAwareGuidance } from '../components/shared/ContextualGuidanceBanner';
import AccountSettingsPage from '../components/shared/AccountSettingsPage';
import { useSmartNavigationCounters } from '../hooks/useSmartNavigationCounters';
import { accountingService } from '../services/accounting.service';
import { notificationService } from '../services/notification.service';
import { homeworkService } from '../services/homework.service';
import { userService } from '../services/user.service';

let currentMockUser: any = {
  id: 'user-1',
  name: 'Test User',
  email: 'test@ox-digital.edu',
  role: 'ADMIN',
};

let currentLanguage = 'ar';

vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({
    user: currentMockUser,
    token: 'mock-token',
    logout: vi.fn(),
    isAuthenticated: !!currentMockUser,
  }),
}));

vi.mock('../contexts/LanguageContext', () => ({
  useLanguage: () => ({
    language: currentLanguage,
    setLanguage: vi.fn(),
    t: (key: string, fallback?: string) => fallback || key,
    dir: currentLanguage === 'ar' ? 'rtl' : 'ltr',
    isRtl: currentLanguage === 'ar',
  }),
  t: (key: string, fallback?: string) => fallback || key,
}));

vi.mock('../contexts/ThemeContext', () => ({
  useTheme: () => ({
    theme: 'default',
    setTheme: vi.fn(),
    isDark: false,
  }),
  resolveThemeAlias: (t?: string) => t || 'default',
}));

vi.mock('../services/accounting.service', () => ({
  accountingService: {
    getExpenses: vi.fn(),
    getArrearsReport: vi.fn(),
  },
}));

vi.mock('../services/notification.service', () => ({
  notificationService: {
    getUnreadCount: vi.fn(),
  },
}));

vi.mock('../services/homework.service', () => ({
  homeworkService: {
    getStudentHomework: vi.fn(),
    getHomeworks: vi.fn(),
    getPendingCount: vi.fn(),
  },
}));

vi.mock('../services/brdSubscription.service', () => ({
  brdSubscriptionService: {
    getAccountSettings: vi.fn().mockResolvedValue({ success: true, data: {} }),
    updateAccountSettings: vi.fn().mockResolvedValue({ success: true }),
    uploadProfilePicture: vi.fn(),
    deleteProfilePicture: vi.fn(),
  },
}));

vi.mock('../services/user.service', () => ({
  userService: {
    getChildren: vi.fn().mockResolvedValue([]),
    getLinkedRelationships: vi.fn().mockResolvedValue({
      success: true,
      data: {
        userId: 'par-00',
        role: 'PARENT',
        children: [],
      },
    }),
  },
}));

describe('Smart Notification Counters & Navigation Integrity', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    localStorage.setItem('token', 'mock-token');
    currentLanguage = 'ar';
    currentMockUser = {
      id: 'user-admin',
      name: 'Admin User',
      email: 'admin@ox-digital.edu',
      role: 'ADMIN',
    };
  });

  it('eliminates fake static badge: 3 from adminMenuItems', () => {
    const approvalsItem = adminMenuItems.find((item) => item.path === '/admin/approvals');
    expect(approvalsItem).toBeDefined();
    expect(approvalsItem?.badge).toBeUndefined();
  });

  it('calculates zero badge when no pending approvals exist', async () => {
    (accountingService.getExpenses as any).mockResolvedValue({ vouchers: [] });
    (notificationService.getUnreadCount as any).mockResolvedValue({ data: { unreadCount: 0 } });

    const { result } = renderHook(() => useSmartNavigationCounters());

    await waitFor(() => {
      expect(result.current.counters.pendingApprovals).toBe(0);
    });

    const transformed = result.current.applyBadgesToMenuItems(adminMenuItems);
    const approvals = transformed.find((i) => i.path === '/admin/approvals');
    expect(approvals?.badge).toBeUndefined();
  });

  it('dynamically sets badge based on authoritative pending approvals from accountingService', async () => {
    currentMockUser = {
      id: 'user-mgr',
      name: 'Manager User',
      email: 'manager@ox-digital.edu',
      role: 'PRIMARY_MANAGER',
    };

    (accountingService.getExpenses as any).mockResolvedValue({
      vouchers: [
        { id: 'v1', status: 'PENDING_APPROVAL' },
        { id: 'v2', status: 'PENDING_APPROVAL' },
        { id: 'v3', status: 'PENDING_APPROVAL' },
        { id: 'v4', status: 'PENDING_APPROVAL' }
      ],
    });
    (notificationService.getUnreadCount as any).mockResolvedValue({ data: { unreadCount: 2 } });

    const { result } = renderHook(() => useSmartNavigationCounters());

    await waitFor(() => {
      expect(result.current.counters.pendingApprovals).toBe(4);
      expect(result.current.counters.unreadNotifications).toBe(2);
    });

    const transformed = result.current.applyBadgesToMenuItems(adminMenuItems);
    const approvals = transformed.find((i) => i.path === '/admin/approvals');
    expect(approvals?.badge).toBe(4);
  });

  it('ignores vouchers with missing, null, or invalid status (Phase A2 Security Fix)', async () => {
    currentMockUser = {
      id: 'user-mgr-2',
      name: 'Manager User',
      email: 'manager2@ox-digital.edu',
      role: 'PRIMARY_MANAGER',
    };

    (accountingService.getExpenses as any).mockResolvedValue({
      vouchers: [
        { id: 'v1' }, // Missing status
        { id: 'v2', status: null }, // Null status
        { id: 'v3', status: 'REJECTED' }, // Rejected status
        { id: 'v4', status: 'PENDING_APPROVAL' }, // Valid status
      ],
    });
    (notificationService.getUnreadCount as any).mockResolvedValue({ data: { unreadCount: 0 } });

    const { result } = renderHook(() => useSmartNavigationCounters());

    await waitFor(() => {
      // Strictly 1 voucher should be counted
      expect(result.current.counters.pendingApprovals).toBe(1);
    });
  });

  it('uses authoritative backend homeworkService.getPendingCount without limit=10 truncation', async () => {
    currentMockUser = {
      id: 'stu-99',
      name: 'Student User',
      email: 'student@ox-digital.edu',
      role: 'ONLINE_STUDENT',
    };

    (homeworkService.getPendingCount as any).mockResolvedValue({ data: { pendingCount: 14, total: 20 } });
    (notificationService.getUnreadCount as any).mockResolvedValue({ data: { unreadCount: 0 } });

    const { result } = renderHook(() => useSmartNavigationCounters());

    await waitFor(() => {
      expect(result.current.counters.pendingHomework).toBe(14);
      expect(result.current.isError).toBe(false);
    });
  });

  it('fails safe to isError when student homeworkService.getPendingCount fails or returns invalid data', async () => {
    currentMockUser = {
      id: 'stu-err',
      name: 'Student Err',
      email: 'student-err@ox-digital.edu',
      role: 'CENTER_STUDENT',
    };

    (homeworkService.getPendingCount as any).mockRejectedValue(new Error('Service unavailable'));
    (notificationService.getUnreadCount as any).mockResolvedValue({ data: { unreadCount: 0 } });

    const { result } = renderHook(() => useSmartNavigationCounters());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
      expect(result.current.isError).toBe(true);
      expect(result.current.getBadgeForPath('/student/center/homework')).toBeUndefined();
    });
  });

  it('authoritatively uses backend summary.totalCount when pagination limit (50) is reached (Phase A4 Fix)', async () => {
    currentMockUser = {
      id: 'user-mgr-page',
      name: 'Manager Page',
      email: 'manager-page@ox-digital.edu',
      role: 'PRIMARY_MANAGER',
    };

    // Return 50 vouchers in page, but backend authoritative total is 75
    const fiftyVouchers = Array.from({ length: 50 }, (_, i) => ({
      id: `v-${i}`,
      status: 'PENDING_APPROVAL'
    }));

    (accountingService.getExpenses as any).mockResolvedValue({
      vouchers: fiftyVouchers,
      summary: {
        totalCount: 75,
        totalAmount: 180000,
        currency: 'EGP'
      },
      pagination: {
        total: 75,
        page: 1,
        limit: 50,
        totalPages: 2
      }
    });
    (notificationService.getUnreadCount as any).mockResolvedValue({ data: { unreadCount: 0 } });

    const { result } = renderHook(() => useSmartNavigationCounters());

    await waitFor(() => {
      // Must reflect the authoritative total 75 rather than page size 50
      expect(result.current.counters.pendingApprovals).toBe(75);
    });
  });

  it('exposes explicit isError state on network or service request failure (Phase A3 Transparency Fix)', async () => {
    currentMockUser = {
      id: 'user-mgr-err',
      name: 'Manager Error',
      email: 'manager-err@ox-digital.edu',
      role: 'PRIMARY_MANAGER',
    };

    (accountingService.getExpenses as any).mockRejectedValue(new Error('Network failure'));
    (notificationService.getUnreadCount as any).mockResolvedValue({ data: { unreadCount: 0 } });

    const { result } = renderHook(() => useSmartNavigationCounters());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
      expect(result.current.isError).toBe(true);
    });
  });

  it('dynamically sets student pending homework counters identically for center and online students', async () => {
    currentMockUser = {
      id: 'stu-99',
      name: 'Student User',
      email: 'student@ox-digital.edu',
      role: 'CENTER_STUDENT',
    };

    (homeworkService.getPendingCount as any).mockResolvedValue({ data: { pendingCount: 2, total: 5 } });
    (notificationService.getUnreadCount as any).mockResolvedValue({ data: { unreadCount: 0 } });

    const { result } = renderHook(() => useSmartNavigationCounters());

    await waitFor(() => {
      expect(result.current.counters.pendingHomework).toBe(2);
    });

    expect(result.current.getBadgeForPath('/student/center/homework')).toBe(2);
    expect(result.current.getBadgeForPath('/student/online/homework')).toBe(2);
  });

  it('tracks authoritative unreadNotifications for PARENT without fabricating actionable parent tasks', async () => {
    currentMockUser = {
      id: 'par-10',
      name: 'Parent User',
      role: 'PARENT',
    };

    (notificationService.getUnreadCount as any).mockResolvedValue({ data: { unreadCount: 5 } });

    const { result } = renderHook(() => useSmartNavigationCounters());

    await waitFor(() => {
      expect(result.current.counters.unreadNotifications).toBe(5);
      expect(result.current.counters.pendingApprovals).toBe(0);
      expect(result.current.counters.pendingDisbursements).toBe(0);
      expect(result.current.counters.pendingHomework).toBe(0);
    });

    expect(result.current.getBadgeForPath('/parent/notifications')).toBe(5);
    expect(result.current.getBadgeForPath('/parent/children')).toBeUndefined();
    expect(result.current.getBadgeForPath('/parent/home')).toBeUndefined();
  });
});

describe('Role-Based Contextual User Guidance Component', () => {
  beforeEach(() => {
    localStorage.clear();
    currentLanguage = 'ar';
  });

  it('renders student onboarding guidance with authentic explore courses action', () => {
    currentMockUser = { id: 'stu-99', name: 'Student', role: 'STUDENT_ONLINE' };

    render(
      <MemoryRouter>
        <ContextualGuidanceBanner forceShow mockState={{ enrolledCoursesCount: 0 }} />
      </MemoryRouter>
    );

    expect(screen.getByText(/استكشف المقررات المتاحة/)).toBeInTheDocument();
    expect(screen.getByText('استعراض المقررات')).toBeInTheDocument();
  });

  it('renders teacher onboarding guidance with manage courses action', () => {
    currentMockUser = { id: 'teach-55', name: 'Teacher', role: 'TEACHER', branchId: 'b1' };

    render(
      <MemoryRouter>
        <ContextualGuidanceBanner forceShow mockState={{ teacherCoursesCount: 0 }} />
      </MemoryRouter>
    );

    expect(screen.getByText(/ابدأ ببناء مقررك التعليمي الأول/)).toBeInTheDocument();
    expect(screen.getByText('إدارة المقررات')).toBeInTheDocument();
  });

  it('renders accountant onboarding guidance with collection desk action', () => {
    currentMockUser = { id: 'acc-12', name: 'Accountant', role: 'ACCOUNTANT' };

    render(
      <MemoryRouter>
        <ContextualGuidanceBanner forceShow mockState={{ pendingDisbursementsCount: 0 }} />
      </MemoryRouter>
    );

    expect(screen.getByText('مكتب التحصيل والسداد اليومي')).toBeInTheDocument();
    expect(screen.getByText('مكتب التحصيل والسداد')).toBeInTheDocument();
  });

  it('renders primary manager onboarding guidance with branch management action', () => {
    currentMockUser = { id: 'mgr-01', name: 'Manager', role: 'PRIMARY_MANAGER' };

    render(
      <MemoryRouter>
        <ContextualGuidanceBanner forceShow mockState={{ pendingApprovalsCount: 0 }} />
      </MemoryRouter>
    );

    expect(screen.getByText('مرحباً بك في مركز الإدارة العامة والحوكمة')).toBeInTheDocument();
    expect(screen.getByText('إدارة الفروع والتوزيع')).toBeInTheDocument();
  });

  it('renders parent onboarding guidance with children monitoring action', () => {
    currentMockUser = { id: 'par-77', name: 'Parent', role: 'PARENT' };

    render(
      <MemoryRouter>
        <ContextualGuidanceBanner forceShow mockState={{ childrenCount: 1 }} />
      </MemoryRouter>
    );

    expect(screen.getByText('مرحباً بك في بوابة متابعة ولي الأمر')).toBeInTheDocument();
    expect(screen.getByText('متابعة الأبناء')).toBeInTheDocument();
  });

  it('dismisses banner and persists dismissal in localStorage per user, role, and step', () => {
    currentMockUser = { id: 'teach-999', name: 'Teacher', role: 'TEACHER', branchId: 'b1' };

    const { rerender } = render(
      <MemoryRouter>
        <ContextualGuidanceBanner mockState={{ teacherCoursesCount: 0 }} />
      </MemoryRouter>
    );

    expect(screen.getByText(/ابدأ ببناء مقررك التعليمي الأول/)).toBeInTheDocument();

    const dismissBtn = screen.getByLabelText('إغلاق الإرشاد');
    fireEvent.click(dismissBtn);

    expect(screen.queryByText(/ابدأ ببناء مقررك التعليمي الأول/)).not.toBeInTheDocument();
    expect(localStorage.getItem('ox_guidance_dismissed_TEACHER_teach-999_TEACHER_CREATE_COURSE')).toBe('true');

    // Re-rendering should not show the banner
    rerender(
      <MemoryRouter>
        <ContextualGuidanceBanner mockState={{ teacherCoursesCount: 0 }} />
      </MemoryRouter>
    );
    expect(screen.queryByText(/ابدأ ببناء مقررك التعليمي الأول/)).not.toBeInTheDocument();
  });

  it('renders in English when English locale is selected', () => {
    currentMockUser = { id: 'teach-en', name: 'Teacher', role: 'TEACHER', branchId: 'b1' };
    currentLanguage = 'en';

    render(
      <MemoryRouter>
        <ContextualGuidanceBanner forceShow mockState={{ teacherCoursesCount: 0 }} />
      </MemoryRouter>
    );

    expect(screen.getByText('Start by creating your first course')).toBeInTheDocument();
    expect(screen.getByText('Manage Courses')).toBeInTheDocument();
  });

  it('renders financial restriction blocker with canonical plural route /student/center/subscriptions (Phase C Fix)', () => {
    currentMockUser = {
      id: 'stu-res',
      name: 'Restricted Student',
      role: 'CENTER_STUDENT',
      financialAccessStatus: 'RESTRICTED',
    };

    render(
      <MemoryRouter>
        <ContextualGuidanceBanner forceShow />
      </MemoryRouter>
    );

    expect(screen.getByText('مراجعة الاشتراكات')).toBeInTheDocument();
    const guidance = resolveStateAwareGuidance(currentMockUser, {});
    expect(guidance?.actionRoute).toBe('/student/center/subscriptions');
  });

  it('renders primary manager branch management with direct canonical route /admin/branches (Phase C Fix)', () => {
    currentMockUser = { id: 'mgr-01', name: 'Manager', role: 'PRIMARY_MANAGER' };

    render(
      <MemoryRouter>
        <ContextualGuidanceBanner forceShow mockState={{ pendingApprovalsCount: 0 }} />
      </MemoryRouter>
    );

    expect(screen.getByText('إدارة الفروع والتوزيع')).toBeInTheDocument();
    const guidance = resolveStateAwareGuidance(currentMockUser, { pendingApprovalsCount: 0 });
    expect(guidance?.actionRoute).toBe('/admin/branches');
  });

  it('renders parent zero children onboarding with deep-link /parent/settings?tab=linking (Phase D Fix)', () => {
    currentMockUser = { id: 'par-00', name: 'Parent No Kids', role: 'PARENT' };

    render(
      <MemoryRouter>
        <ContextualGuidanceBanner forceShow mockState={{ childrenCount: 0 }} />
      </MemoryRouter>
    );

    expect(screen.getByText('لا يوجد أبناء مرتبطين بحسابك حالياً')).toBeInTheDocument();
    expect(screen.getByText('إعدادات ربط الأبناء')).toBeInTheDocument();
    const guidance = resolveStateAwareGuidance(currentMockUser, { childrenCount: 0 });
    expect(guidance?.actionRoute).toBe('/parent/settings?tab=linking');
  });

  it('correctly tracks accountant disbursement lifecycle (Fix B): excludes disbursedAt vouchers', async () => {
    localStorage.setItem('token', 'mock-token');
    currentMockUser = {
      id: 'acc-branch-1',
      name: 'Accountant User',
      email: 'acc@ox-digital.edu',
      role: 'ACCOUNTANT',
      branchId: 'b1',
    };

    (accountingService.getExpenses as any).mockResolvedValue({
      vouchers: [
        { id: 'v-approved-1', status: 'APPROVED', disbursedAt: null, disbursedById: null }, // Undisbursed: ACTIONABLE
        { id: 'v-disbursed-2', status: 'APPROVED', disbursedAt: '2026-11-09T10:00:00Z', disbursedById: 'acc-99' }, // Disbursed: EXCLUDED
        { id: 'v-rejected-3', status: 'REJECTED' }, // Rejected: EXCLUDED
      ],
      // No summary total provided to test client-side lifecycle filter
    });
    (notificationService.getUnreadCount as any).mockResolvedValue({ data: { unreadCount: 0 } });

    const { result } = renderHook(() => useSmartNavigationCounters());

    await waitFor(() => {
      // Exactly 1 undisbursed voucher counted
      expect(result.current.counters.pendingDisbursements).toBe(1);
    });
  });

  it('fails safe to isError when 50 items return with missing authoritative summary total (Fix B pagination defense)', async () => {
    localStorage.setItem('token', 'mock-token');
    currentMockUser = {
      id: 'acc-branch-2',
      name: 'Accountant User 2',
      email: 'acc2@ox-digital.edu',
      role: 'ACCOUNTANT',
      branchId: 'b1',
    };

    // Exactly 50 vouchers returned, but no authoritative total from backend
    const fiftyVouchers = Array.from({ length: 50 }, (_, i) => ({
      id: `v-trunc-${i}`,
      status: 'APPROVED',
      disbursedAt: null,
    }));

    (accountingService.getExpenses as any).mockResolvedValue({
      vouchers: fiftyVouchers,
      // summary and pagination are intentionally undefined
    });
    (notificationService.getUnreadCount as any).mockResolvedValue({ data: { unreadCount: 0 } });

    const { result } = renderHook(() => useSmartNavigationCounters());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
      // Fails safe: does not falsely claim the truncated 50 is the authoritative total
      expect(result.current.isError).toBe(true);
    });
  });

  it('resolves parent live linked children via userService.getChildren and fails closed on relationship error', async () => {
    // Case 1: Parent with 2 linked children (even though user.children is absent on AuthContext user)
    currentMockUser = { id: 'par-live-1', name: 'Parent Live', role: 'PARENT' };
    (userService.getChildren as any).mockResolvedValueOnce([
      { id: 'c1', name: 'Child 1' },
      { id: 'c2', name: 'Child 2' }
    ]);

    const { rerender } = render(
      <MemoryRouter>
        <ContextualGuidanceBanner forceShow />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('مرحباً بك في بوابة متابعة ولي الأمر')).toBeInTheDocument();
    });
    expect(screen.queryByText('لا يوجد أبناء مرتبطين بحسابك حالياً')).not.toBeInTheDocument();

    // Case 2: Failed relationship response must NOT falsely show zero-children blocker
    currentMockUser = { id: 'par-live-err', name: 'Parent Err', role: 'PARENT' };
    (userService.getChildren as any).mockRejectedValueOnce(new Error('Network error'));

    rerender(
      <MemoryRouter>
        <ContextualGuidanceBanner forceShow />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(userService.getChildren).toHaveBeenCalledTimes(2);
    });
    expect(screen.queryByText('لا يوجد أبناء مرتبطين بحسابك حالياً')).not.toBeInTheDocument();
  });

  it('re-engages parent guidance when ox:relationships-updated fires after linking a child', async () => {
    currentMockUser = { id: 'par-link-flow', name: 'Parent Flow', role: 'PARENT' };
    (userService.getChildren as any)
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ id: 'c1', name: 'Child 1' }]);

    render(
      <MemoryRouter>
        <ContextualGuidanceBanner forceShow />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('لا يوجد أبناء مرتبطين بحسابك حالياً')).toBeInTheDocument();
    });

    act(() => {
      window.dispatchEvent(new Event('ox:relationships-updated'));
    });

    await waitFor(() => {
      expect(screen.getByText('مرحباً بك في بوابة متابعة ولي الأمر')).toBeInTheDocument();
    });
  });
});

describe('AccountSettingsPage Deep-Link Tab History Synchronization (Fix C)', () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem('token', 'mock-token');
    currentLanguage = 'ar';
    currentMockUser = {
      id: 'parent-deep-link-user',
      name: 'ولي الأمر المستهدف',
      email: 'parent@ox-digital.edu',
      role: 'PARENT',
    };
  });

  // Helper test component allowing simulation of real browser Back/Forward navigation
  const TestHistoryContainer: React.FC = () => {
    const navigate = useNavigate();
    return (
      <div>
        <button data-testid="browser-back-btn" onClick={() => navigate(-1)}>
          Back
        </button>
        <button data-testid="browser-forward-btn" onClick={() => navigate(1)}>
          Forward
        </button>
        <button data-testid="nav-plain-settings" onClick={() => navigate('/parent/settings')}>
          Plain Settings
        </button>
        <AccountSettingsPage />
      </div>
    );
  };

  it('activates linking tab and renders child linking interface when navigated with ?tab=linking', async () => {
    render(
      <MemoryRouter initialEntries={['/parent/settings?tab=linking']}>
        <AccountSettingsPage />
      </MemoryRouter>
    );

    // Verify that the authentic Account Identifier card is mounted
    await waitFor(() => {
      expect(screen.getByText('معرف الحساب المعتمد (Account Identifier)')).toBeInTheDocument();
    });
  });

  it('activates default preferences tab when navigated without query parameter', async () => {
    render(
      <MemoryRouter initialEntries={['/parent/settings']}>
        <AccountSettingsPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('لغة واجهة المنصة (Language)')).toBeInTheDocument();
    });
  });

  it('safely falls back to default preferences tab when query parameter is invalid', async () => {
    render(
      <MemoryRouter initialEntries={['/parent/settings?tab=unknown_tab_name']}>
        <AccountSettingsPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('لغة واجهة المنصة (Language)')).toBeInTheDocument();
    });
  });

  it('activates profile tab when navigated with ?tab=profile', async () => {
    render(
      <MemoryRouter initialEntries={['/parent/settings?tab=profile']}>
        <AccountSettingsPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('الصورة الشخصية (Profile Picture)')).toBeInTheDocument();
    });
  });

  it('synchronizes tab selection with browser history on Tab click and handles Back and Forward navigation', async () => {
    render(
      <MemoryRouter initialEntries={['/parent/settings?tab=linking']}>
        <TestHistoryContainer />
      </MemoryRouter>
    );

    // 1. Initial State: linking tab is active
    await waitFor(() => {
      expect(screen.getByText('معرف الحساب المعتمد (Account Identifier)')).toBeInTheDocument();
    });

    // 2. User clicks on "الملف الشخصي والصورة" (Profile tab button)
    const profileTabButton = screen.getByText('الملف الشخصي والصورة');
    fireEvent.click(profileTabButton);

    // Verify Profile tab mounts
    await waitFor(() => {
      expect(screen.getByText('الصورة الشخصية (Profile Picture)')).toBeInTheDocument();
    });

    // 3. User navigates Browser Back (returns to ?tab=linking)
    const backBtn = screen.getByTestId('browser-back-btn');
    fireEvent.click(backBtn);

    // Verify Linking tab is re-activated via searchParams sync
    await waitFor(() => {
      expect(screen.getByText('معرف الحساب المعتمد (Account Identifier)')).toBeInTheDocument();
    });

    // 4. User navigates Browser Forward (returns to ?tab=profile)
    const forwardBtn = screen.getByTestId('browser-forward-btn');
    fireEvent.click(forwardBtn);

    // Verify Profile tab is restored
    await waitFor(() => {
      expect(screen.getByText('الصورة الشخصية (Profile Picture)')).toBeInTheDocument();
    });

    // 5. Returning to /parent/settings without tab query restores default preferences tab
    const plainBtn = screen.getByTestId('nav-plain-settings');
    fireEvent.click(plainBtn);

    await waitFor(() => {
      expect(screen.getByText('لغة واجهة المنصة (Language)')).toBeInTheDocument();
    });
  });

  it('handles repeated clicks on the active tab without triggering re-render loops or navigation errors', async () => {
    render(
      <MemoryRouter initialEntries={['/parent/settings?tab=linking']}>
        <AccountSettingsPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('معرف الحساب المعتمد (Account Identifier)')).toBeInTheDocument();
    });

    const linkingTabBtn = screen.getByText('الربط الأكاديمي ومعرف الحساب');
    // Repeated clicks on the already active tab
    fireEvent.click(linkingTabBtn);
    fireEvent.click(linkingTabBtn);
    fireEvent.click(linkingTabBtn);

    // State remains stable and child linking view remains intact
    expect(screen.getByText('معرف الحساب المعتمد (Account Identifier)')).toBeInTheDocument();
  });
});
